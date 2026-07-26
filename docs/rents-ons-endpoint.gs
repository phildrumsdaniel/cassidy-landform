/**
 * Cassidy Landform Backend — action: rents_ons
 * =============================================
 * LIVE per-local-authority rents for ANY local authority, from ONS's
 * Price Index of Private Rents (PIPR — the successor to the discontinued VOA
 * Private Rental Market Statistics). No bundled rent table: it resolves the site
 * to an ONS local-authority GSS code, fetches that LA's ONS local housing page
 * server-side, and parses the four bedroom-category rents out of the page text.
 *
 * Paste into the "Cassidy Landform Backend" Apps Script (merge doPost if you
 * already have one). The Capitalisation "🔗 Fetch live rents (my endpoint)" button
 * works with NO Landform front-end change — the default action is rents_ons and the
 * response matches the existing contract.
 *
 * CONTRACT
 *   Request  (POST, JSON body):
 *     { postcode, localAuthority, town, beds:[1,2,3,4], scheme, action:"rents_ons" }
 *     (action optional — defaults to rents_ons; postcode is the most reliable input)
 *   Response (JSON):
 *     { rent1, rent2, rent3, rent4, source:"ONS PIPR, <month year>", asOf, gss, laName, warning }
 *
 * RESOLUTION
 *   1) postcode  -> postcodes.io -> codes.admin_district (GSS)   [best: current, handles LA reorganisations]
 *   2) LA / town name -> ONS's published LAD names-and-codes lookup (fetched + cached)
 *   GSS -> https://www.ons.gov.uk/visualisations/housingpriceslocal/<GSS>/  -> parse rents.
 *
 * KNOWN UNRELIABLE CASES (also returned in the "warning" field per request):
 *   • Northern Ireland (N-codes): ONS PIPR has no local page for NI districts — use NISRA instead.
 *   • Isles of Scilly (E06000053) / City of London (E09000001): rent data is usually suppressed.
 *   • Name-only input for ambiguous/renamed LAs ("Bristol" vs "Bristol, City of",
 *     "Herefordshire, County of", "Kingston upon Hull, City of", "Durham"/"County Durham"):
 *     tolerant matching helps but a full POSTCODE is materially more reliable.
 *   • Outcode-only postcodes: a district can span >1 LA — resolves to the first, flagged.
 *   • ONS annual geography refresh can change the LAD lookup service URL (name path only —
 *     postcode path is unaffected); and an ONS page redesign could change the parse pattern
 *     (returns a clear parse-error warning rather than wrong numbers).
 */

function doPost(e) {
  var req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) {}
  var action = req.action || "rents_ons";
  var out;
  try {
    if (action === "rents_ons") out = rentsOns_(req);
    else out = { error: "unknown action: " + action };
  } catch (err) {
    out = { source: "endpoint error: " + ((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true, action: "rents_ons",
    usage: "POST {postcode, localAuthority, town} -> {rent1..4, source, gss, laName, warning}"
  })).setMimeType(ContentService.MimeType.JSON);
}

// ── Main ────────────────────────────────────────────────────────────────────
function rentsOns_(req) {
  var r = resolveGss_(req);
  if (!r.gss) {
    return { source: "ONS: couldn't resolve a local authority",
             warning: r.warning || "Supply a full postcode (best) or an exact LA name." };
  }
  var cache = CacheService.getScriptCache(), ckey = "onsrent_" + r.gss, hit = cache.get(ckey);
  if (hit) {
    var o = JSON.parse(hit);
    if (r.laName) o.laName = r.laName;
    if (r.warning) o.warning = mergeWarn_(o.warning, r.warning);
    return o;
  }
  var p = fetchOnsRents_(r.gss); // {rent1..4, asOf, partial} or throws
  var out = {
    rent1: p.rent1, rent2: p.rent2, rent3: p.rent3, rent4: p.rent4,
    source: "ONS PIPR" + (p.asOf ? ", " + p.asOf : ""),
    asOf: p.asOf || "", gss: r.gss, laName: r.laName || ""
  };
  if (r.warning) out.warning = mergeWarn_(out.warning, r.warning);
  if (p.partial) out.warning = mergeWarn_(out.warning, "some bedroom sizes were missing/suppressed on the ONS page");
  cache.put(ckey, JSON.stringify(out), 21600); // 6h — ONS updates monthly, this is plenty
  return out;
}

function mergeWarn_(a, b) { return a ? (a + "; " + b) : b; }

// ── Resolve to an ONS GSS local-authority code ──────────────────────────────
function resolveGss_(req) {
  var pcRaw = String(req.postcode || "").trim();
  var pc = pcRaw.replace(/\s+/g, "").toUpperCase();
  // 1) Full postcode → postcodes.io → GSS admin_district code
  if (pc) {
    try {
      var res = UrlFetchApp.fetch("https://api.postcodes.io/postcodes/" + encodeURIComponent(pc),
                                  { muteHttpExceptions: true });
      if (res.getResponseCode() == 200) {
        var d = JSON.parse(res.getContentText()), rr = d && d.result;
        var gss = rr && rr.codes && rr.codes.admin_district, nm = rr && rr.admin_district;
        if (gss && /^[EWSN]\d{8}$/.test(gss)) return gssResult_(gss, nm);
      }
    } catch (err) {}
    // 1b) outcode fallback (district can span >1 LA — first match, flagged)
    try {
      var oc = pcRaw.split(/\s+/)[0];
      var r2 = UrlFetchApp.fetch("https://api.postcodes.io/outcodes/" + encodeURIComponent(oc),
                                 { muteHttpExceptions: true });
      if (r2.getResponseCode() == 200) {
        var d2 = JSON.parse(r2.getContentText());
        var name = d2 && d2.result && d2.result.admin_district && d2.result.admin_district[0];
        if (name) {
          var g = nameToGss_(name);
          if (g) { var o = gssResult_(g, name);
            o.warning = mergeWarn_(o.warning, "resolved from OUTCODE only (" + oc + ") — supply a full postcode for the exact LA");
            return o; }
        }
      }
    } catch (err2) {}
  }
  // 2) LA / town name → ONS name-to-code lookup
  var nmIn = String(req.localAuthority || req.town || "").trim();
  if (nmIn) {
    var g2 = nameToGss_(nmIn);
    if (g2) { var o2 = gssResult_(g2, nmIn);
      o2.warning = mergeWarn_(o2.warning, "resolved from NAME (‘" + nmIn + "’) — a postcode is more reliable");
      return o2; }
  }
  return { gss: "", warning: "Provide a full postcode (best) or an exact local-authority name." };
}

function gssResult_(gss, name) {
  var w = "";
  if (/^N/.test(gss)) w = "Northern Ireland — ONS PIPR has no local page for NI districts; use NISRA. Result likely empty.";
  else if (gss === "E06000053" || gss === "E09000001")
    w = "Very small/atypical LA (Isles of Scilly / City of London) — ONS rent data is often suppressed.";
  return { gss: gss, laName: name || "", warning: w };
}

// ── ONS name → GSS, via ONS's published LAD names-and-codes lookup ──────────
// Fetched from the ONS Open Geography Portal and cached 6h. The service is
// versioned (LAD<yy>); if name resolution stops working after an ONS annual
// refresh, update LAD_LOOKUP_URL. Postcode resolution above is unaffected.
var LAD_LOOKUP_URL = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_December_2024_Boundaries_UK_BUC/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&f=json";

function nameToGss_(name) {
  var map = ladNameMap_(), key = normName_(name);
  if (map[key]) return map[key];
  var alts = [
    key.replace(/\b(city of|county of|london borough of|royal borough of|borough of)\b/g, "").trim(),
    key + ", city of", "city of " + key,
    key.replace(/^county /, ""), "county " + key,
    key + ", county of"
  ];
  for (var i = 0; i < alts.length; i++) { var a = normName_(alts[i]); if (a && map[a]) return map[a]; }
  return "";
}

function ladNameMap_() {
  var cache = CacheService.getScriptCache(), hit = cache.get("lad_map_v1");
  if (hit) return JSON.parse(hit);
  var map = {};
  try {
    var res = UrlFetchApp.fetch(LAD_LOOKUP_URL, { muteHttpExceptions: true });
    if (res.getResponseCode() == 200) {
      var d = JSON.parse(res.getContentText()), feats = (d && d.features) || [];
      feats.forEach(function (f) {
        var at = f.attributes || {}, cd = "", nm = "";
        for (var k in at) {
          if (/CD$/i.test(k) && /^[EWSN]\d{8}$/.test(String(at[k]))) cd = at[k];
          if (/NM$/i.test(k) && !/NMW$/i.test(k) && at[k]) nm = at[k]; // NM = English name; skip NMW (Welsh)
        }
        if (cd && nm) map[normName_(nm)] = cd;
      });
    }
  } catch (err) {}
  cache.put("lad_map_v1", JSON.stringify(map), 21600);
  return map;
}

function normName_(s) {
  return String(s || "").toLowerCase().replace(/[’',.]/g, "").replace(/\s+/g, " ").trim();
}

// ── Fetch the ONS local housing page and parse the four rents ───────────────
function fetchOnsRents_(gss) {
  var url = "https://www.ons.gov.uk/visualisations/housingpriceslocal/" + gss + "/";
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true,
    headers: { "User-Agent": "Mozilla/5.0 (CassidyLandform rents; +ons pipr)" } });
  var code = res.getResponseCode();
  if (code != 200) throw new Error("ONS page HTTP " + code + " for " + gss + " (LA may not have a PIPR local page)");
  var txt = res.getContentText().replace(/&pound;/gi, "£").replace(/&#163;/g, "£");
  function pick(re) { var m = txt.match(re); return m ? parseInt(m[1].replace(/[,\s]/g, ""), 10) : 0; }
  // "One bedroom: £802" etc. Non-greedy gap (<=40 chars) tolerates markup between label and value.
  var r1 = pick(/one bedroom[\s\S]{0,40}?£\s*([\d,]+)/i);
  var r2 = pick(/two bedrooms?[\s\S]{0,40}?£\s*([\d,]+)/i);
  var r3 = pick(/three bedrooms?[\s\S]{0,40}?£\s*([\d,]+)/i);
  var r4 = pick(/four or more bedrooms?[\s\S]{0,40}?£\s*([\d,]+)/i);
  if (!(r1 || r2 || r3 || r4))
    throw new Error("couldn't parse rents from the ONS page for " + gss + " (page format may have changed)");
  // Period, e.g. "in the 12 months to June 2026" / "as at June 2026".
  var asOf = "";
  var pm = txt.match(/(?:12 months to|as at|to)\s+([A-Z][a-z]+\s+20\d{2})/);
  if (pm) asOf = pm[1];
  if (!asOf) { var pm2 = txt.match(/\b([A-Z][a-z]+\s+20\d{2})\b/); if (pm2) asOf = pm2[1]; }
  return { rent1: r1, rent2: r2, rent3: r3, rent4: r4, asOf: asOf, partial: !(r1 && r2 && r3 && r4) };
}
