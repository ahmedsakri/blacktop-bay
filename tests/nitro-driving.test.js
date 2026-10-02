import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace,startRace,stepRace,getTrack,sampleTrack,getUpgradeStats} from '../src/physics.js';

function atSpeed(){
 const race=createRace({track:'breakwater',mode:'time-attack'});startRace(race);const p=sampleTrack(80,getTrack(race.track));
 Object.assign(race.car,{x:p.x,z:p.z,yaw:Math.atan2(p.tx,p.tz),vx:p.tx*20,vz:p.tz*20,speed:20,forwardSpeed:20});
 race._safeS=race._lastTrackS=race._lapDistance=p.s;race._trackIndex=p.index;race._lastProgressX=p.x;race._lastProgressZ=p.z;
 return race;
}

test('timed Nitro modes measurably change acceleration and fuel consumption in the real simulation',()=>{
 const normal=atSpeed(),perfect=atSpeed(),burst=atSpeed();
 for(let frame=0;frame<100;frame++){
  stepRace(normal,{throttle:1,nitro:true},1/120);
  stepRace(perfect,{throttle:1,nitro:frame!==55},1/120);
  stepRace(burst,{throttle:1,nitro:frame!==12},1/120);
 }
 assert.equal(normal.nitro.mode,'normal');assert.equal(perfect.nitro.mode,'perfect');assert.equal(burst.nitro.mode,'burst');
 assert.ok(perfect.car.speed>normal.car.speed+.3);assert.ok(burst.car.speed>normal.car.speed+3);
 assert.ok(perfect.nitro.charge>normal.nitro.charge);assert.ok(burst.nitro.charge<normal.nitro.charge);
});

test('race setup survives restart, leaves rivals balanced and changes the actual snapshotted specs',()=>{
 const base=createRace(),sprint=createRace({setup:'sprint',campaignEventId:'chapter-1-event-1'});
 assert.equal(base.setup,'balanced');assert.deepEqual(base.specs,getUpgradeStats(base.vehicle,{}));
 assert.ok(sprint.specs.topSpeed>base.specs.topSpeed);assert.ok(sprint.specs.grip<base.specs.grip);
 startRace(sprint);assert.equal(sprint.setup,'sprint');assert.equal(sprint.campaignEventId,'chapter-1-event-1');
 for(const rival of sprint.rivals)assert.equal(rival.setup,'balanced');
 const invalid=createRace({setup:'forged',campaignEventId:{id:'not-a-string'}});assert.equal(invalid.setup,'balanced');assert.equal(invalid.campaignEventId,null);
});
