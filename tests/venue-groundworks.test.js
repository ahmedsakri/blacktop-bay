import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TRACKS,getTrack,projectOnTrack,sampleTrack} from '../src/track.js';
import {getVenueProfile,venueSceneryLayout} from '../src/world.js';
import {streetscapeLayout} from '../src/track-world-detail.js';
import {createCoastalDistrict,coastalGroundAt,createDistrictParcels,createRoadVerge} from '../src/venue-groundworks.js';

const isFiniteGeometry=mesh=>{for(const a of Object.values(mesh.geometry.attributes))assert.ok([...a.array].every(Number.isFinite));};
test('continuous SF terrain stays below every lane across both LODs, and agrees with raycast ground contact',()=>{
 const track=getTrack('san-francisco-hills');
 for(const low of [true,false]){
  const group=createCoastalDistrict(new THREE.Scene(),track,{low});group.updateMatrixWorld(true);assert.equal(group.userData.drawCalls,1);assert.ok(group.userData.triangles<=(low?5000:11000));isFiniteGeometry(group.children[0]);
  for(let s=0;s<track.length;s+=2){const p=sampleTrack(s,track);for(const lane of [-track.width/2,0,track.width/2]){
   const x=p.x+p.nx*lane,z=p.z+p.nz*lane,height=coastalGroundAt(group,x,z);assert.ok(height<p.y-.15,'terrain never reaches the driving surface');
   const hit=new THREE.Raycaster(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0)).intersectObject(group,true)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-height)<1e-4,'foundation sampler matches real triangle interpolation');
  }}
  const p=sampleTrack(track.length*.29,track);assert.ok(coastalGroundAt(group,p.x,p.z)<-2,'suspension bridge retains open water');
 }
});

test('all38 verges and connected plots keep their complete footprint clear with bounded geometry and material draws',()=>{
 let totalPlots=0,totalSidewalks=0;
 for(const {id}of TRACKS)for(const low of [true,false]){
  const track=getTrack(id),venue=getVenueProfile(track),scene=new THREE.Scene(),scenery=venueSceneryLayout(track,{low});
  const buildings=[...streetscapeLayout(track,venue,{low}),...scenery.filter(p=>p.kind==='building').map(p=>({x:p.x,z:p.z,y:p.height/2-.16,sx:p.radius*1.3,sy:p.height,sz:p.radius*.8,ry:p.yaw}))];
  const parcel=createDistrictParcels(scene,track,buildings,{low,water:venue.water}),verge=createRoadVerge(scene,track,venue,{low});
  assert.ok(parcel.userData.sites.length<=(low?30:46));assert.ok(parcel.userData.drawCalls<=3);assert.equal(verge.userData.drawCalls,1);
  assert.ok(parcel.userData.triangles+verge.userData.triangles<=(low?12000:25000),id+' new surface geometry stays within mobile/desktop budget');
  totalPlots+=parcel.userData.sites.length;totalSidewalks+=parcel.userData.links.filter(p=>p.sidewalk).length;
  for(const mesh of parcel.children){isFiniteGeometry(mesh);assert.ok(mesh.userData.distanceDetail.distance<=600);assert.equal(mesh.castShadow,false);}
  isFiniteGeometry(verge);
  for(const site of parcel.userData.sites){const c=Math.cos(site.ry),s=Math.sin(site.ry);for(let x=-site.sx/2;x<=site.sx/2;x+=2)for(let z=-site.sz/2;z<=site.sz/2;z+=2)assert.ok(projectOnTrack(site.x+c*x+s*z,site.z-s*x+c*z,undefined,track).distance>=track.width/2+1.9);}
  for(const site of parcel.userData.links)for(const p of site.footprint)assert.ok(projectOnTrack(p.x,p.z,undefined,track).distance>=track.width/2+2);
  for(const cell of verge.userData.cells)for(const p of cell.footprint)assert.ok(projectOnTrack(p.x,p.z,undefined,track).distance>=track.width/2+3.4);
 }
 assert.ok(totalPlots>100);assert.ok(totalSidewalks>100,'plots visibly connect to the continuous sidewalk');
});

test('continuous inland relief stays below every road, grounds venue pads and replaces separate mound draws',async()=>{
 const {createInlandRelief}=await import('../src/venue-groundworks.js');
 for(const {id}of TRACKS){const track=getTrack(id),venue=getVenueProfile(track);if(venue.environment!=='parkland'||venue.water)continue;
  for(const low of [true,false]){const occupied=venueSceneryLayout(track,{low}),group=createInlandRelief(new THREE.Scene(),track,venue,{low,occupied});assert.equal(group.userData.drawCalls,1);assert.ok(group.userData.triangles<(low?7000:16000));
   isFiniteGeometry(group.children[0]);
   for(let s=0;s<track.length;s+=3){const p=sampleTrack(s,track);for(const lane of [-track.width/2,0,track.width/2])assert.ok(coastalGroundAt(group,p.x+p.nx*lane,p.z+p.nz*lane)<p.y-.15,id+' complete lane remains above terrain');}
   for(const site of occupied)assert.ok(coastalGroundAt(group,site.x,site.z)<.01,id+' scenery pad remains at its existing ground height');
   assert.ok(Math.max(...group.userData.vertices.map(p=>p.y))>1,id+' the surface has actual coherent relief');
  }
 }
});
