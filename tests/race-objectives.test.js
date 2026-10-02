import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace,startRace,stepRace,getTrack,sampleTrack} from '../src/physics.js';
import {createObjectiveStats,trackObjectiveStats} from '../src/race-objectives.js';
import {rivalControls} from '../src/rivals.js';

const advance=(race,input,seconds)=>{for(let i=0;i<Math.round(seconds*120);i++)stepRace(race,input,1/120);};
function movingRace(){
 const race=createRace({track:'harbor',mode:'time-attack'});startRace(race);advance(race,{throttle:1},1);
 return race;
}
test('real timed Nitro controls count each accepted technique once and restart resets its history',()=>{
 const race=movingRace();
 advance(race,{throttle:1,nitro:true},.05);advance(race,{throttle:1},.45);advance(race,{throttle:1,nitro:true},.5);
 assert.equal(race.objectiveStats.perfectNitro,1);assert.equal(race.objectiveStats.burstNitro,0);
 advance(race,{throttle:1,nitro:true},.1);assert.equal(race.objectiveStats.perfectNitro,1);
 startRace(race);advance(race,{throttle:1},1);
 assert.deepEqual(race.objectiveStats,createObjectiveStats());
 advance(race,{throttle:1,nitro:true},.05);advance(race,{throttle:1},.08);advance(race,{throttle:1,nitro:true},.1);
 assert.equal(race.objectiveStats.burstNitro,1);assert.equal(race.objectiveStats.perfectNitro,0);
});

test('all clean sectors come from real checkpoints and pickup counts match actual collected triggers',()=>{
 const race=createRace({track:'harbor',mode:'time-attack'});startRace(race);const track=getTrack(race.track);
 for(let i=0;i<120*240&&race.state==='racing';i++)stepRace(race,rivalControls(race,[race],track,race.specs,1/120),1/120);
 assert.equal(race.state,'finished');assert.equal(race.recoveries,0);
 assert.equal(race.objectiveStats.cleanSectors,36);assert.equal(race.objectiveStats.pickups,race.pickupEvent.id);
 assert.ok(race.objectiveStats.pickups>0);
 const stats={...race.objectiveStats};advance(race,{throttle:1,nitro:true},2);assert.deepEqual(race.objectiveStats,stats);
});

test('a road teleport cannot create clean checkpoint progress',()=>{
 const race=createRace({track:'harbor',mode:'time-attack'});startRace(race);const track=getTrack(race.track),p=sampleTrack(track.length/12+1,track);
 Object.assign(race.car,{x:p.x,z:p.z,yaw:Math.atan2(p.tx,p.tz)});stepRace(race,{brake:true},1/120);
 assert.equal(race.objectiveStats.cleanSectors,0);assert.equal(race._nextCheckpoint,1);
});

test('sector retries and post-finish rival motion cannot award duplicate objectives',()=>{
 const race=createRace({track:'harbor'});startRace(race);const track=getTrack(race.track);
 trackObjectiveStats(race,track,1/120);
 race._nextCheckpoint=2;trackObjectiveStats(race,track,1/120);assert.equal(race.objectiveStats.cleanSectors,1);
 race._nextCheckpoint=1;race.recoveries++;trackObjectiveStats(race,track,1/120);
 race._nextCheckpoint=2;trackObjectiveStats(race,track,1/120);assert.equal(race.objectiveStats.cleanSectors,1);
 race.state='finished';trackObjectiveStats(race,track,1/120);
 race._nextCheckpoint=3;race.pickupEvent.id++;trackObjectiveStats(race,track,1/120);
 assert.equal(race.objectiveStats.cleanSectors,1);assert.equal(race.objectiveStats.pickups,0);
});

test('clean overtakes require a moving rival, a real lead change and a clean confirmation interval',()=>{
 const race=createRace({track:'harbor'});startRace(race);const track=getTrack(race.track);race.rivals=[race.rivals[0]];
 const rival=race.rivals[0];rival.car.speed=20;rival._lapDistance=10;
 race._lapDistance=0;trackObjectiveStats(race,track,.01);
 for(let i=0;i<400;i++)trackObjectiveStats(race,track,.01);
 race._lapDistance=14;trackObjectiveStats(race,track,.01);assert.equal(race.objectiveStats.cleanOvertakes,0);
 for(let i=0;i<160;i++)trackObjectiveStats(race,track,.01);
 assert.equal(race.objectiveStats.cleanOvertakes,1);
 for(let i=0;i<400;i++)trackObjectiveStats(race,track,.01);
 assert.equal(race.objectiveStats.cleanOvertakes,1);
});
