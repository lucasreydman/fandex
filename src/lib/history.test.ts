import { describe, expect, it } from "vitest";
import raw from "../data/data.json";
import { compute, DEFAULT_WEIGHTS, eraAt } from "./engine";
import { CORE } from "./types";
import type { Dataset, League } from "./types";

const data = raw as unknown as Dataset;
const all = compute(data, { from: 0, to: 9999, includeLive: false, weights: DEFAULT_WEIGHTS, halfLife: 0, leagues: CORE });
const team = (name: string) => {
  const t = data.teams.find((x) => x.name === name);
  if (!t) throw new Error(`no team ${name}`);
  return t;
};
const years = (name: string) => {
  const t = team(name);
  return data.leagues[t.league]!.seasons.filter((s) => s.rows[t.key]).map((s) => s.y);
};
const stat = (name: string) => all.byKey.get(team(name).key)!;

// First season in the league (by the year it started), following official
// lineage. NFL data starts in 1922, so the three older clubs start there.
const FIRST: Partial<Record<League, Record<string, number>>> = {
  NFL: {
    "Arizona Cardinals": 1922, "Chicago Bears": 1922, "Green Bay Packers": 1922, "New York Giants": 1925, "Detroit Lions": 1930,
    "Washington Commanders": 1932, "Philadelphia Eagles": 1933, "Pittsburgh Steelers": 1933, "Los Angeles Rams": 1937,
    "Cleveland Browns": 1950, "San Francisco 49ers": 1950, "Indianapolis Colts": 1953, "Dallas Cowboys": 1960, "Buffalo Bills": 1960,
    "Denver Broncos": 1960, "Kansas City Chiefs": 1960, "Las Vegas Raiders": 1960, "Los Angeles Chargers": 1960, "New England Patriots": 1960,
    "New York Jets": 1960, "Tennessee Titans": 1960, "Minnesota Vikings": 1961, "Atlanta Falcons": 1966, "Miami Dolphins": 1966,
    "New Orleans Saints": 1967, "Cincinnati Bengals": 1968, "Seattle Seahawks": 1976, "Tampa Bay Buccaneers": 1976,
    "Carolina Panthers": 1995, "Jacksonville Jaguars": 1995, "Baltimore Ravens": 1996, "Houston Texans": 2002,
  },
  NBA: {
    "Boston Celtics": 1946, "New York Knicks": 1946, "Golden State Warriors": 1946, "Los Angeles Lakers": 1948, "Sacramento Kings": 1948,
    "Detroit Pistons": 1948, "Atlanta Hawks": 1949, "Philadelphia 76ers": 1949, "Washington Wizards": 1961, "Chicago Bulls": 1966,
    "Houston Rockets": 1967, "Oklahoma City Thunder": 1967, "Milwaukee Bucks": 1968, "Phoenix Suns": 1968, "Cleveland Cavaliers": 1970,
    "Portland Trail Blazers": 1970, "LA Clippers": 1970, "Utah Jazz": 1974, "Brooklyn Nets": 1976, "Denver Nuggets": 1976,
    "Indiana Pacers": 1976, "San Antonio Spurs": 1976, "Dallas Mavericks": 1980, "Miami Heat": 1988, "Charlotte Hornets": 1988,
    "Orlando Magic": 1989, "Minnesota Timberwolves": 1989, "Toronto Raptors": 1995, "Memphis Grizzlies": 1995, "New Orleans Pelicans": 2002,
  },
  MLB: {
    "Athletics": 1903, "Atlanta Braves": 1903, "Baltimore Orioles": 1903, "Boston Red Sox": 1903, "Chicago Cubs": 1903, "Chicago White Sox": 1903,
    "Cincinnati Reds": 1903, "Cleveland Guardians": 1903, "Detroit Tigers": 1903, "Los Angeles Dodgers": 1903, "Minnesota Twins": 1903,
    "New York Yankees": 1903, "Philadelphia Phillies": 1903, "Pittsburgh Pirates": 1903, "San Francisco Giants": 1903, "St. Louis Cardinals": 1903,
    "Los Angeles Angels": 1961, "Texas Rangers": 1961, "Houston Astros": 1962, "New York Mets": 1962, "Kansas City Royals": 1969,
    "Milwaukee Brewers": 1969, "San Diego Padres": 1969, "Washington Nationals": 1969, "Seattle Mariners": 1977, "Toronto Blue Jays": 1977,
    "Colorado Rockies": 1993, "Miami Marlins": 1993, "Arizona Diamondbacks": 1998, "Tampa Bay Rays": 1998,
  },
  NHL: {
    "Montreal Canadiens": 1917, "Toronto Maple Leafs": 1917, "Boston Bruins": 1924, "New York Rangers": 1926, "Chicago Blackhawks": 1926,
    "Detroit Red Wings": 1926, "Dallas Stars": 1967, "Los Angeles Kings": 1967, "Philadelphia Flyers": 1967, "Pittsburgh Penguins": 1967,
    "St. Louis Blues": 1967, "Buffalo Sabres": 1970, "Vancouver Canucks": 1970, "Calgary Flames": 1972, "New York Islanders": 1972,
    "New Jersey Devils": 1974, "Washington Capitals": 1974, "Carolina Hurricanes": 1979, "Colorado Avalanche": 1979, "Edmonton Oilers": 1979,
    "Winnipeg Jets": 1979, "San Jose Sharks": 1991, "Ottawa Senators": 1992, "Tampa Bay Lightning": 1992, "Anaheim Ducks": 1993,
    "Florida Panthers": 1993, "Arizona Coyotes": 1996, "Nashville Predators": 1998, "Columbus Blue Jackets": 2000, "Minnesota Wild": 2000,
    "Vegas Golden Knights": 2017, "Seattle Kraken": 2021, "Utah Mammoth": 2024,
  },
};

// Seasons a franchise sat out while its league played on.
const GAPS: Record<string, number[]> = {
  "Los Angeles Rams": [1943], // suspended for the war
  "Cleveland Browns": [1996, 1997, 1998], // between the move to Baltimore and the return
  "Charlotte Hornets": [2002, 2003], // between the move to New Orleans and the Bobcats
  "Winnipeg Jets": [1996, 1997, 1998], // between the first Jets leaving and the Thrashers starting
};

describe("franchise histories", () => {
  it("has every franchise, with no one missing or extra", () => {
    for (const league of Object.keys(FIRST) as League[]) {
      const have = data.teams.filter((t) => t.league === league).map((t) => t.name).sort();
      expect(have, league).toEqual(Object.keys(FIRST[league]!).sort());
    }
  });

  it("starts each franchise in the right season and plays every season since", () => {
    const off: string[] = [];
    for (const league of Object.keys(FIRST) as League[]) {
      const played = data.leagues[league]!.seasons.map((s) => s.y);
      for (const [name, first] of Object.entries(FIRST[league]!)) {
        const ys = years(name);
        if (ys[0] !== first) off.push(`${name} starts ${ys[0]}, expected ${first}`);
        const end = team(name).inactive ? ys[ys.length - 1] : played[played.length - 1];
        const missing = played.filter((y) => y >= first && y <= end && !ys.includes(y));
        if (missing.join() !== (GAPS[name] ?? []).join()) off.push(`${name} missing ${missing.join(",") || "none"}, expected ${(GAPS[name] ?? []).join(",") || "none"}`);
      }
    }
    expect(off).toEqual([]);
  });

  it("balances wins and losses in every season since 1950", () => {
    // Uses the season's full field, which includes clubs that no longer exist, so check the modern era where all clubs are tracked.
    const off: string[] = [];
    for (const league of Object.keys(FIRST) as League[]) {
      for (const s of data.leagues[league]!.seasons) {
        if (s.y < 1980 || s.live) continue;
        const rows = Object.values(s.rows);
        const diff = rows.reduce((a, r) => a + r[0] - r[1], 0);
        if (Math.abs(diff) > 2) off.push(`${league} ${s.y}: ${diff}`);
        if (rows.length !== s.n) off.push(`${league} ${s.y}: ${rows.length} tracked of ${s.n}`);
      }
    }
    expect(off).toEqual([]);
  });

  it("follows official lineage through moves and renames", () => {
    expect(eraAt(team("Oklahoma City Thunder"), 1978)).toEqual({ name: "Seattle SuperSonics", metro: "Seattle" });
    expect(eraAt(team("Los Angeles Dodgers"), 1955)).toEqual({ name: "Brooklyn Dodgers", metro: "New York" });
    expect(eraAt(team("Las Vegas Raiders"), 1985).metro).toBe("Los Angeles");
    expect(eraAt(team("Las Vegas Raiders"), 2000).metro).toBe("SF Bay Area");
    expect(eraAt(team("Washington Nationals"), 1994).name).toBe("Montreal Expos");
    // The NBA gave the original Hornets' seasons to today's Hornets; the Pelicans begin in New Orleans.
    expect(years("Charlotte Hornets")).toContain(1995);
    expect(years("New Orleans Pelicans")[0]).toBe(2002);
    // The NHL left the Coyotes' record in Arizona and made Utah a new club.
    expect(years("Arizona Coyotes").at(-1)).toBe(2023);
    expect(years("Utah Mammoth")[0]).toBe(2024);
  });

  it("credits the wartime merged teams to both clubs", () => {
    const row = (name: string, y: number) => data.leagues.NFL!.seasons.find((s) => s.y === y)!.rows[team(name).key];
    expect(row("Philadelphia Eagles", 1943)).toEqual([5, 4, 1]);
    expect(row("Pittsburgh Steelers", 1943)).toEqual([5, 4, 1]);
    expect(row("Pittsburgh Steelers", 1944)).toEqual([0, 10]);
    expect(row("Arizona Cardinals", 1944)).toEqual([0, 10]);
  });

  it("counts championships the way the record books do", () => {
    expect(stat("New York Yankees").titles).toBe(27);
    expect(stat("Boston Celtics").titles).toBe(18);
    expect(stat("Los Angeles Lakers").titles).toBe(17);
    expect(stat("Montreal Canadiens").titles).toBe(23); // NHL era only
    expect(stat("Green Bay Packers").titles).toBe(13);
    expect(stat("Buffalo Bills").titles).toBe(2); // AFL 1964 and 1965
    expect(stat("Tennessee Titans").titles).toBe(2); // AFL 1960 and 1961 as the Oilers
    expect(stat("Oklahoma City Thunder").titles).toBe(2); // 1979 as Seattle, 2025
  });

  it("scores a city on the seasons played there", () => {
    const seattle = all.metros.find((m) => m.name === "Seattle")!;
    const sonics = seattle.teams.find((s) => s.name === "Seattle SuperSonics")!;
    expect([sonics.first, sonics.last, sonics.titles, sonics.current]).toEqual([1967, 2007, 1, false]);
    const okc = all.metros.find((m) => m.name === "Oklahoma City")!;
    expect(okc.teams[0].first).toBe(2008);
    expect(okc.titles).toBe(1);
    expect(all.metros.find((m) => m.name === "Hartford")!.teams[0].name).toBe("Hartford Whalers");
    const phoenix = all.metros.find((m) => m.name === "Phoenix")!;
    expect(phoenix.teams.some((s) => s.team.name === "Arizona Coyotes" && !s.current)).toBe(true);
  });
});
