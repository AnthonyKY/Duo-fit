// The 8 corrections asked after the review of v2026-11-14n — one regression check (or more) per case, strict iPhone simulation.
// 1) a corrected history (load, date, deletion) drives the next target
// 2) guided mode: "vise 11 reps" saves 11 when the field is left empty; a typed 9 saves 9
// 3) exact machine loads (11,25 not 11,3); a next step of more than 10 % → same load, +1 rep
// 4) session time and measured exercise time are separate ("mesure partielle", "non mesuré"); warm-up shown apart
// 5) body composition: incompatible values are flagged and the results that depend on them are suspended; a margin above
//    0,3 kg is shown (bone); the estimated BMR appears in the empty BMR field; the export keeps the entries only
// 6) the weekly goal comes from the profile's planning (and a week without planned workouts has no goal)
// 7) the backup reminder counts body-composition readings
// 8) old workouts (before durSec) no longer give "NaN min" in the AI text
// FR and EN, Him and Her, an old backup, offline relaunch, iPhone SE and 16 Plus (emulated; see the report for real-iPhone checks).
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const BR=require('./browser.js');const IOS=require('./iosinit.js');
const root=path.join(__dirname,'..'),base='/Duo-fit/',FILES=['index.html','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+String(x).slice(0,300):'');R.push(l);console.log(l);if(!c)fails++};
(async()=>{
const server=http.createServer((req,res)=>{const route=new URL(req.url,'http://x').pathname,name=route===base?'index.html':route.slice(base.length);
  if(!route.startsWith(base)||!FILES.includes(name)){res.writeHead(404);return res.end()}
  res.setHeader('Content-Type',name.endsWith('html')?'text/html; charset=utf-8':name.endsWith('js')?'application/javascript':name.endsWith('png')?'image/png':'application/manifest+json');
  res.end(fs.readFileSync(path.join(root,name)))});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+base;
const b=await BR.launch();
for(const dev of BR.device?[BR.device]:['iPhone SE','iPhone 16 Plus']){
const ctx=await b.newContext({...BR.dev(dev),locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);
const p=await ctx.newPage();p.setDefaultTimeout(8000);const errs=[];p.on('pageerror',e=>BR.noise(e.message)||errs.push(e.message));
const T0=Date.UTC(2026,10,18,17);await p.clock.install({time:T0});await p.clock.pauseAt(T0+1000);
await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
const E=(f,a)=>p.evaluate(f,a),txt=async()=>(await p.textContent('#v')).replace(/[  ]/g,' ');
const tap=loc=>loc.evaluate(el=>el.click()),accept=()=>tap(p.locator('#action-accept'));
const type=(sel,v)=>p.locator(sel).evaluate((el,v)=>{el.focus();el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}))},v);
const tag=`[${dev}] `;
const fresh=()=>E(()=>{for(const k of['M','F']){const d=S.d[k];d.logs=[];d.cur=null;d.body=[];d.hd=[];d.ms=[]}S.p='M';S.lg='fr';S.bk={};U.sum=null;U.ed=null;U.tab='today';save();go()});
// one finished workout through the real engine: exercise `id`, sets [[w,r],…], target entry [_, n, lo, hi, rest, rir]
const logOf=(id,sets,e,daysAgo,wk='A')=>E(([id,sets,e,daysAgo,wk])=>{const ex={[id]:sets.map(([w,r])=>({w,r}))},o=nextOf(id,ex[id],e,null);
  const log={pr:[],date:Date.now()-daysAgo*864e5,wk,dur:50,durSec:3000,ex,note:'',...workoutTotals(ex),tg:{[id]:[e[1],e[2],e[3],e[5]]},nx:o?{[id]:{w:o.w,r:o.r,k:o.k,n:o.n,lo:o.lo,hi:o.hi}}:{}};
  D().logs.push(log);D().logs.sort((a,b)=>a.date-b.date);save();return o},[id,sets,e,daysAgo,wk]);
const target=(id,e,wk='A')=>E(([id,e,wk])=>{const g=sug(id,e,wk);return{w:g.w,r:g.r??null,t:g.t}},[id,e,wk]);

// ======================================================================= 1. corrected history drives the next target
await fresh();
const ID=await E(()=>Object.keys(E).find(k=>E[k][4]==='M')),ENT=[null,3,8,12,90,2];
await E(()=>{D().pf.inc={...(D().pf.inc||{}),M:2.5};save()});
await logOf(ID,[[60,12],[60,12],[60,12]],ENT,2);            // top of the range → next: 62,5 kg
const before=await target(ID,ENT);
await E(()=>{U.tab='hist';U.ed=0;go()});
for(let j=0;j<3;j++)await type(`[data-e="${ID}"][data-j="${j}"][data-k="r"]`,'9');  // correction: in fact 9 reps
await tap(p.locator('#v button',{hasText:'Enregistrer'}));
const after=await target(ID,ENT);
ok(tag+'1. Before the correction: the next target goes up (62,5 kg)',before.w===62.5,JSON.stringify(before));
ok(tag+'1. Corrected reps (12 → 9): the next target follows the correction (60 kg × 10)',after.w===60&&after.r===10,JSON.stringify(after));
ok(tag+'1. …and the target text says so (not "haut de fourchette atteint")',!/haut de fourchette/i.test(after.t),after.t);
await E(()=>{U.ed=0;go()});
for(let j=0;j<3;j++)await type(`[data-e="${ID}"][data-j="${j}"][data-k="w"]`,'70');
for(let j=0;j<3;j++)await type(`[data-e="${ID}"][data-j="${j}"][data-k="r"]`,'12');
await tap(p.locator('#v button',{hasText:'Enregistrer'}));
const after2=await target(ID,ENT);
ok(tag+'1. Corrected load (60 → 70 kg, top of range): the next target starts from 70 kg (72,5)',after2.w===72.5,JSON.stringify(after2));
await logOf(ID,[[30,8],[30,8],[30,8]],ENT,1);               // a newer workout: 30 kg × 8
ok(tag+'1. (setup) newest workout = 30 kg × 8 → target 30 kg',(await target(ID,ENT)).w===30);
await E(()=>{U.ed=0;go()});                                 // index 0 = the 70 kg workout (2 days ago)
await type('#edd',await E(()=>tday()));await tap(p.locator('#v button',{hasText:'Enregistrer'}));
ok(tag+'1. Its date moved to today: it is now the last workout and drives the target (72,5 kg)',(await target(ID,ENT)).w===72.5,JSON.stringify(await target(ID,ENT)));
await E(()=>deleteLog(D().logs.length-1));await accept();
ok(tag+'1. That workout deleted: the previous one (30 kg × 8) drives the target again',(await target(ID,ENT)).w===30,JSON.stringify(await target(ID,ENT)));

// ======================================================================= 2. guided mode saves the target reps
await fresh();
await logOf(ID,[[50,10],[50,10],[50,10]],ENT,2);            // 10 reps → next: same load, 11 reps
const g2=await target(ID,ENT);
ok(tag+'2. (setup) next target: 50 kg, 11 reps',g2.w===50&&g2.r===11,JSON.stringify(g2));
await E(([id,e])=>{S.gm=true;const plan=eff('A');plan.ex[0]=[id,...e.slice(1),plan.ex[0][6],plan.ex[0][7]];D().pf.var='fix';save()},[ID,ENT]);
await E(id=>{start('A');const c=cur();c.pl[0]=[id,3,8,12,90,2,c.pl[0][6],c.pl[0][7]];c.ex[0]=Array.from({length:3},()=>({w:50,r:'',ok:0}));c.swp={};U.gi=0;save();go()},ID);
const ph=await p.getAttribute('#r0_0','placeholder');
ok(tag+'2. Guided: the reps field shows the target (11), not last time (10)',ph==='11',ph);
await tap(p.locator('#v button.big'));
ok(tag+'2. Field left empty, ✓ Valider → 11 reps saved',await E(()=>cur().ex[0][0].r===11&&cur().ex[0][0].ok===1));
await type('#r0_1','9');await tap(p.locator('#v button.big'));
ok(tag+'2. Typed 9 → 9 saved',await E(()=>cur().ex[0][1].r===9));
await E(()=>{S.gm=false;save();go()});
ok(tag+'2. List mode: the same target in the empty field',(await p.getAttribute('[data-row="0-2"] input[inputmode=numeric]','placeholder'))==='11');
await E(()=>{D().cur=null;save();go()});

// ======================================================================= 3. exact machine loads, gentle step above 10 %
await fresh();
await E(()=>{D().pf.inc={...(D().pf.inc||{}),M:1.25};save()});
await logOf(ID,[[11.25,10],[11.25,10],[11.25,10]],ENT,2);
const fsTxt=await E(id=>fs(id,{w:11.25,r:10}),ID);
ok(tag+'3. A machine load of 11,25 kg is shown as 11,25 (not 11,3)',fsTxt.includes('11,25')&&!fsTxt.includes('11,3 '),fsTxt);
await E(()=>{U.tab='hist';go()});ok(tag+'3. History shows 11,25',(await txt()).includes('11,25'));
await E(()=>{U.tab='today';go()});
await fresh();await E(()=>{D().pf.inc={...(D().pf.inc||{}),M:5};save()});
const o3=await logOf(ID,[[20,12],[20,12],[20,12]],ENT,2);   // top of range; 25 kg would be +25 %
const g3=await target(ID,ENT);
ok(tag+'3. Next step +25 %: same load (20 kg) and +1 rep (13), not straight to 15',o3.k==='reps'&&g3.w===20&&g3.r===13,JSON.stringify({o3,g3}));
const o3b=await E(([id,e])=>nextOf(id,[{w:20,r:13},{w:20,r:13},{w:20,r:14}],e,null),[ID,ENT]);
ok(tag+'3. Then 13 → 14 reps, step by step',o3b.k==='reps'&&o3b.w===20&&o3b.r===14,JSON.stringify(o3b));
const o3c=await E(([id,e])=>nextOf(id,[{w:20,r:15},{w:20,r:15},{w:20,r:15}],e,null),[ID,ENT]);
ok(tag+'3. At the top + 3 reps on every set: the load goes up',o3c.k==='up'&&o3c.w===25,JSON.stringify(o3c));
ok(tag+'3. The advice text says "+1 rep"',/13 reps/.test(await E(([id,o])=>nxText(id,o),[ID,o3])),await E(([id,o])=>nxText(id,o),[ID,o3]));

// ======================================================================= 4. session time vs measured exercise time
await fresh();
await E(()=>{start('A');save();go()});
const t4=await E(()=>Date.now());
await tap(p.locator('.wuc .xt').first()).catch(()=>{});      // warm-up timer if present
await p.clock.runFor(180e3);
await E(()=>{const c=cur();if(c.xr)xStop();const k=xkey(0);xStart?xStart(k):null;save()}).catch(()=>{});
await E(()=>{const c=cur();c.xt=c.xt||{};c.xt.wu={ms:180e3};c.xt[xkey(0)]={ms:240e3};c.xr=null;
  c.ex[0].forEach(s=>{s.w=20;s.r=10;s.ok=1});c.ex[1].forEach(s=>{s.w=20;s.r=10;s.ok=1});save();go()});
await p.clock.runFor(600e3);
await E(()=>fin());await accept();
const sumTxt=await txt();
ok(tag+'4. Summary: the session time (wall clock, 13:00) is shown as such',/⏱ Séance 13:00/.test(sumTxt),sumTxt.slice(0,400));
ok(tag+'4. Summary: measured exercise time apart, marked "mesure partielle" (1 of 2 exercises timed)',sumTxt.includes('mesure partielle'),sumTxt.slice(0,400));
ok(tag+'4. Summary: warm-up shown apart (03:00), not inside the exercise time (04:00)',/[ÉE]chauffement\s*0?3:00/.test(sumTxt)&&/Temps d'exercice 0?4:00/.test(sumTxt),sumTxt.slice(0,400));
const lg4=await E(()=>D().logs.at(-1));
ok(tag+'4. Stored: exercise time 4:00 without the warm-up, warm-up 3:00 apart',lg4.xs===240&&lg4.wu===180,JSON.stringify({xs:lg4.xs,wu:lg4.wu,durSec:lg4.durSec,clock:lg4.clock}));
await E(()=>{U.sum=null;U.tab='hist';go()});
const h4=await txt();ok(tag+'4. History: the same split',h4.includes('mesure partielle')&&/[ÉE]chauffement/.test(h4),h4.slice(0,300));
// a workout with no timer at all
await E(()=>{U.tab='today';go();start('B');const c=cur();c.ex[0].forEach(s=>{s.w=10;s.r=10;s.ok=1});save()});
await p.clock.runFor(1200e3);await E(()=>fin());await accept();
ok(tag+'4. No exercise timed: "non mesuré", the session time is still shown',(await txt()).includes('non mesuré'),(await txt()).slice(0,300));
await E(()=>{U.sum=null;go()});
// an old workout (before the split): shown without inventing anything
await E(()=>{D().logs.unshift({pr:[],date:Date.now()-9*864e5,wk:'C',dur:47,durSec:2400,clock:3000,wu:300,xt:[],ex:{},note:'',sets:0,vol:0});save()});
const old4=await E(()=>times(D().logs[0]));
ok(tag+'4. Old workout with timers: exercise time = measured minus warm-up (35:00), session 50:00',old4.ex===2100&&old4.wall===3000,JSON.stringify(old4));

// ======================================================================= 5. body composition
await fresh();
const bx=r=>E(r=>{const x=bDerive(r,D().pf,D().hd);return{ffm:x.ffm??null,bone:x.bone??null,bmi:x.bmi??null,bmrEst:x.bmrEst??null,inc:(x.inc||[]).length,list:bCalcList(x).map(([l,v])=>l+' '+v).join(' | '),ebone:x.ebone}},r);
await E(()=>{D().pf.h=180;D().pf.sex='m';save()});
const okRow={d:'2026-11-18',weight:80,fatKg:16,fatPct:20,muscleKg:60.5};
const good=await bx(okRow);
ok(tag+'5. (control) coherent reading: fat-free mass, bone, BMI computed',good.ffm!=null&&good.bone!=null&&good.bmi!=null&&good.inc===0,JSON.stringify(good));
const bad=await bx({...okRow,fatKg:25});                    // 20 % of 80 kg is 16 kg, not 25 kg
ok(tag+'5. Incompatible values (fat 25 kg vs 20 % of 80 kg): flagged',bad.inc>0&&/incompatible/i.test(bad.list),bad.list);
ok(tag+'5. …and the results that depend on them are suspended (fat-free mass, bone, BMI, BMR estimate)',bad.ffm==null&&bad.bone==null&&bad.bmi==null&&bad.bmrEst==null,JSON.stringify(bad));
const bad2=await bx({d:'2026-11-18',weight:80,fatPct:60,musclePct:45});
ok(tag+'5. Fat 60 % + muscle 45 % > 100 %: flagged, BMI (weight only) kept',bad2.inc>0&&bad2.bmi!=null&&bad2.ffm==null,JSON.stringify(bad2));
const wide=await bx({d:'2026-11-18',fatKg:8,fatPct:10,muscleKg:68.5});   // weight from the fat pair (8 kg / 10 %) → ±0,9 kg
ok(tag+'5. Bone margin above 0,3 kg is shown (±)',wide.bone!=null&&wide.ebone>0.3&&/Os[^|]*±/.test(wide.list),wide.list+' · e='+wide.ebone);
ok(tag+'5. Bone margin at or below 0,3 kg is not cluttered with ±',!/Os[^|]*±/.test(good.list)&&good.ebone<=0.3,good.list+' · e='+good.ebone);
await E(()=>{U.tab='set';go()});await tap(p.locator('#bdc button',{hasText:'Ajouter un relevé'}));
await type('#b_weight','80');await type('#b_fatKg','16');await type('#b_fatPct','20');
const bmrPh=await p.getAttribute('#b_bmr','placeholder');
ok(tag+'5. The empty BMR field shows the estimate (≈ … kcal from the fat-free mass)',/^≈ 1[\s\u202f.,]?\d{3} kcal/.test(bmrPh||''),bmrPh);
await tap(p.locator('#bdf .bwc button').first());await tap(p.locator('#bdf button.p'));
await E(()=>{const a=document.querySelector('#action-accept');if(a)a.click()});
const saved=await E(()=>D().body.at(-1));
ok(tag+'5. Saved reading (and so the export) keeps only what was entered: no BMR estimate stored',saved&&saved.bmr==null&&saved.weight===80,JSON.stringify(saved));
ok(tag+'5. Backup text has no estimated BMR',!(await E(()=>backupText())).includes('bmrEst'));

// ======================================================================= 6. weekly goal from the planning
await fresh();
await E(()=>{D().sched={1:'A',3:'B'};save();U.tab='prg';go()});
let f6=await E(()=>{const c=[...document.querySelectorAll('#v .c')].find(x=>x.textContent.includes('Fréquence')||x.textContent.includes('Séances par semaine'));return c?c.innerHTML:''});
ok(tag+'6. Planning with 2 days: the weekly goal is 2 (not 3)',/\/2\b|objectif[^<]*2/i.test(f6)&&!/\/3\b/.test(f6),f6.slice(0,300));
await E(()=>{D().sched={};save();go()});
f6=await E(()=>{const c=[...document.querySelectorAll('#v .c')].find(x=>x.textContent.includes('Fréquence')||x.textContent.includes('Séances par semaine'));return c?c.textContent:''});
ok(tag+'6. No workout planned: no goal shown (no "/3", says so)',!/\/3\b/.test(f6)&&/sans objectif|aucun/i.test(f6),f6.slice(0,200));
await E(()=>{D().sched={1:'A',3:'B',5:'C'};save();go()});

// ======================================================================= 7. backup reminder counts body readings
await fresh();
await E(()=>{D().body=[{id:'b1',d:'2026-11-17',when:'morning',weight:80}];S.bk={};save();U.tab='today';go()});
ok(tag+'7. Only a body reading saved: the backup reminder appears',await E(()=>bkDue())&&(await txt()).includes('💾'));

// ======================================================================= 8. no "NaN min" for old workouts
await fresh();
const ai=await E(()=>{const l={pr:[],date:Date.now()-30*864e5,wk:'A',dur:52,ex:{},note:'',sets:0,vol:0};return aiPrompt(l)});
ok(tag+'8. An old workout (no durSec): the AI text says 52 min, never NaN',!ai.includes('NaN')&&ai.includes('52 min'),ai.slice(0,240));

// ======================================================================= English, Her, old backup, offline relaunch
await E(()=>{S.lg='en';S.p='F';save();go()});
await logOf(ID,[[11.25,10],[11.25,10],[11.25,10]],ENT,2);
await E(()=>{U.tab='hist';go()});
ok(tag+'EN + Her: 11.25 kg shown exactly, in English',(await txt()).includes('11.25'));
await BR.offline(ctx,true);await p.reload();await p.waitForTimeout(200);
ok(tag+'Offline relaunch: history still there',(await txt()).includes('11.25'));
await BR.offline(ctx,false);
await E(()=>{S.lg='fr';S.p='M';save();go()});
ok(tag+'Fits the screen',await E(()=>document.documentElement.scrollWidth<=innerWidth));
ok(tag+'No errors, no native dialogs',!errs.length&&await E(()=>window.__nd.length===0),errs.join(' | '));
await ctx.close();
}
console.log(`\n${R.length-fails}/${R.length} passed`);
await b.close();server.close();process.exit(fails?1:0);
})().catch(e=>{console.log('CRASH '+(e.stack||e));process.exit(1)});
