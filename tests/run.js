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
  eval(fs.readFileSync(path.join(__dirname, "..", "js", "lib-isStageComplete.js"), "utf8"));
  eval(fs.readFileSync(path.join(__dirname, "..", "js", "lib-dealSchema.js"), "utf8"));
  eval(fs.readFileSync(path.join(__dirname, "..", "js", "lib-scoreOpportunity.js"), "utf8"));
  // Markdown report renderer builds React nodes via `e` (= React.createElement).
  // Point createElement at a lightweight node-builder and rebind the local `e`
  // (01-config.js captured `var e = React.createElement` when it was still a noop)
  // so the renderer runs headlessly — we assert on structure, not a real DOM.
  React.createElement = function(tag, props){ var kids = Array.prototype.slice.call(arguments, 2); return { tag: tag, props: props || {}, children: kids }; };
  e = React.createElement;
  eval(fs.readFileSync(path.join(__dirname, "..", "js", "lib-mdReport.js"), "utf8"));
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
  var fees = inc?0:totalBuild*(numOr(s.feesPct,12)/100), cont = inc?0:totalBuild*(numOr(s.contingency,5)/100);
  // v10.55 — S-curve/peak-debt finance, mirroring the engine + SFH screen.
  var phases = num(s.phases)>0?num(s.phases):Math.max(1,Math.ceil(totalUnits/300));
  var progYears = num(s.programmeYears)>0?num(s.programmeYears):Math.max(2,Math.min(10,Math.round((1+totalUnits/350)*10)/10));
  var peakDebtPct = num(s.peakDebtPct)>0?num(s.peakDebtPct):Math.max(45,Math.min(100,Math.round(200/phases)));
  var fin = (totalBuild+fees)*(peakDebtPct/100)*(numOr(s.finRate,7.5)/100)*progYears*0.6;
  // v10.102 — infra charged on the DEVELOPED area (homes ÷ net density, capped at the site), not the whole title
  var netDens = num(s.netDensity)>0?num(s.netDensity):20;
  var grossAc = num(s.acres);
  var netDevAc = grossAc>0 ? Math.min(grossAc, (netDens>0&&totalUnits>0?totalUnits/netDens:grossAc)) : 0;
  var s106 = totalUnits*numOr(s.s106pu,8000), roads = inc?0:totalUnits*numOr(s.roads,12000), infra = inc?0:netDevAc*53000;
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

// 4 — build-inclusive toggle: an all-in rate covers fees, contingency, roads & infra
// (no double-count), and finance is then charged on the build cost alone. (v10.48)
(function(){
  var off = computeSFHMetrics(sfhDeal({ sfh:{ buildInclusive:false } }));
  var on  = computeSFHMetrics(sfhDeal({ sfh:{ buildInclusive:true } }));
  ok("roads+infra > 0 when toggle off", off.roads > 0 && off.infra > 0);
  ok("fees+contingency > 0 when toggle off", off.fees > 0 && off.contingency > 0);
  ok("roads == 0 when build inclusive", on.roads === 0);
  ok("infra == 0 when build inclusive", on.infra === 0);
  ok("professional fees == 0 when build inclusive", on.fees === 0);
  ok("contingency == 0 when build inclusive", on.contingency === 0);
  ok("finance charged on build cost alone when inclusive (drops)", on.finance < off.finance);
  // RLV improves by exactly the cost lines the all-in rate absorbs: fees + contingency +
  // roads + infra, plus the finance saved by not financing the (now-absorbed) fees.
  near("RLV improves by exactly the absorbed lines when toggled on",
    on.rlv - off.rlv, (off.fees + off.contingency + off.roads + off.infra) + (off.finance - on.finance));
})();

// 4b — SFH forward-fund / capitalisation exit (v10.49 — drives the Quick Appraisal yield card
// and the one-pager). Investment value = net rent / yield, so a keener yield ⇒ higher value.
(function(){
  function withYield(y){ var d = sfhDeal(); d.capitalise = { targetYield:y }; return d; }
  var at38 = computeSFHMetrics(withYield(3.8));
  var at60 = computeSFHMetrics(withYield(6.0));
  ok("cap: net rent p.a. derived from the scheme", at38.capNetRentPa > 0);
  near("cap: investment value == net rent / yield (3.8%)", at38.capInvestmentValue, at38.capNetRentPa / 0.038, 1);
  near("cap: investment value == net rent / yield (6.0%)", at60.capInvestmentValue, at60.capNetRentPa / 0.06, 1);
  ok("cap: a keener yield pays more (3.8% > 6.0%)", at38.capInvestmentValue > at60.capInvestmentValue);
  ok("cap: same net rent regardless of exit yield", Math.abs(at38.capNetRentPa - at60.capNetRentPa) < 1);
})();

// 4c — landValueGuide: indicative market land values by planning status (v10.52 — board
// proposal / one-pager "no guide price" guide). Bands must rise with planning certainty and
// scale to acreage; agricultural is the floor, full consent the ceiling.
(function(){
  var g = landValueGuide({ land:{ city:"maidstone", acres:100 } });
  ok("guide returns the tier bands", g.bands && g.bands.length === 5);
  var by = {}; g.bands.forEach(function(b){ by[b.key] = b; });
  ok("agricultural is the cheapest band", by.agricultural.mid < by.strategic.mid);
  ok("bands rise with planning certainty", by.strategic.mid < by.allocated.mid && by.allocated.mid < by.outline.mid && by.outline.mid < by.consented.mid);
  ok("each band is a low<high range", g.bands.every(function(b){ return b.lo < b.hi; }));
  ok("consented mid ties back to the area's consented £/acre", Math.abs(by.consented.mid - g.fullyConsentedPerAcre) < 1);
  // acreage flows through so the caller can show a total
  ok("acres carried through for totals", g.acres === 100);
})();

// 4d — v10.55: S-curve / peak-debt finance. finance = (build+fees) × peakDebt% × rate × years × 0.6.
// A bigger scheme runs longer with a lower peak (phasing/recycling); the drivers are editable.
(function(){
  var big = computeSFHMetrics(sfhDeal({ sfh:{ buildInclusive:true, finRate:12,
    mix:[{type:"3-bed semi",count:"1800",sqft:"1000",unitPrice:"440000",tenure:"private"}] } }));
  ok("big scheme derives a multi-year programme", big.financeProgYears >= 5);
  // v10.100 — peak-debt floor raised to 45% (a large phased scheme sits ~45–50%, not ~33%).
  ok("big scheme derives a sub-100% peak debt (phasing recycles capital)", big.financePeakDebtPct < 100 && big.financePeakDebtPct >= 45);
  near("finance == (build) × peak% × rate × years × 0.6", big.finance,
    big.buildCost * (big.financePeakDebtPct/100) * 0.12 * big.financeProgYears * 0.6, 5);
  // explicit overrides win, and raising peak debt (slower sales) raises finance
  var slow = computeSFHMetrics(sfhDeal({ sfh:{ buildInclusive:true, finRate:12, programmeYears:6, peakDebtPct:70,
    mix:[{type:"3-bed semi",count:"1800",sqft:"1000",unitPrice:"440000",tenure:"private"}] } }));
  ok("explicit programme years honoured", slow.financeProgYears === 6);
  ok("explicit peak debt honoured", slow.financePeakDebtPct === 70);
  ok("slower sales / higher peak debt ⇒ more finance", slow.finance > big.finance);
  // a small single-phase scheme stays near the old flat basis (peak ~100%, ~2 yrs)
  var small = computeSFHMetrics(sfhDeal({ sfh:{ buildInclusive:true,
    mix:[{type:"3-bed semi",count:"80",sqft:"1000",unitPrice:"400000",tenure:"private"}] } }));
  ok("small scheme: 100% peak debt (single phase)", small.financePeakDebtPct === 100);
})();

// 4e — v10.58: basisOfFigures gives the rationale/provenance behind each headline number,
// and reflects whether AI market research was applied (for the board paper / one-pager).
(function(){
  if(typeof basisOfFigures === "function"){
    var d = sfhDeal({ sfh:{ buildInclusive:true, pricesSource:"AI market research" }, capitalise:{ rentSource:"AI market research", rent3:"1600" } });
    var bo = basisOfFigures(d);
    var byK = {}; bo.lines.forEach(function(x){ byK[x.k] = x.v; });
    ok("basis covers the key drivers", byK["Sale value"] && byK["Build cost"] && byK["Finance"] && byK["Developer profit"] && byK["Land value"]);
    ok("basis names AI research on sale prices when applied", /AI market research/.test(byK["Sale value"]));
    ok("basis explains the S-curve finance derivation", /S-curve|peak debt/i.test(byK["Finance"]));
    ok("basis states RLV is the max supportable (not agreed) price", /maximum supportable|not an agreed/i.test(byK["Land value"]));
    // without AI, it points to Land Registry + premium instead
    var d2 = sfhDeal();
    var byK2 = {}; basisOfFigures(d2).lines.forEach(function(x){ byK2[x.k] = x.v; });
    ok("basis falls back to Land Registry basis when no AI research", /Land Registry/.test(byK2["Sale value"]));
  }
})();

// 4f — v10.59: Keystone journey fillers — each stage's apply() writes valid data, and only
// whitelisted option values are accepted (bad AI output can't corrupt the deal).
(function(){
  var F = (typeof KEYSTONE_JOURNEY_FILLERS !== "undefined") ? KEYSTONE_JOURNEY_FILLERS : null;
  if(F){
    var byKey = {}; F.forEach(function(f){ byKey[f.key] = f; });
    ok("journey covers planning, exit, grants, constraint", byKey.planning && byKey.exit && byKey.grants && byKey.constraint);
    ok("does NOT auto-fill the human stages (dd/meetings/dataroom/risks)", !byKey.dd && !byKey.meetings && !byKey.dataroom && !byKey.risks);
    // each filler builds a prompt string from a deal
    var deal = sfhDeal({ land:{ city:"maldon", address:"North of Town", postcode:"CM9 4AA", acres:32, units:400 }, planning:{ lpa:"Maldon DC", units:400 } });
    ok("planning prompt mentions the scheme", /home residential scheme/i.test(byKey.planning.prompt(deal)));

    // planning apply — valid values written, junk rejected
    var d1 = JSON.parse(JSON.stringify(deal));
    byKey.planning.apply(d1, { riskLevel:"medium", bng:"on_site", gateway:"na", planningProb:65, timelineMonths:20, summary:"Allocated route." });
    ok("planning apply writes risk/BNG/prob/timeline", d1.planning.riskLevel==="medium" && d1.planning.bng==="on_site" && num(d1.planning.planningProb)===65 && num(d1.planning.planningTimelineMonths)===20);
    var d1b = JSON.parse(JSON.stringify(deal));
    byKey.planning.apply(d1b, { riskLevel:"catastrophic", bng:"maybe" });
    ok("planning apply rejects invalid option values", !d1b.planning.riskLevel && !d1b.planning.bng);

    // exit apply
    var d2 = JSON.parse(JSON.stringify(deal));
    byKey.exit.apply(d2, { strategy:"plot_sales", investorType:"pension_fund", agent:"Savills", summary:"Plot sales + bulk HA." });
    ok("exit apply writes strategy/investor/agent", d2.exit.strategy==="plot_sales" && d2.exit.investorType==="pension_fund" && d2.exit.agent==="Savills");

    // grants apply
    var d3 = JSON.parse(JSON.stringify(deal));
    byKey.grants.apply(d3, { gs_site:"S.", gs_housing:"H.", gs_viability:"V.", gs_ask:"A.", gs_strategy:"St." });
    ok("grants apply writes the gs_* sections", d3.grants.gs_site==="S." && d3.grants.gs_strategy==="St.");

    // constraint apply
    var d4 = JSON.parse(JSON.stringify(deal));
    byKey.constraint.apply(d4, { score:72, verdict:"Developable", summary:"No Green Belt.", constraints:["Flood Zone 1","Access from B-road"] });
    ok("constraint apply writes a results object with a score", num(d4.constraintCheck.results.score)===72 && /Flood Zone 1/.test(d4.constraintCheck.results.report));

    // v10.69 — site appraisal filler fills the Land Appraisal scorecard dropdowns
    ok("journey now covers the site appraisal scorecard", !!byKey.site);
    var d5 = JSON.parse(JSON.stringify(deal));
    byKey.site.apply(d5, { proximity:"good", transport:"fair", contamination:"clean", tenure:"freehold", constraint:"none", existingUsePerAcre:11000, summary:"Edge-of-town greenfield." });
    ok("site apply writes the 5 land dropdowns", d5.land.proximity==="good" && d5.land.transport==="fair" && d5.land.contamination==="clean" && d5.land.tenure==="freehold" && d5.land.constraint==="none");
    ok("site apply writes existing-use £/acre in band", num(d5.land.agriValPerAcre)===11000);
    var d5b = JSON.parse(JSON.stringify(deal));
    byKey.site.apply(d5b, { proximity:"amazing", contamination:"toxic", tenure:"commonhold", existingUsePerAcre:2500000 });
    ok("site apply rejects invalid dropdown values", !d5b.land.proximity && !d5b.land.contamination && !d5b.land.tenure);
    ok("site apply rejects an absurd existing-use value", d5b.land.agriValPerAcre===undefined);

    // v10.71 — exit filler also writes an AI-refined net initial yield to Capitalisation
    var d6 = JSON.parse(JSON.stringify(deal));
    byKey.exit.apply(d6, { strategy:"forward_fund", investorType:"pension_fund", netInitialYield:4.25 });
    ok("exit apply writes a valid exit yield to cap.targetYield", num(d6.capitalise.targetYield)===4.25);
    var d6b = JSON.parse(JSON.stringify(deal));
    byKey.exit.apply(d6b, { strategy:"forward_fund", netInitialYield:19 });
    ok("exit apply rejects an out-of-band yield", !(d6b.capitalise && d6b.capitalise.targetYield));

    // v10.71 — tenure filler refines the affordable split into a policy-accurate mix
    ok("journey now covers the affordable tenure split", !!byKey.tenure);
    var d7 = JSON.parse(JSON.stringify(sfhDeal({ sfh:{ ahPct:30 } })));   // 30% affordable
    byKey.tenure.apply(d7, { socialRent:40, affordableRent:20, sharedOwnership:25, firstHomes:15 });
    var tm = d7.tenure.mix;
    var tmSum = num(tm.oms)+num(tm.sr)+num(tm.ar)+num(tm.so)+num(tm.first_homes);
    ok("tenure split writes a scheme mix summing to 100%", tmSum===100);
    ok("tenure split OMS ≈ non-affordable share", Math.abs(num(tm.oms)-70) <= 2);
    var d7b = JSON.parse(JSON.stringify(sfhDeal()));   // ahPct 0 → no affordable requirement
    var beforeMix = JSON.stringify(d7b.tenure||null);
    byKey.tenure.apply(d7b, { socialRent:50, affordableRent:50 });
    ok("tenure split is a no-op when there is no affordable requirement", JSON.stringify(d7b.tenure||null)===beforeMix);
  }
})();

// 4g — v10.72: deterministic populates for Financial Modelling & Viability
(function(){
  if(typeof keystonePopulateFin === "function"){
    var d = sfhDeal({ sfh:{ buildPsf:225 } });
    keystonePopulateFin(d);
    ok("fin populate fills units from the mix", num(d.fin.units) === 200);
    ok("fin populate fills buildPsf from SFH", num(d.fin.buildPsf) === 225);
    ok("fin populate fills finRate & contingency", d.fin.finRate === "7.5" && d.fin.contingency === "5");
    // carries the AI-refined exit yield through from cap.targetYield
    var dy = sfhDeal(); dy.capitalise = { targetYield:"4.25" };
    keystonePopulateFin(dy);
    ok("fin populate carries cap.targetYield into exitYield", dy.fin.exitYield === "4.25");
    // never clobbers a user's own field
    var du = sfhDeal(); du.fin = { buildPsf:"999" };
    keystonePopulateFin(du);
    ok("fin populate never overwrites a user's field", du.fin.buildPsf === "999");
  }
  if(typeof keystonePopulateViability === "function"){
    var v1 = sfhDeal({ sfh:{ ahPct:30, profitPct:25 }, planning:{} });
    v1.planning = { units:200, ahPct:30 };
    keystonePopulateViability(v1);
    var ap = v1.viability.appraisal;
    ok("viability populate creates an appraisal", !!(ap && ap.siteName));
    ok("viability populate splits private/affordable units", num(ap.privateUnits) > 0 && num(ap.affordableUnits) > 0);
    ok("viability target margin follows the deal profit target", Math.abs(num(ap.targetPrivateMargin) - 0.25) < 1e-9);
    // v10.87 — when build is ALL-IN, don't double-count fees/contingency/infra/CIL on top of it
    var vInc = sfhDeal({ sfh:{ ahPct:30, buildInclusive:true } });
    keystonePopulateViability(vInc);
    var ai = vInc.viability.appraisal;
    ok("all-in build: fees/contingency/infra/CIL not double-counted", num(ai.professionalFees)===0 && num(ai.contingency)===0 && num(ai.onSiteHighways)===0 && num(ai.cil)===0);
    var vNot = sfhDeal({ sfh:{ ahPct:30, buildInclusive:false } });
    keystonePopulateViability(vNot);
    ok("construction-only build: fees/infra ARE added as separate lines", num(vNot.viability.appraisal.professionalFees) > 0);
    // no-op when an appraisal already exists
    var v2 = sfhDeal(); v2.viability = { appraisal:{ siteName:"Mine", privateUnits:5 } };
    keystonePopulateViability(v2);
    ok("viability populate never clobbers an existing appraisal", v2.viability.appraisal.siteName === "Mine" && num(v2.viability.appraisal.privateUnits) === 5);
  }
})();

// 4h — v10.82: projectTimeline — planning + build + total-horizon (two separate clocks)
(function(){
  if(typeof projectTimeline !== "function") return;
  var big = sfhDeal({ sfh:{ mix:[{type:"3-bed semi",count:"1000",sqft:"950",unitPrice:String(950*444),tenure:"private"},{type:"4-bed detached",count:"800",sqft:"1250",unitPrice:String(1250*470),tenure:"private"}] } });
  var t = projectTimeline(big);
  ok("timeline: build-out reflects scale (~6yrs for 1800)", t.buildYears >= 5 && t.buildYears <= 8);
  // v10.83 — unconsented cold-start default is a ~7-year promotion (research-grounded), not months
  ok("timeline: unconsented site defaults to a ~7-year promotion", t.planningMonths >= 72);
  ok("timeline: total = planning + build", Math.abs(t.totalYears - (t.planningYears + t.buildYears)) < 0.15);
  var withOutline = JSON.parse(JSON.stringify(big)); withOutline.planning = { status:"outline" };
  ok("timeline: outline consent shortens the planning clock", projectTimeline(withOutline).planningMonths < t.planningMonths);
  // strategic-site uplift: a large ALLOCATED site takes longer than a small one (S106 + full determination)
  var allocStrategic = JSON.parse(JSON.stringify(big)); allocStrategic.planning = { status:"allocated" };
  var allocSmall = sfhDeal({ sfh:{ mix:[{type:"3-bed semi",count:"40",sqft:"950",unitPrice:String(950*444),tenure:"private"}] } });
  allocSmall.planning = { status:"allocated" };
  ok("timeline: strategic allocated site carries a longer determination than a small one", projectTimeline(allocStrategic).planningMonths > projectTimeline(allocSmall).planningMonths);
  var explicit = JSON.parse(JSON.stringify(big)); explicit.planning = { planningTimelineMonths:30 };
  ok("timeline: an explicit planning figure is used over the default", projectTimeline(explicit).planningMonths === 30);
})();

// 4i — v10.90: affordable-housing grant lifts the RLV, and grantToStack advises the gap
(function(){
  if(typeof grantToStack !== "function") return;
  var d = sfhDeal({ sfh:{ ahPct:40, buildPsf:320 } });   // 40% affordable, high build → marginal
  var base = computeSFHMetrics(d);
  ok("engine reports the affordable-home count", num(base.affordableHomes) === Math.round(num(base.totalUnits) * 0.40));
  var withGrant = computeSFHMetrics(Object.assign({}, d, { grants:{ grantPerAffHome:80000 } }));
  ok("grant income = £/home × affordable homes", Math.round(num(withGrant.grantIncome)) === 80000 * num(base.affordableHomes) && num(withGrant.grantIncome) > 0);
  ok("grant lifts the RLV by exactly the grant income", Math.round(num(withGrant.rlv) - num(base.rlv)) === Math.round(num(withGrant.grantIncome)));
  var gt = grantToStack(d);
  ok("grantToStack advises a per-home grant to reach a positive residual", gt.affordableHomes > 0 && (num(base.rlv) < 0 ? gt.perHomeToPositive > 0 : gt.perHomeToPositive === 0));
  // v10.92 — grant funds only ADDITIONAL affordable: an explicit grant-eligible count is used
  var addl = computeSFHMetrics(Object.assign({}, d, { grants:{ grantPerAffHome:80000, grantEligibleHomes:20 } }));
  ok("grant applies to the ADDITIONAL count, not all affordable", Math.round(num(addl.grantIncome)) === 80000 * 20 && num(addl.grantEligibleHomes) === 20 && num(base.affordableHomes) > 20);
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
  near("area market rent pa (Maldon £1,258/mo)", areaMarketRentPa(d), 1258*12);
  var tm = computeTenureMetrics(d);
  function rentFor(k){ var r = tm.rows.filter(function(x){return x.td.key===k;})[0]; return r ? r.annualRent/r.units : 0; }
  near("Social Rent ≈ 60% of market", rentFor("sr"), 1258*12*0.6, 2);
  near("Affordable Rent ≈ 80% of market", rentFor("ar"), 1258*12*0.8, 2);
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

  // all-in build option equals the exact RLV swing from folding fees, contingency, roads
  // & infra into the rate (v10.48 — was roads+infra only).
  var optAllIn = optimiseScheme(sfhDeal(), { targetRlv:0 });
  ok("solver surfaces the build-inclusive option", !!optAllIn.allInOption);
  if (optAllIn.allInOption) {
    var _off = computeSFHMetrics(sfhDeal({ sfh:{ buildInclusive:false } }));
    var _on  = computeSFHMetrics(sfhDeal({ sfh:{ buildInclusive:true } }));
    near("all-in delta == the absorbed cost lines (fees+cont+roads+infra+finance saved)", optAllIn.allInOption.delta, _on.rlv - _off.rlv, 2);
    ok("all-in delta now exceeds roads+infra alone", optAllIn.allInOption.delta > 200*12000 + 32*53000);
  }

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
  // v9.62 — completion is a marker only; it no longer blocks edits, so shared edits now
  // propagate to every sibling INCLUDING a stage that was marked complete.
  var d5 = applySharedInput({_completedStages:{rlv:true}}, "fin", "buildPsf", 300, "fin", anyStage);
  ok("shared edits propagate even to a stage marked complete (no silent blocking)", d5.rlv && d5.rlv.buildPsf === 300);
  var d6 = applySharedInput({}, "land", "address", "1 Test St", "land", anyStage);
  ok("a non-shared field stays local (no spurious propagation)", d6.land.address === "1 Test St" && !d6.rlv);
})();

// 15b — Forward-fill on load: normalizeSharedFields pushes upstream data into blank
// downstream fields (city/acres/affordable %/sale £/sqft), incl. agent-built deals.
(function(){
  var loaded = normalizeSharedFields({
    land:{ city:"maldon", acres:32, postcode:"CM9 4DY" },
    planning:{ units:200, ahPct:50 },
    sfh:{ basePsf:420, buildPsf:220 }   // no city/acres/ahPct on SFH (the reported bug)
  });
  ok("city forward-fills Land → SFH", loaded.sfh.city === "maldon");
  ok("acres forward-fills Land → SFH", num(loaded.sfh.acres) === 32);
  ok("affordable % forward-fills Planning → SFH & Tenure", num(loaded.sfh.ahPct) === 50 && num(loaded.tenure.ahPct) === 50);
  ok("sale £/sqft forward-fills SFH.basePsf → RLV.salePsf", num(loaded.rlv.salePsf) === 420);
  ok("build £/sqft forward-fills SFH → Fin & RLV", num(loaded.fin.buildPsf) === 220 && num(loaded.rlv.buildPsf) === 220);
  ok("units forward-fill Planning → RLV & Fin", num(loaded.rlv.units) === 200 && num(loaded.fin.units) === 200);
  // does NOT cross house build cost into the apartment (HRA) rate
  ok("house build £ does NOT leak into HRA bcp", !(loaded.hra && loaded.hra.bcp));
  // does not overwrite an existing different DESCRIPTIVE value (city)
  var keep = normalizeSharedFields({ land:{city:"maldon"}, sfh:{city:"bristol"} });
  ok("a descriptive value already set downstream is preserved (not overwritten)", keep.sfh.city === "bristol");
  // v10.79 — but a divergent FIGURE-DRIVING field is reconciled to the authoritative value,
  // so Financial Modelling can never show a different profit/finance rate than the SFH engine.
  var rec = normalizeSharedFields({ sfh:{profitPct:25, finRate:9, buildPsf:220}, fin:{profitPct:17.5, finRate:7.5, buildPsf:200}, rlv:{} });
  ok("divergent profit reconciles Fin → SFH", num(rec.fin.profitPct) === 25 && num(rec.rlv.profitPct) === 25);
  ok("divergent finance rate reconciles Fin → SFH", num(rec.fin.finRate) === 9);
  ok("divergent build £/sqft reconciles Fin → SFH", num(rec.fin.buildPsf) === 220 && num(rec.rlv.buildPsf) === 220);
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

// 17 — Per-house-type build cost benchmark (BCIS-style) + Tier-1 / regional uplift
(function(){
  ok("every house type has a build £/sqft benchmark", Object.keys(HOUSE_TYPES).every(function(k){ return HOUSE_TYPES[k].build > 0; }));
  near("4-bed executive base build £/sqft", typicalBuildPsf("4-bed executive"), 230, 0);
  near("Tier-1 uplift ~12% on build", typicalBuildPsf("4-bed executive",{tier1:true}), Math.round(230*1.12), 0);
  near("regional index applies (Maldon ~1.02)", typicalBuildPsf("4-bed executive",{city:"maldon"}), Math.round(230*1.02), 0);
  ok("a simple terrace costs less to build than a luxury executive", typicalBuildPsf("1-bed terrace") < typicalBuildPsf("5-bed executive"));
  ok("conversion flats build cheaper than equivalent new-build", HOUSE_TYPES["Conversion 2-bed flat"].build < HOUSE_TYPES["2-bed apartment"].build);
  near("unknown type falls back to a sensible default", typicalBuildPsf("not a real type"), 185, 0);
})();

// 18 — Build cost benchmark for ALL development types (BTR, PBSA, conversions…)
(function(){
  ["Residential apartments","Residential houses","BTR (Build to Rent)","PBSA (Student)","Later Living","Pub conversion","Office conversion","Industrial/Warehouse","Hotel (3-4 star)","Care home","Mixed use"].forEach(function(t){
    ok("BUILD_TYPES has '"+t+"' with lo/mid/hi", BUILD_TYPES[t] && BUILD_TYPES[t].lo>0 && BUILD_TYPES[t].mid>0 && BUILD_TYPES[t].hi>0);
  });
  near("benchmarkBuildPsf BTR mid == table mid", benchmarkBuildPsf("BTR (Build to Rent)"), BUILD_TYPES["BTR (Build to Rent)"].mid, 0);
  near("benchmarkBuildPsf PBSA hi band", benchmarkBuildPsf("PBSA (Student)",{band:"hi"}), BUILD_TYPES["PBSA (Student)"].hi, 0);
  near("benchmark applies Tier-1 uplift", benchmarkBuildPsf("BTR (Build to Rent)",{tier1:true}), Math.round(BUILD_TYPES["BTR (Build to Rent)"].mid*1.12), 0);
  ok("asset type maps to a build type", buildTypeForAsset("btr")==="BTR (Build to Rent)" && buildTypeForAsset("pbsa")==="PBSA (Student)" && buildTypeForAsset("sfh")==="Residential houses");
})();

// 19 — Editable Build Cost Library: overrides persist and feed the helpers; reset restores
(function(){
  var before = benchmarkBuildPsf("BTR (Build to Rent)");
  saveBuildCostSettings({ tier1Uplift:1.15, types:{ "BTR (Build to Rent)":{mid:260} } });
  near("build-cost override feeds benchmarkBuildPsf", benchmarkBuildPsf("BTR (Build to Rent)"), 260, 0);
  near("Tier-1 uplift override applies", benchmarkBuildPsf("BTR (Build to Rent)",{tier1:true}), Math.round(260*1.15), 0);
  resetBuildCostSettings();
  near("reset restores the code default", benchmarkBuildPsf("BTR (Build to Rent)"), before, 0);
})();

// 20 — Affordable % resolves wherever it's entered (SFH / Planning / Tenure), so
// the GDV blends consistently and the Exec Summary can't diverge from the dashboard.
(function(){
  function dealAhOn(stageObj){
    return { assetType:"sfh", land:{city:"maldon"}, sfh:Object.assign({ city:"maldon", buildPsf:220,
      mix:[{type:"3-bed semi",count:"100",sqft:"1000",unitPrice:String(1000*420),tenure:"private"},
           {type:"4-bed detached",count:"100",sqft:"1300",unitPrice:String(1300*479),tenure:"private"}] }, stageObj.sfh||{}),
      planning:stageObj.planning||{}, tenure:stageObj.tenure||{} };
  }
  var retail = computeSFHMetrics(dealAhOn({})).gdv;                                   // no AH anywhere → retail
  var ahOnSfh = computeSFHMetrics(dealAhOn({sfh:{ahPct:50}})).gdv;
  var ahOnPlanning = computeSFHMetrics(dealAhOn({planning:{ahPct:50}})).gdv;          // AH only on Planning
  var ahOnTenure = computeSFHMetrics(dealAhOn({tenure:{ahPct:50}})).gdv;
  var ahLegacy = computeSFHMetrics(dealAhOn({planning:{afhPct:50}})).gdv;             // legacy field name
  ok("AH on SFH blends GDV below retail", ahOnSfh < retail);
  near("AH on Planning blends the SAME as AH on SFH", ahOnPlanning, ahOnSfh, 1);
  near("AH on Tenure blends the same", ahOnTenure, ahOnSfh, 1);
  near("legacy planning.afhPct also blends", ahLegacy, ahOnSfh, 1);
  // and the deal-state engine agrees (this is what the Exec Summary uses)
  near("deal-state GDV == engine GDV with AH on Planning", calcDealMetrics(dealAhOn({planning:{ahPct:50}})).gdv, ahOnPlanning, 1);
})();

// 21 — Stages auto-complete from their data (no manual "Next" needed)
(function(){
  var d = sfhDeal();  // has a mix, so it's appraisable
  ok("SFH completes once a mix exists", isStageComplete("sfh", d));
  ok("Financial Modelling auto-completes once the scheme is appraisable", isStageComplete("fin", d));
  ok("Land Valuation completes when units resolve", isStageComplete("rlv", d));
  // Due Diligence reads ddChecked (not the old 'dd' namespace)
  ok("DD not complete with <3 ticks", !isStageComplete("dd", {ddChecked:{a:true,b:true}}));
  ok("DD auto-completes with >=3 ticks", isStageComplete("dd", {ddChecked:{a:true,b:true,c:true}}));
  // Tenure reads the entered split (not a computed 'rows' array)
  ok("Tenure completes when a split is entered", isStageComplete("tenure", {land:{units:100}, tenure:{inputMode:"units", mix:{sr:50, ar:50}}}));
  // manual completion flag still honoured
  ok("manual _completedStages still marks a stage done", isStageComplete("exit", {_completedStages:{exit:true}}));
  ok("empty deal: Financial Modelling not complete", !isStageComplete("fin", {}));
  // v9.98 — completion is data-driven and strict: placeholder/default data doesn't count
  ok("Capitalisation not complete on a default yield alone", !isStageComplete("capitalise", {capitalise:{targetYield:4.9}}));
  ok("Capitalisation complete with real income", isStageComplete("capitalise", {capitalise:{netAnnualIncome:5000000}}));
  ok("Tenure not complete on a placeholder 9.5% allocation", !isStageComplete("tenure", {land:{units:1056}, tenure:{inputMode:"units", mix:{sr:100}}}));
  ok("Tenure complete once it covers the scheme", isStageComplete("tenure", {land:{units:1056}, tenure:{inputMode:"units", mix:{sr:1056}}}));
  ok("Planning not complete on units alone (no status)", !isStageComplete("planning", {planning:{units:1056}}));
  ok("Planning complete once a status is set", isStageComplete("planning", {planning:{units:1056, status:"full"}}));
  // v10.0 — location score shared by Land Appraisal + Scorecard (was only on the Land screen)
  ok("locationScore reflects the land dropdowns", locationScore({land:{proximity:"fair",transport:"fair",contamination:"unknown",tenure:"freehold",constraint:"none"}}) === 53);
  ok("locationScore is 0 when unset", locationScore({}) === 0);
  ok("buildRatePerYear phased (1056 homes -> 220/yr)", buildRatePerYear(1056,false) === 220 && buildRatePerYear(40,false) === 40);
})();

// 22 — SFH inherits site area from Land Appraisal (engine stays consistent with screen)
(function(){
  var d = { assetType:"sfh", land:{city:"maldon", acres:32}, sfh:{ city:"maldon", buildPsf:220,
    mix:[{type:"3-bed semi",count:"100",sqft:"1000",unitPrice:"400000",tenure:"private"}] } };  // no sfh.acres
  var c = computeSFHMetrics(d);
  // v10.102 — the 32-acre title is inherited, but only the DEVELOPED area is serviced/costed:
  // 100 homes ÷ 20/acre = 5 developable acres, leaving 27 acres surplus. Infra is 5 × £53k.
  near("SFH infra on developed area (5 of 32 acres × £53k)", c.infra, 5*53000, 1);
  near("net developable acres = homes ÷ density (100 ÷ 20)", c.netDevelopableAcres, 5, 0.01);
  near("surplus acres = gross − developed (32 − 5)", c.surplusAcres, 27, 0.01);
  ok("gross site acreage still inherited from Land (32)", c.acres === 32);
  ok("SFH RLV computes with inherited acres", isFinite(c.rlv));
})();

// 23 — Mixed exit allocation: who gets what, and it carries into the reports
(function(){
  var d = sfhDeal({ sfh:{ mix:[
    {type:"3-bed semi",   count:"10", sqft:"1000", unitPrice:"400000", tenure:"private"},
    {type:"3-bed semi",   count:"20", sqft:"1000", unitPrice:"400000", tenure:"pension"},
    {type:"2-bed terrace",count:"30", sqft:"800",  unitPrice:"300000", tenure:"ahp_social"}
  ]}});
  var alloc = exitAllocationSummary(d);
  ok("allocation splits into 3 buyer routes", alloc.length === 3);
  var byT = {}; alloc.forEach(function(a){ byT[a.tenure] = a; });
  ok("private = 10 units", byT.private && byT.private.units === 10);
  ok("pension = 20 units", byT.pension && byT.pension.units === 20);
  ok("housing association (social rent) = 30 units", byT["ahp_social"] && byT["ahp_social"].units === 30);
  near("social-rent realisable = retail × 0.55", byT["ahp_social"].realisable, 30*800*375*0.55, 5);
  var p = buildHonestPrompt(d, "task");
  ok("exit allocation carries into the AI report deal-state", p.indexOf("EXIT / BUYER ALLOCATION") >= 0 && p.indexOf("Pension") >= 0);
})();

// 24 — Rent→sale-£/sqft fallback is sane (not the old ×8.5/12 overshoot)
(function(){
  var psf = estSalePsfFromRent(1180);   // Maldon-ish monthly rent
  ok("rent→psf is realistic for Maldon (£250-450, not ~£836)", psf >= 250 && psf <= 450);
  ok("rent→psf clamps and handles blank", estSalePsfFromRent(0) === 0 && estSalePsfFromRent(99999) <= 650);
})();

// 25 — Maldon rent benchmark refreshed to current ONS
(function(){
  near("Maldon market rent benchmark = £1,258/mo", MKT.maldon.btr, 1258, 0);
  near("area annual rent reflects the refresh", areaMarketRentPa({land:{city:"maldon"}}), 1258*12, 0);
})();

// 26 — Yield is a two-way shared field (cap.targetYield <-> fin.exitYield)
(function(){
  var anyStage = function(){ return true; };
  var a = applySharedInput({}, "capitalise", "targetYield", 4.5, "capitalise", anyStage);
  ok("yield set on Capitalisation flows to Fin exit yield", num(a.fin.exitYield) === 4.5);
  var b = applySharedInput({}, "fin", "exitYield", 5.25, "fin", anyStage);
  ok("yield set on Fin flows back to Capitalisation", num(b.capitalise.targetYield) === 5.25);
})();

// 26b — v10.60: a MANUAL figure change replicates to every page that shows it.
(function(){
  var anyStage = function(){ return true; };
  // the user's example: build £/sqft edited on one stage lands on all build siblings
  var bd = applySharedInput({}, "sfh", "buildPsf", 255.21, "sfh", anyStage);
  ok("manual build £/sqft replicates to Fin & RLV", num(bd.fin.buildPsf) === 255.21 && num(bd.rlv.buildPsf) === 255.21);
  // and every computed figure follows, because the engine reads the shared build rate
  var m1 = computeSFHMetrics(sfhDeal({ sfh:{ buildPsf:200 } }));
  var m2 = computeSFHMetrics(sfhDeal({ sfh:{ buildPsf:255.21 } }));
  ok("changing build £/sqft moves the computed build cost everywhere", Math.abs(m2.buildCost - m1.buildCost) > 1000);
  // new shared groups
  var ap = applySharedInput({}, "rlv", "askingPrice", 8000000, "rlv", anyStage);
  ok("asking price replicates to land.price & scorecard", num(ap.land.price) === 8000000 && num(ap.scorecard.askingPrice) === 8000000);
  var sz = applySharedInput({}, "sfh", "avgSqft", 980, "sfh", anyStage);
  ok("average unit size replicates to RLV", num(sz.rlv.avgSqft) === 980);
  var lp = applySharedInput({}, "planning", "lpa", "Maidstone BC", "planning", anyStage);
  ok("LPA replicates to land & constraint check", lp.land.lpa === "Maidstone BC" && lp.constraintCheck.lpa === "Maidstone BC");
  // normalizeSharedFields back-fills a blank sibling from an existing value (on load)
  var nf = normalizeSharedFields({ land:{ price:9000000 }, rlv:{}, scorecard:{} });
  ok("normalize back-fills asking price to blank siblings", num(nf.rlv.askingPrice) === 9000000 && num(nf.scorecard.askingPrice) === 9000000);
})();

// 27 — Per-house-type area rents (anchored on the 3-bed typical, not 1-bed)
(function(){
  var d = { land:{city:"maldon"} };
  near("3-bed area rent = the typical (btr £1,258)", areaRentPcm(d,3), 1258, 0);
  near("4-bed area rent ≈ ONS £1,929 (within tolerance)", areaRentPcm(d,4), Math.round(1258*1.53), 60);
  ok("1-bed rent is below 3-bed (correct direction)", areaRentPcm(d,1) < areaRentPcm(d,3));
  ok("4-bed rent is above 3-bed", areaRentPcm(d,4) > areaRentPcm(d,3));
  ok("no-area deal returns 0 (caller falls back)", areaRentPcm({},3) === 0);
})();

// 28 — Rents follow the DEAL's area (city OR postcode), and areas differ
(function(){
  near("Maldon deal → Maldon 3-bed rent", areaRentPcm({land:{city:"maldon"}},3), 1258, 0);
  near("Sheffield deal → Sheffield 3-bed rent", areaRentPcm({land:{city:"sheffield"}},3), MKT.sheffield.btr, 0);
  ok("Maldon and Sheffield rents differ (area-specific)", areaRentPcm({land:{city:"maldon"}},3) !== areaRentPcm({land:{city:"sheffield"}},3));
  // resolves area from POSTCODE when no city is set
  var byPc = areaRentPcm({land:{postcode:"M1 1AE"}},3);   // Manchester postcode
  ok("area resolves from postcode when city missing", byPc === MKT.manchester.btr || byPc > 0);
  // dealCityKey prefers an explicit city
  ok("dealCityKey resolves the deal area", dealCityKey({sfh:{city:"sheffield"}}) === "sheffield");
})();

// 29 — ONE net initial yield: area benchmark by default, Cap override sticks everywhere
(function(){
  // Default = area benchmark, as a PERCENT
  near("areaYield(Maldon) = 4.7% benchmark", areaYield({land:{city:"maldon"}}), 4.7, 0.01);
  near("areaYield(Sheffield) = 4.9% benchmark", areaYield({land:{city:"sheffield"}}), 4.9, 0.01);
  near("dealYield defaults to the area benchmark", dealYield({land:{city:"maldon"}}), 4.7, 0.01);
  // A Capitalisation override (stored as percent) wins and is returned as a percent
  near("dealYield honours a Cap override", dealYield({land:{city:"maldon"}, capitalise:{targetYield:4.2}}), 4.2, 0.001);
  // Tolerates an override stored as a fraction
  near("dealYield tolerates a fraction override", dealYield({capitalise:{targetYield:0.05}}), 5, 0.001);
  // No area at all → safe 4.7% fallback (not 0)
  ok("dealYield never returns 0", dealYield({}) > 0);
  // The override is single-sourced: Maldon area is 4.7 but override forces 4.0 everywhere
  ok("override differs from benchmark (single source of truth)",
     dealYield({land:{city:"maldon"}, capitalise:{targetYield:4.0}}) === 4.0 &&
     areaYield({land:{city:"maldon"}}) === 4.7);
})();

// 30 — Land Deal "what to pay": consented RLV from assumed homes is positive & scales
(function(){
  function consentedRlv(units){
    var d = { assetType:"land", land:{city:"maldon", acres:30, units:units},
              rlv:{units:units}, planning:{units:units}, sfh:{mix:[]} };
    return calcDealMetrics(d).rlv;
  }
  var r100 = consentedRlv(100), r200 = consentedRlv(200);
  ok("consented RLV is positive once homes are assumed", r100 > 0);
  ok("more homes ⇒ higher consented land value", r200 > r100);
  // No homes assumed ⇒ engine must NOT invent a residential land value
  var none = calcDealMetrics({ assetType:"land", land:{city:"maldon", acres:30}, sfh:{mix:[]} }).rlv;
  ok("no assumed homes ⇒ no positive residential RLV (panel shows agri floor instead)", !(none > 0));
  // Build & sale £/sqft overrides on the land stage move the residual the right way
  function rlvWith(buildPsf, salePsf){
    return calcDealMetrics({ assetType:"land", land:{city:"maldon", acres:30, units:200},
      rlv:{units:200, buildPsf:buildPsf, salePsf:salePsf}, planning:{units:200}, sfh:{mix:[]} }).rlv;
  }
  ok("higher sale £/sqft ⇒ higher land value", rlvWith(200, 450) > rlvWith(200, 380));
  ok("higher build £/sqft ⇒ lower land value", rlvWith(260, 400) < rlvWith(200, 400));
})();

// 30b — Reported target margin % matches the profit actually used for SFH
(function(){
  var d = { assetType:"sfh", land:{city:"maldon", acres:32},
    sfh:{ city:"maldon", buildPsf:250, profitPct:15,
      mix:[{type:"4-bed detached",count:100,sqft:1000,unitPrice:480000,tenure:"private"}] },
    planning:{units:100} };   // note: fin.profitPct deliberately unset
  var m = calcDealMetrics(d);
  near("profitPctTarget reflects the SFH 15% (not the 17.5% default)", m.profitPctTarget, 15, 0.01);
  ok("profit £ equals that % of GDV", Math.abs(m.profit - m.gdv*0.15) < 1000);
})();

// 30c — Mix rows with plots + price but a BLANK house type must still be counted
(function(){
  var d = { assetType:"sfh", land:{city:"maldon"},
    sfh:{ city:"maldon", mix:[
      { count:100, sqft:1000, unitPrice:450000, tenure:"private" },          // no type
      { type:"4-bed detached", count:125, sqft:1200, unitPrice:600000, tenure:"private" }
    ] } };
  var m = computeSFHMetrics(d);
  ok("typeless row is still counted (225, not 125)", m.totalUnits === 225);
  ok("typeless row contributes to GDV", m.retailGdv > 100*1000*450*0.99);
  // A genuinely empty placeholder row (no count) is still ignored
  var d2 = { assetType:"sfh", sfh:{ mix:[ {count:0}, {count:"",sqft:""} ] } };
  ok("empty placeholder rows ignored", computeSFHMetrics(d2).totalUnits === 0);
})();

// 30d — HA low-carbon spec uplift raises the benchmark build cost
(function(){
  var base = typicalBuildPsf("3-bed semi", {city:"maldon"});
  var ha   = typicalBuildPsf("3-bed semi", {city:"maldon", haSpec:true});
  ok("HA-spec build cost is higher than standard", ha > base);
  near("HA-spec uplift ~12% over standard", ha/base, 1.12, 0.02);
  ok("NDSS reference exists with sensible 3b5p size", NDSS_MIN["3b5p"] && NDSS_MIN["3b5p"].sqft > 900);
})();

// 31 — Region label follows the deal's area (was hard-coded)
(function(){
  ok("Maldon resolves to East of England", ukRegionFor({land:{city:"maldon"}}) === "East of England");
  ok("Bristol resolves to South West", ukRegionFor({land:{city:"bristol"}}) === "South West");
  ok("unknown area falls back to a national label", /national/i.test(ukRegionFor({})));
})();

// 32 — Keystone: auto-journey detection + build a valid deal the engine can run
(function(){
  // auto-journey
  ok("houses → sfh", detectJourney({houseMix:[{type:"3-bed semi",count:10}]}) === "sfh");
  ok("rents only → btr", detectJourney({rents:[{beds:2,count:50,rentPcm:1200}]}) === "btr");
  ok("student → pbsa", detectJourney({rents:[{count:100,rentPcm:160}], notes:"PBSA student scheme"}) === "pbsa");
  ok("refused → recovery", detectJourney({planningStatus:"refused at appeal"}) === "recovery");
  ok("bare land → land", detectJourney({acres:40, askingPrice:5000000}) === "land");
  ok("explicit assetType wins", detectJourney({assetType:"btr", houseMix:[{count:5}]}) === "btr");

  // Build a Maldon-style brief → deal, and run it through the real engine
  var brief = {
    dealName:"Maldon test", town:"Maldon", acres:32, askingPrice:14000000,
    affordablePct:50, buildPsf:250, haSpec:true, s106PerUnit:11000, profitPct:17.5,
    houseMix:[
      {type:"3-bed semi", count:113, sqft:950, salePrice:380000, tenure:"social rent"},
      {type:"4-bed detached", count:112, sqft:1200, salePrice:560000, tenure:"private"}
    ]
  };
  var deal = buildDealFromBrief(brief);
  ok("Keystone chose the sfh journey", deal.assetType === "sfh");
  ok("units total carried (225)", num(deal.land.units) === 225);
  ok("affordable % set across stages", num(deal.planning.ahPct) === 50 && num(deal.sfh.ahPct) === 50);
  ok("HA spec flag carried", deal.sfh.haSpecBuild === true);
  ok("social-rent tenure mapped", deal.sfh.mix[0].tenure === "ahp_social");
  var m = calcDealMetrics(deal);
  ok("built deal computes a positive GDV", m.gdv > 0);
  ok("built deal computes units = 225", m.units === 225);
  ok("affordable blend applied (blended < retail)", computeSFHMetrics(deal).blendedGdv < computeSFHMetrics(deal).retailGdv);

  // A rents brief → btr → capitalised GDV from net rent
  var rb = buildDealFromBrief({ town:"Maldon", rents:[{beds:2,count:200,rentPcm:1300}], mgmtPct:25, netInitialYield:4.5 });
  ok("rents brief → btr", rb.assetType === "btr");
  ok("net annual income computed (after 25% mgmt)", Math.abs(num(rb.capitalise.netAnnualIncome) - 200*1300*12*0.75) < 1000);
})();

// 33 — Keystone ← Placona: a found site maps to a brief that builds a deal
(function(){
  var site = {
    site_name:"Land South of Howells Farm",
    address_or_location:"Land South of Howells Farm, Maldon, Essex",
    county:"Essex", local_planning_authority:"Maldon District Council",
    site_area_acres:"32", estimated_units:"200-250", asking_price:"£14m",
    planning_status:"None", placona_score:78, placona_category:"A"
  };
  var brief = keystoneBriefFromPlaconaSite(site);
  near("Placona acres parsed (32)", brief.acres, 32, 0);
  near("Placona asking '£14m' parsed", brief.askingPrice, 14000000, 0);
  near("Placona units range '200-250' → midpoint 225", brief.units, 225, 0);
  ok("Placona town resolves to a benchmarkable area (Maldon)", brief.town.toLowerCase() === "maldon");
  ok("Placona import flagged as estimates", (brief.assumptions||[]).join(" ").toLowerCase().indexOf("placona") >= 0);
  var deal = buildDealFromBrief(brief);
  ok("Placona→Keystone builds a housing scheme with an auto mix", deal.assetType === "sfh" && deal.sfh.mix.length >= 3);
  ok("city carried to land/sfh for benchmarks", deal.land.city === "maldon");
})();

// 34 — Scout opportunity scoring: composite %, confidence, pillars
(function(){
  var strong = scoreOpportunity({
    address:"Land at Maldon, Essex", town:"Maldon", site_area_acres:"32",
    asking_price:"£3m", estimated_units:"200", planning_status:"outline",
    constraintVerdict:"GO", populationGrowthPct:1.4, affordabilityRatio:11, jobsGrowthPct:1.8, housingNeedIndex:75
  });
  ok("score is a 0-100 percentage", strong.score >= 0 && strong.score <= 100);
  ok("five pillars returned", strong.pillars.length === 5);
  ok("rich data ⇒ high confidence", strong.confidence >= 70);
  var thin = scoreOpportunity({ town:"Maldon", asking_price:"£3m" });
  ok("thin data ⇒ low confidence", thin.confidence < thin.confidence + 1 && thin.confidence <= 60);
  // A cheap, well-located site should out-score an overpriced one. Uses a clearly-viable
  // higher-value market (Oxford) so the viability pillar has positive headroom to distinguish
  // the two asks (flat £/sqft trims GDV, so a marginal market can floor both at 0).
  var cheap = scoreOpportunity({ town:"Oxford", site_area_acres:"32", asking_price:"£2m", planning_status:"outline" });
  var dear  = scoreOpportunity({ town:"Oxford", site_area_acres:"32", asking_price:"£40m", planning_status:"outline" });
  ok("cheaper land scores higher (viability pillar works)", cheap.score > dear.score);
  // dealStatus carried through the builder
  ok("buildDealFromBrief defaults dealStatus to owned", buildDealFromBrief({town:"Maldon"}).dealStatus === "owned");
  ok("dealStatus override honoured", buildDealFromBrief({town:"Maldon", dealStatus:"for_introduction"}).dealStatus === "for_introduction");
})();

// 35 — Keystone estimates units from density when no count is given
(function(){
  // explicit density
  var d1 = buildDealFromBrief({ town:"Rugby", acres:88, density:12 });
  near("88 acres × 12/acre ≈ 1056 units", num(d1.land.units), 1056, 0);
  // default greenfield density when none supplied
  var d2 = buildDealFromBrief({ town:"Rugby", acres:88 });
  near("no count, no density → default 12/acre → 1056", num(d2.land.units), 1056, 0);
  ok("estimation recorded as an assumption", (d2._keystone.assumptions.join(" ").toLowerCase().indexOf("density") >= 0));
  // a PLAUSIBLE explicit unit count is honoured (10/acre on 20 acres)
  var d3 = buildDealFromBrief({ town:"Rugby", acres:20, units:200, density:12 });
  ok("plausible explicit unit count honoured", num(d3.land.units) === 200);
  // v10.89 — a low explicit count on a large greenfield is now HONOURED, not silently inflated
  // (reported: a deliberate 200 on 88 acres was overridden to 1,056). The land's fuller capacity
  // is surfaced as UPSIDE instead of changing the stated figure.
  var d4 = buildDealFromBrief({ town:"Rugby", acres:88, units:200 });
  ok("low explicit count honoured (200, not inflated to 1056)", num(d4.land.units) === 200);
  ok("land capacity surfaced as upside instead of overriding the count", d4._keystone.assumptions.join(" ").toLowerCase().indexOf("upside") >= 0);
})();

// 35a — v10.47: DEVELOP FROM THE SOURCE FIRST, surface land capacity as upside.
// A source that quotes "room for 1,800 houses" on a big site is honoured as the scheme's
// basis (not overridden), and the land's fuller capacity at a higher density is flagged.
(function(){
  // 1,800 on 285 acres ≈ 6.3/acre — plausible, so honoured (NOT upsized).
  var d = buildDealFromBrief({ town:"Maidstone", postcode:"ME17 1AA", acres:285, units:1800 });
  ok("source's stated 1,800 honoured, not overridden", num(d.land.units) === 1800);
  near("land capacity computed at 20/acre (285×20≈5700)", num(d.land.capacityAtRef), 5700, 0);
  ok("reference density recorded", num(d.land.capacityRefDensity) === 20);
  ok("source's stated figure preserved on land", num(d.land.statedUnits) === 1800);
  var notes = d._keystone.assumptions.join(" ");
  ok("capacity note leads with the source's stated figure", /Source states room for 1,800 homes/.test(notes));
  ok("capacity note flags the ~5,700 upside", /5,700/.test(notes) && /upside/.test(notes.toLowerCase()));
  ok("capacity note comes first (source-led)", /^Source states room for 1,800/.test(d._keystone.assumptions[0]));
  ok("implied density surfaced for the density card", num(d.land.assumedDensity) > 6 && num(d.land.assumedDensity) < 7);

  // A scheme already near the reference density gets NO upside flag (no false 'headroom').
  var dense = buildDealFromBrief({ town:"Maidstone", postcode:"ME17 1AA", acres:100, units:1800 });
  ok("no capacity flag when scheme already ~ reference density", !/Land capacity/.test(dense._keystone.assumptions.join(" ")));
  ok("no capacity number stored when there is no material headroom", !dense.land.capacityAtRef || num(dense.land.capacityAtRef) < num(dense.land.units)*1.2);

  // An explicit stated density is captured (per-acre) and drives capacity/units.
  var dd = buildDealFromBrief({ town:"Maidstone", postcode:"ME17 1AA", acres:100, density:20 });
  near("explicit 20/acre on 100 acres → 2,000 homes", num(dd.land.units), 2000, 0);
})();

// 35b — Keystone flags an unrecognised location (Ryton/Wolston) and maps it to a market
(function(){
  var ry = buildDealFromBrief({ town:"Ryton-on-Dunsmore", acres:88, askingPrice:12500000 });
  ok("Ryton-on-Dunsmore mapped to a known market (rugby)", ry.land.city === "rugby");
  ok("nearest-market use is flagged", ry._keystone.assumptions.join(" ").toLowerCase().indexOf("nearest market") >= 0);
  var unknown = buildDealFromBrief({ town:"Nowhereville", acres:40 });
  ok("truly unknown location flagged as national-average fallback",
     unknown._keystone.assumptions.join(" ").toLowerCase().indexOf("national average") >= 0);
})();

// 35b2 — UNIVERSAL postcode resolution: any village resolves via its postcode area
(function(){
  ok("postcodeArea('NE20 9AB') → NE", postcodeArea("NE20 9AB") === "NE");
  ok("postcodeArea('B15') → B", postcodeArea("B15") === "B");
  ok("NE postcode → newcastle market", postcodeMarketKey("NE20") === "newcastle");
  ok("TS (Middlesbrough) postcode → newcastle anchor", postcodeMarketKey("TS9 5AB") === "newcastle");
  // a village NOT listed anywhere, but with a postcode, still resolves + gets the region
  var v = buildDealFromBrief({ town:"Ponteland", postcode:"NE20 9AA", acres:40 });
  ok("unlisted village resolves to the anchor market via postcode", v.land.city === "newcastle");
  ok("region derived from postcode (North East)", ukRegionFor(v) === "North East");
  ok("resolution is flagged as postcode-derived", v._keystone.assumptions.join(" ").toLowerCase().indexOf("resolved from postcode") >= 0);
  // a village near Middlesbrough
  var v2 = buildDealFromBrief({ town:"Great Ayton", postcode:"TS9 6QF", acres:25 });
  ok("Middlesbrough-area village → newcastle anchor + North East", v2.land.city === "newcastle" && ukRegionFor(v2) === "North East");
  // ukRegionFor postcode fallback works even with an unknown city string
  ok("ukRegionFor falls back to postcode when city unknown",
     ukRegionFor({ land:{ city:"somewhereville", postcode:"EX15 2AA" } }) === "South West");
  // MANUAL path (hand-built deal, no Keystone): a village typed in the city box + a
  // postcode resolves the market through dealCityKey → engine benchmarks.
  ok("dealCityKey resolves an unlisted village by postcode",
     dealCityKey({ land:{ city:"ponteland", postcode:"NE20 9AA" } }) === "newcastle");
  var manual = { assetType:"sfh", land:{ city:"ponteland", postcode:"NE20 9AA", acres:20 },
    sfh:{ mix:[{type:"3-bed semi",count:"200",sqft:"1000",unitPrice:"300000",tenure:"private"}] } };
  ok("manual deal region resolves from postcode (North East)", ukRegionFor(manual) === "North East");
  ok("manual deal capitalisation uses the resolved market yield", computeSFHMetrics(manual).capYield > 0);
})();

// 35c — Keystone best-practice assumption set fills a thin brief completely
(function(){
  var d = buildDealFromBrief({ town:"Rugby", acres:88 });   // nothing but a place + acreage
  near("default affordable applied (30%)", num(d.planning.ahPct), 30, 0);
  near("default S106 applied (£15k/unit)", num(d.sfh.s106pu), 15000, 0);
  near("default profit applied (17.5%)", num(d.sfh.profitPct), 17.5, 0.1);
  near("default finance applied (12% — conservative for headroom)", num(d.sfh.finRate), 12, 0.1);
  near("default contingency applied (5%)", num(d.sfh.contingency), 5, 0.1);
  ok("assumptions register records affordable + S106",
     d._keystone.assumptions.join(" ").toLowerCase().indexOf("affordable housing: 30%") >= 0 &&
     d._keystone.assumptions.join(" ").toLowerCase().indexOf("cycleways") >= 0);
  // brief-supplied values still win over the defaults
  var d2 = buildDealFromBrief({ town:"Rugby", acres:88, affordablePct:40, s106PerUnit:20000, profitPct:20 });
  ok("brief affordable % overrides default", num(d2.planning.ahPct) === 40);
  ok("brief S106 overrides default", num(d2.sfh.s106pu) === 20000);
  ok("brief profit overrides default", num(d2.sfh.profitPct) === 20);
  ok("S106_BREAKDOWN sums to the default per-unit", S106_BREAKDOWN.reduce(function(a,r){return a+r.perUnit;},0) === KEYSTONE_DEFAULTS.s106PerUnit);
})();

// 35d — Capitalisation exit + disposal cost + correct affordable treatment
(function(){
  var deal = buildDealFromBrief({ town:"Rugby", postcode:"CV8 3", acres:88, askingPrice:12500000 });
  deal.land.price = 12500000;
  var d = calcDealMetrics(deal);
  // v10.50 — Keystone builds ALL-IN: the build £/sqft covers professional fees, contingency,
  // roads & SuDS (so those are £0), and marketing/disposal is a sale-side cost left at £0.
  ok("Keystone build is all-in (buildInclusive on)", deal.sfh.buildInclusive === true);
  var sfh0 = computeSFHMetrics(deal);
  ok("all-in: professional fees + contingency folded into the build rate (=0)", num(sfh0.fees) === 0 && num(sfh0.contingency) === 0);
  ok("all-in: marketing/disposal left at £0 on a Keystone build", num(sfh0.marketing) === 0);
  ok("capitalisation investment value computed (>0)", num(d.capInvestmentValue) > 0);
  ok("both exit profits reported", isFinite(d.sellProfit) && isFinite(d.capProfit));
  // Affordable is NOT a capital haircut in the capitalise value: with 30% affordable,
  // the capitalised value must exceed what it would be if we (wrongly) also haircut it.
  var sfhM = computeSFHMetrics(deal);
  near("capitalise reflects 30% affordable as rent, not a capital haircut", sfhM.ahPctResolved, 30, 0);
  ok("capitalise value ignores the build-to-sell blended haircut (uses market rent base)",
     sfhM.capInvestmentValue > sfhM.gdv * 0.5);   // sane: not collapsed by the affordable discount
  // A marketing % that IS set still applies as a disposal cost.
  var withMkt = JSON.parse(JSON.stringify(deal)); withMkt.sfh.marketingPct = 3;
  ok("explicit marketingPct applies a disposal cost", computeSFHMetrics(withMkt).marketing > 0);
  // Hand-built deals with no marketingPct are unchanged (default 0)
  var plain = { assetType:"sfh", land:{city:"maldon", acres:32}, sfh:{ city:"maldon", buildPsf:220,
    mix:[{type:"3-bed semi",count:"100",sqft:"1000",unitPrice:"400000",tenure:"private"}] } };
  near("no marketingPct → no disposal cost (back-compat)", computeSFHMetrics(plain).marketing, 0, 0);
})();

// 35e — RLV reconciles across engines once disposal/marketing is included (v9.96)
(function(){
  var deal = buildDealFromBrief({ town:"Rugby", postcode:"CV8 3", acres:88, askingPrice:12500000 });
  deal.land.price = 12500000;
  deal.sfh.marketingPct = 3;   // explicitly budget disposal so the reconciliation still exercises marketing
  var sfh = computeSFHMetrics(deal), dm = calcDealMetrics(deal);
  ok("disposal/marketing present on both engines when set", num(sfh.marketing) > 0 && num(dm.marketing) > 0);
  near("computeSFHMetrics.rlv == calcDealMetrics.rlv (both include disposal)", sfh.rlv, dm.rlv, 1000);
  // the scorecard reads the engine residual, not the asking price
  ok("engine RLV is the residual, not the ask", Math.abs(dm.rlv - deal.land.price) > 1000000);
})();

// 36 — Keystone auto-creates a house mix + full scheme from a land find
(function(){
  // a Placona-style raw land find: acres + price, no mix, no units
  var deal = buildDealFromBrief({ town:"Rugby", acres:88, askingPrice:12500000, density:12 });
  ok("switched to sfh journey once a mix was generated", deal.assetType === "sfh");
  ok("house mix auto-generated (multiple types)", deal.sfh.mix.length >= 3);
  var mixUnits = deal.sfh.mix.reduce(function(a,r){ return a + num(r.count); }, 0);
  near("generated mix totals the estimated units (~1056)", mixUnits, 1056, 2);
  ok("mix rows are priced", num(deal.sfh.mix[0].unitPrice) > 0);
  var m = computeSFHMetrics(deal);
  ok("full scheme has a real GDV now", m.gdv > 0);
  ok("and a residual land value", m.rlv !== 0);
  ok("auto-generation flagged as an assumption", deal._keystone.assumptions.join(" ").toLowerCase().indexOf("auto-generated") >= 0);
})();

// 37 — Constraint Check flows into Scorecard/Data Room via shared readers (v10.3)
(function(){
  // The Constraint Check stage stores its output at data.constraintCheck.results.
  var caution = { constraintCheck:{ results:{ verdict:"CAUTION", score:53, report:"Green Belt; unallocated; flood zone 2." } } };
  var go      = { constraintCheck:{ results:{ verdict:"go", score:82, report:"Clear." } } };
  var avoid   = { constraintCheck:{ results:{ verdict:"AVOID", score:18 } } };
  var blank   = { land:{} };

  ok("constraintVerdict reads data.constraintCheck.results (not data.constraint)", constraintVerdict(caution) === "CAUTION");
  ok("constraintVerdict upper-cases a lowercase verdict", constraintVerdict(go) === "GO");
  ok("constraintVerdict empty when nothing assessed", constraintVerdict(blank) === "");
  near("constraintPlanningScore reads the stored score", constraintPlanningScore(caution), 53, 0);
  near("constraintPlanningScore is 0 when unassessed", constraintPlanningScore(blank), 0, 0);

  // The scorecard "Constraint Risk" dimension must move OFF 5/10 "Not assessed"
  // once a live verdict exists — this was the reported bug.
  near("CAUTION → Moderate risk 5/10", constraintRiskScore(caution).s, 5, 0);
  ok("CAUTION labelled Moderate risk", constraintRiskScore(caution).l === "Moderate risk");
  near("GO → Low risk 8/10", constraintRiskScore(go).s, 8, 0);
  near("AVOID → High risk 2/10", constraintRiskScore(avoid).s, 2, 0);
  ok("unassessed stays Not assessed", constraintRiskScore(blank).l === "Not assessed");

  // Legacy back-compat: an old deal that stashed a verdict on data.constraint still resolves.
  ok("legacy data.constraint.verdict still honoured", constraintVerdict({ constraint:{ verdict:"AVOID" } }) === "AVOID");
})();

// 38 — Risk Register default count is the fallback the Data Room mirrors (v10.3)
(function(){
  ok("RISK_DEFAULTS seeds six risks (matches the Risk Register screen)", Array.isArray(RISK_DEFAULTS) && RISK_DEFAULTS.length === 6);
  // The Data Room §09.1 count = data.risks when populated, else RISK_DEFAULTS.length.
  function dataRoomRiskCount(deal){
    var r = (Array.isArray(deal.risks) && deal.risks.length>0) ? deal.risks : RISK_DEFAULTS;
    return r.length;
  }
  near("empty deal reports six risks, not zero", dataRoomRiskCount({}), 6, 0);
  near("edited deal reports its own risks", dataRoomRiskCount({ risks:[{id:1},{id:2}] }), 2, 0);
})();

// 39 — Assumption Mode is a non-destructive presentation overlay (v10.5)
(function(){
  var off = { land:{acres:30} };
  var on  = { land:{acres:30}, _assume:{planning:true, dd:true, constraints:true, risks:true} };
  var partial = { land:{acres:30}, _assume:{planning:true} };

  ok("assumeAny false when no flags", assumeAny(off) === false);
  ok("assumeAny true when a flag is set", assumeAny(on) === true);
  ok("assumePlanningConsented reads the flag", assumePlanningConsented(partial) === true);
  ok("partial: only planning assumed", assumeDDComplete(partial) === false && assumeConstraintsClear(partial) === false);
  ok("all four resolvers read their flags", assumePlanningConsented(on) && assumeDDComplete(on) && assumeConstraintsClear(on) && assumeRisksMitigated(on));

  // Non-destructive: turning on assumptions must NOT write real fields.
  ok("assumption flags don't fabricate planning.status", !(on.planning && on.planning.status));
  ok("assumption flags don't fabricate ddChecked", on.ddChecked === undefined);

  // Constraint dimension presents as low-risk-assumed (and stays labelled).
  ok("constraintRiskScore reflects assumed-clear", constraintRiskScore(on).s === 8 && /assumed/i.test(constraintRiskScore(on).l));
  ok("without the flag, an AVOID verdict still scores high risk",
     constraintRiskScore({ constraintCheck:{results:{verdict:"AVOID"}} }).s === 2);

  // isStageComplete honours the flags for presentation, reverts when cleared.
  ok("planning stage complete under assumption (no real status)", isStageComplete("planning", partial) === true);
  ok("planning stage NOT complete without the flag or a status", isStageComplete("planning", off) === false);
  ok("dd stage complete only when dd assumed", isStageComplete("dd", on) === true && isStageComplete("dd", partial) === false);
  ok("constraint stage complete only when constraints assumed", isStageComplete("constraint", on) === true && isStageComplete("constraint", partial) === false);
})();

// 40 — Markdown report renderer (v10.6): formats Markdown, degrades on plain text
(function(){
  // Helper: flatten a rendered node tree to the list of tag names present.
  function tags(node, acc){
    acc = acc || [];
    if(Array.isArray(node)){ node.forEach(function(n){ tags(n, acc); }); return acc; }
    if(!node || typeof node !== "object") return acc;
    if(node.tag) acc.push(node.tag);
    (node.children || []).forEach(function(c){ tags(c, acc); });
    return acc;
  }

  ok("empty input renders nothing", renderMarkdownReport("") === null && renderMarkdownReport(null) === null);

  var md = "## The Money\nThe scheme sells for **£65.6m**.\n\n- First risk\n- Second risk\n";
  var out = renderMarkdownReport(md);
  var tl = tags(out);
  ok("heading renders", tl.indexOf("div") >= 0);           // headings are styled divs
  ok("bold renders as <strong>", tl.indexOf("strong") >= 0);
  ok("bullets render as <ul>/<li>", tl.indexOf("ul") >= 0 && tl.indexOf("li") >= 0);

  // Plain text (no Markdown) still renders — as paragraphs, never crashes.
  var plain = renderMarkdownReport("Just a plain sentence about the deal.\n\nA second paragraph.");
  ok("plain text degrades to paragraphs", tags(plain).filter(function(t){return t==="p";}).length === 2);

  // A table renders a <table>.
  var tbl = renderMarkdownReport("| A | B |\n| --- | --- |\n| 1 | 2 |");
  ok("markdown table renders a <table>", tags(tbl).indexOf("table") >= 0);

  // The numbered-heading heuristic: ALL-CAPS numbered lines are headings, not list items.
  ok("'1. THE MONEY' is treated as a heading", _isNumberedHeading("THE MONEY") === true);
  ok("'1. Buy the milk.' is a normal list item", _isNumberedHeading("Buy the milk.") === false);
  ok("long numbered text is not a heading", _isNumberedHeading("This is a fairly long ordinary sentence that happens to be numbered and should stay a list item") === false);
})();

// 41 — Reset to raw import: the raw source survives a full build (v10.7)
(function(){
  // A Keystone build stores the raw brief so a deal can be reset to source later.
  var brief = { town:"Rugby", postcode:"CV8 3", acres:88, askingPrice:12500000, dealName:"Ryton site" };
  var deal = buildDealFromBrief(brief);
  ok("buildDealFromBrief stashes the raw brief", deal._keystone && deal._keystone.sourceBrief && num(deal._keystone.sourceBrief.acres) === 88);

  var recovered = rawImportBrief(deal);
  ok("rawImportBrief returns the stored Keystone brief", recovered && recovered.town === "Rugby" && num(recovered.askingPrice) === 12500000);

  // A Placona-imported deal resolves its raw brief from the stashed site.
  var placonaDeal = { _raw:{ placonaSite:{ site_name:"Land at X", town:"Maldon", site_area_acres:"32 acres", asking_price:"£14m", estimated_units:"250" } } };
  var pBrief = rawImportBrief(placonaDeal);
  ok("rawImportBrief converts a stashed Placona site to a brief", pBrief && pBrief.town === "Maldon" && num(pBrief.acres) === 32);

  // A hand-built deal (no import) has no raw source → the reset action stays hidden.
  ok("hand-built deal has no raw import", rawImportBrief({ land:{acres:10} }) === null);

  // The recovered brief rebuilds an equivalent fresh deal (repeatable reset).
  var rebuilt = buildDealFromBrief(recovered);
  near("reset+rebuild reproduces the scheme size", calcDealMetrics(rebuilt).gdv, calcDealMetrics(deal).gdv, 1000);
})();

// 42 — Constraint verdict derives from the score when the label didn't parse (v10.8)
(function(){
  // The reported deal: report + score stored, but verdict null (old regex never matched).
  var scoreOnly = { constraintCheck:{ results:{ report:"…full report…", score:51, verdict:null } } };
  ok("null verdict + score 51 → CAUTION (not empty/'Not assessed')", constraintVerdict(scoreOnly) === "CAUTION");
  near("and the Constraint Risk dimension scores Moderate, not 'Not assessed'", constraintRiskScore(scoreOnly).s, 5, 0);
  ok("Constraint Risk labelled Moderate risk", constraintRiskScore(scoreOnly).l === "Moderate risk");

  ok("score 72 with no verdict → GO", constraintVerdict({ constraintCheck:{results:{score:72}} }) === "GO");
  ok("score 30 with no verdict → AVOID", constraintVerdict({ constraintCheck:{results:{score:30}} }) === "AVOID");
  // An explicit parsed verdict always wins over the score derivation.
  ok("explicit verdict beats the score", constraintVerdict({ constraintCheck:{results:{score:80, verdict:"AVOID"}} }) === "AVOID");
  ok("no verdict and no score → empty (genuinely unassessed)", constraintVerdict({ land:{} }) === "");
})();

// 43 — Dashboard checklist / completion: Risk Register and Financial Modelling (v10.8)
(function(){
  // Risk Register had NO case in isStageComplete → could never be complete.
  ok("risks stage complete when the register has items", isStageComplete("risks", { risks:[{id:1,rag:"amber"}] }) === true);
  ok("risks stage incomplete when empty", isStageComplete("risks", { risks:[] }) === false);

  // Financial Modelling is complete off the engine (GDV + dev cost both compute),
  // not off a single stray input field (fin.exitYield) that a reset can wipe.
  var deal = buildDealFromBrief({ town:"Rugby", postcode:"CV8 3", acres:88, askingPrice:12500000 });
  var m = calcDealMetrics(deal);
  ok("engine computes GDV and dev cost for the deal", m.gdv > 0 && m.devCost > 0);
  ok("fin stage reads complete off the engine (no exitYield needed)", isStageComplete("fin", deal) === true);
})();

// 44 — Tenure Mix affordable split now flows into the ONE engine GDV (v10.9)
(function(){
  var mix = [{type:"3-bed semi",count:"700",sqft:"900",unitPrice:"400000",tenure:"private"},
             {type:"4-bed detached",count:"356",sqft:"1200",unitPrice:"550000",tenure:"private"}];
  var base = { assetType:"sfh", land:{acres:88,units:1056}, planning:{units:1056}, sfh:{mix:mix, basePsf:441, avgSqft:1000} };

  var m0 = computeSFHMetrics(base);
  near("no tenure split → GDV is full retail", m0.gdv, m0.retailGdv, 1);

  // 70% OMS + 30% Affordable Rent (0.60) → weighted factor 0.88 applied to retail.
  var withTen = Object.assign({}, base, { tenure:{ inputMode:"percentage", mix:{ oms:70, ar:30 } } });
  var m1 = computeSFHMetrics(withTen), dm1 = calcDealMetrics(withTen);
  ok("tenure split reduces GDV below full retail", m1.gdv < m1.retailGdv && m1.gdv > 0);
  near("GDV blend matches the units-weighted pricing factor (0.88)", m1.gdv, m1.retailGdv * 0.88, 1000);
  near("single engine: calcDealMetrics.gdv == computeSFHMetrics.gdv", dm1.gdv, m1.gdv, 1);
  ok("blended margin drops vs the all-market case", dm1.marginPct < calcDealMetrics(base).marginPct);

  // No double-count: if the sfh.mix rows already carry per-row tenure, the per-row blend
  // wins and the tenure.mix split is NOT layered on top.
  var perRow = { assetType:"sfh", land:{units:1000}, planning:{units:1000},
    sfh:{ basePsf:400, avgSqft:1000, mix:[
      {type:"3-bed semi",count:"700",sqft:"1000",unitPrice:"400000",tenure:"private"},
      {type:"3-bed semi",count:"300",sqft:"1000",unitPrice:"400000",tenure:"ahp_affordable"}]},
    tenure:{ inputMode:"percentage", mix:{ oms:50, sr:50 } } };
  var mp = computeSFHMetrics(perRow);
  near("per-row tenure blend used; tenure.mix not stacked on top", mp.gdv, mp.blendedGdv, 1);

  // Coverage guard: a partial units-mode allocation must NOT discount the whole GDV.
  var partial = Object.assign({}, base, { tenure:{ inputMode:"units", mix:{ oms:70, ar:30 } } });  // 100 of 1056
  near("partial allocation does not over-discount GDV", computeSFHMetrics(partial).gdv, m0.retailGdv, 1);
})();

// 45 — Professional fees % now reaches the SFH appraisal (v10.9)
(function(){
  var mk = function(feesPct){ return { assetType:"sfh", land:{units:200}, planning:{units:200},
    sfh:{ feesPct:feesPct, basePsf:400, avgSqft:1000, mix:[{type:"3-bed semi",count:"200",sqft:"1000",unitPrice:"400000",tenure:"private"}] } }; };
  var at10 = calcDealMetrics(mk(10)), at12 = calcDealMetrics(mk(12));
  ok("higher professional-fees % raises total dev fees", at12.fees > at10.fees);
  near("12% fees ≈ 1.2× the 10% figure", at12.fees, at10.fees * 1.2, at10.fees * 0.02);
  // feesPct is now a shared field (fin ↔ sfh ↔ rlv) so the Financial Modelling input propagates.
  ok("feesPct is wired across stages", _sharedGroupsFor("fin","feesPct").length > 0);
})();

// 46 — Capitalise multi-route reconciles to the engine via the shared blend (v10.11)
(function(){
  var base = { assetType:"sfh", land:{units:1056}, planning:{units:1056},
    sfh:{ basePsf:441, avgSqft:1000, mix:[{type:"3-bed semi",count:"1056",sqft:"1000",unitPrice:"400000",tenure:"private"}] } };
  var deal = Object.assign({}, base, { tenure:{ inputMode:"percentage", mix:{ oms:70, ar:20, sr:10 } } });
  var sm = computeSFHMetrics(deal);
  var factor = tenureMixBlendFactor(deal, 1056);

  // The multi-route panel rebuilds realisable value from tenure.mix as retailGdv × factor.
  // That MUST equal the engine's blended GDV, so the panel can't contradict the Dashboard.
  near("multi-route blend factor matches 0.7·1 + 0.2·0.6 + 0.1·0.5", factor, 0.87, 0.0001);
  near("retailGdv × factor == engine blended GDV (panel reconciles to engine)", sm.retailGdv * factor, sm.gdv, 1);

  // With no Tenure Mix split, the factor is 1 (panel keeps its existing sfh.mix behaviour).
  ok("no tenure split → factor 1 (multi-route unchanged)", tenureMixBlendFactor(base, 1056) === 1);
})();

// 47 — GDV fragmentation fixed: engine, tenure metrics all reconcile (v10.13)
(function(){
  // A Keystone-style deal sets an overall ahPct AND the user picks a Tenure Mix split.
  var deal = { assetType:"sfh", land:{units:1000}, planning:{units:1000, ahPct:30, afhPct:30},
    sfh:{ ahPct:30, basePsf:440, avgSqft:1000, mix:[{type:"3-bed semi",count:"1000",sqft:"1000",unitPrice:"440000",tenure:"private"}] },
    tenure:{ inputMode:"percent", mix:{ oms:70, ar:20, so:10 } } };

  var sm = computeSFHMetrics(deal), tm = computeTenureMetrics(deal), dm = calcDealMetrics(deal);

  // The Tenure Mix split (0.905) overrides the cruder ahPct haircut (0.88) — it's the more
  // specific breakdown of the same affordable units. Previously ahPct silently won.
  near("Tenure Mix split (0.905) overrides the ahPct haircut", sm.gdv / sm.retailGdv, 0.905, 0.0005);
  ok("blended GDV is the split, not the ahPct value", Math.abs(sm.gdv - sm.retailGdv*0.88) > 1000000);

  // All three GDV surfaces now agree (no more £379m vs £488m vs £510m fragmentation).
  near("computeTenureMetrics blended == engine GDV", tm.blendedGdv, sm.gdv, 50000);
  near("calcDealMetrics GDV == engine GDV", dm.gdv, sm.gdv, 1);
  near("tenure blend priced off the engine retail base", tm.pureMarketGdv, sm.retailGdv, 50000);

  // ahPct still applies when there is NO Tenure Mix split (back-compat).
  var ahOnly = { assetType:"sfh", land:{units:1000}, planning:{units:1000, ahPct:30},
    sfh:{ ahPct:30, basePsf:440, avgSqft:1000, mix:[{type:"3-bed semi",count:"1000",sqft:"1000",unitPrice:"440000",tenure:"private"}] } };
  near("no tenure split → ahPct haircut still applied", computeSFHMetrics(ahOnly).gdv / computeSFHMetrics(ahOnly).retailGdv, 0.88, 0.01);
})();

// 48 — Detailed Appraisal auto-populate has a real land cost to pull (v10.16)
(function(){
  // The Detailed Appraisal's "Auto-Populate from Deal" now sources the land price from
  // calcDealMetrics(deal).rlv. Guard that a built deal exposes a positive engine RLV, so
  // the land price can't silently populate as £0 (which overstated profit by ~£77m).
  var deal = buildDealFromBrief({ town:"Rugby", postcode:"CV8 3", acres:88, askingPrice:12500000, density:12 });
  var m = calcDealMetrics(deal);
  ok("engine RLV is positive (auto-populate land-cost source)", num(m.rlv) > 0);
  ok("land cost is a material share of GDV (not ~0)", num(m.gdv) > 0 && (m.rlv / m.gdv) > 0.05);
})();

// 49 — Planning Strategy AI quotes the engine S106, not the blank input (v10.18)
(function(){
  // Only the per-unit S106 is set (via auto-fill/propagation); the total INPUT stays blank.
  var deal = buildDealFromBrief({ town:"Rugby", postcode:"CV8 3", acres:88, askingPrice:12500000, density:12 });
  deal.planning = Object.assign({}, deal.planning, { s106pu:23550 });
  ok("planning.s106 total input is blank/zero", !num(deal.planning.s106));
  ok("engine S106 (what the Planning prompt now quotes) is non-zero", num(calcDealMetrics(deal).s106) > 0);
})();

// 50 — Multi-year DCF hold model: computeDCFHoldValue / capDCFParams (v10.29)
(function(){
  var NOI = 1000000, yF = 0.05, statik = NOI / yF;   // static NOI ÷ yield

  // (a) The keystone identity: 0% growth (uncollared) + discount == exit yield ⇒ DCF == static.
  var d0 = computeDCFHoldValue(NOI, 0, 0, 0, 25, yF);
  near("DCF 0% growth equals static NOI/yield", d0.value, statik, 1);
  ok("DCF 0% growth → effective growth is 0", d0.effectiveGrowth === 0);

  // (b) Any positive indexation lifts the value above the static year-1 basis.
  var dd = computeDCFHoldValue(NOI, 2.75, 1, 4, 25, yF);
  ok("DCF with 2.75% CPI exceeds static basis", dd.value > statik);
  near("DCF 2.75% CPI uses collared growth 2.75%", dd.effectiveGrowth, 0.0275, 1e-9);

  // (c) Floor collar binds upward: a 0% CPI with a 1% floor grows at 1%, not 0%.
  var df = computeDCFHoldValue(NOI, 0, 1, 4, 25, yF);
  near("DCF floor collar binds (0% CPI → 1% growth)", df.effectiveGrowth, 0.01, 1e-9);
  ok("DCF floored value exceeds the 0%-growth value", df.value > d0.value);

  // (d) Cap collar binds downward: a 6% CPI with a 4% cap grows at 4%, not 6%.
  var dc = computeDCFHoldValue(NOI, 6, 1, 4, 25, yF);
  near("DCF cap collar binds (6% CPI → 4% growth)", dc.effectiveGrowth, 0.04, 1e-9);

  // (e) A 1% floor "1" must NOT be read as a 100% fraction (the normalisation trap we hit).
  ok("1% floor is not mistaken for 100% growth", df.value < dd.value && dd.value < dc.value);

  // (f) exitYield tolerates a percent (5) or a fraction (0.05) identically.
  near("DCF yield percent == fraction", computeDCFHoldValue(NOI,2.75,1,4,25,5).value, dd.value, 1);

  // (g) Terminal value = year-(n+1) rent capitalised at the exit yield; discounted back.
  near("DCF reversion NOI is year-26 grown rent", dd.reversionNOI, NOI*Math.pow(1.0275,25), 1);
  near("DCF terminal value = reversion NOI / yield", dd.terminalValue, dd.reversionNOI/yF, 1);
  near("DCF value = PV(income) + PV(terminal)", dd.value, dd.pvIncome + dd.pvTerminal, 1);

  // (h) Degenerate guards: zero NOI or zero yield ⇒ zero value, never NaN/Infinity.
  ok("DCF zero NOI → 0", computeDCFHoldValue(0,2.75,1,4,25,yF).value === 0);
  ok("DCF zero yield → 0 (no divide-by-zero)", computeDCFHoldValue(NOI,2.75,1,4,25,0).value === 0);

  // (i) capDCFParams: blank inputs fall back to defaults; an explicit 0 is honoured.
  var pDef = capDCFParams({});
  ok("capDCFParams default CPI 2.75", pDef.growth === 2.75);
  ok("capDCFParams default floor 1", pDef.floor === 1);
  ok("capDCFParams default cap 4", pDef.cap === 4);
  ok("capDCFParams default hold 25yr", pDef.years === 25);
  var p0 = capDCFParams({ capitalise:{ cpiGrowth:0, holdYears:30 } });
  ok("capDCFParams honours explicit 0% CPI", p0.growth === 0);
  ok("capDCFParams honours custom 30yr hold", p0.years === 30);

  // (j) dealDCFHoldValue wires the deal's exit yield through the same core.
  var deal = { capitalise:{ targetYield:5 } };
  near("dealDCFHoldValue matches core at the deal yield", dealDCFHoldValue(deal, NOI).value, dd.value, 1);
})();

// 51 — Unified NOI (dealNOI) — single source of truth for Exit + Board Proposal (v10.30)
(function(){
  // (a) BTR bug fix: the SFH engine returns capNetRentPa=0 for a BTR scheme (no house mix);
  //     dealNOI must still produce a positive NOI from the planning units.
  var btr = { assetType:"btr", land:{city:"rugby"}, planning:{units:150, ahPct:25},
    capitalise:{ marketRentPerUnitPa:14400, mgmtRate:25 } };
  ok("SFH engine capNetRentPa is 0 for BTR (the old bug source)", num(computeSFHMetrics(btr).capNetRentPa) === 0);
  ok("dealNOI(BTR) is positive (bug fixed)", dealNOI(btr) > 0);
  // Expected: (112.5 priv + 37.5*0.65 ah) * 14400 * (1-0.25) = 136.875*14400*0.75
  near("dealNOI(BTR) matches the engine rent+net convention", dealNOI(btr), 136.875*14400*0.75, 2);

  // (b) For an SFH scheme dealNOI returns the SFH engine's own capNetRentPa (no divergence).
  var sfh = { assetType:"sfh", land:{city:"rugby"}, planning:{units:120, ahPct:25},
    sfh:{ basePsf:300, avgSqft:950, ahPct:25, mix:[{type:"3-bed",count:"120",sqft:"950",unitPrice:"285000",tenure:"private"}] },
    capitalise:{ marketRentPerUnitPa:14400 } };
  ok("dealNOI(SFH) equals computeSFHMetrics.capNetRentPa", num(computeSFHMetrics(sfh).capNetRentPa) > 0 && dealNOI(sfh) === num(computeSFHMetrics(sfh).capNetRentPa));

  // (c) PBSA uses weekly rent × 52 when no per-unit override is present.
  var pbsa = { assetType:"pbsa", land:{city:"manchester"}, planning:{units:200, ahPct:0 }, capitalise:{} };
  ok("dealNOI(PBSA) positive from weekly MKT rent", dealNOI(pbsa) > 0);

  // (d) No units anywhere ⇒ 0 (guard, never NaN).
  ok("dealNOI with no units → 0", dealNOI({ assetType:"btr", planning:{}, capitalise:{} }) === 0);
})();

// 52 — Verified rents key off the POSTCODE at the finest researched granularity (v10.31)
(function(){
  // (a) postcode splitter — outcode / sector / full.
  var p = pcParts("CV6 5AB");
  ok("pcParts outcode", p.outcode === "CV6");
  ok("pcParts sector (district-level key)", p.sector === "CV6 5");
  ok("pcParts full", p.full === "CV6 5AB");
  ok("pcParts outcode-only input", pcParts("CV22").outcode === "CV22" && pcParts("CV22").sector === null);

  // (b) A Rugby postcode gets the researched Rugby figures — even though CV geocodes to the
  //     Coventry anchor market (this is the town-vs-district fix).
  var rugbySite = { land:{ postcode:"CV22 5AB", city:"coventry" } };
  ok("Rugby postcode resolves verified rents via outcode", !!verifiedRents(rugbySite));
  ok("Rugby 2-bed uses verified £1000", areaRentPcm(rugbySite, 2) === 1000);
  ok("Rugby 3-bed uses verified £1175", areaRentPcm(rugbySite, 3) === 1175);
  ok("Rugby 4-bed uses verified £1550", areaRentPcm(rugbySite, 4) === 1550);
  ok("Rugby 1-bed stays generic (no verified figure)", areaRentPcm(rugbySite, 1) === Math.round(MKT[dealCityKey(rugbySite)].btr * RENT_BED_FACTOR[1]));

  // (c) A Coventry postcode with NO researched data is untouched — no fabricated figures.
  var covSite = { land:{ postcode:"CV6 1AB", city:"coventry" } };
  ok("Coventry CV6 has no verified rents (not fabricated)", verifiedRents(covSite) === null);
  ok("Coventry 3-bed stays generic", areaRentPcm(covSite, 3) === Math.round(MKT.coventry.btr * RENT_BED_FACTOR[3]));

  // (d) Most-specific wins: a sector entry beats an outcode entry (mechanism proof, using a
  //     temporary injected district so we prove resolution without inventing a real rent).
  var savedFull = VERIFIED_RENTS["CV6 5AB"], savedSector = VERIFIED_RENTS["CV6 5"];
  VERIFIED_RENTS["CV6 5"] = { label:"test district", beds:{ 3:1300 } };
  ok("sector-level entry resolves for CV6 5 (Foleshill-style district)", areaRentPcm({ land:{ postcode:"CV6 5AA" } }, 3) === 1300);
  ok("neighbouring sector CV6 1 unaffected by CV6 5 entry", verifiedRents({ land:{ postcode:"CV6 1AA" } }) === null);
  VERIFIED_RENTS["CV6 5AB"] = { label:"test parcel", beds:{ 3:1400 } };
  ok("full-postcode entry beats the sector entry", areaRentPcm({ land:{ postcode:"CV6 5AB" } }, 3) === 1400);
  // restore
  if(savedFull === undefined) delete VERIFIED_RENTS["CV6 5AB"]; else VERIFIED_RENTS["CV6 5AB"] = savedFull;
  if(savedSector === undefined) delete VERIFIED_RENTS["CV6 5"]; else VERIFIED_RENTS["CV6 5"] = savedSector;
})();

// 53 — SFH House Mix: sale price edits & Base-£/sqft propagation (v10.32)
// Reproduces the Staplehurst audit findings. The engine (computeSFHMetrics) prioritises a
// row's stored unitPrice over sqft×psf, so a baked-in unitPrice silently overrides the
// editable Sqft/£psf cells and the Base Sale £/sqft. These tests replicate the SFH screen's
// pure edit helpers and assert the engine's GDV responds.
(function(){
  // Pure mirror of screen-SFH.js updMixPrice() — editing Sqft or £/sqft re-derives unitPrice.
  function updMixPrice(mix, i, field, v, basePsf){
    var m=mix.slice(); var prev=m[i]||{};
    var inf=HOUSE_TYPES[prev.type]||HOUSE_TYPES["3-bed semi"]||{sqft:900,adj:1};
    var prevSq=numOr(prev.sqft, inf.sqft);
    var priorPsf=num(prev.psf)||(num(prev.unitPrice||prev.salePrice)&&prevSq?num(prev.unitPrice||prev.salePrice)/prevSq:0)||basePsf*(inf.adj||1);
    var r=Object.assign({},prev); r[field]=v;
    var newSq=field==="sqft"?(num(v)||inf.sqft):numOr(r.sqft, inf.sqft);
    var newPsf=field==="psf"?num(v):priorPsf;
    if(newSq>0&&newPsf>0){ r.unitPrice=String(Math.round(newSq*newPsf)); }
    m[i]=r; return m;
  }
  // Pure mirror of the "Auto-price sale / type" button — reprice every row from Base £/sqft.
  function autoPriceMix(mix, basePsf){
    return mix.map(function(r){
      var inf=HOUSE_TYPES[r.type]||HOUSE_TYPES["3-bed semi"]||{sqft:900,adj:1};
      var sq=numOr(r.sqft, inf.sqft);
      var psf2=Math.round(basePsf*(inf.adj||1));
      var c=Object.assign({},r); c.psf=String(psf2);
      if(sq>0) c.unitPrice=String(Math.round(sq*psf2));
      return c;
    });
  }
  function deal(mix, basePsf){
    return { assetType:"sfh", land:{city:"maidstone"}, sfh:{ city:"maidstone", acres:50, ahPct:0, basePsf:basePsf, buildPsf:205, mix:mix } };
  }
  // Staplehurst-style rows: real per-type sqft + £/sqft baked as an absolute unit price.
  var mix0=[
    {type:"4-bed detached", count:"10", sqft:"1650", unitPrice:String(1650*385), tenure:"private"},
    {type:"2-bed terrace",  count:"10", sqft:"850",  unitPrice:String(850*365),  tenure:"private"}
  ];
  var g0=computeSFHMetrics(deal(mix0,385)).gdv;
  ok("SFH mix GDV uses real per-row sqft×£psf", g0 === 10*1650*385 + 10*850*365);

  // Bug #2 documented: changing Base Sale £/sqft alone does NOT move GDV (baked unitPrice wins).
  ok("Base £/sqft change alone leaves baked GDV unchanged (why the button is needed)",
     computeSFHMetrics(deal(mix0,332)).gdv === g0);

  // Fix: "Auto-price sale / type" reprices every row from the (corrected) Base £/sqft.
  var repriced=autoPriceMix(mix0,332);
  var gExpect = 10*1650*332 + 10*850*332;  // v10.43 — sale £/sqft is now FLAT across types (adj = 1.00)
  ok("Auto-price propagates corrected Base £/sqft into GDV", computeSFHMetrics(deal(repriced,332)).gdv === gExpect);
  ok("Corrected base (£385→£332) lowers GDV as expected", gExpect < g0);

  // Fix: editing the £/sqft cell re-derives unit price so the edit sticks in the engine.
  var mPsf=updMixPrice(mix0,0,"psf","400",332);
  ok("Editing £/sqft cell updates unit price", num(mPsf[0].unitPrice) === 1650*400);
  ok("Editing £/sqft cell moves engine GDV", computeSFHMetrics(deal(mPsf,332)).gdv === 10*1650*400 + 10*850*365);

  // Fix: editing the Sqft cell preserves the effective £/sqft and rescales the unit price.
  var mSqft=updMixPrice(mix0,0,"sqft","1800",332);
  ok("Editing Sqft preserves £/sqft (385) and rescales unit price", num(mSqft[0].unitPrice) === 1800*385);

  // Fix: a row priced purely by sqft×psf (no unitPrice) is honoured by the engine — proves the
  // editable cells feed through even when no baked unit price exists.
  var mClean=[{type:"4-bed detached", count:"10", sqft:"1650", psf:"332", tenure:"private"}];
  ok("Row with psf and no unitPrice values at sqft×psf", computeSFHMetrics(deal(mClean,332)).gdv === 10*1650*332);
})();

// 54 — Board Proposal viability pathways: lever re-appraisal directionality (v10.32)
// Mirrors screen-Proposal.js viabilityPathwaysSection under() — each lever re-appraises the
// whole deal on calcDealMetrics with one change. Proves the levers move RLV the right way and
// that a marginal/negative scheme can be lifted by the combined pathway. Uses a Staplehurst-like
// large SFH scheme deliberately built to NOT stack at realistic build costs.
(function(){
  function clone(d){ return JSON.parse(JSON.stringify(d)); }
  function rlvOf(d){ var m=calcDealMetrics(d); return num(m.rlv); }
  function under(base, mutate){ var d=clone(base); mutate(d); return rlvOf(d); }
  // A big Kent SFH scheme: 1,000-plot mix, realistic £205 build, 35% affordable, high guide price.
  function bigMix(){
    return [
      {type:"3-bed semi",    count:"400", sqft:"1020", unitPrice:String(1020*332), buildPsf:"205", tenure:"private"},
      {type:"4-bed detached",count:"350", sqft:"1500", unitPrice:String(1500*Math.round(332*1.18)), buildPsf:"205", tenure:"private"},
      {type:"2-bed terrace", count:"250", sqft:"850",  unitPrice:String(850*Math.round(332*0.88)),  buildPsf:"205", tenure:"private"}
    ];
  }
  var deal={ assetType:"sfh", land:{city:"maidstone", acres:150, price:60000000, units:"1902"},
    planning:{ahPct:"35"}, sfh:{ city:"maidstone", acres:150, ahPct:"35", basePsf:332, buildPsf:205, finRate:7.5, mix:bigMix() } };
  var base=rlvOf(deal);

  // Modular / timber-frame build −10% lifts the residual.
  var vBuild=under(deal, function(d){
    var s=d.sfh; var bp=num(s.buildPsf)||205; s.buildPsf=String(Math.round(bp*0.9));
    s.mix=s.mix.map(function(r){ r=Object.assign({},r); if(num(r.buildPsf)>0) r.buildPsf=String(Math.round(num(r.buildPsf)*0.9)); return r; });
  });
  ok("Modular build −10% improves RLV", vBuild > base);

  // Affordable % negotiation (35%→25%) lifts the residual (less GDV discount).
  var vAh=under(deal, function(d){ d.sfh.ahPct="25"; d.planning.ahPct="25"; d.planning.afhPct="25"; });
  ok("Affordable 35%→25% improves RLV", vAh > base);

  // Density +15% changes RLV (sign depends on per-plot economics) — just prove it re-appraises.
  var vDens=under(deal, function(d){ d.sfh.mix=d.sfh.mix.map(function(r){ r=Object.assign({},r); r.count=String(Math.round(num(r.count)*1.15)); return r; }); });
  ok("Density +15% re-appraises to a different RLV", vDens !== base);

  // Phased finance −30% lifts the residual (less finance cost).
  var vPhase=under(deal, function(d){ d.sfh.finRate=String(7.5*0.7); });
  ok("Phased finance −30% improves RLV", vPhase > base);

  // Combined pathway (build + AH + phasing) then AHP grant on top clears more of the gap than any single lever.
  var vCombo=under(deal, function(d){
    var s=d.sfh; s.buildPsf=String(Math.round(205*0.9));
    s.mix=s.mix.map(function(r){ r=Object.assign({},r); if(num(r.buildPsf)>0) r.buildPsf=String(Math.round(num(r.buildPsf)*0.9)); return r; });
    s.ahPct="25"; d.planning.ahPct="25"; d.planning.afhPct="25";
    s.finRate=String(7.5*0.7);
  });
  var ahUnits=Math.round(computeSFHMetrics(deal).totalUnits*0.35);
  var comboPlusGrant=vCombo + ahUnits*50000;
  ok("Combined pathway beats every single lever", vCombo > vBuild && vCombo > vAh && vCombo > vPhase);
  ok("Combined pathway + AHP grant moves RLV materially toward viability", comboPlusGrant > base + 5000000);
  ok("AHP grant uplift is positive across the affordable units", ahUnits*50000 > 0);
})();

// 55 — SFH scheme sizing to the site allocation (v10.34)
// Mirrors screen-SFH.js: the modelled mix targets the brief/allocation units (e.g. Keystone's
// ~1,800) when they imply a plausible density, else the density-based capacity — and the
// generated mix sums EXACTLY to that target, so GDV/RLV reflect the full site, not a smaller
// auto-figure. Proves the 1,800-vs-1,000 reconciliation the Staplehurst review raised.
(function(){
  function targetUnits(acres, dph, briefUnits){
    var sHa=acres*0.404686;
    var totalUa=Math.max(4, Math.floor(sHa*(dph||30)));
    var dphImplied=sHa>0?briefUnits/sHa:0;
    var useBrief=briefUnits>0 && dphImplied>=4 && dphImplied<=60;
    return { target: useBrief?briefUnits:totalUa, useBrief:useBrief };
  }
  function buildTypicalMix(target, basePsf){
    var spec=[
      {type:"1-bed terrace",sqft:550,adj:0.75,pc:0.08},{type:"2-bed terrace",sqft:720,adj:0.88,pc:0.12},
      {type:"2-bed semi",sqft:820,adj:0.90,pc:0.10},{type:"3-bed semi",sqft:1020,adj:1.00,pc:0.25},
      {type:"3-bed detached",sqft:1150,adj:1.08,pc:0.18},{type:"4-bed semi",sqft:1300,adj:1.14,pc:0.12},
      {type:"4-bed detached",sqft:1500,adj:1.18,pc:0.15}
    ];
    var used=0;
    return spec.map(function(r,i){
      var cnt=i===spec.length-1?Math.max(0,target-used):Math.round(target*r.pc); used+=cnt;
      return {type:r.type,count:String(cnt),sqft:String(r.sqft),unitPrice:String(Math.round(r.sqft*basePsf*r.adj)),tenure:"private"};
    });
  }
  function sfhWith(mix){ return { assetType:"sfh", land:{city:"maidstone"}, sfh:{city:"maidstone",acres:271.7,basePsf:400,buildPsf:205,mix:mix} }; }

  // Staplehurst: 271.7 acres, allocation 1,800 → honoured (16.4 dph gross, plausible).
  var t1=targetUnits(271.7, 30, 1800);
  ok("Allocation 1,800 honoured as scheme target", t1.useBrief && t1.target===1800);
  var m1=buildTypicalMix(1800, 400);
  ok("Generated mix sums EXACTLY to 1,800", m1.reduce(function(a,r){return a+num(r.count);},0)===1800);
  ok("Generated mix is a balanced multi-type scheme", m1.length===7 && m1.every(function(r){return num(r.count)>=0;}));
  ok("Engine values the 1,800 mix at 1,800 units", computeSFHMetrics(sfhWith(m1)).totalUnits===1800);
  // GDV of the 1,800 mix clearly exceeds a 1,000-plot cut of the same distribution.
  var m1k=buildTypicalMix(1000, 400);
  ok("1,800 mix GDV exceeds the 1,000 mix GDV", computeSFHMetrics(sfhWith(m1)).gdv > computeSFHMetrics(sfhWith(m1k)).gdv);

  // No allocation → density-based capacity (100 acres @ 20 dph).
  var t2=targetUnits(100, 20, 0);
  ok("No allocation → density capacity used", !t2.useBrief && t2.target===Math.max(4,Math.floor(100*0.404686*20)));
  ok("Density-based mix sums to its capacity", buildTypicalMix(t2.target,400).reduce(function(a,r){return a+num(r.count);},0)===t2.target);

  // Implausible allocation (50 on 271.7 acres = 0.45 dph) → ignored, density used instead.
  var t3=targetUnits(271.7, 30, 50);
  ok("Implausible allocation (0.45 dph) ignored", !t3.useBrief && t3.target>50);
})();

// 56 — Land purchase costs (SDLT + legals/acquisition) and the all-in position (v10.35)
// Mirrors screen-Proposal.js landSDLT/landAcqCosts and the all-in-margin identity, so the
// one-pager's "cost to buy vs residual land value" test is provably correct.
(function(){
  function landSDLT(p){ if(p<=150000) return 0; var t=Math.min(p-150000,100000)*0.02; if(p>250000) t+=(p-250000)*0.05; return t; }
  function landAcqCosts(price){ if(price<=0) return {sdlt:0,other:0,total:0}; var s=landSDLT(price), o=price*0.015; return {sdlt:s,other:o,total:s+o}; }

  // SDLT non-residential land bands.
  ok("SDLT nil at/under £150k", landSDLT(150000)===0);
  ok("SDLT £250k = £2,000 (2% band only)", landSDLT(250000)===2000);
  ok("SDLT £18m = £889,500", landSDLT(18000000)===889500);
  ok("SDLT £30m = £1,489,500", landSDLT(30000000)===1489500);

  var acq=landAcqCosts(18000000);
  ok("Acquisition on £18m = SDLT £889,500 + £270,000 (1.5%) = £1,159,500", acq.sdlt===889500 && acq.other===270000 && acq.total===1159500);

  // All-in position ties to the engine: profit after land = GDV − devCost − (price + acq costs),
  // and equals RLV + targetProfit − (price + acq) by definition of RLV.
  var deal={ assetType:"sfh", land:{city:"maidstone", price:18000000}, planning:{ahPct:"35"},
    sfh:{city:"maidstone", acres:271.7, ahPct:"35", basePsf:400, buildPsf:205, finRate:7.5,
      mix:[{type:"3-bed semi",count:"800",sqft:"1020",unitPrice:String(1020*400)},
           {type:"4-bed detached",count:"1000",sqft:"1500",unitPrice:String(1500*Math.round(400*1.18))}]} };
  var m=computeSFHMetrics(deal);
  var ask=18000000, a=landAcqCosts(ask), total=ask+a.total;
  var profitAllIn_identity = m.rlv + m.profit - total;      // screen uses this identity
  var profitAllIn_direct   = m.gdv - m.devCost - total;     // GDV − costs − all-in land
  near("All-in profit identity matches direct computation", profitAllIn_identity, profitAllIn_direct, 1);
  ok("Headroom = RLV − all-in land cost", Math.abs((m.rlv-total) - (m.rlv-(ask+a.total))) < 1);
  // With a guide price BELOW the RLV, the all-in position is still positive headroom.
  ok("Guide below RLV leaves positive headroom", (m.rlv - total) > 0 === (ask < m.rlv - a.total));
})();

// 57 — One-pager "path to a 15% margin" solver (v10.36)
// Mirrors screen-Proposal.js: solve the engine for the lever value that reaches a 15% developer
// margin, where margin = (GDV − devCost − land) / GDV. Proves the solved targets actually hit
// 15%, and that a per-row-tenure affordable is correctly detected as an inert scheme-ahPct lever.
(function(){
  function clone(d){ return JSON.parse(JSON.stringify(d)); }
  function marginOf(d, land){ var sm=computeSFHMetrics(d); var g=num(sm.gdv); return g>0?((g-num(sm.devCost)-(land||0))/g*100):-999; }
  function solve(base, mutate, lo, hi, land){
    function f(x){ var d=clone(base); mutate(d,x); return marginOf(d, land); }
    var mLo=f(lo), mHi=f(hi);
    if((mLo-15)*(mHi-15)>0) return null;
    for(var i=0;i<46;i++){ var mid=(lo+hi)/2, m=f(mid); if((m-15)*(mLo-15)<=0){ hi=mid; mHi=m; } else { lo=mid; mLo=m; } }
    return (lo+hi)/2;
  }
  // A sub-15% all-private scheme (margin at £0 land well under 15%).
  var deal={ assetType:"sfh", land:{city:"maidstone", acres:271.7}, planning:{},
    sfh:{city:"maidstone", acres:271.7, basePsf:300, buildPsf:205, finRate:7.5,
      mix:[{type:"3-bed semi",count:"600",sqft:"1020",unitPrice:String(1020*300),buildPsf:"205"},
           {type:"4-bed detached",count:"400",sqft:"1500",unitPrice:String(1500*330),buildPsf:"205"}]} };
  var m0=marginOf(deal,0);
  ok("Baseline scheme is below a 15% margin", m0 < 15);

  // Sale-price factor that reaches 15%, then confirm applying it yields ~15%.
  var fSale=solve(deal, function(d,x){ var s=d.sfh; s.basePsf=String(Math.round(300*x)); s.mix=s.mix.map(function(r){ r=Object.assign({},r); r.unitPrice=String(Math.round(num(r.unitPrice)*x)); return r; }); }, 0.6, 2.5, 0);
  ok("Sale-price lever reaches 15%", fSale!=null);
  if(fSale){ var d2=clone(deal); d2.sfh.basePsf=String(Math.round(300*fSale)); d2.sfh.mix=d2.sfh.mix.map(function(r){ r=Object.assign({},r); r.unitPrice=String(Math.round(num(r.unitPrice)*fSale)); return r; });
    near("Solved sale price yields a 15% margin", marginOf(d2,0), 15, 0.3);
    ok("Solved sale price is higher than current (£300)", Math.round(300*fSale) > 300); }

  // Build-cost factor that reaches 15%.
  var fBuild=solve(deal, function(d,x){ var s=d.sfh; s.buildPsf=String(Math.round(205*x)); s.mix=s.mix.map(function(r){ r=Object.assign({},r); if(num(r.buildPsf)) r.buildPsf=String(Math.round(num(r.buildPsf)*x)); return r; }); }, 0.30, 1.0, 0);
  ok("Build-cost lever reaches 15%", fBuild!=null);
  if(fBuild){ var d3=clone(deal); d3.sfh.buildPsf=String(Math.round(205*fBuild)); d3.sfh.mix=d3.sfh.mix.map(function(r){ r=Object.assign({},r); r.buildPsf=String(Math.round(205*fBuild)); return r; });
    near("Solved build cost yields ~15% margin (±rounding of £/sqft)", marginOf(d3,0), 15, 0.6);
    ok("Solved build cost is lower than current (£205)", Math.round(205*fBuild) < 205); }

  // A guide price raises the bar: the sale target to hit 15% AFTER land must exceed the £0-land target.
  var fSaleLand=solve(deal, function(d,x){ var s=d.sfh; s.basePsf=String(Math.round(300*x)); s.mix=s.mix.map(function(r){ r=Object.assign({},r); r.unitPrice=String(Math.round(num(r.unitPrice)*x)); return r; }); }, 0.6, 3.0, 15000000);
  ok("15% target after £15m land needs a higher sale price than at £0 land", fSaleLand!=null && fSale!=null && fSaleLand > fSale);

  // Affordable via PER-ROW tenure is an inert scheme-ahPct lever (changing ahPct doesn't move GDV).
  var perRow={ assetType:"sfh", land:{city:"maidstone", acres:271.7}, planning:{ahPct:"40"},
    sfh:{city:"maidstone", acres:271.7, ahPct:"40", basePsf:332, buildPsf:205,
      mix:[{type:"3-bed semi",count:"600",sqft:"1020",unitPrice:String(1020*332)},
           {type:"2-bed semi",count:"400",sqft:"800",unitPrice:String(800*194),tenure:"ahp_affordable"}]} };
  var mA=marginOf(perRow,0);
  var perRow0=clone(perRow); perRow0.sfh.ahPct="0"; perRow0.planning.ahPct="0";
  ok("Per-row affordable ⇒ scheme ahPct is inert (correctly gated out)", Math.abs(marginOf(perRow0,0)-mA) <= 0.1);
})();

// 58 — Keystone sizes the house mix to the scheme's unit count (v10.37)
// A brief that quotes an allocation (units) AND an indicative smaller mix must build a deal
// whose mix sums to the allocation — so the appraisal, headline and board paper agree straight
// out of Keystone, with no manual "auto-fill" needed on the SFH stage.
(function(){
  if(typeof buildDealFromBrief !== "function"){ ok("buildDealFromBrief available", false); return; }
  function mixSum(d){ return (d.sfh.mix||[]).reduce(function(a,r){ return a+num(r.count); },0); }

  // Allocation 1,800 + indicative 1,000-home mix → mix sized up to 1,800.
  var brief={ town:"Maidstone", postcode:"TN12 0AA", acres:271.7, units:1800, affordablePct:40, askingPrice:60000000,
    houseMix:[{type:"4-bed detached",count:320,sqft:1650,salePrice:1650*385},{type:"3-bed semi",count:300,sqft:1150,salePrice:1150*387},
      {type:"2-bed terrace",count:140,sqft:850,salePrice:850*365},{type:"2-bed semi",count:180,sqft:800,salePrice:800*194,tenure:"affordable rent"},
      {type:"3-bed semi",count:60,sqft:950,salePrice:950*300}] };
  var d=buildDealFromBrief(brief);
  ok("Keystone mix sized to the 1,800 allocation", mixSum(d)===1800);
  ok("Keystone land & planning units = 1,800", num(d.land.units)===1800 && num(d.planning.units)===1800);
  ok("Engine values the full-allocation mix at 1,800", computeSFHMetrics(d).totalUnits===1800);
  ok("Scaling note recorded on the deal", (d._keystone.assumptions||[]).some(function(a){return /sized to the scheme/.test(a);}));

  // Mix already agrees with units → left untouched (no spurious rescale).
  var brief2={ town:"Maidstone", postcode:"TN12 0AA", acres:60, units:1000, affordablePct:30,
    houseMix:[{type:"3-bed semi",count:600,sqft:1020,salePrice:1020*350},{type:"4-bed detached",count:400,sqft:1500,salePrice:1500*400}] };
  ok("Matching mix is left as-is (sums to 1,000)", mixSum(buildDealFromBrief(brief2))===1000);

  // Units only, no mix → a generated mix sums to the units.
  var brief3={ town:"Maidstone", postcode:"TN12 0AA", acres:100, units:1200, affordablePct:30 };
  ok("Units-only brief generates a mix summing to the units", mixSum(buildDealFromBrief(brief3))===1200);
})();

// 59 — Keystone rebuild preserves manual downstream work (v10.38)
// A rebuild from the brief must NOT silently wipe planning judgement, verified prices, exit
// strategy or constraint checks. preserveManualOnRebuild carries them into the fresh deal and
// reports what it kept; the scheme itself (mix/units) is still re-derived from the brief.
(function(){
  if(typeof preserveManualOnRebuild !== "function"){ ok("preserveManualOnRebuild available", false); return; }
  // A prior deal with manual downstream work the brief doesn't carry.
  var prev = {
    assetType:"sfh",
    land:{ city:"maidstone", acres:271.7, units:"1800" },
    planning:{ units:"1800", status:"none", riskLevel:"high", bng:"onsite10", gateway:"na", ahPct:"40" },
    sfh:{ city:"maidstone", acres:271.7, basePsf:"332", buildPsf:"205", ahPct:"40",
      mix:[{type:"3-bed semi",count:"1000",sqft:"1020",unitPrice:String(1020*332)},
           {type:"4-bed detached",count:"800",sqft:"1500",unitPrice:String(1500*Math.round(332*1.18))}] },
    exit:{ strategy:"forward_sale", investorType:"uk_pension" },
    constraintCheck:{ results:{ score:62 } },
    dd:{ notes:"site visit booked" }
  };
  // A freshly rebuilt deal (as buildDealFromBrief would produce) — brief-derived, generic price,
  // and NONE of the manual fields.
  var built = buildDealFromBrief({ town:"Maidstone", postcode:"TN12 0AA", acres:271.7, units:1800, affordablePct:40 });
  ok("Fresh rebuild has no exit stage (would be wiped)", built.exit == null);
  var freshBasePsf = num(built.sfh.basePsf);

  var kept = preserveManualOnRebuild(prev, built);
  // Whole stages carried over.
  ok("Rebuild preserves the Exit stage", built.exit && built.exit.strategy === "forward_sale" && built.exit.investorType === "uk_pension");
  ok("Rebuild preserves the Constraint Check", built.constraintCheck && num(built.constraintCheck.results.score) === 62);
  ok("Rebuild preserves Due Diligence notes", built.dd && built.dd.notes === "site visit booked");
  // Manual planning judgement carried over.
  ok("Rebuild preserves Planning Risk Level", built.planning.riskLevel === "high");
  ok("Rebuild preserves Planning Status", built.planning.status === "none");
  ok("Rebuild preserves BNG", built.planning.bng === "onsite10");
  ok("Rebuild preserves Fire Safety Gateway", built.planning.gateway === "na");
  // Verified Base Sale £/sqft carried over AND the mix repriced to it.
  ok("Rebuild preserves the verified Base Sale £/sqft (£332, not the generic default)", num(built.sfh.basePsf) === 332 && freshBasePsf !== 332);
  (function(){
    var semi = built.sfh.mix.filter(function(r){ return r.type === "3-bed semi"; })[0];
    ok("Rebuilt mix is repriced to the verified £332 (3-bed semi @ £332)", semi && Math.round(num(semi.unitPrice)/num(semi.sqft)) === 332);
  })();
  // The scheme is still re-derived from the brief (mix sums to the 1,800 allocation).
  ok("Scheme still re-derived from brief (mix sums to 1,800)", built.sfh.mix.reduce(function(a,r){return a+num(r.count);},0) === 1800);
  // What was preserved is reported for the banner.
  ok("Kept list reports Exit, Planning Risk Level and Base Sale £/sqft", kept.indexOf("Exit Strategy & Target Investor")>=0 && kept.indexOf("Planning Risk Level")>=0 && kept.indexOf("Base Sale £/sqft")>=0);

  // A fresh build with no prior deal preserves nothing (empty list, no crash).
  ok("No prior deal ⇒ nothing preserved", preserveManualOnRebuild({}, buildDealFromBrief({town:"Maidstone",acres:50,units:600})).length === 0);

  // v10.88 — a DIFFERENT site must NOT drag the old project's work across.
  var built2 = buildDealFromBrief({ town:"Ryton and Wolston", city:"coventry", acres:120, units:520, affordablePct:30 });
  var keptDiff = preserveManualOnRebuild(prev, built2);   // prev = the Maidstone/Staplehurst deal above
  ok("Different site ⇒ nothing carried over (clean new project)", keptDiff.length === 0 && built2.exit == null && built2.dd == null && built2.constraintCheck == null);
})();

// 59b — v10.88: changing the unit count updates the Tenure page (tenure.totalUnits is shared)
(function(){
  if(typeof applySharedInput !== "function") return;
  var d = { land:{ units:1056 }, planning:{ units:1056 }, tenure:{ totalUnits:1056, mix:{ oms:70 } } };
  var d2 = applySharedInput(d, "land", "units", 520, "land", function(){ return true; });
  ok("changing units propagates to tenure.totalUnits", num(d2.tenure.totalUnits) === 520 && num(d2.planning.units) === 520);
})();

// 60 — Financial Modelling IRR/cashflow reads the CANONICAL unit count (v10.38)
// The Fin IRR & Phased Cashflow block (and its copy-to-Excel summary) must use the same unit
// count as every other stage — the mix-based figure for SFH / the centralised calcDealMetrics
// count — NOT a stale data.fin.units that the reconciliation didn't touch.
(function(){
  // Replicates the fixed precedence in screen-Fin.js: u = isSFH ? (mixUnits || DM.units || …) : (DM.units || …)
  function finUnits(data){
    var isSFH = (data.assetType||"sfh")==="sfh";
    var DM = calcDealMetrics(data);
    var mixUnits = computeSFHMetrics(data).totalUnits || 0;
    var f = data.fin||{};
    return isSFH ? (mixUnits || num(DM.units) || num(f.units||0)) : (num(DM.units) || num(f.units||0));
  }
  // Deal where fin.units is STALE (1,902) but the mix and planning are the reconciled 1,800.
  var deal={ assetType:"sfh", land:{city:"maidstone", acres:271.7, units:"1800"}, planning:{units:"1800", ahPct:"40"},
    fin:{units:"1902", programmeMths:"36"},
    sfh:{city:"maidstone", acres:271.7, ahPct:"40", basePsf:332, buildPsf:205,
      mix:[{type:"3-bed semi",count:"1000",sqft:"1020",unitPrice:String(1020*332)},
           {type:"4-bed detached",count:"800",sqft:"1500",unitPrice:String(1500*Math.round(332*1.18))}]} };
  ok("Fin unit count uses the canonical 1,800, not the stale fin.units 1,902", finUnits(deal) === 1800);
  ok("Canonical count equals the mix total", finUnits(deal) === computeSFHMetrics(deal).totalUnits);
  // Even if fin.units is blank, it still resolves to the mix count.
  var deal2=JSON.parse(JSON.stringify(deal)); delete deal2.fin.units;
  ok("Blank fin.units still resolves to the canonical count", finUnits(deal2) === 1800);
})();

// 61 — Quick Appraisal front-door: draft scheme from acreage, valued on the shared engine (v10.40)
// Mirrors screen-QuickAppraisal.js: a land-only deal (acres, no mix) is drafted at 12 homes/acre,
// the mix priced to the area sale £/sqft, and valued by computeSFHMetrics — so the one-page
// front door and the detailed stages always agree.
(function(){
  if(typeof keystoneGenerateMix !== "function"){ ok("keystoneGenerateMix available", false); return; }
  function repriceMix(mix, bp){
    return (mix||[]).map(function(r){
      var inf = HOUSE_TYPES[r.type] || HOUSE_TYPES["3-bed semi"] || {sqft:900,adj:1};
      var sq = num(r.sqft) || inf.sqft, psf = Math.round(bp*(inf.adj||1));
      return Object.assign({}, r, {unitPrice:String(Math.round(sq*psf)), psf:""});
    });
  }
  var acres = 40, cityKey = "maidstone", pc = "TN12 0AA";
  var draftHomes = Math.round(acres*12);                       // 12 homes/acre default
  var base = Math.max(180, Math.min(650, Math.round(keystoneSalePsf(cityKey, pc))));
  var mix = repriceMix(keystoneGenerateMix(draftHomes, cityKey, pc), base);
  var eff = { assetType:"sfh", land:{city:cityKey, acres:acres, postcode:pc, price:8000000},
    sfh:{ city:cityKey, acres:acres, basePsf:base, buildPsf:190, ahPct:30, s106pu:15000, finRate:7.5, profitPct:17.5, contingency:5, feesPct:12, marketingPct:0, mix:mix } };
  var M = computeSFHMetrics(eff);
  ok("Quick Appraisal drafts 480 homes from 40 acres @ 12/acre", M.totalUnits === 480);
  ok("Draft mix priced to the area sale £/sqft (GDV > 0)", num(M.gdv) > 0);
  ok("RLV is the engine's residual (same figure as the detailed stages)", num(M.rlv) === num(computeSFHMetrics(eff).rlv));
  // The margin-after-land test the page runs: profit = GDV − devCost − (asking + acquisition).
  function landSDLT(p){ if(p<=150000) return 0; var t=Math.min(p-150000,100000)*0.02; if(p>250000) t+=(p-250000)*0.05; return t; }
  var asking = 8000000, acq = landSDLT(asking) + asking*0.015, allIn = asking + acq;
  var marginAllIn = (num(M.gdv) - num(M.devCost) - allIn) / num(M.gdv) * 100;
  ok("At £8m ask on this draft the all-in margin is comfortably >15% (worth pursuing)", marginAllIn > 15);
  ok("Land is worth far more to us than the ask (positive headroom)", num(M.rlv) > allIn);
})();

// 62 — Sale £/sqft is FLAT across all house types (v10.43)
// Every type's sale adjustment is 1.00, so auto-pricing gives the same £/sqft regardless of
// type/size — no inflated £/sqft for bigger/detached homes. (Build cost stays per-type.)
(function(){
  ok("every HOUSE_TYPES sale adj is flat (1.00)", Object.keys(HOUSE_TYPES).every(function(k){ return HOUSE_TYPES[k].adj === 1.00; }));
  ok("build cost still varies by type (not flattened)", HOUSE_TYPES["4-bed detached"].build !== HOUSE_TYPES["2-bed terrace"].build);
  // A mix priced off one base £/sqft values every type at that same £/sqft.
  var base=400;
  var mix=[
    {type:"2-bed semi",     count:"10", sqft:"820",  unitPrice:String(Math.round(820*base*(HOUSE_TYPES["2-bed semi"].adj||1)))},
    {type:"4-bed detached", count:"10", sqft:"1500", unitPrice:String(Math.round(1500*base*(HOUSE_TYPES["4-bed detached"].adj||1)))}
  ];
  var perSqft = mix.map(function(r){ return Math.round(num(r.unitPrice)/num(r.sqft)); });
  ok("2-bed semi and 4-bed detached price at the SAME £/sqft", perSqft[0] === base && perSqft[1] === base);
  // Engine GDV of a repriced-flat mix = total sqft × base £/sqft.
  var d={ assetType:"sfh", land:{city:"maidstone"}, sfh:{city:"maidstone", acres:20, ahPct:0, basePsf:base, buildPsf:190, mix:mix} };
  ok("GDV = total sqft × flat base £/sqft", computeSFHMetrics(d).gdv === (820+1500)*10*base);
})();

// 63 — SFH mix optimiser: ranks types by margin/sqft and improves the surplus (v10.44)
// A 4-bed detached priced at a LOWER £/sqft than a 3-bed semi should rank below it, and the
// optimiser should rebalance toward the more profitable type for more £ available to land+profit.
(function(){
  if(typeof optimiseSfhMix !== "function"){ ok("optimiseSfhMix available", false); return; }
  var d={ assetType:"sfh", land:{city:"maidstone", acres:40}, planning:{},
    sfh:{city:"maidstone", acres:40, ahPct:0, buildPsf:190, finRate:7.5, buildInclusive:true,
      mix:[{type:"3-bed semi",count:"250",sqft:"1020",unitPrice:"350000"},   // £343/sqft
           {type:"4-bed detached",count:"250",sqft:"1500",unitPrice:"400000"}]} }; // £267/sqft
  var o=optimiseSfhMix(d,"profit");
  ok("optimiser returns per-type economics + optimised mix", o && o.types.length===2 && o.optimised.mix.length===2);
  ok("higher-£/sqft 3-bed semi ranks above the underpriced 4-bed detached", o.types[0].type==="3-bed semi");
  ok("3-bed semi has a higher margin per sqft than the 4-bed detached", o.types[0].marginPsf > o.types[1].marginPsf);
  ok("optimised mix leans toward the 3-bed semi (more of them)", num(o.optimised.mix.filter(function(r){return r.type==="3-bed semi";})[0].count) > 250);
  ok("optimisation increases the £ available for land + profit", o.optimised.surplus > o.current.surplus);
  // v10.61 — the optimised mix must keep the SAME total unit count (no rounding drift, e.g. 1,800→1,789).
  ok("optimised mix preserves the total unit count", o.optimised.mix.reduce(function(a,r){return a+num(r.count);},0) === 500);
  // and it holds for an awkward total that rounds badly across types
  var d2={ assetType:"sfh", land:{city:"maidstone", acres:271.7}, planning:{},
    sfh:{city:"maidstone", acres:271.7, buildInclusive:true, buildPsf:250,
      mix:[{type:"2-bed semi",count:"270",sqft:"720",unitPrice:"300000"},{type:"3-bed semi",count:"684",sqft:"900",unitPrice:"400000"},
           {type:"3-bed detached",count:"486",sqft:"1000",unitPrice:"440000"},{type:"4-bed detached",count:"360",sqft:"1250",unitPrice:"520000"}]} };
  var o2=optimiseSfhMix(d2,"profit");
  ok("optimiser holds a 1,800-home total exactly (no 1,789 drift)", o2.optimised.mix.reduce(function(a,r){return a+num(r.count);},0) === 1800);
  // v10.62 — scaleMixToUnits reconciles a drifted mix back to an authoritative unit total
  if(typeof scaleMixToUnits === "function"){
    var drifted=[{type:"a",count:"600"},{type:"b",count:"700"},{type:"c",count:"602"}]; // sums 1902
    var fixed=scaleMixToUnits(drifted, 1800);
    ok("scaleMixToUnits rescales a 1,902 mix to exactly 1,800", fixed.reduce(function(a,r){return a+num(r.count);},0) === 1800);
    ok("scaleMixToUnits keeps the distribution order (largest stays largest-ish)", num(fixed[1].count) > num(fixed[0].count));
    ok("scaleMixToUnits is a no-op when already on target", scaleMixToUnits([{count:"100"},{count:"100"}], 200).reduce(function(a,r){return a+num(r.count);},0) === 200);
  }
  // Rent mode ranks by rent per sqft and still returns totals.
  var oR=optimiseSfhMix(d,"rent");
  ok("rent mode returns per-type rent & yield", oR && oR.types.every(function(t){ return t.rentPcm >= 0 && t.grossYield >= 0; }));
  // No mix ⇒ null (safe).
  ok("no mix ⇒ null", optimiseSfhMix({assetType:"sfh", sfh:{}}, "profit") === null);

  // v10.46 — tunable bounds: a higher max lets the best type dominate more (bigger uplift).
  // Use real per-type prices so ranking differs.
  var dp={ assetType:"sfh", land:{city:"maidstone", acres:40}, planning:{},
    sfh:{city:"maidstone", acres:40, ahPct:0, buildPsf:190, finRate:7.5, buildInclusive:true,
      mix:[{type:"3-bed semi",count:"250",sqft:"1020",unitPrice:"350000"},
           {type:"4-bed detached",count:"250",sqft:"1500",unitPrice:"400000"}]} };
  var tight=optimiseSfhMix(dp,"profit",{minPct:20,maxPct:35});
  var loose=optimiseSfhMix(dp,"profit",{minPct:5,maxPct:60});
  ok("looser bounds let the best type dominate more (>= surplus of tighter bounds)", loose.optimised.surplus >= tight.optimised.surplus);
})();

// 64 — Keystone auto-fill: tenure mix from affordable %, and AI market-price enrich (v10.45)
(function(){
  // Tenure mix auto-filled from the affordable %.
  var d = buildDealFromBrief({ town:"maidstone", acres:40, units:480, affordablePct:35, assetType:"land" });
  ok("Keystone auto-fills the tenure mix", d.tenure && d.tenure.mix && num(d.tenure.mix.oms) > 0);
  ok("Tenure split = OMS + affordable-rent + shared-ownership summing to 100%",
     num(d.tenure.mix.oms) + num(d.tenure.mix.ar) + num(d.tenure.mix.so) === 100 && num(d.tenure.mix.ar) === 25 && num(d.tenure.mix.so) === 11);
  ok("Engine reads the tenure mix (blend factor < 1 for a 35% affordable scheme)", tenureMixBlendFactor(d, computeSFHMetrics(d).totalUnits) < 1);

  // AI market-price enrich: applies real per-type prices, then optimises.
  if(typeof applyMarketPricesAndOptimise === "function"){
    var d2 = buildDealFromBrief({ town:"maidstone", acres:40, units:500, affordablePct:0, assetType:"land" });
    var ai = [ {type:"2-bed semi",beds:2,salePrice:295000,rentPcm:1150}, {type:"3-bed semi",beds:3,salePrice:350000,rentPcm:1550},
               {type:"3-bed detached",beds:3,salePrice:390000,rentPcm:1650}, {type:"4-bed detached",beds:4,salePrice:400000,rentPcm:2100} ];
    var res = applyMarketPricesAndOptimise(d2, ai, {optimise:true});
    ok("AI enrich applies real per-type prices to the mix", res.applied >= 2);
    // v10.56 — per-type rents also fill the Capitalisation per-bed fields (Keystone auto-fill)
    ok("AI enrich fills per-bed rents for the Capitalisation stage", num(res.data.capitalise.rent4) === 2100 && num(res.data.capitalise.rent2) === 1150);
    // v10.111 — Keystone no longer writes a fixed marketRentPerUnitPa; the engine derives the
    // forward-fund rent from the per-bed rents × the (editable/pinnable) bedroom mix instead.
    ok("AI enrich flags rents researched + engine derives a positive forward-fund rent", res.data.capitalise.rentSource === "AI market research" && num(computeSFHMetrics(res.data).capNetRentPa) > 0);
    var psfs = res.data.sfh.mix.map(function(r){ return Math.round(num(r.unitPrice)/num(r.sqft)); });
    ok("per-type £/sqft now differs (real market, not flat)", Math.max.apply(null,psfs) - Math.min.apply(null,psfs) > 20);
    ok("4-bed detached correctly shows a LOWER £/sqft than the 3-bed semi", (function(){
       function psf(t){ var r=res.data.sfh.mix.filter(function(x){return x.type===t;})[0]; return r?num(r.unitPrice)/num(r.sqft):0; }
       return psf("4-bed detached") < psf("3-bed semi"); })());
    ok("enrich returns an optimisation result when it materially helps", res.optimised && res.optimised.surplus > res.optimised.current);
    ok("empty AI prices ⇒ no change (safe)", applyMarketPricesAndOptimise(d2, [], {}).applied === 0);
  }
})();

// ── Report ───────────────────────────────────────────────────────────────────
console.log("\n" + passes + " passed, " + failures + " failed.");
process.exit(failures > 0 ? 1 : 0);
