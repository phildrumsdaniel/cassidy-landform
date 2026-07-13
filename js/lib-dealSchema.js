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
  units:        "number — the scheme's STATED unit figure from the source. A capacity/allocation phrase IS this figure: 'room for 1,800 houses', 'circa 1,800 units', 'allocated for ~1,000 homes', 'capacity for 1,800 dwellings' → units: 1800. Quote the source's exact wording in assumptions. Else summed from the mix/rents.",
  density:      "number — stated or target density in HOMES PER ACRE. If the source quotes dwellings-per-hectare (dph), convert: homes/acre ≈ dph ÷ 2.471 (so 20 dph ≈ 8/acre; '20/acre' stays 20). Record the source's original figure and units (dph vs per-acre) in assumptions.",
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
  // v10.55 — sizes/blend aligned to volume-housebuilder norms (Persimmon/Barratt/Redrow), avg
  // ~970 sqft, not the previous ~1,159 avg which overstated GDV and build. Weighted toward the
  // smaller/attached types a large estate actually delivers. Refine per scheme in SFH House Mix.
  var ratios = [
    { type:"2-bed semi",     pct:0.15, sqft:720,  adj:1.00 },
    { type:"3-bed semi",     pct:0.38, sqft:900,  adj:1.00 },
    { type:"3-bed detached", pct:0.27, sqft:1000, adj:1.00 },
    { type:"4-bed detached", pct:0.20, sqft:1250, adj:1.00 }
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

// v10.62 — scaleMixToUnits: rescale a house mix pro-rata so its counts sum EXACTLY to a target
// unit total (the last row absorbs the rounding remainder). Used so a manual units figure stays
// authoritative — the modelled mix reconciles to it instead of drifting (e.g. 1,800 ≠ 1,789/1,902).
function scaleMixToUnits(mix, target){
  mix = mix || []; target = Math.round(num(target));
  var tot = mix.reduce(function(a, r){ return a + num(r.count); }, 0);
  if(target <= 0 || tot <= 0 || tot === target) return mix;
  var k = target / tot, acc = 0;
  return mix.map(function(r, i){
    var c = (i === mix.length - 1) ? Math.max(0, target - acc) : Math.max(0, Math.round(num(r.count) * k));
    acc += c;
    return Object.assign({}, r, { count: String(c) });
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
// Reference density (homes/acre) for surfacing a site's fuller CAPACITY as upside next
// to whatever the source states. When a brief quotes a low allocation ("room for 1,800
// houses" on a 285-acre site ≈ 6.3/acre), Keystone develops from that stated figure but
// FLAGS what the land could carry at a policy-typical higher density — so the board sees
// the headroom without the appraisal silently inflating the scheme.
var KEYSTONE_REF_DENSITY = 20;
var KEYSTONE_DEFAULTS = {
  affordablePct: 30,   // policy-typical
  affordableSplit: "70% affordable/social rent, 30% shared ownership",
  s106PerUnit: 15000,  // strategic greenfield, all-in (see S106_BREAKDOWN)
  contingencyPct: 5,
  feesPct: 10,
  profitPct: 17.5,
  financeRate: 12,   // conservative all-in finance cost so headroom is real, not flattered
  marketingPct: 0,   // v10.50 — disposal/marketing is a SALE-side cost, left at £0 (matches the
                     // Quick Appraisal) so it isn't added on top of Cassidy's all-in build rate
  buildInclusive: true  // v10.50 — Cassidy's build £/sqft is a FULLY-LOADED all-in rate: it already
                        // covers professional fees, contingency, roads/drainage & SuDS, so those are
                        // NOT added again. Turn off on the SFH/Quick Appraisal stage for a
                        // construction-only rate. (Finance & S106 are still charged — real costs.)
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
  // v10.47 — DEVELOP FROM THE SOURCE FIRST, then surface the land's fuller CAPACITY as upside.
  // Keystone builds the appraisal from whatever the source states (honoured above); this ADD-ON
  // computes what the acreage could carry at a policy-typical higher density and flags the
  // headroom so the board sees it — e.g. a source quoting "room for 1,800 houses" on a ~285-acre
  // site (~6.3/acre) when 20/acre would be ~5,700. It never silently inflates the scheme; the
  // stated figure remains the basis. Stored on land.* so the density card & one-pager can show it.
  var capacityAtRef = (acres > 0) ? Math.round(acres * KEYSTONE_REF_DENSITY) : 0;
  var impliedDensity = (acres > 0 && units > 0) ? (Math.round((units / acres) * 10) / 10) : 0;
  // Only genuine headroom (capacity materially above the developed scheme) counts as upside —
  // a scheme already at/near the reference density has none, and nothing is stored/flagged.
  var hasHeadroom = (capacityAtRef > 0 && units > 0 && (journey === "sfh" || journey === "land") && capacityAtRef >= units * 1.2);
  var capacityNote = "";
  if(hasHeadroom){
    var sourceHonoured = (suppliedUnits > 0 && units === suppliedUnits);
    var lead = sourceHonoured
      ? "Source states room for " + suppliedUnits.toLocaleString() + " homes (~" + impliedDensity + "/acre on " + acres + " acres) — the appraisal is built from this."
      : "Scheme drafted at " + units.toLocaleString() + " homes (~" + impliedDensity + "/acre on " + acres + " acres).";
    capacityNote = lead + " Land capacity: at " + KEYSTONE_REF_DENSITY + "/acre the " + acres +
      "-acre site could carry ~" + capacityAtRef.toLocaleString() + " homes — potential upside of ~" +
      (capacityAtRef - units).toLocaleString() + ". Raise the density on the Keystone density card to model the fuller capacity.";
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
  // v10.37 — size the house mix to the scheme's unit count. When a brief supplies BOTH an
  // allocation/units figure AND a house mix that don't agree (e.g. a source doc quoting
  // "circa 1,800 units" alongside an indicative ~1,000-home sample mix), scale the mix
  // pro-rata so it sums to the units. This means Keystone fills the mix at the FULL allocation
  // straight away — the board paper, one-pager and headline unit count all agree without any
  // manual "auto-fill" on the SFH stage. Distribution is preserved; the last row absorbs the
  // rounding remainder so the mix totals exactly `units`.
  if((journey === "sfh" || journey === "land") && units > 0 && mix.length){
    var mixTot0 = mix.reduce(function(a, r){ return a + num(r.count); }, 0);
    if(mixTot0 > 0 && Math.abs(mixTot0 - units) > Math.max(20, units * 0.05)){
      var _k = units / mixTot0, _acc = 0;
      mix = mix.map(function(r, i){
        var c = (i === mix.length - 1) ? Math.max(0, units - _acc) : Math.max(0, Math.round(num(r.count) * _k));
        _acc += c;
        return Object.assign({}, r, { count: String(c) });
      });
      genMixNote = "House mix sized to the scheme's " + units.toLocaleString() + " units (the brief's mix summed to " +
        mixTot0.toLocaleString() + ") so the appraisal reflects the full allocation from the outset — refine the split in SFH House Mix.";
    }
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
    if(ahPctVal > 0) assumeNotes.push("Tenure mix auto-filled: " + Math.max(0,100-Math.round(ahPctVal*0.7)-Math.round(ahPctVal*0.3)) + "% open-market sale, " + Math.round(ahPctVal*0.7) + "% affordable rent, " + Math.round(ahPctVal*0.3) + "% shared ownership — refine on the Tenure Mix stage.");
    assumeNotes.push("S106 / CIL: £" + s106Val.toLocaleString() + "/unit" + (_has("s106PerUnit") ? " (from brief)" :
      " (assumed — Education £5k, Highways & cycleways £3k, Health £1.5k, Open space £2.5k, Sport/community £2k, Monitoring £1k)") + ".");
    assumeNotes.push("Build £/sqft treated as ALL-IN — professional fees, contingency, roads, drainage & SuDS are inside the build rate, NOT added on top (finance is charged on the build cost alone). Turn off 'Build £/sqft is all-in' on the SFH House Mix / Quick Appraisal stage if your rate is construction-only.");
    assumeNotes.push("Developer profit " + profitVal + "% of GDV; finance " + finRateVal + "% (real cost — cost of money, kept separate); S106/CIL as above. Marketing/disposal left at £0 (a sale-side cost — add it if you'll budget agent/legal fees on the sale)." +
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
      assumedDensity: (density > 0 ? density : (impliedDensity > 0 ? impliedDensity : (autoUnitNote ? d : ""))),
      // v10.47 — the land's fuller capacity at a higher reference density, so the density
      // card and board one-pager can show the headroom beside the source's stated figure.
      capacityAtRef: hasHeadroom ? capacityAtRef : "",
      capacityRefDensity: hasHeadroom ? KEYSTONE_REF_DENSITY : "",
      statedUnits: suppliedUnits || "",
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
      // v10.68 — record the profit target Keystone used, so a report can show BOTH the Keystone
      // baseline scenario and any later user override (e.g. a 25% target) side by side.
      keystoneProfitPct: profitVal || "",
      finRate: finRateVal || "",
      contingency: contVal || "",
      s106pu: s106Val || "",
      marketingPct: mktgVal || "",
      ahPct: ahPctVal || "",
      ahTenure: brief.ahTenure || (isHousing && ahPctVal ? "ahp_affordable" : ""),
      haSpecBuild: !!brief.haSpec,
      // v10.50 — treat Cassidy's build £/sqft as a fully-loaded ALL-IN rate: professional fees,
      // contingency, roads/drainage & SuDS are inside it, not added on top. (Finance & S106 remain.)
      buildInclusive: isHousing ? true : false
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
    // v10.45 — auto-fill the TENURE MIX from the affordable %, so the Tenure Mix stage is complete
    // on day one (no manual entry). Split follows KEYSTONE_DEFAULTS.affordableSplit — 70% of the
    // affordable as Affordable Rent, 30% as Shared Ownership — the rest open-market sale. The
    // engine reads this (it takes precedence over the flat ahPct haircut), so GDV reflects the
    // per-tenure values, not a single blanket discount. A draft to refine on the Tenure Mix stage.
    tenure: (function(){
      if(!isHousing) return { inputMode:"percent", totalUnits: units || "", mix: { oms:100 } };
      var ah = Math.max(0, Math.min(100, num(ahPctVal)));
      if(ah <= 0) return { inputMode:"percent", totalUnits: units || "", mix: { oms:100 } };
      var ar = Math.round(ah * 0.7), so = Math.round(ah * 0.3), oms = Math.max(0, 100 - ar - so);
      return { inputMode:"percent", totalUnits: units || "", mix: { oms:oms, ar:ar, so:so } };
    })(),
    // v10.12 — seed the standard risk register so the deal's stored risks match what the
    // Risk Register screen displays (it shows RISK_DEFAULTS but only persisted them on edit,
    // so the dashboard checklist read "empty" and never showed the stage complete).
    risks: (typeof RISK_DEFAULTS !== "undefined") ? RISK_DEFAULTS.map(function(r){ return Object.assign({}, r); }) : undefined,
    _keystone: {
      builtAt: new Date().toISOString(),
      journey: journey,
      dealName: brief.dealName || brief.address || "Keystone deal",
      assumptions: (brief.assumptions || []).slice().concat(capacityNote ? [capacityNote] : []).concat(locNote ? [locNote] : []).concat(autoUnitNote ? [autoUnitNote] : []).concat(genMixNote ? [genMixNote] : []).concat(assumeNotes),
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

// v10.45 — applyMarketPricesAndOptimise: the DETERMINISTIC core of Keystone's "complete the
// deal with AI" step. Given AI-researched per-type new-build prices/rents (a plain array), it
// applies the real sale price to each matching mix row (so the flat default is replaced by the
// area's actual per-type values — a 4-bed detached that fetches a lower £/sqft than a 3-bed
// semi now shows that), records the per-type rents, and — when it helps — applies the profit-
// maximising mix from optimiseSfhMix. Pure and testable; the AI call is a thin async wrapper.
// aiTypes: [{ type?, beds?, sqft?, salePrice, rentPcm? }]. Returns {data, applied, optimised}.
function applyMarketPricesAndOptimise(data, aiTypes, opts){
  opts = opts || {};
  try{ data = JSON.parse(JSON.stringify(data || {})); }catch(e){ data = data || {}; }
  var sfh = data.sfh || (data.sfh = {});
  var mix = sfh.mix || [];
  if(!mix.length || !aiTypes || !aiTypes.length) return { data:data, applied:0, optimised:null };

  function bedsOf(s){ var m = /([0-9])\s*-?\s*bed/.exec(String(s || "").toLowerCase()); return m ? num(m[1]) : 0; }
  var byType = {}, byBeds = {};
  aiTypes.forEach(function(a){
    var t = String(a.type || "").toLowerCase().trim();
    if(t) byType[t] = a;
    var b = num(a.beds) || bedsOf(a.type);
    if(b && !byBeds[b]) byBeds[b] = a;
  });

  var applied = 0, rentByBeds = {};
  mix = mix.map(function(r){
    var info = (typeof HOUSE_TYPES !== "undefined" && (HOUSE_TYPES[r.type] || HOUSE_TYPES["3-bed semi"])) || { sqft:900, beds:3 };
    var beds = num(r.beds) || info.beds || 3;
    var a = byType[String(r.type || "").toLowerCase().trim()] || byBeds[beds];
    if(a && num(a.salePrice) > 0){
      var c = Object.assign({}, r);
      if(!num(r.sqft) && num(a.sqft)) c.sqft = String(Math.round(num(a.sqft)));
      c.unitPrice = String(Math.round(num(a.salePrice)));
      c.salePrice = c.unitPrice; c.psf = "";
      if(num(a.rentPcm) > 0) rentByBeds[beds] = num(a.rentPcm);
      applied++;
      return c;
    }
    return r;
  });
  sfh.mix = mix;
  // v10.58 — record that real prices came from AI market research, so the board paper / one-pager
  // can state the provenance ("per-type prices verified by AI research of local new-build launches").
  if(applied > 0) sfh.pricesSource = "AI market research";

  // Feed the per-type rents into capitalisation so a forward-sale / BTR valuation reflects the
  // real local rents, not a single benchmark. Two things are written:
  //   • marketRentPerUnitPa — the weighted-average market rent (drives the forward-fund exit).
  //   • rent1..rent4 — the per-bed rents the Capitalisation stage shows, so a Keystone build
  //     auto-fills those fields too (no separate "AI: research & fill area rents" click needed).
  if(Object.keys(rentByBeds).length){
    var wr = 0, wc = 0;
    (sfh.mix || []).forEach(function(r){
      var info2 = (typeof HOUSE_TYPES !== "undefined" && (HOUSE_TYPES[r.type] || HOUSE_TYPES["3-bed semi"])) || { beds:3 };
      var b = num(r.beds) || info2.beds || 3, rp = rentByBeds[b];
      if(rp > 0){ wr += rp * num(r.count); wc += num(r.count); }
    });
    var capPatch = {};
    if(wc > 0) capPatch.marketRentPerUnitPa = Math.round(wr / wc * 12);
    for(var bd = 1; bd <= 4; bd++){ if(num(rentByBeds[bd]) > 0) capPatch["rent" + bd] = String(Math.round(num(rentByBeds[bd]))); }
    if(capPatch.rent1 || capPatch.rent2 || capPatch.rent3 || capPatch.rent4) capPatch.rentSource = "AI market research";
    if(Object.keys(capPatch).length) data.capitalise = Object.assign({}, data.capitalise || {}, capPatch);
  }

  // Optimise toward the profit-maximising mix once REAL prices are in (only if it materially helps).
  var optimised = null;
  if(opts.optimise !== false && typeof optimiseSfhMix === "function"){
    var o = optimiseSfhMix(data, "profit", { minPct: sfh.optMinPct, maxPct: sfh.optMaxPct });
    if(o && o.optimised && o.optimised.mix && o.optimised.mix.length && o.uplift > 10000){
      sfh.mix = o.optimised.mix;
      optimised = { upliftPct: Math.round(o.upliftPct), surplus: o.optimised.surplus, current: o.current.surplus };
    }
  }
  return { data:data, applied:applied, optimised:optimised, rentByBeds:rentByBeds };
}

// ── v10.59 — KEYSTONE JOURNEY FILLERS ─────────────────────────────────────────
// So Keystone can fill the WHOLE journey (not just prices/rents), each stage that needs
// AI/benchmark judgement is a filler: { key, label, sys, prompt(data) → string, apply(data,obj) }.
// The orchestrator (screen-Keystone) calls the AI with prompt(), parses the JSON, and runs
// apply() to write it into the deal. Pure + testable; Due Diligence, Meetings, Data Room and the
// Risk Register are deliberately NOT here — those are left to a human.
function _kjContext(data){
  data = data || {};
  var l = data.land || {}, p = data.planning || {}, sfh = data.sfh || {};
  var town = (typeof cityName === "function" && typeof dealCityKey === "function") ? cityName(dealCityKey(data)) : (l.city || "the area");
  var units = num(l.units) || num(p.units) || (sfh.mix || []).reduce(function(a, r){ return a + num(r.count); }, 0) || 0;
  var ahPct = num(p.ahPct) || num(p.afhPct) || num((data.tenure || {}).ahPct) || num(sfh.ahPct) || 0;
  return { town:town, units:units, ahPct:ahPct, lpa:p.lpa || "", status:p.status || l.planningStatus || "",
    address:l.address || "", postcode:(l.postcode || "").toUpperCase(), acres:num(l.acres) || 0 };
}
function _kjPick(v, allowed, fallback){ v = String(v == null ? "" : v).toLowerCase().trim(); return allowed.indexOf(v) >= 0 ? v : fallback; }

var KEYSTONE_JOURNEY_FILLERS = [
  { key:"planning", label:"Planning strategy & risk",
    sys:"You are a UK residential planning consultant. Output STRICT JSON only — no prose, no markdown. Judgements are indicative and to be verified.",
    prompt:function(data){ var c=_kjContext(data);
      return "Assess planning for a "+c.units+"-home residential scheme in "+c.town+(c.lpa?" (LPA "+c.lpa+")":"")+", current planning status: "+(c.status||"unallocated/none")+
        ". Output EXACTLY this JSON: {\"riskLevel\":\"low|medium|high\",\"bng\":\"on_site|off_site|exempt\",\"gateway\":\"na\",\"planningProb\":<0-100 probability of achieving consent>,\"timelineMonths\":<realistic months to consent>,\"summary\":\"2-3 sentence planning strategy incl. the route (allocation/outline/full) and key policy risks\"}. Houses under 11m tall ⇒ gateway \"na\"."; },
    apply:function(data, o){ var p=data.planning||(data.planning={}); var ch=[];
      var rl=_kjPick(o.riskLevel,["low","medium","high"],""); if(rl){ p.riskLevel=rl; ch.push("Planning risk"); }
      var bng=_kjPick(o.bng,["on_site","off_site","exempt"],""); if(bng){ p.bng=bng; ch.push("Biodiversity Net Gain"); }
      var gw=_kjPick(o.gateway,["na","g2","g2a","g3"],""); if(gw){ p.gateway=gw; }
      if(num(o.planningProb)>0){ p.planningProb=Math.max(0,Math.min(100,Math.round(num(o.planningProb)))); ch.push("Planning probability"); }
      if(num(o.timelineMonths)>0){ p.planningTimelineMonths=Math.round(num(o.timelineMonths)); ch.push("Planning timeline"); }
      if(o.summary){ p.aiSummary=String(o.summary); ch.push("Planning summary"); }
      return ch; } },

  { key:"exit", label:"Exit strategy & target buyer",
    sys:"You are a UK residential development & investment adviser. Output STRICT JSON only — no prose, no markdown.",
    prompt:function(data){ var c=_kjContext(data);
      return "Recommend the exit for a "+c.units+"-home single-family housing scheme in "+c.town+" with "+c.ahPct+"% affordable. Output EXACTLY this JSON: {\"strategy\":\"plot_sales|bulk_sale_ha|forward_fund|forward_sale|stabilised|retain|phased\",\"investorType\":\"pension_fund|sovereign_wealth|reit|private_equity|asset_manager|family_office\",\"agent\":\"a suitable UK selling/transaction agent, e.g. Savills, JLL, Knight Frank, Carter Jonas\",\"netInitialYield\":<net initial yield % an institutional forward-fund/stabilised buyer would apply to this location, 3.75-5.5 — prime commuter towns price tighter (lower), secondary markets wider (higher)>,\"summary\":\"2-3 sentences: the primary exit (open-market plot sales for private homes; bulk sale of the affordable to a named local housing association), plus the institutional forward-fund alternative and who would buy\"}."; },
    apply:function(data, o){ var ex=data.exit||(data.exit={}); var ch=[];
      var st=_kjPick(o.strategy,["plot_sales","bulk_sale_ha","forward_fund","forward_sale","stabilised","retain","phased"],""); if(st){ ex.strategy=st; ch.push("Exit strategy"); }
      var it=_kjPick(o.investorType,["pension_fund","sovereign_wealth","reit","private_equity","asset_manager","family_office"],""); if(it){ ex.investorType=it; ch.push("Target investor"); }
      if(o.agent){ ex.agent=String(o.agent); ch.push("Transaction agent"); }
      // v10.71 — write the AI-refined net initial yield to Capitalisation (dealYield reads
      // cap.targetYield). Clamped to a realistic institutional band so a stray figure can't
      // distort the forward-fund value. Was: regional benchmark table only.
      var y=num(o.netInitialYield);
      if(y>=3 && y<=7){ data.capitalise=Object.assign({}, data.capitalise||{}, { targetYield:String(Math.round(y*100)/100) }); ch.push("Exit yield"); }
      if(o.summary){ ex.aiSummary=String(o.summary); ch.push("Exit summary"); }
      return ch; } },

  // v10.71 — Affordable tenure split. buildDealFromBrief drafts a generic 70/30 rent/shared-
  // ownership split of the affordable homes; this refines it to the local plan / NPPF policy
  // (social rent, affordable rent, shared ownership, First Homes) and writes data.tenure.mix so
  // the Tenure Mix stage's blended GDV reflects a policy-accurate split. Indicative — verify
  // against the adopted plan / S106.
  { key:"tenure", label:"Affordable tenure split (local plan policy)",
    sys:"You are a UK affordable-housing planning specialist. Output STRICT JSON only — no prose, no markdown. Indicative of typical local plan / NPPF policy, to be verified against the adopted plan and S106.",
    prompt:function(data){ var c=_kjContext(data);
      return "For a "+c.units+"-home scheme in "+c.town+(c.lpa?" (LPA "+c.lpa+")":"")+" providing "+c.ahPct+"% affordable housing, split the AFFORDABLE portion across tenures per typical English local-plan / NPPF policy. Output EXACTLY this JSON — the four values as % OF THE AFFORDABLE HOMES, summing to 100: {\"socialRent\":<%>,\"affordableRent\":<%>,\"sharedOwnership\":<%>,\"firstHomes\":<%>,\"summary\":\"1 sentence citing the policy basis\"}. Typical policy leans to rented tenures (social/affordable rent) as the majority, with shared ownership and a First Homes element (often ~25% of affordable) making up the rest; reflect the specific area where known."; },
    apply:function(data, o){ var c=_kjContext(data); var ah=num(c.ahPct); if(ah<=0) return [];
      var sr=Math.max(0,num(o.socialRent)), ar=Math.max(0,num(o.affordableRent)), so=Math.max(0,num(o.sharedOwnership)), fh=Math.max(0,num(o.firstHomes));
      var sum=sr+ar+so+fh; if(sum<=0) return [];
      // Scale each sub-tenure (a % of the affordable homes) to a % of the WHOLE scheme.
      function ofScheme(x){ return Math.round(ah * (x/sum)); }
      var mix={ sr:ofScheme(sr), ar:ofScheme(ar), so:ofScheme(so), first_homes:ofScheme(fh) };
      Object.keys(mix).forEach(function(k){ if(!mix[k]) delete mix[k]; });
      var affTotal=Object.keys(mix).reduce(function(a,k){ return a+mix[k]; },0);
      mix.oms=Math.max(0,100-affTotal);   // rounding is absorbed by open-market
      var t=data.tenure||{};
      data.tenure=Object.assign({}, t, { inputMode:"percent", totalUnits:(t.totalUnits||c.units||""), mix:mix });
      if(o.summary){ data.tenure.aiSummary=String(o.summary); }
      return ["Affordable tenure split"]; } },

  { key:"grants", label:"Grant & funding strategy",
    sys:"You are a UK affordable-housing grant & funding specialist (Homes England AHP, Brownfield/Infrastructure funds). Output STRICT JSON only — no prose, no markdown.",
    prompt:function(data){ var c=_kjContext(data);
      return "Draft a concise grant/funding strategy for a "+c.units+"-home scheme with "+c.ahPct+"% affordable in "+c.town+". Reference Homes England Affordable Homes Programme and any relevant Brownfield/Infrastructure funding. Output EXACTLY this JSON, each value 1-2 sentences: {\"gs_site\":\"\",\"gs_housing\":\"\",\"gs_viability\":\"\",\"gs_ask\":\"\",\"gs_strategy\":\"\"}."; },
    apply:function(data, o){ var g=data.grants||(data.grants={}); var ch=[];
      ["gs_site","gs_housing","gs_viability","gs_ask","gs_strategy"].forEach(function(k){ if(o[k]){ g[k]=String(o[k]); ch.push("Grants: "+k.replace("gs_","")); } });
      return ch; } },

  { key:"constraint", label:"Planning & GIS constraints",
    sys:"You are a UK planning & GIS constraints analyst. Output STRICT JSON only — no prose, no markdown. Indicative desktop screen, to be verified.",
    prompt:function(data){ var c=_kjContext(data);
      return "Desktop planning & GIS constraint screen for a residential site"+(c.address?" at "+c.address:"")+" ("+(c.postcode||"postcode unknown")+") in "+c.town+", ~"+c.acres+" acres. Consider Green Belt, Flood Zones, AONB/National Landscape, Conservation Area, listed buildings, TPOs, access/highways, contamination, ecology. Output EXACTLY this JSON: {\"score\":<0-100 developability>,\"verdict\":\"a short verdict phrase\",\"summary\":\"3-4 sentence constraints assessment\",\"constraints\":[\"key constraint 1\",\"key constraint 2\"]}."; },
    apply:function(data, o){ var ch=[];
      if(num(o.score)>0 || o.verdict || o.summary){
        var cons = Array.isArray(o.constraints) ? o.constraints.map(String) : [];
        data.constraintCheck = Object.assign({}, data.constraintCheck||{}, { results: {
          score: Math.max(0, Math.min(100, Math.round(num(o.score)||0))),
          verdict: o.verdict ? String(o.verdict) : "",
          site: _kjContext(data).address || _kjContext(data).postcode || "",
          date: (function(){ try { return new Date().toLocaleDateString("en-GB"); } catch(e){ return ""; } })(),
          report: [o.summary ? String(o.summary) : "", cons.length ? ("Key constraints: " + cons.join("; ")) : ""].filter(Boolean).join("\n\n")
        } });
        ch.push("Constraint Check assessment");
      }
      return ch; } },

  // v10.69 — Land Appraisal scorecard. Fills the five qualitative dropdowns on the Land
  // Appraisal screen (Proximity to Demand, Transport Connectivity, Ground Contamination,
  // Land Tenure, Planning Constraints) so the 0/100 opportunity score is populated by AI
  // rather than left at zero. v10.70 also estimates the existing-use (agricultural) value
  // £/acre, which sets the land-value floor and the pre-consent hope value. Desktop
  // judgement, to be verified on site.
  { key:"site", label:"Site appraisal — location, ground, tenure, existing-use value",
    sys:"You are a UK land & development site appraiser. Output STRICT JSON only — no prose, no markdown. Judgements are indicative desktop assessments, to be verified on site.",
    prompt:function(data){ var c=_kjContext(data);
      return "Desktop site appraisal for a "+c.units+"-home residential scheme"+(c.address?" at "+c.address:"")+" ("+(c.postcode||"postcode unknown")+") in "+c.town+", ~"+c.acres+" acres. Judge each factor from what a UK land buyer would infer from the location. Output EXACTLY this JSON: {\"proximity\":\"excellent|good|fair|poor\",\"transport\":\"excellent|good|fair|poor\",\"contamination\":\"clean|minor|unknown|major\",\"tenure\":\"freehold|long_leasehold|short_leasehold\",\"constraint\":\"none|minor|moderate|major\",\"existingUsePerAcre\":<£/acre existing-use value, 5000-40000>,\"summary\":\"1-2 sentences justifying the ratings\"}. proximity = walk/cycle access to shops, schools & employment. transport = train/bus/cycle connectivity. contamination = likely ground condition given prior use (greenfield ⇒ clean; unknown prior use ⇒ unknown). tenure = most likely land tenure (assume freehold unless clearly otherwise). constraint = planning-constraint severity (none/outline; TPO/listed adjacent; conservation/Flood Zone 2; Green Belt/Flood Zone 3). existingUsePerAcre = current use value BEFORE any planning uplift — bare agricultural/grazing ~£8k-£12k, better arable ~£12k-£18k, paddock/amenity ~£20k-£30k, serviced/brownfield higher; NOT the residential land value."; },
    apply:function(data, o){ var l=data.land||(data.land={}); var ch=[];
      var pr=_kjPick(o.proximity,["excellent","good","fair","poor"],""); if(pr){ l.proximity=pr; ch.push("Proximity to demand"); }
      var tr=_kjPick(o.transport,["excellent","good","fair","poor"],""); if(tr){ l.transport=tr; ch.push("Transport connectivity"); }
      var co=_kjPick(o.contamination,["clean","minor","unknown","major"],""); if(co){ l.contamination=co; ch.push("Ground contamination"); }
      var te=_kjPick(o.tenure,["freehold","long_leasehold","short_leasehold"],""); if(te){ l.tenure=te; ch.push("Land tenure"); }
      var cn=_kjPick(o.constraint,["none","minor","moderate","major"],""); if(cn){ l.constraint=cn; ch.push("Planning constraints"); }
      // Existing-use value floor: clamp to a sane band so a stray AI figure can't set an
      // absurd floor (e.g. quoting the residential land value by mistake).
      var eu=num(o.existingUsePerAcre); if(eu>=3000 && eu<=100000){ l.agriValPerAcre=Math.round(eu); ch.push("Existing-use value"); }
      if(o.summary){ l.appraisalAiSummary=String(o.summary); }
      return ch; } }
];

// v10.38 — preserveManualOnRebuild: when Keystone REBUILDS a deal from the brief, carry the
// user's manual downstream work into the freshly-built deal so a rebuild refreshes the scheme
// WITHOUT silently wiping planning judgement, verified prices and exit strategy. Mutates
// `built` in place and returns a list of human-readable labels of what was preserved (for a
// transparency banner). The scheme itself (units, house mix, GDV/RLV) is intentionally
// re-derived from the brief — only manual, non-brief judgement is carried over.
function _keystoneStageLabel(k){
  return ({ exit:"Exit Strategy & Target Investor", constraintCheck:"Constraint Check", dd:"Due Diligence",
    tenure:"Tenure Mix", hra:"High-Rise / Apartments", grants:"Grants", meetings:"Meetings",
    assetOptimiser:"Asset Optimiser", recovery:"Planning Recovery", epe:"Energy / EPE",
    scraper:"Import source", market:"Market data", riskRegister:"Risk Register", dataRoom:"Data Room" }[k]) || k;
}
function preserveManualOnRebuild(prev, built){
  prev = prev || {}; built = built || {};
  var kept = [];
  // 1) Whole stages Keystone never regenerates → keep the user's entirely.
  ["exit","constraintCheck","dd","tenure","hra","grants","meetings","assetOptimiser","recovery","epe","scraper","market","riskRegister","dataRoom"].forEach(function(k){
    var pv = prev[k];
    var hasContent = pv != null && (typeof pv !== "object" || Object.keys(pv).length > 0);
    if(hasContent && built[k] == null){ built[k] = pv; kept.push(_keystoneStageLabel(k)); }
  });
  // 2) Manual JUDGEMENT fields inside regenerated stages → keep the user's value when set.
  [ ["planning","status","Planning Status"],
    ["planning","riskLevel","Planning Risk Level"],
    ["planning","bng","Biodiversity Net Gain"],
    ["planning","gateway","Fire Safety Gateway"],
    ["planning","planningProb","Planning probability"],
    ["sfh","basePsf","Base Sale £/sqft"],
    ["sfh","buildPsf","Build £/sqft"] ].forEach(function(f){
    var st = f[0], key = f[1], label = f[2];
    var pv = prev[st] ? prev[st][key] : undefined;
    if(pv != null && pv !== ""){
      built[st] = Object.assign({}, built[st] || {});
      var bv = built[st][key];
      built[st][key] = pv;
      if(String(bv == null ? "" : bv) !== String(pv)) kept.push(label);
    }
  });
  // 3) If we kept a verified Base Sale £/sqft, reprice the freshly-generated mix to it (× per-type
  //    adjustment) so the scheme is internally consistent — otherwise the mix would carry the
  //    generic default price while the field shows the verified one.
  if(prev.sfh && prev.sfh.basePsf != null && prev.sfh.basePsf !== "" && built.sfh && Array.isArray(built.sfh.mix) && typeof HOUSE_TYPES !== "undefined"){
    var bp = num(prev.sfh.basePsf);
    if(bp > 0){
      built.sfh.mix = built.sfh.mix.map(function(r){
        var inf = HOUSE_TYPES[r.type] || HOUSE_TYPES["3-bed semi"] || {sqft:900, adj:1};
        var sq = num(r.sqft) || inf.sqft;
        var psf = Math.round(bp * (inf.adj || 1));
        var c = Object.assign({}, r, { psf:String(psf) });
        if(sq > 0) c.unitPrice = String(Math.round(sq * psf));
        return c;
      });
    }
  }
  return kept;
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
  module.exports = { buildDealFromBrief: buildDealFromBrief, detectJourney: detectJourney, keystoneBriefFromPlaconaSite: keystoneBriefFromPlaconaSite, rawImportBrief: rawImportBrief, KEYSTONE_BRIEF_SCHEMA: KEYSTONE_BRIEF_SCHEMA, KEYSTONE_JOURNEY_FILLERS: KEYSTONE_JOURNEY_FILLERS, applyMarketPricesAndOptimise: applyMarketPricesAndOptimise, scaleMixToUnits: scaleMixToUnits };
}
