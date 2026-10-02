import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdaptiveQuality} from '../src/adaptive-quality.js';
import {createRaceTiming} from '../src/race-timing.js';
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
 for(let i=0;i<20;i++){q.sample(500);run(q,16.67,1);}assert.equal(q.status.level,0);
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


test('consecutive severe frames trigger relief but isolated hitches and inactivity do not',()=>{
 for(const ms of [151,200,500,2000]){
  const q=createAdaptiveQuality({mobile:true,dpr:3});run(q,ms,8);assert.ok(q.status.level>=1,ms+'ms sustained frames reduce quality');
  run(q,ms,60);assert.equal(q.status.level,3);assert.equal(q.settings.pixelRatio,1);
 }
 const q=createAdaptiveQuality({mobile:true,dpr:3});
 for(let i=0;i<20;i++){q.sample(500);run(q,16.67,1);}
 assert.equal(q.status.level,0);
 run(q,500,2,false);q.sample(500);q.reset();run(q,16.67,5);assert.equal(q.status.level,0);
});

test('alternating severe and healthy intervals count as sustained pressure rather than disappearing from the p75 window',()=>{
 for(const ms of [151,200,500]){const q=createAdaptiveQuality({mobile:true,dpr:3});for(let i=0;i<180;i++){q.sample(ms);q.sample(16.67);}assert.equal(q.status.level,3,ms+'ms alternating stalls reduce automatic work');assert.equal(q.settings.pixelRatio,1);}
});


test('repeated active interruption pauses reduce Auto even though paused frames reset ordinary sampling',()=>{
 const q=createAdaptiveQuality({mobile:true,dpr:3}),clock=createRaceTiming();let now=0,drivingTime=0;
 clock.sample(now,{active:true});
 for(let i=0;i<3;i++){
  now+=500;q.sample(500);const timing=clock.sample(now,{active:true});assert.equal(timing.suspended,true);drivingTime+=timing.simulation;
  assert.equal(q.noteInterruption(now),i===2);
  clock.sample(++now,{active:false});q.reset(); // The real paused tick clears the ordinary severe streak.
  clock.sample(++now,{active:true});
 }
 assert.equal(drivingTime,0);assert.equal(q.status.level,1);assert.equal(q.settings.pixelRatio,1.6);assert.equal(q.settings.shadows,false);
 assert.equal(q.status.reason,'repeated active interruptions');assert.equal(q.status.samples,3);
});

test('interruption history expires, ignores duplicate/invalid/inactive reports and resets on time reversal',()=>{
 const q=createAdaptiveQuality({mobile:true,dpr:3});
 for(const now of [1000,32001,63002]){assert.equal(q.noteInterruption(now),false);q.reset();}
 for(const now of [NaN,Infinity,-1])assert.equal(q.noteInterruption(now),false);
 for(let i=0;i<10;i++)assert.equal(q.noteInterruption(63002),false);
 assert.equal(q.noteInterruption(64000,{active:false}),false);assert.equal(q.status.level,0);
 assert.equal(q.noteInterruption(100),false);assert.equal(q.noteInterruption(200),false);assert.equal(q.noteInterruption(300),true);
});

test('repeated interruptions respect wall-time cooldown and the automatic one-pixel floor',()=>{
 const q=createAdaptiveQuality({mobile:true,dpr:3});
 for(const now of [1000,2000])assert.equal(q.noteInterruption(now),false);assert.equal(q.noteInterruption(3000),true);
 for(const now of [3100,3200,3300,6999])assert.equal(q.noteInterruption(now),false);assert.equal(q.status.level,1);
 for(const now of [7000,8000])assert.equal(q.noteInterruption(now),false);assert.equal(q.noteInterruption(9000),true);
 for(const now of [13000,14000])assert.equal(q.noteInterruption(now),false);assert.equal(q.noteInterruption(15000),true);
 for(let now=19000;now<120000;now+=1000)assert.equal(q.noteInterruption(now),false);
 assert.equal(q.status.level,3);assert.equal(q.settings.pixelRatio,1);assert.equal(q.status.changes,3);
});

test('manual graphics remain authoritative and changing choices discards interruption history',()=>{
 for(const choice of ['performance','balanced','ultra']){
  const q=createAdaptiveQuality({mobile:true,dpr:3,choice}),before=q.settings;
  for(const now of [1000,2000,3000,5000,9000])assert.equal(q.noteInterruption(now),false);
  assert.deepEqual(q.settings,before);assert.equal(q.status.level,0);
  q.configure({choice:'auto'});assert.equal(q.noteInterruption(10000),false);assert.equal(q.noteInterruption(11000),false);
  q.configure({choice});q.configure({choice:'auto'});assert.equal(q.noteInterruption(12000),false);assert.equal(q.status.level,0);
 }
});
