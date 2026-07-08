// ── renderBuildCosts — the editable Build Cost Library (v9.50)
// Lets Cassidy / the QS keep the BCIS-style build-cost benchmarks current without
// code changes. Edits persist in localStorage and feed every build-cost helper.
function renderBuildCosts(data, setData, user){
  function commit(){
    saveBuildCostSettings(currentBuildCostSettings());
    setData(function(d){ return Object.assign({}, d, {_bcRev:Date.now()}); }); // force re-render
  }
  function setRate(k, band, v){ var n=num(v); if(n>0){ BUILD_TYPES[k][band]=n; commit(); } }
  function setHouse(k, v){ var n=num(v); if(n>0){ HOUSE_TYPES[k].build=n; commit(); } }
  function setTier1(pct){ var n=num(pct); if(n>=0){ TIER1_BUILD_UPLIFT = 1 + n/100; commit(); } }
  function setHaSpec(pct){ var n=num(pct); if(n>=0){ HA_SPEC_UPLIFT = 1 + n/100; commit(); } }

  var inp={width:64,padding:"4px 6px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:12,textAlign:"right",fontFamily:"DM Sans,sans-serif"};
  var th={fontSize:9,color:"#fff",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700};

  return e("div",null,
    e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Build Cost Library"),
    e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:14}},"BCIS-style construction £/sqft benchmarks used across every appraisal. Edit them to keep them current — changes save on this device and feed every screen and the Auto-cost buttons. Validate against a QS cost plan or contractor tender before commitment."),

    e("div",{style:S.card},
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:10}},
        e("div",{style:S.cardTitle},"Tier-1 main-contractor uplift"),
        e("div",{style:{display:"flex",alignItems:"center",gap:8}},
          e("span",{style:{fontSize:12,color:"#7278A0"}},"Adds main-contractor prelims + OH&P when the Tier-1 toggle is on:"),
          e("input",{type:"number",value:Math.round((TIER1_BUILD_UPLIFT-1)*100),onChange:function(ev){setTier1(ev.target.value);},style:inp}),
          e("span",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A"}},"%")
        )
      )
    ),

    // v9.72 — HA low-carbon spec uplift (ASHP + PV + battery, EPC B, NDSS, 12-yr NHBC)
    e("div",{style:S.card},
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,marginBottom:8}},
        e("div",{style:S.cardTitle},"HA low-carbon spec uplift"),
        e("div",{style:{display:"flex",alignItems:"center",gap:8}},
          e("span",{style:{fontSize:12,color:"#7278A0"}},"Added when the HA-spec toggle is on:"),
          e("input",{type:"number",value:Math.round((HA_SPEC_UPLIFT-1)*100),onChange:function(ev){setHaSpec(ev.target.value);},style:inp}),
          e("span",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A"}},"%")
        )
      ),
      e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6}},
        "The premium for building to a housing-association brief (e.g. CHP/Delta): ",
        e("strong",null,"Air Source Heat Pumps, roof PV + battery storage, EPC band B fabric, NDSS minimum sizes and a 12-year NHBC warranty"),
        ". Apply it to the affordable units (or the whole scheme if HA-led) via the HA-spec toggle on the SFH / Block screens. Typically ~£20–30/sqft on a ~£250 base. ",
        e("strong",{style:{color:"#9A7B3E"}},"Confirm against the contractor's (e.g. Caddick's) cost plan.")
      ),
      // NDSS minimum sizes reference — the floor for affordable unit areas
      e("div",{style:{marginTop:12,overflowX:"auto"}},
        e("div",{style:{fontSize:10,fontWeight:800,color:"#2E2F8A",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}},"NDSS minimum sizes (2-storey house) — affordable floor area"),
        e("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
          Object.keys(NDSS_MIN).map(function(k){
            return e("div",{key:k,style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:6,padding:"6px 10px",fontSize:11}},
              e("span",{style:{fontWeight:800,color:"#2E2F8A"}},k.toUpperCase().replace("B","b ").replace("P","p")),
              e("span",{style:{color:"#7278A0"}}," · "+NDSS_MIN[k].m2+"m² ("+NDSS_MIN[k].sqft+" sqft)")
            );
          })
        )
      )
    ),

    e("div",{style:S.card},
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:10}},
        e("div",{style:S.cardTitle},"Scheme-type build costs (£/sqft GIA)"),
        e("button",{onClick:function(){ confirmToast("Reset ALL build-cost benchmarks to the built-in defaults?",function(){ resetBuildCostSettings(); setData(function(d){return Object.assign({},d,{_bcRev:Date.now()});}); },{confirmLabel:"Reset"}); },style:{padding:"5px 12px",background:"#B05A35",border:"none",borderRadius:5,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"↺ Reset to defaults")
      ),
      e("div",{style:{overflowX:"auto"}},
        e("div",{style:{display:"grid",gridTemplateColumns:"1.6fr 1fr 1fr 1fr",gap:8,padding:"8px 12px",background:"#2E2F8A",borderRadius:"6px 6px 0 0",minWidth:420}},
          e("span",{style:th},"Development type"),e("span",{style:Object.assign({},th,{textAlign:"right"})},"Volume (lo)"),e("span",{style:Object.assign({},th,{textAlign:"right"})},"Mid"),e("span",{style:Object.assign({},th,{textAlign:"right"})},"High / Tier-1")
        ),
        Object.keys(BUILD_TYPES).map(function(k){
          return e("div",{key:k,style:{display:"grid",gridTemplateColumns:"1.6fr 1fr 1fr 1fr",gap:8,padding:"7px 12px",borderBottom:"1px solid #EEF",alignItems:"center",minWidth:420}},
            e("span",{style:{fontSize:12,color:"#3A3D6A",fontWeight:600}},k),
            e("div",{style:{textAlign:"right"}},e("span",{style:{fontSize:10,color:"#9AA"}},"£"),e("input",{type:"number",value:BUILD_TYPES[k].lo,onChange:function(ev){setRate(k,"lo",ev.target.value);},style:inp})),
            e("div",{style:{textAlign:"right"}},e("span",{style:{fontSize:10,color:"#9AA"}},"£"),e("input",{type:"number",value:BUILD_TYPES[k].mid,onChange:function(ev){setRate(k,"mid",ev.target.value);},style:inp})),
            e("div",{style:{textAlign:"right"}},e("span",{style:{fontSize:10,color:"#9AA"}},"£"),e("input",{type:"number",value:BUILD_TYPES[k].hi,onChange:function(ev){setRate(k,"hi",ev.target.value);},style:inp}))
          );
        })
      )
    ),

    e("div",{style:S.card},
      e("div",{style:Object.assign({},S.cardTitle,{marginBottom:10})},"Per-house-type build costs (£/sqft GIA)"),
      e("div",{style:{overflowX:"auto"}},
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}},
          Object.keys(HOUSE_TYPES).map(function(k){
            return e("div",{key:k,style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"6px 10px",border:"1px solid #EEF",borderRadius:6}},
              e("span",{style:{fontSize:11,color:"#3A3D6A"}},k),
              e("div",null,e("span",{style:{fontSize:10,color:"#9AA"}},"£"),e("input",{type:"number",value:HOUSE_TYPES[k].build,onChange:function(ev){setHouse(k,ev.target.value);},style:Object.assign({},inp,{width:56})}))
            );
          })
        )
      ),
      e("div",{style:{fontSize:10,color:"#9A7B3E",marginTop:10,fontStyle:"italic"}},"These are base rates before the regional index and Tier-1 uplift. The Auto-cost buttons on the SFH and BTR/PBSA screens apply them with region + Tier-1 automatically.")
    )
  );
}
