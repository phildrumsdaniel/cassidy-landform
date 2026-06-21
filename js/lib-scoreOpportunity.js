// ── lib-scoreOpportunity.js — SCOUT opportunity scoring (v9.75) ──────────────
// A transparent, weighted 0–100% score for a land opportunity, with a separate
// CONFIDENCE score from data completeness. The Scout agent (external) finds and
// enriches sites; THIS scores them — defined weights, auditable, no black box.
// The viability pillar runs the real Landform engine on an indicative scheme.
//
// Loaded after lib-dealSchema.js (uses num/MKT/keystoneBriefFromPlaconaSite/
// buildDealFromBrief/calcDealMetrics). Pure functions; also run by the tests.
// ─────────────────────────────────────────────────────────────────────────────

// Default pillar weights (editable). Sum need not be 100 — it's normalised.
var OPP_WEIGHTS = { viability:35, market:20, demographics:20, planning:15, constraints:10 };

function _oppClamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
// Map a value in [lo,hi] to a 0–100 score.
function _oppScale(v, lo, hi){ if(hi <= lo) return 50; return Math.round(_oppClamp((v - lo) / (hi - lo) * 100, 0, 100)); }

// scoreOpportunity(site, opts) → { score, confidence, band, pillars:[{key,label,weight,score,note}] }
function scoreOpportunity(site, opts){
  site = site || {}; opts = opts || {};
  var weights = opts.weights || OPP_WEIGHTS;

  var brief = (typeof keystoneBriefFromPlaconaSite === "function") ? keystoneBriefFromPlaconaSite(site) : site;
  var acres = num(brief.acres || site.acres);
  var ask   = num(brief.askingPrice || site.askingPrice);
  var units = num(brief.units) || (acres > 0 ? Math.round(acres * 12) : 0); // ~12 homes/acre net default

  // ── Viability pillar — indicative RLV vs asking, via the real engine ──
  var viability = 50, viabilityNote = "Not enough to appraise";
  if(typeof buildDealFromBrief === "function" && typeof calcDealMetrics === "function" && acres > 0 && units > 0){
    try{
      var deal = buildDealFromBrief(Object.assign({}, brief, { units: units, assetType: "land" }));
      deal.rlv = Object.assign({}, deal.rlv, { units: units });
      deal.planning = Object.assign({}, deal.planning, { units: units });
      deal.land = Object.assign({}, deal.land, { units: units });
      var dm = calcDealMetrics(deal);
      var rlv = num(dm.rlv);
      if(ask > 0){
        var headroom = (rlv - ask) / ask * 100;          // +ve = land worth more than the ask
        viability = _oppScale(headroom, -60, 60);
        viabilityNote = "Indicative RLV £" + (Math.round(rlv / 1e5) / 10) + "m vs ask £" + (Math.round(ask / 1e5) / 10) + "m (~" + units + " homes)";
      } else if(rlv > 0){
        viability = 60; viabilityNote = "Indicative RLV £" + (Math.round(rlv / 1e5) / 10) + "m; no asking price to compare";
      }
    }catch(e){ viability = 50; viabilityNote = "Could not appraise"; }
  }

  // ── Market pillar — area rent + yield from the benchmarks ──
  var market = 50, marketNote = "No area benchmark", mk = null;
  var cityKey = (brief.town || "").toLowerCase().replace(/\s+/g, "_");
  if(typeof MKT !== "undefined") mk = MKT[cityKey];
  if(mk){
    var rentScore = _oppScale(num(mk.btr), 650, 2000);
    var yieldScore = _oppScale(0.050 - num(mk.yield), 0, 0.008);   // lower yield → stronger
    market = Math.round(rentScore * 0.6 + yieldScore * 0.4);
    marketNote = "£" + mk.btr + "/mo · " + (num(mk.yield) * 100).toFixed(1) + "% yield";
  }

  // ── Demographics & demand pillar — from agent-provided fields ──
  var dmg = site.demographics || site;
  var demogParts = [];
  function dscore(v, lo, hi){ if(v == null || v === "") return null; return _oppScale(num(v), lo, hi); }
  var popG   = dscore(dmg.populationGrowthPct, -0.5, 2.0);   // % pa
  var afford = (dmg.affordabilityRatio != null && dmg.affordabilityRatio !== "") ? _oppScale(num(dmg.affordabilityRatio), 4, 14) : null; // higher ratio → more rental/affordable demand
  var jobs   = dscore(dmg.jobsGrowthPct, -1, 3);
  var need   = dscore(dmg.housingNeedIndex, 0, 100);
  [popG, afford, jobs, need].forEach(function(s){ if(s != null) demogParts.push(s); });
  var demographics = demogParts.length ? Math.round(demogParts.reduce(function(a, b){ return a + b; }, 0) / demogParts.length) : 50;
  var demogNote = demogParts.length ? (demogParts.length + " demographic signal(s)") : "No demographic data — Scout to supply";

  // ── Planning pillar — from status ──
  var ps = (brief.planningStatus || site.planning_status || "").toLowerCase();
  var planning = 30, planningNote = "No planning / hope value";
  if(/full|granted|consent|approved|detailed/.test(ps)){ planning = 95; planningNote = "Consented"; }
  else if(/outline/.test(ps)){ planning = 80; planningNote = "Outline"; }
  else if(/allocat|local plan|emerging|draft/.test(ps)){ planning = 55; planningNote = "Allocated / emerging"; }
  else if(/refus|reject|dismiss|stalled/.test(ps)){ planning = 28; planningNote = "Refused / stalled"; }

  // ── Constraints & deliverability pillar — from a verdict or flags ──
  var constraints = 60, constraintNote = "Not assessed";
  var verdict = (site.constraintVerdict || site.constraint_verdict || "").toString().toUpperCase();
  if(verdict === "GO"){ constraints = 85; constraintNote = "GO"; }
  else if(verdict === "CAUTION"){ constraints = 50; constraintNote = "Caution"; }
  else if(verdict === "AVOID"){ constraints = 15; constraintNote = "Avoid"; }
  else {
    var flags = (site.constraints || site.constraint_flags || "").toString().toLowerCase();
    if(flags){ var bad = /flood|green ?belt|contaminat|aonb|conservation|sssi|protected|ransom/.test(flags); constraints = bad ? 35 : 70; constraintNote = bad ? "Constraints present" : "Few constraints"; }
  }

  var pillars = [
    { key:"viability",    label:"Viability",                    weight:num(weights.viability),    score:viability,    note:viabilityNote },
    { key:"market",       label:"Market strength",              weight:num(weights.market),       score:market,       note:marketNote },
    { key:"demographics", label:"Demographics & demand",        weight:num(weights.demographics), score:demographics, note:demogNote },
    { key:"planning",     label:"Planning probability",         weight:num(weights.planning),     score:planning,     note:planningNote },
    { key:"constraints",  label:"Constraints & deliverability", weight:num(weights.constraints),  score:constraints,  note:constraintNote }
  ];
  var totalW = pillars.reduce(function(a, p){ return a + p.weight; }, 0) || 1;
  var composite = Math.round(pillars.reduce(function(a, p){ return a + p.score * p.weight; }, 0) / totalW);

  // Confidence — how much real data we had to score on (vs defaults/assumptions).
  // Numbers only count when > 0; strings when non-empty.
  var keyFields = [
    num(brief.acres) > 0,
    num(brief.askingPrice) > 0,
    units > 0,
    !!brief.town,
    !!(brief.planningStatus && String(brief.planningStatus).toLowerCase() !== "not found"),
    demogParts.length > 0,
    !!mk,
    !!(verdict || site.constraints || site.constraint_flags)
  ];
  var filled = keyFields.filter(Boolean).length;
  var confidence = Math.round(filled / keyFields.length * 100);

  var band = composite >= 75 ? "Strong" : composite >= 60 ? "Worth a look" : composite >= 45 ? "Marginal" : "Weak";
  return { score: composite, confidence: confidence, band: band, pillars: pillars };
}

if(typeof module !== "undefined" && module.exports){
  module.exports = { scoreOpportunity: scoreOpportunity, OPP_WEIGHTS: OPP_WEIGHTS };
}
