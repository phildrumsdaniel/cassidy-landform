// ── renderExit  (params: at, city, data, ey, gdv, hot, hotL, lc, m, memo, memoL, noi, setData, setHot, setHotL, setMemo, setMemoL, units, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderExit(at, city, data, ey, gdv, hot, hotL, lc, m, memo, memoL, noi, setData, setHot, setHotL, setMemo, setMemoL, units, up, user){
    var ex=data.exit||{};
    var gdvM=gdv/1e6;
    var matchedBuyers=BUYERS.filter(function(b){return gdvM>=b.min*0.7;});
    // hot, hotL, memo, memoL are declared at Tool component level

    async function genHoT(){
      setHotL(true); setHot("");
      try{
        var result=await callAI(user,"exit","You are a senior real estate solicitor. Generate professional Heads of Terms. Plain text, number each clause.","Generate Heads of Terms for this "+at.toUpperCase()+" asset. "+units+" units in "+cityName(city)+". GDV: "+fmt(gdv)+", NOI: "+fmt(noi)+" pa, yield: "+pct(ey*100)+", investor: "+(ex.investorType||"institutional fund")+", strategy: "+(ex.strategy||"forward fund")+". Include: purchase price, yield, payment milestones, practical completion, management, conditions precedent, break clauses, long stop date, warranties, developer obligations.");
        setHot(result);
      }catch(err){setHot("Generation failed");}
      setHotL(false);
    }

    async function genMemo(){
      setMemoL(true); setMemo("");
      try{
        var result=await callAI(user,"exit","You are a senior real estate investment banker. Write professional investment memorandum copy. Plain text only, ~400 words.","Write an Investment Memorandum executive summary for institutional investors. "+at.toUpperCase()+" asset, "+units+" units in "+cityName(city)+". GDV: "+fmt(gdv)+", NOI: "+fmt(noi)+" pa, yield: "+pct(ey*100)+". Include: investment thesis, asset overview, market context for "+cityName(city)+", financial summary, risk factors and mitigants, exit thesis and target investor profile.");
        setMemo(result);
      }catch(err){setMemo("Generation failed");}
      setMemoL(false);
    }

    // ── EXIT INTELLIGENCE CALCULATIONS ─────────────────────────────────────────
    var cityMkt=MKT[city]||MKT.manchester;
    // v9.53 — ONE net initial yield across the appraisal: the Capitalisation override if
    // set, otherwise the area benchmark. Keeps Exit in step with Capitalisation & HRA.
    // v9.98 — fall back to the area benchmark yield when the resolver returns 0 (no
    // capitalisation override and no area lookup), so the Exit summary shows e.g. 4.9%
    // instead of a bare 0.0%.
    var dealY=((typeof dealYield==="function"?dealYield(data)/100:0) || cityMkt.yield || 0.047);
    var dealYieldSourced=num(data.capitalise&&data.capitalise.targetYield)>0;
    // v9.98 — use the engine residual, not data.rlv.rlv (never stored) which fell back to
    // the land cost (the asking price), overstating "current value" in the hold-vs-sell.
    var rlvVal2=num((typeof calcDealMetrics==="function"&&calcDealMetrics(data).rlv)||(data.rlv&&data.rlv.rlv)||0);
    var units2=num(data.planning&&data.planning.units||data.rlv&&data.rlv.units||0)||units||50;
    var ahPct2=num(data.planning&&data.planning.ahPct||0);
    var acres2=num(data.land&&data.land.acres||0);
    var buildCostTotal=units2*(num(data.rlv&&data.rlv.avgSqft||850))*(num(data.rlv&&data.rlv.buildPsf||cityMkt.build||188));
    var finRate2=num(data.fin&&data.fin.finRatePa||data.rlv&&data.rlv.finRate||7.5)/100;
    var programmeMths=num(data.fin&&data.fin.programmeMths||36);

    // ── MULTI-BUYER VALUATION ENGINE ─────────────────────────────────────────
    // Same site, different buyer types = different values
    var BUYER_TYPES=[
      {
        id:"housebuilder",
        label:"National Housebuilder",
        icon:"🏡",
        color:"#2E2F8A",
        buyers:"Barratt Redrow, Persimmon, Vistry, Taylor Wimpey, Bellway",
        description:"Will pay for land with planning, take build risk, sell on open market",
        valuationMethod:"Residual — GDV minus build, fees, finance, profit margin (18-22%)",
        calc:function(){
          // Housebuilder pays residual after their margin
          var hbGdv=gdv>0?gdv:(units2*(num(data.rlv&&data.rlv.avgSqft||850))*(num(data.rlv&&data.rlv.salePsf||estSalePsfFromRent(cityMkt.btr)||280)));
          var hbBuild=buildCostTotal*1.08; // with fees
          var hbFinance=hbBuild*finRate2;
          var hbProfit=hbGdv*0.175; // 20% target
          return Math.max(0,hbGdv-hbBuild-hbFinance-hbProfit);
        },
        metrics:function(val){return[
          {l:"Valuation basis",v:"Residual land value"},
          {l:"Profit margin",v:"18-22% on GDV"},
          {l:"Build risk",v:"Taken by housebuilder"},
          {l:"Typical timescale",v:"12-18 months to exchange"},
          {l:"Payment terms",v:"Unconditional or conditional on planning"},
        ];},
        appetite:function(){
          var score=0;
          if(units2>=50&&units2<=500)score+=30;
          if(units2>=100&&units2<=300)score+=20;
          if(ahPct2<=35)score+=20;
          if(gdv>3000000)score+=20;
          if(["manchester","birmingham","leeds","bristol","oxford","cambridge","london"].indexOf(city)>=0)score+=10;
          return Math.min(score,95);
        }
      },
      {
        id:"btr_fund",
        label:"BTR Institutional Fund",
        icon:"🏢",
        color:"#4A4BAE",
        buyers:"Grainger, Legal & General, M&G, Invesco, Patrizia, Cortland",
        description:"Forward fund or forward purchase of entire scheme at a yield. Wants 150+ units in city centres.",
        valuationMethod:"Income capitalisation — NOI / target yield. Yield is king.",
        calc:function(){
          // BTR fund values on yield
          var noiVal=noi>0?noi:(units2*cityMkt.btr*12*0.72); // 72% NRI after voids/costs
          var btrYield=dealY; // v9.53 — single net initial yield (Cap override or area benchmark)
          var btrVal=noiVal/btrYield;
          // Less: construction cost + developer profit they want
          var devCost=buildCostTotal*(1+finRate2+0.08); // build + finance + fees
          var devProfit=btrVal*0.08; // 8% developer margin on forward fund
          return Math.max(0,btrVal-devCost-devProfit);
        },
        metrics:function(val){
          var noiVal=noi>0?noi:(units2*cityMkt.btr*12*0.72);
          var btrYield=dealY; // v9.53 — single net initial yield
          return[
            {l:"Capitalised value",v:fmt(noiVal/(btrYield))},
            {l:"Net initial yield",v:pct(btrYield*100)+(dealYieldSourced?" (your input)":" ("+cityName(city||"")+" benchmark)")},
            {l:"Estimated NOI pa",v:fmt(noiVal)},
            {l:"Typical units",v:"150+ preferred, 80+ minimum"},
            {l:"Forward fund premium",v:"Pays during construction"},
          ];
        },
        appetite:function(){
          var score=0;
          if(units2>=150)score+=35;else if(units2>=80)score+=15;
          if(["manchester","london","birmingham","leeds","bristol","edinburgh","glasgow"].indexOf(city)>=0)score+=25;
          if(at==="btr")score+=20;
          if(cityMkt.btr>=900)score+=10;
          if(ahPct2<=20)score+=10;
          return Math.min(score,95);
        }
      },
      {
        id:"pbsa_fund",
        label:"PBSA / Student Fund",
        icon:"🎓",
        color:"#2D7A65",
        buyers:"Unite, Empiric, Scape, Student Roost, Harrison Street, Blackstone",
        description:"Purpose-Built Student Accommodation. Proximity to university is everything. High yields.",
        valuationMethod:"Income cap at 5.5-6.5% yield. Per-bed values £35k-£80k depending on city.",
        calc:function(){
          // PBSA values on per-bed and yield
          var pbsaNoi=noi>0?noi:(units2*cityMkt.pbsa*52*0.80);
          var pbsaYield=0.06;
          var pbsaCapVal=pbsaNoi/pbsaYield;
          var devCost=buildCostTotal*(1+finRate2+0.07);
          var devMargin=pbsaCapVal*0.10;
          return Math.max(0,pbsaCapVal-devCost-devMargin);
        },
        metrics:function(val){
          var pbsaNoi=noi>0?noi:(units2*cityMkt.pbsa*52*0.80);
          return[
            {l:"Per-bed NOI",v:fmt(cityMkt.pbsa*52*0.80)+"/bed pa"},
            {l:"Target yield",v:"5.5-6.5%"},
            {l:"Per-bed value",v:"£35k-£80k depending on city"},
            {l:"Key requirement",v:"<1km to university campus"},
            {l:"Forward fund",v:"Preferred at 6.0-6.25%"},
          ];
        },
        appetite:function(){
          var score=0;
          if(at==="pbsa")score+=40;
          if(cityMkt.pbsa>300)score+=25;
          if(["manchester","london","bristol","edinburgh","leeds","nottingham","sheffield","birmingham"].indexOf(city)>=0)score+=20;
          if(units2>=100)score+=15;
          return Math.min(score,90);
        }
      },
      {
        id:"rp_ha",
        label:"Registered Provider / Housing Association",
        icon:"🤝",
        color:"#9A7B3E",
        buyers:"L&Q, Clarion, Sovereign, VIVID, Platform, Midland Heart, Places for People",
        description:"Buys affordable units at transfer price, backed by AHP grant. Values on social rent yield.",
        valuationMethod:"Transfer price: % of OMV. Social rent capitalised at 3.5-4.5%. Grant-backed.",
        calc:function(){
          // RP pays transfer price for affordable units
          var afUnits=Math.round(units2*ahPct2/100);
          var omvPerUnit=gdv>0?gdv/units2:(num(data.rlv&&data.rlv.avgSqft||850)*num(data.rlv&&data.rlv.salePsf||280));
          var transferPct=0.52; // 52% of OMV typical with AHP
          return afUnits*omvPerUnit*transferPct;
        },
        metrics:function(val){
          var afUnits=Math.round(units2*ahPct2/100);
          return[
            {l:"Affordable units",v:afUnits+" ("+ahPct2+"%)"},
            {l:"Transfer price basis",v:"45-60% of OMV with AHP grant"},
            {l:"AHP grant per unit",v:"£28k-£80k depending on region"},
            {l:"Yield basis",v:"Social rent 3.5-4.5%"},
            {l:"Payment",v:"On practical completion"},
          ];
        },
        appetite:function(){
          var score=0;
          if(ahPct2>=25)score+=40;else if(ahPct2>=15)score+=20;
          if(units2>=20)score+=20;
          if(["manchester","birmingham","london","bristol","leeds"].indexOf(city)>=0)score+=15;
          score+=25; // always relevant if AH present
          return Math.min(score,90);
        }
      },
      {
        id:"pension_fund",
        label:"Pension / Sovereign Wealth Fund",
        icon:"🏛",
        color:"#B05A35",
        buyers:"Aviva, L&G Capital, LGIM, Pension SuperFund, CPP, GIC Singapore",
        description:"Long income, inflation-linked assets. Wants 25+ year leases or stabilised BTR. Very selective.",
        valuationMethod:"Long-dated income capitalised at 4.0-5.0%. Quality of income over quantum.",
        calc:function(){
          // Pension funds want stabilised income at low yield
          var noiVal=noi>0?noi:(units2*cityMkt.btr*12*0.75);
          var pensionYield=0.045; // tighter than BTR fund
          return noiVal/pensionYield;
        },
        metrics:function(val){
          var noiVal=noi>0?noi:(units2*cityMkt.btr*12*0.75);
          return[
            {l:"Capitalised value",v:fmt(noiVal/0.045)},
            {l:"Target yield",v:"4.0-5.0% (tightest in market)"},
            {l:"Minimum ticket",v:"£50m+ typical"},
            {l:"Key requirement",v:"Stabilised, institutionally managed"},
            {l:"Best suited to",v:"Retain & refinance strategy"},
          ];
        },
        appetite:function(){
          var score=0;
          if(gdv>50000000)score+=30;
          if(at==="btr")score+=25;
          if(["london","manchester","birmingham"].indexOf(city)>=0)score+=20;
          if(units2>=200)score+=15;
          if(noi>2000000)score+=10;
          return Math.min(score,80);
        }
      },
    ];

    // Compute all buyer values
    var buyerValues=BUYER_TYPES.map(function(b){
      return Object.assign({},b,{value:b.calc(),appetite:b.appetite()});
    }).sort(function(a,b2){return b2.value-a.value;});

    var bestBuyer=buyerValues[0];
    var bestValue=bestBuyer?bestBuyer.value:0;
    // v9.97 — exclude routes that don't apply to this scheme (value £0) from the range,
    // so the "low" end is the lowest REAL exit (e.g. the RP route), not a bare £0.
    var applicableBuyers=buyerValues.filter(function(b){return b.value>0;});
    var worstValue=applicableBuyers.length?applicableBuyers[applicableBuyers.length-1].value:0;
    var valueRange=bestValue-worstValue;

    // Hold vs Sell analysis
    var currentValue=rlvVal2>0?rlvVal2:(gdv*0.88);
    var holdNOI=noi>0?noi:(units2*cityMkt.btr*12*0.72);
    var holdYield=dealY; // v9.53 — single net initial yield
    var stabilisedValue=holdNOI/holdYield;
    var holdGain=stabilisedValue-currentValue;
    var holdGainPct=currentValue>0?holdGain/currentValue*100:0;
    var holdCost=buildCostTotal*(1+finRate2);
    var holdNetReturn=stabilisedValue-holdCost;
    var refinanceValue=stabilisedValue*0.65; // 65% LTV refi
    var annualIncome=holdNOI;

    // ── Multi-year DCF hold (v10.29) — CPI-indexed rent, term-and-reversion, discounted at
    //    the SAME net initial yield (dealY). Additional basis alongside the static NOI÷yield. ──
    var dcfP=(typeof capDCFParams==="function")?capDCFParams(data):{growth:2.75,floor:1,cap:4,years:25};
    var pensionNOI=noi>0?noi:(units2*cityMkt.btr*12*0.75);   // matches the pension buyer static NOI
    var pensionDCF=(typeof computeDCFHoldValue==="function")?computeDCFHoldValue(pensionNOI,dcfP.growth,dcfP.floor,dcfP.cap,dcfP.years,dealY):{value:0,effectiveGrowth:0,terminalValue:0};
    var holdDCF=(typeof computeDCFHoldValue==="function")?computeDCFHoldValue(holdNOI,dcfP.growth,dcfP.floor,dcfP.cap,dcfP.years,dealY):{value:0,effectiveGrowth:0,terminalValue:0};

    return e("div",null,
      // ── HEADER
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}},
        e("div",null,
          e("div",{style:{fontSize:11,color:"#7278A0",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:4}},"Exit Strategy Intelligence"),
          e("h2",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",margin:"0 0 4px"}},"What is this site worth?"),
          e("p",{style:{fontSize:12,color:"#7278A0",lineHeight:1.7}},"The same site has a different value to every buyer type. Here is what each would pay - and why.")
        ),
        bestValue>0&&e("div",{style:{textAlign:"right"}},
          e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:2}},"Best buyer value"),
          e("div",{style:{fontSize:28,fontWeight:800,color:"#2D7A65"}},fmt(bestValue)),
          e("div",{style:{fontSize:11,color:"#7278A0"}},"via "+bestBuyer.label)
        )
      ),

      // ── MULTI-BUYER VALUATION COMPARISON ───────────────────────────────────
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}},"Multi-Buyer Valuation — Same Site, Different Values"),
        buyerValues.map(function(b,bi){
          var isOpen=ex["open_buyer_"+b.id];
          var isBest=bi===0;
          var barWidth=bestValue>0?Math.max(5,b.value/bestValue*100):50;
          var metrics2=b.metrics(b.value);
          if(b.id==="pension_fund"&&pensionDCF.value>0){
            metrics2=metrics2.concat([
              {l:"Static year-1 basis",v:fmt(b.value)},
              {l:dcfP.years+"-yr DCF (indexed)",v:fmt(pensionDCF.value)},
              {l:"Effective growth (collared)",v:pct(pensionDCF.effectiveGrowth*100)+" pa"},
              {l:"Terminal value (yr "+(dcfP.years+1)+")",v:fmt(pensionDCF.terminalValue)}
            ]);
          }
          return e("div",{key:b.id,style:{marginBottom:10,border:"1px solid "+(isBest?"#2D7A65":"#DDE0ED"),borderRadius:8,overflow:"hidden",opacity:b.appetite<25?0.5:1}},
            e("div",{style:{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",background:isBest?"rgba(45,122,101,0.04)":"#fff"},onClick:function(){up("exit","open_buyer_"+b.id,!isOpen);}},
              e("span",{style:{fontSize:22,flexShrink:0}},b.icon),
              e("div",{style:{flex:1}},
                e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:3}},
                  e("span",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A"}},b.label),
                  isBest&&e("span",{style:{fontSize:9,padding:"2px 8px",background:"rgba(45,122,101,0.1)",color:"#2D7A65",borderRadius:10,fontWeight:800}},"HIGHEST VALUE"),
                  e("span",{style:{fontSize:9,padding:"2px 8px",background:"rgba(74,75,174,0.07)",color:"#4A4BAE",borderRadius:10,fontWeight:700}},b.appetite+"% appetite")
                ),
                e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:6}},b.buyers),
                e("div",{style:{height:6,background:"#F0F1FA",borderRadius:3,overflow:"hidden"}},
                  e("div",{style:{width:barWidth+"%",height:"100%",background:b.color,borderRadius:3,transition:"width .5s"}})
                )
              ),
              e("div",{style:{textAlign:"right",flexShrink:0}},
                e("div",{style:{fontSize:20,fontWeight:800,color:b.color}},b.value>0?fmt(b.value):"N/A"),
                (b.id==="pension_fund"&&pensionDCF.value>0)&&e("div",{style:{fontSize:8,color:"#9A9AAE",marginTop:1,fontWeight:700,textTransform:"uppercase",letterSpacing:".04em"}},"Static year-1"),
                (b.id==="pension_fund"&&pensionDCF.value>0)&&e("div",{style:{fontSize:14,fontWeight:800,color:"#2D7A65",marginTop:3}},fmt(pensionDCF.value)),
                (b.id==="pension_fund"&&pensionDCF.value>0)&&e("div",{style:{fontSize:8,color:"#9A9AAE",fontWeight:700,textTransform:"uppercase",letterSpacing:".04em"}},dcfP.years+"-yr DCF (indexed)"),
                e("div",{style:{fontSize:9,color:"#7278A0",marginTop:2}},b.appetite>=70?"Strong appetite":b.appetite>=40?"Moderate":"Limited")
              )
            ),
            isOpen&&e("div",{style:{padding:"12px 16px",borderTop:"1px solid #DDE0ED",background:"#F7F8FC"}},
              e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:10}},
                e("div",null,
                  e("div",{style:{fontSize:10,fontWeight:800,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}},"Valuation basis"),
                  e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:6}},b.valuationMethod),
                  e("div",{style:{fontSize:10,fontWeight:800,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,marginTop:8}},"Active buyers"),
                  e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6}},b.description)
                ),
                e("div",null,
                  e("div",{style:{fontSize:10,fontWeight:800,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}},"Key metrics"),
                  metrics2.map(function(m2,mi){
                    return e("div",{key:mi,style:{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px dashed #E8E8F0",fontSize:11}},
                      e("span",{style:{color:"#7278A0"}},m2.l),
                      e("span",{style:{fontWeight:600,color:"#2E2F8A"}},m2.v)
                    );
                  })
                )
              )
            )
          );
        }),

        // Value range summary
        e("div",{style:{marginTop:14,padding:"12px 16px",background:"rgba(74,75,174,0.05)",borderRadius:8,border:"1px solid rgba(74,75,174,0.15)"}},
          e("div",{style:{fontSize:10,fontWeight:800,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}},"Value range analysis"),
          e("div",{style:{fontSize:12,color:"#3A3D6A",lineHeight:1.8}},
            "This site has a potential value range of ",
            e("strong",null,fmt(worstValue)+" to "+fmt(bestValue)),
            " depending on buyer type - a difference of ",
            e("strong",{style:{color:"#2D7A65"}},fmt(valueRange)),
            ". Targeting ",
            e("strong",null,bestBuyer.label),
            " as the primary buyer could add ",
            e("strong",{style:{color:"#2D7A65"}},fmt(valueRange)),
            " vs a simple land sale."
          )
        )
      ),

      // ── HOLD VS SELL ANALYSIS ───────────────────────────────────────────────
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:14}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:14}},"Hold vs Sell Analysis"),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}},
          [
            {l:"Sell Now (land)",v:fmt(rlvVal2||currentValue),c:"#4A4BAE",s:"Immediate exit, no build risk",icon:"→"},
            {l:"Build & Sell",v:fmt(gdv),c:"#2E2F8A",s:"GDV after build — less costs",icon:"🏗"},
            {l:"Retain & Stabilise",v:fmt(stabilisedValue),c:"#2D7A65",s:"Static year-1 · NOI ÷ yield",icon:"🏦",
              v2:holdDCF.value>0?fmt(holdDCF.value):null,v2l:dcfP.years+"-yr DCF (indexed)"},
          ].map(function(item){
            return e("div",{key:item.l,style:{background:"#F7F8FC",borderRadius:8,padding:"14px 16px",borderTop:"3px solid "+item.c,textAlign:"center"}},
              e("div",{style:{fontSize:20,marginBottom:4}},item.icon),
              e("div",{style:{fontSize:10,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",marginBottom:3}},item.l),
              e("div",{style:{fontSize:20,fontWeight:800,color:item.c}},item.v),
              item.v2&&e("div",{style:{fontSize:14,fontWeight:800,color:"#4A4BAE",marginTop:4}},item.v2),
              item.v2&&e("div",{style:{fontSize:8,color:"#9A9AAE",fontWeight:700,textTransform:"uppercase",letterSpacing:".04em"}},item.v2l),
              e("div",{style:{fontSize:10,color:"#7278A0",marginTop:4,lineHeight:1.5}},item.s)
            );
          })
        ),

        (holdDCF.value>0)&&e("div",{style:{fontSize:11,color:"#3A3D6A",background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.15)",borderRadius:8,padding:"10px 14px",marginBottom:14,lineHeight:1.6}},
          e("strong",{style:{color:"#2E2F8A"}},"Two bases for Retain & Stabilise. "),
          "The ",e("strong",null,"static year-1 basis")," (",fmt(stabilisedValue),") capitalises today's net rent at ",pct(dealY*100),". The ",
          e("strong",{style:{color:"#2D7A65"}},dcfP.years+"-year DCF (indexed)")," (",fmt(holdDCF.value),") grows the rent at a CPI-linked, collared ",pct(pensionDCF.effectiveGrowth*100),
          " pa over a ",dcfP.years,"-year hold, adds a term-and-reversion terminal value (year ",(dcfP.years+1)," rent ÷ ",pct(dealY*100),"), and discounts it all back at ",pct(dealY*100),
          " — the growth-adjusted value a long-income buyer (pension / SWF) would underwrite. Both editable on the Capitalisation stage."
        ),

        // Refinancing section
        e("div",{style:{padding:"12px 16px",background:"rgba(45,122,101,0.04)",borderRadius:8,border:"1px solid rgba(45,122,101,0.2)",marginBottom:10}},
          e("div",{style:{fontSize:10,fontWeight:800,color:"#2D7A65",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}},"Refinancing Potential — Retain & Refinance Strategy"),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
            [{l:"Stabilised value",v:fmt(stabilisedValue)},{l:"65% LTV refinance",v:fmt(refinanceValue)},{l:"Annual income (NOI)",v:fmt(annualIncome)+" pa"}].map(function(item){
              return e("div",{key:item.l,style:{textAlign:"center"}},
                e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:2}},item.l),
                e("div",{style:{fontSize:16,fontWeight:800,color:"#2D7A65"}},item.v)
              );
            })
          ),
          e("div",{style:{fontSize:11,color:"#7278A0",marginTop:8,lineHeight:1.6}},
            "Refinancing at 65% LTV releases "+fmt(refinanceValue)+" of equity while retaining the asset. Annual income of "+fmt(annualIncome)+" then services the debt with surplus cash yield."
          )
        ),

        // Yield benchmarks
        e("div",{style:{padding:"12px 16px",background:"#F7F8FC",borderRadius:8,border:"1px solid #DDE0ED"}},
          e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}},"Yield Benchmarks — "+cityName(city||"")+" Market"),
          // v9.53 — the single net initial yield this whole appraisal runs on, called out first.
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.25)",borderRadius:6,marginBottom:8}},
            e("span",{style:{fontSize:11,fontWeight:700,color:"#2D7A65"}},"Net initial yield (this deal)"),
            e("span",{style:{fontSize:13,fontWeight:800,color:"#2D7A65"}},pct(dealY*100)+(dealYieldSourced?" · your input":" · "+cityName(city||"")+" benchmark"))
          ),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}},
            [
              {l:"BTR institutional (this deal)",v:pct(dealY*100)},
              {l:"PBSA",v:"5.5-6.5%"},
              {l:"Pension / sovereign",v:"4.0-5.0%"},
              {l:"Social rent (RP)",v:"3.5-4.5%"},
              {l:"Market BTR rent",v:"£"+cityMkt.btr+"/month"},
              {l:"PBSA rent/week",v:"£"+cityMkt.pbsa+"/week"},
            ].map(function(item){
              return e("div",{key:item.l,style:{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px dashed #E8E8F0",fontSize:11}},
                e("span",{style:{color:"#7278A0"}},item.l),
                e("span",{style:{fontWeight:700,color:"#2E2F8A"}},item.v)
              );
            })
          )
        )
      ),

      // ── AI EXIT STRATEGY RECOMMENDATION ────────────────────────────────────
      e("div",{style:{marginBottom:14}},
        e(AIPanel,{user:user,up:up,stage:"exit",data:data,persistKey:"exit_intelligence",
          label:"🧠 AI Exit Strategy Recommendation",
          system:"You are a senior UK real estate investment director advising on exit strategy for a residential development. Be specific, numerate and commercially direct.",
          prompt:buildHonestPrompt(data,"Analyse the optimal exit strategy for this site. Site: "+(data.land&&data.land.address||"development site")+", "+cityName(city||"")+". GDV: "+fmt(gdv)+". Units: "+units2+". AH%: "+ahPct2+"%. Asset type: "+at+". Market rent: £"+cityMkt.btr+"/month BTR. Yield benchmark: "+pct((cityMkt.yield||0.055)*100)+". Stabilised value: "+fmt(stabilisedValue)+". Refinance potential (65% LTV): "+fmt(refinanceValue)+". Buyer valuations: "+buyerValues.slice(0,3).map(function(b){return b.label+": "+fmt(b.value)+" ("+b.appetite+"% appetite)";}).join(", ")+". Provide: 1) Recommended primary exit route with rationale, 2) Recommended buyer type and why, 3) Hold vs sell recommendation with numbers, 4) Refinancing potential assessment, 5) Critical negotiation points and red flags.","exit"
        )})
      ),

      // ── EXISTING EXIT PARAMS (kept from original) ───────────────────────────
      e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10,marginTop:4}},"Exit Parameters & Documents"),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Exit Parameters"),
        e("div",{style:S.grid2},
          e(Sel,{label:"Exit Strategy",value:ex.strategy,onChange:function(v){up("exit","strategy",v);},
            options:[
              {value:"",label:"Select..."},
              {value:"plot_sales",label:"Plot Sales (SFH) — sell each house individually on open market"},
              {value:"bulk_sale_ha",label:"Bulk Sale to Housing Association — affordable element"},
              {value:"forward_fund",label:"Forward Fund (BTR/PBSA) — pre-construction to institution"},
              {value:"forward_sale",label:"Forward Sale — sell post-consent, before build"},
              {value:"stabilised",label:"Stabilised Sale — sell post-occupancy at full yield"},
              {value:"retain",label:"Retain & Refinance — hold as long term income"},
              {value:"phased",label:"Phased Exit — sell plots in phases over 2-4 years"},
            ]}),
          e(Inp,{label:"Target Exit Yield (%) — net initial yield: "+pct(dealY*100),type:"number",value:ex.exitYield,onChange:function(v){up("exit","exitYield",v);},placeholder:(dealY*100).toFixed(2)}),
          e(Sel,{label:"Target Investor Type",value:ex.investorType,onChange:function(v){up("exit","investorType",v);},
            options:[{value:"",label:"Select..."},{value:"pension_fund",label:"UK Pension Fund"},{value:"sovereign_wealth",label:"Sovereign Wealth"},{value:"reit",label:"Listed REIT"},{value:"private_equity",label:"Private Equity"},{value:"asset_manager",label:"Specialist Asset Manager"},{value:"family_office",label:"Family Office"}]}),
          e(Inp,{label:"Transaction Agent",value:ex.agent,onChange:function(v){up("exit","agent",v);},placeholder:"e.g. CBRE, JLL, Savills"})
        ),
        units>0&&e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:8}},
          [{l:"GDV",v:fmt(gdv)},{l:"NOI (pa)",v:fmt(noi)},{l:"Exit Yield",v:pct(dealY*100)},{l:"Price per "+(at==="pbsa"?"Bed":"Unit"),v:units>0?fmt(gdv/units):"—"}].map(function(item){
            return e("div",{key:item.l,style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,padding:12}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:4}},item.l),
              e("div",{style:{fontSize:18,fontWeight:700,color:"#4A4BAE"}},item.v)
            );
          })
        )
      ),
      at==="sfh"&&ex.strategy==="plot_sales"&&(function(){
        var sfh2=data.sfh||{};
        var sfhUnits=num(sfh2.dph&&sfh2.acres?Math.floor(num(sfh2.acres)*0.404686*num(sfh2.dph)):0);
        var sfhGdv=num(sfh2.totalGdv||0);
        var absorptionYrs=sfhUnits>0?Math.ceil(sfhUnits/40):1;
        return sfhUnits>0?e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #2D7A65"})},
          e("div",{style:S.cardTitle},"SFH Plot Sales — Clean Exit"),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}},
            [{l:"Total Plots",v:sfhUnits+" houses"},{l:"Absorption Rate",v:"~40 plots/yr"},{l:"Build & Sell Period",v:absorptionYrs+" year(s)"},{l:"Target Completion",v:new Date(Date.now()+(absorptionYrs*365*24*60*60*1000)).getFullYear()+""}].map(function(item){
              return e("div",{key:item.l,style:{background:"rgba(45,122,101,0.06)",border:"1px solid rgba(45,122,101,0.2)",borderRadius:6,padding:12}},
                e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:3}},item.l),
                e("div",{style:{fontSize:15,fontWeight:700,color:"#2D7A65"}},item.v)
              );
            })
          ),
          e("div",{style:{fontSize:12,color:"#3A3D6A",lineHeight:1.8,background:"#F7F8FC",borderRadius:8,padding:14}},
            e("div",{style:{fontWeight:700,marginBottom:8}},"SFH Clean Exit — How It Works:"),
            e("div",null,"Phase 1 — Planning: Obtain detailed planning consent. Discharge pre-commencement conditions. Agree S106 and CIL."),
            e("br"),
            e("div",null,"Phase 2 — Infrastructure: Build roads, sewers and site infrastructure. Get S38/S104 agreements signed. Adopt roads."),
            e("br"),
            e("div",null,"Phase 3 — Build & Release: Build in phases of 10-20 plots. Release to market in tranches. Appoint sales agent."),
            e("br"),
            e("div",null,"Phase 4 — Sales: Open show home. Sell "+Math.min(40,sfhUnits)+" plots in year 1. Target price: as per your SFH appraisal."),
            e("br"),
            e("div",null,"Phase 5 — Clean Exit: Final plots sold. S106 obligations discharged. Site roads adopted. Company wound up or recycled into next deal.")
          )
        ):null;
      })(),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Active Institutional Buyers — "+at.toUpperCase()),
        e("div",{style:{border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden"}},
          e("div",{style:{display:"grid",gridTemplateColumns:"1.5fr 70px 80px 70px 70px",padding:"8px 14px",background:"#F7F8FC",fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",fontWeight:700,borderBottom:"1px solid #DDE0ED"}},
            e("span",null,"Investor"),e("span",null,"Type"),e("span",null,"Focus"),e("span",null,"Min Lot"),e("span",null,"Status")
          ),
          (matchedBuyers.length>0?matchedBuyers:BUYERS).map(function(b){
            return e("div",{key:b.name,style:{display:"grid",gridTemplateColumns:"1.5fr 70px 80px 70px 70px",padding:"8px 14px",borderBottom:"1px solid #DDE0ED",fontSize:11,color:"#7278A0",alignItems:"center"}},
              e("span",{style:{fontWeight:600,color:"#2E2F8A"}},b.name),
              e("span",{style:{color:"#4A4BAE",fontWeight:700}},b.type),
              e("span",null,b.status),
              e("span",null,"£"+b.min+"m+"),
              e("span",{style:{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:3,background:b.status==="Active"?"rgba(45,122,101,0.12)":"rgba(154,123,62,0.12)",color:b.status==="Active"?"#2D7A65":"#9A7B3E"}},b.status)
            );
          })
        )
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Heads of Terms Generator"),
        e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:12}},"Generate market-standard HoTs from your deal data."),
        e("button",{onClick:genHoT,disabled:hotL,style:Object.assign({},S.btn,{opacity:hotL?0.6:1,cursor:hotL?"not-allowed":"pointer"})},hotL?"⏳ Generating...":"📄 Generate Heads of Terms"),
        hot&&e("div",{style:{background:"#F8F8FE",border:"1px solid #DDE0ED",borderLeft:"3px solid #4A4BAE",borderRadius:8,padding:"16px 20px",marginTop:12}},
          e("pre",{style:{fontSize:12,lineHeight:1.8,color:"#3A3D6A",whiteSpace:"pre-wrap",fontFamily:"DM Sans,sans-serif"}},hot)
        )
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Investment Memorandum"),
        e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:12}},"Generate an institutional-grade IM executive summary."),
        e("button",{onClick:genMemo,disabled:memoL,style:Object.assign({},S.btn,{opacity:memoL?0.6:1,cursor:memoL?"not-allowed":"pointer"})},memoL?"⏳ Writing...":"📋 Generate Investment Memo"),
        memo&&e("div",{style:{background:"#F8F8FE",border:"1px solid #DDE0ED",borderLeft:"3px solid #4A4BAE",borderRadius:8,padding:"16px 20px",marginTop:12}},
          e("pre",{style:{fontSize:12,lineHeight:1.8,color:"#3A3D6A",whiteSpace:"pre-wrap",fontFamily:"DM Sans,sans-serif"}},memo)
        )
      ),
      e("div",{style:S.card},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
          e("div",{style:S.cardTitle},"Housing Association / RP Offer Tracker"),
          e("div",{style:{fontSize:10,color:"#7278A0"}},"Record actual RP offers — matches professional appraisal methodology")
        ),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:12}},"Track offers from Registered Providers. Golden Brick = land and infrastructure ready for RP to build. Turnkey = completed units handed over. Enter actual £ offers."),
        e("div",{style:{border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden",marginBottom:10}},
          e("div",{style:{display:"grid",gridTemplateColumns:"1.5fr 70px 110px 110px 70px 110px",padding:"7px 12px",background:"#2E2F8A",fontSize:9,color:"#fff",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700}},
            e("span",null,"RP / Housing Association"),
            e("span",null,"Units"),
            e("span",null,"Golden Brick (£)"),
            e("span",null,"Turnkey (£)"),
            e("span",null,"£/sqft"),
            e("span",null,"Status")
          ),
          (function(){
            var rpOffers=data.rpOffers||[
              {rp:"Paradigm",units:"",gb:"",tk:"",status:"tbc"},
              {rp:"Fairhive",units:"",gb:"",tk:"",status:"tbc"},
              {rp:"Hightown",units:"",gb:"",tk:"",status:"tbc"},
              {rp:"Vivid",units:"",gb:"",tk:"",status:"tbc"},
              {rp:"Home Group",units:"",gb:"",tk:"",status:"tbc"},
              {rp:"Peabody",units:"",gb:"",tk:"",status:"tbc"},
              {rp:"MTVHA",units:"",gb:"",tk:"",status:"tbc"},
              {rp:"Other RP",units:"",gb:"",tk:"",status:"tbc"},
            ];
            function updRP(i,k,v){
              var arr=rpOffers.slice();
              arr[i]=Object.assign({},arr[i]);
              arr[i][k]=v;
              setData(function(d){return Object.assign({},d,{rpOffers:arr});});
            }
            var sColors={"offered":"#2D7A65","declined":"#B05A35","approached":"#9A7B3E","tbc":"#7278A0","negotiating":"#4A4BAE","preferred":"#2D7A65"};
            return rpOffers.map(function(rp,i){
              var gbVal=num(rp.gb||0);
              var tkVal=num(rp.tk||0);
              var bestOffer=Math.max(gbVal,tkVal);
              var ahSqft=10000; // estimate
              var psfVal=bestOffer>0&&ahSqft>0?Math.round(bestOffer/ahSqft):0;
              return e("div",{key:i,style:{display:"grid",gridTemplateColumns:"1.5fr 70px 110px 110px 70px 110px",padding:"6px 12px",background:i%2===0?"#fff":"#FAFAFA",borderBottom:"1px solid #DDE0ED",alignItems:"center",fontSize:11}},
                e("input",{type:"text",value:rp.rp||"",onChange:function(ev){updRP(i,"rp",ev.target.value);},style:Object.assign({},S.input,{margin:0,padding:"4px 6px",fontSize:11})}),
                e("input",{type:"number",value:rp.units||"",onChange:function(ev){updRP(i,"units",ev.target.value);},placeholder:"0",style:Object.assign({},S.input,{margin:0,padding:"4px 5px",fontSize:11})}),
                e("input",{type:"number",value:rp.gb||"",onChange:function(ev){updRP(i,"gb",ev.target.value);},placeholder:"e.g. 10300000",style:Object.assign({},S.input,{margin:0,padding:"4px 5px",fontSize:11})}),
                e("input",{type:"number",value:rp.tk||"",onChange:function(ev){updRP(i,"tk",ev.target.value);},placeholder:"e.g. 10800000",style:Object.assign({},S.input,{margin:0,padding:"4px 5px",fontSize:11})}),
                e("span",{style:{fontSize:10,color:"#7278A0"}},psfVal>0?"£"+psfVal:"-"),
                e("select",{value:rp.status||"tbc",onChange:function(ev){updRP(i,"status",ev.target.value);},style:Object.assign({},S.select,{margin:0,padding:"3px 5px",fontSize:10,color:sColors[rp.status||"tbc"]})},
                  e("option",{value:"tbc"},"TBC"),
                  e("option",{value:"approached"},"Approached"),
                  e("option",{value:"offered"},"Offered"),
                  e("option",{value:"declined"},"Declined"),
                  e("option",{value:"negotiating"},"Negotiating"),
                  e("option",{value:"preferred"},"Preferred Bidder")
                )
              );
            });
          })()
        ),
        e("div",{style:{fontSize:10,color:"#7278A0",fontStyle:"italic"}},"Reference: track actual RP offers received — Golden Brick and Turnkey pricing per housing association.")
      ),

      e(AIPanel,{user:user,up:up,stage:"exit",data:data,persistKey:"exit_exit_strategy_analys",label:"Exit Strategy Analysis",
        prompt:buildHonestPrompt(data,"Exit strategy for "+at.toUpperCase()+" in "+cityName(city)+". Strategy: "+(ex.strategy||"not set")+", GDV: "+fmt(gdv)+", NOI: "+fmt(noi)+" pa, yield: "+pct(ey*100)+", investor type: "+(ex.investorType||"not set")+". Provide: 1) Optimal exit route and timing recommendation, 2) Top 5 specific buyers to approach with rationale, 3) Key investor DD requirements and how to prepare, 4) Critical negotiation points and red lines, 5) Risk factors that could compress exit pricing by >10 bps.","exit")})
    );
  }
