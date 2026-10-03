import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {createSpectatorLibrary,SPECTATOR_ASSETS} from '../src/realistic-spectator.js';
import {createCrowd,spectatorProfile} from '../src/crowd.js';
import {CROWD_MOTION,MEDIUM_CROWD_BUDGET,createMediumVariant,createMediumCrowd,crowdMotionFrame} from '../src/medium-spectator.js';

const fixtures=[];
for(const asset of SPECTATOR_ASSETS){
 const roots=[];
 for(const suffix of ['', '-crowd']){
  const bytes=await readFile(new URL(`../public/assets/crowd/${asset.id}${suffix}.glb`,import.meta.url));
  const loader=new GLTFLoader();loader.register(()=>({name:'test-images',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
  roots.push((await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene);
 }
 const bytes=await readFile(new URL(`../public/assets/crowd/${asset.id}-motion.bin`,import.meta.url));
 fixtures.push({source:roots[0],geometry:roots[1],palette:new Uint16Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))});
}

test('six reduced human meshes share original images and have bounded geometry and finite animation',async()=>{
 for(const [i,fixture] of fixtures.entries()){
  const filename=new URL(`../public/assets/crowd/${SPECTATOR_ASSETS[i].id}-crowd.glb`,import.meta.url),bytes=await readFile(filename);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert.ok(!json.images&&!json.textures,'no duplicate wardrobe texture downloads');
  assert.ok((await stat(filename)).size<MEDIUM_CROWD_BUDGET.maxGeometryBytes);
  const variant=createMediumVariant(fixture.source,fixture.geometry,fixture.palette);
  assert.ok(variant.meshes.reduce((n,mesh)=>n+mesh.geometry.index.count/3,0)<=MEDIUM_CROWD_BUDGET.maxTriangles);
  assert.ok(variant.meshes.length<=3);assert.ok(variant.meshes.every(mesh=>mesh.material.map),'every reduced primitive reuses its original texture');
  assert.ok(variant.meshes.every(mesh=>Object.values(mesh.geometry.attributes).every(attribute=>attribute.array.every(Number.isFinite))));
  for(const mesh of variant.meshes){
   const {position,crowdGarment}=mesh.geometry.attributes;
   assert.ok(crowdGarment.array.every(value=>value>=0&&value<=1));
   if(mesh.material.name==='Skin_and_cloth_atlas'){
    assert.ok(crowdGarment.array.some(value=>value>.5),'the fabric mask contains real garment vertices');
    for(let v=0;v<position.count;v++)if(position.getY(v)>1.45)assert.equal(crowdGarment.getX(v),0,'face and eyes retain their original skin/eye colours');
   }else assert.ok(crowdGarment.array.every(value=>value===0),'hair and eyebrows cannot be recoloured by the fabric tint');
  }
  const floats=Float32Array.from(fixture.palette,THREE.DataUtils.fromHalfFloat);assert.ok(floats.every(Number.isFinite));
  const stride=CROWD_MOTION.bones*16;
  for(let clip=0;clip<CROWD_MOTION.clips;clip++){
   const first=clip*CROWD_MOTION.frames*stride,last=first+(CROWD_MOTION.frames-1)*stride;
   assert.deepEqual(floats.slice(first,first+stride),floats.slice(last,last+stride),'the animation loop closes without a jump');
  }
  variant.dispose();
 }
});

test('the actual half-float GPU skinning data keeps every gesture seated or standing with intact human bounds',()=>{
 const bone=new THREE.Matrix4(),point=new THREE.Vector3(),weighted=new THREE.Vector3(),input=new THREE.Vector3();
 for(const fixture of fixtures){
  const floats=Float32Array.from(fixture.palette,THREE.DataUtils.fromHalfFloat);
  for(let row=0;row<CROWD_MOTION.frames*CROWD_MOTION.clips;row+=3){
   const bounds=new THREE.Box3();fixture.geometry.traverse(object=>{if(!object.isSkinnedMesh)return;
    const attributes=object.geometry.attributes;
    for(let index=0;index<attributes.position.count;index+=7){
     input.fromBufferAttribute(attributes.position,index).applyMatrix4(object.bindMatrix);weighted.set(0,0,0);
     for(let influence=0;influence<4;influence++){
      const joint=attributes.skinIndex.array[index*4+influence],weight=attributes.skinWeight.array[index*4+influence];
      bone.fromArray(floats,(row*CROWD_MOTION.bones+joint)*16);point.copy(input).applyMatrix4(bone);weighted.addScaledVector(point,weight);
     }
     weighted.applyMatrix4(object.bindMatrixInverse);bounds.expandByPoint(weighted);
    }
   });
   const size=bounds.getSize(new THREE.Vector3());assert.ok(size.y>1&&size.y<2.3);assert.ok(size.x<1.5&&size.z<1.3);assert.ok(bounds.min.y>-.13);
  }
 }
});

test('instanced motion is independent per person and stays in the correct seated gesture clip',()=>{
 const person={...spectatorProfile(0,0,0,0,true,()=>.5),gesture:4};
 for(const time of [0,.1,2,2000]){const frame=crowdMotionFrame(person,time);assert.ok(frame[0]>=144&&frame[1]<160&&frame[2]>=0&&frame[2]<=1);}
 assert.notDeepEqual(crowdMotionFrame(person,2),crowdMotionFrame({...person,phase:.2,tempo:.8},2));
 const fixture=fixtures[0],variant=createMediumVariant(fixture.source,fixture.geometry,fixture.palette,{capacity:3});
 variant.update(Array.from({length:9},(_,i)=>({...person,x:i})),2);assert.ok(variant.meshes.every(mesh=>mesh.count===3),'capacity cannot grow');
 const tracked=[variant.texture,...variant.meshes.flatMap(mesh=>[mesh.geometry,mesh.material])],counts=new Map(tracked.map(item=>[item,0]));for(const item of tracked)item.addEventListener('dispose',()=>counts.set(item,counts.get(item)+1));
 variant.dispose();variant.dispose();assert.ok([...counts.values()].every(count=>count===1));
});

test('near, textured middle and distant people are exclusive; pause, reduced motion and disposal remain bounded',async()=>{
 const library=createSpectatorLibrary({enabled:true,load:async url=>{const index=SPECTATOR_ASSETS.findIndex(asset=>url.includes(asset.id));return {scene:cloneSkeleton(url.includes('-crowd')?fixtures[index].geometry:fixtures[index].source)};}});
 const crowd=createCrowd({low:true,spectatorLibrary:library,mediumOptions:{enabled:true,loadPalette:async index=>fixtures[index].palette}}),scene=new THREE.Scene();
 for(let i=0;i<90;i++)crowd.add((i%15)*.6,0,Math.floor(i/15)*.9,0,i%2===0,()=>.5);
 crowd.render(scene);await new Promise(resolve=>setTimeout(resolve,40));crowd.update(.1,{x:0,z:0,speed:20});
 const info=scene.userData.crowd;assert.equal(info.activeCharacters,6);assert.equal(info.mediumCharacters,48);assert.ok(info.mediumDrawCalls<=18);assert.ok(info.drawCalls<=52);
 const heads=scene.children.find(mesh=>mesh.name==='race-spectators-heads');assert.equal(heads.count+info.activeCharacters+info.mediumCharacters,90);
 const meshes=scene.children.filter(mesh=>mesh.name==='race-spectators-textured-medium');const snapshots=()=>meshes.map(mesh=>Array.from(mesh.geometry.attributes.crowdFrames.array));
 const initial=snapshots();crowd.update(.3,{x:0,z:0,speed:20},{paused:true});assert.deepEqual(snapshots(),initial);
 crowd.update(.5,{x:0,z:0,speed:20},{reducedMotion:true});assert.deepEqual(snapshots(),initial);
 crowd.update(.7,{x:1000,z:0,speed:20});assert.equal(info.mediumCharacters,0);assert.ok(meshes.every(mesh=>mesh.count===0));
 crowd.dispose();crowd.dispose();assert.equal(scene.children.length,0);
});

test('a failed or late medium request never hides the fallback or revives disposed geometry',async()=>{
 const scene=new THREE.Scene();const failed=createMediumCrowd({enabled:true,library:{get:async()=>fixtures[0].source,getMedium:async()=>null}});failed.render(scene);await failed.ready;assert.equal(failed.select([{inRange:true,viewDistance:2,lookVariant:0}]).length,0);failed.dispose();
 let finish;const late=createMediumCrowd({enabled:true,library:{get:async()=>fixtures[0].source,getMedium:async()=>fixtures[0].geometry},loadPalette:()=>new Promise(resolve=>finish=resolve)});late.render(scene);await new Promise(resolve=>setImmediate(resolve));late.dispose();finish(fixtures[0].palette);await late.ready;assert.equal(scene.children.length,0);
});
