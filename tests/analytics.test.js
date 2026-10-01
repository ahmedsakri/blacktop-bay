import test from 'node:test';
import assert from 'node:assert/strict';

const CONSENT_KEY = 'blacktop-bay-analytics-consent-v1';
let importNumber = 0;

// Deliberately no browser/network implementation: inserting a script is recorded,
// never fetched. Every case restores globals and imports a fresh consent state.
async function withBrowser({ hostname = 'blacktop-bay.web.app', consent, cookies = {}, blockedStorage = false } = {}, run) {
  const keys = ['window', 'document', 'location', 'localStorage'];
  const original = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = new Map(consent === undefined ? [] : [[CONSENT_KEY, consent]]);
  const cookieJar = new Map(Object.entries(cookies));
  const scripts = [], cookieWrites = [];
  const window = {};
  const location = {
    hostname, origin: `https://${hostname}`, pathname: '/',
    href: `https://${hostname}/?email=private%40example.test#secret`,
    search: '?email=private%40example.test', hash: '#secret',
  };
  const document = {
    title: 'Private visitor title must never be measured',
    head: { append: element => scripts.push(element) },
    createElement: name => ({ tagName: name.toUpperCase() }),
    get cookie() { return [...cookieJar].map(([key, value]) => `${key}=${value}`).join('; '); },
    set cookie(value) {
      cookieWrites.push(value);
      const [name, contents] = value.split(';', 1)[0].split('=');
      if (/Max-Age=0/i.test(value)) cookieJar.delete(name);
      else cookieJar.set(name, contents);
    },
  };
  const localStorage = {
    getItem(key) { if (blockedStorage) throw new Error('Storage unavailable'); return storage.get(key) ?? null; },
    setItem(key, value) { if (blockedStorage) throw new Error('Storage unavailable'); storage.set(key, String(value)); },
  };
  try {
    for (const [key, value] of Object.entries({ window, document, location, localStorage }))
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    const source = new URL('../src/analytics.js', import.meta.url);
    source.search = `case=${Date.now()}-${++importNumber}`;
    const analytics = await import(source.href);
    await run({ analytics, window, document, location, storage, scripts, cookieWrites, cookieJar });
  } finally {
    for (const key of keys) {
      const descriptor = original.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

const measuredEvents = window => (window.dataLayer || []).filter(entry => entry && typeof entry.event === 'string');
const consentCommands = window => (window.dataLayer || [])
  .filter(entry => entry?.[0] === 'consent').map(entry => Array.from(entry));

test('event boundary accepts useful race facts but strips identifiers, URLs and arbitrary fields', async () => {
  await withBrowser({}, ({ analytics }) => {
    const result = analytics.sanitizeGameEvent('race_complete', {
      circuit: 'dockyard', vehicle: 'rally', position: 2, duration_seconds: 139,
      drift_score: 1280, resets: 1, lap: 3,
      email: 'private@example.test', name: 'Someone Private', user_id: 'personal-id',
      page_location: 'https://example.test/?email=private@example.test',
      coordinates: { lat: 19.1, lng: 72.9 }, input: 'private chat text', event: 'custom_event',
    });
    assert.deepEqual(result, {
      event: 'race_complete', game_name: 'Blacktop Bay', circuit: 'dockyard', vehicle: 'rally',
      position: 2, duration_seconds: 139, drift_score: 1280, resets: 1, lap: 3,
    });
    for (const name of ['page_view', 'purchase', 'private@example.test', '', null, {}, '__proto__'])
      assert.equal(analytics.sanitizeGameEvent(name, { email: 'private@example.test' }), null);
  });
});

test('unsafe enum and numeric values never cross the event boundary', async () => {
  await withBrowser({}, ({ analytics }) => {
    const minimal = { event: 'lap_complete', game_name: 'Blacktop Bay' };
    const unsafeNumbers = [NaN, Infinity, -Infinity, '2', null, {}, [], true, -1, 1_000_000_001];
    for (const value of unsafeNumbers) {
      assert.deepEqual(analytics.sanitizeGameEvent('lap_complete', {
        circuit: 'harbor?email=private@example.test', vehicle: '<script>private</script>',
        position: value, duration_seconds: value, drift_score: value, resets: value, lap: value,
      }), minimal);
    }
    assert.deepEqual(analytics.sanitizeGameEvent('lap_complete', {
      position: 5, lap: 4, duration_seconds: 3601, resets: 10001,
      circuit: { toString: () => 'harbor' }, vehicle: ['coupe'],
    }), minimal);
  });
});

test('fresh, denied, invalid and unavailable consent cannot load Google or queue measurement', async () => {
  for (const options of [{}, { consent: 'denied' }, { consent: 'true' }, { consent: 'GRANTED' }, { blockedStorage: true }]) {
    await withBrowser(options, ({ analytics, window, scripts }) => {
      analytics.initializeAnalytics();
      analytics.initializeAnalytics();
      assert.equal(analytics.trackEvent('race_start', { circuit: 'harbor', vehicle: 'coupe' }), false);
      assert.equal(scripts.length, 0);
      assert.deepEqual(measuredEvents(window), []);
      assert.ok(!window.dataLayer.some(entry => 'page_location' in entry));
      const defaults = consentCommands(window).filter(command => command[1] === 'default');
      assert.equal(defaults.length, 1);
      assert.deepEqual(defaults[0][2], {
        analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
      });
    });
  }
});

test('granting consent loads the configured container once with advertising still denied', async () => {
  await withBrowser({}, ({ analytics, window, scripts, storage }) => {
    analytics.initializeAnalytics();
    assert.equal(scripts.length, 0);
    analytics.setAnalyticsConsent(true);
    analytics.setAnalyticsConsent(true);
    analytics.initializeAnalytics();
    assert.equal(analytics.trackEvent('race_start', { vehicle: 'gt', circuit: 'coast' }), true);
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].tagName, 'SCRIPT');
    assert.equal(scripts[0].async, true);
    assert.equal(scripts[0].src, 'https://www.googletagmanager.com/gtm.js?id=GTM-PZHDLVK8');
    assert.equal(storage.get(CONSENT_KEY), 'granted');
    assert.equal(window[`ga-disable-${analytics.ANALYTICS_CONFIG.measurementId}`], false);
    for (const [, , consent] of consentCommands(window)) {
      assert.equal(consent.ad_storage, 'denied');
      assert.equal(consent.ad_user_data, 'denied');
      assert.equal(consent.ad_personalization, 'denied');
    }
    const page = window.dataLayer.find(entry => entry.page_location);
    assert.equal(page.page_location, 'https://blacktop-bay.web.app/');
    assert.equal(page.page_title, 'Blacktop Bay');
    assert.ok(!JSON.stringify(window.dataLayer).includes('private'));
  });
});

test('local, preview and lookalike hosts never load Google or accept analytics events, even after consent', async () => {
  for (const hostname of ['localhost', '127.0.0.1', 'blacktop-bay--preview.web.app', 'blacktop-bay.web.app.evil.test']) {
    await withBrowser({ hostname, consent: 'granted' }, ({ analytics, window, scripts }) => {
      analytics.initializeAnalytics();
      analytics.setAnalyticsConsent(true);
      assert.equal(analytics.trackEvent('race_complete', { duration_seconds: 120, vehicle: 'coupe' }), false);
      assert.equal(scripts.length, 0, hostname);
      assert.deepEqual(measuredEvents(window), [], hostname);
      assert.ok(!window.dataLayer.some(entry => 'page_location' in entry), hostname);
    });
  }
});

test('previously granted consent restores measurement and unapproved events remain rejected', async () => {
  await withBrowser({ consent: 'granted' }, ({ analytics, window, scripts }) => {
    analytics.initializeAnalytics();
    assert.equal(scripts.length, 1);
    assert.equal(analytics.trackEvent('nitro_use', { circuit: 'harbor', vehicle: 'rally', email: 'private@example.test' }), true);
    const count = window.dataLayer.length;
    assert.equal(analytics.trackEvent('private@example.test', { email: 'private@example.test' }), false);
    assert.equal(window.dataLayer.length, count);
    assert.deepEqual(measuredEvents(window).at(-1), {
      event: 'nitro_use', game_name: 'Blacktop Bay', circuit: 'harbor', vehicle: 'rally',
    });
  });
});

test('revocation disables measurement, clears only GA cookies and cannot queue further game events', async () => {
  await withBrowser({ consent: 'granted', cookies: {
    _ga: 'identifier', _ga_RC925EV263: 'session-identifier',
    preferred_car: 'rally', _gaNotAnalytics: 'keep-this', session: 'keep-this-too',
  } }, ({ analytics, window, scripts, storage, cookieWrites, cookieJar }) => {
    analytics.initializeAnalytics();
    analytics.trackEvent('race_start', { circuit: 'harbor', vehicle: 'coupe' });
    const before = measuredEvents(window).length;
    analytics.setAnalyticsConsent(false);
    assert.equal(analytics.getAnalyticsConsent(), 'denied');
    assert.equal(storage.get(CONSENT_KEY), 'denied');
    assert.equal(window[`ga-disable-${analytics.ANALYTICS_CONFIG.measurementId}`], true);
    assert.equal(consentCommands(window).at(-1)[2].analytics_storage, 'denied');
    assert.ok(!cookieJar.has('_ga'));
    assert.ok(!cookieJar.has('_ga_RC925EV263'));
    assert.equal(cookieJar.get('preferred_car'), 'rally');
    assert.equal(cookieJar.get('_gaNotAnalytics'), 'keep-this');
    assert.equal(cookieJar.get('session'), 'keep-this-too');
    assert.ok(cookieWrites.every(cookie => /^_ga(?:_|=)/.test(cookie) && /Max-Age=0/.test(cookie)));
    assert.ok(cookieWrites.some(cookie => /domain=blacktop-bay\.web\.app/.test(cookie)));
    assert.ok(cookieWrites.some(cookie => /domain=\.blacktop-bay\.web\.app/.test(cookie)));
    for (const name of analytics.ANALYTICS_EVENTS) assert.equal(analytics.trackEvent(name, { circuit: 'coast' }), false);
    analytics.initializeAnalytics();
    assert.equal(measuredEvents(window).length, before);
    assert.equal(scripts.length, 1);
    // A later deliberate opt-in can resume the same container, not inject a duplicate.
    analytics.setAnalyticsConsent(true);
    assert.equal(scripts.length, 1);
    assert.equal(window[`ga-disable-${analytics.ANALYTICS_CONFIG.measurementId}`], false);
  });
});
