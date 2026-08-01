// ── renderLandownerIdentifier (v10.213) — WHO OWNS THIS LAND? ───────────────────────────────
// When you can't find the owner by other means, this helps identify them: it takes what you know,
// runs AI desk-research to suggest the most likely owner and the best lines of enquiry, links you
// straight to the OFFICIAL sources (HM Land Registry title register — the definitive answer for a
// few pounds; the free corporate-ownership datasets; Companies House), can call a wired ownership /
// Companies House API on your backend, and records the confirmed owner so it flows into the
// Approach-Landowner tool. Honest by design: there is no free "who owns this postcode" API — the
// title register is the authority, and everything else is a lead or a paid aggregator.
// Uses globals: e, S, Inp, num, cityName, callAI, WEBHOOK, WEBHOOK_TOKEN, notify, useState, React.

function renderLandownerIdentifier(data, up, navTo, user){
  return e(LandownerIdentifier, { data:data, up:up, navTo:navTo, user:user });
}

function LandownerIdentifier(props){
  var data = props.data, up = props.up, navTo = props.navTo, user = props.user;
  var idn = data.identify || {};
  var L = data.land || {};
  var rS = useState(null);   var research = rS[0], setResearch = rS[1];
  var bS = useState(false);  var busy = bS[0], setBusy = bS[1];
  var lkS = useState(null);  var lookup = lkS[0], setLookup = lkS[1];    // { kind, status, data|message }
  var accent = "#2E2F8A";

  function setI(k, v){ up("identify", k, v); }
  var address = idn.address || L.address || "";
  var postcode = idn.postcode || L.postcode || "";

  function encq(s){ try{ return encodeURIComponent(s || ""); }catch(e){ return ""; } }
  function openUrl(u){ try{ window.open(u, "_blank"); }catch(e){} }

  async function doResearch(){
    setBusy(true);
    var facts = [
      "Site: " + (address || "unknown") + (postcode ? " (" + postcode + ")" : "") + (L.city ? ", " + cityName(L.city) : "") + ".",
      num(L.acres) > 0 ? "About " + L.acres + " acres." : "",
      idn.titleNumber ? "Title number (if any): " + idn.titleNumber + "." : "",
      idn.suspectedCompany ? "A company that may be involved: " + idn.suspectedCompany + "." : "",
      "What we already know: " + (idn.clues || "nothing yet — this is a cold identification.")
    ].filter(Boolean).join("\n");
    var sys = "You are a UK land-ownership research analyst. From the clues, deduce the MOST LIKELY owner of a parcel of land and, crucially, the BEST PRACTICAL ROUTES to confirm it. You do NOT have live access to the Land Registry — be explicit that the title register is the authority. Never fabricate a specific named owner as if confirmed; if you name a candidate, mark it a hypothesis and say how to verify. Output STRICT JSON only.";
    var prompt = "Return JSON: {\"likelyOwner\":\"...\",\"ownerType\":\"individual|company|trust|public body|charity|church|crown|unknown\",\"confidence\":\"low|medium|high\",\"reasoning\":\"...\",\"suspectedCompany\":\"... or empty\",\"linesOfEnquiry\":[\"...\",\"...\"]}. " +
      "The linesOfEnquiry should be concrete UK routes ranked best-first — e.g. buy the HM Land Registry title register for the address (definitive, ~£3); check the applicant/agent on any planning application for the site (public on the LPA portal); Companies House if a company/estate is involved; the CCOD/OCOD corporate-ownership datasets; adjoining-owner and local knowledge; agricultural tenancy / farm business; electoral roll for a dwelling; the parish/estate. Keep each concrete and actionable. " +
      "FACTS:\n" + facts;
    try{
      var res = await callAI(user, "keystone", sys, prompt);
      var a = res.indexOf("{"), b = res.lastIndexOf("}");
      setResearch(JSON.parse((a >= 0 && b > a) ? res.substring(a, b + 1) : res));
      setBusy(false);
    }catch(e){ setBusy(false); if(typeof notify === "function") notify("Couldn't run the research (" + (e.message || e) + "). Try again."); }
  }

  // Optional backend lookups — call a wired provider. Graceful when the action isn't deployed.
  async function backendLookup(kind, params){
    setLookup({ kind:kind, status:"loading" });
    try{
      var res = await fetch(WEBHOOK, { method:"POST", headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body:JSON.stringify(Object.assign({ action:kind, token:(typeof WEBHOOK_TOKEN !== "undefined" ? WEBHOOK_TOKEN : ""), userId:(user && user.userId) || "" }, params)) });
      var j = {}; try{ j = await res.json(); }catch(e){}
      if(j && j.status === "ok"){ setLookup({ kind:kind, status:"ok", data:j }); }
      else { setLookup({ kind:kind, status:"error", message:(j && j.message) || "not-deployed" }); }
    }catch(e){ setLookup({ kind:kind, status:"error", message:"network" }); }
  }

  function recordOwner(name, addr, type, source){
    if(name){ setI("ownerName", name); }
    // feed the Approach-Landowner tool
    up("outreach", "ownerName", name || idn.ownerName || "");
    if(addr){
      var lines = String(addr).split(/,\s*/);
      up("outreach", "recipientLine1", lines[0] || "");
      up("outreach", "recipientLine2", lines[1] || "");
      up("outreach", "recipientTown", lines[2] || "");
      up("outreach", "recipientPostcode", lines[lines.length - 1] || "");
    }
    if(type) setI("ownerType", type);
    if(source) setI("ownerSource", source);
    setI("ownerConfirmedAt", Date.now());
    if(typeof notify === "function") notify("Saved the owner — it's now on the Approach-Landowner stage.");
  }

  // ── UI helpers ──
  function field(label, key, ph, full){ return e(Inp, { label:label, value:idn[key] || "", onChange:function(v){ setI(key, v); }, placeholder:ph, full:full }); }
  function card(title, sub, children){ return e("div", { style:Object.assign({}, S.card) }, e("div", { style:S.cardTitle }, title), sub && e("div", { style:{ fontSize:11, color:"#7278A0", margin:"-4px 0 10px", lineHeight:1.5 } }, sub), children); }
  function linkBtn(label, url, col){ return e("button", { onClick:function(){ openUrl(url); }, style:{ padding:"8px 13px", background:col || "#4A4BAE", border:"none", color:"#fff", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, label + " ↗"); }
  function confChip(c){ var m = { high:["#1B7A54", "high confidence"], medium:["#9A7B3E", "medium confidence"], low:["#B05A35", "low confidence"] }[c] || ["#7278A0", c]; return e("span", { style:{ fontSize:10, fontWeight:800, color:m[0], background:m[0] + "16", border:"1px solid " + m[0] + "44", borderRadius:20, padding:"2px 9px" } }, m[1]); }

  return e("div", null,
    e("h2", { style:{ fontSize:24, fontWeight:800, color:accent, marginBottom:4 } }, "🕵 Landowner Identifier"),
    e("p", { style:{ fontSize:12, color:"#7278A0", marginBottom:14, lineHeight:1.6, maxWidth:780 } },
      "Can't find who owns the land? Enter what you know and Landform suggests the most likely owner and the best routes to confirm it, then links you straight to the official sources. Note upfront: there's no free ‘who owns this postcode’ lookup — the ", e("b", null, "HM Land Registry title register"), " (a few pounds) is the definitive answer; corporate owners can be found free via Companies House and the CCOD/OCOD datasets."),

    // SITE + CLUES
    card("The site & what you know", null,
      e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 } },
        e(Inp, { label:"Address", value:address, onChange:function(v){ setI("address", v); }, placeholder:"e.g. Land at Mill Lane, Maldon" }),
        e(Inp, { label:"Postcode", value:postcode, onChange:function(v){ setI("postcode", v); }, placeholder:"e.g. CM9 4AB" }),
        field("Title number (if known)", "titleNumber", "e.g. EX123456"),
        field("Suspected company / estate", "suspectedCompany", "e.g. Smith Farms Ltd")),
      e("div", { style:{ marginTop:12 } },
        e("label", { style:S.label }, "What you already know (agent said, notes, farm/estate name, planning history…)"),
        e("textarea", { value:idn.clues || "", onChange:function(ev){ setI("clues", ev.target.value); }, placeholder:"e.g. Agent mentioned a family trust · a barn on site trades as ‘Mill Farm’ · a 2019 planning app was by J. Smith",
          style:{ width:"100%", minHeight:64, padding:"9px 12px", border:"1px solid #C5C8E0", borderRadius:8, fontSize:13, color:"#2E2F8A", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical" } })),
      e("button", { onClick:doResearch, disabled:busy, style:{ marginTop:12, padding:"11px 22px", background:busy ? "#8889C8" : "#2D7A65", border:"none", color:"#fff", borderRadius:8, fontSize:14, fontWeight:800, cursor:busy ? "wait" : "pointer", fontFamily:"DM Sans,sans-serif" } }, busy ? "🔎 Researching…" : "🔎 Research the likely owner")),

    // AI RESEARCH RESULT
    research && card("Likely owner & how to confirm — AI desk research",
      "A reasoned hypothesis from your clues, not a confirmed record. Confirm with the title register or the routes below.",
      e("div", null,
        e("div", { style:{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:8 } },
          e("div", { style:{ fontSize:16, fontWeight:800, color:"#1B1D46" } }, research.likelyOwner || "Unclear from the clues"),
          research.ownerType && e("span", { style:{ fontSize:11, color:"#7278A0", fontWeight:700 } }, "· " + research.ownerType),
          research.confidence && confChip(research.confidence)),
        research.reasoning && e("div", { style:{ fontSize:12.5, color:"#3A3D6A", lineHeight:1.6, marginBottom:10 } }, research.reasoning),
        (research.linesOfEnquiry && research.linesOfEnquiry.length) && e("div", null,
          e("div", { style:{ fontSize:11, fontWeight:800, color:"#4A4BAE", marginBottom:4 } }, "Best routes to confirm, in order"),
          e("ol", { style:{ margin:"0 0 4px 18px", padding:0, fontSize:13, color:"#2E2F8A", lineHeight:1.6 } }, research.linesOfEnquiry.map(function(x, i){ return e("li", { key:i }, x); }))),
        research.suspectedCompany && e("div", { style:{ marginTop:8 } },
          linkBtn("Check ‘" + research.suspectedCompany + "’ on Companies House", "https://find-and-update.company-information.service.gov.uk/search?q=" + encq(research.suspectedCompany), "#2D7A65")))),

    // OFFICIAL SOURCES
    card("Official sources", "Where the real answer lives. The title register names the proprietor; the rest are free leads.",
      e("div", { style:{ display:"flex", gap:10, flexWrap:"wrap" } },
        linkBtn("HM Land Registry — buy the title register (~£3, definitive)", "https://search-property-information.service.gov.uk/search/search-by-address" + (postcode ? "?postcode=" + encq(postcode) : ""), "#2D7A65"),
        linkBtn("Companies House — company search (free)", "https://find-and-update.company-information.service.gov.uk/search" + (idn.suspectedCompany ? "?q=" + encq(idn.suspectedCompany) : ""), "#4A4BAE"),
        linkBtn("Corporate & overseas ownership (CCOD/OCOD, free)", "https://use-land-property-data.service.gov.uk/datasets/ccod", "#9A7B3E"),
        linkBtn("INSPIRE parcel boundaries (free map)", "https://use-land-property-data.service.gov.uk/datasets/inspire/map", "#7278A0")),
      e("div", { style:{ fontSize:10.5, color:"#9298BC", marginTop:10, lineHeight:1.5 } },
        "The title register (~£3) gives the registered proprietor's name and address — the address you'd write to. For company- or overseas-owned land, CCOD/OCOD list the proprietor for free. INSPIRE shows the parcel boundary (no names). Not all land is registered — very long-held estates and some farmland may be unregistered, in which case local enquiry, the planning history and adjoining owners are the route.")),

    // OPTIONAL AUTOMATED LOOKUP
    card("Automated lookup (optional)", "Wire a provider once and identify from within Landform. Free for companies (Companies House API); the definitive title lookup needs an HMLR Business Gateway account or an aggregator (Searchland / LandInsight / Nimbus).",
      e("div", { style:{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" } },
        e("button", { onClick:function(){ backendLookup("companies_house_lookup", { query:idn.suspectedCompany || research && research.suspectedCompany || idn.ownerName || "" }); }, disabled:lookup && lookup.status === "loading",
          style:{ padding:"9px 16px", background:"#4A4BAE", border:"none", color:"#fff", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "🏢 Look up the company"),
        e("button", { onClick:function(){ backendLookup("land_registry_lookup", { address:address, postcode:postcode, titleNumber:idn.titleNumber || "" }); }, disabled:lookup && lookup.status === "loading",
          style:{ padding:"9px 16px", background:"#2D7A65", border:"none", color:"#fff", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "📜 Look up the title / proprietor"),
        lookup && lookup.status === "loading" && e("span", { style:{ fontSize:12, color:"#7278A0" } }, "Looking up…")),
      lookup && lookup.status === "ok" && e("div", { style:{ marginTop:10, background:"#F1FBF6", border:"1px solid #CDE7DB", borderRadius:8, padding:"10px 12px", fontSize:12.5, color:"#1B5E4A" } },
        e("div", { style:{ fontWeight:800, marginBottom:4 } }, "Result"),
        e("pre", { style:{ whiteSpace:"pre-wrap", fontSize:12, fontFamily:"DM Mono,monospace", margin:0, color:"#2E2F8A" } }, JSON.stringify(lookup.data, null, 2)),
        (lookup.data && (lookup.data.proprietor || lookup.data.companyName || lookup.data.name)) && e("button", { onClick:function(){ recordOwner(lookup.data.proprietor || lookup.data.companyName || lookup.data.name, lookup.data.address || lookup.data.registeredOffice || "", lookup.data.type || "", lookup.kind); }, style:{ marginTop:8, padding:"7px 14px", background:"#2D7A65", border:"none", color:"#fff", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "✓ Use this owner")),
      lookup && lookup.status === "error" && e("div", { style:{ marginTop:10, fontSize:11.5, color:"#9A7B3E", lineHeight:1.5 } },
        "That lookup isn't wired to a provider yet. Add a ‘" + lookup.kind + "’ action to your backend (a ready starter — Companies House is free — is in docs/landowner-identify.gs). Until then, use the official links above.")),

    // RECORD THE OWNER
    card("Confirmed owner", "Once you know it (from the title register or a lookup), record it here — it fills the Approach-Landowner details.",
      e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 } },
        field("Owner name", "ownerName", "e.g. John Smith / Smith Farms Ltd"),
        field("Owner address (for the letter)", "ownerAddress", "e.g. The Old Farmhouse, Mill Lane, Maldon, CM9 4AB", true),
        e(Sel, { label:"Owner type", value:idn.ownerType || "", onChange:function(v){ setI("ownerType", v); }, options:[ { value:"", label:"—" }, { value:"individual", label:"Individual" }, { value:"company", label:"Company" }, { value:"trust", label:"Trust / estate" }, { value:"public", label:"Public body" }, { value:"charity", label:"Charity / church" } ] }),
        field("Source", "ownerSource", "e.g. HMLR title EX123456")),
      e("div", { style:{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap" } },
        e("button", { onClick:function(){ recordOwner(idn.ownerName || "", idn.ownerAddress || "", idn.ownerType || "", idn.ownerSource || ""); if(typeof navTo === "function") navTo("outreach"); }, disabled:!(idn.ownerName || "").trim(),
          style:{ padding:"11px 20px", background:(idn.ownerName || "").trim() ? "#2D7A65" : "#9AA", border:"none", color:"#fff", borderRadius:8, fontSize:13, fontWeight:800, cursor:(idn.ownerName || "").trim() ? "pointer" : "not-allowed", fontFamily:"DM Sans,sans-serif" } }, "✓ Save owner & approach them →"),
        idn.ownerConfirmedAt && e("span", { style:{ fontSize:12, color:"#1B7A54", fontWeight:700, alignSelf:"center" } }, "Recorded"))),

    e("div", { style:{ fontSize:10.5, color:"#9298BC", lineHeight:1.5, marginTop:4, maxWidth:780 } },
      "Data-protection note: identifying a landowner to make a genuine business enquiry about their land is a legitimate interest, but handle the information carefully and only for that purpose. The title register is Crown copyright / licensed data — use it per HM Land Registry's terms.")
  );
}
