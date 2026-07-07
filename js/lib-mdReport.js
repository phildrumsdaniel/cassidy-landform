// ── lib-mdReport ────────────────────────────────────────────────────────────
// A tiny, dependency-free Markdown → React renderer for AI report text. The app
// has no build step and a strict CSP (no CDN libraries), so this is hand-rolled.
// It turns the light Markdown our report prompts now emit (## headings, **bold**,
// - bullets, 1. numbered, | tables |, > callouts) into branded, presentation-grade
// output — and degrades gracefully: plain-text reports (no Markdown at all) still
// render as clean paragraphs. Reused by AIPanel and the Executive Summary so every
// AI report looks the same on screen and in the PDF/print path.

var MD_COL = { ink:"#2E2F8A", body:"#3A3D6A", muted:"#7278A0", accent:"#4A4BAE", rule:"#DDE0ED", head:"#1E1F5C" };

// Inline: **bold**, *italic* / _italic_, `code`. Returns an array of React nodes.
function _mdInline(text){
  text = String(text == null ? "" : text);
  var out = [], key = 0;
  // Split on the earliest of the inline markers, repeatedly.
  var re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/;
  var m;
  while((m = re.exec(text))){
    if(m.index > 0) out.push(text.slice(0, m.index));
    if(m[2] != null || m[3] != null){
      out.push(e("strong",{key:"b"+(key++),style:{fontWeight:800,color:MD_COL.head}}, m[2] != null ? m[2] : m[3]));
    } else if(m[4] != null || m[5] != null){
      out.push(e("em",{key:"i"+(key++),style:{fontStyle:"italic"}}, m[4] != null ? m[4] : m[5]));
    } else if(m[6] != null){
      out.push(e("code",{key:"c"+(key++),style:{fontFamily:"DM Mono,monospace",fontSize:"0.92em",background:"rgba(74,75,174,0.08)",padding:"1px 5px",borderRadius:3}}, m[6]));
    }
    text = text.slice(m.index + m[0].length);
  }
  if(text) out.push(text);
  return out;
}

// A numbered line that is really a SECTION HEADER (e.g. "1. THE MONEY") — short,
// upper-case-dominant, no trailing sentence punctuation. Lets legacy plain reports
// (which number their sections) render with proper headings too.
function _isNumberedHeading(txt){
  if(!txt || txt.length > 64) return false;
  if(/[.!?]$/.test(txt.trim())) return false;
  var letters = txt.replace(/[^A-Za-z]/g, "");
  if(letters.length < 3) return false;
  var upper = txt.replace(/[^A-Z]/g, "").length;
  return (upper / letters.length) >= 0.6;
}

function renderMarkdownReport(md, opts){
  opts = opts || {};
  if(md == null || String(md).trim() === "") return null;
  var serif = !!opts.serif;
  var bodyFont = serif ? "Georgia, 'Times New Roman', serif" : "DM Sans,sans-serif";
  var lines = String(md).replace(/\r/g, "").split("\n");
  var nodes = [], key = 0;
  var i = 0;

  function para(txt){
    return e("p",{key:"p"+(key++),style:{margin:"0 0 12px",fontSize:opts.fontSize||13,lineHeight:1.75,color:MD_COL.body,fontFamily:bodyFont}}, _mdInline(txt));
  }

  while(i < lines.length){
    var line = lines[i];
    var t = line.trim();

    // blank
    if(t === ""){ i++; continue; }

    // horizontal rule
    if(/^([-*_])\1{2,}$/.test(t)){
      nodes.push(e("hr",{key:"hr"+(key++),style:{border:"none",borderTop:"1px solid "+MD_COL.rule,margin:"14px 0"}}));
      i++; continue;
    }

    // heading  #..####
    var h = t.match(/^(#{1,4})\s+(.*)$/);
    if(h){
      var lvl = h[1].length;
      var sizes = {1:20,2:16,3:13.5,4:12};
      nodes.push(e("div",{key:"h"+(key++),style:{
        fontSize:sizes[lvl]||14, fontWeight:800, color:lvl<=2?MD_COL.ink:MD_COL.accent,
        margin:(nodes.length?"18px":"0")+" 0 8px",
        textTransform:lvl>=3?"uppercase":"none", letterSpacing:lvl>=3?".06em":"0",
        paddingBottom:lvl<=2?6:0, borderBottom:lvl<=2?("2px solid "+MD_COL.rule):"none",
        fontFamily:"DM Sans,sans-serif"
      }}, _mdInline(h[2])));
      i++; continue;
    }

    // table:  | a | b |   with a separator row next
    if(/^\|.*\|$/.test(t) && i+1 < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i+1].trim()) && lines[i+1].indexOf("-") >= 0){
      var header = t.replace(/^\||\|$/g,"").split("|").map(function(c){return c.trim();});
      i += 2;
      var rows = [];
      while(i < lines.length && /^\|.*\|$/.test(lines[i].trim())){
        rows.push(lines[i].trim().replace(/^\||\|$/g,"").split("|").map(function(c){return c.trim();}));
        i++;
      }
      nodes.push(e("div",{key:"tw"+(key++),style:{overflowX:"auto",margin:"0 0 14px"}},
        e("table",{style:{borderCollapse:"collapse",width:"100%",fontSize:12,fontFamily:"DM Sans,sans-serif"}},
          e("thead",null,
            e("tr",null, header.map(function(c,ci){
              return e("th",{key:ci,style:{textAlign:ci===0?"left":"right",padding:"7px 10px",background:MD_COL.ink,color:"#fff",fontWeight:700,whiteSpace:"nowrap"}}, _mdInline(c));
            }))
          ),
          e("tbody",null, rows.map(function(r,ri){
            return e("tr",{key:ri,style:{borderBottom:"1px solid "+MD_COL.rule,background:ri%2?"#F8F9FC":"#fff"}},
              r.map(function(c,ci){
                return e("td",{key:ci,style:{textAlign:ci===0?"left":"right",padding:"7px 10px",color:ci===0?MD_COL.head:MD_COL.body,fontWeight:ci===0?600:400}}, _mdInline(c));
              })
            );
          }))
        )
      ));
      continue;
    }

    // blockquote / callout
    if(/^>\s?/.test(t)){
      var q = [];
      while(i < lines.length && /^>\s?/.test(lines[i].trim())){ q.push(lines[i].trim().replace(/^>\s?/,"")); i++; }
      nodes.push(e("div",{key:"q"+(key++),style:{margin:"0 0 14px",padding:"10px 14px",background:"rgba(74,75,174,0.06)",borderLeft:"3px solid "+MD_COL.accent,borderRadius:"0 6px 6px 0",fontSize:12.5,lineHeight:1.7,color:MD_COL.body,fontFamily:bodyFont}}, _mdInline(q.join(" "))));
      continue;
    }

    // unordered list
    if(/^[-*•]\s+/.test(t)){
      var items = [];
      while(i < lines.length && /^[-*•]\s+/.test(lines[i].trim())){
        items.push(lines[i].trim().replace(/^[-*•]\s+/,"")); i++;
      }
      nodes.push(e("ul",{key:"ul"+(key++),style:{margin:"0 0 14px",paddingLeft:0,listStyle:"none"}},
        items.map(function(it,ii){
          return e("li",{key:ii,style:{position:"relative",padding:"0 0 6px 20px",fontSize:opts.fontSize||13,lineHeight:1.7,color:MD_COL.body,fontFamily:bodyFont}},
            e("span",{style:{position:"absolute",left:2,top:1,color:MD_COL.accent,fontWeight:800}},"▸"),
            _mdInline(it)
          );
        })
      ));
      continue;
    }

    // ordered list (with the "numbered heading" heuristic)
    var om = t.match(/^(\d+)[.)]\s+(.*)$/);
    if(om){
      // Heading-style numbered line → render as a section header, then continue.
      if(_isNumberedHeading(om[2])){
        nodes.push(e("div",{key:"nh"+(key++),style:{fontSize:13.5,fontWeight:800,color:MD_COL.accent,margin:(nodes.length?"18px":"0")+" 0 8px",textTransform:"uppercase",letterSpacing:".06em",fontFamily:"DM Sans,sans-serif"}},
          e("span",{style:{color:MD_COL.muted,marginRight:8}}, om[1]+"."), _mdInline(om[2])));
        i++; continue;
      }
      var oitems = [];
      while(i < lines.length){
        var oo = lines[i].trim().match(/^(\d+)[.)]\s+(.*)$/);
        if(!oo || _isNumberedHeading(oo[2])) break;
        oitems.push(oo[2]); i++;
      }
      nodes.push(e("ol",{key:"ol"+(key++),style:{margin:"0 0 14px",paddingLeft:22,fontSize:opts.fontSize||13,lineHeight:1.7,color:MD_COL.body,fontFamily:bodyFont}},
        oitems.map(function(it,ii){ return e("li",{key:ii,style:{padding:"0 0 6px",lineHeight:1.7}}, _mdInline(it)); })
      ));
      continue;
    }

    // paragraph (gather consecutive non-blank, non-structural lines)
    var buf = [t]; i++;
    while(i < lines.length){
      var nx = lines[i].trim();
      if(nx === "" || /^(#{1,4})\s/.test(nx) || /^[-*•]\s/.test(nx) || /^\d+[.)]\s/.test(nx) || /^\|.*\|$/.test(nx) || /^>\s?/.test(nx) || /^([-*_])\1{2,}$/.test(nx)) break;
      buf.push(nx); i++;
    }
    nodes.push(para(buf.join(" ")));
  }

  return e("div",{style:{fontFamily:bodyFont}}, nodes);
}

// Expose to the headless test harness (Node) without breaking the browser global scope.
if(typeof module !== "undefined" && module.exports){
  module.exports = { renderMarkdownReport: renderMarkdownReport, _isNumberedHeading: _isNumberedHeading };
}
