// 验证"星球更真实"：在精确球心上量表面纹理
// 判据：① 球内除了整体的明暗梯度外，还有**局部起伏**（去掉低频趋势后的高频变化）
//       ② 精灵图缓存生效（同一阶段色只建一次）
const http = require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const SEED = `(function(){
  var stages=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
  var names=['国家电投集团','国家开发银行','中石油','农夫山泉','杭州锦江集团','当纳利亚洲','龙湖集团','寒武纪','X-MOTORS','中国能建安徽院','福特中国','阿迪达斯','零跑汽车','龙旗科技','华勤','中远海运重工','中国外运','镭目科技','卫龙'];
  jobs=[];
  for (var i=0;i<53;i++) jobs.push(sanitizeJob({id:'J'+i, company:names[i%names.length], position:'岗位'+i,status:stages[i%stages.length],city:'上海',applyDate:'2026-09-01',notes:''}));
  switchTab('track'); setTrackView('star');
})()`;

const CHECK = `(function(){
  var wrap=document.getElementById('starCanvasWrap');
  var c=wrap.querySelector('canvas'), g=c.getContext('2d');
  var dpr=window.devicePixelRatio||1, W=wrap.clientWidth,H=wrap.clientHeight;
  var img=g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr));
  var d=img.data, iw=img.width;
  function L(x,y){
    x=Math.round(x*dpr); y=Math.round(y*dpr);
    if(x<0||y<0||x>=iw||y>=img.height) return null;
    var i=(y*iw+x)*4; return 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2];
  }
  var list=starStars.filter(function(s){return s.size>=5;});
  var rows=[], withDetail=0;
  list.forEach(function(s){
    var R=s.size, vals=[];
    // 在球内按网格采样，算"残差"：减去沿光照方向的线性趋势后剩下的起伏
    var pts=[];
    for(var dy=-R*0.75; dy<=R*0.75; dy+=Math.max(1,R/6)){
      for(var dx=-R*0.75; dx<=R*0.75; dx+=Math.max(1,R/6)){
        if(dx*dx+dy*dy > (R*0.8)*(R*0.8)) continue;
        var v=L(s.screenX+dx, s.screenY+dy);
        if(v!=null) pts.push({dx:dx,dy:dy,v:v});
      }
    }
    if(pts.length<8) return;
    // 拟合 v ≈ a + b*dx + c*dy（光照梯度），残差标准差就是"表面纹理"
    var n=pts.length, Sx=0,Sy=0,Sv=0,Sxx=0,Sxy=0,Syy=0,Sxv=0,Syv=0;
    pts.forEach(function(p){Sx+=p.dx;Sy+=p.dy;Sv+=p.v;Sxx+=p.dx*p.dx;Sxy+=p.dx*p.dy;Syy+=p.dy*p.dy;Sxv+=p.dx*p.v;Syv+=p.dy*p.v;});
    var den=(Sxx*n-Sx*Sx)*(Syy*n-Sy*Sy)-(Sxy*n-Sx*Sy)*(Sxy*n-Sx*Sy);
    var res=0;
    if(Math.abs(den)>1e-6){
      var b1=((Sxv*n-Sx*Sv)*(Syy*n-Sy*Sy)-(Sxy*n-Sx*Sy)*(Syv*n-Sy*Sv))/den;
      var b2=((Syv*n-Sy*Sv)*(Sxx*n-Sx*Sx)-(Sxy*n-Sx*Sy)*(Sxv*n-Sx*Sv))/den;
      var a0=(Sv-b1*Sx-b2*Sy)/n;
      var acc=0;
      pts.forEach(function(p){var pred=a0+b1*p.dx+b2*p.dy; acc+=(p.v-pred)*(p.v-pred);});
      res=Math.sqrt(acc/n);
    }
    if(res>4) withDetail++;
    rows.push({size:+R.toFixed(1), residual:+res.toFixed(1)});
  });
  var res = rows.map(function(r){return r.residual});
  res.sort(function(a,b){return a-b});
  return JSON.stringify({
    tested: rows.length,
    withSurfaceDetail: withDetail,
    residual_median: res.length? +res[Math.floor(res.length/2)].toFixed(1):0,
    residual_min: res.length? +res[0].toFixed(1):0,
    residual_max: res.length? +res[res.length-1].toFixed(1):0,
    spriteCacheSize: (typeof planetSpriteCache!=='undefined'&&planetSpriteCache)? planetSpriteCache.size : 'n/a'
  },null,1);
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
  const r=await send('Runtime.evaluate',{expression:CHECK,returnByValue:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,300)):r.result.value);
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
