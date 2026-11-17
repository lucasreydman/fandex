import { describe, expect, it } from "vitest";
import raw from "../data/data.json";
import sheet from "./__fixtures__/sheet-2005.json";
import { compute, DEFAULT_WEIGHTS, summarize } from "./engine";
import { CORE } from "./types";
import type { Dataset } from "./types";

const full = raw as unknown as Dataset;
// Freeze the dataset where the sheet stopped, so later seasons never disturb the comparison.
const LAST = { NFL: 2025, MLB: 2026, NBA: 2025, NHL: 2025 } as const;
const data: Dataset = {
  ...full,
  leagues: Object.fromEntries(
    CORE.map((lg) => [lg, { seasons: full.leagues[lg]!.seasons.filter((s) => s.y <= LAST[lg as keyof typeof LAST]) }]),
  ) as Dataset["leagues"],
};

// The original spreadsheet covered the 2005 seasons through autumn 2026:
// NFL to 2025, MLB to 2026, NBA and NHL to 2025-26.
const result = compute(data, { from: 2005, to: 2026, includeLive: true, weights: DEFAULT_WEIGHTS, halfLife: 0, leagues: CORE });
const byName = new Map(result.teams.map((s) => [s.team.name, s]));
const rows = Object.entries(sheet.teams) as [string, (typeof sheet.teams)[keyof typeof sheet.teams]][];

// The NHL API is the source for hockey here; the sheet used ESPN, whose
// 2014-15 and 2020-21 hockey seasons are wrong. Those teams are compared loosely.
const loose = (league: string) => league === "NHL";
// The sheet gave Utah the Coyotes' seasons. Officially Utah is a new club, so its record here is its own.
const skip = (name: string) => name === "Utah Mammoth";

describe("engine against the original spreadsheet", () => {
  it("covers all 124 franchises", () => {
    // The sheet's 124 clubs, plus the Coyotes, who the sheet folded into Utah.
    expect(result.teams).toHaveLength(125);
    for (const [name] of rows) expect(byName.has(name), name).toBe(true);
  });

  it("matches wins, losses and titles", () => {
    const off: string[] = [];
    for (const [name, r] of rows) {
      const s = byName.get(name)!;
      // The 2026 World Series was played after the sheet was pulled.
      const titles = name === "Milwaukee Brewers" ? r.titles + 1 : r.titles;
      if (s.titles !== titles) off.push(`${name} titles ${s.titles} vs ${titles}`);
      if (loose(r.league)) continue;
      if (s.w !== r.w || s.l !== r.l) off.push(`${name} ${s.w}-${s.l} vs ${r.w}-${r.l}`);
      if (s.seasons !== r.seasons) off.push(`${name} seasons ${s.seasons} vs ${r.seasons}`);
    }
    expect(off).toEqual([]);
  });

  it("matches the z-scores and season counts", () => {
    const off: string[] = [];
    for (const [name, r] of rows) {
      if (loose(r.league)) continue;
      const s = byName.get(name)!;
      if (Math.abs(s.z - r.z) > 0.01) off.push(`${name} z ${s.z.toFixed(3)} vs ${r.z.toFixed(3)}`);
      if (Math.abs(s.avgZ - r.avgZ) > 0.01) off.push(`${name} avgZ ${s.avgZ.toFixed(3)} vs ${r.avgZ}`);
      if (s.elite !== r.elite || s.dud !== r.dud) off.push(`${name} elite/dud ${s.elite}/${s.dud} vs ${r.elite}/${r.dud}`);
    }
    expect(off).toEqual([]);
  });

  it("keeps hockey close to the sheet despite the source change", () => {
    for (const [name, r] of rows) {
      if (!loose(r.league) || skip(name)) continue;
      expect(Math.abs(byName.get(name)!.pct - r.pct), name).toBeLessThan(0.012);
    }
  });

  it("puts a fan on the same 0 to 100 scale as the teams", () => {
    const fan = summarize(result, ["nba-phx"])!;
    expect(fan.index).toBeGreaterThan(30);
    expect(fan.index).toBeLessThan(60);
    expect(fan.happier + fan.sadder).toBeLessThanOrEqual(result.metros.length);
  });
});
