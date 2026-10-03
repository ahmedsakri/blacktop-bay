import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addGroundDetail,addWorldGroundDetail,GROUND_DETAIL} from '../src/terrain-surface.js';

test('near ground shares library maps and leaves road/car materials and geometry untouched',()=>{
 const maps={terrainColor:new THREE.Texture(),groundDetailColor:new THREE.Texture(),groundDetailNormal:new THREE.Texture()};
 const scene=new THREE.Scene(),geometry=new THREE.PlaneGeometry(2,2),ground=new THREE.MeshStandardMaterial({map:maps.terrainColor,roughness:.91,vertexColors:true});
 const road=new THREE.MeshStandardMaterial({map:new THREE.Texture()}),car=new THREE.MeshPhysicalMaterial({color:'red'});
 scene.add(new THREE.Mesh(geometry,ground),new THREE.Mesh(geometry,ground),new THREE.Mesh(geometry,[road,car]));
 const positions=geometry.attributes.position.array.slice(),result=addWorldGroundDetail(scene,maps);
 assert.equal(result.materials,1);assert.equal(result.extraDraws,0);assert.equal(ground.map,maps.terrainColor);assert.equal(ground.normalMap,maps.groundDetailNormal);
 assert.equal(ground.roughness,.91);assert.equal(ground.vertexColors,true);assert.equal(road.normalMap,null);assert.equal(car.normalMap,null);
 assert.deepEqual(geometry.attributes.position.array,positions);assert.equal(addWorldGroundDetail(scene,maps).materials,0);
 const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};ground.onBeforeCompile(shader);
 assert.equal(shader.uniforms.groundDetailColor.value,maps.groundDetailColor);assert.equal(GROUND_DETAIL.metres,2,'matches the source scan width');
});

test('missing optional detail maps leave the original terrain material usable',()=>{
 const material=new THREE.MeshStandardMaterial({map:new THREE.Texture()}),before=material.onBeforeCompile;
 assert.equal(addGroundDetail(material,{terrainColor:material.map}),false);assert.equal(material.onBeforeCompile,before);assert.equal(material.normalMap,null);
});
