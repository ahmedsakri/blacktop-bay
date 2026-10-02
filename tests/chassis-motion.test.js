import test from 'node:test';
import assert from 'node:assert/strict';
import {createChassisMotion} from '../src/chassis-motion.js';

test('acceleration lifts the nose, braking dips it, and cornering rolls the sprung body outward',()=>{
 const motion=createChassisMotion();motion.update({speed:0,raceId:1},.04);
 let result;for(let i=1;i<=20;i++)result=motion.update({speed:i*.5,raceId:1},.04);
 assert.ok(result.pitch<-.015);assert.ok(result.front>result.rear);
 for(let i=1;i<=20;i++)result=motion.update({speed:10-i*.5,brake:true,raceId:1},.04);
 assert.ok(result.pitch>.03);assert.ok(result.front<result.rear);
 for(let i=0;i<30;i++)result=motion.update({speed:35,steering:1,raceId:1},.04);
 assert.ok(result.roll<-.04);
 for(let i=0;i<30;i++)result=motion.update({speed:35,steering:-1,raceId:1},.04);
 assert.ok(result.roll>.04);
});

test('paused motion freezes and returning at actual speed does not fabricate an acceleration kick',()=>{
 const motion=createChassisMotion();let result=motion.update({speed:32,raceId:1},.04);
 assert.equal(result.pitch,0);
 for(let i=0;i<10;i++)assert.deepEqual(motion.update({speed:32,paused:true,active:false,raceId:1},.06),result);
 result=motion.update({speed:32,active:true,raceId:1},.04);assert.equal(result.pitch,0);
 motion.update({speed:31,brake:true,raceId:1},.04);
 const frozen=motion.update({speed:31,paused:true,raceId:1},.04);
 assert.ok(frozen.pitch>0);
 assert.deepEqual(motion.update({speed:31,paused:true,raceId:1},10),frozen);
});

test('landing and collision compression happen once per event and restart for a new race',()=>{
 const motion=createChassisMotion(),land={raceId:'first',air:{phase:'grounded',event:{id:1,kind:'landing'}}};
 const first=motion.update(land,.04);assert.ok(first.heave<-.01);
 let settled;for(let i=0;i<100;i++)settled=motion.update(land,.04);
 assert.ok(Math.abs(settled.heave)<1e-6,'retained event does not keep compressing suspension');
 const again=motion.update({...land,raceId:'second'},.04);assert.ok(again.heave<-.01,'event #1 of the next race still compresses');
 const reset=motion.update({raceId:'third',speed:30},.04);assert.equal(reset.heave,0);assert.equal(reset.pitch,0);
 const crash=motion.update({raceId:'third',impact:{id:1,strength:1}},.04);assert.ok(crash.heave<0);
});

test('suspension stays finite and bounded for extreme frame times and driving forces',()=>{
 const motion=createChassisMotion();
 for(let i=0;i<200;i++){
  const result=motion.update({speed:i%2?1e7:-1e7,steering:i%2?100:-100,brake:i%2?1:NaN,impact:{id:i+1,strength:1},raceId:1},i%3===0?Infinity:10);
  assert.ok(Object.values(result).every(Number.isFinite));
  assert.ok(result.pitch>=-.035&&result.pitch<=.055);assert.ok(Math.abs(result.roll)<=.046);
  assert.ok(result.heave>=-.055&&result.heave<=0);
  for(const axle of ['front','rear'])assert.ok(result[axle]>=-.07&&result[axle]<=.06);
 }
});
