function Root(){
  // Detect public-share mode from URL: ?share=<shareId>
  var shareId = (function(){
    try{
      var params = new URLSearchParams(window.location.search);
      return params.get("share") || null;
    }catch(e){ return null; }
  })();

  if(shareId){
    return e(PublicShareViewer,{shareId:shareId});
  }

  // Try to restore login session from localStorage
  var initialUser = (function(){
    try{
      var raw = localStorage.getItem("landform_user");
      if(!raw) return null;
      var u = JSON.parse(raw);
      if(!u || !u.userId || !u.email) return null;
      // Session lifetime: 30 days
      if(u.loginAt && (Date.now() - u.loginAt) > 30*24*3600*1000) {
        localStorage.removeItem("landform_user");
        return null;
      }
      return u;
    }catch(e){ return null; }
  })();

  var s=useState(initialUser); var user=s[0]; var setUser=s[1];
  function logout(){
    try{ localStorage.removeItem("landform_user"); }catch(e){}
    setUser(null);
  }
  if(!user)return e(AccessGate,{onLogin:function(u){
    try{ logEvent(u,"LOGIN","Access granted"); }catch(e){}
    setUser(u);
  }});
  return e(Tool,{user:user, onLogout:logout});
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC SHARE VIEWER
//   Shown when investor clicks a ?share=<shareId> link. Branded read-only view.
//   Captures email + tracks view duration for analytics.
// ═══════════════════════════════════════════════════════════════════════════
function PublicShareViewer(props){
  var shareId = props.shareId;
  var ls = useState(true); var loading=ls[0]; var setLoading=ls[1];
  var ds = useState(null); var shareData=ds[0]; var setShareData=ds[1];
  var es = useState(""); var err=es[0]; var setErr=es[1];
  var ns = useState(false); var needPasscode=ns[0]; var setNeedPasscode=ns[1];
  var pcs = useState(""); var passcode=pcs[0]; var setPasscode=pcs[1];

  // Email gate state
  var egs = useState(false); var emailEntered=egs[0]; var setEmailEntered=egs[1];
  var ems = useState(""); var viewerEmail=ems[0]; var setViewerEmail=ems[1];
  var vns = useState(""); var viewerName=vns[0]; var setViewerName=vns[1];
  var vcs = useState(""); var viewerCompany=vcs[0]; var setViewerCompany=vcs[1];

  var startedAt = React.useRef ? React.useRef(Date.now()) : {current:Date.now()};

  function loadShare(submittedPasscode){
    setLoading(true);setErr("");
    var url = WEBHOOK+"?action=load_share&shareId="+encodeURIComponent(shareId);
    if(submittedPasscode) url += "&passcode="+encodeURIComponent(submittedPasscode);
    fetch(url)
      .then(function(r){return r.json();})
      .then(function(d){
        setLoading(false);
        if(d && d.status==="need_passcode"){
          setNeedPasscode(true);
          return;
        }
        if(d && d.status==="ok"){
          setShareData(d);
          setNeedPasscode(false);
        } else {
          setErr((d&&d.message)||"Unable to load this link");
        }
      })
      .catch(function(){setLoading(false);setErr("Network error");});
  }

  // Initial load
  React.useEffect(function(){
    loadShare("");
    // Track view duration when leaving
    var handleUnload = function(){
      try{
        var duration = Math.round((Date.now()-startedAt.current)/1000);
        navigator.sendBeacon && navigator.sendBeacon(
          WEBHOOK+"?action=track_view&shareId="+encodeURIComponent(shareId)+"&durationSec="+duration+"&viewerEmail="+encodeURIComponent(viewerEmail||"anonymous")+"&viewerName="+encodeURIComponent(viewerName)+"&viewerCompany="+encodeURIComponent(viewerCompany)+"&userAgent="+encodeURIComponent(navigator.userAgent.substring(0,100))
        );
      }catch(e){}
    };
    window.addEventListener("beforeunload",handleUnload);
    return function(){window.removeEventListener("beforeunload",handleUnload);};
  },[]);

  // Fire initial track when email submitted
  function recordView(){
    fetch(WEBHOOK+"?action=track_view&shareId="+encodeURIComponent(shareId)+"&viewerEmail="+encodeURIComponent(viewerEmail)+"&viewerName="+encodeURIComponent(viewerName)+"&viewerCompany="+encodeURIComponent(viewerCompany)+"&tier="+encodeURIComponent((shareData&&shareData.tier)||"")+"&userAgent="+encodeURIComponent(navigator.userAgent.substring(0,100)))
      .catch(function(){});
    setEmailEntered(true);
  }

  // ── Render states ──
  if(loading){
    return e("div",{style:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F4F5F9",fontFamily:"DM Sans,sans-serif"}},
      e("div",{style:{textAlign:"center"}},
        e("img",{src:"data:image/png;base64,"+LOGO,style:{width:80,marginBottom:14,opacity:0.7}}),
        e("div",{style:{fontSize:13,color:"#7278A0"}},"Loading investment package…")
      )
    );
  }

  if(err){
    return e("div",{style:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F4F5F9",fontFamily:"DM Sans,sans-serif",padding:20}},
      e("div",{style:{background:"#fff",borderRadius:12,padding:"40px 36px",maxWidth:440,textAlign:"center"}},
        e("img",{src:"data:image/png;base64,"+LOGO,style:{width:100,marginBottom:18}}),
        e("h2",{style:{color:"#B05A35",fontSize:18,marginBottom:10}},"Link unavailable"),
        e("p",{style:{color:"#7278A0",fontSize:13,lineHeight:1.6}},err),
        e("p",{style:{color:"#A0A4C0",fontSize:11,marginTop:14}},"Please contact the sender to request a new link.")
      )
    );
  }

  if(needPasscode){
    return e("div",{style:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F4F5F9",fontFamily:"DM Sans,sans-serif",padding:20}},
      e("div",{style:{background:"#fff",borderRadius:12,padding:"40px 36px",maxWidth:380,textAlign:"center"}},
        e("img",{src:"data:image/png;base64,"+LOGO,style:{width:100,marginBottom:18}}),
        e("h2",{style:{color:"#2E2F8A",fontSize:18,marginBottom:8}},"Passcode required"),
        e("p",{style:{color:"#7278A0",fontSize:12,marginBottom:18}},"This investment pack is passcode-protected."),
        e("input",{type:"password",value:passcode,onChange:function(ev){setPasscode(ev.target.value);},onKeyDown:function(ev){if(ev.key==="Enter")loadShare(passcode);},placeholder:"Enter passcode",style:{width:"100%",padding:"10px 12px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:13,marginBottom:12,fontFamily:"DM Sans,sans-serif",boxSizing:"border-box"}}),
        e("button",{onClick:function(){loadShare(passcode);},style:{width:"100%",padding:"10px",background:"#4A4BAE",border:"none",borderRadius:6,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Unlock →")
      )
    );
  }

  // Email gate (only if shareData.emailGate)
  if(shareData && shareData.emailGate && !emailEntered){
    return e("div",{style:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",fontFamily:"DM Sans,sans-serif",padding:20}},
      e("div",{style:{background:"#fff",borderRadius:12,padding:"40px 36px",maxWidth:440,boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}},
        e("div",{style:{textAlign:"center",marginBottom:20}},
          e("img",{src:"data:image/png;base64,"+LOGO,style:{width:110,marginBottom:14}}),
          e("h2",{style:{color:"#2E2F8A",fontSize:18,fontWeight:800,marginBottom:6}},shareData.title||"Investment Opportunity"),
          e("p",{style:{color:"#7278A0",fontSize:12}},"Please introduce yourself to view this opportunity")
        ),
        e("div",{style:{display:"flex",flexDirection:"column",gap:12}},
          e("input",{value:viewerName,onChange:function(ev){setViewerName(ev.target.value);},placeholder:"Your name",style:{padding:"10px 12px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:13,fontFamily:"DM Sans,sans-serif"}}),
          e("input",{value:viewerCompany,onChange:function(ev){setViewerCompany(ev.target.value);},placeholder:"Company / fund",style:{padding:"10px 12px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:13,fontFamily:"DM Sans,sans-serif"}}),
          e("input",{type:"email",value:viewerEmail,onChange:function(ev){setViewerEmail(ev.target.value);},placeholder:"Email address",style:{padding:"10px 12px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:13,fontFamily:"DM Sans,sans-serif"}}),
          e("button",{onClick:function(){
            if(!viewerEmail || viewerEmail.indexOf("@")<0){notify("Please enter a valid email");return;}
            if(!viewerName){notify("Please enter your name");return;}
            recordView();
          },style:{padding:12,background:"#4A4BAE",border:"none",borderRadius:6,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"View Opportunity →")
        ),
        e("p",{style:{textAlign:"center",fontSize:10,color:"#A0A4C0",marginTop:18,lineHeight:1.5}},"This is a private investment opportunity. Your details are only shared with the sender for tracking purposes.")
      )
    );
  }

  // ── Main content view ──
  var deal = {};
  try{ deal = JSON.parse(shareData.payload); }catch(e){}
  var tier = shareData.tier;
  var media = shareData.media || [];
  var photos = media.filter(function(m){return m.kind==="photo";});
  var videos = media.filter(function(m){return m.kind==="video_embed";});
  var docs = media.filter(function(m){return m.kind==="document";});

  // Extract deal metrics
  var address = (deal.land&&deal.land.address) || shareData.title;
  var city = (deal.land&&deal.land.city) || "—";
  var scheme = deal.assetType || "—";
  var units = (deal.planning&&deal.planning.units) || (deal.sfh&&deal.sfh.totalUnits) || (deal.hra&&deal.hra.units) || "—";
  var gdv = (deal.fin&&deal.fin.gdv) || 0;
  var profit = (deal.fin&&deal.fin.profit) || 0;
  var margin = (deal.fin&&deal.fin.margin) || 0;

  function fmtPub(n){if(!n||isNaN(n))return"—";if(n>=1e6)return"£"+(n/1e6).toFixed(2)+"m";if(n>=1e3)return"£"+(n/1e3).toFixed(0)+"k";return"£"+Math.round(n).toLocaleString();}

  return e("div",{style:{minHeight:"100vh",background:"#F4F5F9",fontFamily:"DM Sans,sans-serif"}},
    // Header bar
    e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",color:"#fff",padding:"18px 24px"}},
      e("div",{style:{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",gap:14}},
        e("img",{src:"data:image/png;base64,"+LOGO,style:{width:60,height:"auto",filter:"brightness(0) invert(1)"}}),
        e("div",null,
          e("div",{style:{fontSize:10,letterSpacing:".25em",textTransform:"uppercase",color:"#EDE84A",fontWeight:700}},"Cassidy Group — "+(tier==="teaser"?"Teaser":tier==="im"?"Investment Memorandum":"Data Room")),
          e("div",{style:{fontSize:17,fontWeight:800,marginTop:2}},shareData.title||"Investment Opportunity")
        )
      )
    ),

    // Main content
    e("div",{style:{maxWidth:1100,margin:"0 auto",padding:"30px 24px"}},
      // Hero photo
      photos.length > 0 && e("img",{src:photos[0].driveUrl,alt:photos[0].title,style:{width:"100%",height:380,objectFit:"cover",borderRadius:10,marginBottom:24,background:"#DDE0ED"}}),

      // Key metrics
      e("div",{style:{background:"#fff",borderRadius:12,padding:24,marginBottom:20,boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}},
        e("h1",{style:{fontSize:26,fontWeight:800,color:"#1E1F5C",marginBottom:6}},address),
        e("p",{style:{fontSize:14,color:"#7278A0",marginBottom:20}},city+" · "+String(scheme).toUpperCase()+" · "+units+" units"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14}},
          e("div",{style:{padding:"14px 16px",background:"linear-gradient(135deg,rgba(45,122,101,0.06),rgba(74,75,174,0.04))",borderRadius:8}},
            e("div",{style:{fontSize:9,letterSpacing:".1em",textTransform:"uppercase",color:"#7278A0",fontWeight:700}},"GDV"),
            e("div",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",marginTop:4}},fmtPub(gdv))
          ),
          e("div",{style:{padding:"14px 16px",background:"linear-gradient(135deg,rgba(45,122,101,0.06),rgba(74,75,174,0.04))",borderRadius:8}},
            e("div",{style:{fontSize:9,letterSpacing:".1em",textTransform:"uppercase",color:"#7278A0",fontWeight:700}},"Projected Profit"),
            e("div",{style:{fontSize:22,fontWeight:800,color:"#2D7A65",marginTop:4}},fmtPub(profit))
          ),
          e("div",{style:{padding:"14px 16px",background:"linear-gradient(135deg,rgba(45,122,101,0.06),rgba(74,75,174,0.04))",borderRadius:8}},
            e("div",{style:{fontSize:9,letterSpacing:".1em",textTransform:"uppercase",color:"#7278A0",fontWeight:700}},"Margin"),
            e("div",{style:{fontSize:22,fontWeight:800,color:"#9A7B3E",marginTop:4}},margin>0?margin.toFixed(1)+"%":"—")
          ),
          e("div",{style:{padding:"14px 16px",background:"linear-gradient(135deg,rgba(45,122,101,0.06),rgba(74,75,174,0.04))",borderRadius:8}},
            e("div",{style:{fontSize:9,letterSpacing:".1em",textTransform:"uppercase",color:"#7278A0",fontWeight:700}},"Scheme"),
            e("div",{style:{fontSize:18,fontWeight:800,color:"#4A4BAE",marginTop:4}},String(scheme).toUpperCase())
          )
        )
      ),

      // Videos
      videos.length > 0 && e("div",{style:{background:"#fff",borderRadius:12,padding:24,marginBottom:20,boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}},
        e("h2",{style:{fontSize:18,fontWeight:800,color:"#1E1F5C",marginBottom:14}},"🎬 Site Tour"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14}},
          videos.map(function(v){
            return e("div",{key:v.mediaId},
              e("div",{style:{position:"relative",paddingBottom:"56.25%",height:0,borderRadius:8,overflow:"hidden",background:"#000"}},
                e("iframe",{src:v.embedUrl,style:{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:0},allowFullScreen:true,title:v.title})
              ),
              e("div",{style:{fontSize:11,color:"#7278A0",marginTop:6}},v.title)
            );
          })
        )
      ),

      // Photo gallery (additional)
      photos.length > 1 && e("div",{style:{background:"#fff",borderRadius:12,padding:24,marginBottom:20,boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}},
        e("h2",{style:{fontSize:18,fontWeight:800,color:"#1E1F5C",marginBottom:14}},"📸 Gallery"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}},
          photos.slice(1).map(function(p){
            return e("img",{key:p.mediaId,src:p.driveUrl,alt:p.title,style:{width:"100%",height:140,objectFit:"cover",borderRadius:6,background:"#DDE0ED"}});
          })
        )
      ),

      // Documents (only in IM / Data Room tier)
      (tier==="im"||tier==="dataroom") && docs.length > 0 && e("div",{style:{background:"#fff",borderRadius:12,padding:24,marginBottom:20,boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}},
        e("h2",{style:{fontSize:18,fontWeight:800,color:"#1E1F5C",marginBottom:14}},"📁 Documents"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}},
          docs.map(function(d){
            return e("a",{key:d.mediaId,href:d.driveUrl,target:"_blank",style:{display:"block",padding:"14px 16px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,textDecoration:"none"}},
              e("div",{style:{fontSize:24,marginBottom:6}},"📄"),
              e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A"}},d.title),
              e("div",{style:{fontSize:10,color:"#4A4BAE",marginTop:4}},"Open document →")
            );
          })
        )
      ),

      // Contact CTA
      e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",color:"#fff",borderRadius:12,padding:30,textAlign:"center",marginTop:20}},
        e("div",{style:{fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:"#EDE84A",marginBottom:6,fontWeight:700}},"Interested?"),
        e("h2",{style:{fontSize:22,fontWeight:800,marginBottom:8}},"Let's discuss this opportunity"),
        e("p",{style:{fontSize:13,opacity:0.9,marginBottom:16,maxWidth:480,margin:"0 auto 16px"}},"Cassidy Group is the sponsor of this opportunity. To request the IM, schedule a site visit, or discuss commercial terms, please contact us directly."),
        e("div",{style:{fontSize:14,fontWeight:700,color:"#EDE84A"}},"info@cassidygroupltd.com")
      ),

      // Indicative-only disclaimer (institutional standard)
      e("div",{style:{padding:"14px 18px",background:"#F8F8FE",border:"1px solid #DDE0ED",borderRadius:8,fontSize:10,color:"#7278A0",lineHeight:1.7,marginTop:8}},
        e("strong",{style:{color:"#3A3D6A"}},"Important — Indicative Information Only. "),
        "The figures, valuations and projections shown are indicative and based on developer's current assumptions and modelling. They do not constitute a formal valuation under the RICS Red Book. Recipients should undertake independent due diligence and obtain professional valuation and legal advice before any commercial commitment. Past performance is not a guarantee of future returns. Capital is at risk."
      ),

      // Footer
      e("div",{style:{textAlign:"center",padding:"24px 0",fontSize:10,color:"#A0A4C0"}},
        "© Cassidy Group Ltd 2026 · This opportunity is confidential. Do not share without permission."
      )
    )
  );
}

ReactDOM.render(e(Root,null),document.getElementById("root"));

