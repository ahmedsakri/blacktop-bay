import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createScannedTrees,SCANNED_TREE_BUDGET,SCANNED_TREE_SHAPE} from '../src/scanned-trees.js';
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
  const requests=[],trees=createScannedTrees(scene,candidates,[fallback],{low,enabled:true,load:async url=>{requests.push(url);return model();}});trees.update(1,{x:80,z:0});assert.equal(await trees.ready,true);assert.equal(trees.status.draws,6);assert.equal(trees.status.visible,capacity);
  assert.equal(requests.length,2);
  for(const [index,key]of (low?['mobile','mobileFar']:['desktop','desktopFar']).entries()){
   const url=new URL(requests[index],'https://tree-assets.invalid'),variant=SCANNED_TREE_VARIANTS[key];
   assert.equal(url.pathname,'/assets/environments/trees/'+variant.file);
   assert.equal(url.searchParams.get('v'),variant.sha256,'each tier invalidates the previous cached GLB using its delivered content hash');
   assert.equal(index?trees.status.farUrl:trees.status.url,requests[index]);
  }
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
 const scene=new THREE.Scene(),fallback=new THREE.InstancedMesh(new THREE.BoxGeometry(1,6,1),new THREE.MeshStandardMaterial(),1),m=new THREE.Matrix4().makeTranslation(4,3,7);fallback.setMatrixAt(0,m);fallback.userData.treeIds=[9];
 const trees=createScannedTrees(scene,[{treeId:9,x:4,y:0,z:7,height:10,radius:3}],[fallback],{groundAt:()=>-.3,enabled:true,load:async()=>{throw Error('offline');}});await trees.ready;fallback.getMatrixAt(0,m);assert.ok(Math.abs(new THREE.Vector3(0,-3,0).applyMatrix4(m).y+.3)<1e-6);trees.dispose();fallback.getMatrixAt(0,m);assert.ok(Math.abs(new THREE.Vector3(0,-3,0).applyMatrix4(m).y+.3)<1e-6);
});

test('actual scan tiers fit broadleaf proportions without widening footprints or moving roots, and fallbacks retain that fit',async()=>{
 const load=async url=>{
  const path=new URL(url,'https://tree-assets.invalid').pathname,bytes=readFileSync(new URL('../public'+path,import.meta.url)),loader=new GLTFLoader();
  // Geometry and source transforms are real; only browser image decoding is stubbed.
  loader.register(()=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 };
 for(const low of [true,false]){
  const scene=new THREE.Scene(),candidates=[{treeId:0,x:0,y:1.5,z:0,height:20,radius:3.3},{treeId:1,x:160,y:1.5,z:0,height:12,radius:3.3}],before=structuredClone(candidates);
  const fallback=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial(),2),matrix=new THREE.Matrix4(),point=new THREE.Vector3(),height=3.3*SCANNED_TREE_SHAPE.maxHeightToRadius;
  fallback.userData.treeIds=[0,1];
  for(const p of candidates){matrix.makeScale(p.radius*2,p.height,p.radius*2);matrix.setPosition(p.x,p.y+p.height/2,p.z);fallback.setMatrixAt(p.treeId,matrix);}
  const groundAt=x=>3+x*.01,trees=createScannedTrees(scene,candidates,[fallback],{low,enabled:true,load,groundAt});
  const checkFallback=()=>{for(const p of candidates){fallback.getMatrixAt(p.treeId,matrix);assert.ok(Math.abs(matrix.elements[5]-height)<1e-5);assert.ok(Math.abs(matrix.elements[13]-height/2-groundAt(p.x))<1e-5);assert.ok(Math.abs(matrix.elements[0]-p.radius*2)<1e-5);assert.ok(Math.abs(matrix.elements[10]-p.radius*2)<1e-5);}};
  checkFallback();trees.update(1,{x:0,z:0});assert.equal(await trees.ready,true);assert.equal(trees.status.visible,1);assert.equal(trees.status.farVisible,1);assert.equal(trees.status.draws,6);
  for(const [tier,p]of candidates.entries()){
   let min=Infinity,max=-Infinity,radius=0;
   for(const mesh of trees.group.children.slice(tier*3,tier*3+3)){
    assert.equal(mesh.count,1);mesh.getMatrixAt(0,matrix);
    for(let vertex=0;vertex<mesh.geometry.attributes.position.count;vertex++){
     point.fromBufferAttribute(mesh.geometry.attributes.position,vertex).applyMatrix4(matrix);min=Math.min(min,point.y);max=Math.max(max,point.y);radius=Math.max(radius,Math.hypot(point.x-p.x,point.z-p.z));
    }
   }
   assert.ok(Math.abs(min-groundAt(p.x))<1e-5,'the real lowest tree vertex stays planted');
   assert.ok(Math.abs(max-min-height)<1e-5,'near and far trees have the same fitted total height');
   assert.ok(radius<=p.radius+1e-5,'the complete loaded canopy retains its cleared footprint');
   assert.ok(max-min>7,'small broadleaf slots remain trees rather than shrubs');
  }
  assert.deepEqual(candidates,before,'fitting does not rewrite shared scenery/collision placements');
  trees.update(2,{x:2000,z:0});assert.equal(fallback.count,2);checkFallback();trees.dispose();checkFallback();fallback.geometry.dispose();fallback.material.dispose();fallback.dispose();
 }
});
