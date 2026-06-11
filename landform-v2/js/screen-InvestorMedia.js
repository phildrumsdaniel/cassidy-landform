// ── renderInvestorMedia (params: dealId, upi, ipt, lbl, data, user)
// Lifted out of Tool; body unchanged. Loaded before 05-tool.js.
function renderInvestorMedia(dealId, upi, ipt, lbl, data, user){
    var inv = data.investor || {};
    var mediaList = inv.media || [];

    // Auto-fetch on first visit if empty
    if(!inv._mediaLoaded && !inv._mediaLoading && user && user.userId){
      upi("_mediaLoading",true);
      // For now, media is part of the share endpoint — there's no separate list
      // We'll add a separate list endpoint if needed; for v9.2, fetch via share load
      upi("_mediaLoaded",true);
      upi("_mediaLoading",false);
    }

    function handleFile(file, kind){
      if(!file) return;
      if(file.size > 5*1024*1024){
        alert("File too large — max 5MB. (Apps Script upload limit). For larger files, use a YouTube/Vimeo embed.");
        return;
      }
      var reader = new FileReader();
      reader.onload = function(ev){
        upi("_uploading",true);
        var base64 = ev.target.result;
        fetch(WEBHOOK, {
          method:"POST",
          headers:{"Content-Type":"text/plain;charset=utf-8"},
          body:JSON.stringify({
            action:"upload_media",
            userId:user.userId,
            dealId:dealId,
            kind:kind,
            title:file.name,
            mimeType:file.type,
            base64Data:base64
          })
        })
        .then(function(r){return r.json();})
        .then(function(d){
          upi("_uploading",false);
          if(d && d.status==="ok"){
            var newMedia = (inv.media||[]).concat([{
              mediaId:d.mediaId, kind:kind, title:file.name,
              driveUrl:d.driveUrl, embedUrl:d.embedUrl
            }]);
            upi("media",newMedia);
            alert("✓ Uploaded: "+file.name);
          } else {
            alert("Upload failed: "+((d&&d.message)||"unknown error"));
          }
        })
        .catch(function(err){
          upi("_uploading",false);
          alert("Upload error — file may be too large for backend (5MB max).");
        });
      };
      reader.readAsDataURL(file);
    }

    function addVideoEmbed(){
      var url = window.prompt("Paste YouTube or Vimeo URL:");
      if(!url) return;
      var title = window.prompt("Title for this video:","Site video");
      upi("_uploading",true);
      fetch(WEBHOOK+"?"+new URLSearchParams({
        action:"upload_media",
        userId:user.userId,
        dealId:dealId,
        kind:"video_embed",
        title:title||"Video",
        embedUrl:url
      }).toString())
      .then(function(r){return r.json();})
      .then(function(d){
        upi("_uploading",false);
        if(d && d.status==="ok"){
          var newMedia = (inv.media||[]).concat([{
            mediaId:d.mediaId, kind:"video_embed", title:title,
            embedUrl:d.embedUrl
          }]);
          upi("media",newMedia);
        } else {
          alert("Failed: "+((d&&d.message)||"unknown error"));
        }
      })
      .catch(function(){
        upi("_uploading",false);
        alert("Network error");
      });
    }

    return e("div",null,
      e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}},
        e("div",null,
          e("h3",{style:{fontSize:16,fontWeight:800,color:"#1E1F5C",marginBottom:2}},"Media library"),
          e("div",{style:{fontSize:11,color:"#7278A0"}},"Photos, videos, and supporting documents shown to investors when they view your share links")
        )
      ),

      // Upload buttons
      e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:18}},
        e("label",{style:{background:"#fff",border:"2px dashed #4A4BAE",borderRadius:10,padding:"18px 16px",textAlign:"center",cursor:"pointer",display:"block"}},
          e("input",{type:"file",accept:"image/*",style:{display:"none"},onChange:function(ev){handleFile(ev.target.files[0],"photo");}}),
          e("div",{style:{fontSize:28,marginBottom:6}},"🖼"),
          e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A",marginBottom:3}},"Upload Photo"),
          e("div",{style:{fontSize:10,color:"#7278A0"}},"JPG / PNG · max 5MB")
        ),
        e("div",{onClick:addVideoEmbed,style:{background:"#fff",border:"2px dashed #2D7A65",borderRadius:10,padding:"18px 16px",textAlign:"center",cursor:"pointer"}},
          e("div",{style:{fontSize:28,marginBottom:6}},"🎬"),
          e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A",marginBottom:3}},"Embed Video"),
          e("div",{style:{fontSize:10,color:"#7278A0"}},"YouTube / Vimeo link")
        ),
        e("label",{style:{background:"#fff",border:"2px dashed #9A7B3E",borderRadius:10,padding:"18px 16px",textAlign:"center",cursor:"pointer",display:"block"}},
          e("input",{type:"file",accept:".pdf,.doc,.docx,.xls,.xlsx",style:{display:"none"},onChange:function(ev){handleFile(ev.target.files[0],"document");}}),
          e("div",{style:{fontSize:28,marginBottom:6}},"📄"),
          e("div",{style:{fontSize:12,fontWeight:800,color:"#2E2F8A",marginBottom:3}},"Upload Document"),
          e("div",{style:{fontSize:10,color:"#7278A0"}},"PDF / Word · max 5MB")
        )
      ),

      inv._uploading && e("div",{style:{padding:"12px 14px",background:"rgba(74,75,174,0.08)",border:"1px solid rgba(74,75,174,0.3)",borderRadius:6,fontSize:11,color:"#4A4BAE",marginBottom:14}},"⟳ Uploading..."),

      // Gallery
      mediaList.length === 0 && e("div",{style:{background:"rgba(74,75,174,0.06)",border:"1px dashed rgba(74,75,174,0.3)",borderRadius:10,padding:"24px",textAlign:"center"}},
        e("div",{style:{fontSize:32,marginBottom:8}},"📸"),
        e("div",{style:{fontSize:13,fontWeight:700,color:"#2E2F8A",marginBottom:6}},"No media uploaded yet"),
        e("div",{style:{fontSize:11,color:"#7278A0",lineHeight:1.6,maxWidth:380,margin:"0 auto"}},"Upload site photos, embed a drone tour video, attach planning docs. Investors see all of this when they open your share link.")
      ),
      mediaList.length > 0 && e("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}},
        mediaList.map(function(m){
          return e("div",{key:m.mediaId,style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:10}},
            m.kind==="photo" && e("img",{src:m.driveUrl,alt:m.title,style:{width:"100%",height:140,objectFit:"cover",borderRadius:5,marginBottom:8,background:"#F7F8FC"}}),
            m.kind==="video_embed" && e("div",{style:{position:"relative",paddingBottom:"56.25%",height:0,marginBottom:8,borderRadius:5,overflow:"hidden",background:"#000"}},
              e("iframe",{src:m.embedUrl,style:{position:"absolute",top:0,left:0,width:"100%",height:"100%",border:0},allowFullScreen:true,title:m.title})
            ),
            m.kind==="document" && e("div",{style:{padding:"24px 12px",textAlign:"center",background:"#F7F8FC",borderRadius:5,marginBottom:8}},
              e("div",{style:{fontSize:36}},"📄"),
              e("div",{style:{fontSize:10,color:"#7278A0",marginTop:4}},"Document")
            ),
            e("div",{style:{fontSize:11,fontWeight:700,color:"#1E1F5C",marginBottom:2,wordBreak:"break-word"}},m.title||"Untitled"),
            e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",letterSpacing:".05em"}},m.kind.replace("_"," ")),
            m.driveUrl && e("a",{href:m.driveUrl,target:"_blank",style:{fontSize:10,color:"#4A4BAE",textDecoration:"underline",display:"inline-block",marginTop:4}},"Open in Drive →")
          );
        })
      )
    );
  }
