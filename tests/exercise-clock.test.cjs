const test=require("node:test"),assert=require("node:assert/strict");
const {harness}=require("./session-harness.cjs");
const finish=h=>{h.run("fin()");h.el("action-accept").onclick();return h.state().d.M.logs.at(-1)};
test("manual start, yellow through exactly 110%, red afterwards, switch and sum without idle time",()=>{
  const h=harness();h.run("start('B',0)");h.tick(78000);h.run("runExercise(0)");
  const target=h.run("exerciseTarget(0)");h.tick(target*1000);
  assert.equal(h.run("clockDisplay(0,Date.now()).band"),"withinTime");
  h.tick(1);assert.equal(h.run("clockDisplay(0,Date.now()).band"),"extraTime");h.tick(target*100-1);
  assert.equal(h.run("clockDisplay(0,Date.now()).band"),"extraTime");h.tick(1000);
  assert.equal(h.run("clockDisplay(0,Date.now()).band"),"overTime");
  h.run("runExercise(1)");h.tick(3210);h.run("endExercise(1,true)");h.tick(60000);
  const log=finish(h),ms=Object.values(log.exerciseTimes).reduce((n,r)=>n+r.ms,0);
  assert.equal(ms,target*1100+4210);assert.equal(log.durSec,Math.floor(ms/1000));assert.equal(log.wallSec-log.durSec,138);
});
test("global pause, reload and split preserve elapsed time against the original exercise",()=>{
  const h=harness();h.run("start('B',0);runExercise(0)");const id=h.run("sid(0)");
  h.tick(3100);h.run("toggleSessionClock()");h.tick(30000);
  const b=harness({shared:h.shared,now:Date.UTC(2026,10,13,12)+33100});b.run("toggleSessionClock()");b.tick(4000);
  b.run("setv(0,0,'w',40);setv(0,0,'r',8);done(0,0);swapTo(0,swapOptions(0)[0],false)");
  assert.equal(b.run("cur().clocks.active"),null);
  const kept=b.run("clockKey(0)");assert.equal(b.run("clockMs(cur(),clockKey(0))"),7100);
  b.run("busy(0)");b.tick(60000);const log=finish(b);assert.equal(log.exerciseTimes[kept].id,id);assert.equal(log.durSec,7);assert.equal(log.vol,320);
});
test("adding an available exercise keeps program and history separate, supports timed exercises and offline coach",()=>{
  const h=harness();h.run("start('B',0)");const n=h.run("cx().length"),before=h.run("JSON.stringify(D().sub)");
  h.run("addToSession('sp');addToSession('sp');addToSession('ssq')");
  assert.equal(h.run("cx().length"),n+1);assert.equal(h.run("JSON.stringify(D().sub)"),before);
  const i=n;h.run(`runExercise(${i});setv(${i},0,'r','25');done(${i},0)`);
  h.tick(7000);h.run(`setv(${i},1,'r','24');done(${i},1)`);
  assert.match(h.run("exerciseReview()"),/25 s.*24 s/);assert.equal(h.run("cur().clocks.active"),null);
  const log=finish(h);assert.equal(log.durSec,7);assert.equal(log.ex.sp.length,2);
  h.run("start('B',0)");assert.equal(h.run("cx().some((e,i)=>sid(i)==='sp')"),false);
});
test("partial and mixed-load sets produce no automatic increase on subsequent suggestions",()=>{
  const h=harness();h.run("start('B',0);setv(0,0,'w',40);setv(0,0,'r',20);done(0,0);runExercise(0);endExercise(0,true)");
  const id=h.run("sid(0)");assert.match(h.run("coachText(0)"),/Complète/);finish(h);
  assert.equal(h.run(`sug('${id}',['${id}',1,8,12,75,2,5],'B').w`),40);
});
