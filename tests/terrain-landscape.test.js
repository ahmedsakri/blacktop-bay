import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {erodedMountainGeometry} from '../src/terrain-landscape.js';
import {getTrack,projectOnTrack} from '../src/track.js';
import {createMountainVenue} from '../src/mountain-venue.js';

test('the eroded Fuji landform has one connected finite surface, drainage relief and a remote safe footprint',()=>{
 const track=getTrack('fuji-skyline');
 for(const low of [true,false]){
  const g=erodedMountainGeometry({low}),p=g.attributes.position,n=g.attributes.normal,{sectors,rings}=g.userData;
  assert.equal(p.count,1+sectors*rings);assert.equal(g.index.count/3,sectors*(2*rings-1));assert.ok(g.index.count/3<=(low?2000:4600));
  for(const a of Object.values(g.attributes))assert.ok([...a.array].every(Number.isFinite));
  for(let i=0;i<p.count;i++){assert.ok(projectOnTrack(p.getX(i),p.getZ(i),undefined,track).distance>130);assert.ok(n.getY(i)>0);assert.ok(p.getY(i)<311);}
  const mid=1+(rings/2-1)*sectors,heights=Array.from({length:sectors},(_,j)=>p.getY(mid+j));assert.ok(Math.max(...heights)-Math.min(...heights)>20,'actual drainage relief breaks rotational cone symmetry');
  for(let i=1+(rings-1)*sectors;i<p.count;i++)assert.ok(Math.abs(p.getY(i)+.38)<1e-5,'the foot of the mountain is buried in the ground');
  const scene=new THREE.Scene(),group=createMountainVenue(scene,track,{low});let triangles=0;group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  assert.ok(group.userData.drawBatches<=(low?20:28));assert.ok(triangles<=(low?16000:32000));
 }
});
