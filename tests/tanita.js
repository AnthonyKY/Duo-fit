// Body composition · Tanita — the requested checks on a strict iPhone SE simulation, served like GitHub Pages (/Duo-fit/, offline worker).
// Profil → Composition corporelle · Tanita → Ajouter un relevé: date + measurement conditions, partial and complete readings,
// "Après séance" stays visible in the history, comparison only with readings taken under the same conditions,
// edit, delete, unsaved form kept when iOS reloads the page, offline relaunch, Him / Her separation, backup restore,
// an old backup (no Tanita data) still opens, per-exercise timers still work.
// All numbers below are made up: nobody's real readings are stored in the app or in this test.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {devices}=require('playwright');const BR=require('./browser.js');const IOS=require('./iosinit.js');
const root=path.join(__dirname,'..'),base='/Duo-fit/',FILES=['index.html','sw.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
const SHARE=`window.__shared=[];navigator.canShare=d=>!!(d&&d.files&&d.files.length);
navigator.share=async d=>{const f=d.files&&d.files[0];window.__shared.push({name:f&&f.name,body:f?await f.text():null})};`;
(async()=>{
const server=http.createServer((req,res)=>{const route=new URL(req.url,'http://x').pathname,name=route===base?'index.html':route.slice(base.length);
  if(!route.startsWith(base)||!FILES.includes(name)){res.writeHead(404);return res.end()}
  res.setHeader('Content-Type',name.endsWith('html')?'text/html; charset=utf-8':name.endsWith('js')?'application/javascript':name.endsWith('png')?'image/png':'application/manifest+json');
  res.end(fs.readFileSync(path.join(root,name)))});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+base;
const b=await BR.launch(),ctx=await b.newContext({...BR.dev('iPhone SE'),locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);await ctx.addInitScript(SHARE);
const p=await ctx.newPage();p.setDefaultTimeout(8000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const T0=Date.UTC(2026,10,21,8);await p.clock.install({time:T0});await p.clock.pauseAt(T0+1000);
await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
const E=(f,a)=>p.evaluate(f,a),txt=async sel=>(await p.textContent(sel||'#v')).replace(/[\u00a0\u202f]/g,' ');
const tap=loc=>loc.evaluate(el=>el.click()),nav=n=>tap(p.locator('nav button').nth(n)),accept=()=>tap(p.locator('#action-accept'));
const type=(sel,v)=>p.locator(sel).evaluate((el,v)=>{el.focus();el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}))},v);
const addBtn=()=>p.locator('#bdc button',{hasText:'Ajouter un relevé'}),chip=l=>p.locator('#bdf .bwc button',{hasText:l}),saveBtn=()=>p.locator('#bdf button.p');
const fit=()=>E(()=>document.documentElement.scrollWidth<=innerWidth);
const notice=async()=>(await p.textContent('#notice')).replace(/[\u00a0\u202f]/g,' ');
const row=d=>p.locator(`#bdc details.bdr`,{has:p.locator('summary b',{hasText:d})});
const body=k=>E(k=>S.d[k].body.map(r=>({...r})),k);
await E(()=>{S.d.M.pf.back=false;S.d.M.pf.var='fix';save()});

// ===== path, nothing prefilled =====
await nav(5);
ok('Path: Profil → first card "Composition corporelle · Tanita" with "Ajouter un relevé"',await E(()=>document.querySelector('#v .c').id==='bdc')&&(await txt('#bdc')).includes('Composition corporelle · Tanita')&&(await addBtn().count())===1);
ok('Nothing prefilled: no reading in either profile',(await body('M')).length===0&&(await body('F')).length===0);
await tap(addBtn());
ok('Form: date = today, no condition chosen yet, every value empty, trunk/arms/legs folded',await E(()=>$('b_d').value==='2026-11-21'&&!document.querySelector('.bwc .on')&&[...document.querySelectorAll('#bdf .bu input')].every(i=>i.value==='')&&document.querySelectorAll('#bdf .bu input').length===16&&!document.querySelector('.bseg').open));
ok('Main values: weight kg, fat kg + %, muscle kg + %, basal metabolism kcal/day',await E(()=>['weight','fatKg','fatPct','muscleKg','musclePct','bmr'].every(k=>$('b_'+k)&&!$('b_'+k).closest('details')))&&(await txt('#bdf')).includes('kcal/jour'));
ok('iPhone SE: form fits, no sideways scroll; number fields ≥ 70 px wide',await fit()&&await E(()=>[...document.querySelectorAll('#bdf .bu input')].filter(i=>i.offsetParent).every(i=>i.getBoundingClientRect().width>=70)));

// ===== 1. partial reading, after workout =====
await type('#b_d','2026-11-14');await type('#b_weight','72,9');await tap(saveBtn());
ok('1. Saving without measurement conditions asks for them; nothing saved',(await notice()).includes('Choisis les conditions')&&(await body('M')).length===0);
await tap(chip('Après séance'));
ok('1. Picking "Après séance" keeps what was typed and says it is less reliable',await E(()=>$('b_weight').value==='72,9'&&$('b_d').value==='2026-11-14')&&(await txt('#bdf')).includes('Moins fiable'));
await type('#b_fatPct','15,9');await tap(saveBtn());
let rows=await body('M');
ok('1. Partial reading saved with only what was entered (date chosen, weight, % fat)',rows.length===1&&rows[0].d==='2026-11-14'&&rows[0].when==='after'&&rows[0].weight===72.9&&rows[0].fatPct===15.9&&Object.keys(rows[0]).filter(k=>!['id','d','when'].includes(k)).length===2,JSON.stringify(rows));
ok('1. Form closed, "Relevé enregistré."',!(await p.locator('#bdf').count())&&(await notice()).includes('Relevé enregistré'));
let sum=(await row('14 nov.').locator('summary').textContent()).replace(/[\u00a0\u202f]/g,' ');
ok('1. History line, without opening it: date + "Après séance" + values',sum.includes('14 nov.')&&sum.includes('Après séance')&&sum.includes('72,9 kg')&&sum.includes('15,9 % gras'),sum);
ok('1. "Après séance" is a highlighted badge',await E(()=>!!document.querySelector('#bdc .bw.bw-after')));
ok('1. First reading: says to compare under the same conditions',(await txt('#bdc')).includes('Premier relevé « après séance »'));

// ===== 2. complete reading, before workout, with typos, iOS reload and offline =====
await tap(addBtn());await type('#b_d','2026-11-30');await tap(chip('Avant séance'));await type('#b_weight','72,4');await tap(saveBtn());
ok('2. A future date is refused',(await notice()).includes('date valide')&&(await body('M')).length===1);
await type('#b_d','2026-11-17');
for(const [k,v] of [['fatKg','15,5'],['fatPct','15,5'],['muscleKg','58,0'],['musclePct','80,1'],['bmr','7196']])await type('#b_'+k,v);
await tap(saveBtn());
ok('2. Basal metabolism typed in kJ → explains and gives the kcal, field marked',(await notice()).includes('ressemble à des kJ')&&(await notice()).includes('1 720')&&await E(()=>$('b_bmr').getAttribute('aria-invalid')==='true')&&(await body('M')).length===1);
await type('#b_bmr','1720');
await tap(p.locator('.bseg summary'));
ok('2. Trunk, arms and legs open on demand (muscle kg + fat %)',await E(()=>document.querySelector('.bseg').open)&&(await txt('.bseg')).includes('Jambe droite'));
for(const [k,v] of [['trunkMuscle','31,0'],['trunkFat','16,0'],['leftArmMuscle','3,6'],['leftArmFat','18,0'],['rightArmMuscle','3,7']])await type('#b_'+k,v);
ok('2. iPhone SE: whole form open still fits',await fit());
// iOS drops the page while you check the scale photo, with no network
await BR.offline(ctx,true);await p.reload();await p.waitForTimeout(150);
ok('2. Offline relaunch: the app opens',await E(()=>typeof S==='object'&&!!document.querySelector('nav button')));
await nav(5);
ok('2. …and the unfinished reading is still there (values, conditions, open section)',await E(()=>!!$('bdf')&&$('b_fatKg').value==='15,5'&&$('b_bmr').value==='1720'&&$('b_rightArmMuscle').value==='3,7'&&$('b_d').value==='2026-11-17'&&document.querySelector('.bwc .on').textContent==='Avant séance'&&document.querySelector('.bseg').open));
for(const [k,v] of [['rightArmFat','18,5'],['leftLegMuscle','9,8'],['leftLegFat','15,0'],['rightLegMuscle','9,9'],['rightLegFat','15,2']])await type('#b_'+k,v);
await tap(saveBtn());
let dl=await E(()=>({open:$('action-dialog').open,title:$('action-title').textContent,detail:$('action-detail').textContent.replace(/[\u00a0\u202f]/g,' ')}));
ok('2. kg and % that do not match → "Ces valeurs ne collent pas" with the expected value',dl.open&&dl.title.includes('ne collent pas')&&dl.detail.includes('15,5 % de 72,4 kg = 11,2 kg'),JSON.stringify(dl));
await tap(p.locator('#action-cancel'));
ok('2. "Corriger": nothing saved, everything typed is kept',(await body('M')).length===1&&await E(()=>$('b_fatKg').value==='15,5'&&$('b_rightLegFat').value==='15,2'));
await type('#b_fatKg','11,2');await tap(saveBtn());
rows=await body('M');let full=rows.find(r=>r.d==='2026-11-17');
ok('2. Complete reading saved offline: 16 values + conditions',!!full&&full.when==='before'&&['weight','fatKg','fatPct','muscleKg','musclePct','bmr','trunkMuscle','trunkFat','leftArmMuscle','leftArmFat','rightArmMuscle','rightArmFat','leftLegMuscle','leftLegFat','rightLegMuscle','rightLegFat'].every(k=>Number.isFinite(full[k]))&&full.fatKg===11.2&&full.bmr===1720&&full.rightLegFat===15.2,JSON.stringify(full));
ok('2. The unfinished-form copy is cleared once saved',await E(()=>localStorage.getItem('duofit-body-draft')===null));
await p.reload();await p.waitForTimeout(150);await nav(5);
ok('2. Still there after another offline relaunch, newest first',(await body('M')).length===2&&await E(()=>[...document.querySelectorAll('#bdc .bdr summary b')].map(x=>x.textContent).join('|'))==='17 nov.|14 nov.');
await tap(row('17 nov.').locator('summary'));
let det=await txt('#bdc');
ok('2. Details: fat 11,2 kg · 15,5 %, muscle, 1 720 kcal/jour, segments',det.includes('11,2 kg · 15,5 %')&&det.includes('1 720 kcal/jour')&&det.includes('Jambe droite')&&det.includes('9,9 kg · 15,2 %'));
ok('2. Not compared with the after-workout reading: says why',det.includes('Pas encore d’autre relevé « avant séance »')&&det.includes('« après séance » : pas directement comparable'));
await BR.offline(ctx,false);

// ===== 3. same conditions → real comparison =====
await tap(addBtn());await tap(chip('Avant séance'));await type('#b_weight','71,9');await type('#b_fatPct','15,2');await tap(saveBtn());
det=await txt('#bdc');
ok('3. Third reading (today, before workout) compared with 17 nov. only',det.includes('Depuis le 17 nov., mêmes conditions : poids −0,5 kg · % gras −0,3 pt'),det.slice(det.indexOf('Depuis'),det.indexOf('Depuis')+90).replace(/\s+/g,' '));

// ===== 4. edit =====
await tap(row('14 nov.').locator('summary'));await tap(row('14 nov.').locator('button',{hasText:'Modifier'}));
ok('4. Edit opens the form filled with that reading',await E(()=>$('b_weight').value==='72,9'&&$('b_fatPct').value==='15,9'&&$('b_d').value==='2026-11-14'&&document.querySelector('.bwc .on').textContent==='Après séance')&&(await txt('#bdf')).includes('Modifier le relevé'));
const id14=(await body('M')).find(r=>r.d==='2026-11-14').id;
await type('#b_weight','73,1');await type('#b_muscleKg','58,2');await tap(saveBtn());
rows=await body('M');const r14=rows.find(r=>r.id===id14);
ok('4. Same reading updated (no duplicate), conditions kept',rows.length===3&&r14.weight===73.1&&r14.muscleKg===58.2&&r14.fatPct===15.9&&r14.when==='after'&&(await notice()).includes('Relevé modifié'),JSON.stringify(r14));
await tap(row('14 nov.').locator('button',{hasText:'Modifier'}));await tap(chip('Matin à jeun'));await type('#b_weight','10');await tap(p.locator('#bdf button',{hasText:'Annuler'}));
ok('4. Annuler while editing changes nothing',await E(id=>{const r=D().body.find(x=>x.id===id);return r.weight===73.1&&r.when==='after'},id14)&&!(await p.locator('#bdf').count()));

// ===== 5. delete =====
const del21=()=>tap(row('21 nov.').locator('button',{hasText:'Supprimer'}));
await tap(row('21 nov.').locator('summary'));await del21();
dl=await E(()=>({open:$('action-dialog').open,title:$('action-title').textContent,detail:$('action-detail').textContent,red:$('action-accept').hasAttribute('data-danger')}));
ok('5. Delete asks first, names the reading, red button',dl.open&&dl.title==='Supprimer ce relevé ?'&&dl.detail.includes('21 nov. · Avant séance')&&dl.red,JSON.stringify(dl));
await tap(p.locator('#action-cancel'));ok('5. Annuler keeps it',(await body('M')).length===3);
await del21();await accept();
ok('5. Confirmed: gone, the two others untouched',(await body('M')).map(r=>r.d).join()==='2026-11-14,2026-11-17'&&(await notice()).includes('Relevé supprimé'));

// ===== 6. Him / Her =====
await tap(addBtn());await type('#b_weight','70');
await tap(p.locator('.pf button',{hasText:'Elle'}));
ok('6. Her profile: no reading, no form, nothing from Him',(await body('F')).length===0&&!(await p.locator('#bdf').count())&&!(await p.locator('#bdc .bdr').count())&&(await addBtn().count())===1);
await tap(addBtn());await tap(chip('Matin à jeun'));await type('#b_weight','61,0');await type('#b_fatPct','27,5');await tap(saveBtn());
ok('6. Her reading saved in her profile only',(await body('F')).length===1&&(await body('F'))[0].when==='fast'&&(await body('M')).length===2&&!(await body('M')).some(r=>r.weight===61));
ok('6. "Matin à jeun" badge in her history',await E(()=>!!document.querySelector('#bdc .bw.bw-fast')));
await tap(p.locator('.pf button',{hasText:'Lui'}));
ok('6. Back to Him: his readings, and his unfinished form is still there',(await body('M')).length===2&&await E(()=>!!$('bdf')&&$('b_weight').value==='70')&&!(await txt('#bdc')).includes('61 kg'));
await tap(p.locator('#bdf button',{hasText:'Annuler'}));

// ===== 7. backup / restore =====
await E(()=>shareBackup());await p.waitForTimeout(50);
const shared=await E(()=>window.__shared.at(-1));const bk=JSON.parse(shared.body);
ok('7. Backup file contains both profiles\' readings with their conditions',bk.d.M.body.length===2&&bk.d.M.body.some(r=>r.when==='after'&&r.weight===73.1)&&bk.d.F.body.length===1&&!shared.body.includes('duofit-body-draft'));
const f1=path.join(os.tmpdir(),'duofit-tanita.json');fs.writeFileSync(f1,shared.body);
await E(()=>{S.d.M.body=[];S.d.F.body=[];save();go()});
ok('7. (setup) readings wiped on this phone',(await body('M')).length===0&&!(await p.locator('#bdc .bdr').count()));
await p.locator('#bkf').setInputFiles(f1);await p.waitForFunction(()=>$('action-dialog').open,null,{timeout:3000}).catch(()=>{});await accept();
ok('7. Restored: his 2 readings and her 1 are back',(await body('M')).length===2&&(await body('F')).length===1);
sum=(await row('14 nov.').locator('summary').textContent()).replace(/[\u00a0\u202f]/g,' ');
ok('7. …and "Après séance" is still shown in the history',sum.includes('Après séance')&&sum.includes('73,1 kg'),sum);

// ===== 8. old backup (made before Tanita existed) =====
const old=JSON.parse(shared.body);delete old.d.M.body;delete old.d.F.body;old.d.M.logs=[{date:Date.UTC(2026,9,1,9),wk:'A',ex:{lp:[{w:60,r:10}]},sets:1,vol:600,dur:45,note:''}];
const f2=path.join(os.tmpdir(),'duofit-old.json');fs.writeFileSync(f2,JSON.stringify(old));
await p.locator('#bkf').setInputFiles(f2);await p.waitForFunction(()=>$('action-dialog').open,null,{timeout:3000}).catch(()=>{});await accept();
ok('8. An old backup without Tanita data opens (workout back, no reading, no error)',await E(()=>S.d.M.logs.length===1&&Array.isArray(S.d.M.body)&&S.d.M.body.length===0&&S.d.F.body.length===0)&&(await addBtn().count())===1,await E(()=>S.d.M.logs.length));
await tap(addBtn());await tap(chip('Après séance'));await type('#b_weight','72,0');await tap(saveBtn());
ok('8. …and a reading can be added right after',(await body('M')).length===1);
const bad=JSON.parse(shared.body);bad.d.M.body=[{d:'2026-11-10',when:'rest',weight:72,fatPct:140},{d:'pas une date',weight:70},{d:'2026-11-11',when:'fast'},'x'];bad.d.F.body='oops';
const f3=path.join(os.tmpdir(),'duofit-bad.json');fs.writeFileSync(f3,JSON.stringify(bad));
await p.locator('#bkf').setInputFiles(f3);await p.waitForFunction(()=>$('action-dialog').open,null,{timeout:3000}).catch(()=>{});await accept();
rows=await body('M');
ok('8. A backup with damaged Tanita rows still opens: only the usable values are kept',rows.length===1&&rows[0].weight===72&&rows[0].fatPct==null&&rows[0].when==='other'&&(await body('F')).length===0&&await E(()=>S.d.M.logs.length===0),JSON.stringify(rows));

// ===== 9. per-exercise timers still work =====
await E(()=>{U.tab='today';U.pick='A';go()});await tap(p.locator('#v button',{hasText:'Commencer la séance'}));
const card=i=>p.locator('#v .c:not(.wuc)').filter({has:p.locator('[data-row]')}).nth(i);
await tap(card(0).locator('.xt.x0'));await p.clock.runFor(120e3);
const tm=await E(()=>({run:cur().xr===xkey(0),s:Math.floor(xMs(xkey(0))/1000),chip:document.querySelector(`[data-xk="${xkey(0)}"] .xv`).textContent}));
ok('9. "Lancer l\'exercice" still starts the exercise timer: 2:00 after 2 minutes',tm.run&&tm.s===120&&tm.chip==='2:00',JSON.stringify(tm));
await tap(card(0).locator('.xbt'));await p.clock.runFor(30e3);
ok('9. …and pausing still stops it',await E(()=>cur().xr==null&&Math.floor(xMs(xkey(0))/1000)===120));
await tap(p.locator('#v >> text=Abandonner'));await accept();

// ===== 10. English, layout =====
await E(()=>{S.lg='en';U.tab='set';go()});
const en=await txt('#bdc');
ok('10. English: "Body composition · Tanita", "Add a reading", condition badge',en.includes('Body composition · Tanita')&&en.includes('Add a reading')&&en.includes('Other time'));
await E(()=>{S.lg='fr';go()});
await tap(addBtn());await type('#b_fatKg','90');await type('#b_weight','72');await tap(chip('Autre moment'));await tap(saveBtn());
ok('10. Fat mass heavier than the weight is refused',(await notice()).includes('plus que le poids')&&(await body('M')).length===1);
await tap(p.locator('#bdf button',{hasText:'Annuler'}));
ok('10. iPhone SE: no sideways scroll on Profile',await fit());
ok('No native dialogs or page errors',!errs.length&&await E(()=>window.__nd.length===0),errs.join(' | '));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();server.close();process.exit(fails?1:0)})().catch(e=>{console.log('CRASH',e.message);process.exit(2)});
