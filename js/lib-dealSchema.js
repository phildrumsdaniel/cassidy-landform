// ── lib-dealSchema.js — KEYSTONE deal builder (v9.73) ────────────────────────
// The foundation of the Keystone "Deal Builder PA". An AI agent (or a person)
// produces a SIMPLE structured brief; this file turns it into a complete, valid
// Landform deal and AUTO-CHOOSES the journey (assetType) from the data in it.
//
// Principle: the agent never does the maths. It extracts facts → a brief; THIS
// expands the brief into a deal; the one tested engine does every calculation.
// So the numbers are always correct and consistent, whoever fed it the data.
//
// Loaded after 01-config.js (uses num/numOr/normalizeSharedFields/MKT). Pure
// functions, no React — also evaluated by the headless test harness.
// ─────────────────────────────────────────────────────────────────────────────

// The brief the agent should produce. Every field is optional — Keystone fills
// sensible defaults and records what it assumed. (Documentation object.)
var KEYSTONE_BRIEF_SCHEMA = {
  dealName:     "string — a short name for the deal",
  // ── Site ──
  address:      "string — site address",
  town:         "string — town/city (drives area rents, build & yield benchmarks)",
  postcode:     "string",
  acres:        "number — site area in acres",
  askingPrice:  "number — landowner's asking price (£)",
  // ── Scheme (assetType auto-detected if omitted) ──
  assetType:    "optional 'sfh'|'btr'|'pbsa'|'land'|'property'|'recovery' — else auto-chosen",
  units:        "number — total units (else summed from the mix/rents)",
  // ── Houses for sale / mixed-tenure (SFH) ──
  houseMix:     "array of { type, count, sqft, salePrice, tenure, buildPsf }",
  // ── Rents (BTR/PRS/forward-fund) ──
  rents:        "array of { beds, count, rentPcm, sqft }",
  mgmtPct:      "number — management deduction % off gross rent (default 25)",
  netInitialYield: "number — capitalisation yield % (e.g. 4.5)",
  // ── Tenure / affordable ──
  affordablePct:"number — affordable housing %",
  // ── Costs ──
  buildPsf:     "number — build £/sqft",
  haSpec:       "boolean — apply HA low-carbon spec uplift to affordable",
  s106PerUnit:  "number — S106 £/unit",
  financeRate:  "number — finance rate % pa",
  programmeYears:"number — total project years (build + planning)",
  profitPct:    "number — developer profit % (default 17.5)",
  contingencyPct:"number",
  salePsf:      "number — sale £/sqft (used when no per-unit prices)",
  avgSqft:      "number — average unit size",
  // ── Planning ──
  planningStatus:"string — e.g. 'full', 'outline', 'allocated', 'none', 'refused'",
  lpa:          "string — local planning authority",
  // ── Meta ──
  notes:        "string — free notes",
  assumptions:  "array of strings — anything Keystone/the agent assumed or couldn't find"
};

// Map a free-text tenure to a Landform ROUTE_DISCOUNT key.
function keystoneMapTenure(t){
  t = (t || "private").toString().toLowerCase();
  if(/social/.test(t)) return "ahp_social";
  if(/shared own|\bso\b|s\.o\./.test(t)) return "ahp_so";
  if(/afford/.test(t)) return "ahp_affordable";
  if(/first ?home/.test(t)) return "first_homes";
  if(/pension|bulk|sfr|institut/.test(t)) return "pension";
  if(/prs|retain|rent ?to ?buy|rent to/.test(t)) return "retained_prs";
  return "private";
}

// Normalise a free-text planning status to the select values the screens use.
function keystoneMapPlanning(s){
  s = (s || "").toString().toLowerCase();
  if(!s) return "";
  if(/refus|reject|dismiss|withdrawn|stalled/.test(s)) return "refused_full";
  if(/full|granted|consented|detailed|approved/.test(s)) return "full";
  if(/outline/.test(s)) return "outline";
  if(/allocat|local plan|emerging|draft/.test(s)) return "allocated";
  if(/pre.?app/.test(s)) return "preApp";
  return "none";
}

// detectJourney — AUTO-CHOOSE the Landform journey from the brief's data.
function detectJourney(brief){
  brief = brief || {};
  var explicit = (brief.assetType || "").toString().toLowerCase();
  if(["sfh","btr","pbsa","land","property","recovery"].indexOf(explicit) >= 0) return explicit;

  var text = JSON.stringify(brief).toLowerCase();
  var hasMix = !!(brief.houseMix && brief.houseMix.length);
  var hasRents = !!(brief.rents && brief.rents.length);

  // Refused / stalled planning → recovery
  if(/refus|reject|dismiss|withdrawn|stalled|recovery/.test((brief.planningStatus||"").toLowerCase())) return "recovery";
  // Existing building / conversion with no new-build mix → property
  if(!hasMix && /(existing (building|property|dwelling|pub|office|barn|chapel|hotel|care ?home|shop))|conversion|refurbish(ment)?|change of use/.test(text)) return "property";
  // Student → PBSA
  if(/\bpbsa\b|student|universit|halls of res/.test(text)) return "pbsa";
  // Houses present → SFH (a rental exit is handled in Capitalisation, still an SFH build)
  if(hasMix) return "sfh";
  // Rents but no houses → a rental block → BTR
  if(hasRents) return "btr";
  // Just buying land / nothing built yet
  return "land";
}

// buildDealFromBrief — expand a brief into a complete, engine-valid Landform deal.
function buildDealFromBrief(brief){
  brief = brief || {};
  var journey = detectJourney(brief);
  var cityKey = ((brief.town || brief.city || "")).toString().toLowerCase().replace(/\s+/g, "_");

  // ── House mix ──
  var mix = (brief.houseMix || []).map(function(r){
    return {
      type: r.type || "3-bed semi",
      count: String(num(r.count) || 0),
      sqft: (num(r.sqft) ? String(num(r.sqft)) : ""),
      unitPrice: (num(r.salePrice || r.unitPrice) ? String(num(r.salePrice || r.unitPrice)) : ""),
      psf: (num(r.psf) ? String(num(r.psf)) : ""),
      tenure: keystoneMapTenure(r.tenure),
      buildPsf: (num(r.buildPsf) ? String(num(r.buildPsf)) : "")
    };
  });
  var mixUnits = mix.reduce(function(a, r){ return a + num(r.count); }, 0);

  // ── Rents → net annual income for capitalisation ──
  var rentUnits = (brief.rents || []).reduce(function(a, r){ return a + num(r.count); }, 0);
  var grossPa = (brief.rents || []).reduce(function(a, r){ return a + num(r.count) * num(r.rentPcm) * 12; }, 0);
  var mgmtPct = numOr(brief.mgmtPct, 25);
  var netPa = grossPa * (1 - mgmtPct / 100);

  var units = num(brief.units) || mixUnits || rentUnits || 0;
  var yieldPct = num(brief.netInitialYield) || 0;

  var deal = {
    assetType: journey,
    land: {
      address: brief.address || "",
      city: cityKey,
      postcode: brief.postcode || "",
      acres: num(brief.acres) || "",
      price: num(brief.askingPrice) || "",
      units: units || "",
      planningStatus: brief.planningStatus || ""
    },
    planning: {
      units: units || "",
      ahPct: num(brief.affordablePct) || "",
      status: keystoneMapPlanning(brief.planningStatus),
      lpa: brief.lpa || "",
      s106pu: num(brief.s106PerUnit) || ""
    },
    sfh: {
      city: cityKey,
      acres: num(brief.acres) || "",
      mix: mix,
      buildPsf: num(brief.buildPsf) || "",
      basePsf: num(brief.salePsf) || "",
      profitPct: num(brief.profitPct) || "",
      finRate: num(brief.financeRate) || "",
      contingency: num(brief.contingencyPct) || "",
      s106pu: num(brief.s106PerUnit) || "",
      ahPct: num(brief.affordablePct) || "",
      haSpecBuild: !!brief.haSpec
    },
    rlv: {
      units: units || "",
      salePsf: num(brief.salePsf) || "",
      buildPsf: num(brief.buildPsf) || "",
      avgSqft: num(brief.avgSqft) || "",
      city: cityKey,
      postcode: brief.postcode || ""
    },
    fin: {
      units: units || "",
      buildPsf: num(brief.buildPsf) || "",
      profitPct: num(brief.profitPct) || "",
      finRate: num(brief.financeRate) || "",
      contingency: num(brief.contingencyPct) || "",
      s106pu: num(brief.s106PerUnit) || "",
      exitYield: yieldPct || "",
      programmeMths: num(brief.programmeYears) ? num(brief.programmeYears) * 12 : ""
    },
    capitalise: {
      targetYield: yieldPct || "",
      netAnnualIncome: netPa || "",
      mgmtRate: (brief.mgmtPct != null && brief.mgmtPct !== "") ? num(brief.mgmtPct) : ""
    },
    _keystone: {
      builtAt: new Date().toISOString(),
      journey: journey,
      dealName: brief.dealName || brief.address || "Keystone deal",
      assumptions: (brief.assumptions || []).slice(),
      notes: brief.notes || ""
    }
  };

  // Forward-fill the shared fields (city/units/ahPct/s106/build/etc.) so every
  // stage agrees — the same tested propagation the rest of the tool uses.
  if(typeof normalizeSharedFields === "function") deal = normalizeSharedFields(deal);
  return deal;
}

// Expose to the headless test harness (Node) without breaking the browser global scope.
if(typeof module !== "undefined" && module.exports){
  module.exports = { buildDealFromBrief: buildDealFromBrief, detectJourney: detectJourney, KEYSTONE_BRIEF_SCHEMA: KEYSTONE_BRIEF_SCHEMA };
}
