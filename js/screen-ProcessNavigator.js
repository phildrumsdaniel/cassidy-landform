// ── renderProcessNavigator  (params: ALL_STAGES, data, exitUnlocksStage, exits, isExitOn, isSchemeOn, navTo, schemes, setFlowAssetType, setSchemes, toggleExit, up)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderProcessNavigator(ALL_STAGES, data, exitUnlocksStage, exits, isExitOn, isSchemeOn, navTo, schemes, setFlowAssetType, setSchemes, toggleExit, up){
    var nav = data.navigator || {};
    // Determine current step from state — and from what's already chosen
    var step = nav.step;
    if(!step){
      // Auto-advance based on what's already chosen
      if(schemes.length>0 && exits.length>0) step = 3;
      else if(schemes.length>0) step = 2;
      else step = 1;
    }

    // Scheme definitions for page 1
    var SCHEMES_NAV = [
      {key:"asset",    label:"Existing Asset I Own",  icon:"🏛", desc:"Asset already built or operating — PBSA, BTR, SFH portfolio, pub, hotel, industrial, office, retail. Skip acquisition stages and jump straight to exit comparison and optimisation.", isExisting:true},
      {key:"sfh",      label:"Single Family Homes",  icon:"🏡", desc:"Estate of houses for sale or rent — terraced, semis, detached. Build and exit through retail, HA or institutional portfolio."},
      {key:"btr",      label:"Build to Rent",        icon:"🏢", desc:"Single block of apartments owned by one institutional landlord. Designed for renting from day one — gym, concierge, amenity space."},
      {key:"pbsa",     label:"Purpose-Built Student",icon:"🎓", desc:"Student accommodation near a Russell Group / RG-tier university. Weekly rents, term-time occupancy, operator-led."},
      {key:"land",     label:"Land Strategy",        icon:"🔍", desc:"Buy land with no planning, promote through Local Plan / Reg 18-19 / SHELAA, sell to a housebuilder with consent. You don't build."},
      {key:"property", label:"Property Evaluation",  icon:"🏠", desc:"Existing building — pub, office, big house, bungalow. Either refurbish and sell, or demolish and redevelop."},
      {key:"recovery", label:"Planning Recovery",    icon:"⚖",  desc:"Existing scheme refused, withdrawn or stalled. Buying to fix the planning — appeal, redesign, or pre-app rescue."}
    ];

    // Exit definitions — which exits make sense for which schemes
    var EXITS_NAV = [
      {key:"pension",     label:"Pension Fund",      icon:"💼", schemes:["sfh","btr","pbsa"], desc:"Domestic UK pension scheme (LGPS, USS, RPMI). 10-25 year hold. Yield 4.0-4.5%."},
      {key:"sovereign",   label:"Sovereign Wealth",  icon:"🌐", schemes:["btr","pbsa","sfh"], desc:"QIA / GIC / ADIA / CIC. Cheque sizes £50m+. Yield 3.8-4.5% for trophy."},
      {key:"btr_op",      label:"BTR Operator",      icon:"🏢", schemes:["btr","pbsa","sfh"], desc:"Grainger / Packaged Living / L&G Affordable / Quintain. Often forward-fund."},
      {key:"family",      label:"Family Office",     icon:"👑", schemes:["sfh","btr","pbsa","property"], desc:"HNW capital. £5-50m typical. Yield 4.5-5.0%. Often want story over yield."},
      {key:"ha_rp",       label:"HA / RP Bulk",      icon:"🏛", schemes:["sfh","btr"], desc:"Clarion / Sanctuary / L&Q / Places. S106 affordable transfer. 60-70% OMV."},
      {key:"homes_eng",   label:"Homes England",     icon:"🇬🇧", schemes:["sfh","btr"], desc:"Government housing delivery body. Affordable Homes Programme grants + completion buy."},
      {key:"open_mkt",    label:"Open Market Sale",  icon:"🏠", schemes:["sfh","property"], desc:"Individual home-buyers or PLC housebuilder (Persimmon / Barratt / TW / Bellway)."},
      {key:"bank_takeout",label:"Bank Take-out",     icon:"🏦", schemes:["btr","pbsa","sfh"], desc:"Developer keeps the asset. Refinance construction debt onto investment debt at 55-65% LTV."},
      {key:"land_sale",   label:"Sell Land + Planning",icon:"📜",schemes:["land","sfh"], desc:"Land with full / outline planning sold to a housebuilder. You never build anything."}
    ];

    // Helper to set step
    function setStep(n){ up("navigator","step",n); }

    // Helper to navigate to a stage (and remember return to navigator)
    function jumpToStage(stageId){
      up("navigator","step",3);  // ensure we return to step 3 on next visit
      navTo(stageId);
    }

    // Common card styling
    var cardStyle = {
      background:"#fff",
      border:"2px solid #DDE0ED",
      borderRadius:12,
      padding:"18px 20px",
      cursor:"pointer",
      transition:"all .15s",
      position:"relative"
    };
    var cardStyleActive = Object.assign({},cardStyle,{
      border:"2px solid #2D7A65",
      background:"linear-gradient(135deg,rgba(45,122,101,0.04),rgba(74,75,174,0.04))",
      boxShadow:"0 4px 20px rgba(45,122,101,0.18)"
    });

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 1 — Choose scheme
    // ─────────────────────────────────────────────────────────────────────
    if(step===1){
      return e("div",null,
        // Header
        e("div",{style:{textAlign:"center",marginBottom:24}},
          e("div",{style:{fontSize:10,letterSpacing:".25em",textTransform:"uppercase",color:"#7278A0",marginBottom:8,fontWeight:700}},"Process Navigator · Step 1 of 3"),
          e("h2",{style:{fontSize:26,fontWeight:800,color:"#2E2F8A",marginBottom:6}},"What are you building?"),
          e("p",{style:{fontSize:13,color:"#7278A0",maxWidth:560,margin:"0 auto"}},"Pick the scheme type — your selection drives every stage and decision that follows. You can change it later.")
        ),

        // Start ellipse (visual flowchart cue)
        e("div",{style:{display:"flex",justifyContent:"center",marginBottom:18}},
          e("div",{style:{background:"#FFE5D9",border:"2px solid #B05A35",borderRadius:30,padding:"8px 28px",fontSize:12,fontWeight:800,color:"#B05A35",letterSpacing:".1em",textTransform:"uppercase"}},"▶ Start")
        ),

        // Connector line
        e("div",{style:{textAlign:"center",fontSize:18,color:"#B5BAD6",marginBottom:14}},"│"),

        // Scheme cards
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}},
          SCHEMES_NAV.map(function(s){
            var isPicked = isSchemeOn(s.key);
            return e("div",{key:s.key,
              onClick:function(){
                setSchemes([s.key]); // single-scheme selection from navigator
                setFlowAssetType(s.key);
                if(s.isExisting){
                  // Existing Asset path — skip exit picker, go straight to Optimiser
                  navTo("assetOptimiser");
                } else {
                  setStep(2);
                }
              },
              style:isPicked?cardStyleActive:cardStyle
            },
              s.isExisting&&e("div",{style:{position:"absolute",top:8,left:8,background:"#9A7B3E",color:"#fff",fontSize:8,fontWeight:800,padding:"3px 7px",borderRadius:3,letterSpacing:".08em"}},"FAST TRACK"),
              isPicked&&e("div",{style:{position:"absolute",top:10,right:12,fontSize:18,color:"#2D7A65",fontWeight:800}},"✓"),
              e("div",{style:{fontSize:36,marginBottom:10,marginTop:s.isExisting?12:0}},s.icon),
              e("div",{style:{fontSize:16,fontWeight:800,color:"#1E1F5C",marginBottom:6}},s.label),
              e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.55}},s.desc),
              e("div",{style:{marginTop:12,paddingTop:10,borderTop:"1px solid #F0F1FA",fontSize:10,color:s.isExisting?"#2D7A65":"#4A4BAE",fontWeight:700,letterSpacing:".05em"}},
                s.isExisting?"Skip to exit comparison →":"Select →"
              )
            );
          })
        ),

        // Help footer
        e("div",{style:{marginTop:26,padding:"14px 16px",background:"#F8F8FE",borderLeft:"3px solid #4A4BAE",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.65}},
          e("strong",{style:{color:"#1E1F5C"}},"Tip: "),
          "Pick the scheme you're MOST likely to do. You can return to this Navigator at any time to change your selection — the workflow updates automatically."
        )
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 2 — Choose exit route
    // ─────────────────────────────────────────────────────────────────────
    if(step===2){
      var currentScheme = schemes[0] || "sfh";
      var schemeDef = SCHEMES_NAV.find(function(s){return s.key===currentScheme;}) || SCHEMES_NAV[0];
      // Filter exits — only show those that make sense for the chosen scheme
      var availableExits = EXITS_NAV.filter(function(ex){return ex.schemes.indexOf(currentScheme)>=0;});

      return e("div",null,
        e("div",{style:{textAlign:"center",marginBottom:20}},
          e("div",{style:{fontSize:10,letterSpacing:".25em",textTransform:"uppercase",color:"#7278A0",marginBottom:8,fontWeight:700}},"Process Navigator · Step 2 of 3"),
          e("h2",{style:{fontSize:26,fontWeight:800,color:"#2E2F8A",marginBottom:6}},"How will the scheme exit?"),
          e("p",{style:{fontSize:13,color:"#7278A0",maxWidth:620,margin:"0 auto"}},"Tick every likely exit route. A scheme can split between private sale, HA/RP, retained rent, institutional bulk sale, pension/family office capital, or land sale.")
        ),

        // Breadcrumb: Scheme chosen
        e("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}},
          e("div",{style:{background:"rgba(45,122,101,0.1)",border:"2px solid #2D7A65",borderRadius:8,padding:"8px 14px",display:"flex",alignItems:"center",gap:8}},
            e("span",{style:{fontSize:18}},schemeDef.icon),
            e("div",null,
              e("div",{style:{fontSize:8,color:"#2D7A65",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700}},"Scheme"),
              e("div",{style:{fontSize:13,fontWeight:800,color:"#1E1F5C"}},schemeDef.label)
            ),
            e("span",{onClick:function(){setStep(1);},style:{marginLeft:8,fontSize:10,color:"#4A4BAE",cursor:"pointer",textDecoration:"underline",fontWeight:700}},"change")
          ),
          e("div",{style:{fontSize:18,color:"#B5BAD6"}},"→"),
          e("div",{style:{background:"#FFF8E5",border:"2px dashed #B05A35",borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:700,color:"#B05A35"}},"Tick exit routes")
        ),

        // Exit cards
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}},
          availableExits.map(function(ex){
            var isPicked = isExitOn(ex.key);
            return e("div",{key:ex.key,
              onClick:function(){
                toggleExit(ex.key);
              },
              style:Object.assign({},(isPicked?cardStyleActive:cardStyle),{padding:"14px 16px"})
            },
              isPicked&&e("div",{style:{position:"absolute",top:8,right:10,fontSize:14,color:"#2D7A65",fontWeight:800}},"✓"),
              e("div",{style:{position:"absolute",top:10,right:12,width:20,height:20,borderRadius:4,border:"2px solid "+(isPicked?"#2D7A65":"#C5C8E0"),background:isPicked?"#2D7A65":"#fff",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13,fontWeight:800}},isPicked?"✓":""),
              e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:6}},
                e("div",{style:{fontSize:24}},ex.icon),
                e("div",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},ex.label)
              ),
              e("div",{style:{fontSize:10,color:"#7278A0",lineHeight:1.5}},ex.desc)
            );
          })
        ),

        exits.length>0&&e("div",{style:{marginTop:16,textAlign:"right",fontSize:11,color:"#2D7A65",fontWeight:800}},exits.length+" exit route"+(exits.length>1?"s":"")+" selected - continue when ready"),

        // Back + Skip
        e("div",{style:{marginTop:20,display:"flex",justifyContent:"space-between",alignItems:"center"}},
          e("button",{onClick:function(){setStep(1);},style:{padding:"8px 16px",background:"#F4F5FB",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#7278A0",cursor:"pointer"}},"← Back to scheme"),
          e("button",{onClick:function(){setStep(3);},style:{padding:"8px 16px",background:"#F4F5FB",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#7278A0",cursor:"pointer"}},"Skip — decide exit later →")
        ),

        // Tip
        e("div",{style:{marginTop:18,padding:"14px 16px",background:"#F8F8FE",borderLeft:"3px solid #4A4BAE",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.65}},
          e("strong",{style:{color:"#1E1F5C"}},"Why this matters: "),
          "An institutional buyer (Pension / SWF) demands 4.0–4.5% yield, an Investor Memorandum and a full Data Room. An Open Market sale doesn't. Picking the right exit early avoids re-doing work."
        )
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 3 — Workflow (mirrors sidebar exactly)
    // ─────────────────────────────────────────────────────────────────────
    if(step===3){
      var currentScheme3 = schemes[0] || "sfh";
      var schemeDef3 = SCHEMES_NAV.find(function(s){return s.key===currentScheme3;}) || SCHEMES_NAV[0];
      var currentExit = exits[0];
      var exitDef = currentExit ? EXITS_NAV.find(function(x){return x.key===currentExit;}) : null;
      var exitDefs = exits.map(function(k){return EXITS_NAV.find(function(x){return x.key===k;});}).filter(Boolean);

      // Get the filtered stage list — same logic as sidebar's activeStages
      var workflowStages = ALL_STAGES.filter(function(s){
        if(s.id==="navigator") return false; // exclude self
        if(!s.journeys) return true;
        // Scheme match
        for(var sj=0;sj<schemes.length;sj++){
          if(s.journeys.indexOf(schemes[sj])>=0) return true;
        }
        // Exit unlock
        if(exitUnlocksStage(s.id)) return true;
        // Universal records
        if(s.journeys.length===1 && s.journeys[0]==="all") return true;
        return false;
      });

      // Group stages
      var stageGroups = {};
      workflowStages.forEach(function(s){
        if(!stageGroups[s.group]) stageGroups[s.group] = [];
        stageGroups[s.group].push(s);
      });
      var groupOrder = ["1. Find","2. Value","3. Develop","4. Exit","5. Report","6. Records","7. Audit"];

      // Helper — return stage status: "not_started" / "in_progress" / "completed"
      // Each stage has its own "required fields" map — stage is completed
      // only when ALL required fields are populated for that stage type
      var STAGE_REQUIRED_FIELDS = {
        placona:      ["selectedCounties"],  // Placona is "complete" if you've at least selected counties
        monitor:      ["postcode","lpa"],
        constraint:   ["constraints","result"],
        scraper:      ["lastSearch"],
        land:         ["address","postcode","acres","city","constraint","tenure"],
        epe:          ["address","postcode","city","newPsf","salePsf"],
        rlv:          ["postcode","acres","units","salePsf","buildPsf"],
        sfh:          ["city","totalUnits","basePsf","avgSqft","mix"],
        hra:          ["city","units","sPsf","oPsf","tPsf"],
        capitalise:   ["targetYield","netAnnualIncome"],
        planning:     ["units","lpa","status","s106pu","afhPct"],
        fin:          ["units","buildPsf","feesPct","contingency","finRate","profitPct"],
        viability:    ["gdv","totalCost","landCost","profit"],
        dd:           ["title","planning","environmental","utilities"],
        risks:        ["riskRegister"],
        exit:         ["agent","units","targetYield","route"],
        recovery:     ["status","appealReason"],
        scorecard:    ["address","postcode","acres","units","askingPrice"],
        teaser:       ["headline","investmentHighlights"],
        im:           ["executiveSummary","investmentRationale"],
        grants:       ["scheme","unitsAffordable"],
        dataroom:     ["audience"],
        summary:      [],  // summary is auto-generated, no required fields
        meetings:     ["meetings"],
        portfolio:    ["deals"],
        dashboard:    []
      };

      function stageStatus(stageId){
        var d = data[stageId];
        if(!d) return "not_started";

        // Count how many fields are populated
        var populatedCount = 0;
        for(var k in d){
          var v = d[k];
          if(v===null || v===undefined || v==="" || v===false) continue;
          if(typeof v === "object" && Array.isArray(v) && v.length===0) continue;
          if(typeof v === "object" && !Array.isArray(v) && Object.keys(v).length===0) continue;
          if(v === 0) continue;  // numeric zero doesn't count
          populatedCount++;
        }

        if(populatedCount === 0) return "not_started";

        // Check required fields — if all present, completed
        var requiredFields = STAGE_REQUIRED_FIELDS[stageId] || [];
        if(requiredFields.length === 0){
          // No required fields defined — any data means "in progress"
          return "in_progress";
        }

        var requiredPopulated = requiredFields.filter(function(f){
          var v = d[f];
          if(v===null || v===undefined || v==="" || v===false || v===0) return false;
          if(typeof v === "object" && Array.isArray(v) && v.length===0) return false;
          if(typeof v === "object" && !Array.isArray(v) && Object.keys(v).length===0) return false;
          return true;
        }).length;

        if(requiredPopulated === requiredFields.length) return "completed";
        return "in_progress";
      }

      // Backwards-compat helper (still used in some places below)
      function stageDone(stageId){
        return stageStatus(stageId) !== "not_started";
      }

      // Decision diamonds that appear at key checkpoints
      var DIAMONDS = {
        "rlv": {  // After Land Valuation
          q: "Is RLV ≥ asking price?",
          yes: "Continue to Planning",
          no: "Renegotiate vendor or walk away"
        },
        "viability": {  // After Detailed Appraisal
          q: "Is profit margin ≥ 15%?",
          yes: "Continue to DD",
          no: "Re-test assumptions or refine scheme"
        },
        "dd": {  // After Due Diligence
          q: "Any blocking risks?",
          yes: "Mitigate before proceeding",
          no: "Continue to investor pack"
        }
      };

      var totalStages = workflowStages.length;
      var completedStages = workflowStages.filter(function(s){return stageStatus(s.id)==="completed";}).length;
      var inProgressStages = workflowStages.filter(function(s){return stageStatus(s.id)==="in_progress";}).length;
      var completionPct = totalStages>0 ? Math.round(completedStages/totalStages*100) : 0;

      // Group colours (matches sidebar groups)
      var groupColors = {
        "1. Find":      "#4A4BAE",
        "2. Value":     "#2D7A65",
        "3. Develop":   "#9A7B3E",
        "4. Exit":      "#B05A35",
        "5. Report":    "#1E1F5C",
        "6. Records":   "#7278A0"
      };

      var stageCounter = 0;

      return e("div",null,
        // Header
        e("div",{style:{textAlign:"center",marginBottom:18}},
          e("div",{style:{fontSize:10,letterSpacing:".25em",textTransform:"uppercase",color:"#7278A0",marginBottom:8,fontWeight:700}},"Process Navigator · Step 3 of 3"),
          e("h2",{style:{fontSize:26,fontWeight:800,color:"#2E2F8A",marginBottom:6}},"Your deal workflow"),
          e("p",{style:{fontSize:13,color:"#7278A0",maxWidth:600,margin:"0 auto"}},"Follow these stages in order. Click any box to jump straight to that stage in Landform. Decision points appear at key checkpoints.")
        ),

        // Breadcrumbs — scheme + exit chosen
        e("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",gap:10,marginBottom:18,flexWrap:"wrap"}},
          e("div",{onClick:function(){setStep(1);},style:{background:"rgba(45,122,101,0.1)",border:"2px solid #2D7A65",borderRadius:8,padding:"8px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer"}},
            e("span",{style:{fontSize:18}},schemeDef3.icon),
            e("div",null,
              e("div",{style:{fontSize:8,color:"#2D7A65",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700}},"Scheme"),
              e("div",{style:{fontSize:12,fontWeight:800,color:"#1E1F5C"}},schemeDef3.label)
            )
          ),
          e("div",{style:{fontSize:16,color:"#B5BAD6"}},"+"),
          exitDefs.length>0?e("div",{onClick:function(){setStep(2);},style:{background:"rgba(154,123,62,0.1)",border:"2px solid #9A7B3E",borderRadius:8,padding:"8px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",maxWidth:520}},
            e("span",{style:{fontSize:18}},exitDefs.length>1?"✓":exitDefs[0].icon),
            e("div",null,
              e("div",{style:{fontSize:8,color:"#9A7B3E",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700}},"Exit routes"),
              e("div",{style:{fontSize:12,fontWeight:800,color:"#1E1F5C"}},exitDefs.map(function(x){return x.label;}).join(" + "))
            )
          ):e("div",{onClick:function(){setStep(2);},style:{background:"#FFF8E5",border:"2px dashed #B05A35",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,color:"#B05A35",cursor:"pointer"}},"+ Add exit route")
        ),

        // Progress bar
        e("div",{style:{background:"linear-gradient(135deg,#1E1F5C 0%,#2E2F8A 100%)",color:"#fff",borderRadius:10,padding:"14px 18px",marginBottom:20}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:10}},
            e("div",null,
              e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:".12em",textTransform:"uppercase",fontWeight:700}},"Workflow Progress"),
              e("div",{style:{fontSize:16,fontWeight:800,marginTop:2}},completedStages+" of "+totalStages+" stages completed")
            ),
            e("div",{style:{fontSize:24,fontWeight:800,color:"#EDE84A"}},completionPct+"%")
          ),
          // Multi-segment progress bar: green (completed) + amber (in-progress) + grey (not started)
          e("div",{style:{height:8,background:"rgba(255,255,255,0.1)",borderRadius:4,overflow:"hidden",display:"flex"}},
            completedStages>0 && e("div",{style:{width:(completedStages/totalStages*100)+"%",height:"100%",background:"#2D7A65"}}),
            inProgressStages>0 && e("div",{style:{width:(inProgressStages/totalStages*100)+"%",height:"100%",background:"#9A7B3E"}})
          ),
          // Mini-legend
          e("div",{style:{display:"flex",gap:14,marginTop:10,fontSize:9,color:"rgba(255,255,255,0.7)",letterSpacing:".05em"}},
            e("div",{style:{display:"flex",alignItems:"center",gap:5}},
              e("div",{style:{width:9,height:9,background:"#2D7A65",borderRadius:2}}),
              e("span",null,completedStages+" Completed")
            ),
            e("div",{style:{display:"flex",alignItems:"center",gap:5}},
              e("div",{style:{width:9,height:9,background:"#9A7B3E",borderRadius:2}}),
              e("span",null,inProgressStages+" In Progress")
            ),
            e("div",{style:{display:"flex",alignItems:"center",gap:5}},
              e("div",{style:{width:9,height:9,background:"rgba(255,255,255,0.2)",borderRadius:2}}),
              e("span",null,(totalStages-completedStages-inProgressStages)+" Not Started")
            )
          )
        ),

        // ── THE WORKFLOW — numbered boxes by group ─────────────────────────
        groupOrder.map(function(grp){
          var grpStages = stageGroups[grp];
          if(!grpStages || grpStages.length===0) return null;
          var grpColor = groupColors[grp] || "#4A4BAE";

          return e("div",{key:grp,style:{marginBottom:18}},
            // Group header
            e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:10}},
              e("div",{style:{width:4,height:22,background:grpColor,borderRadius:2}}),
              e("div",{style:{fontSize:11,fontWeight:800,color:grpColor,textTransform:"uppercase",letterSpacing:".12em"}},grp)
            ),
            // Stage boxes
            grpStages.map(function(s,idx){
              stageCounter++;
              var status = stageStatus(s.id);
              var diamond = DIAMONDS[s.id];

              // Visual config per status
              var statusConfig = {
                "not_started":  { bubbleColor: grpColor,    bubbleText: stageCounter,           borderColor: "#DDE0ED",  background: "#fff",                                                                          labelColor: "#7278A0",  labelText: "Click to open this stage →",         labelIcon: "" },
                "in_progress":  { bubbleColor: "#9A7B3E",   bubbleText: stageCounter,           borderColor: "#9A7B3E",  background: "linear-gradient(135deg,rgba(154,123,62,0.05),rgba(237,232,74,0.05))",            labelColor: "#9A7B3E",  labelText: "In progress — click to continue",    labelIcon: "◐" },
                "completed":    { bubbleColor: "#2D7A65",   bubbleText: "✓",                    borderColor: "#2D7A65",  background: "linear-gradient(135deg,rgba(45,122,101,0.08),rgba(74,75,174,0.05))",             labelColor: "#2D7A65",  labelText: "Completed — click to review",        labelIcon: "✓" }
              };
              var cfg = statusConfig[status];

              return e("div",{key:s.id},
                // The stage box
                e("div",{
                  onClick:function(){jumpToStage(s.id);},
                  style:{
                    background: cfg.background,
                    border:"2px solid "+cfg.borderColor,
                    borderLeft:"6px solid "+grpColor,
                    borderRadius:10,
                    padding:"14px 18px",
                    cursor:"pointer",
                    transition:"all .15s",
                    display:"flex",
                    alignItems:"center",
                    gap:14,
                    position:"relative"
                  }
                },
                  // Step number bubble
                  e("div",{style:{width:36,height:36,borderRadius:"50%",background:cfg.bubbleColor,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,flexShrink:0}},
                    cfg.bubbleText
                  ),
                  // Stage icon
                  e("div",{style:{fontSize:24,flexShrink:0}},s.icon),
                  // Label + meta
                  e("div",{style:{flex:1,minWidth:0}},
                    e("div",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C",marginBottom:2}},s.label),
                    e("div",{style:{fontSize:10,color:cfg.labelColor,letterSpacing:".05em",fontWeight:600}},
                      (cfg.labelIcon?cfg.labelIcon+" ":"")+cfg.labelText
                    )
                  ),
                  // Status pill (top-right)
                  status!=="not_started" && e("div",{style:{position:"absolute",top:8,right:50,fontSize:8,fontWeight:800,letterSpacing:".1em",textTransform:"uppercase",padding:"3px 7px",background:status==="completed"?"rgba(45,122,101,0.12)":"rgba(154,123,62,0.12)",color:status==="completed"?"#2D7A65":"#9A7B3E",borderRadius:3}},
                    status==="completed"?"✓ Stage Complete":"In Progress"
                  ),
                  // Arrow
                  e("div",{style:{fontSize:18,color:"#B5BAD6",flexShrink:0}},"→")
                ),
                // Decision diamond (if this stage has one)
                diamond && e("div",{style:{margin:"10px 0 10px 40px",padding:"12px 16px",background:"#FFF8E5",border:"2px dashed #B05A35",borderRadius:10,position:"relative"}},
                  e("div",{style:{fontSize:9,color:"#B05A35",letterSpacing:".12em",textTransform:"uppercase",fontWeight:800,marginBottom:6}},"◆ Decision checkpoint"),
                  e("div",{style:{fontSize:13,fontWeight:700,color:"#1E1F5C",marginBottom:8}},diamond.q),
                  e("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
                    e("div",{style:{flex:1,minWidth:160,padding:"7px 12px",background:"rgba(45,122,101,0.08)",borderRadius:6,fontSize:11,color:"#2D7A65",fontWeight:600}},
                      e("strong",{style:{letterSpacing:".05em",fontSize:9,textTransform:"uppercase"}},"✓ Yes — "),diamond.yes
                    ),
                    e("div",{style:{flex:1,minWidth:160,padding:"7px 12px",background:"rgba(176,90,53,0.08)",borderRadius:6,fontSize:11,color:"#B05A35",fontWeight:600}},
                      e("strong",{style:{letterSpacing:".05em",fontSize:9,textTransform:"uppercase"}},"✗ No — "),diamond.no
                    )
                  )
                ),
                // Connector arrow (between stages)
                idx<grpStages.length-1 && e("div",{style:{textAlign:"center",margin:"4px 0",fontSize:14,color:"#B5BAD6"}},"│")
              );
            })
          );
        }),

        // ── ENDPOINT — Deal Executed ──────────────────────────────────────
        e("div",{style:{textAlign:"center",margin:"24px 0 14px"}},
          e("div",{style:{fontSize:14,color:"#B5BAD6",marginBottom:6}},"│"),
          e("div",{style:{display:"inline-block",background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",color:"#fff",borderRadius:30,padding:"14px 36px",fontWeight:800,fontSize:14,letterSpacing:".05em",boxShadow:"0 6px 20px rgba(30,31,92,0.25)",border:"3px solid #EDE84A"}},
            "🎯 DEAL EXECUTED"
          ),
          e("div",{style:{fontSize:11,color:"#7278A0",marginTop:10,maxWidth:500,margin:"10px auto 0"}},
            "Once all stages complete: land acquired or under option/promotion, planning secured, buyer identified, pack delivered, deal closed."
          )
        ),

        // Footer
        e("div",{style:{marginTop:20,padding:"14px 18px",background:"#F8F8FE",borderLeft:"3px solid #4A4BAE",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.7}},
          e("strong",{style:{color:"#1E1F5C"}},"How this works: "),
          "Each box represents one stage in Landform's sidebar. Click a box to open that stage with your data ready. Once you've started filling out a stage, it ticks ✓ here. ",
          "Want to change scheme or exit? Click the breadcrumbs at the top.",
          e("br"),e("br"),
          e("strong",null,"Need a master overview? "),
          "Open the ",
          e("strong",{style:{cursor:"pointer",color:"#2D7A65",textDecoration:"underline"},onClick:function(){
            var params = [];
            if(schemes.length>0) params.push("schemes="+schemes.join(","));
            if(exits.length>0) params.push("exits="+exits.join(","));
            var url = "flowchart.html" + (params.length>0 ? "?"+params.join("&") : "");
            window.open(url,"landform_atlas","width=1600,height=1000,scrollbars=yes,resizable=yes");
          }},"🗺 Workflow Atlas")
          ," for the complete decision tree across every scheme + exit combination."
        )
      );
    }

    // Fallback (shouldn't happen)
    return e("div",null,e("p",null,"Loading navigator..."));
  }
