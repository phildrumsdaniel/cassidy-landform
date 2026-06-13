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

// 12 — Mixed tenure/exit options + per-row build cost (conversion vs new-build)
(function(){
  // comprehensive tenure / exit-route catalogue available per row
  ["private","ahp_social","ahp_affordable","ahp_so","first_homes","dms","rent_to_buy","btr_operator","pension","retained_prs"].forEach(function(t){
    ok("ROUTE_DISCOUNT offers '"+t+"'", !!ROUTE_DISCOUNT[t] && ROUTE_DISCOUNT[t].pct > 0);
  });
  // a single row can override build £/sqft (a converted flat builds at a different rate to a new house)
  var d = sfhDeal({ sfh:{ buildPsf:200, mix:[
    {type:"3-bed semi",          count:"10", sqft:"1000", unitPrice:"400000", tenure:"private"},                  // scheme rate (200)
    {type:"Conversion 2-bed flat",count:"10", sqft:"800",  unitPrice:"320000", tenure:"ahp_so", buildPsf:"140"}    // per-row rate (140) + shared ownership
  ]}});
  var c = computeSFHMetrics(d);
  near("per-row build £/sqft is honoured", c.buildCost, 1000*200*10 + 800*140*10, 1);
  ok("mixed-tenure row blends (shared ownership is non-private)", c.hasNonPrivate === true);
})();

// 13 — Apartments (BTR/PBSA): engine mirrors the screen's sales value, plus the
// rent-capitalised investment value ("both ways to value a BTR block").
(function(){
  // Independent replica of the BTR/PBSA Block screen's sales-GDV formula.
  function hraScreenSalesGdv(data){
    var h = data.hra || {}; var city = ((h.city) || (data.land && data.land.city) || "").toLowerCase();
    var storeys = num(h.storeys), fp = num(h.fp), eff = numOr(h.eff, 80);
    var gia2 = fp * storeys, nia = gia2 * (eff / 100);
    var ss = numOr(h.ss, 20), os = numOr(h.os, 50), ts = numOr(h.ts, 30);
    var ssqft = numOr(h.ssqft, 380), osqft = numOr(h.osqft, 520), tsqft = numOr(h.tsqft, 750);
    var su = (nia > 0 && ss > 0 && ssqft > 0) ? Math.round(nia * (ss / 100) / ssqft) : 0;
    var ou = (nia > 0 && os > 0 && osqft > 0) ? Math.round(nia * (os / 100) / osqft) : 0;
    var tu = (nia > 0 && ts > 0 && tsqft > 0) ? Math.round(nia * (ts / 100) / tsqft) : 0;
    var mktSalePsf = num(data.rlv && data.rlv.salePsf) || (city && PC_PSF && PC_PSF[city.substring(0,3).toUpperCase()]) || 260;
    var sPsf = num(h.sPsf) || Math.round(mktSalePsf * 0.92);
    var oPsf = num(h.oPsf) || Math.round(mktSalePsf);
    var tPsf = num(h.tPsf) || Math.round(mktSalePsf * 1.08);
    var fl = numOr(h.fl, 0.5); var blend = 1 + (storeys > 1 ? (storeys / 2) * fl / 100 : 0);
    return su * ssqft * sPsf * blend + ou * osqft * oPsf * blend + tu * tsqft * tPsf * blend;
  }
  var d = { assetType:"btr", land:{city:"manchester"}, hra:{ city:"manchester", storeys:10, fp:8000, eff:80, ss:20, os:50, ts:30 } };
  var H = computeHRAMetrics(d);
  ok("apartments: units computed", H.units > 0);
  near("apartments: engine sales GDV == screen formula", H.salesGdv, hraScreenSalesGdv(d), 1);
  ok("apartments: sales GDV positive", H.salesGdv > 0);
  ok("apartments: investment value positive (rent-capitalised)", H.investmentValue > 0);
  near("apartments: investment value == net rent / yield", H.investmentValue, H.annualRentNet / H.yield, 1);
  ok("apartments: both RLVs are finite", isFinite(H.rlv) && isFinite(H.investmentRlv));
  ok("apartments: high-rise costs included (lifts/sprinklers/etc.)", H.hrCosts > 0);
})();

// 14 — Existing-property evaluator: value as-standing vs redevelop, and uplift
(function(){
  var d = { assetType:"property", epe:{ city:"manchester", salePsf:300, propSqft:1000, condition:"average",
    newUnits:4, newSqft:900, newPsf:300, buildPsf:200, profitPct:17.5, finRate:7.5, s106pu:8000 } };
  var E = computeEPEMetrics(d);
  near("EPE: current value as-standing", E.currentVal, 1000*300*1.0, 1);
  near("EPE: redevelopment GDV", E.newGdv, 4*900*300, 1);
  // devCost = build + 10% fees + finance + s106 + demolish
  var build = 4*900*200, fees = build*0.10, fin = (build+fees)*0.075, s106 = 4*8000, demo = 15000;
  near("EPE: redevelopment residual (devRLV)", E.devRlv, (4*900*300) - (build+fees+fin+s106+demo) - (4*900*300*0.175), 2);
  near("EPE: uplift == devRLV − current value", E.uplift, E.devRlv - E.currentVal, 1);
  ok("EPE: viability flag is boolean", typeof E.viable === "boolean");
})();

// 15 — "Enter once, flows everywhere": shared-input propagation (applySharedInput)
(function(){
  var anyStage = function(){ return true; };
  var d1 = applySharedInput({}, "fin", "buildPsf", 250, "fin", anyStage);
  ok("buildPsf entered on Fin flows to RLV", d1.rlv && d1.rlv.buildPsf === 250);
  ok("buildPsf entered on Fin flows to SFH", d1.sfh && d1.sfh.buildPsf === 250);
  var d2 = applySharedInput({}, "sfh", "basePsf", 400, "sfh", anyStage);
  ok("sale £/sqft alias: sfh.basePsf → rlv.salePsf", d2.rlv && d2.rlv.salePsf === 400);
  var d3 = applySharedInput({}, "rlv", "salePsf", 420, "rlv", anyStage);
  ok("sale £/sqft alias: rlv.salePsf → sfh.basePsf", d3.sfh && d3.sfh.basePsf === 420);
  var d4 = applySharedInput({}, "planning", "ahPct", 40, "planning", anyStage);
  ok("affordable % flows planning → sfh & tenure", d4.sfh.ahPct === 40 && d4.tenure.ahPct === 40);
  var d5 = applySharedInput({_completedStages:{rlv:true}}, "fin", "buildPsf", 300, "fin", anyStage);
  ok("a completed/locked sibling stage is never clobbered", !(d5.rlv && d5.rlv.buildPsf === 300));
  var d6 = applySharedInput({}, "land", "address", "1 Test St", "land", anyStage);
  ok("a non-shared field stays local (no spurious propagation)", d6.land.address === "1 Test St" && !d6.rlv);
})();

// 16 — EPE engine mirrors the Property Evaluator screen formula (condition modifier)
(function(){
  // independent replica of the screen's as-standing value for a condition case
  function epeScreenCurrentVal(data){
    var ep = data.epe || {};
    var pcData = (ep.postcode) ? lookupPostcode(ep.postcode) : null;
    var salePsf = num(ep.salePsf) || (pcData && pcData.salePsf) || 280;
    var propSqft = num(ep.propSqft) || 900;
    var condMod = ({excellent:1.15,good:1.05,average:1.0,poor:0.88,derelict:0.70})[ep.condition] || 1.0;
    var houseVal = Math.round(propSqft * salePsf * condMod);
    return Math.round((houseVal + 0) * 1); // no garden / no parking in this fixture
  }
  var d = { assetType:"property", epe:{ city:"manchester", salePsf:300, propSqft:1200, condition:"good", newUnits:0 } };
  near("EPE engine current value == screen formula (good condition)", computeEPEMetrics(d).currentVal, epeScreenCurrentVal(d), 1);
})();

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n" + passes + " passed, " + failures + " failed.");
process.exit(failures > 0 ? 1 : 0);
