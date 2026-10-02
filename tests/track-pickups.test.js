import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,getTrack,projectOnTrack} from '../src/track.js';
import {createRace,startRace,stepRace} from '../src/physics.js';
import {getTrackPickups,createTrackPickups,collectTrackPickups,pickupAvailable,refreshPickupAvailability} from '../src/track-pickups.js';

function playerAt(pickup) {
 const racer=createRace({track:'breakwater',mode:'time-attack'});startRace(racer);
 Object.assign(racer.car,{x:pickup.x,z:pickup.z,y:0,forwardSpeed:25,speed:25});
 racer._safeS=pickup.s;racer.nitro.charge=.1;
 return racer;
}

test('every circuit has six original, bounded road pickups with stable IDs and no start-grid spawn',()=>{
 for(const descriptor of TRACKS){const track=getTrack(descriptor.id),definitions=getTrackPickups(track.id);
  assert.equal(definitions.length,6);assert.equal(new Set(definitions.map(p=>p.id)).size,6);
  for(const p of definitions){const road=projectOnTrack(p.x,p.z,undefined,track);
   assert.ok(road.distance+p.radius<track.width/2);assert.ok(p.s>40&&p.s<track.length-40);
   assert.ok(Math.abs(Math.hypot(p.tx,p.tz)-1)<.01);assert.ok(p.refill>0&&p.refill<1);
  }
 }
});

test('collection is swept, capped, one per racer per lap, and gives a rival its own fair chance',()=>{
 const track=getTrack('breakwater'),pickups=createTrackPickups(track.id),p=pickups[0],racer=playerAt(p);
 const previous={x:p.x-p.tx*2,z:p.z-p.tz*2};
 collectTrackPickups(pickups,racer,previous,10,track);
 assert.equal(racer.pickupEvent.id,1);assert.equal(racer.pickupEvent.pickupId,p.id);assert.equal(p.playerAvailable,false);
 assert.ok(Math.abs(racer.nitro.charge-(.1+racer.nitro.capacity*.32))<1e-9);
 collectTrackPickups(pickups,racer,previous,40,track);assert.equal(racer.pickupEvent.id,1);
 const rival=playerAt(p);rival.id='rival-1';rival.nitro.charge=rival.nitro.capacity-.01;
 collectTrackPickups(pickups,rival,previous,10,track);assert.equal(rival.pickupEvent.id,1);assert.equal(rival.nitro.charge,rival.nitro.capacity);
 racer.completedLaps=1;assert.equal(pickupAvailable(p,racer,12),false);assert.equal(pickupAvailable(p,racer,19),true);
 refreshPickupAvailability(pickups,racer,19);assert.equal(p.playerAvailable,true);
 collectTrackPickups(pickups,racer,previous,19,track);assert.equal(racer.pickupEvent.id,2);
});

test('teleports, reverse movement, high airborne cars and recovery cannot collect pickups',()=>{
 const track=getTrack('breakwater');
 for(const kind of ['teleport','reverse','airborne','recovery','wreck','unvalidated']){
  const pickups=createTrackPickups(track.id),p=pickups[0],racer=playerAt(p);let previous={x:p.x,z:p.z};
  if(kind==='teleport')previous.x+=20;
  if(kind==='reverse')racer.car.forwardSpeed=-5;
  if(kind==='airborne')racer.car.y=8;
  if(kind==='recovery')racer.recovery.phase='recovered';
  if(kind==='wreck')racer.wreck.phase='impact';
  if(kind==='unvalidated')racer._safeS=0;
  collectTrackPickups(pickups,racer,previous,10,track);assert.equal(racer.pickupEvent.id,0,kind);
 }
});

test('actual fixed-step race collects on the driven line and restart restores the collection',()=>{
 const race=createRace({track:'breakwater',mode:'time-attack'});startRace(race);const p=race.pickups[0],track=getTrack(race.track);
 Object.assign(race.car,{x:p.x-p.tx*2.5,z:p.z-p.tz*2.5,yaw:Math.atan2(p.tx,p.tz),speed:25,forwardSpeed:25,vx:p.tx*25,vz:p.tz*25});
 race._lastTrackS=race._safeS=p.s-2.5;race._lapDistance=p.s-2.5;race._lastProgressX=race.car.x;race._lastProgressZ=race.car.z;
 race._trackIndex=projectOnTrack(race.car.x,race.car.z,undefined,track).index;race.nitro.charge=.1;
 for(let i=0;i<8;i++)stepRace(race,{throttle:1},1/120);
 assert.equal(race.pickupEvent.id,1);assert.ok(race.nitro.charge>race.nitro.capacity*.32);
 const after=race.nitro.charge;race.state='paused';stepRace(race,{throttle:1},.1);assert.equal(race.nitro.charge,after);
 startRace(race);assert.equal(race.pickupEvent.id,0);assert.ok(race.pickups.every(p=>p.playerAvailable));
});
