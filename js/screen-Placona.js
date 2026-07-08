// ── Placona MAP (v9.93) — Leaflet map of found sites, pins geocoded from postcode ──
// Geocoding: postcodes.io (free, no key) full-postcode → outcode → region-centroid
// fallback → UK centre. Results cached so we don't re-hit the API. Pins coloured by
// the Cassidy Opportunity Score; click a pin to open that site.
var _placonaGeoCache = {};
function placonaFallbackLatLng(site){
  var pc = (site.postcode && site.postcode !== "Not found") ? site.postcode : "";
  var region = (typeof ukRegionFor === "function")
    ? ukRegionFor({ land:{ postcode:pc, city:(site.town || "").toLowerCase() } }) : "";
  return (typeof REGION_LATLNG !== "undefined" && REGION_LATLNG[region]) || [54.0, -2.4];
}
function placonaGeocode(site, cb){
  var pc = (site.postcode && site.postcode !== "Not found") ? String(site.postcode).trim() : "";
  var key = pc.toUpperCase();
  if(key && _placonaGeoCache[key]){ cb(_placonaGeoCache[key]); return; }
  var fallback = placonaFallbackLatLng(site);
  if(!pc || typeof fetch === "undefined"){ cb(fallback); return; }
  var outcode = pc.split(/\s+/)[0];
  var save = function(ll){ if(ll){ _placonaGeoCache[key] = ll; cb(ll); } else cb(fallback); };
  try{
    fetch("https://api.postcodes.io/postcodes/" + encodeURIComponent(pc))
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){
        if(j && j.result && j.result.latitude){ save([j.result.latitude, j.result.longitude]); return; }
        fetch("https://api.postcodes.io/outcodes/" + encodeURIComponent(outcode))
          .then(function(r){ return r.ok ? r.json() : null; })
          .then(function(j2){ save(j2 && j2.result && j2.result.latitude ? [j2.result.latitude, j2.result.longitude] : null); })
          .catch(function(){ cb(fallback); });
      })
      .catch(function(){ cb(fallback); });
  }catch(e){ cb(fallback); }
}
// ── Free government CONSTRAINT LAYERS for the map (v9.95) ─────────────────────
// Verified working via CI probe: planning.data.gov.uk serves these as GeoJSON (their
// vector-tile endpoint 404s), so we fetch features intersecting the current viewport
// and draw them with L.geoJSON. Green Belt / Conservation Area / AONB / Listed Buildings.
// Flood is a deep-link for now (the EA WMS endpoint moved; a mapped flood layer will
// follow once the ArcGIS service is confirmed). All free, no API key.
var PD_GEOJSON = "https://www.planning.data.gov.uk/entity.geojson";
var MIN_CONSTRAINT_ZOOM = 11;   // below this a viewport query would be huge/meaningless
var CONSTRAINT_LAYERS = [
  { id:"green-belt",                        label:"Green Belt",        colour:"#2E7D32", kind:"pd",
    link:"https://www.planning.data.gov.uk/map/#dataset=green-belt" },
  { id:"conservation-area",                 label:"Conservation Area", colour:"#8E24AA", kind:"pd",
    link:"https://www.planning.data.gov.uk/map/#dataset=conservation-area" },
  { id:"area-of-outstanding-natural-beauty",label:"AONB",              colour:"#00897B", kind:"pd",
    link:"https://magic.defra.gov.uk/MagicMap.aspx" },
  { id:"listed-building",                   label:"Listed Buildings",  colour:"#C62828", kind:"pd", point:true,
    link:"https://historicengland.org.uk/listing/the-list/" },
  { id:"flood",                             label:"Flood map ↗",       colour:"#1565C0", kind:"link",
    link:"https://flood-map-for-planning.service.gov.uk/" }
];
function _bboxWKT(b){
  var w = b.getWest(), s = b.getSouth(), e2 = b.getEast(), n = b.getNorth();
  return "POLYGON((" + w + " " + s + "," + e2 + " " + s + "," + e2 + " " + n + "," + w + " " + n + "," + w + " " + s + "))";
}
function PlaconaMap(props){
  var recs = props.recs || [];
  var elRef = React.useRef(null), mapRef = React.useRef(null), markersRef = React.useRef([]);
  var geoRef = React.useRef({}), activeRef = React.useRef({}), refreshRef = React.useRef(function(){});
  var rs = useState(false), ready = rs[0], setReady = rs[1];
  var as = useState({}), active = as[0], setActive = as[1];
  var zs = useState(6), zoom = zs[0], setZoom = zs[1];
  function toggle(id){ var n = Object.assign({}, active); n[id] = !n[id]; setActive(n); }

  // Fetch + draw the active planning.data layers for the current viewport
  function refreshConstraints(){
    var map = mapRef.current; if(!map || typeof L === "undefined") return;
    var z = map.getZoom();
    CONSTRAINT_LAYERS.forEach(function(cfg){
      if(cfg.kind !== "pd") return;
      var layer = geoRef.current[cfg.id];
      if(!activeRef.current[cfg.id]){ if(layer){ layer.clearLayers(); } return; }
      if(!layer){
        layer = L.geoJSON(null, {
          style: { color:cfg.colour, weight:1.5, opacity:0.9, fillColor:cfg.colour, fillOpacity:0.28 },
          pointToLayer: function(f, latlng){ return L.circleMarker(latlng, { radius:4, color:cfg.colour, weight:1, fillColor:cfg.colour, fillOpacity:0.85 }); },
          onEachFeature: function(f, lyr){ var nm = f.properties && (f.properties.name || f.properties.reference); if(nm) lyr.bindPopup('<b>' + cfg.label + '</b><br>' + nm); }
        }).addTo(map);
        geoRef.current[cfg.id] = layer;
      }
      if(z < MIN_CONSTRAINT_ZOOM){ layer.clearLayers(); return; }
      var url = PD_GEOJSON + "?dataset=" + cfg.id + "&geometry_relation=intersects&geometry=" + encodeURIComponent(_bboxWKT(map.getBounds())) + "&limit=500";
      fetch(url).then(function(r){ return r.ok ? r.json() : null; }).then(function(gj){
        if(!gj || !geoRef.current[cfg.id]) return;
        layer.clearLayers();
        if(gj.features && gj.features.length) layer.addData(gj);
      }).catch(function(){});
    });
  }
  refreshRef.current = refreshConstraints;

  useEffect(function(){
    if(typeof L === "undefined" || !elRef.current || mapRef.current) return;
    var map = L.map(elRef.current, { scrollWheelZoom:false }).setView([53.2, -1.5], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:18, attribution:"© OpenStreetMap" }).addTo(map);
    map.on("moveend zoomend", function(){ setZoom(map.getZoom()); refreshRef.current(); });
    mapRef.current = map; setReady(true);
    setTimeout(function(){ try{ map.invalidateSize(); }catch(e){} }, 200);
    return function(){ try{ map.remove(); }catch(e){} mapRef.current = null; };
  }, []);

  // Pins
  useEffect(function(){
    var map = mapRef.current; if(!map || typeof L === "undefined") return;
    markersRef.current.forEach(function(m){ try{ map.removeLayer(m); }catch(e){} });
    markersRef.current = [];
    var bounds = [];
    recs.forEach(function(rec){
      var site = rec.site || rec, opp = rec.opp || { score:0 };
      placonaGeocode(site, function(ll){
        if(!ll || !mapRef.current) return;
        var col = props.oppCol ? props.oppCol(opp.score) : "#4A4BAE";
        var mk = L.circleMarker(ll, { radius:9, color:"#fff", weight:2, fillColor:col, fillOpacity:0.9 });
        var name = site.site_name || site.address_or_location || "Site";
        var line2 = [site.town, site.county].filter(function(v){ return v && v !== "Not found"; }).join(", ");
        var meta = [];
        if(site.site_area_acres && site.site_area_acres !== "Not found") meta.push(site.site_area_acres + " ac");
        if(site.asking_price && site.asking_price !== "Not found") meta.push(site.asking_price);
        mk.bindPopup('<div style="font-family:sans-serif;min-width:150px">'
          + '<div style="font-weight:700;color:#2E2F8A">' + name + '</div>'
          + (line2 ? '<div style="font-size:11px;color:#666">' + line2 + '</div>' : '')
          + '<div style="font-size:11px;margin-top:4px">Score <b>' + (opp.score || 0) + '%</b>'
          + (meta.length ? ' · ' + meta.join(' · ') : '') + '</div>'
          + '<div style="font-size:10px;color:#4A4BAE;margin-top:4px">Click the pin to open this site →</div>'
          + '</div>');
        mk.on("click", function(){ if(props.onSelect) props.onSelect(site); });
        mk.addTo(map);
        markersRef.current.push(mk);
        bounds.push(ll);
        try{ map.fitBounds(bounds, { padding:[34,34], maxZoom:11 }); }catch(e){}
      });
    });
  }, [props.sig, ready]);

  // Toggle → sync active ref + (re)draw
  useEffect(function(){ activeRef.current = active; refreshConstraints(); }, [active, ready]);

  if(typeof L === "undefined"){
    return e("div",{style:{height:120,display:"flex",alignItems:"center",justifyContent:"center",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:10,color:"#7278A0",fontSize:12}},"Map is loading — give it a moment, then reopen the inbox.");
  }
  var anyPdActive = CONSTRAINT_LAYERS.some(function(c){ return c.kind === "pd" && active[c.id]; });
  return e("div",null,
    // Constraint layer toggles
    e("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:6,alignItems:"center"}},
      e("span",{style:{fontSize:10,fontWeight:700,color:"#7278A0",marginRight:2}},"Constraints:"),
      CONSTRAINT_LAYERS.map(function(cfg){
        if(cfg.kind === "link"){
          return e("a",{key:cfg.id,href:cfg.link,target:"_blank",rel:"noopener noreferrer",
            style:{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 9px",background:"#fff",color:"#3A3D6A",border:"1px solid #DDE0ED",borderRadius:14,fontSize:10,fontWeight:700,textDecoration:"none",fontFamily:"DM Sans,sans-serif"}},
            e("span",{style:{width:8,height:8,borderRadius:"50%",background:cfg.colour,display:"inline-block"}}), cfg.label);
        }
        var on = !!active[cfg.id];
        return e("button",{key:cfg.id,onClick:function(){ toggle(cfg.id); },
          title:on?"Hide "+cfg.label:"Show "+cfg.label,
          style:{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 9px",background:on?cfg.colour:"#fff",color:on?"#fff":"#3A3D6A",border:"1px solid "+(on?cfg.colour:"#DDE0ED"),borderRadius:14,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
          e("span",{style:{width:8,height:8,borderRadius:"50%",background:on?"#fff":cfg.colour,display:"inline-block"}}),
          cfg.label);
      })
    ),
    e("div",{ref:elRef, style:{height:380,width:"100%",borderRadius:10,overflow:"hidden",border:"1px solid #DDE0ED"}}),
    // Legend + zoom hint + official-source links
    e("div",{style:{fontSize:9,color:"#7278A0",marginTop:5,lineHeight:1.6}},
      (anyPdActive && zoom < MIN_CONSTRAINT_ZOOM) ? e("span",{style:{color:"#9A7B3E",fontWeight:700}},"Zoom in to load constraint detail (data draws at street level). ") : null,
      "Constraint data: planning.data.gov.uk (free). Official maps: ",
      CONSTRAINT_LAYERS.map(function(cfg,i){
        return e("span",{key:cfg.id}, i>0?" · ":"", e("a",{href:cfg.link,target:"_blank",rel:"noopener noreferrer",style:{color:"#4A4BAE",fontWeight:700}},cfg.label.replace(" ↗","")));
      })
    )
  );
}

// ── renderPlacona  (params: data, loadSiteIntoDeal, up, user) (setToast inside loadSiteIntoDeal stays in Tool — cosmetic)
// Lifted out of Tool; body byte-unchanged. Loaded before 05-tool.js.
function renderPlacona(data, loadSiteIntoDeal, up, user, navTo){
    var pl=data.placona||{};
    var inbox=(pl.inbox)||[];
    var running=pl.running||false;
    var lastRun=pl.lastRun||"";
    var error=pl.error||"";
    var loadingSheet=pl.loadingSheet||false;
    var selectedSite=pl.selectedSite||null;
    var view=pl.view||"search"; // "search" | "inbox" | "detail"

    // v9.75 — Scout opportunity scoring: rank the inbox by the Cassidy Opportunity
    // Score and let the user set a shortlist threshold (protects against overload).
    var oppScored=inbox.map(function(s){ return {site:s, opp:(typeof scoreOpportunity==="function")?scoreOpportunity(s):{score:0,confidence:0,band:""}}; })
      .sort(function(a,b){ return b.opp.score-a.opp.score; });
    var oppMin=num(pl.minScore)||0;
    var oppShown=oppScored.filter(function(x){ return x.opp.score>=oppMin; });
    function oppCol(sc){ return sc>=75?"#2D7A65":sc>=60?"#4A4BAE":sc>=45?"#9A7B3E":"#B05A35"; }

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
      if(selected.length===0){notify("Please select at least one county.");return;}
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
          // Inbox header + shortlist threshold
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}},
            e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A"}},oppShown.length+" of "+inbox.length+" site"+(inbox.length!==1?"s":"")+" — ranked by Cassidy Opportunity Score"),
            e("button",{onClick:function(){up("placona","inbox",[]);},
              style:{padding:"5px 12px",background:"none",border:"1px solid #DDE0ED",borderRadius:4,color:"#B05A35",fontSize:10,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Clear all")
          ),
          e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"8px 12px",background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:6}},
            e("span",{style:{fontSize:11,color:"#7278A0",fontWeight:700}},"Shortlist: score ≥"),
            e("input",{type:"range",min:0,max:90,step:5,value:oppMin,onChange:function(ev){up("placona","minScore",Number(ev.target.value));},style:{flex:1,accentColor:"#2D7A65"}}),
            e("span",{style:{fontSize:13,fontWeight:800,color:oppCol(oppMin),minWidth:38,textAlign:"right"}},oppMin+"%")
          ),
          // v9.93 — MAP of the shortlisted sites (pins from postcode, coloured by score)
          oppShown.length>0 && e("div",{style:{marginBottom:12}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:8,flexWrap:"wrap"}},
              e("span",{style:{fontSize:11,fontWeight:700,color:"#2E2F8A"}},"🗺️ Map — "+oppShown.length+" site"+(oppShown.length!==1?"s":"")+" (pin colour = opportunity score; click a pin to open)"),
              e("div",{style:{display:"flex",gap:6}},
                navTo&&e("button",{onClick:function(){navTo("constraint");},style:{padding:"4px 10px",background:"#fff",border:"1px solid #DDE0ED",borderRadius:4,fontSize:10,fontWeight:700,color:"#B05A35",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"⚠ Constraints Checker →"),
                e("button",{onClick:function(){up("placona","hideMap",!pl.hideMap);},style:{padding:"4px 10px",background:"#fff",border:"1px solid #DDE0ED",borderRadius:4,fontSize:10,fontWeight:700,color:"#7278A0",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}}, pl.hideMap?"Show map":"Hide map")
              )
            ),
            !pl.hideMap && e(PlaconaMap,{
              recs:oppShown,
              oppCol:oppCol,
              sig:oppShown.map(function(r){return (r.site.postcode||"")+"|"+(r.site.site_name||r.site.address_or_location||"");}).join("~"),
              onSelect:function(site){ up("placona","selectedSite",site); up("placona","view","detail"); }
            }),
            !pl.hideMap && e("div",{style:{fontSize:9,color:"#9A7B3E",marginTop:4,fontStyle:"italic"}},"Pins are placed from each site's postcode (add postcodes for exact positions; without one a site sits at its region's centre).")
          ),
          // Site cards (ranked)
          oppShown.map(function(rec,si){
            var site=rec.site, opp=rec.opp;
            var score=num(site.placona_score)||0;
            var cat=site.placona_category||"";
            var col=catCol(cat);
            return e("div",{key:si,
              style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,marginBottom:8,overflow:"hidden",transition:"box-shadow .15s",cursor:"pointer"},
              onClick:function(){up("placona","selectedSite",site);up("placona","view","detail");}
            },
              e("div",{style:{display:"flex",alignItems:"stretch"}},
                // Score column — Cassidy Opportunity Score (with confidence)
                e("div",{style:{width:72,background:oppCol(opp.score),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,padding:"12px 0"}},
                  e("div",{style:{fontSize:22,fontWeight:800,color:"#fff",lineHeight:1}},opp.score+"%"),
                  e("div",{style:{fontSize:8,color:"rgba(255,255,255,0.9)",fontWeight:700,marginTop:2,textTransform:"uppercase"}},opp.band),
                  e("div",{style:{fontSize:8,color:"rgba(255,255,255,0.75)",marginTop:3}},"conf "+opp.confidence+"%")
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
                  // top pillars driving the score
                  e("div",{style:{fontSize:10,color:"#7278A0",marginTop:4,lineHeight:1.5}},
                    opp.pillars.map(function(p){ return p.label.split(" ")[0]+" "+p.score; }).join(" · ")
                  ),
                  opp.confidence<50 && e("div",{style:{fontSize:9,color:"#B05A35",fontWeight:700,marginTop:2}},"⚠ Low confidence — thin data, verify before relying on the score"),
                  e("div",{style:{fontSize:10,color:"#9A7B3E",marginTop:3}},"Placona "+(score||"—")+(cat?" · Cat "+cat:"")+(site.recommended_action?" · "+site.recommended_action:""))
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
                      var newInbox=inbox.filter(function(s2){return s2!==site;});
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
          e("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
            // v9.74 — send the found site to Keystone to evaluate & build the scheme
            (typeof keystoneBriefFromPlaconaSite==="function") && e("button",{
              onClick:function(){
                var brief=keystoneBriefFromPlaconaSite(selectedSite);
                up("keystone","brief",JSON.stringify(brief,null,2));
                up("keystone","source","=== From Placona ===\n"+JSON.stringify(selectedSite,null,2));
                if(typeof navTo==="function") navTo("keystone");
              },
              style:{padding:"10px 18px",background:"#fff",border:"2px solid #2D7A65",borderRadius:6,color:"#1d5446",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },"🪨 Evaluate in Keystone →"),
            e("button",{
              onClick:function(){loadSiteIntoDeal(selectedSite);},
              style:{padding:"10px 22px",background:"linear-gradient(135deg,#2D7A65,#4A4BAE)",border:"none",borderRadius:6,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif",boxShadow:"0 4px 10px rgba(74,75,174,0.3)"}
            },"🚀 Load into Landform — Pre-fill All Fields")
          )
        ),

        // v9.75 — Cassidy Opportunity Score breakdown (transparent pillars)
        (typeof scoreOpportunity==="function") && (function(){
          var opp=scoreOpportunity(selectedSite);
          return e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:"16px 18px",marginBottom:14}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}},
              e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".1em"}},"Cassidy Opportunity Score"),
              e("div",{style:{display:"flex",alignItems:"baseline",gap:8}},
                e("span",{style:{fontSize:26,fontWeight:800,color:oppCol(opp.score)}},opp.score+"%"),
                e("span",{style:{fontSize:11,fontWeight:700,color:oppCol(opp.score)}},opp.band),
                e("span",{style:{fontSize:11,color:opp.confidence<50?"#B05A35":"#7278A0"}},"· confidence "+opp.confidence+"%")
              )
            ),
            opp.confidence<50 && e("div",{style:{fontSize:11,color:"#B05A35",marginBottom:8,lineHeight:1.5}},"⚠ Scored on thin data — treat as a steer, not a verdict. Verify acreage, price, planning and demographics before promoting."),
            opp.pillars.map(function(p){
              return e("div",{key:p.key,style:{marginBottom:8}},
                e("div",{style:{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}},
                  e("span",{style:{color:"#3A3D6A",fontWeight:600}},p.label+" ("+p.weight+"%)"),
                  e("span",{style:{color:oppCol(p.score),fontWeight:700}},p.score)
                ),
                e("div",{style:{height:6,background:"#F0F1FA",borderRadius:3,overflow:"hidden"}},
                  e("div",{style:{width:p.score+"%",height:"100%",background:oppCol(p.score),borderRadius:3}})
                ),
                e("div",{style:{fontSize:9,color:"#9A9AAE",marginTop:2}},p.note)
              );
            })
          );
        })(),

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
