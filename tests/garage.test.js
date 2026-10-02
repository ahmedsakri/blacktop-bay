import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGarageSet } from '../src/garage.js';

function dispose(set) {
  const geometry = new Set(), materials = new Set();
  set.traverse(object => { if (object.geometry) geometry.add(object.geometry); if (object.material) materials.add(object.material); });
  for (const resource of [...geometry, ...materials]) resource.dispose();
}

test('studio keeps contact height and a continuous LED mural outside the inspection area', t => {
  const set = createGarageSet(); t.after(() => dispose(set));
  const platform = set.getObjectByName('garage-platform');
  assert.ok(Math.abs(platform.position.y + platform.geometry.parameters.height / 2 - .0355) < 1e-9);
  assert.equal(platform.receiveShadow, true);
  assert.equal(set.getObjectByName('garage-floor').receiveShadow, true);
  const wall = set.getObjectByName('garage-led-mural'), p = wall.geometry.attributes.position;
  assert.equal(wall.geometry.parameters.thetaLength, Math.PI * 2, 'every orbit angle has a complete display backdrop');
  for (let i = 0; i < p.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(p, i);
    assert.ok(point.toArray().every(Number.isFinite));
    assert.ok(Math.hypot(point.x, point.z) > 11.99, 'display cannot intersect the car or its plinth');
  }
});

test('LED backdrop cannot hide the car as mobile and garage cameras orbit or move outside it', t => {
  const set = createGarageSet(); t.after(() => dispose(set)); set.updateMatrixWorld(true);
  const wall = set.getObjectByName('garage-led-mural'), rim = set.getObjectByName('garage-mural-surround');
  const coves = [set.getObjectByName('garage-lower-cove'), set.getObjectByName('garage-upper-cove')];
  for (const radius of [7.3, 9, 18, 30]) for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, origin = new THREE.Vector3(Math.sin(a) * radius, 1, Math.cos(a) * radius);
    const ray = new THREE.Raycaster(origin, new THREE.Vector3(-origin.x, 0, -origin.z).normalize());
    for (const hit of ray.intersectObjects([wall, rim, ...coves])) assert.ok(hit.distance > radius + 8, 'interior-only wall must be beyond, not in front of, the vehicle');
  }
});

test('mobile mural stays sharp with fewer polygons and no coloured paint lighting or animated grid', t => {
  const low = createGarageSet({low: true}), full = createGarageSet();
  t.after(() => { dispose(low); dispose(full); });
  for (const set of [low, full]) {
    let meshes = 0, lights = 0;
    set.traverse(object => { meshes += Boolean(object.isMesh); lights += Boolean(object.isLight); });
    assert.ok(meshes <= 14, 'studio architecture must stay inside its fixed draw budget');
    assert.equal(set.userData.stats.architecturalDrawCalls, meshes);
    assert.equal(lights, 0, 'accent artwork must not tint car paints');
    assert.equal(set.userData.stats.dynamicObjects, 0);
    const mural = set.getObjectByName('garage-led-mural');
    assert.equal(mural.material.side, THREE.BackSide);
    assert.equal(mural.material.uniforms.violet.value.getHexString(), '9246ff');
    assert.equal(mural.material.uniforms.time, undefined, 'LED artwork has no scrolling/flickering motion');
    assert.equal(mural.material.toneMapped, false);
  }
  assert.ok(low.getObjectByName('garage-led-mural').geometry.attributes.position.count < full.getObjectByName('garage-led-mural').geometry.attributes.position.count);
});
