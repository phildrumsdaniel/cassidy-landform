// ── renderSFH  (params: LiveMarketBanner, city, data, navTo, setData, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderSFH(LiveMarketBanner, city, data, navTo, setData, up, user){
    var s=data.sfh||{};
    // v9.50 — inherit site/location details from upstream (Land Appraisal / Planning)
    // so SFH doesn't re-ask for them. SFH-specific values still override when set.
    var sfhLand=data.land||{}, sfhPlan=data.planning||{};
    var sfhCity=s.city||sfhLand.city||city;
    var sm=MKT[sfhCity]||MKT.manchester;
    var sAcres=num(s.acres)||num(sfhLand.acres); var sDph=num(s.dph)||30;
    var sHa=sAcres*0.404686; var sMaxUnits=Math.floor(sHa*sDph);
    // Sale price psf: look up from market data, NOT from rent * multiplier
    // sm.btr is monthly rent - using as psf multiplier gives wrong results
    var mktPsf=(function(){
      // 1. HIGHEST PRIORITY: live Land Registry data (if user ran RLV lookup)
      var mkt=data.market||{};
      if(num(mkt.lrPsf)>0)return num(mkt.lrPsf);
      var sc=sfhCity||city||"";
      // 2. Try PC_PSF direct postcode lookup
      var pcPsfVal=PC_PSF&&sc?(PC_PSF[sc.toUpperCase()]||PC_PSF[(sc.substring(0,3)).toUpperCase()]||0):0;
      if(pcPsfVal>0)return pcPsfVal;
      // 3. Derive from MKT city data
      if(sm&&sm.btr){
        var derived=Math.round(estSalePsfFromRent(sm.btr));
        return Math.max(150,Math.min(650,derived));
      }
      // 4. Last-resort hardcoded
      var cityPsf={taunton:260,bristol:340,bath:400,exeter:285,worcester:265,birmingham:240,manchester:295,london:650,oxford:480,cambridge:460,coventry:230,guildford:400,brighton:380,stoke:175,stafford:215,lichfield:240,telford:185,tamworth:200,wolverhampton:185,walsall:180};
      return cityPsf[sc]||220;
    })();
    var psfSource=(function(){
      var mkt=data.market||{};
      if(num(mkt.lrPsf)>0)return {src:"Land Registry live ("+(mkt.lrTotalTx||"?")+" sales, "+(mkt.lrSector||mkt.lrPostcode||"area")+")",col:"#2D7A65"};
      var sc=sfhCity||city||"";
      var pcPsfVal=PC_PSF&&sc?(PC_PSF[sc.toUpperCase()]||PC_PSF[(sc.substring(0,3)).toUpperCase()]||0):0;
      if(pcPsfVal>0)return {src:"postcode lookup "+sc.toUpperCase(),col:"#4A4BAE"};
      return {src:"city average "+cityName(sfhCity),col:"#9A7B3E"};
    })();
    // v9.28 — Apply new-build premium to existing-stock baseline (SFH is always new build)
    var sfhPc = (data.land&&data.land.postcode) || sfhCity || "";
    var nbInfo = newBuildPsf(sfhPc, mktPsf);
    var newBuildPsfEstimate = nbInfo ? nbInfo.newBuild : Math.round(mktPsf * 1.17);  // fallback default
    var basePsf=num(s.basePsf)||newBuildPsfEstimate;  // default to new-build figure, not existing
    var sBuild=num(s.buildPsf)||(sm&&sm.build)||195;
    var sProfit=numOr(s.profitPct, 17.5);
    var sFin=numOr(s.finRate, 7.5);
    var sCont=numOr(s.contingency, 5);
    var s106Pu=numOr(s.s106pu, 8000);
    var roads=numOr(s.roads, 12000);
    var totalUa=Math.max(4,Math.floor(sAcres*0.404686*(numOr(s.dph, 30))));
    var autoMix=[
      // v9.29 — Expanded mix with 1-bed terrace and 4-bed semi
      // Mix percentages target a balanced family-housing scheme suitable for AHP + private
      {type:"1-bed terrace",beds:"1",count:String(Math.round(totalUa*0.08)),sqft:"550",unitPrice:String(Math.round(550*basePsf*0.75)),psf:"",tenure:"private",ahPct:"0"},
      {type:"2-bed terrace",beds:"2",count:String(Math.round(totalUa*0.12)),sqft:"720",unitPrice:String(Math.round(720*basePsf*0.88)),psf:"",tenure:"private",ahPct:"0"},
      {type:"2-bed semi",beds:"2",count:String(Math.round(totalUa*0.10)),sqft:"820",unitPrice:String(Math.round(820*basePsf*0.90)),psf:"",tenure:"private",ahPct:"0"},
      {type:"3-bed semi",beds:"3",count:String(Math.round(totalUa*0.25)),sqft:"1020",unitPrice:String(Math.round(1020*basePsf)),psf:"",tenure:"private",ahPct:"0"},
      {type:"3-bed detached",beds:"3",count:String(Math.round(totalUa*0.18)),sqft:"1150",unitPrice:String(Math.round(1150*basePsf*1.08)),psf:"",tenure:"private",ahPct:"0"},
      {type:"4-bed semi",beds:"4",count:String(Math.round(totalUa*0.12)),sqft:"1300",unitPrice:String(Math.round(1300*basePsf*1.14)),psf:"",tenure:"private",ahPct:"0"},
      {type:"4-bed detached",beds:"4",count:String(Math.round(totalUa*0.15)),sqft:"1500",unitPrice:String(Math.round(1500*basePsf*1.18)),psf:"",tenure:"private",ahPct:"0"},
    ];
    var mix=s.mix&&s.mix.some(function(r){return num(r.count)>0;})?s.mix:autoMix;
    function updMix(i,k,v){var m=mix.slice();m[i]=Object.assign({},m[i]);m[i][k]=v;up("sfh","mix",m);}

    var houseCalcs=mix.map(function(row){
      var cnt=num(row.count); if(!cnt)return null;
      if(!(row.type||num(row.sqft)||num(row.unitPrice||row.psf)))return null;  // v9.69 — count rows even if the type label is blank
      var info=HOUSE_TYPES[row.type]||HOUSE_TYPES["3-bed semi"]||{sqft:900,adj:1.0};
      var rowSqft=numOr(row.sqft, info.sqft);
      var unitPrice=num(row.unitPrice||0);
      var sp=unitPrice&&rowSqft?unitPrice/rowSqft:(num(row.psf)||(basePsf*(info.adj||1)));
      var beds=numOr(row.beds, info.beds||3);
      // v9.40 — Include tenure so we can compute blended GDV with route discounts
      var tenure=row.tenure||"private";
      var routeDisc=(ROUTE_DISCOUNT[tenure]||ROUTE_DISCOUNT.private).pct;
      var rowRetailGdv=rowSqft*sp*cnt;
      var rowBlendedGdv=rowRetailGdv*routeDisc;
      return{type:row.type,beds:beds,count:cnt,sqft:rowSqft,sp:sp,unitPrice:unitPrice||rowSqft*sp,tenure:tenure,routeDisc:routeDisc,totalGdv:rowRetailGdv,blendedGdv:rowBlendedGdv,build:rowSqft*(num(row.buildPsf)||sBuild)*cnt};
    }).filter(Boolean);

    var totalUnits=houseCalcs.reduce(function(a,h){return a+h.count;},0);
    var retailGdv=houseCalcs.reduce(function(a,h){return a+h.totalGdv;},0);  // full retail (was: totalGdv)
    var blendedGdv=houseCalcs.reduce(function(a,h){return a+h.blendedGdv;},0);  // v9.40 — after route discounts
    var hasNonPrivateRoutes=houseCalcs.some(function(h){return h.tenure && h.tenure !== "private";});
    // v9.40 — Use blended GDV for RLV calc when scheme has AHP/pension/etc routes
    // CRITICAL: previously used retail GDV which overstated RLV by tens of £m for multi-tenure schemes
    // v9.46 — When mix rows are all-private but the scheme carries an overall AH%,
    // apply the same sfhAhFactor() the canonical engine uses, so this screen's
    // headline GDV/RLV match calcDealMetrics and the RLV screen exactly.
    var sfhAhF = (typeof sfhAhFactor === "function") ? sfhAhFactor(data) : 1;
    var ahApplied = !hasNonPrivateRoutes && sfhAhF < 1;
    var totalGdv = hasNonPrivateRoutes ? blendedGdv : (ahApplied ? retailGdv * sfhAhF : retailGdv);
    var totalBuild=houseCalcs.reduce(function(a,h){return a+h.build;},0);
    var sFeesPct=numOr(s.feesPct,12);  // v10.12 — read fees % (shared with Fin/RLV), was hard-coded 10%
    var fees=totalBuild*(sFeesPct/100); var contCost=totalBuild*(sCont/100);
    var finCost=(totalBuild+fees)*(sFin/100);
    // v9.47 — buildInclusive: if the build £/sqft already covers roads/drainage/
    // infrastructure, zero those lines so they are not double-counted. Matches
    // computeSFHMetrics exactly so screen, deal-state and AI agree.
    var buildInclusive = !!s.buildInclusive;
    var s106Total=totalUnits*s106Pu;
    var roadsTotal=buildInclusive ? 0 : totalUnits*roads;
    var infra=buildInclusive ? 0 : sAcres*53000;
    // v9.96 — disposal/marketing (agent+marketing+legal, % of GDV) so this screen's RLV
    // reconciles with the engine (computeSFHMetrics/calcDealMetrics both include it).
    var sMarketing=totalGdv*(numOr(s.marketingPct, 0)/100);
    var devProfit=totalGdv*(sProfit/100);
    var tc3=totalBuild+fees+contCost+finCost+s106Total+roadsTotal+infra+sMarketing;
    var rlv=totalGdv-tc3-devProfit;
    var rlvPu=totalUnits>0?rlv/totalUnits:0;
    var rlvAcre=sAcres>0?rlv/sAcres:0;
    var sMargin=totalGdv>0?(devProfit/totalGdv)*100:0;
    var sc=rlv>0 ? (sMargin>=15 ? "#2D7A65" : "#9A7B3E") : "#B05A35";
    var viable=rlv>0&&sMargin>=15;

    // AH scenarios — inherit the affordable % from Planning when not set on SFH
    var ahPct=num(s.ahPct)||num(sfhPlan.ahPct)||num(sfhPlan.afhPct)||0;
    var ahScenarios=ahPct>0?[
      {label:"First Homes (30% disc)",disc:0.70},
      {label:"Shared Ownership (40%)",disc:0.60},
      {label:"Affordable Rent (65%)",disc:0.65},
      {label:"Social Rent (55%)",disc:0.55},
    ].map(function(sc2){
      var ahU=Math.round(totalUnits*ahPct/100);
      var mktU=totalUnits-ahU;
      var blGdv=(ahU/Math.max(totalUnits,1))*totalGdv*sc2.disc+(mktU/Math.max(totalUnits,1))*totalGdv;
      var blRlv=blGdv-tc3-blGdv*(sProfit/100);
      return Object.assign({},sc2,{ahUnits:ahU,blGdv:blGdv,blRlv:blRlv});
    }):[];

    var sensitScens=[{l:"Pessimistic",sm:-0.10,bm:+0.12},{l:"Base",sm:0,bm:0},{l:"Optimistic",sm:+0.08,bm:-0.05}].map(function(sc3){
      var sG=totalGdv*(1+sc3.sm);
      var sB=totalBuild*(1+sc3.bm);
      var sP=sG*(sProfit/100);
      var sR=sG-sB-sB*(sFeesPct/100)-sB*(sCont/100)-(sB+sB*(sFeesPct/100))*(sFin/100)-s106Total-roadsTotal-infra-sG*(numOr(s.marketingPct,0)/100)-sP;
      return{l:sc3.l,gdv:sG,rlv:sR,rlvPu:totalUnits>0?sR/totalUnits:0,rlvAcre:sAcres>0?sR/sAcres:0};
    });

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Single Family Housing"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:20}},"Plot-by-plot residential appraisal with house type mix, roads adoption and SuDS"),

      // v9.20 — Active scenario context banner with DRIFT DETECTION + Re-sync
      // Detects when the current SFH stage values don't match the active scenario
      // (common when scenario was applied before v9.19 or fields were manually changed)
      (function(){
        if(!(data.land && data.land.appliedScenario)) return null;
        var schAh = num(data.land.scenarioAhPct || 0);
        var schS106 = num(data.land.scenarioS106pu || 0);
        var schFin = num(data.land.scenarioFinanceRate || 0);
        // Compute drift
        var driftFields = [];
        var sAh = num(s.ahPct);
        var sS106 = num(s.s106pu);
        var sFin = num(s.finRate);
        if(schAh > 0 && sAh !== schAh) driftFields.push({field:"AH%", current:sAh, scenario:schAh, key:"ahPct"});
        if(schS106 > 0 && sS106 !== schS106) driftFields.push({field:"S106/plot", current:"£"+sS106.toLocaleString(), scenario:"£"+schS106.toLocaleString(), key:"s106pu", scenarioRaw:schS106});
        if(schFin > 0 && sFin !== schFin) driftFields.push({field:"Finance", current:sFin+"%", scenario:schFin+"%", key:"finRate", scenarioRaw:schFin});

        var hasDrift = driftFields.length > 0;
        var bg = hasDrift ? "rgba(154,123,62,0.10)" : "rgba(45,122,101,0.08)";
        var bd = hasDrift ? "rgba(154,123,62,0.4)" : "rgba(45,122,101,0.3)";
        var col = hasDrift ? "#7B6432" : "#1d5446";

        return e("div",{style:{margin:"-8px 0 16px",padding:"12px 14px",background:bg,border:"1px solid "+bd,borderRadius:6,fontSize:11,color:col,lineHeight:1.5}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}},
            e("div",{style:{flex:1,minWidth:240}},
              e("strong",null,(hasDrift?"⚠ ":"✓ ")+"Scenario: "+(data.land.appliedScenarioLabel||"")+"."),
              " AH%: ",e("strong",null,schAh+"%"),
              " · S106: ",e("strong",null,"£"+schS106.toLocaleString()+"/plot"),
              " · Finance: ",e("strong",null,schFin+"%"),
              hasDrift ? e("div",{style:{marginTop:4,fontSize:11,color:"#8A7048"}},
                e("strong",null,"Drift detected: "),
                driftFields.map(function(d){return d.field+" is "+d.current+" (scenario says "+d.scenario+")";}).join(" · ")
              ) : e("span",null," — values match.")
            ),
            hasDrift && e("button",{
              onClick:function(){
                if(!confirm("Re-sync SFH stage fields with the active scenario '"+data.land.appliedScenarioLabel+"'?\n\nThis will set:\n"+driftFields.map(function(d){return "• "+d.field+": "+d.current+" → "+d.scenario;}).join("\n")+"\n\nOther fields (acres, density, sale PSF, build cost) are NOT affected.")) return;
                setData(function(prev){
                  var sfhNext = Object.assign({}, prev.sfh||{});
                  driftFields.forEach(function(d){
                    sfhNext[d.key] = d.scenarioRaw !== undefined ? d.scenarioRaw : d.scenario;
                  });
                  return Object.assign({}, prev, {sfh:sfhNext});
                });
              },
              style:{padding:"7px 13px",background:"#9A7B3E",border:"none",color:"#fff",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",flexShrink:0}
            },"Re-sync from scenario →")
          )
        );
      })(),

      // v9.29 — Tier 1 subcontractor model
      // When Cassidy subs the build to a tier-1 main contractor (Bouygues, Mace, Wates etc),
      // build cost should sit at BCIS upper-quartile (margin baked in) and we add a bond cost line.
      (function(){
        var t1 = !!(s.tier1Build);
        var btRef = BUILD_TYPES["Residential houses"];
        return e("div",{style:{margin:"-8px 0 14px",padding:"12px 14px",background:t1?"rgba(74,75,174,0.06)":"rgba(243,244,248,0.6)",border:"1px solid "+(t1?"rgba(74,75,174,0.3)":"#E0E2EC"),borderRadius:6,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}},
          e("label",{style:{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"#3A3D6A",fontWeight:600}},
            e("input",{type:"checkbox",checked:t1,onChange:function(ev){
              setData(function(prev){
                var next = Object.assign({},prev.sfh||{},{tier1Build:ev.target.checked});
                if(ev.target.checked && (!num(prev.sfh&&prev.sfh.buildPsf) || num(prev.sfh.buildPsf)===btRef.mid)){
                  next.buildPsf = btRef.hi;
                }
                return Object.assign({},prev,{sfh:next});
              });
            },style:{width:16,height:16,cursor:"pointer",accentColor:"#4A4BAE"}}),
            "🏗 Build subcontracted to Tier 1 main contractor"
          ),
          e("div",{style:{flex:1,minWidth:220,fontSize:10,color:t1?"#3A3D6A":"#7278A0",lineHeight:1.5}},
            t1
              ? e("span",null,
                  e("strong",null,"Active. "),
                  "Build cost defaulting to BCIS upper-quartile £"+btRef.hi+"/sqft (contractor margin baked in). "+
                  "Bond cost (~1.5% contract value) and 5% retention should be added to the cost stack. "+
                  "Programme certainty higher, variation risk still with Cassidy."
                )
              : "Tick if Cassidy is sponsor/developer with a Tier 1 main contractor delivering the build (typical for £20m+ schemes). Otherwise leaves the model assuming Cassidy is self-delivering."
          )
        );
      })(),

      // v9.72 — HA low-carbon spec toggle (ASHP + PV + battery, EPC B, NDSS, 12-yr NHBC).
      // Adds the housing-association build premium when Auto-cost runs.
      (function(){
        var hs = !!(s.haSpecBuild);
        return e("div",{style:{margin:"-8px 0 14px",padding:"12px 14px",background:hs?"rgba(45,122,101,0.07)":"rgba(243,244,248,0.6)",border:"1px solid "+(hs?"rgba(45,122,101,0.35)":"#E0E2EC"),borderRadius:6,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}},
          e("label",{style:{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"#3A3D6A",fontWeight:600}},
            e("input",{type:"checkbox",checked:hs,onChange:function(ev){
              setData(function(prev){ return Object.assign({},prev,{sfh:Object.assign({},prev.sfh||{},{haSpecBuild:ev.target.checked})}); });
            },style:{width:16,height:16,cursor:"pointer",accentColor:"#2D7A65"}}),
            "🌱 HA low-carbon spec (ASHP + PV + battery, EPC B, NDSS)"
          ),
          e("div",{style:{flex:1,minWidth:220,fontSize:10,color:hs?"#1d5446":"#7278A0",lineHeight:1.5}},
            hs
              ? e("span",null,e("strong",null,"Active (+"+Math.round((HA_SPEC_UPLIFT-1)*100)+"%). "),"Auto-cost adds the housing-association build premium (heat pumps, solar PV + battery, EPC-B fabric, NDSS minimum sizes, 12-yr NHBC). Confirm against the contractor's cost plan.")
              : "Tick when building to a HA brief (e.g. CHP/Delta) — the affordable units must meet it. Then press Auto-cost to apply the premium. Set the % in the Build Cost Library."
          )
        );
      })(),

      // v9.47 — Build-inclusive toggle: avoid double-counting infrastructure.
      // When the build £/sqft already includes roads/drainage/site infra, the
      // separate Roads & Sewers and Site Infra/SuDS lines are zeroed.
      (function(){
        var inc = !!s.buildInclusive;
        return e("div",{style:{margin:"-8px 0 14px",padding:"12px 14px",background:inc?"rgba(45,122,101,0.07)":"rgba(243,244,248,0.6)",border:"1px solid "+(inc?"rgba(45,122,101,0.35)":"#E0E2EC"),borderRadius:6,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}},
          e("label",{style:{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"#3A3D6A",fontWeight:600}},
            e("input",{type:"checkbox",checked:inc,onChange:function(ev){up("sfh","buildInclusive",ev.target.checked);},style:{width:16,height:16,cursor:"pointer",accentColor:"#2D7A65"}}),
            "🧱 Build £/sqft already includes roads, drainage & site infrastructure"
          ),
          e("div",{style:{flex:1,minWidth:220,fontSize:10,color:inc?"#2D7A65":"#7278A0",lineHeight:1.5}},
            inc
              ? e("span",null,e("strong",null,"On. "),"Roads/Sewers and Site Infra/SuDS lines are set to £0 — they are assumed to be within your build £/sqft, so nothing is double-counted.")
              : "Tick if your build rate is all-in (covers external works, roads, drainage, SuDS). Leave unticked to add those as separate optional cost lines below."
          )
        );
      })(),

      LiveMarketBanner(),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Site Details"),
        e("div",{style:S.grid2},
          e(CitySelect,{value:s.city||sfhLand.city||"",onChange:function(v){up("sfh","city",v);}}),
          e(Inp,{label:"Site Area (acres)",type:"number",value:(s.acres!==undefined&&s.acres!=="")?s.acres:(sfhLand.acres||""),onChange:function(v){up("sfh","acres",v);},placeholder:String(num(sfhLand.acres)||"e.g. 5.0")}),
          e(Inp,{label:"Density (dph)",type:"number",value:s.dph,onChange:function(v){up("sfh","dph",v);},placeholder:"30"}),
          e(Inp,{label:"Affordable Housing %",type:"number",value:(s.ahPct!==undefined&&s.ahPct!=="")?s.ahPct:((sfhPlan.ahPct||sfhPlan.afhPct)||""),onChange:function(v){up("sfh","ahPct",v);},placeholder:String(num(sfhPlan.ahPct)||num(sfhPlan.afhPct)||"e.g. 25")}),
          num(s.ahPct)>0 && e(Sel,{label:"AH tenure (sets the GDV haircut)",value:s.ahTenure||"ahp_affordable",onChange:function(v){up("sfh","ahTenure",v);},options:[
            {value:"ahp_social",label:"Social Rent (55% MV)"},
            {value:"ahp_affordable",label:"Affordable Rent (60% MV)"},
            {value:"ahp_so",label:"Shared Ownership (70% MV)"},
            {value:"first_homes",label:"First Homes (70% MV cap)"}
          ]}),
          e(Inp,{
            label: nbInfo
              ? "Base Sale £/sqft — new-build estimate £"+nbInfo.newBuild+" (Land Registry existing £"+nbInfo.existing+" + "+nbInfo.premiumPct+"% new-build premium)"
              : "Base Sale £/sqft — "+psfSource.src+": £"+Math.round(mktPsf),
            type:"number",value:s.basePsf,onChange:function(v){up("sfh","basePsf",v);},placeholder:"£"+Math.round(basePsf)
          }),
          e(Inp,{label:"Build £/sqft"+(sm?" — auto from "+cityName(sfhCity)+": £"+sm.build:" — typical £180-250 for houses"),type:"number",value:s.buildPsf,onChange:function(v){up("sfh","buildPsf",v);},placeholder:"£"+Math.round(sBuild)}),
          e(Inp,{label:"Developer Profit % — UK SFH norm 15-17.5%",type:"number",value:s.profitPct,onChange:function(v){up("sfh","profitPct",v);},placeholder:"17.5"}),
          e(Inp,{label:"S106 per Plot (£)",type:"number",value:s.s106pu,onChange:function(v){up("sfh","s106pu",v);},placeholder:"8000"}),
          e(Inp,{label:"Roads/Sewers per Plot (£)",type:"number",value:s.roads,onChange:function(v){up("sfh","roads",v);},placeholder:"12000 (S38/S104)"}),
          e(Inp,{label:"Finance Rate %",type:"number",value:s.finRate,onChange:function(v){up("sfh","finRate",v);},placeholder:"7.5"}),
          e(Inp,{label:"Contingency %",type:"number",value:s.contingency,onChange:function(v){up("sfh","contingency",v);},placeholder:"5"}),
          sAcres>0?e("div",{style:{background:"#EEEEF8",borderRadius:8,padding:12,fontSize:12,color:"#3A3D6A",gridColumn:"span 1"}},
            sAcres+" acres / "+sHa.toFixed(2)+" ha · ~"+sMaxUnits+" units at "+sDph+" dph"
          ):e("div",null)
        ),

        // ── Build:Sale ratio diagnostic ─────────────────────────────────────
        basePsf>0&&sBuild>0&&(function(){
          var ratio=sBuild/basePsf*100;
          var verdict=ratio<=60?{c:"#2D7A65",msg:"Strong margin — build is "+Math.round(ratio)+"% of sale PSF (SFH sweet spot 55-65%)"}:
                      ratio<=75?{c:"#9A7B3E",msg:"Tight margin — build is "+Math.round(ratio)+"% of sale PSF. Above 70% squeezes housebuilder profit toward red"}:
                      {c:"#B05A35",msg:"Structurally unviable — build is "+Math.round(ratio)+"% of sale PSF. Likely outcome: negative RLV. Check whether sale values reflect this market or build spec is too high."};
          return e("div",{style:{margin:"12px 0 0",padding:"10px 14px",background:verdict.c+"14",borderLeft:"3px solid "+verdict.c,borderRadius:6,fontSize:12,color:verdict.c,fontWeight:600}},
            "Build : Sale ratio — "+verdict.msg
          );
        })()
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"House Type Mix"),
        e("div",{style:{overflowX:"auto"}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:8,flexWrap:"wrap"}},
            e("div",{style:{fontSize:10,color:"#7278A0",fontStyle:"italic"}},"Name each type, enter sqft and Savills price — matches professional appraisal methodology"),
            e("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
            // Auto-cost the BUILD £/sqft of every row from the per-type BCIS benchmark
            // (× region × Tier-1 uplift if the Tier-1 toggle is on). A QS-grade starting point.
            e("button",{onClick:function(){
              // v9.72 — apply the HA low-carbon spec to affordable rows (they must meet the
              // HA brief); if the scheme has NO affordable rows, treat it as HA-led and apply
              // the premium scheme-wide when the toggle is on.
              var anyAff = mix.some(function(x){return /^ahp_|first_homes|rent_to_buy|dms/.test(x.tenure||"");});
              var nm=mix.map(function(r){
                var c=Object.assign({},r);
                var rowIsAff = /^ahp_|first_homes|rent_to_buy|dms/.test(r.tenure||"");
                var ha = !!s.haSpecBuild && (rowIsAff || !anyAff);
                c.buildPsf=String(typicalBuildPsf(r.type,{city:sfhCity,tier1:!!s.tier1Build,haSpec:ha}));
                return c;
              });
              up("sfh","mix",nm);
            },title:"Fill each row's build £/sqft from the BCIS-style benchmark for that house type"+(s.tier1Build?" (incl. Tier-1 main-contractor uplift)":"")+(s.haSpecBuild?" + HA low-carbon spec on affordable rows":""),style:{padding:"5px 12px",background:"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",flexShrink:0}},"🧱 Auto-cost build / type"),
            e("button",{onClick:function(){
              var totalU2=Math.floor(sAcres*0.404686*(numOr(s.dph, 30)));
              if(totalU2<1)totalU2=20;
              var newMix=[
                {type:"2-bed semi",beds:"2",count:String(Math.round(totalU2*0.10)),sqft:"820",unitPrice:String(Math.round(820*basePsf*0.88)),psf:"",tenure:"private",ahPct:"0"},
                {type:"3-bed semi",beds:"3",count:String(Math.round(totalU2*0.35)),sqft:"1020",unitPrice:String(Math.round(1020*basePsf)),psf:"",tenure:"private",ahPct:"0"},
                {type:"3-bed detached",beds:"3",count:String(Math.round(totalU2*0.30)),sqft:"1150",unitPrice:String(Math.round(1150*basePsf*1.08)),psf:"",tenure:"private",ahPct:"0"},
                {type:"4-bed detached",beds:"4",count:String(Math.round(totalU2*0.25)),sqft:"1500",unitPrice:String(Math.round(1500*basePsf*1.22)),psf:"",tenure:"private",ahPct:"0"},
              ];
              up("sfh","mix",newMix);
            },style:{padding:"5px 12px",background:"#2D7A65",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",flexShrink:0}},"⚡ Auto-fill Typical Mix")
            )
          ),
          // v9.29 — Single header row with Exit Route column added
          e("div",{style:{display:"grid",gridTemplateColumns:"160px 56px 56px 74px 88px 96px 150px 90px 70px 26px",padding:"8px 12px",background:"#2E2F8A",fontSize:9,color:"#fff",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700,borderBottom:"1px solid #DDE0ED",minWidth:930,gap:7}},
            e("span",null,"House Type"),e("span",null,"Plots"),e("span",null,"Sqft"),e("span",null,"£/sqft"),e("span",null,"Unit £"),e("span",null,"Revenue"),e("span",null,"Tenure / exit route"),e("span",null,"Hold"),e("span",null,"Build £"),e("span",null,"")
          ),
          mix.map(function(row,i){
            var info=HOUSE_TYPES[row.type]||HOUSE_TYPES["3-bed semi"];
            var sp=num(row.psf)||(basePsf*(info&&info.adj||1));
            var unitPrice=num(row.unitPrice||0);
            var effSp=unitPrice&&num(row.sqft||info&&info.sqft||850)?unitPrice/num(row.sqft||info&&info.sqft||850):sp;
            var cnt=num(row.count);
            // v9.29 — Exit-route-aware row colour: pension/AHP rows tinted differently
            var rowTint = cnt>0 ? (
              row.tenure==="pension" ? "#FFF8EC" :
              row.tenure==="ahp_social" ? "#F0F8F0" :
              row.tenure==="ahp_so" ? "#F4F9F4" :
              row.tenure==="retained_prs" ? "#F0F4FB" :
              "#FAFDF9"
            ) : "#fff";
            var defHold=/apartment|flat|maisonette|penthouse|duplex|coach/i.test(row.type||"")?"leasehold":"freehold";
            return e("div",{key:i,style:{display:"grid",gridTemplateColumns:"160px 56px 56px 74px 88px 96px 150px 90px 70px 26px",padding:"8px 12px",borderBottom:"1px solid #DDE0ED",gap:7,alignItems:"center",background:rowTint,minWidth:930}},
              e("select",{value:row.type,onChange:function(ev){updMix(i,"type",ev.target.value);},style:Object.assign({},S.select,{fontSize:11,padding:"5px 6px"})},
                Object.keys(HOUSE_TYPES).map(function(t){return e("option",{key:t,value:t},t);})
              ),
              e("input",{type:"number",value:row.count||"",onChange:function(ev){updMix(i,"count",ev.target.value);},placeholder:"0",style:Object.assign({},S.input,{fontSize:12,padding:"5px 6px"})}),
              e("span",{style:{fontSize:12,color:"#7278A0"}},info.sqft),
              e("input",{type:"number",value:row.psf||"",onChange:function(ev){updMix(i,"psf",ev.target.value);},placeholder:"£"+Math.round(sp),style:Object.assign({},S.input,{fontSize:12,padding:"5px 6px"})}),
              e("span",{style:{fontSize:12,fontWeight:600,color:"#2E2F8A"}},cnt>0?fmt(info.sqft*sp):"—"),
              e("span",{style:{fontSize:13,fontWeight:700,color:cnt>0?"#4A4BAE":"#7278A0"}},cnt>0?fmt(info.sqft*sp*cnt):"—"),
              // v9.29 — Exit Route dropdown drives capitalisation in v9.30
              e("select",{
                value:row.tenure||"private",
                onChange:function(ev){updMix(i,"tenure",ev.target.value);},
                title:"Where these units go on exit. Affects capitalisation valuation per route.",
                style:Object.assign({},S.select,{fontSize:10,padding:"5px 6px"})
              },
                e("option",{value:"private"},"Private retail sale"),
                e("option",{value:"pension"},"Pension/SFR bulk sale"),
                e("option",{value:"ahp_social"},"AHP — Social Rent (55% MV)"),
                e("option",{value:"ahp_so"},"AHP — Shared Ownership (70% MV)"),
                e("option",{value:"ahp_affordable"},"AHP — Affordable Rent (60% MV)"),
                Object.keys(ROUTE_DISCOUNT).map(function(tk){return e("option",{key:tk,value:tk},ROUTE_DISCOUNT[tk].label+" ("+Math.round(ROUTE_DISCOUNT[tk].pct*100)+"% MV)");})
              ),
              // Hold — legal tenure (leasehold typical for flats, freehold for houses)
              e("select",{value:row.hold||defHold,onChange:function(ev){updMix(i,"hold",ev.target.value);},title:"Legal tenure of the unit",style:Object.assign({},S.select,{fontSize:10,padding:"5px 6px"})},
                e("option",{value:"freehold"},"Freehold"),
                e("option",{value:"leasehold"},"Leasehold"),
                e("option",{value:"commonhold"},"Commonhold"),
                e("option",{value:"share_of_freehold"},"Share of freehold")
              ),
              // Per-row build £/sqft — e.g. a conversion costs a different rate to a new-build
              e("input",{type:"number",value:row.buildPsf||"",onChange:function(ev){updMix(i,"buildPsf",ev.target.value);},placeholder:"£"+Math.round(sBuild),title:"Build £/sqft for this unit type — leave blank to use the scheme rate (£"+Math.round(sBuild)+")",style:Object.assign({},S.input,{fontSize:11,padding:"5px 6px"})}),
              e("button",{onClick:function(){up("sfh","mix",mix.filter(function(_,j){return j!==i;}));},title:"Remove this row",style:{background:"none",border:"none",color:"#B05A35",fontSize:16,fontWeight:700,cursor:"pointer",padding:0,lineHeight:1}},"×")
            );
          }),
          totalUnits>0&&e("div",{style:{display:"grid",gridTemplateColumns:"160px 56px 56px 74px 88px 96px 150px 90px 70px 26px",padding:"10px 12px",background:"#F7F8FC",borderTop:"2px solid #DDE0ED",fontSize:12,fontWeight:700,color:"#2E2F8A",minWidth:930,gap:7}},
            e("span",null,"TOTAL"),e("span",null,totalUnits+" plots"),e("span",null,""),e("span",null,""),e("span",null,""),
            e("span",{style:{color:"#4A4BAE",fontWeight:800}},fmt(totalGdv)),
            e("span",{style:{fontSize:9,color:"#7278A0",fontWeight:600}},"see Cap →"),
            e("span",null,""),e("span",null,""),e("span",null,"")
          ),
          e("datalist",{id:"house-type-list"},
          Object.keys(HOUSE_TYPES).map(function(ht){return e("option",{key:ht,value:ht});})
        ),
        e("button",{onClick:function(){up("sfh","mix",mix.concat([{type:"3-bed semi",beds:"3",count:"",sqft:"",psf:"",unitPrice:"",tenure:"private",ahPct:"0"}]));},style:{margin:"10px 0 0",padding:"5px 12px",background:"#F7F8FC",border:"1px solid #DDE0ED",color:"#7278A0",borderRadius:4,fontSize:11,cursor:"pointer"}},
            "+ Add Row"
          )
        )
      ),
      // Exit / buyer allocation — rolls up the per-row tenure/exit routes into
      // "what's going to whom" with units and realisable value per buyer.
      totalUnits>0 && (function(){
        var alloc={}, order=[];
        houseCalcs.forEach(function(h){ var k=h.tenure||"private"; if(!alloc[k]){alloc[k]={units:0,retail:0,real:0};order.push(k);} alloc[k].units+=h.count; alloc[k].retail+=h.totalGdv; alloc[k].real+=h.blendedGdv; });
        var sumReal=order.reduce(function(a,k){return a+alloc[k].real;},0);
        var allPrivate = order.length===1 && order[0]==="private";
        var th={fontSize:9,color:"#fff",textTransform:"uppercase",letterSpacing:".05em",fontWeight:700};
        var grid="2fr 60px 60px 1fr 60px";
        return e("div",{style:S.card},
          e("div",{style:S.cardTitle},"Exit / buyer allocation"),
          e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:10,lineHeight:1.5}},"Who each home is sold to — set the “Tenure / exit route” on each row in the mix above (e.g. 10 private sale, 20 to a pension fund, 30 to a housing association). This shows the units and the realisable value going to each buyer."),
          e("div",{style:{overflowX:"auto"}},
            e("div",{style:{display:"grid",gridTemplateColumns:grid,gap:8,padding:"8px 12px",background:"#2E2F8A",borderRadius:"6px 6px 0 0",minWidth:440}},
              e("span",{style:th},"Buyer / exit route"),e("span",{style:Object.assign({},th,{textAlign:"right"})},"Units"),e("span",{style:Object.assign({},th,{textAlign:"right"})},"%"),e("span",{style:Object.assign({},th,{textAlign:"right"})},"Realisable £"),e("span",{style:Object.assign({},th,{textAlign:"right"})},"MV%")
            ),
            order.map(function(k){ var a=alloc[k], rd=ROUTE_DISCOUNT[k]||ROUTE_DISCOUNT.private;
              return e("div",{key:k,style:{display:"grid",gridTemplateColumns:grid,gap:8,padding:"7px 12px",borderBottom:"1px solid #EEF",alignItems:"center",minWidth:440,fontSize:12}},
                e("span",{style:{color:"#3A3D6A",fontWeight:600}},rd.label),
                e("span",{style:{textAlign:"right",color:"#2E2F8A",fontWeight:700}},a.units),
                e("span",{style:{textAlign:"right",color:"#7278A0"}},pct(a.units/Math.max(totalUnits,1)*100)),
                e("span",{style:{textAlign:"right",color:"#4A4BAE",fontWeight:700}},fmt(a.real)),
                e("span",{style:{textAlign:"right",color:rd.pct===1?"#2D7A65":"#B05A35",fontSize:10}},Math.round(rd.pct*100)+"%")
              );
            }),
            e("div",{style:{display:"grid",gridTemplateColumns:grid,gap:8,padding:"9px 12px",background:"#F7F8FC",borderTop:"2px solid #DDE0ED",fontWeight:800,color:"#2E2F8A",minWidth:440,fontSize:12}},
              e("span",null,"TOTAL"),e("span",{style:{textAlign:"right"}},totalUnits),e("span",null,""),e("span",{style:{textAlign:"right",color:"#4A4BAE"}},fmt(sumReal)),e("span",null,"")
            )
          ),
          allPrivate && ahPct>0 && e("div",{style:{fontSize:10,color:"#9A7B3E",marginTop:8,fontStyle:"italic",lineHeight:1.5}},"You've set affordable housing as an overall "+ahPct+"% (applied as a blended discount). To allocate specific units to a housing association, pension fund, BTR operator etc., set the “Tenure / exit route” on individual rows above.")
        );
      })(),
      totalUnits>0&&totalGdv>0&&e("div",null,
        e("div",{style:S.card},
          e("div",{style:S.cardTitle},"SFH Development Appraisal"),
          e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:12}},
            e("div",null,
              e("div",{style:{fontSize:9,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,marginBottom:10}},"INCOME"),
              houseCalcs.map(function(h){
                return e("div",{key:h.type,style:{display:"flex",justifyContent:"space-between",fontSize:12,color:"#7278A0",padding:"4px 0",borderBottom:"1px solid #F0F0F0"}},
                  e("span",null,h.count+"× "+h.type+(h.tenure&&h.tenure!=="private"?" ("+(ROUTE_DISCOUNT[h.tenure]||{}).label+")":"")),
                  e("span",null,fmt(hasNonPrivateRoutes?h.blendedGdv:h.totalGdv))
                );
              }),
              // v9.40/46 — Show both retail and blended when routes OR an overall AH% discount the GDV
              (hasNonPrivateRoutes||ahApplied) && e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,color:"#7278A0",padding:"6px 0 2px",fontStyle:"italic"}},
                e("span",null,"Full retail (if all sold private)"),
                e("span",null,fmt(retailGdv))
              ),
              (hasNonPrivateRoutes||ahApplied) && e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,color:"#B05A35",padding:"2px 0",fontWeight:600}},
                e("span",null,ahApplied&&!hasNonPrivateRoutes?"− affordable housing discount ("+ahPct+"%)":"− AHP/route discounts"),
                e("span",null,"−"+fmt(retailGdv-totalGdv))
              ),
              e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#2E2F8A",padding:"8px 0",borderTop:"1px solid #DDE0ED",marginTop:4}},
                e("span",null,((hasNonPrivateRoutes||ahApplied)?"Blended Realisable GDV":"Total GDV")+" ("+totalUnits+" plots)"),
                e("span",null,fmt(totalGdv))
              )
            ),
            e("div",null,
              e("div",{style:{fontSize:9,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,marginBottom:10}},"COSTS"),
              [["Build ("+houseCalcs.reduce(function(a,h){return a+h.sqft*h.count;},0).toLocaleString()+" sqft @ £"+sBuild+"/sqft)",totalBuild],["Prof Fees (10%)",fees],["Contingency ("+sCont+"%)",contCost],["Finance ("+sFin+"%)",finCost],["S106/CIL allowance (£"+fmtN(s106Pu)+"/unit)",s106Total],["Roads & Sewers (S38/S104)",roadsTotal],["Site Infra & SuDS",infra],["Dev Profit ("+sProfit+"%)",devProfit]].map(function(row){
                return e("div",{key:row[0],style:{display:"flex",justifyContent:"space-between",fontSize:12,color:"#7278A0",padding:"4px 0",borderBottom:"1px solid #F0F0F0"}},
                  e("span",null,row[0]),e("span",null,"("+fmt(row[1])+")")
                );
              })
            )
          ),
          e("div",{style:rlv>0 ? (viable ? S.resultGreen : S.resultAmber) : S.resultRed},
            e("div",{style:Object.assign({},S.tag,{color:sc,marginBottom:6})},"Residual Land Value"),
            e("div",{style:Object.assign({},S.bigNum,{color:sc})},fmt(rlv)),
            e("div",{style:{fontSize:12,color:"#7278A0",display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}},
              e("span",null,fmt(rlvPu)+" per plot"),
              sAcres>0&&e("span",null,fmt(rlvAcre)+" per acre"),
              e("span",null,"Margin: "+pct(sMargin)),
              e("span",{style:{color:sc,fontWeight:700}},viable?"✓ Viable":(rlv>0?"⚠ Below 15% threshold":"✗ Negative — does not stack"))
            )
          )
        ),

        // ── FULL SALES & PROFIT TABLE ───────────────────────────────────────
        totalUnits>0&&e("div",{style:{padding:"10px 14px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:6,fontSize:10,color:"#B05A35",lineHeight:1.6,marginBottom:14}},
          e("strong",null,"Indicative scenario only — not a formal valuation. "),"For commercial commitment, cross-reference with chartered surveyor (RICS Red Book) appraisal and current market evidence. Outputs depend on inputs and assumptions you've entered."
        ),
        totalUnits>0&&e("div",{style:S.card},
          e("div",{style:S.cardTitle},"Sales Revenue & Profit — Full Breakdown"),
          e("div",{style:{border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden",marginBottom:16}},
            e("div",{style:{display:"grid",gridTemplateColumns:"1.8fr 55px 80px 80px 90px 95px 100px",padding:"8px 12px",background:"#2E2F8A",fontSize:9,color:"#fff",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700}},
              e("span",null,"House Type"),e("span",null,"Plots"),e("span",null,"Size"),e("span",null,"£/sqft"),e("span",null,"Per House"),e("span",null,"Build Cost"),e("span",null,"Total Revenue")
            ),
            houseCalcs.map(function(h,i){
              var buildCostPu=h.sqft*sBuild;
              return e("div",{key:h.type+i,style:{display:"grid",gridTemplateColumns:"1.8fr 55px 80px 80px 90px 95px 100px",padding:"8px 12px",borderBottom:"1px solid #DDE0ED",fontSize:11,alignItems:"center",background:i%2===0?"#fff":"#FAFAFA"}},
                e("span",{style:{fontWeight:600,color:"#2E2F8A"}},h.type),
                e("span",{style:{color:"#4A4BAE",fontWeight:700}},h.count),
                e("span",{style:{color:"#7278A0"}},h.sqft.toLocaleString()+" sqft"),
                e("span",{style:{color:"#7278A0"}},"£"+Math.round(h.sp)),
                e("span",{style:{fontWeight:600}},fmt(h.sqft*h.sp)),
                e("span",{style:{color:"#7278A0"}},fmt(buildCostPu)),
                e("span",{style:{fontWeight:700,color:"#4A4BAE"}},fmt(h.totalGdv))
              );
            }),
            e("div",{style:{display:"grid",gridTemplateColumns:"1.8fr 55px 80px 80px 90px 95px 100px",padding:"10px 12px",background:"#F0F0F8",fontWeight:700,fontSize:12,borderTop:"2px solid #DDE0ED"}},
              e("span",{style:{color:"#2E2F8A"}},"TOTALS"),
              e("span",{style:{color:"#4A4BAE"}},totalUnits),
              e("span",null,""),e("span",null,""),e("span",null,""),
              e("span",{style:{color:"#7278A0"}},fmt(totalBuild)),
              e("span",{style:{color:"#4A4BAE",fontSize:13}},fmt(totalGdv))
            )
          ),
          e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}},
            // INCOME column
            e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:16}},
              e("div",{style:{fontSize:10,color:"#2D7A65",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:12}},"INCOME"),
              (function(){
                var agentFee=totalGdv*0.015;
                var legalSale=totalGdv*0.005;
                var marketing=Math.min(totalUnits*1500,80000);
                var netRev=totalGdv-agentFee-legalSale-marketing;
                return [
                  ["Gross Sales Revenue",totalGdv,true,"#2E2F8A"],
                  ["Estate Agent Fees (1.5%)",-agentFee,false,"#7278A0"],
                  ["Solicitor Fees (0.5%)",-legalSale,false,"#7278A0"],
                  ["Marketing & Show Home",-marketing,false,"#7278A0"],
                  ["Net Sales Revenue",netRev,true,"#2D7A65"],
                ].map(function(row){
                  return e("div",{key:row[0],style:{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #F0F0F0",fontSize:row[2]?12:11,fontWeight:row[2]?700:400}},
                    e("span",{style:{color:row[2]?row[3]:"#7278A0"}},row[0]),
                    e("span",{style:{color:row[3]}},fmt(Math.abs(row[1]))+(row[1]<0?" cr":""))
                  );
                });
              })()
            ),
            // COSTS column
            e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:16}},
              e("div",{style:{fontSize:10,color:"#B05A35",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:12}},"ALL COSTS"),
              [
                ["Land Cost (from RLV)",Math.max(0,rlv),"#7278A0"],
                ["SDLT on Land (5%)",Math.max(0,rlv)*0.05,"#7278A0"],
                ["Build Cost",totalBuild,"#7278A0"],
                ["Professional Fees ("+sFeesPct+"%)",fees,"#7278A0"],
                ["Contingency ("+sCont+"%)",contCost,"#7278A0"],
                ["Finance ("+sFin+"%)",finCost,"#7278A0"],
                ["S106 / CIL allowance (£"+fmtN(s106Pu)+"/unit)",s106Total,"#7278A0"],
                ["Roads & Sewers",roadsTotal,"#7278A0"],
                ["Infrastructure & SuDS",infra,"#7278A0"],
                ["Estate Agent + Legal + Mktg",totalGdv*0.02+Math.min(totalUnits*1500,80000),"#7278A0"],
                ["Total All Costs",tc3+Math.max(0,rlv)*1.05+totalGdv*0.02+Math.min(totalUnits*1500,80000),null,"#B05A35",true],
              ].map(function(row){
                return e("div",{key:row[0],style:{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #F0F0F0",fontSize:row[4]?12:11,fontWeight:row[4]?700:400}},
                  e("span",{style:{color:row[4]?"#B05A35":"#7278A0"}},row[0]),
                  e("span",{style:{color:row[3]||"#7278A0",fontWeight:row[4]?700:400}},fmt(row[1]))
                );
              })
            )
          ),
          // BOTTOM LINE
          (function(){
            var agentFee=totalGdv*0.015; var legalSale=totalGdv*0.005;
            var marketing=Math.min(totalUnits*1500,80000);
            var netRev=totalGdv-agentFee-legalSale-marketing;
            var totalCosts=tc3+Math.max(0,rlv)*1.05+agentFee+legalSale+marketing;
            var netProfit=netRev-totalCosts;
            var roi=totalCosts>0?(netProfit/totalCosts)*100:0;
            var profitPu=totalUnits>0?netProfit/totalUnits:0;
            var scP=netProfit>0?"#2D7A65":"#B05A35";
            return e("div",{style:{background:netProfit>0?"rgba(45,122,101,0.08)":"rgba(176,90,53,0.08)",border:"2px solid "+(netProfit>0?"#2D7A65":"#B05A35"),borderRadius:10,padding:20}},
              e("div",{style:{fontSize:11,fontWeight:700,color:scP,textAlign:"center",marginBottom:12,textTransform:"uppercase",letterSpacing:".1em"}},"Bottom Line"),
              e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:12}},
                [
                  {l:"Net Sales Revenue",v:fmt(netRev)},
                  {l:"Total All Costs",v:fmt(totalCosts)},
                  {l:"NET PROFIT",v:fmt(netProfit),c:scP,big:true},
                  {l:"ROI on Total Cost",v:pct(roi),c:scP,big:true},
                ].map(function(item){
                  return e("div",{key:item.l,style:{textAlign:"center",background:"rgba(255,255,255,0.6)",borderRadius:6,padding:12}},
                    e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}},item.l),
                    e("div",{style:{fontSize:item.big?26:16,fontWeight:800,color:item.c||"#2E2F8A"}},item.v)
                  );
                })
              ),
              e("div",{style:{display:"flex",gap:20,justifyContent:"center",flexWrap:"wrap",fontSize:12,color:"#7278A0"}},
                e("span",null,"Profit per plot: "+fmt(profitPu)),
                sAcres>0&&e("span",null,"Profit per acre: "+fmt(sAcres>0?netProfit/sAcres:0)),
                e("span",null,"Margin on GDV: "+pct(totalGdv>0?(netProfit/totalGdv)*100:0)),
                e("span",null,"Build period: ~"+Math.max(1,Math.round(totalUnits/buildRatePerYear(totalUnits,false)))+" year(s) at "+buildRatePerYear(totalUnits,false)+" plots/yr")
              ),
              e("div",{style:{display:"flex",gap:10,justifyContent:"center",marginTop:14}},
                e("button",{onClick:function(){navTo("planning");},style:{padding:"9px 20px",background:"#4A4BAE",border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"→ Planning & Viability"),
                e("button",{onClick:function(){navTo("fin");},style:{padding:"9px 20px",background:"#2D7A65",border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"→ Financial Modelling"),
                e("button",{onClick:function(){navTo("exit");},style:{padding:"9px 20px",background:"#9A7B3E",border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"→ Exit Strategy")
              )
            );
          })()
        ),

        ahScenarios.length>0&&e("div",{style:S.card},
          e("div",{style:S.cardTitle},"Affordable Housing Viability"),
          e("div",{style:{display:"flex",flexDirection:"column",gap:8}},
            ahScenarios.map(function(sc4){
              var scCol=sc4.blRlv>0?"#2D7A65":"#B05A35";
              var impact=sc4.blRlv<rlv*0.7?"⚠ Significant impact":sc4.blRlv<rlv*0.85?"Moderate impact":"Manageable";
              return e("div",{key:sc4.label,style:{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1.5fr",gap:12,padding:"10px 14px",background:"#fff",border:"1px solid #DDE0ED",borderRadius:6,alignItems:"center",fontSize:11}},
                e("span",{style:{fontWeight:600,color:"#2E2F8A"}},sc4.label),
                e("span",{style:{color:"#7278A0"}},sc4.ahUnits+" of "+totalUnits+" units"),
                e("span",{style:{color:"#7278A0"}},"GDV: "+fmt(sc4.blGdv)),
                e("span",{style:{fontWeight:700,color:scCol}},"RLV: "+fmt(sc4.blRlv)),
                e("span",{style:{fontWeight:600,color:sc4.blRlv<rlv*0.7?"#B05A35":"#7278A0",fontSize:10}},impact)
              );
            })
          )
        ),
        e("div",{style:S.card},
          e("div",{style:S.cardTitle},"Sensitivity Analysis"),
          e("div",{style:{border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden"}},
            e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",padding:"8px 14px",background:"#F7F8FC",fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",fontWeight:700,borderBottom:"1px solid #DDE0ED"}},
              e("span",null,"Scenario"),e("span",null,"GDV"),e("span",null,"RLV"),e("span",null,"RLV/Plot"),e("span",null,"RLV/Acre")
            ),
            sensitScens.map(function(sc5){
              var scC5=sc5.rlv>0?"#2D7A65":"#B05A35";
              return e("div",{key:sc5.l,style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",padding:"8px 14px",borderBottom:"1px solid #DDE0ED",fontSize:12,color:"#7278A0"}},
                e("span",{style:{fontWeight:700,color:"#2E2F8A"}},sc5.l),
                e("span",null,fmt(sc5.gdv)),
                e("span",{style:{fontWeight:600,color:scC5}},fmt(sc5.rlv)),
                e("span",null,fmt(sc5.rlvPu)),
                e("span",null,sAcres>0?"£"+Math.round(sc5.rlvAcre/1000)+"k":"—")
              );
            })
          ),
          e("div",{style:{fontSize:10,color:"#7278A0",padding:"6px 4px"}},"Pessimistic: -10% sales, +12% build costs | Optimistic: +8% sales, -5% build costs")
        ),
        e(AIPanel,{user:user,up:up,stage:"sfh",data:data,persistKey:"sfh_sfh_development_anal",label:"SFH Development Analysis",
          prompt:buildHonestPrompt(data,"Analyse this SFH development's mix and delivery. Site: "+sAcres+" acres in "+cityName(sfhCity)+", "+sDph+" dph, "+totalUnits+" plots. Mix: "+houseCalcs.map(function(h){return h.count+"x "+h.type;}).join(", ")+". AH: "+ahPct+"% required. Use the GDV, RLV and margin from the DEAL STATE above — do not restate your own. Provide: 1) Mix assessment for "+cityName(sfhCity)+" market, 2) Sale price sense check, 3) Affordable housing strategy and best tenure, 4) Infrastructure cost adequacy, 5) Phasing strategy for "+totalUnits+" plots, 6) Key planning and delivery risks.","sfh")})
      )
    );
  }
