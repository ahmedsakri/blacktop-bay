import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createScannedTrees,SCANNED_TREE_BUDGET} from '../src/scanned-trees.js';
import {SCANNED_TREE_VARIANTS} from '../src/scanned-tree-manifest.js';

test('actual scanned-tree GLBs match provenance, retain bark normals and canopy alpha, and bound all delivered vertices',()=>{
 const record=JSON.parse(readFileSync(new URL('../public/assets/environments/trees/provenance.json',import.meta.url)));assert.equal(record.license,'CC0-1.0');assert.match(record.asset,/polyhaven.com\/a\/tree_small_02$/);
 for(const [tier,v]of Object.entries(SCANNED_TREE_VARIANTS)){
  assert.deepEqual(record.variants[tier],v);const b=readFileSync(new URL('../public/assets/environments/trees/'+v.file,import.meta.url));assert.equal(b.length,v.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),v.sha256);
  assert.equal(b.toString('ascii',0,4),'glTF');const length=b.readUInt32LE(12),g=JSON.parse(b.toString('utf8',20,20+length)),bin=28+length;
  const array=index=>{const a=g.accessors[index],view=g.bufferViews[a.bufferView],width=a.type==='VEC3'?3:a.type==='VEC2'?2:1,size=a.componentType===5126?4:2,out=[];for(let i=0;i<a.count;i++)for(let j=0;j<width;j++){const off=bin+(view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||width*size)+j*size;out.push(size===4?b.readFloatLE(off):b.readUInt16LE(off));}return out;};
  let triangles=0,minY=Infinity,maxY=-Infinity,radius=0;
  const primitives=g.meshes.flatMap(m=>m.primitives);assert.equal(primitives.length,3);assert.equal(g.images.length,5);assert.equal(g.materials.filter(m=>m.normalTexture).length,2);assert.equal(g.materials.at(-1).alphaMode,'MASK');
  for(const p of primitives){triangles+=g.accessors[p.indices].count/3;const pos=array(p.attributes.POSITION);assert.ok(array(p.indices).every(i=>i<pos.length/3));for(let i=0;i<pos.length;i+=3){assert.ok(pos.slice(i,i+3).every(Number.isFinite));minY=Math.min(minY,pos[i+1]);maxY=Math.max(maxY,pos[i+1]);radius=Math.max(radius,Math.hypot(pos[i],pos[i+2]));}for(const a of Object.values(p.attributes))assert.ok(array(a).every(Number.isFinite));}
  assert.equal(triangles,v.triangles);assert.ok(triangles<=({mobile:2500,desktop:5200,mobileFar:600,desktopFar:950}[tier]));assert.ok(Math.abs(minY-v.minY)<1e-6);assert.ok(Math.abs(maxY-minY-v.height)<1e-6);assert.ok(Math.abs(radius-v.radius)<1e-6);
  for(const img of g.images){assert.equal(img.uri,undefined);const view=g.bufferViews[img.bufferView],raw=b.subarray(bin+(view.byteOffset||0),bin+(view.byteOffset||0)+view.byteLength);assert.equal(raw.toString('ascii',8,12),'WEBP');const type=raw.toString('ascii',12,16),width=type==='VP8X'?1+raw.readUIntLE(24,3):raw.readUInt16LE(26)&0x3fff;assert.ok(width<=({mobile:512,desktop:1024,mobileFar:128,desktopFar:256}[tier]));}
 }
});

const model=()=>{const root=new THREE.Group();for(let i=0;i<3;i++)root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial()));return root;};
test('scanned tier is fixed capacity, hides all selected fallback pieces exclusively, restores them across travel and disposal',async()=>{
 for(const low of [true,false]){
  const scene=new THREE.Scene(),capacity=low?SCANNED_TREE_BUDGET.mobile:SCANNED_TREE_BUDGET.desktop,candidates=Array.from({length:20},(_,treeId)=>({treeId,x:treeId*15,y:2,z:0,height:9,radius:4}));
  const fallback=new THREE.Group(),matrices=[];for(let part=0;part<2;part++){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial(),20);mesh.userData.treeIds=candidates.map(p=>p.treeId);for(const p of candidates){const m=new THREE.Matrix4().makeTranslation(p.x,part,0);mesh.setMatrixAt(p.treeId,m);if(!part)matrices.push(m);}fallback.add(mesh);}
  const trees=createScannedTrees(scene,candidates,[fallback],{low,enabled:true,load:async()=>model()});trees.update(1,{x:80,z:0});assert.equal(await trees.ready,true);assert.equal(trees.status.draws,6);assert.equal(trees.status.visible,capacity);
  const m=new THREE.Matrix4();for(const mesh of fallback.children)assert.equal(mesh.count,0,'covered fallback instances are removed from draw count');assert.equal(trees.status.visible+trees.status.farVisible,20);
  for(const mesh of trees.group.children){assert.ok([capacity,low?64:128].includes(mesh.instanceMatrix.count));assert.equal(mesh.castShadow,false);assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));}
  trees.update(2,{x:2000,z:0});assert.equal(trees.status.visible,0);fallback.children[0].getMatrixAt(0,m);assert.deepEqual(m.elements,matrices[0].elements);
  trees.update(3,{x:80,z:0});trees.dispose();trees.dispose();assert.equal(scene.children.length,0);assert.equal(trees.status.state,'disposed');for(let i=0;i<20;i++){fallback.children[0].getMatrixAt(i,m);assert.deepEqual(m.elements,matrices[i].elements);}
 }
});

test('failed and disposed tree loads retain fallback and dispose late resources without resurrecting scene',async()=>{
 const scene=new THREE.Scene(),candidates=[{treeId:1,x:0,y:0,z:0,height:9,radius:3}];
 const failure=createScannedTrees(scene,candidates,[],{enabled:true,load:async()=>{throw Error('unavailable');}});assert.equal(await failure.ready,false);assert.equal(failure.status.state,'fallback');failure.dispose();
 let resolve;const deferred=new Promise(r=>resolve=r),trees=createScannedTrees(scene,candidates,[],{enabled:true,load:()=>deferred});await Promise.resolve();trees.dispose();assert.equal(await trees.ready,false);let released=0;const source=model();source.traverse(o=>o.geometry?.addEventListener('dispose',()=>released++));resolve(source);await new Promise(r=>setImmediate(r));assert.equal(released,3);assert.equal(scene.children.length,0);
});

test('both tree representations follow actual rendered terrain, retaining root contact after a failed load',async()=>{
 const scene=new THREE.Scene(),fallback=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial(),1),m=new THREE.Matrix4().makeTranslation(4,3,7);fallback.setMatrixAt(0,m);fallback.userData.treeIds=[9];
 const trees=createScannedTrees(scene,[{treeId:9,x:4,y:0,z:7,height:10,radius:3}],[fallback],{groundAt:()=>-.3,enabled:true,load:async()=>{throw Error('offline');}});await trees.ready;fallback.getMatrixAt(0,m);assert.ok(Math.abs(m.elements[13]-2.7)<1e-6);trees.dispose();fallback.getMatrixAt(0,m);assert.ok(Math.abs(m.elements[13]-2.7)<1e-6);
});
