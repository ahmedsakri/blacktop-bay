import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCrowd, spectatorProfile, spectatorPose} from '../src/crowd.js';
const random = () => {let s=37;return()=>((s=Math.imul(s,1664525)+1013904223)>>>0)/4294967296;};
const matrices=scene=>scene.children.map(mesh=>Array.from(mesh.instanceMatrix.array));

test('crowd has human proportions, diverse people, and non-synchronous articulated poses',()=>{
 const rng=random(), people=Array.from({length:60},(_,i)=>spectatorProfile(i,0,0,0,i%2===0,rng));
 assert.ok(new Set(people.map(p=>p.skin)).size>=5);
 assert.ok(new Set(people.map(p=>p.shirt)).size>=8);
 assert.equal(new Set(people.map(p=>p.gesture)).size,5);
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

test('pause and reduced motion freeze crowd transforms, with bounded mobile batches and distance LOD',()=>{
 const crowd=createCrowd({low:true}), scene=new THREE.Scene(),rng=random();
 for(let i=0;i<100;i++)crowd.add(i%10,0,Math.floor(i/10),0,i%2===0,rng);
 crowd.render(scene);
 assert.equal(scene.userData.spectatorCount,100);
 assert.ok(scene.children.length<=10,'crowd cost must not grow to one draw per person');
 assert.ok(scene.children.every(m=>m.isInstancedMesh));
 const initial=matrices(scene);
 crowd.update(.2,{x:0,z:0,speed:20},{paused:true});assert.deepEqual(matrices(scene),initial);
 crowd.update(.4,{x:0,z:0,speed:20},{reducedMotion:true});assert.deepEqual(matrices(scene),initial);
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
 assert.ok(scene.children.every(m=>m.instanceMatrix.array.every(Number.isFinite)));crowd.dispose();
});

test('animated cheering keeps both arm bones at anatomical lengths without snapping at activation',()=>{
 const rng=random();
 for(let gesture=0;gesture<5;gesture++)for(const seated of [true,false]){
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
 assert.ok(people.some(p=>p.shorts)&&people.some(p=>p.scarf));
 assert.ok(new Set(people.map(p=>p.reactionDistance)).size>80);
 crowd.render(scene);crowd.update(.1,{x:0,z:0,speed:30});
 assert.ok(scene.children.length<=10);
 assert.ok(people.some(p=>p.parts.some(part=>part.faceDetail&&!part.kind.includes('heads'))));
 assert.ok(scene.children.every(m=>Array.from(m.instanceMatrix.array).every(Number.isFinite)));
 crowd.dispose();
});
