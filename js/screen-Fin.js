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
    var tc4 = effBuildCost + lc + s106fin + effBuildCost*0.12 + effBuildCost*(finContPct/100) + (effBuildCost+lc)*(finRatePct/100) + lc*0.05;

    var profit2 = DM.actualProfit !== 0 ? DM.actualProfit : (gdv2-tc4);
    var margin2 = DM.marginPct !== 0 ? DM.marginPct : (gdv2>0?(profit2/gdv2)*100:0);
    var roc = DM.roc !== 0 ? DM.roc : (tc4>0?(profit2/tc4)*100:0);
    var rlv = DM.rlv || (gdv2>0 ? gdv2 - tc4 - gdv2*(DM.profitPctTarget/100) : 0);
    var totalBuild = effBuildCost;
    var scV=margin2>=15?"#2D7A65":"#B05A35";

    var scens=[{l:"Bear",sm:-0.10,bm:+0.15},{l:"Base",sm:0,bm:0},{l:"Bull",sm:+0.08,bm:-0.05}].map(function(sc3){
      var sG=(gr*(1+sc3.sm))*voidAdj-opex; var sGdv=ey2>0?sG/ey2:0;
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
              alert("Fields populated from your land and SFH appraisal data. Review each figure and adjust to match your actual deal.");
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
        e("div",{style:{background:"rgba(154,123,62,0.06)",border:"1px solid rgba(154,123,62,0.2)",borderRadius:7,padding:"10px 14px",fontSize:11,marginTop:8}},
          e("div",{style:{fontWeight:700,color:"#9A7B3E",marginBottom:6}},"BCIS Benchmarks Q1 2025 — Worcestershire / South West"),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}},
            e("div",null,e("span",{style:{color:"#7278A0",fontSize:10}},"2-storey houses: "),e("span",{style:{fontWeight:700,fontSize:11}},"£148/sqft")),
            e("div",null,e("span",{style:{color:"#7278A0",fontSize:10}},"3-storey: "),e("span",{style:{fontWeight:700,fontSize:11}},"£160/sqft")),
            e("div",null,e("span",{style:{color:"#7278A0",fontSize:10}},"4-5 storey flats: "),e("span",{style:{fontWeight:700,fontSize:11}},"£181/sqft")),
            e("div",null,e("span",{style:{color:"#7278A0",fontSize:10}},"Add externals/infra: "),e("span",{style:{fontWeight:700,fontSize:11}},"+15-25%"))
          )
        )
      ),
      units>0&&gia>0&&e("div",null,
        e("div",{style:S.card},
          e("div",{style:S.cardTitle},"Development Appraisal"),
          e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:12}},
            e("div",null,
              e("div",{style:{fontSize:9,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,marginBottom:10}},"COSTS"),
              [["Land",lc],["Build ("+Math.round(gia).toLocaleString()+" sqft @ £"+buildPsf+"/sqft)",bc],["S106/CIL allowance (£"+fmtN(finS106Pu)+"/unit)",s106fin],["Contingency ("+finContPct+"%)",bc*(finContPct/100)],["Prof Fees (12%)",bc*0.12],["Finance ("+finRatePct+"%)",(bc+lc)*(finRatePct/100)],["SDLT (5%)",lc*0.05]].map(function(row){
                return e("div",{key:row[0],style:{display:"flex",justifyContent:"space-between",fontSize:12,color:"#7278A0",padding:"4px 0",borderBottom:"1px solid #F0F0F0"}},
                  e("span",null,row[0]),e("span",null,fmt(row[1]))
                );
              }),
              e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#2E2F8A",padding:"8px 0",borderTop:"1px solid #DDE0ED",marginTop:4}},
                e("span",null,"Total Dev Cost"),e("span",null,fmt(tc4))
              )
            ),
            e("div",null,
              e("div",{style:{fontSize:9,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,marginBottom:10}},"INCOME & GDV"),
              [["Gross Rent (pa)",gr],["Effective Rent ("+(at==="pbsa"?97:95)+"% occupancy)",gr*voidAdj],["OpEx (pa)",-opex],["NOI (pa)",noi2],["Exit Yield",null,pct(ey2*100)]].map(function(row){
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
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}},
            [{l:"Profit",v:fmt(profit2),ok:margin2>=15},{l:"Margin on GDV",v:pct(margin2),ok:margin2>=15},{l:"Return on Cost",v:pct(roc),ok:roc>20},{l:"Price per "+(at==="pbsa"?"Bed":"Unit"),v:units>0?fmt(gdv2/units):"—",ok:false}].map(function(item){
              return e("div",{key:item.l,style:{background:item.ok?"rgba(45,122,101,0.06)":"#F7F8FC",border:"1px solid "+(item.ok?"rgba(45,122,101,0.2)":"#DDE0ED"),borderRadius:8,padding:12}},
                e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:5}},item.l),
                e("div",{style:{fontSize:18,fontWeight:700,color:item.ok?"#2D7A65":"#2E2F8A"}},item.v)
              );
            })
          ),
          e("div",{style:{padding:"10px 14px",borderRadius:6,background:margin2>=15?"rgba(45,122,101,0.06)":"rgba(176,90,53,0.06)",border:"1px solid "+(margin2>=15?"rgba(45,122,101,0.2)":"rgba(176,90,53,0.2)"),fontSize:12,fontWeight:700,color:scV}},
            margin2>=15?"✓ Viable — "+pct(margin2)+" margin on GDV":"✗ Not viable — "+pct(margin2)+" ("+pct(15-margin2)+" below 15% threshold)"
          )
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
                var alertMsg=["S106 populated with typical "+cityName(lpaCity||"Taunton")+" LPA rates for "+u2+" units.","Total: £"+Math.round(tot*u2).toLocaleString()+" (£"+tot.toLocaleString()+"/unit)","Adjust individual lines to match your actual planning negotiations."].join("\n");
                alert(alertMsg);
              },
              style:{padding:"6px 14px",background:"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",flexShrink:0}
            },"⚡ Auto-fill S106 for "+(city?cityName(city):"your area"))
          ),
          e(S106Table,{f:f,up:up,fmt:fmt,pct:pct,num:num,S:S,units:rlvUnits})
        ),
        e("div",{style:{fontSize:10,color:"#7278A0",fontStyle:"italic"}},"Reference rates: Education £2.36m, NHS £909k, Bus £398k, Sports £799k, BNG (often challenged). S106 is negotiable — mark challenged items accordingly.")
      ),

      // IRR & PHASED CASHFLOW SUMMARY
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"IRR & Phased Cashflow — Initial Screening"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:12}},"Simplified IRR for go/no-go screening. Once the deal passes, export key figures to the detailed Excel appraisal model for full month-by-month Normal Distribution cashflow."),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}},
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Private Sales Rate (units/week)"),
            e("input",{type:"number",value:f.salesRateWeek||"",onChange:function(ev){up("fin","salesRateWeek",ev.target.value);},placeholder:"0.75",style:S.input})
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Finance Rate (% per annum)"),
            e("input",{type:"number",value:f.finRatePa||"",onChange:function(ev){up("fin","finRatePa",ev.target.value);},placeholder:"8",style:S.input})
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Programme Length (months)"),
            e("input",{type:"number",value:f.programmeMths||"",onChange:function(ev){up("fin","programmeMths",ev.target.value);},placeholder:"36",style:S.input})
          )
        ),
        (function(){
          var salesRate=num(f.salesRateWeek||0.75);
          var finRatePa=num(f.finRatePa||8)/100;
          var progMths=num(f.programmeMths||36);
          var u=num(f.units||units||0);
          var gdvF=gdv2>0?gdv2:0;
          var tcF=tc4>0?tc4:0;
          var marginF=margin2;
          if(u<1||gdvF<1)return e("div",{style:{fontSize:12,color:"#7278A0",padding:"10px 0"}},"Enter units and GDV in the appraisal above to calculate IRR.");
          var salesMths=salesRate>0?Math.ceil(u/(salesRate*52/12)):progMths;
          var peakDebt=(tcF>0?tcF:tc4)*0.65;
          var finCost=peakDebt*finRatePa*(progMths/12);
          // Newton-Raphson IRR approximation
          var irrVal=(function(){
            var iGdv=gdvF>0?gdvF:gdv2; var iTc=tcF>0?tcF:tc4; if(iGdv<=0||iTc<=0)return null;
            var r=0.15;
            var n=progMths/12;
            for(var i=0;i<60;i++){
              var pv=iGdv/Math.pow(1+r,n);
              var npv=pv-iTc*(1+finRatePa*n/2);
              var dpv=-n*iGdv/Math.pow(1+r,n+1);
              var nr=r-npv/dpv;
              if(Math.abs(nr-r)<0.00001)break;
              r=nr;
            }
            return r>-1&&r<5?Math.round(r*1000)/10:null;
          })();
          var irrColor=irrVal&&irrVal>=15?"#2D7A65":irrVal&&irrVal>=10?"#9A7B3E":"#B05A35";

          return e("div",null,
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}},
              [
                {l:"Private Units",v:u},
                {l:"Sales Period",v:salesMths+" mths"},
                {l:"Programme",v:progMths+" mths"},
                {l:"Peak Debt (est)",v:fmt(peakDebt)},
                {l:"Finance Cost (est)",v:fmt(finCost),s:true},
                {l:"Profit on Cost",v:tcF>0?pct((gdvF-tcF)/tcF*100):"—",c:gdvF>tcF?"#2D7A65":"#B05A35",big:true},
                {l:"Margin on GDV",v:gdvF>0?pct(marginF):"—",c:marginF>=15?"#2D7A65":"#B05A35",big:true},
                {l:"Approx IRR",v:irrVal?irrVal+"%":"—",c:irrColor,big:true},
              ].map(function(item){
                return e("div",{key:item.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid "+(item.c||"#4A4BAE"),borderRadius:8,padding:12,textAlign:"center"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:4}},item.l),
                  e("div",{style:{fontSize:item.big?22:14,fontWeight:800,color:item.c||"#2E2F8A"}},item.v)
                );
              })
            ),
            // PHASED S-CURVE CASHFLOW
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Phased Cashflow — S-Curve Distribution"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:12}},"Industry-standard S-curve sales phasing. Slow start, peak mid-programme, tail-off at end. Matches Landval Cloud and institutional appraisal methodology."),
        (function(){
          var u3=num(f.units||sfhTotalUnits||0);
          var prog3=num(f.programmeMths||36);
          var finR=num(f.finRatePa||8)/100/12;
          var gdv3=gdv2>0?gdv2:0;
          var tc3=tc4>0?tc4:0;
          if(u3<1||gdv3<1)return e("div",{style:{fontSize:12,color:"#7278A0",padding:"8px 0"}},"Enter units and GDV above to see phased cashflow.");
          // Generate monthly cashflow using S-curve (normal distribution approximation)
          var months=[];
          var cumSales=0; var cumCost=0; var peakDebt2=0; var totalInt=0; var runDebt=0;
          for(var m3=1;m3<=prog3;m3++){
            // S-curve sales: slow-fast-slow using sine approximation
            var pct=(m3-1)/(prog3-1);
            var sCurvePct=pct<0.5?2*pct*pct:1-Math.pow(-2*pct+2,2)/2;
            var prevCurve=pct===0?0:((m3-2)/(prog3-1)<0.5?2*Math.pow((m3-2)/(prog3-1),2):1-Math.pow(-2*(m3-2)/(prog3-1)+2,2)/2);
            var monthSales=(sCurvePct-prevCurve)*gdv3;
            // Costs: front-loaded (construction S-curve slightly ahead of sales)
            var costPct=Math.min(1,pct*1.2);
            var prevCostPct=Math.min(1,(m3-2>0?(m3-2)/(prog3-1)*1.2:0));
            var monthCost=(costPct-prevCostPct)*tc3;
            cumSales+=monthSales; cumCost+=monthCost;
            runDebt=Math.max(0,cumCost-cumSales);
            var interest=runDebt*finR;
            totalInt+=interest; runDebt+=interest;
            peakDebt2=Math.max(peakDebt2,runDebt);
            if(m3<=prog3&&(m3===1||m3===Math.floor(prog3/4)||m3===Math.floor(prog3/2)||m3===Math.floor(prog3*3/4)||m3===prog3)){
              months.push({m:m3,sales:Math.round(cumSales),cost:Math.round(cumCost),debt:Math.round(runDebt),profit:Math.round(cumSales-cumCost-totalInt)});
            }
          }
          var finalProfit=gdv3-tc3-totalInt;
          var scIRR=(function(){
            if(gdv3<=0||tc3<=0)return null;
            var r=0.15; var n=prog3/12;
            for(var it=0;it<50;it++){
              var pv2=gdv3/Math.pow(1+r,n);
              var npv2=pv2-(tc3+totalInt);
              var dpv2=-n*gdv3/Math.pow(1+r,n+1);
              var nr=r-npv2/dpv2;
              if(Math.abs(nr-r)<0.00001)break;
              r=nr;
            }
            return r>-1&&r<5?Math.round(r*1000)/10:null;
          })();

          return e("div",null,
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}},
              [{l:"Peak Debt",v:fmt(peakDebt2),c:"#B05A35"},{l:"Total Interest",v:fmt(totalInt),c:"#9A7B3E"},
               {l:"Net Profit (after finance)",v:fmt(finalProfit),c:finalProfit>0?"#2D7A65":"#B05A35"},{l:"S-Curve IRR",v:scIRR?scIRR+"%":"—",c:scIRR&&scIRR>=15?"#2D7A65":"#B05A35"}
              ].map(function(item){
                return e("div",{key:item.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid "+item.c,borderRadius:8,padding:12,textAlign:"center"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:4}},item.l),
                  e("div",{style:{fontSize:18,fontWeight:800,color:item.c}},item.v)
                );
              })
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
                "Finance: "+(f.finRatePa||8)+"% pa | Sales: "+(f.salesRateWeek||0.75)+"/wk | IRR: "+(irrVal?irrVal+"%":"—"),e("br"),
                "Margin: "+pct(margin2)+" | Profit on Cost: "+pct(tc4>0?(gdv2-tc4)/tc4*100:0)
              ),
              e("button",{onClick:function(){
                var nl="\n";var t=["LANDFORM EXPORT",new Date().toLocaleDateString("en-GB"),"","SITE: "+(l.address||"Unknown"),"LPA: "+(data.planning&&data.planning.lpa||"n/a"),"Gross Site: "+num(l.acres||0)+" acres","Units: "+u,"GDV: "+fmt(gdv2>0?gdv2:gdvF),"Land Residual Value: "+fmt(Math.max(0,rlv)),"Build Cost: "+fmt(totalBuild),"S106/unit: "+(f.s106pu||0),"S106 Total: "+fmt(num(f.s106pu||0)*u),"Finance: "+(f.finRatePa||8)+"% pa","Sales Rate: "+(f.salesRateWeek||0.75)+"/wk","Programme: "+(f.programmeMths||36)+" months","Margin on GDV: "+pct(margin2),"IRR: "+(irrVal?irrVal+"%":"n/a"),"","NEXT STEP: Enter into the detailed Excel appraisal model.","Set land price to RLV. Run Normal Distribution cashflow.","Rebase BCIS build costs. Track RP offers."].join(nl);                var el=document.createElement("textarea");
                el.value=t;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);
                alert("Copied to clipboard — paste into your Excel appraisal model");
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
                {l:"Cassidy Dev Profit",v:fmt(devProfit),c:"#2D7A65",sub:"20% target on GDV"},
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
