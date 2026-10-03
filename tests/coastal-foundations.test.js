import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {getTrack,projectOnTrack} from '../src/track.js';
import {venueSceneryLayout,grandstandLayout} from '../src/world.js';
import {createCoastalDistrict,coastalGroundAt} from '../src/venue-groundworks.js';
import {createMountainVenue} from '../src/mountain-venue.js';
import {createShowcaseVenue} from '../src/showcase-venues.js';
const down=new THREE.Vector3(0,-1,0);
const hitBelow=(group,x,y,z)=>{group.updateMatrixWorld(true);return new THREE.Raycaster(new THREE.Vector3(x,y,z),down,0,100).intersectObject(group,true)[0];};

test('SF vegetation roots meet one continuous rendered landmass instead of isolated water discs',()=>{
 const track=getTrack('san-francisco-hills');
 for(const low of [true,false]){
  const placements=venueSceneryLayout(track,{low}),ground=createCoastalDistrict(new THREE.Scene(),track,{low});
  assert.equal(ground.children.length,1);assert.ok(ground.userData.triangles<(low?9000:20000));
  for(const p of placements){const y=coastalGroundAt(ground,p.x,p.z),hit=hitBelow(ground,p.x,y+1,p.z);assert.ok(hit,'continuous mesh supports every tree');assert.ok(Math.abs(hit.point.y-y)<1e-4);assert.ok(y>-.65,'tree base is above water');}
 }
});

test('all bay houses stand on real concrete footings connected below water',()=>{
 const track=getTrack('san-francisco-hills'),ground=createCoastalDistrict(new THREE.Scene(),track,{low:true}),group=createMountainVenue(new THREE.Scene(),track,{low:true,groundHeight:(x,z)=>coastalGroundAt(ground,x,z)});assert.equal(group.userData.houseFoundations.length,17);assert.ok(group.userData.drawBatches<=20);
 for(const support of group.userData.houseFoundations){assert.ok(support.bottom<-.65);const hit=hitBelow(group,support.x,support.top+.1,support.z);assert.ok(hit);assert.ok(Math.abs(hit.point.y-support.top)<1e-4,'house ground contact meets the concrete lot');}
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
