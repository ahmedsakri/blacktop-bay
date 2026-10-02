import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMountainVenue,DESTINATION_PROFILES} from '../src/mountain-venue.js';
import {getTrack} from '../src/track.js';
for(const id of Object.keys(DESTINATION_PROFILES))test(`${id} authors finite, efficiently batched geometry at desktop and phone detail`,()=>{
  for(const low of [false,true]){
    const scene=new THREE.Scene(),group=createMountainVenue(scene,getTrack(id),{low});
    assert.ok(group.userData.sourceMeshes>100);assert.ok(group.userData.drawBatches<30);
    let count=0;group.traverse(mesh=>{if(!mesh.isMesh)return;count++;
      const p=mesh.geometry.attributes.position;assert.ok(p.count>0);
      for(const value of p.array)assert.ok(Number.isFinite(value));
      mesh.geometry.computeBoundingSphere();assert.ok(Number.isFinite(mesh.geometry.boundingSphere.radius));
    });assert.equal(count,group.userData.drawBatches);
  }
});
