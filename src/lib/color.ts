/** Red to green fill for a season, from its z-score: bad years red, good years green. Theme aware through CSS variables. */
export function heat(z: number): string {
  const p = Math.round(Math.min(1, Math.abs(z) / 2.2) ** 0.8 * 100);
  if (p < 4) return "var(--heat-0)";
  return `color-mix(in oklab, var(${z >= 0 ? "--good" : "--bad"}) ${p}%, var(--heat-0))`;
}

/** Same scale for a 0 to 100 index, centred on 50. */
export function heatIndex(index: number): string {
  return heat(((index - 50) / 50) * 2.2);
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Picks whichever team colour reads against the page, with ink for text placed on it. */
export function teamAccent(color: string, alt: string, dark: boolean): { accent: string; ink: string } | null {
  const bg = dark ? "#131312" : "#f6f5f2";
  const ok = (c: string) => /^#[0-9a-f]{6}$/i.test(c) && contrast(c, bg) >= 3.2;
  const accent = ok(color) ? color : ok(alt) ? alt : null;
  if (!accent) return null;
  return { accent, ink: contrast(accent, "#ffffff") >= 4.5 ? "#ffffff" : "#16130f" };
}
