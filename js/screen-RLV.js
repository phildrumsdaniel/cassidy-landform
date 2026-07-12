// ── renderRLV  (params: city, data, m, navTo, setData, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderRLV(city, data, m, navTo, setData, up, user){
    var r=data.rlv||{};
    // Auto-populate postcode from Land Finder if not already set
    if(!r.postcode&&data.land&&data.land.postcode){
      up("rlv","postcode",data.land.postcode.toUpperCase());
    }
    var pcData=r.postcode?lookupPostcode(r.postcode):null;
    // Resolve city: postcode lookup → data.land.city → null (NOT silent manchester fallback)
    var rCity=(pcData&&pcData.city)||(data.land&&data.land.city)||null;
    var rCityKnown=!!(rCity && MKT[rCity]);  // only true if we have real market data
    var rm=(rCity&&MKT[rCity])||MKT.manchester;  // fallback retained for calculations only

    // v9.15 — auto-resolve schType from assetType when missing/mismatched
    // This prevents the silent "Residential apartments" default driving SFH RLV calcs
    // (the £24m bug spotted on Maldon deal where £220/sqft was used instead of £180-195/sqft).
    var schTypeResolved = r.schType;
    var assetTypeLc = (data.assetType || "").toLowerCase();
    var schemeMismatch = false;
    if(!schTypeResolved){
      // No schType set — default from assetType
      if(assetTypeLc==="sfh") schTypeResolved = "Residential houses";
      else if(assetTypeLc==="btr") schTypeResolved = "BTR (Build to Rent)";
      else if(assetTypeLc==="pbsa") schTypeResolved = "PBSA (Student)";
      else schTypeResolved = "Residential houses";
    } else {
      // Has schType — check if it matches assetType. If not, flag mismatch.
      var typeApart = schTypeResolved.indexOf("apart")>=0 || schTypeResolved.indexOf("BTR")>=0 || schTypeResolved.indexOf("PBSA")>=0;
      var typeHouse = schTypeResolved.indexOf("houses")>=0 || schTypeResolved.indexOf("Residential houses")>=0;
      if(assetTypeLc==="sfh" && typeApart) schemeMismatch = true;
      if((assetTypeLc==="btr"||assetTypeLc==="pbsa") && typeHouse) schemeMismatch = true;
    }
    var bt=BUILD_TYPES[schTypeResolved]||BUILD_TYPES["Residential houses"];
    var rUnits=num(r.units); var rSqft=numOr(r.avgSqft, 850);
    // v9.28 — Apply new-build premium when scheme is new development (SFH/BTR/PBSA)
    // Land Registry returns ALL housing stock; for new-build viability we need the
    // new-build comparable. Show both figures in the input label.
    var rRawPsf = num(pcData&&pcData.salePsf) || (estSalePsfFromRent(rm.btr)) || (m&&estSalePsfFromRent(m.btr)) || 260;
    var rNbInfo = isNewBuildScheme(data.assetType) ? newBuildPsf(r.postcode||(data.land&&data.land.postcode)||"", rRawPsf) : null;
    var rDefaultPsf = rNbInfo ? rNbInfo.newBuild : rRawPsf;
    var rSalePsf=num(r.salePsf)||rDefaultPsf;
    // v9.15 — use postcode-resolved city's build cost (rm.build) before outer-scope m.build
    // The old code used m.build which is from `(city&&MKT[city])||MKT.manchester` (outer scope),
    // which may not match the postcode the user just entered into RLV.
    var rBuild=num(r.buildPsf)||(rm&&rm.build)||(m&&m.build)||bt.mid;
    var rProfit=numOr(r.profitPct, 17.5); var rFin=numOr(r.finRate, 7.5);
    var rCont=numOr(r.contingency, 5);

    // ─────────────────────────────────────────────────────────────────────
    // v9.41 — Apply blended GDV factor when SFH mix has non-private routes
    // Fixes the financial bug Phil spotted: RLV stage was using full retail GDV
    // (units × sqft × salePsf), ignoring that the SFH mix has AHP routes which
    // sell at 55%-70% MV. Previously RLV showed positive when real RLV was negative.
    // ─────────────────────────────────────────────────────────────────────
    var rRetailGdv = rUnits*rSqft*rSalePsf;
    var rBlendedGdv = rRetailGdv;
    var rBlendFactor = 1.0;
    var rHasMultiRoute = false;
    var rRouteSummary = [];
    (function(){
      var sfhMixForRlv = (data.sfh && data.sfh.mix) || [];
      if(sfhMixForRlv.length === 0) return;
      var mixTotalRetail = 0, mixTotalBlended = 0;
      var routeCounts = {};
      var routeFullMv = {};
      sfhMixForRlv.forEach(function(row){
        var cnt = num(row.count); if(!cnt || !row.type) return;
        var info = HOUSE_TYPES[row.type] || {sqft:900, adj:1.0};
        var rowSqft = numOr(row.sqft, info.sqft);
        var unitPrice = num(row.unitPrice || 0);
        var sp = unitPrice && rowSqft ? unitPrice/rowSqft : (num(row.psf) || (rSalePsf * (info.adj||1.0)));
        var rowRetail = rowSqft * sp * cnt;
        var tenure = row.tenure || "private";
        var disc = (ROUTE_DISCOUNT[tenure] || ROUTE_DISCOUNT.private).pct;
        if(tenure !== "private") rHasMultiRoute = true;
        mixTotalRetail += rowRetail;
        mixTotalBlended += rowRetail * disc;
        routeCounts[tenure] = (routeCounts[tenure] || 0) + cnt;
        routeFullMv[tenure] = (routeFullMv[tenure] || 0) + rowRetail;
      });
      if(mixTotalRetail > 0 && rHasMultiRoute){
        rBlendFactor = mixTotalBlended / mixTotalRetail;
        rBlendedGdv = rRetailGdv * rBlendFactor;
        rRouteSummary = Object.keys(routeCounts).map(function(t){
          return {
            tenure: t,
            count: routeCounts[t],
            label: (ROUTE_DISCOUNT[t]||{}).label || t,
            discount: (ROUTE_DISCOUNT[t]||ROUTE_DISCOUNT.private).pct
          };
        });
      }
    })();
    // Use blended GDV for downstream calc when scheme is multi-route
    var rGdv = rHasMultiRoute ? rBlendedGdv : rRetailGdv;
    // v9.46 — When an SFH House Mix exists, the canonical per-type, AH-aware engine
    // (computeSFHMetrics) is the SINGLE source of GDV, so this screen's headline,
    // breakdown and AI report agree exactly with the SFH House Mix screen and the
    // deal-state. (The sensitivity sliders below use their own rlvCore/calcDealMetrics
    // path and are unaffected.) Falls back to the flat-psf calc when there's no mix.
    if(data.sfh && data.sfh.mix && data.sfh.mix.length && typeof computeSFHMetrics === "function"){
      var _canon = computeSFHMetrics(data);
      if(_canon.retailGdv > 0){
        rRetailGdv = _canon.retailGdv;
        rBlendedGdv = _canon.gdv;
        rBlendFactor = _canon.retailGdv > 0 ? _canon.gdv / _canon.retailGdv : 1;
        rHasMultiRoute = _canon.hasNonPrivate || (_canon.ahFactor < 1);
        rGdv = _canon.gdv;
      }
    }

    var rBc=rUnits*rSqft*rBuild;
    var rFees=rBc*bt.fees; var rContCost=rBc*(rCont/100);
    var rFinCost=(rBc+rFees)*(rFin/100);
    var rS106=rUnits*(numOr(r.s106pu, 8000));
    var rPlan=rUnits*bt.plan;
    var rRoads=0, rInfra=0, rMarketing=0;
    var rFeesPct=bt.fees;
    var rDevProfit=rGdv*(rProfit/100);
    var rRlv=rGdv-rBc-rFees-rContCost-rFinCost-rS106-rPlan-rDevProfit;
    var rNetLandBid=rRlv;
    // v9.47 — For SFH schemes, adopt the canonical gross cost stack (build, fees,
    // contingency, finance, S106, roads, infra, profit) so this screen's RLV
    // equals the SFH House Mix screen and the AI exactly. Acquisition costs give
    // the net land bid. Non-SFH land valuations keep the flat-psf model.
    var rIsSfhCanon = !!(data.sfh && data.sfh.mix && data.sfh.mix.length && typeof calcDealMetrics==="function" && (data.assetType==="sfh"||!data.assetType));
    if(rIsSfhCanon){
      var DMc=calcDealMetrics(data);
      if(DMc.gdv>0){
        rBc=DMc.buildCost; rFees=DMc.fees; rFeesPct=0.10; rContCost=DMc.contingency; rFinCost=DMc.finance;
        rS106=DMc.s106; rRoads=DMc.roads; rInfra=DMc.infra; rMarketing=DMc.marketing||0; rPlan=0; rDevProfit=DMc.profit;
        rRlv=DMc.rlv; rNetLandBid=DMc.netLandBid;
      }
    }
    // If acquisition costs toggle is on, show the NET land bid (after SDLT/legals/agent/land finance)
    if(r.includeAcqCosts){
      if(rIsSfhCanon){ rRlv = rNetLandBid; }
      else { var DM_acq=calcDealMetrics(data); rRlv = rRlv - DM_acq.totalAcqCosts; }
    }
    var rlvPu=rUnits>0?rRlv/rUnits:0;
    var rlvPctGdv=rGdv>0?(rRlv/rGdv)*100:0;
    // v9.41 — Use amber when RLV is positive but below 15% margin threshold (was misleadingly green)
    var rViable = rRlv > 0 && rlvPctGdv >= 15;
    var sc = rRlv > 0 ? (rViable ? "#2D7A65" : "#9A7B3E") : "#B05A35";
    var rResultStyle = rRlv > 0 ? (rViable ? S.resultGreen : S.resultAmber) : S.resultRed;

    var lrData=r.lrData||null;
    var lrLoading=r.lrLoading||false;
    var lrError=r.lrError||"";

    // Auto-fetch if postcode is set but no data yet and not already loading
    if(r.postcode&&r.postcode.length>=5&&!lrData&&!lrLoading&&!lrError){
      setTimeout(function(){
        var pc=(r.postcode||"").toUpperCase().replace(/\s+/g,"");
        var match=pc.match(/^([A-Z]{1,2})(\d{1,2}[A-Z]?)(\d)([A-Z]{2})$/);
        if(match)up("rlv","lrAutoTrigger",Date.now());
      },100);
    }

    // Run fetch when auto-trigger fires
    if(r.lrAutoTrigger&&!lrData&&!lrLoading&&r.postcode&&r.postcode.length>=5){
      var pcCheck=(r.postcode||"").toUpperCase().replace(/\s+/g,"");
      var matchCheck=pcCheck.match(/^([A-Z]{1,2})(\d{1,2}[A-Z]?)(\d)([A-Z]{2})$/);
      if(matchCheck){
        up("rlv","lrAutoTrigger",null);
        setTimeout(function(){
          if(!data.rlv||!data.rlv.lrData){
            document.getElementById&&document.getElementById("lr-search-btn")&&document.getElementById("lr-search-btn").click();
          }
        },50);
      }
    }

    function fetchLR(){
      var pc=(r.postcode||"").toUpperCase().replace(/\s+/g,"");
      if(!pc)return;
      // v10.63 — accept a FULL postcode OR just the OUTCODE (e.g. "TN12"). The Land Registry
      // search filters at district/outcode level (STRSTARTS on the outcode), so a full postcode
      // is not required — the outcode gives the same area-level £/sqft.
      var full=pc.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)(\d)([A-Z]{2})$/);
      var out=pc.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)$/);
      var district, sector;
      if(full){ district=full[1]; sector=district+" "+full[2]; }
      else if(out){ district=out[1]; sector=district; }
      else { up("rlv","lrError","Enter a postcode outcode (e.g. TN12) or a full postcode (e.g. TN12 6AB)."); return; }
      up("rlv","lrLoading",true);up("rlv","lrError","");up("rlv","lrData",null);
      up("rlv","lrSectorUsed",sector);

      // Try the full postcode first for best results
      var sparql="PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/> "+
        "PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/> "+
        "PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> "+
        "SELECT ?paon ?street ?town ?postcode ?amount ?date ?typeUri WHERE { "+
        "?addr lrcommon:postcode ?postcode . "+
        "FILTER(STRSTARTS(?postcode, \""+district+"\")) "+
        "?t lrppi:propertyAddress ?addr ; lrppi:pricePaid ?amount ; lrppi:transactionDate ?date ; lrppi:propertyType ?typeUri . "+
        "OPTIONAL{?addr lrcommon:paon ?paon} OPTIONAL{?addr lrcommon:street ?street} OPTIONAL{?addr lrcommon:town ?town} "+
        "FILTER(?date >= \"2022-01-01\"^^xsd:date) "+
        "} ORDER BY DESC(?date) LIMIT 50";

      // Add 30s timeout - LR SPARQL can be very slow
      var lrTimeout=setTimeout(function(){
        up("rlv","lrLoading",false);
        up("rlv","lrError","Land Registry query timed out (>30s). Enter the sale price manually below using Rightmove/Zoopla sold prices for the area.");
      },30000);
      fetch("https://landregistry.data.gov.uk/landregistry/query?query="+encodeURIComponent(sparql)+"&output=json",
        {headers:{"Accept":"application/json"}})
      .then(function(res){return res.json();})
      .then(function(json){
        // v9.99 — keep the 30s timeout ARMED here: if this first query returns 0 rows it
        // fires a SECOND fetch below, and clearing the timeout now left that second fetch
        // unguarded — a hang there stuck the spinner forever. Cleared at the final step.
        var rows=(json&&json.results&&json.results.bindings)||[];

        // If still no results, try broader district
        if(rows.length===0){
          var sparql2="PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/> "+
            "PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/> "+
            "PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> "+
            "SELECT ?paon ?street ?town ?postcode ?amount ?date ?typeUri WHERE { "+
            "?addr lrcommon:postcode ?postcode . "+
            "FILTER(STRSTARTS(STR(?postcode), \""+district+"\")) "+
            "?t lrppi:propertyAddress ?addr ; lrppi:pricePaid ?amount ; lrppi:transactionDate ?date ; lrppi:propertyType ?typeUri . "+
            "OPTIONAL{?addr lrcommon:paon ?paon} OPTIONAL{?addr lrcommon:street ?street} OPTIONAL{?addr lrcommon:town ?town} "+
            "FILTER(?date >= \"2021-01-01\"^^xsd:date) "+
            "} ORDER BY DESC(?date) LIMIT 50";
          return fetch("https://landregistry.data.gov.uk/landregistry/query?query="+encodeURIComponent(sparql2)+"&output=json",
            {headers:{"Accept":"application/json"}}).then(function(r2){return r2.json();})
          .then(function(j2){
            up("rlv","lrSectorUsed",district+" (district)");
            return (j2&&j2.results&&j2.results.bindings)||[];
          });
        }
        return rows;
      })
      .then(function(rows){
        var TYPE_SQF={D:1350,S:980,T:820,F:620,O:900};
        var byType={};
        var allPsf=[];
        rows.forEach(function(b){
          var typeStr=(b.typeUri&&b.typeUri.value)||"";
          var tc2=typeStr.charAt(typeStr.length-1).toUpperCase();
          if(!"DSTFO".includes(tc2))tc2="O";
          var amt=parseInt((b.amount&&b.amount.value)||0);
          if(amt>50000&&amt<5000000){
            var sqf=TYPE_SQF[tc2]||900;
            var psf=Math.round(amt/sqf);
            if(psf>50&&psf<1500){
              if(!byType[tc2])byType[tc2]=[];
              byType[tc2].push({amt:amt,psf:psf});
              allPsf.push(psf);
            }
          }
        });
        var weightedPsf=allPsf.length>0?Math.round(allPsf.reduce(function(a,b){return a+b;},0)/allPsf.length):0;
        var typeStats=Object.keys(byType).map(function(code){
          var entries=byType[code];
          var avgAmt=Math.round(entries.reduce(function(a,b){return a+b.amt;},0)/entries.length);
          var avgPsf=Math.round(entries.reduce(function(a,b){return a+b.psf;},0)/entries.length);
          var labels={D:"Detached",S:"Semi-detached",T:"Terraced",F:"Flat",O:"Other"};
          return{code:code,label:labels[code]||"Other",avgAmt:avgAmt,avgPsf:avgPsf,count:entries.length};
        }).sort(function(a,b){return b.count-a.count;});
        var txns=rows.slice(0,25).map(function(b){
          var typeStr=(b.typeUri&&b.typeUri.value)||"";
          var tc2=typeStr.charAt(typeStr.length-1).toUpperCase();
          return{
            address:[(b.paon&&b.paon.value||""),(b.street&&b.street.value||"")].filter(Boolean).join(" "),
            postcode:(b.postcode&&b.postcode.value)||"",
            date:(b.date&&b.date.value||"").substring(0,10),
            amount:parseInt((b.amount&&b.amount.value)||0),
            type:{D:"Det",S:"Semi",T:"Terr",F:"Flat",O:"Other"}[tc2]||"Other"
          };
        });
        up("rlv","lrData",{wPsf:weightedPsf,transactions:txns,typeStats:typeStats,totalTx:rows.length,sector:r.lrSectorUsed||sector||""});
        if(weightedPsf>0){
          // v9.100 — the Land Registry figure is EXISTING-stock. A new-build scheme sells at
          // the new-build price, so plumb the new-build value to the scheme's sale £/sqft
          // (keeping the raw LR figure in lrData for the benchmark display). Previously the
          // raw existing figure fed the RLV so the main panel (mix, new-build) and the
          // sensitivity widget (this figure) disagreed — one profit, one loss.
          var _nb = isNewBuildScheme(data.assetType) ? (newBuildPsf(r.postcode||(data.land&&data.land.postcode)||"", weightedPsf)||{}).newBuild : 0;
          var salePlumb = _nb>0 ? _nb : weightedPsf;
          up("rlv","salePsf",String(salePlumb)); up("rlv","avgPsf",String(salePlumb));
          up("rlv","lrError","");

          // ── PLUMB LIVE PSF TO SHARED MARKET NAMESPACE & ALL DOWNSTREAM STAGES ──
          up("market","lrPsf",weightedPsf);
          up("market","lrPostcode",r.postcode);
          up("market","lrSector",r.lrSectorUsed||sector||"");
          up("market","lrTotalTx",rows.length);
          up("market","lrUpdatedAt",new Date().toISOString());

          // Cascade to every downstream stage that has its own PSF field —
          // ONLY overwrites if user hasn't set a manual value already.
          var sfhData=(data.sfh)||{};
          if(!num(sfhData.basePsf)) up("sfh","basePsf",String(salePlumb));
          var epeData=(data.epe)||{};
          if(!num(epeData.salePsf)) up("epe","salePsf",String(weightedPsf));
          // BTR/PBSA blended PSF — typically 90-105% of SFH PSF for apartments
          var hraData=(data.hra)||{};
          if(!num(hraData.oPsf))  up("hra","oPsf",String(Math.round(weightedPsf*0.98)));
          if(!num(hraData.sPsf))  up("hra","sPsf",String(Math.round(weightedPsf*1.05)));  // studios cmd premium
          if(!num(hraData.tPsf))  up("hra","tPsf",String(Math.round(weightedPsf*0.92)));  // 2-beds slight discount
          // EPE new-build PSF
          if(!num(epeData.newPsf)) up("epe","newPsf",String(Math.round(weightedPsf*1.05))); // new build cmd premium
        } else {
          up("rlv","lrError","No transactions found for "+district+". The Land Registry SPARQL endpoint has partial coverage. Try entering the sale price manually using local agent data — Rightmove or Zoopla sold prices for the area.");
        }
        clearTimeout(lrTimeout);
        up("rlv","lrLoading",false);
      })
      .catch(function(err){
        clearTimeout(lrTimeout);
        up("rlv","lrError","Land Registry connection failed. Use Rightmove/Zoopla sold prices and enter the sale price manually below.");
        up("rlv","lrLoading",false);
      });
    }

  

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Land Valuation Engine"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:14}},"Live Land Registry data + residual land value calculation"),

      // Transparency banner when no city/postcode has been identified
      !rCityKnown && e("div",{style:{padding:"10px 14px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:6,fontSize:11,color:"#B05A35",lineHeight:1.6,marginBottom:14}},
        e("strong",null,"⚠ No location data set. "),
        "Landform doesn't yet know which city or postcode this site is in, so it's using UK-average defaults for build cost, sale PSF, and yield benchmarks. Any references to 'Manchester' or other northern markets below should be ignored — they're the technical fallback, not your actual market. ",
        e("strong",null,"Fix: "),"enter the postcode in the search box below (the outcode like TN12 is enough), or set the city in Land Appraisal."
      ),
      rCityKnown && e("div",{style:{padding:"8px 14px",background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.3)",borderRadius:6,fontSize:11,color:"#1d5446",lineHeight:1.6,marginBottom:14}},
        "📍 Market data: ",e("strong",null,cityName(rCity)),
        " · BTR rent benchmark: £"+rm.btr+"/mo · Build cost typical: £"+rm.build+"/sqft · Yield: "+(rm.yield*100).toFixed(2)+"%"
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Land Registry Price Search"),
        e("div",{style:{display:"flex",gap:12,alignItems:"flex-end",marginBottom:12}},
          e("div",{style:{flex:1,display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Postcode (outcode or full)"),
            e("input",{value:r.postcode||"",onChange:function(ev){up("rlv","postcode",ev.target.value.toUpperCase());},onKeyDown:function(ev){if(ev.key==="Enter")fetchLR();},placeholder:"e.g. TN12 (or TN12 6AB)",style:Object.assign({},S.input,{textTransform:"uppercase"})})
          ),
          e("button",{id:"lr-search-btn",onClick:fetchLR,disabled:lrLoading||!r.postcode,style:Object.assign({},S.btn,{flexShrink:0,padding:"9px 18px",opacity:lrLoading?0.7:1})},lrLoading?"⏳ Searching LR...":"🔍 Search LR"),
          lrLoading&&e("div",{style:{fontSize:10,color:"#7278A0",marginTop:4,fontStyle:"italic"}},"Land Registry query can take 10-30 seconds. You can enter the sale price manually below while waiting.")
        ),
        pcData&&e("div",{style:{background:"#EEEEF8",borderRadius:6,padding:"8px 12px",fontSize:12,color:"#3A3D6A",marginBottom:8}},
          "City identified: "+cityName(pcData.city)+(pcData.salePsf?" · Local benchmark: £"+pcData.salePsf+"/sqft":"")
        ),
        lrError&&e("div",{style:{background:"#FFF0EC",border:"1px solid #E8C4B0",borderRadius:6,padding:"10px 14px",fontSize:12,color:"#8A3A1A"}},lrError),
        lrData&&e("div",null,
          e("div",{style:{textAlign:"center",padding:18,background:"linear-gradient(135deg,#EEEEF8,#E4E4F4)",borderRadius:10,marginBottom:12}},
            e("div",{style:{fontSize:48,fontWeight:800,color:"#4A4BAE",lineHeight:1}},"£"+(lrData.wPsf||lrData.weightedPsf||0).toLocaleString(),e("span",{style:{fontSize:18,color:"#7278A0"}},"/sqft")),
            e("div",{style:{fontSize:13,fontWeight:600,color:"#2E2F8A",marginTop:6}},"Weighted average — "+(lrData.totalTx||lrData.total||0)+" Land Registry transactions"),
            e("div",{style:{fontSize:11,color:"#7278A0",marginTop:4}},"Sector: "+(lrData.sector||lrData.lrSectorUsed||""))
          ),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:12}},
            (lrData.typeStats||[]).map(function(t){
              return e("div",{key:t.code,style:{background:"#fff",border:"1px solid #DDE0ED",borderTop:"3px solid #4A4BAE",borderRadius:8,padding:12}},
                e("div",{style:{fontSize:10,fontWeight:700,color:"#7278A0",textTransform:"uppercase",marginBottom:6}},t.label),
                e("div",{style:{fontSize:18,fontWeight:700,color:"#2E2F8A"}},fmt(t.avgAmt||t.avg||0)),
                e("div",{style:{fontSize:11,fontWeight:600,color:"#4A4BAE"}},"£"+(t.avgPsf||t.psf||0)+"/sqft"),
                e("div",{style:{fontSize:10,color:"#7278A0"}},(t.count||0)+" sales")
              );
            })
          ),
          e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden"}},
            e("div",{style:{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"8px 12px",background:"#F7F8FC",fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",fontWeight:700,borderBottom:"1px solid #DDE0ED"}},
              e("span",null,"Address"),e("span",null,"Postcode"),e("span",null,"Date"),e("span",null,"Price")
            ),
            (lrData.transactions||lrData.rows||[]).map(function(t,i){
              return e("div",{key:i,style:{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"7px 12px",borderBottom:"1px solid #DDE0ED",fontSize:11,color:"#7278A0",alignItems:"center"}},
                e("span",{style:{color:"#2E2F8A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},(t.address||t.addr||"—")+" "+(t.type||"")),
                e("span",{style:{color:"#4A4BAE",fontWeight:700}},(t.postcode||t.pc||"")),
                e("span",null,(t.date||"")),
                e("span",{style:{fontWeight:600,color:"#2E2F8A"}},fmt(t.amount||0))
              );
            })
          ),
          e("div",{style:{fontSize:10,color:"#7278A0",fontStyle:"italic",padding:"6px 4px"}},"Source: HM Land Registry Price Paid Data (Open Government Licence)")
        ),
        lrData&&e("button",{onClick:function(){
          var nl="\n";
          var lvLines=["LAND VALUATION EXPORT","Postcode: "+(r.postcode||"n/a"),"City: "+cityName(city),"Benchmark: £"+(lrData.wPsf||lrData.weightedPsf||0)+"/sqft","Transactions: "+(lrData.totalTx||lrData.total||0),"Units: "+(r.units||"n/a"),"Sqft: "+(r.avgSqft||"n/a"),"Sale psf: £"+(r.salePsf||"n/a"),"Build psf: £"+(r.buildPsf||m.build)];
          var el=document.createElement("textarea");el.value=lvLines.join(nl);document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);
          notify("Land Valuation figures copied to clipboard");
        },style:{marginTop:8,padding:"5px 12px",background:"#4A4BAE",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"📋 Copy LV Figures")
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Residual Land Valuation"),

        // v9.15 — scheme type mismatch warning + auto-fix
        schemeMismatch && e("div",{style:{padding:"12px 14px",background:"rgba(176,90,53,0.10)",border:"1px solid rgba(176,90,53,0.4)",borderRadius:6,fontSize:12,color:"#8A3A1A",lineHeight:1.6,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}},
          e("div",{style:{flex:1,minWidth:240}},
            e("div",{style:{fontWeight:700,marginBottom:4}},"⚠ Scheme type doesn't match the deal"),
            e("div",null,
              "Deal asset type is ",e("strong",null,(data.assetType||"").toUpperCase()),
              " but RLV scheme type is set to ",e("strong",null,'"'+(r.schType||"")+'"'),
              ". This means RLV is using £"+bt.mid+"/sqft build cost (apartments mid) instead of the SFH benchmark for "+(rCityKnown?cityName(rCity):"this area")+
              ". This is the most common cause of wildly negative RLVs."
            )
          ),
          e("button",{
            onClick:function(){
              var correct = (data.assetType||"").toLowerCase()==="sfh" ? "Residential houses"
                : (data.assetType||"").toLowerCase()==="btr" ? "BTR (Build to Rent)"
                : (data.assetType||"").toLowerCase()==="pbsa" ? "PBSA (Student)"
                : "Residential houses";
              setData(function(prev){
                return Object.assign({},prev,{rlv:Object.assign({},prev.rlv||{},{schType:correct, buildPsf:""})});
              });
            },
            style:{padding:"8px 14px",background:"#B05A35",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",flexShrink:0}
          },"Fix automatically →")
        ),

        // v9.15 — informational note if RLV is heavily negative with no explanation
        !schemeMismatch && rRlv < 0 && rGdv > 0 && Math.abs(rRlv) > rGdv*0.05 && e("div",{style:{padding:"12px 14px",background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.25)",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:14}},
          e("strong",{style:{color:"#2E2F8A"}},"ℹ RLV is heavily negative — check your inputs: "),
          "Build cost £",rBuild,"/sqft and sale price £",rSalePsf,"/sqft drive most of the gap. If these are inflated, RLV will be unrepresentative. "+
          "Realistic UK SFH build cost is £160–195/sqft; apartments £200–260/sqft. Realistic Maldon area SFH sale is £270–340/sqft."
        ),

        // v9.18 — Unit-sync warning when Planning and RLV disagree
        // Most common cause of cross-stage confusion: Planning says 627, RLV says 220, neither is "right"
        (function(){
          var planUnits = num(data.planning&&data.planning.units || 0);
          var rlvUnits = num(r.units || 0);
          if(planUnits > 0 && rlvUnits > 0 && planUnits !== rlvUnits){
            return e("div",{style:{padding:"12px 14px",background:"rgba(176,90,53,0.10)",border:"1px solid rgba(176,90,53,0.4)",borderRadius:6,fontSize:12,color:"#8A3A1A",lineHeight:1.6,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}},
              e("div",{style:{flex:1,minWidth:240}},
                e("div",{style:{fontWeight:700,marginBottom:4}},"⚠ Unit count mismatch across stages"),
                e("div",null,
                  "Planning stage says ",e("strong",null,planUnits+" units"),
                  " but RLV stage says ",e("strong",null,rlvUnits+" units"),
                  ". Pick one — RLV currently calculates against ",e("strong",null,rlvUnits+" units"),"."
                )
              ),
              e("div",{style:{display:"flex",gap:6,flexShrink:0}},
                e("button",{
                  onClick:function(){up("rlv","units",planUnits);},
                  style:{padding:"7px 12px",background:"#B05A35",border:"none",color:"#fff",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}
                },"Use Planning's "+planUnits),
                e("button",{
                  onClick:function(){up("planning","units",rlvUnits);},
                  style:{padding:"7px 12px",background:"transparent",border:"1px solid #B05A35",color:"#B05A35",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}
                },"Push RLV's "+rlvUnits+" →")
              )
            );
          }
          if(planUnits > 0 && !rlvUnits){
            return e("div",{style:{padding:"10px 14px",background:"rgba(74,75,174,0.08)",border:"1px solid rgba(74,75,174,0.3)",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}},
              e("div",null,"Planning stage has ",e("strong",null,planUnits+" units")," but RLV is empty. Copy across?"),
              e("button",{
                onClick:function(){up("rlv","units",planUnits);},
                style:{padding:"6px 12px",background:"#4A4BAE",border:"none",color:"#fff",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"Copy "+planUnits+" units →")
            );
          }
          return null;
        })(),

        // v9.34 — RLV input status + lock button
        // Phil reported "RLV figures change when changing SFH/Tenure" — this is the fallback chain
        // working as designed but confusingly. This banner makes the dependency visible and gives
        // a one-click way to "pin" current auto-defaults so upstream changes stop affecting RLV.
        (function(){
          var emptyFields = [];
          if(!num(r.salePsf)) emptyFields.push({k:"salePsf", v:Math.round(rSalePsf), label:"Sale £/sqft"});
          if(!num(r.buildPsf)) emptyFields.push({k:"buildPsf", v:Math.round(rBuild), label:"Build £/sqft"});
          if(!num(r.units)) emptyFields.push({k:"units", v:num(data.planning&&data.planning.units)||0, label:"Units"});
          if(!num(r.avgSqft)) emptyFields.push({k:"avgSqft", v:rSqft, label:"Avg sqft"});
          if(!num(r.profitPct)) emptyFields.push({k:"profitPct", v:rProfit, label:"Profit %"});
          if(!num(r.finRate)) emptyFields.push({k:"finRate", v:rFin, label:"Finance %"});
          if(!num(r.s106pu)) emptyFields.push({k:"s106pu", v:numOr(r.s106pu, 8000), label:"S106/CIL"});

          if(emptyFields.length === 0) return null;  // all locked, no warning needed

          return e("div",{style:{padding:"12px 14px",background:"rgba(154,123,62,0.06)",border:"1px solid rgba(154,123,62,0.3)",borderRadius:8,marginBottom:14}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}},
              e("div",{style:{flex:1,minWidth:240}},
                e("div",{style:{fontSize:11,fontWeight:800,color:"#9A7B3E",letterSpacing:".05em",textTransform:"uppercase",marginBottom:6}},
                  "⚠ "+emptyFields.length+" RLV field"+(emptyFields.length>1?"s":"")+" using upstream auto-defaults"
                ),
                e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6,marginBottom:6}},
                  "These fields are empty, so RLV derives them from postcode/city/BCIS data. ",
                  e("strong",null,"Changing SFH city or postcode will shift the RLV result"),
                  " until you either type a value here or click 'Pin to current values' below."
                ),
                e("div",{style:{fontSize:10,color:"#7278A0",lineHeight:1.5}},
                  "Current auto-defaults: ",
                  emptyFields.map(function(f, i){
                    return [
                      i>0 && e("span",{key:"sep"+i},", "),
                      e("strong",{key:"k"+i,style:{color:"#3A3D6A"}},f.label+" "+(f.k==="salePsf"||f.k==="buildPsf"?"£":"")+f.v+(f.k==="profitPct"||f.k==="finRate"?"%":""))
                    ];
                  })
                )
              ),
              e("button",{
                onClick:function(){
                  if(!window.confirm("Pin all "+emptyFields.length+" empty RLV fields to their current auto-default values? After this, changing SFH/Tenure/Land won't affect RLV.")) return;
                  setData(function(prev){
                    var rlvNext = Object.assign({},prev.rlv||{});
                    emptyFields.forEach(function(f){ rlvNext[f.k] = String(f.v); });
                    rlvNext._pinnedAt = new Date().toISOString();
                    // v9.36 — Snapshot of upstream values at time of pin.
                    // Used for drift detection: if any of these change later, we surface a warning.
                    rlvNext._pinnedSnapshot = {
                      sfh_basePsf: num(prev.sfh&&prev.sfh.basePsf) || 0,
                      sfh_buildPsf: num(prev.sfh&&prev.sfh.buildPsf) || 0,
                      sfh_profitPct: num(prev.sfh&&prev.sfh.profitPct) || 0,
                      sfh_finRate: num(prev.sfh&&prev.sfh.finRate) || 0,
                      sfh_s106pu: num(prev.sfh&&prev.sfh.s106pu) || 0,
                      land_postcode: String((prev.land&&prev.land.postcode)||"").toUpperCase(),
                      land_city: String((prev.land&&prev.land.city)||""),
                      planning_units: num(prev.planning&&prev.planning.units) || 0,
                      assetType: String(prev.assetType||"")
                    };
                    return Object.assign({},prev,{rlv:rlvNext});
                  });
                },
                style:{padding:"9px 14px",background:"#9A7B3E",border:"none",color:"#fff",borderRadius:5,fontSize:11,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap",flexShrink:0}
              },"🔒 Pin to current values")
            )
          );
        })(),

        // v9.36 — Drift detection for pinned RLV
        // Phil's insight: pinning isn't enough. If upstream values change after pinning,
        // the pinned RLV is stale and "no good having false information further back".
        // This banner detects drift and offers Re-sync / Keep / Unpin.
        (function(){
          if(!r._pinnedAt || !r._pinnedSnapshot) return null;
          var snap = r._pinnedSnapshot;
          var drift = [];
          var nowSfh_basePsf = num(data.sfh&&data.sfh.basePsf) || 0;
          var nowSfh_buildPsf = num(data.sfh&&data.sfh.buildPsf) || 0;
          var nowSfh_profitPct = num(data.sfh&&data.sfh.profitPct) || 0;
          var nowSfh_finRate = num(data.sfh&&data.sfh.finRate) || 0;
          var nowSfh_s106pu = num(data.sfh&&data.sfh.s106pu) || 0;
          var nowLand_postcode = String((data.land&&data.land.postcode)||"").toUpperCase();
          var nowLand_city = String((data.land&&data.land.city)||"");
          var nowPlanning_units = num(data.planning&&data.planning.units) || 0;
          var nowAssetType = String(data.assetType||"");

          if(snap.sfh_basePsf && nowSfh_basePsf && Math.abs(snap.sfh_basePsf - nowSfh_basePsf) > 1)
            drift.push({field:"SFH base sale £/sqft", was:"£"+snap.sfh_basePsf, now:"£"+nowSfh_basePsf});
          if(snap.sfh_buildPsf && nowSfh_buildPsf && Math.abs(snap.sfh_buildPsf - nowSfh_buildPsf) > 1)
            drift.push({field:"SFH build £/sqft", was:"£"+snap.sfh_buildPsf, now:"£"+nowSfh_buildPsf});
          if(snap.sfh_profitPct && nowSfh_profitPct && Math.abs(snap.sfh_profitPct - nowSfh_profitPct) > 0.5)
            drift.push({field:"SFH developer profit", was:snap.sfh_profitPct+"%", now:nowSfh_profitPct+"%"});
          if(snap.sfh_finRate && nowSfh_finRate && Math.abs(snap.sfh_finRate - nowSfh_finRate) > 0.25)
            drift.push({field:"SFH finance rate", was:snap.sfh_finRate+"%", now:nowSfh_finRate+"%"});
          if(snap.sfh_s106pu && nowSfh_s106pu && Math.abs(snap.sfh_s106pu - nowSfh_s106pu) > 100)
            drift.push({field:"SFH S106/plot", was:"£"+snap.sfh_s106pu.toLocaleString(), now:"£"+nowSfh_s106pu.toLocaleString()});
          if(snap.land_postcode && nowLand_postcode && snap.land_postcode !== nowLand_postcode)
            drift.push({field:"Postcode", was:snap.land_postcode, now:nowLand_postcode});
          if(snap.land_city && nowLand_city && snap.land_city !== nowLand_city)
            drift.push({field:"City", was:cityName(snap.land_city), now:cityName(nowLand_city)});
          if(snap.planning_units && nowPlanning_units && Math.abs(snap.planning_units - nowPlanning_units) > 0)
            drift.push({field:"Planning units", was:snap.planning_units, now:nowPlanning_units});
          if(snap.assetType && nowAssetType && snap.assetType !== nowAssetType)
            drift.push({field:"Asset type", was:snap.assetType.toUpperCase(), now:nowAssetType.toUpperCase()});

          if(drift.length === 0){
            // Pinned and no drift — small confirmation
            var pinDate = new Date(r._pinnedAt);
            var hoursAgo = Math.round((Date.now() - pinDate.getTime()) / 3600000);
            var timeLabel = hoursAgo < 1 ? "just now" : hoursAgo < 24 ? hoursAgo+"h ago" : Math.round(hoursAgo/24)+"d ago";
            return e("div",{style:{padding:"10px 14px",background:"rgba(45,122,101,0.06)",border:"1px solid rgba(45,122,101,0.25)",borderRadius:8,marginBottom:14,display:"flex",alignItems:"center",gap:10}},
              e("span",{style:{fontSize:14}},"🔒"),
              e("div",{style:{flex:1}},
                e("div",{style:{fontSize:11,fontWeight:700,color:"#2D7A65"}},"RLV pinned · upstream unchanged"),
                e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2}},"Pinned "+timeLabel+". All tracked upstream values match the pin snapshot.")
              ),
              e("button",{
                onClick:function(){
                  if(!window.confirm("Clear pin? RLV will go back to using live auto-defaults from upstream.")) return;
                  setData(function(prev){
                    var rlvNext = Object.assign({},prev.rlv||{});
                    delete rlvNext._pinnedAt;
                    delete rlvNext._pinnedSnapshot;
                    return Object.assign({},prev,{rlv:rlvNext});
                  });
                },
                style:{padding:"5px 10px",background:"transparent",border:"1px solid rgba(45,122,101,0.4)",color:"#2D7A65",borderRadius:4,fontSize:9,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"Unpin")
            );
          }

          // Drift detected — show warning with options
          return e("div",{style:{padding:"12px 14px",background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.4)",borderRadius:8,marginBottom:14}},
            e("div",{style:{marginBottom:10}},
              e("div",{style:{fontSize:11,fontWeight:800,color:"#B05A35",letterSpacing:".05em",textTransform:"uppercase",marginBottom:6}},
                "⚠ Upstream changed since RLV was pinned"
              ),
              e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
                "Your RLV figures may be stale. The values below were pinned ",new Date(r._pinnedAt).toLocaleString("en-GB"),
                ". Since then, ",e("strong",null,drift.length+" upstream value"+(drift.length>1?"s have":" has")+" changed."),
                " Decide whether to keep your pinned RLV or re-sync to current upstream defaults."
              )
            ),
            e("div",{style:{padding:"8px 10px",background:"#fff",borderRadius:5,border:"1px solid #F0DACA",marginBottom:10}},
              drift.map(function(d, i){
                return e("div",{key:i,style:{display:"grid",gridTemplateColumns:"1.4fr 90px 90px",fontSize:10,padding:"4px 0",borderBottom:i<drift.length-1?"1px solid #F8F1E8":"none",gap:8,alignItems:"center"}},
                  e("span",{style:{color:"#3A3D6A",fontWeight:600}},d.field),
                  e("span",{style:{color:"#7278A0"}},"was: ",e("strong",null,String(d.was))),
                  e("span",{style:{color:"#B05A35"}},"now: ",e("strong",null,String(d.now)))
                );
              })
            ),
            e("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
              e("button",{
                onClick:function(){
                  if(!window.confirm("Re-sync RLV: clear pinned values so they recompute from current upstream defaults?")) return;
                  setData(function(prev){
                    var rlvNext = Object.assign({},prev.rlv||{});
                    delete rlvNext.salePsf;
                    delete rlvNext.buildPsf;
                    delete rlvNext.profitPct;
                    delete rlvNext.finRate;
                    delete rlvNext.s106pu;
                    delete rlvNext._pinnedAt;
                    delete rlvNext._pinnedSnapshot;
                    return Object.assign({},prev,{rlv:rlvNext});
                  });
                },
                style:{padding:"7px 14px",background:"#B05A35",border:"none",color:"#fff",borderRadius:5,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"Re-sync to current →"),
              e("button",{
                onClick:function(){
                  if(!window.confirm("Keep your current pinned RLV values? The snapshot will update to today so the warning disappears.")) return;
                  setData(function(prev){
                    var rlvNext = Object.assign({},prev.rlv||{});
                    rlvNext._pinnedSnapshot = {
                      sfh_basePsf: nowSfh_basePsf,
                      sfh_buildPsf: nowSfh_buildPsf,
                      sfh_profitPct: nowSfh_profitPct,
                      sfh_finRate: nowSfh_finRate,
                      sfh_s106pu: nowSfh_s106pu,
                      land_postcode: nowLand_postcode,
                      land_city: nowLand_city,
                      planning_units: nowPlanning_units,
                      assetType: nowAssetType
                    };
                    rlvNext._pinnedAt = new Date().toISOString();
                    return Object.assign({},prev,{rlv:rlvNext});
                  });
                },
                style:{padding:"7px 14px",background:"transparent",border:"1px solid #B05A35",color:"#B05A35",borderRadius:5,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"Keep my values"),
              e("button",{
                onClick:function(){
                  setData(function(prev){
                    var rlvNext = Object.assign({},prev.rlv||{});
                    delete rlvNext._pinnedAt;
                    delete rlvNext._pinnedSnapshot;
                    return Object.assign({},prev,{rlv:rlvNext});
                  });
                },
                style:{padding:"7px 14px",background:"transparent",border:"1px solid #C5C8E0",color:"#7278A0",borderRadius:5,fontSize:10,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"Unpin entirely")
            )
          );
        })(),

        e("div",{style:S.grid2},
          e(Inp,{label:"Avg Unit Size (sqft)"+(num(r.avgSqft)?" · saved":" · auto-default"),type:"number",value:r.avgSqft,onChange:function(v){up("rlv","avgSqft",v);},placeholder:"850"}),
          e(Inp,{
            label: (num(r.salePsf)?"Sale £/sqft · saved":(rNbInfo
              ? "Sale £/sqft · auto-default — new-build estimate £"+rNbInfo.newBuild+" (existing £"+rNbInfo.existing+" + "+rNbInfo.premiumPct+"% premium)"
              : "Sale £/sqft · auto-default"+(m?" from "+cityName(city)+": £"+Math.round((pcData&&pcData.salePsf)||(estSalePsfFromRent(m.btr))||260):""))),
            type:"number",value:r.salePsf,onChange:function(v){up("rlv","salePsf",v);},placeholder:"£"+Math.round(rSalePsf)
          }),
          e(Inp,{label:(num(r.buildPsf)?"Build £/sqft · saved":"Build £/sqft · auto-default"+(m?" from "+cityName(city)+": £"+m.build+" · BCIS £"+bt.lo+"–£"+bt.hi:" · BCIS £"+bt.lo+"–£"+bt.hi)),type:"number",value:r.buildPsf,onChange:function(v){up("rlv","buildPsf",v);},placeholder:"£"+Math.round(rBuild)}),
          e(Inp,{label:"Developer Profit % GDV"+(num(r.profitPct)?" · saved":" · auto-default 17.5%"),type:"number",value:r.profitPct,onChange:function(v){up("rlv","profitPct",v);},placeholder:"17.5"}),
          e(Inp,{label:"Finance Rate %"+(num(r.finRate)?" · saved":" · auto-default 7.5%"),type:"number",value:r.finRate,onChange:function(v){up("rlv","finRate",v);},placeholder:"7.5"}),
          e(Inp,{label:"S106/CIL per Unit (£)"+(num(r.s106pu)?" · saved":" · auto-default £8,000"),type:"number",value:r.s106pu,onChange:function(v){up("rlv","s106pu",v);},placeholder:"8000"})
        ),

        // ── Build:Sale ratio diagnostic ─────────────────────────────────────
        rSalePsf>0&&rBuild>0&&(function(){
          var ratio=rBuild/rSalePsf*100;
          var verdict=ratio<=60?{c:"#2D7A65",msg:"Strong margin — build is "+Math.round(ratio)+"% of sale PSF (institutional sweet spot 55-65%)"}:
                      ratio<=75?{c:"#9A7B3E",msg:"Tight margin — build is "+Math.round(ratio)+"% of sale PSF (above 70% squeezes profit)"}:
                      {c:"#B05A35",msg:"Structurally unviable — build is "+Math.round(ratio)+"% of sale PSF. Either sale values are too low for this market or build cost is over-specified. Even at 0% land, fees + finance + profit will not fit."};
          return e("div",{style:{margin:"10px 0",padding:"10px 14px",background:verdict.c+"14",borderLeft:"3px solid "+verdict.c,borderRadius:6,fontSize:12,color:verdict.c,fontWeight:600}},
            "Build : Sale ratio — "+verdict.msg
          );
        })(),

        // ── ACQUISITION COSTS TOGGLE ────────────────────────────────────────
        e("div",{style:{margin:"12px 0",padding:"12px 14px",background:"#F8F8FE",border:"1px solid #DDE0ED",borderRadius:8}},
          e("div",{style:{display:"flex",alignItems:"center",gap:10,justifyContent:"space-between",flexWrap:"wrap"}},
            e("div",null,
              e("label",{style:{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,fontWeight:700,color:"#2E2F8A"}},
                e("input",{type:"checkbox",checked:!!r.includeAcqCosts,onChange:function(ev){up("rlv","includeAcqCosts",ev.target.checked);},style:{width:16,height:16,cursor:"pointer"}}),
                "Include land acquisition costs in RLV (SDLT · agent fees · legal fees · land finance)"
              ),
              e("div",{style:{fontSize:10,color:"#7278A0",marginTop:4,marginLeft:24,lineHeight:1.5}},
                r.includeAcqCosts?"RLV now reflects what you can actually pay the vendor after costs. Reduces headline by ~5-7%.":"Default RLV is the maximum land bid before acquisition costs. Toggle on to see net-to-vendor."
              )
            ),
            r.includeAcqCosts&&num(data.land&&data.land.price)>0&&(function(){
              var DM2=calcDealMetrics(data);
              return e("div",{style:{textAlign:"right",fontSize:11}},
                e("div",{style:{color:"#7278A0",fontSize:9,letterSpacing:".08em",textTransform:"uppercase"}},"Acquisition costs"),
                e("div",{style:{color:"#B05A35",fontWeight:800,fontSize:14}},fmt(DM2.totalAcqCosts)),
                e("div",{style:{fontSize:9,color:"#7278A0",marginTop:2}},
                  "SDLT "+fmt(DM2.sdlt)+" · Legals "+fmt(DM2.legalFees)+" · Agent "+fmt(DM2.agentFees)+" · Finance "+fmt(DM2.landFinance)
                )
              );
            })()
          )
        ),

        // ── SCREENING ESTIMATE NOTICE ─────────────────────────────────────
        e("div",{style:{margin:"10px 0",padding:"8px 12px",background:"rgba(74,75,174,0.06)",border:"1px solid rgba(74,75,174,0.18)",borderRadius:5,fontSize:10,color:"#4A4BAE",lineHeight:1.6}},
          "ℹ ",e("strong",null,"Screening estimate. "),"Finance cost shown is a simple % of build+fees (not phased S-curve). For institutional-grade output use ",e("strong",{style:{cursor:"pointer",textDecoration:"underline"},onClick:function(){navTo("viability");}},"Detailed Appraisal")," — full RICS-format residual with phased finance modelling."
        ),

        // v9.41 — Multi-route GDV transparency banner
        // Phil's audit: RLV was using full retail GDV. Now shows the blended adjustment.
        rHasMultiRoute && e("div",{style:{margin:"10px 0",padding:"12px 14px",background:"rgba(154,123,62,0.08)",border:"1px solid rgba(154,123,62,0.35)",borderRadius:6,fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
          e("div",{style:{fontSize:10,fontWeight:800,color:"#7B6432",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}},"⚠ Multi-route exit detected — GDV adjusted from SFH House Mix"),
          e("div",{style:{marginBottom:8}},
            "Your SFH House Mix has units exiting via AHP / non-private routes. RLV now uses the ",
            e("strong",null,"blended realisable GDV "+fmt(rBlendedGdv)),
            " (",pct((1-rBlendFactor)*100)," reduction from retail ",fmt(rRetailGdv),") instead of full retail. This is the figure Cassidy can actually realise."
          ),
          e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:6,fontSize:10}},
            rRouteSummary.map(function(rs){
              return e("div",{key:rs.tenure,style:{padding:"6px 8px",background:"#fff",border:"1px solid #F0DACA",borderRadius:4}},
                e("div",{style:{color:"#7278A0",fontSize:9}},rs.label),
                e("div",{style:{color:"#3A3D6A",fontWeight:700}},rs.count+" units"),
                e("div",{style:{color:rs.discount===1?"#2D7A65":"#B05A35",fontSize:9}},pct(rs.discount*100)+" MV")
              );
            })
          )
        ),

        rUnits>0&&rGdv>0&&e("div",null,
          e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:12,marginBottom:12}},
            e("div",{style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,padding:14}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:4}},"GDV Breakdown"),
              [{l:"Build cost",v:rBc},{l:"Prof fees ("+Math.round(rFeesPct*100)+"%)",v:rFees},{l:"Contingency ("+rCont+"%)",v:rContCost},{l:"Finance ("+rFin+"%)",v:rFinCost},{l:"S106/CIL",v:rS106}].concat(rRoads>0?[{l:"Roads & Sewers",v:rRoads}]:[]).concat(rInfra>0?[{l:"Site Infra & SuDS",v:rInfra}]:[]).concat(rMarketing>0?[{l:"Disposal & marketing",v:rMarketing}]:[]).concat(rPlan>0?[{l:"Planning fees",v:rPlan}]:[]).concat([{l:"Dev profit ("+rProfit+"%)",v:rDevProfit,warn:rProfit<15}]).map(function(row){
                // v9.26 — Highlight rows that look wrong (e.g. 0% profit)
                var rowColor = row.warn ? "#B05A35" : "#7278A0";
                var rowBg = row.warn ? "rgba(176,90,53,0.06)" : "transparent";
                return e("div",{key:row.l,style:{display:"flex",justifyContent:"space-between",fontSize:11,color:rowColor,padding:"3px 4px",borderBottom:"1px solid #DDE0ED",background:rowBg,fontWeight:row.warn?700:400}},
                  e("span",null, row.warn ? "⚠ "+row.l : row.l),
                  e("span",null,"("+fmt(row.v)+")"+(row.warn ? " ← below threshold" : ""))
                );
              })
            ),
            e("div",{style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,padding:14}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:4}},"Summary"),
              (rHasMultiRoute
                ? [{l:"GDV (retail)",v:rRetailGdv,muted:true},{l:"− Route discounts",v:-(rRetailGdv-rBlendedGdv),muted:true,red:true},{l:"GDV (blended realisable)",v:rGdv,bold:true},{l:"Total Costs + Profit",v:rGdv-rRlv}]
                : [{l:"GDV",v:rGdv,bold:true},{l:"Total Costs + Profit",v:rGdv-rRlv}]
              ).map(function(row){
                return e("div",{key:row.l,style:{display:"flex",justifyContent:"space-between",fontSize:row.muted?11:12,fontWeight:row.bold?700:600,color:row.red?"#B05A35":(row.muted?"#7278A0":"#2E2F8A"),padding:"4px 0",borderBottom:"1px solid #DDE0ED"}},
                  e("span",null,row.l),e("span",null,(row.v<0?"−":"")+fmt(Math.abs(row.v)))
                );
              }),
              e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:sc,padding:"8px 0",borderTop:"2px solid #DDE0ED",marginTop:4}},
                e("span",null,"Max Land Bid"),e("span",null,fmt(rRlv))
              )
            )
          ),
          e("div",{style:rResultStyle},
            e("div",{style:Object.assign({},S.tag,{color:sc,marginBottom:6})},"Maximum Residual Land Value"),
            e("div",{style:Object.assign({},S.bigNum,{color:sc})},fmt(rRlv)),
            e("div",{style:{fontSize:12,color:"#7278A0",display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}},
              e("span",null,fmt(rlvPu)+" per unit"),
              e("span",null,"Land: "+pct(rlvPctGdv)+" of GDV"),
              e("span",{style:{color:sc,fontWeight:700}},rViable?"✓ Viable":(rRlv>0?"⚠ Below 15% threshold":"✗ Negative — does not stack"))
            )
          ),

          // ── MAKE IT STACK — numeric solver: the exact single-lever change on
          // each lever that lifts the residual to cover the asking price (or £0).
          (function(){
            if(typeof optimiseScheme!=="function") return null;
            var opt=optimiseScheme(data);
            if(opt.stacks || (opt.levers.length===0 && !opt.allInOption)) return null;
            var applyBtn={padding:"5px 12px",background:"#B05A35",color:"#fff",border:"none",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"};
            var rowSt={display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px dashed #EADBC8"};
            // v9.62 — apply DIRECTLY through the shared-input engine with SFH as the
            // "current" stage, so an explicit Apply is never silently blocked when the
            // SFH stage is marked complete (the cause of "tap Apply, nothing happens").
            // It still forward-fills to any non-completed sibling stages.
            function applySfh(key,val){
              setData(function(d){ return applySharedInput(d,"sfh",key,val,"sfh"); });
            }
            function applyLever(lv){
              if(lv.key==="sales"){
                var f=1+lv.required/100;
                var nm=((data.sfh&&data.sfh.mix)||[]).map(function(r){var c=Object.assign({},r); if(num(c.unitPrice))c.unitPrice=String(Math.round(num(c.unitPrice)*f)); else if(num(c.psf))c.psf=String(Math.round(num(c.psf)*f)); return c;});
                applySfh("mix",nm);
              } else { applySfh(lv.key,lv.required); }
            }
            return e("div",{style:{marginTop:12,background:"#FFF8F0",border:"1px solid rgba(176,90,53,0.35)",borderRadius:8,padding:"14px 16px"}},
              e("div",{style:{fontSize:13,fontWeight:800,color:"#B05A35",marginBottom:4}},"🔧 How to make this scheme stack"),
              e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:10,lineHeight:1.5}},
                opt.targetRlv>0
                  ? "The land is worth "+fmt(opt.currentRlv)+" to this scheme, but the asking is "+fmt(opt.targetRlv)+". Each line below is the single change that would close the gap on its own — tap Apply to model it."
                  : "The scheme doesn't break even on land ("+fmt(opt.currentRlv)+"). Each line is the single change that would get it to £0 on its own — tap Apply to model it."
              ),
              opt.allInOption && e("div",{style:rowSt},
                e("div",{style:{fontSize:11,color:"#4A4B6E",flex:1}},e("strong",null,"Mark build cost as all-in")," — "+opt.allInOption.note),
                e("button",{onClick:function(){applySfh("buildInclusive",true);},style:applyBtn},"Apply")
              ),
              opt.levers.map(function(lv){
                return e("div",{key:lv.key,style:rowSt},
                  e("div",{style:{fontSize:11,color:"#4A4B6E",flex:1}},e("strong",null,lv.label+(lv.stretch?" ⚠":""))," — "+lv.note),
                  e("button",{onClick:function(){applyLever(lv);},style:applyBtn},"Apply")
                );
              }),
              e("div",{style:{fontSize:10,color:"#9A7B3E",marginTop:8,fontStyle:"italic"}},"⚠ = a stretch; back it with evidence before relying on it. Applying a change models it across the tool — your other figures stay as you set them.")
            );
          })(),

          // ── COST BREAKDOWN — what's deducted from GDV to reach land value
          e("div",{style:{marginTop:12,background:"#F7F8FC",borderRadius:8,padding:"14px 16px"}},
            e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}},"What's deducted to reach the land value"),
            [
              {l:"Build cost ("+rUnits+" units × "+rSqft+"sqft × £"+rBuild+"/sqft)",v:rBc,pct2:rGdv>0?rBc/rGdv:0},
              {l:"Professional fees & prelims ("+Math.round(rFeesPct*100)+"% of build)",v:rFees,pct2:rGdv>0?rFees/rGdv:0},
              {l:"Contingency ("+rCont+"%)",v:rContCost,pct2:rGdv>0?rContCost/rGdv:0},
              {l:"Development finance ("+rFin+"% on build+fees)",v:rFinCost,pct2:rGdv>0?rFinCost/rGdv:0},
              {l:"S106 obligations (£"+(num(r.s106pu)||8000).toLocaleString()+"/unit)",v:rS106,pct2:rGdv>0?rS106/rGdv:0}
            ].concat(rRoads>0?[{l:"Roads & Sewers (S38/S104)",v:rRoads,pct2:rGdv>0?rRoads/rGdv:0}]:[]).concat(rInfra>0?[{l:"Site infrastructure & SuDS",v:rInfra,pct2:rGdv>0?rInfra/rGdv:0}]:[]).concat(rMarketing>0?[{l:"Disposal & marketing",v:rMarketing,pct2:rGdv>0?rMarketing/rGdv:0}]:[]).concat(rPlan>0?[{l:"Planning & infrastructure fees",v:rPlan,pct2:rGdv>0?rPlan/rGdv:0}]:[]).concat([
              {l:"Developer profit margin ("+rProfit+"%)",v:rDevProfit,pct2:rGdv>0?rDevProfit/rGdv:0}
            ]).map(function(row){
              return e("div",{key:row.l,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px dashed #E8E8F0",fontSize:11}},
                e("span",{style:{color:"#4A4B6E",flex:1}},row.l),
                e("div",{style:{display:"flex",gap:12,alignItems:"center"}},
                  e("div",{style:{width:80,height:5,background:"#E8E8F0",borderRadius:3,overflow:"hidden"}},
                    e("div",{style:{width:Math.min(100,row.pct2*100)+"%",height:"100%",background:"#4A4BAE",borderRadius:3}})
                  ),
                  e("span",{style:{fontWeight:700,color:"#2E2F8A",minWidth:60,textAlign:"right"}},fmt(row.v)),
                  e("span",{style:{color:"#7278A0",minWidth:35,textAlign:"right",fontSize:10}},pct(row.pct2*100))
                )
              );
            }),
            e("div",{style:{display:"flex",justifyContent:"space-between",padding:"8px 0 0",marginTop:4,borderTop:"2px solid #2E2F8A",fontSize:12,fontWeight:800}},
              e("span",{style:{color:"#2E2F8A"}},"Residual Land Value"),
              e("span",{style:{color:sc}},fmt(rRlv)+" ("+pct(rlvPctGdv)+" of GDV)")
            ),
            e("div",{style:{marginTop:8,fontSize:10,color:"#7278A0",lineHeight:1.7}},
              "Note: S106, drainage, utilities and enabling works are included within S106 obligations and infrastructure fees above. ",
              "For site-specific infrastructure costs (S278, flood drainage, utility diversions), use the Detailed Appraisal stage which itemises each cost line."
            )
          ),

          // ── PROJECT TIMELINE ESTIMATOR ──────────────────────────────────
          (function(){
            var planSt=(data.planning&&data.planning.status)||"full consent (assumed — consent basis)";
            var units2=rUnits||num(data.planning&&data.planning.units)||50;
            var schType2=r.schType||"Residential houses";
            var isApart=schType2.indexOf("apart")>=0||schType2.indexOf("BTR")>=0||schType2.indexOf("PBSA")>=0;

            // Planning phase estimate (years)
            var planPhase=planSt==="full"?0:planSt==="outline"?0.5:planSt==="allocated"?1.0:1.5;
            // Reserved matters / discharge conditions
            var rmPhase=planSt==="full"?0:0.5;
            // Pre-commencement (roads, drainage, utilities)
            var preComm=0.5;

            // ── BUILD RATE — scales with scheme size (real housebuilder programmes) ──
            // SFH (houses): single trader builds ~50/yr, but larger schemes are PHASED
            // with multiple plots / outlets running concurrently.
            //   • <50 units    → single outlet, 30-40 units/yr
            //   • 50-150       → 2 outlets, 60-80 units/yr
            //   • 150-300      → 3 outlets, 100-130 units/yr
            //   • 300-600      → 4 outlets, 150-200 units/yr
            //   • 600+         → strategic scheme, 200-250+ units/yr (multiple developers/phases)
            // Apartments: BTR/PBSA single block built faster (concurrent floors), 200-300 units/yr.
            //             Large multi-block schemes split into phases of ~250 units each.
            // v9.99 — shared phased build rate (same helper the SFH House Mix screen uses).
            var buildRate = buildRatePerYear(units2, isApart);

            // Build phase years — but cap at 8 years for max practical scheme
            var buildPhase=Math.max(0.5,Math.min(8,units2/buildRate));
            // Sales runs concurrent with build (esp. for SFH multi-outlet), so don't double-count

            var totalYears=planPhase+rmPhase+preComm+buildPhase;
            var totalRounded=Math.round(totalYears*2)/2; // round to nearest 0.5

            // Timeline segments for display
            var segments=[
              planSt!=="full"&&planSt!=="outline"&&{l:"Planning application",yrs:planPhase,color:"#B05A35"},
              planSt!=="full"&&{l:"Reserved matters / conditions",yrs:rmPhase,color:"#9A7B3E"},
              {l:"Pre-commencement (infrastructure)",yrs:preComm,color:"#4A4BAE"},
              {l:"Construction"+(units2>=150?" (phased / multi-outlet)":""),yrs:Math.round(buildPhase*10)/10,color:"#2D7A65"},
            ].filter(Boolean);

            var maxYrs=Math.max(totalRounded,1);
            var yearLabel=totalRounded===1?"year":"years";

            return e("div",{style:{marginTop:12,background:"#F7F8FC",borderRadius:8,padding:"14px 16px"}},
              e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}},
                e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em"}},"Estimated project timeline"),
                e("div",{style:{fontSize:20,fontWeight:800,color:"#2E2F8A"}},
                  totalRounded+" ",e("span",{style:{fontSize:12,fontWeight:500,color:"#7278A0"}},yearLabel+" total")
                )
              ),
              // Visual bar chart
              e("div",{style:{display:"flex",height:28,borderRadius:6,overflow:"hidden",marginBottom:12}},
                segments.map(function(seg){
                  return e("div",{key:seg.l,
                    style:{flex:seg.yrs,background:seg.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700,minWidth:seg.yrs/maxYrs>0.15?0:0,overflow:"hidden",whiteSpace:"nowrap",padding:"0 4px"}},
                    seg.yrs/totalRounded>0.2?(Math.round(seg.yrs*10)/10+"yr"):""
                  );
                })
              ),
              // Legend
              segments.map(function(seg){
                return e("div",{key:seg.l,style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",fontSize:11}},
                  e("div",{style:{display:"flex",alignItems:"center",gap:6}},
                    e("span",{style:{width:10,height:10,borderRadius:2,background:seg.color,display:"inline-block",flexShrink:0}}),
                    e("span",{style:{color:"#4A4B6E"}},seg.l)
                  ),
                  e("span",{style:{fontWeight:700,color:"#2E2F8A"}},Math.round(seg.yrs*10)/10+" yr"+(seg.yrs!==1?"s":""))
                );
              }),
              e("div",{style:{marginTop:10,paddingTop:8,borderTop:"1px dashed #DDE0ED",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}},
                [{l:"Start on site",v:planSt==="full"?"Ready now":planSt==="outline"?Math.round((rmPhase+preComm)*12)+" mths":"12-24 mths"},
                 {l:"Build rate",v:buildRate+" units/yr"},
                 {l:"Year range",v:Math.floor(totalRounded)+"-"+Math.ceil(totalRounded+0.5)+" yrs"},
                ].map(function(item){
                  return e("div",{key:item.l,style:{background:"#fff",borderRadius:6,padding:"8px 10px",border:"1px solid #DDE0ED"}},
                    e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".08em",marginBottom:2}},item.l),
                    e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A"}},item.v)
                  );
                })
              ),
              e("div",{style:{marginTop:8,fontSize:10,color:"#7278A0",lineHeight:1.7}},
                "Based on "+units2+" units, planning status: "+(planSt||"unknown")+", scheme type: "+schType2+". ",
                units2>=150?"Large schemes assume phased delivery with multiple outlets/plots running concurrently (industry standard for housebuilders). ":"",
                "Adjust in Planning & Viability stage to update. Assumes sequential planning phases; pre-app work and S106 negotiation may run concurrently."
              )
            );
          })(),

          // ── 1. SENSITIVITY SLIDERS ──────────────────────────────────────────
          // v9.15 fix — sliders now compute each variable IN ISOLATION using frozen base values.
          // Previously moving one slider changed data.rlv, which became the new base for all others
          // (so all four sliders interacted with each other instead of testing isolated sensitivity).
          // Also now includes acquisition costs so the base matches the headline RLV.
          (function(){
            // Snapshot the TRUE base values for sensitivity (these don't change when sliders move)
            // v10.1 — anchor the base to the scheme's ACTUAL GDV (the priced house mix the main
            // panel uses), not the raw Sale £/sqft field. That field can hold an existing-stock
            // Land Registry comparable, which made this widget contradict the main panel (one a
            // profit, one a loss). Effective £/sqft = actual GDV ÷ (units × avg sqft), so the
            // base GDV — and hence the base RLV — matches the headline.
            var _mixGdv = (data.sfh && data.sfh.mix && data.sfh.mix.length) ? rGdv : 0;
            var BASE_SP = (_mixGdv>0 && rUnits>0 && (rSqft||850)>0) ? Math.round(_mixGdv/(rUnits*(rSqft||850))) : rSalePsf;
            var BASE_BP = rBuild;
            var BASE_UN = rUnits || 50;
            var BASE_PR = rProfit;
            // Compute true base RLV including acquisition costs to match displayed rRlv
            function rlvCore(sp, bp, un, pr){
              var g = un * (rSqft||850) * sp;
              var bc = un * (rSqft||850) * bp;
              var fees2 = bc * bt.fees;
              var cc = bc * (rCont/100);
              var fc = (bc + fees2) * (rFin/100);
              var s = un * (num(r.s106pu) || 8000);
              var pl = un * bt.plan;
              // v9.98 — include disposal/marketing so the sensitivity base matches the
              // headline RLV (previously omitted, leaving a stray higher "Base RLV").
              var mk2 = g * (numOr((data.sfh&&data.sfh.marketingPct)||r.marketingPct, 0)/100);
              var raw = g - bc - fees2 - cc - fc - s - pl - mk2 - g*(pr/100);
              // Apply same acquisition cost deduction as the main RLV display
              if(r.includeAcqCosts && raw>0){
                var dm = calcDealMetrics(Object.assign({}, data, {rlv:Object.assign({}, r, {salePsf:sp, buildPsf:bp, units:un, profitPct:pr})}));
                raw = raw - num(dm.totalAcqCosts);
              }
              return raw;
            }
            var BASE_RLV = rlvCore(BASE_SP, BASE_BP, BASE_UN, BASE_PR);

            return e("div",{style:{background:"#F7F8FC",borderRadius:8,padding:"14px 16px",marginTop:12}},
              e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}},"Sensitivity Analysis — drag to test scenarios"),
              e("div",{style:{fontSize:10,color:"#7278A0",marginBottom:12,fontStyle:"italic"}},"Each slider isolates one variable. Others stay at base."),
              [
                {k:"salePsf",l:"Sale price £/sqft",base:BASE_SP,min:Math.round(BASE_SP*0.7),max:Math.round(BASE_SP*1.3),step:5,fmt2:function(v){return"£"+v+"/sqft"}},
                {k:"buildPsf",l:"Build cost £/sqft",base:BASE_BP,min:Math.round(BASE_BP*0.7),max:Math.round(BASE_BP*1.3),step:5,fmt2:function(v){return"£"+v+"/sqft"}},
                {k:"units",l:"Number of units",base:BASE_UN,min:Math.max(1,Math.round(BASE_UN*0.5)),max:Math.round(BASE_UN*1.5),step:1,fmt2:function(v){return v+" units"}},
                {k:"profitPct",l:"Developer profit %",base:BASE_PR,min:10,max:30,step:1,fmt2:function(v){return v+"%"}}
              ].map(function(sl){
                // Slider's own value comes from data.rlv[k] if user has dragged it, else its base
                var curVal = num(r["sens_"+sl.k]);
                if(!curVal) curVal = sl.base;
                // Compute RLV at this slider's current value, ALL OTHERS HELD AT BASE
                var adjRlv;
                if(sl.k==="salePsf")   adjRlv = rlvCore(curVal, BASE_BP, BASE_UN, BASE_PR);
                else if(sl.k==="buildPsf")  adjRlv = rlvCore(BASE_SP, curVal, BASE_UN, BASE_PR);
                else if(sl.k==="units") adjRlv = rlvCore(BASE_SP, BASE_BP, curVal, BASE_PR);
                else                    adjRlv = rlvCore(BASE_SP, BASE_BP, BASE_UN, curVal);
                var adjColor = adjRlv > 0 ? "#2D7A65" : "#B05A35";
                var diff = adjRlv - BASE_RLV;
                var pctFromBase = BASE_RLV !== 0 ? (diff / Math.abs(BASE_RLV)) * 100 : 0;

                return e("div",{key:sl.k,style:{marginBottom:14}},
                  e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:6}},
                    e("span",{style:{fontSize:11,color:"#4A4B6E",fontWeight:600}},sl.l),
                    e("div",{style:{display:"flex",gap:12,alignItems:"center"}},
                      e("span",{style:{fontSize:11,color:"#7278A0",fontWeight:600}},sl.fmt2(curVal)),
                      e("span",{style:{fontSize:12,fontWeight:800,color:adjColor}},
                        "RLV: "+fmt(adjRlv)+" ("+(diff>=0?"+":"")+Math.round(pctFromBase)+"% vs base)"
                      )
                    )
                  ),
                  e("input",{
                    type:"range",min:sl.min,max:sl.max,step:sl.step,
                    value:curVal,
                    onChange:function(ev){up("rlv","sens_"+sl.k,Number(ev.target.value));},
                    style:{width:"100%",accentColor:"#4A4BAE",cursor:"pointer"}
                  })
                );
              }),
              e("div",{style:{fontSize:10,color:"#7278A0",marginTop:4,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}},
                e("span",null,"Base RLV: "+fmt(BASE_RLV)+" · sliders show isolated impact"),
                Math.abs(BASE_RLV - rRlv) > 1000 ? e("button",{onClick:function(){
                  setData(function(prev){
                    var rlvNext = Object.assign({},prev.rlv||{});
                    delete rlvNext.sens_salePsf; delete rlvNext.sens_buildPsf;
                    delete rlvNext.sens_units; delete rlvNext.sens_profitPct;
                    return Object.assign({},prev,{rlv:rlvNext});
                  });
                },style:{background:"transparent",border:"none",color:"#4A4BAE",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",textDecoration:"underline"}},"Reset sliders") : null
              )
            );
          })(),

          // ── 2. HOW THIS IS CALCULATED ────────────────────────────────────────
          e("div",{style:{background:"#F7F8FC",borderRadius:8,marginTop:12,overflow:"hidden"}},
            e("div",{
              onClick:function(){up("rlv","showFormula",!r.showFormula);},
              style:{padding:"10px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",userSelect:"none"}
            },
              e("span",{style:{fontSize:10,fontWeight:800,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".1em"}},"📐 How this is calculated"),
              e("span",{style:{fontSize:12,color:"#7278A0"}},r.showFormula?"▲ Hide":"▼ Show")
            ),
            r.showFormula&&e("div",{style:{padding:"4px 16px 16px",borderTop:"1px solid #DDE0ED"}},
              [
                {step:"1",l:"Gross Development Value (GDV)",formula:"Units × Avg sqft × Sale £/sqft",val:fmt(rGdv),note:"Revenue if every unit sells at the assumed price"},
                {step:"2",l:"Build cost",formula:"Units × Avg sqft × Build £/sqft",val:fmt(rBc),note:"Raw construction cost, no fees or contingency"},
                {step:"3",l:"Professional fees & prelims",formula:"Build cost × "+Math.round(rFeesPct*100)+"%",val:fmt(rFees),note:"Architects, engineers, project management, prelims — "+Math.round(rFeesPct*100)+"% is the BCIS norm for this scheme type"},
                {step:"4",l:"Contingency",formula:"Build cost × "+rCont+"%",val:fmt(rContCost),note:"Risk allowance — industry standard 5–10% of build"},
                {step:"5",l:"Development finance",formula:"(Build + fees) × "+rFin+"%",val:fmt(rFinCost),note:"Interest on peak debt — simplified average debt method. Detailed Appraisal uses Normal Distribution cashflow for the true figure"},
                {step:"6",l:"S106 obligations",formula:"Units × £"+(num(r.s106pu)||8000).toLocaleString()+"/unit",val:fmt(rS106),note:"Planning obligations — affordable housing, education, open space. Varies by LPA"}
              ].concat(rRoads>0?[{step:"7",l:"Roads & Sewers (S38/S104)",formula:"Units × roads/plot",val:fmt(rRoads),note:"Estate roads, sewers and adoption works — excluded when the build rate is all-in"}]:[]).concat(rInfra>0?[{step:"8",l:"Site infrastructure & SuDS",formula:"Acres × infra rate",val:fmt(rInfra),note:"Drainage, attenuation, utilities and enabling works — excluded when the build rate is all-in"}]:[]).concat(rPlan>0?[{step:"9",l:"Planning & infrastructure fees",formula:"Units × scheme factor",val:fmt(rPlan),note:"CIL, planning application fees, infrastructure contributions"}]:[]).concat([
                {step:"×",l:"Developer profit",formula:"GDV × "+rProfit+"%",val:fmt(rDevProfit),note:"Required return — majors target 18–22% on GDV. Below 15% most schemes are unviable"},
                {step:"=",l:"Residual Land Value",formula:"GDV − all above costs",val:fmt(rRlv),note:"Maximum you can pay for the land and still hit your profit target",bold:true}
              ]).map(function(row){
                return e("div",{key:row.step,style:{display:"flex",gap:12,padding:"7px 0",borderBottom:"1px dashed #E8E8F2",alignItems:"flex-start"}},
                  e("span",{style:{width:20,height:20,borderRadius:"50%",background:row.bold?"#2E2F8A":"#DDE0ED",color:row.bold?"#fff":"#7278A0",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},row.step),
                  e("div",{style:{flex:1}},
                    e("div",{style:{fontSize:11,fontWeight:row.bold?800:600,color:"#2E2F8A"}},row.l),
                    e("div",{style:{fontSize:10,color:"#7278A0",fontFamily:"DM Mono,monospace",margin:"2px 0"}},row.formula),
                    e("div",{style:{fontSize:10,color:"#9A9AAE",lineHeight:1.5}},row.note)
                  ),
                  e("span",{style:{fontWeight:row.bold?800:600,color:row.bold?(rRlv>0?"#2D7A65":"#B05A35"):"#2E2F8A",fontSize:row.bold?14:12,minWidth:70,textAlign:"right",fontFamily:"DM Mono,monospace"}},row.val)
                );
              })
            )
          ),

          // ── 3. INPUT VALIDATION WARNINGS ─────────────────────────────────────
          (function(){
            var warnings=[];
            var m3=MKT[rCity]||MKT.manchester;
            // Benchmark sale PSF: Land Registry live data > postcode lookup > city-derived > fallback
            var mkt=data.market||{};
            var benchmarkSale;
            if(num(mkt.lrPsf)>0) benchmarkSale=num(mkt.lrPsf);
            else if(pcData&&pcData.salePsf) benchmarkSale=pcData.salePsf;
            else if(m3&&m3.btr){
              // Convert monthly rent to a sensible sale PSF estimate, clamped to realistic UK range
              var derived=Math.round(estSalePsfFromRent(m3.btr));
              benchmarkSale=Math.max(150,Math.min(650,derived));
            } else benchmarkSale=220;

            var saleDev=benchmarkSale>0?Math.abs(rSalePsf-benchmarkSale)/benchmarkSale*100:0;
            if(rSalePsf>0&&saleDev>25){
              var benchLabel = rCityKnown ? "the "+cityName(rCity)+" benchmark of £"+Math.round(benchmarkSale)+"/sqft" : "the UK benchmark of £"+Math.round(benchmarkSale)+"/sqft (no specific postcode/city data — set postcode in Land Appraisal for accurate comparison)";
              warnings.push({sev:"warn",msg:"Sale price of £"+rSalePsf+"/sqft is "+Math.round(saleDev)+"% "+(rSalePsf>benchmarkSale?"above":"below")+" "+benchLabel+" — verify with agent"});
            }
            if(rBuild>0&&rBuild<120)warnings.push({sev:"error",msg:"Build cost of £"+rBuild+"/sqft is very low — BCIS minimum for residential is £130–£150/sqft. Check your inputs"});
            if(rBuild>0&&rBuild>350)warnings.push({sev:"warn",msg:"Build cost of £"+rBuild+"/sqft is high — typical range is £150–£280/sqft depending on specification and location"});
            if(rBuild>0&&rBuild>200&&rCityKnown&&["manchester","liverpool","leeds","sheffield","newcastle"].indexOf(rCity)>=0)warnings.push({sev:"warn",msg:"Build cost of £"+rBuild+"/sqft is above typical for "+cityName(rCity)+" — Northern markets usually £150–£200/sqft"});
            if(rUnits>0&&rSqft>0&&data.land&&data.land.acres>0){
              var dph=rUnits/(num(data.land.acres)*0.405);
              if(dph>80)warnings.push({sev:"warn",msg:"Density of "+Math.round(dph)+" dph is very high for this scheme type — check unit count and site area"});
              if(dph<10&&r.schType&&r.schType.indexOf("apart")<0)warnings.push({sev:"info",msg:"Density of "+Math.round(dph)+" dph is low — typical SFH is 25–40 dph. Consider whether higher density is achievable"});
            }
            // v9.26 — STRONG warning when developer profit is EXACTLY 0%
            // This was the most serious finding in the ChatGPT audit: profit=0 produces an
            // RLV that's inflated by ~17.5% of GDV (i.e. tens of millions on a typical scheme).
            if(rProfit===0){
              warnings.push({sev:"error",msg:"⚠ CRITICAL: Developer profit is 0% — the RLV calculation is excluding any return for the developer. This artificially inflates the land value by roughly "+fmt(rGdv*0.175)+" (17.5% of GDV). Set profit to 15–22% for a realistic RLV."});
            } else if(rProfit>0&&rProfit<15){
              warnings.push({sev:"error",msg:"Developer profit of "+rProfit+"% is below the viability threshold — most lenders require minimum 15–18% on GDV"});
            }
            if(rProfit>30)warnings.push({sev:"info",msg:"Developer profit of "+rProfit+"% is above typical — majors target 18–22%. A lower target would increase the land value you can offer"});

            // v9.26 — Build cost sanity check vs BCIS lo benchmark for the scheme type
            // ChatGPT audit flagged build cost £155/sqft as below industry £215+ benchmark.
            // bt.lo is the BCIS lower-quartile for this scheme type (e.g. 160 for SFH).
            if(num(r.buildPsf)>0 && bt.lo && rBuild < bt.lo){
              var deficitPct = Math.round((1 - rBuild/bt.lo) * 100);
              warnings.push({sev:"error",msg:"Build cost £"+rBuild+"/sqft is "+deficitPct+"% below the BCIS lower benchmark of £"+bt.lo+"/sqft for "+schTypeResolved+". This artificially inflates RLV. Real-world UK build costs are typically £"+bt.lo+"–£"+bt.hi+"/sqft."});
            }
            if(num(r.buildPsf)>0 && bt.hi && rBuild > bt.hi*1.2){
              warnings.push({sev:"info",msg:"Build cost £"+rBuild+"/sqft is above the BCIS upper benchmark of £"+bt.hi+"/sqft. Plausible for constrained urban sites but worth verifying."});
            }

            // v9.26 — Land value per acre sanity check
            // ChatGPT audit: RLV of £51.6m / 32 acres = £1.6m/acre is far above typical residential land.
            // Typical UK with full planning: £200k–£500k/acre. Above £500k/acre needs explaining.
            if(rRlv>0 && data.land && num(data.land.acres)>0){
              var rlvPerAcre = rRlv / num(data.land.acres);
              if(rlvPerAcre > 750000){
                warnings.push({sev:"error",msg:"RLV per acre of "+fmt(rlvPerAcre)+"/acre is exceptional — typical UK residential land with planning is £200–500k/acre, prime urban up to £750k/acre. Re-check build cost, sale PSF, and developer profit before accepting this number."});
              } else if(rlvPerAcre > 500000){
                warnings.push({sev:"info",msg:"RLV per acre of "+fmt(rlvPerAcre)+"/acre is high — prime planning consent territory. Verify build cost and sale PSF are realistic for this market."});
              }
            }
            // RLV vs asking price — require asking price >= £10k to avoid divide-by-zero nonsense
            var askingPrice=num(data.land&&data.land.price);
            if(rRlv>0&&askingPrice>=10000&&rRlv<askingPrice*0.7){
              var shortPct=Math.round((1-rRlv/askingPrice)*100);
              warnings.push({sev:"error",msg:"RLV of "+fmt(rRlv)+" is "+shortPct+"% below the asking price of "+fmt(askingPrice)+" — deal is likely unviable at current assumptions"});
            }
            if(rRlv>0&&askingPrice>=10000&&rRlv>askingPrice*1.3){
              var overPct=Math.round((rRlv/askingPrice-1)*100);
              // Cap absurd percentages (very low asking prices produce silly numbers)
              if(overPct>500){
                warnings.push({sev:"info",msg:"RLV of "+fmt(rRlv)+" is well above the asking price of "+fmt(askingPrice)+" — very strong position. Verify the asking price is correct (entered value: £"+askingPrice.toLocaleString()+")."});
              } else {
                warnings.push({sev:"info",msg:"RLV of "+fmt(rRlv)+" is "+overPct+"% above asking price — strong position. Consider whether assumptions are conservative enough"});
              }
            }
            // Flag missing/zero asking price separately
            if(rRlv>0&&askingPrice<10000){
              warnings.push({sev:"info",msg:"No asking price entered yet — return to Land Appraisal to add it for an RLV-vs-ask comparison"});
            }

            if(warnings.length===0)return null;
            var sevColors={error:{bg:"rgba(176,90,53,0.08)",border:"#B05A35",icon:"⚠",col:"#B05A35"},warn:{bg:"rgba(154,123,62,0.08)",border:"#9A7B3E",icon:"⚡",col:"#9A7B3E"},info:{bg:"rgba(74,75,174,0.06)",border:"#4A4BAE",icon:"ℹ",col:"#4A4BAE"}};
            return e("div",{style:{marginTop:12}},
              e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}},"Validation checks"),
              warnings.map(function(w,wi){
                var sc2=sevColors[w.sev]||sevColors.info;
                return e("div",{key:wi,style:{background:sc2.bg,border:"1px solid "+sc2.border,borderRadius:6,padding:"8px 12px",marginBottom:6,display:"flex",gap:8,alignItems:"flex-start",fontSize:11}},
                  e("span",{style:{flexShrink:0,color:sc2.col,fontWeight:700}},sc2.icon),
                  e("span",{style:{color:"#2E2F8A",lineHeight:1.6}},w.msg)
                );
              })
            );
          })(),

          e(AIPanel,{user:user,up:up,stage:"rlv",data:data,persistKey:"rics",label:"RICS Land Valuation Report",
            // v9.41 — Prompt rewritten to FORCE the AI to use Landform's exact figures
            // Previous version let the AI invent its own numbers based on market benchmarks
            // (e.g. used £297/sqft LR average and 1,415 sqft/unit, producing £17.65m RLV
            // when Landform's actual calc said £6.89m).
            prompt:"You are producing a RICS-style residual land valuation report for an internal developer working file. You MUST use the EXACT figures provided below — do NOT invent alternative figures from market benchmarks. If you disagree with an assumption, flag it as a risk; do not silently substitute it.\n\n"+
              "═══ LANDFORM CALCULATED FIGURES (use these verbatim) ═══\n"+
              "Postcode: "+(r.postcode||"not given")+"\n"+
              "Scheme type: "+(r.schType||data.assetType||"residential")+"\n"+
              "Units: "+rUnits+"\n"+
              "Avg unit size: "+rSqft+" sqft\n"+
              "Sale £/sqft (USER INPUT): £"+rSalePsf+"/sqft\n"+
              "Build £/sqft (USER INPUT): £"+rBuild+"/sqft\n"+
              "Developer profit % GDV: "+rProfit+"%\n"+
              "Finance rate %: "+rFin+"%\n"+
              "S106/CIL per unit: £"+(numOr(r.s106pu, 8000)).toLocaleString()+"\n"+
              (rHasMultiRoute
                ? "GDV (retail, if all sold private): "+fmt(rRetailGdv)+"\n"+
                  "GDV (blended realisable — after AHP/route discounts): "+fmt(rBlendedGdv)+" ← USE THIS\n"+
                  "Blended discount factor: "+pct((1-rBlendFactor)*100)+"\n"+
                  "Route mix: "+rRouteSummary.map(function(rs){return rs.count+" "+rs.label+" ("+pct(rs.discount*100)+" MV)";}).join("; ")+"\n"
                : "GDV: "+fmt(rGdv)+"\n"
              )+
              "Build cost: "+fmt(rBc)+"\n"+
              "Prof fees ("+Math.round(rFeesPct*100)+"%): "+fmt(rFees)+"\n"+
              "Contingency ("+rCont+"%): "+fmt(rContCost)+"\n"+
              "Finance cost: "+fmt(rFinCost)+"\n"+
              "S106 total: "+fmt(rS106)+"\n"+
              (rRoads>0?"Roads & sewers: "+fmt(rRoads)+"\n":"")+
              (rInfra>0?"Site infrastructure & SuDS: "+fmt(rInfra)+"\n":"")+
              (rPlan>0?"Planning fees: "+fmt(rPlan)+"\n":"")+
              "Developer profit: "+fmt(rDevProfit)+"\n"+
              "═══ LANDFORM RESIDUAL LAND VALUE (gross of land purchase costs): "+fmt(rRlv)+" ═══\n"+
              "Land as % GDV: "+pct(rlvPctGdv)+"\n"+
              "Land per plot: £"+Math.round(rlvPu).toLocaleString()+"\n"+
              "Verdict: "+(rViable?"Viable (≥15% land:GDV)":(rRlv>0?"Below 15% threshold — stretched":"NEGATIVE — does not stack"))+"\n\n"+
              "═══ Land Registry context (reference only — do not override the user's sale £/sqft above) ═══\n"+
              "LR weighted average: "+(lrData?"£"+lrData.wPsf+"/sqft from "+lrData.totalTx+" transactions":"not fetched")+"\n"+
              "Local benchmark: "+(pcData&&num(pcData.salePsf)>0?"£"+Math.round(num(pcData.salePsf))+"/sqft (postcode-area new-build benchmark)":"not available — set a full postcode for a local £/sqft benchmark")+"\n\n"+
              "═══ Asking price ═══\n"+
              "Farmer asking: "+(num(data.land&&data.land.price)>0?fmt(num(data.land.price)):"not entered")+"\n\n"+
              "═══ Your task ═══\n"+
              "Produce a RICS-style report with these sections:\n"+
              "1) RICS Valuation Summary — use the LANDFORM RLV figure of "+fmt(rRlv)+", not your own estimate. State the verdict honestly.\n"+
              "2) Price per sqft validation — note if user's £"+rSalePsf+"/sqft is above the LR benchmark of "+(lrData?"£"+lrData.wPsf:"local")+"/sqft and how much risk that creates. Do not substitute the LR benchmark for the user's number.\n"+
              "3) Negotiation strategy — opening bid, walk-away, target. Anchor on the LANDFORM RLV "+fmt(rRlv)+", NOT a market-derived number.\n"+
              "4) Key risks — planning, AHP, build cost, sales velocity, market sensitivity. Quantify each risk in £m impact on the LANDFORM RLV of "+fmt(rRlv)+".\n"+
              "5) What would change the valuation — table of drivers vs RLV impact, anchored on the LANDFORM RLV baseline.\n\n"+
              "DO NOT INVENT FIGURES. If a number isn't supplied above, say 'not provided by developer — should be confirmed' rather than estimating."
          })
        )
      )
    );
  }
