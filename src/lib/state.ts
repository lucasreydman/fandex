import { DEFAULT_WEIGHTS } from "./engine";
import { LEAGUES } from "./types";
import type { Dataset, League, Options, Weights } from "./types";

export type Mode = "birth" | "all" | "custom";
export type Tab = "rankings" | "seasons" | "cities";
export type Picks = Record<League, string | null>;

export interface State {
  mode: Mode;
  /** Birth year in "birth" mode, first season in "custom" mode. */
  year: number;
  to: number;
  /** Start counting at age six, when a fan starts to remember. */
  memory: boolean;
  picks: Picks;
  weights: Weights;
  halfLife: number;
  includeLive: boolean;
  teamColors: boolean;
  tab: Tab;
}

export const EMPTY_PICKS: Picks = { NFL: null, NBA: null, MLB: null, NHL: null };

export function defaults(max: number): State {
  return {
    mode: "birth", year: 2005, to: max, memory: false, picks: { ...EMPTY_PICKS },
    weights: { ...DEFAULT_WEIGHTS }, halfLife: 0, includeLive: false, teamColors: true, tab: "rankings",
  };
}

export function toOptions(s: State, min: number, max: number): Options {
  const from = s.mode === "all" ? min : s.mode === "birth" ? Math.min(max, s.year + (s.memory ? 6 : 0)) : s.year;
  const to = s.mode === "custom" ? Math.max(from, s.to) : max;
  return { from, to, includeLive: s.includeLive, weights: s.weights, halfLife: s.halfLife };
}

export function encode(s: State, max: number): string {
  const p = new URLSearchParams();
  if (s.mode === "all") p.set("era", "all");
  else {
    p.set("y", String(s.year));
    if (s.mode === "custom") p.set("to", String(s.to));
    else if (s.memory) p.set("age", "6");
  }
  const picks = LEAGUES.map((l) => s.picks[l]).filter(Boolean);
  if (picks.length) p.set("t", picks.join("."));
  const w = s.weights;
  if (w.record !== DEFAULT_WEIGHTS.record || w.consistency !== DEFAULT_WEIGHTS.consistency || w.titles !== DEFAULT_WEIGHTS.titles) {
    p.set("w", `${w.record}.${w.consistency}.${w.titles}`);
  }
  if (s.halfLife) p.set("r", String(s.halfLife));
  if (s.includeLive) p.set("live", "1");
  if (s.tab !== "rankings") p.set("tab", s.tab);
  void max;
  const q = p.toString();
  return q ? `?${q}` : "";
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function decode(search: string, base: State, data: Dataset, min: number, max: number): State {
  const p = new URLSearchParams(search);
  if (![...p.keys()].length) return base;
  const s: State = { ...base, picks: { ...EMPTY_PICKS }, weights: { ...DEFAULT_WEIGHTS }, halfLife: 0, includeLive: false, memory: false, mode: "birth", tab: "rankings" };
  const y = Number(p.get("y"));
  if (p.get("era") === "all") s.mode = "all";
  else if (Number.isFinite(y) && y > 0) {
    s.year = clamp(Math.round(y), min, max);
    const to = Number(p.get("to"));
    if (p.has("to") && Number.isFinite(to)) { s.mode = "custom"; s.to = clamp(Math.round(to), s.year, max); }
    else s.memory = p.get("age") === "6";
  }
  const byKey = new Map(data.teams.map((t) => [t.key, t]));
  for (const key of (p.get("t") ?? "").split(".")) {
    const t = byKey.get(key);
    if (t) s.picks[t.league] = t.key;
  }
  const w = (p.get("w") ?? "").split(".").map(Number);
  if (w.length === 3 && w.every((n) => Number.isFinite(n) && n >= 0) && w.some((n) => n > 0)) {
    s.weights = { record: clamp(w[0], 0, 100), consistency: clamp(w[1], 0, 100), titles: clamp(w[2], 0, 100) };
  }
  const r = Number(p.get("r"));
  if ([6, 15].includes(r)) s.halfLife = r;
  s.includeLive = p.get("live") === "1";
  const tab = p.get("tab");
  if (tab === "seasons" || tab === "cities") s.tab = tab;
  return s;
}

const KEY = "fandex:v1";

/** True when this browser has been here before. */
export function hasVisited(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return true; // storage blocked: don't nag on every load
  }
}

export function load(base: State, data: Dataset, min: number, max: number): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as { q?: string; teamColors?: boolean };
    const s = saved.q ? decode(saved.q, base, data, min, max) : base;
    return { ...s, teamColors: saved.teamColors ?? base.teamColors };
  } catch {
    return base;
  }
}

export function save(s: State, max: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ q: encode(s, max), teamColors: s.teamColors }));
  } catch {
    /* private mode or blocked storage: the URL still carries the state */
  }
}
