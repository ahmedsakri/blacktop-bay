import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {getTrack,TRACKS,projectOnTrack} from '../src/track.js';
import {grandstandLayout} from '../src/world.js';
import {originalLandmarkLayout} from '../src/original-venues.js';
import {createTracksideServices,tracksideServiceLayout} from '../src/trackside-services.js';
import {createCrowd} from '../src/crowd.js';

test('event areas clear every route, grandstand and landmark and never float beside elevated bridges',()=>{
 for(const descriptor of TRACKS){
  const track=getTrack(descriptor.id),stands=grandstandLayout(track),landmarks=originalLandmarkLayout(track,{stands,low:true});
  const sites=tracksideServiceLayout(track,{stands,landmarks,low:true});assert.ok(sites.length<=6);
  for(const site of sites){assert.ok(site.y<=1.3);assert.ok(projectOnTrack(site.x,site.z,undefined,track).distance>=track.width/2+site.radius+4.4);
   for(const stand of stands)assert.ok(Math.hypot(site.x-stand.x,site.z-stand.z)>=site.radius+16);
   for(const landmark of landmarks)assert.ok(Math.hypot(site.x-landmark.x,site.z-landmark.z)>=site.radius+landmark.radius+4);
  }
 }
});

test('near-track fan pockets add identifiable service props and people with five shared draws',()=>{
 const scene=new THREE.Scene(),track=getTrack('harbor'),crowd=createCrowd({low:true});
 const group=createTracksideServices(scene,track,{low:true,stands:grandstandLayout(track),crowd,rng:()=>.45});
 assert.ok(group.userData.sites.length>=3);assert.equal(group.children.length,5);assert.ok(group.userData.addedPeople>=9);assert.equal(crowd.count,group.userData.addedPeople);
 assert.equal(group.userData.animationLoops,0);
 for(const mesh of group.children){assert.ok(mesh.isInstancedMesh);assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));}
 crowd.render(scene);assert.ok(scene.userData.crowd.drawCalls<=10);crowd.dispose();
 const resources=new Set();group.traverse(item=>{if(item.geometry)resources.add(item.geometry);if(item.material)resources.add(item.material);});for(const resource of resources)resource.dispose();
});
