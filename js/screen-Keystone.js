// ── renderKeystone (params: data, setData, up, navTo, user) ──────────────────
// KEYSTONE — the Deal Builder PA. Sits at the very front of the journey. Paste
// emails/notes and upload documents/spreadsheets; the AI extracts a structured
// brief; Keystone builds a complete, engine-valid deal and AUTO-CHOOSES the
// journey from the data. The AI never does the maths — it extracts facts; the
// tested engine (buildDealFromBrief + calcDealMetrics) does every calculation.
// Loaded before 05-tool.js. Uses globals: e, S, callAI, buildDealFromBrief,
// detectJourney, KEYSTONE_BRIEF_SCHEMA, num, XLSX.
function renderKeystone(data, setData, up, navTo, user){
  var k = data.keystone || {};
  var journeyLabel = {sfh:"Single Family Housing", btr:"Build to Rent", pbsa:"PBSA / Student",
    land:"Land & Development", property:"Property Evaluator", recovery:"Planning Recovery"};

  function setK(patch){ setData(function(d){ return Object.assign({}, d, {keystone:Object.assign({}, d.keystone||{}, patch)}); }); }

  // ── Reset to raw import ──────────────────────────────────────────────────
  // v10.7 — clear the entire current deal back to the raw source it was imported
  // from (a Placona site or the original Keystone brief) and drop that brief into
  // the editor, so you can run Keystone fresh and re-audit from scratch. Saved
  // portfolio deals are untouched; nothing here fabricates data.
  var _rawBrief = (typeof rawImportBrief === "function") ? rawImportBrief(data) : null;
  function resetToRawImport(){
    if(!_rawBrief) return;
    // v10.14 — non-blocking confirm (was native confirm(), which froze the browser). This
    // wipes the current deal's work, so it keeps a guard — just a non-blocking one.
    var briefStr = JSON.stringify(_rawBrief, null, 2);
    confirmToast("Start fresh from the raw import?\n\nThis clears EVERYTHING in the deal currently open — appraisal figures, AI reports, Due Diligence, risks, constraint checks and assumption toggles — and restores just the raw imported brief. Your saved portfolio deals are untouched.", function(){
      setData(function(prev){
        // A brand-new blank deal carrying ONLY the raw brief + the import source,
        // so a fresh Keystone build (and a repeatable reset) is possible.
        return {
          assetType: undefined,
          keystone: { brief: briefStr, source: (prev.keystone && prev.keystone.source) || "" },
          _raw: prev._raw,
          _keystone: { sourceBrief: _rawBrief }
        };
      });
      if(typeof navTo === "function") navTo("keystone");
    }, {confirmLabel:"Reset to raw import"});
  }
  var rawResetPanel = _rawBrief ? e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #B05A35",background:"#FFFDFB"})},
    e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}},
      e("div",{style:{flex:1,minWidth:220}},
        e("div",{style:{fontSize:12,fontWeight:800,color:"#B05A35",marginBottom:3}},"↺ Start fresh from the raw import"),
        e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6}},
          "Clear all appraisal work in the current deal and restore just the raw import — ",
          e("strong",null,(_rawBrief.dealName || _rawBrief.address || _rawBrief.town || "the imported site")),
          (num(_rawBrief.acres)>0?" · "+_rawBrief.acres+" acres":""),
          (num(_rawBrief.askingPrice)>0?" · "+fmt(num(_rawBrief.askingPrice)):""),
          " — then run Keystone again for a clean re-audit. Saved deals are untouched."
        )
      ),
      e("button",{onClick:resetToRawImport,
        style:{padding:"9px 16px",background:"#B05A35",border:"none",color:"#fff",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",flexShrink:0}},
        "↺ Reset to raw import")
    )
  ) : null;

  // ── File upload: Excel via SheetJS, PDF via pdf.js, Word via mammoth, else text ──
  function appendSource(name, text){
    setData(function(d){
      var src = (d.keystone&&d.keystone.source)||"";
      return Object.assign({}, d, {keystone:Object.assign({}, d.keystone||{}, {source: src + (src?"\n\n":"") + "=== FILE: "+name+" ===\n" + text})});
    });
  }
  async function readPdf(buf){
    if(typeof pdfjsLib === "undefined") throw new Error("PDF reader still loading — try again in a moment");
    if(pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc){
      // v10.39 — self-hosted worker (was unpkg CDN), so PDF reading works without a CDN dependency.
      pdfjsLib.GlobalWorkerOptions.workerSrc = "js/vendor/pdf.worker.min.js";
    }
    var pdf = await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
    var out = [];
    for(var p=1; p<=pdf.numPages; p++){
      var page = await pdf.getPage(p);
      var tc = await page.getTextContent();
      out.push(tc.items.map(function(it){ return it.str; }).join(" "));
    }
    var joined = out.join("\n\n").replace(/[ \t]{2,}/g," ").trim();
    if(!joined) throw new Error("no selectable text (looks like a scanned/image PDF)");
    return joined;
  }
  function handleFiles(ev){
    var files = ev.target.files; if(!files || !files.length) return;
    Array.prototype.forEach.call(files, function(file){
      var nm = (file.name||"").toLowerCase();
      var isExcel = /\.(xlsx|xlsm|xlsb|xls|csv)$/.test(nm);
      var isPdf = /\.pdf$/.test(nm);
      var isWord = /\.docx?$/.test(nm);
      var reader = new FileReader();
      reader.onload = async function(e2){
        var text = "";
        try{
          if(isExcel && typeof XLSX !== "undefined"){
            var wb = XLSX.read(new Uint8Array(e2.target.result), {type:"array"});
            text = wb.SheetNames.map(function(sn){ return "=== Sheet: "+sn+" ===\n"+XLSX.utils.sheet_to_csv(wb.Sheets[sn]); }).join("\n\n");
          } else if(isPdf){
            text = await readPdf(e2.target.result);
          } else if(isWord && typeof mammoth !== "undefined"){
            var r = await mammoth.extractRawText({arrayBuffer:e2.target.result});
            text = (r.value||"").trim() || "[no text found in "+file.name+"]";
          } else {
            text = e2.target.result;
          }
        }catch(err){ text = "[Could not read "+file.name+": "+(err&&err.message||err)+" — paste its contents by hand if needed]"; }
        appendSource(file.name, text);
      };
      if(isExcel || isPdf || isWord) reader.readAsArrayBuffer(file); else reader.readAsText(file);
    });
  }

  // ── AI extraction: source text → a structured brief (JSON) ──
  async function extractBrief(){
    if(!(k.source||"").trim()){ notify("Paste some source text or upload a document first."); return; }
    setK({extracting:true, error:""});
    var schemaKeys = Object.keys(KEYSTONE_BRIEF_SCHEMA).map(function(f){ return f+": "+KEYSTONE_BRIEF_SCHEMA[f]; }).join("\n");
    var sys = "You are a UK residential development analyst building a deal brief for the Landform appraisal tool. Extract ONLY facts that are present or clearly implied. Do NOT invent figures. Output STRICT JSON only — no prose, no markdown fences.";
    var prompt = "From the SOURCE below, produce a single JSON object for this Landform deal brief. Use these fields (omit any you can't fill):\n\n"+schemaKeys+
      "\n\nRules: numbers as numbers (no £ or commas); houseMix and rents as arrays; put anything you assumed or couldn't find into an 'assumptions' array; choose assetType only if obvious, else leave it out (Landform auto-detects)." +
      "\n\nDEVELOP FROM THE SOURCE'S OWN FIGURES FIRST — do not substitute your own estimates for figures the source states:" +
      "\n• A capacity/allocation statement IS the unit figure: 'room for 1,800 houses', 'circa 1,800 units', 'allocated for ~1,000 homes', 'capacity for 1,800 dwellings' → units: 1800. Never drop it as vague. Quote the exact wording in assumptions." +
      "\n• Capture the site area (acres) exactly as stated. If given in hectares, convert: acres ≈ ha × 2.471." +
      "\n• Capture any stated or target density into 'density' as HOMES PER ACRE. If the source says dph (dwellings/hectare), convert to per-acre (÷ 2.471) and note the original figure and its unit (dph vs per-acre) in assumptions." +
      "\nSOURCE:\n"+(k.source||"").substring(0,12000);
    try{
      var res = await callAI(user, "keystone", sys, prompt);
      // pull the JSON object out of the response
      var s = res.indexOf("{"), e2 = res.lastIndexOf("}");
      var jsonStr = (s>=0 && e2>s) ? res.substring(s, e2+1) : res;
      var brief = JSON.parse(jsonStr);
      setK({brief: JSON.stringify(brief, null, 2), extracting:false, error:""});
    }catch(err){
      setK({extracting:false, error:"Couldn't parse a brief from that. You can paste/edit the brief JSON manually below. ("+err.message+")"});
    }
  }

  // ── Build the deal from the brief and load it ──
  function buildDeal(){
    var brief;
    try{ brief = JSON.parse(k.brief||"{}"); }
    catch(err){ notify("The brief isn't valid JSON. Fix it or re-run Extract.\n\n"+err.message); return; }
    var deal = buildDealFromBrief(brief);
    var hasExisting = !!(data.land && (data.land.address || data.land.city)) || !!(data.sfh && data.sfh.mix && data.sfh.mix.length);
    var journey = deal.assetType;
    // v10.7 — carry the raw Placona site forward so "Reset to raw import" keeps working
    // after a rebuild (buildDealFromBrief already stores _keystone.sourceBrief).
    function doBuild(){
      setData(function(prev){
        var built = Object.assign({}, deal, {_cloudDealId: undefined, _raw: prev._raw, keystone: Object.assign({}, prev.keystone||{}, {builtJourney:journey, builtAt:Date.now()}) });
        // v10.38 — on a REBUILD (there was an existing deal), preserve the user's manual
        // downstream work instead of silently wiping it (planning judgement, verified prices,
        // exit strategy, constraint checks, etc.). Record what was kept for a banner.
        var kept = [];
        if(hasExisting && typeof preserveManualOnRebuild === "function") kept = preserveManualOnRebuild(prev, built);
        built._keystone = Object.assign({}, built._keystone || {}, {preservedOnRebuild: kept, wasRebuild: !!hasExisting});
        return built;
      });
      // v10.46 — auto-run "Complete with AI" on build: research area prices/rents, apply them,
      // optimise the mix. Non-blocking (the deal loads immediately); any failure leaves it as
      // built. Only for a housing scheme that actually has a mix.
      if((deal.assetType === "sfh" || deal.assetType === "land") && deal.sfh && deal.sfh.mix && deal.sfh.mix.length && typeof completeWithAI === "function"){
        setTimeout(function(){ completeWithAI(deal); }, 60);
      }
    }
    // v10.14 — non-blocking confirm (was native confirm(), which froze the browser).
    if(hasExisting) confirmToast("Replace the deal currently open with the one Keystone just built?\n\nYour saved portfolio deals are untouched.", doBuild, {confirmLabel:"Replace deal"});
    else doBuild();
  }

  // ── v10.45 — Complete the deal with AI: research the area's per-type new-build prices & rents,
  // apply them to the mix (replacing the flat default), feed rents into capitalisation, and apply
  // the profit-maximising mix. One click does what used to be manual pricing + optimising. The
  // deal is only changed if the AI returns usable figures; any failure leaves it untouched.
  async function completeWithAI(dealArg){
    var deal = dealArg || data;
    var sfh0 = deal.sfh || {};
    if(!(sfh0.mix && sfh0.mix.length)){ if(!dealArg) notify("Build the deal first, then complete it with AI."); return; }
    setK({ enriching:true, enrichNote:"" });
    var sfhCity = sfh0.city || (deal.land && deal.land.city) || "";
    var pc = (deal.land && deal.land.postcode) || "";
    var typeList = sfh0.mix.filter(function(r){ return num(r.count) > 0; }).map(function(r){ return r.type; })
      .filter(function(v, i, a){ return v && a.indexOf(v) === i; });
    var sys = "You are a UK new-build residential valuer. Output STRICT JSON only — no prose, no markdown fences. Figures are indicative and to be verified.";
    var prompt = "For NEW-BUILD homes in " + ((typeof cityName === "function" ? cityName(sfhCity) : sfhCity) || "the area") + " (" + (pc || "postcode unknown") +
      "), give typical achieved SALE PRICE and MONTHLY RENT for each of these house types: " + typeList.join(", ") +
      ". Reflect the REAL local market — a larger/detached home often sells at a LOWER £/sqft than a smaller semi. " +
      "Output JSON exactly in this shape: {\"types\":[{\"type\":\"<name as given>\",\"beds\":<number>,\"sqft\":<number>,\"salePrice\":<number £>,\"rentPcm\":<number £>}]}. Numbers only — no £ signs or commas.";
    try{
      var res = await callAI(user, "keystone", sys, prompt);
      var a = res.indexOf("{"), b = res.lastIndexOf("}");
      var obj = JSON.parse((a >= 0 && b > a) ? res.substring(a, b + 1) : res);
      var aiTypes = obj.types || obj.prices || [];
      if(!(aiTypes && aiTypes.length)) throw new Error("no per-type figures returned");
      var out = applyMarketPricesAndOptimise(deal, aiTypes, { optimise:true });
      if(!out.applied) throw new Error("none of the AI types matched the mix");
      setData(function(prev){ return Object.assign({}, prev, { sfh: out.data.sfh, capitalise: out.data.capitalise || prev.capitalise }); });
      var note = "Applied real area prices to " + out.applied + " house type" + (out.applied === 1 ? "" : "s") +
        (out.optimised ? (" and optimised the mix (+" + out.optimised.upliftPct + "% for land + profit)") : "") + ". Rents fed into capitalisation. Verify against live listings.";
      setK({ enriching:false, enrichNote:note });
      notify("✓ Completed with AI — " + note);
    }catch(err){
      setK({ enriching:false, enrichNote:"" });
      notify("Couldn't complete with AI (" + ((err && err.message) || err) + "). The deal is unchanged — you can enter per-type prices on the SFH House Mix stage instead.");
    }
  }

  var detected = (function(){ try{ return detectJourney(JSON.parse(k.brief||"{}")); }catch(e2){ return ""; } })();

  // v9.87 — density control: size the scheme to the land before building. Reads acres
  // from the brief, lets you set homes/acre, and writes the resulting unit count straight
  // into the brief so the build (and the whole appraisal) uses it.
  var briefObj = (function(){ try{ return JSON.parse(k.brief||"{}"); }catch(e2){ return null; } })();
  var briefAcres = briefObj ? num(briefObj.acres) : 0;
  var briefDensity = (briefObj && num(briefObj.density||briefObj.homesPerAcre)) || 12;
  briefDensity = Math.max(4, Math.min(40, briefDensity));
  function patchBrief(patch){
    var o; try{ o = JSON.parse(k.brief||"{}"); }catch(e2){ return; }
    Object.assign(o, patch);
    up("keystone","brief", JSON.stringify(o, null, 2));
  }
  function setDensity(d){
    d = Math.max(4, Math.min(40, Math.round(d)));
    patchBrief({ density:d, units: Math.round(briefAcres * d) });
  }
  var densityUnits = Math.round(briefAcres * briefDensity);
  // v10.47 — capacity vs the source's stated figure. Keystone develops from what the source
  // says (statedUnits); this shows the land's fuller capacity at a higher reference density so
  // the headroom is visible before building — the source's number leads, the potential is flagged.
  var refDensity = (typeof KEYSTONE_REF_DENSITY !== "undefined") ? KEYSTONE_REF_DENSITY : 20;
  var statedUnits = briefObj ? num(briefObj.units) : 0;
  var capacityAtRef = briefAcres > 0 ? Math.round(briefAcres * refDensity) : 0;
  var impliedDensity = (briefAcres > 0 && statedUnits > 0) ? (Math.round((statedUnits / briefAcres) * 10) / 10) : 0;
  var capacityBanner = (statedUnits > 0 && capacityAtRef >= statedUnits * 1.2) ? e("div",{style:{marginTop:12,padding:"10px 12px",background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.25)",borderRadius:8,fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
    e("b",null,"Source states room for "+statedUnits.toLocaleString()+" homes"),
    " (~"+impliedDensity+"/acre) — the appraisal develops from this. ",
    e("b",null,"Land capacity: ~"+capacityAtRef.toLocaleString()+" homes at "+refDensity+"/acre"),
    " on "+briefAcres+" acres — potential upside of ~"+(capacityAtRef-statedUnits).toLocaleString()+". Drag the density up to model the fuller scheme.",
    e("button",{onClick:function(){ setDensity(refDensity); },style:{marginLeft:8,padding:"3px 10px",background:"#4A4BAE",color:"#fff",border:"none",borderRadius:5,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Model "+capacityAtRef.toLocaleString()+" at "+refDensity+"/acre")
  ) : null;
  var densityCard = (briefObj && briefAcres > 0) ? e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #4A4BAE"})},
    e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:8}},
      e("div",{style:S.cardTitle},"2b · Scheme density — size it to the land"),
      e("div",{style:{fontSize:12,color:"#7278A0"}}, briefAcres+" acres")
    ),
    e("p",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6,margin:"0 0 12px",maxWidth:640}},
      "Landform is forward-looking: assume the scheme can be consented and set the density you'd expect to achieve. The whole scheme — mix, GDV and residual land value — sizes to this. A draft to refine; typical greenfield is ~10–14 homes/acre gross."),
    e("div",{style:{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}},
      e("input",{type:"range",min:4,max:40,step:1,value:briefDensity,
        onChange:function(ev){ setDensity(num(ev.target.value)); },
        style:{flex:"1 1 220px",accentColor:"#4A4BAE",cursor:"pointer"}}),
      // v10.19 — type-in box so an exact density can be set (not just dragged), plus clear units.
      e("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:3}},
        e("input",{type:"number",min:4,max:40,step:1,value:briefDensity,
          onChange:function(ev){ setDensity(num(ev.target.value)); },
          style:{width:70,padding:"7px 8px",border:"1px solid #C8CDE0",borderRadius:6,fontSize:16,fontWeight:800,textAlign:"center",color:"#2E2F8A",fontFamily:"DM Sans,sans-serif",background:"#fff"}}),
        e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700}},"homes / acre")
      ),
      e("div",{style:{textAlign:"center",minWidth:150}},
        e("div",{style:{fontSize:26,fontWeight:800,color:"#2E2F8A",lineHeight:1}}, densityUnits.toLocaleString()+" homes"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginTop:2}}, e("b",null,briefDensity+" homes/acre"),"  ·  ≈"+Math.round(briefDensity*2.471)+" per hectare (dph)")
      )
    ),
    e("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}},
      [["8","Low / large plots"],["12","Typical estate"],["16","Suburban"],["20","Higher density"]].map(function(p){
        var v = num(p[0]); var on = briefDensity === v;
        return e("button",{key:p[0],onClick:function(){ setDensity(v); },
          style:{padding:"6px 12px",background:on?"#4A4BAE":"#fff",color:on?"#fff":"#3A3D6A",border:"1px solid "+(on?"#4A4BAE":"#DDE0ED"),borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
          p[0]+"/acre · "+p[1]);
      })
    ),
    capacityBanner,
    e("div",{style:{fontSize:10,color:"#9A7B3E",marginTop:10,fontStyle:"italic"}},
      "Sets the unit count in the brief to "+densityUnits.toLocaleString()+". Net developable area is usually less than the gross site — trim the density if there are constraints, buffers or open space.")
  ) : null;

  return e("div", null,
    e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,flexWrap:"wrap",gap:10}},
      e("div",null,
        e("div",{style:{fontSize:11,color:"#7278A0",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:4}},"Keystone · Deal Builder"),
        e("h2",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",margin:"0 0 4px"}},"🪨 Start a deal — drop in your data"),
        e("p",{style:{fontSize:12,color:"#7278A0",lineHeight:1.6,maxWidth:640}},"Paste emails and notes, and upload documents or spreadsheets. Keystone reads them, builds the deal, and chooses the right journey automatically. The AI only extracts the facts — Landform does every calculation, so the numbers stay correct. Review before it builds; you keep full edit rights.")
      )
    ),

    // Reset to raw import (only when this deal was imported from Placona/Keystone)
    rawResetPanel,

    // 1 — Source
    e("div",{style:S.card},
      e("div",{style:S.cardTitle},"1 · Source material"),
      e("div",{style:{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}},
        e("label",{style:{padding:"7px 14px",background:"#4A4BAE",color:"#fff",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
          "📎 Upload documents / spreadsheets",
          e("input",{type:"file",multiple:true,accept:".txt,.md,.csv,.xlsx,.xls,.xlsm,.xlsb,.pdf,.doc,.docx",onChange:handleFiles,style:{display:"none"}})
        ),
        (k.source||"") && e("button",{onClick:function(){setK({source:""});},style:{padding:"7px 14px",background:"#fff",border:"1px solid #DDE0ED",borderRadius:6,fontSize:12,fontWeight:700,color:"#7278A0",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Clear")
      ),
      e("textarea",{value:k.source||"",onChange:function(ev){up("keystone","source",ev.target.value);},
        placeholder:"Paste the email thread, agent particulars, rent schedule, planning notes, land terms — anything. Then press Extract.",
        style:{width:"100%",minHeight:140,padding:"10px 12px",border:"1px solid #DDE0ED",borderRadius:8,fontSize:12,fontFamily:"DM Sans,sans-serif",lineHeight:1.6,resize:"vertical"}}),
      e("div",{style:{fontSize:10,color:"#9A7B3E",marginTop:6,fontStyle:"italic"}},"Spreadsheets and text read fully. PDFs/Word read only where they contain selectable text (scanned/image PDFs won't extract — paste those by hand for now).")
    ),

    // 2 — Extract brief
    e("div",{style:S.card},
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:8}},
        e("div",{style:S.cardTitle},"2 · The brief (review & edit)"),
        e("button",{onClick:extractBrief,disabled:!!k.extracting,style:{padding:"7px 14px",background:k.extracting?"#9AA":"#2D7A65",border:"none",color:"#fff",borderRadius:6,fontSize:12,fontWeight:700,cursor:k.extracting?"wait":"pointer",fontFamily:"DM Sans,sans-serif"}},k.extracting?"⏳ Reading…":"🧠 Extract brief with AI")
      ),
      k.error && e("div",{style:{padding:"8px 12px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.35)",borderRadius:6,fontSize:11,color:"#B05A35",marginBottom:8,lineHeight:1.5}},k.error),
      e("textarea",{value:k.brief||"",onChange:function(ev){up("keystone","brief",ev.target.value);},
        placeholder:'The extracted brief (JSON) appears here for you to check and edit. You can also paste/type one directly, e.g.\n{ "town":"Maldon", "acres":32, "askingPrice":14000000, "affordablePct":50, "houseMix":[ ... ] }',
        style:{width:"100%",minHeight:200,padding:"10px 12px",border:"1px solid #DDE0ED",borderRadius:8,fontSize:12,fontFamily:"DM Mono,monospace",lineHeight:1.5,resize:"vertical"}}),
      detected && e("div",{style:{marginTop:8,fontSize:11,color:"#2D7A65",fontWeight:700}},"→ Keystone will set this up as a "+(journeyLabel[detected]||detected)+" deal (auto-detected). You can change the journey later.")
    ),

    // 2b — Density (only when the brief has an acreage)
    densityCard,

    // 3 — Build
    e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #2D7A65"})},
      e("div",{style:S.cardTitle},"3 · Build the deal"),
      e("div",{style:{fontSize:12,color:"#3A3D6A",lineHeight:1.7,marginBottom:12}},
        "Keystone builds a complete deal from the brief — units, mix, tenures, costs, yield — and loads it so you can run and edit it. It saves nothing automatically; use ",e("strong",null,"💾 Save Current Deal")," (top bar) to put it in your portfolio and share with the team."
      ),
      // v9.75 — origination status, carried from the start
      e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}},
        e("span",{style:{fontSize:11,color:"#7278A0",fontWeight:700}},"This deal is:"),
        e("select",{value:data.dealStatus||"owned",onChange:function(ev){var v=ev.target.value;setData(function(d){return Object.assign({},d,{dealStatus:v});});},
          style:{padding:"6px 10px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:12,fontFamily:"DM Sans,sans-serif",color:"#2E2F8A"}},
          e("option",{value:"owned"},"Ours to develop"),
          e("option",{value:"for_introduction"},"For introduction / sale to another developer"),
          e("option",{value:"prospect"},"Prospect — evaluating only")
        )
      ),
      k.builtJourney && e("div",{style:{padding:"10px 12px",background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.35)",borderRadius:6,fontSize:12,color:"#1d5446",marginBottom:12,lineHeight:1.6}},
        e("strong",null,"✓ Built. "),"Loaded as a "+(journeyLabel[k.builtJourney]||k.builtJourney)+" deal. Open the ",e("strong",null,"Deal Dashboard")," to see the figures, or step through from ",e("strong",null,"Land Appraisal"),"."
      ),
      // v10.38 — rebuild transparency: show which manual downstream inputs were preserved (and
      // note that the scheme itself was re-derived from the brief), so a rebuild is never silently
      // misleading. Only after a rebuild that carried an existing deal.
      (data._keystone && data._keystone.wasRebuild) ? e("div",{style:{padding:"11px 13px",background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.3)",borderRadius:6,fontSize:11,color:"#3A3D6A",marginBottom:12,lineHeight:1.6}},
        e("div",{style:{fontWeight:800,color:"#4A4BAE",marginBottom:3}},"↻ Rebuilt from the brief — your manual work was preserved"),
        (data._keystone.preservedOnRebuild && data._keystone.preservedOnRebuild.length)
          ? e("div",null,"Kept your manual inputs: ",e("strong",null,data._keystone.preservedOnRebuild.join(", ")),". ")
          : e("div",null,"No manual downstream inputs needed preserving. "),
        e("div",{style:{marginTop:4,color:"#7278A0"}},"The scheme itself — unit count, house mix and GDV/RLV — was re-derived from the brief. If you'd hand-tuned individual mix rows (per-type sizes or prices beyond the Base Sale £/sqft), re-check the ",e("strong",null,"SFH House Mix")," stage.")
      ) : null,
      // v9.88 — Assumptions register: every default Keystone applied, so the appraisal is
      // complete on day one and you can see (and then tweak) exactly what it assumed.
      (data._keystone && data._keystone.assumptions && data._keystone.assumptions.length) ? e("div",{style:{border:"1px solid #DDE0ED",borderRadius:8,padding:"12px 14px",marginBottom:12,background:"#FBFBFE"}},
        e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A",marginBottom:2}},"📋 Assumptions applied — the appraisal is complete on these, now tweak"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:8,lineHeight:1.5}},"Every figure below is a best-practice default filled in so you get a result straight away. Change any of them in Land Appraisal, SFH House Mix, Planning or Financials — the whole model re-runs."),
        e("ul",{style:{margin:0,paddingLeft:18}},
          data._keystone.assumptions.map(function(a,i){
            var warn = /not yet in the model|verify|optimistic|underestimate|national average|isn't/i.test(a);
            return e("li",{key:i,style:{fontSize:11,color:warn?"#9A5B2E":"#3A3D6A",lineHeight:1.6,marginBottom:3,fontWeight:warn?700:400}}, a);
          })
        )
      ) : null,
      e("div",{style:{display:"flex",gap:10,flexWrap:"wrap"}},
        e("button",{onClick:buildDeal,disabled:!(k.brief||"").trim(),style:{padding:"9px 18px",background:(k.brief||"").trim()?"#2D7A65":"#9AA",border:"none",color:"#fff",borderRadius:6,fontSize:13,fontWeight:700,cursor:(k.brief||"").trim()?"pointer":"not-allowed",fontFamily:"DM Sans,sans-serif"}},"🏗 Build deal & load it"),
        // v10.45 — one click: research area prices/rents by type, apply them, feed rents into
        // capitalisation, and apply the profit-maximising mix. Replaces manual per-type pricing.
        k.builtJourney && (data.sfh && data.sfh.mix && data.sfh.mix.length) && e("button",{onClick:completeWithAI,disabled:!!k.enriching,
          title:"AI-researches the area's new-build sale prices and rents for each house type, applies them (a 4-bed detached often sells at a lower £/sqft than a 3-bed semi), and applies the profit-maximising mix. Indicative — verify against live listings.",
          style:{padding:"9px 18px",background:k.enriching?"#9AA":"linear-gradient(135deg,#7A5CC0,#4A4BAE)",border:"none",color:"#fff",borderRadius:6,fontSize:13,fontWeight:800,cursor:k.enriching?"wait":"pointer",fontFamily:"DM Sans,sans-serif"}},
          k.enriching?"⏳ Researching prices…":"🤖 Complete with AI — price & optimise the mix"),
        k.builtJourney && e("button",{onClick:function(){navTo("dashboard");},style:{padding:"9px 18px",background:"#fff",border:"1px solid #4A4BAE",color:"#4A4BAE",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Go to Deal Dashboard →"),
        k.builtJourney && e("button",{onClick:function(){navTo("land");},style:{padding:"9px 18px",background:"#fff",border:"1px solid #DDE0ED",color:"#3A3D6A",borderRadius:6,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Open Land Appraisal →")
      ),
      k.enrichNote && e("div",{style:{marginTop:10,padding:"9px 12px",background:"rgba(74,75,174,0.07)",border:"1px solid rgba(74,75,174,0.3)",borderRadius:6,fontSize:11.5,color:"#3A3D6A",lineHeight:1.5}},
        e("strong",{style:{color:"#4A4BAE"}},"🤖 AI complete. "), k.enrichNote)
    )
  );
}
