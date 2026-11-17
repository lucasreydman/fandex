"use client";

import NumberFlow from "@number-flow/react";
import { Check, Link2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { heatIndex } from "@/lib/color";
import { seasonLabel, verdict } from "@/lib/engine";
import type { FanSummary, Result } from "@/lib/types";
import { HeatLegend, Tape } from "./Tape";
import { EASE, Logo, Pennant, pct, record, signed } from "./ui";

const DOT = 8;
const STEP = 10;

/**
 * Where the fan lands among the cities, on one 0 to 100 line. Every city is a
 * dot coloured by its score; dots that would overlap stack upward. Moving the
 * pointer (or a finger) anywhere along the strip reads out the nearest city.
 */
function CityScale({ result, fan }: { result: Result; fan: FanSummary }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mine = useMemo(() => new Set(fan.picks.map((s) => s.team.metro)), [fan.picks]);
  const { dots, levels } = useMemo(() => {
    const sorted = [...result.metros].sort((a, b) => a.index - b.index);
    const lastX: number[] = []; // right-most dot placed on each level
    const out = sorted.map((m) => {
      const x = (m.index / 100) * width;
      let level = 0;
      while (lastX[level] !== undefined && x - lastX[level] < DOT + 1) level++;
      lastX[level] = x;
      return { m, x, level };
    });
    return { dots: out, levels: Math.max(1, lastX.length) };
  }, [result.metros, width]);

  const height = levels * STEP;
  const active = dots.find((d) => d.m.name === hover) ?? null;
  const youX = (fan.index / 100) * width;

  const scrub = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !dots.length) return;
    const x = clientX - box.left;
    let best = dots[0];
    for (const d of dots) if (Math.abs(d.x - x) < Math.abs(best.x - x)) best = d;
    setHover(best.m.name);
  };

  // Keep the floating label inside the strip.
  const labelX = active ? Math.max(70, Math.min(width - 70, active.x)) : 0;

  return (
    <div>
      <div
        ref={ref}
        className="relative cursor-crosshair touch-pan-y select-none"
        style={{ height: height + 36 }}
        onPointerMove={(e) => scrub(e.clientX)}
        onPointerDown={(e) => scrub(e.clientX)}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Your score of ${Math.round(fan.index)} against ${result.metros.length} cities. ${fan.sadder} are lower, ${fan.happier} higher.`}
      >
        <span className="absolute inset-x-0 bottom-0 h-px bg-line-2" />
        {dots.map(({ m, x, level }) => {
          const on = active?.m.name === m.name;
          return (
            <span
              key={m.name}
              className="absolute rounded-full transition-[transform,opacity] duration-150 ease-out"
              style={{
                width: DOT, height: DOT, left: x - DOT / 2, bottom: 3 + level * STEP,
                background: heatIndex(m.index),
                boxShadow: on ? "0 0 0 2px var(--text)" : mine.has(m.name) ? "0 0 0 1.5px var(--accent)" : "0 0 0 1px var(--card)",
                transform: on ? "scale(1.5)" : undefined,
                opacity: active && !on ? 0.55 : 1,
                zIndex: on ? 2 : 1,
              }}
            />
          );
        })}

        <motion.span
          className="pointer-events-none absolute bottom-0 top-0 flex flex-col items-center"
          initial={false}
          animate={{ left: youX, opacity: active && Math.abs(labelX - youX) < 96 ? 0 : 1 }}
          transition={{ duration: 0.4, ease: EASE }}
          style={{ x: "-50%" }}
        >
          <span className="num rounded-[4px] bg-accent px-1.5 text-[12px] leading-5 text-accent-ink">You</span>
          <span className="w-[2px] flex-1 rounded-[1px] bg-accent" />
        </motion.span>

        {active && (
          <span
            className="num pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-ink px-1.5 text-[12px] leading-5 text-bg"
            style={{ left: labelX }}
          >
            {active.m.name} · {Math.round(active.m.index)}
          </span>
        )}
      </div>
      <div className="num mt-1 flex justify-between text-[12px] leading-4 text-ink-3">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
      <p className="mt-3 min-h-5 text-[13px] leading-5 text-ink-2">
        {active ? (
          <>
            <span className="text-ink">{active.m.name}</span> is #{active.m.rank} of {result.metros.length} cities · {active.m.teams.length} {active.m.teams.length === 1 ? "team" : "teams"} · {active.m.titles} {active.m.titles === 1 ? "title" : "titles"} · {pct(active.m.pct)}
          </>
        ) : (
          <>
            Each dot is a city. {fan.sadder} had it worse than you, {fan.happier} had it better
            {fan.twin ? <>, and you’ve lived like <span className="text-ink">{fan.twin.name}</span></> : null}
          </>
        )}
      </p>
    </div>
  );
}

function Stat({ label, value, note, children }: { label: string; value?: number; note?: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 py-4">
      <div className="text-[13px] leading-5 text-ink-2">{label}</div>
      <div className="display mt-2 flex h-10 items-center gap-2 text-[36px] text-ink">
        {children ?? <NumberFlow value={value ?? 0} className="[--number-flow-mask-height:0.06em]" style={{ lineHeight: 1 }} />}
      </div>
      {note && <div className="mt-2 text-[12px] leading-4 text-ink-3">{note}</div>}
    </div>
  );
}

export function Scorecard({ result, fan, eraLabel }: { result: Result; fan: FanSummary; eraLabel: string }) {
  const [copied, setCopied] = useState(false);
  const v = verdict(fan.index);
  const { first, last } = useMemo(() => {
    let a = Infinity, b = -Infinity;
    for (const s of fan.picks) for (const p of s.series) { a = Math.min(a, p.y); b = Math.max(b, p.y); }
    return { first: a, last: b };
  }, [fan.picks]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked: the address bar already holds the link */ }
  };

  return (
    <section aria-label="Your record" className="rounded-[16px] border border-line bg-card">
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between">
          <span className="text-[13px] leading-5 text-ink-2">Fan luck, {eraLabel}</span>
          <button type="button" onClick={share} className="-mr-2 flex h-8 items-center gap-2 rounded-[8px] px-2 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
            {copied ? <Check size={16} strokeWidth={1.5} /> : <Link2 size={16} strokeWidth={1.5} />} {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <div className="mt-6 grid items-end gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
          <div>
            <div className="flex items-baseline gap-2">
              <NumberFlow value={Math.round(fan.index)} className="display text-[112px] text-ink [--number-flow-mask-height:0.06em] md:text-[136px]" style={{ lineHeight: 0.86 }} />
              <span className="display text-[28px] text-ink-3">/ 100</span>
            </div>
            <h2 className="mt-4 text-[28px] font-medium leading-8 text-ink">{v.title}</h2>
            <p className="mt-1 text-[15px] leading-[22px] text-ink-2">{v.line}</p>
          </div>
          <CityScale result={result} fan={fan} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 border-t border-line px-6 sm:grid-cols-3 md:px-8 lg:grid-cols-5">
        <Stat label="Titles" note={fan.titles ? `One every ${(fan.seasons / fan.titles).toFixed(fan.seasons / fan.titles >= 10 ? 0 : 1)} team seasons` : `None in ${fan.seasons} team seasons`}>
          <NumberFlow value={fan.titles} className="[--number-flow-mask-height:0.06em]" style={{ lineHeight: 1 }} />
          {fan.titles > 0 && <Pennant size={18} className="text-accent" />}
        </Stat>
        <Stat label="Finals lost" value={fan.finalsLost} note="So close" />
        <Stat label="Great seasons" value={fan.elite} note="A full σ above the league" />
        <Stat label="Awful seasons" value={fan.dud} note="A full σ below it" />
        <Stat label="Win rate" note={`${fan.picks.reduce((a, s) => a + s.w, 0).toLocaleString("en-US")} wins`}>
          <span>{pct(fan.pct)}</span>
        </Stat>
      </div>

      <div className="border-t border-line p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-medium text-ink">Season by season</h3>
          <HeatLegend />
        </div>
        <ul className="mt-4 grid gap-4">
          {fan.picks.map((s) => (
            <li key={s.team.key} className="grid items-center gap-x-6 gap-y-1 md:grid-cols-[240px_minmax(0,1fr)]">
              <div className="flex min-w-0 items-center gap-3">
                <Logo team={s.team} size={36} />
                <div className="min-w-0">
                  <div className="text-[15px] leading-5 text-ink">{s.team.name}</div>
                  <div className="num text-[12px] leading-4 text-ink-3">
                    #{s.rank} · {record(s.w, s.l, s.t)} · {pct(s.pct)}
                  </div>
                </div>
              </div>
              <Tape league={s.team.league} series={s.series} first={first} last={last} />
            </li>
          ))}
        </ul>
        {(fan.bestYear || fan.worstYear) && fan.picks.length > 0 && (
          <p className="mt-4 text-[13px] leading-5 text-ink-2">
            {fan.bestYear && (
              <>Best year to be you: <span className="num text-ink">{yearLabel(fan, fan.bestYear.y)}</span> ({signed(fan.bestYear.z, 1)}σ on average). </>
            )}
            {fan.worstYear && fan.worstYear.y !== fan.bestYear?.y && (
              <>Worst: <span className="num text-ink">{yearLabel(fan, fan.worstYear.y)}</span> ({signed(fan.worstYear.z, 1)}σ)</>
            )}
          </p>
        )}
      </div>
    </section>
  );
}

function yearLabel(fan: FanSummary, y: number): string {
  // With one team, use that league's season naming; across leagues a plain year is clearer.
  return fan.picks.length === 1 ? seasonLabel(fan.picks[0].team.league, y) : String(y);
}
