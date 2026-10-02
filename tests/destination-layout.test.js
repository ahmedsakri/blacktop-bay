import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MOUNTAIN_CIRCUITS,elevationAt} from '../src/mountain-circuit.js';
import {TRACKS,getTrack,sampleTrack,projectOnTrack} from '../src/track.js';
import {getTrackObstacles} from '../src/track-obstacles.js';
import {DESTINATION_PROFILES,createMountainVenue} from '../src/mountain-venue.js';

test('four new destinations append distinct original layouts with continuous heights and optional safe-width ramps',()=>{
 assert.deepEqual(TRACKS.slice(-4).map(t=>t.id),MOUNTAIN_CIRCUITS.map(t=>t.id));
 const shapes=new Set();
 for(const descriptor of MOUNTAIN_CIRCUITS){
  const track=getTrack(descriptor.id),start=sampleTrack(0,track),end=sampleTrack(track.length,track);
  shapes.add(JSON.stringify(track.samples.map(p=>[p.x,p.z])));
  assert.equal(track.series,'original');assert.equal(track.layoutKind,'original');assert.equal(track.sourceUrl,undefined);
  assert.ok(track.length>2000&&track.length<3100);assert.ok(DESTINATION_PROFILES[track.id]);
  assert.ok(Math.hypot(start.x-end.x,start.y-end.y,start.z-end.z)<1e-8);
  assert.ok(Math.abs(elevationAt(.999999,track.elevationProfile)-elevationAt(0,track.elevationProfile))<1e-6);
  for(const p of track.samples){
   assert.ok([p.x,p.y,p.z,p.grade,p.ty,p.tx,p.tz,p.nx,p.nz].every(Number.isFinite));
   assert.ok(Math.abs(p.grade)<.2);assert.ok(Math.abs(Math.hypot(p.tx,p.tz)-1)<1e-8);
   const road=projectOnTrack(p.x,p.z,0,track,p.y);
   assert.ok(Math.abs(road.y-p.y)<.05,'height-aware projection retains the current road level');
  }
  for(const ramp of track.ramps){
   assert.ok(ramp.s>60&&ramp.s+ramp.length<track.length-60);
   assert.ok(Math.abs(ramp.lane)+ramp.width/2<track.width/2-.5,'ramp fits inside the barriers');
   assert.ok(Math.abs(ramp.lane)-ramp.width/2>=2,'centre racing line remains open');
   assert.ok(ramp.height/ramp.length<.24,'launch slope stays bounded');
  }
  for(const obstacle of getTrackObstacles(track)){
   const road=sampleTrack(obstacle.s,track);
   assert.equal(obstacle.y,road.y);assert.ok(Math.abs(obstacle.lane)+obstacle.radius<track.width/2);
   assert.ok(Math.abs(obstacle.lane)-obstacle.radius>3,'central bypass stays open');
  }
 }
 assert.equal(shapes.size,4,'destinations use distinct road geometry, not only different backgrounds');
});

test('destination scenery remains finite and batched within a bounded mobile geometry budget',()=>{
 for(const descriptor of MOUNTAIN_CIRCUITS){
  const scene=new THREE.Scene(),group=createMountainVenue(scene,getTrack(descriptor.id),{low:true});
  assert.equal(scene.children.length,1);assert.equal(group.name,`destination-${descriptor.id}`);
  let triangles=0,meshes=0;
  group.traverse(object=>{if(!object.isMesh)return;meshes++;
   const positions=object.geometry.attributes.position;
   for(const value of positions.array)assert.ok(Number.isFinite(value));
   triangles+=(object.geometry.index?.count||positions.count)/3;
  });
  assert.ok(group.userData.sourceMeshes>100,'actual architectural geometry is present');
  assert.ok(meshes<=20&&group.userData.drawBatches===meshes,'shared static geometry is batched');
  assert.ok(triangles>3000&&triangles<16000,`${descriptor.id}: ${triangles} mobile triangles`);
 }
});
