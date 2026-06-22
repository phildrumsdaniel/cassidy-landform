#!/usr/bin/env node
/*
 * analysis/maldon-site1-hybrid.js
 *
 * MALDON — "Land South of Howells Farm" — SITE 1 ONLY (the extra 30-acre parcel /
 * Sites 2 & 3 / 500-unit concept is deliberately PARKED — Phil is concentrating on
 * Site 1 at 200 / 225 units first).
 *
 * RECOMMENDED STRUCTURE — the HYBRID (not "one HA takes all on rent"):
 *   • Market ~50%  → built for PRIVATE SALE @ £450/sqft (John Baker comp).
 *   • Affordable ~50% (S106 + extra) → handed to DELTA on rent, rent-capitalised
 *     @ 4.5% (Patric's method), built to the HA low-carbon spec (CHP D&C / NDSS),
 *     with an AHP GRANT sensitivity (£0 – £100k / affordable home).
 *
 * Why this is sound to sum: in the real engine RLV = GDV − devCost − profit, and
 * NEITHER finance NOR profit touches land (finance is on build+S106; profit is
 * 17.5% ON COST, explicitly ex-land). So the cost stack is GDV-independent: we run
 * the WHOLE mix through computeForwardFundMetrics for ONE consistent cost stack,
 * then swap in a MIXED-EXIT GDV (market rows at sale value, affordable rows
 * rent-capitalised + grant). One engine, one cost basis, two exit routes.
 *
 * Real email inputs (16-19 June 2026): rents = Beresfords (Danny); build £250/sqft
 * (Caddick) + HA spec on affordable; sale £450/sqft (John Baker); finance 10% over
 * 1+3 yr; profit 17.5% on cost; S106 £10k/unit (Patric); yield 4.5% (Patric).
 * Land: £14.0m headline (incl. hope value) / £12.0m John Baker "realistic".
 *
 * STILL MODELLED: the per-tenure unit split (no email gives a scheme mix) — a
 * representative 50% market / 50% affordable (AR 80% + SR 55%) split. Swap & re-run.
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
var ASK_HEADLINE  = 14000000;  // landowner suggested, incl. hope value
var ASK_REALISTIC = 12000000;  // John Baker's view — our land anchor
var SALE_PSF = 450;            // John Baker new-build comp (mid of £350-470)
var GRANT_STEPS = [0, 25000, 50000, 75000, 100000];  // AHP grant £/affordable home
var ACRES = { 200: 20, 225: 22.5 };   // Site 1 only, ~10 units/acre

// ── REAL Beresfords (Danny) market rents for Maldon houses ───────────────────
var BERESFORDS = {
  "2-bed semi (684)":      {type:"2-bed semi",     sqft:684,  rent:1650},
  "3-bed semi (831)":      {type:"3-bed semi",     sqft:831,  rent:1850},
  "3-bed detached (1001)": {type:"3-bed detached", sqft:1001, rent:2100},
  "3-bed semi (1124)":     {type:"3-bed semi",     sqft:1124, rent:2000},
  "4-bed semi (1270)":     {type:"4-bed semi",     sqft:1270, rent:2650},
  "4-bed detached (1425)": {type:"4-bed detached", sqft:1425, rent:2750}
};
var AR_FACTOR = 0.80, SR_FACTOR = 0.55;   // Affordable Rent ~80% MV, Social Rent ~55%

// ── Modelled unit mix — 50% market / 50% affordable (MODELLED) ────────────────
function maldonMix(units){
  var k = units / 200;
  function n(x){ return Math.round(x * k); }
  var B = BERESFORDS;
  return [
    // ── Market (built for PRIVATE SALE) — ~50% ──
    {label:"3-bed detached (1001)", count:n(30), tenure:"private", sqft:B["3-bed detached (1001)"].sqft, rentPcm:B["3-bed detached (1001)"].rent, type:B["3-bed detached (1001)"].type},
    {label:"3-bed semi (1124)",     count:n(25), tenure:"private", sqft:B["3-bed semi (1124)"].sqft,     rentPcm:B["3-bed semi (1124)"].rent,     type:B["3-bed semi (1124)"].type},
    {label:"4-bed semi (1270)",     count:n(25), tenure:"private", sqft:B["4-bed semi (1270)"].sqft,     rentPcm:B["4-bed semi (1270)"].rent,     type:B["4-bed semi (1270)"].type},
    {label:"4-bed detached (1425)", count:n(20), tenure:"private", sqft:B["4-bed detached (1425)"].sqft, rentPcm:B["4-bed detached (1425)"].rent, type:B["4-bed detached (1425)"].type},
    // ── Affordable Rent (~80% market) — HA low-carbon spec → DELTA ──
    {label:"2-bed semi AR (684)",   count:n(30), tenure:"ahp_affordable", sqft:B["2-bed semi (684)"].sqft, rentPcm:Math.round(B["2-bed semi (684)"].rent*AR_FACTOR), type:B["2-bed semi (684)"].type},
    {label:"3-bed semi AR (831)",   count:n(25), tenure:"ahp_affordable", sqft:B["3-bed semi (831)"].sqft, rentPcm:Math.round(B["3-bed semi (831)"].rent*AR_FACTOR), type:B["3-bed semi (831)"].type},
    // ── Social Rent (~55% market) — HA low-carbon spec → DELTA ──
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

// ── HYBRID valuation: one engine cost stack, mixed-exit GDV ───────────────────
// marketExit: "sale" (default, £450/sqft) or "btr" (market rows rent-capitalised).
function hybrid(units, grantPerHome, marketExit){
  var F = computeForwardFundMetrics(ffDeal(units));  // ONE consistent cost stack
  var mgmt = 1 - F.mgmtPct/100, yld = F.yield;

  var affRows = F.rows.filter(function(r){ return r.affordable; });
  var mktRows = F.rows.filter(function(r){ return !r.affordable; });

  // Affordable → Delta on rent, capitalised @ yield, + AHP grant.
  var affNetRent = affRows.reduce(function(a,r){ return a + r.grossRentPa*mgmt; }, 0);
  var affValue   = affNetRent / yld;
  var affUnits   = affRows.reduce(function(a,r){ return a + r.count; }, 0);
  var grant      = grantPerHome * affUnits;

  // Market → SALE @ £450/sqft (or BTR rent-capitalised if marketExit==="btr").
  var mktSale = mktRows.reduce(function(a,r){ return a + r.sqft*r.count*SALE_PSF; }, 0);
  var mktBtr  = mktRows.reduce(function(a,r){ return a + r.grossRentPa*mgmt; }, 0) / yld;
  var mktValue = (marketExit === "btr") ? mktBtr : mktSale;

  var gdv = mktValue + affValue + grant;
  var rlv = gdv - F.devCost - F.profit;          // GDV-independent cost stack
  return {
    F:F, units:F.totalUnits, affUnits:affUnits, mktUnits:F.totalUnits-affUnits,
    mktValue:mktValue, affValue:affValue, grant:grant, gdv:gdv,
    devCost:F.devCost, profit:F.profit, rlv:rlv,
    perUnit: rlv/F.totalUnits, perAcre: rlv/ACRES[units]
  };
}

// ── Bookend routes for context ────────────────────────────────────────────────
function wholeSchemeOnRent(units){            // "Delta takes all on rent" (worst)
  return computeForwardFundMetrics(ffDeal(units)).rlv;
}
function wholeSchemeOnSale(units){            // all-private sale @ £450 (SFH engine)
  var saleMix = maldonMix(units).map(function(r){
    return { type:r.type, count:r.count, sqft:r.sqft, unitPrice:String(r.sqft*SALE_PSF), tenure:"private" };
  });
  var d = { assetType:"sfh", land:{city:"maldon", acres:ACRES[units], price:ASK_HEADLINE},
    sfh:{ city:"maldon", buildPsf:250, profitPct:17.5, finRate:10, s106pu:10000, acres:ACRES[units], buildInclusive:true, mix:saleMix } };
  return calcDealMetrics(d).rlv;
}

// ── Report one Site-1 case ────────────────────────────────────────────────────
function reportCase(units){
  var h0 = hybrid(units, 0, "sale");          // hybrid @ £0 grant
  var F = h0.F;

  console.log("\n" + rule("═"));
  console.log("  SITE 1  —  " + units + " units  (" + h0.mktUnits + " market for sale / " +
    h0.affUnits + " affordable → Delta)   ~" + Math.round(h0.affUnits/units*100) + "% affordable");
  console.log("  HYBRID: sell the market half @ £" + SALE_PSF + "/sqft · Delta takes the affordable on rent @ " +
    (F.yield*100).toFixed(1) + "%");
  console.log(rule("═"));

  // Mix
  console.log("\n  MIX  (Beresfords market rents; affordable AR 80% / SR 55%)");
  console.log("  " + pad("Type", 22) + pad("Exit", 14) + padL("Units", 6) + padL("Sqft", 6) +
    padL("£/mo", 8) + padL("Value", 12));
  console.log("  " + rule("·").slice(0, 70));
  F.rows.forEach(function(r){
    var exit = r.affordable ? "Delta (rent)" : "Sale @"+SALE_PSF;
    var val  = r.affordable ? (r.grossRentPa*(1-F.mgmtPct/100)/F.yield) : (r.sqft*r.count*SALE_PSF);
    console.log("  " + pad(r.type + (r.affordable?" "+(r.tenure==="ahp_social"?"SR":"AR"):""), 22) +
      pad(exit, 14) + padL(r.count, 6) + padL(r.sqft, 6) + padL(gbp(r.rentPcm), 8) + padL(mm(val), 12));
  });

  // GDV bridge
  console.log("\n  GDV (mixed exit, £0 grant)");
  console.log("  · Market sale (" + h0.mktUnits + " homes @ £" + SALE_PSF + "/sqft) .. " + padL(mm(h0.mktValue), 14));
  console.log("  · Affordable capitalised (" + h0.affUnits + " @ " + (F.yield*100).toFixed(1) + "%) .. " + padL(mm(h0.affValue), 14));
  console.log("    ── Total GDV (ex-grant) ─────────────── " + padL(mm(h0.gdv), 14));

  // Cost stack (shared, from the real engine)
  var privBuild = F.rows.filter(function(r){return !r.affordable;}).reduce(function(a,r){return a+r.build;},0);
  var affBuild  = F.rows.filter(function(r){return  r.affordable;}).reduce(function(a,r){return a+r.build;},0);
  console.log("\n  COST STACK  (one consistent basis — the real engine)");
  console.log("  · Build @ £" + F.buildPsf + "/sqft (mkt " + mm(privBuild) + " + aff " + mm(affBuild) + " HA-spec) " + padL(mm(F.buildCost), 14));
  console.log("  · S106 @ £" + F.s106pu.toLocaleString() + "/unit ................... " + padL(mm(F.s106), 14));
  console.log("  · Finance @ " + F.finRate + "% (" + F.planningYears + "+" + F.buildYears + "yr) ......... " + padL(mm(F.finance), 14));
  console.log("    ── Total dev cost ──────────────────── " + padL(mm(F.devCost), 14));
  console.log("  · Profit @ " + F.profitPct + "% on cost (ex-land) ....... " + padL(mm(F.profit), 14));

  // Grant sensitivity → RLV vs land anchors
  console.log("\n  RESIDUAL LAND VALUE  by AHP grant per affordable home");
  console.log("  " + pad("Grant/aff home", 16) + padL("Grant total", 14) + padL("GDV", 12) +
    padL("RLV", 12) + padL("£/unit", 11) + "   vs £12m / £14m");
  console.log("  " + rule("·").slice(0, 78));
  GRANT_STEPS.forEach(function(g){
    var h = hybrid(units, g, "sale");
    var v12 = h.rlv - ASK_REALISTIC, v14 = h.rlv - ASK_HEADLINE;
    console.log("  " + pad(gbp(g), 16) + padL(mm(h.grant), 14) + padL(mm(h.gdv), 12) +
      padL(mm(h.rlv), 12) + padL(gbp(h.perUnit), 11) + "   " +
      (v12>=0?"✅":"❌") + mm(v12) + " / " + (v14>=0?"✅":"❌") + mm(v14));
  });

  // Context bookends
  var hb = hybrid(units, 0, "btr");
  console.log("\n  CONTEXT — RLV by structure (£0 grant)");
  console.log("  · Hybrid: market SOLD + affordable→Delta ...... " + padL(mm(h0.rlv), 12) + "  ◀ recommended");
  console.log("  · Hybrid variant: market BTR + affordable→Delta  " + padL(mm(hb.rlv), 12));
  console.log("  · Whole scheme SOLD (100% private @ £" + SALE_PSF + ") ..... " + padL(mm(wholeSchemeOnSale(units)), 12));
  console.log("  · Whole scheme to Delta ON RENT (worst) ........ " + padL(mm(wholeSchemeOnRent(units)), 12));
}

// ── Run ──────────────────────────────────────────────────────────────────────
console.log(rule("═"));
console.log("  LANDFORM — MALDON SITE 1 — RECOMMENDED HYBRID APPRAISAL");
console.log("  Land South of Howells Farm · market SOLD + affordable→Delta on rent + AHP grant");
console.log("  Real email data (rents/build/sale/terms) · unit-per-tenure mix MODELLED");
console.log("  Land anchor: £12.0m (John Baker realistic) — headline £14.0m shown alongside");
console.log(rule("═"));

[200, 225].forEach(reportCase);

console.log("\n" + rule("═"));
console.log("  Engine: js/01-config.js · computeForwardFundMetrics (cost stack) +");
console.log("          sale £" + SALE_PSF + "/sqft on market rows + rent-capitalisation on affordable.");
console.log("  RLV = GDV − devCost − profit; cost stack is GDV-independent so exits sum cleanly.");
console.log(rule("═") + "\n");
