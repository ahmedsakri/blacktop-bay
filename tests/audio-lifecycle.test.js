import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioLifecycle} from '../src/audio-lifecycle.js';
import {engineDetailFrame,drivingVoice} from '../src/driving-sound.js';
import {VEHICLES} from '../src/vehicles.js';
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function setup(){
 const jobs=new Map();let next=0,want=false,changes=0;
 const ctx={state:'suspended',resumes:0,suspends:0,async resume(){this.resumes++;this.state='running';},async suspend(){this.suspends++;this.state='suspended';}};
 const lifecycle=createAudioLifecycle({getContext:()=>ctx,wanted:()=>want,changed:()=>changes++,schedule:fn=>{jobs.set(++next,fn);return next;},cancel:id=>jobs.delete(id)});
 return {ctx,lifecycle,jobs,set wanted(v){want=v;},get changes(){return changes;},flush(){for(const [id,fn] of jobs){jobs.delete(id);fn();}}};
}
test('no lifecycle operation creates or resumes audio before user authorization',async()=>{
 const env=setup();env.wanted=true;env.lifecycle.sync();env.lifecycle.stateChanged();await settle();assert.equal(env.ctx.resumes,0);
 env.lifecycle.authorize();await settle();assert.equal(env.ctx.resumes,1);assert.equal(env.ctx.state,'running');assert.ok(env.changes>0);
 env.lifecycle.dispose();
});
test('quiet fades are followed by suspend and rapid return cancels the pending suspend',async()=>{
 const env=setup();env.wanted=true;env.lifecycle.authorize();await settle();env.wanted=false;env.lifecycle.sync();assert.equal(env.ctx.suspends,0);assert.equal(env.jobs.size,1);
 env.wanted=true;env.lifecycle.sync();env.flush();await settle();assert.equal(env.ctx.suspends,0);
 env.wanted=false;env.lifecycle.sync();env.flush();await settle();assert.equal(env.ctx.suspends,1);
 env.wanted=true;env.lifecycle.sync();await settle();assert.equal(env.ctx.resumes,2);assert.equal(env.jobs.size,0);env.lifecycle.dispose();
});
test('an in-flight idle suspension resumes safely if play returns before its promise resolves',async()=>{
 const env=setup();env.wanted=true;env.lifecycle.authorize();await settle();let complete;
 env.ctx.suspend=()=>{env.ctx.suspends++;return new Promise(resolve=>{complete=()=>{env.ctx.state='suspended';resolve();};});};
 env.wanted=false;env.lifecycle.sync();env.flush();await settle();env.wanted=true;env.lifecycle.sync();complete();await settle();
 assert.equal(env.ctx.state,'running');assert.equal(env.ctx.suspends,1);assert.equal(env.ctx.resumes,2);env.lifecycle.dispose();
});
test('interrupted state is not repeatedly resumed and a rejected resume waits for another gesture',async()=>{
 const env=setup();env.wanted=true;env.lifecycle.authorize();await settle();env.ctx.state='interrupted';
 for(let i=0;i<30;i++)env.lifecycle.stateChanged();await settle();assert.equal(env.ctx.resumes,1);
 env.ctx.state='suspended';env.ctx.resume=async()=>{env.ctx.resumes++;throw Error('gesture required');};env.lifecycle.stateChanged();await settle();
 for(let i=0;i<30;i++)env.lifecycle.sync();await settle();assert.equal(env.ctx.resumes,2);
 env.ctx.resume=async()=>{env.ctx.resumes++;env.ctx.state='running';};env.lifecycle.authorize();await settle();assert.equal(env.ctx.state,'running');assert.equal(env.ctx.resumes,3);env.lifecycle.dispose();
});
test('dispose cancels queued suspension and cannot resurrect a disposed graph',async()=>{
 const env=setup();env.wanted=true;env.lifecycle.authorize();await settle();env.wanted=false;env.lifecycle.sync();env.lifecycle.dispose();env.flush();env.wanted=true;env.lifecycle.sync();await settle();
 assert.equal(env.jobs.size,0);assert.equal(env.ctx.suspends,0);assert.equal(env.ctx.resumes,1);
});
test('authored extra engine layers stay bounded, unload with throttle and keep electric exhaust silent',()=>{
 for(const vehicle of VEHICLES){
  const voice=drivingVoice(vehicle),motion={pitch:voice.idle+voice.range*.8,rev:.8,load:1,torque:1};
  const loaded=engineDetailFrame({voice,motion,vehicle,speed:50}),lift=engineDetailFrame({voice,motion:{...motion,load:0},vehicle,speed:50});
  assert.ok(Object.values(loaded).every(Number.isFinite));assert.ok(loaded.exhaustGain<=.017);assert.ok(loaded.turbineGain<=.005);
  assert.ok(lift.turbineGain<loaded.turbineGain);assert.ok(lift.exhaustGain<=loaded.exhaustGain);
  if(voice.electric)assert.equal(loaded.exhaustGain,0);
 }
});
