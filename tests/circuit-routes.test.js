import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {TRACKS} from '../src/track.js';
import {VEHICLES} from '../src/vehicles.js';
import {circuitPath, circuitFromPath} from '../src/circuit-routes.js';
import {carPath, carFromPath} from '../src/car-routes.js';
import {renderCircuitPage, renderCircuitSitemap} from '../scripts/circuit-pages.mjs';

const origin = 'https://camber-reign.web.app';
const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');

test('all 38 circuits have distinct reversible paths while malformed or unknown routes never select a circuit', () => {
  assert.equal(TRACKS.length, 38);
  assert.equal(new Set(TRACKS.map(track => circuitPath(track.id))).size, 38);
  for (const track of TRACKS) {
    assert.equal(circuitFromPath(circuitPath(track.id)), track.id);
    assert.equal(circuitFromPath(circuitPath(track.id).slice(0, -1)), track.id);
  }
  for (const path of ['/', '/circuits/', '/circuits/unknown/', '/circuits/harbor/extra/', '/circuits/../harbor/',
    '/circuits/%68arbor/', '/circuits/Harbor/', '//circuits/harbor/', '/circuits/harbor/?mode=race']) {
    assert.equal(circuitFromPath(path), null, path);
  }
  assert.equal(circuitPath('__proto__'), '/circuits/');
  assert.equal(circuitPath(undefined), '/circuits/');
});

test('all 33 car routes resolve to real vehicle IDs and reject unknown or malformed paths', () => {
  assert.equal(VEHICLES.length, 33);
  assert.equal(new Set(VEHICLES.map(vehicle => carPath(vehicle.id))).size, 33);
  for (const vehicle of VEHICLES) {
    assert.equal(carFromPath(carPath(vehicle.id)), vehicle.id);
    assert.equal(carFromPath(carPath(vehicle.id).slice(0, -1)), vehicle.id);
  }
  for (const path of ['/cars/', '/cars/unknown/', '/cars/../mclaren-570s/', '/cars/mclaren-570s/extra/', '//cars/mclaren-570s/']) assert.equal(carFromPath(path), null);
  assert.equal(carPath('__proto__'), '/cars/');
});

test('circuit metadata escapes display names and describes the route without relabelling the underlying game', () => {
  const track = {...TRACKS[0], name: 'Harbor & <Street "One">'};
  const html = renderCircuitPage(source, track);
  assert.match(html, /<title>Harbor &amp; &lt;Street &quot;One&quot;&gt; — Camber Reign<\/title>/);
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  assert.equal(schemas.find(item => item['@type'] === 'VideoGame').name, 'Camber Reign');
  const page = schemas.find(item => item['@type'] === 'WebPage');
  assert.equal(page.url, origin + '/circuits/harbor/');
  assert.equal(page.name, track.name + ' — Camber Reign');
  assert.equal(page.mainEntity['@id'], origin + '/#game');
  assert.equal(page.breadcrumb.itemListElement.at(-1).name, track.name);
});

test('extending the sitemap preserves old URLs and includes every circuit exactly once', () => {
  const result = renderCircuitSitemap(sitemap);
  assert.equal(renderCircuitSitemap(result), result);
  const urls = [...result.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.equal(new Set(urls).size, urls.length);
  for (const path of ['/', '/guide/', '/credits/', '/privacy/', '/circuits/', ...TRACKS.map(track => circuitPath(track.id)), '/cars/', ...VEHICLES.map(vehicle => carPath(vehicle.id))]) {
    assert.equal(urls.filter(url => url === origin + path).length, 1, path);
  }
});

test('the real production build contains every circuit HTML page, its correct metadata, executable assets and complete sitemap', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = await build({root, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'silent', build: {write: false}});
  const output = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
  const files = new Map(output.map(item => [item.fileName, item]));
  assert.ok(files.has('index.html'));
  assert.ok(files.has('circuits/index.html'));
  assert.ok(files.has('cars/index.html'));
  const migration = String(files.get('move-progress/index.html')?.source);
  assert.match(migration, /name="robots" content="noindex,nofollow"/);
  assert.ok(!migration.includes('/src/domain-migration-ui.js'), 'transfer page must use the compiled receiver');
  const migrationScripts = [...migration.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match => match[1]);
  assert.ok(migrationScripts.length > 0);
  for (const asset of migrationScripts) assert.ok(files.has(asset.slice(1)), asset);
  assert.ok(!String(files.get('sitemap.xml')?.source).includes('/move-progress/'), 'private transfer flow is not an indexable destination');
  for (const track of TRACKS) {
    const path = circuitPath(track.id), html = String(files.get(`${path.slice(1)}index.html`)?.source);
    const url = origin + path;
    assert.ok(html.includes(`<link rel="canonical" href="${url}"`), track.id);
    assert.ok(html.includes(`<meta property="og:url" content="${url}"`), track.id);
    assert.ok(html.includes(`<meta property="og:title" content="${track.name.replaceAll('&', '&amp;')} — Camber Reign"`), track.id);
    assert.ok(html.includes(`id="circuit-name">${track.name.replaceAll('&', '&amp;')}</strong>`), track.id);
    assert.ok(!html.includes('/src/main.js'), 'routes must use Vite production output');
    const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match => match[1]);
    assert.ok(scripts.some(src => src.startsWith('/assets/') && src.endsWith('.js')));
    for (const asset of scripts.filter(src => src.startsWith('/assets/'))) assert.ok(files.has(asset.slice(1)), `${track.id} -> ${asset}`);
    const page = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map(match => JSON.parse(match[1])).find(item => item['@type'] === 'WebPage');
    assert.equal(page.url, url);
    assert.ok(String(files.get('sitemap.xml')?.source).includes(`<loc>${url}</loc>`));
  }
  for (const vehicle of VEHICLES) {
    const path = carPath(vehicle.id), html = String(files.get(`${path.slice(1)}index.html`)?.source), url = origin + path;
    assert.ok(html.includes(`<link rel="canonical" href="${url}"`), vehicle.id);
    assert.ok(html.includes(`<meta property="og:url" content="${url}"`), vehicle.id);
    const page = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map(match => JSON.parse(match[1])).find(item => item['@type'] === 'WebPage');
    assert.equal(page.url, url);
    assert.equal(page.name, `${vehicle.name} — Camber Reign Garage`);
    assert.equal(page.breadcrumb.itemListElement[1].name, 'Cars');
    assert.equal(page.breadcrumb.itemListElement[2].name, vehicle.name);
    assert.ok(String(files.get('sitemap.xml')?.source).includes(`<loc>${url}</loc>`));
  }
});
