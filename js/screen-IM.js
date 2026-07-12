// ── renderIM  (params: at, city, data, gdv, lc, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderIM(at, city, data, gdv, lc, up, user){
    var l=data.land||{}; var p=data.planning||{}; var f=data.fin||{};
    var rlvD=data.rlv||{}; var ap=data.viability&&data.viability.appraisal||{};
    var risks=data.risks||{}; var cc=data.constraint||{}; var mon=data.monitor||{};
    var addr=l.address||"Development Site";
    var cityDisp=cityName(city||l.city||"");
    var planStatus=p.status||l.planningStatus||"Unallocated";
    var units2=num(p.units||rlvD.units||0);
    var ask=num(l.price||0);
    var lpa=p.lpa||l.localAuthority||"";

    var sections=[
      {id:"exec",l:"1. Executive Summary",key:"im_exec"},
      {id:"site",l:"2. Site & Location",key:"im_site"},
      {id:"planning",l:"3. Planning Position",key:"im_planning"},
      {id:"appraisal",l:"4. Financial Appraisal",key:"im_appraisal"},
      {id:"market",l:"5. Market Analysis",key:"im_market"},
      {id:"risk",l:"6. Risk & Mitigations",key:"im_risk"},
      {id:"team",l:"7. Team & Next Steps",key:"im_team"},
    ];

    function generateSection(sec){
      var allocTxt = (typeof exitAllocationText==="function") ? exitAllocationText(data) : "";
      var allocNote = allocTxt ? (" Planned mixed exit (honour this allocation, do not assume a single buyer): " + allocTxt + ".") : "";
      var prompts={
        exec:"Write the executive summary section (150 words) for an investor memorandum. Site: "+addr+", "+cityDisp+". GDV: "+fmt(gdv)+". RLV: "+fmt(num(rlvD.rlv||lc))+". Margin: "+pct(num(f.marginPct||0))+". Units: "+units2+". Planning: "+planStatus+", LPA: "+lpa+"."+allocNote+" Lead with the investment opportunity, headline numbers, and recommended action. Professional UK property investment tone.",
        site:"Write the site & location section (150 words) covering physical characteristics ("+l.acres+" acres, "+planStatus+"), location context in "+cityDisp+", transport links, proximity to demand, and any notable site features. Address: "+addr+". LPA: "+lpa+".",
        planning:"Write the planning position section (150 words) covering planning status ("+planStatus+"), LPA: "+lpa+", affordable housing requirement: "+(p.ahPct||"unknown")+"%, S106 estimate: "+fmt(num(p.s106||0))+", constraint check result: "+(cc.verdict||"not assessed")+", planning probability score: "+(cc.planningScore||"not assessed")+"/100. Cover key planning risks and programme.",
        appraisal:"Write the financial appraisal section (180 words) with these figures: GDV "+fmt(gdv)+", RLV "+fmt(num(rlvD.rlv||lc))+", asking price "+fmt(ask)+", development margin "+pct(num(f.marginPct||0))+" on GDV, build cost £"+(rlvD.buildPsf||f.buildPsf||"tbc")+"/sqft, finance rate "+(f.finRatePa||rlvD.finRate||7.5)+"%, programme "+(f.programmeMths||"tbc")+" months, S106 "+fmt(num(p.s106||0))+"."+allocNote+" Include sensitivity to ±10% GDV and ±10% build cost. Professional tone with honest commentary on margin relative to target.",
        market:"Write the market analysis section (150 words) for "+cityDisp+" residential market. Cover demand drivers, comparable land transactions, new-build pricing, affordable housing need, and why this location supports the proposed scheme. Scheme type: "+(at||"residential")+". Draw on general UK market knowledge for "+cityDisp+".",
        risk:"Write the risk & mitigations section (150 words) as a structured risk register commentary. Cover planning risk (status: "+planStatus+"), construction risk, market risk, financial risk (margin: "+pct(num(f.marginPct||0))+"), and S106/obligation risk. For each risk state the likelihood, impact and proposed mitigation. Professional IC tone.",
        team:"Write the team & next steps section (120 words) for Cassidy Group. Cover Cassidy's track record in UK residential development, the proposed transaction structure, heads of terms requirements, and a clear timetable with next steps. Close with the key ask and contact instruction.",
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
              '<div class="cover-metric"><div class="cm-label">GDV</div><div class="cm-value">'+fmt(gdv)+'</div></div>'+
              '<div class="cover-metric"><div class="cm-label">Residual Land Value</div><div class="cm-value">'+fmt(num(rlvD.rlv||lc))+'</div></div>'+
              '<div class="cover-metric"><div class="cm-label">Dev Margin</div><div class="cm-value">'+pct(num(f.marginPct||f.devMargin||0))+'</div></div>'+
              '<div class="cover-metric"><div class="cm-label">Units</div><div class="cm-value">'+units2+'</div></div>'+
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
