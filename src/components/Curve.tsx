"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { EASE } from "./ui";

const W = 1000;
const H = 240;
const PAD = { l: 40, r: 6, t: 16, b: 28 };

/**
 * Fan luck for every possible birth year, for the teams picked.
 * Hover to read a year, click to move the dial there.
 */
export function Curve({
  points, current, onPick,
}: {
  points: { y: number; index: number }[];
  current: number | null;
  onPick: (y: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const min = points[0].y;
  const max = points[points.length - 1].y;
  const x = (y: number) => PAD.l + ((y - min) / (max - min)) * (W - PAD.l - PAD.r);
  const yy = (v: number) => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.y).toFixed(1)} ${yy(p.index).toFixed(1)}`).join(" ");
  const byYear = new Map(points.map((p) => [p.y, p]));
  const at = (y: number | null) => (y == null ? undefined : byYear.get(Math.max(min, Math.min(max, y))));
  const cur = at(current);
  const hov = at(hover);
  const best = points.reduce((a, p) => (p.index > a.index ? p : a));
  const worst = points.reduce((a, p) => (p.index < a.index ? p : a));

  const yearAt = (clientX: number) => {
    const box = ref.current!.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * W;
    return Math.round(min + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (max - min));
  };
  const decades: number[] = [];
  for (let y = Math.ceil(min / 20) * 20; y <= max; y += 20) decades.push(y);

  return (
    <section aria-label="Luck by birth year" className="rounded-[16px] border border-line bg-card p-6 md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-[15px] font-medium text-ink">If you had been born another year</h3>
        <p className="num h-5 text-[13px] leading-5 text-ink-2">
          {hov ? (
            <>Born {hov.y}: {Math.round(hov.index)}</>
          ) : (
            <>Luckiest {best.y} ({Math.round(best.index)}) · unluckiest {worst.y} ({Math.round(worst.index)})</>
          )}
        </p>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 block w-full cursor-crosshair touch-pan-y select-none overflow-visible"
        role="img"
        aria-label={`Fan luck by birth year from ${min} to ${max}. Highest for ${best.y}, lowest for ${worst.y}.`}
        onPointerMove={(e) => setHover(yearAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onPick(Math.max(min, Math.min(max, yearAt(e.clientX))))}
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yy(v)} y2={yy(v)} stroke="var(--line)" strokeDasharray={v === 50 ? "0" : "2 4"} />
            <text x={0} y={yy(v) + 4} textAnchor="start" className="num" fontSize="12" fill="var(--text-3)">{v}</text>
          </g>
        ))}
        {decades.map((y) => (
          <text key={y} x={x(y)} y={H - 6} textAnchor="middle" className="num" fontSize="12" fill="var(--text-3)">{y}</text>
        ))}
        <motion.path
          d={d}
          fill="none"
          stroke="var(--text)"
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={false}
          animate={{ d }}
          transition={{ duration: 0.5, ease: EASE }}
        />
        {hov && <line x1={x(hov.y)} x2={x(hov.y)} y1={PAD.t} y2={H - PAD.b} stroke="var(--line-2)" />}
        {hov && <circle cx={x(hov.y)} cy={yy(hov.index)} r="4" fill="var(--card)" stroke="var(--text)" strokeWidth="1.5" />}
        {cur && (
          <motion.g initial={false} animate={{ x: x(cur.y), y: yy(cur.index) }} transition={{ duration: 0.5, ease: EASE }}>
            <circle r="6" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
          </motion.g>
        )}
      </svg>
      <p className="mt-2 text-[13px] leading-5 text-ink-3">Same teams, different birthday. Click a year to move there</p>
    </section>
  );
}
