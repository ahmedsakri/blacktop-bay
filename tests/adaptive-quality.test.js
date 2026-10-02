import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdaptiveQuality} from '../src/adaptive-quality.js';
const run=(controller,ms,seconds,active=true)=>{let changed=0;for(let i=0;i<seconds*1000/ms;i++)changed+=controller.sample(ms,{active});return changed;};
test('sustained pressure removes expensive passes first and recovers slowly without blurry mobile rendering',()=>{
 const q=createAdaptiveQuality({mobile:true,dpr:3,width:390,height:844});assert.equal(q.settings.pixelRatio,1.6);
 assert.equal(run(q,34,1),0);run(q,34,4);assert.equal(q.status.level,1);assert.equal(q.settings.pixelRatio,1.6);assert.equal(q.settings.shadows,false);assert.ok(q.settings.detailDistanceScale<1);
 run(q,34,20);assert.equal(q.status.level,3);assert.equal(q.settings.pixelRatio,1);
 q.reset();const level=q.status.level;run(q,16.67,8);assert.equal(q.status.level,level);run(q,16.67,12);assert.ok(q.status.level<level);
});
test('manual choice, hidden/inactive work and isolated hitches cannot change quality',()=>{
 const q=createAdaptiveQuality({mobile:true,choice:'ultra',dpr:2});run(q,40,30);assert.equal(q.settings.pixelRatio,1.75);
 q.configure({choice:'auto'});run(q,40,60,false);assert.equal(q.status.level,0);
 for(let i=0;i<120;i++){q.sample(500);q.sample(16.67);}assert.equal(q.status.level,0);
 run(q,35,5);assert.ok(q.status.level>0);q.configure({choice:'balanced'});assert.equal(q.status.level,0);assert.equal(q.settings.pixelRatio,1.35);
});
test('viewport changes recompute the finite pixel budget while retaining observed performance level',()=>{
 const q=createAdaptiveQuality({mobile:true,dpr:3,width:390,height:844,deviceMemory:8,hardwareConcurrency:8});assert.equal(q.settings.pixelRatio,1.75);
 run(q,34,5);assert.equal(q.status.level,1);
 q.configure({width:1366,height:1024});assert.equal(q.status.level,1);assert.ok(q.settings.pixelRatio>1&&q.settings.pixelRatio<1.32);
 q.configure({width:1024,height:1366});assert.ok(1024*1366*q.settings.pixelRatio**2<=2400000.01);
 q.configure({deviceMemory:2});assert.equal(q.settings.pixelRatio,1);assert.equal(q.settings.shadows,false);
 q.configure({choice:'ultra'});assert.equal(q.status.level,0);assert.ok(q.settings.pixelRatio>1.4);assert.equal(q.settings.reflection,true);
});
