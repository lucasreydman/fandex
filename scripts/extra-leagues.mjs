// The leagues beyond the big four: MLS, WNBA, NWSL, PWHL and CFL.
//
// Their history comes from reference files in scripts/source/leagues/ (standings,
// champions and franchise lineage compiled from Wikipedia), because the public
// feeds are thin or missing for older seasons. A live feed, where one exists,
// only supplies seasons newer than the reference file. Those count as in
// progress until the reference file records how they ended.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const EXTRA = {
  MLS: { label: "MLS", espn: "soccer/usa.1", draws: true },
  WNBA: { label: "WNBA", espn: "basketball/wnba" },
  NWSL: { label: "NWSL", espn: "soccer/usa.nwsl", draws: true },
  PWHL: { label: "PWHL", hockeytech: "key=446521baf8c38984&client_code=pwhl&fmt=json", split: true },
  CFL: { label: "CFL", espnTeams: "football/cfl" }, // team logos only: ESPN has no CFL standings
};

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const plain = (s) => clean(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slug = (s) => plain(s).replace(/[^a-z0-9]+/g, "").slice(0, 6);

// A draw is half a win in the leagues that have them, so 10-5-15 is not scored like 10-5.
const pctOf = (w, l, t, draws) => (draws ? (w + t / 2) / (w + l + t) : w / (w + l));

function pack(y, rows, draws, extra = {}) {
  const played = rows.filter((r) => r[2] + r[3] + (draws ? r[4] : 0) > 0);
  const sd = Math.sqrt(played.reduce((a, r) => a + (pctOf(r[2], r[3], r[4], draws) - 0.5) ** 2, 0) / played.length);
  const out = {};
  for (const [key, , w, l, t] of rows) if (key) out[key] = t ? [w, l, t] : [w, l];
  return { y, n: rows.length, sd: +sd.toFixed(5), ...extra, rows: out };
}

async function espnMeta(getJson, espnPath) {
  const d = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${espnPath}/teams?limit=100`);
  const meta = new Map();
  for (const { team: t } of d.sports[0].leagues[0].teams) {
    if (/^TBD/i.test(t.displayName)) continue;
    const logo = t.logos?.find((l) => l.rel?.includes("default"))?.href ?? t.logos?.[0]?.href ?? null;
    meta.set(plain(t.displayName), {
      id: String(t.id), abbr: t.abbreviation, color: `#${t.color || "444444"}`, alt: `#${t.alternateColor || "bbbbbb"}`,
      logo, logoDark: t.logos?.find((l) => l.rel?.includes("dark") && !l.rel.includes("scoreboard"))?.href ?? logo,
    });
  }
  return meta;
}

function walk(node, out = []) {
  for (const e of node?.standings?.entries ?? []) out.push(e);
  for (const c of node?.children ?? []) walk(c, out);
  return out;
}

export async function buildExtraLeagues({ ROOT, NOW, getJson, warn, prev, teams, metros, leagues }) {
  for (const [league, cfg] of Object.entries(EXTRA)) {
    const file = path.join(ROOT, "scripts", "source", "leagues", `${league}.json`);
    if (!existsSync(file)) { warn(`${league}: no reference file, league left out`); continue; }
    const ref = JSON.parse(await readFile(file, "utf8"));
    const prevSeasons = new Map((prev?.leagues?.[league]?.seasons ?? []).map((s) => [s.y, s]));

    for (const [name, m] of Object.entries(ref.metros ?? {})) if (!metros[name]) metros[name] = m;

    // Logos, colours and abbreviations from a feed; everything else from the reference file.
    let meta = new Map();
    let htSeasons = [];
    try {
      if (cfg.espn || cfg.espnTeams) meta = await espnMeta(getJson, cfg.espn ?? cfg.espnTeams);
      if (cfg.hockeytech) {
        const base = `https://lscluster.hockeytech.com/feed/index.php?feed=modulekit&${cfg.hockeytech}`;
        htSeasons = (await getJson(`${base}&view=seasons`)).SiteKit.Seasons.filter((s) => /regular/i.test(s.season_name));
        const t = await getJson(`${base}&view=teamsbyseason&season_id=${htSeasons[0].season_id}`);
        for (const x of t.SiteKit.Teamsbyseason) meta.set(plain(x.name), { id: String(x.id), abbr: x.code, color: "#444444", alt: "#bbbbbb", logo: x.team_logo_url, logoDark: x.team_logo_url });
      }
    } catch (e) { warn(`${league}: team feed failed (${e.message}), keeping previous logos`); }

    const byName = new Map();
    const byFeedId = new Map();
    const used = new Set(teams.map((t) => t.key));
    for (const t of ref.teams) {
      const old = prev?.teams?.find((p) => p.league === league && p.name === t.name);
      const fed = meta.get(plain(t.name)) ?? (old ? { id: old.espnId, abbr: old.abbr, color: old.color, alt: old.alt, logo: old.logo, logoDark: old.logoDark } : null);
      // The reference file can supply what the feed lacks: an abbreviation, colours, or a logo address.
      const given = Object.fromEntries(["abbr", "color", "alt", "logo"].filter((k) => t[k]).map((k) => [k, t[k]]));
      const m = fed || Object.keys(given).length ? { id: "none", logo: null, ...fed, ...given, ...(given.logo ? { logoDark: given.logo } : {}) } : null;
      if (!m?.logo && !given.color) warn(`${league}: no logo or colours for ${t.name}`);
      if (!metros[t.metro]) throw new Error(`${league}: unknown metro "${t.metro}" for ${t.name}`);
      let key = old?.key ?? `${league}-${m?.abbr ?? slug(t.nick ?? t.name)}`.toLowerCase();
      while (used.has(key) && key !== old?.key) key += "x";
      used.add(key);
      const eras = ref.eras?.[t.name];
      for (const e of eras ?? []) if (!metros[e[2]]) throw new Error(`${league}: unknown metro "${e[2]}" in eras for ${t.name}`);
      const team = {
        key, espnId: m?.id ?? "none", league, name: t.name, nick: t.nick ?? t.name, place: t.metro,
        abbr: m?.abbr ?? slug(t.nick ?? t.name).toUpperCase().slice(0, 3),
        color: m?.color ?? "#444444", alt: m?.alt ?? "#bbbbbb", logo: m?.logo ?? null, logoDark: m?.logoDark ?? m?.logo ?? null,
        metro: t.metro, ...(eras ? { eras } : {}),
      };
      teams.push(team);
      byName.set(t.name, team);
      if (m?.id && m.id !== "none") byFeedId.set(m.id, team);
    }

    // Folded clubs that keep their history, like the Houston Comets. The reference
    // file's standings name them "defunct:..."; here they become teams of their own.
    const folded = new Map();
    for (const t of ref.inactive ?? []) {
      const old = prev?.teams?.find((p) => p.league === league && p.name === t.name);
      if (!metros[t.metro]) throw new Error(`${league}: unknown metro "${t.metro}" for ${t.name}`);
      for (const e of t.eras ?? []) if (!metros[e[2]]) throw new Error(`${league}: unknown metro "${e[2]}" in eras for ${t.name}`);
      let key = old?.key ?? `${league}-${t.abbr}`.toLowerCase();
      while (used.has(key) && key !== old?.key) key += "x";
      used.add(key);
      const team = {
        key, espnId: "none", league, name: t.name, nick: t.nick ?? t.name, place: t.metro, abbr: t.abbr,
        color: t.color ?? "#444444", alt: t.alt ?? "#bbbbbb", logo: t.logo ?? null, logoDark: t.logo ?? null,
        metro: t.metro, ...(t.eras ? { eras: t.eras } : {}), inactive: true,
      };
      teams.push(team);
      for (const n of t.names ?? [t.name]) folded.set(n, team);
    }

    const keyOf = (name) => {
      if (name?.startsWith("defunct:")) return folded.get(name.slice(8))?.key ?? null;
      if (!name) return null;
      const t = byName.get(name);
      if (!t) warn(`${league}: reference file names "${name}", which is not in its team list`);
      return t?.key ?? null;
    };

    const champs = new Map((ref.champions ?? []).map((c) => [c.season, c]));
    const seasons = [];
    for (const [year, table] of Object.entries(ref.seasons)) {
      const y = Number(year);
      const rows = Object.entries(table).map(([name, r]) => [keyOf(name), name, r[0], r[1], r[2] ?? 0]);
      const diff = rows.reduce((a, r) => a + r[2] - r[3], 0);
      if (Math.abs(diff) > 1) warn(`${league} ${y}: reference standings do not balance (${diff})`);
      const c = champs.get(y);
      seasons.push(pack(y, rows, cfg.draws, c ? { decided: true, champ: keyOf(c.champion) ?? undefined, runnerUp: keyOf(c.runnerUp) ?? undefined } : {}));
    }
    seasons.sort((a, b) => a.y - b.y);
    const lastRef = seasons.at(-1)?.y ?? 0;

    // Anything newer than the reference file comes from the live feed and counts as in progress.
    try {
      if (cfg.espn) {
        for (let y = lastRef + 1; y <= NOW.getUTCFullYear(); y++) {
          const d = await getJson(`https://site.api.espn.com/apis/v2/sports/${cfg.espn}/standings?season=${y}`);
          const rows = [];
          for (const e of walk(d)) {
            const v = (n) => e.stats?.find((x) => x.name === n)?.value ?? 0;
            const w = v("wins"), l = v("losses"), t = v("ties");
            if (w + l + t > 0) rows.push([byFeedId.get(String(e.team.id))?.key ?? null, clean(e.team.displayName), w, l, t]);
          }
          if (rows.length >= 4 && rows.every((r) => r[0])) seasons.push(pack(y, rows, cfg.draws, { live: true }));
          else if (rows.length) warn(`${league} ${y}: live standings name clubs missing from the reference team list, season skipped`);
        }
      }
      if (cfg.hockeytech) {
        const base = `https://lscluster.hockeytech.com/feed/index.php?feed=modulekit&${cfg.hockeytech}`;
        for (const s of htSeasons) {
          const m = /(\d{4})-\d{2}/.exec(s.season_name);
          const y = m ? Number(m[1]) : Number(/\d{4}/.exec(s.season_name)[0]) - 1;
          if (y <= lastRef || new Date(s.start_date) > NOW) continue;
          const d = await getJson(`${base}&view=statviewtype&type=standings&stat=conference&season_id=${s.season_id}`);
          const rows = d.SiteKit.Statviewtype.filter((r) => r.team_id).map((r) => {
            const w = Number(r.wins), l = Number(r.losses) + Number(r.ot_losses ?? 0) + Number(r.shootout_losses ?? 0);
            return [byFeedId.get(String(r.team_id))?.key ?? null, clean(r.name), w, l, 0];
          }).filter((r) => r[2] + r[3] > 0);
          if (rows.length >= 4 && rows.every((r) => r[0])) seasons.push(pack(y, rows, false, { live: true }));
        }
      }
    } catch (e) {
      warn(`${league}: live feed failed (${e.message}), keeping previous copy of any live season`);
      for (const [y, s] of prevSeasons) if (y > lastRef && s.live) seasons.push(s);
    }
    seasons.sort((a, b) => a.y - b.y);

    if (seasons.length < prevSeasons.size) throw new Error(`${league}: would lose seasons (${prevSeasons.size} -> ${seasons.length})`);
    leagues[league] = { seasons, ...(cfg.draws ? { draws: true } : {}), ...(cfg.split ? { split: true } : {}) };
    console.log(`${league}: ${ref.teams.length} teams, ${seasons.length} seasons, ${seasons[0].y}-${seasons.at(-1).y}${seasons.at(-1).live ? " (live)" : ""}`);
  }
}
