// The three priorities, end to end on a strict iPhone SE simulation under the GitHub Pages sub-path:
// 1. variety that respects the workout, level, equipment and exclusions + a reference lift and its last loads
// 2. a real 20-minute "Back & Arms" with only a cable station (warm-up, ramp-up, rests, station changes included)
// 3. in-session reliability: timer, pause, replace after a logged set, shortening, airplane mode, abandon, finish, history, old data
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {devices}=require("playwright");const BR=require("./browser.js");const IOS=require("./iosinit.js");
const root=path.join(__dirname,".."),base="/Duo-fit/",FILES=["index.html","sw.js","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png"];
const R=[];let fails=0,tx='';const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
(async()=>{
const server=http.createServer((req,res)=>{const route=new URL(req.url,"http://x").pathname,name=route===base?"index.html":route.slice(base.length);
  if(!route.startsWith(base)||!FILES.includes(name)){res.writeHead(404);return res.end()}
  res.setHeader("Content-Type",name.endsWith("html")?"text/html; charset=utf-8":name.endsWith("js")?"application/javascript":name.endsWith("png")?"image/png":"application/manifest+json");
  res.end(fs.readFileSync(path.join(root,name)))});
await new Promise(r=>server.listen(0,"127.0.0.1",r));const url="http://127.0.0.1:"+server.address().port+base;
const b=await BR.launch(),ctx=await b.newContext({...BR.dev("iPhone SE"),locale:"fr-FR",timezoneId:"Europe/Paris"});await ctx.addInitScript(IOS);
// ---- old data from before this update (v 2026-11-14c format: no gear, no draw, no variety settings)
const T0=Date.UTC(2026,10,9,8),DAY=864e5;
const oldLogs=[{date:T0-14*DAY,wk:"A",dur:52,durSec:3120,ex:{ms:[{w:40,r:10},{w:40,r:9}],cc:[{w:30,r:12}]},note:"ancienne",vol:1120,sets:3,pr:[]},
  {date:T0-12*DAY,wk:"B",dur:55,durSec:3300,ex:{lpd:[{w:55,r:12},{w:55,r:11}],csr:[{w:50,r:10}],idc:[{w:10,r:12}]},note:"",vol:1835,sets:4,pr:[]},
  {date:T0-10*DAY,wk:"C",dur:58,durSec:3480,ex:{lp:[{w:120,r:10}],pl:[{w:0,r:45}]},note:"",vol:1200,sets:2,pr:[]}];
const legacy={p:"M",th:"",lg:"fr",d:{M:{logs:oldLogs,sched:{1:"A",3:"B",5:"C"},hd:[{d:"2026-11-01",w:80.2}],ms:[{d:"2026-11-01",wa:82}],sub:{A0:"ms"},notes:{lpd:"siège 4"},cur:null,
  pf:{sex:"m",age:27,h:188,w:80,lvl:"int",act:"auto",time:60,goal:"gain",back:true,inc:{DB:2,M:5,C:2.5,SM:2.5}}},F:{logs:[],sched:{1:"A"},hd:[],ms:[],sub:{},cur:null}}};
await ctx.addInitScript(raw=>{if(!localStorage.getItem("duofit-seeded")){localStorage.setItem("duofit",raw);localStorage.setItem("duofit-seeded","1")}},JSON.stringify(legacy));
let p=await ctx.newPage();const errs=[];const watch=()=>p.on("pageerror",e=>BR.noise(e.message)||errs.push(e.message));watch();
await p.clock.install({time:T0});
await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
const E=(f,a)=>p.evaluate(f,a),txt=async()=>(await p.textContent("#v")).replace(/[  ]/g," ");
const tap=loc=>loc.evaluate(el=>el.click()),nav=n=>tap(p.locator("nav button").nth(n)),accept=()=>tap(p.locator("#action-accept"));
const type=(sel,v)=>p.locator(sel).evaluate((el,v)=>{el.focus();el.value=String(v);el.dispatchEvent(new Event("input",{bubbles:true}))},v);

// ===== 0. Old data intact after the update =====
const kept=await E(()=>({n:S.d.M.logs.length,vol:S.d.M.logs.map(l=>l.vol),ex:S.d.M.logs.map(l=>Object.keys(l.ex).join("+")),pin:S.d.M.sub.A0,note:S.d.M.notes.lpd,hd:S.d.M.hd.length,ms:S.d.M.ms.length,var:S.d.M.pf.var,gear:S.d.M.pf.gear}));
ok("0. Old backup: 3 workouts, volumes (recomputed from the sets), exercises (even cable crunch), pin, machine note, weight and measurements kept",kept.n===3&&JSON.stringify(kept.vol)==="[1120,1885,1200]"&&kept.ex[0]==="ms+cc"&&kept.pin==="ms"&&kept.note==="siège 4"&&kept.hd===1&&kept.ms===1,JSON.stringify(kept));
ok("0. New settings get safe defaults (Balanced, all equipment)",kept.var==="bal"&&JSON.stringify(kept.gear)==='["M","DB","C","SM"]',JSON.stringify(kept));
await nav(4);tx=await txt();ok("0. History lists the old workouts",(tx.match(/Supprimer/g)||[]).length>=3&&tx.includes("ancienne"));

// ===== 1. Variety + reference lift + last loads =====
await E(()=>{const pf=S.d.M.pf;pf.gear=["M","C"];pf.no=["bcc"];save();U.tab="today";go()});
const audit=await E(()=>{const bad=[];for(const w of ["A","B","C"])for(let n=0;n<40;n++){draw(w,true);const e=eff(w);for(const x of e.ex){const id=x[0],q=E[id][4];
  if(!(q==="BW"||["M","C"].includes(q)))bad.push(w+":gear:"+id);if(id==="bcc")bad.push(w+":excluded");if(AX.includes(id))bad.push(w+":spine:"+id);
  const [pt,,bid]=slotOf(w,x[7]);if(!allowed(pt,bid).includes(id))bad.push(w+":pool:"+id)}
  const req=FOCUS_GROUPS.M[w];if(!req.every(g=>e.ex.some(x=>g.includes(GR[x[0]]))))bad.push(w+":focus")}return bad});
ok("1. 120 draws with machines + cable only, cable curl excluded: right equipment, never excluded, never spinal load, always the planned muscles",!audit.length,audit.slice(0,6).join(","));
ok("1. Pinned reference lift (machine shoulder press) stays in A on every draw",await E(()=>{for(let n=0;n<20;n++){draw("A",true);if(eff("A").ex.every(x=>x[0]!=="ms"))return false}return true}));
await E(()=>{U.pick="A";go()});tx=await txt();
ok("1. Today shows the pin and its last load (40 kg)",/Développé épaules machine[^·]*· 40 kg/.test(tx)&&tx.includes("📌"),tx.match(/Développé épaules machine[^A-Z]{0,40}/)?.[0]);
const lpdBack=await E(()=>{const e=eff("B").ex.find(x=>x[0]==="lpd")||[ "lpd",3,8,12,120,2,2.5,0];return sug("lpd",e,"B").w});
ok("1. An exercise coming back in the rotation gets its last load (lat pulldown 55 kg → 55 kg or more)",lpdBack>=55,String(lpdBack));
await E(()=>{S.d.M.pf.gear=["M","DB","C","SM"];S.d.M.pf.no=[];save()});

// ===== 2. 20-minute Back & Arms with a cable only =====
await nav(5);await tap(p.locator(".sg button",{hasText:"20 min"}));
for(const g of ["M","DB","SM"])await p.locator(`[data-gear="${g}"]`).evaluate(el=>{el.checked=false;el.dispatchEvent(new Event("input",{bubbles:true}))});
ok("2. Profile: 20 min and cable only saved",await E(()=>S.d.M.pf.time===20&&JSON.stringify(S.d.M.pf.gear)==='["C"]'));
await nav(0);await tap(p.locator("#v .r button",{hasText:/^B$/}));tx=await txt();
const plan=await E(()=>{const e=eff("B");return{ids:e.ex.map(x=>x[0]),sets:e.ex.map(x=>x[1]),ss:e.ex.map(x=>x[8]||0),min:e.timing.total/60,g:e.g,wu:e.wu,unav:e.unavailable}});
ok("2. Preview fits in 20 min with warm-up, ramp-up, rests and station changes",!plan.unav&&plan.min<=20,JSON.stringify(plan));
const groups=await E(ids=>ids.map(id=>GR[id]+":"+E[id][4]),plan.ids);
ok("2. ≥2 back exercises/sets and ≥2 arm exercises, every one on the cable or bodyweight",groups.filter(g=>g.startsWith("bk")).length>=2&&groups.filter(g=>g.startsWith("ar")).length>=2&&groups.every(g=>/:(C|BW)$/.test(g)),groups.join(","));
ok("2. Arms done as a superset to make room for them",plan.ss.includes(1)&&plan.ss.includes(2)&&tx.includes("superset"),plan.ss.join(","));
ok("2. Warm-up without machines: marching in place, no machine drill",plan.g==="march"&&!plan.wu.some(x=>["dh"].includes(x)),plan.g+" "+plan.wu);
await tap(p.locator(".budget summary"));tx=await txt();ok("2. Time split visible before starting",["Échauffement","Séries de travail","Repos entre séries","Installation"].every(w=>tx.includes(w)));
// real run, following the app: warm-up items, ramp-up sets, every set, the app's own rest timer, 30 s to change station
await tap(p.locator("#v button",{hasText:"Commencer la séance"}));await tap(p.locator(".bkx").first());
const t0=await E(()=>Date.now());
const wd=await E(()=>cur().wd);await p.clock.runFor(wd.gm*60e3);await tap(p.locator(".wur").nth(0));
for(let j=0;j<wd.d.length;j++){await p.clock.runFor(60e3);await tap(p.locator(".wur").nth(j+1))}
// ramp-up sets on the first exercise (about 30 s each including the plate/pin change)
await type("#w0_0","40");const k=await p.locator("#ramp-0 .chip").count();for(let r=0;r<k;r++){await p.clock.runFor(30e3);await tap(p.locator("#ramp-0 .chip").nth(r))}
ok("2. Ramp-up sets shown for the first exercise ("+k+")",k>=1);
// alternate supersets the way the guided order says
await E(()=>{S.gm=true;go()});let guard=0;
while(guard++<40){const pos=await E(()=>curPos());if(!pos)break;const [i,j]=pos;const info=await E(([i,j])=>({id:sid(i),secs:setSeconds([sid(i),...cx()[i].slice(1)]),bw:isBW(sid(i)),r:cx()[i][2]}),[i,j]);
  if(!info.bw)await type(`#w${i}_${j}`,"20");await type(`#r${i}_${j}`,String(info.r));await p.clock.runFor(info.secs*1000);
  await tap(p.locator(".gd button.big"));const rest=await E(()=>cur().rest?cur().rest.totalMs:0);await p.clock.runFor(rest);
  const nx=await E(()=>curPos());if(nx&&nx[0]!==i&&await E(([a,b])=>ssOf(a)!==b,[i,nx[0]]))await p.clock.runFor(30e3)}
const elapsed=await E(()=>elapsedSeconds(cur()));
ok("2. Real run following the app's timers ends within 20 min (chrono "+Math.floor(elapsed/60)+":"+String(elapsed%60).padStart(2,"0")+")",elapsed<=20*60,String(elapsed));
ok("2. Session clock = real time spent since the start",Math.abs(elapsed-Math.floor(((await E(()=>Date.now()))-t0)/1000))<=1,elapsed+" vs "+Math.floor(((await E(()=>Date.now()))-t0)/1000));
await E(()=>{S.gm=false;go()});await tap(p.locator("#v button",{hasText:"Terminer la séance"}));await accept();
const lg=await E(()=>S.d.M.logs.at(-1));
ok("2. Saved: back and arm sets, warm-up/ramp-up not counted, budget 20 recorded",lg.wk==="B"&&lg.budget===20&&Object.keys(lg.ex).length===plan.ids.length&&lg.sets===plan.sets.reduce((a,b)=>a+b,0),JSON.stringify({ex:Object.keys(lg.ex),sets:lg.sets,budget:lg.budget}));
await E(()=>{U.sum=null;S.d.M.pf.time=60;S.d.M.pf.gear=["M","DB","C","SM"];save();go()});

// ===== 3. Reliability during a workout =====
await p.clock.fastForward(DAY);await E(()=>{U.pick="A";go()});await tap(p.locator("#v button",{hasText:"Commencer la séance"}));
if(await E(()=>!!U.chk))await tap(p.locator(".bkx").first());
await p.clock.runFor(90e3);ok("3. Timer runs (1:30)",await E(()=>elapsedSeconds(cur())===90));
await tap(p.locator(".session-clock button"));await p.clock.runFor(120e3);ok("3. Pause freezes it",await E(()=>elapsedSeconds(cur())===90));
await tap(p.locator(".session-clock button"));await p.clock.runFor(30e3);ok("3. Resume continues from 1:30",await E(()=>elapsedSeconds(cur())===120));
// log one set on exercise 2, then replace it for today
await type("#w1_0","22");await type("#r1_0","10");await tap(p.locator('[data-row="1-0"] button'));
const before=await E(()=>({id:sid(1),n:cur().ex[1].length,len:cx().length}));
await tap(p.locator("#v .c:not(.wuc)").nth(1).locator('button[aria-label^="Remplacer"]'));
await tap(p.locator("#v .swp .swr").first().locator("button",{hasText:"Aujourd'hui"}));
const after=await E(()=>({a:sid(1),b:sid(2),ka:cur().ex[1].map(s=>[s.ok,num(s.w),num(s.r)]),kb:cur().ex[2].length,len:cx().length}));
ok("3. Replace after a logged set: 22 kg × 10 stays on the old exercise, remaining sets on the new one",after.a===before.id&&after.ka.length===1&&after.ka[0].join()==="1,22,10"&&after.kb===before.n-1&&after.len===before.len+1,JSON.stringify({before,after}));
// shorten: 15 minutes left
await type("#w0_0","40");await type("#r0_0","9");await tap(p.locator('[data-row="0-0"] button'));await p.clock.runFor(60e3);
await tap(p.locator(".tlb"));await tap(p.locator(".tlp button",{hasText:"15 min"}));
const sh=await E(()=>({rem:remMin(),ok:Object.values(cur().ex).flat().filter(s=>s.ok).map(s=>num(s.w)+"x"+num(s.r)),groups:cx().map((e,i)=>GR[sid(i)])}));
ok("3. 'Il me reste 15 min': both logged sets intact, chest and shoulders still there, remaining ≤ 15 min",sh.rem<=15&&sh.ok.includes("22x10")&&sh.ok.includes("40x9")&&sh.groups.includes("ch")&&sh.groups.includes("sh"),JSON.stringify(sh));
// airplane mode: relaunch offline in the middle of the workout
const snap=await E(()=>JSON.stringify(cur().ex));const sec=await E(()=>elapsedSeconds(cur()));
await BR.offline(ctx,true);await p.reload();await p.waitForTimeout(200);
ok("3. Airplane mode: app relaunches with the workout, same sets, timer not reset",await E(([snap,sec])=>!!cur()&&JSON.stringify(cur().ex)===snap&&elapsedSeconds(cur())>=sec,[snap,sec])&&(await txt()).includes("Terminer la séance"));
await E(()=>{const i=cx().findIndex((e,k)=>cur().ex[k].some(s=>!s.ok));const j=cur().ex[i].findIndex(s=>!s.ok);setv(i,j,"w",isBW(sid(i))?"":"10");setv(i,j,"r","12");done(i,j)});
await tap(p.locator("#v button",{hasText:"Terminer la séance"}));await accept();
const off=await E(()=>({n:S.d.M.logs.length,last:S.d.M.logs.at(-1)}));
ok("3. Finished offline: saved in history with its 3 sets and real duration",off.n===5&&off.last.sets===3&&off.last.durSec>=150,JSON.stringify({n:off.n,sets:off.last.sets,dur:off.last.durSec}));
await BR.offline(ctx,false);await p.reload();await p.waitForTimeout(200);
ok("3. Back online: history unchanged after reload",await E(()=>S.d.M.logs.length===5&&!cur()));
// abandon a workout: nothing else touched
const vols=await E(()=>JSON.stringify(S.d.M.logs.map(l=>[l.date,l.vol])));
await E(()=>{U.pick="C";go();begin("C");if(U.chk)start("C",0);setv(0,0,"w","100");setv(0,0,"r","10");done(0,0)});
await tap(p.locator("#v button",{hasText:"Abandonner"}));ok("3. Abandon asks for confirmation",await E(()=>$("action-dialog").open));
await tap(p.locator("#action-cancel"));ok("3. Cancel keeps the workout",await E(()=>!!cur()&&cur().ex[0][0].ok===1));
await tap(p.locator("#v button",{hasText:"Abandonner"}));await accept();
ok("3. Abandon discards only that workout; history identical",await E(v=>!cur()&&JSON.stringify(S.d.M.logs.map(l=>[l.date,l.vol]))===v,vols));
await nav(4);tx=await txt();ok("3. History shows the 5 workouts incl. the 20-min one and the offline one",(tx.match(/Supprimer/g)||[]).length>=5);
ok("3. Old workouts still identical at the end",await E(()=>JSON.stringify(S.d.M.logs.slice(0,3).map(l=>[l.vol,Object.keys(l.ex)]))==='[[1120,["ms","cc"]],[1885,["lpd","csr","idc"]],[1200,["lp","pl"]]]'));
ok("No native dialogs or page errors",!errs.length&&await E(()=>(window.__nd||[]).length===0),errs.join(" | "));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();server.close();process.exit(fails?1:0)})().catch(e=>{console.log("CRASH",e.message);process.exit(2)});
