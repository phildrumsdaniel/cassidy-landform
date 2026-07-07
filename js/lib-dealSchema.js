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

// keystoneSalePsf — a realistic NEW-BUILD sale £/sqft for auto-pricing a scheme.
// Order of preference:
//   1) the postcode's Land Registry £/sqft (PC_PSF) + the regional new-build premium —
//      the engine's own basis (e.g. CV8 Ryton/Wolston → ~£380 × 1.16 ≈ £441).
//   2) a market-level Land Registry £/sqft (MKT[key].lrPsf) + premium.
//   3) a rent-capitalised estimate at an OWNER-OCCUPIER cap rate (~4.2%), not the
//      conservative ~5% rental yield — the rental yield understated sale values and
//      made otherwise-viable schemes look unprofitable.
//   4) a sensible new-build default.
function keystoneSalePsf(cityKey, postcode){
  if(postcode && typeof PC_PSF !== "undefined" && typeof newBuildPsf === "function"){
    var clean = String(postcode).toUpperCase().replace(/\s/g, "");
    for(var len = 4; len >= 2; len--){
      var pref = clean.substring(0, len);
      if(PC_PSF[pref] != null){
        var nb = newBuildPsf(postcode, PC_PSF[pref]);
        if(nb && nb.newBuild) return nb.newBuild;
      }
    }
  }
  var mk = (typeof MKT !== "undefined") ? MKT[cityKey] : null;
  if(mk && mk.lrPsf && typeof newBuildPsf === "function"){
    var nb2 = newBuildPsf(postcode || "", mk.lrPsf);
    if(nb2 && nb2.newBuild) return nb2.newBuild;
  }
  if(mk && mk.btr && typeof estSalePsfFromRent === "function"){
    var v = estSalePsfFromRent(mk.btr, { yield:0.042 });
    if(v) return v;
  }
  return 300;
}

// keystoneGenerateMix — a typical estate house-type blend for a unit count, sized and
// priced off the area's NEW-BUILD sale benchmark. A STARTING DRAFT to refine, not a market claim.
function keystoneGenerateMix(units, cityKey, postcode){
  units = num(units); if(units <= 0) return [];
  var basePsf = Math.max(180, Math.min(650, Math.round(keystoneSalePsf(cityKey, postcode))));
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

// keystoneMarketKey — resolve a free-text town to a known market key that drives
// pricing, build cost and yield. Normalises spaces AND hyphens (so "Ryton-on-Dunsmore"
// can match), maps nearby villages to their nearest named market, and — crucially —
// FLAGS when a location isn't recognised, so a deal is never silently priced on
// national averages without the user knowing.
var KEYSTONE_MARKET_ALIAS = {
  ryton_on_dunsmore:"rugby", ryton:"rugby", wolston:"rugby", dunchurch:"rugby",
  bilton:"rugby", long_lawford:"rugby", brandon:"rugby", stretton_on_dunsmore:"rugby",
  hillmorton:"rugby", clifton_upon_dunsmore:"rugby",
  binley_woods:"coventry", bulkington:"coventry", kenilworth:"coventry"
};
function _keystoneTitle(s){ return String(s).replace(/_/g, " ").replace(/\b\w/g, function(c){ return c.toUpperCase(); }); }
function keystoneMarketKey(town, postcode){
  var raw = (town == null ? "" : String(town)).trim();
  var has = (typeof MKT !== "undefined");
  var key = raw ? raw.toLowerCase().replace(/[\s\-]+/g, "_").replace(/[^a-z0-9_]/g, "") : "";
  // 1) the town is itself a named market
  if(key && has && MKT[key]) return { key:key, flag:"" };
  // 2) a known village/suburb alias → its nearest market
  var alias = key ? KEYSTONE_MARKET_ALIAS[key] : "";
  if(alias && has && MKT[alias]) return { key:alias,
    flag:"Location '" + raw + "' isn't a named market — using the nearest market, " + _keystoneTitle(alias) + ", for pricing, build cost and yield. Verify against local comparables." };
  // 3) UNIVERSAL: resolve ANY location from its postcode area → nearest anchor market.
  // This is how a village outside Newcastle, Middlesbrough, etc. resolves automatically
  // without being listed by name — as long as a postcode is supplied.
  if(postcode && typeof postcodeMarketKey === "function"){
    var pcMk = postcodeMarketKey(postcode);
    if(pcMk && has && MKT[pcMk]) return { key:pcMk,
      flag:"Location '" + (raw || postcode) + "' resolved from postcode " + (typeof postcodeArea === "function" ? postcodeArea(postcode) : "") + " to the nearest market, " + _keystoneTitle(pcMk) + " (" + (typeof ukRegionFor === "function" ? ukRegionFor({land:{postcode:postcode}}) : "") + "). Sale prices still use the postcode's own Land Registry value where available. Verify against local comparables." };
  }
  // 4) nothing to go on → national averages, clearly flagged
  return { key:key,
    flag:"Location '" + (raw || "(none)") + "' isn't in the market table and no postcode was given — pricing, build cost and yield fall back to UK national averages. Add a postcode so Keystone can resolve the area automatically." };
}

// v9.88 — Best-practice ASSUMPTION SET. So a scheme built from a thin brief is a
// COMPLETE appraisal on day one: every input carries a sensible, flagged default you
// then tweak. Forward-looking — assume consent, size to the land, price to new-build,
// and load policy-typical affordable + full S106/CIL so the result is realistic, not rosy.
var KEYSTONE_DEFAULTS = {
  affordablePct: 30,   // policy-typical
  affordableSplit: "70% affordable/social rent, 30% shared ownership",
  s106PerUnit: 15000,  // strategic greenfield, all-in (see S106_BREAKDOWN)
  contingencyPct: 5,
  feesPct: 10,
  profitPct: 17.5,
  financeRate: 12,   // conservative all-in finance cost so headroom is real, not flattered
  marketingPct: 3    // disposal: agent + marketing + legal on the sale, % of GDV
};
// What the £15k/unit S106/CIL is assumed to cover — itemised so it's visible (your
// cycleways sit under Highways). £/unit; sums to KEYSTONE_DEFAULTS.s106PerUnit.
var S106_BREAKDOWN = [
  { item:"Education (primary / secondary)",        perUnit:5000 },
  { item:"Highways, travel plan & cycleways",      perUnit:3000 },
  { item:"Healthcare / NHS",                       perUnit:1500 },
  { item:"Open space, play & landscaping",         perUnit:2500 },
  { item:"Sport, community & libraries",           perUnit:2000 },
  { item:"Monitoring & commuted sums",             perUnit:1000 }
];

// buildDealFromBrief — expand a brief into a complete, engine-valid Landform deal.
function buildDealFromBrief(brief){
  brief = brief || {};
  var journey = detectJourney(brief);
  var _mk = keystoneMarketKey(brief.town || brief.city || "", brief.postcode);
  var cityKey = _mk.key;
  var locNote = _mk.flag;

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

  var suppliedUnits = num(brief.units) || mixUnits || rentUnits || 0;
  // v9.77/v9.86 — size the scheme to the land mass. Landform is forward-looking: we
  // assume a scheme CAN be consented and test whether it stacks. So the unit count must
  // reflect what the acreage can carry, not a low portal/AI guess.
  //   • No count given      → estimate from acres × density (brief density or ~12/acre gross).
  //   • Count given, sane    → honour it.
  //   • Count given, far too
  //     low for a strategic
  //     greenfield (<5/acre
  //     on ≥15 acres, no mix) → treat as an underestimate and size to the land, recording
  //                             the original so it can be restored in one field.
  var acres = num(brief.acres);
  var density = num(brief.density || brief.homesPerAcre);
  var d = density > 0 ? density : 12;
  var densityUnits = acres > 0 ? Math.round(acres * d) : 0;
  var units = suppliedUnits;
  var autoUnitNote = "";
  if(!units && densityUnits > 0){
    units = densityUnits;
    autoUnitNote = "Units estimated from density: " + acres + " acres × " + d + " homes/acre ≈ " + units + " (no unit count supplied — verify).";
  } else if(units && !mix.length && densityUnits > 0 && acres >= 15 &&
            (journey === "sfh" || journey === "land") && (units / acres) < 5){
    autoUnitNote = "Supplied unit count " + units + " on " + acres + " acres is only ~" +
      (Math.round((units / acres) * 10) / 10) + " homes/acre — well below a typical scheme. " +
      "Sized to " + densityUnits + " at " + d + " homes/acre so the appraisal reflects the land. " +
      "If the scheme really is low-density, set the unit count in Land Appraisal.";
    units = densityUnits;
  }
  // v9.78 — if it's a housing scheme with a unit count but no house mix, auto-generate a
  // typical estate blend so the deal has a full scheme (GDV/RLV, and the rental
  // capitalisation) straight away. A starting draft to refine in SFH House Mix.
  var genMixNote = "";
  if(!mix.length && units > 0 && (journey === "sfh" || journey === "land") && typeof keystoneGenerateMix === "function"){
    mix = keystoneGenerateMix(units, cityKey, brief.postcode);
    journey = "sfh";
    genMixNote = "House mix auto-generated as a typical estate blend for " + units + " homes, priced off area benchmarks — refine the types and prices in SFH House Mix.";
  }

  var yieldPct = num(brief.netInitialYield) || 0;

  // A realistic new-build sale £/sqft benchmark for housing schemes, so the SFH mix,
  // the RLV "does it stack" screen and the tenure calc all price off the same basis.
  var autoSalePsf = (journey === "sfh" || journey === "land")
    ? Math.round(keystoneSalePsf(cityKey, brief.postcode)) : 0;

  // ── Best-practice assumption set — fill every cost/scheme lever so the appraisal is
  // complete on day one. Brief-supplied values always win; otherwise sensible defaults.
  var isHousing = (journey === "sfh" || journey === "land");
  function _has(kf){ return brief[kf] != null && brief[kf] !== ""; }
  var ahPctVal   = _has("affordablePct") ? num(brief.affordablePct) : (isHousing ? KEYSTONE_DEFAULTS.affordablePct : 0);
  var s106Val    = _has("s106PerUnit")   ? num(brief.s106PerUnit)   : (isHousing ? KEYSTONE_DEFAULTS.s106PerUnit : 0);
  var contVal    = _has("contingencyPct")? num(brief.contingencyPct): KEYSTONE_DEFAULTS.contingencyPct;
  var profitVal  = _has("profitPct")     ? num(brief.profitPct)     : KEYSTONE_DEFAULTS.profitPct;
  var finRateVal = _has("financeRate")   ? num(brief.financeRate)   : KEYSTONE_DEFAULTS.financeRate;
  var mktgVal    = _has("marketingPct")  ? num(brief.marketingPct)  : (isHousing ? KEYSTONE_DEFAULTS.marketingPct : 0);

  // Record the applied assumption set so it's fully visible and tweakable (the
  // Assumptions register on the Keystone screen reads these).
  var assumeNotes = [];
  if(isHousing){
    assumeNotes.push("Planning: full consent assumed (forward-looking basis).");
    assumeNotes.push("Affordable housing: " + ahPctVal + "%" + (_has("affordablePct") ? " (from brief)" :
      " (assumed policy-typical — " + KEYSTONE_DEFAULTS.affordableSplit + ")") + ".");
    assumeNotes.push("S106 / CIL: £" + s106Val.toLocaleString() + "/unit" + (_has("s106PerUnit") ? " (from brief)" :
      " (assumed — Education £5k, Highways & cycleways £3k, Health £1.5k, Open space £2.5k, Sport/community £2k, Monitoring £1k)") + ".");
    assumeNotes.push("Developer profit " + profitVal + "% of GDV; finance " + finRateVal + "%; contingency " + contVal +
      "% of build; professional fees 10%; disposal/marketing " + mktgVal + "% of GDV; roads £12k/unit; site infrastructure £53k/acre." +
      ((_has("profitPct")||_has("financeRate")||_has("contingencyPct")) ? " (some from brief)" : " (assumed)"));
    assumeNotes.push("EXIT: profit is shown BOTH ways — build-to-sell (affordable discount borne by Cassidy) and capitalise/forward-fund to an investor (affordable is a lower-rent effect borne by the end holder, not a capital haircut). Compare them on the Capitalisation screen.");
    assumeNotes.push("Still simplified: finance is a flat all-in rate, not a programme cashflow. Tweak every figure in Land Appraisal, SFH House Mix, Planning and Financials.");
  }

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
      assumedDensity: (density > 0 ? density : (autoUnitNote ? d : "")),
      planningStatus: brief.planningStatus || ""
    },
    planning: {
      units: units || "",
      ahPct: ahPctVal || "",
      status: keystoneMapPlanning(brief.planningStatus),
      lpa: brief.lpa || "",
      s106pu: s106Val || ""
    },
    sfh: {
      city: cityKey,
      acres: num(brief.acres) || "",
      mix: mix,
      buildPsf: num(brief.buildPsf) || "",
      basePsf: num(brief.salePsf) || autoSalePsf || "",
      profitPct: profitVal || "",
      finRate: finRateVal || "",
      contingency: contVal || "",
      s106pu: s106Val || "",
      marketingPct: mktgVal || "",
      ahPct: ahPctVal || "",
      ahTenure: brief.ahTenure || (isHousing && ahPctVal ? "ahp_affordable" : ""),
      haSpecBuild: !!brief.haSpec
    },
    rlv: {
      units: units || "",
      salePsf: num(brief.salePsf) || autoSalePsf || "",
      buildPsf: num(brief.buildPsf) || "",
      avgSqft: num(brief.avgSqft) || "",
      city: cityKey,
      postcode: brief.postcode || ""
    },
    fin: {
      units: units || "",
      buildPsf: num(brief.buildPsf) || "",
      profitPct: profitVal || "",
      finRate: finRateVal || "",
      contingency: contVal || "",
      s106pu: s106Val || "",
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
      assumptions: (brief.assumptions || []).slice().concat(locNote ? [locNote] : []).concat(autoUnitNote ? [autoUnitNote] : []).concat(genMixNote ? [genMixNote] : []).concat(assumeNotes),
      notes: brief.notes || "",
      // v10.7 — keep the raw brief so "Reset to raw import" can rebuild a clean deal
      // from source (a fresh Keystone run) after any amount of downstream work.
      sourceBrief: (function(){ try { return JSON.parse(JSON.stringify(brief)); } catch(e){ return brief; } })()
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

// rawImportBrief — the raw source a deal was imported from, as a Keystone brief:
// a Placona site (stashed at deal._raw.placonaSite by loadSiteIntoDeal) or the
// brief Keystone built from (deal._keystone.sourceBrief). Returns null if the deal
// wasn't imported (hand-built), so callers can hide the "Reset to raw import" action.
function rawImportBrief(deal){
  if(!deal) return null;
  if(deal._raw && deal._raw.placonaSite && typeof keystoneBriefFromPlaconaSite === "function"){
    try { return keystoneBriefFromPlaconaSite(deal._raw.placonaSite); } catch(e){}
  }
  if(deal._keystone && deal._keystone.sourceBrief) return deal._keystone.sourceBrief;
  return null;
}

// Expose to the headless test harness (Node) without breaking the browser global scope.
if(typeof module !== "undefined" && module.exports){
  module.exports = { buildDealFromBrief: buildDealFromBrief, detectJourney: detectJourney, keystoneBriefFromPlaconaSite: keystoneBriefFromPlaconaSite, rawImportBrief: rawImportBrief, KEYSTONE_BRIEF_SCHEMA: KEYSTONE_BRIEF_SCHEMA };
}
