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

// v10.216 — persist the conversation so switching tabs / an auto-reload doesn't lose it.
var VOICE_STATE_KEY = "cassidy_voice_state";
function loadVoiceState(){ try{ return JSON.parse(localStorage.getItem(VOICE_STATE_KEY) || "null") || {}; }catch(e){ return {}; } }

function VoiceOperator(props){
  var data = props.data, setData = props.setData, navTo = props.navTo, user = props.user;
  var _saved = loadVoiceState();
  var pS = useState(function(){ var v = _saved.phase; return (v === "converse" || v === "review") ? v : "idle"; });   var phase = pS[0], setPhase = pS[1];      // idle | interviewing | review | building | done
  var iS = useState(function(){ return _saved.idx || 0; });        var idx = iS[0], setIdx = iS[1];
  var aS = useState(function(){ return _saved.answers || {}; });   var answers = aS[0], setAnswers = aS[1];
  var lS = useState(false);    var listening = lS[0], setListening = lS[1];
  var vS = useState(true);     var voiceOn = vS[0], setVoiceOn = vS[1];
  var mS = useState("");       var buildMsg = mS[0], setBuildMsg = mS[1];
  var cS = useState(function(){ return _saved.messages || []; });   var messages = cS[0], setMessages = cS[1];   // free-conversation thread [{role,text}]
  var thS = useState(false);   var thinking = thS[0], setThinking = thS[1];
  var dS = useState("");       var draft = dS[0], setDraft = dS[1];
  var brS = useState(function(){ return _saved.runningBrief || {}; });   var runningBrief = brS[0], setRunningBrief = brS[1];   // accumulates as the chat goes
  var fgS = useState(function(){ return _saved.figures || null; });    var figures = fgS[0], setFigures = fgS[1];            // live engine read
  var vnS = useState(function(){ try{ return localStorage.getItem("cassidy_voice_name") || ""; }catch(e){ return ""; } });
  var voiceName = vnS[0], setVoiceName = vnS[1];
  var tkS = useState(0);       var voicesTick = tkS[0], setVoicesTick = tkS[1];      // bumped when the browser's voices load
  var hfS = useState(false);   var handsFree = hfS[0], setHandsFree = hfS[1];        // continuous hands-free conversation
  var recRef = React.useRef(null);
  var hfRef = React.useRef(false);   // live handsFree flag for async callbacks
  var uttRef = React.useRef(null);   // retain the utterance so Chrome doesn't GC it (else onend never fires)
  var sendRef = React.useRef(null);  // latest sendMessage — async speech callbacks must not use a stale closure
  var listenRef = React.useRef(null);// latest startHFListen, same reason

  // Browser voices load asynchronously — re-render when they arrive so the picker + best-voice work.
  useEffect(function(){
    if(typeof window === "undefined" || !window.speechSynthesis) return;
    var h = function(){ setVoicesTick(function(x){ return x + 1; }); };
    try{ window.speechSynthesis.onvoiceschanged = h; }catch(e){}
    try{ window.speechSynthesis.getVoices(); }catch(e){}   // prime it
    return function(){ try{ window.speechSynthesis.onvoiceschanged = null; }catch(e){} };
  }, []);
  // stop Ronald talking/listening when you leave the screen (unmount)
  useEffect(function(){ return function(){ hfRef.current = false; try{ recRef.current && recRef.current.stop(); }catch(e){} try{ if(window.speechSynthesis) window.speechSynthesis.cancel(); }catch(e){} }; }, []);
  function allVoices(){ try{ return (window.speechSynthesis.getVoices() || []).filter(function(v){ return /^en/i.test(v.lang || ""); }); }catch(e){ return []; } }
  // pick the most natural available voice — prefer en-GB, then neural/natural/Google/premium, then a
  // male-leaning name (Ronald is a chap). Browser TTS quality is capped by the installed voices; the
  // Google / "Natural" ones (Chrome/Edge desktop) and Siri voices (Apple) are far less robotic.
  function bestVoice(){
    var vs = allVoices(); if(!vs.length) return null;
    function score(v){
      var n = (v.name || "").toLowerCase(), lang = (v.lang || "").toLowerCase(), s = 0;
      if(lang.indexOf("en-gb") === 0) s += 40; else if(lang.indexOf("en") === 0) s += 18;
      if(/natural|neural|premium|enhanced/.test(n)) s += 34;
      if(/google/.test(n)) s += 22;
      if(/\b(daniel|arthur|george|ryan|oliver|male)\b/.test(n)) s += 16;   // male-leaning for "Ronald"
      if(/siri|serena|sonia|libby|ryan/.test(n)) s += 6;
      if(/compact|espeak|robot/.test(n)) s -= 30;
      return s;
    }
    return vs.slice().sort(function(a, b){ return score(b) - score(a); })[0] || vs[0];
  }
  function currentVoice(){ var vs = allVoices(); var m = voiceName ? vs.filter(function(v){ return v.name === voiceName; })[0] : null; return m || bestVoice(); }
  function voicePicker(){
    var vs = allVoices(); if(!vs.length) return null;
    var cur = currentVoice(), curName = cur ? cur.name : "";
    return e("label", { style:{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#7278A0" } }, "Ronald's voice",
      e("select", { value:voiceName || curName,
        onChange:function(ev){ var v = ev.target.value; setVoiceName(v); try{ localStorage.setItem("cassidy_voice_name", v); }catch(e){}
          var t = allVoices().filter(function(x){ return x.name === v; })[0]; if(t && synth){ try{ synth.cancel(); var u = new SpeechSynthesisUtterance("Hello, I'm Ronald."); u.voice = t; u.rate = 0.97; synth.speak(u); }catch(e){} } },
        style:{ padding:"5px 8px", border:"1px solid #C5C8E0", borderRadius:6, fontSize:12, fontFamily:"DM Sans,sans-serif", maxWidth:230 } },
        vs.map(function(v){ return e("option", { key:v.name, value:v.name }, v.name.replace(/\(.*?\)/g, "").trim() + " · " + v.lang); })));
  }

  // persist the live conversation so a tab switch / auto-reload restores it (cleared once built)
  useEffect(function(){
    try{
      if(phase === "done"){ localStorage.removeItem(VOICE_STATE_KEY); return; }
      var ph = (phase === "building") ? "converse" : phase;
      localStorage.setItem(VOICE_STATE_KEY, JSON.stringify({ phase:ph, messages:messages, figures:figures, runningBrief:runningBrief, answers:answers, idx:idx }));
    }catch(e){}
  }, [phase, messages, figures, runningBrief, answers, idx]);

  function parseJson(res){ var a = res.indexOf("{"), b = res.lastIndexOf("}"); return JSON.parse((a >= 0 && b > a) ? res.substring(a, b + 1) : res); }
  function fmtM(n){ return (typeof fmtCompact === "function") ? fmtCompact(num(n)) : String(Math.round(num(n))); }
  // Run the SAME engine as the rest of Landform on the facts gathered so far, so the operator can quote
  // live figures mid-conversation (residual land value, GDV, margin, land by exit) that update as you talk.
  function computeLiveFigures(brief){
    try{
      if(typeof buildDealFromBrief !== "function" || typeof calcDealMetrics !== "function") return null;
      var deal = buildDealFromBrief(brief || {});
      var M = calcDealMetrics(deal);
      if(!(num(M.gdv) > 0)) return null;
      var EX = (typeof dealExit === "function") ? dealExit(deal) : {};
      var al = (typeof afterLandMargin === "function") ? afterLandMargin(deal) : null;
      var lp = num(deal.land && deal.land.price);
      return {
        assetType:deal.assetType, units:num(M.units), gdv:num(M.gdv), devCost:num(M.devCost),
        rlv:num(EX.chosenRlv) || num(M.rlv), plotRlv:num(EX.plotRlv), haBulkRlv:num(EX.haBulkRlv), capRlv:num(EX.capRlv),
        landPrice:lp, hasAsk:lp > 0,
        marginPct:(al && al.hasAsk) ? num(al.marginPct) : num(M.profitPctTarget),
        afterLandProfit:(al && al.hasAsk) ? num(al.profit) : num(M.profit),
        ahPct:num(deal.planning && deal.planning.ahPct) || num(brief && brief.affordablePct) || 0
      };
    }catch(e){ return null; }
  }

  var SR = (typeof window !== "undefined") && (window.SpeechRecognition || window.webkitSpeechRecognition);
  var synth = (typeof window !== "undefined") && window.speechSynthesis;
  var L = data.land || {};
  var accent = "#4A4BAE";

  function speak(text, onDone){
    if(!voiceOn || !synth){ if(onDone) setTimeout(onDone, 60); return; }
    var done = false;
    function finish(){ if(done) return; done = true; if(onDone){ try{ onDone(); }catch(e){} } }
    try{
      synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var vc = currentVoice(); if(vc){ u.voice = vc; u.lang = vc.lang || "en-GB"; } else { u.lang = "en-GB"; }
      u.rate = 0.97; u.pitch = 1.0;
      u.onend = finish; u.onerror = finish;
      uttRef.current = u;   // keep a live reference — Chrome GCs utterances and then onend never fires
      synth.speak(u);
      // Watchdog: onend is unreliable in several browsers. Poll speaking-state so the callback
      // (which reopens the mic in hands-free mode) ALWAYS runs — otherwise the loop freezes.
      if(onDone){
        var started = false, waited = 0;
        var iv = setInterval(function(){
          if(done){ clearInterval(iv); return; }
          waited += 300;
          var sp = false; try{ sp = synth.speaking; }catch(e){}
          if(sp) started = true;
          // finish when: it spoke and has now stopped · it never started within 2.5s (utterance dropped) · hard cap
          if((started && !sp) || (!started && waited >= 2500) || waited > 90000){ clearInterval(iv); finish(); }
        }, 300);
      }
    }catch(e){ finish(); }
  }
  // HANDS-FREE: after Ronald finishes speaking, listen; when you stop talking, auto-send; repeat.
  function startHFListen(){
    if(!SR || !hfRef.current) return;
    // If Ronald is still talking, don't dead-end — wait and try again so the loop never stalls.
    try{ if(synth && synth.speaking){ setTimeout(function(){ if(hfRef.current) (listenRef.current || startHFListen)(); }, 300); return; } }catch(e){}
    var rec; try{ rec = new SR(); }catch(e){ return; }
    rec.lang = "en-GB"; rec.interimResults = false; rec.continuous = false; var got = false;
    rec.onresult = function(ev){ var t = ""; for(var i = ev.resultIndex; i < ev.results.length; i++){ if(ev.results[i].isFinal) t += ev.results[i][0].transcript; } t = t.trim(); if(t){ got = true; setListening(false); (sendRef.current || sendMessage)(t); } };
    rec.onerror = function(){ setListening(false); };
    rec.onend = function(){ setListening(false); if(hfRef.current && !got){ setTimeout(function(){ if(hfRef.current && !(synth && synth.speaking)) (listenRef.current || startHFListen)(); }, 350); } };
    recRef.current = rec; try{ rec.start(); setListening(true); }catch(e){ setListening(false); }
  }
  function startHands(){ setHandsFree(true); hfRef.current = true; if(!messages.length){ startConversation(); } else { stopSpeak(); startHFListen(); } }
  function stopHands(){ setHandsFree(false); hfRef.current = false; stopListen(); stopSpeak(); }
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

  function assembleSiteFacts(){
    var existing = [];
    if(L.address) existing.push("Site: " + L.address);
    if(L.city) existing.push("Location: " + cityName(L.city));
    if(L.postcode) existing.push("Postcode: " + L.postcode);
    if(num(L.acres) > 0) existing.push("Site area: " + L.acres + " acres");
    if(num(L.price) > 0) existing.push("Asking / guide price: £" + num(L.price).toLocaleString());
    return existing;
  }

  // Scripted interview → build
  function buildFromVoice(){
    var qa = VOICE_QS.map(function(q){ return "Q: " + q.q + "\nA: " + ((answers[q.key] || "").trim() || "(no answer given)"); }).join("\n\n");
    var facts = assembleSiteFacts();
    runBuildFromSource("=== VOICE INTAKE — spoken interview with the Landform operator ===\n" + (facts.length ? facts.join("\n") + "\n\n" : "") + qa);
  }

  // Shared build pipeline — extract → build → price → DD → commit — from any transcript source.
  async function runBuildFromSource(source){
    setPhase("building"); setBuildMsg("Assembling the brief from your answers…");
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
      // 4) build the whole deal through the tested engine (local, so the completion chain below
      //    reads a live deal, not stale React state — we commit once at the end)
      setBuildMsg("Building the scheme through the engine…");
      var deal = buildDealFromBrief(brief);

      // 5) KEYSTONE COMPLETION — price & optimise the house mix from current market listings
      if(deal.sfh && deal.sfh.mix && deal.sfh.mix.length && typeof applyMarketPricesAndOptimise === "function"){
        try{
          setBuildMsg("Researching current market prices & rents…");
          var sfh0 = deal.sfh, sc = sfh0.city || (deal.land && deal.land.city) || "", pc = (deal.land && deal.land.postcode) || "";
          var typeList = sfh0.mix.filter(function(r){ return num(r.count) > 0; }).map(function(r){ return r.type; }).filter(function(v, i, a){ return v && a.indexOf(v) === i; });
          var psys = "You are a UK new-build residential valuer. Base every figure on what is ACTUALLY on the market RIGHT NOW — current Rightmove / Zoopla listings for new or nearly-new stock in THIS postcode area, not national averages. New-build commands a premium; reflect it. Output STRICT JSON only.";
          var pprompt = "For NEW-BUILD homes in " + (cityName(sc) || "the area") + " (" + (pc || "postcode unknown") + "), give the CURRENT market SALE PRICE and monthly ASKING RENT for each type: " + typeList.join(", ") +
            ". Price/rent as HOUSES. Output JSON: {\"types\":[{\"type\":\"<name>\",\"beds\":<n>,\"sqft\":<n>,\"salePrice\":<n>,\"rentPcm\":<n>}]}. Numbers only.";
          var pres = await callAI(user, "keystone", psys, pprompt);
          var aiTypes = (parseJson(pres).types) || [];
          var out = applyMarketPricesAndOptimise(deal, aiTypes, { optimise:true });
          if(out.applied){ deal.sfh = out.data.sfh; deal.capitalise = out.data.capitalise || deal.capitalise; }
        }catch(e){ /* keep the table baseline if research fails */ }
      }

      // 6) KEYSTONE JOURNEY FILLERS — add the DD it can (Planning, Exit, Grants, Constraints…)
      var fillers = (typeof KEYSTONE_JOURNEY_FILLERS !== "undefined") ? KEYSTONE_JOURNEY_FILLERS : [];
      for(var fi = 0; fi < fillers.length; fi++){
        var f = fillers[fi];
        setBuildMsg("Adding due diligence — " + f.label + "… (" + (fi + 1) + " of " + fillers.length + ")");
        try{
          var fres = await callAI(user, "keystone", f.sys, f.prompt(deal));
          var fobj = parseJson(fres);
          f.apply(deal, fobj);   // mutates the local deal
        }catch(e){ /* skip this stage, keep going */ }
      }

      // 7) commit the fully-built, priced, DD-filled deal in one write
      setBuildMsg("Finishing up…");
      setData(function(prev){ return Object.assign({}, deal, { _raw:prev._raw,
        keystone:Object.assign({}, prev.keystone || {}, { brief:JSON.stringify(brief, null, 2), source:(prev.keystone && prev.keystone.source) || source, builtJourney:deal.assetType, builtAt:Date.now(), fromVoice:true, autoCompleted:true }) }); });
      setPhase("done");
    }catch(err){
      setPhase("review");
      if(typeof notify === "function") notify("Couldn't build automatically (" + err.message + ").\n\nYour answers are saved into Keystone — open Keystone and press ‘Extract brief with AI’, then ‘Build deal’.");
    }
  }

  // ── FREE CONVERSATION MODE ──────────────────────────────────────────────────
  // A real back-and-forth: the operator answers questions, gives a candid view on the user's thinking,
  // draws out what it needs, and folds every point/request into the transcript that builds the scheme.
  function liveReadLine(fig){
    if(!fig || !(fig.gdv > 0)) return "";
    var parts = [];
    if(fig.units > 0) parts.push("~" + Math.round(fig.units) + " units");
    parts.push("GDV ~£" + fmtM(fig.gdv));
    parts.push("residual land value ~£" + fmtM(fig.rlv));
    if(fig.ahPct > 0) parts.push(Math.round(fig.ahPct) + "% affordable");
    if(fig.hasAsk) parts.push("at the £" + fmtM(fig.landPrice) + " guide the developer margin is ~" + Math.round(fig.marginPct) + "%");
    else parts.push("target margin " + Math.round(fig.marginPct) + "%");
    if(fig.plotRlv || fig.haBulkRlv || fig.capRlv) parts.push("land by exit — open-market plot sales £" + fmtM(fig.plotRlv) + ", bulk sale to an HA £" + fmtM(fig.haBulkRlv) + ", forward-fund £" + fmtM(fig.capRlv));
    return parts.join("; ");
  }
  function convoSystem(facts, fig){
    var s = "You are Ronald, the Landform voice operator — a sharp, candid UK land & development advisor for Cassidy Group, " +
      "having a SPOKEN conversation with a developer about a specific site. Be natural and concise — 2 to 4 short " +
      "sentences, because your reply is read aloud. As it flows, do three things: (1) ANSWER their questions with " +
      "practical, numerate UK planning / development / finance knowledge; (2) give a STRAIGHT view on their thinking — " +
      "name the risk and the upside, don't just agree; (3) DRAW OUT what's needed to appraise and build the scheme " +
      "(intention, planning status, size & mix, constraints, ownership, land agent, price, exit, affordable %), " +
      "conversationally — a point or two at a time, never a checklist. Acknowledge any request they make so it's built " +
      "in. When they're ready or say 'build it', tell them you'll build the scheme now. " +
      "Known site facts: " + (facts || "none entered yet") + ".";
    var read = liveReadLine(fig);
    if(read) s += " LIVE ENGINE READ — Landform has already computed these from the facts so far, so QUOTE THEM when relevant (rounded, as indicative and firming up as you talk); do NOT invent different numbers: " + read + ".";
    else s += " No figures yet — once the homes/acres and location are roughly known, Landform computes the residual live and you should quote it.";
    return s;
  }
  function startConversation(){
    setPhase("converse");
    var opener = "Hello, I'm Ronald, your Landform land advisor. Tell me about this site — what's your thinking, and what would you like to do with it?";
    setMessages([{ role:"assistant", text:opener }]);
    if(SR){ setHandsFree(true); hfRef.current = true; }   // hands-free: just talk, no Send button
    setTimeout(function(){ speak(opener, function(){ if(hfRef.current) (listenRef.current || startHFListen)(); }); }, 350);
  }
  async function sendMessage(text){
    text = (text || "").trim(); if(!text || thinking) return;
    stopListen();
    var hist = messages.concat([{ role:"user", text:text }]);
    setMessages(hist); setDraft(""); setThinking(true);
    var facts = assembleSiteFacts().join("; ");
    var convoText = hist.map(function(m){ return (m.role === "assistant" ? "Operator" : "Developer") + ": " + m.text; }).join("\n");
    // 1) update the running brief from the whole conversation, then run the engine → live figures
    var fig = figures;
    try{
      var schemaKeys = Object.keys(KEYSTONE_BRIEF_SCHEMA).map(function(f){ return f + ": " + KEYSTONE_BRIEF_SCHEMA[f]; }).join("\n");
      var exSys = "You extract a UK residential development brief as STRICT JSON. Only facts stated or clearly implied in the conversation; numbers as numbers (no £ or commas); omit anything unknown; infer the postcode outcode from any named place.";
      var exPrompt = "Known site facts: " + (facts || "none") + "\n\nConversation:\n" + convoText + "\n\nProduce ONE JSON object using these fields (omit unknowns):\n" + schemaKeys + "\nJSON only.";
      var exRes = await callAI(user, "keystone", exSys, exPrompt);
      var merged = Object.assign({}, runningBrief, parseJson(exRes));   // accumulate across turns
      if(!merged.acres && num(L.acres) > 0) merged.acres = num(L.acres);
      if(!merged.askingPrice && num(L.price) > 0) merged.askingPrice = num(L.price);
      if(!merged.postcode && L.postcode) merged.postcode = L.postcode;
      if(!merged.address && (L.address || data.dealName)) merged.address = L.address || data.dealName;
      setRunningBrief(merged);
      var f2 = computeLiveFigures(merged);
      if(f2){ fig = f2; setFigures(f2); }
    }catch(e){ /* keep whatever figures we already had */ }
    // 2) conversational reply, WITH the live figures in context so the operator quotes them
    try{
      var res = await callAI(user, "keystone", convoSystem(facts, fig),
        "Conversation so far:\n" + convoText + "\n\nReply as the Operator now — natural, concise, spoken-friendly. Quote the live figures above when they're relevant to what they just said.");
      var reply = ((res || "").trim()) || "Understood.";
      setMessages(function(m){ return m.concat([{ role:"assistant", text:reply }]); });
      setThinking(false); speak(reply, function(){ if(hfRef.current) (listenRef.current || startHFListen)(); });   // hands-free: listen again after Ronald replies
    }catch(err){
      setThinking(false);
      setMessages(function(m){ return m.concat([{ role:"assistant", text:"Sorry — I didn't catch that (connection issue). Say it again?" }]); });
      if(hfRef.current) setTimeout(function(){ if(hfRef.current) (listenRef.current || startHFListen)(); }, 500);
    }
  }
  // mic for the conversation: dictate into the draft, ready to send
  function toggleConvoListen(){
    if(!SR) return;
    if(listening){ stopListen(); return; }
    var rec; try{ rec = new SR(); }catch(e){ return; }
    rec.lang = "en-GB"; rec.interimResults = false; rec.continuous = true;
    rec.onresult = function(ev){ var t = ""; for(var i = ev.resultIndex; i < ev.results.length; i++){ if(ev.results[i].isFinal) t += ev.results[i][0].transcript; } if(t) setDraft(function(d){ return ((d || "") + " " + t.trim()).trim(); }); };
    rec.onend = function(){ setListening(false); };
    rec.onerror = function(){ setListening(false); };
    recRef.current = rec;
    try{ stopSpeak(); rec.start(); setListening(true); }catch(e){ setListening(false); }
  }
  function buildFromConversation(){
    var facts = assembleSiteFacts();
    var convo = messages.map(function(m){ return (m.role === "assistant" ? "Operator" : "Developer") + ": " + m.text; }).join("\n");
    runBuildFromSource("=== VOICE INTAKE — free conversation with the Landform operator ===\n" + (facts.length ? facts.join("\n") + "\n\n" : "") + convo);
  }

  // Keep the refs pointing at THIS render's closures, so async speech/recognition callbacks
  // always see the current messages/thinking/figures rather than the render they were created in.
  sendRef.current = sendMessage;
  listenRef.current = startHFListen;

  // ── shared bits ──
  var micSupported = !!SR, voiceSupported = !!synth;
  function pill(txt, col){ return e("span", { style:{ fontSize:10, fontWeight:800, color:col, background:col + "14", border:"1px solid " + col + "44", borderRadius:20, padding:"3px 10px" } }, txt); }

  // ── IDLE ──
  if(phase === "idle"){
    return e("div", null,
      e("h2", { style:{ fontSize:24, fontWeight:800, color:accent, marginBottom:4 } }, "🎙 Ronald — your Landform voice operator"),
      e("p", { style:{ fontSize:12, color:"#7278A0", marginBottom:16, lineHeight:1.6, maxWidth:720 } },
        "Talk to Landform out loud, then it builds, prices and due-diligences the whole scheme. Two ways: have a FREE CONVERSATION — think aloud, ask questions, throw in points and requests and the operator answers, gives its view and folds it all in — or a quick GUIDED interview of set questions. Either way it ends with a finished scheme ready for the board, marketing, stakeholder and approach documents."),
      e("div", { style:{ background:"#F7F8FC", border:"1px solid #DDE0ED", borderRadius:10, padding:"16px 18px", marginBottom:16 } },
        e("div", { style:{ fontSize:11, fontWeight:800, color:accent, marginBottom:8, textTransform:"uppercase", letterSpacing:".08em" } }, "This site"),
        e("div", { style:{ fontSize:13, color:"#2E2F8A", fontWeight:700 } }, (L.address || data.dealName || (L.city ? cityName(L.city) : "New site — nothing entered yet"))),
        e("div", { style:{ fontSize:11, color:"#7278A0", marginTop:4 } },
          [ (L.postcode ? L.postcode : null), (num(L.acres) > 0 ? L.acres + " acres" : null), (num(L.price) > 0 ? "£" + num(L.price).toLocaleString() : null) ].filter(Boolean).join(" · ") || "The interview will capture the details you speak."),
        e("div", { style:{ marginTop:10, display:"flex", gap:8, flexWrap:"wrap" } },
          voiceSupported ? pill("🔊 Landform will speak", "#2D7A65") : pill("🔇 Speech output not available — questions shown as text", "#9A7B3E"),
          micSupported ? pill("🎤 Voice answers on", "#2D7A65") : pill("⌨ No mic in this browser — type answers", "#9A7B3E"))
      ),
      e("div", { style:{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:10 } },
        e("button", { onClick:startConversation, style:{ padding:"14px 26px", background:accent, border:"none", color:"#fff", borderRadius:10, fontSize:16, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif", boxShadow:"0 4px 14px rgba(74,75,174,0.3)" } }, "💬  Start a conversation"),
        e("button", { onClick:startInterview, style:{ padding:"14px 24px", background:"#fff", border:"1px solid #C5C8E0", color:accent, borderRadius:10, fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "▶  Quick guided interview"),
        voiceSupported && e("label", { style:{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#7278A0", cursor:"pointer" } },
          e("input", { type:"checkbox", checked:voiceOn, onChange:function(ev){ setVoiceOn(ev.target.checked); }, style:{ width:15, height:15, cursor:"pointer" } }), "Read replies aloud"),
        voiceSupported && voicePicker()),
      e("div", { style:{ fontSize:11, color:"#9298BC", lineHeight:1.5, maxWidth:660 } },
        e("b", null, "Conversation"), " is the natural one — talk freely, ask it anything, and it answers, evaluates and captures every point. ",
        e("b", null, "Guided"), " walks a fixed set of questions if you'd rather be led.")
    );
  }

  // ── CONVERSATION ──
  if(phase === "converse"){
    return e("div", null,
      e("div", { style:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 } },
        e("h2", { style:{ fontSize:20, fontWeight:800, color:accent, margin:0 } }, "💬 Talking to Ronald"),
        e("div", { style:{ display:"flex", gap:8, alignItems:"center" } },
          voiceSupported && voicePicker(),
          voiceSupported && e("button", { onClick:function(){ setVoiceOn(!voiceOn); }, title:"Toggle spoken replies",
            style:{ padding:"4px 9px", background:voiceOn ? "#EDEEF9" : "#F7F8FC", border:"1px solid #DDE0ED", borderRadius:6, fontSize:11, fontWeight:700, color:"#4A4BAE", cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, voiceOn ? "🔊 Speaking" : "🔇 Muted"),
          e("button", { onClick:function(){ stopSpeak(); stopListen(); setMessages([]); setFigures(null); setRunningBrief({}); try{ localStorage.removeItem("cassidy_voice_state"); }catch(e){} startConversation(); }, title:"Start a fresh conversation",
            style:{ padding:"4px 9px", background:"#F7F8FC", border:"1px solid #DDE0ED", borderRadius:6, fontSize:11, fontWeight:700, color:"#7278A0", cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "↺ New"))),
      // message thread
      e("div", { style:{ border:"1px solid #DDE0ED", borderRadius:12, background:"#FAFBFF", padding:"14px 14px", marginBottom:12, maxHeight:"46vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:10 } },
        messages.map(function(m, mi){
          var isA = m.role === "assistant";
          return e("div", { key:mi, style:{ alignSelf:isA ? "flex-start" : "flex-end", maxWidth:"82%" } },
            e("div", { style:{ fontSize:9, fontWeight:800, color:isA ? "#4A4BAE" : "#2D7A65", marginBottom:2, textTransform:"uppercase", letterSpacing:".06em", textAlign:isA ? "left" : "right" } }, isA ? "🎙 Ronald" : "You"),
            e("div", { style:{ fontSize:14, lineHeight:1.5, color:"#2E2F8A", background:isA ? "#fff" : "#EAF4EF", border:"1px solid " + (isA ? "#E0E2EC" : "#CDE7DB"), borderRadius:10, padding:"9px 13px" } }, m.text));
        }),
        thinking && e("div", { style:{ alignSelf:"flex-start", fontSize:12, color:"#9298BC", fontStyle:"italic", padding:"4px 6px" } }, "🎙 Ronald is thinking…")),
      // ── LIVE NUMBERS — the engine run on the facts so far, updating as you talk ──
      (figures && figures.gdv > 0) && e("div", { style:{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:10, padding:"8px 10px", background:"rgba(45,122,101,0.06)", border:"1px solid rgba(45,122,101,0.28)", borderRadius:8 } },
        e("span", { style:{ fontSize:9.5, fontWeight:800, color:"#1B7A54", textTransform:"uppercase", letterSpacing:".06em" } }, "Live figures"),
        figures.units > 0 && e("span", { style:{ fontSize:12, color:"#2E2F8A" } }, Math.round(figures.units) + " units"),
        e("span", { style:{ fontSize:12, color:"#2E2F8A" } }, "GDV £" + fmtM(figures.gdv)),
        e("span", { style:{ fontSize:12, fontWeight:800, color:figures.rlv >= 0 ? "#1B7A54" : "#B05A35" } }, "Residual land £" + (figures.rlv < 0 ? "−" + fmtM(-figures.rlv) : fmtM(figures.rlv))),
        e("span", { style:{ fontSize:12, color:"#2E2F8A" } }, (figures.hasAsk ? "Margin " : "Target ") + Math.round(figures.marginPct) + "%"),
        figures.ahPct > 0 && e("span", { style:{ fontSize:12, color:"#7278A0" } }, Math.round(figures.ahPct) + "% affordable"),
        e("span", { style:{ fontSize:9.5, color:"#9298BC", fontStyle:"italic" } }, "indicative — firms up as you talk")),
      // ── HANDS-FREE bar — just talk; Ronald listens, replies aloud, then listens again ──
      micSupported && e("div", { style:{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginBottom:10, padding:"11px 14px", borderRadius:10, background:handsFree ? (listening ? "rgba(45,122,101,0.10)" : "rgba(74,75,174,0.07)") : "#F7F8FC", border:"1px solid " + (handsFree ? (listening ? "#2D7A65" : "#C5C8E0") : "#DDE0ED") } },
        handsFree
          ? e("button", { onClick:stopHands, style:{ padding:"11px 18px", background:"#B05A35", border:"none", color:"#fff", borderRadius:8, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "⏸ Pause")
          : e("button", { onClick:startHands, style:{ padding:"12px 22px", background:"#2D7A65", border:"none", color:"#fff", borderRadius:8, fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "🎤 Start talking"),
        e("span", { style:{ fontSize:13, fontWeight:800, color:handsFree ? (listening ? "#1B7A54" : thinking ? "#9298BC" : "#4A4BAE") : "#7278A0" } },
          handsFree ? (listening ? "🎤 Listening — just talk, no need to press anything" : thinking ? "🎙 Ronald is thinking…" : "🎙 Ronald is speaking…")
                    : "Hands-free: Ronald listens, answers aloud, then listens again — no Send button.")),
      // typing fallback
      e("div", { style:{ display:"flex", gap:8, alignItems:"flex-end", flexWrap:"wrap" } },
        e("textarea", { value:draft, onChange:function(ev){ setDraft(ev.target.value); },
          onKeyDown:function(ev){ if(ev.key === "Enter" && !ev.shiftKey){ ev.preventDefault(); sendMessage(draft); } },
          placeholder:"…or type here instead",
          style:{ flex:"1 1 260px", minHeight:42, padding:"10px 13px", border:"1px solid #C5C8E0", borderRadius:8, fontSize:14, color:"#2E2F8A", fontFamily:"DM Sans,sans-serif", boxSizing:"border-box", resize:"vertical" } }),
        e("button", { onClick:function(){ sendMessage(draft); }, disabled:thinking || !(draft || "").trim(),
          style:{ padding:"10px 18px", background:(thinking || !(draft || "").trim()) ? "#AAB" : accent, border:"none", color:"#fff", borderRadius:8, fontSize:13, fontWeight:800, cursor:(thinking || !(draft || "").trim()) ? "not-allowed" : "pointer", fontFamily:"DM Sans,sans-serif" } }, "Send →")),
      // build / actions
      e("div", { style:{ display:"flex", gap:10, marginTop:14, flexWrap:"wrap", alignItems:"center" } },
        e("button", { onClick:function(){ stopHands(); buildFromConversation(); }, disabled:messages.filter(function(m){ return m.role === "user"; }).length === 0,
          style:{ padding:"12px 22px", background:"#2D7A65", border:"none", color:"#fff", borderRadius:8, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "🏗 Build the scheme from this"),
        e("button", { onClick:function(){ stopHands(); setPhase("idle"); }, style:{ padding:"12px 16px", background:"transparent", border:"1px solid #DDE0ED", color:"#7278A0", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "← Back"),
        e("span", { style:{ fontSize:11, color:"#9298BC" } }, "Talk as long as you like — everything you say is folded into the scheme when you build.")));
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
    return e("div", { style:{ padding:"24px 20px", maxWidth:660 } },
      e("div", { style:{ fontSize:36, marginBottom:10 } }, "✅"),
      e("h2", { style:{ fontSize:22, fontWeight:800, color:"#1B7A54", marginBottom:6 } }, "Scheme built from your answers"),
      e("p", { style:{ fontSize:13, color:"#5A5F86", lineHeight:1.6, marginBottom:14 } },
        "Landform built the deal through the one tested engine, priced the mix from current market listings, and added the due diligence it could — Planning, Exit strategy, Grants and Constraints. Now generate the board, marketing, stakeholder and investor documents on the Reports stage, ready to approach the land agent, the owner and the planners."),
      e("div", { style:{ display:"flex", gap:10, flexWrap:"wrap" } },
        e("button", { onClick:function(){ navTo("reports"); }, style:{ padding:"12px 22px", background:"#2D7A65", border:"none", color:"#fff", borderRadius:8, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "📑 Generate the reports →"),
        e("button", { onClick:function(){ navTo("dashboard"); }, style:{ padding:"12px 22px", background:"#fff", border:"1px solid #4A4BAE", color:"#4A4BAE", borderRadius:8, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "Review on the Deal Dashboard →"),
        e("button", { onClick:function(){ navTo("keystone"); }, style:{ padding:"12px 18px", background:"transparent", border:"1px solid #DDE0ED", color:"#7278A0", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" } }, "Open Keystone")));
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
      e("h2", { style:{ fontSize:20, fontWeight:800, color:accent, margin:0 } }, "🎙 Ronald is asking…"),
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
