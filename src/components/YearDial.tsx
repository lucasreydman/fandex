"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { Mode, State } from "@/lib/state";
import { Segmented, Switch } from "./ui";

export function Ruler({ min, max, value, onChange, label }: { min: number; max: number; value: number; onChange: (v: number) => void; label: string }) {
  const decades: number[] = [];
  for (let y = Math.ceil(min / 10) * 10; y <= max; y += 10) decades.push(y);
  const pos = (y: number) => `${((y - min) / (max - min)) * 100}%`;
  return (
    <div className="relative">
      {/* Ticks are drawn 2px inside each edge so they sit under the 4px thumb. */}
      <div className="pointer-events-none absolute inset-x-0.5 top-0 h-8">
        {decades.map((y) => (
          <span
            key={y}
            className="absolute bottom-2 w-px bg-line-2"
            style={{ left: pos(y), height: y % 50 === 0 ? 16 : 8 }}
          />
        ))}
        <span className="absolute inset-x-0 bottom-2 h-px bg-line-2" />
      </div>
      <input
        type="range"
        className="ruler relative block"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="num pointer-events-none relative mx-0.5 h-4 text-[12px] leading-4 text-ink-3">
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
    <div className="flex items-center gap-4">
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
  state, set, min, max,
}: {
  state: State;
  set: (patch: Partial<State>) => void;
  min: number;
  max: number;
}) {
  const { mode, year, to, memory } = state;
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
            Every season on record: MLB from 1903, the NHL from 1917, the NFL from 1922 and the NBA from 1946
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Stepper value={year} min={min} max={mode === "custom" ? to : max} onChange={(v) => set({ year: clampYear(v) })} label={mode === "birth" ? "Birth year" : "First season"} />
            {mode === "custom" && (
              <>
                <span className="display text-[40px] text-ink-3">to</span>
                <Stepper value={to} min={year} max={max} onChange={(v) => set({ to: clampYear(v) })} label="Last season" />
              </>
            )}
          </div>
          <div className="mt-2">
            <Ruler
              min={min}
              max={max}
              value={year}
              label={mode === "birth" ? "Birth year" : "First season"}
              onChange={(v) => set({ year: v, to: mode === "custom" ? Math.max(to, v) : to })}
            />
            {mode === "custom" && (
              <div className="mt-2">
                <Ruler min={min} max={max} value={to} label="Last season" onChange={(v) => set({ to: v, year: Math.min(year, v) })} />
              </div>
            )}
          </div>
          {mode === "birth" && (
            <div className="mt-4">
              <Switch checked={memory} onChange={(v) => set({ memory: v })} label={`Start at age six, the first seasons I remember (${Math.min(max, year + 6)})`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
