import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace, startRace, stepRace, resetCar, sampleTrack, getTrack} from '../src/physics.js';
import {beginWreck, stepWreckMotion, wreckSupport, WRECK_MAX_TIME} from '../src/wreck-motion.js';

function severeSideContact() {
  const race = createRace({track: 'breakwater', mode: 'time-attack'}); startRace(race);
  const track = getTrack(race.track), p = sampleTrack(110, track), lane = track.width / 2 - .952;
  Object.assign(race.car, {x: p.x + p.nx * lane, z: p.z + p.nz * lane, yaw: Math.atan2(p.tx, p.tz),
    vx: p.tx * 4 + p.nx * 42, vz: p.tz * 4 + p.nz * 42, speed: 42});
  race._safeS = race._lastTrackS = race._lapDistance = p.s; race._trackIndex = p.index;
  race._lastProgressX = race.car.x; race._lastProgressZ = race.car.z;
  stepRace(race, {}, 1 / 120);
  return race;
}

test('real severe side contact integrates an overturned body above the road, then safely retreats without awarding progress', () => {
  const race = severeSideContact(); assert.equal(race.wreck.phase, 'impact');
  const safe = race._safeS, distance = race._lapDistance, charge = race.nitro.charge;
  let overturned = false, peak = 0, contact = false;
  for (let i = 0; i < 400 && !race.recoveries; i++) {
    stepRace(race, {throttle: 1, nitro: true}, 1 / 120);
    if (race.recoveries) break;
    const support = wreckSupport(race.car.pitch, race.car.roll);
    assert.ok(race.car.y + .6 * support.up - support.radius >= race.wreck.groundY - 1e-8, 'oriented collision support cannot penetrate the road');
    assert.equal(race._safeS, safe); assert.equal(race._lapDistance, distance);
    assert.equal(race.nitro.active, false); assert.equal(race.car.drifting, false);
    assert.ok(['x', 'y', 'z', 'yaw', 'pitch', 'roll'].every(key => Number.isFinite(race.car[key])));
    peak = Math.max(peak, race.car.y); overturned ||= race.wreck.overturned; contact ||= race.wreck.contacts > 0;
  }
  assert.ok(overturned, 'an energetic lateral collision produces a real rollover');
  assert.ok(peak > 1 && peak < 3.5); assert.ok(contact);
  assert.equal(race.recoveries, 1); assert.equal(race.wreck.phase, 'recovered');
  assert.ok(race._lapDistance <= distance - 7.99); assert.equal(race.completedLaps, 0);
  assert.equal(race.score, 0); assert.equal(race.nitro.charge, charge); assert.equal(race.car.roll, 0);
});

test('pausing freezes every wreck field, reset restores the chassis, and restart cannot retain angular energy', () => {
  const race = severeSideContact(); stepRace(race, {}, .1); race.state = 'paused';
  const before = structuredClone(race);
  for (let i = 0; i < 100; i++) stepRace(race, {throttle: 1, nitro: true}, .1);
  assert.deepEqual(race, before);
  race.state = 'racing'; assert.equal(resetCar(race), true);
  assert.equal(race.car.roll, 0); assert.equal(race.car.pitch, 0); assert.equal(race.car.y, 0);
  for (const key of ['vy', 'rollRate', 'pitchRate', 'yawRate']) assert.equal(race.wreck[key], 0);
  startRace(race); assert.equal(race.wreck.phase, 'none'); assert.equal(race.wreck.id, 0);
});

test('roll direction follows contact normal and a settled wreck remains bounded while a clear recovery gap is unavailable', () => {
  for (const side of [-1, 1]) {
    const race = createRace({mode: 'time-attack'}); Object.assign(race.car, {yaw: 0, pitch: 0, roll: 0, y: 0});
    beginWreck(race, {source: 'barrier', normalSpeed: 36, contact: {nx: side, nz: 0, x: race.car.x - side, z: race.car.z}});
    assert.ok(race.wreck.rollRate * side < 0);
    for (let i = 0; i < 1200; i++) stepWreckMotion(race, {y: 0}, 1 / 120);
    assert.equal(race.wreck.remaining, 0); assert.ok(race.wreck.elapsed > WRECK_MAX_TIME);
    assert.ok(Math.abs(race.wreck.rollRate) < .03); assert.ok(Math.abs(race.wreck.pitchRate) < .03);
    assert.ok(race.car.y >= 0 && race.car.y < 2.5); assert.equal(race.completedLaps, 0);
  }
});

test('wreck trajectories and recovery are identical at 30, 60 and 120 frame updates', () => {
  const runs = [30, 60, 120].map(hz => {
    const race = severeSideContact();
    for (let i = 0; i < hz * 3.5; i++) stepRace(race, {}, 1 / hz);
    return race;
  });
  for (const race of runs) {
    assert.equal(race.recoveries, 1);
    for (const key of ['x', 'y', 'z', 'roll', 'pitch', 'yaw']) assert.ok(Math.abs(race.car[key] - runs[0].car[key]) < 1e-8);
    assert.equal(race._lapDistance, runs[0]._lapDistance);
  }
});
