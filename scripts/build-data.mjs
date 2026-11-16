// Builds src/data/data.json from public standings feeds.
//
// Self-healing rules:
//  - Completed seasons already in data.json are kept as they are; only missing
//    seasons and the two most recent seasons per league are fetched (use --full
//    to refetch everything).
//  - Every request retries with backoff. A season that still fails, or fails
//    validation, keeps its last good copy and is reported in meta.warnings.
//  - The file is only rewritten when the result passes the league-level checks,
//    so a broken upstream never ships.
//
// Usage: node scripts/build-data.mjs [--full] [--check]

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "data", "data.json");
const FULL = process.argv.includes("--full");
const CHECK_ONLY = process.argv.includes("--check");
const NOW = new Date();

const LEAGUES = {
  NFL: { path: "football/nfl", first: 1922, offset: 0, size: 32, sched: 17 },
  MLB: { path: "baseball/mlb", first: 1903, offset: 0, size: 30, sched: 162 },
  // NBA and NHL seasons are requested by END year; we store the START year.
  NBA: { path: "basketball/nba", first: 1946, offset: 1, size: 30, sched: 82 },
  // NHL records come from the league's own stats API: ESPN's history has seasons with playoff games mixed in.
  NHL: { path: "hockey/nhl", first: 1917, offset: 1, size: 32, sched: 84 },
};

// Old identities that the feeds keep under a separate id but that belong to a
// current franchise. Arizona Coyotes (and the original Winnipeg Jets before
// them) are rolled into Utah: same organisation, new name.
const ESPN_ALIAS = { NHL: { "Arizona Coyotes": "Utah Mammoth", "Phoenix Coyotes": "Utah Mammoth", "Utah Hockey Club": "Utah Mammoth" } };
const NHL_FRANCHISE_ALIAS = { "Arizona Coyotes": "Utah Mammoth", "Montréal Canadiens": "Montreal Canadiens" };

const PATCH_FILE = path.join(ROOT, "scripts", "source", "patches.json");
const PATCHES = existsSync(PATCH_FILE) ? JSON.parse(await readFile(PATCH_FILE, "utf8")) : {};

// The per-team endpoint also returns ABA records. These clubs entered the NBA in 1976-77.
const JOINED = { NBA: { "Brooklyn Nets": 1976, "Indiana Pacers": 1976, "Denver Nuggets": 1976, "San Antonio Spurs": 1976 } };

const warnings = [];
const warn = (m) => { warnings.push(m); console.warn("warn:", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = AbortSignal.timeout(25000);
      const res = await fetch(url, { signal: ctl, headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e;
      await sleep((/429/.test(String(e?.message)) ? 4000 : 600) * 2 ** i + Math.random() * 300);
    }
  }
  throw new Error(`${url} failed: ${last?.message ?? last}`);
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const stat = (entry, ...names) => {
  for (const n of names) {
    const s = entry.stats?.find((x) => x.name === n);
    if (s && typeof s.value === "number") return s.value;
  }
  return 0;
};

async function loadTeams() {
  const metros = JSON.parse(await readFile(path.join(ROOT, "scripts", "source", "metros.json"), "utf8"));
  const teams = [];
  for (const [league, cfg] of Object.entries(LEAGUES)) {
    const d = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${cfg.path}/teams?limit=100`);
    const list = d.sports[0].leagues[0].teams.map((x) => x.team).filter((t) => t.isActive && !t.isAllStar);
    if (list.length !== cfg.size) throw new Error(`${league}: expected ${cfg.size} teams, feed returned ${list.length}`);
    for (const t of list) {
      const name = clean(t.displayName);
      const metro = metros.teamMetro[name];
      if (!metro) throw new Error(`No metro mapping for ${name}. Add it to scripts/source/metros.json`);
      const logo = t.logos?.find((l) => l.rel?.includes("default"))?.href ?? t.logos?.[0]?.href;
      const logoDark = t.logos?.find((l) => l.rel?.includes("dark") && !l.rel.includes("scoreboard"))?.href ?? logo;
      teams.push({
        key: `${league}-${t.abbreviation}`.toLowerCase(),
        espnId: String(t.id),
        league,
        name,
        nick: clean(t.name || t.shortDisplayName),
        place: clean(t.location),
        abbr: t.abbreviation,
        color: `#${t.color || "444444"}`,
        alt: `#${t.alternateColor || "bbbbbb"}`,
        logo,
        logoDark,
        metro,
      });
    }
  }
  return { teams, metros: metros.metros };
}

// One season from ESPN. Returns { y, rows: [[teamKey|null, name, w, l, t]], live } or null when the feed has no such season.
async function espnSeason(league, y, teamByEspn, teamByName, currentTeams) {
  const cfg = LEAGUES[league];
  const req = y + cfg.offset;
  const d = await getJson(`https://site.api.espn.com/apis/v2/sports/${cfg.path}/standings?season=${req}&level=1`);
  const st = d.standings;
  if (!st || st.season !== req) return null; // the feed falls back to the current season when it has nothing
  const rows = [];
  for (const e of st.entries ?? []) {
    const name = clean(e.team.displayName);
    const alias = ESPN_ALIAS[league]?.[name];
    const team = alias ? teamByName.get(`${league}:${alias}`) : teamByEspn.get(`${league}:${e.team.id}`);
    const w = stat(e, "wins");
    const l = stat(e, "losses") + (league === "NHL" ? stat(e, "otLosses", "overtimeLosses") : 0);
    const t = stat(e, "ties");
    if (w + l + t === 0) continue;
    rows.push([team?.key ?? null, name, w, l, t]);
  }
  if (!rows.length) return null;
  // Older standings sometimes leave a club out, which shows up as wins and losses
  // not adding up. Fill from the hand-kept patch file first, then ask the
  // per-team record endpoint, keeping only records that move the season toward balance.
  const gap = () => rows.reduce((a, r) => a + r[2] - r[3], 0);
  const patch = PATCHES[league]?.[y];
  if (patch) {
    const have = new Set(rows.map((r) => r[0] ?? `defunct:${r[1]}`));
    const before = rows.length;
    for (const [name, rec] of Object.entries(patch)) {
      if (name.startsWith("defunct:")) continue;
      const t = teamByName.get(`${league}:${name}`);
      if (!t) { warn(`patches.json: unknown ${league} team "${name}"`); continue; }
      if (!have.has(t.key)) rows.push([t.key, t.name, rec[0], rec[1], rec[2] ?? 0]);
    }
    // Defunct clubs only matter for the season's spread; add them when the feed has fewer clubs than the patch.
    const missing = Object.keys(patch).length - rows.length;
    if (missing > 0) {
      const names = new Set(rows.map((r) => r[1].toLowerCase()));
      for (const [name, rec] of Object.entries(patch)) {
        if (!name.startsWith("defunct:")) continue;
        const plain = name.slice(8);
        if (names.has(plain.toLowerCase())) continue;
        const sameRecord = rows.some((r) => !r[0] && r[2] === rec[0] && r[3] === rec[1]);
        if (!sameRecord) rows.push([null, plain, rec[0], rec[1], rec[2] ?? 0]);
      }
    }
    if (rows.length !== before) console.log(`${league} ${y}: patched ${rows.length - before} club(s)`);
  }
  if (Math.abs(gap()) > 1) {
    const have = new Set(rows.map((r) => r[0]));
    const absent = currentTeams.filter((t) => t.league === league && !have.has(t.key) && !(y < (JOINED[league]?.[t.name] ?? 0)));
    const core = cfg.path.replace("/", "/leagues/");
    const found = (await pool(absent, 4, async (t) => {
      try {
        const rec = await getJson(`https://sports.core.api.espn.com/v2/sports/${core}/seasons/${req}/types/2/teams/${t.espnId}/record`, 3);
        const item = rec.items?.find((i) => i.type === "total") ?? rec.items?.find((i) => i.name === "overall");
        const v = (n) => item?.stats?.find((x) => x.name === n)?.value ?? 0;
        const w = v("wins"), l = v("losses"), tt = v("ties");
        return w + l + tt > 0 ? [t.key, t.name, w, l, tt] : null;
      } catch { return null; }
    })).filter(Boolean);
    for (const r of found) {
      if (Math.abs(gap() + r[2] - r[3]) < Math.abs(gap())) { rows.push(r); console.log(`${league} ${y}: filled ${r[1]} ${r[2]}-${r[3]}`); }
    }
  }
  const info = d.seasons?.find((s) => s.year === req);
  const reg = info?.types?.find((t) => String(t.id) === "2");
  const live = reg?.endDate ? NOW < new Date(reg.endDate) : false;
  const postEnd = info?.endDate ?? null;
  return { y, rows, live, postEnd };
}

async function nhlLegacy(teamByName) {
  const [teamList, franchises] = await Promise.all([
    getJson("https://api.nhle.com/stats/rest/en/team"),
    getJson("https://api.nhle.com/stats/rest/en/franchise"),
  ]);
  const franchiseName = new Map(franchises.data.map((f) => [f.id, f.fullName]));
  const teamFranchise = new Map(teamList.data.map((t) => [t.id, t.franchiseId]));
  return async (y) => {
    const id = `${y}${y + 1}`;
    const d = await getJson(`https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=${id}%20and%20gameTypeId=2`);
    const rows = [];
    for (const r of d.data ?? []) {
      const fname = franchiseName.get(teamFranchise.get(r.teamId)) ?? r.teamFullName;
      const current = NHL_FRANCHISE_ALIAS[fname] ?? fname;
      const team = teamByName.get(`NHL:${current}`);
      const w = r.wins ?? 0;
      const l = (r.losses ?? 0) + (r.otLosses ?? 0);
      const t = r.ties ?? 0;
      if (w + l + t === 0) continue;
      rows.push([team?.key ?? null, r.teamFullName, w, l, t]);
    }
    if (!rows.length) return null;
    // Regular season runs to mid April, the Final to late June.
    const live = NOW < new Date(Date.UTC(y + 1, 3, 20));
    return { y, rows, live, postEnd: new Date(Date.UTC(y + 1, 5, 30)).toISOString() };
  };
}

function validateSeason(league, s) {
  const cfg = LEAGUES[league];
  const W = s.rows.reduce((a, r) => a + r[2], 0);
  const L = s.rows.reduce((a, r) => a + r[3], 0);
  const problems = [];
  // Every game has one winner and one loser. Early records have a few holes, so allow a little slack there.
  const recent = s.y >= NOW.getUTCFullYear() - 2;
  const tol = recent ? 1 : Math.max(2, 0.04 * W);
  if (Math.abs(W - L) > tol) problems.push(`wins ${W} != losses ${L}`);
  for (const r of s.rows) {
    if (r[2] + r[3] + r[4] > cfg.sched + 8) problems.push(`${r[1]} has ${r[2] + r[3] + r[4]} games`);
    if (r[2] < 0 || r[3] < 0) problems.push(`${r[1]} negative record`);
  }
  const keys = s.rows.map((r) => r[0]).filter(Boolean);
  if (new Set(keys).size !== keys.length) problems.push("a franchise appears twice");
  return problems;
}

function pack(league, s) {
  // RMS distance from .500 across every team that played that season, current or not.
  const pcts = s.rows.filter((r) => r[2] + r[3] > 0).map((r) => r[2] / (r[2] + r[3]));
  const sd = Math.sqrt(pcts.reduce((a, p) => a + (p - 0.5) ** 2, 0) / pcts.length);
  const rows = {};
  for (const [key, , w, l, t] of s.rows) if (key) rows[key] = t ? [w, l, t] : [w, l];
  return { y: s.y, n: s.rows.length, sd: +sd.toFixed(5), live: s.live || undefined, postEnd: s.postEnd || undefined, rows };
}

const FINAL_NOTE = { NBA: /nba finals/i, NHL: /stanley cup final/i, MLB: /world series/i, NFL: /super bowl/i };

// Finds the champion of a finished season from the postseason scoreboard, for
// seasons newer than scripts/source/champions.json.
async function detectChampion(league, season, teamByEspn) {
  const cfg = LEAGUES[league];
  const pick = (events) => {
    for (const e of [...events].reverse()) {
      const c = e.competitions?.[0];
      if (!e.status?.type?.completed || !c) continue;
      if (!c.notes?.some((n) => FINAL_NOTE[league].test(n.headline ?? ""))) continue;
      if (league !== "NFL" && !c.series?.completed) continue;
      const win = c.competitors.find((x) => x.winner);
      const lose = c.competitors.find((x) => !x.winner);
      if (!win || !lose) continue;
      return {
        champ: teamByEspn.get(`${league}:${win.team.id}`)?.key ?? null,
        runnerUp: teamByEspn.get(`${league}:${lose.team.id}`)?.key ?? null,
      };
    }
    return null;
  };
  const base = `https://site.api.espn.com/apis/site/v2/sports/${cfg.path}/scoreboard`;
  if (league === "NFL") {
    const d = await getJson(`${base}?dates=${season.y}&seasontype=3&week=5`);
    return pick(d.events ?? []);
  }
  if (!season.postEnd) return null;
  const end = new Date(season.postEnd);
  if (NOW < new Date(end.getTime() - 40 * 864e5)) return null; // finals cannot have happened yet
  for (let back = 0; back < 28; back++) {
    const day = new Date(Math.min(end.getTime(), NOW.getTime()) - back * 864e5);
    const ymd = day.toISOString().slice(0, 10).replace(/-/g, "");
    const d = await getJson(`${base}?dates=${ymd}`);
    const hit = pick(d.events ?? []);
    if (hit) return hit;
  }
  return null;
}

async function main() {
  const prev = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : null;
  const { teams, metros } = await loadTeams();
  const teamByEspn = new Map(teams.map((t) => [`${t.league}:${t.espnId}`, t]));
  const teamByName = new Map(teams.map((t) => [`${t.league}:${t.name}`, t]));
  const legacyNhl = await nhlLegacy(teamByName);

  const champFile = path.join(ROOT, "scripts", "source", "champions.json");
  const champs = existsSync(champFile) ? JSON.parse(await readFile(champFile, "utf8")) : {};
  const resolve = (league, name) => {
    if (!name || name.startsWith("defunct:")) return null;
    const t = teamByName.get(`${league}:${name}`);
    if (!t) warn(`champions.json: unknown ${league} team "${name}"`);
    return t?.key ?? null;
  };

  const out = { leagues: {} };
  const unmatched = new Map();

  for (const [league, cfg] of Object.entries(LEAGUES)) {
    const thisYear = NOW.getUTCFullYear();
    const years = [];
    for (let y = cfg.first; y <= thisYear; y++) years.push(y);
    const prevByYear = new Map((prev?.leagues?.[league]?.seasons ?? []).map((s) => [s.y, s]));
    const volatileFrom = thisYear - 2;

    const fetched = await pool(years, league === "NHL" ? 2 : 6, async (y) => {
      const old = prevByYear.get(y);
      if (old && !FULL && y < volatileFrom && !old.live) return { y, keep: old };
      try {
        const s = league === "NHL" ? await legacyNhl(y) : await espnSeason(league, y, teamByEspn, teamByName, teams);
        if (!s) return { y, keep: old ?? null, missing: true };
        const problems = validateSeason(league, s);
        if (problems.length) {
          if (old) { warn(`${league} ${y}: ${problems.join("; ")} - kept previous copy`); return { y, keep: old }; }
          const recent = y >= NOW.getUTCFullYear() - 2;
          if (recent && !s.live) { warn(`${league} ${y}: ${problems.join("; ")} - dropped`); return { y, keep: null }; }
          warn(`${league} ${y}: ${problems.join("; ")} - accepted with a gap`);
        }
        for (const r of s.rows) if (!r[0]) unmatched.set(`${league}:${r[1]}`, (unmatched.get(`${league}:${r[1]}`) ?? 0) + 1);
        return { y, fresh: pack(league, s) };
      } catch (e) {
        warn(`${league} ${y}: ${e.message}${old ? " - kept previous copy" : " - season missing"}`);
        return { y, keep: old ?? null };
      }
    });

    const champByYear = new Map((champs[league] ?? []).map((c) => [c.season, c]));
    const seasons = [];
    for (const f of fetched) {
      const s = f.fresh ?? f.keep;
      if (!s) continue;
      const old = prevByYear.get(s.y);
      const c = champByYear.get(s.y);
      if (c) {
        s.champ = resolve(league, c.champion) ?? undefined;
        s.runnerUp = resolve(league, c.runnerUp) ?? undefined;
        s.decided = true;
      } else if (!s.live) {
        // Newer than the reference list: read it off the postseason scoreboard, and remember it.
        if (old?.decided) { s.champ = old.champ; s.runnerUp = old.runnerUp; s.decided = true; }
        else {
          try {
            const hit = await detectChampion(league, s, teamByEspn);
            if (hit) { s.champ = hit.champ ?? undefined; s.runnerUp = hit.runnerUp ?? undefined; s.decided = true; }
          } catch (e) { warn(`${league} ${s.y}: champion lookup failed (${e.message})`); }
        }
      }
      seasons.push(s);
    }
    seasons.sort((a, b) => a.y - b.y);

    const latestDone = [...seasons].reverse().find((s) => !s.live);
    if (!latestDone || Object.keys(latestDone.rows).length !== cfg.size) {
      throw new Error(`${league}: latest finished season has ${latestDone ? Object.keys(latestDone.rows).length : 0} current teams, expected ${cfg.size}`);
    }
    if (seasons.length < (prevByYear.size || 0)) throw new Error(`${league}: would lose seasons (${prevByYear.size} -> ${seasons.length})`);
    out.leagues[league] = { seasons };
    console.log(`${league}: ${seasons.length} seasons, ${seasons[0].y}-${seasons.at(-1).y}${seasons.at(-1).live ? " (live)" : ""}`);
  }

  if (unmatched.size) console.log("teams with no current franchise:", [...unmatched].map(([k, n]) => `${k}×${n}`).join(", "));

  const body = { teams, metros, leagues: out.leagues };
  const changed = !prev || JSON.stringify({ teams: prev.teams, metros: prev.metros, leagues: prev.leagues }) !== JSON.stringify(body);
  if (CHECK_ONLY || !changed) { console.log(changed ? "changes found (not written)" : "no changes, file left as is"); return; }
  const result = { generatedAt: NOW.toISOString(), warnings, ...body };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(result));
  console.log(`updated: ${path.relative(ROOT, OUT)} (${warnings.length} warnings)`);
}

main().catch((e) => {
  console.error("build-data failed, existing data left untouched:", e.message);
  process.exit(1);
});
