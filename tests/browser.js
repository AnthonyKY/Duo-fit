// Engine and phone for the browser suites. Default: Chromium with the iPhone each suite names (iPhone SE = narrowest screen).
// GitHub also runs every suite with BROWSER=webkit (the engine of Safari, used by every browser on iPhone) and DEVICE="iPhone 16 Plus".
const pw=require('playwright');
// phones newer than the Playwright version pinned on GitHub (same values as Playwright's own list)
const EXTRA={'iPhone 16 Plus':{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1',
  viewport:{width:430,height:739},screen:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true,defaultBrowserType:'webkit'}};
const all={...EXTRA,...pw.devices};
const engine=process.env.BROWSER||'chromium',device=process.env.DEVICE||'';
if(!pw[engine]||typeof pw[engine].launch!=='function')throw Error('Unknown BROWSER '+engine);
if(device&&!all[device])throw Error('Unknown DEVICE '+device);
// Airplane mode: WebKit's test driver cannot load a page through the service worker while "offline" (it reports an internal
// error) — a limit of the driver, not of Safari. There the relaunch steps run online (data kept across the reload is still
// checked); real offline relaunches are covered by the Chromium runs.
let noted=false;
const offline=async(ctx,on)=>{if(engine==='webkit'){if(!noted){console.log('NOTE WebKit: airplane-mode steps run online (driver limit), offline is covered in Chromium');noted=true}return false}await ctx.setOffline(on);return true};
// WebKit's driver reports the background update check, aborted by a reload in a test, as a page error ("… due to access
// control checks"). It is not an app error (update checks are tested by pages.js); only that message, only in WebKit, is set aside.
const noise=m=>engine==='webkit'&&/\?nocache=\d+ due to access control checks/.test(String(m));
module.exports={engine,device,offline,noise,launch:o=>pw[engine].launch(o),dev:d=>all[device||d]};
