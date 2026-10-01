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

function boostRig(t, low = false, exhausts = [{x: .4, y: .4, z: -2}]) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = {createElement: () => ({getContext: () => ({
    createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}), putImageData() {},
  })})};
  const scene = new THREE.Scene(), effects = createEffects(scene, {low});
  const car = {x: 0, z: 0, yaw: 0, speed: 30, vx: 0, vz: 30};
  const controls = {nitro: true, profile: {rearAxle: -1.3, tyreOffset: .9, tyreWidth: .24, exhausts}};
  t.after(() => {effects.destroy(); original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document;});
  const run = (n, options = {}, active = true) => {for (let i = 0; i < n; i++) effects.update(car, .05, i * .05, active, {...controls, ...options});};
  return {scene, effects, car, run};
}

test('Nitro emits bounded blue particles only during actual boost and fades on release', t => {
  const {scene, effects, run} = boostRig(t, true);
  run(30, {nitro: false}); assert.equal(effects.stats.nitro, 0);
  run(40); assert.ok(effects.stats.nitro > 0); assert.ok(effects.stats.nitroCores > 0);
  assert.ok(effects.stats.nitro <= 48); assert.ok(effects.stats.nitroCores <= 12);
  const batch = scene.getObjectByName('nitro-blue-plume');
  const colour = batch.geometry.attributes.particleColor.array;
  assert.ok(colour[2] > colour[1] && colour[1] > colour[0], 'plume has a blue hue, not grey tyre smoke');
  run(20, {nitro: false}); assert.equal(effects.stats.nitro, 0); assert.equal(effects.stats.nitroCores, 0);
  run(20, {menu: true}, false); assert.equal(effects.stats.nitro, 0, 'a retained boost flag cannot emit in a menu');
});

test('boost pauses freeze particles; reset and teleport remove the old trail', t => {
  const {scene, effects, car, run} = boostRig(t);
  run(8);
  const shape = scene.getObjectByName('nitro-blue-plume').geometry.attributes.particleShape.array;
  const before = Array.from(shape); run(12, {}, false); assert.deepEqual(Array.from(shape), before);
  car.z = 200; run(1, {nitro: false}); assert.equal(effects.stats.nitro, 0); assert.equal(effects.stats.nitroCores, 0);
  run(5); effects.clear(); assert.equal(effects.stats.nitro, 0); assert.equal(effects.stats.nitroCores, 0);
});

test('electric cars get a blue rear wake without fabricated exhaust flames', t => {
  const {effects, run} = boostRig(t, true, []);
  run(20); assert.ok(effects.stats.nitro > 0); assert.equal(effects.stats.nitroCores, 0); assert.equal(effects.stats.flames, 0);
  run(20, {brake: true}); assert.equal(effects.stats.nitro, 0, 'braking blocks boost emissions');
});

test('reduced motion makes Nitro quieter and removes its bright exhaust core', t => {
  const {effects, run} = boostRig(t);
  run(20); const normal = effects.stats.nitro;
  effects.clear(); run(20, {reducedMotion: true});
  assert.ok(effects.stats.nitro > 0 && effects.stats.nitro < normal / 2);
  assert.equal(effects.stats.nitroCores, 0);
});
