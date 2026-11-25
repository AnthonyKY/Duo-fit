// v2026-11-25a — asked by Invictus (classic-physique goal, sensitive lower back; he lost the strength of his months 4-5):
// 1) more free-weight exercises (barbell, EZ bar, kettlebells, dumbbells) and guided machines, full FR/EN guides, nothing
//    that loads the lower back; the new equipment is offered once and changes nothing until switched on
// 2) the warm-up asks what was done on the way (cycled, walked, ran…) and adapts: cardio cut or skipped, joints of the day
//    kept, ramp-up sets always kept; "skip the warm-up"; "same as last time"
// 3) Mode Ermite: references to win back (typed, or taken from the history), a notch higher each workout up to the
//    reference, longer rests, the reference exercise placed in the right workout, a stripped-down screen kept on
// Old backups, FR and EN, iPhone SE and 16 Plus (strict iPhone simulation).
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const BR=require('./browser.js');const IOS=require('./iosinit.js');
const root=path.join(__dirname,'..'),base='/Duo-fit/',FILES=['index.html','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+String(x).slice(0,300):'');R.push(l);console.log(l);if(!c)fails++};
const NEW=['bbp','ibb','cgb','ezc','ezs','ezp','dbf','cfh','czc','spc','crc','crd','dpo','mpo','mtr','hsr','kbr'];
(async()=>{
const server=http.createServer((req,res)=>{const route=new URL(req.url,'http://x').pathname,name=route===base?'index.html':route.slice(base.length);
  if(!route.startsWith(base)||!FILES.includes(name)){res.writeHead(404);return res.end()}
  res.setHeader('Content-Type',name.endsWith('html')?'text/html; charset=utf-8':name.endsWith('js')?'application/javascript':name.endsWith('png')?'image/png':'application/manifest+json');
  res.end(fs.readFileSync(path.join(root,name)))});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+base;
const b=await BR.launch();
for(const dev of BR.device?[BR.device]:['iPhone SE','iPhone 16 Plus']){
const ctx=await b.newContext({...BR.dev(dev),locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);
// the screen-on request is counted (browsers in tests may not have it)
await ctx.addInitScript(()=>{window.__wl={req:0,rel:0};Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{window.__wl.req++;return{release:async()=>{window.__wl.rel++},addEventListener(){}}}}})});
const p=await ctx.newPage();p.setDefaultTimeout(8000);const errs=[];p.on('pageerror',e=>BR.noise(e.message)||errs.push(e.message));
const T0=Date.UTC(2026,10,26,17);await p.clock.install({time:T0});await p.clock.pauseAt(T0+1000);
await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
const E=(f,a)=>p.evaluate(f,a),txt=async()=>(await p.textContent('#v')).replace(/[  ]/g,' ');
const tap=loc=>loc.evaluate(el=>el.click());
const type=(sel,v)=>p.locator(sel).evaluate((el,v)=>{el.focus();el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}))},v);
const tag=`[${dev}] `;
const fresh=()=>E(()=>{for(const k of['M','F']){const d=S.d[k];d.logs=[];d.cur=null;d.rq={};delete d.preLast;d.draw={};d.sub={};d.pf.erm=false;d.pf.gearSeen=false;d.pf.gear=['M','DB','C','SM'];d.pf.back=true;d.pf.lvl='int';d.pf.var='fix';d.pf.time=60}
  S.p='M';S.lg='fr';S.gm=true;U.sum=null;U.tab='today';U.gi=null;U.more=false;U.pa=null;U.pm=null;U.pe=null;U.prex=0;U.rqa=0;save();go()});
// a made-up history: flat dumbbell press 40 × 10 (3 months ago) → 34 × 10 (last week); incline 32 × 10 → 28 × 10
const history=()=>E(()=>{const d=D(),day=864e5,now=Date.now();
  const add=(ago,ex,wk='A')=>d.logs.push({pr:[],date:now-ago*day,wk,dur:55,durSec:3300,ex,note:'',...workoutTotals(ex),tg:{},nx:{}});
  add(95,{fdp:[{w:40,r:10},{w:40,r:9},{w:38,r:10}],idp:[{w:32,r:10},{w:32,r:9}]});add(7,{fdp:[{w:34,r:10},{w:34,r:10},{w:34,r:10}],idp:[{w:28,r:10},{w:28,r:10}]});
  d.logs.sort((a,b)=>a.date-b.date);save();go()});

// ======================================================================= 1. exercises
await fresh();
const lib=await E(NEW=>NEW.map(id=>({id,e:E[id],gr:GR[id],ax:AX.includes(id),alts:(E[id]?.[10]||[]).every(a=>a in E)})),NEW);
ok(tag+'1. 17 new exercises, each with FR/EN name, muscles, how-to and common mistakes',lib.every(x=>x.e&&x.e.length===11&&x.e.slice(0,4).every(Boolean)&&x.e.slice(6,8).every(v=>String(v).length>40)&&x.e.slice(8,10).every(v=>String(v).length>8)),lib.filter(x=>!x.e).map(x=>x.id).join(','));
ok(tag+'1. Each has a muscle group and alternatives that exist',lib.every(x=>x.gr&&x.e[10].length&&x.alts));
ok(tag+'1. Nothing that loads the lower back: none is excluded for a sensitive back',lib.every(x=>!x.ax)&&await E(NEW=>NEW.every(id=>!['ssq','hsq','rdl'].includes(id)),NEW));
ok(tag+'1. Barbell, EZ bar and kettlebell work as equipment (name, load step)',await E(()=>['BB','EZ','KB'].every(q=>EQ[q]&&INC0[q]>0&&INCO[q].length)));
ok(tag+'1. Barbell and EZ-bar guides say the load is the whole bar',lib.filter(x=>['BB','EZ'].includes(x.e[4])).every(x=>x.e[7].includes('Charge = barre comprise')));
ok(tag+'1. Before switching the equipment on: barbell exercises are not drawn (nothing changes by itself)',await E(()=>!eligible('bbp')&&!eligible('ezc')&&!eligible('kbr')&&eligible('czc')&&eligible('mtr')));
ok(tag+'1. A brand-new profile is not asked (it picks its equipment when setting up)',!(await txt()).includes('Nouveaux exercices aux poids libres'));
await E(()=>{D().logs.push({pr:[],date:Date.now()-864e5,wk:'A',dur:50,durSec:3000,ex:{cp:[{w:40,r:10}]},note:'',sets:1,vol:400,tg:{},nx:{}});save();go()});
ok(tag+'1. Someone who already trains: offered once on Today',(await txt()).includes('Nouveaux exercices aux poids libres'));
await tap(p.locator('#v button',{hasText:'Plus tard'}));
ok(tag+'1. "Plus tard": not asked again',!(await txt()).includes('Nouveaux exercices aux poids libres')&&await E(()=>D().pf.gearSeen===true));
await E(()=>{D().pf.gearSeen=false;save();go()});
await tap(p.locator('#v button',{hasText:'Oui, activer'}));
ok(tag+'1. "Oui": barbell, EZ bar and kettlebells switched on, the rest kept',await E(()=>['M','DB','C','SM','BB','EZ','KB'].every(q=>D().pf.gear.includes(q))));
ok(tag+'1. Then they can be drawn, with the back setting still on',await E(()=>D().pf.back&&eligible('bbp')&&eligible('ezs')&&eligible('kbr')));
ok(tag+'1. A beginner does not get the barbell presses or the skull crusher',await E(()=>{D().pf.lvl='beg';const r=!eligible('bbp')&&!eligible('ezs')&&eligible('ezc');D().pf.lvl='int';return r}));
await E(()=>{navigate('set')});
ok(tag+'1. Profile: the three new kinds of equipment can be ticked, with their load steps',await p.locator('[data-gear=BB]').count()===1&&await p.locator('[data-gear=KB]').count()===1&&(await txt()).includes('Barre EZ'));
await E(()=>{navigate('lib');U.q='barre EZ';go()});
ok(tag+'1. Library: found by searching',(await txt()).includes('Curl barre EZ')&&(await txt()).includes('Barre au front'));

// ======================================================================= 2. the warm-up adapts to the way to the gym
await fresh();await E(()=>{D().pf.gearSeen=true;start('A');go()});   // upper-body day
const wd0=await E(()=>({...cur().wd}));
ok(tag+'2. Before the first set: "Tu as déjà bougé avant la séance ?"',(await txt()).includes('Tu as déjà bougé avant la séance')&&await p.locator('[data-pre=ask]').count()===1);
await tap(p.locator('[data-pre=ask] button',{hasText:'Vélo'}));
await tap(p.locator('[data-pre=ask] button',{hasText:'10 à 20 min'}));
await tap(p.locator('[data-pre=ask] button',{hasText:'Adapter'}));
let wd=await E(()=>({...cur().wd}));
ok(tag+'2. Bike 10-20 min: the cardio part is skipped, the shoulder drills stay, the ramp-up sets stay',wd.gm===0&&JSON.stringify(wd.d)===JSON.stringify(wd0.d)&&wd.ramp===wd0.ramp,JSON.stringify({wd0,wd}));
ok(tag+'2. …said in plain words, with the time saved',(await txt()).includes('cardio sauté')&&(await txt()).includes('mobilité épaules gardée')&&(await txt()).includes(`≈ −${wd0.gm} min`));
ok(tag+'2. The warm-up card no longer lists the bike',!(await p.textContent('.wuc')).includes('Vélo tranquille')&&!(await p.textContent('.wuc')).includes('Elliptique'));
ok(tag+'2. The warm-up timer follows (fewer minutes planned)',await E(()=>xPlan('wu'))===wd0.d.length*60);
await tap(p.locator('[data-pre] button',{hasText:'Modifier'}));
await tap(p.locator('[data-pre=ask] button',{hasText:'Marche'}));await tap(p.locator('[data-pre=ask] button',{hasText:'5 à 10 min'}));await tap(p.locator('[data-pre=ask] button',{hasText:'Adapter'}));
wd=await E(()=>({...cur().wd}));
ok(tag+'2. "Modifier" → walk 5-10 min easy: the cardio is only shortened',wd.gm===Math.max(0,wd0.gm-7)&&(await txt()).includes(wd.gm>0?`cardio réduit à ${wd.gm} min`:'cardio sauté'),JSON.stringify(wd));
// leg day after the bike
await E(()=>{abandon()});await tap(p.locator('#action-accept'));
await E(()=>{start('C');go()});
const c0=await E(()=>({...cur().wd}));
await tap(p.locator('[data-pre=ask] button',{hasText:'Vélo'}));await tap(p.locator('[data-pre=ask] button',{hasText:'plus de 20 min'}));await tap(p.locator('[data-pre=ask] button',{hasText:'soutenu'}));await tap(p.locator('[data-pre=ask] button',{hasText:'Adapter'}));
wd=await E(()=>({...cur().wd}));
ok(tag+'2. Leg day after 20+ min of hard cycling: no leg swings or bodyweight squats again, hip-flexor stretch added, back drills kept',
  !wd.d.includes('lsw')&&!wd.d.includes('bsw')&&wd.d.includes('hfs')&&c0.d.filter(x=>['bdg','cup','spw'].includes(x)).every(x=>wd.d.includes(x)),JSON.stringify({c0:c0.d,wd:wd.d}));
ok(tag+'2. …and a word on tired legs',(await txt()).includes('Tes jambes ont déjà bien travaillé'));
await E(()=>{abandon()});await tap(p.locator('#action-accept'));
await E(()=>{start('A');go()});
ok(tag+'2. Next workout: "Comme la dernière fois : 🚲 Vélo plus de 20 min · soutenu" in one tap',(await txt()).includes('Comme la dernière fois : 🚲 Vélo plus de 20 min · soutenu'));
await tap(p.locator('[data-pre=ask] button',{hasText:'Sauter l\'échauffement'}));
ok(tag+'2. "Sauter l\'échauffement": the warm-up card goes away, the light sets of the first exercise stay',await p.locator('.wuc').count()===0&&(await txt()).includes('Échauffement sauté')&&await E(()=>cur().wd.ramp>0||cur().wd.ramp===0));
await E(()=>{const c=cur();c.ex[0][0].ok=1;c.ex[0][0].w=20;c.ex[0][0].r=10;save();go()});
ok(tag+'2. Once the first set is logged, the question is not asked again',await p.locator('[data-pre=ask]').count()===0);
await E(()=>{abandon()});await tap(p.locator('#action-accept'));
await E(()=>{start('A');go()});await tap(p.locator('[data-pre=ask] button',{hasText:'Non'}));
ok(tag+'2. "Non": the full warm-up',await E(()=>cur().wd.gm>0)&&(await txt()).includes('Vélo tranquille')||(await txt()).includes('Elliptique')||(await txt()).includes('Marche'));
await E(()=>{abandon()});await tap(p.locator('#action-accept'));

// ======================================================================= 3. Mode Ermite
await fresh();await history();await E(()=>{D().pf.gearSeen=true;save();navigate('set')});
ok(tag+'3. Profile: the Mode Ermite card, off by default',(await txt()).includes('🧘 Mode Ermite')&&await E(()=>D().pf.erm===false));
ok(tag+'3. The history finds what used to be stronger (incline 32 × 10 → 28 × 10)',(await txt()).includes('Dans ton historique')&&(await txt()).includes('meilleur 32 kg × 10'));
await tap(p.locator('#erm input[type=checkbox]'));
await tap(p.locator('#erm button',{hasText:'Ajouter une référence'}));
await tap(p.locator('#erm button',{hasText:'Enregistrer la référence'}));
ok(tag+'3. A reference needs an exercise, a load and reps',await E(()=>Object.keys(D().rq).length===0));
await p.selectOption('#rq-ex','fdp');await type('#rq-w','40');await type('#rq-r','10');
await tap(p.locator('#erm button',{hasText:'Enregistrer la référence'}));
ok(tag+'3. Typed: flat dumbbell press 40 kg × 10',await E(()=>JSON.stringify([D().rq.fdp.w,D().rq.fdp.r]))==='[40,10]');
ok(tag+'3. Where it stands: recent 34 × 10, 88 %, a few workouts to go',/récent 34 kg × 10 · 8\d %/.test(await txt()),(await txt()).match(/récent[^·]*·[^·]*·[^\n]{0,20}/)?.[0]);
await tap(p.locator('#erm .rqr',{hasText:'Développé incliné haltères'}).locator('button',{hasText:'Prendre comme référence'}));
ok(tag+'3. "Prendre comme référence" from the history: incline 32 × 10',await E(()=>D().rq.idp&&D().rq.idp.w===32&&D().rq.idp.r===10&&D().rq.idp.src==='hist'));
// targets, a notch at a time
const tg=()=>E(()=>{const e=['fdp',3,8,12,120,2];const g=sug('fdp',e,'A');return{w:g.w,r:g.r,t:g.t}});
let g=await tg();
ok(tag+'3. Next target: 36 kg × 10 (one step above 34 × 10 on every set), towards 40 × 10',g.w===36&&g.r===10&&g.t.includes('Reconquête')&&g.t.includes('40 kg × 10'),JSON.stringify(g));
await E(()=>{const l=D().logs.at(-1);l.ex.fdp[2].r=9;save()});g=await tg();
ok(tag+'3. One set short of 10 reps (34 × 9) → stay at 34 until every set gets there',g.w===34&&g.r===10,JSON.stringify(g));
await E(()=>{const l=D().logs.at(-1);l.ex.fdp[2].r=10;save()});
const logFdp=(w,r)=>E(([w,r])=>{const d=D(),ex={fdp:[{w,r},{w,r},{w,r}]};d.logs.push({pr:[],date:Date.now(),wk:'A',dur:50,durSec:3000,ex,note:'',...workoutTotals(ex),tg:{},nx:{}});save()},[w,r]);
await logFdp(36,10);g=await tg();ok(tag+'3. 36 × 10 done → 38 × 10',g.w===38&&g.r===10,JSON.stringify(g));
await logFdp(38,7);g=await tg();ok(tag+'3. 38 × 7 (below the range) → stay at 38, no jump',g.w===38,JSON.stringify(g));
await logFdp(38,10);g=await tg();ok(tag+'3. 38 × 10 → 40 × 10, never above the reference',g.w===40&&g.r===10,JSON.stringify(g));
await logFdp(40,10);g=await tg();ok(tag+'3. 40 × 10 done: reference won back, the usual progression takes over',!g.t.includes('Reconquête'),JSON.stringify(g));
await E(()=>{D().logs=D().logs.filter(l=>!(l.date>=Date.now()-1000));save()});
ok(tag+'3. Off: the usual targets come back',await E(()=>{D().pf.erm=false;const r=!sug('fdp',['fdp',3,8,12,120,2],'A').t.includes('Reconquête');D().pf.erm=true;save();return r}));
// the reference goes into the right workout
await E(()=>{navigate('today');U.pick='A';go()});
const prev=await E(()=>rqApply('A',eff('A')).ex.map(e=>e[0]));
ok(tag+'3. Chest day: the flat dumbbell press takes the place of the chest accessory (same length of workout)',prev.includes('fdp')&&prev.length===await E(()=>eff('A').ex.length)&&!(await E(()=>eff('A').ex.map(e=>e[0]))).includes('fdp'),JSON.stringify(prev));
ok(tag+'3. Today shows it before the start',(await txt()).includes('Développé couché haltères'));
await E(()=>{start('A');go()});
const pl=await E(()=>cx().map((e,i)=>({id:sid(i),rest:e[4],lo:e[2],hi:e[3],w:cur().ex[i][0].w})));
const f=pl.find(x=>x.id==='fdp'),i2=pl.find(x=>x.id==='idp');
ok(tag+'3. The workout that starts is the preview, with the press pre-filled at 36 kg',JSON.stringify(pl.map(x=>x.id))===JSON.stringify(prev)&&f.w===36,JSON.stringify(pl));
ok(tag+'3. Reps around the reference (8-12), and at least 2 min of rest for both presses',f.lo===8&&f.hi===12&&f.rest>=120&&i2.rest>=120,JSON.stringify([f,i2]));
ok(tag+'3. Workouts in Mode Ermite are guided, the screen is stripped down',await E(()=>S.gm)!==false&&await p.locator('.modeb').count()===0&&await p.locator('#v textarea[placeholder="Notes"]').count()===0&&(await txt()).includes('Ermite'));
await p.clock.runFor(600);
ok(tag+'3. The screen is kept on during the workout',await E(()=>window.__wl.req)>0);
await tap(p.locator('#v button',{hasText:'Outils'}));
ok(tag+'3. "⋯ Outils" brings the tools back (swap, busy, plan, notes)',(await txt()).includes('Remplacer')&&await p.locator('.modeb').count()===1);
await tap(p.locator('#v button',{hasText:'Masquer les outils'}));
await E(()=>{U.gi=cx().findIndex((_,i)=>sid(i)==='fdp');go()});
ok(tag+'3. On the press: "🧘 Reconquête : vise 36 kg × 10 — référence 40 kg × 10"',(await txt()).includes('Reconquête : vise 36 kg × 10 — référence 40 kg × 10'));
await E(()=>{const c=cur();Object.values(c.ex).forEach(a=>a.forEach(s=>{s.w=s.w||20;s.r=10;s.ok=1}));save();fin()});await tap(p.locator('#action-accept'));
ok(tag+'3. End of workout: next time 38 kg × 10 🧘',(await txt()).includes('38 kg × 10 🧘'),(await txt()).match(/Développé couché haltères[^→]*→[^\n]{0,30}/)?.[0]);
await p.clock.runFor(1000);
ok(tag+'3. The screen is let go when the workout ends',await E(()=>window.__wl.rel)>0);
await E(()=>{navigate('prg')});
ok(tag+'3. Progress: the reconquest card',(await txt()).includes('🧘 Reconquête')&&(await txt()).includes('Développé couché haltères'));
ok(tag+'3. Fits the screen',await E(()=>document.documentElement.scrollWidth<=innerWidth));
await E(()=>{S.lg='en';save();navigate('set')});
ok(tag+'3. English',(await txt()).includes('Hermit mode')&&(await txt()).includes('References to win back'));
await E(()=>{S.lg='fr';save();go()});

// ======================================================================= 4. saved data
const old=await E(()=>{const raw=JSON.parse(localStorage.getItem('duofit'));for(const k of['M','F']){delete raw.d[k].rq;delete raw.d[k].preLast;delete raw.d[k].pf.erm;delete raw.d[k].pf.gearSeen}return JSON.stringify(raw)});
await E(raw=>{localStorage.setItem('duofit',raw)},old);await p.reload();
ok(tag+'4. A backup from before (no new fields) opens: Mode Ermite off, no references',await E(()=>D().pf.erm===false&&Object.keys(D().rq).length===0));
await E(()=>{const raw=JSON.parse(localStorage.getItem('duofit'));raw.d.M.rq={fdp:{w:40,r:10},xx:{w:1,r:1},idp:{w:-3,r:10},bbp:{w:60,r:'x'}};raw.d.M.preLast={a:'jet',m:9};localStorage.setItem('duofit',JSON.stringify(raw))});await p.reload();
ok(tag+'4. Damaged entries are dropped, good ones kept',await E(()=>JSON.stringify(Object.keys(D().rq))==='["fdp"]'&&D().preLast===undefined));
ok(tag+'No errors, no native dialogs',!errs.length&&await E(()=>window.__nd.length===0),errs.join(' | '));
await ctx.close();
}
console.log(`\n${R.length-fails}/${R.length} passed`);
await b.close();server.close();process.exit(fails?1:0);
})().catch(e=>{console.log('CRASH '+(e.stack||e));process.exit(1)});
