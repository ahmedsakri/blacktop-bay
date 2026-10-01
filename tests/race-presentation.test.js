import test from 'node:test';
import assert from 'node:assert/strict';
import { getRaceProgress, getDriftDisplay } from '../src/race-presentation.js';
import { createRace, startRace, stepRace, resetCar, sampleTrack } from '../src/physics.js';
import { createCompletedRaceFixture } from '../scripts/qa-race-fixture.js';

test('completion measures all three laps, independently of the timer and one-based lap label', () => {
  const race = { state: 'racing', totalLaps: 3, completedLaps: 0, progress: .5, lap: 1, elapsed: 600 };
  assert.equal(getRaceProgress(race).percent, 16);
  race.completedLaps = 1; race.lap = 2;
  assert.equal(getRaceProgress(race).fraction, .5);
  assert.equal(getRaceProgress(race).label, '50%');
  race.elapsed = 1; race.lap = 3; race.raceProgress = 1;
  assert.equal(getRaceProgress(race).label, '50%', 'timer, lap label and an inconsistent aggregate cannot invent distance');
});

test('lap transitions do not reset total completion and only a validated finish displays 100%', () => {
  const race = { state: 'racing', totalLaps: 3, completedLaps: 0, progress: .9999 };
  const before = getRaceProgress(race);
  Object.assign(race, { completedLaps: 1, progress: .0001 });
  const after = getRaceProgress(race);
  assert.equal(before.percent, 33); assert.equal(after.percent, 33);
  assert.ok(after.fraction > before.fraction);
  Object.assign(race, { completedLaps: 2, progress: .9999 });
  assert.equal(getRaceProgress(race).percent, 99);
  race.progress = 1;
  assert.equal(getRaceProgress(race).percent, 99);
  race.state = 'finished';
  assert.equal(getRaceProgress(race).finished, false, 'a finish label cannot replace the engine lap guard');
  race.completedLaps = 3;
  assert.equal(getRaceProgress(race).label, '100%');
  assert.equal(getRaceProgress(race).fraction, 1);
});

test('missing or invalid state cannot make a negative, non-finite or premature progress display', () => {
  for (const race of [undefined, null, {}, { state: 'ready', completedLaps: 3, progress: 1 },
    { state: 'racing', completedLaps: NaN, progress: Infinity },
    { state: 'racing', completedLaps: -1, progress: -.8 },
    { state: 'racing', completedLaps: '2', progress: '.8', totalLaps: 0 }]) {
    const progress = getRaceProgress(race);
    assert.equal(progress.label, '0%');
    assert.equal(progress.fraction, 0);
    assert.equal(progress.totalLaps, 3);
  }
});

test('real reverse driving reduces displayed distance and reset/teleport cannot add completion', () => {
  const race = createRace({ track: 'harbor' }); startRace(race); race.rivals = [];
  for (let i = 0; i < 120; i++) stepRace(race, { throttle: 1 }, 1 / 120);
  const forward = getRaceProgress(race).fraction;
  assert.ok(forward > 0);
  resetCar(race);
  assert.equal(getRaceProgress(race).fraction, forward);
  race.car.yaw += Math.PI;
  race.car.vx = Math.sin(race.car.yaw) * 8; race.car.vz = Math.cos(race.car.yaw) * 8;
  for (let i = 0; i < 12; i++) stepRace(race, {}, 1 / 120);
  const backward = getRaceProgress(race).fraction;
  assert.ok(backward < forward && backward >= 0);
  const shortcut = sampleTrack(800);
  Object.assign(race.car, { x: shortcut.x, z: shortcut.z, vx: 0, vz: 0 });
  stepRace(race, {}, 1 / 120);
  assert.equal(getRaceProgress(race).fraction, backward);
  assert.equal(getRaceProgress(race).completedLaps, 0);
});

test('a real three-lap finish displays 100% while remaining opponents finish independently', () => {
  const { race } = createCompletedRaceFixture({ track: 'harbor' });
  assert.equal(race.completedLaps, 3);
  assert.deepEqual(getRaceProgress(race), { fraction: 1, percent: 100, label: '100%', completedLaps: 3, totalLaps: 3, finished: true });
  race.allFinished = false;
  assert.equal(getRaceProgress(race).percent, 100, 'opponents do not change the player completion');
});

test('drift display uses actual drift state and retains simultaneous nitro information', () => {
  const race = { raceId: 'race-display-test', state: 'racing', score: 10, driftPoints: 12.8, combo: 2,
    car: { drifting: true }, nitro: { active: true }, collision: false };
  const display = getDriftDisplay(race);
  assert.equal(display.state, 'drifting'); assert.equal(display.label, 'DRIFT');
  assert.equal(display.pendingPoints, 12); assert.equal(display.totalPoints, 22);
  assert.equal(display.combo, 2); assert.equal(display.nitroActive, true);
  race.car.drifting = false;
  assert.equal(getDriftDisplay(race).state, 'settling');
  race.driftPoints = 0;
  assert.equal(getDriftDisplay(race).state, 'nitro');
  race.nitro.active = false;
  assert.equal(getDriftDisplay(race).state, 'idle');
});

test('bank events compare copied snapshots from the same race, never restart totals', () => {
  const race = { raceId: 'race-bank-test', state: 'racing', score: 10, driftPoints: 23.9, combo: 2, car: { drifting: false } };
  const previous = getDriftDisplay(race).snapshot;
  race.score = 33; race.driftPoints = 0; race.combo = 1;
  const banked = getDriftDisplay(race, previous);
  assert.equal(previous.score, 10, 'snapshot must not follow the mutable race');
  assert.equal(banked.state, 'banked'); assert.equal(banked.bankedPoints, 23);
  assert.equal(getDriftDisplay(race, banked.snapshot).bankedPoints, 0);
  race.raceId = 'another-race';
  assert.equal(getDriftDisplay(race, previous).bankedPoints, 0);
  race.score = 0;
  assert.equal(getDriftDisplay(race, banked.snapshot).bankedPoints, 0);
});

test('collision and finish suppress stale drift signals; corrupt points never leak into text', () => {
  const race = { raceId: 'race-collision-test', state: 'racing', score: 40, driftPoints: 18, combo: 4,
    car: { drifting: true }, nitro: { active: true }, collision: true };
  const display = getDriftDisplay(race);
  assert.equal(display.state, 'collision'); assert.equal(display.pendingPoints, 0);
  assert.equal(display.combo, 1); assert.equal(display.totalPoints, 40);
  race.state = 'finished';
  assert.equal(getDriftDisplay(race).state, 'finished');
  assert.equal(getDriftDisplay(race).nitroActive, false);
  assert.equal(getDriftDisplay(race).pendingPoints, 0);
  assert.equal(getDriftDisplay({ state: 'racing', score: NaN, driftPoints: -20 }).totalPoints, 0);
  assert.equal(getDriftDisplay().state, 'idle');
});
