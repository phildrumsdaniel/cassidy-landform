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
  {id:"keystone",        label:"Keystone — Deal Builder", icon:"🪨", group:"0. Start", journeys:["all","land","property","sfh","btr","pbsa","recovery","asset"]},
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
  {id:"proposal",    label:"Board Proposal",       icon:"📋", group:"5. Report",   journeys:["land","sfh","btr","pbsa","property","recovery","all"]},
  // ── 6. RECORDS ───────────────────────────────────────────────────────────
  {id:"meetings",    label:"Meeting Transcripts",  icon:"📝", group:"6. Records",  journeys:["all"]},
  {id:"portfolio",   label:"Deal Portfolio",       icon:"📊", group:"6. Records",  journeys:["all"]},
  {id:"dashboard",   label:"Deal Dashboard",       icon:"◈",  group:"6. Records",  journeys:["land","sfh","btr","pbsa","property","recovery","all"]},
  // ── 7. AUDIT ─────────────────────────────────────────────────────────────
  {id:"propagation", label:"Propagation Audit",    icon:"🔬", group:"7. Audit",    journeys:["all"]},
  {id:"buildcosts",  label:"Build Cost Library",   icon:"🧱", group:"7. Audit",    journeys:["all"]},
];

// ──────────────────────────────────────────────────────────────────────
// STAGE RELEVANCE (v9.31)
// For a given deal context (asset type + active exit routes + planning state),
// classify each stage as REQUIRED / RECOMMENDED / OPTIONAL / N_A.
// Drives the sidebar badges and dashboard "what's incomplete" checklist.
// ──────────────────────────────────────────────────────────────────────
var STAGE_RELEVANCE = {
  // Always required regardless of journey
  keystone:     {required:[],                        recommended:["all"]},
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
  propagation:  {required:[],                        recommended:[]},
  buildcosts:   {required:[],                        recommended:[]}
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
    if(flowSchemes.length===0&&exits.length===0)return s.id==="keystone" || s.id==="navigator" || s.id==="portfolio" || s.id==="dashboard";
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

  // F6 — shared assumptions: editing any of these in one stage propagates to the
  // sibling stages that also use it (see applySharedInput in 01-config.js, which
  // is unit-tested). Enter it once and the whole tool follows.
  function up(section,key,val){
    setData(function(d){ return applySharedInput(d, section, key, val, stage, isStageId); });
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
    var bPsf=num(data.sfh&&data.sfh.basePsf)||num(estSalePsfFromRent(m.btr))||260;
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
    // v9.98 — Completion is now PURELY data-driven: a stage counts as complete only when
    // isStageComplete finds the real data it needs. We no longer auto-mark a stage
    // "complete" just because you navigated away from it — that let stages (Due Diligence,
    // Exit, etc.) drop off the "still need to fill" list on a mere visit, so green ticks
    // couldn't be trusted. (This was the only writer of _completedStages.)
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
          notify("✓ Deal saved: "+name+"\n\nSynced to cloud — visible on all your devices."+sizeNote);
        } else {
          notify("✓ Deal saved locally: "+name+"\n\n⚠ Cloud sync failed: "+((d&&d.message)||"unknown error")+"\nDeal is still safe on this device.");
        }
      })
      .catch(function(err){
        notify("✓ Deal saved locally: "+name+"\n\n⚠ Cloud sync failed (offline?)\nDeal is still safe on this device.");
      });
    } else {
      notify("✓ Deal saved locally: "+name+"\n\nYour data auto-saves continuously.");
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
      notify("⚠ You need to be signed in to save as a new deal.\nThis ensures the original isn't overwritten.");
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
        notify("✓ New deal created: "+newName+"\n\n"+
          "• Original deal preserved (return via Portfolio if needed)\n"+
          "• You're now working in the new copy — changes save to this one\n"+
          "• Change scheme type, scenario, or any input to remodel"
        );
      } else {
        notify("⚠ Couldn't create the new copy: "+((d&&d.message)||"unknown error")+"\n\nYour original deal is unaffected.");
      }
    })
    .catch(function(err){
      notify("⚠ Network error creating new copy. Original deal is unaffected. Try again when online.");
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
      notify("No deal data to export. Open or create a deal first.");
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
            // v10.14 — non-blocking: warn but proceed (the user explicitly chose this file). Nothing is
            // saved to the portfolio until "Save Deal", so a bad import is easily discarded.
            notify("Heads up: this file doesn't look like a standard Landform export — importing anyway. Review before saving.");
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
          notify("✓ Deal imported. Click 'Save Deal' to add it to your portfolio.");
          try{ logEvent(user,"DEAL_IMPORTED",{dealName:finalName,fromAccount:imported._importedFromAccount}); }catch(e){}
        }catch(err){
          notify("⚠ Could not import file: "+(err.message||err)+"\n\nMake sure the file is a valid Landform export JSON.");
        }
      };
      reader.readAsText(file);
    };
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  }

  function clearDeal(){
    // v10.14 — non-blocking confirm (native confirm() froze the browser). Wipes the open deal, so keep a guard.
    confirmToast("Clear all fields and start a new deal?\n\nYour saved portfolio deals are untouched.", function(){
      setData({risks:RISK_DEFAULTS.map(function(r){return Object.assign({},r);})});
      setSchemes([]); setExits([]);
      setHot("");setMemo("");setStage("dashboard");
    }, {confirmLabel:"New deal"});
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
    '<img class="cover-logo" src="data:image/png;base64,'+LOGO+'" alt="Cassidy Group"/>'+
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
    if(!w){notify("Please allow popups for this site to generate the report.");return;}
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
      {label:"Planning & Viability",done:!!(p.lpa&&p.units)||(typeof assumePlanningConsented==="function"&&assumePlanningConsented(data)),key:"planning"},
      {label:"Financial Modelling",done:!!(f.exitYield||f.buildPsf),key:"fin"},
      {label:"Due Diligence",done:Object.keys(data.ddChecked||{}).filter(function(k){return data.ddChecked[k];}).length>5||(typeof assumeDDComplete==="function"&&assumeDDComplete(data)),key:"dd"},
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

      // v9.47 — Ground the exec summary in the SAME unified engine every other
      // screen uses (calcDealMetrics), so the headline numbers add up, and route
      // it through buildHonestPrompt so persona/tone/'make-it-stack' rules apply.
      var DMx = (typeof calcDealMetrics==="function") ? calcDealMetrics(data) : {};
      var extra = "Write a friendly EXECUTIVE SUMMARY that a complete beginner could follow.\n\n"+
        "ADDITIONAL DEAL CONTEXT (facts — use alongside the verified deal state above):\n"+
        "- Address: "+(addr||"not provided")+", "+cityName(lCity2)+" "+(pc||"")+"\n"+
        "- Asset type / journey: "+assetLabel+" / "+journeyLabel+"\n"+
        "- Planning: "+planStatus2+(lpa2?", LPA "+lpa2:"")+"\n"+
        "- Exit strategy: "+(ex.strategy||"not set")+(num(ey)?", target yield "+pct(ey*100):"")+"\n"+
        "- Risks logged: "+(data.risks||[]).length+" ("+((data.risks||[]).filter(function(r2){return r2.rag==="red";}).length)+" red)\n"+
        "- Due-diligence items ticked: "+(Object.keys(data.ddChecked||{}).filter(function(k){return data.ddChecked[k];}).length)+"\n"+
        "- Data completeness: "+completionPct+"%\n"+
        ((data.scraper&&data.scraper.result&&data.scraper.result.agent)?("- Listing agent: "+data.scraper.result.agent+"\n"):"")+
        "\nFORMAT — use light Markdown so it presents cleanly to stakeholders: each section title as a '## Heading', **bold** for the headline money figures, and '- ' bullet points for lists (risks, next steps). No code blocks, tables optional. Open each section with ONE plain-English sentence a non-expert grasps instantly.\n"+
        // v10.8 — the backend caps AI response length, so an over-long summary was being cut
        // off mid-section. Keep the WHOLE thing tight so it always completes end-to-end.
        "LENGTH — keep the ENTIRE summary under ~650 words. Be concise: 2-4 short sentences (or 3-4 bullets) per section. It is more important to finish all 10 sections than to elaborate — do NOT run long.\n"+
        "## 1. The Deal in a Nutshell\n"+
        "## 2. The Site & Location\n"+
        "## 3. What We'd Build\n"+
        "## 4. The Money — in pounds and plain words: what it sells for, what it costs to build, what's left to pay for the land and profit\n"+
        "## 5. Planning Position\n"+
        "## 6. How We Get Our Money Back (the exit)\n"+
        "## 7. The Main Risks — and how to handle each (use bullets)\n"+
        "## 8. Does It Stack Up? — say plainly yes / no / marginal. If it does NOT, follow rule 6: design a concrete alternative scheme that WOULD work, list the levers you changed, and give the rough resulting numbers, clearly labelled as YOUR proposed scenario to test in Landform.\n"+
        "## 9. Next Steps — the 3-5 most important things to do next (use bullets)\n"+
        "## 10. Deal Rating out of 10, with a one-line reason.\n";
      // v10.5 — Assumption Mode: tell the AI which positions to PRESENT as satisfied,
      // while being explicit that these are illustrative assumptions, not achieved fact.
      if(typeof assumeAny==="function" && assumeAny(data)){
        var _af2=assumeFlags(data); var _assumeList=[];
        if(_af2.planning) _assumeList.push("planning consent is GRANTED");
        if(_af2.dd) _assumeList.push("all due diligence is complete and satisfactory");
        if(_af2.constraints) _assumeList.push("site constraints are resolved/cleared");
        if(_af2.risks) _assumeList.push("all logged risks are mitigated");
        extra += "\n\nPRESENTATION ASSUMPTIONS (illustrative — the user is modelling an 'if it all lands' scenario for stakeholders): write the summary AS IF "+_assumeList.join("; ")+". State ONCE near the top that these are working assumptions for illustration, not the achieved position, then proceed confidently on that basis.\n";
      }
      var prompt = (typeof buildHonestPrompt==="function") ? buildHonestPrompt(data, extra) : extra;

      // v10.4 — the Executive Summary was the ONE AI feature still POSTing its
      // ~8000-char prompt via a GET query string (fetch(WEBHOOK+"?"+params)). A URL
      // that long overruns proxy/gateway URL-length limits, so the request hung and
      // was killed ~38s later → "Connection failed". Every other AI panel goes through
      // callAI, which was deliberately switched to POST ("avoids URL length limits")
      // and also sends WEBHOOK_TOKEN. Route through callAI so the summary uses the same
      // reliable transport, and retry once to ride out an Apps Script cold-start.
      var sys="You are the UK's best property developer, advising Cassidy Group Ltd. Write in warm, plain, layman's terms a non-expert understands. UK conventions. Use light Markdown for structure: '## ' section headings, **bold** for headline numbers, '- ' bullets for lists. No code blocks or images.";
      function failed(t){ return !t || String(t).indexOf("Analysis failed")===0 || String(t).indexOf("Connection failed")===0; }
      function attempt(triesLeft){
        return callAI(user,"Executive Summary",sys,prompt).then(function(text){
          if(failed(text) && triesLeft>0){
            return new Promise(function(res){ setTimeout(res,2500); }).then(function(){ return attempt(triesLeft-1); });
          }
          return text;
        });
      }
      attempt(1).then(function(text){
        var t=failed(text)?"Couldn't generate the summary — the AI service didn't respond. Please wait a moment and try again.":text;
        setData(function(d){return Object.assign({},d,{sumLoading:false,sumReport:t});});
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

      // Combined land value reconciliation (sale vs rental)
      LandReconciliationPanel(data, up),

      // v10.5 — Assumption Mode entry point (present as consented/DD-clear for stakeholders)
      (typeof AssumptionModeCard==="function")&&AssumptionModeCard(data, up),

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
                notify("✓ Copied to clipboard — paste into Word or email");
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
          (typeof assumeAny==="function"&&assumeAny(data))&&e("div",{style:{marginBottom:16,padding:"8px 14px",background:"rgba(154,123,62,0.1)",border:"1px solid rgba(154,123,62,0.4)",borderRadius:6,fontSize:11,fontWeight:700,color:"#9A7B3E",letterSpacing:".02em"}},
            "🎭 "+assumptionWatermark(data)),
          (typeof renderMarkdownReport==="function")
            ? renderMarkdownReport(sumReport,{serif:true,fontSize:13.5})
            : e("pre",{style:{fontSize:13,lineHeight:2.1,color:"#2E2F8A",whiteSpace:"pre-wrap",fontFamily:"Georgia, 'Times New Roman', serif"}},sumReport),
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

      // v10.7 — stash the raw Placona site so "Reset to raw import" can start a
      // completely fresh Keystone run from source, discarding all derived work.
      up("_raw","placonaSite", site);

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
      if(!(data.fin&&data.fin.feesPct)) up("fin","feesPct",12);  // default only — don't clobber a value you've set
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

  /* renderPlacona moved to js/screen-Placona.js */


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
  /* renderInvestorSuite moved to js/screen-InvestorSuite.js */

  // ── Media library sub-render (used by Investor Suite) ──
  /* renderInvestorMedia moved to js/screen-InvestorMedia.js */

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

  /* renderDashboard moved to js/screen-Dashboard.js */

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
        notify("Please import a land listing first using Land Finder.");
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
    if(stage==="placona")return renderPlacona(data, loadSiteIntoDeal, up, user, navTo);
    if(stage==="keystone")return renderKeystone(data, setData, up, navTo, user);
    if(stage==="navigator")return renderProcessNavigator(ALL_STAGES, data, exitUnlocksStage, exits, isExitOn, isSchemeOn, navTo, schemes, setFlowAssetType, setSchemes, toggleExit, up);
    if(stage==="assetOptimiser")return renderAssetOptimiser(data, up, user);
    if(stage==="investor")return renderInvestorSuite(data, navTo, saveDeal, up, user);
    if(stage==="tenure")return renderTenureMix(data, up, user);
    if(stage==="capitalise")return renderCapitalise(LiveMarketBanner, city, data, setData, up, user);
    if(stage==="grants")return renderGrants(city, data, gdv, lc, up, user);
    if(stage==="teaser")return renderTeaser(city, data, gdv, lc, up, user);
    if(stage==="proposal")return renderProposal(city, data, gdv, lc, up, user);
    if(stage==="im")return renderIM(at, city, data, gdv, lc, up, user);
    if(stage==="dataroom")return renderDataRoom(city, data, exits, isExitOn, schemes, up);
    if(stage==="viability")return renderViability(city, data, gdv, lc, up, user);
    if(stage==="meetings")return renderMeetings(data, up, user);
    if(stage==="monitor")return renderPlanningMonitor(data, navTo, up, user);
    if(stage==="constraint")return renderConstraintCheck(data, navTo, up, user);
    if(stage==="dashboard")return renderDashboard(ALL_STAGES, JOURNEYS, at, city, data, effUnits, ey, gdv, getStageRelevance, isSFHdash, journey, loadSiteIntoDeal, margin, navTo, noi, profit, scM, setData, setJourney, stage, tc, up, user);
    if(stage==="propagation")return renderPropagationAudit(data, setData, up);
    if(stage==="buildcosts")return renderBuildCosts(data, setData, user);
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
      e("div",{style:{padding:"14px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.1)"}},
        // v10.21 — use the real Cassidy Group Ltd brand logo (same as the login page,
        // BRAND_LOGO_PNG), on a white chip so the correct logo reads on the dark navy sidebar.
        e("div",{style:{background:"#fff",borderRadius:8,padding:"9px 12px",display:"flex",alignItems:"center",justifyContent:"center"}},
          e("img",{src:"data:image/png;base64,"+BRAND_LOGO_PNG,alt:"Cassidy Group",style:{width:"100%",maxWidth:172,height:"auto",display:"block"}})
        )
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
              notify(msg);
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
              notify("You have view-only access to this deal.\n\nTo edit, ask the deal owner ("+(data._dealCreator||"the creator")+") to add you to the editors list in the Access sheet.");
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
            // v10.14 — non-blocking confirm (native confirm() froze the browser).
            confirmToast("Sign out of Landform?\n\nYour current deal stays saved on this device. Cloud-synced deals remain in your portfolio.", function(){ onLogout(); }, {confirmLabel:"Sign out"});
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
      e("div",{style:{flex:1,padding:"28px 32px",maxWidth:1000,width:"100%"}},
        (typeof AssumptionBanner==="function")&&AssumptionBanner(data, up),
        renderStage()
      ),
      // Journey Prev/Next only on the linear appraisal stages — hide it on the
      // Records/Audit pages (Portfolio, Dashboard, Meetings, Build Cost Library…)
      // where it would otherwise mis-route to the adjacent stage.
      (!/^[67]\./.test((curStage&&curStage.group)||"")) && e("div",{style:{padding:"16px 32px",borderTop:"1px solid #DDE0ED",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff"}},
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
                    notify("Saved to Meeting Transcripts — review there and copy figures into the relevant deal stages.");
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
