"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { heat } from "@/lib/color";
import { seasonLabel } from "@/lib/engine";
import type { League, Result, SeasonPoint, TeamStat } from "@/lib/types";
import { HeatLegend } from "./Tape";
import { LeagueLabel, Logo, Pennant, pct, record, Segmented, signed } from "./ui";

/** Every team in a league against every season: the whole era on one sheet. */
export function Seasons({ result, picks, leagues }: { result: Result; picks: string[]; leagues: League[] }) {
  const firstLeague = (result.byKey.get(picks[0])?.team.league ?? "NFL") as League;
  const [chosen, setLeague] = useState<League>(firstLeague);
  // A league switched off in Scoring can no longer be shown; fall back to the first that can.
  const league = leagues.includes(chosen) ? chosen : leagues[0] ?? "NFL";
  const [hover, setHover] = useState<{ s: TeamStat; p: SeasonPoint } | null>(null);
  const teams = useMemo(() => result.teams.filter((s) => s.team.league === league).sort((a, b) => a.leagueRank - b.leagueRank), [result, league]);
  const span = result.span[league];
  const mine = new Set(picks);
  if (!span) return <p className="py-12 text-center text-[14px] text-ink-3">No {league} seasons in this span</p>;

  const years: number[] = [];
  for (let y = span.first; y <= span.last; y++) years.push(y);
  const cell = years.length > 70 ? 10 : years.length > 40 ? 14 : 20;
  const labelEvery = years.length > 70 ? 10 : years.length > 30 ? 5 : years.length > 12 ? 2 : 1;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<League> label="League" size="sm" value={league} onChange={(l) => { setLeague(l); setHover(null); }} options={leagues.map((l) => ({ value: l, label: <LeagueLabel league={l} /> }))} />
        <HeatLegend />
      </div>
      <p className="num mt-4 h-5 text-[13px] leading-5 text-ink-2">
        {hover ? (
          <>
            <span className="text-ink">{hover.p.as ?? hover.s.team.name}</span> · {seasonLabel(league, hover.p.y)} · {record(hover.p.w, hover.p.l, hover.p.t)} · {pct(hover.p.pct)} · {signed(hover.p.z, 1)}σ
            {hover.p.champ ? " · champions" : hover.p.runnerUp ? " · lost the final" : ""}
          </>
        ) : (
          <span className="text-ink-3">Best to worst over the span. Point at a season for its record</span>
        )}
      </p>
      <div className="scroll-quiet mt-2 overflow-x-auto pb-2" onPointerLeave={() => setHover(null)}>
        <div className="inline-block min-w-full align-top">
          <div className="flex h-6 items-end">
            <span className="sticky left-0 z-10 w-[164px] shrink-0 bg-bg sm:w-[188px]" />
            <div className="flex flex-1" style={{ gap: 2 }}>
              {years.map((y) => (
                <span key={y} className="num relative h-4 flex-1 text-[11px] leading-4 text-ink-3" style={{ minWidth: cell }}>
                  {y % labelEvery === 0 && (labelEvery === 1 || y <= span.last - 2) && <span className="absolute left-0">{years.length > 40 ? y : seasonLabel(league, y)}</span>}
                </span>
              ))}
            </div>
          </div>
          {teams.map((s) => {
            const byYear = new Map(s.series.map((p) => [p.y, p]));
            const isMine = mine.has(s.team.key);
            return (
              <div key={s.team.key} className="flex h-7 items-center">
                <span className={clsx("sticky left-0 z-10 flex h-7 w-[164px] shrink-0 items-center gap-2 bg-bg pr-2 sm:w-[188px]")}>
                  <span className="num w-5 text-right text-[12px] text-ink-3">{s.leagueRank}</span>
                  <Logo team={s.team} size={20} />
                  <span className={clsx("whitespace-nowrap text-[13px]", isMine ? "font-medium text-ink" : "text-ink-2")}>{s.team.nick}</span>
                  {isMine && <span className="size-[6px] shrink-0 rounded-full bg-accent" />}
                </span>
                <div className="flex flex-1" style={{ gap: 2 }}>
                  {years.map((y) => {
                    const p = byYear.get(y);
                    if (!p) return <span key={y} className="h-6 flex-1" style={{ minWidth: cell }} />;
                    return (
                      <span
                        key={y}
                        onPointerEnter={() => setHover({ s, p })}
                        onPointerDown={() => setHover({ s, p })}
                        className="grid h-6 flex-1 place-items-center rounded-[2px] transition-[background-color] duration-300"
                        style={{ minWidth: cell, background: heat(p.z), outline: hover?.p === p ? "1.5px solid var(--text)" : undefined }}
                      >
                        {(p.champ || p.runnerUp) && <Pennant hollow={!p.champ} size={cell > 10 ? 10 : 8} className={Math.abs(p.z) > 1.2 ? "text-white" : "text-ink"} />}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
