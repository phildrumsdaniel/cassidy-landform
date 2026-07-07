// ── renderDataRoom  (params: city, data, exits, isExitOn, schemes, up)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderDataRoom(city, data, exits, isExitOn, schemes, up){
    var l=data.land||{}; var p=data.planning||{}; var f=data.fin||{};
    var rlvD=data.rlv||{}; var dd=data.dd||{}; var cc=data.constraint||{};
    // v10.3 — the Constraint Check stage stores its output under
    // data.constraintCheck.results ({report,score,verdict,site,date}); the Data
    // Room was reading data.constraint.result (never populated) so §02.4 showed
    // MISSING / "None identified" even after a live CAUTION assessment.
    var ccr=(data.constraintCheck&&data.constraintCheck.results)||{};
    // v10.3 — the Risk Register screen shows RISK_DEFAULTS (6 rows) until the user
    // edits one, at which point it saves to data.risks. Mirror that fallback here so
    // §09.1 reports the same live count instead of "0 items" / MISSING.
    var risks=(Array.isArray(data.risks)&&data.risks.length>0)?data.risks
              :(typeof RISK_DEFAULTS!=="undefined"?RISK_DEFAULTS:[]);
    var mkt=data.market||{};
    var dr=data.dataroom||{};
    var sfh=data.sfh||{}; var hra=data.hra||{}; var cap=data.capitalise||{};
    var crm=data.crm||{}; var intel=data.intel||{};

    // ── Audience toggle — drives EVERYTHING from this point on ──────────
    var audience=dr.audience||"internal";    // "internal" | "external"
    var isInternal=audience==="internal";
    var isExternal=audience==="external";
    var viewMode=dr.viewMode||"screen";       // "screen" | "print"

    // ── Active scheme detection ─────────────────────────────────────────
    var isLand    = schemes.indexOf("land")>=0;
    var isSfh     = schemes.indexOf("sfh")>=0;
    var isBtr     = schemes.indexOf("btr")>=0;
    var isPbsa    = schemes.indexOf("pbsa")>=0;
    var isProp    = schemes.indexOf("property")>=0;
    var anyBuild  = isSfh||isBtr||isPbsa||isProp;
    var anyInstitutional = isExitOn("pension")||isExitOn("sovereign")||isExitOn("btr_op")||isExitOn("family")||isExitOn("ha_rp")||isExitOn("homes_eng")||isExitOn("bank_takeout");

    // ── Headline figures (internal sees real values, external sees ranges) ─
    var addr=l.address||"Unnamed site";
    var pcCity=cityName(city||l.city||"");
    var acres=num(l.acres||0);
    var units=num(p.units||rlvD.units||0);
    var planStatus=p.status||l.planningStatus||"Unallocated";
    var lpa=p.lpa||l.localAuthority||"TBC";
    var ask=num(l.price||0);
    // v10.2 — pull GDV / RLV / S106 from the one engine, not input fields the engine
    // never fills (data.fin.gdv / data.rlv.rlv were blank → the Data Room showed GDV £0,
    // RLV £0 "MISSING", and an £8k/unit S106 default that ignored the propagated figure).
    var DMd=(typeof calcDealMetrics==="function")?calcDealMetrics(data):{};
    var gdvVal=num(DMd.gdv)||num(f.gdv||0);
    var rlvVal=num(DMd.rlv)||num(rlvD.rlv||f.rlv||0);
    var profitPct=isFinite(DMd.marginPct)&&num(DMd.marginPct)?num(DMd.marginPct):num(f.marginPct||17.5);
    var s106=num(DMd.s106)||num(p.s106)||(units*numOr(p.s106pu||f.s106pu,8000))||0;

    // ── CURATION ENGINE — security-first ────────────────────────────────
    // Every field in the data room has a sensitivity classification:
    //   "public"            → always shown
    //   "internal-only"     → stripped entirely from external view (not just hidden)
    //   "redacted-external" → shown to external with redacted/rounded value
    //   "reworded-external" → shown to external with softer language
    function curate(field){
      // field = {value, sensitivity, externalValue, externalLabel}
      if(isInternal) return field.value;
      if(field.sensitivity==="internal-only") return null;  // STRIP entirely
      if(field.sensitivity==="redacted-external") return field.externalValue||"Available on request";
      if(field.sensitivity==="reworded-external") return field.externalValue||field.value;
      return field.value;
    }

    // Format money for external: round to thousands, show ranges for sensitive figures
    function fmtRange(val,bandPct){
      if(!val||val===0) return "TBC";
      var b=bandPct||0.05;
      var lo=Math.round(val*(1-b)/1000000*10)/10;
      var hi=Math.round(val*(1+b)/1000000*10)/10;
      return "£"+lo+"m – £"+hi+"m";
    }

    function fmtRounded(val){
      if(!val||val===0) return "TBC";
      if(val>=1000000) return "£"+(Math.round(val/100000)/10)+"m";
      if(val>=1000) return "£"+Math.round(val/1000)+"k";
      return "£"+val;
    }

    // ── Risk rewording: internal honesty → external mitigation language ──
    function rewordRisk(text){
      if(!text) return "";
      if(isInternal) return text;
      var t=text.toLowerCase();
      // Translate common honest internal language to controlled external wording
      var rules=[
        [/may not work|won't work|going to fail|destroy viability|kills the deal/g, "subject to mitigation strategy"],
        [/officer hates|officer disagrees|officer against/g, "ongoing dialogue with planning authority"],
        [/likely understated|optimistic|wishful thinking/g, "subject to detailed costing"],
        [/struggling with funding|funding gap|cant fund|can't find money/g, "finance structure under review"],
        [/internal panic|disaster|catastroph/g, "actively managed"],
        [/disputes? with|fall(en|ing) out|argument with/g, "subject to commercial discussion with"],
        [/bat problem|protected species risk|ecology disaster/g, "ecological assessment in progress"],
        [/refused|rejected/g, "subject to further assessment"],
        [/expensive remediation|cant afford to remediate/g, "remediation strategy being developed"]
      ];
      var out=text;
      for(var i=0;i<rules.length;i++) out=out.replace(rules[i][0],rules[i][1]);
      return out;
    }

    // ── Status helpers ──────────────────────────────────────────────────
    function statusOf(criteria){
      var reqMet=0, reqTotal=criteria.req?criteria.req.length:0;
      (criteria.req||[]).forEach(function(v){ if(v&&v!==""&&v!=="0"&&v!==0)reqMet++; });
      if(reqTotal===0)return {pill:"empty",label:"NEW",col:"#7278A0",bg:"#F0F1FA",pct:0};
      var pct=Math.round(reqMet/reqTotal*100);
      if(pct===100)return {pill:"complete",label:"✓ COMPLETE",col:"#2D7A65",bg:"rgba(45,122,101,0.1)",pct:100};
      if(pct>=50) return {pill:"partial",label:"⚠ PARTIAL "+pct+"%",col:"#9A7B3E",bg:"rgba(154,123,62,0.1)",pct:pct};
      return {pill:"missing",label:"✗ MISSING",col:"#B05A35",bg:"rgba(176,90,53,0.1)",pct:pct};
    }

    // ── Build sections ──────────────────────────────────────────────────
    // Each section: { code, title, group, status, fields:[{label,value,sensitivity?,externalValue?}], uploads:[], internalOnly?:bool }
    var sections=[];

    // ─────────── PUBLIC SECTIONS (visible to all audiences) ──────────────

    sections.push({code:"01.1", title:"Site Identification", group:"Land & Ownership",
      status: statusOf({req:[addr,l.postcode,acres,pcCity]}),
      fields: [
        {label:"Address", value:addr},
        {label:"Postcode", value:l.postcode||"—"},
        {label:"City / Market", value:pcCity||"—"},
        {label:"County", value:l.county||"—"},
        {label:"Site Area", value:acres>0?acres+" acres ("+(acres*0.404686).toFixed(2)+" ha)":"—"},
        {label:"Local Authority", value:lpa},
        {label:"Site description", value:l.description||l.streetAddress||"—"}
      ],
      uploads:["Site plan (Title Plan)","HM Land Registry title extract","Site location map"]
    });

    sections.push({code:"01.2", title:"Tenure & Title", group:"Land & Ownership",
      status: statusOf({req:[l.tenure]}),
      fields: [
        {label:"Tenure", value:l.tenure==="freehold"?"Freehold":l.tenure==="long_leasehold"?"Long Leasehold":l.tenure==="short_leasehold"?"Short Leasehold":"To confirm"},
        {label:"Owner type", value:l.ownerType||"To confirm"},
        {label:"Restrictions / Easements", value:"To confirm from title"},
        {label:"Ransom strips", value:"To confirm during DD"},
        // Overage exposure — INTERNAL ONLY
        {label:"Overage arrangements", value:l.overage||"None known",
         sensitivity:"internal-only"},
      ],
      uploads:["Title deeds (HMLR)","Office copies","Land charges search","Local authority search"]
    });

    sections.push({code:"01.3", title:"Acquisition Structure", group:"Land & Ownership",
      status: statusOf({req:[ask]}),
      fields: [
        // Asking price — public for external, but internal shows real negotiation state
        {label:"Asking price (vendor)", value:ask>0?fmt(ask):"To confirm"},
        {label:"Acquisition route", value:l.dealType||"To negotiate"},
        {label:"Agent / Vendor contact", value:l.agent||"—",
         sensitivity:"internal-only"},
        {label:"Source URL", value:l.sourceUrl||"—",
         sensitivity:"internal-only"}
      ],
      uploads:["Heads of Terms","Option agreement (if applicable)","Promotion agreement (if applicable)"]
    });

    // ─────────── PLANNING ───────────────────────────────────────────────
    sections.push({code:"02.1", title:"Planning Status", group:"Planning",
      status: statusOf({req:[planStatus,lpa,units]}),
      fields: [
        {label:"Planning status", value:planStatus},
        {label:"Local Planning Authority", value:lpa},
        {label:"Proposed units", value:units>0?units+" homes":"—"},
        {label:"Storeys", value:p.storeys||"—"},
        {label:"Density (DPH)", value:acres>0&&units>0?Math.round(units/(acres*0.404686))+" dph":"—"},
        // Planning risk — reworded for external
        {label:"Planning risk assessment",
         value:p.riskLevel?"Internal: "+p.riskLevel+(intel.officerSentiment?" · Officer sentiment: "+intel.officerSentiment:""):"To assess",
         externalValue:p.riskLevel?"Active planning strategy in place":"To assess",
         sensitivity:"reworded-external"},
        {label:"5YHLS position", value:lpa?"Check LPA's current 5YHLS — tilted balance applies if <5yrs":"—"}
      ],
      uploads:["Pre-app advice letter","Planning permissions","Officer reports","Committee minutes"]
    });

    sections.push({code:"02.2", title:"S106 / CIL Obligations", group:"Planning",
      status: statusOf({req:[p.ahPct,p.s106]}),
      fields: [
        {label:"Affordable Housing %", value:p.ahPct?p.ahPct+"%":"To negotiate (LPA policy typically 25-40%)"},
        // S106 estimate: internal sees exact, external sees rounded range
        {label:"S106 estimate (total)",
         value:fmt(s106),
         externalValue:s106>0?fmtRange(s106,0.15):"TBC subject to negotiation",
         sensitivity:"redacted-external"},
        {label:"S106 per unit", value:units>0?fmt(s106/units):"—"},
        {label:"CIL liability", value:"To confirm with LPA"},
        // Internal negotiation strategy
        {label:"Internal negotiation strategy",
         value:intel.s106Strategy||"Target reduction of 15-20% via viability challenge if needed",
         sensitivity:"internal-only"}
      ],
      uploads:["Draft Section 106 Agreement","S106 viability assessment","CIL liability notice"]
    });

    sections.push({code:"02.3", title:"Planning Policy Compliance", group:"Planning",
      status: statusOf({req:[p.bng]}),
      fields: [
        {label:"NPPF 2024", value:"Compliance to confirm"},
        {label:"Local Plan allocation", value:planStatus.toLowerCase().indexOf("allocat")>=0?"Allocated ✓":"To assess"},
        {label:"BNG (10% mandatory)", value:p.bng||"To assess"},
        {label:"Fire Safety Gateway 2/3", value:p.gateway||(num(p.storeys)>=7?"Required (≥7 storeys)":"Not applicable")},
        {label:"Neighbourhood Plan", value:"To assess"},
        {label:"Conservation areas", value:(ccr.report||cc.result)?/conservation area/i.test(ccr.report||cc.result)?"Affected":"Clear":"To assess"}
      ],
      uploads:["Design & Access Statement","Planning Statement","BNG metric calculations"]
    });

    // v10.3 — surface the live AI Constraint Check result (verdict/score/report)
    // alongside the Land Appraisal dropdowns, via the shared reader.
    var ccVerdict=(typeof constraintVerdict==="function")?constraintVerdict(data):(ccr.verdict||"").toUpperCase();
    var ccVerdictLabel=ccVerdict==="GO"?"GO — proceed":ccVerdict==="CAUTION"?"CAUTION — constraints present":ccVerdict==="AVOID"?"AVOID — major constraints":"";
    sections.push({code:"02.4", title:"Constraint Check", group:"Planning",
      status: statusOf({req:[ccr.verdict||ccr.report||cc.result||l.constraintSummary]}),
      fields: [
        {label:"AI constraint verdict",
         value:ccVerdictLabel||"Run Constraint Check stage",
         externalValue:ccVerdict?"Constraint assessment completed":"In progress",
         sensitivity:"reworded-external"},
        {label:"Planning probability score", value:num(ccr.score)>0?ccr.score+"/100":"—"},
        {label:"Planning constraints", value:l.constraint==="major"?"Major":l.constraint==="moderate"?"Moderate":l.constraint==="minor"?"Minor":l.constraint==="none"?"None identified":"To assess"},
        {label:"Ground contamination", value:l.contamination==="major"?"Major":l.contamination==="minor"?"Minor":l.contamination==="clean"?"Clean":"To investigate"},
        {label:"Transport connectivity", value:l.transport==="excellent"?"Excellent":l.transport==="good"?"Good":l.transport==="fair"?"Fair":l.transport==="poor"?"Poor":"—"},
        // Constraint summary — reworded for external
        {label:"AI constraint summary",
         value:rewordRisk(ccr.report||l.constraintSummary||cc.result||"Run Constraint Check stage for detail"),
         externalValue:ccr.report||l.constraintSummary?"Detailed constraint assessment available on request":"Assessment in progress",
         sensitivity:"reworded-external"}
      ],
      uploads:["Constraint mapping report","Heritage assessment","Tree survey"]
    });

    // ─────────── TECHNICAL ──────────────────────────────────────────────
    sections.push({code:"03.1", title:"Ground & Contamination", group:"Technical",
      status: statusOf({req:[l.contamination]}),
      fields: [
        {label:"Phase 1 Desk Study", value:"To commission"},
        {label:"Phase 2 Intrusive Investigation", value:"To commission post-Phase 1"},
        {label:"Contamination level", value:l.contamination||"Unknown"},
        // Remediation estimate — INTERNAL ONLY (don't expose downside)
        {label:"Remediation estimate (internal worst case)",
         value:intel.remediationEstimate||"TBC — typically £50k-£5m depending on history",
         sensitivity:"internal-only"},
        // External version
        {label:"Remediation strategy",
         value:"Phased approach subject to Phase 1/2 findings",
         externalValue:"Phased remediation approach in place",
         sensitivity:"reworded-external"}
      ],
      uploads:["Phase 1 Geo-environmental report","Phase 2 GIR (BS5930)","Coal Authority report","Remediation strategy"]
    });

    sections.push({code:"03.2", title:"Ecology & Environment", group:"Technical",
      status: statusOf({req:[]}),
      fields: [
        {label:"Ecological survey required", value:"Yes — pre-application standard"},
        {label:"BNG baseline measurement", value:"Required — 10% net gain mandatory"},
        {label:"Protected species", value:"To survey (bats, GCN, badgers, dormice)"},
        {label:"Designated sites", value:"To assess SSSI/AONB/Ramsar within 2km"},
        {label:"TPOs / Ancient woodland", value:"To check"}
      ],
      uploads:["Preliminary Ecological Appraisal","BNG metric calculation","Protected species surveys"]
    });

    sections.push({code:"03.3", title:"Utilities & Infrastructure", group:"Technical",
      status: statusOf({req:[]}),
      fields: [
        {label:"Water supply", value:"Capacity check required"},
        {label:"Foul drainage", value:"Capacity check + connection design"},
        {label:"Surface water", value:"SuDS strategy required (NPPF Para 167)"},
        {label:"Electricity", value:"Substation assessment — kVA demand vs grid capacity"},
        {label:"Gas", value:"Check network availability or all-electric strategy"},
        {label:"Telecoms (fibre)", value:"Openreach FTTP standard"}
      ],
      uploads:["Utility capacity studies","Substation proposal","Drainage strategy","SuDS Maintenance Plan"]
    });

    sections.push({code:"03.4", title:"Flood Risk & Drainage", group:"Technical",
      status: statusOf({req:[]}),
      fields: [
        {label:"Flood zone", value:"Check EA flood map by postcode"},
        {label:"FRA required", value:"Yes if Zone 2/3 or >1ha"},
        {label:"Surface water drainage", value:"SuDS required — discharge rates restricted"},
        {label:"Sequential test", value:"Required if Zone 2 or 3"}
      ],
      uploads:["Flood Risk Assessment","Drainage Strategy","Sequential Test"]
    });

    sections.push({code:"03.5", title:"Transport & Highways", group:"Technical",
      status: statusOf({req:[]}),
      fields: [
        {label:"Site access", value:"Design required"},
        {label:"Trip generation", value:units>0?"Modelling required — ~6 trips/dwelling/day standard":"—"},
        {label:"Walking distance to amenities", value:l.proximity==="excellent"?"Excellent (<400m)":l.proximity==="good"?"Good (400-800m)":l.proximity==="fair"?"Fair (800-1.6km)":l.proximity==="poor"?"Poor (>1.6km)":"—"},
        {label:"Public transport", value:l.transport||"—"},
        {label:"Parking strategy", value:"LPA policy compliance check"}
      ],
      uploads:["Transport Assessment","Travel Plan","Highways visibility splays"]
    });

    // ─────────── FINANCIAL — major curation differences ─────────────────
    sections.push({code:"04.1", title:"Development Appraisal Summary", group:"Financial",
      status: statusOf({req:[gdvVal,rlvVal,profitPct]}),
      fields: [
        // GDV — public, exact figure
        {label:"GDV (Gross Development Value)", value:fmt(gdvVal)},
        // Build cost — public, exact
        {label:"Total build cost", value:num(f.totalCost||0)>0?fmt(f.totalCost):"Run Financial Modelling"},
        // Land value — external sees range only (don't expose negotiating position)
        {label:"Residual Land Value (RLV)",
         value:fmt(rlvVal),
         externalValue:rlvVal>0?fmtRange(rlvVal,0.08):"TBC",
         sensitivity:"redacted-external"},
        // Profit margin — external sees market-standard rounded
        {label:"Developer profit margin",
         value:pct(profitPct),
         externalValue:profitPct<15?"15.0%":profitPct>22?"20.0%":pct(Math.round(profitPct)),
         sensitivity:"redacted-external"},
        // Return on Cost — external sees IRR-style language
        {label:"Return on Cost (RoC)",
         value:num(f.roc||0)>0?pct(num(f.roc)):"—",
         externalValue:num(f.roc||0)>0?"Targeting institutional hurdle returns":"—",
         sensitivity:"reworded-external"},
        // Headroom over ask — INTERNAL ONLY (this is the negotiation lever)
        {label:"Headroom over asking price (negotiation buffer)",
         value:rlvVal>0&&ask>0?fmt(rlvVal-ask):"—",
         sensitivity:"internal-only"},
        // True minimum land price — INTERNAL ONLY (the walk-away figure)
        {label:"Internal minimum land price (walk-away)",
         value:intel.minLandPrice||(rlvVal>0?fmt(rlvVal*0.85):"To calculate — typically RLV × 0.85"),
         sensitivity:"internal-only"},
      ],
      uploads:["RICS Red Book valuation","Cost plan (QS)","Bank pre-funding pack","Audited financial model (Excel)"]
    });

    sections.push({code:"04.2", title:"Cashflow & Programme", group:"Financial",
      status: statusOf({req:[f.programmeMths]}),
      fields: [
        {label:"Programme length", value:f.programmeMths?f.programmeMths+" months":"—"},
        {label:"Start on site (from today)", value:"TBC — planning + pre-commencement dependent"},
        {label:"Build rate", value:units>0&&f.programmeMths?Math.round(units/num(f.programmeMths))+" units/month":"—"},
        {label:"Sales rate", value:f.salesRateWeek?f.salesRateWeek+" plots/week":"—"},
        {label:"Stabilisation (BTR/PBSA)", value:isBtr||isPbsa?"~12 months post-PC":"N/A"}
      ],
      uploads:["Phased cashflow (Excel)","Construction programme","Sales velocity model","Drawdown schedule"]
    });

    sections.push({code:"04.3", title:"Sensitivity & Scenarios", group:"Financial",
      status: statusOf({req:[]}),
      fields: [
        // Bear case — wording softened for external
        {label:"Bear case (downside scenario)",
         value:"GDV -10% / costs +15% — full pressure test in Financial Modelling",
         externalValue:"Downside scenarios tested and modelled",
         sensitivity:"reworded-external"},
        {label:"Base case", value:"Current appraisal assumptions"},
        {label:"Bull case (upside)",
         value:"GDV +8% / costs -5%",
         externalValue:"Upside potential identified",
         sensitivity:"reworded-external"},
        {label:"Sensitivity to sale £/sqft", value:"±5% test"},
        {label:"Sensitivity to build £/sqft", value:"±10% test"},
        {label:"Sensitivity to exit yield", value:"±25 bps test"}
      ],
      uploads:["Sensitivity matrix (Excel)","Monte Carlo simulation (if commissioned)"]
    });

    if(anyInstitutional||isBtr||isPbsa){
      sections.push({code:"04.4", title:"Capitalisation & Investment Value", group:"Financial",
        status: statusOf({req:[cap.targetYield]}),
        fields: [
          {label:"Target exit yield", value:cap.targetYield?pct(num(cap.targetYield)):"4.5% (institutional benchmark)"},
          {label:"Capitalised value", value:"Run Capitalisation stage for detail"},
          {label:"NOI (year 1)", value:"Run Capitalisation"},
          {label:"Forward funding stack", value:"See Capitalisation → Forward Funding"},
          {label:"Buyer types modelled", value:"Pension Fund, Sovereign WF, BTR Operator, Family Office, Private"}
        ],
        uploads:["Capitalisation model (Excel)","Operating budget","OpEx schedule","Letting strategy"]
      });
    }

    // ─────────── LEGAL ──────────────────────────────────────────────────
    sections.push({code:"05.1", title:"Legal Title & Searches", group:"Legal",
      status: statusOf({req:[]}),
      fields: [
        {label:"Title number", value:"From HMLR"},
        {label:"Title plan", value:"To request"},
        {label:"Local authority search", value:"To order at offer"},
        {label:"Drainage & water search", value:"To order at offer"},
        {label:"Environmental search", value:"To order at offer"},
        {label:"Mining search", value:"Where applicable"}
      ],
      uploads:["Office copies (HMLR)","Title plan","Local authority search results","CON29 Drainage & Water"]
    });

    sections.push({code:"05.2", title:"Insurance & Warranties", group:"Legal",
      status: statusOf({req:[]}),
      fields: [
        {label:"Title indemnity", value:"If required"},
        {label:"Environmental insurance", value:"Recommend for brownfield"},
        {label:"Construction All-Risks", value:"Required during build"},
        {label:"10-year structural warranty", value:"NHBC / Premier Guarantee / LABC"},
        {label:"Professional Indemnity", value:"Required from consultants"}
      ],
      uploads:["Insurance schedules","Warranty certificates","PI insurance certificates","Collateral warranties"]
    });

    // ─────────── CONSTRUCTION ───────────────────────────────────────────
    if(anyBuild){
      sections.push({code:"06.1", title:"Construction Procurement", group:"Construction",
        status: statusOf({req:[]}),
        fields: [
          {label:"Procurement route", value:"JCT D&B / Construction Mgmt / Traditional — to decide"},
          {label:"Form of contract", value:"JCT Design & Build 2016 (typical)"},
          {label:"Main contractor", value:"Tender pack stage"},
          {label:"Programme", value:"Pre-tender programme to issue"},
          {label:"Contingency", value:"5% on build cost minimum"},
          // Contractor disputes — INTERNAL ONLY
          {label:"Contractor relationship history",
           value:crm.contractorHistory||"No prior issues recorded",
           sensitivity:"internal-only"}
        ],
        uploads:["Tender document pack","Bills of Quantities","Contractor PQQ responses","JCT contract draft"]
      });

      sections.push({code:"06.2", title:"Design Team Appointments", group:"Construction",
        status: statusOf({req:[]}),
        fields: [
          {label:"Architect", value:"Appointment letter required"},
          {label:"Structural Engineer", value:"Required pre-tender"},
          {label:"MEP Engineer", value:"Required pre-tender"},
          {label:"Quantity Surveyor", value:"Required"},
          {label:"Project Manager", value:"Internal or external"},
          {label:"Principal Designer (CDM)", value:"Required by CDM Regs 2015"},
          // Consultant performance — INTERNAL ONLY
          {label:"Consultant performance notes",
           value:crm.consultantNotes||"No notes recorded",
           sensitivity:"internal-only"}
        ],
        uploads:["Architect appointment","SE appointment","MEP appointment","QS appointment","CDM PD appointment"]
      });

      if(isBtr||isPbsa||(p.storeys&&num(p.storeys)>=7)){
        sections.push({code:"06.3", title:"Building Safety Act 2022 Compliance", group:"Construction",
          status: statusOf({req:[p.gateway]}),
          fields: [
            {label:"Higher Risk Building?", value:num(p.storeys)>=7?"Yes (≥7 storeys / ≥18m)":"To confirm"},
            {label:"Gateway 2 (BSR approval)", value:"Required pre-construction"},
            {label:"Gateway 3 (BSR completion)", value:"Required pre-occupation"},
            {label:"Golden Thread (info management)", value:"Required throughout"},
            {label:"EWS1 form (external wall)", value:"Required at handover"},
            {label:"Sprinklers", value:num(p.storeys)>=4?"Required (≥11m in Eng.)":"Not mandatory"}
          ],
          uploads:["Gateway 2 application","Fire Strategy","Structural design statement","Materials specification"]
        });
      }
    }

    // ─────────── SALES / LEASING ────────────────────────────────────────
    if(isSfh||isProp){
      sections.push({code:"07.1", title:"Sales Strategy (SFH)", group:"Sales & Leasing",
        status: statusOf({req:[sfh.basePsf]}),
        fields: [
          {label:"Sale £/sqft", value:sfh.basePsf?"£"+sfh.basePsf+"/sqft":"—"},
          {label:"Land Registry comparable PSF", value:mkt.lrPsf?"£"+mkt.lrPsf+"/sqft ("+(mkt.lrTotalTx||0)+" sales)":"Run Live LR query"},
          {label:"Sales rate", value:f.salesRateWeek?f.salesRateWeek+" plots/week":"0.5-1.0 typical"},
          {label:"Show home strategy", value:"Required — allow £150-300k"},
          {label:"Help to Buy / shared equity", value:"To configure"},
          {label:"Agent appointment", value:"1.0-1.5% fee standard"}
        ],
        uploads:["Selling agent appointment","Comparable evidence pack","Show home spec","Price list"]
      });
    }

    if(isBtr||isPbsa){
      sections.push({code:"07.1", title:"Operating Strategy (BTR/PBSA)", group:"Sales & Leasing",
        status: statusOf({req:[hra.oPsf||hra.sPsf]}),
        fields: [
          {label:"Operator", value:"To appoint"},
          {label:"Studio rent £/sqft", value:hra.sPsf?"£"+hra.sPsf+"/sqft":"—"},
          {label:"1-bed rent £/sqft", value:hra.oPsf?"£"+hra.oPsf+"/sqft":"—"},
          {label:"2-bed rent £/sqft", value:hra.tPsf?"£"+hra.tPsf+"/sqft":"—"},
          {label:"Target occupancy", value:"97% stabilised (institutional std)"},
          {label:"Stabilisation period", value:"12 months post-PC"},
          {label:"OpEx", value:"~25-30% of gross rent"}
        ],
        uploads:["Operator appointment","Market rental evidence","OpEx budget","Leasing strategy"]
      });
    }

    sections.push({code:"07.2", title:"Market Analysis & Comparables", group:"Sales & Leasing",
      status: statusOf({req:[]}),
      fields: [
        {label:"Market position", value:pcCity+" — see Market Benchmarks"},
        {label:"Recent transactions", value:mkt.lrPsf?"Land Registry: "+(mkt.lrTotalTx||0)+" sales in "+(mkt.lrSector||"area"):"Run Live LR query"},
        {label:"Demand drivers", value:isSfh?"Owner-occupiers, FTBs":isBtr?"Young professionals, key workers":isPbsa?"University students":"To assess"},
        {label:"Competitor schemes", value:"To research — typically 3-5km radius"},
        {label:"Demographic trend", value:"ONS data + LPA Housing Needs"}
      ],
      uploads:["Savills/Knight Frank market report","Local agent reports","Demographic analysis"]
    });

    // ─────────── ESG ────────────────────────────────────────────────────
    sections.push({code:"08.1", title:"ESG & Sustainability", group:"ESG",
      status: statusOf({req:[]}),
      fields: [
        {label:"EPC target", value:"B (lettings) or A (new build BTR/PBSA)"},
        {label:"Operational energy", value:"Future Homes Std 2025 — Part L 2021"},
        {label:"Embodied carbon", value:"RIBA 2030 target: 500 kgCO₂e/m²"},
        {label:"BNG delivery", value:"10% mandatory — on-site, off-site or credits"},
        {label:"Social value", value:"Local labour, training, community amenity"},
        {label:"GRESB rating potential", value:isBtr||isPbsa?"Target 3-4 stars":"N/A"}
      ],
      uploads:["Sustainability Statement","Energy Strategy","Embodied carbon assessment","BNG delivery plan"]
    });

    // ─────────── RISK REGISTER — major curation differences ─────────────
    sections.push({code:"09.1", title:"Risk Register", group:"Risk & Q&A",
      status: statusOf({req:[risks.length>0?"y":""]}),
      fields: [
        // Internal sees raw risk wording, external sees mitigations
        {label:"Planning risk",
         value:p.riskLevel||"Run Planning & Viability",
         externalValue:p.riskLevel?"Active planning strategy — pre-application route":"In progress",
         sensitivity:"reworded-external"},
        {label:"Build cost inflation", value:"Mitigate via fixed price D&B + 5% contingency"},
        {label:"Sales market risk", value:"Sensitivity tested",
         externalValue:"Comprehensive sensitivity analysis completed"},
        {label:"Contamination risk",
         value:l.contamination||"To assess",
         externalValue:"Remediation strategy in development",
         sensitivity:"reworded-external"},
        {label:"S106 negotiation risk", value:"Active management required"},
        {label:"Open risks logged", value:risks.length+" items"},
        // Internal-only: panic level
        {label:"Internal confidence level (1-10)",
         value:intel.confidence||"7 — baseline",
         sensitivity:"internal-only"}
      ],
      uploads:["Full risk register (live document)","Risk treatment plans","Insurance summary"]
    });

    sections.push({code:"09.2", title:"Q&A Log", group:"Risk & Q&A",
      status: statusOf({req:[]}),
      fields: [
        {label:"Investor questions raised", value:(dr.qaLog||[]).length+" items"},
        {label:"Outstanding responses", value:(dr.qaLog||[]).filter(function(q){return !q.answered;}).length+" items"}
      ],
      uploads:[]
    });

    // ═══════════════════════════════════════════════════════════════════
    // ─────────── INTERNAL-ONLY SECTIONS ────────────────────────────────
    // These ENTIRE sections are stripped from external view
    // ═══════════════════════════════════════════════════════════════════

    // ─────────── 10 · COMMERCIAL INTELLIGENCE ──────────────────────────
    sections.push({code:"10.1", title:"Negotiation Position", group:"Commercial Intelligence", internalOnly:true,
      status: statusOf({req:[intel.minLandPrice||intel.targetLandPrice]}),
      fields: [
        {label:"Vendor asking price", value:ask>0?fmt(ask):"TBC"},
        {label:"Our target acquisition price", value:intel.targetLandPrice||(rlvVal>0?fmt(rlvVal*0.85):"TBC")},
        {label:"Walk-away price (max)", value:intel.minLandPrice||(rlvVal>0?fmt(rlvVal*0.95):"TBC")},
        {label:"Negotiation room", value:intel.negotiationRoom||"~15% from ask typical"},
        {label:"Vendor motivation", value:intel.vendorMotivation||"To investigate (timing pressure? probate? divorce? distressed?)"},
        {label:"Competing buyers", value:intel.competingBuyers||"Unknown"},
        {label:"Time pressure on us", value:intel.timePressure||"None"},
        {label:"Our negotiation strategy", value:intel.negotiationStrategy||"Lead with worst-case buyer scenario to anchor low. Reveal upside only if needed."}
      ]
    });

    sections.push({code:"10.2", title:"Internal Margin Engineering", group:"Commercial Intelligence", internalOnly:true,
      status: statusOf({req:[]}),
      fields: [
        {label:"Headline profit (external)", value:pct(profitPct)},
        {label:"True target profit (internal)", value:intel.trueProfit||pct(profitPct+3)+" (build buffer)"},
        {label:"Profit extraction methods", value:intel.profitExtraction||"D&B contract pricing buffer · 5% contingency rarely fully used · S106 viability challenge"},
        {label:"Hidden value levers", value:intel.valueLevers||"Density uplift via Para 11 NPPF · BNG credit sale · grid connection ransom · highways adoption credit"},
        {label:"Cassidy fees & profit splits (JV)", value:intel.feeStructure||"Standard 60/40 to Cassidy / investor"}
      ]
    });

    sections.push({code:"10.3", title:"Funding & Investor Strategy", group:"Commercial Intelligence", internalOnly:true,
      status: statusOf({req:[]}),
      fields: [
        {label:"Preferred funding structure", value:intel.fundingPref||"To decide"},
        {label:"Approached investors", value:intel.investorsApproached||"None yet"},
        {label:"Investor responses", value:intel.investorResponses||"—"},
        {label:"Backup funding options", value:intel.backupFunding||"Senior debt at 65% LTC + mezz"},
        {label:"Lender concerns flagged", value:intel.lenderConcerns||"None known"}
      ]
    });

    // ─────────── 11 · RELATIONSHIP CRM ────────────────────────────────
    sections.push({code:"11.1", title:"Landowner Intelligence", group:"Relationship CRM", internalOnly:true,
      status: statusOf({req:[crm.landownerName]}),
      fields: [
        {label:"Landowner name", value:crm.landownerName||"—"},
        {label:"Type", value:crm.landownerType||"To identify (farmer, estate, trust, corporate, RP)"},
        {label:"Personality / approach style", value:crm.landownerStyle||"To assess"},
        {label:"Prior history with Cassidy", value:crm.landownerHistory||"First contact"},
        {label:"Sensitivities", value:crm.landownerSensitivities||"To investigate (heritage attachment? tax? family pressure?)"},
        {label:"Best contact channel", value:crm.contactChannel||"To establish"}
      ]
    });

    sections.push({code:"11.2", title:"Planning Officer Intelligence", group:"Relationship CRM", internalOnly:true,
      status: statusOf({req:[]}),
      fields: [
        {label:"Case officer", value:crm.caseOfficer||"To identify"},
        {label:"Officer reputation (developer-friendly?)", value:crm.officerReputation||"To research via peers"},
        {label:"Prior interaction tone", value:crm.officerTone||"—"},
        {label:"Officer concerns flagged", value:crm.officerConcerns||"None yet"},
        {label:"Political ward / Cllr", value:crm.wardCllr||"To research"},
        {label:"LPA member dynamics", value:crm.lpaPolitics||"To research"}
      ]
    });

    sections.push({code:"11.3", title:"Consultant Performance Log", group:"Relationship CRM", internalOnly:true,
      status: statusOf({req:[]}),
      fields: [
        {label:"Architect performance history", value:crm.architectPerf||"—"},
        {label:"Planning consultant history", value:crm.plannerPerf||"—"},
        {label:"Engineer history", value:crm.engineerPerf||"—"},
        {label:"Contractor history", value:crm.contractorPerf||"—"},
        {label:"Reliable consultants for this scheme", value:crm.preferredConsultants||"—"}
      ]
    });

    // ─────────── 12 · INTERNAL AI INTELLIGENCE LAYER ──────────────────
    sections.push({code:"12.1", title:"AI Risk Detection", group:"AI Intelligence", internalOnly:true,
      status: statusOf({req:[]}),
      fields: [
        {label:"Viability AI flag", value:rlvVal>0&&ask>0?(rlvVal<ask?"⚠ RLV below ask — deal may not stack":"✓ RLV above ask"):"—"},
        {label:"Planning probability score", value:num(ccr.score)>0?ccr.score+"/100":cc.planningScore?cc.planningScore+"/100":"—"},
        {label:"Build:Sale ratio diagnostic", value:rlvD.salePsf&&rlvD.buildPsf?Math.round(num(rlvD.buildPsf)/num(rlvD.salePsf)*100)+"%":"—"},
        {label:"Yield-vs-market check", value:cap.targetYield&&num(cap.targetYield)>5?"⚠ Yield above 5% — institutional buyers unlikely":num(cap.targetYield)>0?"✓ Within institutional range":"—"},
        {label:"AI-detected red flags", value:intel.aiRedFlags||"None detected by analysis"},
        {label:"AI confidence in deal", value:intel.aiConfidence||"—"}
      ]
    });

    sections.push({code:"12.2", title:"AI-Generated DD Gap Analysis", group:"AI Intelligence", internalOnly:true,
      status: statusOf({req:[]}),
      fields: [
        {label:"Missing DD items detected", value:intel.missingDD||"Run AI scan via Risk Register stage"},
        {label:"Suggested commissioning priority", value:intel.priorityCommissions||"Phase 1 contamination + ecology survey first"},
        {label:"Comparable schemes analysis", value:intel.comparableSchemes||"Run via AI analysis"},
        {label:"AI summary of consultant reports", value:intel.consultantSummary||"No reports loaded yet"}
      ]
    });

    sections.push({code:"12.3", title:"AI Deal Monitoring", group:"AI Intelligence", internalOnly:true,
      status: statusOf({req:[]}),
      fields: [
        {label:"Next required action", value:intel.nextAction||"Complete Planning & Viability"},
        {label:"Upcoming deadlines", value:intel.deadlines||"None set"},
        {label:"AI-flagged stalls", value:intel.stalls||"None"},
        {label:"AI-suggested next investor contact", value:intel.nextInvestor||"—"}
      ]
    });

    // ═══════════════════════════════════════════════════════════════════
    // ─────────── APPLY THE AUDIENCE FILTER ─────────────────────────────
    // For EXTERNAL audience: physically strip internal-only sections + fields
    // from the rendered output (security-first — not just CSS hiding)
    // ═══════════════════════════════════════════════════════════════════
    if(isExternal){
      sections = sections.filter(function(s){ return !s.internalOnly; });
      sections = sections.map(function(s){
        return Object.assign({}, s, {
          fields: s.fields.filter(function(f){ return f.sensitivity !== "internal-only"; })
                          .map(function(f){
                            // Apply external rewording
                            if(f.sensitivity==="redacted-external" || f.sensitivity==="reworded-external"){
                              return Object.assign({}, f, {value: f.externalValue || f.value});
                            }
                            return f;
                          })
        });
      });
    }

    // ── Group sections for rendering ────────────────────────────────────
    var groupOrder=["Land & Ownership","Planning","Technical","Financial","Legal","Construction","Sales & Leasing","ESG","Risk & Q&A","Commercial Intelligence","Relationship CRM","AI Intelligence"];
    var groupColors={
      "Land & Ownership":"#2D7A65","Planning":"#4A4BAE","Technical":"#9A7B3E","Financial":"#1E1F5C",
      "Legal":"#7278A0","Construction":"#B05A35","Sales & Leasing":"#2D7A65","ESG":"#2D7A65","Risk & Q&A":"#9A7B3E",
      "Commercial Intelligence":"#B05A35","Relationship CRM":"#B05A35","AI Intelligence":"#B05A35"
    };
    var internalOnlyGroups={"Commercial Intelligence":true,"Relationship CRM":true,"AI Intelligence":true};

    var totalPct=Math.round(sections.reduce(function(s,sec){return s+sec.status.pct;},0)/sections.length);
    var completeCount=sections.filter(function(s){return s.status.pct===100;}).length;
    var partialCount=sections.filter(function(s){return s.status.pct>0&&s.status.pct<100;}).length;
    var missingCount=sections.filter(function(s){return s.status.pct===0;}).length;

    // ═══════════════════════════════════════════════════════════════════
    // ─────────── RENDER ─────────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════════
    return e("div",{style:isInternal&&viewMode==="screen"?{background:"linear-gradient(180deg,rgba(176,90,53,0.02) 0%,transparent 200px)",position:"relative"}:viewMode==="print"?{background:"#fff",padding:"40px 0"}:{}},

      // ── INTERNAL ROOM BANNER (only visible in Internal mode, screen view) ──
      isInternal&&viewMode==="screen"&&e("div",{style:{background:"linear-gradient(90deg,#B05A35 0%,#9A7B3E 100%)",color:"#fff",padding:"10px 16px",marginBottom:14,borderRadius:8,display:"flex",alignItems:"center",gap:12,fontSize:11,fontWeight:700,letterSpacing:".05em",boxShadow:"0 2px 10px rgba(176,90,53,0.25)"}},
        e("span",{style:{fontSize:18}},"🔒"),
        e("div",{style:{flex:1}},
          e("div",{style:{fontSize:12,textTransform:"uppercase",fontWeight:800,letterSpacing:".15em"}},"INTERNAL DATA ROOM — TRUTH MODE"),
          e("div",{style:{fontSize:10,opacity:0.85,marginTop:1,fontWeight:500}},"Full disclosure · negotiation positions · CRM intel · AI machinery · risk truth")
        ),
        e("div",{style:{fontSize:10,background:"rgba(255,255,255,0.18)",padding:"3px 8px",borderRadius:3,letterSpacing:".1em",fontWeight:800}},"DIRECTORS · LAND TEAM · FINANCE · PLANNING")
      ),

      // ── HEADER (screen) ─────────────────────────────────────────────────
      viewMode==="screen"&&e("div",{style:{marginBottom:14}},
        e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Data Room"),
        e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:0}},isInternal?"Operational intelligence + investor-ready content. Toggle to External to see what investors actually receive.":"Curated for institutional review — confidence-building, controlled, polished.")
      ),

      // ── COVER PAGE (print only) ───────────────────────────────────────
      viewMode==="print"&&e("div",{style:{padding:"60px 60px 40px",borderBottom:"3px solid #2E2F8A",marginBottom:30}},
        e("div",{style:{fontSize:11,letterSpacing:".25em",textTransform:"uppercase",color:"#7278A0",marginBottom:30,fontWeight:800}},isInternal?"INTERNAL — CASSIDY DIRECTORS ONLY":"Confidential · Virtual Data Room"),
        e("div",{style:{fontSize:36,fontWeight:800,color:"#1E1F5C",lineHeight:1.1,marginBottom:14}},addr),
        e("div",{style:{fontSize:14,color:"#4A4BAE",marginBottom:30}},pcCity+(lpa?" · "+lpa:"")+(acres>0?" · "+acres+" acres":"")),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:24,padding:"24px 0",borderTop:"1px solid #DDE0ED",borderBottom:"1px solid #DDE0ED"}},
          [
            ["Scheme type",schemes.length>0?schemes.map(function(s){return s.toUpperCase();}).join(" + "):"To confirm"],
            ["Exit route",exits.length>0?exits.map(function(x){return ({pension:"Pension Fund",sovereign:"Sovereign WF",btr_op:"BTR Operator",family:"Family Office",ha_rp:"HA / RP Bulk",homes_eng:"Homes England",bank_takeout:"Bank Take-out",land_sale:"Land + Planning",open_mkt:"Open Market"})[x]||x;}).join(", "):"Multiple"],
            ["Indicative GDV",gdvVal>0?(isInternal?fmt(gdvVal):fmtRange(gdvVal,0.05)):"To finalise"],
            ["Indicative RLV",rlvVal>0?(isInternal?fmt(rlvVal):fmtRange(rlvVal,0.08)):"To finalise"],
            ["Document type",isInternal?"INTERNAL — Truth Room":"Investor Data Room"],
            ["Date prepared",new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})]
          ].map(function(row,i){
            return e("div",{key:i},
              e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,marginBottom:4}},row[0]),
              e("div",{style:{fontSize:15,color:"#1E1F5C",fontWeight:600}},row[1])
            );
          })
        ),
        e("div",{style:{marginTop:40,paddingTop:14,fontSize:9,color:"#7278A0",letterSpacing:".05em",lineHeight:1.6}},
          isInternal?
            "INTERNAL DOCUMENT — Cassidy directors, land team, finance, planning. Contains commercially sensitive information including negotiation positions, internal margins, and relationship intelligence. NOT FOR EXTERNAL DISTRIBUTION." :
            "This document contains commercially sensitive information. Distribution is restricted to invited parties. All figures are indicative and subject to detailed due diligence, planning consent, and final commercial terms. Issued by Cassidy Group. © "+new Date().getFullYear()+"."
        )
      ),

      // ── CONTROL BAR (screen only) ─────────────────────────────────────
      viewMode==="screen"&&e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"14px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}},
        // Audience toggle — this is now the major decision
        e("div",{style:{display:"flex",alignItems:"center",gap:8}},
          e("div",{style:{fontSize:10,fontWeight:700,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em"}},"Room"),
          [["internal","🔒 Internal","#B05A35"],["external","🏛 External","#4A4BAE"]].map(function(a){
            var on=audience===a[0];
            return e("button",{key:a[0],onClick:function(){up("dataroom","audience",a[0]);},
              style:{padding:"6px 14px",background:on?a[2]:"#F4F5FB",color:on?"#fff":"#3A3D6A",border:"1px solid "+(on?a[2]:"#DDE0ED"),borderRadius:5,fontSize:11,fontWeight:on?800:500,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },a[1]);
          })
        ),
        e("div",{style:{display:"flex",alignItems:"center",gap:8}},
          e("div",{style:{fontSize:10,fontWeight:700,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em"}},"View"),
          [["screen","💻 Screen"],["print","📄 Print"]].map(function(v){
            var on=viewMode===v[0];
            return e("button",{key:v[0],onClick:function(){up("dataroom","viewMode",v[0]);},
              style:{padding:"5px 12px",background:on?"#2D7A65":"#F4F5FB",color:on?"#fff":"#3A3D6A",border:"1px solid "+(on?"#2D7A65":"#DDE0ED"),borderRadius:5,fontSize:11,fontWeight:on?700:500,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },v[1]);
          })
        ),
        e("div",{style:{marginLeft:"auto",display:"flex",gap:8}},
          e("button",{onClick:function(){up("dataroom","viewMode","print");setTimeout(function(){window.print();},300);},
            style:{padding:"7px 14px",background:"#2D7A65",color:"#fff",border:"none",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"📄 Generate PDF"),
          e("button",{onClick:function(){alert("Phase 2: file uploads via Google Drive — coming soon.\nPhase 3: shareable investor link.");},
            style:{padding:"7px 14px",background:"#F4F5FB",color:"#7278A0",border:"1px dashed #B5BAD6",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"📎 Uploads (Phase 2)")
        )
      ),

      // ── AUDIENCE INFO STRIP ────────────────────────────────────────────
      viewMode==="screen"&&e("div",{style:{padding:"10px 16px",background:isInternal?"rgba(176,90,53,0.06)":"rgba(74,75,174,0.06)",border:"1px solid "+(isInternal?"rgba(176,90,53,0.2)":"rgba(74,75,174,0.2)"),borderLeft:"3px solid "+(isInternal?"#B05A35":"#4A4BAE"),borderRadius:6,marginBottom:14,fontSize:11,color:"#3A3D6A",lineHeight:1.7}},
        isInternal?
          e("span",null,e("strong",{style:{color:"#B05A35"}},"🔒 INTERNAL TRUTH ROOM — "),"Showing ",e("strong",null,sections.length+" sections")," including negotiation positions, internal margins, CRM intelligence, and AI machinery. ",e("strong",null,"Never expose externally."),"") :
          e("span",null,e("strong",{style:{color:"#4A4BAE"}},"🏛 EXTERNAL INVESTOR ROOM — "),"Curated content for institutional review. ",e("strong",null,sections.length+" sections")," visible · sensitive figures rounded · risk language softened · internal intel stripped from output (not just hidden). Safe to share.")
      ),

      // ── COMPLETION DASHBOARD ──────────────────────────────────────────
      viewMode==="screen"&&e("div",{style:{background:isInternal?"linear-gradient(135deg,#1E1F5C 0%,#2E2F8A 100%)":"linear-gradient(135deg,#2D7A65 0%,#234d3f 100%)",color:"#fff",borderRadius:10,padding:"18px 22px",marginBottom:14}},
        e("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:14}},
          e("div",null,
            e("div",{style:{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",color:"rgba(255,255,255,0.5)",marginBottom:4,fontWeight:700}},isInternal?"Internal room readiness":"Investor data room readiness"),
            e("div",{style:{fontSize:32,fontWeight:800,color:"#fff",lineHeight:1}},totalPct+"%"),
            e("div",{style:{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:4}},sections.length+" sections · "+completeCount+" complete · "+partialCount+" partial · "+missingCount+" missing")
          ),
          e("div",{style:{flex:1,minWidth:240,maxWidth:600}},
            e("div",{style:{height:10,background:"rgba(255,255,255,0.1)",borderRadius:5,overflow:"hidden",marginBottom:6}},
              e("div",{style:{width:totalPct+"%",height:"100%",background:"linear-gradient(90deg,#EDE84A 0%,"+(isInternal?"#B05A35":"#2D7A65")+" 100%)",borderRadius:5,transition:"width .4s"}})
            ),
            e("div",{style:{fontSize:10,color:"rgba(255,255,255,0.5)"}},
              isInternal?
                (totalPct<40?"Early — populate Land Appraisal, Planning, Financial first":totalPct<70?"In progress — add CRM intelligence + negotiation data":totalPct<90?"Strong internal position — check External room next":"Investor-ready · External room curated") :
                (totalPct<40?"Early stage — fill core stages first":totalPct<70?"In progress — complete missing sections before approaching investors":totalPct<90?"Near complete — review partial sections":"Investor-ready — safe to share")
            )
          )
        )
      ),

      // ── SECTIONS BY GROUP ─────────────────────────────────────────────
      groupOrder.map(function(grp){
        var grpSecs=sections.filter(function(s){return s.group===grp;});
        if(grpSecs.length===0)return null;
        var isInternalGroup=internalOnlyGroups[grp];
        return e("div",{key:grp,style:{marginBottom:viewMode==="print"?20:18,pageBreakInside:"avoid"}},
          // Group header
          e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:8,paddingLeft:viewMode==="print"?60:0}},
            e("div",{style:{width:4,height:24,background:groupColors[grp]||"#4A4BAE",borderRadius:2}}),
            e("div",{style:{fontSize:11,fontWeight:800,color:groupColors[grp]||"#4A4BAE",textTransform:"uppercase",letterSpacing:".12em"}},grp),
            e("div",{style:{fontSize:10,color:"#7278A0"}},"("+grpSecs.length+" "+(grpSecs.length===1?"section":"sections")+")"),
            isInternalGroup&&e("span",{style:{fontSize:9,background:"rgba(176,90,53,0.12)",color:"#B05A35",padding:"2px 7px",borderRadius:3,letterSpacing:".08em",fontWeight:800}},"🔒 INTERNAL ONLY")
          ),
          // Section cards
          e("div",{style:{display:"flex",flexDirection:"column",gap:8,marginLeft:viewMode==="print"?60:0,marginRight:viewMode==="print"?60:0}},
            grpSecs.map(function(sec){
              return e("div",{key:sec.code,style:{background:isInternalGroup?"rgba(255,247,242,0.6)":"#fff",border:"1px solid "+(isInternalGroup?"rgba(176,90,53,0.25)":"#DDE0ED"),borderRadius:8,padding:"14px 18px",pageBreakInside:"avoid"}},
                // Section header row
                e("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingBottom:8,borderBottom:"1px solid #F0F1FA",gap:8,flexWrap:"wrap"}},
                  e("div",{style:{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}},
                    e("div",{style:{fontFamily:"DM Mono,monospace",fontSize:11,color:"#7278A0",fontWeight:700,minWidth:36}},sec.code),
                    e("div",{style:{fontSize:13,fontWeight:700,color:"#1E1F5C"}},sec.title)
                  ),
                  e("div",{style:{fontSize:9,fontWeight:800,letterSpacing:".05em",padding:"3px 8px",background:sec.status.bg,color:sec.status.col,borderRadius:3}},sec.status.label)
                ),
                // Auto-populated fields
                e("div",{style:{display:"grid",gridTemplateColumns:viewMode==="print"?"1fr 2fr":"220px 1fr",gap:"6px 14px",fontSize:11}},
                  sec.fields.map(function(row,i){
                    var isInternalField=row.sensitivity==="internal-only";
                    return [
                      e("div",{key:"l"+i,style:{color:"#7278A0",fontWeight:600,display:"flex",alignItems:"center",gap:5}},
                        row.label,
                        isInternal&&isInternalField&&e("span",{style:{fontSize:8,background:"rgba(176,90,53,0.15)",color:"#B05A35",padding:"1px 5px",borderRadius:2,letterSpacing:".05em",fontWeight:800}},"🔒")
                      ),
                      e("div",{key:"v"+i,style:{color:isInternal&&isInternalField?"#B05A35":"#1E1F5C",fontWeight:row.value&&row.value!=="—"&&(row.value.toString().indexOf("To ")===0||row.value.toString().indexOf("Required")===0)?400:700,fontStyle:isInternal&&isInternalField?"italic":"normal"}},row.value||"—")
                    ];
                  })
                ),
                // Private Notes (internal only)
                isInternal&&e("div",{style:{marginTop:12,paddingTop:10,borderTop:"1px dashed rgba(176,90,53,0.3)"}},
                  e("div",{style:{fontSize:9,color:"#B05A35",letterSpacing:".08em",textTransform:"uppercase",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:6}},"🔒 Private Notes (never shown externally)"),
                  e("textarea",{
                    value:(dr.notes&&dr.notes[sec.code])||"",
                    onChange:function(ev){
                      var newNotes=Object.assign({},dr.notes||{});
                      newNotes[sec.code]=ev.target.value;
                      up("dataroom","notes",newNotes);
                    },
                    placeholder:"Internal annotation — won't appear in External room or PDF...",
                    style:{width:"100%",minHeight:50,padding:"7px 9px",fontSize:11,fontFamily:"DM Sans,sans-serif",border:"1px solid rgba(176,90,53,0.25)",background:"rgba(255,247,242,0.5)",borderRadius:5,color:"#3A3D6A",resize:"vertical"}
                  })
                ),
                // Upload placeholders
                sec.uploads&&sec.uploads.length>0&&e("div",{style:{marginTop:12,paddingTop:10,borderTop:"1px dashed #DDE0ED"}},
                  e("div",{style:{fontSize:9,color:"#7278A0",letterSpacing:".08em",textTransform:"uppercase",fontWeight:700,marginBottom:6}},"Required uploads (Phase 2)"),
                  e("div",{style:{display:"flex",flexWrap:"wrap",gap:5}},
                    sec.uploads.map(function(u,i){
                      return e("div",{key:i,style:{fontSize:10,color:"#9A7B3E",background:"rgba(154,123,62,0.08)",border:"1px dashed #C5B294",borderRadius:4,padding:"3px 8px"}},"📎 "+u);
                    })
                  )
                )
              );
            })
          )
        );
      }),

      // ── FOOTER NOTE ───────────────────────────────────────────────────
      viewMode==="screen"&&e("div",{style:{marginTop:18,padding:"14px 16px",background:isInternal?"rgba(176,90,53,0.05)":"#F8F8FE",borderLeft:"3px solid "+(isInternal?"#B05A35":"#4A4BAE"),borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.7}},
        isInternal?
          e("span",null,e("strong",{style:{color:"#B05A35"}},"🔒 You're in the Truth Room. "),"This view contains commercial intelligence, negotiation positions, relationship CRM, and AI machinery. ",e("strong",null,"Switch to External"),' to see exactly what investors receive — sensitive figures rounded to ranges, internal sections stripped from the output, risk language softened to mitigation framing. The External view is generated cleanly: dev-tools "View Source" reveals nothing internal.') :
          e("span",null,e("strong",{style:{color:"#4A4BAE"}},"🏛 Investor View. "),"This is exactly what an institutional investor would see. All internal commercial intelligence, negotiation positions, and CRM intel have been physically removed from the rendered output. Sensitive financial figures (RLV, profit margin, headroom) shown as ranges or rounded. Risk language reframed as active mitigation. ",e("strong",null,"Safe to print, PDF, or share directly."))
      )
    );
  }
