// ── renderDD (Due Diligence screen) ────────────────────────────
// Lifted out of Tool. Takes the 4 Tool variables it uses as explicit params
// (data, setData, user, up); every other name resolves to a global.
function renderDD(data, setData, user, up){
    var DD={
      Legal:["Title register & plan","Searches pack","Planning history","Restrictive covenants","Rights of light","Party wall agreements","Collateral warranties"],
      Technical:["Phase 1 study","Phase 2 (if required)","Topographical survey","Structural report","Fire safety strategy","Flood risk assessment","Acoustic report","Drainage strategy"],
      Planning:["Planning consent","Pre-commencement conditions","S106 executed","CIL confirmed","AH tenure confirmed","BNG assessment"],
      Commercial:["QS cost plan","Contractor procurement","JCT contract","Senior debt term sheet","Insurance schedule","Warranties schedule"],
    };
    var checked=data.ddChecked||{};
    var total2=Object.values(DD).reduce(function(a,b){return a+b.length;},0);
    var done=Object.keys(checked).filter(function(k){return checked[k];}).length;
    var catC={Legal:"#8B9DC3",Technical:"#7FB3A0",Planning:"#9A7B3E",Commercial:"#B05A35"};

    function toggle(item){
      var next=Object.assign({},checked);
      next[item]=!next[item];
      setData(function(d){return Object.assign({},d,{ddChecked:next});});
    }

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Due Diligence"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:20}},"Structured checklist across legal, technical, planning and commercial"),
      e("div",{style:S.card},
        e("div",{style:{display:"flex",alignItems:"center",gap:16}},
          e("div",{style:{fontSize:48,fontWeight:800,color:done/total2>=0.8?"#2D7A65":done/total2>=0.5?"#9A7B3E":"#B05A35",lineHeight:1,minWidth:80}},Math.round(done/total2*100)+"%"),
          e("div",{style:{flex:1}},
            e("div",{style:{height:6,background:"#DDE0ED",borderRadius:3,overflow:"hidden",marginBottom:6}},
              e("div",{style:{height:"100%",width:Math.round(done/total2*100)+"%",background:done/total2>=0.8?"#2D7A65":"#9A7B3E",borderRadius:3,transition:"width .4s"}})
            ),
            e("div",{style:{fontSize:12,color:"#7278A0"}},done+" of "+total2+" items confirmed")
          )
        )
      ),
      Object.keys(DD).map(function(cat){
        var items=DD[cat];
        var catDone=items.filter(function(item){return checked[item];}).length;
        return e("div",{key:cat,style:S.card},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,paddingBottom:12,borderBottom:"1px solid #DDE0ED",marginBottom:12}},
            e("span",null,cat+" Due Diligence"),
            e("span",{style:{color:catC[cat]}},catDone+"/"+items.length)
          ),
          items.map(function(item){
            var isChecked=checked[item]||false;
            return e("div",{key:item,onClick:function(){toggle(item);},style:{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:6,cursor:"pointer",background:isChecked?"rgba(45,122,101,0.04)":"transparent",border:"1px solid "+(isChecked?catC[cat]:"transparent"),marginBottom:4,transition:"all .12s"}},
              e("div",{style:{width:16,height:16,borderRadius:3,border:"1px solid "+(isChecked?catC[cat]:"#C8CDE0"),background:isChecked?catC[cat]:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontSize:10}},isChecked?"✓":""),
              e("span",{style:{fontSize:12,color:isChecked?"#2E2F8A":"#7278A0"}},item)
            );
          })
        );
      }),
      e(AIPanel,{user:user,up:up,stage:"dd",data:data,persistKey:"dd_dd_gap_analysis",label:"DD Gap Analysis",
        prompt:buildHonestPrompt(data,"Due diligence gap analysis. "+done+"/"+total2+" complete. Missing: "+Object.keys(DD).flatMap(function(cat){return DD[cat].filter(function(i){return !checked[i];}).map(function(i){return cat+": "+i;});}).join(", ")||"None"+". Provide: 1) Critical pre-exchange items that are not yet confirmed, 2) Items that can be deferred with contractual protections, 3) Any missing items that should be on this list for this scheme, 4) Realistic timeline to clear all DD.")})
    );
  }
