import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createNitroCanisterGeometry,createPickupView} from '../src/race-pickup-view.js';

test('Nitro vessel has finite shared manufacture geometry and an actual inspection window',()=>{
 const parts=createNitroCanisterGeometry();
 for(const geometry of Object.values(parts)){
  assert.ok([...geometry.attributes.position.array].every(Number.isFinite));geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox.min.y>=-.03&&geometry.boundingBox.max.y<1.75);
  assert.ok(geometry.boundingBox.max.x<=.41&&geometry.boundingBox.min.x>=-.41);
 }
 assert.ok(parts.glass.attributes.position.count>100);
 assert.ok(parts.shell.attributes.position.count>parts.glass.attributes.position.count);
 for(const geometry of Object.values(parts))geometry.dispose();
});

test('six canisters have nine draws, grounded locators, no new lights and a bounded collection wake',()=>{
 const scene=new THREE.Scene(),items=Array.from({length:6},(_,i)=>({id:`pickup-${i}`,x:i*5,z:i*3,y:i*.2,tx:1,tz:0,playerAvailable:true}));
 const view=createPickupView(scene,items),root=scene.getObjectByName('collectible-nitro');
 assert.equal(root.children.length,9);assert.ok(root.children.every(child=>child.isInstancedMesh&&child.count===6));
 assert.equal(root.userData.presentation.dynamicLights,0);
 const locators=root.getObjectByName('nitro-ground-locators'),bodies=root.getObjectByName('nitro-canister-shell'),matrix=new THREE.Matrix4(),point=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
 view.update(items,1,true,false,.06);locators.getMatrixAt(2,matrix);matrix.decompose(point,rotation,scale);assert.ok(Math.abs(point.y-.475)<1e-6);
 items[2].playerAvailable=false;view.update(items,1.06,true,false,.06);bodies.getMatrixAt(2,matrix);matrix.decompose(point,rotation,scale);assert.ok(scale.x<1&&scale.x>0);
 for(let frame=0;frame<10;frame++)view.update(items,2,true,false,.06);
 bodies.getMatrixAt(2,matrix);assert.equal(Math.hypot(...matrix.elements.slice(0,3)),0);
 const wakes=root.getObjectByName('nitro-collection-wakes');wakes.getMatrixAt(2,matrix);assert.equal(Math.hypot(...matrix.elements.slice(0,3)),0);
 items[2].playerAvailable=true;view.update(items,3,true,true,.016);bodies.getMatrixAt(2,matrix);matrix.decompose(point,rotation,scale);assert.ok(Math.abs(scale.x-1)<1e-6);
 const frozen=Array.from(bodies.instanceMatrix.array);view.update(items,9,false,false,1);assert.equal(root.visible,false);
 view.update(items,9,true,true,0);assert.deepEqual(Array.from(bodies.instanceMatrix.array),frozen);
 const resources=new Set(root.children.flatMap(child=>[child.geometry,child.material]));let disposed=0;for(const resource of resources)resource.addEventListener('dispose',()=>disposed++);
 view.dispose();view.dispose();assert.equal(disposed,resources.size);assert.equal(scene.children.length,0);
});

test('a reduced-motion collection removes the canister without animated motion',()=>{
 const scene=new THREE.Scene(),items=[{id:'one',x:0,z:0,playerAvailable:true}],view=createPickupView(scene,items);
 items[0].playerAvailable=false;view.update(items,1,true,true,.016);
 const matrix=new THREE.Matrix4();for(const child of scene.children[0].children){child.getMatrixAt(0,matrix);assert.ok(Math.abs(matrix.elements[0])===0);}
 view.dispose();
});
