const test=require("node:test");
const assert=require("node:assert/strict");
const {harness}=require("./session-harness.cjs");
const plain=(h,expr)=>JSON.parse(h.run("JSON.stringify("+expr+")"));
const accept=h=>h.el("action-accept").onclick();

test("both profiles, three days, three modes, three levels and six time budgets including 20 minutes",()=>{
  const h=harness();
  const results=plain(h,`(()=>{
    const failures=[];let count=0;
    for(const p of ["F","M"])for(const mode of ["fix","bal","max"])for(const lvl of ["beg","int","adv"]){
      S.p=p;Object.assign(D().pf,{lvl,var:mode});
      for(const w of ["A","B","C"])for(const time of [20,30,45,60,75,90]){
        D().pf.time=time;const plan=eff(w),t=plan.timing,ids=plan.ex.map(e=>e[0]);count++;
        const complete=t.warm+t.work+t.rest+t.move+t.cardio===t.total&&t.warm===plan.wm*60&&t.total<=time*60&&plan.dur===Math.ceil(t.total/60);
        const allowedIds=plan.ex.every(e=>{const [pt,,base]=slotOf(w,e[7]);return allowed(pt,base).includes(e[0])&&Number.isInteger(e[1])&&e[1]>=1});
        const secondary={M:{A:"ch",B:"ar",C:"sh"},F:{A:"gl",B:"co",C:"lg"}}[p][w];
        if(plan.unavailable||!complete||!allowedIds||!ids.some(id=>GR[id]===secondary)||new Set(ids).size!==ids.length)failures.push([p,mode,lvl,w,time,ids,t]);
      }
    }
    return {count,failures};
  })()`);
  assert.equal(results.count,324);assert.deepEqual(results.failures,[]);
});

test("equipment, exclusions and pins cannot force a missing machine into a workout",()=>{
  const h=harness();
  const errors=plain(h,`(()=>{
    const bad=[];
    for(const p of ["M","F"])for(const mode of ["bal","max","fix"])for(const gear of [[],["C"],["M"],["DB"],["SM"],["M","C","DB","SM"]]){
      S.p=p;Object.assign(D().pf,{gear,var:mode,no:["lpd","lpn","cp"]});D().sub.B0="lpd";
      for(const w of ["A","B","C"]){const e=eff(w);
        if(e.ex.some(x=>D().pf.no.includes(x[0])||!isBW(x[0])&&!gear.includes(E[x[0]][4])))bad.push([p,w,mode,gear]);
        if(!gear.length&&(e.g!=="march"||e.wu.some(x=>["fpw","cer","scp","dh","bpa","mwk"].includes(x))))bad.push(["warm",p,w]);
      }
    }
    return bad;
  })()`);
  assert.deepEqual(errors,[]);
  h.run("S.p='M';Object.assign(D().pf,{gear:[],no:[]});U.pick='B';go();begin('B');start('B')");
  assert.equal(h.run("cur()"),null);assert.doesNotMatch(h.el("v").innerHTML,/Commencer la séance/);
  assert.match(h.el("v").innerHTML,/Modifier mon profil/);
  h.run("S.p='F';D().pf.gear=[];U.pick='C';go();start('C')");
  assert.ok(h.run("cur()"));assert.ok(h.run("cx().every((e,i)=>isBW(sid(i)))"));
});

test("the scheduled preview survives offline-style reload, language changes and independent profiles",()=>{
  const h=harness(),plan=plain(h,"eff('B').ex");
  h.run("S.lg='en';navigate('set');switchProfile('F');spf('time',20);switchProfile('M');navigate('today');save()");
  const tab=harness({shared:h.shared});assert.deepEqual(plain(tab,"eff('B').ex"),plan);
  assert.equal(tab.run("S.d.F.pf.time"),20);
  tab.run("start('B',0);spf('time',20);toggleSessionClock();D().pf.no.push('lpd');D().sub.B0='rpd';save()");
  assert.deepEqual(plain(tab,"cx().map((e,i)=>sid(i))"),plan.map(e=>e[0]));
  const reopened=harness({shared:tab.shared});assert.deepEqual(plain(reopened,"cx()"),plan);
  assert.equal(reopened.run("cur().budget"),60);
});

test("new draws use alternatives, respect a valid pin, and never borrow another exercise's working load",()=>{
  const h=harness();const before=plain(h,"eff('B').ex").map(e=>e[0]);
  h.run("reroll('B')");const after=plain(h,"eff('B').ex").map(e=>e[0]);
  assert.notDeepEqual(after,before);assert.notEqual(after[0],before[0]);
  h.run("D().sub.B0='lpd';D().logs.push({date:Date.now(),wk:'B',ex:{lpd:[{w:80,r:9}]},sets:1,vol:720});save();reroll('B')");
  assert.equal(h.run("eff('B').ex[0][0]"),"lpd");assert.equal(h.run("sug('lpd',eff('B').ex[0],'B').w"),80);
  assert.equal(h.run("sug('lpn',eff('B').ex[0],'B').w"),"");
  h.run("delete D().sub.B0;reroll('B')");assert.notEqual(h.run("eff('B').ex[0][0]"),"lpd");
});

test("warm-up time is reserved, ramp loads use gym steps, and only working sets enter history",()=>{
  const h=harness();h.run("D().pf.time=30;D().sub.B0='lpd';start('B',0);setv(0,0,'w','40')");
  assert.ok(h.run("cur().wd.m===cur().wd.gm+cur().wd.d.length+cur().wd.ramp"));
  const ramp=plain(h,"wuSets(sid(0),40)");assert.deepEqual(ramp.map(x=>x[1]),[8,4,2]);
  assert.ok(h.run("wuSets(sid(0),40).every(([w])=>w%incOf(sid(0))===0)"));
  h.run("wuT(0);wdT(0);setv(0,0,'w','50')");assert.equal(h.run("cur().wu[0]"),false);
  assert.match(h.el("ramp-0").innerHTML,/25 kg × 8/);
  h.run("setv(0,0,'r','8');done(0,0);fin()");accept(h);
  const [log]=h.state().d.M.logs;assert.deepEqual([log.sets,log.vol,log.budget],[1,400,30]);
  assert.deepEqual(Object.keys(log.ex),["lpd"]);
});

test("a short session keeps logged and typed rows when the equipment or time left changes",()=>{
  const h=harness();h.run("start('B',0);setv(0,0,'w','22,5');setv(0,0,'r','8');done(0,0);setv(1,0,'w','17,5');setv(1,0,'r','10');busy(0);timeLeft(15)");
  assert.ok(h.run("cx().some((e,i)=>cur().ex[i].some(s=>s.ok&&num(s.w)===22.5))"));
  assert.ok(h.run("cx().some((e,i)=>cur().ex[i].some(s=>s.touchedW&&num(s.w)===17.5))"));
  assert.ok(h.run("remMin()<=15"));h.run("fin()");accept(h);assert.equal(h.state().d.M.logs[0].vol,355);
});

test("shortening partway preserves the day's focus and empty sets can be trimmed before removing a movement",()=>{
  const h=harness();
  for(const [p,w,group] of [["M","B","ar"],["M","C","sh"],["F","B","co"]]){
    h.run(`S.p='${p}';start('${w}',0);finishPrep();timeLeft(15)`);
    assert.ok(h.run(`cx().some((e,i)=>GR[sid(i)]==='${group}')`));
    assert.ok(h.run("remMin()<=15"));
    h.run("abandon()");accept(h);
  }
});

test("migration preserves saved choices, validated data, and the identity of a pre-update session",()=>{
  const h=harness();h.run("D().sub.B0='lpn';start('B',0);setv(0,0,'w','35');setv(0,0,'r','10');done(0,0);save()");
  const backup=h.state();delete backup.d.M.cur.snapshot;delete backup.d.M.pf.gear;delete backup.d.M.pf.noOverhead;
  backup.d.M.pf.var='bal';backup.d.F.pf.gear=['ghost','C','C'];
  const restored=harness({raw:backup});assert.equal(restored.run("sid(0)"),"lpn");
  assert.equal(restored.run("D().pf.var"),"bal");assert.equal(restored.run("D().pf.noOverhead"),true);
  assert.deepEqual(plain(restored,"S.d.F.pf.gear"),["C"]);
  restored.run("fin()");accept(restored);assert.equal(restored.state().d.M.logs[0].vol,350);
});
