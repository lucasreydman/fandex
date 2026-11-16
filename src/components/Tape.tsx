"use client";

import clsx from "clsx";
import { useState } from "react";
import { heat } from "@/lib/color";
import { seasonLabel } from "@/lib/engine";
import type { League, SeasonPoint } from "@/lib/types";
import { Pennant, pct, record, signed } from "./ui";

/**
 * The season tape: one cell per season, cold blue for bad years through hot red
 * for great ones, a pennant over every title. Columns line up across teams when
 * they share the same first and last year.
 */
export function Tape({
  league, series, first, last, height = 28, readout = true,
}: {
  league: League;
  series: SeasonPoint[];
  first: number;
  last: number;
  height?: number;
  readout?: boolean;
}) {
  const [hover, setHover] = useState<SeasonPoint | null>(null);
  const byYear = new Map(series.map((p) => [p.y, p]));
  const years: number[] = [];
  for (let y = first; y <= last; y++) years.push(y);
  const gap = years.length > 60 ? 1 : 2;
  const shown = hover ?? null;

  return (
    <div className="min-w-0">
      <div
        className="flex items-end pt-3"
        style={{ gap }}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Season by season, ${first} to ${last}. ${series.filter((p) => p.champ).length} titles.`}
      >
        {years.map((y) => {
          const p = byYear.get(y);
          if (!p) return <span key={y} className="min-w-0 flex-1 rounded-[2px] border border-dashed border-line" style={{ height }} />;
          return (
            <span
              key={y}
              onPointerEnter={() => setHover(p)}
              onPointerDown={() => setHover(p)}
              className={clsx(
                "relative min-w-0 flex-1 rounded-[2px] transition-[background-color,opacity] duration-300",
                hover && hover.y !== y && "opacity-55",
                p.live && "opacity-70",
              )}
              style={{ height, background: heat(p.z) }}
            >
              {p.champ && <Pennant size={9} className="absolute -top-[11px] left-1/2 -translate-x-1/2 text-ink" />}
              {p.runnerUp && <span className="absolute -top-[5px] left-1/2 size-[3px] -translate-x-1/2 rounded-full bg-ink-3" />}
            </span>
          );
        })}
      </div>
      {readout && (
        <div className="num mt-1 flex h-4 justify-between text-[12px] leading-4 text-ink-3">
          {shown ? (
            <span className="text-ink-2">
              {seasonLabel(league, shown.y)} · {record(shown.w, shown.l, shown.t)} · {pct(shown.pct)} · {signed(shown.z, 1)}σ
              {shown.champ ? " · champions" : shown.runnerUp ? " · lost the final" : ""}
              {shown.live ? " · in progress" : ""}
            </span>
          ) : (
            <>
              <span>{seasonLabel(league, Math.max(first, series[0]?.y ?? first))}</span>
              <span>{seasonLabel(league, Math.min(last, series[series.length - 1]?.y ?? last))}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function HeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 whitespace-nowrap text-[12px] leading-4 text-ink-3">
      <span className="flex items-center gap-2">
      <span>Awful</span>
      <span className="flex gap-0.5">
        {[-2.2, -1.4, -0.7, 0, 0.7, 1.4, 2.2].map((z) => (
          <span key={z} className="h-3 w-4 rounded-[2px]" style={{ background: heat(z) }} />
        ))}
      </span>
      <span>Great</span>
      </span>
      <span className="flex items-center gap-1 text-ink-2">
        <Pennant size={9} /> title
      </span>
      <span className="flex items-center gap-1">
        <span className="size-[3px] rounded-full bg-ink-3" /> lost the final
      </span>
    </div>
  );
}
