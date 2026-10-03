import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TRACKS,getTrack,projectOnTrack,sampleTrack} from '../src/track.js';
import {getVenueProfile,grandstandLayout} from '../src/world.js';
import {showcaseLayout} from '../src/showcase-venues.js';
import {createRoadVerge,createCoastalDistrict,coastalGroundAt} from '../src/venue-groundworks.js';
import {roadsidePlantingLayout,grassTuftGeometry,createRoadsidePlanting,vergeGroundSampler,forestMarginLayout,PLANTING_BUDGET} from '../src/roadside-planting.js';
import {venueSceneryLayout} from '../src/world.js';
import {destinationHouseLayout} from '../src/mountain-venue.js';

test('modeled grass has curved tapered finite blades entirely inside its declared clearance footprint',()=>{
 const g=grassTuftGeometry(),p=g.attributes.position;assert.equal(p.count/3,PLANTING_BUDGET.trianglesPerTuft);assert.ok([...p.array].every(Number.isFinite));for(let i=0;i<p.count;i++){assert.ok(Math.hypot(p.getX(i),p.getZ(i))<.56);assert.ok(p.getY(i)>=0&&p.getY(i)<.71);}assert.equal(g.attributes.color.count,p.count);
});
test('planting across all38 routes clears the full road, sidewalks and occupied terraces, and roots match rendered ground triangles',()=>{
 let total=0;
 for(const {id}of TRACKS){const track=getTrack(id),venue=getVenueProfile(track),stands=grandstandLayout(track),occupied=[...stands.map(p=>({...p,radius:16})),...showcaseLayout(track,{stands})],scene=new THREE.Scene(),coast=createCoastalDistrict(scene,track,{low:true}),verge=id==='san-francisco-hills'?null:createRoadVerge(scene,track,venue,{low:true}),groundAt=vergeGroundSampler(verge,coast?(x,z)=>coastalGroundAt(coast,x,z):()=>-.16),sites=roadsidePlantingLayout(track,venue,{occupied,groundAt});total+=sites.length;
  assert.ok(sites.length<=8400);for(const p of sites){assert.ok(projectOnTrack(p.x,p.z,undefined,track).distance-p.radius>=track.width/2+5.65);assert.ok(occupied.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>=p.radius+(o.radius||12)+.6));assert.ok(p.y>=-.585);}
  scene.updateMatrixWorld(true);const targets=coast?[coast]:[verge].filter(Boolean);
  for(const p of sites.filter((_,i)=>i%73===0)){const hit=new THREE.Raycaster(new THREE.Vector3(p.x,100,p.z),new THREE.Vector3(0,-1,0)).intersectObjects(targets,true)[0];if(hit)assert.ok(Math.abs(p.y+.025-Math.max(hit.point.y,coast?-Infinity:-.16))<1e-4);}
 }
 assert.ok(total>50000,'road edges receive continuous authored planting, not one display patch');
});
test('near grass tiers bound active triangles and one draw while culling distant road sectors',()=>{
 const track=getTrack('fuji-skyline'),venue=getVenueProfile(track);
 for(const low of [true,false]){const scene=new THREE.Scene(),p=createRoadsidePlanting(scene,track,venue,{low}),car=sampleTrack(track.length*.13,track);p.update(1,car);assert.ok(p.status.visible>40);assert.ok(p.status.visible<=(low?384:720));assert.equal(p.status.triangles,p.status.visible*24);assert.equal(scene.children.length,1);assert.equal(p.mesh.castShadow,false);p.update(2,{x:1e6,z:1e6});assert.equal(p.status.visible,0);p.dispose();p.dispose();assert.equal(scene.children.length,0);}
});

test('irregular forest margins clear every road and existing house/terrace footprint at both LODs',()=>{
 let total=0;for(const {id}of TRACKS)for(const low of [true,false]){
  const track=getTrack(id),venue=getVenueProfile(track),stands=grandstandLayout(track),landmarks=showcaseLayout(track,{stands}),coast=createCoastalDistrict(new THREE.Scene(),track,{low}),occupied=[...venueSceneryLayout(track,{low}),...stands.map(s=>({...s,radius:16})),...landmarks,...destinationHouseLayout(track,{landmarks})],groundAt=coast?(x,z)=>coastalGroundAt(coast,x,z):undefined,trees=forestMarginLayout(track,venue,{low,occupied,groundAt});total+=trees.length;
  assert.ok(trees.length<=(low?140:220));assert.equal(new Set(trees.map(t=>t.treeId)).size,trees.length);
  for(const tree of venueSceneryLayout(track,{low}))for(const house of destinationHouseLayout(track,{landmarks}))assert.ok(Math.hypot(tree.x-house.x,tree.z-house.z)>=tree.radius+house.radius+2,'existing ordinary trees also clear complete house plots');
  for(const t of trees){assert.ok(projectOnTrack(t.x,t.z,undefined,track).distance-t.radius>=track.width/2+8);assert.ok(occupied.every(o=>Math.hypot(t.x-o.x,t.z-o.z)>=t.radius+(o.radius||12)+2));if(coast)assert.ok(t.y>=-.56);assert.ok(t.height>=8&&t.height<=20);}
  assert.deepEqual(trees,forestMarginLayout(track,venue,{low,occupied,groundAt}));
 }assert.ok(total>1000);
});
