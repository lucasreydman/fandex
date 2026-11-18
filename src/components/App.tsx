"use client";

import clsx from "clsx";
import { Moon, SlidersHorizontal, Sun } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import raw from "@/data/data.json";
import { teamAccent } from "@/lib/color";
import { bounds, compute, curve, seasonLabel, summarize } from "@/lib/engine";
import { decode, defaults, encode, hasVisited, load, save, toOptions } from "@/lib/state";
import type { State, Tab } from "@/lib/state";
import { LEAGUES } from "@/lib/types";
import type { Dataset } from "@/lib/types";
import { Cities } from "./Cities";
import { Curve } from "./Curve";
import { Rankings } from "./Rankings";
import { Scorecard } from "./Scorecard";
import { Seasons } from "./Seasons";
import { TeamPicker } from "./TeamPicker";
import { Welcome } from "./Welcome";
import { Tune } from "./Tune";
import { EASE, IconButton, Logo, ThemeContext, Wordmark } from "./ui";
import { YearDial } from "./YearDial";

const data = raw as unknown as Dataset;
const { min: MIN, max: MAX } = bounds(data);
const THEME_KEY = "fandex:theme";
/** Leagues with data, in display order. */
const AVAILABLE = LEAGUES.filter((l) => data.leagues[l]);

const TABS: { value: Tab; label: string }[] = [
  { value: "rankings", label: "Rankings" },
  { value: "seasons", label: "Every season" },
  { value: "cities", label: "Cities" },
];

function list(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function App() {
  const [state, setState] = useState<State>(() => defaults(MAX));
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [tuning, setTuning] = useState(false);
  const [welcome, setWelcome] = useState(false);

  // The server renders the default view; the visitor's own link or last visit takes over on load.
  useEffect(() => {
    const base = defaults(MAX);
    /* eslint-disable react-hooks/set-state-in-effect */
    setState(window.location.search ? { ...decode(window.location.search, base, data, MIN, MAX), teamColors: load(base, data, MIN, MAX).teamColors } : load(base, data, MIN, MAX));
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    // A first visit with no shared link gets the short setup; a shared link shows what was shared.
    if (!window.location.search && !hasVisited()) setWelcome(true);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    const q = encode(state, MAX);
    window.history.replaceState(null, "", `${window.location.pathname}${q}`);
    save(state, MAX);
  }, [state, ready]);

  const set = useCallback((patch: Partial<State>) => setState((s) => ({ ...s, ...patch })), []);

  const finishWelcome = useCallback((finished: boolean) => {
    setWelcome(false);
    if (finished) requestAnimationFrame(() => document.getElementById("card")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* storage blocked */ }
  };

  const options = useMemo(() => toOptions(state, MIN, MAX), [state]);
  const deferred = useDeferredValue(options);
  const result = useMemo(() => compute(data, deferred), [deferred]);
  const picks = useMemo(() => LEAGUES.map((l) => state.picks[l]).filter((k): k is string => !!k), [state.picks]);
  const fan = useMemo(() => summarize(result, picks), [result, picks]);

  // The birth-year curve does not depend on the dial, so dragging the dial never recomputes it.
  const curveKey = useDeferredValue(useMemo(() => ({ picks, weights: state.weights, halfLife: state.halfLife, includeLive: state.includeLive, excludeInactive: !state.includeInactive }), [picks, state.weights, state.halfLife, state.includeLive, state.includeInactive]));
  const points = useMemo(() => {
    if (!curveKey.picks.length) return [];
    const base = { from: MIN, to: MAX, includeLive: curveKey.includeLive, weights: curveKey.weights, halfLife: curveKey.halfLife, excludeInactive: curveKey.excludeInactive };
    return curve(data, base, curveKey.picks, MIN, MAX - 2);
  }, [curveKey]);

  const lead = picks.length ? data.teams.find((t) => t.key === picks[0]) : undefined;
  const accent = state.teamColors && lead ? teamAccent(lead.color, lead.alt, theme === "dark") : null;
  const style = accent ? ({ "--accent": accent.accent, "--accent-ink": accent.ink } as React.CSSProperties) : undefined;

  const counted = useMemo(() => AVAILABLE.filter((l) => !state.off.includes(l)), [state.off]);
  // Copy that names the leagues is built from the data, so it stays true as leagues are added or switched off.
  const starts = counted.map((l) => ({ l, y: data.leagues[l]!.seasons[0].y })).sort((a, b) => a.y - b.y);
  const allTimeNote = starts.length ? `Every season on record: ${list(starts.map((s) => `${s.l} from ${s.y}`))}` : "";
  const NUMBER = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const intro = `${(NUMBER[AVAILABLE.length] ?? String(AVAILABLE.length)).replace(/^./, (c) => c.toUpperCase())} North American pro leagues, from baseball in ${MIN} to today, scored so a baseball dynasty and a hockey dynasty can be compared. Set your years and pick your teams to see how good you’ve had it`;
  const eraLabel = state.mode === "all" ? "all time" : state.mode === "custom" ? `${options.from} to ${options.to}` : `since ${options.from}`;
  const live = LEAGUES.flatMap((l) => {
    const s = data.leagues[l]?.seasons.at(-1);
    return s?.live ? [`${l} ${seasonLabel(l, s.y)}`] : [];
  });
  const liveNote = live.length ? `Under way now: ${list(live)}. Unfinished seasons are left out unless you switch this on` : "No season is in progress right now";
  const top = result.teams[0];
  const bottom = result.teams[result.teams.length - 1];

  return (
    <ThemeContext.Provider value={theme}>
      <MotionConfig reducedMotion="user">
        <div style={style} className="min-h-dvh">
          <header className="sticky top-0 z-30 border-b border-line bg-bg">
            <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-8">
              <a href="#top" aria-label="Fandex, back to top"><Wordmark /></a>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTuning(true)}
                  className="flex h-9 items-center gap-2 rounded-[10px] px-3 text-[14px] text-ink-2 transition-[background-color,color,transform] duration-150 hover:bg-raised hover:text-ink active:scale-[0.98]"
                >
                  <SlidersHorizontal size={16} strokeWidth={1.5} /> Scoring
                </button>
                <IconButton label={theme === "dark" ? "Switch to light" : "Switch to dark"} onClick={toggleTheme}>
                  {theme === "dark" ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
                </IconButton>
              </div>
            </div>
          </header>

          <main id="top" className="mx-auto max-w-[1280px] px-4 pb-24 sm:px-8">
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="pb-12 pt-12 lg:pt-16"
            >
              <h1 className="display text-[44px] leading-[1.02] tracking-[-0.01em] text-ink sm:text-[64px]">Every season, one scale</h1>
              <p className="mt-4 max-w-[36rem] text-pretty text-[18px] leading-7 text-ink-2">
                {intro}
              </p>
              <div className="mt-10 grid gap-x-16 gap-y-10 lg:grid-cols-2">
                <YearDial state={state} set={set} min={MIN} max={MAX} allTimeNote={allTimeNote} />
                <TeamPicker teams={data.teams} leagues={AVAILABLE} picks={state.picks} onChange={(p) => set({ picks: p })} />
              </div>
            </motion.section>

            <div id="card" className="grid scroll-mt-20 gap-6">
              {fan ? (
                <>
                  <Scorecard result={result} fan={fan} eraLabel={eraLabel} />
                  {state.mode === "birth" && points.length > 1 && (
                    <Curve points={points} current={state.year} onPick={(y) => set({ year: y })} />
                  )}
                </>
              ) : (
                <section className="flex flex-col items-start gap-6 rounded-[16px] border border-line bg-card p-6 md:flex-row md:items-center md:justify-between md:p-8">
                  <div>
                    <h2 className="text-[20px] font-medium leading-7 text-ink">Pick a team to get your number</h2>
                    <p className="mt-1 text-[15px] text-ink-2">One is enough. Add a team in each league you follow for the full picture</p>
                  </div>
                  {top && bottom && (
                    <div className="flex flex-wrap gap-x-10 gap-y-4">
                      {[{ s: top, label: `Luckiest fans ${eraLabel}` }, { s: bottom, label: "Unluckiest" }].map(({ s, label }) => (
                        <div key={label} className="flex items-center gap-3">
                          <Logo team={s.team} size={40} />
                          <div>
                            <div className="text-[13px] leading-5 text-ink-3">{label}</div>
                            <div className="text-[15px] leading-5 text-ink">{s.team.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>

            <section className="mt-16" aria-label="Explore">
              <div role="tablist" aria-label="Views" className="flex gap-6 border-b border-line">
                {TABS.map((t) => {
                  const active = state.tab === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => set({ tab: t.value })}
                      className={clsx("relative h-11 text-[15px] transition-colors duration-150", active ? "font-medium text-ink" : "text-ink-2 hover:text-ink")}
                    >
                      {t.label}
                      {active && <motion.span layoutId="tab-line" className="absolute inset-x-0 -bottom-px h-[2px] bg-ink" transition={{ duration: 0.3, ease: EASE }} />}
                    </button>
                  );
                })}
                <span className="num ml-auto hidden self-center text-[12px] text-ink-3 sm:block">
                  {result.teams.length} teams · {eraLabel}
                </span>
              </div>
              <motion.div key={state.tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="pt-6">
                {state.tab === "rankings" && <Rankings result={result} picks={picks} leagues={counted} includeInactive={state.includeInactive} onIncludeInactive={(v) => set({ includeInactive: v })} />}
                {state.tab === "seasons" && <Seasons result={result} picks={picks} leagues={counted} />}
                {state.tab === "cities" && <Cities result={result} picks={picks} />}
              </motion.div>
            </section>
          </main>


          <Welcome open={welcome} teams={data.teams} leagues={AVAILABLE} state={state} set={set} min={MIN} max={MAX} onDone={finishWelcome} />
          <Tune open={tuning} onClose={() => setTuning(false)} state={state} set={set} liveNote={liveNote} leagues={AVAILABLE} />
        </div>
      </MotionConfig>
    </ThemeContext.Provider>
  );
}
