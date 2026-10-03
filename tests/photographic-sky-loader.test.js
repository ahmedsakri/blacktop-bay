import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {getEventListeners} from 'node:events';
import {loadPhotographicSky, supportsCompressedSky, PHOTOGRAPHIC_SKY_LIMITS} from '../src/photographic-sky-loader.js';
import {BASIS_TRANSCODER} from '../src/basis-transcoder-manifest.js';
import {inspectSkyKTX, skyBlockBytes, SKY_PREPARATION} from '../scripts/prepare-photographic-skies.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
const renderer = {extensions:{has:name => name === 'EXT_texture_compression_bptc'}};
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
function clock() {
  let next = 0;
  const timers = new Map();
  return {
    timers,
    setTimeout(fn, delay) {assert.equal(this, globalThis); const id = ++next; timers.set(id, {fn, delay}); return id;},
    clearTimeout(id) {assert.equal(this, globalThis); timers.delete(id);},
    expire() {for (const [id, {fn}] of [...timers]) if (timers.delete(id)) fn();},
  };
}
function harness({fetchFile, parse, detectSupport, timeoutMs} = {}) {
  const time = clock(), controller = new AbortController();
  const calls = {loader:0, disposed:0, parsed:[], requests:[], textureDisposed:0};
  const texture = {userData:{reviewed:true}, dispose() {calls.textureDisposed++;}};
  const loader = {
    setTranscoderPath(value) {calls.path = value; return this;},
    setWorkerLimit(value) {calls.workers = value; return this;},
    detectSupport(value) {calls.renderer = value; return detectSupport?.(value);},
    parse(buffer) {calls.parsed.push(buffer); return parse ? parse(buffer) : Promise.resolve(texture);},
    dispose() {calls.disposed++;},
  };
  const options = {
    signal:controller.signal, timeoutMs,
    setTimeout:time.setTimeout, clearTimeout:time.clearTimeout,
    makeLoader() {calls.loader++; return loader;},
    fetchFile(url, options) {calls.requests.push({url, ...options}); return fetchFile ? fetchFile(url, options) : Promise.resolve(new Response(new Uint8Array([1, 2, 3])));},
  };
  return {calls, texture, loader, time, controller, options, load:() => loadPhotographicSky(renderer, '/test-sky.ktx2', options)};
}
function streamFixture(chunks, {length, read} = {}) {
  const calls = {reads:0, cancelled:0, released:0, bodyCancelled:0};
  const reader = {
    async read() {calls.reads++; return read ? read() : chunks.length ? {done:false, value:chunks.shift()} : {done:true};},
    cancel() {calls.cancelled++; return Promise.resolve();},
    releaseLock() {calls.released++;},
  };
  return {calls, response:{ok:true, headers:{get:() => length ?? null}, body:{getReader:() => reader, cancel() {calls.bodyCancelled++;}}}};
}
function cleaned(h) {
  assert.equal(h.calls.disposed, 1);
  assert.equal(h.time.timers.size, 0);
  assert.equal(getEventListeners(h.controller.signal, 'abort').length, 0);
}

test('compressed sky support requires a usable compressed extension, not uncompressed fallback', () => {
  assert.equal(supportsCompressedSky(null), false);
  assert.equal(supportsCompressedSky({}), false);
  assert.equal(supportsCompressedSky({extensions:{has:() => false}}), false);
  for (const extension of ['WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_etc', 'EXT_texture_compression_bptc']) {
    assert.equal(supportsCompressedSky({extensions:{has:name => name === extension}}), true);
  }
  assert.equal(supportsCompressedSky({extensions:{has:name => name === 'WEBGL_compressed_texture_s3tc'}}), false);
  assert.equal(supportsCompressedSky({extensions:{has:name => name === 'WEBGL_compressed_texture_s3tc_srgb'}}), false);
  assert.equal(supportsCompressedSky({extensions:{has:name => ['WEBGL_compressed_texture_s3tc', 'WEBGL_compressed_texture_s3tc_srgb'].includes(name)}}), true);
});

test('streams all bytes into one decoder with one worker and returns caller-owned texture', async () => {
  const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])];
  const h = harness({fetchFile:async () => new Response(new ReadableStream({pull(controller) {chunks.length ? controller.enqueue(chunks.shift()) : controller.close();}}))});
  const texture = await h.load();
  assert.equal(texture, h.texture);
  assert.deepEqual([...new Uint8Array(h.calls.parsed[0])], [1, 2, 3, 4, 5]);
  assert.equal(h.calls.path, BASIS_TRANSCODER.path);
  assert.equal(h.calls.workers, 1);
  assert.equal(h.calls.renderer, renderer);
  assert.deepEqual(texture.userData, {reviewed:true, photographicGPU:true});
  assert.equal(h.calls.textureDisposed, 0);
  assert.equal(h.calls.requests[0].signal.aborted, false);
  cleaned(h);
  h.controller.abort();
  assert.equal(h.calls.disposed, 1, 'returned texture is owned by its caller after listener removal');
});

test('pre-aborted scenes never create a loader, timer or request', async () => {
  const h = harness(); h.controller.abort();
  await assert.rejects(h.load(), {name:'AbortError'});
  assert.equal(h.calls.loader, 0); assert.equal(h.calls.requests.length, 0); assert.equal(h.time.timers.size, 0);
});

test('unsupported devices reject to the caller before fetching or allocating a decoder', async () => {
  const h = harness();
  await assert.rejects(loadPhotographicSky({}, '/test-sky.ktx2', h.options), /supported compressed texture/);
  assert.equal(h.calls.loader, 0); assert.equal(h.calls.requests.length, 0); assert.equal(h.time.timers.size, 0);
});

test('an immediate abort prevents a queued fetch from starting', async () => {
  const h = harness(), pending = h.load(); h.controller.abort();
  await assert.rejects(pending, {name:'AbortError'});
  assert.equal(h.calls.requests.length, 0); cleaned(h);
});

test('support detection failures release the loader and deadline without fetching', async () => {
  const h = harness({detectSupport() {throw new Error('unsupported renderer');}});
  await assert.rejects(h.load(), /unsupported renderer/);
  assert.equal(h.calls.requests.length, 0); cleaned(h);
});

for (const [name, fetchFile, message] of [
  ['network rejection', async () => {throw new Error('network failure');}, /network failure/],
  ['HTTP rejection', async () => new Response('gone', {status:404}), /404/],
]) test(`${name} rejects for caller fallback without making another request`, async () => {
  const h = harness({fetchFile});
  await assert.rejects(h.load(), message);
  assert.equal(h.calls.requests.length, 1); assert.equal(h.calls.parsed.length, 0);
  assert.equal(h.calls.requests[0].signal.aborted, true); cleaned(h);
});

test('an oversized declared body is rejected and cancelled before reading', async () => {
  const s = streamFixture([], {length:String(PHOTOGRAPHIC_SKY_LIMITS.transferBytes + 1)}), h = harness({fetchFile:async () => s.response});
  await assert.rejects(h.load(), /transfer limit/);
  assert.equal(s.calls.reads, 0); assert.equal(s.calls.bodyCancelled, 1); assert.equal(h.calls.parsed.length, 0); cleaned(h);
});

for (const length of [undefined, '1']) test(`streamed size overrides ${length ? 'incorrect' : 'missing'} Content-Length and cancels at the bound`, async () => {
  const s = streamFixture([new Uint8Array(PHOTOGRAPHIC_SKY_LIMITS.transferBytes), new Uint8Array(1), new Uint8Array(1)], {length});
  const h = harness({fetchFile:async () => s.response});
  await assert.rejects(h.load(), /transfer limit/);
  assert.equal(s.calls.reads, 2); assert.equal(s.calls.cancelled, 1); assert.equal(s.calls.released, 1);
  assert.equal(h.calls.parsed.length, 0); cleaned(h);
});

test('exactly the transfer limit remains decodable', async () => {
  const s = streamFixture([new Uint8Array(PHOTOGRAPHIC_SKY_LIMITS.transferBytes)]), h = harness({fetchFile:async () => s.response});
  await h.load(); assert.equal(h.calls.parsed[0].byteLength, PHOTOGRAPHIC_SKY_LIMITS.transferBytes); cleaned(h);
});

test('responses without streams never invoke an unbounded arrayBuffer fallback', async () => {
  let arrayBufferCalls = 0;
  const h = harness({fetchFile:async () => ({ok:true, arrayBuffer() {arrayBufferCalls++; return new ArrayBuffer(1);}})});
  await assert.rejects(h.load(), /bounded stream/);
  assert.equal(arrayBufferCalls, 0); assert.equal(h.calls.parsed.length, 0); cleaned(h);
});

test('one deadline rejects a stalled fetch that ignores abort and cancels any late response', async () => {
  const work = deferred(), h = harness({fetchFile:() => work.promise, timeoutMs:60_000});
  const pending = h.load(); const outcome = assert.rejects(pending, /deadline/);
  await flush();
  assert.deepEqual([...h.time.timers.values()].map(item => item.delay), [15_000]);
  h.time.expire(); await outcome;
  assert.equal(h.calls.requests[0].signal.aborted, true); cleaned(h);
  const s = streamFixture([]); work.resolve(s.response); await flush();
  assert.equal(s.calls.bodyCancelled, 1); assert.equal(s.calls.reads, 0); assert.equal(h.calls.parsed.length, 0);
});

for (const mode of ['abort', 'deadline']) test(`${mode} settles stalled body reading promptly and does not decode late chunks`, async () => {
  const work = deferred(), s = streamFixture([], {read:() => work.promise}), h = harness({fetchFile:async () => s.response});
  const pending = h.load(), outcome = assert.rejects(pending, mode === 'abort' ? {name:'AbortError'} : /deadline/);
  await flush(); assert.equal(s.calls.reads, 1);
  if (mode === 'abort') h.controller.abort(); else h.time.expire();
  await outcome; cleaned(h);
  assert.equal(s.calls.cancelled, 1); assert.equal(s.calls.released, 1);
  work.resolve({done:false, value:new Uint8Array([1])}); await flush();
  assert.equal(h.calls.parsed.length, 0);
});

for (const mode of ['abort', 'deadline']) test(`${mode} during decoding disposes a late texture once`, async () => {
  const work = deferred(), h = harness({parse:() => work.promise});
  const pending = h.load(), outcome = assert.rejects(pending, mode === 'abort' ? {name:'AbortError'} : /deadline/);
  await flush(); assert.equal(h.calls.parsed.length, 1);
  if (mode === 'abort') h.controller.abort(); else h.time.expire();
  await outcome; cleaned(h);
  work.resolve(h.texture); await flush();
  assert.equal(h.calls.textureDisposed, 1); assert.equal(h.calls.disposed, 1);
});

for (const synchronous of [true, false]) test(`${synchronous ? 'synchronous' : 'asynchronous'} decoder failure propagates to caller fallback and releases worker`, async () => {
  const error = new Error('bad KTX'), h = harness({parse() {if (synchronous) throw error; return Promise.reject(error);}});
  await assert.rejects(h.load(), reason => reason === error);
  assert.equal(h.calls.requests.length, 1); cleaned(h);
});

test('a host timer error rejects before creating a loader', async () => {
  const h = harness(); h.options.setTimeout = () => {throw new Error('timer unavailable');};
  await assert.rejects(h.load(), /timer unavailable/);
  assert.equal(h.calls.loader, 0); assert.equal(h.calls.requests.length, 0);
  assert.equal(getEventListeners(h.controller.signal, 'abort').length, 0);
});

test('the real bounded Three parser rejects a malformed sky without starting transcoder workers', async () => {
  const controller = new AbortController();
  await assert.rejects(loadPhotographicSky(renderer, '/bad-sky.ktx2', {
    signal:controller.signal, fetchFile:async () => new Response(new Uint8Array(12)),
  }), /identifier|KTX|bounds/i);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('actual shipping KTX containers match provenance, full mips, orientation and runtime bounds', async () => {
  const base = new URL('../public/assets/environments/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('provenance.json', base), 'utf8'));
  assert.deepEqual(manifest.preparation, SKY_PREPARATION);
  for (const [family, entry] of Object.entries(manifest.families)) for (const detail of ['desktop', 'mobile']) {
    const asset = entry[detail].compressed, bytes = await readFile(new URL(asset.url.split('/').at(-1), base));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.ok((detail === 'mobile' ? [4096] : [4096, 8192]).includes(asset.width), family + ' uses a reviewed bounded tier');
    assert.deepEqual(inspectSkyKTX(bytes, asset.width, asset.height), {width:asset.width, height:asset.height, estimatedGPUBlockBytes:asset.estimatedGPUBlockBytes, orientation:asset.orientation, format:asset.format});
    assert.ok(asset.estimatedGPUBlockBytes < (detail === 'mobile' ? 6_000_000 : 23_000_000));
  }
  assert.equal(skyBlockBytes(4096, 1024), 5_592_464);
});
