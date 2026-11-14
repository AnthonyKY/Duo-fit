// Stability audit (Astra's 7 points), strict iPhone simulation. Each check says what it proves:
// 1 profile switch when saving fails or another tab changed the data · 2 two tabs, a tab acting on data it had not seen, storage errors
// 3 next target when the end of an exercise was lightened · 4 backup → restore keeps everything, bad / interrupted restores change nothing
// 5 body composition: a mass heavier than the weight, margins · 6 timers across lock, expiry and reload · 7 security policy in place.
const {devices}=require('playwright');const BR=require('./browser.js');const IOS=require('./iosinit.js');
const URL=process.env.URL||'http://localhost:8766/index.html';
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+String(x).replace(/\s+/g,' ').slice(0,260):'');R.push(l);console.log(l);if(!c)fails++};
(async()=>{const b=await BR.launch();
const ctx=await b.newContext({...BR.dev('iPhone SE'),locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);
const T0=Date.UTC(2026,10,16,9);
const open=async()=>{const p=await ctx.newPage();p.setDefaultTimeout(8000);p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));await p.clock.install({time:T0});await p.clock.pauseAt(T0+1000);await p.goto(URL);return p};
const a=await open();
const E=(p,f,x)=>p.evaluate(f,x),stored=p=>E(p,()=>JSON.parse(localStorage.getItem('duofit')));
const clean=s=>String(s||'').replace(/[  ]/g,' ');
// made-up profiles
await E(a,()=>{Object.assign(S.d.M.pf,{age:30,h:180,w:80,var:'fix',back:false,inc:{DB:2,M:5,C:2.5,SM:2.5}});Object.assign(S.d.F.pf,{age:29,h:165,w:60,var:'fix',back:false});S.d.M.hd=[{d:'2026-11-10',w:80}];save();go()});
const b2=await open(); // a second tab, same phone
const other=p=>E(p,()=>S.p==='M'?'F':'M');
const show=p=>E(p,()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
// another tab wrote the data while this one had not seen it yet (the code path a stale tab takes): written here without the
// storage event, which a page never receives for its own writes
const staleWrite=(p,day)=>E(p,day=>{const x=JSON.parse(localStorage.getItem('duofit'));x.d.M.hd.push({d:day,w:79.6});localStorage.setItem('duofit',JSON.stringify(x))},day);

// ===== 1. Profile switch =====
await E(b2,()=>{U.tab='today';go()});
await E(a,()=>{D().hd.push({d:'2026-11-12',w:79.6});save()});
await E(b2,()=>switchProfile('F'));
let st=await stored(b2),m=await E(b2,()=>({p:S.p,hd:S.d.M.hd.length}));
ok('1. Switch right after another tab saved: that tab\'s change is kept and the switch applies',st.p==='F'&&m.p==='F'&&st.d.M.hd.length===2&&m.hd===2,JSON.stringify({st:st.p,m}));
await staleWrite(b2,'2026-11-13');
const to=await other(b2);await E(b2,t=>switchProfile(t),to);
st=await stored(b2);m=await E(b2,()=>({p:S.p,hd:S.d.M.hd.length,notice:$('notice').textContent}));
ok('1. Switch in a tab that had not seen the newest data: nothing lost, newest data loaded and said so, and the switch applies (was: tap ignored)',st.d.M.hd.length===3&&m.hd===3&&m.p===to&&st.p===to&&m.notice.includes('autre onglet'),JSON.stringify({to,st:st.p,m}));
await a.reload();await b2.reload();
const tgt=await other(a),was=(await stored(a)).p;
await E(a,()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('QuotaExceededError')}});
await E(a,t=>switchProfile(t),tgt);
m=await E(a,()=>({p:S.p,warn:!$('storage-warning').hidden&&$('storage-warning').textContent}));st=await stored(a);
ok('1. Switch while the phone refuses to save: warning shown, the other profile is viewable, stored data untouched',m.p===tgt&&!!m.warn&&st.p===was&&st.d.M.hd.length===3,JSON.stringify(m));
await E(a,()=>{Storage.prototype.setItem=window.__set;save()});st=await stored(a);
ok('1. Once saving works again, storage matches the screen (profile, data) and the warning goes',st.p===tgt&&st.d.M.hd.length===3&&await E(a,()=>$('storage-warning').hidden));
await E(a,()=>switchProfile('M'));

// ===== 2. Two tabs, storage errors =====
await b2.reload();
await E(a,()=>{U.pick='A';go();begin('A');if(U.chk)start('A',0);setv(0,0,'w','40');setv(0,0,'r','10');done(0,0)});
// poll from the test side: the page's own timers are frozen by the simulated clock
let live=false;for(let i=0;i<100&&!live;i++){live=await E(b2,()=>!!S.d.M.cur&&S.d.M.cur.ex[0][0].ok===1);if(!live)await new Promise(r=>setTimeout(r,20))}
ok('2. The other tab sees the logged set at once',live);
await staleWrite(b2,'2026-11-14');await E(b2,()=>{D().ms.push({d:'2026-11-14',wa:81});save()});
st=await stored(b2);
ok('2. A tab acting on data it had not seen yet never overwrites the newer data (it reloads it and says so)',st.d.M.hd.some(h=>h.d==='2026-11-14')&&!!st.d.M.cur,JSON.stringify({hd:st.d.M.hd.map(h=>h.d),cur:!!st.d.M.cur}));
await a.reload();
await E(a,()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('QuotaExceededError')}});
await E(a,()=>{setv(0,1,'w','40');setv(0,1,'r','9');done(0,1)});
m=await E(a,()=>({mem:cur().ex[0][1].ok===1,warn:!$('storage-warning').hidden}));st=await stored(a);
ok('2. Saving refused: the set stays on screen with a warning (not silently dropped)',m.mem&&m.warn&&st.d.M.cur.ex[0][1].ok!==1);
await E(a,()=>{Storage.prototype.setItem=window.__set;setv(0,2,'w','40');setv(0,2,'r','8');done(0,2)});st=await stored(a);
ok('2. Next successful save writes everything kept in memory (both sets)',st.d.M.cur.ex[0][1].ok===1&&st.d.M.cur.ex[0][2].ok===1&&await E(a,()=>$('storage-warning').hidden));
await E(a,()=>{writeSessionEnd(null);clearView();go()});

// ===== 3. Next target with lighter sets at the end =====
const target=async(sets)=>clean(await E(a,(sets)=>{S.lg='fr';const e=['lpd',3,8,12,90,2,5],o=nextOf('lpd',sets.map(([w,r])=>({w,r})),e,0);return nxTarget('lpd',o)+' | '+nxText('lpd',o)},sets));
let t=await target([[40,12],[40,12],[35,12]]);
ok('3. 40×12, 40×12 then 35×12: working load stays 40 kg (was: 35 kg next time)',t.startsWith('40 kg · 12 reps × 3')&&t.includes("Fin d'exercice allégée à 35 kg : ta charge de travail reste 40 kg"),t);
t=await target([[40,12],[40,10],[35,8]]);
ok('3. 40×12, 40×10 then 35×8: stays 40 kg, aim 11 reps (was: 35 kg)',t.startsWith('40 kg · 11 reps × 3'),t);
for(const [sets,exp,why] of [[[[40,12],[42.5,10],[42.5,9]],'42,5 kg · 10 reps × 3','load raised during the exercise'],[[[45,6],[40,10],[40,10]],'40 kg · 11 reps × 3','first set too heavy'],
  [[[40,7],[35,9],[35,9]],'35 kg · 10 reps × 3','heavier set below the range'],[[[40,12],[45,10],[40,12]],'40 kg · 12 reps × 3','one heavier set in the middle'],[[[40,12],[40,12],[40,12]],'42,5 kg · 8 reps × 3','all at the top']]){
  t=await target(sets);ok(`3. Unchanged when ${why}: ${exp}`,t.startsWith(exp),t)}
// end to end: finish such a workout, the next one is pre-filled at 40 kg
await E(a,()=>{S.d.M.logs=[];U.tab='today';U.pick='A';go();start('A',0);for(const [j,[w,r]] of [[40,12],[40,12],[35,12]].entries()){setv(0,j,'w',String(w));setv(0,j,'r',String(r));done(0,j)}fin()});
await E(a,()=>{const f=pendingAction;closeAction();if(f)f()});
const pre=await E(a,()=>{U.sum=null;start('A',0);const w=cur().ex[0][0].w;writeSessionEnd(null);clearView();go();return w});
ok('3. Next workout pre-filled at 40 kg after a lightened last set',pre===40,pre);

// ===== 4. Backup → restore =====
await E(a,()=>{D().body.push({id:'b1',d:'2026-11-14',when:'after',weight:78,fatPct:13.3,note:'x'});setNote(Object.keys(E)[0],'siège 4');switchProfile('F');U.pick='B';go();begin('B');if(U.chk)start('B',0);setv(0,0,'w','12');setv(0,0,'r','12');done(0,0);switchProfile('M')});
const rt=await E(a,()=>{const raw=JSON.stringify(S),st=readState(raw),diff=[];const cmp=(x,y,p)=>{if(JSON.stringify(x)===JSON.stringify(y))return;if(x&&y&&typeof x==='object'&&typeof y==='object'){for(const k of new Set([...Object.keys(x),...Object.keys(y)]))cmp(x[k],y[k],p+'.'+k)}else diff.push(p)};cmp(JSON.parse(raw),JSON.parse(JSON.stringify(st)),'S');return diff});
ok('4. Backup → restore keeps every field of both profiles (sessions, session in progress, tracking, readings, notes)',rt.length===0,rt.join(' '));
const before=await E(a,()=>localStorage.getItem('duofit'));
await E(a,()=>{U.tab='set';go();$('jx').value='{"p":"M","d":{"M":{"logs":"oops"}}}';restoreBackup()});
ok('4. A damaged backup is refused, nothing changes',(await E(a,()=>$('notice').textContent)).includes('Données invalides')&&(await E(a,()=>localStorage.getItem('duofit')))===before);
await E(a,(raw)=>{const x=JSON.parse(raw);x.d.M.logs=[];$('jx').value=JSON.stringify(x);restoreBackup()},before);
await E(a,()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('QuotaExceededError')};const f=pendingAction;closeAction();f()});
m=await E(a,()=>({logs:S.d.M.logs.length,warn:!$('storage-warning').hidden}));
await E(a,()=>{Storage.prototype.setItem=window.__set});
ok('4. Restore interrupted by a storage error: the phone keeps its current data (memory and storage)',m.logs===1&&m.warn&&(await E(a,()=>localStorage.getItem('duofit')))===before,JSON.stringify(m));

// ===== 5. Body composition =====
const calc=(r,hd)=>E(a,([r,hd])=>{const x=bDerive({d:'2026-11-15',...r},{h:180,sex:'m'},hd);return{ffm:x.ffm,bmr:x.bmrEst,ffmi:x.ffmi,clash:!!x.clash,line:bLiveLine(x).replace(/[\u00a0\u202f]/g,' ')}},[r,hd]);
let c5=await calc({fatKg:75},[{d:'2026-11-15',w:70}]);
ok('5. Weigh-in 70 kg + 75 kg of fat: no negative fat-free mass, no metabolism, flagged (was: −5 kg and a metabolism)',c5.clash&&c5.ffm==null&&c5.bmr==null&&c5.ffmi==null&&c5.line.includes('75 kg > poids 70 kg (pesée du jour)'),JSON.stringify(c5));
c5=await calc({weight:70,muscleKg:72});
ok('5. Muscle heavier than the weight: same, nothing computed from it',c5.clash&&c5.ffm==null&&c5.line.includes('Masse musculaire 72 kg > poids 70 kg'),JSON.stringify(c5));
c5=await calc({fatKg:11.2,fatPct:15.5,muscleKg:58});
ok('5. Bone from a weight rebuilt from fat kg + %: its margin is shown (≈ 3,1 kg (±0,6))',c5.line.includes('Os (estimé) ≈ 3,1 kg (±0,6)'),c5.line);
c5=await calc({weight:72.4,fatPct:15.5,muscleKg:58});
ok('5. Normal reading unchanged (fat-free mass ≈ 61,2 kg, bone ≈ 3,2 kg without margin, BMI 22,3)',c5.line.includes('Masse maigre ≈ 61,2 kg')&&c5.line.includes('Os (estimé) ≈ 3,2 kg ·')&&c5.line.includes('IMC 22,3'),c5.line);

// ===== 6. Timers: lock, expiry, reload =====
await E(a,()=>{U.tab='today';U.pick='A';go();start('A',0);xRun(xkey(0));setv(0,0,'w','40');setv(0,0,'r','10');done(0,0)});
await E(a,()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))});
await a.clock.runFor(180e3);await show(a);
let tm=await E(a,()=>({rest:Math.round(restRemaining(cur().rest)/1000),x:Math.floor(xMs(xkey(0))/1000),run:cur().xr===xkey(0),sess:$('session-clock').textContent}));
ok('6. Locked 3 min during a 2-min rest: rest over, exercise timer 3:00 and still running, session 3:00',tm.rest===0&&tm.x===180&&tm.run&&tm.sess==='03:00',JSON.stringify(tm));
await E(a,()=>{setv(0,1,'w','40');setv(0,1,'r','10');done(0,1)});await a.clock.runFor(30e3);
await a.reload();await a.clock.runFor(1e3);
tm=await E(a,()=>({rest:Math.round(restRemaining(cur().rest)/1000),x:Math.floor(xMs(xkey(0))/1000),clock:$('rest-clock')&&$('rest-clock').textContent}));
ok('6. App reloaded in the middle of a rest: 1:29 left, exercise timer kept (3:31)',tm.rest===89&&tm.x===211&&tm.clock==='01:29',JSON.stringify(tm));
await a.clock.runFor(120e3);tm=await E(a,()=>({rest:Math.round(restRemaining(cur().rest)/1000)}));
ok('6. …and that rest still ends on time',tm.rest===0);
await E(a,()=>{writeSessionEnd(null);clearView();go()});

// ===== 7. Security policy =====
ok('7. Security policy present; nothing blocked anywhere in this suite',await E(a,()=>!!document.querySelector('meta[http-equiv="Content-Security-Policy"]')));
ok('No native dialogs, blocked requests or page errors',!a.errs.length&&!b2.errs.length&&await E(a,()=>window.__nd.length===0)&&await E(b2,()=>window.__nd.length===0),[...a.errs,...b2.errs].join(' | '));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();process.exit(fails?1:0)})().catch(e=>{console.log('CRASH',e.message);process.exit(2)});
