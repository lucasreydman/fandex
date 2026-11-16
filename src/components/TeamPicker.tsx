"use client";

import clsx from "clsx";
import { Dices, MapPin, Plus, Search, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EMPTY_PICKS } from "@/lib/state";
import type { Picks } from "@/lib/state";
import { LEAGUES } from "@/lib/types";
import type { League, Team } from "@/lib/types";
import { EASE, Logo, Segmented } from "./ui";

export type PickerView = League | "city";

export function randomPicks(teams: Team[]): Picks {
  const next: Picks = { ...EMPTY_PICKS };
  for (const l of LEAGUES) {
    const pool = teams.filter((t) => t.league === l && !t.inactive);
    next[l] = pool[Math.floor(Math.random() * pool.length)].key;
  }
  return next;
}

/**
 * League tabs, search and the logo grid. Shared by the picker sheet and the
 * first-visit setup. Picking a team moves on to the next league that still
 * needs one; onComplete fires once nothing is left to pick.
 */
export function TeamBrowser({
  teams, picks, onChange, view, setView, onComplete, trailing, className,
}: {
  teams: Team[];
  picks: Picks;
  onChange: (p: Picks) => void;
  view: PickerView;
  setView: (v: PickerView) => void;
  onComplete?: () => void;
  trailing?: ReactNode;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const metros = useMemo(() => {
    const m = new Map<string, Team[]>();
    for (const t of teams) if (!t.inactive) m.set(t.metro, [...(m.get(t.metro) ?? []), t]);
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [teams]);

  const q = query.trim().toLowerCase();
  const list = view === "city" ? [] : teams.filter((t) => t.league === view && (!q || t.name.toLowerCase().includes(q))).sort((a, b) => a.nick.localeCompare(b.nick));
  const cityList = metros.filter(([name, ts]) => !q || name.toLowerCase().includes(q) || ts.some((t) => t.name.toLowerCase().includes(q)));
  const go = (v: PickerView) => { setView(v); setQuery(""); };

  const choose = (t: Team) => {
    const next = { ...picks, [t.league]: picks[t.league] === t.key ? null : t.key };
    onChange(next);
    if (!next[t.league]) return;
    const todo = LEAGUES.find((l) => !next[l]);
    if (todo) go(todo);
    else onComplete?.();
  };

  const chooseCity = (ts: Team[]) => {
    const next: Picks = { ...EMPTY_PICKS };
    for (const t of ts) if (!next[t.league]) next[t.league] = t.key;
    onChange(next);
    onComplete?.();
  };

  return (
    <div className={clsx("flex min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <Segmented<PickerView>
          label="League"
          size="sm"
          value={view}
          onChange={go}
          options={[
            ...LEAGUES.map((l) => ({
              value: l as PickerView,
              label: (
                <span className="flex items-center gap-1.5">
                  {l}
                  {picks[l] && <span className="size-[5px] rounded-full bg-accent" />}
                </span>
              ),
            })),
            { value: "city" as PickerView, label: "By city" },
          ]}
        />
        <label className="ml-auto flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[8px] bg-raised px-3 sm:max-w-[220px]">
          <Search size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search teams"
            className="w-full min-w-0 bg-transparent text-[14px] outline-none placeholder:text-ink-3"
          />
        </label>
        {trailing}
      </div>
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto p-4">
        {view === "city" ? (
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {cityList.map(([name, ts]) => (
              <button
                key={name}
                type="button"
                onClick={() => chooseCity(ts)}
                className="flex h-11 items-center gap-3 rounded-[8px] px-3 text-left transition-colors duration-150 hover:bg-raised"
              >
                <span className="min-w-0 flex-1 truncate text-[14px]">{name}</span>
                <span className="flex -space-x-1">
                  {ts.slice(0, 6).map((t) => <Logo key={t.key} team={t} size={22} />)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-6 md:grid-cols-8">
            {list.map((t) => {
              const on = picks[t.league] === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => choose(t)}
                  className={clsx(
                    "flex h-[88px] flex-col items-center justify-center gap-2 rounded-[8px] px-1 transition-[background-color,transform] duration-150 active:scale-[0.97]",
                    on ? "bg-raised ring-1 ring-ink" : "hover:bg-raised",
                  )}
                >
                  <Logo team={t} size={40} />
                  <span className="w-full truncate text-center text-[12px] leading-4 text-ink-2">
                    {t.nick}
                    {t.inactive && <span className="block text-ink-3">inactive</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {(view === "city" ? cityList.length : list.length) === 0 && (
          <p className="py-12 text-center text-[14px] text-ink-3">No match for “{query}”</p>
        )}
      </div>
    </div>
  );
}

export function TeamPicker({ teams, picks, onChange }: { teams: Team[]; picks: Picks; onChange: (p: Picks) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<PickerView>("NFL");
  const [session, setSession] = useState(0);
  const byKey = useMemo(() => new Map(teams.map((t) => [t.key, t])), [teams]);

  const open = (v: PickerView) => {
    setView(v);
    setSession((n) => n + 1); // a fresh browser each time, so the search box starts empty
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // Click on the backdrop closes the sheet.
    const onClick = (e: MouseEvent) => { if (e.target === d) d.close(); };
    d.addEventListener("click", onClick);
    return () => d.removeEventListener("click", onClick);
  }, []);

  const count = LEAGUES.filter((l) => picks[l]).length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-[15px] font-medium text-ink">Your teams</h2>
        <span className="text-[13px] text-ink-3">One per league, skip any you don’t follow</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {LEAGUES.map((l) => {
          const t = picks[l] ? byKey.get(picks[l]!) : undefined;
          return (
            <button
              key={l}
              type="button"
              onClick={() => open(l)}
              className={clsx(
                "group flex h-[124px] flex-col items-center justify-center gap-2 rounded-[12px] border text-center transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]",
                t ? "border-line bg-card hover:border-line-2" : "border-dashed border-line-2 hover:bg-raised",
              )}
            >
              {t ? (
                <motion.span key={t.key} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: EASE }}>
                  <Logo team={t} size={56} />
                </motion.span>
              ) : (
                <span className="grid size-14 place-items-center rounded-full bg-raised text-ink-3 transition-colors duration-150 group-hover:text-ink">
                  <Plus size={18} strokeWidth={1.5} />
                </span>
              )}
              <span className="px-2 text-[13px] leading-4">
                <span className="num block text-[12px] text-ink-3">{l}</span>
                <span className={clsx("block truncate", t ? "text-ink" : "text-ink-2")}>{t ? t.nick : "Pick a team"}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
        <button type="button" onClick={() => open("city")} className="flex h-8 items-center gap-2 transition-colors duration-150 hover:text-ink">
          <MapPin size={16} strokeWidth={1.5} /> Pick a whole city
        </button>
        <button type="button" onClick={() => onChange(randomPicks(teams))} className="flex h-8 items-center gap-2 transition-colors duration-150 hover:text-ink">
          <Dices size={16} strokeWidth={1.5} /> Random fan
        </button>
        {count > 0 && (
          <button type="button" onClick={() => onChange({ ...EMPTY_PICKS })} className="flex h-8 items-center gap-2 transition-colors duration-150 hover:text-ink">
            <X size={16} strokeWidth={1.5} /> Clear
          </button>
        )}
      </div>

      <dialog
        ref={ref}
        aria-label="Pick your teams"
        className="m-auto w-[min(760px,calc(100vw-24px))] rounded-[16px] border border-line bg-card p-0 text-ink shadow-[var(--shadow)]"
      >
        <TeamBrowser
          key={session}
          teams={teams}
          picks={picks}
          onChange={onChange}
          view={view}
          setView={setView}
          onComplete={close}
          className="max-h-[min(640px,calc(100dvh-48px))]"
          trailing={
            <button type="button" aria-label="Close" onClick={close} className="grid size-8 place-items-center rounded-[8px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
              <X size={18} strokeWidth={1.5} />
            </button>
          }
        />
      </dialog>
    </div>
  );
}
