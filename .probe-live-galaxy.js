// 线上站点：只留星系（0 岗位）截图，用于极坐标展开验证
const http = require('http'), https = require('https'), fs = require('fs');
function j(u){return new Promise((res,rej)=>{const m=u.startsWith('https')?https:http;m.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
const URL = process.argv[2] || 'https://junmoxiao526.github.io/qiuzhao-platform/';
const OUT = process.argv[3] || 'live-galaxy-only.png';

const EMPTY = "(function(){jobs=[];switchTab('track');setTrackView('star');})()";
const HIDE  = "(function(){document.querySelectorAll('.star-legend,.star-zoom').forEach(function(e){e.style.display='none';});})()";

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
  await send('Page.navigate',{url:URL+'?cb='+Date.now()},sessionId);
  for(let i=0;i<200;i++){
    const r=await send('Runtime.evaluate',{expression:'typeof jobList!=="undefined" && typeof starLabelStats!=="undefined"',returnByValue:true},sessionId);
    if(r.result&&r.result.value===true) break;
    await new Promise(x=>setTimeout(x,500));
  }
  await new Promise(x=>setTimeout(x,1500));
  await send('Runtime.evaluate',{expression:EMPTY,returnByValue:true},sessionId);
  await new Promise(x=>setTimeout(x,2500));
  await send('Runtime.evaluate',{expression:HIDE,returnByValue:true},sessionId);
  await new Promise(x=>setTimeout(x,800));
  const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);
  fs.writeFileSync(OUT,Buffer.from(shot.data,'base64'));
  console.log('已导出 '+OUT+'   未捕获异常: '+(exs.length?exs.slice(0,3).join(' | '):'（无）'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
