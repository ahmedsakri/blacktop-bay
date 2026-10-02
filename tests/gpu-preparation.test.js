import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {prepareManufacturerInstances} from '../src/gpu-preparation.js';
function model(textures){const group=new THREE.Group();for(const texture of textures)group.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map:texture})));return {group};}
test('preparation yields after two unique textures and compiles hidden models against the real environment',async()=>{
 const maps=Array.from({length:5},()=>new THREE.Texture()),a=model(maps),b=model([maps[0]]);a.group.visible=false;
 let slice=0,yields=0,compiled=0;const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const renderer={initTexture(){assert.ok(++slice<=2);},async compileAsync(group,c,target){assert.equal(c,camera);assert.equal(target,scene);compiled++;}};
 const stats=await prepareManufacturerInstances(renderer,[a,b],{scene,camera,yieldControl:async()=>{slice=0;yields++;}});
 assert.equal(stats.textures,5);assert.equal(compiled,2);assert.equal(stats.models,2);assert.ok(yields>=4);assert.equal(a.group.visible,false);
});
test('cancelled preparation stops at its next yield and queued work can still finish',async()=>{
 const controller=new AbortController(),camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();let uploads=0,compiled=0;
 const renderer={initTexture(){uploads++;},async compileAsync(){compiled++;}};
 const request=prepareManufacturerInstances(renderer,[model(Array.from({length:8},()=>new THREE.Texture()))],{camera,scene,signal:controller.signal,yieldControl:async()=>controller.abort()});
 await assert.rejects(request,{name:'AbortError'});assert.equal(uploads,2);assert.equal(compiled,0);
 await prepareManufacturerInstances(renderer,[model([])],{camera,scene,yieldControl:async()=>{}});assert.equal(compiled,1);
});

test('context loss cancels before upload and after compile, then permits restored work',async()=>{
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();let lost=true,uploads=0,compiled=0;
 const renderer={getContext:()=>({isContextLost:()=>lost}),initTexture(){uploads++;},async compileAsync(){compiled++;lost=true;}};
 const options={camera,scene,yieldControl:async()=>{}};
 await assert.rejects(prepareManufacturerInstances(renderer,[model([new THREE.Texture()])],options),{name:'AbortError'});assert.equal(uploads,0);
 lost=false;await assert.rejects(prepareManufacturerInstances(renderer,[model([new THREE.Texture()])],options),{name:'AbortError'});assert.equal(uploads,1);assert.equal(compiled,1);
 lost=false;renderer.compileAsync=async()=>{compiled++;};await prepareManufacturerInstances(renderer,[model([])],options);assert.equal(compiled,2);
});

test('scene preparation uploads shared shader-uniform images once without allocating render-target textures as images',async()=>{
 const map=new THREE.Texture(),target=new THREE.WebGLRenderTarget(4,4),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.ShaderMaterial({uniforms:{sky:{value:map},copies:{value:[map,target.texture]}}})));
 let uploads=0;const renderer={initTexture(texture){assert.equal(texture,map);uploads++;},async compileAsync(){}};
 await prepareManufacturerInstances(renderer,[scene],{camera,scene,yieldControl:async()=>{}});assert.equal(uploads,1);target.dispose();
});

test('default preparation yields finish when a page is hidden or animation callbacks are suspended',async t=>{
 const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),originalRaf=Object.getOwnPropertyDescriptor(globalThis,'requestAnimationFrame'),originalCancel=Object.getOwnPropertyDescriptor(globalThis,'cancelAnimationFrame');
 t.after(()=>{for(const [name,descriptor]of [['document',originalDocument],['requestAnimationFrame',originalRaf],['cancelAnimationFrame',originalCancel]]){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
 let requested=0,cancelled=0;Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:true}});Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:()=>{requested++;return requested;}});Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:()=>{cancelled++;}});
 const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene();let compiled=0;const renderer={initTexture(){},async compileAsync(){compiled++;}};
 await prepareManufacturerInstances(renderer,[model([new THREE.Texture(),new THREE.Texture()])],{camera,scene});assert.equal(requested,0);assert.equal(compiled,1);
 globalThis.document.hidden=false;await prepareManufacturerInstances(renderer,[model([new THREE.Texture(),new THREE.Texture()])],{camera,scene});assert.equal(compiled,2);assert.equal(requested,2);assert.equal(cancelled,2);
});
