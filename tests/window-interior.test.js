import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WINDOW_INTERIOR,setWindowInteriorUV,windowInteriorGlassMaterial,architecturalFacadeMaterial} from '../src/track-surface-materials.js';
import {createArchitecturalDetails} from '../src/track-world-detail.js';

test('window room coordinates keep metre scale and correct handedness on all rotated vertical faces without adding buffers',()=>{
 for(const [width,height,depth]of [[1.8,1.95,.075],[10.08,2.7,.06]])for(const yaw of [0,.7,Math.PI]){
  const geometry=new THREE.BoxGeometry(),attributes={...geometry.attributes},index=geometry.index,positions=attributes.position.array.slice(),normals=attributes.normal.array.slice();
  setWindowInteriorUV(geometry,width,height,depth);
  assert.deepEqual(Object.keys(geometry.attributes),Object.keys(attributes));
  for(const [name,attribute]of Object.entries(attributes))assert.equal(geometry.attributes[name],attribute,'reuse the existing '+name+' buffer');
  assert.equal(geometry.index,index);assert.deepEqual(attributes.position.array,positions);assert.deepEqual(attributes.normal.array,normals);
  geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(43,17,-26),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(width,height,depth)));
  const {position,normal,uv}=geometry.attributes;
  for(let face=0;face<6;face++){
   const first=face*4,n=new THREE.Vector3().fromBufferAttribute(normal,first);if(Math.abs(n.y)>.5)continue;
   const right=new THREE.Vector3(n.z,0,-n.x).normalize(),origin=new THREE.Vector3().fromBufferAttribute(position,first);
   for(let i=first+1;i<first+4;i++){
    const delta=new THREE.Vector3().fromBufferAttribute(position,i).sub(origin);
    assert.ok(Math.abs(delta.dot(right)-(uv.getX(i)-uv.getX(first))*WINDOW_INTERIOR.width)<1e-5,'front/back and side windows must not mirror their room motion');
    assert.ok(Math.abs(delta.y-(uv.getY(i)-uv.getY(first))*WINDOW_INTERIOR.height)<1e-5,'a room retains its physical vertical scale');
   }
  }
  // Lobby apertures must expose multiple rooms; small panes expose only a
  // central aperture into a room, rather than distorting the room dimensions.
  const front=Array.from({length:4},(_,i)=>uv.getX(16+i));
  assert.ok(Math.abs(Math.max(...front)-Math.min(...front)-width/WINDOW_INTERIOR.width)<1e-6);
  geometry.dispose();
 }
});

test('both opaque window programs gate room intersections to nearby vertical panes and retain shared lighting',()=>{
 for(const factory of [architecturalFacadeMaterial,windowInteriorGlassMaterial])for(const night of [false,true]){
  const material=factory({night}),shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
  assert.equal(material.transparent,false);assert.equal(material.depthWrite,true);assert.equal(Object.values(material).filter(value=>value?.isTexture).length,0);
  assert.equal(material.userData.windowInterior.extraDraws,0);assert.equal(material.userData.windowInterior.extraTextures,0);
  assert.match(shader.fragmentShader,/if\((?:pane|vWindowWall)>\.5&&roomNear>0\.\)\{[^}]*windowRoom\(/,'far fragments skip the room intersection instead of only blending its completed result away');
  assert.match(shader.fragmentShader,/smoothstep\(45\.,100\.,length\(vViewPosition\)\)/);
  for(const chunk of ['lights_fragment_maps','fog_fragment','tonemapping_fragment'])assert.ok(shader.fragmentShader.includes('#include <'+chunk+'>'));
  assert.ok(shader.vertexShader.includes('#ifdef USE_INSTANCING'),'the view basis supports both instanced façades and merged glass');
  material.dispose();
 }
});

test('merged window slabs retain the existing three static material batches and attribute layout',()=>{
 const building={x:0,z:0,y:8.25,sx:12,sy:16.5,sz:8,ry:.4,street:true},group=createArchitecturalDetails(new THREE.Scene(),[building],{low:true,night:true});
 assert.equal(group.children.length,3);assert.equal(group.userData.drawCalls,3);assert.equal(group.userData.animated,false);
 const glass=group.children.find(mesh=>mesh.material.userData.windowInterior);assert.ok(glass);
 assert.deepEqual(Object.keys(glass.geometry.attributes).sort(),['color','normal','position','uv']);
 assert.ok([...glass.geometry.attributes.uv.array].every(Number.isFinite));
 for(const mesh of group.children){mesh.geometry.dispose();mesh.material.dispose();}
});
