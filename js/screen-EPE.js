// ── renderEPE  (params: LiveMarketBanner, city, data, m, mergeRespectingCompletedStages, navTo, setData, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderEPE(LiveMarketBanner, city, data, m, mergeRespectingCompletedStages, navTo, setData, up, user){
    var ep=data.epe||{};
    var pcData=ep.postcode?lookupPostcode(ep.postcode):null;
    var eCity=(pcData&&pcData.city)||ep.city||"manchester";
    var em=MKT[eCity]||MKT.manchester;
    var salePsf=num(ep.salePsf)||(pcData&&pcData.salePsf)||280; // £/sqft — typical UK house £200-600/sqft
    var propSqft=num(ep.propSqft)||900;
    var condMod={excellent:1.15,good:1.05,average:1.0,poor:0.88,derelict:0.70}[ep.condition]||1.0;
    var gLen=num(ep.gLen); var gWid=num(ep.gWid); var gardenSqft=gLen*gWid;
    // Garden/plot value uses land rate, not house rate
    // Based on local land market - CV6 Coundon: £35-70/sqft plot
    var localLandPsf = lookupLandPsf(ep.postcode||"");
    var gPsf = localLandPsf; // £/sqft of garden/plot area
    var aspMod={south:1.08,south_west:1.05,west:1.02,east:1.0,north:0.95}[ep.aspect]||1.0;
    var gVal=gardenSqft>0?Math.round((Math.min(gardenSqft,500)*gPsf+Math.max(0,Math.min(gardenSqft-500,500))*gPsf*0.65+Math.max(0,gardenSqft-1000)*gPsf*0.3)*aspMod):0;
    var PARK_MODS={
      triple_garage:0.15,double_garage:0.10,single_garage:0.06,
      triple_carport:0.10,double_carport:0.07,single_carport:0.04,
      balcony:0.04,garage_conversion:0.03,annex:0.06,
      drive_1:0.02,drive_2:0.04,drive_3:0.05,drive_4:0.06,drive_5:0.07,drive_6plus:0.08,
      on_street_2plus:0.01,on_street_1:0.00,cpz:-0.03,permit_only:-0.02,no_parking:-0.05
    };
    var parkBonus=(ep.parkingFeatures||[]).reduce(function(a,f){return a+(PARK_MODS[f]||0);},0);
    var outbuildingMod={small_shed:0.01,large_outbuilding:0.03,log_cabin:0.05,annex_detached:0.08,barn:0.06}[ep.outbuildings]||0;
    var balconyMod={juliet:0.01,small:0.02,large:0.04,roof_terrace:0.06,inset:0.03}[ep.balconyType]||0;
    var poolMod={outdoor:0.04,indoor:0.08,hot_tub:0.02}[ep.pool]||0;
    var storeysMod={
      "1":-0.05,"1.5":0.00,"2":0.00,"2.5":0.03,"3":0.04,"4":0.03,"5plus":0.02
    }[ep.storeys]||0;
    // Note: bungalows (1 storey) sell at premium per sqft but often have less floor area
    // Room in roof / dormer adds usable space premium
    var parkMod=1+parkBonus+outbuildingMod+balconyMod+poolMod+storeysMod;
    var houseVal=Math.round(propSqft*salePsf*condMod);
    var currentVal=Math.round((houseVal+gVal)*parkMod);
    var newUnits=num(ep.newUnits); var newSqft=num(ep.newSqft)||900; var newPsf=num(ep.newPsf)||salePsf;
    var newBuildPsf=num(ep.buildPsf)||(m&&m.build)||195; var profitPct=num(ep.profitPct)||17.5;
    var newGdv=newUnits*newSqft*newPsf;
    var newBuild=newUnits*newSqft*newBuildPsf;
    var demolish=15000+(gardenSqft>5000?8000:0);
    var fees=newBuild*0.10; var fin=(newBuild+fees)*(num(ep.finRate)||7.5)/100;
    var devProfit=newGdv*(profitPct/100);
    var tc2=newBuild+fees+fin+newUnits*(num(ep.s106pu)||8000)+demolish;
    var devRlv=newGdv-tc2-devProfit;
    var uplift=devRlv-currentVal;
    var viable=devRlv>currentVal*1.1;
    var sc=uplift>0?"#2D7A65":"#B05A35";

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Property Evaluator"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:20}},"Current value as standing vs development potential — bungalows, pubs, offices, large plots"),
      LiveMarketBanner(),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Step 1 — Existing Property"),
        e("div",{style:S.grid2},
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Postcode"),
            e("input",{value:ep.postcode||"",onChange:function(ev){up("epe","postcode",ev.target.value.toUpperCase());},
              placeholder:"e.g. CV6 2DL",style:Object.assign({},S.input,{textTransform:"uppercase"})}),
            pcData&&e("div",{style:{fontSize:10,color:"#2D7A65",marginTop:2}},"✓ Area identified: "+cityName(pcData.city)+(pcData.salePsf?" · Benchmark: £"+pcData.salePsf+"/sqft":"")),
            ep.postcode&&ep.postcode.length>=5&&!num((data.market||{}).lrPsf)&&e("button",{
              onClick:function(){
                // Mirror EPE postcode into RLV and trigger LR fetch
                up("rlv","postcode",ep.postcode);
                up("rlv","lrAutoTrigger",true);
                navTo("rlv");
              },
              style:{marginTop:6,padding:"6px 12px",background:"#2D7A65",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },"📡 Fetch Live Land Registry Data")
          ),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Street Address (type manually)"),
            e("input",{value:ep.streetAddress||"",onChange:function(ev){up("epe","streetAddress",ev.target.value);},
              placeholder:pcData?"e.g. 120 Scotts Lane, Coventry":"Enter postcode first, then type address",
              style:S.input}),
            e("div",{style:{fontSize:9,color:"#A0A4C0"}},"Type your house number and street name above")
          ),
          e(CitySelect,{label:"City / Area"+(pcData&&pcData.city?" — auto-detected from postcode":""),value:ep.city||eCity,onChange:function(v){up("epe","city",v);}}),
          pcData&&e("div",{style:{gridColumn:"span 2",background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.15)",borderRadius:6,padding:"10px 14px",fontSize:11,color:"#3A3D6A",lineHeight:1.7}},
            e("strong",null,"Two different £/sqft rates are used in this valuation:"),
            e("br"),
            "🏠 House value: £"+Math.round(salePsf)+"/sqft of internal floor area (what buyers pay for living space)",
            e("br"),
            "🌿 Plot/garden value: £"+(lookupLandPsf(ep.postcode||"")+"/sqft of land area (what developers pay for the plot)"),
            e("br"),
e("span",{style:{color:"#9A7B3E"}},
              "Important: Land is best valued by residual appraisal — GDV minus build costs minus profit. "+
              "The flat rate above (£"+lookupLandPsf(ep.postcode||"")+"/sqft) is a starting guide only. "+
              "Planning consent typically doubles or triples bare land value. Use the Land Valuation stage for a full residual calculation."
            )
          ),
          e(Sel,{label:"Property Type",value:ep.propType,onChange:function(v){up("epe","propType",v);},
            options:[{value:"",label:"Select..."}].concat(PROP_TYPES.map(function(t){return{value:t,label:t};}))}),
          e("div",{style:{display:"flex",flexDirection:"column",gap:4}},e("label",{style:S.label},"Internal Floor Area"),e("div",{style:{display:"flex",gap:8}},e("input",{type:"number",value:ep.propSqft||"",onChange:function(ev){up("epe","propSqft",ev.target.value);},placeholder:"sqft e.g. 900",style:Object.assign({},S.input,{flex:1})}),e("input",{type:"number",value:ep.propSqft?Math.round(ep.propSqft*0.0929):"",onChange:function(ev){up("epe","propSqft",Math.round(ev.target.value/0.0929)+"");},placeholder:"sqm e.g. 84",style:Object.assign({},S.input,{flex:1})})),e("div",{style:{fontSize:9,color:"#A0A4C0"}},"Enter in sqft OR sqm — the other updates automatically")),
          e(Sel,{label:"Condition",value:ep.condition,onChange:function(v){up("epe","condition",v);},
            options:["","excellent — Excellent (+15%)","good — Good (+5%)","average — Average (0%)","poor — Poor (-12%)","derelict — Derelict (-30%)"].map(function(o){var p=o.split(" — ");return{value:p[0],label:p[1]||"Select..."}})}),
          e(Sel,{label:"Bedrooms",value:ep.bedrooms,onChange:function(v){up("epe","bedrooms",v);},
            options:[{value:"",label:"Select..."},{value:"1",label:"1 bedroom"},{value:"2",label:"2 bedrooms"},{value:"3",label:"3 bedrooms"},{value:"4",label:"4 bedrooms"},{value:"5",label:"5 bedrooms"},{value:"6plus",label:"6+ bedrooms"}]}),
          e(Sel,{label:"Number of Storeys",value:ep.storeys,onChange:function(v){up("epe","storeys",v);},
            options:[
              {value:"",label:"Select..."},
              {value:"1",label:"Single storey (bungalow)"},
              {value:"1.5",label:"1.5 storeys (dormer / chalet bungalow)"},
              {value:"2",label:"2 storeys (standard house)"},
              {value:"2.5",label:"2.5 storeys (room in roof)"},
              {value:"3",label:"3 storeys"},
              {value:"4",label:"4 storeys"},
              {value:"5plus",label:"5+ storeys"},
            ]}),
          e(Inp,{label:"Sale £/sqft"+(pcData&&pcData.salePsf?" — auto from postcode: £"+pcData.salePsf:m?" — auto from "+cityName(city)+": £"+Math.round(estSalePsfFromRent(m.btr)):""),type:"number",value:ep.salePsf,onChange:function(v){up("epe","salePsf",v);},placeholder:"£"+Math.round(salePsf)+" /sqft"}),
e("div",{style:{gridColumn:"span 2",display:"flex",flexDirection:"column",gap:8}},
            e("label",{style:S.label},"Parking & Garaging (tick ALL that apply — multiple selections allowed)"),
            e("div",{style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,padding:14}},
              e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:10,fontWeight:600}},"GARAGING"),
              e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:14}},
                [
                  {id:"triple_garage",label:"Triple garage",mod:0.15},
                  {id:"double_garage",label:"Double garage",mod:0.10},
                  {id:"single_garage",label:"Single garage",mod:0.06},
                  {id:"triple_carport",label:"Triple carport",mod:0.10},
                  {id:"double_carport",label:"Double carport",mod:0.07},
                  {id:"single_carport",label:"Single carport",mod:0.04},
                  {id:"balcony",label:"Balcony / terrace",mod:0.04},
                  {id:"garage_conversion",label:"Garage conversion",mod:0.03},
                  {id:"annex",label:"Annexe / studio",mod:0.06},
                ].map(function(opt){
                  var parkingArr=ep.parkingFeatures||[];
                  var checked=parkingArr.indexOf(opt.id)>=0;
                  return e("div",{key:opt.id,
                    onClick:function(ev){
                      ev.preventDefault();ev.stopPropagation();
                      var arr=(ep.parkingFeatures||[]).slice();
                      var i=arr.indexOf(opt.id);
                      if(i>=0){arr.splice(i,1);}else{arr.push(opt.id);}
                      up("epe","parkingFeatures",arr);
                    },
                    style:{display:"flex",alignItems:"center",gap:6,fontSize:11,color:checked?"#2E2F8A":"#7278A0",cursor:"pointer",padding:"6px 8px",borderRadius:5,background:checked?"rgba(74,75,174,0.1)":"#fff",border:"1px solid "+(checked?"#4A4BAE":"#DDE0ED"),userSelect:"none"}},
                    e("div",{style:{width:16,height:16,borderRadius:3,border:"2px solid "+(checked?"#4A4BAE":"#C8CDE0"),background:checked?"#4A4BAE":"#fff",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:700}},checked?"✓":""),
                    e("span",null,opt.label)
                  );
                })
              ),
              e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:10,fontWeight:600}},"DRIVEWAY — how many cars does it hold?"),
              e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:14}},
                [
                  {id:"drive_1",label:"1 car",mod:0.02},
                  {id:"drive_2",label:"2 cars",mod:0.04},
                  {id:"drive_3",label:"3 cars",mod:0.05},
                  {id:"drive_4",label:"4 cars",mod:0.06},
                  {id:"drive_5",label:"5 cars",mod:0.07},
                  {id:"drive_6plus",label:"6+ cars",mod:0.08},
                ].map(function(opt){
                  var parkingArr=ep.parkingFeatures||[];
                  var checked=parkingArr.indexOf(opt.id)>=0;
                  return e("div",{key:opt.id,
                    onClick:function(ev){
                      ev.preventDefault();ev.stopPropagation();
                      // Driveway — only one size can be selected
                      var arr=(ep.parkingFeatures||[]).slice();
                      ["drive_1","drive_2","drive_3","drive_4","drive_5","drive_6plus"].forEach(function(d){
                        var i=arr.indexOf(d);if(i>=0)arr.splice(i,1);
                      });
                      if(!checked)arr.push(opt.id);
                      up("epe","parkingFeatures",arr);
                    },
                    style:{display:"flex",alignItems:"center",gap:6,fontSize:11,color:checked?"#2E2F8A":"#7278A0",cursor:"pointer",padding:"6px 8px",borderRadius:5,background:checked?"rgba(74,75,174,0.1)":"#fff",border:"1px solid "+(checked?"#4A4BAE":"#DDE0ED"),userSelect:"none"}},
                    e("div",{style:{width:16,height:16,borderRadius:"50%",border:"2px solid "+(checked?"#4A4BAE":"#C8CDE0"),background:checked?"#4A4BAE":"#fff",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:8,fontWeight:700}},checked?"●":""),
                    e("span",null,opt.label)
                  );
                })
              ),
              e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:10,fontWeight:600}},"OTHER PARKING"),
              e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}},
                [
                  {id:"on_street_2plus",label:"On-street 2+ spaces",mod:0.01},
                  {id:"on_street_1",label:"On-street 1 space",mod:0.00},
                  {id:"cpz",label:"Controlled Parking Zone",mod:-0.03},
                  {id:"permit_only",label:"Permit parking only",mod:-0.02},
                  {id:"no_parking",label:"No parking available",mod:-0.05},
                ].map(function(opt){
                  var parkingArr=ep.parkingFeatures||[];
                  var checked=parkingArr.indexOf(opt.id)>=0;
                  return e("div",{key:opt.id,
                    onClick:function(ev){
                      ev.preventDefault();ev.stopPropagation();
                      var arr=(ep.parkingFeatures||[]).slice();
                      var i=arr.indexOf(opt.id);
                      if(i>=0){arr.splice(i,1);}else{arr.push(opt.id);}
                      up("epe","parkingFeatures",arr);
                    },
                    style:{display:"flex",alignItems:"center",gap:6,fontSize:11,color:checked?"#2E2F8A":"#7278A0",cursor:"pointer",padding:"6px 8px",borderRadius:5,background:checked?"rgba(74,75,174,0.1)":"#fff",border:"1px solid "+(checked?"#4A4BAE":"#DDE0ED"),userSelect:"none"}},
                    e("div",{style:{width:16,height:16,borderRadius:3,border:"2px solid "+(checked?"#4A4BAE":"#C8CDE0"),background:checked?"#4A4BAE":"#fff",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:700}},checked?"✓":""),
                    e("span",null,opt.label)
                  );
                })
              ),
              (ep.parkingFeatures&&ep.parkingFeatures.length>0)&&e("div",{style:{marginTop:10,padding:"8px 10px",background:"rgba(74,75,174,0.06)",borderRadius:6,fontSize:11,color:"#4A4BAE",fontWeight:600}},
                "Selected: "+ep.parkingFeatures.join(", ").replace(/_/g," ")+" · Premium: +"+(parkBonus*100).toFixed(0)+"%"
              )
            )
          )
        )
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Step 1b — Additional Features"),
        e("div",{style:S.grid2},
          e(Sel,{label:"Outbuildings",value:ep.outbuildings,onChange:function(v){up("epe","outbuildings",v);},
            options:[{value:"",label:"None"},{value:"small_shed",label:"Shed / small outbuilding (+1%)"},{value:"large_outbuilding",label:"Large outbuilding / workshop (+3%)"},{value:"log_cabin",label:"Log cabin / garden room (+5%)"},{value:"annex_detached",label:"Detached annexe (+8%)"},{value:"barn",label:"Barn / agricultural building (+6%)"}]}),
          e(Sel,{label:"Balcony / Terrace",value:ep.balconyType,onChange:function(v){up("epe","balconyType",v);},
            options:[{value:"",label:"None"},{value:"juliet",label:"Juliet balcony (+1%)"},{value:"small",label:"Small balcony (+2%)"},{value:"large",label:"Large balcony / terrace (+4%)"},{value:"roof_terrace",label:"Roof terrace (+6%)"},{value:"inset",label:"Inset balcony (part of structure) (+3%)"}]}),
          e(Sel,{label:"Swimming Pool",value:ep.pool,onChange:function(v){up("epe","pool",v);},
            options:[{value:"",label:"None"},{value:"outdoor",label:"Outdoor pool (+4%)"},{value:"indoor",label:"Indoor pool (+8%)"},{value:"hot_tub",label:"Hot tub only (+2%)"}]}),
          e(Inp,{label:"Any other features (e.g. tennis court, stables, lake)",value:ep.otherFeatures,onChange:function(v){up("epe","otherFeatures",v);},placeholder:"Describe any other notable features"})
        )
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Step 2 — Garden / Plot"),
        e("div",{style:S.grid2},
          e(Inp,{label:"Rear Garden Length (ft)",type:"number",value:ep.gLen,onChange:function(v){up("epe","gLen",v);},placeholder:"e.g. 120"}),
          e(Inp,{label:"Rear Garden Width (ft)",type:"number",value:ep.gWid,onChange:function(v){up("epe","gWid",v);},placeholder:"e.g. 40"}),
          e(Sel,{label:"Aspect",value:ep.aspect,onChange:function(v){up("epe","aspect",v);},
            options:[{value:"",label:"Select..."},{value:"south",label:"South-facing (+8%)"},{value:"south_west",label:"SW (+5%)"},{value:"west",label:"West (+2%)"},{value:"east",label:"East (0%)"},{value:"north",label:"North (-5%)"}]}),
          e(Inp,{label:"Side Garden Length (ft)",type:"number",value:ep.sLen,onChange:function(v){up("epe","sLen",v);},placeholder:"e.g. 60"})
        ),
        gardenSqft>0&&e("div",{style:{background:"#EEEEF8",borderRadius:8,padding:12,fontSize:12,color:"#3A3D6A",marginTop:8}},
          e("div",{style:{fontWeight:600,marginBottom:4}},gardenSqft.toLocaleString()+" sqft / "+(gardenSqft/43560).toFixed(3)+" acres / "+Math.round(gardenSqft*0.0929)+" sqm"),
          e("div",{style:{display:"flex",gap:20,flexWrap:"wrap",fontSize:11,color:"#7278A0"}},
            e("span",null,"Land rate: £"+localLandPsf+"/sqft (local benchmark)"),
            e("span",null,"Standard value: "+fmt(Math.round(gardenSqft*localLandPsf))),
            e("span",null,"With planning uplift (est. 2-3x): "+fmt(Math.round(gardenSqft*localLandPsf*2.5))+" — "+fmt(Math.round(gardenSqft*localLandPsf*3.5))),
            e("span",{style:{color:"#4A4BAE",fontWeight:600}},"Garden/plot premium added to valuation: "+fmt(gVal))
          ),
          e("div",{style:{fontSize:10,color:"#9A7B3E",marginTop:6}},
            "⚠ Land is most accurately valued by residual appraisal (GDV minus build costs). Use Land Valuation stage for a full residual calculation."
          )
        )
      ),
      propSqft>0&&salePsf>0&&e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Property Valuation"),
        e("div",{style:{display:"flex",flexDirection:"column",gap:8,marginBottom:16}},
          [{l:"House value",v:houseVal,note:propSqft.toLocaleString()+" sqft × £"+Math.round(salePsf)+"/sqft × condition"},
           {l:"Garden premium",v:gVal,note:gardenSqft.toLocaleString()+" sqft"},
           {l:"Parking, extras & features",v:Math.round((parkMod-1)*(houseVal+gVal)),note:"+"+(((parkMod-1)*100).toFixed(0))+"%"},
          ].filter(function(r){return r.v>0;}).map(function(row){
            return e("div",{key:row.l,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #DDE0ED",fontSize:12}},
              e("span",{style:{fontWeight:500}},row.l),
              e("span",{style:{fontSize:10,color:"#7278A0"}},row.note),
              e("span",{style:{fontWeight:600}},fmt(row.v))
            );
          })
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}},
          [
            {label:"Optimistic",sublabel:"Seller's target — top of market",value:Math.round(currentVal*1.08),
             desc:"Best case in a competitive market with motivated buyers. Achievable if presentation is excellent and timing is right.",color:"#2D7A65",tag:"Best case"},
            {label:"Realistic",sublabel:"Likely sale price",value:currentVal,
             desc:"Most probable sale price based on local comparables, condition and current market. What we would realistically expect to achieve.",color:"#4A4BAE",tag:"Market value"},
            {label:"Lender's Valuation",sublabel:"Cautious mortgage survey figure",value:Math.round(currentVal*0.92),
             desc:"What a RICS surveyor would put on the property for mortgage purposes. Lenders are cautious — they need to recover funds quickly if repossessed.",color:"#9A7B3E",tag:"Mortgage security"},
          ].map(function(v){
            return e("div",{key:v.label,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid "+v.color,borderRadius:8,padding:16}},
              e("div",{style:{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:v.color,marginBottom:4}},v.label),
              e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:8}},v.sublabel),
              e("div",{style:{fontSize:26,fontWeight:800,color:"#2E2F8A",marginBottom:8}},fmt(v.value)),
              e("div",{style:{fontSize:10,color:"#7278A0",lineHeight:1.6,marginBottom:8}},v.desc),
              e("div",{style:{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,background:v.color+"15",color:v.color,display:"inline-block"}},v.tag)
            );
          })
        ),
        e("div",{style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden",marginBottom:12}},
          e("div",{style:{padding:"12px 16px",background:"#2E2F8A",color:"#fff",fontSize:12,fontWeight:700}},
            "Mortgage Lending Table — based on realistic value of "+fmt(currentVal)
          ),
          e("div",{style:{display:"grid",gridTemplateColumns:"1.2fr 0.8fr 1fr 1.5fr 1fr",padding:"8px 14px",background:"#F0F0F8",fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",fontWeight:700,borderBottom:"1px solid #DDE0ED"}},
            e("span",null,"Deposit Required"),e("span",null,"LTV"),e("span",null,"Loan Amount"),e("span",null,"Lender Appetite"),e("span",null,"Est. Monthly*")
          ),
          [
            {dep:0.05,ltv:95,risk:"Very few lenders — high risk",rc:"#B05A35"},
            {dep:0.10,ltv:90,risk:"Limited lenders — higher rates",rc:"#B05A35"},
            {dep:0.15,ltv:85,risk:"Most high street lenders",rc:"#9A7B3E"},
            {dep:0.20,ltv:80,risk:"All lenders — standard rates",rc:"#9A7B3E"},
            {dep:0.25,ltv:75,risk:"Good choice — better rates",rc:"#2D7A65"},
            {dep:0.30,ltv:70,risk:"Strong — best rate deals",rc:"#2D7A65"},
            {dep:0.40,ltv:60,risk:"Excellent — premium rates",rc:"#2D7A65"},
            {dep:0.50,ltv:50,risk:"Premium borrower status",rc:"#2D7A65"},
          ].map(function(row){
            var lenderVal=Math.round(currentVal*0.92);
            var loan=Math.round(lenderVal*(row.ltv/100));
            var depositAmt=lenderVal-loan;
            var rate=row.ltv>=95?0.060:row.ltv>=90?0.055:row.ltv>=85?0.048:row.ltv>=80?0.043:row.ltv>=75?0.040:row.ltv>=70?0.038:0.035;
            var monthly=Math.round(loan*(rate/12)*Math.pow(1+rate/12,300)/(Math.pow(1+rate/12,300)-1));
            return e("div",{key:row.ltv,style:{display:"grid",gridTemplateColumns:"1.2fr 0.8fr 1fr 1.5fr 1fr",padding:"8px 14px",borderBottom:"1px solid #DDE0ED",fontSize:11,color:"#3A3D6A",alignItems:"center",background:row.ltv<=80?"#fff":"rgba(176,90,53,0.02)"}},
              e("span",{style:{fontWeight:600}},fmt(depositAmt)+" ("+(row.dep*100).toFixed(0)+"%)"),
              e("span",{style:{fontWeight:700,color:"#2E2F8A"}},row.ltv+"%"),
              e("span",null,fmt(loan)),
              e("span",{style:{fontSize:10,color:row.rc,fontWeight:600}},row.risk),
              e("span",{style:{fontWeight:700,color:"#2E2F8A"}},fmt(monthly)+"/mo")
            );
          }),
          e("div",{style:{padding:"8px 14px",fontSize:9,color:"#7278A0",fontStyle:"italic"}},
            "* Estimated monthly repayments on 25-year capital repayment mortgage at indicative rates. Lender uses cautious valuation of "+fmt(Math.round(currentVal*0.92))+". Actual rates vary — consult a mortgage broker for accurate figures."
          )
        ),
        e("div",{style:{fontSize:10,color:"#7278A0",fontStyle:"italic"}},
          "⚠ Indicative estimates only — RICS surveyor required for formal mortgage, legal or insurance purposes. House value uses £"+Math.round(salePsf)+"/sqft local benchmark. Land/plot uses £"+localLandPsf+"/sqft residual-derived rate. Planning uplift not included in base valuation."
        )
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Step 3a — What Could Be Built? (Auto-Calculator)"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14}},"Based on your plot size, we estimate the development potential for different scheme types. These are indicative — actual unit numbers depend on planning, design and site constraints."),
        (function(){
          var plotSqft=gardenSqft+(propSqft||0)*0.3; // land = garden + footprint estimate
          var plotAcres=plotSqft/43560;
          var plotHa=plotAcres*0.404686;
          if(plotSqft<500)return e("div",{style:{fontSize:12,color:"#7278A0",padding:"12px 0"}},"Enter garden dimensions in Step 2 to see development potential.");

          var scenarios=[
            {
              type:"Terraced Houses",icon:"🏘",
              dph:40,unitSqft:900,bedrooms:"2-3 bed",
              units:Math.max(1,Math.floor(plotHa*40)),
              landEff:0.60, // 60% of land used for houses
              note:"Standard suburban density. Includes roads, gardens and public open space.",
              scheme:"sfh",assetType:"sfh"
            },
            {
              type:"Semi-Detached Houses",icon:"🏠",
              dph:28,unitSqft:1020,bedrooms:"3 bed",
              units:Math.max(1,Math.floor(plotHa*28)),
              landEff:0.55,
              note:"Lower density. More parking, larger gardens. Popular family housing.",
              scheme:"sfh",assetType:"sfh"
            },
            {
              type:"Detached Houses",icon:"🏡",
              dph:18,unitSqft:1400,bedrooms:"4 bed",
              units:Math.max(1,Math.floor(plotHa*18)),
              landEff:0.50,
              note:"Executive detached. Requires larger site. Premium pricing.",
              scheme:"sfh",assetType:"sfh"
            },
            {
              type:"Apartments (4-6 storey)",icon:"🏢",
              dph:120,unitSqft:550,bedrooms:"1-2 bed",
              units:Math.max(1,Math.floor(plotHa*120)),
              landEff:0.80,
              note:"Mid-rise flats. BTR or private sale. Requires more car parking.",
              scheme:"hra",assetType:"btr"
            },
            {
              type:"PBSA (Student)",icon:"🎓",
              dph:200,unitSqft:280,bedrooms:"Studios & clusters",
              units:Math.max(1,Math.floor(plotHa*200)),
              landEff:0.85,
              note:"High density student beds. Must be near university. No car parking required.",
              scheme:"hra",assetType:"pbsa"
            },
            {
              type:"Bungalows",icon:"🏚",
              dph:16,unitSqft:850,bedrooms:"2-3 bed",
              units:Math.max(1,Math.floor(plotHa*16)),
              landEff:0.50,
              note:"Single storey. Popular with elderly market. Lower density.",
              scheme:"sfh",assetType:"sfh"
            },
          ];

          return e("div",null,
            e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:8,padding:"10px 14px",fontSize:11,color:"#3A3D6A",marginBottom:14}},
              "Plot size: "+Math.round(plotSqft).toLocaleString()+" sqft / "+plotAcres.toFixed(3)+" acres / "+plotHa.toFixed(3)+" ha",
              e("span",{style:{color:"#7278A0",marginLeft:12}},"(garden + estimated footprint)")
            ),
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}},
              scenarios.map(function(sc){
                var gdvEst=sc.units*sc.unitSqft*(salePsf||280);
                var buildEst=sc.units*sc.unitSqft*200;
                var profitEst=gdvEst*0.175;
                var rlvEst=gdvEst-buildEst-buildEst*0.12-buildEst*0.05-(buildEst+0)*0.075-profitEst;
                return e("div",{key:sc.type,
                  style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:14,cursor:"pointer",transition:"all .15s"},
                  onMouseOver:function(ev){ev.currentTarget.style.borderColor="#4A4BAE";ev.currentTarget.style.boxShadow="0 2px 8px rgba(74,75,174,0.1)";},
                  onMouseOut:function(ev){ev.currentTarget.style.borderColor="#DDE0ED";ev.currentTarget.style.boxShadow="none";}
                },
                  e("div",{style:{fontSize:20,marginBottom:6}},sc.icon),
                  e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A",marginBottom:2}},sc.type),
                  e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:10}},sc.bedrooms),
                  e("div",{style:{fontSize:28,fontWeight:800,color:"#4A4BAE",lineHeight:1,marginBottom:4}},sc.units),
                  e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:8}},"estimated units / beds"),
                  e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.5,marginBottom:10}},sc.note),
                  e("div",{style:{borderTop:"1px solid #DDE0ED",paddingTop:8,fontSize:10}},
                    e("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:2}},
                      e("span",{style:{color:"#7278A0"}},"Est. GDV"),
                      e("span",{style:{fontWeight:600,color:"#2E2F8A"}},fmt(gdvEst))
                    ),
                    e("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:8}},
                      e("span",{style:{color:"#7278A0"}},"Est. land value"),
                      e("span",{style:{fontWeight:600,color:rlvEst>0?"#2D7A65":"#B05A35"}},fmt(Math.max(0,rlvEst)))
                    ),
                    e("button",{
                      onClick:function(){
                        // Pre-fill the chosen scheme
                        setData(function(d){
                          var updates={assetType:sc.assetType};
                          if(sc.scheme==="sfh"){
                            updates.sfh=Object.assign({},d.sfh||{},{
                              acres:(plotAcres).toFixed(3),
                              city:d.epe&&d.epe.city||city,
                              dph:sc.dph+"",
                            });
                          } else {
                            updates.hra=Object.assign({},d.hra||{},{
                              city:d.epe&&d.epe.city||city,
                            });
                          }
                          updates.planning=Object.assign({},d.planning||{},{
                            units:sc.units+"",
                            lpa:d.planning&&d.planning.lpa||"",
                          });
                          updates.fin=Object.assign({},d.fin||{});
                          return mergeRespectingCompletedStages(d,updates);
                        });
                        navTo(sc.scheme==="sfh"?"sfh":"hra");
                      },
                      style:{width:"100%",padding:"7px",background:"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
                    },"Use this scheme →")
                  )
                );
              })
            ),
            e("div",{style:{marginTop:12,padding:"10px 14px",background:"rgba(154,123,62,0.08)",border:"1px solid rgba(154,123,62,0.25)",borderRadius:6,fontSize:11,color:"#7A5A2E",lineHeight:1.7}},
              "⚠ These are maximum theoretical yields — actual consented numbers will be lower due to planning constraints, design requirements, parking, amenity space and highways. Always verify with a planning consultant before making offers."
            )
          );
        })()
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Step 3b — Development Scenario (Manual Inputs)"),
        e("div",{style:S.grid2},
          e(Inp,{label:"How many new units to build?",type:"number",value:ep.newUnits,onChange:function(v){up("epe","newUnits",v);},placeholder:"e.g. 4"}),
          e(Inp,{label:"Average new unit size (sqft)",type:"number",value:ep.newSqft,onChange:function(v){up("epe","newSqft",v);},placeholder:"900"}),
          e(Inp,{label:"New Sale Price (£ per sqft of floor area)",type:"number",value:ep.newPsf,onChange:function(v){up("epe","newPsf",v);},placeholder:"£"+Math.round(salePsf)+" /sqft"}),
          e(Inp,{label:"Build £/sqft"+(m?" — auto from "+cityName(city)+": £"+m.build:" — typical £180-250"),type:"number",value:ep.buildPsf,onChange:function(v){up("epe","buildPsf",v);},placeholder:"£"+Math.round(newBuildPsf)}),
          e(Inp,{label:"Developer Profit % of GDV — UK norm 15-18%",type:"number",value:ep.profitPct,onChange:function(v){up("epe","profitPct",v);},placeholder:"17.5"}),
          e(Inp,{label:"Finance Rate % — lender's interest rate (typically 6-9%)",type:"number",value:ep.finRate,onChange:function(v){up("epe","finRate",v);},placeholder:"7.5"})
        ),
        // Build-cost benchmark: pick what you're building (new-build or conversion) to set Build £/sqft
        (function(){
          if(typeof benchmarkBuildPsf!=="function") return null;
          var opts={city:eCity};
          var picks=[
            {l:"New houses",k:"Residential houses"},
            {l:"New apartments",k:"Residential apartments"},
            {l:"Pub→flats",k:"Pub conversion"},
            {l:"Office→resi",k:"Office conversion"},
            {l:"Barn conv.",k:"Barn conversion"}
          ];
          var btn={padding:"4px 10px",background:"#4A4BAE",border:"none",borderRadius:4,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"};
          return e("div",{style:{gridColumn:"span 2",margin:"4px 0 0",padding:"10px 14px",background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.25)",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.6,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}},
            e("span",{style:{flex:"1 1 220px"}},e("strong",null,"🧱 Build benchmark — "+cityName(eCity)+": "),"pick what you're building to set Build £/sqft (BCIS-style mid rate; validate with QS):"),
            picks.map(function(p){ var v=benchmarkBuildPsf(p.k,opts); return e("button",{key:p.k,onClick:function(){up("epe","buildPsf",v);},style:btn},p.l+" £"+v); })
          );
        })(),
        e("div",{style:{gridColumn:"span 2",paddingTop:4}},
          e("button",{
            onClick:function(){
              if(!ep.newUnits){alert("Please enter the number of new units to build first.");return;}
              // Scroll down to results
              var el=document.getElementById("epe-results");
              if(el)el.scrollIntoView({behavior:"smooth"});
              logEvent(user,"CALCULATE",{stage:"Property Evaluator",units:ep.newUnits,currentVal:currentVal,devRlv:devRlv});
            },
            style:{width:"100%",padding:"13px",background:"#2D7A65",border:"none",borderRadius:7,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"⚡ Calculate Development Value & Compare Options")
        )
      ),
      newUnits>0&&newGdv>0&&currentVal>0&&e("div",{id:"epe-results",style:S.card},
        e("div",{style:S.cardTitle},"The Decision"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:14}},
          [{l:"Sell As Standing",v:currentVal,desc:"Current market value. Clean exit — no planning or build risk.",tag:"Low risk · Immediate",c:"#4A4BAE"},
           {l:"Sell With Planning",v:Math.round(devRlv*0.75),desc:"Get consent then sell. You take planning risk only. ~75% of dev value.",tag:"Medium risk · 12-24 months",c:"#7B6CB0"},
           {l:"Demolish & Develop",v:devRlv,desc:"Build "+newUnits+" new units. Highest return but carries full risk.",tag:viable?"Viable — significant uplift":"Check viability",c:sc},
          ].map(function(opt){
            return e("div",{key:opt.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid "+opt.c,borderRadius:8,padding:16}},
              e("div",{style:{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"#7278A0",marginBottom:6}},opt.l),
              e("div",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",marginBottom:8}},fmt(opt.v)),
              e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6,marginBottom:8}},opt.desc),
              e("div",{style:{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:4,background:opt.c+"15",color:opt.c,display:"inline-block"}},opt.tag)
            );
          })
        ),
        e("div",{style:{border:"1px solid "+sc,borderRadius:8,padding:"14px 16px",background:sc+"08"}},
          e("div",{style:{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:sc,marginBottom:4}},"Development Uplift vs Selling As Standing"),
          e("div",{style:{fontSize:24,fontWeight:800,color:sc,marginBottom:4}},(uplift>=0?"+":"")+fmt(uplift)+" ("+(uplift>=0?"+":"")+pct(currentVal>0?(uplift/currentVal)*100:0)+")"),
          e("div",{style:{fontSize:12,color:"#3A3D6A"}},viable?"Development adds "+fmt(uplift)+" over current value — justifies planning and build risk.":"Limited uplift — consider selling as-is or with planning permission only.")
        ),
        e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",borderRadius:10,padding:"20px 24px",marginBottom:4,display:"flex",alignItems:"center",justifyContent:"space-between"}},
        e("div",null,
          e("div",{style:{fontSize:14,fontWeight:800,color:"#fff",marginBottom:4}},"Ready to explore development options?"),
          e("div",{style:{fontSize:11,color:"rgba(255,255,255,0.6)"}},"See all scheme types, demolition costs and residual values in one view")
        ),
        e("button",{onClick:function(){navTo("epeworkflow");},
          style:{padding:"11px 24px",background:"#EDE84A",border:"none",borderRadius:7,color:"#1E1F5C",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif",flexShrink:0}
        },"Open Workflow →")
      ),
      e(AIPanel,{user:user,up:up,stage:"epe",data:data,persistKey:"epe_property___developme",label:"Property & Development Analysis",
          prompt:buildHonestPrompt(data,"Analyse this property opportunity. Type: "+(ep.propType||"unknown")+" at "+(ep.postcode||"postcode not given")+", "+propSqft+"sqft, "+(ep.bedrooms||"?")+" bed, "+(ep.storeys||"?")+" storeys, condition: "+(ep.condition||"average")+". Current value: £"+currentVal.toLocaleString()+". Garden: "+gardenSqft+"sqft ("+((ep.aspect||"aspect unknown"))+"), premium: "+fmt(gVal)+". Proposed: "+newUnits+" new units, GDV: "+fmt(newGdv)+", dev RLV: "+fmt(devRlv)+", uplift: "+(currentVal>0?pct((uplift/currentVal)*100):"n/a")+". Provide: 1) Current value sense check, 2) Development feasibility, 3) Planning risk, 4) Best option recommendation, 5) What would change the recommendation.","epe")})
      )
    );
  }
