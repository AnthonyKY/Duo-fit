// v2026-11-16 — asked by Invictus after using DUOFIT in the gym:
// 1) reset one exercise (values typed in the wrong exercise), only after a confirmation; the rest of the workout untouched
// 2) the end of a rest says what comes next: another set ("série suivante", as before), the superset partner, the NEXT
//    EXERCISE (named) when the exercise is finished, the cardio, or that everything is done
// 3) supersets chosen in the gym ("faire des exos en parallèle"): pair the exercise with another one, alternate set by set
//    with a 15-second transition, split again; the programme itself is never changed
// 4) the note per exercise keeps its usual look (⚙️ réglages machine, one line, 80 characters), as Invictus prefers
// 5) a timer for each set of the exercises measured in seconds (plank; side plank: each side, 5 s to switch)
// Guided and list modes, FR and EN, an old workout in progress, iPhone SE and 16 Plus (strict iPhone simulation).
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
const tap=loc=>loc.evaluate(el=>el.click()),accept=()=>tap(p.locator('#action-accept')),cancel=()=>tap(p.locator('#action-cancel'));
const type=(sel,v)=>p.locator(sel).evaluate((el,v)=>{el.focus();el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}))},v);
// guided mode: log the set on screen (load and reps typed, as at the gym)
const valid=async()=>{const [i,j]=await E(()=>curPos());await type(`#w${i}_${j}`,'20');await type(`#r${i}_${j}`,'10');await tap(p.locator('#v button:has-text("Valider")'))};
const tm=async()=>(await p.textContent('#tm')).replace(/[  ]/g,' ');
const tag=`[${dev}] `;
const fresh=(gm)=>E(gm=>{for(const k of['M','F']){const d=S.d[k];d.logs=[];d.cur=null;d.notes={}}S.p='M';S.lg='fr';S.gm=gm;U.sum=null;U.tab='today';U.gi=null;U.ss=null;U.sw=null;save();go()},gm);
const plan=()=>E(()=>cx().map((e,i)=>({id:sid(i),n:nm(sid(i)),rest:e[4],pair:e[8]??0,orig:e[7],sets:cur().ex[i].map(s=>[s.w,s.r,s.ok])})));
// a 60-minute workout A with 4 sets of nothing paired yet, guided mode
const startA=async(gm=true)=>{await fresh(gm);await E(()=>{D().pf.time=60;save();start('A');const c=cur();c.cm=0;U.gi=0;save();go()})};

// ======================================================================= 1. reset one exercise
await startA(true);
const p0=await plan();
await tap(p.locator('#v button:has-text("Remettre à zéro")'));
ok(tag+'1. Nothing typed yet: "Remettre à zéro" says there is nothing to erase (no question)',!(await p.isVisible('#action-dialog[open], dialog[open]'))&&(await p.textContent('body')).includes('Rien à effacer'));
await type('#w0_0','47,5');await type('#r0_0','9');await tap(p.locator('#v button:has-text("Valider")'));
await p.clock.runFor(2000);
await type('#w0_1','50');
ok(tag+'1. "↺ Remettre à zéro" is on the exercise',await p.isVisible('#v button:has-text("Remettre à zéro")'));
await tap(p.locator('#v button:has-text("Remettre à zéro")'));
ok(tag+'1. It asks first, naming the exercise',(await p.textContent('#action-title')).includes('Remettre cet exercice à zéro')&&(await p.textContent('#action-detail')).includes(p0[0].n));
await cancel();
let p1=await plan();
ok(tag+'1. "Annuler": nothing erased',p1[0].sets[0][2]===1&&String(p1[0].sets[1][0])==='50',JSON.stringify(p1[0].sets));
await tap(p.locator('#v button:has-text("Remettre à zéro")'));await accept();
p1=await plan();
const sugW=await E(()=>sug(sid(0),cx()[0],cur().wk).w);
ok(tag+'1. Confirmed: every set of the exercise back to the start (suggested load, no reps, nothing logged)',p1[0].sets.every(s=>s[1]===''&&s[2]===0&&s[0]===sugW),JSON.stringify(p1[0].sets));
ok(tag+'1. …and the other exercises are untouched',JSON.stringify(p1.slice(1))===JSON.stringify(p0.slice(1)));
ok(tag+'1. Message shown',(await txt()).includes('remis à zéro')||await E(()=>!!document.querySelector('[role=status]')));
await E(()=>{S.gm=false;save();go()});
await type('#w2_0','30');await type('#r2_0','12');
const rst=p.locator(`#v button[aria-label="Remettre à zéro · ${p0[2].n}"]`);
ok(tag+'1. List mode: "↺" on the exercise typed in by mistake, even before validating (no need to refresh)',await rst.count()===1);
await tap(rst);await accept();
ok(tag+'1. List mode: reset after confirmation',(await plan())[2].sets.every(s=>s[1]===''&&s[2]===0));

// ======================================================================= 2. what the end of a rest says
await startA(true);
let q=await plan();
const restOf=i=>q[i].rest*1000+1000;
await valid();                                                    // set 1 of exercise 1
await p.clock.runFor(restOf(0));
ok(tag+'2. Between two sets: "série suivante" (as before)',(await tm()).includes('série suivante'),(await tm())+' | '+JSON.stringify(await E(()=>({rest:cur().rest,pos:curPos(),gi:U.gi}))));
for(let j=1;j<q[0].sets.length;j++)await valid();
await p.clock.runFor(restOf(0));
ok(tag+'2. Last set of the exercise done: "exercice suivant", with its name',(await tm()).includes('exercice suivant : '+q[1].n),await tm());
await E(()=>{const c=cur();for(let i=0;i<cx().length-1;i++)c.ex[i].forEach(s=>{s.w=s.w||20;s.r=10;s.ok=1});U.gi=null;save();go()});
const lastI=q.length-1;
for(let j=0;j<q[lastI].sets.length;j++)await valid();
await p.clock.runFor(restOf(lastI));
ok(tag+'2. Last exercise of the workout done: says everything is done',(await tm()).includes('tous les exercices sont faits'),await tm());
await E(lastI=>{const c=cur();c.cm=10;c.cmok=0;c.cmv='';c.ex[lastI].at(-1).ok=0;save();go()},lastI);
await valid();await p.clock.runFor(restOf(lastI));
ok(tag+'2. …or that the cardio comes next when there is some',(await tm()).includes('place au cardio'),await tm());
// a workout already running in the old version (its rest has no "next"): the old message, no error
await E(()=>{const c=cur();c.rest={totalMs:5000,remainingMs:5000,end:Date.now()+5000,withSession:false};save();go()});
await p.clock.runFor(6000);
ok(tag+'2. Workout started with the previous version: the usual message',(await tm()).includes('série suivante'));
await E(()=>{S.lg='en';save();go()});
await E(()=>{const c=cur();c.rest={totalMs:5000,remainingMs:5000,end:Date.now()+5000,withSession:false,nx:{k:'ex',n:'Leg press'}};save();go()});
await p.clock.runFor(6000);
ok(tag+'2. English: "next exercise: …"',(await tm()).includes('Rest over — next exercise: Leg press'),await tm());
await E(()=>{S.lg='fr';save();go()});

// ======================================================================= 3. supersets chosen in the gym
await startA(true);
q=await plan();
const progBefore=await E(()=>JSON.stringify(prog()));
await tap(p.locator('#v button:has-text("Enchaîner")').first());
const opts=await p.locator('#v .swp .swr').allTextContents();
ok(tag+'3. "🔁 Enchaîner" lists the other exercises, other muscles first, same muscle flagged',opts.length===q.length-1&&!/même muscle/.test(opts[0]),JSON.stringify(opts));
const partner=q.findIndex((e,i)=>i>1&&opts.some(o=>o.startsWith(e.n)&&o.includes('autre muscle')));
ok(tag+'3. (setup) a partner further down the list, other muscle',partner>1,partner);
await tap(p.locator('#v .swp .swr',{hasText:q[partner].n}).locator('button'));
let s1=await plan();
ok(tag+'3. Paired: the partner moves just after it, one set of each then rest (15-second transition, then its own rest)',
  s1[0].id===q[0].id&&s1[1].id===q[partner].id&&s1[0].pair===1&&s1[1].pair===2&&s1[0].rest===15&&s1[1].rest===q[partner].rest,JSON.stringify(s1.slice(0,2)));
ok(tag+'3. Nothing else lost or reordered',JSON.stringify(s1.slice(2).map(e=>e.id))===JSON.stringify(q.filter((_,i)=>i!==0&&i!==partner).map(e=>e.id)));
ok(tag+'3. The programme itself is unchanged (only this workout)',await E(()=>JSON.stringify(prog()))===progBefore);
ok(tag+'3. Explained on screen',(await txt()).includes('Superset avec'));
await valid();
let g=await E(()=>curPos());
ok(tag+'3. Guided: after a set of the first one, straight to the partner',g[0]===1&&g[1]===0,JSON.stringify(g));
await p.clock.runFor(16000);
ok(tag+'3. 15 s later: "enchaîne avec <partner>"',(await tm()).includes('enchaîne avec '+q[partner].n),await tm());
await valid();
g=await E(()=>curPos());
ok(tag+'3. …then back to the first one for its next set',g[0]===0&&g[1]===1,JSON.stringify(g));
await p.clock.runFor(q[partner].rest*1000+1000);
ok(tag+'3. After the partner\'s set: its full rest, then back to the first exercise',(await tm()).includes('enchaîne avec '+q[0].n),await tm());
await p.reload();await E(()=>{U.gi=null;go()});
s1=await plan();
ok(tag+'3. Kept after reopening the app',s1[0].pair===1&&s1[1].pair===2&&s1[0].rest===15);
await tap(p.locator('#v button:has-text("Séparer")').first());
s1=await plan();
ok(tag+'3. "Séparer": normal rests again, no pair',!s1[0].pair&&!s1[1].pair&&s1[0].rest===q[0].rest,JSON.stringify(s1.slice(0,2)));
await E(()=>{S.gm=false;save();go()});
await tap(p.locator('#v .c',{hasText:q[3].n}).locator('button:has-text("Enchaîner")'));
ok(tag+'3. List mode: the same choice under the exercise',await p.locator('#v .swp .swr').count()>0);
await tap(p.locator('#v .swp .swr').first().locator('button'));
ok(tag+'3. List mode: paired',(await plan()).filter(e=>e.pair).length===2);
// a finished workout keeps its sets whatever the order
await E(()=>{const c=cur();Object.values(c.ex).forEach(a=>a.forEach(s=>{s.w=s.w||20;s.r=10;s.ok=1}));save();fin()});await accept();
const lg=await E(()=>D().logs.at(-1));
ok(tag+'3. Saved workout: every exercise with its sets',Object.keys(lg.ex).length===q.length&&Object.values(lg.ex).every(a=>a.length>0),Object.keys(lg.ex).length+'/'+q.length);

// ======================================================================= 4. the note per exercise, as Invictus prefers it (⚙️, as before)
await startA(true);
q=await plan();
ok(tag+'4. The note keeps its usual look: "⚙️ Ajouter les réglages machine"',(await txt()).includes('Ajouter les réglages machine')&&!(await txt()).includes('📝'));
await tap(p.locator('#v .nlink').first());
ok(tag+'4. One line, 80 characters, as before',await E(id=>{const e=document.getElementById('note_'+id);return e.tagName==='INPUT'&&e.maxLength===80},q[0].id));
await type(`#note_${q[0].id}`,'siège 4, dossier 2');await tap(p.locator('#v .nt button:has-text("OK")'));
ok(tag+'4. Saved and shown with the gear',await E(id=>D().notes[id],q[0].id)==='siège 4, dossier 2'&&(await txt()).includes('⚙️ siège 4, dossier 2'));
await tap(p.locator('#v .nlink').first());await type(`#note_${q[0].id}`,'x'.repeat(80));await tap(p.locator('#v .nt button:has-text("OK")'));
ok(tag+'4. A very long word wraps instead of widening the screen',await E(()=>document.documentElement.scrollWidth<=innerWidth),await E(()=>document.documentElement.scrollWidth+'/'+innerWidth));
await p.reload();
ok(tag+'4. Kept after reopening',await E(id=>D().notes[id],q[0].id)==='x'.repeat(80));

// ======================================================================= 5. a timer per set for the holds
// side plank first (two sides), plank third, as the person would meet them
await fresh(true);
await E(()=>{D().pf.time=60;save();start('A');const c=cur();c.cm=0;ensurePl();
  c.pl[0]=['sp',3,20,45,60,2,c.pl[0][6],c.pl[0][7]];c.ex[0]=Array.from({length:3},()=>({w:0,r:'',ok:0}));
  c.pl[2]=['pl',3,30,60,60,2,c.pl[2][6],c.pl[2][7]];c.ex[2]=Array.from({length:3},()=>({w:0,r:'',ok:0}));
  c.swp={};U.gi=0;save();go()});
const hold=()=>E(()=>cur().hold?{ph:cur().hold.ph,side:cur().hold.side,held:cur().hold.held}:null);
const tgSp=await E(()=>+tgr('sp',cx()[0],0,cur().wk));
ok(tag+'5. Side plank: "⏱ Chrono · série 1 (objectif … s)" above "Valider"',(await txt()).includes(`Chrono · série 1 (objectif ${tgSp} s)`),tgSp);
await E(()=>{const c=cur();c.rest={totalMs:90000,remainingMs:90000,end:Date.now()+90000,withSession:false};save();go()});
await tap(p.locator('#v button.hold-b'));
ok(tag+'5. Tap: 3 seconds to get in position (the rest timer stops: the set starts)',(await hold()).ph==='ready'&&(await txt()).includes('En position')&&await E(()=>!cur().rest));
await p.clock.runFor(3200);
ok(tag+'5. Then the hold counts, side 1/2, target shown',(await hold()).ph==='hold'&&(await txt()).includes('Côté 1/2')&&(await txt()).includes('/ '+Math.floor(tgSp/60)+':'+String(tgSp%60).padStart(2,'0')));
await p.clock.runFor(tgSp*1000+500);
ok(tag+'5. At the target: "Objectif atteint", it keeps counting',(await txt()).includes('Objectif atteint')&&(await p.textContent('#hold-clock'))===Math.floor((tgSp)/60)+':'+String(tgSp%60).padStart(2,'0'),await p.textContent('#hold-clock'));
await p.clock.runFor(4000);
await tap(p.locator('#v .hold button.big'));
let h=await hold();
ok(tag+'5. "Stop" on side 1: 5 s to switch sides',h.ph==='switch'&&h.held[0]===tgSp+4&&(await txt()).includes('Change de côté'),JSON.stringify(h));
await p.clock.runFor(5200);
ok(tag+'5. Side 2 starts by itself',(await hold()).ph==='hold'&&(await txt()).includes('Côté 2/2'));
await p.clock.runFor((tgSp-3)*1000+300);
await tap(p.locator('#v .hold button.big'));
let st=await E(()=>cur().ex[0][0]);
ok(tag+'5. "Stop" on side 2: the set keeps the shorter side and is logged; the rest starts',st.ok===1&&+st.r===tgSp-3&&await E(()=>!cur().hold&&!!cur().rest),JSON.stringify(st));
// lock the phone during a hold: no time lost (reopened 12 s later)
await tap(p.locator('#v button.hold-b'));await tap(p.locator('#v .hold button.big'));   // "Go" skips the 3 s
ok(tag+'5. "Go" skips the countdown',(await hold()).ph==='hold');
await p.clock.runFor(12000);await p.reload();
ok(tag+'5. Phone locked or app reopened: the hold is still running, time kept',(await hold())?.ph==='hold'&&(await p.textContent('#hold-clock'))==='0:12',await p.textContent('#hold-clock'));
await tap(p.locator('#v .hold button[aria-label="Annuler le chrono"]'));
ok(tag+'5. ✕ cancels: nothing saved for the set',await E(()=>!cur().hold&&cur().ex[0][1].ok===0&&cur().ex[0][1].r===''));
// plank (one side), list mode, stopped before the target
await E(()=>{S.gm=false;save();go()});
const plank=p.locator('#v .c',{hasText:'Gainage (secondes)'}).first();
ok(tag+'5. List mode: the plank has its own timer button',await plank.locator('button.hold-b').count()===1);
ok(tag+'5. …and the exercises with repetitions have none (one button per timed exercise still to do)',await E(()=>document.querySelectorAll('#v button.hold-b').length===cx().filter((_,i)=>isT(sid(i))&&cur().ex[i].some(x=>!x.ok)).length&&cx().some((_,i)=>!isT(sid(i)))),await E(()=>JSON.stringify(cx().map((_,i)=>sid(i)))));
await tap(plank.locator('button.hold-b'));await p.clock.runFor(3200+17000);
ok(tag+'5. Plank: one side only (no switch)',!(await txt()).includes('Côté 1/2'));
await tap(plank.locator('.hold button.big'));
st=await E(()=>cur().ex[2][0]);
ok(tag+'5. Stopped before the target: the seconds really held are saved (17 s)',st.ok===1&&+st.r===17,JSON.stringify(st));
ok(tag+'5. Fits the screen',await E(()=>document.documentElement.scrollWidth<=innerWidth));
await E(()=>{S.lg='en';save();go()});
ok(tag+'5. English',(await txt()).includes('⏱ Timer · set 2'));
await E(()=>{S.lg='fr';save();go()});

ok(tag+'No errors, no native dialogs',!errs.length&&await E(()=>window.__nd.length===0),errs.join(' | '));
await ctx.close();
}
console.log(`\n${R.length-fails}/${R.length} passed`);
await b.close();server.close();process.exit(fails?1:0);
})().catch(e=>{console.log('CRASH '+(e.stack||e));process.exit(1)});
