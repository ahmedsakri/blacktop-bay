import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TRACKS,getTrack,projectOnTrack,sampleTrack} from '../src/track.js';
import {getVenueProfile,grandstandLayout,venueSceneryLayout} from '../src/world.js';
import {showcaseLayout} from '../src/showcase-venues.js';
import {urbanBlockLayout,createUrbanBlockEdges} from '../src/urban-district.js';
import {districtParcelLayout} from '../src/venue-groundworks.js';

test('urban rows orient facades to the road and share safe full parcels with exact ground contact at both LODs',()=>{
 let total=0;
 for(const {id}of TRACKS)for(const low of [true,false]){const track=getTrack(id),venue=getVenueProfile(track),stands=grandstandLayout(track),occupied=[...venueSceneryLayout(track,{low}),...stands.map(p=>({...p,radius:16})),...showcaseLayout(track,{stands})],{blocks,units}=urbanBlockLayout(track,venue,{low,occupied});total+=blocks.length;
  assert.equal(units.length,blocks.length*3);assert.ok(blocks.length<=(low?34:48));assert.deepEqual(urbanBlockLayout(track,venue,{low,occupied}),{blocks,units});
  const parcels=districtParcelLayout(track,blocks,{low});assert.equal(parcels.sites.length,blocks.length);
  for(const site of parcels.sites){const c=Math.cos(site.ry),s=Math.sin(site.ry);for(let i=0;i<=31;i++)for(let j=0;j<=23;j++){const x=(i/31-.5)*site.sx,z=(j/23-.5)*site.sz;assert.ok(projectOnTrack(site.x+c*x+s*z,site.z-s*x+c*z,undefined,track).distance>=track.width/2+2.4,'independent dense samples of the delivered parcel clear the full road');}}
  for(const b of blocks){assert.ok(b.parcelFootprint.every(p=>projectOnTrack(p.x,p.z,undefined,track).distance>=track.width/2+2.5));assert.ok(b.sy>b.roadY+9,'frontage rises above the adjacent elevated driving deck');assert.ok(occupied.every(o=>Math.hypot(b.x-o.x,b.z-o.z)>=b.radius+(o.radius||12)+2));const p=sampleTrack(projectOnTrack(b.x,b.z,undefined,track).s,track),dir=new THREE.Vector2(p.x-b.x,p.z-b.z).normalize();assert.ok(dir.dot(new THREE.Vector2(Math.sin(b.ry),Math.cos(b.ry)))>.95);}
  for(const u of units){assert.ok(Math.abs(u.y-u.sy/2+.1)<1e-6);const block=blocks.find(b=>b.blockId===u.blockId);assert.ok(Math.hypot(u.x-block.x,u.z-block.z)+u.radius<block.radius);}
  const edges=createUrbanBlockEdges(new THREE.Scene(),units);assert.ok(edges.userData.draws<=1);assert.ok(edges.userData.triangles<(low?13000:20000));for(const mesh of edges.children)assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
 }
 assert.ok(total>25);const t=getTrack('singapore-afterdark'),v=getVenueProfile(t);assert.ok(urbanBlockLayout(t,v,{low:true}).blocks.length>=8);
});

test('Singapore asphalt preserves mapped roughness but no longer has a low glossy floor',async()=>{
 const {applyShowcaseSurface}=await import('../src/showcase-venues.js'),track=getTrack('singapore-afterdark'),road=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial()),shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <roughnessmap_fragment>\n#include <map_fragment>'};applyShowcaseSurface(road,track);road.material.onBeforeCompile(shader);assert.match(shader.fragmentShader,/roughnessFactor=clamp\([^;]+,\.74,\.96\)/);assert.match(shader.fragmentShader,/#include <roughnessmap_fragment>/);assert.match(road.material.customProgramCacheKey(),/dry-urban/);
});
