import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_VEHICLE_ID, VEHICLES, getVehicle} from '../src/vehicles.js';
import {LEGACY_VEHICLES} from '../src/legacy-vehicles.js';
import {createRace, getUpgradeStats, VEHICLE_SPECS} from '../src/physics.js';

test('the public collection contains sixteen actual manufacturer models', () => {
  assert.equal(VEHICLES.length, 16);
  assert.equal(new Set(VEHICLES.map(car => car.id)).size, 16);
  for (const car of VEHICLES) {
    assert.ok(car.brand && car.assetId && car.origin === 'manufacturer');
    assert.equal(getVehicle(car.id), car);
    assert.equal(createRace({vehicle: car.id}).vehicle, car.id);
  }
  assert.deepEqual(Object.keys(VEHICLE_SPECS), VEHICLES.map(car => car.id));
});

test('retired or invalid saved selections resolve safely to the branded default', () => {
  assert.equal(getVehicle().id, DEFAULT_VEHICLE_ID);
  assert.equal(createRace().vehicle, DEFAULT_VEHICLE_ID);
  for (const id of [...LEGACY_VEHICLES.map(car => car.id), '__proto__', 'removed-car', null]) {
    assert.equal(getVehicle(id).id, DEFAULT_VEHICLE_ID);
    const race = createRace({vehicle: id});
    assert.equal(race.vehicle, DEFAULT_VEHICLE_ID);
    assert.ok(race.rivals.every(rival => getVehicle(rival.vehicle).id === rival.vehicle));
    assert.deepEqual(getUpgradeStats(id), getUpgradeStats(DEFAULT_VEHICLE_ID));
  }
});
