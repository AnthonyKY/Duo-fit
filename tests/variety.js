// Variety: drawn exercises per slot, block rotation of main lifts, warm-up, time budget, exclusions, pins — strict iPhone simulation, real defaults.
const {chromium,devices}=require('playwright');const IOS=require('./iosinit.js');
const URL=process.env.URL||'http://localhost:8766/index.html';
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);
const p=await ctx.newPage();p.setDefaultTimeout(8000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const E=(f,a)=>p.evaluate(f,a),txt=async()=>(await p.textContent('#v')).replace(/[  ]/g,' ');
const tap=loc=>loc.evaluate(el=>el.click());
const nav=n=>tap(p.locator('nav button').nth(n));
const accept=()=>tap(p.locator('#action-accept'));
const DAY=864e5;let now=Date.UTC(2026,10,16,9);await p.clock.setFixedTime(now); // Monday 16 Nov 2026
await p.goto(URL);await p.waitForTimeout(100);
// helpers running in the page
const plan=w=>E(w=>{S.p=S.p;const e=eff(w);return e.ex.map(x=>x[0])},w);
const doSession=async(w)=>{ // start, log the first set of each exercise, save
  await E(w=>{U.pick=w;go();begin(w);if(U.chk)start(w,0)},w);
  await E(()=>{cx().forEach((e,i)=>{const id=sid(i);setv(i,0,'w',isBW(id)?'':'20');setv(i,0,'r',String(e[2]));done(i,0)})});
  await E(()=>fin());await accept();await E(()=>{U.sum=null;go()});
};
const advance=async days=>{now+=days*DAY;await p.clock.setFixedTime(now)};

// ===== 1. Defaults =====
ok('1. New profiles rotate all exercises by default',await E(()=>S.d.M.pf.var==='max'&&S.d.F.pf.var==='max'));
ok('1. The default Him profile avoids overhead pressing and axial loading',await E(()=>S.d.M.pf.noOverhead&&eff('A').ex.every(e=>!['ms','dsp','ssq','hsq','rdl'].includes(e[0]))));
// The following block exercises explicitly selected balanced mode and its reference lifts.
await E(()=>{for(const k of ['M','F'])S.d[k].pf.var='bal';S.d.M.pf.noOverhead=false;save();go()});
await E(()=>{S.p='M';U.pick='A';go()});
ok('1. Block anchor set on first view',await E(()=>Number.isFinite(S.d.M.pf.r0)));
let tx=await txt();
ok('1. Today shows warm-up line, main tags, 🎲 button and block end date',tx.includes('🔥 Échauffement')&&tx.includes('principal')&&tx.includes('Tirer d\'autres exercices')&&tx.includes('Exercices principaux gardés jusqu'),tx.slice(0,400));
ok('1. No "new" tag noise for a brand-new profile',!tx.includes('nouveau'));

// ===== 2. Preview = what starts =====
for(const w of ['A','B','C']){const pv=await plan(w);await E(w=>{U.pick=w;go();begin(w);if(U.chk)start(w,0)},w);
  const st=await E(()=>cx().map((e,i)=>sid(i)));ok(`2. ${w}: session starts with exactly the previewed exercises`,JSON.stringify(pv)===JSON.stringify(st),pv.join(',')+' | '+st.join(','));
  await tap(p.locator('#v >> text=Abandonner'));await accept()}
ok('2. Draw survives a reload (same preview)',await (async()=>{const a=await plan('A');await p.reload();await p.waitForTimeout(100);return JSON.stringify(a)===JSON.stringify(await plan('A'))})());

// ===== 3. Safety and coherence over many draws =====
const audit=await E(()=>{const bad=[];for(const pf of ['M','F']){S.p=pf;for(const w of ['A','B','C'])for(let n=0;n<60;n++){draw(w,true);const d=D().draw[w],ids=[...d.ids,...d.bon];
  if(new Set(ids).size!==ids.length)bad.push(pf+w+' duplicate '+ids);
  ids.forEach((id,o)=>{const s=slotOf(w,o);if(!allowed(s[0],s[2]).includes(id))bad.push(pf+w+o+' not in pool '+id);
    if(D().pf.back&&AX.includes(id))bad.push(pf+w+' spinal '+id);if(D().pf.lvl==='beg'&&E[id][5]>0&&id!==s[2])bad.push(pf+w+' level '+id)})}}S.p='M';go();return bad});
ok('3. 360 draws: no duplicates, always in the slot pool, never axial/flexion for Him, beginner-level only for Her',!audit.length,audit.slice(0,5).join(' ; '));
const variety=await E(()=>{S.p='M';const seen={};for(let n=0;n<40;n++){draw('A',true);const id=D().draw.A.ids[2];seen[id]=1}return Object.keys(seen)});
ok('3. Lateral-raise slot uses several variants ('+variety.length+')',variety.length>=4,variety.join(','));
ok('3. Him: cable crunch never drawn, Pallof/plank/dead bug/side plank instead',await E(()=>{S.p='M';for(let n=0;n<40;n++){draw('A',true);if(D().draw.A.ids.includes('cc'))return false}return true}));

// ===== 4. Balanced: mains stay, accessories change every session =====
await E(()=>{S.p='M';delete S.d.M.draw.A;save()});
const mainsA=(await plan('A')).slice(0,2),hist=[];
const consumed=[];for(let k=0;k<4;k++){const pl=await plan('A');hist.push(pl);await doSession('A');consumed.push(await E(pl=>!S.d.M.draw.A||JSON.stringify(S.d.M.draw.A.ids)!==JSON.stringify(pl),pl));await advance(2)}
ok('4. Main lifts identical over 4 sessions in the same block',hist.every(h=>h[0]===mainsA[0]&&h[1]===mainsA[1]),hist.map(h=>h.slice(0,2).join('+')).join(' | '));
const rep=[];for(let k=1;k<hist.length;k++)for(const o of [2,3,4,5]){if(hist[k][o]===hist[k-1][o])rep.push(k+':'+o+':'+hist[k][o])}
ok('4. Accessories (pools ≥2) never repeat the previous A session',!rep.length,rep.join(',')+' — '+hist.map(h=>h.slice(2).join('+')).join(' | '));
ok('4. Each saved workout consumes its draw (next A is a new draw)',consumed.every(Boolean)&&await E(()=>S.d.M.logs.length===4),JSON.stringify(consumed));
ok('4. "new" tag appears for exercises never done once history exists',await E(()=>{const nd=PAT.lat.find(x=>!S.d.M.logs.some(l=>l.ex[x]));if(!nd)return false;D().sub.A2=nd;U.pick='A';go();const r=[...document.querySelectorAll('.exl')].some(e=>e.textContent.includes(nm(nd))&&e.textContent.includes('nouveau'))&&![...document.querySelectorAll('.exl')].some(e=>e.textContent.includes('Développé épaules machine')&&e.textContent.includes('nouveau'));delete D().sub.A2;go();return r}));
// next block: shift the anchor back 4 weeks
const blk=await E(()=>{const r=S.d.M.pf.r0;S.d.M.pf.r0=r-4;const a=eff('A').ex.map(x=>x[0]),c=eff('C').ex.map(x=>x[0]),bi=blkInfo().b;S.d.M.pf.r0=r;return{a,c,bi}});
ok('4. New block: incline press rotates (idp → lip), leg press → belt squat; shoulder press stays (only safe option)',blk.bi===1&&blk.a[0]==='ms'&&blk.a[1]==='lip'&&blk.c[0]==='bsq',JSON.stringify(blk));
ok('4. Beginner block = 6 weeks',await E(()=>{S.p='F';const L=blkLen();S.p='M';return L===6}));

// ===== 5. Reroll =====
await E(()=>{U.pick='A';go()});const before=await plan('A');await tap(p.locator('#v button:has-text("Tirer d\'autres exercices")'));const after=await plan('A');
ok('5. 🎲 changes accessories, keeps main lifts',before[0]===after[0]&&before[1]===after[1]&&before.slice(2).some((x,i)=>x!==after.slice(2)[i]),before.join(',')+' → '+after.join(','));
ok('5. Notice shown',(await p.textContent('#notice')).includes('Nouveaux exercices'));

// ===== 6. Not in my gym (during a session) =====
await E(()=>{U.pick='A';go();begin('A')});const lat=await E(()=>sid(2));
await tap(p.locator('#v .c:not(.wuc)').nth(2).locator('button[aria-label^="Remplacer"]'));
await tap(p.locator('#v .swp button:has-text("Pas dans ma salle")'));
const lat2=await E(()=>sid(2));
ok('6. "Pas dans ma salle" replaces it today and excludes it',lat2!==lat&&await E(id=>S.d.M.pf.no.includes(id),lat),lat+' → '+lat2);
ok('6. Excluded exercise never drawn again',await E(id=>{for(let n=0;n<40;n++){draw('A',true);if(D().draw.A.ids.includes(id))return false}return true},lat));
await tap(p.locator('#v >> text=Abandonner'));await accept();
await nav(5);tx=await txt();
ok('6. Profile lists it under "Pas dans ma salle / exclus"',tx.includes('Pas dans ma salle / exclus')&&tx.includes(await E(id=>nm(id),lat)));
await tap(p.locator('#varc .chip').first());ok('6. Chip ✕ allows it again',await E(id=>!S.d.M.pf.no.includes(id),lat));
// library toggle
await nav(2);await tap(p.locator('#ll .c').filter({hasText:'Élévation latérale machine'}).locator('button:has-text("Pas dans ma salle")'));
ok('6. Library: exclude from the exercise card',await E(()=>S.d.M.pf.no.includes('mlr'))&&(await p.locator('#ll .c').filter({hasText:'Élévation latérale machine'}).textContent()).includes('Réautoriser'));
await tap(p.locator('#ll .c').filter({hasText:'Élévation latérale machine'}).locator('button:has-text("Réautoriser")'));ok('6. Library: allow again',await E(()=>!S.d.M.pf.no.includes('mlr')));

// ===== 7. Pin =====
await E(()=>{U.tab='today';U.pick='A';go();begin('A')});const pinned=await E(()=>sid(3));
await tap(p.locator('#v .c:not(.wuc)').nth(3).locator('button[aria-label^="Remplacer"]'));await tap(p.locator('#v .swp button:has-text("Garder à chaque fois")'));
ok('7. 📌 keeps the exercise in its slot',await E(id=>S.d.M.sub.A3===id,pinned));
await doSession2();async function doSession2(){await E(()=>{cx().forEach((e,i)=>{setv(i,0,'w',isBW(sid(i))?'':'20');setv(i,0,'r',String(e[2]));done(i,0)})});await E(()=>fin());await accept();await E(()=>{U.sum=null;go()})}
await advance(2);
ok('7. Next A still has the pinned exercise (rotation skips it)',(await plan('A'))[3]===pinned);
ok('7. Home shows 📌',(await txt()).includes('📌'));
await nav(5);await tap(p.locator('#varc .chip').filter({hasText:'A ·'}));
ok('7. Unpin from Profile → slot rotates again',await E(()=>!S.d.M.sub.A3));

// ===== 8. Modes =====
await E(()=>{spf('var','fix')});ok('8. Fixed mode = the base program',JSON.stringify(await plan('A'))===JSON.stringify(await E(()=>P.M.A.ex.map(e=>e[0]))));
ok('8. Fixed mode hides 🎲',!(await E(()=>{U.tab='today';U.pick='A';go();return document.getElementById('v').textContent})).includes('Tirer d'));
await E(()=>{spf('var','max')});const mx=await E(()=>{const s=new Set();for(let n=0;n<30;n++){draw('A',true);s.add(D().draw.A.ids[1])}return[...s]});
ok('8. Maximum mode also rotates main lifts',mx.length>=2,mx.join(','));
await E(()=>{spf('var','bal')});

// ===== 9. Time budget =====
const tb=await E(()=>{const out={};for(const pf of ['M','F'])for(const tm of [30,45,60,75,90]){S.p=pf;D().pf.time=tm;for(const w of ['A','B','C']){const e=eff(w);out[pf+w+tm]={n:e.ex.length,dur:e.dur,est:est(e.ex,e.cm,e.wm),wm:e.wm,wu:e.wu.length,bon:e.bon,main:e.ex.slice(0,2).map(x=>x[1]),sets:e.ex.map(x=>x[1])}}D().pf.time=60}S.p='M';return out});
const over=Object.entries(tb).filter(([k,v])=>v.est>+k.slice(2)||v.dur!==Math.ceil(v.est)).map(([k,v])=>k+':'+v.est.toFixed(1));
ok('9. Every workout fits its budget (30-90 min, both profiles)',!over.length,over.join(' '));
ok('9. 30 min keeps ≥3 exercises and reserves cardio, drills and ramp-up time',['MA30','MB30','MC30','FA30','FB30','FC30'].every(k=>tb[k].n>=3&&tb[k].wm>=5&&tb[k].wm<=9),JSON.stringify(tb.MA30));
ok('9. 45 min: accessories at 2 sets rather than dropped',tb.MA45.n>=5&&tb.MA45.sets.slice(2).some(s=>s===2),JSON.stringify(tb.MA45));
ok('9. 75 min: +1 set on main lifts and a bonus exercise',tb.MA75.main.every(s=>s===4)&&tb.MA75.bon>=1&&tb.MA75.n===7,JSON.stringify(tb.MA75));
ok('9. Warm-up grows with time (30 < 60 < 90)',tb.MA30.wm<tb.MA60.wm&&tb.MA60.wm<tb.MA90.wm,[tb.MA30.wm,tb.MA60.wm,tb.MA90.wm].join('<'));
await nav(5);await tap(p.locator('.sg button',{hasText:'30 min'}));await E(()=>{U.tab='today';U.pick='A';go()});tx=await txt();
ok('9. Profile 30 min → Today shows the shorter workout',tx.includes(await E(()=>{const e=eff("A");return t("durE")(e.dur,e.wm)}))&&await E(()=>eff("A").dur<=30)&&tx.includes("Répartition du temps"),tx.match(/≈[^.]*\./)?.[0]);
await nav(5);await tap(p.locator('.sg button',{hasText:'75 min'}));await E(()=>{U.tab='today';U.pick='A';go()});tx=await txt();
ok('9. 75 min → bonus noted on Today',tx.includes('bonus')&&tx.includes('exercices principaux'),tx.match(/≈[^🎲]*/)?.[0]);
await nav(5);await tap(p.locator('.sg button',{hasText:'60 min'}));

// ===== 10. Warm-up in the session =====
await E(()=>{U.tab='today';U.pick='A';go();begin('A')});
const wc=await E(()=>({n:document.querySelectorAll('.wur').length,d:cur().wd.d,g:cur().wd.g}));
ok('10. Session opens with the warm-up checklist (cardio + 3 drills at 60 min)',wc.n===4,JSON.stringify(wc));
ok('10. Him (sensitive back): bird dog in every upper-body warm-up',wc.d.includes('bdg'));
ok('10. Rower never proposed to Him',await E(()=>{for(let n=0;n<40;n++){draw('B',true);if(D().draw.B.g==='row')return false}return true}));
await tap(p.locator('.wur').nth(0));ok('10. Tap ticks a drill',await E(()=>cur().wd.ok[0]===true)&&(await p.locator('.wur.ok').count())===1);
for(let j=1;j<4;j++)await tap(p.locator('.wur').nth(j));
ok('10. All ticked → card folds into one line',(await p.locator('.wur').count())===0&&(await txt()).includes('4/4 ✓'));
await tap(p.locator('.wub'));ok('10. Can reopen it',(await p.locator('.wur').count())===4);
await tap(p.locator('.wuc button:has-text("Échauffement terminé")'));ok('10. "Échauffement terminé" folds it',(await p.locator('.wur').count())===0);
await E(()=>{setv(0,0,'w','40');setv(1,0,'w','20');go()});tx=await txt();
ok('10. Ramp-up sets on 1st exercise + one feeler set on the 2nd main lift (other muscle)',(await p.locator('.wu .chip').count())>=2&&await E(()=>wuHtml(1).includes('× 6')),await E(()=>wuHtml(1)));
await tap(p.locator('#v >> text=Abandonner'));await accept();
await E(()=>{U.pick='C';go();begin('C');if(U.chk)start('C',0)});
ok('10. Leg day for Him: McGill big 3 (curl-up, side plank, bird dog) in the warm-up',await E(()=>['cup','spw','bdg'].every(x=>cur().wd.d.includes(x))),await E(()=>cur().wd.d.join(',')));
await tap(p.locator('#v >> text=Abandonner'));await accept();
// guided mode shows it too
await E(()=>{S.gm=true;U.pick='A';go();begin('A')});ok('10. Guided mode shows the warm-up card',(await p.locator('.wuc').count())===1);
await tap(p.locator('#v >> text=Abandonner'));await accept();await E(()=>{S.gm=false;save()});

// ===== 11. Timed and per-side exercises =====
const sp=await E(()=>{S.p='M';D().sub.A5='sp';const e=eff('A').ex[5];delete D().sub.A5;return e.slice(1,4)});
ok('11. Side plank in the core slot gets seconds (20-45)',sp[1]===20&&sp[2]===45,JSON.stringify(sp));
await E(()=>{D().sub.C5='sp';U.pick='C';go();begin('C');if(U.chk)start('C',0)});
ok('11. Side plank card labelled in seconds',(await p.locator('#v .c:not(.wuc)').filter({hasText:'Gainage latéral'}).first().textContent()).includes('20–45 s'));
await tap(p.locator('#v >> text=Abandonner'));await accept();await E(()=>{delete D().sub.C5;save()});

// ===== 12. Her profile =====
await E(()=>{switchProfile('F');U.pick='A';go()});tx=await txt();
ok('12. Her: Today shows her drawn workout + warm-up',tx.includes('🔥 Échauffement')&&tx.includes('Presse à cuisses'),tx.slice(0,300));
const her=await E(()=>{const out=[];for(let n=0;n<30;n++){for(const w of ['A','B','C']){draw(w,true);out.push(...D().draw[w].ids,...D().draw[w].bon)}}return[...new Set(out)]});
ok('12. Her beginner pools stay on simple machines/cables (no Smith hip thrust, no RDL, no hack squat)',!her.some(x=>['sht','rdl','hsq','ulp','fdp','dsp'].includes(x)),her.join(','));
await E(()=>{spf('lvl','int')});const her2=await E(()=>{const out=new Set();for(let n=0;n<40;n++)for(const w of ['A','C']){draw(w,true);D().draw[w].ids.forEach(x=>out.add(x))}return[...out]});
ok('12. Her intermediate: unlocks Smith hip thrust / hack squat / RDL',her2.some(x=>['sht','hsq','rdl'].includes(x)),her2.join(','));
await E(()=>{spf('lvl','beg');switchProfile('M')});

// ===== 13. Storage =====
const imp=await E(()=>{const raw=JSON.parse(JSON.stringify(S));raw.d.M.draw.A={sig:'x',ids:['nope'],bon:[],wu:['zz'],g:'bike'};raw.d.M.pf.var='weird';raw.d.M.pf.no=['clr','ghost'];
  try{const st=readState(JSON.stringify(raw));return{draw:!st.d.M.draw.A,var:st.d.M.pf.var,no:st.d.M.pf.no}}catch(e){return{err:e.message}}});
ok('13. Corrupted draw / variety settings are repaired on load',imp.draw&&imp.var==='max'&&JSON.stringify(imp.no)==='["clr"]',JSON.stringify(imp));
const legacy=await E(()=>{const raw={p:'M',d:{M:{logs:[],sched:{1:'A'},hd:[],ms:[],sub:{},cur:null},F:{logs:[],sched:{},hd:[],ms:[],sub:{},cur:null}}};const st=readState(JSON.stringify(raw));return st.d.M.pf.var+'|'+JSON.stringify(st.d.M.draw)});
ok('13. Old backups load with variety on and an empty draw',legacy==='max|{}',legacy);
ok('13. A session started before this update (no warm-up data) still renders',await E(()=>{U.pick='A';go();begin('A');delete cur().wd;go();const okk=document.getElementById('v').textContent.includes('Développé');return okk}));
await tap(p.locator('#v >> text=Abandonner'));await accept();

// ===== 14. English + layout =====
await E(()=>{S.lg='en';U.tab='today';U.pick='A';go()});tx=await txt();
ok('14. EN: Today in English',tx.includes('Warm-up')&&tx.includes('Draw other exercises')&&tx.includes('main'),tx.slice(0,300));
await nav(5);tx=await txt();ok('14. EN: variety card',tx.includes('Exercise variety')&&tx.includes('Balanced'));
await E(()=>{S.lg='fr';go()});
for(const dev of ['iPhone SE','iPhone 13']){const c=await b.newContext({...devices[dev],locale:'fr-FR'});await c.addInitScript(IOS);const q=await c.newPage();await q.goto(URL);await q.waitForTimeout(100);const ov=[];
  for(const pf of ['M','F']){await q.evaluate(pf=>{S.p=pf;S.d[pf].pf.time=90;go()},pf);
    for(const w of ['A','B','C']){await q.evaluate(w=>{U.tab='today';U.pick=w;go()},w);if(await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth))ov.push(pf+w+'home');
      await q.evaluate(w=>{begin(w);if(U.chk)start(w,0)},w);if(await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth))ov.push(pf+w+'session');
      await q.evaluate(()=>{U.sw=2;go()});if(await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth))ov.push(pf+w+'swap');
      await q.evaluate(()=>{writeSessionEnd(null);clearView();go()})}
    await q.evaluate(()=>{U.tab='set';go()});if(await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth))ov.push(pf+'profile')}
  if(dev==='iPhone SE'&&process.env.SHOT_DIR){await q.evaluate(()=>{S.p='M';U.tab='today';U.pick='A';go()});await q.screenshot({path:process.env.SHOT_DIR?process.env.SHOT_DIR+'/var_home_se.png':'/dev/null',fullPage:true});
    await q.evaluate(()=>{begin('A');go()});await q.screenshot({path:process.env.SHOT_DIR?process.env.SHOT_DIR+'/var_session_se.png':'/dev/null',fullPage:false});
    await q.evaluate(()=>{writeSessionEnd(null);U.tab='set';go()});const y=await q.evaluate(()=>document.getElementById('varc').getBoundingClientRect().top+scrollY-80);await q.evaluate(y=>scrollTo(0,y),y);await q.screenshot({path:process.env.SHOT_DIR?process.env.SHOT_DIR+'/var_profile_se.png':'/dev/null'})}
  ok(`14. ${dev}: no horizontal overflow (home, session, ⇄ panel, profile at 90 min)`,!ov.length,ov.join(','));await c.close()}

// ===== 15. Ported from astra's V2: red flag, nothing lost on replace, right units =====
await E(()=>{S.p='M';S.lg='fr';S.d.M.pf.back=true;U.tab='today';U.pick='B';go();begin('B')});
await tap(p.locator('.bkx',{hasText:'Douleur'}));tx=await txt();
ok('15. Pain at check-in → asks about pain going down the leg',tx.includes('descend-elle dans la jambe')&&await E(()=>!cur()));
await tap(p.locator('.bkx',{hasText:'Oui'}));tx=await txt();
ok('15. "Oui" → no weight training today, see a doctor, emergency signs; nothing started',tx.includes('Pas de musculation aujourd')&&tx.includes('médecin')&&tx.includes('15')&&await E(()=>!cur()));
await tap(p.locator('#v button',{hasText:'Fermer'}));ok('15. Close → back to Today',(await txt()).includes('Commencer la séance')&&await E(()=>!U.chk&&!U.rf));
await E(()=>{begin('B')});await tap(p.locator('.bkx',{hasText:'Douleur'}));await tap(p.locator('.bkx',{hasText:'Non'}));
ok('15. "Non" → adapted workout (pain level, −20 %)',await E(()=>!!cur()&&cur().back===2));
await tap(p.locator('#v >> text=Abandonner'));await accept();
await E(()=>{U.pick='A';go();begin('A')});await tap(p.locator('.bkbtn'));await tap(p.locator('.bkp button',{hasText:'Douleur'}));await tap(p.locator('.bkx',{hasText:'Oui'}));
ok('15. Same red-flag question during a workout, with "finish now (keeps what you did)"',(await txt()).includes('Terminer la séance maintenant'));
await tap(p.locator('#v button',{hasText:'Annuler'}));
// replace after logging: nothing lost
const before15=await E(()=>{const n=cur().ex[2].length;setv(2,0,'w','6');setv(2,0,'r','14');done(2,0);setv(2,1,'w','6');setv(2,1,'r','13');done(2,1);return{n,id:sid(2),len:cx().length}});
const alt15=await E(()=>{const s=slotOf(cur().wk,oix(2));return allowed(s[0],s[2]).find(x=>x!==sid(2))});
await E(alt=>swapTo(2,alt,0),alt15);
const after15=await E(()=>({len:cx().length,a:sid(2),b:sid(3),ka:cur().ex[2].map(s=>s.ok),kb:cur().ex[3].length}));
ok('15. Replace after 2 logged sets: they stay on the old exercise, the remaining sets go to the new one',after15.len===before15.len+1&&after15.a===before15.id&&after15.b===alt15&&after15.ka.every(Boolean)&&after15.ka.length===2&&after15.kb===before15.n-2,JSON.stringify({before15,after15}));
ok('15. No confirmation needed (nothing is discarded)',!(await E(()=>$('action-dialog').open)));
await E(()=>{const n=cx().length;for(let i=0;i<n;i++){const id=sid(i);if(!cur().ex[i][0].ok){setv(i,0,'w',isBW(id)?'':'10');setv(i,0,'r',String(cx()[i][2]));done(i,0)}}});
await E(()=>fin());await accept();const lg15=await E(()=>D().logs.at(-1).ex);
ok('15. Saved workout has both exercises with their own sets',lg15[before15.id]?.length===2&&lg15[alt15]?.length>=1,JSON.stringify(Object.keys(lg15)));
await E(()=>{U.sum=null;go()});
await E(()=>{U.pick='A';go();begin('A');for(let j=0;j<cur().ex[0].length;j++){setv(0,j,'w','40');setv(0,j,'r','10');done(0,j)}});
await E(()=>swapTo(0,'dsp',0));ok('15. All sets already entered → nothing replaced, explained',await E(()=>sid(0)==='ms')&&(await p.textContent('#notice')).includes('rien à remplacer'));
// units follow the exercise
await E(()=>{const i=cx().findIndex((e,k)=>GR[sid(k)]==='co');swapTo(i,'pl',0)});
ok('15. Core exercise → plank today: range switches to seconds (30–60 s)',await E(()=>{const i=cx().findIndex((e,k)=>sid(k)==='pl');return i>=0&&cx()[i][2]===30&&cx()[i][3]===60}));
await tap(p.locator('#v >> text=Abandonner'));await accept();
const herPain=await E(()=>{S.p='F';const pf=S.d.F.pf,old=[pf.back,pf.var];pf.back=true;pf.var='fix';start('B',2);const i=cx().findIndex((e,k)=>sid(k)==='pl'),r=i>=0?[cx()[i][2],cx()[i][3]]:null;writeSessionEnd(null);[pf.back,pf.var]=old;S.p='M';save();go();return r});
ok('15. Pain day swaps cable crunch → plank with a range in seconds (20–40 s), not 12–15',JSON.stringify(herPain)==='[20,40]',JSON.stringify(herPain));

ok('No page errors',!errs.length,errs.join(' | '));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();process.exit(fails?1:0)})().catch(e=>{console.log('CRASH',e.message);process.exit(2)});
