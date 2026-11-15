// Every remaining feature, strict iPhone simulation.
const {devices}=require('playwright');const BR=require('./browser.js');const IOS=require('./iosinit.js');
const URL=process.env.URL||'http://localhost:8766/index.html';
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
(async()=>{const b=await BR.launch();
const mkctx=async(dev,extra={})=>{const c=await b.newContext({...(dev?devices[dev]:BR.dev('iPhone 13')),locale:'fr-FR',timezoneId:'Europe/Paris',...extra});await c.addInitScript(IOS);return c};
const ctx=await mkctx();const p=await ctx.newPage();p.setDefaultTimeout(6000);const errs=[];p.on('pageerror',e=>BR.noise(e.message)||errs.push(e.message));
await p.clock.install({time:new Date(2026,10,16,18,0,0)}); // Monday
await p.goto(URL);
await p.evaluate(()=>{S.gm=false;for(const k of ['M','F']){S.d[k].pf.back=false;S.d[k].pf.inc={DB:2,M:2.5,C:1.25,SM:2.5};S.d[k].pf.var='fix';S.d[k].pf.noOverhead=false}save();go()}); // legacy list mode for this suite (V2 has its own tests)
const E=(f,a)=>p.evaluate(f,a),txt=async()=>(await p.textContent('#v')).replace(/[  ]/g,' ');
const typ=(loc,v)=>loc.evaluate((el,v)=>{el.focus();el.value='';for(const ch of String(v)){el.value+=ch;el.dispatchEvent(new Event('input',{bubbles:true}))}if(String(v)==='')el.dispatchEvent(new Event('input',{bubbles:true}))},v);
const tap=loc=>loc.evaluate(el=>el.click());
const nav=async n=>{await tap(p.locator('nav button').nth(n))};
const pickW=async w=>{await nav(0);await tap(p.locator(`.r button:text-is("${w}")`))};

// ===== 1. Every workout of both profiles, completed fully by typing every set =====
for(const pf of ['M','F']){
 await E(pf=>{S.p=pf;U.tab='today';go()},pf);
 for(const w of ['A','B','C']){
  await pickW(w);const plan=await E(w=>eff(w),w);
  await tap(p.locator('text=Commencer la séance'));
  let vol=0,sets=0,exN=0;const nCards=plan.ex.length;
  for(let i=0;i<nCards;i++){const e=plan.ex[i];const bw=await E(i=>isBW(sid(i)),i);exN++;
   for(let j=0;j<e[1];j++){const W=bw?0:20+i*5+j,Rp=e[2]+(j%2);
    if(!bw)await typ(p.locator(`#w${i}_${j}`),String(W).replace('.',','));await typ(p.locator(`#r${i}_${j}`),Rp);
    await tap(p.locator(`#r${i}_${j}`).locator('xpath=..').locator('button'));vol+=W*Rp;sets++}}
  if(plan.cm){await typ(p.locator('#cmin'),'10');await tap(p.locator('.c',{hasText:'Cardio'}).locator('.s button'))}
  const okSets=await E(()=>Object.values(cur().ex).reduce((a,x)=>a+x.filter(s=>s.ok).length,0));
  await p.clock.fastForward(50*60000);await tap(p.locator('text=Terminer la séance'));await tap(p.locator('#action-accept'));const tx=await txt();
  ok(`${pf}/${w}: all ${sets} sets ticked, summary ${exN} ex · ${sets} sets · ${vol.toLocaleString('fr-FR').replace(/ /g,' ')} kg`,okSets==sets&&tx.includes(sets+' séries')&&tx.includes(exN+' exercices')&&tx.includes(vol.toLocaleString('fr-FR').replace(/ /g,' ')+' kg'),tx.slice(0,170));
  await tap(p.locator('text=Fermer'));await p.clock.fastForward(24*3600e3);
 }
}
ok('Him has 3 sessions, Her has 3 sessions',await E(()=>S.d.M.logs.length==3&&S.d.F.logs.length==3));

// ===== 2. Guide + Swap on every exercise of every workout =====
let swapIssues=[],guideIssues=[];
for(const pf of ['M','F']){await E(pf=>{S.p=pf;go()},pf);
 for(const w of ['A','B','C']){await pickW(w);await tap(p.locator('text=Commencer la séance'));const n=await p.locator('#v .c:not(.wuc) h2').count();
  for(let i=0;i<n;i++){const card=p.locator('#v .c:not(.wuc)').filter({has:p.locator('h2')}).nth(i);const name=(await card.locator('h2').textContent()).trim();
   if(name.startsWith('🚶'))continue;
   await tap(card.locator('.hb >> text=Guide'));const g=await p.locator('#v .c:not(.wuc)').filter({has:p.locator('h2')}).nth(i).textContent();if(!g.includes('Exécution')||!g.includes('À éviter'))guideIssues.push(pf+w+i);
   await tap(p.locator('#v .c:not(.wuc)').filter({has:p.locator('h2')}).nth(i).locator('.hb >> text=Guide'));
   const sb=p.locator('#v .c:not(.wuc)').filter({has:p.locator('h2')}).nth(i).locator('.hb >> text=⇄');if(!(await sb.count())){swapIssues.push(`${pf}${w}${i} no ⇄ button`);continue}
   await tap(sb);const alts=await p.locator('#v .c:not(.wuc)').filter({has:p.locator('h2')}).nth(i).locator('.swr').count();if(!alts){if(!(await p.locator('#v .swp >> text=Garder à chaque fois').count()))swapIssues.push(`${pf}${w}${i} panel without pin`);await tap(p.locator('#v .swp button:has-text("Annuler")'));continue}
   await tap(p.locator('#v .c:not(.wuc)').filter({has:p.locator('h2')}).nth(i).locator('.swr button:has-text("Toujours")').first());const n2=(await p.locator('#v .c:not(.wuc)').filter({has:p.locator('h2')}).nth(i).locator('h2').textContent()).trim();
   if(n2==name)swapIssues.push(`${pf}${w}${i} ${name} did not swap`);
   if(alts){await tap(p.locator('#v .c:not(.wuc)').filter({has:p.locator('h2')}).nth(i).locator('.hb >> text=⇄'));await tap(p.locator('#v .c:not(.wuc)').filter({has:p.locator('h2')}).nth(i).locator('.swr').filter({hasText:name}).locator('button:has-text("Toujours")').first());const n3=(await p.locator('#v .c:not(.wuc)').filter({has:p.locator('h2')}).nth(i).locator('h2').textContent()).trim();if(n3!=name)swapIssues.push(`${pf}${w}${i} swap back gave ${n3}`)}}
  await tap(p.locator('#v >> text=Abandonner'));await tap(p.locator('#action-accept'))}}
ok('Guide opens/closes on every exercise (both profiles, all workouts)',!guideIssues.length,guideIssues.join(','));
ok('Swap → alternative and back on every exercise',!swapIssues.length,swapIssues.join(' | '));
ok('No swap preference left behind',await E(()=>!Object.keys(S.d.M.sub).length&&!Object.keys(S.d.F.sub).length),JSON.stringify(await E(()=>[S.d.M.sub,S.d.F.sub])));

// ===== 3. Two sessions in parallel (Him and Her) =====
await E(()=>{S.p='M';go()});await pickW('A');await tap(p.locator('text=Commencer la séance'));await typ(p.locator('#w0_0'),'50');await typ(p.locator('#r0_0'),'8');await tap(p.locator('#r0_0').locator('xpath=..').locator('button'));
await tap(p.locator('.pf >> text=Elle'));ok('Switching to Her during His session shows her home',(await txt()).includes('Commencer la séance'));
await pickW('B');await tap(p.locator('text=Commencer la séance'));await tap(p.locator('.pf >> text=Lui'));
ok('Back to Him: his session intact (50×8 ticked)',await E(()=>D().cur&&D().cur.ex[0][0].ok==1&&D().cur.ex[0][0].w==50));
await tap(p.locator('#v >> text=Abandonner'));await tap(p.locator('#action-accept'));await tap(p.locator('.pf >> text=Elle'));ok('Her session still running',await E(()=>!!D().cur));await tap(p.locator('#v >> text=Abandonner'));await tap(p.locator('#action-accept'));
await tap(p.locator('.pf >> text=Lui'));

// ===== 4. Rest timer across tabs, untick, end =====
await pickW('A');await tap(p.locator('text=Commencer la séance'));await typ(p.locator('#w0_0'),'40');await typ(p.locator('#r0_0'),'10');await tap(p.locator('#r0_0').locator('xpath=..').locator('button'));
await nav(4);await p.clock.runFor(10000);ok('Rest timer keeps running on another tab',await p.isVisible('#rest-clock')&&['01:50','01:51'].includes(await p.textContent('#rest-clock')),await p.textContent('#rest-clock'));
await nav(0);await tap(p.locator('#r0_0').locator('xpath=..').locator('button'));ok('Untick does not restart timer',(await p.textContent('#rest-clock'))!='02:00');
await tap(p.locator('#r0_0').locator('xpath=..').locator('button'));await p.clock.runFor(121000);ok('Timer end message',(await p.textContent('#tm')).includes('Repos terminé'));
await tap(p.locator('#v >> text=Abandonner'));await tap(p.locator('#action-accept'));ok('Abandon hides end message too',!(await p.isVisible('#tm')));

// ===== 5. Library =====
await nav(2);const all=await p.locator('#ll .c').count();const NE=await E(()=>Object.keys(E).length);ok('Library lists all '+NE+' exercises',all==NE&&NE>=59,String(all));
for(const [q,min] of [['fessiers',3],['poulie',7],['machine',8],['haltères',3],['débutant',1],['zzz',0]]){await typ(p.locator('#lq'),q);const n=await p.locator('#ll .c').count();ok(`Library search "${q}" → ${n}`,q=='zzz'?n==0:n>=min)}
ok('Empty search shows a message',(await p.textContent('#ll')).includes('Aucun'),(await p.textContent('#ll')).slice(0,40));
await typ(p.locator('#lq'),'');
const lsel=p.locator('.lf select');
await lsel.nth(0).selectOption('gl');{const want=await E(()=>Object.keys(E).filter(k=>GR[k]=='gl').length);ok('Filter muscle = Fessiers → '+want,(await p.locator('#ll .c').count())==want&&want==7)}
await lsel.nth(1).selectOption('C');ok('+ equipment = Poulie → 1 (kickback)',(await p.locator('#ll .c').count())==1&&(await p.textContent('#ll')).includes('Kickback'));
await lsel.nth(0).selectOption('');await lsel.nth(1).selectOption('');await lsel.nth(2).selectOption('1');{const want=await E(()=>Object.values(E).filter(e=>e[5]==1).length);ok('Filter level = Intermédiaire → '+want,(await p.locator('#ll .c').count())==want,String(await p.locator('#ll .c').count()))}
await lsel.nth(2).selectOption('');await tap(p.locator('.tg2 input'));{const want=await E(()=>Object.keys(E).length-AX.length);ok('Back-friendly toggle hides '+(await E(()=>AX.length))+' exercises ('+want+')',(await p.locator('#ll .c').count())==want)}await tap(p.locator('.tg2 input'));

// ===== 6. Planner: every weekday shown correctly on home =====
await nav(1);const sel=p.locator('select');
const want=['A','','B','','C','A',''];// Mon..Sun
for(let i=0;i<7;i++){await sel.nth(i).selectOption(want[i])}
let dayIssues=[];for(let d=0;d<7;d++){await p.clock.setFixedTime(new Date(2026,10,23+d,9,0,0));await nav(0);const tx=await txt();const w=want[d];if(w?!tx.includes("Aujourd'hui : "+w):!tx.includes('Jour de récupération'))dayIssues.push(d+':'+w)}
ok('Home shows the planned workout for all 7 days',!dayIssues.length,dayIssues.join(','));
await p.clock.setFixedTime(new Date(2026,10,30,18,0,0));

// ===== 7. Theme & language persist =====
await nav(5);await tap(p.locator('button:text-is("☀️")'));await tap(p.locator('.pf >> text=EN'));await p.reload();
ok('Theme light + English persist after reload',await E(()=>document.documentElement.dataset.theme=='light'&&S.lg=='en')&&(await p.textContent('nav')).includes('Workout'));
let frLeft=[];for(const pf of ['M','F']){await E(pf=>{S.p=pf;go()},pf);for(let i=0;i<6;i++){await nav(i);const tx=(await p.textContent('#v')).replace(/(Lui|Elle)/g,'');const m=tx.match(/[^\s]*[éèàùçê][^\s]*/g);if(m)frLeft.push(`${pf}${i}: ${[...new Set(m)].slice(0,6).join(' ')}`)}}
ok('English UI has no French leftovers',!frLeft.length,frLeft.join(' | '));
await tap(p.locator('.pf >> text=FR'));await nav(5);await tap(p.locator('button:text-is("Auto")'));

// ===== 8. Progress: every chart has data + tooltip, period buttons =====
await E(()=>{S.p='M';go()});await nav(3);
for(const per of ['4 sem','3 mois','Tout']){await tap(p.locator(`.pf button:text-is("${per}")`));const n=await p.locator('.ch svg').count();ok(`Progress "${per}": ${n} charts render`,n>=3)}
let ttIssues=[];const nc=await p.locator('.ch').count();for(let i=0;i<nc;i++){const svg=p.locator('.ch svg').nth(i);await svg.scrollIntoViewIfNeeded();const bb=await svg.boundingBox();await p.mouse.move(bb.x+bb.width*.7,bb.y+bb.height*.5);const t=await p.locator('.ch .tt').nth(i).textContent();if(!t||/undefined|NaN/.test(t))ttIssues.push(i+':'+t)}
ok(`Tooltips on all ${nc} charts`,!ttIssues.length,ttIssues.join(','));
// every exercise selectable in strength chart
const opts=await p.locator('#v select').first().locator('option').count();let selIssues=[];for(let i=0;i<opts;i++){const v=await p.locator('#v select').first().locator('option').nth(i).getAttribute('value');await p.locator('#v select').first().selectOption(v);const t=await txt();if(/NaN|undefined/.test(t))selIssues.push(v)}
ok(`Strength chart works for all ${opts} exercises`,!selIssues.length,selIssues.join(','));

// ===== 9. Export / bad import / corrupted storage =====
await nav(5);await tap(p.locator('button:text-is("Exporter")'));const js=await p.inputValue('#jx');ok('Export produces JSON with both profiles',JSON.parse(js).d.M.logs.length==3);
await typ(p.locator('#jx'),'{pas du json');await tap(p.locator('button:text-is("Importer")'));ok('Bad import → message, data untouched',(await p.textContent('#notice')).length>3&&await E(()=>S.d.M.logs.length==3));
const c2=await mkctx();const p2=await c2.newPage();const e2=[];p2.on('pageerror',e=>BR.noise(e.message)||e2.push(e.message));await p2.addInitScript(()=>{try{localStorage.setItem('duofit','{corrupted')}catch(e){}});await p2.goto(URL);
ok('Corrupted storage → app still starts',(await p2.textContent('nav')).length>10&&!e2.length,e2.join('|'));await c2.close();
// old-format data (v1: bw array, no hd/pf/ms)
const c3=await mkctx();const p3=await c3.newPage();const e3=[];p3.on('pageerror',e=>BR.noise(e.message)||e3.push(e.message));
await p3.addInitScript(()=>{localStorage.setItem('duofit',JSON.stringify({p:'M',d:{M:{logs:[{date:Date.now()-864e5,wk:'A',name:'x',dur:50,ex:{ms:[{w:40,r:10}]},note:'',vol:400,sets:1}],sched:{1:'A',3:'B',5:'C'},bw:[80,79.5],sub:{},cur:null},F:{logs:[],sched:{1:'A',3:'B',5:'C'},bw:[],sub:{},cur:null}}}))});
await p3.goto(URL);for(let i=0;i<6;i++){await p3.locator('nav button').nth(i).click()}
ok('Old data format migrates without errors (all tabs)',!e3.length&&(await p3.textContent('#v')).length>20,e3.join('|'));await c3.close();

// ===== 10. Big data performance =====
await E(()=>{const now=Date.now();const L=[];for(let i=300;i>0;i--){const wk=['A','B','C'][i%3];const ex={};P.M[wk].ex.forEach(e=>ex[e[0]]=[{w:40+i/10,r:10},{w:40+i/10,r:9}]);L.push({date:now-i*864e5,wk,dur:55,ex,note:'',vol:800,sets:12})}S.d.M.logs=L;for(let i=0;i<300;i++)S.d.M.hd.push({d:tday(now-i*864e5),w:80+Math.sin(i)/2,st:8000,hr:55,sl:7});S.d.M.hd.sort((a,b)=>a.d<b.d?-1:1);save()});
const tms=[];for(const i of [0,3,4,5]){const t0=Date.now();await nav(i);tms.push(Date.now()-t0)}
await nav(3);await tap(p.locator('.pf button:text-is("Tout")'));const t1=Date.now();await nav(4);await nav(3);const tAll=Date.now()-t1;
ok('300 sessions + 300 weigh-ins: tabs open fast ('+tms.join('/')+' ms, all-time progress '+tAll+' ms)',Math.max(...tms,tAll)<1500);
const size=await E(()=>localStorage.getItem('duofit').length);ok('Storage size reasonable ('+Math.round(size/1024)+' KB)',size<2e6);

// ===== 11. Week labels across daylight-saving change (25 Oct 2026) =====
await nav(3);await tap(p.locator('.pf button:text-is("Tout")'));const labels=await E(()=>CH.filter(c=>c.hp.some(h=>/\/3/.test(h.tip))).flatMap(c=>c.hp.map(h=>h.tip.match(/du (.*?)<\/b>/)[1])));
const notMon=await E(ls=>ls.filter(l=>{const m={janv:0,'févr':1,mars:2,avr:3,mai:4,juin:5,juil:6,'août':7,sept:8,oct:9,nov:10,'déc':11};const [d,mo]=l.replace('.','').split(' ');const yr=m[mo]>10?2025:2026;const dt=new Date(yr,m[mo],+d);return dt.getDay()!=1&&!(m[mo]>10&&new Date(2026,m[mo],+d).getDay()==1)}),labels);
ok('All week labels are Mondays (incl. across DST)',!notMon.length,notMon.slice(0,5).join(','));

// ===== 12. Layout on small & large phones for every screen + modal =====
for(const dev of ['iPhone SE','iPhone 15 Pro Max']){const c=await mkctx(dev);const q=await c.newPage();await q.goto(URL);let ov=[];for(const pf of ['M','F']){await q.evaluate(pf=>{S.p=pf;go()},pf);for(let i=0;i<6;i++){await q.locator('nav button').nth(i).click();if(await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth))ov.push(pf+i)}}
 await q.locator('nav button').nth(0).click();await q.click('text=Commencer la séance');await q.click('#v >> text=Abandonner');if(await q.evaluate(()=>document.documentElement.scrollWidth>innerWidth))ov.push('modal');ok('No horizontal overflow on '+dev+' (12 screens + modal)',!ov.length,ov.join(','));await c.close()}

ok('No native alert/confirm used',(await E(()=>window.__nd.length))==0,JSON.stringify(await E(()=>window.__nd)));
ok('No JavaScript errors',!errs.length,errs.join(' | '));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();process.exit(fails?1:0)})().catch(e=>{console.log('CRASH',e.message.split('\n').slice(0,3).join(' '));process.exit(2)});
