import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {vehiclePoint,interpolateVehiclePose} from '../src/vehicle-pose.js';

test('effects anchors match the actual car transform through grades, turns and airborne rolls',()=>{
 for(const yaw of [-2.9,0,.8,Math.PI/2])for(const pitch of [-.45,0,.3])for(const roll of [-1.2,0,.65]){
  const pose={x:23,y:18,z:-75,yaw,pitch,roll},rotation=new THREE.Euler(-pitch,yaw,roll,'YXZ');
  for(const point of [[.9,0,-1.3],[-.9,0,1.3],[.4,.5,-2.2]]){
   const expected=new THREE.Vector3(...point).applyEuler(rotation).add(new THREE.Vector3(pose.x,pose.y,pose.z));
   const actual=vehiclePoint(pose,...point);
   assert.ok(expected.distanceTo(new THREE.Vector3(actual.x,actual.y,actual.z))<1e-10);
  }
 }
});

test('pose interpolation retains elevation and takes the short angular path',()=>{
 const old={x:0,y:12,z:0,yaw:Math.PI-.05,pitch:.2,roll:-.4};
 const now={x:4,y:18,z:8,yaw:-Math.PI+.05,pitch:.4,roll:.2};
 const middle=interpolateVehiclePose(old,now,.5);
 assert.equal(middle.x,2);assert.equal(middle.y,15);assert.equal(middle.z,4);
 assert.ok(Math.abs(middle.yaw-Math.PI)<1e-10);assert.ok(Math.abs(middle.pitch-.3)<1e-10);
 assert.ok(Math.abs(middle.roll+.1)<1e-10);
 assert.equal(interpolateVehiclePose(old,now,2).y,18);
 assert.equal(interpolateVehiclePose(old,now,-1).y,12);
 assert.equal(interpolateVehiclePose(null,now,.5),now);
});

test('flat anchors remain compatible and the jet result object is reused',()=>{
 const result={};assert.equal(vehiclePoint({x:3,z:5,yaw:Math.PI/2},.4,.5,-2,result),result);
 assert.ok(Math.abs(result.x-1)<1e-10);assert.equal(result.y,.5);assert.ok(Math.abs(result.z-4.6)<1e-10);
 vehiclePoint({x:NaN,y:Infinity,yaw:NaN,pitch:Infinity,roll:undefined},1,2,3,result);
 assert.deepEqual(result,{x:1,y:2,z:3});
});
