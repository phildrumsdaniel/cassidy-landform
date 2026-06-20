// ── renderCapitalise  (params: LiveMarketBanner, city, data, setData, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderCapitalise(LiveMarketBanner, city, data, setData, up, user){
    var cap=data.capitalise||{};
    var l=data.land||{}; var p=data.planning||{}; var f=data.fin||{};
    var rlvD=data.rlv||{}; var s2=data.sfh||{};
    var cityMkt=MKT[city]||MKT.manchester;
    var addr=l.address||"Development Site";
    var units2=num(p.units||rlvD.units||0)||50;

    // ── Bedroom mix input (default from SFH mix if available) ─────────────
    // v9.38 — Improved derivation: handle 1-bed apartment, 4-bed semi, 5-bed detached,
    // executive variants, bungalows. Previously the catch-all fell to 2-bed by default,
    // and 5-bed was completely missing — meant Cap totals didn't match SFH.
    var sfhMix=s2.mix||[];
    var defaultMix={1:0,2:0,3:0,4:0,5:0};
    if(sfhMix.length>0){
      sfhMix.forEach(function(row){
        var t=String(row.type||"").toLowerCase();
        var n = num(row.count||0);
        if(n <= 0) return;
        // Classify by bed count — check most specific first
        if(/^5[\s-]?bed/.test(t) || /\b5[\s-]?bed/.test(t)) defaultMix[5] += n;
        else if(/^4[\s-]?bed/.test(t) || /\b4[\s-]?bed/.test(t) || /executive/.test(t)) defaultMix[4] += n;
        else if(/^3[\s-]?bed/.test(t) || /\b3[\s-]?bed/.test(t)) defaultMix[3] += n;
        else if(/^2[\s-]?bed/.test(t) || /\b2[\s-]?bed/.test(t)) defaultMix[2] += n;
        else if(/^1[\s-]?bed/.test(t) || /\b1[\s-]?bed/.test(t) || /studio/.test(t)) defaultMix[1] += n;
        else defaultMix[3] += n; // fallback (changed from 2 to 3 — more typical mid-market default)
      });
    } else {
      // Default mix: 10% 1bed, 40% 2bed, 35% 3bed, 15% 4bed
      defaultMix[1]=Math.round(units2*0.10);
      defaultMix[2]=Math.round(units2*0.40);
      defaultMix[3]=Math.round(units2*0.35);
      defaultMix[4]=Math.round(units2*0.15);
    }
    var defaultMixTotal = defaultMix[1]+defaultMix[2]+defaultMix[3]+defaultMix[4]+defaultMix[5];

    var beds1=num(cap.beds1!==undefined?cap.beds1:defaultMix[1]);
    var beds2=num(cap.beds2!==undefined?cap.beds2:defaultMix[2]);
    var beds3=num(cap.beds3!==undefined?cap.beds3:defaultMix[3]);
    var beds4=num(cap.beds4!==undefined?cap.beds4:defaultMix[4]);
    // F3 — extra editable rent cards for granular unit types (e.g. 4-bed detached at a higher rent)
    var RENT_UNIT_TYPES = ["1-bed","2-bed","3-bed","4-bed terrace","4-bed semi","4-bed detached","4-bed executive","5-bed detached","Bungalow 2-bed","Bungalow 3-bed"];
    var rentExtra = Array.isArray(cap.rentExtra) ? cap.rentExtra : [];
    var extraMonthly = rentExtra.reduce(function(s,c){return s+num(c.count)*num(c.rent);},0);
    var extraUnits = rentExtra.reduce(function(s,c){return s+num(c.count);},0);
    var totalUnitsCalc=beds1+beds2+beds3+beds4+extraUnits;

    // ── v9.33 — Postcode-aware market rent baseline ────────────────────────
    // Previously: only used cityMkt (works if user picked city, fails on postcode-only deals).
    // Now: try postcode → city lookup first, then direct city, then fallback.
    // Provenance shown so user knows where the rent figure came from.
    var rentSourceLabel = "default";
    var rentMonthly1bed = 1000;  // fallback
    (function(){
      // 1. Try postcode lookup first — most specific
      var postcode = (data.land && data.land.postcode) || (data.rlv && data.rlv.postcode) || "";
      if(postcode){
        var pcData = lookupPostcode(postcode);
        if(pcData && pcData.city && MKT[pcData.city] && MKT[pcData.city].btr){
          rentMonthly1bed = MKT[pcData.city].btr;
          rentSourceLabel = "postcode "+postcode.toUpperCase()+" → "+cityName(pcData.city)+" market";
          return;
        }
      }
      // 2. Try city directly
      if(city && MKT[city] && MKT[city].btr){
        rentMonthly1bed = MKT[city].btr;
        rentSourceLabel = cityName(city)+" market data";
        return;
      }
      // 3. Fall back to cityMkt (which itself fell back to manchester)
      if(cityMkt && cityMkt.btr){
        rentMonthly1bed = cityMkt.btr;
        rentSourceLabel = "regional fallback";
      }
    })();

    // v9.51 — per-bed rents anchored on the AREA's typical (3-bed) rent via
    // areaRentPcm, so each bed size is realistic for the location (fixes the old
    // "btr = 1-bed" overstatement). Each remains user-editable.
    var areaR=function(b){ return (typeof areaRentPcm==="function") ? areaRentPcm(data,b) : 0; };
    var rent1=num(cap.rent1!==undefined && cap.rent1!=="" ? cap.rent1 : (areaR(1)||rentMonthly1bed));
    var base1bed=rent1;
    var rent2=num(cap.rent2!==undefined && cap.rent2!=="" ? cap.rent2 : (areaR(2)||Math.round(base1bed*BED_MULT[2])));
    var rent3=num(cap.rent3!==undefined && cap.rent3!=="" ? cap.rent3 : (areaR(3)||Math.round(base1bed*BED_MULT[3])));
    var rent4=num(cap.rent4!==undefined && cap.rent4!=="" ? cap.rent4 : (areaR(4)||Math.round(base1bed*BED_MULT[4])));

    // ── Gross annual rent ──────────────────────────────────────────────────
    var grossMonthly=(beds1*rent1)+(beds2*rent2)+(beds3*rent3)+(beds4*rent4)+extraMonthly;
    // v9.52 — Affordable-rent discount. Market units rent at 100% of the AREA rent;
    // affordable units at a discount set by the radio buttons. The affordable SHARE
    // is pulled from the deal (Tenure Mix → Planning → SFH) so the mix flows in here
    // automatically; default discount is 0% (market) until a button is chosen.
    var ahFracCap=Math.min(1,(num(data.tenure&&data.tenure.ahPct)||num(data.planning&&data.planning.ahPct)||num(data.planning&&data.planning.afhPct)||num(data.sfh&&data.sfh.ahPct)||num(cap.ahPct)||0)/100);
    var ahRentDisc=(cap.ahRentDisc!==undefined && cap.ahRentDisc!=="")?num(cap.ahRentDisc)/100:(ahFracCap>0?0.20:0);  // default Affordable Rent (−20%) when the scheme has affordable units
    var rentBlendFactor=(1-ahFracCap)+ahFracCap*(1-ahRentDisc);
    var grossAnnual=grossMonthly*12*rentBlendFactor;

    // ── NOI calculation ────────────────────────────────────────────────────
    var ded=NOI_DEDUCTIONS.residential;
    var voidRate=num(cap.voidRate!==undefined?cap.voidRate/100:ded.voids);
    var mgmtRate=num(cap.mgmtRate!==undefined?cap.mgmtRate/100:ded.management);
    var maintRate=num(cap.maintRate!==undefined?cap.maintRate/100:ded.maintenance);
    var insRate=ded.insurance;
    var totalDed=voidRate+mgmtRate+maintRate+insRate;
    var nriMultiplier=1-totalDed;
    var netAnnualIncome=grossAnnual*nriMultiplier;
    var noiPerUnit=totalUnitsCalc>0?netAnnualIncome/totalUnitsCalc:0;

    // ── Capitalised values at different yields ─────────────────────────────
    // v9.53 — ONE net initial yield used everywhere. Defaults to the AREA benchmark
    // (e.g. Maldon 4.7%); a Capitalisation override sticks and flows through to Exit/HRA
    // via dealYield(). Net initial = net of voids, management, maintenance & insurance.
    var areaYieldPct=(typeof areaYield==="function")?areaYield(data):4.7;
    var yieldPct=(typeof dealYield==="function")?dealYield(data):num(cap.targetYield||areaYieldPct);
    var selYield=yieldPct/100;
    var capValue=selYield>0?netAnnualIncome/selYield:0;
    var capValueMin=selYield>0?netAnnualIncome/(selYield+0.01):0;
    var capValueMax=selYield>0?netAnnualIncome/(selYield-0.01):0;
    var capPerUnit=totalUnitsCalc>0?capValue/totalUnitsCalc:0;

    // Gross initial yield on cost
    var buildCostEst=(num(rlvD.buildPsf||f.buildPsf||cityMkt.build||188))*units2*(num(rlvD.avgSqft||850));
    var landCostEst=num(l.price||rlvD.rlv||0);
    var totalCostEst=buildCostEst+landCostEst;
    var giy=totalCostEst>0?netAnnualIncome/totalCostEst*100:0;
    var profitOnCost=totalCostEst>0?(capValue-totalCostEst)/totalCostEst*100:0;

    // ── Yield table across all buyer types ────────────────────────────────
    var yieldTable=Object.keys(CAP_YIELDS).map(function(k){
      var y=CAP_YIELDS[k];
      return{
        buyer:k,
        minVal:netAnnualIncome/y.max,
        baseVal:netAnnualIncome/y.base,
        maxVal:netAnnualIncome/y.min,
        label:y.label,
        yield:y.base,
      };
    }).sort(function(a,b){return b.baseVal-a.baseVal;});

    // Sensitivity: ±5% rent vs ±0.5% yield
    function capAt(rentAdj, yAdj){
      return (netAnnualIncome*(1+rentAdj/100))/(selYield+yAdj/100);
    }
    var sensitivity=[
      [-10,-0.5],[-10,0],[-10,0.5],
      [0,-0.5],[0,0],[0,0.5],
      [10,-0.5],[10,0],[10,0.5],
    ].map(function(pair){
      return{rAdj:pair[0],yAdj:pair[1],val:capAt(pair[0],pair[1])};
    });

    return e("div",null,
      // HEADER
      // v9.40 — Headline now scheme-aware: shows Multi-Route blended GDV for SFH schemes,
      // BTR yield-based value for BTR/PRS schemes. Previously always showed BTR yield-based,
      // which was irrelevant for SFH multi-tenure schemes.
      (function(){
        var sfhMixHere = (data.sfh && data.sfh.mix) || [];
        var hasMultiRoute = sfhMixHere.some(function(r){ return r.tenure && r.tenure !== "private" && num(r.count)>0; });
        var hasPrsRetained = sfhMixHere.some(function(r){ return r.tenure === "retained_prs" && num(r.count)>0; });
        // For SFH schemes with no retained_prs: headline is the Multi-Route blended GDV
        // For BTR/PBSA schemes or schemes with retained_prs: headline is BTR yield-based capValue
        var headlineLabel, headlineValue, headlineSubtext;
        if(hasMultiRoute && !hasPrsRetained){
          // Pure SFH multi-tenure — use Multi-Route blended (read from data.capitalise if previously computed)
          var mrGdv = num(data.capitalise && data.capitalise.multiRouteGdv);
          if(mrGdv > 0){
            headlineLabel = "Blended realisable GDV";
            headlineValue = fmt(mrGdv);
            headlineSubtext = "Multi-route exit (after AHP/route discounts)";
          } else {
            // Multi-route card hasn't computed yet — fall through
            headlineLabel = "Capitalised value at "+pct(selYield*100)+" yield";
            headlineValue = fmt(capValue);
            headlineSubtext = fmt(capPerUnit)+" per unit";
          }
        } else {
          headlineLabel = "Capitalised value at "+pct(selYield*100)+" yield";
          headlineValue = fmt(capValue);
          headlineSubtext = fmt(capPerUnit)+" per unit";
        }
        return e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}},
          e("div",null,
            e("div",{style:{fontSize:11,color:"#7278A0",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:4}},"Capitalisation Calculator"),
            e("h2",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",margin:"0 0 4px"}},"£ Income & Investment Value"),
            e("p",{style:{fontSize:12,color:"#7278A0",lineHeight:1.7}},
              hasMultiRoute && !hasPrsRetained
                ? "Multi-tenure SFH scheme — primary GDV is the Multi-Route Exit Value (below). BTR yield-based capitalisation also available for sensitivity."
                : "What is the maximum selling price to a pension fund, BTR investor or family office? Set your bedroom mix and rents, then see the capitalised value at every yield."
            )
          ),
          e("div",{style:{textAlign:"right"}},
            e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:2}},headlineLabel),
            e("div",{style:{fontSize:28,fontWeight:800,color:"#2D7A65"}},headlineValue),
            e("div",{style:{fontSize:11,color:"#7278A0"}},headlineSubtext)
          )
        );
      })(),
      LiveMarketBanner(),

      // ── v9.39 — CAPITALISATION PIN + DRIFT ─────────────────────────────────
      // Same pattern as v9.36 RLV. Capitalisation has cascading dependencies:
      // - SFH mix totals drive bedroom mix
      // - Market rents from postcode/city drive base1bed
      // - Target yield can be modified by scenario apply (yieldAdj)
      // When pinned, snapshot tracks these. On drift, banner offers Re-sync / Keep / Unpin.
      (function(){
        // What can be pinned in Cap: rents, yield, deductions, bedroom mix
        var emptyFields = [];
        if(!num(cap.rent1)) emptyFields.push({k:"rent1", v:rent1, label:"1-bed rent £/mo"});
        if(!num(cap.rent2)) emptyFields.push({k:"rent2", v:rent2, label:"2-bed rent £/mo"});
        if(!num(cap.rent3)) emptyFields.push({k:"rent3", v:rent3, label:"3-bed rent £/mo"});
        if(!num(cap.rent4)) emptyFields.push({k:"rent4", v:rent4, label:"4-bed rent £/mo"});
        if(cap.beds1===undefined) emptyFields.push({k:"beds1", v:defaultMix[1], label:"1-bed units"});
        if(cap.beds2===undefined) emptyFields.push({k:"beds2", v:defaultMix[2], label:"2-bed units"});
        if(cap.beds3===undefined) emptyFields.push({k:"beds3", v:defaultMix[3], label:"3-bed units"});
        if(cap.beds4===undefined) emptyFields.push({k:"beds4", v:(defaultMix[4]+(defaultMix[5]||0)), label:"4-bed units"});

        // Drift check (only if pinned)
        var drift = [];
        if(cap._pinnedAt && cap._pinnedSnapshot){
          var snap = cap._pinnedSnapshot;
          var nowSfhTotal = defaultMixTotal;
          var nowRentBase = rentMonthly1bed;
          var nowTargetYield = selYield;
          var nowSfhMixHash = sfhMix.map(function(r){return (r.type||"")+":"+(r.count||0)+":"+(r.tenure||"");}).join("|");

          if(snap.sfh_total && nowSfhTotal && Math.abs(snap.sfh_total - nowSfhTotal) > 1)
            drift.push({field:"SFH plot total", was:snap.sfh_total, now:nowSfhTotal});
          if(snap.rent_base && nowRentBase && Math.abs(snap.rent_base - nowRentBase) > 5)
            drift.push({field:"1-bed market rent", was:"£"+snap.rent_base, now:"£"+nowRentBase});
          if(snap.target_yield && Math.abs(snap.target_yield - nowTargetYield) > 0.001)
            drift.push({field:"Target yield", was:(snap.target_yield*100).toFixed(2)+"%", now:(nowTargetYield*100).toFixed(2)+"%"});
          if(snap.sfh_mix_hash && snap.sfh_mix_hash !== nowSfhMixHash)
            drift.push({field:"SFH House Mix (rows or routes changed)", was:"earlier", now:"different"});
        }

        // CASE 1: Drift detected on pinned Cap
        if(drift.length > 0){
          return e("div",{style:{padding:"12px 14px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.4)",borderRadius:8,marginBottom:14}},
            e("div",{style:{marginBottom:10}},
              e("div",{style:{fontSize:11,fontWeight:800,color:"#B05A35",letterSpacing:".05em",textTransform:"uppercase",marginBottom:6}},
                "⚠ Upstream changed since Capitalisation was pinned"
              ),
              e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
                "Pinned ",new Date(cap._pinnedAt).toLocaleString("en-GB"),". ",
                e("strong",null,drift.length+" upstream value"+(drift.length>1?"s have":" has")+" changed."),
                " Decide whether to keep pinned values or re-sync."
              )
            ),
            e("div",{style:{padding:"8px 10px",background:"#fff",borderRadius:5,border:"1px solid #F0DACA",marginBottom:10}},
              drift.map(function(d, i){
                return e("div",{key:i,style:{display:"grid",gridTemplateColumns:"1.4fr 90px 90px",fontSize:10,padding:"4px 0",borderBottom:i<drift.length-1?"1px solid #F8F1E8":"none",gap:8,alignItems:"center"}},
                  e("span",{style:{color:"#3A3D6A",fontWeight:600}},d.field),
                  e("span",{style:{color:"#7278A0"}},"was: ",e("strong",null,String(d.was))),
                  e("span",{style:{color:"#B05A35"}},"now: ",e("strong",null,String(d.now)))
                );
              })
            ),
            e("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
              e("button",{
                onClick:function(){
                  if(!window.confirm("Re-sync Cap: clear pinned bedroom/rent/yield values so they recompute from current upstream?")) return;
                  setData(function(prev){
                    var capNext = Object.assign({},prev.capitalise||{});
                    delete capNext.rent1; delete capNext.rent2; delete capNext.rent3; delete capNext.rent4;
                    delete capNext.beds1; delete capNext.beds2; delete capNext.beds3; delete capNext.beds4;
                    delete capNext._pinnedAt; delete capNext._pinnedSnapshot;
                    return Object.assign({},prev,{capitalise:capNext});
                  });
                },
                style:{padding:"7px 14px",background:"#B05A35",border:"none",color:"#fff",borderRadius:5,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"Re-sync to current →"),
              e("button",{
                onClick:function(){
                  if(!window.confirm("Keep pinned Cap values? Snapshot refreshes to today, warning clears.")) return;
                  setData(function(prev){
                    var capNext = Object.assign({},prev.capitalise||{});
                    capNext._pinnedSnapshot = {
                      sfh_total: defaultMixTotal,
                      rent_base: rentMonthly1bed,
                      target_yield: selYield,
                      sfh_mix_hash: sfhMix.map(function(r){return (r.type||"")+":"+(r.count||0)+":"+(r.tenure||"");}).join("|")
                    };
                    capNext._pinnedAt = new Date().toISOString();
                    return Object.assign({},prev,{capitalise:capNext});
                  });
                },
                style:{padding:"7px 14px",background:"transparent",border:"1px solid #B05A35",color:"#B05A35",borderRadius:5,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"Keep my values"),
              e("button",{
                onClick:function(){
                  setData(function(prev){
                    var capNext = Object.assign({},prev.capitalise||{});
                    delete capNext._pinnedAt; delete capNext._pinnedSnapshot;
                    return Object.assign({},prev,{capitalise:capNext});
                  });
                },
                style:{padding:"7px 14px",background:"transparent",border:"1px solid #C5C8E0",color:"#7278A0",borderRadius:5,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"Unpin entirely")
            )
          );
        }

        // CASE 2: Pinned & no drift — small green confirmation
        if(cap._pinnedAt && cap._pinnedSnapshot){
          var pinDate = new Date(cap._pinnedAt);
          var hoursAgo = Math.round((Date.now() - pinDate.getTime()) / 3600000);
          var timeLabel = hoursAgo < 1 ? "just now" : hoursAgo < 24 ? hoursAgo+"h ago" : Math.round(hoursAgo/24)+"d ago";
          return e("div",{style:{padding:"10px 14px",background:"rgba(45,122,101,0.06)",border:"1px solid rgba(45,122,101,0.25)",borderRadius:8,marginBottom:14,display:"flex",alignItems:"center",gap:10}},
            e("span",{style:{fontSize:14}},"🔒"),
            e("div",{style:{flex:1}},
              e("div",{style:{fontSize:11,fontWeight:700,color:"#2D7A65"}},"Capitalisation pinned · upstream unchanged"),
              e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2}},"Pinned "+timeLabel+". SFH totals, market rents, and target yield all match the snapshot.")
            ),
            e("button",{
              onClick:function(){
                if(!window.confirm("Clear pin? Cap will go back to using live auto-defaults.")) return;
                setData(function(prev){
                  var capNext = Object.assign({},prev.capitalise||{});
                  delete capNext._pinnedAt; delete capNext._pinnedSnapshot;
                  return Object.assign({},prev,{capitalise:capNext});
                });
              },
              style:{padding:"5px 10px",background:"transparent",border:"1px solid rgba(45,122,101,0.4)",color:"#2D7A65",borderRadius:4,fontSize:9,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },"Unpin")
          );
        }

        // CASE 3: Not pinned, fields are empty (using auto-defaults) — offer Pin
        if(emptyFields.length === 0) return null;

        return e("div",{style:{padding:"12px 14px",background:"rgba(154,123,62,0.06)",border:"1px solid rgba(154,123,62,0.3)",borderRadius:8,marginBottom:14}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}},
            e("div",{style:{flex:1,minWidth:240}},
              e("div",{style:{fontSize:11,fontWeight:800,color:"#9A7B3E",letterSpacing:".05em",textTransform:"uppercase",marginBottom:6}},
                "⚠ "+emptyFields.length+" Cap field"+(emptyFields.length>1?"s":"")+" using upstream auto-defaults"
              ),
              e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:6}},
                "Bedroom mix derives from SFH, rents from postcode lookup. These will shift if upstream changes. Click 'Pin to current values' to lock them."
              ),
              e("div",{style:{fontSize:10,color:"#7278A0",lineHeight:1.5}},
                "Empty fields: ",emptyFields.slice(0,6).map(function(f){return f.label;}).join(", "),
                (emptyFields.length>6?" + "+(emptyFields.length-6)+" more":"")
              )
            ),
            e("button",{
              onClick:function(){
                if(!window.confirm("Pin all "+emptyFields.length+" empty Cap fields to current auto-default values? After this, changing SFH/Land won't affect Cap.")) return;
                setData(function(prev){
                  var capNext = Object.assign({},prev.capitalise||{});
                  emptyFields.forEach(function(f){ capNext[f.k] = String(f.v); });
                  capNext._pinnedAt = new Date().toISOString();
                  capNext._pinnedSnapshot = {
                    sfh_total: defaultMixTotal,
                    rent_base: rentMonthly1bed,
                    target_yield: num(prev.capitalise&&prev.capitalise.targetYield)||0.045,
                    sfh_mix_hash: sfhMix.map(function(r){return (r.type||"")+":"+(r.count||0)+":"+(r.tenure||"");}).join("|")
                  };
                  return Object.assign({},prev,{capitalise:capNext});
                });
              },
              style:{padding:"9px 14px",background:"#9A7B3E",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",flexShrink:0}
            },"🔒 Pin to current values")
          )
        );
      })(),

      // ── v9.30 — MULTI-ROUTE EXIT CAPITALISATION ────────────────────────────
      // Aggregates SFH mix by exit route (private retail / pension / AHP / PRS / First Homes)
      // and applies route-specific discounts to derive realisable GDV per route.
      (function(){
        var mix = (data.sfh && data.sfh.mix) || [];
        if(mix.length === 0) return null;
        var hasExitData = mix.some(function(r){return r.tenure && num(r.count)>0;});
        if(!hasExitData) return null;

        // Route-specific discount table — v9.40: now defined at module level so SFH stage uses the same values.
        // Cap render's retained_prs is handled separately by yield calc below (line ~8503 skips it).

        // Aggregate by tenure
        var byRoute = {};
        var totalUnits = 0;
        var mvAtFullRetail = 0;
        mix.forEach(function(row){
          var cnt = num(row.count);
          if(cnt <= 0) return;
          var info = HOUSE_TYPES[row.type] || HOUSE_TYPES["3-bed semi"];
          var basePsf2 = num((data.sfh&&data.sfh.basePsf)) || 297;
          var sp = num(row.psf) || (basePsf2 * (info.adj || 1));
          var revenuePerUnit = (info.sqft || num(row.sqft) || 850) * sp;
          var unitOverride = num(row.unitPrice);
          if(unitOverride > 0) revenuePerUnit = unitOverride;
          var route = row.tenure || "private";
          if(!byRoute[route]) byRoute[route] = {units:0, fullMv:0, sqft:0};
          byRoute[route].units += cnt;
          byRoute[route].fullMv += revenuePerUnit * cnt;
          byRoute[route].sqft += (info.sqft || 850) * cnt;
          totalUnits += cnt;
          mvAtFullRetail += revenuePerUnit * cnt;
        });

        // For retained PRS: compute capitalised value from yield
        var targetYield = selYield;  // v9.53 — single net initial yield (area benchmark unless overridden)
        if(targetYield > 1) targetYield = targetYield / 100;  // accept 4.5 or 0.045
        // Yield-based (rental-model) routes: Retained PRS + BTR-operator sale.
        // Both are capitalised at the target yield with NO affordable discount —
        // a BTR operator pays the full uncapped rental value (Phil: "100% of value").
        var YIELD_ROUTES = ["retained_prs","btr_operator"];
        YIELD_ROUTES.forEach(function(yr){
          if(!byRoute[yr]) return;
          var yUnits = byRoute[yr].units;
          var avgMonthly = grossMonthly && totalUnitsCalc ? grossMonthly / totalUnitsCalc : (base1bed * 1.4);
          var yAnnualRent = avgMonthly * 12 * yUnits;
          var yNoi = yAnnualRent * (1 - totalDed);
          var yCap = targetYield > 0 ? yNoi / targetYield : 0;
          byRoute[yr].realised = yCap;
          byRoute[yr].prsAnnualRent = yAnnualRent;
          byRoute[yr].prsNoi = yNoi;
        });
        // Apply discount for the remaining (sale-based) routes
        Object.keys(byRoute).forEach(function(route){
          if(YIELD_ROUTES.indexOf(route) >= 0) return;
          var disc = (ROUTE_DISCOUNT[route] || ROUTE_DISCOUNT.private).pct;
          byRoute[route].realised = byRoute[route].fullMv * disc;
        });
        var totalRealised = Object.keys(byRoute).reduce(function(sum,k){return sum + (byRoute[k].realised||0);},0);
        var blendedDiscount = mvAtFullRetail > 0 ? (1 - totalRealised/mvAtFullRetail) : 0;

        // ── v9.33 — Per-route profit calc ──────────────────────────────────
        // For each route, compute apportioned build + soft costs and resulting profit.
        // Especially important for PRIVATE retail — Phil wants to see how the deal evolves
        // route by route, not just one blended GDV.
        var s2 = data.sfh || {};
        var routeBuildPsf = num(s2.buildPsf) || 225;  // v9.33 default
        var routeProfitTargetPct = numOr(s2.profitPct, 17.5) / 100;
        var routeFeesPct = numOr(s2.feesPct, 10) / 100;  // typical 10% prof fees
        var routeContPct = numOr(s2.contingency, 5) / 100;
        var routeFinPct = numOr(s2.finRate, 7.5) / 100;
        var routeS106Pu = numOr(s2.s106pu, 11000);
        var routeRoadsPu = numOr(s2.roads, 12000);

        var totalCostsAcross = 0;
        var totalProfitAcross = 0;
        Object.keys(byRoute).forEach(function(route){
          var r = byRoute[route];
          // Build cost = sqft × £/sqft
          var buildCost = r.sqft * routeBuildPsf;
          var fees = buildCost * routeFeesPct;
          var contingency = (buildCost + fees) * routeContPct;
          var s106 = r.units * routeS106Pu;
          var roads = r.units * routeRoadsPu;
          var financeCost = (buildCost + fees + s106 + roads) * routeFinPct;  // simplified
          var totalCost = buildCost + fees + contingency + s106 + roads + financeCost;
          r.buildCost = buildCost;
          r.fees = fees;
          r.contingency = contingency;
          r.s106 = s106;
          r.roads = roads;
          r.financeCost = financeCost;
          r.totalCost = totalCost;
          r.profit = r.realised - totalCost;
          r.marginPct = r.realised > 0 ? (r.profit / r.realised) * 100 : 0;
          totalCostsAcross += totalCost;
          totalProfitAcross += r.profit;
        });
        var blendedMarginPct = totalRealised > 0 ? (totalProfitAcross / totalRealised) * 100 : 0;

        // Sort routes by # units desc
        var routeOrder = Object.keys(byRoute).sort(function(a,b){return byRoute[b].units - byRoute[a].units;});

        return e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14,flexWrap:"wrap",gap:8}},
            e("div",null,
              e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}},"Multi-route exit value"),
              e("div",{style:{fontSize:10,color:"#7278A0"}},"Aggregating "+totalUnits+" units from SFH House Mix by Exit Route, with route-specific discounts.")
            ),
            e("div",{style:{textAlign:"right"}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em"}},"Blended realisable"),
              e("div",{style:{fontSize:22,fontWeight:800,color:"#2D7A65"}},fmt(totalRealised)),
              e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2}},"vs. "+fmt(mvAtFullRetail)+" if all sold private ("+Math.round(blendedDiscount*100)+"% blended discount)")
            )
          ),

          // F1 — combined land value reconciliation (sale vs rental), shared with Dashboard/Tenure/Summary
          LandReconciliationPanel(data, up),

          // Per-route breakdown table
          e("div",{style:{display:"grid",gridTemplateColumns:"1.8fr 60px 70px 100px 100px 100px",padding:"8px 12px",background:"#2E2F8A",fontSize:9,color:"#fff",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,gap:8,borderRadius:"5px 5px 0 0"}},
            e("span",null,"Sale route"),e("span",null,"Units"),e("span",null,"% of scheme"),e("span",null,"Sale @ Full MV"),e("span",null,"Discount %"),e("span",null,"Realised sale")
          ),
          routeOrder.map(function(route){
            var r = byRoute[route];
            var rd = ROUTE_DISCOUNT[route] || ROUTE_DISCOUNT.private;
            var pctOfScheme = totalUnits > 0 ? Math.round(r.units / totalUnits * 100) : 0;
            var discPct = route === "retained_prs" ? "yield-based" : Math.round((1 - rd.pct) * 100) + "%";
            // v9.33 — Route-level cost & profit colour
            var profitCol = r.profit > 0 ? "#2D7A65" : (r.profit < -1000 ? "#B05A35" : "#9A7B3E");
            return e("div",{key:route,style:{display:"grid",gridTemplateColumns:"1.8fr 60px 70px 100px 100px 100px",padding:"10px 12px",borderBottom:"1px solid #DDE0ED",gap:8,alignItems:"center",fontSize:11}},
              e("div",null,
                e("div",{style:{fontSize:11,fontWeight:700,color:rd.col}},rd.label),
                e("div",{style:{fontSize:9,color:"#7278A0",marginTop:2}},
                  e("span",{style:{fontWeight:700,color:"#3A3D6A"}},"Sale route. "),rd.note
                ),
                // v9.53 — Build COST is clearly separated from the SALE route above.
                // "£212/sqft" is what it COSTS to build — NOT a bulk-sale price.
                e("div",{style:{fontSize:9,color:profitCol,marginTop:4,fontWeight:600,lineHeight:1.5}},
                  e("span",{style:{color:"#7278A0"}},"Cost to build & deliver: "),
                  "build £"+fmtCompact(r.buildCost)+" (£"+routeBuildPsf+"/sqft) · fees/S106/roads £"+fmtCompact(r.fees+r.s106+r.roads+r.contingency)+" · finance £"+fmtCompact(r.financeCost),
                  e("br",null),
                  e("span",{style:{fontWeight:800,color:profitCol}},"Profit "+(r.profit<0?"−":"")+"£"+fmtCompact(Math.abs(r.profit))+" · Margin "+Math.round(r.marginPct)+"%")
                ),
                route === "retained_prs" && r.prsAnnualRent && e("div",{style:{fontSize:9,color:"#9A7B3E",marginTop:3,fontStyle:"italic"}},
                  "Rent £"+Math.round(r.prsAnnualRent/1000)+"k/yr · NOI £"+Math.round(r.prsNoi/1000)+"k · cap @ "+(targetYield*100).toFixed(2)+"%"
                )
              ),
              e("span",{style:{fontWeight:700,color:"#2E2F8A"}},r.units),
              e("span",{style:{color:"#7278A0"}},pctOfScheme+"%"),
              e("span",{style:{color:"#7278A0"}},fmt(r.fullMv)),
              e("span",{style:{color:route==="retained_prs"?"#B05A35":(rd.pct===1?"#7278A0":"#B05A35"),fontWeight:600}},discPct),
              e("span",{style:{fontWeight:700,color:rd.col}},fmt(r.realised))
            );
          }),
          // Total row
          e("div",{style:{display:"grid",gridTemplateColumns:"1.8fr 60px 70px 100px 100px 100px",padding:"12px",background:"#F4F5FB",borderTop:"2px solid #2E2F8A",gap:8,alignItems:"center",fontSize:12,fontWeight:700,color:"#2E2F8A"}},
            e("span",null,"BLENDED REALISABLE GDV"),
            e("span",null,totalUnits),
            e("span",null,"100%"),
            e("span",{style:{color:"#7278A0"}},fmt(mvAtFullRetail)),
            e("span",{style:{color:blendedDiscount>0?"#B05A35":"#7278A0"}},Math.round(blendedDiscount*100)+"% blended"),
            e("span",{style:{color:"#2D7A65",fontWeight:800}},fmt(totalRealised))
          ),

          // v9.33 — DEAL EVOLUTION SUMMARY
          // Phil's specific request: "i want the profit of the private sales added so we know how the whole deal would evolve"
          e("div",{style:{marginTop:14,padding:"14px 16px",background:"linear-gradient(135deg,#F8F9FC,#FBFCFF)",border:"1px solid #C5C8E0",borderRadius:8}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
              e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em"}},"Deal evolution — full P&L across all routes"),
              e("div",{style:{fontSize:9,color:"#7278A0"}},"Build cost £"+routeBuildPsf+"/sqft (to construct, not a sale price) · Profit target "+Math.round(routeProfitTargetPct*100)+"% · From SFH inputs")
            ),
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:8}},
              // Total Revenue (Realised)
              e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:6,padding:"10px 12px"}},
                e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700}},"Revenue"),
                e("div",{style:{fontSize:16,fontWeight:800,color:"#2D7A65",marginTop:3}},fmt(totalRealised)),
                e("div",{style:{fontSize:9,color:"#7278A0",marginTop:2}},"Blended realisable GDV")
              ),
              // Total Costs
              e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:6,padding:"10px 12px"}},
                e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700}},"Total Costs"),
                e("div",{style:{fontSize:16,fontWeight:800,color:"#B05A35",marginTop:3}},fmt(totalCostsAcross)),
                e("div",{style:{fontSize:9,color:"#7278A0",marginTop:2}},"Build + fees + S106 + roads + finance")
              ),
              // Total Profit
              e("div",{style:{background:"#fff",border:"2px solid "+(totalProfitAcross>0?"#2D7A65":"#B05A35"),borderRadius:6,padding:"10px 12px"}},
                e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700}},"Pre-Land Profit"),
                e("div",{style:{fontSize:16,fontWeight:800,color:totalProfitAcross>0?"#2D7A65":"#B05A35",marginTop:3}},(totalProfitAcross<0?"−":"")+fmt(Math.abs(totalProfitAcross))),
                e("div",{style:{fontSize:9,color:"#7278A0",marginTop:2}},"Revenue minus all costs (excl. land)")
              ),
              // Blended Margin
              e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:6,padding:"10px 12px"}},
                e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700}},"Blended Margin"),
                e("div",{style:{fontSize:16,fontWeight:800,color:blendedMarginPct>=15?"#2D7A65":blendedMarginPct>=10?"#9A7B3E":"#B05A35",marginTop:3}},Math.round(blendedMarginPct)+"%"),
                e("div",{style:{fontSize:9,color:"#7278A0",marginTop:2}},(blendedMarginPct>=17.5?"Above target ✓":blendedMarginPct>=15?"Near target":blendedMarginPct>=10?"Below target":"Loss-making"))
              )
            ),
            // v9.53 — S106 ALLOWANCE — its own clearly-labelled line (total £ and £/unit).
            // Previously S106 was only buried inside "Build + fees + S106 + roads".
            e("div",{style:{marginTop:10,padding:"10px 12px",background:"rgba(154,123,62,0.08)",borderLeft:"3px solid #9A7B3E",borderRadius:4,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}},
              e("div",null,
                e("span",{style:{fontSize:10,fontWeight:800,color:"#9A7B3E",textTransform:"uppercase",letterSpacing:".08em"}},"S106 / planning obligations allowance"),
                e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2}},"Included in Total Costs above · set per-unit on the SFH House Mix")
              ),
              e("div",{style:{textAlign:"right"}},
                e("div",{style:{fontSize:16,fontWeight:800,color:"#9A7B3E"}},fmt(totalUnits*routeS106Pu)),
                e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2}},"£"+fmtN(routeS106Pu)+"/unit × "+totalUnits+" units")
              )
            ),
            // Private-sales specific spotlight
            byRoute.private && e("div",{style:{marginTop:10,padding:"10px 12px",background:"rgba(45,122,101,0.06)",borderLeft:"3px solid #2D7A65",borderRadius:4}},
              e("div",{style:{fontSize:10,fontWeight:700,color:"#2D7A65",marginBottom:4,textTransform:"uppercase",letterSpacing:".08em"}},"Private sales spotlight"),
              e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
                e("strong",null,byRoute.private.units+" units"),
                " sold private retail at full MV: revenue ",
                e("strong",null,fmt(byRoute.private.realised)),
                ", costs ",fmt(byRoute.private.totalCost),
                " → ",
                e("strong",{style:{color:byRoute.private.profit>0?"#2D7A65":"#B05A35"}},
                  "private-sales profit "+(byRoute.private.profit<0?"−":"")+fmt(Math.abs(byRoute.private.profit))
                ),
                " ("+Math.round(byRoute.private.marginPct)+"% margin)"
              )
            )
          ),

          // Save total for downstream use
          (function(){
            // Persist multi-route blended GDV for IM/teaser/dashboard to reference
            var existing = num(data.capitalise && data.capitalise.multiRouteGdv);
            if(Math.abs(existing - totalRealised) > 1000){
              setTimeout(function(){
                setData(function(prev){
                  var capNext = Object.assign({},prev.capitalise||{},{multiRouteGdv:Math.round(totalRealised), multiRouteFullMv:Math.round(mvAtFullRetail), multiRouteBlendedDiscount:Math.round(blendedDiscount*1000)/10});
                  return Object.assign({},prev,{capitalise:capNext});
                });
              },0);
            }
            return null;
          })(),

          // Footer note
          e("div",{style:{marginTop:12,padding:"10px 12px",background:"#F8F9FC",borderLeft:"3px solid #2D7A65",borderRadius:4,fontSize:10,color:"#7278A0",lineHeight:1.6}},
            e("strong",{style:{color:"#3A3D6A"}},"Build cost vs sale price: "),
            "the £/sqft figure on each row is the ",e("strong",null,"cost to build"),", not a sale price. The ",e("strong",null,"sale route"),
            " (private / pension bulk / AHP / PRS) sets the realised sale via the discount column. ",
            e("br",null),
            e("strong",{style:{color:"#3A3D6A"}},"Discount sources: "),
            "Pension/SFR bulk = 12% institutional (Savills/Knight Frank benchmarks). AHP discounts = Homes England valuation methodology. First Homes = National Planning Policy cap. Retained PRS = NPV of rent stream at the net initial yield. ",
            "Override any unit price by entering it manually in SFH House Mix."
          )
        );
      })(),

      // ── BEDROOM MIX & RENTS ────────────────────────────────────────────────
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}},"Bedroom Mix & Market Rents"),

        // v9.38 — Scheme-purpose banner
        // Phil's confusion: this section showed 70 units when his SFH has 200. The bedroom mix +
        // yield calc here is only meaningful for retained-PRS units. For schemes that exit via
        // private retail / pension bulk / AHP, the Multi-Route Exit Value card above is the real GDV.
        (function(){
          var prsUnits = 0;
          if(sfhMix.length > 0){
            sfhMix.forEach(function(r){
              if(r.tenure === "retained_prs") prsUnits += num(r.count||0);
            });
          }
          var hasOtherRoutes = sfhMix.some(function(r){ return r.tenure && r.tenure !== "retained_prs" && num(r.count||0) > 0; });
          if(prsUnits === 0 && hasOtherRoutes){
            return e("div",{style:{marginBottom:14,padding:"10px 12px",background:"rgba(74,75,174,0.06)",borderLeft:"3px solid #4A4BAE",borderRadius:4,fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
              e("strong",{style:{color:"#2E2F8A"}},"ℹ Note: This section is for capitalising RETAINED PRS units (rental-yield basis). "),
              "Your SFH scheme has ",e("strong",null,"0 retained PRS units")," — all units exit via Private retail / Pension / AHP routes. ",
              e("strong",null,"The Multi-Route Exit Value card above is your primary GDV calculation."),
              " The figures below are informational only and won't affect your scheme value."
            );
          }
          if(prsUnits > 0){
            return e("div",{style:{marginBottom:14,padding:"10px 12px",background:"rgba(45,122,101,0.06)",borderLeft:"3px solid #2D7A65",borderRadius:4,fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
              e("strong",{style:{color:"#2D7A65"}},"✓ Your scheme has "+prsUnits+" units retained for PRS. "),
              "This section capitalises that portion on rental yield. The Multi-Route card above uses the result for the PRS row."
            );
          }
          return null;
        })(),

        // v9.38 — Drift detection: cap.beds vs SFH-derived totals
        (function(){
          if(sfhMix.length === 0) return null;
          var sfhTotal = defaultMixTotal;
          var capTotal = beds1+beds2+beds3+beds4;
          if(sfhTotal === 0) return null;
          // v9.45 — compare the PER-BEDROOM split, not just the total. A wrong split that
          // happens to sum to the same total (e.g. both 200) previously slipped through
          // because only totals were compared — so stale pinned values showed no warning.
          var sfh4 = defaultMix[4]+defaultMix[5];
          var bucketDiff = Math.abs(beds1-defaultMix[1])+Math.abs(beds2-defaultMix[2])+Math.abs(beds3-defaultMix[3])+Math.abs(beds4-sfh4);
          if(bucketDiff < 2) return null;  // in sync (allow tiny rounding)
          return e("div",{style:{marginBottom:14,padding:"12px 14px",background:"rgba(176,90,53,0.07)",border:"1px solid rgba(176,90,53,0.35)",borderRadius:6}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}},
              e("div",{style:{flex:1,minWidth:240}},
                e("div",{style:{fontSize:11,fontWeight:800,color:"#B05A35",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}},"⚠ Bedroom mix out of sync with SFH House Mix"),
                e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:6}},
                  "Your bedroom split here doesn't match your SFH House Mix"+(capTotal===sfhTotal?" — the totals match ("+capTotal+"), but the per-bedroom breakdown differs":" (Cap "+capTotal+" vs SFH "+sfhTotal+")")+". These look like stale saved values. Click sync to refresh from SFH."
                ),
                e("div",{style:{fontSize:10,color:"#7278A0"}},
                  "Cap here: 1-bed ",beds1,", 2-bed ",beds2,", 3-bed ",beds3,", 4-bed ",beds4,
                  " · SFH House Mix: 1-bed ",defaultMix[1],", 2-bed ",defaultMix[2],", 3-bed ",defaultMix[3],", 4-bed ",sfh4,
                  (defaultMix[5] > 0 ? " (incl. "+defaultMix[5]+" 5-bed rolled in)" : "")
                )
              ),
              e("button",{
                onClick:function(){
                  if(!window.confirm("Sync bedroom mix to current SFH House Mix?\n\n• 1-bed: "+defaultMix[1]+"\n• 2-bed: "+defaultMix[2]+"\n• 3-bed: "+defaultMix[3]+"\n• 4-bed: "+(defaultMix[4]+defaultMix[5])+(defaultMix[5]>0?" (incl. "+defaultMix[5]+" 5-bed)":""))) return;
                  setData(function(prev){
                    var capNext = Object.assign({},prev.capitalise||{},{
                      beds1: String(defaultMix[1]),
                      beds2: String(defaultMix[2]),
                      beds3: String(defaultMix[3]),
                      beds4: String(defaultMix[4]+defaultMix[5])
                    });
                    return Object.assign({},prev,{capitalise:capNext});
                  });
                },
                style:{padding:"8px 12px",background:"#B05A35",border:"none",color:"#fff",borderRadius:5,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}
              },"Sync from SFH →")
            )
          );
        })(),

        e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:12}},
          "Rents auto-populated from "+rentSourceLabel+" at 100% of the local market. Adjust to match your scheme. Area rent: 1-bed £"+rent1+"/mo, 2-bed £"+rent2+", 3-bed £"+rent3+", 4-bed £"+rent4+"/mo."
        ),
        // v9.52 — Scheme-type banner + affordable-rent discount radio buttons.
        (function(){
          var at2=(data.assetType||"").toLowerCase();
          var typeLabel=at2==="btr"?"Build-to-Rent (BTR)":at2==="pbsa"?"Purpose-Built Student (PBSA)":at2==="sfh"?"Single-family housing":at2==="property"?"Existing property":"Residential";
          return e("div",{style:{margin:"0 0 14px",padding:"12px 14px",background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.25)",borderRadius:8}},
            e("div",{style:{fontSize:11,color:"#3A3D6A",marginBottom:8,lineHeight:1.5}},
              e("strong",null,"This is a "+typeLabel+" scheme.")," It's valued by capitalising the net rent at the net initial yield ("+yieldPct+"%"+(num(cap.targetYield)>0?", your override":", "+cityName(city||"")+" benchmark")+"). Market homes rent at 100% of the local area rent above."
            ),
            e("div",{style:{fontSize:11,fontWeight:800,color:"#2E2F8A",marginBottom:6}},
              "🏷 Affordable rent discount"+(ahFracCap>0?" — applied to "+Math.round(ahFracCap*100)+"% of units (from the Tenure Mix)":" — set the affordable % in Tenure Mix or Planning to use this")
            ),
            e("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
              [{l:"Market (0%)",v:0},{l:"−20% Affordable Rent",v:20},{l:"−30%",v:30},{l:"−40%",v:40},{l:"−50% Social Rent",v:50}].map(function(o){
                var sel=Math.round(ahRentDisc*100)===o.v;
                return e("button",{key:o.v,onClick:function(){up("capitalise","ahRentDisc",o.v);},style:{padding:"5px 12px",background:sel?"#4A4BAE":"#fff",color:sel?"#fff":"#3A3D6A",border:"1px solid "+(sel?"#4A4BAE":"#DDE0ED"),borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},o.l);
              })
            ),
            (ahFracCap>0 && ahRentDisc>0) && e("div",{style:{fontSize:10,color:"#2D7A65",marginTop:8,lineHeight:1.5}},"→ Blended rent = "+Math.round(rentBlendFactor*100)+"% of market ("+Math.round((1-ahFracCap)*100)+"% market + "+Math.round(ahFracCap*100)+"% affordable at "+Math.round(ahRentDisc*100)+"% off). NOI "+fmt(netAnnualIncome)+" pa → capitalised value "+fmt(capValue)+".")
          );
        })(),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}},
          [{beds:1,k:"beds1",rk:"rent1",def:defaultMix[1],defR:rent1,col:"#4A4BAE"},
           {beds:2,k:"beds2",rk:"rent2",def:defaultMix[2],defR:rent2,col:"#2D7A65"},
           {beds:3,k:"beds3",rk:"rent3",def:defaultMix[3],defR:rent3,col:"#9A7B3E"},
           {beds:4,k:"beds4",rk:"rent4",def:defaultMix[4],defR:rent4,col:"#B05A35"},
          ].map(function(item){
            var cnt=item.k==="beds1"?beds1:item.k==="beds2"?beds2:item.k==="beds3"?beds3:beds4;
            var rnt=item.rk==="rent1"?rent1:item.rk==="rent2"?rent2:item.rk==="rent3"?rent3:rent4;
            var annualIncome=cnt*rnt*12;
            return e("div",{key:item.beds,style:{background:"#F7F8FC",borderRadius:8,padding:"14px",borderTop:"3px solid "+item.col}},
              e("div",{style:{fontSize:11,fontWeight:800,color:item.col,marginBottom:8}},item.beds+" Bedroom"),
              e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}},
                e("div",null,
                  e("label",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",display:"block",marginBottom:2}},"Units"),
                  e("input",{type:"number",min:0,value:cnt,onChange:function(ev){up("capitalise",item.k,Number(ev.target.value));},
                    style:{width:"100%",padding:"6px 8px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:12,fontFamily:"DM Mono,monospace",textAlign:"center"}})
                ),
                e("div",null,
                  e("label",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",display:"block",marginBottom:2}},"Rent £/mo"),
                  e("input",{type:"number",min:0,value:rnt,onChange:function(ev){up("capitalise",item.rk,Number(ev.target.value));},
                    style:{width:"100%",padding:"6px 8px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:12,fontFamily:"DM Mono,monospace",textAlign:"center"}})
                )
              ),
              e("div",{style:{fontSize:10,color:"#7278A0"}},fmt(annualIncome)+" pa gross"),
              e("div",{style:{fontSize:11,fontWeight:700,color:item.col,marginTop:2}},"£"+rnt+"/month")
            );
          })
        ),

        // F3 — custom unit-type rent cards (e.g. a 4-bed detached at a higher rent, separate from 4-bed semi)
        rentExtra.length>0 && e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:12}},
          rentExtra.map(function(c,ci){
            var cMonthly=num(c.count)*num(c.rent);
            return e("div",{key:"x"+ci,style:{background:"#FBFAF6",borderRadius:8,padding:"14px",borderTop:"3px solid #7278A0",position:"relative"}},
              e("button",{onClick:function(){var a=rentExtra.slice();a.splice(ci,1);up("capitalise","rentExtra",a);},title:"Remove this unit type",style:{position:"absolute",top:6,right:8,background:"none",border:"none",color:"#B05A35",fontSize:15,fontWeight:700,cursor:"pointer",lineHeight:1}},"×"),
              e("select",{value:c.type||"4-bed detached",onChange:function(ev){var a=rentExtra.slice();a[ci]=Object.assign({},a[ci],{type:ev.target.value});up("capitalise","rentExtra",a);},style:{width:"100%",padding:"5px 6px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#2E2F8A",marginBottom:8,fontFamily:"DM Sans,sans-serif"}},
                RENT_UNIT_TYPES.map(function(t){return e("option",{key:t,value:t},t);})
              ),
              e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}},
                e("div",null,
                  e("label",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",display:"block",marginBottom:2}},"Units"),
                  e("input",{type:"number",min:0,value:c.count||"",onChange:function(ev){var a=rentExtra.slice();a[ci]=Object.assign({},a[ci],{count:ev.target.value});up("capitalise","rentExtra",a);},
                    style:{width:"100%",padding:"6px 8px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:12,fontFamily:"DM Mono,monospace",textAlign:"center"}})
                ),
                e("div",null,
                  e("label",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",display:"block",marginBottom:2}},"Rent £/mo"),
                  e("input",{type:"number",min:0,value:c.rent||"",onChange:function(ev){var a=rentExtra.slice();a[ci]=Object.assign({},a[ci],{rent:ev.target.value});up("capitalise","rentExtra",a);},
                    style:{width:"100%",padding:"6px 8px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:12,fontFamily:"DM Mono,monospace",textAlign:"center"}})
                )
              ),
              e("div",{style:{fontSize:10,color:"#7278A0"}},fmt(cMonthly*12)+" pa gross")
            );
          })
        ),
        e("button",{onClick:function(){var a=rentExtra.slice();a.push({type:"4-bed detached",count:"",rent:rent4||Math.round(base1bed*(BED_MULT[4]||2)*1.15)});up("capitalise","rentExtra",a);},
          style:{padding:"6px 14px",background:"#F7F8FC",border:"1px dashed #C8CDE0",borderRadius:6,fontSize:11,fontWeight:700,color:"#4A4BAE",cursor:"pointer",fontFamily:"DM Sans,sans-serif",marginBottom:16}},
          "+ Add unit type (e.g. 4-bed detached)"),

        // Totals bar
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,background:"rgba(74,75,174,0.05)",borderRadius:8,padding:"12px 14px"}},
          [{l:"Total units",v:totalUnitsCalc},{l:"Gross monthly rent",v:"£"+Math.round(grossMonthly).toLocaleString()},{l:"Gross annual rent",v:fmt(grossAnnual)},{l:"Net annual income (NOI)",v:fmt(netAnnualIncome)}].map(function(item){
            return e("div",{key:item.l,style:{textAlign:"center"}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",marginBottom:2}},item.l),
              e("div",{style:{fontSize:14,fontWeight:800,color:"#2E2F8A"}},item.v)
            );
          })
        )
      ),

      // ── NOI DEDUCTIONS ─────────────────────────────────────────────────────
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}},"Net Operating Income — Deductions"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:12}},
          [{k:"voidRate",l:"Void rate %",def:5,note:"Industry standard 4-6%"},
           {k:"mgmtRate",l:"Management %",def:10,note:"Typically 8-12% of gross"},
           {k:"maintRate",l:"Maintenance %",def:8,note:"Typically 6-10% of gross"},
           {k:"insRate",l:"Insurance %",def:2,note:"Buildings insurance ~1-3%"},
          ].map(function(row){
            var val=row.k==="insRate"?2:num(cap[row.k]!==undefined?cap[row.k]:row.def);
            return e("div",{key:row.k},
              e("label",{style:{fontSize:10,color:"#7278A0",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:3}},row.l),
              row.k!=="insRate"?e("input",{type:"number",min:0,max:30,step:0.5,value:val,
                onChange:function(ev){up("capitalise",row.k,Number(ev.target.value));},
                style:{width:"100%",padding:"6px 8px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:12,fontFamily:"DM Mono,monospace"}
              }):e("div",{style:{padding:"7px 8px",background:"#F7F8FC",borderRadius:5,fontSize:12,fontFamily:"DM Mono,monospace",color:"#7278A0"}},"2% (fixed)"),
              e("div",{style:{fontSize:9,color:"#9A9AAE",marginTop:2}},row.note)
            );
          })
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,background:"rgba(45,122,101,0.05)",borderRadius:8,padding:"12px 14px"}},
          [{l:"Total deductions",v:pct(totalDed*100)+"  ("+pct(totalDed*100)+" of gross)"},{l:"Net rental income (NRI)",v:pct(nriMultiplier*100)+" of gross"},{l:"NOI per annum",v:fmt(netAnnualIncome)}].map(function(item){
            return e("div",{key:item.l,style:{textAlign:"center"}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:2}},item.l),
              e("div",{style:{fontSize:14,fontWeight:800,color:"#2D7A65"}},item.v)
            );
          })
        )
      ),

      // ── NET INITIAL YIELD SELECTOR + CAPITALISED VALUE ────────────────────
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
          e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em"}},"Capitalised Value — Net Initial Yield (%)"),
          e("div",{style:{fontSize:12,color:"#7278A0"}},"Lower yield = higher price. Pension funds buy at lowest yields.")
        ),
        // v9.53 — single net initial yield, clearly labelled and sourced. Used on Exit & HRA too.
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14,lineHeight:1.6}},
          "This is the ",e("strong",{style:{color:"#3A3D6A"}},"net initial yield"),
          " (net of voids, management, maintenance & insurance) — the ",e("strong",null,"one yield used across this whole appraisal")," (Capitalisation, Exit & HRA). ",
          num(cap.targetYield)>0
            ? e("span",null,"Currently your override of ",e("strong",{style:{color:"#2E2F8A"}},yieldPct+"%"),". ",e("button",{onClick:function(){up("capitalise","targetYield","");},style:{background:"none",border:"none",color:"#4A4BAE",fontSize:11,fontWeight:700,cursor:"pointer",padding:0,textDecoration:"underline",fontFamily:"DM Sans,sans-serif"}},"Reset to "+cityName(city||"")+" benchmark ("+areaYieldPct+"%)"))
            : e("span",null,"Defaulting to the ",e("strong",{style:{color:"#2E2F8A"}},cityName(city||"")+" benchmark ("+areaYieldPct+"%)"),". Move the slider to override.")
        ),
        e("div",{style:{marginBottom:16}},
          e("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:6}},
            e("span",{style:{fontSize:12,color:"#2E2F8A",fontWeight:600}},"Net initial yield: "+pct(selYield*100)),
            e("span",{style:{fontSize:20,fontWeight:800,color:"#2D7A65"}},fmt(capValue))
          ),
          e("input",{type:"range",min:3,max:9,step:0.25,
            value:yieldPct,
            onChange:function(ev){up("capitalise","targetYield",Number(ev.target.value));},
            style:{width:"100%",accentColor:"#2D7A65",cursor:"pointer"}
          }),
          e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:10,color:"#9A9AAE",marginTop:2}},
            e("span","3% (Pension grade)"),e("span","6% (Private)"),e("span","9% (Distressed)")
          )
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}},
          [{l:"Value (yield +1%)",v:fmt(capValueMin),c:"#B05A35"},{l:"Value at "+pct(selYield*100),v:fmt(capValue),c:"#2D7A65"},{l:"Value (yield -1%)",v:fmt(capValueMax),c:"#4A4BAE"}].map(function(item){
            return e("div",{key:item.l,style:{background:"#F7F8FC",borderRadius:8,padding:"12px",textAlign:"center",borderTop:"3px solid "+item.c}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:3}},item.l),
              e("div",{style:{fontSize:16,fontWeight:800,color:item.c}},item.v)
            );
          })
        ),
        // Return on cost
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,background:"rgba(74,75,174,0.04)",borderRadius:8,padding:"12px 14px"}},
          [{l:"Gross income yield on cost",v:giy>0?Math.round(giy*10)/10+"%":"—",c:"#4A4BAE"},
           {l:"Profit on cost (retain & sell)",v:profitOnCost>0?Math.round(profitOnCost*10)/10+"%":"—",c:profitOnCost>15?"#2D7A65":"#9A7B3E"},
           {l:"NOI per unit pa",v:fmt(noiPerUnit),c:"#2E2F8A"}
          ].map(function(item){
            return e("div",{key:item.l,style:{textAlign:"center"}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:2}},item.l),
              e("div",{style:{fontSize:14,fontWeight:800,color:item.c}},item.v)
            );
          })
        )
      ),

      // ── BUYER TYPE YIELD TABLE ─────────────────────────────────────────────
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}},"Capitalised Value by Buyer Type — What Each Would Pay"),
        // v9.40 — BTR-only note for SFH multi-tenure schemes
        (function(){
          var sfhMixHere = (data.sfh && data.sfh.mix) || [];
          var hasMulti = sfhMixHere.some(function(r){ return r.tenure && r.tenure !== "private" && num(r.count)>0; });
          var hasPrs = sfhMixHere.some(function(r){ return r.tenure === "retained_prs" && num(r.count)>0; });
          if(hasMulti && !hasPrs){
            return e("div",{style:{padding:"10px 12px",background:"rgba(74,75,174,0.06)",borderLeft:"3px solid #4A4BAE",borderRadius:4,fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:14}},
              e("strong",{style:{color:"#2E2F8A"}},"ℹ Note: BTR-only sensitivity. "),
              "This table assumes the whole scheme is sold to a single institutional buyer at one yield. ",
              e("strong",null,"Your scheme exits via Private retail / AHP routes — not bulk institutional sale."),
              " The Multi-Route Exit Value card above (and the SFH Development Appraisal) are the relevant GDV figures. This table is informational only."
            );
          }
          return null;
        })(),
        yieldTable.map(function(row,ri){
          var isBest=ri===0;
          var barW=yieldTable[0].baseVal>0?row.baseVal/yieldTable[0].baseVal*100:50;
          return e("div",{key:row.buyer,style:{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #F0F1FA"}},
            e("div",{style:{width:180,flexShrink:0}},
              e("div",{style:{fontSize:11,fontWeight:isBest?800:600,color:"#2E2F8A"}},row.buyer),
              e("div",{style:{fontSize:9,color:"#7278A0",marginTop:1}},row.label)
            ),
            e("div",{style:{flex:1}},
              e("div",{style:{height:8,background:"#F0F1FA",borderRadius:4,overflow:"hidden",marginBottom:3}},
                e("div",{style:{width:barW+"%",height:"100%",background:isBest?"#2D7A65":"#4A4BAE",borderRadius:4}})
              ),
              e("div",{style:{fontSize:10,color:"#7278A0"}},fmt(row.minVal)+" — "+fmt(row.maxVal))
            ),
            e("div",{style:{textAlign:"right",flexShrink:0,minWidth:90}},
              e("div",{style:{fontSize:16,fontWeight:800,color:isBest?"#2D7A65":"#2E2F8A"}},fmt(row.baseVal)),
              isBest&&e("div",{style:{fontSize:9,color:"#2D7A65",fontWeight:700}},"★ HIGHEST")
            )
          );
        }),
        e("div",{style:{marginTop:12,padding:"10px 14px",background:"rgba(45,122,101,0.05)",borderRadius:6,fontSize:11,color:"#2D7A65",lineHeight:1.7}},
          e("strong",null,"Key insight: "),
          "Selling to a pension fund at "+pct(CAP_YIELDS["Pension / Sovereign Fund"].base*100)+" yield produces "+fmt(yieldTable.find(function(r){return r.buyer==="Pension / Sovereign Fund";})&&yieldTable.find(function(r){return r.buyer==="Pension / Sovereign Fund";}).baseVal||0)+" — vs "+fmt(yieldTable.find(function(r){return r.buyer==="BTR Institutional Fund";})&&yieldTable.find(function(r){return r.buyer==="BTR Institutional Fund";}).baseVal||0)+" to a BTR fund. The difference is yield compression: every 0.5% reduction in yield adds approximately "+fmt(selYield>0.005?netAnnualIncome*0.005/((selYield-0.005)*selYield):0)+" to the price."
        )
      ),

      // ══════════════════════════════════════════════════════════════════════
      // ── FORWARD FUNDING STACK — does the deal stack up? ──────────────────
      // ══════════════════════════════════════════════════════════════════════
      (function(){
        // Editable assumptions for the stack
        var ffBuildPsf  = num(cap.ffBuildPsf||rlvD.buildPsf||f.buildPsf||cityMkt.build||188);
        var ffSqftPerUnit = num(cap.ffSqftPerUnit||rlvD.avgSqft||850);
        var ffFeesPct   = num(cap.ffFeesPct!==undefined?cap.ffFeesPct:12);     // professional fees
        var ffContPct   = num(cap.ffContPct!==undefined?cap.ffContPct:5);      // contingency
        var ffFinPct    = num(cap.ffFinPct!==undefined?cap.ffFinPct:7.5);      // finance cost % of (build+fees)
        var ffProfitPct = num(cap.ffProfitPct!==undefined?cap.ffProfitPct:17.5); // developer profit % on cost
        // v9.53 — S106/unit defaults to the deal's shared figure (SFH/Fin/Planning/RLV) so the
        // S106 allowance is the SAME number everywhere, not a stray 8000.
        var ffS106pu    = num(cap.ffS106pu!==undefined && cap.ffS106pu!=="" ? cap.ffS106pu : ((data.sfh&&data.sfh.s106pu)||(data.fin&&data.fin.s106pu)||(data.planning&&data.planning.s106pu)||8000)); // S106 per unit
        var ffFarmerAsk = num(cap.ffFarmerAsk||l.price||0);
        var ffAssetType = cap.ffAssetType||"BTR (multi-family)";

        // v9.63 — For a BUILD-AND-SELL houses scheme this rental-capitalisation stack is NOT
        // the exit (you sell homes, you don't keep and rent them), so it always shows big
        // negatives and misleads. Replace it with a calm, clearly-labelled summary and tuck
        // the full rental detail behind a toggle so it can't be mistaken for the real verdict.
        var _mix = (data.sfh && data.sfh.mix) || [];
        var _isSellScheme = _mix.length>0
          && !_mix.some(function(r){ return r.tenure==="retained_prs" && num(r.count)>0; })
          && (data.assetType==="sfh" || !data.assetType);
        if(_isSellScheme && !cap.showRentalStack){
          return e("div",{style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
            e("div",{style:{fontSize:10,fontWeight:800,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}},"Rental-hold scenario — not your exit"),
            e("div",{style:{fontSize:12,color:"#3A3D6A",lineHeight:1.7}},
              e("strong",null,"You're building homes to SELL"),", so this rental view doesn't apply. It values the scheme as if you kept every home and rented it — which always looks negative for houses, because their rental value is far below what they cost to build. ",
              e("strong",{style:{color:"#2D7A65"}},"Your real land value is the Max Land Bid on the Land Valuation screen"),", from selling the homes."
            ),
            e("button",{onClick:function(){up("capitalise","showRentalStack",true);},style:{marginTop:12,padding:"7px 14px",background:"#fff",border:"1px solid #DDE0ED",borderRadius:6,fontSize:11,fontWeight:700,color:"#7278A0",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Show rental/hold scenario anyway (advanced)")
          );
        }

        // Calculation engine — returns the full stack for a given capital value
        function calcStack(capVal){
          var buildCost  = ffBuildPsf * ffSqftPerUnit * totalUnitsCalc;
          var fees       = buildCost * (ffFeesPct/100);
          var contingency= buildCost * (ffContPct/100);
          var s106Total  = ffS106pu * totalUnitsCalc;
          var financeCost= (buildCost + fees) * (ffFinPct/100);
          var subtotal   = buildCost + fees + contingency + s106Total + financeCost;
          var profit     = subtotal * (ffProfitPct/100);
          var totalCost  = subtotal + profit;
          var residual   = capVal - totalCost;        // what the farmer can be paid
          var pricePerAc = (num(l.acres)>0) ? residual/num(l.acres) : 0;
          return {
            buildCost:buildCost, fees:fees, contingency:contingency, s106:s106Total,
            financeCost:financeCost, profit:profit, totalCost:totalCost,
            residual:residual, pricePerAc:pricePerAc
          };
        }

        var stackByBuyer = yieldTable.map(function(row){
          var s = calcStack(row.baseVal);
          return Object.assign({}, row, s, {
            stacks: ffFarmerAsk>0 ? s.residual >= ffFarmerAsk : null,
            gap: ffFarmerAsk>0 ? s.residual - ffFarmerAsk : null
          });
        });

        // Best (highest) residual is the first row (yieldTable is sorted desc by baseVal)
        var bestStack = stackByBuyer[0];
        var worstStack = stackByBuyer[stackByBuyer.length-1];

        return e("div",{style:{background:"linear-gradient(135deg,#F8F8FE 0%,#F0F1FA 100%)",border:"2px solid #2D7A65",borderRadius:10,padding:"20px 22px",marginBottom:14}},

          // v9.63 — collapse control when this rental view was opened on a sell scheme
          _isSellScheme && e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,padding:"8px 12px",background:"rgba(154,123,62,0.08)",border:"1px solid rgba(154,123,62,0.3)",borderRadius:6}},
            e("div",{style:{fontSize:10,color:"#9A7B3E",lineHeight:1.5}},e("strong",null,"Rental-hold scenario (advanced)")," — not your exit; you're selling these homes."),
            e("button",{onClick:function(){up("capitalise","showRentalStack",false);},style:{padding:"5px 10px",background:"#fff",border:"1px solid #DDE0ED",borderRadius:5,fontSize:10,fontWeight:700,color:"#7278A0",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}},"▲ Hide")
          ),

          // v9.40 — BTR-only note for SFH multi-tenure schemes
          (function(){
            var sfhMixHere = (data.sfh && data.sfh.mix) || [];
            var hasMulti = sfhMixHere.some(function(r){ return r.tenure && r.tenure !== "private" && num(r.count)>0; });
            var hasPrs = sfhMixHere.some(function(r){ return r.tenure === "retained_prs" && num(r.count)>0; });
            if(hasMulti && !hasPrs){
              return e("div",{style:{padding:"10px 12px",background:"rgba(74,75,174,0.08)",borderLeft:"3px solid #4A4BAE",borderRadius:4,fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:14}},
                e("strong",{style:{color:"#2E2F8A"}},"ℹ Note: BTR-only stack. "),
                "This Forward Funding waterfall assumes the whole scheme exits to a single institutional buyer at the target yield. ",
                e("strong",null,"Your scheme has Private retail + AHP routes — not bulk institutional sale."),
                " For your actual RLV, refer to the ",
                e("strong",null,"SFH Development Appraisal at the bottom of the SFH House Mix page"),
                " — that uses your real Multi-Route blended GDV."
              );
            }
            return null;
          })(),

          // Header with verdict
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:12}},
            e("div",null,
              e("div",{style:{fontSize:10,fontWeight:800,color:"#2D7A65",textTransform:"uppercase",letterSpacing:".12em",marginBottom:4}},"⚡ Forward Funding Stack"),
              e("div",{style:{fontSize:18,fontWeight:800,color:"#2E2F8A"}},"Does the deal stack up?"),
              e("div",{style:{fontSize:11,color:"#7278A0",marginTop:3,lineHeight:1.6}},"Working backwards from institutional capital value → build cost → developer profit → ",e("strong",null,"residual land value")," (what you can pay the farmer).")
            ),
            ffFarmerAsk>0&&e("div",{style:{textAlign:"right"}},
              e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:2}},"Farmer asking: "+fmt(ffFarmerAsk)),
              e("div",{style:{fontSize:11,fontWeight:700,color:bestStack.residual>=ffFarmerAsk?"#2D7A65":"#B05A35"}},
                bestStack.residual>=ffFarmerAsk?"✓ Best case: deal works":"✗ Even best buyer: short by "+fmt(ffFarmerAsk-bestStack.residual)
              )
            )
          ),

          // Asset type selector
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8,marginBottom:14}},
            ["BTR (multi-family)","SFH for institutional rent","Mixed BTR + SFH","Build-to-Sell"].map(function(at){
              var sel=ffAssetType===at;
              return e("button",{key:at,
                onClick:function(){up("capitalise","ffAssetType",at);},
                style:{padding:"8px 12px",background:sel?"#2D7A65":"#fff",color:sel?"#fff":"#2E2F8A",border:"1px solid "+(sel?"#2D7A65":"#DDE0ED"),borderRadius:6,fontSize:11,fontWeight:sel?700:500,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },at);
            })
          ),

          // Editable build / cost assumptions
          e("div",{style:{background:"#fff",borderRadius:8,padding:"14px 16px",marginBottom:14,border:"1px solid #DDE0ED"}},
            e("div",{style:{fontSize:10,fontWeight:700,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}},"Build cost stack (per unit basis)"),
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}},
              [
                {k:"ffBuildPsf",l:"Build £/sqft",v:ffBuildPsf,suf:"£",step:5,min:100,max:400},
                {k:"ffSqftPerUnit",l:"Avg unit sqft",v:ffSqftPerUnit,suf:"sqft",step:25,min:300,max:2000},
                {k:"ffFeesPct",l:"Prof fees %",v:ffFeesPct,suf:"%",step:0.5,min:5,max:20},
                {k:"ffContPct",l:"Contingency %",v:ffContPct,suf:"%",step:0.5,min:0,max:15},
                {k:"ffFinPct",l:"Finance cost %",v:ffFinPct,suf:"%",step:0.25,min:0,max:15},
                {k:"ffProfitPct",l:"Developer profit %",v:ffProfitPct,suf:"%",step:1,min:10,max:30},
                {k:"ffS106pu",l:"S106 £/unit",v:ffS106pu,suf:"£",step:500,min:0,max:50000},
                {k:"ffFarmerAsk",l:"Farmer asking £",v:ffFarmerAsk,suf:"£",step:50000,min:0,max:50000000}
              ].map(function(f2){
                return e("div",{key:f2.k},
                  e("label",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",fontWeight:700,letterSpacing:".06em",display:"block",marginBottom:3}},f2.l),
                  e("input",{type:"number",value:f2.v,min:f2.min,max:f2.max,step:f2.step,
                    onChange:function(ev){up("capitalise",f2.k,Number(ev.target.value));},
                    style:{width:"100%",padding:"6px 8px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:12,fontFamily:"DM Mono,monospace",textAlign:"center"}})
                );
              })
            )
          ),

          // The waterfall — for the best (Pension) buyer
          (function(){
            var pension = stackByBuyer.find(function(r){return r.buyer==="Pension / Sovereign Fund";}) || bestStack;
            var lines = [
              {l:"Capital value at "+pct(pension.yield*100)+" yield",v:pension.baseVal,col:"#2D7A65",bold:true,sign:""},
              {l:"− Build cost ("+fmt(ffBuildPsf)+"/sqft × "+ffSqftPerUnit+" sqft × "+totalUnitsCalc+" units)",v:-pension.buildCost,col:"#B05A35"},
              {l:"− Professional fees ("+ffFeesPct+"% of build)",v:-pension.fees,col:"#B05A35"},
              {l:"− Contingency ("+ffContPct+"% of build)",v:-pension.contingency,col:"#B05A35"},
              {l:"− S106 / planning obligations (£"+fmtN(ffS106pu)+"/unit)",v:-pension.s106,col:"#B05A35"},
              {l:"− Finance cost ("+ffFinPct+"% of build+fees)",v:-pension.financeCost,col:"#B05A35"},
              {l:"− Developer profit ("+ffProfitPct+"% on cost)",v:-pension.profit,col:"#B05A35"},
              {l:"= Residual Land Value (farmer can be paid)",v:pension.residual,col:pension.residual>0?"#2D7A65":"#B05A35",bold:true,sign:"="}
            ];
            return e("div",{style:{background:"#fff",borderRadius:8,padding:"16px 18px",marginBottom:14,border:"1px solid #DDE0ED"}},
              e("div",{style:{fontSize:11,fontWeight:700,color:"#2E2F8A",marginBottom:10}},"Waterfall — Pension Fund buyer (most favourable case)"),
              lines.map(function(ln,li){
                return e("div",{key:li,style:{display:"flex",justifyContent:"space-between",padding:"7px 0",borderTop:li===0?"none":li===lines.length-1?"2px solid #2D7A65":"1px solid #F0F1FA",fontSize:ln.bold?13:11,fontWeight:ln.bold?800:500,color:ln.col}},
                  e("span",null,ln.l),
                  e("span",{style:{fontFamily:"DM Mono,monospace",fontWeight:ln.bold?800:600}},(ln.v<0?"-":"")+fmt(Math.abs(ln.v)))
                );
              }),
              pension.residual>0&&num(l.acres)>0&&e("div",{style:{marginTop:10,padding:"8px 12px",background:"rgba(45,122,101,0.08)",borderRadius:6,fontSize:11,color:"#2D7A65"}},
                "Per acre: "+fmt(pension.pricePerAc)+" · "+num(l.acres)+" acres total"
              )
            );
          })(),

          // Side-by-side: residual land value by buyer type
          e("div",{style:{background:"#fff",borderRadius:8,padding:"16px 18px",marginBottom:0,border:"1px solid #DDE0ED"}},
            e("div",{style:{fontSize:11,fontWeight:700,color:"#2E2F8A",marginBottom:10}},"What you can pay the farmer — by buyer type"),
            e("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
              e("thead",null,
                e("tr",null,
                  e("th",{style:{padding:"8px",textAlign:"left",fontSize:9,color:"#7278A0",textTransform:"uppercase",background:"#F7F8FC",borderBottom:"1px solid #DDE0ED"}},"Buyer type"),
                  e("th",{style:{padding:"8px",textAlign:"center",fontSize:9,color:"#7278A0",textTransform:"uppercase",background:"#F7F8FC",borderBottom:"1px solid #DDE0ED"}},"Yield"),
                  e("th",{style:{padding:"8px",textAlign:"right",fontSize:9,color:"#7278A0",textTransform:"uppercase",background:"#F7F8FC",borderBottom:"1px solid #DDE0ED"}},"Capital value"),
                  e("th",{style:{padding:"8px",textAlign:"right",fontSize:9,color:"#7278A0",textTransform:"uppercase",background:"#F7F8FC",borderBottom:"1px solid #DDE0ED"}},"Residual land"),
                  num(l.acres)>0&&e("th",{style:{padding:"8px",textAlign:"right",fontSize:9,color:"#7278A0",textTransform:"uppercase",background:"#F7F8FC",borderBottom:"1px solid #DDE0ED"}},"£ / acre"),
                  ffFarmerAsk>0&&e("th",{style:{padding:"8px",textAlign:"center",fontSize:9,color:"#7278A0",textTransform:"uppercase",background:"#F7F8FC",borderBottom:"1px solid #DDE0ED"}},"vs ask")
                )
              ),
              e("tbody",null,
                stackByBuyer.map(function(row,ri){
                  var posResidual = row.residual>0;
                  return e("tr",{key:row.buyer,style:{background:ri===0?"rgba(45,122,101,0.04)":"#fff"}},
                    e("td",{style:{padding:"10px 8px",fontWeight:ri===0?800:600,color:"#2E2F8A",borderBottom:"1px solid #F0F1FA"}},row.buyer,ri===0&&e("span",{style:{color:"#2D7A65",marginLeft:4,fontSize:9}},"★")),
                    e("td",{style:{padding:"10px 8px",textAlign:"center",color:"#7278A0",borderBottom:"1px solid #F0F1FA"}},pct(row.yield*100)),
                    e("td",{style:{padding:"10px 8px",textAlign:"right",fontFamily:"DM Mono,monospace",color:"#2E2F8A",borderBottom:"1px solid #F0F1FA"}},fmt(row.baseVal)),
                    e("td",{style:{padding:"10px 8px",textAlign:"right",fontFamily:"DM Mono,monospace",fontWeight:800,color:posResidual?"#2D7A65":"#B05A35",borderBottom:"1px solid #F0F1FA"}},(row.residual<0?"-":"")+fmt(Math.abs(row.residual))),
                    num(l.acres)>0&&e("td",{style:{padding:"10px 8px",textAlign:"right",fontFamily:"DM Mono,monospace",color:posResidual?"#2D7A65":"#B05A35",borderBottom:"1px solid #F0F1FA"}},(row.pricePerAc<0?"-":"")+fmt(Math.abs(row.pricePerAc))),
                    ffFarmerAsk>0&&e("td",{style:{padding:"10px 8px",textAlign:"center",fontWeight:700,color:row.stacks?"#2D7A65":"#B05A35",borderBottom:"1px solid #F0F1FA"}},row.stacks?"✓":"✗ "+fmt(Math.abs(row.gap||0))+" short")
                  );
                })
              )
            ),
            // Verdict banner
            ffFarmerAsk>0&&e("div",{style:{marginTop:12,padding:"12px 14px",borderRadius:6,background:bestStack.residual>=ffFarmerAsk?"rgba(45,122,101,0.08)":"rgba(176,90,53,0.08)",border:"1px solid "+(bestStack.residual>=ffFarmerAsk?"#2D7A65":"#B05A35")}},
              e("div",{style:{fontSize:12,fontWeight:700,color:bestStack.residual>=ffFarmerAsk?"#2D7A65":"#B05A35",marginBottom:4}},
                bestStack.residual>=ffFarmerAsk?"✓ Deal stacks up at "+fmt(ffFarmerAsk):"✗ Deal does not stack at "+fmt(ffFarmerAsk)
              ),
              e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
                bestStack.residual>=ffFarmerAsk
                  ? "Best case ("+bestStack.buyer+" at "+pct(bestStack.yield*100)+"): residual is "+fmt(bestStack.residual)+" — that's "+fmt(bestStack.residual-ffFarmerAsk)+" of headroom over the farmer's ask. Negotiation strategy: lead with the worst-case buyer ("+worstStack.buyer+" at "+pct(worstStack.yield*100)+") which gives "+fmt(worstStack.residual)+"."
                  : "Even the best buyer ("+bestStack.buyer+" at "+pct(bestStack.yield*100)+") only produces "+fmt(bestStack.residual)+" of residual — short by "+fmt(ffFarmerAsk-bestStack.residual)+". Options: (a) negotiate the farmer down to "+fmt(bestStack.residual)+", (b) increase rents/density, (c) reduce build cost, or (d) walk away."
              )
            )
          )
        );
      })(),

      // ── SENSITIVITY TABLE ─────────────────────────────────────────────────
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}},"Sensitivity Analysis — Rent vs Yield"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:10}},"Capitalised values at rent ±10% and yield ±0.5% from your current inputs ("+pct(selYield*100)+" target yield)"),
        e("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
          e("thead",null,
            e("tr",null,
              e("th",{style:{padding:"6px 8px",textAlign:"left",fontSize:9,color:"#7278A0",textTransform:"uppercase",background:"#F7F8FC",border:"1px solid #DDE0ED"}},"Rent / Yield"),
              e("th",{style:{padding:"6px 8px",textAlign:"center",fontSize:9,color:"#7278A0",textTransform:"uppercase",background:"#F7F8FC",border:"1px solid #DDE0ED"}},pct((selYield-0.005)*100)+" yield"),
              e("th",{style:{padding:"6px 8px",textAlign:"center",fontSize:9,color:"#4A4BAE",textTransform:"uppercase",background:"#EEF0FF",border:"1px solid #DDE0ED"}},pct(selYield*100)+" (base)"),
              e("th",{style:{padding:"6px 8px",textAlign:"center",fontSize:9,color:"#7278A0",textTransform:"uppercase",background:"#F7F8FC",border:"1px solid #DDE0ED"}},pct((selYield+0.005)*100)+" yield")
            )
          ),
          e("tbody",null,
            [[-10,"Rent -10%"],[0,"Base rent"],[10,"Rent +10%"]].map(function(rRow){
              return e("tr",{key:rRow[0]},
                e("td",{style:{padding:"8px",fontWeight:600,color:"#2E2F8A",border:"1px solid #DDE0ED",background:"#F7F8FC"}},rRow[1]),
                [-0.5,0,0.5].map(function(yAdj){
                  var v=capAt(rRow[0],yAdj);
                  var isBase=rRow[0]===0&&yAdj===0;
                  var col=v>capValue*1.1?"#2D7A65":v<capValue*0.9?"#B05A35":"#2E2F8A";
                  return e("td",{key:yAdj,style:{padding:"8px",textAlign:"center",fontWeight:isBase?800:500,color:col,border:"1px solid #DDE0ED",background:isBase?"#EEF0FF":"#fff"}},fmt(v));
                })
              );
            })
          )
        )
      ),

      // AI capitalisation advice
      e(AIPanel,{user:user,up:up,stage:"capitalise",data:data,persistKey:"cap_advice",
        label:"🏛 AI Capitalisation Strategy",
        system:"You are a senior UK real estate investment analyst advising on maximising exit value through yield compression and income optimisation.",
        prompt:buildHonestPrompt(data,"Advise on capitalisation strategy for this scheme. Location: "+cityName(city||"")+". NOI: "+fmt(netAnnualIncome)+" pa from "+totalUnitsCalc+" units. Current cap value at "+pct(selYield*100)+": "+fmt(capValue)+". Pension fund value at 4.5%: "+fmt(yieldTable.find(function(r){return r.buyer==="Pension / Sovereign Fund";})?yieldTable.find(function(r){return r.buyer==="Pension / Sovereign Fund";}).baseVal:0)+". BTR fund at 5.5%: "+fmt(yieldTable.find(function(r){return r.buyer==="BTR Institutional Fund";})?yieldTable.find(function(r){return r.buyer==="BTR Institutional Fund";}).baseVal:0)+". Gross income yield on cost: "+Math.round(giy*10)/10+"%. Profit on cost: "+Math.round(profitOnCost*10)/10+"%. Advise: 1) Which buyer type maximises exit price and why, 2) What NOI improvements would most move the needle, 3) Whether a forward fund or stabilised sale is optimal, 4) Specific steps to qualify for pension-grade pricing, 5) Realistic yield compression achievable in this market."
      )})
    );
  }
