import { createRace, startRace, stepRace } from '../src/physics.js';
import { TRACK, projectOnTrack, sampleTrack } from '../src/track.js';

// Development-only finish-screen/replay fixture. Do not import in production.
// It drives every checkpoint through real physics; no progress, score, lap time,
// or finish state is assigned by this helper. Follower matches physics.test.js.
const PHYSICS_HZ=120;
const SAMPLE_EVERY=12; // Ten replay samples per simulated second.
const MAX_SECONDS=190;
const MAX_FRAMES=9000;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const wrapAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));

function followCircuit(race) {
  const projection=projectOnTrack(race.car.x,race.car.z);
  const aim=sampleTrack(projection.s+10+race.car.speed*.45);
  const near=sampleTrack(projection.s+3),far=sampleTrack(projection.s+22);
  const curvature=Math.abs(wrapAngle(Math.atan2(far.tx,far.tz)-Math.atan2(near.tx,near.tz)))/19;
  const targetSpeed=Math.min(36,Math.sqrt(12/Math.max(.004,curvature)));
  const error=wrapAngle(Math.atan2(aim.x-race.car.x,aim.z-race.car.z)-race.car.yaw);
  return {steer:clamp(error*2.9,-1,1),throttle:1,brake:race.car.speed>targetSpeed+1};
}

function capture(race) {
  return {t:race.elapsed,x:race.car.x,z:race.car.z,yaw:race.car.yaw};
}

export function createCompletedRaceFixture() {
  const race=createRace();
  startRace(race);
  const frames=[capture(race)];
  let collisions=0;
  for(let step=1;step<=PHYSICS_HZ*MAX_SECONDS && race.state==='racing';step++) {
    stepRace(race,followCircuit(race),1/PHYSICS_HZ);
    if(race.collision)collisions++;
    if(step%SAMPLE_EVERY===0)frames.push(capture(race));
  }
  // Include the actual finish instant, which need not fall on a 100 ms boundary.
  if(frames.at(-1).t<race.elapsed)frames.push(capture(race));

  const lapTotal=race.lapTimes.reduce((sum,time)=>sum+time,0);
  if(race.state!=='finished' || race.completedLaps!==3 || race.totalLaps!==3
    || race.lapTimes.length!==3 || race.progress!==1 || race.raceProgress!==1
    || race.lapTimes.some(time=>!Number.isFinite(time) || time<=0)
    || Math.abs(lapTotal-race.elapsed)>1e-7 || collisions!==0 || race.recoveries!==0) {
    throw new Error('QA driver must complete three real laps without collisions or recovery.');
  }
  if(frames.length>MAX_FRAMES || frames.length<2 || race.elapsed>MAX_SECONDS
    || TRACK.length*3/race.elapsed>45) {
    throw new Error('QA replay exceeds its duration, sample, or physical speed bounds.');
  }
  for(let i=0;i<frames.length;i++) {
    const frame=frames[i];
    if(![frame.t,frame.x,frame.z,frame.yaw].every(Number.isFinite)
      || frame.t<0 || frame.t>race.elapsed || (i>0 && frame.t<=frames[i-1].t)) {
      throw new Error('QA replay contains an invalid position or timestamp.');
    }
  }
  return {race,frames};
}
