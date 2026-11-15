// Exercise timers, next-target advice, adding an exercise mid-workout — the exact scenarios asked for, strict iPhone SE simulation.
// 1) "Lancer l'exercice" starts the timer; a 5:00 target turns amber after 5:00, red after 5:30, keeps counting;
//    2 min timed + 3 min waiting + 4 min timed = 6:00 of exercise time in the summary and in History, also after an offline relaunch.
// 2) advice + next target for: all sets done (top of range / inside range), exercise interrupted, load changed between sets;
//    the next workout is pre-filled with that same target.
// 3) add an exercise compatible with the profile and equipment, see the time it adds, time it, find it in History; today only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {devices}=require('playwright');const BR=require('./browser.js');const IOS=require('./iosinit.js');
const root=path.join(__dirname,'..'),base='/Duo-fit/',FILES=['index.html','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
(async()=>{
const server=http.createServer((req,res)=>{const route=new URL(req.url,'http://x').pathname,name=route===base?'index.html':route.slice(base.length);
  if(!route.startsWith(base)||!FILES.includes(name)){res.writeHead(404);return res.end()}
  res.setHeader('Content-Type',name.endsWith('html')?'text/html; charset=utf-8':name.endsWith('js')?'application/javascript':name.endsWith('png')?'image/png':'application/manifest+json');
  res.end(fs.readFileSync(path.join(root,name)))});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+base;
const b=await BR.launch(),ctx=await b.newContext({...BR.dev('iPhone SE'),locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);
let p=await ctx.newPage();p.setDefaultTimeout(8000);const errs=[];const watch=()=>p.on('pageerror',e=>BR.noise(e.message)||errs.push(e.message));watch();
const T0=Date.UTC(2026,10,16,9);await p.clock.install({time:T0});await p.clock.pauseAt(T0+1000); // time only moves when the test says so
await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
const E=(f,a)=>p.evaluate(f,a),txt=async()=>(await p.textContent('#v')).replace(/[  ]/g,' ');
const tap=loc=>loc.evaluate(el=>el.click()),accept=()=>tap(p.locator('#action-accept'));
const type=(sel,v)=>p.locator(sel).evaluate((el,v)=>{el.focus();el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}))},v);
const card=i=>p.locator('#v .c:not(.wuc)').filter({has:p.locator('[data-row]')}).nth(i);
const fit=()=>E(()=>document.documentElement.scrollWidth<=innerWidth);
await E(()=>{const pf=S.d.M.pf;pf.var='fix';pf.back=false;pf.inc={DB:2,M:5,C:2.5,SM:2.5};save();U.pick='A';go()});

// ===== 1. Timers =====
await tap(p.locator('#v button',{hasText:'Commencer la séance'}));
ok('1. Nothing is timed until you start it',await E(()=>cur().xr==null&&Object.keys(cur().xt).length===0));
{const c0=await card(0).textContent();ok('1. Each exercise shows "▶ Lancer l\'exercice" with its target',c0.includes("Lancer l'exercice")&&(await p.locator('.xt.x0').count())>=6,c0.slice(0,120))}
ok('1. iPhone SE: session screen fits (warm-up card, timer buttons)',await fit());
// a 5:00 target on exercise 2: 3 sets × 36 s + 2 rests × 96 s = 300 s
await E(()=>{const e=cur().pl[1];e[1]=3;e[2]=8;e[3]=12;e[4]=96;go()});
ok('1. (setup) exercise 2 target = 5:00',await E(()=>Math.round(xPlan(xkey(1)))===300));
await tap(card(1).locator('.xt.x0'));
ok('1. Touching "Lancer l\'exercice" starts it',await E(()=>cur().xr===xkey(1))&&(await card(1).locator('[data-xk]').textContent()).includes('0:00 / 5:00'));
const st=async()=>E(()=>{const el=document.querySelector(`[data-xk="${xkey(1)}"]`),lb=document.querySelector(`[data-xb="${xkey(1)}"]`);return{t:el.querySelector('.xv').textContent,c:['xok','xwarn','xover'].find(z=>el.classList.contains(z)),l:lb.textContent}});
await p.clock.runFor(300e3);let s=await st();ok('1. 5:00 → still green, "dans le temps prévu"',s.t==='5:00'&&s.c==='xok'&&s.l==='dans le temps prévu',JSON.stringify(s));
await p.clock.runFor(1e3);s=await st();ok('1. 5:01 → amber, "dépassement ≤ 10 %"',s.t==='5:01'&&s.c==='xwarn'&&s.l.includes('≤ 10'),JSON.stringify(s));
await p.clock.runFor(29e3);s=await st();ok('1. 5:30 → still amber',s.t==='5:30'&&s.c==='xwarn',JSON.stringify(s));
await p.clock.runFor(1e3);s=await st();ok('1. 5:31 → red, "dépassement > 10 %"',s.t==='5:31'&&s.c==='xover'&&s.l.includes('> 10'),JSON.stringify(s));
await p.clock.runFor(60e3);s=await st();ok('1. …and it keeps counting (6:31)',s.t==='6:31'&&s.c==='xover',JSON.stringify(s));
await tap(card(1).locator('.xbt'));const frozen=await E(()=>xMs(xkey(1)));await p.clock.runFor(30e3);
ok('1. ⏸ Pause stops it',await E(f=>cur().xr==null&&xMs(xkey(1))===f,frozen));
await tap(p.locator('#v >> text=Abandonner'));await accept();

// ===== 1b. 2 min + 3 min waiting + 4 min = 6:00, with an offline relaunch in the middle =====
await E(()=>{U.pick='A';go()});await tap(p.locator('#v button',{hasText:'Commencer la séance'}));
const t0=await E(()=>Date.now());
await tap(card(0).locator('.xt.x0'));await p.clock.runFor(60e3);
await type('#w0_0','40');await type('#r0_0','10');await tap(p.locator('[data-row="0-0"] button'));
ok('1b. Validating a set does not start or stop anything by itself (still exercise 1)',await E(()=>cur().xr===xkey(0)));
await p.clock.runFor(60e3);await tap(card(0).locator('.xbt'));
ok('1b. Exercise 1: 2:00 timed, then stopped',await E(()=>Math.floor(xMs(xkey(0))/1000)===120&&cur().xr==null));
await p.clock.runFor(180e3);
await tap(card(2).locator('.xt.x0'));await p.clock.runFor(120e3);
await type('#w2_0','7,5');await type('#r2_0','14');await tap(p.locator('[data-row="2-0"] button'));
// airplane mode + relaunch while exercise 3 is being timed
await BR.offline(ctx,true);await p.reload();await p.waitForTimeout(150);
ok('1b. Offline relaunch: the running exercise timer is still running with its time',await E(()=>!!cur()&&cur().xr===xkey(2)&&Math.floor(xMs(xkey(2))/1000)>=120));
await p.clock.runFor(120e3);await tap(card(2).locator('.xbt'));
const sums=await E(()=>({a:Math.floor(xMs(xkey(0))/1000),b:Math.floor(xMs(xkey(2))/1000),wall:elapsedSeconds(cur())}));
ok('1b. 2:00 + 4:00 timed, 9:00 on the global clock',sums.a===120&&sums.b===240&&sums.wall===540,JSON.stringify(sums));
await tap(p.locator('#v button',{hasText:'Terminer la séance'}));
ok('1b. Finish dialog shows 06:00 (exercise time)',(await p.textContent('#action-detail')).startsWith('06:00'),await p.textContent('#action-detail'));
await accept();let tx=await txt();
ok('1b. Summary (offline): "Temps d\'exercice 06:00", global clock 09:00 shown apart',tx.includes("Temps d'exercice 06:00")&&tx.includes('chrono 09:00'),tx.match(/⏱[^·]*·[^·]*/)?.[0]);
const lg=await E(()=>S.d.M.logs.at(-1));ok('1b. Saved: 360 s of exercise time, 540 s stopwatch',lg.durSec===360&&lg.clock===540,JSON.stringify({d:lg.durSec,c:lg.clock}));
await E(()=>{U.sum=null;U.tab='hist';go()});tx=await txt();
ok('1b. History (offline): 06:00, with time per exercise',tx.includes('06:00')&&tx.includes("Temps d'exercice 06:00")&&(await p.locator('.history-entry details .xt').count())===2);
await p.reload();await p.waitForTimeout(150);await E(()=>{U.tab='hist';go()});
ok('1b. History after another offline relaunch: still 06:00',(await txt()).includes("Temps d'exercice 06:00"));
await BR.offline(ctx,false);await p.reload();await p.waitForTimeout(150);await E(()=>{U.tab='hist';go()});
ok('1b. Back online: still 06:00',(await txt()).includes("Temps d'exercice 06:00"));

// ===== 2. Advice and next target =====
const run=async(sets,{stop=false}={})=>{await E(()=>{S.d.M.logs=[];U.tab='today';U.pick='A';go();start('A',0);xRun(xkey(0));save();go()});
  for(const [j,[w,r]] of sets.entries()){await type(`#w0_${j}`,String(w).replace('.',','));await type(`#r0_${j}`,String(r));await tap(p.locator(`[data-row="0-${j}"] button`))}
  if(stop)await tap(card(1).locator('.xt.x0'));
  const during=await card(0).locator('.coach').textContent().catch(()=>'');const lc=stop?during:'';
  await tap(p.locator('#v button',{hasText:'Terminer la séance'}));await accept();
  const sum=await p.locator('.nxr').first().textContent();
  await E(()=>{U.sum=null;U.pick='A';go()});
  const next=await E(()=>{const e=P.M.A.ex[0],g=sug('ms',e,'A');return{w:g.w,t:g.t}});
  const pre=await E(()=>{start('A',0);const w=cur().ex[0][0].w;writeSessionEnd(null);clearView();go();return w});
  return{during,lc,sum,next,pre}};
let r=await run([[40,12],[40,12],[40,12]]);
ok('2a. All sets at the top (40 kg × 12): 45 kg is a >10 % jump → keep 40 kg, 15 reps',r.during.includes('Garde 40 kg et vise 15 reps')&&r.during.includes('40 kg · 15 reps × 3'),r.during);
ok('2a. Same target in the summary and next time (pre-filled 40 kg, "15 reps")',r.sum.includes('40 kg · 15 reps × 3')&&r.pre===40&&r.next.t.includes('15 reps'),JSON.stringify({s:r.sum.slice(0,80),n:r.next,pre:r.pre}));
r=await run([[40,11],[40,10],[40,10]]);
ok('2a. All sets done inside the range (11-10-10): keep 40 kg, 11 reps on every set',r.during.includes('vise 11 reps sur chaque série')&&r.sum.includes('40 kg · 11 reps × 3')&&r.pre===40&&r.next.t.includes('11 reps'),r.during);
r=await run([[40,12],[40,11]],{stop:true});
ok('2b. Interrupted (2/3 sets, then next exercise started): advice right away',r.lc.includes('Exercice interrompu : 2/3 séries')&&r.lc.includes('fais les 3 séries, au moins 11 reps'),r.lc);
ok('2b. Summary and next time agree: 40 kg, 3 sets of 11 (no increase)',r.sum.includes('40 kg · 11 reps × 3')&&r.pre===40&&r.next.t.includes('11 reps')&&r.next.t.includes('toutes les séries'),JSON.stringify(r.next));
r=await run([[40,12],[45,9],[45,8]]);
ok('2c. Load raised during the exercise (40 → 45): every set at 45 kg next time, 9 reps',r.during.includes('Tu es monté de 40 à 45 kg')&&r.during.includes('45 kg · 9 reps × 3'),r.during);
ok('2c. Next workout pre-filled at 45 kg',r.pre===45&&r.next.t.includes('45 kg, 9 reps'),JSON.stringify({n:r.next,pre:r.pre}));
r=await run([[50,6],[45,9],[45,8]]);
ok('2c. Load lowered (50 kg too heavy → 45): says so, keeps 45 kg, 9 reps',r.during.includes('redescendu de 50 kg (6 reps) à 45 kg')&&r.pre===45,r.during);
r=await run([[40,6],[40,6],[40,5]]);
ok('2d. Too heavy from the first set (6 < 8): next time 35 kg (gym step), pre-filled',r.during.includes('trop lourd')&&r.during.includes('35 kg')&&r.pre===35,r.during);

// ===== 3. Add an exercise =====
await E(()=>{S.d.M.logs=[];S.d.M.pf.gear=['C'];delete S.d.M.draw.B;U.tab='today';U.pick='B';go();begin('B');if(U.chk)start('B',0)});
const subBefore=await E(()=>JSON.stringify(D().sub));
await tap(p.locator('.addb'));
const opts=await E(()=>[...document.querySelectorAll('.addp .swr')].map(r=>({t:r.textContent,id:(r.querySelector('button').getAttribute('onclick').match(/'(\w+)'/)||[])[1]})));
ok('3. Only exercises your cable-only gym allows (cable or bodyweight)',opts.length>0&&await E(o=>o.every(x=>['C','BW'].includes(E[x.id][4])),opts),opts.slice(0,3).map(o=>o.t).join(' | '));
ok('3. Each one shows the time it adds',opts.every(o=>/\+\d+:\d\d/.test(o.t)));
ok('3. iPhone SE: add list fits',await fit());
const pick=opts[0];await tap(p.locator('.addp .swr button').first());
const added=await E(id=>{const i=cx().length-1;return{i,id:sid(i),sets:cur().ex[i].length,o:cx()[i][7],plan:Math.round(xPlan(xkey(i)))}},pick.id);
ok('3. Added at the end for today (2 sets), notice shows the added time',added.id===pick.id&&added.sets===2&&added.o>=200&&/\(\+\d+:\d\d\)/.test(await p.textContent('#notice')),JSON.stringify(added));
await tap(card(added.i).locator('.xt.x0'));await p.clock.runFor(90e3);
await type(`#w${added.i}_0`,'10');await type(`#r${added.i}_0`,'12');await tap(p.locator(`[data-row="${added.i}-0"] button`));
await p.clock.runFor(30e3);await type(`#w${added.i}_1`,'10');await type(`#r${added.i}_1`,'11');await tap(p.locator(`[data-row="${added.i}-1"] button`));
ok('3. Timed like any exercise; stops by itself at its last set',await E(i=>cur().xr==null&&Math.floor(xMs(xkey(i))/1000)===120,added.i));
await tap(card(added.i).locator('button[aria-label^="Remplacer"]'));
ok('3. It can only be replaced for today (no "Toujours")',(await card(added.i).locator('.swp').textContent()).includes("Aujourd'hui")&&!(await card(added.i).locator('.swp').textContent()).includes('Toujours'));
await tap(card(added.i).locator('.swp button',{hasText:'Annuler'}));
await tap(p.locator('#v button',{hasText:'Terminer la séance'}));await accept();
const lg3=await E(()=>S.d.M.logs.at(-1));
ok('3. In History with its sets and its time',!!lg3.ex[pick.id]&&lg3.ex[pick.id].length===2&&lg3.xt.some(q=>q.ids.includes(pick.id)&&q.sec===120),JSON.stringify(lg3.xt));
await E(()=>{U.sum=null;U.tab='hist';go()});await tap(p.locator('.history-entry details.bkm summary').first());
ok('3. History lists it with its time',(await p.locator('.history-entry').first().textContent()).includes(await E(id=>nm(id),pick.id)));
ok('3. Today only: program, pins and next B preview unchanged',await E(([id,sb])=>JSON.stringify(D().sub)===sb&&!eff('B').ex.some(e=>e[0]===id)&&!P.M.B.ex.some(e=>e[0]===id),[pick.id,subBefore]));
// AI button still offered (nothing sent unless tapped)
ok('AI: History keeps the optional "Demander à l\'IA" link (Google AI Mode)',(await p.locator('.history-entry a.aib').count())>=1);
ok('No native dialogs or page errors',!errs.length&&await E(()=>window.__nd.length===0),errs.join(' | '));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();server.close();process.exitCode=fails?1:0})().catch(e=>{console.log('CRASH',e.message);process.exitCode=2});
