import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace,startRace,stepRace,resetCar,getTrack,sampleTrack,projectOnTrack} from '../src/physics.js';
import {rivalControls} from '../src/rivals.js';

const advance=(race,input,seconds,hz=120)=>{for(let i=0;i<Math.round(seconds*hz);i++)stepRace(race,input,1/hz);};
function at(s=110,speed=0){
 const race=createRace({track:'breakwater'});startRace(race);race.rivals=[];
 const track=getTrack(race.track),p=sampleTrack(s,track);
 Object.assign(race.car,{x:p.x,z:p.z,yaw:Math.atan2(p.tx,p.tz),vx:p.tx*speed,vz:p.tz*speed,speed,forwardSpeed:speed});
 race._safeS=s;race._lastTrackS=s;race._trackIndex=p.index;race._lapDistance=s;race.progress=s/track.length;race.raceProgress=race.progress/3;race._nextCheckpoint=Math.floor(s/(track.length/12))+1;
 return race;
}
function wall(race,{along=0,outward=0,side=1}={}){
 const track=getTrack(race.track),p=sampleTrack(race._safeS,track),lane=side*(track.width/2-.95-.002);
 Object.assign(race.car,{x:p.x+p.nx*lane,z:p.z+p.nz*lane,vx:p.tx*along+p.nx*outward*side,vz:p.tz*along+p.nz*outward*side,yaw:Math.atan2(p.tx*along+p.nx*outward*side,p.tz*along+p.nz*outward*side),speed:Math.hypot(along,outward)});
 return p;
}

test('glancing wall contact preserves forward momentum while a hard strike cuts boost and clears an unbanked drift',()=>{
 const scrape=at(),hard=at();wall(scrape,{along:30,outward:1.5});wall(hard,{along:18,outward:18});
 hard.driftPoints=100;hard.combo=3;
 stepRace(scrape,{throttle:1},1/120);stepRace(hard,{throttle:1,nitro:true},1/120);
 assert.equal(scrape.impact.kind,'scrape');assert.equal(scrape.impact.source,'barrier');assert.ok(scrape.car.speed>29,'a light scrape must not impose the old 32% penalty');
 assert.equal(hard.impact.kind,'crash');assert.equal(hard.impact.source,'barrier');assert.ok(hard.car.speed<18);assert.ok(hard.impact.strength>.6);assert.ok(hard.impact.remaining>.7);
 assert.equal(hard.car.nitroActive,false);assert.equal(hard.nitro.active,false);assert.equal(hard.driftPoints,0);assert.equal(hard.combo,1);
 assert.equal(hard.recoveries,0,'a hard contact alone does not teleport the car');
 wall(scrape,{along:18,outward:18});stepRace(scrape,{throttle:1},1/120);
 assert.equal(scrape.impact.kind,'crash','a recent light scrape cannot suppress a subsequent hard impact');
});

test('both cars receive the same hard-impact classification regardless of which collider is the player',()=>{
 for(const playerBehind of [true,false]){
  const race=createRace({track:'breakwater'});startRace(race);race.rivals=[race.rivals[0]];
  const rival=race.rivals[0],p=sampleTrack(100,getTrack(race.track));
  for(const [racer,behind] of [[race,playerBehind],[rival,!playerBehind]]){
   const offset=behind?0:3.8,speed=behind?17:5;
   Object.assign(racer.car,{x:p.x+p.tx*offset,z:p.z+p.tz*offset,yaw:Math.atan2(p.tx,p.tz),vx:p.tx*speed,vz:p.tz*speed,speed,forwardSpeed:speed});
   racer._lastTrackS=p.s+offset;racer._safeS=p.s+offset;racer._trackIndex=p.index;
   racer.driftPoints=100;racer.combo=3;
  }
  stepRace(race,{throttle:0},1/120);
  for(const racer of [race,rival]){
   assert.equal(racer.impact.kind,'crash',`${racer.id} receives the shared pre-impact severity`);
   assert.equal(racer.impact.source,'car');assert.ok(racer._crashPenaltyTimer>0);
   assert.equal(racer.driftPoints,0);assert.equal(racer.combo,1);assert.equal(racer.nitro.active,false);
   assert.equal(racer.recoveries,0,'an ordinary car collision must not teleport either driver');
  }
  assert.equal(race.impact.strength,rival.impact.strength);
 }
});

test('a nose-first car waits before recovering behind its last valid position, without giving race progress or nitro',()=>{
 const race=at();wall(race,{outward:15});race.nitro.charge=.4;
 advance(race,{throttle:1},1.9);assert.equal(race.recoveries,0);assert.equal(race.recovery.phase,'waiting');assert.equal(race.recovery.reason,'stuck');
 const before=race._lapDistance,gate=race._nextCheckpoint,clock=race.elapsed;
 for(let i=0;i<180&&race.recoveries===0;i++)stepRace(race,{throttle:1},1/120);
 assert.equal(race.recoveries,1);assert.equal(race.recovery.phase,'recovered');assert.equal(race.recovery.reason,'stuck');assert.ok(race.recovery.fromS-race.recovery.toS>=7.99);
 assert.ok(race._lapDistance<=before-7.99);assert.ok(race._nextCheckpoint<=gate);assert.equal(race.completedLaps,0);assert.equal(race.score,0);assert.ok(race.elapsed>clock);assert.equal(race.nitro.charge,.4);
 assert.ok(projectOnTrack(race.car.x,race.car.z,undefined,getTrack(race.track)).distance<.01);assert.equal(race.car.speed,0);
});

test('braking, coasting at rest and holding a stationary handbrake never trigger automatic recovery',()=>{
 for(const input of [{throttle:1,brake:true},{throttle:0},{throttle:1,handbrake:true}]){
  const race=at();wall(race,{outward:.1});advance(race,input,5);assert.equal(race.recoveries,0);assert.notEqual(race.recovery.phase,'waiting');
 }
});

test('far off-road recovery uses the saved route location instead of the nearest bend and has a loop cooldown',()=>{
 const race=at(),saved=race._safeS,progress=race.progress;
 Object.assign(race.car,{x:5000,z:-5000,vx:0,vz:0,speed:0});advance(race,{throttle:1},.5);
 assert.ok(race.car.x>4000,'no immediate snap onto a different road segment');assert.equal(race._safeS,saved);assert.equal(race.progress,progress);assert.equal(race.recovery.phase,'waiting');assert.equal(race.recovery.reason,'off-track');
 for(let i=0;i<120&&!race.recoveries;i++)stepRace(race,{throttle:1},1/120);
 assert.equal(race.recoveries,1);assert.equal(race._safeS,saved-8);assert.ok(race.progress<progress);assert.equal(race._nextCheckpoint,1);
 Object.assign(race.car,{x:5000,z:-5000,vx:0,vz:0,speed:0});advance(race,{throttle:1},1.2);assert.equal(race.recoveries,1,'cooldown prevents repeat instant recovery');
 advance(race,{throttle:1,brake:true},3);assert.equal(race.recoveries,1,'intentional brake cancels pending recovery');assert.notEqual(race.recovery.phase,'waiting');
});

test('recovery restores the previous checkpoint requirement when retreat crosses a gate',()=>{
 const track=getTrack('breakwater'),race=at(track.length/12+3),before=race._lapDistance;
 assert.equal(race._nextCheckpoint,2);assert.equal(resetCar(race,{reason:'stuck',retreat:8}),true);
 assert.equal(race._nextCheckpoint,1);assert.ok(Math.abs(race._lapDistance-(before-8))<1e-8);assert.equal(race.completedLaps,0);assert.equal(race.lapTimes.length,0);
});

test('automatic recovery finds a clear position behind the car rather than overlapping a rival',()=>{
 const race=at(),p=sampleTrack(102,getTrack(race.track));
 race.rivals=[{state:'racing',car:{x:p.x,z:p.z}}];
 assert.equal(resetCar(race,{reason:'stuck',retreat:8}),true);
 assert.ok(Math.hypot(race.car.x-p.x,race.car.z-p.z)>=6.2);assert.ok(race.recovery.toS<102);assert.ok(race._lapDistance<=96);assert.equal(race.recoveries,1);
});

test('steering keeps the correct sign at parking speed and race speed, and ordinary steering does not cause recovery',()=>{
 for(const speed of [4,32])for(const steer of [-1,1]){
  const race=at(110,speed),yaw=race.car.yaw;advance(race,{steer,throttle:1},.18);
  const turn=Math.atan2(Math.sin(race.car.yaw-yaw),Math.cos(race.car.yaw-yaw));assert.ok(turn*steer<-.035);assert.equal(race.recoveries,0);assert.equal(race.impact.kind,'none');assert.notEqual(race.recovery.phase,'waiting');
 }
});

test('crash and recovery timing remain deterministic at 30, 60 and 120 animation updates',()=>{
 const runs=[30,60,120].map(hz=>{const race=at();wall(race,{outward:15});advance(race,{throttle:1},3.2,hz);return race;});
 for(const race of runs){assert.equal(race.recoveries,1);assert.equal(race.recovery.id,1);for(const key of ['x','z','speed'])assert.ok(Math.abs(race.car[key]-runs[0].car[key])<1e-9);assert.ok(Math.abs(race.progress-runs[0].progress)<1e-10);}
});

test('the recovered player still has to drive the gates and can finish a complete three-lap race',()=>{
 const race=createRace({track:'breakwater'});startRace(race);race.rivals=[];const track=getTrack(race.track);
 let displaced=false;
 for(let i=0;i<420*120&&race.state==='racing';i++){
  if(!displaced&&race.progress>.22){Object.assign(race.car,{x:5000,z:-5000,vx:0,vz:0});displaced=true;}
  const input=displaced&&!race.recoveries?{throttle:1}:rivalControls(race,[race],track,race.specs,1/120);
  stepRace(race,input,1/120);
 }
 assert.equal(displaced,true);assert.equal(race.recoveries,1);assert.equal(race.state,'finished');assert.equal(race.completedLaps,3);assert.equal(race.lapTimes.length,3);
 assert.ok(race.lapTimes.every(time=>time>40),'all laps require a complete physical circuit');assert.equal(race.raceProgress,1);
});
