// ── isStageComplete ─────────────────────────────────────────────
// Pure predicate: is a given stage complete for a deal? A stage counts as complete
// when it actually HAS the data it needs (so the dashboard auto-clears it without a
// manual "Next"), OR when it has been explicitly marked complete (_completedStages).
// v9.50 — checks now read where the data really lives and use the unified engines,
// so DD / Tenure / Financial Modelling etc. clear themselves once filled.
function isStageComplete(stageId, deal){
  if(!deal) return false;
  if(deal._completedStages && deal._completedStages[stageId]) return true;  // manually finalised
  var has = function(fn){ try{ return !!fn(); }catch(e){ return false; } };
  switch(stageId){
    case "land":       return !!(deal.land && (num(deal.land.acres) || deal.land.postcode || deal.land.city));
    case "rlv":        return has(function(){ return num(deal.rlv&&deal.rlv.units) || num(deal.land&&deal.land.units) || num(deal.planning&&deal.planning.units) || (typeof computeSFHMetrics==="function" && computeSFHMetrics(deal).totalUnits>0); });
    case "sfh":        return has(function(){ return (deal.sfh && deal.sfh.mix && deal.sfh.mix.some(function(r){return num(r.count)>0;})) || (typeof computeSFHMetrics==="function" && computeSFHMetrics(deal).totalUnits>0); });
    case "hra":        return has(function(){ return num(deal.hra&&deal.hra.units) || (typeof computeHRAMetrics==="function" && computeHRAMetrics(deal).units>0); });
    // v9.97 — Planning is "complete" only once a planning STATUS has been chosen (units
    // alone came from the scheme sizing, so it used to show green with Status/Risk/BNG all
    // still unset). A blank status leaves the stage on the "to fill" list where it belongs.
    case "planning":   return !!(deal.planning && deal.planning.status && (num(deal.planning.units) || deal.planning.lpa));
    // Financial Modelling: complete once the scheme can actually be appraised
    // (a GDV and a development cost both compute through the unified engine).
    case "fin":        return has(function(){ if(typeof calcDealMetrics!=="function") return num(deal.fin&&(deal.fin.gdv||deal.fin.totalCost)); var m=calcDealMetrics(deal); return m.gdv>0 && m.devCost>0; });
    case "capitalise": return !!(deal.capitalise && (num(deal.capitalise.targetYield) || num(deal.capitalise.multiRouteGdv) || num(deal.capitalise.netAnnualIncome)));
    // Tenure Mix: complete when a split has actually been entered (reads the same
    // data the tenure engine uses, not a 'rows' array that is only computed).
    case "tenure":     return has(function(){ return (typeof computeTenureMetrics==="function" && computeTenureMetrics(deal).totalUnits>0) || (deal.tenure && deal.tenure.mix && Object.keys(deal.tenure.mix).some(function(k){return num(deal.tenure.mix[k])>0;})); });
    case "exit":       return !!(deal.exit && (deal.exit.strategy || num(deal.exit.planningMo) || deal.exit.investorType));
    // Due Diligence: items live in ddChecked (legacy: dd). Complete once a
    // reasonable number have been ticked.
    case "dd":         { var dd = deal.ddChecked || deal.dd || {}; return Object.keys(dd).filter(function(k){return dd[k];}).length >= 3; }
    case "grants":     return !!(deal.grants && (num(deal.grants.ahpTotal) || num(deal.grants.helpToBuild) || num(deal.grants.brownfield) || deal.grants.none));
    case "navigator":  return !!(deal.assetType);
    case "dashboard":  return true;  // a view, not a fillable stage
    default:           return false;
  }
}
