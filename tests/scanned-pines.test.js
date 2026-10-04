import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createScannedTrees,SCANNED_TREE_BUDGET} from '../src/scanned-trees.js';
import {SCANNED_PINE_VARIANTS,SCANNED_PINE_SHAPE} from '../src/scanned-pine-manifest.js';
import {getTrack} from '../src/track.js';
import {getVenueProfile,venueSceneryLayout,grandstandLayout} from '../src/world.js';
import {originalLandmarkLayout} from '../src/original-venues.js';
import {showcaseLayout} from '../src/showcase-venues.js';
import {createInlandRelief,coastalGroundAt} from '../src/venue-groundworks.js';
import {createSpatialInstances} from '../src/spatial-detail.js';
import {coniferBoughGeometry} from '../src/vegetation-geometry.js';

const asset=file=>readFileSync(new URL('../public/assets/environments/trees/'+file,import.meta.url));
const close=(actual,expected,message,tolerance=1e-5)=>assert.ok(Math.abs(actual-expected)<tolerance,`${message}: ${actual} versus ${expected}`);
const limits={desktop:{bytes:700000,triangles:900,texture:1440},mobile:{bytes:400000,triangles:900,texture:1008},desktopFar:{bytes:225000,triangles:550,texture:720},mobileFar:{bytes:140000,triangles:450,texture:504}};

function readGlb(bytes){
 assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const jsonLength=bytes.readUInt32LE(12);assert.equal(bytes.toString('ascii',16,20),'JSON');
 const gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength)),binaryStart=28+jsonLength;
 assert.equal(bytes.readUInt32LE(24+jsonLength),0x004e4942);assert.equal(binaryStart+bytes.readUInt32LE(20+jsonLength),bytes.length);
 const viewBytes=index=>{const view=gltf.bufferViews[index];assert.equal(view.buffer,0);const start=binaryStart+(view.byteOffset||0);assert.ok(start+view.byteLength<=bytes.length);return bytes.subarray(start,start+view.byteLength);};
 const values=index=>{
  const accessor=gltf.accessors[index],view=gltf.bufferViews[accessor.bufferView],width={SCALAR:1,VEC2:2,VEC3:3}[accessor.type];
  const component={5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']}[accessor.componentType];
  assert.ok(width&&component,'delivered attributes use readable numeric components');assert.equal(accessor.sparse,undefined);
  const [size,read]=component,raw=viewBytes(accessor.bufferView),stride=view.byteStride||width*size,offset=accessor.byteOffset||0;
  assert.ok(offset+(accessor.count-1)*stride+width*size<=raw.length,'accessor stays inside its buffer view');
  return Array.from({length:accessor.count*width},(_,i)=>raw[read](offset+Math.floor(i/width)*stride+i%width*size));
 };
 return {gltf,viewBytes,values};
}

function webpSize(bytes){
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.readUInt32LE(4)+8,bytes.length);
 const type=bytes.toString('ascii',12,16);
 if(type==='VP8X')return [1+bytes.readUIntLE(24,3),1+bytes.readUIntLE(27,3)];
 assert.equal(type,'VP8 ');assert.equal(bytes.toString('hex',23,26),'9d012a');
 return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
}

test('pine provenance pins the CC0 source geometry, photographs and opacity inputs',()=>{
 const record=JSON.parse(asset('pine-provenance.json'));
 assert.equal(record.asset,'https://polyhaven.com/a/pine_sapling_small');assert.equal(record.license,'CC0-1.0');assert.equal(record.licenseUrl,'https://polyhaven.com/license');
 assert.deepEqual(record.authors,{'Rico Cilliers':'Modeling','Rob Tuytel':'Photography'});
 // Originals stay outside the shipped repository. Pin their verified primary-source
 // checksums here so replacing a source cannot silently retain the old provenance.
 const sources={
  'source.gltf':'237a7672645631550ae571743aa9f55b',
  'source.blend':'6be94b5523379bf3e8c7ccdf0b7356ff',
  'pine_sapling_small.bin':'76dd1802d8de128c812f2e124a258b35',
  'textures/pine_sapling_small_bark_diff_1k.jpg':'7d3a558ed614c7e75594c7be3bf80311',
  'textures/pine_sapling_small_twig_diff_1k.jpg':'dacc918bb421968e9ccc1956d78a2dbe',
  'textures/pine_sapling_small_twig_mask_1k.png':'07f39f7450a4c5d9d812cf7cf73bceb6',
  'textures/pine_sapling_small_twig_alpha_1k.png':'9890eccee0444fd263dad2133338583f',
 };
 for(const [file,md5]of Object.entries(sources)){
  const source=record.sourceFiles[file];assert.equal(source.md5,md5,file);assert.ok(source.size>0);
  const url=new URL(source.url);assert.equal(url.protocol,'https:');assert.equal(url.hostname,'dl.polyhaven.org');assert.match(url.pathname,/\/pine_sapling_small\//);
  if(file.startsWith('textures/')){const original=file.endsWith('.png')?'source.blend':'source.gltf';assert.deepEqual(source,record.sourceFiles[original].include[file]);}
 }
 assert.deepEqual(record.sourceFiles['pine_sapling_small.bin'],record.sourceFiles['source.gltf'].include['pine_sapling_small.bin']);
 assert.deepEqual(record.sourceGeometry,{trunkTriangles:540,foliageTriangles:141966,twigGroups:27});
 assert.deepEqual(Object.keys(record.variants).sort(),Object.keys(limits).sort());
 assert.deepEqual(record.variants,SCANNED_PINE_VARIANTS);
});

test('all delivered pine GLBs retain two bounded textured batches, valid geometry and rooted matching bounds',()=>{
 const reference=SCANNED_PINE_VARIANTS.desktop;
 for(const [tier,variant]of Object.entries(SCANNED_PINE_VARIANTS)){
  const bytes=asset(variant.file),{gltf:g,viewBytes,values}=readGlb(bytes),bound=limits[tier];
  assert.equal(bytes.length,variant.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);assert.ok(bytes.length<=bound.bytes,tier+' download budget');
  assert.equal(g.buffers.length,1);assert.equal(g.buffers[0].uri,undefined);assert.equal(g.materials.length,2);assert.equal(g.meshes.length,2);assert.equal(g.images.length,2);assert.equal(variant.embeddedImages,2);
  assert.deepEqual(g.extensionsRequired,['EXT_texture_webp']);
  const primitives=g.meshes.flatMap(mesh=>mesh.primitives);assert.equal(primitives.length,2);assert.equal(variant.primitives,2);assert.deepEqual(new Set(primitives.map(p=>p.material)),new Set([0,1]));
  let triangles=0,minY=Infinity,maxY=-Infinity,radius=0;
  for(const p of primitives){
   assert.equal(p.mode??4,4);assert.deepEqual(Object.keys(p.attributes).sort(),['NORMAL','POSITION','TEXCOORD_0']);
   const positions=values(p.attributes.POSITION),indices=values(p.indices),normals=values(p.attributes.NORMAL),uv=values(p.attributes.TEXCOORD_0),count=positions.length/3;
   assert.equal(indices.length%3,0);assert.ok(indices.every(i=>Number.isInteger(i)&&i>=0&&i<count));triangles+=indices.length/3;
   assert.equal(normals.length,positions.length);assert.equal(uv.length,count*2);
   for(const array of [positions,normals,uv])assert.ok(array.every(Number.isFinite));
   for(let i=0;i<positions.length;i+=3){
    minY=Math.min(minY,positions[i+1]);maxY=Math.max(maxY,positions[i+1]);radius=Math.max(radius,Math.hypot(positions[i],positions[i+2]));
    close(Math.hypot(normals[i],normals[i+1],normals[i+2]),1,'unit lighting normal');
   }
  }
  assert.equal(triangles,variant.triangles);assert.ok(triangles<=bound.triangles,tier+' geometry budget');
  assert.equal(variant.minY,0);close(minY,0,'root is at zero');close(maxY-minY,variant.height,'recorded height');close(radius,variant.radius,'recorded footprint');
  close(variant.height,reference.height,'tiers retain the same height');close(variant.radius,reference.radius,'tiers retain the same radius');
  const foliageIndex=g.materials.findIndex(m=>m.alphaMode==='MASK'),foliage=g.materials[foliageIndex];assert.ok(foliage);assert.equal(foliage.alphaCutoff,.36);assert.equal(foliage.alphaCutoff,variant.alphaCutoff);assert.equal(foliage.doubleSided,false,'opposing front faces preserve authored needle normals');
  const cards=primitives.find(p=>p.material===foliageIndex);assert.equal(variant.twigGroups,27);assert.equal(variant.canopyCards,27*3);assert.equal(g.accessors[cards.indices].count,variant.canopyCards*12);assert.equal(g.accessors[cards.attributes.POSITION].count,variant.canopyCards*8);
  const foliageImage=g.textures[foliage.pbrMetallicRoughness.baseColorTexture.index].extensions.EXT_texture_webp.source;
  for(const [index,img]of g.images.entries()){
   assert.equal(img.uri,undefined);assert.equal(img.mimeType,'image/webp');const raw=viewBytes(img.bufferView),dimensions=webpSize(raw);
   assert.deepEqual(dimensions,variant.textureDimensions[index]);assert.ok(dimensions.every(n=>n>0&&n<=bound.texture),tier+' texture budget');
   if(index===foliageImage){assert.equal(raw.toString('ascii',12,16),'VP8X');assert.ok(raw[20]&0x10,'the actual needle image retains transparency');}
  }
 }
 assert.ok(SCANNED_PINE_VARIANTS.mobile.bytes+SCANNED_PINE_VARIANTS.mobileFar.bytes<=525000,'combined phone tree download');
 assert.ok(reference.bytes+SCANNED_PINE_VARIANTS.desktopFar.bytes<=900000,'combined desktop tree download');
});

test('real pine tiers uniformly fit both height- and radius-limited slots, retaining ground contact in four draws',async()=>{
 const load=async url=>{
  const path=new URL(url,'https://tree-assets.invalid').pathname,bytes=readFileSync(new URL('../public'+path,import.meta.url)),loader=new GLTFLoader();
  // Actual geometry, materials and transforms are parsed; only browser image
  // decoding is replaced because Node has no browser image decoder.
  loader.register(()=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 };
 for(const low of [true,false]){
  const scene=new THREE.Scene(),candidates=[
   {treeId:0,x:0,y:1.5,z:0,height:6,radius:3.3,yaw:.4},
   {treeId:1,x:12,y:1.5,z:8,height:20,radius:3.3,yaw:1.2},
   {treeId:2,x:200,y:1.5,z:-4,height:6,radius:3.3,yaw:-.6},
   {treeId:3,x:212,y:1.5,z:9,height:20,radius:3.3,yaw:2},
  ],before=structuredClone(candidates),requests=[],groundAt=(x,z)=>-.3+x*.01-z*.003;
  const trees=createScannedTrees(scene,candidates,[],{low,enabled:true,variants:SCANNED_PINE_VARIANTS,shape:SCANNED_PINE_SHAPE,groundAt,load:url=>{requests.push(url);return load(url);}});
  try{
   trees.update(1,{x:0,z:0});assert.equal(await trees.ready,true);assert.equal(trees.status.draws,4);assert.equal(trees.group.children.length,4);assert.equal(trees.status.visible,2);assert.equal(trees.status.farVisible,2);
   const keys=low?['mobile','mobileFar']:['desktop','desktopFar'];assert.equal(requests.length,2);
   const bounds=[],matrix=new THREE.Matrix4(),point=new THREE.Vector3(),scale=new THREE.Vector3();
   for(const [tier,key]of keys.entries()){
    const variant=SCANNED_PINE_VARIANTS[key],url=new URL(requests[tier],'https://tree-assets.invalid');assert.equal(url.pathname,'/assets/environments/trees/'+variant.file);assert.equal(url.searchParams.get('v'),variant.sha256);
    const meshes=trees.group.children.slice(tier*2,tier*2+2);assert.ok(meshes.some(m=>m.material.alphaTest===variant.alphaCutoff));
    for(let index=0;index<2;index++){
     const p=candidates[tier*2+index],expectedScale=Math.min(p.height/variant.height,p.radius/variant.radius);let min=Infinity,max=-Infinity,radius=0;
     for(const mesh of meshes){
      assert.equal(mesh.count,2);assert.equal(mesh.castShadow,false);mesh.getMatrixAt(index,matrix);scale.setFromMatrixScale(matrix);
      for(const axis of ['x','y','z'])close(scale[axis],expectedScale,'uniform '+axis+' scale');
      close(matrix.elements[12],p.x,'root x');close(matrix.elements[14],p.z,'root z');
      for(let vertex=0;vertex<mesh.geometry.attributes.position.count;vertex++){
       point.fromBufferAttribute(mesh.geometry.attributes.position,vertex).applyMatrix4(matrix);min=Math.min(min,point.y);max=Math.max(max,point.y);radius=Math.max(radius,Math.hypot(point.x-p.x,point.z-p.z));
      }
     }
     close(min,groundAt(p.x,p.z),'real root contacts sampled terrain');close(max-min,variant.height*expectedScale,'fitted height');close(radius,variant.radius*expectedScale,'natural crown width');
     assert.ok(max-min<=p.height+1e-5);assert.ok(radius<=p.radius+1e-5,'no vertex leaves its cleared footprint');
     bounds.push({height:max-min,radius});
    }
   }
   for(let i=0;i<2;i++){close(bounds[i].height,bounds[i+2].height,'near/far height consistency');close(bounds[i].radius,bounds[i+2].radius,'near/far width consistency');}
   assert.equal(trees.status.triangles,keys.reduce((sum,key)=>sum+2*SCANNED_PINE_VARIANTS[key].triangles,0));assert.deepEqual(candidates,before,'fitting leaves shared placements unchanged');
  }finally{trees.dispose();}
 }
});

test('pine replacement compacts every trunk and bough once, restores fitted pieces after travel/disposal, and survives load failure',async()=>{
 const load=async url=>{
  const file=new URL(url,'https://tree-assets.invalid').pathname.split('/').at(-1),bytes=asset(file),loader=new GLTFLoader();
  loader.register(()=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 };
 const groundAt=(x,z)=>-.7+x*.006-z*.02,reference=SCANNED_PINE_VARIANTS.desktop;
 const makeFallback=candidates=>{
  const group=new THREE.Group(),parts=[],dummy=new THREE.Object3D();
  for(const foliage of [false,true]){
   const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial(),candidates.length*(foliage?3:1)),items=[];
   for(const p of candidates)for(let layer=0;layer<(foliage?3:1);layer++){
    dummy.position.set(p.x+(foliage?(layer-1)*p.radius*.12:0),p.y+p.height*(foliage?.50+layer*.17:.35),p.z+(foliage?(layer-2)*p.radius*.09:0));
    dummy.rotation.set(foliage?(layer-1)*.08:0,foliage?.3+layer*.4:0,0);
    dummy.scale.set(foliage?p.radius*(1-layer*.23):.3,p.height*(foliage?.35-layer*.04:.7),foliage?p.radius*(1-layer*.23):.3);dummy.updateMatrix();
    mesh.setMatrixAt(items.length,dummy.matrix);const matrix=new THREE.Matrix4();mesh.getMatrixAt(items.length,matrix);items.push({p,matrix});
   }
   mesh.userData.treeIds=items.map(({p})=>p.treeId);group.add(mesh);parts.push({mesh,items});
  }
  return {group,parts,dispose(){for(const {mesh}of parts){mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();}group.removeFromParent();}};
 };
 const checkFallback=(fallback,hidden=new Set())=>{
  let visiblePieces=0;const actualMatrix=new THREE.Matrix4(),point=new THREE.Vector3(),original=new THREE.Vector3();
  // The center and three independent local directions catch both pivot translation
  // and horizontal/vertical fitting, including the tilted, offset bough pieces.
  const probes=[[0,0,0],[1,0,0],[0,1,0],[0,0,1],[0,-.5,0]];
  for(const {mesh,items}of fallback.parts){
   const visible=items.filter(({p})=>!hidden.has(p.treeId));assert.equal(mesh.count,visible.length,'only the selected trees lose fallback pieces');visiblePieces+=mesh.count;
   for(const [index,{p,matrix}]of visible.entries()){
    mesh.getMatrixAt(index,actualMatrix);const fit=Math.min(p.height/reference.height,p.radius/reference.radius),height=reference.height*fit,radius=reference.radius*fit;
    for(const probe of probes){
     original.set(...probe).applyMatrix4(matrix);point.set(...probe).applyMatrix4(actualMatrix);
     close(point.x,p.x+(original.x-p.x)*radius/p.radius,'fallback fits about its own x root',3e-5);
     close(point.y,groundAt(p.x,p.z)+(original.y-p.y)*height/p.height,'fallback height fits about the sampled ground',3e-5);
     close(point.z,p.z+(original.z-p.z)*radius/p.radius,'fallback fits about its own z root',3e-5);
    }
    if(mesh===fallback.parts[0].mesh){point.set(0,-.5,0).applyMatrix4(actualMatrix);close(point.y,groundAt(p.x,p.z),'fallback trunk root contacts terrain');}
   }
  }
  assert.equal(visiblePieces,(fallback.parts[0].items.length-hidden.size)*4,'each unselected tree retains exactly one trunk and three boughs');
 };
 for(const low of [true,false]){
  const nearCapacity=low?SCANNED_TREE_BUDGET.mobile:SCANNED_TREE_BUDGET.desktop,farCapacity=low?SCANNED_TREE_BUDGET.mobileFar:SCANNED_TREE_BUDGET.desktopFar;
  const candidates=Array.from({length:nearCapacity+farCapacity+3},(_,treeId)=>({treeId,x:10+treeId*2,y:2.5,z:4,height:treeId%2?20:6,radius:3.3,yaw:treeId*.2}));
  const fallback=makeFallback(candidates),scene=new THREE.Scene();scene.add(fallback.group);
  const trees=createScannedTrees(scene,candidates,[fallback.group],{low,enabled:true,variants:SCANNED_PINE_VARIANTS,shape:SCANNED_PINE_SHAPE,groundAt,load});
  const selectedTrees=()=>{
   const selected=new Set(),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
   for(let tier=0;tier<2;tier++){
    const meshes=trees.group.children.slice(tier*2,tier*2+2),capacity=tier?farCapacity:nearCapacity;assert.equal(meshes[0].count,capacity);
    for(let index=0;index<capacity;index++){
     meshes[0].getMatrixAt(index,matrix);const p=candidates.find(p=>Math.abs(p.x-matrix.elements[12])<1e-5);assert.ok(p);assert.ok(!selected.has(p.treeId),'no tree appears in both tiers or twice in one tier');selected.add(p.treeId);
     let bottom=Infinity;for(const mesh of meshes){
      assert.equal(mesh.count,capacity);mesh.getMatrixAt(index,matrix);const vertices=mesh.geometry.attributes.position;
      for(let vertex=0;vertex<vertices.count;vertex++){point.fromBufferAttribute(vertices,vertex).applyMatrix4(matrix);bottom=Math.min(bottom,point.y);}
     }
     close(bottom,groundAt(p.x,p.z),'loaded tree root matches the fallback ground');
    }
   }
   assert.equal(selected.size,nearCapacity+farCapacity);return selected;
  };
  try{
   checkFallback(fallback);
   const fittedFirst=new THREE.Matrix4();fallback.parts[1].mesh.getMatrixAt(0,fittedFirst);assert.ok(new THREE.Vector3().setFromMatrixScale(fittedFirst).x<candidates[0].radius,'height-limited pine narrows its fallback crown');
   trees.update(1,{x:candidates[0].x,z:4});assert.equal(await trees.ready,true);assert.equal(trees.status.visible,nearCapacity);assert.equal(trees.status.farVisible,farCapacity);
   const first=selectedTrees();checkFallback(fallback,first);
   trees.update(2,{x:candidates.at(-1).x,z:4});const moved=selectedTrees();assert.notDeepEqual(moved,first,'travel replaces selected tree identities');checkFallback(fallback,moved);
   trees.update(3,{x:10000,z:10000});assert.equal(trees.status.visible+trees.status.farVisible,0);checkFallback(fallback);
   trees.update(4,{x:candidates[0].x,z:4});checkFallback(fallback,selectedTrees());trees.dispose();trees.dispose();checkFallback(fallback);assert.equal(trees.group.parent,null);
  }finally{trees.dispose();fallback.dispose();}
  const failedFallback=makeFallback(candidates.slice(0,2)),failed=createScannedTrees(new THREE.Scene(),candidates.slice(0,2),[failedFallback.group],{low,enabled:true,variants:SCANNED_PINE_VARIANTS,shape:SCANNED_PINE_SHAPE,groundAt,load:async()=>{throw Error('pine download unavailable');}});
  try{assert.equal(await failed.ready,false);assert.equal(failed.status.state,'fallback');failed.update(1,{x:10,z:4});checkFallback(failedFallback);assert.equal(failedFallback.parts.reduce((n,{mesh})=>n+mesh.count,0),8);failed.dispose();checkFallback(failedFallback);}
  finally{failed.dispose();failedFallback.dispose();}
 }
});

test('real conifer fallback bounds contain terrain-fitted vertices and retain the full population through tier changes',async()=>{
 const load=async url=>{
  const bytes=asset(new URL(url,'https://tree-assets.invalid').pathname.split('/').at(-1)),loader=new GLTFLoader();
  loader.register(()=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 };
 for(const id of ['cedar-ridge','norway-fjord'])for(const low of [true,false]){
  const scene=new THREE.Scene(),track=getTrack(id),venue=getVenueProfile(track),decorations=venueSceneryLayout(track,{low}),stands=grandstandLayout(track);
  const landmarks=[...originalLandmarkLayout(track,{stands,low}),...showcaseLayout(track,{stands})];
  const relief=createInlandRelief(scene,track,venue,{low,occupied:[...decorations,...stands.map(s=>({...s,radius:16})),...landmarks]});
  const candidates=decorations.map((p,treeId)=>({...p,treeId,y:0})).filter(p=>p.kind==='tree'),trunks=[],boughs=[];
  for(const p of candidates){
   trunks.push({treeId:p.treeId,x:p.x,z:p.z,y:p.height*.29,sx:.18,sy:p.height*.58,sz:.18});
   for(let layer=0;layer<3;layer++)boughs.push({treeId:p.treeId,x:p.x,z:p.z,y:p.height*(.50+layer*.17),sx:p.radius*(1-layer*.23),sy:p.height*(.35-layer*.04),sz:p.radius*(1-layer*.23),ry:p.yaw});
  }
  const fallbacks=[
   createSpatialInstances(scene,new THREE.CylinderGeometry(1,1.1,1,6),new THREE.MeshStandardMaterial(),trunks,{partitionThreshold:48}),
   createSpatialInstances(scene,coniferBoughGeometry({low}),new THREE.MeshStandardMaterial(),boughs),
  ];
  const records=[];for(const group of fallbacks)group.traverse(mesh=>{if(mesh.isInstancedMesh)records.push({mesh,count:mesh.count,oldBox:mesh.boundingBox.clone(),oldSphere:mesh.boundingSphere.clone()});});
  const trees=createScannedTrees(scene,candidates,fallbacks,{low,enabled:true,variants:SCANNED_PINE_VARIANTS,shape:SCANNED_PINE_SHAPE,groundAt:(x,z)=>coastalGroundAt(relief,x,z),load});
  const visitVertices=(mesh,check)=>{
   const matrix=new THREE.Matrix4(),point=new THREE.Vector3(),positions=mesh.geometry.attributes.position;
   for(let index=0;index<mesh.count;index++){mesh.getMatrixAt(index,matrix);for(let vertex=0;vertex<positions.count;vertex++)check(point.fromBufferAttribute(positions,vertex).applyMatrix4(matrix));}
  };
  try{
   let oldBoxMisses=0,oldSphereMisses=0;
   for(const record of records){
    const {mesh,oldBox,oldSphere}=record;assert.equal(mesh.count,record.count,'bounds are fitted before any instances are compacted');
    record.fullBox=mesh.boundingBox.clone();record.fullSphere=mesh.boundingSphere.clone();
    const paddedOld=oldBox.clone().expandByScalar(1e-5);
    visitVertices(mesh,point=>{if(!paddedOld.containsPoint(point))oldBoxMisses++;if(point.distanceTo(oldSphere.center)>oldSphere.radius+1e-5)oldSphereMisses++;});
   }
   assert.ok(oldBoxMisses>0,`${id} ${low?'mobile':'desktop'} actually moves vertices outside the original cached box`);
   if(!low)assert.ok(oldSphereMisses>0,id+' desktop reproduces vertices outside the original cached sphere');
   const checkBounds=stage=>{
    for(const {mesh,fullBox,fullSphere}of records){
     assert.deepEqual(mesh.boundingBox,fullBox,stage+' retains the complete fitted box');assert.deepEqual(mesh.boundingSphere,fullSphere,stage+' retains the complete fitted sphere');
     const paddedBox=fullBox.clone().expandByScalar(1e-5);
     visitVertices(mesh,point=>{assert.ok(paddedBox.containsPoint(point),stage+' real vertex is contained by the box');assert.ok(point.distanceTo(fullSphere.center)<=fullSphere.radius+1e-5,stage+' real vertex is contained by the sphere');});
    }
   };
   checkBounds('initial full population');
   trees.update(1,candidates[0]);assert.equal(await trees.ready,true);assert.ok(trees.status.visible>0);assert.ok(trees.status.farVisible>0);assert.ok(records.some(({mesh,count})=>mesh.count<count));checkBounds('near/far compaction');
   trees.update(2,candidates.at(-1));checkBounds('travel');
   trees.update(3,{x:10000,z:10000});assert.equal(trees.status.visible+trees.status.farVisible,0);for(const {mesh,count}of records)assert.equal(mesh.count,count);checkBounds('distant restoration');
   trees.update(4,candidates[0]);checkBounds('second selection');trees.dispose();for(const {mesh,count}of records)assert.equal(mesh.count,count);checkBounds('disposal restoration');
  }finally{
   trees.dispose();const geometries=new Set(),materials=new Set();scene.traverse(mesh=>{if(!mesh.isMesh)return;mesh.dispose?.();geometries.add(mesh.geometry);materials.add(mesh.material);});for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();scene.clear();
  }
 }
});
