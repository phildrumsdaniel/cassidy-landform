function Inp(props){
  return e("div",{style:{display:"flex",flexDirection:"column",gap:4,gridColumn:props.full?"span 2":""}},
    e("label",{style:S.label},props.label),
    e("input",{type:props.type||"text",value:props.value||"",onChange:function(ev){props.onChange(ev.target.value);},placeholder:props.placeholder||"",style:S.input})
  );
}

function Sel(props){
  return e("div",{style:{display:"flex",flexDirection:"column",gap:4,gridColumn:props.full?"span 2":""}},
    e("label",{style:S.label},props.label),
    e("select",{value:props.value||"",onChange:function(ev){props.onChange(ev.target.value);},style:S.select},
      (props.options||[]).map(function(o){
        var val=typeof o==="object"?o.value:o;
        var lbl=typeof o==="object"?o.label:o;
        return e("option",{key:val,value:val},lbl||"Select...");
      })
    )
  );
}

function CitySelect(props){
  // Get all cities including any user-added ones
  var allCities=Object.keys(MKT).sort();
  var val=props.value||"";
  var isKnown=val&&MKT[val.toLowerCase().replace(/\s+/g,"_")];
  var displayVal=val?cityName(val):val;

  function handleChange(rawInput){
    var trimmed=rawInput.trim();
    if(!trimmed){props.onChange("");return;}
    // Normalise: lowercase, underscores for spaces
    var key=trimmed.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
    // If known city (exact or normalised match) use its key
    var exactMatch=allCities.find(function(c){return c===key||cityName(c).toLowerCase()===trimmed.toLowerCase();});
    if(exactMatch){props.onChange(exactMatch);return;}
    // New city — add to MKT with estimated values based on regional patterns
    var isNorthern=/manchester|liverpool|leeds|sheffield|hull|newcastle|sunderland|durham|blackpool|preston|bolton|wigan|oldham|rochdale|salford|stockport/i.test(trimmed);
    var isMidlands=/birmingham|coventry|nottingham|leicester|derby|stoke|wolverhampton|walsall|solihull|worcester|hereford|shrewsbury|telford/i.test(trimmed);
    var isSouthWest=/bristol|bath|exeter|taunton|plymouth|truro|bournemouth|poole|dorchester|salisbury|swindon|gloucester|cheltenham/i.test(trimmed);
    var isSouthEast=/london|guildford|brighton|crawley|maidstone|tunbridge|reading|oxford|cambridge|windsor|slough|watford/i.test(trimmed);
    var btr=isSouthEast?1800:isSouthWest?820:isMidlands?900:isNorthern?1100:850;
    var buildCost=isSouthEast?220:isSouthWest?190:isMidlands?185:isNorthern?175:182;
    var yld=isSouthEast?0.045:isSouthWest?0.050:isMidlands?0.049:isNorthern?0.048:0.050;
    var landVal=isSouthEast?5000000:isSouthWest?1000000:isMidlands?900000:isNorthern?800000:850000;
    // Add to MKT
    MKT[key]={btr:btr,pbsa:Math.round(btr*0.55),yield:yld,land:landVal,build:buildCost,custom:true};
    // Rebuild CITIES
    CITIES.length=0;
    Object.keys(MKT).forEach(function(c){CITIES.push(c);});
    props.onChange(key);
    // Save to localStorage for persistence
    try{
      var custom=JSON.parse(localStorage.getItem("cassidy_custom_cities")||"{}");
      custom[key]={btr:btr,pbsa:Math.round(btr*0.55),yield:yld,land:landVal,build:buildCost,label:trimmed,custom:true};
      localStorage.setItem("cassidy_custom_cities",JSON.stringify(custom));
    }catch(e){}
  }

  return e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
    e("label",{style:S.label},props.label||"City / Market"),
    e("div",{style:{position:"relative"}},
      e("input",{
        type:"text",
        value:displayVal,
        list:"city-datalist-"+Math.abs(props.label||"").length,
        onChange:function(ev){handleChange(ev.target.value);},
        onBlur:function(ev){
          // On blur, if user typed something not in list, treat as new city
          var v=ev.target.value.trim();
          if(v&&!MKT[val])handleChange(v);
        },
        placeholder:"Type city or town name...",
        style:Object.assign({},S.input,{paddingRight:isKnown?"36px":"10px"})
      }),
      isKnown&&e("span",{style:{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:10,color:"#2D7A65",fontWeight:700,pointerEvents:"none"}},"✓"),
      !isKnown&&val&&e("span",{style:{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:9,color:"#9A7B3E",fontWeight:700,pointerEvents:"none"}},"NEW")
    ),
    e("datalist",{id:"city-datalist-"+Math.abs(props.label||"").length},
      allCities.map(function(c){return e("option",{key:c,value:cityName(c)});})
    ),
    val&&!isKnown&&e("div",{style:{fontSize:10,color:"#9A7B3E",marginTop:2}},"New city added with estimated market data — check figures in Financial Modelling")
  );
}

