// ── renderFlowcharts  (params: data, navTo, setData, stage)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderFlowcharts(data, navTo, setData, stage){

    var FLOWS={
      land:{
        title:"Land Journey",color:"#4A4BAE",icon:"🔍",
        desc:"Find land → value it → landowner negotiation → scheme selection → develop → exit",
        stages:[
          {id:"scraper",label:"Land Finder",icon:"🔍",color:"#4A4BAE",shape:"rect",desc:"Paste URL or listing text. AI extracts all key data and pre-fills every stage."},
          {id:"rlv",label:"Land Valuation",icon:"◆",color:"#4A4BAE",shape:"rect",desc:"Live Land Registry data. Residual land value = GDV minus build costs minus profit."},
          {id:"land",label:"Land Appraisal",icon:"⬟",color:"#4A4BAE",shape:"rect",desc:"Score the site 0-100 across 5 dimensions. Get AI Go/No-Go recommendation."},
          {id:"landworkflow",label:"Land Dev Workflow",icon:"→",color:"#4A4BAE",shape:"rect",desc:"Landowner premium calculator + 6 scheme scenarios with GDV, RLV and best scheme badge."},
          {id:"decision1",label:"Viable?",icon:"◆",color:"#9A7B3E",shape:"diamond",desc:"Is the RLV positive and margin above 15%?"},
          {id:"planning",label:"Planning & Viability",icon:"▲",color:"#7B6CB0",shape:"rect",desc:"NPPF strategy, S106, BNG, affordable housing, fire gateway."},
          {id:"fin",label:"Financial Modelling",icon:"◉",color:"#7B6CB0",shape:"rect",desc:"Full appraisal. Bear/base/bull scenarios. SFH full sales revenue table."},
          {id:"dd",label:"Due Diligence",icon:"◈",color:"#7B6CB0",shape:"rect",desc:"25-item checklist across legal, technical, planning and commercial."},
          {id:"risks",label:"Risk Register",icon:"⬡",color:"#7B6CB0",shape:"rect",desc:"RAG-rated risks. Red risks must be mitigated before proceeding."},
          {id:"exit",label:"Investment Exit",icon:"◆",color:"#2D7A65",shape:"rect",desc:"Forward fund, plot sales, HoTs generator, Investment Memo generator."},
          {id:"summary",label:"Executive Summary",icon:"📄",color:"#1E1F5C",shape:"oval",desc:"AI generates full deal brief for investors. Copy to clipboard."},
        ]
      },
      property:{
        title:"Property Journey",color:"#2D7A65",icon:"🏠",
        desc:"Find existing building → evaluate → demolition costs → scheme options → develop → exit",
        stages:[
          {id:"epe",label:"Property Evaluator",icon:"🏠",color:"#2D7A65",shape:"rect",desc:"Postcode → auto city. Value property + garden. 3-way valuation + mortgage table."},
          {id:"epeworkflow",label:"EPE Workflow",icon:"→",color:"#2D7A65",shape:"rect",desc:"Step 1 summary → Step 2 demolition costs → Step 3 six scheme options → Step 4 journey forward."},
          {id:"decision2",label:"Best scheme?",icon:"◆",color:"#9A7B3E",shape:"diamond",desc:"Which scheme gives the best residual land value on this plot?"},
          {id:"sfh",label:"SFH Appraisal",icon:"🏡",color:"#7B6CB0",shape:"rect",desc:"House type mix table. Affordable housing viability. Full sales revenue breakdown."},
          {id:"planning",label:"Planning & Viability",icon:"▲",color:"#7B6CB0",shape:"rect",desc:"NPPF strategy, S106, planning history, officer objections."},
          {id:"fin",label:"Financial Modelling",icon:"◉",color:"#7B6CB0",shape:"rect",desc:"Full appraisal waterfall. Sensitivity analysis."},
          {id:"exit",label:"Investment Exit",icon:"◆",color:"#2D7A65",shape:"rect",desc:"Plot sales, HoTs, Investment Memo."},
          {id:"summary",label:"Executive Summary",icon:"📄",color:"#1E1F5C",shape:"oval",desc:"AI deal brief."},
        ]
      },
      recovery:{
        title:"Planning Recovery",color:"#B05A35",icon:"⚖",
        desc:"Refused PiP → identify reason → acquisition strategy → letters & case law → consent → exit",
        stages:[
          {id:"recovery",label:"Refusal Analysis",icon:"⚖",color:"#B05A35",shape:"rect",desc:"Select refusal reason type. Paste decision notice. AI identifies best recovery route."},
          {id:"decision3",label:"Refusal type?",icon:"◆",color:"#9A7B3E",shape:"diamond",desc:"Outside settlement / Highways / Design / Environment / AH Viability / Principle"},
          {id:"recovery",label:"Recovery Routes",icon:"⚖",color:"#B05A35",shape:"rect",desc:"Specific routes shown per refusal reason — appeal, resubmit, promote, option."},
          {id:"recovery",label:"Knockdown Acquisition",icon:"⚖",color:"#9A7B3E",shape:"rect",desc:"Discount = safety margin. Option agreement recommended — control without buying."},
          {id:"recovery",label:"Case Law + Letters",icon:"⚖",color:"#7B6CB0",shape:"rect",desc:"8 key court decisions. 6 AI-generated letter templates. Copy to clipboard."},
          {id:"decision4",label:"Planning granted?",icon:"◆",color:"#9A7B3E",shape:"diamond",desc:"Has consent been secured after recovery attempt?"},
          {id:"planning",label:"Planning & Viability",icon:"▲",color:"#7B6CB0",shape:"rect",desc:"Continue development journey."},
          {id:"fin",label:"Financial Modelling",icon:"◉",color:"#7B6CB0",shape:"rect",desc:"Include recovery costs in appraisal."},
          {id:"exit",label:"Investment Exit",icon:"◆",color:"#2D7A65",shape:"rect",desc:"Sell with planning uplift or develop and sell."},
        ]
      },
    };

    var selFlow=data.selectedFlow||"land";
    var flow=FLOWS[selFlow]||FLOWS.land;

    function FlowNode(props){
      var s=props.stage;
      var active=stage===s.id;
      var isDiamond=s.shape==="diamond";
      var isOval=s.shape==="oval";
      var tipS=useState(false); var showTip=tipS[0]; var setShowTip=tipS[1];

      var baseStyle={
        position:"relative",
        cursor:s.id&&!s.id.startsWith("decision")?"pointer":"default",
        transition:"all .15s",
      };

      if(isDiamond){
        return e("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:0}},
          e("div",{
            onMouseEnter:function(){setShowTip(true);},
            onMouseLeave:function(){setShowTip(false);},
            style:{
              width:110,height:60,background:s.color,
              clipPath:"polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              display:"flex",alignItems:"center",justifyContent:"center",
              cursor:"default",
            }},
            e("div",{style:{fontSize:10,fontWeight:700,color:"#fff",textAlign:"center",padding:"0 20px",lineHeight:1.3}},s.label)
          ),
          showTip&&e("div",{style:{position:"absolute",top:70,left:"50%",transform:"translateX(-50%)",background:"#fff",border:"1px solid #DDE0ED",borderRadius:6,padding:"8px 12px",fontSize:11,color:"#3A3D6A",zIndex:100,width:200,boxShadow:"0 4px 12px rgba(0,0,0,0.15)",lineHeight:1.5}},s.desc)
        );
      }

      if(isOval){
        return e("div",{
          onClick:function(){if(s.id)navTo(s.id);},
          onMouseEnter:function(){setShowTip(true);},
          onMouseLeave:function(){setShowTip(false);},
          style:{position:"relative",background:s.color,borderRadius:30,padding:"10px 20px",cursor:"pointer",border:"3px solid "+(active?"#EDE84A":"transparent")}},
          e("div",{style:{fontSize:11,fontWeight:700,color:"#fff",textAlign:"center"}},s.icon+" "+s.label),
          showTip&&e("div",{style:{position:"absolute",top:50,left:"50%",transform:"translateX(-50%)",background:"#fff",border:"1px solid #DDE0ED",borderRadius:6,padding:"8px 12px",fontSize:11,color:"#3A3D6A",zIndex:100,width:200,boxShadow:"0 4px 12px rgba(0,0,0,0.15)",lineHeight:1.5}},s.desc)
        );
      }

      return e("div",{
        onClick:function(){if(s.id&&!s.id.startsWith("decision"))navTo(s.id);},
        onMouseEnter:function(){setShowTip(true);},
        onMouseLeave:function(){setShowTip(false);},
        style:{
          position:"relative",
          background:active?"rgba(237,232,74,0.15)":s.color,
          border:"2px solid "+(active?"#EDE84A":s.color),
          borderRadius:6,
          padding:"10px 14px",
          cursor:"pointer",
          minWidth:140,
          textAlign:"center",
        },
        onMouseOver:function(ev){ev.currentTarget.style.opacity="0.85";},
        onMouseOut:function(ev){ev.currentTarget.style.opacity="1";},
      },
        e("div",{style:{fontSize:16,marginBottom:3}},s.icon),
        e("div",{style:{fontSize:11,fontWeight:700,color:"#fff",lineHeight:1.3}},s.label),
        active&&e("div",{style:{fontSize:9,color:"#EDE84A",marginTop:2}},"● HERE"),
        showTip&&e("div",{style:{position:"absolute",top:70,left:"50%",transform:"translateX(-50%)",background:"#fff",border:"1px solid #DDE0ED",borderRadius:6,padding:"8px 12px",fontSize:11,color:"#3A3D6A",zIndex:100,width:200,boxShadow:"0 4px 12px rgba(0,0,0,0.15)",lineHeight:1.5}},
          s.desc,e("br"),e("span",{style:{color:s.color,fontWeight:700,fontSize:10}},"Click to open →")
        )
      );
    }

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Process Flowcharts"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:20}},"Interactive journey maps — hover any stage for details, click to navigate there. Download Word versions below."),

      // Journey selector
      e("div",{style:{display:"flex",gap:10,marginBottom:20}},
        Object.keys(FLOWS).map(function(key){
          var f=FLOWS[key];
          var active=selFlow===key;
          return e("button",{key:key,
            onClick:function(){setData(function(d){return Object.assign({},d,{selectedFlow:key});});},
            style:{padding:"10px 20px",background:active?f.color:"#F7F8FC",border:"2px solid "+(active?f.color:"#DDE0ED"),color:active?"#fff":"#3A3D6A",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
            f.icon+" "+f.title
          );
        })
      ),

      // Flow description
      e("div",{style:{background:flow.color+"15",border:"1px solid "+flow.color+"40",borderRadius:8,padding:"10px 16px",fontSize:12,color:"#3A3D6A",marginBottom:20}},
        e("strong",null,flow.icon+" "+flow.title+": "),flow.desc
      ),

      // Interactive flowchart
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:10,padding:24,marginBottom:20,overflowX:"auto"}},
        e("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:0,minWidth:600}},
          flow.stages.map(function(s,i){
            var isDiamond=s.shape==="diamond";
            return e("div",{key:i,style:{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}},
              e(FlowNode,{stage:s}),
              i<flow.stages.length-1&&e("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:0}},
                e("div",{style:{width:2,height:16,background:"#C0C4D8"}}),
                e("div",{style:{width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:"8px solid #C0C4D8"}}),
                isDiamond&&e("div",{style:{display:"flex",gap:40,marginTop:4}},
                  e("span",{style:{fontSize:10,color:"#2D7A65",fontWeight:700}},"YES ▼"),
                  e("span",{style:{fontSize:10,color:"#B05A35",fontWeight:700}},"NO →")
                )
              )
            );
          })
        )
      ),

      // Download Word docs
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Download Process Flowchart Documents (Word)"),
        e("div",{style:{fontSize:11,color:"#7278A0",marginBottom:14}},"Full detailed flowcharts with colour-coded shapes, decision diamonds and branch arrows. Open in Word and print for use alongside the tool."),
        e("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
          [
            {title:"Doc 1 — Master Overview",desc:"All three journeys on one page. Shows where routes split and converge."},
            {title:"Doc 2 — Land Journey",desc:"Land Finder → RLV → Appraisal → Workflow → Scheme selection in detail."},
            {title:"Doc 3 — Property Journey",desc:"Property Evaluator → EPE Workflow → Demolition → Schemes."},
            {title:"Doc 4 — Develop to Exit",desc:"Planning → Financial Modelling → DD → Risk → Exit in detail."},
            {title:"Doc 5 — Planning Recovery",desc:"Refused PiP → 6 refusal routes → Case law → Letters → Recovery."},
          ].map(function(doc){
            return e("div",{key:doc.title,style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,padding:"14px 16px"}},
              e("div",{style:{fontSize:12,fontWeight:700,color:"#2E2F8A",marginBottom:4}},doc.title),
              e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.5,marginBottom:8}},doc.desc),
              e("div",{style:{fontSize:10,color:"#A0A4C0",fontStyle:"italic"}},"Download from the session files above — ask your administrator for the shared link.")
            );
          })
        )
      ),

      // Two screen tip
      e("div",{style:{background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.15)",borderRadius:8,padding:"14px 16px"}},
        e("div",{style:{fontSize:12,fontWeight:700,color:"#4A4BAE",marginBottom:6}},"💡 Two-Screen Workflow Tip"),
        e("div",{style:{fontSize:12,color:"#3A3D6A",lineHeight:1.8}},
          "Screen 1: Open the Word flowchart document (or this interactive chart) to follow the process map.",e("br"),
          "Screen 2: Work through the Landform tool stages, clicking each stage as you go.",e("br"),
          "The flowchart tells you what to do next. The tool does the calculations. Hover any stage above for a quick reminder of what to fill in."
        )
      )
    );
  }
