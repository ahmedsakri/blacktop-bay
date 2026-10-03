import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSpectatorCharacterGeometry,createSpectatorCharacter,CHARACTER_LIMITS} from '../src/spectator-character.js';
import {spectatorProfile,spectatorPose,createCrowd} from '../src/crowd.js';
import {SPECTATOR_GESTURES} from '../src/spectator-motion-config.js';
const rng=()=>{let s=89;return()=>((s=Math.imul(s,1664525)+1013904223)>>>0)/4294967296;};

test('authored character is one indexed mesh with 18 valid joints, two facial morphs and bounded triangles',()=>{
 for(const low of [false,true])for(let gesture=0;gesture<SPECTATOR_GESTURES.length;gesture++){
  const p=spectatorProfile(0,0,0,0,false,rng());p.gesture=gesture;p.cap=true;p.longHair=true;
  const g=createSpectatorCharacterGeometry(p,{low});
  assert.ok(g.index.count/3>5000&&g.index.count/3<=CHARACTER_LIMITS.maxTriangles);
  for(const a of Object.values(g.attributes))assert.ok([...a.array].every(Number.isFinite));
  for(let i=0;i<g.attributes.skinIndex.count;i++){
   assert.ok(g.attributes.skinIndex.getX(i)<18);assert.equal(g.attributes.skinWeight.getX(i),1);
  }
  assert.equal(g.morphAttributes.position.length,2);assert.ok(g.morphTargetsRelative);
  assert.ok(g.morphAttributes.position.every(a=>a.count===g.attributes.position.count));
  assert.ok(g.morphAttributes.position.every(a=>a.array.some(v=>v!==0)));
  assert.equal(g.groups.length,0,'one material draw instead of facial/limb objects');
  g.dispose();
 }
});

test('all gestures deform actual mesh into finite adult bounds for standing and seated spectators',()=>{
 const random=rng(),v=new THREE.Vector3();
 for(const seated of [false,true])for(let gesture=0;gesture<SPECTATOR_GESTURES.length;gesture++){
  const p=spectatorProfile(0,0,0,0,seated,random);p.gesture=gesture;
  const character=createSpectatorCharacter(p,{low:true});
  for(const time of [0,.3,1.6,3.2]){
   character.update(p,spectatorPose(p,time,1));const bounds=new THREE.Box3();
   for(let i=0;i<character.mesh.geometry.attributes.position.count;i++){
    character.mesh.getVertexPosition(i,v);assert.ok(v.toArray().every(Number.isFinite));bounds.expandByPoint(v);
   }
   assert.ok(bounds.min.y>-.04&&bounds.max.y<2.2,'no detached joint or exploding skinned vertex');
   assert.ok(bounds.max.x-bounds.min.x<1.25);assert.ok(bounds.max.z-bounds.min.z<.85);
   assert.ok(bounds.max.y>(seated?1.2:1.6));
  }
  character.dispose();character.dispose();
 }
});

test('foreground pool reuses geometry, bounds draws and returns every spectator to distance batches',()=>{
 for(const low of [true,false]){
  const crowd=createCrowd({low}),scene=new THREE.Scene(),random=rng();
  for(let i=0;i<150;i++)crowd.add(i*.6,0,0,0,i%2===0,random);
  crowd.render(scene);const wrappers=scene.children.filter(m=>m.name==='near-spectator'),meshes=wrappers.map(m=>m.children[0]),geometries=meshes.map(m=>m.geometry);
  assert.equal(meshes.length,low?6:10);assert.equal(scene.children.filter(m=>m.isInstancedMesh).length,10);
  for(const [frame,x] of [0,20,40,60,80,1000,0].entries()){
   crowd.update((frame+1)*.2,{x,z:2,speed:20});assert.deepEqual(meshes.map(m=>m.geometry),geometries);
   assert.ok(meshes.filter(m=>m.visible).length<=meshes.length);
   assert.equal(scene.children.find(m=>m.name==='race-spectators-heads').count+scene.userData.crowd.activeCharacters,scene.userData.crowd.visiblePeople,'never draw both LODs for a spectator');
  }
  const pose=meshes.map(m=>Array.from(m.skeleton.boneMatrices));crowd.update(2,{x:0,z:2,speed:20},{paused:true});assert.deepEqual(meshes.map(m=>Array.from(m.skeleton.boneMatrices)),pose);
  const disposed=new Map(geometries.map(g=>[g,0]));geometries.forEach(g=>g.addEventListener('dispose',()=>disposed.set(g,disposed.get(g)+1)));
  crowd.dispose();crowd.dispose();assert.equal(scene.children.length,0);assert.ok([...disposed.values()].every(count=>count===1));
 }
});
