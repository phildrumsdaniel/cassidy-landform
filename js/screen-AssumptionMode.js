// ── Assumption Mode UI ──────────────────────────────────────────────────────
// A non-destructive presentation overlay (see ASSUME_DIMENSIONS / assumeFlags in
// 01-config.js). Two entry points share one set of toggle chips:
//   • AssumptionControls(data, up, opts) — the toggle chips (used in the global
//     banner AND in the entry-point card on Dashboard / Executive Summary).
//   • AssumptionBanner(data, up)         — the amber strip shown above every
//     screen while any dimension is assumed, so it can never be forgotten.
// Nothing here writes to real fields — only to data._assume.* — and every label
// carries "(assumed)" so an assumed position never reads as achieved fact.

function AssumptionControls(data, up, opts){
  opts = opts || {};
  var flags = assumeFlags(data);
  function toggle(k){ up("_assume", k, !flags[k]); }
  function clearAll(){ ASSUME_DIMENSIONS.forEach(function(d){ up("_assume", d.k, false); }); }
  var anyOn = assumeAny(data);

  return e("div",{style:{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}},
    ASSUME_DIMENSIONS.map(function(d){
      var on = flags[d.k];
      return e("button",{key:d.k,onClick:function(){toggle(d.k);},title:d.note,
        style:{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,
          border:"1px solid "+(on?"#9A7B3E":"#DDE0ED"),
          background:on?"#9A7B3E":(opts.onDark?"rgba(255,255,255,0.12)":"#F7F8FC"),
          color:on?"#fff":(opts.onDark?"#fff":"#3A3D6A"),
          fontSize:11,fontWeight:on?800:600,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
        e("span",{style:{fontSize:12}},on?"✓":d.icon),
        e("span",null,d.label)
      );
    }),
    anyOn&&e("button",{onClick:clearAll,
      style:{padding:"6px 12px",borderRadius:20,border:"1px solid "+(opts.onDark?"rgba(255,255,255,0.4)":"#C5C8E0"),
        background:"transparent",color:opts.onDark?"#fff":"#7278A0",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
      "Exit assumption mode")
  );
}

// The always-visible entry-point card (Dashboard / Executive Summary).
function AssumptionModeCard(data, up){
  var anyOn = assumeAny(data);
  return e("div",{style:{background:anyOn?"rgba(154,123,62,0.08)":"#fff",
      border:"1px solid "+(anyOn?"rgba(154,123,62,0.4)":"#DDE0ED"),borderRadius:10,padding:"14px 18px",marginBottom:14}},
    e("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}},
      e("span",{style:{fontSize:18}},"🎭"),
      e("div",{style:{flex:1,minWidth:200}},
        e("div",{style:{fontSize:12,fontWeight:800,color:anyOn?"#9A7B3E":"#2E2F8A"}},"Assumption Mode"+(anyOn?" — ON":"")),
        e("div",{style:{fontSize:11,color:"#7278A0",marginTop:2}},
          "Present the scheme as if these are satisfied — for stakeholder reports. Your real data is untouched; toggle off to see the true position.")
      )
    ),
    AssumptionControls(data, up, {})
  );
}

// The global strip shown above every screen while any dimension is assumed.
function AssumptionBanner(data, up){
  if(!assumeAny(data)) return null;
  var f = assumeFlags(data);
  var on = ASSUME_DIMENSIONS.filter(function(d){ return f[d.k]; }).map(function(d){ return d.label; });
  return e("div",{style:{background:"linear-gradient(90deg,#9A7B3E,#B0894A)",color:"#fff",borderRadius:8,
      padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",
      boxShadow:"0 2px 10px rgba(154,123,62,0.25)"}},
    e("span",{style:{fontSize:18}},"🎭"),
    e("div",{style:{flex:1,minWidth:220}},
      e("div",{style:{fontSize:12,fontWeight:800,letterSpacing:".04em"}},"ASSUMPTION MODE — illustrative, not the real position"),
      e("div",{style:{fontSize:10.5,opacity:0.92,marginTop:1}},"Assuming: "+on.join(" · ")+". Reports are labelled illustrative; underlying data is unchanged.")
    ),
    AssumptionControls(data, up, {onDark:true})
  );
}

// Short label appended to report headers/covers when assumptions are applied.
function assumptionWatermark(data){
  if(!assumeAny(data)) return "";
  var f = assumeFlags(data);
  var parts = [];
  if(f.planning) parts.push("planning consented");
  if(f.dd) parts.push("DD clear");
  if(f.constraints) parts.push("constraints cleared");
  if(f.risks) parts.push("risks mitigated");
  return "ILLUSTRATIVE — assumes "+parts.join(", ")+" (not the achieved position)";
}
