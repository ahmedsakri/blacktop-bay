import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {configureManufacturerPaint} from '../src/manufacturer-paint.js';
import {applyPaint, loadPaint, savePaint} from '../src/paint.js';

function fixture(assetId) {
  const map = new THREE.DataTexture(new Uint8Array([165, 13, 12, 255]), 1, 1);
  const body = new THREE.MeshPhysicalMaterial({color: '#ffffff', map, metalness: .31, roughness: .38, clearcoat: .65, clearcoatRoughness: .16});
  const trim = new THREE.MeshStandardMaterial({color: '#141414'});
  body.userData = {bodyPaint: true, factoryColor: '#ffffff', factoryMap: map,
    factoryFinish: {metalness: .31, roughness: .38, clearcoat: .65, clearcoatRoughness: .16}};
  configureManufacturerPaint(body, assetId);
  const group = new THREE.Group(), geometry = new THREE.BoxGeometry();
  group.add(new THREE.Mesh(geometry, [body, trim]));
  return {group, body, trim, map, dispose() {geometry.dispose(); body.dispose(); trim.dispose(); map.dispose();}};
}

for (const assetId of ['ferrari-250-gto', 'ferrari-testarossa', 'bmw-f22-eurofighter']) {
  test(`${assetId}: saved custom paint and factory restore keep independent uniforms and immutable atlas`, () => {
    const car = fixture(assetId), rival = fixture(assetId), data = new Map();
    const storage = {getItem: key => data.get(key), setItem: (key, value) => data.set(key, value)};
    const factoryTrim = car.trim.color.getHex(), originalPixels = [...car.map.image.data];
    const shader = {uniforms: {}, fragmentShader: THREE.ShaderLib.physical.fragmentShader};
    car.body.onBeforeCompile(shader);
    const mask = car.body.userData.bodyPaintMask;
    assert.ok(mask && mask !== rival.body.userData.bodyPaintMask, 'each car owns its paint state');
    assert.equal(shader.uniforms.bodyPaintMaskEnabled, mask.enabled, 'compiled shader retains the live selection uniform');
    assert.equal(mask.enabled.value, 0, 'the first frame uses the unmodified factory livery');
    assert.ok(!shader.fragmentShader.includes('#include <map_fragment>'), 'the renderer receives the mapped paint shader');
    assert.match(shader.fragmentShader, /texture2D\( map, vMapUv \)/, 'the original atlas and authored UV transform are still sampled');
    assert.ok(mask.pigmentValue.value > .01 && mask.pigmentValue.value < 1, 'a measured source pigment normalizes brightness');

    const state = loadPaint(storage);
    assert.deepEqual(savePaint(state, assetId, {color:'blue', finish:'satin'}, storage), {ok:true,persisted:true});
    applyPaint(car, assetId, loadPaint(storage)[assetId]);
    assert.equal(shader.uniforms.bodyPaintMaskEnabled.value, 1, 'paint changes reach an already compiled program');
    assert.equal(car.body.color.getHexString(), '245cac');
    assert.equal(car.body.roughness, .48);
    assert.equal(rival.body.userData.bodyPaintMask.enabled.value, 0, 'a second instance keeps its factory livery');
    assert.equal(rival.body.color.getHexString(), 'ffffff');
    assert.equal(car.body.map, car.map);
    assert.deepEqual([...car.map.image.data], originalPixels);
    assert.equal(car.trim.color.getHex(), factoryTrim);

    // Factory + another finish retains the source livery; factory + Gloss
    // restores the source physical finish as well, including after a reload.
    applyPaint(car, assetId, {color:'factory', finish:'metallic'});
    assert.equal(mask.enabled.value, 0);
    assert.equal(car.body.color.getHexString(), 'ffffff');
    assert.equal(car.body.metalness, .55);
    savePaint(state, assetId, {color:'factory', finish:'gloss'}, storage);
    applyPaint(car, assetId, loadPaint(storage)[assetId]);
    assert.equal(mask.enabled.value, 0);
    for (const [name, value] of Object.entries(car.body.userData.factoryFinish)) assert.equal(car.body[name], value);
    assert.equal(car.body.map, car.map);
    assert.equal(car.body.customProgramCacheKey(), rival.body.customProgramCacheKey(), 'uniform changes do not trigger per-colour shader variants');
    car.dispose(); rival.dispose();
  });
}

test('the pigment mask does not spread to mixed liveries, contrast panels, unmapped paint or non-body surfaces', () => {
  for (const assetId of ['audi-r18', 'bmw-i8', 'mclaren-p1-gtr', 'unknown']) {
    const car = fixture(assetId);
    assert.equal(car.body.userData.bodyPaintMask, undefined);
    car.dispose();
  }
  const material = new THREE.MeshPhysicalMaterial();
  material.userData.bodyPaint = true;
  configureManufacturerPaint(material, 'ferrari-250-gto');
  assert.equal(material.userData.bodyPaintMask, undefined, 'unmapped paint uses the normal material colour');
  material.map = new THREE.Texture();
  delete material.userData.bodyPaint;
  configureManufacturerPaint(material, 'ferrari-250-gto');
  assert.equal(material.userData.bodyPaintMask, undefined, 'wheel/trim materials are never opted in by asset identity');
  material.map.dispose(); material.dispose();
});
