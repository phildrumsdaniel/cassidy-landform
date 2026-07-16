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
  // v10.46 — the new-build SALE premium is visible and tunable. Probe newBuildPsf to recover the
  // area's default premium %, back out the "existing-home" £/sqft, and let the user adjust the
  // premium (it only touches SALE — build cost is the raw construction rate).
  var nbProbe = (typeof newBuildPsf === "function") ? newBuildPsf(postcode || cityKey, 1000) : null;
  var areaPremiumPct = nbProbe ? num(nbProbe.premiumPct) : 17;
  var existingPsf = Math.max(1, Math.round(defBasePsf / (1 + areaPremiumPct/100)));
  var premiumPct = num(s.basePsf) > 0 ? Math.round((num(s.basePsf)/existingPsf - 1)*100)
                 : (s.nbPremiumPct !== undefined && s.nbPremiumPct !== "" ? num(s.nbPremiumPct) : areaPremiumPct);
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
  // v10.123 — if the saved mix already carries per-type prices (from Keystone / the SFH House Mix
  // stage), use it AS-IS so the Quick Appraisal's GDV/RLV reconciles with the detailed stages. It was
  // repriced to a flat base £/sqft every render, which flattened the per-type blended pricing and gave
  // a different (lower) GDV — the root of the two-RLV split (£731m vs £757m). Only a fresh DRAFT mix
  // (no per-type prices) is priced at the base £/sqft; the base-£/sqft field still reprices via its handler.
  var mixHasBespokePrices = homesNow > 0 && s.mix && s.mix.length && s.mix.some(function(r){ return num(r.count) > 0 && num(r.unitPrice || r.salePrice) > 0; });
  var effMix = mixHasBespokePrices ? baseMix : repriceMix(baseMix, effBasePsf);

  // v10.42 — treat the build £/sqft as ALL-IN by default: it already includes roads, drainage
  // and site infrastructure (SuDS), so those are NOT added as separate lines and double-counted.
  // (Marketing/disposal is a sale-side cost and is left at £0 here too.) Toggle it off for a deal
  // whose build rate is construction-only, with externals priced separately. Persisted to the
  // deal so the detailed stages read the same assumption — nothing diverges.
  var buildInclusive = s.buildInclusive !== false;   // default ON (undefined ⇒ inclusive)

  // The effective deal the numbers are computed from (persisted values win; defaults fill gaps).
  var effData = Object.assign({}, data, { sfh: Object.assign({}, s, {
    mix: effMix, city: cityKey, acres: acres || "", basePsf: effBasePsf, buildPsf: effBuildPsf,
    ahPct: ahPct, s106pu: s106pu, finRate: finRate, profitPct: profitPct, buildInclusive: buildInclusive,
    contingency: numOr(s.contingency, 5), feesPct: numOr(s.feesPct, 12), marketingPct: numOr(s.marketingPct, 0)
  }) });
  var M = computeSFHMetrics(effData);
  var homes = num(M.totalUnits) || 0;
  var gdv = num(M.gdv), rlv = num(M.rlv), devCost = num(M.devCost), profitFig = num(M.profit);
  // v10.123 — the chosen exit (Exit Strategy stage) drives the headline, off the SAME effData the whole
  // page uses, so the headline "Worth to us" follows the committed exit and equals the Exit-routes card.
  var QEX = (typeof dealExit === "function") ? dealExit(effData) : { chosen:false, basis:"plot", basisLabel:"open-market plot sales", plotRlv:rlv, chosenRlv:rlv };
  var headlineRlv = num(QEX.chosenRlv);
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
      var pin = (prev.sfh && prev.sfh.buildInclusive !== undefined) ? prev.sfh.buildInclusive : true;   // lock in the inclusive default
      return Object.assign({}, prev, {
        sfh: Object.assign({}, prev.sfh || {}, { mix: priced, city: cityKey, buildInclusive: pin, acres: (num(prev.sfh && prev.sfh.acres) || num(prev.land && prev.land.acres) || acres || "") }),
        land: Object.assign({}, prev.land || {}, { units: String(n) }),
        planning: Object.assign({}, prev.planning || {}, { units: String(n) })
      });
    });
  }
  function setBasePsf(v){
    setData(function(prev){
      var sp = prev.sfh || {}, bp = num(v);
      var mix = bp > 0 ? repriceMix(sp.mix || [], bp) : (sp.mix || []);
      // v10.60 — keep the shared sale-£/sqft sibling (rlv.salePsf) in step so the figure
      // replicates to every page, the same way build £/sqft does via up().
      return Object.assign({}, prev, { sfh: Object.assign({}, sp, { basePsf: v, mix: mix }), rlv: Object.assign({}, prev.rlv || {}, { salePsf: v }) });
    });
  }
  // Tuning the new-build premium sets the sale £/sqft = existing-home £/sqft × (1 + premium),
  // and reprices the mix. Build cost is untouched (it's the raw construction rate).
  function setPremium(v){
    var nb = Math.round(existingPsf * (1 + num(v)/100));
    setData(function(prev){
      var sp = prev.sfh || {};
      var mix = nb > 0 ? repriceMix(sp.mix || [], nb) : (sp.mix || []);
      return Object.assign({}, prev, { sfh: Object.assign({}, sp, { nbPremiumPct: v, basePsf: String(nb), mix: mix }), rlv: Object.assign({}, prev.rlv || {}, { salePsf: String(nb) }) });
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
    var html = buildLandOnePager(effData, cityKey);
    // v10.52 — show in-app (overlay) so you stay in Landform and can close/regenerate.
    if(typeof showReportOverlay === "function" && showReportOverlay(html, "One-page board proposal")) return;
    if(typeof openReportBlob==="function" && openReportBlob(html)) return;
    var w = window.open("", "_blank");
    if(!w){ if(typeof notify === "function") notify("Allow pop-ups to open the one-page board proposal."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  var box = { background:"#fff", border:"1px solid #E0E2EC", borderRadius:8, padding:"10px 12px" };
  function kpi(label, value, color, note){
    return e("div", { key:label, style:{ border:"1px solid #E0E2EC", borderRadius:8, padding:"10px 12px", background:"#FAFBFF" } },
      e("div", { style:{ fontSize:9, letterSpacing:".08em", textTransform:"uppercase", color:"#8A90B4", fontWeight:700 } }, label),
      e("div", { style:{ fontSize:22, fontWeight:800, color:color || "#1B1D46", marginTop:2 } }, value),
      note ? e("div", { style:{ fontSize:9.5, color:"#9298BC", marginTop:3, lineHeight:1.35 } }, note) : null
    );
  }
  function costRow(label, val){
    return e("div", { key:label, style:{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #F1F2F8", fontSize:12, color:"#7278A0" } },
      e("span", null, label), e("span", null, "(" + fmt(val) + ")"));
  }
  var buildSqft = homes > 0 ? Math.round((num(M.avgSqft) || 0) * homes) : 0;

  // ── v10.49 — FORWARD-FUND / CAPITALISATION EXIT ────────────────────────────
  // What an institution (e.g. a pension fund) would pay for the WHOLE rented scheme at a net
  // initial yield, and the profit that throws off. A keener (lower) yield ⇒ the fund pays more
  // ⇒ more profit, so a 3.8% exit is worth far more than a 6% one. The user picks the yield
  // across the 3.8%–6% range; the table shows the spread. Rent is derived by the engine from the
  // scheme's own market values (computeSFHMetrics: capNetRentPa), so it can't diverge.
  var capNetRentPa = num(M.capNetRentPa);
  var capMktRentPerUnitPa = num(M.capMarketRentPerUnitPa);
  var capD = data.capitalise || {};
  var capYieldPct = num(capD.targetYield); if(capYieldPct > 0 && capYieldPct < 1) capYieldPct *= 100;
  if(!(capYieldPct > 0)) capYieldPct = 4.75;
  capYieldPct = Math.max(3.5, Math.min(7, capYieldPct));   // v10.114 — respect the yield set on the Capitalisation page (no 4.5% floor); sanity-clamp only
  function capIV(y){ return y > 0 ? capNetRentPa / (y/100) : 0; }                        // investment value the fund pays
  function capProfitAllIn(y){ return capIV(y) - devCost - allInLand; }                   // actual profit given the land cost
  function capMaxLand(y){ var iv = capIV(y); return iv - devCost - iv*(profitPct/100); } // max land at target profit
  function capMarginAllIn(y){ var iv = capIV(y); return iv > 0 ? (capProfitAllIn(y)/iv*100) : 0; }
  function setCapYield(v){ up("capitalise","targetYield", v); }
  var capYieldRow = [capYieldPct, capYieldPct+0.5, capYieldPct+1.0, capYieldPct+1.5].map(function(x){return Math.round(x*100)/100;});
  var capIVsel = capIV(capYieldPct);

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
        e(Inp, { label:"Sale price £/sqft — £"+existingPsf+" local + "+premiumPct+"% new-build", type:"number", value:s.basePsf || "", onChange:setBasePsf, placeholder:"£"+effBasePsf }),
        e(Inp, { label:"New-build premium % (sale only)", type:"number", value:(s.nbPremiumPct !== undefined && s.nbPremiumPct !== "") ? s.nbPremiumPct : "", onChange:setPremium, placeholder:String(premiumPct) }),
        e(Inp, { label:"Build cost £/sqft — construction cost, no premium", type:"number", value:s.buildPsf || "", onChange:function(v){ up("sfh","buildPsf",v); }, placeholder:"£"+defBuildPsf }),
        e(Inp, { label:"Affordable housing %", type:"number", value:(s.ahPct !== undefined && s.ahPct !== "") ? s.ahPct : "", onChange:function(v){ up("sfh","ahPct",v); }, placeholder:String(ahPct) }),
        e(Inp, { label:"Developer profit %", type:"number", value:(s.profitPct !== undefined && s.profitPct !== "") ? s.profitPct : "", onChange:function(v){ up("sfh","profitPct",v); }, placeholder:"17.5" }),
        e(Inp, { label:"S106 / CIL per plot (£)", type:"number", value:s.s106pu || "", onChange:function(v){ up("sfh","s106pu",v); }, placeholder:fmtN(s106pu) }),
        e(Inp, { label:"Finance rate %", type:"number", value:s.finRate || "", onChange:function(v){ up("sfh","finRate",v); }, placeholder:"7.5" }),
        e(Inp, { label:"Programme (years) — build & sell", type:"number", value:s.programmeYears || "", onChange:function(v){ up("sfh","programmeYears",v); }, placeholder:String(num(M.financeProgYears)||"") }),
        e(Inp, { label:"Peak debt (% of build) — lower = faster sales/more phases", type:"number", value:s.peakDebtPct || "", onChange:function(v){ up("sfh","peakDebtPct",v); }, placeholder:String(num(M.financePeakDebtPct)||"") }),
        e(Inp, { label:"Landowner's asking price (£)", type:"number", value:l.price || "", onChange:function(v){ up("land","price",v); }, placeholder:"e.g. 8000000" })
      ),
      acres > 0 && e("div", { style:{ marginTop:12, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" } },
        e("span", { style:{ fontSize:11, color:"#7278A0", fontWeight:700 } }, "Quick density:"),
        [8,12,16,20].map(function(d){ var on = hpa && Math.round(hpa) === d;
          return e("button", { key:d, onClick:function(){ densityTo(d); },
            style:{ padding:"5px 11px", background:on ? "#4A4BAE" : "#fff", color:on ? "#fff" : "#3A3D6A", border:"1px solid "+(on ? "#4A4BAE" : "#DDE0ED"), borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } },
            d+"/acre = "+(acres > 0 ? Math.round(acres*d).toLocaleString() : "?")+" homes"); }),
        homes > 0 && e("span", { style:{ fontSize:11, color:"#9298BC", marginLeft:4 } }, "Now: "+hpa+" homes/acre · ≈"+dph+" dph · avg home "+avgSqft.toLocaleString()+" sqft")
      ),
      // Build-inclusive toggle — avoids double-counting roads/drainage/site infra when the build
      // £/sqft is already all-in (Cassidy's usual basis). Persisted so every stage agrees.
      e("div", { style:{ marginTop:12, padding:"9px 11px", background:buildInclusive?"rgba(45,122,101,0.06)":"rgba(154,123,62,0.06)", border:"1px solid "+(buildInclusive?"rgba(45,122,101,0.3)":"rgba(154,123,62,0.35)"), borderRadius:6, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" } },
        e("label", { style:{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:12, color:"#3A3D6A", fontWeight:600 } },
          e("input", { type:"checkbox", checked:buildInclusive, onChange:function(ev){ up("sfh","buildInclusive", ev.target.checked); }, style:{ width:16, height:16, cursor:"pointer", accentColor:"#2D7A65" } }),
          "🧱 Build £/sqft is all-in — includes professional fees, contingency, roads, drainage & SuDS"),
        e("span", { style:{ flex:1, minWidth:200, fontSize:10.5, color:buildInclusive?"#2D7A65":"#9A7B3E", lineHeight:1.5 } },
          buildInclusive ? "On — professional fees, contingency, roads, site infrastructure & SuDS are all inside your build rate, so they're not added again (finance is charged on the build cost). Marketing/disposal is a separate sale cost, left at £0."
                         : "Off — professional fees (12%), contingency (5%), roads (£12k/plot) and site infrastructure/SuDS (£53k/acre) are added as separate cost lines on top of the build rate.")
      )
    ),

    homes > 0 && e("div", null,
      // ── KPI ROW ──────────────────────────────────────────────────────────────
      e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, margin:"4px 0 14px" } },
        kpi("Homes", homes.toLocaleString()),
        kpi("Gross dev value (GDV)", gdv > 0 ? fmt(gdv) : "—"),
        // v10.125 — until an exit is committed, show the RANGE across the viable exit routes
        // (a spread of possibilities), not a single figure that reads like a decision.
        (QEX.chosen
          ? kpi("Worth to us (RLV) · "+QEX.basisLabel, (headlineRlv < 0 ? "−" : "") + fmt(Math.abs(headlineRlv)), headlineRlv > 0 ? "#1B7A54" : "#B05A35")
          : kpi("Worth to us (RLV) · exit not yet decided", (QEX.rangeIsSpan ? fmt(QEX.rangeLo)+" – "+fmt(QEX.rangeHi) : fmt(QEX.rangeHi)), QEX.rangeHi > 0 ? "#1B7A54" : "#B05A35", "range across exit routes — see below")),
        kpi(asking > 0 ? "Asking price" : "Max land @ profit", asking > 0 ? fmt(asking) : ((rlv < 0 ? "−" : "") + fmt(Math.abs(rlv))), asking > 0 ? "#1B1D46" : (rlv >= 0 ? "#1B1D46" : "#B05A35")),
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
          num(M.fees) > 0 && costRow("Professional fees", num(M.fees)),
          num(M.contingency) > 0 && costRow("Contingency", num(M.contingency)),
          costRow("Finance ("+(num(M.financeProgYears)||"?")+"yr · peak "+(num(M.financePeakDebtPct)||"?")+"% · "+finRate+"% pa, S-curve)", num(M.finance)),
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

      // ── PROFIT SENSITIVITY ─────────────────────────────────────────────────────
      // Residual land value at a range of developer profit targets — house-builders often want
      // 20%+ on GDV (or profit-on-cost), so show the swing rather than a single 17.5% figure.
      gdv > 0 && homes > 0 && (function(){
        var profitRow = [17.5, 20, 25, 30];
        function rlvAtProfit(p){ return (gdv - devCost) - gdv*(p/100); }
        return e("div", { style:Object.assign({}, S.card, { borderLeft:"4px solid #4A4BAE", marginTop:14 }) },
          e("div", { style:S.cardTitle }, "Target profit → what you can pay for the land"),
          e("div", { style:{ fontSize:11, color:"#7278A0", lineHeight:1.5, marginBottom:10 } },
            "Pick a developer profit target and read the land price per plot. ", e("b", null, "The more profit you target, the LESS you can pay for the land"), " (higher profit is taken out of the same GDV, leaving less for land). 17.5% of GDV is the planning-viability benchmark; volume house-builders often target 20%+ (a ‘30% margin’ is usually profit-on-cost, ≈ 22–23% on GDV)."),
          // v10.67 — editable target profit that DRIVES the deal (writes sfh.profitPct, the same
          // field as the ‘Developer profit %’ input above), so setting 25% flows through the whole
          // appraisal, the RLV and the one-pager. Was a non-committing what-if — that confused
          // (change it → nothing else moved). Type the target and everything reflects it.
          (function(){
            var v = rlvAtProfit(profitPct), pp = v / homes;
            return e("div", { style:{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:12, padding:"11px 13px", background:"rgba(74,75,174,0.06)", border:"1px solid rgba(74,75,174,0.3)", borderRadius:8 } },
              e("div", { style:{ display:"flex", flexDirection:"column", gap:3 } },
                e("label", { style:{ fontSize:10, color:"#3A3D6A", textTransform:"uppercase", letterSpacing:".05em", fontWeight:700 } }, "Your target profit % — drives the whole appraisal"),
                e("input", { type:"number", step:"0.5", value:(s.profitPct !== undefined && s.profitPct !== "") ? s.profitPct : "", placeholder:"17.5",
                  onChange:function(ev){ up("sfh","profitPct", ev.target.value); },
                  style:{ width:110, padding:"8px 10px", border:"1px solid #4A4BAE", borderRadius:6, fontSize:16, fontWeight:800, color:"#2E2F8A", fontFamily:"DM Sans,sans-serif", background:"#fff" } })),
              e("div", { style:{ fontSize:26, fontWeight:800, color:pp >= 0 ? "#1B7A54" : "#B05A35" } }, (pp < 0 ? "−£" : "£") + Math.abs(Math.round(pp/1000)).toLocaleString() + "k/plot"),
              e("div", { style:{ fontSize:11, color:"#7278A0", lineHeight:1.5 } }, "at ", e("b", null, (Math.round(profitPct*10)/10)+"% profit"), " · land worth ", e("b", { style:{ color:pp>=0?"#1B7A54":"#B05A35" } }, (v<0?"−":"")+fmt(Math.abs(v))), acres > 0 ? " · "+fmt(v/acres)+"/acre" : "", ". Changing it updates every figure and the one-pager."));
          })(),
          e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10 } },
            profitRow.map(function(p){
              var v = rlvAtProfit(p), pp = v / homes, on = Math.abs(p - profitPct) < 0.25;
              return e("div", { key:p, style:{ border:"1px solid "+(on?"#4A4BAE":"#E0E2EC"), background:on?"rgba(74,75,174,0.06)":"#FAFBFF", borderRadius:8, padding:"9px 11px" } },
                e("div", { style:{ fontSize:10, color:"#8A90B4", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em" } }, p+"% profit"+(on?" · current":"")),
                e("div", { style:{ fontSize:19, fontWeight:800, marginTop:3, color:pp >= 0 ? "#1B7A54" : "#B05A35" } }, (pp < 0 ? "−£" : "£") + Math.abs(Math.round(pp/1000)).toLocaleString() + "k/plot"),
                e("div", { style:{ fontSize:10.5, color:"#7278A0", marginTop:1 } }, "total " + (v < 0 ? "−" : "") + fmt(Math.abs(v)) + (acres > 0 ? " · " + fmt(v/acres) + "/acre" : "")));
            }))
        );
      })(),

      // ── VERDICT ──────────────────────────────────────────────────────────────
      e("div", { style:{ marginTop:14, borderRadius:9, padding:"14px 18px", background:vcol, color:"#fff" } },
        e("div", { style:{ fontSize:16, fontWeight:800 } }, verdict),
        e("div", { style:{ fontSize:12.5, marginTop:3, opacity:0.96, lineHeight:1.5 } }, vmsg)
      ),

      // ── EXIT ROUTES — land value by exit (v10.114) ────────────────────────────
      (function(){
        var EX = QEX;   // v10.123 — same effData-based exit calc as the headline, so they never diverge
        if(!EX) return null;
        var pv = num(EX.plotRlv), hv = num(EX.haBulkRlv), cv = num(EX.capRlv);
        if(!(pv > 0 || hv > 0 || cv > 0)) return null;
        function card(active, label, val, note){
          return e("div", { style:{ flex:"1 1 150px", border:"1.5px solid "+(active ? "#1B7A54" : "#E0E2EC"), borderRadius:8, padding:"9px 11px", background: active ? "#F1FBF6" : "#fff" } },
            e("div", { style:{ fontSize:9.5, letterSpacing:".04em", textTransform:"uppercase", color: active ? "#1B7A54" : "#8A90B4", fontWeight:800, lineHeight:1.3 } }, (active ? "✓ Chosen — " : "") + label),
            e("div", { style:{ fontSize:18, fontWeight:800, color: val >= 0 ? "#1B1D46" : "#B05A35", marginTop:2 } }, (val < 0 ? "−" : "") + fmt(Math.abs(val))),
            e("div", { style:{ fontSize:9.5, color:"#9298BC", marginTop:1, lineHeight:1.3 } }, note));
        }
        return e("div", { style:Object.assign({}, S.card, { borderLeft:"4px solid #4A4BAE", marginTop:14 }) },
          e("div", { style:S.cardTitle }, "Exit routes — land value by exit"),
          e("div", { style:{ fontSize:11, color:"#7278A0", marginBottom:10, lineHeight:1.5 } }, EX.chosen ? e("span", null, "Headline leads with your chosen route (", e("b", null, EX.basisLabel), "). Change it on the Exit Strategy stage.") : "Every exit, side by side. No exit committed yet, so the headline shows the RANGE across these routes — commit to one on the Exit Strategy stage and the headline + reports lead with it."),
          e("div", { style:{ display:"flex", gap:9, flexWrap:"wrap" } },
            card(EX.basis === "plot", "Open-market plot sales", pv, "Sold to buyers — highest"),
            card(EX.basis === "ha_bulk", "Bulk sale to a HA / fund", hv, "~"+Math.round(num(EX.bulkDiscPct))+"% bulk discount + grant"),
            card(EX.basis === "capitalised", "Forward-fund (rented)", cv, "Rent ÷ yield — suits flats / BTR")));
      })(),

      // ── FORWARD-FUND / CAPITALISATION EXIT ────────────────────────────────────
      capNetRentPa > 0 && e("div", { style:Object.assign({}, S.card, { borderLeft:"4px solid #2D7A65", marginTop:14 }) },
        e("div", { style:S.cardTitle }, "4 · Forward-fund exit — the whole scheme sold to a pension fund"),
        e("p", { style:{ fontSize:11.5, color:"#7278A0", lineHeight:1.6, margin:"0 0 12px", maxWidth:700 } },
          "Instead of selling homes one by one, the finished scheme is let and the whole rented investment is bought by an institution at a ", e("b", null, "net initial yield"),
          ". A keener (lower) yield means the fund pays more — a 4.5% exit is worth far more than a 6% one. Uses the yield set on the Capitalisation page. Net rent ≈ ", e("b", null, fmt(capNetRentPa)+" p.a."),
          " (", fmt(capMktRentPerUnitPa), "/home gross, after 25% management)."),
        // yield control (3.5%–7%, matching the deal's set yield)
        e("div", { style:{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:12 } },
          e("input", { type:"range", min:3.5, max:7, step:0.05, value:capYieldPct, onChange:function(ev){ setCapYield(num(ev.target.value)); }, style:{ flex:"1 1 240px", accentColor:"#2D7A65", cursor:"pointer" } }),
          e("div", { style:{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 } },
            e("input", { type:"number", min:3.5, max:7, step:0.05, value:capYieldPct, onChange:function(ev){ setCapYield(num(ev.target.value)); },
              style:{ width:76, padding:"7px 8px", border:"1px solid #C8CDE0", borderRadius:6, fontSize:16, fontWeight:800, textAlign:"center", color:"#1B7A54", fontFamily:"DM Sans,sans-serif", background:"#fff" } }),
            e("div", { style:{ fontSize:9, color:"#7278A0", textTransform:"uppercase", letterSpacing:".06em", fontWeight:700 } }, "net yield %"))
        ),
        // headline KPIs at the selected yield
        e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10, marginBottom:12 } },
          kpi("Fund pays (investment value)", fmt(capIVsel), "#1B7A54"),
          asking > 0 ? kpi("Profit (forward-fund, all-in)", (capProfitAllIn(capYieldPct) < 0 ? "−" : "") + fmt(Math.abs(capProfitAllIn(capYieldPct))), capProfitAllIn(capYieldPct) >= 0 ? "#1B7A54" : "#B05A35")
                     : (function(){
                         var ml=capMaxLand(capYieldPct), buildStronger=rlv>ml;   // build-to-sell supports more land than the rental exit
                         return kpi(
                           buildStronger ? "Land — rental exit only" : "Max land @ "+(Math.round(profitPct*10)/10)+"% profit",
                           (ml<0?"−":"")+fmt(Math.abs(ml)),
                           buildStronger ? "#B0B4CC" : (ml>=0?"#1B7A54":"#B05A35"),
                           buildStronger ? "⚠ Not what to pay for houses — this is the rented exit. Pay off build-to-sell: "+(rlv<0?"−":"")+fmt(Math.abs(rlv)) : null
                         );
                       })(),
          asking > 0 ? kpi("Margin (all-in)", pct(capMarginAllIn(capYieldPct)), capMarginAllIn(capYieldPct) >= 15 ? "#1B7A54" : capMarginAllIn(capYieldPct) >= 12 ? "#9A7B3E" : "#B05A35")
                     : kpi("Developer profit @ target", fmt(capIVsel*(profitPct/100)), "#1B1D46")
        ),
        // sensitivity table across the 3.8%–6% range
        e("div", { style:{ overflowX:"auto" } },
          e("table", { style:{ width:"100%", borderCollapse:"collapse", fontSize:11.5 } },
            e("thead", null, e("tr", { style:{ color:"#8A90B4" } },
              e("th", { style:{ textAlign:"left", padding:"4px 6px", fontWeight:700 } }, "Net yield"),
              e("th", { style:{ textAlign:"right", padding:"4px 6px", fontWeight:700 } }, "Fund pays"),
              e("th", { style:{ textAlign:"right", padding:"4px 6px", fontWeight:700 } }, asking > 0 ? "Profit (all-in)" : "Max land value"),
              e("th", { style:{ textAlign:"right", padding:"4px 6px", fontWeight:700 } }, asking > 0 ? "Margin" : "Profit @ target"))),
            e("tbody", null, capYieldRow.map(function(y){
              var sel = Math.abs(y - capYieldPct) < 0.05, prof = capProfitAllIn(y), marg = capMarginAllIn(y);
              return e("tr", { key:y, style:{ borderTop:"1px solid #F1F2F8", background:sel ? "rgba(45,122,101,0.08)" : "transparent", fontWeight:sel ? 800 : 500, color:"#3A3D6A" } },
                e("td", { style:{ textAlign:"left", padding:"5px 6px" } }, y.toFixed(2)+"%"),
                e("td", { style:{ textAlign:"right", padding:"5px 6px" } }, fmt(capIV(y))),
                e("td", { style:{ textAlign:"right", padding:"5px 6px", color: asking > 0 ? (prof >= 0 ? "#1B7A54" : "#B05A35") : (capMaxLand(y) >= 0 ? "#1B7A54" : "#B05A35") } }, asking > 0 ? ((prof < 0 ? "−" : "") + fmt(Math.abs(prof))) : ((capMaxLand(y) < 0 ? "−" : "") + fmt(Math.abs(capMaxLand(y))))),
                e("td", { style:{ textAlign:"right", padding:"5px 6px", color: asking > 0 ? (marg >= 15 ? "#1B7A54" : marg >= 12 ? "#9A7B3E" : "#B05A35") : "#3A3D6A" } }, asking > 0 ? pct(marg) : fmt(capIV(y)*(profitPct/100))));
            })))
        ),
        // compare exits
        e("div", { style:{ fontSize:11, color:"#7278A0", marginTop:10, lineHeight:1.5, borderTop:"1px solid #EEF0F7", paddingTop:8 } },
          asking > 0
            ? e("span", null, "Compare exits at ", e("b", null, capYieldPct.toFixed(2)+"%"), ": forward-fund profit ", e("b", { style:{ color: capProfitAllIn(capYieldPct) >= 0 ? "#1B7A54" : "#B05A35" } }, fmt(capProfitAllIn(capYieldPct))), " (", pct(capMarginAllIn(capYieldPct)), ") vs build-to-sell ", e("b", null, fmt(profitAllIn)), " (", pct(marginAllIn), "). ", capIVsel > gdv ? "The forward-fund exit is worth more here." : "Build-to-sell is worth more here.")
            : e("span", null, "At ", e("b", null, capYieldPct.toFixed(2)+"%"), " the rented scheme is worth ", e("b", { style:{ color:"#1B7A54" } }, fmt(capIVsel)), " to an institution vs ", fmt(gdv), " selling home-by-home. So this exit supports ", e("b", { style:{ color: capMaxLand(capYieldPct) >= 0 ? "#1B7A54" : "#B05A35" } }, (capMaxLand(capYieldPct) < 0 ? "−" : "") + fmt(Math.abs(capMaxLand(capYieldPct)))), " of land, vs ", e("b", { style:{ color: rlv >= 0 ? "#1B7A54" : "#B05A35" } }, (rlv < 0 ? "−" : "") + fmt(Math.abs(rlv))), " on the build-to-sell appraisal above. ", e("b", null, rlv > capMaxLand(capYieldPct) ? "Build-to-sell is the stronger exit here" : "Forward-funding is the stronger exit here"), rlv > capMaxLand(capYieldPct) ? " — forward-funding suits rental blocks (flats/BTR) more than houses built for sale." : ".")
        )
      ),

      e("div", { style:{ display:"flex", gap:10, flexWrap:"wrap", marginTop:14 } },
        // One-click one-page board proposal — the SAME A4 PDF as the Board Proposal stage,
        // generated straight from this page's figures (buildLandOnePager is shared, so identical).
        e("button", { onClick:openOnePager, style:{ padding:"9px 18px", background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)", border:"none", color:"#fff", borderRadius:6, fontSize:12.5, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif", boxShadow:"0 2px 10px rgba(30,31,92,.25)" } }, "📄 One-page board proposal (PDF)"),
        e("button", { onClick:function(){ navTo("sfh"); }, style:{ padding:"9px 16px", background:"#fff", border:"1px solid #4A4BAE", color:"#4A4BAE", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "Refine the house mix →"),
        e("button", { onClick:function(){ navTo("proposal"); }, style:{ padding:"9px 16px", background:"#fff", border:"1px solid #DDE0ED", color:"#3A3D6A", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "Full board paper →")
      ),

      // ── VERIFY BEFORE COMMITTING — ground the key assumptions ───────────────────
      (function(){
        var town = (typeof cityName === "function" ? cityName(cityKey) : cityKey) || "the area";
        var g = function(q){ return "https://www.google.com/search?q=" + encodeURIComponent(q); };
        var salesLinks = [
          ["🏠 New-build prices — " + town, g("new build homes for sale " + town + " " + (postcode||"")), "#2D7A65"],
          ["Persimmon / Barratt / Redrow — " + town, g("Persimmon OR Barratt OR Redrow new homes " + town), "#4A4BAE"],
          ["Land Registry sold prices", "https://www.gov.uk/search-house-prices"],
          ["Local registered providers (affordable buyer)", g("largest housing associations " + town + " Kent registered provider")]
        ];
        var ahHomes = Math.round(homes * (ahPct/100));
        return e("div", { style:Object.assign({}, S.card, { borderLeft:"4px solid #9A7B3E", marginTop:14 }) },
          e("div", { style:S.cardTitle }, "Verify before committing"),
          e("div", { style:{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 } },
            salesLinks.map(function(lk){
              return e("a", { key:lk[0], href:lk[1], target:"_blank", rel:"noopener",
                style:{ padding:"7px 12px", background:"#fff", border:"1px solid "+(lk[2]||"#DDE0ED"), borderRadius:6, fontSize:11, fontWeight:700, color:lk[2]||"#3A3D6A", textDecoration:"none" } }, lk[0]+" ↗");
            })),
          // v10.81 — punch the verified figures straight in here: the same handlers as the main
          // inputs (setBasePsf reprices the mix + keeps rlv.salePsf in step; build/S106 propagate
          // via the shared-field groups), so the whole appraisal recomputes instantly.
          (function(){
            var miniLbl = { fontSize:9, color:"#8A6A2E", textTransform:"uppercase", letterSpacing:".05em", fontWeight:700, marginBottom:3, display:"block" };
            var miniIpt = { width:"100%", padding:"7px 9px", border:"1px solid #E0D3B0", borderRadius:5, fontSize:12, fontFamily:"DM Sans,sans-serif", color:"#2E2F8A", background:"#fff" };
            function field(lbl, val, ph, onCh){
              return e("div", { key:lbl, style:{ flex:"1 1 120px", minWidth:108 } },
                e("label", { style:miniLbl }, lbl),
                e("input", { type:"number", value:val, placeholder:ph,
                  onChange:function(ev){ onCh(ev.target.value); },
                  onFocus:function(ev){ try{ ev.target.select(); }catch(x){} }, style:miniIpt }));
            }
            return e("div", { style:{ background:"#FBFAF5", border:"1px solid #E6D9B8", borderRadius:6, padding:"10px 12px", marginBottom:10 } },
              e("div", { style:{ fontSize:10.5, fontWeight:700, color:"#7A5A2E", marginBottom:8, lineHeight:1.5 } }, "✎ Found the real figures? Enter them here — GDV, residual land value and profit update instantly across every stage and report."),
              e("div", { style:{ display:"flex", gap:10, flexWrap:"wrap" } },
                field("Sale £/sqft", s.basePsf || "", "£"+effBasePsf, setBasePsf),
                field("Build £/sqft", s.buildPsf || "", "£"+effBuildPsf, function(v){ up("sfh","buildPsf",v); }),
                field("S106 £/plot", s.s106pu || "", fmtN(Math.round(s106pu)), function(v){ up("sfh","s106pu",v); })
              )
            );
          })(),
          e("ul", { style:{ margin:0, paddingLeft:16, fontSize:10.5, color:"#7278A0", lineHeight:1.6 } },
            e("li", null, e("b", null, "Sale £/sqft"), ": the £"+effBasePsf+" here is a Land-Registry-derived figure + "+premiumPct+"% new-build premium — check it against actual local new-build launches (links above)."),
            e("li", null, e("b", null, "Floor area basis"), ": houses are priced on GIA (whole internal area) — there is no GIA→NIA deduction (the ~10–15% efficiency loss applies only to flats with communal areas)."),
            e("li", null, e("b", null, "Affordable"), ": ~"+ahHomes.toLocaleString()+" homes ("+ahPct+"%) would be sold to a registered provider — confirm current appetite (in Kent, e.g. Golding Homes, Clarion, Moat, Southern Housing)."),
            e("li", null, e("b", null, "Assumptions"), ": S106 (£"+fmtN(Math.round(s106pu))+"/plot), the "+(num(M.financeProgYears)||"?")+"-year programme and planning timeline are estimates — replace with the actual heads of terms and programme. The residual land value is the maximum supportable price, not an agreed land value.")
          )
        );
      })(),

      e("div", { style:{ fontSize:10, color:"#9298BC", marginTop:14, lineHeight:1.5, borderTop:"1px solid #EEF0F7", paddingTop:8 } },
        "Indicative rule-of-thumb — not a RICS Red Book valuation. Assumes residential consent can be achieved. Sale and build £/sqft, S106 and finance are best-practice starting points for the area; verify against local comparables and a QS cost plan before commitment.")
    )
  );
}
