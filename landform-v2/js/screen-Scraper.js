// ── renderScraper  (params: at, data, mergeRespectingCompletedStages, navTo, setData, up, user)
// Lifted out of Tool; body byte-unchanged. Tool variables passed as explicit
// params; all other names resolve to globals. Loaded before 05-tool.js.
function renderScraper(at, data, mergeRespectingCompletedStages, navTo, setData, up, user){
    var sc2=data.scraper||{};
    var scrResult=sc2.result||null;
    var scrLoading=sc2.loading||false;
    var scrError=sc2.error||"";
    var imported=sc2.imported||false;

    var SOURCES=[
      {name:"Bruton Knowles",url:"https://www.brutonknowles.co.uk/property-search/strategic-land/",hint:"Strategic land listings — open a property, copy text, paste below"},
      {name:"Savills Land",url:"https://www.savills.co.uk/find-a-property/land-and-new-homes/index.html",hint:"UK land for sale — find a listing, copy text, paste below"},
      {name:"Knight Frank",url:"https://www.knightfrank.co.uk/commercial/land-development-for-sale",hint:"Development land — find a listing, copy text, paste below"},
      {name:"Aston Rose",url:"https://www.astonrose.co.uk/properties/land-development/",hint:"London & SE land"},
      {name:"Rightmove Land",url:"https://www.rightmove.co.uk/commercial-property-for-sale/land.html",hint:"All UK land listings"},
      {name:"Zoopla Land",url:"https://www.zoopla.co.uk/commercial/for-sale/?q=land&category=land",hint:"UK land for sale"},
      {name:"Acuitus",url:"https://www.acuitus.co.uk/property-search/?category=land",hint:"Commercial & mixed use land"},
      {name:"Planning Portal",url:"https://www.planningportal.co.uk/",hint:"Search planning applications"},
      {name:"Land Registry",url:"https://www.gov.uk/search-property-information-land-registry",hint:"Check ownership & title"},
      {name:"Flood Map",url:"https://check-long-term-flood-risk.service.gov.uk/postcode",hint:"Check flood risk by postcode"},
    ];

    function doScrape(){
      var url=sc2.url||"";
      var pasted=(sc2.pastedText||"").trim();
      if(!url&&!pasted){up("scraper","error","Please enter a URL or paste listing text");return;}
      up("scraper","loading",true);up("scraper","error","");up("scraper","result",null);up("scraper","imported",false);

      // Send to Apps Script scrape action - it builds the prompt server-side
      var params=new URLSearchParams({
        action:"scrape",
        url:url||"unknown",
        text:pasted.substring(0,2000),
        user:(user&&user.name)||"",
        company:(user&&user.company)||""
      });

      fetch(WEBHOOK+"?"+params.toString())
      .then(function(res){return res.json();})
      .then(function(data2){
        if(data2.status==="ok"&&data2.data){
          up("scraper","result",data2.data);
          logEvent(user,"SCRAPE",{url:url,address:(data2.data&&data2.data.address)||"unknown"});
        } else {
          up("scraper","error",data2.message||"Could not extract data. Try pasting more of the listing text.");
        }
        up("scraper","loading",false);
      })
      .catch(function(err){
        up("scraper","error","Connection failed: "+err.message);
        up("scraper","loading",false);
      });
    }

    

    function doAreaIntel(){
      if(!scrResult)return;
      var addr=scrResult.address||"";
      var pc=scrResult.postcode||"";
      var lCity=scrResult.city||"";
      var acres=scrResult.acreage||"";
      var assetHint=at||"residential";

      up("scraper","areaLoading",true);up("scraper","areaReport","");

      var prompt="You are a UK property development research analyst. Provide a comprehensive AREA INTELLIGENCE REPORT for a development site."+
        "\n\nSite: "+(addr||"Unknown address")+", "+(pc||"unknown postcode")+", "+(lCity||"unknown city")+
        "\nSite size: "+(acres||"unknown")+" acres"+
        "\nAsset type being considered: "+assetHint.toUpperCase()+
        "\n\nProvide the following research in plain text format with clear headers:"+
        "\n\n1. LOCATION OVERVIEW"+
        "\n   - What area/neighbourhood is this in?"+
        "\n   - Character of the area (urban/suburban/rural/regeneration)"+
        "\n   - Recent development activity nearby"+
        "\n\n2. TRANSPORT & CONNECTIVITY"+
        "\n   - Nearest train/tram stations and distance"+
        "\n   - Bus routes serving the area"+
        "\n   - Road connections (A roads, motorway junctions)"+
        "\n   - Cycling infrastructure"+
        "\n   - Walk score / transport score assessment"+
        "\n\n3. UNIVERSITIES & EDUCATION (critical for PBSA)"+
        "\n   - Nearest universities and distance in minutes walk/cycle"+
        "\n   - Student population size"+
        "\n   - PBSA suitability rating (1-10 with reason)"+
        "\n\n4. DEMOGRAPHICS & DEMAND DRIVERS"+
        "\n   - Area demographics (age, income, tenure mix)"+
        "\n   - Employment centres within 30 min commute"+
        "\n   - Major employers in the area"+
        "\n   - Population growth trend"+
        "\n\n5. AMENITIES & LIVEABILITY"+
        "\n   - Retail — supermarkets, town centre, retail parks"+
        "\n   - Healthcare — GP surgeries, hospitals"+
        "\n   - Schools — primary and secondary (Ofsted ratings if known)"+
        "\n   - Leisure — parks, gyms, restaurants"+
        "\n\n6. PLANNING CONTEXT"+
        "\n   - Local Planning Authority and recent housing delivery"+
        "\n   - Is the area in a regeneration zone or enterprise zone?"+
        "\n   - Any known infrastructure projects nearby (HS2, road schemes)?"+
        "\n   - Flood risk assessment"+
        "\n\n7. RENTAL & SALES MARKET"+
        "\n   - Current average rents for 1-bed and 2-bed flats"+
        "\n   - Average house prices in the area"+
        "\n   - Rental yield estimates"+
        "\n   - Vacancy rates and void periods"+
        "\n\n8. SCHEME SUITABILITY SUMMARY"+
        "\n   - BTR suitability: [score 1-10 with reason]"+
        "\n   - PBSA suitability: [score 1-10 with reason]"+
        "\n   - SFH suitability: [score 1-10 with reason]"+
        "\n   - Overall recommendation for this site";

      var params=new URLSearchParams({
        action:"ai",stage:"Area Intel",
        user:(user&&user.name)||"",company:(user&&user.company)||"",
        system:"You are a UK property development research analyst with deep knowledge of UK towns, cities, transport networks, universities and planning policy. Provide detailed, accurate, commercially useful area intelligence. Be specific with distances and facts. Plain text only.",
        prompt:prompt.substring(0,3000)
      });

      fetch(WEBHOOK+"?"+params.toString())
      .then(function(res){return res.json();})
      .then(function(data2){
        var text=data2.result||"Research failed — please try again";
        up("scraper","areaReport",text);
        up("scraper","areaLoading",false);
        logEvent(user,"AREA_INTEL",{address:addr,postcode:pc});
      })
      .catch(function(){
        up("scraper","areaReport","Connection failed — please check your internet connection.");
        up("scraper","areaLoading",false);
      });
    }

    function doAIAutoFill(importedData){
      // Use AI to fill in missing fields based on address/postcode/property type
      var addr=importedData.address||"";
      var pc=importedData.postcode||"";
      var lCity=importedData.city||"";
      var acres=importedData.acreage||"";
      var lpa=importedData.localAuthority||"";
      var planStatus=importedData.planningStatus||"";

      var prompt="You are a UK property development expert. Based on this land listing, estimate the missing values and return ONLY a JSON object."+
        "\n\nListing: "+addr+", "+pc+", "+lCity+". Size: "+acres+" acres. LPA: "+lpa+". Planning: "+planStatus+
        "\n\nReturn JSON with these fields (use null if genuinely unknown):"+
        "{"+
        '"estimatedUnits":number,'+
        '"recommendedDph":number,'+
        '"estimatedBuildPsf":number,'+
        '"estimatedSalePsf":number,'+
        '"exitYieldPct":number,'+
        '"s106PerUnit":number,'+
        '"planningRisk":"low/medium/high",'+
        '"recommendedScheme":"sfh/btr/pbsa",'+
        '"ahPct":number,'+
        '"contamination":"clean/minor/unknown",'+
        '"proximityScore":"excellent/good/fair/poor",'+
        '"transportScore":"excellent/good/fair/poor",'+
        '"ahpct":number'+
        "}";

      var params=new URLSearchParams({
        action:"ai",stage:"AutoFill",
        user:(user&&user.name)||"",company:(user&&user.company)||"",
        system:"You are a UK property development expert. Return ONLY valid JSON. No explanation.",
        prompt:prompt.substring(0,2000)
      });

      fetch(WEBHOOK+"?"+params.toString())
      .then(function(res){return res.json();})
      .then(function(d2){
        var text=d2.result||"";
        var clean=text.replace(/```json/g,"").replace(/```/g,"").trim();
        var js=clean.indexOf("{"); var je=clean.lastIndexOf("}");
        if(js>=0&&je>js)clean=clean.substring(js,je+1);
        try{
          var ai=JSON.parse(clean);
          setData(function(d){
            return mergeRespectingCompletedStages(d,{
              rlv:Object.assign({},d.rlv||{},{
                units:ai.estimatedUnits?ai.estimatedUnits+"":d.rlv&&d.rlv.units||"",
                buildPsf:ai.estimatedBuildPsf?ai.estimatedBuildPsf+"":d.rlv&&d.rlv.buildPsf||"",
                salePsf:ai.estimatedSalePsf?ai.estimatedSalePsf+"":d.rlv&&d.rlv.salePsf||"",
              }),
              sfh:Object.assign({},d.sfh||{},{
                dph:ai.recommendedDph?ai.recommendedDph+"":d.sfh&&d.sfh.dph||"30",
                buildPsf:ai.estimatedBuildPsf?ai.estimatedBuildPsf+"":d.sfh&&d.sfh.buildPsf||"",
                basePsf:ai.estimatedSalePsf?ai.estimatedSalePsf+"":d.sfh&&d.sfh.basePsf||"",
                s106pu:ai.s106PerUnit?ai.s106PerUnit+"":d.sfh&&d.sfh.s106pu||"8000",
                ahPct:ai.ahPct?ai.ahPct+"":d.sfh&&d.sfh.ahPct||"",
              }),
              planning:Object.assign({},d.planning||{},{
                units:ai.estimatedUnits?ai.estimatedUnits+"":d.planning&&d.planning.units||"",
                ahPct:ai.ahPct?ai.ahPct+"":d.planning&&d.planning.ahPct||"",
              }),
              fin:Object.assign({},d.fin||{},{
                exitYield:ai.exitYieldPct?ai.exitYieldPct+"":d.fin&&d.fin.exitYield||"",
              }),
              land:Object.assign({},d.land||{},{
                contamination:ai.contamination||d.land&&d.land.contamination||"",
                proximity:ai.proximityScore||d.land&&d.land.proximity||"",
                transport:ai.transportScore||d.land&&d.land.transport||"",
              }),
              assetType:ai.recommendedScheme||d.assetType||"sfh",
            });
          });
          logEvent(user,"AI_AUTOFILL",{address:addr,units:ai.estimatedUnits,scheme:ai.recommendedScheme});
        }catch(e){}
      })
      .catch(function(){});
    }

    function doImport(){
      if(!scrResult)return;
      var rawCity=(scrResult.city||"").toLowerCase().replace(/\s+/g,"_").replace(/-/g,"_");
      // Also try detecting city from postcode if city field is blank
      var pc2=(scrResult.postcode||"").replace(/\s/g,"").toUpperCase();
      var pc2prefix=pc2.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
      var pcCity=pc2prefix&&window.PC_CITY_MAP&&window.PC_CITY_MAP[pc2prefix[1]]||"";
      var c=rawCity||pcCity;
      var addr=scrResult.address||"";
      var pc=scrResult.postcode||"";
      var acres=scrResult.acreage||"";
      var price=scrResult.askingPrice||"";
      var lpa=scrResult.localAuthority||"";
      var units=scrResult.estimatedUnits||"";
      var agent=scrResult.agent||"";
      var dealType=scrResult.dealType||"sale";
      var devPot=scrResult.developmentPotential||"";
      var planStatus=scrResult.planningStatus||"";
      var constraints=scrResult.constraints||"";
      var desc=scrResult.description||"";

      // Determine scheme type from development potential
      var schemeType="Residential houses";
      var assetGuess=at;
      if(devPot.toLowerCase().indexOf("student")>=0){schemeType="PBSA (Student)";assetGuess="pbsa";}
      else if(devPot.toLowerCase().indexOf("apart")>=0||devPot.toLowerCase().indexOf("flat")>=0){schemeType="Residential apartments";assetGuess="btr";}
      else if(devPot.toLowerCase().indexOf("mixed")>=0){schemeType="Mixed use";}
      else if(devPot.toLowerCase().indexOf("commercial")>=0){schemeType="Industrial/Warehouse";}

      // Estimate units from acres if not provided
      var estUnits=units||"";
      if(!estUnits&&acres){
        var ha=parseFloat(acres)*0.404686;
        estUnits=Math.floor(ha*30)+""; // 30dph default
      }

      setData(function(d){
        return mergeRespectingCompletedStages(d,{
          assetType: assetGuess,
          // Land Appraisal
          land: Object.assign({},d.land||{},{
            address:addr, city:c, acres:acres, price:price,
            agent:agent, dealType:dealType,
            localAuthority:lpa,
            planStatus:planStatus.toLowerCase().indexOf("full")>=0?"full":
                       planStatus.toLowerCase().indexOf("outline")>=0?"outline":
                       planStatus.toLowerCase().indexOf("alloc")>=0?"allocated":"none",
          }),
          // Land Valuation
          rlv: Object.assign({},d.rlv||{},{
            postcode:pc, acres:acres,
            units:estUnits,
            schType:schemeType,
            avgSqft:schemeType.indexOf("PBSA")>=0?"310":"850",
          }),
          // Planning
          planning: Object.assign({},d.planning||{},{
            lpa:lpa,
            units:estUnits,
            status:planStatus.toLowerCase().indexOf("full")>=0?"full":
                   planStatus.toLowerCase().indexOf("outline")>=0?"outline":
                   planStatus.toLowerCase().indexOf("alloc")>=0?"allocated":"none",
          }),
          // SFH
          sfh: Object.assign({},d.sfh||{},{
            acres:acres, city:c,
            dph:"30",
          }),
          // High Rise / BTR
          hra: Object.assign({},d.hra||{},{
            city:c,
          }),
          // Financial Modelling - pre-fill city for market rates
          fin: Object.assign({},d.fin||{}),
          // Property Evaluator
          epe: Object.assign({},d.epe||{},{
            postcode:pc,
            propType:scrResult.propertyType||"",
            streetAddress:addr,
          }),
          // Risk Register - add site-specific risks
          risks: d.risks||RISK_DEFAULTS.map(function(r){return Object.assign({},r);}),
          // Exit - pre-fill city
          exit: Object.assign({},d.exit||{}),
          // Store import metadata
          importedFrom: {
            url:sc2.url||"",
            agent:agent,
            importedAt:new Date().toISOString(),
            description:desc,
            constraints:constraints,
          },
        });
      });
      up("scraper","imported",true);
      logEvent(user,"IMPORT",{
        address:addr,postcode:pc,city:c,acres:acres,
        price:price,agent:agent,
        dealType:dealType,planStatus:planStatus,
        estimatedUnits:estUnits,
        assetType:assetGuess
      });
      // Run AI auto-fill in background
      doAIAutoFill({address:addr,postcode:pc,city:c,acreage:acres,localAuthority:lpa,planningStatus:planStatus});
      // Navigate to dashboard to show the workflow
      setTimeout(function(){navTo("dashboard");},500);
    }

    return e("div",null,
      e("h2",{style:{fontSize:24,fontWeight:800,color:"#2E2F8A",marginBottom:4}},"Land Opportunity Finder"),
      e("p",{style:{fontSize:12,color:"#7278A0",marginBottom:10}},"Find a listing, extract the data, import to pre-fill all stages automatically."),
      e("div",{style:{background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.25)",borderRadius:8,padding:"12px 16px",marginBottom:20,fontSize:12,color:"#2A6A5A",lineHeight:1.9}},
        e("strong",null,"Best method: "),
        "Open the listing on Bruton Knowles, Savills or any agent site. Select all text (Ctrl+A), copy (Ctrl+C), paste into the text box below, click Extract from Text.",e("br"),
        e("span",{style:{color:"#7278A0"}},"Note: The URL button may not work on sites that block automated access — the text paste method always works.")
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Quick Links — Major Land Agents"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}},
          SOURCES.map(function(src){
            return e("div",{key:src.name,onClick:function(){up("scraper","url",src.url);window.open(src.url,"_blank");},style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,padding:"12px 14px",cursor:"pointer"},
              onMouseOver:function(ev){ev.currentTarget.style.borderColor="#4A4BAE";},
              onMouseOut:function(ev){ev.currentTarget.style.borderColor="#DDE0ED";}},
              e("a",{href:src.url,target:"_blank",rel:"noopener noreferrer",
                onClick:function(){up("scraper","url",src.url);window.open(src.url,"_blank");},
                style:{fontSize:12,fontWeight:700,color:"#4A4BAE",textDecoration:"none",display:"block",marginBottom:3}},
                src.name+" ↗"
              ),
              e("div",{style:{fontSize:10,color:"#7278A0",lineHeight:1.4}},src.hint)
            );
          })
        )
      ),
      e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Paste URL to Extract"),
        e("div",{style:{display:"flex",gap:12,alignItems:"flex-end"}},
          e("div",{style:{flex:1,display:"flex",flexDirection:"column",gap:4}},
            e("label",{style:S.label},"Land listing URL"),
            e("input",{value:sc2.url||"",onChange:function(ev){up("scraper","url",ev.target.value);},onKeyDown:function(ev){if(ev.key==="Enter")doScrape();},placeholder:"e.g. https://www.brutonknowles.co.uk/property/...",style:S.input})
          ),
          e("button",{onClick:doScrape,disabled:scrLoading||!sc2.url,style:Object.assign({},S.btn,{flexShrink:0,padding:"9px 20px"})},scrLoading?"⏳ Extracting...":"🔍 Extract Data")
        ),
        scrError&&e("div",{style:{background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.25)",borderRadius:6,padding:"12px 14px",fontSize:12,color:"#B05A35",marginTop:8}},
          e("div",{style:{fontWeight:700,marginBottom:4}},"URL extraction failed"),
          e("div",null,scrError.indexOf("server")>=0||scrError.indexOf("Internal")>=0?
            "The agent website blocked automated access. Use the text method below instead: open the listing, select all text (Ctrl+A), copy (Ctrl+C) and paste into the box below.":
            scrError
          )),
        e("div",{style:{marginTop:14,paddingTop:14,borderTop:"1px solid #DDE0ED"}},
          e("label",{style:Object.assign({},S.label,{marginBottom:8,display:"block"})},"OR — Paste listing text here (from email, website or brochure):"),
          e("textarea",{value:sc2.pastedText||"",onChange:function(ev){up("scraper","pastedText",ev.target.value);},
            placeholder:"Copy and paste the full property description from any land agent website, email circular or PDF brochure. Then click Extract Data above. This works even when the URL cannot be fetched directly.",
            style:{width:"100%",height:130,padding:"10px 12px",border:"1px solid #C8CDE0",borderRadius:6,fontSize:12,fontFamily:"DM Sans,sans-serif",resize:"vertical",outline:"none",color:"#1A1A3E",background:"#fff"}}),
          e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}},
            e("div",{style:{fontSize:10,color:"#A0A4C0"}},"Works with agent emails, Rightmove listings, brochures or any text source."),
            e("button",{
              onClick:function(){
                if(!sc2.pastedText){up("scraper","error","Please paste some listing text first");return;}
                up("scraper","url",sc2.url||"pasted-text");
                doScrape();
              },
              disabled:scrLoading||!sc2.pastedText,
              style:Object.assign({},S.btn,{flexShrink:0,padding:"9px 20px",opacity:(!sc2.pastedText||scrLoading)?0.5:1,cursor:(!sc2.pastedText||scrLoading)?"not-allowed":"pointer"})
            }, scrLoading?"⏳ Extracting...":"📋 Extract from Text")
          )
        )
      ),
      scrResult&&e("div",{style:S.card},
        e("div",{style:S.cardTitle},"Extracted Data"),
        e("div",{style:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}},
          [{l:"Asking Price",v:scrResult.askingPrice?fmt(scrResult.askingPrice):(scrResult.priceType||"POA")},
           {l:"Site Area",v:scrResult.acreage?scrResult.acreage+" acres":"—"},
           {l:"Deal Type",v:scrResult.dealType||"—"},
           {l:"Local Authority",v:scrResult.localAuthority||"—"}].map(function(item){
            return e("div",{key:item.l,style:{background:"#F7F8FC",border:"1px solid #DDE0ED",borderRadius:8,padding:12}},
              e("div",{style:{fontSize:9,color:"#7278A0",textTransform:"uppercase",marginBottom:4}},item.l),
              e("div",{style:{fontSize:14,fontWeight:700,color:"#4A4BAE"}},item.v)
            );
          })
        ),
        e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:8,overflow:"hidden",marginBottom:12}},
          [["Address",scrResult.address],["Postcode",scrResult.postcode],["City",scrResult.city],["Property Type",scrResult.propertyType],["Planning Status",scrResult.planningStatus],["Development Potential",scrResult.developmentPotential],["Agent",scrResult.agent],["Agent Contact",scrResult.agentContact]].filter(function(r){return r[1];}).map(function(row){
            return e("div",{key:row[0],style:{display:"grid",gridTemplateColumns:"160px 1fr",padding:"9px 16px",borderBottom:"1px solid #DDE0ED",fontSize:12,gap:12}},
              e("span",{style:{color:"#7278A0",fontWeight:600}},row[0]),
              e("span",{style:{color:"#2E2F8A"}},row[1])
            );
          })
        ),
        scrResult.description&&e("div",{style:{background:"rgba(74,75,174,0.05)",border:"1px solid rgba(74,75,174,0.15)",borderRadius:8,padding:"12px 16px",fontSize:12,color:"#3A3D6A",lineHeight:1.7,marginBottom:12}},scrResult.description),
        imported?e("div",null,
          e("div",{style:{background:"rgba(45,122,101,0.08)",border:"1px solid rgba(45,122,101,0.25)",borderRadius:8,padding:"14px 16px",fontSize:13,color:"#2D7A65",fontWeight:600,textAlign:"center"},marginBottom:10},
            "✓ Imported — fields pre-filled across all appraisal stages."
          ),
          e("div",{style:{display:"flex",gap:10,marginTop:10}},
            e("button",{onClick:function(){navTo("landworkflow");},style:{flex:1,padding:"11px",background:"#2D7A65",border:"none",borderRadius:7,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
              "→ Open Land Workflow"
            ),
            e("button",{onClick:doAreaIntel,disabled:sc2.areaLoading,style:{flex:1,padding:"11px",background:"#9A7B3E",border:"none",borderRadius:7,color:"#fff",fontSize:13,fontWeight:700,cursor:sc2.areaLoading?"not-allowed":"pointer",fontFamily:"DM Sans,sans-serif",opacity:sc2.areaLoading?0.7:1}},
              sc2.areaLoading?"🔍 Researching Area...":"🔍 Research This Area"
            )
          ),
          sc2.areaReport&&e("div",{style:{marginTop:14,background:"#F8F8FE",border:"1px solid #DDE0ED",borderLeft:"3px solid #9A7B3E",borderRadius:8,overflow:"hidden"}},
            e("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:"1px solid #DDE0ED",background:"rgba(154,123,62,0.06)"}},
              e("div",{style:{fontSize:11,fontWeight:700,color:"#9A7B3E",textTransform:"uppercase",letterSpacing:".1em"}},"Area Intelligence Report — "+(scrResult&&scrResult.city||"Unknown Location")),
              e("button",{
                onClick:function(){
                  var el=document.createElement("textarea");
                  el.value=sc2.areaReport;
                  document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);
                  alert("Copied to clipboard");
                },
                style:{padding:"4px 10px",background:"#9A7B3E",border:"none",borderRadius:4,color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}
              },"📋 Copy")
            ),
            e("div",{style:{maxHeight:500,overflowY:"auto",padding:"16px 20px"}},
              e("pre",{style:{fontSize:12,lineHeight:1.9,color:"#3A3D6A",whiteSpace:"pre-wrap",fontFamily:"DM Sans,sans-serif",margin:0}},sc2.areaReport)
            )
          )
        ):e("button",{onClick:doImport,style:{width:"100%",padding:"11px",background:"#4A4BAE",border:"none",borderRadius:7,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
          "⚡ Import & Pre-fill All Landform Fields"
        )
      )
    );
  }
