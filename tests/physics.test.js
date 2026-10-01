import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACK, projectOnTrack, sampleTrack } from '../src/track.js';
import { createRace, startRace, stepRace, resetCar, getUpgradeStats, setTrack } from '../src/physics.js';
import { createCompletedRaceFixture } from '../scripts/qa-race-fixture.js';
import { VEHICLES } from '../src/vehicles.js';

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
  return { steer: clamp(-error * 2.9, -1, 1), throttle: 1, brake: race.car.speed > targetSpeed + 1 };
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

test('positive steering turns driver-right and negative steering turns driver-left at every heading', () => {
  // Define screen right independently of track normals: forward × world up.
  for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI + 0.01]) {
    const right = { x: -Math.cos(yaw), z: Math.sin(yaw) };
    for (const steer of [-1, 1]) {
      const race = raceAt(110, 12);
      Object.assign(race.car, { yaw, vx: Math.sin(yaw) * 12, vz: Math.cos(yaw) * 12 });
      const start = { x: race.car.x, z: race.car.z };
      advance(race, { steer, throttle: 1 }, 0.2);
      const headingRight = Math.sin(race.car.yaw) * right.x + Math.cos(race.car.yaw) * right.z;
      const displacementRight = (race.car.x - start.x) * right.x + (race.car.z - start.z) * right.z;
      assert.ok(headingRight * steer > 0.075, `heading ${yaw}, input ${steer} must visibly turn the correct way`);
      assert.ok(displacementRight * steer > 0.015, `heading ${yaw}, input ${steer} must move the correct way`);
      assert.equal(Math.sign(race.car.steering), steer, 'animation keeps the public input sign');
      assert.equal(race.collision, false);
    }
  }
});

test('a short steering tap changes direction and settles after release without continuing a turn', () => {
  for (const steer of [-1, 1]) {
    const race = raceAt(110, 18);
    const initialYaw = race.car.yaw;
    advance(race, { steer, throttle: 1 }, 0.15);
    const tapAngle = Math.abs(wrapAngle(race.car.yaw - initialYaw));
    assert.ok(tapAngle > 0.035 && tapAngle < 0.09, 'a 150 ms tap should provide a small useful heading change');
    advance(race, { steer: 0, throttle: 1 }, 0.55);
    assert.ok(Math.abs(race.car.yawRate) < 0.025, 'turning should settle promptly after release');
    assert.ok(Math.abs(wrapAngle(race.car.yaw - initialYaw)) < 0.2, 'a short tap must remain controllable');
    assert.equal(race.collision, false);
  }
});

test('optional handbrake produces a stronger slide than progressive steering drift', () => {
  const grip = raceAt(110, 28), drift = raceAt(110, 28);
  advance(grip, { throttle: 1, steer: -0.75 }, 0.6);
  advance(drift, { throttle: 1, steer: -0.75, handbrake: true }, 0.6);
  assert.ok(Math.abs(drift.car.slipAngle) > Math.abs(grip.car.slipAngle) * 1.25);
  assert.ok(Math.abs(drift.car.slipAngle) > 0.2);
  assert.equal(drift.car.drifting, true);
  assert.equal(grip.car.drifting, false);
  assert.ok(drift.driftPoints > 0);
  assert.equal(drift.score, 0, 'a running drift is not banked immediately');
});

test('sustained fast steering progressively drifts and scores on either corner direction', () => {
  for (const [s, steer] of [[350, .75], [500, -.75]]) {
    const race = raceAt(s, 28); race.rivals = [];
    const yaw = race.car.yaw;
    advance(race, { throttle: 1, steer }, .15);
    assert.equal(race.car.drifting, false, 'turn-in must not cause an immediate slide');
    assert.ok(Math.abs(race.car.slipAngle) < .08);
    advance(race, { throttle: 1, steer }, .65);
    assert.equal(race.car.drifting, true, 'ordinary steering must activate the existing smoke/scoring signal');
    assert.ok(Math.abs(race.car.slipAngle) > .17 && Math.abs(race.car.slipAngle) < .34);
    assert.ok(Math.abs(race.car.lateralSpeed) > 5, 'slide must use real sideways velocity');
    assert.ok(race.driftPoints > 4);
    assert.ok(Math.abs(wrapAngle(race.car.yaw - yaw)) < .6, 'steering must stay controllable without a spin');
    assert.equal(race.collision, false);
    advance(race, { steer: 0, brake: true }, 1.5);
    assert.ok(race.score >= 4, 'catching the slide banks its points');
    assert.equal(race.driftPoints, 0);
    assert.equal(race.car.drifting, false);
    assert.equal(race.collision, false);
    assert.ok(Math.abs(race.car.slipAngle) < .05);
  }
});

test('slow turns, straight driving and brief fast corrections do not start automatic drifts', () => {
  for (const steer of [-1, 1]) {
    const slow = raceAt(110, 12); slow.rivals = [];
    advance(slow, { steer, throttle: 0 }, 1);
    assert.ok(slow.car.speed < 18);
    assert.equal(slow.car.drifting, false);
    assert.equal(slow.score + slow.driftPoints, 0);
    assert.ok(Math.abs(slow.car.slipAngle) < .17);
    const tap = raceAt(110, 28); tap.rivals = [];
    advance(tap, { steer, throttle: 1 }, .15);
    advance(tap, { throttle: 1 }, .4);
    assert.equal(tap.car.drifting, false);
    assert.equal(tap.score + tap.driftPoints, 0);
    assert.ok(Math.abs(tap.car.slipAngle) < .025);
  }
  for (const steer of [0, .2, -.2]) {
    const race = raceAt(110, 35); race.rivals = [];
    advance(race, { steer, throttle: 1 }, .75);
    assert.equal(race.car.drifting, false);
    assert.equal(race.score + race.driftPoints, 0);
    assert.equal(race.collision, false);
  }
});

test('all vehicle builds retain controllable automatic slides at stock and upgraded grip', () => {
  for (const vehicle of VEHICLES) for (const level of [0, 5]) {
    const race = createRace({ vehicle: vehicle.id, track: 'harbor', upgrades: { engine: level, tyres: level, nitro: level, handling: level } });
    startRace(race); race.rivals = [];
    const point = sampleTrack(350);
    Object.assign(race.car, { x: point.x, z: point.z, yaw: Math.atan2(point.tx, point.tz), vx: point.tx * 28, vz: point.tz * 28, speed: 28, forwardSpeed: 28 });
    race._lastTrackS = race._safeS = point.s; race._trackIndex = point.index;
    advance(race, { throttle: 1, steer: .8 }, .85);
    assert.equal(race.car.drifting, true, `${vehicle.id} level ${level} must drift without handbrake`);
    assert.ok(race.driftPoints > 0);
    assert.ok(Math.abs(race.car.slipAngle) < .36);
    assert.equal(race.collision, false);
  }
});

test('automatic drift permits nitro and recovery removes residual rear slip', () => {
  const race = raceAt(350, 28); race.rivals = [];
  advance(race, { throttle: 1, steer: .75, nitro: true }, .8);
  assert.equal(race.car.drifting, true);
  assert.equal(race.nitro.active, true);
  assert.ok(race.nitro.charge < race.nitro.capacity - .75);
  assert.ok(race.driftPoints > 0);
  assert.equal(race.collision, false);
  resetCar(race);
  advance(race, { throttle: 1, steer: .75 }, .2);
  assert.equal(race.car.drifting, false);
  assert.equal(race.driftPoints, 0);
  assert.ok(Math.abs(race.car.slipAngle) < .05);
});

test('automatic drift is identical across 30, 60 and 120 Hz callers', () => {
  const races = [30, 60, 120].map(hz => {
    const race = raceAt(350, 28); race.rivals = [];
    advance(race, { throttle: 1, steer: .75 }, .8, hz);
    assert.equal(race.car.drifting, true);
    return race;
  });
  for (const race of races.slice(1)) {
    for (const key of ['x', 'z', 'vx', 'vz', 'yaw', 'slipAngle']) assert.ok(Math.abs(race.car[key] - races[0].car[key]) < 1e-10);
    assert.equal(race.driftPoints, races[0].driftPoints);
  }
});

test('controlled drift points bank after straightening and braking', () => {
  const race = raceAt(110, 28);
  advance(race, { throttle: 1, steer: -0.75, handbrake: true }, 0.75);
  assert.ok(race.driftPoints > 15);
  advance(race, { throttle: 0, steer: 1, brake: true }, 1.5);
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

test('a head-on barrier impact can be steered away from either side without recovery', () => {
  const point = sampleTrack(110);
  for (const side of [-1, 1]) {
    const race = raceAt(110, 15);
    Object.assign(race.car, {
      x: point.x + point.nx * side * 6.7, z: point.z + point.nz * side * 6.7,
      yaw: Math.atan2(point.nx * side, point.nz * side),
      vx: point.nx * side * 15, vz: point.nz * side * 15,
    });
    advance(race, { throttle: 1, steer: side }, 2);
    assert.ok(race.car.speed > 7, 'holding escape steering should promptly restore useful speed');
    assert.ok(Math.abs(wrapAngle(race.car.yaw - Math.atan2(point.tx, point.tz))) < 0.3);
    advance(race, { throttle: 1 }, 0.6);
    assert.ok(projectOnTrack(race.car.x, race.car.z).distance < 6, 'releasing steering should drive back onto the road');
    assert.equal(race.recoveries, 0);
    assert.equal(race.completedLaps, 0);
    assert.equal(race.score, 0);
    assert.ok(race.progress < 0.02, 'the steering aid cannot skip checkpoints or award distance');
  }
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

test('a solo scripted driver completes all three real laps with checkpoints and stable timing', () => {
  const race = createRace(); startRace(race);
  race.rivals = []; // Isolate the original handling benchmark from passing traffic.
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

function tunedRace(upgrades = {}, speed = 20) {
  const race = createRace({ vehicle: 'coupe', track: 'harbor', upgrades }); startRace(race); race.rivals = [];
  const p = sampleTrack(110);
  Object.assign(race.car, { x: p.x, z: p.z, yaw: Math.atan2(p.tx, p.tz), vx: p.tx * speed, vz: p.tz * speed, speed, forwardSpeed: speed });
  race._lastTrackS = p.s; race._safeS = p.s; race._trackIndex = p.index;
  return race;
}

test('upgrade levels are snapshotted, validated and retained at the start without upgrading AI', () => {
  const levels = { engine: 99, tyres: -1, nitro: 5, handling: 2.5 };
  const race = createRace({ upgrades: levels }); const firstId = race.raceId;
  levels.nitro = 0;
  assert.deepEqual(race.upgrades, { engine: 5, tyres: 0, nitro: 5, handling: 0 });
  startRace(race);
  assert.notEqual(race.raceId, firstId, 'each real start has a distinct reward identity');
  assert.equal(race.upgrades.nitro, 5); assert.equal(race.nitro.capacity, 4.75);
  for (const rival of race.rivals) assert.deepEqual(rival.upgrades, { engine: 0, tyres: 0, nitro: 0, handling: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(race)), race);
  assert.equal(createRace({ vehicle: '__proto__' }).vehicle, 'coupe');
  assert.ok(Object.values(getUpgradeStats('__proto__', { engine: Infinity })).every(Number.isFinite));
});

test('each upgrade increases its speed ceiling and measured straight-road performance', () => {
  for (const component of ['engine', 'tyres', 'handling', 'nitro']) {
    const base = tunedRace({}, 40), upgraded = tunedRace({ [component]: 5 }, 40);
    const controls = { throttle: 1, nitro: component === 'nitro' };
    advance(base, controls, 0.3); advance(upgraded, controls, 0.3);
    assert.equal(base.collision, false); assert.equal(upgraded.collision, false);
    assert.ok(upgraded.car.speed > base.car.speed + 0.05, `${component} must improve measured speed, not just its displayed rating`);
    assert.ok(upgraded.specs.topSpeed > base.specs.topSpeed);
  }
  const base = tunedRace({}, 0), engine = tunedRace({ engine: 5 }, 0);
  advance(base, { throttle: 1 }, 0.7); advance(engine, { throttle: 1 }, 0.7);
  assert.ok(engine.car.speed > base.car.speed * 1.25);
});

test('tyre upgrades reduce real lateral slip and stopping distance', () => {
  const base = tunedRace({}, 24), tyres = tunedRace({ tyres: 5 }, 24);
  for (const race of [base, tyres]) {
    race.car.vx += Math.cos(race.car.yaw) * 4;
    race.car.vz -= Math.sin(race.car.yaw) * 4;
    advance(race, {}, 0.2);
  }
  assert.ok(Math.abs(tyres.car.lateralSpeed) < Math.abs(base.car.lateralSpeed) * 0.6);
  const normalBrakes = tunedRace({}, 24), upgradedBrakes = tunedRace({ tyres: 5 }, 24);
  const start = { x: normalBrakes.car.x, z: normalBrakes.car.z };
  advance(normalBrakes, { brake: true }, 0.7); advance(upgradedBrakes, { brake: true }, 0.7);
  assert.ok(Math.hypot(upgradedBrakes.car.x - start.x, upgradedBrakes.car.z - start.z)
    < Math.hypot(normalBrakes.car.x - start.x, normalBrakes.car.z - start.z) * 0.92);
});

test('handling upgrades respond to a short right tap and settle steering faster after release', () => {
  const base = tunedRace({}, 24), handling = tunedRace({ handling: 5 }, 24), yaw = base.car.yaw;
  advance(base, { throttle: 1, steer: 1 }, 0.18); advance(handling, { throttle: 1, steer: 1 }, 0.18);
  assert.ok(wrapAngle(yaw - handling.car.yaw) > wrapAngle(yaw - base.car.yaw) * 1.2);
  const before = [base.car.steering, handling.car.steering];
  advance(base, { throttle: 1 }, 0.15); advance(handling, { throttle: 1 }, 0.15);
  assert.ok(handling.car.steering / before[1] < base.car.steering / before[0]);
  assert.equal(handling.collision, false);
});

test('nitro upgrades hold more charge and recharge faster without creating free reset fuel', () => {
  const base = tunedRace({}, 24), nitro = tunedRace({ nitro: 5 }, 24);
  assert.equal(nitro.nitro.capacity, base.nitro.capacity + 1.75);
  base.nitro.charge = nitro.nitro.charge = 0;
  advance(base, { throttle: 1 }, 0.5); advance(nitro, { throttle: 1 }, 0.5);
  assert.ok(nitro.nitro.charge > base.nitro.charge * 1.3);
  const charge = nitro.nitro.charge;
  resetCar(nitro);
  assert.equal(nitro.nitro.charge, charge);
  assert.equal(nitro.upgrades.nitro, 5);
});

for (const vehicle of ['sprint', 'endurance', 'formula', 'prototype', 'hyper', 'barchetta', 'spyder']) {
  for (const track of ['harbor', 'dockyard', 'coast', 'summit', 'grandprix']) {
    test(`${vehicle} completes ${track} at both stock and maximum upgrade levels`, () => {
      const times = [];
      for (const level of [0, 5]) {
        const upgrades = { engine: level, tyres: level, nitro: level, handling: level };
        const { race } = createCompletedRaceFixture({ vehicle, track, upgrades });
        assert.equal(race.vehicle, vehicle, 'the new ID must not fall back to Apex GT');
        assert.deepEqual(race.upgrades, upgrades);
        assert.equal(race.completedLaps, 3);
        assert.equal(race.recoveries, 0);
        assert.equal(race.allFinished, true);
        assert.ok(race.leaderboard.every(row => row.finished && Number.isFinite(row.finishTime)));
        times.push(race.elapsed);
      }
      assert.ok(times[1] < times[0], 'upgrades should improve an actual complete race with the same scripted driver');
      setTrack('harbor');
    });
  }
}
