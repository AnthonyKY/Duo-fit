// iPhone-specific flows reported as broken: ✓ / rest timer / stopwatch / Terminer / Abandonner / History.
// Strict iOS simulation: typing fires only 'input'; taps never move focus; 'change' blocked; native dialogs blocked.
const {chromium,devices}=require('playwright');const IOS=require('./iosinit.js');
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13'],locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);
const p=await ctx.newPage();p.setDefaultTimeout(6000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.clock.install({time:new Date(2026,10,16,18,0,0)});
await p.goto('http://localhost:8766/index.html');
await p.evaluate(()=>{S.gm=false;for(const k of ['M','F']){S.d[k].pf.back=false;S.d[k].pf.inc={DB:2,M:2.5,C:1.25,SM:2.5};S.d[k].pf.var='fix';S.d[k].pf.noOverhead=false}save();go()}); // legacy list mode for this suite (V2 has its own tests)

const E=(f,a)=>p.evaluate(f,a),txt=async()=>(await p.textContent('#v')).replace(/[  ]/g,' ');
const typ=(loc,v)=>loc.evaluate((el,v)=>{el.focus();el.value='';for(const ch of String(v)){el.value+=ch;el.dispatchEvent(new Event('input',{bubbles:true}))}if(String(v)==='')el.dispatchEvent(new Event('input',{bubbles:true}))},v);
const tap=loc=>loc.evaluate(el=>el.click());
const card=name=>p.locator('.c').filter({has:p.locator('h2',{hasText:name})}).first();
const row=(name,j)=>card(name).locator('.s').nth(j);
// ---- start
await tap(p.locator('text=Commencer la séance'));
ok('Session started',(await txt()).includes('Terminer la séance'));
ok('Stopwatch shows 00:00',(await p.textContent('#session-clock'))=='00:00',await p.textContent('#session-clock'));
await tap(p.locator("[data-start-ex=\"0\"]"));await p.clock.runFor(65000);
ok('Stopwatch ticks to ~01:05',/01:0[45]/.test(await p.textContent('#session-clock')),await p.textContent('#session-clock'));
// ---- ✓ with keyboard still open, reps typed before weight, then weight
await typ(row('Développé épaules machine',0).locator('input').nth(1),'10');
await typ(row('Développé épaules machine',0).locator('input').nth(0),'42,5');
await tap(row('Développé épaules machine',0).locator('button'));
let s0=await E(()=>cur().ex[0][0]);
ok('✓ stores exactly what was typed (42,5 kg × 10)',s0.ok==1&&s0.w==42.5&&s0.r==10,JSON.stringify(s0));
ok('Rest timer appears at 02:00',await p.isVisible('#rest-clock')&&(await p.textContent('#rest-clock'))=='02:00');
await p.clock.runFor(30000);ok('Rest timer counts (01:30)',['01:30','01:31'].includes(await p.textContent('#rest-clock')));
ok('Progress shows 1/19 sets',(await txt()).includes('1/19'),'');
// next set: weight copied, reps typed then ✓
ok('Set 2 weight pre-filled 42.5',await row('Développé épaules machine',1).locator('input').nth(0).inputValue()=='42.5');
await typ(row('Développé épaules machine',1).locator('input').nth(1),'9');await tap(row('Développé épaules machine',1).locator('button'));
ok('Set 2 stored 42,5 × 9 and timer restarted',JSON.stringify(await E(()=>{const x=cur().ex[0][1];return{w:x.w,r:x.r,ok:x.ok}}))=='{"w":42.5,"r":9,"ok":1}'&&(await p.textContent('#rest-clock'))=='02:00');
// edit weight after typing but before ✓ on set 3 -> uses latest typed value
await typ(row('Développé épaules machine',2).locator('input').nth(0),'40');await typ(row('Développé épaules machine',2).locator('input').nth(1),'11');await tap(row('Développé épaules machine',2).locator('button'));
ok('Set 3 stored 40 × 11',JSON.stringify(await E(()=>{const x=cur().ex[0][2];return{w:x.w,r:x.r,ok:x.ok}}))=='{"w":40,"r":11,"ok":1}');
// untick and re-tick
await tap(row('Développé épaules machine',2).locator('button'));ok('Untick set 3',await E(()=>cur().ex[0][2].ok==0));
await tap(row('Développé épaules machine',2).locator('button'));ok('Re-tick set 3',await E(()=>cur().ex[0][2].ok==1));
// ✓ with empty weight on a weighted exercise -> in-app message, no native alert
await tap(row('Développé incliné haltères (30°)',0).locator('button'));
ok('Empty weight → in-app message (no native alert)',await p.isVisible('#notice'),await p.textContent('#notice'));
// rest timer pause/resume/reset/close
await tap(p.locator('#tm [data-rest=toggle]'));const a1=await p.textContent('#rest-clock');await p.clock.runFor(5000);ok('Pause',(await p.textContent('#rest-clock'))==a1,a1);
await tap(p.locator('#tm [data-rest=toggle]'));await p.clock.runFor(5000);ok('Resume',(await p.textContent('#rest-clock'))!=a1);
await tap(p.locator('#tm [data-rest=reset]'));ok('Reset',(await p.textContent('#rest-clock'))=='02:00');
await tap(p.locator('#tm [data-rest=stop]'));ok('Close timer',!(await p.isVisible('#tm')));
// notes typed (input only)
await typ(p.locator('#v textarea'),'Bonne séance');ok('Notes stored while typing',await E(()=>cur().note=='Bonne séance'));
// reload mid-session keeps typed-but-unticked values
await typ(row('Élévation latérale poulie',0).locator('input').nth(0),'7,5');await p.reload();
ok('Unticked typed weight survives reload',await E(()=>{const i=cx().findIndex(e=>e[0]=='clr');return num(cur().ex[i][0].w)==7.5}));
// finishing with a weight but no reps must be blocked, not silently dropped
await tap(p.locator('text=Terminer la séance'));ok('Weight without reps blocks Terminer with a message',!(await E(()=>document.getElementById('action-dialog').open))&&(await p.textContent('#notice')).includes('répétitions'),await p.textContent('#notice'));
await E(()=>{const i=cx().findIndex(e=>e[0]=='clr');setv(i,0,'w','');go()});
// ---- Terminer
await p.clock.runFor(30*60000);
await tap(p.locator('text=Terminer la séance'));ok('Terminer asks for confirmation with totals',await E(()=>document.getElementById('action-dialog').open)&&(await p.textContent('#action-detail')).includes('3 séries'),await p.textContent('#action-detail'));await tap(p.locator('#action-accept'));let tx=await txt();
ok('Terminer → summary (exercise time excludes the idle half hour)',tx.includes('Séance terminée')&&tx.includes('1 exercice ')&&tx.includes('3 séries')&&await E(()=>D().logs.at(-1).durSec>=90&&D().logs.at(-1).durSec<=105&&D().logs.at(-1).wallSec>1800),tx.slice(0,160));
ok('Volume 42,5×10+42,5×9+40×11 = 1 248 kg',tx.includes('1 248 kg'));
await tap(p.locator('text=Fermer'));
ok('Timer stopped after finishing',!(await p.isVisible('#rest-clock')));
// ---- History
await tap(p.locator('nav >> text=Historique'));tx=await txt();
ok('History shows the session with sets and note',tx.includes('Développé épaules machine')&&tx.includes('42,5 × 10')&&tx.includes('Bonne séance'));
// edit via strict typing
await tap(p.locator('.c >> text=Modifier'));await typ(p.locator('input[data-e=ms][data-j="1"][data-k=r]'),'12');await tap(p.locator('button:text-is("Enregistrer")'));
ok('History edit saved (set 2 → 12 reps, volume 425+510+440 = 1 375)',await E(()=>D().logs[0].ex.ms[1].r==12&&D().logs[0].vol==1375),JSON.stringify(await E(()=>D().logs[0].vol)));
// delete: cancel keeps, confirm deletes
await tap(p.locator('.c >> text=Supprimer'));ok('Delete asks in-app',await E(()=>document.getElementById('action-dialog').open));await tap(p.locator('#action-cancel'));ok('Cancel keeps session',await E(()=>D().logs.length==1));
await tap(p.locator('.c >> text=Supprimer'));await tap(p.locator('#action-accept'));ok('Confirm deletes session',await E(()=>D().logs.length==0)&&(await txt()).includes('Aucune séance'));
// ---- Abandonner
await tap(p.locator('nav >> text=Séance'));await tap(p.locator('text=Commencer la séance'));
await typ(row('Développé épaules machine',0).locator('input').nth(0),'40');await typ(row('Développé épaules machine',0).locator('input').nth(1),'10');await tap(row('Développé épaules machine',0).locator('button'));
await tap(p.locator('#v >> text=Abandonner'));ok('Abandonner asks in-app',await E(()=>document.getElementById('action-dialog').open));
await tap(p.locator('#action-cancel'));ok('Annuler keeps the session',await E(()=>!!D().cur));
await tap(p.locator('#v >> text=Abandonner'));await tap(p.locator('#action-accept'));
ok('Abandon removes session, no log, timer stopped',await E(()=>!D().cur&&D().logs.length==0)&&!(await p.isVisible('#rest-clock'))&&(await txt()).includes('Commencer la séance'));
// Terminer with nothing ticked -> asks, then discards
await tap(p.locator('text=Commencer la séance'));await tap(p.locator('text=Terminer la séance'));
ok('Terminer with 0 sets asks in-app (duration-only option)',await E(()=>document.getElementById('action-dialog').open)&&(await p.textContent('#action-detail')).includes('Aucune série'));
await tap(p.locator('#action-cancel'));ok('…Cancel keeps the session',await E(()=>!!D().cur));await tap(p.locator('#v >> text=Abandonner'));await tap(p.locator('#action-accept'));ok('…and Abandonner discards it',await E(()=>!D().cur&&D().logs.length==0));
// ---- Her: cardio typed then ✓, finish
await tap(p.locator('.pf >> text=Elle'));await tap(p.locator('text=Commencer la séance'));
await typ(p.locator('#cmin'),'12');await tap(p.locator('.c',{hasText:'Cardio (optionnel)'}).locator('button'));
await tap(p.locator('text=Terminer la séance'));await tap(p.locator('#action-accept'));ok('Her cardio-only session saved with 12 min',(await txt()).includes('🚶 12 min')&&await E(()=>S.d.F.logs.length==1&&S.d.F.logs[0].cardio==12));
await tap(p.locator('text=Fermer'));
// ---- Profile typing without change event, then tap a button
await tap(p.locator('nav >> text=Profil'));
await typ(p.locator('label.fl',{hasText:'Âge'}).locator('input'),'26');await typ(p.locator('label.fl',{hasText:'Taille'}).locator('input'),'165');await typ(p.locator('label.fl',{hasText:'Poids (kg)'}).locator('input'),'60');
ok('Nutrition appears live while typing (no tap needed)',(await p.textContent('#nutc')).includes('kcal'),(await p.textContent('#nutc')).slice(0,80));
await tap(p.locator('.sg button',{hasText:'Légère'}));
ok('Typed values kept after tapping a button',await E(()=>{const f=S.d.F.pf;return f.age==26&&f.h==165&&f.w==60&&f.act=='light'}));
ok('Her nutrition 1 550 kcal',(await p.textContent('#nutc')).replace(/[  ]/g,' ').includes('1 550'));
// ---- daily tracking + measurement save without change events
await tap(p.locator('nav >> text=Progrès'));await typ(p.locator('#hw'),'60,4');await tap(p.locator('button:text-is("Enregistrer")'));
ok('Weigh-in saved (60,4)',await E(()=>S.d.F.hd.some(h=>h.w==60.4)));
// ---- no native dialogs, no errors, persistence
ok('No native alert/confirm used anywhere',(await E(()=>window.__nd.length))==0,JSON.stringify(await E(()=>window.__nd)));
ok('No JavaScript errors',!errs.length,errs.join(' | '));
await p.reload();ok('Everything persisted after reload',await E(()=>S.d.F.logs.length==1&&S.d.F.pf.age==26&&S.d.F.hd.length>=1));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();process.exit(fails?1:0)})().catch(e=>{console.log('CRASH',e.message.split('\n')[0]);process.exit(2)});
