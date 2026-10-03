import { chromium } from '/Users/ahmedsakri/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const local='/Users/ahmedsakri/Documents/Personal/Games/camber-reign-audio-source-review-2026-10-04';
const manifestPath=path.join(root,'reports/source-audit-2026-10-04/veyron-review-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const prepared=JSON.parse(await fs.readFile(path.join(local,'prepared/engine-loop-data.json'),'utf8'))[0];
const bank={...manifest.recordings[0],...prepared,url:'/local-review/veyron-pur-sang-review-v1.wav'};
manifest.recordings[0]=bank;await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const shippingManifest=await fs.readFile(path.join(root,'src/recorded-engine-manifest.js'),'utf8');
const fixture=await fs.readFile(path.join(root,'reports/recorded-audio-review.html'),'utf8');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();
 await page.route('**/src/recorded-engine-manifest.js*',route=>route.fulfill({contentType:'application/javascript',body:shippingManifest.replace('Object.freeze({','Object.freeze({\n'+JSON.stringify(bank.id)+':'+JSON.stringify(bank)+',').replace('"bugatti-veyron": "murcielago-v12"','"bugatti-veyron": "veyron-pur-sang-review"')}));
 await page.route('**/local-review/veyron-pur-sang-review-v1.wav',async route=>route.fulfill({contentType:'audio/wav',body:await fs.readFile(path.join(local,'prepared',prepared.file))}));
 await page.route('**/reports/recorded-audio-review.html',route=>route.fulfill({contentType:'text/html',body:fixture.replace('</script>','window.__reviewRender=render;window.__reviewWav=wav;</script>')}));
 await page.goto('http://127.0.0.1:4191/reports/recorded-audio-review.html');
 await page.waitForFunction(()=>typeof window.__reviewRender==='function');
 const result=await page.evaluate(async()=>{
  async function make(recorded){const {output,report}=await window.__reviewRender('bugatti-veyron',recorded);const bytes=new Uint8Array(await window.__reviewWav(output).arrayBuffer());let bin='';for(let at=0;at<bytes.length;at+=32768)bin+=String.fromCharCode(...bytes.subarray(at,at+32768));return{report,base64:btoa(bin)};}
  return {recorded:await make(true),synthesisOnly:await make(false)};
 });
 for(const [key,val] of Object.entries(result)){await fs.writeFile(path.join(local,'prepared',`veyron-${key}-mixer-review.wav`),Buffer.from(val.base64,'base64'));delete val.base64;}
 const currentPage=await browser.newPage();
 await currentPage.route('**/reports/recorded-audio-review.html',route=>route.fulfill({contentType:'text/html',body:fixture.replace('</script>','window.__reviewRender=render;window.__reviewWav=wav;</script>')}));
 await currentPage.goto('http://127.0.0.1:4191/reports/recorded-audio-review.html');
 await currentPage.waitForFunction(()=>typeof window.__reviewRender==='function');
 result.currentShipping=await currentPage.evaluate(async()=>{const {output,report}=await window.__reviewRender('bugatti-veyron',true);const bytes=new Uint8Array(await window.__reviewWav(output).arrayBuffer());let bin='';for(let at=0;at<bytes.length;at+=32768)bin+=String.fromCharCode(...bytes.subarray(at,at+32768));return{report,base64:btoa(bin)};});
 await fs.writeFile(path.join(local,'prepared/veyron-current-shipping-mixer-review.wav'),Buffer.from(result.currentShipping.base64,'base64'));delete result.currentShipping.base64;
 result.relativeToCurrentShippingRms=result.recorded.report.rms/result.currentShipping.report.rms;
 result.relativeRms=result.recorded.report.rms/result.synthesisOnly.report.rms;
 result.withinMixBudget=result.relativeRms<=1.25;
 result.conditions={kind:'OfflineAudioContext rendering using actual createAudio and unchanged mixer',sourceStartSeconds:1,sourceDurationSeconds:1.35,loopDurationSeconds:1.25,singleBand:true,movingOnly:true,perCarMixUnchanged:[0.88,0.8,0.76],heardByAgent:false,shippingFilesChanged:false,bankPath:path.join(local,'prepared',prepared.file),recordedMixerPath:path.join(local,'prepared/veyron-recorded-mixer-review.wav'),baselineMixerPath:path.join(local,'prepared/veyron-synthesisOnly-mixer-review.wav')};
 await fs.writeFile(path.join(root,'reports/source-audit-2026-10-04/veyron-mixer-review.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
