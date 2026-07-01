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

// keystoneGenerateMix — a typical estate house-type blend for a unit count, sized and
// priced off the area's sale benchmark. A STARTING DRAFT to refine, not a market claim.
function keystoneGenerateMix(units, cityKey){
  units = num(units); if(units <= 0) return [];
  var mk = (typeof MKT !== "undefined") ? MKT[cityKey] : null;
  var basePsf = (mk && mk.btr && typeof estSalePsfFromRent === "function")
    ? Math.max(150, Math.min(650, Math.round(estSalePsfFromRent(mk.btr)))) : 260;
  var ratios = [
    { type:"2-bed semi",     pct:0.10, sqft:820,  adj:0.90 },
    { type:"3-bed semi",     pct:0.35, sqft:1020, adj:1.00 },
    { type:"3-bed detached", pct:0.30, sqft:1150, adj:1.08 },
    { type:"4-bed detached", pct:0.25, sqft:1500, adj:1.18 }
  ];
  var rows = ratios.map(function(r){ return { type:r.type, count:Math.round(units * r.pct), sqft:r.sqft, adj:r.adj }; });
  // reconcile rounding so the counts sum to the target
  var diff = units - rows.reduce(function(a, r){ return a + r.count; }, 0);
  rows[1].count += diff;   // put any remainder on the largest group (3-bed semi)
  return rows.map(function(r){
    return { type:r.type, count:String(Math.max(0, r.count)), sqft:String(r.sqft),
      unitPrice:String(Math.round(r.sqft * basePsf * r.adj)), tenure:"private", buildPsf:"" };
  });
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
  // v9.77 — if no unit count is given, estimate it from the acreage × density so Keystone
  // sizes the scheme to the land mass. Uses the brief's density (homes/acre) or a sensible
  // greenfield default (~12/acre gross), and records it as an assumption to verify.
  var acres = num(brief.acres);
  var density = num(brief.density || brief.homesPerAcre);
  var autoUnitNote = "";
  if(!units && acres > 0){
    var d = density > 0 ? density : 12;
    units = Math.round(acres * d);
    autoUnitNote = "Units estimated from density: " + acres + " acres × " + d + " homes/acre ≈ " + units + " (no unit count supplied — verify).";
  }
  // v9.78 — if it's a housing scheme with a unit count but no house mix, auto-generate a
  // typical estate blend so the deal has a full scheme (GDV/RLV, and the rental
  // capitalisation) straight away. A starting draft to refine in SFH House Mix.
  var genMixNote = "";
  if(!mix.length && units > 0 && (journey === "sfh" || journey === "land") && typeof keystoneGenerateMix === "function"){
    mix = keystoneGenerateMix(units, cityKey);
    journey = "sfh";
    genMixNote = "House mix auto-generated as a typical estate blend for " + units + " homes, priced off area benchmarks — refine the types and prices in SFH House Mix.";
  }

  var yieldPct = num(brief.netInitialYield) || 0;

  var deal = {
    assetType: journey,
    // v9.75 — origination status, carried from day one: are we developing this, or
    // sourcing it to introduce/sell to another developer? Defaults to "owned".
    dealStatus: brief.dealStatus || "owned",
    land: {
      address: brief.address || "",
      city: cityKey,
      postcode: brief.postcode || "",
      acres: num(brief.acres) || "",
      price: num(brief.askingPrice) || "",
      units: units || "",
      assumedUnits: (mix.length ? "" : (units || "")),                  // feeds the "What You Should Pay" panel
      assumedDensity: (density > 0 ? density : (autoUnitNote ? 12 : "")),
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
      assumptions: (brief.assumptions || []).slice().concat(autoUnitNote ? [autoUnitNote] : []).concat(genMixNote ? [genMixNote] : []),
      notes: brief.notes || ""
    }
  };

  // Forward-fill the shared fields (city/units/ahPct/s106/build/etc.) so every
  // stage agrees — the same tested propagation the rest of the tool uses.
  if(typeof normalizeSharedFields === "function") deal = normalizeSharedFields(deal);
  return deal;
}

// Parse a loose human/AI string into a number: "£12,000,000", "£12m", "850k",
// "32 acres", "200-250" (→ midpoint), "Not found" (→ 0).
function _parseLooseNum(v){
  if(v == null) return 0;
  if(typeof v === "number") return v;
  var s = String(v).toLowerCase().replace(/not found|tbc|n\/a|circa|approx\.?/g, "").trim();
  if(!s) return 0;
  var range = s.match(/([\d.,]+)\s*(?:-|to|–|—)\s*([\d.,]+)/);
  if(range){ var a = parseFloat(range[1].replace(/,/g, "")), b = parseFloat(range[2].replace(/,/g, "")); if(!isNaN(a) && !isNaN(b)) return (a + b) / 2; }
  var m = s.match(/([\d.,]+)\s*(m|k)?/);
  if(!m) return 0;
  var n = parseFloat(m[1].replace(/,/g, ""));
  if(isNaN(n)) return 0;
  if(m[2] === "m") n *= 1e6; else if(m[2] === "k") n *= 1e3;
  return n;
}

// keystoneBriefFromPlaconaSite — turn a Placona search result into a Keystone brief,
// so a found site can flow straight into evaluation/scheme-building.
function keystoneBriefFromPlaconaSite(site){
  site = site || {};
  function clean(v){ return (v && String(v) !== "Not found") ? String(v).trim() : ""; }
  var addr = clean(site.address_or_location) || clean(site.site_name);
  var town = clean(site.town);
  if(!town && addr){
    var parts = addr.split(",").map(function(p){ return p.trim(); }).filter(Boolean);
    for(var i = 0; i < parts.length; i++){
      var key = parts[i].toLowerCase().replace(/\s+/g, "_");
      if(typeof MKT !== "undefined" && MKT[key]){ town = parts[i]; break; }
    }
    if(!town && parts.length >= 2) town = parts[parts.length - 2]; // town usually sits before the county
  }
  if(!town) town = clean(site.county);
  return {
    dealName: (clean(site.site_name) || addr || "Placona site") + " (Placona)",
    address: addr,
    town: town,
    postcode: clean(site.postcode),
    acres: _parseLooseNum(site.site_area_acres),
    askingPrice: _parseLooseNum(site.asking_price),
    units: _parseLooseNum(site.estimated_units),
    lpa: clean(site.local_planning_authority),
    planningStatus: clean(site.planning_status),
    notes: [clean(site.recommended_action), site.placona_score ? ("Placona score " + site.placona_score) : "", clean(site.site_type)].filter(Boolean).join(" · "),
    assumptions: ["Imported from Placona — figures are AI-sourced estimates; verify acreage, price, units and planning before relying on them."]
  };
}

// Expose to the headless test harness (Node) without breaking the browser global scope.
if(typeof module !== "undefined" && module.exports){
  module.exports = { buildDealFromBrief: buildDealFromBrief, detectJourney: detectJourney, keystoneBriefFromPlaconaSite: keystoneBriefFromPlaconaSite, KEYSTONE_BRIEF_SCHEMA: KEYSTONE_BRIEF_SCHEMA };
}
