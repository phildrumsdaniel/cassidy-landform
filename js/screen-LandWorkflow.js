// ── renderLandWorkflow  (params: at, city, data, effUnits, gdv, lc, margin, mergeRespectingCompletedStages, navTo, profit, setData, tc, units, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderLandWorkflow(at, city, data, effUnits, gdv, lc, margin, mergeRespectingCompletedStages, navTo, profit, setData, tc, units, up, user){
    var l=data.land||{};
    var r=data.rlv||{};
    var acres=num(l.acres||r.acres||0);
    var ha=acres*0.404686;
    var askingPrice=num(l.price||0);
    var lpa=l.localAuthority||l.lpa||data.planning&&data.planning.lpa||"";
    var lCity=(l.city||city||"manchester");
    var lm=MKT[lCity]||MKT.manchester;
    var postcode=r.postcode||l.postcode||"";

    // ── LANDOWNER PREMIUM CALCULATOR ─────────────────────────────────────
    var ownerType=l.ownerType||"farmer";
    var ownerPremiums={
      farmer:{label:"Farmer / Agricultural",base:1.0,typical:2.5,max:4.0,
        note:"Agricultural land worth £8k-25k/acre. Once residential consent granted, value jumps 10-50x. Farmers typically want 30-50% of uplift above agricultural value.",
        tactics:"Option agreement is standard — you control the land, farmer gets a share of the uplift when planning is granted. Typical option fee: £1,000-5,000 per acre upfront."},
      private:{label:"Private Landowner",base:1.0,typical:1.8,max:3.0,
        note:"Private owners often have unrealistic price expectations based on Rightmove. Residual valuation is your anchor.",
        tactics:"Use comparable Land Registry data to justify your offer. Option or conditional exchange gives them comfort while protecting you."},
      commercial:{label:"Commercial / Company",base:1.0,typical:1.3,max:2.0,
        note:"Companies need board approval and have fiduciary duties. Often more rational on price but slower to decide.",
        tactics:"Put offer in writing with clear conditions. Companies respond to certainty and speed more than price alone."},
      estate:{label:"Estate / Landed Gentry",base:1.0,typical:2.0,max:3.5,
        note:"Estates often have complex title, multiple beneficiaries and emotional attachment to land. Price is not always the primary driver.",
        tactics:"Consider overage clauses, community benefit funds, naming rights. Build relationship before making offer."},
      council:{label:"Local Authority",base:1.0,typical:1.1,max:1.5,
        note:"Councils must achieve best consideration under s123 LGA 1972. Usually closer to market value but slow process.",
        tactics:"Best and final offer process common. Viability evidence helps. Community benefit matters to elected members."},
      church:{label:"Church / Charity",base:1.0,typical:1.2,max:1.8,
        note:"Charities must achieve best price. Trustees have legal duties. Often amenable to affordable housing commitments.",
        tactics:"Charitable benefit arguments can help. Consider offering AH above policy requirement in exchange for price reduction."},
    };

    var owner=ownerPremiums[ownerType]||ownerPremiums.farmer;
    var agriValue=acres*15000; // £15k/acre typical agricultural
    var residualLandValue=num(data.rlv&&data.rlv.units?(function(){
      var ru=num(data.rlv.units); var rs=num(data.rlv.avgSqft)||850;
      var rp=num(data.rlv.salePsf)||estSalePsfFromRent(lm.btr)||280; var rb=num(data.rlv.buildPsf)||lm.build;
      var rg=ru*rs*rp; var rbc=ru*rs*rb;
      return rg-rbc-rbc*0.12-rbc*0.05-(rbc+0)*0.075-ru*8000-rg*0.175;
    })():0);

    var uplift=residualLandValue-agriValue;
    var fairShare=Math.round(agriValue+uplift*0.40); // Farmer gets agri value + 40% of uplift
    var optionFee=Math.round(acres*2000); // £2k/acre option fee
    var maxBid=residualLandValue>0?Math.round(residualLandValue*0.85):0; // 85% of RLV = max bid
    var openingBid=residualLandValue>0?Math.round(residualLandValue*0.65):0; // 65% opening

    // ── SCHEME SCENARIOS ─────────────────────────────────────────────────
    var scenarios=acres>0?[
      {id:"sfh_mix",label:"Mixed Housing",icon:"🏘",type:"SFH",assetType:"sfh",stage:"sfh",
        units:Math.max(1,Math.floor(ha*32)),mix:"2/3/4 bed terraced & semi",dph:32,
        buildPsf:195,unitSqft:950,
        desc:"Most common planning consent for suburban/rural sites. Mix of terraced and semi-detached appeals to widest buyer market.",
        pros:["Broadest market appeal","Most likely to get planning","Strong absorption rate"],
        cons:["Lower density than apartments","S38/S104 roads adoption required"]},
      {id:"sfh_exec",label:"Executive Homes",icon:"🏡",type:"SFH",assetType:"sfh",stage:"sfh",
        units:Math.max(1,Math.floor(ha*18)),mix:"4/5 bed detached",dph:18,
        buildPsf:225,unitSqft:1600,
        desc:"Premium detached homes. Higher margin per unit but lower density. Works best on well-located sites near good schools.",
        pros:["Premium pricing","Higher margin per plot","Aspirational market"],
        cons:["Low density — needs large site","Slower absorption","Needs strong local amenities"]},
      {id:"bungalow",label:"Bungalow Development",icon:"🏚",type:"SFH",assetType:"sfh",stage:"sfh",
        units:Math.max(1,Math.floor(ha*16)),mix:"2/3 bed bungalow",dph:16,
        buildPsf:210,unitSqft:880,
        desc:"Aging population creates strong demand. Premium per sqft. Single storey easier to build on sloped sites.",
        pros:["Strong elderly market","Premium pricing per sqft","Planning sympathy"],
        cons:["Very low density","Needs large site to be viable"]},
      {id:"btr",label:"Build to Rent",icon:"🏢",type:"BTR",assetType:"btr",stage:"hra",
        units:Math.max(1,Math.floor(ha*100)),mix:"1/2 bed apartments",dph:100,
        buildPsf:230,unitSqft:550,
        desc:"Institutional BTR — typically 50-200 units. Forward fund exit to pension funds at 4-5.5% yield. Needs town/city location.",
        pros:["Institutional exit","Single transaction","High GDV per acre"],
        cons:["Needs town centre location","BSA 2022 compliance","Longer planning"]},
      {id:"pbsa",label:"Student Accommodation",icon:"🎓",type:"PBSA",assetType:"pbsa",stage:"hra",
        units:Math.max(1,Math.floor(ha*200)),mix:"Studios & clusters",dph:200,
        buildPsf:210,unitSqft:270,
        desc:"Highest density. Only viable within walking distance of university. Article 4 may apply.",
        pros:["Highest bed count","Specialist fund demand","No car parking"],
        cons:["University proximity essential","Article 4 restrictions","Specialist management"]},
      {id:"later_living",label:"Later Living / Retirement",icon:"🏥",type:"SFH",assetType:"sfh",stage:"sfh",
        units:Math.max(1,Math.floor(ha*25)),mix:"1/2 bed retirement apts",dph:25,
        buildPsf:215,unitSqft:680,
        desc:"Growing market. Often exempt from affordable housing requirements. Strong planning support from councils.",
        pros:["AH often exempt","Planning sympathy","Growing demographic"],
        cons:["Specialist operator needed","Slower sales","Service charge complexity"]},
    ].map(function(sc){
      var gdv=sc.units*sc.unitSqft*(num(data.rlv&&data.rlv.salePsf)||estSalePsfFromRent(lm.btr)||280);
      var bc=sc.units*sc.unitSqft*sc.buildPsf;
      var fees=bc*0.12; var cont=bc*0.05; var fin=(bc+fees)*0.075;
      var s106=sc.units*8000; var profit=gdv*0.175;
      var tc=bc+fees+cont+fin+s106;
      var rlv2=gdv-tc-profit;
      return Object.assign({},sc,{gdv:gdv,bc:bc,tc:tc,rlv:rlv2,profit:profit,
        margin:gdv>0?(profit/gdv)*100:0,viable:rlv2>0,
        rlvPerAcre:acres>0?rlv2/acres:0});
    }):[];

    var bestScheme=scenarios.length>0?scenarios.reduce(function(b,s){return s.rlv>b.rlv?s:b;},scenarios[0]):null;

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Land Development Workflow"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:20}},"From land found to exit strategy — complete journey with auto-populated scheme scenarios"),

      // ── LAND SUMMARY ────────────────────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #4A4BAE"})},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
          e("div",{style:S.cardTitle},"Land Summary"),
          e("div",{style:{display:"flex",gap:8}},
            e("button",{onClick:function(){navTo("scraper");},style:{padding:"5px 10px",background:"transparent",border:"1px solid #4A4BAE",color:"#4A4BAE",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer"}},"Land Finder"),
            e("button",{onClick:function(){navTo("land");},style:{padding:"5px 10px",background:"transparent",border:"1px solid #4A4BAE",color:"#4A4BAE",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer"}},"Land Appraisal"),
            e("button",{onClick:function(){navTo("rlv");},style:{padding:"5px 10px",background:"transparent",border:"1px solid #4A4BAE",color:"#4A4BAE",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer"}},"Land Valuation")
          )
        ),
        acres>0?e("div",{style:{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}},
          [
            {l:"Site Area",v:acres+" acres / "+ha.toFixed(2)+" ha"},
            {l:"Asking Price",v:askingPrice>0?fmt(askingPrice):"Not set"},
            {l:"City",v:cityName(lCity)},
            {l:"Postcode",v:postcode||"Not set"},
            {l:"Local Authority",v:lpa||"Not set"},
          ].map(function(item){
            return e("div",{key:item.l,style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:6,padding:"10px 12px"}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:3}},item.l),
              e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A"}},item.v)
            );
          })
        ):e("div",{style:{textAlign:"center",padding:"20px",color:"#7278A0",fontSize:12}},
          "No land data found. ",
          e("span",{onClick:function(){navTo("scraper");},style:{color:"#4A4BAE",cursor:"pointer",fontWeight:700}},"Start with Land Finder →")
        )
      ),

      // ── LANDOWNER PREMIUM CALCULATOR ─────────────────────────────────────
      acres>0&&e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #9A7B3E"})},
        e("div",{style:S.cardTitle},"Landowner Premium Calculator"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14}},"Landowners — especially farmers — know their land has development value and will want a premium. Here's how to structure a fair deal that works for both sides."),
        e("div",{style:{marginBottom:14}},
          e("label",{style:S.label},"Landowner Type"),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:6}},
            Object.keys(ownerPremiums).map(function(key){
              var op=ownerPremiums[key];
              var selected=ownerType===key;
              return e("div",{key:key,onClick:function(){up("land","ownerType",key);},
                style:{padding:"10px 12px",background:selected?"rgba(74,75,174,0.1)":"#fff",border:"1px solid "+(selected?"#4A4BAE":"#DDE0ED"),borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:selected?700:400,color:selected?"#4A4BAE":"#7278A0",textAlign:"center"}},
                op.label
              );
            })
          )
        ),
        e("div",{style:{background:"rgba(154,123,62,0.06)",border:"1px solid rgba(154,123,62,0.25)",borderRadius:8,padding:16,marginBottom:14}},
          e("div",{style:{fontSize:12,fontWeight:700,color:"#7A5A2E",marginBottom:10}},owner.label+" — Negotiation Guide"),
          e("div",{style:{fontSize:11,color:"#7A5A2E",lineHeight:1.7,marginBottom:12}},owner.note),
          e("div",{style:{background:"rgba(255,255,255,0.7)",borderRadius:6,padding:"10px 14px",fontSize:11,color:"#3A3D6A",lineHeight:1.7}},
            e("strong",null,"Tactics: "),owner.tactics
          )
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}},
          [
            {l:"Agricultural Value",v:fmt(agriValue),sub:"£15k/acre baseline",c:"#7278A0"},
            {l:"Fair Share Price",v:fmt(fairShare),sub:"Agri + 40% uplift",c:"#9A7B3E"},
            {l:"Opening Bid",v:openingBid>0?fmt(openingBid):"Run RLV first",sub:"65% of max RLV",c:"#4A4BAE"},
            {l:"Maximum Bid",v:maxBid>0?fmt(maxBid):"Run RLV first",sub:"85% of max RLV",c:"#2D7A65"},
          ].map(function(item){
            return e("div",{key:item.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid "+item.c,borderRadius:8,padding:14}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:4}},item.l),
              e("div",{style:{fontSize:18,fontWeight:800,color:item.c,marginBottom:3}},item.v),
              e("div",{style:{fontSize:9,color:"#7278A0"}},item.sub)
            );
          })
        ),
        e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:8,padding:14,fontSize:11,color:"#3A3D6A",lineHeight:1.7}},
          e("strong",null,"Option Agreement (recommended for "+owner.label+"): "),
          "Pay "+"£"+optionFee.toLocaleString()+" option fee now ("+acres+" acres × £2,000). ",
          "You control the land for 2-3 years while you get planning. ",
          "On grant of planning you complete at agreed price. ",
          "Protects you from paying full price before consent is secured."
        )
      ),

      // ── SCHEME SCENARIOS ─────────────────────────────────────────────────
      acres>0&&e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #2D7A65"})},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
          e("div",{style:S.cardTitle},"Development Scheme Options — "+acres+" acres / "+ha.toFixed(2)+"ha in "+cityName(lCity)),
          bestScheme&&e("div",{style:{fontSize:11,color:"#2D7A65",fontWeight:700}},"Best: "+bestScheme.label+" · "+fmt(bestScheme.rlv))
        ),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:16}},"All scenarios calculated on "+acres+" acres / "+ha.toFixed(2)+" ha. Click a scheme to open the full appraisal and auto-fill all stages."),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}},
          scenarios.map(function(sc){
            var sc2=sc.viable?"#2D7A65":"#B05A35";
            return e("div",{key:sc.id,
              style:{background:"#fff",border:"2px solid "+(sc.id===bestScheme.id?"#2D7A65":"#DDE0ED"),borderRadius:10,padding:16,position:"relative"}},
              sc.id===bestScheme.id&&e("div",{style:{position:"absolute",top:-10,right:12,background:"#2D7A65",color:"#fff",fontSize:9,fontWeight:700,padding:"3px 10px",borderRadius:10,letterSpacing:".08em"}},"BEST RLV"),
              e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}},
                e("span",{style:{fontSize:18}},sc.icon),
                e("div",null,
                  e("div",{style:{fontSize:13,fontWeight:800,color:"#2E2F8A"}},sc.label),
                  e("div",{style:{fontSize:10,color:"#7278A0"}},sc.mix+" · "+sc.dph+" dph")
                )
              ),
              e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.5,marginBottom:12}},sc.desc),
              e("div",{style:{fontSize:32,fontWeight:800,color:"#4A4BAE",marginBottom:2}},sc.units),
              e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:12}},"units / beds on "+acres+" acres"),
              e("div",{style:{display:"flex",flexDirection:"column",gap:3,marginBottom:12}},
                [["GDV",fmt(sc.gdv),"#2E2F8A"],
                 ["Build Cost",fmt(sc.bc),"#7278A0"],
                 ["Total Dev Cost",fmt(sc.tc),"#7278A0"],
                 ["Developer Profit",fmt(sc.profit),"#9A7B3E"],
                 ["Max Land Value",fmt(sc.rlv),sc2],
                 ["Per Acre",fmt(sc.rlvPerAcre),sc2],
                ].map(function(row){
                  return e("div",{key:row[0],style:{display:"flex",justifyContent:"space-between",fontSize:11,padding:"3px 0",borderBottom:"1px solid #F0F0F0"}},
                    e("span",{style:{color:"#7278A0"}},row[0]),
                    e("span",{style:{fontWeight:600,color:row[2]}},row[1])
                  );
                })
              ),
              e("div",{style:{marginBottom:10}},
                sc.pros.map(function(p){return e("div",{key:p,style:{fontSize:10,color:"#2D7A65",marginBottom:1}},"✓ "+p);}),
                sc.cons.map(function(c){return e("div",{key:c,style:{fontSize:10,color:"#B05A35",marginBottom:1}},"✗ "+c);})
              ),
              e("div",{style:{display:"flex",flexDirection:"column",gap:6}},
                e("button",{onClick:function(){
                // Generate printable one-pager
                var printContent="<!DOCTYPE html><html><head><title>"+
                  (data.land&&data.land.address||"Deal Summary")+" — Cassidy Group"+
                  "</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#1A1A3E;font-size:12px}h1{font-size:22px;color:#2E2F8A;border-bottom:3px solid #EDE84A;padding-bottom:8px}h2{font-size:14px;color:#4A4BAE;margin-top:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.box{background:#F7F8FC;border:1px solid #DDE0ED;padding:10px;border-radius:4px}.label{font-size:9px;color:#999;text-transform:uppercase}.value{font-size:16px;font-weight:bold;color:#2E2F8A}.footer{margin-top:30px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px}</style></head><body>"+
                  "<h1>"+(data.land&&data.land.address||"Development Site")+"</h1>"+
                  "<p><strong>City:</strong> "+cityName(city)+" &nbsp;|&nbsp; <strong>Asset:</strong> "+at.toUpperCase()+" &nbsp;|&nbsp; <strong>LPA:</strong> "+(data.planning&&data.planning.lpa||"—")+"</p>"+
                  "<h2>Financial Summary</h2><div class=grid>"+
                  "<div class=box><div class=label>GDV</div><div class=value>"+fmt(gdv)+"</div></div>"+
                  "<div class=box><div class=label>Total Dev Cost</div><div class=value>"+fmt(tc)+"</div></div>"+
                  "<div class=box><div class=label>Profit</div><div class=value>"+fmt(profit)+"</div></div>"+
                  "<div class=box><div class=label>Margin on GDV</div><div class=value>"+pct(margin)+"</div></div>"+
                  "<div class=box><div class=label>Units</div><div class=value>"+(effUnits||units)+"</div></div>"+
                  "<div class=box><div class=label>Land Cost</div><div class=value>"+fmt(lc)+"</div></div>"+
                  "</div>"+
                  "<h2>Planning</h2><p>Status: "+(data.planning&&data.planning.status||"—")+" | AH: "+(data.planning&&data.planning.ahPct||"—")+"% | S106: "+fmt(data.planning&&num(data.planning.s106)||0)+"</p>"+
                  "<h2>Landowner Commercial Split</h2><p>RLV (max bid): — | Opening bid: "+fmt(num(data.land&&data.land.openingBid||0))+" | Max bid: "+fmt(num(data.land&&data.land.maxBid||0))+"</p>"+
                  "<div class=footer>Generated by Cassidy Group Landform &bull; "+new Date().toLocaleDateString("en-GB")+" &bull; Confidential</div>"+
                  "</body></html>";
                var w=window.open("","_blank");
                w.document.write(printContent);
                w.document.close();
                w.print();
              },style:{padding:"7px 16px",background:"#B05A35",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🖨 Print / PDF"),
              e("button",{onClick:function(){
                  setData(function(d){
                    var updates={assetType:sc.assetType};
                    if(sc.type==="SFH"){
                      updates.sfh=Object.assign({},d.sfh||{},{acres:acres+"",city:lCity,dph:sc.dph+"",basePsf:Math.round(estSalePsfFromRent(lm.btr))+"",buildPsf:sc.buildPsf+""});
                    } else {
                      updates.hra=Object.assign({},d.hra||{},{city:lCity});
                    }
                    updates.planning=Object.assign({},d.planning||{},{units:sc.units+"",lpa:lpa});
                    updates.fin=Object.assign({},d.fin||{});
                    return mergeRespectingCompletedStages(d,updates);
                  });
                  navTo(sc.stage);
                },style:{width:"100%",padding:"9px",background:"#4A4BAE",border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
                "Open Full Appraisal →"),
                e("button",{onClick:function(){
                  setData(function(d){
                    var updates={assetType:sc.assetType};
                    if(sc.type==="SFH"){
                      updates.sfh=Object.assign({},d.sfh||{},{acres:acres+"",city:lCity,dph:sc.dph+"",buildPsf:sc.buildPsf+""});
                    } else {
                      updates.hra=Object.assign({},d.hra||{},{city:lCity});
                    }
                    updates.planning=Object.assign({},d.planning||{},{units:sc.units+"",lpa:lpa});
                    return mergeRespectingCompletedStages(d,updates);
                  });
                  navTo(sc.type==="SFH"?"sfh":"hra");
                },style:{width:"100%",padding:"7px",background:"transparent",border:"1px solid #4A4BAE",borderRadius:6,color:"#4A4BAE",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
                "→ Jump to Planning"),
                e("button",{onClick:function(){
                  setData(function(d){
                    var updates={assetType:sc.assetType};
                    if(sc.type==="SFH"){
                      updates.sfh=Object.assign({},d.sfh||{},{acres:acres+"",city:lCity,dph:sc.dph+"",basePsf:Math.round(estSalePsfFromRent(lm.btr))+"",buildPsf:sc.buildPsf+""});
                    }
                    updates.planning=Object.assign({},d.planning||{},{units:sc.units+"",lpa:lpa});
                    updates.exit=Object.assign({},d.exit||{},{strategy:"stabilised"});
                    return mergeRespectingCompletedStages(d,updates);
                  });
                  navTo("exit");
                },style:{width:"100%",padding:"7px",background:"transparent",border:"1px solid #2D7A65",borderRadius:6,color:"#2D7A65",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
                "→ Exit Strategy")
              )
            );
          })
        )
      ),

      // ── JOURNEY FORWARD ──────────────────────────────────────────────────
      e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #9A7B3E"})},
        e("div",{style:S.cardTitle},"Continue the Journey"),
        e("div",{style:{display:"flex",flexDirection:"column",gap:8}},
          [
            {icon:"▲",label:"Planning & Viability",desc:"NPPF, S106, BNG, AH — get your strategy right",id:"planning",c:"#4A4BAE"},
            {icon:"◉",label:"Financial Modelling",desc:"Full appraisal — GDV, returns, bear/base/bull",id:"fin",c:"#2D7A65"},
            {icon:"◈",label:"Due Diligence",desc:"Clear legal, technical, planning and commercial",id:"dd",c:"#7B6CB0"},
            {icon:"⬡",label:"Risk Register",desc:"RAG-rate and mitigate before committing",id:"risks",c:"#9A7B3E"},
            {icon:"◆",label:"Investment Exit",desc:"Forward fund, HoTs, Investment Memo",id:"exit",c:"#B05A35"},
          ].map(function(step){
            return e("div",{key:step.id,onClick:function(){navTo(step.id);},
              style:{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,cursor:"pointer"},
              onMouseOver:function(ev){ev.currentTarget.style.borderColor=step.c;},
              onMouseOut:function(ev){ev.currentTarget.style.borderColor="#DDE0ED";}},
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

      e(AIPanel,{user:user,up:up,stage:"landworkflow",data:data,persistKey:"landworkflow_ai__best_scheme___ac",label:"AI: Best Scheme & Acquisition Strategy",
        prompt:buildHonestPrompt(data,"I have found a "+acres+" acre site in "+cityName(lCity)+(postcode?" ("+postcode+")":"")+". Asking price: "+fmt(askingPrice)+". Owner type: "+owner.label+". Local authority: "+(lpa||"unknown")+". Asset type preference: "+at.toUpperCase()+". Provide: 1) Which development scheme maximises value on "+acres+" acres in "+cityName(lCity)+"? 2) What density is achievable and likely to get planning consent? 3) What acquisition strategy would you recommend — unconditional, conditional, option agreement? 4) What premium above agricultural value would a landowner realistically expect and why? 5) What are the top 3 risks on this specific site? 6) What is the realistic timeline from offer to planning consent to exit?")})
    );
  }
