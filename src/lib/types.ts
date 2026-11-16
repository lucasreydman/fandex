export type League = "NFL" | "NBA" | "MLB" | "NHL";
export const LEAGUES: League[] = ["NFL", "NBA", "MLB", "NHL"];

export interface Team {
  key: string;
  league: League;
  name: string;
  nick: string;
  place: string;
  abbr: string;
  color: string;
  alt: string;
  logo: string;
  logoDark: string;
  /** Where the franchise plays now. */
  metro: string;
  /** [first season, name then, metro then], oldest first. Present only for franchises that moved or were renamed. */
  eras?: [number, string, string][];
  /** A franchise that no longer plays but keeps its history, like the Arizona Coyotes. */
  inactive?: boolean;
}

export interface Season {
  /** Year the season started. */
  y: number;
  /** Clubs that played that season, including ones that no longer exist. */
  n: number;
  /** Spread of that season's records: RMS distance from .500. */
  sd: number;
  live?: boolean;
  decided?: boolean;
  champ?: string;
  runnerUp?: string;
  /** A second championship decided that season: the AFL title games of 1960-65. */
  also?: { champ?: string; runnerUp?: string }[];
  rows: Record<string, [number, number] | [number, number, number]>;
}

export interface Dataset {
  generatedAt: string;
  warnings: string[];
  teams: Team[];
  metros: Record<string, { lat: number; lon: number; region: string }>;
  leagues: Record<League, { seasons: Season[] }>;
}

export interface Weights {
  /** Overall record across the whole span. */
  record: number;
  /** How good the typical season was. */
  consistency: number;
  /** Championships, against what an average club would have won. */
  titles: number;
}

export interface Options {
  from: number;
  to: number;
  includeLive: boolean;
  weights: Weights;
  /** Half-life in seasons for weighting recent years more. 0 turns it off. */
  halfLife: number;
}

export interface SeasonPoint {
  y: number;
  w: number;
  l: number;
  t: number;
  pct: number;
  z: number;
  champ: boolean;
  runnerUp: boolean;
  live: boolean;
  /** The franchise's name that season, when it was not today's name. */
  as?: string;
  /** The metro area it played in that season. */
  metro: string;
}

export interface TeamStat {
  team: Team;
  seasons: number;
  w: number;
  l: number;
  t: number;
  pct: number;
  z: number;
  avgZ: number;
  elite: number;
  dud: number;
  titles: number;
  finalsLost: number;
  titleZ: number;
  composite: number;
  index: number;
  rank: number;
  leagueRank: number;
  series: SeasonPoint[];
}

/** A franchise's time in one city: the Sonics' Seattle years, the Raiders' two stays in Oakland. */
export interface CitySpell {
  team: Team;
  stat: TeamStat;
  metro: string;
  /** What the club was called when it last played there. */
  name: string;
  first: number;
  last: number;
  seasons: number;
  w: number;
  l: number;
  pct: number;
  titles: number;
  finalsLost: number;
  composite: number;
  index: number;
  /** Still playing there today. */
  current: boolean;
}

export interface MetroStat {
  name: string;
  lat: number;
  lon: number;
  region: string;
  teams: CitySpell[];
  composite: number;
  index: number;
  pct: number;
  titles: number;
  finalsLost: number;
  rank: number;
}

export interface Result {
  teams: TeamStat[];
  byKey: Map<string, TeamStat>;
  metros: MetroStat[];
  min: number;
  max: number;
  span: Record<League, { first: number; last: number; count: number } | null>;
}

export interface FanSummary {
  picks: TeamStat[];
  composite: number;
  index: number;
  titles: number;
  finalsLost: number;
  elite: number;
  dud: number;
  seasons: number;
  pct: number;
  happier: number;
  sadder: number;
  twin: MetroStat | null;
  bestYear: { y: number; z: number } | null;
  worstYear: { y: number; z: number } | null;
}
