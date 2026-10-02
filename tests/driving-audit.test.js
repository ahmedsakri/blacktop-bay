import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace,startRace,resetCar,sampleTrack,getTrack} from '../src/physics.js';
import {capsuleContact} from '../src/vehicle-dynamics.js';
import {createNitro,stepNitro,interruptNitro} from '../src/nitro-system.js';
import {createNitroLatch} from '../src/player-controls.js';
import {resolveDriveControls} from '../src/driving-controls.js';
import {schoolLessonCopy,LESSONS} from '../src/driving-school.js';
import {crowdZoneLevel,spatialRivalFrames} from '../src/race-sound.js';

function atCheckpoint(){const race=startRace(createRace({mode:'race',track:'coastal'}));const road=sampleTrack(100,getTrack(race.track));race._safeS=100;race._lapDistance=100;race._nextCheckpoint=2;Object.assign(race.car,{x:road.x+road.nx*4,z:road.z+road.nz*4,y:road.y||0});return {race,road};}
test('manual reset finds a non-overlapping lane and never grants checkpoint/lap progress',()=>{
 const {race,road}=atCheckpoint(),occupant=race.rivals[0];
 Object.assign(occupant.car,{x:road.x,z:road.z,y:road.y||0,yaw:Math.atan2(road.tx,road.tz)});
 const before={distance:race._lapDistance,laps:race.completedLaps,checkpoint:race._nextCheckpoint};
 assert.equal(resetCar(race,{occupants:[occupant]}),true);assert.equal(capsuleContact(race,occupant),null);
 assert.ok(race._lapDistance<=before.distance);assert.equal(race.completedLaps,before.laps);assert.ok(race._nextCheckpoint<=before.checkpoint);
 assert.ok(race._collisionCooldown>0,'existing recovery protection remains');
});
test('manual reset waits without mutating the car or progress if every legal gap is occupied',()=>{
 const {race,road}=atCheckpoint();const blocker={state:'racing',vehicle:race.vehicle,contactShape:{radius:60,halfSegment:0,height:20},car:{x:road.x,z:road.z,y:road.y||0,yaw:0}};
 const before=structuredClone(race);assert.equal(resetCar(race,{occupants:[blocker]}),false);assert.deepEqual(race,before);
});
test('reset clearance uses height and car dimensions and does not block a separate bridge deck',()=>{
 const {race,road}=atCheckpoint(),other=race.rivals[0];Object.assign(other.car,{x:road.x,z:road.z,y:(road.y||0)+10,yaw:0});
 assert.equal(resetCar(race,{occupants:[other]}),true);assert.equal(race._safeS,100);assert.ok(Math.hypot(race.car.x-road.x,race.car.z-road.z)<1e-8);
});
function tapSession(secondAt){
 const n=createNitro(5),latch=createNitroLatch();
 for(let i=0;i<=Math.round(secondAt*120);i++){
  const physical=i<3||i===Math.round(secondAt*120);
  const control=resolveDriveControls({nitro:latch.sample(physical,true,n),nitroGesture:latch.pressId});
  stepNitro(n,control.nitro,true,1/120,control.nitroGesture);
 }
 return {n,latch};
}
test('toggle Nitro uses exactly two physical taps for Burst and Perfect, then one tap stops',()=>{
 for(const [at,mode] of [[.15,'burst'],[.45,'perfect']]){
  const {n,latch}=tapSession(at);assert.equal(n.mode,mode);assert.equal(n.event.id,2);assert.equal(latch.active,true);
  stepNitro(n,latch.sample(false,true,n),true,1/120,latch.pressId);
  stepNitro(n,latch.sample(true,true,n),true,1/120,latch.pressId);
  assert.equal(n.active,false);assert.equal(n.event.id,2,'stop is not an extra timed boost');
 }
});
test('toggle late stop, lifecycle clearing and interrupted timing cannot invent special Nitro',()=>{
 const {n,latch}=tapSession(1.2);assert.equal(n.active,false);assert.equal(n.event.id,1);
 latch.clear();stepNitro(n,latch.sample(false,true,n),true,1/120,latch.pressId);assert.equal(n.active,false);
 stepNitro(n,latch.sample(true,true,n),true,1/120,latch.pressId);interruptNitro(n);latch.sample(false,true,n);
 stepNitro(n,latch.sample(true,true,n),true,1/120,latch.pressId);assert.notEqual(n.mode,'perfect');assert.notEqual(n.mode,'burst');
});
test('physical gesture IDs are consumed once across fixed steps and brake still defeats boost',()=>{
 const n=createNitro(5);for(let i=0;i<60;i++)stepNitro(n,true,true,1/120,1);assert.equal(n.event.id,1);
 const control=resolveDriveControls({nitro:true,nitroGesture:2,brake:true});assert.equal(control.nitro,false);assert.equal(control.nitroGesture,2);
});
test('school prompts describe hold and toggle timing without changing the lesson definition',()=>{
 const perfect=LESSONS.find(l=>l.id==='perfect');assert.match(schoolLessonCopy(perfect,{}).text,/release/);
 const toggle=schoolLessonCopy(perfect,{nitroToggle:true});assert.doesNotMatch(toggle.text,/release/);assert.match(toggle.text,/tap once more to stop/);
 assert.match(schoolLessonCopy(LESSONS.find(l=>l.id==='boost'),{nitroToggle:true}).cue,/Tap/);assert.equal(schoolLessonCopy(null),null);
});
test('stereo right matches the actual driver frame through all headings, with 3D attenuation',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const listener={x:0,y:0,z:0,yaw};const right={id:'right',vehicle:'ferrari-enzo',x:-Math.cos(yaw)*10,z:Math.sin(yaw)*10,y:0,speed:20};
  assert.ok(spatialRivalFrames(listener,[right])[0].pan>0);
  assert.ok(spatialRivalFrames(listener,[{...right,x:-right.x,z:-right.z}])[0].pan<0);
  assert.ok(spatialRivalFrames(listener,[{...right,y:35}])[0].gain<spatialRivalFrames(listener,[right])[0].gain);
  assert.deepEqual(spatialRivalFrames(listener,[{...right,y:90}]),[]);
 }
});
test('crowd zones follow visible world locations, fade smoothly and stay bounded at overlaps',()=>{
 const zones=[{x:10,y:5,z:20,radius:80,strength:.4}];
 const near=crowdZoneLevel({x:10,y:5,z:20},zones);assert.equal(near,.4);
 assert.ok(crowdZoneLevel({x:45,y:5,z:20},zones)<near);assert.equal(crowdZoneLevel({x:100,y:5,z:20},zones),0);
 assert.ok(crowdZoneLevel({x:10,y:45,z:20},zones)<near);assert.equal(crowdZoneLevel({x:10,y:5,z:20},[...zones,...zones]),near);
 assert.equal(crowdZoneLevel({x:NaN,z:0},zones),0);assert.equal(crowdZoneLevel({x:0,z:0},[null,{x:NaN,z:0}]),0);
});

test('releasing brake during a latched boost is not a physical second tap or a free Perfect Nitro',()=>{
 const n=createNitro(5),latch=createNitroLatch();
 for(let i=0;i<54;i++){
  const pressed=i<3,brake=i>=36&&i<53;
  const control=resolveDriveControls({nitro:latch.sample(pressed,true,n),nitroGesture:latch.pressId,brake});
  stepNitro(n,control.nitro,!brake,1/120,control.nitroGesture);
 }
 assert.equal(n.mode,'normal');assert.equal(n.event.id,1);assert.equal(latch.pressId,1);
});
test('toggle stop decisions use the same next fixed-step timing boundary as special Nitro selection',()=>{
 const beyondBurst=tapSession(34/120);assert.equal(beyondBurst.n.active,false);assert.equal(beyondBurst.n.event.id,1);
 const beyondPerfect=tapSession(98/120);assert.equal(beyondPerfect.n.active,false);assert.equal(beyondPerfect.n.event.id,1);
});
