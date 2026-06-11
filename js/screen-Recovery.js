// ── renderRecovery  (params: city, data, navTo, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderRecovery(city, data, navTo, up, user){
    var l=data.land||{};
    var r=data.recovery||{};
    var acres=num(l.acres||0);
    var lCity=l.city||city||"manchester";
    var lpa=l.localAuthority||l.lpa||data.planning&&data.planning.lpa||"";
    var refusalReason=r.refusalReason||"";
    var knockdownPrice=num(r.knockdownPrice||l.price||0);
    var marketValue=num(r.marketValue||0);
    var discount=marketValue>0?Math.round((1-(knockdownPrice/marketValue))*100):0;

    var REFUSAL_ROUTES={
      "Out of settlement boundary":{
        risk:"High",timeframe:"18-36 months",
        routes:[
          {name:"Local Plan Allocation Campaign",prob:"Medium",desc:"Engage with the Local Plan review process. Promote the site for allocation in the next Local Plan. Evidence housing need, accessibility and sustainability."},
          {name:"Planning Inspector Appeal (NPPF Para 11d)",prob:"Medium",desc:"If the council cannot demonstrate a 5-year housing land supply, Para 11d applies — the tilted balance. Appeal to the Planning Inspectorate."},
          {name:"Housing Need Exception Site",prob:"Low-Medium",desc:"Rural exception sites for affordable housing can unlock sites outside settlement boundaries. Mix affordable with open market."},
          {name:"Permitted Development / Change of Use",prob:"Low",desc:"Limited options outside settlement. Agricultural to residential PD rarely applies at scale."},
        ]
      },
      "Highways / Access":{
        risk:"Medium",timeframe:"6-18 months",
        routes:[
          {name:"Revised Access Design",prob:"High",desc:"Engage highways consultant to redesign access. Visibility splays, ghost island junction or traffic calming may satisfy highways officer."},
          {name:"S278 Highways Agreement",prob:"High",desc:"Offer to fund highways improvements under S278. Councils rarely refuse if developer pays for the solution."},
          {name:"Transport Assessment",prob:"High",desc:"Commission a full transport assessment to demonstrate impact is manageable. Modal shift and travel plan can offset concerns."},
        ]
      },
      "Design / Density too high":{
        risk:"Low-Medium",timeframe:"3-9 months",
        routes:[
          {name:"Revised Scheme — Lower Density",prob:"High",desc:"Reduce units by 10-20%, improve design quality, increase open space. Most design objections can be overcome with a revised pre-app."},
          {name:"Design Review Panel",prob:"Medium",desc:"Voluntarily submit to Design Review Panel before resubmission. Independent panel endorsement carries weight with planning officer."},
          {name:"Design Code Compliance",prob:"High",desc:"Demonstrate compliance with National Design Guide and local design code. Character appraisal showing scheme fits the area."},
        ]
      },
      "Environmental / Flood Risk":{
        risk:"Medium-High",timeframe:"12-24 months",
        routes:[
          {name:"Flood Risk Sequential Test",prob:"Medium",desc:"Demonstrate no reasonably available alternative sites. SFRA (Strategic Flood Risk Assessment) to assess actual risk. Raised ground floor levels."},
          {name:"Biodiversity Net Gain — Enhanced",prob:"Medium",desc:"Offer significant BNG above 10% minimum. Habitat management plan, SUDS, wildlife corridors can overcome ecological objections."},
          {name:"Remediation Strategy",prob:"High",desc:"For contamination — Phase 2 investigation and remediation plan. Fixed-price remediation contract demonstrates deliverability to LPA."},
        ]
      },
      "Affordable Housing Viability":{
        risk:"Low",timeframe:"3-6 months",
        routes:[
          {name:"Viability Assessment (RICS)",prob:"High",desc:"Commission independent RICS viability assessment demonstrating AH requirement makes scheme unviable. LPAs almost always accept a reduced AH% with proper evidence."},
          {name:"Phased Delivery",prob:"High",desc:"Offer AH in later phases once early market sales establish values. Reduces upfront viability risk."},
          {name:"Alternative AH Tenures",prob:"Medium",desc:"Propose First Homes (30% discount) instead of social rent. Lower discount = better developer viability."},
        ]
      },
      "Principle — Not allocated":{
        risk:"High",timeframe:"24-48 months",
        routes:[
          {name:"Planning Inspector Appeal",prob:"Medium",desc:"If 5-year HLS cannot be demonstrated, appeal under NPPF Para 11d. Inspector may grant if benefits outweigh harms."},
          {name:"Local Plan Promotion",prob:"Medium",desc:"Submit representation to Local Plan Call for Sites. Long-term (3-5 years) but creates a properly allocated site."},
          {name:"Buy at Agricultural Value + Option",prob:"High",desc:"Acquire at agricultural value with option to purchase at agreed uplift when/if planning granted. Minimal capital outlay."},
          {name:"Pre-application Community Consultation",prob:"Medium",desc:"Build local community support before resubmission. Councillor and community backing can shift officer recommendation."},
        ]
      },
    };

    var refusalKey=r.refusalType||"Principle — Not allocated";
    var routes=REFUSAL_ROUTES[refusalKey]||REFUSAL_ROUTES["Principle — Not allocated"];

    return e("div",null,
      e("div",{style:{display:"flex",alignItems:"center",gap:12,marginBottom:4}},
        e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A"}},"Planning Recovery Journey"),
        e("div",{style:{padding:"4px 12px",background:"rgba(176,90,53,0.1)",border:"1px solid #B05A35",borderRadius:20,fontSize:10,fontWeight:700,color:"#B05A35"}},"Refused PIP")
      ),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:20}},"Land with a refused planning in principle — strategies to get consent and proceed to exit"),

      // ── WHY IT WAS REFUSED ──────────────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #B05A35"})},
        e("div",{style:S.cardTitle},"Step 1 — Refusal Analysis"),
        e("div",{style:S.grid2},
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Main Reason for Refusal"),
            e("select",{value:r.refusalType||"",onChange:function(ev){up("recovery","refusalType",ev.target.value);},style:S.select},
              e("option",{value:""},"Select reason..."),
              Object.keys(REFUSAL_ROUTES).map(function(k){return e("option",{key:k,value:k},k);})
            )
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Refused Planning Reference"),
            e("input",{type:"text",value:r.planRef||"",onChange:function(ev){up("recovery","planRef",ev.target.value);},placeholder:"e.g. 23/01234/FUL",style:S.input})
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4,gridColumn:"span 2"}},
            e("label",{style:S.label},"Refusal Reasons (paste from decision notice)"),
            e("textarea",{value:r.refusalReason||"",onChange:function(ev){up("recovery","refusalReason",ev.target.value);},placeholder:"Paste the exact refusal reasons from the planning decision notice. The AI will analyse these and recommend the best route forward.",style:Object.assign({},S.input,{height:100,resize:"vertical"})})
          )
        )
      ),

      // ── KNOCKDOWN PRICE CALCULATOR ───────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #9A7B3E"})},
        e("div",{style:S.cardTitle},"Step 2 — Acquisition at Knockdown Price"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14}},"Land with refused planning sells at a discount to consented land. This is where the opportunity lies — buy at below market, secure planning, sell at uplift."),
        e("div",{style:S.grid2},
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Asking / Knockdown Price (£)"),
            e("input",{type:"number",value:r.knockdownPrice||l.price||"",onChange:function(ev){up("recovery","knockdownPrice",ev.target.value);},placeholder:"e.g. 250000",style:S.input})
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Estimated Consented Value (£)"),
            e("input",{type:"number",value:r.marketValue||"",onChange:function(ev){up("recovery","marketValue",ev.target.value);},placeholder:"Value once planning granted",style:S.input})
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Planning Recovery Budget (£)"),
            e("input",{type:"number",value:r.recoveryBudget||"",onChange:function(ev){up("recovery","recoveryBudget",ev.target.value);},placeholder:"e.g. 50000 (consultants, appeal)",style:S.input})
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Acquisition Strategy"),
            e("select",{value:r.acquisitionType||"",onChange:function(ev){up("recovery","acquisitionType",ev.target.value);},style:S.select},
              e("option",{value:""},"Select..."),
              e("option",{value:"conditional",label:"Conditional — subject to planning"},"Conditional — subject to planning"),
              e("option",{value:"unconditional",label:"Unconditional — buy now, risk planning later"},"Unconditional — buy now"),
              e("option",{value:"option",label:"Option Agreement — control without buying"},"Option Agreement"),
              e("option",{value:"promotion",label:"Promotion Agreement — agent promotes at no upfront cost"},"Promotion Agreement")
            )
          )
        ),
        knockdownPrice>0&&e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:12}},
          [
            {l:"Knockdown Price",v:fmt(knockdownPrice),c:"#B05A35"},
            {l:"Consented Value",v:marketValue>0?fmt(marketValue):"Enter above",c:"#2D7A65"},
            {l:"Discount to Market",v:discount>0?discount+"%":"—",c:"#9A7B3E"},
            {l:"Potential Uplift",v:marketValue>0?fmt(marketValue-knockdownPrice-num(r.recoveryBudget||0)):"—",c:"#2D7A65"},
          ].map(function(item){
            return e("div",{key:item.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid "+item.c,borderRadius:8,padding:12,textAlign:"center"}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:4}},item.l),
              e("div",{style:{fontSize:18,fontWeight:800,color:item.c}},item.v)
            );
          })
        )
      ),

      // ── RECOVERY ROUTES ──────────────────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #4A4BAE"})},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
          e("div",{style:S.cardTitle},"Step 3 — Recovery Routes"),
          e("div",{style:{fontSize:11,color:"#7278A0"}},"Risk: "+routes.risk+" · Timeline: "+routes.timeframe)
        ),
        e("div",{style:{display:"flex",flexDirection:"column",gap:10}},
          routes.routes.map(function(route,i){
            var probColor=route.prob.indexOf("High")>=0?"#2D7A65":route.prob.indexOf("Medium")>=0?"#9A7B3E":"#B05A35";
            return e("div",{key:i,style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:16}},
              e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:8}},
                e("div",{style:{width:24,height:24,borderRadius:"50%",background:"#4A4BAE",color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},i+1),
                e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A",flex:1}},route.name),
                e("div",{style:{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:12,background:probColor+"15",color:probColor}},"Success: "+route.prob)
              ),
              e("div",{style:{fontSize:12,color:"#7278A0",lineHeight:1.7,paddingLeft:34}},route.desc)
            );
          })
        )
      ),

      // ── ACTION PLAN ──────────────────────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #2D7A65"})},
        e("div",{style:S.cardTitle},"Step 4 — Key Contacts & Actions"),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}},
          [
            {title:"Planning Consultant",desc:"Appoint specialist planning consultant to advise on appeal prospects and resubmission strategy. Get two opinions.",icon:"⬟"},
            {title:"Planning Barrister (if appeal)",desc:"For inspector appeals, a planning barrister to advise on grounds of appeal and present the case.",icon:"⚖"},
            {title:"Transport Consultant",desc:"If highways reason — appoint specialist to design a solution that satisfies the highways authority.",icon:"▲"},
            {title:"Viability Consultant (RICS)",desc:"For AH viability — RICS-accredited consultant to produce an independent viability assessment.",icon:"◉"},
            {title:"Local Ward Councillors",desc:"Meet with local councillors. If they support the scheme, officer recommendation is more likely to be positive.",icon:"◈"},
            {title:"Planning Inspectorate",desc:"For appeals — submit within 6 months of decision. Check appeal statistics for this LPA to gauge likelihood.",icon:"◆"},
          ].map(function(item){
            return e("div",{key:item.title,style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:7,padding:12}},
              e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A",marginBottom:4}},item.icon+" "+item.title),
              e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.5}},item.desc)
            );
          })
        ),
        e("div",{style:{background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.15)",borderRadius:8,padding:14,fontSize:11,color:"#3A3D6A",lineHeight:1.8}},
          e("strong",null,"Key Websites:"),e("br"),
          e("a",{href:"https://www.gov.uk/appeal-planning-decision",target:"_blank",style:{color:"#4A4BAE"}},"Planning Inspectorate — How to Appeal"),e("br"),
          e("a",{href:"https://www.gov.uk/appeal-planning-decision/appeal-inspectors-decision",target:"_blank",style:{color:"#4A4BAE"}},"Check LPA 5-Year Housing Land Supply"),e("br"),
          e("a",{href:"https://www.rtpi.org.uk/find-a-planner/",target:"_blank",style:{color:"#4A4BAE"}},"RTPI — Find a Planning Consultant"),e("br"),
          e("a",{href:"https://www.planningportal.co.uk/",target:"_blank",style:{color:"#4A4BAE"}},"Planning Portal — Check Application History")
        )
      ),

      // ── JOURNEY FORWARD ──────────────────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #9A7B3E"})},
        e("div",{style:S.cardTitle},"Step 5 — Once Planning Secured, Continue to Exit"),
        e("div",{style:{display:"flex",flexDirection:"column",gap:8}},
          [
            {icon:"▲",label:"Planning & Viability",desc:"Once recovery route identified — model the full planning strategy",id:"planning",c:"#4A4BAE"},
            {icon:"◉",label:"Financial Modelling",desc:"Model the deal including recovery costs and uplift on exit",id:"fin",c:"#2D7A65"},
            {icon:"◈",label:"Due Diligence",desc:"Enhanced DD — title, contamination, previous planning history",id:"dd",c:"#7B6CB0"},
            {icon:"⬡",label:"Risk Register",desc:"Planning risk must be rated red until consent secured",id:"risks",c:"#9A7B3E"},
            {icon:"◆",label:"Investment Exit",desc:"Sell with planning at uplift — or develop and sell",id:"exit",c:"#B05A35"},
          ].map(function(step){
            return e("div",{key:step.id,onClick:function(){navTo(step.id);},
              style:{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,cursor:"pointer"},
              onMouseOver:function(ev){ev.currentTarget.style.borderColor=step.c;},
              onMouseOut:function(ev){ev.currentTarget.style.borderColor="#DDE0ED";}
            },
              e("div",{style:{width:36,height:36,borderRadius:"50%",background:step.c+"15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}},step.icon),
              e("div",{style:{flex:1}},
                e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A"}},step.label),
                e("div",{style:{fontSize:11,color:"#7278A0"}},step.desc)
              ),
              e("div",{style:{color:step.c,fontWeight:700,fontSize:11}},"Open →")
            );
          })
        )
      ),

      // ── CASE LAW & PRECEDENTS ────────────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #7B6CB0"})},
        e("div",{style:S.cardTitle},"Relevant Case Law & Planning Precedents"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14}},"Key decisions that may support your recovery. Always verify with a planning barrister before relying on case law."),
        e("div",{style:{display:"flex",flexDirection:"column",gap:8}},
          [
            {case:"Tesco Stores v Dundee CC [2012] UKSC 13",principle:"Material considerations must be properly weighed. LPA cannot refuse solely on policy grounds if NPPF benefits outweigh harms.",relevance:"Appeals against refusals on policy grounds",court:"Supreme Court"},
            {case:"Suffolk Coastal DC v Hopkins Homes [2017] UKSC 37",principle:"Where 5-year HLS cannot be demonstrated, the tilted balance (NPPF Para 11d) applies — planning permission should be granted unless harms significantly outweigh benefits.",relevance:"Sites outside settlement boundaries — 5yr HLS",court:"Supreme Court"},
            {case:"Dartford BC v SSCLG [2017] EWCA Civ 141",principle:"Councils must demonstrate a robust 5-year housing land supply. Buffer requirements (5%, 10%, 20%) apply depending on delivery track record.",relevance:"Housing land supply challenges",court:"Court of Appeal"},
            {case:"St Modwen Developments v SSCLG [2017] EWCA Civ 1643",principle:"Viability evidence must be transparent and independently tested. Councils cannot simply reject viability assessments without proper counter-evidence.",relevance:"Affordable housing viability disputes",court:"Court of Appeal"},
            {case:"Wingrove v South Gloucestershire [2015]",principle:"Pre-application engagement cannot be used as a reason to refuse. Officers must assess the application as submitted.",relevance:"Where refusal cites insufficient pre-app",court:"Inspector"},
            {case:"City of Edinburgh Council v Secretary of State [2020]",principle:"Design quality arguments must be based on adopted design guidance. Subjective officer opinions without policy basis are challengeable.",relevance:"Design and density refusals",court:"Court of Session"},
            {case:"R (Midcounties Co-op) v Wyre Forest DC [2009]",principle:"Planning conditions must be necessary, relevant, enforceable and reasonable. Overly onerous conditions can be appealed.",relevance:"Unreasonable planning conditions",court:"High Court"},
            {case:"Shirley Properties v SSCLG [2016]",principle:"Inspectors must give clear and intelligible reasons for dismissing appeals. Inadequate reasoning is grounds for judicial review.",relevance:"Appeal dismissed without clear reasons",court:"Court of Appeal"},
          ].map(function(cl){
            return e("div",{key:cl.case,style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:14}},
              e("div",{style:{display:"flex",alignItems:"flex-start",gap:10,marginBottom:6}},
                e("div",{style:{background:"#7B6CB0",color:"#fff",fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:4,flexShrink:0,marginTop:2}},cl.court),
                e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A"}},cl.case)
              ),
              e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:6}},e("strong",null,"Principle: "),cl.principle),
              e("div",{style:{fontSize:10,fontWeight:700,color:"#7B6CB0"}},"Relevant when: "+cl.relevance)
            );
          })
        ),
        e("div",{style:{marginTop:12,padding:"10px 14px",background:"rgba(123,108,176,0.06)",border:"1px solid rgba(123,108,176,0.2)",borderRadius:6,fontSize:11,color:"#5A4A8A"}},
          "⚠ Case law changes. Always instruct a planning barrister or solicitor to verify current position before relying on any precedent. Check ",
          e("a",{href:"https://www.bailii.org/",target:"_blank",style:{color:"#7B6CB0"}},"BAILII.org"),
          " for full judgments."
        )
      ),

      // ── LETTER & DOCUMENT TEMPLATES ──────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #2D7A65"})},
        e("div",{style:S.cardTitle},"Letter & Document Generator"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14}},"Generate professional letters and documents for your planning recovery. Powered by AI — review and adapt before sending."),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}},
          [
            {id:"pre_app",label:"Pre-Application Meeting Request",icon:"📋",
             desc:"Letter to LPA requesting pre-application meeting to discuss recovery strategy before resubmission."},
            {id:"appeal_grounds",label:"Grounds of Appeal — Draft",icon:"⚖",
             desc:"Draft grounds for appeal to the Planning Inspectorate. Covers NPPF compliance, 5-yr HLS and tilted balance."},
            {id:"councillor",label:"Ward Councillor Engagement Letter",icon:"🏛",
             desc:"Letter to ward councillors setting out the scheme benefits and requesting support at planning committee."},
            {id:"viability",label:"Viability Challenge Letter",icon:"💷",
             desc:"Letter to LPA challenging their AH requirement on viability grounds, citing S106 Planning Obligations guidance."},
            {id:"community",label:"Community Consultation Letter",icon:"👥",
             desc:"Letter to neighbours and community explaining the scheme and inviting feedback before resubmission."},
            {id:"lpa_challenge",label:"Challenge LPA 5yr HLS Letter",icon:"📊",
             desc:"Formal letter to LPA challenging their 5-year housing land supply position with NPPF Para 11d argument."},
          ].map(function(tmpl){
            return e("div",{key:tmpl.id,
              onClick:function(){up("recovery","selectedTemplate",tmpl.id);up("recovery","generatedLetter","");},
              style:{background:(r.selectedTemplate===tmpl.id)?"rgba(45,122,101,0.08)":"#fff",border:"1px solid "+((r.selectedTemplate===tmpl.id)?"#2D7A65":"#DDE0ED"),borderRadius:8,padding:14,cursor:"pointer",transition:"all .15s"},
              onMouseOver:function(ev){ev.currentTarget.style.borderColor="#2D7A65";},
              onMouseOut:function(ev){if(r.selectedTemplate!==tmpl.id)ev.currentTarget.style.borderColor="#DDE0ED";}
            },
              e("div",{style:{fontSize:16,marginBottom:6}},tmpl.icon),
              e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A",marginBottom:4}},tmpl.label),
              e("div",{style:{fontSize:10,color:"#7278A0",lineHeight:1.5}},tmpl.desc)
            );
          })
        ),

        r.selectedTemplate&&e("div",null,
          e("div",{style:{background:"rgba(45,122,101,0.06)",border:"1px solid rgba(45,122,101,0.2)",borderRadius:8,padding:"12px 16px",marginBottom:10,fontSize:11,color:"#2D7A65",fontWeight:600}},
            "Selected: "+{
              pre_app:"Pre-Application Meeting Request",appeal_grounds:"Grounds of Appeal",
              councillor:"Ward Councillor Letter",viability:"Viability Challenge",
              community:"Community Consultation",lpa_challenge:"5yr HLS Challenge"
            }[r.selectedTemplate]+" — click Generate to create"
          ),
          e("button",{
            disabled:r.letterLoading,
            onClick:function(){
              up("recovery","letterLoading",true);up("recovery","generatedLetter","");
              var templatePrompts={
                pre_app:"Write a professional letter from a property developer to the Local Planning Authority ("+lpa+") requesting a pre-application meeting. The developer has land at "+(l.address||"the above site")+", "+(acres||"?")+" acres in "+(lCity||"the area")+". Planning was previously refused for reason: "+refusalKey+". The letter should: explain who we are, reference the refusal, say we want to discuss a revised scheme, request a meeting, mention we will prepare a pre-app pack. Professional tone, formal letter format with [DATE], [OUR ADDRESS] and [LPA ADDRESS] placeholders.",
                appeal_grounds:"Draft grounds of appeal to the Planning Inspectorate for land at "+(l.address||"the site")+". Refusal reason: "+refusalKey+". Refusal details: "+(refusalReason||"not provided")+". LPA: "+(lpa||"unknown")+". Draft professional grounds covering: 1) The policy position and NPPF compliance, 2) Whether the LPA can demonstrate a 5-year housing land supply, 3) The tilted balance under NPPF Para 11d if applicable, 4) Why the benefits of the scheme outweigh the harms identified in the refusal, 5) Any relevant case law. Professional legal tone. Use [APPELLANT NAME], [DATE] placeholders.",
                councillor:"Write a professional letter from a property developer to the ward councillors for "+(l.address||"the site area")+". The developer wants to build "+(data.planning&&data.planning.units||"residential units")+" on land at "+(l.address||"the site")+". Planning was refused for: "+refusalKey+". Letter should: introduce the developer, explain the scheme benefits (housing delivery, local jobs, S106 contributions), address the refusal reason constructively, request a meeting to discuss. Professional but accessible tone.",
                viability:"Write a formal letter from a property developer to the Local Planning Authority ("+lpa+") challenging the affordable housing requirement on viability grounds. Site: "+(l.address||"the site")+". Cite: 1) NPPF Para 57-58 on viability, 2) PPG on Viability (2019), 3) The Three Dragons / RICS Professional Statement on Viability, 4) That we are commissioning an independent RICS viability assessment, 5) Request that the LPA provide their own assessment if they dispute our findings. Professional legal tone.",
                community:"Write a community consultation letter from a property developer to neighbours and local residents about a proposed development at "+(l.address||"the site")+". The scheme will deliver "+(data.planning&&data.planning.units||"new homes")+". Letter should: introduce who we are, explain what we want to build, acknowledge previous refusal and how we've responded, highlight benefits (new homes, landscaping, S106 improvements), invite comments, provide contact details [EMAIL] [PHONE]. Friendly, accessible tone.",
                lpa_challenge:"Write a formal letter from a property developer to the Local Planning Authority ("+lpa+") formally challenging their 5-year housing land supply position and invoking NPPF Para 11d (the tilted balance). Letter should: 1) Request the council's latest 5-year HLS position statement, 2) Reference the Housing Delivery Test results, 3) Cite Suffolk Coastal DC v Hopkins Homes [2017] UKSC 37, 4) Argue that where 5yr HLS cannot be demonstrated, Para 11d applies and the tilted balance favours granting permission, 5) Request that the council confirm their HLS position before we lodge an appeal. Professional legal tone."
              };
              var prompt=templatePrompts[r.selectedTemplate]||"Generate the letter.";
              var params=new URLSearchParams({
                action:"ai",stage:"Letter Generator",
                user:(user&&user.name)||"",company:(user&&user.company)||"",
                system:"You are a senior UK planning solicitor and barrister. Generate professional, legally sound letters and documents. Use formal UK letter format. Plain text only.",
                prompt:prompt.substring(0,3000)
              });
              fetch(WEBHOOK+"?"+params.toString())
              .then(function(res){return res.json();})
              .then(function(d2){
                up("recovery","generatedLetter",d2.result||"Generation failed");
                up("recovery","letterLoading",false);
                logEvent(user,"LETTER_GEN",{template:r.selectedTemplate});
              })
              .catch(function(){
                up("recovery","generatedLetter","Connection failed — please try again");
                up("recovery","letterLoading",false);
              });
            },
            style:{padding:"10px 24px",background:r.letterLoading?"#8889C8":"#2D7A65",border:"none",borderRadius:7,color:"#fff",fontSize:13,fontWeight:700,cursor:r.letterLoading?"not-allowed":"pointer",fontFamily:"DM Sans,sans-serif",marginBottom:10}
          },r.letterLoading?"⏳ Generating Letter...":"📄 Generate Letter"),

          r.generatedLetter&&e("div",null,
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}},
              e("div",{style:{fontSize:11,fontWeight:700,color:"#2D7A65"}},"Generated Letter — Review and adapt before sending"),
              e("button",{
                onClick:function(){
                  var el=document.createElement("textarea");
                  el.value=r.generatedLetter;
                  document.body.appendChild(el);
                  el.select();
                  document.execCommand("copy");
                  document.body.removeChild(el);
                  alert("✓ Copied to clipboard");
                },
                style:{padding:"5px 12px",background:"#F7F8FC",border:"1px solid #DDE0ED",color:"#7278A0",borderRadius:5,fontSize:11,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"📋 Copy to Clipboard")
            ),
            e("div",{style:{background:"#FAFDF9",border:"1px solid #C8E0D0",borderRadius:8,overflow:"hidden"}},
              e("div",{style:{maxHeight:500,overflowY:"auto",padding:"20px 24px"}},
                e("pre",{style:{fontSize:12,lineHeight:2.0,color:"#2E2F8A",whiteSpace:"pre-wrap",fontFamily:"Georgia, serif",margin:0}},
                  r.generatedLetter
                )
              )
            ),
            e("div",{style:{fontSize:10,color:"#7278A0",fontStyle:"italic",marginTop:8}},
              "⚠ AI-generated draft — always review with a qualified planning consultant or solicitor before sending. Replace all [PLACEHOLDER] fields with actual details."
            )
          )
        )
      ),

      e(AIPanel,{user:user,up:up,stage:"recovery",data:data,persistKey:"recovery_ai__full_planning_re",label:"AI: Full Planning Recovery Strategy",
        prompt:buildHonestPrompt(data,"I have land at "+(l.address||"unknown address")+", "+(l.city||"")+", "+(acres||"?")+" acres. It received a refused planning in principle. Refusal reason type: "+refusalKey+". Refusal details: "+(refusalReason||"not provided")+". Knockdown acquisition price: "+fmt(knockdownPrice)+". LPA: "+(lpa||"unknown")+". Provide: 1) Assessment of the refusal and whether it is fundamentally fatal or recoverable, 2) Best recovery route ranked by probability of success, 3) Specific actions to take in the next 30 days, 4) Whether to appeal (and the grounds) or resubmit (and what changes to make), 5) Realistic timeline to secure consent, 6) Whether the knockdown price justifies the planning risk, 7) Exit strategy once planning is secured.")})
    );
  }
