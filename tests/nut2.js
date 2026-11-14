const {devices}=require('playwright');const BR=require('./browser.js');const IOS=require('./iosinit.js');
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
(async()=>{const b=await BR.launch();const ctx=await b.newContext({...BR.dev('iPhone 13'),locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);const p=await ctx.newPage();p.setDefaultTimeout(6000);
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.clock.setFixedTime(new Date(2026,10,16,9).getTime()); // Mon 16 Nov
await p.goto('http://localhost:8766/index.html');
await p.evaluate(()=>{S.gm=false;for(const k of ['M','F']){S.d[k].pf.back=false;S.d[k].pf.inc={DB:2,M:2.5,C:1.25,SM:2.5};S.d[k].pf.var='fix';S.d[k].pf.noOverhead=false}Object.assign(S.d.M.pf,{age:30,h:180,w:80});save();go()}); // fixture: a made-up adult profile (the app no longer prefills anyone's); legacy list mode for this suite (V2 has its own tests)

const E=(f,a)=>p.evaluate(f,a);const txt=async()=>(await p.textContent('#v')).replace(/[\u202f\u00a0]/g,' ');
// --- Him defaults
await p.click('nav >> text=Profil');
let n=await E(()=>nut());
ok('Him (made-up 30 y, 180 cm, 80 kg): 2 800 kcal, 145 g prot, 80 g fat, 375 g carbs',n.kc==2800&&n.P==145&&n.F==80&&n.C==375,JSON.stringify(n));
ok('Him maintenance shown ≈ 2 600',(await txt()).includes('Maintien ≈ 2 600 kcal'),'');
ok('Profile page shows meal plan with grams',(await txt()).includes('Blanc de poulet (poids cru)')&&(await txt()).includes('Exemple de journée'));
// --- Her profile: fill fields via UI
await p.click('.pf >> text=Elle');await p.click('nav >> text=Profil');
ok('Her: asks to complete profile',(await txt()).includes('Complète âge, taille et poids'));
const fill=async(label,v)=>{const i=p.locator('label.fl',{hasText:label}).locator('input');await i.fill(v);await i.dispatchEvent('change')};
await fill('Âge','26');await fill('Taille','165');await fill('Poids (kg)','60');
await p.locator('.sg button',{hasText:'Légère'}).click();
n=await E(()=>nut());
ok('Her (F, 26 y, 165 cm, 60 kg, light, fat loss): 1 550 kcal / 120 g P / 50 g F / 155 g C',n.kc==1550&&n.P==120&&n.F==50&&n.C==155,JSON.stringify(n));
ok('Water 2 L',n.water==2,String(n.water));
// meal plan accuracy across profiles
const cases=[[ 'f',26,165,60,'light','loss'],['f',50,150,45,'sed','loss'],['m',30,190,100,'very','gain'],['m',27,188,80,'light','gain'],['f',35,170,85,'acti','loss'],['m',40,175,70,'sed','maint'],['f',22,160,52,'acti','recomp']];
for(const c of cases){const r=await E(c=>{const pf=D().pf;Object.assign(pf,{sex:c[0],age:c[1],h:c[2],w:c[3],act:c[4],goal:c[5]});const n=nut(),m=mealPlan(n);return{n,m}},c);
 const dk=Math.abs(r.m.k-r.n.kc)/r.n.kc,dp=Math.abs(r.m.p-r.n.P)/r.n.P;
 ok(`Meal plan ${c.join('/')} → ${r.n.kc} kcal target, plan ${r.m.k} kcal, P ${r.n.P}/${r.m.p} g`,dk<=.12&&dp<=.12,`Δkcal ${(dk*100).toFixed(0)}% ΔP ${(dp*100).toFixed(0)}%${r.n.floored?' (floor)':''}`)}
// floor case
let r=await E(()=>{Object.assign(D().pf,{sex:'f',age:50,h:150,w:45,act:'sed',goal:'loss'});return nut()});
ok('Safety floor 1 200 kcal for small sedentary woman',r.kc==1200&&r.floored);
// restore her
await E(()=>{Object.assign(D().pf,{sex:'f',age:26,h:165,w:60,act:'auto',goal:'loss'});save();go()});
// steps auto
await E(()=>{const now=Date.now();for(let i=0;i<6;i++){const d=tday(now-i*864e5);D().hd.push({d,st:9000})}D().hd.sort((a,b)=>a.d<b.d?-1:1);save();go()});
ok('Auto activity from 9 000 steps → Active (×1.6)',await E(()=>actF().a=='acti'));
ok('Auto activity text shown',(await txt()).includes('~9 000 pas/jour'));
// --- trend: 2 weeks of weigh-ins, losing 1 kg/week
await E(()=>{const now=Date.now();const H=D().hd;for(let i=13;i>=0;i--){const d=tday(now-i*864e5);const w=i>=7?62:61;const o=H.find(x=>x.d==d);if(o)o.w=w;else H.push({d,w})}H.sort((a,b)=>a.d<b.d?-1:1);save();go()});
let tr=await E(()=>trend());ok('Trend = −1,0 kg/week',Math.abs(tr.rate+1)<1e-9,JSON.stringify(tr));
let tx=await txt();
ok('Losing too fast → suggests +150 kcal',tx.includes('Tu perds trop vite')&&tx.includes('Appliquer +150 kcal/jour'));
const k0=await E(()=>nut().kc);await p.click('text=Appliquer +150 kcal/jour');const k1=await E(()=>nut().kc);
ok('Apply adds 150 kcal ('+k0+' → '+k1+')',k1-k0==150);
ok('After applying: wait message, no second button',(await txt()).includes('attends encore 10 jour')&&!(await p.isVisible('text=Appliquer +150')));
await p.click('text=Remettre l\'ajustement à 0');ok('Reset adjustment',await E(()=>D().pf.kadj==0));
// projection
await fill('Poids cible','58');tx=await txt();
ok('Target 58 kg projection shown',tx.includes('58 kg vers'),tx.match(/À ton rythme[^.]*\./)?.[0]);
// weight shown from weigh-in, not field
ok('Weight comes from last weigh-in (61 kg)',tx.includes('Poids : 61 kg (dernière pesée'));
// --- adaptive sessions (her: beginner + fat loss)
await p.click('nav >> text=Séance');await p.click('button:text-is("A")');tx=await txt();
ok('Her home A: cardio 15 min listed + beginner note and whole warm-up within 60 min',tx.includes('Cardio (optionnel) 15 min')&&tx.includes('Débutant')&&tx.includes(await E(()=>{const e=eff('A');return t('durE')(e.dur,e.wm)}))&&await E(()=>eff('A').wm===11&&eff('A').dur<=60),tx.match(/≈ \d+ min/)?.[0]);
await p.click('text=Commencer la séance');tx=await txt();
ok('Beginner RIR +1 on leg press (2→3)',tx.includes('3×10–12 · Repos 120s · RIR 4')||tx.includes('RIR 4'),tx.match(/RIR \d/g)?.join(','));
const cd=p.locator('.c',{hasText:'Cardio (optionnel)'});await cd.locator('input').fill('12');await cd.locator('input').dispatchEvent('change');await cd.locator('button').click();
await p.clock.setFixedTime(new Date(2026,10,16,10).getTime());await p.click('text=Terminer la séance');await p.click('#action-accept');tx=await txt();
ok('Cardio-only session saved with 12 min',tx.includes('🚶 12 min'),tx.slice(0,200));await p.click('text=Fermer');
await p.click('nav >> text=Historique');ok('History shows cardio',/Cardio . 12 min/.test(await txt()));
// time 45 for her: cardio dropped first, no exercise removed
await p.click('nav >> text=Profil');await p.locator('.sg button',{hasText:'45 min'}).click();await p.click('nav >> text=Séance');await p.click('button:text-is("A")');tx=await txt();
ok('Her 45 min: cardio reduced to 5 minutes first, all 5 exercises kept',tx.includes('Cardio (optionnel) 5 min')&&await E(()=>eff('A').ex.length===5&&eff('A').dur<=45),'');
// --- Him: 45 min trims accessories, 75 min adds sets
await p.click('.pf >> text=Lui');await p.click('nav >> text=Profil');await p.locator('.sg button',{hasText:'45 min'}).click();
await p.click('nav >> text=Séance');await p.click('button:text-is("A")');tx=await txt();
const ef45=await E(()=>eff('A'));ok('Him 45 min: '+ef45.ex.length+' exercises, ≈'+ef45.dur+' min, accessories cut to 2 sets before dropping any',ef45.ex.length>=5&&ef45.dur<=45&&ef45.ex.slice(2).some(e=>e[1]==2)&&tx.includes('passent à 2 séries'),JSON.stringify(ef45.ex.map(e=>e[0]+'×'+e[1]))+' dur '+ef45.dur);
await p.click('nav >> text=Profil');await p.locator('.sg button',{hasText:'75 min'}).click();
const ef75=await E(()=>eff('A'));ok('Him 75 min: shoulder press 4 sets, incline 4 sets',ef75.ex[0][1]==4&&ef75.ex[1][1]==4&&ef75.ex[2][1]==4,JSON.stringify(ef75.ex.map(e=>e[1])));
await p.click('nav >> text=Séance');await p.click('button:text-is("A")');await p.click('text=Commencer la séance');
const rows=await p.locator('.c').filter({has:p.locator('h2',{hasText:'Développé épaules machine'})}).locator('.s').count();ok('Session shows 4 set rows for shoulder press',rows==4);
// plan frozen during session
await p.click('nav >> text=Profil');await p.locator('.sg button',{hasText:'45 min'}).click();await p.click('nav >> text=Séance');
ok('Changing profile mid-session does not change current session',await p.locator('.c h2').count()>=6&&await E(()=>cur().pl[0][1]==4));
await p.click('text=Abandonner');await p.click('#action-accept');
// --- measurements
await p.click('nav >> text=Profil');
await p.fill('#mdt','2026-11-01');await p.fill('#m_wa','82');await p.fill('#m_sh','120');await p.click('.c:has(#mdt) >> button:text-is("Enregistrer")');
await p.fill('#mdt','2026-11-15');await p.fill('#m_wa','81');await p.click('.c:has(#mdt) >> button:text-is("Enregistrer")');
let ms=await E(()=>D().ms);ok('Two measurement entries saved',ms.length==2&&ms[1].wa==81&&ms[0].sh==120,JSON.stringify(ms));
await p.click('nav >> text=Progrès');await p.click('.pf >> text=Tout');tx=await txt();
ok('Progress: waist chart −1 cm',tx.includes('▼ -1 cm'),tx.match(/[▲▼=][^()]*cm/)?.[0]);
ok('Shoulder/waist ratio 1,48 shown for him',tx.includes('Ratio épaules / taille : 1,48'));
await p.click('nav >> text=Profil');await p.locator('tr',{hasText:'15 nov.'}).locator('button').click();await p.click('#action-accept');ok('Delete measurement',await E(()=>D().ms.length==1));
// --- persistence + profile separation
await p.reload();ok('Profiles persist & stay separate',await E(()=>S.d.M.pf.time==45&&S.d.F.pf.age==26&&S.d.F.pf.time==45&&S.d.M.pf.age==30));
// --- EN sweep for undefined
let bad=[];for(const lg of ['FR','EN'])for(const pf of ['M','F']){await p.click(`.pf >> text=${lg}`);await E(pf=>{S.p=pf;go()},pf);for(let i=0;i<6;i++){await p.locator('nav button').nth(i).click();const t=(await txt())+(await p.textContent('nav'));if(/undefined|NaN|Infinity|\[object|null kg/.test(t))bad.push(lg+pf+i+': '+t.match(/.{0,40}(undefined|NaN|Infinity|\[object|null kg).{0,20}/)[0])}}
ok('No undefined/NaN in any tab (2 langs × 2 profiles)',!bad.length,bad.join(' | '));
// overflow
await p.click('.pf >> text=FR');let ov=[];for(const pf of ['M','F']){await E(pf=>{S.p=pf;go()},pf);for(let i=0;i<6;i++){await p.locator('nav button').nth(i).click();if(await E(()=>document.documentElement.scrollWidth>innerWidth))ov.push(pf+i)}}
ok('No horizontal overflow',!ov.length,ov.join(','));
ok('No JS errors',!errs.length,errs.join('|'));ok('No native alert/confirm used',(await E(()=>window.__nd.length))==0,JSON.stringify(await E(()=>window.__nd)));
await E(()=>{S.p='F';U.tab='set';go()});await p.screenshot({path:require('os').tmpdir()+'/N_her.png',fullPage:true});
await E(()=>{S.p='M';U.tab='set';go()});await p.screenshot({path:require('os').tmpdir()+'/N_him.png',fullPage:true});
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();process.exit(0)})().catch(e=>{console.log('CRASH',e.message.split('\n')[0]);process.exit(2)});
