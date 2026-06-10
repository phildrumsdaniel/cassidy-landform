// ── renderEPEWorkflow  (params: at, city, data, mergeRespectingCompletedStages, navTo, setData, stage, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderEPEWorkflow(at, city, data, mergeRespectingCompletedStages, navTo, setData, stage, up, user){
    var ep=data.epe||{};
    var propType=ep.propType||"";
    var plotSqft=((num(ep.gLen)*num(ep.gWid))+(num(ep.propSqft)*0.3));
    var plotAcres=plotSqft/43560;
    var plotHa=plotAcres*0.404686;
    var currentVal=num(data.epeCurrentVal||0);
    var demolishCost=num(ep.demolishCost||0);

    // Auto-calculate demolish cost from property type and size
    var autoDemolish=(function(){
      var baseCost=num(ep.propSqft)||1000;
      var rates={
        "Pub (traditional)":18,"Pub (large / roadside)":22,
        "Office (small)":14,"Office (large)":16,
        "Church / Chapel":25,"Warehouse / Industrial":8,
        "Detached house":12,"Semi-detached house":10,
        "Terraced house":9,"End of terrace house":10,
        "Hotel / Guest house":20,"School / Former school":18,
        "Care home":16,"Barn":8,"Agricultural building":6,
      };
      var rate=rates[propType]||12;
      return Math.round(baseCost*rate);
    })();

    var demCost=demolishCost||autoDemolish;

    // Development scenarios
    var scenarios=[
      {
        id:"sfh_terraced",label:"Terraced Houses",icon:"🏘",
        type:"SFH",assetType:"sfh",stage:"sfh",
        dph:40,unitSqft:900,unitLabel:"2-3 bed terraced",
        units:Math.max(1,Math.floor(plotHa*40)),
        buildPsf:190,
        pros:["Quick to sell — strong market demand","Straightforward planning","Lower build risk"],
        cons:["Lower GDV per acre than apartments","Needs road adoption (S38)"],
        best:"Suburban sites 0.5-5 acres with road frontage"
      },
      {
        id:"sfh_semi",label:"Semi-Detached Houses",icon:"🏠",
        type:"SFH",assetType:"sfh",stage:"sfh",
        dph:28,unitSqft:1020,unitLabel:"3-4 bed semi",
        units:Math.max(1,Math.floor(plotHa*28)),
        buildPsf:200,
        pros:["Family housing — fastest absorption","Strong resale values","AH easily negotiated"],
        cons:["Lower density than terraced","More landscaping required"],
        best:"Edge of town, family catchment areas"
      },
      {
        id:"sfh_detached",label:"Detached Houses",icon:"🏡",
        type:"SFH",assetType:"sfh",stage:"sfh",
        dph:18,unitSqft:1400,unitLabel:"4-5 bed detached",
        units:Math.max(1,Math.floor(plotHa*18)),
        buildPsf:220,
        pros:["Premium pricing","Executive market — less price sensitive","Strong plot premium"],
        cons:["Very low density","Needs 0.5+ acres minimum","Slow absorption on larger sites"],
        best:"Village locations, established residential areas"
      },
      {
        id:"btr_mid",label:"BTR Apartments",icon:"🏢",
        type:"BTR",assetType:"btr",stage:"hra",
        dph:120,unitSqft:530,unitLabel:"1-2 bed apartments",
        units:Math.max(1,Math.floor(plotHa*120)),
        buildPsf:235,
        pros:["Highest GDV per acre","Institutional demand for forward funding","Single purchaser exit"],
        cons:["BSA 2022 compliance if 18m+","Higher build cost","Longer planning"],
        best:"Town/city centres, transport nodes, 0.5+ acres"
      },
      {
        id:"pbsa",label:"PBSA Student",icon:"🎓",
        type:"PBSA",assetType:"pbsa",stage:"hra",
        dph:220,unitSqft:270,unitLabel:"Studios & clusters",
        units:Math.max(1,Math.floor(plotHa*220)),
        buildPsf:215,
        pros:["Highest bed density","Strong institutional demand","No car parking needed"],
        cons:["Must be within 15 min of university","Article 4 restrictions in some cities","Specialist management"],
        best:"Within walking distance of campus — not viable elsewhere"
      },
      {
        id:"bungalows",label:"Bungalows",icon:"🏚",
        type:"SFH",assetType:"sfh",stage:"sfh",
        dph:16,unitSqft:850,unitLabel:"2-3 bed bungalow",
        units:Math.max(1,Math.floor(plotHa*16)),
        buildPsf:210,
        pros:["Strong elderly market","Premium pricing per unit","Simpler construction"],
        cons:["Very low density — needs large site","Limited planning support in some areas"],
        best:"Quiet suburban areas, established bungalow streets"
      },
    ];

    // Calculate each scenario
    var calcs=scenarios.map(function(sc){
      var totalGia=sc.units*sc.unitSqft;
      var salePsf=num(data.epe&&data.epe.salePsf)||280;
      var gdv=totalGia*salePsf;
      var buildCost=totalGia*sc.buildPsf;
      var fees=buildCost*0.12;
      var contingency=buildCost*0.05;
      var finance=(buildCost+fees)*0.075;
      var s106=sc.units*8000;
      var planning=sc.units*sc.buildPsf>200?12000:5000;
      var profit=gdv*0.175;
      var tc=buildCost+fees+contingency+finance+s106+demCost;
      var rlv=gdv-tc-profit;
      var margin=gdv>0?(profit/gdv)*100:0;
      var viable=rlv>0&&margin>=15;
      return Object.assign({},sc,{gdv:gdv,buildCost:buildCost,tc:tc,rlv:rlv,margin:margin,viable:viable,totalGia:totalGia});
    });

    // Find best scheme
    var bestRlv=calcs.reduce(function(best,sc){return sc.rlv>best.rlv?sc:best;},calcs[0]);

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Property Development Workflow"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:20}},"Complete journey from existing property assessment to scheme selection and exit strategy"),

      // ── STEP 1: PROPERTY SUMMARY ─────────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #4A4BAE"})},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
          e("div",{style:S.cardTitle},"Step 1 — Existing Property"),
          e("button",{onClick:function(){navTo("epe");},style:{padding:"6px 14px",background:"#4A4BAE",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Edit →")
        ),
        ep.postcode||ep.propType?e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}},
          [
            {l:"Property",v:propType||"Not set"},
            {l:"Postcode",v:ep.postcode||"Not set"},
            {l:"Floor Area",v:ep.propSqft?ep.propSqft.toLocaleString()+" sqft":"Not set"},
            {l:"Bedrooms",v:ep.bedrooms||"Not set"},
            {l:"Storeys",v:ep.storeys||"Not set"},
            {l:"Condition",v:ep.condition||"Not set"},
            {l:"Plot Area",v:plotSqft>0?Math.round(plotSqft).toLocaleString()+" sqft":"Fill garden dims"},
            {l:"Current Value",v:currentVal>0?fmt(currentVal):"Fill EPE form"},
          ].map(function(item){
            var missing=item.v==="Not set"||item.v==="Fill garden dims"||item.v==="Fill EPE form";
            return e("div",{key:item.l,style:{background:missing?"rgba(176,90,53,0.05)":"#F7F8FC",border:"1px solid "+(missing?"rgba(176,90,53,0.2)":"#DDE0ED"),borderRadius:6,padding:"10px 12px"}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:3}},item.l),
              e("div",{style:{fontSize:13,fontWeight:600,color:missing?"#B05A35":"#2E2F8A"}},item.v)
            );
          })
        ):e("div",{style:{textAlign:"center",padding:"20px",color:"#7278A0",fontSize:13}},
          "⚠ Property Evaluator not filled in yet. ",
          e("span",{onClick:function(){navTo("epe");},style:{color:"#4A4BAE",cursor:"pointer",fontWeight:700}},"Go to Property Evaluator →")
        )
      ),

      // ── STEP 2: DEMOLITION ───────────────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #B05A35"})},
        e("div",{style:S.cardTitle},"Step 2 — Demolition & Site Clearance"),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}},
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Demolition Cost (£) — Auto-estimated: £"+fmt(autoDemolish)),
            e("input",{type:"number",value:ep.demolishCost||"",
              onChange:function(ev){up("epe","demolishCost",ev.target.value);},
              placeholder:"£"+autoDemolish+" (auto)",style:S.input}),
            e("div",{style:{fontSize:10,color:"#7278A0"}},"Based on "+Math.round(num(ep.propSqft)||1000).toLocaleString()+" sqft "+propType+" at typical demolition rates")
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Site Investigation & Clearance (£)"),
            e("input",{type:"number",value:ep.siteInvestigation||"",
              onChange:function(ev){up("epe","siteInvestigation",ev.target.value);},
              placeholder:"e.g. 15000",style:S.input}),
            e("div",{style:{fontSize:10,color:"#7278A0"}},"Phase 1/2 contamination, asbestos survey, site strip")
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Utility Disconnection (£)"),
            e("input",{type:"number",value:ep.utilityDisconnect||"",
              onChange:function(ev){up("epe","utilityDisconnect",ev.target.value);},
              placeholder:"e.g. 8000",style:S.input}),
            e("div",{style:{fontSize:10,color:"#7278A0"}},"Gas, electric, water, telecoms disconnection")
          ),
          e("div",{style:{background:"rgba(176,90,53,0.06)",border:"1px solid rgba(176,90,53,0.2)",borderRadius:8,padding:14}},
            e("div",{style:{fontSize:9,color:"#B05A35",textTransform:"uppercase",marginBottom:4}},"Total Pre-Development Cost"),
            e("div",{style:{fontSize:24,fontWeight:800,color:"#B05A35"}}),
            fmt(demCost+num(ep.siteInvestigation||0)+num(ep.utilityDisconnect||0)),
            e("div",{style:{fontSize:10,color:"#7278A0",marginTop:4}},"Deducted from residual land value in all scenarios below")
          )
        ),
        e("div",{style:{background:"rgba(154,123,62,0.06)",border:"1px solid rgba(154,123,62,0.2)",borderRadius:6,padding:"10px 14px",fontSize:11,color:"#7A5A2E"}},
          "⚠ Always get competitive quotes from licensed demolition contractors. Asbestos surveys are mandatory before demolition of pre-2000 buildings. Budget £8-25/sqft depending on structure type and materials."
        )
      ),

      // ── STEP 3: SCHEME OPTIONS ───────────────────────────────────────────
      plotSqft>500&&e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #2D7A65"})},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
          e("div",{style:S.cardTitle},"Step 3 — Development Scheme Options"),
          bestRlv&&e("div",{style:{fontSize:11,color:"#2D7A65",fontWeight:700}},"Best RLV: "+bestRlv.label+" ("+fmt(bestRlv.rlv)+")")
        ),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:16}},
          "Based on "+Math.round(plotSqft).toLocaleString()+" sqft / "+plotAcres.toFixed(3)+" acres. Demolition cost of "+fmt(demCost)+" included. Click a scheme to open the full appraisal."
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}},
          calcs.map(function(sc){
            var sc2=sc.viable?"#2D7A65":"#B05A35";
            return e("div",{key:sc.id,
              style:{background:"#fff",border:"2px solid "+(sc.id===bestRlv.id?"#2D7A65":"#DDE0ED"),borderRadius:10,padding:16,position:"relative"},
            },
              sc.id===bestRlv.id&&e("div",{style:{position:"absolute",top:-10,right:12,background:"#2D7A65",color:"#fff",fontSize:9,fontWeight:700,padding:"3px 10px",borderRadius:10,letterSpacing:".1em"}},"BEST RLV"),
              e("div",{style:{fontSize:20,marginBottom:6}},sc.icon),
              e("div",{style:{fontSize:13,fontWeight:800,color:"#2E2F8A",marginBottom:2}},sc.label),
              e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:10}},sc.unitLabel+" · "+sc.dph+" dph"),
              e("div",{style:{fontSize:32,fontWeight:800,color:"#4A4BAE",lineHeight:1,marginBottom:2}},sc.units),
              e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:12}},"units / beds on this plot"),
              e("div",{style:{display:"flex",flexDirection:"column",gap:4,marginBottom:12}},
                [
                  ["GDV",fmt(sc.gdv)],
                  ["Build cost",fmt(sc.buildCost)],
                  ["Total dev cost",fmt(sc.tc)],
                  ["Dev profit (17.5%)",fmt(sc.gdv*0.175)],
                  ["Residual land value",fmt(sc.rlv)],
                ].map(function(row){
                  return e("div",{key:row[0],style:{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 0",borderBottom:"1px solid #F0F0F0"}},
                    e("span",{style:{color:"#7278A0"}},row[0]),
                    e("span",{style:{fontWeight:600,color:row[0]==="Residual land value"?sc2:"#2E2F8A"}},row[1])
                  );
                })
              ),
              e("div",{style:{marginBottom:10}},
                e("div",{style:{fontSize:9,color:"#7278A0",marginBottom:4,textTransform:"uppercase",fontWeight:700}},"Pros"),
                sc.pros.map(function(p){return e("div",{key:p,style:{fontSize:10,color:"#2D7A65",marginBottom:2}},"✓ "+p);}),
                e("div",{style:{fontSize:9,color:"#7278A0",marginTop:6,marginBottom:4,textTransform:"uppercase",fontWeight:700}},"Cons"),
                sc.cons.map(function(c){return e("div",{key:c,style:{fontSize:10,color:"#B05A35",marginBottom:2}},"✗ "+c);}),
                e("div",{style:{fontSize:9,color:"#7278A0",marginTop:6,fontStyle:"italic"}},"Best for: "+sc.best)
              ),
              e("div",{style:{display:"flex",flexDirection:"column",gap:6}},
                e("button",{
                  onClick:function(){
                    setData(function(d){
                      var c2=(d.epe&&d.epe.city)||city;
                      var updates={assetType:sc.assetType};
                      if(sc.type==="SFH"){
                        updates.sfh=Object.assign({},d.sfh||{},{acres:plotAcres.toFixed(3),city:c2,dph:sc.dph+""});
                      } else {
                        updates.hra=Object.assign({},d.hra||{},{city:c2});
                      }
                      updates.planning=Object.assign({},d.planning||{},{units:sc.units+"",lpa:d.planning&&d.planning.lpa||""});
                      updates.fin=Object.assign({},d.fin||{});
                      return mergeRespectingCompletedStages(d,updates);
                    });
                    navTo(sc.stage);
                  },
                  style:{width:"100%",padding:"9px",background:"#4A4BAE",border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
                },"Open Full Appraisal →"),
                e("button",{
                  onClick:function(){
                    // Set scheme and navigate to correct appraisal
                    setData(function(d){
                      var upd={assetType:sc.assetType||at};
                      upd.planning=Object.assign({},d.planning||{},{units:sc.units+""});
                      if(sc.assetType==="sfh"||sc.type==="SFH"){
                        upd.sfh=Object.assign({},d.sfh||{},{acres:sc.acres||d.sfh&&d.sfh.acres||"",dph:sc.dph+""});
                      } else {
                        upd.hra=Object.assign({},d.hra||{});
                      }
                      return mergeRespectingCompletedStages(d,upd);
                    });
                    navTo(sc.assetType==="sfh"||sc.type==="SFH"?"sfh":"hra");
                  },
                  style:{width:"100%",padding:"7px",background:"transparent",border:"1px solid #4A4BAE",borderRadius:6,color:"#4A4BAE",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
                },"→ Jump to Planning")
              )
            );
          })
        )
      ),

      // ── STEP 4: JOURNEY FORWARD ──────────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #9A7B3E"})},
        e("div",{style:S.cardTitle},"Step 4 — Continue the Journey"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14}},"Once you've selected your scheme above, continue through the development journey:"),
        e("div",{style:{display:"flex",flexDirection:"column",gap:8}},
          [
            {icon:"▲",label:"Planning & Viability",desc:"NPPF compliance, S106, BNG, affordable housing strategy",id:"planning",color:"#4A4BAE"},
            {icon:"◉",label:"Financial Modelling",desc:"Full appraisal with bear/base/bull scenarios",id:"fin",color:"#2D7A65"},
            {icon:"◈",label:"Due Diligence",desc:"Legal, technical, planning and commercial checklist",id:"dd",color:"#7B6CB0"},
            {icon:"⬡",label:"Risk Register",desc:"RAG-rate all risks before proceeding",id:"risks",color:"#9A7B3E"},
            {icon:"◆",label:"Investment Exit",desc:"Forward fund, HoTs generator, Investment Memo",id:"exit",color:"#B05A35"},
          ].map(function(step){
            return e("div",{key:step.id,
              onClick:function(){navTo(step.id);},
              style:{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,cursor:"pointer",transition:"all .15s"},
              onMouseOver:function(ev){ev.currentTarget.style.borderColor=step.color;ev.currentTarget.style.background="#F8F8FF";},
              onMouseOut:function(ev){ev.currentTarget.style.borderColor="#DDE0ED";ev.currentTarget.style.background="#fff";}
            },
              e("div",{style:{width:36,height:36,borderRadius:"50%",background:step.color+"15",border:"1px solid "+step.color+"40",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}},step.icon),
              e("div",{style:{flex:1}},
                e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A"}},(stage===step.id?"● ":"")+step.label),
                e("div",{style:{fontSize:11,color:"#7278A0"}},step.desc)
              ),
              e("div",{style:{fontSize:11,color:step.color,fontWeight:700}},"Open →")
            );
          })
        )
      ),

      e(AIPanel,{user:user,up:up,stage:"epeworkflow",data:data,persistKey:"epeworkflow_ai__which_scheme_is_",label:"AI: Which Scheme Is Best For This Property?",
        prompt:buildHonestPrompt(data,"I am evaluating a "+propType+" in "+(ep.postcode||"unknown postcode")+" for redevelopment. The existing property is "+num(ep.propSqft)+" sqft, "+ep.bedrooms+" bed, "+ep.storeys+" storeys, condition: "+(ep.condition||"average")+". Plot size is approximately "+Math.round(plotSqft)+" sqft / "+plotAcres.toFixed(3)+" acres. Asset type preference: "+at.toUpperCase()+". Demolition cost estimate: "+fmt(demCost)+". Provide: 1) Which development scheme would you recommend for this site and why? 2) Are there any site-specific constraints I should investigate before committing? 3) What is the realistic planning risk for each scheme type? 4) What is the likely timescale from purchase to exit? 5) What is the minimum viable site size for each scheme type in this location?")})
    );
  }
