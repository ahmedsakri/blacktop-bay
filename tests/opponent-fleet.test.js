import test from 'node:test';
import assert from 'node:assert/strict';
import { MANUFACTURER_RIVAL_VEHICLES, resolveRivalVehicles, createOpponentFleet, opponentFleetCost } from '../src/opponent-fleet.js';
import { VEHICLES } from '../src/vehicles.js';
import { RIVAL_GRID, rivalControls } from '../src/rivals.js';
import { MANUFACTURER_ASSETS } from '../src/manufacturer-asset-manifest.js';
import { createRace, startRace, stepRace, resetCar, VEHICLE_SPECS, getTrack, projectOnTrack, sampleTrack } from '../src/physics.js';

test('the real opponent fleet stays bounded for phones and supplies seven distinct actual models', () => {
  assert.equal(new Set(MANUFACTURER_RIVAL_VEHICLES).size, 7);
  let triangles = 0, bytes = 0;
  for (const id of MANUFACTURER_RIVAL_VEHICLES) {
    const source = MANUFACTURER_ASSETS[id];
    assert.ok(source?.low, `${id} needs an actual mobile body`);
    triangles += source.variants.low.triangles;
    bytes += source.variants.low.bytes;
  }
  assert.ok(triangles <= 260_000, `opponents cost ${triangles} triangles`);
  assert.ok(bytes <= 5_000_000, `opponents download ${bytes} bytes`);
});

test('rotating fields cover the manufacturer collection without repeating the player or exceeding phone budgets', () => {
  const seen = new Set(), playerVehicle = 'mclaren-p1-gtr';
  for (let seed = 0; seed < 300; seed++) {
    const fleet = createOpponentFleet({playerVehicle, seed, mobile: true}), cost = opponentFleetCost(fleet);
    assert.equal(fleet.length, 7); assert.equal(new Set(fleet).size, 7);
    assert.ok(!fleet.includes(playerVehicle));
    assert.ok(cost.triangles <= 650_000); assert.ok(cost.bytes <= 12_000_000);
    assert.deepEqual(fleet, createOpponentFleet({playerVehicle, seed, mobile: true}));
    fleet.forEach(id => seen.add(id));
  }
  assert.deepEqual([...seen].sort(), VEHICLES.filter(car => car.id !== playerVehicle).map(car => car.id).sort());
  assert.notDeepEqual(createOpponentFleet({seed: 1}), createOpponentFleet({seed: 2}));
});

test('manufacturer opponents remain the default and retired or invalid slots fall back independently', () => {
  const defaults = RIVAL_GRID.map(grid => grid.vehicle);
  for (const invalid of [undefined, null, {}, 'rimac-nevera']) {
    assert.deepEqual(resolveRivalVehicles(invalid), defaults);
    assert.deepEqual(createRace({rivalVehicles: invalid}).rivals.map(rival => rival.vehicle), defaults);
  }
  assert.deepEqual(resolveRivalVehicles(['coupe', 'rally', 'gt']), defaults);
  const requested = ['rimac-nevera', '__proto__', 'koenigsegg-one-1', 'extra-slot'];
  const race = createRace({rivalVehicles: requested});
  assert.deepEqual(race.rivalVehicles, defaults);
  requested[0] = 'coupe';
  assert.equal(race.rivalVehicles[0], 'rimac-nevera', 'the race owns a copy of the loaded fleet');
  startRace(race);
  assert.deepEqual(race.rivals.map(rival => rival.vehicle), defaults);
});

test('starting, recovering and restarting keep each loaded body matched to its own physics', () => {
  const race = createRace({vehicle: 'mclaren-p1-gtr', track: 'harbor', rivalVehicles: MANUFACTURER_RIVAL_VEHICLES, upgrades: {engine: 2}});
  const initialId = race.raceId;
  for (let restart = 0; restart < 2; restart++) {
    startRace(race);
    assert.notEqual(race.raceId, initialId);
    assert.equal(race.upgrades.engine, 2);
    assert.deepEqual(race.rivalVehicles, [...MANUFACTURER_RIVAL_VEHICLES]);
    assert.deepEqual(race.rivals.map(rival => rival.vehicle), [...MANUFACTURER_RIVAL_VEHICLES]);
    for (const [index, rival] of race.rivals.entries()) {
      assert.equal(rival.specs.topSpeed, VEHICLE_SPECS[rival.vehicle].topSpeed);
      assert.equal(rival.nitro.capacity, VEHICLE_SPECS[rival.vehicle].nitroCapacity);
      assert.equal(rival._pace, RIVAL_GRID[index].pace);
      assert.equal(rival.state, 'racing');
      assert.equal(rival.elapsed, 0);
    }
    for (let frame = 0; frame < 120; frame++) stepRace(race, {throttle: 1}, 1 / 120);
    resetCar(race);
    assert.deepEqual(race.rivals.map(rival => rival.vehicle), [...MANUFACTURER_RIVAL_VEHICLES]);
  }
});

test('passing chooses the free side and keeps its decision independent of opponent list order', () => {
  const race = createRace({track: 'coast'}); startRace(race);
  const track = getTrack(race.track), point = sampleTrack(110, track), template = race.rivals[0];
  Object.assign(template.car, {x: point.x, z: point.z, yaw: Math.atan2(point.tx, point.tz), speed: 25});
  template._trackIndex = point.index; template._lane = 0;
  const ahead = {state: 'racing', car: {x: point.x + point.tx * 8, z: point.z + point.tz * 8, speed: 10}};
  const alongside = {state: 'racing', car: {x: point.x + point.nx * 3.2, z: point.z + point.nz * 3.2, speed: 22}};
  const first = structuredClone(template), second = structuredClone(template);
  const a = rivalControls(first, [first, ahead, alongside], track, first.specs, 1 / 120);
  const b = rivalControls(second, [alongside, ahead, second], track, second.specs, 1 / 120);
  assert.equal(first._passLane, -3.2, 'the occupied side must not be selected');
  assert.deepEqual(a, b); assert.equal(first._lane, second._lane);
  assert.ok(first._passTime > .8, 'passing commits briefly instead of oscillating between lanes');
});

for (const track of ['harbor', 'coast', 'summit']) {
  test(`the real opponent fleet completes ${track} with finite motion and no recovery teleports`, () => {
    const race = createRace({vehicle: 'mclaren-p1-gtr', track, rivalVehicles: MANUFACTURER_RIVAL_VEHICLES});
    startRace(race);
    const route = getTrack(track);
    for (let frame = 0; frame < 120 * 240 && race.rivals.some(rival => rival.state !== 'finished'); frame++) {
      const previous = race.rivals.map(rival => ({x: rival.car.x, z: rival.car.z}));
      stepRace(race, {brake: true}, 1 / 120);
      for (const [index, rival] of race.rivals.entries()) {
        assert.ok([rival.car.x, rival.car.z, rival.car.yaw, rival.car.speed].every(Number.isFinite));
        assert.ok(Math.hypot(rival.car.x - previous[index].x, rival.car.z - previous[index].z) < .8);
        assert.ok(projectOnTrack(rival.car.x, rival.car.z, rival._trackIndex, route).distance <= 7.06);
      }
    }
    for (const rival of race.rivals) {
      assert.equal(rival.completedLaps, 3);
      assert.equal(rival.recoveries, 0);
      assert.ok(rival.finishTime > 60 && rival.finishTime < 240);
      assert.equal(rival.lapTimes.length, 3);
    }
  });
}

for (const [track, difficulty, seed] of [['dockyard', 'pro', 17], ['monaco', 'pro', 91], ['neon-freight', 'relaxed', 42]]) {
  test(`a rotating seven-car ${difficulty} field completes ${track} through real checkpoints`, () => {
    const fleet = createOpponentFleet({playerVehicle: 'mclaren-p1-gtr', seed, mobile: true});
    const race = createRace({vehicle: 'mclaren-p1-gtr', track, difficulty, rivalVehicles: fleet}); startRace(race);
    for (let frame = 0; frame < 120 * 420 && race.rivals.some(rival => rival.state !== 'finished'); frame++) {
      stepRace(race, {brake: true}, 1 / 120);
    }
    for (const rival of race.rivals) {
      assert.equal(rival.completedLaps, 3, `${rival.vehicle} must reach every lap`);
      assert.equal(rival.lapTimes.length, 3);
      assert.ok(rival.lapTimes.every(time => Number.isFinite(time) && time > 0));
      assert.ok(rival.finishTime < 420);
      assert.equal(rival.recoveries, 0, `${rival.vehicle} should follow the circuit without a recovery`);
    }
    assert.equal(race.completedLaps, 0); assert.equal(race.position, 8);
  });
}
