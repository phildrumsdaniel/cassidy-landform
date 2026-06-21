#!/usr/bin/env node
/*
 * analysis/maldon-forward-fund.js
 *
 * MALDON — "Land South of Howells Farm" forward-fund / forward-commit appraisal.
 * Forward-fund to a housing association (Delta — ex-CHP/Estuary — and/or Latimer/
 * Clarion) who may take the Section 106 + extra affordable (~50%) or ALL 500 units.
 * Patric's method, run through the REAL Landform engine (computeForwardFundMetrics /
 * developmentFinanceCost / calcDealMetrics in js/01-config.js).
 *
 *   Site 1            = 200 units   (John Baker: "at least 200")
 *   Sites 1 + 2 + 3   = 500 units   (200 + ~300 on the extra 30-acre parcel)
 *
 * Inputs now use the REAL figures from the 16-19 June 2026 emails / brief:
 *   • Rents      — Beresfords (Danny) market rental table for Maldon houses.
 *   • Build      — £250/sqft (Caddick base); HA low-carbon spec on affordable (CHP
 *                  D&C brief + NDSS — Delta requirement).
 *   • Sale       — John Baker comps: new build £350-470/sqft (use £450); bulk £212.
 *   • Finance    — 10%, 4-yr programme (1-yr planning + 3-yr build).
 *   • Profit     — 17.5% ON COST (brief).            • S106 — £10,000/unit (Patric).
 *   • Yield      — 4.5% capitalisation (Patric); also test Patric's 5% / £60m note.
 *   • Ask        — landowner £14m incl. hope value; John Baker thinks ~£12m realistic.
 *
 * STILL MODELLED (no per-tenure unit split was given in any email — flagged "MODELLED"):
 *   the number of units of each type/tenure. A representative 50% market-PRS /
 *   50% affordable split is used; swap in the real mix and re-run.
 */
var fs = require("fs"), path = require("path");

// ── Load the REAL engine (same harness the tests use) ────────────────────────
var noop = function(){ return null; };
var store = { getItem:noop, setItem:noop, removeItem:noop };
global.window = global;
global.React = { createElement: noop };
global.document = { getElementById:noop, createElement:function(){ return {style:{}, appendChild:noop}; }, addEventListener:noop, body:{appendChild:noop} };
global.localStorage = store; global.sessionStorage = store;
global.navigator = { userAgent:"node" }; global.location = { href:"", search:"" };
global.fetch = noop; global.alert = noop;
eval(fs.readFileSync(path.join(__dirname, "..", "js", "01-config.js"), "utf8"));

// ── Formatting helpers ───────────────────────────────────────────────────────
function gbp(n){ return (n<0?"-":"") + "£" + Math.round(Math.abs(n)).toLocaleString(); }
function mm(n){ return (n<0?"-":"") + "£" + (Math.abs(n)/1e6).toFixed(2) + "m"; }
function pad(s, w){ s = String(s); return s + " ".repeat(Math.max(0, w - s.length)); }
function padL(s, w){ s = String(s); return " ".repeat(Math.max(0, w - s.length)) + s; }
function rule(c){ return (c||"─").repeat(80); }

// ── Commercial terms (from the brief) ────────────────────────────────────────
var ASK_HEADLINE = 14000000;   // landowner suggested, incl. hope value
var ASK_REALISTIC = 12000000;  // John Baker's view
var SALE_PSF = 450;            // John Baker new-build comp (mid of £350-470)
var BULK_PSF = 212;            // Landform bulk-sale benchmark
var ACRES = { 200: 20, 500: 50 };   // ESTIMATE: ~10 units/acre (30 ac → ~300 homes)

// ── REAL Beresfords (Danny) market rents for Maldon houses ───────────────────
// type label → {sqft, rent £/mo}.  Used for the market / PRS units.
var BERESFORDS = {
  "2-bed semi (684)":      {type:"2-bed semi",     sqft:684,  rent:1650},
  "3-bed semi (831)":      {type:"3-bed semi",     sqft:831,  rent:1850},
  "3-bed detached (1001)": {type:"3-bed detached", sqft:1001, rent:2100},
  "3-bed semi (1124)":     {type:"3-bed semi",     sqft:1124, rent:2000},
  "4-bed semi (1270)":     {type:"4-bed semi",     sqft:1270, rent:2650},
  "4-bed detached (1425)": {type:"4-bed detached", sqft:1425, rent:2750}
};
// Affordable rent assumptions (% of the comparable Beresfords market rent):
//   Affordable Rent ~80%; Social Rent ~55%.  Affordable units get the HA spec build.
var AR_FACTOR = 0.80, SR_FACTOR = 0.55;

// ── Modelled unit mix (MODELLED — no per-tenure split in the emails) ─────────
// ~50% market-PRS at Beresfords market rent, ~50% affordable (AR + SR).
function maldonMix(units){
  var k = units / 200;
  function n(x){ return Math.round(x * k); }
  var B = BERESFORDS;
  return [
    // ── Market / PRS (private rent at Beresfords market levels) — ~50% ──
    {label:"3-bed detached (1001)", count:n(30), tenure:"private", sqft:B["3-bed detached (1001)"].sqft, rentPcm:B["3-bed detached (1001)"].rent, type:B["3-bed detached (1001)"].type},
    {label:"3-bed semi (1124)",     count:n(25), tenure:"private", sqft:B["3-bed semi (1124)"].sqft,     rentPcm:B["3-bed semi (1124)"].rent,     type:B["3-bed semi (1124)"].type},
    {label:"4-bed semi (1270)",     count:n(25), tenure:"private", sqft:B["4-bed semi (1270)"].sqft,     rentPcm:B["4-bed semi (1270)"].rent,     type:B["4-bed semi (1270)"].type},
    {label:"4-bed detached (1425)", count:n(20), tenure:"private", sqft:B["4-bed detached (1425)"].sqft, rentPcm:B["4-bed detached (1425)"].rent, type:B["4-bed detached (1425)"].type},
    // ── Affordable Rent (~80% market) — HA low-carbon spec ──
    {label:"2-bed semi AR (684)",   count:n(30), tenure:"ahp_affordable", sqft:B["2-bed semi (684)"].sqft, rentPcm:Math.round(B["2-bed semi (684)"].rent*AR_FACTOR), type:B["2-bed semi (684)"].type},
    {label:"3-bed semi AR (831)",   count:n(25), tenure:"ahp_affordable", sqft:B["3-bed semi (831)"].sqft, rentPcm:Math.round(B["3-bed semi (831)"].rent*AR_FACTOR), type:B["3-bed semi (831)"].type},
    // ── Social Rent (~55% market) — HA low-carbon spec ──
    {label:"2-bed semi SR (684)",   count:n(25), tenure:"ahp_social", sqft:B["2-bed semi (684)"].sqft, rentPcm:Math.round(B["2-bed semi (684)"].rent*SR_FACTOR), type:B["2-bed semi (684)"].type},
    {label:"3-bed semi SR (831)",   count:n(20), tenure:"ahp_social", sqft:B["3-bed semi (831)"].sqft, rentPcm:Math.round(B["3-bed semi (831)"].rent*SR_FACTOR), type:B["3-bed semi (831)"].type}
  ];
}

function ffDeal(units, over){
  over = over || {};
  return {
    assetType:"ff",
    land:{ city:"maldon", price:ASK_HEADLINE, acres:ACRES[units] },
    ff: Object.assign({
      city:"maldon", yield:4.5, mgmtPct:25, buildPsf:250, s106pu:10000,
      profitPct:17.5, profitBasis:"cost", finRate:10, buildYears:3, planningYears:1,
      haSpecAffordable:true, acres:ACRES[units], mix:maldonMix(units)
    }, over)
  };
}

// ── Report one forward-fund case ─────────────────────────────────────────────
function reportCase(label, units){
  var deal = ffDeal(units);
  var F = computeForwardFundMetrics(deal);
  var D = calcDealMetrics(deal);

  console.log("\n" + rule("═"));
  console.log("  " + label + "  —  " + F.totalUnits + " units  (" + Math.round(F.affordablePct) +
    "% affordable: " + F.affordableUnits + " affordable / " + (F.totalUnits - F.affordableUnits) + " market-PRS)");
  console.log("  Forward-fund: HA takes the whole scheme on rent · Patric's method");
  console.log(rule("═"));

  console.log("\n  RENT MIX (Beresfords market rents; affordable at AR 80% / SR 55%)");
  console.log("  " + pad("Type", 22) + pad("Tenure", 16) + padL("Units", 6) + padL("Sqft", 6) +
    padL("£/mo", 8) + padL("Gross £pa", 13));
  console.log("  " + rule("·").slice(0, 71));
  deal.ff.mix.forEach(function(row, i){
    var r = F.rows[i];
    console.log("  " + pad(row.label, 22) + pad(r.tenure, 16) + padL(r.count, 6) + padL(r.sqft, 6) +
      padL(gbp(r.rentPcm), 8) + padL(gbp(r.grossRentPa), 13));
  });

  console.log("\n  VALUATION (Patric's method)");
  console.log("  1. Gross rent / yr ............ " + padL(gbp(F.grossRentPa), 15));
  console.log("  2. Less " + F.mgmtPct + "% management ....... " + padL("-" + gbp(F.grossRentPa - F.netRentPa), 15));
  console.log("     Net rent / yr ............. " + padL(gbp(F.netRentPa), 15));
  console.log("  3. Capitalise @ " + (F.yield*100).toFixed(2) + "% ......... " + padL(mm(F.gdv), 15) + "   (GDV)");

  var privBuild = F.rows.filter(function(r){return !r.affordable;}).reduce(function(a,r){return a+r.build;},0);
  var affBuild  = F.rows.filter(function(r){return  r.affordable;}).reduce(function(a,r){return a+r.build;},0);
  console.log("\n  COST STACK");
  console.log("  4. Build @ £" + F.buildPsf + "/sqft base .... " + padL(mm(F.buildCost), 15));
  console.log("       · market/PRS build ...... " + padL(mm(privBuild), 15));
  console.log("       · affordable build ...... " + padL(mm(affBuild), 15) + "   (HA low-carbon spec uplift)");
  console.log("  5. S106 @ £" + F.s106pu.toLocaleString() + "/unit ....... " + padL(mm(F.s106), 15));
  console.log("  6. Finance @ " + F.finRate + "% (" + F.planningYears + "+" + F.buildYears +
    "yr) ..... " + padL(mm(F.finance), 15));
  console.log("     ── Total development cost ── " + padL(mm(F.devCost), 15));
  console.log("  7. Profit @ " + F.profitPct + "% on " + F.profitBasis + " .... " + padL(mm(F.profit), 15));

  console.log("\n  8. RESIDUAL LAND VALUE ....... " + padL(mm(F.rlv), 15));
  console.log("       · per unit .............. " + padL(gbp(F.rlv / F.totalUnits), 15));
  console.log("       · per acre (~" + deal.ff.acres + " ac est.) .. " + padL(gbp(F.rlv / deal.ff.acres), 15));

  console.log("\n  vs landowner ask £14.0m (John Baker ~£12.0m realistic)");
  [["£14.0m ask", ASK_HEADLINE], ["£12.0m realistic", ASK_REALISTIC]].forEach(function(a){
    var head = F.rlv - a[1];
    console.log("     " + pad("vs " + a[0], 22) + padL(mm(head), 12) + "   " +
      (head >= 0 ? "✅ STACKS" : "❌ short"));
  });

  var okGdv = Math.abs(D.gdv - F.gdv) < 2, okRlv = Math.abs(D.rlv - F.rlv) < 2;
  console.log("\n  reconciliation: calcDealMetrics GDV " + (okGdv?"✓":"✗") + "  RLV " + (okRlv?"✓":"✗") + "  (deal-state == engine)");
  return F;
}

// ── Sensitivity: yield × rent level ──────────────────────────────────────────
function sensitivity(units){
  console.log("\n" + rule("─"));
  console.log("  SENSITIVITY — " + units + " units — RLV by capitalisation yield × rent level");
  console.log("  (forward-fund, 50% affordable, profit 17.5% on cost)");
  console.log(rule("─"));
  var yields = [4.0, 4.25, 4.5, 4.75, 5.0];
  var rentLevels = [-10, -5, 0, 5, 10];
  console.log("  " + pad("Yield \\ Rent", 14) + rentLevels.map(function(p){ return padL((p>0?"+":"")+p+"%", 12); }).join(""));
  var base = computeForwardFundMetrics(ffDeal(units));
  yields.forEach(function(y){
    var cells = rentLevels.map(function(p){
      var deal = ffDeal(units, { yield:y });
      deal.ff.mix.forEach(function(row, i){ row.rentPcm = base.rows[i].rentPcm * (1 + p/100); });
      return padL(mm(computeForwardFundMetrics(deal).rlv), 12);
    });
    console.log("  " + pad(y.toFixed(2)+"%", 14) + cells.join(""));
  });
  console.log("  base = 4.50% yield, 0% rent shift");
}

// ── Cross-check scenarios ────────────────────────────────────────────────────
function crossChecks(units){
  console.log("\n" + rule("─"));
  console.log("  CROSS-CHECKS — " + units + " units (routes to value the scheme)");
  console.log(rule("─"));

  // A. Forward-fund 50/50 (headline)
  var ff = computeForwardFundMetrics(ffDeal(units));
  console.log("  A. Forward-fund 50% aff / 50% PRS on rent @4.5% (HEADLINE)  RLV " + padL(mm(ff.rlv), 12));

  // B. 100% market-rent BTR forward-fund @4.5% (no affordable discount, no HA spec)
  var allMkt = ffDeal(units, { haSpecAffordable:false });
  allMkt.ff.mix = allMkt.ff.mix.map(function(r){ return Object.assign({}, r, { tenure:"private", rentPcm:r.rentPcm }); });
  // restore market rent on the rows we'd discounted for affordable
  var mktMix = maldonMix(units);
  allMkt.ff.mix.forEach(function(r, i){
    // re-rent the (former) affordable rows at full market for their size
    if(/AR|SR/.test(mktMix[i].label)){
      var sz = mktMix[i].sqft;
      // find a Beresfords market rent for that size
      Object.keys(BERESFORDS).forEach(function(k){ if(BERESFORDS[k].sqft === sz) r.rentPcm = BERESFORDS[k].rent; });
    }
  });
  var btr = computeForwardFundMetrics(allMkt);
  console.log("  B. 100% market-rent BTR forward-fund @4.5% (upper bound)    RLV " + padL(mm(btr.rlv), 12));

  // C. All-private SALE @ £450/sqft (the brief's ~£9-10m route) via the SFH engine
  var saleMix = maldonMix(units).map(function(r){
    return { type:r.type, count:r.count, sqft:r.sqft, unitPrice:String(r.sqft*SALE_PSF), tenure:"private" };
  });
  var saleDeal = { assetType:"sfh", land:{city:"maldon", acres:ACRES[units], price:ASK_HEADLINE},
    sfh:{ city:"maldon", buildPsf:250, profitPct:17.5, finRate:10, s106pu:10000, acres:ACRES[units], buildInclusive:true, mix:saleMix } };
  var sale = calcDealMetrics(saleDeal);
  console.log("  C. 100% private SALE @ £" + SALE_PSF + "/sqft (SFH engine)        RLV " + padL(mm(sale.rlv), 12) +
    "   (brief: ~£9-10m)");

  // D. Patric's note: net rent ~£3m capitalised @5% ≈ £60m bid (500-unit basis)
  if(units === 500){
    console.log("  D. Patric note: net rent £3.0m @5% = GDV £60.0m (affordable-led HA bid cross-check)");
    console.log("       this scheme's net rent " + gbp(ff.netRentPa) + " @5% = GDV " + mm(ff.netRentPa/0.05));
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────
console.log(rule("═"));
console.log("  LANDFORM — MALDON FORWARD-FUND APPRAISAL  (Land South of Howells Farm)");
console.log("  HA forward-commit (Delta / Latimer-Clarion) — whole scheme on rent");
console.log("  REAL email data (rents/build/sale/terms) · unit-per-tenure mix MODELLED");
console.log(rule("═"));

[200, 500].forEach(function(u){ reportCase(u === 200 ? "SITE 1" : "SITES 1+2+3", u); });
[200, 500].forEach(crossChecks);
[200, 500].forEach(sensitivity);

console.log("\n" + rule("═"));
console.log("  Engine: js/01-config.js · computeForwardFundMetrics / developmentFinanceCost");
console.log("  Tests:  node tests/run.js  (cases 32-33 lock this maths in)");
console.log(rule("═") + "\n");
