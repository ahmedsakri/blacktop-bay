import test from 'node:test';
import assert from 'node:assert/strict';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { BoundedKTX2Loader } from '../src/bounded-ktx2-loader.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function clock() {
  let next = 0;
  const timers = new Map();
  return {
    timers,
    setTimeout(fn, delay) { const id = ++next; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    expire() { for (const [id, { fn }] of [...timers]) if (timers.delete(id)) fn(); },
  };
}
class FakeWorker {
  listeners = new Map();
  sent = [];
  terminations = 0;
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener); this.listeners.set(type, list);
  }
  postMessage(message) { this.sent.push(message); }
  terminate() { this.terminations++; }
  emit(type, fields = {}) {
    const event = { ...fields, stopped: false, prevented: false, stopImmediatePropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
    for (const listener of this.listeners.get(type) || []) {
      listener(event);
      if (event.stopped) break;
    }
    return event;
  }
}
function harness(t, { initialization = Promise.resolve(), textureOperation, onFailure } = {}) {
  const time = clock(), workers = [], failures = [], revoked = [];
  let initCalls = 0, disposeCalls = 0, textureCalls = 0;
  t.mock.method(URL, 'revokeObjectURL', value => revoked.push(value));
  t.mock.method(KTX2Loader.prototype, 'init', function () {
    if (!this.transcoderPending) {
      initCalls++;
      this.transcoderPending = initialization.then(() => {
        this.workerSourceURL = 'blob:bounded-test';
        this.transcoderBinary = new ArrayBuffer(1);
        this.workerPool.setWorkerCreator(() => {
          const worker = new FakeWorker(); workers.push(worker);
          worker.postMessage({ type: 'init' });
          return worker;
        });
      });
    }
    return this.transcoderPending;
  });
  t.mock.method(KTX2Loader.prototype, '_createTexture', function (buffer) {
    textureCalls++;
    if (textureOperation) return textureOperation.call(this, buffer);
    return this.init().then(() => this.workerPool.postMessage({ type: 'transcode', buffer }, [])).then(event => {
      if (event.data.type === 'error') throw new Error(event.data.error);
      return event.data.texture;
    });
  });
  t.mock.method(KTX2Loader.prototype, 'dispose', function () {
    disposeCalls++;
    this.workerPool.dispose();
    if (this.workerSourceURL) URL.revokeObjectURL(this.workerSourceURL);
  });
  const loader = new BoundedKTX2Loader(undefined, { timeoutMs: 20, setTimeout: time.setTimeout, clearTimeout: time.clearTimeout, onFailure(error) { failures.push(error); onFailure?.(error); } });
  loader.workerConfig = {};
  return { loader, time, workers, failures, revoked, counts: () => ({ initCalls, disposeCalls, textureCalls }) };
}

// These tests use Three's real WorkerPool, replacing only external asset fetches,
// decoder output and browser Worker transport. Queuing and wrapper behavior are real.
test('worker and deadline bounds cannot be raised by callers', () => {
  const loader = new BoundedKTX2Loader(undefined, { timeoutMs: 60_000 });
  assert.equal(loader.timeoutMs, 15_000);
  assert.equal(loader.workerPool.pool, 2);
  assert.equal(loader.setWorkerLimit(40), loader);
  assert.equal(loader.workerPool.pool, 2);
  loader.setWorkerLimit(0);
  assert.equal(loader.workerPool.pool, 1);
  loader.dispose();
});

test('successful parses preserve callbacks, cache a buffer and drain the real two-worker queue', async t => {
  const h = harness(t), buffer = new ArrayBuffer(1), seen = [];
  const a = h.loader.parse(buffer, texture => seen.push(texture));
  const same = h.loader.parse(buffer, texture => seen.push(texture));
  const b = h.loader._createTexture(new ArrayBuffer(1));
  const c = h.loader._createTexture(new ArrayBuffer(1));
  await flush();
  assert.equal(h.workers.length, 2);
  assert.equal(h.loader.workerPool.queue.length, 1);
  assert.equal(h.counts().textureCalls, 3);
  const textures = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  h.workers[0].emit('message', { data: { type: 'transcode', texture: textures[0] } });
  assert.equal(h.loader.workerPool.queue.length, 0);
  h.workers[1].emit('message', { data: { type: 'transcode', texture: textures[1] } });
  h.workers[0].emit('message', { data: { type: 'transcode', texture: textures[2] } });
  assert.deepEqual(await Promise.all([a, same, b, c]), [textures[0], textures[0], textures[1], textures[2]]);
  assert.deepEqual(seen, [textures[0], textures[0]]);
  assert.equal(h.loader.failure, null);
  assert.equal(h.time.timers.size, 0);
  h.loader.dispose(); h.loader.dispose();
  assert.equal(h.counts().disposeCalls, 1);
  assert.deepEqual(h.workers.map(worker => worker.terminations), [1, 1]);
  assert.deepEqual(h.failures, []);
});

test('initialization rejection immediately rejects every texture and is permanent', async t => {
  const setup = deferred(), h = harness(t, { initialization: setup.promise });
  const pending = [1, 2, 3].map(() => h.loader._createTexture(new ArrayBuffer(1)));
  const outcomes = Promise.allSettled(pending);
  const reason = new Error('WASM initialization denied by policy');
  setup.reject(reason);
  assert.ok((await outcomes).every(item => item.status === 'rejected' && item.reason === reason));
  assert.equal(h.loader.failure, reason);
  assert.equal(h.failures.length, 1);
  assert.equal(h.time.timers.size, 0);
  assert.equal(h.workers.length, 0);
  await assert.rejects(h.loader._createTexture(new ArrayBuffer(1)), error => error === reason);
  await assert.rejects(h.loader.init(), error => error === reason);
  assert.deepEqual(h.counts(), { initCalls: 1, disposeCalls: 1, textureCalls: 3 });
});

test('stalled workers reject active and queued textures at the deadline and release every pool slot', async t => {
  const h = harness(t, { onFailure() { throw new Error('telemetry callback failed'); } });
  const outcomes = Promise.allSettled([1, 2, 3, 4].map(() => h.loader._createTexture(new ArrayBuffer(1))));
  await flush();
  assert.equal(h.loader.workerPool.queue.length, 2);
  h.time.expire();
  assert.ok((await outcomes).every(item => item.status === 'rejected' && item.reason === h.loader.failure));
  assert.match(h.loader.failure.message, /deadline/);
  assert.deepEqual(h.workers.map(worker => worker.terminations), [1, 1]);
  assert.equal(h.loader.workerPool.workers.length, 0);
  assert.equal(h.loader.workerPool.workerStatus, 0);
  assert.equal(h.loader.workerPool.queue.length, 0);
  assert.equal(h.time.timers.size, 0);
  assert.equal(h.failures.length, 1);
  h.loader.dispose();
  assert.equal(h.counts().disposeCalls, 1);
});

for (const eventType of ['error', 'messageerror', 'basis-init-error']) {
  test(`${eventType} rejects the entire batch before WorkerPool can reuse a failed worker`, async t => {
    const h = harness(t);
    const outcomes = Promise.allSettled([1, 2, 3].map(() => h.loader._createTexture(new ArrayBuffer(1))));
    await flush();
    const originalMessages = h.workers[0].sent.length;
    const event = h.workers[0].emit(eventType === 'basis-init-error' ? 'message' : eventType, eventType === 'basis-init-error'
      ? { data: { type: eventType, error: 'decoder unavailable' } }
      : { message: 'decoder unavailable' });
    assert.equal(event.stopped, true);
    assert.equal(h.workers[0].sent.length, originalMessages);
    assert.ok((await outcomes).every(item => item.status === 'rejected'));
    assert.match(h.loader.failure.message, /decoder unavailable/);
    assert.deepEqual(h.workers.map(worker => worker.terminations), [1, 1]);
    assert.equal(h.loader.workerPool.queue.length, 0);
    assert.equal(h.failures.length, 1);
  });
}

test('a decoder rejection fails concurrent textures and calls the parse error callback', async t => {
  const h = harness(t), errors = [];
  const parsed = h.loader.parse(new ArrayBuffer(1), () => assert.fail('must not succeed'), error => errors.push(error));
  const other = h.loader._createTexture(new ArrayBuffer(1));
  const outcome = Promise.allSettled([parsed, other]);
  await flush();
  h.workers[0].emit('message', { data: { type: 'error', error: 'invalid compressed texture' } });
  const results = await outcome;
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(errors[0], h.loader.failure);
  assert.equal(h.failures.length, 1);
  assert.equal(h.time.timers.size, 0);
});

test('a late unclaimed texture is disposed once after the deadline', async t => {
  const work = deferred(), h = harness(t, { textureOperation: () => work.promise });
  const outcome = Promise.allSettled([h.loader._createTexture(new ArrayBuffer(1))]);
  h.time.expire();
  assert.equal((await outcome)[0].status, 'rejected');
  let disposed = 0;
  work.resolve({ dispose() { disposed++; } });
  await flush();
  assert.equal(disposed, 1);
  assert.equal(h.counts().disposeCalls, 0, 'uninitialized base loader must not decrement Three active-loader counter');
});

test('fetch completion after timeout revokes late Blob resources without creating workers or disposing the base twice', async t => {
  const setup = deferred(), h = harness(t, { initialization: setup.promise });
  const outcome = Promise.allSettled([h.loader._createTexture(new ArrayBuffer(1))]);
  h.time.expire();
  assert.equal((await outcome)[0].status, 'rejected');
  assert.equal(h.counts().disposeCalls, 1);
  setup.resolve();
  await flush();
  assert.equal(h.workers.length, 0);
  assert.deepEqual(h.revoked, ['blob:bounded-test']);
  assert.equal(h.loader.workerSourceURL, '');
  assert.equal(h.loader.transcoderBinary, null);
  assert.equal(h.loader.workerPool.workerCreator, null);
  assert.equal(h.counts().disposeCalls, 1);
  assert.equal(h.time.timers.size, 0);
});

test('direct init is bounded and an explicitly disposed unused loader never initializes', async t => {
  const setup = deferred(), h = harness(t, { initialization: setup.promise });
  const outcome = Promise.allSettled([h.loader.init()]);
  h.time.expire();
  assert.equal((await outcome)[0].status, 'rejected');
  await assert.rejects(h.loader.init(), /deadline/);
  assert.equal(h.counts().initCalls, 1);
  const unused = new BoundedKTX2Loader();
  unused.dispose(); unused.dispose();
  await assert.rejects(unused.init(), /disposed/);
  assert.equal(h.counts().disposeCalls, 1);
});

test('synchronous decoder exceptions are reported without leaking a deadline', async t => {
  const h = harness(t, { textureOperation() { throw new Error('bad container'); } });
  await assert.rejects(h.loader._createTexture(new ArrayBuffer(1)), /bad container/);
  assert.equal(h.time.timers.size, 0);
  assert.equal(h.failures.length, 1);
});


test('a permanently failed loader rejects loadAsync before making another request', async t => {
  let requests = 0;
  t.mock.method(KTX2Loader.prototype, 'load', () => { requests++; });
  const loader = new BoundedKTX2Loader();
  loader.dispose();
  await assert.rejects(loader.loadAsync('/unused.ktx2'), /disposed/);
  assert.equal(requests, 0);
});

test('the actual Three parser rejects a malformed container through the bounded public API', async () => {
  const loader = new BoundedKTX2Loader();
  loader.workerConfig = {};
  await assert.rejects(loader.parse(new ArrayBuffer(12)), /identifier|KTX|bounds/i);
  assert.ok(loader.failure instanceof Error);
  assert.equal(loader._pending.size, 0);
  assert.equal(loader.transcoderPending, null);
  loader.dispose();
});

test('host timer scheduling failure becomes a visible permanent decoder failure', async () => {
  const failure = new Error('host timer unavailable'), notices = [];
  const loader = new BoundedKTX2Loader(undefined, { setTimeout() { throw failure; }, onFailure: error => notices.push(error) });
  loader.workerConfig = {};
  await assert.rejects(loader.parse(new ArrayBuffer(12)), error => error === failure);
  assert.equal(loader.failure, failure);
  assert.deepEqual(notices, [failure]);
  assert.equal(loader._pending.size, 0);
});

test('actual P1 KTX blob loads through browser-bound timers, Three parser/init/worker code and strict no-eval Basis', async t => {
  const { readFile } = await import('node:fs/promises');
  const vm = await import('node:vm');
  const { BASIS_TRANSCODER } = await import('../src/basis-transcoder-manifest.js');
  const { MANUFACTURER_COMPRESSED_ASSETS } = await import('../src/manufacturer-compressed-manifest.js');
  const read = path => readFile(new URL('../' + path, import.meta.url));
  const glb = await read('public' + MANUFACTURER_COMPRESSED_ASSETS['mclaren-p1-gtr'].path);
  const jsonLength = glb.readUInt32LE(12), gltf = JSON.parse(glb.subarray(20, 20 + jsonLength));
  const view = gltf.bufferViews[gltf.images[0].bufferView], binOffset = 28 + jsonLength;
  const image = glb.subarray(binOffset + (view.byteOffset || 0), binOffset + (view.byteOffset || 0) + view.byteLength);
  const assets = new Map([
    ['https://decoder.test/basis_transcoder.js', await read('public' + BASIS_TRANSCODER.path + 'basis_transcoder.js')],
    ['https://decoder.test/basis_transcoder.wasm', await read('public' + BASIS_TRANSCODER.path + 'basis_transcoder.wasm')],
  ]);
  const originalFetch = globalThis.fetch, originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  const requested = [], workers = [];
  let schedules = 0, cancellations = 0;
  // Emulate Window's receiver check, which Node's native timers do not enforce.
  t.mock.method(globalThis, 'setTimeout', function (...args) {
    assert.equal(this, globalThis, 'native Window.setTimeout requires the Window receiver');
    schedules++;
    return originalSet.apply(globalThis, args);
  });
  t.mock.method(globalThis, 'clearTimeout', function (...args) {
    assert.equal(this, globalThis, 'native Window.clearTimeout requires the Window receiver');
    cancellations++;
    return originalClear.apply(globalThis, args);
  });
  t.mock.method(globalThis, 'fetch', async input => {
    const url = typeof input === 'string' ? input : input.url;
    requested.push(url);
    if (assets.has(url)) return new Response(assets.get(url));
    return originalFetch(input);
  });
  const previousProgressEvent = globalThis.ProgressEvent, previousWorker = globalThis.Worker;
  globalThis.ProgressEvent = class { constructor(type, fields) { this.type = type; Object.assign(this, fields); } };
  // Only browser transport is emulated. Run Three's actual generated worker and
  // the shipping JS/WASM pair with dynamic JavaScript generation prohibited.
  globalThis.Worker = class extends FakeWorker {
    constructor(url) {
      super(); workers.push(this);
      this.handlers = [];
      this.ready = originalFetch(url).then(response => response.text()).then(source => {
        const self = {
          location: { href: url },
          addEventListener: (type, handler) => { if (type === 'message') this.handlers.push(handler); },
          postMessage: data => queueMicrotask(() => this.emit('message', { data })),
        };
        this.context = vm.createContext({ self, importScripts() {}, console }, { codeGeneration: { strings: false, wasm: true } });
        vm.runInContext(source, this.context, { filename: 'actual-ktx2-worker.js' });
      });
    }
    postMessage(data) {
      this.sent.push(data);
      this.ready.then(() => this.handlers.forEach(handler => handler({ data }))).catch(error => this.emit('error', { error }));
    }
  };
  const restore = () => {
    if (previousProgressEvent === undefined) delete globalThis.ProgressEvent; else globalThis.ProgressEvent = previousProgressEvent;
    if (previousWorker === undefined) delete globalThis.Worker; else globalThis.Worker = previousWorker;
  };
  t.after(restore);
  const url = URL.createObjectURL(new Blob([image], { type: 'image/ktx2' }));
  const loader = new BoundedKTX2Loader().setTranscoderPath('https://decoder.test/');
  loader.workerConfig = { astcSupported: false, astcHDRSupported: false, etc1Supported: false, etc2Supported: false, dxtSupported: true, bptcSupported: true, pvrtcSupported: false };
  let texture;
  try {
    texture = await loader.loadAsync(url);
    assert.equal(loader.failure, null);
    assert.equal(texture.isCompressedTexture, true);
    assert.ok(texture.image.width > 0 && texture.image.height > 0);
    assert.ok(texture.mipmaps.length > 1);
    assert.ok(texture.mipmaps[0].data.some(byte => byte !== 0));
    assert.ok(requested.includes('https://decoder.test/basis_transcoder.js'));
    assert.ok(requested.includes('https://decoder.test/basis_transcoder.wasm'));
    assert.equal(workers.length, 1);
    assert.deepEqual(workers[0].sent.map(message => message.type), ['init', 'transcode']);
    assert.ok(schedules >= 2);
    assert.ok(cancellations >= 2);
    assert.equal(loader._pending.size, 0);
  } finally {
    texture?.dispose(); loader.dispose(); URL.revokeObjectURL(url);
  }
  assert.equal(workers[0].terminations, 1);
});
