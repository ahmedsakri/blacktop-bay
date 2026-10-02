import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { createPwaController } from '../src/pwa.js';

function environment() {
  const listeners = new Map(), events = [], registrations = [];
  const env = {
    isSecureContext: true, document: { readyState: 'complete' },
    navigator: { serviceWorker: { register: async (...args) => { registrations.push(args); return { scope: '/' }; } } },
    matchMedia: () => ({ matches: false }),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    addEventListener: (name, listener) => listeners.set(name, listener),
    dispatchEvent: event => events.push(event),
  };
  return { env, listeners, events, registrations };
}

test('registration waits for load, is idempotent and leaves updates to normal worker lifecycle', async () => {
  const { env, listeners, registrations } = environment(); env.document.readyState = 'loading';
  const pwa = createPwaController(env), first = pwa.register();
  assert.equal(first, pwa.register()); assert.equal(registrations.length, 0);
  assert.ok(listeners.has('beforeinstallprompt'));
  listeners.get('load')(); await first;
  assert.deepEqual(registrations, [['/sw.js', { scope: '/', updateViaCache: 'none' }]]);
});

test('installation requires a browser event and consumes it once within the initiating click task', async () => {
  const { env, listeners, events } = environment(), pwa = createPwaController(env);
  await pwa.register(); assert.deepEqual(await pwa.requestInstall(), { outcome: 'unavailable' });
  let prompts = 0, prevented = 0;
  listeners.get('beforeinstallprompt')({ preventDefault: () => prevented++, prompt: () => { prompts++; return Promise.resolve(); }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  assert.equal(prevented, 1); assert.equal(pwa.canInstall(), true);
  const choice = pwa.requestInstall(); assert.equal(prompts, 1); assert.equal(pwa.canInstall(), false);
  assert.deepEqual(await choice, { outcome: 'dismissed' });
  assert.deepEqual(await pwa.requestInstall(), { outcome: 'unavailable' });
  assert.equal(events.at(-1).detail.available, false);
});

test('accepted prompt does not fabricate installation, appinstalled clears availability, and denial is recoverable', async () => {
  const { env, listeners, events } = environment(), pwa = createPwaController(env); await pwa.register();
  listeners.get('beforeinstallprompt')({ preventDefault() {}, prompt: () => Promise.resolve(), userChoice: Promise.resolve({ outcome: 'accepted' }) });
  assert.deepEqual(await pwa.requestInstall(), { outcome: 'accepted' });
  assert.equal(events.at(-1).detail.installed, false);
  listeners.get('beforeinstallprompt')({ preventDefault() {}, prompt: () => { throw Error('Denied'); } });
  assert.deepEqual(await pwa.requestInstall(), { outcome: 'error' });
  listeners.get('appinstalled')(); assert.equal(events.at(-1).detail.installed, true);
  listeners.get('beforeinstallprompt')({ preventDefault() { assert.fail('installed app should not intercept another prompt'); } });
  assert.equal(pwa.canInstall(), false);
});

test('unsupported or insecure worker registration and storage denial do not break browser play', async () => {
  const { env, registrations } = environment(); env.isSecureContext = false;
  assert.equal(await createPwaController(env).register(), null); assert.equal(registrations.length, 0);
  env.isSecureContext = true; env.navigator.serviceWorker.register = async () => { throw Error('Storage denied'); };
  assert.equal(await createPwaController(env).register(), null);
  delete env.navigator.serviceWorker;
  assert.equal(await createPwaController(env).register(), null);
});

function worker() {
  const listeners = new Map(), precached = [], removed = [], network = [];
  let response = new Response('fresh document'), failure = false, fallback = new Response('offline reconnect');
  const context = {
    URL, Response,
    Request: class extends Request { constructor(path, options) { super(new URL(path, 'https://camber-reign.web.app'), options); } },
    self: { location: { origin: 'https://camber-reign.web.app' }, addEventListener: (type, listener) => listeners.set(type, listener), skipWaiting() { assert.fail('must not take over an active race'); }, clients: { claim() { assert.fail('must not take over existing pages'); } } },
    caches: {
      open: async () => ({ addAll: async requests => precached.push(...requests) }),
      keys: async () => ['camber-reign-offline-v0', 'camber-reign-offline-v1', 'unrelated-app-v1'],
      delete: async key => { removed.push(key); return true; },
      match: async (request, options) => { assert.equal(options.cacheName, 'camber-reign-offline-v1'); return fallback?.clone(); },
    },
    fetch: async request => { network.push(request); if (failure) throw Error('offline'); return response; },
  };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
  const lifecycle = async type => { let promise; listeners.get(type)({ waitUntil: value => promise = value }); await promise; };
  const fetchEvent = request => { let result; listeners.get('fetch')({ request, respondWith: value => result = value }); return result; };
  return { precached, removed, network, lifecycle, fetchEvent, fail: () => failure = true, setResponse: value => response = value, loseFallback: () => fallback = null };
}

test('worker precaches only a bounded reconnect shell and cleans only its own old caches', async () => {
  const w = worker(); await w.lifecycle('install');
  const paths = w.precached.map(r => new URL(r.url).pathname);
  assert.ok(paths.includes('/offline.html')); assert.ok(paths.includes('/assets/offline.js'));
  assert.equal(paths.length, 7);
  assert.ok(paths.every(path => !/cars|analytics|index\.html|\.glb/.test(path)));
  assert.ok(w.precached.every(r => r.cache === 'reload'));
  const bytes = paths.reduce((sum, path) => sum + statSync(new URL(`../public${path}`, import.meta.url)).size, 0);
  assert.ok(bytes < 150_000, `reconnect cache is ${bytes} bytes`);
  await w.lifecycle('activate'); assert.deepEqual(w.removed, ['camber-reign-offline-v0']);
});

test('navigation uses fresh network responses, preserves 404, and falls back only on network/server failure', async () => {
  const w = worker(), request = { url: 'https://camber-reign.web.app/cars/mclaren-senna/', method: 'GET', mode: 'navigate' };
  assert.equal(await (await w.fetchEvent(request)).text(), 'fresh document');
  w.setResponse(new Response('missing route', { status: 404 }));
  assert.equal((await w.fetchEvent(request)).status, 404);
  w.setResponse(new Response('server failure', { status: 503 }));
  assert.equal(await (await w.fetchEvent(request)).text(), 'offline reconnect');
  w.fail(); assert.equal(await (await w.fetchEvent(request)).text(), 'offline reconnect');
  w.loseFallback(); assert.equal((await w.fetchEvent(request)).status, 503);
});

test('worker leaves cross-origin, analytics, models, saves and POST requests untouched', async () => {
  const w = worker();
  for (const request of [
    { url: 'https://www.google-analytics.com/g/collect', method: 'GET', mode: 'no-cors' },
    { url: 'https://camber-reign.web.app/assets/cars/model.glb', method: 'GET', mode: 'cors' },
    { url: 'https://camber-reign.web.app/save', method: 'POST', mode: 'cors' },
    { url: 'https://camber-reign.web.app/assets/offline.js?private=value', method: 'GET', mode: 'cors' },
  ]) assert.equal(w.fetchEvent(request), undefined);
  assert.equal(w.network.length, 0);
  const cached = await w.fetchEvent({ url: 'https://camber-reign.web.app/assets/logo-compact.svg', method: 'GET', mode: 'cors' });
  assert.equal(await cached.text(), 'offline reconnect'); assert.equal(w.network.length, 0);
});

test('manifest install destinations exist, icon purposes are honest, and shortcuts stay within scope', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.id, '/'); assert.equal(manifest.scope, '/'); assert.equal(manifest.lang, 'en');
  assert.ok(manifest.categories.includes('games'));
  assert.deepEqual(manifest.shortcuts.map(s => s.url), ['/cars/', '/circuits/', '/guide/']);
  for (const icon of manifest.icons) { assert.equal(icon.purpose, 'any'); assert.ok(statSync(new URL(`../public${icon.src}`, import.meta.url)).size > 0); }
});
