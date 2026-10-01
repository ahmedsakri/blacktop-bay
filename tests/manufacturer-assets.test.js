import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {MANUFACTURER_ASSETS} from '../src/manufacturer-asset-manifest.js';
import {prepareManufacturerCar, createManufacturerCar} from '../src/manufacturer-car.js';
import {VEHICLES} from '../src/vehicles.js';
import {applyPaint} from '../src/paint.js';

// Decode the shipping Meshopt GLBs and exercise their actual component geometry.
// Only browser image decoding is represented by an image object: visual texture
// quality is checked separately in the real WebGL renderer.
const original = {fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap, ProgressEvent: globalThis.ProgressEvent, self: globalThis.self};
before(() => {
  globalThis.self = globalThis;
  globalThis.ProgressEvent = class { constructor(type, fields) { this.type = type; Object.assign(this, fields); } };
  globalThis.createImageBitmap = async blob => {
    assert.ok(blob.size > 0, 'embedded texture data must exist');
    return {width: 1024, height: 1024, close() {}};
  };
  globalThis.fetch = async input => {
    const url = new URL(typeof input === 'string' ? input : input.url || input.href);
    if (url.protocol === 'blob:') return original.fetch(input);
    assert.equal(url.origin, 'https://manufacturer-fixture.invalid');
    const data = await readFile(new URL(`../public${url.pathname}`, import.meta.url));
    return new Response(data, {headers: {'Content-Length': String(data.byteLength)}});
  };
});
after(() => { for (const [key, value] of Object.entries(original)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value; });

test('every manufacturer garage entry resolves to one attributed shipping model with both quality levels', async () => {
  const cars = VEHICLES.filter(vehicle => vehicle.assetId);
  assert.equal(new Set(cars.map(vehicle => vehicle.assetId)).size, cars.length, 'garage entries cannot alias another car body');
  assert.deepEqual(cars.map(vehicle => vehicle.assetId).sort(), Object.keys(MANUFACTURER_ASSETS).sort(), 'no selectable missing asset or orphaned model');
  for (const vehicle of cars) {
    const model = MANUFACTURER_ASSETS[vehicle.assetId];
    assert.equal(vehicle.brand, model.brand);
    assert.equal(vehicle.origin, 'manufacturer');
    assert.ok(['electric', 'hybrid', 'combustion'].includes(vehicle.powertrain));
    assert.ok(model.author?.trim() && model.model?.trim());
    assert.equal(new URL(model.source).protocol, 'https:');
    assert.ok(['sketchfab.com', 'github.com'].includes(new URL(model.source).hostname), 'source identifies the creator page or official asset distribution');
    assert.equal(model.license, 'CC-BY-4.0');
    assert.equal(model.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
    assert.match(model.sourceSha256, /^[a-f0-9]{64}$/);
    for (const quality of ['high', 'low']) {
      assert.match(model[quality], new RegExp(`^/assets/cars/manufacturers/${vehicle.assetId}-${quality}\\.glb$`));
      const bytes = await readFile(new URL(`../public${model[quality]}`, import.meta.url));
      assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'published asset is a binary glTF');
      assert.equal(bytes.length, model.variants[quality].bytes);
      assert.equal(model.variants[quality].sha256, createHash('sha256').update(bytes).digest('hex'), 'cache version matches the exact shipping mesh');
    }
  }
});

for (const [assetId, manifest] of Object.entries(MANUFACTURER_ASSETS)) for (const low of [true, false]) {
  test(`${manifest.brand} ${manifest.model} ${low ? 'mobile' : 'desktop'} shipping body has finite surfaces, four articulated wheels and isolated finishes`, async () => {
    await prepareManufacturerCar(assetId, {low, baseURL: 'https://manufacturer-fixture.invalid/'});
    const car = createManufacturerCar({assetId, vehicle: assetId, low});
    const rival = createManufacturerCar({assetId, vehicle: assetId, low});
    car.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(car.group), size = box.getSize(new THREE.Vector3());
    assert.ok(size.x > 1.4 && size.x < 3, `width ${size.x}m`);
    assert.ok(size.y > .6 && size.y < 2.1, `height ${size.y}m`);
    assert.ok(size.z > 3.5 && size.z < 6, `length ${size.z}m`);
    assert.ok(Math.abs(size.z - manifest.length) < .03, 'source is normalized to its documented length');
    assert.ok(Math.abs(box.min.y) < .06, `tyre contact ${box.min.y}m from ground`);
    assert.deepEqual(car.group.userData.dimensions, {length: size.z, width: size.x, height: size.y});
    assert.equal(car.group.userData.source, manifest.source);
    assert.equal(car.group.userData.vehicle, assetId);
    let triangles = 0, drawCalls = 0;
    const materials = new Set(), rivalMaterials = new Set(), geometries = new Set(), rivalGeometries = new Set();
    car.group.traverse(mesh => {
      if (!mesh.isMesh) return;
      const {position, normal} = mesh.geometry.attributes;
      assert.ok(position?.count > 0 && normal?.count === position.count);
      for (const attribute of [position, normal]) for (const value of attribute.array) assert.ok(Number.isFinite(value));
      triangles += (mesh.geometry.index?.count ?? position.count) / 3;
      drawCalls += Array.isArray(mesh.material) ? mesh.geometry.groups.length : 1;
      geometries.add(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    });
    rival.group.traverse(mesh => {
      if (!mesh.isMesh) return;
      rivalGeometries.add(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) rivalMaterials.add(material);
    });
    assert.equal(triangles, manifest.variants[low ? 'low' : 'high'].triangles, 'runtime retains the prepared body without proxy replacement');
    assert.ok(triangles > 20_000 && triangles <= (low ? 200_000 : 450_000), 'shipping source geometry remains within the measured budget');
    assert.ok(drawCalls <= 100, `compatible source surfaces stay batched (${drawCalls} draws)`);
    for (const geometry of geometries) assert.ok(rivalGeometries.has(geometry), 'immutable geometry is reused');
    for (const material of materials) assert.equal(rivalMaterials.has(material), false, 'mutable finishes must be independent');

    const brakeNames = new Set(manifest.brakeLightMaterialNames || []), foundBrakeNames = new Set();
    car.group.traverse(mesh => {
      if (!mesh.isMesh || !brakeNames.size) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const position = mesh.geometry.attributes.position, indices = mesh.geometry.index;
      const groups = Array.isArray(mesh.material) ? mesh.geometry.groups : [{start: 0, count: indices?.count ?? position.count, materialIndex: 0}];
      for (const group of groups) {
        const material = materials[group.materialIndex];
        if (!brakeNames.has(material.name)) continue;
        foundBrakeNames.add(material.name);
        const point = new THREE.Vector3();
        for (let i = group.start; i < group.start + group.count; i++) {
          point.fromBufferAttribute(position, indices ? indices.getX(i) : i).applyMatrix4(mesh.matrixWorld);
          assert.ok(point.z < 0, `${assetId} brake material ${material.name} must only illuminate rear geometry`);
        }
      }
    });
    assert.deepEqual(foundBrakeNames, brakeNames, 'every declared brake lamp resolves to a shipped rear light surface');

    const names = ['wheel_front_left', 'wheel_front_right', 'wheel_rear_left', 'wheel_rear_right'];
    const positions = names.map(name => car.group.getObjectByName(name).position.toArray());
    const wheelSurfaces = names.map(name => {
      let surface;
      car.group.getObjectByName(name).traverse(node => { if (node.isMesh && !surface) surface = node; });
      assert.ok(surface, 'every animated wheel pivot contains the actual source geometry');
      return surface;
    });
    const pointsBefore = wheelSurfaces.map(mesh => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, 0).applyMatrix4(mesh.matrixWorld));
    assert.ok(positions[0][2] > positions[2][2], 'front wheels are ahead of the rear axle');
    assert.ok(positions[0][0] > 0 && positions[1][0] < 0, 'left/right pivots use canonical coordinates');
    car.update({time: 1}); car.update({time: 1.04, speed: 24, steering: .8, brake: 1, nitro: true});
    car.group.updateMatrixWorld(true);
    for (const name of names) {
      const pivot = car.group.getObjectByName(name);
      assert.ok(pivot.children[0].rotation.x > 0);
      assert.equal(pivot.rotation.y < 0, name.includes('front'));
    }
    for (let i = 0; i < wheelSurfaces.length; i++) {
      const mesh = wheelSurfaces[i], moved = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, 0).applyMatrix4(mesh.matrixWorld);
      assert.ok(moved.distanceTo(pointsBefore[i]) > .001, 'the authored wheel surface actually moves with its pivot');
    }
    assert.deepEqual(names.map(name => car.group.getObjectByName(name).position.toArray()), positions);
    assert.equal(car.group.userData.paintable, manifest.paintable !== false && manifest.paintMaterialNames.length > 0);
    const paint = [...materials].filter(material => material.userData.bodyPaint);
    assert.equal(paint.length > 0, car.group.userData.paintable);
    const finishKeys = ['metalness', 'roughness', 'clearcoat', 'clearcoatRoughness'];
    const factory = new Map([...materials].map(material => [material, {
      color: material.color.getHexString(), map: material.map,
      finish: Object.fromEntries(finishKeys.map(key => [key, material[key]])),
    }]));
    for (const material of paint) {
      assert.ok(/^#[\da-f]{6}$/i.test(material.userData.factoryColor));
      assert.equal(material.color.getHexString(), material.userData.factoryColor.slice(1));
      assert.equal(material.map || null, material.userData.factoryMap);
      assert.ok(Number.isFinite(material.userData.factoryFinish.roughness));
    }
    applyPaint(car, assetId, {color: 'red', finish: 'satin'});
    for (const material of materials) {
      assert.equal(material.map, factory.get(material).map, 'colour selection preserves authored livery and UV texture');
      if (material.userData.bodyPaint) {
        assert.equal(material.color.getHexString(), new THREE.Color('#b92430').getHexString());
        assert.equal(material.roughness, .48);
      } else assert.equal(material.color.getHexString(), factory.get(material).color, 'glass, tyres, trim and lights retain their own finish');
    }
    for (const material of rivalMaterials) if (material.userData.bodyPaint)
      assert.equal(material.color.getHexString(), material.userData.factoryColor.slice(1), 'another car keeps the author factory paint');
    applyPaint(car, assetId, {color: 'factory', finish: 'gloss'});
    for (const material of materials) {
      const expected = factory.get(material);
      assert.equal(material.color.getHexString(), expected.color, 'factory restores each source colour rather than the registry swatch');
      assert.equal(material.map, expected.map);
      for (const key of finishKeys) assert.equal(material[key], expected.finish[key], `factory restores authored ${key}`);
    }
    let disposed = 0;
    materials.forEach(material => material.addEventListener('dispose', () => disposed++));
    car.dispose(); car.dispose();
    assert.equal(disposed, materials.size);
    rival.update({time: 2, speed: 20}); rival.dispose();
  });
}
