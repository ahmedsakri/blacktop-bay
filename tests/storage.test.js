import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, loadRecords, saveResult, setSound, clearRecords } from '../src/storage.js';

function memoryStorage(initial) {
  const values = new Map(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const finished = (elapsed = 120, score = 100) => ({ state: 'finished', elapsed, score, completedLaps: 3, totalLaps: 3 });
const frames = (duration = 120, offset = 0) => [
  { t: 0, x: -125 + offset, z: -115, yaw: 2.3 },
  { t: duration / 2, x: 145 + offset, z: 65, yaw: -1.2 },
  { t: duration, x: -125 + offset, z: -115, yaw: 2.3 },
];
const defaults = { bestTime: null, bestScore: 0, ghost: [], sound: true };

test('missing storage returns documented independent defaults', () => {
  const storage = memoryStorage();
  const a = loadRecords(storage), b = loadRecords(storage);
  assert.deepEqual(a, defaults);
  a.ghost.push({});
  assert.deepEqual(b, defaults);
  assert.deepEqual(loadRecords(null), defaults);
});

test('a valid finish stores its record and a cloned replay under the stable key', () => {
  const storage = memoryStorage();
  const replay = frames();
  const result = saveResult(finished(), replay, storage);
  assert.equal(STORAGE_KEY, 'appsoverflow-coastal-racer-v1');
  assert.equal(result.bestTime, 120);
  assert.equal(result.bestScore, 100);
  assert.deepEqual(result.ghost, replay);
  replay[0].x = 999;
  assert.equal(result.ghost[0].x, -125);
  assert.deepEqual(loadRecords(storage), result);
});

test('slower and tied races keep the best ghost while updating score independently', () => {
  const storage = memoryStorage();
  saveResult(finished(120, 100), frames(120), storage);
  const slow = saveResult(finished(130, 900), frames(130, 10), storage);
  assert.equal(slow.bestTime, 120);
  assert.equal(slow.bestScore, 900);
  assert.deepEqual(slow.ghost, frames(120));
  const tie = saveResult(finished(120, 50), frames(120, 20), storage);
  assert.deepEqual(tie, slow);
});

test('a faster race replaces time and ghost without lowering the independent best score', () => {
  const storage = memoryStorage();
  saveResult(finished(120, 900), frames(120), storage);
  const result = saveResult(finished(110, 100), frames(110, 10), storage);
  assert.equal(result.bestTime, 110);
  assert.equal(result.bestScore, 900);
  assert.deepEqual(result.ghost, frames(110, 10));
});

test('unfinished, incomplete, overlong, and malformed race results cannot change records', () => {
  const storage = memoryStorage();
  const original = saveResult(finished(), frames(), storage);
  const invalid = [
    null,
    { ...finished(90, 999), state: 'racing' },
    { ...finished(90, 999), completedLaps: 2 },
    { ...finished(90, 999), totalLaps: 4 },
    finished(901, 999), finished(0, 999), finished(-1, 999), finished(NaN, 999),
    finished(90, Infinity), finished(90, -1), finished(90, 1.5), finished(90, 1_000_000_001),
  ];
  for (const race of invalid) assert.deepEqual(saveResult(race, frames(90), storage), original);
  assert.deepEqual(loadRecords(storage), original);
});

test('invalid replay data is discarded without losing a valid faster race result', () => {
  const badReplays = [
    [], [{}], null,
    [{ t: 1, x: 0, z: 0, yaw: 0 }, { t: 0, x: 0, z: 0, yaw: 0 }],
    [{ t: 0, x: 0, z: 0, yaw: 0 }, { t: 0, x: 0, z: 0, yaw: 0 }],
    [{ t: 0, x: Infinity, z: 0, yaw: 0 }, { t: 1, x: 0, z: 0, yaw: 0 }],
    [{ t: 0, x: 1001, z: 0, yaw: 0 }, { t: 1, x: 0, z: 0, yaw: 0 }],
    [{ t: 0, x: 0, z: -1001, yaw: 0 }, { t: 1, x: 0, z: 0, yaw: 0 }],
    [{ t: 0, x: 0, z: 0, yaw: 99 }, { t: 1, x: 0, z: 0, yaw: 0 }],
    [{ t: -1, x: 0, z: 0, yaw: 0 }, { t: 1, x: 0, z: 0, yaw: 0 }],
    [{ t: 0, x: 0, z: 0, yaw: 0 }, { t: 91, x: 0, z: 0, yaw: 0 }],
    [{ t: 0, x: '1', z: 0, yaw: 0 }, { t: 1, x: 0, z: 0, yaw: 0 }],
  ];
  for (const replay of badReplays) {
    const storage = memoryStorage();
    saveResult(finished(), frames(), storage);
    const result = saveResult(finished(90, 200), replay, storage);
    assert.equal(result.bestTime, 90);
    assert.equal(result.bestScore, 200);
    assert.deepEqual(result.ghost, []);
  }
});

test('the replay limit accepts 9000 samples and rejects larger recordings', () => {
  const replay = Array.from({ length: 9000 }, (_, index) => ({ t: index / 10, x: 0, z: 0, yaw: 0 }));
  const accepted = saveResult(finished(900), replay, memoryStorage());
  assert.equal(accepted.ghost.length, 9000);
  replay.push({ t: 900, x: 0, z: 0, yaw: 0 });
  const rejected = saveResult(finished(900), replay, memoryStorage());
  assert.deepEqual(rejected.ghost, []);
  assert.equal(rejected.bestTime, 900);
});

test('malformed storage cannot inject invalid records, frames, or sound values', () => {
  for (const raw of ['not json', 'null', '[]', '42', '"hello"', '{', 'x'.repeat(2_000_001)]) {
    assert.deepEqual(loadRecords(memoryStorage(raw)), defaults);
  }
  const malformed = memoryStorage(JSON.stringify({ bestTime: -5, bestScore: '100', sound: 'false', ghost: frames() }));
  assert.deepEqual(loadRecords(malformed), defaults);
  const partiallyValid = memoryStorage(JSON.stringify({ bestTime: 120, bestScore: 99, sound: false, ghost: [{ t: 0, x: null, z: 0, yaw: 0 }, { t: 1, x: 0, z: 0, yaw: 0 }] }));
  assert.deepEqual(loadRecords(partiallyValid), { bestTime: 120, bestScore: 99, ghost: [], sound: false });
});

test('blocked reads, quota failures, and absent browser storage do not throw', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(loadRecords(blocked), defaults);
  assert.equal(saveResult(finished(), frames(), blocked).bestTime, 120);
  assert.equal(setSound(false, blocked).sound, false);
  assert.deepEqual(clearRecords(blocked), {...defaults,sound:false}, 'session sound preference survives denied writes and a record reset');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('storage access denied'); } });
  try {
    assert.doesNotThrow(() => loadRecords());
    assert.doesNotThrow(() => setSound(false));
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  }
});

test('sound changes preserve records, and clearing records preserves sound preference', () => {
  const storage = memoryStorage();
  saveResult(finished(), frames(), storage);
  const muted = setSound(false, storage);
  assert.equal(muted.sound, false);
  assert.equal(muted.bestTime, 120);
  assert.equal(muted.ghost.length, 3);
  assert.deepEqual(setSound('false', storage), muted);
  const cleared = clearRecords(storage);
  assert.deepEqual(cleared, { ...defaults, sound: false });
  assert.deepEqual(loadRecords(storage), cleared);
});
