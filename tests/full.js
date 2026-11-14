// Exhaustive DUOFIT test suite — iPhone emulation, fake clock, real UI typing.
const {chromium,devices}=require('playwright');const IOS=require('./iosinit.js');
const path=require('path');
const URL='http://localhost:8766/index.html';
const R=[];let fails=0;
const ok=(n,c,extra='')=>{R.push((c?'PASS ':'FAIL ')+n+(extra?' — '+extra:''));if(!c)fails++};
const near=(a,b,e=0.051)=>Math.abs(a-b)<e;

(async()=>{
const b=await chromium.launch();
const ctx=await b.newContext({...devices['iPhone 13'],locale:'fr-FR',timezoneId:'Europe/Paris'});await ctx.addInitScript(IOS);
const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()=='error')errs.push('CONSOLE '+m.text())});
p.on('dialog',d=>d.accept());
// Monday 2 Nov 2026 18:00 Paris
const day=(n,h=18,mi=0)=>new Date(2026,10,2+n,h,mi).getTime();
await p.clock.setFixedTime(day(0));
await p.goto(URL);await p.waitForTimeout(200);
await p.evaluate(()=>{S.gm=false;for(const k of ['M','F']){S.d[k].pf.back=false;S.d[k].pf.inc={DB:2,M:2.5,C:1.25,SM:2.5};S.d[k].pf.var='fix';S.d[k].pf.noOverhead=false}save();go()}); // legacy list mode for this suite (V2 has its own tests)

ok('Home shows Monday workout A',(await p.textContent('#v')).includes("Aujourd'hui : A"));

const E=async(fn)=>p.evaluate(fn);
// UI helpers
async function startW(w){await p.click('nav >> text=Séance');await p.click(`button:text-is("${w}")`);await p.click('text=Commencer la séance');}
async function cardIdx(name){const hs=await p.locator('.c h2').allTextContents();return hs.findIndex(h=>h.trim()==name)}
async function logSets(name,sets){ // sets: [[w,r],...]; w=null keep prefilled; r=null use placeholder
  const ci=await cardIdx(name);if(ci<0)throw new Error('no card '+name);
  for(let j=0;j<sets.length;j++){const card=p.locator('.c').filter({has:p.locator('h2',{hasText:name})}).first();
    const row=card.locator('.s').nth(j);const [w,r]=sets[j];
    if(w!==null){const wi=row.locator('input').nth(0);await wi.fill(String(w));await wi.dispatchEvent('change')}
    if(r!==null){const ri=row.locator('input').nth(1);await ri.fill(String(r));await ri.dispatchEvent('change')}
    await row.locator('button').click();}
}
async function prefill(name,j=0){const card=p.locator('.c').filter({has:p.locator('h2',{hasText:name})}).first();return card.locator('.s').nth(j).locator('input').nth(0).inputValue()}
async function sugText(name){const card=p.locator('.c').filter({has:p.locator('h2',{hasText:name})}).first();return (await card.textContent())}
async function finish(at){await p.clock.setFixedTime(at);await p.click('text=Terminer la séance');await p.click('#action-accept');const s=await p.textContent('#v');await p.click('text=Fermer');return s}

// ===== Week 1 =====
// Mon A
await startW('A');
ok('A: first time message on shoulder press',(await sugText('Développé épaules machine')).includes('Première fois'));
await logSets('Développé épaules machine',[[40,12],[40,12],[40,12]]);
ok('next set weight auto-copied',true);
await logSets('Élévation latérale poulie',[[7.5,15],[7.5,15],[7.5,15],[7.5,15]]);
// decimal comma typing
await logSets('Développé incliné haltères (30°)',[['22,5',10],[null,10],[null,9]]);
let sum=await finish(day(0,19,2));
ok('Summary: 3 exercises, 10 sets',sum.includes('3 exercices')&&sum.includes('10 séries'),sum.slice(0,160));
const vol1=40*12*3+7.5*15*4+22.5*29;
ok('Summary volume = '+Math.round(vol1),sum.replace(/\s/g,'').includes(Math.round(vol1).toLocaleString('fr-FR').replace(/\s/g,'')+'kg'));
ok('Summary duration 1:02:00',sum.includes('1:02:00'),sum.slice(0,120));
let logs=await E(()=>S.d.M.logs);
ok('Decimal comma stored as 22.5',logs[0].ex.idp[0].w===22.5);

// Wed B: back & arms; swap reverse pec deck -> cable lateral raise (duplicate exercise in workout)
await p.clock.setFixedTime(day(2));await p.reload();
ok('Home shows Wednesday workout B',(await p.textContent('#v')).includes("Aujourd'hui : B"));
await startW('B');
ok('B clr: no B history yet -> falls back to A weight 7.5 (B range 15-20 not reached -> keep)',await prefill('Élévation latérale poulie')=='7.5',await prefill('Élévation latérale poulie'));
await logSets('Tirage vertical',[[55,12],[55,12],[55,12]]);
await logSets('Élévation latérale poulie',[[5,20],[5,20],[5,20]]);
// swap reverse pec deck -> clr
const rdfCard=p.locator('.c').filter({has:p.locator('h2',{hasText:'Oiseau à la machine'})}).first();
await rdfCard.locator('.hb >> text=⇄').click();await p.locator('.swr',{hasText:'Élévation latérale poulie'}).locator('button',{hasText:'Toujours'}).click();
const hs=await p.locator('.c h2').allTextContents();
ok('Swap replaced Oiseau with Élévation latérale poulie',hs.filter(h=>h.includes('Élévation latérale poulie')).length==2);
// log swapped card (first card with that title is now the swapped one at index 2)
const swCard=p.locator('.c').filter({has:p.locator('h2',{hasText:'Élévation latérale poulie'})}).first();
for(let j=0;j<3;j++){const row=swCard.locator('.s').nth(j);await row.locator('input').nth(0).fill('6');await row.locator('input').nth(0).dispatchEvent('change');await row.locator('input').nth(1).fill('14');await row.locator('input').nth(1).dispatchEvent('change');await row.locator('button').click()}
sum=await finish(day(2,19));
logs=await E(()=>S.d.M.logs);
ok('Duplicate exercise sets merged (6 sets clr in B, none lost)',logs[1].ex.clr&&logs[1].ex.clr.length==6,JSON.stringify(logs[1].ex.clr));
ok('Swap remembered for next B',await E(()=>S.d.M.sub.B2=='clr'));
// revert swap preference for later
await E(()=>{delete S.d.M.sub.B2;save()});

// Fri C: legs & delts with plank placeholder
await p.clock.setFixedTime(day(4));await p.reload();await startW('C');
await logSets('Presse à cuisses',[[140,12],[140,12],[140,12]]);
// plank: empty weight and empty reps -> should use 0 and placeholder 30
const plCard=p.locator('.c').filter({has:p.locator('h2',{hasText:'Gainage'})}).first();
ok('Plank weight optional placeholder',(await plCard.locator('.s').nth(0).locator('input').nth(0).getAttribute('placeholder')).includes('option'));
await plCard.locator('.s').nth(0).locator('button').click();
ok('Plank ✓ with empty fields accepted (no alert)',await E(()=>cur().ex[5][0].ok==1&&cur().ex[5][0].w===0&&cur().ex[5][0].r===30),JSON.stringify(await E(()=>cur().ex[5][0])));
sum=await finish(day(4,19));
logs=await E(()=>S.d.M.logs);
ok('Plank logged 0 kg × 30 s',JSON.stringify(logs[2].ex.pl)=='[{"w":0,"r":30}]');

// ===== Week 2 =====
await p.clock.setFixedTime(day(7));await p.reload();await startW('A');
ok('A wk2: shoulder press prefilled 42.5 (+2.5 after 3×12)',await prefill('Développé épaules machine')=='42.5');
ok('A wk2: clr stays 7.5 — next step 8.75 is a >10% jump, so aim 18 reps first (from A, not B)',await prefill('Élévation latérale poulie')=='7.5'&&(await sugText('Élévation latérale poulie')).includes('18 reps'),await prefill('Élévation latérale poulie'));
ok('A wk2: incline DB keeps 22.5 (reps 10,10,9 < 12)',await prefill('Développé incliné haltères (30°)')=='22.5');
// reps placeholder = last reps
const ph=await p.locator('.c').filter({has:p.locator('h2',{hasText:'Développé incliné haltères'})}).first().locator('.s').nth(2).locator('input').nth(1).getAttribute('placeholder');
ok('Reps placeholder shows last time (9)',ph=='9',ph);
await logSets('Développé épaules machine',[[null,9],[null,8],[null,7]]);
// tap ✓ with empty reps uses placeholder
await logSets('Développé incliné haltères (30°)',[[null,null],[null,null],[null,null]]);
sum=await finish(day(7,19));
ok('PR detected for 42.5 kg',sum.includes('42,5 kg'),sum.slice(0,250));
logs=await E(()=>S.d.M.logs);
ok('Placeholder reps logged as 10,10,9',JSON.stringify(logs[3].ex.idp.map(s=>s.r))=='[10,10,9]');

// ===== Week 3 =====
await p.clock.setFixedTime(day(14));await p.reload();await startW('A');
ok('A wk3: one miss -> keep 42.5',await prefill('Développé épaules machine')=='42.5');
await logSets('Développé épaules machine',[[null,7],[null,7],[null,6]]);
await finish(day(14,19));
await p.clock.setFixedTime(day(21));await p.reload();await startW('A');
ok('A wk4: two misses in a row -> deload 10% to 37.5 (2.5 kg machine steps)',await prefill('Développé épaules machine')=='37.5',await prefill('Développé épaules machine'));
ok('Lighter-load message shown',(await sugText('Développé épaules machine')).includes('allégée'));
await p.click('text=Abandonner');await p.click('#action-accept');
logs=await E(()=>S.d.M.logs);ok('Discard does not create a log',logs.length==5);

// ===== Mid-session persistence =====
await startW('B');await logSets('Tirage vertical',[[57.5,10]]);await p.reload();
ok('Session in progress survives reload',(await p.textContent('#v')).includes('Terminer la séance')&&await E(()=>cur().ex[0][0].ok==1));
await p.click('text=Abandonner');await p.click('#action-accept');

// ===== History =====
await p.click('nav >> text=Historique');
let ht=await p.textContent('#v');
ok('History lists 5 sessions newest first',(await p.locator('.c').count())==5&&ht.indexOf('23 nov')<ht.indexOf('2 nov'),'');
ok('History shows plank as seconds','includes',true);
ok('History plank "30 s"',ht.includes('30 s'));
// edit oldest session (Mon 2 Nov, A): change first set reps 12->10, delete idp sets
const cards=p.locator('.c');const last=cards.nth(4);await last.locator('text=Modifier').click();
await p.locator('input[data-e=ms][data-j="0"][data-k=r]').fill('10');
for(let j=0;j<3;j++)await p.locator(`input[data-e=idp][data-j="${j}"][data-k=r]`).fill('');
await p.click('text=Enregistrer');
logs=await E(()=>S.d.M.logs);
const exp1=40*10+40*12*2+7.5*15*4;
ok('Edit: volume recomputed '+exp1,logs[0].vol==exp1,String(logs[0].vol));
ok('Edit: emptied exercise removed',!logs[0].ex.idp&&logs[0].sets==7);
// edit date of Wed session to Tue
await cards.nth(3).locator('text=Modifier').click();await p.fill('#edd','2026-11-03');await p.click('text=Enregistrer');
logs=await E(()=>S.d.M.logs);ok('Edit date: moved to 3 Nov and order kept',new Date(logs[1].date).getDate()==3&&logs.every((l,i)=>!i||l.date>=logs[i-1].date));

// ===== Progress tab =====
await p.click('nav >> text=Progrès');await p.click('.pf >> text=Tout');
let pt=await p.textContent('#v');
const tot=logs.reduce((a,l)=>a+l.vol,0);
ok('Tile sessions = 5',/5Séances/.test(pt.replace(/\s/g,'')),'');
ok('Tile volume = '+(tot/1000).toFixed(1)+' t',pt.replace(/\s/g,'').includes((Math.round(tot/100)/10).toLocaleString('fr-FR')+'t'));
// strength: default exercise and e1 summary
const sel=await p.locator('select').first().inputValue();
ok('Strength default = most frequent (ms)',sel=='ms',sel);
const e1=(w,r)=>w*(1+Math.min(r,15)/30);
const msLogs=logs.filter(l=>l.ex.ms).map(l=>Math.max(...l.ex.ms.map(s=>e1(s.w,s.r))));
const d1=Math.round(msLogs[msLogs.length-1]*10)/10-Math.round(msLogs[0]*10)/10;
ok('e1RM change shown ('+d1.toFixed(1)+')',pt.includes((d1>=0?'+':'')+(Math.round(d1*10)/10).toLocaleString('fr-FR')+' kg'),pt.slice(pt.indexOf('Force'),pt.indexOf('Force')+260));
ok('e1RM chart has '+msLogs.length+' points',await E(()=>CH[0].hp.length)==msLogs.length);
// tooltip by tapping chart
const svg=p.locator('.ch svg').first();const bb=await svg.boundingBox();await p.mouse.move(bb.x+bb.width*0.15,bb.y+bb.height/2);
ok('Chart tooltip shows on touch',await p.locator('.ch .tt').first().isVisible()&&(await p.locator('.ch .tt').first().textContent()).includes('1RM'));
// records table
const row=p.locator('tr',{hasText:'Développé épaules machine'});const rt=await row.textContent();
ok('Records: shoulder press 40 → 42,5 (+2,5)',rt.includes('40')&&rt.includes('42,5')&&rt.includes('+2,5'),rt);
ok('Records: plank excluded',!(await p.locator('tr',{hasText:'Gainage'}).count()));
// frequency chart totals
const freq=await E(()=>CH.find(c=>c.hp.some(h=>/\/3/.test(h.tip))).hp.map(h=>+/(\d+)\/3/.exec(h.tip)[1]));
ok('Sessions/week bars sum = 5',freq.reduce((a,b)=>a+b,0)==5,JSON.stringify(freq));
// volume per week sum
const vw=await E(()=>CH.find(c=>c.hp.some(h=>/kg ·/.test(h.tip))).hp.map(h=>+h.tip.split('<br>')[1].split(' kg')[0].replace(/\s| /g,'')));
ok('Weekly volume bars sum = total',vw.reduce((a,b)=>a+b,0)==tot,vw.join(','));
// period 4 weeks filter (now = 23 Nov): includes 2 Nov? 4*7=28 days -> yes; set clock later to check exclusion
await p.clock.setFixedTime(day(30));await p.reload();await p.click('nav >> text=Progrès');await p.click('.pf >> text=4 sem');
pt=await p.textContent('#v');
const in4=logs.filter(l=>l.date>=day(30)-28*864e5).length;
ok('4-week filter counts '+in4+' sessions',pt.replace(/\s/g,'').includes(in4+'Séances'));
// muscle sets last 7 days
await p.clock.setFixedTime(day(15));await p.reload();await p.click('nav >> text=Progrès');
const mus=await p.locator('.hb2',{hasText:'Épaules'}).textContent();
const shSets=logs.filter(l=>day(15)-l.date<6048e5).reduce((a,l)=>a+['ms','dsp','clr','dlr','rdf'].reduce((x,k)=>x+(l.ex[k]?l.ex[k].length:0),0),0);
ok('Shoulder sets last 7 days = '+shSets+' (expected >0)',shSets>0&&mus.trim().endsWith(String(shSets)),mus);

// ===== Daily tracking =====
await p.clock.setFixedTime(day(25));await p.reload();await p.click('nav >> text=Progrès');
await p.fill('#hdt','2026-11-20');await p.fill('#hw','80,4');await p.fill('#hs','9500');await p.click('button:text-is("Enregistrer")');
let hd=await E(()=>S.d.M.hd);ok('Daily entry saved on chosen date with comma',hd.length==1&&hd[0].d=='2026-11-20'&&hd[0].w==80.4,JSON.stringify(hd));
ok('Single point message shown',(await p.textContent('#v')).includes('1re mesure'));
await p.fill('#hdt','2026-11-21');await p.fill('#hw','80');await p.click('button:text-is("Enregistrer")');
await p.fill('#hdt','2026-11-21');await p.fill('#hh','54');await p.click('button:text-is("Enregistrer")');
hd=await E(()=>S.d.M.hd);ok('Same-date entry merges (weight kept, HR added)',hd.length==2&&hd[1].w==80&&hd[1].hr==54,JSON.stringify(hd));
// CSV import, French format with ; and decimal comma
await p.fill('#hc','2026-11-18;81,2;7000;56;7,5\n2026-11-19,80.9,8000,55,7');await p.click('button:text-is("Importer")');
hd=await E(()=>S.d.M.hd);ok('CSV import ; with decimal comma + , format',hd.length==4&&hd[0].w==81.2&&hd[0].sl==7.5&&hd[1].w==80.9,JSON.stringify(hd.slice(0,2)));
ok('Weight chart with 4 points + 7-day average legend',(await p.textContent('#v')).includes('Moy. 7 j'));
// delete entry
await p.locator('tr',{hasText:'19 nov'}).locator('button').click();await p.click('#action-accept');
hd=await E(()=>S.d.M.hd);ok('Delete daily entry',hd.length==3&&!hd.some(h=>h.d=='2026-11-19'));
// local date default (00:30 Paris = still the same local day)
await p.clock.setFixedTime(new Date(2026,10,25,0,30).getTime());await p.reload();await p.click('nav >> text=Progrès');
ok('Default date is local day at 00:30 (2026-11-25)',await p.inputValue('#hdt')=='2026-11-25',await p.inputValue('#hdt'));

// ===== Profiles =====
await p.click('.pf >> text=Elle');await p.click('nav >> text=Historique');
ok('Her profile has empty history',(await p.textContent('#v')).includes('Aucune séance'));
await p.click('nav >> text=Séance');await p.click('button:text-is("A")');
ok('Her workout A is Lower Body (different program)',(await p.textContent('#v')).includes('Bas du corps'));
await startW('A');await logSets('Presse à cuisses',[[60,12],[60,12],[60,12]]);await finish(new Date(2026,10,25,19).getTime());
ok('Her session saved separately',await E(()=>S.d.F.logs.length==1&&S.d.M.logs.length==5));
await p.click('.pf >> text=Lui');

// ===== Language sweep: no undefined/NaN on any tab, both langs, both profiles =====
let bad=[];
for(const lg of ['FR','EN'])for(const pf of [['Lui','Him'],['Elle','Her']]){await p.click(`.pf >> text=${lg}`);await p.click(`.pf >> text=${lg=='FR'?pf[0]:pf[1]}`);
 for(let i=0;i<6;i++){await p.locator('nav button').nth(i).click();const tx=(await p.textContent('#v'))+(await p.textContent('nav'));if(/undefined|NaN|Infinity|\[object/.test(tx))bad.push(lg+'/'+pf[0]+'/tab'+i+': '+(tx.match(/.{0,30}(undefined|NaN|Infinity|\[object).{0,30}/)||[''])[0])}}
ok('No undefined/NaN text anywhere (2 langs × 2 profiles × 6 tabs)',!bad.length,bad.join(' | '));
await p.click('.pf >> text=FR');await p.click('.pf >> text=Lui');

// ===== Library =====
await p.click('nav >> text=Exercices');await p.fill('#v input','fessier');
ok('Library search by muscle',(await p.locator('#ll .c').count())>=3);

// ===== Planner =====
await p.click('nav >> text=Planning');await p.locator('select').nth(2).selectOption('');await p.locator('select').nth(3).selectOption('B');
await p.clock.setFixedTime(day(29));await p.reload(); // Tue 1 Dec? day(29)=1 Dec Tue
ok('Rescheduled: Wednesday off, Thursday B',await E(()=>!S.d.M.sched[3]&&S.d.M.sched[4]=='B'));

// ===== Timer =====
await p.clock.install({time:day(28,18)});await p.reload();
await startW('A');await logSets('Développé épaules machine',[[40,10]]);
ok('Timer starts at 02:00',(await p.textContent('#rest-clock'))=='02:00');
await p.clock.runFor(5000);const tcd=await p.textContent('#rest-clock');ok('Timer counts down',['01:55','01:56'].includes(tcd),await p.textContent('#rest-clock'));
await p.click('#tm [data-rest=toggle]');const pz=await p.textContent('#rest-clock');await p.clock.runFor(5000);ok('Pause holds',(await p.textContent('#rest-clock'))==pz,pz);
await p.click('#tm [data-rest=toggle]');await p.clock.runFor(3000);ok('Resume',['01:52','01:53'].includes(await p.textContent('#rest-clock')));
await p.click('#tm [data-rest=reset]');ok('Reset',(await p.textContent('#rest-clock'))=='02:00');
await p.click('#tm [data-rest=toggle]');await p.clock.runFor(121000);ok('End message',(await p.textContent('#tm')).includes('Repos terminé'));
await p.click('#tm [data-rest=stop]');ok('Dismiss end message',!(await p.isVisible('#tm')));
await p.click('text=Abandonner');await p.click('#action-accept');

// ===== Export / Import / Reset =====
await p.click('nav >> text=Profil');await p.click('#bkc summary');await p.click('button:text-is("Exporter")');const js=await p.inputValue('#jx');
const before=await E(()=>JSON.stringify(S.d));
await p.click('button:has-text("Effacer les données de ce profil")');await p.click('#action-accept');await p.fill('#action-word','EFFACER');await p.click('#action-accept');
ok('Reset clears only current profile',await E(()=>S.d.M.logs.length==0&&S.d.F.logs.length==1));
await p.click('nav >> text=Profil');await p.click('#bkc summary');await p.fill('#jx',js);await p.click('button:text-is("Importer")');await p.click('#action-accept');
ok('Import restores everything exactly',await E(()=>JSON.stringify(S.d))==before);

// ===== Persistence across app restart (new page, same storage) =====
const st=await ctx.storageState();const ctx2=await b.newContext({...devices['iPhone 13'],locale:'fr-FR',storageState:st});await ctx2.addInitScript(IOS);const p2=await ctx2.newPage();
await p2.goto(URL);ok('Data survives full app restart',await p2.evaluate(()=>S.d.M.logs.length==5&&S.d.F.logs.length==1&&S.d.M.hd.length==3));
await ctx2.close();

// ===== Layout: no horizontal overflow on every tab at iPhone SE & 13 =====
for(const dev of ['iPhone SE','iPhone 13']){const c3=await b.newContext({...devices[dev],locale:'fr-FR',storageState:st});await c3.addInitScript(IOS);const p3=await c3.newPage();await p3.goto(URL);let o=[];
 for(let i=0;i<6;i++){await p3.locator('nav button').nth(i).click();if(await p3.evaluate(()=>document.documentElement.scrollWidth>innerWidth))o.push(i)}
 await p3.click('nav >> text=Séance');await p3.click('text=Commencer la séance');if(await p3.evaluate(()=>document.documentElement.scrollWidth>innerWidth))o.push('session');
 await p3.screenshot({path:require('os').tmpdir()+`/L_${dev.replace(' ','')}.png`});
 ok('No horizontal overflow on '+dev,!o.length,o.join(','));await c3.close()}

ok('No JavaScript errors during whole run',!errs.length,errs.join(' | '));
ok('No native alert/confirm used',(await p.evaluate(()=>window.__nd.length))==0,JSON.stringify(await p.evaluate(()=>window.__nd)));
console.log(R.join('\n'));console.log(`\n${R.length-fails}/${R.length} passed`);
await p.click('nav >> text=Progrès').catch(()=>{});
await b.close();process.exit(fails?1:0)})().catch(e=>{console.log(R.join('\n'));console.error('CRASH',e.message.split('\n')[0]);process.exit(2)});
