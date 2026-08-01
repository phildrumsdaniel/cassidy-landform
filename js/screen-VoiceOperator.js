// ── renderVoiceOperator (v10.204) — VOICE-MODE INTAKE / "TALK TO LANDFORM" ─────────────────
// Once a site is in Landform (typed in or loaded from a Placona search), the operator hits Start and
// Landform SPEAKS a series of questions — intention → current status → constraints → ownership → land
// agent → scheme → exit — and the user answers OUT LOUD. The spoken answers are captured (Web Speech
// API), assembled into a brief, and handed to Keystone, which builds the whole scheme through the one
// tested engine, ready to Complete-with-AI (DD, priced mix) and print the marketing / stakeholder /
// approach reports. Graceful fallback: no speech support → the same guided Q&A, typed.
// Rendered as a nested component so it owns its own hook state. Uses globals: e, S, num, fmt, callAI,
// buildDealFromBrief, KEYSTONE_BRIEF_SCHEMA, notify, useState, React.

var VOICE_QS = [
  { key:"intention",      q:"What's your intention for this land? In a sentence — what would you like to do with it?", hint:"e.g. build out for private sale · an affordable-led scheme · forward-fund build-to-rent · promote and sell with planning" },
  { key:"planningStatus", q:"What's the current planning status?", hint:"no allocation · allocated in the local plan · outline consent · full consent · refused or stalled" },
  { key:"scheme",         q:"Roughly how many homes, and what type — houses, apartments, or student accommodation?", hint:"e.g. about 120 homes, mostly family houses" },
  { key:"constraints",    q:"Are there any known constraints on the site?", hint:"flood zone · green belt · heritage / listed · access or ransom strip · ecology / BNG · contamination · services" },
  { key:"ownership",      q:"Who owns the land, and what's your position — freehold, an option, or a promotion agreement?", hint:"vendor name + how you control it" },
  { key:"agent",          q:"Is there a land agent or vendor contact you're dealing with?", hint:"name, firm, phone or email" },
  { key:"price",          q:"What's the asking or guide price, if there is one?", hint:"e.g. offers over four million, or forty-five thousand an acre" },
  { key:"exit",           q:"What's your intended exit?", hint:"open-market sales · bulk sale to a housing association · forward-fund to a pension fund · a joint venture" },
  { key:"affordable",     q:"What affordable-housing percentage should we assume?", hint:"e.g. thirty percent" },
  { key:"notes",          q:"Anything else for the file — timescale, target return, or notes?", hint:"free text" }
];

function renderVoiceOperator(data, setData, navTo, user){
  return e(VoiceOperator, { data:data, setData:setData, navTo:navTo, user:user });
}

function VoiceOperator(props){
  var data = props.data, setData = props.setData, navTo = props.navTo, user = props.user;
  var pS = useState("idle");   var phase = pS[0], setPhase = pS[1];      // idle | interviewing | review | building | done
  var iS = useState(0);        var idx = iS[0], setIdx = iS[1];
  var aS = useState({});       var answers = aS[0], setAnswers = aS[1];
  var lS = useState(false);    var listening = lS[0], setListening = lS[1];
  var vS = useState(true);     var voiceOn = vS[0], setVoiceOn = vS[1];
  var mS = useState("");       var buildMsg = mS[0], setBuildMsg = mS[1];
  var recRef = React.useRef(null);

  var SR = (typeof window !== "undefined") && (window.SpeechRecognition || window.webkitSpeechRecognition);
  var synth = (typeof window !== "undefined") && window.speechSynthesis;
  var L = data.land || {};
  var accent = "#4A4BAE";

  function speak(text){ if(!voiceOn || !synth) return; try{ synth.cancel(); var u = new SpeechSynthesisUtterance(text); u.lang = "en-GB"; u.rate = 1.0; u.pitch = 1.0; synth.speak(u); }catch(e){} }
  function stopSpeak(){ try{ synth && synth.cancel(); }catch(e){} }
  function setAns(key, text){ setAnswers(function(a){ var n = Object.assign({}, a); n[key] = text; return n; }); }
  function appendAns(key, text){ setAnswers(function(a){ var n = Object.assign({}, a); n[key] = ((n[key] || "") + " " + text).trim(); return n; }); }

  function startInterview(){ setPhase("interviewing"); setIdx(0); setAnswers({}); setTimeout(function(){ speak(VOICE_QS[0].q); }, 350); }

  function stopListen(){ try{ recRef.current && recRef.current.stop(); }catch(e){} setListening(false); }
  function toggleListen(){
    if(!SR) return;
    if(listening){ stopListen(); return; }
    var rec; try{ rec = new SR(); }catch(e){ return; }
    rec.lang = "en-GB"; rec.interimResults = false; rec.continuous = true;
    rec.onresult = function(ev){
      var t = ""; for(var i = ev.resultIndex; i < ev.results.length; i++){ if(ev.results[i].isFinal) t += ev.results[i][0].transcript; }
      if(t){ appendAns(VOICE_QS[idx].key, t.trim()); }
    };
    rec.onend = function(){ setListening(false); };
    rec.onerror = function(){ setListening(false); };
    recRef.current = rec;
    try{ stopSpeak(); rec.start(); setListening(true); }catch(e){ setListening(false); }
  }

  function goTo(ni){ stopListen(); setIdx(ni); setTimeout(function(){ speak(VOICE_QS[ni].q); }, 250); }
  function next(){ stopListen(); if(idx < VOICE_QS.length - 1) goTo(idx + 1); else { stopSpeak(); setPhase("review"); } }
  function prev(){ if(idx > 0) goTo(idx - 1); }

  async function buildFromVoice(){
    setPhase("building"); setBuildMsg("Assembling the brief from your answers…");
    var existing = [];
    if(L.address) existing.push("Site: " + L.address);
    if(L.city) existing.push("Location: " + cityName(L.city));
    if(L.postcode) existing.push("Postcode: " + L.postcode);
    if(num(L.acres) > 0) existing.push("Site area: " + L.acres + " acres");
    if(num(L.price) > 0) existing.push("Asking / guide price: £" + num(L.price).toLocaleString());
    var qa = VOICE_QS.map(function(q){ return "Q: " + q.q + "\nA: " + ((answers[q.key] || "").trim() || "(no answer given)"); }).join("\n\n");
    var source = "=== VOICE INTAKE — spoken interview with the Landform operator ===\n" + (existing.length ? existing.join("\n") + "\n\n" : "") + qa;
    // 1) keep the transcript in Keystone's source, appended (never destroys existing source)
    setData(function(d){ return Object.assign({}, d, { keystone:Object.assign({}, d.keystone || {}, { source:((d.keystone && d.keystone.source) ? d.keystone.source + "\n\n" : "") + source }) }); });
    try{
      // 2) AI extraction — the SAME prompt Keystone uses, so the brief is built identically
      setBuildMsg("Landform is reading your answers and writing the deal brief…");
      var schemaKeys = Object.keys(KEYSTONE_BRIEF_SCHEMA).map(function(f){ return f + ": " + KEYSTONE_BRIEF_SCHEMA[f]; }).join("\n");
      var sys = "You are a UK residential development analyst building a deal brief for the Landform appraisal tool. Extract ONLY facts that are present or clearly implied. Do NOT invent figures. Output STRICT JSON only — no prose, no markdown fences.";
      var prompt = "From the SOURCE below (a spoken intake interview), produce a single JSON object for this Landform deal brief. Use these fields (omit any you can't fill):\n\n" + schemaKeys +
        "\n\nRules: numbers as numbers (no £ or commas); houseMix and rents as arrays; put anything you assumed into an 'assumptions' array; choose assetType from the stated intention/exit if obvious (houses→sfh, apartments to rent→btr, student→pbsa, promote-and-sell→land), else leave it out; from the intended exit set a sensible note. POSTCODE is the biggest valuation driver — if no postcode is given but a place is named, infer the outcode (e.g. 'TN12') and set postcodeInferred:true." +
        "\n\nSOURCE:\n" + source.substring(0, 12000);
      var res = await callAI(user, "keystone", sys, prompt);
      var s2 = res.indexOf("{"), e3 = res.lastIndexOf("}");
      var brief = JSON.parse((s2 >= 0 && e3 > s2) ? res.substring(s2, e3 + 1) : res);
      // 3) don't lose facts already on the deal
      if(!brief.acres && num(L.acres) > 0) brief.acres = num(L.acres);
      if(!brief.askingPrice && num(L.price) > 0) brief.askingPrice = num(L.price);
      if(!brief.postcode && L.postcode) brief.postcode = L.postcode;
      if(!brief.address && (L.address || data.dealName)) brief.address = L.address || data.dealName;
      // 4) build the whole deal through the tested engine
      setBuildMsg("Building the scheme through the engine…");
      var deal = buildDealFromBrief(brief);
      setData(function(prev){ return Object.assign({}, deal, { _raw:prev._raw,
        keystone:Object.assign({}, prev.keystone || {}, { brief:JSON.stringify(brief, null, 2), source:(prev.keystone && prev.keystone.source) || source, builtJourney:deal.assetType, builtAt:Date.now(), fromVoice:true }) }); });
      setPhase("done");
    }catch(err){
      setPhase("review");
      if(typeof notify === "function") notify("Couldn't build automatically (" + err.message + ").\n\nYour answers are saved into Keystone — open Keystone and press ‘Extract brief with AI’, then ‘Build deal’.");
    }
  }

  // ── shared bits ──
  var micSupported = !!SR, voiceSupported = !!synth;
  function pill(txt, col){ return e("span", { style:{ fontSize:10, fontWeight:800, color:col, background:col + "14", border:"1px solid " + col + "44", borderRadius:20, padding:"3px 10px" } }, txt); }

  // ── IDLE ──
  if(phase === "idle"){
    return e("div", null,
      e("h2", { style:{ fontSize:24, fontWeight:800, color:accent, marginBottom:4 } }, "🎙 Voice Operator — talk to Landform"),
      e("p", { style:{ fontSize:12, color:"#7278A0", marginBottom:16, lineHeight:1.6, maxWidth:720 } },
        "Press Start and Landform will ask you a series of questions out loud — your intention for the land, its current status, constraints, ownership, the land agent, the scheme and the exit. Answer by speaking; Landform captures it, then Keystone builds the whole scheme, ready to complete the due diligence and print the marketing, stakeholder and approach reports."),
      e("div", { style:{ background:"#F7F8FC", border:"1px solid #DDE0ED", borderRadius:10, padding:"16px 18px", marginBottom:16 } },
        e("div", { style:{ fontSize:11, fontWeight:800, color:accent, marginBottom:8, textTransform:"uppercase", letterSpacing:".08em" } }, "This site"),
        e("div", { style:{ fontSize:13, color:"#2E2F8A", fontWeight:700 } }, (L.address || data.dealName || (L.city ? cityName(L.city) : "New site — nothing entered yet"))),
        e("div", { style:{ fontSize:11, color:"#7278A0", marginTop:4 } },
          [ (L.postcode ? L.postcode : null), (num(L.acres) > 0 ? L.acres + " acres" : null), (num(L.price) > 0 ? "£" + num(L.price).toLocaleString() : null) ].filter(Boolean).join(" · ") || "The interview will capture the details you speak."),
        e("div", { style:{ marginTop:10, display:"flex", gap:8, flexWrap:"wrap" } },
          voiceSupported ? pill("🔊 Landform will speak", "#2D7A65") : pill("🔇 Speech output not available — questions shown as text", "#9A7B3E"),
          micSupported ? pill("🎤 Voice answers on", "#2D7A65") : pill("⌨ No mic in this browser — type answers", "#9A7B3E"))
      ),
      e("div", { style:{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" } },
        e("button", { onClick:startInterview, style:{ padding:"14px 28px", background:accent, border:"none", color:"#fff", borderRadius:10, fontSize:16, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif", boxShadow:"0 4px 14px rgba(74,75,174,0.3)" } }, "▶  Start the interview"),
        voiceSupported && e("label", { style:{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#7278A0", cursor:"pointer" } },
          e("input", { type:"checkbox", checked:voiceOn, onChange:function(ev){ setVoiceOn(ev.target.checked); }, style:{ width:15, height:15, cursor:"pointer" } }), "Read questions aloud"))
    );
  }

  // ── BUILDING ──
  if(phase === "building"){
    return e("div", { style:{ textAlign:"center", padding:"60px 20px" } },
      e("div", { style:{ fontSize:38, marginBottom:14 } }, "🏗"),
      e("div", { style:{ fontSize:16, fontWeight:800, color:accent, marginBottom:8 } }, "Building your scheme…"),
      e("div", { style:{ fontSize:13, color:"#7278A0" } }, buildMsg || "Working…"));
  }

  // ── DONE ──
  if(phase === "done"){
    return e("div", { style:{ padding:"24px 20px", maxWidth:640 } },
      e("div", { style:{ fontSize:36, marginBottom:10 } }, "✅"),
      e("h2", { style:{ fontSize:22, fontWeight:800, color:"#1B7A54", marginBottom:6 } }, "Scheme built from your answers"),
      e("p", { style:{ fontSize:13, color:"#5A5F86", lineHeight:1.6, marginBottom:18 } },
        "Landform built the deal through the one tested engine. Next, let Keystone complete it — price and optimise the mix, add the due diligence it can, then print the marketing, stakeholder and approach reports."),
      e("div", { style:{ display:"flex", gap:10, flexWrap:"wrap" } },
        e("button", { onClick:function(){ navTo("keystone"); }, style:{ padding:"12px 22px", background:"#2D7A65", border:"none", color:"#fff", borderRadius:8, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "🤖 Complete with AI & reports in Keystone →"),
        e("button", { onClick:function(){ navTo("dashboard"); }, style:{ padding:"12px 22px", background:"#fff", border:"1px solid #4A4BAE", color:"#4A4BAE", borderRadius:8, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "Go to the Deal Dashboard →"),
        e("button", { onClick:function(){ setPhase("review"); }, style:{ padding:"12px 18px", background:"transparent", border:"1px solid #DDE0ED", color:"#7278A0", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "↺ Review my answers")));
  }

  // ── REVIEW ──
  if(phase === "review"){
    return e("div", null,
      e("h2", { style:{ fontSize:22, fontWeight:800, color:accent, marginBottom:4 } }, "Review your answers"),
      e("p", { style:{ fontSize:12, color:"#7278A0", marginBottom:16 } }, "Edit anything before Keystone builds the scheme. Blank answers are fine — Keystone fills sensible defaults and flags them."),
      VOICE_QS.map(function(q, qi){
        return e("div", { key:q.key, style:{ marginBottom:12 } },
          e("div", { style:{ fontSize:12, fontWeight:700, color:"#2E2F8A", marginBottom:4 } }, (qi + 1) + ". " + q.q),
          e("textarea", { value:answers[q.key] || "", onChange:function(ev){ setAns(q.key, ev.target.value); }, placeholder:q.hint,
            style:{ width:"100%", minHeight:46, padding:"8px 11px", border:"1px solid #DDE0ED", borderRadius:7, fontSize:13, color:"#2E2F8A", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical" } }));
      }),
      e("div", { style:{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap" } },
        e("button", { onClick:buildFromVoice, style:{ padding:"12px 24px", background:"#2D7A65", border:"none", color:"#fff", borderRadius:8, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "🏗 Build the scheme with Keystone"),
        e("button", { onClick:function(){ setPhase("interviewing"); setIdx(0); }, style:{ padding:"12px 18px", background:"transparent", border:"1px solid #DDE0ED", color:"#7278A0", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "↺ Ask me again")));
  }

  // ── INTERVIEWING ──
  var cur = VOICE_QS[idx];
  return e("div", null,
    e("div", { style:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 } },
      e("h2", { style:{ fontSize:20, fontWeight:800, color:accent, margin:0 } }, "🎙 Landform is asking…"),
      e("div", { style:{ display:"flex", gap:8, alignItems:"center" } },
        e("span", { style:{ fontSize:11, color:"#7278A0", fontWeight:700 } }, "Question " + (idx + 1) + " of " + VOICE_QS.length),
        voiceSupported && e("button", { onClick:function(){ setVoiceOn(!voiceOn); }, title:"Toggle spoken questions",
          style:{ padding:"4px 9px", background:voiceOn ? "#EDEEF9" : "#F7F8FC", border:"1px solid #DDE0ED", borderRadius:6, fontSize:11, fontWeight:700, color:"#4A4BAE", cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, voiceOn ? "🔊 On" : "🔇 Off"))),
    // progress bar
    e("div", { style:{ height:5, background:"#E7E9F4", borderRadius:3, marginBottom:16, overflow:"hidden" } },
      e("div", { style:{ height:"100%", width:((idx + 1) / VOICE_QS.length * 100) + "%", background:"linear-gradient(90deg,#4A4BAE,#2D7A65)", transition:"width .3s" } })),
    // the question
    e("div", { style:{ background:"linear-gradient(135deg,#F4F5FF,#F0F8F4)", border:"1px solid #DDE0ED", borderRadius:12, padding:"22px 24px", marginBottom:14 } },
      e("div", { style:{ fontSize:18, fontWeight:800, color:"#2E2F8A", lineHeight:1.45, marginBottom:6 } }, cur.q),
      e("div", { style:{ fontSize:12, color:"#7278A0", fontStyle:"italic" } }, cur.hint),
      voiceSupported && e("button", { onClick:function(){ speak(cur.q); }, style:{ marginTop:10, padding:"5px 11px", background:"#fff", border:"1px solid #C5C8E0", borderRadius:6, fontSize:11, fontWeight:700, color:"#4A4BAE", cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "🔊 Repeat the question")),
    // answer capture
    e("div", { style:{ marginBottom:14 } },
      e("div", { style:{ display:"flex", gap:10, alignItems:"center", marginBottom:8, flexWrap:"wrap" } },
        micSupported
          ? e("button", { onClick:toggleListen, style:{ padding:"11px 20px", background:listening ? "#B05A35" : "#2D7A65", border:"none", color:"#fff", borderRadius:8, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, listening ? "⏹ Stop & keep" : "🎤 Speak your answer")
          : e("span", { style:{ fontSize:12, color:"#9A7B3E", fontWeight:700 } }, "⌨ Type your answer below"),
        listening && e("span", { style:{ fontSize:12, color:"#B05A35", fontWeight:800 } }, "● Listening…")),
      e("textarea", { value:answers[cur.key] || "", onChange:function(ev){ setAns(cur.key, ev.target.value); }, placeholder:"Your answer — speak it, or type / edit here.",
        style:{ width:"100%", minHeight:70, padding:"10px 13px", border:"1px solid #C5C8E0", borderRadius:8, fontSize:14, color:"#2E2F8A", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical" } })),
    // nav
    e("div", { style:{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 } },
      e("button", { onClick:prev, disabled:idx === 0, style:{ padding:"10px 18px", background:"transparent", border:"1px solid #DDE0ED", color:"#7278A0", borderRadius:7, fontSize:13, fontWeight:700, cursor:idx === 0 ? "not-allowed" : "pointer", opacity:idx === 0 ? 0.4 : 1, fontFamily:"DM Sans,sans-serif" } }, "← Back"),
      e("div", { style:{ display:"flex", gap:10 } },
        e("button", { onClick:function(){ setAns(cur.key, answers[cur.key] || ""); next(); }, style:{ padding:"10px 18px", background:"transparent", border:"1px solid #DDE0ED", color:"#7278A0", borderRadius:7, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "Skip"),
        e("button", { onClick:next, style:{ padding:"10px 24px", background:accent, border:"none", color:"#fff", borderRadius:7, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, idx === VOICE_QS.length - 1 ? "Finish & review →" : "Next question →"))));
}
