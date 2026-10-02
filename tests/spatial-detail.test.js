import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {partitionInstances,createSpatialInstances,createDistanceDetail} from '../src/spatial-detail.js';

test('spatial batches preserve every instance exactly once and reject distant geometry work',()=>{
 const list=Array.from({length:120},(_,i)=>({x:i*12,y:0,z:i%2*30,sx:2,sy:2,sz:2}));
 assert.equal(partitionInstances(list).flat().length,list.length);
 const scene=new THREE.Scene(),g=new THREE.BoxGeometry(),m=new THREE.MeshStandardMaterial();
 const group=createSpatialInstances(scene,g,m,list),detail=createDistanceDetail(scene,{low:true});
 assert.ok(group.children.length>1);detail.update(0,{x:0,z:0});
 assert.ok(detail.stats.visibleInstances<detail.stats.totalInstances);assert.ok(detail.stats.visibleInstances>0);
 const near=detail.stats.visibleInstances;detail.setQuality({detailDistanceScale:.45});detail.update(1,{x:0,z:0});assert.ok(detail.stats.visibleInstances<near);
 detail.update(2,{x:1400,z:0});assert.equal(group.children[0].visible,false);assert.equal(group.children.at(-1).visible,true);
 g.dispose();m.dispose();
});
test('tall skyline geometry remains at every quality while sector bounds stay finite',()=>{
 const scene=new THREE.Scene();createSpatialInstances(scene,new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),[{x:1000,y:15,z:0,sy:30}]);
 const detail=createDistanceDetail(scene,{low:true});detail.update(0,{x:0,z:0});assert.equal(detail.stats.batches,0);
});
