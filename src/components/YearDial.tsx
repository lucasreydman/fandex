"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { Mode, State } from "@/lib/state";
import { Segmented } from "./ui";

type Handle = { value: number; onChange: (v: number) => void; label: string };

/**
 * The year ruler. With `end` it carries two handles and shades the span between
 * them. Handles are 12px wide to grab; ticks are inset by half of that so a
 * handle sits exactly on its year.
 */
export function Ruler({ min, max, value, onChange, label, end }: Handle & { min: number; max: number; end?: Handle }) {
  const decades: number[] = [];
  for (let y = Math.ceil(min / 10) * 10; y <= max; y += 10) decades.push(y);
  const pos = (y: number) => `${((y - min) / (max - min)) * 100}%`;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-x-0 top-[23px] h-px bg-line-2" />
      <div className="pointer-events-none absolute inset-x-1.5 top-0 h-8">
        {decades.map((y) => (
          <span key={y} className="absolute bottom-2 w-px bg-line-2" style={{ left: pos(y), height: y % 50 === 0 ? 16 : 8 }} />
        ))}
        {end && <span className="absolute bottom-[7px] h-[3px] rounded-[1px] bg-ink" style={{ left: pos(value), right: `calc(100% - ${pos(end.value)})` }} />}
      </div>
      <input type="range" className={end ? "ruler dual relative block" : "ruler relative block"} min={min} max={max} step={1} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      {end && (
        <input type="range" className="ruler dual absolute inset-x-0 top-0 block" min={min} max={max} step={1} value={end.value} aria-label={end.label} onChange={(e) => end.onChange(Number(e.target.value))} />
      )}
      <div className="num pointer-events-none relative mx-1.5 h-4 text-[12px] leading-4 text-ink-3">
        {decades.filter((y) => y % 20 === 0).map((y) => (
          <span key={y} className="absolute -translate-x-1/2" style={{ left: pos(y) }}>
            {y}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The year itself is the control: click it and type. The minus and plus keys
 * beside it nudge one year, and so do the arrow keys while typing.
 */
export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const commit = (text: string) => {
    const n = Number(text);
    if (text.length === 4 && Number.isFinite(n)) onChange(clamp(n));
  };
  const btn = "grid size-9 place-items-center rounded-[10px] border border-line-2 bg-card text-ink-2 transition-[background-color,color,transform] duration-150 hover:bg-raised hover:text-ink active:scale-[0.97] disabled:opacity-30";
  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        aria-label={label}
        title="Type a year"
        value={draft ?? String(value)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const text = e.target.value.replace(/\D/g, "").slice(0, 4);
          setDraft(text);
          commit(text);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            setDraft(null);
            onChange(clamp(value + (e.key === "ArrowUp" ? 1 : -1)));
          }
        }}
        className="display w-[4.1ch] cursor-text rounded-none border-b-2 border-dashed border-line-2 bg-transparent text-[72px] text-ink outline-none transition-colors duration-150 hover:border-ink-3 focus:border-solid focus:border-ink sm:text-[88px]"
        style={{ lineHeight: 1.05 }}
      />
      <div className="flex gap-2">
        <button type="button" aria-label={`${label}: one year earlier`} className={btn} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus size={16} strokeWidth={1.5} />
        </button>
        <button type="button" aria-label={`${label}: one year later`} className={btn} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Plus size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

export function YearDial({
  state, set, min, max, allTimeNote,
}: {
  /** Which leagues are counted and when each begins, for the all-time view. */
  allTimeNote: string;
  state: State;
  set: (patch: Partial<State>) => void;
  min: number;
  max: number;
}) {
  const { mode, year, to } = state;
  const clampYear = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div>
      <h2 className="mb-3 text-[15px] font-medium text-ink">Your years</h2>
      <Segmented<Mode>
        label="Era"
        value={mode}
        onChange={(m) => set({ mode: m, to: m === "custom" ? Math.max(to, year) : to })}
        options={[
          { value: "birth", label: "Since I was born" },
          { value: "all", label: "All time" },
          { value: "custom", label: "Custom years" },
        ]}
      />

      {mode === "all" ? (
        <div className="mt-6">
          <div className="display text-[72px] text-ink sm:text-[88px]">
            {min}
            <span className="text-ink-3">–</span>
            {String(max).slice(2)}
          </div>
          <p className="mt-4 max-w-[36rem] text-[14px] leading-5 text-ink-2">
            {allTimeNote}
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              {mode === "custom" && <div className="mb-1 text-[13px] leading-5 text-ink-2">From</div>}
              <Stepper value={year} min={min} max={mode === "custom" ? to : max} onChange={(v) => set({ year: clampYear(v) })} label={mode === "birth" ? "Birth year" : "First season"} />
            </div>
            {mode === "custom" && (
              <div>
                <div className="mb-1 text-[13px] leading-5 text-ink-2">To</div>
                <Stepper value={to} min={year} max={max} onChange={(v) => set({ to: clampYear(v) })} label="Last season" />
              </div>
            )}
          </div>
          <div className="mt-4">
            <Ruler
              min={min}
              max={max}
              value={year}
              label={mode === "birth" ? "Birth year" : "First season"}
              onChange={(v) => set(mode === "custom" ? { year: Math.min(v, to) } : { year: v })}
              end={mode === "custom" ? { value: to, label: "Last season", onChange: (v) => set({ to: Math.max(v, year) }) } : undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}
