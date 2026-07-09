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
function renderProposal(city, data, gdv, lc, up, user){
  var l=data.land||{}; var p=data.planning||{}; var ten=data.tenure||{}; var ex=data.exit||{};
  var M=(typeof calcDealMetrics==="function")?calcDealMetrics(data):{};
  var SF=(typeof computeSFHMetrics==="function")?computeSFHMetrics(data):{};

  var addr=l.address||(data.scraper&&data.scraper.result&&data.scraper.result.address)||"Development Site";
  var pc=(l.postcode||(data.rlv&&data.rlv.postcode)||"").toUpperCase().trim();
  var cityDisp=cityName(city||l.city||"")||"";
  var county=l.county||"";
  var acres=num(l.acres||0);
  var units=num(M.units||p.units||SF.totalUnits||(data.rlv&&data.rlv.units)||0);
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
    '.logo-chip{background:#fff;border-radius:8px;padding:9px 13px;display:inline-flex;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.18)}.logo-chip img{height:38px;width:auto;max-width:200px;display:block}'+
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
        '<div class="brand"><div class="logo-chip"><img src="data:image/png;base64,'+(typeof BRAND_LOGO_PNG!=="undefined"?BRAND_LOGO_PNG:"")+'" alt="Cassidy Group Ltd"/></div></div>'+
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
          (ask>0?', guided at <b>'+fmt(ask)+'</b>':'')+'. As modelled it supports <b>~'+(units?units.toLocaleString():"—")+' homes</b> with a gross development value of <b>'+fmt(gdvV)+'</b>'+
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
            rowHTML("Total homes",(units?units.toLocaleString():"—"))+
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
          '</table></div></section>'+
        // 05 planning
        '<section><div class="sh"><span class="i">05</span><h2>Planning position</h2></div><div class="g2">'+
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
        // 06 risks
        '<section><div class="sh"><span class="i">06</span><h2>Key risks</h2></div><div class="card"><ul class="pts">'+
          '<li><b>Planning.</b> '+esc(planStatus)+(ccVerdict&&ccVerdict!=="GO"?" — "+ccVerdict.toLowerCase()+" on the constraint check.":".")+' Stage spend gated on planning milestones.</li>'+
          '<li><b>Sales value.</b> Verify assumed values against local comparables; a ~5% slip materially compresses margin.</li>'+
          '<li><b>Build cost &amp; abnormals.</b> Firm up with a QS cost plan and ground investigation before commitment.</li>'+
        '</ul></div></section>'+
        // 07 decision
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
    var w=window.open("","_blank");
    if(!w){ if(typeof notify==="function") notify("Allow pop-ups to open the board proposal."); return; }
    w.document.open(); w.document.write(buildHTML(coords)); w.document.close();
  }
  function generate(){
    if(typeof notify==="function") notify("Generating board proposal…");
    geocode().then(openDoc).catch(function(){ openDoc(null); });
  }

  // ── On-screen panel ─────────────────────────────────────────────────────────
  return e("div",null,
    e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:12}},
      e("div",null,
        e("div",{style:{fontSize:11,color:"#7278A0",textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:4}},"Report · Board Proposal"),
        e("h2",{style:{fontSize:22,fontWeight:800,color:"#2E2F8A",margin:"0 0 4px"}},"Board Proposal"),
        e("p",{style:{fontSize:12,color:"#7278A0",lineHeight:1.7,maxWidth:620}},"A Cassidy-branded board paper built from this deal — headline figures, scheme, appraisal, planning, a site map and a clear recommendation. Opens as a web page you can read on screen and Print / Save as PDF to send to management.")
      ),
      e("button",{onClick:generate,disabled:!ready,
        style:{padding:"11px 22px",background:(!ready)?"#B7BAD8":"linear-gradient(135deg,#1E1F5C,#2E2F8A)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:800,cursor:(!ready)?"not-allowed":"pointer",fontFamily:"DM Sans,sans-serif",boxShadow:"0 3px 12px rgba(30,31,92,.28)",whiteSpace:"nowrap"}},
        "📋 Generate Board Proposal")
    ),
    !ready&&e("div",{style:{padding:"14px 16px",background:"rgba(154,123,62,0.08)",border:"1px solid rgba(154,123,62,0.3)",borderRadius:8,fontSize:12,color:"#7A5A2E",marginBottom:16}},
      "Complete the core appraisal first (Land, scheme sizing and Financial Modelling) so the proposal has a GDV and unit count to present. Current: GDV "+fmt(gdvV)+", "+(units||0)+" homes."),
    // Exact-location picker — sets land.siteLat/Lng so the proposal map pins the real parcel
    e(SiteLocationPicker,{data:data,up:up,pc:pc}),
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
