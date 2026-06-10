// ── renderPlanning  (params: at, data, navTo, setData, setJourney, units, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderPlanning(at, data, navTo, setData, setJourney, units, up, user){
    var p=data.planning||{};
    var checks=[
      {l:"NPPF 2024",s:p.status==="full"||p.status==="outline"?"pass":"pending"},
      {l:"Local Plan allocation",s:p.status==="full"||p.status==="allocated"?"pass":"review"},
      {l:"Affordable housing",s:at==="btr"?(p.ahPct?"pass":"pending"):"na"},
      {l:"BNG 10%",s:p.bng?"pass":"pending"},
      {l:"Fire Safety Gateway",s:p.gateway&&p.gateway!=="na"?"pass":num(p.storeys)>6?"pending":"na"},
      {l:"S106 / CIL agreed",s:p.s106?"pass":"pending"},
    ];
    var dotC={pass:"#2D7A65",pending:"#9A7B3E",review:"#4A4BAE",na:"#C8CDE0"};

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Planning & Viability"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:20}},"Planning strategy, policy compliance and S106 negotiation"),

      // v9.20 — Planning scenario banner with drift detection + re-sync
      (function(){
        if(!(data.land && data.land.appliedScenario)) return null;
        var schAh = num(data.land.scenarioAhPct || 0);
        var schS106 = num(data.land.scenarioS106pu || 0);
        var schFin = num(data.land.scenarioFinanceRate || 0);
        var schTime = num(data.land.scenarioTimelineMo || 0);
        var driftFields = [];
        var pAh = num(p.ahPct || p.afhPct);
        var pS106 = num(p.s106pu);
        if(schAh > 0 && pAh !== schAh) driftFields.push({field:"AH%", current:pAh+"%", scenario:schAh+"%", scenarioRaw:schAh, keys:["ahPct","afhPct"]});
        if(schS106 > 0 && pS106 !== schS106) driftFields.push({field:"S106/unit", current:"£"+pS106.toLocaleString(), scenario:"£"+schS106.toLocaleString(), scenarioRaw:schS106, keys:["s106pu"]});

        var hasDrift = driftFields.length > 0;
        var bg = hasDrift ? "rgba(154,123,62,0.10)" : "rgba(45,122,101,0.08)";
        var bd = hasDrift ? "rgba(154,123,62,0.4)" : "rgba(45,122,101,0.3)";
        var col = hasDrift ? "#7B6432" : "#1d5446";

        return e("div",{style:{margin:"-8px 0 16px",padding:"12px 14px",background:bg,border:"1px solid "+bd,borderRadius:6,fontSize:11,color:col,lineHeight:1.5}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}},
            e("div",{style:{flex:1,minWidth:240}},
              e("strong",null,(hasDrift?"⚠ ":"✓ ")+"Scenario: "+(data.land.appliedScenarioLabel||"")+"."),
              " AH%: ",e("strong",null,schAh+"%"),
              " · S106: ",e("strong",null,"£"+schS106.toLocaleString()+"/unit"),
              " · Finance: ",e("strong",null,schFin+"%"),
              " · Timeline: ",e("strong",null,schTime+"mo"),
              hasDrift ? e("div",{style:{marginTop:4,fontSize:11,color:"#8A7048"}},
                e("strong",null,"Drift detected: "),
                driftFields.map(function(d){return d.field+" is "+d.current+" (scenario says "+d.scenario+")";}).join(" · ")
              ) : e("span",null," — values match.")
            ),
            hasDrift && e("button",{
              onClick:function(){
                if(!confirm("Re-sync Planning fields with active scenario?\n\n"+driftFields.map(function(d){return "• "+d.field+": "+d.current+" → "+d.scenario;}).join("\n"))) return;
                setData(function(prev){
                  var pNext = Object.assign({}, prev.planning||{});
                  driftFields.forEach(function(d){
                    d.keys.forEach(function(k){pNext[k] = d.scenarioRaw;});
                  });
                  return Object.assign({}, prev, {planning:pNext});
                });
              },
              style:{padding:"7px 13px",background:"#9A7B3E",border:"none",color:"#fff",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",flexShrink:0}
            },"Re-sync →")
          )
        );
      })(),

      // v9.18 — Unit-sync warning when Planning and RLV disagree
      (function(){
        var planUnits = num(p.units || 0);
        var rlvUnits = num(data.rlv&&data.rlv.units || 0);
        if(planUnits > 0 && rlvUnits > 0 && planUnits !== rlvUnits){
          return e("div",{style:{margin:"0 0 14px",padding:"12px 14px",background:"rgba(176,90,53,0.10)",border:"1px solid rgba(176,90,53,0.4)",borderRadius:6,fontSize:12,color:"#8A3A1A",lineHeight:1.6,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}},
            e("div",{style:{flex:1,minWidth:240}},
              e("div",{style:{fontWeight:700,marginBottom:4}},"⚠ Unit count mismatch across stages"),
              e("div",null,
                "RLV stage has ",e("strong",null,rlvUnits+" units"),
                " but this stage has ",e("strong",null,planUnits+" units"),
                "."
              )
            ),
            e("div",{style:{display:"flex",gap:6,flexShrink:0}},
              e("button",{
                onClick:function(){up("planning","units",rlvUnits);},
                style:{padding:"7px 12px",background:"#B05A35",border:"none",color:"#fff",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}
              },"Use RLV's "+rlvUnits),
              e("button",{
                onClick:function(){setData(function(prev){return Object.assign({},prev,{rlv:Object.assign({},prev.rlv||{},{units:planUnits})});});},
                style:{padding:"7px 12px",background:"transparent",border:"1px solid #B05A35",color:"#B05A35",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}
              },"Push "+planUnits+" → RLV")
            )
          );
        }
        return null;
      })(),

      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Planning Position"),
        e("div",{style:S.grid2},
          e(Inp,{label:"Local Planning Authority",value:p.lpa,onChange:function(v){up("planning","lpa",v);},placeholder:"e.g. Manchester City Council",full:true}),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Planning Risk Level"),
            e("select",{value:p.riskLevel||"",onChange:function(ev){up("planning","riskLevel",ev.target.value);},
              style:Object.assign({},S.select,{borderLeft:"4px solid "+(p.riskLevel==="low"?"#2D7A65":p.riskLevel==="medium"?"#9A7B3E":p.riskLevel==="high"?"#B05A35":"#DDE0ED")})},
              e("option",{value:""},"Select risk level..."),
              e("option",{value:"low"},"Low — allocated site, policy support"),
              e("option",{value:"medium"},"Medium — unallocated, LPA neutral"),
              e("option",{value:"high"},"High — outside settlement, likely opposition")
            ),
            p.riskLevel&&e("div",{style:{fontSize:10,fontWeight:600,color:p.riskLevel==="low"?"#2D7A65":p.riskLevel==="medium"?"#9A7B3E":"#B05A35",marginTop:2}},
              p.riskLevel==="low"?"✓ Typical timeline: 12-18 months to consent":
              p.riskLevel==="medium"?"⚠ Typical timeline: 18-24 months — pre-app strongly recommended":
              "✗ Typical timeline: 24-36 months — consider promotion agreement"
            )
          ),
          e(Sel,{label:"Planning Status",value:p.status,onChange:function(v){up("planning","status",v);},
            options:[{value:"",label:"Select..."},{value:"full",label:"Full planning consent"},{value:"outline",label:"Outline consent"},{value:"pip",label:"Permission in Principle (PiP) granted"},{value:"refused_pip",label:"PiP Refused — recovery needed"},{value:"refused_full",label:"Full planning refused — appeal"},{value:"allocated",label:"Local Plan allocation"},{value:"pre_app",label:"Pre-application stage"},{value:"none",label:"None / no planning history"}]}),
          (p.status==="refused_pip"||p.status==="refused_full")&&e("div",{style:{gridColumn:"span 2",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}},
            e("div",null,
              e("div",{style:{fontSize:12,fontWeight:700,color:"#B05A35",marginBottom:2}},"⚠ Planning has been refused — Recovery Journey available"),
              e("div",{style:{fontSize:11,color:"#7278A0"}},"Switch to Planning Recovery to access refusal strategies, case law, appeal routes and letter templates.")
            ),
            e("button",{onClick:function(){setJourney("recovery");navTo("recovery");},
              style:{padding:"8px 16px",background:"#B05A35",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",flexShrink:0}},
              "⚖ Open Recovery Journey →")
          ),
          e(Inp,{label:at==="pbsa"?"Beds Proposed":"Units Proposed",type:"number",value:p.units,onChange:function(v){up("planning","units",v);},placeholder:"e.g. 180"}),
          e(Inp,{label:"Storeys",type:"number",value:p.storeys,onChange:function(v){up("planning","storeys",v);},placeholder:"e.g. 8"}),
          // v9.18 — Affordable Housing % field now shown for ALL scheme types (was BTR-only)
          // Also writes to BOTH ahPct AND afhPct so any reader of either name gets the value
          e(Inp,{label:"Affordable Housing %",type:"number",value:p.ahPct||p.afhPct||"",onChange:function(v){
            setData(function(prev){return Object.assign({},prev,{planning:Object.assign({},prev.planning||{},{ahPct:v,afhPct:v})});});
          },placeholder:at==="sfh"?"30":"25"}),
          // v9.18 — S106 per unit field — clearer than total when units change
          e(Inp,{label:"S106 / CIL per Unit (£)",type:"number",value:p.s106pu||"",onChange:function(v){up("planning","s106pu",v);},placeholder:"8000"}),
          e(Inp,{label:"S106 / CIL Total (£) — auto = units × per-unit",type:"number",value:p.s106,onChange:function(v){up("planning","s106",v);},placeholder:num(p.units)>0&&num(p.s106pu)>0?String(num(p.units)*num(p.s106pu)):"e.g. 850000"}),
          e(Sel,{label:"Biodiversity Net Gain",value:p.bng,onChange:function(v){up("planning","bng",v);},
            options:[{value:"",label:"Select..."},{value:"on_site",label:"On-site 10%"},{value:"off_site",label:"Off-site credits"},{value:"exempt",label:"Exempt — brownfield"}]}),
          e(Sel,{label:"Fire Safety Gateway",value:p.gateway,onChange:function(v){up("planning","gateway",v);},
            options:[{value:"",label:"Select..."},{value:"na",label:"N/A — under 11m"},{value:"g2",label:"Gateway 2 submitted"},{value:"g2a",label:"Gateway 2 approved"},{value:"g3",label:"Gateway 3 planned"}]})
        )
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Policy Compliance"),
        checks.map(function(check){
          return e("div",{key:check.l,style:{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:6,background:check.s==="pass"?"rgba(45,122,101,0.04)":"#F7F8FC",border:"1px solid "+(check.s==="pass"?"rgba(45,122,101,0.2)":"#DDE0ED"),marginBottom:6}},
            e("div",{style:{width:8,height:8,borderRadius:"50%",background:dotC[check.s]||"#C8CDE0",flexShrink:0}}),
            e("span",{style:{flex:1,fontSize:12,color:"#3A3D6A"}},check.l),
            e("span",{style:{fontSize:10,fontWeight:700,color:dotC[check.s]||"#C8CDE0"}},{pass:"Compliant",pending:"To confirm",review:"Under review",na:"N/A"}[check.s]||"")
          );
        })
      ),
      e(AIPanel,{user:user,up:up,stage:"planning",data:data,persistKey:"planning_planning_strategy",label:"Planning Strategy",
        prompt:buildHonestPrompt(data,"Planning strategy for "+at.toUpperCase()+" scheme. LPA: "+(p.lpa||"unknown")+", status: "+(p.status||"none")+", "+units+" units, "+(p.ahPct||0)+"% AH. S106: "+fmt(num(p.s106))+". Provide: 1) Risk rating (1-10), 2) NPPF 2024 hooks to use, 3) S106 negotiation strategy, 4) Affordable housing viability argument, 5) Realistic timeline from pre-app to consent, 6) Top 3 likely officer objections and responses.")})
    );
  }
