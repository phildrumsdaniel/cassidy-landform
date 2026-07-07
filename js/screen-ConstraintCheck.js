// ── renderConstraintCheck  (params: data, navTo, up, user)
// Lifted out of Tool; body byte-unchanged. Takes the Tool variables it uses as
// explicit params; all other names resolve to globals. Loaded before 05-tool.js.
function renderConstraintCheck(data, navTo, up, user){
    var cc=data.constraintCheck||{};
    var isChecking=cc.checking||false;
    var results=cc.results||null;

    function runConstraintCheck(){
      var pc=cc.postcode||"";
      var addr=cc.address||"";
      if(!pc&&!addr)return;
      up("constraintCheck","checking",true);
      up("constraintCheck","error","");
      up("constraintCheck","results",null);

      var promptParts=[
        "You are a UK planning consultant and GIS analyst. Provide a rapid constraint assessment for a potential development site.",
        "SITE: "+(addr||pc),
        "POSTCODE: "+pc,
        "",
        "Assess ALL of the following constraints and opportunities. For each, give: status (✓ Clear / ⚠ Check / ✗ Constraint), detail, and commercial impact.",
        "",
        "PLANNING CONSTRAINTS:",
        "1. Green Belt designation (is this postcode area typically Green Belt?)",
        "2. Conservation Area proximity",
        "3. Article 4 Direction likelihood",
        "4. AONB or National Park",
        "5. Local Plan allocation (likely allocated, unallocated, or safeguarded?)",
        "",
        "PHYSICAL CONSTRAINTS:",
        "6. Flood Risk Zone (Zone 1 clear / Zone 2-3 constraint)",
        "7. Agricultural Land Classification (Grade 1-2 = constraint for development)",
        "8. Topography issues (flat, sloping, or significantly challenging?)",
        "",
        "ECOLOGY:",
        "9. SSSI proximity risk",
        "10. Ancient Woodland proximity risk",
        "11. Biodiversity Net Gain requirement (mandatory 10%)",
        "",
        "INFRASTRUCTURE:",
        "12. Utilities proximity (mains water, sewage, gas, electric)",
        "13. Highways / road access assessment",
        "14. Public transport accessibility",
        "15. School capacity in area",
        "",
        "OPPORTUNITIES:",
        "16. Grey Belt potential (weak Green Belt, fragmented boundary?)",
        "17. Use Class Q / agricultural conversion potential",
        "18. Nearby planning precedents that support development",
        "19. NPPF 2024 tilted balance applicability",
        "",
        "PLANNING PROBABILITY SCORE:",
        "Give an overall planning probability score 1-100 with reasoning.",
        "Breakdown: Planning policy score (x/25), Physical constraints score (x/25), Ecology score (x/25), Infrastructure score (x/25)",
        "",
        "END with: GO / CAUTION / AVOID and one sentence why.",
        "",
        "Base on your knowledge of UK planning policy and typical patterns for this type of area. Be specific and commercially focused."
      ].join("\n");

      callAI(user,"constraintCheck","You are a senior UK planning consultant providing rapid site constraint assessments for residential land developers.",promptParts)
      .then(function(result){
        // Parse score from result
        var scoreMatch=result.match(/(\d{1,3})\s*(?:out of|\/)\s*100/i)||result.match(/score[:\s]+(\d{1,3})/i);
        var score=scoreMatch?parseInt(scoreMatch[1]):null;
        // v10.8 — robust verdict parse: match GO/CAUTION/AVOID as WHOLE WORDS,
        // case-insensitively, and take the LAST one (the closing verdict line). The old
        // regex had stray control bytes baked in, so it never matched — verdict stayed
        // null, the banner silently showed "AVOID", and the Scorecard read "Not assessed".
        var vAll=result.match(/\b(GO|CAUTION|AVOID)\b/gi);
        var verdict=(vAll&&vAll.length)?vAll[vAll.length-1].toUpperCase():null;
        // Fall back to the probability score when the model didn't label a verdict.
        if(!verdict && score!=null) verdict = score>=60?"GO":score>=40?"CAUTION":"AVOID";
        up("constraintCheck","results",{report:result,score:score,verdict:verdict,site:addr||pc,date:new Date().toLocaleDateString("en-GB")});
        up("constraintCheck","checking",false);

        // Auto-populate land appraisal if we have data
        if(addr)up("land","address",addr);
        if(pc){up("land","postcode",pc); up("rlv","postcode",pc);}
      })
      .catch(function(){
        up("constraintCheck","error","Constraint check failed — check connection");
        up("constraintCheck","checking",false);
      });
    }

    var verdictColor=results&&results.verdict==="GO"?"#2D7A65":results&&results.verdict==="CAUTION"?"#9A7B3E":"#B05A35";

    var CONSTRAINT_LINKS=[
      {label:"Flood Map for Planning",url:"https://flood-map-for-planning.service.gov.uk/",icon:"💧"},
      {label:"Magic Map (Natural England)",url:"https://magic.defra.gov.uk/MagicMap.aspx",icon:"🗺"},
      {label:"Land Registry Title Search",url:"https://eservices.landregistry.gov.uk/eservices/FindAProperty/view/QuickEnquiryInit.do",icon:"📜"},
      {label:"Environment Agency Flood",url:"https://environment.data.gov.uk/flood-planning/r/flood-risk-zones",icon:"🌊"},
      {label:"Historic England (Listed/Conservation)",url:"https://historicengland.org.uk/listing/the-list/",icon:"🏛"},
      {label:"SSSI / Natural England",url:"https://www.gov.uk/guidance/protected-sites-and-areas-how-to-check-if-your-land-is-affected",icon:"🌿"},
    ];

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Constraint Check"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:16}},"Rapid AI assessment of planning constraints, physical issues and development opportunity for any site. Replaces hours of manual checking across 6+ government websites."),

      // SEARCH
      e("div",{style:Object.assign({},S.card,{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",color:"#fff"})},
        e("div",{style:{fontSize:13,fontWeight:700,color:"#EDE84A",marginBottom:10}},"⚠ Check Site Constraints"),
        e("div",{style:{display:"flex",gap:10,flexWrap:"wrap",marginBottom:8}},
          e("input",{type:"text",value:cc.address||"",
            onChange:function(ev){up("constraintCheck","address",ev.target.value);},
            placeholder:"Site address — e.g. Land West of Bushy Cross Lane, Ruishton",
            style:{flex:2,padding:"10px 14px",borderRadius:7,border:"none",fontSize:12,fontFamily:"DM Sans,sans-serif",minWidth:200}
          }),
          e("input",{type:"text",value:cc.postcode||"",
            onChange:function(ev){up("constraintCheck","postcode",ev.target.value);},
            placeholder:"Postcode e.g. TA3 5LS",
            style:{flex:1,padding:"10px 14px",borderRadius:7,border:"none",fontSize:12,fontFamily:"DM Sans,sans-serif",minWidth:120}
          }),
          e("button",{
            onClick:runConstraintCheck,
            disabled:isChecking||(!cc.postcode&&!cc.address),
            style:{padding:"10px 20px",background:"#EDE84A",border:"none",borderRadius:7,color:"#1E1F5C",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",opacity:isChecking?0.7:1}
          },isChecking?"⏳ Checking...":"⚠ Check Constraints")
        ),
        cc.error&&e("div",{style:{fontSize:11,color:"#EDE84A"}},cc.error),
        e("div",{style:{fontSize:10,color:"rgba(255,255,255,0.5)"}},"AI checks: Green Belt, flood risk, SSSI, TPOs, Article 4, AONB, Conservation Area, highways, ecology, planning precedent and more")
      ),

      // RESULTS
      results&&e("div",null,
        // Verdict banner
        e("div",{style:{background:verdictColor+"15",border:"2px solid "+verdictColor,borderRadius:10,padding:"16px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:16}},
          e("div",{style:{fontSize:36,fontWeight:900,color:verdictColor,minWidth:80,textAlign:"center"}},
            results.verdict==="GO"?"✓ GO":results.verdict==="CAUTION"?"⚠ CAUTION":"✗ AVOID"
          ),
          e("div",{style:{flex:1}},
            e("div",{style:{fontSize:14,fontWeight:800,color:verdictColor}},"Constraint Assessment — "+results.site),
            e("div",{style:{fontSize:11,color:"#7278A0"}},"Assessed: "+results.date),
            results.score&&e("div",{style:{marginTop:6}},
              e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:4}},"Planning Probability Score"),
              e("div",{style:{height:8,background:"#DDE0ED",borderRadius:4,overflow:"hidden",width:200}},
                e("div",{style:{height:"100%",width:(results.score||0)+"%",background:results.score>=60?"#2D7A65":results.score>=40?"#9A7B3E":"#B05A35",transition:"width 1s"}})
              ),
              e("div",{style:{fontSize:14,fontWeight:800,color:verdictColor,marginTop:2}},(results.score||0)+"/100")
            )
          ),
          e("button",{onClick:function(){
            navTo("land");
          },style:{padding:"8px 16px",background:verdictColor,border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}},"→ Go to Appraisal")
        ),

        // Full report
        e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid "+verdictColor})},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
            e("div",{style:S.cardTitle},"Full Constraint Report"),
            e("button",{onClick:function(){
              var el=document.createElement("textarea");
              el.value=results.report;
              document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);
              alert("Report copied to clipboard");
            },style:{padding:"5px 12px",background:"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"📋 Copy Report")
          ),
          e("div",{style:{maxHeight:500,overflowY:"auto"}},
            e("pre",{style:{fontSize:11,lineHeight:1.9,color:"#3A3D6A",whiteSpace:"pre-wrap",fontFamily:"DM Sans,sans-serif",margin:0}},results.report)
          )
        )
      ),

      // QUICK LINKS
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Government Constraint Data Sources"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8}},
          CONSTRAINT_LINKS.map(function(link){
            return e("a",{key:link.label,href:link.url,target:"_blank",
              style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:7,padding:"10px 12px",textDecoration:"none",display:"flex",alignItems:"center",gap:8}},
              e("span",{style:{fontSize:18}},link.icon),
              e("div",null,
                e("div",{style:{fontSize:11,fontWeight:700,color:"#2E2F8A"}},link.label+" ↗"),
                e("div",{style:{fontSize:9,color:"#7278A0"}},"gov.uk")
              )
            );
          })
        )
      )
    );
  }
