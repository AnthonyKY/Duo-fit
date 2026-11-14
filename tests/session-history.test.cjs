const test=require("node:test");
const assert=require("node:assert/strict");
const {harness:loadApp}=require("./session-harness.cjs");
// These progression fixtures refer to the original exercises in a fixed order.
function harness(options){
  const h=loadApp(options);
  h.run("for(const p of ['M','F']){S.d[p].pf.var='fix';S.d[p].pf.noOverhead=false}");
  return h;
}
function accept(h){h.el("action-accept").onclick()}
function setup(h){h.run("start('A');setv(0,0,'w','22,5');setv(0,0,'r','10')")}

test("all profile, language and navigation combinations render and carry correct totals",()=>{
  const h=harness();
  for(const p of ["M","F"])for(const lang of ["fr","en"])for(const tab of ["today","plan","lib","prg","hist","set"]){
    h.run(`switchProfile('${p}');S.lg='${lang}';navigate('${tab}')`);
    assert.match(h.el("v").innerHTML,/<h1>/);assert.doesNotMatch(h.el("v").innerHTML,/undefined|NaN|\(k,p\)=>/);
  }
});
test("exact decimal load, pre-filled weight, unchecked entries, double save and retained precision",()=>{
  const h=harness();setup(h);h.run("done(0,0);setv(0,1,'r','8')");
  h.tick(13700);h.run("fin()");assert.match(h.el("action-detail").textContent,/405 kg/);
  accept(h);accept(h);assert.equal(h.state().d.M.logs.length,1);
  const log=h.state().d.M.logs[0];assert.deepEqual([log.durSec,log.vol,log.sets],[13,405,2]);
  assert.equal(h.run("cur()"),null);assert.equal(h.el("tm").hidden,true);
  const back=harness({shared:h.shared});back.run("navigate('hist')");assert.match(back.el("v").innerHTML,/00:13/);
});
test("pause, manual rest, restart, expiration, and independence of each profile",()=>{
  const h=harness();h.run("start('A');manualRest(0)");h.tick(4700);h.run("toggleSessionClock()");h.tick(600000);
  assert.equal(h.run("elapsedSeconds(cur())"),4);assert.equal(h.run("restRemaining(cur().rest)"),115300);
  const b=harness({shared:h.shared,now:Date.UTC(2026,10,13,12)+604700});
  assert.equal(b.run("elapsedSeconds(cur())"),4);b.run("toggleSessionClock()");b.tick(2000);assert.equal(b.run("elapsedSeconds(cur())"),6);
  b.run("restControl('toggle');switchProfile('F');start('A');manualRest(0)");b.tick(5000);b.run("switchProfile('M')");
  assert.equal(b.run("cur().rest.end"),null);assert.equal(b.run("cur().rest.remainingMs"),113300);
  b.run("restControl('reset');restControl('toggle')");b.tick(125000);assert.equal(b.run("cur().rest.remainingMs"),0);
  b.run("abandon()");accept(b);assert.equal(b.state().d.M.cur,null);assert.ok(b.state().d.F.cur);assert.equal(b.el("tm").hidden,true);
});
test("dismiss/accept discard, all-empty session, invalid draft and cardio-only",()=>{
  const h=harness();setup(h);h.run("abandon();closeAction()");assert.ok(h.state().d.M.cur);
  h.run("abandon()");accept(h);assert.equal(h.state().d.M.logs.length,0);
  h.run("start('A');fin()");assert.match(h.el("action-detail").textContent,/uniquement/);accept(h);
  assert.equal(h.state().d.M.logs[0].sets,0);
  h.run("switchProfile('F');start('C');cur().cmv='-2';cur().cmTouched=true;fin()");assert.equal(h.el("action-dialog").open,false);
  h.run("cur().cmv='12';fin()");accept(h);assert.equal(h.state().d.F.logs[0].cardio,12);
  h.run("switchProfile('M');start('C');setv(0,0,'r','2.5');fin()");assert.equal(h.el("action-dialog").open,false);assert.ok(h.state().d.M.cur);
});
test("unchecked set remains excluded, suggested placeholders do not create extra rows",()=>{
  const h=harness();setup(h);h.run("done(0,0);done(0,0);fin()");
  assert.match(h.el("action-detail").textContent,/uniquement/);accept(h);
  assert.equal(h.state().d.M.logs[0].sets,0);
});
test("old logs and an old in-progress workout load without losing weights, notes or duration",()=>{
  const previous={logs:[{date:Date.UTC(2026,9,22,12),wk:"A",dur:52,ex:{ms:[{w:30,r:9}]},note:"Ancienne séance"}],sched:{1:"A"},bw:[78,79],sub:{},
    cur:{wk:"A",start:Date.UTC(2026,10,13,11,55),note:"Brouillon",ex:{}}};
  const h0=harness();const plan=JSON.parse(h0.run("JSON.stringify(P.M.A.ex)"));
  plan.forEach((e,i)=>previous.cur.ex[i]=Array.from({length:e[1]},()=>({w:"",r:"",ok:0})));
  previous.cur.ex[0][0]={w:31,r:8,ok:1};
  const h=harness({raw:{p:"M",lg:"fr",d:{M:previous,F:{logs:[],hd:[],sub:{},sched:{}}}}});
  h.run("navigate('hist')");assert.match(h.el("v").innerHTML,/52 min/);assert.match(h.el("v").innerHTML,/Ancienne séance/);
  h.run("navigate('today');fin()");accept(h);const p=h.state().d.M;assert.equal(p.logs.length,2);assert.deepEqual(p.logs.map(l=>l.vol),[270,248]);
  assert.equal(p.logs[1].durSec,300);assert.equal(p.hd.length,2);
});
test("deletion and imports are reversible until confirmed; invalid input cannot overwrite good data",()=>{
  const h=harness();setup(h);h.run("fin()");accept(h);const before=h.shared.get("duofit");
  h.run("deleteLog(0);closeAction()");assert.equal(h.shared.get("duofit"),before);
  h.el("jx").value='{"d":{"F":{},"M":{"logs":"wrong"}}}';h.run("restoreBackup()");assert.equal(h.shared.get("duofit"),before);
  h.run("deleteLog(0)");accept(h);assert.equal(h.state().d.M.logs.length,0);
  h.el("jx").value=before;h.run("restoreBackup()");accept(h);assert.equal(h.state().d.M.logs[0].vol,225);
});
test("out-of-space preserves draft and prevents phantom history",()=>{
  const h=harness();setup(h);h.fail(true);h.run("fin()");accept(h);
  assert.ok(h.run("cur()"));assert.equal(h.run("D().logs.length"),0);assert.equal(h.el("storage-warning").hidden,false);
  h.fail(false);h.run("fin()");accept(h);assert.equal(h.state().d.M.logs.length,1);
});
test("a stale tab cannot undo a finish, resurrect a discarded draft, or duplicate a log",()=>{
  const a=harness();setup(a);const b=harness({shared:a.shared});
  a.run("fin()");accept(a);b.run("fin()");accept(b);
  assert.equal(b.state().d.M.logs.length,1);assert.equal(b.run("cur()"),null);
  a.run("start('C')");const c=harness({shared:a.shared});a.run("abandon()");accept(a);
  c.run("setv(0,0,'w','50')");assert.equal(c.run("cur()"),null);assert.equal(a.state().d.M.logs.length,1);
});
test("daily tracking validates dates, decimal CSV and duplicates, keeping existing values",()=>{
  const h=harness();h.el("hc").value="date;poids;pas;fc;sommeil\n2026-11-10;80,2;3000;52;7,5";h.run("impH()");
  assert.deepEqual(h.state().d.M.hd,[{d:"2026-11-10",w:80.2,st:3000,hr:52,sl:7.5}]);
  h.el("hc").value="2026-11-10,,4500,,";h.run("impH()");assert.equal(h.state().d.M.hd[0].st,4500);
  for(const line of ["2026-02-30,9,9,9,9","2026-11-11,bad,,,","2026-11-14,80,,,"]){
    h.el("hc").value=line;h.run("impH()");assert.equal(h.state().d.M.hd.length,1);
  }
});
test("bodyweight, checked cardio, swapped exercises and time formatting",()=>{
  const h=harness();h.run("S.d.F.pf.var='fix';switchProfile('F');start('C');setv(4,0,'r','32');done(4,0);cdo();fin()");accept(h);
  const log=h.state().d.F.logs[0];assert.deepEqual(log.ex.pl,[{w:0,r:32}]);assert.ok(log.cardio>0);
  h.run("navigate('today');start('C');swap(0);setv(0,0,'r','8');done(0,0);fin()");accept(h);
  assert.ok(h.state().d.F.logs[1].ex.gb);assert.equal(h.run("timeText(3605)"),"1:00:05");
});
test("a partial entry is never silently discarded and a pre-entered next weight survives checking a set",()=>{
  const h=harness();setup(h);h.run("setv(0,1,'w','27,5');done(0,0);fin()");
  assert.equal(h.el("action-dialog").open,false);assert.match(h.el("notice").textContent,/sans répétitions/);
  h.run("setv(0,1,'r','8');fin()");accept(h);
  const log=h.state().d.M.logs[0];assert.deepEqual(log.ex.ms,[{w:22.5,r:10},{w:27.5,r:8}]);
});
test("history edits validate before mutation, recalculate totals, retain notes and cancel last-set removal",()=>{
  const h=harness();setup(h);h.run("fin()");accept(h);h.run("navigate('hist');U.ed=0;go()");
  const fields={r:"-2",w:"30"};
  h.run("document.querySelector=selector=>document.getElementById(selector.endsWith('[data-k=\"w\"]')?'test-w':'test-r')");
  h.el("test-w").value=fields.w;h.el("test-r").value=fields.r;h.el("edd").value="2026-11-12";h.el("edn").value="Test & <A>";
  const before=h.shared.get("duofit");
  h.run("sved()");assert.equal(h.shared.get("duofit"),before);
  h.el("test-r").value="9";h.run("sved()");assert.equal(h.state().d.M.logs[0].vol,270);assert.match(h.el("v").innerHTML,/Test &amp; &lt;A&gt;/);
  h.run("U.ed=0;go()");h.el("test-r").value="";h.run("sved();closeAction()");assert.equal(h.state().d.M.logs.length,1);
});
test("suspended or locked for longer than the rest interval, session timer catches up on return",()=>{
  const h=harness();h.run("start('B');manualRest(0)");h.tick(3300000);
  assert.equal(h.el("session-clock").textContent,"55:00");assert.equal(h.run("cur().rest.remainingMs"),0);
  const b=harness({shared:h.shared,now:Date.UTC(2026,10,13,12,56)});assert.equal(b.el("session-clock").textContent,"56:00");
});
