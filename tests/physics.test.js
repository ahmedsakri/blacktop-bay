import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACK, projectOnTrack, sampleTrack } from '../src/track.js';
import { createRace, startRace, stepRace, resetCar } from '../src/physics.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const advance = (race, input, seconds, hz = 120) => {
  for (let frame = 0; frame < Math.round(seconds * hz); frame++) stepRace(race, input, 1 / hz);
};
const raceAt = (s = 110, speed = 0) => {
  const race = createRace(); startRace(race);
  const point = sampleTrack(s);
  Object.assign(race.car, {
    x: point.x, z: point.z, yaw: Math.atan2(point.tx, point.tz),
    vx: point.tx * speed, vz: point.tz * speed, speed, forwardSpeed: speed,
  });
  race._lastTrackS = point.s; race._safeS = point.s; race._trackIndex = point.index;
  return race;
};

function followCircuit(race) {
  const projection = projectOnTrack(race.car.x, race.car.z);
  const aim = sampleTrack(projection.s + 10 + race.car.speed * 0.45);
  const near = sampleTrack(projection.s + 3), far = sampleTrack(projection.s + 22);
  const curvature = Math.abs(wrapAngle(Math.atan2(far.tx, far.tz) - Math.atan2(near.tx, near.tz))) / 19;
  const targetSpeed = Math.min(36, Math.sqrt(12 / Math.max(0.004, curvature)));
  const error = wrapAngle(Math.atan2(aim.x - race.car.x, aim.z - race.car.z) - race.car.yaw);
  return { steer: clamp(error * 2.9, -1, 1), throttle: 1, brake: race.car.speed > targetSpeed + 1 };
}

test('the circuit is a smooth, periodic metre-scale road with consistent normals', () => {
  assert.equal(TRACK.samples.length, 440);
  assert.equal(TRACK.width, 16);
  assert.ok(TRACK.length > 1000 && TRACK.length < 1500);
  for (const point of TRACK.samples) {
    assert.ok(Math.abs(point.x) < 170 && Math.abs(point.z) < 150);
    assert.ok(Math.abs(Math.hypot(point.tx, point.tz) - 1) < 1e-10);
    assert.ok(Math.abs(point.tx * point.nx + point.tz * point.nz) < 1e-10);
  }
  const start = sampleTrack(0), end = sampleTrack(TRACK.length), negative = sampleTrack(-5), wrapped = sampleTrack(TRACK.length - 5);
  assert.ok(Math.hypot(start.x - end.x, start.z - end.z) < 1e-9);
  assert.ok(Math.hypot(negative.x - wrapped.x, negative.z - wrapped.z) < 1e-9);
  assert.ok(Math.abs(Math.sin(TRACK.spawn.yaw) - start.tx) < 1e-10);
});

test('projection returns the correct signed side even with an unrelated search hint', () => {
  const point = sampleTrack(110);
  for (const side of [-1, 1]) {
    const projection = projectOnTrack(point.x + point.nx * 4 * side, point.z + point.nz * 4 * side, 300);
    assert.ok(Math.abs(projection.distance - 4) < 0.03);
    assert.equal(Math.sign(projection.signedDistance), side);
    assert.ok(Math.abs(projection.s - 110) < 0.1);
  }
});

test('race state is serializable, waits for a start, and accelerates under throttle', () => {
  const race = createRace();
  assert.deepEqual(JSON.parse(JSON.stringify(race)), race);
  advance(race, { throttle: 1 }, 1);
  assert.equal(race.elapsed, 0);
  startRace(race);
  advance(race, { throttle: 1 }, 1);
  assert.equal(race.state, 'racing');
  assert.ok(race.car.speed > 12 && race.car.speed < 15);
  assert.ok(Math.hypot(race.car.x - TRACK.spawn.x, race.car.z - TRACK.spawn.z) > 5);
  assert.ok(Math.abs(Math.hypot(race.velocity.x, race.velocity.z) - race.car.speed) < 1e-9);
});

test('braking stops the vehicle without creating reverse thrust', () => {
  const race = raceAt(110, 26);
  advance(race, { throttle: 1, brake: true }, 1.2);
  assert.ok(race.car.speed < 0.1);
  assert.ok(race.car.forwardSpeed >= -1e-9);
});

test('handbrake produces real lateral slip and grip steering produces far less', () => {
  const grip = raceAt(110, 28), drift = raceAt(110, 28);
  advance(grip, { throttle: 1, steer: 0.75 }, 0.6);
  advance(drift, { throttle: 1, steer: 0.75, handbrake: true }, 0.6);
  assert.ok(Math.abs(drift.car.lateralSpeed) > Math.abs(grip.car.lateralSpeed) * 2);
  assert.ok(Math.abs(drift.car.slipAngle) > 0.2);
  assert.equal(drift.car.drifting, true);
  assert.equal(grip.car.drifting, false);
  assert.ok(drift.driftPoints > 0);
  assert.equal(drift.score, 0, 'a running drift is not banked immediately');
});

test('controlled drift points bank after straightening and braking', () => {
  const race = raceAt(110, 28);
  advance(race, { throttle: 1, steer: 0.75, handbrake: true }, 0.75);
  assert.ok(race.driftPoints > 15);
  advance(race, { throttle: 0, steer: -1, brake: true }, 1.5);
  assert.ok(race.score > 15);
  assert.equal(race.driftPoints, 0);
  assert.equal(race.combo, 1);
  assert.equal(race.collision, false);
});

test('stationary wheel turning and handbraking cannot farm drift points', () => {
  const race = raceAt();
  const yaw = race.car.yaw;
  advance(race, { steer: 1, handbrake: true }, 4);
  assert.equal(race.score, 0);
  assert.equal(race.driftPoints, 0);
  assert.equal(race.car.yaw, yaw);
});

test('barriers contain the car, reduce speed, and discard an unbanked combo', () => {
  const race = raceAt(110);
  const point = sampleTrack(110);
  Object.assign(race.car, {
    x: point.x + point.nx * 6.9, z: point.z + point.nz * 6.9,
    vx: point.tx * 18 + point.nx * 18, vz: point.tz * 18 + point.nz * 18,
    yaw: Math.atan2(point.tx + point.nx, point.tz + point.nz),
  });
  race.driftPoints = 99; race.combo = 3;
  advance(race, { throttle: 1 }, 0.1);
  const projection = projectOnTrack(race.car.x, race.car.z);
  assert.ok(Math.abs(projection.signedDistance) <= 7.1);
  assert.equal(race.collision, true);
  assert.ok(race.car.speed < 18);
  assert.equal(race.driftPoints, 0);
  assert.equal(race.combo, 1);
});

test('recovery restores the last valid road position without awarding lap progress', () => {
  const race = createRace(); startRace(race);
  advance(race, { throttle: 1 }, 1);
  const progress = race.progress, elapsed = race.elapsed, safe = sampleTrack(race._safeS);
  race.score = 25; race.driftPoints = 100;
  race.car.x = 500; race.car.z = -500;
  assert.equal(resetCar(race), true);
  assert.ok(Math.hypot(race.car.x - safe.x, race.car.z - safe.z) < 1e-9);
  assert.equal(race.progress, progress);
  assert.equal(race.elapsed, elapsed);
  assert.equal(race.completedLaps, 0);
  assert.equal(race.car.speed, 0);
  assert.equal(race.score, 25);
  assert.equal(race.driftPoints, 0);
});

test('rapid start-line reversals and checkpoint teleports cannot award a lap', () => {
  const race = createRace(); startRace(race);
  const positions = [TRACK.length - 0.3, 0.3];
  for (let i = 0; i < 100; i++) {
    const point = sampleTrack(positions[i % 2]);
    Object.assign(race.car, { x: point.x, z: point.z, vx: 0, vz: 0 });
    stepRace(race, {}, 1 / 120);
  }
  for (let checkpoint = 1; checkpoint <= 12; checkpoint++) {
    const point = sampleTrack(checkpoint * TRACK.length / 12 + 0.1);
    Object.assign(race.car, { x: point.x, z: point.z, vx: 0, vz: 0 });
    stepRace(race, {}, 1 / 120);
  }
  assert.equal(race.completedLaps, 0);
  assert.equal(race.lapTimes.length, 0);
  assert.ok(race.progress < 0.01);
});

test('a full circuit travelled backwards cannot count as a lap', () => {
  const race = createRace(); startRace(race);
  for (let distance = 0.7; distance < TRACK.length + 1; distance += 0.7) {
    const point = sampleTrack(-distance);
    Object.assign(race.car, { x: point.x, z: point.z, yaw: Math.atan2(-point.tx, -point.tz), vx: 0, vz: 0 });
    stepRace(race, {}, 1 / 120);
  }
  assert.equal(race.completedLaps, 0);
  assert.equal(race._nextCheckpoint, 1);
  assert.equal(race.progress, 0);
});

test('fixed steps produce identical handling at 30, 60, and 120 updates per second', () => {
  const races = [30, 60, 120].map((hz) => {
    const race = raceAt(110, 20);
    advance(race, { throttle: 1, steer: 0.3, handbrake: true }, 0.5, hz);
    return race;
  });
  for (const race of races.slice(1)) {
    for (const field of ['x', 'z', 'vx', 'vz', 'yaw', 'speed']) assert.ok(Math.abs(race.car[field] - races[0].car[field]) < 1e-10, field);
    assert.equal(race.driftPoints, races[0].driftPoints);
  }
});

test('invalid inputs and large frame gaps remain finite and bound catch-up work', () => {
  const race = raceAt();
  stepRace(race, { steer: Infinity, throttle: NaN }, NaN);
  assert.equal(race.elapsed, 0);
  stepRace(race, { steer: Infinity, throttle: 50 }, 30);
  assert.ok(race.elapsed <= 0.10001);
  for (let frame = 0; frame < 3000; frame++) {
    stepRace(race, { throttle: 1, steer: Math.sin(frame * 0.17), handbrake: frame % 180 < 50 }, 1 / 120);
    for (const field of ['x', 'z', 'vx', 'vz', 'yaw', 'speed']) assert.ok(Number.isFinite(race.car[field]), field);
    assert.ok(projectOnTrack(race.car.x, race.car.z).distance < 7.2);
  }
});

test('a scripted driver completes all three real laps with checkpoints and stable timing', () => {
  const race = createRace(); startRace(race);
  let collisions = 0;
  for (let frame = 0; frame < 120 * 190 && race.state === 'racing'; frame++) {
    stepRace(race, followCircuit(race), 1 / 120);
    if (race.collision) collisions++;
  }
  assert.equal(race.state, 'finished');
  assert.equal(race.completedLaps, 3);
  assert.equal(race.lap, 3);
  assert.equal(race.lapTimes.length, 3);
  assert.equal(race.bestLap, Math.min(...race.lapTimes));
  assert.ok(Math.abs(race.elapsed - race.lapTimes.reduce((sum, lap) => sum + lap, 0)) < 1e-7);
  assert.ok(race.elapsed > 100 && race.elapsed < 180);
  assert.equal(collisions, 0, 'the full circuit should be drivable without wall contact');
  assert.equal(race.progress, 1);
  assert.equal(race.raceProgress, 1);
  const finished = JSON.stringify(race);
  advance(race, { throttle: 1, steer: 1 }, 1);
  assert.equal(JSON.stringify(race), finished);
  assert.equal(resetCar(race), false);
});
