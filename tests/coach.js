// Per-exercise timers (plan from the time model, green → amber ≤ +10 % → red, real duration = sum), on-phone coach,
// "ask an AI" (Google AI Mode link / copy, offline-safe), adding an exercise to the running workout. Strict iPhone simulation.
const {chromium,devices}=require('playwright');const IOS=require('./iosinit.js');
const URL=process.env.URL||'http://localhost:8766/index.html';
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone SE'],locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);
const p=await ctx.newPage();p.setDefaultTimeout(8000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const T0=Date.UTC(2026,10,16,9),DAY=864e5;await p.clock.install({time:T0});
const E=(f,a)=>p.evaluate(f,a),txt=async()=>(await p.textContent('#v')).replace(/[  ]/g,' ');
const tap=loc=>loc.evaluate(el=>el.click()),accept=()=>tap(p.locator('#action-accept'));
const type=(sel,v)=>p.locator(sel).evaluate((el,v)=>{el.focus();el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}))},v);
await p.goto(URL);
// previous A session so the coach can compare
await E(()=>{const pf=S.d.M.pf;pf.var='fix';pf.back=false;S.d.M.logs.push({date:Date.now()-7*864e5,wk:'A',ex:{ms:[{w:40,r:10},{w:40,r:10},{w:40,r:9}],idp:[{w:20,r:12},{w:20,r:11},{w:20,r:10}]},sets:6,vol:1830,dur:50,durSec:3000,note:''});save();U.pick='A';go()});
await tap(p.locator('#v button',{hasText:'Commencer la séance'}));
// ===== 1. timers =====
ok('1. Warm-up timer runs from the start of the workout',await E(()=>cur().xr==='wu'&&!!cur().xt.wu));
ok('1. Each exercise shows ▶ with its planned time',await E(()=>document.querySelectorAll('.xt.x0').length>=5));
const planWu=await E(()=>Math.round(xPlan('wu')));
await p.clock.runFor(planWu*1000-1000);
ok('1. Warm-up chip green while within plan',await E(()=>document.querySelector('.wuc .xt').classList.contains('xok')));
await p.clock.runFor(Math.round(planWu*0.05)*1000+2000);
ok('1. Amber just over the plan (≤ +10 %)',await E(()=>document.querySelector('.wuc .xt').classList.contains('xwarn')));
await p.clock.runFor(Math.round(planWu*0.1)*1000+2000);
{const a=await E(()=>document.querySelector('.wuc .xt span').textContent);await p.clock.runFor(5000);const b2=await E(()=>document.querySelector('.wuc .xt span').textContent);
ok('1. Red beyond +10 %, and still counting',await E(()=>document.querySelector('.wuc .xt').classList.contains('xover'))&&a!==b2,a+' → '+b2)}
// start exercise 1 with ▶
const k0=await E(()=>xkey(0));
await tap(p.locator('#v .c:not(.wuc)').first().locator('.xt'));
const wuSec=await E(()=>Math.floor(cur().xt.wu.ms/1000));
ok('1. ▶ on the first exercise stops the warm-up timer and starts that one',await E(k=>cur().xr===k&&cur().xt.wu.at==null,k0)&&wuSec>=planWu,String(wuSec));
const plan0=await E(()=>Math.round(xPlan(xkey(0))));
ok('1. First exercise plan includes its sets, rests, station change and ramp-up sets',plan0>300,String(plan0));
await p.clock.runFor(60e3);
// session pause freezes the exercise timer
await tap(p.locator('.session-clock button'));const msA=await E(k=>xMs(k),k0);await p.clock.runFor(120e3);
ok('1. Pausing the workout pauses the exercise timer',await E(([k,m])=>xMs(k)===m,[k0,msA]));
await tap(p.locator('.session-clock button'));await p.clock.runFor(30e3);
ok('1. Resuming continues it',await E(([k,m])=>xMs(k)>=m+29000,[k0,msA]));
// log 3 sets of exercise 1 (coach: too light → all ≥ hi+3)
for(let j=0;j<3;j++){await type(`#w0_${j}`,'40');await type(`#r0_${j}`,'16');await tap(p.locator(`[data-row="0-${j}"] button`));await p.clock.runFor(60e3)}
let tx=await txt();
ok('2. Coach after the last set: too light, suggests a heavier load',tx.includes('Trop léger')&&/Passe à 4[0-9],?[0-9]* kg/.test(tx),tx.match(/Trop léger[^.]*\./)?.[0]);
ok('2. Coach compares with last time',tx.includes('Mieux que la dernière fois'));
// exercise 2 auto-starts when a set is validated without ▶ (backdated by that set)
const before2=await E(()=>Date.now());
await type('#w1_0','30');await type('#r1_0','5');await tap(p.locator('[data-row="1-0"] button'));
const k1=await E(()=>xkey(1));
ok('1. Validating a set on the next exercise switches the timer to it (counting that set)',await E(([k,k0])=>cur().xr===k&&cur().xt[k0].at==null&&xMs(k)>=30000,[k1,k0]));
await type('#w1_1','30');await type('#r1_1','4');await tap(p.locator('[data-row="1-1"] button'));
await type('#w1_2','30');await type('#r1_2','4');await tap(p.locator('[data-row="1-2"] button'));
tx=await txt();ok('2. Coach: too heavy from set 1 → about 10 % less',tx.includes('Trop lourd dès la 1re série')&&tx.includes('environ '+(await E(()=>f1(rdn(sid(1),27))))+' kg'),tx.match(/Trop lourd[^.]*\./)?.[0]);
// stop the timer, idle 5 minutes (not counted), then finish
await tap(p.locator('#v .c:not(.wuc)').nth(1).locator('.xt'));ok('1. Tapping the running chip stops it',await E(()=>cur().xr==null));
await p.clock.runFor(300e3);
const sum=await E(()=>Math.floor(Object.keys(cur().xt).reduce((a,k)=>a+xMs(k),0)/1000)),clk=await E(()=>elapsedSeconds(cur()));
await tap(p.locator('#v button',{hasText:'Terminer la séance'}));
ok('1. Finish dialog shows the real time (sum), not the stopwatch',(await p.textContent('#action-detail')).includes(timeTextNode(sum)),await p.textContent('#action-detail'));
await accept();
const lg=await E(()=>S.d.M.logs.at(-1));
ok('1. Saved duration = sum of the exercise timers; stopwatch kept apart',lg.durSec===sum&&lg.clock===clk&&clk-sum>=290,JSON.stringify({durSec:lg.durSec,clock:lg.clock,sum,clk}));
tx=await txt();
ok('1. Summary: real duration, stopwatch, plan, and time per exercise with its colour',tx.includes('durée réelle = somme des exercices')&&tx.includes('chrono')&&(await p.locator('.nxr .xt').count())>=2);
// ===== 3. AI =====
const href=await p.locator('a.aib').getAttribute('href');const q=decodeURIComponent(href.split('q=')[1]);
ok('3. "Demander à l\'IA de Google" opens Google AI Mode with the question',href.startsWith('https://www.google.com/search?udm=50&q=')&&await p.locator('a.aib').getAttribute('target')==='_blank');
ok('3. The question has the profile, the target, the sets and last time',q.includes('homme')&&q.includes('188 cm')&&q.includes('Développé épaules machine')&&q.includes('40 × 16')&&q.includes('Dernière fois')&&q.includes('objectif 3×8–12'),q.slice(0,120).replace(/\n/g,' / '));
ok('3. The text is visible before sending',(await p.locator('.aiq').first().textContent()).startsWith('Analyse ma séance'));
await ctx.setOffline(true);await E(()=>{Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true})});
const went=await E(()=>aiGo());ok('3. Offline: the link does not open, message says to try later',!went&&(await p.textContent('#notice')).includes('Pas de réseau'));
await E(()=>{delete navigator.onLine});await ctx.setOffline(false);
await ctx.grantPermissions(['clipboard-read','clipboard-write']).catch(()=>{});
await tap(p.locator('.aiw button',{hasText:'Copier la question'}).first());await p.waitForTimeout(50);
ok('3. Copy the question for any AI',(await p.textContent('#notice')).includes('Question copiée'));
await E(()=>{U.sum=null;U.tab='hist';go()});
ok('3. History: each workout keeps its AI analysis button (for later, once online)',(await p.locator('.history-entry details.aiw').count())>=1);
// ===== 4. add an exercise during a workout =====
await E(()=>{U.tab='today';U.pick='B';go();begin('B');if(U.chk)start('B',0)});
await tap(p.locator('.addb'));
const sugg=await E(()=>[...document.querySelectorAll('.addp .swr > span')].map(e=>e.textContent));
ok('4. "Ajouter un exercice" lists exercises that fit this workout, none already in it',sugg.length>0&&await E(list=>{const here=cx().map((_,i)=>nm(sid(i)));return list.every(x=>!here.includes(x.split(' · ')[0].trim()))},sugg),sugg.slice(0,4).join(' | '));
await tap(p.locator('.addp .sg button',{hasText:'Fessiers'}));
const glutes=await E(()=>[...document.querySelectorAll('.addp .swr')].length);
ok('4. Other muscle groups available too (Fessiers)',glutes>=1);
await E(()=>{D().pf.no=['hp']});await E(()=>go());
ok('4. Excluded exercises are not offered',!(await txt()).includes('Hip thrust machine'));
const n0=await E(()=>cx().length);
await tap(p.locator('.addp .swr button').first());
const added=await E(()=>({n:cx().length,last:sid(cx().length-1),sets:cur().ex[cx().length-1].length,e7:cx().at(-1)[7]}));
ok('4. Added at the end with its sets, in this workout only',added.n===n0+1&&added.sets>=2&&added.e7>=200,JSON.stringify(added));
ok('4. It has its own timer chip',await E(()=>{const cards=[...document.querySelectorAll('#v .c:not(.wuc)')].filter(c=>c.querySelector('[data-row]'));return!!cards.at(-1).querySelector('.xt')}));
await tap(p.locator('.rmx'));ok('4. Can be removed while untouched',await E(n=>cx().length===n,n0));
await tap(p.locator('.addb'));await tap(p.locator('.addp .swr button').first());
const i2=await E(()=>cx().length-1);await type(`#w${i2}_0`,'15');await type(`#r${i2}_0`,'12');await tap(p.locator(`[data-row="${i2}-0"] button`));
ok('4. Once a set is logged, no remove button',await E(i=>!document.querySelectorAll('.rmx').length,i2));
await tap(p.locator('#v button',{hasText:'Terminer la séance'}));await accept();
const lg2=await E(()=>S.d.M.logs.at(-1));ok('4. The added exercise is saved in history with its set',Object.keys(lg2.ex).includes(added.last)&&lg2.ex[added.last][0].r===12,Object.keys(lg2.ex).join(','));
// layout + no errors
await E(()=>{U.sum=null;U.pick='A';go();begin('A')});await tap(p.locator('.addb'));
ok('iPhone SE: chips, coach, add panel without sideways scroll',await E(()=>document.documentElement.scrollWidth<=innerWidth));
ok('No native dialogs or page errors',!errs.length&&await E(()=>window.__nd.length===0),errs.join(' | '));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();process.exit(fails?1:0)})().catch(e=>{console.log('CRASH',e.message);process.exit(2)});
function timeTextNode(s){const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`}
