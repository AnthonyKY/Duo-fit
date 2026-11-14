const {chromium,devices}=require("playwright"),assert=require("node:assert/strict"),ios=require("./iosinit.js");
(async()=>{
  const b=await chromium.launch();
  try{
    const ctx=await b.newContext({...devices["iPhone SE"],locale:"fr-FR"});await ctx.addInitScript(ios);
    const p=await ctx.newPage();const err=[];p.on("pageerror",e=>err.push(e.message));
    await p.clock.install();await p.goto(process.env.URL||"http://localhost:8766/index.html");
    await p.locator('button:text-is("B")').click();await p.getByText("Commencer la séance",{exact:true}).click();await p.locator(".bkx").first().click();
    const start=p.locator("[data-start-ex='0']"),meter=p.locator("[data-ex-clock='0']");
    const target=await p.evaluate(()=>exerciseTarget(0));await start.click();await p.clock.fastForward(target*1000+2000);
    assert.equal(await meter.getAttribute("data-band"),"extraTime");await p.clock.fastForward(target*100+2000);
    assert.equal(await meter.getAttribute("data-band"),"overTime");await start.click();
    await p.getByRole("button",{name:"Ajouter un exercice"}).click();
    await p.locator("#extra-id").selectOption("sp");await p.getByRole("button",{name:"Ajouter à cette séance"}).click();
    const idx=await p.evaluate(()=>cx().length-1);await p.locator("[data-start-ex='"+idx+"']").click();
    await p.locator("#r"+idx+"_0").fill("25");await p.locator('[data-row="'+idx+'-0"] button').click();
    await p.locator("#r"+idx+"_1").fill("23");await p.locator('[data-row="'+idx+'-1"] button').click();
    assert.match(await p.locator(".ex-review").innerText(),/25 s.*23 s/s);
    await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await p.reload();await ctx.setOffline(true);await p.reload();
    await p.getByRole("button",{name:"Terminer la séance",exact:true}).click();await p.locator("#action-accept").click();
    const log=await p.evaluate(()=>D().logs.at(-1));assert.ok(log.durSec>=target*1.1);
    assert.equal(log.durSec,Math.floor(Object.values(log.exerciseTimes).reduce((s,x)=>s+x.ms,0)/1000));
    await p.locator("nav button").nth(4).click();assert.match(await p.locator("#v").innerText(),/Temps des exercices/);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(err,[]);
    console.log("PASS iPhone SE per-exercise starts, threshold colors, library addition, local assessment, offline history and width");
  }finally{await b.close()}
})().catch(e=>{console.error("CRASH",e);process.exitCode=1});
