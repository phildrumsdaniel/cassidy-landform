// ── lib-landReconciliation.js ───────────────────────────────────────────────
// F1 — Combined land value. A site can be valued two ways: as a for-sale (SFH)
// scheme and as a held rental (BTR) scheme, giving two very different residual
// land values for the SAME land. This module reconciles them into ONE headline
// number under an explicit, on-screen policy — so the figure that drives a land
// bid is never a silent guess.
//
// Both legs are computed through the canonical calcDealMetrics() engine (driven
// by an assetType override) so the panel can never disagree with the Dashboard
// or Executive Summary, which use the same engine.
//
// Reconciliation policies:
//   conservative — the lower of the two RLVs (the bid cap). SAFE DEFAULT, because
//                  overbidding on land is the one irreversible mistake.
//   blend        — a weighted average. Two weighting bases:
//                    "confidence": same units valued two ways → weight by a
//                                  user confidence % that the rental exit lands.
//                    "units":      genuine physical split → weight by the share
//                                  of units actually on the rental (retained PRS) route.
//   optimistic   — the higher of the two RLVs.
//
// Settings live under data.recon (a non-stage section) so the policy/confidence
// controls keep working even when the Land stage is marked complete/locked.

function calcLandReconciliation(data){
  data = data || {};
  var l = data.land || {};
  var recon = data.recon || {};
  var cap = data.capitalise || {};
  var hra = data.hra || {};

  // Suppress any manual GDV override on each leg so it can't short-circuit the
  // scheme-aware GDV selection and collapse both legs onto the same number.
  function leg(assetType){
    var finNoManual = Object.assign({}, data.fin || {}, {manualGdv:0, gdv:0, gdvOverride:0});
    return calcDealMetrics(Object.assign({}, data, {assetType:assetType, fin:finNoManual}));
  }

  // A leg only counts if its route genuinely has inputs — otherwise calcDealMetrics
  // can fall back to a sale-based estimate and falsely make both legs look equal.
  var sfhMetrics = (typeof computeSFHMetrics === "function") ? computeSFHMetrics(data) : {gdv:0};
  var rlvD = data.rlv || {};
  var hasSaleInputs = num(sfhMetrics.gdv) > 0 || (num(rlvD.salePsf) > 0 && num(rlvD.units) > 0);
  var hasRentInputs = num(cap.netAnnualIncome) > 0 || num(hra.gdv) > 0;

  var saleRlv = hasSaleInputs ? num(leg("sfh").rlv) : null;
  var rentRlv = hasRentInputs ? num(leg("btr").rlv) : null;

  var dual = (saleRlv !== null) && (rentRlv !== null);

  var conservative = dual ? Math.min(saleRlv, rentRlv) : (saleRlv !== null ? saleRlv : rentRlv);
  var optimistic   = dual ? Math.max(saleRlv, rentRlv) : (saleRlv !== null ? saleRlv : rentRlv);

  // ── Weighted blend ─────────────────────────────────────────────────────────
  var basis = (recon.blendBasis === "units") ? "units" : "confidence";
  var rentWeight; // 0..1 weight applied to the rental RLV
  var unitShareAvailable = false;
  if(basis === "units"){
    var mix = (data.sfh && Array.isArray(data.sfh.mix)) ? data.sfh.mix : [];
    var totalUnits = 0, rentUnits = 0;
    mix.forEach(function(row){
      var c = num(row.count); if(!c) return;
      totalUnits += c;
      if(row.tenure === "retained_prs") rentUnits += c;
    });
    if(totalUnits > 0 && rentUnits > 0){ rentWeight = rentUnits / totalUnits; unitShareAvailable = true; }
  }
  if(rentWeight === undefined){
    // confidence basis (or units basis with no rental units found): use confidence %.
    var conf = recon.rentConfidencePct;
    rentWeight = (conf === undefined || conf === "" || isNaN(num(conf))) ? 0.5 : Math.max(0, Math.min(100, num(conf))) / 100;
  }
  var blend = dual ? (saleRlv * (1 - rentWeight) + rentRlv * rentWeight) : conservative;

  // ── Headline under the selected policy ───────────────────────────────────────
  var policy = recon.combinedPolicy || "conservative";
  var headline = policy === "optimistic" ? optimistic : (policy === "blend" ? blend : conservative);

  var acres = num(l.acres);
  var landAsk = num(l.scenarioLandValue) || num(l.price);

  return {
    saleRlv: saleRlv, rentRlv: rentRlv, dual: dual,
    hasSale: saleRlv !== null, hasRent: rentRlv !== null,
    conservative: conservative, optimistic: optimistic, blend: blend,
    basis: basis, rentWeight: rentWeight, unitShareAvailable: unitShareAvailable,
    policy: policy, headline: headline,
    acres: acres, perAcre: acres > 0 ? headline / acres : 0,
    landAsk: landAsk, vsAsk: landAsk > 0 ? headline - landAsk : null
  };
}

// Shared panel. Renders nothing if there is not enough to reconcile.
// Fully guarded: a reporting widget must never be able to blank the screen that
// hosts it, so any unexpected error falls back to rendering nothing.
//   data — deal data;  up — section setter (up("recon", key, val))
function LandReconciliationPanel(data, up){
  try {
    return _renderLandReconciliationPanel(data, up);
  } catch(err) {
    if(typeof console !== "undefined" && console.warn) console.warn("LandReconciliationPanel skipped:", err);
    return null;
  }
}
function _renderLandReconciliationPanel(data, up){
  var R = calcLandReconciliation(data);
  // Need at least one route with a value to say anything useful.
  if(R.saleRlv === null && R.rentRlv === null) return null;

  var POLICY_LABEL = {conservative:"Conservative floor", blend:"Weighted blend", optimistic:"Optimistic ceiling"};

  // Single-route case: just surface the one residual, clearly labelled.
  if(!R.dual){
    var only = R.saleRlv !== null ? {v:R.saleRlv, lab:"for-sale (SFH) residual"} : {v:R.rentRlv, lab:"rental (BTR) residual"};
    return e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",borderRadius:8,padding:"14px 18px",margin:"0 0 16px",color:"#fff"}},
      e("div",{style:{fontSize:9,letterSpacing:".1em",textTransform:"uppercase",opacity:.7,marginBottom:3}},"Residual land value — "+only.lab),
      e("div",{style:{fontSize:26,fontWeight:800,color:"#EDE84A"}},fmt(only.v)),
      e("div",{style:{fontSize:10,opacity:.75,marginTop:4}},"Add the other exit route (a rental yield or an SFH sale mix) to see the combined reconciliation.")
    );
  }

  function policyChip(key){
    var active = R.policy === key;
    var val = key === "conservative" ? R.conservative : key === "blend" ? R.blend : R.optimistic;
    return e("button",{key:key,onClick:function(){ up("recon","combinedPolicy",key); },
      style:{flex:"1 1 0",minWidth:120,textAlign:"left",cursor:"pointer",border:active?"2px solid #EDE84A":"1px solid rgba(255,255,255,.25)",
        background:active?"rgba(237,232,74,.14)":"rgba(255,255,255,.05)",borderRadius:7,padding:"8px 11px",color:"#fff",fontFamily:"inherit"}},
      e("div",{style:{fontSize:8.5,letterSpacing:".08em",textTransform:"uppercase",opacity:.7,marginBottom:2}},POLICY_LABEL[key]),
      e("div",{style:{fontSize:16,fontWeight:800,color:active?"#EDE84A":"#fff"}},fmt(val))
    );
  }

  var routeLine = function(lab, v){
    var acreTxt = R.acres > 0 ? "  ·  "+fmt(v / R.acres)+"/ac" : "";
    return e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,.08)"}},
      e("span",{style:{opacity:.8}},lab),
      e("strong",null,fmt(v)+acreTxt)
    );
  };

  // Blend controls
  var basisToggle = e("div",{style:{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",fontSize:10,marginTop:4}},
    e("span",{style:{opacity:.7}},"Blend basis:"),
    ["confidence","units"].map(function(b){
      var on = R.basis === b;
      return e("button",{key:b,onClick:function(){ up("recon","blendBasis",b); },
        style:{cursor:"pointer",border:"none",borderRadius:5,padding:"3px 9px",fontSize:10,fontWeight:700,fontFamily:"inherit",
          background:on?"#EDE84A":"rgba(255,255,255,.12)",color:on?"#1E1F5C":"#fff"}},
        b === "confidence" ? "Rental confidence %" : "Unit split");
    }),
    R.basis === "confidence" && e("span",{style:{display:"inline-flex",alignItems:"center",gap:5,marginLeft:4}},
      e("input",{type:"number",min:0,max:100,value:(data.recon&&data.recon.rentConfidencePct!==undefined?data.recon.rentConfidencePct:50),
        onChange:function(ev){ up("recon","rentConfidencePct",ev.target.value); },
        style:{width:54,padding:"3px 6px",borderRadius:5,border:"1px solid rgba(255,255,255,.3)",background:"rgba(255,255,255,.1)",color:"#fff",fontSize:11}}),
      e("span",{style:{opacity:.7}},"% on rental exit")
    ),
    R.basis === "units" && e("span",{style:{opacity:.7,marginLeft:4}},
      R.unitShareAvailable ? (Math.round(R.rentWeight*100)+"% of units on retained-PRS route") : "no retained-PRS units in mix — using 50/50")
  );

  return e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",borderRadius:8,padding:"15px 18px",margin:"0 0 16px",color:"#fff"}},
    e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:8}},
      e("div",null,
        e("div",{style:{fontSize:9,letterSpacing:".1em",textTransform:"uppercase",opacity:.7,marginBottom:3}},"Combined land value — sale vs rental reconciliation"),
        e("div",{style:{fontSize:28,fontWeight:800,color:"#EDE84A"}},fmt(R.headline)),
        e("div",{style:{fontSize:10,opacity:.8,marginTop:2}},
          "Headline policy: "+POLICY_LABEL[R.policy]+(R.perAcre>0?"  ·  "+fmt(R.perAcre)+"/acre":""))
      ),
      R.vsAsk !== null && e("div",{style:{textAlign:"right",fontSize:11}},
        e("div",{style:{opacity:.7}},"vs land ask "+fmt(R.landAsk)),
        e("strong",{style:{fontSize:14,color:R.vsAsk>=0?"#7FE0B0":"#FF9B7A"}},(R.vsAsk>=0?"+":"")+fmt(R.vsAsk))
      )
    ),
    e("div",{style:{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0 4px"}}, policyChip("conservative"), policyChip("blend"), policyChip("optimistic")),
    e("div",{style:{marginTop:8}},
      routeLine("For-sale (SFH) residual", R.saleRlv),
      routeLine("Rental (BTR) residual", R.rentRlv)
    ),
    basisToggle,
    e("div",{style:{fontSize:9,opacity:.6,marginTop:8,lineHeight:1.4}},
      "Conservative caps your bid at the lower exit; switch policy only when your strategy justifies it. Both legs use the same engine as the Dashboard.")
  );
}
