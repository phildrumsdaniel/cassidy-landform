// Geocode a UK postcode → [lat,lng] via postcodes.io (full → outcode), null on miss.
function geocodePostcodeProp(pc){
  return new Promise(function(resolve){
    pc=(pc||"").toUpperCase().trim();
    if(!pc){ resolve(null); return; }
    var got=function(d){ return (d&&d.result&&d.result.latitude)?[d.result.latitude,d.result.longitude]:null; };
    fetch("https://api.postcodes.io/postcodes/"+encodeURIComponent(pc))
      .then(function(r){return r.json();})
      .then(function(d){ var c=got(d); if(c){resolve(c);return;} throw 0; })
      .catch(function(){
        var oc=pc.split(" ")[0];
        fetch("https://api.postcodes.io/outcodes/"+encodeURIComponent(oc))
          .then(function(r){return r.json();}).then(function(d){ resolve(got(d)); })
          .catch(function(){ resolve(null); });
      });
  });
}

// ── SiteLocationPicker — drag the pin to the EXACT parcel; saves land.siteLat/Lng ──
// The postcode only geocodes to a sector centroid, so the pin lands near the village,
// not on the field. This lets the user place it precisely; those coords then drive the
// board proposal's map (and can feed the Placona map / constraint checks too).
function SiteLocationPicker(props){
  var data=props.data||{}, up=props.up, pc=props.pc||"";
  var l=data.land||{};
  var savedLat=num(l.siteLat), savedLng=num(l.siteLng);
  var elRef=React.useRef(null), mapRef=React.useRef(null), markerRef=React.useRef(null);
  var cs=useState((savedLat&&savedLng)?[savedLat,savedLng]:null), coords=cs[0], setCoords=cs[1];

  function save(la,lo){
    la=Math.round(la*1e6)/1e6; lo=Math.round(lo*1e6)/1e6;
    setCoords([la,lo]); up("land","siteLat",la); up("land","siteLng",lo);
  }

  useEffect(function(){
    if(typeof L==="undefined"||!elRef.current||mapRef.current) return;
    var start=(savedLat&&savedLng)?[savedLat,savedLng]:[52.5,-1.5];
    var map=L.map(elRef.current,{scrollWheelZoom:false}).setView(start,(savedLat&&savedLng)?16:6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(map);
    var marker=L.marker(start,{draggable:true}).addTo(map);
    marker.on("dragend",function(){ var p=marker.getLatLng(); save(p.lat,p.lng); });
    map.on("click",function(ev){ marker.setLatLng(ev.latlng); save(ev.latlng.lat,ev.latlng.lng); });
    mapRef.current=map; markerRef.current=marker;
    setTimeout(function(){ try{ map.invalidateSize(); }catch(e){} },250);
    // No saved pin yet — centre on the postcode and drop the marker there as a starting point.
    if(!(savedLat&&savedLng) && pc){
      geocodePostcodeProp(pc).then(function(c){ if(c&&mapRef.current){ map.setView(c,16); marker.setLatLng(c); } });
    }
    return function(){ try{ map.remove(); }catch(e){} mapRef.current=null; };
  },[]);

  function recentre(){
    if(!pc) return;
    geocodePostcodeProp(pc).then(function(c){ if(c&&mapRef.current&&markerRef.current){ mapRef.current.setView(c,16); markerRef.current.setLatLng(c); } });
  }
  function clearPin(){ up("land","siteLat",""); up("land","siteLng",""); setCoords(null); recentre(); }

  var hasLeaflet=(typeof L!=="undefined");
  return e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:14,marginBottom:16}},
    e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:8}},
      e("div",null,
        e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A"}},"📍 Exact site location"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginTop:2}},"Drag the pin — or click the map — onto the actual parcel. The board proposal uses this exact point.")
      ),
      e("div",{style:{display:"flex",gap:6}},
        pc&&e("button",{onClick:recentre,style:{padding:"5px 10px",background:"#F4F5FB",border:"1px solid #DDE0ED",borderRadius:5,fontSize:10,fontWeight:700,color:"#4A4BAE",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Centre on "+esc0(pc)),
        (coords)&&e("button",{onClick:clearPin,style:{padding:"5px 10px",background:"transparent",border:"1px solid #C5C8E0",borderRadius:5,fontSize:10,fontWeight:700,color:"#7278A0",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Reset pin")
      )
    ),
    hasLeaflet
      ? e("div",{ref:elRef,style:{height:300,width:"100%",borderRadius:8,overflow:"hidden",border:"1px solid #E1E4F0"}})
      : e("div",{style:{padding:"20px",fontSize:12,color:"#7278A0",textAlign:"center"}},"Map unavailable — the proposal will use the postcode location."),
    e("div",{style:{fontSize:11,color:coords?"#2D7A65":"#9A7B3E",marginTop:8,fontWeight:600}},
      coords?("✓ Exact pin set — "+coords[0].toFixed(5)+", "+coords[1].toFixed(5))
            :("⚠ Using the postcode centroid ("+(pc||"no postcode")+") — drag the pin to the parcel for an exact location."))
  );
}
function esc0(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// ── renderProposal — Board Proposal generator (params: city, data, gdv, lc, up, user)
// One-touch, Cassidy-branded board paper built from the LIVE deal via the single engine
// (calcDealMetrics / computeSFHMetrics). Opens as a viewable HTML document in a new tab
// that also prints cleanly to PDF (a "Print / Save as PDF" button in the page). Includes a
// real OpenStreetMap of the site (geocoded from the postcode) plus an indicative site plan.
// Loaded before 05-tool.js. Uses globals: e, S, fmt, pct, num, fmtN, cityName, notify,
// calcDealMetrics, computeSFHMetrics, constraintVerdict, REGION_LATLNG, dealCityKey.
// v10.41 — buildLandOnePager: the one-page A4 land appraisal, extracted to a shared GLOBAL so
// BOTH the Board Proposal stage and the Quick Appraisal page generate the IDENTICAL one-pager
// from any deal (single source — it can never diverge). Every figure is computed from the deal.
function buildLandOnePager(data, cityHint){
  data = data || {};
  var l=data.land||{}, p=data.planning||{}, ten=data.tenure||{};
  var M=(typeof calcDealMetrics==="function")?calcDealMetrics(data):{};
  var SF=(typeof computeSFHMetrics==="function")?computeSFHMetrics(data):{};
  var addr=l.address||(data.scraper&&data.scraper.result&&data.scraper.result.address)||"Development Site";
  var pc=(l.postcode||(data.rlv&&data.rlv.postcode)||"").toUpperCase().trim();
  var cityDisp=((typeof cityName==="function")?cityName(cityHint||l.city||""):"")||"";
  var county=l.county||"";
  var acres=num(l.acres||0);
  var modelledUnits=num(SF.totalUnits)||0;
  var siteUnits=num(M.units||p.units||l.units||(data.rlv&&data.rlv.units)||0);
  var units=modelledUnits>0?modelledUnits:siteUnits;
  var sitePotential=(modelledUnits>0 && siteUnits>modelledUnits*1.1)?siteUnits:0;
  var gdvV=num(M.gdv)||num(SF.gdv)||0;
  var ask=num(l.price||0);
  var ahPct=num(p.ahPct||p.afhPct||ten.ahPct||0);
  var planStatus=p.status||l.planningStatus||"Unallocated";
  var lpa=p.lpa||l.localAuthority||"";
  var density=(acres>0&&units>0)?Math.round(units/acres):0;
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function landSDLT(pp){ pp=num(pp); if(pp<=150000) return 0; var t=Math.min(pp-150000,100000)*0.02; if(pp>250000) t+=(pp-250000)*0.05; return t; }
  function landAcqCosts(price){ price=num(price); if(price<=0) return {sdlt:0,other:0,total:0}; var sdlt=landSDLT(price), other=price*0.015; return {sdlt:sdlt,other:other,total:sdlt+other}; }
    var sf=SF||{};
    var oUnits=num(sf.totalUnits)||units||0;
    var oGdv=num(sf.gdv)||gdvV||0;
    var oRetail=num(sf.retailGdv)||oGdv;
    var oBuild=num(sf.buildCost), oFees=num(sf.fees), oCont=num(sf.contingency), oFin=num(sf.finance);
    var oS106=num(sf.s106), oRoads=num(sf.roads), oInfra=num(sf.infra), oMkt=num(sf.marketing), oProfit=num(sf.profit);
    var oDev=num(sf.devCost)||(oBuild+oFees+oCont+oFin+oS106+oRoads+oInfra+oMkt);
    var oRlv=num(sf.rlv);
    var oAvgSqft=Math.round(num(sf.avgSqft)||0);
    var oBuildPsf=Math.round(num(sf.buildPsf)||0);
    var oBasePsf=Math.round(num(sf.basePsf)||0);
    var oProfitPct=oGdv>0?oProfit/oGdv*100:0;                 // target profit baked into the RLV
    var askL=num(l.price)||ask||0;                            // what the landowner is asking
    var profitAtAsk=askL>0?(oGdv-oDev-askL):oProfit;          // real profit if bought at the asking price
    var marginAtAsk=oGdv>0?(profitAtAsk/oGdv*100):0;
    var headroom=oRlv-askL;                                   // +ve ⇒ RLV covers the asking with room to spare
    var oDensity=(acres>0&&oUnits>0)?Math.round(oUnits/acres):density;
    var rlvPerPlot=oUnits>0?oRlv/oUnits:0;
    var rlvPerAcre=acres>0?oRlv/acres:0;
    var landPctGdv=oGdv>0&&askL>0?(askL/oGdv*100):0;
    // Land purchase costs on the guide price, and the ALL-IN position (price + SDLT + legals +
    // acquisition). The all-in margin/headroom is the honest test — it's what actually leaves
    // Cassidy's account to secure the land, set against the residual land value.
    var acq=landAcqCosts(askL);
    var totalLandCost=askL+acq.total;
    var profitAllIn=askL>0?(oRlv+oProfit-totalLandCost):oProfit;   // = GDV − devCost − totalLandCost
    var marginAllIn=oGdv>0?(profitAllIn/oGdv*100):0;
    var headroomAllIn=oRlv-totalLandCost;                         // RLV vs the all-in cost of buying

    // ── v10.49 — FORWARD-FUND / CAPITALISATION EXIT ────────────────────────────
    // What an institution (pension fund) would pay for the whole rented scheme at a net initial
    // yield, and the profit at that scale. Net rent comes from the engine (computeSFHMetrics), so
    // the printed report and the Quick Appraisal show the same figure. A keener yield ⇒ more value.
    var oCapNetRent=num(sf.capNetRentPa)||0;
    var oCapYieldPct=num((data.capitalise||{}).targetYield); if(oCapYieldPct>0&&oCapYieldPct<1) oCapYieldPct*=100;
    if(!(oCapYieldPct>0)) oCapYieldPct=4.9; oCapYieldPct=Math.max(4.5,Math.min(6,oCapYieldPct));   // v10.55 — 4.5% institutional floor
    function oCapIV(y){ return y>0?oCapNetRent/(y/100):0; }
    function oCapProfitAllIn(y){ return oCapIV(y)-oDev-totalLandCost; }
    function oCapMaxLand(y){ var iv=oCapIV(y); return iv-oDev-iv*(oProfitPct/100); }
    var oCapYields=[4.5,5.0,5.5,6.0];

    // Verdict — decision-useful: uses the margin AFTER the full cost of acquiring the land.
    var verdict, vcol, vsub;
    if(oRlv<=0){ verdict="✗ Does not stack"; vcol="#B05A35";
      vsub="Build, costs and target profit exceed GDV — the residual land value is negative, so the site can't support any land payment at "+Math.round(oProfitPct)+"% profit as modelled."; }
    else if(askL>0){
      if(marginAllIn>=15){ verdict="✓ Worth pursuing"; vcol="#1B7A54";
        vsub="At the "+fmt(askL)+" guide price plus "+fmt(acq.total)+" purchase costs (SDLT, legals, acquisition), the all-in land cost is "+fmt(totalLandCost)+" — still a "+pct(marginAllIn)+" margin ("+fmt(profitAllIn)+" profit). The residual land value of "+fmt(oRlv)+" covers it with "+fmt(headroomAllIn)+" to spare."; }
      else if(marginAllIn>=12){ verdict="⚠ Marginal — negotiate"; vcol="#9A7B3E";
        vsub="After the "+fmt(acq.total)+" purchase costs the all-in land cost is "+fmt(totalLandCost)+" and the margin is only "+pct(marginAllIn)+". The land is worth up to "+fmt(oRlv)+" at target profit — offer nearer "+fmt(oRlv-acq.total)+" to restore the margin."; }
      else { verdict="✗ Overpriced as asked"; vcol="#B05A35";
        vsub="With "+fmt(acq.total)+" purchase costs the all-in cost of "+fmt(totalLandCost)+" exceeds the "+fmt(oRlv)+" residual land value by "+fmt(Math.abs(headroomAllIn))+" — margin just "+pct(marginAllIn)+". Pursue only at a price near "+fmt(Math.max(0,oRlv-acq.total))+" or below."; }
    } else {
      verdict=oProfitPct>=15?"◐ Enter a guide price":"◐ Review"; vcol="#4A4BAE";
      vsub="Maximum supportable land value is "+fmt(oRlv)+" ("+fmt(rlvPerPlot)+"/plot) at "+Math.round(oProfitPct)+"% target profit, before purchase costs. Enter the landowner's guide price to add SDLT, legals and acquisition and test the all-in position."; }

    // ── PATH TO A 15% MARGIN ───────────────────────────────────────────────────
    // When the scheme falls short of a 15% developer margin (after the land, if a guide is
    // entered), solve the ENGINE for the value of each lever that would reach 15% — the actual
    // figures needed to make it stack, not fixed % nudges. Each is re-appraised on
    // computeSFHMetrics with only that lever changed, bisecting to the target. Margin here is
    // the achievable developer margin at the current land cost: (GDV − dev cost − land) / GDV.
    var TARGET_M=15;
    var marginNow=oGdv>0?((oGdv-oDev-totalLandCost)/oGdv*100):0;
    var pathBlock="";
    if(oGdv>0 && marginNow < TARGET_M){
      var curBase=oBasePsf, curBuild=oBuildPsf, landSolve=totalLandCost;
      function cloneD(){ try{ return JSON.parse(JSON.stringify(data)); }catch(e){ return null; } }
      function marginOf(d){ if(!d) return -999; var sm=computeSFHMetrics(d); var g=num(sm.gdv); return g>0?((g-num(sm.devCost)-landSolve)/g*100):-999; }
      // Bisection solver: find x in [lo,hi] where the margin crosses TARGET_M (monotonic lever).
      function solve(mutate, lo, hi){
        function f(x){ var d=cloneD(); if(!d) return -999; try{ mutate(d,x); }catch(e){ return -999; } return marginOf(d); }
        var mLo=f(lo), mHi=f(hi);
        if((mLo-TARGET_M)*(mHi-TARGET_M)>0) return null;   // 15% not reachable within range
        for(var i=0;i<46;i++){ var mid=(lo+hi)/2, m=f(mid);
          if((m-TARGET_M)*(mLo-TARGET_M)<=0){ hi=mid; mHi=m; } else { lo=mid; mLo=m; } }
        return (lo+hi)/2;
      }
      function scalePrices(s,x){ if(Array.isArray(s.mix)) s.mix=s.mix.map(function(r){ r=Object.assign({},r); if(num(r.unitPrice))r.unitPrice=String(Math.round(num(r.unitPrice)*x)); if(num(r.salePrice))r.salePrice=String(Math.round(num(r.salePrice)*x)); if(num(r.psf))r.psf=String(Math.round(num(r.psf)*x)); return r; }); }
      function scaleBuild(s,x){ if(Array.isArray(s.mix)) s.mix=s.mix.map(function(r){ r=Object.assign({},r); if(num(r.buildPsf))r.buildPsf=String(Math.round(num(r.buildPsf)*x)); return r; }); }
      var fSale=solve(function(d,x){ var s=d.sfh||(d.sfh={}); s.basePsf=String(Math.round((num(s.basePsf)||curBase)*x)); scalePrices(s,x); }, 0.6, 2.5);
      var saleT=fSale?Math.round(curBase*fSale):null;
      var fBuild=solve(function(d,x){ var s=d.sfh||(d.sfh={}); s.buildPsf=String(Math.round((num(s.buildPsf)||curBuild)*x)); scaleBuild(s,x); }, 0.30, 1.0);
      var buildT=fBuild?Math.round(curBuild*fBuild):null;
      function setAh(d,x){ var s=d.sfh||(d.sfh={}); s.ahPct=String(x); var p=d.planning||(d.planning={}); p.ahPct=String(x); p.afhPct=String(x); if(d.tenure)d.tenure.ahPct=String(x); }
      // Is the scheme-level affordable % actually a live lever? It is NOT when affordable is
      // captured as per-row tenure (the ahPct haircut is then bypassed), so changing it does
      // nothing to GDV — don't offer it as a lever in that case.
      var ahEffective=false;
      if(ahPct>0){ var dz=cloneD(); if(dz){ setAh(dz,0); ahEffective=Math.abs(marginOf(dz)-marginNow)>0.1; } }
      var ahT = ahEffective ? solve(function(d,x){ setAh(d,x); }, 0, ahPct) : null;
      // Balanced combined path: a bit of each (sale +up to 10%, build −up to 12%, and AH −up to
      // 15pts when it's a live lever).
      var tC=solve(function(d,t){ var s=d.sfh||(d.sfh={}); var sf2=1+0.10*t, bf=1-0.12*t;
        s.basePsf=String(Math.round((num(s.basePsf)||curBase)*sf2)); s.buildPsf=String(Math.round((num(s.buildPsf)||curBuild)*bf));
        if(ahEffective) setAh(d,Math.max(0,ahPct-15*t));
        if(Array.isArray(s.mix)) s.mix=s.mix.map(function(r){ r=Object.assign({},r); if(num(r.unitPrice))r.unitPrice=String(Math.round(num(r.unitPrice)*sf2)); if(num(r.buildPsf))r.buildPsf=String(Math.round(num(r.buildPsf)*bf)); return r; });
      }, 0, 1);
      var comboTxt="";
      if(tC!=null){ comboTxt="Sale £"+Math.round(curBase*(1+0.10*tC))+"/sqft <b>+</b> build £"+Math.round(curBuild*(1-0.12*tC))+"/sqft"+(ahEffective?" <b>+</b> affordable "+Math.round(Math.max(0,ahPct-15*tC))+"%":"")+" — together reach 15%."; }
      else { comboTxt="Even a combined push (sale +10%, build −12%"+(ahEffective?", affordable −15pts":"")+") falls short of 15% — it needs a step-change in sale values, a lower land basis, or grant support."; }
      function leverLi(label, from, to, unit){
        if(to==null) return '<tr><td>'+label+'</td><td class="n">'+from+unit+'</td><td class="n" style="color:#9298BC">not alone</td></tr>';
        var better = /Affordable|Build/.test(label) ? to<num(String(from).replace(/[^0-9.]/g,"")) : true;
        return '<tr><td>'+label+'</td><td class="n">'+from+unit+'</td><td class="n" style="color:#1B7A54;font-weight:800">'+to+unit+'</td></tr>';
      }
      pathBlock='<div style="margin-top:9px;border:1px solid #C9CCE4;border-radius:7px;padding:9px 11px;background:#FBFAF5">'+
        '<div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#9A7B3E;font-weight:800;margin-bottom:4px">What makes it stack — path to a 15% margin</div>'+
        '<div style="font-size:9px;color:#6A6F97;margin-bottom:5px">Currently <b style="color:#B05A35">'+pct(marginNow)+'</b> developer margin '+(totalLandCost>0?'after '+fmt(totalLandCost)+' all-in land':'at £0 land')+'. Any ONE of the following reaches 15% (each solved on the engine, holding the others fixed):</div>'+
        '<table><tr><td style="color:#8A90B4;font-size:7.4px;letter-spacing:.05em;text-transform:uppercase;font-weight:700">Lever</td><td class="n" style="color:#8A90B4;font-size:7.4px;text-transform:uppercase;font-weight:700">Now</td><td class="n" style="color:#8A90B4;font-size:7.4px;text-transform:uppercase;font-weight:700">Needs to be</td></tr>'+
          leverLi("Sale price","£"+curBase, saleT, "/sqft")+
          leverLi("Build cost","£"+curBuild, buildT, "/sqft")+
          (ahEffective?leverLi("Affordable %", ahPct, (ahT!=null?Math.round(ahT):null), "%"):'')+
        '</table>'+
        '<div style="font-size:9px;color:#3A3D6A;margin-top:5px;line-height:1.45"><b>Balanced route:</b> '+comboTxt+'</div>'+
      '</div>';
    }

    // Compact house mix — cap at 8 rows, roll up the rest so it always fits one page.
    var rows=(sf.rows||[]).filter(function(r){return num(r.count)>0;});
    var shown=rows.slice(0,8), rest=rows.slice(8);
    var mixRows=shown.map(function(r){
      var rev=num(r.retailGdv)||(num(r.sqft)*num(r.psf)*num(r.count));
      return '<tr><td>'+esc(r.type||"House")+'</td><td class="n">'+num(r.count)+'</td><td class="n">'+(Math.round(num(r.sqft))||"—")+'</td><td class="n">£'+Math.round(num(r.psf))+'</td><td class="n">'+fmt(rev)+'</td></tr>';
    }).join("");
    if(rest.length){
      var rc=rest.reduce(function(a,r){return a+num(r.count);},0);
      var rrev=rest.reduce(function(a,r){return a+(num(r.retailGdv)||num(r.sqft)*num(r.psf)*num(r.count));},0);
      mixRows+='<tr><td>+ '+rest.length+' more type'+(rest.length>1?"s":"")+'</td><td class="n">'+rc+'</td><td class="n">—</td><td class="n">—</td><td class="n">'+fmt(rrev)+'</td></tr>';
    }
    var ahU=Math.round(oUnits*ahPct/100);

    function cRow(k,v,neg,strong){ return '<tr'+(strong?' class="s"':'')+'><td>'+k+'</td><td class="n">'+(neg?"−":"")+v+'</td></tr>'; }
    var siteSub=[cityDisp,county,pc].filter(Boolean).join(" · ");

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>'+
      '<title>Land appraisal — '+esc(addr)+'</title><style>'+
      '@page{size:A4 portrait;margin:10mm}'+
      '*{box-sizing:border-box}'+
      'html,body{margin:0}'+
      'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#26284F;font-size:9.7px;line-height:1.4;font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#eef0f7}'+
      '.pg{width:190mm;min-height:277mm;margin:6mm auto;background:#fff;padding:9mm 9mm 7mm;box-shadow:0 2px 14px rgba(0,0,0,.12)}'+
      '@media print{body{background:#fff}.pg{margin:0;box-shadow:none;width:auto;min-height:auto;padding:0}.noprint{display:none}}'+
      'h1{font-family:Georgia,serif;font-size:16px;color:#1B1D46;margin:0}'+
      '.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1B1D46;padding-bottom:5px;margin-bottom:7px}'+
      '.brand{font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:#9A7B3E;font-weight:800}'+
      '.sub{color:#6A6F97;font-size:9px;margin-top:2px}'+
      '.meta{text-align:right;font-size:8.3px;color:#6A6F97;line-height:1.5}'+
      '.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:8px 0}'+
      '.kpi{border:1px solid #E0E2EC;border-radius:5px;padding:6px 7px;background:#FafBff}'+
      '.kpi .l{font-size:7.4px;letter-spacing:.08em;text-transform:uppercase;color:#8A90B4;font-weight:700}'+
      '.kpi .v{font-size:14px;font-weight:800;color:#1B1D46;margin-top:2px;font-family:Georgia,serif}'+
      '.cols{display:grid;grid-template-columns:1.04fr 1fr;gap:9px;margin-top:2px}'+
      '.card{border:1px solid #E0E2EC;border-radius:6px;padding:8px 9px}'+
      '.ct{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#4A4BAE;font-weight:800;margin-bottom:5px}'+
      'table{width:100%;border-collapse:collapse}'+
      'td{padding:2.4px 0;border-bottom:1px solid #F1F2F8}'+
      'td.n{text-align:right;font-weight:600}'+
      'tr.s td{border-top:1.4px solid #C9CCE4;border-bottom:none;font-weight:800;color:#1B1D46;padding-top:4px;font-size:10.4px}'+
      '.mix td{font-size:9px}'+
      '.mix thead td{color:#8A90B4;font-size:7.4px;letter-spacing:.05em;text-transform:uppercase;font-weight:700;border-bottom:1px solid #C9CCE4}'+
      '.two{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}'+
      '.box{background:#F6F7FC;border-radius:5px;padding:6px 7px}'+
      '.box .l{font-size:7.4px;letter-spacing:.06em;text-transform:uppercase;color:#8A90B4;font-weight:700}'+
      '.box .v{font-size:12px;font-weight:800;color:#1B1D46;margin-top:1px}'+
      '.rr{display:flex;justify-content:space-between;color:#6A6F97;font-size:8.6px;padding:2px 0}'+
      '.verdict{margin-top:9px;border-radius:7px;padding:9px 11px;color:#fff}'+
      '.verdict .vh{font-size:13px;font-weight:800}'+
      '.verdict .vs{font-size:9px;margin-top:2px;opacity:.96;line-height:1.45}'+
      '.foot{margin-top:8px;font-size:7.4px;color:#9298BC;line-height:1.5;border-top:1px solid #EEF0F7;padding-top:5px}'+
      '.btn{position:fixed;top:9px;right:9px;background:#1E1F5C;color:#fff;border:none;border-radius:6px;padding:8px 14px;font-size:11px;font-weight:800;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25)}'+
      '</style></head><body>'+
      '<button class="btn noprint" onclick="window.print()">Print / Save as PDF</button>'+
      '<div class="pg">'+
        '<div class="top"><div><div class="brand">Cassidy Group · Land appraisal — one-page briefing</div>'+
          '<h1>'+esc(addr)+'</h1><div class="sub">'+esc(siteSub||"—")+(acres>0?' · <b>'+esc(acres)+' acres</b>':'')+'</div></div>'+
          '<div class="meta">'+((typeof BRAND_LOGO_PNG!=="undefined"&&BRAND_LOGO_PNG&&typeof cassidyLogoSrc==="function")?'<img src="'+cassidyLogoSrc()+'" alt="Cassidy Group Ltd" style="height:30px;width:auto;max-width:170px;display:block;margin:0 0 5px auto"/>':'')+(lpa?esc(lpa)+'<br/>':'')+esc(planStatus||"Unallocated")+'<br/>Indicative · v'+esc(typeof CURRENT_VERSION!=="undefined"?CURRENT_VERSION:"")+'</div></div>'+
        '<div class="kpis">'+
          '<div class="kpi"><div class="l">Homes</div><div class="v">'+(oUnits?oUnits.toLocaleString():"—")+'</div></div>'+
          '<div class="kpi"><div class="l">GDV</div><div class="v">'+(oGdv>0?fmt(oGdv):"—")+'</div></div>'+
          '<div class="kpi"><div class="l">Land guide price</div><div class="v">'+(askL>0?fmt(askL):"—")+'</div></div>'+
          '<div class="kpi"><div class="l">Residual land value</div><div class="v" style="color:'+(oRlv>0?"#1B7A54":"#B05A35")+'">'+(oRlv?((oRlv<0?"−":"")+fmt(Math.abs(oRlv))):"—")+'</div></div>'+
          '<div class="kpi"><div class="l">'+(askL>0?"Margin (all-in)":"Target profit")+'</div><div class="v" style="color:'+(askL>0?(marginAllIn>=15?"#1B7A54":marginAllIn>=12?"#9A7B3E":"#B05A35"):"#1B1D46")+'">'+(askL>0?pct(marginAllIn):Math.round(oProfitPct)+"%")+'</div></div>'+
        '</div>'+
        '<div class="cols">'+
          '<div class="card"><div class="ct">Scheme &amp; house mix</div>'+
            '<div class="rr"><span>Site area</span><b>'+(acres>0?acres+" acres · "+(acres*0.404686).toFixed(1)+" ha":"—")+'</b></div>'+
            '<div class="rr"><span>Density</span><b>'+(oDensity>0?oDensity+" homes/acre · ≈"+Math.round(oDensity*2.471)+" dph":"—")+'</b></div>'+
            '<div class="rr"><span>Homes (modelled mix)</span><b>'+(oUnits?oUnits.toLocaleString():"—")+(sitePotential>0?' <span style="color:#9298BC">of ~'+sitePotential.toLocaleString()+' site potential</span>':'')+'</b></div>'+
            '<div class="rr"><span>Affordable (S106)</span><b>'+(ahPct?ahPct+"% · ~"+ahU.toLocaleString()+" homes":"—")+'</b></div>'+
            '<div class="rr"><span>Avg home · sale £/sqft</span><b>'+(oAvgSqft?oAvgSqft.toLocaleString()+" sqft · £"+oBasePsf:"—")+'</b></div>'+
            '<table class="mix" style="margin-top:6px"><thead><tr><td>Type</td><td class="n">Plots</td><td class="n">Sqft</td><td class="n">£/sqft</td><td class="n">Revenue</td></tr></thead><tbody>'+
              (mixRows||'<tr><td colspan="5" style="color:#9298BC;padding:8px 0">No house mix entered — build the SFH House Mix to populate this.</td></tr>')+
              '<tr class="s"><td>Total GDV</td><td class="n" style="text-align:right" colspan="4">'+(oGdv>0?fmt(oGdv):"—")+'</td></tr>'+
            '</tbody></table>'+
          '</div>'+
          '<div class="card"><div class="ct">Appraisal — residual land value</div>'+
            '<table>'+
              cRow("Gross development value",fmt(oGdv),false,false)+
              (oRetail>oGdv+1?'<tr><td style="color:#9298BC">— affordable / mix discount</td><td class="n" style="color:#9298BC">−'+fmt(oRetail-oGdv)+'</td></tr>':'')+
              cRow("Build ("+ (oAvgSqft&&oUnits?Math.round(oAvgSqft*oUnits).toLocaleString()+" sqft @ £"+oBuildPsf:"")+")",fmt(oBuild),true,false)+
              (oFees>0?cRow("Professional fees",fmt(oFees),true,false):'')+
              (oCont>0?cRow("Contingency",fmt(oCont),true,false):'')+
              cRow("Finance ("+(num(sf.financeProgYears)||"?")+"yr · peak "+(num(sf.financePeakDebtPct)||"?")+"% · S-curve)",fmt(oFin),true,false)+
              cRow("S106 / CIL"+(oUnits>0?" (£"+fmtN(Math.round(oS106/oUnits))+"/plot)":""),fmt(oS106),true,false)+
              (oRoads>0?cRow("Roads &amp; sewers",fmt(oRoads),true,false):'')+
              (oInfra>0?cRow("Infrastructure &amp; SuDS",fmt(oInfra),true,false):'')+
              (oMkt>0?cRow("Marketing / disposal",fmt(oMkt),true,false):'')+
              cRow("Developer profit ("+Math.round(oProfitPct)+"%)",fmt(oProfit),true,false)+
              cRow("Residual land value",(oRlv<0?"−":"")+fmt(Math.abs(oRlv)),false,true)+
            '</table>'+
            '<div class="two">'+
              '<div class="box"><div class="l">Max land @ target profit</div><div class="v">'+(oRlv?((oRlv<0?"−":"")+fmt(Math.abs(oRlv))):"—")+'</div></div>'+
              '<div class="box"><div class="l">'+(askL>0?"Headroom vs asking":"Per plot")+'</div><div class="v" style="color:'+(askL>0?(headroom>=0?"#1B7A54":"#B05A35"):"#1B1D46")+'">'+(askL>0?((headroom<0?"−":"+")+fmt(Math.abs(headroom))):fmt(rlvPerPlot))+'</div></div>'+
            '</div>'+
            '<div class="rr" style="margin-top:5px"><span>Per plot / per acre</span><b>'+fmt(rlvPerPlot)+' · '+(acres>0?fmt(rlvPerAcre):"—")+'</b></div>'+
            (askL>0
              ? '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #D7D9EC">'+
                  '<div class="ct" style="margin-bottom:3px">Land — value vs cost to buy</div>'+
                  '<table>'+
                    cRow("Residual land value (max @ profit)",fmt(oRlv),false,false)+
                    cRow("Guide price (as entered)",fmt(askL),false,false)+
                    cRow("+ SDLT on land (non-resi bands)",fmt(acq.sdlt),false,false)+
                    cRow("+ Legals &amp; acquisition (1.5%)",fmt(acq.other),false,false)+
                    cRow("= Total cost to acquire",fmt(totalLandCost),false,true)+
                  '</table>'+
                  '<div class="rr" style="margin-top:4px"><span>Headroom — RLV less all-in cost</span><b style="color:'+(headroomAllIn>=0?"#1B7A54":"#B05A35")+'">'+(headroomAllIn<0?"−":"+")+fmt(Math.abs(headroomAllIn))+'</b></div>'+
                  '<div class="rr"><span>Profit / margin after land</span><b style="color:'+(marginAllIn>=15?"#1B7A54":marginAllIn>=12?"#9A7B3E":"#B05A35")+'">'+fmt(profitAllIn)+' · '+pct(marginAllIn)+' (land '+Math.round(landPctGdv)+'% of GDV)</b></div>'+
                '</div>'
              : (typeof landValueGuide==="function" ? (function(){
                  var g=landValueGuide(data), a=g.acres;
                  return '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #D7D9EC">'+
                    '<div class="ct" style="margin-bottom:3px;color:#7A5A2E">Indicative market land values — no guide price entered</div>'+
                    '<div style="font-size:8px;color:#6A6F97;margin-bottom:4px;line-height:1.4">Typical local prices by planning status'+(a>0?' (× '+a+' acres)':'')+'. Market context to frame an offer — the residual land value above is what to pay.</div>'+
                    '<table>'+
                      g.bands.map(function(b){ return '<tr><td>'+esc(b.label)+'</td><td class="n">£'+fmtN(Math.round(b.lo))+'–'+fmtN(Math.round(b.hi))+'/ac'+(a>0?' · '+fmt(b.lo*a)+'–'+fmt(b.hi*a):'')+'</td></tr>'; }).join('')+
                    '</table>'+
                    '<div style="font-size:7.5px;color:#9298BC;margin-top:3px;font-style:italic">Brownfield / previously-developed land ≈ consented value less demolition &amp; remediation. Indicative — verify with local agents.</div>'+
                  '</div>';
                })() : '<div class="rr" style="margin-top:6px;color:#9A7B3E"><span>Guide price</span><b>Enter one to test purchase costs vs RLV</b></div>'))+
          '</div>'+
        '</div>'+
        '<div class="verdict" style="background:'+vcol+'"><div class="vh">'+verdict+'</div><div class="vs">'+vsub+'</div></div>'+
        (oGdv>0
          ? '<div style="margin-top:9px;border:1px solid #C9CCE4;border-radius:7px;padding:9px 11px;background:#FBFAF5">'+
              '<div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#4A4BAE;font-weight:800;margin-bottom:4px">Target profit &rarr; what you can pay for the land</div>'+
              '<div style="font-size:8px;color:#6A6F97;margin-bottom:5px"><b>The more profit you target, the less you can pay for the land.</b> 17.5% of GDV is the planning-viability benchmark; volume house-builders often target 20%+ (a &lsquo;30% margin&rsquo; is usually profit-on-cost, &asymp; 22&ndash;23% on GDV).</div>'+
              '<table><tr>'+[17.5,20,25,30].map(function(p){ return '<td class="n" style="font-size:7.4px;color:#8A90B4;text-transform:uppercase;font-weight:700">'+p+'% profit</td>'; }).join('')+'</tr>'+
                '<tr>'+[17.5,20,25,30].map(function(p){ var v=(oGdv-oDev)-oGdv*(p/100); var pp=oUnits>0?v/oUnits:0; return '<td class="n" style="font-weight:800;color:'+(pp>=0?'#1B7A54':'#B05A35')+'">'+(pp<0?'−£':'£')+Math.abs(Math.round(pp/1000)).toLocaleString()+'k/plot</td>'; }).join('')+'</tr>'+
                '<tr>'+[17.5,20,25,30].map(function(p){ var v=(oGdv-oDev)-oGdv*(p/100); return '<td class="n" style="font-size:7.4px;color:#6A6F97">'+(v<0?'−':'')+fmt(Math.abs(v))+'</td>'; }).join('')+'</tr></table>'+
            '</div>'
          : '')+
        // v10.68 — two named scenarios side by side: the profit Keystone built at, and the user's
        // override — shown only when they differ, so the board sees both bases explicitly.
        (function(){
          var ksP=num((data.sfh||{}).keystoneProfitPct)||17.5, ourP=oProfitPct;
          if(!(oGdv>0) || Math.abs(ksP-ourP)<0.25) return '';
          function rlvAtP(p){ return (oGdv-oDev)-oGdv*(p/100); }
          var Av=rlvAtP(ksP), Bv=rlvAtP(ourP), acq2=askL>0?landAcqCosts(askL).total:0;
          function money(x){ return (x<0?'−':'')+fmt(Math.abs(x)); }
          function plot(v){ var pp=oUnits>0?v/oUnits:0; return '<span style="color:'+(pp>=0?'#1B7A54':'#B05A35')+';font-weight:800">'+(pp<0?'−£':'£')+Math.abs(Math.round(pp/1000)).toLocaleString()+'k</span>'; }
          function hr(v){ var h=v-(askL+acq2); return '<span style="color:'+(h>=0?'#1B7A54':'#B05A35')+'">'+(h<0?'−':'+')+fmt(Math.abs(h))+'</span>'; }
          return '<div style="margin-top:9px;border:1px solid #B9C6DE;border-radius:7px;padding:9px 11px;background:#F2F6FC">'+
            '<div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#2E2F8A;font-weight:800;margin-bottom:4px">Two scenarios &mdash; Keystone baseline vs your target profit</div>'+
            '<table>'+
              '<tr><td></td><td class="n" style="font-size:7.4px;color:#8A90B4;text-transform:uppercase;font-weight:700">Keystone &middot; '+(Math.round(ksP*10)/10)+'%</td><td class="n" style="font-size:7.4px;color:#8A90B4;text-transform:uppercase;font-weight:700">Your target &middot; '+(Math.round(ourP*10)/10)+'%</td></tr>'+
              '<tr><td>Residual land value</td><td class="n" style="font-weight:800;color:'+(Av>=0?'#1B7A54':'#B05A35')+'">'+money(Av)+'</td><td class="n" style="font-weight:800;color:'+(Bv>=0?'#1B7A54':'#B05A35')+'">'+money(Bv)+'</td></tr>'+
              '<tr><td>Per plot</td><td class="n">'+plot(Av)+'</td><td class="n">'+plot(Bv)+'</td></tr>'+
              (acres>0?'<tr><td>Per acre</td><td class="n">'+money(Av/acres)+'</td><td class="n">'+money(Bv/acres)+'</td></tr>':'')+
              (askL>0?'<tr><td>Headroom vs '+fmt(askL)+' guide</td><td class="n">'+hr(Av)+'</td><td class="n">'+hr(Bv)+'</td></tr>':'')+
            '</table>'+
            '<div style="font-size:7.5px;color:#6A6F97;margin-top:3px">Same scheme, sale values and costs &mdash; only the developer profit target differs (Keystone built at '+(Math.round(ksP*10)/10)+'%; your override '+(Math.round(ourP*10)/10)+'%).</div>'+
          '</div>';
        })()+
        (oCapNetRent>0
          ? '<div style="margin-top:9px;border:1px solid #BFD9CF;border-radius:7px;padding:9px 11px;background:#F5FBF8">'+
              '<div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#1B7A54;font-weight:800;margin-bottom:4px">Forward-fund exit — whole scheme sold to a pension fund</div>'+
              '<div style="font-size:9px;color:#6A6F97;margin-bottom:5px">The completed scheme let and sold as a rented investment at a net initial yield (net rent '+fmt(oCapNetRent)+'/yr, after 25% management). A keener (lower) yield means the fund pays more. '+(askL>0?'Profit is after the '+fmt(totalLandCost)+' all-in land cost.':'Max land value is at '+Math.round(oProfitPct)+'% target profit.')+'</div>'+
              '<table><tr>'+
                '<td style="color:#8A90B4;font-size:7.4px;letter-spacing:.05em;text-transform:uppercase;font-weight:700">Net yield</td>'+
                '<td class="n" style="color:#8A90B4;font-size:7.4px;text-transform:uppercase;font-weight:700">Fund pays</td>'+
                '<td class="n" style="color:#8A90B4;font-size:7.4px;text-transform:uppercase;font-weight:700">'+(askL>0?'Profit (all-in)':'Max land')+'</td>'+
                '<td class="n" style="color:#8A90B4;font-size:7.4px;text-transform:uppercase;font-weight:700">'+(askL>0?'Margin':'Profit @ target')+'</td></tr>'+
                oCapYields.map(function(y){ var iv=oCapIV(y), pr=oCapProfitAllIn(y), mg=iv>0?pr/iv*100:0, sel=Math.abs(y-oCapYieldPct)<0.05;
                  return '<tr'+(sel?' style="background:rgba(27,122,84,.09);font-weight:800"':'')+'>'+
                    '<td>'+y.toFixed(1)+'%</td>'+
                    '<td class="n">'+fmt(iv)+'</td>'+
                    '<td class="n" style="color:'+(askL>0?(pr>=0?'#1B7A54':'#B05A35'):(oCapMaxLand(y)>=0?'#1B7A54':'#B05A35'))+'">'+(askL>0?((pr<0?'−':'')+fmt(Math.abs(pr))):((oCapMaxLand(y)<0?'−':'')+fmt(Math.abs(oCapMaxLand(y)))))+'</td>'+
                    '<td class="n" style="color:'+(askL>0?(mg>=15?'#1B7A54':mg>=12?'#9A7B3E':'#B05A35'):'#3A3D6A')+'">'+(askL>0?pct(mg):fmt(iv*(oProfitPct/100)))+'</td></tr>'; }).join('')+
              '</table>'+
            '</div>'
          : '')+
        pathBlock+
        (typeof projectTimeline==="function" ? (function(){
          var t=projectTimeline(data);
          return '<div style="margin-top:9px;border:1px solid #C9CCE4;border-radius:7px;padding:9px 11px;background:#fff">'+
            '<div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#2E2F8A;font-weight:800;margin-bottom:4px">Programme &amp; timeline</div>'+
            '<div style="font-size:8px;color:#6A6F97;margin-bottom:5px">Two separate clocks: winning planning consent (councils routinely exceed the 13-week statutory target on major/strategic applications) and building out. Current position: <b>'+esc(t.statusLabel)+'</b>. Planning figure — '+(num((data.planning||{}).planningTimelineMonths)>0?'as assessed':'by status, indicative')+'; refine with the LPA / a PPA.</div>'+
            '<table>'+
              '<tr><td>Planning to consent</td><td class="n">~'+t.planningYears+' yr'+(t.planningYears===1?'':'s')+' ('+t.planningMonths+' months)</td></tr>'+
              '<tr><td>Build-out programme (incl. sales runoff)</td><td class="n">~'+t.buildYears+' yrs</td></tr>'+
              '<tr class="s"><td>Total to exit</td><td class="n">~'+t.totalYears+' yrs</td></tr>'+
            '</table>'+
            '<div style="font-size:7.5px;color:#9298BC;margin-top:3px;font-style:italic">A forward-fund only starts once the scheme is consented and fundable — the total money-in-to-exit horizon stacks planning on top of the build.</div>'+
          '</div>';
        })() : '')+
        (typeof basisOfFigures==="function" ? (function(){
          var bo=basisOfFigures(data);
          return '<div style="margin-top:9px;border:1px solid #C9CCE4;border-radius:7px;padding:9px 11px;background:#fff">'+
            '<div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#2E2F8A;font-weight:800;margin-bottom:5px">Basis of figures &mdash; how each number was derived</div>'+
            '<table>'+bo.lines.map(function(x){ return '<tr><td style="width:20%;color:#4A4BAE;font-weight:700;vertical-align:top;padding:2px 6px 2px 0;border:none">'+esc(x.k)+'</td><td style="color:#3A3D6A;line-height:1.45;padding:2px 0;border:none">'+esc(x.v)+'</td></tr>'; }).join('')+'</table>'+
          '</div>';
        })() : '')+
        '<div class="foot"><b>Indicative appraisal — not a RICS Red Book valuation.</b> Figures are computed on Landform\'s engine from the inputs entered (site area, density, house mix, sale and build £/sqft, S106, finance and profit assumptions) and assume residential consent can be achieved. '+
          (askL<=0?'Enter a land guide price on the Board Proposal or Land stage to test purchase costs (SDLT, legals, acquisition) against the residual land value. ':'')+
          'Verify sale and build values against local comparables and a QS cost plan before commitment. Residual land value is the maximum supportable land PRICE at target developer profit'+(askL>0?'; the all-in position adds SDLT (non-residential land bands: 0% ≤£150k, 2% to £250k, 5% above) plus ~1.5% legals &amp; acquisition on the '+fmt(askL)+' guide price':'')+'. SDLT rates and reliefs vary — confirm with your tax adviser.</div>'+
      '</div></body></html>';
}

// ── v10.77 — BLIND INVESTMENT TEASER ──────────────────────────────────────────
// A confidential, ANONYMISED investment pack: the full financial case (GDV, cost stack,
// developer profit/margin, forward-fund value & yield, returns) with the SITE IDENTITY
// withheld — no address, postcode, LPA name, agent or listing URL. Location is described only
// by a coarse region + market tier. An investor can judge the opportunity and the returns, then
// contact Cassidy under NDA to see the site — so competing developers can't identify and
// piggyback the deal. Also carries an anticipated investor Q&A so the pack pre-empts the
// questions an IC would ask. Shares the one-pager's engine + house style.
var _BLIND_REGION_MAP = {
  // London
  E:"London",EC:"London",N:"London",NW:"London",SE:"London",SW:"London",W:"London",WC:"London",
  BR:"Greater London",CR:"Greater London",DA:"Greater London",EN:"Greater London",HA:"Greater London",
  IG:"Greater London",KT:"Greater London",RM:"Greater London",SM:"Greater London",TW:"Greater London",UB:"Greater London",WD:"Greater London",
  // South East
  BN:"the South East",CT:"the South East",GU:"the South East",ME:"the South East",OX:"the South East",
  PO:"the South East",RG:"the South East",RH:"the South East",SL:"the South East",SO:"the South East",TN:"the South East",
  // East of England
  AL:"the East of England",CB:"the East of England",CM:"the East of England",CO:"the East of England",HP:"the East of England",
  IP:"the East of England",LU:"the East of England",MK:"the East of England",NR:"the East of England",PE:"the East of England",SG:"the East of England",SS:"the East of England",
  // South West
  BA:"the South West",BH:"the South West",BS:"the South West",DT:"the South West",EX:"the South West",
  GL:"the South West",PL:"the South West",SN:"the South West",SP:"the South West",TA:"the South West",TQ:"the South West",TR:"the South West",
  // West Midlands
  B:"the West Midlands",CV:"the West Midlands",DY:"the West Midlands",HR:"the West Midlands",ST:"the West Midlands",TF:"the West Midlands",WR:"the West Midlands",WS:"the West Midlands",WV:"the West Midlands",
  // East Midlands
  DE:"the East Midlands",LE:"the East Midlands",LN:"the East Midlands",NG:"the East Midlands",NN:"the East Midlands",
  // Yorkshire & the Humber
  BD:"Yorkshire",DN:"Yorkshire",HD:"Yorkshire",HG:"Yorkshire",HU:"Yorkshire",HX:"Yorkshire",LS:"Yorkshire",S:"Yorkshire",WF:"Yorkshire",YO:"Yorkshire",
  // North West
  BB:"the North West",BL:"the North West",CA:"the North West",CH:"the North West",CW:"the North West",FY:"the North West",
  L:"the North West",LA:"the North West",M:"the North West",OL:"the North West",PR:"the North West",SK:"the North West",WA:"the North West",WN:"the North West",
  // North East
  DH:"the North East",DL:"the North East",NE:"the North East",SR:"the North East",TS:"the North East",
  // Wales
  CF:"Wales",LD:"Wales",LL:"Wales",NP:"Wales",SA:"Wales",SY:"Wales",
  // Scotland
  AB:"Scotland",DD:"Scotland",DG:"Scotland",EH:"Scotland",FK:"Scotland",G:"Scotland",IV:"Scotland",KA:"Scotland",KY:"Scotland",ML:"Scotland",PA:"Scotland",PH:"Scotland",TD:"Scotland"
};
function _blindRegion(data){
  data = data || {};
  var inv = data.investor || {};
  if(inv.blindRegion) return String(inv.blindRegion);          // manual override
  var pc = ((data.land&&data.land.postcode)||(data.rlv&&data.rlv.postcode)||"").toUpperCase().trim();
  var m = pc.match(/^([A-Z]{1,2})/);
  if(m && _BLIND_REGION_MAP[m[1]]) return _BLIND_REGION_MAP[m[1]];
  return "the United Kingdom";
}
function _blindMarketTier(data){
  // Coarse market descriptor from the achieved sale £/sqft (GDV ÷ floor area) — more reliable
  // than a raw basePsf input, and never names the town.
  var sf = (typeof computeSFHMetrics==="function") ? computeSFHMetrics(data) : {};
  var retail = num(sf.retailGdv)||num(sf.gdv)||0;
  var area = (num(sf.avgSqft)||0) * (num(sf.totalUnits)||0);
  var psf = area>0 ? retail/area : (num(sf.basePsf)||0);
  if(psf >= 500) return "a prime, high-value";
  if(psf >= 400) return "a strong, established";
  if(psf >= 320) return "a solid mid-market";
  if(psf > 0)    return "an emerging value";
  return "an established";
}
function _blindRef(data){
  var inv = data.investor || {};
  if(inv.blindRef) return String(inv.blindRef);
  var seed = String((data._cloudDealId||"")+(data.land&&data.land.address||"")+(data.land&&data.land.postcode||""));
  var h = 0; for(var i=0;i<seed.length;i++){ h = ((h<<5)-h + seed.charCodeAt(i))|0; }
  return "CAS-" + (Math.abs(h)%100000).toString().padStart(5,"0");
}
function buildBlindTeaser(data){
  data = data || {};
  var p=data.planning||{}, ten=data.tenure||{}, ex=data.exit||{};
  var SF=(typeof computeSFHMetrics==="function")?computeSFHMetrics(data):{};
  var M=(typeof calcDealMetrics==="function")?calcDealMetrics(data):{};
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  var region=_blindRegion(data), tier=_blindMarketTier(data), ref=_blindRef(data);
  var units=num(SF.totalUnits)||num(M.units)||num(p.units)||0;
  var gdv=num(SF.gdv)||num(M.gdv)||0;
  var build=num(SF.buildCost), fees=num(SF.fees), cont=num(SF.contingency), fin=num(SF.finance);
  var s106=num(SF.s106), roads=num(SF.roads), infra=num(SF.infra), mkt=num(SF.marketing);
  var dev=num(SF.devCost)||(build+fees+cont+fin+s106+roads+infra+mkt);
  var rlv=num(SF.rlv)||num(M.rlv)||0;
  var profit=num(SF.profit)||0;
  var profitPct=gdv>0?profit/gdv*100:0;
  var profitOnCost=(dev+rlv)>0?profit/(dev+rlv)*100:0;
  var avgSqft=Math.round(num(SF.avgSqft)||0), basePsf=Math.round(num(SF.basePsf)||0), buildPsf=Math.round(num(SF.buildPsf)||0);
  var ahPct=num(SF.ahPctResolved)||num(p.ahPct||p.afhPct||ten.ahPct||0);
  var acres=num((data.land||{}).acres||0);
  var density=(acres>0&&units>0)?Math.round(units/acres):0;
  var progYears=num(SF.financeProgYears)||0, peakDebt=num(SF.financePeakDebtPct)||0;
  var tl=(typeof projectTimeline==="function")?projectTimeline(data):null;
  // Forward-fund economics
  var netRent=num(SF.capNetRentPa)||0;
  var yld=(typeof dealYield==="function")?dealYield(data):4.9; if(yld>0&&yld<1) yld*=100; yld=Math.max(4.5,Math.min(6,yld||4.9));
  function ffVal(y){ return y>0?netRent/(y/100):0; }
  var ffValue=ffVal(yld);
  var yields=[4.5,5.0,5.5,6.0];
  var yieldOnCost=(dev+rlv)>0?netRent/(dev+rlv)*100:0;
  // Tenure summary (from the Tenure Mix stage if present)
  var tenLine="";
  (function(){
    var mix=ten.mix||null; if(!mix) return;
    var lbl={oms:"Open-market sale",sr:"Social rent",ar:"Affordable rent",so:"Shared ownership",first_homes:"First Homes",btr:"Build to Rent",dms:"Discounted sale",prs:"PRS"};
    var parts=Object.keys(mix).filter(function(k){return num(mix[k])>0;}).map(function(k){return (lbl[k]||k)+" "+Math.round(num(mix[k]))+"%";});
    tenLine=parts.join(" · ");
  })();
  var stratLbl={plot_sales:"open-market plot sales",bulk_sale_ha:"bulk sale to a housing association",forward_fund:"institutional forward-funding",forward_sale:"forward sale",stabilised:"build, stabilise and sell as an investment",retain:"build to rent and hold",phased:"phased delivery"}[ex.strategy]||"institutional forward-funding";

  function money(x){ return (x<0?"−":"")+fmt(Math.abs(x)); }
  function row(k,v,strong){ return '<tr'+(strong?' class="s"':'')+'><td>'+k+'</td><td class="n">'+v+'</td></tr>'; }

  // ── Anticipated investor Q&A — answered from the deal's own figures ──
  // Structured to pre-empt the questions a UK investment committee actually asks (deal type,
  // returns, downside, planning, deliverability, regulatory compliance, exit evidence).
  var qa=[
    ["What is the opportunity and how big is it?", esc(units.toLocaleString())+" new homes in "+esc(tier)+" residential market in "+esc(region)+", with a gross development value of "+fmt(gdv)+". Structured for "+esc(stratLbl)+"."],
    ["What is on offer — the deal structure?", (ex.strategy==="forward_fund"||ex.strategy==="forward_sale"||!ex.strategy)?("A forward-funding structure: the investor acquires the land, funds construction in stages against a QS-certified drawdown, earns a coupon during the build, and takes the completed scheme at an agreed net initial yield — with SDLT on the land value only. Forward-commit and JV/co-invest structures can also be accommodated; heads of terms are negotiable."):(ex.strategy==="retain"||ex.strategy==="stabilised")?("Build, stabilise and hold as a rented investment, or a JV / co-invest in the SPV with a governance and profit-share structure. Terms are negotiable."):("A JV / co-investment or bulk-sale structure with a negotiated waterfall and governance. Heads of terms are negotiable.")],
    ["What return does the scheme carry?", "Developer profit of "+fmt(profit)+" — "+pct(profitPct)+" on GDV and "+pct(profitOnCost)+" on cost. Total development cost (excl. land) is "+fmt(dev)+". Project IRR, equity multiple and the geared position are in the data room."],
    ["What would an institution pay for it as an investment?", netRent>0?("Let and sold as a rented investment, the scheme capitalises to "+fmt(ffValue)+" at a "+yld.toFixed(2)+"% net initial yield (net rent "+fmt(netRent)+"/yr after ~25% management). Yield-on-cost is "+pct(yieldOnCost)+" — a positive spread over the exit yield."):"A forward-fund valuation is available once the rental tenure is fixed — see the data room."],
    ["Where is my downside protected?", "The residual land value at target profit is "+money(rlv)+" ("+(units>0?fmt(rlv/units)+"/plot":"—")+") — an investor's capital is underpinned by the land itself. Full break-even and dual-sensitivity analysis (GDV −10% with build cost +10% and exit yield +50bps) are in the data room."],
    ["What is the planning position?", "Route: "+esc((p.status||"unallocated")==="full"?"full consent":(p.status==="outline"?"outline consent":p.status==="allocated"?"allocated in the local plan":"promotion through the local plan / outline"))+". "+(num(p.planningProb)>0?("Indicative probability of consent "+Math.round(num(p.planningProb))+"%. "):"")+"Assessed against the LPA's housing land supply position under the December 2024 NPPF. Full planning strategy, S106 and risk are in the data room."],
    ["Is it regulation-ready (BNG, Future Homes, safety)?", "Designed to meet current requirements: mandatory 10% Biodiversity Net Gain, the Future Homes Standard (low-carbon heating, no new gas connections) and EPC A/B new-build. Building Safety Act gateways apply to any higher-risk block; the compliance strategy and costs are in the appraisal and data room."],
    ["What is the tenure and affordable mix?", (tenLine?esc(tenLine)+". ":"")+(ahPct>0?(Math.round(ahPct)+"% affordable housing (S106); grant eligibility and any RP offtake are set out in the data room."):"Tenure mix confirmed under NDA.")],
    ["What is the timeline and funding profile?", (tl?("Two clocks: ~"+tl.planningYears+" years to win planning consent (councils routinely exceed the 13-week statutory target on major schemes) and a ~"+tl.buildYears+"-year build-out — a total money-in-to-exit horizon of ~"+tl.totalYears+" years. "):"")+(peakDebt>0?"Peak debt ~"+peakDebt+"% of cost on an S-curve draw. ":"")+"Build cost is on a BCIS-referenced basis with a stated contingency; the full cashflow, drawdown, peak-equity and coupon/balancing mechanics are in the data room."],
    ["Who buys it, and what backs the values?", "Sale and rental values are underpinned by recent local comparables (in the data room). The completed rented scheme suits institutional forward-funders and BTR/SFH operators active in "+esc(region)+" — a market that has seen record institutional bid volume. The developer's track record and references are provided under NDA."],
    ["Why is the site not named?", "To protect a live, off-market opportunity. The exact location, title, planning references and vendor are released under NDA once mutual interest is established — so the numbers can be assessed without exposing the site to competing developers."]
  ];

  var css=''+
    '@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}html,body{margin:0}'+
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#26284F;font-size:9.9px;line-height:1.45;font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#eef0f7}'+
    '.pg{width:190mm;min-height:277mm;margin:6mm auto;background:#fff;padding:10mm 10mm 8mm;box-shadow:0 2px 14px rgba(0,0,0,.12)}'+
    '@media print{body{background:#fff}.pg{margin:0;box-shadow:none;width:auto;min-height:auto;padding:0}.noprint{display:none}}'+
    '.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1B1D46;padding-bottom:6px;margin-bottom:4px}'+
    '.brand{font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:#9A7B3E;font-weight:800}'+
    'h1{font-family:Georgia,serif;font-size:17px;color:#1B1D46;margin:2px 0 0}'+
    '.sub{color:#6A6F97;font-size:9.5px;margin-top:3px}'+
    '.conf{display:inline-block;background:#8A1B2E;color:#fff;font-size:7.6px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;padding:2px 7px;border-radius:3px;margin-bottom:5px}'+
    '.meta{text-align:right;font-size:8.3px;color:#6A6F97;line-height:1.5}'+
    '.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:9px 0}'+
    '.kpi{border:1px solid #E0E2EC;border-radius:5px;padding:7px 8px;background:#FafBff}'+
    '.kpi .l{font-size:7.3px;letter-spacing:.07em;text-transform:uppercase;color:#8A90B4;font-weight:700}'+
    '.kpi .v{font-size:14px;font-weight:800;color:#1B1D46;margin-top:2px;font-family:Georgia,serif}'+
    '.cols{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:3px}'+
    '.card{border:1px solid #E0E2EC;border-radius:6px;padding:9px 10px;margin-bottom:9px}'+
    '.ct{font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#4A4BAE;font-weight:800;margin-bottom:5px}'+
    'table{width:100%;border-collapse:collapse}td{padding:2.6px 0;border-bottom:1px solid #F1F2F8;vertical-align:top}'+
    'td.n{text-align:right;font-weight:600}tr.s td{border-top:1.4px solid #C9CCE4;border-bottom:none;font-weight:800;color:#1B1D46;padding-top:4px;font-size:10.6px}'+
    '.hl{margin:0;padding-left:15px}.hl li{margin-bottom:3px;color:#33365F}'+
    '.rr{display:flex;justify-content:space-between;color:#6A6F97;font-size:8.8px;padding:2px 0}.rr b{color:#33365F}'+
    '.qa{border:1px solid #C9CCE4;border-radius:6px;padding:9px 10px;background:#FBFAF5;margin-bottom:9px}'+
    '.qa .q{font-weight:800;color:#1B1D46;font-size:9.3px;margin-top:6px}.qa .q:first-child{margin-top:0}.qa .a{color:#43476E;font-size:9px;margin:1px 0 0;line-height:1.45}'+
    '.cta{border:1.5px solid #1B7A54;border-radius:7px;padding:11px 13px;background:#F1FBF6;margin-top:2px}'+
    '.cta .h{font-size:11px;font-weight:800;color:#1B7A54}.cta .b{font-size:9px;color:#33365F;margin-top:3px;line-height:1.5}'+
    '.foot{margin-top:9px;font-size:7.5px;color:#9298BC;line-height:1.55;border-top:1px solid #EEF0F7;padding-top:6px}'+
    '.btn{position:fixed;top:9px;right:9px;background:#1E1F5C;color:#fff;border:none;border-radius:6px;padding:8px 14px;font-size:11px;font-weight:800;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25)}';

  var logo=((typeof BRAND_LOGO_PNG!=="undefined"&&BRAND_LOGO_PNG&&typeof cassidyLogoSrc==="function")?'<img src="'+cassidyLogoSrc()+'" alt="Cassidy Group Ltd" style="height:30px;width:auto;max-width:170px;display:block;margin:0 0 5px auto"/>':'');

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>'+
    '<title>Confidential Investment Opportunity — '+esc(ref)+'</title><style>'+css+'</style></head><body>'+
    '<button class="btn noprint" onclick="window.print()">Print / Save as PDF</button>'+
    '<div class="pg">'+
      '<div class="top"><div><div class="brand">Cassidy Group · Confidential Investment Opportunity</div>'+
        '<h1>Residential development — '+esc(region)+'</h1>'+
        '<div class="sub">'+esc(units.toLocaleString())+' homes · '+esc(tier)+' residential market · for '+esc(stratLbl)+'</div></div>'+
        '<div class="meta">'+logo+'<span class="conf">Strictly private &amp; confidential</span><br/>Ref '+esc(ref)+'<br/>Indicative · v'+esc(typeof CURRENT_VERSION!=="undefined"?CURRENT_VERSION:"")+'</div></div>'+
      '<div class="kpis">'+
        '<div class="kpi"><div class="l">Homes</div><div class="v">'+(units?units.toLocaleString():"—")+'</div></div>'+
        '<div class="kpi"><div class="l">GDV</div><div class="v">'+(gdv>0?fmt(gdv):"—")+'</div></div>'+
        '<div class="kpi"><div class="l">Developer profit</div><div class="v" style="color:#1B7A54">'+(profit>0?fmt(profit):"—")+'</div></div>'+
        '<div class="kpi"><div class="l">Profit on GDV</div><div class="v">'+(gdv>0?pct(profitPct):"—")+'</div></div>'+
        '<div class="kpi"><div class="l">Fwd-fund value</div><div class="v" style="color:#1B7A54">'+(ffValue>0?fmt(ffValue):"—")+'</div></div>'+
      '</div>'+
      '<div class="cols">'+
        '<div>'+
          '<div class="card"><div class="ct">The opportunity</div>'+
            '<p style="margin:0 0 5px;font-size:9.4px;color:#33365F;line-height:1.5">A '+esc(units.toLocaleString())+'-home residential development in '+esc(tier)+' market in '+esc(region)+', carrying a '+fmt(gdv)+' GDV and '+fmt(profit)+' developer profit ('+pct(profitPct)+' on GDV, '+pct(profitOnCost)+' on cost). The scheme is structured for '+esc(stratLbl)+'.</p>'+
            '<div class="ct" style="margin-top:6px">Investment highlights</div>'+
            '<ul class="hl" style="font-size:9px">'+
              '<li><b>Scale &amp; value:</b> '+esc(units.toLocaleString())+' homes, '+fmt(gdv)+' GDV.</li>'+
              (netRent>0?'<li><b>Institutional exit:</b> capitalises to '+fmt(ffValue)+' at '+yld.toFixed(2)+'% net yield — forward-fundable.</li>':'')+
              '<li><b>Return:</b> '+pct(profitPct)+' profit on GDV ('+fmt(profit)+'), '+pct(profitOnCost)+' on cost.</li>'+
              (ahPct>0?'<li><b>Policy-compliant:</b> '+Math.round(ahPct)+'% affordable housing.</li>':'')+
              '<li><b>Location:</b> '+esc(tier)+' residential market in '+esc(region)+'.</li>'+
              '<li><b>Off-market:</b> not openly marketed — full details under NDA.</li>'+
            '</ul>'+
          '</div>'+
          '<div class="card"><div class="ct">Scheme &amp; delivery</div>'+
            '<div class="rr"><span>Homes (modelled)</span><b>'+(units?units.toLocaleString():"—")+'</b></div>'+
            '<div class="rr"><span>Average home size</span><b>'+(avgSqft?avgSqft.toLocaleString()+" sqft":"—")+'</b></div>'+
            (density>0?'<div class="rr"><span>Density</span><b>'+density+' homes/acre · ≈'+Math.round(density*2.471)+' dph</b></div>':'')+
            (tenLine?'<div class="rr"><span>Tenure mix</span><b style="max-width:60%;text-align:right">'+esc(tenLine)+'</b></div>':'')+
            (ahPct>0?'<div class="rr"><span>Affordable (S106)</span><b>'+Math.round(ahPct)+'%</b></div>':'')+
            (tl?'<div class="rr"><span>Planning to consent</span><b>~'+tl.planningYears+' yrs ('+tl.planningMonths+'mo)</b></div>'+
                '<div class="rr"><span>Build-out programme</span><b>~'+tl.buildYears+' yrs</b></div>'+
                '<div class="rr"><span>Total to exit</span><b>~'+tl.totalYears+' yrs</b></div>'
              :(progYears>0?'<div class="rr"><span>Programme</span><b>~'+progYears+' years</b></div>':''))+
            (peakDebt>0?'<div class="rr"><span>Peak debt (S-curve)</span><b>~'+peakDebt+'% of cost</b></div>':'')+
            '<div class="rr"><span>Planning route</span><b>'+esc((p.status==="full")?"Full consent":(p.status==="outline")?"Outline":(p.status==="allocated")?"Allocated":"Promotion / outline")+'</b></div>'+
          '</div>'+
        '</div>'+
        '<div>'+
          '<div class="card"><div class="ct">Financial summary</div>'+
            '<table>'+
              row("Gross development value",fmt(gdv),false)+
              row("Build"+(avgSqft&&units?" ("+Math.round(avgSqft*units).toLocaleString()+" sqft @ £"+buildPsf+")":""),"−"+fmt(build),false)+
              (fees>0?row("Professional fees","−"+fmt(fees),false):'')+
              (cont>0?row("Contingency","−"+fmt(cont),false):'')+
              row("Finance"+(progYears?" ("+progYears+"yr · peak "+peakDebt+"%)":""),"−"+fmt(fin),false)+
              row("S106 / CIL","−"+fmt(s106),false)+
              ((roads+infra)>0?row("Infrastructure / roads","−"+fmt(roads+infra),false):'')+
              row("Developer profit ("+Math.round(profitPct)+"%)","−"+fmt(profit),false)+
              row("Residual land budget",money(rlv),true)+
            '</table>'+
            '<div class="rr" style="margin-top:5px"><span>Profit on cost</span><b>'+pct(profitOnCost)+'</b></div>'+
            (units>0?'<div class="rr"><span>Land budget per plot</span><b>'+fmt(rlv/units)+'</b></div>':'')+
          '</div>'+
          (netRent>0?'<div class="card"><div class="ct">Forward-fund returns — investor view</div>'+
            '<div style="font-size:8.6px;color:#6A6F97;margin-bottom:5px;line-height:1.45">Completed scheme let &amp; sold as a rented investment at a net initial yield (net rent '+fmt(netRent)+'/yr after ~25% management). A keener yield ⇒ the fund pays more.</div>'+
            '<table><tr><td style="color:#8A90B4;font-size:7.4px;text-transform:uppercase;font-weight:700">Net yield</td><td class="n" style="color:#8A90B4;font-size:7.4px;text-transform:uppercase;font-weight:700">Investment value</td><td class="n" style="color:#8A90B4;font-size:7.4px;text-transform:uppercase;font-weight:700">Yield on cost</td></tr>'+
              yields.map(function(y){ var iv=ffVal(y), yoc=(dev+rlv)>0?netRent/(dev+rlv)*100:0, sel=Math.abs(y-yld)<0.05;
                return '<tr'+(sel?' style="background:rgba(27,122,84,.09);font-weight:800"':'')+'><td>'+y.toFixed(1)+'%</td><td class="n">'+fmt(iv)+'</td><td class="n">'+pct(yoc)+'</td></tr>'; }).join('')+
            '</table></div>':'')+
        '</div>'+
      '</div>'+
      '<div class="qa"><div class="ct">Anticipated questions — answered</div>'+
        qa.map(function(x){ return '<div class="q">'+x[0]+'</div><div class="a">'+x[1]+'</div>'; }).join('')+
      '</div>'+
      '<div class="cta"><div class="h">▸ Interested? The next step is an NDA.</div>'+
        '<div class="b">The <b>site location, title, planning references, vendor and the full data room</b> (appraisal model, cashflow, planning strategy, comparables, surveys) are released under a mutual non-disclosure agreement once initial interest is confirmed. This protects a live, off-market opportunity. Contact <b>Cassidy Group</b> quoting reference <b>'+esc(ref)+'</b> to receive the NDA and full pack.</div></div>'+
      '<div class="foot"><b>Strictly private &amp; confidential — indicative, not a RICS Red Book valuation or a financial promotion.</b> Figures are computed on Landform\'s appraisal engine from the scheme inputs and assume residential consent can be achieved; they are indicative and subject to verification against local comparables, a QS cost plan and formal valuation. Nothing here constitutes an offer, invitation or inducement to invest. The site is deliberately un-named to protect a live opportunity; identifying details are released only under NDA. © Cassidy Group Ltd.</div>'+
    '</div></body></html>';
}

function renderProposal(city, data, gdv, lc, up, user){
  var l=data.land||{}; var p=data.planning||{}; var ten=data.tenure||{}; var ex=data.exit||{};
  var M=(typeof calcDealMetrics==="function")?calcDealMetrics(data):{};
  var SF=(typeof computeSFHMetrics==="function")?computeSFHMetrics(data):{};

  var addr=l.address||(data.scraper&&data.scraper.result&&data.scraper.result.address)||"Development Site";
  var pc=(l.postcode||(data.rlv&&data.rlv.postcode)||"").toUpperCase().trim();
  var cityDisp=cityName(city||l.city||"")||"";
  var county=l.county||"";
  var acres=num(l.acres||0);
  // v10.32 — headline unit count MUST match the GDV basis. For an SFH scheme the GDV/RLV are
  // computed from the modelled house mix (computeSFHMetrics.totalUnits), so when a real mix
  // exists the proposal reads THAT figure — not the (often larger) site-capacity/brief number
  // held on Land/Planning. The brief's capacity is surfaced separately as "site potential" so
  // the board still sees the full-site headroom without the GDV appearing to value it.
  // (Staplehurst: values the modelled 1,000 plots, notes the ~1,902 brief capacity alongside.)
  var modelledUnits=num(SF.totalUnits)||0;
  var siteUnits=num(M.units||p.units||l.units||(data.rlv&&data.rlv.units)||0);
  var units=modelledUnits>0?modelledUnits:siteUnits;
  var sitePotential=(modelledUnits>0 && siteUnits>modelledUnits*1.1)?siteUnits:0;
  var gdvV=num(M.gdv)||num(gdv)||0;
  var rlvV=num(M.rlv)||0;
  var marginV=isFinite(M.marginPct)?num(M.marginPct):0;
  var s106V=num(M.s106)||num(p.s106)||0;
  var ask=num(l.price||0);
  var ahPct=num(p.ahPct||p.afhPct||ten.ahPct||0);
  var planStatus=p.status||l.planningStatus||"Unallocated";
  var lpa=p.lpa||l.localAuthority||"";
  var ccVerdict=(typeof constraintVerdict==="function")?constraintVerdict(data):"";
  var ccScore=(data.constraintCheck&&data.constraintCheck.results&&num(data.constraintCheck.results.score))||0;
  var buildTot=num(M.buildCost)+num(M.roads)+num(M.infra);
  var density=(acres>0&&units>0)?Math.round(units/acres):0;
  var exitStrat=ex.strategy||"";
  var ready=gdvV>0 && units>0;
  // Exit / yield sensitivity inputs
  var devCostV=num(M.devCost);
  var noi=(typeof dealNOI==="function")?dealNOI(data):num(SF.capNetRentPa); // shared engine NOI (single source of truth with the Exit page; BTR no longer £0)
  var baseYieldPct=(typeof dealYield==="function")?num(dealYield(data)):4.7;
  var landBasis=ask>0?ask:rlvV;                                        // land price the profit is measured against

  // ── Exit Scenarios — replicate the Exit Strategy engine (same maths, location/scheme-agnostic) ──
  // Mirrors js/screen-Exit.js BUYER_TYPES so the board paper's buyer valuations, hold-vs-sell,
  // refinancing and yield benchmarks match the Exit Strategy page exactly, for whatever site is loaded.
  var exAt=((data.assetType||"sfh")+"").toLowerCase();
  var exCityKey=(typeof dealCityKey==="function"?dealCityKey(data):"")||city||l.city||"manchester";
  var exMkt=((typeof MKT!=="undefined")&&(MKT[exCityKey]||MKT.manchester))||{btr:900,pbsa:180,yield:0.05,build:188};
  var exUnits=units>0?units:50;
  var exAhPct=ahPct;
  var exGdv=gdvV;
  var exNoi=noi;
  var exDealY=((typeof dealYield==="function"?num(dealYield(data))/100:0)||exMkt.yield||0.047);
  var exDealYSourced=num(data.capitalise&&data.capitalise.targetYield)>0;
  var exAvgSqft=num((data.rlv&&data.rlv.avgSqft))||850;
  var exBuildPsf=num((data.rlv&&data.rlv.buildPsf))||exMkt.build||188;
  var exBuildTot=exUnits*exAvgSqft*exBuildPsf;
  var exFinRate=num((data.fin&&data.fin.finRatePa)||(data.rlv&&data.rlv.finRate)); exFinRate=(exFinRate>0?exFinRate:7.5)/100;
  var exSalePsf=num(data.rlv&&data.rlv.salePsf)||((typeof estSalePsfFromRent==="function")?num(estSalePsfFromRent(exMkt.btr)):0)||280;

  // Buyer valuations — one number per buyer type (0 ⇒ route doesn't apply to this scheme → "N/A")
  var _hbGdv=exGdv>0?exGdv:(exUnits*exAvgSqft*exSalePsf);
  var _hbBuild=exBuildTot*1.08, _hbFin=_hbBuild*exFinRate, _hbProfit=_hbGdv*0.175;
  var vHousebuilder=Math.max(0,_hbGdv-_hbBuild-_hbFin-_hbProfit);
  var _btrNoi=exNoi>0?exNoi:(exUnits*exMkt.btr*12*0.72);
  var _btrVal=exDealY>0?_btrNoi/exDealY:0, _btrDevCost=exBuildTot*(1+exFinRate+0.08), _btrProfit=_btrVal*0.08;
  var vBtrFund=Math.max(0,_btrVal-_btrDevCost-_btrProfit);
  var _pbsaNoi=exNoi>0?exNoi:(exUnits*exMkt.pbsa*52*0.80);
  var _pbsaCap=_pbsaNoi/0.06, _pbsaDevCost=exBuildTot*(1+exFinRate+0.07), _pbsaMargin=_pbsaCap*0.10;
  var vPbsaFund=Math.max(0,_pbsaCap-_pbsaDevCost-_pbsaMargin);
  var _afUnits=Math.round(exUnits*exAhPct/100);
  var _omvPerUnit=exGdv>0?exGdv/exUnits:(exAvgSqft*exSalePsf);
  var vRpHa=_afUnits*_omvPerUnit*0.52;
  var _penNoi=exNoi>0?exNoi:(exUnits*exMkt.btr*12*0.75);
  var vPension=_penNoi/0.045;
  // Appetite scores — identical scoring to the Exit page
  var aHb=0; if(exUnits>=50&&exUnits<=500)aHb+=30; if(exUnits>=100&&exUnits<=300)aHb+=20; if(exAhPct<=35)aHb+=20; if(exGdv>3000000)aHb+=20; if(["manchester","birmingham","leeds","bristol","oxford","cambridge","london"].indexOf(exCityKey)>=0)aHb+=10; aHb=Math.min(aHb,95);
  var aBtr=0; if(exUnits>=150)aBtr+=35; else if(exUnits>=80)aBtr+=15; if(["manchester","london","birmingham","leeds","bristol","edinburgh","glasgow"].indexOf(exCityKey)>=0)aBtr+=25; if(exAt==="btr")aBtr+=20; if(exMkt.btr>=900)aBtr+=10; if(exAhPct<=20)aBtr+=10; aBtr=Math.min(aBtr,95);
  var aPbsa=0; if(exAt==="pbsa")aPbsa+=40; if(exMkt.pbsa>300)aPbsa+=25; if(["manchester","london","bristol","edinburgh","leeds","nottingham","sheffield","birmingham"].indexOf(exCityKey)>=0)aPbsa+=20; if(exUnits>=100)aPbsa+=15; aPbsa=Math.min(aPbsa,90);
  var aRp=0; if(exAhPct>=25)aRp+=40; else if(exAhPct>=15)aRp+=20; if(exUnits>=20)aRp+=20; if(["manchester","birmingham","london","bristol","leeds"].indexOf(exCityKey)>=0)aRp+=15; aRp+=25; aRp=Math.min(aRp,90);
  var aPen=0; if(exGdv>50000000)aPen+=30; if(exAt==="btr")aPen+=25; if(["london","manchester","birmingham"].indexOf(exCityKey)>=0)aPen+=20; if(exUnits>=200)aPen+=15; if(exNoi>2000000)aPen+=10; aPen=Math.min(aPen,80);
  var exBuyers=[
    {label:"Pension / Sovereign Wealth Fund",buyers:"Aviva, L&G Capital, LGIM, Pension SuperFund, CPP, GIC Singapore",basis:"Long income capitalised at ~4.5%",value:vPension,appetite:aPen},
    {label:"Registered Provider / Housing Association",buyers:"L&Q, Clarion, Sovereign, VIVID, Platform, Midland Heart, Places for People",basis:"Affordable transfer at ~52% of OMV, grant-backed",value:vRpHa,appetite:aRp},
    {label:"National Housebuilder",buyers:"Barratt Redrow, Persimmon, Vistry, Taylor Wimpey, Bellway",basis:"Residual — GDV less build, fees, finance, ~17.5% profit",value:vHousebuilder,appetite:aHb},
    {label:"BTR Institutional Fund",buyers:"Grainger, Legal & General, M&G, Invesco, Patrizia, Cortland",basis:"NOI capitalised at "+pct(exDealY*100)+" less dev cost & margin",value:vBtrFund,appetite:aBtr},
    {label:"PBSA / Student Fund",buyers:"Unite, Empiric, Scape, Student Roost, Harrison Street, Blackstone",basis:"Student NOI capitalised at ~6.0% less dev cost & margin",value:vPbsaFund,appetite:aPbsa}
  ].sort(function(a,b){return b.value-a.value;});
  var exApplicable=exBuyers.filter(function(b){return b.value>0;});
  var exBestBuyer=exApplicable.length?exApplicable[0]:null;
  var exBestValue=exBestBuyer?exBestBuyer.value:0;
  var exWorstValue=exApplicable.length?exApplicable[exApplicable.length-1].value:0;
  var exValueRange=exBestValue-exWorstValue;
  // Hold vs sell / refinancing
  var exSellNow=rlvV>0?rlvV:(exGdv*0.88);
  var exHoldNOI=exNoi>0?exNoi:(exUnits*exMkt.btr*12*0.72);
  var exStabilised=exDealY>0?exHoldNOI/exDealY:0;
  var exRefinance=exStabilised*0.65;
  var exAnnualIncome=exHoldNOI;
  // Logged HA/RP offers from the Exit tracker (actual offers received)
  var exRpOffers=(data.rpOffers||[]).filter(function(o){return num(o.gb)>0||num(o.tk)>0;});
  // Multi-year DCF hold (v10.29) — same core as the Exit page & Capitalisation stage.
  var exDcfP=(typeof capDCFParams==="function")?capDCFParams(data):{growth:2.75,floor:1,cap:4,years:25};
  var EX_PENSION_YIELD=0.045;   // pension DCF discounts at its own 4.5% (apples-to-apples with its static row)
  var exPensionNOI=exNoi>0?exNoi:(exUnits*exMkt.btr*12*0.75);
  var exPensionDCF=(typeof computeDCFHoldValue==="function")?computeDCFHoldValue(exPensionNOI,exDcfP.growth,exDcfP.floor,exDcfP.cap,exDcfP.years,EX_PENSION_YIELD):{value:0,effectiveGrowth:0};
  var exHoldDCF=(typeof computeDCFHoldValue==="function")?computeDCFHoldValue(exHoldNOI,exDcfP.growth,exDcfP.floor,exDcfP.cap,exDcfP.years,exDealY):{value:0,effectiveGrowth:0};

  // ── Rent & yield research inputs ────────────────────────────────────────────
  var sfhData=data.sfh||{}; var capD=data.capitalise||{};
  var avgUnitMktValue=(num(SF.retailGdv)>0&&num(SF.totalUnits)>0)?num(SF.retailGdv)/num(SF.totalUnits):0;
  var curRentPa=num(capD.marketRentPerUnitPa)||(avgUnitMktValue*(numOr(capD.grossRentYield,4.5)/100));
  var curRentMo=Math.round(curRentPa/12);
  var curGrossYield=avgUnitMktValue>0?(curRentPa/avgUnitMktValue*100):0;
  var _bedset={}; (sfhData.mix||[]).forEach(function(r){ var b=num(r.beds)||(((String(r.type||"").match(/(\d)[\s-]?bed/))||[])[1]); if(b) _bedset[b]=(_bedset[b]||0)+num(r.count||0); });
  var bedSummary=Object.keys(_bedset).sort().map(function(b){return b+"-bed";}).join(", ")||"the scheme homes";
  var _pcE=encodeURIComponent(pc||""), _ocE=encodeURIComponent((pc||"").split(" ")[0].toLowerCase()), _townE=encodeURIComponent(cityDisp||l.city||"");
  var rentLinks=[
    ["Rightmove — to let","https://www.rightmove.co.uk/property-to-rent/find.html?searchType=RENT&searchLocation="+_pcE,"#00DEB6"],
    ["Zoopla — to rent","https://www.zoopla.co.uk/to-rent/property/"+_ocE+"/?q="+_pcE,"#8046F1"],
    ["Home.co.uk rents","https://www.home.co.uk/for_rent/"+_ocE+"/current_rents","#1E5AA8"],
    ["ONS rent stats","https://www.ons.gov.uk/peoplepopulationandcommunity/housing/bulletins/privaterentandhousepricesuk/latest","#2D7A65"]
  ];

  // ── Provenance: where the site + figures came from ──────────────────────────
  var raw=(data._raw&&data._raw.placonaSite)||{};
  var scr=(data.scraper&&data.scraper.result)||{};
  var ks=data._keystone||{};
  var brief=ks.sourceBrief||{};
  var mkt=data.market||{};
  var cleanV=function(v){ return (v&&String(v)!=="Not found"&&String(v)!=="N/A")?String(v):""; };
  var srcUrl=cleanV(raw.source_url||scr.source_url||l.sourceUrl);
  var srcAgent=cleanV(raw.agent_contact||scr.agent||l.agent);
  var placonaScore=cleanV(raw.placona_score);
  var sourcedName=cleanV(raw.site_name||raw.address_or_location||brief.dealName);
  var importedVia=sourcedName?("Placona site finder"):(ks.builtAt?"Keystone deal builder":"Manual entry");
  var importedOn=ks.builtAt?(new Date(ks.builtAt)).toLocaleDateString("en-GB"):"";
  var assumptions=(ks.assumptions||[]).filter(Boolean);
  // as-imported (pre-model) figures
  var impAcres=cleanV(brief.acres||raw.site_area_acres);
  var impPrice=num(brief.askingPrice)||num(raw.asking_price&&String(raw.asking_price).replace(/[^0-9.]/g,""));
  var impUnits=cleanV(brief.units||raw.estimated_units);
  var impLpa=cleanV(brief.lpa||raw.local_planning_authority||lpa);
  var impStatus=cleanV(brief.planningStatus||raw.planning_status);

  var EXIT_LABELS={plot_sales:"Open-market plot sales",forward_fund:"Forward funding",forward_sale:"Forward sale",stabilised:"Stabilised investment sale",retain:"Retain & rent",phased:"Phased delivery"};

  // ── Site coordinates: prefer the EXACT user-placed pin (land.siteLat/Lng), else the
  //     postcode geocode (a sector centroid — near the village, not on the parcel). ──
  function geocode(){
    var sl=num(l.siteLat), sg=num(l.siteLng);
    if(sl&&sg) return Promise.resolve([sl,sg]);
    return geocodePostcodeProp(pc);
  }

  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function buildHTML(coords){
    var ahUnits=Math.round(units*ahPct/100);
    var pmUnits=units-ahUnits;
    var headroom=(rlvV>0&&ask>0)?rlvV-ask:0;
    var ccPill=ccVerdict==="GO"?'<span class="pill g">GO'+(ccScore?" · "+ccScore+"/100":"")+'</span>'
      :ccVerdict==="CAUTION"?'<span class="pill a">CAUTION'+(ccScore?" · "+ccScore+"/100":"")+'</span>'
      :ccVerdict==="AVOID"?'<span class="pill r">AVOID'+(ccScore?" · "+ccScore+"/100":"")+'</span>'
      :'<span class="pill" style="color:#7278A0;border-color:#DDE0ED">To assess</span>';
    var verdictLine = (marginV>=15?"Strong margin":marginV>=12?"Viable margin":"Marginal at full land value")+
      (ccVerdict==="AVOID"?" · high planning risk":ccVerdict==="CAUTION"?" · planning risk to manage":"");

    // Map block: real OSM embed when geocoded, else the indicative plan carries it.
    var mapBlock="";
    if(coords){
      var la=coords[0], lo=coords[1], dLa=0.007, dLo=0.011;
      var bbox=(lo-dLo)+","+(la-dLa)+","+(lo+dLo)+","+(la+dLa);
      mapBlock='<iframe title="Site location map" loading="lazy" class="osm" '+
        'src="https://www.openstreetmap.org/export/embed.html?bbox='+encodeURIComponent(bbox)+'&layer=mapnik&marker='+la+','+lo+'"></iframe>'+
        '<div class="mcap">Site location — '+esc(pc)+' · © OpenStreetMap contributors. '+
        '<a href="https://www.openstreetmap.org/?mlat='+la+'&mlon='+lo+'#map=15/'+la+'/'+lo+'" target="_blank" rel="noopener">Open full map ↗</a></div>';
    }

    var siteSub=[cityDisp,county,pc,(acres>0?acres+" acres":"")].filter(Boolean).join(" · ");

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>'+
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>'+
    '<title>Cassidy Group — Development Proposal · '+esc(addr)+'</title>'+
    '<style>'+
    '*{box-sizing:border-box}'+
    'body{margin:0;background:#EEF0F7;color:#33355C;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.6;font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
    'h1,h2,h3{font-family:Georgia,"Times New Roman",serif;color:#1B1D46;line-height:1.15;margin:0}'+
    '.page{max-width:820px;margin:22px auto;background:#fff;box-shadow:0 8px 40px rgba(26,27,82,.14)}'+
    '.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}'+
    '.eyebrow{font-size:10px;letter-spacing:.2em;text-transform:uppercase;font-weight:700}'+
    // header
    '.hd{background:linear-gradient(158deg,#1A1B52,#26286e 62%,#191a54);color:#EDEEFB;padding:26px 40px 30px;border-bottom:3px solid #C9A227}'+
    '.lh{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap}'+
    '.brand{display:flex;align-items:center;gap:13px}'+
    '.mark{width:42px;height:42px;border:2px solid #C9A227;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-weight:700;font-size:21px;color:#C9A227}'+
    '.logo-chip{background:#fff;border-radius:8px;padding:9px 13px;display:inline-flex;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.18)}.logo-chip img{height:40px;width:auto;max-width:210px;display:block}'+
    '.nm{font-family:Georgia,serif;font-size:19px;font-weight:700;letter-spacing:.22em;color:#fff;line-height:1}'+
    '.sb{font-size:8.5px;letter-spacing:.32em;color:#AEB2E4;margin-top:5px}'+
    '.dm{text-align:right;font-size:10.5px;color:#AEB2E4;line-height:1.7}.dm b{color:#EDEEFB}'+
    '.conf{display:inline-block;margin-top:5px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#C9A227;border:1px solid rgba(201,162,39,.5);padding:3px 8px;border-radius:16px}'+
    '.ttl{margin-top:22px}.ttl .eyebrow{color:#C9A227}'+
    '.ttl h1{color:#fff;font-size:32px;margin:9px 0 7px;letter-spacing:-.01em}'+
    '.ttl .loc{color:#C4C7EF;font-size:14px}.ttl .loc b{color:#fff}'+
    '.band{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14);border-radius:10px;overflow:hidden;margin-top:22px}'+
    '.band .h{background:rgba(14,15,40,.4);padding:14px 15px}'+
    '.band .n{font-family:Georgia,serif;font-size:23px;font-weight:700;color:#fff;line-height:1}.band .n .u{font-size:13px;color:#C9A227}'+
    '.band .l{font-size:9px;color:#AEB2E4;margin-top:5px;letter-spacing:.03em;text-transform:uppercase}'+
    // body
    '.bd{padding:8px 40px 34px}'+
    'section{padding:26px 0 2px}'+
    '.sh{display:flex;align-items:baseline;gap:11px;margin-bottom:10px}'+
    '.sh .i{font-family:ui-monospace,monospace;font-size:10px;color:#9A7B2E;font-weight:700}'+
    '.sh h2{font-size:18px}'+
    '.lead{color:#666C93;font-size:13px;margin:0 0 14px;max-width:64ch}'+
    '.callout{background:#F3F5FB;border:1px solid #E1E4F0;border-left:3px solid #9A7B2E;border-radius:0 9px 9px 0;padding:13px 16px;font-size:13.5px}'+
    '.sub-title{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:#9A7B2E;font-weight:800;margin-bottom:9px}'+
    '.src a{color:#2E2F8A}'+
    '.callout b{color:#1B1D46}'+
    '.g2{display:grid;grid-template-columns:1fr 1fr;gap:13px}'+
    '.card{background:#fff;border:1px solid #E1E4F0;border-radius:10px;padding:15px 17px}'+
    '.row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px dashed #E7E9F3;font-size:13.5px}'+
    '.row:last-child{border-bottom:none}.row .k{color:#666C93}.row .v{font-weight:700;color:#1B1D46;text-align:right}.row .v small{display:block;font-weight:400;color:#98A0C0;font-size:11px}'+
    'table.ap{width:100%;border-collapse:collapse;font-size:13.5px}'+
    'table.ap td{padding:8px 3px;border-bottom:1px solid #E7E9F3}'+
    'table.ap td.n{text-align:right;font-weight:700;color:#1B1D46;white-space:nowrap}'+
    'table.ap tr.sum td{border-top:2px solid #CDD2E6;border-bottom:none;font-weight:800;padding-top:11px}'+
    'table.ap .mut{color:#666C93;font-weight:400;font-size:11.5px}'+
    '.pill{display:inline-block;font-size:10px;font-weight:700;padding:3px 9px;border-radius:16px;border:1px solid transparent}'+
    '.pill.g{color:#2D7A65;background:rgba(45,122,101,.1);border-color:rgba(45,122,101,.35)}'+
    '.pill.a{color:#9A7B3E;background:rgba(154,123,62,.12);border-color:rgba(154,123,62,.35)}'+
    '.pill.r{color:#B05A35;background:rgba(176,90,53,.1);border-color:rgba(176,90,53,.35)}'+
    'ul.pts{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}'+
    'ul.pts li{position:relative;padding-left:20px;font-size:13.5px}ul.pts li::before{content:"";position:absolute;left:2px;top:7px;width:6px;height:6px;border-radius:50%;background:#9A7B2E}ul.pts li b{color:#1B1D46}'+
    '.osm{width:100%;height:300px;border:1px solid #E1E4F0;border-radius:10px;display:block}'+
    '.mcap{font-size:10.5px;color:#98A0C0;margin-top:7px;text-align:center}.mcap a{color:#2E2F8A}'+
    '.plan{width:100%;height:auto;display:block;border:1px solid #E1E4F0;border-radius:10px;margin-top:13px}'+
    '.dec{background:linear-gradient(160deg,#1A1B52,#26286e);color:#EDEEFB;border-radius:12px;padding:24px 24px 22px;margin-top:8px}'+
    '.dec .eyebrow{color:#C9A227}.dec h2{color:#fff;font-size:20px;margin:7px 0 9px}.dec p{color:#CDD0F1;font-size:13.5px;margin:0 0 14px}'+
    '.verdict{display:inline-flex;align-items:center;gap:8px;background:rgba(45,122,101,.22);border:1px solid rgba(95,191,159,.5);color:#DFF3EC;font-weight:700;font-size:12.5px;padding:7px 13px;border-radius:22px}'+
    '.ask{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:16px}'+
    '.opt{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:11px 13px}'+
    '.opt.rec{border-color:#C9A227;background:rgba(201,162,39,.12)}'+
    '.opt .t{font-weight:700;color:#fff;font-size:12.5px;margin-bottom:3px}.opt .d{font-size:11px;color:#AEB2E4;line-height:1.5}'+
    '.disc{background:#F3F5FB;border:1px solid #E1E4F0;border-radius:9px;padding:12px 15px;font-size:11px;color:#666C93;line-height:1.6;margin-top:18px}'+
    '.ft{padding:16px 40px;border-top:1px solid #E1E4F0;color:#666C93;font-size:10.5px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}'+
    // toolbar (screen only)
    '.bar{position:sticky;top:0;z-index:9;background:#1A1B52;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 18px;font-size:12.5px}'+
    '.bar b{color:#C9A227}'+
    '.btn{background:#C9A227;color:#1A1B52;border:none;border-radius:6px;padding:8px 16px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit}'+
    '.btn.ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)}'+
    '@media print{body{background:#fff}.page{margin:0;box-shadow:none;max-width:none}.bar{display:none}@page{margin:12mm}section,.card,.dec,.osm,.plan{break-inside:avoid}}'+
    '@media(max-width:620px){.band,.ask,.g2{grid-template-columns:1fr 1fr}.ask{grid-template-columns:1fr}.hd,.bd,.ft{padding-left:20px;padding-right:20px}}'+
    '</style></head><body>'+
    '<div class="bar no-print"><span>Cassidy Group · <b>Board Proposal</b> — view or print to PDF</span>'+
      '<span><button class="btn" onclick="window.print()">🖨 Print / Save as PDF</button></span></div>'+
    '<div class="page">'+
      '<div class="hd"><div class="lh">'+
        '<div class="brand"><div class="logo-chip"><img src="'+(typeof cassidyLogoSrc==="function"?cassidyLogoSrc():"")+'" alt="Cassidy Group Ltd"/></div></div>'+
        '<div class="dm">Board Paper · <b>Development Proposal</b><br/>Prepared <b>'+esc(new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}))+'</b><br/>'+
          (user&&user.name?"By <b>"+esc(user.name)+"</b><br/>":"")+'<span class="conf">Confidential — For Board</span></div>'+
      '</div>'+
      '<div class="ttl"><div class="eyebrow">'+esc(((data.assetType||"SFH")+"").toUpperCase())+' · Residential Development</div>'+
        '<h1>'+esc(addr)+'</h1><div class="loc"><b>'+esc(siteSub||"Site")+'</b>'+(lpa?' · LPA '+esc(lpa):'')+'</div>'+
        '<div class="band">'+
          '<div class="h"><div class="n">'+bandMoney(gdvV)+'</div><div class="l">Gross Dev. Value</div></div>'+
          '<div class="h"><div class="n">'+(units?units.toLocaleString():"—")+'</div><div class="l">New homes</div></div>'+
          '<div class="h"><div class="n">'+(ask>0?bandMoney(ask):"—")+'</div><div class="l">Guide price</div></div>'+
          '<div class="h"><div class="n">'+(rlvV>0?bandMoney(rlvV):"—")+'</div><div class="l">Residual land value*</div></div>'+
        '</div></div></div>'+
      '<div class="bd">'+
        // 01 opportunity
        '<section><div class="sh"><span class="i">01</span><h2>The opportunity</h2></div>'+
          '<div class="callout">A <b>~'+esc(acres||"—")+'-acre</b> residential opportunity at <b>'+esc(cityDisp||addr)+'</b>'+
          (ask>0?', guided at <b>'+fmt(ask)+'</b>':'')+'. As modelled it supports <b>~'+(units?units.toLocaleString():"—")+' homes</b>'+(sitePotential>0?' (a modelled tranche of the site\'s ~'+sitePotential.toLocaleString()+'-home capacity)':'')+' with a gross development value of <b>'+fmt(gdvV)+'</b>'+
          (rlvV>0?' and a supportable land value of <b>'+fmt(rlvV)+'</b>':'')+
          (headroom>0?' — indicative headroom of <b>'+fmt(headroom)+'</b> to the residual land value':'')+
          '. Planning position: '+esc(planStatus)+' '+ccPill+'.</div></section>'+
        // 02 site + map
        '<section><div class="sh"><span class="i">02</span><h2>Site &amp; location</h2></div>'+
          (mapBlock||'')+
          sitePlanSVG(acres,pc,cityDisp)+
          '</section>'+
        // 03 scheme
        '<section><div class="sh"><span class="i">03</span><h2>The scheme</h2></div><div class="g2">'+
          '<div class="card">'+
            rowHTML("Use","Residential — "+esc(((data.assetType||"SFH")+"").toUpperCase()))+
            rowHTML("Gross site area",(acres>0?acres+" acres":"—"),(acres>0?(acres*0.404686).toFixed(1)+" ha":""))+
            rowHTML("Density",(density>0?density+" homes/acre":"—"),(density>0?"≈"+Math.round(density*2.471)+" dph":""))+
            rowHTML("Total homes (modelled)",(units?units.toLocaleString():"—"),(sitePotential>0?"appraised basis":""))+
            (sitePotential>0?rowHTML("Site potential (brief)",sitePotential.toLocaleString()+" homes","full-site capacity — a Phase-1 tranche is modelled above"):"")+
          '</div>'+
          '<div class="card">'+
            rowHTML("Open market",(ahPct?(100-ahPct)+"%":"—"),(pmUnits>0?"~"+pmUnits.toLocaleString()+" homes":""))+
            rowHTML("Affordable (S106)",(ahPct?ahPct+"%":"—"),(ahUnits>0?"~"+ahUnits.toLocaleString()+" homes":""))+
            rowHTML("Section 106",(s106V>0?fmt(s106V):"—"),(units>0&&s106V>0?fmt(s106V/units)+"/home":""))+
            rowHTML("Exit route",esc(EXIT_LABELS[exitStrat]||exitStrat||"To confirm"))+
          '</div></div></section>'+
        // 04 appraisal
        '<section><div class="sh"><span class="i">04</span><h2>Development appraisal</h2></div>'+
          '<p class="lead">Modelled in Landform on a fully-costed residual basis; affordable housing valued at its blended realisation. Indicative, subject to due diligence.</p>'+
          '<div class="card"><table class="ap">'+
            apRow("Gross Development Value","blended, incl. affordable",fmt(gdvV))+
            apRow("Total build &amp; infrastructure","~"+(units?units.toLocaleString():"—")+" homes",buildTot>0?fmt(buildTot):"To confirm")+
            apRow("Section 106 / planning obligations","",s106V>0?fmt(s106V):"To confirm")+
            apRow("Fees, contingency &amp; finance","","included")+
            apRow("Developer profit","on GDV",isFinite(marginV)&&marginV?pct(marginV):"—")+
            apRowSum("Supportable residual land value","on consent",rlvV>0?fmt(rlvV):"—")+
            (ask>0?apRow("Guide price","current",fmt(ask)):"")+
            (headroom>0?apRowSum("Indicative headroom to residual value","",'<span style="color:#2D7A65">'+fmt(headroom)+'</span>'):"")+
          '</table></div>'+
          '<div class="card" style="margin-top:13px"><div class="sub-title">How these figures were derived</div><ul class="pts">'+
            '<li><b>Scheme size —</b> ~'+esc(acres||"—")+' acres at ~'+(density||"—")+' homes/acre ≈ <b>'+(units?units.toLocaleString():"—")+' homes</b> (density set on the Keystone stage; trimmed for net developable area, constraints and open space).</li>'+
            '<li><b>Gross Development Value —</b> the '+(units?units.toLocaleString():"")+' homes valued at their sale prices'+(ahPct?', blended across the '+(100-ahPct)+'% open-market / '+ahPct+'% affordable split — affordable valued at its realisable transfer value, not full open market':'')+' = <b>'+fmt(gdvV)+'</b>'+((units&&gdvV)?' (≈'+fmt(gdvV/units)+' per home blended)':'')+'.</li>'+
            '<li><b>Development cost —</b> build &amp; infrastructure '+(buildTot>0?fmt(buildTot):'per the cost plan')+', Section 106 '+(s106V>0?fmt(s106V):'to confirm')+', plus professional fees, contingency and development finance.</li>'+
            '<li><b>Residual land value —</b> GDV less all development costs less the target developer profit = <b>'+(rlvV>0?fmt(rlvV):'—')+'</b> — the maximum land price the scheme can support at target return, on consent.</li>'+
            '<li><b>Developer margin —</b> '+(isFinite(marginV)&&marginV?pct(marginV):'—')+' of GDV at the modelled land value.</li>'+
          '</ul></div></section>'+
        // 05 exit routes & yield sensitivity
        '<section><div class="sh"><span class="i">05</span><h2>Exit routes &amp; profit sensitivity</h2></div>'+
          '<p class="lead">Estimated developer profit by exit route'+(noi>0?', and across a yield range for an institutional sale':'')+'. Profit = realised value less total development cost ('+fmt(devCostV)+') less land at '+(ask>0?"the "+fmt(ask)+" guide price":"the modelled land value ("+fmt(rlvV)+")")+'. Assumes residential consent is achieved.</p>'+
          '<div class="card"><table class="ap">'+
            '<tr><td><b>Exit route</b></td><td class="n"><b>Realised value</b></td><td class="n"><b>Est. profit</b></td><td class="n"><b>Margin</b></td></tr>'+
            exitRow("Open-market plot sales","(build &amp; sell — primary)",gdvV)+
            (noi>0?[baseYieldPct-0.5,baseYieldPct,baseYieldPct+0.5,baseYieldPct+1.0].map(function(y){
              if(y<=0) return "";
              return exitRow("Institutional forward sale @ "+y.toFixed(1)+"%","(capitalised NOI "+fmt(noi)+"/yr)",noi/(y/100));
            }).join(""):"")+
          '</table>'+
          (noi>0?'<div style="font-size:11.5px;color:#666C93;margin-top:9px">Plot sales realise the most; an institutional forward sale trades a lower headline for earlier, de-risked cash. A tighter (lower) yield means a higher price — each 0.5% of yield moves the institutional value materially.</div>'
                :'<div style="font-size:12px;color:#666C93;margin-top:8px">Yield-based (institutional) exits appear once a rental income is modelled on the Capitalisation stage.</div>')+
          '</div></section>'+
        // 06 exit scenarios (multi-buyer, hold-vs-sell, refinancing, yields, RP offers)
        exitScenariosSection("06")+
        // 07 viability pathways — reasons & actions (how to make a marginal scheme stack)
        viabilityPathwaysSection("07")+
        // 08 planning
        '<section><div class="sh"><span class="i">08</span><h2>Planning position</h2></div><div class="g2">'+
          '<div class="card">'+
            rowHTML("Current status",esc(planStatus))+
            rowHTML("Local authority",esc(lpa||"To confirm"))+
            rowHTML("Affordable requirement",(ahPct?ahPct+"%":"To negotiate"))+
            rowHTML("Constraint check",ccPill)+
          '</div>'+
          '<div class="card"><ul class="pts">'+
            '<li><b>Route:</b> progress to pre-application and confirm the consenting strategy for this LPA.</li>'+
            '<li>Headline value <b>assumes residential consent</b>; structure acquisition to reflect planning risk.</li>'+
            '<li>NPPF 2024 policy hooks and 5-year land supply to be tested at pre-app.</li>'+
          '</ul></div></div></section>'+
        // 09 risks
        '<section><div class="sh"><span class="i">09</span><h2>Key risks</h2></div><div class="card"><ul class="pts">'+
          '<li><b>Planning.</b> '+esc(planStatus)+(ccVerdict&&ccVerdict!=="GO"?" — "+ccVerdict.toLowerCase()+" on the constraint check.":".")+' Stage spend gated on planning milestones.</li>'+
          '<li><b>Sales value.</b> Verify assumed values against local comparables; a ~5% slip materially compresses margin.</li>'+
          '<li><b>Build cost &amp; abnormals.</b> Firm up with a QS cost plan and ground investigation before commitment.</li>'+
        '</ul></div></section>'+
        // 10 sources & provenance
        '<section><div class="sh"><span class="i">10</span><h2>Sources &amp; data provenance</h2></div>'+
          '<p class="lead">Where this opportunity and its figures originated. Modelled figures are indicative and require independent verification before commitment.</p>'+
          '<div class="card src"><div class="sub-title">Where the site &amp; guide price came from</div>'+
            rowHTML("Sourced via",esc(importedVia))+
            (sourcedName?rowHTML("Listing / site",esc(sourcedName)):"")+
            (placonaScore?rowHTML("Placona opportunity score",esc(placonaScore)+" / 100"):"")+
            rowHTML("Agent / vendor",srcAgent?esc(srcAgent):"To confirm")+
            rowHTML("Guide price (as listed)",ask>0?fmt(ask):(impPrice>0?fmt(impPrice):"To confirm"))+
            rowHTML("Site area (as listed)",impAcres?(esc(impAcres)+(/acre/i.test(impAcres)?"":" acres")):(acres>0?acres+" acres":"—"))+
            (impLpa?rowHTML("Local authority (as listed)",esc(impLpa)):"")+
            rowHTML("Source listing",srcUrl?'<a href="'+esc(srcUrl)+'" target="_blank" rel="noopener">view original listing ↗</a>':"Not captured — add the listing URL on the Land stage")+
            (importedOn?rowHTML("Imported to Landform",esc(importedOn)):"")+
          '</div>'+
          '<div class="card" style="margin-top:13px"><div class="sub-title">Modelling assumptions applied by Landform</div>'+
            (assumptions.length?('<ul class="pts">'+assumptions.map(function(a){return '<li>'+esc(a)+'</li>';}).join("")+'</ul>'):'<div style="font-size:13px;color:#666C93">No specific assumptions recorded — figures entered directly.</div>')+
          '</div>'+
          (typeof basisOfFigures==="function" ? ('<div class="card" style="margin-top:13px"><div class="sub-title">Basis of figures — how each number was derived</div>'+
            basisOfFigures(data).lines.map(function(x){ return rowHTML(esc(x.k), esc(x.v)); }).join("")+
          '</div>') : '')+
          '<div class="card src" style="margin-top:13px"><div class="sub-title">External data sources</div><ul class="pts">'+
            '<li><b>Land Registry</b> — sold-price comparables: '+(num(mkt.lrPsf)?("£"+mkt.lrPsf+"/sq ft from "+(mkt.lrTotalTx||0)+" sales"+(mkt.lrSector?" in "+esc(mkt.lrSector):"")):"to run at valuation stage")+'.</li>'+
            '<li><b>Constraint assessment</b> — AI planning &amp; GIS review'+((data.constraintCheck&&data.constraintCheck.results&&data.constraintCheck.results.score)?(": "+(ccVerdict||"assessed")+" "+data.constraintCheck.results.score+"/100"+(data.constraintCheck.results.date?", "+esc(data.constraintCheck.results.date):"")):" (run in the Constraint Check stage)")+'.</li>'+
            '<li><b>planning.data.gov.uk</b> — Green Belt, Conservation Area, AONB and listed-building layers.</li>'+
            '<li><b>postcodes.io</b> — site geocoding for the location map.</li>'+
            '<li><b>Government sources</b> — Flood Map for Planning, Magic Map (Natural England), HM Land Registry, Historic England.</li>'+
          '</ul></div></section>'+
        // 08 decision
        '<section><div class="dec"><div class="eyebrow">Recommendation &amp; decision requested</div>'+
          '<h2>'+(headroom>0?"Progress to the next stage":"Review at the next stage")+'</h2>'+
          '<p>'+verdictLine+'. This paper seeks authority to progress the next stage of work (planning strategy, valuation, cost plan and securing a land position) — not to commit to acquisition today.</p>'+
          '<span class="verdict">✓ Officer recommendation: proceed to Stage 2 — planning &amp; due diligence</span>'+
          '<div class="ask">'+
            '<div class="opt rec"><div class="t">A · Proceed</div><div class="d">Authorise pre-app, valuation &amp; cost plan; secure an option / conditional position.</div></div>'+
            '<div class="opt"><div class="t">B · Hold</div><div class="d">Monitor the planning position and revisit when clearer.</div></div>'+
            '<div class="opt"><div class="t">C · Decline</div><div class="d">Do not pursue at this time.</div></div>'+
          '</div></div></section>'+
        '<div class="disc"><b>Basis of figures.</b> Indicative, modelled in Landform on the stated assumptions and subject to planning consent, due diligence, independent valuation and final terms. *Residual land value and margin assume residential consent is achieved. Confidential — prepared for Cassidy Group board members only.</div>'+
      '</div>'+
      '<div class="ft"><span>Cassidy Group · Land &amp; Development · generated in Landform</span><span>Confidential board paper · '+esc(new Date().toLocaleDateString("en-GB"))+'</span></div>'+
    '</div></body></html>';
  }

  function bandMoney(v){ v=num(v); if(v>=1e9)return "£"+(Math.round(v/1e8)/10)+"<span class='u'>bn</span>"; if(v>=1e6)return "£"+(Math.round(v/1e5)/10)+"<span class='u'>m</span>"; if(v>=1e3)return "£"+Math.round(v/1e3)+"<span class='u'>k</span>"; return "£"+Math.round(v); }
  function rowHTML(k,v,sub){ return '<div class="row"><span class="k">'+k+'</span><span class="v">'+v+(sub?'<small>'+sub+'</small>':'')+'</span></div>'; }
  function apRow(k,mut,v){ return '<tr><td>'+k+(mut?' <span class="mut">('+mut+')</span>':'')+'</td><td class="n">'+v+'</td></tr>'; }
  function apRowSum(k,mut,v){ return '<tr class="sum"><td>'+k+(mut?' <span class="mut">('+mut+')</span>':'')+'</td><td class="n">'+v+'</td></tr>'; }
  function exitRow(name,basis,value){
    var profit=value-devCostV-landBasis;
    var margin=value>0?(profit/value*100):0;
    var col=profit>=0?"#1B1D46":"#B05A35";
    return '<tr><td>'+name+' <span class="mut">'+basis+'</span></td><td class="n">'+fmt(value)+'</td><td class="n" style="color:'+col+'">'+(profit<0?"−":"")+fmt(Math.abs(profit))+'</td><td class="n">'+Math.round(margin)+'%</td></tr>';
  }
  // ── Exit Scenarios — the full buyer universe, hold-vs-sell, refinancing & yield benchmarks,
  //    mirroring the Exit Strategy page for whatever scheme/site is loaded (nothing hardcoded). ──
  function exitScenariosSection(num2){
    var apetClass=function(a){return a>=70?"g":a>=40?"a":"r";};
    var buyerRows=exBuyers.map(function(b){
      var isBest=exBestBuyer&&b.label===exBestBuyer.label&&b.value>0;
      var isPension=/Pension/.test(b.label);
      var valCell;
      if(b.value>0){
        if(isPension&&exPensionDCF.value>0){
          valCell='<b>'+fmt(b.value)+'</b><small style="display:block;font-weight:400;color:#98A0C0;font-size:10px">static year-1</small>'+
            '<span style="display:block;font-weight:800;color:#2D7A65;margin-top:3px">'+fmt(exPensionDCF.value)+'</span>'+
            '<small style="display:block;font-weight:400;color:#98A0C0;font-size:10px">'+exDcfP.years+'-yr DCF (indexed)</small>';
        } else { valCell=fmt(b.value); }
      } else { valCell='<span style="color:#98A0C0;font-weight:700">N/A</span>'; }
      return '<tr><td><b>'+esc(b.label)+'</b>'+(isBest?' <span class="pill g">Highest</span>':'')+
        '<span class="mut" style="display:block">'+esc(b.buyers)+'</span>'+
        '<span class="mut" style="display:block">'+esc(b.basis)+'</span></td>'+
        '<td class="n">'+valCell+'</td>'+
        '<td class="n"><span class="pill '+apetClass(b.appetite)+'">'+b.appetite+'%</span></td></tr>';
    }).join("");
    var rangeLine=exApplicable.length>1
      ? 'This site carries a value range of <b>'+fmt(exWorstValue)+' to '+fmt(exBestValue)+'</b> depending on buyer type — a spread of <b>'+fmt(exValueRange)+'</b> between the weakest and strongest applicable buyer. Targeting <b>'+esc(exBestBuyer.label)+'</b> as the primary purchaser could add <b>'+fmt(exValueRange)+'</b> versus the lowest applicable route.'
      : exApplicable.length===1
        ? 'Only one buyer route currently applies to this scheme — <b>'+esc(exBestBuyer.label)+'</b> at <b>'+fmt(exBestValue)+'</b>. Adjusting the mix (units, affordable %, asset type) opens additional exit routes.'
        : 'No institutional buyer route is currently applicable to the modelled scheme — confirm units, affordable % and asset type to open exit routes.';
    var rpRows=exRpOffers.length
      ? exRpOffers.map(function(o){
          var gb=num(o.gb), tk=num(o.tk), best=Math.max(gb,tk);
          return '<tr><td><b>'+esc(o.rp||"RP")+'</b>'+(o.status?' <span class="mut">('+esc(o.status)+')</span>':'')+'</td>'+
            '<td class="n">'+(num(o.units)>0?num(o.units).toLocaleString():"—")+'</td>'+
            '<td class="n">'+(gb>0?fmt(gb):"—")+'</td>'+
            '<td class="n">'+(tk>0?fmt(tk):"—")+'</td>'+
            '<td class="n">'+(best>0?fmt(best):"—")+'</td></tr>';
        }).join("")
      : "";
    return '<section><div class="sh"><span class="i">'+num2+'</span><h2>Exit scenarios</h2></div>'+
      '<p class="lead">The same consented site is worth a different amount to each type of institutional buyer. These are the live valuations, the hold-vs-sell options, refinancing headroom and the yield benchmarks the appraisal runs on — all from this deal\'s engine.</p>'+
      // 1 · multi-buyer valuation
      '<div class="card"><div class="sub-title">Multi-buyer valuation — same site, different buyers</div><table class="ap">'+
        '<tr><td><b>Buyer type</b></td><td class="n"><b>Valuation</b></td><td class="n"><b>Appetite</b></td></tr>'+
        buyerRows+
      '</table><div style="font-size:11px;color:#98A0C0;margin-top:7px">Appetite reflects fit with this scheme\'s size, location, affordable % and asset type. “N/A” means the route doesn\'t value this scheme as modelled.</div></div>'+
      // 2 · value range
      '<div class="callout" style="margin-top:13px"><b>Value range.</b> '+rangeLine+'</div>'+
      // 3 & 4 · hold vs sell + refinancing (two columns)
      '<div class="g2" style="margin-top:13px">'+
        '<div class="card"><div class="sub-title">Hold vs sell</div><table class="ap">'+
          apRow("Sell now — land only","immediate exit, no build risk",fmt(exSellNow))+
          apRow("Build &amp; sell — GDV","open-market realisation",exGdv>0?fmt(exGdv):"—")+
          apRow("Retain &amp; stabilise — static","year-1 NOI &divide; yield",exStabilised>0?fmt(exStabilised):"—")+
          apRowSum("Retain &amp; stabilise — "+exDcfP.years+"-yr DCF","CPI-indexed, term &amp; reversion",exHoldDCF.value>0?fmt(exHoldDCF.value):"—")+
        '</table></div>'+
        '<div class="card"><div class="sub-title">Refinancing potential — retain &amp; refinance</div><table class="ap">'+
          apRow("Stabilised value","",exStabilised>0?fmt(exStabilised):"—")+
          apRow("65% LTV refinance","equity released",exRefinance>0?fmt(exRefinance):"—")+
          apRowSum("Annual income (NOI)","",exAnnualIncome>0?fmt(exAnnualIncome)+" pa":"—")+
        '</table>'+
        (exRefinance>0?'<div style="font-size:11px;color:#666C93;margin-top:8px">Refinancing at 65% LTV releases '+fmt(exRefinance)+' while retaining the asset; NOI services the debt.</div>':'')+
        '</div>'+
      '</div>'+
      (exHoldDCF.value>0?'<div class="callout" style="margin-top:13px"><b>Two valuation bases for a long hold.</b> The <b>static year-1 basis</b> capitalises today\'s net rent at '+pct(exDealY*100)+'. The <b>'+exDcfP.years+'-year DCF (indexed)</b> grows the rent at a CPI-linked, collared '+pct(exHoldDCF.effectiveGrowth*100)+' pa over a '+exDcfP.years+'-year hold, capitalises year '+(exDcfP.years+1)+'\'s rent at '+pct(exDealY*100)+' for a term-and-reversion terminal value, and discounts every cash flow back at '+pct(exDealY*100)+' — the growth-adjusted value shown alongside the conservative static figure, not instead of it. The pension / sovereign row above applies the same method at that buyer\'s own tighter '+pct(EX_PENSION_YIELD*100)+' long-income yield.</div>':'')+
      // 5 · yield benchmarks
      '<div class="card" style="margin-top:13px"><div class="sub-title">Yield benchmarks — '+esc(cityDisp||cityName(exCityKey)||"local")+' market</div><table class="ap">'+
        '<tr><td><b>Net initial yield (this deal)</b> <span class="mut">'+(exDealYSourced?"your input":"area benchmark")+'</span></td><td class="n">'+pct(exDealY*100)+'</td></tr>'+
        apRow("BTR institutional (this deal)","",pct(exDealY*100))+
        apRow("PBSA / student","",'5.5–6.5%')+
        apRow("Pension / sovereign","",'4.0–5.0%')+
        apRow("Social rent (RP)","",'3.5–4.5%')+
        apRow("Market BTR rent","",'£'+fmtN(exMkt.btr)+'/month')+
        apRow("PBSA rent","",'£'+fmtN(exMkt.pbsa)+'/week')+
      '</table></div>'+
      // 6 · logged HA/RP offers
      '<div class="card" style="margin-top:13px"><div class="sub-title">Housing Association / RP offers — actual offers received</div>'+
        (exRpOffers.length
          ? '<table class="ap"><tr><td><b>Registered Provider</b></td><td class="n"><b>Units</b></td><td class="n"><b>Golden Brick</b></td><td class="n"><b>Turnkey</b></td><td class="n"><b>Best offer</b></td></tr>'+rpRows+'</table>'+
            '<div style="font-size:11px;color:#666C93;margin-top:8px">Logged on the Exit Strategy stage — these are <b>actual offers received</b>, distinct from the modelled buyer-type valuations above. Golden Brick = land &amp; infrastructure ready; Turnkey = completed units handed over.</div>'
          : '<div style="font-size:13px;color:#666C93">No RP offers logged yet. Record actual Golden Brick / Turnkey offers on the Exit Strategy stage and they appear here as real offers received, alongside the modelled valuations above.</div>')+
      '</div></section>';
  }
  // ── Viability pathways — Reasons & Actions ─────────────────────────────────
  // For a scheme that is marginal or doesn't stack at realistic costs, this section shows the
  // board the realistic levers to make it work — each quantified from THIS deal's engine by
  // re-running calcDealMetrics on a mutated copy of the deal (nothing hardcoded), plus the
  // structural levers (JV / promotion-only) that change who bears capital and risk. It adapts:
  // when the deal already stacks it reads as value-enhancement rather than rescue.
  function viabilityPathwaysSection(num2){
    function cloneDeal(){ try{ return JSON.parse(JSON.stringify(data)); }catch(e){ return null; } }
    // Re-appraise the deal under a mutation; returns the new RLV/GDV/margin from the ONE engine.
    function under(mutate){
      var d=cloneDeal(); if(!d) return null;
      try{ mutate(d); }catch(e){ return null; }
      var m=(typeof calcDealMetrics==="function")?calcDealMetrics(d):{};
      return { rlv:num(m.rlv), gdv:num(m.gdv), margin:isFinite(m.marginPct)?num(m.marginPct):0 };
    }
    var baseRlv=rlvV, baseGdv=gdvV, baseMargin=marginV;
    var modelledUnits=num(SF.totalUnits)||units||0;
    var effBuildPsf=num(SF.buildPsf)||(data.sfh&&num(data.sfh.buildPsf))||exMkt.build||195;
    var stacks=baseRlv>0 && baseMargin>=15;
    // Gap to viability: distance from break-even (RLV≥0) and from covering the asking price.
    var gapToZero=baseRlv<0?Math.abs(baseRlv):0;
    var gapToAsk=ask>0?(ask-baseRlv):0;   // positive ⇒ residual falls short of the guide price

    // ---- Residual-improving levers (each re-appraised on the live engine) ----
    var MOD_PCT=0.10;          // MMC / timber-frame indicative build saving (8–12%)
    var lvBuild=under(function(d){
      var s=d.sfh||(d.sfh={});
      var bp=num(s.buildPsf)||effBuildPsf;
      s.buildPsf=String(Math.round(bp*(1-MOD_PCT)));
      if(Array.isArray(s.mix)) s.mix=s.mix.map(function(r){ r=Object.assign({},r); if(num(r.buildPsf)>0) r.buildPsf=String(Math.round(num(r.buildPsf)*(1-MOD_PCT))); return r; });
    });
    var AH_CUT=10;             // percentage-point reduction via viability negotiation
    var ahTarget=Math.max(0,ahPct-AH_CUT);
    var lvAh=ahPct>0?under(function(d){
      var s=d.sfh||(d.sfh={}); s.ahPct=String(ahTarget);
      var p2=d.planning||(d.planning={}); p2.ahPct=String(ahTarget); p2.afhPct=String(ahTarget);
      if(d.tenure) d.tenure.ahPct=String(ahTarget);
    }):null;
    var GRANT_PU=50000;        // indicative AHP grant per affordable home (£28k–£80k range)
    var ahUnits=Math.round(modelledUnits*ahPct/100);
    var grantUplift=ahUnits>0?ahUnits*GRANT_PU:0;
    var DENS_UP=0.15;          // +15% net developable / density test
    var lvDens=under(function(d){
      var s=d.sfh||(d.sfh={});
      if(Array.isArray(s.mix)) s.mix=s.mix.map(function(r){ r=Object.assign({},r); if(num(r.count)>0) r.count=String(Math.round(num(r.count)*(1+DENS_UP))); return r; });
    });
    var FIN_CUT=0.30;          // phased delivery / deferred-land: ~30% less finance drawn
    var lvPhase=under(function(d){ var s=d.sfh||(d.sfh={}); s.finRate=String((num(s.finRate)||7.5)*(1-FIN_CUT)); });

    function delta(res){ return res? (res.rlv-baseRlv) : null; }
    // Combined realistic pathway: modular build + AH negotiation + phased finance, then AHP grant on top.
    var lvCombo=under(function(d){
      var s=d.sfh||(d.sfh={});
      var bp=num(s.buildPsf)||effBuildPsf; s.buildPsf=String(Math.round(bp*(1-MOD_PCT)));
      if(Array.isArray(s.mix)) s.mix=s.mix.map(function(r){ r=Object.assign({},r); if(num(r.buildPsf)>0) r.buildPsf=String(Math.round(num(r.buildPsf)*(1-MOD_PCT))); return r; });
      if(ahPct>0){ s.ahPct=String(ahTarget); var p2=d.planning||(d.planning={}); p2.ahPct=String(ahTarget); p2.afhPct=String(ahTarget); if(d.tenure) d.tenure.ahPct=String(ahTarget); }
      s.finRate=String((num(s.finRate)||7.5)*(1-FIN_CUT));
    });
    var comboRlv=lvCombo?(lvCombo.rlv+grantUplift):null;
    var comboClears=comboRlv!=null && comboRlv>0;
    var comboCoversAsk=comboRlv!=null && ask>0 && comboRlv>=ask;

    // Lever rows — only those we could compute, each with £ impact and the action to take.
    function lvRow(name,detail,res,extra){
      var d=extra!=null?extra:delta(res);
      if(d==null) return "";
      var col=d>=0?"#1B7A54":"#B05A35";
      return '<tr><td><b>'+name+'</b><span class="mut" style="display:block">'+detail+'</span></td>'+
        '<td class="n" style="color:'+col+';font-weight:800">'+(d>=0?"+":"−")+fmt(Math.abs(d))+'</td></tr>';
    }
    var leverRows=
      lvRow("Modular / timber-frame build","MMC delivery at ~"+Math.round(MOD_PCT*100)+"% lower build £/sqft (£"+Math.round(effBuildPsf)+"→£"+Math.round(effBuildPsf*(1-MOD_PCT))+"). Action: tender a design-for-manufacture package; test against a QS cost plan.",lvBuild)+
      (lvAh?lvRow("Affordable % negotiation","Viability-led reduction from "+ahPct+"% to "+ahTarget+"% affordable (NPPF viability, independent FVA). Action: commission a viability assessment; open pre-app with "+esc(lpa||"the LPA")+".",lvAh):"")+
      (grantUplift>0?lvRow("Homes England AHP grant","~£"+fmtN(GRANT_PU)+"/home across "+ahUnits.toLocaleString()+" affordable homes (£28–80k range). Action: partner an RP to bid via the Investment Management System; make the land deal conditional on grant.",null,grantUplift):"")+
      lvRow("Density / net-developable uplift","+"+Math.round(DENS_UP*100)+"% plots on the developable area (spreads fixed infrastructure). Action: masterplan test at pre-app — only accretive where the per-plot residual is positive.",lvDens)+
      lvRow("Phased delivery + deferred land","Promotion-agreement structure: land paid from serviced-parcel receipts, ~"+Math.round(FIN_CUT*100)+"% less finance drawn. Action: structure an option / promotion agreement with staged draw-downs.",lvPhase);

    var posLine = stacks
      ? 'At the modelled inputs this scheme <b>stacks</b> — residual land value <b>'+fmt(baseRlv)+'</b> at a <b>'+pct(baseMargin)+'</b> margin. The levers below are value-enhancement, not rescue.'
      : (baseRlv<0
          ? 'At realistic build costs the scheme <b>does not stack as modelled</b> — residual land value is <b style="color:#B05A35">−'+fmt(Math.abs(baseRlv))+'</b> ('+pct(baseMargin)+' margin), a shortfall of <b>'+fmt(gapToZero)+'</b> to break-even'+(ask>0?' and <b>'+fmt(gapToAsk)+'</b> to the '+fmt(ask)+' guide price':'')+'. It is a genuine strategic land play with no consent and a multi-year horizon, so the board question is not “does it stack today” but “what realistic combination of levers makes it stack” — set out below, each quantified on this deal\'s own engine.'
          : 'The scheme is <b>marginal</b> — residual land value <b>'+fmt(baseRlv)+'</b> at only <b>'+pct(baseMargin)+'</b> margin (below the 15% threshold). The levers below show what moves it into a comfortable position.');

    var comboLine = comboRlv==null ? '' :
      '<div class="callout" style="margin-top:13px;border-color:'+(comboClears?"#1B7A54":"#B05A35")+'"><b>Combined pathway.</b> Modular build (−'+Math.round(MOD_PCT*100)+'%)'+(ahPct>0?', affordable at '+ahTarget+'%':'')+', phased finance'+(grantUplift>0?' and ~£'+fmtN(GRANT_PU)+'/home AHP grant':'')+' together move the residual to <b style="color:'+(comboClears?"#1B7A54":"#B05A35")+'">'+(comboRlv<0?"−":"")+fmt(Math.abs(comboRlv))+'</b>'+
      (comboClears
        ? ' — which <b>clears break-even</b>'+(comboCoversAsk?' and covers the '+fmt(ask)+' guide price':(ask>0?', though still <b>'+fmt(ask-comboRlv)+'</b> short of the '+fmt(ask)+' guide (close the balance on land price or a deeper grant / MMC saving)':''))+'. On that basis the scheme is promotable.'
        : ' — still short of break-even by <b>'+fmt(Math.abs(comboRlv))+'</b>. The residual levers alone don\'t close the gap, so the deal only works as a low-capital promotion/JV (below), a lower land entry price, or a materially higher sales assumption evidenced at valuation.')+
      '</div>';

    // Structural / capital levers — change who bears risk and capital, not the residual itself.
    var structRows=[
      ['JV / promotion-fee-only structure','Cassidy promotes the site to consent for a ~15–20% share of realised land value rather than funding build and sales — decoupling the return from development margin and capping capital at risk over the 4–6 year horizon. The primary structure for a no-consent strategic site.'],
      ['Partial BTR / PRS bulk sale','Forward-sell a tranche (e.g. 25–35%) to a BTR/PRS operator at a modest discount to retail in exchange for absorption certainty across a large scheme — de-risks the sales rate and improves financeability, partly offsetting the value give-up.'],
      ['Grant-conditional land deal','Make heads of terms conditional on AHP grant and pre-app outcome, so Cassidy only commits once the affordable subsidy and planning trajectory are confirmed — the exposure-control wrapper around the levers above.']
    ].map(function(r){ return '<li><b>'+r[0]+'.</b> '+r[1]+'</li>'; }).join("");

    return '<section><div class="sh"><span class="i">'+num2+'</span><h2>Viability pathways — reasons &amp; actions</h2></div>'+
      '<p class="lead">'+posLine+'</p>'+
      '<div class="g2" style="margin-top:6px">'+
        '<div class="card"><div class="sub-title">Levers that improve the residual — impact on RLV</div><table class="ap">'+
          '<tr><td><b>Lever &amp; action</b></td><td class="n"><b>Δ Residual land value</b></td></tr>'+
          leverRows+
        '</table><div style="font-size:11px;color:#98A0C0;margin-top:7px">Each figure re-appraises the whole deal on Landform\'s engine with only that lever changed — indicative, to be firmed up with a QS cost plan, an independent viability assessment and RP/grant evidence. Levers are not simply additive; the combined pathway is modelled jointly.</div></div>'+
        '<div class="card"><div class="sub-title">Structural &amp; capital levers — reduce Cassidy\'s exposure</div><ul class="pts">'+structRows+'</ul>'+
        '<div style="font-size:11px;color:#666C93;margin-top:8px">These don\'t change the residual — they change who funds the build and carries the risk. For a negative residual, lift it positive with the levers on the left <b>first</b>, then use these to capture the value with limited capital.</div></div>'+
      '</div>'+
      comboLine+
      '<div class="callout" style="margin-top:13px"><b>Recommended sequence.</b> (1) Commission a QS cost plan and an independent viability assessment to firm up build and affordable %. (2) Open pre-app with '+esc(lpa||"the LPA")+' on density and affordable. (3) Partner an RP and scope the AHP grant. (4) Secure the land on a promotion / option agreement with deferred, consent-conditional payment — not an outright purchase — so Cassidy\'s capital tracks the planning risk over the multi-year planning horizon.</div>'+
      '</section>';
  }
  function sitePlanSVG(ac,pcode,town){
    return '<svg class="plan" viewBox="0 0 820 300" role="img" aria-label="Indicative site plan">'+
      '<defs><pattern id="hx" width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">'+
      '<rect width="9" height="9" fill="rgba(46,47,138,0.06)"/><line x1="0" y1="0" x2="0" y2="9" stroke="rgba(46,47,138,0.26)" stroke-width="1.3"/></pattern></defs>'+
      '<rect width="820" height="300" fill="rgba(46,47,138,0.02)"/>'+
      '<path d="M0,210 C200,190 320,180 820,90" stroke="#C3C9E6" stroke-width="8" fill="none"/>'+
      '<polygon points="330,120 470,105 520,175 480,240 360,246 300,180" fill="url(#hx)" stroke="#2E2F8A" stroke-width="2.4" stroke-linejoin="round"/>'+
      '<rect x="332" y="55" width="156" height="42" rx="8" fill="#2E2F8A"/>'+
      '<text x="410" y="74" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">PROPOSED SITE</text>'+
      '<text x="410" y="90" text-anchor="middle" font-size="10.5" fill="#C9A227" font-family="ui-monospace,monospace">'+esc((ac?"~"+ac+" acres":"")+(pcode?"  ·  "+pcode:""))+'</text>'+
      '<line x1="410" y1="97" x2="410" y2="150" stroke="#2E2F8A" stroke-width="1.4" stroke-dasharray="4 4"/>'+
      (town?'<text x="300" y="270" font-size="12" fill="#666C93" font-family="system-ui,sans-serif">'+esc(town)+' — indicative extent</text>':'')+
      '<g transform="translate(770,50)"><circle r="17" fill="#fff" stroke="#CDD2E6"/><path d="M0,-12 L5,5 L0,1 L-5,5 Z" fill="#2E2F8A"/><text y="-21" text-anchor="middle" font-size="10" font-weight="700" fill="#666C93" font-family="system-ui">N</text></g>'+
      '</svg>'+
      '<div class="mcap">Indicative site extent — not to scale.</div>';
  }

  function openDoc(coords){
    var html=buildHTML(coords);
    // v10.52 — show IN-APP (overlay) so you stay in Landform and can close/regenerate; a new tab
    // strands you on mobile. Falls back to a new tab if the overlay can't be created.
    if(typeof showReportOverlay==="function" && showReportOverlay(html, "Board Proposal")) return;
    var w=window.open("","_blank");
    if(!w){ if(typeof notify==="function") notify("Allow pop-ups to open the board proposal."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }
  function generate(){
    if(typeof notify==="function") notify("Generating board proposal…");
    geocode().then(openDoc).catch(function(){ openDoc(null); });
  }

  // v10.35 — Land ACQUISITION costs on a guide/offer price, so the appraisal evaluates the
  // true cost of buying the site, not just the headline price. SDLT uses the England
  // NON-RESIDENTIAL / bare-land bands (0% ≤£150k, 2% £150k–£250k, 5% >£250k); legals and
  // acquisition/agent are taken at a combined ~1.5%. These sit ON TOP of the price — the
  // residual land value (RLV) is the max supportable PRICE at target profit, and the point of
  // this is to test a real guide price, plus its purchase costs, against that RLV.
  function landSDLT(p){ p=num(p); if(p<=150000) return 0; var t=Math.min(p-150000,100000)*0.02; if(p>250000) t+=(p-250000)*0.05; return t; }
  function landAcqCosts(price){ price=num(price); if(price<=0) return {sdlt:0,other:0,total:0}; var sdlt=landSDLT(price), other=price*0.015; return {sdlt:sdlt,other:other,total:sdlt+other}; }

  // ── ONE-PAGE A4 LAND APPRAISAL ─────────────────────────────────────────────
  // A single side of A4 — the quick "is this worth pursuing?" briefing for a piece of land:
  // size → homes (SFH mix) → GDV → the full cost stack (build, fees, finance, S106, roads,
  // infra, profit) → residual land value, then tested against what the landowner is asking.
  // Every figure comes straight from computeSFHMetrics, so it reconciles exactly with the
  // full appraisal and the board paper — a compact sketch, but an accurate one.
  function buildOnePagerHTML(){ return buildLandOnePager(data, city); }
  function openOnePager(){
    if(typeof notify==="function") notify("Generating one-page land appraisal…");
    var html=buildOnePagerHTML();
    if(typeof showReportOverlay==="function" && showReportOverlay(html, "One-page land appraisal")) return;
    var w=window.open("","_blank");
    if(!w){ if(typeof notify==="function") notify("Allow pop-ups to open the one-page appraisal."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  // ── On-screen panel ─────────────────────────────────────────────────────────
  return e("div",null,
    e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:12}},
      e("div",null,
        e("div",{style:{fontSize:11,color:"#7278A0",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:4}},"Report · Board Proposal"),
        e("h2",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",margin:"0 0 4px"}},"Board Proposal"),
        e("p",{style:{fontSize:12,color:"#7278A0",lineHeight:1.7,maxWidth:620}},"A Cassidy-branded board paper built from this deal — headline figures, scheme, appraisal, planning, a site map and a clear recommendation. Opens as a web page you can read on screen and Print / Save as PDF to send to management.")
      ),
      e("div",{style:{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"flex-end"}},
        e("button",{onClick:openOnePager,disabled:!ready,
          title:"A single side of A4 — size, homes, GDV, the full cost stack and residual land value tested against the asking price. The quick ‘is this worth pursuing?’ briefing.",
          style:{padding:"11px 20px",background:(!ready)?"#EDEEF6":"#fff",border:"1.5px solid "+((!ready)?"#D7D9E8":"#2E2F8A"),borderRadius:8,color:(!ready)?"#A9ACC6":"#2E2F8A",fontSize:13,fontWeight:800,cursor:(!ready)?"not-allowed":"pointer",fontFamily:"DM Sans,sans-serif",whiteSpace:"nowrap"}},
          "📄 One-page appraisal (A4)"),
        e("button",{onClick:generate,disabled:!ready,
          style:{padding:"11px 22px",background:(!ready)?"#B7BAD8":"linear-gradient(135deg,#1E1F5C,#2E2F8A)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:800,cursor:(!ready)?"not-allowed":"pointer",fontFamily:"DM Sans,sans-serif",boxShadow:"0 3px 12px rgba(30,31,92,.28)",whiteSpace:"nowrap"}},
          "📋 Generate Board Proposal")
      )
    ),
    !ready&&e("div",{style:{padding:"14px 16px",background:"rgba(154,123,62,0.08)",border:"1px solid rgba(154,123,62,0.3)",borderRadius:8,fontSize:12,color:"#7A5A2E",marginBottom:16}},
      "Complete the core appraisal first (Land, scheme sizing and Financial Modelling) so the proposal has a GDV and unit count to present. Current: GDV "+fmt(gdvV)+", "+(units||0)+" homes."),
    // Exact-location picker — sets land.siteLat/Lng so the proposal map pins the real parcel
    e(SiteLocationPicker,{data:data,up:up,pc:pc}),

    // ── Land guide price & purchase costs — evaluate the cost of buying vs the RLV ─
    (function(){
      var _ask=num(l.price)||0;
      var _rlv=num(SF.rlv), _gdv=num(SF.gdv), _prof=num(SF.profit);
      var _acq=landAcqCosts(_ask);
      var _total=_ask+_acq.total;
      var _profAllIn=_ask>0?(_rlv+_prof-_total):_prof;
      var _marginAllIn=_gdv>0?(_profAllIn/_gdv*100):0;
      var _headroom=_rlv-_total;
      function tile(l2,v,c,s){ return e("div",{key:l2,style:{minWidth:120}},
        e("div",{style:{fontSize:9,color:"#8A90B4",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700}},l2),
        e("div",{style:{fontSize:16,fontWeight:800,color:c,fontFamily:"Georgia,serif"}},v),
        s?e("div",{style:{fontSize:9,color:"#9298BC"}},s):null); }
      return e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #9A7B3E"})},
        e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"💷 Land guide price & purchase costs"),
        e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6,marginBottom:10}},
          "What the landowner is asking (or your target offer). The one-page appraisal and board paper test it against the residual land value and add the true purchase costs — SDLT (non-residential land bands), legals and acquisition (~1.5%). Writes to the same field as the Land stage."),
        e("div",{style:{display:"flex",gap:18,flexWrap:"wrap",alignItems:"flex-end"}},
          e("div",{style:{flex:"0 0 auto",minWidth:200}},
            e(Inp,{label:"Guide / offer price (£)",type:"number",value:l.price||"",onChange:function(v){up("land","price",v);},placeholder:"e.g. 25000000"})),
          (SF.totalUnits>0)
            ? e("div",{style:{flex:1,minWidth:260,display:"flex",gap:16,flexWrap:"wrap"}},
                tile("Residual land value",_rlv?fmt(_rlv):"—",_rlv>0?"#2D7A65":"#B05A35"),
                _ask>0&&tile("All-in land cost",fmt(_total),"#4A4BAE","+"+fmt(_acq.total)+" costs"),
                _ask>0&&tile("Headroom vs RLV",(_headroom<0?"−":"+")+fmt(Math.abs(_headroom)),_headroom>=0?"#2D7A65":"#B05A35"),
                _ask>0&&tile("Margin after land",pct(_marginAllIn),_marginAllIn>=15?"#2D7A65":_marginAllIn>=12?"#9A7B3E":"#B05A35")
              )
            : e("div",{style:{fontSize:11,color:"#9A7B3E",alignSelf:"center"}},"Build the SFH House Mix to see the residual land value and headroom here.")
        ),
        // v10.52 — no guide price entered → show indicative MARKET land values by land type,
        // so there's a reference for what the land would typically cost in this area.
        (_ask<=0 && typeof landValueGuide==="function") && (function(){
          var g=landValueGuide(data), a=g.acres;
          return e("div",{style:{marginTop:12,paddingTop:12,borderTop:"1px dashed #E0D6BE"}},
            e("div",{style:{fontSize:11,fontWeight:800,color:"#7A5A2E",marginBottom:3}},"📍 No guide price yet — indicative market land values"+(cityDisp?" for "+cityDisp:"")),
            e("div",{style:{fontSize:10.5,color:"#9298BC",lineHeight:1.5,marginBottom:8}},"What land of each type typically changes hands for locally, by planning status"+(a>0?" (× "+a+" acres)":"")+". Broad market context to frame an offer — the residual land value is the figure to trust for what to actually pay."),
            e("div",{style:{display:"grid",gap:2}}, g.bands.map(function(b){
              return e("div",{key:b.key,style:{display:"flex",justifyContent:"space-between",gap:10,fontSize:11,padding:"4px 0",borderBottom:"1px solid #F4F1E8"}},
                e("span",{style:{color:"#3A3D6A",flex:1}},b.label),
                e("span",{style:{color:"#2E2F8A",fontWeight:700,whiteSpace:"nowrap",textAlign:"right"}},
                  "£"+fmtN(Math.round(b.lo))+"–"+fmtN(Math.round(b.hi))+"/ac"+(a>0?" · "+fmt(b.lo*a)+"–"+fmt(b.hi*a):"")));
            })),
            e("div",{style:{fontSize:9.5,color:"#9298BC",marginTop:6,fontStyle:"italic",lineHeight:1.5}},"Brownfield / previously-developed land is usually valued on the consented-residential basis less demolition & remediation. Indicative only — verify against local land comparables and agents.")
          );
        })()
      );
    })(),

    // ── Rent & yield research — ground the exit yield in real area rents ─────────
    e("div",{style:Object.assign({},S.card,{borderLeft:"4px solid #2D7A65"})},
      e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"🔎 Rent & yield basis — research the area"),
      e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6,marginBottom:10}},
        "The institutional-sale value uses a yield built from area rents. Ground it in real "+(cityDisp||"local")+" rents: open the live ‘to let’ searches below to check achieved rents for ",e("b",null,bedSummary)," homes, run the AI estimate, then enter a verified figure. Portals can’t be auto-scraped — the links open their real listings for you to confirm before anything is applied."),
      e("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}},
        pc?rentLinks.map(function(lk){
          return e("a",{key:lk[0],href:lk[1],target:"_blank",rel:"noopener",style:{padding:"7px 13px",background:"#fff",border:"1px solid "+lk[2],borderRadius:6,fontSize:11,fontWeight:700,color:lk[2],textDecoration:"none"}},lk[0]+" ↗");
        }):e("div",{style:{fontSize:11,color:"#9A7B3E"}},"Add a postcode on the Land stage to enable the live rent searches.")
      ),
      e(AIPanel,{user:user,up:up,stage:"proposal",data:data,persistKey:"proposal_rent_research",label:"🤖 AI: estimate area rents & gross yield",
        system:"You are a UK lettings and residential valuation analyst. Be specific, numerate and reflect typical local rent levels. Use light Markdown (a compact table + bold). Always caveat that the figures are indicative and must be verified against live listings.",
        prompt:"Estimate the CURRENT private rental market for NEW-BUILD homes in "+(cityDisp||l.city||"the area")+" ("+(pc||"postcode TBC")+"). Housing types: "+bedSummary+". For EACH bed size give a realistic monthly rent RANGE (low–high) and a MEDIAN based on typical asking/achieved rents for that area and property type; cross-check against ONS private-rent statistics for the local authority. Then compute the implied GROSS YIELD = (annual median rent ÷ new-build sale value) × 100 using an average new-build value of "+(avgUnitMktValue>0?fmt(avgUnitMktValue):"the scheme's average home value")+". Present a compact table: Bed size | Monthly range | Median | Gross yield. End with one overall gross yield for the scheme and a one-line note that these are indicative and must be verified against live Rightmove/Zoopla ‘to let’ listings and ONS statistics before use."}),
      e("div",{style:{display:"flex",alignItems:"flex-end",gap:16,flexWrap:"wrap",marginTop:12,paddingTop:12,borderTop:"1px solid #EEF0F7"}},
        e("div",{style:{flex:"0 0 auto",minWidth:180}},
          e(Inp,{label:"Verified avg rent per home (£/month)",type:"number",value:curRentMo||"",onChange:function(v){ up("capitalise","marketRentPerUnitPa", num(v)>0?Math.round(num(v)*12):""); },placeholder:String(curRentMo||"2000")})
        ),
        e("div",{style:{flex:"0 0 auto",minWidth:150}},
          e(Inp,{label:"Exit (capitalisation) yield %",type:"number",step:"0.05",value:capD.targetYield||"",onChange:function(v){ up("capitalise","targetYield", v); },placeholder:String((baseYieldPct||4.9).toFixed(2))})
        ),
        e("div",{style:{fontSize:11,color:"#3A3D6A",lineHeight:1.6}},
          e("div",null,"Gross yield = annual rent ÷ avg home value = ",e("b",{style:{color:"#2D7A65"}},curGrossYield?curGrossYield.toFixed(2)+"%":"—")),
          e("div",{style:{color:"#7278A0",fontSize:10,marginTop:2}},"Both feed the Capitalisation stage → the exit table below and the generated proposal update automatically.")
        )
      )
    ),
    // live preview of what will be generated
    e("div",{style:Object.assign({},S.card,{background:"linear-gradient(160deg,#1E1F5C,#26286e)",color:"#EDEEFB",border:"none"})},
      e("div",{style:{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",color:"#C9A227",fontWeight:700,marginBottom:10}},"Preview — headline figures"),
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:1,background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.14)",borderRadius:8,overflow:"hidden"}},
        [["Gross Dev. Value",gdvV>0?fmt(gdvV):"—"],["New homes",units?units.toLocaleString():"—"],["Guide price",ask>0?fmt(ask):"—"],["Residual land value",rlvV>0?fmt(rlvV):"—"],["Dev margin",isFinite(marginV)&&marginV?pct(marginV):"—"],["Planning",planStatus]].map(function(it){
          return e("div",{key:it[0],style:{background:"rgba(14,15,40,0.4)",padding:"12px 14px"}},
            e("div",{style:{fontSize:18,fontWeight:800,color:"#fff",fontFamily:"Georgia,serif"}},it[1]),
            e("div",{style:{fontSize:9,color:"#AEB2E4",marginTop:4,textTransform:"uppercase",letterSpacing:".04em"}},it[0]));
        })
      ),
      e("div",{style:{fontSize:11,color:"#AEB2E4",marginTop:12,lineHeight:1.6}},
        "The generated paper adds the scheme mix, a fully-costed appraisal table, planning position, the site map ("+((num(l.siteLat)&&num(l.siteLng))?"pinned to your exact location":pc?"from "+pc+" — drop the pin above for an exact spot":"add a postcode / drop the pin above")+"), risks and a Proceed / Hold / Decline decision box.")
    ),
    e("div",{style:{fontSize:11,color:"#7278A0",marginTop:12,fontStyle:"italic",lineHeight:1.6}},
      "Tip: in the opened page, use Print → “Save as PDF” to produce the file, or send the printed PDF to the board. All figures come live from this deal's engine — regenerate any time as the appraisal changes.")
  );
}
