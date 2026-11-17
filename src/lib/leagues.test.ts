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
    expect(stat("Baltimore Stallions").titles).toBe(1);
    const houston = all.metros.find((m) => m.name === "Houston")!;
    expect(houston.teams.some((s) => s.team.name === "Houston Comets" && !s.current)).toBe(true);
    // Sacramento and San Antonio were one CFL franchise that moved.
    expect(stat("San Antonio Texans").series.map((p) => p.y)).toEqual([1993, 1994, 1995]);
    expect(all.teams.filter((s) => s.team.inactive).length).toBe(19);
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
    expect(core.teams).toHaveLength(126); // 124 current clubs, the Coyotes and the Seals/Barons
  });
});
