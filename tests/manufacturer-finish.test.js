import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {FLAGSHIP_FINISHES,applyFlagshipFinish} from '../src/manufacturer-finish.js';
import {applyPaint} from '../src/paint.js';
import {MANUFACTURER_ASSETS} from '../src/manufacturer-asset-manifest.js';

test('all 33 catalogue finishes preserve livery maps and authored base response while factory/custom finishes remain independent',()=>{
 assert.equal(Object.keys(FLAGSHIP_FINISHES).length,33);
 assert.deepEqual(Object.keys(FLAGSHIP_FINISHES).sort(),Object.keys(MANUFACTURER_ASSETS).sort());
 for(const [id,finish] of Object.entries(FLAGSHIP_FINISHES)){
  assert.ok(MANUFACTURER_ASSETS[id].paintMaterialNames.length>0);
  assert.ok(finish.clearcoat>=.7&&finish.clearcoat<=.95);assert.ok(finish.clearcoatRoughness>=.1&&finish.clearcoatRoughness<=.24);
  const material=new THREE.MeshPhysicalMaterial({color:'#446688',roughness:.31,metalness:.54,map:new THREE.Texture()});
  const map=material.map;material.userData={bodyPaint:true,factoryColor:'#446688',factoryMap:map,factoryFinish:{roughness:.31,metalness:.54,clearcoat:0,clearcoatRoughness:.3}};
  assert.equal(applyFlagshipFinish(material,id),true);assert.equal(material.map,map);assert.equal(material.roughness,.31);assert.equal(material.metalness,.54);assert.equal(material.clearcoat,finish.clearcoat);
  const group=new THREE.Group();group.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
  applyPaint({group},id,{color:'factory',finish:'satin'});assert.notEqual(material.clearcoat,finish.clearcoat);
  applyPaint({group},id,{color:'factory',finish:'gloss'});assert.equal(material.clearcoat,finish.clearcoat);assert.equal(material.clearcoatRoughness,finish.clearcoatRoughness);assert.equal(material.map,map);
  const glass=new THREE.MeshPhysicalMaterial({transmission:.8});assert.equal(applyFlagshipFinish(glass,id),false);assert.equal(glass.clearcoat,0);
  const far=new THREE.MeshStandardMaterial();far.userData.bodyPaint=true;assert.equal(applyFlagshipFinish(far,id),false);
 }
});
