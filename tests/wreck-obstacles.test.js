import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace,startRace,stepRace,getTrack,sampleTrack,resetCar} from '../src/physics.js';
import {getTrackObstacles,resolveTrackObstacles,obstacleBlocksPosition} from '../src/track-obstacles.js';

function severeWall(){
 const race=createRace({track:'breakwater',mode:'time-attack'});startRace(race);const track=getTrack(race.track),p=sampleTrack(110,track),lane=track.width/2-.952;
 Object.assign(race.car,{x:p.x+p.nx*lane,z:p.z+p.nz*lane,yaw:Math.atan2(p.nx,p.nz),vx:p.nx*35,vz:p.nz*35,speed:35,forwardSpeed:35});
 race._lastTrackS=race._safeS=race._lapDistance=110;race._trackIndex=p.index;race._lastProgressX=race.car.x;race._lastProgressZ=race.car.z;
 race.nitro.charge=.4;race.driftPoints=120;stepRace(race,{throttle:1},1/120);return race;
}

test('severe impact creates an explicit loss-of-drive phase and safe delayed recovery without awards',()=>{
 const race=severeWall();assert.equal(race.wreck.phase,'impact');assert.equal(race.wreck.id,1);assert.equal(race.impact.severity,'wreck');assert.equal(race.recoveries,0);
 const before=race._lapDistance,gate=race._nextCheckpoint,charge=race.nitro.charge,elapsed=race.elapsed;
 for(let i=0;i<60;i++)stepRace(race,{throttle:1,nitro:true},1/120);
 assert.equal(race.wreck.phase,'impact');assert.equal(race.recoveries,0);assert.equal(race.car.nitroActive,false);
 for(let i=0;i<30&&race.recoveries===0;i++)stepRace(race,{throttle:1},1/120);
 assert.equal(race.recoveries,1);assert.equal(race.wreck.phase,'recovered');assert.equal(race.recovery.reason,'wreck');
 assert.ok(race._lapDistance<=before-7.99);assert.ok(race._nextCheckpoint<=gate);assert.equal(race.nitro.charge,charge);assert.equal(race.driftPoints,0);assert.equal(race.score,0);assert.equal(race.completedLaps,0);assert.ok(race.elapsed>elapsed+.65);
});

test('pause freezes the real wreck timer and reset does not duplicate the impact event',()=>{
 const race=severeWall(),remaining=race.wreck.remaining,impact=race.impact.id;
 race.state='paused';stepRace(race,{throttle:1},.1);assert.equal(race.wreck.remaining,remaining);
 race.state='racing';resetCar(race);assert.equal(race.wreck.phase,'recovered');assert.equal(race.impact.id,impact);
});

test('track obstacles supply real bounded contact while high jumping cars clear them',()=>{
 const obstacle={id:'barrier',x:0,y:0,z:0,tx:0,tz:1,radius:1.3,height:1.8};
 const grounded={car:{x:0,y:0,z:-3.1,yaw:0,vx:0,vz:30}};
 const contacts=resolveTrackObstacles(grounded,[obstacle]);assert.ok(contacts.length>0);assert.ok(contacts[0].normalSpeed>29);assert.ok(grounded.car.vz<=0&&grounded.car.vz>=-1.6);
 assert.ok(grounded.car.z<-3.1);assert.ok(contacts[0].nz<-.99);assert.ok(Math.abs(Math.hypot(contacts[0].x,contacts[0].z)-1.3)<1e-9);
 const flying={car:{x:0,y:2,z:-3.1,yaw:0,vx:0,vz:30}};
 assert.deepEqual(resolveTrackObstacles(flying,[obstacle]),[]);assert.equal(flying.car.vz,30);
 assert.equal(obstacleBlocksPosition(obstacle,0,0,0),true);assert.equal(obstacleBlocksPosition(obstacle,0,5,0),false);
});

test('real route obstacle collision cannot be driven through and recovery avoids its space',()=>{
 const track=getTrack('breakwater'),original=track.obstacles;
 track.obstacles=[{id:'test-solid',s:110,lane:0,radius:1.3,height:1.8,type:'barrier'}];
 try{
  const race=createRace({track:track.id,mode:'time-attack'});startRace(race);const p=sampleTrack(107,track);
  Object.assign(race.car,{x:p.x,z:p.z,yaw:Math.atan2(p.tx,p.tz),vx:p.tx*35,vz:p.tz*35,speed:35,forwardSpeed:35});
  race._lastTrackS=race._safeS=race._lapDistance=107;race._trackIndex=p.index;race._lastProgressX=p.x;race._lastProgressZ=p.z;
  stepRace(race,{throttle:1},1/120);assert.equal(race.impact.source,'obstacle');assert.equal(race.wreck.phase,'impact');
  race._safeS=race._lapDistance=118;resetCar(race,{reason:'wreck',retreat:8});
  const obstacle=getTrackObstacles(track)[0];assert.equal(obstacleBlocksPosition(obstacle,race.car.x,race.car.y,race.car.z),false);assert.ok(race._safeS<=110);
 }finally{track.obstacles=original;}
});

test('a severe second wall hit escalates during heavy-contact cooldown, once, with safe recovery',()=>{
 const race=createRace({track:'breakwater',mode:'time-attack'});startRace(race);
 const track=getTrack(race.track),p=sampleTrack(110,track),lane=track.width/2-.952;
 const placeHit=(outward,along)=>{
  Object.assign(race.car,{x:p.x+p.nx*lane,z:p.z+p.nz*lane,yaw:Math.atan2(p.nx*outward+p.tx*along,p.nz*outward+p.tz*along),vx:p.nx*outward+p.tx*along,vz:p.nz*outward+p.tz*along,speed:Math.hypot(outward,along)});
  race._lastTrackS=race._safeS=race._lapDistance=110;race._trackIndex=p.index;
  race._lastProgressX=race.car.x;race._lastProgressZ=race.car.z;
 };
 placeHit(10,35);stepRace(race,{throttle:1},1/120);
 assert.equal(race.impact.severity,'heavy');assert.equal(race.wreck.phase,'none');assert.ok(race._collisionCooldown>.5);
 const firstId=race.impact.id;
 placeHit(35,20);const speedBefore=race.car.speed;stepRace(race,{throttle:1},1/120);
 assert.equal(race.impact.id,firstId+1);assert.equal(race.impact.severity,'wreck');assert.equal(race.impact.source,'barrier');
 assert.equal(race.wreck.phase,'impact');assert.equal(race.wreck.id,1);assert.equal(race.recoveries,0);assert.ok(race.car.speed<speedBefore);
 const eventId=race.impact.id,progress=race._lapDistance,charge=race.nitro.charge;
 for(let i=0;i<90;i++)stepRace(race,{throttle:1},1/120);
 assert.equal(race.impact.id,eventId,'the same collision cannot keep replaying the event');assert.equal(race.wreck.id,1);
 assert.equal(race.recoveries,1);assert.ok(race._lapDistance<progress-7);assert.equal(race.nitro.charge,charge);
 assert.equal(race.completedLaps,0);assert.equal(race.score,0);
});

test('severe car contact can escalate a prior heavy hit, while equal-severity contact respects cooldown',()=>{
 for(const severe of [false,true]){
  const race=createRace({track:'breakwater'});startRace(race);race.rivals=[race.rivals[0]];
  const rival=race.rivals[0],p=sampleTrack(110,getTrack(race.track));
  // A real ordinary wall strike establishes the first heavy-impact cooldown.
  const lane=getTrack(race.track).width/2-.952;
  Object.assign(race.car,{x:p.x+p.nx*lane,z:p.z+p.nz*lane,yaw:Math.atan2(p.nx*10+p.tx*35,p.nz*10+p.tz*35),vx:p.nx*10+p.tx*35,vz:p.nz*10+p.tz*35,speed:Math.hypot(10,35)});
  race._safeS=race._lastTrackS=race._lapDistance=110;race._trackIndex=p.index;
  stepRace(race,{throttle:1},1/120);assert.equal(race.impact.severity,'heavy');const firstId=race.impact.id;
  for(const [racer,offset,speed,direction] of [[race,0,severe?40:25,1],[rival,3.8,severe?20:10,severe?-1:1]]){
   Object.assign(racer.car,{x:p.x+p.tx*offset,z:p.z+p.tz*offset,yaw:Math.atan2(p.tx*direction,p.tz*direction),vx:p.tx*speed*direction,vz:p.tz*speed*direction,speed,forwardSpeed:speed});
   racer._lastTrackS=racer._safeS=p.s+offset;racer._trackIndex=p.index;
   racer._lastProgressX=racer.car.x;racer._lastProgressZ=racer.car.z;
  }
  stepRace(race,{throttle:1},1/120);
  assert.equal(race.impact.id,firstId+(severe?1:0));assert.equal(race.wreck.phase,severe?'impact':'none');
  assert.equal(race.impact.severity,severe?'wreck':'heavy');assert.equal(race.recoveries,0);
 }
});
