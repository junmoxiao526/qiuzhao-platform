// 在真实视口尺寸下校验星图布局（1600x950 / 1440x900 / 1280x800 三档）
const http=require('http');
function j(u){return new Promise((res,rej)=>{http.get(u,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)})}
(async()=>{
  const sizes=[[1600,950],[1440,900],[1280,800]];
  const ver=await j('http://127.0.0.1:9222/json/version');
  const ws=new WebSocket(ver.webSocketDebuggerUrl);
  let id=0;const pend=new Map();
  const send=(m,p,s)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});const o={id:i,method:m,params:p||{}};if(s)o.sessionId=s;ws.send(JSON.stringify(o))});
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);m.error?q.rej(new Error(m.error.message)):q.res(m.result)}});
  await new Promise(r=>ws.addEventListener('open',r));
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId); await send('Page.enable',{},sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{localStorage.clear();}catch(e){}'},sessionId);
  let total=0, fails=0;
  for (const [W,H] of sizes){
    await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false},sessionId);
    await send('Page.navigate',{url:'http://127.0.0.1:8099/index.html'},sessionId);
    await new Promise(r=>setTimeout(r,2600));
    const r=await send('Runtime.evaluate',{expression:`(function(){
      var stages=['pending','applied','assessment','exam','ai','interview1','interview2','hr','offer'];
      var counts=[3,5,8,4,6,7,5,4,2]; jobs=[]; var n=0;
      stages.forEach(function(st,si){ for(var i=0;i<counts[si];i++){ n++;
        jobs.push(sanitizeJob({id:'L'+n,company:'公司'+n,position:'岗位'+n,status:st,city:'上海',applyDate:'2026-09-01',notes:''})); } });
      switchTab('track'); setTrackView('star');
      var out=[]; function chk(nm,c,e){ out.push({ok:!!c,nm:nm,detail:e===undefined?'':String(e)}); }
      var sv=document.getElementById('starView'), wrap=document.getElementById('starCanvasWrap');
      var svr=sv.getBoundingClientRect(), wr=wrap.getBoundingClientRect();
      var box=wrap.querySelector('.star-zoom'), zr=box?box.getBoundingClientRect():null;
      var cx=starStars[0].cx, cy=starStars[0].cy;
      chk('星图底部不超出视口', svr.bottom<=window.innerHeight+1, Math.round(svr.bottom)+' vs '+window.innerHeight);
      chk('页面不需要滚动', document.documentElement.scrollHeight<=window.innerHeight+2,
          document.documentElement.scrollHeight+' vs '+window.innerHeight);
      chk('圆心 x = 画布正中', Math.abs(cx-wr.width/2)<1, cx.toFixed(1)+' vs '+(wr.width/2).toFixed(1));
      chk('圆心 y = 画布正中', Math.abs(cy-wr.height/2)<1, cy.toFixed(1)+' vs '+(wr.height/2).toFixed(1));
      chk('缩放控件在视口内', zr && zr.top>=0 && zr.bottom<=window.innerHeight+1 && zr.right<=window.innerWidth+1,
          zr? (Math.round(zr.top)+'~'+Math.round(zr.bottom)+' right='+Math.round(zr.right)) : 'null');
      var hit = zr ? document.elementFromPoint(zr.left+zr.width/2, zr.top+zr.height/2) : null;
      chk('控件未被画布遮挡', hit && hit.tagName==='BUTTON', hit?hit.tagName:'null');
      chk('缩放控件存在且显示 100%', box && box.querySelector('.star-zoom-val').textContent==='100%');
      return {w:window.innerWidth,h:window.innerHeight,warn:window.__errs||[],out:out,
              canvas:Math.round(wr.width)+'x'+Math.round(wr.height),
              center:Math.round(cx)+','+Math.round(cy), scrollH:document.documentElement.scrollHeight};
    })()`,returnByValue:true},sessionId);
    const v=r.result.value;
    console.log('\n视口 '+v.w+'x'+v.h+'  画布 '+v.canvas+'  圆心 '+v.center+'  scrollHeight '+v.scrollH);
    for(const o of v.out){ total++; if(!o.ok) fails++; console.log('  '+(o.ok?'✅':'❌')+' '+o.nm+(o.detail?'  ('+o.detail+')':'')); }
  }
  await send('Target.closeTarget',{targetId}); ws.close();
  console.log('\n布局校验: '+(total-fails)+'/'+total+' 通过'+(fails?'  ❌ 有失败':'  ✅'));
  process.exit(fails?1:0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
