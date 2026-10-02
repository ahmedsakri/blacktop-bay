import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace,startRace,stepRace,getTrack,sampleTrack} from '../src/physics.js';
import {stepNitro} from '../src/nitro-system.js';

function contact({mode='burst',speed=35,rivalSpeed=15,lane=0,height=0}={}){
 const race=createRace({track:'breakwater'});startRace(race);race.rivals=[race.rivals[0]];
 const rival=race.rivals[0],p=sampleTrack(110,getTrack(race.track));
 for(const [racer,offset,v] of [[race,0,speed],[rival,3.8,rivalSpeed]]){
  Object.assign(racer.car,{x:p.x+p.tx*offset+(racer===rival?p.nx*lane:0),y:racer===rival?height:0,z:p.z+p.tz*offset+(racer===rival?p.nz*lane:0),yaw:Math.atan2(p.tx,p.tz),vx:p.tx*v,vz:p.tz*v,speed:v,forwardSpeed:v});
  racer._safeS=racer._lastTrackS=racer._lapDistance=p.s+offset;racer._trackIndex=p.index;
  racer._lastProgressX=racer.car.x;racer._lastProgressZ=racer.car.z;
 }
 if(mode!=='off'){
  stepNitro(race.nitro,true,true,1/120);
  if(mode!=='normal'){
   stepNitro(race.nitro,false,true,mode==='burst'?.1:.5);
   stepNitro(race.nitro,true,true,1/120);
  }
 }
 return {race,rival};
}

test('earned Burst or Perfect Nitro front contact causes one opponent wreck with real attribution',()=>{
 for(const mode of ['burst','perfect']){
  const {race,rival}=contact({mode});
  stepRace(race,{throttle:1,nitro:true},1/120);
  assert.equal(rival.wreck.phase,'impact');assert.equal(rival.wreck.cause,'nitro-knockdown');
  assert.equal(rival.wreck.attackerId,'player');assert.equal(rival.impact.severity,'wreck');
  assert.equal(race.wreck.phase,'none');assert.equal(race.knockdownEvent.kind,'knockdown');
  assert.equal(race.knockdownEvent.mode,mode);assert.equal(race.knockdownEvent.victimId,rival.id);
  assert.equal(rival.recoveries,0,'impact animation precedes any safe recovery');
  for(let frame=0;frame<180;frame++)stepRace(race,{throttle:1,nitro:true},1/120);
  assert.equal(race.knockdownEvent.id,1,'one collision cannot farm repeated events');
  assert.equal(rival.recoveries,1);assert.ok(rival.recovery.toS<rival.recovery.fromS);
  assert.equal(rival.completedLaps,0);assert.equal(rival.score,0);
 }
});

test('normal boost, low speed, small closing speed and non-contact passing do not earn a knockdown',()=>{
 for(const options of [{mode:'off'},{mode:'normal'},{mode:'burst',speed:24,rivalSpeed:10},{mode:'burst',speed:35,rivalSpeed:31},{mode:'perfect',speed:30,rivalSpeed:15},{mode:'burst',lane:4}]){
  const {race,rival}=contact(options);stepRace(race,{throttle:1,nitro:options.mode!=='off'},1/120);
  assert.equal(race.knockdownEvent.id,0,JSON.stringify(options));assert.equal(rival.wreck.phase,'none');
 }
});

test('a car in recovery protection cannot be knocked down again',()=>{
 const {race,rival}=contact();rival._recoveryCooldown=2;rival.wreck.phase='recovered';rival.wreck.remaining=1;
 stepRace(race,{throttle:1,nitro:true},1/120);
 assert.equal(race.knockdownEvent.id,0);assert.equal(rival.wreck.phase,'recovered');assert.equal(rival.wreck.id,0);
});
