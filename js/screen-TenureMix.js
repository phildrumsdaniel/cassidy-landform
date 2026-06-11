// ── renderTenureMix  (params: data, up, user)
// Lifted out of Tool; body byte-unchanged. Takes the Tool variables it uses as
// explicit params; all other names resolve to globals. Loaded before 05-tool.js.
function renderTenureMix(data, up, user){
    var t = data.tenure || {};
    function upt(k,v){ up("tenure",k,v); }

    var totalSchemeUnits = numOr(t.totalUnits,
      num(data.land&&data.land.units) ||
      num(data.planning&&data.planning.units) ||
      num(data.sfh&&data.sfh.totalUnits) ||
      num(data.hra&&data.hra.units) || 0);

    var basePsf = numOr(t.basePsf,
      num(data.sfh&&data.sfh.basePsf) ||
      num(data.rlv&&data.rlv.salePsf) || 350);

    var avgSqft = numOr(t.avgSqft,
      num(data.sfh&&data.sfh.avgSqft) || 900);

    var omsUnitPrice = numOr(t.omsUnitPrice, basePsf * avgSqft);
    var omsRentPa = numOr(t.omsRentPa, omsUnitPrice * 0.04);  // 4% gross yield default for rental tenures
    var inputMode = t.inputMode || "units";  // "units" or "percent"

    // Mix object — defaults to 100% OMS if empty
    var mix = t.mix || {oms: 100};

    // Compute totals for validation
    function computeTotals(){
      var totalPct = 0, totalUnits = 0;
      TENURE_TYPES.forEach(function(td){
        var v = num(mix[td.key]);
        if(inputMode === "units"){
          totalUnits += v;
          totalPct += totalSchemeUnits > 0 ? (v / totalSchemeUnits) * 100 : 0;
        } else {
          totalPct += v;
          totalUnits += totalSchemeUnits > 0 ? Math.round(totalSchemeUnits * v / 100) : 0;
        }
      });
      return {totalPct:totalPct, totalUnits:totalUnits};
    }
    var totals = computeTotals();
    var pctOk = Math.abs(totals.totalPct - 100) < 1;
    var unitsOk = Math.abs(totals.totalUnits - totalSchemeUnits) < 2;

    // Compute per-tenure values
    function tenureValue(td){
      var v = num(mix[td.key]);
      var unitsForTenure = inputMode === "units" ? v : (totalSchemeUnits * v / 100);
      // Pricing override
      var unitPriceKey = td.key + "_unitPrice";
      var defaultPrice = omsUnitPrice * td.pricingFactor;
      var unitPrice = num(t[unitPriceKey]) || defaultPrice;
      // For Shared Ownership: HA pays for full unit but takes both buyer-share sale + ongoing rent. Use 85% bulk.
      // For rental tenures (AR, SR, BTR): capital value = unit bulk price (HA/inst pays this and gets ongoing rent themselves)
      var capValue = unitsForTenure * unitPrice;
      // Ongoing rental income tracking (HA / BTR / SO retained portion)
      var rentPerUnit = num(t[td.key+"_rentPa"]) || (td.incomeType !== "capital" || (td.key==="ar"||td.key==="sr"||td.key==="btr") ? omsRentPa * (td.key==="sr" ? 0.6 : td.key==="ar" ? 0.8 : 1.0) : 0);
      return {
        td:td,
        units:unitsForTenure,
        unitPrice:unitPrice,
        capValue:capValue,
        rentPerUnit:rentPerUnit,
        annualRent:rentPerUnit * unitsForTenure,
        pct: totalSchemeUnits > 0 ? (unitsForTenure / totalSchemeUnits) * 100 : 0
      };
    }
    var rows = TENURE_TYPES.map(tenureValue).filter(function(r){ return r.units > 0; });
    var blendedGdv = rows.reduce(function(a,r){return a + r.capValue;}, 0);
    var annualIncome = rows.reduce(function(a,r){return a + r.annualRent;}, 0);
    var pureMarketGdv = totalSchemeUnits * omsUnitPrice;
    var tenureDiscount = pureMarketGdv > 0 ? (1 - blendedGdv/pureMarketGdv) * 100 : 0;

    // v9.32 — Removed the auto-writeback of blendedGdv that ran on every render.
    // That pattern caused: each render triggered setData(blendedGdv) → re-render
    // → recomputed blendedGdv with subtle floating-point differences → wrote
    // again → infinite churn. Other stages that need the blended GDV should
    // compute it on read using TENURE_TYPES + data.tenure.mix, NOT read
    // data.tenure.blendedGdv (which is now stale/intentionally not maintained).
    // The user's input fields persist normally via their own onChange handlers.

    // Styles
    var ipt = {width:"100%",padding:"8px 10px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:12,fontFamily:"DM Sans,sans-serif",color:"#2E2F8A",background:"#fff"};
    var lbl = {fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:3,display:"block"};

    function applyPreset(presetKey){
      var preset = TENURE_PRESETS[presetKey];
      if(!preset) return;
      upt("mix", Object.assign({}, preset.mix));
      upt("inputMode", "percent");
    }

    return e("div",null,
      // Header
      e("div",{style:{marginBottom:18}},
        e("div",{style:{fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:"#9A7B3E",marginBottom:6,fontWeight:700}},"Tenure Mix"),
        e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:6}},"Mix tenures across the scheme"),
        e("p",{style:{fontSize:12,color:"#7278A0",maxWidth:680,lineHeight:1.6}},"Set how units are split across Open Market, Affordable, Shared Ownership, BTR, First Homes etc. Each tenure has its own pricing rule and buyer type. Blended GDV flows through to RLV, Fin, and Exit Strategy.")
      ),
      LandReconciliationPanel(data, up),

      // Scheme totals + input toggle
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:18,marginBottom:14}},
        // v9.32 — Provenance note so user understands these defaults are SFH-derived
        e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:10,lineHeight:1.5,padding:"8px 10px",background:"#F8F9FC",borderLeft:"3px solid #4A4BAE",borderRadius:4}},
          e("strong",{style:{color:"#3A3D6A"}},"Auto-filled from SFH where empty. "),
          "Edit any field to override — your input is saved per-field. The fields below default from SFH House Mix on first visit; once you type a value here it persists independently."
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:14}},
          e("div",null,
            e("label",{style:lbl},"Total scheme units"),
            // v9.32 — Use explicit undefined check so user-entered 0 doesn't fall through to SFH default
            e("input",{type:"number",value:(t.totalUnits!==undefined&&t.totalUnits!=="")?t.totalUnits:(totalSchemeUnits||""),onChange:function(ev){upt("totalUnits",ev.target.value);},placeholder:String(totalSchemeUnits||"e.g. 100"),style:ipt})
          ),
          e("div",null,
            e("label",{style:lbl},"Avg unit sqft"),
            e("input",{type:"number",value:(t.avgSqft!==undefined&&t.avgSqft!=="")?t.avgSqft:(avgSqft||""),onChange:function(ev){upt("avgSqft",ev.target.value);},placeholder:String(avgSqft||"900"),style:ipt})
          ),
          e("div",null,
            e("label",{style:lbl},"Open Market PSF (£)"),
            e("input",{type:"number",value:(t.basePsf!==undefined&&t.basePsf!=="")?t.basePsf:(basePsf||""),onChange:function(ev){upt("basePsf",ev.target.value);},placeholder:String(basePsf||"350"),style:ipt})
          ),
          e("div",null,
            e("label",{style:lbl},"OMS unit price (calculated)"),
            e("input",{type:"number",value:(t.omsUnitPrice!==undefined&&t.omsUnitPrice!=="")?t.omsUnitPrice:Math.round(omsUnitPrice)||"",onChange:function(ev){upt("omsUnitPrice",ev.target.value);},placeholder:String(Math.round(omsUnitPrice)||"315000"),style:ipt})
          )
        ),
        // Mode toggle
        e("div",{style:{display:"flex",gap:10,alignItems:"center",paddingTop:10,borderTop:"1px solid #F0F1FA"}},
          e("div",{style:{fontSize:10,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700}},"Input mode:"),
          ["units","percent"].map(function(m){
            var picked = inputMode === m;
            return e("button",{key:m,onClick:function(){upt("inputMode",m);},style:{padding:"5px 12px",background:picked?"#4A4BAE":"#F7F8FC",color:picked?"#fff":"#3A3D6A",border:"1px solid "+(picked?"#4A4BAE":"#DDE0ED"),borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},m==="units"?"By Unit Count":"By Percentage");
          })
        )
      ),

      // Presets
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:18,marginBottom:14}},
        e("div",{style:{fontSize:10,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:10}},"Quick presets"),
        e("div",{style:{display:"flex",flexWrap:"wrap",gap:8}},
          Object.keys(TENURE_PRESETS).map(function(k){
            return e("button",{key:k,onClick:function(){applyPreset(k);},style:{padding:"7px 12px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#3A3D6A",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},TENURE_PRESETS[k].label);
          })
        )
      ),

      // The mix table
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:18,marginBottom:14,overflowX:"auto"}},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"1px solid #F0F1FA"}},
          e("h3",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Tenure mix breakdown"),
          // Live total
          inputMode==="units"
            ? e("div",{style:{fontSize:11,fontWeight:700,color:unitsOk?"#2D7A65":"#B05A35"}}, totals.totalUnits+" / "+totalSchemeUnits+" units allocated " + (unitsOk?"✓":"⚠"))
            : e("div",{style:{fontSize:11,fontWeight:700,color:pctOk?"#2D7A65":"#B05A35"}}, totals.totalPct.toFixed(1)+"% allocated " + (pctOk?"✓":"⚠"))
        ),

        e("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"DM Sans,sans-serif",minWidth:780}},
          e("thead",null,
            e("tr",{style:{background:"#F4F5FB"}},
              ["Tenure","Units / %","% of scheme","Unit price (£)","Capital value (£)","Rent £/unit pa","Buyer","Action"].map(function(h,i){
                return e("th",{key:i,style:{padding:"10px 8px",textAlign:i<=1?"left":"right",fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".05em",fontWeight:700,borderBottom:"2px solid #DDE0ED"}},h);
              })
            )
          ),
          e("tbody",null,
            TENURE_TYPES.map(function(td){
              var currentVal = num(mix[td.key]);
              var defaultPrice = Math.round(omsUnitPrice * td.pricingFactor);
              var unitPriceKey = td.key + "_unitPrice";
              var rentKey = td.key + "_rentPa";
              var rowData = tenureValue(td);
              var isActive = currentVal > 0;
              var buyerLabel = {
                individual:"Individual buyers", individual_ftb:"First-time buyers (local)", individual_llrd:"Landlord investor",
                ha_rp:"Housing Association", institutional:"Pension / BTR Op", council:"Local Authority"
              }[td.buyerType] || td.buyerType;
              return e("tr",{key:td.key,style:{borderBottom:"1px solid #F0F1FA",background:isActive?"rgba(45,122,101,0.03)":"transparent"}},
                // Tenure label
                e("td",{style:{padding:"8px",fontWeight:700,color:"#1E1F5C"}},
                  e("div",{style:{display:"flex",alignItems:"center",gap:6}},
                    e("span",{style:{fontSize:18}},td.icon),
                    e("div",null,
                      e("div",{style:{fontSize:11}},td.label),
                      e("div",{style:{fontSize:9,color:"#7278A0"}},td.short+" · " + Math.round(td.pricingFactor*100) + "% of OMS")
                    )
                  )
                ),
                // Units or % input
                e("td",{style:{padding:"8px",textAlign:"right"}},
                  e("input",{type:"number",value:currentVal||"",onChange:function(ev){
                    var nm = Object.assign({},mix);
                    nm[td.key] = parseFloat(ev.target.value)||0;
                    upt("mix",nm);
                  },placeholder:"0",style:{width:70,padding:"5px 6px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:11,textAlign:"right",fontFamily:"DM Sans,sans-serif"}})
                ),
                // % of scheme
                e("td",{style:{padding:"8px",textAlign:"right",color:"#7278A0",fontSize:11}}, rowData.pct>0?rowData.pct.toFixed(1)+"%":"—"),
                // Unit price override
                e("td",{style:{padding:"8px",textAlign:"right"}},
                  e("input",{type:"number",value:t[unitPriceKey]||"",onChange:function(ev){upt(unitPriceKey,ev.target.value);},placeholder:defaultPrice.toLocaleString(),style:{width:90,padding:"5px 6px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:11,textAlign:"right",fontFamily:"DM Sans,sans-serif",background:t[unitPriceKey]?"#fff":"#FBFBFE"}})
                ),
                // Capital value
                e("td",{style:{padding:"8px",textAlign:"right",fontWeight:700,color:rowData.capValue>0?"#2D7A65":"#C0C4D8"}}, rowData.capValue>0?fmt(rowData.capValue):"—"),
                // Rent per unit pa
                e("td",{style:{padding:"8px",textAlign:"right"}},
                  isActive && (td.key==="ar"||td.key==="sr"||td.key==="btr"||td.key==="so") ?
                    e("input",{type:"number",value:t[rentKey]||"",onChange:function(ev){upt(rentKey,ev.target.value);},placeholder:Math.round(rowData.rentPerUnit).toLocaleString(),style:{width:80,padding:"5px 6px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:11,textAlign:"right",fontFamily:"DM Sans,sans-serif",background:t[rentKey]?"#fff":"#FBFBFE"}})
                    : e("span",{style:{color:"#C0C4D8",fontSize:10}},"n/a")
                ),
                // Buyer
                e("td",{style:{padding:"8px",textAlign:"right",fontSize:10,color:"#7278A0"}}, buyerLabel),
                // Quick clear
                e("td",{style:{padding:"8px",textAlign:"right"}},
                  isActive && e("button",{onClick:function(){
                    var nm = Object.assign({},mix);
                    delete nm[td.key];
                    delete t[unitPriceKey];
                    delete t[rentKey];
                    upt("mix",nm);
                  },style:{padding:"3px 8px",background:"#FFF5F0",border:"1px solid #E8C4B0",color:"#B05A35",borderRadius:3,fontSize:10,cursor:"pointer"}},"Clear")
                )
              );
            })
          )
        )
      ),

      // Validation warning
      ((inputMode==="units" && !unitsOk) || (inputMode==="percent" && !pctOk)) && rows.length>0 && e("div",{style:{padding:"10px 14px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:6,fontSize:11,color:"#B05A35",marginBottom:14,lineHeight:1.6}},
        "⚠ ",inputMode==="units" ? "Allocated units ("+totals.totalUnits+") don't match scheme total ("+totalSchemeUnits+"). Adjust until they match." : "Percentages add up to "+totals.totalPct.toFixed(1)+"%, not 100%. Adjust until they total 100%."
      ),

      // Blended results card
      rows.length > 0 && blendedGdv > 0 && e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",color:"#fff",borderRadius:10,padding:24,marginBottom:14}},
        e("div",{style:{fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:"#EDE84A",marginBottom:6,fontWeight:700}},"Blended Scheme Result"),
        e("h3",{style:{fontSize:20,fontWeight:800,marginBottom:14}},"Mixed-tenure economics"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:14}},
          e("div",null,
            e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Blended GDV"),
            e("div",{style:{fontSize:22,fontWeight:800,color:"#fff"}},fmt(blendedGdv))
          ),
          e("div",null,
            e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Pure-OMS GDV"),
            e("div",{style:{fontSize:18,fontWeight:700,color:"rgba(255,255,255,0.6)"}},fmt(pureMarketGdv))
          ),
          e("div",null,
            e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Tenure Discount"),
            e("div",{style:{fontSize:18,fontWeight:700,color:tenureDiscount>0?"#EDE84A":"#fff"}},tenureDiscount>0?"-"+tenureDiscount.toFixed(1)+"%":"none")
          ),
          annualIncome > 0 && e("div",null,
            e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Annual Rent (HA/BTR/SO)"),
            e("div",{style:{fontSize:18,fontWeight:700,color:"#fff"}},fmt(annualIncome))
          )
        ),
        // Tenure breakdown stack visualization
        e("div",{style:{marginTop:18,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.15)"}},
          e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:8}},"Unit breakdown"),
          e("div",{style:{display:"flex",height:8,borderRadius:4,overflow:"hidden",background:"rgba(255,255,255,0.1)"}},
            rows.map(function(r,i){
              var colors = ["#EDE84A","#2D7A65","#9A7B3E","#B05A35","#4A4BAE","#6E70C8","#A4A6E0","#C9CBED","#E0E2F4","#F0F1FA"];
              return e("div",{key:r.td.key,title:r.td.label+" — "+Math.round(r.units)+" units",style:{width:(r.pct||0)+"%",background:colors[i%colors.length]}});
            })
          ),
          e("div",{style:{display:"flex",flexWrap:"wrap",gap:14,marginTop:10,fontSize:10}},
            rows.map(function(r,i){
              var colors = ["#EDE84A","#2D7A65","#9A7B3E","#B05A35","#4A4BAE","#6E70C8","#A4A6E0","#C9CBED","#E0E2F4","#F0F1FA"];
              return e("div",{key:r.td.key,style:{display:"flex",alignItems:"center",gap:5,color:"rgba(255,255,255,0.85)"}},
                e("div",{style:{width:9,height:9,background:colors[i%colors.length],borderRadius:2}}),
                e("span",null,r.td.short+" "+Math.round(r.units))
              );
            })
          )
        )
      ),

      // Multi-buyer exit roadmap (auto-generated from mix)
      rows.length > 0 && e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:18,marginBottom:14}},
        e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:10,borderBottom:"1px solid #F0F1FA"}},
          e("h3",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Multi-buyer exit roadmap")
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:12}},
          // Group rows by buyer type
          (function(){
            var groups = {};
            rows.forEach(function(r){
              var k = r.td.buyerType;
              if(!groups[k]) groups[k] = {label:"",units:0,value:0,tenures:[]};
              groups[k].units += r.units;
              groups[k].value += r.capValue;
              groups[k].tenures.push(r);
            });
            var groupLabels = {
              individual:"🏠 Open Market Sales",
              individual_ftb:"🥇 First Homes (FTB)",
              individual_llrd:"🔑 PRS Landlords",
              ha_rp:"🏛 Housing Association",
              institutional:"🏢 Institutional (Pension / BTR Op)",
              council:"♻ Council / LA"
            };
            return Object.keys(groups).map(function(k){
              var g = groups[k];
              var notes = {
                individual:"18-30mo sales runoff. Multiple sales channels: agents, off-plan, Help-to-Buy.",
                individual_ftb:"Local FTB only, income-capped (S106). Re-sale restrictions apply.",
                individual_llrd:"1-10 unit buyers. Smaller cheques than BTR. Yield-driven.",
                ha_rp:"Bulk sale to RP (Clarion, Sanctuary, Bromford etc). 4-6mo legal timeline.",
                institutional:"Forward-fund or stabilised. Pension fund / Grainger / Quintain. 6-9mo.",
                council:"Local authority repurchase. Discount but reliable counterparty."
              };
              return e("div",{key:k,style:{padding:14,background:"#F7F8FC",borderRadius:8,borderLeft:"4px solid #4A4BAE"}},
                e("div",{style:{fontSize:12,fontWeight:800,color:"#1E1F5C",marginBottom:6}}, groupLabels[k] || k),
                e("div",{style:{fontSize:11,color:"#2E2F8A",marginBottom:6}}, Math.round(g.units)+" units · "+fmt(g.value)),
                e("div",{style:{fontSize:9,color:"#9A7B3E",marginBottom:6,fontWeight:600}},
                  g.tenures.map(function(t){return t.td.short+" "+Math.round(t.units);}).join(" · ")
                ),
                e("div",{style:{fontSize:10,color:"#7278A0",lineHeight:1.6}}, notes[k] || "")
              );
            });
          })()
        )
      ),

      // AI insight
      rows.length > 0 && blendedGdv > 0 && e(AIPanel,{user:user,up:up,stage:"tenure",data:data,persistKey:"tenure_strategy",label:"Tenure Strategy Analysis",
        prompt:buildHonestPrompt(data,"Mixed-tenure scheme analysis. Total "+totalSchemeUnits+" units. Blended GDV "+fmt(blendedGdv)+" ("+tenureDiscount.toFixed(1)+"% below pure-OMS GDV of "+fmt(pureMarketGdv)+"). " +
          "Tenure breakdown: " + rows.map(function(r){return Math.round(r.units)+" "+r.td.short+" at "+fmt(r.unitPrice)+"/unit";}).join(", ") + ". " +
          "Provide: 1) Strategic assessment of this mix vs typical UK planning policy / S106 requirements, " +
          "2) Specific HA partners likely to bid on the affordable portion (real UK RPs by region), " +
          "3) Institutional buyers active in this scale/region, " +
          "4) Cashflow timing implications (HA bulk sales early, OMS spread over 18-30mo, BTR forward-fund vs stabilised), " +
          "5) Risk factors specific to mixed-tenure (HA negotiation, S106 compliance, FTB pipeline, etc). UK 2026 market. 250 words plain text."
      )})
    );
  }
