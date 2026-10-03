import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {getTrack,projectOnTrack,sampleTrack} from '../src/track.js';
import {grandstandLayout,venueSceneryLayout} from '../src/world.js';
import {originalLandmarkLayout} from '../src/original-venues.js';
import {createDistanceDetail} from '../src/spatial-detail.js';
import {tracksideServiceLayout} from '../src/trackside-services.js';
import {SHOWCASE_VENUES,SHOWCASE_CROWD_PALETTES,showcaseLayout,showcaseApproachLayout,showcaseSurfaceAt,applyShowcaseSurface,createShowcaseVenue} from '../src/showcase-venues.js';

test('all 38 circuits have three distinct safe sector landmarks',()=>{
 for(const id of Object.keys(SHOWCASE_VENUES)){
  const track=getTrack(id),stands=grandstandLayout(track),sites=showcaseLayout(track,{stands});assert.equal(sites.length,3,id);
  for(const site of sites){assert.ok(projectOnTrack(site.x,site.z,undefined,track).distance>=track.width/2+site.radius+7);for(const stand of stands)assert.ok(Math.hypot(stand.x-site.x,stand.z-site.z)>=site.radius+17);}
  assert.deepEqual(showcaseLayout(track,{stands}),sites);
 }
});
test('authored sector wear and roughness are bounded, continuous through lap wrapping and affect the material',()=>{
 for(const id of Object.keys(SHOWCASE_VENUES)){
  const track=getTrack(id),values=new Set();for(let f=0;f<1;f+=.01){const v=showcaseSurfaceAt(track,f);assert.ok(v.roughness>=.55&&v.roughness<=.96);values.add(v.roughness.toFixed(2));}
  assert.ok(values.size>5);assert.deepEqual(showcaseSurfaceAt(track,0),showcaseSurfaceAt(track,1));
  const mesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial());applyShowcaseSurface(mesh,track);
  assert.equal(mesh.geometry.attributes.roadSurface.count,(track.samples.length+1)*2);
  const shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <roughnessmap_fragment>'};mesh.material.onBeforeCompile(shader);assert.match(shader.fragmentShader,/roughnessFactor=clamp/);assert.match(shader.vertexShader,/attribute vec2 roadSurface/);
 }
});


test('constructing each actual showcase preserves every triangle without attribute merge failures',t=>{
 const originalDocument=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
 t.after(()=>{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;});
 t.mock.method(console,'error',(...args)=>{throw new Error(args.join(' '));});
 for(const id of Object.keys(SHOWCASE_VENUES))for(const low of [false,true]){
  const scene=new THREE.Scene(),track=getTrack(id),group=createShowcaseVenue(scene,track,{low,stands:grandstandLayout(track)});
  const stats=group.userData.geometryStats;assert.ok(stats.sourceTriangles>300,id+' contains actual architecture');
  assert.equal(stats.batchedTriangles,stats.sourceTriangles,id+' retains every authored triangle');assert.equal(stats.fallbackBatches,0,id+' batches are compatible');
  assert.ok(stats.drawBatches<=({harbor:19,'fuji-skyline':21,'san-francisco-hills':27}[id]||24),id+' has bounded authored sector draws');
  group.traverse(mesh=>{if(!mesh.isMesh)return;assert.ok(mesh.geometry.attributes.position.count>0);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));});
 }
});


test('flagship architecture has nine distinct modeled silhouettes whose full footprints clear the whole lap',t=>{
 const original=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
 t.after(()=>{if(original===undefined)delete globalThis.document;else globalThis.document=original;});
 const ids=new Set();
 for(const id of ['fuji-skyline','san-francisco-hills','singapore-afterdark'])for(const low of [true,false]){
  const track=getTrack(id),scene=new THREE.Scene(),group=createShowcaseVenue(scene,track,{low,stands:grandstandLayout(track)});
  assert.equal(group.userData.flagshipArt.length,3);
  for(const art of group.userData.flagshipArt){
   ids.add(art.id);assert.ok(art.footprint<=art.radius,art.id+' actual vertices stay inside the reserved circle');
   assert.ok(projectOnTrack(art.x,art.z,undefined,track).distance-art.footprint>track.width/2+7,art.id+' complete footprint clears every route segment');
   assert.ok(art.height>=5.5&&art.height<13,art.id+' has readable architectural height');
   assert.ok(art.triangles>400&&art.triangles<(low?4500:6000),art.id+' actual curved/depth geometry stays bounded');
  }
  for(const mesh of group.children){
   if(!mesh.isMesh)continue;const p=mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i++)assert.ok(projectOnTrack(p.getX(i),p.getZ(i),undefined,track).distance>track.width/2+2.1,id+' merged geometry and signs clear the road');
   assert.ok(mesh.userData.distanceDetail?.distance<=460,id+' near architecture is distance culled');
  }
  assert.ok(group.userData.geometryStats.sourceTriangles<(low?10000:14000),id+' entire three-sector art has bounded triangles');
  const detail=createDistanceDetail(scene,{low});detail.update(0,{x:10000,z:10000});assert.equal(detail.stats.visibleBatches,0,id+' distant architecture actually culls');
  detail.update(1,group.userData.flagshipArt[0]);assert.ok(detail.stats.visibleBatches>0,id+' architecture restores on approach');
 }
 assert.equal(ids.size,9,'each flagship sector has its own silhouette and construction');
});

test('showcase terraces keep bounded populations with coordinated clothing and one filming observer per sector',t=>{
 const original=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};t.after(()=>{if(original===undefined)delete globalThis.document;else globalThis.document=original;});
 for(const id of Object.keys(SHOWCASE_VENUES))for(const low of [true,false]){
  const people=[],track=getTrack(id),group=createShowcaseVenue(new THREE.Scene(),track,{low,stands:grandstandLayout(track),crowd:{add(...args){people.push(args);}}});
  assert.equal(people.length,low?24:42);assert.equal(people.filter(p=>p[6].gesture===3).length,3);assert.ok(people.every(p=>p[6].palette===SHOWCASE_CROWD_PALETTES[id]));assert.equal(group.userData.geometryStats.fallbackBatches,0);
 }
});

test('grandstand sound-zone heights match the authored elevated road rather than falling back to ground level',()=>{
 for(const id of Object.keys(SHOWCASE_VENUES)){const track=getTrack(id);for(const stand of grandstandLayout(track))assert.equal(stand.y,sampleTrack(stand.distance,track).y||0);}
});

test('all catalogue terraces have grounded support, road-safe corners, and no original landmark or tree overlap',()=>{
 for(const id of Object.keys(SHOWCASE_VENUES)){
  const track=getTrack(id),stands=grandstandLayout(track),sites=showcaseLayout(track,{stands});
  for(const site of sites){
   for(const other of originalLandmarkLayout(track,{stands}))assert.ok(Math.hypot(site.x-other.x,site.z-other.z)>=site.radius+other.radius+6,id+' existing landmarks clear terraces');
   for(const other of venueSceneryLayout(track,{low:true}))assert.ok(Math.hypot(site.x-other.x,site.z-other.z)>=site.radius+other.radius+4,id+' trees and buildings clear terraces');
   for(const other of tracksideServiceLayout(track,{stands,landmarks:sites,low:true}))assert.ok(Math.hypot(site.x-other.x,site.z-other.z)>=site.radius+other.radius+4,id+' event services clear terraces');
   // Largest terrace is the 17m quay; corners, not just its centre, clear the road.
   for(const x of [-8.5,0,8.5])for(const z of [-8.5,0,8.5]){
    const c=Math.cos(site.yaw),s=Math.sin(site.yaw),px=site.x+c*x+s*z,pz=site.z-s*x+c*z;
    assert.ok(projectOnTrack(px,pz,undefined,track).distance>track.width/2+6,id+' terrace corner clears the driving route');
   }
  }
 }
});


test('flagship viewing terraces connect to outer sidewalks by supported piers outside the full road',()=>{
 for(const id of ['fuji-skyline','san-francisco-hills','singapore-afterdark']){const track=getTrack(id);
 for(const site of showcaseLayout(track,{stands:grandstandLayout(track)})){
  const approach=showcaseApproachLayout(track,site);assert.ok(approach);assert.ok(approach.length>12&&approach.length<20);
  assert.ok(Math.abs(approach.start)<=7.5,'pier enters the existing deck');
  for(const p of approach.footprint)assert.ok(projectOnTrack(p.x,p.z,undefined,track).distance>=track.width/2+2.5,'whole access strip stays beyond the road');
  const last=approach.footprint.slice(-2);for(const p of last)assert.ok(projectOnTrack(p.x,p.z,undefined,track).distance<track.width/2+4,'access reaches the outside sidewalk');
 }}
});
