import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEffects } from '../src/effects.js';

test('an explicit empty exhaust profile removes previous emissions while preserving tyre effects', t => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => originalDocument
    ? Object.defineProperty(globalThis, 'document', originalDocument)
    : delete globalThis.document);
  globalThis.document = {
    createElement: () => ({ getContext: () => ({
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData() {},
    }) }),
  };
  const effects = createEffects(new THREE.Scene(), { low: true });
  t.after(() => effects.destroy());
  const profile = { rearAxle: -1.3, tyreOffset: .9, tyreWidth: .24, exhausts: [{ x: .5, y: .4, z: -2 }] };
  const noExhaust = { ...profile, exhausts: [] };
  const car = { x: 0, z: 0, yaw: 0, speed: 0, vx: 0, vz: 0 };
  const idle = selected => {
    for (let i = 0; i < 30; i++) effects.update(car, .05, i * .05, false, { menu: true, profile: selected });
  };

  idle(profile);
  assert.ok(effects.stats.emitted > 0, 'a verified combustion outlet emits exhaust');
  effects.clear();
  idle(noExhaust);
  assert.equal(effects.stats.emitted, 0, 'an electric/no-outlet car must not inherit previous exhausts');

  const drifting = { ...car, speed: 20, vx: 6, vz: 19, lateralSpeed: 6, drifting: true };
  effects.update(drifting, .08, 2, true, { profile: noExhaust, throttle: 1 });
  effects.update(drifting, .08, 2.08, true, { profile: noExhaust, throttle: 0 });
  assert.ok(effects.stats.clouds > 0, 'tyre smoke remains available');
  assert.ok(effects.stats.spray > 0, 'road spray remains available');
  assert.equal(effects.stats.flames, 0, 'lifting off an electric car cannot ignite an exhaust');

  effects.clear();
  idle(profile);
  assert.ok(effects.stats.emitted > 0, 'selecting a combustion car restores its verified exhaust');
});
