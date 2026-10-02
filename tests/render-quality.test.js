import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY_PRESETS,normalizeQuality,qualitySettings} from '../src/render-quality.js';

test('automatic quality caps mobile rendering while explicit choices remain respected',()=>{
 assert.equal(qualitySettings('auto',{mobile:true,dpr:3}).pixelRatio,1);
 assert.equal(qualitySettings('auto',{mobile:true,dpr:3}).bloom,false);
 assert.equal(qualitySettings('auto',{mobile:true,dpr:3}).shadows,false);
 assert.equal(qualitySettings('auto',{mobile:true,dpr:3}).reflection,false);
 assert.equal(qualitySettings('auto',{mobile:false,dpr:3}).pixelRatio,1.75);
 assert.equal(qualitySettings('auto',{mobile:false,dpr:3}).reflection,true);
 assert.equal(qualitySettings('ultra',{mobile:true,dpr:3}).reflection,true);
 assert.deepEqual(qualitySettings('performance',{dpr:3}),{...QUALITY_PRESETS.performance});
});
test('saved quality and screen density inputs are normalized without mutating presets',()=>{
 for(const input of ['auto','unknown','__proto__',null,undefined])assert.equal(normalizeQuality(input),'auto');
 for(const input of Object.keys(QUALITY_PRESETS))assert.equal(normalizeQuality(input),input);
 for(const dpr of [NaN,Infinity,0,-1])assert.equal(qualitySettings('ultra',{dpr}).pixelRatio,1);
 assert.equal(qualitySettings('ultra',{dpr:1.25}).pixelRatio,1.25);
 const modified=qualitySettings('balanced',{dpr:2});modified.reflection=true;
 assert.equal(qualitySettings('balanced',{dpr:2}).reflection,false);
});
