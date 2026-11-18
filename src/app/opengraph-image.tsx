import { ImageResponse } from "next/og";

export const alt = "Fandex: every season, every team, one scale";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// A strip of seasons, red for bad years and green for good, the way the site draws a team's history.
const TAPE = [-1.6, -0.9, -0.2, 0.4, -1.1, 0.3, 1.2, 1.9, 0.8, 1.5, 2.1, 0.6, -0.4, 0.9, 1.7, 0.2, -0.8, -1.5, 0.5, 1.3];
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
const fill = (z: number) => mix([44, 44, 41], z >= 0 ? [55, 168, 107] : [229, 89, 60], Math.min(1, Math.abs(z) / 2.2) ** 0.8);

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#131312", color: "#eeece6", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34 }}>
          <svg width="34" height="34" viewBox="0 0 10 10">
            <path d="M1 0.5v9" stroke="#eeece6" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M1.6 1.2 9.4 3.6 1.6 6z" fill="#ee6a4d" />
          </svg>
          Fandex
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 104, lineHeight: 1, letterSpacing: -2 }}>Every season, one scale</div>
          <div style={{ fontSize: 34, color: "#aaa69d", marginTop: 24 }}>Nine pro leagues since 1903. Pick your teams and your years</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {TAPE.map((z, i) => (
            <div key={i} style={{ flex: 1, height: 56, borderRadius: 4, background: fill(z) }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
