// ── renderDashboard  (params: ALL_STAGES, JOURNEYS, at, city, data, effUnits, ey, gdv, getStageRelevance, isSFHdash, journey, loadSiteIntoDeal, margin, navTo, noi, profit, scM, setData, setJourney, stage, tc, up, user)
// Lifted out of Tool; body byte-unchanged. Loaded before 05-tool.js.
function renderDashboard(ALL_STAGES, JOURNEYS, at, city, data, effUnits, ey, gdv, getStageRelevance, isSFHdash, journey, loadSiteIntoDeal, margin, navTo, noi, profit, scM, setData, setJourney, stage, tc, up, user){
    try{
    // Compute clean reconciliation between RLV (target-profit basis) and Dashboard (actual-cost basis)
    var DMd = calcDealMetrics(data);
    var targetProfit = DMd.profit;        // GDV * 17.5% — the developer's TARGET on RLV stage
    var actualProfit = DMd.actualProfit;  // GDV - totalCost - landPrice — what's actually left
    var targetMargin = gdv>0 ? (targetProfit/gdv)*100 : 0;

    var cards=[
      {l:"GDV",v:gdv>0?fmt(gdv):"—"},
      {l:"Total Dev Cost",v:tc>0&&gdv>0?fmt(tc):"—",sub:"Build + fees + cont + S106 + finance + land"},
      {l:"Profit on Cost",v:gdv>0&&tc>0?fmt(profit):"—",c:profit>0?scM:"#C0C4D8",sub:"GDV − all costs incl. land"},
      {l:"Margin on GDV",v:gdv>0&&tc>0?pct(margin):"—",c:margin>0?scM:"#C0C4D8",sub:"Actual margin (after land price)"},
      {l:"NOI (pa)",v:!isSFHdash&&noi>0?fmt(noi):"—"},
      {l:"Exit Yield",v:!isSFHdash&&ey>0?(ey*100).toFixed(2)+"%":"—"},
      {l:"Units / Beds",v:effUnits||"—"},
      {l:"City",v:city?cityName(city):"—"},
    ];
    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Deal Dashboard"),
      // v10.134 — in-app deal name / rename. Previously the only place to name a deal was the
      // native Save prompt, which offered no way to rename after the fact (and can't be driven on
      // iPad / by an automated browser). This field edits data.dealName directly; Save uses it as
      // the name, and re-saving an already-saved deal updates the same portfolio card — so this
      // IS the rename. Blank falls back to the site address.
      e("div",{style:{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",marginBottom:12}},
        e("label",{style:{fontSize:10,color:"#7278A0",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}},"Deal name"),
        e("input",{type:"text",value:data.dealName||"",placeholder:(data.land&&data.land.address)||"Name this deal (e.g. Maldon Stacked)",
          onChange:function(ev){ var v=ev.target.value; setData(function(prev){ return Object.assign({},prev,{dealName:v}); }); },
          style:{flex:"1 1 260px",minWidth:0,maxWidth:420,padding:"8px 11px",border:"1px solid #DDE0ED",borderRadius:7,fontSize:14,fontWeight:700,color:"#2E2F8A",fontFamily:"DM Sans,sans-serif"}}),
        e("span",{style:{fontSize:10,color:"#9298BC",lineHeight:1.4}},"Used when you Save · edit any time to rename (re-saving updates the same portfolio card)")
      ),
      LandReconciliationPanel(data, up),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:data.masterReport?8:12}},"Live overview — fill in the stages to see metrics update"),
      // v10.5 — Assumption Mode entry point (present as consented/DD-clear for stakeholders)
      (typeof AssumptionModeCard==="function")&&AssumptionModeCard(data, up),
      // v10.7 — Reset to raw import shortcut (only for deals imported from Placona/Keystone)
      (typeof rawImportBrief==="function" && rawImportBrief(data)) && e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",padding:"8px 14px",background:"rgba(176,90,53,0.05)",border:"1px solid rgba(176,90,53,0.25)",borderRadius:8,marginBottom:14}},
        e("div",{style:{fontSize:11,color:"#7278A0"}},"↺ Want a clean re-audit? Reset this deal back to its raw import and run Keystone fresh."),
        e("button",{onClick:function(){navTo("keystone");},style:{padding:"6px 14px",background:"transparent",border:"1px solid #B05A35",color:"#B05A35",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}},"Reset to raw import →")
      ),

      // v9.31 — "What you still need to fill" — incomplete REQUIRED stages
      (function(){
        if(!data.assetType) return null;  // need a journey to evaluate against
        var incompleteRequired = [];
        var incompleteRecommended = [];
        ALL_STAGES.forEach(function(s){
          var rel = getStageRelevance(s.id, data);
          var complete = isStageComplete(s.id, data);
          if(complete) return;
          if(s.id==="dashboard"||s.id==="portfolio"||s.id==="propagation") return;  // skip non-input stages
          if(rel==="required") incompleteRequired.push(s);
          else if(rel==="recommended") incompleteRecommended.push(s);
        });

        if(incompleteRequired.length===0 && incompleteRecommended.length===0){
          // All required filled
          return e("div",{style:{padding:"12px 16px",background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.3)",borderRadius:8,marginBottom:14,display:"flex",alignItems:"center",gap:10}},
            e("span",{style:{fontSize:18}},"✓"),
            e("div",{style:{flex:1}},
              e("div",{style:{fontSize:12,fontWeight:700,color:"#2D7A65"}},"All required stages complete"),
              e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2}},"This deal has all the essentials filled in. Optional stages are available in the sidebar if you want extra detail.")
            )
          );
        }

        return e("div",{style:{padding:"14px 16px",background:"rgba(176,90,53,0.05)",border:"1px solid rgba(176,90,53,0.25)",borderRadius:8,marginBottom:14}},
          e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
            e("span",{style:{fontSize:14}},"📋"),
            e("div",{style:{fontSize:12,fontWeight:800,color:"#B05A35",letterSpacing:".05em",textTransform:"uppercase"}},
              "What you still need to fill"
            )
          ),
          incompleteRequired.length>0 && e("div",{style:{marginBottom:incompleteRecommended.length>0?10:0}},
            e("div",{style:{fontSize:10,fontWeight:700,color:"#B05A35",marginBottom:6,textTransform:"uppercase",letterSpacing:".08em"}},"Required ("+incompleteRequired.length+")"),
            e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
              incompleteRequired.map(function(s){
                return e("div",{key:s.id,onClick:function(){navTo(s.id);},style:{display:"flex",alignItems:"center",gap:9,padding:"7px 10px",background:"#fff",border:"1px solid rgba(176,90,53,0.2)",borderRadius:5,cursor:"pointer",transition:"all .12s"}},
                  e("span",{style:{fontSize:14,width:16}},s.icon),
                  e("span",{style:{flex:1,fontSize:12,color:"#3A3D6A",fontWeight:600}},s.label),
                  e("span",{style:{fontSize:10,color:"#B05A35",fontWeight:700}},"Open →")
                );
              })
            )
          ),
          incompleteRecommended.length>0 && e("div",null,
            e("div",{style:{fontSize:10,fontWeight:700,color:"#9A7B3E",marginBottom:6,textTransform:"uppercase",letterSpacing:".08em"}},"Recommended ("+incompleteRecommended.length+")"),
            e("div",{style:{display:"flex",flexWrap:"wrap",gap:6}},
              incompleteRecommended.slice(0,8).map(function(s){
                return e("div",{key:s.id,onClick:function(){navTo(s.id);},style:{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 9px",background:"#fff",border:"1px solid rgba(154,123,62,0.25)",borderRadius:4,cursor:"pointer",fontSize:11,color:"#3A3D6A"}},
                  e("span",null,s.icon),e("span",null,s.label)
                );
              }),
              incompleteRecommended.length>8 && e("span",{style:{fontSize:11,color:"#7278A0",alignSelf:"center"}},"+ "+(incompleteRecommended.length-8)+" more")
            )
          )
        );
      })(),

      // v9.16 — Auto-migration result banner
      // After loadDeal/cloud load runs migrateLoadedDeal(), this banner surfaces
      // what was auto-fixed and what may need user review. User can restore the
      // pre-migration state if they disagree with any of the changes.
      (function(){
        var migLog = data._migrationLog || [];
        var reviewList = data._migrationReviewRecommended || [];
        if(migLog.length === 0 && reviewList.length === 0) return null;
        if(data._migrationBannerDismissed === CURRENT_VERSION) return null;
        return e("div",{style:{margin:"6px 0 14px",padding:"14px 16px",background:"linear-gradient(135deg,rgba(45,122,101,0.10),rgba(45,122,101,0.04))",border:"1px solid rgba(45,122,101,0.4)",borderRadius:8,fontSize:12,color:"#1d5446",lineHeight:1.6}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:8}},
            e("div",{style:{flex:1,minWidth:200}},
              e("div",{style:{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",fontWeight:700,color:"#2D7A65",marginBottom:3}},"✓ Deal auto-updated to v"+CURRENT_VERSION),
              e("div",{style:{fontWeight:700,fontSize:13,color:"#1d5446"}},
                migLog.length+" structural fix"+(migLog.length!==1?"es":"")+" applied automatically"+
                (reviewList.length>0?" · "+reviewList.length+" field"+(reviewList.length!==1?"s":"")+" to review":"")
              ),
              e("div",{style:{fontSize:11,color:"#3A6B5C",marginTop:3}},
                "Saved on v"+(data._migrationFrom||"(unknown)")+" — Landform fixed known issues automatically. You can restore the previous values if you disagree."
              )
            ),
            e("button",{onClick:function(){
              setData(function(prev){return Object.assign({},prev,{_migrationBannerDismissed:CURRENT_VERSION});});
            },style:{padding:"4px 8px",background:"transparent",border:"1px solid #2D7A65",color:"#2D7A65",borderRadius:3,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Dismiss")
          ),
          // Auto-fixed list
          migLog.length>0 && e("div",{style:{background:"rgba(255,255,255,0.5)",borderRadius:5,padding:"10px 12px",marginBottom:8,fontSize:11}},
            e("div",{style:{fontWeight:700,marginBottom:6,color:"#1d5446"}},"What was auto-fixed:"),
            migLog.map(function(m,i){
              return e("div",{key:i,style:{marginBottom:5,paddingBottom:5,borderBottom:i<migLog.length-1?"1px dotted rgba(45,122,101,0.2)":"none"}},
                e("div",{style:{fontSize:11,color:"#2E2F8A",fontFamily:"monospace"}},m.field),
                e("div",{style:{fontSize:10,color:"#5C5238",marginTop:2}},
                  "was: ",e("strong",null,String(m.from||"(empty)"))," → now: ",e("strong",null,String(m.to||"(auto)")),
                ),
                e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2,fontStyle:"italic"}},m.reason)
              );
            })
          ),
          // Review-recommended list
          reviewList.length>0 && e("div",{style:{background:"rgba(154,123,62,0.10)",borderRadius:5,padding:"10px 12px",marginBottom:8,fontSize:11,border:"1px solid rgba(154,123,62,0.25)"}},
            e("div",{style:{fontWeight:700,marginBottom:6,color:"#7B6432"}},"⚠ Manual review recommended:"),
            e("div",{style:{fontSize:10,color:"#7B6432",marginBottom:6,fontStyle:"italic"}},"These values weren't auto-changed because they may have been intentionally set, but they look unusual. Open RLV stage to verify."),
            reviewList.map(function(r,i){
              return e("div",{key:i,style:{marginBottom:4}},
                e("span",{style:{fontFamily:"monospace",color:"#2E2F8A"}},r.field),
                ": ",e("strong",null,String(r.current))," vs expected ",e("strong",null,String(r.expected))," (",r.reason,")"
              );
            })
          ),
          // Actions
          e("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
            e("button",{
              onClick:function(){navTo("rlv");},
              style:{padding:"7px 13px",background:"#2D7A65",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },"Review RLV stage →"),
            data._preMigrationBackup && e("button",{
              onClick:function(){
                // v10.14 — non-blocking confirm (native confirm() froze the browser).
                var backup = data._preMigrationBackup;
                confirmToast("Restore previous values?\n\nThis undoes all auto-migration fixes and restores the deal as it was originally saved (on v"+(data._migrationFrom||"unknown")+"). You can re-apply migration later.", function(){
                  setData(function(prev){
                    // Restore from backup but keep the cloud ID
                    return Object.assign({}, backup, {_cloudDealId:prev._cloudDealId, _migrationRolledBack:true});
                  });
                }, {confirmLabel:"Restore"});
              },
              style:{padding:"7px 13px",background:"transparent",border:"1px solid #B05A35",color:"#B05A35",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },"Restore previous values"),
            e("button",{
              onClick:function(){
                var msg = "Auto-migration log:\n\nDeal saved on: v"+(data._migrationFrom||"unknown")+"\nCurrent version: v"+CURRENT_VERSION+"\nMigration ran: "+(data._migrationAt||"unknown")+"\n\nFields auto-fixed:\n";
                migLog.forEach(function(m){
                  msg += "  • "+m.field+": "+String(m.from)+" → "+String(m.to)+"\n    ("+m.reason+")\n";
                });
                if(reviewList.length>0){
                  msg += "\nFields recommended for review:\n";
                  reviewList.forEach(function(r){
                    msg += "  • "+r.field+": currently "+r.current+", expected "+r.expected+" ("+r.reason+")\n";
                  });
                }
                notify(msg);
              },
              style:{padding:"7px 13px",background:"transparent",border:"1px solid #2D7A65",color:"#2D7A65",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },"Full log")
          )
        );
      })(),

      // v9.16 — Legacy "version mismatch" banner (now ONLY shows if there's a version gap
      // but auto-migration found nothing safe to fix — i.e. user data may still be stale
      // but we couldn't determine it was wrong)
      (function(){
        var savedV = data._savedVersion || null;
        if(!savedV) return null;
        if(semverCompare(savedV, CURRENT_VERSION) >= 0) return null;
        // If auto-migration already ran (with fixes OR reviews), don't show this banner
        if((data._migrationLog||[]).length > 0) return null;
        if((data._migrationReviewRecommended||[]).length > 0) return null;
        if(data._migrationDismissed === CURRENT_VERSION) return null;
        var breakingChanges = calcAffectingChangesSince(savedV);
        if(breakingChanges.length === 0) return null;
        return e("div",{style:{margin:"6px 0 14px",padding:"14px 16px",background:"linear-gradient(135deg,rgba(154,123,62,0.10),rgba(154,123,62,0.04))",border:"1px solid rgba(154,123,62,0.4)",borderRadius:8,fontSize:12,color:"#7B6432",lineHeight:1.6}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:8}},
            e("div",{style:{flex:1,minWidth:200}},
              e("div",{style:{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",fontWeight:700,color:"#9A7B3E",marginBottom:3}},"⚠ Deal saved on older version"),
              e("div",{style:{fontWeight:700,fontSize:13,color:"#7B6432"}},"Saved on v"+savedV+" — current is v"+CURRENT_VERSION),
              e("div",{style:{fontSize:11,color:"#8A7048",marginTop:3}},"Auto-migration found nothing structurally wrong, but "+breakingChanges.length+" version(s) since save changed calculations. Manually review RLV inputs if figures look off.")
            ),
            e("button",{onClick:function(){
              setData(function(prev){return Object.assign({},prev,{_migrationDismissed:CURRENT_VERSION});});
            },style:{padding:"4px 8px",background:"transparent",border:"1px solid #9A7B3E",color:"#9A7B3E",borderRadius:3,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Dismiss")
          ),
          e("button",{
            onClick:function(){navTo("rlv");},
            style:{padding:"7px 13px",background:"#9A7B3E",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"Review RLV stage →")
        );
      })(),

      // Active scenario banner — tells the user which planning world this deal is modelled in.
      // v9.58 — when no scenario is applied, the deal is modelled on a Full consent (assumed)
      // basis (mirroring Land Appraisal), so the Dashboard reflects the profitable consented
      // picture and tells the user it's an assumption to refine.
      (function(){
        var ld = data.land || {};
        if(ld.appliedScenario){
          return e("div",{style:{margin:"6px 0 14px",padding:"12px 16px",background:"linear-gradient(135deg,rgba(45,122,101,0.10),rgba(45,122,101,0.04))",border:"1px solid rgba(45,122,101,0.4)",borderRadius:8,fontSize:12,color:"#1d5446",lineHeight:1.5,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}},
            e("div",null,
              e("div",{style:{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",fontWeight:700,color:"#2D7A65",marginBottom:3}},"Active planning scenario"),
              e("div",{style:{fontWeight:700,fontSize:14,color:"#1d5446"}},ld.appliedScenarioLabel||ld.appliedScenario),
              e("div",{style:{fontSize:11,color:"#3A6B5C",marginTop:3}},
                "Land value: "+fmt(num(ld.scenarioLandValue||0))+
                " · AH: "+(num(ld.scenarioAhPct||0))+"%"+
                " · Timeline: "+(num(ld.scenarioTimelineMo||0))+" months"+
                " · Finance: "+(num(ld.scenarioFinanceRate||0))+"%"
              )
            ),
            e("button",{onClick:function(){navTo("land");},style:{padding:"7px 14px",background:"transparent",border:"1px solid #2D7A65",color:"#2D7A65",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Change scenario →")
          );
        }
        // No scenario applied yet — only show once there's a modelled scheme
        if(!(gdv>0)) return null;
        // v10.5 — Assumption Mode: the user is deliberately presenting planning as granted.
        // Lead with a confident consented banner, clearly badged as Assumption Mode.
        if(typeof assumePlanningConsented==="function" && assumePlanningConsented(data)){
          return e("div",{style:{margin:"6px 0 14px",padding:"12px 16px",background:"rgba(154,123,62,0.10)",border:"1px solid rgba(154,123,62,0.45)",borderRadius:8,fontSize:12,color:"#7A5E24",lineHeight:1.5,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}},
            e("div",null,
              e("div",{style:{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",fontWeight:700,color:"#9A7B3E",marginBottom:3}},"🎭 Assumption Mode — planning"),
              e("div",{style:{fontWeight:700,fontSize:14,color:"#7A5E24"}},"Planning consent GRANTED (assumed)"),
              e("div",{style:{fontSize:11,color:"#8A6E34",marginTop:3}},
                "Presenting the consented scheme for stakeholders. This is an illustrative assumption, not the achieved position — toggle off in the banner above to see the real basis."
              )
            )
          );
        }
        // v10.2 — if planning risk has been flagged (or a real status set), say so in AMBER
        // rather than a reassuring green "full consent assumed" — the consented figures are
        // the upside, not today's value.
        var pl2 = data.planning || {};
        var rlLvl = (pl2.riskLevel||"").toLowerCase();
        if(rlLvl==="high" || rlLvl==="medium"){
          return e("div",{style:{margin:"6px 0 14px",padding:"12px 16px",background:"rgba(154,123,62,0.08)",border:"1px solid rgba(154,123,62,0.45)",borderRadius:8,fontSize:12,color:"#7A5E24",lineHeight:1.5,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}},
            e("div",null,
              e("div",{style:{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",fontWeight:700,color:"#9A7B3E",marginBottom:3}},"Planning basis — "+(rlLvl==="high"?"HIGH RISK flagged":"moderate risk flagged")),
              e("div",{style:{fontWeight:700,fontSize:14,color:"#7A5E24"}},"Full consent ASSUMED — not yet achieved"),
              e("div",{style:{fontSize:11,color:"#8A6E34",marginTop:3}},
                "You've flagged planning risk as "+rlLvl+". The GDV/RLV/margin below are the consented UPSIDE, not today's value — treat this as a promotion play and weigh the risk with a planning scenario in Land Appraisal."
              )
            ),
            e("button",{onClick:function(){navTo("land");},style:{padding:"7px 14px",background:"transparent",border:"1px solid #9A7B3E",color:"#9A7B3E",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Weigh planning risk →")
          );
        }
        return e("div",{style:{margin:"6px 0 14px",padding:"12px 16px",background:"linear-gradient(135deg,rgba(45,122,101,0.10),rgba(45,122,101,0.04))",border:"1px solid rgba(45,122,101,0.4)",borderRadius:8,fontSize:12,color:"#1d5446",lineHeight:1.5,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}},
          e("div",null,
            e("div",{style:{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",fontWeight:700,color:"#2D7A65",marginBottom:3}},"Planning basis"),
            e("div",{style:{fontWeight:700,fontSize:14,color:"#1d5446"}},"Full consent (assumed)"),
            e("div",{style:{fontSize:11,color:"#3A6B5C",marginTop:3}},
              "These figures assume planning is granted, so the Dashboard leads with the profitable consented scheme. Apply a planning scenario in Land Appraisal to weigh the real planning risk."
            )
          ),
          e("button",{onClick:function(){navTo("land");},style:{padding:"7px 14px",background:"transparent",border:"1px solid #2D7A65",color:"#2D7A65",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Set planning scenario →")
        );
      })(),

      // Reconciliation note: explain why RLV's margin and Dashboard's margin look different
      gdv>0 && tc>0 && num((data.land&&data.land.price)||0) > 0 && e("div",{style:{margin:"6px 0 14px",padding:"10px 14px",background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
        e("strong",{style:{color:"#1E1F5C"}},"ℹ Why does this differ from the RLV stage? "),
        "The RLV uses a TARGET developer profit of ~17.5% to calculate the maximum land bid. This Dashboard shows your ACTUAL margin based on what you're paying for the land. ",
        "If actual land price (",fmt(num(data.land.price)),") < max land bid (",fmt(DMd.rlv),"), your actual margin (",pct(margin),") will be HIGHER than the 17.5% target."
      ),
      (function(){
        var hasLand=!!(data.land&&data.land.address);
        var hasCity=!!city;
        var hasSFHMix=!!(data.sfh&&data.sfh.mix&&data.sfh.mix.some(function(r){return num(r.count)>0;}));
        var hasFin=!!(data.fin&&(data.fin.buildPsf||data.fin.manualGdv));
        var hasPlan=!!(data.planning&&data.planning.lpa);
        if(hasLand&&hasSFHMix&&hasFin&&hasPlan)return null; // All done
        var steps=[];
        if(!hasLand)steps.push({n:1,label:"Import a land listing",action:function(){navTo("scraper");},btn:"Go to Land Finder →"});
        else if(!hasCity)steps.push({n:2,label:"Select city/market in Land Appraisal",action:function(){navTo("land");},btn:"Go to Land Appraisal →"});
        else if(!hasSFHMix)steps.push({n:3,label:"Fill in house type mix in SFH Appraisal",action:function(){navTo("sfh");},btn:"Go to SFH Appraisal →"});
        else if(!hasFin)steps.push({n:4,label:"Run Financial Modelling",action:function(){navTo("fin");},btn:"Go to Financial Modelling →"});
        else if(!hasPlan)steps.push({n:5,label:"Add planning details",action:function(){navTo("planning");},btn:"Go to Planning →"});
        if(steps.length===0)return null;
        var next=steps[0];
        return e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px dashed rgba(74,75,174,0.3)",borderRadius:8,padding:"10px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}},
          e("div",null,
            e("div",{style:{fontSize:10,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",marginBottom:2}},"Next step"),
            e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A"}},"Step "+next.n+": "+next.label)
          ),
          e("button",{onClick:next.action,style:{padding:"7px 16px",background:"#4A4BAE",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}},next.btn)
        );
      })(),
      data.masterReport&&(function(){
        var ai2={};
        try{ai2=JSON.parse(data.masterReport);}catch(e){return null;}
        if(!ai2.goNoGo)return null;
        var goColor=ai2.goNoGo==="GO"?"#2D7A65":ai2.goNoGo==="CAUTION"?"#9A7B3E":"#B05A35";
        return e("div",{style:{background:goColor+"15",border:"2px solid "+goColor,borderRadius:10,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:16}},
          e("div",{style:{fontSize:32,fontWeight:900,color:goColor,minWidth:60,textAlign:"center"}},
            ai2.goNoGo==="GO"?"✓ GO":ai2.goNoGo==="CAUTION"?"⚠ CAUTION":"✗ NO-GO"
          ),
          e("div",{style:{flex:1}},
            e("div",{style:{fontSize:13,fontWeight:700,color:goColor,marginBottom:3}},"AI Deal Assessment — "+ai2.goNoGo),
            e("div",{style:{fontSize:12,color:"#3A3D6A",lineHeight:1.6}},ai2.goNoGoReason||""),
            ai2.marketCommentary&&e("div",{style:{fontSize:11,color:"#7278A0",marginTop:4,fontStyle:"italic"}},ai2.marketCommentary)
          ),
          e("div",{style:{textAlign:"right",flexShrink:0}},
            ai2.recommendedUnits&&e("div",{style:{fontSize:11,color:"#7278A0"}},"Recommended: "+ai2.recommendedUnits+" units @ "+ai2.recommendedDph+"dph"),
            ai2.recommendedBid&&e("div",{style:{fontSize:11,color:goColor,fontWeight:700}},"Bid: £"+Math.round(ai2.recommendedBid).toLocaleString()),
            ai2.planningRisk&&e("div",{style:{fontSize:10,color:"#7278A0"}},"Planning risk: "+ai2.planningRisk)
          )
        );
      })(),
      (function(){
        var inbox=(data.placona&&data.placona.inbox)||[];
        if(!inbox||inbox.length===0)return null;
        return e("div",{style:{background:"linear-gradient(135deg,rgba(74,75,174,0.08),rgba(45,122,101,0.05))",border:"1px solid #4A4BAE",borderRadius:10,padding:"14px 18px",marginBottom:16}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
            e("div",null,
              e("div",{style:{fontSize:10,fontWeight:800,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".12em",marginBottom:2}},"Placona Inbox"),
              e("div",{style:{fontSize:12,color:"#7278A0"}},inbox.length+" site"+(inbox.length!==1?"s":"")+" from Placona agent")
            ),
            e("button",{onClick:function(){up("placona","inbox",[]);},style:{padding:"4px 10px",background:"none",border:"1px solid #DDE0ED",borderRadius:4,color:"#B05A35",fontSize:10,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Clear all")
          ),
          inbox.slice(0,5).map(function(site,si){
            return e("div",{key:si,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#fff",borderRadius:6,marginBottom:6,border:"1px solid #DDE0ED"}},
              e("div",{style:{flex:1}},
                e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A"}},site.site_name||site.address_or_location||"Unknown site"),
                e("div",{style:{fontSize:10,color:"#7278A0"}},(site.county||"")+(site.local_planning_authority?" - "+site.local_planning_authority:"")+" - Score: "+(site.placona_score||"—")+" "+(site.placona_category?"("+site.placona_category+")":""))
              ),
              e("button",{
                onClick:function(){
                  loadSiteIntoDeal(site);
                  var newInbox=inbox.filter(function(_,idx2){return idx2!==si;});
                  up("placona","inbox",newInbox);
                },
                style:{padding:"6px 12px",background:"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}
              },"Load Deal")
            );
          }),
          inbox.length>5&&e("div",{style:{fontSize:11,color:"#7278A0",textAlign:"center",marginTop:4}},inbox.length-5+" more sites in inbox")
        );
      })(),
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}},
        cards.map(function(card){
          return e("div",{key:card.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:16}},
            e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}},card.l),
            e("div",{style:{fontSize:22,fontWeight:700,color:card.c||"#2E2F8A"}},card.v)
          );
        })
      ),
      e("div",{style:S.card},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,paddingBottom:12,borderBottom:"1px solid #DDE0ED",marginBottom:14}},
          e("span",null,"Journey & Asset Type"),
          e("div",{style:{display:"flex",gap:6}},
            e("button",{onClick:function(){setJourney("land");navTo("scraper");},
              style:{padding:"4px 10px",background:"#4A4BAE",border:"none",color:"#fff",borderRadius:4,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "🔍 Start Land Journey"),
            e("button",{onClick:function(){setJourney("property");navTo("epe");},
              style:{padding:"4px 10px",background:"#2D7A65",border:"none",color:"#fff",borderRadius:4,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "🏠 Start Property Journey"),
            journey!=="all"&&e("button",{onClick:function(){setJourney("all");},
              style:{padding:"4px 10px",background:"transparent",border:"1px solid #DDE0ED",color:"#7278A0",borderRadius:4,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "Show All Stages")
          )
        ),
        e("div",{style:{display:"flex",gap:10,flexWrap:"wrap"}},
          [
            {id:"btr",  label:"BTR",  desc:"Build to Rent — apartment block"},
            {id:"pbsa", label:"PBSA", desc:"Purpose Built Student Accommodation"},
            {id:"sfh",  label:"SFH",  desc:"Single Family Housing — housing estate"},
          ].map(function(t){
            return e("div",{key:t.id,style:{display:"flex",flexDirection:"column",gap:4}},
              e("button",{onClick:function(){
                setData(function(d){return Object.assign({},d,{assetType:t.id});});
                setJourney(t.id); // auto-switch journey when asset type selected
              },
                style:{padding:"8px 20px",background:at===t.id?"#4A4BAE":"transparent",border:"1px solid #4A4BAE",color:at===t.id?"#fff":"#4A4BAE",borderRadius:5,fontFamily:"DM Sans,sans-serif",fontSize:12,fontWeight:700,cursor:"pointer"}},
                t.label),
              e("div",{style:{fontSize:9,color:"#7278A0",textAlign:"center",maxWidth:120}},t.desc)
            );
          })
        )
      ),
      e("div",{style:S.card},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,paddingBottom:12,borderBottom:"1px solid #DDE0ED",marginBottom:14}},
          e("span",null,"Quick Navigation"),
          e("div",{style:{display:"flex",gap:8}},
            e("button",{onClick:function(){setJourney("land");navTo("scraper");},
              style:{padding:"5px 12px",background:"#4A4BAE",border:"none",color:"#fff",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "🔍 Start Land Journey"),
            e("button",{onClick:function(){setJourney("property");navTo("epe");},
              style:{padding:"5px 12px",background:"#2D7A65",border:"none",color:"#fff",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "🏠 Start Property Journey")
          )
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}},
          (function(){
            var filtered=journey==="all"?
              (function(){
            var showAll=data.showAllStages;
            var coreStages=["scraper","rlv","sfh","fin","dashboard","portfolio"];
            var filtered=showAll?ALL_STAGES:ALL_STAGES.filter(function(s){
              var inJourney2=s.journeys&&(s.journeys.indexOf(journey)>=0||s.journeys.indexOf("all")>=0); return inJourney2||coreStages.indexOf(s.id)>=0;
            });
            return filtered;
          })().filter(function(s){return s.id!=="dashboard";}):
              (function(){
            var showAll=data.showAllStages;
            var coreStages=["scraper","rlv","sfh","fin","dashboard","portfolio"];
            var filtered=showAll?ALL_STAGES:ALL_STAGES.filter(function(s){
              var inJourney2=s.journeys&&(s.journeys.indexOf(journey)>=0||s.journeys.indexOf("all")>=0); return inJourney2||coreStages.indexOf(s.id)>=0;
            });
            return filtered;
          })().filter(function(s){return s.id!=="dashboard"&&(s.journeys.indexOf(journey)>=0||s.journeys.indexOf("all")>=0);});
            return filtered.map(function(s){
              return e("button",{key:s.id,onClick:function(){navTo(s.id);},
                style:{padding:"10px 8px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:7,fontFamily:"DM Sans,sans-serif",fontSize:11,fontWeight:500,color:"#3A3D6A",cursor:"pointer",textAlign:"center"}},
                s.icon+" "+s.label);
            });
          })()
        )
      ),
      e(AIPanel,{user:user,up:up,stage:"dashboard",data:data,persistKey:"dashboard_generate_deal_summar",label:"Generate Deal Summary",
        prompt:buildHonestPrompt(data,"Provide a comprehensive deal summary with investment thesis, key strengths, risks and next steps for a "+at.toUpperCase()+" development in "+cityName(city)+". GDV: "+fmt(gdv)+", Total cost: "+fmt(tc)+", Profit: "+fmt(profit)+", Margin: "+pct(margin)+". Rate the deal 1-10 with justification.")}),

      // ── WORKFLOW FLOWCHART ──────────────────────────────────────────────
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Deal Workflow — Your Journey"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:16}},"Follow this workflow for your selected asset type. Click any stage to navigate there. Completed stages show green."),
        journey!=="all"&&e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:6,padding:"8px 14px",fontSize:11,color:"#4A4BAE",marginBottom:12,display:"flex",alignItems:"center",gap:8}},
          e("span",{style:{fontWeight:700}},"Active Journey:"),
          e("span",null,(JOURNEYS[journey]&&JOURNEYS[journey].label)||journey),
          e("span",{style:{color:"#7278A0"}}," — irrelevant stages hidden in sidebar"),
          e("span",{onClick:function(){setJourney("all");},style:{marginLeft:"auto",cursor:"pointer",color:"#4A4BAE",fontWeight:700,fontSize:10}},"Show All →")
        ),

        // Asset type selector at top
        e("div",{style:{display:"flex",gap:8,marginBottom:20,padding:"12px 14px",background:"#F7F8FC",borderRadius:8}},
          e("span",{style:{fontSize:11,color:"#7278A0",fontWeight:600,marginRight:4}},"Workflow for:"),
          [
            {id:"btr",label:"BTR — Build to Rent"},
            {id:"pbsa",label:"PBSA — Student Accommodation"},
            {id:"sfh",label:"SFH — Housing Estate"},
          ].map(function(t){
            return e("button",{key:t.id,
              onClick:function(){setData(function(d){return Object.assign({},d,{assetType:t.id});});},
              style:{padding:"6px 14px",background:at===t.id?"#4A4BAE":"#fff",border:"1px solid "+(at===t.id?"#4A4BAE":"#DDE0ED"),color:at===t.id?"#fff":"#7278A0",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },t.label);
          })
        ),

        // Flowchart
        (function(){
          var steps={
            btr:[
              {phase:"1. FIND",color:"#4A4BAE",steps:[
                {id:"scraper",label:"Land Finder",desc:"Browse Bruton Knowles, Savills, Rightmove. Paste listing text to auto-extract data.",icon:"🔍",key:"land.address"},
                {id:"land",label:"Land Appraisal",desc:"Score the site — location, transport, contamination, tenure, constraints. Get Go/No-Go.",icon:"⬟",key:"land.city"},
                {id:"rlv",label:"Land Valuation",desc:"Run live Land Registry data. Calculate maximum bid using residual valuation.",icon:"◆",key:"rlv.units"},
              ]},
              {phase:"2. APPRAISE",color:"#7B6CB0",steps:[
                {id:"hra",label:"BTR Block Appraisal",desc:"Model the apartment block — storeys, unit mix (studio/1/2 bed), GIA efficiency, BSA compliance.",icon:"🏢",key:"hra.storeys"},
                {id:"planning",label:"Planning & Viability",desc:"NPPF compliance, LPA strategy, S106, BNG, affordable housing, fire gateway.",icon:"▲",key:"planning.lpa"},
              ]},
              {phase:"3. MODEL",color:"#2D7A65",steps:[
                {id:"fin",label:"Financial Modelling",desc:"Full appraisal — GDV, NOI, exit yield, TDC, developer profit, bear/base/bull scenarios.",icon:"◉",key:"fin.exitYield"},
                {id:"dd",label:"Due Diligence",desc:"Legal, technical, planning and commercial checklist. Clear all items before exchange.",icon:"◈",key:null},
                {id:"risks",label:"Risk Register",desc:"RAG-rate all risks. Red risks must have mitigation before proceeding.",icon:"⬡",key:null},
              ]},
              {phase:"4. EXIT",color:"#9A7B3E",steps:[
                {id:"exit",label:"Investment Exit",desc:"Forward fund, forward sale or stabilised exit. Generate HoTs and Investment Memorandum.",icon:"◆",key:"exit.strategy"},
              ]},
            ],
            pbsa:[
              {phase:"1. FIND",color:"#4A4BAE",steps:[
                {id:"scraper",label:"Land Finder",desc:"Find sites near universities. Bruton Knowles, Savills, Knight Frank all list PBSA opportunities.",icon:"🔍",key:"land.address"},
                {id:"land",label:"Land Appraisal",desc:"PBSA needs to be within 10-15 min walk of university. Score proximity heavily.",icon:"⬟",key:"land.city"},
                {id:"rlv",label:"Land Valuation",desc:"PBSA land values are higher near Russell Group unis. Run residual at PBSA yields (5-6%).",icon:"◆",key:"rlv.units"},
              ]},
              {phase:"2. APPRAISE",color:"#7B6CB0",steps:[
                {id:"hra",label:"PBSA Block Appraisal",desc:"Model bed count, cluster flats vs studios, amenity space, communal areas, management fees.",icon:"🏢",key:"hra.storeys"},
                {id:"planning",label:"Planning & Viability",desc:"Article 4 directions, HMO policy, university endorsement letters, student demand evidence.",icon:"▲",key:"planning.lpa"},
              ]},
              {phase:"3. MODEL",color:"#2D7A65",steps:[
                {id:"fin",label:"Financial Modelling",desc:"Model weekly rents × 51 weeks. PBSA void typically 3%. OpEx includes management (15-20% of income).",icon:"◉",key:"fin.exitYield"},
                {id:"dd",label:"Due Diligence",desc:"University nomination agreements, Article 4 compliance, fire strategy, accessibility.",icon:"◈",key:null},
                {id:"risks",label:"Risk Register",desc:"Key PBSA risks: university enrolment decline, operator default, Article 4 refusal.",icon:"⬡",key:null},
              ]},
              {phase:"4. EXIT",color:"#9A7B3E",steps:[
                {id:"exit",label:"Investment Exit",desc:"PBSA exits to specialist funds (Blackstone/iQ, Unite, Hines). Forward fund typical at 5-5.5% yield.",icon:"◆",key:"exit.strategy"},
              ]},
            ],
            sfh:[
              {phase:"1. FIND",color:"#4A4BAE",steps:[
                {id:"scraper",label:"Land Finder",desc:"Look for greenfield sites with local plan allocation, or brownfield with residential use class. Bruton Knowles specialise in strategic land.",icon:"🔍",key:"land.address"},
                {id:"land",label:"Land Appraisal",desc:"SFH needs good school catchments, transport links and proximity to employment. Min 30 dph density.",icon:"⬟",key:"land.city"},
                {id:"rlv",label:"Land Valuation",desc:"Value by £/plot or £/acre. Typical SFH land £150k-500k/acre depending on location and consent.",icon:"◆",key:"rlv.units"},
              ]},
              {phase:"2. APPRAISE",color:"#7B6CB0",steps:[
                {id:"sfh",label:"SFH Scheme Design",desc:"Set house type mix (2/3/4 bed). Run plot-by-plot appraisal with roads adoption (S38/S104) and SuDS.",icon:"🏡",key:"sfh.acres"},
                {id:"planning",label:"Planning & Viability",desc:"Outline application strategy, affordable housing (typically 25-40%), BNG, highways, drainage.",icon:"▲",key:"planning.lpa"},
              ]},
              {phase:"3. MODEL",color:"#2D7A65",steps:[
                {id:"fin",label:"Financial Modelling",desc:"Phase the development — typically 30-50 plots/year. Model sales cashflow by phase.",icon:"◉",key:"fin.exitYield"},
                {id:"dd",label:"Due Diligence",desc:"Title, ground conditions, utilities capacity, s38/s104 adoption agreements, section 278.",icon:"◈",key:null},
                {id:"risks",label:"Risk Register",desc:"SFH risks: planning refusal, build cost inflation, absorption rate slower than forecast.",icon:"⬡",key:null},
              ]},
              {phase:"4. EXIT",color:"#9A7B3E",steps:[
                {id:"exit",label:"Investment Exit",desc:"SFH exits via plot sales (open market) or bulk sale to housing association / BTR operator for affordable element.",icon:"◆",key:"exit.strategy"},
              ]},
            ],
          };

          var workflow=steps[at]||steps.btr;
          
          function isComplete(step) {
            // v10.8 — use the canonical engine predicate so the checklist agrees with the
            // rest of the app. The old single-field check ("fin.exitYield", and key:null for
            // Risk Register) marked Financial Modelling and Risk Register incomplete even when
            // both held real data.
            if(typeof isStageComplete==="function") return isStageComplete(step.id, data);
            if(!step.key) return false;
            var parts=step.key.split(".");
            var obj=data[parts[0]];
            return obj&&obj[parts[1]]&&obj[parts[1]]!=="";
          }

          return e("div",null,
            workflow.map(function(phase,pi){
              // Filter steps based on active journey
              var filteredSteps=phase.steps.filter(function(step){
                if(journey==="all")return true;
                var stageInfo=ALL_STAGES.find(function(s){return s.id===step.id;});
                if(!stageInfo)return true;
                return stageInfo.journeys.indexOf(journey)>=0||stageInfo.journeys.indexOf("all")>=0;
              });
              if(filteredSteps.length===0)return null;
              var phaseSteps=Object.assign({},phase,{steps:filteredSteps});
              return e("div",{key:phase.phase,style:{marginBottom:20}},
                e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:12}},
                  e("div",{style:{background:phase.color,color:"#fff",padding:"4px 14px",borderRadius:20,fontSize:10,fontWeight:700,letterSpacing:".1em"}},phase.phase),
                  e("div",{style:{flex:1,height:1,background:phase.color+"40"}})
                ),
                e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,paddingLeft:8}},
                  filteredSteps.map(function(step,si){
                    var complete=isComplete(step);
                    var active=stage===step.id;
                    return e("div",{key:step.id,
                      onClick:function(){navTo(step.id);},
                      style:{
                        background:active?"rgba(74,75,174,0.08)":complete?"rgba(45,122,101,0.06)":"#fff",
                        border:"1px solid "+(active?"#4A4BAE":complete?"#2D7A65":"#DDE0ED"),
                        borderLeft:"4px solid "+(active?"#4A4BAE":complete?"#2D7A65":phase.color+"60"),
                        borderRadius:8,padding:"14px 16px",cursor:"pointer",transition:"all .15s",
                      },
                      onMouseOver:function(ev){if(!active)ev.currentTarget.style.borderColor=phase.color;},
                      onMouseOut:function(ev){if(!active)ev.currentTarget.style.borderColor=complete?"#2D7A65":"#DDE0ED";}
                    },
                      e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:6}},
                        e("span",{style:{fontSize:16}},step.icon),
                        e("span",{style:{fontSize:13,fontWeight:700,color:active?"#4A4BAE":complete?"#2D7A65":"#2E2F8A"}},step.label),
                        complete&&e("span",{style:{marginLeft:"auto",fontSize:11,color:"#2D7A65",fontWeight:700}},"✓"),
                        active&&e("span",{style:{marginLeft:"auto",fontSize:10,color:"#4A4BAE",fontWeight:700}},"● HERE"),
                      ),
                      e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6}},step.desc),
                      e("div",{style:{marginTop:8,fontSize:10,fontWeight:700,color:active?"#4A4BAE":complete?"#2D7A65":"#A0A4C0"}},
                        active?"→ Currently here":complete?"✓ Data entered — click to review":"Click to open →"
                      )
                    );
                  })
                )
              );
            })
          );
        })()
      )
    );
    }catch(dashErr){
      return e("div",{style:{padding:32,color:"#B05A35"}},
        e("div",{style:{fontSize:18,fontWeight:700,marginBottom:8}},"Dashboard error"),
        e("div",{style:{fontSize:12,fontFamily:"DM Mono,monospace"}},dashErr.message||String(dashErr))
      );
    }
  }
