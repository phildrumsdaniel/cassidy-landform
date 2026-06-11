// ── renderPlanningMonitor  (params: data, navTo, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderPlanningMonitor(data, navTo, up, user){
    var pm=data.planMonitor||{};
    var watchList=pm.watchList||[];
    var alerts=pm.alerts||[];
    var isSearching=pm.searching||false;

    // Planning Portal SPARQL/API endpoint
    function searchPlanningApps(postcode,lpa){
      if(!postcode&&!lpa)return;
      up("planMonitor","searching",true);
      up("planMonitor","searchError","");

      // Use AI to analyse planning pressure for the area
      var promptParts=[
        "You are a UK planning intelligence analyst. Analyse planning activity for this area and provide actionable intelligence for a residential land developer.",
        "AREA: "+(lpa||postcode),
        "POSTCODE: "+(postcode||"not provided"),
        "",
        "Search your knowledge for recent planning activity in this LPA area and provide:",
        "1. RECENT APPROVALS: Any significant residential outline or full planning approvals in the last 2 years (list 3-5 with approximate location and units)",
        "2. EMERGING ZONES: Areas showing increasing development pressure or emerging Local Plan allocations",
        "3. OPPORTUNITY SIGNALS: Any grey belt sites, Use Class Q conversions, appeal wins, or planning precedents that signal development opportunity",
        "4. LPA PERFORMANCE: Is this LPA achieving its housing target? 5-year land supply status?",
        "5. PLANNING PROBABILITY: On a scale 1-10, how pro-development is this LPA right now and why?",
        "6. HOT POSTCODE AREAS: Which postcode districts within this LPA have the strongest recent planning approval track record?",
        "7. WATCH LIST: 3 specific types of sites Cassidy Group should be targeting in this LPA right now",
        "",
        "Format as clear sections. Be specific with locations and numbers where possible."
      ].join("\n");

      callAI(user,"planMonitor","You are a senior UK planning intelligence analyst with deep knowledge of UK LPA decision-making, housing targets, 5-year land supply, and development trends.",promptParts)
      .then(function(result){
        var newAlerts=alerts.slice();
        newAlerts.unshift({
          id:Date.now(),
          lpa:lpa||postcode,
          postcode:postcode,
          date:new Date().toLocaleDateString("en-GB"),
          report:result,
          type:"ai_analysis"
        });
        up("planMonitor","alerts",newAlerts);
        up("planMonitor","searching",false);

        // Add to watch list if not already there
        var key=lpa||postcode;
        if(!watchList.some(function(w){return w.key===key;})){
          var newWatch=watchList.concat([{key:key,lpa:lpa,postcode:postcode,added:new Date().toLocaleDateString("en-GB")}]);
          up("planMonitor","watchList",newWatch);
        }
      })
      .catch(function(){
        up("planMonitor","searchError","Analysis failed — check connection and try again");
        up("planMonitor","searching",false);
      });
    }

    // Planning application types we watch
    var APP_TYPES=[
      {code:"outline",label:"Outline Planning",icon:"🏗",desc:"Major residential schemes — signals developer appetite"},
      {code:"reserved",label:"Reserved Matters",icon:"📐",desc:"Following outline — site moving to delivery"},
      {code:"full",label:"Full Planning",icon:"✓",desc:"Ready to build — comparable evidence"},
      {code:"appeal",label:"Appeal Wins",icon:"⚖",desc:"LPA overruled — creates precedent for similar sites"},
      {code:"classq",label:"Use Class Q/R",icon:"🌾",desc:"Agricultural conversions — rural opportunity signal"},
      {code:"prior",label:"Prior Approval",icon:"⚡",desc:"Fast-track conversions — quick-win sites"},
      {code:"grey",label:"Grey Belt",icon:"🔶",desc:"Weak Green Belt — NPPF 2024 opportunity"},
      {code:"pip",label:"Permission in Principle",icon:"📋",desc:"Emerging sites — early-stage opportunities"},
    ];

    // Planning Portal links by LPA
    function planPortalUrl(lpa,type){
      var searchLpa=encodeURIComponent(lpa||"");
      return "https://www.planning.data.gov.uk/entity/?dataset=local-authority&name="+searchLpa;
    }

    return e("div",null,
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}},
        e("div",null,
          e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Planning Monitor"),
          e("p",{style:{fontSize:12,color:"#7278A0"}},"Watch LPAs for planning activity that signals land opportunity. Spot sites before they hit the market.")
        ),
        e("a",{href:"https://www.planning.data.gov.uk/",target:"_blank",style:{padding:"8px 16px",background:"#4A4BAE",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6}},
          "🔗 Planning Data Gov UK ↗"
        )
      ),

      // SEARCH BAR
      e("div",{style:Object.assign({},S.card,{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",color:"#fff",marginBottom:16})},
        e("div",{style:{fontSize:13,fontWeight:700,color:"#EDE84A",marginBottom:10}},"🔍 Search Planning Intelligence"),
        e("div",{style:{display:"flex",gap:10,flexWrap:"wrap"}},
          e("input",{type:"text",value:pm.searchLpa||"",
            onChange:function(ev){up("planMonitor","searchLpa",ev.target.value);},
            placeholder:"LPA name — e.g. Somerset West and Taunton",
            style:{flex:2,padding:"10px 14px",borderRadius:7,border:"none",fontSize:13,fontFamily:"DM Sans,sans-serif",minWidth:200}
          }),
          e("input",{type:"text",value:pm.searchPc||"",
            onChange:function(ev){up("planMonitor","searchPc",ev.target.value);},
            placeholder:"Postcode — e.g. TA3",
            style:{flex:1,padding:"10px 14px",borderRadius:7,border:"none",fontSize:13,fontFamily:"DM Sans,sans-serif",minWidth:120}
          }),
          e("button",{
            onClick:function(){searchPlanningApps(pm.searchPc||"",pm.searchLpa||"");},
            disabled:isSearching||(!pm.searchLpa&&!pm.searchPc),
            style:{padding:"10px 20px",background:"#EDE84A",border:"none",borderRadius:7,color:"#1E1F5C",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",opacity:isSearching?0.7:1}
          },isSearching?"⏳ Analysing...":"📡 Analyse LPA")
        ),
        pm.searchError&&e("div",{style:{marginTop:8,fontSize:11,color:"#EDE84A"}},pm.searchError),
        e("div",{style:{marginTop:8,fontSize:10,color:"rgba(255,255,255,0.5)"}},"AI analyses planning pressure, approval rates, grey belt opportunities and emerging allocations for your target LPA")
      ),

      // WATCH LIST
      watchList.length>0&&e("div",{style:S.card},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
          e("div",{style:S.cardTitle},"Watch List — Active LPAs"),
          e("div",{style:{fontSize:10,color:"#7278A0"}},watchList.length+" LPAs monitored")
        ),
        e("div",{style:{display:"flex",flexWrap:"wrap",gap:8}},
          watchList.map(function(w,i){
            return e("div",{key:i,style:{background:"#F0F1FA",border:"1px solid #DDE0ED",borderRadius:6,padding:"6px 12px",display:"flex",alignItems:"center",gap:8,fontSize:11}},
              e("span",{style:{fontWeight:700,color:"#2E2F8A"}},w.lpa||w.postcode),
              e("span",{style:{color:"#7278A0",fontSize:9}},"added "+w.added),
              e("button",{onClick:function(){
                var newList=watchList.filter(function(_,j){return j!==i;});
                up("planMonitor","watchList",newList);
              },style:{background:"none",border:"none",color:"#B05A35",cursor:"pointer",fontSize:14,padding:"0 2px"}},"×")
            );
          })
        )
      ),

      // WHAT TO WATCH FOR
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Planning Signals — What to Watch For"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10,marginBottom:8}},
          APP_TYPES.map(function(t){
            return e("a",{key:t.code,
              href:"https://www.planning.data.gov.uk/entity/?dataset=development-policy-document",
              target:"_blank",
              style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,padding:"12px 14px",textDecoration:"none",display:"block",transition:"all .15s",cursor:"pointer"}},
              e("div",{style:{fontSize:18,marginBottom:4}},t.icon),
              e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A",marginBottom:2}},t.label),
              e("div",{style:{fontSize:10,color:"#7278A0",lineHeight:1.5}},t.desc)
            );
          })
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:8}},
          [
            {label:"Planning Portal — Search Apps",url:"https://www.planningportal.co.uk/",desc:"Search live planning applications by postcode"},
            {label:"Planning Data Gov UK",url:"https://www.planning.data.gov.uk/",desc:"National dataset of planning decisions and allocations"},
            {label:"PINS Appeal Decisions",url:"https://acp.planninginspectorate.gov.uk/",desc:"Planning Inspectorate — appeal wins create precedent"},
          ].map(function(link){
            return e("a",{key:link.label,href:link.url,target:"_blank",
              style:{background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:7,padding:"10px 12px",textDecoration:"none",display:"block"}},
              e("div",{style:{fontSize:11,fontWeight:700,color:"#4A4BAE",marginBottom:2}},link.label+" ↗"),
              e("div",{style:{fontSize:10,color:"#7278A0"}},link.desc)
            );
          })
        )
      ),

      // AI ANALYSIS RESULTS
      alerts.length>0&&e("div",null,
        e("div",{style:S.cardTitle},"Planning Intelligence Reports"),
        alerts.map(function(alert,i){
          return e("div",{key:alert.id,style:Object.assign({},S.card,{borderLeft:"4px solid #4A4BAE",marginBottom:12})},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
              e("div",null,
                e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A"}},alert.lpa),
                e("div",{style:{fontSize:10,color:"#7278A0"}},"Analysed: "+alert.date)
              ),
              e("div",{style:{display:"flex",gap:8}},
                e("button",{onClick:function(){
                  // Load this LPA into land appraisal
                  up("land","localAuthority",alert.lpa);
                  up("land","city",alert.lpa.toLowerCase().split(" ")[0]);
                  navTo("land");
                },style:{padding:"5px 12px",background:"#2D7A65",border:"none",borderRadius:5,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"→ Use in Appraisal"),
                e("button",{onClick:function(){
                  var newAlerts=alerts.filter(function(_,j){return j!==i;});
                  up("planMonitor","alerts",newAlerts);
                },style:{padding:"5px 10px",background:"none",border:"1px solid #DDE0ED",borderRadius:5,color:"#B05A35",fontSize:10,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Remove")
              )
            ),
            e("div",{style:{maxHeight:400,overflowY:"auto",background:"#F8F8FE",borderRadius:7,padding:"14px 16px"}},
              e("pre",{style:{fontSize:11,lineHeight:1.9,color:"#3A3D6A",whiteSpace:"pre-wrap",fontFamily:"DM Sans,sans-serif",margin:0}},alert.report)
            )
          );
        })
      ),

      // EMPTY STATE
      alerts.length===0&&e("div",{style:{textAlign:"center",padding:"40px 20px",color:"#7278A0"}},
        e("div",{style:{fontSize:40,marginBottom:12}},"📡"),
        e("div",{style:{fontSize:14,fontWeight:700,color:"#2E2F8A",marginBottom:6}},"No planning intelligence yet"),
        e("div",{style:{fontSize:12,lineHeight:1.7}},"Enter a target LPA or postcode above and click Analyse LPA.",e("br"),"The AI will analyse planning pressure, recent approvals, grey belt opportunities and what sites to target.")
      )
    );
  }
