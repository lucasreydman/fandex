"use client";

import { ArrowLeft, ArrowRight, Dices } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Picks, State } from "@/lib/state";
import type { League, Team } from "@/lib/types";
import { randomPicks, TeamBrowser } from "./TeamPicker";
import type { PickerView } from "./TeamPicker";
import { EASE, Logo, Wordmark } from "./ui";
import { Ruler, Stepper } from "./YearDial";

/**
 * First-visit setup: a birth year, then teams league by league, then straight to
 * the scorecard. Any league can be skipped, and picking a city fills them all.
 * The sheet keeps one size throughout, so moving between steps never makes it jump.
 */
export function Welcome({
  open, teams, leagues, state, set, min, max, onDone,
}: {
  open: boolean;
  teams: Team[];
  leagues: League[];
  state: State;
  set: (patch: Partial<State>) => void;
  min: number;
  max: number;
  /** finished is true when the visitor picked something, false when they chose to browse. */
  onDone: (finished: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [view, setView] = useState<PickerView>("NFL");
  const byKey = useMemo(() => new Map(teams.map((t) => [t.key, t])), [teams]);
  const chosen = leagues.map((l) => state.picks[l]).filter(Boolean) as string[];

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); nextRef.current?.focus({ preventScroll: true }); }
    if (!open && d.open) d.close();
  }, [open]);

  // Escape counts as "just browse".
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => { e.preventDefault(); onDone(false); };
    d.addEventListener("cancel", onCancel);
    return () => d.removeEventListener("cancel", onCancel);
  }, [onDone]);

  const primary = "flex h-11 items-center gap-2 rounded-[10px] bg-ink px-5 text-[15px] font-medium text-bg transition-[transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-40";
  const quiet = "flex h-11 items-center gap-2 rounded-[10px] px-3 text-[14px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink";

  return (
    <dialog
      ref={ref}
      aria-label="Set up Fandex"
      className="m-auto w-[min(920px,calc(100vw-24px))] rounded-[16px] border border-line bg-card p-0 text-ink shadow-[var(--shadow)]"
    >
      <div className="flex h-[min(700px,calc(100dvh-32px))] flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-6">
          <Wordmark />
          <span className="num text-[12px] text-ink-3">Step {step} of 2</span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: step === 2 ? 24 : -24 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
        {step === 1 ? (
          <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-10">
            <h2 className="display text-[36px] leading-[1.05] text-ink sm:text-[44px]">What year were you born</h2>
            <p className="mt-3 max-w-[32rem] text-[15px] leading-[22px] text-ink-2">
              Fandex adds up every season your teams have played since. You can switch to all time or any span of years afterwards
            </p>
            <div className="mt-6">
              <Stepper value={state.year} min={min} max={max} onChange={(v) => set({ mode: "birth", year: Math.max(min, Math.min(max, v)) })} label="Birth year" />
            </div>
            <div className="mt-4">
              <Ruler min={min} max={max} value={state.year} label="Birth year" onChange={(v) => set({ mode: "birth", year: v })} />
            </div>
          </div>
        ) : (
          <>
            <div className="px-6 pb-4 pt-6 sm:px-10">
              <h2 className="display text-[36px] leading-[1.05] text-ink sm:text-[44px]">Who do you root for</h2>
              <div className="mt-3 flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2">
                <p className="text-[15px] leading-[22px] text-ink-2">One per league. Skip any you don’t follow, or pick your city to take them all</p>
                {chosen.length > 0 && (
                  <span className="flex items-center gap-2">
                    {chosen.map((k) => <Logo key={k} team={byKey.get(k)!} size={28} />)}
                  </span>
                )}
              </div>
            </div>
            <TeamBrowser
              teams={teams}
              leagues={leagues}
              picks={state.picks}
              onChange={(p: Picks) => set({ picks: p })}
              view={view}
              setView={setView}
              onComplete={(p) => { if (leagues.some((l) => p[l])) onDone(true); }}
              className="min-h-0 flex-1 border-t border-line"
            />
          </>
        )}
        </motion.div>
        </AnimatePresence>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-4">
          {step === 1 ? (
            <>
              <button type="button" className={quiet} onClick={() => onDone(false)}>Just browse</button>
              <div className="flex items-center gap-2">
                <button type="button" className={quiet} onClick={() => { set({ mode: "all" }); setStep(2); }}>Use all time</button>
                <button ref={nextRef} type="button" className={primary} onClick={() => { set({ mode: "birth" }); setStep(2); }}>
                  Next <ArrowRight size={16} strokeWidth={1.5} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <button type="button" className={quiet} onClick={() => setStep(1)}>
                  <ArrowLeft size={16} strokeWidth={1.5} /> Back
                </button>
                <button type="button" className={quiet} onClick={() => set({ picks: randomPicks(teams, leagues) })}>
                  <Dices size={16} strokeWidth={1.5} /> Random
                </button>
              </div>
              <button type="button" className={`${primary} max-sm:w-full max-sm:justify-center`} disabled={!chosen.length} onClick={() => onDone(true)}>
                {chosen.length ? "Show my Fandex" : "Pick a team"} {chosen.length > 0 && <ArrowRight size={16} strokeWidth={1.5} />}
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
