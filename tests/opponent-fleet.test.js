import test from 'node:test';
import assert from 'node:assert/strict';
import { MANUFACTURER_RIVAL_VEHICLES, resolveRivalVehicles } from '../src/opponent-fleet.js';
import { RIVAL_GRID } from '../src/rivals.js';
import { MANUFACTURER_ASSETS } from '../src/manufacturer-asset-manifest.js';
import { createRace, startRace, stepRace, resetCar, VEHICLE_SPECS, getTrack, projectOnTrack } from '../src/physics.js';

test('the real opponent fleet stays bounded for phones and supplies three distinct actual models', () => {
  assert.equal(new Set(MANUFACTURER_RIVAL_VEHICLES).size, 3);
  let triangles = 0, bytes = 0;
  for (const id of MANUFACTURER_RIVAL_VEHICLES) {
    const source = MANUFACTURER_ASSETS[id];
    assert.ok(source?.low, `${id} needs an actual mobile body`);
    triangles += source.variants.low.triangles;
    bytes += source.variants.low.bytes;
  }
  assert.ok(triangles <= 120_000, `opponents cost ${triangles} triangles`);
  assert.ok(bytes <= 3_000_000, `opponents download ${bytes} bytes`);
});

test('original opponents remain the default and invalid slots fall back independently', () => {
  const originals = RIVAL_GRID.map(grid => grid.vehicle);
  for (const invalid of [undefined, null, {}, 'rimac-nevera']) {
    assert.deepEqual(resolveRivalVehicles(invalid), originals);
    assert.deepEqual(createRace({rivalVehicles: invalid}).rivals.map(rival => rival.vehicle), originals);
  }
  const requested = ['rimac-nevera', '__proto__', 'koenigsegg-one-1', 'extra-slot'];
  const race = createRace({rivalVehicles: requested});
  assert.deepEqual(race.rivalVehicles, ['rimac-nevera', 'rally', 'koenigsegg-one-1']);
  requested[0] = 'coupe';
  assert.equal(race.rivalVehicles[0], 'rimac-nevera', 'the race owns a copy of the loaded fleet');
  startRace(race);
  assert.deepEqual(race.rivals.map(rival => rival.vehicle), ['rimac-nevera', 'rally', 'koenigsegg-one-1']);
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
