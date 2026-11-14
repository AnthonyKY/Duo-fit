// Backup copy: discreet weekly reminder (✕ hides it 7 days), share sheet with a .json file (Mail / WhatsApp / Notes / Files),
// cancel, no-share fallback (download), restore from that file. Strict iPhone simulation; the share sheet is simulated.
const {devices}=require('playwright');const BR=require('./browser.js');const IOS=require('./iosinit.js');const fs=require('fs'),os=require('os'),path=require('path');
const URL=process.env.URL||'http://localhost:8766/index.html';
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
// simulated iOS share sheet: records what is shared; window.__shareMode = "ok" | "cancel"
const SHARE=`window.__shared=[];window.__shareMode="ok";navigator.canShare=d=>!!(d&&d.files&&d.files.length);
navigator.share=async d=>{const f=d.files&&d.files[0];window.__shared.push({name:f&&f.name,type:f&&f.type,text:d.text,body:f?await f.text():null});
  if(window.__shareMode==="cancel"){const e=new Error("cancel");e.name="AbortError";throw e}};`;
(async()=>{const b=await BR.launch();
const ctx=await b.newContext({...BR.dev('iPhone SE'),locale:'fr-FR',timezoneId:'Europe/Paris',acceptDownloads:true});await ctx.addInitScript(IOS);await ctx.addInitScript(SHARE);
const p=await ctx.newPage();p.setDefaultTimeout(8000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const DAY=864e5,T0=Date.UTC(2026,10,16,9);await p.clock.install({time:T0});
const E=(f,a)=>p.evaluate(f,a),txt=async()=>(await p.textContent('#v')).replace(/[  ]/g,' ');
const tap=loc=>loc.evaluate(el=>el.click()),nav=n=>tap(p.locator('nav button').nth(n)),accept=()=>tap(p.locator('#action-accept'));
await p.goto(URL);
ok('No reminder while there is nothing to save',!(await p.locator('.bkr').count()));
// one finished workout
await E(()=>{S.d.M.pf.var='fix';U.pick='A';go();begin('A');if(U.chk)start('A',0);setv(0,0,'w','40');setv(0,0,'r','10');done(0,0)});
ok('No reminder during a workout',!(await p.locator('.bkr').count()));
await E(()=>fin());await accept();await E(()=>{U.sum=null;go()});
let tx=await txt();
ok('Reminder appears on Today after the first workout (never backed up)',(await p.locator('.bkr').count())===1&&tx.includes('Pas encore de copie'));
ok('It is a slim line, not a pop-up: the workout card and Start button stay visible',await E(()=>{const r=document.querySelector('.bkr').getBoundingClientRect();return r.height<56&&!document.querySelector('dialog[open]')})&&(await p.locator('#v button',{hasText:'Commencer la séance'}).count())===1);
// ✕ hides it for 7 days
await tap(p.locator('.bkr .bkx2'));
ok('✕ hides it at once, with a short notice',!(await p.locator('.bkr').count())&&(await p.textContent('#notice')).includes('7 jours'));
await p.reload();ok('Still hidden after closing and reopening the app',!(await p.locator('.bkr').count()));
await p.clock.fastForward(6*DAY);await E(()=>go());ok('Still hidden 6 days later',!(await p.locator('.bkr').count()));
await p.clock.fastForward(DAY+36e5);await E(()=>go());ok('Back 7 days after ✕',(await p.locator('.bkr').count())===1);
// share from the reminder
await tap(p.locator('.bkr button',{hasText:'Envoyer'}));await p.waitForTimeout(50);
const sh=await E(()=>window.__shared.at(-1));
const day=await E(()=>tday());
ok('Share sheet gets one file named duofit-sauvegarde-'+day+'.json (JSON)',sh&&sh.name==='duofit-sauvegarde-'+day+'.json'&&sh.type==='application/json',JSON.stringify(sh&&{n:sh.name,t:sh.type}));
ok('The file is a complete backup of both profiles',await E(body=>{try{const st=readState(body);return st.d.M.logs.length===1&&st.d.M.logs[0].vol===400&&!!st.d.F}catch{return false}},sh.body));
ok('The message says how to restore',sh.text.includes('Restaurer depuis un fichier'));
ok('After sending: reminder gone, date of the copy saved',!(await p.locator('.bkr').count())&&await E(()=>Math.abs(S.bk.at-Date.now())<5000&&S.bk.snz==null));
await nav(5);tx=await txt();ok("Profile shows the last copy date (today)",/Dernière copie : .*aujourd'hui/.test(tx));
await p.clock.fastForward(8*DAY);await nav(0);tx=await txt();
ok('8 days later the reminder comes back with the age of the copy',tx.includes('Copie : il y a 8 jours'));
// cancel in the share sheet
await E(()=>{window.__shareMode='cancel'});await tap(p.locator('.bkr button',{hasText:'Envoyer'}));await p.waitForTimeout(50);
ok('Cancelling the share sheet does not count as a copy',(await p.locator('.bkr').count())===1&&await E(()=>Date.now()-S.bk.at>=8*864e5));
await E(()=>{window.__shareMode='ok'});
// Profile button
await nav(5);await tap(p.locator('#bkc button',{hasText:'Envoyer une copie'}));await p.waitForTimeout(50);
ok('Profile button shares the same file',await E(()=>window.__shared.length===3&&window.__shared.at(-1).name.startsWith('duofit-sauvegarde-')));
// restore from that file (picked in Files / Mail)
const bodyFile=path.join(os.tmpdir(),'duofit-sauvegarde-test.json');fs.writeFileSync(bodyFile,sh.body);
await E(()=>{S.d.M.logs=[];save();go()});
ok('(setup) history emptied',await E(()=>S.d.M.logs.length===0));
await p.locator('#bkf').setInputFiles(bodyFile);await p.waitForFunction(()=>$('action-dialog').open,null,{timeout:3000}).catch(()=>{});
ok('Picking the file asks for confirmation (custom dialog, no native one)',await E(()=>$('action-dialog').open));
await accept();ok('Restored: the workout is back',await E(()=>S.d.M.logs.length===1&&S.d.M.logs[0].vol===400));
ok('"Restaurer depuis un fichier" is a label tied to the file input (opens the iPhone file picker)',await E(()=>{const l=document.querySelector('label[for=bkf]'),i=document.getElementById('bkf');return!!l&&!!i&&i.type==='file'}));
// copy as text still works and counts
await p.locator('#bkc summary').click();await tap(p.locator('#bkc button',{hasText:'Exporter'}));
await ctx.grantPermissions(['clipboard-read','clipboard-write']).catch(()=>{});await E(()=>{S.bk={at:null,snz:null};save()});await tap(p.locator('#bkc button',{hasText:'Exporter'}));await p.waitForTimeout(100);
ok('Old "Copier en texte" path still fills the field (text stays visible after copying)',(await p.locator('#jx').inputValue()).startsWith('{"p":'));
ok('Copying the text also counts as a backup copy',await E(()=>!!S.bk.at));
// bad file
fs.writeFileSync(bodyFile,'not a backup');await p.locator('#bkf').setInputFiles(bodyFile);await p.waitForTimeout(150);
ok('A wrong file is refused, data untouched',(await p.textContent('#notice')).includes('Données invalides')&&await E(()=>S.d.M.logs.length===1));
// layout + English
await E(()=>{S.bk={at:null,snz:null};U.tab='today';go()});
ok('iPhone SE: reminder fits on one line, no sideways scroll',await E(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.bkr').getBoundingClientRect().height<56));
await E(()=>{S.lg='en';go()});ok('English reminder',(await txt()).includes('No backup copy yet'));
await nav(5);ok('English backup card',(await txt()).includes('Send a copy (Mail, WhatsApp'));await E(()=>{S.lg='fr';go()});
// phone without the share sheet: the file is downloaded instead
const p2=await ctx.newPage();await p2.addInitScript(()=>{delete Navigator.prototype.share;navigator.share=undefined;navigator.canShare=undefined});await p2.goto(URL);
const dl=p2.waitForEvent('download');await p2.evaluate(()=>{U.tab='set';go();shareBackup()});const d=await dl;
ok('Without a share sheet: backup file downloaded instead',d.suggestedFilename().startsWith('duofit-sauvegarde-')&&d.suggestedFilename().endsWith('.json'));
ok('No native dialogs or page errors',!errs.length&&await E(()=>window.__nd.length===0),errs.join(' | '));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();process.exit(fails?1:0)})().catch(e=>{console.log('CRASH',e.message);process.exit(2)});
