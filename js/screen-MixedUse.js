// ── renderMixedUse (v10.199) — MIXED-USE / MULTI-PARCEL SCHEME BUILDER ─────────────────────
// One site, several use-parcels (e.g. 3 ac houses + 1 ac BTR + 1 ac PBSA), each carried to its
// OWN exit (open-market/plot sales, bulk sale to an HA, an institutional forward-fund, or a JOINT
// VENTURE with a fund). Every parcel is priced through the SAME engine as the rest of the tool
// (computeSFHMetrics for houses, computeHRAMetrics for BTR/PBSA), then summed by computeMixedUse
// into one deal residual land value. Mixed OUTCOMES within a use — e.g. 40% of the houses to an HA,
// 60% private — are set with the parcel's Affordable % (it splits the house mix by tenure).
// Purely additive: this is its own stage; the single-use journeys are unchanged.
// Loaded before 05-tool.js. Uses globals: e, S, Inp, Sel, num, fmt, pct, cityName,
// computeMixedUse, defaultParcel.

function renderMixedUse(data, up, user, navTo){
  data = data || {};
  var mixed = data.mixed || {};
  var parcels = Array.isArray(mixed.parcels) ? mixed.parcels : [];
  var city = (data.land && data.land.city) || "";
  var landPrice = num(data.land && data.land.price);

  function setParcels(arr){ up("mixed", "parcels", arr); }
  function uid(){ return "p_" + Date.now() + "_" + Math.floor(Math.random() * 100000); }
  function addParcel(use){
    var np = defaultParcel(use, 1, city); np.id = uid();
    setParcels(parcels.concat([ np ]));
  }
  function patchParcel(i, patch){
    setParcels(parcels.map(function(p, idx){ return idx === i ? Object.assign({}, p, patch) : p; }));
  }
  function patchExit(i, patch){
    patchParcel(i, { exit: Object.assign({}, parcels[i].exit || {}, patch) });
  }
  function removeParcel(i){ setParcels(parcels.filter(function(_, idx){ return idx !== i; })); }

  // ── house-parcel levers (rebuild the mix so the engine sees them) ──
  function buildSfhSection(homes, salePsf, buildPsf, avgSqft, affPct){
    homes = Math.max(1, Math.round(num(homes))); affPct = Math.max(0, Math.min(100, num(affPct)));
    salePsf = num(salePsf) || 340; buildPsf = num(buildPsf) || 210; avgSqft = num(avgSqft) || 900;
    var aff = Math.round(homes * affPct / 100), priv = homes - aff, mix = [];
    if(priv > 0) mix.push({ type:"3-bed semi", count:priv, sqft:avgSqft, psf:salePsf, tenure:"private" });
    if(aff > 0)  mix.push({ type:"2-bed terrace", count:aff, sqft:Math.round(avgSqft * 0.8), psf:salePsf, tenure:"ahp_affordable" });
    return { basePsf:salePsf, buildPsf:buildPsf, avgSqft:avgSqft, mix:mix };
  }
  function sfhLevers(p){
    var s = p.sfh || {}; var mix = s.mix || [];
    var homes = mix.reduce(function(a, r){ return a + num(r.count); }, 0) || 0;
    var aff = mix.reduce(function(a, r){ return a + ((r.tenure && r.tenure !== "private") ? num(r.count) : 0); }, 0);
    return { homes:homes, salePsf:num(s.basePsf) || 340, buildPsf:num(s.buildPsf) || 210,
      avgSqft:num(s.avgSqft) || 900, affPct: homes > 0 ? Math.round(aff / homes * 100) : 0 };
  }
  function setSfh(i, key, val){
    var L = sfhLevers(parcels[i]); L[key] = val;
    patchParcel(i, { sfh: buildSfhSection(L.homes, L.salePsf, L.buildPsf, L.avgSqft, L.affPct) });
  }
  function setHra(i, key, val){
    var o = Object.assign({}, parcels[i].hra || {}); o[key] = val;
    patchParcel(i, { hra: o });
  }

  var USE_OPTS = [ {value:"sfh", label:"🏡 Houses (SFH)"}, {value:"btr", label:"🏢 Build-to-Rent (BTR)"}, {value:"pbsa", label:"🎓 Student (PBSA)"} ];
  function exitOptsFor(use){
    if(use === "sfh") return [
      {value:"plot",         label:"Open-market plot sales"},
      {value:"ha_bulk",      label:"Bulk sale to a HA / fund"},
      {value:"forward_fund", label:"Institutional forward-fund (rented)"},
      {value:"jv",           label:"Joint venture with a fund"} ];
    return [
      {value:"forward_fund", label:"Institutional forward-fund"},
      {value:"jv",           label:"Joint venture with a fund"},
      {value:"plot",         label:"Sell the completed units"},
      {value:"ha_bulk",      label:"Bulk sale to a HA / fund"} ];
  }
  var PARTNER_OPTS = [ {value:"pension_fund", label:"Pension fund"}, {value:"sovereign", label:"Sovereign wealth fund"},
    {value:"btr_operator", label:"BTR / PBSA operator"}, {value:"family_office", label:"Family office"} ];

  var MU = (typeof computeMixedUse === "function") ? computeMixedUse(data) : null;
  var byId = {}; if(MU) MU.parcels.forEach(function(r){ byId[r.id] = r; });

  var acol = "#2E2F8A";
  function chip(txt, col){ return e("span", { style:{ fontSize:10, fontWeight:800, color:col || "#4A4BAE", background:"rgba(74,75,174,0.09)", border:"1px solid rgba(74,75,174,0.25)", borderRadius:5, padding:"2px 7px", whiteSpace:"nowrap" } }, txt); }
  function money(n){ return (n < 0 ? "−£" : "£") + (typeof fmt === "function" ? fmt(Math.abs(n)).replace(/^£/, "") : Math.round(Math.abs(n)).toLocaleString()); }

  return e("div", null,
    e("h2", { style:{ fontSize:24, fontWeight:800, color:acol, marginBottom:4 } }, "🧩 Mixed-Use Scheme"),
    e("p", { style:{ fontSize:12, color:"#7278A0", marginBottom:16, lineHeight:1.6, maxWidth:760 } },
      "Build a single site out of several use-parcels — houses, build-to-rent, student — each taken to its OWN exit. Every parcel is priced through the same engine as the rest of Landform, then summed into one deal land value. A parcel's mixed outcome (e.g. 40% of the houses sold to an HA, 60% private) is set with its Affordable %, and a parcel can be a joint venture with a fund (equity + promote)."),

    // ── ADD PARCEL ──
    e("div", { style:{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 } },
      e("button", { onClick:function(){ addParcel("sfh"); }, style:addBtn("#2D7A65") }, "＋ Houses parcel"),
      e("button", { onClick:function(){ addParcel("btr"); }, style:addBtn("#4A4BAE") }, "＋ BTR parcel"),
      e("button", { onClick:function(){ addParcel("pbsa"); }, style:addBtn("#9A7B3E") }, "＋ PBSA parcel")
    ),

    // ── EMPTY STATE ──
    parcels.length === 0 && e("div", { style:{ padding:"28px 22px", textAlign:"center", background:"#F7F8FC", border:"1px dashed #C5C8E0", borderRadius:10, color:"#7278A0", fontSize:13, marginBottom:16 } },
      e("div", { style:{ fontSize:30, marginBottom:8 } }, "🧩"),
      "No parcels yet. Add a Houses, BTR or PBSA parcel above to start a mixed-use scheme.",
      e("div", { style:{ fontSize:11, marginTop:8, color:"#9298BC" } }, "Example: 3 acres of houses (40% HA / 60% private) + 1 acre BTR forward-fund + 1 acre PBSA joint-venture with a pension fund.")
    ),

    // ── PARCEL CARDS ──
    parcels.map(function(p, i){
      var use = (p.use || "sfh").toLowerCase();
      var isApt = (use === "btr" || use === "pbsa");
      var ex = p.exit || {};
      var r = byId[p.id] || byId["parcel_" + i] || null;
      var accent = use === "sfh" ? "#2D7A65" : use === "pbsa" ? "#9A7B3E" : "#4A4BAE";
      var L = !isApt ? sfhLevers(p) : null;
      var hra = p.hra || {};

      return e("div", { key:p.id || i, style:{ border:"1px solid #DDE0ED", borderLeft:"4px solid " + accent, borderRadius:10, padding:"16px 18px", marginBottom:14, background:"#fff" } },
        // header row
        e("div", { style:{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" } },
          e("input", { value:p.label || "", onChange:function(ev){ patchParcel(i, { label:ev.target.value }); },
            style:{ fontSize:15, fontWeight:800, color:accent, border:"none", borderBottom:"1px dashed #DDE0ED", padding:"2px 0", minWidth:200, flex:1, fontFamily:"DM Sans,sans-serif", background:"transparent" } }),
          e("button", { onClick:function(){ removeParcel(i); }, title:"Remove parcel",
            style:{ background:"none", border:"1px solid #E8C4B0", color:"#B05A35", borderRadius:6, fontSize:11, fontWeight:700, padding:"5px 10px", cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "✕ Remove")
        ),
        // inputs grid
        e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:12 } },
          e(Sel, { label:"Use", value:use, onChange:function(v){ setParcels(parcels.map(function(pp, idx){ return idx === i ? Object.assign(defaultParcel(v, num(pp.acres) || 1, city), { id:pp.id, label:pp.label }) : pp; })); }, options:USE_OPTS }),
          e(Inp, { label:"Acres", type:"number", value:p.acres, onChange:function(v){ patchParcel(i, { acres:v }); }, placeholder:"1" }),
          e(Sel, { label:"Exit route", value:ex.route || (isApt ? "forward_fund" : "plot"), onChange:function(v){ patchExit(i, { route:v }); }, options:exitOptsFor(use) }),

          // SFH levers
          !isApt && e(Inp, { label:"Homes", type:"number", value:L.homes, onChange:function(v){ setSfh(i, "homes", v); }, placeholder:"20" }),
          !isApt && e(Inp, { label:"Affordable % (→ HA)", type:"number", value:L.affPct, onChange:function(v){ setSfh(i, "affPct", v); }, placeholder:"40" }),
          !isApt && e(Inp, { label:"Sale £/sqft", type:"number", value:L.salePsf, onChange:function(v){ setSfh(i, "salePsf", v); }, placeholder:"340" }),
          !isApt && e(Inp, { label:"Build £/sqft", type:"number", value:L.buildPsf, onChange:function(v){ setSfh(i, "buildPsf", v); }, placeholder:"210" }),

          // BTR/PBSA levers
          isApt && e(Inp, { label:"Storeys", type:"number", value:hra.storeys, onChange:function(v){ setHra(i, "storeys", v); }, placeholder:"6" }),
          isApt && e(Inp, { label:"Floor area / storey (sqft)", type:"number", value:hra.fp, onChange:function(v){ setHra(i, "fp", v); }, placeholder:"8000" }),
          isApt && e(Inp, { label:"Net initial yield %", type:"number", value:(p.capitalise && p.capitalise.targetYield), onChange:function(v){ patchParcel(i, { capitalise:Object.assign({}, p.capitalise || {}, { targetYield:v }) }); }, placeholder:isApt && use === "pbsa" ? "5.25" : "4.75" }),
          isApt && e(Inp, { label:"Developer profit %", type:"number", value:hra.profitPct, onChange:function(v){ setHra(i, "profitPct", v); }, placeholder:"17.5" })
        ),

        // JV fields
        (ex.route === "jv") && e("div", { style:{ background:"rgba(154,123,62,0.06)", border:"1px solid rgba(154,123,62,0.25)", borderRadius:8, padding:"10px 12px", marginBottom:12 } },
          e("div", { style:{ fontSize:11, fontWeight:800, color:"#9A7B3E", marginBottom:8 } }, "🤝 Joint-venture structure (indicative)"),
          e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10 } },
            e(Sel, { label:"Partner", value:ex.jvPartner || "pension_fund", onChange:function(v){ patchExit(i, { jvPartner:v }); }, options:PARTNER_OPTS }),
            e(Inp, { label:"Cassidy equity %", type:"number", value:ex.cassidyEquityPct, onChange:function(v){ patchExit(i, { cassidyEquityPct:v }); }, placeholder:"25" }),
            e(Inp, { label:"Promote / carry %", type:"number", value:ex.promotePct, onChange:function(v){ patchExit(i, { promotePct:v }); }, placeholder:"20" }),
            e(Inp, { label:"Fund pref return %", type:"number", value:ex.prefRate, onChange:function(v){ patchExit(i, { prefRate:v }); }, placeholder:"8" })
          )
        ),

        // live per-parcel result
        r && e("div", { style:{ display:"flex", gap:14, flexWrap:"wrap", alignItems:"center", borderTop:"1px solid #F0F1FA", paddingTop:10, fontSize:11, color:"#5A5F86" } },
          chip(r.units + " units", accent),
          chip("Exit: " + r.exitLabel, accent),
          e("span", null, "Exit value ", e("b", { style:{ color:"#2E2F8A" } }, money(r.exitValue))),
          e("span", null, "Dev cost ", e("b", { style:{ color:"#2E2F8A" } }, money(r.devCost))),
          e("span", null, "Land it supports ", e("b", { style:{ color:r.exitRlv >= 0 ? "#2D7A65" : "#B05A35" } }, money(r.exitRlv))),
          r.jv && e("span", { style:{ color:"#9A7B3E", fontWeight:700 } }, "· JV: Cassidy " + money(r.jv.cassidyShare) + " / fund " + money(r.jv.fundShare))
        )
      );
    }),

    // ── DEAL TOTALS ──
    MU && MU.count > 0 && (function(){
      var stacks = landPrice > 0 ? MU.headroom >= 0 : MU.totalRLV > 0;
      var vcol = stacks ? "#1B7A54" : "#B05A35";
      return e("div", { style:{ marginTop:8, border:"2px solid " + vcol, borderRadius:12, padding:"18px 20px", background:"linear-gradient(135deg,#F8FBF9,#F0F4FF)" } },
        e("div", { style:{ fontSize:13, fontWeight:800, color:acol, marginBottom:12, textTransform:"uppercase", letterSpacing:".08em" } },
          "Blended deal — " + MU.count + " parcels · " + (Math.round(MU.totalAcres * 10) / 10) + " ac · " + fmt2(MU.totalUnits) + " units"),
        e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14 } },
          tile("Total exit value (GDV)", money(MU.totalGDV), acol),
          tile("Total development cost", money(MU.totalDevCost), acol),
          tile("Land the scheme supports (RLV)", money(MU.totalRLV), MU.totalRLV >= 0 ? "#2D7A65" : "#B05A35"),
          landPrice > 0 && tile("Guide land price", money(landPrice), acol),
          landPrice > 0 && tile(stacks ? "Headroom over land price" : "Short of land price", money(MU.headroom), vcol),
          landPrice > 0 && tile("Margin after land", (Math.round(MU.afterLandMarginPct * 10) / 10) + "%", MU.afterLandMarginPct >= 15 ? "#2D7A65" : "#9A7B3E"),
          MU.hasJv && tile("Cassidy JV profit share", money(MU.cassidyJvShare), "#9A7B3E")
        ),
        e("div", { style:{ marginTop:12, fontSize:12, fontWeight:800, color:vcol } },
          stacks ? (landPrice > 0 ? "✓ The blended scheme stacks at the guide price." : "✓ The parcels support a positive land value.")
                 : (landPrice > 0 ? "✗ The blended scheme is short of the guide price — adjust the parcels, exits or price." : "✗ The parcels don't yet support a positive land value.")),
        e("div", { style:{ marginTop:8, fontSize:10, color:"#9298BC", lineHeight:1.6 } },
          "Each parcel is priced through the same engine as the single-use journeys; the land value is the sum of what each parcel can pay. JV figures are an indicative static split (equity share + promote over the fund's preferred return) — a full period-by-period waterfall is a later refinement.")
      );
    })()
  );

  function addBtn(col){ return { padding:"9px 16px", background:col, border:"none", color:"#fff", borderRadius:7, fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif" }; }
  function tile(label, val, col){ return e("div", { style:{ background:"#fff", border:"1px solid #E0E2EC", borderRadius:8, padding:"12px 14px" } },
    e("div", { style:{ fontSize:9.5, color:"#7278A0", textTransform:"uppercase", letterSpacing:".1em", fontWeight:700, marginBottom:5 } }, label),
    e("div", { style:{ fontSize:18, fontWeight:800, color:col || "#2E2F8A" } }, val)); }
  function fmt2(n){ return (typeof n === "number" ? n : 0).toLocaleString("en-GB"); }
}
