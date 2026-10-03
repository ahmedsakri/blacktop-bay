import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {TYRE_DETAIL_SLOTS,applyManufacturerTyreFinish} from '../src/manufacturer-tyre-finish.js';
import {MANUFACTURER_ASSETS} from '../src/manufacturer-asset-manifest.js';

test('every procedural rubber slot belongs exclusively to shipping wheel primitives at both detail levels',()=>{
  for(const [id,name] of Object.entries(TYRE_DETAIL_SLOTS))for(const level of ['high','low']){
    const bytes=fs.readFileSync(new URL(`../public${MANUFACTURER_ASSETS[id][level]}`,import.meta.url));
    const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    const index=gltf.materials.findIndex(material=>material.name===name);
    assert.ok(index>=0,`${id}/${level}: dedicated tyre slot exists`);
    assert.equal(gltf.materials[index].normalTexture,undefined,`${id}: authored normal maps take precedence`);
    const users=gltf.nodes.filter(node=>node.mesh!==undefined&&gltf.meshes[node.mesh].primitives.some(primitive=>primitive.material===index));
    assert.equal(users.length,4,`${id}: all four tyres use the slot`);
    assert.ok(users.every(node=>/^wheel_(front|rear)_(left|right)$/.test(node.name)),`${id}: shared interior/body atlases are not modified`);
    assert.equal(MANUFACTURER_ASSETS[id].paintMaterialNames.includes(name),false);
  }
});

test('rubber detail preserves selected source colour and maps, skips optics/logos, and retains authored normal detail',()=>{
  const source=new THREE.MeshStandardMaterial({color:'#23262a',map:new THREE.Texture(),roughnessMap:new THREE.Texture(),metalnessMap:new THREE.Texture(),roughness:.84,metalness:.02});
  source.name='tires';const material=source.clone();
  assert.equal(applyManufacturerTyreFinish(material,'mclaren-p1-gtr'),true);
  for(const key of ['map','roughnessMap','metalnessMap','roughness','metalness'])assert.equal(material[key],source[key]);
  assert.equal(material.color.getHexString(),source.color.getHexString());
  assert.equal(source.userData.tyreSurfaceDetail,undefined);
  const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader);assert.match(shader.fragmentShader,/rubberGrain/);assert.match(shader.vertexShader,/tyrePosition=position/);
  for(const candidate of [new THREE.MeshStandardMaterial({normalMap:new THREE.Texture()}),new THREE.MeshPhysicalMaterial({transparent:true,opacity:.5}),new THREE.MeshStandardMaterial({bumpMap:new THREE.Texture()})]){
    candidate.name='tires';assert.equal(applyManufacturerTyreFinish(candidate,'mclaren-p1-gtr'),false);
  }
  material.name='tire_logo';assert.equal(applyManufacturerTyreFinish(material,'mclaren-p1-gtr'),false);
  material.name='tires';material.userData.bodyPaint=true;assert.equal(applyManufacturerTyreFinish(material,'mclaren-p1-gtr'),false);
  assert.equal(applyManufacturerTyreFinish(source,'unknown-car'),false);
});
