// 验证 ac16 偏低的真实原因：
// 假设：fbm 是按"每条环自己的角度"采样的，环与环之间完全独立，
//       所以跨环的 16px 间隔天然不相关，把整体 ac16 拉低。
// 测法：分别量 (a) 沿同一条环的切向自相关 (b) 跨环的径向自相关。
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const SEED = `(function(){
  var stages=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
  jobs=[];
  for (var i=0;i<53;i++) jobs.push(sanitizeJob({id:'J'+i, company:'公司'+i, position:'岗位'+i,status:stages[i%stages.length],city:'上海',applyDate:'2026-09-01',notes:''}));
  switchTab('track'); setTrackView('star');
})()`;

const CHECK = `(function(){
  var wrap=document.getElementById('starCanvasWrap');
  var c=wrap.querySelector('canvas'), g=c.getContext('2d');
  var dpr=window.devicePixelRatio||1, W=wrap.clientWidth,H=wrap.clientHeight;
  var img=g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr));
  var d=img.data, iw=img.width, ih=img.height;
  function L(x,y){
    x=Math.round(x); y=Math.round(y);
    if(x<0||y<0||x>=iw||y>=ih) return null;
    var i=(y*iw+x)*4;
    return 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2];
  }
  var cx=W*0.5*dpr, cy=(H-46)*0.5*dpr, RR=0.62;
  var radii={};
  starStars.forEach(function(s){ radii[+s.rx.toFixed(1)]=1; });
  var rs=Object.keys(radii).map(Number).sort(function(a,b){return b-a});

  function autocorr(pairs){
    var n=pairs.length; if(n<20) return null;
    var m=0; pairs.forEach(function(p){m+=p[0]+p[1]}); m/=(2*n);
    var v=0; pairs.forEach(function(p){v+=(p[0]-m)*(p[0]-m)+(p[1]-m)*(p[1]-m)}); v/=(2*n);
    if(v<1e-6) return null;
    var s=0; pairs.forEach(function(p){s+=(p[0]-m)*(p[1]-m)}); s/=n;
    return s/v;
  }

  // (a) 切向：同一条环上，沿角度方向相差 16px 弧长
  var tang=[];
  rs.forEach(function(R){
    var arcPerDeg = 2*Math.PI*R*0.81/360 * dpr;
    var dDeg = 16/arcPerDeg;              // 16px 对应的角度差
    for(var a=0;a<360;a+=2){
      for(var dr=-10;dr<=10;dr+=5){
        var r1=(R+dr)*dpr, r2=(R+dr)*dpr;
        var A=a*Math.PI/180, B=(a+dDeg)*Math.PI/180;
        var v1=L(cx+Math.cos(A)*r1, cy+Math.sin(A)*r1*RR);
        var v2=L(cx+Math.cos(B)*r2, cy+Math.sin(B)*r2*RR);
        if(v1!=null&&v2!=null) tang.push([v1,v2]);
      }
    }
  });

  // (b) 径向：跨环方向相差 16px
  var rad=[];
  rs.forEach(function(R){
    for(var a=0;a<360;a+=3){
      var A=a*Math.PI/180;
      var r1=(R)*dpr, r2=(R)*dpr+16;
      var v1=L(cx+Math.cos(A)*r1, cy+Math.sin(A)*r1*RR);
      var v2=L(cx+Math.cos(A)*r2, cy+Math.sin(A)*r2*RR);
      if(v1!=null&&v2!=null) rad.push([v1,v2]);
    }
  });

  // (c) 全盘水平 16px（和之前 .analyze 的口径一致）
  var hz=[];
  for(var y=0;y<ih;y+=2){
    for(var x=0;x<iw-16;x+=3){
      var v1=L(x,y), v2=L(x+16,y);
      if(v1!=null&&v2!=null) hz.push([v1,v2]);
    }
  }

  return JSON.stringify({
    ac16_tangential_alongRing: tang.length? +autocorr(tang).toFixed(3):null, n_tang:tang.length,
    ac16_radial_acrossRings:   rad.length? +autocorr(rad).toFixed(3):null,  n_rad:rad.length,
    ac16_horizontal_whole:     hz.length? +autocorr(hz).toFixed(3):null,    n_hz:hz.length
  },null,1);
})()`;

(async()=>{
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();const exs=[];
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);return}
    if(m.method==='Runtime.exceptionThrown'){const dd=m.params.exceptionDetails;exs.push(((dd.exception&&dd.exception.description)||dd.text||'').split('\n')[0]);}
  });
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId); await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,fobile:false,mobile:false},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:BASE+'?cb='+Date.now()},sessionId);
  for(let i=0;i<120;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true) break;
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(x=>setTimeout(x,1200));
  await send('Runtime.evaluate',{expression:SEED,returnByValue:true},sessionId);
  await new Promise(x=>setTimeout(x,2600));
  const r=await send('Runtime.evaluate',{expression:CHECK,returnByValue:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,300)):r.result.value);
  console.log('未捕获异常: '+(exs.length?exs.slice(0,3).join(' | '):'（无）'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
