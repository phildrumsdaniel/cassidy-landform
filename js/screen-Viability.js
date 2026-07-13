// ── renderViability  (params: city, data, gdv, lc, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderViability(city, data, gdv, lc, up, user){
    var v=data.viability||{};
    var f2=data.fin||{};
    var s2=data.sfh||{};
    var p2=data.planning||{};
    var l2=data.land||{};
    var m2=MKT[city]||MKT.manchester;
    var ap=v.appraisal||{};

    function setAp(k,val){up("viability","appraisal",Object.assign({},ap,Object.fromEntries([[k,val]])));}
    function setApN(k,val){setAp(k,val===''?null:Number(val));}

    function autoPopulate(){
      var sfhMix=s2.mix||[];
      var totalSqftMix=0;
      sfhMix.forEach(function(row){totalSqftMix+=num(row.sqft||900)*num(row.count||0);});
      var gia2=totalSqftMix>0?totalSqftMix:(num(l2.acres||0)*43560*0.65);
      var totalUnitsV=num(p2.units||0)||sfhMix.reduce(function(t,r){return t+num(r.count||0);},0)||1;
      var ahPctV=num(p2.ahPct||0)/100;
      var privU=Math.round(totalUnitsV*(1-ahPctV));
      var ahU=Math.round(totalUnitsV*ahPctV*0.9);
      var fhU=Math.round(totalUnitsV*ahPctV*0.1);
      var totalGdvV=gdv>0?gdv:0;
      // v10.87 — use the DEAL's build £/sqft (sfh.buildPsf — the same all-in rate the engine and
      // one-pager use) so this appraisal ties to them, rather than the Financial-Modelling rate
      // which can differ.
      var bpsf=num(s2.buildPsf||f2.buildPsf||m2.build||188);
      var privSqft=Math.round(gia2*0.65);var ahSqft=Math.round(gia2*0.25);var fhSqft=Math.round(gia2*0.10);
      var privBuild=Math.round(privSqft*bpsf);var ahBuild=Math.round(ahSqft*bpsf*0.95);var fhBuild=Math.round(fhSqft*bpsf*0.95);
      var acresV=num(l2.acres||0);
      var infraBase=Math.max(acresV*150000,totalUnitsV*8000);
      var s106V=num(f2.s106pu||0)*totalUnitsV||num(p2.s106||0);
      // v10.16 — land cost from the ONE engine's residual land value (same RLV as
      // Capitalisation / Tenure Mix / Exit / Dashboard), then passed land cost, then asking
      // price. Auto-Populate used to leave this BLANK, silently dropping a ~£77m land cost
      // and overstating profit/margin by ~15 points.
      // v10.87 — use computeSFHMetrics' residual (the SAME RLV the one-pager shows) so the land
      // cost here matches the briefing; fall back to calcDealMetrics, then passed/asking price.
      var engRlvV=(typeof computeSFHMetrics==="function")?num(computeSFHMetrics(data).rlv):0;
      if(!(engRlvV>0)) engRlvV=(typeof calcDealMetrics==="function")?num(calcDealMetrics(data).rlv):0;
      var landCostV=engRlvV>0?Math.round(engRlvV):(lc>0?Math.round(lc):num(l2.price||0));
      var newAp={
        siteName:l2.address||"Development Site",
        date:new Date().toISOString().substring(0,10),
        grossSiteArea:acresV,netSiteArea:Math.round(acresV*0.55*100)/100,
        privateUnits:privU,affordableUnits:ahU,firstHomesUnits:fhU,
        privateRevenueSqft:privSqft,privateRevenueTotal:Math.round(totalGdvV*0.72),
        affordableRevenueSqft:ahSqft,affordableRevenueTotal:Math.round(totalGdvV*0.20),
        firstHomesRevenueSqft:fhSqft,firstHomesRevenueTotal:Math.round(totalGdvV*0.08),
        residualLandPrice:landCostV,
        agentFeeRate:0.01,legalFeesRate:0.01,landDiscount:0.35,
        rawLandValuePerAcre:acresV>0?Math.round((landCostV||1)/(acresV*1.5)):75000,
        privateBuild:privBuild,affordableBuild:ahBuild,firstHomesBuild:fhBuild,
        enablingWorks:Math.round(infraBase*0.10),
        s278:Math.round(infraBase*0.12),onSiteHighways:Math.round(infraBase*0.18),
        footpaths:Math.round(infraBase*0.03),swDrainage:Math.round(infraBase*0.09),
        fwDrainage:Math.round(infraBase*0.06),utilities:Math.round(infraBase*0.14),
        landscape:Math.round(infraBase*0.08),overheads:Math.round((privBuild+ahBuild+fhBuild)*0.03),
        professionalFees:Math.round((privBuild+ahBuild+fhBuild)*0.09),
        plotAbnormals:Math.round((privBuild+ahBuild+fhBuild)*0.12),
        contingency:Math.round((privBuild+ahBuild+fhBuild)*0.05),
        cil:Math.round(totalGdvV*0.04),s106:Math.round(s106V),
        salesMktgRate:0.03,affordableDisposal:100000,
        developmentFinanceRate:num(f2.finRate||f2.finRatePa||8)/100,
        targetPrivateMargin:0.175,targetAffordableMargin:0.06,
        durationMonths:num(f2.programmeMths||36),
        meanMonth:num(f2.programmeMths||36)/2,stdDev:num(f2.programmeMths||36)/4,
        autoPopulated:true
      };
      // v10.87 — if the deal's build £/sqft is ALL-IN (covers professional fees, contingency,
      // roads/drainage/SuDS), those lines are ALREADY inside privateBuild etc. Adding them again
      // here double-counted the cost stack (~£230m) and flipped the profit NEGATIVE — the Detailed
      // Appraisal then contradicted the one-pager. When all-in, zero the covered lines (and CIL,
      // which the deal folds into the £/plot S106) so this screen reconciles with the engine.
      if(s2.buildInclusive){
        ["enablingWorks","s278","onSiteHighways","footpaths","swDrainage","fwDrainage","utilities","landscape","overheads","professionalFees","plotAbnormals","contingency","cil"].forEach(function(k){ newAp[k]=0; });
        newAp.salesMktgRate=0;   // marketing is a sale-side cost held at £0 in the deal
        newAp._buildInclusive=true;
      }
      up("viability","appraisal",newAp);
      // v9.99 — no blocking alert(): a native alert freezes the whole renderer in an
      // automated/embedded browser (it can't be dismissed programmatically). The on-screen
      // "estimated — verify" banners below already carry the warning.
    }

    // Calc metrics
    var vm=(function(){
      if(!ap.siteName)return null;
      var tr=(ap.privateRevenueTotal||0)+(ap.affordableRevenueTotal||0)+(ap.firstHomesRevenueTotal||0);
      var ts=(ap.privateRevenueSqft||0)+(ap.affordableRevenueSqft||0)+(ap.firstHomesRevenueSqft||0);
      var sdlt2=(function(price){if(!price||price<=0)return 0;var s=0;if(price>150000)s+=Math.min(price-150000,100000)*0.02;if(price>250000)s+=(price-250000)*0.05;return s;})(ap.residualLandPrice||0);
      var aFee=(ap.residualLandPrice||0)*(ap.agentFeeRate||0.01);
      var lFee=(ap.residualLandPrice||0)*(ap.legalFeesRate||0.01);
      var tlc=(ap.residualLandPrice||0)+sdlt2+aFee+lFee;
      var tb=(ap.privateBuild||0)+(ap.affordableBuild||0)+(ap.firstHomesBuild||0);
      var ti=(ap.enablingWorks||0)+(ap.s278||0)+(ap.onSiteHighways||0)+(ap.footpaths||0)+(ap.swDrainage||0)+(ap.fwDrainage||0)+(ap.utilities||0)+(ap.landscape||0)+(ap.overheads||0)+(ap.professionalFees||0)+(ap.plotAbnormals||0)+(ap.contingency||0);
      var sm=((ap.privateRevenueTotal||0)+(ap.firstHomesRevenueTotal||0))*(ap.salesMktgRate||0.03);
      var tdc=tb+ti+(ap.cil||0)+(ap.s106||0)+sm+(ap.affordableDisposal||0);
      var disc=(ap.residualLandPrice||0)*(ap.landDiscount||0.35);
      var devFin=(tb+ti)/2*(ap.developmentFinanceRate||0.08);
      var gp=tr-tdc-tlc-devFin;
      var sp=gp+disc;
      var mgdv=tr>0?gp/tr:0;var smgdv=tr>0?sp/tr:0;
      var tbl=tr>0?((ap.privateRevenueTotal||0)*(ap.targetPrivateMargin||0.175)+((ap.affordableRevenueTotal||0)+(ap.firstHomesRevenueTotal||0))*(ap.targetAffordableMargin||0.06))/tr:0;
      return{tr,ts,tlc,tb,ti,sm,tdc,disc,devFin,gp,sp,mgdv,smgdv,tbl,
        lpgdv:tr>0?(ap.residualLandPrice||0)/tr:0,lpna:(ap.netSiteArea||0)>0?(ap.residualLandPrice||0)/(ap.netSiteArea||1):0,
        pabpct:tb>0?(ap.plotAbnormals||0)/tb:0,ahpct:tr>0?((ap.affordableRevenueTotal||0)+(ap.firstHomesRevenueTotal||0))/tr:0,
        arpf:ts>0?tr/ts:0,abpf:ts>0?tb/ts:0};
    })();

    // Cashflow
    var vc=(function(){
      if(!vm||!(ap.durationMonths>0))return{pd:0,pm:0,fp:null,tf:0};
      var dur2=ap.durationMonths||36;var mn=ap.meanMonth||dur2/2;var sd2=ap.stdDev||dur2/4;
      var ns=[],sm2=0;for(var i=1;i<=dur2;i++){var pp=(1/(sd2*Math.sqrt(6.283)))*Math.exp(-Math.pow(i-mn,2)/(2*sd2*sd2));ns.push(pp);sm2+=pp;}
      ns=ns.map(function(x){return x/sm2;});
      var cc=0,pd=0,pm=0,fp=null,ti2=0;var mr2=(ap.developmentFinanceRate||0.08)/12;
      for(var j=0;j<dur2;j++){cc+=(vm.tr*ns[j])-(vm.tdc*ns[j])-(j===0?vm.tlc:0);if(cc<0){var int3=cc*mr2;cc+=int3;ti2+=(-int3);}if(cc<pd){pd=cc;pm=j+1;}if(fp===null&&cc>0)fp=j+1;}
      return{pd:Math.abs(pd),pm,fp,tf:ti2};
    })();

    var infraFields=[
      ["enablingWorks","Enabling works"],["s278","S278 highways"],["onSiteHighways","On-site highways"],
      ["footpaths","Footpaths"],["swDrainage","SW drainage"],["fwDrainage","FW drainage"],
      ["utilities","Utilities"],["landscape","Landscaping"],["overheads","Overheads & prelims"],
      ["professionalFees","Professional fees"],["plotAbnormals","Plot abnormals"],["contingency","Contingency"],
    ];
    var hasData=!!(ap&&ap.siteName);

    return e("div",null,
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}},
        e("div",null,
          e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Detailed Appraisal"),
          e("p",{style:{fontSize:12,color:"#7278A0"}},"Institutional-grade residual with Normal Distribution cashflow. Honest margin vs sheet margin.")
        ),
        e("div",{style:{display:"flex",gap:8}},
          e("button",{onClick:autoPopulate,style:{padding:"8px 18px",background:"#EDE84A",border:"none",borderRadius:6,color:"#1E1F5C",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"⚡ Auto-Populate from Deal"),
          hasData&&e("button",{onClick:function(){confirmToast("Clear this appraisal?",function(){up("viability","appraisal",{});},{confirmLabel:"Clear"});},style:{padding:"8px 14px",background:"none",border:"1px solid #DDE0ED",borderRadius:6,color:"#B05A35",fontSize:11,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Clear")
        )
      ),
      !hasData&&e("div",{style:{textAlign:"center",padding:"48px 24px",background:"rgba(74,75,174,0.04)",borderRadius:10,border:"1px dashed rgba(74,75,174,0.25)"}},
        e("div",{style:{fontSize:40,marginBottom:12}},"📐"),
        e("div",{style:{fontSize:15,fontWeight:700,color:"#2E2F8A",marginBottom:8}},"Start with your deal data"),
        e("div",{style:{fontSize:12,color:"#7278A0",marginBottom:16,lineHeight:1.8}},"Click Auto-Populate to pull GDV, land cost, units, build cost and programme from your current deal.",e("br"),"Infrastructure costs are estimated — review before presenting to board or lender."),
        e("button",{onClick:autoPopulate,style:{padding:"10px 28px",background:"#4A4BAE",border:"none",borderRadius:7,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"⚡ Auto-Populate from Deal Data")
      ),
      hasData&&e("div",{style:{display:"grid",gridTemplateColumns:"1fr 320px",gap:16,alignItems:"start"}},
        e("div",null,
          e("div",{style:S.card},
            e("div",{style:S.cardTitle},"Site Details"),
            e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}},
              e(Inp,{label:"Site name",value:ap.siteName||"",onChange:function(v){setAp("siteName",v);},full:true}),
              e(Inp,{label:"Date",type:"date",value:ap.date||"",onChange:function(v){setAp("date",v);}}),
              e(Inp,{label:"Gross acres",type:"number",step:"0.01",value:ap.grossSiteArea||"",onChange:function(v){setApN("grossSiteArea",v);}}),
              e(Inp,{label:"Net acres",type:"number",step:"0.01",value:ap.netSiteArea||"",onChange:function(v){setApN("netSiteArea",v);}}),
              e(Inp,{label:"Private units",type:"number",value:ap.privateUnits||"",onChange:function(v){setApN("privateUnits",v);}}),
              e(Inp,{label:"AH units",type:"number",value:ap.affordableUnits||"",onChange:function(v){setApN("affordableUnits",v);}}),
              e(Inp,{label:"First Homes units",type:"number",value:ap.firstHomesUnits||"",onChange:function(v){setApN("firstHomesUnits",v);}})
            )
          ),
          e("div",{style:S.card},
            e("div",{style:S.cardTitle},"Revenue by Tenure"),
            ap.autoPopulated&&e("div",{style:{fontSize:10,color:"#9A7B3E",padding:"6px 10px",background:"rgba(154,123,62,0.08)",borderRadius:5,marginBottom:8}},"⚠ Revenue splits estimated — verify against agent advice"),
            [["private","Private"],["affordable","Affordable Rent + SO"],["firstHomes","First Homes"]].map(function(pair){
              var k=pair[0];var lbl=pair[1];
              return e("div",{key:k,style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8,paddingBottom:8,borderBottom:"1px solid #F5F5FA"}},
                e(Inp,{label:lbl+" sqft",type:"number",value:ap[k+"RevenueSqft"]||"",onChange:function(v){setApN(k+"RevenueSqft",v);}}),
                e(Inp,{label:lbl+" total £",type:"number",value:ap[k+"RevenueTotal"]||"",onChange:function(v){setApN(k+"RevenueTotal",v);}})
              );
            })
          ),
          e("div",{style:S.card},
            e("div",{style:S.cardTitle},"Land & Acquisition"),
            e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}},
              e(Inp,{label:"Residual land price (£)",type:"number",value:ap.residualLandPrice||"",onChange:function(v){setApN("residualLandPrice",v);},full:true}),
              e(Inp,{label:"Agent fee rate",type:"number",step:"0.001",value:ap.agentFeeRate||0.01,onChange:function(v){setApN("agentFeeRate",v);}}),
              e(Inp,{label:"Legal fees rate",type:"number",step:"0.001",value:ap.legalFeesRate||0.01,onChange:function(v){setApN("legalFeesRate",v);}}),
              e(Inp,{label:"Land discount (deferred)",type:"number",step:"0.01",value:ap.landDiscount||0.35,onChange:function(v){setApN("landDiscount",v);}}),
              e(Inp,{label:"Raw land £/acre (agri)",type:"number",value:ap.rawLandValuePerAcre||75000,onChange:function(v){setApN("rawLandValuePerAcre",v);}})
            )
          ),
          e("div",{style:S.card},
            e("div",{style:S.cardTitle},"Build Cost by Tenure"),
            e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}},
              e(Inp,{label:"Private build £",type:"number",value:ap.privateBuild||"",onChange:function(v){setApN("privateBuild",v);}}),
              e(Inp,{label:"Affordable build £",type:"number",value:ap.affordableBuild||"",onChange:function(v){setApN("affordableBuild",v);}}),
              e(Inp,{label:"First Homes build £",type:"number",value:ap.firstHomesBuild||"",onChange:function(v){setApN("firstHomesBuild",v);}})
            )
          ),
          e("div",{style:S.card},
            e("div",{style:S.cardTitle},"Infrastructure & Externals"),
            ap.autoPopulated&&e("div",{style:{fontSize:10,color:"#9A7B3E",padding:"6px 10px",background:"rgba(154,123,62,0.08)",borderRadius:5,marginBottom:8}},"⚠ Infrastructure ESTIMATED from site size — replace with scheme-specific figures before presenting to board or lender"),
            e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}},
              infraFields.map(function(pair){return e(Inp,{key:pair[0],label:pair[1],type:"number",value:ap[pair[0]]||"",onChange:function(v){setApN(pair[0],v);}});})
            )
          ),
          e("div",{style:S.card},
            e("div",{style:S.cardTitle},"Planning, Finance & Profit"),
            e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}},
              e(Inp,{label:"CIL (£)",type:"number",value:ap.cil||"",onChange:function(v){setApN("cil",v);}}),
              e(Inp,{label:"S106 (£)",type:"number",value:ap.s106||"",onChange:function(v){setApN("s106",v);}}),
              e(Inp,{label:"Sales & mktg rate",type:"number",step:"0.001",value:ap.salesMktgRate||0.03,onChange:function(v){setApN("salesMktgRate",v);}}),
              e(Inp,{label:"Finance rate (pa)",type:"number",step:"0.001",value:ap.developmentFinanceRate||0.08,onChange:function(v){setApN("developmentFinanceRate",v);}}),
              e(Inp,{label:"Target private margin",type:"number",step:"0.001",value:ap.targetPrivateMargin||0.175,onChange:function(v){setApN("targetPrivateMargin",v);}}),
              e(Inp,{label:"Target AH margin",type:"number",step:"0.001",value:ap.targetAffordableMargin||0.06,onChange:function(v){setApN("targetAffordableMargin",v);}}),
              e(Inp,{label:"Programme (months)",type:"number",value:ap.durationMonths||36,onChange:function(v){setApN("durationMonths",v);}}),
              e(Inp,{label:"Mean cashflow month",type:"number",step:"0.5",value:ap.meanMonth||18,onChange:function(v){setApN("meanMonth",v);}}),
              e(Inp,{label:"Std deviation",type:"number",value:ap.stdDev||10,onChange:function(v){setApN("stdDev",v);}})
            )
          )
        ),
        vm&&e("div",{style:{position:"sticky",top:68}},
          e("div",{style:S.card},
            e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:2}},"GDV"),
            e("div",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",marginBottom:10}},fmt(vm.tr)),
            e("div",{style:{height:1,background:"#DDE0ED",marginBottom:8}}),
            [["Dev cost",fmt(vm.tdc),null],["Land cost",fmt(vm.tlc),null],["Land % GDV",pct(vm.lpgdv*100),"norm 8-15%"],["£/net acre",fmt(vm.lpna,0),null],["Dev profit",fmt(vm.gp),null],["Honest margin",pct(vm.mgdv*100),"target "+pct(vm.tbl*100)],["Sheet margin (+discount)",pct(vm.smgdv*100),"incl. addback"],["Plot abnormals",pct(vm.pabpct*100),vm.pabpct>0.15?"⚠ HIGH":"ok"],["Rev £/sqft","£"+Math.round(vm.arpf),null],["Build £/sqft","£"+Math.round(vm.abpf),null]].map(function(row){
              var warn=(row[0]==="Honest margin"&&vm.mgdv<vm.tbl)||(row[0]==="Plot abnormals"&&vm.pabpct>0.15);
              return e("div",{key:row[0],style:{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px dashed #F0F0F8",fontSize:12}},
                e("span",{style:{color:"#7278A0"}},row[0]),
                e("span",{style:{textAlign:"right"}},e("span",{style:{fontWeight:700,color:warn?"#B05A35":"#2E2F8A"}},row[1]),row[2]&&e("div",{style:{fontSize:9,color:warn?"#B05A35":"#7278A0"}},row[2]))
              );
            })
          ),
          e("div",{style:S.card},
            e("div",{style:S.cardTitle},"Cashflow"),
            e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}},
              [{l:"Peak Debt",v:fmt(vc.pd),c:"#B05A35",s:"month "+vc.pm},{l:"True Finance",v:fmt(vc.tf),c:"#9A7B3E",s:"sheet: "+fmt(vm.devFin)},{l:"Sheet Finance",v:fmt(vm.devFin),c:"#4A4BAE",s:"avg debt method"},{l:"First Positive",v:vc.fp?"m"+vc.fp:"—",c:"#2D7A65",s:"cashflow turns"}].map(function(item){
                return e("div",{key:item.l,style:{background:"#F7F8FC",borderRadius:6,padding:"8px 10px",borderTop:"2px solid "+item.c}},
                  e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:2}},item.l),
                  e("div",{style:{fontSize:14,fontWeight:800,color:item.c}},item.v),
                  e("div",{style:{fontSize:9,color:"#7278A0"}},item.s)
                );
              })
            ),
            e("div",{style:{fontSize:10,color:"#7278A0",background:"rgba(74,75,174,0.05)",borderRadius:5,padding:"7px 9px",lineHeight:1.6}},
              // v10.18 — the two figures are different METHODS, not a reconciliation error. Spell that
              // out so it stops reading as an unexplained gap (it was flagged repeatedly as a "bug").
              e("b",{style:{color:"#4A4BAE"}},"Sheet Finance "+fmt(vm.devFin)),
              " is the quick average-debt estimate (≈ half the build at the finance rate) and is what the margin above uses. ",
              e("b",{style:{color:"#9A7B3E"}},"True Finance "+fmt(vc.tf)),
              " is the full Normal-Distribution cashflow, where staged sales offset the debt — usually lower and more accurate. The "+fmt(Math.abs(vc.tf-vm.devFin))+" difference is the two methods, not an error."
            )
          ),
          e("div",{style:S.card},
            e("div",{style:S.cardTitle},"Bear / Base / Bull"),
            e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
              [{l:"🐻 Bear",ga:0.9,ca:1.1},{l:"📊 Base",ga:1.0,ca:1.0},{l:"🚀 Bull",ga:1.1,ca:0.9}].map(function(sc){
                var am=vm.tr*sc.ga>0?(vm.tr*sc.ga-vm.tdc*sc.ca-vm.tlc)/(vm.tr*sc.ga)*100:0;
                var col=am>=20?"#2D7A65":am>=15?"#9A7B3E":"#B05A35";
                return e("div",{key:sc.l,style:{background:"#F7F8FC",borderRadius:6,padding:"8px",textAlign:"center"}},
                  e("div",{style:{fontSize:11,fontWeight:700,color:"#2E2F8A",marginBottom:2}},sc.l),
                  e("div",{style:{fontSize:14,fontWeight:800,color:col}},Math.round(am)+"%"),
                  e("div",{style:{fontSize:9,color:"#7278A0"}},"margin")
                );
              })
            )
          ),
          e(AIPanel,{user:user,up:up,stage:"viability",data:data,persistKey:"viability___ai_audit_numbers",label:"⚖ AI Audit Numbers",
            system:"You are a UK residential development finance director auditing a detailed residual land appraisal. Be specific and numerate. Flag material issues clearly.",
            prompt:buildHonestPrompt(data,"Audit: "+(ap.siteName||"Site")+". Units: "+((ap.privateUnits||0)+(ap.affordableUnits||0)+(ap.firstHomesUnits||0))+". GDV: "+fmt(vm?vm.tr:0)+". Land: "+fmt(ap.residualLandPrice||0)+" ("+pct((vm?vm.lpgdv:0)*100)+" of GDV). Build: "+fmt(vm?vm.tb:0)+" at £"+Math.round(vm?vm.abpf:0)+"/sqft. Plot abnormals: "+pct((vm?vm.pabpct:0)*100)+" of build. Honest margin: "+pct((vm?vm.mgdv:0)*100)+" vs target "+pct((vm?vm.tbl:0)*100)+". Sheet margin: "+pct((vm?vm.smgdv:0)*100)+". Peak debt: "+fmt(vc?vc.pd:0)+" at month "+((vc?vc.pm:0)||0)+". True finance: "+fmt(vc?vc.tf:0)+". Infrastructure estimated: "+(ap.autoPopulated?"YES provisional":"No")+". Give 4-6 findings severity Material/Moderate/Minor."
          )})
        )
      )
    );
  }
