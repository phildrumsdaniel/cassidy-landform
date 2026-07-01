// ── renderLand  (params: LiveMarketBanner, at, city, data, m, mergeRespectingCompletedStages, navTo, setData, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderLand(LiveMarketBanner, at, city, data, m, mergeRespectingCompletedStages, navTo, setData, up, user){
    var l=data.land||{};
    var sc3=data.scraper&&data.scraper.result||{};
    // v9.37 — Reverted the v9.35 useEffect because hooks can't live inside conditionally-rendered
    // render functions (renderLand is only called when stage==="land"), which blanked the page.
    // Back to direct setData calls — but with a "scraper imported" timestamp guard so the auto-fill
    // only fires ONCE per scraper result (won't re-populate fields the user has cleared).
    if(sc3 && sc3._fetchedAt && data._landScraperImportedFor !== sc3._fetchedAt){
      var updates = {};
      var landUpd = {};
      if(!l.address && sc3.address) landUpd.address = sc3.address;
      if(!l.acres && sc3.acreage) landUpd.acres = sc3.acreage+"";
      if(!l.price && sc3.askingPrice) landUpd.price = sc3.askingPrice+"";
      if(!l.localAuthority && sc3.localAuthority) landUpd.localAuthority = sc3.localAuthority;
      if(!l.city && sc3.city){
        landUpd.city = (sc3.city||"").toLowerCase().replace(/\s+/g,"_").replace(/-/g,"_");
      }
      if(Object.keys(landUpd).length > 0){
        // Defer so we don't setData inside render
        setTimeout(function(){
          setData(function(prev){
            return Object.assign({},prev,{
              land:Object.assign({},prev.land||{},landUpd),
              _landScraperImportedFor: sc3._fetchedAt
            });
          });
        }, 0);
      } else {
        // No fields to update but still mark as imported
        setTimeout(function(){
          setData(function(prev){
            return Object.assign({},prev,{_landScraperImportedFor: sc3._fetchedAt});
          });
        }, 0);
      }
    } else if(sc3 && !sc3._fetchedAt) {
      // Legacy fallback for scraper results without timestamp — preserve old behaviour
      // but with one-render-only guard via a flag check
      var legacyFlag = "_landScrap_"+(sc3.address||"")+"_"+(sc3.acreage||"");
      if(data[legacyFlag] !== true){
        var lu = {};
        if(!l.address && sc3.address) lu.address = sc3.address;
        if(!l.acres && sc3.acreage) lu.acres = sc3.acreage+"";
        if(!l.price && sc3.askingPrice) lu.price = sc3.askingPrice+"";
        if(!l.localAuthority && sc3.localAuthority) lu.localAuthority = sc3.localAuthority;
        if(!l.city && sc3.city){
          lu.city = (sc3.city||"").toLowerCase().replace(/\s+/g,"_").replace(/-/g,"_");
        }
        if(Object.keys(lu).length > 0){
          setTimeout(function(){
            setData(function(prev){
              var update = {land:Object.assign({},prev.land||{},lu)};
              update[legacyFlag] = true;
              return Object.assign({},prev,update);
            });
          }, 0);
        }
      }
    }
    var score=0;
    var vm={proximity:{excellent:25,good:15,fair:8,poor:0},transport:{excellent:20,good:12,fair:6,poor:0},contamination:{clean:20,minor:10,major:0,unknown:4},tenure:{freehold:15,long_leasehold:10,short_leasehold:3},constraint:{none:20,minor:12,moderate:6,major:0}};
    Object.keys(vm).forEach(function(k){score+=(vm[k][l[k]]||0);});
    var sc=score>=70?"#2D7A65":score>=45?"#9A7B3E":"#B05A35";
    var askingPrice=num(l.price);
    var acresVal = num(l.acres);
    var benchmarkIsFallback = !MKT[city];  // true if we fell back to manchester default

    function updateLandWorkingScheme(key, value){
      setData(function(prev){
        prev = prev || {};
        var oldLand = prev.land || {};
        var oldValue = oldLand[key];
        var completed = prev._completedStages || {};
        var next = Object.assign({}, prev);
        next.land = Object.assign({}, oldLand);
        next.land[key] = value;

        function canCarry(section, field){
          if(completed[section]) return false;
          var sec = prev[section] || {};
          var cur = sec[field];
          if((oldValue === undefined || oldValue === null || oldValue === "") && cur !== undefined && cur !== null && cur !== "") return true;
          return cur === undefined || cur === null || cur === "" || String(cur) === String(oldValue || "");
        }
        function carry(section, field){
          if(!canCarry(section, field)) return;
          next[section] = Object.assign({}, next[section] || prev[section] || {});
          next[section][field] = value;
        }

        if(key === "units"){
          carry("planning", "units");
          carry("rlv", "units");
          carry("sfh", "totalUnits");
        }
        if(key === "avgSqft"){
          carry("rlv", "avgSqft");
          carry("sfh", "avgSqft");
          carry("tenure", "avgSqft");
        }
        return next;
      });
    }

    // ──────────────────────────────────────────────────────────────
    // ACREAGE + PLANNING-STATUS AWARE BENCHMARK (v9.12)
    // The old single-figure benchmark (m.land) was a "typical total" for
    // an undefined site size — comparing it to a 32-acre site was meaningless.
    // Now we compute a £/acre band based on planning status, then multiply
    // by the actual acreage to get a defensible range.
    // ──────────────────────────────────────────────────────────────
    var planStatusRaw = (data.planning && data.planning.status) || l.planningStatus || "";
    var planStatusLc = String(planStatusRaw).toLowerCase();
    // Classify planning into one of: full, outline, allocated, speculative, unknown
    var planTier;
    if(!planStatusRaw) planTier = "unknown";
    else if(/full|granted|consented|detailed|approved/.test(planStatusLc)) planTier = "full";
    else if(/outline/.test(planStatusLc)) planTier = "outline";
    else if(/allocated|local plan|emerging|draft plan/.test(planStatusLc)) planTier = "allocated";
    else if(/refused|withdrawn|stalled|recovery/.test(planStatusLc)) planTier = "stalled";
    else if(/none|unallocated|speculative|hope|green/.test(planStatusLc)) planTier = "speculative";
    else planTier = "unknown";

    // Land-value-per-acre multipliers vs market reference (rough UK norms 2026)
    // Each tier maps to {lo, mid, hi} multiplier of a "fully consented serviced" land value
    var TIER_MULT = {
      full:       {lo:0.85, mid:1.00, hi:1.20, label:"Full planning permission"},
      outline:    {lo:0.65, mid:0.80, hi:1.00, label:"Outline planning"},
      allocated:  {lo:0.35, mid:0.50, hi:0.70, label:"Allocated in Local Plan"},
      speculative:{lo:0.10, mid:0.18, hi:0.30, label:"No planning — hope value only"},
      stalled:    {lo:0.20, mid:0.35, hi:0.55, label:"Stalled / refused — recovery scenario"},
      unknown:    {lo:0.10, mid:0.45, hi:1.00, label:"Planning status not stated — full range shown"}
    };
    var tierInfo = TIER_MULT[planTier];

    // Derive fully-consented £/acre from MKT data (m.land is a typical total for an "average" 5-acre SFH site)
    // So fullyConsentedPerAcre ≈ m.land / 5 (rough calibration; refine over time)
    var TYPICAL_BENCHMARK_ACRES = 5;
    var fullyConsentedPerAcre = m.land / TYPICAL_BENCHMARK_ACRES;

    // Compute band per-acre for current tier
    var perAcreLo = fullyConsentedPerAcre * tierInfo.lo;
    var perAcreMid = fullyConsentedPerAcre * tierInfo.mid;
    var perAcreHi = fullyConsentedPerAcre * tierInfo.hi;

    // Scale to actual site size
    var siteAcres = acresVal || TYPICAL_BENCHMARK_ACRES;
    var totalLo = perAcreLo * siteAcres;
    var totalMid = perAcreMid * siteAcres;
    var totalHi = perAcreHi * siteAcres;

    // Legacy variables retained for downstream code (kept for backwards compat)
    var benchmark = totalMid;
    var diff = benchmark>0 ? ((askingPrice-benchmark)/benchmark*100) : null;
    var benchmarkPerAcre = perAcreMid;

    // Status: is asking price within or outside the band?
    var askingStatus = "unknown";
    if(askingPrice > 0){
      if(askingPrice >= totalLo && askingPrice <= totalHi) askingStatus = "within_range";
      else if(askingPrice < totalLo) askingStatus = "below_range";
      else askingStatus = "above_range";
    }

    return e("div",null,
      e("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}},
        e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A"}},"Land Appraisal"),
        e("button",{onClick:function(){navTo("landworkflow");},style:{padding:"9px 18px",background:"#2D7A65",border:"none",borderRadius:7,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"→ Development Workflow")
      ),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:20}},"Site evaluation, location scoring and market benchmarking"),

      LiveMarketBanner(),

      // ── PLACONA INTEL BANNER (shows when data loaded from Placona) ───────────
      (l.planningStatus||l.localAuthority||l.county||l.agent||l.constraintSummary||(data.scorecard&&data.scorecard.placonaScore))&&e("div",{style:{background:"linear-gradient(135deg,#F0F1FA 0%,#E8EAF6 100%)",border:"1px solid #C5C8E0",borderRadius:10,padding:16,marginBottom:16}},
        e("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
          e("span",{style:{fontSize:14}},"🤖"),
          e("div",{style:{fontSize:10,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700}},"Placona Intel — site data loaded"),
          (data.scorecard&&data.scorecard.placonaScore)&&e("div",{style:{marginLeft:"auto",padding:"3px 10px",background:"#4A4BAE",color:"#fff",borderRadius:12,fontSize:11,fontWeight:700}},"Score "+data.scorecard.placonaScore+(data.scorecard.placonaCategory?" · CAT "+data.scorecard.placonaCategory:""))
        ),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,fontSize:11}},
          l.county&&e("div",null,e("div",{style:{color:"#7278A0",fontSize:9,textTransform:"uppercase",letterSpacing:".08em",marginBottom:2}},"County"),e("div",{style:{color:"#2E2F8A",fontWeight:600}},l.county)),
          l.localAuthority&&e("div",null,e("div",{style:{color:"#7278A0",fontSize:9,textTransform:"uppercase",letterSpacing:".08em",marginBottom:2}},"Planning Authority"),e("div",{style:{color:"#2E2F8A",fontWeight:600}},l.localAuthority)),
          l.planningStatus&&e("div",null,e("div",{style:{color:"#7278A0",fontSize:9,textTransform:"uppercase",letterSpacing:".08em",marginBottom:2}},"Planning Status"),e("div",{style:{color:"#2E2F8A",fontWeight:600}},l.planningStatus)),
          l.agent&&e("div",null,e("div",{style:{color:"#7278A0",fontSize:9,textTransform:"uppercase",letterSpacing:".08em",marginBottom:2}},"Agent / Contact"),e("div",{style:{color:"#2E2F8A",fontWeight:600}},l.agent))
        ),
        l.constraintSummary&&e("div",{style:{marginTop:10,paddingTop:10,borderTop:"1px solid #C5C8E0"}},
          e("div",{style:{color:"#7278A0",fontSize:9,textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}},"Constraints Summary"),
          e("div",{style:{color:"#2E2F8A",fontSize:11,lineHeight:1.5}},l.constraintSummary)
        )
      ),

      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Site Details"),

        // v9.35 — Land Appraisal stability: same pattern as v9.34 RLV
        // Phil reported "figures change automatically" when editing SFH/Tenure.
        // Land Appraisal fields are mostly user-entered, but some can be auto-filled
        // from scraper / Process Navigator. This banner makes that visible + offers a Pin.
        (function(){
          var autoSources = [];
          if(sc3.address && l.address === sc3.address) autoSources.push("address (from scraper)");
          if(sc3.acreage && Number(l.acres) === Number(sc3.acreage)) autoSources.push("acres (from scraper)");
          if(sc3.askingPrice && Number(l.price) === Number(sc3.askingPrice)) autoSources.push("price (from scraper)");
          if(sc3.localAuthority && l.localAuthority === sc3.localAuthority) autoSources.push("LPA (from scraper)");

          // Also flag any fields that are EMPTY but have a scraper value waiting
          var emptyWithSource = [];
          if(!l.address && sc3.address) emptyWithSource.push({k:"address", v:sc3.address, label:"Site Address"});
          if(!l.acres && sc3.acreage) emptyWithSource.push({k:"acres", v:String(sc3.acreage), label:"Acres"});
          if(!l.price && sc3.askingPrice) emptyWithSource.push({k:"price", v:String(sc3.askingPrice), label:"Asking Price"});

          if(autoSources.length === 0 && emptyWithSource.length === 0) return null;

          return e("div",{style:{padding:"12px 14px",background:"rgba(154,123,62,0.06)",border:"1px solid rgba(154,123,62,0.3)",borderRadius:8,marginBottom:14}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}},
              e("div",{style:{flex:1,minWidth:240}},
                e("div",{style:{fontSize:11,fontWeight:800,color:"#9A7B3E",letterSpacing:".05em",textTransform:"uppercase",marginBottom:6}},
                  autoSources.length>0
                    ? "ℹ "+autoSources.length+" field"+(autoSources.length>1?"s":"")+" auto-populated from Land Finder/Scraper"
                    : "⚠ "+emptyWithSource.length+" empty field"+(emptyWithSource.length>1?"s":"")+" — scraper data available"
                ),
                e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:6}},
                  autoSources.length>0
                    ? "These values came from the upstream scraper. They won't change automatically once you've reviewed them — but if you clear a field, the scraper value will re-populate. Click 'Pin' to lock all values explicitly."
                    : "Found scraper data for these fields. Click Pin to copy them in, or type your own values."
                ),
                e("div",{style:{fontSize:10,color:"#7278A0",lineHeight:1.5}},
                  autoSources.length>0
                    ? "Auto-filled: "+autoSources.join(", ")
                    : "Available: "+emptyWithSource.map(function(f){return f.label+" ("+f.v.substring(0,30)+(f.v.length>30?"...":"")+")";}).join(", ")
                )
              ),
              e("button",{
                onClick:function(){
                  setData(function(prev){
                    var landNext = Object.assign({},prev.land||{});
                    emptyWithSource.forEach(function(f){ landNext[f.k] = f.v; });
                    landNext._pinnedAt = new Date().toISOString();
                    return Object.assign({},prev,{land:landNext});
                  });
                },
                title: autoSources.length>0 ? "Mark current values as pinned" : "Copy scraper values into the form and pin them",
                style:{padding:"9px 14px",background:"#9A7B3E",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",flexShrink:0}
              }, l._pinnedAt ? "🔒 Pinned" : "🔒 Pin values")
            )
          );
        })(),

        e("div",{style:S.grid2},
          e(Inp,{label:"Site Address"+(l.address?" · saved":""),value:l.address,onChange:function(v){up("land","address",v);},placeholder:"e.g. Former Factory, Birmingham B1",full:true}),
          e(Inp,{label:"Postcode"+(l.postcode?" · saved":""),value:l.postcode,onChange:function(v){up("land","postcode",v.toUpperCase());},placeholder:"e.g. CV35 0DB"}),
          l.postcode&&l.postcode.length>=5&&!num((data.market||{}).lrPsf)&&e("div",{style:{gridColumn:"span 1"}},
            e("button",{
              onClick:function(){
                up("rlv","postcode",l.postcode);
                up("rlv","lrAutoTrigger",true);
                navTo("rlv");
              },
              style:{width:"100%",padding:"8px 12px",background:"#2D7A65",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },"📡 Fetch Live Land Registry → All Stages")
          ),
          e(CitySelect,{value:l.city,onChange:function(v){up("land","city",v);}}),
          e(Inp,{label:"Site Area (acres)"+(l.acres?" · saved":""),type:"number",value:l.acres,onChange:function(v){up("land","acres",v);},placeholder:"e.g. 2.5"}),
          e(Inp,{label:"Asking Price (£)"+(l.price?" · saved":""),type:"number",value:l.price,onChange:function(v){up("land","price",v);},placeholder:"e.g. 4500000"}),
          e(Inp,{label:"Proposed Units"+(l.units?" - carries forward":""),type:"number",value:l.units,onChange:function(v){updateLandWorkingScheme("units",v);},placeholder:"e.g. 200"}),
          e(Inp,{label:"Average Unit Size (sqft)"+(l.avgSqft?" - carries forward":""),type:"number",value:l.avgSqft,onChange:function(v){updateLandWorkingScheme("avgSqft",v);},placeholder:"e.g. 950"}),
          e(Sel,{label:"Proximity to Demand",value:l.proximity,onChange:function(v){up("land","proximity",v);},
            options:[{value:"",label:"Select..."},{value:"excellent",label:"Excellent — <10 min walk (+25)"},{value:"good",label:"Good — <20 min / 5 min cycle (+15)"},{value:"fair",label:"Fair — public transport needed (+8)"},{value:"poor",label:"Poor — car dependent (0)"}]}),
          e(Sel,{label:"Transport Connectivity",value:l.transport,onChange:function(v){up("land","transport",v);},
            options:[{value:"",label:"Select..."},{value:"excellent",label:"Train + Bus + Cycle (+20)"},{value:"good",label:"Bus + Cycle (+12)"},{value:"fair",label:"Bus only (+6)"},{value:"poor",label:"Limited (0)"}]}),
          e(Sel,{label:"Ground Contamination",value:l.contamination,onChange:function(v){up("land","contamination",v);},
            options:[{value:"",label:"Select..."},{value:"clean",label:"Phase 1 clear (+20)"},{value:"minor",label:"Minor remediation <£200k (+10)"},{value:"unknown",label:"Not surveyed (+4)"},{value:"major",label:"Significant remediation (0)"}]}),
          e(Sel,{label:"Land Tenure",value:l.tenure,onChange:function(v){up("land","tenure",v);},
            options:[{value:"",label:"Select..."},{value:"freehold",label:"Freehold (+15)"},{value:"long_leasehold",label:"Long Leasehold 250yr+ (+10)"},{value:"short_leasehold",label:"Short Leasehold (+3)"}]}),
          e(Sel,{label:"Planning Constraints",value:l.constraint,onChange:function(v){up("land","constraint",v);},
            options:[{value:"",label:"Select..."},{value:"none",label:"None / outline consent (+20)"},{value:"minor",label:"TPO / listed adjacent (+12)"},{value:"moderate",label:"Conservation / Flood Zone 2 (+6)"},{value:"major",label:"Green belt / Flood Zone 3 (0)"}]})
        ),
        e("div",{style:{display:"flex",alignItems:"center",gap:16,paddingTop:16,borderTop:"1px solid #DDE0ED",marginTop:4}},
          e("div",{style:{width:64,height:64,borderRadius:"50%",border:"2px solid "+sc,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}},
            e("div",{style:{fontSize:22,fontWeight:800,color:sc,lineHeight:1}},score),
            e("div",{style:{fontSize:9,color:"#7278A0"}},"/100")
          ),
          e("div",{style:{flex:1}},
            e("div",{style:{height:4,background:"#DDE0ED",borderRadius:2,overflow:"hidden",marginBottom:6}},
              e("div",{style:{height:"100%",width:score+"%",background:sc,borderRadius:2,transition:"width .5s"}})
            ),
            e("div",{style:{fontSize:12,color:sc,fontWeight:600}},score>=70?"✓ Strong — proceed to viability":score>=45?"⚠ Moderate — enhanced DD required":"✗ High risk — review alternatives")
          )
        )
      ),

      // ──────────────────────────────────────────────────────────────
      // PLANNING SCENARIOS — v9.13
      // For each of 5 planning scenarios, compute the land value range
      // for THIS specific site, allow user to weight probabilities,
      // compute expected value, and let user "Apply" a chosen scenario
      // which then propagates to RLV / Planning / Fin / Exit.
      // ──────────────────────────────────────────────────────────────
      city&&m&&acresVal>0 && (function(){
        // Use the same fullyConsentedPerAcre baseline as the benchmark above
        // Scenarios = 5 distinct planning tiers, each with characteristic ranges
        var SCENARIOS = [
          {
            key:"full",
            label:"Full Planning Granted",
            icon:"✓",
            tone:"#2D7A65",
            mult:{lo:0.85, mid:1.00, hi:1.20},
            // Downstream assumptions per scenario:
            ahPct:30, s106pu:8000, planningCostPu:0,
            timelineMo:0, financeRate:7.5,
            yieldAdj:0,  // no yield penalty — ready to fund
            exitConfidence:"High",
            verifyNeeded:"Existing consent + planning conditions discharged + reserved matters approved (if outline already moved through)",
            // v9.56 — at the START (no planning status set yet) OR once consent is
            // granted, lead with FULL consent at 100% so the model shows the profitable,
            // consented scheme. Other tiers keep their status-aware weighting.
            defaultProb: (planTier==="full"||planTier==="unknown") ? 100 : 5
          },
          {
            key:"outline",
            label:"Outline Planning",
            icon:"◐",
            tone:"#4A4BAE",
            mult:{lo:0.65, mid:0.80, hi:1.00},
            ahPct:30, s106pu:8000, planningCostPu:5000,
            timelineMo:9, financeRate:8.0,
            yieldAdj:0.0025,
            exitConfidence:"Medium-High",
            verifyNeeded:"Outline consent + housing numbers agreed + reserved matters timeline visible",
            defaultProb: (planTier==="full"||planTier==="unknown") ? 0 : (planTier==="outline" ? 60 : 10)
          },
          {
            key:"allocated",
            label:"Allocated in Local Plan",
            icon:"○",
            tone:"#9A7B3E",
            mult:{lo:0.35, mid:0.50, hi:0.70},
            ahPct:35, s106pu:12000, planningCostPu:18000,
            timelineMo:18, financeRate:8.5,
            yieldAdj:0.005,
            exitConfidence:"Medium",
            verifyNeeded:"Local Plan allocation confirmed + LPA officer support + pre-app feedback positive",
            defaultProb: (planTier==="full"||planTier==="unknown") ? 0 : (planTier==="allocated" ? 55 : 25)
          },
          {
            key:"likely",
            label:"Likely Allocation (next plan)",
            icon:"◯",
            tone:"#B05A35",
            mult:{lo:0.20, mid:0.30, hi:0.45},
            ahPct:35, s106pu:14000, planningCostPu:30000,
            timelineMo:36, financeRate:9.0,
            yieldAdj:0.0075,
            exitConfidence:"Speculative",
            verifyNeeded:"Emerging plan inclusion + 5YHLS shortfall evidence + member-level political support",
            defaultProb: (planTier==="full"||planTier==="unknown") ? 0 : 20
          },
          {
            key:"hope",
            label:"Speculative / Hope Value",
            icon:"·",
            tone:"#8A3A1A",
            mult:{lo:0.08, mid:0.18, hi:0.30},
            ahPct:40, s106pu:18000, planningCostPu:60000,
            timelineMo:60, financeRate:10.0,
            yieldAdj:0.0125,
            exitConfidence:"Strategic only",
            verifyNeeded:"Strategic land play — 5-10 year horizon, willingness to fund planning promotion",
            defaultProb: (planTier==="full"||planTier==="unknown") ? 0 : 20
          }
        ];

        // Apply per-scenario calculations
        var scenarioCalcs = SCENARIOS.map(function(s){
          var pa_lo = fullyConsentedPerAcre * s.mult.lo;
          var pa_mid = fullyConsentedPerAcre * s.mult.mid;
          var pa_hi = fullyConsentedPerAcre * s.mult.hi;
          var t_lo = pa_lo * acresVal;
          var t_mid = pa_mid * acresVal;
          var t_hi = pa_hi * acresVal;
          var pct = (l["scenProb_"+s.key] !== undefined && l["scenProb_"+s.key] !== "") ? num(l["scenProb_"+s.key]) : s.defaultProb;
          return Object.assign({}, s, {
            paLo:pa_lo, paMid:pa_mid, paHi:pa_hi,
            tLo:t_lo, tMid:t_mid, tHi:t_hi,
            probPct:pct,
            weighted:t_mid*(pct/100)
          });
        });

        var totalProb = scenarioCalcs.reduce(function(a,b){return a+b.probPct;},0);
        // v9.59 — normalise so the expected value is always a proper weighted average,
        // even if the probabilities don't sum to exactly 100% (fixes the inflated figure).
        var expectedValue = totalProb>0 ? (scenarioCalcs.reduce(function(a,b){return a+b.weighted;},0) / (totalProb/100)) : 0;
        var activeScenario = l.appliedScenario || "";
        var askingVsExpected = askingPrice>0 && expectedValue>0 ? ((askingPrice-expectedValue)/expectedValue*100) : null;

        function applyScenario(scenKey){
          var s = scenarioCalcs.find(function(x){return x.key===scenKey;});
          if(!s) return;
          if(!confirm("Apply '"+s.label+"' scenario?\n\nThis will update:\n• Land value (mid-point: "+fmt(s.tMid)+")\n• Planning status field\n• Expected AH% ("+s.ahPct+"%)\n• Expected S106 per unit (£"+s.s106pu.toLocaleString()+")\n• Finance rate ("+s.financeRate+"%)\n• Timeline to commit ("+s.timelineMo+" months)\n• Yield uplift ("+(s.yieldAdj*100).toFixed(2)+"% penalty)\n\nYou can change scenario at any time — but manual overrides made on RLV/Fin/Planning may be reset.")) return;
          // Update land
          var landUpdates = {
            appliedScenario:s.key,
            appliedScenarioLabel:s.label,
            appliedAt:new Date().toISOString(),
            planningStatus:s.label,
            scenarioLandValue:Math.round(s.tMid),
            scenarioPerAcre:Math.round(s.paMid),
            scenarioAhPct:s.ahPct,
            scenarioS106pu:s.s106pu,
            scenarioFinanceRate:s.financeRate,
            scenarioTimelineMo:s.timelineMo,
            scenarioYieldAdj:s.yieldAdj
          };
          // v9.18 — Update planning with BOTH ahPct AND afhPct field names
          // (legacy duplicate fieldname — different parts of app read different keys)
          // Also populate s106pu so the empty S106 field gets filled.
          var planningUpdates = {
            status:s.label,
            ahPct:s.ahPct,
            afhPct:s.ahPct,
            s106pu:s.s106pu,
            scenarioApplied:s.key
          };
          // v9.18 — Update RLV with both finRate AND s106pu, AND sync units from Planning
          // (if user has set units in Planning but not RLV)
          var rlvUpdates = {
            finRate:s.financeRate,
            s106pu:s.s106pu,
            scenarioApplied:s.key
          };
          // v9.18 — Update Fin with s106pu too
          var finUpdates = {
            finRate:s.financeRate,
            s106pu:s.s106pu,
            scenarioApplied:s.key
          };
          // v9.19 — Update scheme-specific input stages too
          // These were missed in v9.13: SFH House Mix / BTR-PBSA Block / Tenure Mix / Capitalisation
          // all have their own AH%/S106pu/finRate fields that didn't receive scenario values.
          var sfhUpdates = {
            ahPct:s.ahPct,
            s106pu:s.s106pu,
            finRate:s.financeRate,
            scenarioApplied:s.key
          };
          var hraUpdates = {
            ahPct:s.ahPct,
            s106pu:s.s106pu,
            finRate:s.financeRate,
            scenarioApplied:s.key
          };
          var tenureUpdates = {
            ahPct:s.ahPct,
            scenarioApplied:s.key
          };
          // Capitalisation: bump target yield by scenario yieldAdj (penalty for higher-risk scenarios)
          var capUpdates = {
            scenarioApplied:s.key
            // targetYield handled below — applied as adjustment to existing, not overwrite
          };
          setData(function(prev){
            var prevPlanningUnits = num((prev.planning && prev.planning.units) || 0);
            var prevRlvUnits = num((prev.rlv && prev.rlv.units) || 0);
            // If Planning has units but RLV doesn't, copy across
            var rlvUpdatesFinal = Object.assign({}, rlvUpdates);
            if(prevPlanningUnits > 0 && !prevRlvUnits){
              rlvUpdatesFinal.units = prevPlanningUnits;
            }
            // If RLV has units but Planning doesn't, copy across
            var planningUpdatesFinal = Object.assign({}, planningUpdates);
            if(prevRlvUnits > 0 && !prevPlanningUnits){
              planningUpdatesFinal.units = prevRlvUnits;
            }
            // v9.19 — Capitalisation yield adjustment (institutional buyers price risk)
            var capUpdatesFinal = Object.assign({}, capUpdates);
            var prevTargetYield = num((prev.capitalise && prev.capitalise.targetYield) || 0);
            // If user has set a base yield, store the unmodified value first then add adjustment
            if(prevTargetYield > 0 && s.yieldAdj > 0){
              // Store the pre-scenario yield so we can restore it on clear
              if(!(prev.capitalise && prev.capitalise._preScenarioYield)){
                capUpdatesFinal._preScenarioYield = prevTargetYield;
              }
              capUpdatesFinal.targetYield = prevTargetYield + s.yieldAdj;
            }
            return mergeRespectingCompletedStages(prev,{
              land:Object.assign({},prev.land||{},landUpdates),
              planning:Object.assign({},prev.planning||{},planningUpdatesFinal),
              rlv:Object.assign({},prev.rlv||{},rlvUpdatesFinal),
              fin:Object.assign({},prev.fin||{},finUpdates),
              sfh:Object.assign({},prev.sfh||{},sfhUpdates),
              hra:Object.assign({},prev.hra||{},hraUpdates),
              tenure:Object.assign({},prev.tenure||{},tenureUpdates),
              capitalise:Object.assign({},prev.capitalise||{},capUpdatesFinal),
              _activeScenario:s.key,
              _activeScenarioLabel:s.label
            });
          });
        }

        function clearScenario(){
          if(!confirm("Clear applied scenario? This won't undo manual edits you've made since.")) return;
          setData(function(prev){
            var land = Object.assign({},prev.land||{});
            delete land.appliedScenario;
            delete land.appliedScenarioLabel;
            delete land.appliedAt;
            delete land.scenarioLandValue;
            delete land.scenarioPerAcre;
            delete land.scenarioAhPct;
            delete land.scenarioS106pu;
            delete land.scenarioFinanceRate;
            delete land.scenarioTimelineMo;
            delete land.scenarioYieldAdj;
            return Object.assign({},prev,{
              land:land,
              _activeScenario:null,
              _activeScenarioLabel:null
            });
          });
        }

        return e("div",{style:S.card},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}},
            e("div",{style:S.cardTitle},"Planning Scenarios — "+cityName(city)+" · "+acresVal.toFixed(1)+" acres"),
            activeScenario && e("button",{onClick:clearScenario,style:{padding:"5px 11px",fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",background:"transparent",border:"1px solid #B05A35",color:"#B05A35",borderRadius:4,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Clear scenario")
          ),

          // Explainer
          e("div",{style:{padding:"10px 14px",background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.25)",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:14}},
            e("strong",{style:{color:"#2E2F8A"}},"How to use: "),
            "Adjust the probability % for each scenario based on your evidence (defaults are illustrative). The Expected Value at the bottom is probability-weighted across all scenarios. ",
            e("strong",null,"Click 'Apply' on the scenario you want to model in detail "),
            "— Landform will propagate the planning, AH%, S106, finance rate and yield assumptions to RLV, Planning & Viability, Financial Modelling and Exit Strategy."
          ),

          // v9.56 — when no planning status is set yet, the model leads with FULL consent
          planTier==="unknown" && e("div",{style:{padding:"10px 14px",background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.35)",borderRadius:6,fontSize:11,color:"#1d5446",lineHeight:1.6,marginBottom:14}},
            e("strong",null,"Starting on Full Planning Granted. "),
            "No planning status is set yet, so the model assumes consent is in place — showing the profitable, consented scheme first. Set the Planning Status (below or in Planning & Viability), or dial the probabilities, to weigh the real planning risk."
          ),

          // Active scenario banner
          activeScenario && e("div",{style:{padding:"12px 14px",background:"rgba(45,122,101,0.10)",border:"1px solid rgba(45,122,101,0.4)",borderRadius:6,fontSize:12,color:"#1d5446",lineHeight:1.5,marginBottom:14}},
            e("div",{style:{fontWeight:700,marginBottom:4}},"✓ Active scenario: "+(l.appliedScenarioLabel||activeScenario)),
            e("div",null,"Downstream stages (RLV, Planning, Fin, Exit) are now modelling this scenario. Land value: "+fmt(l.scenarioLandValue||0)+" · AH%: "+(l.scenarioAhPct||0)+"% · Timeline to commit: "+(l.scenarioTimelineMo||0)+" months")
          ),

          // Scenario table
          e("div",{style:{overflowX:"auto",marginBottom:14}},
            e("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:11}},
              e("thead",null,
                e("tr",{style:{borderBottom:"2px solid #2E2F8A"}},
                  e("th",{style:{padding:"8px 6px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#2E2F8A"}},"Scenario"),
                  e("th",{style:{padding:"8px 6px",textAlign:"right",fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#2E2F8A"}},"£/Acre"),
                  e("th",{style:{padding:"8px 6px",textAlign:"right",fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#2E2F8A"}},"Site Value (Mid)"),
                  e("th",{style:{padding:"8px 6px",textAlign:"right",fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#2E2F8A"}},"Range"),
                  e("th",{style:{padding:"8px 6px",textAlign:"center",fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#2E2F8A",width:90}},"Probability %"),
                  e("th",{style:{padding:"8px 6px",textAlign:"right",fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#2E2F8A"}},"Weighted"),
                  e("th",{style:{padding:"8px 6px",textAlign:"center",fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:"#2E2F8A",width:80}},"Apply")
                )
              ),
              e("tbody",null,
                scenarioCalcs.map(function(s){
                  var isActive = activeScenario === s.key;
                  return e("tr",{key:s.key,style:{borderBottom:"1px solid #E8E9F5",background:isActive?"rgba(45,122,101,0.05)":"transparent"}},
                    e("td",{style:{padding:"10px 6px",verticalAlign:"top"}},
                      e("div",{style:{display:"flex",alignItems:"center",gap:8}},
                        e("span",{style:{display:"inline-block",width:22,height:22,borderRadius:"50%",background:s.tone,color:"#fff",textAlign:"center",lineHeight:"22px",fontSize:11,fontWeight:800,flexShrink:0}},s.icon),
                        e("div",null,
                          e("div",{style:{fontWeight:700,color:"#2E2F8A",fontSize:12}},s.label),
                          e("div",{style:{fontSize:9,color:"#7278A0",marginTop:1}},s.exitConfidence+" exit · "+s.timelineMo+"mo timeline")
                        )
                      )
                    ),
                    e("td",{style:{padding:"10px 6px",textAlign:"right",verticalAlign:"top",color:"#3A3D6A",fontWeight:600}},"£"+Math.round(s.paMid).toLocaleString()),
                    e("td",{style:{padding:"10px 6px",textAlign:"right",verticalAlign:"top",fontWeight:700,color:s.tone,fontSize:13}},fmt(s.tMid)),
                    e("td",{style:{padding:"10px 6px",textAlign:"right",verticalAlign:"top",fontSize:10,color:"#7278A0"}},fmt(s.tLo)+" – "+fmt(s.tHi)),
                    e("td",{style:{padding:"10px 6px",textAlign:"center",verticalAlign:"top"}},
                      e("input",{type:"number",min:0,max:100,value:s.probPct,onChange:function(ev){up("land","scenProb_"+s.key,ev.target.value);},style:{width:60,padding:"5px 6px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:11,textAlign:"center",fontFamily:"DM Sans,sans-serif",color:"#2E2F8A",fontWeight:600}})
                    ),
                    e("td",{style:{padding:"10px 6px",textAlign:"right",verticalAlign:"top",color:"#3A3D6A",fontStyle:s.probPct>0?"normal":"italic",fontWeight:s.probPct>0?600:400}},s.probPct>0?fmt(s.weighted):"—"),
                    e("td",{style:{padding:"10px 6px",textAlign:"center",verticalAlign:"top"}},
                      isActive
                        ? e("span",{style:{display:"inline-block",padding:"4px 8px",background:"#2D7A65",color:"#fff",borderRadius:3,fontSize:9,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase"}},"✓ Active")
                        : e("button",{onClick:function(){applyScenario(s.key);},style:{padding:"5px 12px",background:s.tone,color:"#fff",border:"none",borderRadius:3,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Apply")
                    )
                  );
                })
              ),
              e("tfoot",null,
                e("tr",{style:{borderTop:"2px solid #2E2F8A",background:"#F4F5FB"}},
                  e("td",{style:{padding:"12px 6px",fontWeight:800,color:"#2E2F8A",fontSize:11}},"Expected value (probability-weighted)"),
                  e("td",{style:{padding:"12px 6px"}}),
                  e("td",{style:{padding:"12px 6px",textAlign:"right",fontWeight:800,color:"#2E2F8A",fontSize:15}},fmt(expectedValue)),
                  e("td",{style:{padding:"12px 6px",textAlign:"right",fontSize:10,color:"#7278A0"}},"Total prob: "+totalProb+"%"),
                  e("td",{style:{padding:"12px 6px"}}),
                  e("td",{style:{padding:"12px 6px",textAlign:"right",fontSize:10,color:"#7278A0",fontStyle:"italic"}},Math.abs(totalProb-100)>1?"⚠ Adjust probabilities to total 100%":"✓"),
                  e("td",{style:{padding:"12px 6px"}})
                )
              )
            )
          ),

          // Asking price comparison
          askingPrice>0 && e("div",{style:{padding:"12px 14px",background:askingVsExpected>20?"rgba(176,90,53,0.08)":askingVsExpected<-20?"rgba(45,122,101,0.08)":"rgba(74,75,174,0.06)",border:"1px solid "+(askingVsExpected>20?"rgba(176,90,53,0.35)":askingVsExpected<-20?"rgba(45,122,101,0.35)":"rgba(74,75,174,0.25)"),borderRadius:6,fontSize:12,lineHeight:1.6,color:"#2E2F8A"}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}},
              e("div",{style:{fontWeight:700}},"Asking vs Expected Value"),
              e("div",{style:{fontSize:14,fontWeight:800,color:askingVsExpected>20?"#B05A35":askingVsExpected<-20?"#1d5446":"#3A3D6A"}},
                fmt(askingPrice)+" vs "+fmt(expectedValue)+" — "+(askingVsExpected>0?"+":"")+askingVsExpected.toFixed(0)+"%"
              )
            ),
            e("div",{style:{fontSize:11,color:"#3A3D6A"}},
              askingVsExpected>50 ? "Asking is materially above probability-weighted expectation. Vendor either has stronger planning evidence than you've assumed (adjust probabilities up on Full/Outline scenarios), or this is a hope-value bid. Decision depends on whether you believe their planning case." :
              askingVsExpected>20 ? "Asking is above expectation but within negotiating range. Test the vendor's planning evidence — if they can substantiate higher-probability scenarios, the gap closes." :
              askingVsExpected>-20 ? "Asking is close to your probability-weighted view. Reasonable basis to engage." :
              "Asking is below probability-weighted expectation. Investigate why — possible distressed sale, encumbrance, or planning risk you haven't priced. If clean, this is potentially strong value."
            )
          )
        );
      })(),

      // ── LAND DEAL — WHAT YOU SHOULD PAY ────────────────────────────────────
      // v9.54 — Bridges the landowner's ask and the worked residual. The land has
      // NO residential value until you assume a consented scheme, so this panel
      // (a) makes you enter assumed homes, (b) values that CONSENTED scheme via the
      // same canonical engine the rest of the tool uses, (c) shows the agricultural
      // floor → today's risk-adjusted value → consented ceiling, and (d) lays a fair
      // landowner offer under each deal structure against the asking price.
      // It NEVER shows a bare negative as "what to pay".
      (typeof calcDealMetrics==="function") && (function(){
        // v9.61 — if a real house mix exists, drive the land affordability off the FULL
        // project (sales + capitalised rents + real costs) from the canonical engine;
        // otherwise fall back to a quick "assumed homes × £/sqft" estimate.
        var realUnits = (typeof computeSFHMetrics==="function") ? num(computeSFHMetrics(data).totalUnits) : 0;
        var hasRealScheme = realUnits > 0;
        var assumedUnits = hasRealScheme ? realUnits : num(l.assumedUnits);
        var agriPerAcre  = numOr(l.agriValPerAcre, 15000);          // £/acre agricultural (existing use)
        var structure    = l.dealStructure || "option";
        var STRUCTS = {
          option:     {label:"Option agreement",   shareLabel:"Discount to consented value", shareKey:"optionDiscPct",  shareDef:15, note:"Pay a small option fee now; buy at a discount to the consented value once planning is granted."},
          promotion:  {label:"Promotion agreement", shareLabel:"Promoter fee (% of proceeds)", shareKey:"promoterPct",    shareDef:15, note:"Promoter funds the planning push; land sold with consent; landowner keeps proceeds less the promoter's fee."},
          overage:    {label:"Overage / clawback",  shareLabel:"Landowner share of the uplift", shareKey:"overageSharePct", shareDef:50, note:"Pay agricultural-plus now; landowner shares in the uplift when consent is achieved."},
          conditional:{label:"Conditional purchase",shareLabel:"Discount to consented value", shareKey:"condDiscPct",    shareDef:10, note:"Exchange now, complete on planning, at an agreed price — you carry more of the planning risk."}
        };
        var sInfo = STRUCTS[structure] || STRUCTS.option;
        var sharePct = numOr(l[sInfo.shareKey], sInfo.shareDef);

        // Header is always shown
        var header = e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6,flexWrap:"wrap",gap:8}},
          e("div",{style:S.cardTitle},"💷 Land Deal — What You Should Pay"),
          e("div",{style:{fontSize:10,color:"#7278A0"}},"Reuses the canonical appraisal engine — same GDV & RLV as the rest of the tool")
        );

        // Jump to build the real scheme / see the exit value
        var ctaRow = e("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}},
          e("button",{onClick:function(){navTo("sfh");},style:{padding:"7px 14px",background:hasRealScheme?"#fff":"#2D7A65",color:hasRealScheme?"#2D7A65":"#fff",border:"1px solid #2D7A65",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}}, hasRealScheme?"✎ Edit house mix":"🏡 Build your full house mix →"),
          e("button",{onClick:function(){navTo("capitalise");},style:{padding:"7px 14px",background:"#fff",color:"#4A4BAE",border:"1px solid #4A4BAE",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}}, "£ Capitalisation / exit →")
        );
        // Where the figures come from
        var sourceNote = hasRealScheme
          ? e("div",{style:{fontSize:10,color:"#1d5446",background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.3)",borderRadius:6,padding:"8px 12px",marginBottom:12,lineHeight:1.5}},
              e("strong",null,"Using your full house mix"),": "+realUnits+" homes, your real sale prices and any rents capitalised — the GDV & RLV below match the SFH House Mix and Capitalisation.")
          : e("div",{style:{fontSize:10,color:"#9A7B3E",background:"rgba(154,123,62,0.08)",border:"1px solid rgba(154,123,62,0.3)",borderRadius:6,padding:"8px 12px",marginBottom:12,lineHeight:1.5}},
              e("strong",null,"Quick estimate"),": no house mix built yet, so this uses assumed homes × area £/sqft. Build the mix (button above) for your real sales, rents and exit value.");

        // Assumed-homes input (required before any land value is shown — unless a mix exists)
        var unitsInput = e("div",{style:{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:12,marginBottom:12}},
          hasRealScheme
          ? e("div",null,
              e("label",{style:{fontSize:10,color:"#7278A0",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:3}},"Homes (from your house mix)"),
              e("div",{style:{padding:"8px 10px",background:"#F0F1FA",borderRadius:6,fontSize:14,fontFamily:"DM Mono,monospace",fontWeight:700,color:"#2E2F8A"}}, realUnits+" homes"),
              e("div",{style:{fontSize:9,color:"#9A9AAE",marginTop:3}}, "From SFH House Mix"+(acresVal>0?" · "+(realUnits/acresVal).toFixed(1)+" homes/acre":"")+" — edit it there")
            )
          : e("div",null,
            e("label",{style:{fontSize:10,color:"#7278A0",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:3}},"Assumed homes (if consent granted)"),
            e("input",{type:"number",min:0,value:l.assumedUnits!==undefined?l.assumedUnits:"",placeholder:"e.g. 220",
              onChange:function(ev){up("land","assumedUnits",ev.target.value);},
              style:{width:"100%",padding:"8px 10px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:14,fontFamily:"DM Mono,monospace",fontWeight:700}}),
            e("div",{style:{fontSize:9,color:"#9A9AAE",marginTop:3}},acresVal>0?("≈ "+(acresVal>0?Math.round(assumedUnits/acresVal):0)+" homes/acre on "+acresVal.toFixed(1)+" acres"):"Set the site acreage above for a per-acre check")
          ),
          e("div",null,
            e("label",{style:{fontSize:10,color:"#7278A0",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:3}},"Agricultural value (£/acre)"),
            e("input",{type:"number",min:0,step:1000,value:l.agriValPerAcre!==undefined?l.agriValPerAcre:"",placeholder:"15000",
              onChange:function(ev){up("land","agriValPerAcre",ev.target.value);},
              style:{width:"100%",padding:"8px 10px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:14,fontFamily:"DM Mono,monospace"}}),
            e("div",{style:{fontSize:9,color:"#9A9AAE",marginTop:3}},"Existing-use value — typically £10k–25k/acre")
          )
        );

        // v9.77 — density calculator: set homes/acre and it works out the units from the
        // acreage (so you evaluate the land mass, not guess the count). Greenfield estates
        // run ~10–14 homes/acre GROSS once roads, open space and buffers are allowed for.
        var densityHelper = (!hasRealScheme && acresVal>0) ? e("div",{style:{marginBottom:12,padding:"9px 12px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:6}},
          e("div",{style:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}},
            e("span",{style:{fontSize:11,color:"#7278A0",fontWeight:700}},"Or set by density:"),
            e("input",{type:"number",min:0,step:0.5,value:l.assumedDensity!==undefined&&l.assumedDensity!==""?l.assumedDensity:"",placeholder:"/acre",
              onChange:function(ev){ var d=Number(ev.target.value); up("land","assumedDensity",ev.target.value); if(d>0) up("land","assumedUnits",Math.round(acresVal*d)); },
              style:{width:72,padding:"6px 8px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:13,fontFamily:"DM Mono,monospace",fontWeight:700,textAlign:"center"}}),
            e("span",{style:{fontSize:11,color:"#7278A0"}},"homes/acre"),
            [10,12,14].map(function(d){ return e("button",{key:d,onClick:function(){ up("land","assumedDensity",d); up("land","assumedUnits",Math.round(acresVal*d)); },
              style:{padding:"4px 10px",background:num(l.assumedDensity)===d?"#4A4BAE":"#fff",color:num(l.assumedDensity)===d?"#fff":"#4A4BAE",border:"1px solid #4A4BAE",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},d+"/ac"); })
          ),
          e("div",{style:{fontSize:10,color:"#9A9AAE",marginTop:5}}, acresVal.toFixed(0)+" acres × "+(num(l.assumedDensity)>0?num(l.assumedDensity):"?")+"/acre ≈ "+(num(l.assumedDensity)>0?Math.round(acresVal*num(l.assumedDensity)).toLocaleString():"—")+" homes · greenfield estates ~10–14/acre gross")
        ) : null;

        // No homes yet → explain why, don't show a scary negative
        if(!(assumedUnits>0)){
          return e("div",{style:S.card},
            header, ctaRow, unitsInput, densityHelper,
            e("div",{style:{padding:"14px 16px",background:"rgba(154,123,62,0.08)",border:"1px solid rgba(154,123,62,0.35)",borderRadius:8,fontSize:12,lineHeight:1.7,color:"#3A3D6A"}},
              e("div",{style:{fontWeight:700,color:"#9A7B3E",marginBottom:6}},"Enter the homes you'd get with consent to value the land"),
              "Raw land with no planning has no residential value — only ",e("strong",null,"agricultural value")," (~£",fmtN(agriPerAcre),"/acre). ",
              "The land is only worth more ",e("em",null,"once you assume planning is granted"),". Tell us how many homes you'd expect consent for and we'll work out the most you should pay, how that's worth it, and a fair offer to the landowner — including against their asking price."
            )
          );
        }

        // ── Value the CONSENTED scheme through the canonical engine ──────────
        // Clear any stale mix / applied scenario so we get a clean "assume N homes
        // at area sale & build £/sqft" residual; inject the unit count everywhere
        // the engine looks for it; force the generic land residual path.
        var assumedBuildPsf = num(l.assumedBuildPsf);   // optional land-stage override
        var assumedSalePsf  = num(l.assumedSalePsf);     // optional land-stage override
        function landClone(withOverrides){
          var c = JSON.parse(JSON.stringify(data || {}));
          c.assetType = "land";
          c.sfh = Object.assign({}, c.sfh || {}, {mix:[]});
          c.land = Object.assign({}, c.land || {}, {units:assumedUnits, scenarioLandValue:0});
          c.rlv = Object.assign({}, c.rlv || {}, {units:assumedUnits});
          c.planning = Object.assign({}, c.planning || {}, {units:assumedUnits});
          if(withOverrides){
            if(assumedBuildPsf>0){ c.rlv.buildPsf = assumedBuildPsf; c.fin = Object.assign({}, c.fin||{}, {buildPsf:assumedBuildPsf}); c.sfh.buildPsf = assumedBuildPsf; }
            if(assumedSalePsf>0){ c.rlv.salePsf = assumedSalePsf; c.sfh.basePsf = assumedSalePsf; }
          }
          return c;
        }
        // Real mix → value the ACTUAL deal (sales + capitalised rents + real costs).
        // No mix → cmBase is the area/shared estimate; cm applies any £/sqft overrides above.
        var cmBase, cm;
        if(hasRealScheme){
          cm = cmBase = calcDealMetrics(data);
        } else {
          cmBase = calcDealMetrics(landClone(false));
          cm = (assumedBuildPsf>0 || assumedSalePsf>0) ? calcDealMetrics(landClone(true)) : cmBase;
        }
        var defBuildPsf = Math.round(num(cmBase.buildPsf));
        var defSalePsf  = Math.round(num(cmBase.salePsf));
        var consentedRlv = Math.max(0, num(cm.rlv));
        var consentedGdv = num(cm.gdv);

        // Build & sale £/sqft — the two numbers that drive everything, set right here.
        var costInput = e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}},
          e("div",null,
            e("label",{style:{fontSize:10,color:"#7278A0",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:3}},"Build cost (£/sqft)"),
            e("input",{type:"number",min:0,step:5,value:l.assumedBuildPsf!==undefined&&l.assumedBuildPsf!==""?l.assumedBuildPsf:"",placeholder:String(defBuildPsf),
              onChange:function(ev){up("land","assumedBuildPsf",ev.target.value);},
              style:{width:"100%",padding:"8px 10px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:14,fontFamily:"DM Mono,monospace",fontWeight:700}}),
            e("div",{style:{fontSize:9,color:"#9A9AAE",marginTop:3}},"Area benchmark £"+defBuildPsf+"/sqft — edit to match your build")
          ),
          e("div",null,
            e("label",{style:{fontSize:10,color:"#7278A0",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:3}},"Sale price (£/sqft)"),
            e("input",{type:"number",min:0,step:5,value:l.assumedSalePsf!==undefined&&l.assumedSalePsf!==""?l.assumedSalePsf:"",placeholder:String(defSalePsf),
              onChange:function(ev){up("land","assumedSalePsf",ev.target.value);},
              style:{width:"100%",padding:"8px 10px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:14,fontFamily:"DM Mono,monospace",fontWeight:700}}),
            e("div",{style:{fontSize:9,color:"#9A9AAE",marginTop:3}},"Used: £"+defSalePsf+"/sqft — what your homes sell for")
          )
        );

        var agriValue = Math.max(0, acresVal * agriPerAcre);
        var uplift = Math.max(0, consentedRlv - agriValue);
        var maxBid = consentedRlv * 0.85;          // negotiation discipline — 85% of RLV
        var openingBid = consentedRlv * 0.65;       // opening offer — 65%

        // Today's risk-adjusted value: consented ceiling scaled by planning probability,
        // floored at agricultural value. Factors mirror the scenario bands above.
        var probFactor = ({full:0.95, outline:0.70, allocated:0.45, speculative:0.18, stalled:0.30, unknown:0.25})[planTier] || 0.25;
        var todayValue = Math.max(agriValue, consentedRlv * probFactor);

        // ── Deal-structure economics (flow from the chosen structure) ────────
        var optionFee = acresVal * numOr(l.optionFeePerAcre, 2000);
        var payNow=0, payOnConsent=0, landownerTotal=0, devKeeps=0, structureExplain="";
        if(structure==="option"){
          var disc = sharePct/100;
          payNow = optionFee;
          payOnConsent = consentedRlv * (1 - disc);
          landownerTotal = payNow + payOnConsent;
          devKeeps = consentedRlv - payOnConsent;   // the discount is your reward for de-risking planning
          structureExplain = "Pay a "+fmt(optionFee)+" option fee now ("+acresVal.toFixed(1)+" acres × £"+fmtN(numOr(l.optionFeePerAcre,2000))+"). On consent, buy for "+fmt(payOnConsent)+" — "+(100-sharePct)+"% of the consented value, a "+sharePct+"% discount that is your reward for funding and de-risking the planning.";
        } else if(structure==="promotion"){
          var fee = sharePct/100;
          payNow = 0;
          payOnConsent = consentedRlv * (1 - fee);  // landowner's net of the promoter fee
          landownerTotal = payOnConsent;
          devKeeps = consentedRlv * fee;            // promoter fee is your return
          structureExplain = "No purchase. You promote the land through planning, it's sold with consent (≈ "+fmt(consentedRlv)+"), and you take a "+sharePct+"% promoter fee ("+fmt(devKeeps)+"). The landowner keeps "+fmt(payOnConsent)+".";
        } else if(structure==="overage"){
          var upfront = Math.max(agriValue, agriValue * 1.5);   // agricultural-plus now
          var oShare = sharePct/100;
          var ownerUpliftShare = Math.max(0, (consentedRlv - upfront)) * oShare;
          payNow = upfront;
          payOnConsent = ownerUpliftShare;
          landownerTotal = upfront + ownerUpliftShare;
          devKeeps = consentedRlv - landownerTotal;
          structureExplain = "Pay "+fmt(upfront)+" now (agricultural value + ~50% premium). When consent lands, the landowner also gets "+sharePct+"% of the uplift above that — "+fmt(ownerUpliftShare)+". Total to landowner "+fmt(landownerTotal)+".";
        } else { // conditional
          var cdisc = sharePct/100;
          payNow = 0;
          payOnConsent = consentedRlv * (1 - cdisc);
          landownerTotal = payOnConsent;
          devKeeps = consentedRlv - payOnConsent;
          structureExplain = "Exchange now, complete on planning at a fixed "+fmt(payOnConsent)+" — "+(100-sharePct)+"% of the consented value. A smaller "+sharePct+"% discount reflects that you carry more of the planning risk by committing up front.";
        }

        // ── Asking-price reconciliation ──────────────────────────────────────
        var ask = askingPrice;
        var askGap = ask - landownerTotal;                 // +ve = they want more than the fair offer
        var askVsMax = ask - maxBid;                       // +ve = above your ceiling
        // Approx homes needed to justify their ask (RLV ≈ linear in units near this point)
        var rlvNeeded = structure==="overage"
          ? ( (ask - Math.max(agriValue, agriValue*1.5)) / Math.max(0.01, (sharePct/100)) + Math.max(agriValue, agriValue*1.5) )
          : (structure==="promotion" || structure==="conditional" || structure==="option")
            ? ( (ask - payNow) / Math.max(0.01, (1 - sharePct/100)) )
            : ask;
        var homesToJustify = (consentedRlv>0 && assumedUnits>0) ? Math.round(assumedUnits * rlvNeeded / consentedRlv) : 0;

        var tile = function(label,val,sub,col,strong){
          return e("div",{style:{background:strong?"linear-gradient(135deg,#F0F1FA,#E4E4F4)":"#fff",border:"1px solid "+(strong?"#4A4BAE":"#DDE0ED"),borderRadius:8,padding:12}},
            e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}},label),
            e("div",{style:{fontSize:18,fontWeight:800,color:col||"#2E2F8A",lineHeight:1.1}},val),
            e("div",{style:{fontSize:9,color:"#7278A0",fontStyle:"italic",marginTop:2}},sub)
          );
        };

        return e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #2D7A65"})},
          header, ctaRow, sourceNote, unitsInput, densityHelper, (hasRealScheme ? null : costInput),

          // Three layers of value
          e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}},
            tile("Agricultural (floor)", fmt(agriValue), "£"+fmtN(agriPerAcre)+"/acre × "+acresVal.toFixed(1)+" acres", "#9A7B3E"),
            tile("Today — pre-consent", fmt(todayValue), Math.round(probFactor*100)+"% planning probability ("+tierInfo.label+")", "#4A4BAE"),
            tile("Consented (ceiling)", fmt(consentedRlv), "max you can pay at "+assumedUnits+" homes", "#2D7A65", true)
          ),
          e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:14,lineHeight:1.6}},
            "Consented value is the residual on a worked scheme of ",e("strong",null,assumedUnits+" homes"),": GDV ",e("strong",null,fmt(consentedGdv)),
            " less build, fees, finance, S106, infrastructure and your profit. Negotiation ceiling (",e("strong",null,"85% of RLV"),") = ",e("strong",{style:{color:"#2D7A65"}},fmt(maxBid)),
            "; opening offer (65%) = ",fmt(openingBid),"."
          ),

          // v9.59 — Reconcile the two land figures that otherwise look contradictory:
          // the market comparable (scenario/benchmark sections) vs this worked residual.
          (function(){
            var benchMid = (typeof fullyConsentedPerAcre!=="undefined" && acresVal>0) ? fullyConsentedPerAcre*acresVal : 0;
            if(!(benchMid>0)) return null;
            var density = acresVal>0 ? assumedUnits/acresVal : 0;
            var bigGap = benchMid > consentedRlv*1.5;
            return e("div",{style:{marginBottom:14,padding:"12px 14px",background:bigGap?"rgba(176,90,53,0.07)":"rgba(74,75,174,0.06)",border:"1px solid "+(bigGap?"rgba(176,90,53,0.35)":"rgba(74,75,174,0.25)"),borderRadius:8,fontSize:11,lineHeight:1.7,color:"#3A3D6A"}},
              e("div",{style:{fontWeight:800,color:bigGap?"#B05A35":"#2E2F8A",marginBottom:4}},
                bigGap ? "⚠ Why the two land figures differ" : "How the two land figures line up"
              ),
              "The ",e("strong",null,"Market Benchmark / Scenarios")," above (≈",e("strong",null,fmt(benchMid)),") is a ",e("strong",null,"rough market comparable")," — what similar consented land tends to trade at. The ",e("strong",null,"Consented ceiling here")," (",e("strong",{style:{color:"#2D7A65"}},fmt(consentedRlv)),") is the ",e("strong",null,"worked residual")," — what your actual ",assumedUnits,"-home scheme can afford and still profit. ",
              e("strong",null,"Always trust the residual for what to pay."),
              bigGap ? e("div",{style:{marginTop:6}},
                "They diverge a lot here, which usually means one of: ",
                e("strong",null,"density is low"),
                " ("+(density?density.toFixed(1):"?")+" homes/acre"+(density&&density<10?" — typical is 12–15, so more homes would lift the land value a lot":"")+"), build costs are high, or sale prices are set low. Revisit your homes / costs / sale £-per-sqft — or, if the scheme really is this size, the land is only worth the residual no matter what comparables say."
              ) : null
            );
          })(),

          // ── Assuming planning is granted — does the scheme stack? ──────────
          // v9.55 — Model the consented scheme FIRST so you can see it's profitable,
          // then weigh the planning risk via the scenarios above / the "today" figure.
          (function(){
            var schemeCost  = num(cm.totalCost);     // build + fees + contingency + S106 + finance (+ infra)
            var targetProfit= num(cm.profit);        // developer's required profit at target margin
            var atAskProfit = consentedGdv - schemeCost - ask;   // profit if you pay the asking land price
            var atAskMargin = consentedGdv>0 ? (atAskProfit/consentedGdv)*100 : 0;
            var stacks = ask>0 ? atAskMargin>=15 : (consentedRlv>0);
            var verdictCol = stacks ? "#1d5446" : (atAskMargin>=10 ? "#9A7B3E" : "#B05A35");
            return e("div",{style:{marginBottom:14,padding:"14px 16px",background:"linear-gradient(135deg,#F8F9FC,#FBFCFF)",border:"1px solid #C5C8E0",borderRadius:8}},
              e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}},
                "Assuming planning is granted for "+assumedUnits+" homes — does it stack?"
              ),
              e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:10,lineHeight:1.5}},"Prove the scheme is profitable on a fully-consented basis first; the planning risk is the separate layer above (today's value & the scenarios)."),
              e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}},
                tile("Gross dev value (GDV)", fmt(consentedGdv), assumedUnits+" homes", "#2E2F8A"),
                tile("Build + all costs", fmt(schemeCost), "excl. land", "#B05A35"),
                tile("Developer profit", fmt(targetProfit), Math.round(num(cm.profitPctTarget))+"% target margin", "#4A4BAE"),
                tile("Max land (RLV)", fmt(consentedRlv), "to hit that margin", "#2D7A65", true)
              ),
              ask>0 && e("div",{style:{marginTop:10,padding:"10px 12px",borderRadius:6,background:stacks?"rgba(45,122,101,0.08)":"rgba(176,90,53,0.08)",borderLeft:"3px solid "+verdictCol}},
                e("div",{style:{fontSize:11,fontWeight:700,color:verdictCol,marginBottom:2}},
                  stacks ? "✓ Profitable even at the asking price" : (atAskMargin>=10 ? "⚠ Thin at the asking price" : "✗ Loss-making at the asking price")
                ),
                e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
                  "Pay the ",e("strong",null,fmt(ask))," ask and the consented scheme makes ",
                  e("strong",{style:{color:verdictCol}},(atAskProfit<0?"−":"")+fmt(Math.abs(atAskProfit))),
                  " profit — a ",e("strong",{style:{color:verdictCol}},Math.round(atAskMargin)+"% margin"),
                  stacks ? " (above the 15% viability floor)." : (atAskMargin>=10 ? " (below the 15% floor — push density, price or the land price down)." : " — the land price needs to come down to "+fmt(consentedRlv)+" or below to work.")
                )
              )
            );
          })(),

          // Deal-structure selector
          e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}},"How are you structuring the deal?"),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8,marginBottom:12}},
            Object.keys(STRUCTS).map(function(k){
              var sel = structure===k;
              return e("button",{key:k,onClick:function(){up("land","dealStructure",k);},
                style:{padding:"9px 12px",background:sel?"#2D7A65":"#fff",color:sel?"#fff":"#2E2F8A",border:"1px solid "+(sel?"#2D7A65":"#DDE0ED"),borderRadius:6,fontSize:11,fontWeight:sel?700:500,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
                STRUCTS[k].label);
            })
          ),

          // Structure parameter + explanation
          e("div",{style:{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12,marginBottom:14,alignItems:"start"}},
            e("div",null,
              e("label",{style:{fontSize:10,color:"#7278A0",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:3}},sInfo.shareLabel),
              e("div",{style:{display:"flex",alignItems:"center",gap:6}},
                e("input",{type:"number",min:0,max:100,step:1,value:l[sInfo.shareKey]!==undefined?l[sInfo.shareKey]:sInfo.shareDef,
                  onChange:function(ev){up("land",sInfo.shareKey,ev.target.value);},
                  style:{width:"100%",padding:"8px 10px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:14,fontFamily:"DM Mono,monospace",fontWeight:700}}),
                e("span",{style:{fontSize:13,color:"#7278A0",fontWeight:700}},"%")
              ),
              structure==="option" && e("div",{style:{marginTop:8}},
                e("label",{style:{fontSize:10,color:"#7278A0",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:3}},"Option fee (£/acre)"),
                e("input",{type:"number",min:0,step:500,value:l.optionFeePerAcre!==undefined?l.optionFeePerAcre:2000,
                  onChange:function(ev){up("land","optionFeePerAcre",ev.target.value);},
                  style:{width:"100%",padding:"6px 8px",border:"1px solid #DDE0ED",borderRadius:6,fontSize:12,fontFamily:"DM Mono,monospace"}})
              )
            ),
            e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.7,padding:"10px 12px",background:"#F7F8FC",borderRadius:6}},
              e("div",{style:{fontWeight:700,color:"#2E2F8A",marginBottom:4}},sInfo.label),
              structureExplain
            )
          ),

          // What changes hands
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}},
            tile("Pay now", payNow>0?fmt(payNow):"—", structure==="option"?"option fee":structure==="overage"?"agri-plus":"nothing up front", "#4A4BAE"),
            tile("Pay on consent", payOnConsent>0?fmt(payOnConsent):"—", structure==="promotion"?"landowner's net":structure==="overage"?"uplift share":"purchase price", "#9A7B3E"),
            tile("Total to landowner", fmt(landownerTotal), structure==="promotion"?"after "+sharePct+"% promoter fee":"across the deal", "#2D7A65", true)
          ),

          // Asking-price verdict
          ask>0 && e("div",{style:{padding:"14px 16px",borderRadius:8,background:askVsMax>0?"rgba(176,90,53,0.08)":"rgba(45,122,101,0.08)",border:"1px solid "+(askVsMax>0?"rgba(176,90,53,0.4)":"rgba(45,122,101,0.4)")}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:8}},
              e("div",{style:{fontWeight:800,fontSize:13,color:askVsMax>0?"#B05A35":"#1d5446"}},
                askVsMax>0 ? "⚠ Their ask is above your ceiling" : "✓ Their ask is within reach"
              ),
              e("div",{style:{fontSize:13,fontWeight:800,color:"#2E2F8A"}},"Ask "+fmt(ask)+" · fair offer "+fmt(landownerTotal))
            ),
            e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.7}},
              "Under a "+sInfo.label.toLowerCase()+", a fair total to the landowner is ",e("strong",null,fmt(landownerTotal)),". ",
              askGap>0
                ? e("span",null,"They're asking ",e("strong",{style:{color:"#B05A35"}},fmt(askGap))," more. ",
                    (homesToJustify>assumedUnits
                      ? e("span",null,"To make their "+fmt(ask)+" stack you'd need consent for roughly ",e("strong",null,"~"+homesToJustify+" homes")," (vs your "+assumedUnits+" assumed) — or bridge the gap with an ",e("strong",null,"overage clause")," so they share the upside if density/values come in higher.")
                      : e("span",null,"That's within striking distance — close it on density, a higher sale £/sqft, or a modest overage.")
                    )
                  )
                : e("span",null,"Their ask is ",e("strong",{style:{color:"#1d5446"}},fmt(-askGap))," below the fair offer — engage; verify there's no encumbrance or planning risk you've not priced.")
            )
          )
        );
      })(),

      city&&m&&e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Market Benchmarks — "+cityName(city)+(benchmarkIsFallback?" (using national average — see note)":"")),

        benchmarkIsFallback && e("div",{style:{padding:"10px 14px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:6,fontSize:11,color:"#B05A35",lineHeight:1.6,marginBottom:12}},
          e("strong",null,"⚠ Note on land value benchmark: "),
          "We don't have a specific land-value benchmark for "+cityName(city)+" yet. The figure shown is a UK-average fallback and should NOT be relied on. For accurate comparison: cross-reference Land Registry sold-prices for development sites in your specific postcode, or speak to a local agent. The figure is illustrative only."
        ),

        // Planning status awareness — explains the band logic
        e("div",{style:{padding:"12px 14px",background:planTier==="unknown"?"rgba(154,123,62,0.08)":"rgba(74,75,174,0.06)",border:"1px solid "+(planTier==="unknown"?"rgba(154,123,62,0.35)":"rgba(74,75,174,0.25)"),borderRadius:6,fontSize:11,lineHeight:1.6,marginBottom:14,color:"#2E2F8A"}},
          e("div",{style:{fontWeight:700,fontSize:10,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4,color:planTier==="unknown"?"#9A7B3E":"#4A4BAE"}},
            planTier==="unknown" ? "⚠ Planning status not set" : "📋 Planning context"
          ),
          e("div",{style:{color:planTier==="unknown"?"#7B6432":"#3A3D6A"}},
            e("strong",null,tierInfo.label),
            " · Site size: ",e("strong",null,siteAcres.toFixed(1)+" acres"),
            planTier==="unknown" ? " · Land values vary 5-10× depending on planning. Set the Planning Status field below or in Planning & Viability for a sharper benchmark." : null
          )
        ),

        // Three-tile band display
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}},
          [
            {tone:"low",label:"Low end of range",total:totalLo,perAcre:perAcreLo,sub:planTier==="unknown"?"if speculative":"conservative"},
            {tone:"mid",label:"Mid-point benchmark",total:totalMid,perAcre:perAcreMid,sub:planTier==="unknown"?"planning unknown":"typical"},
            {tone:"high",label:"High end of range",total:totalHi,perAcre:perAcreHi,sub:planTier==="unknown"?"if full planning":"premium / consented"}
          ].map(function(b){
            return e("div",{key:b.label,style:{background:b.tone==="mid"?"linear-gradient(135deg,#F0F1FA,#E4E4F4)":"#fff",border:"1px solid "+(b.tone==="mid"?"#4A4BAE":"#DDE0ED"),borderRadius:8,padding:12}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}},b.label),
              e("div",{style:{fontSize:18,fontWeight:700,color:"#2E2F8A",lineHeight:1.1}},fmt(b.total)),
              e("div",{style:{fontSize:10,color:"#4A4BAE",fontWeight:600,marginTop:3}},"£"+Math.round(b.perAcre).toLocaleString()+"/acre"),
              e("div",{style:{fontSize:9,color:"#7278A0",fontStyle:"italic",marginTop:2}},b.sub)
            );
          })
        ),

        // Asking price assessment relative to range
        askingPrice>0 && e("div",{style:{padding:"10px 14px",background:askingStatus==="within_range"?"rgba(45,122,101,0.08)":askingStatus==="above_range"?"rgba(176,90,53,0.08)":"rgba(74,75,174,0.06)",border:"1px solid "+(askingStatus==="within_range"?"rgba(45,122,101,0.35)":askingStatus==="above_range"?"rgba(176,90,53,0.35)":"rgba(74,75,174,0.25)"),borderRadius:6,fontSize:11,lineHeight:1.6,marginBottom:6}},
          e("div",{style:{fontWeight:700,fontSize:13,marginBottom:4,color:askingStatus==="within_range"?"#1d5446":askingStatus==="above_range"?"#B05A35":"#3A3D6A"}},
            askingStatus==="within_range" ? "✓ Asking price within market range" :
            askingStatus==="above_range" ? "⚠ Asking price above range" :
            askingStatus==="below_range" ? "ℹ Asking price below range" : ""
          ),
          e("div",{style:{color:"#3A3D6A"}},
            "Asking: ",e("strong",null,fmt(askingPrice))," (",e("strong",null,"£"+Math.round(askingPrice/siteAcres).toLocaleString()+"/acre"),")",
            askingStatus==="above_range" ? " · "+Math.round((askingPrice/totalHi-1)*100)+"% above the top of the band for this planning tier. " :
            askingStatus==="below_range" ? " · "+Math.round((1-askingPrice/totalLo)*100)+"% below the bottom of the band — potential opportunity, verify it's not distressed/encumbered. " :
            askingStatus==="within_range" ? " · Sits naturally within the expected range for this planning tier. " : "",
            planTier==="unknown" && askingStatus!=="unknown" ? "However: planning status is unknown, which changes everything. Confirm planning before drawing conclusions." : ""
          )
        ),

        // BTR rent / yield secondary metrics (unchanged from before)
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:8}},
          [{l:at==="pbsa"?"PBSA Rent/wk":"BTR Rent/mo",v:at==="pbsa"?"£"+m.pbsa+"/wk":"£"+m.btr+"/mo",s:benchmarkIsFallback?"UK average":"Market average"},
           {l:"Exit Yield",v:pct(m.yield*100),s:"Institutional target"}].map(function(item){
            return e("div",{key:item.l,style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:12}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginBottom:5}},item.l),
              e("div",{style:{fontSize:16,fontWeight:700,color:"#4A4BAE",marginBottom:3}},item.v),
              e("div",{style:{fontSize:10,color:"#7278A0"}},item.s)
            );
          })
        )
      ),
      e(AIPanel,{user:user,up:up,stage:"land",data:data,persistKey:"land_analyse_site",label:"Analyse Site",
        prompt:buildHonestPrompt(data,"You are evaluating a "+at.toUpperCase()+" development site in "+cityName(city)+" for Cassidy Group (UK developer).\n\n"+
          "SITE FACTS (only treat as known what is stated; refuse to invent missing values):\n"+
          "- Location: "+cityName(city)+(l.postcode?", postcode "+l.postcode:"")+"\n"+
          "- Site size: "+(acresVal?acresVal+" acres":"NOT STATED")+"\n"+
          "- Asking price: "+(askingPrice>0?fmt(askingPrice)+" ("+(acresVal?"£"+Math.round(askingPrice/acresVal).toLocaleString()+"/acre":"acreage unknown so £/acre unknown")+")":"NOT STATED")+"\n"+
          "- Tenure: "+(l.tenure||"NOT STATED")+"\n"+
          "- Contamination: "+(l.contamination||"NOT STATED")+"\n"+
          "- Planning status: "+(planStatusRaw||"NOT STATED — this is critical, see warning below")+"\n"+
          "- Planning constraint: "+(l.constraint||"NOT STATED")+"\n"+
          "- Location score (Landform): "+score+"/100\n\n"+
          "LANDFORM'S ACREAGE & PLANNING-AWARE BENCHMARK (use these, not your own estimates):\n"+
          "- Planning tier classified as: "+tierInfo.label+"\n"+
          "- Per-acre range for this tier: £"+Math.round(perAcreLo).toLocaleString()+" (low) to £"+Math.round(perAcreHi).toLocaleString()+" (high), midpoint £"+Math.round(perAcreMid).toLocaleString()+"\n"+
          "- Total site value range at "+siteAcres.toFixed(1)+" acres: "+fmt(totalLo)+" to "+fmt(totalHi)+", midpoint "+fmt(totalMid)+"\n"+
          "- Asking vs range: "+(askingStatus==="within_range"?"WITHIN the band — reasonable":askingStatus==="above_range"?"ABOVE the band by "+Math.round((askingPrice/totalHi-1)*100)+"%":askingStatus==="below_range"?"BELOW the band by "+Math.round((1-askingPrice/totalLo)*100)+"%":"asking price not stated")+"\n\n"+
          "CRITICAL GROUNDING RULES:\n"+
          "1. DO NOT invent unit counts, GDV figures, build cost totals, or RLV — none of these have been entered yet.\n"+
          "2. IF planning status is NOT STATED, your top recommendation must be 'confirm planning status before further analysis' — DO NOT issue a confident no-go or go.\n"+
          "3. Compare asking price to the £/acre range above, NOT to a single midpoint. The range is wide on purpose.\n"+
          "4. If the asking sits within the band given the planning tier, that is NOT a red flag. State so plainly.\n"+
          "5. Use specific UK figures from BCIS / Land Registry / industry sources only where they are genuinely known UK norms. Do not fabricate."+(acresVal?"":"\n6. The site acreage is unknown — flag this as a top DD priority before any value-per-acre discussion.")+"\n\n"+
          "Provide:\n"+
          "1. Strengths and red flags (only those supported by the facts stated above)\n"+
          "2. Land value vs market assessment (using the per-acre band, with planning tier as the key variable)\n"+
          "3. DD priorities in order (planning status first if unknown)\n"+
          "4. Go/No-Go with explicit conditions — and 'CANNOT DETERMINE without planning status' if that's the honest answer\n"+
          "5. Negotiation strategy framed in terms of the £/acre band and planning-contingent valuations\n"+
          "6. SCENARIOS (land-stage only — do NOT model build cost, GDV or RLV): give a BASE case, an UPSIDE case and a DOWNSIDE case for the LAND decision, each driven purely by land-level variables — planning certainty (consent confirmed vs lapsed/conditional/none), where an agreed price lands in the £/acre band, acreage confirmation, and acquisition structure (unconditional vs conditional/option/promotion). For each scenario state the implication for the entry price and the recommended deal structure. Keep every scenario about acquiring the land well — leave build economics to the financial-modelling stage.","land")}),

      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Local Plan Explorer"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14}},"Check your local council's housing allocations, brownfield register and strategic land availability. These show where the council is planning for new homes."),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}},
          [
            {label:"Planning Portal — Search Applications",url:"https://www.planningportal.co.uk/",desc:"Search live planning applications by postcode"},
            {label:"Planning Policy — National Framework",url:"https://www.gov.uk/guidance/national-planning-policy-framework",desc:"NPPF 2024 — the national rules all councils must follow"},
            {label:"Brownfield Land Register",url:"https://www.gov.uk/guidance/brownfield-land-registers",desc:"Every council must publish their brownfield register — sites available for housing"},
            {label:"Housing Delivery Test",url:"https://www.gov.uk/guidance/housing-delivery-test",desc:"See if your council is under-delivering on housing — creates planning pressure"},
            {label:"SHLAA / HELAA Guidance",url:"https://www.gov.uk/guidance/strategic-housing-land-availability-assessments",desc:"Strategic Housing Land Availability — how councils identify potential housing sites"},
            {label:"Local Plan Status (all councils)",url:"https://www.gov.uk/guidance/local-plans",desc:"Check if your council has an up-to-date Local Plan — affects planning outcomes"},
          ].map(function(link){
            return e("a",{key:link.label,href:link.url,target:"_blank",rel:"noopener noreferrer",
              style:{display:"block",background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"12px 14px",textDecoration:"none",transition:"all .15s"},
              onMouseOver:function(ev){ev.currentTarget.style.borderColor="#4A4BAE";},
              onMouseOut:function(ev){ev.currentTarget.style.borderColor="#DDE0ED";}
            },
              e("div",{style:{fontSize:12,fontWeight:700,color:"#4A4BAE",marginBottom:4}},link.label+" ↗"),
              e("div",{style:{fontSize:10,color:"#7278A0",lineHeight:1.5}},link.desc)
            );
          })
        ),
        city&&e("div",{style:{background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.15)",borderRadius:8,padding:"12px 14px"}},
          e("div",{style:{fontSize:11,fontWeight:700,color:"#2E2F8A",marginBottom:8}},"Search for "+cityName(city)+" Local Plan:"),
          e("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
            [
              {label:"Google: "+cityName(city)+" Local Plan",url:"https://www.google.com/search?q="+encodeURIComponent(cityName(city)+" council local plan housing allocations 2024")},
              {label:"Google: "+cityName(city)+" Brownfield Register",url:"https://www.google.com/search?q="+encodeURIComponent(cityName(city)+" brownfield land register")},
              {label:"Google: "+cityName(city)+" SHLAA",url:"https://www.google.com/search?q="+encodeURIComponent(cityName(city)+" SHLAA HELAA housing land availability")},
            ].map(function(link){
              return e("a",{key:link.label,href:link.url,target:"_blank",rel:"noopener noreferrer",
                style:{padding:"6px 12px",background:"#4A4BAE",color:"#fff",borderRadius:5,fontSize:11,fontWeight:600,textDecoration:"none",display:"inline-block"}
              },link.label+" ↗");
            })
          ),
          e("div",{style:{fontSize:10,color:"#7278A0",marginTop:8}},"These open Google searches for "+cityName(city)+"'s specific planning documents. Look for the council's planning pages for official documents.")
        ),
        e(AIPanel,{user:user,up:up,stage:"land",data:data,persistKey:"land_local_plan_analysis_",label:"Local Plan Analysis for "+cityName(city),
          prompt:buildHonestPrompt(data,"Provide a local planning analysis for "+cityName(city)+". Include: 1) Is there an up-to-date Local Plan and when was it adopted? 2) What are the main housing allocation areas? 3) Is the council meeting its housing delivery targets? 4) What is the brownfield/greenfield split in recent permissions? 5) Key planning policies that affect "+at.toUpperCase()+" development in this area. 6) Any Article 4 directions or HMO restrictions relevant to "+at.toUpperCase()+"? 7) Typical S106 contributions and CIL rates if known.")})
      )
    );
  }
