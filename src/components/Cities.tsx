"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import map from "@/data/map.json";
import { heatIndex } from "@/lib/color";
import type { MetroStat, Result } from "@/lib/types";
import { EASE, Logo, Pennant, pct } from "./ui";

const points = map.metros as unknown as Record<string, [number, number]>;
const radius = (n: number) => 5 + Math.sqrt(n) * 4.5;

export function Cities({ result, picks }: { result: Result; picks: string[] }) {
  const mine = useMemo(() => new Set(picks.map((k) => result.byKey.get(k)?.team.metro).filter(Boolean) as string[]), [picks, result]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  // The card under the map follows the city that was picked, never the pointer. Cards differ in
  // height, and a page that changes length under a hovering pointer slides the map out from
  // under it, which drops the hover, which changes the card back: the whole view shakes.
  const shown = result.metros.find((m) => m.name === selected) ?? result.metros.find((m) => mine.has(m.name)) ?? result.metros[0];
  // Hovering only moves the outline and the label, neither of which takes up room.
  const active = result.metros.find((m) => m.name === hover) ?? shown;
  // Draw big circles first so small cities stay clickable on top of them.
  const drawOrder = useMemo(() => [...result.metros].sort((a, b) => b.teams.length - a.teams.length), [result]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-[16px] border border-line bg-card">
          <svg viewBox={`0 0 ${map.w} ${map.h}`} className="block w-full" role="img" aria-label="Map of fan luck by city across the United States and Canada">
            <path d={map.other} fill="var(--raised)" opacity="0.5" />
            <path d={map.land} fill="var(--raised)" />
            <path d={map.lakes} fill="var(--card)" />
            <path d={map.states} fill="none" stroke="var(--line-2)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
            {drawOrder.map((m) => {
              const p = points[m.name];
              if (!p) return null;
              const on = active?.name === m.name;
              return (
                <g
                  key={m.name}
                  transform={`translate(${p[0]} ${p[1]})`}
                  className="cursor-pointer outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`${m.name}: ${Math.round(m.index)} of 100, rank ${m.rank}`}
                  onPointerEnter={() => setHover(m.name)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(m.name)}
                  onBlur={() => setHover(null)}
                  onClick={() => setSelected(m.name)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelected(m.name); }}
                >
                  {mine.has(m.name) && <circle r={radius(m.teams.length) + 4} fill="none" stroke="var(--accent)" strokeWidth="1.5" />}
                  <motion.circle
                    initial={false}
                    animate={{ r: radius(m.teams.length) }}
                    transition={{ duration: 0.4, ease: EASE }}
                    style={{ fill: heatIndex(m.index), transition: "fill 0.4s var(--ease)" }}
                    stroke={on ? "var(--text)" : "var(--card)"}
                    strokeWidth={on ? 1.75 : 1}
                  />
                </g>
              );
            })}
            {active && points[active.name] && (
              <g transform={`translate(${points[active.name][0]} ${points[active.name][1] - radius(active.teams.length) - 8})`} pointerEvents="none">
                <text textAnchor="middle" fontSize="13" fontWeight="500" fill="var(--text)" stroke="var(--card)" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">
                  {active.name} · {Math.round(active.index)}
                </text>
              </g>
            )}
          </svg>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] leading-4 text-ink-3">
          <span className="flex items-center gap-2">
            Cursed
            <span className="flex gap-0.5">
              {[2, 18, 34, 50, 66, 82, 98].map((v) => <span key={v} className="size-3 rounded-full" style={{ background: heatIndex(v) }} />)}
            </span>
            Charmed
          </span>
          <span>Bigger circle, more teams</span>
          {mine.size > 0 && (
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-full border-[1.5px] border-accent" /> Your cities
            </span>
          )}
        </div>
        {shown && <CityCard m={shown} total={result.teams.length} />}
      </div>

      <ol className="scroll-quiet max-h-[720px] overflow-y-auto lg:pr-1">
        {result.metros.map((m) => (
          <CityRow key={m.name} m={m} on={active?.name === m.name} mine={mine.has(m.name)} onPick={() => setSelected(m.name)} onHover={setHover} />
        ))}
      </ol>
    </div>
  );
}

function CityRow({ m, on, mine, onPick, onHover }: { m: MetroStat; on: boolean; mine: boolean; onPick: () => void; onHover: (n: string | null) => void }) {
  return (
    <motion.li layout="position" transition={{ duration: 0.45, ease: EASE }}>
      <button
        type="button"
        onClick={onPick}
        onPointerEnter={() => onHover(m.name)}
        onPointerLeave={() => onHover(null)}
        className={clsx(
          "relative grid h-10 w-full grid-cols-[28px_minmax(0,1fr)_auto_32px] items-center gap-3 rounded-[8px] px-2 text-left transition-colors duration-150 hover:bg-raised",
          on && "bg-raised",
        )}
      >
        {mine && <span className="absolute inset-y-2 left-0 w-[3px] rounded-[2px] bg-accent" />}
        <span className="num text-right text-[12px] text-ink-3">{m.rank}</span>
        <span className="whitespace-nowrap text-[14px] text-ink">{m.name}</span>
        <span className="flex -space-x-1">
          {m.teams.slice(0, 5).map((s) => <Logo key={s.team.key} team={s.team} size={18} />)}
        </span>
        <span className="num text-right text-[13px] text-ink">{Math.round(m.index)}</span>
      </button>
    </motion.li>
  );
}

function CityCard({ m, total }: { m: MetroStat; total: number }) {
  return (
    <div className="mt-4 rounded-[16px] border border-line bg-card p-6 md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-[20px] font-medium leading-7 text-ink">{m.name}</h3>
        <p className="num text-[13px] text-ink-2">
          #{m.rank} of cities · luck {Math.round(m.index)} · {pct(m.pct)} · {m.titles} {m.titles === 1 ? "title" : "titles"} · {m.finalsLost} finals lost
        </p>
      </div>
      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {m.teams.map((s) => (
          <li key={s.team.key} className="flex min-h-10 items-center gap-3 py-1">
            <Logo team={s.team} size={28} className={s.current ? undefined : "opacity-60"} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] leading-5 text-ink">{s.name}</span>
              <span className="num block text-[12px] leading-4 text-ink-3">
                {pct(s.pct)}{" · "}
                {s.current
                  ? `#${s.stat.rank} of ${total}${s.seasons < s.stat.seasons ? ` · since ${s.first}` : ""}`
                  : `${s.first === s.last ? s.first : `${s.first} to ${s.last}`} · now ${s.team.inactive ? "inactive" : s.team.name}`}
              </span>
            </span>
            {s.titles > 0 && (
              <span className="num flex items-center gap-1 text-[13px] text-ink">
                <Pennant size={10} className="text-accent" /> {s.titles}
              </span>
            )}
            <span className="num w-7 text-right text-[13px] text-ink-2">{Math.round(s.index)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
