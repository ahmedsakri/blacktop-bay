import test from 'node:test';
import assert from 'node:assert/strict';
import {collisionPose} from '../src/collision-pose.js';

test('rendering consumes integrated wreck orientation without a second cosmetic tumble', () => {
  const race = {car: {yaw: .4, pitch: .8, roll: 3.1, y: 1.7},
    wreck: {phase: 'impact', heading: .1, groundY: .2, roadPitch: .05}};
  const before = structuredClone(race);
  assert.deepEqual(collisionPose(race), {yaw: 0, pitch: 0, roll: 0, lift: 0});
  const pose = collisionPose(race, {reducedMotion: true});
  assert.ok(Math.abs(race.car.yaw + pose.yaw - .1) < 1e-10);
  assert.ok(Math.abs(-race.car.pitch + pose.pitch + .05) < 1e-10);
  assert.equal(race.car.roll + pose.roll, 0);
  assert.ok(Math.abs(race.car.y + pose.lift - .2) < 1e-10);
  assert.deepEqual(race, before, 'reduced motion cannot change physical collision/recovery state');
  for (const phase of ['none', 'recovered']) {
    race.wreck.phase = phase;
    assert.deepEqual(collisionPose(race, {reducedMotion: true}), {yaw: 0, pitch: 0, roll: 0, lift: 0});
  }
});
