// 严格验证：把星系与星球分开测
//   A. 空数据（0 岗位）→ 画面里只剩星系，测到的就是星系本身
//   B. 50 岗位 → 再测一次，确认星球叠加后星系仍可见（对比而非绝对）
//   C. 缩放跟随：用真实的 starZoomApi + starViewXform
const http = require('http'), fs = require('fs');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';

const EMPTY = `(function(){ jobs=[]; switchTab('track'); setTrackView('star'); })()`;

const FILL = `(function(){
  var stages=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
  var names=['国家电投集团','国家开发银行','中石油','农夫山泉','杭州锦江集团','当纳利亚洲','龙湖集团','寒武纪','X-MOTORS','中国能建安徽院','福特中国','阿迪达斯','零跑汽车','龙旗科技','华勤','中远海运重工','中国外运','镭目科技','卫龙'];
  jobs=[];
  for (var i=0;i<50;i++){
    jobs.push(sanitizeJob({id:'J'+i, company:names[i%names.length]+(i>=names.length?('#'+(i+1)):''), position:'岗位'+i,
      status:stages[i%stages.length], city:'上海', applyDate:'2026-09-01', notes:''}));
  }
  switchTab('track'); setTrackView('star');
})()`;

const STAT = `(function(){
  var wrap=document.getElementById('starCanvasWrap');
  var c=wrap.querySelector('canvas'), g=c.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var W=wrap.clientWidth,H=wrap.clientHeight;
  var d=g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr)).data;
  var n=0,tot=0,sum=0,mx=0;
  for (var i=0;i<d.length;i+=4){
    var l=0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2];
    tot++; sum+=l; if(l>mx)mx=l; if(l>12)n++;
  }
  return JSON.stringify({coverage:+(n/tot*100).toFixed(2), avg:+(sum/tot).toFixed(2), max:Math.round(mx)});
})()`;

// 方位角起伏（只看星系盘、排除星球色块）：仅统计"低饱和"像素
const ANGULAR = `(function(){
  var wrap=document.getElementById('starCanvasWrap');
  var c=wrap.querySelector('canvas'), g=c.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var W=wrap.clientWidth,H=wrap.clientHeight;
  var img=g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr));
  var d=img.data, iw=img.width;
  var cx=W*0.5*dpr, cy=(H-46)*0.5*dpr, RR=0.62;
  var NA=72, bins=new Array(NA).fill(0), cnt=new Array(NA).fill(0);
  var maxr=Math.min(W,H)*0.52*dpr;
  for (var y=0;y<img.height;y+=2){
    for (var x=0;x<img.width;x+=2){
      var idx=(y*iw+x)*4;
      var r=d[idx],gg=d[idx+1],b=d[idx+2];
      var l=0.2126*r+0.7152*gg+0.0722*b;
      if (l<=14) continue;
      var mx=Math.max(r,gg,b), mn=Math.min(r,gg,b);
      if (mx>0 && (mx-mn)/mx > 0.42) continue;   // 排除星球彩球
      var dx=x-cx, dy=(y-cy)/RR;
      var dist=Math.sqrt(dx*dx+dy*dy)/maxr;
      if (dist<0.22||dist>0.98) continue;
      var a=(Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2);
      var bi=Math.floor(a/(Math.PI*2)*NA);
      bins[bi]+=l; cnt[bi]++;
    }
  }
  var prof=bins.map(function(v,i){return cnt[i]?v/cnt[i]:0});
  var mean=prof.reduce(function(a,b){return a+b},0)/NA;
  var sd=Math.sqrt(prof.reduce(function(a,b){return a+(b-mean)*(b-mean)},0)/NA);
  return JSON.stringify({mean:+mean.toFixed(2), sd:+sd.toFixed(2),
    cv:+(sd/(mean||1)*100).toFixed(1), min:+Math.min.apply(null,prof).toFixed(2), max:+Math.max.apply(null,prof).toFixed(2)});
})()`;

const ZOOM = `(async function(){
  var out={};
  function cov(){
    var wrap=document.getElementById('starCanvasWrap');
    var c=wrap.querySelector('canvas'), g=c.getContext('2d');
    var dpr=window.devicePixelRatio||1;
    var W=wrap.clientWidth,H=wrap.clientHeight;
    var d=g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr)).data;
    var n=0,tot=0;
    for (var i=0;i<d.length;i+=4*13){
      tot++;
      if (0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2] > 12) n++;
    }
    return +(n/tot*100).toFixed(1);
  }
  out.api = typeof starZoomApi==='object' && starZoomApi ? Object.keys(starZoomApi) : null;
  out.scale100 = cov();
  starZoomApi.in(); starZoomApi.in();
  await new Promise(r=>setTimeout(r,800));
  out.afterZoomIn = cov(); out.xformIn = JSON.parse(JSON.stringify(starViewXform));
  starZoomApi.reset();
  await new Promise(r=>setTimeout(r,800));
  out.afterReset = cov(); out.xformReset = JSON.parse(JSON.stringify(starViewXform));
  return JSON.stringify(out,null,1);
})()`;

(async()=>{
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();const exs=[];
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{
    const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result);return}
    if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails;exs.push(((d.exception&&d.exception.description)||d.text||'').split('\n')[0]);}
  });
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Network.enable',{},sessionId);
  await send('Network.setCacheDisabled',{cacheDisabled:true},sessionId);
  await send('Emulation.setDeviceMetricsOverride',{width:1680,height:959,deviceScaleFactor:1,mobile:false},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  await send('Page.navigate',{url:BASE+'?cb='+Date.now()},sessionId);
  for(let i=0;i<120;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true) break;
    await new Promise(x=>setTimeout(x,400));
  }
  await new Promise(x=>setTimeout(x,1200));

  async function ev(expr,awaitP){
    const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:!!awaitP},sessionId);
    if(r.exceptionDetails) return '异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,200);
    return r.result.value;
  }

  // ---- A. 空数据：只剩星系 ----
  console.log('=== A. 空数据（0 岗位）——画面里只有星系 ===');
  await ev(EMPTY);
  await new Promise(x=>setTimeout(x,2200));
  console.log('  亮度: ' + await ev(STAT));
  console.log('  角向起伏: ' + await ev(ANGULAR));
  let shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  fs.writeFileSync('galaxy-empty.png',Buffer.from(shot.data,'base64'));

  // ---- B. 50 岗位 ----
  console.log('\n=== B. 50 岗位——星系 + 星球 ===');
  await ev(FILL);
  await new Promise(x=>setTimeout(x,2500));
  console.log('  亮度: ' + await ev(STAT));

  // ---- C. 缩放跟随 ----
  console.log('\n=== C. 缩放跟随 ===');
  console.log(await ev(ZOOM,true));
  shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  fs.writeFileSync('galaxy-zoom.png',Buffer.from(shot.data,'base64'));

  console.log('\n未捕获异常: ' + (exs.length ? '\n  '+exs.slice(0,5).join('\n  ') : '（无）'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
