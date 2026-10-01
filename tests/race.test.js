import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, startRace, stepRace, resetCar, VEHICLE_SPECS, TRACK, TRACKS, getTrack, setTrack, sampleTrack, projectOnTrack } from '../src/physics.js';
import { createCompletedRaceFixture } from '../scripts/qa-race-fixture.js';

const advance = (race, input, seconds, hz = 120) => {
  for (let i = 0; i < Math.round(seconds * hz); i++) stepRace(race, input, 1 / hz);
};
function drivingRace(vehicle = 'coupe', speed = 20) {
  const race = createRace({ vehicle, track: 'harbor' }); startRace(race); race.rivals = [];
  const point = sampleTrack(110, getTrack(race.track));
  Object.assign(race.car, { x: point.x, z: point.z, yaw: Math.atan2(point.tx, point.tz), speed, forwardSpeed: speed, vx: point.tx * speed, vz: point.tz * speed });
  race._lastTrackS = point.s; race._safeS = point.s; race._trackIndex = point.index;
  return race;
}

test('nitro supplies real acceleration, consumes bounded seconds and requires release after depletion', () => {
  const normal = drivingRace(), boosted = drivingRace();
  advance(normal, { throttle: 1 }, 0.8);
  advance(boosted, { throttle: 1, nitro: true }, 0.8);
  assert.ok(boosted.car.speed > normal.car.speed + 7);
  assert.ok(Math.abs(boosted.nitro.charge - 2.2) < 1e-9);
  assert.equal(boosted.nitro.active, true);
  assert.equal(boosted.car.nitroActive, true);
  boosted.nitro.charge = 0.05;
  advance(boosted, { throttle: 1, nitro: true }, 0.2);
  const depleted = boosted.nitro.charge;
  assert.equal(boosted.nitro.locked, true);
  assert.equal(boosted.nitro.active, false);
  advance(boosted, { throttle: 1, nitro: true }, 0.2);
  assert.equal(boosted.nitro.charge, depleted, 'holding an empty trigger cannot recharge into micro-boosts');
  advance(boosted, { throttle: 1 }, 0.2);
  assert.equal(boosted.nitro.locked, false);
  assert.ok(boosted.nitro.charge > depleted);
  stepRace(boosted, { throttle: 1, nitro: true }, 1 / 120);
  assert.equal(boosted.nitro.active, true);
  assert.ok(boosted.nitro.charge >= 0 && boosted.nitro.charge <= boosted.nitro.capacity);
});

test('nitro cannot be farmed at rest, consumed under brakes or refilled by recovery', () => {
  const race = drivingRace('coupe', 0); race.nitro.charge = 0.4;
  advance(race, { nitro: true }, 1);
  assert.equal(race.nitro.charge, 0.4);
  assert.equal(race.nitro.active, false);
  advance(race, {}, 1);
  assert.equal(race.nitro.charge, 0.4);
  advance(race, { throttle: 1, brake: true, nitro: true }, 1);
  assert.equal(race.nitro.charge, 0.4);
  resetCar(race);
  assert.equal(race.nitro.charge, 0.4);
});

test('clean drifting recharges nitro faster than ordinary driving without exceeding capacity', () => {
  const grip = drivingRace('coupe', 28), drift = drivingRace('coupe', 28);
  grip.nitro.charge = drift.nitro.charge = 0;
  advance(grip, { throttle: 1 }, 0.6);
  advance(drift, { throttle: 1, steer: -0.75, handbrake: true }, 0.6);
  assert.ok(drift.nitro.charge > grip.nitro.charge + 0.04);
  grip.nitro.charge = grip.nitro.capacity - 0.001;
  advance(grip, { throttle: 1 }, 0.1);
  assert.equal(grip.nitro.charge, grip.nitro.capacity);
});

test('vehicle choices preserve their tuning across start and give distinct acceleration and steering', () => {
  const speeds = {}, angles = {};
  for (const vehicle of ['coupe', 'gt', 'rally']) {
    const race = drivingRace(vehicle, 0);
    advance(race, { throttle: 1 }, 0.6); speeds[vehicle] = race.car.speed;
    const turning = drivingRace(vehicle, 20), yaw = turning.car.yaw;
    advance(turning, { steer: 1, throttle: 1 }, 0.2);
    angles[vehicle] = Math.abs(turning.car.yaw - yaw);
    startRace(race);
    assert.equal(race.vehicle, vehicle);
    assert.equal(race.nitro.capacity, VEHICLE_SPECS[vehicle].nitroCapacity);
  }
  assert.ok(speeds.gt > speeds.coupe && speeds.coupe > speeds.rally);
  assert.ok(angles.rally > angles.coupe && angles.coupe > angles.gt);
  assert.equal(createRace({ vehicle: 'invalid' }).vehicle, 'coupe');
});

test('three track choices are distinct and simulations retain their own layout', () => {
  assert.deepEqual(TRACKS.map(track => track.id), ['harbor', 'dockyard', 'coast']);
  assert.equal(new Set(TRACKS.map(track => Math.round(track.length))).size, 3);
  for (const descriptor of TRACKS) {
    const track = setTrack(descriptor.id), start = sampleTrack(0, track), end = sampleTrack(track.length, track);
    assert.equal(TRACK.id, descriptor.id);
    assert.equal(track.samples.length, 440);
    assert.ok(Math.hypot(start.x - end.x, start.z - end.z) < 1e-8);
    assert.ok(track.length > 1000 && track.length < 1700);
  }
  const harbor = createRace({ track: 'harbor' }); startRace(harbor);
  const coast = createRace({ track: 'coast' }); startRace(coast);
  advance(harbor, { throttle: 1 }, 1);
  advance(coast, { throttle: 1 }, 1);
  assert.equal(harbor.track, 'harbor');
  assert.equal(coast.track, 'coast');
  assert.ok(projectOnTrack(harbor.car.x, harbor.car.z, 0, getTrack('harbor')).distance < 2);
  assert.ok(projectOnTrack(coast.car.x, coast.car.z, 0, getTrack('coast')).distance < 2);
  setTrack('harbor');
});

test('opponents wait for the shared start and use finite physical motion without jumping ahead', () => {
  const race = createRace({ track: 'harbor' });
  const staged = JSON.stringify(race.rivals);
  advance(race, { throttle: 1 }, 1);
  assert.equal(JSON.stringify(race.rivals), staged);
  assert.equal(race.rivals.length, 3);
  assert.equal(race.position, 4);
  startRace(race);
  for (let frame = 0; frame < 120 * 8; frame++) {
    const previous = race.rivals.map(rival => ({ x: rival.car.x, z: rival.car.z }));
    stepRace(race, { brake: true }, 1 / 120);
    race.rivals.forEach((rival, i) => {
      assert.ok(Math.hypot(rival.car.x - previous[i].x, rival.car.z - previous[i].z) < 0.6);
      assert.ok([rival.car.x, rival.car.z, rival.car.yaw, rival.car.speed].every(Number.isFinite));
      assert.ok(projectOnTrack(rival.car.x, rival.car.z).distance <= 7.06);
    });
  }
  assert.ok(race.rivals.every(rival => rival.car.speed > 8 && rival.progress > 0.08));
});

test('car-to-car contact separates bodies and transfers momentum without awarding a lap', () => {
  const race = createRace({ track: 'harbor' }); startRace(race);
  const point = sampleTrack(110), rival = race.rivals[0];
  for (const [racer, s, speed] of [[race, 0, 28], [rival, 3.8, 8]]) {
    Object.assign(racer.car, { x: point.x + point.tx * s, z: point.z + point.tz * s, yaw: Math.atan2(point.tx, point.tz), vx: point.tx * speed, vz: point.tz * speed, speed });
    racer._lastTrackS = 110 + s; racer._safeS = 110 + s;
  }
  race.driftPoints = 80;
  stepRace(race, { throttle: 1 }, 1 / 120);
  assert.equal(race.collision, true);
  assert.equal(rival.collision, true);
  assert.ok(race.car.speed < 24);
  assert.ok(rival.car.speed > 12);
  assert.ok(Math.hypot(race.car.x - rival.car.x, race.car.z - rival.car.z) >= 4.19);
  assert.equal(race.driftPoints, 0);
  assert.equal(race.completedLaps, 0);
});

for (const descriptor of TRACKS) {
  test(`all AI opponents complete three real laps on ${descriptor.name}, even around a stopped player`, () => {
    const race = createRace({ track: descriptor.id }); startRace(race);
    for (let frame = 0; frame < 120 * 220 && race.rivals.some(rival => rival.state !== 'finished'); frame++) {
      stepRace(race, { brake: true }, 1 / 120);
    }
    assert.equal(race.completedLaps, 0);
    assert.equal(race.position, 4);
    assert.ok(race.rivals.every(rival => rival.completedLaps === 3 && rival.finishTime > 60 && rival.finishTime < 220));
    assert.ok(race.rivals.every(rival => rival.recoveries === 0 && rival.lapTimes.length === 3));
    const finishTimes = race.leaderboard.filter(row => row.finished).map(row => row.finishTime);
    assert.deepEqual(finishTimes, [...finishTimes].sort((a, b) => a - b));
    assert.equal(race.leaderboard.at(-1).isPlayer, true);
    setTrack('harbor');
  });
}

test('competitive fixture produces four actual finish times and freezes the classified result', () => {
  const { race, frames } = createCompletedRaceFixture({ track: 'harbor' });
  assert.equal(race.state, 'finished');
  assert.equal(race.allFinished, true);
  assert.equal(race.finishTime, race.elapsed);
  assert.equal(race.position, 1);
  assert.ok(race.clock > race.elapsed, 'opponents continue finishing while player time stays fixed');
  assert.ok(race.leaderboard.every(row => row.finished && row.completedLaps === 3));
  assert.equal(frames.at(-1).t, race.elapsed);
  assert.ok(frames.every((frame, i) => i === 0 || frame.t > frames[i - 1].t));
  const result = JSON.stringify(race);
  advance(race, { throttle: 1, nitro: true }, 1);
  assert.equal(JSON.stringify(race), result);
});
