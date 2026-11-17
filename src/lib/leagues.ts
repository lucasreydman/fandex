import type { League } from "./types";

const espn = (name: string) => ({
  light: `https://a.espncdn.com/i/teamlogos/leagues/500/${name}.png`,
  dark: `https://a.espncdn.com/i/teamlogos/leagues/500-dark/${name}.png`,
});
const soccer = (id: number) => ({
  light: `https://a.espncdn.com/i/leaguelogos/soccer/500/${id}.png`,
  dark: `https://a.espncdn.com/i/leaguelogos/soccer/500-dark/${id}.png`,
});

/**
 * League marks, where a usable one is published. The PWHL's mark is its own
 * name set in type and the CFL has none in any public feed, so those two stay as text.
 */
export const LEAGUE_MARK: Partial<Record<League, { light: string; dark: string }>> = {
  NFL: espn("nfl"),
  NBA: espn("nba"),
  MLB: espn("mlb"),
  NHL: espn("nhl"),
  WNBA: espn("wnba"),
  MLS: soccer(19),
  NWSL: soccer(2323),
};
