import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {getTrack,projectOnTrack,sampleTrack} from '../src/track.js';
import {grandstandLayout} from '../src/world.js';
import {SHOWCASE_VENUES,SHOWCASE_CROWD_PALETTES,showcaseLayout,showcaseSurfaceAt,applyShowcaseSurface,createShowcaseVenue} from '../src/showcase-venues.js';

test('all three authored showcases have three distinct safe sector landmarks',()=>{
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
  assert.ok(stats.drawBatches<={harbor:19,'fuji-skyline':21,'san-francisco-hills':27}[id],id+' has bounded authored sector draws');
  group.traverse(mesh=>{if(!mesh.isMesh)return;assert.ok(mesh.geometry.attributes.position.count>0);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));});
 }
});


test('rotated pavilion roofs keep a level raised ridge and clock faces follow their tower',t=>{
 const originalDocument=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
 t.after(()=>{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;});
 const localVertices=(group,site,color)=>{
  const inverse=new THREE.Matrix4().compose(new THREE.Vector3(site.x,site.y,site.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,site.yaw,0)),new THREE.Vector3(1,1,1)).invert();
  return group.children.filter(mesh=>mesh.material.color.getHexString()===color).flatMap(mesh=>{
   const positions=mesh.geometry.attributes.position;
   return Array.from({length:positions.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(inverse));
  });
 };
 const fuji=getTrack('fuji-skyline'),fujiStands=grandstandLayout(fuji),pavilions=createShowcaseVenue(new THREE.Scene(),fuji,{stands:fujiStands});
 for(const site of showcaseLayout(fuji,{stands:fujiStands})){
  const vertices=localVertices(pavilions,site,'34474d').filter(v=>Math.abs(v.x)<6&&Math.abs(v.z)<5);
  assert.equal(vertices.length,72,site.label+' includes both roof slabs');
  const means=[];
  for(const side of [-1,1]){
   const half=vertices.slice(side===-1?0:36,side===-1?36:72);
   const ridge=half.filter(v=>v.z*side<0),eave=half.filter(v=>v.z*side>4);
   assert.equal(ridge.length,18);assert.equal(eave.length,18);
   const mean=points=>(Math.min(...points.map(v=>v.y))+Math.max(...points.map(v=>v.y)))/2;
   assert.ok(mean(ridge)>mean(eave)+1,site.label+' slopes down from ridge to eaves');means.push(mean(ridge));
   const left=ridge.filter(v=>v.x<0),right=ridge.filter(v=>v.x>0);
   assert.ok(Math.abs(mean(left)-mean(right))<.025,site.label+' ridge stays level along the rotated building');
  }
  assert.ok(Math.abs(means[0]-means[1])<.025,site.label+' roof halves meet at the same height');
 }
 const sf=getTrack('san-francisco-hills'),sfStands=grandstandLayout(sf),shelters=createShowcaseVenue(new THREE.Scene(),sf,{stands:sfStands});
 for(const site of showcaseLayout(sf,{stands:sfStands})){
  const center=new THREE.Vector3(5.6,7,2.24),vertices=localVertices(shelters,site,'405264').filter(v=>v.distanceTo(center)<1.2);
  assert.ok(vertices.length>30,site.label+' includes a clock face');
  const bounds=new THREE.Box3().setFromPoints(vertices),size=bounds.getSize(new THREE.Vector3());
  assert.ok(size.z<.101,site.label+' clock face stays flush with the rotated tower');
  assert.ok(size.x>1&&size.y>1,site.label+' clock remains a full size upright disc');
 }
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
