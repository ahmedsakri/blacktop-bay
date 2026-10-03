import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCrowd, spectatorProfile, spectatorPose, spectatorSurfacePixels} from '../src/crowd.js';
import {SPECTATOR_GESTURES} from '../src/spectator-motion-config.js';
const random = () => {let s=37;return()=>((s=Math.imul(s,1664525)+1013904223)>>>0)/4294967296;};
const matrices=scene=>scene.children.filter(mesh=>mesh.isInstancedMesh).map(mesh=>Array.from(mesh.instanceMatrix.array));

test('crowd has human proportions, diverse people, and non-synchronous articulated poses',()=>{
 const rng=random(), people=Array.from({length:60},(_,i)=>spectatorProfile(i,0,0,0,i%2===0,rng));
 assert.ok(new Set(people.map(p=>p.skin)).size>=5);
 assert.ok(new Set(people.map(p=>p.shirt)).size>=8);
 assert.equal(new Set(people.map(p=>p.gesture)).size,SPECTATOR_GESTURES.length);
 assert.ok(people.some(p=>p.cap)&&people.some(p=>p.longHair)&&people.some(p=>p.sunglasses));
 for(const p of people){
  const pose=spectatorPose(p,2,1);
  assert.ok(pose.head>(p.seated?1.15:1.5)&&pose.head<(p.seated?1.27:1.66));
  for(const arm of pose.arms)for(const joint of [arm.shoulder,arm.elbow,arm.hand])assert.ok(joint.every(Number.isFinite));
  const standing={...p,seated:false};
  assert.ok(spectatorPose(standing).head+ .139<1.76,'heads stay in normal adult proportion');
 }
 assert.notDeepEqual(spectatorPose({...people[0],gesture:0},2,1).arms,spectatorPose({...people[1],gesture:0},2,1).arms);
});

test('most spectators watch quietly and relaxed standing wrists hang below the waist',()=>{
 const rng=random(),people=Array.from({length:512},()=>spectatorProfile(0,0,0,0,false,rng));
 assert.ok(people.filter(person=>person.gesture>=5).length>people.length*.55,'ordinary spectators should outnumber permanent cheering poses');
 for(const person of people.slice(0,24)){
  const pose=spectatorPose({...person,gesture:5},2,1);assert.equal(pose.mouth,0);
  assert.ok(pose.arms.every(arm=>arm.hand[1]<pose.hip),'idle arms must not all rest akimbo at the hips');
  assert.equal(spectatorPose({...person,gesture:6},2,1).mouth,0);
 }
});

test('pause and reduced motion freeze crowd transforms, with bounded mobile batches and distance LOD',()=>{
 const crowd=createCrowd({low:true}), scene=new THREE.Scene(),rng=random();
 for(let i=0;i<100;i++)crowd.add(i%10,0,Math.floor(i/10),0,i%2===0,rng);
 crowd.render(scene);
 assert.equal(scene.userData.spectatorCount,100);
 assert.equal(scene.children.filter(m=>m.isInstancedMesh).length,10,'distant crowd stays ten batched draws');assert.equal(scene.children.filter(m=>m.name==='near-spectator').length,6,'foreground is a fixed six-mesh mobile pool');
 assert.ok(scene.children.every(m=>m.isInstancedMesh||m.name==='near-spectator'));
 const initial=matrices(scene);
 crowd.update(.2,{x:0,z:0,speed:20},{paused:true});assert.deepEqual(matrices(scene),initial);
 crowd.update(.4,{x:0,z:0,speed:20},{reducedMotion:true});const still=matrices(scene);crowd.update(.45,{x:0,z:0,speed:20},{reducedMotion:true});assert.deepEqual(matrices(scene),still);
 const bodyBefore=Array.from(scene.children.find(m=>m.name==='race-spectators-torso').instanceMatrix.array);
 const nearSkinCount=scene.children.find(m=>m.name==='race-spectators-skin').count;
 crowd.update(.6,{x:1000,z:1000,speed:20});
 assert.deepEqual(Array.from(scene.children.find(m=>m.name==='race-spectators-torso').instanceMatrix.array),bodyBefore);
 assert.ok(scene.children.find(m=>m.name==='race-spectators-skin').count<nearSkinCount,'far facial details must be omitted from draw count');
 crowd.update(.8,{x:0,z:0,speed:20});assert.notDeepEqual(matrices(scene),initial);
 assert.ok(matrices(scene).flat().every(Number.isFinite));
 const moving=matrices(scene);
 crowd.update(1,{x:0,z:0,speed:20},{paused:true});assert.deepEqual(matrices(scene),moving);
 crowd.dispose();assert.equal(scene.children.length,0);crowd.dispose();
});

test('empty crowds and a single person with no optional accessories are safe',()=>{
 const scene=new THREE.Scene(),empty=createCrowd();empty.render(scene);empty.update(1);empty.dispose();
 const crowd=createCrowd();crowd.add(0,0,0,0,false,()=>.6);crowd.render(scene);crowd.update(1,{x:0,z:0,speed:20});
 assert.ok(scene.children.filter(m=>m.isInstancedMesh).every(m=>m.instanceMatrix.array.every(Number.isFinite)));crowd.dispose();
});

test('animated cheering keeps both arm bones at anatomical lengths without snapping at activation',()=>{
 const rng=random();
 for(let gesture=0;gesture<SPECTATOR_GESTURES.length;gesture++)for(const seated of [true,false]){
  const person={...spectatorProfile(0,0,0,0,seated,rng),gesture};
  for(const excitement of [0,.001,.07,.081,.25,.65,1])for(const time of [0,.2,1,4]){
   const pose=spectatorPose(person,time,excitement);
   for(const {shoulder,elbow,hand} of pose.arms){
    assert.ok(Math.abs(Math.hypot(...elbow.map((v,i)=>v-shoulder[i]))-.285)<1e-8);
    assert.ok(Math.abs(Math.hypot(...hand.map((v,i)=>v-elbow[i]))-.265)<1e-8);
   }
  }
  const before=spectatorPose(person,2,.079).arms,after=spectatorPose(person,2,.081).arms;
  assert.ok(before.every((arm,i)=>Math.hypot(...arm.hand.map((v,j)=>v-after[i].hand[j]))<.01),'a small excitement change cannot snap a wrist to a full cheering pose');
 }
});

test('spectators have garment silhouettes and personalised reaction timing within the same bounded draw set',()=>{
 const rng=random(),crowd=createCrowd({low:true}),scene=new THREE.Scene();
 const people=Array.from({length:90},(_,i)=>crowd.add(i*.8,0,i%3,0,i%2===0,rng));
 assert.equal(new Set(people.map(p=>p.garment)).size,3);
 assert.ok(people.some(p=>p.skirt)&&people.some(p=>p.longHair)&&people.some(p=>p.garment===1));
 assert.equal(new Set(people.map(p=>p.lookVariant)).size,6,'distant wardrobes match all six textured variants');
 assert.ok(new Set(people.map(p=>p.reactionDistance)).size>80);
 crowd.render(scene);crowd.update(.1,{x:0,z:0,speed:30});
 assert.ok(scene.children.filter(m=>m.isInstancedMesh).length<=10);assert.ok(scene.children.filter(m=>m.name==='near-spectator').length<=6);
 assert.ok(people.some(p=>p.parts.some(part=>part.faceDetail&&!part.kind.includes('heads'))));
 assert.ok(scene.children.filter(m=>m.isInstancedMesh).every(m=>Array.from(m.instanceMatrix.array).every(Number.isFinite)));
 crowd.dispose();
});

test('original micro-surfaces are deterministic, bounded and visibly distinct without replacing skin colors',()=>{
 const cotton=spectatorSurfacePixels('cotton',64),denim=spectatorSurfacePixels('denim',64),skin=spectatorSurfacePixels('skin',64);
 assert.deepEqual(spectatorSurfacePixels('cotton',64),cotton);
 assert.notDeepEqual(cotton.rgba,denim.rgba);assert.notDeepEqual(cotton.height,skin.height);
 for(const surface of [cotton,denim,skin]) {
  assert.equal(surface.rgba.length,64*64*4);assert.equal(surface.height.length,64*64*4);
  for(let i=0;i<surface.rgba.length;i+=4){
   assert.equal(surface.rgba[i],surface.rgba[i+1]);assert.equal(surface.rgba[i+1],surface.rgba[i+2],'neutral maps preserve instance skin/clothing tint');
   assert.equal(surface.rgba[i+3],255);assert.equal(surface.height[i+3],255);
  }
  assert.ok(new Set(surface.rgba).size>8,'maps have actual surface variation');
 }
 assert.equal(spectatorSurfacePixels('cotton',Infinity).size,128);
 assert.equal(spectatorSurfacePixels('cotton',1e6).size,128);
});

test('shared clothing and skin textures keep the ten-draw budget and release GPU resources exactly once',()=>{
 const crowd=createCrowd({low:true}),scene=new THREE.Scene(),rng=random();
 for(let i=0;i<120;i++)crowd.add(i%12,0,Math.floor(i/12),0,i%2===0,rng);
 crowd.render(scene);
 const torso=scene.children.find(mesh=>mesh.name==='race-spectators-torso');
 const head=scene.children.find(mesh=>mesh.name==='race-spectators-heads');
 const trousers=scene.children.find(mesh=>mesh.name==='race-spectators-trousers');
 assert.ok(torso.material.map&&torso.material.bumpMap&&head.material.map&&trousers.material.map);
 assert.notEqual(torso.material.map,head.material.map);assert.notEqual(torso.material.map,trousers.material.map);
 const textures=new Set(scene.children.flatMap(mesh=>[mesh.material?.map,mesh.material?.bumpMap]).filter(Boolean));
 assert.equal(textures.size,6);assert.ok(scene.children.filter(m=>m.isInstancedMesh).length<=10);assert.ok(scene.children.filter(m=>m.name==='near-spectator').length<=6);
 assert.ok([...textures].every(texture=>texture.image.width===64&&texture.image.height===64));
 const counts=new Map([...textures].map(texture=>[texture,0]));
 for(const texture of textures)texture.addEventListener('dispose',()=>counts.set(texture,counts.get(texture)+1));
 crowd.dispose();crowd.dispose();assert.ok([...counts.values()].every(count=>count===1));
});

test('foreground animation is smoother but capped; distant garment details leave the draw',()=>{
 const crowd=createCrowd({low:true}),scene=new THREE.Scene(),rng=random();
 const people=Array.from({length:35},(_,i)=>crowd.add(i*.35,0,3,0,false,rng));crowd.render(scene);
 let nearTicks=0,backgroundTicks=0,lastNear,lastBackground;
 for(let frame=1;frame<=120;frame++){
  crowd.update(frame/120,{x:0,z:0,speed:25});
  if(people[0].lastPoseTime!==lastNear){nearTicks++;lastNear=people[0].lastPoseTime;}
  if(people[34].lastPoseTime!==lastBackground){backgroundTicks++;lastBackground=people[34].lastPoseTime;}
  assert.ok(scene.userData.crowd.foregroundAnimated<=10);
 }
 assert.ok(nearTicks>backgroundTicks);assert.ok(nearTicks<=31&&backgroundTicks<=16);
 const details=scene.children.find(mesh=>mesh.name==='race-spectators-details'),nearCount=details.count;
 crowd.update(1.2,{x:500,z:500,speed:25});assert.ok(details.count<nearCount,'laces and seams should not consume distant instance draws');
 crowd.update(1.4,{x:0,z:0,speed:25});assert.equal(details.count,nearCount,'foreground detail returns without rebuilding meshes');
 crowd.dispose();
});

test('mobile distance culling removes complete distant people from GPU draws and restores them on approach',()=>{
 const crowd=createCrowd({low:true}),scene=new THREE.Scene(),rng=random();
 for(let i=0;i<15;i++)crowd.add(i*.3,0,0,0,false,rng);
 for(let i=0;i<90;i++)crowd.add(400+i*.3,0,0,0,false,rng);
 crowd.render(scene);crowd.update(.1,{x:0,z:0,speed:20});
 const heads=scene.children.find(mesh=>mesh.name==='race-spectators-heads');
 assert.equal(heads.count+scene.userData.crowd.activeCharacters,15);assert.equal(scene.userData.crowd.visiblePeople,15);
 crowd.update(.2,{x:405,z:0,speed:20});assert.equal(heads.count+scene.userData.crowd.activeCharacters,90);
 crowd.update(.3,{x:1000,z:1000,speed:20});assert.ok(scene.children.every(mesh=>mesh.isInstancedMesh?mesh.count===0:!mesh.visible));
 crowd.update(.4,{x:0,z:0,speed:20},{reducedMotion:true});assert.equal(heads.count+scene.userData.crowd.activeCharacters,15);
 assert.equal(scene.userData.crowd.foregroundAnimated,0,'reduced motion still culls crowds but never animates them');crowd.dispose();
});
