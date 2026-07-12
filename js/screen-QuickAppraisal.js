// ── renderQuickAppraisal (params: city, data, navTo, setData, up, user) ───────
// The SIMPLE front door. The whole rule-of-thumb land appraisal on ONE interactive page:
//   acreage → density (homes) → auto house mix → area sale £/sqft → GDV
//   → cost stack (build, S106, finance, 17.5% developer profit) → RLV (what it's worth to us)
//   → tested against the landowner's asking price → a plain-English verdict.
// Everything is computed by the SAME engine as the detailed stages (computeSFHMetrics), so it
// can never diverge from SFH House Mix / RLV / Financial Modelling / Board Proposal. Edits here
// flow into the shared deal, so opening a detailed stage later shows the same numbers.
// Loaded before 05-tool.js. Uses globals: e, S, fmt, pct, num, numOr, fmtN, MKT, HOUSE_TYPES,
// computeSFHMetrics, keystoneGenerateMix, keystoneSalePsf, dealCityKey, cityName, Inp.
function renderQuickAppraisal(city, data, navTo, setData, up, user){
  var l = data.land || {}, s = data.sfh || {}, p = data.planning || {};
  var cityKey = (typeof dealCityKey === "function" ? dealCityKey(data) : "") || s.city || l.city || city || "manchester";
  var mkt = (typeof MKT !== "undefined" && (MKT[cityKey] || MKT.manchester)) || { build:205, btr:900, yield:0.05 };
  var acres = num(s.acres) || num(l.acres) || 0;
  var postcode = (l.postcode || "").toUpperCase();

  // Area defaults (editable): a realistic NEW-BUILD sale £/sqft, and a regional build £/sqft.
  var defBasePsf = Math.max(180, Math.min(650, Math.round((typeof keystoneSalePsf === "function" ? keystoneSalePsf(cityKey, postcode) : 0) || (mkt.build ? mkt.build*1.6 : 300))));
  var defBuildPsf = Math.round(num(mkt.build) || 205);
  var effBasePsf = num(s.basePsf) || defBasePsf;
  var effBuildPsf = num(s.buildPsf) || defBuildPsf;
  var ahPct     = numOr(s.ahPct,   num(p.ahPct) || 30);
  var s106pu    = numOr(s.s106pu,  num(p.s106pu) || 15000);
  var finRate   = numOr(s.finRate, 7.5);
  var profitPct = numOr(s.profitPct, 17.5);

  // Homes: current mix count, else a 12-homes/acre draft so the page shows a full appraisal at once.
  var curM = (typeof computeSFHMetrics === "function") ? computeSFHMetrics(data) : { totalUnits:0 };
  var homesNow = num(curM.totalUnits) || 0;
  var effHomes = homesNow > 0 ? homesNow : (acres > 0 ? Math.round(acres * 12) : 0);

  // Reprice a mix to a given sale £/sqft × per-type adjustment (keeps the mix consistent with the
  // Base Sale £/sqft — so this page never shows a GDV built on a stale per-row price).
  function repriceMix(mix, bp){
    return (mix || []).map(function(r){
      var inf = (typeof HOUSE_TYPES !== "undefined" && (HOUSE_TYPES[r.type] || HOUSE_TYPES["3-bed semi"])) || { sqft:900, adj:1 };
      var sq = num(r.sqft) || inf.sqft;
      var psf = Math.round(bp * (inf.adj || 1));
      return Object.assign({}, r, { unitPrice:String(Math.round(sq * psf)), psf:"" });
    });
  }
  var baseMix = (homesNow > 0 && s.mix && s.mix.length)
    ? s.mix
    : (effHomes > 0 && typeof keystoneGenerateMix === "function" ? keystoneGenerateMix(effHomes, cityKey, postcode) : []);
  var effMix = repriceMix(baseMix, effBasePsf);

  // The effective deal the numbers are computed from (persisted values win; defaults fill gaps).
  var effData = Object.assign({}, data, { sfh: Object.assign({}, s, {
    mix: effMix, city: cityKey, acres: acres || "", basePsf: effBasePsf, buildPsf: effBuildPsf,
    ahPct: ahPct, s106pu: s106pu, finRate: finRate, profitPct: profitPct,
    contingency: numOr(s.contingency, 5), feesPct: numOr(s.feesPct, 12), marketingPct: numOr(s.marketingPct, 0)
  }) });
  var M = computeSFHMetrics(effData);
  var homes = num(M.totalUnits) || 0;
  var gdv = num(M.gdv), rlv = num(M.rlv), devCost = num(M.devCost), profitFig = num(M.profit);
  var avgSqft = Math.round(num(M.avgSqft) || 0);
  var hpa = acres > 0 && homes > 0 ? Math.round((homes / acres) * 10) / 10 : 0;
  var dph = acres > 0 && homes > 0 ? Math.round(homes / (acres * 0.404686)) : 0;
  var rlvPerPlot = homes > 0 ? rlv / homes : 0;
  var rlvPerAcre = acres > 0 ? rlv / acres : 0;

  // Land purchase test — asking price + acquisition costs vs the residual land value.
  function landSDLT(pr){ pr = num(pr); if(pr <= 150000) return 0; var t = Math.min(pr-150000,100000)*0.02; if(pr > 250000) t += (pr-250000)*0.05; return t; }
  var asking = num(l.price) || 0;
  var acqCosts = asking > 0 ? (landSDLT(asking) + asking*0.015) : 0;
  var allInLand = asking + acqCosts;
  var profitAllIn = asking > 0 ? (gdv - devCost - allInLand) : profitFig;
  var marginAllIn = gdv > 0 ? (profitAllIn / gdv * 100) : 0;
  var headroom = rlv - allInLand;

  // Verdict — on the margin AFTER buying the land (incl. purchase costs).
  var verdict, vcol, vmsg;
  if(homes <= 0){ verdict = "Enter the land size"; vcol = "#7278A0"; vmsg = "Add the site's acreage below and Quick Appraisal will size a scheme and value it."; }
  else if(rlv <= 0){ verdict = "✗ Doesn't stack"; vcol = "#B05A35"; vmsg = "At these costs and "+(Math.round(profitPct*10)/10)+"% developer profit the residual land value is negative — the scheme can't support any land payment as modelled. Try a higher sale £/sqft, lower build cost, or a lower affordable %."; }
  else if(asking <= 0){ verdict = "◐ Enter the asking price"; vcol = "#4A4BAE"; vmsg = "This land is worth up to "+fmt(rlv)+" to us ("+fmt(rlvPerPlot)+"/plot) at "+(Math.round(profitPct*10)/10)+"% profit. Enter what the landowner wants to see the headroom and margin."; }
  else if(marginAllIn >= 15){ verdict = "✓ Worth pursuing"; vcol = "#1B7A54"; vmsg = "At the "+fmt(asking)+" asking price (plus "+fmt(acqCosts)+" purchase costs) the scheme returns a "+pct(marginAllIn)+" margin. The land is worth up to "+fmt(rlv)+" to us — "+fmt(headroom)+" of headroom."; }
  else if(marginAllIn >= 12){ verdict = "⚠ Marginal — negotiate"; vcol = "#9A7B3E"; vmsg = "At "+fmt(asking)+" the all-in margin is only "+pct(marginAllIn)+". The land is worth up to "+fmt(rlv)+" to us at target profit — aim to buy nearer "+fmt(Math.max(0, rlv-acqCosts))+"."; }
  else { verdict = "✗ Overpriced as asked"; vcol = "#B05A35"; vmsg = "The "+fmt(asking)+" asking (all-in "+fmt(allInLand)+") exceeds the "+fmt(rlv)+" the land is worth to us. Margin is just "+pct(marginAllIn)+". Pursue only near "+fmt(Math.max(0, rlv-acqCosts))+" or below."; }

  // "What makes it stack" — solve the engine for the sale/build £/sqft that reaches a 15% margin.
  var marginNow = gdv > 0 ? ((gdv - devCost - allInLand) / gdv * 100) : 0;
  var stackLine = "";
  if(homes > 0 && gdv > 0 && marginNow < 15){
    var landForSolve = allInLand;
    function marginAt(bp, bd){
      var mm = computeSFHMetrics(Object.assign({}, effData, { sfh: Object.assign({}, effData.sfh, {
        basePsf: bp, buildPsf: bd, mix: repriceMix(effData.sfh.mix, bp)
      }) }));
      var g = num(mm.gdv); return g > 0 ? ((g - num(mm.devCost) - landForSolve) / g * 100) : -999;
    }
    function solve(fn, lo, hi){ var a = fn(lo), b = fn(hi); if((a-15)*(b-15) > 0) return null;
      for(var i=0;i<40;i++){ var m=(lo+hi)/2, v=fn(m); if((v-15)*(a-15) <= 0){ hi=m; b=v; } else { lo=m; a=v; } } return (lo+hi)/2; }
    var saleT = solve(function(x){ return marginAt(Math.round(effBasePsf*x), effBuildPsf); }, 0.6, 2.5);
    var buildT = solve(function(x){ return marginAt(effBasePsf, Math.round(effBuildPsf*x)); }, 0.3, 1.0);
    var parts = [];
    if(saleT) parts.push("sale £"+Math.round(effBasePsf*saleT)+"/sqft");
    if(buildT) parts.push("build £"+Math.round(effBuildPsf*buildT)+"/sqft");
    stackLine = parts.length ? ("To reach a 15% margin (now "+pct(marginNow)+"): "+parts.join(" — or — ")+".") : "";
  }

  // ── Writers — persist to the shared deal (so the detailed stages stay in sync) ──
  function setHomes(n){
    n = Math.max(1, Math.round(num(n))); if(!(n > 0)) return;
    var gen = (typeof keystoneGenerateMix === "function") ? keystoneGenerateMix(n, cityKey, postcode) : [];
    var priced = repriceMix(gen, effBasePsf);
    setData(function(prev){
      return Object.assign({}, prev, {
        sfh: Object.assign({}, prev.sfh || {}, { mix: priced, city: cityKey, acres: (num(prev.sfh && prev.sfh.acres) || num(prev.land && prev.land.acres) || acres || "") }),
        land: Object.assign({}, prev.land || {}, { units: String(n) }),
        planning: Object.assign({}, prev.planning || {}, { units: String(n) })
      });
    });
  }
  function setBasePsf(v){
    setData(function(prev){
      var sp = prev.sfh || {}, bp = num(v);
      var mix = bp > 0 ? repriceMix(sp.mix || [], bp) : (sp.mix || []);
      return Object.assign({}, prev, { sfh: Object.assign({}, sp, { basePsf: v, mix: mix }) });
    });
  }
  function setAcres(v){ up("land", "acres", v); }
  function densityTo(perAcre){ if(acres > 0) setHomes(acres * perAcre); }
  // Generate the one-page A4 board proposal straight from this page's figures. Uses the shared
  // buildLandOnePager (same generator as the Board Proposal stage), fed the EFFECTIVE deal so
  // the PDF matches exactly what's on screen (including the draft mix and area defaults).
  function openOnePager(){
    if(typeof buildLandOnePager !== "function"){ if(typeof notify === "function") notify("One-pager generator still loading — try again in a moment."); return; }
    if(typeof notify === "function") notify("Generating one-page board proposal…");
    var w = window.open("", "_blank");
    if(!w){ if(typeof notify === "function") notify("Allow pop-ups to open the one-page board proposal."); return; }
    w.document.open(); w.document.write(buildLandOnePager(effData, cityKey)); w.document.close();
  }

  var box = { background:"#fff", border:"1px solid #E0E2EC", borderRadius:8, padding:"10px 12px" };
  function kpi(label, value, color){
    return e("div", { key:label, style:{ border:"1px solid #E0E2EC", borderRadius:8, padding:"10px 12px", background:"#FAFBFF" } },
      e("div", { style:{ fontSize:9, letterSpacing:".08em", textTransform:"uppercase", color:"#8A90B4", fontWeight:700 } }, label),
      e("div", { style:{ fontSize:22, fontWeight:800, color:color || "#1B1D46", marginTop:2 } }, value)
    );
  }
  function costRow(label, val){
    return e("div", { key:label, style:{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #F1F2F8", fontSize:12, color:"#7278A0" } },
      e("span", null, label), e("span", null, "(" + fmt(val) + ")"));
  }
  var buildSqft = homes > 0 ? Math.round((num(M.avgSqft) || 0) * homes) : 0;

  return e("div", null,
    e("div", { style:{ marginBottom:16 } },
      e("div", { style:{ fontSize:11, color:"#7278A0", textTransform:"uppercase", letterSpacing:".12em", fontWeight:700, marginBottom:4 } }, "Quick Appraisal"),
      e("h2", { style:{ fontSize:24, fontWeight:800, color:"#2E2F8A", margin:"0 0 4px" } }, "⚡ Is this land worth pursuing?"),
      e("p", { style:{ fontSize:12.5, color:"#7278A0", lineHeight:1.6, maxWidth:720 } },
        "The whole rule-of-thumb on one page: size the land, pick a density, and it builds a house mix, values the homes (GDV), works out what the land is worth to us at ", e("b", null, (Math.round(profitPct*10)/10)+"% developer profit"),
        ", and tests that against the asking price. Same engine as the detailed stages — change anything and every figure updates. For depth, the full stages are still in the menu.")
    ),

    // ── INPUTS ────────────────────────────────────────────────────────────────
    e("div", { style:S.card },
      e("div", { style:S.cardTitle }, "1 · The land & scheme"),
      e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12 } },
        e(Inp, { label:"Site area (acres)", type:"number", value:(s.acres !== undefined && s.acres !== "") ? s.acres : (l.acres || ""), onChange:setAcres, placeholder:"e.g. 40" }),
        e(Inp, { label:"Homes on the land", type:"number", value:String(effHomes || ""), onChange:setHomes, placeholder:acres > 0 ? String(Math.round(acres*12)) : "e.g. 480" }),
        e(Inp, { label:"Sale price £/sqft"+(defBasePsf ? " — "+cityName(cityKey)+" new-build ≈ £"+defBasePsf : ""), type:"number", value:s.basePsf || "", onChange:setBasePsf, placeholder:"£"+defBasePsf }),
        e(Inp, { label:"Build cost £/sqft"+(defBuildPsf ? " — area ≈ £"+defBuildPsf : ""), type:"number", value:s.buildPsf || "", onChange:function(v){ up("sfh","buildPsf",v); }, placeholder:"£"+defBuildPsf }),
        e(Inp, { label:"Affordable housing %", type:"number", value:(s.ahPct !== undefined && s.ahPct !== "") ? s.ahPct : "", onChange:function(v){ up("sfh","ahPct",v); }, placeholder:String(ahPct) }),
        e(Inp, { label:"Developer profit %", type:"number", value:(s.profitPct !== undefined && s.profitPct !== "") ? s.profitPct : "", onChange:function(v){ up("sfh","profitPct",v); }, placeholder:"17.5" }),
        e(Inp, { label:"S106 / CIL per plot (£)", type:"number", value:s.s106pu || "", onChange:function(v){ up("sfh","s106pu",v); }, placeholder:fmtN(s106pu) }),
        e(Inp, { label:"Finance rate %", type:"number", value:s.finRate || "", onChange:function(v){ up("sfh","finRate",v); }, placeholder:"7.5" }),
        e(Inp, { label:"Landowner's asking price (£)", type:"number", value:l.price || "", onChange:function(v){ up("land","price",v); }, placeholder:"e.g. 8000000" })
      ),
      acres > 0 && e("div", { style:{ marginTop:12, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" } },
        e("span", { style:{ fontSize:11, color:"#7278A0", fontWeight:700 } }, "Quick density:"),
        [8,12,16,20].map(function(d){ var on = hpa && Math.round(hpa) === d;
          return e("button", { key:d, onClick:function(){ densityTo(d); },
            style:{ padding:"5px 11px", background:on ? "#4A4BAE" : "#fff", color:on ? "#fff" : "#3A3D6A", border:"1px solid "+(on ? "#4A4BAE" : "#DDE0ED"), borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } },
            d+"/acre = "+(acres > 0 ? Math.round(acres*d).toLocaleString() : "?")+" homes"); }),
        homes > 0 && e("span", { style:{ fontSize:11, color:"#9298BC", marginLeft:4 } }, "Now: "+hpa+" homes/acre · ≈"+dph+" dph · avg home "+avgSqft.toLocaleString()+" sqft")
      )
    ),

    homes > 0 && e("div", null,
      // ── KPI ROW ──────────────────────────────────────────────────────────────
      e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, margin:"4px 0 14px" } },
        kpi("Homes", homes.toLocaleString()),
        kpi("Gross dev value (GDV)", gdv > 0 ? fmt(gdv) : "—"),
        kpi("Worth to us (RLV)", (rlv < 0 ? "−" : "") + fmt(Math.abs(rlv)), rlv > 0 ? "#1B7A54" : "#B05A35"),
        kpi(asking > 0 ? "Asking price" : "Max land @ profit", asking > 0 ? fmt(asking) : fmt(rlv)),
        kpi(asking > 0 ? "Margin (all-in)" : "Developer profit", asking > 0 ? pct(marginAllIn) : (Math.round(profitPct*10)/10)+"%", asking > 0 ? (marginAllIn >= 15 ? "#1B7A54" : marginAllIn >= 12 ? "#9A7B3E" : "#B05A35") : "#1B1D46")
      ),

      // ── APPRAISAL + LAND TEST ────────────────────────────────────────────────
      e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14 } },
        // The appraisal
        e("div", { style:S.card },
          e("div", { style:S.cardTitle }, "2 · The appraisal"),
          e("div", { style:{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:13, fontWeight:700, color:"#2E2F8A", borderBottom:"2px solid #DDE0ED", marginBottom:4 } },
            e("span", null, homes.toLocaleString()+" homes sold"), e("span", null, fmt(gdv))),
          costRow("Build ("+buildSqft.toLocaleString()+" sqft @ £"+effBuildPsf+")", num(M.buildCost)),
          costRow("Professional fees", num(M.fees)),
          costRow("Contingency", num(M.contingency)),
          costRow("Finance", num(M.finance)),
          costRow("S106 / CIL (£"+fmtN(Math.round(s106pu))+"/plot)", num(M.s106)),
          num(M.roads) > 0 && costRow("Roads & sewers", num(M.roads)),
          num(M.infra) > 0 && costRow("Infrastructure & SuDS", num(M.infra)),
          num(M.marketing) > 0 && costRow("Marketing / disposal", num(M.marketing)),
          costRow("Developer profit ("+(Math.round(profitPct*10)/10)+"%)", profitFig),
          e("div", { style:{ display:"flex", justifyContent:"space-between", padding:"8px 0 2px", fontSize:15, fontWeight:800, color:rlv > 0 ? "#1B7A54" : "#B05A35", borderTop:"2px solid #DDE0ED", marginTop:4 } },
            e("span", null, "Residual land value"), e("span", null, (rlv < 0 ? "−" : "") + fmt(Math.abs(rlv)))),
          e("div", { style:{ fontSize:10.5, color:"#9298BC", marginTop:5, lineHeight:1.5 } }, "The most the land is worth to us at "+(Math.round(profitPct*10)/10)+"% profit — "+fmt(rlvPerPlot)+"/plot"+(acres > 0 ? " · "+fmt(rlvPerAcre)+"/acre" : "")+".")
        ),
        // The land test
        e("div", { style:S.card },
          e("div", { style:S.cardTitle }, "3 · Buy it?"),
          asking > 0
            ? e("div", null,
                e("div", { style:{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #F1F2F8", fontSize:12 } }, e("span", { style:{ color:"#7278A0" } }, "Worth to us (RLV)"), e("b", null, fmt(rlv))),
                e("div", { style:{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #F1F2F8", fontSize:12 } }, e("span", { style:{ color:"#7278A0" } }, "Asking price"), e("b", null, fmt(asking))),
                e("div", { style:{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #F1F2F8", fontSize:12 } }, e("span", { style:{ color:"#7278A0" } }, "+ SDLT, legals & acquisition"), e("b", null, fmt(acqCosts))),
                e("div", { style:{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #DDE0ED", fontSize:12.5, fontWeight:700, color:"#2E2F8A" } }, e("span", null, "All-in cost to buy"), e("span", null, fmt(allInLand))),
                e("div", { style:{ display:"flex", justifyContent:"space-between", padding:"7px 0 2px", fontSize:14, fontWeight:800, color:headroom >= 0 ? "#1B7A54" : "#B05A35" } }, e("span", null, "Headroom (RLV − all-in)"), e("span", null, (headroom < 0 ? "−" : "+") + fmt(Math.abs(headroom)))),
                e("div", { style:{ fontSize:11, color:"#7278A0", marginTop:6 } }, "Margin after buying the land: ", e("b", { style:{ color:marginAllIn >= 15 ? "#1B7A54" : marginAllIn >= 12 ? "#9A7B3E" : "#B05A35" } }, pct(marginAllIn)))
              )
            : e("div", { style:{ fontSize:12.5, color:"#7278A0", lineHeight:1.6 } },
                "This land is worth up to ", e("b", { style:{ color:"#1B7A54" } }, fmt(rlv)), " to us (", fmt(rlvPerPlot), "/plot) at ", (Math.round(profitPct*10)/10), "% profit. Enter the landowner's asking price above to test whether it's worth buying and see the margin after purchase costs."),
          stackLine && e("div", { style:{ marginTop:10, padding:"8px 10px", background:"rgba(154,123,62,0.09)", border:"1px solid rgba(154,123,62,0.35)", borderRadius:6, fontSize:11, color:"#7B6432", lineHeight:1.5 } },
            e("b", null, "What makes it stack. "), stackLine)
        )
      ),

      // ── VERDICT ──────────────────────────────────────────────────────────────
      e("div", { style:{ marginTop:14, borderRadius:9, padding:"14px 18px", background:vcol, color:"#fff" } },
        e("div", { style:{ fontSize:16, fontWeight:800 } }, verdict),
        e("div", { style:{ fontSize:12.5, marginTop:3, opacity:0.96, lineHeight:1.5 } }, vmsg)
      ),

      e("div", { style:{ display:"flex", gap:10, flexWrap:"wrap", marginTop:14 } },
        // One-click one-page board proposal — the SAME A4 PDF as the Board Proposal stage,
        // generated straight from this page's figures (buildLandOnePager is shared, so identical).
        e("button", { onClick:openOnePager, style:{ padding:"9px 18px", background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)", border:"none", color:"#fff", borderRadius:6, fontSize:12.5, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif", boxShadow:"0 2px 10px rgba(30,31,92,.25)" } }, "📄 One-page board proposal (PDF)"),
        e("button", { onClick:function(){ navTo("sfh"); }, style:{ padding:"9px 16px", background:"#fff", border:"1px solid #4A4BAE", color:"#4A4BAE", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "Refine the house mix →"),
        e("button", { onClick:function(){ navTo("proposal"); }, style:{ padding:"9px 16px", background:"#fff", border:"1px solid #DDE0ED", color:"#3A3D6A", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "Full board paper →")
      ),

      e("div", { style:{ fontSize:10, color:"#9298BC", marginTop:14, lineHeight:1.5, borderTop:"1px solid #EEF0F7", paddingTop:8 } },
        "Indicative rule-of-thumb — not a RICS Red Book valuation. Assumes residential consent can be achieved. Sale and build £/sqft, S106 and finance are best-practice starting points for the area; verify against local comparables and a QS cost plan before commitment.")
    )
  );
}
