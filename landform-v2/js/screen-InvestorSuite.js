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
                      alert("✓ Share link created. Switch to 'Share Links' tab to copy + send.");
                    } else {
                      alert("Failed: "+((d&&d.message)||"unknown error"));
                    }
                  })
                  .catch(function(){alert("Network error");});
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
                      alert("✓ Copied to clipboard");
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
