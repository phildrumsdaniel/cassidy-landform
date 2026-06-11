function AccessGate(props){
  var modeS=useState("login"); var mode=modeS[0]; var setMode=modeS[1];  // "login" | "register"
  var ns=useState(""); var name=ns[0]; var setName=ns[1];
  var cs=useState(""); var company=cs[0]; var setCompany=cs[1];
  var emS=useState(""); var email=emS[0]; var setEmail=emS[1];
  var ps=useState(""); var pwd=ps[0]; var setPwd=ps[1];
  // v9.25 — Password visibility toggle (eye icon)
  var pvS=useState(false); var showPwd=pvS[0]; var setShowPwd=pvS[1];
  var es=useState(""); var error=es[0]; var setError=es[1];
  var ls=useState(false); var loading=ls[0]; var setLoading=ls[1];

  if(new Date()>EXPIRY){
    return e("div",{style:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F4F5F9",fontFamily:"DM Sans,sans-serif"}},
      e("div",{style:{background:"#fff",border:"1px solid #DDE0ED",borderRadius:16,padding:"48px 40px",maxWidth:400,textAlign:"center"}},
        e("img",{src:"data:image/webp;base64,"+LOGO,style:{width:100,marginBottom:20}}),
        e("h2",{style:{color:"#2E2F8A",marginBottom:12}},"Access Unavailable"),
        e("p",{style:{color:"#7278A0",fontSize:14}},"Please contact Cassidy Group to arrange access.")
      )
    );
  }

  async function submitLogin(){
    if(!email.trim()||email.indexOf("@")<0){setError("Valid email required");return;}
    if(!pwd){setError("Password required");return;}
    setLoading(true);setError("");
    try{
      var params=new URLSearchParams({action:"login",email:email.trim().toLowerCase(),password:pwd});
      var res=await fetch(WEBHOOK+"?"+params.toString());
      var data=await res.json();
      if(data.status==="ok"){
        // Persist session
        try{
          localStorage.setItem("landform_user",JSON.stringify({
            userId:data.userId, email:data.email, name:data.name, company:data.company, token:data.token,
            loginAt:Date.now()
          }));
        }catch(e){}
        props.onLogin({userId:data.userId,email:data.email,name:data.name,company:data.company,token:data.token});
      } else {
        setError(data.message||"Login failed");
      }
    }catch(err){setError("Connection error — check internet");}
    setLoading(false);
  }

  async function submitRegister(){
    if(!name.trim()){setError("Name required");return;}
    if(!email.trim()||email.indexOf("@")<0){setError("Valid email required");return;}
    if(pwd.length<6){setError("Password must be 6+ characters");return;}
    setLoading(true);setError("");
    try{
      var params=new URLSearchParams({action:"register",email:email.trim().toLowerCase(),password:pwd,name:name.trim(),company:company.trim()});
      var res=await fetch(WEBHOOK+"?"+params.toString());
      var data=await res.json();
      if(data.status==="ok"){
        try{
          localStorage.setItem("landform_user",JSON.stringify({
            userId:data.userId, email:data.email, name:data.name, company:data.company, token:data.token,
            loginAt:Date.now()
          }));
        }catch(e){}
        props.onLogin({userId:data.userId,email:data.email,name:data.name,company:data.company,token:data.token});
      } else {
        setError(data.message||"Registration failed");
      }
    }catch(err){setError("Connection error — check internet");}
    setLoading(false);
  }

  function onSubmit(){
    if(mode==="login") submitLogin();
    else submitRegister();
  }

  return e("div",{style:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#1E1F5C,#2E2F8A)",fontFamily:"DM Sans,sans-serif",padding:20}},
    e("div",{style:{background:"#fff",borderRadius:16,padding:"40px 36px",maxWidth:440,width:"100%",boxShadow:"0 8px 40px rgba(0,0,0,0.25)"}},
      e("div",{style:{textAlign:"center",marginBottom:24}},
        e("img",{src:"data:image/webp;base64,"+LOGO,alt:"Cassidy Group",style:{width:120,height:"auto",marginBottom:14}}),
        e("h1",{style:{color:"#2E2F8A",fontWeight:800,fontSize:18,marginBottom:4}},"Land & Development Intelligence"),
        e("p",{style:{color:"#7278A0",fontSize:12}},mode==="login"?"Sign in to access your deals from any device":"Create your account — deals sync across all devices")
      ),

      // Tab switcher
      e("div",{style:{display:"flex",gap:0,marginBottom:20,borderBottom:"2px solid #F0F1FA"}},
        e("div",{onClick:function(){setMode("login");setError("");},style:{flex:1,textAlign:"center",padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",color:mode==="login"?"#2E2F8A":"#A0A4C0",borderBottom:"2px solid "+(mode==="login"?"#4A4BAE":"transparent"),marginBottom:-2}},"Sign In"),
        e("div",{onClick:function(){setMode("register");setError("");},style:{flex:1,textAlign:"center",padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",color:mode==="register"?"#2E2F8A":"#A0A4C0",borderBottom:"2px solid "+(mode==="register"?"#4A4BAE":"transparent"),marginBottom:-2}},"Register")
      ),

      e("div",{style:{display:"flex",flexDirection:"column",gap:12}},
        mode==="register"&&e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
          e("label",{style:S.label},"Your Name"),
          e("input",{value:name,onChange:function(ev){setName(ev.target.value);},placeholder:"e.g. Phil Daniel",style:S.input})
        ),
        mode==="register"&&e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
          e("label",{style:S.label},"Company (optional)"),
          e("input",{value:company,onChange:function(ev){setCompany(ev.target.value);},placeholder:"e.g. Cassidy Group",style:S.input})
        ),
        e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
          e("label",{style:S.label},"Email"),
          e("input",{type:"email",value:email,onChange:function(ev){setEmail(ev.target.value);},placeholder:"you@example.com",style:S.input,autoComplete:"email"})
        ),
        e("div",{style:{display:"flex",flexDirection:"column",gap:4}},
          e("label",{style:S.label},"Password"+(mode==="register"?" (6+ characters)":"")),
          // v9.25 — Password field with eye toggle (tap to show/hide what's being typed)
          e("div",{style:{position:"relative"}},
            e("input",{
              type:showPwd?"text":"password",
              value:pwd,
              onChange:function(ev){setPwd(ev.target.value);},
              onKeyDown:function(ev){if(ev.key==="Enter")onSubmit();},
              placeholder:mode==="register"?"Choose a password":"Your password",
              style:Object.assign({},S.input,{borderColor:error?"#B05A35":"#C8CDE0",paddingRight:42}),
              autoComplete:mode==="login"?"current-password":"new-password"
            }),
            e("button",{
              type:"button",
              onClick:function(){setShowPwd(!showPwd);},
              title:showPwd?"Hide password":"Show password",
              "aria-label":showPwd?"Hide password":"Show password",
              style:{
                position:"absolute",
                right:8,
                top:"50%",
                transform:"translateY(-50%)",
                background:"transparent",
                border:"none",
                cursor:"pointer",
                padding:"6px 8px",
                fontSize:16,
                lineHeight:1,
                color:"#7278A0",
                fontFamily:"DM Sans,sans-serif"
              }
            }, showPwd?"🙈":"👁")
          )
        ),
        error&&e("div",{style:{background:"rgba(176,90,53,0.08)",border:"1px solid rgba(176,90,53,0.3)",borderRadius:6,padding:"10px 14px",fontSize:12,color:"#B05A35"}},error),
        e("button",{onClick:onSubmit,disabled:loading,style:{padding:12,background:loading?"#8889C8":"#4A4BAE",border:"none",borderRadius:7,color:"#fff",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"DM Sans,sans-serif"}},
          loading ? (mode==="login"?"Signing in...":"Creating account...") : (mode==="login"?"Sign In →":"Create Account →")
        )
      ),

      // Helper text bottom
      e("div",{style:{textAlign:"center",marginTop:18,fontSize:11,color:"#7278A0"}},
        mode==="login"
          ? e("span",null,"New here? ",e("a",{onClick:function(){setMode("register");setError("");},style:{color:"#4A4BAE",cursor:"pointer",textDecoration:"underline",fontWeight:700}},"Create an account"))
          : e("span",null,"Already registered? ",e("a",{onClick:function(){setMode("login");setError("");},style:{color:"#4A4BAE",cursor:"pointer",textDecoration:"underline",fontWeight:700}},"Sign in"))
      ),

      e("p",{style:{textAlign:"center",fontSize:11,color:"#A0A4C0",marginTop:18}},"Cassidy Group Ltd © 2026"),
      e("p",{style:{textAlign:"center",fontSize:10,color:"#C0C4D8",marginTop:4}},"Built by Phil Daniel")
    )
  );
}


// ── TOOL COMPONENT ──────────────────────────────────────────────────────────
