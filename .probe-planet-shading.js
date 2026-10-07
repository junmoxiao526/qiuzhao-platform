// 在**精确的星球圆心**上验证行星渲染三要素。
// 关键：不从截图猜球心（会选到邻居球的最亮像素），直接用 starStars 的屏幕坐标。
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

const CHECK = `(function(){
  var wrap=document.getElementById('starCanvasWrap');
  var c=wrap.querySelector('canvas'), g=c.getContext('2d');
  var dpr=window.devicePixelRatio||1;
  var W=wrap.clientWidth,H=wrap.clientHeight;
  var img=g.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr));
  var d=img.data, iw=img.width;
  function L(x,y){
    x=Math.round(x*dpr); y=Math.round(y*dpr);
    if(x<0||y<0||x>=iw||y>=img.height) return null;
    var i=(y*iw+x)*4;
    return 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2];
  }
  function RGB(x,y){
    x=Math.round(x*dpr); y=Math.round(y*dpr);
    if(x<0||y<0||x>=iw||y>=img.height) return null;
    var i=(y*iw+x)*4; return [d[i],d[i+1],d[i+2]];
  }
  // 排除太小的球（<3px 画不出行星细节）
  var list = starStars.filter(function(s){ return s.size >= 3.5; });
  var rows=[], okShade=0, okDir=0, okAtmo=0;
  list.forEach(function(s){
    var R=s.size, o=R*0.42;
    var light=L(s.screenX-o, s.screenY-o);   // 受光侧（左上）
    var dark =L(s.screenX+o, s.screenY+o);   // 背光侧（右下）
    if(light==null||dark==null) return;
    // 球内梯度：沿一条对角线的亮度极差
    var vals=[];
    for(var k=-Math.floor(R);k<=Math.floor(R);k++){
      var v=L(s.screenX+k*0.7, s.screenY+k*0.7);
      if(v!=null) vals.push(v);
    }
    var sd=0;
    if(vals.length>2){
      var m=vals.reduce(function(a,b){return a+b},0)/vals.length;
      sd=Math.sqrt(vals.reduce(function(a,b){return a+(b-m)*(b-m)},0)/vals.length);
    }
    // 大气边缘：轮廓外 1.5px 一圈的蓝偏
    var rimB=0, rimN=0;
    for(var a=0;a<360;a+=20){
      var rad=a*Math.PI/180;
      var p=RGB(s.screenX+Math.cos(rad)*(R+1.6), s.screenY+Math.sin(rad)*(R+1.6));
      if(p){ rimB += (p[2]-p[0]); rimN++; }
    }
    rimB = rimN? rimB/rimN : 0;
    var ratio = light/(dark||1);
    if(sd>6) okShade++;
    if(ratio>1.2) okDir++;
    if(rimB>2) okAtmo++;
    rows.push({size:+R.toFixed(1), light:+light.toFixed(0), dark:+dark.toFixed(0),
               ratio:+ratio.toFixed(2), gradSD:+sd.toFixed(1), rimBlue:+rimB.toFixed(1)});
  });
  return JSON.stringify({
    tested: rows.length, okShade: okShade, okDir: okDir, okAtmo: okAtmo,
    sample: rows.slice(0,12)
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
  const r=await send('Runtime.evaluate',{expression:CHECK,returnByValue:true},sessionId);
  console.log(r.exceptionDetails?('异常: '+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description).slice(0,300)):r.result.value);
  console.log('未捕获异常: '+(exs.length?exs.slice(0,4).join(' | '):'（无）'));
  await send('Target.closeTarget',{targetId}); ws.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
