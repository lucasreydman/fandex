"use client";

import { RotateCcw, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { DEFAULT_WEIGHTS } from "@/lib/engine";
import type { State } from "@/lib/state";
import type { League, Weights } from "@/lib/types";
import { Segmented, Switch } from "./ui";

const PARTS: { key: keyof Weights; label: string; note: string }[] = [
  { key: "record", label: "Overall record", note: "Total wins and losses across the whole span" },
  { key: "consistency", label: "Typical season", note: "How good an ordinary year was, so ten great years and ten terrible ones don’t cancel out" },
  { key: "titles", label: "Championships", note: "Titles won against what an average club would have won" },
];

export function Tune({
  open, onClose, state, set, liveNote, leagues,
}: {
  open: boolean;
  leagues: League[];
  onClose: () => void;
  state: State;
  set: (patch: Partial<State>) => void;
  liveNote: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClick = (e: MouseEvent) => { if (e.target === d) d.close(); };
    d.addEventListener("click", onClick);
    d.addEventListener("close", onClose);
    return () => { d.removeEventListener("click", onClick); d.removeEventListener("close", onClose); };
  }, [onClose]);

  const w = state.weights;
  const sum = w.record + w.consistency + w.titles || 1;
  const isDefault = w.record === DEFAULT_WEIGHTS.record && w.consistency === DEFAULT_WEIGHTS.consistency && w.titles === DEFAULT_WEIGHTS.titles && !state.halfLife && !state.includeLive && !state.off.length;

  return (
    <dialog
      ref={ref}
      aria-label="Scoring"
      className="m-0 ml-auto h-dvh max-h-none w-[min(420px,100vw)] max-w-none border-l border-line bg-card p-0 text-ink shadow-[var(--shadow)]"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-6">
          <h2 className="text-[15px] font-medium">Scoring</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="-mr-2 grid size-8 place-items-center rounded-[8px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="scroll-quiet flex-1 overflow-y-auto px-6 py-6">
          <h3 className="text-[13px] text-ink-2">What counts as a good life as a fan</h3>
          <div className="mt-4 grid gap-6">
            {PARTS.map((p) => {
              const share = Math.round((w[p.key] / sum) * 100);
              return (
                <div key={p.key}>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor={`w-${p.key}`} className="text-[14px] text-ink">{p.label}</label>
                    <span className="num text-[13px] text-ink-2">{share}%</span>
                  </div>
                  <input
                    id={`w-${p.key}`}
                    type="range"
                    className="slider mt-2 block"
                    min={0}
                    max={100}
                    step={5}
                    value={w[p.key]}
                    style={{ "--fill": `${w[p.key]}%` } as React.CSSProperties}
                    onChange={(e) => set({ weights: { ...w, [p.key]: Number(e.target.value) } })}
                  />
                  <p className="mt-1 text-[12px] leading-4 text-ink-3">{p.note}</p>
                </div>
              );
            })}
          </div>

          <h3 className="mt-8 text-[13px] text-ink-2">Leagues counted</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {leagues.map((l) => {
              const on = !state.off.includes(l);
              const lastOn = on && leagues.filter((x) => !state.off.includes(x)).length === 1;
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={on}
                  disabled={lastOn}
                  onClick={() => set({ off: on ? [...state.off, l] : state.off.filter((x) => x !== l) })}
                  className={
                    on
                      ? "num h-8 rounded-[8px] bg-ink px-3 text-[13px] text-bg transition-[background-color,color,transform] duration-150 active:scale-[0.97]"
                      : "num h-8 rounded-[8px] border border-line-2 px-3 text-[13px] text-ink-3 line-through transition-[background-color,color,transform] duration-150 hover:text-ink active:scale-[0.97]"
                  }
                >
                  {l}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] leading-4 text-ink-3">Switch a league off to leave it out of the rankings, the cities and your number</p>

          <h3 className="mt-8 text-[13px] text-ink-2">Recency</h3>
          <div className="mt-3">
            <Segmented<string>
              label="Recency"
              size="sm"
              value={String(state.halfLife)}
              onChange={(v) => set({ halfLife: Number(v) })}
              options={[
                { value: "0", label: "All equal" },
                { value: "15", label: "Lean recent" },
                { value: "6", label: "Only lately" },
              ]}
            />
            <p className="mt-2 text-[12px] leading-4 text-ink-3">
              {state.halfLife ? `A season counts half as much every ${state.halfLife} years back` : "A season from decades ago weighs the same as last year"}
            </p>
          </div>

          <h3 className="mt-8 text-[13px] text-ink-2">Seasons</h3>
          <div className="mt-3 grid gap-3">
            <Switch checked={state.includeLive} onChange={(v) => set({ includeLive: v })} label="Count seasons in progress" />
            <p className="text-[12px] leading-4 text-ink-3">{liveNote}</p>
          </div>

          <h3 className="mt-8 text-[13px] text-ink-2">Look</h3>
          <div className="mt-3">
            <Switch checked={state.teamColors} onChange={(v) => set({ teamColors: v })} label="Use my team’s colour for highlights" />
          </div>

          <h3 className="mt-8 text-[13px] text-ink-2">How the number is made</h3>
          <div className="mt-3 grid gap-3 text-[13px] leading-5 text-ink-2">
            <p>
              Win rate is wins over wins plus losses, regular season only. Ties are left out and overtime losses in hockey count as losses. In soccer, where draws are part of the game, a draw counts as half a win.
            </p>
            <p>
              Baseball records bunch up near .500 and football records spread wide, so every record is measured in units of how spread out its own league is. A .560 baseball team and a .620 basketball team come out about equally dominant.
            </p>
            <p>
              The three parts above are blended into one score. The best franchise in the span is 100 and the worst is 0. Your number is the average of your teams on that same line, and a city’s number is the average of its teams.
            </p>
            <p>
              Short histories are pulled toward average, since nine seasons prove less than thirty. That keeps a young expansion team from outranking decades of winning.
            </p>
            <p>
              History follows each league’s official record. The Sonics’ seasons belong to the Thunder, the 1988 to 2002 Hornets to today’s Hornets, the Browns keep everything before their three missing years, and the Coyotes stay their own inactive franchise while Utah starts fresh in 2024. Cities are scored on the seasons actually played there, so Seattle keeps the Sonics’ years. Records come from ESPN and the NHL, and are checked every night.
            </p>
          </div>
        </div>
        <div className="flex h-16 shrink-0 items-center justify-between border-t border-line px-6">
          <button
            type="button"
            disabled={isDefault}
            onClick={() => set({ weights: { ...DEFAULT_WEIGHTS }, halfLife: 0, includeLive: false, off: [] })}
            className="-ml-3 flex h-9 items-center gap-2 rounded-[10px] px-3 text-[14px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink disabled:opacity-40"
          >
            <RotateCcw size={16} strokeWidth={1.5} /> Reset
          </button>
          <button type="button" onClick={onClose} className="h-9 rounded-[10px] bg-ink px-4 text-[14px] font-medium text-bg transition-transform duration-150 active:scale-[0.98]">
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
