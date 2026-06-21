#!/usr/bin/env node
/*
 * analysis/maldon-forward-fund.js
 *
 * MALDON — "Land South of Howells Farm" forward-fund / forward-commit appraisal.
 * Tests a forward-fund to a housing association (Delta and/or Latimer-Clarion)
 * taking the WHOLE scheme on its rent. Runs Patric's method through the REAL
 * Landform engine (computeForwardFundMetrics / calcDealMetrics in js/01-config.js)
 * so every figure matches the tool exactly.
 *
 *   Site 1            = 200 units
 *   Sites 1 + 2 + 3   = 500 units
 *
 * Method (Patric):
 *   1. realistic rent mix            → gross rent
 *   2. less 25% management           → net rent
 *   3. capitalise net rent at 4.5%   → GDV
 *   4. build £250/sqft base; HA low-carbon spec uplift on the affordable units
 *   5. less £10,000/unit S106
 *   6. finance 10%, 3-yr build + 1-yr planning = 4-year project (true multi-year)
 *   7. developer profit 17.5%
 *   8. = residual land value
 *
 * NOTE: every figure tagged "PLACEHOLDER" is a clearly-labelled Maldon stand-in,
 * pending the real rent mix / tenure split / sites-2&3 numbers from Patric's email.
 * Swap them in and re-run:  node analysis/maldon-forward-fund.js
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
function m(n){ return (n<0?"-":"") + "£" + (Math.abs(n)/1e6).toFixed(2) + "m"; }
function pad(s, w){ s = String(s); return s + " ".repeat(Math.max(0, w - s.length)); }
function padL(s, w){ s = String(s); return " ".repeat(Math.max(0, w - s.length)) + s; }
function rule(c){ return (c||"─").repeat(78); }

// ── LANDOWNER ASK — PLACEHOLDER (pending Patric's figure) ────────────────────
// Indicative ask used only for the "stacks / doesn't" headroom comparison.
var LANDOWNER_ASK = { 200: 14000000, 500: 33000000 };   // PLACEHOLDER £

// ── Scheme builders (clearly-labelled Maldon PLACEHOLDERS) ───────────────────
// ~50% affordable (S106 + additional affordable), balance private/PRS at market
// rent. Rents are LEFT BLANK so the engine derives them from the Maldon area
// benchmark (£1,258/mo 3-bed) × bed factor × tenure factor — i.e. straight from
// the tool. Override any row's rentPcm to pin an exact figure.
function maldonScheme(units){
  var k = units / 200;   // scale Site 1 → the 500-unit (Sites 1+2+3) case
  function n(x){ return Math.round(x * k); }
  return {
    assetType:"ff",
    land:{ city:"maldon", price:LANDOWNER_ASK[units] || 0, acres: n(32) },
    ff:{
      city:"maldon",
      yield:4.5, mgmtPct:25, buildPsf:250, s106pu:10000,
      profitPct:17.5, finRate:10, buildYears:3, planningYears:1,
      haSpecAffordable:true,                     // HA low-carbon spec on the affordable units
      acres: n(32),                              // PLACEHOLDER site area
      mix:[
        // ── Private / PRS (market rent) ── ~50%
        {type:"3-bed semi",     count:n(60), sqft:1000, tenure:"private"},   // PLACEHOLDER
        {type:"4-bed detached", count:n(40), sqft:1250, tenure:"private"},   // PLACEHOLDER
        // ── Affordable — Affordable Rent (~80% market) ── HA low-carbon spec
        {type:"2-bed terrace",  count:n(35), sqft:750,  tenure:"ahp_affordable"}, // PLACEHOLDER
        {type:"3-bed semi",     count:n(25), sqft:1000, tenure:"ahp_affordable"}, // PLACEHOLDER
        // ── Affordable — Social Rent (~60% market) ── HA low-carbon spec
        {type:"2-bed terrace",  count:n(25), sqft:750,  tenure:"ahp_social"},     // PLACEHOLDER
        {type:"3-bed semi",     count:n(15), sqft:1000, tenure:"ahp_social"}      // PLACEHOLDER
      ]
    }
  };
}

// ── Report one case ──────────────────────────────────────────────────────────
function reportCase(label, units){
  var deal = maldonScheme(units);
  var F = computeForwardFundMetrics(deal);
  var D = calcDealMetrics(deal);   // proves deal-state == engine

  console.log("\n" + rule("═"));
  console.log("  " + label + "  —  " + F.totalUnits + " units  (" +
    Math.round(F.affordablePct) + "% affordable, " + F.affordableUnits + " affordable / " +
    (F.totalUnits - F.affordableUnits) + " private-PRS)");
  console.log(rule("═"));

  // Rent mix → gross rent
  console.log("\n  RENT MIX (rents derived from Maldon area benchmark via the engine)");
  console.log("  " + pad("Type", 16) + pad("Tenure", 16) + padL("Units", 7) + padL("Sqft", 7) +
    padL("£/mo", 9) + padL("Gross £pa", 14));
  console.log("  " + rule("·").slice(0, 67));
  F.rows.forEach(function(r){
    console.log("  " + pad(r.type, 16) + pad(r.tenure, 16) + padL(r.count, 7) + padL(r.sqft, 7) +
      padL(gbp(r.rentPcm), 9) + padL(gbp(r.grossRentPa), 14));
  });

  console.log("\n  VALUATION (Patric's method, capitalised)");
  console.log("  1. Gross rent / yr ........... " + padL(gbp(F.grossRentPa), 16));
  console.log("  2. Less " + F.mgmtPct + "% management ...... " + padL("-" + gbp(F.grossRentPa - F.netRentPa), 16));
  console.log("     Net rent / yr ............. " + padL(gbp(F.netRentPa), 16));
  console.log("  3. Capitalise @ " + (F.yield*100).toFixed(2) + "% ........ " + padL(m(F.gdv), 16) + "   (GDV)");

  // Cost stack
  var privBuild = F.rows.filter(function(r){return !r.affordable;}).reduce(function(a,r){return a+r.build;},0);
  var affBuild  = F.rows.filter(function(r){return  r.affordable;}).reduce(function(a,r){return a+r.build;},0);
  console.log("\n  COST STACK");
  console.log("  4. Build @ £" + F.buildPsf + "/sqft base ... " + padL(m(F.buildCost), 16));
  console.log("       · private/PRS build ..... " + padL(m(privBuild), 16));
  console.log("       · affordable build ...... " + padL(m(affBuild), 16) + "   (HA low-carbon spec uplift applied)");
  if(F.fees > 0)        console.log("     Professional fees ........ " + padL(m(F.fees), 16));
  if(F.contingency > 0) console.log("     Contingency .............. " + padL(m(F.contingency), 16));
  console.log("  5. S106 @ £" + F.s106pu.toLocaleString() + "/unit ...... " + padL(m(F.s106), 16));
  console.log("  6. Finance @ " + F.finRate + "% (" + F.planningYears + "+" + F.buildYears +
    "yr, multi-year) " + padL(m(F.finance), 16));
  console.log("     ── Total development cost ─ " + padL(m(F.devCost), 16));
  console.log("  7. Developer profit @ " + F.profitPct + "% ... " + padL(m(F.profit), 16));

  console.log("\n  8. RESIDUAL LAND VALUE ....... " + padL(m(F.rlv), 16));
  console.log("       · per unit .............. " + padL(gbp(F.rlv / F.totalUnits), 16));
  if(num(deal.ff.acres) > 0)
    console.log("       · per acre (" + deal.ff.acres + " ac) ...... " + padL(gbp(F.rlv / deal.ff.acres), 16));

  // Landowner ask comparison
  var ask = LANDOWNER_ASK[units] || 0;
  if(ask > 0){
    var head = F.rlv - ask;
    console.log("\n  vs LANDOWNER ASK (PLACEHOLDER " + m(ask) + ")");
    console.log("     Headroom ................. " + padL(m(head), 16) + "   " +
      (head >= 0 ? "✅ STACKS" : "❌ DOES NOT STACK") +
      " (" + (ask>0 ? (head/ask*100).toFixed(1) : "0") + "% vs ask)");
  }

  // Deal-state reconciliation (engine == tool)
  var okGdv = Math.abs(D.gdv - F.gdv) < 2, okRlv = Math.abs(D.rlv - F.rlv) < 2;
  console.log("\n  reconciliation: calcDealMetrics GDV " + (okGdv?"✓":"✗") +
    "  RLV " + (okRlv?"✓":"✗") + "  (deal-state == engine)");

  return F;
}

// ── Sensitivity: yield (rows 4.0–5.0%) × rent level (cols) ───────────────────
function sensitivity(units){
  console.log("\n" + rule("─"));
  console.log("  SENSITIVITY — " + units + " units — RLV by capitalisation yield × rent level");
  console.log(rule("─"));
  var yields = [4.0, 4.25, 4.5, 4.75, 5.0];
  var rentLevels = [-10, -5, 0, 5, 10];   // % shift on the whole rent mix
  console.log("  " + pad("Yield \\ Rent", 14) + rentLevels.map(function(p){
    return padL((p>0?"+":"") + p + "%", 12);
  }).join(""));
  yields.forEach(function(y){
    var cells = rentLevels.map(function(p){
      var deal = maldonScheme(units);
      deal.ff.yield = y;
      // shift every row's rent by p% (engine derives the base rent, we scale it)
      var base = computeForwardFundMetrics(maldonScheme(units));
      deal.ff.mix.forEach(function(row, i){ row.rentPcm = base.rows[i].rentPcm * (1 + p/100); });
      return padL(m(computeForwardFundMetrics(deal).rlv), 12);
    });
    console.log("  " + pad(y.toFixed(2) + "%", 14) + cells.join(""));
  });
  console.log("  (base case = 4.50% yield, 0% rent shift)");
}

// ── Standard-appraisal cross-check: add the fees+contingency Patric's pure ────
// 8-step method omits, to show the swing a full Landform dev appraisal would book.
function withFullFees(units){
  var deal = maldonScheme(units);
  deal.ff.feesPct = 10; deal.ff.contingencyPct = 5;
  var full = computeForwardFundMetrics(deal);
  var pure = computeForwardFundMetrics(maldonScheme(units));
  console.log("\n  Cross-check — Patric's pure method vs a full Landform appraisal (" + units + " units):");
  console.log("     Patric (no fees/contingency) RLV ... " + padL(m(pure.rlv), 14));
  console.log("     + 10% fees + 5% contingency ........ " + padL(m(full.rlv), 14) +
    "   (Δ " + m(full.rlv - pure.rlv) + ")");
}

// ── Run ──────────────────────────────────────────────────────────────────────
console.log(rule("═"));
console.log("  LANDFORM — MALDON FORWARD-FUND APPRAISAL  (Land South of Howells Farm)");
console.log("  HA forward-commit (Delta / Latimer-Clarion) — whole scheme on rent");
console.log("  ALL FIGURES VIA THE REAL ENGINE · placeholders pending Patric's email");
console.log(rule("═"));

[200, 500].forEach(function(u){ reportCase(u === 200 ? "SITE 1" : "SITES 1+2+3", u); });
[200, 500].forEach(sensitivity);
[200, 500].forEach(withFullFees);

console.log("\n" + rule("═"));
console.log("  Engine: js/01-config.js · computeForwardFundMetrics / developmentFinanceCost");
console.log("  Tests:  node tests/run.js  (cases 32-33 lock this maths in)");
console.log(rule("═") + "\n");
