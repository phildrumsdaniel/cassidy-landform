// ── renderAssetOptimiser  (params: data, up, user)
// Lifted out of Tool; body byte-unchanged. Takes the Tool variables it uses as
// explicit params; all other names resolve to globals. Loaded before 05-tool.js.
function renderAssetOptimiser(data, up, user){
    var o = data.optimiser || {};
    function upo(k,v){ up("optimiser",k,v); }

    // Resolve defaults
    var assetType = o.assetType || "pbsa";
    var assetDef = ASSET_TYPES.find(function(a){return a.key===assetType;}) || ASSET_TYPES[0];
    var location = o.location || "regional";  // "prime" | "regional"
    var yieldBand = (SECTOR_YIELDS[assetType] && SECTOR_YIELDS[assetType][location]) || [6,8];
    var yieldMid = (yieldBand[0]+yieldBand[1])/2;
    var ownerPriority = o.priority || "irr";  // "cash" | "irr" | "strategic" | "risk_off"

    // Input values
    var costBase    = num(o.costBase);       // total dev cost incurred
    var existingDebt= num(o.existingDebt);
    var debtRate    = numOr(o.debtRate, 7.0);
    var stabilNOI   = num(o.stabilisedNOI);  // pa
    var currentNOI  = num(o.currentNOI||0);  // pa, today
    var monthsToStabil = num(o.monthsToStabil||0);

    // If user hasn't entered NOI directly, try to derive from rents
    if(stabilNOI===0){
      if(assetType==="pbsa" && o.beds && o.rentPerBedPw){
        var grossPbsa = num(o.beds)*num(o.rentPerBedPw)*51;  // PBSA = 51-week tenancies typical
        var opexPbsa  = numOr(o.opexPct, 25);
        stabilNOI = grossPbsa * (1-opexPbsa/100);
      }
      if(assetType==="btr" && o.units && o.rentPerUnitPcm){
        var grossBtr = num(o.units)*num(o.rentPerUnitPcm)*12;
        var opexBtr  = numOr(o.opexPct, 25);
        stabilNOI = grossBtr * (1-opexBtr/100);
      }
      if((assetType==="industrial"||assetType==="office"||assetType==="retail") && o.sqft && o.rentPsfPa){
        var grossCom = num(o.sqft)*num(o.rentPsfPa);
        var opexCom  = numOr(o.opexPct, 10);  // commercial is FRI typically, low landlord costs
        stabilNOI = grossCom * (1-opexCom/100);
      }
    }

    // Helper: compute capital value at a given yield + NOI
    function capVal(noi, yld){
      if(!noi || !yld) return 0;
      return noi / (yld/100);
    }

    // Get the viable exits for this asset type
    var viableExitKeys = ASSET_EXIT_FIT[assetType] || ASSET_EXIT_FIT.other;
    var viableExits = viableExitKeys.map(function(k){
      return EXIT_ROUTES.find(function(x){return x.key===k;});
    }).filter(Boolean);

    // Compute each exit route's outputs
    function computeExit(ex){
      var yld;
      var noiUsed = stabilNOI > 0 ? stabilNOI : currentNOI;
      var headline = 0;
      var notes = [];

      // Most exits = capital value based on NOI + yield + bias
      if(["pension","sovereign","reit","family","btr_op","ha_rp","homes_eng","industrial_inv","trade_buyer","hotel_op","sale_leaseback","pubco"].indexOf(ex.key)>=0){
        yld = Math.max(2, yieldMid + ex.yieldBias);
        // Forward-fund discount
        if(monthsToStabil > 6 && ex.key !== "forward_fund") yld += 0.25;
        // Care/HA buyers discount
        headline = capVal(noiUsed, yld);
        if(headline === 0) notes.push("Need NOI to value");
      }
      else if(ex.key === "forward_fund"){
        yld = Math.max(2, yieldMid + 0.50);  // forward-fund pricier
        headline = capVal(stabilNOI || noiUsed, yld) * 0.93;  // 7% discount for pre-completion risk
        if(headline > 0) notes.push("7% risk discount applied");
        else notes.push("Need projected stabilised NOI");
      }
      else if(ex.key === "open_mkt"){
        // Open market = sum of individual residential sales
        if(assetType==="residential" || assetType==="sfh_portfolio"){
          headline = num(o.estGdvOpenMkt) || (noiUsed > 0 ? capVal(noiUsed, 4.0) : 0);
          notes.push("Per-unit retail sale; 18-30mo run-off");
        } else {
          headline = 0;
          notes.push("Not typically applicable");
        }
      }
      else if(ex.key === "bank_takeout"){
        // Refi: typically 55-65% LTV on stabilised value, you keep asset
        yld = Math.max(2, yieldMid + 0.10);
        var marketVal = capVal(noiUsed, yld);
        var ltv = numOr(o.refiLtv, 60) / 100;
        var newDebt = marketVal * ltv;
        var equityReleased = newDebt - existingDebt;
        headline = Math.max(0, equityReleased);
        notes.push(Math.round(ltv*100)+"% LTV on £"+(marketVal/1000000).toFixed(1)+"m market val");
      }
      else if(ex.key === "hold"){
        // Hold = NOI continues. Show 10-year cumulative NOI as comparative figure.
        headline = noiUsed * 10;  // 10-year cumulative
        notes.push("10-year cumulative NOI (no sale)");
      }
      else if(ex.key === "change_use"){
        // Change of use to higher value class — placeholder estimate
        headline = num(o.estGdvChangeUse) || (costBase * 1.5);
        notes.push("Estimate — requires planning + redevelopment");
      }

      // Net to seller (after debt and selling costs)
      var sellingCosts = headline * 0.012;  // ~1.2% agent + legal
      var net = ex.key === "bank_takeout" ? headline  // already net (equity released)
               : ex.key === "hold" ? noiUsed*10        // cumulative NOI
               : headline - existingDebt - sellingCosts;

      // Profit on cost
      var profitOnCost = costBase > 0 ? ((headline - costBase - existingDebt*0.05) / costBase) * 100 : 0;

      // IRR proxy: simple — for hold, calc on equity invested
      var equityIn = Math.max(1, costBase - existingDebt);
      var simpleIrr;
      if(ex.key === "hold") {
        simpleIrr = (noiUsed - existingDebt*debtRate/100) / equityIn * 100;
      } else if(ex.key === "bank_takeout") {
        simpleIrr = headline > 0 ? (headline / equityIn) * 100 / 1 : 0;  // immediate equity return
      } else {
        // Single exit IRR proxy = total return / equity / years
        var years = (monthsToStabil + 6) / 12;
        years = Math.max(0.5, years);
        simpleIrr = (net / equityIn - 1) * 100 / years;
      }

      return {
        ex:ex,
        yld:yld||0,
        headline:headline,
        net:net,
        sellingCosts:sellingCosts,
        profitOnCost:profitOnCost,
        simpleIrr:simpleIrr,
        notes:notes
      };
    }

    var results = viableExits.map(computeExit);

    // Score each exit based on user's priority
    results.forEach(function(r){
      var score = 0;
      if(ownerPriority === "cash") {
        // Cash now — favour speed + net £
        score = r.net/1000000 + (r.ex.timeMonths.indexOf("ongoing")>=0?-20:0);
      } else if(ownerPriority === "irr"){
        score = r.simpleIrr;
      } else if(ownerPriority === "strategic"){
        score = r.net/1000000 + (r.ex.key==="trade_buyer"?15:0) + (r.ex.key==="family"?10:0);
      } else if(ownerPriority === "risk_off"){
        score = r.net/1000000 + (r.ex.key==="pension"?15:0) + (r.ex.key==="sovereign"?15:0) + (r.ex.key==="hold"?-10:0);
      }
      r.score = score;
    });
    var sorted = results.slice().sort(function(a,b){return b.score-a.score;});
    var bestExit = sorted[0];
    var secondExit = sorted[1];

    // Equity at risk
    var equityIn = Math.max(0, costBase - existingDebt);

    // Card styles
    var ipt = {width:"100%",padding:"8px 10px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:12,fontFamily:"DM Sans,sans-serif",color:"#2E2F8A",background:"#fff"};
    var lbl = {fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:3,display:"block"};

    return e("div",null,
      // Header
      e("div",{style:{marginBottom:18}},
        e("div",{style:{fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:"#9A7B3E",marginBottom:6,fontWeight:700}},"Asset Exit Optimiser"),
        e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:6}},"Optimise exit on your existing asset"),
        e("p",{style:{fontSize:12,color:"#7278A0",maxWidth:680,lineHeight:1.6}},"For assets you already own or are about to complete. Enter asset profile + income, see every viable exit route compared side-by-side with our recommendation. No planning, no land appraisal — just the optimal way out.")
      ),

      // ── SECTION 1: ASSET PROFILE ───────────────────────────────────────
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:18,marginBottom:14}},
        e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:10,borderBottom:"1px solid #F0F1FA"}},
          e("div",{style:{width:24,height:24,borderRadius:"50%",background:"#9A7B3E",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12}},"1"),
          e("h3",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Asset Profile")
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}},
          e("div",null,
            e("label",{style:lbl},"Asset Type"),
            e("select",{value:assetType,onChange:function(ev){upo("assetType",ev.target.value);},style:ipt},
              ASSET_TYPES.map(function(a){return e("option",{key:a.key,value:a.key},a.icon+" "+a.label);})
            )
          ),
          e("div",null,
            e("label",{style:lbl},"Location Tier"),
            e("select",{value:location,onChange:function(ev){upo("location",ev.target.value);},style:ipt},
              e("option",{value:"prime"},"Prime (London / RG cities / Tier 1)"),
              e("option",{value:"regional"},"Regional / Secondary")
            )
          ),
          e("div",null,
            e("label",{style:lbl},"Asset Name / Address"),
            e("input",{value:o.assetName||"",onChange:function(ev){upo("assetName",ev.target.value);},placeholder:"e.g. The Granary, Bristol",style:ipt})
          ),
          e("div",null,
            e("label",{style:lbl},"Status"),
            e("select",{value:o.status||"operating",onChange:function(ev){upo("status",ev.target.value);},style:ipt},
              e("option",{value:"completing"},"Completing (opens within 6mo)"),
              e("option",{value:"lease_up"},"In lease-up (under stabilisation)"),
              e("option",{value:"operating"},"Operating + stabilised"),
              e("option",{value:"recently_done"},"Recently completed")
            )
          ),
          e("div",null,
            e("label",{style:lbl},"Months to Stabilisation"),
            e("input",{type:"number",value:o.monthsToStabil||"",onChange:function(ev){upo("monthsToStabil",ev.target.value);},placeholder:"0 if already stabilised",style:ipt})
          ),
          e("div",null,
            e("label",{style:lbl},"Total Dev Cost Incurred (£)"),
            e("input",{type:"number",value:o.costBase||"",onChange:function(ev){upo("costBase",ev.target.value);},placeholder:"e.g. 22000000",style:ipt})
          ),
          e("div",null,
            e("label",{style:lbl},"Existing Debt (£)"),
            e("input",{type:"number",value:o.existingDebt||"",onChange:function(ev){upo("existingDebt",ev.target.value);},placeholder:"Current outstanding facility",style:ipt})
          ),
          e("div",null,
            e("label",{style:lbl},"Debt Rate %"),
            e("input",{type:"number",value:o.debtRate||"",onChange:function(ev){upo("debtRate",ev.target.value);},placeholder:"7.0",style:ipt})
          )
        )
      ),

      // ── SECTION 2: INCOME ─────────────────────────────────────────────
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:18,marginBottom:14}},
        e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:10,borderBottom:"1px solid #F0F1FA"}},
          e("div",{style:{width:24,height:24,borderRadius:"50%",background:"#2D7A65",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12}},"2"),
          e("h3",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Income & Operating ("+assetDef.label+")")
        ),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14,lineHeight:1.6}},"Enter either the unit-level income (and we'll calculate NOI) OR a stabilised NOI directly. Asset-specific fields appear based on the type you picked."),

        // Block mix toggle — only shown for PBSA / BTR / Mixed (where a single block can blend uses)
        (assetType==="pbsa" || assetType==="btr" || assetType==="mixed") && e("div",{style:{padding:"10px 14px",background:o.blockMixOn?"rgba(45,122,101,0.06)":"#F8F8FE",border:"1px solid "+(o.blockMixOn?"rgba(45,122,101,0.3)":"#DDE0ED"),borderRadius:6,marginBottom:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}},
          e("label",{style:{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontWeight:700,fontSize:12,color:"#2E2F8A"}},
            e("input",{type:"checkbox",checked:!!o.blockMixOn,onChange:function(ev){upo("blockMixOn",ev.target.checked);},style:{width:16,height:16,cursor:"pointer"}}),
            "Block contains a mix of accommodation types"
          ),
          e("span",{style:{fontSize:10,color:"#7278A0",flex:"1 1 200px"}},"Toggle on if this single block blends Student PBSA + Key Worker + BTR + Affordable etc. The blended NOI flows to the exit comparison and the optimiser will surface split-sale opportunities.")
        ),

        // ── BLOCK ACCOMMODATION MIX (when toggle ON) ──
        (assetType==="pbsa" || assetType==="btr" || assetType==="mixed") && o.blockMixOn && (function(){
          // Define the accommodation components available in a block
          var BLOCK_COMPONENTS = [
            {key:"pbsa",      label:"🎓 Student (PBSA)",      rentUnit:"per bed/week",  weeks:51, occDefault:95, opexDefault:25, yieldHint:5.50, buyer:"PBSA fund / student investor"},
            {key:"kw",        label:"🏥 Key Worker",          rentUnit:"per unit pcm",  weeks:12, occDefault:96, opexDefault:22, yieldHint:5.00, buyer:"BTR fund / NHS / Council"},
            {key:"btr",       label:"🏢 BTR (market rent)",   rentUnit:"per unit pcm",  weeks:12, occDefault:95, opexDefault:25, yieldHint:4.50, buyer:"Pension / BTR operator"},
            {key:"prs",       label:"🔑 PRS (single AST)",    rentUnit:"per unit pcm",  weeks:12, occDefault:94, opexDefault:25, yieldHint:5.25, buyer:"Landlord investor"},
            {key:"ar",        label:"🏛 Affordable Rent",     rentUnit:"per unit pcm",  weeks:12, occDefault:98, opexDefault:18, yieldHint:5.50, buyer:"Housing Association"},
            {key:"so",        label:"🤝 Shared Ownership",    rentUnit:"per unit pcm (on retained share)", weeks:12, occDefault:98, opexDefault:15, yieldHint:5.50, buyer:"Housing Association"},
            {key:"commercial",label:"🛍 Commercial (G/F)",    rentUnit:"per sqft pa",   weeks:1,  occDefault:90, opexDefault:10, yieldHint:6.50, buyer:"Property investor"}
          ];

          var mix = o.blockMix || {};
          function setComp(compKey, field, val){
            var m = Object.assign({}, mix);
            m[compKey] = Object.assign({}, m[compKey]||{});
            m[compKey][field] = val;
            upo("blockMix", m);
          }
          function clearComp(compKey){
            var m = Object.assign({}, mix);
            delete m[compKey];
            upo("blockMix", m);
          }

          // Compute NOI for each active component
          function compNOI(comp){
            var cd = mix[comp.key];
            if(!cd) return {gross:0,noi:0,units:0};
            var count = num(cd.count);
            var rent = num(cd.rent);
            var occ = numOr(cd.occ, comp.occDefault) / 100;
            var opex = numOr(cd.opex, comp.opexDefault) / 100;
            var gross = 0;
            if(comp.key==="pbsa"){
              gross = count * rent * (num(cd.weeks)||comp.weeks);
            } else if(comp.key==="commercial"){
              gross = count * rent;  // count = sqft, rent = £/sqft pa
            } else {
              gross = count * rent * 12;
            }
            gross *= occ;
            var noi = gross * (1 - opex);
            return {gross:gross, noi:noi, units:count};
          }

          var rowsActive = BLOCK_COMPONENTS.filter(function(c){return mix[c.key] && num(mix[c.key].count)>0;});
          var blendedNoi = 0;
          var totalBeds = 0;
          rowsActive.forEach(function(c){
            var r = compNOI(c);
            blendedNoi += r.noi;
            if(c.key !== "commercial") totalBeds += r.units;
          });

          // Push blended NOI back to main NOI field so exit comparison uses it
          if(blendedNoi > 0 && Math.abs(blendedNoi - num(o.stabilisedNOI)) > 100){
            upo("stabilisedNOI", Math.round(blendedNoi));
          }

          return e("div",null,
            e("div",{style:{fontSize:10,color:"#9A7B3E",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:8}},"Block accommodation mix"),

            e("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"DM Sans,sans-serif",marginBottom:14,minWidth:780}},
              e("thead",null,
                e("tr",{style:{background:"#F4F5FB"}},
                  ["Component","Count","Rent","Occ %","Opex %","Gross pa","NOI pa","Action"].map(function(h,i){
                    return e("th",{key:i,style:{padding:"9px 8px",textAlign:i===0?"left":"right",fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".05em",fontWeight:700,borderBottom:"2px solid #DDE0ED"}},h);
                  })
                )
              ),
              e("tbody",null,
                BLOCK_COMPONENTS.map(function(comp){
                  var cd = mix[comp.key] || {};
                  var active = num(cd.count) > 0;
                  var r = compNOI(comp);
                  return e("tr",{key:comp.key,style:{borderBottom:"1px solid #F0F1FA",background:active?"rgba(45,122,101,0.03)":"transparent"}},
                    // Component
                    e("td",{style:{padding:"8px"}},
                      e("div",{style:{fontWeight:700,color:"#1E1F5C",fontSize:11}},comp.label),
                      e("div",{style:{fontSize:9,color:"#7278A0",marginTop:1}}, comp.rentUnit)
                    ),
                    // Count
                    e("td",{style:{padding:"8px",textAlign:"right"}},
                      e("input",{type:"number",value:cd.count||"",onChange:function(ev){setComp(comp.key,"count",ev.target.value);},placeholder:comp.key==="commercial"?"sqft":"units",style:{width:70,padding:"5px 6px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:11,textAlign:"right",fontFamily:"DM Sans,sans-serif"}})
                    ),
                    // Rent
                    e("td",{style:{padding:"8px",textAlign:"right"}},
                      e("input",{type:"number",value:cd.rent||"",onChange:function(ev){setComp(comp.key,"rent",ev.target.value);},placeholder:comp.key==="pbsa"?"175":comp.key==="kw"?"950":comp.key==="btr"?"1250":comp.key==="commercial"?"28":"1100",style:{width:70,padding:"5px 6px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:11,textAlign:"right",fontFamily:"DM Sans,sans-serif"}})
                    ),
                    // Occ
                    e("td",{style:{padding:"8px",textAlign:"right"}},
                      e("input",{type:"number",value:cd.occ||"",onChange:function(ev){setComp(comp.key,"occ",ev.target.value);},placeholder:String(comp.occDefault),style:{width:55,padding:"5px 6px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:11,textAlign:"right",fontFamily:"DM Sans,sans-serif"}})
                    ),
                    // Opex
                    e("td",{style:{padding:"8px",textAlign:"right"}},
                      e("input",{type:"number",value:cd.opex||"",onChange:function(ev){setComp(comp.key,"opex",ev.target.value);},placeholder:String(comp.opexDefault),style:{width:55,padding:"5px 6px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:11,textAlign:"right",fontFamily:"DM Sans,sans-serif"}})
                    ),
                    // Gross
                    e("td",{style:{padding:"8px",textAlign:"right",color:active?"#3A3D6A":"#C0C4D8",fontSize:11}}, r.gross>0?fmt(r.gross):"—"),
                    // NOI
                    e("td",{style:{padding:"8px",textAlign:"right",fontWeight:700,color:active?"#2D7A65":"#C0C4D8"}}, r.noi>0?fmt(r.noi):"—"),
                    // Action
                    e("td",{style:{padding:"8px",textAlign:"right"}},
                      active && e("button",{onClick:function(){clearComp(comp.key);},style:{padding:"3px 8px",background:"#FFF5F0",border:"1px solid #E8C4B0",color:"#B05A35",borderRadius:3,fontSize:10,cursor:"pointer"}},"Clear")
                    )
                  );
                })
              )
            ),

            // Blended summary
            rowsActive.length > 0 && e("div",{style:{padding:"12px 14px",background:"linear-gradient(135deg,rgba(45,122,101,0.08),rgba(74,75,174,0.05))",border:"1px solid rgba(45,122,101,0.3)",borderRadius:6,fontSize:11,color:"#2D7A65",lineHeight:1.7,marginBottom:8}},
              e("div",{style:{fontSize:9,letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4,color:"#9A7B3E"}},"Blended block result"),
              e("strong",{style:{fontSize:14,color:"#1E1F5C"}},"Total NOI: "+fmt(blendedNoi)+"/yr"),
              " · ",rowsActive.length+" income stream"+(rowsActive.length>1?"s":""),
              " · ",rowsActive.map(function(c){return num(mix[c.key].count)+" "+c.label.replace(/^[^\s]+\s/,"");}).join(" + ")
            ),

            // Insight: split-sale opportunity
            rowsActive.length >= 2 && (function(){
              var splitVal = 0;
              rowsActive.forEach(function(c){
                var r = compNOI(c);
                splitVal += r.noi / (c.yieldHint/100);
              });
              var blendedYield = yieldMid;
              var singleSaleVal = blendedNoi / (blendedYield/100);
              var splitUplift = splitVal - singleSaleVal;
              var splitUpliftPct = singleSaleVal > 0 ? (splitUplift/singleSaleVal)*100 : 0;
              if(Math.abs(splitUpliftPct) < 0.5) return null;  // not material
              return e("div",{style:{padding:"12px 14px",background:splitUplift>0?"rgba(237,232,74,0.15)":"rgba(176,90,53,0.08)",border:"1px solid "+(splitUplift>0?"#9A7B3E":"#E8C4B0"),borderRadius:6,fontSize:11,lineHeight:1.7,color:splitUplift>0?"#9A7B3E":"#B05A35"}},
                e("div",{style:{fontSize:9,letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},splitUplift>0?"💡 Split-sale opportunity":"⚠ Single sale preferred"),
                splitUplift>0
                  ? e("span",null,"Splitting the sale across "+rowsActive.length+" buyers could realise approximately ",e("strong",null,fmt(splitVal))," vs ",fmt(singleSaleVal)," as one combined sale — uplift of ",e("strong",null,fmt(splitUplift)+" ("+splitUpliftPct.toFixed(1)+"%)"),". Add ~3-4 months timeline for parallel processes. See Exit Comparison below for buyer-specific routes.")
                  : e("span",null,"Single-buyer sale of the whole block (",fmt(singleSaleVal),") is likely more efficient than splitting (",fmt(splitVal),") — savings on legals + faster close.")
              );
            })()
          );
        })(),

        // PBSA-specific inputs (only when block mix is OFF)
        assetType==="pbsa" && !o.blockMixOn && e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:12}},
          e("div",null,e("label",{style:lbl},"Total Beds"),e("input",{type:"number",value:o.beds||"",onChange:function(ev){upo("beds",ev.target.value);},placeholder:"e.g. 240",style:ipt})),
          e("div",null,e("label",{style:lbl},"Rent per Bed/Week (£)"),e("input",{type:"number",value:o.rentPerBedPw||"",onChange:function(ev){upo("rentPerBedPw",ev.target.value);},placeholder:"e.g. 175",style:ipt})),
          e("div",null,e("label",{style:lbl},"Opex %"),e("input",{type:"number",value:o.opexPct||"",onChange:function(ev){upo("opexPct",ev.target.value);},placeholder:"25",style:ipt}))
        ),

        // BTR-specific (only when block mix is OFF)
        assetType==="btr" && !o.blockMixOn && e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:12}},
          e("div",null,e("label",{style:lbl},"Total Units"),e("input",{type:"number",value:o.units||"",onChange:function(ev){upo("units",ev.target.value);},placeholder:"e.g. 200",style:ipt})),
          e("div",null,e("label",{style:lbl},"Avg Rent per Unit pcm (£)"),e("input",{type:"number",value:o.rentPerUnitPcm||"",onChange:function(ev){upo("rentPerUnitPcm",ev.target.value);},placeholder:"e.g. 1450",style:ipt})),
          e("div",null,e("label",{style:lbl},"Opex %"),e("input",{type:"number",value:o.opexPct||"",onChange:function(ev){upo("opexPct",ev.target.value);},placeholder:"25",style:ipt}))
        ),

        // Industrial/Office/Retail
        (assetType==="industrial" || assetType==="office" || assetType==="retail") && e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:12}},
          e("div",null,e("label",{style:lbl},"Sqft (lettable)"),e("input",{type:"number",value:o.sqft||"",onChange:function(ev){upo("sqft",ev.target.value);},placeholder:"e.g. 80000",style:ipt})),
          e("div",null,e("label",{style:lbl},"Rent £/sqft pa"),e("input",{type:"number",value:o.rentPsfPa||"",onChange:function(ev){upo("rentPsfPa",ev.target.value);},placeholder:assetType==="industrial"?"14":assetType==="office"?"30":"50",style:ipt})),
          e("div",null,e("label",{style:lbl},"Opex %"),e("input",{type:"number",value:o.opexPct||"",onChange:function(ev){upo("opexPct",ev.target.value);},placeholder:"10",style:ipt}))
        ),

        // Residential (single house/flat) — comparable-based, not yield-based
        assetType==="residential" && (function(){
          var pc=(o.postcode||"").toUpperCase().replace(/\s+/g,"");
          var lrData=o.lrData;
          var lrLoading=o.lrLoading;
          var lrError=o.lrError;

          // Auto-trigger LR fetch when postcode is valid + we don't already have data
          if(pc && pc.length>=5 && !lrData && !lrLoading && !lrError && !o.lrTriggered){
            var match=pc.match(/^([A-Z]{1,2})(\d{1,2}[A-Z]?)(\d)([A-Z]{2})$/);
            if(match){
              var district=match[1]+match[2];
              upo("lrTriggered",true);
              upo("lrLoading",true);
              var sparql="PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/> "+
                "PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/> "+
                "PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> "+
                "SELECT ?paon ?street ?town ?postcode ?amount ?date ?typeUri WHERE { "+
                "?addr lrcommon:postcode ?postcode . "+
                "FILTER(STRSTARTS(?postcode, \""+district+"\")) "+
                "?t lrppi:propertyAddress ?addr ; lrppi:pricePaid ?amount ; lrppi:transactionDate ?date ; lrppi:propertyType ?typeUri . "+
                "OPTIONAL{?addr lrcommon:paon ?paon} OPTIONAL{?addr lrcommon:street ?street} OPTIONAL{?addr lrcommon:town ?town} "+
                "FILTER(?date >= \"2022-01-01\"^^xsd:date) "+
                "} ORDER BY DESC(?date) LIMIT 50";
              var lrTimeout=setTimeout(function(){
                upo("lrLoading",false);
                upo("lrError","Land Registry query timed out — enter average sale price manually below");
              },30000);
              fetch("https://landregistry.data.gov.uk/landregistry/query?query="+encodeURIComponent(sparql)+"&output=json",{headers:{Accept:"application/json"}})
                .then(function(r){return r.json();})
                .then(function(json){
                  clearTimeout(lrTimeout);
                  var rows=(json&&json.results&&json.results.bindings)||[];
                  if(rows.length===0){
                    upo("lrLoading",false);
                    upo("lrError","No sales found in "+district+" since 2022. Enter average sale price manually below.");
                    return;
                  }
                  // Calculate weighted average (£) from rows
                  var sum=0, n=0, prices=[];
                  rows.forEach(function(row){
                    var amt=parseFloat(row.amount&&row.amount.value)||0;
                    if(amt>0){sum+=amt;n++;prices.push(amt);}
                  });
                  var avgPrice=n>0?sum/n:0;
                  // Median is more robust to outliers
                  prices.sort(function(a,b){return a-b;});
                  var median=prices.length>0 ? prices[Math.floor(prices.length/2)] : 0;
                  upo("lrLoading",false);
                  upo("lrData",{count:n,avgPrice:avgPrice,medianPrice:median,district:district});
                })
                .catch(function(err){
                  clearTimeout(lrTimeout);
                  upo("lrLoading",false);
                  upo("lrError","Network error fetching Land Registry data");
                });
            }
          }
          return e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:12}},
            e("div",null,e("label",{style:lbl},"Postcode"),e("input",{value:o.postcode||"",onChange:function(ev){upo("postcode",ev.target.value);upo("lrTriggered",false);upo("lrData",null);upo("lrError","");},placeholder:"e.g. CV5 7XX",style:ipt})),
            e("div",null,e("label",{style:lbl},"Floor area (sqft)"),e("input",{type:"number",value:o.resSqft||"",onChange:function(ev){upo("resSqft",ev.target.value);},placeholder:"e.g. 1400",style:ipt})),
            e("div",null,e("label",{style:lbl},"Bedrooms"),e("input",{type:"number",value:o.resBeds||"",onChange:function(ev){upo("resBeds",ev.target.value);},placeholder:"e.g. 4",style:ipt})),
            e("div",null,
              e("label",{style:lbl},"Condition"),
              e("select",{value:o.resCondition||"good",onChange:function(ev){upo("resCondition",ev.target.value);},style:ipt},
                e("option",{value:"derelict"},"Derelict / unmodernised"),
                e("option",{value:"tired"},"Tired / 1970s decor"),
                e("option",{value:"good"},"Good / liveable"),
                e("option",{value:"excellent"},"Excellent / recently refurbished")
              )
            ),
            e("div",null,e("label",{style:lbl},"Rent achievable pcm (£)"),e("input",{type:"number",value:o.resRentPcm||"",onChange:function(ev){upo("resRentPcm",ev.target.value);},placeholder:"Single AST market rent",style:ipt})),
            e("div",null,e("label",{style:lbl},"Refurb budget (£)"),e("input",{type:"number",value:o.resRefurbCost||"",onChange:function(ev){upo("resRefurbCost",ev.target.value);},placeholder:"e.g. 35000",style:ipt})),
            e("div",null,e("label",{style:lbl},"Refurb-uplift £/sqft"),e("input",{type:"number",value:o.resRefurbUplift||"",onChange:function(ev){upo("resRefurbUplift",ev.target.value);},placeholder:"e.g. 50 (uplift in £/sqft)",style:ipt})),
            e("div",null,e("label",{style:lbl},"HMO rent per room pcm (£)"),e("input",{type:"number",value:o.resHmoPerRoom||"",onChange:function(ev){upo("resHmoPerRoom",ev.target.value);},placeholder:"e.g. 600",style:ipt}))
          );
        })(),

        // LR data display for residential
        assetType==="residential" && o.lrLoading && e("div",{style:{padding:"10px 14px",background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.3)",borderRadius:6,fontSize:11,color:"#4A4BAE",marginTop:8}},"⟳ Fetching Land Registry comparables for postcode..."),
        assetType==="residential" && o.lrError && e("div",{style:{padding:"10px 14px",background:"rgba(176,90,53,0.06)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:6,fontSize:11,color:"#B05A35",marginTop:8}},"⚠ "+o.lrError),
        assetType==="residential" && o.lrData && o.lrData.count>0 && e("div",{style:{padding:"12px 14px",background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.3)",borderRadius:6,fontSize:11,color:"#2D7A65",marginTop:8,lineHeight:1.7}},
          e("strong",null,"✓ Land Registry: "),
          o.lrData.count+" sales in "+o.lrData.district+" since 2022. ",
          "Avg "+fmt(o.lrData.avgPrice)+" · Median "+fmt(o.lrData.medianPrice),
          num(o.resSqft)>0 && " · Implied £/sqft (avg): "+Math.round(o.lrData.avgPrice/num(o.resSqft))
        ),

        // Direct NOI override (always shown — but suppressed for residential)
        assetType!=="residential" && e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,padding:"12px",background:"#F8F8FE",borderRadius:6,marginTop:6}},
          e("div",null,e("label",{style:lbl},"Stabilised NOI (£/yr) — override"),e("input",{type:"number",value:o.stabilisedNOI||"",onChange:function(ev){upo("stabilisedNOI",ev.target.value);},placeholder:stabilNOI>0?Math.round(stabilNOI):"e.g. 1500000",style:ipt})),
          e("div",null,e("label",{style:lbl},"Current NOI (£/yr) — today"),e("input",{type:"number",value:o.currentNOI||"",onChange:function(ev){upo("currentNOI",ev.target.value);},placeholder:"For pre-stabilisation",style:ipt}))
        ),

        // Derived NOI display
        stabilNOI>0 && e("div",{style:{marginTop:10,padding:"10px 12px",background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.3)",borderRadius:6,fontSize:12,color:"#2D7A65"}},
          e("strong",null,"Stabilised NOI: ",fmt(stabilNOI),"/yr"),
          assetType==="pbsa" && o.beds>0 && " · "+Math.round(stabilNOI/num(o.beds))+"/bed/yr",
          " · Sector yield range: "+yieldBand[0].toFixed(2)+"–"+yieldBand[1].toFixed(2)+"%"
        )
      ),

      // ── SECTION 3: STRATEGIC PRIORITY ──────────────────────────────────
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:18,marginBottom:14}},
        e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:10,borderBottom:"1px solid #F0F1FA"}},
          e("div",{style:{width:24,height:24,borderRadius:"50%",background:"#4A4BAE",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12}},"3"),
          e("h3",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"What matters most to you?")
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}},
          [
            {key:"cash",      label:"Cash now",         desc:"Maximum £ in hand, fastest",icon:"💷"},
            {key:"irr",       label:"Best IRR",         desc:"Highest return on equity",   icon:"📈"},
            {key:"strategic", label:"Strategic value",  desc:"Trade buyer / partnership",  icon:"🤝"},
            {key:"risk_off",  label:"Risk-off",         desc:"Most reliable counterparty",icon:"🛡"}
          ].map(function(p){
            var picked = ownerPriority === p.key;
            return e("div",{key:p.key,onClick:function(){upo("priority",p.key);},
              style:{padding:"12px 14px",borderRadius:8,border:"2px solid "+(picked?"#4A4BAE":"#DDE0ED"),background:picked?"rgba(74,75,174,0.06)":"#fff",cursor:"pointer",textAlign:"center"}},
              e("div",{style:{fontSize:22,marginBottom:4}},p.icon),
              e("div",{style:{fontSize:12,fontWeight:800,color:picked?"#2E2F8A":"#1E1F5C",marginBottom:2}},p.label),
              e("div",{style:{fontSize:10,color:"#7278A0"}},p.desc)
            );
          })
        )
      ),

      // ── SECTION 4: RESIDENTIAL STRATEGIES (single house/flat workflow) ──
      assetType==="residential" && (function(){
        // Compute residential strategies from inputs
        var sqft = num(o.resSqft);
        var beds = num(o.resBeds);
        var rentPcm = num(o.resRentPcm);
        var refurbCost = num(o.resRefurbCost);
        var refurbUplift = num(o.resRefurbUplift);
        var hmoPerRoom = num(o.resHmoPerRoom);
        var condition = o.resCondition || "good";

        // Derive £/sqft from LR data
        var basePsf = 0;
        if(o.lrData && o.lrData.avgPrice > 0 && sqft > 0){
          basePsf = o.lrData.avgPrice / 1100;  // assume avg comp sqft ~1100; better: median
          // Actually use the *per-sqft* method only if user typed their own sqft
          basePsf = o.lrData.medianPrice / 1100;
        }
        // Override: if user typed a manual asking value, prefer that
        var manualVal = num(o.resManualValue);

        // Condition multiplier
        var condMult = {derelict:0.78,tired:0.90,good:1.0,excellent:1.08}[condition] || 1.0;

        // Market value as-is
        var asIsValue;
        if(manualVal > 0) asIsValue = manualVal;
        else if(o.lrData && o.lrData.medianPrice > 0 && sqft > 0){
          // £/sqft from median ÷ assumed comp sqft (1100) × this sqft × condition
          asIsValue = (o.lrData.medianPrice / 1100) * sqft * condMult;
        } else if(o.lrData && o.lrData.medianPrice > 0){
          asIsValue = o.lrData.medianPrice * condMult;
        } else {
          asIsValue = 0;
        }

        // Refurb strategy
        var refurbedValue = 0;
        if(refurbUplift > 0 && sqft > 0){
          refurbedValue = asIsValue + (refurbUplift * sqft);
        } else if(refurbCost > 0){
          // Heuristic: typical refurb returns £2 of value per £1 spent on right asset
          refurbedValue = asIsValue + refurbCost * 2;
        }

        // HMO conversion estimate
        var hmoRooms = beds > 0 ? beds + 1 : 0;  // assume one extra room created (reception)
        var hmoGrossYr = hmoPerRoom > 0 ? hmoPerRoom * 12 * hmoRooms * 0.85 : 0;  // 85% occupancy
        var hmoNetYr = hmoGrossYr * 0.70;  // 70% of gross after costs (mgmt, void, utilities, mtnce)
        var hmoConvCost = beds * 8000;  // ~£8k per room for fire-doors / kitchens / licensing
        var hmoCapVal = hmoNetYr > 0 ? hmoNetYr / 0.075 : 0;  // 7.5% yield for HMO sale

        // BTL strategy
        var btlGrossYr = rentPcm > 0 ? rentPcm * 12 * 0.96 : 0;  // 96% occupancy
        var btlNetYr = btlGrossYr * 0.80;  // 80% net after mgmt/voids/repairs
        var btlGrossYield = asIsValue > 0 && rentPcm > 0 ? (rentPcm*12/asIsValue)*100 : 0;

        // Remortgage strategy (75% LTV)
        var remortRaised = asIsValue * 0.75;
        var equityReleased = remortRaised - existingDebt;

        // Demolish + 2 plots redevelopment
        var demoCost = 25000;
        var planningPro = 8000;
        var newGdv = sqft > 0 && o.lrData && o.lrData.medianPrice > 0
          ? (o.lrData.medianPrice / 1100) * sqft * 2 * 1.15  // 2 plots, 15% premium for new build
          : 0;
        var redevCost = sqft > 0 ? sqft * 1.8 * 180 : 0;  // 80% more sqft (2 units), £180/sqft build
        var redevProfit = newGdv - redevCost - demoCost - planningPro - asIsValue;

        var sellingCostsPct = 0.022;  // 2.2% (agent 1.5% + legals 0.5% + EPC etc 0.2%)

        var resStrategies = [
          {
            key:"sell_now",
            label:"🏠 Sell as-is",
            desc:"List on open market in current condition. Quickest cash, no further capital risk.",
            cost:asIsValue*sellingCostsPct,
            time:"3-6 mo",
            timeMonths:4.5,
            gross:asIsValue,
            net:asIsValue - (asIsValue*sellingCostsPct) - existingDebt,
            annualised: 0,  // one-shot
            notes:["Median "+(o.lrData?fmt(o.lrData.medianPrice):"—")+" comp", condition+" condition × "+condMult.toFixed(2)]
          },
          {
            key:"refurb_sell",
            label:"🔧 Refurb + sell",
            desc:"Modernise (kitchen, bathrooms, decor). Time + capital but unlocks higher £/sqft.",
            cost:refurbCost + (refurbedValue*sellingCostsPct),
            time:"6-9 mo",
            timeMonths:7.5,
            gross:refurbedValue,
            net:refurbedValue - refurbCost - (refurbedValue*sellingCostsPct) - existingDebt,
            annualised: refurbedValue > asIsValue && refurbCost > 0 ?
              ((refurbedValue - refurbCost - asIsValue) / refurbCost) * (12/7.5) * 100 : 0,
            notes:[refurbCost>0?fmt(refurbCost)+" refurb":"set refurb budget", refurbUplift>0?"+£"+refurbUplift+"/sqft uplift":"using 2x rule"]
          },
          {
            key:"convert_hmo",
            label:"🏘 Convert to HMO",
            desc:"5+ bed shared house. Licensing, fire compliance. Sell to HMO investor or hold for cashflow.",
            cost:hmoConvCost + (hmoCapVal*sellingCostsPct),
            time:"9-12 mo",
            timeMonths:10.5,
            gross:hmoCapVal,
            net:hmoCapVal - hmoConvCost - (hmoCapVal*sellingCostsPct) - existingDebt,
            annualised: hmoNetYr > 0 && asIsValue > 0 ? (hmoNetYr/asIsValue)*100 : 0,
            notes:[hmoRooms+"-room HMO", hmoPerRoom>0?fmt(hmoNetYr)+"/yr net":"set room rent", "7.5% sale yield"]
          },
          {
            key:"rent_btl",
            label:"🔑 Rent out (single AST)",
            desc:"Let on single Assured Shorthold Tenancy. Hold long-term, single tenant, lowest hassle.",
            cost:0,
            time:"1-2 mo",
            timeMonths:1.5,
            gross:rentPcm > 0 ? rentPcm * 12 : 0,
            net:btlNetYr,
            annualised: btlGrossYield,
            notes:[btlGrossYield>0?btlGrossYield.toFixed(1)+"% gross yield":"set rent pcm", "Net "+fmt(btlNetYr)+"/yr"]
          },
          {
            key:"remort_hold",
            label:"🏦 Remortgage + hold",
            desc:"Take BTL mortgage at 75% LTV. Release tax-efficient equity. Keep asset for capital growth.",
            cost:2500,  // legals
            time:"2-3 mo",
            timeMonths:2.5,
            gross:remortRaised,
            net:equityReleased - 2500,
            annualised: 0,  // not applicable to one-shot
            notes:["75% LTV on "+fmt(asIsValue), equityReleased>0?fmt(equityReleased)+" released":"already over-levered", "+ ongoing rent if let"]
          },
          {
            key:"demo_redev",
            label:"⚖ Demolish + redevelop",
            desc:"Knock down, plant 2+ new units. Planning required. Highest upside but timeline + risk.",
            cost:demoCost + planningPro + redevCost + (newGdv*sellingCostsPct),
            time:"18-24 mo",
            timeMonths:21,
            gross:newGdv,
            net:redevProfit - existingDebt,
            annualised: redevProfit > 0 && (redevCost + asIsValue) > 0 ? (redevProfit / (redevCost + asIsValue)) * (12/21) * 100 : 0,
            notes:["Subject to planning", newGdv>0?"GDV "+fmt(newGdv):"need sqft", redevCost>0?"Build "+fmt(redevCost):""]
          }
        ];

        // Score each strategy by user's priority
        resStrategies.forEach(function(r){
          var s = 0;
          if(ownerPriority === "cash"){
            // Cash now = max net, fast
            s = r.net/1000 + (r.timeMonths < 5 ? 50 : 0) - r.timeMonths*5;
          } else if(ownerPriority === "irr"){
            s = r.annualised;
          } else if(ownerPriority === "strategic"){
            s = r.net/1000 + (r.key==="convert_hmo"?30:0) + (r.key==="demo_redev"?40:0);
          } else if(ownerPriority === "risk_off"){
            s = r.net/1000 + (r.key==="sell_now"?40:0) + (r.key==="remort_hold"?30:0) - (r.key==="demo_redev"?50:0);
          }
          r.score = s;
        });
        var resSorted = resStrategies.slice().sort(function(a,b){return b.score-a.score;});
        var resBest = resSorted[0];
        var resSecond = resSorted[1];

        // Store for AI section to read
        upo("_resBestKey", resBest ? resBest.key : "");
        upo("_resBestLabel", resBest ? resBest.label : "");

        return e("div",null,
          e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:18,marginBottom:14}},
            e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:10,borderBottom:"1px solid #F0F1FA"}},
              e("div",{style:{width:24,height:24,borderRadius:"50%",background:"#B05A35",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12}},"4"),
              e("h3",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Residential strategies — ranked by your priority")
            ),

            // Manual override for value if LR not loaded
            !o.lrData && e("div",{style:{padding:"10px 14px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:6,fontSize:11,color:"#7278A0",marginBottom:14}},
              e("strong",null,"No comparables loaded yet. "),
              "Either fill in postcode above for auto-lookup, OR enter your estimated value manually:",
              e("input",{type:"number",value:o.resManualValue||"",onChange:function(ev){upo("resManualValue",ev.target.value);},placeholder:"Estimated market value (£)",style:Object.assign({},ipt,{marginTop:8,maxWidth:240})})
            ),

            // Strategy cards
            e("div",{style:{display:"grid",gridTemplateColumns:"1fr",gap:10}},
              resSorted.map(function(r,idx){
                var isBest = idx===0;
                return e("div",{key:r.key,style:{
                  background:isBest?"linear-gradient(135deg,rgba(45,122,101,0.06),rgba(74,75,174,0.04))":"#fff",
                  border:"2px solid "+(isBest?"#2D7A65":"#DDE0ED"),
                  borderRadius:8,
                  padding:"14px 16px",
                  position:"relative"
                }},
                  isBest && e("div",{style:{position:"absolute",top:-9,left:14,background:"#2D7A65",color:"#fff",fontSize:9,fontWeight:800,padding:"3px 8px",borderRadius:3,letterSpacing:".08em"}},"🏆 RECOMMENDED"),
                  e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"start",gap:14,flexWrap:"wrap"}},
                    e("div",{style:{flex:"1 1 250px",minWidth:200}},
                      e("div",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C",marginBottom:3}},r.label),
                      e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.5,marginBottom:8}},r.desc),
                      e("div",{style:{fontSize:10,color:"#9A7B3E",fontStyle:"italic"}},r.notes.filter(function(n){return n;}).join(" · "))
                    ),
                    e("div",{style:{display:"flex",gap:14,flexWrap:"wrap"}},
                      e("div",{style:{textAlign:"right"}},
                        e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".05em",textTransform:"uppercase"}},"Gross"),
                        e("div",{style:{fontSize:14,fontWeight:700,color:"#2E2F8A"}},r.gross>0?fmt(r.gross):"—")
                      ),
                      e("div",{style:{textAlign:"right"}},
                        e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".05em",textTransform:"uppercase"}},"Net to you"),
                        e("div",{style:{fontSize:14,fontWeight:800,color:r.net>0?"#2D7A65":"#B05A35"}},r.net!==0?fmt(r.net):"—")
                      ),
                      e("div",{style:{textAlign:"right"}},
                        e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".05em",textTransform:"uppercase"}},"Time"),
                        e("div",{style:{fontSize:12,fontWeight:700,color:"#3A3D6A"}},r.time)
                      ),
                      r.annualised > 0 && e("div",{style:{textAlign:"right"}},
                        e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".05em",textTransform:"uppercase"}},"Annualised"),
                        e("div",{style:{fontSize:12,fontWeight:700,color:r.annualised>10?"#2D7A65":"#9A7B3E"}},r.annualised.toFixed(1)+"%")
                      )
                    )
                  )
                );
              })
            ),

            asIsValue>0 && e("div",{style:{marginTop:14,padding:"12px 14px",background:"#F8F8FE",borderLeft:"3px solid #4A4BAE",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
              e("strong",null,"As-is estimated value: "+fmt(asIsValue)+"."),
              " Based on "+(o.lrData?"Land Registry median + your sqft + condition":"manual override"),
              ". Adjust 'Condition' or enter a manual value to override."
            )
          ),

          // Best recommendation card (residential)
          resBest && asIsValue>0 && e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",color:"#fff",borderRadius:10,padding:24,marginBottom:14}},
            e("div",{style:{fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:"#EDE84A",marginBottom:6,fontWeight:700}},"Cassidy Recommendation"),
            e("div",{style:{fontSize:20,fontWeight:800,marginBottom:10}},"Optimal strategy: "+resBest.label),
            e("div",{style:{fontSize:13,opacity:0.9,marginBottom:14,lineHeight:1.7}},resBest.desc),
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.15)"}},
              e("div",null,
                e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Net Proceeds"),
                e("div",{style:{fontSize:18,fontWeight:800,color:"#fff"}},resBest.net>0?fmt(resBest.net):"—")
              ),
              e("div",null,
                e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Timeline"),
                e("div",{style:{fontSize:18,fontWeight:800,color:"#fff"}},resBest.time)
              ),
              resBest.annualised>0 && e("div",null,
                e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Annualised"),
                e("div",{style:{fontSize:18,fontWeight:800,color:"#EDE84A"}},resBest.annualised.toFixed(1)+"%")
              ),
              e("div",null,
                e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Capital Needed"),
                e("div",{style:{fontSize:18,fontWeight:800,color:"#fff"}},resBest.cost>0?fmt(resBest.cost):"None")
              )
            ),
            resSecond && e("div",{style:{marginTop:16,padding:"12px 14px",background:"rgba(255,255,255,0.06)",borderRadius:6,fontSize:11,color:"rgba(255,255,255,0.85)",lineHeight:1.6}},
              e("strong",{style:{color:"#EDE84A",letterSpacing:".05em"}},"Second choice: "),
              resSecond.label+" — Net "+fmt(resSecond.net)+" ("+resSecond.time+")"
            )
          )
        );
      })(),

      // ── SECTION 4: GENERIC EXIT COMPARISON (for non-residential assets) ──
      assetType!=="residential" && e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:18,marginBottom:14}},
        e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:10,borderBottom:"1px solid #F0F1FA"}},
          e("div",{style:{width:24,height:24,borderRadius:"50%",background:"#B05A35",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12}},"4"),
          e("h3",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Exit routes side-by-side — ranked by your priority")
        ),

        (stabilNOI===0 && costBase===0) && e("div",{style:{padding:"14px 16px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:6,fontSize:11,color:"#B05A35",lineHeight:1.6}},
          "⚠ Enter at least an income figure (NOI or unit-level rent) and cost base to see live comparison."
        ),

        // Table
        (stabilNOI>0 || costBase>0) && e("div",{style:{overflowX:"auto"}},
          e("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"DM Sans,sans-serif"}},
            e("thead",null,
              e("tr",{style:{background:"#F4F5FB"}},
                ["Rank","Exit route","Headline","Net to you","Yield","IRR proxy","Time","Notes"].map(function(h,i){
                  return e("th",{key:i,style:{padding:"10px 8px",textAlign:i<=1?"left":"right",fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".05em",fontWeight:700,borderBottom:"2px solid #DDE0ED"}},h);
                })
              )
            ),
            e("tbody",null,
              sorted.map(function(r,idx){
                var isBest = idx===0;
                return e("tr",{key:r.ex.key,style:{borderBottom:"1px solid #F0F1FA",background:isBest?"rgba(45,122,101,0.04)":"transparent"}},
                  e("td",{style:{padding:"10px 8px",fontWeight:800,color:isBest?"#2D7A65":"#7278A0",fontSize:13}},isBest?"🏆 1":(idx+1)),
                  e("td",{style:{padding:"10px 8px"}},
                    e("div",{style:{fontWeight:700,color:"#1E1F5C"}},r.ex.icon+" "+r.ex.label),
                    e("div",{style:{fontSize:9,color:"#7278A0",marginTop:1}},r.ex.desc.substring(0,90)+(r.ex.desc.length>90?"…":""))
                  ),
                  e("td",{style:{padding:"10px 8px",textAlign:"right",fontWeight:700,color:"#2E2F8A"}},r.headline>0?fmt(r.headline):"—"),
                  e("td",{style:{padding:"10px 8px",textAlign:"right",fontWeight:800,color:r.net>0?"#2D7A65":"#B05A35"}},r.net>0?fmt(r.net):(r.ex.key==="hold"?fmt(stabilNOI||currentNOI)+"/yr":"—")),
                  e("td",{style:{padding:"10px 8px",textAlign:"right",color:"#7278A0"}},r.yld>0?r.yld.toFixed(2)+"%":"—"),
                  e("td",{style:{padding:"10px 8px",textAlign:"right",fontWeight:700,color:r.simpleIrr>15?"#2D7A65":r.simpleIrr>0?"#9A7B3E":"#B05A35"}},isFinite(r.simpleIrr)&&r.simpleIrr!==0?r.simpleIrr.toFixed(1)+"%":"—"),
                  e("td",{style:{padding:"10px 8px",textAlign:"right",color:"#7278A0",fontSize:10}},r.ex.timeMonths+(r.ex.timeMonths.indexOf("ongoing")<0?"mo":"")),
                  e("td",{style:{padding:"10px 8px",fontSize:10,color:"#7278A0",maxWidth:160}},r.notes.join(" · "))
                );
              })
            )
          )
        )
      ),

      // ── SECTION 5: RECOMMENDATION (non-residential only) ──────────────
      assetType!=="residential" && bestExit && stabilNOI>0 && e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",color:"#fff",borderRadius:10,padding:24,marginBottom:14}},
        e("div",{style:{fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:"#EDE84A",marginBottom:6,fontWeight:700}},"Cassidy Recommendation"),
        e("div",{style:{fontSize:20,fontWeight:800,marginBottom:10}},
          "Optimal exit: "+bestExit.ex.icon+" "+bestExit.ex.label
        ),
        e("div",{style:{fontSize:13,opacity:0.9,marginBottom:14,lineHeight:1.7}},
          bestExit.headline > 0 && "Expected headline value: "+e("strong",{style:{color:"#EDE84A"}},fmt(bestExit.headline)),
          bestExit.net > 0 && " · Net to you: "+fmt(bestExit.net),
          " · Timing: "+bestExit.ex.timeMonths+"mo"
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginTop:14,paddingTop:14,borderTop:"1px solid rgba(255,255,255,0.15)"}},
          e("div",null,
            e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Net Proceeds"),
            e("div",{style:{fontSize:18,fontWeight:800,color:"#fff"}},bestExit.net>0?fmt(bestExit.net):"—")
          ),
          e("div",null,
            e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Profit on Cost"),
            e("div",{style:{fontSize:18,fontWeight:800,color:bestExit.profitOnCost>=15?"#2D7A65":"#fff"}},bestExit.profitOnCost!==0?bestExit.profitOnCost.toFixed(1)+"%":"—")
          ),
          e("div",null,
            e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"IRR Proxy"),
            e("div",{style:{fontSize:18,fontWeight:800,color:"#EDE84A"}},isFinite(bestExit.simpleIrr)&&bestExit.simpleIrr!==0?bestExit.simpleIrr.toFixed(1)+"%":"—")
          ),
          e("div",null,
            e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Equity at Risk"),
            e("div",{style:{fontSize:18,fontWeight:800,color:"#fff"}},equityIn>0?fmt(equityIn):"—")
          )
        ),
        secondExit && e("div",{style:{marginTop:16,padding:"12px 14px",background:"rgba(255,255,255,0.06)",borderRadius:6,fontSize:11,color:"rgba(255,255,255,0.85)",lineHeight:1.6}},
          e("strong",{style:{color:"#EDE84A",letterSpacing:".05em"}},"Second choice: "),
          secondExit.ex.icon+" "+secondExit.ex.label,
          secondExit.headline>0 && " — "+fmt(secondExit.headline),
          " ("+secondExit.ex.timeMonths+"mo)"
        )
      ),

      // ── SECTION 6: AI INSIGHT (institutional/commercial assets) ────────
      assetType!=="residential" && stabilNOI>0 && bestExit && e(AIPanel,{user:user,up:up,stage:"optimiser",data:data,persistKey:"optimiser_strategy",label:"Strategic Exit Analysis",
        prompt:buildHonestPrompt(data,"Strategic analysis for an existing "+assetDef.label+" asset. " +
          "Location: "+(o.assetName||"(unnamed)")+", "+(location==="prime"?"prime market":"regional market")+". " +
          "Stabilised NOI: "+fmt(stabilNOI)+"/yr. Dev cost: "+fmt(costBase)+". Existing debt: "+fmt(existingDebt)+". Months to stabilisation: "+monthsToStabil+". " +
          (o.blockMixOn && o.blockMix ? "Block contains a MIX of accommodation: " + Object.keys(o.blockMix).filter(function(k){return num(o.blockMix[k].count)>0;}).map(function(k){
            var c = o.blockMix[k];
            var lbls = {pbsa:"Student PBSA",kw:"Key Worker",btr:"Market BTR",prs:"PRS landlord",ar:"Affordable Rent",so:"Shared Ownership",commercial:"Commercial ground-floor"};
            return num(c.count)+" "+(lbls[k]||k)+" at "+fmt(num(c.rent))+" "+(k==="pbsa"?"/bed/wk":k==="commercial"?"/sqft pa":"/unit pcm");
          }).join(", ") + ". " : "") +
          "Owner priority: "+ownerPriority+". " +
          "Top-ranked exit route by our model: "+bestExit.ex.label+" — expected net "+fmt(bestExit.net)+", IRR "+(isFinite(bestExit.simpleIrr)?bestExit.simpleIrr.toFixed(1):"—")+"%. " +
          "Second-ranked: "+(secondExit?secondExit.ex.label:"")+". " +
          "Provide: 1) Whether you agree with the top-ranked exit and why, 2) " + (o.blockMixOn ? "Whether SPLIT-SALE (different buyers for each accommodation type) beats single-block sale, and which buyers to target for each component, " : "Risks specific to that exit route in current UK market, ") +
          "3) Specific named buyers/funds to approach (real UK institutions active in this sector + accommodation mix), 4) Timing recommendation (sell now vs wait for stabilisation), " +
          "5) Any structuring tips (forward-fund, leaseback, debt restructure, NHS/Council lease for Key Worker) that could improve outcome. Be specific and commercial — UK 2026 market. 280 words."
      )}),

      // ── SECTION 6: AI INSIGHT (residential — single house/flat) ────────
      assetType==="residential" && o._resBestKey && e(AIPanel,{user:user,up:up,stage:"optimiser",data:data,persistKey:"optimiser_residential_strategy",label:"Residential Strategy Analysis",
        prompt:buildHonestPrompt(data,"Strategic analysis for a residential property the owner wants to monetise. " +
          "Property: "+(o.assetName||"residence")+" in "+(o.postcode||"(no postcode)")+", "+(num(o.resSqft)>0?num(o.resSqft)+" sqft":"")+", "+(num(o.resBeds)>0?num(o.resBeds)+" bedrooms":"")+", condition '"+(o.resCondition||"good")+"'. " +
          (o.lrData?"Land Registry: "+o.lrData.count+" comparable sales in "+o.lrData.district+", median "+fmt(o.lrData.medianPrice)+". ":"") +
          "Cost base: "+fmt(costBase)+". Existing debt: "+fmt(existingDebt)+". " +
          "Owner priority: "+ownerPriority+". " +
          "Top-ranked strategy by our model: "+o._resBestLabel+". " +
          "Provide: 1) Whether you agree with this strategy and why, 2) Specific tactics to maximise outcome (e.g. best refurb £/sqft return, HMO licensing tips, demolition planning angle), " +
          "3) Local market intel for the postcode/area (demand trends, comparable house types, buyer pool), " +
          "4) Timing recommendation, 5) Any tax / SDLT / CGT considerations specific to this strategy. " +
          "Be specific, commercial, UK-focused. 250 words plain text."
      )})
    );
  }
