// ── renderMeetings  (params: data, up, user)
// Lifted out of Tool; body byte-unchanged. Takes the Tool variables it uses as
// explicit params; all other names resolve to globals. Loaded before 05-tool.js.
function renderMeetings(data, up, user){
    var ms=data.meetings||{transcripts:[],analysing:false,activeId:null};
    var transcripts=ms.transcripts||[];
    var activeId=ms.activeId||null;
    var activeTranscript=transcripts.find(function(t){return t.id===activeId;})||null;

    function upM(key,val){up("meetings",key,val);}

    function addTranscriptFromText(text, file){
      var newT={
        id:"mtg-"+Date.now(),
        name:file.name.replace(/\.[^.]+$/,""),
        filename:file.name,
        date:new Date().toLocaleDateString("en-GB"),
        uploadedAt:Date.now(),
        text:text,
        analysis:"",
        actionItems:[],
        siteRefs:[],
        keyDecisions:[],
        attendees:[],
        tags:[],
        dealRef:data.land&&data.land.address||""
      };
      upM("transcripts",transcripts.concat([newT]));
      upM("activeId",newT.id);
    }

    function handleFileUpload(ev){
      var files=ev.target.files;
      if(!files||files.length===0)return;
      var file=files[0];
      var nm=(file.name||"").toLowerCase();
      var isExcel=/\.(xlsx|xlsm|xlsb|xls)$/.test(nm);
      var reader=new FileReader();
      reader.onload=function(e){
        if(isExcel){
          // Excel is binary (zipped XML) — parse with SheetJS and turn every sheet
          // into readable CSV text so it flows into the same analysis pipeline.
          if(typeof XLSX==="undefined"){ notify("Spreadsheet reader is still loading — please try again in a moment."); return; }
          try{
            var wb=XLSX.read(new Uint8Array(e.target.result),{type:"array"});
            var out=wb.SheetNames.map(function(sn){
              return "=== Sheet: "+sn+" ===\n"+XLSX.utils.sheet_to_csv(wb.Sheets[sn]);
            }).join("\n\n");
            addTranscriptFromText(out||"(empty workbook)", file);
          }catch(err){ notify("Could not read that spreadsheet: "+(err&&err.message||err)); }
        } else {
          addTranscriptFromText(e.target.result, file);
        }
      };
      if(isExcel) reader.readAsArrayBuffer(file); else reader.readAsText(file);
      ev.target.value="";
    }

    function handleTextPaste(text){
      if(!text||text.trim().length<20)return;
      var newT={
        id:"mtg-"+Date.now(),
        name:"Meeting "+new Date().toLocaleDateString("en-GB"),
        filename:"pasted-text",
        date:new Date().toLocaleDateString("en-GB"),
        uploadedAt:Date.now(),
        text:text,
        analysis:"",
        actionItems:[],
        siteRefs:[],
        keyDecisions:[],
        attendees:[],
        tags:[],
        dealRef:data.land&&data.land.address||""
      };
      var newList=transcripts.concat([newT]);
      upM("transcripts",newList);
      upM("activeId",newT.id);
      upM("pasteText","");
    }

    function deleteTranscript(id){
      // v10.14 — non-blocking confirm (native confirm() froze the browser).
      confirmToast("Delete this transcript?", function(){
        var newList=transcripts.filter(function(t){return t.id!==id;});
        upM("transcripts",newList);
        if(activeId===id)upM("activeId",newList.length>0?newList[0].id:null);
      }, {confirmLabel:"Delete"});
    }

    function updateTranscript(id,changes){
      var newList=transcripts.map(function(t){
        return t.id===id?Object.assign({},t,changes):t;
      });
      upM("transcripts",newList);
    }

    function analyseTranscript(t){
      if(!t||!t.text)return;
      upM("analysing",true);
      var siteCtx=data.land&&data.land.address?"Site: "+data.land.address+". LPA: "+(data.planning&&data.planning.lpa||"unknown")+".":"No site currently loaded.";
      var prompt=[
        "Analyse this meeting transcript for a UK residential property development company.",
        "Context: "+siteCtx,
        "",
        "Extract and return in EXACTLY this format:",
        "",
        "ATTENDEES: [comma separated list of names/roles mentioned]",
        "",
        "KEY DECISIONS:",
        "- [each key decision made, one per line]",
        "",
        "ACTION ITEMS:",
        "- [OWNER] [ACTION] by [DATE if mentioned]",
        "",
        "SITE REFERENCES:",
        "- [any sites, addresses, postcodes, LPAs mentioned]",
        "",
        "DEAL IMPACTS:",
        "[how this meeting affects any active deals or land appraisals]",
        "",
        "RISKS IDENTIFIED:",
        "- [any risks, concerns or blockers raised]",
        "",
        "FOLLOW UP REQUIRED:",
        "- [what needs to happen next]",
        "",
        "SUMMARY:",
        "[2-3 sentence executive summary of the meeting]",
        "",
        "TRANSCRIPT:",
        t.text.substring(0,3000)
      ].join("\n");

      callAI(user,"meetings","You are a senior UK residential property development advisor extracting structured intelligence from meeting transcripts. Be specific, extract real names and commitments.",prompt)
      .then(function(result){
        // Parse structured sections
        function extractSection(text,start,end){
          var si=text.indexOf(start);
          if(si<0)return"";
          var ei=end?text.indexOf(end,si+start.length):text.length;
          return ei<0?text.substring(si+start.length).trim():text.substring(si+start.length,ei).trim();
        }
        function extractList(text,section){
          var s=extractSection(text,section,"\n\n");
          return s.split("\n").map(function(l){return l.replace(/^[-*]\s*/,"").trim();}).filter(function(l){return l.length>5;});
        }
        var attendees=extractSection(result,"ATTENDEES:","\n\n").split(",").map(function(s){return s.trim();}).filter(Boolean);
        var actions=extractList(result,"ACTION ITEMS:\n");
        var decisions=extractList(result,"KEY DECISIONS:\n");
        var sites=extractList(result,"SITE REFERENCES:\n");
        var summary=extractSection(result,"SUMMARY:","");

        updateTranscript(t.id,{
          analysis:result,
          actionItems:actions,
          keyDecisions:decisions,
          siteRefs:sites,
          attendees:attendees,
          summary:summary
        });
        upM("analysing",false);
      })
      .catch(function(e){
        updateTranscript(t.id,{analysis:"Analysis failed: "+e.message});
        upM("analysing",false);
      });
    }

    var TAG_COLORS={planning:"#4A4BAE",commercial:"#2D7A65",finance:"#9A7B3E",legal:"#B05A35",site:"#7B3FAE",board:"#2E2F8A"};

    return e("div",null,
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}},
        e("div",null,
          e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Meeting Transcripts"),
          e("p",{style:{fontSize:12,color:"#7278A0"}},"Upload or paste meeting notes. AI extracts action items, decisions, site references and risks automatically.")
        ),
        e("div",{style:{display:"flex",gap:8}},
          e("label",{style:{padding:"8px 16px",background:"#4A4BAE",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",display:"inline-flex",alignItems:"center",gap:6}},
            "📁 Upload File",
            e("input",{type:"file",accept:".txt,.doc,.docx,.pdf,.md,.csv,.xlsx,.xls,.xlsm,.xlsb",onChange:handleFileUpload,style:{display:"none"}})
          )
        )
      ),

      // PASTE TEXT AREA
      e("div",{style:Object.assign({},S.card,{marginBottom:16})},
        e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A",marginBottom:8}},"📋 Paste Meeting Notes"),
        e("textarea",{
          value:ms.pasteText||"",
          onChange:function(ev){upM("pasteText",ev.target.value);},
          placeholder:"Paste meeting transcript, notes or minutes here...",
          style:{width:"100%",minHeight:100,padding:"10px 14px",border:"1px solid #DDE0ED",borderRadius:7,fontSize:12,fontFamily:"DM Sans,sans-serif",resize:"vertical",color:"#2E2F8A"}
        }),
        e("button",{
          onClick:function(){handleTextPaste(ms.pasteText||"");},
          disabled:!(ms.pasteText&&ms.pasteText.trim().length>20),
          style:{marginTop:8,padding:"7px 16px",background:"#2D7A65",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
        },"Add Meeting →")
      ),

      transcripts.length===0&&e("div",{style:{textAlign:"center",padding:"40px 20px",color:"#7278A0",background:"rgba(74,75,174,0.03)",borderRadius:10,border:"1px dashed rgba(74,75,174,0.2)"}},
        e("div",{style:{fontSize:40,marginBottom:12}},"📝"),
        e("div",{style:{fontSize:14,fontWeight:700,color:"#2E2F8A",marginBottom:6}},"No meeting transcripts yet"),
        e("div",{style:{fontSize:12,lineHeight:1.7}},"Upload a .txt, .csv or Excel (.xlsx) file, or paste notes above.",e("br"),"AI will extract action items, decisions and site references automatically.")
      ),

      transcripts.length>0&&e("div",{style:{display:"grid",gridTemplateColumns:"260px 1fr",gap:16}},

        // LEFT — TRANSCRIPT LIST
        e("div",null,
          e("div",{style:{fontSize:10,color:"#7278A0",textTransform:"uppercase",letterSpacing:".1em",fontWeight:700,marginBottom:8}},transcripts.length+" Transcript"+(transcripts.length!==1?"s":"")),
          transcripts.slice().sort(function(a,b){return b.uploadedAt-a.uploadedAt;}).map(function(t){
            var isActive=t.id===activeId;
            return e("div",{key:t.id,
              onClick:function(){upM("activeId",t.id);},
              style:{background:isActive?"#4A4BAE":"#fff",border:"1px solid "+(isActive?"#4A4BAE":"#DDE0ED"),borderRadius:8,padding:"12px 14px",marginBottom:8,cursor:"pointer",transition:"all .15s"}},
              e("div",{style:{fontSize:12,fontWeight:700,color:isActive?"#fff":"#2E2F8A",marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},t.name),
              e("div",{style:{fontSize:10,color:isActive?"rgba(255,255,255,0.6)":"#7278A0",marginBottom:4}},t.date),
              t.dealRef&&e("div",{style:{fontSize:9,color:isActive?"rgba(255,255,255,0.5)":"#9A7B3E",fontWeight:600}},t.dealRef.substring(0,30)+"..."),
              e("div",{style:{display:"flex",gap:4,marginTop:6,alignItems:"center"}},
                t.actionItems&&t.actionItems.length>0&&e("span",{style:{fontSize:9,padding:"2px 6px",background:isActive?"rgba(255,255,255,0.2)":"rgba(45,122,101,0.1)",color:isActive?"#fff":"#2D7A65",borderRadius:10,fontWeight:700}},t.actionItems.length+" actions"),
                t.keyDecisions&&t.keyDecisions.length>0&&e("span",{style:{fontSize:9,padding:"2px 6px",background:isActive?"rgba(255,255,255,0.2)":"rgba(74,75,174,0.1)",color:isActive?"#fff":"#4A4BAE",borderRadius:10,fontWeight:700}},t.keyDecisions.length+" decisions")
              )
            );
          }),
          e("button",{
            onClick:function(){confirmToast("Delete ALL transcripts?",function(){upM("transcripts",[]);},{confirmLabel:"Delete all"});},
            style:{width:"100%",padding:"6px",background:"none",border:"1px solid rgba(176,90,53,0.3)",borderRadius:5,color:"#B05A35",fontSize:10,cursor:"pointer",fontFamily:"DM Sans,sans-serif",marginTop:4}
          },"Clear all")
        ),

        // RIGHT — ACTIVE TRANSCRIPT
        activeTranscript&&e("div",null,
          // Header
          e("div",{style:Object.assign({},S.card,{marginBottom:12})},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}},
              e("div",{style:{flex:1}},
                e("input",{
                  value:activeTranscript.name,
                  onChange:function(ev){updateTranscript(activeTranscript.id,{name:ev.target.value});},
                  style:{fontSize:16,fontWeight:700,color:"#2E2F8A",border:"none",background:"transparent",width:"100%",fontFamily:"DM Sans,sans-serif",outline:"none"}
                }),
                e("div",{style:{fontSize:11,color:"#7278A0",marginTop:2}},activeTranscript.filename+" · "+activeTranscript.date)
              ),
              e("div",{style:{display:"flex",gap:8}},
                e("button",{
                  onClick:function(){analyseTranscript(activeTranscript);},
                  disabled:ms.analysing,
                  style:{padding:"7px 14px",background:ms.analysing?"#8889C8":"linear-gradient(135deg,#2D7A65,#4A4BAE)",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
                },ms.analysing?"⏳ Analysing...":"🧠 Analyse Transcript"),
                e("button",{
                  onClick:function(){deleteTranscript(activeTranscript.id);},
                  style:{padding:"7px 12px",background:"none",border:"1px solid #DDE0ED",borderRadius:6,color:"#B05A35",fontSize:11,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
                },"🗑")
              )
            ),

            // Deal reference field
            e("div",{style:{display:"flex",gap:8,alignItems:"center"}},
              e("span",{style:{fontSize:10,color:"#7278A0",whiteSpace:"nowrap"}},"Deal ref:"),
              e("input",{
                value:activeTranscript.dealRef||"",
                onChange:function(ev){updateTranscript(activeTranscript.id,{dealRef:ev.target.value});},
                placeholder:"Link to site / deal...",
                style:{flex:1,padding:"5px 10px",border:"1px solid #DDE0ED",borderRadius:5,fontSize:11,fontFamily:"DM Sans,sans-serif",color:"#2E2F8A"}
              })
            )
          ),

          // AI ANALYSIS RESULTS - if analysed
          activeTranscript.analysis&&activeTranscript.actionItems&&activeTranscript.actionItems.length>0&&e("div",null,

            // Summary banner
            activeTranscript.summary&&e("div",{style:{background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:8,padding:"12px 16px",marginBottom:12}},
              e("div",{style:{fontSize:10,color:"#4A4BAE",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}},"Meeting Summary"),
              e("div",{style:{fontSize:12,color:"#2E2F8A",lineHeight:1.7}},activeTranscript.summary)
            ),

            // 3-col grid: Actions, Decisions, Sites
            e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}},

              // Action items
              e("div",{style:{background:"rgba(45,122,101,0.05)",border:"1px solid rgba(45,122,101,0.2)",borderRadius:8,padding:"12px 14px"}},
                e("div",{style:{fontSize:10,color:"#2D7A65",fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}},"✓ Action Items"),
                activeTranscript.actionItems.map(function(a,i){
                  return e("div",{key:i,style:{fontSize:11,color:"#2E2F8A",padding:"5px 0",borderBottom:"1px dashed rgba(45,122,101,0.15)",lineHeight:1.5}},a);
                })
              ),

              // Key decisions
              e("div",{style:{background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.2)",borderRadius:8,padding:"12px 14px"}},
                e("div",{style:{fontSize:10,color:"#4A4BAE",fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}},"⚡ Key Decisions"),
                activeTranscript.keyDecisions.map(function(d,i){
                  return e("div",{key:i,style:{fontSize:11,color:"#2E2F8A",padding:"5px 0",borderBottom:"1px dashed rgba(74,75,174,0.15)",lineHeight:1.5}},d);
                })
              ),

              // Site references
              e("div",{style:{background:"rgba(154,123,62,0.05)",border:"1px solid rgba(154,123,62,0.2)",borderRadius:8,padding:"12px 14px"}},
                e("div",{style:{fontSize:10,color:"#9A7B3E",fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}},"📍 Site References"),
                activeTranscript.siteRefs.length>0?activeTranscript.siteRefs.map(function(s,i){
                  return e("div",{key:i,style:{fontSize:11,color:"#2E2F8A",padding:"5px 0",borderBottom:"1px dashed rgba(154,123,62,0.15)",lineHeight:1.5}},s);
                }):e("div",{style:{fontSize:11,color:"#7278A0",fontStyle:"italic"}},"None detected")
              )
            ),

            // Full analysis in scrollable panel
            e("div",{style:Object.assign({},S.card,{padding:0,overflow:"hidden"})},
              e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:"#F0F1FA",borderBottom:"1px solid #DDE0ED"}},
                e("span",{style:{fontSize:11,fontWeight:700,color:"#4A4BAE"}},"Full AI Analysis"),
                e("button",{onClick:function(){
                  var el=document.createElement("textarea");
                  el.value=activeTranscript.analysis;
                  document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);
                  notify("Copied to clipboard");
                },style:{padding:"4px 10px",background:"#4A4BAE",border:"none",borderRadius:4,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"📋 Copy")
              ),
              e("div",{style:{maxHeight:300,overflowY:"auto",padding:"14px 16px"}},
                e("pre",{style:{fontSize:11,lineHeight:1.9,color:"#3A3D6A",whiteSpace:"pre-wrap",fontFamily:"DM Sans,sans-serif",margin:0}},activeTranscript.analysis)
              )
            )
          ),

          // Raw transcript (always visible if not yet analysed, collapsible if analysed)
          e("div",{style:Object.assign({},S.card,{marginTop:12})},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}},
              e("div",{style:{fontSize:11,fontWeight:700,color:"#2E2F8A"}},"Raw Transcript"),
              e("div",{style:{fontSize:10,color:"#7278A0"}},Math.ceil(activeTranscript.text.length/5)+" approx words")
            ),
            e("textarea",{
              value:activeTranscript.text,
              onChange:function(ev){updateTranscript(activeTranscript.id,{text:ev.target.value,analysis:"",actionItems:[],keyDecisions:[],siteRefs:[],summary:""});},
              style:{width:"100%",minHeight:200,padding:"10px 14px",border:"1px solid #DDE0ED",borderRadius:7,fontSize:11,fontFamily:"DM Sans,sans-serif",resize:"vertical",color:"#2E2F8A",lineHeight:1.7}
            }),
            !activeTranscript.analysis&&e("button",{
              onClick:function(){analyseTranscript(activeTranscript);},
              disabled:ms.analysing||!activeTranscript.text,
              style:{marginTop:8,padding:"8px 18px",background:ms.analysing?"#8889C8":"linear-gradient(135deg,#2D7A65,#4A4BAE)",border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
            },ms.analysing?"⏳ Analysing...":"🧠 Analyse This Transcript")
          )
        )
      )
    );
  }
