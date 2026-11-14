// Synthetic measurements; exercise the same strict input-only flows on both screen sizes.
const assert=require('node:assert/strict');
const {chromium,devices}=require('playwright');
const ios=require('./iosinit.js');
(async()=>{
  const browser=await chromium.launch();let count=0;
  try{
    for(const name of ['iPhone SE','iPhone 16 Plus']){
      // Playwright 1.56 does not ship a named 16 Plus preset. Its portrait screen
      // is 1290 × 2796 pixels at 3×, or 430 × 932 CSS pixels.
      const device=devices[name]||{...devices['iPhone 15 Plus'],viewport:{width:430,height:932},screen:{width:430,height:932},isMobile:true,hasTouch:true,deviceScaleFactor:3};
      const ctx=await browser.newContext({...device,locale:'fr-FR'});await ctx.addInitScript(ios);
      const p=await ctx.newPage();await p.goto(process.env.URL||'http://localhost:8766/index.html');
      const check=(label,ok)=>{assert.ok(ok,label);count++;console.log('PASS '+name+' '+label)};
      await p.evaluate(()=>{Object.assign(D().pf,{h:180,sex:'m'});U.tab='set';go();bOpen();bWhen('after')});
      const input=k=>p.locator('#b_'+k),hint=k=>input(k).getAttribute('placeholder');
      await input('weight').fill('72,4');await input('fatPct').fill('15,5');
      check('live hint and input focus/caret',await hint('fatKg')==='≈ 11,2'&&await input('fatPct').evaluate(el=>el===document.activeElement&&el.selectionStart===4));
      await input('muscleKg').fill('58,0');
      check('muscle percent and metabolism hints', (await hint('musclePct')).startsWith('≈ 80,1')&&(await hint('bmr')).replace(/\s/g,'')==='≈1850');
      await p.locator('#bdf button.p').last().click();
      const detail=()=>p.locator('#bdc .bdr').first().textContent();
      const row=await detail();check('lean, bone, BMI, FFMI and normalized FFMI', ['61,2','3,2','22,3','18,9','1,80 m'].every(s=>row.includes(s)));
      const raw=await p.evaluate(()=>{const backup=localStorage.getItem('duofit');return readState(backup).d.M.body[0]});
      check('stored and restored row has only entered data',Object.keys(raw).sort().join()===['id','when','d','weight','fatPct','muscleKg'].sort().join());
      await p.evaluate(()=>bOpen(D().body[0].id));await input('weight').fill('73,0');check('edit recalculates fat',await hint('fatKg')==='≈ 11,3');
      await p.evaluate(()=>{bCancel();bOpen()});await input('muscleKg').fill('58');await input('musclePct').fill('80,1');
      check('weight from muscle', (await hint('weight')).startsWith('≈ 72,4'));
      await input('muscleKg').fill('');await input('musclePct').fill('');await input('fatKg').fill('11,2');await input('fatPct').fill('15,5');
      check('weight from fat with rounding interval',await hint('weight')==='≈ 72,3 ± 0,6');
      await input('fatKg').fill('');await p.evaluate(()=>D().hd.push({d:U.bd.d,w:72.4}));await input('fatPct').fill('15,5');await input('fatPct').dispatchEvent('input');
      check('same-day weigh-in identified',await hint('fatKg')==='≈ 11,2'&&(await p.locator('#bLegend').textContent()).includes('poids de ta pesée du jour'));
      await p.evaluate(()=>{D().hd=[];bCancel();bOpen();U.bd.seg=true;go()});
      for(const [k,v] of Object.entries({trunkMuscle:31,leftArmMuscle:3.6,rightArmMuscle:3.7,leftLegMuscle:9.8,rightLegMuscle:9.9}))await input(k).fill(String(v));
      check('five segments and bilateral differences',await hint('muscleKg')==='≈ 58'&&await p.evaluate(()=>{const c=bCalc(U.bd.v);return bComputedText('arms',c.arms,'%').startsWith('≈ 2,7')&&bComputedText('legs',c.legs,'%').startsWith('≈ 1')}));
      check('weight alone produces BMI only',await p.evaluate(()=>Object.keys(bCalc({weight:72.4})).sort().join()==='bmi,weight'));
      check('negative bone withheld and invalid percent ignored',await p.evaluate(()=>bCalc({weight:72.4,fatKg:20,muscleKg:58}).badBone&&!bCalc({weight:72.4,fatKg:20,muscleKg:58}).bone&&!bCalc({weight:72.4,fatPct:200}).lean));
      check('matching-condition comparison marks inferred delta',await p.evaluate(()=>{const a={d:'2026-01-01',when:'after',weight:72,fatPct:15},b={...a,d:'2026-01-02',weight:73};return bCmp(b,[a,b]).includes('≈')}));
      await p.evaluate(()=>{bCancel();switchProfile('F');Object.assign(D().pf,{h:165,sex:'f'});S.lg='en';U.tab='set';go();bOpen()});
      const english=await p.evaluate(()=>{const c=bCalc({weight:72.4,fatPct:15.5});return [bDerived(c),c.adjusted]});
      check('English and separate female height and sex',english[0].includes('26.6')&&english[0].includes('22.5')&&english[0].includes('Calculations')&&!english[1]);
      check('legacy backup',await p.evaluate(()=>{const data=JSON.parse(JSON.stringify(S));delete data.d.M.body;return readState(JSON.stringify(data)).d.M.body.length===0}));
      check('no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.evaluate(()=>{const backup=localStorage.getItem('duofit');applyStorage(backup);S.p='M';U.bd=null;go()});
      check('reading restored without derived fields',await p.evaluate(()=>D().body[0].fatPct===15.5&&D().body[0].fatKg==null&&Math.abs(bCalc(D().body[0]).fatKg.value-11.222)<.001));
      await p.evaluate(()=>{U.tab='today';start('A',0);go()});
      await p.locator('#v .xt.x0').first().click();
      check('exercise stopwatch starts',await p.evaluate(()=>cur().xr===xkey(0)));
      await ctx.close();
    }
    console.log(count+'/'+count+' passed');
  }finally{await browser.close()}
})().catch(e=>{console.error('CRASH',e);process.exitCode=1});
