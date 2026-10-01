import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, startRace, stepRace, resetCar, VEHICLE_SPECS, TRACK, TRACKS, getTrack, setTrack, sampleTrack, projectOnTrack } from '../src/physics.js';
import { DEFAULT_VEHICLE_ID } from '../src/vehicles.js';
import { createCompletedRaceFixture } from '../scripts/qa-race-fixture.js';
const LAUNCH_CIRCUITS = new Set(['harbor', 'dockyard', 'coast', 'summit', 'grandprix']);

const advance = (race, input, seconds, hz = 120) => {
  for (let i = 0; i < Math.round(seconds * hz); i++) stepRace(race, input, 1 / hz);
};
function drivingRace(vehicle = DEFAULT_VEHICLE_ID, speed = 20) {
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
  assert.ok(Math.abs(boosted.nitro.charge - (boosted.nitro.capacity - .8)) < 1e-9);
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
  const race = drivingRace(DEFAULT_VEHICLE_ID, 0); race.nitro.charge = 0.4;
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
  const grip = drivingRace(DEFAULT_VEHICLE_ID, 28), drift = drivingRace(DEFAULT_VEHICLE_ID, 28);
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
  for (const vehicle of ['lamborghini-aventador', 'bugatti-veyron', 'lotus-elise']) {
    const race = drivingRace(vehicle, 0);
    advance(race, { throttle: 1 }, 0.6); speeds[vehicle] = race.car.speed;
    const turning = drivingRace(vehicle, 20), yaw = turning.car.yaw;
    advance(turning, { steer: 1, throttle: 1 }, 0.2);
    angles[vehicle] = Math.abs(turning.car.yaw - yaw);
    startRace(race);
    assert.equal(race.vehicle, vehicle);
    assert.equal(race.nitro.capacity, VEHICLE_SPECS[vehicle].nitroCapacity);
  }
  assert.ok(speeds['lotus-elise'] > speeds['lamborghini-aventador'] && speeds['bugatti-veyron'] > speeds['lamborghini-aventador']);
  assert.ok(angles['lotus-elise'] > angles['lamborghini-aventador'] && angles['lamborghini-aventador'] > angles['bugatti-veyron']);
  assert.equal(createRace({ vehicle: 'invalid' }).vehicle, DEFAULT_VEHICLE_ID);
});

test('the five original track choices remain distinct and simulations retain their own layout', () => {
  const originals = TRACKS.filter(track => LAUNCH_CIRCUITS.has(track.id));
  assert.deepEqual(originals.map(track => track.id), ['harbor', 'dockyard', 'coast', 'summit', 'grandprix']);
  assert.equal(new Set(originals.map(track => Math.round(track.length))).size, 5);
  for (const descriptor of originals) {
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

for (const descriptor of TRACKS.filter(track => LAUNCH_CIRCUITS.has(track.id))) {
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


for (const id of ['summit', 'grandprix']) {
  test(`${id} has a clear grid straight and separated, non-crossing asphalt ribbons`, () => {
    const track = getTrack(id), points = track.samples, spacing = track.length / points.length;
    const start = sampleTrack(0, track), exit = sampleTrack(35, track);
    const startTurn = Math.atan2(exit.tx * start.tz - exit.tz * start.tx, exit.tx * start.tx + exit.tz * start.tz);
    assert.ok(Math.abs(startTurn) < .065, 'the first 35m must not put the starting grid on a sharp bend');
    const orient = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    let minimumGap = Infinity, minimumRadius = Infinity;
    for (let i = 0; i < points.length; i++) {
      const before = points[(i + points.length - 1) % points.length], after = points[(i + 1) % points.length];
      const turn = Math.abs(Math.atan2(after.tx * before.tz - after.tz * before.tx, after.tx * before.tx + after.tz * before.tz));
      minimumRadius = Math.min(minimumRadius, 2 * spacing / Math.max(turn, .00001));
      for (let j = i + 2; j < points.length; j++) {
        if (i === 0 && j === points.length - 1) continue;
        const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
        assert.ok(!(orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0), 'centerline segments must not intersect');
        if (Math.min(j - i, points.length - j + i) * spacing >= 55) minimumGap = Math.min(minimumGap, Math.hypot(a.x - c.x, a.z - c.z));
      }
    }
    assert.ok(minimumGap > track.width + 20, 'non-adjacent road sections need clear verge space between barriers');
    assert.ok(minimumRadius > track.width / 2 + 7, 'inside curve ribbon must retain a positive radius');
    assert.equal(track.width, id === 'grandprix' ? 18 : 16);
  });
  test(`${id} allows the player and all rivals to complete real three-lap races`, () => {
    const { race, frames } = createCompletedRaceFixture({ track: id });
    assert.equal(race.completedLaps, 3);
    assert.equal(race.recoveries, 0);
    assert.equal(race.allFinished, true);
    assert.ok(race.leaderboard.every(row => row.finished && row.completedLaps === 3));
    assert.ok(frames.length > 1000 && frames.length < 2400);
    setTrack('harbor');
  });
}
