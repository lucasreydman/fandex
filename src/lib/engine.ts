import { LEAGUES } from "./types";
import type { Dataset, FanSummary, League, MetroStat, Options, Result, SeasonPoint, TeamStat, Weights } from "./types";

export const DEFAULT_WEIGHTS: Weights = { record: 50, consistency: 30, titles: 20 };

// A season's z-scores are spread about 1.6 times narrower than the long-run
// ones, so the average is scaled up before it is weighted.
const SEASON_Z_SCALE = 1.6;

// A short track record is weaker evidence than a long one, so scores are pulled
// toward average by n / (n + PRIOR_SEASONS). Nine seasons keep 69% of their
// score, thirty keep 88%. It stops a young expansion team outranking decades of work.
const PRIOR_SEASONS = 4;

export function seasonLabel(league: League, y: number): string {
  return league === "NBA" || league === "NHL" ? `${y}-${String((y + 1) % 100).padStart(2, "0")}` : String(y);
}

export function bounds(data: Dataset): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const lg of LEAGUES) {
    const s = data.leagues[lg].seasons;
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

export function compute(data: Dataset, opts: Options): Result {
  const wSum = opts.weights.record + opts.weights.consistency + opts.weights.titles || 1;
  const wRecord = opts.weights.record / wSum;
  const wConsistency = opts.weights.consistency / wSum;
  const wTitles = opts.weights.titles / wSum;

  const stats: TeamStat[] = [];
  const span = {} as Result["span"];

  for (const league of LEAGUES) {
    const seasons = data.leagues[league].seasons.filter(
      (s) => s.y >= opts.from && s.y <= opts.to && (opts.includeLive || !s.live),
    );
    span[league] = seasons.length ? { first: seasons[0].y, last: seasons[seasons.length - 1].y, count: seasons.length } : null;
    if (!seasons.length) continue;
    const latest = seasons[seasons.length - 1].y;
    const weightOf = (y: number) => (opts.halfLife > 0 ? 0.5 ** ((latest - y) / opts.halfLife) : 1);

    const leagueStats: (TeamStat & { titleRate: number })[] = [];
    for (const team of data.teams) {
      if (team.league !== league) continue;
      const series: SeasonPoint[] = [];
      let w = 0, l = 0, t = 0, ww = 0, wl = 0, zSum = 0, kSum = 0, elite = 0, dud = 0, titles = 0, finalsLost = 0, surplus = 0;
      for (const s of seasons) {
        const row = s.rows[team.key];
        if (!row) continue;
        const games = row[0] + row[1];
        if (!games) continue;
        const pct = row[0] / games;
        const z = s.sd > 0 ? (pct - 0.5) / s.sd : 0;
        const k = weightOf(s.y);
        const champ = s.champ === team.key;
        const runnerUp = s.runnerUp === team.key;
        w += row[0]; l += row[1]; t += row[2] ?? 0;
        ww += k * row[0]; wl += k * row[1];
        zSum += k * z; kSum += k;
        if (z >= 1) elite++;
        if (z <= -1) dud++;
        if (champ) titles++;
        if (runnerUp) finalsLost++;
        // Titles against what an average club would expect that year: 1 in n.
        // A live season has no champion yet, so it adds nothing either way.
        if (s.decided) surplus += k * ((champ ? 1 : 0) - 1 / s.n);
        series.push({ y: s.y, w: row[0], l: row[1], t: row[2] ?? 0, pct, z, champ, runnerUp, live: !!s.live });
      }
      if (!series.length) continue;
      leagueStats.push({
        team, seasons: series.length, w, l, t,
        pct: ww / (ww + wl), z: 0, avgZ: zSum / kSum, elite, dud, titles, finalsLost,
        titleZ: 0, titleRate: surplus / kSum, composite: 0, index: 0, rank: 0, leagueRank: 0, series,
      });
    }

    // How spread out this league is over the span: RMS distance of franchise records from .500.
    const leagueSd = Math.sqrt(leagueStats.reduce((a, s) => a + (s.pct - 0.5) ** 2, 0) / leagueStats.length);
    const title = std(leagueStats.map((s) => s.titleRate));
    for (const s of leagueStats) {
      s.z = leagueSd > 0 ? (s.pct - 0.5) / leagueSd : 0;
      s.titleZ = title.sd > 0 ? (s.titleRate - title.mean) / title.sd : 0;
      const blend = wRecord * s.z + wConsistency * s.avgZ * SEASON_Z_SCALE + wTitles * s.titleZ;
      s.composite = blend * (s.seasons / (s.seasons + PRIOR_SEASONS));
    }
    leagueStats.sort((a, b) => b.composite - a.composite).forEach((s, i) => (s.leagueRank = i + 1));
    stats.push(...leagueStats);
  }

  stats.sort((a, b) => b.composite - a.composite);
  const max = stats.length ? stats[0].composite : 1;
  const min = stats.length ? stats[stats.length - 1].composite : 0;
  const toIndex = (c: number) => (max > min ? ((c - min) / (max - min)) * 100 : 50);
  stats.forEach((s, i) => { s.rank = i + 1; s.index = toIndex(s.composite); });

  const groups = new Map<string, TeamStat[]>();
  for (const s of stats) {
    const g = groups.get(s.team.metro);
    if (g) g.push(s); else groups.set(s.team.metro, [s]);
  }
  const metros: MetroStat[] = [...groups].map(([name, teams]) => {
    const composite = teams.reduce((a, s) => a + s.composite, 0) / teams.length;
    const w = teams.reduce((a, s) => a + s.w, 0);
    const l = teams.reduce((a, s) => a + s.l, 0);
    const m = data.metros[name];
    return {
      name, lat: m.lat, lon: m.lon, region: m.region, teams, composite, index: toIndex(composite),
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
