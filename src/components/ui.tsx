"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { createContext, useContext, useId } from "react";
import type { ReactNode } from "react";
import { contrast } from "@/lib/color";
import type { Team } from "@/lib/types";

export const EASE = [0.22, 1, 0.36, 1] as const;
export const ThemeContext = createContext<"light" | "dark">("light");

export function Logo({ team, size = 24, className }: { team: Team; size?: number; className?: string }) {
  const theme = useContext(ThemeContext);
  const src = theme === "dark" ? team.logoDark ?? team.logo : team.logo;
  // No artwork in the feed for this club: a plain monogram in its place.
  if (!src) {
    return (
      <span
        aria-hidden
        className={clsx("num grid shrink-0 place-items-center rounded-full font-medium", className)}
        style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.3)), background: team.color, color: contrast(team.color, "#ffffff") >= 4.5 ? "#ffffff" : "#16130f" }}
      >
        {team.abbr.slice(0, 3)}
      </span>
    );
  }
  return (
    // Logos are served by the league data provider; plain img keeps them out of the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={clsx("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** The title mark: a small pennant. Used wherever a championship is counted. */
export function Pennant({ size = 10, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden className={clsx("shrink-0", className)}>
      <path d="M1 0.5v9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M1.6 1.2 9.4 3.6 1.6 6z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-ink">
      <Pennant size={16} className="text-accent" />
      <span className="display text-[20px] tracking-[0.01em]">Fandex</span>
    </span>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label, size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-[10px] bg-raised p-1 [scrollbar-width:none]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "relative shrink-0 rounded-[6px] px-3 font-medium transition-colors duration-150",
              size === "sm" ? "h-7 text-[13px]" : "h-8 text-[14px]",
              active ? "text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[6px] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-line"
                transition={{ duration: 0.3, ease: EASE }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-2 text-left text-[14px] text-ink-2 transition-colors duration-150 hover:text-ink"
    >
      <span
        className={clsx(
          "relative h-5 w-8 shrink-0 rounded-[10px] transition-colors duration-150",
          checked ? "bg-ink" : "bg-line-2",
        )}
      >
        <span
          className={clsx(
            "absolute left-0.5 top-0.5 size-4 rounded-full bg-card transition-transform duration-150 ease-out",
            checked && "translate-x-3",
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-[10px] text-ink-2 transition-[background-color,color,transform] duration-150 hover:bg-raised hover:text-ink active:scale-[0.97]"
    >
      {children}
    </button>
  );
}

/** Batting-average style: .575, 1.000 */
export function pct(v: number): string {
  if (!Number.isFinite(v)) return "–";
  const s = v.toFixed(3);
  return v >= 1 ? s : s.replace(/^0/, "");
}

export function signed(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "–";
  const s = Math.abs(v).toFixed(digits);
  return `${v < 0 ? "−" : "+"}${s}`;
}

export function record(w: number, l: number, t = 0): string {
  return t ? `${w}-${l}-${t}` : `${w}-${l}`;
}
