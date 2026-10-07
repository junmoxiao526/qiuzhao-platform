// 验证：① 最内环半径 ② 图例里的总数 ③ 星球渲染开销
const http = require('http'), fs = require('fs');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const BASE = process.argv[2] || 'http://127.0.0.1:8099/index.html';

const SEED = `(function(){
  var stages=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
  var names=['国家电投集团','国家开发银行','中石油','农夫山泉','杭州锦江集团','当纳利亚洲','龙湖集团','寒武纪','X-MOTORS','中国能建安徽院','福特中国','阿迪达斯','零跑汽车','龙旗科技','华勤','中远海运重工','中国外运','镭目科技','卫龙'];
  jobs=[];
  for (var i=0;i<53;i++){
    jobs.push(sanitizeJob({id:'J'+i, company:names[i%names.length]+(i>=names.length?('#'+(i+1)):''), position:'岗位'+i,
      status:stages[i%stages.length], city:'上海', applyDate:'2026-09-01', notes:''}));
  }
  switchTab('track'); setTrackView('star');
})()`;

const CHECK = `(async function(){
  var out={};
  // 最内环半径 + 核心间隙
  var radii={};
  starStars.forEach(function(s){ radii[+s.rx.toFixed(1)]=1; });
  var rs=Object.keys(radii).map(Number).sort(function(a,b){return b-a});
  out.radii=rs;
  out.innermost=rs[rs.length-1];
  // 相邻环间距
  var gaps=[];
  for(var i=0;i<rs.length-1;i++) gaps.push(+(rs[i]-rs[i+1]).toFixed(1));
  out.gaps=gaps;
  // 图例：总数 + 是否还画了圆心徽标
  var lg=document.querySelector('.star-legend');
  out.legendText = lg ? lg.innerText.replace(/\\s+/g,' ').trim().slice(0,150) : null;
  out.legendTotal = lg && lg.querySelector('.sl-total') ? lg.querySelector('.sl-total').innerText.replace(/\\s+/g,'') : null;

  // 星球像素检查：取一颗球，量它明暗两侧的亮度差（证明有昼夜分界）
  var c=document.querySelector('#starCanvasWrap canvas'), g=c.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var st=starStars[0];
  function px(dx,dy){
    var d=g.getImageData(Math.round((st.screenX+dx)*dpr),Math.round((st.screenY+dy)*dpr),1,1).data;
    return 0.2126*d[0]+0.7152*d[1]+0.0722*d[2];
  }
  var R=st.size;
  if (R>=3){
    // 受光侧（左上）vs 背光侧（右下）
    out.planet_lightSide = +px(-R*0.4,-R*0.4).toFixed(1);
    out.planet_darkSide  = +px( R*0.4, R*0.4).toFixed(1);
    out.planet_shading = +(out.planet_lightSide/(out.planet_darkSide||1)).toFixed(2);
  }
  // 圆心是否已空出来（应为星系核球亮度，而非深色 UI 圆饼）
  var wrap=document.getElementById('starCanvasWrap');
  var cx=wrap.clientWidth*0.5, cy=(wrap.clientHeight-46)*0.5;
  var d=g.getImageData(Math.round(cx*dpr),Math.round(cy*dpr),1,1).data;
  out.coreCenter={rgb:[d[0],d[1],d[2]], lum:+(0.2126*d[0]+0.7152*d[1]+0.0722*d[2]).toFixed(1)};

  // 帧率
  out.fps = await new Promise(function(res){
    var n=0,t0=performance.now();
    function tick(){ n++; if(performance.now()-t0<1000) requestAnimationFrame(tick); else res(n); }
    requestAnimationFrame(tick);
  });
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
  await new Promise(x=>setTimeout(x,2500));
  const r=await send('Runtime.evaluate',{expression:CHECK,returnByValue:true,awaitPromise:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,300)):r.result.value);
  console.log('未捕获异常: '+(exs.length?exs.slice(0,4).join(' | '):'（无）'));
  const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  fs.writeFileSync('planet.png',Buffer.from(shot.data,'base64'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
