import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace,startRace,stepRace,getTrack,sampleTrack,projectOnTrack} from '../src/physics.js';
import {rivalControls} from '../src/rivals.js';

const destinations=['fuji-skyline','singapore-afterdark','norway-fjord','san-francisco-hills'];

for(const trackId of destinations)test(`${trackId} has a physical elevation profile and all eight racers can complete its real gates`,()=>{
 const race=createRace({track:trackId});startRace(race);const track=getTrack(trackId);
 assert.ok(Math.max(...track.samples.map(p=>p.y))-Math.min(...track.samples.map(p=>p.y))>10);
 assert.ok(track.samples.every(p=>Number.isFinite(p.grade)&&Math.abs(p.grade)<.2));
 for(let frame=0;frame<420*120&&!race.allFinished;frame++){
  stepRace(race,rivalControls(race,[race,...race.rivals],track,race.specs,1/120),1/120);
 }
 assert.equal(race.allFinished,true,JSON.stringify(race.leaderboard));
 for(const racer of [race,...race.rivals]){
  assert.equal(racer.completedLaps,3);assert.equal(racer.recoveries,0);assert.equal(racer.lapTimes.length,3);
  assert.ok(racer.lapTimes.every(time=>time>30));assert.ok(Number.isFinite(racer.car.y));
 }
});

test('all six authored launch ramps can be driven, leave the road and land without recovery',()=>{
 for(const trackId of destinations){const track=getTrack(trackId);for(const ramp of track.ramps){
  const race=createRace({track:trackId,mode:'time-attack'});startRace(race);const p=sampleTrack(ramp.s-3,track);
  Object.assign(race.car,{x:p.x+p.nx*ramp.lane,y:p.y,z:p.z+p.nz*ramp.lane,yaw:Math.atan2(p.tx,p.tz),vx:p.tx*30,vz:p.tz*30,speed:30,forwardSpeed:30});
  race._baseLane=race._lane=ramp.lane;race._safeS=race._lastTrackS=race._lapDistance=p.s;race._trackIndex=p.index;race._lastProgressX=race.car.x;race._lastProgressZ=race.car.z;
  const events=[];let lastEvent=0,highestAboveRoad=0;
  for(let frame=0;frame<5*120;frame++){
   stepRace(race,rivalControls(race,[race],track,race.specs,1/120),1/120);
   const road=projectOnTrack(race.car.x,race.car.z,race._trackIndex,track,race.car.y);
   highestAboveRoad=Math.max(highestAboveRoad,race.car.y-road.y);
   if(race.air.event.id!==lastEvent){lastEvent=race.air.event.id;events.push({...race.air.event});}
  }
  assert.deepEqual(events.map(event=>event.kind),['takeoff','landing'],`${trackId}/${ramp.id}`);
  assert.ok(highestAboveRoad>ramp.height+.5,`${ramp.id} must travel above the launch surface`);
  assert.equal(race.recoveries,0);assert.equal(race.impact.kind,'none');assert.equal(race.completedLaps,0);
  assert.equal(events[1].stunt,ramp.type==='barrel'?'barrel':'none');
 }}
});
