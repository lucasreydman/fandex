"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronDown, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { heatIndex } from "@/lib/color";
import { LEAGUES } from "@/lib/types";
import type { League, Result, TeamStat } from "@/lib/types";
import { Tape } from "./Tape";
import { EASE, Logo, Pennant, pct, record, Segmented, signed } from "./ui";

type SortKey = "rank" | "pct" | "z" | "avgZ" | "elite" | "dud" | "titles" | "finalsLost" | "seasons";
type Filter = "all" | League;

const COLS: { key: SortKey; label: string; title: string; hide?: string; get: (s: TeamStat) => number }[] = [
  { key: "seasons", label: "Yrs", title: "Seasons played in this span", hide: "hidden lg:flex", get: (s) => s.seasons },
  { key: "pct", label: "Win rate", title: "Wins divided by wins plus losses. Ties left out, overtime losses count as losses", get: (s) => s.pct },
  { key: "z", label: "Record", title: "How far the overall record sits from .500, in units of how spread out that league is", hide: "hidden md:flex", get: (s) => s.z },
  { key: "avgZ", label: "Typical yr", title: "Average of each season’s standing against that year’s league", hide: "hidden lg:flex", get: (s) => s.avgZ },
  { key: "elite", label: "Great", title: "Seasons a full standard deviation above the league", hide: "hidden lg:flex", get: (s) => s.elite },
  { key: "dud", label: "Awful", title: "Seasons a full standard deviation below the league", hide: "hidden lg:flex", get: (s) => s.dud },
  { key: "titles", label: "Titles", title: "Championships won", get: (s) => s.titles },
  { key: "finalsLost", label: "Lost final", title: "Finals reached and lost", hide: "hidden xl:flex", get: (s) => s.finalsLost },
  { key: "rank", label: "Luck", title: "Composite score on a 0 to 100 scale", get: (s) => -s.rank },
];

const GRID = "grid grid-cols-[20px_minmax(0,1fr)_44px_40px_44px] md:grid-cols-[40px_minmax(0,1fr)_72px_64px_56px_96px] lg:grid-cols-[40px_minmax(0,1.4fr)_48px_72px_64px_80px_56px_56px_56px_112px] xl:grid-cols-[40px_minmax(0,1.4fr)_48px_72px_64px_80px_56px_56px_56px_80px_128px] items-center gap-x-2 md:gap-x-3";

export function Rankings({ result, picks }: { result: Result; picks: string[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: -1 });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const col = COLS.find((c) => c.key === sort.key)!;
    const q = query.trim().toLowerCase();
    return result.teams
      .filter((s) => (filter === "all" || s.team.league === filter) && (!q || s.team.name.toLowerCase().includes(q) || s.team.metro.toLowerCase().includes(q)))
      .sort((a, b) => (col.get(a) - col.get(b)) * sort.dir || a.rank - b.rank);
  }, [result, filter, sort, query]);

  const { first, last } = useMemo(() => {
    let a = Infinity, b = -Infinity;
    for (const s of result.teams) { a = Math.min(a, s.series[0].y); b = Math.max(b, s.series[s.series.length - 1].y); }
    return { first: a, last: b };
  }, [result]);

  const mine = new Set(picks);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Filter>
          label="League"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[{ value: "all", label: "All" }, ...LEAGUES.map((l) => ({ value: l as Filter, label: l }))]}
        />
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-raised px-3 sm:max-w-[240px]">
          <Search size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search teams or cities"
            className="w-full min-w-0 bg-transparent text-[14px] outline-none placeholder:text-ink-3"
          />
        </label>
        {rows.length !== result.teams.length && <span className="num ml-auto text-[12px] text-ink-3">{rows.length} of {result.teams.length} teams</span>}
      </div>

      <div className="mt-4" role="table" aria-label="Team rankings">
        <div role="row" className={clsx(GRID, "sticky top-14 z-10 h-10 border-b border-line-2 bg-bg px-2 text-[12px] text-ink-3")}>
          <span role="columnheader" className="text-right">#</span>
          <span role="columnheader">Team</span>
          {COLS.map((c) => {
            const active = sort.key === c.key;
            return (
              <button
                key={c.key}
                type="button"
                role="columnheader"
                title={c.title}
                aria-sort={active ? (sort.dir === -1 ? "descending" : "ascending") : "none"}
                onClick={() => setSort({ key: c.key, dir: active ? (sort.dir === -1 ? 1 : -1) : -1 })}
                className={clsx(
                  "flex h-10 items-center justify-end gap-1 whitespace-nowrap transition-colors duration-150 hover:text-ink",
                  c.hide,
                  // The luck figure sits left of the row chevron, so its header stops there too.
                  c.key === "rank" && "md:pr-[22px]",
                  active && "text-ink",
                )}
              >
                {active && (sort.dir === -1 ? <ArrowDown size={12} strokeWidth={1.5} /> : <ArrowUp size={12} strokeWidth={1.5} />)}
                {c.label}
              </button>
            );
          })}
        </div>

        <div>
          {rows.map((s) => {
            const isOpen = open === s.team.key;
            const isMine = mine.has(s.team.key);
            return (
              <motion.div key={s.team.key} layout="position" transition={{ duration: 0.45, ease: EASE }} role="row" className="border-b border-line">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : s.team.key)}
                  className={clsx(
                    GRID,
                    "relative h-12 w-full rounded-[8px] px-2 text-left transition-colors duration-150 hover:bg-raised",
                    isMine && "bg-raised",
                  )}
                >
                  {isMine && <span className="absolute inset-y-2 left-0 w-[3px] rounded-[2px] bg-accent" />}
                  <span className="num text-right text-[13px] text-ink-3">{s.rank}</span>
                  <span className="flex min-w-0 items-center gap-2 md:gap-3">
                    <Logo team={s.team} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] leading-5 text-ink"><span className="sm:hidden">{s.team.nick}</span><span className="max-sm:hidden">{s.team.name}</span></span>
                      <span className="num block truncate text-[12px] leading-4 text-ink-3">
                        {s.team.league} · {s.team.metro}
                      </span>
                    </span>
                  </span>
                  <span className="num hidden text-right text-[13px] text-ink-2 lg:block">{s.seasons}</span>
                  <span className="num text-right text-[13px] text-ink">{pct(s.pct)}</span>
                  <span className="num hidden text-right text-[13px] text-ink-2 md:block">{signed(s.z)}</span>
                  <span className="num hidden text-right text-[13px] text-ink-2 lg:block">{signed(s.avgZ)}</span>
                  <span className="num hidden text-right text-[13px] text-ink-2 lg:block">{s.elite}</span>
                  <span className="num hidden text-right text-[13px] text-ink-2 lg:block">{s.dud}</span>
                  <span className="num flex items-center justify-end gap-1 text-[13px] text-ink">
                    {s.titles > 0 && <Pennant size={10} className="text-accent" />}
                    {s.titles || <span className="text-ink-3">0</span>}
                  </span>
                  <span className="num hidden text-right text-[13px] text-ink-2 xl:block">{s.finalsLost}</span>
                  <span className="flex items-center justify-end gap-2">
                    <span className="hidden h-2 flex-1 overflow-hidden rounded-[2px] bg-raised md:block">
                      <span className="block h-full origin-left rounded-[2px] transition-[transform,background-color] duration-500 ease-out" style={{ transform: `scaleX(${Math.max(0.02, s.index / 100)})`, background: heatIndex(s.index) }} />
                    </span>
                    <span className="num w-7 text-right text-[13px] text-ink">{Math.round(s.index)}</span>
                    <ChevronDown size={14} strokeWidth={1.5} className={clsx("text-ink-3 transition-transform duration-200 max-md:hidden", isOpen && "rotate-180")} />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="px-2 pb-4 pt-1 md:pl-[60px]"
                    >
                      <Tape league={s.team.league} series={s.series} first={first} last={last} />
                      <p className="num mt-2 text-[12px] leading-4 text-ink-3">
                        {record(s.w, s.l, s.t)} over {s.seasons} seasons · #{s.leagueRank} in the {s.team.league} · {s.elite} great, {s.dud} awful · {s.finalsLost} finals lost
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          {rows.length === 0 && <p className="py-12 text-center text-[14px] text-ink-3">No team matches “{query}”</p>}
        </div>
      </div>
    </div>
  );
}
