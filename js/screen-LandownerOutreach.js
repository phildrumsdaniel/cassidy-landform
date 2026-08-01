// ── renderLandownerOutreach (v10.208) — APPROACH THE LANDOWNER ──────────────────────────────
// Once the numbers are crunched, turn the deal into a ready approach to the landowner (or their
// agent): a tailored EMAIL, a print-ready LETTER for the post, and a CALL BRIEF for a human to
// phone with. All drafted by AI from the deal's own figures and the chosen deal structure, and
// ALWAYS reviewed/edited by you before anything is sent — this addresses ONE identified landowner
// for this site, not a mailing list. A clear recommendation on the three channels (and the legal
// line on automated calls) sits alongside. Uses globals: e, S, num, fmt, cityName, callAI,
// calcDealMetrics, useState, React.

function renderLandownerOutreach(data, up, user){
  return e(LandownerOutreach, { data:data, up:up, user:user });
}

var OUTREACH_STRUCTS = {
  option:      "an option agreement (a fee now; buy on consent at a discount that rewards us for funding the planning risk)",
  promotion:   "a promotion agreement (we fund and drive the planning, the land is sold with consent, you keep the proceeds less our promoter fee)",
  overage:     "an unconditional purchase now at agricultural-plus value with an overage / clawback so you share in the uplift when consent lands",
  conditional: "a purchase conditional on planning consent",
  unconditional:"an unconditional purchase"
};

function LandownerOutreach(props){
  var data = props.data, up = props.up, user = props.user;
  var o = data.outreach || {};
  var L = data.land || {};
  var gS = useState(null);   var gen = gS[0], setGen = gS[1];        // {email, letter, callScript}
  var bS = useState(false);  var busy = bS[0], setBusy = bS[1];
  var eS = useState("");     var err = eS[0], setErr = eS[1];
  var sndS = useState("");   var sendState = sndS[0], setSendState = sndS[1];   // "" | sending | sent | error:<msg>
  var clS = useState("");    var callNote = clS[0], setCallNote = clS[1];      // manual call-log note draft
  var accent = "#2E2F8A";

  function esc(s){ return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function setO(key, val){ up("outreach", key, val); }
  // v10.210 — outreach log: an audit trail of what was sent/done for this landowner, on the deal.
  function addLog(channel, to, note){
    var entry = { ts:Date.now(), channel:channel, to:to || "", note:note || "" };
    var log = Array.isArray(o.log) ? o.log.slice() : [];
    log.unshift(entry);
    setO("log", log);
  }
  function fmtLogTime(ts){ try{ return new Date(ts).toLocaleString("en-GB", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }); }catch(e){ return ""; } }
  // mirror the follow-up to the global store so the app-open reminder can surface it across deals
  function mirrorFollowup(date, note){
    if(typeof saveOutreachFollowup !== "function") return;
    saveOutreachFollowup((typeof dealKeyFor === "function") ? dealKeyFor(data) : (data.dealName || ""),
      (date ? { date:date, note:note || "", owner:o.ownerName || "", dealName:data.dealName || (L.address || "") } : null));
  }
  var M = (typeof calcDealMetrics === "function") ? calcDealMetrics(data) : {};
  var rlv = num(M.rlv), asking = num(L.price), units = num(M.units), acres = num(L.acres);
  var structure = o.structure || L.dealStructure || "option";
  var addressTo = o.addressTo || (o.agentName ? "agent" : "owner");

  async function generate(){
    setBusy(true); setErr("");
    var sender = (o.senderName || (user && user.name) || "") + (o.senderRole ? ", " + o.senderRole : "");
    var facts = [
      "Developer: Cassidy Group — a serious, funded UK residential developer.",
      "Sender: " + (sender || "the Cassidy Group land team") + (o.senderEmail ? " (" + o.senderEmail + ")" : "") + (o.senderPhone ? ", " + o.senderPhone : "") + ".",
      "Site: " + (L.address || data.dealName || "the land") + (L.city ? ", " + cityName(L.city) : "") + (L.postcode ? " " + L.postcode : "") + ".",
      acres > 0 ? "Site area: " + acres + " acres." : "",
      units > 0 ? "Our scheme envisages ~" + units + " homes." : "",
      "Proposed deal structure: " + (OUTREACH_STRUCTS[structure] || structure) + ".",
      o.includeFigure && rlv > 0 ? "We can indicate a value in the region of " + fmt(rlv) + " subject to planning and due diligence — but keep it soft and negotiable." : "Do NOT state a hard price — express serious interest and propose a conversation; keep figures for the meeting.",
      "Recipient: address the " + (addressTo === "agent" ? "land agent (" + (o.agentName || "the agent") + (o.agentFirm ? " of " + o.agentFirm : "") + ")" : "landowner (" + (o.ownerName || "the owner") + ")") + ".",
      "Tone: " + (o.tone === "warm" ? "warm and personable" : "professional and courteous") + " — a genuine enquiry about THIS specific site, never a mailshot."
    ].filter(Boolean).join("\n");
    var sys = "You are a UK land & development professional writing a first approach to a landowner about buying / promoting their land. Write naturally and credibly — like a real person, not marketing spam. Be concise, respectful and non-pushy; the goal of a first touch is to open a conversation, not to close a deal or hard-sell. Output STRICT JSON only.";
    var prompt = "Draft three first-approach communications from the facts below. Output JSON exactly: " +
      "{\"email\":{\"subject\":\"...\",\"body\":\"...\"},\"letter\":{\"body\":\"...\"},\"callScript\":{\"opening\":\"...\",\"points\":[\"...\"],\"objections\":[{\"q\":\"...\",\"a\":\"...\"}],\"close\":\"...\"}}. " +
      "The EMAIL ~130-160 words, warm subject line, clear ask (a short call or meeting), signed off by the sender. " +
      "The LETTER a formal business letter body (no address blocks — the app adds letterhead, date and the recipient address); ~150-200 words, ending with a call to action and the sender's name. " +
      "The CALL SCRIPT is for a HUMAN to phone with: a natural opening line, 4-6 talking points, 3 likely objections with a good response each, and a close that books a next step. " +
      "FACTS:\n" + facts;
    try{
      var res = await callAI(user, "keystone", sys, prompt);
      var a = res.indexOf("{"), b = res.lastIndexOf("}");
      var obj = JSON.parse((a >= 0 && b > a) ? res.substring(a, b + 1) : res);
      setGen(obj); setBusy(false);
    }catch(e2){ setBusy(false); setErr("Couldn't draft that (" + (e2.message || e2) + "). Check the connection and try again."); }
  }

  function copy(text){ try{ if(navigator && navigator.clipboard) navigator.clipboard.writeText(text); else if(typeof notify === "function") notify("Copy not available — select the text and copy manually."); }catch(e){} if(typeof notify === "function") notify("Copied to clipboard."); }

  function recipientEmail(){ return ((addressTo === "agent" ? o.agentEmail : o.ownerEmail) || "").trim(); }

  function openEmail(){
    if(!gen || !gen.email) return;
    var href = "mailto:" + encodeURIComponent(recipientEmail()) + "?subject=" + encodeURIComponent(gen.email.subject || "") + "&body=" + encodeURIComponent(gen.email.body || "");
    try{ window.location.href = href; }catch(e){}
  }

  // v10.209 — SEND the reviewed email straight from the backend (Google Apps Script MailApp). Sends
  // FROM the deploying account with replies routed to the sender; the user reviews and confirms first.
  async function doSendEmail(to){
    setSendState("sending");
    try{
      var fromAddr = (o.senderEmail || "phil.daniel@cassidygroupltd.com").trim();   // the company address to send FROM (a verified send-as alias on the backend account)
      var res = await fetch(WEBHOOK, { method:"POST", headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body:JSON.stringify({ action:"send_email", token:(typeof WEBHOOK_TOKEN !== "undefined" ? WEBHOOK_TOKEN : ""),
          userId:(user && user.userId) || "", to:to, subject:(gen.email && gen.email.subject) || "",
          body:(gen.email && gen.email.body) || "", from:fromAddr, replyTo:fromAddr,
          fromName:(o.senderName || (user && user.name) || "Cassidy Group") }) });
      var j = {}; try{ j = await res.json(); }catch(e){}
      if(j && j.status === "ok"){
        setSendState("sent"); setO("emailSentAt", Date.now()); setO("emailSentTo", to);
        addLog("email", to, "Email sent" + (j.sentFrom ? " from " + j.sentFrom : (fromAddr ? " from " + fromAddr : "")) + " — “" + ((gen.email && gen.email.subject) || "") + "”");
        if(typeof notify === "function") notify("✓ Email sent to " + to + (j.sentFrom ? " from " + j.sentFrom : "") + ".");
      } else {
        setSendState("error:" + ((j && j.message) || "not-deployed"));
        if(typeof notify === "function") notify("Couldn't send — the 'send_email' backend action isn't deployed yet.\n\nUse ‘Open in email app’ for now, or paste the snippet in docs/landowner-email-send.gs into your Apps Script and redeploy.");
      }
    }catch(e){ setSendState("error:network"); if(typeof notify === "function") notify("Couldn't reach the backend to send. Use ‘Open in email app’ instead."); }
  }
  function sendEmailNow(){
    if(!gen || !gen.email) return;
    var to = recipientEmail();
    if(!to){ if(typeof notify === "function") notify("Add the recipient's email address first (or use ‘Open in email app’)."); return; }
    var msg = "Send this email now to " + to + "?\n\nIt sends from your Landform (Google) backend account, with replies going to " + (o.senderEmail || "your address") + ". You've reviewed the draft — this can't be un-sent.";
    if(typeof confirmToast === "function") confirmToast(msg, function(){ doSendEmail(to); }, { confirmLabel:"Send email" });
    else doSendEmail(to);
  }

  function printLetter(){
    if(!gen || !gen.letter) return;
    var today = "";
    try{ today = new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" }); }catch(e){}
    var addr = [ o.ownerName, o.recipientLine1, o.recipientLine2, o.recipientTown, o.recipientPostcode ].filter(function(x){ return x && String(x).trim(); }).map(esc).join("<br>");
    var senderBlock = [ (o.senderName || (user && user.name) || "Cassidy Group"), o.senderRole, "Cassidy Group", o.senderEmail, o.senderPhone ].filter(Boolean).map(esc).join("<br>");
    var body = esc(gen.letter.body || "").replace(/\n/g, "<br><br>");
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Landowner letter</title>' +
      '<style>@page{size:A4;margin:22mm}body{font-family:Georgia,\'Times New Roman\',serif;color:#1b1b1b;font-size:12.5pt;line-height:1.55;max-width:170mm;margin:0 auto}' +
      '.rt{ text-align:right;font-size:11pt;color:#333}.addr{margin:26px 0 6px}.date{margin:18px 0}.body{margin-top:14px;white-space:normal}@media print{.noprint{display:none}}' +
      '.bar{margin:22px 0 4px;text-align:center}button{font-family:Arial;padding:8px 16px;border:1px solid #888;border-radius:6px;background:#f4f4f4;cursor:pointer}</style></head><body>' +
      '<div class="noprint bar"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>' +
      '<div class="rt">' + senderBlock + '</div>' +
      '<div class="date">' + esc(today) + '</div>' +
      '<div class="addr">' + (addr || "&nbsp;") + '</div>' +
      '<div>Dear ' + esc(o.ownerName || "Sir or Madam") + ',</div>' +
      '<div class="body">' + body + '</div>' +
      '</body></html>';
    try{ var w = window.open("", "_blank"); w.document.write(html); w.document.close();
      addLog("letter", o.ownerName || "", "Letter prepared for post" + (o.recipientPostcode ? " to " + o.recipientPostcode : ""));
    }catch(e){ if(typeof notify === "function") notify("Pop-up blocked — allow pop-ups to open the printable letter."); }
  }
  function logCall(){
    addLog("call", (addressTo === "agent" ? o.agentName : o.ownerName) || "", (callNote || "").trim() || "Call made");
    setCallNote("");
    if(typeof notify === "function") notify("Logged.");
  }

  // ── UI ──
  function field(label, key, ph, full){ return e(Inp, { label:label, value:o[key] || "", onChange:function(v){ setO(key, v); }, placeholder:ph, full:full }); }
  function card(title, children){ return e("div", { style:Object.assign({}, S.card) }, e("div", { style:S.cardTitle }, title), children); }
  function outBox(text){ return e("div", { style:{ whiteSpace:"pre-wrap", fontSize:13, color:"#2E2F8A", background:"#F7F8FC", border:"1px solid #DDE0ED", borderRadius:8, padding:"12px 14px", lineHeight:1.55 } }, text); }
  function btn(label, onClick, col){ return e("button", { onClick:onClick, style:{ padding:"8px 14px", background:col || "#4A4BAE", border:"none", color:"#fff", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, label); }

  return e("div", null,
    e("h2", { style:{ fontSize:24, fontWeight:800, color:accent, marginBottom:4 } }, "📬 Approach the Landowner"),
    e("p", { style:{ fontSize:12, color:"#7278A0", marginBottom:16, lineHeight:1.6, maxWidth:760 } },
      "The numbers are crunched — now open the conversation. Landform drafts a tailored email, a print-ready letter for the post, and a call brief for a person to phone with, all from this deal's figures and your chosen structure. Review and edit everything before it goes: this is a genuine, one-to-one approach to " + (L.address ? "the owner of " + L.address : "this landowner") + ", not a mailshot."),

    // ── RECOMMENDED APPROACH ──
    e("div", { style:{ background:"linear-gradient(135deg,#F4F5FF,#F0F8F4)", border:"1px solid #DDE0ED", borderRadius:12, padding:"16px 18px", marginBottom:16 } },
      e("div", { style:{ fontSize:12, fontWeight:800, color:accent, marginBottom:8, textTransform:"uppercase", letterSpacing:".06em" } }, "Best way to make contact"),
      e("div", { style:{ fontSize:12.5, color:"#3A3D6A", lineHeight:1.65 } },
        e("div", { style:{ marginBottom:6 } }, e("b", null, "1. A letter, first — by post. "), "For a cold landowner this is the strongest opener: it gets read, it feels serious and personal, and direct mail to a named owner about their own land is fully above board. Lead with this."),
        e("div", { style:{ marginBottom:6 } }, e("b", null, "2. Email as a follow-up "), "— or the first touch where you have the agent's address. Keep it a real, specific enquiry (this site, why you), never a bulk send."),
        e("div", { style:{ marginBottom:6 } }, e("b", null, "3. A phone call once there's warmth "), "— highest conversion, but ", e("b", { style:{ color:"#B05A35" } }, "a person makes it"), ". Use the call brief below. ",
          e("span", { style:{ color:"#B05A35", fontWeight:700 } }, "Note on ‘automated calls’: "), "a recorded / AI voice dialling a landowner who hasn't agreed to it is restricted under UK PECR (reg 19 — automated marketing calls need prior consent), so Landform prepares the call for a human rather than auto-dialling. Screen numbers against the TPS/CTPS first."),
        e("div", { style:{ fontSize:11, color:"#7278A0", marginTop:4 } }, "Recommended sequence: post the letter → follow up by email a week later → then a human call. AI-drafted, you review and send.")
      )
    ),

    // ── CONTACT + OPTIONS ──
    card("Who you're contacting",
      e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 } },
        e(Sel, { label:"Address it to", value:addressTo, onChange:function(v){ setO("addressTo", v); }, options:[ { value:"owner", label:"The landowner" }, { value:"agent", label:"Their land agent" } ] }),
        field("Landowner name", "ownerName", "e.g. Mr J Smith / Smith Farms Ltd"),
        addressTo === "agent" && field("Agent name", "agentName", "e.g. Jane Doe"),
        addressTo === "agent" && field("Agent firm", "agentFirm", "e.g. Savills"),
        field(addressTo === "agent" ? "Agent email" : "Owner email", addressTo === "agent" ? "agentEmail" : "ownerEmail", "for the email / mailto"),
        e(Sel, { label:"Deal structure to propose", value:structure, onChange:function(v){ setO("structure", v); }, options:[
          { value:"option", label:"Option agreement" }, { value:"promotion", label:"Promotion agreement" },
          { value:"overage", label:"Purchase + overage" }, { value:"conditional", label:"Conditional purchase" }, { value:"unconditional", label:"Unconditional purchase" } ] }),
        e(Sel, { label:"Tone", value:o.tone || "formal", onChange:function(v){ setO("tone", v); }, options:[ { value:"formal", label:"Professional" }, { value:"warm", label:"Warm / personable" } ] }),
        e("label", { style:{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"#3A3D6A", alignSelf:"end", paddingBottom:8 } },
          e("input", { type:"checkbox", checked:!!o.includeFigure, onChange:function(ev){ setO("includeFigure", ev.target.checked); }, style:{ width:15, height:15, cursor:"pointer" } }),
          "Indicate a value" + (rlv > 0 ? " (~" + fmt(rlv) + ")" : "")))
    ),

    // ── LETTER ADDRESS (for the printed letter) ──
    card("Postal address (for the letter)",
      e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 } },
        field("Address line 1", "recipientLine1", "e.g. The Old Farmhouse"),
        field("Address line 2", "recipientLine2", "e.g. Mill Lane"),
        field("Town", "recipientTown", "e.g. Maldon"),
        field("Postcode", "recipientPostcode", "e.g. CM9 4AB")),
      e("div", { style:{ marginTop:12, fontSize:11, color:"#7278A0", fontWeight:700 } }, "Your sign-off:"),
      e("div", { style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginTop:4 } },
        field("Your name", "senderName", (user && user.name) || "e.g. Phil Daniel"),
        field("Your role", "senderRole", "e.g. Land & Development Director"),
        field("Send from / your email", "senderEmail", "e.g. phil.daniel@cassidygroupltd.com"),
        field("Your phone", "senderPhone", "for the sign-off")),
      e("div", { style:{ fontSize:10.5, color:"#9298BC", marginTop:6, lineHeight:1.5 } },
        "‘Send from’ is the address the email is sent from and replies go to. To send from your company address (e.g. phil.daniel@cassidygroupltd.com) it must be a verified ‘Send mail as’ alias on the Google account your Landform backend runs on — a one-time Gmail setting (see docs/landowner-email-send.gs).")),

    // ── GENERATE ──
    e("div", { style:{ display:"flex", gap:12, alignItems:"center", margin:"6px 0 16px", flexWrap:"wrap" } },
      e("button", { onClick:generate, disabled:busy, style:{ padding:"12px 24px", background:busy ? "#8889C8" : "#2D7A65", border:"none", color:"#fff", borderRadius:8, fontSize:14, fontWeight:800, cursor:busy ? "wait" : "pointer", fontFamily:"DM Sans,sans-serif" } }, busy ? "✍️ Drafting…" : (gen ? "↻ Re-draft all three" : "✍️ Draft the approach")),
      err && e("span", { style:{ fontSize:12, color:"#B05A35" } }, err),
      rlv <= 0 && !gen && e("span", { style:{ fontSize:11, color:"#9A7B3E" } }, "Tip: crunch the numbers (Land Valuation / build the scheme) first so the approach can reference real figures.")),

    // ── OUTPUTS ──
    gen && e("div", null,
      // EMAIL
      card("✉ Email",
        e("div", { style:{ fontSize:12, fontWeight:700, color:"#4A4BAE", marginBottom:6 } }, "To: " + (recipientEmail() || "— add the recipient's email above —") + "   ·   Subject: " + (gen.email && gen.email.subject || "")),
        outBox((gen.email && gen.email.body) || ""),
        e("div", { style:{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap", alignItems:"center" } },
          e("button", { onClick:sendEmailNow, disabled:sendState === "sending" || !recipientEmail(),
            style:{ padding:"9px 18px", background:(sendState === "sending" || !recipientEmail()) ? "#8CA79B" : "#2D7A65", border:"none", color:"#fff", borderRadius:6, fontSize:13, fontWeight:800, cursor:(sendState === "sending" || !recipientEmail()) ? "not-allowed" : "pointer", fontFamily:"DM Sans,sans-serif" } },
            sendState === "sending" ? "📤 Sending…" : "📤 Send email now"),
          btn("✉ Open in email app", openEmail, "#4A4BAE"),
          btn("Copy", function(){ copy("Subject: " + (gen.email && gen.email.subject || "") + "\n\n" + (gen.email && gen.email.body || "")); }, "#7278A0"),
          (o.emailSentAt || sendState === "sent") && e("span", { style:{ fontSize:12, color:"#1B7A54", fontWeight:800 } }, "✓ Sent" + (o.emailSentTo ? " to " + o.emailSentTo : "")),
          (sendState.indexOf("error") === 0) && e("span", { style:{ fontSize:11, color:"#B05A35" } }, "Send unavailable — use ‘Open in email app’, or deploy the backend snippet.")),
        e("div", { style:{ fontSize:10.5, color:"#9298BC", marginTop:8, lineHeight:1.5 } },
          "‘Send email now’ sends it straight from your Landform (Google) backend, with replies going to your address. Needs a one-time backend step — the ‘send_email’ action from docs/landowner-email-send.gs pasted into your Apps Script (same ~2-minute deploy as the deal sync). Until then use ‘Open in email app’, which opens the draft in your own mail client to send.")),
      // LETTER
      card("✉ Letter (for the post)",
        outBox((gen.letter && gen.letter.body) || ""),
        e("div", { style:{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" } },
          btn("🖨 Print / Save as PDF", printLetter, "#2D7A65"),
          btn("Copy letter", function(){ copy((gen.letter && gen.letter.body) || ""); }, "#4A4BAE")),
        e("div", { style:{ fontSize:10.5, color:"#9298BC", marginTop:8, lineHeight:1.5 } },
          "Opens a formatted A4 letter with your sign-off and the recipient address for printing or PDF. To send post automatically at scale, a UK mail-merge API (e.g. Stannp or Docmail) can post it for you — a backend step like the deal sync; ask and I'll wire it.")),
      // CALL BRIEF
      card("📞 Call brief (for a person to phone with)",
        gen.callScript && e("div", null,
          e("div", { style:{ fontSize:12, fontWeight:700, color:"#4A4BAE", marginBottom:4 } }, "Opening"),
          outBox(gen.callScript.opening || ""),
          e("div", { style:{ fontSize:12, fontWeight:700, color:"#4A4BAE", margin:"12px 0 4px" } }, "Talking points"),
          e("ul", { style:{ margin:"0 0 4px 18px", padding:0, fontSize:13, color:"#2E2F8A", lineHeight:1.6 } }, (gen.callScript.points || []).map(function(p, i){ return e("li", { key:i }, p); })),
          e("div", { style:{ fontSize:12, fontWeight:700, color:"#4A4BAE", margin:"12px 0 4px" } }, "Likely objections"),
          (gen.callScript.objections || []).map(function(ob, i){ return e("div", { key:i, style:{ marginBottom:6, fontSize:12.5, color:"#3A3D6A" } }, e("b", null, "“" + (ob.q || "") + "” "), "→ " + (ob.a || "")); }),
          e("div", { style:{ fontSize:12, fontWeight:700, color:"#4A4BAE", margin:"12px 0 4px" } }, "Close"),
          outBox(gen.callScript.close || ""),
          e("div", { style:{ display:"flex", gap:8, marginTop:10 } },
            btn("Copy call brief", function(){ var cs = gen.callScript; copy("OPENING: " + (cs.opening || "") + "\n\nPOINTS:\n- " + (cs.points || []).join("\n- ") + "\n\nOBJECTIONS:\n" + (cs.objections || []).map(function(x){ return "Q: " + x.q + "\nA: " + x.a; }).join("\n") + "\n\nCLOSE: " + (cs.close || "")); }, "#4A4BAE")),
          e("div", { style:{ fontSize:10.5, color:"#9298BC", marginTop:10, lineHeight:1.5 } },
            "For a human caller. Automated / AI voice calls to a landowner who hasn't opted in are restricted (PECR reg 19); if you want click-to-dial or a consented automated call, that's a compliant telephony integration I can scope.")))),

    // ── OUTREACH LOG ──
    card("🗒 Outreach log",
      // next follow-up — surfaced on the Dashboard and portfolio card
      e("div", { style:{ display:"flex", gap:12, alignItems:"flex-end", flexWrap:"wrap", marginBottom:12, paddingBottom:12, borderBottom:"1px solid #EEF0F7" } },
        e("div", { style:{ flex:"0 0 auto" } },
          e("label", { style:S.label }, "Next follow-up"),
          e("input", { type:"date", value:o.followUpDate || "", onChange:function(v){ var val = v.target ? v.target.value : v; setO("followUpDate", val); mirrorFollowup(val, o.followUpNote); }, style:Object.assign({}, S.input, { minWidth:150 }) })),
        e("div", { style:{ flex:"1 1 220px" } },
          e("label", { style:S.label }, "Follow-up note"),
          e("input", { type:"text", value:o.followUpNote || "", onChange:function(ev){ setO("followUpNote", ev.target.value); mirrorFollowup(o.followUpDate, ev.target.value); }, placeholder:"e.g. call the agent back with a revised offer", style:S.input })),
        (o.followUpDate) && e("button", { onClick:function(){ setO("followUpDate", ""); setO("followUpNote", ""); mirrorFollowup("", ""); }, style:{ padding:"8px 12px", background:"transparent", border:"1px solid #DDE0ED", color:"#7278A0", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "Clear")),
      e("div", { style:{ display:"flex", gap:8, alignItems:"flex-end", flexWrap:"wrap", marginBottom:10 } },
        e("div", { style:{ flex:"1 1 240px" } },
          e("label", { style:S.label }, "Log a call or note"),
          e("input", { type:"text", value:callNote, onChange:function(ev){ setCallNote(ev.target.value); },
            onKeyDown:function(ev){ if(ev.key === "Enter"){ ev.preventDefault(); logCall(); } },
            placeholder:"e.g. Spoke to the owner — open to an option, wants £X, call back in 2 wks", style:S.input })),
        e("button", { onClick:logCall, style:{ padding:"9px 16px", background:"#4A4BAE", border:"none", color:"#fff", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "📞 Log call / note")),
      (Array.isArray(o.log) && o.log.length)
        ? e("div", { style:{ display:"flex", flexDirection:"column", gap:6 } },
            o.log.map(function(en, i){
              var ic = en.channel === "email" ? "✉" : en.channel === "letter" ? "✉📮" : en.channel === "call" ? "📞" : "•";
              var col = en.channel === "email" ? "#2D7A65" : en.channel === "letter" ? "#9A7B3E" : "#4A4BAE";
              return e("div", { key:i, style:{ display:"flex", gap:10, alignItems:"baseline", fontSize:12, color:"#3A3D6A", borderLeft:"3px solid " + col, background:"#F7F8FC", borderRadius:"0 6px 6px 0", padding:"7px 10px" } },
                e("span", { style:{ fontWeight:800, color:col, minWidth:64 } }, ic + " " + (en.channel || "").toUpperCase()),
                e("span", { style:{ flex:1 } }, (en.note || "") + (en.to ? " · " + en.to : "")),
                e("span", { style:{ fontSize:10.5, color:"#9298BC", whiteSpace:"nowrap" } }, fmtLogTime(en.ts)));
            }))
        : e("div", { style:{ fontSize:12, color:"#9298BC", fontStyle:"italic" } }, "No outreach yet — sending an email, printing a letter or logging a call records it here (saved on the deal)."))
  );
}
