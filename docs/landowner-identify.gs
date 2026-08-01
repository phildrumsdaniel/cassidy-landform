/**
 * ⚠ SUPERSEDED — use docs/backend-all-in-one.gs (one file wires everything). Kept for reference.
 * Landowner Identifier — optional automated lookups  (v10.213)
 * ──────────────────────────────────────────────────────────────────────────
 * The 🕵 Landowner Identifier works with NO backend (AI research + official links).
 * These two OPTIONAL actions let it look up ownership from inside Landform:
 *
 *   • companies_house_lookup  — FREE. Confirms a company owner + registered office
 *                               via the Companies House public API. Just needs a
 *                               free API key.
 *   • land_registry_lookup    — the DEFINITIVE proprietor. There is no free API for
 *                               this; it needs an HM Land Registry "Business Gateway"
 *                               account (B2B, paid per title) OR a commercial
 *                               aggregator (Searchland / LandInsight / Nimbus / Orbital
 *                               Witness). A stub is provided — drop your provider's
 *                               call into it. Until then the app links you to the
 *                               official £3 title-register purchase instead.
 *
 * WIRING — add to doPost(e):
 *   if (data.action === "companies_house_lookup") return respond(handleCompaniesHouse(data));
 *   if (data.action === "land_registry_lookup")   return respond(handleLandRegistry(data));
 * Then re-deploy.
 */

// ── Companies House — FREE. Get a key at developer.company-information.service.gov.uk,
// then set it once:  Project Settings ▸ Script properties ▸ add  CH_API_KEY = <your key>.
function handleCompaniesHouse(data) {
  var q = String((data && data.query) || "").trim();
  if (!q) return { status: "error", message: "no company name to search" };
  var key = PropertiesService.getScriptProperties().getProperty("CH_API_KEY");
  if (!key) return { status: "error", message: "CH_API_KEY not set in Script properties" };
  try {
    var url = "https://api.company-information.service.gov.uk/search/companies?q=" + encodeURIComponent(q) + "&items_per_page=1";
    var res = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: "Basic " + Utilities.base64Encode(key + ":") },
      muteHttpExceptions: true
    });
    var body = JSON.parse(res.getContentText() || "{}");
    var it = (body.items && body.items[0]) || null;
    if (!it) return { status: "ok", companyName: "", message: "no match" };
    var addr = it.address || {};
    var regOffice = [addr.premises, addr.address_line_1, addr.locality, addr.postal_code]
      .filter(function (x) { return x; }).join(", ");
    return {
      status: "ok", type: "company",
      companyName: it.title, companyNumber: it.company_number, companyStatus: it.company_status,
      registeredOffice: regOffice, address: regOffice
    };
  } catch (err) {
    return { status: "error", message: String(err) };
  }
}

// ── Land Registry proprietor via LANDINSIGHT (LandTech) ──────────────────────────────────────
// LandInsight/LandTech consolidates HM Land Registry + Companies House ownership behind an API for
// its API customers. Their API reference is provided with your API credentials (it isn't public), so
// the ENDPOINT PATH and RESPONSE FIELD NAMES below are the standard pattern — confirm them against
// your LandTech API reference and adjust the two marked spots if they differ.
//
// SETUP (once):
//   1. Get API access + a key from your LandTech / LandInsight account manager (land.tech/api).
//   2. Project Settings ▸ Script properties, add:
//        LANDTECH_API_KEY   = <your key / token>
//        LANDTECH_API_BASE  = <the base URL from their API reference, e.g. https://api.land.tech>
//   3. Paste this handler + the doPost line, re-deploy.
//
// Returns { status:"ok", proprietor, name, address, type, titleNumber } — the app records it and
// pushes the owner + address into the Approach-Landowner stage.
function handleLandRegistry(data) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty("LANDTECH_API_KEY");
  var base = props.getProperty("LANDTECH_API_BASE") || "https://api.land.tech";
  if (!key) return { status: "error", message: "LANDTECH_API_KEY not set — add it in Script properties (see docs/landowner-identify.gs)." };
  var address = String((data && data.address) || "").trim();
  var postcode = String((data && data.postcode) || "").trim();
  var title = String((data && data.titleNumber) || "").trim();
  if (!address && !postcode && !title) return { status: "error", message: "need an address, postcode or title number" };
  try {
    // ── SPOT 1: the ownership endpoint. Confirm the path + query params in your LandTech API reference.
    var qs = title ? ("titleNumber=" + encodeURIComponent(title))
                   : ("address=" + encodeURIComponent(address) + "&postcode=" + encodeURIComponent(postcode));
    var url = base.replace(/\/+$/, "") + "/v1/ownership?" + qs;
    var res = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: "Bearer " + key, Accept: "application/json" },
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code >= 400) return { status: "error", message: "LandTech API " + code + ": " + String(res.getContentText()).slice(0, 300) };
    var j = JSON.parse(res.getContentText() || "{}");
    return mapLandTechOwnership_(j);
  } catch (err) {
    return { status: "error", message: String(err) };
  }
}

// ── SPOT 2: map LandTech's response to Landform's shape. Tries several common field names; adjust to
// match your API reference exactly (the ownership record may be nested under a different key).
function mapLandTechOwnership_(j) {
  var rec = (j && (j.ownership || (j.ownerships && j.ownerships[0]) || (j.results && j.results[0]) || (j.data && (j.data.ownership || j.data)))) || j || {};
  function first(v) { return Array.isArray(v) ? (v[0] || "") : (v || ""); }
  var p = first(rec.proprietors) || rec.proprietor || rec.owner || rec.ownerName || rec.registeredProprietor || "";
  var proprietor = (p && typeof p === "object") ? (p.name || p.proprietorName || "") : String(p || "");
  var address = rec.proprietorAddress || rec.ownerAddress || rec.correspondenceAddress ||
                ((p && typeof p === "object") ? (p.address || "") : "") || rec.address || "";
  var titleNo = rec.titleNumber || rec.title_no || rec.title || "";
  if (!proprietor && !titleNo) return { status: "ok", proprietor: "", message: "no ownership match returned" };
  return { status: "ok", type: rec.ownerType || rec.tenure || "", proprietor: proprietor, name: proprietor, address: address, titleNumber: titleNo };
}
