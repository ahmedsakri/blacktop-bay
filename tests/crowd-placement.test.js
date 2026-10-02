import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TRACKS,getTrack,sampleTrack} from '../src/track.js';
import {grandstandLayout} from '../src/world.js';
import {createCrowd} from '../src/crowd.js';
import {CHARACTER_LIMITS} from '../src/spectator-character.js';

test('mobile detailed spectators activate from every circuit centreline without exceeding six slots',()=>{
 let checkedStands=0;
 for(const {id} of TRACKS){
  const track=getTrack(id),stands=grandstandLayout(track),crowd=createCrowd({low:true}),scene=new THREE.Scene();
  // Use the actual safe grandstand layout and its front-row seat coordinates.
  // In particular the 19/20m roads were beyond the former 18m near radius.
  for(const stand of stands){
   const cosine=Math.cos(stand.yaw),sine=Math.sin(stand.yaw),across=stand.side*-2.2;
   for(let seat=-8;seat<=8;seat++)if(seat!==0){
    const along=seat*1.035;
    crowd.add(stand.x+cosine*across+sine*along,stand.y+.62,stand.z-sine*across+cosine*along,stand.yaw-stand.side*Math.PI/2,true,()=>.5);
   }
  }
  crowd.render(scene);let time=0;
  for(const stand of stands){
   const road=sampleTrack(stand.distance,track);
   crowd.update(time+=.2,{x:road.x,z:road.z,speed:30});
   assert.equal(scene.userData.crowd.activeCharacters,6,`${id} has no full near pool from its normal driving line`);
   assert.ok(scene.userData.crowd.foregroundAnimated<=10,`${id} keeps the mobile animation cap`);
   assert.equal(scene.children.filter(object=>object.name==='near-spectator').length,CHARACTER_LIMITS.mobile);
   assert.ok(scene.userData.crowd.drawCalls<=16,'fallback budget is unchanged');checkedStands++;
  }
  crowd.update(time+.2,{x:1e6,z:1e6,speed:30});assert.equal(scene.userData.crowd.activeCharacters,0);crowd.dispose();
 }
 assert.ok(checkedStands>=76,'the whole current catalogue is covered');
});
