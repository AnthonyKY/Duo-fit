// Engine and phone for the browser suites. Default: Chromium with the iPhone each suite names (iPhone SE = narrowest screen).
// GitHub also runs every suite with BROWSER=webkit (the engine of Safari, used by every browser on iPhone) and DEVICE="iPhone 16 Plus".
const pw=require('playwright');
const engine=process.env.BROWSER||'chromium',device=process.env.DEVICE||'';
if(!pw[engine]||typeof pw[engine].launch!=='function')throw Error('Unknown BROWSER '+engine);
if(device&&!pw.devices[device])throw Error('Unknown DEVICE '+device);
module.exports={engine,device,launch:o=>pw[engine].launch(o),dev:d=>pw.devices[device||d]};
