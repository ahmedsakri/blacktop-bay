import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('production CSP permits compressed model decoding and embedded textures without general eval or network wildcards', () => {
  const config = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
  const policy = config.hosting.headers.find(rule => rule.source === '**').headers
    .find(header => header.key.toLowerCase() === 'content-security-policy').value;
  const directives = new Map(policy.split(';').map(value => value.trim().split(/\s+/))
    .filter(([name]) => name).map(([name, ...sources]) => [name, sources]));
  const scripts = directives.get('script-src'), connections = directives.get('connect-src');
  assert.ok(scripts.includes("'wasm-unsafe-eval'"), 'MeshoptDecoder instantiates WebAssembly');
  assert.ok(connections.includes('blob:'), 'ImageBitmapLoader fetches GLB embedded-image blob URLs');
  assert.ok(directives.get('img-src').includes('blob:'), 'image-element fallback can load embedded textures');
  assert.deepEqual(directives.get('default-src'), ["'self'"]);
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
  for (const [name, sources] of directives) {
    assert.ok(!sources.includes("'unsafe-eval'"), `${name} must not permit general JavaScript evaluation`);
    for (const source of sources) {
      assert.ok(!['*', 'http:', 'https:', 'http://*', 'https://*'].includes(source), `${name} must not permit arbitrary network origins`);
    }
  }
  assert.ok(!scripts.includes('blob:') && !scripts.includes('data:'), 'image decoding does not need arbitrary script URLs');
});
