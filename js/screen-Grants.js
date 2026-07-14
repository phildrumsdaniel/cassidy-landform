// ── renderGrants  (params: city, data, gdv, lc, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderGrants(city, data, gdv, lc, up, user){
    var l=data.land||{}; var p=data.planning||{}; var f=data.fin||{};
    var rlvD=data.rlv||{}; var cc=data.constraint||{}; var g=data.grants||{};
    var addr=l.address||"Development Site";
    var units2=num(p.units||rlvD.units||0);
    var ahPct=num(p.ahPct||0);
    var ahUnits=Math.round(units2*ahPct/100);
    var ask=num(l.price||0);
    var acres2=num(l.acres||0);
    var gdvVal=gdv>0?gdv:0;
    var rlvVal=num(rlvD.rlv||lc||0);
    var margin=num(f.marginPct||f.devMargin||0);
    var isBrownfield=l.planningStatus==="brownfield"||(cc.constraints&&cc.constraints.toLowerCase().indexOf("brownfield")>=0)||(g.isBrownfield||false);
    var hasFlood=cc.verdict==="AVOID"||(cc.constraints&&cc.constraints.toLowerCase().indexOf("flood")>=0)||(g.hasFlood||false);
    var cityVal=city||l.city||"manchester";
    var lpa=p.lpa||l.localAuthority||"";

    // ── GRANT ELIGIBILITY SCORING ──────────────────────────────────────────
    // Each grant scored 0-100 for probability of eligibility
    var GRANTS=[
      {
        id:"brownfield",
        name:"Brownfield Land Release Fund",
        funder:"Homes England / DLUHC",
        type:"Capital grant",
        purpose:"Remediating and unlocking brownfield sites for housing",
        typical:"£500k–£5m depending on remediation costs",
        score:function(){
          var s=0;
          if(isBrownfield)s+=50;
          if(units2>=20)s+=15;
          if(ahPct>=20)s+=10;
          if(margin<20)s+=15; // viability gap helps
          if(lpa)s+=10;
          return Math.min(s,95);
        },
        conditions:["Site must be previously developed land","Demonstrable remediation or enabling cost","Local authority partnership or support","Minimum housing output (typically 10+ units)"],
        abnormalEstimate:function(){return Math.round(acres2*120000)||500000;},
        notes:"BLRF is highly competitive. Sites with significant remediation costs and strong LA support score highest."
      },
      {
        id:"hif",
        name:"Housing Infrastructure Fund",
        funder:"Homes England",
        type:"Infrastructure grant",
        purpose:"Forward funding infrastructure to unlock housing delivery",
        typical:"£1m–£250m (marginal viability interventions)",
        score:function(){
          var s=0;
          if(units2>=200)s+=40;
          if(units2>=500)s+=20;
          if(gdvVal>10000000)s+=15;
          if(margin<18)s+=15;
          if(ahPct>=25)s+=10;
          return Math.min(s,90);
        },
        conditions:["Large strategic sites (200+ units typical)","Infrastructure deficit (highways, drainage, utilities)","Demonstrable viability gap without grant","Strong local authority support","Housing delivery within 3 years of funding"],
        abnormalEstimate:function(){return Math.round(units2*8500)||0;},
        notes:"HIF is for strategic sites where infrastructure costs prevent delivery. Repayable element possible on stronger sites."
      },
      {
        id:"ah_subsidy",
        name:"Affordable Homes Programme",
        funder:"Homes England",
        type:"Revenue grant per unit",
        purpose:"Grant per affordable unit delivered",
        typical:"£28k–£80k per affordable unit depending on tenure and region",
        score:function(){
          var s=0;
          if(ahUnits>=10)s+=40;
          if(ahPct>=25)s+=20;
          if(ahPct>=35)s+=15;
          if(margin<20)s+=15;
          if(["manchester","birmingham","leeds","sheffield","liverpool","bristol","nottingham"].indexOf(cityVal)>=0)s+=10;
          return Math.min(s,92);
        },
        conditions:["Affordable units must meet AHP definition (social rent, AFF rent, shared ownership)","Registered Provider must be involved","Units must be additional (not converting existing stock)","Compliance with design standards"],
        abnormalEstimate:function(){return ahUnits*45000||0;},
        notes:"The most reliable grant for schemes with meaningful affordable housing. RPs access this directly  -  structure your deal to include an RP partner."
      },
      {
        id:"heat_network",
        name:"Heat Network Investment Project",
        funder:"DESNZ / UKGI",
        type:"Loan / grant hybrid",
        purpose:"Supporting heat network infrastructure in new developments",
        typical:"£2m–£30m per project",
        score:function(){
          var s=0;
          if(units2>=100)s+=30;
          if(units2>=300)s+=20;
          if(["london","manchester","birmingham","leeds","bristol","nottingham"].indexOf(cityVal)>=0)s+=20;
          if(gdvVal>15000000)s+=15;
          if(ahPct>=20)s+=15;
          return Math.min(s,75);
        },
        conditions:["Scheme of sufficient scale (100+ units typical)","Heat network technically viable","District heating connection planned","Carbon reduction evidence"],
        abnormalEstimate:function(){return Math.round(units2*3500)||0;},
        notes:"Primarily loan-based with potential grant element. Works best on larger mixed-tenure schemes in urban locations."
      },
      {
        id:"ukspf",
        name:"UK Shared Prosperity Fund",
        funder:"Local Authority / DLUHC",
        type:"Capital grant",
        purpose:"Local economic regeneration and community infrastructure",
        typical:"£100k–£2m",
        score:function(){
          var s=0;
          if(isBrownfield)s+=25;
          var deprivedAreas=["blackpool","burnley","bradford","middlesbrough","hull","sunderland","stoke","wolverhampton","oldham","rochdale"];
          if(deprivedAreas.indexOf(cityVal)>=0)s+=30;
          if(ahPct>=25)s+=15;
          if(units2>=50)s+=15;
          if(lpa)s+=15;
          return Math.min(s,80);
        },
        conditions:["Located in UKSPF investment area","Demonstrable community / economic benefit","Local authority support","Employment or skills element preferred"],
        abnormalEstimate:function(){return 500000;},
        notes:"Administered locally  -  contact the LA directly. Most useful for mixed-use or community-led schemes."
      },
      {
        id:"lep_grant",
        name:"LEP / Mayoral Development Grant",
        funder:"Local Enterprise Partnership / Combined Authority",
        type:"Capital grant",
        purpose:"Regional economic development and housing delivery",
        typical:"£250k–£5m",
        score:function(){
          var s=0;
          var mayors=["manchester","birmingham","leeds","liverpool","bristol","sheffield","cambridge","london"];
          if(mayors.indexOf(cityVal)>=0)s+=30;
          if(units2>=100)s+=20;
          if(gdvVal>5000000)s+=15;
          if(isBrownfield)s+=20;
          if(ahPct>=20)s+=15;
          return Math.min(s,80);
        },
        conditions:["Within Combined Authority area","Aligned with local economic strategy","Housing output demonstrated","Job creation or retention element"],
        abnormalEstimate:function(){return Math.round(units2*3000)||0;},
        notes:"Very location-dependent. Greater Manchester, West Midlands and West of England have most active programmes."
      },
      {
        id:"remediation_relief",
        name:"Remediation Relief / Contamination Tax Credit",
        funder:"HMRC / Treasury",
        type:"Tax relief",
        purpose:"Corporation tax relief on contamination / remediation costs",
        typical:"150% relief on qualifying remediation costs",
        score:function(){
          var s=0;
          if(isBrownfield)s+=50;
          if(g.hasContamination)s+=30;
          if(gdvVal>2000000)s+=20;
          return Math.min(s,90);
        },
        conditions:["Previously developed or contaminated land","Remediation costs incurred by developer","Corporation tax payer","Qualifying works evidenced"],
        abnormalEstimate:function(){return Math.round(acres2*80000*0.5)||0;},
        notes:"Not a grant but often overlooked  -  150% tax relief on remediation can be worth £500k+ on a brownfield site. Speak to your tax adviser."
      },
    ];

    // Calculate total potential funding
    var eligibleGrants=GRANTS.filter(function(gr){return gr.score()>=40;});
    var totalPotential=eligibleGrants.reduce(function(t,gr){return t+gr.abnormalEstimate();},0);
    var viabilityGap=gdvVal>0&&margin<18?Math.round(gdvVal*(0.18-margin/100)):0;

    // Brownfield toggle
    function toggle(k){up("grants",k,!g[k]);}

    // Funding gap model
    var abnormalTotal=num(g.enablingCost||0)+num(g.remediationCost||0)+num(g.drainageCost||0)+num(g.highwayCost||0)+num(g.utilityCost||0)+num(g.otherAbnormal||0);
    var grantsClaimed=num(g.brownfieldGrant||0)+num(g.ahpGrant||0)+num(g.hifGrant||0)+num(g.otherGrant||0);
    var fundingGap=Math.max(0,abnormalTotal-grantsClaimed);
    var grantedViabilityMargin=gdvVal>0?(margin+(grantsClaimed/gdvVal*100)):margin;

    function scoreColor(s){return s>=70?"#2D7A65":s>=45?"#9A7B3E":"#B05A35";}
    function scoreBadge(s){return s>=70?"HIGH":s>=45?"MEDIUM":"LOW";}

    return e("div",null,
      // Header
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}},
        e("div",null,
          e("div",{style:{fontSize:11,color:"#7278A0",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:4}},"Grant & Funding Intelligence"),
          e("h2",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",margin:"0 0 4px"}},"💷 "+addr),
          e("div",{style:{fontSize:12,color:"#7278A0"}},"Eligible grants are identified from your deal data. Scores are indicative  -  not legal or financial advice.")
        ),
        e("div",{style:{textAlign:"right"}},
          e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:2}},"Total potential funding"),
          e("div",{style:{fontSize:28,fontWeight:800,color:"#2D7A65"}},fmt(totalPotential)),
          e("div",{style:{fontSize:10,color:"#7278A0"}},"across "+eligibleGrants.length+" eligible grants")
        )
      ),

      // v10.90 — MAKE IT STACK WITH AFFORDABLE-HOUSING GRANT. Grant £/affordable home flows into
      // the engine (computeSFHMetrics adds it to the RLV), and this card advises the grant needed
      // to close the viability gap — so the Grants page can actually make a marginal scheme stack.
      (typeof grantToStack==="function") && (function(){
        var gt=grantToStack(data);
        var perHomeVal=num(g.grantPerAffHome);
        var inp={background:"#fff",border:"1px solid #BFD9CF",borderRadius:5,fontSize:13,fontFamily:"DM Sans,sans-serif",color:"#2E2F8A",padding:"8px 10px",width:150};
        var rlvAfter=gt.rlvBeforeGrant+gt.grantApplied;
        return e("div",{style:{background:"linear-gradient(135deg,#F1FBF6,#EAF3FF)",border:"1px solid #BFD9CF",borderRadius:10,padding:18,marginBottom:16}},
          e("div",{style:{fontSize:10,fontWeight:800,color:"#1B7A54",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}},"🏦 Make it stack — affordable-housing grant (Homes England)"),
          e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:10}},
            gt.affordableHomes>0
              ? "Grant per affordable home flows straight to the land value — it closes a viability gap. This scheme has ~"+fmtN(gt.affordableHomes)+" affordable homes."
              : "Set an affordable-housing % (Planning / Tenure Mix) first — grant applies to the affordable homes."
          ),
          e("div",{style:{display:"flex",gap:14,alignItems:"flex-end",flexWrap:"wrap",marginBottom:12}},
            e("div",null,
              e("label",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700,display:"block",marginBottom:3}},"Grant £ / affordable home"),
              e("input",{type:"number",value:g.grantPerAffHome||"",onChange:function(ev){up("grants","grantPerAffHome",ev.target.value);},placeholder:"e.g. 80000",style:inp})
            ),
            e("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
              [40000,80000,120000].map(function(v){ return e("button",{key:v,onClick:function(){up("grants","grantPerAffHome",v);},style:{padding:"8px 11px",background:perHomeVal===v?"#1B7A54":"#fff",color:perHomeVal===v?"#fff":"#3A3D6A",border:"1px solid #BFD9CF",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"£"+Math.round(v/1000)+"k"); })
            )
          ),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:10}},
            [
              {l:"RLV before grant",v:(gt.rlvBeforeGrant<0?"−":"")+fmt(Math.abs(gt.rlvBeforeGrant)),c:gt.rlvBeforeGrant>=0?"#1B7A54":"#B05A35"},
              {l:"Grant applied",v:fmt(gt.grantApplied),c:"#1B7A54"},
              {l:"RLV after grant",v:(rlvAfter<0?"−":"")+fmt(Math.abs(rlvAfter)),c:rlvAfter>=0?"#1B7A54":"#B05A35"}
            ].map(function(x){ return e("div",{key:x.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"9px 11px"}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700}},x.l),
              e("div",{style:{fontSize:16,fontWeight:800,color:x.c,marginTop:2}},x.v)); })
          ),
          (function(){
            if(gt.affordableHomes<=0) return "";
            var need=gt.landPrice>0?gt.perHomeToCoverPrice:gt.perHomeToPositive;
            var target=gt.landPrice>0?("cover the "+fmt(gt.landPrice)+" guide price"):"reach a positive residual";
            if(!(need>0)) return e("div",{style:{fontSize:11,color:"#1B7A54",fontWeight:700}},"✓ Stacks without grant"+(gt.landPrice>0?" at the guide price":"")+".");
            return e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6,background:"#fff",border:"1px dashed #BFD9CF",borderRadius:6,padding:"9px 11px"}},
              e("b",null,"Grant to make it stack: "),"~"+fmt(Math.round(need))+" per affordable home to "+target+" (× "+fmtN(gt.affordableHomes)+" homes ≈ "+fmt(Math.round(need*gt.affordableHomes))+"). ",
              "Homes England AHP / SAHP is area- and tenure-specific — broadly £"+Math.round(gt.typicalGrantLo/1000)+"k–£"+Math.round(gt.typicalGrantHi/1000)+"k/home; confirm the rate and eligibility (an RP partner is required)."
            );
          })()
        );
      })(),

      // Site flags
      e("div",{style:{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}},
        e("label",{style:{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:isBrownfield?"rgba(45,122,101,0.1)":"#F7F8FC",border:"1px solid "+(isBrownfield?"#2D7A65":"#DDE0ED"),borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,color:isBrownfield?"#2D7A65":"#7278A0"}},
          e("input",{type:"checkbox",checked:isBrownfield,onChange:function(){toggle("isBrownfield");},style:{accentColor:"#2D7A65"}}),
          "Brownfield / Previously developed"
        ),
        e("label",{style:{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:g.hasContamination?"rgba(176,90,53,0.08)":"#F7F8FC",border:"1px solid "+(g.hasContamination?"#B05A35":"#DDE0ED"),borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,color:g.hasContamination?"#B05A35":"#7278A0"}},
          e("input",{type:"checkbox",checked:g.hasContamination||false,onChange:function(){toggle("hasContamination");},style:{accentColor:"#B05A35"}}),
          "Contamination / Remediation required"
        ),
        e("label",{style:{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:g.hasFlood?"rgba(154,123,62,0.08)":"#F7F8FC",border:"1px solid "+(g.hasFlood?"#9A7B3E":"#DDE0ED"),borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,color:g.hasFlood?"#9A7B3E":"#7278A0"}},
          e("input",{type:"checkbox",checked:g.hasFlood||false,onChange:function(){toggle("hasFlood");},style:{accentColor:"#9A7B3E"}}),
          "Flood risk / Drainage abnormals"
        )
      ),

      // Grant cards
      e("div",{style:{marginBottom:16}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}},"Grant Eligibility Scoring"),
        GRANTS.map(function(gr){
          var sc=gr.score();
          var est=gr.abnormalEstimate();
          var col=scoreColor(sc);
          var badge=scoreBadge(sc);
          var isOpen=g["open_"+gr.id];
          return e("div",{key:gr.id,style:{background:"#fff",border:"1px solid "+(sc>=70?"#2D7A65":sc>=45?"#DDE0ED":"#E8E8F0"),borderRadius:10,marginBottom:8,overflow:"hidden",opacity:sc<30?0.6:1}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",cursor:"pointer"},onClick:function(){up("grants","open_"+gr.id,!isOpen);}},
              e("div",{style:{flex:1}},
                e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:2}},
                  e("span",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A"}},gr.name),
                  e("span",{style:{padding:"2px 8px",background:sc>=70?"rgba(45,122,101,0.1)":sc>=45?"rgba(154,123,62,0.1)":"rgba(176,90,53,0.08)",color:col,fontSize:9,fontWeight:800,borderRadius:10,letterSpacing:".06em"}},badge+" PROBABILITY")
                ),
                e("div",{style:{fontSize:11,color:"#7278A0"}},gr.funder+" · "+gr.type+" · Typical: "+gr.typical)
              ),
              e("div",{style:{display:"flex",alignItems:"center",gap:12,marginLeft:12}},
                e("div",{style:{textAlign:"right"}},
                  e("div",{style:{fontSize:16,fontWeight:800,color:col}},sc+"%"),
                  e("div",{style:{fontSize:9,color:"#7278A0"}},fmt(est)+" est.")
                ),
                e("div",{style:{width:36,height:36,borderRadius:"50%",background:"#F0F1FA",display:"flex",alignItems:"center",justifyContent:"center",color:"#7278A0",fontSize:14}},isOpen?"▲":"▼")
              )
            ),
            // Score bar
            e("div",{style:{height:4,background:"#F0F1FA"}},
              e("div",{style:{width:sc+"%",height:"100%",background:col,transition:"width .4s"}})
            ),
            // Expanded detail
            isOpen&&e("div",{style:{padding:"14px 16px",borderTop:"1px solid #F0F1FA"}},
              e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:12}},
                e("div",null,
                  e("div",{style:{fontSize:10,fontWeight:800,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}},"Eligibility conditions"),
                  gr.conditions.map(function(c2,ci){
                    return e("div",{key:ci,style:{display:"flex",gap:6,marginBottom:4,fontSize:11,color:"#3A3D6A"}},
                      e("span",{style:{color:"#2D7A65",flexShrink:0}},"✓"),c2
                    );
                  })
                ),
                e("div",null,
                  e("div",{style:{fontSize:10,fontWeight:800,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}},"Estimated quantum"),
                  e("div",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",marginBottom:4}},fmt(est)),
                  e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6}},gr.notes)
                )
              )
            )
          );
        })
      ),

      // Abnormal cost & funding gap model
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}},"Abnormal Cost & Funding Gap Model"),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}},
          [
            {k:"enablingCost",l:"Enabling & demolition"},
            {k:"remediationCost",l:"Remediation / decontamination"},
            {k:"drainageCost",l:"Drainage abnormals"},
            {k:"highwayCost",l:"Highways / S278"},
            {k:"utilityCost",l:"Utility diversions"},
            {k:"otherAbnormal",l:"Other abnormals"},
          ].map(function(row){
            return e("div",{key:row.k},
              e("label",{style:{fontSize:10,color:"#7278A0",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:3}},row.l),
              e("input",{type:"number",value:g[row.k]||"",onChange:function(ev){up("grants",row.k,ev.target.value);},placeholder:"£0",style:{width:"100%",padding:"7px 10px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:12,fontFamily:"DM Mono,monospace",color:"#2E2F8A"}})
            );
          })
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14,paddingTop:12,borderTop:"1px solid #DDE0ED"}},
          [
            {k:"brownfieldGrant",l:"Brownfield / BLRF grant secured"},
            {k:"ahpGrant",l:"AHP grant (per unit × units)"},
            {k:"hifGrant",l:"HIF / infrastructure grant"},
            {k:"otherGrant",l:"Other grant funding"},
          ].map(function(row){
            return e("div",{key:row.k},
              e("label",{style:{fontSize:10,color:"#2D7A65",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:3}},row.l),
              e("input",{type:"number",value:g[row.k]||"",onChange:function(ev){up("grants",row.k,ev.target.value);},placeholder:"£0",style:{width:"100%",padding:"7px 10px",border:"1px solid rgba(45,122,101,0.3)",borderRadius:6,fontSize:12,fontFamily:"DM Mono,monospace",color:"#2D7A65"}})
            );
          })
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}},
          [
            {l:"Total abnormals",v:fmt(abnormalTotal),c:"#B05A35"},
            {l:"Total grants",v:fmt(grantsClaimed),c:"#2D7A65"},
            {l:"Residual funding gap",v:fmt(fundingGap),c:fundingGap>0?"#B05A35":"#2D7A65"},
          ].map(function(item){
            return e("div",{key:item.l,style:{background:"#F7F8FC",borderRadius:8,padding:"12px 14px",borderTop:"3px solid "+item.c}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",marginBottom:3}},item.l),
              e("div",{style:{fontSize:18,fontWeight:800,color:item.c}},item.v)
            );
          })
        ),
        grantsClaimed>0&&e("div",{style:{marginTop:10,padding:"8px 12px",background:"rgba(45,122,101,0.06)",borderRadius:6,fontSize:11,color:"#2D7A65"}},
          "With grants of "+fmt(grantsClaimed)+" applied, effective development margin improves to "+Math.round(grantedViabilityMargin*10)/10+"% (was "+Math.round(margin*10)/10+"% without funding)"
        )
      ),

      // Grant Strategy Pack generator
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}},"Grant Strategy Pack"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:12,lineHeight:1.7}},"AI generates a 10-section funding application pack covering all the criteria funders look for. Based on your deal data."),
        [
          {id:"gs_site",l:"1. Site Summary & Public Benefits",key:"gs_site"},
          {id:"gs_housing",l:"2. Housing Outputs & Affordability",key:"gs_housing"},
          {id:"gs_viability",l:"3. Viability Gap Explanation",key:"gs_viability"},
          {id:"gs_abnormal",l:"4. Abnormal Costs Schedule",key:"gs_abnormal"},
          {id:"gs_programme",l:"5. Delivery Programme",key:"gs_programme"},
          {id:"gs_economic",l:"6. Economic Benefits & Jobs",key:"gs_economic"},
          {id:"gs_infra",l:"7. Infrastructure Need",key:"gs_infra"},
          {id:"gs_ask",l:"8. Funding Ask & Justification",key:"gs_ask"},
          {id:"gs_roi",l:"9. Return on Public Investment",key:"gs_roi"},
          {id:"gs_strategy",l:"10. Grant Structuring Strategy",key:"gs_strategy"},
        ].map(function(sec){
          var txt=g[sec.key]||"";
          var loading=g["loading_"+sec.id];
          var isOpen=g["gopen_"+sec.id];

          var prompts={
            gs_site:"Write a site summary section for a grant application. Site: "+addr+", "+cityName(cityVal)+", "+acres2+" acres. Planning status: "+(p.status||"unallocated")+". LPA: "+lpa+". Brownfield: "+isBrownfield+". Units: "+units2+". Describe the public benefit of bringing this site forward, the housing need it addresses, and why public funding support is appropriate. 150 words, formal grant application tone.",
            gs_housing:"Write a housing outputs section for a grant application. Total units: "+units2+". Affordable: "+ahUnits+" units ("+ahPct+"%). GDV: "+fmt(gdvVal)+". Describe the housing mix, affordability levels, the local housing need context, and how the affordable housing output justifies grant support. Reference Homes England AHP criteria. 150 words.",
            gs_viability:"Write a viability gap explanation for a grant application. Current development margin: "+Math.round(margin)+"%. Target viability threshold: 18-20%. Abnormal costs: "+fmt(abnormalTotal)+". Funding gap: "+fmt(fundingGap)+". GDV: "+fmt(gdvVal)+". Explain clearly why this site cannot come forward without grant support, using the residual method and referencing RICS Red Book guidance. 180 words. Formal tone.",
            gs_abnormal:"Write an abnormal costs schedule narrative for a grant application. Itemise these costs: enabling works £"+num(g.enablingCost||0).toLocaleString()+", remediation £"+num(g.remediationCost||0).toLocaleString()+", drainage £"+num(g.drainageCost||0).toLocaleString()+", highways £"+num(g.highwayCost||0).toLocaleString()+", utilities £"+num(g.utilityCost||0).toLocaleString()+", other £"+num(g.otherAbnormal||0).toLocaleString()+". Total: "+fmt(abnormalTotal)+". Explain why these costs are abnormal compared to a standard greenfield site and how they've been quantified. 150 words.",
            gs_programme:"Write a delivery programme section for a grant application. Site: "+addr+". Planning status: "+(p.status||"unallocated")+". Units: "+units2+". Estimated programme: "+(f.programmeMths||36)+" months build, total project "+(Math.round((f.programmeMths||36)/12+1.5))+" years. Describe key milestones, start on site target, phasing and how the grant funding enables earlier delivery. 150 words.",
            gs_economic:"Write an economic benefits section for a grant application covering: direct construction jobs (estimate 1 job per £100k spend), indirect supply chain employment, business rates uplift from completed homes, council tax revenue, local spend by new residents. Build cost: "+fmt(num(rlvD.buildPsf||f.buildPsf||180)*units2*850)+". "+units2+" new homes. "+cityName(cityVal)+" location. 150 words.",
            gs_infra:"Write an infrastructure need section for a grant application. Describe the infrastructure requirements for "+addr+": drainage ("+fmt(num(g.drainageCost||0))+"), highways ("+fmt(num(g.highwayCost||0))+"), utilities ("+fmt(num(g.utilityCost||0))+"). Explain why these are necessary for the site to come forward and how they connect to wider strategic infrastructure. 150 words.",
            gs_ask:"Write a clear funding ask section for a grant application. Total grant sought: "+fmt(grantsClaimed||totalPotential)+". Breakdown: BLRF/brownfield grant £"+num(g.brownfieldGrant||0).toLocaleString()+", AHP grant £"+num(g.ahpGrant||0).toLocaleString()+", HIF/infrastructure £"+num(g.hifGrant||0).toLocaleString()+", other £"+num(g.otherGrant||0).toLocaleString()+". Total abnormals: "+fmt(abnormalTotal)+". Explain how the grant will be spent, the basis for the quantum, and why this is the minimum necessary to make the scheme viable. 150 words.",
            gs_roi:"Write a return on public investment section for a grant application. Grant sought: "+fmt(grantsClaimed||totalPotential)+". Housing output: "+units2+" homes ("+ahUnits+" affordable). Council tax per year from completed homes (est. £"+Math.round(units2*1800).toLocaleString()+"pa). Business rates unlocked. Developer contribution to infrastructure. Calculate cost per home, cost per affordable home, and payback period. Make the case for public investment clearly. 150 words.",
            gs_strategy:"Write a grant structuring strategy section. Explain the professional approach to using grant funding: grants should enhance viability not be the sole reason a deal works; structuring schemes to qualify; using grants to reduce risk and improve leverage; layering multiple funding sources; and maintaining commercial discipline. Site: "+addr+". Current margin: "+Math.round(margin)+"%. With grants: "+Math.round(grantedViabilityMargin)+"%. 150 words. This should demonstrate sophisticated grant management."
          };

          function generateSection2(){
            up("grants","loading_"+sec.id,true);
            var params=new URLSearchParams({action:"ai",stage:"grants",
              user:(user&&user.name)||"",company:(user&&user.company)||"",
              system:"You are a senior UK development finance director writing a formal grant application for a Homes England or DLUHC funding programme. Be specific, evidence-based and professional.",
              prompt:(prompts[sec.key]||"Write a professional grant application section for "+sec.l+".")
            });
            fetch(WEBHOOK+"?"+params.toString())
            .then(function(r2){return r2.json();})
            .then(function(d){up("grants",sec.key,d.result||"");up("grants","loading_"+sec.id,false);})
            .catch(function(){up("grants","loading_"+sec.id,false);});
          }

          return e("div",{key:sec.id,style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,marginBottom:6,overflow:"hidden"}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",cursor:"pointer"},onClick:function(){up("grants","gopen_"+sec.id,!isOpen);}},
              e("div",{style:{display:"flex",alignItems:"center",gap:8}},
                e("span",{style:{width:18,height:18,borderRadius:"50%",background:txt?"#2D7A65":"#DDE0ED",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:txt?"#fff":"#7278A0",flexShrink:0}},txt?"✓":"·"),
                e("span",{style:{fontSize:12,fontWeight:600,color:"#2E2F8A"}},sec.l)
              ),
              e("div",{style:{display:"flex",gap:8}},
                e("button",{onClick:function(ev){ev.stopPropagation();generateSection2();},disabled:loading,
                  style:{padding:"4px 10px",background:loading?"#8889C8":"#4A4BAE",border:"none",borderRadius:4,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
                },loading?"Writing...":"Generate"),
                e("span",{style:{fontSize:11,color:"#7278A0"}},isOpen?"▲":"▼")
              )
            ),
            (txt&&isOpen)&&e("div",{style:{padding:"12px 14px",borderTop:"1px solid #DDE0ED"}},
              e("textarea",{value:txt,onChange:function(ev){up("grants",sec.key,ev.target.value);},
                style:{width:"100%",minHeight:100,padding:"8px 12px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontFamily:"DM Sans,sans-serif",color:"#3A3D6A",lineHeight:1.75,resize:"vertical"}
              })
            )
          );
        }),

        e("div",{style:{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}},
          e("button",{
            onClick:function(){
              try {
                var secs=["gs_site","gs_housing","gs_viability","gs_abnormal","gs_programme","gs_economic","gs_infra","gs_ask","gs_roi","gs_strategy"];
                var prompts2={
                  gs_site:"Site summary for grant application. Site: "+addr+", "+cityName(cityVal)+", "+acres2+" acres, "+units2+" units, "+ahPct+"% affordable. Brownfield: "+isBrownfield+". LPA: "+lpa+". Public benefit and housing need. 120 words formal tone.",
                  gs_housing:"Housing outputs section. "+units2+" total, "+ahUnits+" affordable ("+ahPct+"%). GDV "+fmt(gdvVal)+". Housing need context and AHP criteria. 120 words.",
                  gs_viability:"Viability gap explanation. Margin "+Math.round(margin)+"%, target 18-20%, abnormals "+fmt(abnormalTotal)+", gap "+fmt(fundingGap)+". RICS Red Book residual method. 140 words.",
                  gs_abnormal:"Abnormal costs: enabling £"+num(g.enablingCost||0).toLocaleString()+", remediation £"+num(g.remediationCost||0).toLocaleString()+", drainage £"+num(g.drainageCost||0).toLocaleString()+", highways £"+num(g.highwayCost||0).toLocaleString()+". Total "+fmt(abnormalTotal)+". 120 words.",
                  gs_programme:"Delivery programme: "+units2+" units, "+(p.status||"unallocated")+" planning, "+(f.programmeMths||36)+" months build. Milestones and grant enabling earlier delivery. 120 words.",
                  gs_economic:"Economic benefits: construction jobs, council tax "+fmt(units2*1800)+"pa, local spend, supply chain. "+units2+" homes in "+cityName(cityVal)+". 120 words.",
                  gs_infra:"Infrastructure need: drainage "+fmt(num(g.drainageCost||0))+", highways "+fmt(num(g.highwayCost||0))+", utilities "+fmt(num(g.utilityCost||0))+". Why necessary. 120 words.",
                  gs_ask:"Funding ask: "+fmt(grantsClaimed||totalPotential)+" total. Breakdown and minimum necessary for viability. 120 words.",
                  gs_roi:"Return on public investment: "+units2+" homes, "+ahUnits+" affordable, council tax "+fmt(units2*1800)+"pa, cost per home "+fmt((grantsClaimed||totalPotential)/Math.max(units2,1))+". 120 words.",
                  gs_strategy:"Grant structuring strategy: enhance viability not replace it, layering sources, margin "+Math.round(margin)+"% to "+Math.round(grantedViabilityMargin)+"% with grants. 120 words."
                };
                // Mark all 10 as loading immediately for visual feedback
                secs.forEach(function(k,i){
                  up("grants","loading_grant_"+i,true);
                });
                // Stagger calls to avoid rate limits
                secs.forEach(function(k,i){
                  setTimeout(function(){
                    var params=new URLSearchParams({action:"ai",stage:"grants",
                      user:(user&&user.name)||"",company:(user&&user.company)||"",
                      system:"You are a senior UK development finance director writing a formal grant application. Be specific and professional.",
                      prompt:prompts2[k]||k
                    });
                    fetch(WEBHOOK+"?"+params.toString())
                    .then(function(r2){return r2.json();})
                    .then(function(d){
                      up("grants",k,(d&&d.result)||"");
                      up("grants","loading_grant_"+i,false);
                    })
                    .catch(function(err){
                      console.error("Grant generation failed for "+k,err);
                      up("grants","loading_grant_"+i,false);
                      up("grants",k+"_error","Network error — try again");
                    });
                  },i*700);
                });
              } catch(err) {
                console.error("Grant Strategy Pack generation error:",err);
                notify("Grant Strategy Pack generation failed. Please ensure deal data is populated and try again.");
              }
            },
            style:{padding:"10px 20px",background:"linear-gradient(135deg,#2D7A65,#4A4BAE)",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"🧠 Generate Full Grant Strategy Pack"),
          e("button",{
            onClick:function(){
              var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap");body{font-family:"DM Sans",sans-serif;max-width:720px;margin:0 auto;padding:48px 60px;color:#1a1a2e;font-size:13px;line-height:1.75;}h1{font-size:24px;font-weight:800;color:#2E2F8A;margin:0 0 4px;}h2{font-size:16px;font-weight:800;color:#2E2F8A;margin:28px 0 8px;padding-top:12px;border-top:2px solid #E8E8F0;}p{margin:0 0 12px;color:#3A3D6A;}.header{background:linear-gradient(135deg,#1E1F5C,#2E2F8A);color:#fff;padding:32px 40px;margin:-48px -60px 40px;}.h-logo{font-size:14px;font-weight:800;letter-spacing:.2em;margin-bottom:4px;}.h-title{font-size:22px;font-weight:800;margin:16px 0 4px;}.h-sub{font-size:12px;opacity:.6;}.metrics-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0;}.mbox{background:#F7F8FC;border:1px solid #DDE0ED;border-radius:8px;padding:12px 14px;}.ml{font-size:9px;color:#7278A0;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px;}.mv{font-size:16px;font-weight:800;color:#2E2F8A;}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #E8E8F0;font-size:10px;color:#7278A0;display:flex;justify-content:space-between;}@media print{.header{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}'+
              '</style></head><body>'+
              '<div class="header">'+((typeof BRAND_LOGO_PNG!=="undefined"&&BRAND_LOGO_PNG&&typeof cassidyLogoSrc==="function")?'<div style="background:#fff;border-radius:7px;padding:6px 10px;display:inline-flex;margin-bottom:10px"><img src="'+cassidyLogoSrc()+'" alt="Cassidy Group Ltd" style="height:30px;width:auto;max-width:180px;display:block"/></div>':'<div class="h-logo">CASSIDY GROUP</div>')+'<div class="h-title">Grant Strategy Pack</div><div class="h-title" style="font-size:16px">'+addr+'</div><div class="h-sub">'+cityName(cityVal)+(lpa?" · "+lpa:"")+" · Prepared "+new Date().toLocaleDateString("en-GB")+'</div></div>'+
              '<div class="metrics-row"><div class="mbox"><div class="ml">GDV</div><div class="mv">'+fmt(gdvVal)+'</div></div><div class="mbox"><div class="ml">Total abnormals</div><div class="mv">'+fmt(abnormalTotal)+'</div></div><div class="mbox"><div class="ml">Grant potential</div><div class="mv">'+fmt(totalPotential)+'</div></div><div class="mbox"><div class="ml">Margin with grants</div><div class="mv">'+Math.round(grantedViabilityMargin)+'%</div></div></div>'+
              ['gs_site','gs_housing','gs_viability','gs_abnormal','gs_programme','gs_economic','gs_infra','gs_ask','gs_roi','gs_strategy'].map(function(k,i){
                var labels=['Site Summary & Public Benefits','Housing Outputs & Affordability','Viability Gap Explanation','Abnormal Costs Schedule','Delivery Programme','Economic Benefits & Jobs','Infrastructure Need','Funding Ask & Justification','Return on Public Investment','Grant Structuring Strategy'];
                var txt2=g[k]||"";
                if(!txt2)return"";
                return'<h2>'+(i+1)+'. '+labels[i]+'</h2><p>'+txt2.replace(/\n\n/g,"</p><p>").replace(/\n/g," ")+'</p>';
              }).join("")+
              '<div class="footer"><span>'+addr+' Grant Strategy Pack · Cassidy Group</span><span>'+new Date().toLocaleDateString("en-GB")+'</span><span>Built by Phil Daniel · Landform</span></div>'+
              '</body></html>';
              var w=window.open("","_blank","width=900,height=700");
              if(!w){notify("Allow pop-ups");return;}
              w.document.write(html);w.document.close();
              setTimeout(function(){w.print();},500);
            },
            style:{padding:"10px 18px",background:"#2E2F8A",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"🖨 Print Grant Pack")
        )
      ),

      // ── GRANT ACTION PLAN ────────────────────────────────────────────────────
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}},"Grant Action Plan"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14,lineHeight:1.7}},"Prioritised next steps for each eligible programme. Do these in order  -  AHP first, BLRF second, HIF third."),

        // AHP Action Plan
        ahUnits>=10&&e("div",{style:{marginBottom:16,padding:"14px 16px",background:"rgba(45,122,101,0.04)",border:"1px solid rgba(45,122,101,0.2)",borderRadius:8}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
            e("div",{style:{fontSize:12,fontWeight:800,color:"#2D7A65"}},"(1) Affordable Homes Programme  -  do this first"),
            e("span",{style:{fontSize:10,padding:"3px 8px",background:"rgba(45,122,101,0.1)",color:"#2D7A65",borderRadius:10,fontWeight:700}},"HIGHEST IMPACT")
          ),
          [
            {n:1,l:"Identify your RP partner",d:"The RP applies for AHP  -  not you. Contact VIVID, L&Q, Clarion, Platform, Sovereign or a local RP. They must be on Homes England's strategic partner list. Your existing RP relationships are the fastest route.",act:"Email your shortlist of RPs with the deal summary from the Teaser PDF stage"},
            {n:2,l:"Share your viability appraisal with the RP",d:"They need your GDV, build cost, affordable unit numbers, transfer price and delivery programme to submit their AHP bid. Use the Detailed Appraisal export from Landform.",act:"Export the Detailed Appraisal PDF and send to RP alongside the Grant Strategy Pack viability section"},
            {n:3,l:"Agree the affordable transfer price",d:"The RP will calculate what they can pay for the affordable units based on the grant they receive (typically £28k–£80k/unit depending on region and tenure). This sets your land price negotiation.",act:"Model the transfer price in the Financial Modelling stage  -  target 40-60% of open market value for social rent"},
            {n:4,l:"RP submits AHP bid via Homes England IMS",d:"The RP logs into the Investment Management System (IMS) at gov.uk/homes-england. They submit unit numbers, tenure split, grant per unit request, and development programme. You provide supporting evidence.",act:"Prepare: site address, planning status, unit schedule, programme dates  -  all extractable from Landform"},
            {n:5,l:"Decision and drawdown",d:"Homes England assess within 8-16 weeks. Grant paid to RP in tranches: on start on site and practical completion. Your land deal should be conditional on AHP approval.",act:"Structure heads of terms with AHP approval as a condition precedent"},
          ].map(function(step){
            return e("div",{key:step.n,style:{display:"flex",gap:12,marginBottom:10,paddingBottom:10,borderBottom:"1px dashed rgba(45,122,101,0.15)"}},
              e("div",{style:{width:24,height:24,borderRadius:"50%",background:"#2D7A65",color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},step.n),
              e("div",{style:{flex:1}},
                e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A",marginBottom:2}},step.l),
                e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6,marginBottom:4}},step.d),
                e("div",{style:{fontSize:10,color:"#2D7A65",fontWeight:700,background:"rgba(45,122,101,0.07)",padding:"4px 8px",borderRadius:4}},"→ "+step.act)
              )
            );
          }),
          e("div",{style:{fontSize:11,color:"#2D7A65",fontWeight:600,marginTop:4}},
            "Key contact: Homes England Investment & Sales team · 0300 1234 500 · homesengland.gov.uk · Your RP does this, not you"
          )
        ),

        // BLRF Action Plan
        isBrownfield&&e("div",{style:{marginBottom:16,padding:"14px 16px",background:"rgba(74,75,174,0.04)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:8}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
            e("div",{style:{fontSize:12,fontWeight:800,color:"#4A4BAE"}},"(2) Brownfield Land Release Fund"),
            e("span",{style:{fontSize:10,padding:"3px 8px",background:"rgba(74,75,174,0.1)",color:"#4A4BAE",borderRadius:10,fontWeight:700}},"BROWNFIELD SITES")
          ),
          [
            {n:1,l:"Call your LA planning or regeneration team",d:"BLRF requires LA sponsorship or co-application. The LA must support the application. Get a meeting with the Head of Regeneration or Planning Policy  -  not the duty planner.",act:"Email: 'We are bringing forward [site] and want to explore BLRF funding  -  can we meet to discuss LA support?'"},
            {n:2,l:"Check if BLRF is open",d:"BLRF runs in competitive rounds managed by Homes England. Check homesengland.gov.uk/brownfield-land-release-fund for current rounds and deadlines. Applications are typically open 6-8 weeks.",act:"Bookmark: homesengland.gov.uk and sign up for Homes England developer updates"},
            {n:3,l:"Prepare the BLRF business case",d:"Assessment criteria: value for money (cost per home unlocked), additionality (would it happen without the grant), deliverability, and housing output. Your Grant Strategy Pack sections 1, 3, 4, 7 and 8 map directly to these criteria.",act:"Use the Grant Strategy Pack from Landform as your business case draft  -  edit sections 3 (viability gap) and 4 (abnormal costs) with actual cost schedules"},
            {n:4,l:"Submit via the Homes England portal",d:"Joint submission with the LA. You provide the site, cost evidence and delivery commitment. The LA provides a support letter and sometimes contributes match funding.",act:"Gather: Phase 1 environmental report, remediation cost estimate (get a quote), planning pre-app evidence, delivery programme"},
            {n:5,l:"Grant agreement and milestones",d:"If successful, a grant agreement is signed with Homes England and the LA. Typically paid in tranches tied to delivery milestones. Clawback provisions apply if housing not delivered.",act:"Instruct solicitors to review grant agreement before signing  -  clawback and repayment terms vary"},
          ].map(function(step){
            return e("div",{key:step.n,style:{display:"flex",gap:12,marginBottom:10,paddingBottom:10,borderBottom:"1px dashed rgba(74,75,174,0.15)"}},
              e("div",{style:{width:24,height:24,borderRadius:"50%",background:"#4A4BAE",color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},step.n),
              e("div",{style:{flex:1}},
                e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A",marginBottom:2}},step.l),
                e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6,marginBottom:4}},step.d),
                e("div",{style:{fontSize:10,color:"#4A4BAE",fontWeight:700,background:"rgba(74,75,174,0.07)",padding:"4px 8px",borderRadius:4}},"→ "+step.act)
              )
            );
          }),
          e("div",{style:{fontSize:11,color:"#4A4BAE",fontWeight:600,marginTop:4}},
            "Key contact: Homes England regional office for your area · homesengland.gov.uk/contact · Also contact your LA Head of Regeneration"
          )
        ),

        // HIF Action Plan
        units2>=200&&e("div",{style:{marginBottom:16,padding:"14px 16px",background:"rgba(154,123,62,0.04)",border:"1px solid rgba(154,123,62,0.2)",borderRadius:8}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
            e("div",{style:{fontSize:12,fontWeight:800,color:"#9A7B3E"}},"(3) Housing Infrastructure Fund"),
            e("span",{style:{fontSize:10,padding:"3px 8px",background:"rgba(154,123,62,0.1)",color:"#9A7B3E",borderRadius:10,fontWeight:700}},"200+ UNITS")
          ),
          [
            {n:1,l:"Check if HIF is open  -  it runs in rounds",d:"HIF is not always available. Monitor Homes England website and consider registering as a developer. When open, the window is typically 8-12 weeks. Applications must be supported by the LA.",act:"Register at homesengland.gov.uk/developers and set up email alerts"},
            {n:2,l:"Engage Homes England before applying",d:"HIF is relationship-driven at large scale. Contact your local Homes England Area Director for an informal discussion before committing to a formal application. They will tell you whether your site is competitive.",act:"Find your Homes England Area Director at homesengland.gov.uk/about/our-people"},
            {n:3,l:"Prepare the full business case",d:"HIF requires a detailed infrastructure cost schedule (prepared by a QS), a viability appraisal showing the funding gap, a planning programme, a delivery agreement and LA sign-off. Lead time is 3-6 months.",act:"Commission a QS infrastructure cost report  -  this is the evidence base. Costs £5-15k but essential"},
            {n:4,l:"LA must lead or co-lead",d:"Homes England prefer LA-led HIF bids. The stronger the LA support letter, the better. Ideally the LA should be a delivery partner, not just a supporter.",act:"Present your scheme to the LA leader and portfolio holder  -  get political as well as officer support"},
          ].map(function(step){
            return e("div",{key:step.n,style:{display:"flex",gap:12,marginBottom:10,paddingBottom:10,borderBottom:"1px dashed rgba(154,123,62,0.15)"}},
              e("div",{style:{width:24,height:24,borderRadius:"50%",background:"#9A7B3E",color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},step.n),
              e("div",{style:{flex:1}},
                e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A",marginBottom:2}},step.l),
                e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6,marginBottom:4}},step.d),
                e("div",{style:{fontSize:10,color:"#9A7B3E",fontWeight:700,background:"rgba(154,123,62,0.07)",padding:"4px 8px",borderRadius:4}},"→ "+step.act)
              )
            );
          }),
          e("div",{style:{fontSize:11,color:"#9A7B3E",fontWeight:600,marginTop:4}},
            "Key contact: Homes England Strategic Sites team · Large-scale enquiries: 0300 1234 500 option 2"
          )
        ),

        // Remediation relief
        (isBrownfield||g.hasContamination)&&e("div",{style:{marginBottom:16,padding:"14px 16px",background:"rgba(138,138,168,0.04)",border:"1px solid #DDE0ED",borderRadius:8}},
          e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A",marginBottom:10}},"(4) Remediation Relief  -  speak to your tax adviser now"),
          e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.7,marginBottom:8}},
            "150% corporation tax relief on qualifying remediation costs. Not a grant  -  but often worth more than BLRF on a contaminated site. Keep all remediation cost records from day one. Your accountant claims this through your corporation tax return.",
          ),
          e("div",{style:{fontSize:10,color:"#4A4BAE",fontWeight:700,background:"rgba(74,75,174,0.07)",padding:"6px 10px",borderRadius:4}},
            "→ Action: Instruct your tax adviser to review qualifying costs before work starts. HMRC guidance: gov.uk/guidance/remediation-of-contaminated-land-relief"
          )
        ),

        // Draft email button
        e("div",{style:{marginTop:14,padding:"14px 16px",background:"#F7F8FC",borderRadius:8,border:"1px solid #DDE0ED"}},
          e("div",{style:{fontSize:11,fontWeight:700,color:"#2E2F8A",marginBottom:6}},"Draft your first move"),
          e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:10,lineHeight:1.6}},"The fastest next step on most deals is emailing your RP shortlist. Click below to draft the email."),
          e("button",{
            onClick:function(){
              if(!g.showEmailDraft&&!g.emailDraft){
                var subj="Subject: Affordable Housing Opportunity - "+addr;
                var body="Dear [RP Housing Development Team],"+"\n\nI am writing to introduce a residential development opportunity that may be of interest as part of your affordable housing pipeline."+"\n\nSite: "+addr+"\nLocation: "+cityName(cityVal||"")+(lpa?" ("+lpa+")":"")+"\nProposed units: "+units2+" total, "+ahUnits+" affordable ("+ahPct+"%)\nPlanning status: "+(p.status||l.planningStatus||"Pre-application")+"\nGDV: "+fmt(gdvVal)+"\nResidual land value: "+fmt(rlvVal)+"\n\nWe believe this site may qualify for AHP funding and are seeking an RP partner to work with us.\n\nKind regards,\n"+((user&&user.name)||"[Your name]")+"\nCassidy Group";
                up("grants","emailDraft",subj+"\n\n"+body);
              }
              up("grants","showEmailDraft",!g.showEmailDraft);
            },
            style:{padding:"7px 16px",background:"#2E2F8A",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"✉ Draft RP Introduction Email"),
          g.showEmailDraft&&e("div",{style:{marginTop:12}},
            e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:4}},"Edit before sending:"),
            e("textarea",{
              value:g.emailDraft||"",
              onChange:function(ev){up("grants","emailDraft",ev.target.value);},
              style:{width:"100%",minHeight:300,padding:"10px 14px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:11,fontFamily:"DM Sans,sans-serif",color:"#3A3D6A",lineHeight:1.75,resize:"vertical"}
            }),
            e("div",{style:{display:"flex",gap:8,marginTop:8}},
              e("button",{
                onClick:function(){
                  var txt=g.emailDraft||"";
                  var lines=txt.split("\n");
                  var subject=lines[0].replace("Subject: ","").trim();
                  var body=lines.slice(2).join("\n").trim();
                  var mailto="mailto:?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
                  window.open(mailto,"_blank");
                },
                style:{padding:"7px 16px",background:"#2D7A65",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"📧 Open in Email Client"),
              e("button",{
                onClick:function(){
                  var txt=g.emailDraft||"";
                  var el=document.createElement("textarea");
                  el.value=txt;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);
                  notify("Email copied to clipboard");
                },
                style:{padding:"7px 16px",background:"#F0F1FA",border:"1px solid #DDE0ED",borderRadius:6,color:"#2E2F8A",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"📋 Copy to Clipboard")
            )
          )
        )
      ),

      // Commercial reality note
      e("div",{style:{background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:8,padding:"14px 18px",marginTop:4,fontSize:11,color:"#4A4BAE",lineHeight:1.8}},
        e("strong",null,"Commercial note: "),"The best developers structure schemes to qualify for grants  -  they don't rely on grants to make a deal work. Use this tool to enhance viability, reduce risk and improve leverage on sites that are already viable or near-viable. A grant should add margin, not create it."
      )
    );
  }
