// ── renderScorecard  (params: city, data, gdv, lc, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderScorecard(city, data, gdv, lc, up, user){
    var l=data.land||{}; var p=data.planning||{}; var f=data.fin||{};
    var rlvD=data.rlv||{}; var cc=data.constraint||{}; var mon=data.monitor||{};
    var addr=l.address||data.scraper&&data.scraper.result&&data.scraper.result.address||"Site";
    // v9.96 — read the REAL residual/margin/units from the one engine, not from input
    // stages that never store them (data.rlv.rlv / data.fin.marginPct are always blank,
    // which made the scorecard show the asking price as the RLV and a 0% margin).
    var M=(typeof calcDealMetrics==="function")?calcDealMetrics(data):{};
    var scRlv=num(M.rlv);                                   // engine residual land value
    var scMargin=isFinite(M.marginPct)?num(M.marginPct):num(f.marginPct||f.devMargin||0);
    var scUnits=num(M.units||p.units||rlvD.units||0);

    // Score each dimension 1-10
    function scoreViability(){
      var margin=scMargin;
      if(margin>=20)return{s:9,l:"Strong"};if(margin>=17)return{s:7,l:"Good"};
      if(margin>=14)return{s:5,l:"Marginal"};if(margin>=10)return{s:3,l:"Weak"};return{s:1,l:"Unviable"};
    }
    function scorePlanning(){
      var ps=p.status||l.planningStatus||"";
      if(ps==="full")return{s:10,l:"Full consent"};
      if(ps==="outline")return{s:8,l:"Outline consent"};
      if(ps==="allocated")return{s:7,l:"Allocated in local plan"};
      if(ps==="preApp")return{s:5,l:"Pre-app stage"};
      var prob=num(cc.planningScore||p.planningProb||0);
      if(prob>=70)return{s:6,l:"Good probability"};
      if(prob>=50)return{s:4,l:"Moderate probability"};
      if(prob>0)return{s:3,l:"Speculative"};
      // v9.57 — nothing set yet: lead with full consent (assumed) so the score
      // reflects the consented, profitable basis. Set the real status to refine.
      return{s:9,l:"Full consent (assumed)"};
    }
    function scoreMarket(){
      var c2=city||l.city||"manchester";
      var mk=MKT[c2]||MKT.manchester;
      if(mk.btr>=1500)return{s:9,l:"Prime market"};
      if(mk.btr>=1000)return{s:7,l:"Strong market"};
      if(mk.btr>=750)return{s:5,l:"Established market"};
      return{s:3,l:"Secondary market"};
    }
    function scoreLocation(){
      var score=num(l.locationScore||0);
      if(score>=80)return{s:9,l:"Excellent"};if(score>=60)return{s:7,l:"Good"};
      if(score>=40)return{s:5,l:"Average"};return{s:3,l:"Poor"};
    }
    function scoreRisk(){
      var verdict=cc.verdict||"";
      if(verdict==="GO")return{s:8,l:"Low risk"};
      if(verdict==="CAUTION")return{s:5,l:"Moderate risk"};
      if(verdict==="AVOID")return{s:2,l:"High risk"};
      return{s:5,l:"Not assessed"};
    }
    function scoreDelivery(){
      var ac=num(l.acres||0); var un=scUnits;
      if(un>0&&un<=100)return{s:8,l:"Manageable scale"};
      if(un>100&&un<=300)return{s:6,l:"Medium scheme"};
      if(un>300)return{s:4,l:"Complex delivery"};
      return{s:5,l:"Scale unknown"};
    }
    function scoreFinancial(){
      var rlvV=scRlv; var ask=num(l.price||0);
      if(ask>0&&rlvV>ask*1.1)return{s:9,l:"Strong residual"};
      if(ask>0&&rlvV>ask*0.9)return{s:7,l:"Viable at ask"};
      if(ask>0&&rlvV>ask*0.7)return{s:4,l:"Gap to close"};
      if(ask>0)return{s:2,l:"Unviable at ask"};
      return{s:5,l:"Not compared"};
    }

    var dimensions=[
      {k:"viability",l:"Development Viability",icon:"💰",score:scoreViability()},
      {k:"planning",l:"Planning Position",icon:"📋",score:scorePlanning()},
      {k:"market",l:"Market Strength",icon:"📈",score:scoreMarket()},
      {k:"location",l:"Location Quality",icon:"📍",score:scoreLocation()},
      {k:"risk",l:"Constraint Risk",icon:"⚠",score:scoreRisk()},
      {k:"delivery",l:"Delivery Complexity",icon:"🏗",score:scoreDelivery()},
      {k:"financial",l:"Financial Return",icon:"◆",score:scoreFinancial()},
    ];

    // Allow manual overrides
    function getScore(dim){
      var override=data.scorecard&&data.scorecard["s_"+dim.k];
      return override!==undefined?{s:num(override),l:dim.score.l}:dim.score;
    }

    var scores=dimensions.map(function(d){return Object.assign({},d,{final:getScore(d)});});
    var totalScore=Math.round(scores.reduce(function(t,d){return t+d.final.s;},0)/scores.length*10)/10;
    var verdict=totalScore>=7.5?"STRONG BUY":totalScore>=6?"BUY":totalScore>=4.5?"CONDITIONAL":"DECLINE";
    var verdictColor=verdict==="STRONG BUY"?"#2D7A65":verdict==="BUY"?"#4A4BAE":verdict==="CONDITIONAL"?"#9A7B3E":"#B05A35";

    function barColor(s){return s>=7?"#2D7A65":s>=5?"#4A4BAE":s>=3?"#9A7B3E":"#B05A35";}

    return e("div",null,
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}},
        e("div",null,
          e("div",{style:{fontSize:11,color:"#7278A0",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:4}},"Site Scorecard"),
          e("h2",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",margin:0}},addr)
        ),
        e("div",{style:{textAlign:"right"}},
          e("div",{style:{fontSize:36,fontWeight:800,color:verdictColor}},totalScore+"/10"),
          e("div",{style:{fontSize:13,fontWeight:800,color:verdictColor,letterSpacing:".08em"}},"● "+verdict)
        )
      ),

      // Score bars
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"20px 24px",marginBottom:14}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:16}},"Dimension Scores"),
        scores.map(function(dim){
          var s=dim.final.s;
          return e("div",{key:dim.k,style:{marginBottom:14}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}},
              e("div",{style:{display:"flex",alignItems:"center",gap:8}},
                e("span",{style:{fontSize:16}},dim.icon),
                e("span",{style:{fontSize:12,fontWeight:600,color:"#2E2F8A"}},dim.l)
              ),
              e("div",{style:{display:"flex",alignItems:"center",gap:10}},
                e("span",{style:{fontSize:11,color:"#7278A0"}},dim.final.l),
                e("span",{style:{fontSize:14,fontWeight:800,color:barColor(s),minWidth:28,textAlign:"right"}},s+"/10")
              )
            ),
            e("div",{style:{height:8,background:"#F0F1FA",borderRadius:4,overflow:"hidden"}},
              e("div",{style:{width:(s/10*100)+"%",height:"100%",background:barColor(s),borderRadius:4,transition:"width .4s ease"}})
            ),
            e("div",{style:{marginTop:4}},
              e("input",{type:"range",min:1,max:10,step:1,value:s,
                onChange:function(ev){up("scorecard","s_"+dim.k,Number(ev.target.value));},
                style:{width:"100%",accentColor:barColor(s),cursor:"pointer",height:12}
              })
            )
          );
        })
      ),

      // Key metrics summary
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:14}},
        [
          {l:"GDV",v:fmt(gdv)},{l:"RLV",v:fmt(scRlv)},
          {l:"Dev Margin",v:pct(scMargin)},
          {l:"Units",v:fmtN(scUnits)},
          {l:"Site area",v:(l.acres||"—")+" acres"},
          {l:"Planning",v:p.status||l.planningStatus||"Unknown"},
        ].map(function(item){
          return e("div",{key:item.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"10px 14px"}},
            e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginBottom:2}},item.l),
            e("div",{style:{fontSize:15,fontWeight:800,color:"#2E2F8A"}},item.v)
          );
        })
      ),

      // AI narrative + print
      e("div",{style:{display:"flex",gap:8,marginBottom:12}},
        e(AIPanel,{user:user,up:up,stage:"scorecard",data:data,persistKey:"scorecard_narrative",
          label:"🏆 Generate Scorecard Narrative",
          system:"You are a senior UK property investment analyst writing a concise site scorecard commentary for an investment committee.",
          prompt:buildHonestPrompt(data,"Write a 150-word investment committee scorecard commentary for this site. Overall score: "+totalScore+"/10 ("+verdict+"). Address: "+addr+". Scores: "+scores.map(function(d){return d.l+": "+d.final.s+"/10 ("+d.final.l+")";}).join(", ")+". GDV: "+fmt(gdv)+", RLV: "+fmt(scRlv)+", margin: "+pct(scMargin)+". Be direct, numerate, investment committee tone. Lead with overall verdict, then key strengths, then key risks, then recommendation."
        )}),
        e("button",{
          onClick:function(){window.print();},
          style:{padding:"8px 16px",background:"#2E2F8A",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",alignSelf:"flex-start"}
        },"🖨 Print Scorecard")
      )
    );
  }
