/**
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

// ── Land Registry proprietor — STUB. No free API exists. Wire your provider here:
//   • HM Land Registry Business Gateway (order the title register B2B), or
//   • a commercial aggregator API (Searchland / LandInsight / Nimbus / Orbital Witness).
// Return { status:"ok", proprietor, address, type, titleNumber } on success.
function handleLandRegistry(data) {
  var provider = PropertiesService.getScriptProperties().getProperty("LR_PROVIDER_URL");
  if (!provider) {
    return { status: "error", message: "no ownership provider configured — buy the title register at search-property-information.service.gov.uk (the app links you there), or wire an aggregator API here." };
  }
  // Example shape once you have a provider (adjust to their API):
  // var res = UrlFetchApp.fetch(provider + "?postcode=" + encodeURIComponent(data.postcode) +
  //   "&address=" + encodeURIComponent(data.address),
  //   { headers: { Authorization: "Bearer " + PropertiesService.getScriptProperties().getProperty("LR_API_KEY") }, muteHttpExceptions: true });
  // var j = JSON.parse(res.getContentText() || "{}");
  // return { status:"ok", proprietor:j.owner_name, address:j.owner_address, type:j.owner_type, titleNumber:j.title_no };
  return { status: "error", message: "land_registry provider stub — add your provider call in handleLandRegistry()" };
}
