// ── migrateLoadedDeal ───────────────────────────────────────────
// Lifted out of Tool unchanged (0 closure coupling — see landform-v2/README.md).
// Version-migrates a saved deal object; uses only globals + its arg.
function migrateLoadedDeal(dealData){
    if(!dealData || typeof dealData !== "object") return {data:dealData, changed:false, migrations:[]};
    var data2 = JSON.parse(JSON.stringify(dealData));  // work on a copy
    var backup = JSON.parse(JSON.stringify(dealData));  // for restore
    var migrations = [];
    var reviewRecommended = [];
    var savedV = data2._savedVersion;

    // Always run namespace/schema guards, even for deals stamped on the current app version.
    // Some portfolio records can contain old fields from earlier in the same release cycle.
    if(data2.cap && typeof data2.cap === "object"){
      var capLegacy = data2.cap;
      var capNext = Object.assign({}, capLegacy, data2.capitalise || {});
      data2.capitalise = capNext;
      delete data2.cap;
      migrations.push({
        field:"cap -> capitalise",
        from:"legacy cap object",
        to:"capitalise",
        reason:"Portfolio shield: retired namespace removed so old saved deals cannot repopulate Capitalisation incorrectly"
      });
    }

    var atShield = String(data2.assetType || "").toLowerCase();
    var sfhMixShield = data2.sfh && data2.sfh.mix;
    var hasSfhMixShield = Array.isArray(sfhMixShield) ? sfhMixShield.length > 0 : !!(sfhMixShield && typeof sfhMixShield === "object" && Object.keys(sfhMixShield).length);
    var hasBtrBlockShield = !!(data2.hra && (num(data2.hra.units) || num(data2.hra.beds) || num(data2.hra.storeys)));
    var capAssetShield = String(data2.capitalise && data2.capitalise.ffAssetType || "").toLowerCase();
    if(atShield === "btr" && hasSfhMixShield && !hasBtrBlockShield){
      data2.assetType = "sfh";
      migrations.push({
        field:"assetType",
        from:"btr",
        to:"sfh",
        reason:"Portfolio shield: SFH house mix is present and no BTR/PBSA block evidence exists, so the deal should load and save as SFH"
      });
      atShield = "sfh";
    }
    if(atShield === "btr" && hasSfhMixShield && capAssetShield.indexOf("sfh") >= 0){
      reviewRecommended.push({
        field:"assetType / sfh / capitalise.ffAssetType",
        current:"assetType=btr with SFH mix and SFH capitalisation route",
        expected:"Confirm whether this deal should be BTR or SFH",
        reason:"Portfolio shield: older saved deal mixes BTR journey with SFH route data. Not auto-changed because this may be a genuine mixed-exit appraisal."
      });
    }

    // If saved on current version or newer and schema guards found nothing, no migration needed
    if(savedV && semverCompare(savedV, CURRENT_VERSION) >= 0 && migrations.length===0 && reviewRecommended.length===0){
      return {data:data2, changed:false, migrations:[], reviewRecommended:[]};
    }
    // ── Migration 1: schType mismatch (v9.15 fix) ────────────────────────
    // If assetType=sfh but schType is apartments/BTR/PBSA → wrong default
    // led to £220/sqft build cost being used for SFH (vs correct ~£195).
    // This is a structurally provable mismatch — safe to auto-fix.
    if(data2.rlv && data2.rlv.schType){
      var atLc = (data2.assetType||"").toLowerCase();
      var schType = data2.rlv.schType;
      var typeApart = schType.indexOf("apart")>=0 || schType.indexOf("BTR")>=0 || schType.indexOf("PBSA")>=0;
      var typeHouse = schType.indexOf("houses")>=0;
      if(atLc==="sfh" && typeApart){
        data2.rlv.schType = "Residential houses";
        migrations.push({
          field:"rlv.schType",
          from:schType,
          to:"Residential houses",
          reason:"v9.15: SFH deal had apartments scheme type — auto-corrected"
        });
        // Also clear buildPsf if it matches the apartments default (£220)
        // because that's almost certainly the wrong-default value, not a user override.
        if(num(data2.rlv.buildPsf) === 220 || num(data2.rlv.buildPsf) === 235){
          migrations.push({
            field:"rlv.buildPsf",
            from:data2.rlv.buildPsf,
            to:"(auto)",
            reason:"v9.15: Was apartments-mid default; cleared so it re-derives from SFH city data"
          });
          delete data2.rlv.buildPsf;
        }
      } else if((atLc==="btr"||atLc==="pbsa") && typeHouse){
        var correct = atLc==="btr" ? "BTR (Build to Rent)" : "PBSA (Student)";
        data2.rlv.schType = correct;
        migrations.push({
          field:"rlv.schType",
          from:schType,
          to:correct,
          reason:"v9.15: "+atLc.toUpperCase()+" deal had houses scheme type — auto-corrected"
        });
        if(num(data2.rlv.buildPsf) === 195){
          migrations.push({
            field:"rlv.buildPsf",
            from:data2.rlv.buildPsf,
            to:"(auto)",
            reason:"v9.15: Was houses-mid default on "+atLc.toUpperCase()+" deal; cleared so it re-derives"
          });
          delete data2.rlv.buildPsf;
        }
      }
    }

    // ── Migration 2: Stale sens_* slider cache (pre-v9.15) ───────────────
    // The new isolated-sensitivity sliders use sens_* prefix.
    // Any sens_* values from before v9.15 are leftover state we should clear.
    if(data2.rlv){
      ["sens_salePsf","sens_buildPsf","sens_units","sens_profitPct"].forEach(function(k){
        if(data2.rlv[k] !== undefined && data2.rlv[k] !== null){
          delete data2.rlv[k];
          // Not user-visible, don't bother surfacing this in the banner
        }
      });
    }

    // ── Migration 3: Old sliders overwrote rlv.salePsf etc directly ──────
    // Pre-v9.15 sliders wrote to rlv.salePsf when moved. If the saved deal
    // shows a salePsf that doesn't match what postcode + city + benchmark would
    // produce, AND it's clearly off (>30% from city benchmark), it's likely
    // a stale slider position. But we can't be sure — flag for review.
    // We DON'T auto-clear these because user may have intentionally entered them.
    // Just record as "review recommended" so the banner can surface it.
    if(data2.rlv && data2.land && data2.land.postcode){
      var pcD = lookupPostcode(data2.land.postcode);
      if(pcD && pcD.salePsf && num(data2.rlv.salePsf) > 0){
        var dev = Math.abs(num(data2.rlv.salePsf) - pcD.salePsf) / pcD.salePsf;
        if(dev > 0.3){
          reviewRecommended.push({
            field:"rlv.salePsf",
            current:data2.rlv.salePsf,
            expected:pcD.salePsf,
            reason:"Differs from postcode benchmark by "+Math.round(dev*100)+"%"
          });
        }
      }
    }

    // ── Migration 4: Clear obsolete _migrationDismissed if from older version ──
    if(data2._migrationDismissed && semverCompare(data2._migrationDismissed, CURRENT_VERSION) < 0){
      delete data2._migrationDismissed;
    }

    // ── Migration 5 (v9.18): Re-propagate scenario values to Planning/RLV/Fin ──
    // Pre-v9.18 scenario Apply didn't write S106pu to Planning/RLV/Fin, and only wrote
    // ahPct (not afhPct). For deals with an applied scenario, retroactively push these values.
    if(data2.land && data2.land.appliedScenario){
      var schAhPct = num(data2.land.scenarioAhPct || 0);
      var schS106pu = num(data2.land.scenarioS106pu || 0);
      var schFinRate = num(data2.land.scenarioFinanceRate || 0);
      // Planning: set ahPct AND afhPct AND s106pu if scenario provided them and Planning is missing them
      if(schAhPct > 0){
        if(!data2.planning) data2.planning = {};
        if(!num(data2.planning.ahPct) && !num(data2.planning.afhPct)){
          data2.planning.ahPct = schAhPct;
          data2.planning.afhPct = schAhPct;
          migrations.push({
            field:"planning.ahPct + planning.afhPct",
            from:"(empty)",
            to:String(schAhPct)+"%",
            reason:"v9.18: Active scenario specified AH "+schAhPct+"% but it wasn't propagated to Planning"
          });
        }
      }
      if(schS106pu > 0){
        if(!data2.planning) data2.planning = {};
        if(!num(data2.planning.s106pu)){
          data2.planning.s106pu = schS106pu;
          migrations.push({
            field:"planning.s106pu",
            from:"(empty)",
            to:"£"+schS106pu.toLocaleString()+"/unit",
            reason:"v9.18: Active scenario specified S106 £"+schS106pu+"/unit but it wasn't propagated to Planning"
          });
        }
        if(!data2.rlv) data2.rlv = {};
        if(!num(data2.rlv.s106pu)){
          data2.rlv.s106pu = schS106pu;
          migrations.push({
            field:"rlv.s106pu",
            from:"(empty)",
            to:"£"+schS106pu.toLocaleString()+"/unit",
            reason:"v9.18: Active scenario S106 £"+schS106pu+"/unit wasn't propagated to RLV"
          });
        }
        if(!data2.fin) data2.fin = {};
        if(!num(data2.fin.s106pu)){
          data2.fin.s106pu = schS106pu;
          migrations.push({
            field:"fin.s106pu",
            from:"(empty)",
            to:"£"+schS106pu.toLocaleString()+"/unit",
            reason:"v9.18: Active scenario S106 £"+schS106pu+"/unit wasn't propagated to Fin"
          });
        }
        // v9.19 — also propagate to scheme-specific input stages
        if(!data2.sfh) data2.sfh = {};
        if(!num(data2.sfh.s106pu)){
          data2.sfh.s106pu = schS106pu;
          migrations.push({
            field:"sfh.s106pu",
            from:"(empty)",
            to:"£"+schS106pu.toLocaleString()+"/plot",
            reason:"v9.19: Scenario S106 wasn't propagated to SFH House Mix stage"
          });
        }
        if(!data2.hra) data2.hra = {};
        if(!num(data2.hra.s106pu)){
          data2.hra.s106pu = schS106pu;
          migrations.push({
            field:"hra.s106pu",
            from:"(empty)",
            to:"£"+schS106pu.toLocaleString()+"/unit",
            reason:"v9.19: Scenario S106 wasn't propagated to BTR/PBSA Block stage"
          });
        }
      }
      // v9.19 — Propagate AH% to scheme-specific stages too
      if(schAhPct > 0){
        if(!data2.sfh) data2.sfh = {};
        if(!num(data2.sfh.ahPct)){
          data2.sfh.ahPct = schAhPct;
          migrations.push({
            field:"sfh.ahPct",
            from:"(empty)",
            to:String(schAhPct)+"%",
            reason:"v9.19: Scenario AH% wasn't propagated to SFH House Mix stage"
          });
        }
        if(!data2.hra) data2.hra = {};
        if(!num(data2.hra.ahPct)){
          data2.hra.ahPct = schAhPct;
          migrations.push({
            field:"hra.ahPct",
            from:"(empty)",
            to:String(schAhPct)+"%",
            reason:"v9.19: Scenario AH% wasn't propagated to BTR/PBSA Block stage"
          });
        }
        if(!data2.tenure) data2.tenure = {};
        if(!num(data2.tenure.ahPct)){
          data2.tenure.ahPct = schAhPct;
          migrations.push({
            field:"tenure.ahPct",
            from:"(empty)",
            to:String(schAhPct)+"%",
            reason:"v9.19: Scenario AH% wasn't propagated to Tenure Mix stage"
          });
        }
      }
      // v9.19 — Propagate finance rate to scheme-specific stages
      if(schFinRate > 0){
        if(!data2.sfh) data2.sfh = {};
        if(!num(data2.sfh.finRate)){
          data2.sfh.finRate = schFinRate;
          migrations.push({
            field:"sfh.finRate",
            from:"(empty)",
            to:String(schFinRate)+"%",
            reason:"v9.19: Scenario finance rate wasn't propagated to SFH House Mix"
          });
        }
        if(!data2.hra) data2.hra = {};
        if(!num(data2.hra.finRate)){
          data2.hra.finRate = schFinRate;
          migrations.push({
            field:"hra.finRate",
            from:"(empty)",
            to:String(schFinRate)+"%",
            reason:"v9.19: Scenario finance rate wasn't propagated to BTR/PBSA Block"
          });
        }
      }
    }

    // ── Migration 6 (v9.18): Unit count cross-stage gaps ───────────────────
    // If Planning has units but RLV doesn't (or vice versa), copy across so calculations are consistent
    if(data2.planning && data2.rlv){
      var pUnits = num(data2.planning.units || 0);
      var rUnits = num(data2.rlv.units || 0);
      if(pUnits > 0 && !rUnits){
        data2.rlv.units = pUnits;
        migrations.push({
          field:"rlv.units",
          from:"(empty)",
          to:String(pUnits),
          reason:"v9.18: Copied from Planning's "+pUnits+" units — RLV was empty"
        });
      } else if(rUnits > 0 && !pUnits){
        data2.planning.units = rUnits;
        migrations.push({
          field:"planning.units",
          from:"(empty)",
          to:String(rUnits),
          reason:"v9.18: Copied from RLV's "+rUnits+" units — Planning was empty"
        });
      }
      // Don't auto-resolve mismatches — surface them via the unit-sync warning instead
    }

    var changed = migrations.length > 0 || reviewRecommended.length > 0;
    if(changed){
      data2._migrationFrom = savedV || "(unstamped)";
      data2._migrationTo = CURRENT_VERSION;
      data2._migrationAt = new Date().toISOString();
      data2._migrationLog = migrations;
      data2._migrationReviewRecommended = reviewRecommended;
      data2._preMigrationBackup = backup;  // for restore
    }

    return {data:data2, changed:changed, migrations:migrations, reviewRecommended:reviewRecommended, backup:backup};
  }
