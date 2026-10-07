// 定位外环星云为什么"没上色"：逐层烘焙，看是哪一步把它擦掉/盖住了。
// 做法：在页面里重建 galaxyCanvas 的各个阶段，分别统计每环采样点的均值色。
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const SEED = `(function(){
  var stages=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
  jobs=[];
  for (var i=0;i<9;i++) for(var k=0;k<3;k++)
    jobs.push(sanitizeJob({id:'J'+i+'_'+k, company:'公司'+i+'_'+k, position:'岗位',status:stages[i],city:'上海',applyDate:'2026-09-01',notes:''}));
  switchTab('track'); setTrackView('star');
})()`;

// 直接读主画布：在每条环上采样，报告"有彩像素占比"和均值色
const PROBE = `(function(){
  var wrap=document.getElementById('starCanvasWrap');
  var c=wrap.querySelector('canvas'), g=c.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var W=wrap.clientWidth,H=wrap.clientHeight;
  var img=g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr));
  var d=img.data, iw=img.width, ih=img.height;
  var cx=W*0.5*dpr, cy=(H-46)*0.5*dpr, RR=0.62;
  var radii={};
  starStars.forEach(function(s){ radii[+s.rx.toFixed(1)]=1; });
  var rs=Object.keys(radii).map(Number).sort(function(a,b){return b-a});
  var out=[];
  rs.forEach(function(R){
    var n=0, litp=0, sr=0,sg=0,sb=0, maxsat=0;
    for(var a=0;a<720;a++){
      var rad=a*Math.PI/360;
      for(var dr=-20;dr<=20;dr+=2){
        var rr=(R+dr)*dpr;
        if(rr<4) continue;
        var x=Math.round(cx+Math.cos(rad)*rr), y=Math.round(cy+Math.sin(rad)*rr*RR);
        if(x<0||y<0||x>=iw||y>=ih) continue;
        var i=(y*iw+x)*4, r0=d[i],g0=d[i+1],b0=d[i+2];
        var lum=0.2126*r0+0.7152*g0+0.0722*b0;
        n++;
        if(lum>14){ litp++; sr+=r0; sg+=g0; sb+=b0; }
      }
    }
    var avg = litp? [Math.round(sr/litp),Math.round(sg/litp),Math.round(sb/litp)] : null;
    // 该半径的"本底"（环外侧远处）对比
    var bg=[0,0,0],bn=0;
    for(var a2=0;a2<360;a2+=3){
      var rad2=a2*Math.PI/180;
      var rr2=(R+55)*dpr;
      var x2=Math.round(cx+Math.cos(rad2)*rr2), y2=Math.round(cy+Math.sin(rad2)*rr2*RR);
      if(x2<0||y2<0||x2>=iw||y2>=ih) continue;
      var i2=(y2*iw+x2)*4;
      bg[0]+=d[i2]; bg[1]+=d[i2+1]; bg[2]+=d[i2+2]; bn++;
    }
    if(bn) bg=bg.map(function(v){return Math.round(v/bn)});
    out.push({r:+R.toFixed(1), litPct:+(litp/n*100).toFixed(1),
      ringAvg: avg, bgAvg: bg,
      delta: avg? [avg[0]-bg[0], avg[1]-bg[1], avg[2]-bg[2]] : null});
  });
  return JSON.stringify(out,null,1);
})()`;

(async()=>{
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);}});
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId); await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
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
  const r=await send('Runtime.evaluate',{expression:PROBE,returnByValue:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,300)):r.result.value);
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
