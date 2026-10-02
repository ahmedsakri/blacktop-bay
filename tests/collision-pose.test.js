import test from 'node:test';import assert from 'node:assert/strict';import {collisionPose} from '../src/collision-pose.js';
test('real engine wreck produces bounded directional accident motion and settles before reset',()=>{
 const race={car:{yaw:0},impact:{nx:1,nz:0},wreck:{phase:'impact',remaining:.35,strength:1}},before=structuredClone(race);
 const pose=collisionPose(race);assert.ok(pose.roll<-.5);assert.ok(pose.yaw>.5);assert.ok(pose.lift>0&&pose.lift<=.24);assert.deepEqual(race,before);
 for(const remaining of [.7,0]){race.wreck.remaining=remaining;for(const n of Object.values(collisionPose(race)))assert.ok(Math.abs(n)<1e-10);}
 race.wreck.remaining=.35;race.impact.nx=-1;assert.ok(collisionPose(race).roll>0);
 for(const phase of ['none','recovered','recovering']){race.wreck.phase=phase;assert.ok(Object.values(collisionPose(race)).every(n=>n===0));}
 race.wreck.phase='impact';assert.ok(Object.values(collisionPose(race,{reducedMotion:true})).every(n=>n===0));
});
