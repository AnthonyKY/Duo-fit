// V2 features A–H, strict iPhone simulation, real defaults (guided mode, back check-in on for Him, real increments).
const {chromium,devices}=require('playwright');const IOS=require('./iosinit.js');
const URL=process.env.URL||'http://localhost:8766/index.html';
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);
const p=await ctx.newPage();p.setDefaultTimeout(8000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const E=(f,a)=>p.evaluate(f,a),txt=async()=>(await p.textContent('#v')).replace(/[  ]/g,' ');
const typ=(loc,v)=>loc.evaluate((el,v)=>{el.focus();el.value='';for(const ch of String(v)){el.value+=ch;el.dispatchEvent(new Event('input',{bubbles:true}))}if(String(v)==='')el.dispatchEvent(new Event('input',{bubbles:true}))},v);
const tap=loc=>loc.evaluate(el=>el.click());
const nav=n=>tap(p.locator('nav button').nth(n));
const accept=()=>tap(p.locator('#action-accept'));
await p.goto(URL);
await E(()=>{for(const k of ['M','F'])S.d[k].pf.var='fix';save();go()}); // exercise rotation is tested in variety.js

// ===== A. Offline =====
await E(()=>navigator.serviceWorker.ready.then(()=>true));await p.reload();
ok('A. Service worker controls the page',await E(()=>!!navigator.serviceWorker.controller));
await ctx.setOffline(true);await p.reload();
ok('A. App opens with no network (airplane mode)',(await p.textContent('nav')).includes('Séance')&&(await txt()).includes('Commencer la séance'));
ok('A. Manifest + home-screen icon are cached',await E(async()=>{const c=await caches.open('duofit-v1');return !!(await c.match(new URL('manifest.webmanifest',location).href))&&!!(await c.match(new URL('icon-180.png',location).href))}));
await ctx.setOffline(false);

// ===== past data for Him: shoulder press 3×12 @ 50 kg (top of range) =====
await E(()=>{const d=S.d.M,now=Date.now();d.logs=[{date:now-3*864e5,wk:'A',dur:50,durSec:3000,ex:{ms:[{w:50,r:12},{w:50,r:12},{w:50,r:12}],idp:[{w:20,r:10},{w:20,r:9},{w:20,r:9}]},note:'',vol:2340,sets:6,pr:[]}];save();go()});
await p.reload();

// ===== E. Real increments in suggestions =====
let g=await E(()=>sug('ms',P.M.A.ex[0],'A'));ok('E. Machine step 5 kg: 50 → 55 kg (10 % jump allowed)',g.w===55,JSON.stringify(g));
await E(()=>{S.d.M.logs[0].ex.ms=[{w:40,r:12},{w:40,r:12},{w:40,r:12}];save()});
g=await E(()=>sug('ms',P.M.A.ex[0],'A'));ok('E. 40 → 45 kg would be +12,5 %: keep 40 kg and aim 15 reps',g.w===40&&g.rep===1&&g.t.includes('15 reps'),g.t);
await nav(5);await tap(p.locator('.incr').nth(1).locator('button').nth(0));
g=await E(()=>sug('ms',P.M.A.ex[0],'A'));ok('E. After choosing 2,5 kg machine steps in Profile: 40 → 42,5 kg',g.w===42.5,JSON.stringify(g));
await tap(p.locator('.incr').nth(1).locator('button').nth(1));
await E(()=>{S.d.M.logs[0].ex.ms=[{w:50,r:12},{w:50,r:12},{w:50,r:12}];save();go()});
ok('E. Gym card visible in Profile with back option',(await txt()).includes('Ta salle & ton dos')&&(await txt()).includes('Bilan dos avant les séances dos'));

// ===== B. Back check-in (Him) =====
await nav(0);await tap(p.locator('button:text-is("A")'));
ok('H. Home shows today\'s target weight (55 kg)',(await txt()).includes('Développé épaules machine 3×8–12 · 55 kg'),(await txt()).match(/Développé épaules machine[^D]*/)?.[0]);
await tap(p.locator('text=Commencer la séance'));
ok('B. Workout A (not a back workout) starts without any back question',await E(()=>!!cur()&&cur().back==null)&&!(await txt()).includes('comment va ton dos'));
await tap(p.locator('.bkbtn'));await tap(p.locator('.bkp button',{hasText:'Gêne légère'}));
let tx=await txt();
ok('B. Mild discomfort: banner + RIR 3 instead of 2',tx.includes('gêne légère')&&tx.includes('RIR 3'),tx.slice(0,300));
ok('B. Mild discomfort: 55 → 45 kg (−10 %, rounded down to a 5 kg step)',await p.inputValue('#w0_0')==='45',await p.inputValue('#w0_0'));
ok('F. List mode is the default (all exercise cards shown, guided only on request)',(await p.locator('#v .c h2').count())>=6&&!(await p.isVisible('.gd')));
await tap(p.locator('.modeb button',{hasText:'Mode guidé'}));tx=await txt();
// ===== F. Guided mode is the default =====
ok('F. Guided mode on request: exercise 1/6 · set 1/3 shown big',tx.includes('Exercice 1/6')&&tx.includes('Série 1/3')&&await p.isVisible('.gd .gx'));
// ===== C. Warm-up =====
ok('C. Warm-up from 45 kg: 25 × 8 · 30 × 4 · 40 × 2',tx.includes('25 kg × 8')&&tx.includes('30 kg × 4')&&tx.includes('40 kg × 2'),(tx.match(/Échauffement.{0,80}/)||[''])[0]);
await tap(p.locator('.chip').first());ok('C. Warm-up chip ticks',await E(()=>cur().wu[0]===true));
// ===== D. Machine settings =====
await tap(p.locator('.nlink').first());await typ(p.locator('#note_ms'),'siège 4, dossier 2');await tap(p.locator('.nt button',{hasText:'OK'}));
ok('D. Machine settings saved and shown',await E(()=>S.d.M.notes.ms==='siège 4, dossier 2')&&(await txt()).includes('⚙️ siège 4, dossier 2'));
// ===== F. Steppers + Valider =====
await tap(p.locator('.stp').nth(0).locator('button').nth(1));ok('F. + weight → 50 kg (machine step 5)',await p.inputValue('#w0_0')==='50');
await tap(p.locator('.stp').nth(0).locator('button').nth(0));ok('F. − weight → 45 kg',await p.inputValue('#w0_0')==='45');
await tap(p.locator('.stp').nth(1).locator('button').nth(1));ok('F. + reps starts from last time (12) → 13',await p.inputValue('#r0_0')==='13',await p.inputValue('#r0_0'));
await tap(p.locator('.stp').nth(1).locator('button').nth(0));await tap(p.locator('.stp').nth(1).locator('button').nth(0));ok('F. − reps twice → 11',await p.inputValue('#r0_0')==='11');
await tap(p.locator('button',{hasText:'Valider la série'}));
tx=await txt();ok('F. Valider logs 45 × 11, starts rest, moves to set 2/3',await E(()=>{const s=cur().ex[0][0];return s.ok===1&&s.w===45&&s.r===11})&&await p.isVisible('#rest-clock')&&tx.includes('Série 2/3'));
ok('F. Set 2 weight pre-filled 45',await p.inputValue('#w0_1')==='45');
await typ(p.locator('#r0_1'),'10');await tap(p.locator('button',{hasText:'Valider la série'}));
await typ(p.locator('#r0_2'),'9');await tap(p.locator('button',{hasText:'Valider la série'}));
ok('F. After 3 sets → exercise 2/6',(await txt()).includes('Exercice 2/6'));
// jump via plan list, toggle full plan and back
await tap(p.locator('.pli').nth(3));ok('F. Tap a plan row jumps to that exercise',(await txt()).includes('Exercice 4/6'));
await tap(p.locator('.modeb button',{hasText:'Liste'}));ok('F. List mode shows every exercise card',(await p.locator('#v .c h2').count())>=6);
await tap(p.locator('.modeb button',{hasText:'Mode guidé'}));ok('F. Back to guided',await p.isVisible('.gd'));
// ===== G. Adapt on the spot =====
await tap(p.locator('.pli').nth(1));const before=await E(()=>cx().map((e,i)=>sid(i)));
await tap(p.locator('.tools button',{hasText:'Machine occupée'}));const after=await E(()=>cx().map((e,i)=>sid(i)));
ok('G. Machine busy: incline press moved to the end',after[after.length-1]==='idp'&&after[1]===before[2],after.join(','));
ok('G. Machine busy: shoulder-press sets kept',await E(()=>cur().ex[0].every(s=>s.ok===1)));
// replace for today only
const lpos=await E(()=>cx().findIndex((e,i)=>sid(i)==='clr'));await tap(p.locator('.pli').nth(lpos));
await tap(p.locator('.tools button',{hasText:'Remplacer'}));await tap(p.locator('.swr',{hasText:'Élévation latérale haltères'}).locator('button',{hasText:"Aujourd'hui"}));
ok('G. Replace for today: DB lateral raise today, program unchanged',await E(l=>sid(l)==='dlr'&&!Object.keys(D().sub).length,lpos));
// time left
await tap(p.locator('button',{hasText:'Il me reste'}));await tap(p.locator('.tlp button',{hasText:'15 min'}));
const rm=await E(()=>({left:Math.ceil(remMin()),n:cx().length}));
ok('G. "15 min left" trims the rest of the session ('+rm.n+' exercises, ≈'+rm.left+' min)',rm.n<6&&(await p.textContent('#notice')).includes('Adapté à 15 min'),await p.textContent('#notice'));
// ===== H. Finish: progress + next targets =====
await tap(p.locator('text=Terminer la séance'));await accept();tx=await txt();
ok('H. Summary lists progress per exercise (45 vs 50 kg → ↓ -5 kg)',tx.includes('La prochaine fois')&&tx.includes('↓ -5 kg'),(tx.match(/La prochaine fois.{0,200}/)||[''])[0]);
ok('H. Next target for shoulder press shown in real weights (45 kg × 8–12)',tx.includes('→ 45 kg × 8–12'));
let log=await E(()=>S.d.M.logs.at(-1));
ok('B. Back level saved in the log, warm-up not counted',log.back===1&&log.ex.ms.length===3&&log.sets>=3);
await tap(p.locator('button',{hasText:"Voir l’historique"}));ok('B. History shows "Dos 😐"',(await txt()).includes('Dos 😐'));
// next session: today-replacement forgotten, settings remembered
await nav(0);await tap(p.locator('button:text-is("A")'));await tap(p.locator('text=Commencer la séance'));
ok('G. Next session: original lateral raise is back (today-only swap)',await E(()=>cx().some((e,i)=>sid(i)==='clr')&&!cx().some((e,i)=>sid(i)==='dlr')));
ok('D. Settings remembered next session',(await txt()).includes('siège 4, dossier 2'));
ok('F. Guided choice remembered for the next session',await p.isVisible('.gd'));
ok('B. No back adjustment unless asked → no banner, normal RIR 2',!(await txt()).includes('gêne légère')&&(await txt()).includes('RIR 2'));
await tap(p.locator('#v >> text=Abandonner'));await accept();
// pain → −20 %, safest variants, no cardio
await E(()=>{S.d.M.pf.goal='loss';save()});await tap(p.locator('button:text-is("A")'));await tap(p.locator('text=Commencer la séance'));await tap(p.locator('.bkbtn'));await tap(p.locator('.bkp button',{hasText:'Douleur'}));
tx=await txt();const ids=await E(()=>cx().map((e,i)=>sid(i)));
ok('B. Pain: banner tells when to stop',tx.includes('descend dans la jambe'));
ok('B. Pain: no loaded spinal flexion or axial exercise (Pallof press instead of cable crunch), no cardio',ids.includes('pal')&&!ids.some(x=>['cc','dsp','ssq','hsq','rdl'].includes(x))&&await E(()=>!cur().cm),ids.join(','));
ok('B. Pain: shoulder press suggestion −20 % (45 → 35 kg)',await p.inputValue('#w0_0')==='35',await p.inputValue('#w0_0'));
await tap(p.locator('#v >> text=Abandonner'));await accept();await E(()=>{S.d.M.pf.goal='gain';save()});
// Her: back check-in off by default → starts directly
await tap(p.locator('.pf >> text=Elle'));await tap(p.locator('text=Commencer la séance'));
ok('B. Her profile (check-in off by default) starts directly',await E(()=>!!cur()));
ok('D. Settings are per profile (none for Her)',await E(()=>!Object.keys(S.d.F.notes||{}).length));
await tap(p.locator('#v >> text=Abandonner'));await accept();
// ===== Old-format data & old in-progress session (v13i) still load =====
const c2=await b.newContext({...devices['iPhone 13'],locale:'fr-FR'});await c2.addInitScript(IOS);const q=await c2.newPage();const e2=[];q.on('pageerror',e=>e2.push(e.message));
await q.addInitScript(()=>{if(localStorage.getItem('duofit'))return;localStorage.setItem('duofit',JSON.stringify({p:'M',lg:'fr',d:{M:{logs:[],sched:{1:'A'},hd:[],ms:[],sub:{A1:'lip'},cur:{wk:'A',start:Date.now()-60000,ex:{0:[{w:40,r:'',ok:0},{w:'',r:'',ok:0},{w:'',r:'',ok:0}],1:[{w:'',r:'',ok:0}],2:[{w:'',r:'',ok:0}],3:[{w:'',r:'',ok:0}],4:[{w:'',r:'',ok:0}],5:[{w:'',r:'',ok:0}]},note:'',pl:[["ms",3,8,12,120,2,2.5],["idp",1,8,12,120,2,2],["clr",1,12,15,60,1,1.25],["pd",1,12,15,75,1,2.5],["rpd",1,10,15,60,1,2.5],["cc",1,10,15,60,2,2.5]],cm:0}},F:{logs:[],sched:{},hd:[],ms:[],sub:{}}}}))});
await q.goto(URL);await q.evaluate(()=>{});const qt=await q.textContent('#v');
ok('Migration: v13i in-progress session opens (list mode, permanent swap kept)',qt.includes('Développé incliné machine')&&await q.evaluate(()=>sid(1)==='lip'),e2.join('|'));
await q.locator('#v .c').filter({has:q.locator('h2')}).first().locator('.hb >> text=⏭').evaluate(e=>e.click());ok('Migration: machine busy works on an old session',await q.evaluate(()=>sid(5)==='ms'&&sid(0)==='lip'&&cx()[0][7]===1),JSON.stringify(await q.evaluate(()=>cx().map((e,i)=>[sid(i),e[7]]))));
ok('Migration: no errors',!e2.length,e2.join('|'));await c2.close();
// ===== EN, layout, dialogs, errors =====
await tap(p.locator('.pf >> text=Lui'));await tap(p.locator('button:text-is("B")'));await tap(p.locator('text=Commencer la séance'));
ok('B. Workout B (Back & Arms) asks the back check-in',(await txt()).includes('comment va ton dos'));await tap(p.locator('button',{hasText:'Ça va'}));ok('B. "Fine" recorded, no banner, no extra button',await E(()=>cur().back===0)&&!(await p.isVisible('.bkbtn'))&&!(await p.isVisible('.bkb')));await tap(p.locator('#v >> text=Abandonner'));await accept();
await tap(p.locator('button:text-is("C")'));await tap(p.locator('text=Commencer la séance'));ok('B. Workout C (legs) starts without any back question',await E(()=>!!cur()&&cur().wk==='C'));await tap(p.locator('#v >> text=Abandonner'));await accept();
await tap(p.locator('.pf >> text=EN'));await tap(p.locator('button:text-is("A")'));await tap(p.locator('text=Start workout'));
const enScreens=[];enScreens.push(await txt());await tap(p.locator('.bkbtn'));enScreens.push(await txt());await tap(p.locator('.bkp button',{hasText:'Mild discomfort'}));enScreens.push(await txt());
await tap(p.locator('.tools button',{hasText:'Replace'}));enScreens.push(await txt());await tap(p.locator('button',{hasText:'I only have'}));enScreens.push(await txt());
await tap(p.locator('.nlink').first());enScreens.push(await txt());await nav(5);enScreens.push(await txt());
const fr=enScreens.flatMap(s=>(s.replace(/Lui|Elle|siège 4, dossier 2/g,'').match(/[^\s]*[éèàùçêô][^\s]*/g)||[]));
ok('EN: check-in, guided view, swap panel, time-left, settings, gym card fully translated',!fr.length,[...new Set(fr)].slice(0,8).join(' '));
await tap(p.locator('.pf >> text=FR'));await nav(0);await tap(p.locator('#v >> text=Abandonner'));await accept();
for(const dev of ['iPhone SE','iPhone 15 Pro Max']){const c3=await b.newContext({...devices[dev],locale:'fr-FR'});await c3.addInitScript(IOS);const z=await c3.newPage();await z.goto(URL);
 const ov=async()=>z.evaluate(()=>document.documentElement.scrollWidth>innerWidth);let bad=[];
 await z.evaluate(()=>{U.pick='B';go()});await z.locator('text=Commencer la séance').click();if(await ov())bad.push('check-in');await z.locator('button',{hasText:'Douleur'}).click();if(await ov())bad.push('list');await z.locator('.modeb button',{hasText:'Mode guidé'}).click();if(await ov())bad.push('guided');
 await z.locator('.tools button',{hasText:'Remplacer'}).click();if(await ov())bad.push('swap');await z.locator('button',{hasText:'Il me reste'}).click();if(await ov())bad.push('timeleft');
 await z.locator('.nlink').first().click();if(await ov())bad.push('note');await z.locator('nav button').nth(5).click();if(await ov())bad.push('profile');
 await z.screenshot({path:'/tmp/claude-0/-home-claude/7e1fe2dc-1877-52f6-b2c7-f7496aa5b426/scratchpad/v2_'+dev.replace(/ /g,'')+'.png',fullPage:false});
 ok('No horizontal overflow on '+dev+' (check-in, list, guided, swap, time-left, settings, profile)',!bad.length,bad.join(','));await c3.close()}
ok('No native alert/confirm',(await E(()=>window.__nd.length))===0,JSON.stringify(await E(()=>window.__nd)));
ok('No JavaScript errors',!errs.length,errs.join(' | '));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();process.exit(fails?1:0)})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,3).join(' '));process.exit(2)});
