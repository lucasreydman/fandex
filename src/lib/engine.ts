import { LEAGUES } from "./types";
import type { CitySpell, Dataset, FanSummary, League, MetroStat, Options, Result, SeasonPoint, Team, TeamStat, Weights } from "./types";

export const DEFAULT_WEIGHTS: Weights = { record: 50, consistency: 30, titles: 20 };

// A season's z-scores are spread about 1.6 times narrower than the long-run
// ones, so the average is scaled up before it is weighted.
const SEASON_Z_SCALE = 1.6;

// A short track record is weaker evidence than a long one, so scores are pulled
// toward average by n / (n + PRIOR_SEASONS). Nine seasons keep 69% of their
// score, thirty keep 88%. It stops a young expansion team outranking decades of work.
const PRIOR_SEASONS = 4;

export function seasonLabel(league: League, y: number): string {
  return league === "NBA" || league === "NHL" || league === "PWHL" ? `${y}-${String((y + 1) % 100).padStart(2, "0")}` : String(y);
}

/** What the franchise was called, and where it played, in the season that started in year y. */
export function eraAt(team: Team, y: number): { name: string; metro: string } {
  if (!team.eras?.length) return { name: team.name, metro: team.metro };
  let era = team.eras[0];
  for (const e of team.eras) if (e[0] <= y) era = e;
  return { name: era[1], metro: era[2] };
}

export function bounds(data: Dataset): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const lg of LEAGUES) {
    const s = data.leagues[lg]?.seasons;
    if (!s?.length) continue;
    min = Math.min(min, s[0].y);
    max = Math.max(max, s[s.length - 1].y);
  }
  return { min, max };
}

function std(values: number[]): { mean: number; sd: number } {
  if (!values.length) return { mean: 0, sd: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return { mean, sd };
}

/** One season with the weights the scoring needs, kept private to this file. */
type Scored = SeasonPoint & { k: number; surplus: number };

interface Totals { seasons: number; w: number; l: number; t: number; pct: number; avgZ: number; titleRate: number; titles: number; finalsLost: number; elite: number; dud: number }

function total(points: Scored[], draws: boolean): Totals {
  let w = 0, l = 0, t = 0, ww = 0, wl = 0, wt = 0, zSum = 0, kSum = 0, surplus = 0, titles = 0, finalsLost = 0, elite = 0, dud = 0;
  for (const p of points) {
    w += p.w; l += p.l; t += p.t;
    ww += p.k * p.w; wl += p.k * p.l; wt += p.k * p.t;
    zSum += p.k * p.z; kSum += p.k; surplus += p.surplus;
    if (p.champ) titles++;
    if (p.runnerUp) finalsLost++;
    if (p.z >= 1) elite++;
    if (p.z <= -1) dud++;
  }
  // Where draws are part of the game they count as half a win; elsewhere the rare tie is left out.
  const pct = draws ? (ww + wt / 2) / (ww + wl + wt) : ww / (ww + wl);
  return { seasons: points.length, w, l, t, pct, avgZ: zSum / kSum, titleRate: surplus / kSum, titles, finalsLost, elite, dud };
}

export function compute(data: Dataset, opts: Options): Result {
  const wSum = opts.weights.record + opts.weights.consistency + opts.weights.titles || 1;
  const wRecord = opts.weights.record / wSum;
  const wConsistency = opts.weights.consistency / wSum;
  const wTitles = opts.weights.titles / wSum;

  const stats: TeamStat[] = [];
  const spells: CitySpell[] = [];
  const span = {} as Result["span"];

  for (const league of LEAGUES) {
    const source = data.leagues[league];
    span[league] = null;
    if (!source || (opts.leagues && !opts.leagues.includes(league))) continue;
    const draws = !!source.draws;
    const seasons = source.seasons.filter(
      (s) => s.y >= opts.from && s.y <= opts.to && (opts.includeLive || !s.live),
    );
    span[league] = seasons.length ? { first: seasons[0].y, last: seasons[seasons.length - 1].y, count: seasons.length } : null;
    if (!seasons.length) continue;
    const latest = seasons[seasons.length - 1].y;
    const weightOf = (y: number) => (opts.halfLife > 0 ? 0.5 ** ((latest - y) / opts.halfLife) : 1);

    const rows: { stat: TeamStat; points: Scored[]; totals: Totals }[] = [];
    for (const team of data.teams) {
      if (team.league !== league || (opts.excludeInactive && team.inactive)) continue;
      const points: Scored[] = [];
      for (const s of seasons) {
        const row = s.rows[team.key];
        if (!row) continue;
        const games = row[0] + row[1] + (draws ? row[2] ?? 0 : 0);
        if (!games) continue;
        const pct = (row[0] + (draws ? (row[2] ?? 0) / 2 : 0)) / games;
        const k = weightOf(s.y);
        const champ = s.champ === team.key || !!s.also?.some((a) => a.champ === team.key);
        const runnerUp = s.runnerUp === team.key || !!s.also?.some((a) => a.runnerUp === team.key);
        const era = eraAt(team, s.y);
        // Titles against what an average club would expect that year. The AFL years
        // of 1960-65 had two championships on offer; a live season has none yet.
        const available = 1 + (s.also?.length ?? 0);
        points.push({
          y: s.y, w: row[0], l: row[1], t: row[2] ?? 0, pct,
          z: s.sd > 0 ? (pct - 0.5) / s.sd : 0,
          champ, runnerUp, live: !!s.live,
          as: era.name !== team.name ? era.name : undefined,
          metro: era.metro,
          k, surplus: s.decided ? k * ((champ ? 1 : 0) - available / s.n) : 0,
        });
      }
      if (!points.length) continue;
      const totals = total(points, draws);
      rows.push({
        totals, points,
        stat: {
          team, seasons: totals.seasons, w: totals.w, l: totals.l, t: totals.t, pct: totals.pct, z: 0, avgZ: totals.avgZ,
          elite: totals.elite, dud: totals.dud, titles: totals.titles, finalsLost: totals.finalsLost,
          titleZ: 0, composite: 0, index: 0, rank: 0, leagueRank: 0, series: points,
        },
      });
    }

    // How spread out this league is over the span: RMS distance of franchise records from .500.
    const leagueSd = Math.sqrt(rows.reduce((a, r) => a + (r.totals.pct - 0.5) ** 2, 0) / rows.length);
    const title = std(rows.map((r) => r.totals.titleRate));
    const score = (t: Totals) => {
      const z = leagueSd > 0 ? (t.pct - 0.5) / leagueSd : 0;
      const titleZ = title.sd > 0 ? (t.titleRate - title.mean) / title.sd : 0;
      const blend = wRecord * z + wConsistency * t.avgZ * SEASON_Z_SCALE + wTitles * titleZ;
      return { z, titleZ, composite: blend * (t.seasons / (t.seasons + PRIOR_SEASONS)) };
    };

    for (const r of rows) {
      Object.assign(r.stat, score(r.totals));
      // A franchise's seasons count toward the city it was playing in at the time.
      const byMetro = new Map<string, Scored[]>();
      for (const p of r.points) {
        const g = byMetro.get(p.metro);
        if (g) g.push(p); else byMetro.set(p.metro, [p]);
      }
      const home = eraAt(r.stat.team, r.points[r.points.length - 1].y).metro;
      for (const [metro, points] of byMetro) {
        const t = byMetro.size === 1 ? r.totals : total(points, draws);
        const last = points[points.length - 1];
        spells.push({
          team: r.stat.team, stat: r.stat, metro,
          name: last.as ?? r.stat.team.name,
          first: points[0].y, last: last.y,
          seasons: t.seasons, w: t.w, l: t.l, pct: t.pct, titles: t.titles, finalsLost: t.finalsLost,
          composite: score(t).composite, index: 0,
          current: metro === home && metro === r.stat.team.metro && !r.stat.team.inactive,
        });
      }
    }
    rows.map((r) => r.stat).sort((a, b) => b.composite - a.composite).forEach((s, i) => (s.leagueRank = i + 1));
    stats.push(...rows.map((r) => r.stat));
  }

  stats.sort((a, b) => b.composite - a.composite);
  const max = stats.length ? stats[0].composite : 1;
  const min = stats.length ? stats[stats.length - 1].composite : 0;
  const toIndex = (c: number) => (max > min ? ((c - min) / (max - min)) * 100 : 50);
  stats.forEach((s, i) => { s.rank = i + 1; s.index = toIndex(s.composite); });

  const groups = new Map<string, CitySpell[]>();
  for (const s of spells) {
    // A short stay can score outside the range set by whole franchises, so keep it on the scale.
    s.index = Math.max(0, Math.min(100, toIndex(s.composite)));
    const g = groups.get(s.metro);
    if (g) g.push(s); else groups.set(s.metro, [s]);
  }
  const metros: MetroStat[] = [...groups].map(([name, teams]) => {
    // Weighted by seasons, so a two-year stopover doesn't count like a sixty-year stay.
    const n = teams.reduce((a, s) => a + s.seasons, 0);
    const composite = teams.reduce((a, s) => a + s.composite * s.seasons, 0) / n;
    const w = teams.reduce((a, s) => a + s.w, 0);
    const l = teams.reduce((a, s) => a + s.l, 0);
    const m = data.metros[name];
    teams.sort((a, b) => Number(b.current) - Number(a.current) || b.composite - a.composite);
    return {
      name, lat: m.lat, lon: m.lon, region: m.region, teams, composite, index: Math.max(0, Math.min(100, toIndex(composite))),
      pct: w / (w + l), titles: teams.reduce((a, s) => a + s.titles, 0),
      finalsLost: teams.reduce((a, s) => a + s.finalsLost, 0), rank: 0,
    };
  });
  metros.sort((a, b) => b.composite - a.composite).forEach((m, i) => (m.rank = i + 1));

  return { teams: stats, byKey: new Map(stats.map((s) => [s.team.key, s])), metros, min, max, span };
}

export function summarize(result: Result, picks: string[]): FanSummary | null {
  const chosen = picks.map((k) => result.byKey.get(k)).filter((s): s is TeamStat => !!s);
  if (!chosen.length) return null;
  const composite = chosen.reduce((a, s) => a + s.composite, 0) / chosen.length;
  const raw = result.max > result.min ? ((composite - result.min) / (result.max - result.min)) * 100 : 50;
  const index = Math.max(0, Math.min(100, raw));
  const w = chosen.reduce((a, s) => a + s.w, 0);
  const l = chosen.reduce((a, s) => a + s.l, 0);

  // The year your teams were collectively at their best and worst, weighted so each team counts the same.
  const byYear = new Map<number, { z: number; n: number }>();
  for (const s of chosen) for (const p of s.series) {
    const e = byYear.get(p.y) ?? { z: 0, n: 0 };
    e.z += p.z; e.n++; byYear.set(p.y, e);
  }
  let bestYear: FanSummary["bestYear"] = null;
  let worstYear: FanSummary["worstYear"] = null;
  // Only years when every team that could play did, so one hot team in a lone season doesn't win.
  const full = Math.max(0, ...[...byYear.values()].map((e) => e.n));
  for (const [y, e] of byYear) {
    if (e.n < full) continue;
    const z = e.z / e.n;
    if (!bestYear || z > bestYear.z) bestYear = { y, z };
    if (!worstYear || z < worstYear.z) worstYear = { y, z };
  }

  let twin: FanSummary["twin"] = null;
  for (const m of result.metros) if (!twin || Math.abs(m.index - index) < Math.abs(twin.index - index)) twin = m;

  return {
    picks: chosen, composite, index,
    titles: chosen.reduce((a, s) => a + s.titles, 0),
    finalsLost: chosen.reduce((a, s) => a + s.finalsLost, 0),
    elite: chosen.reduce((a, s) => a + s.elite, 0),
    dud: chosen.reduce((a, s) => a + s.dud, 0),
    seasons: chosen.reduce((a, s) => a + s.seasons, 0),
    pct: w / (w + l),
    happier: result.metros.filter((m) => Math.round(m.index) > Math.round(index)).length,
    sadder: result.metros.filter((m) => Math.round(m.index) < Math.round(index)).length,
    twin, bestYear, worstYear,
  };
}

/** The fan's index for every possible starting year, for the "what if you were born in" curve. */
export function curve(data: Dataset, opts: Options, picks: string[], minYear: number, maxYear: number): { y: number; index: number }[] {
  const out: { y: number; index: number }[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    const fan = summarize(compute(data, { ...opts, from: y }), picks);
    if (fan) out.push({ y, index: fan.index });
  }
  return out;
}

export const VERDICTS: { min: number; title: string; line: string }[] = [
  { min: 85, title: "Spoiled rotten", line: "You have never known real suffering" },
  { min: 70, title: "Charmed life", line: "Multiple parades, few lost decades" },
  { min: 55, title: "Pretty good", line: "More good years than bad" },
  { min: 45, title: "Perfectly average", line: "The median fan experience, give or take a wild card exit" },
  { min: 30, title: "Rough", line: "You know the lottery odds by heart" },
  { min: 15, title: "Suffering", line: "Hope is a renewable resource, apparently" },
  { min: -Infinity, title: "Condolences", line: "Please seek support" },
];

export function verdict(index: number) {
  return VERDICTS.find((v) => Math.round(index) >= v.min) ?? VERDICTS[VERDICTS.length - 1];
}
