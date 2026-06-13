// ── renderHRA  (params: LiveMarketBanner, city, data, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderHRA(LiveMarketBanner, city, data, up, user){
    var h=data.hra||{};
    var hCity=h.city||city;
    var hm=MKT[hCity]||MKT.manchester;
    var storeys=num(h.storeys); var fp=num(h.fp);
    var eff=numOr(h.eff,80);
    var gia2=fp*storeys; var nia=gia2*(eff/100);
    // CRITICAL: use numOr so user-entered 0 is respected (was bug — 0 fell through to default 20/50/30)
    var ss=numOr(h.ss,20); var os=numOr(h.os,50); var ts=numOr(h.ts,30);
    var mixTotal = ss+os+ts;
    var mixOk = Math.abs(mixTotal - 100) < 0.5;
    var ssqft=numOr(h.ssqft,380); var osqft=numOr(h.osqft,520); var tsqft=numOr(h.tsqft,750);
    // Compute units — guard against div-by-zero, and skip rows with 0% share
    var su = (nia>0 && ss>0 && ssqft>0) ? Math.round(nia*(ss/100)/ssqft) : 0;
    var ou = (nia>0 && os>0 && osqft>0) ? Math.round(nia*(os/100)/osqft) : 0;
    var tu = (nia>0 && ts>0 && tsqft>0) ? Math.round(nia*(ts/100)/tsqft) : 0;
    var total=su+ou+tu;
    var mktSalePsf=num((data.rlv&&data.rlv.salePsf)||(city&&PC_PSF&&PC_PSF[city.substring(0,3).toUpperCase()])||260);
    var sPsf=num(h.sPsf)||Math.round(mktSalePsf*0.92);
    var oPsf=num(h.oPsf)||Math.round(mktSalePsf);
    var tPsf=num(h.tPsf)||Math.round(mktSalePsf*1.08);
    var fl=numOr(h.fl,0.5);
    var blend=1+(storeys>1?(storeys/2)*fl/100:0);
    var sGdv=su*ssqft*sPsf*blend; var oGdv=ou*osqft*oPsf*blend; var tGdv=tu*tsqft*tPsf*blend;
    var hGdv=sGdv+oGdv+tGdv; var avgPsf=nia>0?hGdv/nia:0;
    var bcp=numOr(h.bcp, (storeys>=20?310:storeys>=15?280:storeys>=10?255:230));
    var hBc=gia2*bcp;
    var cores=numOr(h.cores, Math.max(1,Math.ceil(gia2/40000)));
    var liftCost=cores*storeys*18000;
    var sprCost=gia2*18;
    var ewsCost=storeys>=11?25000:0;
    var g2Cost=storeys>=18?45000:storeys>=11?28000:0;
    var structP=storeys>=20?gia2*15:storeys>=15?gia2*10:gia2*6;
    var amenity=Math.min(total*3500,500000);
    var hFees=hBc*0.13; var hCont=hBc*(numOr(h.contingency,6))/100;
    var hFin=(hBc+hFees)*(numOr(h.finRate,8))/100;
    var hS106=total*(numOr(h.s106pu,10000)); var hPlan=total*12000;
    var hDevProfit=hGdv*(numOr(h.profitPct,17.5))/100;
    var hrCosts=liftCost+sprCost+ewsCost+g2Cost+structP+amenity;
    var hTc=hBc+hFees+hCont+hFin+hS106+hPlan+hrCosts;
    var hRlv=hGdv-hTc-hDevProfit;
    var hMargin=hGdv>0?(hDevProfit/hGdv)*100:0;
    var sc=hRlv>0?"#2D7A65":"#B05A35";
    var bsa=storeys>=18; var ews=storeys>=11;

    var compliance=[
      {l:"BSA 2022 / HRB regime",v:bsa?"Required — Principal Designer & Contractor":"Not applicable (<18m)",req:bsa},
      {l:"Gateway 2 (pre-construction)",v:storeys>=18?"Required — HSE submission":"Not required",req:storeys>=18},
      {l:"Gateway 3 (pre-occupation)",v:storeys>=18?"Required — BSR completion certificate":"Not required",req:storeys>=18},
      {l:"EWS1 Form",v:ews?"Required for mortgage lending":"Not required (<11m)",req:ews},
      {l:"Sprinkler system",v:ews?"Mandatory — Building Regs Part B":"Recommended",req:ews},
      {l:"Fire Engineer",v:storeys>=6?"Required from 6+ storeys":"Consult building regs",req:storeys>=6},
    ];

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"High-Rise Apartments"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:14}},"Multi-storey flatted development — BSA Gateway 2/3, EWS1, fire strategy, lift provision, GIA efficiency"),

      // Workflow guidance: how unit count is derived
      e("div",{style:{padding:"10px 14px",background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.3)",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.7,marginBottom:14}},
        e("strong",{style:{color:"#2E2F8A"}},"How unit count is calculated: "),
        "This stage works ",e("strong",null,"bottom-up")," from the building. Total units = Floorplate × Storeys × Efficiency × Mix Splits ÷ Unit Sizes. To model a target unit count (e.g. exactly 124 units), adjust the Floorplate, Storeys, or Unit Sizes until the total matches. If you already know your unit count and want to skip building geometry, use the simpler ",e("strong",null,"Tenure Mix")," stage or enter the target manually in Financial Modelling."
      ),

      LiveMarketBanner(),
      storeys>0&&e("div",{style:{border:"1px solid "+(bsa?"#B05A35":"#4A4BAE"),borderRadius:10,padding:"16px 20px",background:bsa?"rgba(176,90,53,0.06)":"rgba(74,75,174,0.04)",marginBottom:16}},
        e("div",{style:{fontWeight:700,fontSize:13,color:bsa?"#B05A35":"#4A4BAE",marginBottom:12}},bsa?"🔴 Higher Risk Building — Building Safety Act 2022 applies":"🟡 Medium-rise — Fire Safety (England) Regulations apply"),
        compliance.map(function(fc){
          return e("div",{key:fc.l,style:{display:"grid",gridTemplateColumns:"200px 1fr",gap:12,fontSize:11,padding:"4px 0",borderBottom:"1px solid rgba(0,0,0,0.05)"}},
            e("span",{style:{fontWeight:600,color:"#3A3D6A"}},fc.l),
            e("span",{style:{color:"#7278A0"}},fc.v)
          );
        })
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Building Specification"),
        e("div",{style:S.grid2},
          e(CitySelect,{value:h.city,onChange:function(v){up("hra","city",v);}}),
          e(Inp,{label:"Number of Storeys",type:"number",value:h.storeys,onChange:function(v){up("hra","storeys",v);},placeholder:"e.g. 12"}),
          e(Inp,{label:"Floorplate sqft per floor",type:"number",value:h.fp,onChange:function(v){up("hra","fp",v);},placeholder:"e.g. 8000"}),
          e(Inp,{label:"Efficiency Ratio % (NIA of GIA)",type:"number",value:h.eff,onChange:function(v){up("hra","eff",v);},placeholder:"80 (typical 78-85%)"}),
          e(Inp,{label:"Number of Cores",type:"number",value:h.cores,onChange:function(v){up("hra","cores",v);},placeholder:"Est: "+Math.max(1,Math.ceil((gia2||8000)/40000))}),
          e(Sel,{label:"Structural Form",value:h.structure,onChange:function(v){up("hra","structure",v);},
            options:[{value:"",label:"Select..."},{value:"rc_frame",label:"RC Frame (most common 10+ storeys)"},{value:"steel",label:"Steel/RC Hybrid"},{value:"clt",label:"CLT Hybrid (up to ~18 storeys)"},{value:"modular",label:"Modular/Volumetric"}]})
        ),
        gia2>0&&e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,background:"#EEEEF8",borderRadius:8,padding:14,marginTop:8}},
          [{l:"Total GIA",v:gia2.toLocaleString()+" sqft"},{l:"NIA ("+eff+"% eff)",v:Math.round(nia).toLocaleString()+" sqft"},{l:"Lost to circulation",v:Math.round(gia2-nia).toLocaleString()+" sqft"},{l:"Est. units",v:total+" apts"}].map(function(item){
            return e("div",{key:item.l},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:3}},item.l),
              e("div",{style:{fontSize:14,fontWeight:700,color:"#2E2F8A"}},item.v)
            );
          })
        )
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Unit Mix & Pricing"),
        // 100% validation warning — visible if splits don't add up
        (storeys>0 && fp>0) && !mixOk && e("div",{style:{padding:"10px 14px",background:"rgba(176,90,53,0.08)",border:"1px solid #B05A35",borderRadius:6,marginBottom:12,fontSize:11,color:"#B05A35",lineHeight:1.6,fontWeight:700}},
          "⚠ Unit mix splits add up to "+mixTotal.toFixed(0)+"% — should total 100% (Studio "+ss+"% + 1-bed "+os+"% + 2-bed "+ts+"%). Adjust the splits below until they sum to 100%."
        ),
        (storeys>0 && fp>0) && mixOk && (ss===0 || os===0 || ts===0) && e("div",{style:{padding:"8px 12px",background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.3)",borderRadius:6,marginBottom:12,fontSize:10,color:"#4A4BAE",lineHeight:1.5}},
          "ℹ Mix totals 100%. " + [ss===0?"No studios":"", os===0?"No 1-beds":"", ts===0?"No 2-beds":""].filter(Boolean).join(", ") + " — your input respected."
        ),
        e("div",{style:S.grid2},
          e(Inp,{label:"Studio split %",type:"number",value:h.ss,onChange:function(v){up("hra","ss",v);},placeholder:"20"}),
          e(Inp,{label:"Studio size sqft",type:"number",value:h.ssqft,onChange:function(v){up("hra","ssqft",v);},placeholder:"380"}),
          e(Inp,{label:"1-bed split %",type:"number",value:h.os,onChange:function(v){up("hra","os",v);},placeholder:"50"}),
          e(Inp,{label:"1-bed size sqft",type:"number",value:h.osqft,onChange:function(v){up("hra","osqft",v);},placeholder:"520"}),
          e(Inp,{label:"2-bed split %",type:"number",value:h.ts,onChange:function(v){up("hra","ts",v);},placeholder:"30"}),
          e(Inp,{label:"2-bed size sqft",type:"number",value:h.tsqft,onChange:function(v){up("hra","tsqft",v);},placeholder:"750"}),
          e(Inp,{label:"Studio sale £/sqft",type:"number",value:h.sPsf,onChange:function(v){up("hra","sPsf",v);},placeholder:"£"+Math.round(sPsf)}),
          e(Inp,{label:"1-bed sale £/sqft",type:"number",value:h.oPsf,onChange:function(v){up("hra","oPsf",v);},placeholder:"£"+Math.round(oPsf)}),
          e(Inp,{label:"2-bed sale £/sqft",type:"number",value:h.tPsf,onChange:function(v){up("hra","tPsf",v);},placeholder:"£"+Math.round(tPsf)}),
          e(Inp,{label:"Floor level premium % per floor",type:"number",value:h.fl,onChange:function(v){up("hra","fl",v);},placeholder:"0.5"}),
          e(Inp,{label:"Build cost psf GIA (£) — auto: £"+bcp,type:"number",value:h.bcp,onChange:function(v){up("hra","bcp",v);},placeholder:"£"+bcp}),
          e(Inp,{label:"Developer Profit % GDV — BTR/PBSA norm 15-18%",type:"number",value:h.profitPct,onChange:function(v){up("hra","profitPct",v);},placeholder:"17.5"}),
          e(Inp,{label:"Finance Rate %",type:"number",value:h.finRate,onChange:function(v){up("hra","finRate",v);},placeholder:"8.0"}),
          e(Inp,{label:"S106/CIL per unit (£)",type:"number",value:h.s106pu,onChange:function(v){up("hra","s106pu",v);},placeholder:"10000"})
        ),
        total>0&&e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:8}},
          [{l:"Studios",units:su,sqft:ssqft,psf:Math.round(sPsf),gdv:sGdv,c:"#4A4BAE"},
           {l:"1-bed",units:ou,sqft:osqft,psf:Math.round(oPsf),gdv:oGdv,c:"#7B6CB0"},
           {l:"2-bed",units:tu,sqft:tsqft,psf:Math.round(tPsf),gdv:tGdv,c:"#2D7A65"},
           {l:"Total",units:total,sqft:Math.round(nia/Math.max(total,1)),psf:Math.round(avgPsf),gdv:hGdv,c:"#2E2F8A"}].map(function(row){
            return e("div",{key:row.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid "+row.c,borderRadius:8,padding:12}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:5}},row.l),
              e("div",{style:{fontSize:20,fontWeight:800,color:row.c,lineHeight:1,marginBottom:3}},row.units+" units"),
              e("div",{style:{fontSize:10,color:"#7278A0"}},row.sqft+" sqft avg"),
              e("div",{style:{fontSize:10,color:"#7278A0"}},"£"+row.psf+"/sqft"),
              e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A",marginTop:6,paddingTop:6,borderTop:"1px solid #DDE0ED"}},fmt(row.gdv))
            );
          })
        )
      ),
      total>0&&e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Default assumptions in use"),
        e("div",{style:{padding:"10px 14px",background:"rgba(74,75,174,0.04)",borderLeft:"3px solid #4A4BAE",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.8,marginBottom:10}},
          e("div",{style:{fontWeight:700,marginBottom:6,color:"#2E2F8A"}},"⚠ These values were assumed by Landform. Override any of them above if you have site-specific data."),
          e("table",{style:{width:"100%",fontSize:11,borderCollapse:"collapse"}},
            e("tbody",null,
              [
                ["Open-market PSF baseline", "£"+Math.round(mktSalePsf)+"/sqft", data.rlv&&data.rlv.salePsf?"User-entered in RLV":"Postcode lookup / city average"],
                ["Studio PSF", h.sPsf?"£"+h.sPsf+"/sqft (user)":"£"+Math.round(sPsf)+"/sqft", h.sPsf?"User override":"Auto: 92% of baseline"],
                ["1-bed PSF", h.oPsf?"£"+h.oPsf+"/sqft (user)":"£"+Math.round(oPsf)+"/sqft", h.oPsf?"User override":"Auto: 100% of baseline"],
                ["2-bed PSF", h.tPsf?"£"+h.tPsf+"/sqft (user)":"£"+Math.round(tPsf)+"/sqft", h.tPsf?"User override":"Auto: 108% of baseline"],
                ["Floor-level premium", fl+"% per floor (blended +"+((blend-1)*100).toFixed(1)+"% on GDV)", h.fl!==undefined&&h.fl!==""?"User entry":"Default 0.5%/floor — set to 0 to disable"],
                ["Build cost", "£"+bcp+"/sqft GIA", h.bcp?"User override":"Auto by storey count ("+storeys+" storeys)"],
                ["Developer profit margin", numOr(h.profitPct,17.5)+"% of GDV", h.profitPct?"User override":"Auto: 17.5% (BTR/PBSA norm)"],
                ["Contingency", numOr(h.contingency,6)+"% of build", h.contingency?"User override":"Auto: 6%"],
                ["Finance rate", numOr(h.finRate,8)+"% on build+fees", h.finRate?"User override":"Auto: 8% — current market"],
                ["S106/CIL per unit", "£"+numOr(h.s106pu,10000), h.s106pu?"User override":"Auto: £10,000"]
              ].map(function(r,i){
                var isUser = String(r[2]).indexOf("override")>=0 || String(r[2]).indexOf("User")>=0;
                return e("tr",{key:i,style:{borderBottom:"1px solid rgba(74,75,174,0.1)"}},
                  e("td",{style:{padding:"5px 8px 5px 0",width:"32%"}},r[0]),
                  e("td",{style:{padding:"5px 8px",fontWeight:700,color:isUser?"#2D7A65":"#9A7B3E",width:"28%"}},r[1]),
                  e("td",{style:{padding:"5px 0",fontSize:10,color:"#7278A0",fontStyle:"italic"}},r[2])
                );
              })
            )
          )
        )
      ),

      // Disclaimer banner — always visible
      total>0&&e("div",{style:{padding:"10px 14px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:6,fontSize:10,color:"#B05A35",lineHeight:1.6,marginBottom:14}},
        e("strong",null,"Indicative scenario only — not a formal valuation. "),"For commercial commitment, cross-reference with chartered surveyor (RICS Red Book) appraisal and current market evidence. Outputs depend on the inputs and assumptions shown above."
      ),

      total>0&&hGdv>0&&e("div",{style:S.card},
        e("div",{style:S.cardTitle},"High-Rise Development Appraisal"),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:12}},
          e("div",null,
            e("div",{style:{fontSize:9,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,marginBottom:10}},"GDV"),
            [[su+" studios × "+ssqft+"sqft × £"+Math.round(sPsf)+"/sqft",sGdv],[ou+" 1-beds × "+osqft+"sqft × £"+Math.round(oPsf)+"/sqft",oGdv],[tu+" 2-beds × "+tsqft+"sqft × £"+Math.round(tPsf)+"/sqft",tGdv]].map(function(row){
              return e("div",{key:row[0],style:{display:"flex",justifyContent:"space-between",fontSize:12,color:"#7278A0",padding:"4px 0",borderBottom:"1px solid #F0F0F0"}},
                e("span",null,row[0]),e("span",null,fmt(row[1]))
              );
            }),
            e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#2E2F8A",padding:"8px 0",borderTop:"1px solid #DDE0ED",marginTop:4}},
              e("span",null,"Total GDV"),e("span",null,fmt(hGdv))
            )
          ),
          e("div",null,
            e("div",{style:{fontSize:9,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,marginBottom:10}},"COSTS"),
            [["Build ("+gia2.toLocaleString()+" sqft @ £"+bcp+"/sqft)",hBc],["Prof Fees (13%)",hFees],["Contingency ("+(numOr(h.contingency,6))+"%)",hCont],["Finance ("+(numOr(h.finRate,8))+"%)",hFin],["Planning fees",hPlan],["S106/CIL",hS106],["Lifts ("+cores+" cores × "+storeys+" floors)",liftCost],["Sprinklers ("+(ews?"mandatory":"rec.")+")",sprCost],["Structural premium",structP],["Resident amenity",amenity]].concat(ewsCost>0?[["EWS1 assessment",ewsCost]]:[]).concat(g2Cost>0?[["BSA Gateway 2 & 3",g2Cost]]:[]).concat([["Dev Profit ("+(numOr(h.profitPct,17.5))+"%)",hDevProfit]]).map(function(row){
              return e("div",{key:row[0],style:{display:"flex",justifyContent:"space-between",fontSize:11,color:"#7278A0",padding:"3px 0",borderBottom:"1px solid #F0F0F0"}},
                e("span",null,row[0]),e("span",null,"("+fmt(row[1])+")")
              );
            })
          )
        ),
        e("div",{style:Object.assign({},hRlv>0?S.resultGreen:S.resultRed)},
          e("div",{style:Object.assign({},S.tag,{color:sc,marginBottom:6})},"Residual Land Value"),
          e("div",{style:Object.assign({},S.bigNum,{color:sc})},fmt(hRlv)),
          e("div",{style:{fontSize:12,color:"#7278A0",display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}},
            e("span",null,fmt(hRlv/Math.max(total,1))+" per unit"),
            e("span",null,"£"+Math.round(avgPsf)+"/sqft NIA"),
            e("span",null,"Margin: "+pct(hMargin)),
            e("span",{style:{color:sc,fontWeight:700}},hRlv>0&&hMargin>=15?"✓ Viable":"✗ Below threshold")
          )
        ),
        // v9.49 — Two ways to value a BTR/PBSA block: sell the flats, or sell the
        // whole block to an investor on its rent. Both come from one engine.
        (function(){
          if(typeof computeHRAMetrics!=="function") return null;
          var H=computeHRAMetrics(data); if(!(H.units>0)) return null;
          var box={flex:"1 1 240px",padding:"12px 14px",borderRadius:8,border:"1px solid #DDE0ED",background:"#F7F8FC"};
          var tag={fontSize:10,color:"#7278A0",fontWeight:700,marginBottom:4};
          var big={fontSize:20,fontWeight:800,color:"#2E2F8A"};
          var sub={fontSize:10,color:"#7278A0",marginTop:4,lineHeight:1.4};
          return e("div",{style:{marginTop:12}},
            e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A",marginBottom:8}},"Two ways to value this block"),
            e("div",{style:{display:"flex",gap:12,flexWrap:"wrap"}},
              e("div",{style:box},
                e("div",{style:tag},"① SELL THE FLATS INDIVIDUALLY"),
                e("div",{style:big},fmt(H.salesGdv)),
                e("div",{style:sub},"Gross sales value · max land "+fmt(H.rlv))
              ),
              e("div",{style:box},
                e("div",{style:tag},"② SELL THE BLOCK TO AN INVESTOR (ON THE RENT)"),
                e("div",{style:big},fmt(H.investmentValue)),
                e("div",{style:sub},"At "+pct(H.yield*100)+" yield on "+fmt(H.annualRentNet)+" net rent/yr · max land "+fmt(H.investmentRlv))
              )
            ),
            e("div",{style:{fontSize:10,color:"#9A7B3E",marginTop:8,fontStyle:"italic"}},"Investment value = net rent ÷ yield (assumes ~25% gross-to-net). Refine the rent and yield on the Capitalisation stage.")
          );
        })(),
        e("div",{style:{background:"rgba(176,90,53,0.06)",border:"1px solid rgba(176,90,53,0.2)",borderRadius:8,padding:"12px 16px",marginTop:10,fontSize:11,color:"#8A4020"}},
          "⚠ Est. service charge: £"+(total*2400).toLocaleString()+"/year total (£2,400/unit). Sinking fund required under BSA 2022. High service charges reduce investor pricing by ~2%."
        ),
        e(AIPanel,{user:user,up:up,stage:"hra",data:data,persistKey:"hra_high_rise_analysis__",label:"High-Rise Analysis & BSA Compliance",
          prompt:buildHonestPrompt(data,"Analyse this "+storeys+"-storey apartment scheme in "+cityName(hCity)+". "+total+" units ("+su+" studios, "+ou+" 1-bed, "+tu+" 2-bed). Value it BOTH ways: selling the flats individually (sales GDV "+fmt(hGdv)+", margin "+pct(hMargin)+") and selling the whole block to an investor on its rent (rent-capitalised value "+fmt((typeof computeHRAMetrics==="function"?computeHRAMetrics(data).investmentValue:0))+"). Structure: "+(h.structure||"RC frame")+". "+(bsa?"Higher Risk Building under BSA 2022.":"")+". Provide: 1) Which exit (individual sales vs investment sale) looks better and why, 2) Viability vs "+cityName(hCity)+" market benchmarks, 3) BSA 2022 compliance roadmap and Gateway 2/3 timeline, 4) EWS1 strategy and cladding risk, 5) Structural form recommendation for "+storeys+" storeys, 6) Service charge impact on exit pricing, 7) Mix optimisation for current demand.","hra")})
      )
    );
  }
