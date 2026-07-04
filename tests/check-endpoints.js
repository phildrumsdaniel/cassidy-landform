#!/usr/bin/env node
/*
 * tests/check-endpoints.js — external data-dependency health check for the Placona map.
 * Runs in CI (GitHub runners have internet). Critical deps assert 200; constraint-layer
 * queries are verified against the ACTUAL query shapes the map uses.
 */
const HEADERS = {
  "User-Agent": "LandformCI/1.0 (+https://phildrumsdaniel.github.io/cassidy-landform)",
  "Accept": "*/*"
};
const DATASETS = ["green-belt", "conservation-area", "area-of-outstanding-natural-beauty", "listed-building"];
// A small bbox over the Coventry/Meriden green belt (WKT, lon lat order).
const BBOX_WKT = "POLYGON((-1.62 52.40,-1.48 52.40,-1.48 52.47,-1.62 52.47,-1.62 52.40))";
const geojsonQuery = (ds) =>
  `https://www.planning.data.gov.uk/entity.geojson?dataset=${ds}&geometry_relation=intersects&geometry=${encodeURIComponent(BBOX_WKT)}&limit=10`;

async function hit(url) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, { headers: HEADERS, redirect: "follow", signal: ctrl.signal });
    clearTimeout(timer);
    const type = r.headers.get("content-type") || "";
    let body = null;
    if (/json/.test(type)) { try { body = await r.json(); } catch (e) {} }
    return { status: r.status, ok: r.ok, type, ms: Date.now() - t0, body };
  } catch (e) {
    return { status: 0, ok: false, type: "", ms: Date.now() - t0, err: (e && e.message) || String(e) };
  }
}
const mark = (r) => (r.ok ? "✅" : (r.status === 0 ? "🔌" : "❌"));

const CRITICAL = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.min.js",
  "https://tile.openstreetmap.org/9/254/173.png",
  "https://api.postcodes.io/postcodes/SW1A%201AA",   // a valid full postcode
  "https://api.postcodes.io/outcodes/CV8"
];

(async () => {
  let hardFail = 0;
  console.log("\n=== CRITICAL app dependencies (assert 200) ===");
  for (const u of CRITICAL) {
    const r = await hit(u);
    console.log(`${mark(r)} ${String(r.status).padEnd(3)} ${String(r.ms).padStart(5)}ms  ${u}`);
    if (!r.ok) hardFail++;
  }

  console.log("\n=== planning.data.gov.uk constraint layers — GeoJSON bbox query (the shape the map uses) ===");
  let pdFail = 0;
  for (const ds of DATASETS) {
    const r = await hit(geojsonQuery(ds));
    const n = (r.body && r.body.features) ? r.body.features.length : "n/a";
    console.log(`${mark(r)} ${String(r.status).padEnd(3)} features=${String(n).padEnd(4)} ${String(r.ms).padStart(5)}ms  ${ds}`);
    if (!r.ok) pdFail++;
  }

  console.log("\n=== Environment Agency ArcGIS — discover the flood service ===");
  for (const folder of ["https://environment.data.gov.uk/arcgis/rest/services?f=json",
                        "https://environment.data.gov.uk/arcgis/rest/services/EA?f=json"]) {
    const r = await hit(folder);
    console.log(`${mark(r)} ${String(r.status).padEnd(3)}  ${folder}`);
    if (r.body) {
      const services = (r.body.services || []).map((s) => s.name);
      const folders = r.body.folders || [];
      const flood = services.filter((n) => /flood/i.test(n));
      if (folders.length) console.log("   folders: " + folders.join(", "));
      if (flood.length)   console.log("   FLOOD services: " + flood.join(", "));
      else if (services.length) console.log("   services(sample): " + services.slice(0, 8).join(", "));
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(pdFail ? `⚠ ${pdFail}/4 planning.data GeoJSON queries failed` : "✅ all 4 planning.data GeoJSON queries OK");
  if (hardFail > 0) { console.log(`❌ ${hardFail} CRITICAL dependency(ies) failed.`); process.exit(1); }
  console.log("✅ All critical dependencies healthy.");
})();
