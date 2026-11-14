// Erasing a profile: 1) what will be deleted 2) type EFFACER (button disabled until then) 3) undo for 7 days. Strict iPhone simulation.
const {chromium,devices}=require('playwright');const IOS=require('./iosinit.js');
const URL=process.env.URL||'http://localhost:8766/index.html';
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone SE'],locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);
const p=await ctx.newPage();p.setDefaultTimeout(8000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const DAY=864e5;await p.clock.install({time:Date.UTC(2026,10,16,9)});
const E=(f,a)=>p.evaluate(f,a),txt=async()=>(await p.textContent('#v')).replace(/[  ]/g,' ');
const tap=loc=>loc.evaluate(el=>el.click()),nav=n=>tap(p.locator('nav button').nth(n));
const type=v=>p.locator('#action-word').evaluate((el,v)=>{el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))},v);
const dlg=()=>E(()=>({open:$('action-dialog').open,title:$('action-title').textContent,detail:$('action-detail').textContent,word:!$('action-word').hidden,dis:$('action-accept').disabled,red:$('action-accept').hasAttribute('data-danger')}));
await p.goto(URL);
await E(()=>{const lg=(d,v)=>({date:Date.now()-d*864e5,wk:'A',ex:{ms:[{w:v,r:10}]},sets:1,vol:v*10,dur:50,note:''});S.d.M.logs=[lg(5,40),lg(3,42.5)];S.d.M.ms=[{d:'2026-11-10',wa:82}];S.d.F.logs=[lg(2,10)];S.d.M.notes={ms:'siège 4'};save();go()});
const eraseBtn=()=>p.locator('#erc button',{hasText:'Effacer les données de ce profil'});
await nav(5);
// 1st step
await tap(eraseBtn());let d=await dlg();
ok('Step 1 names the profile and says exactly what will go',d.open&&d.title.includes('Lui')&&d.detail.includes('2 séances')&&d.detail.includes("L'autre profil n'est pas touché"),JSON.stringify(d));
await tap(p.locator('#action-cancel'));ok('Annuler at step 1: nothing deleted',await E(()=>S.d.M.logs.length===2&&!$('action-dialog').open));
// 2nd step
await tap(eraseBtn());await tap(p.locator('#action-accept'));d=await dlg();
ok('Step 2 asks to type EFFACER; red Supprimer button disabled',d.open&&d.detail.includes('EFFACER')&&d.word&&d.dis&&d.red,JSON.stringify(d));
await type('effac');ok('Partial word: still disabled',(await dlg()).dis);
await tap(p.locator('#action-accept'));ok('Tapping the disabled button does nothing',await E(()=>S.d.M.logs.length===2&&$('action-dialog').open));
await tap(p.locator('#action-cancel'));ok('Annuler at step 2: nothing deleted',await E(()=>S.d.M.logs.length===2&&!$('action-dialog').open));
await tap(eraseBtn());await tap(p.locator('#action-accept'));await type('effacer');
ok('Typing the word (any case) enables it',!(await dlg()).dis);
await tap(p.locator('#action-accept'));
ok('Erased: Him empty, Her untouched',await E(()=>S.d.M.logs.length===0&&S.d.M.ms.length===0&&S.d.F.logs.length===1));
ok('Notice says it can be undone for 7 days',(await p.textContent('#notice')).includes('annuler jusqu'));
ok('Today shows the undo line',(await txt()).includes("Annuler l'effacement"));
await p.reload();ok('Undo still offered after reopening the app',(await txt()).includes("Annuler l'effacement"));
// undo
await tap(p.locator('.bkr button',{hasText:"Annuler l'effacement"}));
ok('Undo brings everything back (workouts, measurements, machine notes)',await E(()=>S.d.M.logs.length===2&&S.d.M.ms.length===1&&S.d.M.notes.ms==='siège 4'&&S.d.F.logs.length===1));
ok('Undo line gone, copy removed from the phone',!(await txt()).includes("Annuler l'effacement")&&await E(()=>localStorage.getItem('duofit-undo')===null));
// erase, train again, then undo → asks before replacing
await nav(5);await tap(eraseBtn());await tap(p.locator('#action-accept'));await type('EFFACER');await tap(p.locator('#action-accept'));
await E(()=>{S.d.M.logs.push({date:Date.now(),wk:'B',ex:{lpd:[{w:50,r:10}]},sets:1,vol:500,dur:40,note:''});save();go()});
await tap(p.locator('.bkr button',{hasText:"Annuler l'effacement"}));
ok('Undo after a new workout asks first',await E(()=>$('action-dialog').open&&$('action-detail').textContent.includes('depuis'))&&await E(()=>S.d.M.logs.length===1));
await tap(p.locator('#action-accept'));ok('…then restores the erased data',await E(()=>S.d.M.logs.length===2));
// expiry
await nav(5);await tap(eraseBtn());await tap(p.locator('#action-accept'));await type('effacer');await tap(p.locator('#action-accept'));
await p.clock.fastForward(8*DAY);await E(()=>go());
ok('After 7 days the undo is gone',!(await txt()).includes("Annuler l'effacement")&&await E(()=>{undoErase();return S.d.M.logs.length===0}));
// English + layout
await E(()=>{S.lg='en';U.tab='set';go()});await tap(p.locator('#erc button').last());await tap(p.locator('#action-accept'));
ok('English: "Type ERASE"',(await dlg()).detail.includes('Type ERASE'));
ok('iPhone SE: dialog fits, no sideways scroll',await E(()=>{const r=$('action-dialog').getBoundingClientRect();return r.width<=innerWidth&&document.documentElement.scrollWidth<=innerWidth}));
await tap(p.locator('#action-cancel'));await E(()=>{S.lg='fr';go()});
ok('No native dialogs or page errors',!errs.length&&await E(()=>window.__nd.length===0),errs.join(' | '));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();process.exit(fails?1:0)})().catch(e=>{console.log('CRASH',e.message);process.exit(2)});
