// ── renderIM  (params: at, city, data, gdv, lc, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderIM(at, city, data, gdv, lc, up, user){
    var l=data.land||{}; var p=data.planning||{}; var f=data.fin||{};
    var rlvD=data.rlv||{}; var ap=data.viability&&data.viability.appraisal||{};
    var risks=data.risks||{}; var cc=data.constraint||{}; var mon=data.monitor||{};
    var ten=data.tenure||{}; var ex=data.exit||{};
    var addr=l.address||"Development Site";
    var cityDisp=cityName(city||l.city||"");
    var planStatus=p.status||l.planningStatus||"Unallocated";
    var lpa=p.lpa||l.localAuthority||"";
    var ask=num(l.price||0);

    // v10.78 — drive the IM off the ONE canonical engine so its figures match the rest of the
    // tool (the old IM read data.rlv.rlv / data.fin.marginPct, which are usually blank).
    var SF=(typeof computeSFHMetrics==="function")?computeSFHMetrics(data):{};
    var Mim=(typeof calcDealMetrics==="function")?calcDealMetrics(data):{};
    var units2=num(SF.totalUnits)||num(p.units||rlvD.units||0);
    var gdvE=num(SF.gdv)||num(gdv)||0;
    var devE=num(SF.devCost)||0;
    var profitE=num(SF.profit)||0;
    var rlvE=num(SF.rlv)||num(Mim.rlv)||num(rlvD.rlv||lc)||0;
    var marginE=gdvE>0?profitE/gdvE*100:0;
    var profitOnCostE=(devE+rlvE)>0?profitE/(devE+rlvE)*100:0;
    var ahPctE=num(SF.ahPctResolved)||num(p.ahPct||p.afhPct||ten.ahPct||0);
    var progYrsE=num(SF.financeProgYears)||num(f.programmeMths)/12||0;
    var peakDebtE=num(SF.financePeakDebtPct)||0;
    var netRentE=num(SF.capNetRentPa)||0;
    var yldE=(typeof dealYield==="function")?dealYield(data):4.9; if(yldE>0&&yldE<1) yldE*=100; yldE=Math.max(4.5,Math.min(6,yldE||4.9));
    var ffValueE=netRentE>0?netRentE/(yldE/100):0;
    var dealTypeE={forward_fund:"forward-funding",forward_sale:"forward sale",bulk_sale_ha:"bulk sale to a housing association",plot_sales:"open-market plot sales",stabilised:"build, stabilise and sell as an investment",retain:"build to rent and hold",phased:"phased delivery"}[ex.strategy]||"institutional forward-funding";

    // Research-spec section order: what a UK investment committee reads and interrogates.
    var sections=[
      {id:"exec",l:"1. Executive Summary & Investment Case",key:"im_exec"},
      {id:"opportunity",l:"2. The Opportunity & Business Plan",key:"im_opportunity"},
      {id:"site",l:"3. Site & Location",key:"im_site"},
      {id:"planning",l:"4. Planning Position & Risk",key:"im_planning"},
      {id:"appraisal",l:"5. Financial Appraisal",key:"im_appraisal"},
      {id:"deal",l:"6. Deal Structure & Economics",key:"im_deal"},
      {id:"delivery",l:"7. Deliverability — Programme, Procurement & Team",key:"im_delivery"},
      {id:"market",l:"8. Market Evidence",key:"im_market"},
      {id:"tenure",l:"9. Tenure, Affordable Mix & Grant",key:"im_tenure"},
      {id:"esg",l:"10. ESG & Sustainability",key:"im_esg"},
      {id:"legal",l:"11. Legal Structure & Security",key:"im_legal"},
      {id:"risk",l:"12. Risk Register & Mitigants",key:"im_risk"},
      {id:"team",l:"13. Team & Next Steps",key:"im_team"},
    ];

    function generateSection(sec){
      var allocTxt = (typeof exitAllocationText==="function") ? exitAllocationText(data) : "";
      var allocNote = allocTxt ? (" Planned mixed exit (honour this allocation, do not assume a single buyer): " + allocTxt + ".") : "";
      var figs="GDV "+fmt(gdvE)+", total development cost (excl. land) "+fmt(devE)+", developer profit "+fmt(profitE)+" ("+pct(marginE)+" on GDV, "+pct(profitOnCostE)+" on cost), residual land value "+fmt(rlvE)+", "+units2+" homes"+(ahPctE>0?", "+Math.round(ahPctE)+"% affordable":"")+(netRentE>0?", forward-fund value "+fmt(ffValueE)+" at "+yldE.toFixed(2)+"% net initial yield":"")+".";
      var prompts={
        exec:"Write the Executive Summary & Investment Case (170 words) for a UK institutional investor memorandum. The ask: "+dealTypeE+" of a "+units2+"-home residential scheme at "+addr+", "+cityDisp+". Figures: "+figs+" Programme ~"+(progYrsE||"TBC")+" years."+allocNote+" Lead with the ask and deal type, then headline returns (profit on GDV and on cost, and the forward-fund/investment value), the three-line thesis (what/where/why now), the single balancing/exit event that crystallises return, and 2-3 key risks each with a one-line mitigant. Close with a clear recommendation. Numerate, senior IC tone, no marketing clichés.",
        opportunity:"Write The Opportunity & Business Plan (160 words). A "+units2+"-home residential development ("+(at||"SFH/for-sale")+") at "+addr+", "+cityDisp+", structured for "+dealTypeE+". Cover: scheme description and unit mix, target purchaser/occupier and (if rented) the operational model, the site's control/tenure status, and the business-plan horizon (build → let/sell → stabilise → exit). Keep it concrete.",
        site:"Write the Site & Location section (150 words): physical characteristics ("+num(l.acres)+" acres, "+planStatus+"), location context in "+cityDisp+", transport links, proximity to employment/schools/retail, land tenure (freehold/leasehold), and any notable features or constraints. Address: "+addr+". LPA: "+lpa+".",
        planning:"Write the Planning Position & Risk section (170 words). Status: "+planStatus+"; LPA: "+lpa+"; affordable requirement "+(ahPctE||"TBC")+"%; S106 estimate "+fmt(num(p.s106||SF.s106||0))+"; constraint verdict "+(cc.verdict||(data.constraintCheck&&data.constraintCheck.results&&data.constraintCheck.results.verdict)||"not assessed")+"; probability of consent "+(num(p.planningProb)||"TBC")+"%. Set it against the LPA's 5-year housing land supply / Housing Delivery Test position under the December 2024 NPPF. Explicitly address mandatory 10% Biodiversity Net Gain (30-year maintenance) and, where any block is a Higher-Risk Building (≥18m/7 storeys), Building Safety Act Gateway 2. State the route to consent, conditions/RM to discharge, and the key planning risks with mitigants.",
        appraisal:"Write the Financial Appraisal section (190 words). Figures from the engine: "+figs+" Build £"+(Math.round(num(SF.buildPsf))||"TBC")+"/sqft on a BCIS-referenced basis; contingency and professional fees included; finance on an S-curve, ~"+(progYrsE||"TBC")+"-year programme, peak debt ~"+(peakDebtE||"TBC")+"% of cost."+allocNote+" Build up GDV from the mix, then the cost stack, then residual land value and developer profit/margin. Benchmark the margin (17.5% on GDV is the viability floor; volume housebuilders target 20%+/~22-25% on cost) and defend it. Note that a full sensitivity table (GDV ±10%, build ±10%, exit yield ±50bps) and the monthly cashflow/peak-equity profile follow. Honest, numerate.",
        deal:"Write the Deal Structure & Economics section (170 words) for "+dealTypeE+". Explain the mechanics to the investor: for a forward fund — the investor acquires the land, funds construction in QS-certified stages, earns a coupon/licence fee on drawn amounts during the build, and takes the completed scheme at an agreed net initial yield ("+yldE.toFixed(2)+"%) with SDLT on the land value only; the balancing (‘end bullet’) payment covering developer profit at PC. Cover the developer's development-management fee and profit share/hurdle, any rent guarantee/income support during lease-up, cost-overrun mechanics and cap on investor exposure. Note forward-commit and JV/co-invest as alternatives. Precise, deal-lawyer-aware.",
        delivery:"Write the Deliverability — Programme, Procurement & Team section (170 words). ~"+(progYrsE||"TBC")+"-year programme with start-on-site, PC and key milestones; procurement via a fixed-price JCT Design & Build contract (state degree of design completion); contractor covenant and security — performance bond and/or parent-company guarantee, retention, liquidated damages, and collateral warranties / step-in rights to the funder from the contractor and key consultants. Build cost on a BCIS-benchmarked QS cost plan. Reference Cassidy Group's track record on comparable schemes and developer equity/skin-in-the-game. Flag Building Safety Act Gateway 2 timing where relevant.",
        market:"Write the Market Evidence section (160 words) for the "+cityDisp+" residential market. Cover: demand drivers; sales/rental comparables underpinning the GDV and any ERV (recent, local, verifiable); absorption/sales-rate or BTR/SFH lease-up and stabilised occupancy assumptions; and exit demand — the institutional bid for BTR/SFH and prevailing net initial yields in this region. Micro-location: transport, schools, employment, competing pipeline. Scheme type: "+(at||"residential")+". Draw on UK market knowledge for "+cityDisp+".",
        tenure:"Write the Tenure, Affordable Mix & Grant section (140 words). Affordable requirement "+(ahPctE||"TBC")+"% (S106). Set out the tenure split (private / affordable rent / social rent / shared ownership / First Homes) and how affordable is delivered — on-site S106 and/or grant. Cover Homes England grant eligibility (AHP 2021-26 transitioning to the Social & Affordable Homes Programme 2026-2036, ≥60% Social Rent target; note SAHP cannot fund S106 affordable acquisitions) and any Registered Provider offtake.",
        esg:"Write the ESG & Sustainability section (140 words). Cover: target EPC ratings (new-build A/B) and the MEES trajectory (residential lettings need EPC C by 2030); Future Homes Standard compliance (rollout Q1 2026 — ~75-80% CO2 reduction vs current Part L, no new gas connections, heat pumps/low-carbon heating, fabric/airtightness); Biodiversity Net Gain ecological uplift; embodied carbon, water efficiency, EV charging, and flood/climate resilience. State where compliance cost sits in the appraisal.",
        legal:"Write the Legal Structure & Security section (150 words). Cover: an SPV/newco to ring-fence the asset with clean isolated title and financials; the security package (legal charge over the site, debenture, share charge, deed of priority/intercreditor with any senior lender, guarantees); step-in rights to replace contractor/manager without collapsing the structure; drawdown mechanics (conditions precedent, monitoring-surveyor certification, cost-to-complete tests); and — for a JV — governance, reserved matters, the promote/waterfall, and exit/sale mechanics with valuation dispute resolution and longstop dates.",
        risk:"Write the Risk Register & Mitigants section (170 words) as a structured register. For each risk give likelihood, impact and mitigant, covering at minimum: planning refusal/delay (status "+planStatus+"), Building Safety Act Gateway 2 delay, build-cost overrun, contractor insolvency, programme slippage, sales/lease-up shortfall, exit-yield softening, interest-rate/inflation, BNG/nutrient deliverability, ground/abnormals, and funding shortfall. Present it clearly and honestly — margin is "+pct(marginE)+" on GDV.",
        team:"Write the Team & Next Steps section (130 words) for Cassidy Group. Cover Cassidy's track record in UK residential development and delivery on comparable schemes, the proposed transaction structure and heads-of-terms requirements, the data-room contents available on NDA, and a clear timetable. Close with the key ask (the "+dealTypeE+" commitment sought) and a contact instruction.",
      };
      up("im","loading_"+sec.id,true);
      var params=new URLSearchParams({action:"ai",stage:"im",
        user:(user&&user.name)||"",company:(user&&user.company)||"",
        system:"You are a senior UK property investment director writing a formal investor memorandum section. Use professional language, be specific with numbers, avoid marketing clichés.",
        prompt:prompts[sec.id]||"Write a professional "+sec.l+" section for a UK residential development investor memorandum."
      });
      fetch(WEBHOOK+"?"+params.toString())
      .then(function(r2){return r2.json();})
      .then(function(d){
        up("im",sec.key,d.result||"Generation failed");
        up("im","loading_"+sec.id,false);
      })
      .catch(function(){up("im","loading_"+sec.id,false);});
    }

    function generateAllSections(){
      sections.forEach(function(sec,i){
        setTimeout(function(){generateSection(sec);},i*800);
      });
    }

    // v10.78 — deterministic financial appendix (engine figures, sensitivity grid, forward-fund
    // table, data-room index) so the printed IM carries hard numbers even before the AI narrative
    // sections are generated.
    function imAppendixHTML(){
      var bC=num(SF.buildCost), fE=num(SF.fees), cE=num(SF.contingency), fnE=num(SF.finance);
      var s1=num(SF.s106), rd=num(SF.roads), inf=num(SF.infra), mk=num(SF.marketing);
      function trow(k,v,strong){ return '<tr'+(strong?' style="font-weight:800;color:#1E1F5C;border-top:1.5px solid #C9CCE4"':'')+'><td style="padding:4px 0;border-bottom:1px solid #EEF0F7">'+k+'</td><td style="padding:4px 0;border-bottom:1px solid #EEF0F7;text-align:right">'+v+'</td></tr>'; }
      var fin='<h2>Financial Summary (engine)</h2><table style="width:100%;border-collapse:collapse;font-size:12px">'+
        trow("Gross development value",fmt(gdvE))+
        trow("Build"+(num(SF.avgSqft)&&units2?" ("+Math.round(num(SF.avgSqft)*units2).toLocaleString()+" sqft @ £"+Math.round(num(SF.buildPsf))+")":""),"−"+fmt(bC))+
        (fE>0?trow("Professional fees","−"+fmt(fE)):'')+
        (cE>0?trow("Contingency","−"+fmt(cE)):'')+
        trow("Finance"+(progYrsE?" ("+progYrsE+"yr · peak "+peakDebtE+"% · S-curve)":""),"−"+fmt(fnE))+
        trow("S106 / CIL","−"+fmt(s1))+
        ((rd+inf)>0?trow("Infrastructure / roads","−"+fmt(rd+inf)):'')+
        (mk>0?trow("Marketing / disposal","−"+fmt(mk)):'')+
        trow("Developer profit ("+Math.round(marginE)+"% on GDV · "+Math.round(profitOnCostE)+"% on cost)","−"+fmt(profitE))+
        trow("Residual land value",(rlvE<0?"−":"")+fmt(Math.abs(rlvE)),true)+
        '</table>';
      // Dual sensitivity: developer margin (%) under GDV × build-cost stress, land held at RLV.
      function marginAt(gMult,bDelta){ var g=gdvE*gMult, d=devE+bC*bDelta; var pr=g-d-rlvE; return g>0?pr/g*100:0; }
      var gRows=[["GDV −10%",0.9],["GDV base",1.0],["GDV +10%",1.1]];
      var bCols=[["Build +10%",0.10],["Build base",0],["Build −10%",-0.10]];
      var sens='<h2>Sensitivity — developer margin under stress</h2>'+
        '<p style="font-size:11px;color:#6A6F97">Margin on GDV with the land held at the residual value; the classic downside test an IC asks for (GDV down while build cost up).</p>'+
        '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr><td></td>'+bCols.map(function(c){return '<td style="text-align:right;font-weight:700;color:#7278A0;padding:4px 0">'+c[0]+'</td>';}).join('')+'</tr>'+
        gRows.map(function(gr){ return '<tr><td style="font-weight:700;color:#7278A0;padding:4px 0">'+gr[0]+'</td>'+bCols.map(function(c){ var m=marginAt(gr[1],c[1]); return '<td style="text-align:right;padding:4px 0;font-weight:700;color:'+(m>=15?"#1B7A54":m>=10?"#9A7B3E":"#B05A35")+'">'+pct(m)+'</td>'; }).join('')+'</tr>'; }).join('')+
        '</table>';
      var ff=netRentE>0?('<h2>Forward-Fund Value by Yield</h2><p style="font-size:11px;color:#6A6F97">Completed scheme let &amp; sold as an investment (net rent '+fmt(netRentE)+'/yr after ~25% management).</p>'+
        '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr><td style="font-weight:700;color:#7278A0;padding:4px 0">Net initial yield</td>'+[4.5,5.0,5.5,6.0].map(function(y){return '<td style="text-align:right;font-weight:700;color:#7278A0;padding:4px 0">'+y.toFixed(1)+'%</td>';}).join('')+'</tr>'+
        '<tr><td style="padding:4px 0">Investment value</td>'+[4.5,5.0,5.5,6.0].map(function(y){var v=netRentE/(y/100);return '<td style="text-align:right;padding:4px 0;font-weight:700;color:'+(Math.abs(y-yldE)<0.05?"#1B7A54":"#1E1F5C")+'">'+fmt(v)+'</td>';}).join('')+'</tr></table>'):'';
      var dr='<h2>Data Room — Index</h2><p style="font-size:11px;color:#6A6F97">Available to a counterparty on execution of a mutual NDA.</p>'+
        '<div style="columns:2;font-size:11.5px;color:#3A3D6A;line-height:1.9">'+
        ["Title, plans &amp; searches","Planning decision, conditions &amp; S106","Appraisal model (live) &amp; cashflow","QS cost plan (BCIS basis)","Programme / Gantt","Ground, environmental &amp; flood reports","Biodiversity Net Gain metric &amp; plan","Energy / EPC / Future Homes strategy","Contractor tender &amp; draft building contract","Valuation &amp; insurance","Team CVs &amp; track record","SPV / heads of terms"].map(function(x){return '<div>☐ '+x+'</div>';}).join('')+'</div>';
      return fin+sens+ff+dr;
    }
    function printIM(){
      var imData=data.im||{};
      var html='<!DOCTYPE html><html><head><meta charset="UTF-8">'+
        '<style>@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap");'+
        'body{font-family:"DM Sans",sans-serif;margin:0;padding:0;color:#1a1a2e;font-size:13px;line-height:1.75;}'+
        '.cover{background:linear-gradient(160deg,#1E1F5C,#2E2F8A);color:#fff;min-height:100vh;padding:60px;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;}'+
        '.cover-logo{font-size:20px;font-weight:800;letter-spacing:.2em;}'+
        '.cover-sub{font-size:9px;letter-spacing:.3em;opacity:.4;margin-top:3px;}'+
        '.cover-tag{font-size:9px;padding:4px 12px;border:1px solid rgba(255,255,255,.2);border-radius:20px;display:inline-block;letter-spacing:.08em;margin-bottom:40px;}'+
        '.cover-title{font-size:38px;font-weight:800;line-height:1.15;margin-bottom:12px;}'+
        '.cover-loc{font-size:16px;opacity:.65;margin-bottom:32px;}'+
        '.cover-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,.15);border-radius:8px;overflow:hidden;}'+
        '.cover-metric{padding:16px 20px;background:rgba(255,255,255,.08);}'+
        '.cm-label{font-size:9px;opacity:.5;text-transform:uppercase;letter-spacing:.12em;margin-bottom:4px;}'+
        '.cm-value{font-size:22px;font-weight:800;}'+
        '.cover-footer{font-size:10px;opacity:.4;margin-top:40px;}'+
        '.content{max-width:720px;margin:0 auto;padding:48px 60px;}'+
        'h2{font-size:18px;font-weight:800;color:#2E2F8A;margin:36px 0 8px;padding-top:12px;border-top:2px solid #E8E8F0;}'+
        'h2:first-child{margin-top:0;border-top:none;}'+
        'p{margin:0 0 14px;color:#3A3D6A;}'+
        '.metrics-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0;}'+
        '.mbox{background:#F7F8FC;border:1px solid #DDE0ED;border-radius:8px;padding:14px 16px;}'+
        '.mbox-label{font-size:9px;color:#7278A0;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px;}'+
        '.mbox-value{font-size:18px;font-weight:800;color:#2E2F8A;}'+
        '.footer-im{background:#F7F8FC;border-top:1px solid #DDE0ED;padding:14px 60px;font-size:9px;color:#7278A0;display:flex;justify-content:space-between;}'+
        '@media print{.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}'+
        '</style></head><body>'+
        '<div class="cover">'+
          ((typeof BRAND_LOGO_PNG!=="undefined"&&BRAND_LOGO_PNG&&typeof cassidyLogoSrc==="function")?'<div style="background:#fff;border-radius:8px;padding:7px 12px;display:inline-flex"><img src="'+cassidyLogoSrc()+'" alt="Cassidy Group Ltd" style="height:38px;width:auto;max-width:220px;display:block"/></div>':'<div><div class="cover-logo">CASSIDY</div><div class="cover-sub">GROUP</div></div>')+
          '<div>'+
            '<div class="cover-tag">INVESTOR MEMORANDUM — CONFIDENTIAL</div>'+
            '<div class="cover-title">'+addr+'</div>'+
            '<div class="cover-loc">'+cityDisp+(lpa?" · "+lpa:"")+'</div>'+
            '<div class="cover-metrics">'+
              '<div class="cover-metric"><div class="cm-label">GDV</div><div class="cm-value">'+fmt(gdvE)+'</div></div>'+
              '<div class="cover-metric"><div class="cm-label">Developer profit</div><div class="cm-value">'+fmt(profitE)+'</div></div>'+
              '<div class="cover-metric"><div class="cm-label">'+(ffValueE>0?"Fwd-fund value":"Residual land value")+'</div><div class="cm-value">'+fmt(ffValueE>0?ffValueE:rlvE)+'</div></div>'+
              '<div class="cover-metric"><div class="cm-label">Homes</div><div class="cm-value">'+units2+'</div></div>'+
            '</div>'+
          '</div>'+
          '<div class="cover-footer">Prepared by Cassidy Group · '+new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})+' · Confidential — not for distribution · Built by Phil Daniel / Landform Intelligence Platform</div>'+
        '</div>'+
        '<div class="content">'+
          '<div class="metrics-row">'+
            '<div class="mbox"><div class="mbox-label">Site area</div><div class="mbox-value">'+(l.acres||"—")+'ac</div></div>'+
            '<div class="mbox"><div class="mbox-label">Planning status</div><div class="mbox-value" style="font-size:13px">'+planStatus+'</div></div>'+
            '<div class="mbox"><div class="mbox-label">AH %</div><div class="mbox-value">'+(p.ahPct||"—")+"%</div></div>"+
          "</div>"+
          sections.map(function(sec){
            var txt=imData[sec.key]||"";
            if(!txt)return"";
            return"<h2>"+sec.l+"</h2><p>"+txt.replace(/\n\n/g,"</p><p>").replace(/\n/g," ")+"</p>";
          }).join("")+
          imAppendixHTML()+
        '</div>'+
        '<div class="footer-im"><span>'+addr+' · Cassidy Group Investor Memorandum</span><span>'+new Date().toLocaleDateString("en-GB")+'</span><span>Confidential</span></div>'+
        '</body></html>';
      var w=window.open("","_blank","width=900,height=700");
      if(!w){notify("Allow pop-ups to generate the IM");return;}
      w.document.write(html);w.document.close();
      setTimeout(function(){w.print();},600);
    }

    var imData=data.im||{};
    var completedSections=sections.filter(function(s){return imData[s.key]&&imData[s.key].length>20;}).length;

    return e("div",null,
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}},
        e("div",null,
          e("div",{style:{fontSize:11,color:"#7278A0",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:4}},"Investor Memorandum"),
          e("h2",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",margin:0}},addr||"Development Site"),
          e("div",{style:{fontSize:11,color:"#7278A0",marginTop:4}},completedSections+"/"+sections.length+" sections generated")
        ),
        e("div",{style:{display:"flex",gap:8}},
          e("button",{onClick:generateAllSections,style:{padding:"10px 18px",background:"linear-gradient(135deg,#2D7A65,#4A4BAE)",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🧠 Generate All Sections"),
          completedSections>0&&e("button",{onClick:printIM,style:{padding:"10px 18px",background:"#2E2F8A",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🖨 Print / PDF")
        )
      ),

      // Progress bar
      e("div",{style:{height:6,background:"#F0F1FA",borderRadius:3,marginBottom:16,overflow:"hidden"}},
        e("div",{style:{height:"100%",width:(completedSections/sections.length*100)+"%",background:"linear-gradient(90deg,#2D7A65,#4A4BAE)",borderRadius:3,transition:"width .4s"}})
      ),

      // Sections
      sections.map(function(sec){
        var txt=imData[sec.key]||"";
        var loading=imData["loading_"+sec.id];
        return e("div",{key:sec.id,style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,marginBottom:10,overflow:"hidden"}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:txt?"#F7F8FC":"#fff",borderBottom:txt?"1px solid #DDE0ED":"none",cursor:"pointer"},
            onClick:function(){up("im","open_"+sec.id,!imData["open_"+sec.id]);}},
            e("div",{style:{display:"flex",alignItems:"center",gap:10}},
              e("span",{style:{width:22,height:22,borderRadius:"50%",background:txt?"#2D7A65":"#DDE0ED",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:txt?"#fff":"#7278A0",flexShrink:0}},txt?"✓":"·"),
              e("span",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A"}},sec.l)
            ),
            e("div",{style:{display:"flex",gap:8}},
              e("button",{
                onClick:function(ev){ev.stopPropagation();generateSection(sec);},
                disabled:loading,
                style:{padding:"4px 12px",background:loading?"#8889C8":"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },loading?"Generating...":"Generate"),
              e("span",{style:{fontSize:12,color:"#7278A0"}},imData["open_"+sec.id]?"▲":"▼")
            )
          ),
          (txt&&imData["open_"+sec.id])&&e("div",{style:{padding:"16px 20px"}},
            e("textarea",{
              value:txt,
              onChange:function(ev){up("im",sec.key,ev.target.value);},
              style:{width:"100%",minHeight:120,padding:"10px 14px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:12,fontFamily:"DM Sans,sans-serif",color:"#3A3D6A",lineHeight:1.75,resize:"vertical"}
            })
          ),
          !txt&&!loading&&e("div",{style:{padding:"12px 16px",fontSize:11,color:"#7278A0",fontStyle:"italic"}},"Click Generate to create this section")
        );
      }),

      completedSections===0&&e("div",{style:{background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:8,padding:"16px 20px",marginTop:8,fontSize:11,color:"#4A4BAE",lineHeight:1.8}},
        "ℹ Complete Land Appraisal, RLV, Planning & Viability and Financial Modelling stages first for accurate IM figures. Then click Generate All Sections — all 7 sections are written simultaneously."
      )
    );
  }
