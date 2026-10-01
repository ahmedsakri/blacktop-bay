import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCar, prepareCarAssets } from '../src/car.js';
import { VEHICLES } from '../src/vehicles.js';
import { applyPaint } from '../src/paint.js';

// Read the actual shipping GLBs. Only the browser transport and number-plate
// canvas are stubbed; model topology, source wheels and material batching run.
before(async () => {
  const originalFetch = globalThis.fetch;
  const originalProgressEvent = globalThis.ProgressEvent;
  globalThis.ProgressEvent = class { constructor(type, fields) { this.type = type; Object.assign(this, fields); } };
  globalThis.fetch = async input => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    assert.equal(url.origin, 'https://car-fixture.invalid');
    const bytes = await readFile(new URL(`../public${url.pathname}`, import.meta.url));
    return new Response(bytes, {headers: {'Content-Length': String(bytes.length)}});
  };
  try { await prepareCarAssets({baseURL: 'https://car-fixture.invalid/'}); }
  finally { globalThis.fetch = originalFetch; globalThis.ProgressEvent = originalProgressEvent; }
  globalThis.document = {createElement(type) {
    assert.equal(type, 'canvas');
    return {width: 0, height: 0, getContext: () => ({fillRect() {}, fillText() {}})};
  }};
});

function resources(car) {
  const geometry = new Set(), materials = new Set(), textures = new Set();
  car.group.traverse(mesh => {
    if (!mesh.isMesh) return;
    geometry.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      if (material.map) textures.add(material.map);
    }
  });
  return {geometry, materials, textures};
}

function bounds(car, select = () => true) {
  car.group.updateMatrixWorld(true);
  const box = new THREE.Box3(), point = new THREE.Vector3();
  car.group.traverse(mesh => {
    if (!mesh.isMesh || !select(mesh)) return;
    const position = mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) box.expandByPoint(point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
  });
  return box;
}

for (const low of [true, false]) for (const vehicle of VEHICLES) {
  test(`${vehicle.name} ${low ? 'mobile' : 'desktop'} model has finite real geometry, working wheels and isolated disposable finishes`, () => {
    const car = createCar({vehicle: vehicle.id, low}), other = createCar({vehicle: vehicle.id, low});
    const a = resources(car), b = resources(other), disposalCounts = new Map();
    const watch = object => object.addEventListener('dispose', () => disposalCounts.set(object, (disposalCounts.get(object) || 0) + 1));
    for (const type of ['geometry', 'materials', 'textures']) for (const value of new Set([...a[type], ...b[type]])) watch(value);
    assert.equal(car.group.userData.vehicle, vehicle.id, 'selection must not silently render Apex GT');
    const size = bounds(car).getSize(new THREE.Vector3());
    assert.ok(size.x > 1.5 && size.x < 3.5 && size.y > .7 && size.y < 2 && size.z > 4 && size.z < 6.5);
    let meshes = 0, triangles = 0;
    car.group.traverse(mesh => {
      if (!mesh.isMesh) return;
      meshes++;
      triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      for (const name of ['position', 'normal']) for (const value of mesh.geometry.attributes[name].array) assert.ok(Number.isFinite(value));
    });
    assert.ok(meshes < 55, 'static panels should stay batched for the race grid');
    const triangleLimit = vehicle.family === 'gt' ? (low ? 230_000 : 275_000) : (low ? 110_000 : 190_000);
    assert.ok(triangles < triangleLimit, 'original visible GT surfaces retain a measured geometry budget');
    const wheels = [];
    car.group.traverse(object => { if (object.isGroup && /wheel/.test(object.name)) wheels.push(object); });
    assert.equal(wheels.length, 4);
    const wheelPositions = wheels.map(wheel => wheel.position.toArray());
    car.update({time: 1}); car.update({time: 1.04, speed: 28, steering: 1, nitro: true});
    for (const wheel of wheels) {
      assert.ok(wheel.children[0].rotation.x > 0, 'forward motion rolls the source wheel');
      assert.equal(wheel.rotation.y < 0, /front|_f/.test(wheel.name), 'driver-right steers front wheels toward negative yaw only');
    }
    assert.deepEqual(wheels.map(wheel => wheel.position.toArray()), wheelPositions);
    assert.equal(car.group.getObjectByName('nitro-exhaust').visible, true);
    const beforeOther = [...b.materials].map(material => material.color.getHex());
    const nonPaintBefore = new Map([...a.materials].filter(material => !material.userData.bodyPaint).map(material => [material, material.color.getHex()]));
    applyPaint(car, vehicle.id, {color: 'teal', finish: 'satin'});
    assert.ok([...a.materials].some(material => material.userData.bodyPaint && material.roughness === .48));
    assert.deepEqual([...b.materials].map(material => material.color.getHex()), beforeOther, 'two copies must not share mutable paint');
    for (const [material, color] of nonPaintBefore) assert.equal(material.color.getHex(), color, 'tyres, glazing and race numbers retain their finishes');
    for (const texture of a.textures) assert.ok(texture.isTexture);
    car.dispose(); car.dispose();
    for (const type of ['geometry', 'materials', 'textures']) for (const value of a[type])
      assert.equal(disposalCounts.get(value) || 0, type === 'geometry' && b.geometry.has(value) ? 0 : 1, `${type} disposed once without deleting shared source assets`);
    for (const material of b.materials) assert.equal(disposalCounts.get(material) || 0, 0);
    other.update({time: 2, speed: 20});
    other.dispose();
  });
}

test('the four additions change measurable body silhouettes and leave the existing GT cache intact', () => {
  const ids = ['coupe', 'prototype', 'barchetta', 'kestrel', 'mirage', 'monoposto', 'tempest'];
  const cars = Object.fromEntries(ids.map(vehicle => [vehicle, createCar({vehicle, low: true})]));
  const glassBounds = car => bounds(car, mesh => mesh.material.name === 'dark-glass');
  assert.ok(bounds(cars.kestrel).max.z > bounds(cars.coupe).max.z + .30, 'GT-R has a genuinely longer nose');
  assert.ok(glassBounds(cars.kestrel).max.y < glassBounds(cars.coupe).max.y - .03, 'GT-R has a lower glazed roof');
  assert.ok(bounds(cars.mirage).min.z < bounds(cars.prototype).min.z - .30, 'LMP has an extended tail');
  assert.ok(glassBounds(cars.mirage).max.y < glassBounds(cars.prototype).max.y - .10, 'LMP has a genuinely lower canopy');
  assert.ok(glassBounds(cars.monoposto).getSize(new THREE.Vector3()).x < glassBounds(cars.barchetta).getSize(new THREE.Vector3()).x * .75, 'one-seat aeroscreen is narrower than the sports-racer cockpit');
  assert.ok(bounds(cars.tempest).getSize(new THREE.Vector3()).x > bounds(cars.prototype).getSize(new THREE.Vector3()).x + .20, 'extreme-aero wing and dive planes change the outline');
  const fresh = createCar({vehicle: 'coupe', low: true});
  assert.deepEqual(bounds(fresh), bounds(cars.coupe), 'morphing Kestrel cannot deform a later GT instance');
  fresh.dispose(); Object.values(cars).forEach(car => car.dispose());
});

test('shipping GT paint and wheel surfaces retain coherent geometry and normals after offline processing', async () => {
  for (const file of ['gt-base-low.glb', 'gt-base.glb']) {
    const bytes = await readFile(new URL(`../public/assets/cars/${file}`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    let checked = 0;
    gltf.scene.traverse(mesh => {
      if (!mesh.isMesh || !/^(body|wheel(?:_\d+)?|rim_\w+)$/.test(mesh.name)) return;
      const p = mesh.geometry.attributes.position, n = mesh.geometry.attributes.normal, index = mesh.geometry.index;
      let totalArea = 0, damagedArea = 0;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), face = new THREE.Vector3(), normal = new THREE.Vector3(), temp = new THREE.Vector3();
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        a.fromBufferAttribute(p, ids[0]); b.fromBufferAttribute(p, ids[1]); c.fromBufferAttribute(p, ids[2]);
        face.crossVectors(b.sub(a), c.sub(a)); const area = face.length() / 2;
        if (area < 1e-12) continue;
        normal.set(0, 0, 0); for (const id of ids) normal.add(temp.fromBufferAttribute(n, id));
        totalArea += area;
        if (face.normalize().dot(normal.normalize()) < .5) damagedArea += area;
      }
      assert.ok(totalArea > 0);
      assert.ok(damagedArea / totalArea < .001, `${file}/${mesh.name}: reflective surface must not contain folded faces inconsistent with its smooth normals (${damagedArea / totalArea})`);
      checked++;
    });
    assert.equal(checked, 9, 'check the body and all four actual wheels/rims');
    gltf.scene.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose(); } });
  }
});

test('Kestrel retains outward-only body paint and authored smooth normals outside its changed silhouette', () => {
  for (const low of [true, false]) {
    const base = createCar({vehicle: 'coupe', low}), kestrel = createCar({vehicle: 'kestrel', low});
    const original = base.group.getObjectByName('batched-body-paint'), changed = kestrel.group.getObjectByName('batched-body-paint');
    assert.equal(changed.material.side, THREE.FrontSide, 'a new fender must not expose the entire source body backface');
    const a = original.geometry.attributes, b = changed.geometry.attributes;
    let checked = 0;
    // Body triangles are the first painted surface in both builds. Rebuilding
    // their normals used to flip hundreds of vertices even on unchanged doors.
    for (let i = 0; i < a.position.count; i++) {
      if (a.position.getY(i) > 1.02 || a.position.getZ(i) > 1.76) continue;
      for (const axis of ['getX', 'getY', 'getZ']) {
        assert.ok(Math.abs(a.position[axis](i) - b.position[axis](i)) < 1e-6);
        assert.ok(Math.abs(a.normal[axis](i) - b.normal[axis](i)) < 1e-6, 'smooth source normal must survive on an unchanged body panel');
      }
      checked++;
    }
    assert.ok(checked > 10_000);
    base.dispose(); kestrel.dispose();
  }
});
