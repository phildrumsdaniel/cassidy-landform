function Tool(props){
  var user=props.user;
  var onLogout = props.onLogout || function(){};

  // ── STATE DECLARATIONS ────────────────────────────────────────────────────
  var ds=useState(function(){
    try{var s=localStorage.getItem("cassidy_deal"); if(!s) return {}; var parsed=JSON.parse(s); return migrateLoadedDeal(parsed).data || parsed;}catch(e){return {};}
  }()); var data=ds[0]; var setData=ds[1];
  var ss=useState("navigator"); var stage=ss[0]; var setStage=ss[1];
  var mob=useState(false); var mobileMenuOpen=mob[0]; var setMobileMenuOpen=mob[1];
  var fup=useState(false); var showFileUpload=fup[0]; var setShowFileUpload=fup[1];
  var fpr=useState(false); var fileProcessing=fpr[0]; var setFileProcessing=fpr[1];
  var frs=useState([]); var fileResults=frs[0]; var setFileResults=frs[1];
  // Reactive mobile detection — updates on resize/rotation
  var isMobileS=useState(typeof window!=="undefined"&&window.innerWidth<=768);
  var isMobile=isMobileS[0]; var setIsMobile=isMobileS[1];
  React.useEffect(function(){
    function check(){ setIsMobile(window.innerWidth<=768); }
    window.addEventListener("resize",check);
    window.addEventListener("orientationchange",check);
    return function(){
      window.removeEventListener("resize",check);
      window.removeEventListener("orientationchange",check);
    };
  },[]);

  // Auto-clear stale "running" / loading states on app start
  // (these can be left true if a previous search was interrupted)
  React.useEffect(function(){
    var staleKeys=["placona","scraper","monitor","constraint"];
    var needsReset=staleKeys.some(function(k){
      return data[k]&&data[k].running===true;
    });
    if(needsReset){
      setData(function(d){
        var next=Object.assign({},d);
        staleKeys.forEach(function(k){
          if(next[k]&&next[k].running===true){
            next[k]=Object.assign({},next[k],{running:false});
          }
        });
        return next;
      });
    }
  },[]);  // Run once on mount
  // Load custom cities from localStorage
  (function(){
    try{
      var custom=JSON.parse(localStorage.getItem("cassidy_custom_cities")||"{}");
      Object.keys(custom).forEach(function(k){if(!MKT[k])MKT[k]=custom[k];});
      CITIES.length=0; Object.keys(MKT).forEach(function(c){CITIES.push(c);});
    }catch(e){}
  })();

// ── STAGES ───────────────────────────────────────────────────────────────────
var ALL_STAGES = [
  // ── 0. START ─────────────────────────────────────────────────────────────
  {id:"navigator",       label:"Process Navigator",  icon:"🧭", group:"0. Start",    journeys:["all","land","property","sfh","btr","pbsa","recovery","asset"]},
  {id:"assetOptimiser",  label:"Asset Exit Optimiser", icon:"🏛", group:"0. Start",    journeys:["asset","all"]},
  // ── 1. FIND ──────────────────────────────────────────────────────────────
  {id:"placona",     label:"Placona Agent",         icon:"🤖", group:"1. Find",     journeys:["land","sfh","btr","pbsa","all"]},
  {id:"monitor",     label:"Planning Monitor",     icon:"📡", group:"1. Find",     journeys:["land","sfh","btr","pbsa","all"]},
  {id:"constraint",  label:"Constraint Check",     icon:"⚠",  group:"1. Find",     journeys:["land","sfh","btr","pbsa","all"]},
  {id:"scraper",     label:"Land Finder",          icon:"🔍", group:"1. Find",     journeys:["land","sfh","btr","pbsa","all"]},
  {id:"land",        label:"Land Appraisal",       icon:"⬟",  group:"1. Find",     journeys:["land","sfh","btr","pbsa","all"]},
  {id:"epe",         label:"Property Evaluator",   icon:"🏠", group:"1. Find",     journeys:["property","all"]},
  // ── 2. VALUE ────────────────────────────────────────────────────────────
  {id:"rlv",         label:"Land Valuation (RLV)", icon:"◆",  group:"2. Value",    journeys:["land","sfh","btr","pbsa","property","all"]},
  {id:"sfh",         label:"SFH House Mix",        icon:"🏡", group:"2. Value",    journeys:["sfh","property","all"]},
  {id:"tenure",      label:"Tenure Mix",           icon:"🤝", group:"2. Value",    journeys:["sfh","btr","property","all"]},
  {id:"hra",         label:"BTR / PBSA Block",     icon:"🏢", group:"2. Value",    journeys:["btr","pbsa","all"]},
  {id:"capitalise",  label:"Capitalisation",       icon:"£",  group:"2. Value",    journeys:["land","btr","pbsa","sfh","all"]},
  {id:"grants",      label:"Grant & Funding",      icon:"💷", group:"2. Value",    journeys:["sfh","btr","pbsa","land","all"]},
  // ── 3. DEVELOP ──────────────────────────────────────────────────────────
  {id:"planning",    label:"Planning & Viability", icon:"▲",  group:"3. Develop",  journeys:["land","sfh","btr","pbsa","property","recovery","all"]},
  {id:"fin",         label:"Financial Modelling",  icon:"◉",  group:"3. Develop",  journeys:["sfh","btr","pbsa","property","recovery","all"]},
  {id:"viability",   label:"Detailed Appraisal",  icon:"📐", group:"3. Develop",  journeys:["sfh","btr","pbsa","all"]},
  {id:"dd",          label:"Due Diligence",        icon:"◈",  group:"3. Develop",  journeys:["land","sfh","btr","pbsa","property","recovery","all"]},
  {id:"risks",       label:"Risk Register",        icon:"⬡",  group:"3. Develop",  journeys:["land","sfh","btr","pbsa","property","recovery","all"]},
  // ── 4. EXIT ──────────────────────────────────────────────────────────────
  {id:"exit",        label:"Exit Strategy",        icon:"◆",  group:"4. Exit",     journeys:["land","sfh","btr","pbsa","property","recovery","all"]},
  {id:"recovery",    label:"Planning Recovery",    icon:"⚖",  group:"4. Exit",     journeys:["recovery","all"]},
  // ── 5. REPORT ────────────────────────────────────────────────────────────
  {id:"scorecard",   label:"Site Scorecard",       icon:"🏆", group:"5. Report",   journeys:["land","sfh","btr","pbsa","all"]},
  {id:"teaser",      label:"Teaser PDF",           icon:"📬", group:"5. Report",   journeys:["land","sfh","btr","pbsa","all"]},
  {id:"im",          label:"Investor Memorandum",  icon:"📑", group:"5. Report",   journeys:["land","sfh","btr","pbsa","all"]},
  {id:"dataroom",    label:"Data Room",            icon:"📁", group:"5. Report",   journeys:["sfh","btr","pbsa","land","property","all"]},
  {id:"investor",    label:"Investor Marketing Suite", icon:"🎯", group:"5. Report",journeys:["land","sfh","btr","pbsa","property","asset","all"]},
  {id:"summary",     label:"Executive Summary",    icon:"📄", group:"5. Report",   journeys:["land","sfh","btr","pbsa","property","recovery","all"]},
  // ── 6. RECORDS ───────────────────────────────────────────────────────────
  {id:"meetings",    label:"Meeting Transcripts",  icon:"📝", group:"6. Records",  journeys:["all"]},
  {id:"portfolio",   label:"Deal Portfolio",       icon:"📊", group:"6. Records",  journeys:["all"]},
  {id:"dashboard",   label:"Deal Dashboard",       icon:"◈",  group:"6. Records",  journeys:["land","sfh","btr","pbsa","property","recovery","all"]},
  // ── 7. AUDIT ─────────────────────────────────────────────────────────────
  {id:"propagation", label:"Propagation Audit",    icon:"🔬", group:"7. Audit",    journeys:["all"]},
];

// ──────────────────────────────────────────────────────────────────────
// STAGE RELEVANCE (v9.31)
// For a given deal context (asset type + active exit routes + planning state),
// classify each stage as REQUIRED / RECOMMENDED / OPTIONAL / N_A.
// Drives the sidebar badges and dashboard "what's incomplete" checklist.
// ──────────────────────────────────────────────────────────────────────
var STAGE_RELEVANCE = {
  // Always required regardless of journey
  navigator:    {required:["all"],                  recommended:[]},
  land:         {required:["land","sfh","btr","pbsa"], recommended:["property"]},
  rlv:          {required:["land","sfh","btr","pbsa"], recommended:["property"]},
  planning:     {required:["land","sfh","btr","pbsa","recovery"], recommended:["property"]},
  fin:          {required:["sfh","btr","pbsa","recovery"], recommended:["property"]},
  exit:         {required:["sfh","btr","pbsa"],     recommended:["land","property","recovery"]},

  // Scheme-specific value stages
  sfh:          {required:["sfh"],                  recommended:[]},
  hra:          {required:["btr","pbsa"],           recommended:[]},
  tenure:       {required:[],                        recommended:["sfh","btr"]},
  capitalise:   {required:["btr","pbsa"],           recommended:["sfh","land"]},  // becomes REQUIRED for SFH if pension/PRS routes used
  grants:       {required:[],                        recommended:["sfh","btr","pbsa"]},  // becomes REQUIRED if any AHP route used

  // Find stages
  placona:      {required:[],                        recommended:["land","sfh","btr","pbsa"]},
  monitor:      {required:[],                        recommended:["land","sfh","btr","pbsa"]},
  constraint:   {required:[],                        recommended:["land","sfh","btr","pbsa"]},
  scraper:      {required:[],                        recommended:["land","sfh","btr","pbsa"]},
  epe:          {required:["property"],              recommended:[]},

  // Develop stages
  viability:    {required:[],                        recommended:["sfh","btr","pbsa"]},
  dd:           {required:["sfh","btr","pbsa"],     recommended:["land","property"]},
  risks:        {required:[],                        recommended:["sfh","btr","pbsa","land","property"]},

  // Exit / Reports
  recovery:     {required:["recovery"],              recommended:[]},
  scorecard:    {required:[],                        recommended:["sfh","btr","pbsa"]},
  teaser:       {required:[],                        recommended:["sfh","btr","pbsa","land"]},
  im:           {required:[],                        recommended:["sfh","btr","pbsa","land"]},
  dataroom:     {required:[],                        recommended:["sfh","btr","pbsa","land"]},
  investor:     {required:[],                        recommended:["sfh","btr","pbsa","land"]},
  summary:      {required:[],                        recommended:["sfh","btr","pbsa"]},
  assetOptimiser: {required:["asset"],              recommended:[]},

  // Records — always available
  meetings:     {required:[],                        recommended:[]},
  portfolio:    {required:[],                        recommended:[]},
  dashboard:    {required:[],                        recommended:["sfh","btr","pbsa","land","property"]},
  propagation:  {required:[],                        recommended:[]}
};

// Compute relevance for one stage given current deal state
// Returns "required" | "recommended" | "optional" | "na"
function getStageRelevance(stageId, deal){
  var stage = ALL_STAGES.find(function(s){return s.id===stageId;});
  if(!stage) return "na";
  var at = ((deal&&deal.assetType)||"").toLowerCase() || "all";

  // First check if this stage even applies to the journey at all
  if(stage.journeys.indexOf("all") < 0 && stage.journeys.indexOf(at) < 0){
    return "na";
  }

  var rel = STAGE_RELEVANCE[stageId];
  if(!rel) return "optional";  // default to optional if undefined

  // Hard-required by journey
  if(rel.required.indexOf(at) >= 0 || rel.required.indexOf("all") >= 0){
    return "required";
  }

  // Context-driven upgrades — features used promote a stage from optional → required
  if(deal && deal.sfh && deal.sfh.mix){
    var mix = deal.sfh.mix;
    var hasPension = mix.some(function(r){return r.tenure==="pension" && num(r.count)>0;});
    var hasPrs = mix.some(function(r){return r.tenure==="retained_prs" && num(r.count)>0;});
    var hasAhp = mix.some(function(r){return (r.tenure==="ahp_social"||r.tenure==="ahp_so"||r.tenure==="ahp_affordable"||r.tenure==="first_homes") && num(r.count)>0;});

    // Capitalisation becomes REQUIRED if any pension or PRS retained routes are used
    if(stageId==="capitalise" && (hasPension || hasPrs)) return "required";
    // Grants becomes REQUIRED if any AHP route is used
    if(stageId==="grants" && hasAhp) return "required";
    // Tenure Mix becomes REQUIRED if mix has 2+ exit routes
    if(stageId==="tenure"){
      var routes = {};
      mix.forEach(function(r){if(num(r.count)>0 && r.tenure) routes[r.tenure] = true;});
      if(Object.keys(routes).length >= 2) return "required";
    }
  }

  // Recommended by journey
  if(rel.recommended.indexOf(at) >= 0 || rel.recommended.indexOf("all") >= 0){
    return "recommended";
  }

  return "optional";
}

// Lightweight completeness check — true if the stage has key fields filled
/* isStageComplete moved to its own file — see js/ (loaded before this script) */

// Journey display labels (used by Deal Dashboard and elsewhere)
var JOURNEYS = {
  land:     {label:"Land & Development",       desc:"Strategic land → planning → development → exit"},
  property: {label:"Property Evaluator",       desc:"Existing property analysis & value-add"},
  sfh:      {label:"Single Family Housing",    desc:"Plot-by-plot housing estate"},
  btr:      {label:"Build to Rent",            desc:"Multi-family rental block"},
  pbsa:     {label:"PBSA / Student Housing",   desc:"Purpose-built student accommodation"},
  recovery: {label:"Planning Recovery",        desc:"Reviving stalled / refused schemes"},
  all:      {label:"All Stages",               desc:"Show every stage regardless of asset type"}
};
  // Auto-save to localStorage whenever data changes
  React.useEffect(function(){
    try{localStorage.setItem("cassidy_deal",JSON.stringify(data));}catch(e){}
  },[data]);
  // Exit stage states - must be at component level not inside render functions
  var hotS=useState(""); var hot=hotS[0]; var setHot=hotS[1];
  var hotLS=useState(false); var hotL=hotLS[0]; var setHotL=hotLS[1];
  var memoS=useState(""); var memo=memoS[0]; var setMemo=memoS[1];
  var memoLS=useState(false); var memoL=memoLS[0]; var setMemoL=memoLS[1];
  // Deal history
  var histS=useState((function(){
    try{var s=localStorage.getItem("cassidy_history");return s?JSON.parse(s):[];}catch(e){return [];}
  })()); var history=histS[0]; var setHistory=histS[1];
  var showHistS=useState(false); var showHist=showHistS[0]; var setShowHist=showHistS[1];
  var showMoreMenuS=useState(false); var showMoreMenu=showMoreMenuS[0]; var setShowMoreMenu=showMoreMenuS[1];
  // Selected scheme types — multi-select array. Empty = show all stages/fields.
  var schemesS=useState(function(){
    if(data && data.assetType && data.assetType !== "all") return [data.assetType];
    try{var s=localStorage.getItem("cassidy_schemes");return s?JSON.parse(s):[];}catch(e){return [];}
  }()); var schemes=schemesS[0]; var setSchemes=schemesS[1];
  // Selected exit routes — multi-select array. Empty = show all exit-related fields.
  var exitsS=useState(function(){
    try{var s=localStorage.getItem("cassidy_exits");return s?JSON.parse(s):[];}catch(e){return [];}
  }()); var exits=exitsS[0]; var setExits=exitsS[1];
  // Persist filters to localStorage
  React.useEffect(function(){
    try{localStorage.setItem("cassidy_schemes",JSON.stringify(schemes));}catch(e){}
  },[schemes]);
  React.useEffect(function(){
    try{localStorage.setItem("cassidy_exits",JSON.stringify(exits));}catch(e){}
  },[exits]);
  // Legacy 'journey' single-string kept for backwards compatibility with existing code paths.
  // It reflects the FIRST selected scheme, or "all" if none/multiple.
  var journey = schemes.length===1 ? schemes[0] : ((data&&data.assetType&&data.assetType!=="all") ? data.assetType : "all");
  var FLOW_ASSET_TYPES = ["land","property","sfh","btr","pbsa","recovery","asset"];
  function setFlowAssetType(j){
    if(FLOW_ASSET_TYPES.indexOf(j)<0) return;
    setData(function(prev){return Object.assign({},prev||{},{assetType:j});});
  }
  function setJourney(j){
    // Shim — preserves the old setJourney() API while updating schemes array.
    if(j==="all")setSchemes([]);
    else {
      setSchemes([j]);
      setFlowAssetType(j);
    }
  }
  function toggleScheme(j){
    setSchemes([j]);
    setFlowAssetType(j);
  }
  function toggleExit(j){
    setExits(function(arr){
      if(arr.indexOf(j)>=0)return arr.filter(function(x){return x!==j;});
      return arr.concat([j]);
    });
  }
  function isSchemeOn(j){ return schemes.indexOf(j)>=0; }
  function isExitOn(j){ return exits.indexOf(j)>=0; }

  // ── Smart filter map: exit routes that unlock specific stages ──
  // (e.g. picking 'Pension Fund' auto-shows Capitalisation even without BTR scheme)
  var EXIT_UNLOCKS = {
    pension:    ["capitalise","im","teaser","dataroom"],         // pension fund needs investor materials
    btr_op:     ["capitalise","hra","im","dataroom"],            // BTR operator buys operating asset
    family:     ["capitalise","im","teaser","dataroom"],         // family office wants IM
    ha_rp:      ["grants","capitalise","dataroom"],              // HA/RP bulk = grant funding + bulk valuation
    homes_eng:  ["grants","im","dataroom"],                      // Homes England = grant funding
    sovereign:  ["capitalise","im","teaser","dataroom"],         // SWF = institutional
    bank_takeout:["capitalise","fin","dataroom"],                // refinance = needs cashflow + capitalised NOI
    land_sale:  ["dataroom"],                                    // sell land with planning = also needs data room
    open_mkt:   ["fin","viability"]                              // open market sale = sales cashflow
  };
  // Which exit routes have ANY exit ticked?
  function exitUnlocksStage(stageId){
    if(exits.length===0)return false;
    if(stageId==="hra"){
      var flow = activeSchemeFilters();
      if(flow.indexOf("btr")<0 && flow.indexOf("pbsa")<0) return false;
    }
    for(var i=0;i<exits.length;i++){
      var arr=EXIT_UNLOCKS[exits[i]]||[];
      if(arr.indexOf(stageId)>=0)return true;
    }
    return false;
  }

  function activeSchemeFilters(){
    if(schemes.length>0)return schemes;
    var chosen=(data&&data.assetType&&data.assetType!=="all") ? data.assetType : "";
    return chosen ? [chosen] : [];
  }

  function isStageId(id){
    return ALL_STAGES.some(function(s){return s.id===id;});
  }

  function stageVisibleForFlow(s){
    if(!s || !s.journeys)return true;
    var flowSchemes=activeSchemeFilters();
    if(flowSchemes.length===0&&exits.length===0)return s.id==="navigator" || s.id==="portfolio" || s.id==="dashboard";
    for(var sj=0;sj<flowSchemes.length;sj++){
      if(s.journeys.indexOf(flowSchemes[sj])>=0)return true;
    }
    if(exitUnlocksStage(s.id))return true;
    if(s.journeys.length===1&&s.journeys[0]==="all")return true;
    return false;
  }

  // showFor(...schemeNames) follows the active journey. Empty filters now mean the selected asset journey, not every page.
  function showFor(){
    var flowSchemes=activeSchemeFilters();
    if(flowSchemes.length===0&&exits.length===0)return false;
    for(var i=0;i<arguments.length;i++){
      if(flowSchemes.indexOf(arguments[i])>=0)return true;
      if(exits.indexOf(arguments[i])>=0)return true;
    }
    return false;
  }

  function up(section,key,val){
    setData(function(d){
      var completed=(d&&d._completedStages)||{};
      var isCrossStage=section!==stage && isStageId(section);
      if(isCrossStage && completed[section]) return d;
      var sec=Object.assign({},d[section]||{});
      sec[key]=val;
      var next=Object.assign({},d);
      next[section]=sec;
      return next;
    });
  }

  function mergeRespectingCompletedStages(prev, updates){
    var next = Object.assign({}, prev);
    var completed = (prev && prev._completedStages) || {};
    Object.keys(updates || {}).forEach(function(key){
      if(isStageId(key) && completed[key] && key !== stage) return;
      next[key] = updates[key];
    });
    return next;
  }

  var city=(data.land&&data.land.city)||(data.hra&&data.hra.city)||(data.sfh&&data.sfh.city)||"";
  var m=(city&&MKT[city])||MKT.manchester;
  var at=data.assetType||"btr";
  var units=num((data.planning&&data.planning.units)||0);
  var acres=num((data.land&&data.land.acres)||0);
  var gia=acres*43560*0.65;
  var buildPsf=num((data.fin&&data.fin.buildPsf)||m.build);
  var bc=gia*buildPsf;
  // Scenario-aware land cost: if a planning scenario is applied, use its modelled value;
  // otherwise fall back to the user-entered asking/agreed price.
  // This lets the user keep the asking price visible while modelling against scenario value.
  var lc=num((data.land&&data.land.scenarioLandValue)||(data.land&&data.land.price)||0);

  // ── ASSET-TYPE AWARE GDV for dashboard ─────────────────────────────────
  var isSFHdash=(at==="sfh");

  // SFH GDV: sum house sales from SFH appraisal mix
  var sfhDashGdv=(function(){
    var mix=(data.sfh&&data.sfh.mix)||[];
    var bPsf=num(data.sfh&&data.sfh.basePsf)||num(m.btr*8.5/12)||260;
    var t=0;
    for(var mi=0;mi<mix.length;mi++){
      var row=mix[mi]; var cnt=num(row.count||0);
      if(!cnt)continue;
      var sqft=num(row.sqft||900);
      var uPrice=num(row.unitPrice||0);
      var sp=uPrice&&sqft?uPrice/sqft:(num(row.psf)||bPsf);
      t+=sqft*sp*cnt;
    }
    return t;
  })();
  var sfhDashUnits=(function(){
    var mix=(data.sfh&&data.sfh.mix)||[]; var t=0;
    for(var mi=0;mi<mix.length;mi++){t+=num(mix[mi].count||0);}
    return t||units;
  })();
  var sfhDashBuild=(function(){
    var mix=(data.sfh&&data.sfh.mix)||[];
    var bBuild=num(data.sfh&&data.sfh.buildPsf)||m.build;
    var t=0;
    for(var mi=0;mi<mix.length;mi++){t+=num(mix[mi].sqft||900)*bBuild*num(mix[mi].count||0);}
    return t;
  })();

  // Manual overrides from fin
  var manGdv=num(data.fin&&data.fin.manualGdv||0);
  var manBuild=num(data.fin&&data.fin.manualBuildCost||0);

  // BTR/PBSA yield-based GDV
  var rent=num((data.fin&&data.fin.rent)||m[at==="pbsa"?"pbsa":"btr"]);
  var gr=at==="pbsa"?units*rent*52:units*rent*12;
  var noi=gr>0?gr*0.95-gr*0.95*0.12:0;
  var ey=data.fin&&data.fin.exitYield?num(data.fin.exitYield)/100:0;
  var btrGdvDash=ey>0&&gr>0?noi/ey:0;

  // Build cost — manual > SFH > GIA estimate
  var effBc=manBuild>0?manBuild:(isSFHdash&&sfhDashBuild>0?sfhDashBuild:bc);
  var effUnits=isSFHdash&&sfhDashUnits>0?sfhDashUnits:units;

  // ── CENTRALISED METRICS (single source of truth across all stages) ──
  var DM = calcDealMetrics(data);

  // Shim: keep existing variable names referenced elsewhere in Dashboard
  // but back them with calcDealMetrics output so they stay aligned with Fin/Summary/Reports
  var gdv = DM.gdv > 0 ? DM.gdv : (manGdv>0?manGdv:(isSFHdash&&sfhDashGdv>0?sfhDashGdv:(btrGdvDash>0?btrGdvDash:0)));
  var s106dash = DM.s106 || (isSFHdash?effUnits*num(data.fin&&data.fin.s106pu||0):
    (data.planning&&data.planning.s106?num(data.planning.s106):effUnits*num(data.fin&&data.fin.s106pu||0)));
  var tc = DM.totalCost > 0 ? DM.totalCost + lc : effBc+lc+s106dash+effBc*0.12+effBc*0.05+(effBc+lc)*0.075;

  var profit = DM.actualProfit !== 0 ? DM.actualProfit : (gdv>0&&tc>0?gdv-tc:0);
  var margin = DM.marginPct !== 0 ? DM.marginPct : (gdv>0&&profit!==0?(profit/gdv)*100:0);
  var scM=margin>=15?"#2D7A65":"#B05A35";

  // ── NAVIGATION INDEX — calc both full index (idx) and filtered index (filteredIdx)
  // Next/Previous buttons use filteredIdx so they only walk through stages that
  // are visible in the sidebar for the current scheme + exit combination.
  var idx=ALL_STAGES.findIndex(function(s){return s.id===stage;});
  var curStage=ALL_STAGES[idx]||ALL_STAGES[0];

  // Build the same filtered list the sidebar uses
  var navFilteredStages = ALL_STAGES.filter(stageVisibleForFlow);
  var filteredIdx = navFilteredStages.findIndex(function(s){return s.id===stage;});

  // Reusable "Live Market Data" banner — shown on any stage where PSF matters
  function LiveMarketBanner(){
    var mkt=data.market||{};
    if(!num(mkt.lrPsf))return null;
    var ago=mkt.lrUpdatedAt?Math.round((Date.now()-new Date(mkt.lrUpdatedAt).getTime())/60000):0;
    var fresh=ago<60;
    // v9.28 — Show new-build adjusted PSF for new developments (SFH/BTR/PBSA)
    var pc = (data.land&&data.land.postcode) || mkt.lrPostcode || "";
    var nb = isNewBuildScheme(data.assetType) ? newBuildPsf(pc, num(mkt.lrPsf)) : null;
    return e("div",{style:{background:"linear-gradient(135deg,#2D7A65 0%,#2E5F4E 100%)",color:"#fff",borderRadius:8,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10,fontSize:11,flexWrap:"wrap"}},
      e("span",{style:{fontSize:13}},"📡"),
      e("div",{style:{flex:1,minWidth:200}},
        nb ? e("div",null,
          e("div",{style:{fontWeight:800,fontSize:12,marginBottom:2}},"New-build estimate: £"+nb.newBuild+"/sqft",
            e("span",{style:{fontWeight:400,opacity:0.85,fontSize:10,marginLeft:8}},"(Land Registry £"+nb.existing+"/sqft + "+nb.premiumPct+"% new-build premium)")
          ),
          e("div",{style:{opacity:0.9,fontSize:10}},(mkt.lrTotalTx||0)+" existing-stock sales · "+(mkt.lrSector||mkt.lrPostcode||"area")+" · "+(fresh?"fresh ("+ago+"m ago)":"refresh recommended"))
        ) : e("div",null,
          e("div",{style:{fontWeight:800,fontSize:12,marginBottom:2}},"Live Land Registry: £"+mkt.lrPsf+"/sqft"),
          e("div",{style:{opacity:0.9,fontSize:10}},(mkt.lrTotalTx||0)+" sales · "+(mkt.lrSector||mkt.lrPostcode||"area")+" · "+(fresh?"fresh ("+ago+"m ago)":"refresh recommended"))
        )
      ),
      e("button",{
        onClick:function(){navTo("rlv");},
        style:{background:"rgba(255,255,255,0.2)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:5,padding:"5px 10px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
      },fresh?"View detail →":"Refresh data →")
    );
  }

  function navTo(id){
    var stageInfo=ALL_STAGES.find(function(s){return s.id===id;});
    if(stageInfo && !stageVisibleForFlow(stageInfo)){
      var firstAllowed=navFilteredStages[0] || ALL_STAGES[0];
      id=firstAllowed.id;
      stageInfo=firstAllowed;
    }

    // Log time spent on previous stage before moving
    var timeSpent=Math.round((Date.now()-window._pageStart)/1000);
    if(window._currentStage&&timeSpent>2){
      logEvent(user,"TIME_ON_STAGE",{stage:window._currentStage,seconds:timeSpent,journey:journey});
    }
    if(window._currentStage && window._currentStage!==id && isStageComplete(window._currentStage,data)){
      setData(function(prev){
        var done=Object.assign({},prev._completedStages||{});
        if(!done[window._currentStage]) done[window._currentStage]=new Date().toISOString();
        return Object.assign({},prev,{_completedStages:done});
      });
    }
    window._pageStart=Date.now();
    window._currentStage=id;

    setStage(id);
    logEvent(user,"PAGE_VIEW",{stage:id,journey:journey,assetType:at});

    // Auto-add scheme only before the user has chosen an asset journey.
    if(stageInfo&&schemes.length===0&&!data.assetType){
      if(id==="scraper"||id==="rlv"||id==="land"||id==="landworkflow"){setSchemes(["land"]);setFlowAssetType("land");}
      else if(id==="epe"||id==="epeworkflow"){setSchemes(["property"]);setFlowAssetType("property");}
    }
  }
  function saveDeal(){
    var autoName=(data.land&&data.land.address)||
      (data.scraper&&data.scraper.result&&data.scraper.result.address)||
      "Deal "+new Date().toLocaleDateString("en-GB");
    var name=window.prompt("Name this deal:",autoName)||autoName;
    var effectiveAssetType = schemes.length===1 ? schemes[0] : (data.assetType || "land");
    var dataForSave = Object.assign({}, data, {assetType:effectiveAssetType});
    var snapshot={
      id:Date.now(),name:name,
      savedAt:new Date().toLocaleString("en-GB"),
      assetType:effectiveAssetType,
      city:(data.land&&data.land.city)||"—",
      acres:(data.land&&data.land.acres)||"",
      price:(data.land&&data.land.price)||"",
      data:JSON.parse(JSON.stringify(dataForSave))
    };
    setHistory(function(h){
      var next=[snapshot].concat(h.slice(0,19));
      try{localStorage.setItem("cassidy_history",JSON.stringify(next));}catch(e){}
      return next;
    });
    // Silent log of deal save with full context
    logEvent(user,"DEAL_SAVED",{
      dealName:name,
      assetType:snapshot.assetType,
      city:snapshot.city,
      acres:snapshot.acres,
      price:snapshot.price,
      journey:journey,
      stage:stage,
      gdv:gdv>0?Math.round(gdv):0,
      profit:profit>0?Math.round(profit):0,
      margin:margin>0?Math.round(margin*10)/10:0,
    });

    // ── BACKEND SYNC ─────────────────────────────────────────────────────
    // Push to cloud so deal appears across all devices
    var dealPayload = Object.assign({}, dataForSave, {dealName:name, savedAt:snapshot.savedAt, _savedVersion:CURRENT_VERSION});
    if(user && user.userId){
      // Use POST so the large JSON payload doesn't break URL length limits
      var existingId = (data._cloudDealId) || "";
      fetch(WEBHOOK, {
        method:"POST",
        headers:{"Content-Type":"text/plain;charset=utf-8"},
        body:JSON.stringify({
          action:"save_deal",
          userId:user.userId,
          dealId:existingId,
          payload:JSON.stringify(dealPayload)
        })
      })
      .then(function(r){return r.json();})
      .then(function(d){
        if(d && d.status==="ok"){
          // Stamp this deal with its cloud id so future saves UPDATE rather than CREATE
          if(d.dealId && !existingId){
            setData(function(prev){return Object.assign({},prev,{_cloudDealId:d.dealId});});
          }
          var sizeKb = d.payloadSize ? Math.round(d.payloadSize/1024) : 0;
          var sizeNote = d.chunks && d.chunks>1 ? "\n\n(Deal size: "+sizeKb+"KB across "+d.chunks+" cells — large deals are now fully supported.)" : "";
          alert("✓ Deal saved: "+name+"\n\nSynced to cloud — visible on all your devices."+sizeNote);
        } else {
          alert("✓ Deal saved locally: "+name+"\n\n⚠ Cloud sync failed: "+((d&&d.message)||"unknown error")+"\nDeal is still safe on this device.");
        }
      })
      .catch(function(err){
        alert("✓ Deal saved locally: "+name+"\n\n⚠ Cloud sync failed (offline?)\nDeal is still safe on this device.");
      });
    } else {
      alert("✓ Deal saved locally: "+name+"\n\nYour data auto-saves continuously.");
    }
  }

  // ── SAVE AS NEW DEAL ─────────────────────────────────────────────────
  // Creates a duplicate of the current deal with a new name and new cloud ID,
  // so the original is preserved and the new copy becomes the active deal.
  // Use case: "Maldon SFH" → Save As → "Maldon PBSA" — same site, different end game.
  function saveDealAs(){
    // Build a smart suggested name based on current deal context
    var currentName = data.dealName ||
      (data.land&&data.land.address) ||
      (data.scraper&&data.scraper.result&&data.scraper.result.address) ||
      "Deal";
    var scenario = (data.land&&data.land.appliedScenarioLabel) || "";
    var schemeType = (data.assetType||"").toUpperCase();
    // Suggest "{location} — {scheme}" or "{currentName} v2" if no clean variant available
    var suggestedName;
    if(currentName.indexOf(schemeType)<0 && schemeType){
      suggestedName = currentName + " — " + schemeType + (scenario ? " ("+scenario+")" : "");
    } else {
      suggestedName = currentName + " — variant " + new Date().toLocaleDateString("en-GB");
    }

    var newName = window.prompt(
      "💡 Save As New Deal\n\n"+
      "This creates a copy of the current deal under a new name. The original deal stays unchanged.\n\n"+
      "Useful for: testing different scheme types (SFH vs PBSA) on the same site, "+
      "different planning scenarios, or alternative exit strategies.\n\n"+
      "Name for the new copy:",
      suggestedName
    );
    if(!newName) return;  // user cancelled
    newName = String(newName).trim();
    if(!newName) return;

    // Build a fresh data copy with NEW cloud ID stripped (so backend creates a new row)
    var freshData = JSON.parse(JSON.stringify(data));
    freshData.assetType = schemes.length===1 ? schemes[0] : (freshData.assetType || "land");
    delete freshData._cloudDealId;       // critical — forces new row on save
    freshData.dealName = newName;
    freshData.savedAt = new Date().toLocaleString("en-GB");
    freshData._copiedFrom = data._cloudDealId || null;
    freshData._copiedAt = new Date().toISOString();
    freshData._savedVersion = CURRENT_VERSION;

    // Push fresh copy to cloud
    if(!user || !user.userId){
      alert("⚠ You need to be signed in to save as a new deal.\nThis ensures the original isn't overwritten.");
      return;
    }

    fetch(WEBHOOK, {
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({
        action:"save_deal",
        userId:user.userId,
        dealId:"",  // empty = create new row
        payload:JSON.stringify(freshData)
      })
    })
    .then(function(r){return r.json();})
    .then(function(d){
      if(d && d.status==="ok"){
        // Switch the active deal to the new copy
        setData(function(prev){
          var next = Object.assign({}, freshData, {_cloudDealId:d.dealId});
          return next;
        });
        logEvent(user,"DEAL_SAVED_AS",{
          newName:newName,
          fromDealId:data._cloudDealId || null,
          newDealId:d.dealId,
          assetType:freshData.assetType||"land",
          scenario:scenario||null
        });
        alert("✓ New deal created: "+newName+"\n\n"+
          "• Original deal preserved (return via Portfolio if needed)\n"+
          "• You're now working in the new copy — changes save to this one\n"+
          "• Change scheme type, scenario, or any input to remodel"
        );
      } else {
        alert("⚠ Couldn't create the new copy: "+((d&&d.message)||"unknown error")+"\n\nYour original deal is unaffected.");
      }
    })
    .catch(function(err){
      alert("⚠ Network error creating new copy. Original deal is unaffected. Try again when online.");
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // EXPORT / IMPORT (v9.22)
  // Move deals between accounts (e.g. personal → team shared account).
  // Strips identity-bound fields (_cloudDealId, _migrationLog, _preMigrationBackup)
  // so the deal lands cleanly in the target account.
  // ──────────────────────────────────────────────────────────────────────
  function exportDeal(){
    if(!data || (!data.dealName && !data.land)){
      alert("No deal data to export. Open or create a deal first.");
      return;
    }
    // Strip identity-bound and bulky fields so file is portable & small
    var exportData = JSON.parse(JSON.stringify(data));
    delete exportData._cloudDealId;
    delete exportData._preMigrationBackup;
    delete exportData._migrationLog;
    delete exportData._migrationFrom;
    delete exportData._migrationTo;
    delete exportData._migrationAt;
    delete exportData._migrationReviewRecommended;
    delete exportData._migrationDismissed;
    delete exportData._migrationBannerDismissed;
    delete exportData._migrationRolledBack;
    exportData._exportedAt = new Date().toISOString();
    exportData._exportedFrom = (user && user.email) || "unknown";
    exportData._exportedFromVersion = CURRENT_VERSION;
    exportData._exportFormat = "landform-deal-v1";

    var dealName = data.dealName || (data.land && data.land.city) || "deal";
    var safeName = dealName.replace(/[^a-zA-Z0-9\-_]/g, "_").substring(0, 50);
    var filename = "landform-" + safeName + "-" + new Date().toISOString().slice(0,10) + ".json";
    var json = JSON.stringify(exportData, null, 2);
    var blob = new Blob([json], {type:"application/json"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    try{ logEvent(user,"DEAL_EXPORTED",{dealName:dealName,size:json.length}); }catch(e){}
  }

  function importDeal(){
    // Use a hidden file input to pick the JSON
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json,.json";
    fileInput.onchange = function(ev){
      var file = ev.target.files[0];
      if(!file) return;
      var reader = new FileReader();
      reader.onload = function(e){
        try{
          var imported = JSON.parse(e.target.result);
          // Validate it looks like a Landform export
          if(imported._exportFormat !== "landform-deal-v1" && !imported.land && !imported.dealName){
            if(!confirm("This file doesn't look like a standard Landform export. Try to import anyway?\n\n(Risk: data may be incomplete or wrongly structured.)")) return;
          }
          // Strip identity from previous account
          delete imported._cloudDealId;
          delete imported._preMigrationBackup;
          delete imported._migrationLog;
          delete imported._migrationBannerDismissed;
          delete imported._migrationDismissed;
          // Stamp imported metadata
          imported._importedAt = new Date().toISOString();
          imported._importedBy = (user && user.email) || "unknown";
          imported._importedFromAccount = imported._exportedFrom || "unknown";

          var sourceName = imported.dealName || (imported.land && imported.land.city) || "Imported Deal";
          var suggested = "[Imported] " + sourceName;
          var finalName = window.prompt("Name for the imported deal in your portfolio:", suggested);
          if(!finalName) return;
          imported.dealName = finalName.trim();
          imported.savedAt = new Date().toLocaleString("en-GB");

          // Run migration to bring it up to current version
          var migrated = migrateLoadedDeal(imported);
          setData(migrated.data);
          if(migrated.data && migrated.data.assetType) setSchemes([migrated.data.assetType]);
          if(migrated.changed) logMigration(migrated);
          navTo("dashboard");
          alert("✓ Deal imported. Click 'Save Deal' to add it to your portfolio.");
          try{ logEvent(user,"DEAL_IMPORTED",{dealName:finalName,fromAccount:imported._importedFromAccount}); }catch(e){}
        }catch(err){
          alert("⚠ Could not import file: "+(err.message||err)+"\n\nMake sure the file is a valid Landform export JSON.");
        }
      };
      reader.readAsText(file);
    };
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  }

  function clearDeal(){
    if(!window.confirm("Clear all fields and start a new deal?"))return;
    setData({risks:RISK_DEFAULTS.map(function(r){return Object.assign({},r);})});
    setSchemes([]); setExits([]);
    setHot("");setMemo("");setStage("dashboard");
  }

  function loadDeal(snap){
    var migrated = migrateLoadedDeal(snap.data);
    setData(migrated.data);
    if(migrated.data && migrated.data.assetType) setSchemes([migrated.data.assetType]);
    if(migrated.changed) logMigration(migrated);
    setStage("dashboard");setShowHist(false);
  }

  // ──────────────────────────────────────────────────────────────────────
  // AUTO-MIGRATION (v9.16)
  // When a deal is loaded from portfolio (local or cloud), this function runs
  // automatically to apply safe fixes for known bugs in older versions.
  //
  // Philosophy: only fix what's STRUCTURALLY PROVABLE (e.g. scheme type
  // mismatch where assetType clearly contradicts schType). Don't touch
  // numeric values the user may have deliberately entered (salePsf, buildPsf
  // as overrides). Keep a backup so user can restore if needed.
  // ──────────────────────────────────────────────────────────────────────
  /* migrateLoadedDeal moved to its own file — see js/ (loaded before this script) */

  function logMigration(migrationResult){
    try{
      logEvent(user,"DEAL_AUTO_MIGRATED",{
        from:migrationResult.data._migrationFrom,
        to:migrationResult.data._migrationTo,
        fixCount:migrationResult.migrations.length,
        reviewCount:(migrationResult.reviewRecommended||[]).length,
        fields:migrationResult.migrations.map(function(m){return m.field;}).join(",")
      });
    }catch(e){}
  }

  // ── PLANNING RECOVERY JOURNEY ────────────────────────────────────────────────
  /* renderRecovery moved to js/screen-Recovery.js */

  // ── EXECUTIVE SUMMARY ────────────────────────────────────────────────────────
  // ── BRANDED PDF REPORT GENERATOR ──────────────────────────────────────────
  function generateReport(){
    var addr=data.land&&data.land.address||"Development Site";
    var lpa=data.planning&&data.planning.lpa||"—";
    var assetLabel=at==="sfh"?"Single Family Housing":at==="btr"?"Build to Rent":"PBSA";
    var cityLabel=city?cityName(city):"—";
    var reportDate=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});

    // Get all key figures
    var gdvVal=gdv>0?gdv:0;
    var tcVal=tc>0?tc:0;
    var profitVal=profit;
    var marginVal=margin;
    var unitsVal=effUnits||units||0;
    var lcVal=lc>0?lc:0;
    var f2=data.fin||{};
    var s2=data.sfh||{};
    var basePsf=num(s2.basePsf)||260; // fallback £/sqft for unit rows missing their own psf (was undefined -> threw)
    var p2=data.planning||{};
    var l2=data.land||{};
    var sfhMixHtml="";
    if(s2.mix&&s2.mix.length>0){
      var mixRows=s2.mix.filter(function(r){return num(r.count)>0;}).map(function(r){
        var uPrice=num(r.unitPrice||0)||(num(r.sqft||900)*num(r.psf||basePsf));
        return "<tr><td>"+r.type+"</td><td>"+r.beds+"</td><td>"+r.count+"</td><td>"+num(r.sqft||900)+"</td><td>"+fmt(uPrice)+"</td><td>"+fmt(uPrice*num(r.count))+"</td></tr>";
      }).join("");
      sfhMixHtml='<table class="data-table"><thead><tr><th>House Type</th><th>Beds</th><th>Plots</th><th>Sqft</th><th>Unit Price</th><th>Revenue</th></tr></thead><tbody>'+mixRows+'</tbody></table>';
    }

    // Risks
    var risks2=data.risks||[];
    var redRisks=risks2.filter(function(r){return r.rag==="red";});
    var amberRisks=risks2.filter(function(r){return r.rag==="amber";});
    var risksHtml=risks2.slice(0,8).map(function(r){
      var c=r.rag==="red"?"#B05A35":r.rag==="amber"?"#9A7B3E":"#2D7A65";
      return '<tr><td><span style="color:'+c+';font-weight:700">'+r.rag.toUpperCase()+'</span></td><td>'+r.category+'</td><td>'+r.risk+'</td><td>'+r.mitigation+'</td></tr>';
    }).join("");

    // AI deal assessment
    var aiAssessment="";
    try{
      var aiData=data.masterReport?JSON.parse(data.masterReport):{};
      if(aiData.goNoGo){
        aiAssessment='<div class="verdict-box verdict-'+aiData.goNoGo.toLowerCase()+'">'+
          '<div class="verdict-label">AI Deal Assessment: '+aiData.goNoGo+'</div>'+
          '<div class="verdict-reason">'+(aiData.goNoGoReason||"")+'</div>'+
          (aiData.recommendedBid?'<div class="verdict-bid">Recommended Bid: '+fmt(aiData.recommendedBid)+'</div>':'')+'</div>';
      }
    }catch(e){}

    // S-curve data
    var progMths=num(f2.programmeMths||36);
    var salesRate=num(f2.salesRateWeek||0.75);

    var html='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'+
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>'+
    '<title>Development Appraisal — '+addr+'</title>'+
    '<style>'+
    '*{box-sizing:border-box;margin:0;padding:0}'+
    'body{font-family:Arial,Helvetica,sans-serif;color:#1A1A3E;background:#fff;font-size:11px;line-height:1.5}'+
    '.page{max-width:210mm;margin:0 auto;padding:0}'+
    '/* COVER */'+
    '.cover{background:linear-gradient(135deg,#1E1F5C,#2E2F8A);color:#fff;padding:60px 50px;min-height:200px;position:relative}'+
    '.cover-logo{width:100px;margin-bottom:30px}'+
    '.cover h1{font-size:28px;font-weight:900;margin-bottom:8px;line-height:1.2}'+
    '.cover h2{font-size:16px;font-weight:400;color:rgba(255,255,255,0.7);margin-bottom:30px}'+
    '.cover-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:30px}'+
    '.cover-meta-item label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,0.5);display:block}'+
    '.cover-meta-item span{font-size:13px;font-weight:700;color:#EDE84A}'+
    '.cover-bar{height:4px;background:#EDE84A;margin-top:40px}'+
    '/* SECTIONS */'+
    '.section{padding:30px 40px;border-bottom:1px solid #EAEBF5}'+
    '.section-title{font-size:14px;font-weight:800;color:#2E2F8A;text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #EDE84A}'+
    '/* METRIC GRID */'+
    '.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}'+
    '.metric{background:#F7F8FC;border:1px solid #DDE0ED;border-top:3px solid #4A4BAE;border-radius:6px;padding:12px;text-align:center}'+
    '.metric.green{border-top-color:#2D7A65}.metric.red{border-top-color:#B05A35}.metric.gold{border-top-color:#9A7B3E}'+
    '.metric label{font-size:8px;color:#7278A0;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:4px}'+
    '.metric span{font-size:18px;font-weight:800;color:#2E2F8A}'+
    '/* SCENARIO GRID */'+
    '.scenarios{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0}'+
    '.scenario{border:1px solid #DDE0ED;border-radius:6px;padding:12px}'+
    '.scenario h4{font-size:10px;font-weight:700;color:#4A4BAE;margin-bottom:8px;text-transform:uppercase}'+
    '.scenario-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #F0F0F0;font-size:10px}'+
    '/* TABLE */'+
    '.data-table{width:100%;border-collapse:collapse;font-size:10px;margin:12px 0}'+
    '.data-table th{background:#2E2F8A;color:#fff;padding:7px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em}'+
    '.data-table td{padding:6px 10px;border-bottom:1px solid #EAEBF5}'+
    '.data-table tr:nth-child(even) td{background:#F7F8FC}'+
    '/* VERDICT */'+
    '.verdict-box{border-radius:8px;padding:16px 20px;margin:12px 0}'+
    '.verdict-go{background:rgba(45,122,101,0.1);border:2px solid #2D7A65}'+
    '.verdict-caution{background:rgba(154,123,62,0.1);border:2px solid #9A7B3E}'+
    '.verdict-no-go{background:rgba(176,90,53,0.1);border:2px solid #B05A35}'+
    '.verdict-label{font-size:14px;font-weight:800;margin-bottom:6px}'+
    '.verdict-go .verdict-label{color:#2D7A65}.verdict-caution .verdict-label{color:#9A7B3E}.verdict-no-go .verdict-label{color:#B05A35}'+
    '.verdict-reason{font-size:11px;color:#3A3D6A;line-height:1.6}'+
    '.verdict-bid{font-size:13px;font-weight:700;color:#2E2F8A;margin-top:8px}'+
    '/* COMMERCIAL SPLIT */'+
    '.split-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0}'+
    '.split-card{border-radius:6px;padding:14px;border:1px solid #DDE0ED}'+
    '.split-card h4{font-size:10px;font-weight:700;margin-bottom:10px}'+
    '.split-bar{height:8px;background:#DDE0ED;border-radius:4px;overflow:hidden;display:flex;margin:6px 0}'+
    '/* RISK */'+
    '.risk-summary{display:flex;gap:16px;margin-bottom:12px}'+
    '.risk-badge{border-radius:20px;padding:4px 14px;font-size:10px;font-weight:700}'+
    '.risk-red{background:rgba(176,90,53,0.15);color:#B05A35}'+
    '.risk-amber{background:rgba(154,123,62,0.15);color:#9A7B3E}'+
    '.risk-green{background:rgba(45,122,101,0.15);color:#2D7A65}'+
    '/* FOOTER */'+
    '.footer{background:#F7F8FC;padding:16px 40px;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#7278A0;border-top:2px solid #DDE0ED}'+
    '@media print{'+
    'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
    '.section{page-break-inside:avoid}'+
    '.cover{page-break-after:always}'+
    '}'+
    '</style></head><body>'+

    // COVER PAGE
    '<div class="cover">'+
    '<img class="cover-logo" src="data:image/webp;base64,'+LOGO+'" alt="Cassidy Group"/>'+
    '<h1>Development Appraisal</h1>'+
    '<h2>'+addr+'</h2>'+
    '<div class="cover-bar"></div>'+
    '<div class="cover-meta">'+
    '<div class="cover-meta-item"><label>City / Market</label><span>'+cityLabel+'</span></div>'+
    '<div class="cover-meta-item"><label>Asset Type</label><span>'+assetLabel+'</span></div>'+
    '<div class="cover-meta-item"><label>Local Planning Authority</label><span>'+lpa+'</span></div>'+
    '<div class="cover-meta-item"><label>Report Date</label><span>'+reportDate+'</span></div>'+
    '<div class="cover-meta-item"><label>GDV</label><span>'+(gdvVal>0?fmt(gdvVal):"TBC")+'</span></div>'+
    '<div class="cover-meta-item"><label>Target Margin</label><span>'+(marginVal?Math.round(marginVal)+"%":"TBC")+'</span></div>'+
    '</div>'+
    '</div>'+

    // SECTION 1 - FINANCIAL SUMMARY
    '<div class="section">'+
    '<div class="section-title">1. Financial Summary</div>'+
    aiAssessment+
    '<div class="metrics">'+
    '<div class="metric '+(gdvVal>0?"":"")+'"><label>Gross Development Value</label><span>'+(gdvVal>0?fmt(gdvVal):"—")+'</span></div>'+
    '<div class="metric"><label>Total Development Cost</label><span>'+(tcVal>0?fmt(tcVal):"—")+'</span></div>'+
    '<div class="metric '+(profitVal>0?"green":"red")+'"><label>Developer Profit</label><span>'+(profitVal?fmt(profitVal):"—")+'</span></div>'+
    '<div class="metric '+(marginVal>=15?"green":marginVal>=0?"gold":"red")+'"><label>Margin on GDV</label><span>'+(marginVal?Math.round(marginVal)+"%":"—")+'</span></div>'+
    '<div class="metric"><label>Units / Beds</label><span>'+(unitsVal||"—")+'</span></div>'+
    '<div class="metric"><label>Land Cost</label><span>'+(lcVal>0?fmt(lcVal):"—")+'</span></div>'+
    '<div class="metric"><label>Build Cost psf</label><span>£'+(f2.buildPsf||"—")+'/sqft</span></div>'+
    '<div class="metric"><label>Finance Rate</label><span>'+(f2.finRate||f2.finRatePa||"—")+'%</span></div>'+
    '</div>'+

    // Bear/Base/Bull
    '<div class="scenarios">'+
    '<div class="scenario"><h4>🐻 Bear Case</h4>'+
    '<div class="scenario-row"><span>GDV</span><span>'+fmt(gdvVal*0.9)+'</span></div>'+
    '<div class="scenario-row"><span>Margin</span><span>'+(gdvVal>0?Math.round(((gdvVal*0.9-tcVal*1.1)/(gdvVal*0.9))*100)+"%":"—")+'</span></div>'+
    '</div>'+
    '<div class="scenario"><h4>📊 Base Case</h4>'+
    '<div class="scenario-row"><span>GDV</span><span>'+fmt(gdvVal)+'</span></div>'+
    '<div class="scenario-row"><span>Margin</span><span>'+Math.round(marginVal)+"%</span></div>"+
    '</div>'+
    '<div class="scenario"><h4>🚀 Bull Case</h4>'+
    '<div class="scenario-row"><span>GDV</span><span>'+fmt(gdvVal*1.1)+'</span></div>'+
    '<div class="scenario-row"><span>Margin</span><span>'+(gdvVal>0?Math.round(((gdvVal*1.1-tcVal*0.9)/(gdvVal*1.1))*100)+"%":"—")+'</span></div>'+
    '</div>'+
    '</div>'+
    '</div>'+

    // SECTION 2 - SITE & PLANNING
    '<div class="section">'+
    '<div class="section-title">2. Site & Planning</div>'+
    '<div class="metrics">'+
    '<div class="metric"><label>Site Area</label><span>'+(l2.acres||"—")+" acres</span></div>"+
    '<div class="metric"><label>Planning Status</label><span>'+(p2.status||"—")+'</span></div>'+
    '<div class="metric"><label>Affordable Housing</label><span>'+(p2.ahPct||"—")+"%</span></div>"+
    '<div class="metric"><label>S106 Total</label><span>'+fmt(num(f2.s106pu||0)*unitsVal)+'</span></div>'+
    '</div>'+
    '<table class="data-table">'+
    '<thead><tr><th>Planning Factor</th><th>Detail</th></tr></thead>'+
    '<tbody>'+
    '<tr><td>Local Planning Authority</td><td>'+lpa+'</td></tr>'+
    '<tr><td>Planning Status</td><td>'+(p2.status||"Not set")+'</td></tr>'+
    '<tr><td>Planning Risk</td><td>'+(p2.riskLevel||"Not assessed")+'</td></tr>'+
    '<tr><td>Affordable Housing %</td><td>'+(p2.ahPct||"—")+"%</td></tr>"+
    '<tr><td>BNG Requirement</td><td>10% mandatory (NPPF 2024)</td></tr>'+
    '<tr><td>Fire Safety Gateway</td><td>'+(p2.storeys>17?"Gateway 2 — mandatory":p2.storeys>10?"Check required":"Not required")+'</td></tr>'+
    '</tbody></table>'+
    '</div>'+

    // SECTION 3 - HOUSE TYPE MIX (SFH only)
    (sfhMixHtml?'<div class="section"><div class="section-title">3. House Type Mix & Revenue</div>'+sfhMixHtml+'</div>':"")+

    // SECTION 4 - COMMERCIAL SPLIT
    (lcVal>0||gdvVal>0?'<div class="section">'+
    '<div class="section-title">'+(sfhMixHtml?"4":"3")+'. Landowner vs Cassidy Commercial Split</div>'+
    '<div class="split-grid">'+
    (function(){
      var agriVal=num(l2.acres||0)*15000;
      var rlvVal=Math.max(0,gdvVal-tcVal-gdvVal*0.175);
      var uplift=Math.max(0,rlvVal-agriVal);
      var scenarios3=[
        {label:"Pre-Planning Sale",lo:agriVal,cg:rlvVal-agriVal+profitVal,color:"#B05A35"},
        {label:"Post-Outline",lo:Math.round(rlvVal*0.65),cg:Math.round(rlvVal*0.35)+profitVal,color:"#9A7B3E"},
        {label:"Post-Full Consent",lo:Math.round(rlvVal*0.85),cg:Math.round(rlvVal*0.15)+profitVal,color:"#2D7A65"},
      ];
      return scenarios3.map(function(sc){
        var total=Math.max(1,sc.lo+Math.max(0,sc.cg));
        var loPct=Math.round(sc.lo/total*100);
        return '<div class="split-card"><h4 style="color:'+sc.color+'">'+sc.label+'</h4>'+
          '<div class="scenario-row"><span>Landowner</span><span style="font-weight:700;color:'+sc.color+'">'+fmt(Math.max(0,sc.lo))+'</span></div>'+
          '<div class="scenario-row"><span>Cassidy Group</span><span style="font-weight:700;color:#2D7A65">'+fmt(Math.max(0,sc.cg))+'</span></div>'+
          '<div class="split-bar"><div style="width:'+loPct+'%;background:'+sc.color+'"></div><div style="flex:1;background:#2D7A65"></div></div>'+
          '<div style="font-size:9px;color:#7278A0">Landowner '+loPct+'% / Cassidy '+(100-loPct)+'%</div>'+
          '</div>';
      }).join("");
    })()+
    '</div></div>':"" )+

    // SECTION 5 - RISK REGISTER
    (risks2.length>0?'<div class="section">'+
    '<div class="section-title">'+(sfhMixHtml?"5":"4")+'. Risk Register</div>'+
    '<div class="risk-summary">'+
    '<span class="risk-badge risk-red">'+redRisks.length+' Red</span>'+
    '<span class="risk-badge risk-amber">'+amberRisks.length+' Amber</span>'+
    '<span class="risk-badge risk-green">'+(risks2.length-redRisks.length-amberRisks.length)+' Green</span>'+
    '</div>'+
    '<table class="data-table"><thead><tr><th>RAG</th><th>Category</th><th>Risk</th><th>Mitigation</th></tr></thead>'+
    '<tbody>'+risksHtml+'</tbody></table>'+
    '</div>':"" )+

    // FOOTER
    '<div class="footer">'+
    '<div><strong>Cassidy Group Ltd</strong> — Confidential Development Appraisal</div>'+
    '<div>'+addr+' | '+reportDate+'</div>'+
    '<div>Landform Intelligence Platform — Built by Phil Daniel</div>'+
    '</div>'+

    '</body></html>';

    var w=window.open("","_blank","width=900,height=700");
    if(!w){alert("Please allow popups for this site to generate the report.");return;}
    w.document.write(html);
    w.document.close();
    setTimeout(function(){w.print();},800);
  }

  function renderSummary(){
    var l=data.land||{};
    var r=data.rlv||{};
    var p=data.planning||{};
    var f=data.fin||{};
    var ex=data.exit||{};
    var ep=data.epe||{};
    var sf=data.sfh||{};
    var hr=data.hra||{};
    var rc=data.recovery||{};

    var addr=l.address||(data.scraper&&data.scraper.result&&data.scraper.result.address)||ep.streetAddress||"Not specified";
    var pc=r.postcode||ep.postcode||"";
    var lCity2=l.city||city||"";
    var acres2=num(l.acres||sf.acres||0);
    var askingPrice2=num(l.price||rc.knockdownPrice||0);
    var lpa2=p.lpa||l.localAuthority||"Not specified";
    var planStatus2=p.status||l.planStatus||"Not specified";
    var totalUnits2=num(p.units||sf.units||hr.total||0);
    var assetLabel={btr:"Build to Rent (BTR)",pbsa:"Purpose Built Student Accommodation (PBSA)",sfh:"Single Family Housing (SFH)"}[at]||at.toUpperCase();
    var journeyLabel={land:"Land Acquisition",property:"Property Evaluation",sfh:"SFH Development",btr:"BTR Development",pbsa:"PBSA Development",recovery:"Planning Recovery"}[journey]||"Development";
    var today=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});

    // Calculate completion status of each section
    var sections=[
      {label:"Land / Site Details",done:!!(l.address&&l.acres&&l.price),key:"land"},
      {label:"Land Valuation (RLV)",done:!!(r.units&&r.salePsf),key:"rlv"},
      {label:"Land Appraisal (Scored)",done:!!(l.city&&l.proximity),key:"land_appraisal"},
      {label:"Planning & Viability",done:!!(p.lpa&&p.units),key:"planning"},
      {label:"Financial Modelling",done:!!(f.exitYield||f.buildPsf),key:"fin"},
      {label:"Due Diligence",done:Object.keys(data.ddChecked||{}).filter(function(k){return data.ddChecked[k];}).length>5,key:"dd"},
      {label:"Risk Register",done:!!(data.risks&&data.risks.length>0),key:"risks"},
      {label:"Exit Strategy",done:!!(ex.strategy),key:"exit"},
    ];
    var completedSections=sections.filter(function(s){return s.done;}).length;
    var completionPct=Math.round((completedSections/sections.length)*100);

    // Summary AI state
    var sumLoading=data.sumLoading||false;
    var sumReport=data.sumReport||"";

    function generateSummary(){
      setData(function(d){return Object.assign({},d,{sumLoading:true,sumReport:""});});

      var dealData={
        address:addr,postcode:pc,city:cityName(lCity2),acres:acres2,
        askingPrice:askingPrice2,assetType:assetLabel,journey:journeyLabel,
        lpa:lpa2,planningStatus:planStatus2,units:totalUnits2,
        gdv:gdv,totalDevCost:tc,profit:profit,margin:margin,
        exitYield:ey*100,noi:noi,exitStrategy:ex.strategy||"Not set",
        sfhMix:sf.mix?sf.mix.filter(function(m){return num(m.count)>0;}).map(function(m){return m.count+"x "+m.type;}).join(", "):"",
        riskCount:(data.risks||[]).length,
        redRisks:(data.risks||[]).filter(function(r2){return r2.rag==="red";}).length,
        ddComplete:Object.keys(data.ddChecked||{}).filter(function(k){return data.ddChecked[k];}).length,
        completionPct:completionPct,
        agent:data.scraper&&data.scraper.result&&data.scraper.result.agent||"",
        description:data.scraper&&data.scraper.result&&data.scraper.result.description||"",
        planningStatus2:planStatus2,
        recoveryRoute:rc.refusalType||"",
      };

      var prompt="Write a professional executive summary for this real estate development deal. Format as a structured deal brief that could be shared with investors or partners.\n\nDEAL DATA:\n"+JSON.stringify(dealData)+"\n\nWrite the summary with these 9 sections:\n1. DEAL OVERVIEW\n2. SITE & LOCATION\n3. DEVELOPMENT PROPOSAL\n4. FINANCIAL SUMMARY\n5. PLANNING POSITION\n6. EXIT STRATEGY\n7. KEY RISKS\n8. NEXT STEPS\n9. DEAL RATING (score 1-10 with justification)\n\nTone: Professional, commercially sharp, suitable for institutional investors. Plain text. Be specific with the actual numbers provided.";

      var params=new URLSearchParams({
        action:"ai",stage:"Executive Summary",
        user:(user&&user.name)||"",company:(user&&user.company)||"",
        system:"You are a senior real estate investment analyst. Write clear, commercially sharp executive summaries for development deals. Plain text only. Use UK conventions and formatting.",
        prompt:prompt.substring(0,3000)
      });

      fetch(WEBHOOK+"?"+params.toString())
      .then(function(res){return res.json();})
      .then(function(d2){
        var text=d2.result||"Failed to generate summary";
        setData(function(d){return Object.assign({},d,{sumLoading:false,sumReport:text});});
        logEvent(user,"EXEC_SUMMARY",{address:addr,completion:completionPct+"%"});
      })
      .catch(function(){
        setData(function(d){return Object.assign({},d,{sumLoading:false,sumReport:"Connection failed — please try again."});});
      });
    }

    return e("div",null,
      // Header
      e("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}},
        e("div",null,
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:12}},
        e("div",null,
          e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Executive Summary")
        ),
        e("button",{
          onClick:generateReport,
          style:{padding:"10px 22px",background:"linear-gradient(135deg,#B05A35,#9A4A28)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif",boxShadow:"0 3px 12px rgba(176,90,53,0.3)",display:"flex",alignItems:"center",gap:8}
        },
          e("span",{style:{fontSize:18}},"🖨"),
          e("span",null,"Print / PDF Report")
        )
      ),
          e("p",{style:{fontSize:12,color:"#7278A0"}},"Live deal brief — generates from your completed stages. Share with investors and partners.")
        ),
        e("div",{style:{textAlign:"right"}},
          e("div",{style:{fontSize:11,color:"#7278A0"}},today),
          e("div",{style:{fontSize:11,color:"#7278A0"}},(user&&user.company)||"Cassidy Group"),
          e("div",{style:{fontSize:11,fontWeight:700,color:"#4A4BAE",marginTop:4}},journeyLabel+" Journey")
        )
      ),

      // Completion tracker
      e("div",{style:S.card},
        e("div",{style:{display:"flex",alignItems:"center",gap:16,marginBottom:12}},
          e("div",{style:{fontSize:48,fontWeight:800,color:completionPct>=75?"#2D7A65":completionPct>=50?"#9A7B3E":"#B05A35",lineHeight:1,minWidth:70}},completionPct+"%"),
          e("div",{style:{flex:1}},
            e("div",{style:{height:8,background:"#DDE0ED",borderRadius:4,overflow:"hidden",marginBottom:8}},
              e("div",{style:{height:"100%",width:completionPct+"%",background:completionPct>=75?"#2D7A65":completionPct>=50?"#9A7B3E":"#B05A35",borderRadius:4,transition:"width .5s"}})
            ),
            e("div",{style:{fontSize:12,color:"#7278A0"}},completedSections+" of "+sections.length+" sections completed")
          )
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}},
          sections.map(function(s){
            return e("div",{key:s.label,
              onClick:function(){
                var stageMap={land:"land",rlv:"rlv",land_appraisal:"land",planning:"planning",fin:"fin",dd:"dd",risks:"risks",exit:"exit"};
                navTo(stageMap[s.key]||s.key);
              },
              style:{display:"flex",alignItems:"center",gap:6,padding:"8px 10px",borderRadius:6,background:s.done?"rgba(45,122,101,0.06)":"rgba(176,90,53,0.04)",border:"1px solid "+(s.done?"rgba(45,122,101,0.25)":"rgba(176,90,53,0.15)"),cursor:"pointer"}
            },
              e("div",{style:{width:14,height:14,borderRadius:"50%",background:s.done?"#2D7A65":"#DDE0ED",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:9}},s.done?"✓":""),
              e("span",{style:{fontSize:10,color:s.done?"#2E2F8A":"#B05A35",fontWeight:s.done?600:400}},s.label)
            );
          })
        )
      ),

      // Deal snapshot cards
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}},
        [
          {l:"Site",v:acres2>0?acres2+" acres":"—",sub:cityName(lCity2)||"—",c:"#4A4BAE"},
          {l:"Asking Price",v:askingPrice2>0?fmt(askingPrice2):"—",sub:"Acquisition",c:"#9A7B3E"},
          {l:"GDV",v:gdv>0?fmt(gdv):"—",sub:"Gross Dev Value",c:"#2D7A65"},
          {l:"Net Profit",v:profit>0?fmt(profit):"—",sub:margin>0?pct(margin)+" margin":"—",c:margin>=15?"#2D7A65":"#B05A35"},
          {l:"Units / Beds",v:totalUnits2||"—",sub:assetLabel,c:"#4A4BAE"},
          {l:"Exit Yield",v:ey>0?pct(ey*100):"—",sub:"Target",c:"#9A7B3E"},
          {l:"Planning",v:planStatus2||"—",sub:lpa2,c:"#7B6CB0"},
          {l:"Exit",v:ex.strategy?{plot_sales:"Plot Sales",forward_fund:"Fwd Fund",forward_sale:"Fwd Sale",stabilised:"Stabilised",retain:"Retain",phased:"Phased"}[ex.strategy]||ex.strategy:"—",sub:"Strategy",c:"#B05A35"},
        ].map(function(item){
          return e("div",{key:item.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid "+item.c,borderRadius:8,padding:14}},
            e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}},item.l),
            e("div",{style:{fontSize:18,fontWeight:800,color:item.c,marginBottom:2}},item.v),
            e("div",{style:{fontSize:10,color:"#7278A0"}},item.sub)
          );
        })
      ),

      // Generate button + report
      e("div",{style:S.card},
        e("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}},
          e("div",null,
            e("div",{style:S.cardTitle},"AI Generated Executive Summary"),
            e("div",{style:{fontSize:11,color:"#7278A0"}},"Generates from all completed stages. Re-run any time as you add more data.")
          ),
          e("div",{style:{display:"flex",gap:8}},
            e("button",{onClick:generateSummary,disabled:sumLoading,
              style:{padding:"10px 20px",background:sumLoading?"#8889C8":"#2E2F8A",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:700,cursor:sumLoading?"not-allowed":"pointer",fontFamily:"DM Sans,sans-serif"}},
              sumLoading?"⏳ Generating...":"📄 Generate Summary"),
            sumReport&&e("button",{
              onClick:function(){
                var el=document.createElement("textarea");
                el.value="EXECUTIVE SUMMARY\n"+today+"\n"+(user&&user.company||"Cassidy Group")+"\n\n"+sumReport;
                document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);
                alert("✓ Copied to clipboard — paste into Word or email");
              },
              style:{padding:"10px 16px",background:"#F7F8FC",border:"1px solid #DDE0ED",color:"#3A3D6A",borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },"📋 Copy")
          )
        ),
        completionPct<30&&!sumReport&&e("div",{style:{background:"rgba(154,123,62,0.08)",border:"1px solid rgba(154,123,62,0.25)",borderRadius:8,padding:"14px 16px",fontSize:12,color:"#7A5A2E",marginBottom:14}},
          "⚠ Only "+completionPct+"% complete. Fill in more stages for a richer summary. At minimum: Land details, Planning, and Financials should be completed."
        ),
        sumReport?e("div",{style:{background:"#FAFBFF",border:"1px solid #DDE0ED",borderRadius:8,padding:"24px 28px"}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,paddingBottom:16,borderBottom:"2px solid #DDE0ED"}},
            e("div",null,
              e("div",{style:{fontSize:18,fontWeight:800,color:"#2E2F8A",marginBottom:2}},addr||"Development Opportunity"),
              e("div",{style:{fontSize:12,color:"#7278A0"}},assetLabel+(acres2?" · "+acres2+" acres":"")+(lCity2?" · "+cityName(lCity2):""))
            ),
            e("div",{style:{textAlign:"right",fontSize:11,color:"#7278A0"}},
              e("div",{style:{fontWeight:700,color:"#4A4BAE"}},(user&&user.company)||"Cassidy Group"),
              e("div",null,today),
              e("div",{style:{marginTop:4,padding:"3px 10px",background:"rgba(45,122,101,0.1)",color:"#2D7A65",borderRadius:10,fontSize:10,fontWeight:700,display:"inline-block"}},completionPct+"% Complete")
            )
          ),
          e("pre",{style:{fontSize:13,lineHeight:2.1,color:"#2E2F8A",whiteSpace:"pre-wrap",fontFamily:"Georgia, 'Times New Roman', serif"}},sumReport),
          e("div",{style:{marginTop:20,paddingTop:16,borderTop:"1px solid #DDE0ED",fontSize:10,color:"#7278A0",fontStyle:"italic"}},
            "Generated by Cassidy Group Land & Development Intelligence · "+today+" · For internal use only — not for distribution without authorisation."
          )
        ):e("div",{style:{textAlign:"center",padding:"40px 20px",color:"#7278A0"}},
          e("div",{style:{fontSize:40,marginBottom:12}},"📄"),
          e("div",{style:{fontSize:13,fontWeight:600,color:"#2E2F8A",marginBottom:6}},"No summary generated yet"),
          e("div",{style:{fontSize:12}},"Click Generate Summary above to create your executive brief")
        )
      )
    );
  }

  // ── LAND DEVELOPMENT WORKFLOW ────────────────────────────────────────────────
  /* renderLandWorkflow moved to js/screen-LandWorkflow.js */

  // ── PROCESS FLOWCHARTS ────────────────────────────────────────────────────────
  /* renderFlowcharts moved to js/screen-Flowcharts.js */

  // ── EXECUTIVE SUMMARY ────────────────────────────────────────────────────────
  // ── EPE WORKFLOW ──────────────────────────────────────────────────────────────
  /* renderEPEWorkflow moved to js/screen-EPEWorkflow.js */

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  // ── PLANNING MONITOR ──────────────────────────────────────────────────────
  /* renderPlanningMonitor moved to js/screen-PlanningMonitor.js */

  // ── CONSTRAINT CHECK ───────────────────────────────────────────────────────
  /* renderConstraintCheck moved to js/screen-ConstraintCheck.js (loaded before this script) */

  // ── MEETING TRANSCRIPTS ────────────────────────────────────────────────────
  /* renderMeetings moved to js/screen-Meetings.js (loaded before this script) */

  // ── DETAILED VIABILITY APPRAISAL ────────────────────────────────────────────
  /* renderViability moved to js/screen-Viability.js */


  // ══════════════════════════════════════════════════════════════════════════
  // SITE SCORECARD
  // ══════════════════════════════════════════════════════════════════════════
  /* renderScorecard moved to js/screen-Scorecard.js */

  // ══════════════════════════════════════════════════════════════════════════
  // TEASER PDF
  // ══════════════════════════════════════════════════════════════════════════
  /* renderTeaser moved to js/screen-Teaser.js */

  // ══════════════════════════════════════════════════════════════════════════
  // INVESTOR MEMORANDUM
  // ══════════════════════════════════════════════════════════════════════════
  /* renderIM moved to js/screen-IM.js */


  // ══════════════════════════════════════════════════════════════════════════
  // DATA ROOM — Two-Room Architecture
  //   INTERNAL: full truth — commercial intel, CRM, AI machinery, private notes
  //   EXTERNAL: investor-curated — confidence-building, redacted, controlled
  // ══════════════════════════════════════════════════════════════════════════
  /* renderDataRoom moved to js/screen-DataRoom.js */


  // ══════════════════════════════════════════════════════════════════════════
  // GRANT & FUNDING INTELLIGENCE
  // ══════════════════════════════════════════════════════════════════════════
  /* renderGrants moved to js/screen-Grants.js */


  // ══════════════════════════════════════════════════════════════════════════
  // CAPITALISATION — Rental Income & Investment Value Calculator
  // ══════════════════════════════════════════════════════════════════════════
  /* renderCapitalise moved to js/screen-Capitalise.js */



  // ══════════════════════════════════════════════════════════════════════════
  // PLACONA AGENT — Land Discovery & Site Inbox
  // ══════════════════════════════════════════════════════════════════════════
  // ── loadSiteIntoDeal — lifted out of renderPlacona to Tool scope (fixes the
// dashboard "Load Deal" button, which referenced it from a sibling scope).
function loadSiteIntoDeal(site){
      // ── Helper: skip junk values that shouldn't overwrite real defaults ──
      function ok(v){return v&&v!=="Not found"&&v!=="N/A"&&v!=="Unknown"&&v!=="—";}

      // ── Parse numeric fields out of messy AI strings ──
      // "95 acres" / "95ac" / "95.5" → 95.5
      var acresNum = 0;
      if(ok(site.site_area_acres)){
        var aStr=String(site.site_area_acres).replace(/,/g,"");
        acresNum=parseFloat(aStr.match(/[\d.]+/)?aStr.match(/[\d.]+/)[0]:"0")||0;
      }
      // "1,200 units" / "1200" → 1200
      var unitsNum = 0;
      if(ok(site.estimated_units)){
        unitsNum=parseInt(String(site.estimated_units).replace(/[^0-9]/g,""))||0;
      }
      // "£4.5m" / "£4,500,000" / "POA" → numeric
      var priceNum = 0;
      var priceStr = ok(site.asking_price)?String(site.asking_price):"";
      if(priceStr){
        var lower=priceStr.toLowerCase();
        var raw=lower.replace(/[£$,\s]/g,"");
        var m=raw.match(/([\d.]+)\s*(m|million|k|thousand)?/);
        if(m){
          var n=parseFloat(m[1])||0;
          var suffix=m[2]||"";
          if(suffix.indexOf("m")===0||suffix.indexOf("million")===0)n*=1000000;
          else if(suffix.indexOf("k")===0||suffix.indexOf("thousand")===0)n*=1000;
          priceNum=n;
        }
      }
      // Postcode → city + sale PSF inference
      var pcClean = ok(site.postcode)?String(site.postcode).toUpperCase().trim():"";
      var pcLookup = pcClean?lookupPostcode(pcClean):null;
      var inferredCity = pcLookup?pcLookup.city:"";
      var inferredPsf  = pcLookup?pcLookup.salePsf:null;

      // Composite address for display
      var fullAddr = site.address_or_location||site.site_name||"";

      // ── Density calc — units per acre ──
      var densityPerAcre = (acresNum>0 && unitsNum>0) ? unitsNum/acresNum : 0;

      // ── Infer build PSF from market data (regional) ──
      var inferredBuildPsf = 195;  // safe default
      if(inferredCity && MKT[inferredCity.toLowerCase()] && MKT[inferredCity.toLowerCase()].build){
        inferredBuildPsf = MKT[inferredCity.toLowerCase()].build;
      }

      // ── Detect scheme type from Placona's data ──
      // Returns "sfh" / "btr" / "pbsa" / "land" / "property" / "recovery" or null
      function detectSchemeType(){
        var hint = ((site.scheme_type||"")+" "+(site.recommended_action||"")+" "+(site.planning_status||"")+" "+(site.site_name||"")).toLowerCase();
        // Explicit scheme type from Placona
        if(/\bpbsa\b|student\s*accommod|student\s*housing|halls\s*of\s*resid/.test(hint)) return "pbsa";
        if(/\bbtr\b|build[\s-]*to[\s-]*rent|multi[\s-]*family|apartment\s*block/.test(hint)) return "btr";
        if(/single\s*family|housing\s*estate|family\s*homes|detached|semi|terrace/.test(hint)) return "sfh";
        if(/strategic\s*land|promotion|local\s*plan\s*allocation|shelaa|edge[\s-]*of[\s-]*settlement/.test(hint)) return "land";
        if(/refurb|conversion|change\s*of\s*use|existing\s*building/.test(hint)) return "property";
        if(/refused|withdrawn|stalled|appeal|rescue/.test(hint)) return "recovery";
        // Inference by density
        if(densityPerAcre > 0){
          if(densityPerAcre >= 200) return "pbsa";   // very high density = student
          if(densityPerAcre >= 60)  return "btr";    // high density = apartments
          if(densityPerAcre >= 8)   return "sfh";    // suburban density = houses
          return "land";                              // very low density = strategic land
        }
        // Acres heuristic if no density
        if(acresNum > 50) return "land";  // big sites = strategic
        if(acresNum > 0 && acresNum < 1) return "property";  // tiny = existing property
        return null;
      }
      var detectedScheme = detectSchemeType();

      // ────────────────────────────────────────────────────────────────
      // 1. LAND APPRAISAL — full coverage
      // ────────────────────────────────────────────────────────────────
      if(fullAddr)       up("land","address",fullAddr);
      if(pcClean)        up("land","postcode",pcClean);
      if(acresNum>0)     up("land","acres",acresNum);
      if(priceNum>0)     up("land","price",priceNum);
      if(inferredCity)   up("land","city",inferredCity);
      if(ok(site.local_planning_authority))  up("land","localAuthority",site.local_planning_authority);
      if(ok(site.planning_status))           up("land","planningStatus",site.planning_status);
      if(ok(site.agent_contact))             up("land","agent",site.agent_contact);
      if(ok(site.county))                    up("land","county",site.county);
      if(ok(site.source_url))                up("land","sourceUrl",site.source_url);
      if(ok(site.constraints_summary))       up("land","constraintSummary",site.constraints_summary);

      // ── Smart dropdown inference from constraints + planning status text ──
      var allText = ((site.constraints_summary||"")+" "+(site.planning_status||"")+" "+(site.recommended_action||"")).toLowerCase();
      // Planning Constraints dropdown (none/minor/moderate/major)
      if(/green\s*belt|flood\s*zone\s*3|sssi|aonb|national\s*park/.test(allText))      up("land","constraint","major");
      else if(/conservation|flood\s*zone\s*2|heritage/.test(allText))                    up("land","constraint","moderate");
      else if(/tpo|tree\s*preservation|listed\s*(adjacent|nearby)/.test(allText))        up("land","constraint","minor");
      else if(/allocated|outline\s*consent|no\s*constraint|local\s*plan\s*allocation/.test(allText)) up("land","constraint","none");
      // Ground Contamination dropdown
      if(/contaminat|brownfield|former\s*(industrial|factory|landfill)|remediation/.test(allText)) up("land","contamination","minor");
      else if(/greenfield|agricultural|farmland|pasture/.test(allText))                  up("land","contamination","clean");
      // Tenure default — most UK strategic land sales are freehold
      up("land","tenure","freehold");
      // Proximity heuristic — promoted/allocated sites are usually near settlements
      if(/edge[\s-]*of[\s-]*settlement|sustainable\s*location|near\s*(town|village|station)/.test(allText)) up("land","proximity","good");
      else if(/remote|rural|isolated/.test(allText))                                     up("land","proximity","poor");
      // Transport heuristic
      if(/station|rail|motorway|junction|a\d+\s*(corridor|access)/.test(allText))        up("land","transport","good");

      // ────────────────────────────────────────────────────────────────
      // 2. PLANNING & VIABILITY — extended
      // ────────────────────────────────────────────────────────────────
      if(unitsNum>0)                         up("planning","units",unitsNum);
      if(ok(site.local_planning_authority))  up("planning","lpa",site.local_planning_authority);
      if(ok(site.planning_status))           up("planning","status",site.planning_status);
      if(acresNum>0)                         up("planning","acres",acresNum);
      if(densityPerAcre>0)                   up("planning","density",Math.round(densityPerAcre*10)/10);
      // S106 inference — institutional standard is £8k-15k per unit
      if(detectedScheme==="sfh")             up("planning","s106pu",10000);
      else if(detectedScheme==="btr"||detectedScheme==="pbsa") up("planning","s106pu",6000);
      else                                   up("planning","s106pu",8000);
      // Affordable housing % — typical UK requirement
      if(unitsNum>0)                         up("planning","afhPct",detectedScheme==="sfh"?30:20);

      // ────────────────────────────────────────────────────────────────
      // 3. LAND VALUATION (RLV) — extended
      // ────────────────────────────────────────────────────────────────
      if(pcClean)        up("rlv","postcode",pcClean);
      if(acresNum>0)     up("rlv","acres",acresNum);
      if(unitsNum>0)     up("rlv","units",unitsNum);
      if(inferredPsf)    up("rlv","salePsf",inferredPsf);
      if(inferredBuildPsf) up("rlv","buildPsf",inferredBuildPsf);
      if(priceNum>0)     up("rlv","askingPrice",priceNum);
      up("rlv","avgSqft", detectedScheme==="sfh"?900 : detectedScheme==="btr"?620 : detectedScheme==="pbsa"?280 : 850);
      // Trigger Land Registry auto-fetch on next visit
      if(pcClean) up("rlv","lrAutoTrigger",true);

      // ────────────────────────────────────────────────────────────────
      // 4. SFH HOUSE MIX — extended
      // ────────────────────────────────────────────────────────────────
      if(acresNum>0)     up("sfh","acres",acresNum);
      if(inferredCity)   up("sfh","city",inferredCity);
      if(inferredPsf)    up("sfh","basePsf",inferredPsf);
      if(unitsNum>0)     up("sfh","totalUnits",unitsNum);
      if(inferredBuildPsf) up("sfh","buildPsf",inferredBuildPsf);
      up("sfh","avgSqft",900);  // typical SFH

      // ────────────────────────────────────────────────────────────────
      // 5. BTR / PBSA BLOCK (HRA) — extended
      // ────────────────────────────────────────────────────────────────
      if(inferredCity)   up("hra","city",inferredCity);
      if(unitsNum>0)     up("hra","units",unitsNum);
      if(inferredPsf){
        up("hra","sPsf",Math.round(inferredPsf*1.05));  // studio premium
        up("hra","oPsf",inferredPsf);                   // 1-bed
        up("hra","tPsf",Math.round(inferredPsf*0.95));  // 2-bed slightly under
      }
      // Mix defaults for BTR
      if(detectedScheme==="btr" && unitsNum>0){
        up("hra","sShare",30);  // 30% studio
        up("hra","oShare",45);  // 45% 1-bed
        up("hra","tShare",25);  // 25% 2-bed
      }

      // ────────────────────────────────────────────────────────────────
      // 6. FINANCIAL MODELLING — NEW: populate key inputs
      // ────────────────────────────────────────────────────────────────
      if(unitsNum>0)     up("fin","units",unitsNum);
      if(inferredBuildPsf) up("fin","buildPsf",inferredBuildPsf);
      up("fin","feesPct",12);          // institutional standard
      up("fin","contingency",5);       // 5% contingency
      up("fin","finRate",7.5);         // current dev finance market rate
      up("fin","profitPct",17.5);      // target margin
      up("fin","s106pu",8000);         // default if not overridden by planning
      if(priceNum>0)     up("fin","landCost",priceNum);

      // ────────────────────────────────────────────────────────────────
      // 7. CONSTRAINT CHECK — uses constraintCheck object (not constraint)
      // ────────────────────────────────────────────────────────────────
      if(pcClean)                            up("constraintCheck","postcode",pcClean);
      if(fullAddr)                           up("constraintCheck","address",fullAddr);
      if(ok(site.local_planning_authority))  up("constraintCheck","lpa",site.local_planning_authority);
      if(ok(site.constraints_summary)){
        up("constraintCheck","preNotes",site.constraints_summary);
      }
      // Also populate the legacy land.constraint field for the Land Appraisal dropdown
      if(ok(site.constraints_summary)){
        up("constraint","result",site.constraints_summary);
        up("constraint","constraints",site.constraints_summary);
      }

      // ────────────────────────────────────────────────────────────────
      // 7b. PLANNING MONITOR — uses planMonitor object
      // ────────────────────────────────────────────────────────────────
      if(pcClean)                            up("planMonitor","postcode",pcClean);
      if(ok(site.local_planning_authority))  up("planMonitor","lpa",site.local_planning_authority);
      if(ok(site.county))                    up("planMonitor","county",site.county);

      // ────────────────────────────────────────────────────────────────
      // 8. EXIT STRATEGY
      // ────────────────────────────────────────────────────────────────
      if(ok(site.agent_contact))             up("exit","agent",site.agent_contact);
      if(unitsNum>0)                         up("exit","units",unitsNum);
      if(inferredCity)                       up("exit","city",inferredCity);
      // Suggested yield based on scheme type
      if(detectedScheme==="btr")             up("exit","targetYield",4.25);
      else if(detectedScheme==="pbsa")       up("exit","targetYield",4.75);

      // ────────────────────────────────────────────────────────────────
      // 9. SITE SCORECARD — Placona's own score + key inputs for re-scoring
      // ────────────────────────────────────────────────────────────────
      if(site.placona_score)     up("scorecard","placonaScore",site.placona_score);
      if(site.placona_category)  up("scorecard","placonaCategory",site.placona_category);
      if(fullAddr)               up("scorecard","address",fullAddr);
      if(pcClean)                up("scorecard","postcode",pcClean);
      if(acresNum>0)             up("scorecard","acres",acresNum);
      if(unitsNum>0)             up("scorecard","units",unitsNum);
      if(priceNum>0)             up("scorecard","askingPrice",priceNum);
      if(inferredCity)           up("scorecard","city",inferredCity);

      // ────────────────────────────────────────────────────────────────
      // 10. PROPERTY EVALUATOR (postcode + city for context only — won't show
      //     unless 'property' scheme is selected)
      // ────────────────────────────────────────────────────────────────
      if(pcClean)        up("epe","postcode",pcClean);
      if(inferredCity)   up("epe","city",inferredCity);
      if(fullAddr)       up("epe","streetAddress",fullAddr);
      if(inferredPsf)    up("epe","newPsf",inferredPsf);
      if(inferredPsf)    up("epe","salePsf",inferredPsf);

      // ────────────────────────────────────────────────────────────────
      // 11. AUTO-SET SCHEME PILL — driving sidebar filter + navigator
      // ────────────────────────────────────────────────────────────────
      if(detectedScheme && schemes.indexOf(detectedScheme)<0){
        // Only set if user hasn't already chosen — don't overwrite manual selection
        if(schemes.length===0){
          setSchemes([detectedScheme]);
        }
      }

      // ────────────────────────────────────────────────────────────────
      // 12. MASTER DEAL META (cross-stage)
      // ────────────────────────────────────────────────────────────────
      if(fullAddr)       up("masterAddress",fullAddr,"meta");  // also save root-level for header display
      if(detectedScheme) up("masterScheme",detectedScheme,"meta");

      // ── Show user a toast of what got loaded ──
      var loaded = [];
      if(acresNum>0) loaded.push(acresNum+" ac");
      if(unitsNum>0) loaded.push(unitsNum+" units");
      if(priceNum>0) loaded.push("£"+(priceNum/1000000).toFixed(2)+"m");
      if(detectedScheme) loaded.push(detectedScheme.toUpperCase()+" scheme");
      if(inferredCity) loaded.push(inferredCity);

      try{
        setToast({
          type:"success",
          title:"Site loaded into deal",
          body:"Populated 10+ stages: "+(loaded.join(" · "))+". "+(detectedScheme?"Scheme detected as "+detectedScheme.toUpperCase()+" — sidebar filtered.":"")+" Land Registry lookup auto-fires on RLV stage."
        });
      }catch(e){}

      // Navigate to navigator so user sees the workflow with everything pre-filled
      // (if they have no scheme/exit set yet, navigator will guide them)
      // Otherwise, go to Land Appraisal
      if(schemes.length===0 && !detectedScheme){
        navTo("navigator");
      } else {
        navTo("land");
      }
    }

  function renderPlacona(){
    var pl=data.placona||{};
    var inbox=(pl.inbox)||[];
    var running=pl.running||false;
    var lastRun=pl.lastRun||"";
    var error=pl.error||"";
    var loadingSheet=pl.loadingSheet||false;
    var selectedSite=pl.selectedSite||null;
    var view=pl.view||"search"; // "search" | "inbox" | "detail"

    var COUNTIES=[
      // ── NORTH EAST ENGLAND ───────────────────────────────────────────
      {id:"tyne_wear",        label:"Tyne & Wear",        region:"North East"},
      {id:"northumberland",   label:"Northumberland",     region:"North East"},
      {id:"county_durham",    label:"County Durham",      region:"North East"},
      {id:"tees_valley",      label:"Tees Valley",        region:"North East"},

      // ── NORTH WEST ENGLAND ───────────────────────────────────────────
      {id:"cumbria",          label:"Cumbria",            region:"North West"},
      {id:"lancashire",       label:"Lancashire",         region:"North West"},
      {id:"greater_manchester",label:"Greater Manchester",region:"North West"},
      {id:"merseyside",       label:"Merseyside",         region:"North West"},
      {id:"cheshire",         label:"Cheshire",           region:"North West"},

      // ── YORKSHIRE & THE HUMBER ───────────────────────────────────────
      {id:"north_yorkshire",  label:"North Yorkshire",    region:"Yorkshire"},
      {id:"west_yorkshire",   label:"West Yorkshire",     region:"Yorkshire"},
      {id:"south_yorkshire",  label:"South Yorkshire",    region:"Yorkshire"},
      {id:"east_yorkshire",   label:"East Yorkshire",     region:"Yorkshire"},

      // ── EAST MIDLANDS ────────────────────────────────────────────────
      {id:"nottinghamshire",  label:"Nottinghamshire",    region:"East Midlands"},
      {id:"derbyshire",       label:"Derbyshire",         region:"East Midlands"},
      {id:"leicestershire",   label:"Leicestershire",     region:"East Midlands"},
      {id:"lincolnshire",     label:"Lincolnshire",       region:"East Midlands"},
      {id:"northamptonshire", label:"Northamptonshire",   region:"East Midlands"},
      {id:"rutland",          label:"Rutland",            region:"East Midlands"},

      // ── WEST MIDLANDS ────────────────────────────────────────────────
      {id:"staffordshire",    label:"Staffordshire",      region:"West Midlands"},
      {id:"warwickshire",     label:"Warwickshire",       region:"West Midlands"},
      {id:"west_midlands",    label:"West Midlands",      region:"West Midlands"},
      {id:"worcestershire",   label:"Worcestershire",     region:"West Midlands"},
      {id:"herefordshire",    label:"Herefordshire",      region:"West Midlands"},
      {id:"shropshire",       label:"Shropshire",         region:"West Midlands"},

      // ── EAST OF ENGLAND ──────────────────────────────────────────────
      {id:"norfolk",          label:"Norfolk",            region:"East of England"},
      {id:"suffolk",          label:"Suffolk",            region:"East of England"},
      {id:"cambridgeshire",   label:"Cambridgeshire",     region:"East of England"},
      {id:"essex",            label:"Essex",              region:"East of England"},
      {id:"hertfordshire",    label:"Hertfordshire",      region:"East of England"},
      {id:"bedfordshire",     label:"Bedfordshire",       region:"East of England"},

      // ── GREATER LONDON ───────────────────────────────────────────────
      {id:"london_central",   label:"Central London",     region:"Greater London"},
      {id:"london_north",     label:"North London",       region:"Greater London"},
      {id:"london_east",      label:"East London",        region:"Greater London"},
      {id:"london_south",     label:"South London",       region:"Greater London"},
      {id:"london_west",      label:"West London",        region:"Greater London"},

      // ── SOUTH EAST ENGLAND ───────────────────────────────────────────
      {id:"berkshire",        label:"Berkshire",          region:"South East"},
      {id:"buckinghamshire",  label:"Buckinghamshire",    region:"South East"},
      {id:"oxfordshire",      label:"Oxfordshire",        region:"South East"},
      {id:"surrey",           label:"Surrey",             region:"South East"},
      {id:"kent",             label:"Kent",               region:"South East"},
      {id:"east_sussex",      label:"East Sussex",        region:"South East"},
      {id:"west_sussex",      label:"West Sussex",        region:"South East"},
      {id:"hampshire",        label:"Hampshire",          region:"South East"},
      {id:"isle_of_wight",    label:"Isle of Wight",      region:"South East"},

      // ── SOUTH WEST ENGLAND ───────────────────────────────────────────
      {id:"gloucestershire",  label:"Gloucestershire",    region:"South West"},
      {id:"bristol",          label:"Bristol",            region:"South West"},
      {id:"wiltshire",        label:"Wiltshire",          region:"South West"},
      {id:"somerset",         label:"Somerset",           region:"South West"},
      {id:"dorset",           label:"Dorset",             region:"South West"},
      {id:"devon",            label:"Devon",              region:"South West"},
      {id:"cornwall",         label:"Cornwall",           region:"South West"},

      // ── WALES ────────────────────────────────────────────────────────
      {id:"cardiff",          label:"Cardiff",            region:"Wales"},
      {id:"swansea",          label:"Swansea & SW Wales", region:"Wales"},
      {id:"newport",          label:"Newport & SE Wales", region:"Wales"},
      {id:"north_wales",      label:"North Wales",        region:"Wales"},
      {id:"mid_wales",        label:"Mid & West Wales",   region:"Wales"},
      {id:"valleys",          label:"South Wales Valleys",region:"Wales"},

      // ── SCOTLAND ─────────────────────────────────────────────────────
      {id:"glasgow",          label:"Glasgow & Strathclyde",region:"Scotland"},
      {id:"edinburgh",        label:"Edinburgh & Lothian",region:"Scotland"},
      {id:"aberdeen",         label:"Aberdeen & Grampian",region:"Scotland"},
      {id:"dundee",           label:"Dundee & Tayside",   region:"Scotland"},
      {id:"highlands",        label:"Highlands & Islands",region:"Scotland"},
      {id:"borders",          label:"Scottish Borders",   region:"Scotland"},
      {id:"fife",             label:"Fife",               region:"Scotland"},
      {id:"stirling",         label:"Stirling & Central", region:"Scotland"},
      {id:"dumfries",         label:"Dumfries & Galloway",region:"Scotland"},

      // ── NORTHERN IRELAND ─────────────────────────────────────────────
      {id:"belfast",          label:"Belfast",            region:"Northern Ireland"},
      {id:"derry",            label:"Derry / Londonderry",region:"Northern Ireland"},
      {id:"antrim",           label:"Antrim",             region:"Northern Ireland"},
      {id:"down",             label:"Down",               region:"Northern Ireland"},
      {id:"armagh",           label:"Armagh",             region:"Northern Ireland"},
      {id:"tyrone",           label:"Tyrone",             region:"Northern Ireland"},
      {id:"fermanagh",        label:"Fermanagh",          region:"Northern Ireland"}
    ];

    // Build regional presets dynamically
    var REGION_GROUPS = {};
    COUNTIES.forEach(function(c){
      if(!REGION_GROUPS[c.region]) REGION_GROUPS[c.region] = [];
      REGION_GROUPS[c.region].push(c.id);
    });

    var PRESETS=[
      {label:"North East",        ids:REGION_GROUPS["North East"]},
      {label:"North West",        ids:REGION_GROUPS["North West"]},
      {label:"Yorkshire",         ids:REGION_GROUPS["Yorkshire"]},
      {label:"East Midlands",     ids:REGION_GROUPS["East Midlands"]},
      {label:"West Midlands",     ids:REGION_GROUPS["West Midlands"]},
      {label:"East of England",   ids:REGION_GROUPS["East of England"]},
      {label:"Greater London",    ids:REGION_GROUPS["Greater London"]},
      {label:"South East",        ids:REGION_GROUPS["South East"]},
      {label:"South West",        ids:REGION_GROUPS["South West"]},
      {label:"Wales",             ids:REGION_GROUPS["Wales"]},
      {label:"Scotland",          ids:REGION_GROUPS["Scotland"]},
      {label:"Northern Ireland",  ids:REGION_GROUPS["Northern Ireland"]},
      {label:"Whole UK",          ids:COUNTIES.map(function(c){return c.id;})},
      {label:"England Only",      ids:COUNTIES.filter(function(c){return ["North East","North West","Yorkshire","East Midlands","West Midlands","East of England","Greater London","South East","South West"].indexOf(c.region)>=0;}).map(function(c){return c.id;})},
      {label:"M62 Corridor",      ids:["merseyside","greater_manchester","west_yorkshire","south_yorkshire","east_yorkshire"]},
      {label:"M1/M6 Corridor",    ids:["bedfordshire","northamptonshire","leicestershire","warwickshire","west_midlands","staffordshire","cheshire","greater_manchester"]},
      {label:"M4 Corridor",       ids:["london_west","berkshire","wiltshire","bristol","cardiff","swansea"]}
    ];

    var selected=pl.selectedCounties||[];
    var minHomes=pl.minHomes||100;
    var siteTypes=pl.siteTypes||["strategic land","Local Plan allocations","SHELAA sites","edge-of-settlement","brownfield land"];
    var searchDepth=pl.searchDepth||"standard search";

    var selectedLabels=selected.map(function(id){
      var c=COUNTIES.find(function(c2){return c2.id===id;});
      return c?c.label:id;
    });

    function toggleCounty(id){
      var n=selected.indexOf(id)>=0?selected.filter(function(c){return c!==id;}):selected.concat([id]);
      up("placona","selectedCounties",n);
    }
    function applyPreset(p){up("placona","selectedCounties",p.ids);}

    // Load from Google Sheet
    function loadFromSheet(){
      up("placona","loadingSheet",true);
      fetch(WEBHOOK+"?action=placona_read")
      .then(function(r){return r.json();})
      .then(function(d){
        up("placona","loadingSheet",false);
        if(d.status==="ok"&&d.sites&&d.sites.length>0){
          up("placona","inbox",d.sites);
          up("placona","view","inbox");
        } else {
          up("placona","error","No sites in the Google Sheet inbox yet. Run a search first.");
        }
      })
      .catch(function(err){
        up("placona","loadingSheet",false);
        up("placona","error","Could not read from sheet: "+err.message);
      });
    }

    // Run Placona search
    function runPlacona(){
      if(selected.length===0){alert("Please select at least one county.");return;}
      up("placona","running",true);
      up("placona","error","");
      var pUrl=WEBHOOK+"?action=placona_run"+
        "&counties="+encodeURIComponent(selectedLabels.join(","))+
        "&min_homes="+encodeURIComponent(minHomes)+
        "&depth="+encodeURIComponent(searchDepth)+
        "&types="+encodeURIComponent(siteTypes.slice(0,3).join(","))+
        "&user="+encodeURIComponent((user&&user.name)||"")+
        "&company="+encodeURIComponent((user&&user.company)||"");
      fetch(pUrl)
      .then(function(r){return r.json();})
      .then(function(d){
        up("placona","running",false);
        up("placona","lastRun",new Date().toLocaleString("en-GB"));
        if(d.status==="ok"&&d.sites&&d.sites.length>0){
          var existing=inbox||[];
          var merged=existing.concat(d.sites.filter(function(ns){
            return !existing.some(function(es){return es.site_name===ns.site_name;});
          }));
          up("placona","inbox",merged);
          up("placona","view","inbox");
          up("placona","error","");
        } else {
          up("placona","error",d.message||"No sites returned. Try different counties or deeper search.");
        }
      })
      .catch(function(err){
        up("placona","running",false);
        up("placona","error","Connection error: "+err.message);
      });
    }

    // Load site into deal
    /* loadSiteIntoDeal lifted to Tool scope (just above renderPlacona) so renderDashboard can call it too */

    // Category colour
    function catCol(cat){return cat==="A"?"#2D7A65":cat==="B"?"#4A4BAE":cat==="C"?"#9A7B3E":"#B05A35";}
    function scoreBar(score){
      var s=num(score)||0;
      return e("div",{style:{height:4,background:"#F0F1FA",borderRadius:2,marginTop:4}},
        e("div",{style:{width:Math.min(s,100)+"%",height:"100%",background:s>=80?"#2D7A65":s>=65?"#4A4BAE":s>=50?"#9A7B3E":"#B05A35",borderRadius:2}})
      );
    }

    // ── TAB BAR ──────────────────────────────────────────────────────────────
    var tabs=[
      {id:"search",label:"Search",icon:"🔍"},
      {id:"inbox", label:"Site Inbox "+(inbox.length>0?"("+inbox.length+")":""),icon:"📥"},
    ];
    if(selectedSite) tabs.push({id:"detail",label:"Site Detail",icon:"📋"});

    return e("div",{style:{maxWidth:900}},

      // HEADER
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10}},
        e("div",null,
          e("div",{style:{fontSize:11,color:"#7278A0",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:2}},"Placona — AI Land Discovery"),
          e("h2",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",margin:"0 0 2px"}},"🤖 Find Land Opportunities"),
          e("div",{style:{fontSize:11,color:"#7278A0"}},"Search planning portals and agent listings. Results saved to Google Sheet and loaded here.")
        ),
        e("div",{style:{display:"flex",gap:8,alignItems:"center"}},
          e("button",{onClick:loadFromSheet,disabled:loadingSheet,
            style:{padding:"8px 14px",background:"#F0F1FA",border:"1px solid #DDE0ED",borderRadius:6,fontSize:11,fontWeight:700,color:"#4A4BAE",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },loadingSheet?"Loading...":"📥 Load from Sheet"),
          inbox.length>0&&e("div",{style:{fontSize:12,color:"#2D7A65",fontWeight:700}},inbox.length+" site"+(inbox.length!==1?"s":"")+" in inbox")
        )
      ),

      // TAB NAV
      e("div",{style:{display:"flex",gap:2,marginBottom:16,borderBottom:"2px solid #F0F1FA"}},
        tabs.map(function(tab){
          var active=view===tab.id;
          return e("button",{key:tab.id,onClick:function(){up("placona","view",tab.id);},
            style:{padding:"8px 18px",background:"none",border:"none",borderBottom:active?"2px solid #4A4BAE":"2px solid transparent",marginBottom:-2,color:active?"#4A4BAE":"#7278A0",fontWeight:active?800:500,fontSize:12,cursor:"pointer",fontFamily:"DM Sans,sans-serif",transition:"all .15s"}
          },tab.icon+" "+tab.label);
        })
      ),

      // ── SEARCH TAB ─────────────────────────────────────────────────────────
      view==="search"&&e("div",null,

        // County selector
        e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"18px 20px",marginBottom:12}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
            e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em"}},"Select Counties"),
            e("div",{style:{display:"flex",gap:6}},
              e("button",{onClick:function(){up("placona","selectedCounties",COUNTIES.map(function(c){return c.id;}));},
                style:{padding:"4px 10px",background:"#F0F1FA",border:"1px solid #DDE0ED",borderRadius:4,fontSize:10,fontWeight:700,color:"#4A4BAE",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"All"),
              e("button",{onClick:function(){up("placona","selectedCounties",[]);},
                style:{padding:"4px 10px",background:"#F0F1FA",border:"1px solid #DDE0ED",borderRadius:4,fontSize:10,fontWeight:700,color:"#B05A35",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Clear")
            )
          ),
          // Preset pills
          e("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}},
            PRESETS.map(function(preset){
              var isActive=preset.ids.length>0&&preset.ids.every(function(id){return selected.indexOf(id)>=0;});
              return e("button",{key:preset.label,onClick:function(){applyPreset(preset);},
                style:{padding:"5px 12px",background:isActive?"#4A4BAE":"#F0F1FA",border:"1px solid "+(isActive?"#4A4BAE":"#DDE0ED"),borderRadius:20,fontSize:11,fontWeight:700,color:isActive?"#fff":"#4A4BAE",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },preset.label);
            })
          ),
          // County grid grouped by region (12 regions, alphabetical within each)
          (function(){
            var regions = ["North East","North West","Yorkshire","East Midlands","West Midlands","East of England","Greater London","South East","South West","Wales","Scotland","Northern Ireland"];
            return e("div",null,
              regions.map(function(regionName){
                var inRegion = COUNTIES.filter(function(c){return c.region === regionName;});
                if(inRegion.length === 0) return null;
                var regionSelected = inRegion.filter(function(c){return selected.indexOf(c.id)>=0;}).length;
                var allSelected = regionSelected === inRegion.length;
                return e("div",{key:regionName,style:{marginBottom:12}},
                  e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,paddingBottom:4,borderBottom:"1px solid #E8E9F5"}},
                    e("span",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".08em"}}, regionName + (regionSelected>0?" · "+regionSelected+"/"+inRegion.length+" selected":"")),
                    e("button",{onClick:function(){
                      var ids=inRegion.map(function(c){return c.id;});
                      if(allSelected){
                        // deselect all in region
                        up("placona","selectedCounties",selected.filter(function(s){return ids.indexOf(s)<0;}));
                      } else {
                        // select all in region (merge)
                        var combined=selected.slice();
                        ids.forEach(function(id){if(combined.indexOf(id)<0)combined.push(id);});
                        up("placona","selectedCounties",combined);
                      }
                    },style:{padding:"2px 8px",fontSize:9,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",background:allSelected?"#9A7B3E":"#F7F8FC",color:allSelected?"#fff":"#4A4BAE",border:"1px solid "+(allSelected?"#9A7B3E":"#DDE0ED"),borderRadius:3,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}}, allSelected?"Clear":"All")
                  ),
                  e("div",{className:"lf-pill-grid",style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}},
                    inRegion.map(function(county){
                      var checked=selected.indexOf(county.id)>=0;
                      return e("label",{key:county.id,
                        style:{display:"flex",alignItems:"center",gap:7,padding:"7px 10px",background:checked?"rgba(74,75,174,0.08)":"#F7F8FC",border:"1px solid "+(checked?"#4A4BAE":"#E8E9F5"),borderRadius:6,cursor:"pointer"}},
                        e("input",{type:"checkbox",checked:checked,onChange:function(){toggleCounty(county.id);},style:{accentColor:"#4A4BAE",width:13,height:13,flexShrink:0}}),
                        e("span",{style:{fontSize:11,fontWeight:checked?700:400,color:checked?"#2E2F8A":"#5A5C80"}},county.label)
                      );
                    })
                  )
                );
              })
            );
          })(),
          selected.length>0&&e("div",{style:{marginTop:10,fontSize:11,color:"#4A4BAE",fontWeight:600}},
            selected.length+" "+(selected.length===1?"county":"counties")+" selected: "+selectedLabels.join(", ")
          )
        ),

        // Search settings row
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}},
          e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"14px 16px"}},
            e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}},"Search Settings"),
            e("div",{className:"lf-grid2",style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
              e("div",null,
                e("label",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",display:"block",marginBottom:3}},"Minimum homes"),
                e("select",{value:minHomes,onChange:function(ev){up("placona","minHomes",Number(ev.target.value));},
                  style:{width:"100%",padding:"7px 8px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontFamily:"DM Sans,sans-serif",color:"#2E2F8A"}},
                  [50,100,150,200,300,500].map(function(n){return e("option",{key:n,value:n},n+"+");})
                )
              ),
              e("div",null,
                e("label",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",display:"block",marginBottom:3}},"Search depth"),
                e("select",{value:searchDepth,onChange:function(ev){up("placona","searchDepth",ev.target.value);},
                  style:{width:"100%",padding:"7px 8px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontFamily:"DM Sans,sans-serif",color:"#2E2F8A"}},
                  ["quick scan","standard search","deep research"].map(function(d){return e("option",{key:d,value:d},d.charAt(0).toUpperCase()+d.slice(1));})
                )
              )
            )
          ),
          e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"14px 16px"}},
            e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}},"Site Types"),
            ["strategic land","Local Plan allocations","SHELAA sites","edge-of-settlement","brownfield land"].map(function(st){
              var isOn=siteTypes.indexOf(st)>=0;
              return e("label",{key:st,style:{display:"flex",alignItems:"center",gap:6,marginBottom:4,cursor:"pointer"}},
                e("input",{type:"checkbox",checked:isOn,onChange:function(){
                  var n=isOn?siteTypes.filter(function(t){return t!==st;}):siteTypes.concat([st]);
                  up("placona","siteTypes",n);
                },style:{accentColor:"#4A4BAE"}}),
                e("span",{style:{fontSize:11,color:"#2E2F8A"}},st)
              );
            })
          )
        ),

        // Run button + status
        e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"16px 20px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}},
          e("button",{onClick:running?function(){
              if(window.confirm("Cancel current search?"))up("placona","running",false);
            }:runPlacona,disabled:!running&&selected.length===0,
            style:{padding:"13px 28px",background:running?"#B05A35":selected.length===0?"#C8CDE0":"linear-gradient(135deg,#2D7A65,#4A4BAE)",border:"none",borderRadius:8,color:"#fff",fontSize:14,fontWeight:800,cursor:(!running&&selected.length===0)?"not-allowed":"pointer",fontFamily:"DM Sans,sans-serif",boxShadow:running||selected.length===0?"none":"0 4px 12px rgba(74,75,174,0.3)",whiteSpace:"nowrap"}
          },running?"✕ Cancel search":selected.length===0?"Select counties first":"🤖 Run Placona"),
          e("div",{style:{flex:1}},
            running&&e("div",{style:{fontSize:11,color:"#4A4BAE",lineHeight:1.8}},
              "Searching "+selectedLabels.join(", ")+" for "+minHomes+"+ home sites.",e("br"),
              "Takes 60-90 seconds. Results will appear in the Site Inbox tab and your Google Sheet."
            ),
            !running&&selected.length>0&&!error&&!lastRun&&e("div",{style:{fontSize:11,color:"#7278A0"}},"Ready to search "+selected.length+" counti"+(selected.length===1?"y":"es")+". Results go to Site Inbox."),
            !running&&lastRun&&!error&&e("div",{style:{fontSize:11,color:"#2D7A65",fontWeight:600}},"Last search: "+lastRun+" — "+inbox.length+" sites in inbox"),
            error&&e("div",{style:{fontSize:11,color:"#B05A35",background:"rgba(176,90,53,0.06)",padding:"8px 12px",borderRadius:6}},error)
          )
        )
      ),

      // ── INBOX TAB ──────────────────────────────────────────────────────────
      view==="inbox"&&e("div",null,
        inbox.length===0?e("div",{style:{textAlign:"center",padding:"60px 20px",color:"#7278A0"}},
          e("div",{style:{fontSize:32,marginBottom:12}},"📥"),
          e("div",{style:{fontSize:14,fontWeight:700,color:"#2E2F8A",marginBottom:8}},"Your inbox is empty"),
          e("div",{style:{fontSize:12,marginBottom:16}},"Run a Placona search or click Load from Sheet to see saved results."),
          e("button",{onClick:function(){up("placona","view","search");},
            style:{padding:"10px 20px",background:"#4A4BAE",border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"Go to Search")
        ):e("div",null,
          // Inbox header
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}},
            e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A"}},inbox.length+" site"+(inbox.length!==1?"s":"")+" found — click a site to view full details or load directly into Landform"),
            e("button",{onClick:function(){up("placona","inbox",[]);},
              style:{padding:"5px 12px",background:"none",border:"1px solid #DDE0ED",borderRadius:4,color:"#B05A35",fontSize:10,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Clear all")
          ),
          // Site cards
          inbox.map(function(site,si){
            var score=num(site.placona_score)||0;
            var cat=site.placona_category||"";
            var col=catCol(cat);
            return e("div",{key:si,
              style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,marginBottom:8,overflow:"hidden",transition:"box-shadow .15s",cursor:"pointer"},
              onClick:function(){up("placona","selectedSite",site);up("placona","view","detail");}
            },
              e("div",{style:{display:"flex",alignItems:"stretch"}},
                // Score column
                e("div",{style:{width:64,background:col,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,padding:"12px 0"}},
                  e("div",{style:{fontSize:20,fontWeight:800,color:"#fff",lineHeight:1}},score||"—"),
                  e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.85)",fontWeight:700,marginTop:2}},cat?"CAT "+cat:"—")
                ),
                // Main content
                e("div",{style:{flex:1,padding:"12px 14px"}},
                  e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}},
                    e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A"}},site.site_name||site.address_or_location||"Unknown site"),
                    e("div",{style:{fontSize:10,color:"#7278A0",whiteSpace:"nowrap",marginLeft:8}},
                      site.site_area_acres&&site.site_area_acres!=="Not found"?site.site_area_acres+" acres":"",
                      site.estimated_units&&site.estimated_units!=="Not found"?" · "+site.estimated_units+" units":""
                    )
                  ),
                  e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:4}},
                    [site.county,site.local_planning_authority,site.planning_status].filter(function(v){return v&&v!=="Not found";}).join(" · ")
                  ),
                  site.asking_price&&site.asking_price!=="Not found"&&e("div",{style:{fontSize:11,color:"#2D7A65",fontWeight:600}},"Ask: "+site.asking_price),
                  scoreBar(score),
                  e("div",{style:{fontSize:10,color:"#9A7B3E",marginTop:4}},site.recommended_action||"")
                ),
                // Actions
                e("div",{style:{display:"flex",flexDirection:"column",justifyContent:"center",gap:6,padding:"12px 14px",flexShrink:0}},
                  e("button",{
                    onClick:function(ev){ev.stopPropagation();loadSiteIntoDeal(site);},
                    style:{padding:"8px 14px",background:"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}
                  },"Load Deal →"),
                  e("button",{
                    onClick:function(ev){ev.stopPropagation();up("placona","selectedSite",site);up("placona","view","detail");},
                    style:{padding:"6px 14px",background:"#F0F1FA",border:"1px solid #DDE0ED",borderRadius:5,color:"#2E2F8A",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}
                  },"Details"),
                  e("button",{
                    onClick:function(ev){
                      ev.stopPropagation();
                      var newInbox=inbox.filter(function(_,i2){return i2!==si;});
                      up("placona","inbox",newInbox);
                      // Also delete from sheet if has _row
                      if(site._row){
                        fetch(WEBHOOK+"?action=placona_delete&row="+site._row).catch(function(){});
                      }
                    },
                    style:{padding:"4px 14px",background:"none",border:"1px solid #F0D0D0",borderRadius:5,color:"#B05A35",fontSize:10,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
                  },"Remove")
                )
              )
            );
          })
        )
      ),

      // ── DETAIL TAB ──────────────────────────────────────────────────────────
      view==="detail"&&selectedSite&&e("div",null,
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}},
          e("button",{onClick:function(){up("placona","view","inbox");},
            style:{padding:"6px 12px",background:"#F0F1FA",border:"1px solid #DDE0ED",borderRadius:5,color:"#4A4BAE",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"← Back to Inbox"),
          e("button",{
            onClick:function(){loadSiteIntoDeal(selectedSite);},
            style:{padding:"10px 22px",background:"linear-gradient(135deg,#2D7A65,#4A4BAE)",border:"none",borderRadius:6,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif",boxShadow:"0 4px 10px rgba(74,75,174,0.3)"}
          },"🚀 Load into Landform — Pre-fill All Fields")
        ),

        // Score header
        e("div",{style:{background:"linear-gradient(135deg,"+catCol(selectedSite.placona_category)+",rgba(30,31,92,0.8))",borderRadius:10,padding:"20px 24px",marginBottom:14,color:"#fff"}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
            e("div",null,
              e("div",{style:{fontSize:10,opacity:0.7,textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}},"Placona Site Report"),
              e("div",{style:{fontSize:20,fontWeight:800,marginBottom:2}},selectedSite.site_name||selectedSite.address_or_location||"Unknown site"),
              e("div",{style:{fontSize:13,opacity:0.8}},selectedSite.county+(selectedSite.local_planning_authority?" · "+selectedSite.local_planning_authority:""))
            ),
            e("div",{style:{textAlign:"right"}},
              e("div",{style:{fontSize:40,fontWeight:800,lineHeight:1}},selectedSite.placona_score||"—"),
              e("div",{style:{fontSize:12,opacity:0.8}},selectedSite.placona_category?"Category "+selectedSite.placona_category:"No category"),
              e("div",{style:{width:100,height:6,background:"rgba(255,255,255,0.2)",borderRadius:3,marginTop:6}},
                e("div",{style:{width:Math.min(num(selectedSite.placona_score),100)+"%",height:"100%",background:"#fff",borderRadius:3}})
              )
            )
          )
        ),

        // Detail fields grid
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}},
          [
            {l:"Address / Location",  v:selectedSite.address_or_location||selectedSite.site_name},
            {l:"Postcode",             v:selectedSite.postcode},
            {l:"County",              v:selectedSite.county},
            {l:"Local Planning Auth", v:selectedSite.local_planning_authority},
            {l:"Site area",           v:selectedSite.site_area_acres&&selectedSite.site_area_acres!=="Not found"?selectedSite.site_area_acres+" acres":"Not found"},
            {l:"Estimated units",     v:selectedSite.estimated_units},
            {l:"Planning status",     v:selectedSite.planning_status},
            {l:"Asking price",        v:selectedSite.asking_price},
            {l:"Agent / Contact",     v:selectedSite.agent_contact},
            {l:"Recommended action",  v:selectedSite.recommended_action},
          ].map(function(item){
            var missing=!item.v||item.v==="Not found"||item.v==="";
            return e("div",{key:item.l,style:{background:"#fff",border:"1px solid "+(missing?"#F0D0D0":"#DDE0ED"),borderRadius:8,padding:"12px 14px"}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",marginBottom:3}},item.l),
              e("div",{style:{fontSize:12,fontWeight:600,color:missing?"#C0C4D8":"#2E2F8A"}},item.v||"Not found")
            );
          })
        ),

        // Constraints
        e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"14px 16px",marginBottom:12}},
          e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}},"Constraints Summary"),
          e("div",{style:{fontSize:12,color:"#2E2F8A",lineHeight:1.7}},selectedSite.constraints_summary||"Not assessed")
        ),

        // Source
        selectedSite.source_url&&selectedSite.source_url!=="Not found"&&e("div",{style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:11,color:"#7278A0"}},
          e("span",{style:{fontWeight:700}},"Source: "),selectedSite.source_url
        ),

        // Fields that will be pre-filled notice
        e("div",{style:{background:"rgba(45,122,101,0.05)",border:"1px solid rgba(45,122,101,0.2)",borderRadius:8,padding:"14px 16px"}},
          e("div",{style:{fontSize:10,fontWeight:800,color:"#2D7A65",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}},"Fields that will be pre-filled when you click Load into Landform"),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}},
            ["Land Appraisal — Address","Land Appraisal — Postcode","Land Appraisal — Acres","Land Appraisal — Asking price","Land Appraisal — Planning status","Land Appraisal — Agent contact","Planning — Units","Planning — LPA","RLV — Postcode","Constraint Check — Summary","Scorecard — Placona score"].map(function(f){
              return e("div",{key:f,style:{fontSize:10,color:"#2D7A65",display:"flex",gap:4,alignItems:"center"}},
                e("span",{style:{color:"#2D7A65",flexShrink:0}},"✓"),f
              );
            })
          )
        )
      )
    );
  }


  /* renderPortfolio moved to js/screen-Portfolio.js */

  // ══════════════════════════════════════════════════════════════════════════
  // PROCESS NAVIGATOR — Guided 3-page deal workflow
  //   Page 1: Pick scheme (SFH / BTR / PBSA / Land Strategy / Property Eval / Recovery)
  //   Page 2: Pick exit route (filtered by scheme — only realistic combinations)
  //   Page 3: Numbered workflow mirroring the sidebar exactly + click-to-jump
  // ══════════════════════════════════════════════════════════════════════════
  /* renderProcessNavigator moved to js/screen-ProcessNavigator.js */


  // ═══════════════════════════════════════════════════════════════════════════
  // ASSET EXIT OPTIMISER
  //   For existing/completing assets (PBSA, BTR, SFH portfolio, pub, hotel,
  //   industrial, office, retail, etc) — compare every viable exit route
  //   side-by-side and surface the optimal strategy.
  // ═══════════════════════════════════════════════════════════════════════════
  /* renderAssetOptimiser moved to js/screen-AssetOptimiser.js (loaded before this script) */


  // ═══════════════════════════════════════════════════════════════════════════
  // INVESTOR MARKETING SUITE
  //   Creates tiered investor packages (Teaser / IM / Data Room) with media
  //   uploads, shareable links, and view analytics. The endpoint for any deal.
  // ═══════════════════════════════════════════════════════════════════════════
  function renderInvestorSuite(){
    var inv = data.investor || {};
    function upi(k,v){ up("investor",k,v); }
    var dealId = data._cloudDealId || "";
    var hasDeal = !!dealId;

    var tab = inv.tab || "package";  // "package" | "media" | "shares" | "analytics"

    // ── Load shares from backend on first visit ──
    if(hasDeal && user && user.userId && !inv._sharesLoaded && !inv._sharesLoading){
      upi("_sharesLoading",true);
      fetch(WEBHOOK+"?action=share_analytics&userId="+encodeURIComponent(user.userId)+"&dealId="+encodeURIComponent(dealId))
        .then(function(r){return r.json();})
        .then(function(d){
          upi("_sharesLoaded",true);
          upi("_sharesLoading",false);
          if(d && d.status==="ok"){
            upi("shares", d.shares || []);
          }
        }).catch(function(){
          upi("_sharesLoaded",true);
          upi("_sharesLoading",false);
        });
    }

    function refreshShares(){
      upi("_sharesLoaded",false);
    }

    // ── Tab styles ──
    function tabBtn(key,label){
      var isActive = tab===key;
      return e("div",{key:key,onClick:function(){upi("tab",key);},
        style:{
          padding:"10px 18px",
          fontSize:12,fontWeight:700,letterSpacing:".03em",
          borderBottom:"3px solid "+(isActive?"#4A4BAE":"transparent"),
          color:isActive?"#2E2F8A":"#7278A0",
          cursor:"pointer",
          marginBottom:-2
        }
      }, label);
    }

    var ipt = {width:"100%",padding:"8px 10px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:12,fontFamily:"DM Sans,sans-serif",color:"#2E2F8A",background:"#fff"};
    var lbl = {fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:3,display:"block"};

    return e("div",null,
      // ── Header ──
      e("div",{style:{marginBottom:18}},
        e("div",{style:{fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:"#9A7B3E",marginBottom:6,fontWeight:700}},"Investor Marketing Suite"),
        e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:6}},"Package, market, and track your deal"),
        e("p",{style:{fontSize:12,color:"#7278A0",maxWidth:680,lineHeight:1.6}},"Generate institutional-grade Teaser, IM and Data Room. Upload photos and embed videos. Create shareable links per investor with view analytics so you can gauge interest in real-time.")
      ),

      // ── Save-deal prompt if no cloud ID ──
      !hasDeal && e("div",{style:{padding:"14px 18px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:8,fontSize:12,color:"#B05A35",marginBottom:18,lineHeight:1.6}},
        e("strong",null,"⚠ Save your deal first. "),"The Investor Marketing Suite needs a cloud-saved deal to generate shareable links. Click ",
        e("strong",null,"💾 Save Deal")," in the topbar, then come back.",
        e("div",{style:{marginTop:10}},
          e("button",{onClick:saveDeal,style:{padding:"8px 16px",background:"#B05A35",border:"none",color:"#fff",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"💾 Save Now →")
        )
      ),

      hasDeal && e("div",null,
        // ── Tabs ──
        e("div",{style:{display:"flex",gap:0,borderBottom:"2px solid #F0F1FA",marginBottom:18,overflowX:"auto",flexWrap:"wrap"}},
          tabBtn("package","📦 Build Package"),
          tabBtn("media","🖼 Media Library"),
          tabBtn("shares","🔗 Share Links"),
          tabBtn("analytics","📊 Activity & Engagement")
        ),

        // ── TAB 1: PACKAGE ───────────────────────────────────────────────
        tab==="package" && e("div",null,
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14,marginBottom:18}},
            // Tier 1: Teaser
            e("div",{style:{background:"#fff",border:"2px solid #DDE0ED",borderLeft:"5px solid #2D7A65",borderRadius:10,padding:18}},
              e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
                e("div",{style:{fontSize:24}},"📬"),
                e("div",null,
                  e("div",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Tier 1 — Teaser"),
                  e("div",{style:{fontSize:9,color:"#2D7A65",fontWeight:700,letterSpacing:".05em"}},"NDA-FREE · BROADCAST WIDELY")
                )
              ),
              e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14,lineHeight:1.6}},"1-2 pages. Headline numbers, location, hero image, 3-bullet pitch. Pass-the-pub test for analysts."),
              e("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                e("button",{onClick:function(){navTo("teaser");},style:{flex:1,padding:"7px 10px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#3A3D6A",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"📝 Edit content"),
                e("button",{onClick:function(){upi("createTier","teaser");},style:{flex:1,padding:"7px 10px",background:"linear-gradient(135deg,#2D7A65,#4A4BAE)",border:"none",borderRadius:5,fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🔗 Create link →")
              )
            ),
            // Tier 2: IM
            e("div",{style:{background:"#fff",border:"2px solid #DDE0ED",borderLeft:"5px solid #4A4BAE",borderRadius:10,padding:18}},
              e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
                e("div",{style:{fontSize:24}},"📑"),
                e("div",null,
                  e("div",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Tier 2 — IM"),
                  e("div",{style:{fontSize:9,color:"#4A4BAE",fontWeight:700,letterSpacing:".05em"}},"POST-NDA · IC-READY")
                )
              ),
              e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14,lineHeight:1.6}},"15-25 pages. Financial model summary, sensitivities, market analysis, exit strategy, risks, team."),
              e("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                e("button",{onClick:function(){navTo("im");},style:{flex:1,padding:"7px 10px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#3A3D6A",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"📝 Edit content"),
                e("button",{onClick:function(){upi("createTier","im");},style:{flex:1,padding:"7px 10px",background:"linear-gradient(135deg,#4A4BAE,#2E2F8A)",border:"none",borderRadius:5,fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🔗 Create link →")
              )
            ),
            // Tier 3: Data Room
            e("div",{style:{background:"#fff",border:"2px solid #DDE0ED",borderLeft:"5px solid #9A7B3E",borderRadius:10,padding:18}},
              e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
                e("div",{style:{fontSize:24}},"📁"),
                e("div",null,
                  e("div",{style:{fontSize:14,fontWeight:800,color:"#1E1F5C"}},"Tier 3 — Data Room"),
                  e("div",{style:{fontSize:9,color:"#9A7B3E",fontWeight:700,letterSpacing:".05em"}},"POST-LOI · FULL DD")
                )
              ),
              e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14,lineHeight:1.6}},"Title plans, planning consents, surveys, models, leases, environmental. Light DR = deal dies."),
              e("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                e("button",{onClick:function(){navTo("dataroom");},style:{flex:1,padding:"7px 10px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#3A3D6A",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"📝 Manage docs"),
                e("button",{onClick:function(){upi("createTier","dataroom");},style:{flex:1,padding:"7px 10px",background:"linear-gradient(135deg,#9A7B3E,#B05A35)",border:"none",borderRadius:5,fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🔗 Create link →")
              )
            )
          ),

          // ── Create Share modal-style block ──
          inv.createTier && e("div",{style:{background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",color:"#fff",borderRadius:10,padding:22,marginBottom:18}},
            e("div",{style:{fontSize:9,letterSpacing:".25em",textTransform:"uppercase",color:"#EDE84A",marginBottom:6,fontWeight:700}},"Create Share Link"),
            e("h3",{style:{fontSize:18,fontWeight:800,marginBottom:14}},"Configure your "+(inv.createTier==="teaser"?"Teaser":inv.createTier==="im"?"Investor Memorandum":"Data Room")+" link"),
            e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:14}},
              e("div",null,
                e("label",{style:Object.assign({},lbl,{color:"rgba(255,255,255,0.6)"})},"Share title"),
                e("input",{value:inv.shareTitle||"",onChange:function(ev){upi("shareTitle",ev.target.value);},placeholder:"e.g. Coventry PBSA — Pension Fund Pack",style:Object.assign({},ipt,{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff"})})
              ),
              e("div",null,
                e("label",{style:Object.assign({},lbl,{color:"rgba(255,255,255,0.6)"})},"Audience preset"),
                e("select",{value:inv.shareAudience||"pension",onChange:function(ev){upi("shareAudience",ev.target.value);},style:Object.assign({},ipt,{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff"})},
                  e("option",{value:"pension"},"Pension Fund / Long-Income"),
                  e("option",{value:"sovereign"},"Sovereign Wealth Fund"),
                  e("option",{value:"family"},"Family Office"),
                  e("option",{value:"jv"},"JV Partner / Co-Investor"),
                  e("option",{value:"trade"},"Trade Buyer"),
                  e("option",{value:"reit"},"Listed REIT"),
                  e("option",{value:"hni"},"High Net Worth Individual"),
                  e("option",{value:"general"},"General / Broadcast")
                )
              ),
              e("div",null,
                e("label",{style:Object.assign({},lbl,{color:"rgba(255,255,255,0.6)"})},"Passcode (optional)"),
                e("input",{value:inv.sharePasscode||"",onChange:function(ev){upi("sharePasscode",ev.target.value);},placeholder:"Leave blank for no passcode",style:Object.assign({},ipt,{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff"})})
              ),
              e("div",null,
                e("label",{style:Object.assign({},lbl,{color:"rgba(255,255,255,0.6)"})},"Expires (optional)"),
                e("input",{type:"date",value:inv.shareExpires||"",onChange:function(ev){upi("shareExpires",ev.target.value);},style:Object.assign({},ipt,{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff"})})
              )
            ),
            e("div",{style:{display:"flex",gap:10,marginTop:8}},
              e("button",{
                onClick:function(){
                  // Create share
                  fetch(WEBHOOK+"?"+new URLSearchParams({
                    action:"create_share",
                    userId:user.userId,
                    dealId:dealId,
                    tier:inv.createTier,
                    passcode:inv.sharePasscode||"",
                    expiresAt:inv.shareExpires||"",
                    title:inv.shareTitle||"Investment Opportunity",
                    emailGate:"true"
                  }).toString())
                  .then(function(r){return r.json();})
                  .then(function(d){
                    if(d && d.status==="ok"){
                      upi("createTier","");
                      upi("shareTitle","");upi("sharePasscode","");upi("shareExpires","");
                      refreshShares();
                      upi("tab","shares");
                      alert("✓ Share link created. Switch to 'Share Links' tab to copy + send.");
                    } else {
                      alert("Failed: "+((d&&d.message)||"unknown error"));
                    }
                  })
                  .catch(function(){alert("Network error");});
                },
                style:{padding:"10px 20px",background:"#EDE84A",border:"none",borderRadius:6,color:"#1E1F5C",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"Create Link →"),
              e("button",{onClick:function(){upi("createTier","");},style:{padding:"10px 20px",background:"transparent",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Cancel")
            )
          ),

          // Quick guide
          e("div",{style:{background:"#F8F8FE",borderLeft:"3px solid #4A4BAE",borderRadius:6,padding:"14px 16px",fontSize:11,color:"#3A3D6A",lineHeight:1.7}},
            e("strong",{style:{color:"#1E1F5C"}},"How institutional outreach actually works: "),
            "Send the ",e("strong",null,"Teaser")," to 50+ contacts (no NDA needed). 5-10 will request more — give them the ",e("strong",null,"IM")," after they sign your NDA. 1-2 will reach LOI stage — only THEN open the ",e("strong",null,"Data Room"),". Every share link has its own analytics so you can see who's engaged."
          )
        ),

        // ── TAB 2: MEDIA LIBRARY ─────────────────────────────────────────
        tab==="media" && renderInvestorMedia(dealId, upi, ipt, lbl),

        // ── TAB 3: SHARES ────────────────────────────────────────────────
        tab==="shares" && e("div",null,
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}},
            e("div",null,
              e("h3",{style:{fontSize:16,fontWeight:800,color:"#1E1F5C",marginBottom:2}},"Your share links"),
              e("div",{style:{fontSize:11,color:"#7278A0"}},"All shareable links for this deal — copy, deactivate, or check engagement")
            ),
            e("button",{onClick:refreshShares,style:{padding:"6px 12px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontWeight:700,color:"#3A3D6A",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"⟳ Refresh")
          ),
          inv._sharesLoading && e("div",{style:{padding:20,textAlign:"center",color:"#7278A0",fontSize:12}},"Loading..."),
          !inv._sharesLoading && (!inv.shares || inv.shares.length===0) && e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px dashed rgba(74,75,174,0.3)",borderRadius:10,padding:"28px 24px",textAlign:"center"}},
            e("div",{style:{fontSize:32,marginBottom:8}},"🔗"),
            e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A",marginBottom:6}},"No share links yet"),
            e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6}},"Switch to 'Build Package' tab and click 'Create link' on Teaser / IM / Data Room.")
          ),
          (inv.shares||[]).map(function(s){
            var tierLabel = s.tier==="teaser"?"📬 Teaser":s.tier==="im"?"📑 IM":"📁 Data Room";
            var tierColor = s.tier==="teaser"?"#2D7A65":s.tier==="im"?"#4A4BAE":"#9A7B3E";
            var shareUrl = window.location.origin + window.location.pathname + "?share="+s.shareId;
            return e("div",{key:s.shareId,style:{background:"#fff",border:"1px solid #DDE0ED",borderLeft:"5px solid "+tierColor,borderRadius:8,padding:"14px 16px",marginBottom:10}},
              e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"start",gap:12,flexWrap:"wrap"}},
                e("div",{style:{flex:"1 1 240px",minWidth:0}},
                  e("div",{style:{fontSize:13,fontWeight:800,color:"#1E1F5C",marginBottom:3}},s.title||"Untitled"),
                  e("div",{style:{fontSize:10,color:tierColor,fontWeight:700,letterSpacing:".05em",marginBottom:6}},tierLabel),
                  e("div",{style:{display:"flex",gap:14,flexWrap:"wrap",fontSize:10,color:"#7278A0"}},
                    e("span",null,"👁 "+s.viewCount+" view"+(s.viewCount===1?"":"s")),
                    s.lastViewedAt && e("span",null,"Last view: "+new Date(s.lastViewedAt).toLocaleString("en-GB")),
                    s.expiresAt && e("span",null,"Expires: "+new Date(s.expiresAt).toLocaleDateString("en-GB"))
                  )
                ),
                e("div",{style:{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}},
                  e("input",{readOnly:true,value:shareUrl,onClick:function(ev){ev.target.select();},style:{padding:"6px 10px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:10,fontFamily:"monospace",color:"#3A3D6A",background:"#F7F8FC",width:240}}),
                  e("button",{onClick:function(){
                    try{
                      navigator.clipboard.writeText(shareUrl);
                      alert("✓ Copied to clipboard");
                    }catch(e){
                      window.prompt("Copy this link:",shareUrl);
                    }
                  },style:{padding:"6px 12px",background:"#4A4BAE",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"📋 Copy")
                )
              )
            );
          })
        ),

        // ── TAB 4: ANALYTICS ─────────────────────────────────────────────
        tab==="analytics" && e("div",null,
          e("h3",{style:{fontSize:16,fontWeight:800,color:"#1E1F5C",marginBottom:14}},"Engagement analytics"),
          (!inv.shares || inv.shares.length===0) && e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px dashed rgba(74,75,174,0.3)",borderRadius:10,padding:"28px 24px",textAlign:"center"}},
            e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6}},"Create share links first, then engagement data appears here as investors view your materials.")
          ),
          inv.shares && inv.shares.length>0 && (function(){
            var totalViews = inv.shares.reduce(function(a,s){return a+(s.viewCount||0);},0);
            var totalLinks = inv.shares.length;
            var activeLinks = inv.shares.filter(function(s){return s.viewCount>0;}).length;
            return e("div",null,
              e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:18}},
                e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"14px 16px"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".08em",textTransform:"uppercase",fontWeight:700}},"Total Links"),
                  e("div",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginTop:4}},totalLinks)
                ),
                e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"14px 16px"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".08em",textTransform:"uppercase",fontWeight:700}},"Total Views"),
                  e("div",{style:{fontSize:24,fontWeight:800,color:"#2D7A65",marginTop:4}},totalViews)
                ),
                e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"14px 16px"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".08em",textTransform:"uppercase",fontWeight:700}},"Active Links"),
                  e("div",{style:{fontSize:24,fontWeight:800,color:"#9A7B3E",marginTop:4}},activeLinks)
                ),
                e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"14px 16px"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".08em",textTransform:"uppercase",fontWeight:700}},"Avg Views/Link"),
                  e("div",{style:{fontSize:24,fontWeight:800,color:"#4A4BAE",marginTop:4}},totalLinks>0?(totalViews/totalLinks).toFixed(1):"0")
                )
              ),
              e("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"DM Sans,sans-serif",background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden"}},
                e("thead",null,
                  e("tr",{style:{background:"#F4F5FB"}},
                    ["Link","Tier","Views","Last viewed","Status"].map(function(h){
                      return e("th",{key:h,style:{padding:"10px 12px",textAlign:"left",fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".05em",fontWeight:700,borderBottom:"2px solid #DDE0ED"}},h);
                    })
                  )
                ),
                e("tbody",null,
                  inv.shares.map(function(s){
                    return e("tr",{key:s.shareId,style:{borderBottom:"1px solid #F0F1FA"}},
                      e("td",{style:{padding:"10px 12px",fontWeight:700,color:"#1E1F5C"}},s.title||"Untitled"),
                      e("td",{style:{padding:"10px 12px"}},s.tier==="teaser"?"📬 Teaser":s.tier==="im"?"📑 IM":"📁 Data Room"),
                      e("td",{style:{padding:"10px 12px",fontWeight:800,color:s.viewCount>0?"#2D7A65":"#C0C4D8"}},s.viewCount||0),
                      e("td",{style:{padding:"10px 12px",color:"#7278A0",fontSize:10}},s.lastViewedAt?new Date(s.lastViewedAt).toLocaleString("en-GB"):"—"),
                      e("td",{style:{padding:"10px 12px"}},
                        e("span",{style:{padding:"2px 8px",background:s.viewCount>0?"rgba(45,122,101,0.12)":"rgba(120,120,160,0.08)",color:s.viewCount>0?"#2D7A65":"#7278A0",borderRadius:3,fontSize:9,fontWeight:700,letterSpacing:".05em"}},s.viewCount>0?"ENGAGED":"NOT YET")
                      )
                    );
                  })
                )
              )
            );
          })()
        )
      )
    );
  }

  // ── Media library sub-render (used by Investor Suite) ──
  function renderInvestorMedia(dealId, upi, ipt, lbl){
    var inv = data.investor || {};
    var mediaList = inv.media || [];

    // Auto-fetch on first visit if empty
    if(!inv._mediaLoaded && !inv._mediaLoading && user && user.userId){
      upi("_mediaLoading",true);
      // For now, media is part of the share endpoint — there's no separate list
      // We'll add a separate list endpoint if needed; for v9.2, fetch via share load
      upi("_mediaLoaded",true);
      upi("_mediaLoading",false);
    }

    function handleFile(file, kind){
      if(!file) return;
      if(file.size > 5*1024*1024){
        alert("File too large — max 5MB. (Apps Script upload limit). For larger files, use a YouTube/Vimeo embed.");
        return;
      }
      var reader = new FileReader();
      reader.onload = function(ev){
        upi("_uploading",true);
        var base64 = ev.target.result;
        fetch(WEBHOOK, {
          method:"POST",
          headers:{"Content-Type":"text/plain;charset=utf-8"},
          body:JSON.stringify({
            action:"upload_media",
            userId:user.userId,
            dealId:dealId,
            kind:kind,
            title:file.name,
            mimeType:file.type,
            base64Data:base64
          })
        })
        .then(function(r){return r.json();})
        .then(function(d){
          upi("_uploading",false);
          if(d && d.status==="ok"){
            var newMedia = (inv.media||[]).concat([{
              mediaId:d.mediaId, kind:kind, title:file.name,
              driveUrl:d.driveUrl, embedUrl:d.embedUrl
            }]);
            upi("media",newMedia);
            alert("✓ Uploaded: "+file.name);
          } else {
            alert("Upload failed: "+((d&&d.message)||"unknown error"));
          }
        })
        .catch(function(err){
          upi("_uploading",false);
          alert("Upload error — file may be too large for backend (5MB max).");
        });
      };
      reader.readAsDataURL(file);
    }

    function addVideoEmbed(){
      var url = window.prompt("Paste YouTube or Vimeo URL:");
      if(!url) return;
      var title = window.prompt("Title for this video:","Site video");
      upi("_uploading",true);
      fetch(WEBHOOK+"?"+new URLSearchParams({
        action:"upload_media",
        userId:user.userId,
        dealId:dealId,
        kind:"video_embed",
        title:title||"Video",
        embedUrl:url
      }).toString())
      .then(function(r){return r.json();})
      .then(function(d){
        upi("_uploading",false);
        if(d && d.status==="ok"){
          var newMedia = (inv.media||[]).concat([{
            mediaId:d.mediaId, kind:"video_embed", title:title,
            embedUrl:d.embedUrl
          }]);
          upi("media",newMedia);
        } else {
          alert("Failed: "+((d&&d.message)||"unknown error"));
        }
      })
      .catch(function(){
        upi("_uploading",false);
        alert("Network error");
      });
    }

    return e("div",null,
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}},
        e("div",null,
          e("h3",{style:{fontSize:16,fontWeight:800,color:"#1E1F5C",marginBottom:2}},"Media library"),
          e("div",{style:{fontSize:11,color:"#7278A0"}},"Photos, videos, and supporting documents shown to investors when they view your share links")
        )
      ),

      // Upload buttons
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:18}},
        e("label",{style:{background:"#fff",border:"2px dashed #4A4BAE",borderRadius:10,padding:"18px 16px",textAlign:"center",cursor:"pointer",display:"block"}},
          e("input",{type:"file",accept:"image/*",style:{display:"none"},onChange:function(ev){handleFile(ev.target.files[0],"photo");}}),
          e("div",{style:{fontSize:28,marginBottom:6}},"🖼"),
          e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A",marginBottom:3}},"Upload Photo"),
          e("div",{style:{fontSize:10,color:"#7278A0"}},"JPG / PNG · max 5MB")
        ),
        e("div",{onClick:addVideoEmbed,style:{background:"#fff",border:"2px dashed #2D7A65",borderRadius:10,padding:"18px 16px",textAlign:"center",cursor:"pointer"}},
          e("div",{style:{fontSize:28,marginBottom:6}},"🎬"),
          e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A",marginBottom:3}},"Embed Video"),
          e("div",{style:{fontSize:10,color:"#7278A0"}},"YouTube / Vimeo link")
        ),
        e("label",{style:{background:"#fff",border:"2px dashed #9A7B3E",borderRadius:10,padding:"18px 16px",textAlign:"center",cursor:"pointer",display:"block"}},
          e("input",{type:"file",accept:".pdf,.doc,.docx,.xls,.xlsx",style:{display:"none"},onChange:function(ev){handleFile(ev.target.files[0],"document");}}),
          e("div",{style:{fontSize:28,marginBottom:6}},"📄"),
          e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A",marginBottom:3}},"Upload Document"),
          e("div",{style:{fontSize:10,color:"#7278A0"}},"PDF / Word · max 5MB")
        )
      ),

      inv._uploading && e("div",{style:{padding:"12px 14px",background:"rgba(74,75,174,0.08)",border:"1px solid rgba(74,75,174,0.3)",borderRadius:6,fontSize:11,color:"#4A4BAE",marginBottom:14}},"⟳ Uploading..."),

      // Gallery
      mediaList.length === 0 && e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px dashed rgba(74,75,174,0.3)",borderRadius:10,padding:"24px",textAlign:"center"}},
        e("div",{style:{fontSize:32,marginBottom:8}},"📸"),
        e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A",marginBottom:6}},"No media uploaded yet"),
        e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6,maxWidth:380,margin:"0 auto"}},"Upload site photos, embed a drone tour video, attach planning docs. Investors see all of this when they open your share link.")
      ),
      mediaList.length > 0 && e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}},
        mediaList.map(function(m){
          return e("div",{key:m.mediaId,style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:10}},
            m.kind==="photo" && e("img",{src:m.driveUrl,alt:m.title,style:{width:"100%",height:140,objectFit:"cover",borderRadius:5,marginBottom:8,background:"#F7F8FC"}}),
            m.kind==="video_embed" && e("div",{style:{position:"relative",paddingBottom:"56.25%",height:0,marginBottom:8,borderRadius:5,overflow:"hidden",background:"#000"}},
              e("iframe",{src:m.embedUrl,style:{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:0},allowFullScreen:true,title:m.title})
            ),
            m.kind==="document" && e("div",{style:{padding:"24px 12px",textAlign:"center",background:"#F7F8FC",borderRadius:5,marginBottom:8}},
              e("div",{style:{fontSize:36}},"📄"),
              e("div",{style:{fontSize:10,color:"#7278A0",marginTop:4}},"Document")
            ),
            e("div",{style:{fontSize:11,fontWeight:700,color:"#1E1F5C",marginBottom:2,wordBreak:"break-word"}},m.title||"Untitled"),
            e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".05em"}},m.kind.replace("_"," ")),
            m.driveUrl && e("a",{href:m.driveUrl,target:"_blank",style:{fontSize:10,color:"#4A4BAE",textDecoration:"underline",display:"inline-block",marginTop:4}},"Open in Drive →")
          );
        })
      )
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TENURE MIX — Mixed-tenure development planning
  //   Real UK SFH/BTR schemes blend Open Market + Affordable Rent + Shared
  //   Ownership + First Homes + BTR etc. This stage lets the user split units
  //   across tenures, set per-tenure pricing, and see blended GDV.
  // ═══════════════════════════════════════════════════════════════════════════
  /* renderTenureMix moved to js/screen-TenureMix.js (loaded before this script) */


  // ──────────────────────────────────────────────────────────────────────
  // PROPAGATION AUDIT (v9.21)
  // Lists every shared field across stages and surfaces where they disagree.
  // The systematic diagnostic page for "does the data flow correctly?"
  // ──────────────────────────────────────────────────────────────────────
  /* renderPropagationAudit moved to js/screen-PropagationAudit.js (loaded before this script) */

  function renderDashboard(){
    try{
    // Compute clean reconciliation between RLV (target-profit basis) and Dashboard (actual-cost basis)
    var DMd = calcDealMetrics(data);
    var targetProfit = DMd.profit;        // GDV * 17.5% — the developer's TARGET on RLV stage
    var actualProfit = DMd.actualProfit;  // GDV - totalCost - landPrice — what's actually left
    var targetMargin = gdv>0 ? (targetProfit/gdv)*100 : 0;

    var cards=[
      {l:"GDV",v:gdv>0?fmt(gdv):"—"},
      {l:"Total Dev Cost",v:tc>0&&gdv>0?fmt(tc):"—",sub:"Build + fees + cont + S106 + finance + land"},
      {l:"Profit on Cost",v:gdv>0&&tc>0?fmt(profit):"—",c:profit>0?scM:"#C0C4D8",sub:"GDV − all costs incl. land"},
      {l:"Margin on GDV",v:gdv>0&&tc>0?pct(margin):"—",c:margin>0?scM:"#C0C4D8",sub:"Actual margin (after land price)"},
      {l:"NOI (pa)",v:!isSFHdash&&noi>0?fmt(noi):"—"},
      {l:"Exit Yield",v:!isSFHdash&&ey>0?(ey*100).toFixed(2)+"%":"—"},
      {l:"Units / Beds",v:effUnits||"—"},
      {l:"City",v:city?cityName(city):"—"},
    ];
    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Deal Dashboard"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:data.masterReport?8:12}},"Live overview — fill in the stages to see metrics update"),

      // v9.31 — "What you still need to fill" — incomplete REQUIRED stages
      (function(){
        if(!data.assetType) return null;  // need a journey to evaluate against
        var incompleteRequired = [];
        var incompleteRecommended = [];
        ALL_STAGES.forEach(function(s){
          var rel = getStageRelevance(s.id, data);
          var complete = isStageComplete(s.id, data);
          if(complete) return;
          if(s.id==="dashboard"||s.id==="portfolio"||s.id==="propagation") return;  // skip non-input stages
          if(rel==="required") incompleteRequired.push(s);
          else if(rel==="recommended") incompleteRecommended.push(s);
        });

        if(incompleteRequired.length===0 && incompleteRecommended.length===0){
          // All required filled
          return e("div",{style:{padding:"12px 16px",background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.3)",borderRadius:8,marginBottom:14,display:"flex",alignItems:"center",gap:10}},
            e("span",{style:{fontSize:18}},"✓"),
            e("div",{style:{flex:1}},
              e("div",{style:{fontSize:12,fontWeight:700,color:"#2D7A65"}},"All required stages complete"),
              e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2}},"This deal has all the essentials filled in. Optional stages are available in the sidebar if you want extra detail.")
            )
          );
        }

        return e("div",{style:{padding:"14px 16px",background:"rgba(176,90,53,0.05)",border:"1px solid rgba(176,90,53,0.25)",borderRadius:8,marginBottom:14}},
          e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
            e("span",{style:{fontSize:14}},"📋"),
            e("div",{style:{fontSize:12,fontWeight:800,color:"#B05A35",letterSpacing:".05em",textTransform:"uppercase"}},
              "What you still need to fill"
            )
          ),
          incompleteRequired.length>0 && e("div",{style:{marginBottom:incompleteRecommended.length>0?10:0}},
            e("div",{style:{fontSize:10,fontWeight:700,color:"#B05A35",marginBottom:6,textTransform:"uppercase",letterSpacing:".08em"}},"Required ("+incompleteRequired.length+")"),
            e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
              incompleteRequired.map(function(s){
                return e("div",{key:s.id,onClick:function(){navTo(s.id);},style:{display:"flex",alignItems:"center",gap:9,padding:"7px 10px",background:"#fff",border:"1px solid rgba(176,90,53,0.2)",borderRadius:5,cursor:"pointer",transition:"all .12s"}},
                  e("span",{style:{fontSize:14,width:16}},s.icon),
                  e("span",{style:{flex:1,fontSize:12,color:"#3A3D6A",fontWeight:600}},s.label),
                  e("span",{style:{fontSize:10,color:"#B05A35",fontWeight:700}},"Open →")
                );
              })
            )
          ),
          incompleteRecommended.length>0 && e("div",null,
            e("div",{style:{fontSize:10,fontWeight:700,color:"#9A7B3E",marginBottom:6,textTransform:"uppercase",letterSpacing:".08em"}},"Recommended ("+incompleteRecommended.length+")"),
            e("div",{style:{display:"flex",flexWrap:"wrap",gap:6}},
              incompleteRecommended.slice(0,8).map(function(s){
                return e("div",{key:s.id,onClick:function(){navTo(s.id);},style:{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 9px",background:"#fff",border:"1px solid rgba(154,123,62,0.25)",borderRadius:4,cursor:"pointer",fontSize:11,color:"#3A3D6A"}},
                  e("span",null,s.icon),e("span",null,s.label)
                );
              }),
              incompleteRecommended.length>8 && e("span",{style:{fontSize:11,color:"#7278A0",alignSelf:"center"}},"+ "+(incompleteRecommended.length-8)+" more")
            )
          )
        );
      })(),

      // v9.16 — Auto-migration result banner
      // After loadDeal/cloud load runs migrateLoadedDeal(), this banner surfaces
      // what was auto-fixed and what may need user review. User can restore the
      // pre-migration state if they disagree with any of the changes.
      (function(){
        var migLog = data._migrationLog || [];
        var reviewList = data._migrationReviewRecommended || [];
        if(migLog.length === 0 && reviewList.length === 0) return null;
        if(data._migrationBannerDismissed === CURRENT_VERSION) return null;
        return e("div",{style:{margin:"6px 0 14px",padding:"14px 16px",background:"linear-gradient(135deg,rgba(45,122,101,0.10),rgba(45,122,101,0.04))",border:"1px solid rgba(45,122,101,0.4)",borderRadius:8,fontSize:12,color:"#1d5446",lineHeight:1.6}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:8}},
            e("div",{style:{flex:1,minWidth:200}},
              e("div",{style:{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",fontWeight:700,color:"#2D7A65",marginBottom:3}},"✓ Deal auto-updated to v"+CURRENT_VERSION),
              e("div",{style:{fontWeight:700,fontSize:13,color:"#1d5446"}},
                migLog.length+" structural fix"+(migLog.length!==1?"es":"")+" applied automatically"+
                (reviewList.length>0?" · "+reviewList.length+" field"+(reviewList.length!==1?"s":"")+" to review":"")
              ),
              e("div",{style:{fontSize:11,color:"#3A6B5C",marginTop:3}},
                "Saved on v"+(data._migrationFrom||"(unknown)")+" — Landform fixed known issues automatically. You can restore the previous values if you disagree."
              )
            ),
            e("button",{onClick:function(){
              setData(function(prev){return Object.assign({},prev,{_migrationBannerDismissed:CURRENT_VERSION});});
            },style:{padding:"4px 8px",background:"transparent",border:"1px solid #2D7A65",color:"#2D7A65",borderRadius:3,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Dismiss")
          ),
          // Auto-fixed list
          migLog.length>0 && e("div",{style:{background:"rgba(255,255,255,0.5)",borderRadius:5,padding:"10px 12px",marginBottom:8,fontSize:11}},
            e("div",{style:{fontWeight:700,marginBottom:6,color:"#1d5446"}},"What was auto-fixed:"),
            migLog.map(function(m,i){
              return e("div",{key:i,style:{marginBottom:5,paddingBottom:5,borderBottom:i<migLog.length-1?"1px dotted rgba(45,122,101,0.2)":"none"}},
                e("div",{style:{fontSize:11,color:"#2E2F8A",fontFamily:"monospace"}},m.field),
                e("div",{style:{fontSize:10,color:"#5C5238",marginTop:2}},
                  "was: ",e("strong",null,String(m.from||"(empty)"))," → now: ",e("strong",null,String(m.to||"(auto)")),
                ),
                e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2,fontStyle:"italic"}},m.reason)
              );
            })
          ),
          // Review-recommended list
          reviewList.length>0 && e("div",{style:{background:"rgba(154,123,62,0.10)",borderRadius:5,padding:"10px 12px",marginBottom:8,fontSize:11,border:"1px solid rgba(154,123,62,0.25)"}},
            e("div",{style:{fontWeight:700,marginBottom:6,color:"#7B6432"}},"⚠ Manual review recommended:"),
            e("div",{style:{fontSize:10,color:"#7B6432",marginBottom:6,fontStyle:"italic"}},"These values weren't auto-changed because they may have been intentionally set, but they look unusual. Open RLV stage to verify."),
            reviewList.map(function(r,i){
              return e("div",{key:i,style:{marginBottom:4}},
                e("span",{style:{fontFamily:"monospace",color:"#2E2F8A"}},r.field),
                ": ",e("strong",null,String(r.current))," vs expected ",e("strong",null,String(r.expected))," (",r.reason,")"
              );
            })
          ),
          // Actions
          e("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
            e("button",{
              onClick:function(){navTo("rlv");},
              style:{padding:"7px 13px",background:"#2D7A65",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },"Review RLV stage →"),
            data._preMigrationBackup && e("button",{
              onClick:function(){
                if(!confirm("Restore previous values?\n\nThis undoes all auto-migration fixes and restores the deal as it was originally saved (on v"+(data._migrationFrom||"unknown")+").\n\nYou can re-apply migration later via the Reset RLV defaults flow.")) return;
                var backup = data._preMigrationBackup;
                setData(function(prev){
                  // Restore from backup but keep the cloud ID
                  return Object.assign({}, backup, {_cloudDealId:prev._cloudDealId, _migrationRolledBack:true});
                });
              },
              style:{padding:"7px 13px",background:"transparent",border:"1px solid #B05A35",color:"#B05A35",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },"Restore previous values"),
            e("button",{
              onClick:function(){
                var msg = "Auto-migration log:\n\nDeal saved on: v"+(data._migrationFrom||"unknown")+"\nCurrent version: v"+CURRENT_VERSION+"\nMigration ran: "+(data._migrationAt||"unknown")+"\n\nFields auto-fixed:\n";
                migLog.forEach(function(m){
                  msg += "  • "+m.field+": "+String(m.from)+" → "+String(m.to)+"\n    ("+m.reason+")\n";
                });
                if(reviewList.length>0){
                  msg += "\nFields recommended for review:\n";
                  reviewList.forEach(function(r){
                    msg += "  • "+r.field+": currently "+r.current+", expected "+r.expected+" ("+r.reason+")\n";
                  });
                }
                alert(msg);
              },
              style:{padding:"7px 13px",background:"transparent",border:"1px solid #2D7A65",color:"#2D7A65",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },"Full log")
          )
        );
      })(),

      // v9.16 — Legacy "version mismatch" banner (now ONLY shows if there's a version gap
      // but auto-migration found nothing safe to fix — i.e. user data may still be stale
      // but we couldn't determine it was wrong)
      (function(){
        var savedV = data._savedVersion || null;
        if(!savedV) return null;
        if(semverCompare(savedV, CURRENT_VERSION) >= 0) return null;
        // If auto-migration already ran (with fixes OR reviews), don't show this banner
        if((data._migrationLog||[]).length > 0) return null;
        if((data._migrationReviewRecommended||[]).length > 0) return null;
        if(data._migrationDismissed === CURRENT_VERSION) return null;
        var breakingChanges = calcAffectingChangesSince(savedV);
        if(breakingChanges.length === 0) return null;
        return e("div",{style:{margin:"6px 0 14px",padding:"14px 16px",background:"linear-gradient(135deg,rgba(154,123,62,0.10),rgba(154,123,62,0.04))",border:"1px solid rgba(154,123,62,0.4)",borderRadius:8,fontSize:12,color:"#7B6432",lineHeight:1.6}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:8}},
            e("div",{style:{flex:1,minWidth:200}},
              e("div",{style:{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",fontWeight:700,color:"#9A7B3E",marginBottom:3}},"⚠ Deal saved on older version"),
              e("div",{style:{fontWeight:700,fontSize:13,color:"#7B6432"}},"Saved on v"+savedV+" — current is v"+CURRENT_VERSION),
              e("div",{style:{fontSize:11,color:"#8A7048",marginTop:3}},"Auto-migration found nothing structurally wrong, but "+breakingChanges.length+" version(s) since save changed calculations. Manually review RLV inputs if figures look off.")
            ),
            e("button",{onClick:function(){
              setData(function(prev){return Object.assign({},prev,{_migrationDismissed:CURRENT_VERSION});});
            },style:{padding:"4px 8px",background:"transparent",border:"1px solid #9A7B3E",color:"#9A7B3E",borderRadius:3,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Dismiss")
          ),
          e("button",{
            onClick:function(){navTo("rlv");},
            style:{padding:"7px 13px",background:"#9A7B3E",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"Review RLV stage →")
        );
      })(),

      // Active scenario banner — tells the user which planning world this deal is modelled in
      data.land&&data.land.appliedScenario&&e("div",{style:{margin:"6px 0 14px",padding:"12px 16px",background:"linear-gradient(135deg,rgba(45,122,101,0.10),rgba(45,122,101,0.04))",border:"1px solid rgba(45,122,101,0.4)",borderRadius:8,fontSize:12,color:"#1d5446",lineHeight:1.5,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}},
        e("div",null,
          e("div",{style:{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",fontWeight:700,color:"#2D7A65",marginBottom:3}},"Active planning scenario"),
          e("div",{style:{fontWeight:700,fontSize:14,color:"#1d5446"}},data.land.appliedScenarioLabel||data.land.appliedScenario),
          e("div",{style:{fontSize:11,color:"#3A6B5C",marginTop:3}},
            "Land value: "+fmt(num(data.land.scenarioLandValue||0))+
            " · AH: "+(num(data.land.scenarioAhPct||0))+"%"+
            " · Timeline: "+(num(data.land.scenarioTimelineMo||0))+" months"+
            " · Finance: "+(num(data.land.scenarioFinanceRate||0))+"%"
          )
        ),
        e("button",{onClick:function(){navTo("land");},style:{padding:"7px 14px",background:"transparent",border:"1px solid #2D7A65",color:"#2D7A65",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Change scenario →")
      ),

      // Reconciliation note: explain why RLV's margin and Dashboard's margin look different
      gdv>0 && tc>0 && num((data.land&&data.land.price)||0) > 0 && e("div",{style:{margin:"6px 0 14px",padding:"10px 14px",background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
        e("strong",{style:{color:"#1E1F5C"}},"ℹ Why does this differ from the RLV stage? "),
        "The RLV uses a TARGET developer profit of ~17.5% to calculate the maximum land bid. This Dashboard shows your ACTUAL margin based on what you're paying for the land. ",
        "If actual land price (",fmt(num(data.land.price)),") < max land bid (",fmt(DMd.rlv),"), your actual margin (",pct(margin),") will be HIGHER than the 17.5% target."
      ),
      (function(){
        var hasLand=!!(data.land&&data.land.address);
        var hasCity=!!city;
        var hasSFHMix=!!(data.sfh&&data.sfh.mix&&data.sfh.mix.some(function(r){return num(r.count)>0;}));
        var hasFin=!!(data.fin&&(data.fin.buildPsf||data.fin.manualGdv));
        var hasPlan=!!(data.planning&&data.planning.lpa);
        if(hasLand&&hasSFHMix&&hasFin&&hasPlan)return null; // All done
        var steps=[];
        if(!hasLand)steps.push({n:1,label:"Import a land listing",action:function(){navTo("scraper");},btn:"Go to Land Finder →"});
        else if(!hasCity)steps.push({n:2,label:"Select city/market in Land Appraisal",action:function(){navTo("land");},btn:"Go to Land Appraisal →"});
        else if(!hasSFHMix)steps.push({n:3,label:"Fill in house type mix in SFH Appraisal",action:function(){navTo("sfh");},btn:"Go to SFH Appraisal →"});
        else if(!hasFin)steps.push({n:4,label:"Run Financial Modelling",action:function(){navTo("fin");},btn:"Go to Financial Modelling →"});
        else if(!hasPlan)steps.push({n:5,label:"Add planning details",action:function(){navTo("planning");},btn:"Go to Planning →"});
        if(steps.length===0)return null;
        var next=steps[0];
        return e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px dashed rgba(74,75,174,0.3)",borderRadius:8,padding:"10px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}},
          e("div",null,
            e("div",{style:{fontSize:10,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",marginBottom:2}},"Next step"),
            e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A"}},"Step "+next.n+": "+next.label)
          ),
          e("button",{onClick:next.action,style:{padding:"7px 16px",background:"#4A4BAE",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}},next.btn)
        );
      })(),
      data.masterReport&&(function(){
        var ai2={};
        try{ai2=JSON.parse(data.masterReport);}catch(e){return null;}
        if(!ai2.goNoGo)return null;
        var goColor=ai2.goNoGo==="GO"?"#2D7A65":ai2.goNoGo==="CAUTION"?"#9A7B3E":"#B05A35";
        return e("div",{style:{background:goColor+"15",border:"2px solid "+goColor,borderRadius:10,padding:"14px 18px",marginBottom:20,display:"flex",alignItems:"center",gap:16}},
          e("div",{style:{fontSize:32,fontWeight:900,color:goColor,minWidth:60,textAlign:"center"}},
            ai2.goNoGo==="GO"?"✓ GO":ai2.goNoGo==="CAUTION"?"⚠ CAUTION":"✗ NO-GO"
          ),
          e("div",{style:{flex:1}},
            e("div",{style:{fontSize:13,fontWeight:700,color:goColor,marginBottom:3}},"AI Deal Assessment — "+ai2.goNoGo),
            e("div",{style:{fontSize:12,color:"#3A3D6A",lineHeight:1.6}},ai2.goNoGoReason||""),
            ai2.marketCommentary&&e("div",{style:{fontSize:11,color:"#7278A0",marginTop:4,fontStyle:"italic"}},ai2.marketCommentary)
          ),
          e("div",{style:{textAlign:"right",flexShrink:0}},
            ai2.recommendedUnits&&e("div",{style:{fontSize:11,color:"#7278A0"}},"Recommended: "+ai2.recommendedUnits+" units @ "+ai2.recommendedDph+"dph"),
            ai2.recommendedBid&&e("div",{style:{fontSize:11,color:goColor,fontWeight:700}},"Bid: £"+Math.round(ai2.recommendedBid).toLocaleString()),
            ai2.planningRisk&&e("div",{style:{fontSize:10,color:"#7278A0"}},"Planning risk: "+ai2.planningRisk)
          )
        );
      })(),
      (function(){
        var inbox=(data.placona&&data.placona.inbox)||[];
        if(!inbox||inbox.length===0)return null;
        return e("div",{style:{background:"linear-gradient(135deg,rgba(74,75,174,0.08),rgba(45,122,101,0.05))",border:"1px solid #4A4BAE",borderRadius:10,padding:"14px 18px",marginBottom:16}},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
            e("div",null,
              e("div",{style:{fontSize:10,fontWeight:800,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".12em",marginBottom:2}},"Placona Inbox"),
              e("div",{style:{fontSize:12,color:"#7278A0"}},inbox.length+" site"+(inbox.length!==1?"s":"")+" from Placona agent")
            ),
            e("button",{onClick:function(){up("placona","inbox",[]);},style:{padding:"4px 10px",background:"none",border:"1px solid #DDE0ED",borderRadius:4,color:"#B05A35",fontSize:10,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Clear all")
          ),
          inbox.slice(0,5).map(function(site,si){
            return e("div",{key:si,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#fff",borderRadius:6,marginBottom:6,border:"1px solid #DDE0ED"}},
              e("div",{style:{flex:1}},
                e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A"}},site.site_name||site.address_or_location||"Unknown site"),
                e("div",{style:{fontSize:10,color:"#7278A0"}},(site.county||"")+(site.local_planning_authority?" - "+site.local_planning_authority:"")+" - Score: "+(site.placona_score||"—")+" "+(site.placona_category?"("+site.placona_category+")":""))
              ),
              e("button",{
                onClick:function(){
                  loadSiteIntoDeal(site);
                  var newInbox=inbox.filter(function(_,idx2){return idx2!==si;});
                  up("placona","inbox",newInbox);
                },
                style:{padding:"6px 12px",background:"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}
              },"Load Deal")
            );
          }),
          inbox.length>5&&e("div",{style:{fontSize:11,color:"#7278A0",textAlign:"center",marginTop:4}},inbox.length-5+" more sites in inbox")
        );
      })(),
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}},
        cards.map(function(card){
          return e("div",{key:card.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:16}},
            e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}},card.l),
            e("div",{style:{fontSize:22,fontWeight:700,color:card.c||"#2E2F8A"}},card.v)
          );
        })
      ),
      e("div",{style:S.card},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,paddingBottom:12,borderBottom:"1px solid #DDE0ED",marginBottom:14}},
          e("span",null,"Journey & Asset Type"),
          e("div",{style:{display:"flex",gap:6}},
            e("button",{onClick:function(){setJourney("land");navTo("scraper");},
              style:{padding:"4px 10px",background:"#4A4BAE",border:"none",color:"#fff",borderRadius:4,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "🔍 Start Land Journey"),
            e("button",{onClick:function(){setJourney("property");navTo("epe");},
              style:{padding:"4px 10px",background:"#2D7A65",border:"none",color:"#fff",borderRadius:4,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "🏠 Start Property Journey"),
            journey!=="all"&&e("button",{onClick:function(){setJourney("all");},
              style:{padding:"4px 10px",background:"transparent",border:"1px solid #DDE0ED",color:"#7278A0",borderRadius:4,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "Show All Stages")
          )
        ),
        e("div",{style:{display:"flex",gap:10,flexWrap:"wrap"}},
          [
            {id:"btr",  label:"BTR",  desc:"Build to Rent — apartment block"},
            {id:"pbsa", label:"PBSA", desc:"Purpose Built Student Accommodation"},
            {id:"sfh",  label:"SFH",  desc:"Single Family Housing — housing estate"},
          ].map(function(t){
            return e("div",{key:t.id,style:{display:"flex",flexDirection:"column",gap:4}},
              e("button",{onClick:function(){
                setData(function(d){return Object.assign({},d,{assetType:t.id});});
                setJourney(t.id); // auto-switch journey when asset type selected
              },
                style:{padding:"8px 20px",background:at===t.id?"#4A4BAE":"transparent",border:"1px solid #4A4BAE",color:at===t.id?"#fff":"#4A4BAE",borderRadius:5,fontFamily:"DM Sans,sans-serif",fontSize:12,fontWeight:700,cursor:"pointer"}},
                t.label),
              e("div",{style:{fontSize:9,color:"#7278A0",textAlign:"center",maxWidth:120}},t.desc)
            );
          })
        )
      ),
      e("div",{style:S.card},
        e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,paddingBottom:12,borderBottom:"1px solid #DDE0ED",marginBottom:14}},
          e("span",null,"Quick Navigation"),
          e("div",{style:{display:"flex",gap:8}},
            e("button",{onClick:function(){setJourney("land");navTo("scraper");},
              style:{padding:"5px 12px",background:"#4A4BAE",border:"none",color:"#fff",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "🔍 Start Land Journey"),
            e("button",{onClick:function(){setJourney("property");navTo("epe");},
              style:{padding:"5px 12px",background:"#2D7A65",border:"none",color:"#fff",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "🏠 Start Property Journey")
          )
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}},
          (function(){
            var filtered=journey==="all"?
              (function(){
            var showAll=data.showAllStages;
            var coreStages=["scraper","rlv","sfh","fin","dashboard","portfolio"];
            var filtered=showAll?ALL_STAGES:ALL_STAGES.filter(function(s){
              var inJourney2=s.journeys&&(s.journeys.indexOf(journey)>=0||s.journeys.indexOf("all")>=0); return inJourney2||coreStages.indexOf(s.id)>=0;
            });
            return filtered;
          })().filter(function(s){return s.id!=="dashboard";}):
              (function(){
            var showAll=data.showAllStages;
            var coreStages=["scraper","rlv","sfh","fin","dashboard","portfolio"];
            var filtered=showAll?ALL_STAGES:ALL_STAGES.filter(function(s){
              var inJourney2=s.journeys&&(s.journeys.indexOf(journey)>=0||s.journeys.indexOf("all")>=0); return inJourney2||coreStages.indexOf(s.id)>=0;
            });
            return filtered;
          })().filter(function(s){return s.id!=="dashboard"&&(s.journeys.indexOf(journey)>=0||s.journeys.indexOf("all")>=0);});
            return filtered.map(function(s){
              return e("button",{key:s.id,onClick:function(){navTo(s.id);},
                style:{padding:"10px 8px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:7,fontFamily:"DM Sans,sans-serif",fontSize:11,fontWeight:500,color:"#3A3D6A",cursor:"pointer",textAlign:"center"}},
                s.icon+" "+s.label);
            });
          })()
        )
      ),
      e(AIPanel,{user:user,up:up,stage:"dashboard",data:data,persistKey:"dashboard_generate_deal_summar",label:"Generate Deal Summary",
        prompt:buildHonestPrompt(data,"Provide a comprehensive deal summary with investment thesis, key strengths, risks and next steps for a "+at.toUpperCase()+" development in "+cityName(city)+". GDV: "+fmt(gdv)+", Total cost: "+fmt(tc)+", Profit: "+fmt(profit)+", Margin: "+pct(margin)+". Rate the deal 1-10 with justification.")}),

      // ── WORKFLOW FLOWCHART ──────────────────────────────────────────────
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Deal Workflow — Your Journey"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:16}},"Follow this workflow for your selected asset type. Click any stage to navigate there. Completed stages show green."),
        journey!=="all"&&e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:6,padding:"8px 14px",fontSize:11,color:"#4A4BAE",marginBottom:12,display:"flex",alignItems:"center",gap:8}},
          e("span",{style:{fontWeight:700}},"Active Journey:"),
          e("span",null,(JOURNEYS[journey]&&JOURNEYS[journey].label)||journey),
          e("span",{style:{color:"#7278A0"}}," — irrelevant stages hidden in sidebar"),
          e("span",{onClick:function(){setJourney("all");},style:{marginLeft:"auto",cursor:"pointer",color:"#4A4BAE",fontWeight:700,fontSize:10}},"Show All →")
        ),

        // Asset type selector at top
        e("div",{style:{display:"flex",gap:8,marginBottom:20,padding:"12px 14px",background:"#F7F8FC",borderRadius:8}},
          e("span",{style:{fontSize:11,color:"#7278A0",fontWeight:600,marginRight:4}},"Workflow for:"),
          [
            {id:"btr",label:"BTR — Build to Rent"},
            {id:"pbsa",label:"PBSA — Student Accommodation"},
            {id:"sfh",label:"SFH — Housing Estate"},
          ].map(function(t){
            return e("button",{key:t.id,
              onClick:function(){setData(function(d){return Object.assign({},d,{assetType:t.id});});},
              style:{padding:"6px 14px",background:at===t.id?"#4A4BAE":"#fff",border:"1px solid "+(at===t.id?"#4A4BAE":"#DDE0ED"),color:at===t.id?"#fff":"#7278A0",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },t.label);
          })
        ),

        // Flowchart
        (function(){
          var steps={
            btr:[
              {phase:"1. FIND",color:"#4A4BAE",steps:[
                {id:"scraper",label:"Land Finder",desc:"Browse Bruton Knowles, Savills, Rightmove. Paste listing text to auto-extract data.",icon:"🔍",key:"land.address"},
                {id:"land",label:"Land Appraisal",desc:"Score the site — location, transport, contamination, tenure, constraints. Get Go/No-Go.",icon:"⬟",key:"land.city"},
                {id:"rlv",label:"Land Valuation",desc:"Run live Land Registry data. Calculate maximum bid using residual valuation.",icon:"◆",key:"rlv.units"},
              ]},
              {phase:"2. APPRAISE",color:"#7B6CB0",steps:[
                {id:"hra",label:"BTR Block Appraisal",desc:"Model the apartment block — storeys, unit mix (studio/1/2 bed), GIA efficiency, BSA compliance.",icon:"🏢",key:"hra.storeys"},
                {id:"planning",label:"Planning & Viability",desc:"NPPF compliance, LPA strategy, S106, BNG, affordable housing, fire gateway.",icon:"▲",key:"planning.lpa"},
              ]},
              {phase:"3. MODEL",color:"#2D7A65",steps:[
                {id:"fin",label:"Financial Modelling",desc:"Full appraisal — GDV, NOI, exit yield, TDC, developer profit, bear/base/bull scenarios.",icon:"◉",key:"fin.exitYield"},
                {id:"dd",label:"Due Diligence",desc:"Legal, technical, planning and commercial checklist. Clear all items before exchange.",icon:"◈",key:null},
                {id:"risks",label:"Risk Register",desc:"RAG-rate all risks. Red risks must have mitigation before proceeding.",icon:"⬡",key:null},
              ]},
              {phase:"4. EXIT",color:"#9A7B3E",steps:[
                {id:"exit",label:"Investment Exit",desc:"Forward fund, forward sale or stabilised exit. Generate HoTs and Investment Memorandum.",icon:"◆",key:"exit.strategy"},
              ]},
            ],
            pbsa:[
              {phase:"1. FIND",color:"#4A4BAE",steps:[
                {id:"scraper",label:"Land Finder",desc:"Find sites near universities. Bruton Knowles, Savills, Knight Frank all list PBSA opportunities.",icon:"🔍",key:"land.address"},
                {id:"land",label:"Land Appraisal",desc:"PBSA needs to be within 10-15 min walk of university. Score proximity heavily.",icon:"⬟",key:"land.city"},
                {id:"rlv",label:"Land Valuation",desc:"PBSA land values are higher near Russell Group unis. Run residual at PBSA yields (5-6%).",icon:"◆",key:"rlv.units"},
              ]},
              {phase:"2. APPRAISE",color:"#7B6CB0",steps:[
                {id:"hra",label:"PBSA Block Appraisal",desc:"Model bed count, cluster flats vs studios, amenity space, communal areas, management fees.",icon:"🏢",key:"hra.storeys"},
                {id:"planning",label:"Planning & Viability",desc:"Article 4 directions, HMO policy, university endorsement letters, student demand evidence.",icon:"▲",key:"planning.lpa"},
              ]},
              {phase:"3. MODEL",color:"#2D7A65",steps:[
                {id:"fin",label:"Financial Modelling",desc:"Model weekly rents × 51 weeks. PBSA void typically 3%. OpEx includes management (15-20% of income).",icon:"◉",key:"fin.exitYield"},
                {id:"dd",label:"Due Diligence",desc:"University nomination agreements, Article 4 compliance, fire strategy, accessibility.",icon:"◈",key:null},
                {id:"risks",label:"Risk Register",desc:"Key PBSA risks: university enrolment decline, operator default, Article 4 refusal.",icon:"⬡",key:null},
              ]},
              {phase:"4. EXIT",color:"#9A7B3E",steps:[
                {id:"exit",label:"Investment Exit",desc:"PBSA exits to specialist funds (Blackstone/iQ, Unite, Hines). Forward fund typical at 5-5.5% yield.",icon:"◆",key:"exit.strategy"},
              ]},
            ],
            sfh:[
              {phase:"1. FIND",color:"#4A4BAE",steps:[
                {id:"scraper",label:"Land Finder",desc:"Look for greenfield sites with local plan allocation, or brownfield with residential use class. Bruton Knowles specialise in strategic land.",icon:"🔍",key:"land.address"},
                {id:"land",label:"Land Appraisal",desc:"SFH needs good school catchments, transport links and proximity to employment. Min 30 dph density.",icon:"⬟",key:"land.city"},
                {id:"rlv",label:"Land Valuation",desc:"Value by £/plot or £/acre. Typical SFH land £150k-500k/acre depending on location and consent.",icon:"◆",key:"rlv.units"},
              ]},
              {phase:"2. APPRAISE",color:"#7B6CB0",steps:[
                {id:"sfh",label:"SFH Scheme Design",desc:"Set house type mix (2/3/4 bed). Run plot-by-plot appraisal with roads adoption (S38/S104) and SuDS.",icon:"🏡",key:"sfh.acres"},
                {id:"planning",label:"Planning & Viability",desc:"Outline application strategy, affordable housing (typically 25-40%), BNG, highways, drainage.",icon:"▲",key:"planning.lpa"},
              ]},
              {phase:"3. MODEL",color:"#2D7A65",steps:[
                {id:"fin",label:"Financial Modelling",desc:"Phase the development — typically 30-50 plots/year. Model sales cashflow by phase.",icon:"◉",key:"fin.exitYield"},
                {id:"dd",label:"Due Diligence",desc:"Title, ground conditions, utilities capacity, s38/s104 adoption agreements, section 278.",icon:"◈",key:null},
                {id:"risks",label:"Risk Register",desc:"SFH risks: planning refusal, build cost inflation, absorption rate slower than forecast.",icon:"⬡",key:null},
              ]},
              {phase:"4. EXIT",color:"#9A7B3E",steps:[
                {id:"exit",label:"Investment Exit",desc:"SFH exits via plot sales (open market) or bulk sale to housing association / BTR operator for affordable element.",icon:"◆",key:"exit.strategy"},
              ]},
            ],
          };

          var workflow=steps[at]||steps.btr;
          
          function isComplete(step) {
            if(!step.key) return false;
            var parts=step.key.split(".");
            var obj=data[parts[0]];
            return obj&&obj[parts[1]]&&obj[parts[1]]!=="";
          }

          return e("div",null,
            workflow.map(function(phase,pi){
              // Filter steps based on active journey
              var filteredSteps=phase.steps.filter(function(step){
                if(journey==="all")return true;
                var stageInfo=ALL_STAGES.find(function(s){return s.id===step.id;});
                if(!stageInfo)return true;
                return stageInfo.journeys.indexOf(journey)>=0||stageInfo.journeys.indexOf("all")>=0;
              });
              if(filteredSteps.length===0)return null;
              var phaseSteps=Object.assign({},phase,{steps:filteredSteps});
              return e("div",{key:phase.phase,style:{marginBottom:20}},
                e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:12}},
                  e("div",{style:{background:phase.color,color:"#fff",padding:"4px 14px",borderRadius:20,fontSize:10,fontWeight:700,letterSpacing:".1em"}},phase.phase),
                  e("div",{style:{flex:1,height:1,background:phase.color+"40"}})
                ),
                e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,paddingLeft:8}},
                  filteredSteps.map(function(step,si){
                    var complete=isComplete(step);
                    var active=stage===step.id;
                    return e("div",{key:step.id,
                      onClick:function(){navTo(step.id);},
                      style:{
                        background:active?"rgba(74,75,174,0.08)":complete?"rgba(45,122,101,0.06)":"#fff",
                        border:"1px solid "+(active?"#4A4BAE":complete?"#2D7A65":"#DDE0ED"),
                        borderLeft:"4px solid "+(active?"#4A4BAE":complete?"#2D7A65":phase.color+"60"),
                        borderRadius:8,padding:"14px 16px",cursor:"pointer",transition:"all .15s",
                      },
                      onMouseOver:function(ev){if(!active)ev.currentTarget.style.borderColor=phase.color;},
                      onMouseOut:function(ev){if(!active)ev.currentTarget.style.borderColor=complete?"#2D7A65":"#DDE0ED";}
                    },
                      e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:6}},
                        e("span",{style:{fontSize:16}},step.icon),
                        e("span",{style:{fontSize:13,fontWeight:700,color:active?"#4A4BAE":complete?"#2D7A65":"#2E2F8A"}},step.label),
                        complete&&e("span",{style:{marginLeft:"auto",fontSize:11,color:"#2D7A65",fontWeight:700}},"✓"),
                        active&&e("span",{style:{marginLeft:"auto",fontSize:10,color:"#4A4BAE",fontWeight:700}},"● HERE"),
                      ),
                      e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6}},step.desc),
                      e("div",{style:{marginTop:8,fontSize:10,fontWeight:700,color:active?"#4A4BAE":complete?"#2D7A65":"#A0A4C0"}},
                        active?"→ Currently here":complete?"✓ Data entered — click to review":"Click to open →"
                      )
                    );
                  })
                )
              );
            })
          );
        })()
      )
    );
    }catch(dashErr){
      return e("div",{style:{padding:32,color:"#B05A35"}},
        e("div",{style:{fontSize:18,fontWeight:700,marginBottom:8}},"Dashboard error"),
        e("div",{style:{fontSize:12,fontFamily:"DM Mono,monospace"}},dashErr.message||String(dashErr))
      );
    }
  }

  // ── PROPERTY EVALUATOR ─────────────────────────────────────────────────────
  /* renderEPE moved to js/screen-EPE.js */

  // ── LAND VALUATION ─────────────────────────────────────────────────────────
  /* renderRLV moved to js/screen-RLV.js */

  // ── SFH ────────────────────────────────────────────────────────────────────
  /* renderSFH moved to js/screen-SFH.js */

  // ── HIGH-RISE ───────────────────────────────────────────────────────────────
  /* renderHRA moved to js/screen-HRA.js */

  // ── LAND FINDER (SCRAPER) ──────────────────────────────────────────────────
    function doMasterAnalyse(){
      // Gather everything we know about the deal
      var l2=data.land||{};
      var r2=data.rlv||{};
      var p2=data.planning||{};
      var f2=data.fin||{};
      var s2=data.sfh||{};
      var scr=data.scraper&&data.scraper.result||{};

      var addr=l2.address||scr.address||"Unknown site";
      var pc=(r2.postcode||scr.postcode||"").toUpperCase();
      var lpaCity=l2.city||city||"unknown";
      var acres2=num(l2.acres||r2.acres||scr.acreage||0);
      var askPrice=num(l2.price||scr.askingPrice||0);
      var lpa2=p2.lpa||l2.localAuthority||scr.localAuthority||cityName(lpaCity)+" Council";
      var planStatus2=l2.planStatus||scr.planningStatus||"none";
      var ownerType2=l2.ownerType||"farmer";
      var description=scr.description||"";

      if(!addr||addr==="Unknown site"){
        alert("Please import a land listing first using Land Finder.");
        return;
      }

      setData(function(d){return Object.assign({},d,{masterLoading:true,masterReport:""});});

      var promptParts=[
        "You are an expert UK residential development consultant. Analyse this land opportunity and provide a complete structured assessment with specific numbers to populate a development appraisal tool.",
        "",
        "SITE: "+addr,
        "POSTCODE: "+pc,
        "CITY/MARKET: "+cityName(lpaCity),
        "LPA: "+lpa2,
        "SITE AREA: "+acres2+" acres / "+(acres2*0.404686).toFixed(2)+" ha",
        "ASKING PRICE: £"+askPrice.toLocaleString(),
        "PLANNING STATUS: "+planStatus2,
        "LANDOWNER TYPE: "+ownerType2,
        "DESCRIPTION: "+description.substring(0,300),
        "",
        "Respond ONLY with a valid JSON object with these exact fields:",
        "{recommendedScheme: sfh/btr/pbsa, recommendedUnits: number, recommendedDph: number, estimatedGdv: number, buildCostPsf: number, salePricePsf: number, exitYieldPct: number, financeRatePct: number, s106PerUnit: number, s106Education: number, s106Highways: number, s106NHS: number, s106BNG: number, s106OpenSpace: number, s106Other: number, ahPct: number, planningRisk: low/medium/high, planningTimeline: string, recommendedBid: number, openingBid: number, maxBid: number, houseTypeMix: [{type, beds, count, sqft, unitPrice}], goNoGo: GO/CAUTION/NO-GO, goNoGoReason: string, topRisks: [string,string,string], marketCommentary: string}",
        "",
        "Base all figures on actual "+cityName(lpaCity)+" market data for 2024/25. S106 should reflect "+lpa2+" LPA. House mix should reflect planning consent likelihood and sales in "+cityName(lpaCity)+"."
      ];
      var prompt=promptParts.join("\n");

      var params=new URLSearchParams({
        action:"ai",stage:"MasterAnalyse",
        user:(user&&user.name)||"",company:(user&&user.company)||"",
        system:"You are a UK residential development consultant and chartered surveyor. Respond ONLY with valid JSON. No explanation, no markdown, no preamble.",
        prompt:prompt.substring(0,3500)
      });

      fetch(WEBHOOK+"?"+params.toString())
      .then(function(res){return res.json();})
      .then(function(d2){
        var text=d2.result||"";
        var clean=text.replace(/```json/g,"").replace(/```/g,"").trim();
        var js=clean.indexOf("{"); var je=clean.lastIndexOf("}");
        if(js>=0&&je>js)clean=clean.substring(js,je+1);
        var ai={};
        try{ai=JSON.parse(clean);}catch(e){
          setData(function(d){return Object.assign({},d,{masterLoading:false,masterReport:"AI analysis failed — please try again."});});
          return;
        }

        // NOW POPULATE ALL STAGES FROM AI RESPONSE
        setData(function(d){
          var updates={masterLoading:false,masterReport:clean};

          // Asset type
          if(ai.recommendedScheme)updates.assetType=ai.recommendedScheme;

          // Land/appraisal
          updates.land=Object.assign({},d.land||{});

          // RLV - sale price psf
          updates.rlv=Object.assign({},d.rlv||{},{
            units:ai.recommendedUnits?String(ai.recommendedUnits):(d.rlv&&d.rlv.units||""),
            salePsf:ai.salePricePsf?String(Math.round(ai.salePricePsf)):(d.rlv&&d.rlv.salePsf||""),
            buildPsf:ai.buildCostPsf?String(Math.round(ai.buildCostPsf)):(d.rlv&&d.rlv.buildPsf||""),
            avgSqft:"950",
          });

          // Planning
          updates.planning=Object.assign({},d.planning||{},{
            lpa:lpa2||(d.planning&&d.planning.lpa||""),
            units:ai.recommendedUnits?String(ai.recommendedUnits):(d.planning&&d.planning.units||""),
            ahPct:ai.ahPct?String(Math.round(ai.ahPct)):(d.planning&&d.planning.ahPct||""),
            status:planStatus2||(d.planning&&d.planning.status||""),
          });

          // SFH house type mix
          if(ai.houseTypeMix&&ai.houseTypeMix.length>0){
            updates.sfh=Object.assign({},d.sfh||{},{
              acres:acres2>0?String(acres2):(d.sfh&&d.sfh.acres||""),
              city:lpaCity||(d.sfh&&d.sfh.city||""),
              dph:ai.recommendedDph?String(Math.round(ai.recommendedDph)):(d.sfh&&d.sfh.dph||"30"),
              buildPsf:ai.buildCostPsf?String(Math.round(ai.buildCostPsf)):(d.sfh&&d.sfh.buildPsf||""),
              basePsf:ai.salePricePsf?String(Math.round(ai.salePricePsf)):(d.sfh&&d.sfh.basePsf||""),
              mix:ai.houseTypeMix.map(function(h){
                return{
                  type:h.type||"House",
                  beds:String(h.beds||3),
                  count:String(h.count||0),
                  sqft:String(h.sqft||900),
                  unitPrice:h.unitPrice?String(Math.round(h.unitPrice)):"",
                  psf:"",tenure:"private",ahPct:"0"
                };
              }),
            });
          }

          // Financial modelling
          var s106tot=ai.s106PerUnit?ai.s106PerUnit*ai.recommendedUnits:0;
          updates.fin=Object.assign({},d.fin||{},{
            units:ai.recommendedUnits?String(ai.recommendedUnits):(d.fin&&d.fin.units||""),
            buildPsf:ai.buildCostPsf?String(Math.round(ai.buildCostPsf)):(d.fin&&d.fin.buildPsf||""),
            salePsf:ai.salePricePsf?String(Math.round(ai.salePricePsf)):(d.fin&&d.fin.salePsf||""),
            exitYield:ai.exitYieldPct?String(ai.exitYieldPct):(d.fin&&d.fin.exitYield||""),
            finRate:ai.financeRatePct?String(ai.financeRatePct):(d.fin&&d.fin.finRate||"7.5"),
            contingency:"5",
            s106pu:ai.s106PerUnit?String(Math.round(ai.s106PerUnit)):(d.fin&&d.fin.s106pu||""),
            // S106 line items
            s106edu:ai.s106Education?String(Math.round(ai.s106Education*(ai.recommendedUnits||1))):"",
            s106highways:ai.s106Highways?String(Math.round(ai.s106Highways*(ai.recommendedUnits||1))):"",
            s106nhsgp:ai.s106NHS?String(Math.round(ai.s106NHS*(ai.recommendedUnits||1)*0.4)):"",
            s106nhshosp:ai.s106NHS?String(Math.round(ai.s106NHS*(ai.recommendedUnits||1)*0.6)):"",
            s106bng:ai.s106BNG?String(Math.round(ai.s106BNG*(ai.recommendedUnits||1))):"",
            s106open:ai.s106OpenSpace?String(Math.round(ai.s106OpenSpace*(ai.recommendedUnits||1))):"",
            s106other:ai.s106Other?String(Math.round(ai.s106Other*(ai.recommendedUnits||1))):"",
            salesRateWeek:"0.75",programmeMths:"36",finRatePa:ai.financeRatePct?String(ai.financeRatePct):"7.5",
          });

          // Land workflow - bidding
          updates.land=Object.assign({},updates.land,{
            recommendedBid:ai.recommendedBid?String(Math.round(ai.recommendedBid)):"",
            openingBid:ai.openingBid?String(Math.round(ai.openingBid)):"",
            maxBid:ai.maxBid?String(Math.round(ai.maxBid)):"",
          });

          // Risk register - add AI identified risks
          if(ai.topRisks&&ai.topRisks.length>0){
            var existingRisks=d.risks||RISK_DEFAULTS.map(function(r){return Object.assign({},r);});
            ai.topRisks.forEach(function(risk,i){
              existingRisks.push({id:"ai_risk_"+i,category:"Planning",risk:risk,rag:"amber",mitigation:"Review with planning consultant"});
            });
            updates.risks=existingRisks;
          }

          return mergeRespectingCompletedStages(d,updates);
        });

        logEvent(user,"MASTER_ANALYSE",{address:addr,scheme:ai.recommendedScheme,units:ai.recommendedUnits,goNoGo:ai.goNoGo});

        // Navigate to dashboard to show updated metrics
        setTimeout(function(){navTo("dashboard");},300);
      })
      .catch(function(){
        setData(function(d){return Object.assign({},d,{masterLoading:false,masterReport:"Connection failed — check internet and try again."});});
      });
    }

    /* renderScraper moved to js/screen-Scraper.js */

  // ── LAND APPRAISAL ─────────────────────────────────────────────────────────
  /* renderLand moved to js/screen-Land.js */

  // ── PLANNING ───────────────────────────────────────────────────────────────
  /* renderPlanning moved to js/screen-Planning.js */

  // ── S106 TABLE COMPONENT ──────────────────────────────────────────────────
  /* S106Table moved to its own file — see js/ (loaded before this script) */

  // ── FINANCIALS ─────────────────────────────────────────────────────────────
  /* renderFin moved to js/screen-Fin.js */

  // ── DUE DILIGENCE ──────────────────────────────────────────────────────────
  /* renderDD moved to js/screen-DueDiligence.js (loaded before this script) */

  // ── RISK REGISTER ──────────────────────────────────────────────────────────
  /* renderRisks moved to js/screen-RiskRegister.js (loaded before this script) */

  // ── EXIT ───────────────────────────────────────────────────────────────────
  /* renderExit moved to js/screen-Exit.js */

  // ── RENDER STAGE ───────────────────────────────────────────────────────────
  function renderStage(){
    if(stage==="portfolio")return renderPortfolio(data, logMigration, navTo, saveDeal, setData, user);
    if(stage==="scorecard")return renderScorecard(city, data, gdv, lc, up, user);
    if(stage==="placona")return renderPlacona();
    if(stage==="navigator")return renderProcessNavigator(ALL_STAGES, data, exitUnlocksStage, exits, isExitOn, isSchemeOn, navTo, schemes, setFlowAssetType, setSchemes, toggleExit, up);
    if(stage==="assetOptimiser")return renderAssetOptimiser(data, up, user);
    if(stage==="investor")return renderInvestorSuite();
    if(stage==="tenure")return renderTenureMix(data, up, user);
    if(stage==="capitalise")return renderCapitalise(LiveMarketBanner, city, data, setData, up, user);
    if(stage==="grants")return renderGrants(city, data, gdv, lc, up, user);
    if(stage==="teaser")return renderTeaser(city, data, gdv, lc, up, user);
    if(stage==="im")return renderIM(at, city, data, gdv, lc, up, user);
    if(stage==="dataroom")return renderDataRoom(city, data, exits, isExitOn, schemes, up);
    if(stage==="viability")return renderViability(city, data, gdv, lc, up, user);
    if(stage==="meetings")return renderMeetings(data, up, user);
    if(stage==="monitor")return renderPlanningMonitor(data, navTo, up, user);
    if(stage==="constraint")return renderConstraintCheck(data, navTo, up, user);
    if(stage==="dashboard")return renderDashboard();
    if(stage==="propagation")return renderPropagationAudit(data, setData, up);
    if(stage==="epeworkflow")return renderEPEWorkflow(at, city, data, mergeRespectingCompletedStages, navTo, setData, stage, up, user);
    if(stage==="landworkflow")return renderLandWorkflow(at, city, data, effUnits, gdv, lc, margin, mergeRespectingCompletedStages, navTo, profit, setData, tc, units, up, user);
    if(stage==="recovery")return renderRecovery(city, data, navTo, up, user);
    if(stage==="summary")return renderSummary();
    if(stage==="flowcharts")return renderFlowcharts(data, navTo, setData, stage);
    if(stage==="epe")return renderEPE(LiveMarketBanner, city, data, m, mergeRespectingCompletedStages, navTo, setData, up, user);
    if(stage==="rlv")return renderRLV(city, data, m, navTo, setData, up, user);
    if(stage==="sfh")return renderSFH(LiveMarketBanner, city, data, navTo, setData, up, user);
    if(stage==="hra")return renderHRA(LiveMarketBanner, city, data, up, user);
    if(stage==="land")return renderLand(LiveMarketBanner, at, city, data, m, mergeRespectingCompletedStages, navTo, setData, up, user);
    if(stage==="planning")return renderPlanning(at, data, navTo, setData, setJourney, units, up, user);
    if(stage==="fin")return renderFin(LiveMarketBanner, at, bc, buildPsf, city, data, ey, gia, gr, lc, m, navTo, units, up, user);
    if(stage==="scraper")return renderScraper(at, data, mergeRespectingCompletedStages, navTo, setData, up, user);
    if(stage==="dd")return renderDD(data, setData, user, up);
    if(stage==="risks")return renderRisks(at, data, setData, up, user);
    if(stage==="exit")return renderExit(at, city, data, ey, gdv, hot, hotL, lc, m, memo, memoL, noi, setData, setHot, setHotL, setMemo, setMemoL, units, up, user);
    return e("div",null,"Coming soon");
  }

  // ── LAYOUT ─────────────────────────────────────────────────────────────────
  var closeMobile=function(){setMobileMenuOpen(false);};
  return e("div",{style:{display:"flex",minHeight:"100vh",overflowX:"hidden"}},
    isMobile&&mobileMenuOpen&&e("div",{onClick:closeMobile,style:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",zIndex:999,touchAction:"none"}}),
    e("aside",{style:{width:240,background:"#1E1F5C",display:"flex",flexDirection:"column",position:"fixed",left:0,top:0,bottom:0,overflowY:"auto",zIndex:1001,transition:"transform .25s cubic-bezier(.4,0,.2,1)",transform:isMobile?(mobileMenuOpen?"translateX(0)":"translateX(-100%)"):"translateX(0)"}},
      e("div",{style:{padding:"14px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"space-between"}},
        e("img",{src:"data:image/webp;base64,"+LOGO,alt:"Cassidy Group",style:{width:120,height:"auto",filter:"drop-shadow(0 1px 4px rgba(0,0,0,0.25))"}})
      ),
      e("div",{style:{padding:"8px 0",flex:1}},
        (function(){
          // Filter stages by selected scheme types (multi-select) AND exit routes (which can unlock additional stages)
          var activeStages=ALL_STAGES.filter(stageVisibleForFlow);

          var groups=[]; var seen={};
          activeStages.forEach(function(s){if(!seen[s.group]){groups.push(s.group);seen[s.group]=true;}});

          return [
            // Multi-select scheme + exit selectors at top of sidebar
            e("div",{key:"journey-selector",style:{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.1)"}},

              // ── SCHEME TYPE ROW ────────────────────────────────────────────
              e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
                e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700}},"Scheme"+(schemes.length>0?" — "+schemes.length:"")),
                schemes.length>0&&e("div",{onClick:function(){setSchemes([]);},style:{fontSize:9,color:"rgba(237,232,74,0.7)",cursor:"pointer",fontWeight:700}},"Clear")
              ),
              e("div",{style:{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}},
                [
                  {key:"land",label:"🔍 Land"},
                  {key:"property",label:"🏠 Property"},
                  {key:"sfh",label:"🏡 SFH"},
                  {key:"btr",label:"🏢 BTR"},
                  {key:"pbsa",label:"🎓 PBSA"},
                  {key:"recovery",label:"⚖ Recovery"}
                ].map(function(j){
                  var on=isSchemeOn(j.key);
                  return e("div",{key:j.key,onClick:function(){toggleScheme(j.key);},
                    style:{padding:"4px 7px",background:on?"#EDE84A":"rgba(255,255,255,0.06)",border:"1px solid "+(on?"#EDE84A":"rgba(255,255,255,0.15)"),borderRadius:4,fontSize:10,fontWeight:on?800:500,color:on?"#1A1B5C":"rgba(255,255,255,0.7)",cursor:"pointer",whiteSpace:"nowrap",transition:"all .12s"}
                  },(on?"✓ ":"")+j.label);
                })
              ),

              // ── EXIT ROUTE ROW ─────────────────────────────────────────────
              e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.07)"}},
                e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700}},"Exit Route"+(exits.length>0?" — "+exits.length:"")),
                exits.length>0&&e("div",{onClick:function(){setExits([]);},style:{fontSize:9,color:"rgba(45,122,101,0.9)",cursor:"pointer",fontWeight:700}},"Clear")
              ),
              e("div",{style:{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}},
                [
                  {key:"pension",label:"💼 Pension Fund"},
                  {key:"sovereign",label:"🌐 Sovereign WF"},
                  {key:"btr_op",label:"🏢 BTR Operator"},
                  {key:"family",label:"👑 Family Office"},
                  {key:"ha_rp",label:"🏛 HA / RP Bulk"},
                  {key:"homes_eng",label:"🇬🇧 Homes England"},
                  {key:"open_mkt",label:"🏠 Open Market"},
                  {key:"bank_takeout",label:"🏦 Bank Take-out"},
                  {key:"land_sale",label:"📜 Land + Planning"}
                ].map(function(j){
                  var on=isExitOn(j.key);
                  return e("div",{key:j.key,onClick:function(){toggleExit(j.key);},
                    style:{padding:"4px 7px",background:on?"#2D7A65":"rgba(255,255,255,0.06)",border:"1px solid "+(on?"#2D7A65":"rgba(255,255,255,0.15)"),borderRadius:4,fontSize:10,fontWeight:on?800:500,color:on?"#fff":"rgba(255,255,255,0.7)",cursor:"pointer",whiteSpace:"nowrap",transition:"all .12s"}
                  },(on?"✓ ":"")+j.label);
                })
              ),
              (schemes.length===0&&exits.length===0)&&e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:6,lineHeight:1.5}},
                "Pick scheme type(s) and exit route(s) above to filter stages. Leave both empty to see everything."
              )
            )
          ].concat(
            groups.map(function(g){
              return e("div",{key:g},
                e("div",{style:{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:".15em",textTransform:"uppercase",padding:"10px 16px 3px",fontWeight:700}},g),
                activeStages.filter(function(s){return s.group===g;}).map(function(s){
                  var active=stage===s.id;
                  // v9.31 — Stage relevance badge (REQUIRED / RECOMMENDED / OPTIONAL / N/A)
                  var rel = getStageRelevance(s.id, data);
                  var complete = isStageComplete(s.id, data);
                  // Visual config per relevance level
                  var relBadge = {
                    required:    {label:"REQ", bg:complete?"rgba(45,122,101,0.85)":"rgba(176,90,53,0.85)", color:"#fff", title:complete?"Required — completed ✓":"Required — not yet filled in"},
                    recommended: {label:"REC", bg:"rgba(154,123,62,0.55)",  color:"rgba(255,255,255,0.95)", title:"Recommended for your journey"},
                    optional:    {label:"",    bg:"transparent",             color:"transparent",            title:"Optional"},
                    na:          {label:"N/A", bg:"rgba(255,255,255,0.06)",  color:"rgba(255,255,255,0.3)",  title:"Not applicable for your journey"}
                  }[rel] || {label:"",bg:"transparent",color:"transparent",title:""};
                  return e("div",{key:s.id,onClick:function(){navTo(s.id);},title:relBadge.title,style:{display:"flex",alignItems:"center",gap:9,padding:"8px 16px",cursor:"pointer",background:active?"rgba(237,232,74,0.12)":"transparent",borderLeft:"3px solid "+(active?"#EDE84A":"transparent"),transition:"all .12s",opacity:rel==="na"?0.55:1}},
                    e("span",{style:{fontSize:10,color:active?"#EDE84A":"rgba(255,255,255,0.3)",width:14}},s.icon),
                    e("span",{style:{fontSize:12,color:active?"#fff":"rgba(255,255,255,0.5)",flex:1}},s.label),
                    // Relevance badge (small pill on the right)
                    relBadge.label && e("span",{style:{fontSize:7,fontWeight:800,padding:"2px 5px",background:relBadge.bg,color:relBadge.color,borderRadius:3,letterSpacing:".05em",lineHeight:1.2,flexShrink:0}},
                      complete&&rel==="required" ? "✓" : relBadge.label
                    )
                  );
                })
              );
            })
          );
        })()
      ),
      e("div",{style:{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.08)",fontSize:11,color:"rgba(255,255,255,0.35)"}},
        (user&&user.name)||"User"," · ",(user&&user.company)||"",
        e("div",{style:{marginTop:6,fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:".06em"}},"Built by Phil Daniel")
      )
    ),
    e("main",{style:{marginLeft:isMobile?0:240,flex:1,display:"flex",flexDirection:"column",minHeight:"100vh",transition:"margin .25s ease",minWidth:0}},
      // Topbar — TWO ZONES per reviewer spec
      //   .lf-topbar-left:    hamburger + title + version (fixed in place)
      //   .lf-topbar-actions: all action buttons (horizontally scrollable on mobile)
      e("div",{className:"lf-topbar",style:{
        height:58,background:"#fff",borderBottom:"1px solid #DDE0ED",
        display:"flex",alignItems:"center",gap:10,
        position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 3px rgba(46,47,138,0.08)",
        padding:"0 16px"
      }},
        // ── LEFT ZONE — locked in place ─────────────────────────────────────
        e("div",{className:"lf-topbar-left"},
          isMobile&&e("button",{
            onClick:function(){setMobileMenuOpen(function(o){return !o;});},
            style:{display:"flex",flexDirection:"column",justifyContent:"center",gap:5,padding:"8px 10px",background:"#F0F1FA",border:"1px solid #DDE0ED",borderRadius:7,cursor:"pointer",flexShrink:0,width:40,height:40}
          },
            e("span",{style:{width:18,height:2,background:"#2E2F8A",display:"block",borderRadius:2}}),
            e("span",{style:{width:18,height:2,background:"#2E2F8A",display:"block",borderRadius:2}}),
            e("span",{style:{width:18,height:2,background:"#2E2F8A",display:"block",borderRadius:2}})
          ),
          e("div",{className:"lf-stage-mobile-title",style:{fontSize:isMobile?14:15,fontWeight:700,color:"#2E2F8A",whiteSpace:"nowrap"}},curStage.label),
          e("button",{
            title:"Click to see what's new in v"+CURRENT_VERSION,
            onClick:function(){
              var msg = "Landform v"+CURRENT_VERSION+"\n\nRecent updates:\n\n";
              VERSION_HISTORY.slice(0,5).forEach(function(v){
                msg += "v"+v.v+" — "+v.headline+(v.affectsCalc?" (calc-affecting)":"")+"\n";
                v.changes.forEach(function(c){msg += "  • "+c+"\n";});
                msg += "\n";
              });
              alert(msg);
            },
            style:{fontSize:10,color:"#9A7B3E",background:"rgba(237,232,74,0.18)",padding:"3px 8px",borderRadius:3,fontWeight:800,letterSpacing:".05em",flexShrink:0,border:"1px solid rgba(154,123,62,0.3)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"v"+CURRENT_VERSION+" ▾"),
          !isMobile&&e("div",{style:{fontSize:11,color:"#7278A0",marginLeft:6}},at.toUpperCase()+" · "+cityName(city))
        ),

        // ── ACTIONS ZONE — horizontally scrollable on mobile ────────────────
        e("div",{className:"lf-topbar-actions"},
          e("label",{
            title:"Upload Relevant Files — Excel, CSV, PDF or text files are analysed and extracted into your deal",
            style:{padding:isMobile?"8px 10px":"6px 14px",background:"#F0F1FA",border:"1px solid #DDE0ED",color:"#2E2F8A",borderRadius:5,fontSize:isMobile?16:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",minHeight:36,display:"inline-flex",alignItems:"center",gap:5,flexShrink:0}
          },
            isMobile?"📎":"📎 Upload Files",
            e("input",{type:"file",accept:".xlsx,.xls,.csv,.txt,.pdf,.doc,.docx,.json",multiple:true,onChange:function(ev){handleFileUpload(ev);},style:{display:"none"}})
          ),
          e("button",{
            onClick:doMasterAnalyse,
            disabled:data.masterLoading,
            title:"Analyse Deal — populate all stages with AI",
            style:{padding:isMobile?"8px 10px":"6px 14px",background:data.masterLoading?"#8889C8":"linear-gradient(135deg,#2D7A65,#4A4BAE)",border:"none",color:"#fff",borderRadius:5,fontSize:isMobile?16:11,fontWeight:800,cursor:data.masterLoading?"not-allowed":"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(74,75,174,0.3)",minHeight:36,flexShrink:0}},
            data.masterLoading?"⏳":(isMobile?"🧠":"🧠 Analyse Deal")
          ),
          e("button",{key:"flow",onClick:function(){
              // Open the Workflow Atlas in a new window, pre-filtered to current scheme + exit
              var params = [];
              if(schemes.length>0) params.push("schemes="+schemes.join(","));
              if(exits.length>0) params.push("exits="+exits.join(","));
              var url = "flowchart.html" + (params.length>0 ? "?"+params.join("&") : "");
              window.open(url,"landform_atlas","width=1600,height=1000,scrollbars=yes,resizable=yes");
            },title:"Open Workflow Atlas in new window — move to a second monitor",
            style:{padding:isMobile?"8px 10px":"6px 12px",background:"#4A4BAE",border:"1px solid #4A4BAE",color:"#fff",borderRadius:5,fontSize:isMobile?16:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",minHeight:36,flexShrink:0}},
            isMobile?"🗺":"🗺 Flowchart ↗"
          ),
          e("button",{key:"hist",onClick:function(){setShowHist(function(s){return !s;});},title:"History",
            style:{padding:isMobile?"8px 10px":"6px 12px",background:showHist?"#4A4BAE":"#F7F8FC",border:"1px solid "+(showHist?"#4A4BAE":"#DDE0ED"),color:showHist?"#fff":"#3A3D6A",borderRadius:5,fontSize:isMobile?16:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",minHeight:36,flexShrink:0}},
            isMobile?("📋"+(history.length>0?" "+history.length:"")):"📋 History"+(history.length>0?" ("+history.length+")":"")
          ),
          e("button",{key:"rep",onClick:generateReport,title:"Print / PDF Report",
            style:{padding:isMobile?"8px 10px":"6px 12px",background:"#F7F8FC",border:"1px solid #DDE0ED",color:"#B05A35",borderRadius:5,fontSize:isMobile?16:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",minHeight:36,flexShrink:0}},
            isMobile?"🖨":"🖨 Report"
          ),
          e("button",{key:"save",
            onClick: data._userRole==="viewer" ? function(){
              alert("You have view-only access to this deal.\n\nTo edit, ask the deal owner ("+(data._dealCreator||"the creator")+") to add you to the editors list in the Access sheet.");
            } : saveDeal,
            title: data._userRole==="viewer" ? "View-only — contact owner to be added as editor" : "Save Deal — updates the current deal in place",
            style:{padding:isMobile?"8px 10px":"6px 12px",background:data._userRole==="viewer"?"#F4F5FB":"#F7F8FC",border:"1px solid "+(data._userRole==="viewer"?"#E0C5A0":"#DDE0ED"),color:data._userRole==="viewer"?"#9A7B3E":"#3A3D6A",borderRadius:5,fontSize:isMobile?16:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",minHeight:36,flexShrink:0,opacity:data._userRole==="viewer"?0.7:1}},
            data._userRole==="viewer" ? (isMobile?"🔒":"🔒 View only") : (isMobile?"💾":"💾 Save Deal")
          ),
          // Save As — creates a duplicate with a new name (e.g. for testing different schemes on same site)
          e("button",{key:"saveas",onClick:saveDealAs,title:"Save as new deal — duplicates current deal under a new name (e.g. test SFH vs PBSA on same site)",
            style:{padding:isMobile?"8px 10px":"6px 12px",background:"#F4F5FB",border:"1px solid #C5C8E0",color:"#4A4BAE",borderRadius:5,fontSize:isMobile?14:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",minHeight:36,flexShrink:0}},
            isMobile?"🔀":"🔀 Save As"
          ),
          // v9.22 — Export deal to JSON file (for moving between accounts / sharing with team)
          e("button",{key:"export",onClick:exportDeal,title:"Export this deal as a JSON file — download to share with a teammate or transfer to another Landform account",
            style:{padding:isMobile?"8px 10px":"6px 12px",background:"#F4F5FB",border:"1px solid #C5C8E0",color:"#2D7A65",borderRadius:5,fontSize:isMobile?14:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",minHeight:36,flexShrink:0}},
            isMobile?"⬇":"⬇ Export"
          ),
          // v9.22 — Import deal from JSON file (from another account / teammate)
          e("button",{key:"import",onClick:importDeal,title:"Import a deal from a JSON file — load a deal exported from another Landform account",
            style:{padding:isMobile?"8px 10px":"6px 12px",background:"#F4F5FB",border:"1px solid #C5C8E0",color:"#2D7A65",borderRadius:5,fontSize:isMobile?14:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",minHeight:36,flexShrink:0}},
            isMobile?"⬆":"⬆ Import"
          ),
          e("button",{key:"new",onClick:clearDeal,title:"New Deal — clears current data",
            style:{padding:isMobile?"8px 10px":"6px 12px",background:"#FFF5F0",border:"1px solid #E8C4B0",color:"#B05A35",borderRadius:5,fontSize:isMobile?16:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",minHeight:36,flexShrink:0}},
            isMobile?"✕":"✕ New Deal"
          ),
          e("button",{key:"logout",onClick:function(){
            if(window.confirm("Sign out of Landform?\n\nYour current deal stays saved on this device. Cloud-synced deals will remain in your portfolio.")) onLogout();
          },title:"Sign out — "+(user.email||user.name||""),
            style:{padding:isMobile?"8px 10px":"6px 12px",background:"#F4F5FB",border:"1px solid #DDE0ED",color:"#7278A0",borderRadius:5,fontSize:isMobile?16:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",minHeight:36,flexShrink:0}},
            isMobile?"👤":"👤 "+((user.name||"").split(" ")[0]||"User")+" ▾"
          )
        )
      ),
      e("div",{style:{height:3,background:"#DDE0ED"}},
        e("div",{style:{height:"100%",width:((idx+1)/ALL_STAGES.length*100)+"%",background:"linear-gradient(90deg,#4A4BAE,#EDE84A)",transition:"width .4s"}})
      ),
      showHist&&e("div",{style:{position:"fixed",top:58,right:0,width:380,bottom:0,background:"#fff",borderLeft:"1px solid #DDE0ED",boxShadow:"-4px 0 16px rgba(0,0,0,0.08)",zIndex:200,display:"flex",flexDirection:"column",overflowY:"auto"}},
        e("div",{style:{padding:"16px 20px",borderBottom:"1px solid #DDE0ED",display:"flex",justifyContent:"space-between",alignItems:"center"}},
          e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A"}},"Deal History"),
          e("button",{onClick:function(){setShowHist(false);},style:{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#7278A0"}}, "×")
        ),
        history.length===0?e("div",{style:{padding:"32px 20px",textAlign:"center",color:"#7278A0",fontSize:13}},
          e("div",{style:{fontSize:24,marginBottom:8}},"📋"),
          "No saved deals yet.",
          e("br"),
          "Click 💾 Save Deal to save your current work."
        ):e("div",{style:{padding:"12px"}},
          history.map(function(snap){
            return e("div",{key:snap.id,style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,padding:"14px 16px",marginBottom:8}},
              e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A",marginBottom:4}},snap.name),
              e("div",{style:{display:"flex",gap:10,fontSize:10,color:"#7278A0",marginBottom:10,flexWrap:"wrap"}},
                e("span",null,snap.assetType.toUpperCase()),
                snap.city&&snap.city!=="—"&&e("span",null,"· "+cityName(snap.city)),
                snap.acres&&e("span",null,"· "+snap.acres+" acres"),
                snap.price&&e("span",null,"· £"+Number(snap.price).toLocaleString()),
                e("span",null,"· "+snap.savedAt)
              ),
              e("div",{style:{display:"flex",gap:8}},
                e("button",{onClick:function(){loadDeal(snap);},style:{flex:1,padding:"7px",background:"#4A4BAE",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
                  "Load →"
                ),
                e("button",{onClick:function(){setHistory(function(h){return h.filter(function(d){return d.id!==snap.id;});});},style:{padding:"7px 10px",background:"transparent",border:"1px solid #DDE0ED",color:"#B05A35",borderRadius:5,fontSize:11,cursor:"pointer"}},
                  "✕"
                )
              )
            );
          })
        )
      ),
      e("div",{style:{flex:1,padding:"28px 32px",maxWidth:1000,width:"100%"}},renderStage()),
      e("div",{style:{padding:"16px 32px",borderTop:"1px solid #DDE0ED",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff"}},
        e("button",{disabled:filteredIdx<=0,onClick:function(){
          if(filteredIdx>0) navTo(navFilteredStages[filteredIdx-1].id);
        },style:{padding:"8px 18px",border:"1px solid #DDE0ED",background:"transparent",color:"#7278A0",borderRadius:6,fontSize:12,fontWeight:700,cursor:filteredIdx<=0?"not-allowed":"pointer",fontFamily:"DM Sans,sans-serif",opacity:filteredIdx<=0?0.3:1}},"← Previous"),
        e("span",{style:{fontSize:11,color:"#7278A0"}},
          filteredIdx>=0 ? ((filteredIdx+1)+" of "+navFilteredStages.length) : "—"
        ),
        e("button",{disabled:filteredIdx<0||filteredIdx>=navFilteredStages.length-1,onClick:function(){
          if(filteredIdx>=0 && filteredIdx<navFilteredStages.length-1) navTo(navFilteredStages[filteredIdx+1].id);
        },style:{padding:"8px 18px",background:"#4A4BAE",border:"none",color:"#fff",borderRadius:6,fontSize:12,fontWeight:700,cursor:(filteredIdx<0||filteredIdx>=navFilteredStages.length-1)?"not-allowed":"pointer",fontFamily:"DM Sans,sans-serif",opacity:(filteredIdx<0||filteredIdx>=navFilteredStages.length-1)?0.3:1}},"Next →")
      )
    )
    ,
    // ── FILE UPLOAD RESULTS MODAL ────────────────────────────────────────
    (showFileUpload||fileProcessing)&&e("div",{style:{position:"fixed",inset:0,background:"rgba(15,15,30,0.65)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}},
      e("div",{style:{background:"#fff",borderRadius:14,width:"100%",maxWidth:760,maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 30px 60px rgba(15,15,30,0.3)"}},
        e("div",{style:{padding:"18px 24px",borderBottom:"1px solid #DDE0ED",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}},
          e("div",null,
            e("div",{style:{fontSize:16,fontWeight:800,color:"#2E2F8A"}},"📎 Uploaded Files — AI Extraction"),
            e("div",{style:{fontSize:11,color:"#7278A0",marginTop:2}},"Relevant data extracted from your files. Review and apply to your deal stages.")
          ),
          e("button",{onClick:function(){setShowFileUpload(false);},style:{padding:"6px 14px",background:"#F0F1FA",border:"1px solid #DDE0ED",borderRadius:6,fontSize:12,fontWeight:700,color:"#2E2F8A",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Close")
        ),
        e("div",{style:{overflowY:"auto",flex:1,padding:24}},
          fileProcessing&&e("div",{style:{textAlign:"center",padding:"40px 20px"}},
            e("div",{style:{fontSize:40,marginBottom:12}},"⏳"),
            e("div",{style:{fontSize:15,fontWeight:700,color:"#2E2F8A",marginBottom:8}},"Analysing your files..."),
            e("div",{style:{fontSize:12,color:"#7278A0",lineHeight:1.8}},"Extracting land data, financials, unit mix, contacts and programme details")
          ),
          !fileProcessing&&fileResults.map(function(fr,fi){
            var sections=fr.result?fr.result.split("## ").filter(function(s){return s.trim().length>0;}):[fr.result];
            return e("div",{key:fi,style:{marginBottom:20,border:"1px solid #DDE0ED",borderRadius:10,overflow:"hidden"}},
              e("div",{style:{background:"#F7F8FC",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #DDE0ED"}},
                e("div",{style:{display:"flex",alignItems:"center",gap:10}},
                  e("span",{style:{fontSize:22}},(fr.ext==="xlsx"||fr.ext==="xls")?"📊":(fr.ext==="csv"?"📋":(fr.ext==="pdf"?"📄":"📝"))),
                  e("div",null,
                    e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A"}},fr.name),
                    e("div",{style:{fontSize:10,color:"#7278A0"}},Math.round((fr.size||0)/1024)+"kb · "+(fr.ext||"").toUpperCase()+" file")
                  )
                ),
                e("span",{style:{fontSize:10,padding:"3px 8px",background:"rgba(45,122,101,0.1)",color:"#2D7A65",borderRadius:10,fontWeight:700}},"✓ Extracted")
              ),
              e("div",{style:{padding:"14px 16px"}},
                sections.map(function(sec,si){
                  var lines=sec.trim().split("\n");
                  var title=lines[0]?lines[0].trim():"";
                  var body=lines.slice(1).join("\n").trim();
                  var isEmpty=!body||body.toLowerCase().indexOf("none found")>=0;
                  if(isEmpty)return null;
                  return e("div",{key:si,style:{marginBottom:12}},
                    title&&e("div",{style:{fontSize:10,fontWeight:800,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}},title),
                    e("div",{style:{fontSize:12,color:"#3A3D6A",lineHeight:1.8,whiteSpace:"pre-wrap",background:"#F7F8FC",borderRadius:6,padding:"8px 12px"}},body)
                  );
                }).filter(Boolean)
              ),
              e("div",{style:{padding:"10px 16px",borderTop:"1px solid #DDE0ED",background:"#F7F8FC",display:"flex",gap:8,alignItems:"center"}},
                e("button",{
                  onClick:function(){
                    var existing=(data.meetings&&data.meetings.transcripts)||[];
                    var newT={id:"file-"+Date.now(),name:fr.name,filename:fr.name,date:new Date().toLocaleDateString("en-GB"),uploadedAt:Date.now(),text:fr.result,analysis:fr.result,actionItems:[],keyDecisions:[],siteRefs:[],attendees:[],tags:[],dealRef:(data.land&&data.land.address)||"",summary:"Data extracted from uploaded file: "+fr.name};
                    up("meetings","transcripts",existing.concat([newT]));
                    alert("Saved to Meeting Transcripts — review there and copy figures into the relevant deal stages.");
                  },
                  style:{padding:"6px 14px",background:"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
                },"💾 Save to Records"),
                e("span",{style:{fontSize:10,color:"#7278A0"}},"Review the extracted data and enter figures into the relevant deal stages")
              )
            );
          }),
          !fileProcessing&&(data.uploadedFiles&&data.uploadedFiles.files&&data.uploadedFiles.files.length>0)&&e("div",{style:{marginTop:16,paddingTop:16,borderTop:"2px dashed #DDE0ED"}},
            e("div",{style:{fontSize:10,fontWeight:800,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}},"Previously uploaded in this deal"),
            (data.uploadedFiles.files||[]).slice().reverse().map(function(f,fi2){
              return e("div",{key:fi2,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"#F7F8FC",borderRadius:6,marginBottom:6,fontSize:12}},
                e("span",{style:{color:"#2E2F8A",fontWeight:600}},f.name),
                e("span",{style:{color:"#7278A0",fontSize:10}},new Date(f.uploadedAt).toLocaleDateString("en-GB"))
              );
            })
          )
        )
      )
    )
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
