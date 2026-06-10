// ── renderPortfolio  (params: data, logMigration, navTo, saveDeal, setData, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderPortfolio(data, logMigration, navTo, saveDeal, setData, user){
    // Cloud deals state — fetched on mount
    var pd = data.portfolio || {};
    var cloudDeals = pd.deals || [];
    var loading = pd.loading || false;
    var lastError = pd.error || "";

    // Auto-fetch on mount if not already loaded
    if(user && user.userId && !pd.loaded && !loading){
      // Mark loading immediately (synchronous) to prevent re-fire
      setData(function(prev){
        var nextPort = Object.assign({},prev.portfolio||{},{loading:true});
        return Object.assign({},prev,{portfolio:nextPort});
      });
      fetch(WEBHOOK+"?action=list_deals&userId="+encodeURIComponent(user.userId))
      .then(function(r){return r.json();})
      .then(function(d){
        setData(function(prev){
          var nextPort = (d&&d.status==="ok")
            ? {deals:d.deals||[], loaded:true, loading:false, error:"", fetchedAt:Date.now(), global:!!d.global}
            : {deals:[], loaded:true, loading:false, error:(d&&d.message)||"Failed to load deals"};
          return Object.assign({},prev,{portfolio:nextPort});
        });
      })
      .catch(function(err){
        setData(function(prev){
          return Object.assign({},prev,{portfolio:{deals:[],loaded:true,loading:false,error:"Network error — check connection"}});
        });
      });
    }

    function refreshDeals(){
      setData(function(prev){
        return Object.assign({},prev,{portfolio:Object.assign({},prev.portfolio||{},{loaded:false})});
      });
    }

    function loadCloudDeal(dealId){
      setData(function(prev){
        return Object.assign({},prev,{portfolio:Object.assign({},prev.portfolio||{},{loadingDeal:dealId})});
      });
      fetch(WEBHOOK+"?action=load_deal&userId="+encodeURIComponent(user.userId)+"&dealId="+encodeURIComponent(dealId))
      .then(function(r){return r.json();})
      .then(function(d){
        if(d && d.status==="ok" && d.payload){
          // Backend tells us if the payload is valid JSON
          if(d.valid === false){
            alert("⚠ This deal's saved data appears corrupted (it may have been saved before a size-limit fix).\n\nThe deal couldn't be fully restored. Your current work on screen has NOT been overwritten.");
            setData(function(prev){return Object.assign({},prev,{portfolio:Object.assign({},prev.portfolio||{},{loadingDeal:null})});});
            return;
          }
          try{
            var dealData = JSON.parse(d.payload);
            if(!dealData || typeof dealData !== "object"){
              throw new Error("not an object");
            }
            dealData._cloudDealId = d.dealId;
            // v9.24 — Capture role + creator from backend response
            dealData._userRole = d.role || "viewer";
            dealData._dealCreator = d.createdBy || "";
            // Auto-migrate stale data from older versions before showing it
            var migrated = migrateLoadedDeal(dealData);
            setData(migrated.data);
            if(migrated.changed) logMigration(migrated);
            navTo("dashboard");
          }catch(e){
            alert("⚠ Couldn't read this deal's data — it may be corrupted. Your current work has not been overwritten.");
            setData(function(prev){return Object.assign({},prev,{portfolio:Object.assign({},prev.portfolio||{},{loadingDeal:null})});});
          }
        } else {
          alert("Couldn't load deal: "+((d&&d.message)||"unknown error"));
        }
      })
      .catch(function(err){
        alert("Network error loading deal");
      });
    }

    function deleteCloudDeal(dealId,dealName){
      if(!window.confirm("Delete '"+dealName+"'? This cannot be undone.")) return;
      fetch(WEBHOOK+"?action=delete_deal&userId="+encodeURIComponent(user.userId)+"&dealId="+encodeURIComponent(dealId))
      .then(function(r){return r.json();})
      .then(function(d){
        if(d && d.status==="ok"){
          refreshDeals();
        } else {
          alert("Couldn't delete: "+((d&&d.message)||"unknown error"));
        }
      });
    }

    // v9.27 — Open share dialog: fetch users + current ACL, then show modal
    function openShareDialog(dealId, dealName){
      setData(function(prev){
        return Object.assign({},prev,{shareDialog:{open:true, dealId:dealId, dealName:dealName, loading:true, users:[], viewers:[], editors:[], creator:""}});
      });
      // Parallel fetch: users + current ACL
      Promise.all([
        fetch(WEBHOOK+"?action=list_users&userId="+encodeURIComponent(user.userId)).then(function(r){return r.json();}),
        fetch(WEBHOOK+"?action=get_access&userId="+encodeURIComponent(user.userId)+"&dealId="+encodeURIComponent(dealId)).then(function(r){return r.json();})
      ]).then(function(results){
        var usersResp = results[0];
        var accessResp = results[1];
        setData(function(prev){
          if(!prev.shareDialog || !prev.shareDialog.open) return prev;
          return Object.assign({},prev,{shareDialog:Object.assign({},prev.shareDialog,{
            loading:false,
            users: (usersResp&&usersResp.users) || [],
            viewers: (accessResp&&accessResp.viewers) || [],
            editors: (accessResp&&accessResp.editors) || [],
            creator: (accessResp&&accessResp.creator) || ""
          })});
        });
      }).catch(function(err){
        setData(function(prev){
          if(!prev.shareDialog || !prev.shareDialog.open) return prev;
          return Object.assign({},prev,{shareDialog:Object.assign({},prev.shareDialog,{loading:false, error:"Couldn't load sharing data: "+err.message})});
        });
      });
    }

    // Format relative time
    function relTime(iso){
      if(!iso) return "—";
      var t = new Date(iso).getTime();
      var diff = Date.now() - t;
      var mins = Math.floor(diff/60000);
      if(mins < 1) return "just now";
      if(mins < 60) return mins+"m ago";
      var hrs = Math.floor(mins/60);
      if(hrs < 24) return hrs+"h ago";
      var days = Math.floor(hrs/24);
      if(days < 30) return days+"d ago";
      return new Date(iso).toLocaleDateString("en-GB");
    }

    return e("div",null,
      // Header
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:10}},
        e("div",null,
          e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},pd.global ? "Team Portfolio" : "My Portfolio"),
          e("p",{style:{fontSize:12,color:"#7278A0"}},pd.global ? "Global view — all Cassidy team deals visible to every signed-in user" : "All deals saved to your account — accessible from any device"),
          pd.global && e("div",{style:{display:"inline-block",marginTop:6,padding:"3px 9px",background:"rgba(45,122,101,0.10)",border:"1px solid rgba(45,122,101,0.3)",borderRadius:3,fontSize:9,fontWeight:700,color:"#2D7A65",letterSpacing:".08em",textTransform:"uppercase"}},"🌐 Global mode active")
        ),
        e("div",{style:{display:"flex",gap:8,alignItems:"center"}},
          loading && e("div",{style:{fontSize:11,color:"#7278A0",display:"flex",alignItems:"center",gap:6}},
            e("div",{style:{width:10,height:10,border:"2px solid #DDE0ED",borderTopColor:"#4A4BAE",borderRadius:"50%",animation:"pulse 1s linear infinite"}}),
            "Loading..."
          ),
          e("button",{onClick:refreshDeals,style:{padding:"6px 12px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#3A3D6A",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"⟳ Refresh"),
          e("button",{onClick:saveDeal,style:{padding:"6px 14px",background:"linear-gradient(135deg,#2D7A65,#4A4BAE)",border:"none",borderRadius:5,fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"💾 Save Current Deal")
        )
      ),

      // Error banner
      lastError && e("div",{style:{margin:"14px 0",padding:"10px 14px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:6,fontSize:11,color:"#B05A35"}},
        "⚠ "+lastError+" · ",
        e("strong",{style:{cursor:"pointer",textDecoration:"underline"},onClick:refreshDeals},"Try again")
      ),

      // Empty state
      !loading && cloudDeals.length===0 && e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px dashed rgba(74,75,174,0.3)",borderRadius:10,padding:"28px 24px",textAlign:"center",marginTop:18}},
        e("div",{style:{fontSize:36,marginBottom:8}},"📂"),
        e("div",{style:{fontSize:14,fontWeight:700,color:"#2E2F8A",marginBottom:6}},"Your portfolio is empty"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14,lineHeight:1.6,maxWidth:400,margin:"0 auto 14px"}},"Once you've worked on a deal and clicked Save, it appears here. Open this Portfolio on any other device to see the same deals."),
        e("button",{onClick:function(){navTo("navigator");},style:{padding:"10px 22px",background:"#4A4BAE",border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Start a New Deal →")
      ),

      // Deals grid
      cloudDeals.length>0 && e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14,marginTop:18}},
        cloudDeals.map(function(deal){
          var schemeIcon = {sfh:"🏡",btr:"🏢",pbsa:"🎓",land:"🔍",property:"🏠",recovery:"⚖"}[deal.scheme] || "◆";
          var schemeLabel = {sfh:"SFH",btr:"BTR",pbsa:"PBSA",land:"Land",property:"Property",recovery:"Recovery"}[deal.scheme] || (deal.scheme||"—").toUpperCase();
          // v9.24 — Per-deal access control: role comes from backend (owner/editor/viewer)
          var role = deal.role || (deal.createdBy && user && deal.createdBy === user.userId ? "owner" : "viewer");
          var creatorLabel = role==="owner" ? "You" : (deal.createdBy || "Unknown").split("@")[0].replace(/[._]/g," ");
          var roleBadge = {
            owner:  {label:"OWNER",  bg:"rgba(74,75,174,0.10)",  color:"#4A4BAE"},
            editor: {label:"EDITOR", bg:"rgba(45,122,101,0.10)",  color:"#2D7A65"},
            viewer: {label:"VIEW",   bg:"rgba(154,123,62,0.10)",  color:"#9A7B3E"}
          }[role] || {label:"VIEW", bg:"#F7F8FC", color:"#7278A0"};
          return e("div",{key:deal.dealId,style:{background:"#fff",border:"1px solid "+(role==="owner"?"#C5C8E0":"#DDE0ED"),borderRadius:10,padding:16,position:"relative",transition:"all .15s"}},
            // Header row
            e("div",{style:{display:"flex",alignItems:"start",gap:10,marginBottom:10}},
              e("div",{style:{fontSize:28,flexShrink:0,lineHeight:1}},schemeIcon),
              e("div",{style:{flex:1,minWidth:0}},
                e("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}},
                  e("div",{style:{fontSize:13,fontWeight:800,color:"#1E1F5C",wordBreak:"break-word"}},deal.dealName||"Untitled"),
                  e("span",{style:{fontSize:8,fontWeight:800,padding:"2px 6px",background:roleBadge.bg,color:roleBadge.color,borderRadius:3,letterSpacing:".08em"}},roleBadge.label)
                ),
                e("div",{style:{fontSize:10,color:"#7278A0"}},deal.address||"No address")
              )
            ),
            // Metadata
            e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}},
              e("div",{style:{background:"#F7F8FC",borderRadius:5,padding:"7px 9px"}},
                e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".05em"}},"Scheme"),
                e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A",marginTop:2}},schemeLabel)
              ),
              e("div",{style:{background:"#F7F8FC",borderRadius:5,padding:"7px 9px"}},
                e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".05em"}},"GDV"),
                e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A",marginTop:2}},deal.gdv>0?fmt(deal.gdv):"—")
              )
            ),
            // Creator + last modified row
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:9,color:"#A0A4C0",marginBottom:12,gap:8}},
              e("span",null,"By: ",e("strong",{style:{color:role==="owner"?"#4A4BAE":"#7278A0"}},creatorLabel)),
              e("span",null,relTime(deal.lastModified))
            ),
            // Actions — delete + share hidden if user can't edit
            e("div",{style:{display:"flex",gap:6}},
              e("button",{onClick:function(){loadCloudDeal(deal.dealId);},style:{flex:1,padding:"7px 10px",background:"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
                role==="viewer" ? "View →" : "Open →"
              ),
              // v9.27 — Share button: in-app sharing dialog (no more editing Google Sheets)
              (role==="owner"||role==="editor") && e("button",{
                onClick:function(){openShareDialog(deal.dealId, deal.dealName);},
                title:"Share with teammates",
                style:{padding:"7px 10px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,color:"#2D7A65",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"👥"),
              (role==="owner"||role==="editor") && e("button",{onClick:function(){deleteCloudDeal(deal.dealId,deal.dealName);},title:"Delete deal",style:{padding:"7px 10px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,color:"#B05A35",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🗑")
            )
          );
        })
      ),

      // Footer info
      cloudDeals.length>0 && e("div",{style:{marginTop:18,padding:"10px 14px",background:"#F8F8FE",borderLeft:"3px solid #4A4BAE",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
        e("strong",null,"☁ Cloud-synced. "),"All deals are saved to your account ("+user.email+"). Open this page on any device after logging in — you'll see the same list."
      ),

      // v9.27 — Share Dialog Modal
      data.shareDialog && data.shareDialog.open && (function(){
        var sd = data.shareDialog;
        function close(){
          setData(function(prev){return Object.assign({},prev,{shareDialog:null});});
        }
        function toggleViewer(email){
          var lower = String(email).toLowerCase();
          var arr = (sd.viewers||[]).slice();
          var i = arr.map(function(v){return String(v).toLowerCase();}).indexOf(lower);
          if(i>=0) arr.splice(i,1); else arr.push(lower);
          setData(function(prev){return Object.assign({},prev,{shareDialog:Object.assign({},prev.shareDialog,{viewers:arr})});});
        }
        function toggleEditor(email){
          var lower = String(email).toLowerCase();
          var arr = (sd.editors||[]).slice();
          var i = arr.map(function(v){return String(v).toLowerCase();}).indexOf(lower);
          if(i>=0) arr.splice(i,1); else arr.push(lower);
          // If they're now an editor, also ensure they're not in viewers (editor > viewer)
          if(i<0){
            var vArr = (sd.viewers||[]).filter(function(v){return String(v).toLowerCase() !== lower;});
            setData(function(prev){return Object.assign({},prev,{shareDialog:Object.assign({},prev.shareDialog,{editors:arr,viewers:vArr})});});
          } else {
            setData(function(prev){return Object.assign({},prev,{shareDialog:Object.assign({},prev.shareDialog,{editors:arr})});});
          }
        }
        function isViewer(email){return (sd.viewers||[]).map(function(v){return String(v).toLowerCase();}).indexOf(String(email).toLowerCase())>=0;}
        function isEditor(email){return (sd.editors||[]).map(function(v){return String(v).toLowerCase();}).indexOf(String(email).toLowerCase())>=0;}
        function isCreator(email){return String(email).toLowerCase() === String(sd.creator||"").toLowerCase();}

        function save(){
          setData(function(prev){return Object.assign({},prev,{shareDialog:Object.assign({},prev.shareDialog,{saving:true})});});
          var body = {
            action:"update_access",
            userId:user.userId,
            dealId:sd.dealId,
            viewers:sd.viewers||[],
            editors:sd.editors||[]
          };
          fetch(WEBHOOK,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(body)})
            .then(function(r){return r.json();})
            .then(function(d){
              if(d && d.status==="ok"){
                close();
                refreshDeals();
                alert("✓ Sharing updated. Affected users will see this deal on their next portfolio refresh.");
              } else {
                alert("Couldn't update sharing: "+((d&&d.message)||"unknown error"));
                setData(function(prev){return Object.assign({},prev,{shareDialog:Object.assign({},prev.shareDialog,{saving:false})});});
              }
            })
            .catch(function(err){
              alert("Network error: "+err.message);
              setData(function(prev){return Object.assign({},prev,{shareDialog:Object.assign({},prev.shareDialog,{saving:false})});});
            });
        }

        return e("div",{
          onClick:function(ev){if(ev.target===ev.currentTarget) close();},
          style:{position:"fixed",inset:0,background:"rgba(30,31,92,0.45)",backdropFilter:"blur(2px)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}
        },
          e("div",{onClick:function(ev){ev.stopPropagation();},style:{background:"#fff",borderRadius:12,maxWidth:560,width:"100%",maxHeight:"85vh",overflow:"auto",boxShadow:"0 24px 60px rgba(30,31,92,0.25)"}},
            // Header
            e("div",{style:{padding:"20px 24px 12px",borderBottom:"1px solid #E8E9F5"}},
              e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"start",gap:12}},
                e("div",null,
                  e("div",{style:{fontSize:10,color:"#7278A0",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},"Share deal"),
                  e("h3",{style:{fontSize:18,fontWeight:800,color:"#2E2F8A",margin:0}},sd.dealName||"Untitled"),
                  sd.creator && e("div",{style:{fontSize:10,color:"#7278A0",marginTop:4}},"Owner: ",e("strong",null,sd.creator))
                ),
                e("button",{onClick:close,style:{background:"transparent",border:"none",fontSize:22,color:"#7278A0",cursor:"pointer",padding:4,lineHeight:1}},"×")
              )
            ),
            // Body
            e("div",{style:{padding:"16px 24px"}},
              sd.loading ? e("div",{style:{padding:"40px 0",textAlign:"center",color:"#7278A0",fontSize:12}},"Loading users...") :
              sd.error ? e("div",{style:{padding:"20px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:6,color:"#8A3A1A",fontSize:12}},sd.error) :
              e("div",null,
                e("p",{style:{fontSize:12,color:"#3A3D6A",lineHeight:1.6,marginBottom:14}},
                  "Choose who can see and edit this deal. ",e("strong",null,"Owners and editors")," can change all fields and save. ",e("strong",null,"Viewers")," see read-only data."
                ),
                // Header row
                e("div",{style:{display:"grid",gridTemplateColumns:"1fr 80px 80px",gap:8,padding:"8px 10px",background:"#F4F5FB",borderRadius:5,fontSize:10,fontWeight:700,color:"#7278A0",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}},
                  e("div",null,"User"),
                  e("div",{style:{textAlign:"center"}},"Can view"),
                  e("div",{style:{textAlign:"center"}},"Can edit")
                ),
                // User rows
                (sd.users||[]).length === 0 ? e("div",{style:{padding:"30px 12px",textAlign:"center",color:"#7278A0",fontSize:12}},"No other registered users yet. Have your team sign up first.") :
                (sd.users||[]).map(function(u){
                  var isMe = u.email === user.email;
                  var isOwn = isCreator(u.email);
                  return e("div",{key:u.userId,style:{display:"grid",gridTemplateColumns:"1fr 80px 80px",gap:8,padding:"10px",borderBottom:"1px solid #F0F1F8",alignItems:"center"}},
                    e("div",null,
                      e("div",{style:{fontSize:12,color:"#2E2F8A",fontWeight:600}},
                        u.email,
                        isMe && e("span",{style:{marginLeft:6,fontSize:9,padding:"1px 5px",background:"rgba(74,75,174,0.10)",color:"#4A4BAE",borderRadius:3,fontWeight:700}},"YOU"),
                        isOwn && e("span",{style:{marginLeft:6,fontSize:9,padding:"1px 5px",background:"rgba(45,122,101,0.10)",color:"#2D7A65",borderRadius:3,fontWeight:700}},"OWNER")
                      ),
                      u.name && e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2}},u.name)
                    ),
                    e("div",{style:{textAlign:"center"}},
                      isOwn ? e("span",{style:{fontSize:14,color:"#2D7A65"}},"✓") :
                      e("input",{type:"checkbox",checked:isViewer(u.email)||isEditor(u.email),onChange:function(){toggleViewer(u.email);},style:{width:16,height:16,cursor:"pointer",accentColor:"#4A4BAE"}})
                    ),
                    e("div",{style:{textAlign:"center"}},
                      isOwn ? e("span",{style:{fontSize:14,color:"#2D7A65"}},"✓") :
                      e("input",{type:"checkbox",checked:isEditor(u.email),onChange:function(){toggleEditor(u.email);},style:{width:16,height:16,cursor:"pointer",accentColor:"#2D7A65"}})
                    )
                  );
                }),
                // Tip
                e("div",{style:{marginTop:14,padding:"10px 12px",background:"#F8F9FC",borderLeft:"3px solid #4A4BAE",borderRadius:4,fontSize:10,color:"#7278A0",lineHeight:1.6}},
                  e("strong",{style:{color:"#3A3D6A"}},"Tip: "),"Owner always has full access. Editors can save and delete. Viewers see read-only. To stop sharing entirely, uncheck both boxes for that person."
                )
              )
            ),
            // Footer
            e("div",{style:{padding:"14px 24px",borderTop:"1px solid #E8E9F5",display:"flex",justifyContent:"flex-end",gap:8,background:"#F8F9FC"}},
              e("button",{onClick:close,style:{padding:"8px 16px",background:"transparent",border:"1px solid #C5C8E0",color:"#3A3D6A",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",letterSpacing:".05em",textTransform:"uppercase"}},"Cancel"),
              e("button",{
                onClick:save,
                disabled:sd.saving||sd.loading,
                style:{padding:"8px 18px",background:sd.saving?"#9A9DC0":"#2D7A65",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,cursor:sd.saving?"wait":"pointer",fontFamily:"DM Sans,sans-serif",letterSpacing:".05em",textTransform:"uppercase"}
              },sd.saving?"Saving...":"Save sharing")
            )
          )
        );
      })()
    );
  }
