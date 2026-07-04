#!/usr/bin/env node
/*
 * tests/check-endpoints.js — external data-dependency health check for the Placona map.
 *
 * The map depends on third-party services (CDN libs, map tiles, geocoding, and the free
 * government constraint layers). Those can 404/503/move without any change to our code —
 * exactly the breakage a headless engine test can't see. This runs in CI (GitHub runners
 * have internet, unlike the dev sandbox) and pings each dependency.
 *
 *  • CRITICAL deps (app won't work without them) → assert 200, FAIL the build if down.
 *  • CONSTRAINT-layer candidates → report only. We probe several URL shapes per layer so
 *    the CI log tells us which one actually serves data (used to fix/verify the layer URLs).
 *
 * Run:  node tests/check-endpoints.js
 */
const HEADERS = {
  "User-Agent": "LandformCI/1.0 (+https://phildrumsdaniel.github.io/cassidy-landform)",
  "Accept": "*/*"
};
// A z9 tile roughly over the Chilterns AONB (good place to expect Green Belt / AONB data).
const Z = 9, X = 254, Y = 173;
const DATASETS = ["green-belt", "conservation-area", "area-of-outstanding-natural-beauty", "listed-building"];

async function hit(url) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, { headers: HEADERS, redirect: "follow", signal: ctrl.signal });
    clearTimeout(timer);
    const type = r.headers.get("content-type") || "";
    const len = r.headers.get("content-length") || "?";
    return { status: r.status, ok: r.ok, type, len, ms: Date.now() - t0 };
  } catch (e) {
    return { status: 0, ok: false, type: "", len: "", ms: Date.now() - t0, err: (e && e.message) || String(e) };
  }
}
function fmt(u, r) {
  const mark = r.ok ? "✅" : (r.status === 0 ? "🔌" : "❌");
  return `${mark} ${String(r.status).padEnd(3)} ${(r.type || r.err || "").slice(0, 40).padEnd(40)} ${String(r.ms).padStart(5)}ms  ${u}`;
}

const CRITICAL = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.min.js",
  `https://tile.openstreetmap.org/${Z}/${X}/${Y}.png`,
  "https://api.postcodes.io/postcodes/CV8%203",
  "https://api.postcodes.io/outcodes/CV8"
];

// Candidate URL shapes for the planning.data.gov.uk constraint layers.
function planningCandidates(ds) {
  return [
    `https://www.planning.data.gov.uk/tiles/${ds}/${Z}/${X}/${Y}.vector.pbf`,   // current (404 in prod)
    `https://www.planning.data.gov.uk/tiles/${ds}/${Z}/${X}/${Y}.pbf`,
    `https://www.planning.data.gov.uk/tiles/${ds}/${Z}/${X}/${Y}.mvt`,
    `https://www.planning.data.gov.uk/entity.geojson?dataset=${ds}&limit=1`,     // GeoJSON entity API
    `https://www.planning.data.gov.uk/entity.json?dataset=${ds}&limit=1`
  ];
}
// Candidate flood endpoints (Environment Agency).
const FLOOD_CANDIDATES = [
  "https://environment.data.gov.uk/spatialdata/flood-map-for-planning-rivers-and-sea-flood-zone-2/wms?service=WMS&request=GetCapabilities",
  "https://environment.data.gov.uk/spatialdata/flood-map-for-planning-rivers-and-sea-flood-zone-3/wms?service=WMS&request=GetCapabilities",
  "https://environment.data.gov.uk/arcgis/rest/services?f=json",
  "https://environment.data.gov.uk/arcgis/rest/services/EA/FloodMapForPlanningRiversAndSeaFloodZones2and3/MapServer?f=json"
];

(async () => {
  let hardFail = 0;
  console.log("\n=== CRITICAL app dependencies (assert 200) ===");
  for (const u of CRITICAL) {
    const r = await hit(u);
    console.log(fmt(u, r));
    if (!r.ok) hardFail++;
  }

  console.log("\n=== planning.data.gov.uk constraint layers — candidate URL shapes (report only) ===");
  for (const ds of DATASETS) {
    console.log(`  -- ${ds} --`);
    for (const u of planningCandidates(ds)) console.log("   " + fmt(u, await hit(u)));
  }

  console.log("\n=== Environment Agency flood — candidate endpoints (report only) ===");
  for (const u of FLOOD_CANDIDATES) console.log("   " + fmt(u, await hit(u)));

  console.log("\n=== SUMMARY ===");
  if (hardFail > 0) {
    console.log(`❌ ${hardFail} CRITICAL dependency(ies) failed — the map cannot work until these are back.`);
    process.exit(1);
  }
  console.log("✅ All critical dependencies healthy. Review the constraint-layer probes above for the working URL shape.");
})();
