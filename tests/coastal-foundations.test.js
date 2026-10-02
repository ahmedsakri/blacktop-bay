import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {getTrack,projectOnTrack} from '../src/track.js';
import {venueSceneryLayout,grandstandLayout} from '../src/world.js';
import {createCoastalGrounding} from '../src/coastal-foundations.js';
import {createMountainVenue} from '../src/mountain-venue.js';
import {createShowcaseVenue} from '../src/showcase-venues.js';
const down=new THREE.Vector3(0,-1,0);
const hitBelow=(group,x,y,z)=>{group.updateMatrixWorld(true);return new THREE.Raycaster(new THREE.Vector3(x,y,z),down,0,100).intersectObject(group,true)[0];};

test('every SF vegetation origin has real shoreline ground through water level, outside the drivable footprint',()=>{
 const track=getTrack('san-francisco-hills');
 for(const low of [true,false]){
  const placements=venueSceneryLayout(track,{low}),ground=createCoastalGrounding(new THREE.Scene(),track,placements);
  assert.equal(ground.userData.supports.length,placements.length);assert.ok(ground.userData.drawBatches<=16);assert.ok(ground.userData.triangles<=4500);
  for(const support of ground.userData.supports){
   assert.ok(support.bottom<-.65);const hit=hitBelow(ground,support.x,.1,support.z);assert.ok(hit,'actual instanced shore cap supports each tree');assert.ok(Math.abs(hit.point.y)<1e-5);
   for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){const x=support.x+Math.cos(angle)*support.footprintRadius,z=support.z+Math.sin(angle)*support.footprintRadius;assert.ok(projectOnTrack(x,z,undefined,track).distance>=track.width/2+1.95,'submerged toe remains outside driving surface');}
  }
 }
});

test('all bay houses stand on real concrete footings connected below water',()=>{
 const track=getTrack('san-francisco-hills'),group=createMountainVenue(new THREE.Scene(),track,{low:true});assert.equal(group.userData.houseFoundations.length,22);assert.ok(group.userData.drawBatches<=20);
 for(const support of group.userData.houseFoundations){assert.ok(support.bottom<-.65);const hit=hitBelow(group,support.x,.1,support.z);assert.ok(hit);assert.ok(Math.abs(hit.point.y)<1e-4,'house ground contact meets the concrete lot');}
 const concrete=group.children.filter(mesh=>mesh.isMesh&&mesh.material.color.getHexString()==='8f9690');
 for(const support of group.userData.houseFoundations){assert.ok(concrete.some(mesh=>{const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++)if(Math.hypot(p.getX(i)-support.x,p.getZ(i)-support.z)<10&&p.getY(i)<-2.9)return true;return false;}),'actual footing vertices extend under the sea');}
});

test('SF spectator terraces have six continuous piers into submerged quays and support every spectator',t=>{
 const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 const track=getTrack('san-francisco-hills'),people=[],group=createShowcaseVenue(new THREE.Scene(),track,{stands:grandstandLayout(track),crowd:{add(x,y,z){people.push({x,y,z});}}});
 assert.equal(group.userData.foundations.length,3);assert.ok(group.userData.geometryStats.drawBatches<=27);
 for(const foundation of group.userData.foundations){assert.equal(foundation.piers,6);assert.ok(foundation.bottom<-.65);assert.ok(foundation.quayTop>-.65);
  const world=(x,z)=>({x:foundation.x+Math.cos(foundation.yaw)*x+Math.sin(foundation.yaw)*z,z:foundation.z-Math.sin(foundation.yaw)*x+Math.cos(foundation.yaw)*z});
  for(const x of [-5.6,5.6])for(const z of [-5.6,0,5.6]){const p=world(x,z),hit=hitBelow(group,p.x,foundation.deckBottom+.01,p.z);assert.ok(hit);assert.ok(Math.abs(hit.point.y-foundation.deckBottom)<.002,'pier reaches the deck underside');}
  const quay=hitBelow(group,foundation.x,foundation.quayTop+.01,foundation.z);assert.ok(quay);assert.ok(Math.abs(quay.point.y-foundation.quayTop)<.002,'quay cap is actual rendered geometry');
 }
 for(const person of people){const hit=hitBelow(group,person.x,person.y+.1,person.z);assert.ok(hit);assert.ok(Math.abs(hit.point.y-(person.y-.05))<.002,'every crowd foot position lies over the supported deck');}
});
