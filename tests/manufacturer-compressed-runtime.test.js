import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {configureManufacturerRenderer,prepareManufacturerCar,createManufacturerCar} from '../src/manufacturer-car.js';
import {MANUFACTURER_ASSETS} from '../src/manufacturer-asset-manifest.js';
function source(){const scene=new THREE.Group(),material=new THREE.MeshStandardMaterial({map:new THREE.Texture()});scene.add(new THREE.Mesh(new THREE.BoxGeometry(2,1,4),material));for(const name of ['wheel_front_left','wheel_front_right','wheel_rear_left','wheel_rear_right']){const wheel=new THREE.Mesh(new THREE.BoxGeometry(.3,.7,.7),material);wheel.name=name;wheel.position.set(name.endsWith('left')?.9:-.9,.35,name.includes('front')?1.3:-1.3);scene.add(wheel);}return {scene,material};}
test('compressed source texture failure releases partial resources and retries the original licensed source',async t=>{
 t.mock.method(KTX2Loader.prototype,'detectSupport',function(){return this;});
 const capability=configureManufacturerRenderer({extensions:{has:name=>name==='WEBGL_compressed_texture_astc'}});assert.equal(capability.gpuCompressed,true);
 const failed=source(),valid=source(),urls=[];let released=0;failed.material.map.addEventListener('dispose',()=>released++);
 t.mock.method(GLTFLoader.prototype,'loadAsync',async function(url){urls.push(url);if(url.includes('-ktx2')){this.manager.itemError('failed-map.ktx2');return {scene:failed.scene};}return {scene:valid.scene};});
 const id='mclaren-p1-gtr';await prepareManufacturerCar(id,{low:true});const model=createManufacturerCar({assetId:id,low:true});t.after(()=>model.dispose());
 assert.equal(urls.length,2);assert.match(urls[0],/-low-ktx2\.glb\?v=/);assert.equal(urls[1],MANUFACTURER_ASSETS[id].low+'?v='+MANUFACTURER_ASSETS[id].variants.low.sha256.slice(0,16));assert.equal(released,1);
});
test('unsupported compression capability uses the original source without a transcoder request',async t=>{
 assert.equal(configureManufacturerRenderer({extensions:{has:()=>false}}).gpuCompressed,false);const urls=[];
 t.mock.method(GLTFLoader.prototype,'loadAsync',async url=>{urls.push(url);return {scene:source().scene};});
 const id='porsche-930-turbo';await prepareManufacturerCar(id,{low:true});const model=createManufacturerCar({assetId:id,low:true});t.after(()=>model.dispose());
 assert.equal(urls.length,1);assert.ok(urls[0].startsWith(MANUFACTURER_ASSETS[id].low+'?'));assert.ok(!urls[0].includes('ktx2'));
});
