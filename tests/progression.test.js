import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROGRESSION_KEY, MAX_CREDITS, UPGRADE_COMPONENTS, UPGRADE_COSTS,
  loadProgression, buyUpgrade, awardRaceCredits, getUpgradePreview, normalizeUpgrades,
} from '../src/progression.js';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
let resultId = 0;
const result = (extra = {}) => ({ raceId: `test-finish-${++resultId}`, state: 'finished', completedLaps: 3, totalLaps: 3,
  position: 1, elapsed: 145.2, score: 0, ...extra });

test('a new garage starts with 1200 credits and independent zero-level cars', () => {
  const state = loadProgression(memoryStorage());
  assert.equal(state.credits, 1200);
  assert.equal(state.version, 1);
  assert.deepEqual(state.awardedRaces, []);
  assert.deepEqual(Object.keys(state.cars), ['coupe', 'sprint', 'gt', 'endurance', 'rally', 'formula']);
  assert.deepEqual(state.cars.coupe, { engine: 0, tyres: 0, nitro: 0, handling: 0 });
  state.cars.coupe.engine = 2;
  assert.equal(state.cars.gt.engine, 0);
});

test('existing three-car progress migrates without losing credits, levels or reward receipts', () => {
  const store = memoryStorage();
  const previous = { version: 1, credits: 875, cars: {
    coupe: { engine: 3, tyres: 2, nitro: 1, handling: 4 },
    gt: { engine: 5, tyres: 0, nitro: 2, handling: 0 },
    rally: { engine: 1, tyres: 1, nitro: 1, handling: 1 },
  }, awardedRaces: ['legacy-race-paid-123'] };
  store.setItem(PROGRESSION_KEY, JSON.stringify(previous));
  const migrated = loadProgression(store);
  assert.equal(migrated.credits, 875);
  assert.deepEqual(migrated.awardedRaces, previous.awardedRaces);
  for (const id of ['coupe', 'gt', 'rally']) assert.deepEqual(migrated.cars[id], previous.cars[id]);
  for (const id of ['sprint', 'endurance', 'formula']) {
    assert.deepEqual(migrated.cars[id], { engine: 0, tyres: 0, nitro: 0, handling: 0 });
    assert.equal(buyUpgrade(migrated, id, 'engine', store).ok, true);
  }
  assert.equal(migrated.credits, 275);
  const reloaded = loadProgression(store);
  assert.deepEqual(reloaded, migrated);
  for (const id of ['sprint', 'endurance', 'formula']) assert.equal(reloaded.cars[id].engine, 1);
  for (const id of ['coupe', 'gt', 'rally']) assert.deepEqual(reloaded.cars[id], previous.cars[id]);
});

test('storage failures and malformed records fall back safely while numeric levels stay bounded', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } };
  assert.equal(loadProgression(blocked).credits, 1200);
  for (const raw of ['null', '[]', 'broken', '{"version":7,"credits":999}']) {
    assert.equal(loadProgression({ getItem: () => raw }).credits, 1200);
  }
  const store = memoryStorage();
  store.setItem(PROGRESSION_KEY, JSON.stringify({ version: 1, credits: MAX_CREDITS + 10,
    cars: { coupe: { engine: 100, tyres: -1, nitro: '5', handling: 2.5 } }, awardedRaces: ['bad', 7, 'valid-race-123', 'valid-race-123'] }));
  const loaded = loadProgression(store);
  assert.equal(loaded.credits, MAX_CREDITS);
  assert.deepEqual(loaded.cars.coupe, { engine: 5, tyres: 0, nitro: 0, handling: 0 });
  assert.deepEqual(loaded.awardedRaces, ['valid-race-123']);
  assert.deepEqual(normalizeUpgrades({ engine: Infinity, tyres: NaN, nitro: null, handling: 4 }), { engine: 0, tyres: 0, nitro: 0, handling: 4 });
});

test('purchases debit the next-tier price, improve only the chosen car/component and survive reload', () => {
  const store = memoryStorage(), state = loadProgression(store);
  const preview = getUpgradePreview(state, 'coupe', 'engine');
  assert.equal(preview.cost, 200); assert.equal(preview.affordable, true);
  assert.equal(preview.current.engine, 0); assert.equal(preview.next.engine, 1);
  assert.equal(state.cars.coupe.engine, 0, 'preview must not buy the item');
  assert.deepEqual(buyUpgrade(state, 'coupe', 'engine', store), { ok: true, reason: 'purchased', cost: 200, level: 1, credits: 1000, persisted: true });
  assert.equal(buyUpgrade(state, 'coupe', 'engine', store).cost, 400);
  assert.equal(buyUpgrade(state, 'gt', 'tyres', store).cost, 200);
  assert.equal(state.credits, 400);
  assert.equal(state.cars.coupe.engine, 2); assert.equal(state.cars.coupe.tyres, 0);
  assert.equal(state.cars.gt.tyres, 1); assert.equal(state.cars.rally.tyres, 0);
  assert.deepEqual(loadProgression(store), state);
});

test('all five levels use the listed costs and maxed or unaffordable purchases cannot spend credits', () => {
  const store = memoryStorage(), state = loadProgression(store); state.credits = 5000;
  for (let level = 0; level < 5; level++) assert.equal(buyUpgrade(state, 'rally', 'nitro', store).cost, UPGRADE_COSTS[level]);
  assert.equal(state.credits, 1000);
  assert.equal(getUpgradePreview(state, 'rally', 'nitro').maxed, true);
  const before = JSON.stringify(state);
  assert.equal(buyUpgrade(state, 'rally', 'nitro', store).reason, 'max-level');
  assert.equal(buyUpgrade(state, '__proto__', 'engine', store).reason, 'invalid-upgrade');
  assert.equal(buyUpgrade(state, 'coupe', 'unknown', store).reason, 'invalid-upgrade');
  assert.equal(JSON.stringify(state), before);
  state.credits = 199;
  assert.equal(buyUpgrade(state, 'coupe', 'engine', store).reason, 'insufficient-credits');
  assert.equal(state.credits, 199); assert.equal(state.cars.coupe.engine, 0);
});

test('blocked saving still permits earned session upgrades and reports lack of persistence', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const state = loadProgression(blocked);
  const purchase = buyUpgrade(state, 'coupe', 'handling', blocked);
  assert.equal(purchase.ok, true); assert.equal(purchase.persisted, false);
  assert.equal(state.cars.coupe.handling, 1); assert.equal(state.credits, 1000);
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
