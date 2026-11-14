// Tanita readings: what the app computes from partial entries (made-up values only).
// kg ↔ % with the weight, weight from a kg + % pair (with its rounding margin), same-day weigh-in, sum of segments,
// fat-free mass, bone, BMI, FFMI, estimated BMR, left/right gaps; live while typing without redrawing the form;
// computed values marked ≈ and never stored; comparisons use them; each profile uses its own height and sex.
const {devices}=require('playwright');const BR=require('./browser.js');const IOS=require('./iosinit.js');
const URL=process.env.URL||'http://localhost:8766/index.html';
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+String(x).replace(/\s+/g,' ').slice(0,300):'');R.push(l);console.log(l);if(!c)fails++};
const SHARE=`window.__shared=[];navigator.canShare=d=>!!(d&&d.files&&d.files.length);
navigator.share=async d=>{const f=d.files&&d.files[0];window.__shared.push({body:f?await f.text():null})};`;
(async()=>{const b=await BR.launch();
const ctx=await b.newContext({...BR.dev('iPhone SE'),locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);await ctx.addInitScript(SHARE);
const p=await ctx.newPage();p.setDefaultTimeout(8000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.clock.install({time:Date.UTC(2026,10,21,8)});await p.clock.pauseAt(Date.UTC(2026,10,21,8,0,1));
await p.goto(URL);
const E=(f,a)=>p.evaluate(f,a),clean=s=>s.replace(/[  ]/g,' '),txt=async sel=>clean(await p.textContent(sel||'#v'));
const tap=loc=>loc.evaluate(el=>el.click());
const type=(sel,v)=>p.locator(sel).evaluate((el,v)=>{el.focus();el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}))},v);
const ph=k=>E(k=>clean0($('b_'+k).placeholder),k);
await E(()=>{window.clean0=s=>s.replace(/[  ]/g,' ');S.d.M.pf.h=180;S.d.M.pf.sex='m';S.d.F.pf.h=165;S.d.F.pf.sex='f';S.d.F.pf.age=30;U.tab='set';go()});
const add=async(date,when,vals)=>{await tap(p.locator('#bdc button',{hasText:'Ajouter un relevé'}));await type('#b_d',date);
  await tap(p.locator('#bdf .bwc button',{hasText:when}));for(const [k,v] of Object.entries(vals))await type('#b_'+k,v);await tap(p.locator('#bdf button.p'))};
const row=d=>p.locator('#bdc details.bdr',{has:p.locator('summary b',{hasText:new RegExp('^'+d+'$')})});
const detail=async d=>{await E(()=>{U.ball=true;go()});const r=row(d);if(!(await r.evaluate(el=>el.open)))await tap(r.locator('summary'));return clean(await r.textContent())};
const stored=d=>E(d=>{const r=D().body.find(x=>x.d===d);return r?Object.keys(r).filter(k=>!['id','d','when','note'].includes(k)).sort().join(','):null},d);

// ===== live while typing =====
await tap(p.locator('#bdc button',{hasText:'Ajouter un relevé'}));await type('#b_d','2026-11-01');await tap(p.locator('#bdf .bwc button',{hasText:'Matin à jeun'}));
await E(()=>{window.__form=$('bdf')});
await type('#b_weight','72,4');
ok('Live: weight alone → BMI 22,3 shown under the fields',(await txt('#b_calc')).includes('IMC 22,3'),await txt('#b_calc'));
await type('#b_fatPct','15,5');
ok('Live: + 15,5 % fat → the empty fat kg field shows "≈ 11,2"',(await ph('fatKg'))==='≈ 11,2',await ph('fatKg'));
let live=await txt('#b_calc');
ok('Live: fat-free mass ≈ 61,2 kg, FFMI 18,9, estimated BMR ≈ 1 850 kcal',live.includes('Masse maigre ≈ 61,2 kg')&&live.includes('FFMI (indice de masse maigre) 18,9')&&live.includes('≈ 1 850 kcal/jour'),live);
await type('#b_muscleKg','58,0');
ok('Live: + 58,0 kg muscle → "≈ 80,1" in the % field, bone ≈ 3,2 kg',(await ph('musclePct'))==='≈ 80,1'&&(await txt('#b_calc')).includes('Os (estimé) ≈ 3,2 kg'),await txt('#b_calc'));
ok('Live: no redraw — same form, keyboard stays on the field being typed, caret at the end',await E(()=>window.__form===$('bdf')&&document.activeElement===$('b_muscleKg')&&$('b_muscleKg').selectionStart===4));
ok('Live: typed fields keep no placeholder, the weight has none',(await ph('weight'))===''&&(await ph('fatPct'))===''&&(await ph('muscleKg'))==='');
await type('#b_fatPct','200');ok('An impossible value (200 % fat) is ignored by the calculations',(await ph('fatKg'))===''&&!(await txt('#b_calc')).includes('Masse maigre'),await txt('#b_calc'));
await type('#b_fatPct','15,5');
await type('#b_fatKg','11');ok('Typing a value in a computed field: yours counts (placeholder gone)',(await ph('fatKg'))===''&&(await E(()=>$('b_fatKg').value))==='11');
await type('#b_fatKg','');ok('Clearing it brings the computed value back',(await ph('fatKg'))==='≈ 11,2');
ok('iPhone: form with the results line fits, no sideways scroll',await E(()=>document.documentElement.scrollWidth<=innerWidth));
await tap(p.locator('#bdf button.p'));
ok('Saved: only what was typed is stored (weight, % fat, muscle kg)',(await stored('2026-11-01'))==='fatPct,muscleKg,weight',await stored('2026-11-01'));
let d1=await detail('1 nov.');
ok('History: computed values marked ≈ next to the entered ones',d1.includes('Masse grasse≈ 11,2 kg · 15,5 %')&&d1.includes('Masse musculaire58 kg · ≈ 80,1 %'),d1);
ok('History: "Calculs" block — fat-free mass, bone, BMI, FFMI, estimated BMR',d1.includes('Calculs')&&d1.includes('Masse maigre≈ 61,2 kg')&&d1.includes('Os (estimé)≈ 3,2 kg')&&d1.includes('IMC22,3')&&d1.includes('FFMI (indice de masse maigre)18,9')&&d1.includes('≈ 1 850 kcal/jour'),d1);
ok('History: at exactly 1,80 m no duplicate "ramené à 1,80 m" value',!d1.includes('ramené à 1,80 m'));
ok('History: FFMI reference for a man + the ≈ / ± legend',d1.includes('plus haute valeur observée')&&d1.includes('≈ = calculé'));

// ===== weight from a pair, with its margin =====
await add('2026-11-02','Autre moment',{muscleKg:'58,0',musclePct:'80,1'});
let d2=await detail('2 nov.');
ok('Muscle 58,0 kg + 80,1 % only → weight ≈ 72,4 kg (precise: no ±)',d2.includes('Poids≈ 72,4 kg')&&!d2.includes('Poids≈ 72,4 kg (±'),d2);
await tap(p.locator('#bdc button',{hasText:'Ajouter un relevé'}));await type('#b_fatKg','11,2');await type('#b_fatPct','15,5');
ok('Live: weight from the fat pair shows its margin in the field ("≈ 72,3 ± 0,6")',(await ph('weight'))==='≈ 72,3 ± 0,6',await ph('weight'));
await tap(p.locator('#bdf button',{hasText:'Annuler'}));
await add('2026-11-03','Autre moment',{fatKg:'11,2',fatPct:'15,5'});
let d3=await detail('3 nov.');
ok('Fat 11,2 kg + 15,5 % only → weight ≈ 72,3 kg (±0,6): the rounding margin is shown',d3.includes('Poids≈ 72,3 kg (±0,6)'),d3);
ok('…the fat-free mass margin counts the fat value once (≈ 61,1 kg ±0,6)',d3.includes('Masse maigre≈ 61,1 kg (±0,6)'),d3);
ok('…and the stored reading still has only those two values',(await stored('2026-11-03'))==='fatKg,fatPct');
await add('2026-11-04','Autre moment',{weight:'72,4'});
let d4=await detail('4 nov.');
ok('Weight only → BMI only',d4.includes('IMC22,3')&&!d4.includes('Masse maigre')&&!d4.includes('FFMI'),d4);
ok('Comparison with a computed weight shows its margin (+0,1 kg ±0,6: no real change)',d4.includes('poids ≈ +0,1 kg (±0,6)')||d4.includes('poids ≈ +0,1 kg (±0,7)'),d4.slice(d4.indexOf('Depuis')));

// ===== same-day weigh-in =====
await E(()=>{D().hd.push({d:'2026-11-10',w:72.4});D().hd.sort((a,b)=>a.d.localeCompare(b.d));save();go()});
await tap(p.locator('#bdc button',{hasText:'Ajouter un relevé'}));await type('#b_d','2026-11-10');await tap(p.locator('#bdf .bwc button',{hasText:'Avant séance'}));await type('#b_fatPct','15,5');
ok('% fat only + a weigh-in that day → "≈ 11,2" kg while typing',(await ph('fatKg'))==='≈ 11,2'&&(await ph('weight'))==='≈ 72,4');
await tap(p.locator('#bdf button.p'));
let d10=await detail('10 nov.');
ok('…and in the history, saying the weight comes from the weigh-in',d10.includes('≈ 72,4 kg · pesée du jour')&&d10.includes('≈ 11,2 kg'),d10);

// ===== segments only =====
await add('2026-11-05','Autre moment',{});
// the empty save above was refused (no value): fill the open form
await tap(p.locator('.bseg summary'));
for(const [k,v] of [['trunkMuscle','31,0'],['leftArmMuscle','3,6'],['rightArmMuscle','3,7'],['leftLegMuscle','9,8'],['rightLegMuscle','9,9']])await type('#b_'+k,v);
ok('Segments only → total muscle "≈ 58" while typing',(await ph('muscleKg'))==='≈ 58');
await tap(p.locator('#bdf button.p'));
let d5=await detail('5 nov.');
ok('Segments only → total muscle ≈ 58 kg (sum of segments)',d5.includes('≈ 58 kg · somme des segments'),d5);
ok('Left/right gap: arms 2,7 %, legs 1 % — flagged as within the scale\'s rounding',d5.includes('bras 2,7 % · jambes 1 % (dans la marge d’arrondi)'),d5);

// ===== inconsistent entries: bone not shown =====
await add('2026-11-06','Autre moment',{weight:'72,4',fatKg:'11,2',muscleKg:'63,0'});
let d6=await detail('6 nov.');
ok('Weight − fat − muscle below 1 kg → no bone value, "incohérent" instead',d6.includes('incohérent')&&!d6.includes('Os (estimé)≈'),d6);

// ===== comparisons use computed values =====
await add('2026-11-08','Matin à jeun',{weight:'72,0',fatKg:'11,0'});
let d8=await detail('8 nov.');
ok('Same conditions (vs 1 nov.): weight −0,4 kg, fat ≈ −0,2 kg and ≈ −0,2 pt',d8.includes('Depuis le 1 nov., mêmes conditions : poids −0,4 kg · gras ≈ −0,2 kg · % gras ≈ −0,2 pt'),d8.slice(d8.indexOf('Depuis'),d8.indexOf('Depuis')+120));

// ===== edit recalculates =====
await tap(row('1 nov.').locator('button',{hasText:'Modifier'}));
ok('Edit: computed values are placeholders, not field values',(await E(()=>$('b_fatKg').value))===''&&(await ph('fatKg'))==='≈ 11,2');
await type('#b_weight','73,0');ok('Edit: weight 73,0 → fat "≈ 11,3" at once',(await ph('fatKg'))==='≈ 11,3');
await tap(p.locator('#bdf button.p'));d1=await detail('1 nov.');
ok('Edit saved: history recalculated (fat ≈ 11,3 kg), still nothing computed stored',d1.includes('≈ 11,3 kg · 15,5 %')&&(await stored('2026-11-01'))==='fatPct,muscleKg,weight',d1);

// ===== backup holds only entries =====
await E(()=>shareBackup());await p.waitForTimeout(50);
const bk=JSON.parse(await E(()=>window.__shared.at(-1).body));
const keys=new Set(bk.d.M.body.flatMap(r=>Object.keys(r)));
ok('Backup file: no computed field (fat-free mass, bone, BMI, FFMI…) and 1 nov. without fat kg',!['ffm','bone','bmi','ffmi','bmrEst','effm'].some(k=>keys.has(k))&&bk.d.M.body.find(r=>r.d==='2026-11-01').fatKg===undefined);

// ===== Him / Her: own height and sex =====
await tap(p.locator('.pf button',{hasText:'Elle'}));
await add('2026-11-01','Matin à jeun',{weight:'72,4',fatPct:'15,5',muscleKg:'58,0'});
const dF=await detail('1 nov.');
ok('Her: same entries, her 165 cm → BMI 26,6, FFMI 22,5',dF.includes('IMC26,6')&&dF.includes('FFMI (indice de masse maigre)22,5'),dF);
ok('Her: no "1,80 m" scaling and no men\'s FFMI reference',!dF.includes('ramené à 1,80 m')&&!dF.includes('Kouri'));
await tap(p.locator('.pf button',{hasText:'Lui'}));
ok('Him unchanged: BMI computed with his 180 cm',(await detail('4 nov.')).includes('IMC22,3'));
await E(()=>{S.d.M.pf.h=188;go()});const d188=await detail('8 nov.');
ok('Him at 188 cm: BMI and FFMI follow his height, FFMI also scaled to 1,80 m',d188.includes('IMC20,4')&&d188.includes('ramené à 1,80 m'),d188);
await E(()=>{S.d.M.pf.h=180;go()});

// ===== English =====
await E(()=>{S.lg='en';go()});const en=await detail('Nov 1');
ok('English: "Calculations", "Fat-free mass", "BMI"',en.includes('Calculations')&&en.includes('Fat-free mass')&&en.includes('BMI'),en);
await E(()=>{S.lg='fr';go()});
ok('iPhone: Profile with all of this fits, no sideways scroll',await E(()=>document.documentElement.scrollWidth<=innerWidth));
ok('No native dialogs or page errors',!errs.length&&await E(()=>window.__nd.length===0),errs.join(' | '));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();process.exit(fails?1:0)})().catch(e=>{console.log('CRASH',e.message);process.exit(2)});
