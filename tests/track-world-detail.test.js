import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {TRACKS,getTrack,projectOnTrack} from '../src/track.js';
import {getVenueProfile,grandstandLayout,venueSceneryLayout} from '../src/world.js';
import {showcaseLayout} from '../src/showcase-venues.js';
import {originalLandmarkLayout} from '../src/original-venues.js';
import {tracksideServiceLayout} from '../src/trackside-services.js';
import {TRACK_SURFACE_MAPS,createTrackSurfaceLibrary,barrierProfileGeometry,architecturalFacadeMaterial,setWorldSurfaceUV} from '../src/track-surface-materials.js';
import {terrainReliefLayout,createTerrainRelief,streetscapeLayout,createArchitecturalDetails,waterfrontGroundingLayout,roadEdgeDetailLayout,createRoadEdgeDetails} from '../src/track-world-detail.js';

const provenance=JSON.parse(readFileSync(new URL('../public/assets/environments/surfaces/provenance.json',import.meta.url)));
test('all desktop/mobile surface derivatives match their source record and real WebP dimensions',()=>{
  assert.equal(provenance.maps.length,12);
  for(const map of provenance.maps){
    const bytes=readFileSync(new URL('../public/assets/environments/surfaces/'+map.file,import.meta.url));
    assert.equal(bytes.length,map.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),map.sha256);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,16),'WEBPVP8 ');
    assert.equal(bytes.readUInt16LE(26)&0x3fff,map.width);assert.equal(bytes.readUInt16LE(28)&0x3fff,map.height);
    assert.equal(map.license,'CC0-1.0');assert.match(map.source,/^https:\/\/dl\.polyhaven\.org\/file\/ph-assets\/Textures\//);
  }
});

test('surface library is bounded, marks data maps correctly, and retains CPU sources for context recovery',async()=>{
  for(const low of [true,false]){
    const urls=[],library=createTrackSurfaceLibrary({low,anisotropy:16,placeholder:()=>({width:1,height:1}),loadImage:async url=>{urls.push(url);const info=provenance.maps.find(m=>url.endsWith(m.file));return {width:info.width,height:info.height};}});
    for(const [key,texture]of Object.entries(library.maps))assert.equal(texture.image.width,TRACK_SURFACE_MAPS[key].size/(low?2:1),'initial placeholder already matches immutable GPU allocation');
    await library.ready;assert.deepEqual([library.status.loaded,library.status.failed,urls.length],[6,0,6]);
    assert.equal(library.status.estimatedBytes,low?5*1024*1024:20*1024*1024);
    for(const [key,texture] of Object.entries(library.maps)){assert.equal(texture.anisotropy,8);assert.equal(texture.colorSpace,TRACK_SURFACE_MAPS[key].color?THREE.SRGBColorSpace:THREE.NoColorSpace);assert.ok(texture.image.width>1);assert.equal(texture.wrapS,THREE.RepeatWrapping);}
    let disposed=0;for(const t of Object.values(library.maps))t.addEventListener('dispose',()=>disposed++);library.dispose();library.dispose();assert.equal(disposed,6);
  }
});

test('late or failed surface loading cannot resurrect disposed textures or attach oversized files',async()=>{
  let resolve,closed=0;const pending=new Promise(r=>resolve=r),library=createTrackSurfaceLibrary({low:true,placeholder:()=>({width:1,height:1}),loadImage:()=>pending});
  const placeholders=Object.values(library.maps).map(t=>t.image);
  await Promise.resolve();library.dispose();resolve({width:512,height:512,close(){closed++;}});await library.ready;
  assert.equal(library.status.loaded,0);assert.equal(closed,6);assert.ok(Object.values(library.maps).every((t,i)=>t.image===placeholders[i]));
  const invalid=createTrackSurfaceLibrary({placeholder:()=>({width:1,height:1}),loadImage:async()=>({width:4096,height:4096,close(){}})});await invalid.ready;assert.equal(invalid.status.failed,6);assert.equal(invalid.status.loaded,0);invalid.dispose();
});

test('tapered barriers retain the former collision envelope and upward caps',()=>{
  const g=barrierProfileGeometry();g.computeBoundingBox();const box=g.boundingBox;
  assert.deepEqual(box.min.toArray(),[-.5,-.5,-.5]);assert.deepEqual(box.max.toArray(),[.5,.5,.5]);
  const p=g.attributes.position;let shoulder=0,top=0;
  for(let i=0;i<p.count;i++){if(Math.abs(p.getY(i)-.5)<1e-6){assert.ok(Math.abs(p.getX(i))<=.220001);top++;}if(Math.abs(p.getY(i)+.13)<1e-6)shoulder++;}
  assert.ok(top&&shoulder);assert.ok([...g.attributes.normal.array].every(Number.isFinite));g.dispose();
});

test('all 38 routes keep relief and human-scale street blocks outside road, stands and existing landmarks',()=>{
  let streets=0,reliefs=0;
  for(const {id}of TRACKS){const track=getTrack(id),venue=getVenueProfile(track),stands=grandstandLayout(track),occupied=[...venueSceneryLayout(track,{low:true}),...stands.map(s=>({...s,radius:16})),...showcaseLayout(track,{stands}),...originalLandmarkLayout(track,{stands}),...tracksideServiceLayout(track,{low:true,stands,landmarks:[...originalLandmarkLayout(track,{stands}),...showcaseLayout(track,{stands})]})];
    for(const low of [true,false]){
      const street=streetscapeLayout(track,venue,{low,occupied}),relief=terrainReliefLayout(track,venue,{low,occupied:[...occupied,...street]});streets+=street.length;reliefs+=relief.length;
      assert.ok(street.length<=(low?22:34));assert.ok(relief.length<=(low?20:32));
      for(const site of [...street,...relief]){
        assert.ok(projectOnTrack(site.x,site.z,undefined,track).distance>=track.width/2+site.radius+5,id+' keeps complete scenery footprint clear');
        for(const other of occupied)assert.ok(Math.hypot(site.x-other.x,site.z-other.z)>=site.radius+(other.radius||12)+2,id+' respects existing occupied footprints');
      }
      assert.deepEqual(streetscapeLayout(track,venue,{low,occupied}),street,'deterministic layout');
    }
  }
  assert.ok(streets>80);assert.ok(reliefs>100);
});

test('actual terrain relief winds upwards, has textured finite geometry, and stays in its clearance envelope',()=>{
  for(const id of ['harbor','fuji-skyline','sakhir']){
    const track=getTrack(id),group=createTerrainRelief(new THREE.Scene(),track,getVenueProfile(track),{low:true,map:new THREE.Texture()});
    assert.ok(group.userData.drawCalls<=1);assert.ok(group.userData.triangles<=4000);
    group.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
      for(let i=0;i<p.count;i++){assert.ok(n.getY(i)>=-.0001,'outward normals face sky');assert.ok(projectOnTrack(p.getX(i),p.getZ(i),undefined,track).distance>track.width/2+10);}
      assert.ok([...mesh.geometry.attributes.uv.array].every(Number.isFinite));
    });
  }
});

test('near frontages add depth and multiple storeys in three static draws before optional sign/light overlays',()=>{
  const b={x:0,z:0,y:8.25,sx:12,sy:16.5,sz:8,ry:.4,street:true},group=createArchitecturalDetails(new THREE.Scene(),[b],{low:true,concreteMap:new THREE.Texture(),concreteNormal:new THREE.Texture()});
  assert.equal(group.userData.buildings,1);assert.equal(group.userData.drawCalls,3);assert.ok(group.userData.triangles>1000&&group.userData.triangles<2300);assert.equal(group.userData.animated,false);
  group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(group);assert.ok(bounds.min.y<-2.8);assert.ok(bounds.max.y>17.5);
  for(const mesh of group.children){assert.ok(mesh.geometry.attributes.position.count>0);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));}
});

test('quays connect below water and every promenade footprint clears the complete road',()=>{
  const track=getTrack('harbor'),venue=getVenueProfile(track),buildings=streetscapeLayout(track,venue,{low:false}),sites=waterfrontGroundingLayout(track,buildings);
  assert.ok(sites.length>3);assert.ok(sites.some(s=>s.role==='promenade'));
  for(const site of sites){assert.ok(site.y-site.sy/2<-.65);assert.ok(site.y+site.sy/2>-.65);
    const c=Math.cos(site.ry),s=Math.sin(site.ry);for(let x=-site.sx/2;x<=site.sx/2;x+=1.5)for(let z=-site.sz/2;z<=site.sz/2;z+=1.5)assert.ok(projectOnTrack(site.x+c*x+s*z,site.z-s*x+c*z,undefined,track).distance>=track.width/2+2.4);
  }
});

test('road drainage uses actual elevations without adding colliders or unbounded draws',()=>{
  for(const id of ['harbor','fuji-skyline','singapore-afterdark']){
    const track=getTrack(id),sites=roadEdgeDetailLayout(track,{low:true}),group=createRoadEdgeDetails(new THREE.Scene(),track,{low:true});assert.deepEqual(group.userData.sites,sites);assert.equal(group.userData.drawCalls,1);assert.ok(sites.length<=Math.ceil(track.length/18)*2);
    assert.equal(group.userData.triangles,sites.length*72);assert.equal(group.userData.animated,false);
    assert.ok(sites.every(s=>s.y>=.026&&Number.isFinite(s.grade)));
  }
});

test('facade programs separate physical glass and stone, and UV projection keeps vertical walls at metre scale',()=>{
  const material=architecturalFacadeMaterial({night:true}),shader={vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n#include <emissivemap_fragment>'};material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/faceWidth\/2\.45/);assert.match(shader.fragmentShader,/roughnessFactor=mix\(\.83,\.24,pane\)/);assert.match(shader.fragmentShader,/metalnessFactor=mix/);
  const geo=setWorldSurfaceUV(new THREE.BoxGeometry(12,9,6));assert.ok([...geo.attributes.uv.array].every(Number.isFinite));const values=[...geo.attributes.uv.array];assert.ok(Math.max(...values)>=2&&Math.min(...values)<=-2);
});

test('Singapore wide pavement retains the actual map with restrained variation and no extra texture or lighting work',async()=>{
 const {restrainedPavementMaterial}=await import('../src/track-world-detail.js'),map=new THREE.Texture(),material=restrainedPavementMaterial(map);
 assert.equal(material.map,map);assert.equal(material.roughness,1);assert.equal(material.userData.surfaceVariation,.15);
 const shader={fragmentShader:'#include <map_fragment>'};material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/mix\(diffuse,diffuseColor\.rgb,0\.15\)/);assert.doesNotMatch(shader.fragmentShader,/uniform|texture\(/);assert.equal(material.customProgramCacheKey(),'singapore-muted-pavement-v1');
});

test('access rail openings remove actual triangles at each landmark walkway without disturbing rail elsewhere or the lap seam',async()=>{
 const {createAccessRailGeometry}=await import('../src/track-world-detail.js');
 for(const id of ['fuji-skyline','san-francisco-hills','singapore-afterdark']){
  const track=getTrack(id),gaps=[{s:0,halfLength:1.4},{s:track.length*.13,halfLength:1.4}],geometry=createAccessRailGeometry(track,track.width/2+5.1,.055,.93,gaps),uv=geometry.attributes.uv,index=geometry.index;
  assert.ok(index.count>1000);assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
  for(let i=0;i<index.count;i+=3){const distances=[0,1,2].map(n=>uv.getY(index.getX(i+n))*3),mid=(Math.min(...distances)+Math.max(...distances))/2;
   for(const [a,b] of geometry.userData.accessOpenings)assert.ok(mid<a||mid>b,'no rail triangles cross the access opening');
  }
  assert.equal(geometry.userData.accessOpenings.length,3,'opening at finish splits safely across the lap seam');
 }
});
