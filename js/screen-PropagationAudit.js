// ── renderPropagationAudit  (params: data, setData, up)
// Lifted out of Tool; body byte-unchanged. Takes the Tool variables it uses as
// explicit params; all other names resolve to globals. Loaded before 05-tool.js.
function renderPropagationAudit(data, setData, up){
    // Field map: each row describes a logical field, where it lives in each stage, and how to fix drift
    // Read paths use dot notation. Write paths are pairs of (stage, key) for `up()` calls.
    var FIELD_MAP = [
      // ── CORE SITE FACTS ──────────────────────────────────────
      {group:"Site facts (set in Land Appraisal, used everywhere)", rows:[
        {field:"Postcode",                paths:[["land","postcode"]]},
        {field:"City",                    paths:[["land","city"], ["hra","city"], ["sfh","city"]], canonical:"land.city"},
        {field:"Acres",                   paths:[["land","acres"], ["sfh","acres"]], canonical:"land.acres"},
        {field:"Asking price (£)",        paths:[["land","price"]]},
        {field:"Scenario land value (£)", paths:[["land","scenarioLandValue"]]},
        {field:"Planning status",         paths:[["land","planningStatus"], ["planning","status"]], canonical:"land.planningStatus"},
      ]},
      // ── UNITS ────────────────────────────────────────────────
      {group:"Unit count (most common cross-stage gap)", rows:[
        {field:"Units (Planning)",        paths:[["planning","units"]]},
        {field:"Units (RLV)",             paths:[["rlv","units"]]},
        {field:"Total units (SFH)",       paths:[["sfh","totalUnits"]]},
        {field:"Units (HRA / BTR-PBSA)",  paths:[["hra","units"]]},
      ]},
      // ── AFFORDABLE HOUSING ──────────────────────────────────
      {group:"Affordable Housing %", rows:[
        {field:"Scenario AH%",            paths:[["land","scenarioAhPct"]]},
        {field:"Planning ahPct",          paths:[["planning","ahPct"]],   syncFrom:"land.scenarioAhPct"},
        {field:"Planning afhPct",         paths:[["planning","afhPct"]],  syncFrom:"land.scenarioAhPct"},
        {field:"SFH ahPct",               paths:[["sfh","ahPct"]],         syncFrom:"land.scenarioAhPct"},
        {field:"HRA ahPct",               paths:[["hra","ahPct"]],         syncFrom:"land.scenarioAhPct"},
        {field:"Tenure ahPct",            paths:[["tenure","ahPct"]],      syncFrom:"land.scenarioAhPct"},
      ]},
      // ── S106 ────────────────────────────────────────────────
      {group:"S106 per unit (£)", rows:[
        {field:"Scenario S106pu",         paths:[["land","scenarioS106pu"]]},
        {field:"Planning s106pu",         paths:[["planning","s106pu"]],   syncFrom:"land.scenarioS106pu"},
        {field:"RLV s106pu",              paths:[["rlv","s106pu"]],         syncFrom:"land.scenarioS106pu"},
        {field:"SFH s106pu",              paths:[["sfh","s106pu"]],         syncFrom:"land.scenarioS106pu"},
        {field:"HRA s106pu",              paths:[["hra","s106pu"]],         syncFrom:"land.scenarioS106pu"},
        {field:"Fin s106pu",              paths:[["fin","s106pu"]],         syncFrom:"land.scenarioS106pu"},
      ]},
      // ── FINANCE ─────────────────────────────────────────────
      {group:"Finance rate %", rows:[
        {field:"Scenario finance rate",   paths:[["land","scenarioFinanceRate"]]},
        {field:"RLV finRate",             paths:[["rlv","finRate"]],        syncFrom:"land.scenarioFinanceRate"},
        {field:"Fin finRate",             paths:[["fin","finRate"]],        syncFrom:"land.scenarioFinanceRate"},
        {field:"SFH finRate",             paths:[["sfh","finRate"]],        syncFrom:"land.scenarioFinanceRate"},
        {field:"HRA finRate",             paths:[["hra","finRate"]],        syncFrom:"land.scenarioFinanceRate"},
      ]},
      // ── BUILD COST ──────────────────────────────────────────
      {group:"Build cost £/sqft", rows:[
        {field:"RLV buildPsf",            paths:[["rlv","buildPsf"]]},
        {field:"SFH base build",          paths:[["sfh","buildPsf"]]},
        {field:"HRA buildPsf",            paths:[["hra","buildPsf"]]},
        {field:"Fin buildPsf",            paths:[["fin","buildPsf"]]},
      ]},
      // ── SALE PSF ────────────────────────────────────────────
      {group:"Sale £/sqft", rows:[
        {field:"RLV salePsf",             paths:[["rlv","salePsf"]]},
        {field:"SFH basePsf",             paths:[["sfh","basePsf"]]},
        {field:"HRA salePsf",             paths:[["hra","salePsf"]]},
      ]},
      // ── TIMELINE ────────────────────────────────────────────
      {group:"Timeline (months to commit)", rows:[
        {field:"Scenario timelineMo",     paths:[["land","scenarioTimelineMo"]]},
        {field:"Exit timeline (planning months)", paths:[["exit","planningMo"]], syncFrom:"land.scenarioTimelineMo"},
        {field:"Exit build duration",     paths:[["exit","buildMo"]]},
      ]},
      // ── YIELD ───────────────────────────────────────────────
      {group:"Yield (institutional cap rate)", rows:[
        {field:"Scenario yieldAdj",       paths:[["land","scenarioYieldAdj"]]},
        {field:"Capitalisation targetYield", paths:[["capitalise","targetYield"]]},
        {field:"Cap pre-scenario baseline", paths:[["capitalise","_preScenarioYield"]]},
      ]},
      // ── GRANTS ──────────────────────────────────────────────
      {group:"Grants & funding (NOT propagated — known gap)", rows:[
        {field:"AHP grant total",         paths:[["grants","ahpTotal"]]},
        {field:"Brownfield grant",        paths:[["grants","brownfield"]]},
        {field:"Help to Build",           paths:[["grants","helpToBuild"]]},
        {field:"LA capital programme",    paths:[["grants","laCapital"]]},
        {field:"Fin: grants deducted",    paths:[["fin","grantsTotal"]]},
      ]},
      // ── GDV ─────────────────────────────────────────────────
      // v10.10 — these are OUTPUTS, calculated live from the one engine on each render,
      // never persisted (a stored copy would drift the moment an input changed — the very
      // bug this audit exists to catch). So we read them live here for cross-reference,
      // rather than expecting write-back into placeholder fields nothing ever filled.
      {group:"GDV / outputs (calculated live — one engine, shown for cross-reference)", rows:[
        {field:"SFH scheme GDV",          calc:function(d){ return (d.sfh&&d.sfh.mix&&d.sfh.mix.length&&typeof computeSFHMetrics==="function")?num(computeSFHMetrics(d).gdv):0; }},
        {field:"HRA (BTR/PBSA) GDV",       calc:function(d){ return (d.hra&&num(d.hra.units)&&typeof computeHRAMetrics==="function")?num(computeHRAMetrics(d).gdv):0; }},
        {field:"Tenure Mix blended GDV",   calc:function(d){ return (d.tenure&&d.tenure.mix&&typeof computeTenureMetrics==="function")?num(computeTenureMetrics(d).blendedGdv):0; }},
        {field:"Engine GDV (used across all stages)", calc:function(d){ return (typeof calcDealMetrics==="function")?num(calcDealMetrics(d).gdv):0; }},
        {field:"Manual GDV override (Fin)", paths:[["fin","gdvOverride"]]},
      ]},
    ];

    function readPath(obj, path){
      if(!obj || !path) return null;
      var parts = path.split(".");
      var cur = obj;
      for(var i=0;i<parts.length;i++){
        if(cur === null || cur === undefined) return null;
        cur = cur[parts[i]];
      }
      return cur === undefined ? null : cur;
    }

    function valOf(stagePath){
      var obj = data[stagePath[0]];
      return obj ? obj[stagePath[1]] : undefined;
    }

    function formatVal(v){
      if(v === null || v === undefined || v === "") return "—";
      if(typeof v === "number") return v.toLocaleString();
      return String(v);
    }

    function rowStatus(row){
      // v10.10 — calculated output rows: read the live engine value (never persisted).
      if(row.calc){
        var cv = num(row.calc(data));
        return cv > 0 ? {tone:"calc", values:[cv]} : {tone:"empty", values:[null]};
      }
      var vals = row.paths.map(function(p){return valOf(p);});
      var nonEmpty = vals.filter(function(v){return v !== null && v !== undefined && v !== "" && v !== 0;});
      if(nonEmpty.length === 0) return {tone:"empty", values:vals};
      // Unique non-empty values
      var unique = [];
      nonEmpty.forEach(function(v){
        if(unique.indexOf(String(v)) === -1) unique.push(String(v));
      });
      if(unique.length === 1 && nonEmpty.length === vals.length) return {tone:"sync", values:vals};
      if(unique.length === 1 && nonEmpty.length < vals.length) return {tone:"partial", values:vals};
      return {tone:"drift", values:vals};
    }

    // Tally
    var totals = {drift:0, partial:0, sync:0, empty:0, calc:0};
    FIELD_MAP.forEach(function(grp){
      grp.rows.forEach(function(r){
        var s = rowStatus(r);
        totals[s.tone]++;
      });
    });

    // v9.67 — authoritative cross-field check. SHARED_FIELD_GROUPS defines the fields that
    // MUST hold the same value. The per-row map above checks each field in isolation, so a
    // mismatch like Tenure ahPct 35 vs Planning/SFH 30 slipped through as "all in sync".
    // This compares the actual values within each shared group and flags real disagreement.
    var sharedDrift = [];
    if(typeof SHARED_FIELD_GROUPS !== "undefined"){
      SHARED_FIELD_GROUPS.forEach(function(group){
        var seen = [];
        group.forEach(function(t){
          var sec = data[t[0]], v = sec ? sec[t[1]] : undefined;
          if(v === null || v === undefined || v === "" || v === 0) return;
          seen.push({label:t[0]+"."+t[1], v:String(v)});
        });
        var distinct = seen.filter(function(x,i,a){return a.findIndex(function(y){return y.v===x.v;})===i;});
        if(seen.length > 1 && distinct.length > 1) sharedDrift.push({fields:seen});
      });
    }
    // v10.13 — cross-check the CALCULATED GDV surfaces. They must agree now that the SFH
    // engine, the Tenure Mix stage and calcDealMetrics all blend off one retail base. The
    // raw-field checks above can't see this (GDV is an output, not an input), which is why
    // a real £379m/£488m/£510m split once stayed invisible here. Flags >2% disagreement.
    (function(){
      if(!(typeof computeSFHMetrics==="function") || !(data.sfh && data.sfh.mix && data.sfh.mix.length)) return;
      var sm = computeSFHMetrics(data);
      if(!(num(sm.gdv) > 0)) return;
      var vals = [{label:"Engine GDV", v:(typeof calcDealMetrics==="function")?num(calcDealMetrics(data).gdv):0},
                  {label:"SFH engine GDV", v:num(sm.gdv)}];
      if(data.tenure && data.tenure.mix && typeof computeTenureMetrics==="function")
        vals.push({label:"Tenure Mix blended", v:num(computeTenureMetrics(data).blendedGdv)});
      var present = vals.filter(function(x){return x.v > 0;});
      if(present.length < 2) return;
      var hi = Math.max.apply(null, present.map(function(x){return x.v;}));
      var lo = Math.min.apply(null, present.map(function(x){return x.v;}));
      if(hi > 0 && (hi - lo) / hi > 0.02)
        sharedDrift.push({fields:present.map(function(x){return {label:x.label, v:"£"+(Math.round(x.v/1e5)/10)+"m"};})});
    })();
    totals.drift += sharedDrift.length;

    function autoFixAll(){
      // v10.14 — proceed directly (no blocking confirm). This only copies scenario values into
      // empty/divergent stage fields (never touches GDV, build cost or sale-PSF overrides).
      setData(function(prev){
        var next = Object.assign({}, prev);
        function setIf(stage, key, value){
          if(value === null || value === undefined || value === "" || value === 0) return;
          if(!next[stage]) next[stage] = Object.assign({}, prev[stage] || {});
          else next[stage] = Object.assign({}, next[stage]);
          next[stage][key] = value;
        }
        var ah = num((prev.land && prev.land.scenarioAhPct) || 0);
        var s106 = num((prev.land && prev.land.scenarioS106pu) || 0);
        var fin = num((prev.land && prev.land.scenarioFinanceRate) || 0);
        var time = num((prev.land && prev.land.scenarioTimelineMo) || 0);
        if(ah > 0){
          setIf("planning","ahPct",ah); setIf("planning","afhPct",ah);
          setIf("sfh","ahPct",ah); setIf("hra","ahPct",ah); setIf("tenure","ahPct",ah);
        }
        if(s106 > 0){
          setIf("planning","s106pu",s106); setIf("rlv","s106pu",s106);
          setIf("sfh","s106pu",s106); setIf("hra","s106pu",s106); setIf("fin","s106pu",s106);
        }
        if(fin > 0){
          setIf("rlv","finRate",fin); setIf("fin","finRate",fin);
          setIf("sfh","finRate",fin); setIf("hra","finRate",fin);
        }
        if(time > 0){
          if(!num((prev.exit && prev.exit.planningMo) || 0)) setIf("exit","planningMo",time);
        }
        return next;
      });
      notify("✓ Auto-fix complete. Refreshing audit table.");
    }

    function fixRow(row){
      // Sync this row's path to its declared syncFrom value
      var sourcePath = row.syncFrom;
      if(!sourcePath) return;
      var sourceVal = readPath(data, sourcePath);
      if(sourceVal === null || sourceVal === undefined || sourceVal === "" || sourceVal === 0) return;
      var target = row.paths[0];
      up(target[0], target[1], sourceVal);
    }

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Propagation Audit"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:14}},"Cross-stage field map — surfaces every gap where data isn't flowing between stages."),

      // Summary tiles
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}},
        [
          {label:"In sync",   value:totals.sync + totals.calc,    color:"#2D7A65"},
          {label:"Partial (some stages empty)", value:totals.partial, color:"#9A7B3E"},
          {label:"Drift (values disagree)", value:totals.drift, color:"#B05A35"},
          {label:"Empty (no data yet)", value:totals.empty, color:"#7278A0"},
        ].map(function(t){
          return e("div",{key:t.label,style:{background:"#fff",border:"1px solid #DDE0ED",borderLeft:"4px solid "+t.color,borderRadius:6,padding:"12px 14px"}},
            e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}},t.label),
            e("div",{style:{fontSize:22,fontWeight:800,color:t.color}},t.value)
          );
        })
      ),

      // v9.67 — explicit list of shared fields that disagree (caught by the cross-field check)
      sharedDrift.length > 0 && e("div",{style:{padding:"12px 16px",background:"rgba(176,90,53,0.07)",border:"1px solid rgba(176,90,53,0.4)",borderRadius:8,marginBottom:14}},
        e("div",{style:{fontSize:12,fontWeight:800,color:"#B05A35",marginBottom:6}},"⚠ "+sharedDrift.length+" shared field"+(sharedDrift.length>1?"s":"")+" disagree across stages — these should match"),
        sharedDrift.map(function(d,i){
          return e("div",{key:i,style:{fontSize:11,color:"#3A3D6A",fontFamily:"DM Mono,monospace",padding:"3px 0",borderTop:i?"1px solid rgba(176,90,53,0.15)":"none"}},
            d.fields.map(function(f){return f.label+" = "+f.v;}).join("   ·   ")
          );
        }),
        e("div",{style:{fontSize:10,color:"#9A7B3E",marginTop:6,fontStyle:"italic"}},"Set them to the same value (on whichever stage is wrong), or use Auto-fix to push the scenario value everywhere.")
      ),

      // Auto-fix CTA
      (totals.drift + totals.partial > 0) && e("div",{style:{padding:"12px 16px",background:"linear-gradient(135deg,rgba(45,122,101,0.10),rgba(45,122,101,0.04))",border:"1px solid rgba(45,122,101,0.4)",borderRadius:8,marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}},
        e("div",{style:{flex:1,minWidth:200,fontSize:12,color:"#1d5446"}},
          e("strong",null,(totals.drift+totals.partial)+" propagation gaps detected. "),
          "Click Auto-fix to push scenario values to all downstream stages where they're empty or different."
        ),
        e("button",{onClick:autoFixAll,style:{padding:"9px 16px",background:"#2D7A65",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}},"Auto-fix all propagation →")
      ),

      // Field map by group
      FIELD_MAP.map(function(grp,gi){
        return e("div",{key:gi,style:{marginBottom:18,background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden"}},
          e("div",{style:{padding:"10px 14px",background:"#F4F5FB",borderBottom:"1px solid #DDE0ED",fontSize:11,fontWeight:700,color:"#2E2F8A",letterSpacing:".05em",textTransform:"uppercase"}},grp.group),
          e("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
            e("thead",null,
              e("tr",{style:{background:"#F8F9FC",borderBottom:"1px solid #E8E9F5"}},
                e("th",{style:{padding:"8px 12px",textAlign:"left",fontSize:9,textTransform:"uppercase",letterSpacing:".08em",color:"#7278A0",fontWeight:700,width:200}},"Field"),
                e("th",{style:{padding:"8px 12px",textAlign:"left",fontSize:9,textTransform:"uppercase",letterSpacing:".08em",color:"#7278A0",fontWeight:700}},"Value(s)"),
                e("th",{style:{padding:"8px 12px",textAlign:"center",fontSize:9,textTransform:"uppercase",letterSpacing:".08em",color:"#7278A0",fontWeight:700,width:100}},"Status"),
                e("th",{style:{padding:"8px 12px",textAlign:"right",fontSize:9,textTransform:"uppercase",letterSpacing:".08em",color:"#7278A0",fontWeight:700,width:80}},"Action")
              )
            ),
            e("tbody",null,
              grp.rows.map(function(row,ri){
                var s = rowStatus(row);
                var toneColor = s.tone === "drift" ? "#B05A35"
                  : s.tone === "partial" ? "#9A7B3E"
                  : (s.tone === "sync" || s.tone === "calc") ? "#2D7A65"
                  : "#7278A0";
                var toneBg = s.tone === "drift" ? "rgba(176,90,53,0.05)"
                  : s.tone === "partial" ? "rgba(154,123,62,0.04)"
                  : (s.tone === "sync" || s.tone === "calc") ? "rgba(45,122,101,0.04)"
                  : "transparent";
                var toneLabel = s.tone === "drift" ? "⚠ Drift"
                  : s.tone === "partial" ? "◐ Partial"
                  : s.tone === "sync" ? "✓ Sync"
                  : s.tone === "calc" ? "✓ Calc (live)"
                  : "○ Empty";
                return e("tr",{key:ri,style:{borderBottom:"1px solid #F0F1F8",background:toneBg}},
                  e("td",{style:{padding:"10px 12px",color:"#3A3D6A",fontWeight:600}},row.field),
                  e("td",{style:{padding:"10px 12px"}},
                    row.calc
                      ? (function(){
                          var v = s.values[0];
                          var isEmpty = v === null || v === undefined || v === "" || v === 0;
                          return e("span",{style:{fontSize:10,color:isEmpty?"#7278A0":"#2E2F8A",fontFamily:"monospace"}},
                            "engine: ",
                            e("strong",{style:{color:isEmpty?"#9A7B3E":"#2E2F8A"}}, isEmpty ? "—" : "£"+formatVal(v)));
                        })()
                      : row.paths.map(function(p,pi){
                          var v = s.values[pi];
                          var isEmpty = v === null || v === undefined || v === "" || v === 0;
                          return e("span",{key:pi,style:{display:"inline-block",marginRight:10,fontSize:10,color:isEmpty?"#7278A0":"#2E2F8A",fontFamily:"monospace"}},
                            p[0]+"."+p[1]+": ",
                            e("strong",{style:{color:isEmpty?"#9A7B3E":"#2E2F8A"}},formatVal(v))
                          );
                        })
                  ),
                  e("td",{style:{padding:"10px 12px",textAlign:"center"}},
                    e("span",{style:{fontSize:10,fontWeight:700,color:toneColor,letterSpacing:".05em",textTransform:"uppercase"}},toneLabel)
                  ),
                  e("td",{style:{padding:"10px 12px",textAlign:"right"}},
                    row.syncFrom && (s.tone==="drift" || s.tone==="partial") ? e("button",{
                      onClick:function(){fixRow(row);},
                      style:{padding:"4px 10px",background:"transparent",border:"1px solid #4A4BAE",color:"#4A4BAE",borderRadius:3,fontSize:9,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
                    },"Sync") : null
                  )
                );
              })
            )
          )
        );
      }),

      // Legend
      e("div",{style:{marginTop:18,padding:"12px 14px",background:"#F8F9FC",border:"1px solid #E8E9F5",borderRadius:6,fontSize:10,color:"#7278A0",lineHeight:1.6}},
        e("strong",{style:{color:"#2E2F8A"}},"How to read this: "),
        e("span",{style:{color:"#2D7A65",fontWeight:700}},"✓ Sync")," = all stages agree · ",
        e("span",{style:{color:"#9A7B3E",fontWeight:700}},"◐ Partial")," = some stages have it, others are empty · ",
        e("span",{style:{color:"#B05A35",fontWeight:700}},"⚠ Drift")," = stages have different values (most concerning) · ",
        e("span",{style:{color:"#7278A0",fontWeight:700}},"○ Empty")," = no stage has this populated yet. ",
        "Use 'Sync' on individual rows for surgical fixes, or 'Auto-fix all' to resolve everything at once."
      )
    );
  }
