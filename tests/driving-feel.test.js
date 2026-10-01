import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace, startRace, stepRace, sampleTrack, getTrack, resetCar} from '../src/physics.js';
import {rivalControls} from '../src/rivals.js';

function movingRace(s = 350, speed = 28) {
  const race = createRace({track: 'harbor', mode: 'time-attack'});
  startRace(race);
  const point = sampleTrack(s, getTrack(race.track));
  Object.assign(race.car, {x: point.x, z: point.z, yaw: Math.atan2(point.tx, point.tz),
    vx: point.tx * speed, vz: point.tz * speed, speed, forwardSpeed: speed});
  race._lastTrackS = race._safeS = point.s; race._trackIndex = point.index;
  return race;
}
const advance = (race, input, seconds) => {
  for (let frame = 0; frame < Math.round(seconds * 120); frame++) stepRace(race, input, 1 / 120);
};

test('lifting a fast steering input returns the wheel near centre without an abrupt heading snap', () => {
  const race = movingRace();
  advance(race, {steer: .75, throttle: 1}, .35);
  const wheel = race.car.steering, yaw = race.car.yaw;
  stepRace(race, {throttle: 1}, 1 / 120);
  assert.ok(race.car.steering > wheel * .8, 'release remains damped rather than snapping to zero');
  assert.ok(Math.abs(race.car.yaw - yaw) < .01);
  advance(race, {throttle: 1}, .15);
  assert.ok(Math.abs(race.car.steering) < wheel * .09, 'wheel settles fast enough for precise touch corrections');
  assert.equal(race.collision, false);
});

test('countersteering catches a real automatic slide with bounded heading and retained drive', () => {
  const catching = movingRace(), holding = movingRace();
  for (const race of [catching, holding]) {
    advance(race, {steer: .75, throttle: 1}, .8);
    assert.equal(race.car.drifting, true);
  }
  const yaw = catching.car.yaw;
  advance(catching, {steer: -.75, throttle: 1}, .2);
  advance(holding, {steer: .75, throttle: 1}, .2);
  assert.ok(Math.abs(catching.car.slipAngle) < Math.abs(holding.car.slipAngle) * .4);
  assert.ok(catching.car.steering < -.6);
  assert.ok(Math.abs(catching.car.yaw - yaw) < .1, 'catching the slide does not apply a spin impulse');
  assert.ok(catching.car.speed > 20);
  assert.equal(catching.collision, false);
});

test('engine authority returns smoothly after a crash instead of jumping when the penalty expires', () => {
  const race = movingRace(110, 10);
  race._crashPenaltyTimer = .32;
  const accelerations = [];
  for (let frame = 0; frame < 48; frame++) {
    const speed = race.car.speed;
    stepRace(race, {throttle: 1}, 1 / 120);
    accelerations.push((race.car.speed - speed) * 120);
  }
  assert.ok(accelerations[30] > accelerations[0] + 3);
  assert.ok(accelerations.slice(1).every((value, i) => Math.abs(value - accelerations[i]) < .5));
  assert.equal(race._crashPenaltyTimer, 0);
  assert.equal(race.recoveries, 0);
});

test('an opponent recovery waits for a real gap and only retreats through previously driven distance', () => {
  const race = createRace({track: 'harbor'}); startRace(race);
  const rival = race.rivals[0], track = getTrack(race.track), blocked = sampleTrack(102, track);
  rival._safeS = rival._lapDistance = 110;
  rival._nextCheckpoint = 2;
  race.car.x = blocked.x; race.car.z = blocked.z;
  const fuel = rival.nitro.charge;
  assert.equal(resetCar(rival, {reason: 'stuck', retreat: 8, occupants: [race, ...race.rivals]}), true);
  assert.ok(Math.hypot(rival.car.x - race.car.x, rival.car.z - race.car.z) >= 6.2);
  assert.ok(rival.recovery.toS <= 96);
  assert.ok(rival._lapDistance <= 96);
  assert.equal(rival.completedLaps, 0);
  assert.equal(rival.nitro.charge, fuel);
  assert.equal(rival.car.speed, 0);
});

test('a displaced opponent recovers through ordinary race stepping without skipping a checkpoint', () => {
  const race = createRace({track: 'harbor'}); startRace(race);
  const rival = race.rivals[0], savedS = rival._safeS;
  Object.assign(rival.car, {x: 5000, z: -5000, vx: 0, vz: 0, speed: 0});
  advance(race, {brake: true}, .5);
  assert.equal(rival.recoveries, 0);
  assert.equal(rival._safeS, savedS);
  assert.equal(rival.recovery.phase, 'waiting');
  for (let frame = 0; frame < 180 && !rival.recoveries; frame++) stepRace(race, {brake: true}, 1 / 120);
  assert.equal(rival.recoveries, 1);
  assert.ok(rival._lapDistance < savedS);
  assert.equal(rival._nextCheckpoint, 1);
  assert.equal(rival.completedLaps, 0);
  assert.equal(rival.finishTime, null);
  assert.ok([race, ...race.rivals].filter(other => other !== rival).every(other =>
    Math.hypot(other.car.x - rival.car.x, other.car.z - rival.car.z) >= 6.2));
});

test('inside-corner projection changes count a physically crossed gate without accepting a teleport', () => {
  function corner() {
    const race = createRace({vehicle: 'ferrari-testarossa', track: 'dockyard', mode: 'time-attack'}); startRace(race);
    // Captured from real eight-car physics: 12 cm of forward travel switches
    // adjacent nearest segments and changes centreline distance by 1.60 m.
    Object.assign(race.car, {x: 152.48090324312386, z: -28.950413306057197, yaw: -.769356294856257,
      speed: 15.026814410452507, forwardSpeed: 14.991806009991336, lateralSpeed: 1.0251360324224166,
      steering: .4995719060418824, vx: -9.692978924878757, vz: 11.482652606782084,
      yawRate: -.7145781620715103, slipAngle: .06827347721793788});
    Object.assign(race, {_lastTrackS: 382.83015371745205, _lapDistance: 382.83015371745205,
      _safeS: 382.83015371745205, _trackIndex: 109, _nextCheckpoint: 3,
      _lastProgressX: race.car.x, _lastProgressZ: race.car.z, _lane: -.08586909862697346,
      _pace: .94, _passLane: 3.2, _passTime: .85, _baseLane: -2.8, _autoDrift: 2.59e-10});
    return race;
  }
  const actual = corner(), teleported = corner();
  teleported._lastProgressX -= 6;
  for (const race of [actual, teleported]) stepRace(race,
    rivalControls(race, [race], getTrack(race.track), race.specs, 1 / 120), 1 / 120);
  assert.equal(actual._nextCheckpoint, 4, 'an inside line must not require an accidental extra lap');
  assert.equal(teleported._nextCheckpoint, 3, 'the adjacent-segment allowance requires real bounded movement');
  assert.equal(actual.completedLaps, 0);
  assert.equal(teleported.completedLaps, 0);
});
