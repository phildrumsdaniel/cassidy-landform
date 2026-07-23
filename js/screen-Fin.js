// v10.153 — RETAIL vs BULK sales split for realistic phasing/IRR. Individual-buyer homes (open
// market, First Homes, discounted market sale) absorb one-at-a-time at the sales rate; affordable /
// HA-RP / institutional homes (Social & Affordable Rent, Shared Ownership, pension/BTR bulk, PRS)
// transfer in a few forward-fund / bulk transactions AS THEY'RE BUILT, so they don't sit in a long
// retail sales tail. Uses the engine's tenure precedence: House Mix per-row tenure > Tenure Mix
// split > scheme ah%. GDV is split by realisable value (bulk affordable realises ~0.6× market).
var FIN_BULK_HM_KEYS = {pension:1, ahp_social:1, ahp_so:1, ahp_affordable:1, retained_prs:1, btr_operator:1, rent_to_buy:1};
function finBulkRetailSplit(data, totalUnits, gdv){
  totalUnits = (typeof num==="function"?num(totalUnits):+totalUnits)||0;
  gdv = (typeof num==="function"?num(gdv):+gdv)||0;
  var bulkFrac = 0;
  var mix = (data && data.sfh && data.sfh.mix) || [];
  var hmTotal=0, hmBulk=0, hmAny=false;
  mix.forEach(function(r){ var c=num(r.count); if(c<=0) return; hmTotal+=c; var t=r.tenure||"private"; if(t!=="private"){ hmAny=true; if(FIN_BULK_HM_KEYS[t]) hmBulk+=c; } });
  if(hmAny && hmTotal>0){ bulkFrac = hmBulk/hmTotal; }
  else if(data && data.tenure && data.tenure.mix && typeof TENURE_TYPES!=="undefined"){
    var tm=data.tenure.mix, tot=0, bulk=0;
    TENURE_TYPES.forEach(function(td){ var v=num(tm[td.key]); if(!v) return; tot+=v; if(td.buyerType==="ha_rp"||td.buyerType==="institutional"||td.buyerType==="council") bulk+=v; });
    if(tot>0) bulkFrac = bulk/tot;
  } else {
    var ah = num((data && data.planning && (data.planning.ahPct||data.planning.afhPct))||0);
    bulkFrac = ah>0 ? ah/100 : 0;
  }
  bulkFrac = Math.max(0, Math.min(1, bulkFrac));
  var bulkUnits = Math.round(totalUnits*bulkFrac);
  var retailUnits = Math.max(0, totalUnits - bulkUnits);
  var BULK_VALUE_FACTOR = 0.6;   // affordable/bulk realises ~60% of open-market value
  var wB = bulkUnits*BULK_VALUE_FACTOR, wR = retailUnits*1.0;
  var bulkGdv = (wB+wR)>0 ? gdv*wB/(wB+wR) : 0;
  return {bulkFrac:bulkFrac, bulkUnits:bulkUnits, retailUnits:retailUnits, bulkGdv:bulkGdv, retailGdv:gdv-bulkGdv};
}

// v10.153 — one phased-cashflow model used by BOTH the returns summary and the S-curve card, so
// they show the SAME IRR (they used to disagree — a crude single-period "all GDV at year N" upstairs
// vs an S-curve downstairs). LAND is the t0 outflow (the actual land price, or the RLV if none is
// entered yet — an IRR without the land investment is meaningless); dev costs lead on the build
// curve; bulk transfers as built; retail absorbs on its own tail. IRR is a true monthly-cashflow
// IRR (bisection), annualised — so earlier bulk receipts genuinely lift it.
function finPhasedCashflow(data, units, gdv, devCostExLand, landOut, buildMonths, salesRateWeek, finMonthly){
  units=num(units); gdv=num(gdv); devCostExLand=Math.max(0,num(devCostExLand)); landOut=Math.max(0,num(landOut));
  buildMonths=Math.max(1,num(buildMonths)); finMonthly=num(finMonthly);
  var br=finBulkRetailSplit(data, units, gdv);
  var salesRate=num(salesRateWeek) || (units>0&&buildMonths>0?Math.round((units/(buildMonths*52/12))*100)/100:0.75);
  var absorption=(br.retailUnits>0&&salesRate>0)?Math.max(1,Math.ceil(br.retailUnits/(salesRate*52/12))):buildMonths;
  var retailMonths=Math.max(buildMonths, absorption);   // retail can't sell out before it's built
  var prog=retailMonths;
  function scv(t){ if(t<=0)return 0; if(t>=1)return 1; return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2; }
  var cs=[], cumSales=0, cumCost=0, peakDebt=0, totalInt=0, runDebt=0, milestones=[];
  for(var m=1;m<=prog;m++){
    var costD=(scv(Math.min(1,(m/buildMonths)*1.2))-scv(Math.min(1,((m-1)/buildMonths)*1.2)))*devCostExLand;
    if(m===1) costD+=landOut;                                        // land paid up front (t0)
    var bulkD=(scv(m/buildMonths)-scv((m-1)/buildMonths))*br.bulkGdv;  // bulk transfers as built
    var retailD=(scv(m/retailMonths)-scv((m-1)/retailMonths))*br.retailGdv;
    var sales=bulkD+retailD;
    cumSales+=sales; cumCost+=costD; cs.push(sales-costD);
    runDebt=Math.max(0,cumCost-cumSales);
    var intr=runDebt*finMonthly; totalInt+=intr; runDebt+=intr;
    peakDebt=Math.max(peakDebt,runDebt);
    if(m===1||m===Math.floor(prog/4)||m===Math.floor(prog/2)||m===Math.floor(prog*3/4)||m===prog)
      milestones.push({m:m,sales:Math.round(cumSales),cost:Math.round(cumCost),debt:Math.round(runDebt),profit:Math.round(cumSales-cumCost-totalInt)});
  }
  var irr=(function(){
    if(!(cs.length>1))return null;
    function npv(r){var v=0;for(var i=0;i<cs.length;i++)v+=cs[i]/Math.pow(1+r,i+1);return v;}
    var lo=-0.5,hi=0.5,nl=npv(lo),nh=npv(hi);
    if(!(isFinite(nl)&&isFinite(nh))||nl*nh>0)return null;   // no sign change → IRR undefined (e.g. a loss)
    for(var it=0;it<90;it++){var mid=(lo+hi)/2,nm=npv(mid);if(!isFinite(nm))return null;if(nl*nm<=0){hi=mid;}else{lo=mid;nl=nm;}}
    var a=(Math.pow(1+(lo+hi)/2,12)-1)*100;
    return (a>-99&&a<500)?Math.round(a*10)/10:null;
  })();
  return {br:br, salesRate:salesRate, absorption:absorption, retailMonths:retailMonths, prog:prog, peakDebt:peakDebt,
          totalInt:totalInt, irr:irr, finalProfit:gdv-devCostExLand-landOut-totalInt, milestones:milestones,
          cumSales:cumSales, cumCost:cumCost, landOut:landOut};
}

// ── renderFin  (params: LiveMarketBanner, at, bc, buildPsf, city, data, ey, gia, gr, lc, m, navTo, units, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderFin(LiveMarketBanner, at, bc, buildPsf, city, data, ey, gia, gr, lc, m, navTo, units, up, user){
    var f=data.fin||{};
    var l=data.land||{};
    var sf=data.sfh||{};
    // Lightweight local inputs for finance UI. Final RLV/profit comes from calcDealMetrics below.
    var rlvAcres=num(l.acres||sf.acres||0);
    var rlvUnits=num(data.planning&&data.planning.units||f.units||0);
    var rlvBuild=num(f.buildPsf||m.build);
    var rlvSalePsf=num(f.salePsf||estSalePsfFromRent(m.btr)||280);
    // ── ASSET-TYPE AWARE GDV CALCULATION ──────────────────────────────────────
    // SFH: GDV = sum of house sales (not yield-based)
    // BTR/PBSA: GDV = NOI / exit yield
    var isSFH = at==="sfh";

    // Pull SFH figures from the central SFH calculator so finance matches SFH/RLV/Dashboard.
    var sfhFinMetrics = computeSFHMetrics(data);
    var sfhTotalGdv = sfhFinMetrics.gdv;
    var sfhTotalUnits = sfhFinMetrics.totalUnits || units;
    var sfhTotalBuildCost = sfhFinMetrics.buildCost || bc;
    // v10.123 — the programme default reflects the realistic build-out from the engine
    // (homes ÷ housebuilder rate, capped at 8 yrs) rather than a flat 36 months, so the
    // finance S-curve and IRR agree with the Land Valuation and one-pager timelines. A
    // figure the user types in still overrides this.
    var finProgDefault = (isSFH && num(sfhFinMetrics.financeProgYears)>0) ? Math.max(12, Math.round(num(sfhFinMetrics.financeProgYears)*12)) : 36;

    // Manual GDV override from Financial Modelling inputs
    var manualGdv = num(f.manualGdv||f.gdv||f.gdvOverride||0);
    var manualBuildCost = num(f.manualBuildCost||0);

    // BTR/PBSA yield-based GDV
    var voidAdj = at==="pbsa"?0.97:0.95;
    var opex = units*(at==="pbsa"?600:1050)+gr*voidAdj*0.12;
    var noi2 = gr*voidAdj-opex;
    var ey2 = ey||m.yield;
    var btrGdv = ey2>0&&gr>0?noi2/ey2:0;

    // ── CENTRALISED METRICS ─────────────────────────────────────────────
    var DM = calcDealMetrics(data);

    // Final GDV: prefer centralised value (which itself respects manual override > SFH > BTR yield)
    var gdv2 = DM.gdv > 0 ? DM.gdv : (manualGdv>0?manualGdv:(isSFH&&sfhTotalGdv>0?sfhTotalGdv:(btrGdv>0?btrGdv:0)));

    // Build cost: keep existing fallback logic but prefer centralised when available
    var effBuildCost = DM.buildCost > 0 ? DM.buildCost : (manualBuildCost>0?manualBuildCost:(isSFH&&sfhTotalBuildCost>0?sfhTotalBuildCost:bc));

    // Pre-resolve rates with numOr so user-entered zero is respected
    var finContPct = numOr(f.contingency, 5);
    var finRatePct = numOr(f.finRate, 7.5);
    var finS106Pu = numOr(f.s106pu, 8000);

    // Total Development Cost (still locally compute land-inclusive for legacy display)
    var s106fin = DM.s106 || (isSFH?sfhTotalUnits*finS106Pu:(data.planning&&data.planning.s106?num(data.planning.s106):units*finS106Pu));
    // v9.97 — Total Dev Cost from the ONE engine (build, fees, contingency, finance, S106,
    // roads, infra, disposal + any acquisition costs) + land, so the cost table and the
    // profit/margin below it reconcile. Legacy formula only as a fallback when the engine
    // can't appraise the scheme.
    var tc4 = (DM.gdv>0)
      ? (DM.totalCost + lc)
      : (effBuildCost + lc + s106fin + effBuildCost*0.12 + effBuildCost*(finContPct/100) + (effBuildCost+lc)*(finRatePct/100) + lc*0.05);

    var profit2 = DM.actualProfit !== 0 ? DM.actualProfit : (gdv2-tc4);
    var margin2 = DM.marginPct !== 0 ? DM.marginPct : (gdv2>0?(profit2/gdv2)*100:0);
    var roc = DM.roc !== 0 ? DM.roc : (tc4>0?(profit2/tc4)*100:0);
    var rlv = DM.rlv || (gdv2>0 ? gdv2 - tc4 - gdv2*(DM.profitPctTarget/100) : 0);
    var totalBuild = effBuildCost;
    // v9.65 — the appraisal line items must reconcile with Total Dev Cost (tc4). Derive the
    // displayed build sqft/£psf from the SAME canonical build cost, not the legacy gia/bc
    // params (which could read ~4× too high and made Build exceed the total).
    var finBuildPsf = num(DM.buildPsf) || num(buildPsf) || 0;
    var finSqft = finBuildPsf>0 ? Math.round(effBuildCost/finBuildPsf) : num(gia);
    var scV=margin2>=15?"#2D7A65":"#B05A35";

    // v10.123 — when the SFH build cost is all-inclusive the engine returns fees/contingency
    // folded into Build (DM.fees / DM.contingency come back 0), which read as £0 in the cost
    // table. Decompose for display exactly as the Land Valuation (RLV) screen does: split the
    // inclusive build into construction + fees + contingency so each line reads correctly. The
    // sum is unchanged, so Total Dev Cost still reconciles.
    var finFees = num(DM.fees), finCont = num(DM.contingency), finBuildOnly = effBuildCost, finBuildDecomp = false;
    if ((data.sfh && data.sfh.buildInclusive) && !(finFees>0) && !(finCont>0) && effBuildCost>0){
      var _finFp = numOr(data.sfh&&data.sfh.feesPct,12)/100, _finCp = numOr(data.sfh&&data.sfh.contingency,5)/100;
      var _finConstr = effBuildCost/(1+_finFp+_finCp);
      finBuildOnly = _finConstr; finFees = _finConstr*_finFp; finCont = _finConstr*_finCp; finBuildDecomp = true;
    }
    var finConstrPsf = (finBuildDecomp && finSqft>0) ? Math.round(finBuildOnly/finSqft) : finBuildPsf;
    var finFeesPctDisp = num(DM.buildCost)>0 ? Math.round(finFees/(finBuildDecomp?finBuildOnly:num(DM.buildCost))*100) : numOr(f.feesPct,12);
    var finContPctDisp = finBuildOnly>0 ? Math.round(finCont/finBuildOnly*100) : finContPct;

    // v9.97 — cost line items straight from the engine so they SUM to Total Dev Cost.
    var finRows = (DM.gdv>0)
      ? [["Land",lc],["Build ("+finSqft.toLocaleString()+" sqft @ £"+finConstrPsf+"/sqft"+(finBuildDecomp?", construction — fees & contingency below":"")+")",finBuildOnly],["Professional fees ("+finFeesPctDisp+"%)",finFees],["Contingency ("+finContPctDisp+"%)",finCont],["Finance",DM.finance],["S106/CIL",DM.s106]]
          .concat(DM.roads>0?[["Roads & Sewers",DM.roads]]:[])
          .concat(DM.infra>0?[["Site infra & SuDS",DM.infra]]:[])
          .concat(DM.marketing>0?[["Disposal & marketing",DM.marketing]]:[])
          .concat(DM.totalAcqCosts>0?[["Acquisition (SDLT/legal/agent/finance)",DM.totalAcqCosts]]:[])
      : [["Land",lc],["Build ("+finSqft.toLocaleString()+" sqft @ £"+finBuildPsf+"/sqft)",effBuildCost],["S106/CIL allowance (£"+fmtN(finS106Pu)+"/unit)",s106fin],["Contingency ("+finContPct+"%)",effBuildCost*(finContPct/100)],["Prof Fees ("+numOr(f.feesPct,12)+"%)",effBuildCost*(numOr(f.feesPct,12)/100)],["Finance ("+finRatePct+"%)",(effBuildCost+lc)*(finRatePct/100)],["SDLT (5%)",lc*0.05]];

    // v9.97 — scenarios scale the scheme's OWN valuation basis: a for-sale scheme scales
    // its GDV by the sales-price move; only a rental scheme capitalises NOI ÷ yield.
    var finSaleBased = (isSFH || btrGdv<=0);
    var scens=[{l:"Bear",sm:-0.10,bm:+0.15},{l:"Base",sm:0,bm:0},{l:"Bull",sm:+0.08,bm:-0.05}].map(function(sc3){
      var sGdv;
      if(finSaleBased){ sGdv=gdv2*(1+sc3.sm); }
      else { var sG=(gr*(1+sc3.sm))*voidAdj-opex; sGdv=ey2>0?sG/ey2:0; }
      var sCost=tc4*(1+sc3.bm); var sP=sGdv-sCost;
      return{l:sc3.l,gdv:sGdv,profit:sP,margin:sGdv>0?(sP/sGdv)*100:0};
    });

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Financial Modelling"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:20}},"Full development appraisal, returns analysis and scenario sensitivity"),
      e("div",{style:{padding:"10px 14px",background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.18)",borderRadius:6,marginBottom:14,fontSize:11,color:"#4A4BAE",lineHeight:1.6}},
        "ℹ ",e("strong",null,"Screening estimate. "),"Finance costs use simple % of build+fees. For institutional output (RICS-format, phased S-curve finance, full sensitivity), see ",
        e("strong",{style:{cursor:"pointer",textDecoration:"underline"},onClick:function(){navTo("viability");}},"Detailed Appraisal"),
        ". Figures here are aligned with Dashboard, Summary, RLV and Exit via central engine."
      ),
      LiveMarketBanner(),
      e("div",{style:S.card},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,paddingBottom:12,borderBottom:"1px solid #DDE0ED",marginBottom:14}},
          e("span",null,"Assumptions"),
          e("div",{style:{display:"flex",gap:8,alignItems:"center"}},
            e("span",{style:{fontSize:10,color:"#7278A0"}},"Mode:"),
            e("button",{onClick:function(){up("fin","advMode",f.advMode==="adv"?"simple":"adv");},style:{padding:"3px 10px",background:f.advMode==="adv"?"#4A4BAE":"#F0F0F8",border:"1px solid #DDE0ED",borderRadius:4,color:f.advMode==="adv"?"#fff":"#7278A0",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Advanced"),
            e("button",{onClick:function(){up("fin","advMode","simple");},style:{padding:"3px 10px",background:f.advMode!=="adv"?"#2D7A65":"#F0F0F8",border:"1px solid #DDE0ED",borderRadius:4,color:f.advMode!=="adv"?"#fff":"#7278A0",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Simple")
          )
        ),
          e("button",{
            onClick:function(){
              var lm2=m||MKT.manchester;
              var u2=rlvUnits||units||0;
              var updates={};
              if(!f.units&&u2>0)updates.units=String(u2);
              if(!f.buildPsf)updates.buildPsf=String(num(data.sfh&&data.sfh.buildPsf)||Math.round(lm2.build));
              if(!f.salePsf)updates.salePsf=String(num(data.rlv&&data.rlv.salePsf)||Math.round((MKT[city]&&estSalePsfFromRent(MKT[city].btr))||260));
              if(!f.exitYield)updates.exitYield=String(Math.round(lm2.yield*1000)/10);
              if(!f.finRate)updates.finRate="7.5";
              if(!f.contingency)updates.contingency="5";
              if(!f.s106pu)updates.s106pu="20000";
              Object.keys(updates).forEach(function(k){up("fin",k,updates[k]);});
              notify("Fields populated from your land and SFH appraisal data. Review each figure and adjust to match your actual deal.");
            },
            style:{padding:"6px 14px",background:"#2D7A65",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"⚡ Populate from My Deal Data")
        ),
        e("div",{style:S.grid2},
          e(Inp,{label:"Build Cost psf (£) — market: £"+m.build,type:"number",value:f.buildPsf,onChange:function(v){up("fin","buildPsf",v);},placeholder:m.build+""}),
          // Scheme-aware build cost sanity check (BCIS Q1 2026 benchmarks)
          // SFH (2-3 storey houses): ~£148/sqft floor · BTR/PBSA flats: ~£180/sqft · refurb can be lower
          f.buildPsf&&(function(){
            var bv = num(f.buildPsf);
            var schemeFloor = (at==="btr"||at==="pbsa") ? 165 : 130;  // £/sqft below which "unusually low"
            var schemeCeil  = (at==="btr"||at==="pbsa") ? 380 : 280;
            if(bv < schemeFloor){
              return e("div",{style:{gridColumn:"span 2",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.25)",borderRadius:5,padding:"6px 12px",fontSize:11,color:"#B05A35"}},
                "⚠ Build cost £"+bv+"/sqft is below "+(at==="btr"||at==="pbsa"?"typical flatted-scheme floor of £165/sqft":"typical SFH floor of £130/sqft")+". BCIS Q1 2026 benchmarks: SFH 2-3 storey £148/sqft, flats 4-5 storey £181/sqft. Check your figure — unless this is refurbishment or stripped-spec, this may be too low.");
            }
            if(bv > schemeCeil){
              return e("div",{style:{gridColumn:"span 2",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.25)",borderRadius:5,padding:"6px 12px",fontSize:11,color:"#B05A35"}},
                "⚠ Build cost £"+bv+"/sqft is unusually high (above £"+schemeCeil+"/sqft). High-spec / central-London / complex sites only. Check your figure.");
            }
            return null;
          })(),
          e(Inp,{label:(at==="pbsa"?"Weekly Rent/Bed":"Monthly Rent/Unit")+" (£) — market: £"+(at==="pbsa"?m.pbsa:m.btr),type:"number",value:f.rent,onChange:function(v){up("fin","rent",v);},placeholder:(at==="pbsa"?m.pbsa:m.btr)+""}),
          e(Inp,{label:"Exit Yield (%) — market: "+pct(m.yield*100),type:"number",value:f.exitYield,onChange:function(v){up("fin","exitYield",v);},placeholder:(m.yield*100).toFixed(2)}),
          e(Inp,{label:"Finance Rate (%) — typical 7.5-9.0% senior debt",type:"number",value:f.finRate,onChange:function(v){up("fin","finRate",v);},placeholder:"7.5"}),
          e(Inp,{label:"Contingency (%)",type:"number",value:f.contingency,onChange:function(v){up("fin","contingency",v);},placeholder:"5"}),
          e(Inp,{label:"Professional Fees (% of build)",type:"number",value:f.feesPct,onChange:function(v){up("fin","feesPct",v);},placeholder:"12"}),
        (function(){
          // v9.66 — region label + rates now follow the DEAL's area (was hard-coded to
          // "Worcestershire / South West"). Rates keep the BCIS base ratios, scaled by the
          // area's build index vs the national baseline so they're directionally right.
          var benchRegion = (typeof ukRegionFor==="function") ? ukRegionFor(data) : "UK (national average)";
          var bf = (num(m&&m.build)||188)/188;
          var b2 = Math.round(148*bf), b3 = Math.round(160*bf), bFlat = Math.round(181*bf);
          return e("div",{style:{background:"rgba(154,123,62,0.06)",border:"1px solid rgba(154,123,62,0.2)",borderRadius:7,padding:"10px 14px",fontSize:11,marginTop:8}},
            e("div",{style:{fontWeight:700,color:"#9A7B3E",marginBottom:6}},"BCIS build benchmarks — "+benchRegion),
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}},
              e("div",null,e("span",{style:{color:"#7278A0",fontSize:10}},"2-storey houses: "),e("span",{style:{fontWeight:700,fontSize:11}},"£"+b2+"/sqft")),
              e("div",null,e("span",{style:{color:"#7278A0",fontSize:10}},"3-storey: "),e("span",{style:{fontWeight:700,fontSize:11}},"£"+b3+"/sqft")),
              e("div",null,e("span",{style:{color:"#7278A0",fontSize:10}},"4-5 storey flats: "),e("span",{style:{fontWeight:700,fontSize:11}},"£"+bFlat+"/sqft")),
              e("div",null,e("span",{style:{color:"#7278A0",fontSize:10}},"Add externals/infra: "),e("span",{style:{fontWeight:700,fontSize:11}},"+15-25%"))
            )
          );
        })()
      ),
      units>0&&gia>0&&e("div",null,
        e("div",{style:S.card},
          e("div",{style:S.cardTitle},"Development Appraisal"),
          e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:12}},
            e("div",null,
              e("div",{style:{fontSize:9,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,marginBottom:10}},"COSTS"),
              finRows.map(function(row){
                return e("div",{key:row[0],style:{display:"flex",justifyContent:"space-between",fontSize:12,color:"#7278A0",padding:"4px 0",borderBottom:"1px solid #F0F0F0"}},
                  e("span",null,row[0]),e("span",null,fmt(row[1]))
                );
              }),
              // v10.152 — reconcile the two build-rate presentations (SFH audit finding). This page
              // shows the all-in rate SPLIT into construction + fees + contingency (e.g. £175 + 12% +
              // 5%), while the SFH House Mix and Dashboard show the single ALL-IN rate (£205) with
              // fees/contingency folded in. They are the SAME cost (£175 × 1.17 ≈ £205) and foot to the
              // same Total Dev Cost — shown here itemised so the appraisal reads like a standard residual.
              finBuildDecomp && e("div",{style:{fontSize:10,color:"#7278A0",fontStyle:"italic",padding:"5px 0 0",lineHeight:1.5}},
                "Build shown as construction (£"+finConstrPsf+"/sqft) + fees + contingency. The SFH House Mix & Dashboard show this as one ALL-IN rate (£"+Math.round(num(finConstrPsf)*(1+finFeesPctDisp/100+finContPctDisp/100))+"/sqft) — same cost, itemised here; both foot to the same Total Dev Cost."),
              e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#2E2F8A",padding:"8px 0",borderTop:"1px solid #DDE0ED",marginTop:4}},
                e("span",null,"Total Dev Cost"+(num(DM.grantIncome)>0?" (incl. land)":"")),e("span",null,fmt(tc4))
              ),
              // v10.126 — affordable grant (AHP) is income that offsets cost, so show it as a credit
              // and net it off so Profit = GDV − net cost foots. v10.144: use grantToProfit — the £
              // that actually reaches the developer's profit ('land' & 'margin' treatments; 0 under
              // 'rp', where the grant is passed to a Registered Provider and is not Cassidy's income).
              num(DM.grantToProfit)>0 && e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,color:"#1B7A54",padding:"4px 0"}},
                e("span",null,"less: Affordable grant (AHP)"+(DM.grantMode==="land"?" — offsets competitive land bid":"")),e("span",null,"−"+fmt(num(DM.grantToProfit)))
              ),
              num(DM.grantToProfit)>0 && e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:700,color:"#2E2F8A",padding:"6px 0 0",borderTop:"1px dashed #DDE0ED"}},
                e("span",null,"Net cost after grant"),e("span",null,fmt(tc4-num(DM.grantToProfit)))
              ),
              num(DM.grantIncome)>0 && !(num(DM.grantToProfit)>0) && e("div",{style:{fontSize:10.5,color:"#1B7A54",padding:"4px 0",lineHeight:1.5}},
                "Affordable grant (AHP) "+fmt(num(DM.grantIncome))+" is passed to a Registered Provider to fund the affordable homes — neutral to this appraisal."
              )
            ),
            e("div",null,
              e("div",{style:{fontSize:9,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,marginBottom:10}},"INCOME & GDV"),
              // v10.156 — for a HOUSES-FOR-SALE scheme, the GDV is house sales, not rent. The
              // Gross Rent / NOI / yield rows are BTR/PBSA template residue that confused readers on an
              // SFH deal (they don't drive this GDV). Show them only for rental schemes; for SFH, a
              // one-line note that rent/NOI/yield only size the alternative forward-fund exit.
              isSFH
                ? e("div",{style:{fontSize:11,color:"#7278A0",padding:"2px 0 8px",lineHeight:1.55,borderBottom:"1px solid #F0F0F0"}},
                    "Revenue is from ",e("b",null,"house sales")," (itemised on the SFH House Mix stage) — the GDV below. Rent, NOI and yield don't drive this scheme; they only size the alternative ",e("b",null,"forward-fund / rented exit")," (yield "+pct(ey2*100)+"), shown on Capitalisation & Exit Strategy.")
                : [["Gross Rent (pa)",gr],["Effective Rent ("+(at==="pbsa"?97:95)+"% occupancy)",gr*voidAdj],["OpEx (pa)",-opex],["NOI (pa)",noi2],["Exit Yield",null,pct(ey2*100)]].map(function(row){
                    return e("div",{key:row[0],style:{display:"flex",justifyContent:"space-between",fontSize:12,color:"#7278A0",padding:"4px 0",borderBottom:"1px solid #F0F0F0"}},
                      e("span",null,row[0]),e("span",null,row[2]||fmt(row[1]))
                    );
                  }),
              e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#2E2F8A",padding:"8px 0",borderTop:"1px solid #DDE0ED",marginTop:4}},
                e("span",null,"GDV"),e("span",null,fmt(gdv2))
              )
            )
          ),
          e("div",{style:{background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.15)",borderRadius:7,padding:"10px 14px",marginBottom:10,fontSize:11}},
            e("div",{style:{fontWeight:700,color:"#4A4BAE",marginBottom:6}},"What the model is calculating from:"),
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}},
              e("div",null,e("span",{style:{color:"#7278A0"}},"GDV source: "),
                e("span",{style:{fontWeight:700,color:gdv2>0?"#2D7A65":"#B05A35"}},
                  manualGdv>0?"Manual override ("+fmt(manualGdv)+")":
                  isSFH&&sfhTotalGdv>0?"SFH house sales ("+fmt(sfhTotalGdv)+")":
                  btrGdv>0?"BTR/PBSA yield ("+fmt(btrGdv)+")":
                  "No data — fill in SFH Appraisal or enter manual GDV below"
                )
              ),
              e("div",null,e("span",{style:{color:"#7278A0"}},"Build cost: "),
                e("span",{style:{fontWeight:700,color:"#2E2F8A"}},
                  manualBuildCost>0?"Manual ("+fmt(manualBuildCost)+")":
                  isSFH&&sfhTotalBuildCost>0?"SFH appraisal ("+fmt(sfhTotalBuildCost)+")":
                  "GIA x psf ("+fmt(effBuildCost)+")"
                )
              ),
              e("div",null,e("span",{style:{color:"#7278A0"}},"Land cost: "),e("span",{style:{fontWeight:600}},fmt(lc))),
              e("div",null,e("span",{style:{color:"#7278A0"}},"S106 total: "),e("span",{style:{fontWeight:600}},fmt(s106fin)))
            )
          ),
          // v10.136 — GUARD: with no land price entered, Profit/Margin here are BEFORE the cost of
          // buying the land (= GDV − dev cost = the residual land value + developer profit, e.g.
          // ~£300m at ~38%), NOT the scheme's return. Read alone this stage looks ~3× too
          // profitable and wrongly badges "✓ Viable". Flag it and caveat the verdict until a land
          // price is set (the true post-land margin is on the SFH House Mix / Dashboard).
          (!(lc>0) && rlv>0) && e("div",{style:{padding:"10px 14px",background:"rgba(176,90,53,0.09)",border:"1px solid rgba(176,90,53,0.4)",borderRadius:6,marginBottom:12,fontSize:12,color:"#B05A35",lineHeight:1.55}},
            e("b",null,"⚠ No land price entered. "),
            "The Profit and Margin below are ",e("b",null,"before the cost of buying the land"),": this is the pot to split between the land payment and developer profit (≈ the residual land value of ",e("b",null,fmt(rlv)),"), not the scheme's return after purchase. Enter a land price in the Assumptions above — or read the true post-land margin on the ",e("b",null,"SFH House Mix / Dashboard"),"."
          ),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}},
            [{l:(!(lc>0)&&rlv>0)?"Profit (before land)":"Profit",v:fmt(profit2),ok:margin2>=15 && (lc>0||!(rlv>0))},{l:(!(lc>0)&&rlv>0)?"Margin (before land)":"Margin on GDV",v:pct(margin2),ok:margin2>=15 && (lc>0||!(rlv>0))},{l:"Return on Cost",v:pct(roc),ok:roc>20 && (lc>0||!(rlv>0))},{l:"Price per "+(at==="pbsa"?"Bed":"Unit"),v:units>0?fmt(gdv2/units):"—",ok:false}].map(function(item){
              return e("div",{key:item.l,style:{background:item.ok?"rgba(45,122,101,0.06)":"#F7F8FC",border:"1px solid "+(item.ok?"rgba(45,122,101,0.2)":"#DDE0ED"),borderRadius:8,padding:12}},
                e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:5}},item.l),
                e("div",{style:{fontSize:18,fontWeight:700,color:item.ok?"#2D7A65":"#2E2F8A"}},item.v)
              );
            })
          ),
          (function(){
            var preLand = !(lc>0) && rlv>0;
            var vcol2 = preLand ? "#9A7B3E" : scV;
            return e("div",{style:{padding:"10px 14px",borderRadius:6,background:preLand?"rgba(154,123,62,0.08)":(margin2>=15?"rgba(45,122,101,0.06)":"rgba(176,90,53,0.06)"),border:"1px solid "+(preLand?"rgba(154,123,62,0.35)":(margin2>=15?"rgba(45,122,101,0.2)":"rgba(176,90,53,0.2)")),fontSize:12,fontWeight:700,color:vcol2}},
              preLand ? ("◐ Before land — "+pct(margin2)+" is the pre-land margin, not the scheme's viability. Enter a land price for the true figure.")
                : (margin2>=15?"✓ Viable — "+pct(margin2)+" margin on GDV":"✗ Not viable — "+pct(margin2)+" ("+pct(15-margin2)+" below 15% threshold)")
            );
          })()
        ),
        e("div",{style:S.card},
          e("div",{style:S.cardTitle},"Scenario Analysis"),
          e("div",{style:{border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden"}},
            e("div",{style:{display:"grid",gridTemplateColumns:"100px 1fr 1fr 100px",padding:"8px 14px",background:"#F7F8FC",fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",fontWeight:700,borderBottom:"1px solid #DDE0ED"}},
              e("span",null,"Scenario"),e("span",null,"GDV"),e("span",null,"Profit"),e("span",null,"Margin")
            ),
            scens.map(function(sc3){
              return e("div",{key:sc3.l,style:{display:"grid",gridTemplateColumns:"100px 1fr 1fr 100px",padding:"8px 14px",borderBottom:"1px solid #DDE0ED",fontSize:12,color:"#7278A0",alignItems:"center"}},
                e("span",{style:{fontWeight:700,color:"#2E2F8A"}},sc3.l),
                e("span",null,fmt(sc3.gdv)),
                e("span",{style:{color:sc3.profit>0?"#2D7A65":"#B05A35",fontWeight:600}},fmt(sc3.profit)),
                e("span",{style:{color:sc3.margin>=15?"#2D7A65":"#B05A35",fontWeight:600}},pct(sc3.margin))
              );
            })
          ),
          e("div",{style:{fontSize:10,color:"#7278A0",padding:"6px 4px"}},"Bear: -10% rents, +15% costs | Bull: +8% rents, -5% costs")
        ),
        // S106 LINE-ITEM CALCULATOR
      e("div",{style:S.card},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
          e("div",{style:S.cardTitle},"S106 Line-Item Calculator"),
          e("div",{style:{fontSize:10,color:"#7278A0"}},"Standard S106 line-item breakdown — 12 categories")
        ),
        e("div",{style:{border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden",marginBottom:10}},
          e("div",{style:{display:"grid",gridTemplateColumns:"2fr 130px 90px 100px",padding:"7px 12px",background:"#2E2F8A",fontSize:9,color:"#fff",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700}},
            e("span",null,"S106 Obligation"),e("span",null,"Total £"),e("span",null,"Per Unit"),e("span",null,"Status")
          ),
e("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}},
            e("div",{style:{fontStyle:"italic",fontSize:10,color:"#7278A0"}},"Enter S106 obligations — total auto-calculates. Use AI button below to get LPA-specific estimates."),
            e("button",{
              onClick:function(){
                // Auto-populate S106 based on city/LPA with typical Somerset West & Taunton rates
                var lpaCity=city||"";
                var u2=num(f.units||rlvUnits||0)||20;
                // Default S106 rates by area (£ per unit)
                var defaults={
                  taunton:   {s106edu:9000,s106nhsgp:800,s106nhshosp:1200,s106bus:400,s106busstop:150,s106transport:300,s106highways:6000,s106bng:2000,s106open:1500,s106sports:1200,s106disposal:500,s106other:500},
                  bristol:   {s106edu:10000,s106nhsgp:1000,s106nhshosp:1500,s106bus:500,s106busstop:200,s106transport:400,s106highways:8000,s106bng:2500,s106open:2000,s106sports:1500,s106disposal:600,s106other:600},
                  coventry:  {s106edu:8000,s106nhsgp:700,s106nhshosp:1000,s106bus:350,s106busstop:120,s106transport:250,s106highways:5000,s106bng:1800,s106open:1200,s106sports:1000,s106disposal:400,s106other:400},
                  manchester:{s106edu:9500,s106nhsgp:900,s106nhshosp:1400,s106bus:450,s106busstop:180,s106transport:350,s106highways:7000,s106bng:2200,s106open:1800,s106sports:1300,s106disposal:550,s106other:500},
                  birmingham:{s106edu:8500,s106nhsgp:800,s106nhshosp:1200,s106bus:400,s106busstop:150,s106transport:300,s106highways:6000,s106bng:2000,s106open:1500,s106sports:1100,s106disposal:450,s106other:450},
                  oxford:    {s106edu:12000,s106nhsgp:1200,s106nhshosp:1800,s106bus:600,s106busstop:250,s106transport:500,s106highways:10000,s106bng:3000,s106open:2500,s106sports:1800,s106disposal:700,s106other:700},
                  cambridge: {s106edu:13000,s106nhsgp:1300,s106nhshosp:2000,s106bus:700,s106busstop:280,s106transport:550,s106highways:11000,s106bng:3500,s106open:3000,s106sports:2000,s106disposal:800,s106other:800},
                };
                var def=defaults[lpaCity]||defaults.taunton;
                // Set each S106 field
                Object.keys(def).forEach(function(k){up("fin",k,String(def[k]*u2));});
                // Calculate total and set s106pu
                var tot=Object.values(def).reduce(function(s,v){return s+v;},0);
                up("fin","s106pu",String(tot));
                // v10.12 — was a native alert() here, which froze the (automated) browser. The S106 lines and
                // total update visibly; a non-blocking inline note confirms the fill instead.
                up("fin","_s106FillNote","✓ S106 populated with typical "+cityName(lpaCity||"Taunton")+" LPA rates for "+u2+" units — total £"+Math.round(tot*u2).toLocaleString()+" (£"+tot.toLocaleString()+"/unit). Adjust individual lines to match your planning negotiations.");
              },
              style:{padding:"6px 14px",background:"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",flexShrink:0}
            },"⚡ Auto-fill S106 for "+(city?cityName(city):"your area"))
          ),
          f._s106FillNote && e("div",{style:{margin:"0 0 8px",padding:"7px 12px",background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.3)",borderRadius:5,fontSize:11,color:"#1d5446",lineHeight:1.5}},f._s106FillNote),
          e(S106Table,{f:f,up:up,fmt:fmt,pct:pct,num:num,S:S,units:rlvUnits})
        ),
        e("div",{style:{fontSize:10,color:"#7278A0",fontStyle:"italic"}},"Reference rates: Education £2.36m, NHS £909k, Bus £398k, Sports £799k, BNG (often challenged). S106 is negotiable — mark challenged items accordingly.")
      ),

      // IRR & PHASED CASHFLOW SUMMARY
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"IRR & Phased Cashflow — Initial Screening"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:12}},"Simplified IRR for go/no-go screening. Once the deal passes, export key figures to the detailed Excel appraisal model for full month-by-month Normal Distribution cashflow."),
        // v10.9 — the sales-rate placeholder shows a scheme-derived rate (sell-out tracks
        // the programme), replacing the flat 0.75/wk that implied a 27-year sell-out.
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}},
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Private Sales Rate (units/week)"),
            e("input",{type:"number",value:f.salesRateWeek||"",onChange:function(ev){up("fin","salesRateWeek",ev.target.value);},placeholder:String((num(f.units||units||0)>0&&num(f.programmeMths||finProgDefault)>0)?Math.round((num(f.units||units||0)/(num(f.programmeMths||finProgDefault)*(52/12)))*100)/100:0.75),style:S.input})
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Finance Rate (% pa) — shared with the appraisal above"),
            e("input",{type:"number",value:f.finRate||"",onChange:function(ev){up("fin","finRate",ev.target.value);},placeholder:"7.5",style:S.input})
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Programme Length (months)"),
            e("input",{type:"number",value:f.programmeMths||"",onChange:function(ev){up("fin","programmeMths",ev.target.value);},placeholder:String(finProgDefault),style:S.input})
          )
        ),
        (function(){
          var progMths=num(f.programmeMths||finProgDefault);
          // v10.38 — use the CANONICAL scheme unit count (the mix-based figure for SFH, else the
          // centralised calcDealMetrics count) — NOT the stale data.fin.units, which wasn't
          // caught by the unit reconciliation and could show e.g. 1,902 while every other stage
          // reads 1,800. f.units is a last-resort fallback only.
          var u=isSFH ? (sfhTotalUnits || num(DM.units) || num(f.units||units||0))
                      : (num(DM.units) || num(f.units||units||0));
          // v10.9 — sell-out tracks the programme unless the user sets an explicit rate;
          // and the finance rate is the ONE appraisal rate (f.finRate), not a separate 8%.
          var salesRate=num(f.salesRateWeek) || (u>0&&progMths>0 ? Math.round((u/(progMths*(52/12)))*100)/100 : 0.75);
          var finRatePa=num(f.finRate||7.5)/100;
          var gdvF=gdv2>0?gdv2:0;
          var tcF=tc4>0?tc4:0;
          var marginF=margin2;
          if(u<1||gdvF<1)return e("div",{style:{fontSize:12,color:"#7278A0",padding:"10px 0"}},"Enter units and GDV in the appraisal above to calculate IRR.");
          // v10.153 — only RETAIL units sit in the house-by-house sales tail; bulk/affordable units
          // transfer as built. So the sales PERIOD is driven by retail units, not the whole scheme.
          var brF=finBulkRetailSplit(data, u, gdvF);
          var salesMths=salesRate>0?Math.ceil((brF.retailUnits||u)/(salesRate*52/12)):progMths;
          var peakDebt=(tcF>0?tcF:tc4)*0.65;
          var finCost=peakDebt*finRatePa*(progMths/12);
          // v10.153 — IRR now comes from the SAME phased-cashflow model as the S-curve card below
          // (land at t0, bulk-as-built + retail tail), so the two IRRs agree instead of the old crude
          // "all GDV at year N" giving a different, over-pessimistic number.
          var landOutF = num(lc)>0 ? num(lc) : Math.max(0, num(rlv));
          var devExLandF = Math.max(0, tcF - num(lc));
          var irrVal = finPhasedCashflow(data, u, gdvF, devExLandF, landOutF, progMths, f.salesRateWeek, finRatePa/12).irr;
          var irrColor=irrVal!=null&&irrVal>=15?"#2D7A65":irrVal!=null&&irrVal>=10?"#9A7B3E":"#B05A35";

          return e("div",null,
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}},
              [
                {l:"Retail / bulk units",v:brF.bulkUnits>0?(brF.retailUnits.toLocaleString()+" / "+brF.bulkUnits.toLocaleString()):u},
                {l:"Retail sales period",v:salesMths+" mths"},
                {l:"Programme",v:progMths+" mths"},
                {l:"Peak Debt (est)",v:fmt(peakDebt)},
                {l:"Finance — upper est",v:fmt(finCost),s:true},
                {l:"Profit on Cost",v:tcF>0?pct((gdvF-tcF)/tcF*100):"—",c:gdvF>tcF?"#2D7A65":"#B05A35",big:true},
                {l:"Margin on GDV",v:gdvF>0?pct(marginF):"—",c:marginF>=15?"#2D7A65":"#B05A35",big:true},
                {l:"Project IRR",v:irrVal!=null?irrVal+"%":"—",c:irrColor,big:true},
              ].map(function(item){
                return e("div",{key:item.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid "+(item.c||"#4A4BAE"),borderRadius:8,padding:12,textAlign:"center"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:4}},item.l),
                  e("div",{style:{fontSize:item.big?22:14,fontWeight:800,color:item.c||"#2E2F8A"}},item.v)
                );
              })
            ),
            // v10.147 — reconcile the THREE finance figures on this screen so a reader knows which
            // to trust. They use three different debt assumptions on purpose; label them plainly.
            e("div",{style:{fontSize:10.5,color:"#5A4A2E",background:"rgba(154,123,62,0.08)",border:"1px solid rgba(154,123,62,0.35)",borderRadius:6,padding:"9px 12px",marginBottom:12,lineHeight:1.55}},
              e("strong",null,"Three finance figures — which is which. "),
              "The appraisal above charges ",e("strong",null,fmt(num(DM.finance))),
              " (the engine's S-curve peak-debt basis — this is the one in Total Dev Cost and the residual). ",
              e("strong",null,"‘Finance — upper est’ "+fmt(finCost)),
              " is a crude screening upper bound: peak debt (~65% of cost) held across the WHOLE ",progMths,"-month programme with no recycling — deliberately pessimistic, not the appraisal figure. ",
              "The ",e("strong",null,"phased S-curve cashflow below"),
              " models debt actually recycling as homes sell, so its ‘Total Interest’ is lower again. Use the engine figure (",fmt(num(DM.finance)),") for the appraisal; the other two bracket it."
            ),
            // PHASED S-CURVE CASHFLOW
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Phased Cashflow — S-Curve Distribution"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:12}},"Industry-standard S-curve sales phasing. Slow start, peak mid-programme, tail-off at end. Matches Landval Cloud and institutional appraisal methodology."),
        (function(){
          var u3=num(f.units||sfhTotalUnits||0);
          var buildMonths=Math.max(1,num(f.programmeMths||finProgDefault));   // construction programme
          var finR=num(f.finRate||7.5)/100/12;  // v10.9 — one finance rate (shared with the appraisal), was a separate 8%
          var gdv3=gdv2>0?gdv2:0;
          var tc3=tc4>0?tc4:0;
          if(u3<1||gdv3<1)return e("div",{style:{fontSize:12,color:"#7278A0",padding:"8px 0"}},"Enter units and GDV above to see phased cashflow.");
          // v10.153 — one phased model (finPhasedCashflow): land at t0, dev costs lead on the build
          // curve, BULK/affordable transfers as built, RETAIL absorbs on its own tail. Land = the
          // entered price, or the RLV if none set yet (an IRR needs the land investment).
          var landOut3 = num(lc)>0 ? num(lc) : Math.max(0, num(rlv));
          var landAssumed3 = !(num(lc)>0) && landOut3>0;
          var devExLand3 = Math.max(0, tc3 - num(lc));
          var cf = finPhasedCashflow(data, u3, gdv3, devExLand3, landOut3, buildMonths, f.salesRateWeek, finR);
          var peakDebt2=cf.peakDebt, totalInt=cf.totalInt, finalProfit=cf.finalProfit, scIRR=cf.irr, months=cf.milestones, prog3=cf.prog, br3=cf.br;

          return e("div",null,
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}},
              [{l:"Peak Debt",v:fmt(peakDebt2),c:"#B05A35"},{l:"Total Interest (phased)",v:fmt(totalInt),c:"#9A7B3E"},
               {l:"Net Profit (after land & finance)",v:fmt(finalProfit),c:finalProfit>0?"#2D7A65":"#B05A35"},{l:"Project IRR",v:scIRR!=null?scIRR+"%":"—",c:scIRR!=null&&scIRR>=15?"#2D7A65":scIRR!=null&&scIRR>=10?"#9A7B3E":"#B05A35"}
              ].map(function(item){
                return e("div",{key:item.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid "+item.c,borderRadius:8,padding:12,textAlign:"center"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:4}},item.l),
                  e("div",{style:{fontSize:18,fontWeight:800,color:item.c}},item.v)
                );
              })
            ),
            // v10.153 — explain the phasing basis so the IRR is legible
            e("div",{style:{fontSize:10,color:"#5A5A70",background:"#F7F8FC",border:"1px solid #E4E6F0",borderRadius:6,padding:"8px 11px",marginBottom:14,lineHeight:1.55}},
              br3.bulkUnits>0
                ? e("span",null,e("b",null,"Retail vs bulk phasing. "),br3.retailUnits.toLocaleString()+" retail homes absorb house-by-house over ~"+cf.retailMonths+" months; the "+br3.bulkUnits.toLocaleString()+" affordable / HA homes transfer as built (a few bulk deals), so their cash comes in earlier and doesn't sit in the sales tail. ")
                : e("span",null,e("b",null,"Phasing. ")),
              e("b",null,"Land at day 0: "),landAssumed3?("no land price entered, so the IRR assumes you pay the "+fmt(landOut3)+" residual — enter a guide price for your actual land cost."):("the "+fmt(landOut3)+" land price you entered."),
              " The Project IRR is a true monthly-cashflow IRR on this profile."
            ),
            e("div",{style:{border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden"}},
              e("div",{style:{display:"grid",gridTemplateColumns:"60px 1fr 1fr 1fr 1fr",padding:"7px 12px",background:"#2E2F8A",fontSize:9,color:"#fff",fontWeight:700,textTransform:"uppercase"}},
                e("span",null,"Month"),e("span",null,"Cum Sales"),e("span",null,"Cum Costs"),e("span",null,"Peak Debt"),e("span",null,"Cum Profit")
              ),
              months.map(function(row,i){
                return e("div",{key:i,style:{display:"grid",gridTemplateColumns:"60px 1fr 1fr 1fr 1fr",padding:"6px 12px",background:i%2===0?"#fff":"#FAFAFA",borderBottom:"1px solid #DDE0ED",fontSize:11}},
                  e("span",{style:{color:"#7278A0"}},"M"+row.m),
                  e("span",{style:{color:"#2D7A65",fontWeight:600}},fmt(row.sales)),
                  e("span",{style:{color:"#B05A35"}},fmt(row.cost)),
                  e("span",{style:{color:"#9A7B3E"}},fmt(row.debt)),
                  e("span",{style:{fontWeight:700,color:row.profit>0?"#2D7A65":"#B05A35"}},fmt(row.profit))
                );
              })
            )
          );
        })()
      ),

      e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",borderRadius:9,padding:"16px 20px"}},
              e("div",{style:{fontSize:13,fontWeight:800,color:"#EDE84A",marginBottom:6}},"📊 Export to Detailed Excel Model"),
              e("div",{style:{fontSize:11,color:"rgba(255,255,255,0.7)",lineHeight:1.8,marginBottom:12}},
                "Landform is designed for fast initial screening — Go/No-Go in minutes. Once a deal passes, copy these figures into the full Excel model for: ",
                e("br"),
                "✓ Month-by-month cashflow with Normal Distribution sales phasing",e("br"),
                "✓ BCIS build costs rebased to local index by house type",e("br"),
                "✓ Arcadis line-item infrastructure cost breakdown",e("br"),
                "✓ RP offer tracking (golden brick vs turnkey per housing association)"
              ),
              e("div",{style:{background:"rgba(255,255,255,0.08)",borderRadius:6,padding:"12px 14px",fontFamily:"monospace",fontSize:10,color:"rgba(255,255,255,0.9)",lineHeight:2.0,marginBottom:12}},
                "Site: "+(l.address||"—"),e("br"),
                "Gross Site: "+num(l.acres||0)+" acres / "+(num(l.acres||0)*0.404686).toFixed(2)+" ha",e("br"),
                "Units: "+u+" | GDV: "+fmt(gdv2>0?gdv2:gdvF)+" | Land (RLV): "+fmt(Math.max(0,rlv)),e("br"),
                "Build Cost: "+fmt(totalBuild||Math.round(tcF*0.6))+" | S106 Total: "+fmt(num(f.s106pu||0)*u),e("br"),
                "Finance: "+(f.finRate||7.5)+"% pa | Sales: "+(f.salesRateWeek||(num(f.units||units||0)>0&&num(f.programmeMths||finProgDefault)>0?Math.round((num(f.units||units||0)/(num(f.programmeMths||finProgDefault)*(52/12)))*100)/100:0.75))+"/wk | IRR: "+(irrVal?irrVal+"%":"—"),e("br"),
                "Margin: "+pct(margin2)+" | Profit on Cost: "+pct(tc4>0?(gdv2-tc4)/tc4*100:0)
              ),
              e("button",{onClick:function(){
                var nl="\n";var t=["LANDFORM EXPORT",new Date().toLocaleDateString("en-GB"),"","SITE: "+(l.address||"Unknown"),"LPA: "+(data.planning&&data.planning.lpa||"n/a"),"Gross Site: "+num(l.acres||0)+" acres","Units: "+u,"GDV: "+fmt(gdv2>0?gdv2:gdvF),"Land Residual Value: "+fmt(Math.max(0,rlv)),"Build Cost: "+fmt(totalBuild),"S106/unit: "+(f.s106pu||0),"S106 Total: "+fmt(num(f.s106pu||0)*u),"Finance: "+(f.finRate||7.5)+"% pa","Sales Rate: "+(f.salesRateWeek||(num(f.units||units||0)>0&&num(f.programmeMths||finProgDefault)>0?Math.round((num(f.units||units||0)/(num(f.programmeMths||finProgDefault)*(52/12)))*100)/100:0.75))+"/wk","Programme: "+(f.programmeMths||finProgDefault)+" months","Margin on GDV: "+pct(margin2),"IRR: "+(irrVal?irrVal+"%":"n/a"),"","NEXT STEP: Enter into the detailed Excel appraisal model.","Set land price to RLV. Run Normal Distribution cashflow.","Rebase BCIS build costs. Track RP offers."].join(nl);                var el=document.createElement("textarea");
                el.value=t;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);
                notify("Copied to clipboard — paste into your Excel appraisal model");
              },style:{padding:"9px 22px",background:"#EDE84A",border:"none",borderRadius:7,color:"#1E1F5C",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "📋 Copy Key Figures for Excel Model")
            )
          );
        })()
      ),

      // AI BENCHMARKING vs HOUSEBUILDERS
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"AI Appraisal Review — Benchmarked vs Major Housebuilders"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:10}},"Compares your figures against Persimmon, Barratt, Taylor Wimpey and Bellway published benchmarks and BCIS data. Flags anything outside normal ranges."),
        e(AIPanel,{user:user,up:up,stage:"fin",data:data,persistKey:"fin_run_ai_appraisal_ben",label:"Run AI Appraisal Benchmark Analysis",
          prompt:buildHonestPrompt(data,"You are a senior development finance director. Analyse this "+at.toUpperCase()+" appraisal and benchmark against industry standards.\nSITE: "+(l.address||"Unknown")+", "+cityName(city)+" | LPA: "+(data.planning&&data.planning.lpa||"unknown")+"\nGDV: "+fmt(gdv2)+" | TDC: "+fmt(tc4)+" | Profit: "+fmt(profit2)+" | Margin: "+pct(margin2)+" | ROC: "+pct(roc)+"\nUnits: "+(rlvUnits||units)+" | Build Cost: £"+(f.buildPsf||m.build)+"/sqft | S106/unit: £"+(f.s106pu||0)+" | Land Cost: "+fmt(lc)+"\nFinance Rate: "+(f.finRate||7.5)+"% | Contingency: "+(f.contingency||5)+"%\n\nProvide:\n1) ACCURACY CHECK — are build costs, S106, finance rates and yield within normal ranges for "+cityName(city)+"? Give specific correct figures for each.\n2) S106 ESTIMATE — what is a realistic S106/CIL total for "+(data.planning&&data.planning.lpa||cityName(city))+" LPA? Break down by Education, NHS, Highways, BNG, Open Space and give £/unit figures.\n3) HOUSEBUILDER BENCHMARK — compare margin and ROC against Persimmon (20-22% margin, £1,450/m2 build), Barratt (18-20%, £1,550/m2), Taylor Wimpey (19-21%), Bellway (20-23%).\n4) RED FLAGS — top 3 things that are wrong or missing from this appraisal.\n5) CORRECTED APPRAISAL SUMMARY — with your recommended figures, what would the GDV, TDC, profit and margin look like?\n6) SCORE 1-10 and state: Proceed / Caution / Abort.","fin")})
      ),

      // LANDOWNER vs CASSIDY COMMERCIAL SPLIT
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #9A7B3E"})},
        e("div",{style:S.cardTitle},"Commercial Analysis — Landowner vs Cassidy Group"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14}},"What does the landowner receive vs what does Cassidy make? Three exit scenarios with negotiation range."),
        (function(){
          var agriVal2=num(l.acres||0)*15000;
          var rlvVal2=Math.max(0,rlv);
          var uplift2=rlvVal2-agriVal2;
          var lo40=agriVal2+uplift2*0.40;
          var lo50=agriVal2+uplift2*0.50;
          var lo60=agriVal2+uplift2*0.60;
          var devProfit=profit2>0?profit2:(gdv2>0?gdv2*0.175:0);
          var totalPie2=rlvVal2+devProfit;
          var scenarios3=[
            {label:"Pre-Planning Sale",color:"#B05A35",lo:agriVal2,cg:rlvVal2-agriVal2+devProfit,note:"Landowner sells at agricultural value. All planning risk sits with Cassidy."},
            {label:"Post-Outline Consent",color:"#9A7B3E",lo:Math.round(rlvVal2*0.65),cg:Math.round(rlvVal2*0.35)+devProfit,note:"Landowner gets 65% of RLV. Planning risk shared via option agreement."},
            {label:"Post-Full Consent",color:"#2D7A65",lo:Math.round(rlvVal2*0.85),cg:Math.round(rlvVal2*0.15)+devProfit,note:"Landowner gets 85% of RLV. Cassidy captures full developer profit."},
          ];
          if(rlvVal2<1) return e("div",{style:{fontSize:12,color:"#7278A0",padding:"10px 0"}},"Complete the Financial Modelling inputs above to see the landowner vs Cassidy commercial split.");
          return e("div",null,
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}},
              [
                {l:"Agricultural Value",v:fmt(agriVal2),c:"#7278A0",sub:"Baseline — no planning"},
                {l:"Planning Uplift",v:fmt(uplift2),c:"#9A7B3E",sub:"Value created by consent"},
                {l:"Max Land Value (RLV)",v:fmt(rlvVal2),c:"#4A4BAE",sub:"Developer max bid"},
                {l:"Cassidy Dev Profit",v:fmt(devProfit),c:"#2D7A65",sub:(gdv2>0?(Math.round(devProfit/gdv2*1000)/10):17.5)+"% target on GDV"},
              ].map(function(item){
                return e("div",{key:item.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid "+item.c,borderRadius:8,padding:12,textAlign:"center"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:4}},item.l),
                  e("div",{style:{fontSize:17,fontWeight:800,color:item.c}},item.v),
                  e("div",{style:{fontSize:9,color:"#7278A0",marginTop:3,lineHeight:1.4}},item.sub)
                );
              })
            ),
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:14}},
              scenarios3.map(function(sc){
                var loShare=totalPie2>0?Math.round(sc.lo/totalPie2*100):0;
                var cgShare=totalPie2>0?Math.round(sc.cg/totalPie2*100):0;
                return e("div",{key:sc.label,style:{background:"#fff",border:"2px solid "+sc.color,borderRadius:9,padding:14}},
                  e("div",{style:{fontSize:12,fontWeight:800,color:sc.color,marginBottom:10}},sc.label),
                  e("div",{style:{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #F0F0F0",fontSize:12,fontWeight:700}},
                    e("span",{style:{color:"#7278A0"}},"Landowner receives"),
                    e("span",{style:{color:sc.color}},fmt(sc.lo))
                  ),
                  e("div",{style:{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:11}},
                    e("span",{style:{color:"#7278A0"}},"Cassidy (land + profit)"),
                    e("span",{style:{color:"#2D7A65",fontWeight:700}},fmt(sc.cg))
                  ),
                  e("div",{style:{margin:"8px 0"}},
                    e("div",{style:{fontSize:9,color:"#7278A0",marginBottom:3}},"Landowner "+loShare+"% / Cassidy "+cgShare+"%"),
                    e("div",{style:{height:8,background:"#DDE0ED",borderRadius:4,overflow:"hidden",display:"flex"}},
                      e("div",{style:{width:loShare+"%",background:sc.color}}),
                      e("div",{style:{width:cgShare+"%",background:"#2D7A65"}})
                    )
                  ),
                  e("div",{style:{fontSize:10,color:"#7278A0",lineHeight:1.5}},sc.note)
                );
              })
            ),
            e("div",{style:{background:"rgba(154,123,62,0.08)",border:"1px solid rgba(154,123,62,0.25)",borderRadius:8,padding:14}},
              e("div",{style:{fontSize:12,fontWeight:700,color:"#9A7B3E",marginBottom:8}},"Negotiation Range — Fair Share for the Landowner"),
              e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}},
                [
                  {l:"Opening Bid (40% uplift)",v:fmt(lo40),sub:"Start here — room to move"},
                  {l:"Fair Share (50% uplift)",v:fmt(lo50),sub:"Industry norm for options"},
                  {l:"Maximum (60% uplift)",v:fmt(lo60),sub:"Only if strong competition"},
                ].map(function(item){
                  return e("div",{key:item.l,style:{background:"#fff",border:"1px solid rgba(154,123,62,0.3)",borderRadius:6,padding:12,textAlign:"center"}},
                    e("div",{style:{fontSize:9,color:"#9A7B3E",textTransform:"uppercase",marginBottom:3}},item.l),
                    e("div",{style:{fontSize:16,fontWeight:800,color:"#9A7B3E"}},item.v),
                    e("div",{style:{fontSize:9,color:"#7278A0",marginTop:2}},item.sub)
                  );
                })
              ),
              e("div",{style:{fontSize:11,color:"#7A5A2E",lineHeight:1.7}},
                "Agricultural value ("+fmt(agriVal2)+") is guaranteed to the landowner regardless. The negotiation is over the planning uplift ("+fmt(uplift2)+"). 40-60% share to landowner is industry standard. Cassidy captures developer profit ("+fmt(devProfit)+") separately — the return for taking planning and build risk."
              )
            )
          );
        })()
      ),
      e(AIPanel,{user:user,up:up,stage:"fin",data:data,persistKey:"fin_ai__landowner_vs_cas",label:"AI: Landowner vs Cassidy Commercial Analysis",
        prompt:buildHonestPrompt(data,"Analyse the commercial split on this "+at.toUpperCase()+" deal.\nSite: "+(l.address||"Unknown")+", "+cityName(city)+" | Acres: "+(l.acres||"?")+" | GDV: "+fmt(gdv2)+" | RLV: "+fmt(Math.max(0,rlv))+" | Dev Profit: "+fmt(profit2>0?profit2:gdv2*0.175)+" | Owner: "+(l.ownerType||"not set")+"\n\nProvide: 1) What is a fair deal for this landowner given the planning risk Cassidy takes? 2) What acquisition structure — unconditional, conditional, option or promotion? 3) What % of planning uplift should the landowner receive and why? 4) How does this compare to what Persimmon/Barratt/Taylor Wimpey pay for strategic land in this location type? 5) Cassidy negotiation tactics to agree land price?","land_deal")})
      )
    );
  }
