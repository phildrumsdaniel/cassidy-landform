// ── v10.76 — Investor Outreach Kit ────────────────────────────────────────────
// Turns the deal's REAL figures into a ready-to-send capital-raising campaign aimed at
// forward-funding and JV/co-investment: a targeting plan, a cold email + follow-up, and two
// LinkedIn posts (broadcast + a forward-fund/JV partner call). AI-generated, audience-tuned,
// editable and copyable. Uses only the deal's own numbers — no invented figures.
var INVESTOR_AUDIENCES = [
  {value:"pension",   label:"Pension Fund / Long-Income", who:"UK pension funds and long-income institutional investors"},
  {value:"sovereign", label:"Sovereign Wealth Fund",       who:"sovereign wealth funds"},
  {value:"family",    label:"Family Office",               who:"family offices"},
  {value:"jv",        label:"JV Partner / Co-Investor",    who:"JV partners and development co-investors"},
  {value:"reit",      label:"Listed REIT",                 who:"listed residential REITs"},
  {value:"trade",     label:"Trade Buyer / Housebuilder",  who:"trade buyers and housebuilders"},
  {value:"hni",       label:"High Net Worth Individual",   who:"high-net-worth private investors"},
  {value:"general",   label:"General / Broadcast",         who:"a broad institutional audience"}
];
function _invAudienceWho(a){ for(var i=0;i<INVESTOR_AUDIENCES.length;i++){ if(INVESTOR_AUDIENCES[i].value===a) return INVESTOR_AUDIENCES[i].who; } return "institutional investors"; }
function buildInvestorOutreachPrompt(data, audience){
  data = data || {};
  var m = (typeof calcDealMetrics==="function") ? calcDealMetrics(data) : {};
  var sm = (typeof computeSFHMetrics==="function") ? computeSFHMetrics(data) : {};
  var l = data.land||{}, p = data.planning||{}, ex = data.exit||{};
  var town = (typeof cityName==="function" && typeof dealCityKey==="function") ? cityName(dealCityKey(data)) : (l.city||"the location");
  var units = num(m.units)||num(sm.totalUnits)||num(l.units)||num(p.units)||0;
  var gdv = num(sm.gdv)||num(m.gdv)||0;
  var rlv = num(m.rlv)||0;
  var ffValue = num(sm.capInvestmentValue)||0;      // forward-fund / stabilised investment value
  var netYield = (typeof dealYield==="function") ? dealYield(data) : 0;
  var profit = num(sm.profit)||num(m.profit)||0;
  var ah = num(p.ahPct||p.afhPct||(data.sfh&&data.sfh.ahPct))||0;
  var strat = ex.strategy || "forward_fund";
  var who = _invAudienceWho(audience);
  var f = [];
  f.push(units>0 ? (fmtN(units)+" new homes in "+town) : ("a residential scheme in "+town));
  if(gdv>0) f.push("GDV £"+fmtCompact(gdv));
  if(ffValue>0) f.push("indicative forward-fund / investment value ~£"+fmtCompact(ffValue)+(netYield>0?(" at a "+netYield.toFixed(2)+"% net initial yield"):""));
  if(rlv>0) f.push("residual land value £"+fmtCompact(rlv));
  if(profit>0) f.push("developer profit £"+fmtCompact(profit));
  if(ah>0) f.push(ah+"% affordable housing");
  var figs = f.join("; ");
  return "You are a UK real estate capital-markets marketing specialist writing investor outreach for a residential development. Target audience: "+who+". PRIMARY GOAL: attract FORWARD-FUNDING and JV / co-investment interest. "+
    "Use ONLY these deal facts — never invent or round up numbers: "+figs+". Exit strategy: "+strat+". "+
    "Tone: credible UK institutional — specific, numerate, confident but no hype, no guaranteed-return language, no invented tenants/partners. "+
    "Output STRICT JSON only (no markdown, no code fences): {"+
    "\"campaignPlan\":[\"5-7 short, concrete steps — who to target and in what order, which channels (direct email, LinkedIn, broker/agent introductions), and the follow-up cadence\"],"+
    "\"coldEmail\":{\"subject\":\"a specific, openable subject line\",\"body\":\"120-180 words, a first-touch email to a "+who+" decision-maker, leading with the opportunity and the forward-fund angle, one clear ask for a short call, ending with the sign-off placeholder [Your name], Cassidy Group\"},"+
    "\"followUpEmail\":{\"subject\":\"\",\"body\":\"60-90 word polite follow-up if there is no reply\"},"+
    "\"linkedInPost\":\"a punchy 120-160 word LinkedIn post announcing the opportunity to a broad professional audience, with 3-4 relevant hashtags\","+
    "\"linkedInForwardFund\":\"a 100-140 word LinkedIn post specifically seeking a forward-funding partner or JV co-investor, ending with a clear call to DM or comment, with 3-4 hashtags\","+
    "\"teaserBlurb\":\"a 2-3 sentence blurb suitable for a broadcast email intro or a deck cover\"}.";
}

// ── renderInvestorSuite (params: data, navTo, saveDeal, up, user)
// Lifted out of Tool; body unchanged. Calls renderInvestorMedia (now a global).
// Loaded before 05-tool.js.
function renderInvestorSuite(data, navTo, saveDeal, up, user){
    var inv = data.investor || {};
    function upi(k,v){ up("investor",k,v); }
    var dealId = data._cloudDealId || "";
    var hasDeal = !!dealId;

    var tab = inv.tab || "package";  // "package" | "media" | "shares" | "analytics"

    // ── Load shares from backend on first visit ──
    if(hasDeal && user && user.userId && !inv._sharesLoaded && !inv._sharesLoading){
      upi("_sharesLoading",true);
      fetch(WEBHOOK+"?action=share_analytics&userId="+encodeURIComponent(user.userId)+"&dealId="+encodeURIComponent(dealId))
        .then(function(r){return r.json();})
        .then(function(d){
          upi("_sharesLoaded",true);
          upi("_sharesLoading",false);
          if(d && d.status==="ok"){
            upi("shares", d.shares || []);
          }
        }).catch(function(){
          upi("_sharesLoaded",true);
          upi("_sharesLoading",false);
        });
    }

    function refreshShares(){
      upi("_sharesLoaded",false);
    }

    // ── v10.76 — generate the AI investor outreach kit from the deal's real figures ──
    function generateOutreach(){
      if(typeof callAI!=="function"){ if(typeof notify==="function") notify("AI isn't available in this session."); return; }
      upi("_outreachBusy",true);
      if(typeof notify==="function") notify("Writing your investor outreach kit…");
      var sys="You are a UK real estate capital-markets marketing specialist. Output STRICT JSON only — no prose, no markdown fences.";
      var prompt=buildInvestorOutreachPrompt(data, inv.outreachAudience||"pension");
      callAI(user,"investor",sys,prompt).then(function(res){
        var a=res.indexOf("{"), b=res.lastIndexOf("}");
        var obj=JSON.parse((a>=0&&b>a)?res.substring(a,b+1):res);
        upi("outreach",obj);
        upi("outreachAudienceUsed",inv.outreachAudience||"pension");
        upi("_outreachBusy",false);
        if(typeof notify==="function") notify("✓ Outreach kit ready — review, tweak and copy each piece.");
      }).catch(function(err){
        upi("_outreachBusy",false);
        if(typeof notify==="function") notify("Couldn't generate the kit — try again. ("+((err&&err.message)||err)+")");
      });
    }
    function copyOut(txt){
      try{ navigator.clipboard.writeText(txt); if(typeof notify==="function") notify("✓ Copied to clipboard"); }
      catch(e){ window.prompt("Copy this:",txt); }
    }
    // v10.77 — open the anonymised blind investment teaser (site identity withheld).
    function openBlindTeaser(){
      if(typeof buildBlindTeaser!=="function"){ if(typeof notify==="function") notify("Teaser generator still loading — try again in a moment."); return; }
      var html=buildBlindTeaser(data);
      if(typeof showReportOverlay==="function" && showReportOverlay(html,"Blind investment teaser (anonymised)")) return;
      var w=window.open("","_blank");
      if(!w){ if(typeof notify==="function") notify("Allow pop-ups to open the teaser."); return; }
      w.document.open(); w.document.write(html); w.document.close();
    }
    // v10.92 — open the Housing Association / Registered Provider pack (affordable turnkey + grant).
    function openRPPack(){
      if(typeof buildRPPack!=="function"){ if(typeof notify==="function") notify("RP pack generator still loading — try again in a moment."); return; }
      var html=buildRPPack(data);
      if(typeof showReportOverlay==="function" && showReportOverlay(html,"Housing Association / RP pack")) return;
      var w=window.open("","_blank");
      if(!w){ if(typeof notify==="function") notify("Allow pop-ups to open the pack."); return; }
      w.document.open(); w.document.write(html); w.document.close();
    }
    // v10.93 — open the development-finance / lender pack.
    function openLenderPack(){
      if(typeof buildLenderPack!=="function"){ if(typeof notify==="function") notify("Lender pack generator still loading — try again in a moment."); return; }
      var html=buildLenderPack(data);
      if(typeof showReportOverlay==="function" && showReportOverlay(html,"Development finance / lender pack")) return;
      var w=window.open("","_blank");
      if(!w){ if(typeof notify==="function") notify("Allow pop-ups to open the pack."); return; }
      w.document.open(); w.document.write(html); w.document.close();
    }
    // v10.94 — open the local-authority / planning benefits pack.
    function openCouncilPack(){
      if(typeof buildCouncilPack!=="function"){ if(typeof notify==="function") notify("Planning pack generator still loading — try again in a moment."); return; }
      var html=buildCouncilPack(data);
      if(typeof showReportOverlay==="function" && showReportOverlay(html,"Local authority / planning benefits pack")) return;
      var w=window.open("","_blank");
      if(!w){ if(typeof notify==="function") notify("Allow pop-ups to open the pack."); return; }
      w.document.open(); w.document.write(html); w.document.close();
    }

    // ── Tab styles ──
    function tabBtn(key,label){
      var isActive = tab===key;
      return e("div",{key:key,onClick:function(){upi("tab",key);},
        style:{
          padding:"10px 18px",
          fontSize:12,fontWeight:700,letterSpacing:".03em",
          borderBottom:"3px solid "+(isActive?"#4A4BAE":"transparent"),
          color:isActive?"#2E2F8A":"#7278A0",
          cursor:"pointer",
          marginBottom:-2
        }
      }, label);
    }

    var ipt = {width:"100%",padding:"8px 10px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:12,fontFamily:"DM Sans,sans-serif",color:"#2E2F8A",background:"#fff"};
    var lbl = {fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:3,display:"block"};

    return e("div",null,
      // ── Header ──
      e("div",{style:{marginBottom:18}},
        e("div",{style:{fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:"#9A7B3E",marginBottom:6,fontWeight:700}},"Investor Marketing Suite"),
        e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:6}},"Package, market, and track your deal"),
        e("p",{style:{fontSize:12,color:"#7278A0",maxWidth:680,lineHeight:1.6}},"Generate institutional-grade Teaser, IM and Data Room. Upload photos and embed videos. Create shareable links per investor with view analytics so you can gauge interest in real-time.")
      ),

      // ── Save-deal prompt if no cloud ID ──
      !hasDeal && e("div",{style:{padding:"14px 18px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:8,fontSize:12,color:"#B05A35",marginBottom:18,lineHeight:1.6}},
        e("strong",null,"⚠ Save your deal first. "),"The Investor Marketing Suite needs a cloud-saved deal to generate shareable links. Click ",
        e("strong",null,"💾 Save Deal")," in the topbar, then come back.",
        e("div",{style:{marginTop:10}},
          e("button",{onClick:saveDeal,style:{padding:"8px 16px",background:"#B05A35",border:"none",color:"#fff",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"💾 Save Now →")
        )
      ),

      hasDeal && e("div",null,
        // ── Tabs ──
        e("div",{style:{display:"flex",gap:0,borderBottom:"2px solid #F0F1FA",marginBottom:18,overflowX:"auto",flexWrap:"wrap"}},
          tabBtn("package","📦 Build Package"),
          tabBtn("outreach","📣 Outreach Kit"),
          tabBtn("media","🖼 Media Library"),
          tabBtn("shares","🔗 Share Links"),
          tabBtn("analytics","📊 Activity & Engagement")
        ),

        // ── TAB 1: PACKAGE ───────────────────────────────────────────────
        tab==="package" && e("div",null,
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14,marginBottom:18}},
            // Tier 1: Teaser
            e("div",{style:{background:"#fff",border:"2px solid #DDE0ED",borderLeft:"5px solid #2D7A65",borderRadius:10,padding:18}},
              e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
                e("div",{style:{fontSize:24}},"📬"),
                e("div",null,
                  e("div",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Tier 1 — Teaser"),
                  e("div",{style:{fontSize:9,color:"#2D7A65",fontWeight:700,letterSpacing:".05em"}},"NDA-FREE · BROADCAST WIDELY")
                )
              ),
              e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14,lineHeight:1.6}},"1-2 pages. Headline numbers, location, hero image, 3-bullet pitch. Pass-the-pub test for analysts."),
              e("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                e("button",{onClick:function(){navTo("teaser");},style:{flex:1,padding:"7px 10px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#3A3D6A",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"📝 Edit content"),
                e("button",{onClick:function(){upi("createTier","teaser");},style:{flex:1,padding:"7px 10px",background:"linear-gradient(135deg,#2D7A65,#4A4BAE)",border:"none",borderRadius:5,fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🔗 Create link →")
              )
            ),
            // Tier 2: IM
            e("div",{style:{background:"#fff",border:"2px solid #DDE0ED",borderLeft:"5px solid #4A4BAE",borderRadius:10,padding:18}},
              e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
                e("div",{style:{fontSize:24}},"📑"),
                e("div",null,
                  e("div",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Tier 2 — IM"),
                  e("div",{style:{fontSize:9,color:"#4A4BAE",fontWeight:700,letterSpacing:".05em"}},"POST-NDA · IC-READY")
                )
              ),
              e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14,lineHeight:1.6}},"15-25 pages. Financial model summary, sensitivities, market analysis, exit strategy, risks, team."),
              e("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                e("button",{onClick:function(){navTo("im");},style:{flex:1,padding:"7px 10px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#3A3D6A",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"📝 Edit content"),
                e("button",{onClick:function(){upi("createTier","im");},style:{flex:1,padding:"7px 10px",background:"linear-gradient(135deg,#4A4BAE,#2E2F8A)",border:"none",borderRadius:5,fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🔗 Create link →")
              )
            ),
            // Tier 3: Data Room
            e("div",{style:{background:"#fff",border:"2px solid #DDE0ED",borderLeft:"5px solid #9A7B3E",borderRadius:10,padding:18}},
              e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
                e("div",{style:{fontSize:24}},"📁"),
                e("div",null,
                  e("div",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Tier 3 — Data Room"),
                  e("div",{style:{fontSize:9,color:"#9A7B3E",fontWeight:700,letterSpacing:".05em"}},"POST-LOI · FULL DD")
                )
              ),
              e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14,lineHeight:1.6}},"Title plans, planning consents, surveys, models, leases, environmental. Light DR = deal dies."),
              e("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                e("button",{onClick:function(){navTo("dataroom");},style:{flex:1,padding:"7px 10px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#3A3D6A",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"📝 Manage docs"),
                e("button",{onClick:function(){upi("createTier","dataroom");},style:{flex:1,padding:"7px 10px",background:"linear-gradient(135deg,#9A7B3E,#B05A35)",border:"none",borderRadius:5,fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🔗 Create link →")
              )
            )
          ),

          // ── Create Share modal-style block ──
          inv.createTier && e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",color:"#fff",borderRadius:10,padding:22,marginBottom:18}},
            e("div",{style:{fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:"#EDE84A",marginBottom:6,fontWeight:700}},"Create Share Link"),
            e("h3",{style:{fontSize:18,fontWeight:800,marginBottom:14}},"Configure your "+(inv.createTier==="teaser"?"Teaser":inv.createTier==="im"?"Investor Memorandum":"Data Room")+" link"),
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:14}},
              e("div",null,
                e("label",{style:Object.assign({},lbl,{color:"rgba(255,255,255,0.6)"})},"Share title"),
                e("input",{value:inv.shareTitle||"",onChange:function(ev){upi("shareTitle",ev.target.value);},placeholder:"e.g. Coventry PBSA — Pension Fund Pack",style:Object.assign({},ipt,{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff"})})
              ),
              e("div",null,
                e("label",{style:Object.assign({},lbl,{color:"rgba(255,255,255,0.6)"})},"Audience preset"),
                e("select",{value:inv.shareAudience||"pension",onChange:function(ev){upi("shareAudience",ev.target.value);},style:Object.assign({},ipt,{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff"})},
                  e("option",{value:"pension"},"Pension Fund / Long-Income"),
                  e("option",{value:"sovereign"},"Sovereign Wealth Fund"),
                  e("option",{value:"family"},"Family Office"),
                  e("option",{value:"jv"},"JV Partner / Co-Investor"),
                  e("option",{value:"trade"},"Trade Buyer"),
                  e("option",{value:"reit"},"Listed REIT"),
                  e("option",{value:"hni"},"High Net Worth Individual"),
                  e("option",{value:"general"},"General / Broadcast")
                )
              ),
              e("div",null,
                e("label",{style:Object.assign({},lbl,{color:"rgba(255,255,255,0.6)"})},"Passcode (optional)"),
                e("input",{value:inv.sharePasscode||"",onChange:function(ev){upi("sharePasscode",ev.target.value);},placeholder:"Leave blank for no passcode",style:Object.assign({},ipt,{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff"})})
              ),
              e("div",null,
                e("label",{style:Object.assign({},lbl,{color:"rgba(255,255,255,0.6)"})},"Expires (optional)"),
                e("input",{type:"date",value:inv.shareExpires||"",onChange:function(ev){upi("shareExpires",ev.target.value);},style:Object.assign({},ipt,{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff"})})
              )
            ),
            e("div",{style:{display:"flex",gap:10,marginTop:8}},
              e("button",{
                onClick:function(){
                  // Create share
                  fetch(WEBHOOK+"?"+new URLSearchParams({
                    action:"create_share",
                    userId:user.userId,
                    dealId:dealId,
                    tier:inv.createTier,
                    passcode:inv.sharePasscode||"",
                    expiresAt:inv.shareExpires||"",
                    title:inv.shareTitle||"Investment Opportunity",
                    emailGate:"true"
                  }).toString())
                  .then(function(r){return r.json();})
                  .then(function(d){
                    if(d && d.status==="ok"){
                      upi("createTier","");
                      upi("shareTitle","");upi("sharePasscode","");upi("shareExpires","");
                      refreshShares();
                      upi("tab","shares");
                      notify("✓ Share link created. Switch to 'Share Links' tab to copy + send.");
                    } else {
                      notify("Failed: "+((d&&d.message)||"unknown error"));
                    }
                  })
                  .catch(function(){notify("Network error");});
                },
                style:{padding:"10px 20px",background:"#EDE84A",border:"none",borderRadius:6,color:"#1E1F5C",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"Create Link →"),
              e("button",{onClick:function(){upi("createTier","");},style:{padding:"10px 20px",background:"transparent",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Cancel")
            )
          ),

          // Quick guide
          e("div",{style:{background:"#F8F8FE",borderLeft:"3px solid #4A4BAE",borderRadius:6,padding:"14px 16px",fontSize:11,color:"#3A3D6A",lineHeight:1.7}},
            e("strong",{style:{color:"#1E1F5C"}},"How institutional outreach actually works: "),
            "Send the ",e("strong",null,"Teaser")," to 50+ contacts (no NDA needed). 5-10 will request more — give them the ",e("strong",null,"IM")," after they sign your NDA. 1-2 will reach LOI stage — only THEN open the ",e("strong",null,"Data Room"),". Every share link has its own analytics so you can see who's engaged."
          )
        ),

        // ── TAB: OUTREACH KIT ────────────────────────────────────────────
        tab==="outreach" && (function(){
          var ok = inv.outreach || null;
          var busy = !!inv._outreachBusy;
          var preStyle = {whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.6,color:"#2E2F8A",fontFamily:"DM Sans,sans-serif",margin:0};
          function card(title, subtitle, copyStr, bodyNode){
            return e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"16px 18px",marginBottom:12}},
              e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"start",gap:12,marginBottom:10}},
                e("div",null,
                  e("div",{style:{fontSize:13,fontWeight:800,color:"#1E1F5C"}},title),
                  subtitle&&e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2}},subtitle)
                ),
                copyStr&&e("button",{onClick:function(){copyOut(copyStr);},style:{padding:"6px 12px",background:"#4A4BAE",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",flexShrink:0}},"📋 Copy")
              ),
              bodyNode
            );
          }
          return e("div",null,
            // Controls
            e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",color:"#fff",borderRadius:10,padding:20,marginBottom:16}},
              e("div",{style:{fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:"#EDE84A",marginBottom:6,fontWeight:700}},"Capital-Raising Outreach"),
              e("h3",{style:{fontSize:18,fontWeight:800,marginBottom:8}},"Generate an investor outreach campaign"),
              e("p",{style:{fontSize:12,color:"rgba(255,255,255,0.8)",lineHeight:1.6,marginBottom:14,maxWidth:640}},"Built from this deal's real figures — a targeting plan, a cold email + follow-up, and LinkedIn posts (including a forward-funding / JV partner call). Pick your audience and generate. Everything's editable and copyable."),
              e("div",{style:{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap"}},
                e("div",{style:{minWidth:240}},
                  e("label",{style:Object.assign({},lbl,{color:"rgba(255,255,255,0.6)"})},"Target investor audience"),
                  e("select",{value:inv.outreachAudience||"pension",onChange:function(ev){upi("outreachAudience",ev.target.value);},style:Object.assign({},ipt,{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff"})},
                    INVESTOR_AUDIENCES.map(function(a){return e("option",{key:a.value,value:a.value},a.label);})
                  )
                ),
                e("button",{onClick:generateOutreach,disabled:busy,style:{padding:"11px 22px",background:busy?"rgba(237,232,74,0.5)":"#EDE84A",border:"none",borderRadius:6,color:"#1E1F5C",fontSize:12.5,fontWeight:800,cursor:busy?"wait":"pointer",fontFamily:"DM Sans,sans-serif"}},busy?"Writing…":(ok?"↻ Regenerate":"✨ Generate outreach kit"))
              )
            ),
            // Blind (anonymised) teaser — the attach-to-email / broadcast document
            e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderLeft:"5px solid #8A1B2E",borderRadius:10,padding:"14px 16px",marginBottom:16}},
              e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}},
                e("div",{style:{flex:"1 1 260px"}},
                  e("div",{style:{fontSize:13,fontWeight:800,color:"#1E1F5C",marginBottom:3}},"📄 Blind investment teaser (anonymised)"),
                  e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.55}},"The full financial case — GDV, profit, forward-fund value & yield, returns and an anticipated-questions Q&A — with the ",e("strong",null,"site identity withheld")," (no address, postcode, LPA, agent). Investors judge the numbers, then contact you under NDA. Location shows only as a region.")
                ),
                e("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
                  e("button",{onClick:openBlindTeaser,style:{padding:"10px 18px",background:"#8A1B2E",border:"none",color:"#fff",borderRadius:6,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}},"Open teaser →"),
                  e("button",{onClick:openRPPack,title:"Affordable-homes turnkey + grant offer for a housing association",style:{padding:"10px 18px",background:"#1B7A54",border:"none",color:"#fff",borderRadius:6,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}},"🏛 RP / HA pack →"),
                  e("button",{onClick:openLenderPack,title:"Development-finance request for a lender (LTGDV, LTC, cover, exit, security)",style:{padding:"10px 18px",background:"#2E2F8A",border:"none",color:"#fff",borderRadius:6,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}},"🏦 Lender pack →"),
                  e("button",{onClick:openCouncilPack,title:"Planning benefits statement for the local authority (housing, affordable, S106, BNG, economic benefits)",style:{padding:"10px 18px",background:"#9A7B3E",border:"none",color:"#fff",borderRadius:6,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}},"🏛️ Council pack →")
                )
              ),
              e("div",{style:{display:"flex",gap:10,marginTop:12,flexWrap:"wrap"}},
                e("div",{style:{flex:"1 1 200px"}},
                  e("label",{style:lbl},"Region shown (override — leave blank to auto-detect)"),
                  e("input",{value:inv.blindRegion||"",onChange:function(ev){upi("blindRegion",ev.target.value);},placeholder:"e.g. the South East",style:ipt})
                ),
                e("div",{style:{flex:"1 1 160px"}},
                  e("label",{style:lbl},"Reference code (override)"),
                  e("input",{value:inv.blindRef||"",onChange:function(ev){upi("blindRef",ev.target.value);},placeholder:"auto (e.g. CAS-04217)",style:ipt})
                )
              )
            ),
            // Empty state
            !ok && !busy && e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px dashed rgba(74,75,174,0.3)",borderRadius:10,padding:"28px 24px",textAlign:"center"}},
              e("div",{style:{fontSize:32,marginBottom:8}},"📣"),
              e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A",marginBottom:6}},"No outreach kit yet"),
              e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6,maxWidth:420,margin:"0 auto"}},"Pick an audience and click Generate. You'll get a campaign plan, ready-to-send emails and LinkedIn posts tuned to attract forward-funding and JV interest.")
            ),
            // Results
            ok && e("div",null,
              // Campaign plan
              Array.isArray(ok.campaignPlan)&&ok.campaignPlan.length>0 && card("📋 Campaign plan", "How to run the outreach", ok.campaignPlan.join("\n"),
                e("ol",{style:{margin:0,paddingLeft:18,color:"#2E2F8A",fontSize:12,lineHeight:1.7}},
                  ok.campaignPlan.map(function(s,i){return e("li",{key:i,style:{marginBottom:4}},String(s));})
                )
              ),
              // Cold email
              ok.coldEmail && card("✉️ Cold email — first touch", inv.outreachAudienceUsed?("Tuned for: "+((INVESTOR_AUDIENCES.filter(function(a){return a.value===inv.outreachAudienceUsed;})[0]||{}).label||inv.outreachAudienceUsed)):"", "Subject: "+(ok.coldEmail.subject||"")+"\n\n"+(ok.coldEmail.body||""),
                e("div",null,
                  e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:6}},e("strong",{style:{color:"#3A3D6A"}},"Subject: "),ok.coldEmail.subject||""),
                  e("p",{style:preStyle},ok.coldEmail.body||"")
                )
              ),
              // Follow-up email
              ok.followUpEmail && card("✉️ Follow-up email", "If there's no reply", "Subject: "+(ok.followUpEmail.subject||"")+"\n\n"+(ok.followUpEmail.body||""),
                e("div",null,
                  ok.followUpEmail.subject&&e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:6}},e("strong",{style:{color:"#3A3D6A"}},"Subject: "),ok.followUpEmail.subject),
                  e("p",{style:preStyle},ok.followUpEmail.body||"")
                )
              ),
              // LinkedIn broadcast
              ok.linkedInPost && card("💼 LinkedIn — broadcast post", "Announce the opportunity", ok.linkedInPost, e("p",{style:preStyle},ok.linkedInPost)),
              // LinkedIn forward-fund / JV
              ok.linkedInForwardFund && card("💼 LinkedIn — forward-fund / JV partner call", "Seeking a funding partner", ok.linkedInForwardFund, e("p",{style:preStyle},ok.linkedInForwardFund)),
              // Teaser blurb
              ok.teaserBlurb && card("📝 Teaser blurb", "For a broadcast intro or deck cover", ok.teaserBlurb, e("p",{style:preStyle},ok.teaserBlurb)),
              e("div",{style:{fontSize:10,color:"#9A7B3E",lineHeight:1.6,padding:"10px 12px",background:"rgba(154,123,62,0.06)",borderLeft:"3px solid #9A7B3E",borderRadius:4,marginTop:4}},
                "AI-drafted from your deal figures — review every number and claim before sending. Pair each send with a tracked share link (Build Package tab) so you can see who engages."
              )
            )
          );
        })(),

        // ── TAB 2: MEDIA LIBRARY ─────────────────────────────────────────
        tab==="media" && renderInvestorMedia(dealId, upi, ipt, lbl, data, user),

        // ── TAB 3: SHARES ────────────────────────────────────────────────
        tab==="shares" && e("div",null,
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}},
            e("div",null,
              e("h3",{style:{fontSize:16,fontWeight:800,color:"#1E1F5C",marginBottom:2}},"Your share links"),
              e("div",{style:{fontSize:11,color:"#7278A0"}},"All shareable links for this deal — copy, deactivate, or check engagement")
            ),
            e("button",{onClick:refreshShares,style:{padding:"6px 12px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#3A3D6A",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"⟳ Refresh")
          ),
          inv._sharesLoading && e("div",{style:{padding:20,textAlign:"center",color:"#7278A0",fontSize:12}},"Loading..."),
          !inv._sharesLoading && (!inv.shares || inv.shares.length===0) && e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px dashed rgba(74,75,174,0.3)",borderRadius:10,padding:"28px 24px",textAlign:"center"}},
            e("div",{style:{fontSize:32,marginBottom:8}},"🔗"),
            e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A",marginBottom:6}},"No share links yet"),
            e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6}},"Switch to 'Build Package' tab and click 'Create link' on Teaser / IM / Data Room.")
          ),
          (inv.shares||[]).map(function(s){
            var tierLabel = s.tier==="teaser"?"📬 Teaser":s.tier==="im"?"📑 IM":"📁 Data Room";
            var tierColor = s.tier==="teaser"?"#2D7A65":s.tier==="im"?"#4A4BAE":"#9A7B3E";
            var shareUrl = window.location.origin + window.location.pathname + "?share="+s.shareId;
            return e("div",{key:s.shareId,style:{background:"#fff",border:"1px solid #DDE0ED",borderLeft:"5px solid "+tierColor,borderRadius:8,padding:"14px 16px",marginBottom:10}},
              e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"start",gap:12,flexWrap:"wrap"}},
                e("div",{style:{flex:"1 1 240px",minWidth:0}},
                  e("div",{style:{fontSize:13,fontWeight:800,color:"#1E1F5C",marginBottom:3}},s.title||"Untitled"),
                  e("div",{style:{fontSize:10,color:tierColor,fontWeight:700,letterSpacing:".05em",marginBottom:6}},tierLabel),
                  e("div",{style:{display:"flex",gap:14,flexWrap:"wrap",fontSize:10,color:"#7278A0"}},
                    e("span",null,"👁 "+s.viewCount+" view"+(s.viewCount===1?"":"s")),
                    s.lastViewedAt && e("span",null,"Last view: "+new Date(s.lastViewedAt).toLocaleString("en-GB")),
                    s.expiresAt && e("span",null,"Expires: "+new Date(s.expiresAt).toLocaleDateString("en-GB"))
                  )
                ),
                e("div",{style:{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}},
                  e("input",{readOnly:true,value:shareUrl,onClick:function(ev){ev.target.select();},style:{padding:"6px 10px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:10,fontFamily:"monospace",color:"#3A3D6A",background:"#F7F8FC",width:240}}),
                  e("button",{onClick:function(){
                    try{
                      navigator.clipboard.writeText(shareUrl);
                      notify("✓ Copied to clipboard");
                    }catch(e){
                      window.prompt("Copy this link:",shareUrl);
                    }
                  },style:{padding:"6px 12px",background:"#4A4BAE",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"📋 Copy")
                )
              )
            );
          })
        ),

        // ── TAB 4: ANALYTICS ─────────────────────────────────────────────
        tab==="analytics" && e("div",null,
          e("h3",{style:{fontSize:16,fontWeight:800,color:"#1E1F5C",marginBottom:14}},"Engagement analytics"),
          (!inv.shares || inv.shares.length===0) && e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px dashed rgba(74,75,174,0.3)",borderRadius:10,padding:"28px 24px",textAlign:"center"}},
            e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6}},"Create share links first, then engagement data appears here as investors view your materials.")
          ),
          inv.shares && inv.shares.length>0 && (function(){
            var totalViews = inv.shares.reduce(function(a,s){return a+(s.viewCount||0);},0);
            var totalLinks = inv.shares.length;
            var activeLinks = inv.shares.filter(function(s){return s.viewCount>0;}).length;
            return e("div",null,
              e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:18}},
                e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"14px 16px"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".08em",textTransform:"uppercase",fontWeight:700}},"Total Links"),
                  e("div",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginTop:4}},totalLinks)
                ),
                e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"14px 16px"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".08em",textTransform:"uppercase",fontWeight:700}},"Total Views"),
                  e("div",{style:{fontSize:24,fontWeight:800,color:"#2D7A65",marginTop:4}},totalViews)
                ),
                e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"14px 16px"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".08em",textTransform:"uppercase",fontWeight:700}},"Active Links"),
                  e("div",{style:{fontSize:24,fontWeight:800,color:"#9A7B3E",marginTop:4}},activeLinks)
                ),
                e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"14px 16px"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".08em",textTransform:"uppercase",fontWeight:700}},"Avg Views/Link"),
                  e("div",{style:{fontSize:24,fontWeight:800,color:"#4A4BAE",marginTop:4}},totalLinks>0?(totalViews/totalLinks).toFixed(1):"0")
                )
              ),
              e("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"DM Sans,sans-serif",background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden"}},
                e("thead",null,
                  e("tr",{style:{background:"#F4F5FB"}},
                    ["Link","Tier","Views","Last viewed","Status"].map(function(h){
                      return e("th",{key:h,style:{padding:"10px 12px",textAlign:"left",fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".05em",fontWeight:700,borderBottom:"2px solid #DDE0ED"}},h);
                    })
                  )
                ),
                e("tbody",null,
                  inv.shares.map(function(s){
                    return e("tr",{key:s.shareId,style:{borderBottom:"1px solid #F0F1FA"}},
                      e("td",{style:{padding:"10px 12px",fontWeight:700,color:"#1E1F5C"}},s.title||"Untitled"),
                      e("td",{style:{padding:"10px 12px"}},s.tier==="teaser"?"📬 Teaser":s.tier==="im"?"📑 IM":"📁 Data Room"),
                      e("td",{style:{padding:"10px 12px",fontWeight:800,color:s.viewCount>0?"#2D7A65":"#C0C4D8"}},s.viewCount||0),
                      e("td",{style:{padding:"10px 12px",color:"#7278A0",fontSize:10}},s.lastViewedAt?new Date(s.lastViewedAt).toLocaleString("en-GB"):"—"),
                      e("td",{style:{padding:"10px 12px"}},
                        e("span",{style:{padding:"2px 8px",background:s.viewCount>0?"rgba(45,122,101,0.12)":"rgba(120,120,160,0.08)",color:s.viewCount>0?"#2D7A65":"#7278A0",borderRadius:3,fontSize:9,fontWeight:700,letterSpacing:".05em"}},s.viewCount>0?"ENGAGED":"NOT YET")
                      )
                    );
                  })
                )
              )
            );
          })()
        )
      )
    );
  }
