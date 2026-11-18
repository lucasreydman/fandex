import { describe, expect, it } from "vitest";
import raw from "../data/data.json";
import { compute, DEFAULT_WEIGHTS } from "./engine";
import { MORE } from "./types";
import type { Dataset } from "./types";

const data = raw as unknown as Dataset;
const all = compute(data, { from: 0, to: 9999, includeLive: false, weights: DEFAULT_WEIGHTS, halfLife: 0 });
const stat = (name: string) => all.teams.find((s) => s.team.name === name)!;

describe("leagues beyond the big four", () => {
  it("has data for every one, and every team has played", () => {
    for (const league of MORE) {
      expect(data.leagues[league]?.seasons.length, league).toBeGreaterThan(0);
      for (const t of data.teams.filter((x) => x.league === league)) expect(all.byKey.has(t.key), t.name).toBe(true);
    }
  });

  it("balances wins and losses in every finished season", () => {
    const off: string[] = [];
    for (const league of MORE) for (const s of data.leagues[league]!.seasons) {
      if (s.live) continue;
      // Clubs that have since folded are counted in n but not tracked, so only check seasons where everyone is.
      const rows = Object.values(s.rows);
      if (rows.length !== s.n) continue;
      const diff = rows.reduce((a, r) => a + r[0] - r[1], 0);
      if (Math.abs(diff) > 1) off.push(`${league} ${s.y}: ${diff}`);
    }
    expect(off).toEqual([]);
  });

  it("counts titles through relocations", () => {
    expect(stat("LA Galaxy").titles).toBe(6);
    expect(stat("Seattle Storm").titles).toBe(4);
    expect(stat("Dallas Wings").titles).toBe(3); // all three as the Detroit Shock
    expect(stat("Minnesota Frost").titles).toBe(2);
    expect(stat("Ottawa Red Blacks").titles).toBeGreaterThanOrEqual(6); // five as the Rough Riders, 2016 as the Redblacks
  });

  it("keeps folded clubs and credits their cities", () => {
    expect(stat("Houston Comets").titles).toBe(4);
    expect(stat("FC Kansas City").titles).toBe(2);
    const houston = all.metros.find((m) => m.name === "Houston")!;
    expect(houston.teams.some((s) => s.team.name === "Houston Comets" && !s.current)).toBe(true);
    // Kept: the Coyotes, and the folded MLS, WNBA and NWSL clubs that have a logo to show.
    expect(all.teams.filter((s) => s.team.inactive).map((s) => s.team.name).sort()).toEqual([
      "Arizona Coyotes", "Boston Breakers", "Charlotte Sting", "Chivas USA", "FC Kansas City",
      "Houston Comets", "Miami Fusion", "Sacramento Monarchs", "Tampa Bay Mutiny",
    ]);
    expect(all.teams.every((s) => s.team.logo)).toBe(true);
  });

  it("leaves out the folded clubs that are not tracked, without losing their seasons", () => {
    for (const name of ["Cleveland Barons", "Baltimore Stallions", "Las Vegas Posse", "Cleveland Rockers", "Miami Sol"]) {
      expect(all.teams.some((s) => s.team.name === name), name).toBe(false);
    }
    // The CFL's American clubs still count toward the size of the league they played in.
    const cfl = data.leagues.CFL!.seasons.find((s) => s.y === 1995)!;
    expect(cfl.n).toBe(13);
    expect(Object.keys(cfl.rows)).toHaveLength(8);
    // Baltimore won the 1995 Grey Cup, so no tracked club is credited with it.
    expect(cfl.decided).toBe(true);
    expect(cfl.champ).toBeUndefined();
  });

  it("can leave inactive franchises out of the rankings and the cities", () => {
    const active = compute(data, { from: 0, to: 9999, includeLive: false, weights: DEFAULT_WEIGHTS, halfLife: 0, excludeInactive: true });
    expect(active.teams).toHaveLength(all.teams.length - 9);
    expect(active.teams.some((s) => s.team.inactive)).toBe(false);
    expect(active.metros.some((m) => m.teams.some((s) => s.team.inactive))).toBe(false);
    // Phoenix loses the Coyotes' seasons with them.
    const coyotes = (r: typeof all) => r.metros.find((m) => m.name === "Phoenix")!.teams.some((s) => s.team.name === "Arizona Coyotes");
    expect(coyotes(all)).toBe(true);
    expect(coyotes(active)).toBe(false);
    // The scale still runs from the worst club to the best.
    expect(active.teams[0].index).toBe(100);
    expect(active.teams[active.teams.length - 1].index).toBe(0);
  });

  it("scores a draw as half a win where draws are part of the game", () => {
    const s = stat("Columbus Crew");
    const draws = s.series.reduce((a, p) => a + p.t, 0);
    expect(draws).toBeGreaterThan(100);
    expect(s.pct).toBeCloseTo((s.w + draws / 2) / (s.w + s.l + draws), 6);
  });

  it("can be switched off without touching the big four", () => {
    const core = compute(data, { from: 0, to: 9999, includeLive: false, weights: DEFAULT_WEIGHTS, halfLife: 0, leagues: ["NFL", "NBA", "MLB", "NHL"] });
    expect(core.teams.every((s) => ["NFL", "NBA", "MLB", "NHL"].includes(s.team.league))).toBe(true);
    expect(core.teams).toHaveLength(125); // 124 current clubs and the Coyotes
  });
});
