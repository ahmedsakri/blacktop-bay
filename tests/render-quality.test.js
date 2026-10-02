import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY_PRESETS,MOBILE_QUALITY_PROFILES,normalizeQuality,qualitySettings,qualityGeometry,mobileQualityProfile} from '../src/render-quality.js';

test('automatic phone quality starts sharp with shadows and reserves expensive passes for explicit choices',()=>{
 const phone=qualitySettings('auto',{mobile:true,dpr:3,width:390,height:844});
 assert.equal(phone.pixelRatio,1.6);assert.equal(phone.shadows,true);assert.equal(phone.detailDistanceScale,1);
 assert.equal(phone.bloom,false);assert.equal(phone.reflection,false);
 assert.equal(Math.round(390*844*phone.pixelRatio**2),842650);
 assert.equal(qualitySettings('auto',{mobile:false,dpr:3}).pixelRatio,1.75);
 assert.equal(qualitySettings('auto',{mobile:false,dpr:3}).reflection,true);
 assert.equal(qualitySettings('ultra',{mobile:true,dpr:3}).reflection,true);
 assert.deepEqual(qualitySettings('performance',{dpr:3}),{...QUALITY_PRESETS.performance});
});
test('tablet drawing buffers obey finite screen budgets in either orientation without dropping below 1x',()=>{
 for(const [width,height]of [[390,844],[844,390],[1024,768],[1024,1366],[1366,1024],[2048,1536]]){
  for(const profile of [undefined,{deviceMemory:2,hardwareConcurrency:4},{deviceMemory:8,hardwareConcurrency:8}]){
   const q=qualitySettings('auto',{mobile:true,dpr:3,width,height,...profile}),budget=MOBILE_QUALITY_PROFILES[mobileQualityProfile(profile)].maxRenderPixels;
   assert.ok(q.pixelRatio>=1);assert.ok(width*height*q.pixelRatio**2<=Math.max(width*height,budget)+.01);
   const rotated=qualitySettings('auto',{mobile:true,dpr:3,width:height,height:width,...profile});assert.equal(rotated.pixelRatio,q.pixelRatio);
  }
 }
 const tablet=qualitySettings('auto',{mobile:true,dpr:2,width:1024,height:1366});assert.ok(tablet.pixelRatio>1.19&&tablet.pixelRatio<1.20);
 const high=qualitySettings('ultra',{mobile:true,dpr:3,width:1024,height:1366});assert.ok(high.pixelRatio>tablet.pixelRatio);assert.equal(high.maxRenderPixels,3000000);
});
test('capability hints are conservative, optional and cannot invent native-density budgets',()=>{
 assert.equal(mobileQualityProfile({}), 'standard');
 assert.equal(mobileQualityProfile({deviceMemory:NaN,hardwareConcurrency:Infinity}), 'standard');
 assert.equal(mobileQualityProfile({deviceMemory:2,hardwareConcurrency:12}), 'constrained');
 assert.equal(mobileQualityProfile({deviceMemory:8,hardwareConcurrency:4}), 'constrained');
 assert.equal(mobileQualityProfile({deviceMemory:8,hardwareConcurrency:8}), 'capable');
 assert.equal(mobileQualityProfile({hardwareConcurrency:12}), 'standard');
 assert.equal(qualitySettings('auto',{mobile:true,dpr:3,deviceMemory:2}).pixelRatio,1.35);
 assert.equal(qualitySettings('auto',{mobile:true,dpr:3,deviceMemory:8,hardwareConcurrency:8}).pixelRatio,1.75);
 for(const options of [{width:NaN,height:Infinity},{width:-1,height:800},{width:1e308,height:1e308}]){
  const q=qualitySettings('auto',{mobile:true,dpr:3,...options});assert.ok(Number.isFinite(q.pixelRatio)&&q.pixelRatio>=1&&q.pixelRatio<=1.6);
 }
});
test('automatic pressure spends shadows and distant work before pixels, then stops at full CSS resolution',()=>{
 const settings=Array.from({length:4},(_,adaptiveLevel)=>qualitySettings('auto',{mobile:true,dpr:3,width:390,height:844,adaptiveLevel}));
 assert.equal(settings[1].pixelRatio,settings[0].pixelRatio);assert.equal(settings[1].shadows,false);assert.ok(settings[1].detailDistanceScale<settings[0].detailDistanceScale);
 assert.ok(settings[2].pixelRatio<settings[1].pixelRatio);assert.equal(settings[3].pixelRatio,1);
 for(const q of settings)assert.ok(q.pixelRatio>=1);
});
test('High detail selects actual high source geometry independently from touch input',()=>{
 assert.deepEqual(qualityGeometry('ultra',{mobile:true}),{worldLow:false,carLow:false});
 assert.deepEqual(qualityGeometry('auto',{mobile:true}),{worldLow:true,carLow:true});
 assert.deepEqual(qualityGeometry('auto',{mobile:false}),{worldLow:false,carLow:false});
 assert.deepEqual(qualityGeometry('performance',{mobile:false}),{worldLow:true,carLow:true});
});
test('saved quality and screen density inputs are normalized without mutating presets',()=>{
 for(const input of ['auto','unknown','__proto__',null,undefined])assert.equal(normalizeQuality(input),'auto');
 for(const input of Object.keys(QUALITY_PRESETS))assert.equal(normalizeQuality(input),input);
 for(const dpr of [NaN,Infinity,0,-1])assert.equal(qualitySettings('ultra',{dpr}).pixelRatio,1);
 assert.equal(qualitySettings('ultra',{dpr:1.25}).pixelRatio,1.25);
 const modified=qualitySettings('balanced',{dpr:2});modified.reflection=true;
 assert.equal(qualitySettings('balanced',{dpr:2}).reflection,false);
});
