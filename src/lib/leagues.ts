import type { League } from "./types";

const espn = (name: string) => ({
  light: `https://a.espncdn.com/i/teamlogos/leagues/500/${name}.png`,
  dark: `https://a.espncdn.com/i/teamlogos/leagues/500-dark/${name}.png`,
});
const soccer = (id: number) => ({
  light: `https://a.espncdn.com/i/leaguelogos/soccer/500/${id}.png`,
  dark: `https://a.espncdn.com/i/leaguelogos/soccer/500-dark/${id}.png`,
});

const one = (url: string) => ({ light: url, dark: url });

/**
 * League marks. The big four, WNBA, MLS and NWSL come from ESPN in light and dark
 * versions; the CFL and PWHL, which ESPN does not carry, from TheSportsDB.
 */
export const LEAGUE_MARK: Partial<Record<League, { light: string; dark: string; white?: boolean }>> = {
  NFL: espn("nfl"),
  NBA: espn("nba"),
  MLB: espn("mlb"),
  NHL: espn("nhl"),
  WNBA: espn("wnba"),
  MLS: soccer(19),
  NWSL: soccer(2323),
  // Published only as white artwork, so it is drawn in ink on light surfaces.
  PWHL: { ...one("https://r2.thesportsdb.com/images/media/league/badge/lcyvdm1784269511.png/small"), white: true },
  CFL: one("https://r2.thesportsdb.com/images/media/league/badge/ffypv51488739128.png/small"),
};
