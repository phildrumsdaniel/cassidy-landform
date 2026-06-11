// ── isStageComplete ─────────────────────────────────────────────
// Lifted out of Tool unchanged (0 closure coupling — see landform-v2/README.md).
// Pure predicate: is a given stage complete for a deal?
function isStageComplete(stageId, deal){
  if(!deal) return false;
  switch(stageId){
    case "land":       return !!(deal.land && (num(deal.land.acres) || deal.land.postcode || deal.land.city));
    case "rlv":        return !!(deal.rlv && num(deal.rlv.units));
    case "sfh":        return !!(deal.sfh && deal.sfh.mix && deal.sfh.mix.some(function(r){return num(r.count)>0;}));
    case "hra":        return !!(deal.hra && num(deal.hra.units));
    case "planning":   return !!(deal.planning && num(deal.planning.units));
    case "fin":        return !!(deal.fin && (num(deal.fin.gdv) || num(deal.fin.totalCost)));
    case "capitalise": return !!(deal.capitalise && (num(deal.capitalise.targetYield) || num(deal.capitalise.multiRouteGdv)));
    case "tenure":     return !!(deal.tenure && deal.tenure.rows && deal.tenure.rows.length>0);
    case "exit":       return !!(deal.exit && (deal.exit.strategy || num(deal.exit.planningMo)));
    case "dd":         return !!(deal.dd && Object.keys(deal.dd).length>3);
    case "grants":     return !!(deal.grants && (num(deal.grants.ahpTotal) || num(deal.grants.helpToBuild) || num(deal.grants.brownfield)));
    case "navigator":  return !!(deal.assetType);
    case "dashboard":  return true;  // dashboard is a view, not a fillable stage
    default:           return false;
  }
}
