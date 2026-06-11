// ── renderRisks  (params: at, data, setData, up, user)
// Lifted out of Tool; body byte-unchanged. Takes the Tool variables it uses as
// explicit params; all other names resolve to globals. Loaded before 05-tool.js.
function renderRisks(at, data, setData, up, user){
    try {
      // Defensive: ensure risks is always an array (data corruption protection)
      var risks = data && data.risks;
      if(!Array.isArray(risks) || risks.length===0){
        risks = RISK_DEFAULTS.map(function(r){return Object.assign({},r);});
      }
      var RC={red:"#B05A35",amber:"#9A7B3E",green:"#2D7A65"};
      var counts={red:0,amber:0,green:0};
      risks.forEach(function(r){if(r && counts[r.rag]!==undefined)counts[r.rag]++;});

      function updateRisk(id,key,val){
        var updated=risks.map(function(r){
          if(r.id!==id) return r;
          var next=Object.assign({},r);
          next[key]=val;
          return next;
        });
        setData(function(d){return Object.assign({},d,{risks:updated});});
      }
      function addRisk(){
        var newRisk={id:Date.now(),cat:"Other",desc:"New risk",rag:"amber",mit:"Mitigation TBC"};
        setData(function(d){
          var current = Array.isArray(d.risks) ? d.risks : [];
          return Object.assign({},d,{risks:current.concat([newRisk])});
        });
      }

      // Safe builds of summary strings for AIPanel prompt
      var assetType = (typeof at !== "undefined" && at) ? at : "scheme";
      var redList = risks.filter(function(r){return r.rag==="red";}).map(function(r){return r.desc;}).join(", ");
      var amberList = risks.filter(function(r){return r.rag==="amber";}).map(function(r){return r.desc;}).join(", ");

      return e("div",null,
        e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Risk Register"),
        e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:20}},"Live RAG-rated risk tracking with mitigation strategies"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}},
          ["red","amber","green"].map(function(rag){
            return e("div",{key:rag,style:{background:"#fff",border:"1px solid "+RC[rag],borderRadius:8,padding:"14px 16px",textAlign:"center"}},
              e("div",{style:{fontSize:32,fontWeight:800,color:RC[rag],lineHeight:1}},counts[rag]),
              e("div",{style:{fontSize:10,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",marginTop:4}},rag.charAt(0).toUpperCase()+rag.slice(1))
            );
          })
        ),
        e("div",{style:S.card},
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,color:"#4A4BAE",textTransform:"uppercase",letterSpacing:".14em",fontWeight:700,paddingBottom:12,borderBottom:"1px solid #DDE0ED",marginBottom:12}},
            e("span",null,"Risk Register"),
            e("button",{onClick:addRisk,style:{padding:"4px 12px",background:"#F7F8FC",border:"1px solid #DDE0ED",color:"#7278A0",borderRadius:4,fontSize:11,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"+ Add Risk")
          ),
          risks.map(function(r,ri){
            // Safe key — fall back to index if id missing
            var safeKey = (r&&r.id) ? r.id : ("risk-"+ri);
            return e("div",{key:safeKey,style:{display:"grid",gridTemplateColumns:"10px 90px 1fr 80px 1fr",gap:10,padding:"9px 0",borderBottom:"1px solid #DDE0ED",alignItems:"start",fontSize:11}},
              e("div",{style:{width:8,height:8,borderRadius:"50%",background:RC[r.rag]||"#C8CDE0",marginTop:3,flexShrink:0}}),
              e("span",{style:{fontWeight:600,color:"#3A3D6A"}},r.cat||"—"),
              e("span",{style:{color:"#2E2F8A"}},r.desc||"—"),
              e("select",{value:r.rag||"amber",onChange:function(ev){updateRisk(r.id,"rag",ev.target.value);},style:{padding:"3px 6px",border:"1px solid #DDE0ED",borderRadius:4,fontSize:11,fontFamily:"DM Sans,sans-serif",background:"#fff"}},
                ["red","amber","green"].map(function(v){return e("option",{key:v,value:v},v.charAt(0).toUpperCase()+v.slice(1));})
              ),
              e("span",{style:{color:"#7278A0",fontSize:10,lineHeight:1.5}},r.mit||"—")
            );
          })
        ),
        e(AIPanel,{user:user,up:up,stage:"risks",data:data,persistKey:"risks_risk_assessment",label:"Risk Assessment",
          prompt:buildHonestPrompt(data,"Risk assessment for this "+String(assetType).toUpperCase()+" development. Red risks: "+(redList||"None")+". Amber: "+(amberList||"None")+". Provide: 1) Priority ranking of top 3 risks, 2) Specific mitigation actions for each red risk, 3) Any missing risks for this scheme type, 4) Risk-adjusted return recommendation — should you proceed?")})
      );
    } catch(err) {
      console.error("Risk Register render error:",err);
      return e("div",{style:{padding:20}},
        e("h2",{style:{fontSize:24,fontWeight:800,color:"#B05A35",marginBottom:10}},"Risk Register"),
        e("div",{style:{padding:16,background:"#FFF5F0",border:"1px solid #E8C4B0",borderRadius:8,fontSize:12,color:"#7A3A20",lineHeight:1.6}},
          "Risk Register couldn't load due to an error. ",
          e("button",{onClick:function(){
            setData(function(d){return Object.assign({},d,{risks:null});});
          },style:{marginLeft:8,padding:"4px 10px",background:"#B05A35",color:"#fff",border:"none",borderRadius:4,fontSize:11,fontWeight:700,cursor:"pointer"}},"Reset Risk Data")
        ),
        e("pre",{style:{marginTop:14,padding:12,background:"#F4F5FB",fontSize:10,color:"#7278A0",borderRadius:6,whiteSpace:"pre-wrap",overflow:"auto",maxHeight:200}},
          (err && err.message) ? err.message : String(err)
        )
      );
    }
  }
