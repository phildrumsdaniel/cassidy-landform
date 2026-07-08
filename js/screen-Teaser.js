// ── renderTeaser  (params: city, data, gdv, lc, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderTeaser(city, data, gdv, lc, up, user){
    var l=data.land||{}; var p=data.planning||{}; var f=data.fin||{};
    var rlvD=data.rlv||{}; var s2=data.sfh||{}; var cc=data.constraint||{};
    var addr=l.address||data.scraper&&data.scraper.result&&data.scraper.result.address||"Development Site";
    var cityDisp=cityName(city||l.city||"");
    var planStatus=p.status||l.planningStatus||"Unallocated";
    // v10.5 — Assumption Mode: present as consented for stakeholder teasers.
    if(typeof assumePlanningConsented==="function" && assumePlanningConsented(data)) planStatus="Consented (assumed)";
    var units2=num(p.units||rlvD.units||0);
    var ask=num(l.price||0);
    var lpa=p.lpa||l.localAuthority||"";
    // v10.2 — read the REAL residual & margin from the one engine, not input fields the
    // engine never fills (data.rlv.rlv / data.fin.marginPct). Previously the teaser card
    // showed the ASKING PRICE as the RLV and a 0% margin — which must never go to an investor.
    var DMt=(typeof calcDealMetrics==="function")?calcDealMetrics(data):{};
    var teaserRlv=num(DMt.rlv);
    var teaserMargin=num(DMt.marginPct);

    function generateTeaser(){
      var html='<!DOCTYPE html><html><head><meta charset="UTF-8">'+
        '<style>@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap");'+
        'body{font-family:"DM Sans",sans-serif;margin:0;padding:0;background:#fff;color:#1a1a2e;}'+
        '.page{max-width:794px;margin:0 auto;padding:0;}'+
        '.header{background:linear-gradient(135deg,#1E1F5C,#2E2F8A);color:#fff;padding:40px 48px 32px;}'+
        '.logo-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;}'+
        '.logo-text{font-size:18px;font-weight:800;letter-spacing:.2em;}'+
        '.logo-sub{font-size:9px;letter-spacing:.3em;opacity:.5;margin-top:2px;}'+
        '.confidential{font-size:9px;padding:4px 10px;border:1px solid rgba(255,255,255,.3);border-radius:20px;letter-spacing:.08em;}'+
        '.site-name{font-size:28px;font-weight:800;line-height:1.2;margin-bottom:8px;}'+
        '.site-sub{font-size:14px;opacity:.7;margin-bottom:24px;}'+
        '.pill{display:inline-block;padding:4px 12px;background:rgba(255,255,255,.15);border-radius:20px;font-size:11px;font-weight:700;margin-right:8px;}'+
        '.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:0;background:#fff;}'+
        '.metric-box{padding:20px 24px;border-right:1px solid #E8E8F0;border-bottom:1px solid #E8E8F0;}'+
        '.metric-box:nth-child(4n){border-right:none;}'+
        '.metric-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#7278A0;margin-bottom:4px;}'+
        '.metric-value{font-size:22px;font-weight:800;color:#2E2F8A;}'+
        '.metric-sub2{font-size:10px;color:#9A9AAE;margin-top:2px;}'+
        '.body{padding:32px 48px;}'+
        '.section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#4A4BAE;margin:24px 0 10px;}'+
        '.two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px;}'+
        '.info-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #E8E8F0;font-size:12px;}'+
        '.info-key{color:#7278A0;}'+
        '.info-val{font-weight:700;color:#2E2F8A;}'+
        '.highlight-box{background:#F7F8FC;border-left:3px solid #4A4BAE;padding:14px 18px;border-radius:0 6px 6px 0;margin:16px 0;}'+
        '.verdict{display:inline-block;padding:6px 16px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:.06em;}'+
        '.verdict-go{background:rgba(45,122,101,.1);color:#2D7A65;}'+
        '.verdict-caution{background:rgba(154,123,62,.1);color:#9A7B3E;}'+
        '.verdict-avoid{background:rgba(176,90,53,.1);color:#B05A35;}'+
        '.footer{background:#F7F8FC;padding:16px 48px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E8E8F0;font-size:10px;color:#7278A0;}'+
        '.ai-text{font-size:12px;line-height:1.75;color:#3A3D6A;}'+
        '</style></head><body><div class="page">'+
        '<div class="header">'+
          '<div class="logo-bar">'+
            '<div><div class="logo-text">CASSIDY</div><div class="logo-sub">GROUP</div></div>'+
            '<div class="confidential">CONFIDENTIAL — NOT FOR DISTRIBUTION</div>'+
          '</div>'+
          '<div class="site-name">'+addr+'</div>'+
          '<div class="site-sub">'+cityDisp+(lpa?" · "+lpa:"")+'</div>'+
          '<div>'+
            '<span class="pill">'+planStatus+'</span>'+
            (units2>0?'<span class="pill">'+units2+' units</span>':'')+
            (ask>0?'<span class="pill">£'+(ask/1e6).toFixed(2)+'m ask</span>':'')+
          '</div>'+
        '</div>'+
        '<div class="metrics">'+
          '<div class="metric-box"><div class="metric-label">GDV</div><div class="metric-value">'+fmt(gdv)+'</div><div class="metric-sub2">Gross development value</div></div>'+
          '<div class="metric-box"><div class="metric-label">Residual Land Value</div><div class="metric-value">'+fmt(teaserRlv)+'</div><div class="metric-sub2">Maximum land offer</div></div>'+
          '<div class="metric-box"><div class="metric-label">Dev Margin</div><div class="metric-value">'+pct(teaserMargin)+'</div><div class="metric-sub2">On GDV</div></div>'+
          '<div class="metric-box"><div class="metric-label">Site Area</div><div class="metric-value">'+(l.acres||"—")+'ac</div><div class="metric-sub2">'+(l.acres?Math.round(num(l.acres)*0.405*10)/10+' ha':"")+' gross</div></div>'+
        '</div>'+
        '<div class="body">'+
          '<div class="two-col">'+
            '<div>'+
              '<div class="section-title">Site & Planning</div>'+
              ['Planning status:'+planStatus,
               'LPA:'+(lpa||"Unknown"),
               'AH requirement:'+(p.ahPct||"—")+"%",
               'S106 estimate:'+fmt(num(DMt.s106)||num(p.s106)||0),
               'Planning risk:'+((typeof assumeConstraintsClear==="function"&&assumeConstraintsClear(data))?"Cleared (assumed)":((typeof constraintVerdict==="function"?constraintVerdict(data):cc.verdict)||"Not assessed")),
              ].map(function(r2){var p2=r2.split(":");return'<div class="info-row"><span class="info-key">'+p2[0]+'</span><span class="info-val">'+p2.slice(1).join(":")+'</span></div>';}).join("")+
            '</div>'+
            '<div>'+
              '<div class="section-title">Financial Summary</div>'+
              ['Asking price:'+fmt(ask),
               'RLV:'+fmt(teaserRlv),
               'Build cost psf:£'+(rlvD.buildPsf||f.buildPsf||"—"),
               'Finance rate:'+(rlvD.finRate||f.finRatePa||"—")+"%",
               'Programme:'+(f.programmeMths||"—")+" months",
              ].map(function(r2){var p2=r2.split(":");return'<div class="info-row"><span class="info-key">'+p2[0]+'</span><span class="info-val">'+p2.slice(1).join(":")+'</span></div>';}).join("")+
            '</div>'+
          '</div>'+
          '<div class="section-title">Investment Rationale</div>'+
          '<div class="highlight-box"><div class="ai-text">'+(data.teaser&&data.teaser.ai_teaser_rationale||"Click Generate Teaser to populate this section with AI-generated investment rationale.")+'</div></div>'+
          '<div class="section-title">Constraint Summary</div>'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">'+
            (cc.verdict?'<span class="verdict verdict-'+(cc.verdict==="GO"?"go":cc.verdict==="CAUTION"?"caution":"avoid")+'">'+cc.verdict+'</span>':"<span style='font-size:12px;color:#7278A0'>Run Constraint Check to populate</span>")+
            (cc.planningScore?'<span style="font-size:11px;padding:4px 12px;background:#F0F1FA;border-radius:20px;color:#4A4BAE;font-weight:700">Planning score: '+cc.planningScore+'/100</span>':"")+'</div>'+
        '</div>'+
        '<div class="footer">'+
          '<div>'+addr+' · Prepared by Cassidy Group</div>'+
          '<div>Confidential · '+new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})+'</div>'+
          '<div>Built by Phil Daniel · Landform Intelligence Platform</div>'+
        '</div>'+
        '</div></body></html>';

      var w=window.open("","_blank","width=900,height=700");
      if(!w){notify("Allow pop-ups to generate the teaser PDF");return;}
      w.document.write(html);w.document.close();
      setTimeout(function(){w.print();},500);
    }

    return e("div",null,
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}},
        e("div",null,
          e("div",{style:{fontSize:11,color:"#7278A0",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:4}},"1–2 Page Teaser"),
          e("h2",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",margin:0}},addr||"Development Site")
        ),
        e("button",{onClick:generateTeaser,style:{padding:"10px 22px",background:"#2E2F8A",border:"none",borderRadius:7,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🖨 Generate Teaser PDF")
      ),

      // Preview card
      e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",borderRadius:"10px 10px 0 0",padding:"28px 32px",color:"#fff",marginBottom:0}},
        e("div",{style:{fontSize:9,letterSpacing:".3em",opacity:.5,marginBottom:12}},"CASSIDY GROUP"),
        e("div",{style:{fontSize:22,fontWeight:800,marginBottom:4}},addr||"Development Site"),
        e("div",{style:{fontSize:12,opacity:.65,marginBottom:16}},cityDisp+(lpa?" · "+lpa:"")),
        e("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
          [planStatus,units2>0&&units2+" units",ask>0&&"£"+(ask/1e6).toFixed(2)+"m ask"].filter(Boolean).map(function(tag){
            return e("span",{key:tag,style:{padding:"4px 12px",background:"rgba(255,255,255,.15)",borderRadius:20,fontSize:11,fontWeight:700}},tag);
          })
        )
      ),
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",border:"1px solid #DDE0ED",borderTop:"none",marginBottom:14}},
        [{l:"GDV",v:fmt(gdv),s:"Gross dev value"},{l:"RLV",v:fmt(teaserRlv),s:"Max land offer"},{l:"Margin",v:pct(teaserMargin),s:"On GDV"},{l:"Site area",v:(l.acres||"—")+"ac",s:"Gross"}].map(function(m2){
          return e("div",{key:m2.l,style:{padding:"14px 18px",borderRight:"1px solid #DDE0ED"}},
            e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginBottom:2}},m2.l),
            e("div",{style:{fontSize:18,fontWeight:800,color:"#2E2F8A"}},m2.v),
            e("div",{style:{fontSize:9,color:"#9A9AAE"}},m2.s)
          );
        })
      ),

      // AI rationale generator
      e(AIPanel,{user:user,up:up,stage:"teaser",data:data,persistKey:"teaser_rationale",
        label:"✍ Generate Investment Rationale",
        system:"You are a senior UK property investment analyst writing a teaser document for a residential development site. Be compelling, concise, specific.",
        prompt:buildHonestPrompt(data,"Write a 120-word investment rationale for this site teaser. Site: "+addr+", "+cityDisp+". GDV: "+fmt(gdv)+". RLV: "+fmt(teaserRlv)+". Margin: "+pct(teaserMargin)+". Planning: "+planStatus+(lpa?", LPA: "+lpa:"")+". Units: "+units2+". Constraint check: "+(cc.verdict||"not run")+". Write as if pitching to an RP or investor — lead with the opportunity, support with the numbers, close with the ask. No bullet points."
      )}),

      e("div",{style:{background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:8,padding:"12px 16px",marginTop:8,fontSize:11,color:"#4A4BAE"}},
        "ℹ Complete Land Appraisal, RLV and Planning stages first for the most accurate teaser figures. The generated rationale populates automatically into the PDF."
      )
    );
  }
