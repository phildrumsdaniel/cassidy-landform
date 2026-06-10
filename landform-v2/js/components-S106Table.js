// ── S106Table ───────────────────────────────────────────────────
// Lifted out of Tool unchanged (0 closure coupling — see landform-v2/README.md).
// Pure table component — props in, JSX out.
function S106Table(props){
    var f2=props.f; var up2=props.up; var fmt2=props.fmt; var num2=props.num; var S2=props.S;
    // Per-unit divides by the deal's actual unit count (planning units), passed in
    // as props.units by renderFin. Falls back to f.units, then 1, if not supplied.
    var totalU=num2(props.units||f2.units||0)||1;
    var S106_KEYS=["s106edu","s106nhsgp","s106nhshosp","s106bus","s106busstop","s106transport","s106highways","s106bng","s106open","s106sports","s106disposal","s106other"];
    var S106_LBLS={s106edu:"Education",s106nhsgp:"NHS GP Surgery",s106nhshosp:"NHS Hospital",s106bus:"Bus Service Improvements",s106busstop:"Bus Stop Upgrades",s106transport:"Transport / Travel Plan",s106highways:"Highways / S278",s106bng:"Biodiversity Net Gain",s106open:"Open Space / Play",s106sports:"Sports Facilities",s106disposal:"AH Disposal Costs",s106other:"Other / Miscellaneous"};
    var S106_NOTES={s106edu:"Typically 5-8k/unit",s106nhsgp:"500-1,200/unit",s106nhshosp:"800-2,000/unit",s106bus:"Lump sum or per unit",s106busstop:"50-200/unit",s106transport:"Monitoring + vouchers",s106highways:"Off-site works",s106bng:"10% mandatory - can be challenged",s106open:"Commuted sum if management co",s106sports:"3G pitch, grass pitches",s106disposal:"Legal/admin per AH unit",s106other:"Footpaths, wayfinding etc"};
    var total=0;
    for(var ki=0;ki<S106_KEYS.length;ki++){total=total+num2(f2[S106_KEYS[ki]]||0);}
    return e("div",{style:{border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden",marginBottom:10}},
      e("div",{style:{display:"grid",gridTemplateColumns:"2fr 130px 90px 100px",padding:"7px 12px",background:"#2E2F8A",fontSize:9,color:"#fff",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700}},
        e("span",null,"S106 Obligation"),e("span",null,"Total"),e("span",null,"Per Unit"),e("span",null,"Status")
      ),
      S106_KEYS.map(function(key,i){
        var val=num2(f2[key]||0);
        var perU=totalU>0&&val>0?Math.round(val/totalU):0;
        return e("div",{key:key,style:{display:"grid",gridTemplateColumns:"2fr 130px 90px 100px",padding:"6px 12px",background:i%2===0?"#fff":"#FAFAFA",borderBottom:"1px solid #DDE0ED",alignItems:"center",fontSize:11}},
          e("div",null,
            e("div",{style:{fontWeight:600,color:"#2E2F8A"}},S106_LBLS[key]),
            e("div",{style:{fontSize:9,color:"#7278A0"}},S106_NOTES[key])
          ),
          e("input",{type:"number",value:f2[key]||"",placeholder:"0",style:Object.assign({},S2.input,{margin:0,padding:"5px 8px",fontSize:11}),
            onChange:function(ev){
              var v=ev.target.value; up2("fin",key,v);
              var t2=0;
              for(var k2=0;k2<S106_KEYS.length;k2++){
                t2=t2+(S106_KEYS[k2]===key?num2(v):num2(f2[S106_KEYS[k2]]||0));
              }
              if(t2>0&&totalU>0){up2("fin","s106pu",String(Math.round(t2/totalU)));}
            }
          }),
          e("span",{style:{fontSize:10,color:"#7278A0"}},perU>0?"£"+perU.toLocaleString()+"/unit":"—"),
          e("select",{value:f2[key+"st"]||"tbc",style:Object.assign({},S2.select,{margin:0,padding:"3px 5px",fontSize:10}),
            onChange:function(ev){up2("fin",key+"st",ev.target.value);}},
            e("option",{value:"tbc"},"TBC"),
            e("option",{value:"agreed"},"Agreed"),
            e("option",{value:"challenged"},"Challenged"),
            e("option",{value:"excluded"},"Excluded")
          )
        );
      }),
      e("div",{style:{display:"grid",gridTemplateColumns:"2fr 130px 90px 100px",padding:"9px 12px",background:"#F0F0F8",borderTop:"2px solid #DDE0ED",fontWeight:700,fontSize:12}},
        e("span",{style:{color:"#2E2F8A"}},"TOTAL S106"),
        e("span",{style:{color:"#4A4BAE"}},fmt2(total)),
        e("span",{style:{color:"#7278A0"}},totalU>0?"£"+Math.round(total/totalU).toLocaleString()+"/unit":"—"),
        e("span",{style:{color:"#2D7A65",fontSize:10}},"auto-fills S106/unit above")
      )
    );
  }
