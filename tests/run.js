#!/usr/bin/env node
/*
 * tests/run.js — headless consistency tests for the Landform appraisal engine.
 *
 * Why: the platform's credibility rests on every screen showing the SAME GDV /
 * RLV from one engine. We have fixed that by hand twice; these tests lock it in
 * so a future edit can't silently re-introduce a divergence. Pure Node, no
 * framework, no build step — matches the rest of the project.
 *
 * Run:  node tests/run.js        (exit code 1 on any failure)
 * CI:   .github/workflows/tests.yml runs it on every push / PR.
 */
var fs = require("fs"), path = require("path");

// ── Stub the browser globals that 01-config.js touches at load time ──────────
var noop = function(){ return null; };
var store = { getItem:noop, setItem:noop, removeItem:noop };
global.window = global;
global.React = { createElement: noop };
global.ReactDOM = {};
global.document = { getElementById:noop, createElement:function(){ return {style:{}, appendChild:noop}; }, addEventListener:noop, body:{appendChild:noop} };
global.localStorage = store; global.sessionStorage = store;
global.navigator = { userAgent:"node" }; global.location = { href:"", search:"" };
global.fetch = noop; global.alert = noop;

// Load the engine (defines computeSFHMetrics, calcDealMetrics, sfhAhFactor,
// computeTenureMetrics, areaMarketRentPa, buildHonestPrompt, MKT, …)
try {
  eval(fs.readFileSync(path.join(__dirname, "..", "js", "01-config.js"), "utf8"));
  // Also load the deal migrator so we can prove existing portfolio/history deals
  // still load and compute on the corrected engine (back-compat).
  eval(fs.readFileSync(path.join(__dirname, "..", "js", "lib-migrateLoadedDeal.js"), "utf8"));
} catch (e) {
  console.error("Could not load engine files:", e.message);
  process.exit(1);
}

// ── Tiny assertion harness ───────────────────────────────────────────────────
var passes = 0, failures = 0;
function ok(name, cond, detail){
  if (cond) { passes++; }
  else { failures++; console.error("  ✗ " + name + (detail ? "  — " + detail : "")); }
}
function near(name, a, b, tol){ ok(name, Math.abs(a - b) <= (tol || 1), "got " + a + " vs " + b); }

// ── Fixtures ─────────────────────────────────────────────────────────────────
// A Maldon SFH deal; tweak per test. unitPrice set so per-type psf is explicit.
function sfhDeal(over){
  over = over || {};
  var sfh = Object.assign({
    city:"maldon", buildPsf:220, profitPct:17.5, finRate:9, contingency:5,
    s106pu:11000, roads:12000, acres:32, ahPct:0,
    mix:[
      {type:"3-bed semi",    count:"120", sqft:"1020", unitPrice:String(1020*420), tenure:"private"},
      {type:"4-bed detached",count:"80",  sqft:"1300", unitPrice:String(1300*479), tenure:"private"}
    ]
  }, over.sfh || {});
  return { assetType:"sfh", land:{city:"maldon", price:14000000}, sfh:sfh, rlv:over.rlv || {} };
}

// Replicate the SFH-screen RLV formula (same inputs/formulae as screen-SFH.js) so
// the test proves the screen and the engine agree, not just the engine with itself.
function sfhScreenRlv(data){
  var s = data.sfh || {};
  var c = computeSFHMetrics(data);
  var totalBuild = c.buildCost, totalGdv = c.gdv, totalUnits = c.totalUnits;
  var inc = !!s.buildInclusive;
  var fees = totalBuild*0.10, cont = totalBuild*(numOr(s.contingency,5)/100), fin = (totalBuild+fees)*(numOr(s.finRate,7.5)/100);
  var s106 = totalUnits*numOr(s.s106pu,8000), roads = inc?0:totalUnits*numOr(s.roads,12000), infra = inc?0:num(s.acres)*53000;
  var profit = totalGdv*(numOr(s.profitPct,17.5)/100);
  return totalGdv - (totalBuild+fees+cont+fin+s106+roads+infra) - profit;
}

console.log("Landform engine consistency tests\n");

// 1 — GDV: engine == deal-state, and == retail when no AH
(function(){
  var d = sfhDeal();
  var c = computeSFHMetrics(d), dm = calcDealMetrics(d);
  near("GDV: engine == deal-state (no AH)", c.gdv, dm.gdv);
  near("GDV: == retail when no AH (factor 1)", c.gdv, c.retailGdv);
  ok("ahFactor == 1 when no AH", c.ahFactor === 1);
})();

// 2 — AH haircut applies and matches the tenure discount; engine == deal-state
(function(){
  var d = sfhDeal({ sfh:{ ahPct:50, ahTenure:"ahp_affordable" } });
  var c = computeSFHMetrics(d), dm = calcDealMetrics(d);
  near("AH factor 50% @ affordable(60%) = 0.80", c.ahFactor, 0.80, 0.0001);
  near("GDV blended == retail * ahFactor", c.gdv, c.retailGdv * c.ahFactor);
  near("GDV: engine == deal-state (with AH)", c.gdv, dm.gdv);
})();

// 3 — RLV agreement: engine == deal-state == SFH-screen formula
(function(){
  var d = sfhDeal({ sfh:{ ahPct:50, ahTenure:"ahp_affordable" } });
  var c = computeSFHMetrics(d), dm = calcDealMetrics(d);
  near("RLV: engine == deal-state", c.rlv, dm.rlv);
  near("RLV: engine == SFH-screen formula", c.rlv, sfhScreenRlv(d));
})();

// 4 — build-inclusive toggle zeroes roads/infra (no double-count)
(function(){
  var off = computeSFHMetrics(sfhDeal({ sfh:{ buildInclusive:false } }));
  var on  = computeSFHMetrics(sfhDeal({ sfh:{ buildInclusive:true } }));
  ok("roads+infra > 0 when toggle off", off.roads > 0 && off.infra > 0);
  ok("roads == 0 when build inclusive", on.roads === 0);
  ok("infra == 0 when build inclusive", on.infra === 0);
  near("RLV improves by exactly roads+infra when toggled on", on.rlv - off.rlv, off.roads + off.infra);
})();

// 5 — net land bid = gross RLV − acquisition costs
(function(){
  var d = sfhDeal({ rlv:{ includeAcqCosts:true } });
  var dm = calcDealMetrics(d);
  ok("acquisition costs > 0 when toggle on", dm.totalAcqCosts > 0);
  near("netLandBid == rlv − acquisition", dm.netLandBid, dm.rlv - dm.totalAcqCosts);
})();

// 6 — per-row tenure blend is authoritative; the overall AH% is NOT applied on top
(function(){
  var perRow = sfhDeal({ sfh:{ ahPct:50, mix:[
    {type:"3-bed semi",count:"100",sqft:"1020",unitPrice:String(1020*420),tenure:"ahp_social"},
    {type:"4-bed detached",count:"100",sqft:"1300",unitPrice:String(1300*479),tenure:"private"}
  ]}});
  var c = computeSFHMetrics(perRow);
  ok("hasNonPrivate true when a row is tagged", c.hasNonPrivate === true);
  // blended must equal the per-row sum, NOT retail*ahFactor (which would double-count)
  var rowBlend = (1020*420*100*0.55) + (1300*479*100*1.0);
  near("per-row blended GDV used (no double-count)", c.gdv, rowBlend, 5);
})();

// 7 — affordable rents auto-fill from the AREA market rent, override wins, proxy fallback
(function(){
  var d = { assetType:"sfh", land:{city:"maldon"}, sfh:{city:"maldon", basePsf:420, avgSqft:1000},
            tenure:{ totalUnits:100, inputMode:"units", mix:{ sr:40, ar:40, oms:20 } } };
  near("area market rent pa (Maldon £1180/mo)", areaMarketRentPa(d), 1180*12);
  var tm = computeTenureMetrics(d);
  function rentFor(k){ var r = tm.rows.filter(function(x){return x.td.key===k;})[0]; return r ? r.annualRent/r.units : 0; }
  near("Social Rent ≈ 60% of market", rentFor("sr"), 1180*12*0.6, 2);
  near("Affordable Rent ≈ 80% of market", rentFor("ar"), 1180*12*0.8, 2);
  var d2 = JSON.parse(JSON.stringify(d)); d2.tenure.sr_rentPa = 5000;
  var tm2 = computeTenureMetrics(d2);
  near("explicit rent override wins", tm2.rows.filter(function(x){return x.td.key==="sr";})[0].annualRent/40, 5000);
  ok("no-city deal has no area rent (falls back to proxy)", areaMarketRentPa({sfh:{}}) === 0);
})();

// 8 — buildHonestPrompt stays grounded and carries persona/tone/make-it-stack
(function(){
  var p = buildHonestPrompt(sfhDeal({ sfh:{ ahPct:50 } }), "TASK");
  ok("prompt keeps the verified deal state", p.indexOf("RESIDUAL LAND VALUE") >= 0);
  ok("prompt carries the developer persona", p.indexOf("best property developer in the UK") >= 0);
  ok("prompt is Cassidy-aligned", p.indexOf("CASSIDY GROUP LTD") >= 0);
  ok("prompt has the make-it-stack rule", p.indexOf("MAKE IT STACK") >= 0);
  ok("prompt instructs layman's terms", p.indexOf("layman") >= 0);
})();

// 9 — "Make It Stack" solver: answers are exact when fed back through the engine
(function(){
  var d = sfhDeal({ sfh:{ ahPct:50, ahTenure:"ahp_affordable" } });   // gross RLV is negative
  var opt = optimiseScheme(d, { targetRlv:0 });
  ok("optimiser flags a non-stacking scheme", opt.stacks === false);
  ok("optimiser returns at least one lever", opt.levers.length > 0);

  // buildPsf solution, fed back through calcDealMetrics, lands on the target (±rounding)
  var bl = opt.levers.filter(function(x){ return x.key === "buildPsf"; })[0];
  if (bl) {
    var d2 = JSON.parse(JSON.stringify(d)); d2.sfh.buildPsf = bl.required;
    near("solver buildPsf answer hits the target", calcDealMetrics(d2).rlv, 0, 130000);
  }
  // sales uplift solution moves RLV up to ~target (integer-% rounded)
  var sl = opt.levers.filter(function(x){ return x.key === "sales"; })[0];
  if (sl) {
    var d3 = JSON.parse(JSON.stringify(d));
    (d3.sfh.mix || []).forEach(function(r){ r.unitPrice = String(Math.round(num(r.unitPrice) * (1 + sl.required/100))); });
    ok("solver sales answer lifts RLV to about break-even", calcDealMetrics(d3).rlv >= -500000);
  }

  // all-in build option equals the roads+infra it removes
  var optAllIn = optimiseScheme(sfhDeal(), { targetRlv:0 });
  ok("solver surfaces the build-inclusive option", !!optAllIn.allInOption);
  if (optAllIn.allInOption) near("all-in delta == roads+infra removed", optAllIn.allInOption.delta, 200*12000 + 32*53000, 2);

  // a viable scheme reports stacks=true
  var good = optimiseScheme(sfhDeal({ sfh:{ buildInclusive:true } }), { targetRlv:0 });
  ok("optimiser reports a viable scheme as stacking", good.stacks === true);
})();

// 10 — Back-compat: an existing (legacy-shaped) portfolio/history deal still
// loads via migrateLoadedDeal and computes on the corrected engine without error.
(function(){
  var legacy = {
    _savedVersion:"9.20",
    assetType:"sfh",
    land:{ city:"maldon", price:14000000, units:200 },
    planning:{ afhPct:40, units:200 },          // legacy AH field name
    cap:{ targetYield:5 },                        // legacy 'cap' namespace (pre-'capitalise')
    sfh:{ city:"maldon", basePsf:380, buildPsf:200, profitPct:17.5,
      mix:[                                        // rows with no tenure / no buildInclusive / no roads
        {type:"3-bed semi",    count:"120", sqft:"1000", unitPrice:"380000"},
        {type:"4-bed detached",count:"80",  sqft:"1300", unitPrice:"560000"}
      ] }
  };
  var migrated, threw = false;
  try { migrated = migrateLoadedDeal(legacy).data; } catch(e){ threw = true; }
  ok("legacy deal migrates without throwing", !threw && !!migrated);
  if (migrated) {
    var dm = calcDealMetrics(migrated), sm = computeSFHMetrics(migrated);
    ok("legacy deal: units read correctly (200)", sm.totalUnits === 200);
    ok("legacy deal: GDV is a finite positive number", isFinite(dm.gdv) && dm.gdv > 0);
    ok("legacy deal: RLV is a finite number", isFinite(dm.rlv));
    // build-inclusive defaults OFF, so per-unit roads are still added (infra needs acreage, absent here)
    ok("legacy deal: roads still included (build-inclusive defaults off)", dm.roads > 0 && dm.infra === 0);
    var threw2 = false; try { optimiseScheme(migrated); } catch(e){ threw2 = true; }
    ok("legacy deal: Make-It-Stack solver runs without throwing", !threw2);
  }
})();

// 11 — Comprehensive house-type catalogue (studio → mansion, incl. conversions)
(function(){
  // back-compat: every type the auto-mix relies on must still exist
  ["1-bed terrace","2-bed terrace","2-bed semi","3-bed semi","3-bed detached","4-bed semi","4-bed detached"].forEach(function(t){
    ok("catalogue keeps '"+t+"' (back-compat)", !!HOUSE_TYPES[t]);
  });
  // new comprehensive range present
  ["Studio apartment","Conversion 2-bed flat","Conversion duplex","2-bed maisonette","3-bed link-detached","4-bed townhouse","Manor house","Mansion"].forEach(function(t){
    ok("catalogue includes '"+t+"'", !!HOUSE_TYPES[t]);
  });
  ok("catalogue is comprehensive (30+ types)", Object.keys(HOUSE_TYPES).length >= 30);
  ok("every type carries beds/sqft/adj", Object.keys(HOUSE_TYPES).every(function(k){ var t=HOUSE_TYPES[k]; return typeof t.beds==="number" && t.sqft>0 && t.adj>0; }));

  // a mixed stately-home-style scheme (conversion flats + mansion + new-build) computes cleanly,
  // pricing each row off the catalogue sqft × (basePsf × adj) when no explicit price is given
  var d = { assetType:"sfh", land:{city:"maldon"}, sfh:{ city:"maldon", basePsf:400, buildPsf:220,
    mix:[
      {type:"Conversion 2-bed flat", count:"10", tenure:"private"},
      {type:"Mansion",               count:"1",  tenure:"private"},
      {type:"3-bed detached",        count:"20", tenure:"private"}
    ] } };
  var c = computeSFHMetrics(d);
  ok("mixed catalogue scheme: units summed (31)", c.totalUnits === 31);
  ok("mixed catalogue scheme: finite positive GDV", isFinite(c.gdv) && c.gdv > 0);
  ok("mixed catalogue scheme: finite RLV", isFinite(c.rlv));
})();

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n" + passes + " passed, " + failures + " failed.");
process.exit(failures > 0 ? 1 : 0);
