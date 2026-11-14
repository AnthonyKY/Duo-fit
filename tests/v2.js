// Integration checks at the application's normal GitHub Pages subpath.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const {chromium,devices}=require("playwright");
const ios=require("./iosinit.js");
const root=path.join(__dirname,".."),base="/Duo-fit/";
let server,browser,version="2026-11-14a",checks=0;
function check(title,condition){assert.ok(condition,title);console.log("PASS "+title);checks++}
async function main(){
  server=http.createServer((req,res)=>{
    const route=new URL(req.url,"http://localhost").pathname;
    const name=route===base?"index.html":route.slice(base.length);
    if(!route.startsWith(base)||!["index.html","sw.js","manifest.webmanifest","icon-192.png","icon-512.png"].includes(name)){res.writeHead(404);return res.end()}
    res.setHeader("Content-Type",name.endsWith("html")?"text/html":name.endsWith("js")?"application/javascript":name.endsWith("png")?"image/png":"application/manifest+json");
    let body=fs.readFileSync(path.join(root,name));
    if(name==="index.html"||name==="sw.js")body=body.toString().replaceAll("2026-11-14a",version);
    res.end(body);
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url="http://127.0.0.1:"+server.address().port+base;
  browser=await chromium.launch();const ctx=await browser.newContext({...devices["iPhone SE"],locale:"fr-FR"});
  await ctx.addInitScript(ios);let page=await ctx.newPage();const errors=[];
  const watch=()=>page.on("pageerror",e=>errors.push(String(e)));watch();
  const act=(f,arg)=>page.evaluate(f,arg),tap=selector=>page.locator(selector).first().click(),type=(selector,v)=>page.locator(selector).fill(v);
  const by=(name)=>page.getByRole("button",{name,exact:true}).first().click();
  await page.goto(url);await act(()=>navigator.serviceWorker.ready.then(()=>true));
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  check("A · scoped manifest and installed icons",await act(async()=>{const m=await (await fetch(document.querySelector('link[rel=manifest]').href)).json();return m.scope==="./"&&m.icons.length===2&&(await Promise.all(m.icons.map(x=>fetch(x.src)))).every(r=>r.ok)}));
  await ctx.setOffline(true);await page.close();page=await ctx.newPage();watch();await page.goto(url+"?offline=1");
  check("A · cold offline start",await page.getByText("Commencer la séance",{exact:true}).isVisible());
  await ctx.setOffline(false);
  // A real completed workout supplies the working load for subsequent sessions.
  await by("A");await by("Commencer la séance");await type("#w0_0","50");await type("#r0_0","10");await tap('[data-row="0-0"] button');
  await by("Terminer la séance");await tap("#action-accept");await by("Fermer");
  await by("A");await by("Gêne");await by("Commencer la séance");
  check("B · discomfort reduces weight and raises RIR",await act(()=>cur().ex[0][0].w===45&&cx()[0][5]===3&&cur().back==="discomfort"));
  check("C · three staged warm-up sets on the real grid",await act(()=>JSON.stringify(warmupSteps().map(s=>[s.w,s.reps]))==="[[22.5,8],[32.5,4],[37.5,2]]"));
  await tap('#warmup button');await by("Séance guidée");await type("#g-r","10");await tap("#guide-done");
  check("F · guided validation advances and starts rest",await act(()=>currentSet().j===1&&cur().rest.end>Date.now()&&cur().ex[0][0].ok));
  await tap('.guide-step button[aria-label="+ Charge (kg)"]');await tap('.guide-step button[aria-label="+ Répétitions"]');
  check("F · weight and rep steppers",await act(()=>num(cur().ex[0][1].w)===47.5&&num(cur().ex[0][1].r)===9));
  await tap(".guide-current .machine-note summary");await type(".guide-current .machine-note input","Siège 4");
  await page.reload();check("D · machine note survives reload",await page.getByText(/Réglage machine · Siège 4/).isVisible());
  await by("Plan complet");await by("Terminer la séance");await tap("#action-accept");
  check("C/H · working sets only, back check saved, next target displayed",await act(()=>D().logs.at(-1).sets===2&&D().logs.at(-1).vol===Math.round(45*10+47.5*9)&&D().logs.at(-1).back==="discomfort"&&document.querySelector(".exercise-result").textContent.includes("Objectif suivant")));
  await by("Fermer");await by("Douleur");await tap(".back-check input");
  check("B · radiating pain stops start",!(await page.getByText("Commencer la séance",{exact:true}).isEnabled()));
  await tap(".back-check input");await by("A");await by("Commencer la séance");
  check("B · pain reduction and supported exercise variants",await act(()=>cur().ex[0][0].w===37.5&&cur().ids[1]==="lip"&&cur().back==="pain"));
  await by("Abandonner");await tap("#action-accept");await by("Profil");await tap("details:has(#step-M) summary");await type("#step-M","5");
  check("E · real increment saved with input only",await act(()=>D().increments.M===5));
  check("E · a jump above 10% yields one extra rep",await act(()=>{const v=progressSuggestion("ms",P.M.A.ex[0],[{w:20,r:12},{w:20,r:12},{w:20,r:12}]);return v.w===20&&v.target.join(",")==="13,12,12"}));
  await by("Elle");check("D/E · profiles independent",await act(()=>!D().machineNotes.ms&&D().increments.M===2.5));await by("Lui");await by("Séance");await by("A");await by("Commencer la séance");await by("Plan complet");
  await type("#w0_0","50");await type("#r0_0","8");await tap('[data-row="0-0"] button');
  await tap(".exercise-actions summary");await by("Développé haltères assis (dossier)");
  check("G · today's swap keeps logged set and permanent preferences",await act(()=>cur().ids.at(-1)==="dsp"&&cur().ex[0][0].ok===1&&!D().sub.A0));
  await tap(".exercise-actions summary");await by("Machine occupée · passer à la fin");check("G · occupied slot moved to end",await act(()=>cur().order.at(-1)===0));
  await tap(".remaining summary");await type("#minutes-left","5");await by("Recalculer la fin");
  check("G · time cap preserves recorded work and trims future sets",await act(()=>cur().ex[0][0].ok&&Object.values(cur().ex).flat().some(s=>s.omit)));
  await by("Séance guidée");check("iPhone SE · guided layout fits",await act(()=>document.documentElement.scrollWidth<=innerWidth));
  await by("EN");check("FR/EN · English guided mode",await page.getByRole("button",{name:"Full plan",exact:true}).isVisible());
  version="2026-11-14b";await act(()=>upd());await page.waitForSelector("#upb",{state:"visible"});await tap("#upb");
  await page.waitForFunction(()=>VER==="2026-11-14b"&&!!cur());
  check("A · network update discovers next VER and retains draft",await act(()=>cur().ex[0][0].ok===1));
  await ctx.setOffline(true);await page.reload();check("A · newest shell and current draft available offline",await act(()=>VER==="2026-11-14b"&&!!cur()));
  check("No native dialogs or page errors",!errors.length&&await act(()=>window.__nd.length===0));
  console.log(checks+" V2 browser checks passed");
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.close()});
