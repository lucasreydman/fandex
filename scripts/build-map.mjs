// Draws the North America base map once and stores it as plain SVG paths in
// src/data/map.json, so the browser never loads a geo library.
// Shapes: Natural Earth 1:50m (public domain). Usage: node scripts/build-map.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoConicEqualArea, geoPath } from "d3-geo";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NE = "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson";
const W = 1000, H = 640, PAD = 44;

const get = async (f) => {
  const r = await fetch(`${NE}/${f}`);
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  return r.json();
};

const [countries, lakes, lines, src] = await Promise.all([
  get("ne_50m_admin_0_countries.geojson"),
  get("ne_50m_lakes.geojson"),
  get("ne_50m_admin_1_states_provinces_lines.geojson"),
  readFile(path.join(ROOT, "scripts", "source", "metros.json"), "utf8").then(JSON.parse),
]);

const points = { type: "MultiPoint", coordinates: Object.values(src.metros).map((m) => [m.lon, m.lat]) };
const projection = geoConicEqualArea().parallels([29.5, 49]).rotate([96, 0]).center([0, 40])
  .fitExtent([[PAD, PAD], [W - PAD, H - PAD]], points)
  .clipExtent([[0, 0], [W, H]]);
const draw = geoPath(projection).digits(1);

const near = (f) => { const c = draw.centroid(f); return c[0] > -400 && c[0] < W + 400 && c[1] > -400 && c[1] < H + 400; };
const collect = (features) => ({ type: "FeatureCollection", features });
const home = new Set(["USA", "CAN"]);
const iso = (f) => f.properties.ADM0_A3 ?? f.properties.adm0_a3;

const out = {
  w: W, h: H,
  land: draw(collect(countries.features.filter((f) => home.has(iso(f))))),
  other: draw(collect(countries.features.filter((f) => !home.has(iso(f)) && near(f)))),
  lakes: draw(collect(lakes.features.filter((f) => (f.properties.scalerank ?? 9) <= 1 && near(f)))),
  states: draw(collect(lines.features.filter((f) => home.has(iso(f))))),
  metros: Object.fromEntries(Object.entries(src.metros).map(([name, m]) => [name, projection([m.lon, m.lat]).map((v) => +v.toFixed(1))])),
};
const file = path.join(ROOT, "src", "data", "map.json");
await writeFile(file, JSON.stringify(out));
console.log("map.json", Object.entries(out).map(([k, v]) => `${k}:${typeof v === "string" ? v.length : "-"}`).join(" "));
