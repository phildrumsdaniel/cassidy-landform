function AIPanel(props){
  var rs=useState(""); var aiRes=rs[0]; var setAiRes=rs[1];
  var rl=useState(false); var aiLoad=rl[0]; var setAiLoad=rl[1];
  var rj=useState(null); var aiJson=rj[0]; var setAiJson=rj[1];
  var ts=useState(null); var toast=ts[0]; var setToast=ts[1];

  // Restore persisted result on mount
  React.useEffect(function(){
    if(props.persistKey&&props.data){
      var saved=(props.data[props.stage]&&props.data[props.stage]["ai_"+props.persistKey])||"";
      if(saved&&!aiRes)setAiRes(saved);
    }
  },[]);

  // Auto-dismiss toast after 8s
  React.useEffect(function(){
    if(toast){
      var t=setTimeout(function(){setToast(null);},8000);
      return function(){clearTimeout(t);};
    }
  },[toast]);

  async function run(){
    setAiLoad(true); setAiRes(""); setAiJson(null);
    try{
      var corrInstr=
        "CRITICAL OUTPUT RULES:\n"+
        "1. READ THE INPUTS ONLY. Do not output instructions to alter saved fields and do not provide an auto-fill corrections block.\n"+
        "2. Give proper judgement analysis based on the user's actual inputs. Distinguish clearly between facts from the inputs, assumptions, market benchmarks, and recommendations.\n"+
        "3. Do not invent missing values just to complete an appraisal. If a key input is missing, call it out as a DD gap and explain the commercial effect.\n"+
        "4. Where figures look wrong, stale, contradictory, or outside market norms, flag them for manual review instead of replacing them.\n"+
        "5. Keep the response concise and useful: risks first, then commercial judgement, then specific manual checks required.\n"+
        "6. Do NOT include CORRECTIONS_START, CORRECTIONS_END, or JSON corrections unless the user explicitly asks to apply values.\n";
      var fmtInstr="\nFORMATTING: use light Markdown so it presents cleanly — **bold** for headline figures and verdicts, '- ' bullets for lists, and '## ' headings only if the answer is long enough to warrant sections. No code blocks or images.\n";
      var enhPrompt=props.prompt+"\n\n"+corrInstr+fmtInstr;
      var result=await callAI(props.user,props.stage,"You are a senior UK development finance director. Analyse the supplied appraisal inputs only. Give judgement, risks, assumptions and manual review points. Do not change or auto-fill fields. Use light Markdown (**bold**, '- ' bullets, '## ' headings) for a clean, presentable layout.",enhPrompt);
      // Extract corrections block
      var ci=result.indexOf("CORRECTIONS_START");
      var ce=result.indexOf("CORRECTIONS_END");
      var parsedCorrections=null;
      if(ci>=0&&ce>ci){
        var jsonStr=result.substring(ci+17,ce).trim();
        // Clean up - remove field name quotes issues
        jsonStr=jsonStr.replace(/([{,])\s*([a-zA-Z]+)\s*:/g,'$1"$2":');
        try{
          var parsed=JSON.parse(jsonStr);
          if(parsed.corrections&&parsed.corrections.length>0){
            parsedCorrections=parsed;
            setAiJson(parsed);
          }
        }catch(e2){
          // Try extracting just the array
          var arrMatch=jsonStr.match(/\[[\s\S]*\]/);
          if(arrMatch){
            try{
              var arr=JSON.parse(arrMatch[0]);
              if(arr.length>0){parsedCorrections={corrections:arr};setAiJson(parsedCorrections);}
            }catch(e3){}
          }
        }
        result=result.substring(0,ci).trim();
      }
      setAiRes(result);
      // Persist result to deal data so it survives navigation
      if(props.persistKey&&props.up&&props.stage){
        props.up(props.stage,"ai_"+props.persistKey,result);
      }
      logEvent(props.user,"AI_RESULT",{stage:props.stage,result:result.substring(0,200)});

      // AI analysis is read-only by default. Suggestions may be shown for review, but are never applied automatically.
    }catch(err){setAiRes("Analysis failed — check connection");}
    setAiLoad(false);
  }

  // v9.43 — Your data is the source of truth.
  // A field is "locked" if it already holds a value (you typed it OR it auto-filled
  // once) or if its page has been explicitly locked. The AI may FILL BLANKS, but it
  // can NEVER overwrite a value that is already there. Only a manual edit changes it.
  function isLockedStage(stage){
    try{ return !!(props.data && props.data._locks && props.data._locks[stage]); }catch(e){ return false; }
  }
  function isEmptyVal(v){ return v===undefined||v===null||(typeof v==="string"&&v.trim()===""); }
  function autoApply(corrections){
    var applied=[];      // blank fields we filled
    var kept=[];         // existing/locked fields we refused to overwrite
    corrections.forEach(function(c){
      if(!c.field||!c.stage||c.value===undefined||c.value===null||c.value===""){
        return;
      }
      var cur=(props.data&&props.data[c.stage])?props.data[c.stage][c.field]:undefined;
      // NEVER overwrite a populated field or a locked page — protect the user's figures.
      if(isLockedStage(c.stage)||!isEmptyVal(cur)){
        kept.push({field:c.field,stage:c.stage,value:c.value,existing:cur,reason:c.reason||""});
        return;
      }
      props.up(c.stage,c.field,typeof c.value==="number"?c.value:String(c.value));
      applied.push({field:c.field,stage:c.stage,value:c.value,reason:c.reason||""});
    });
    if(applied.length>0||kept.length>0){
      setToast({count:applied.length,items:applied,keptCount:kept.length,keptItems:kept});
      logEvent(props.user,"AI_AUTOFILL",{stage:props.stage,fieldsApplied:applied.length,fieldsKept:kept.length});
    }
  }

  function applyCorrections(){
    if(!aiJson||!aiJson.corrections)return;
    autoApply(aiJson.corrections);
    setAiJson(null);
  }

  return e("div",{style:{gridColumn:"span 2",display:"flex",flexDirection:"column",gap:10,marginTop:4}},
    e("button",{onClick:run,disabled:aiLoad,style:Object.assign({},S.btn,{opacity:aiLoad?0.6:1,cursor:aiLoad?"not-allowed":"pointer"})},
      aiLoad?"⏳ Analysing...":"⚡ "+props.label
    ),

    // ── TOAST: shows what AI populated across the tool ─────────────────
    toast&&e("div",{style:{position:"fixed",bottom:24,right:24,zIndex:9999,maxWidth:420,background:"#fff",border:"1px solid #2D7A65",borderLeft:"5px solid #2D7A65",borderRadius:10,boxShadow:"0 10px 40px rgba(0,0,0,0.15)",padding:"14px 16px",animation:"pulse 0.4s ease-out"}},
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:8}},
        e("div",null,
          e("div",{style:{fontSize:12,fontWeight:800,color:"#2D7A65"}},toast.count>0?("✓ AI filled "+toast.count+" blank field"+(toast.count!==1?"s":"")):"✓ Nothing changed — all fields already had values"),
          e("div",{style:{fontSize:10,color:"#7278A0",marginTop:2}},toast.keptCount>0?(toast.keptCount+" of your existing figure"+(toast.keptCount!==1?"s were":" was")+" kept — AI never overwrites what you've entered"):"AI only fills empty fields; your entries are never changed")
        ),
        e("button",{onClick:function(){setToast(null);},style:{background:"none",border:"none",fontSize:18,color:"#7278A0",cursor:"pointer",lineHeight:1,padding:0}},"×")
      ),
      e("div",{style:{maxHeight:200,overflowY:"auto",borderTop:"1px solid #EAECF3",paddingTop:8}},
        toast.items.slice(0,12).map(function(it,i){
          return e("div",{key:i,style:{fontSize:11,padding:"3px 0",display:"flex",justifyContent:"space-between",gap:8}},
            e("span",{style:{color:"#7278A0"}},it.stage+" · "+it.field),
            e("span",{style:{color:"#2D7A65",fontWeight:700}},String(it.value).substring(0,30))
          );
        }),
        toast.items.length>12&&e("div",{style:{fontSize:10,color:"#7278A0",fontStyle:"italic",paddingTop:4}},"+ "+(toast.items.length-12)+" more")
      )
    ),

    aiRes&&e("div",{style:{background:"#F8F8FE",border:"1px solid #DDE0ED",borderLeft:"3px solid #4A4BAE",borderRadius:8,overflow:"hidden"}},
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:"1px solid #DDE0ED",background:"#F0F1FA"}},
        e("span",{style:{fontSize:11,fontWeight:700,color:"#4A4BAE"}},"AI Analysis Result"),
        e("div",{style:{display:"flex",gap:8}},
          aiJson&&aiJson.corrections&&aiJson.corrections.length>0&&e("button",{
            onClick:applyCorrections,
            style:{padding:"4px 12px",background:"#2D7A65",border:"none",borderRadius:4,color:"#fff",fontSize:10,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"Apply "+aiJson.corrections.length+" suggested fields"),
          e("button",{
            onClick:function(){
              var el=document.createElement("textarea");
              el.value=aiRes;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);
              notify("Copied to clipboard");
            },
            style:{padding:"4px 10px",background:"#4A4BAE",border:"none",borderRadius:4,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
          },"📋 Copy")
        )
      ),
      aiJson&&aiJson.corrections&&aiJson.corrections.length>0&&e("div",{style:{background:"rgba(45,122,101,0.08)",borderBottom:"1px solid rgba(45,122,101,0.2)",padding:"10px 16px"}},
        e("div",{style:{fontSize:11,fontWeight:700,color:"#2D7A65",marginBottom:6}},"AI suggested "+aiJson.corrections.length+" figure"+(aiJson.corrections.length!==1?"s":"")+" — only blank fields were filled; your existing entries were kept:"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:6}},
          aiJson.corrections.map(function(c,i){
            return e("div",{key:i,style:{background:"#fff",border:"1px solid rgba(45,122,101,0.3)",borderRadius:5,padding:"6px 10px",fontSize:11}},
              e("div",{style:{fontWeight:700,color:"#2E2F8A"}},c.field+" ("+c.stage+")"),
              e("div",{style:{color:"#2D7A65",fontWeight:700}},"→ "+c.value),
              e("div",{style:{fontSize:9,color:"#7278A0"}},c.reason||"")
            );
          })
        )
      ),
      e("div",{style:{maxHeight:500,overflowY:"auto",padding:"16px 20px"}},
        (typeof renderMarkdownReport==="function")
          ? renderMarkdownReport(aiRes,{fontSize:12})
          : e("pre",{style:{fontSize:12,lineHeight:1.9,color:"#3A3D6A",whiteSpace:"pre-wrap",fontFamily:"DM Sans,sans-serif",margin:0}},aiRes)
      )
    )
  );
}

// ── ACCESS GATE ───────────────────────────────────────────────────────────────
