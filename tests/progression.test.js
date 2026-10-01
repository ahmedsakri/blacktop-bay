import test from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLES } from '../src/vehicles.js';
import { LEGACY_VEHICLES } from '../src/legacy-vehicles.js';
import {
  PROGRESSION_KEY, MAX_CREDITS, UPGRADE_COMPONENTS, UPGRADE_COSTS,
  loadProgression, buyUpgrade, awardRaceCredits, getUpgradePreview, normalizeUpgrades,
} from '../src/progression.js';

const [first, second, third] = VEHICLES.map(car => car.id);
// Fixed release IDs keep migration fixtures independent of catalogue order.
const released16Ids = ['mclaren-570s', 'mclaren-senna', 'mclaren-p1-gtr', 'ferrari-458-italia',
  'lamborghini-aventador', 'koenigsegg-one-1', 'pagani-zonda-c12', 'bugatti-veyron',
  'maserati-mc-stradale', 'lotus-elise', 'audi-r8', 'rimac-concept-one',
  'porsche-930-turbo', 'gma-t50', 'aston-martin-one-77', 'rimac-nevera'];
const released27Ids = [...released16Ids, 'porsche-911-gt3', 'lamborghini-gallardo',
  'lamborghini-huracan', 'bmw-i8', 'bmw-f22-eurofighter', 'audi-r8-lms-gt3', 'audi-r18',
  'ferrari-250-gto', 'ferrari-testarossa', 'mercedes-amg-gt', 'nissan-gt-r-2018'];
const currentSixIds = ['mclaren-650s-gt3', 'bmw-m3-e46', 'audi-quattro-rally',
  'lamborghini-countach-lp500s', 'ferrari-enzo', 'porsche-919-hybrid'];

const zero = () => ({ engine: 0, tyres: 0, nitro: 0, handling: 0 });
const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
let resultId = 0;
const result = (extra = {}) => ({ raceId: `test-finish-${++resultId}`, state: 'finished', completedLaps: 3, totalLaps: 3,
  position: 1, elapsed: 145.2, score: 0, ...extra });

test('a new garage starts with 1200 credits and only independent manufacturer car records', () => {
  const state = loadProgression(memoryStorage());
  assert.equal(state.credits, 1200);
  assert.equal(state.version, 1);
  assert.deepEqual(state.awardedRaces, []);
  assert.deepEqual(Object.keys(state.cars), VEHICLES.map(car => car.id));
  assert.deepEqual(state.cars[first], zero());
  state.cars[first].engine = 2;
  assert.equal(state.cars[second].engine, 0);
  assert.ok(VEHICLES.every(car => car.origin === 'manufacturer'));
});

for (const count of [3, 6, 10, 14, 20]) {
  test(`${count}-car legacy saves retain wallet, upgrades and receipts when current cars are purchased`, () => {
    const store = memoryStorage(), oldIds = count === 3 ? ['coupe', 'gt', 'rally'] : LEGACY_VEHICLES.slice(0, count).map(car => car.id);
    const cars = Object.fromEntries(oldIds.map((id, i) => [id, { engine: i % 6, tyres: (i + 1) % 6, nitro: (i + 2) % 6, handling: (i + 3) % 6 }]));
    const awardedRaces = [`legacy-${count}-car-receipt`];
    store.setItem(PROGRESSION_KEY, JSON.stringify({version: 1, credits: 875, cars, awardedRaces}));
    const state = loadProgression(store);
    assert.equal(state.credits, 875);
    assert.deepEqual(state.awardedRaces, awardedRaces);
    for (const id of oldIds) assert.deepEqual(state.cars[id], cars[id]);
    for (const {id} of VEHICLES) assert.deepEqual(state.cars[id], zero());
    assert.equal(Object.keys(state.cars).length, VEHICLES.length + count, 'unsaved retired records are not added');
    assert.equal(buyUpgrade(state, first, 'engine', store).ok, true);
    assert.equal(state.credits, 675);
    assert.equal(state.cars[first].engine, 1);
    const reloaded = loadProgression(store);
    assert.deepEqual(reloaded, state);
    for (const id of oldIds) assert.deepEqual(reloaded.cars[id], cars[id]);
  });
}

test('all manufacturer upgrades survive the catalogue change and race reward persistence', () => {
  const store = memoryStorage();
  const cars = Object.fromEntries([...LEGACY_VEHICLES, ...VEHICLES].map(({id}, i) => [id, {
    engine: i % 6, tyres: (i + 1) % 6, nitro: (i + 2) % 6, handling: (i + 3) % 6,
  }]));
  store.setItem(PROGRESSION_KEY, JSON.stringify({version: 1, credits: 4000, cars, awardedRaces: ['previous-paid-race']}));
  const state = loadProgression(store);
  assert.deepEqual(state.cars, cars);
  assert.equal(state.credits, 4000);
  const reward = awardRaceCredits(state, result({position: 2, score: 1000}), store);
  assert.equal(reward.credits, 700);
  assert.deepEqual(state.cars, cars);
  const reloaded = loadProgression(store);
  assert.deepEqual(reloaded, state);
  assert.equal(reloaded.awardedRaces[0], 'previous-paid-race');
});

for (const releasedIds of [released16Ids, released27Ids]) {
  test(`released ${releasedIds.length}-car saves preserve wallet, builds and receipts while additions upgrade independently`, () => {
    const additions = VEHICLES.map(car => car.id).filter(id => !releasedIds.includes(id));
    assert.equal(additions.length, VEHICLES.length - releasedIds.length);
    if (releasedIds === released27Ids) assert.deepEqual(new Set(additions), new Set(currentSixIds));
    const cars = Object.fromEntries(releasedIds.map((id, i) => [id, {
      engine: i % 6, tyres: (i + 1) % 6, nitro: (i + 2) % 6, handling: (i + 3) % 6,
    }]));
    const receipts = [`released${releasedIds.length}-first-finish`, `released${releasedIds.length}-second-finish`];
    const initialCredits = 8750;
    const store = memoryStorage(), saved = JSON.stringify({version: 1, credits: initialCredits, cars, awardedRaces: receipts});
    store.setItem(PROGRESSION_KEY, saved);
    const state = loadProgression(store);
    assert.equal(state.credits, initialCredits);
    assert.deepEqual(state.awardedRaces, receipts);
    assert.equal(Object.keys(state.cars).length, VEHICLES.length);
    for (const id of releasedIds) assert.deepEqual(state.cars[id], cars[id]);
    for (const id of additions) assert.deepEqual(state.cars[id], zero());
    assert.equal(new Set(Object.values(state.cars)).size, VEHICLES.length, 'every old and new build has its own levels');
    assert.equal(store.getItem(PROGRESSION_KEY), saved, 'loading the expansion does not rewrite a valid old save');
    assert.equal(awardRaceCredits(state, result({raceId: receipts[0]}), store).awarded, false,
      'an old receipt still prevents awarding the same finish twice');
    assert.equal(state.credits, initialCredits);

    const expectedCars = {...cars, ...Object.fromEntries(additions.map(id => [id, zero()]))};
    for (const [i, id] of additions.entries()) {
      const component = UPGRADE_COMPONENTS[i % UPGRADE_COMPONENTS.length];
      const purchase = buyUpgrade(state, id, component, store);
      assert.equal(purchase.ok, true, `${id} accepts its first upgrade`);
      assert.equal(purchase.persisted, true);
      assert.equal(purchase.cost, UPGRADE_COSTS[0]);
      expectedCars[id] = {...zero(), [component]: 1};
      const reload = loadProgression(store);
      assert.deepEqual(reload.cars, expectedCars, `${id} persists without changing any other old or new build`);
      assert.equal(reload.credits, initialCredits - (i + 1) * UPGRADE_COSTS[0]);
      assert.deepEqual(reload.awardedRaces, receipts);
    }
    const reload = loadProgression(store);
    assert.equal(reload.credits, initialCredits - additions.length * UPGRADE_COSTS[0],
      'each new first-tier upgrade spends its actual listed cost from the existing wallet');
    assert.deepEqual(reload.awardedRaces, receipts);
    assert.deepEqual(reload, state);
  });
}

test('retired and unknown car records cannot be upgraded or spend wallet credits', () => {
  const store = memoryStorage();
  const cars = Object.fromEntries(LEGACY_VEHICLES.map(({id}) => [id, {engine: 2, tyres: 1, nitro: 3, handling: 4}]));
  store.setItem(PROGRESSION_KEY, JSON.stringify({version: 1, credits: 8000, cars, awardedRaces: []}));
  const state = loadProgression(store), before = JSON.stringify(state);
  for (const id of [...LEGACY_VEHICLES.map(car => car.id), '__proto__', 'unknown-car']) {
    assert.equal(getUpgradePreview(state, id, 'engine'), null);
    assert.equal(buyUpgrade(state, id, 'engine', store).reason, 'invalid-upgrade');
  }
  assert.equal(JSON.stringify(state), before);
  assert.equal(JSON.parse(store.getItem(PROGRESSION_KEY)).credits, 8000);
});

test('storage failures and malformed records fall back safely while numeric levels stay bounded', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } };
  assert.equal(loadProgression(blocked).credits, 1200);
  for (const raw of ['null', '[]', 'broken', '{"version":7,"credits":999}']) {
    assert.equal(loadProgression({ getItem: () => raw }).credits, 1200);
  }
  const store = memoryStorage();
  store.setItem(PROGRESSION_KEY, JSON.stringify({ version: 1, credits: MAX_CREDITS + 10,
    cars: { [first]: { engine: 100, tyres: -1, nitro: '5', handling: 2.5 }, coupe: {engine: 100, tyres: -2}, unknown: {engine: 3} },
    awardedRaces: ['bad', 7, 'valid-race-123', 'valid-race-123'] }));
  const loaded = loadProgression(store);
  assert.equal(loaded.credits, MAX_CREDITS);
  assert.deepEqual(loaded.cars[first], { engine: 5, tyres: 0, nitro: 0, handling: 0 });
  assert.deepEqual(loaded.cars.coupe, { engine: 5, tyres: 0, nitro: 0, handling: 0 });
  assert.equal(loaded.cars.unknown, undefined);
  assert.deepEqual(loaded.awardedRaces, ['valid-race-123']);
  assert.deepEqual(normalizeUpgrades({ engine: Infinity, tyres: NaN, nitro: null, handling: 4 }), { engine: 0, tyres: 0, nitro: 0, handling: 4 });
});

test('purchases debit the next-tier price, improve only the chosen car/component and survive reload', () => {
  const store = memoryStorage(), state = loadProgression(store);
  const preview = getUpgradePreview(state, first, 'engine');
  assert.equal(preview.cost, 200); assert.equal(preview.affordable, true);
  assert.equal(preview.current.engine, 0); assert.equal(preview.next.engine, 1);
  assert.equal(state.cars[first].engine, 0, 'preview must not buy the item');
  assert.deepEqual(buyUpgrade(state, first, 'engine', store), { ok: true, reason: 'purchased', cost: 200, level: 1, credits: 1000, persisted: true });
  assert.equal(buyUpgrade(state, first, 'engine', store).cost, 400);
  assert.equal(buyUpgrade(state, second, 'tyres', store).cost, 200);
  assert.equal(state.credits, 400);
  assert.equal(state.cars[first].engine, 2); assert.equal(state.cars[first].tyres, 0);
  assert.equal(state.cars[second].tyres, 1); assert.equal(state.cars[third].tyres, 0);
  assert.deepEqual(loadProgression(store), state);
});

test('all five levels use the listed costs and maxed or unaffordable purchases cannot spend credits', () => {
  const store = memoryStorage(), state = loadProgression(store); state.credits = 5000;
  for (let level = 0; level < 5; level++) assert.equal(buyUpgrade(state, third, 'nitro', store).cost, UPGRADE_COSTS[level]);
  assert.equal(state.credits, 1000);
  assert.equal(getUpgradePreview(state, third, 'nitro').maxed, true);
  const before = JSON.stringify(state);
  assert.equal(buyUpgrade(state, third, 'nitro', store).reason, 'max-level');
  assert.equal(buyUpgrade(state, '__proto__', 'engine', store).reason, 'invalid-upgrade');
  assert.equal(buyUpgrade(state, first, 'unknown', store).reason, 'invalid-upgrade');
  assert.equal(JSON.stringify(state), before);
  state.credits = 199;
  assert.equal(buyUpgrade(state, first, 'engine', store).reason, 'insufficient-credits');
  assert.equal(state.credits, 199); assert.equal(state.cars[first].engine, 0);
});

test('blocked saving still permits earned session upgrades and reports lack of persistence', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const state = loadProgression(blocked);
  const purchase = buyUpgrade(state, first, 'handling', blocked);
  assert.equal(purchase.ok, true); assert.equal(purchase.persisted, false);
  assert.equal(state.cars[first].handling, 1); assert.equal(state.credits, 1000);
  const finished = result({ position: 4 });
  assert.equal(awardRaceCredits(state, finished, blocked).credits, 350);
  assert.equal(awardRaceCredits(state, finished, blocked).awarded, false);
  assert.equal(state.credits, 1350);
});

test('finish rewards respect real classification, capped drift bonus and credit ceiling', () => {
  for (const [position, expected] of [[1, 900], [2, 650], [3, 500], [4, 350]]) {
    const store = memoryStorage(), state = loadProgression(store);
    const reward = awardRaceCredits(state, result({ position, score: 4000 }), store);
    assert.equal(reward.base, expected); assert.equal(reward.driftBonus, 200);
    assert.equal(state.credits, 1200 + expected + 200);
    assert.deepEqual(loadProgression(store), state);
  }
  const state = loadProgression(null); state.credits = MAX_CREDITS - 10;
  const reward = awardRaceCredits(state, result({ score: 1_000_000 }), null);
  assert.equal(reward.driftBonus, 500); assert.equal(reward.credits, 10); assert.equal(state.credits, MAX_CREDITS);
});

test('unfinished, malformed, out-of-range and overlong races cannot mint credits', () => {
  const state = loadProgression(null), before = JSON.stringify(state);
  for (const extra of [{ state: 'racing' }, { completedLaps: 2 }, { totalLaps: 1 }, { elapsed: 901 },
    { elapsed: NaN }, { position: 0 }, { position: 5 }, { position: 1.5 }, { score: -1 },
    { score: Infinity }, { score: 2.5 }, { raceId: '' }]) {
    assert.equal(awardRaceCredits(state, result(extra), null).awarded, false);
  }
  assert.equal(JSON.stringify(state), before);
});

test('a race reward is idempotent after both an in-memory repeat and a fresh module reload', async () => {
  const store = memoryStorage(), state = loadProgression(store), finished = result();
  assert.equal(awardRaceCredits(state, finished, store).awarded, true);
  assert.equal(awardRaceCredits(state, finished, store).awarded, false);
  const fresh = await import('../src/progression.js?receipt-reload');
  const reloaded = fresh.loadProgression(store);
  assert.equal(fresh.awardRaceCredits(reloaded, { ...finished }, store).awarded, false);
  assert.equal(reloaded.credits, 2100);
  assert.equal(UPGRADE_COMPONENTS.length, 4);
});
