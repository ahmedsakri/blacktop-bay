import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {configureManufacturerRenderer,prepareManufacturerCar,createManufacturerCar} from '../src/manufacturer-car.js';
import {BoundedKTX2Loader} from '../src/bounded-ktx2-loader.js';
import {BASIS_TRANSCODER} from '../src/basis-transcoder-manifest.js';
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

test('fatal decoder rejection forces complete WebP fallback even when GLTFLoader swallows a texture error',async t=>{
 t.mock.method(KTX2Loader.prototype,'detectSupport',function(){return this;});
 assert.equal(configureManufacturerRenderer({extensions:{has:()=>true}}).gpuCompressed,true);
 const failed=source(),valid=source(),urls=[];let released=0,decoder;failed.material.map.addEventListener('dispose',()=>released++);
 t.mock.method(BoundedKTX2Loader.prototype,'load',function(url,onLoad,onProgress,onError){decoder=this;assert.equal(decoder.transcoderPath,BASIS_TRANSCODER.path);decoder._fail(new Error('Basis worker initialization rejected by policy'));onError(decoder.failure);});
 t.mock.method(GLTFLoader.prototype,'loadAsync',async function(url){
  urls.push(url);
  if(url.includes('-ktx2')){this.ktx2Loader.load('blob:failed-texture',()=>assert.fail('unexpected texture'),undefined,()=>{});return {scene:failed.scene};}
  return {scene:valid.scene};
 });
 const id='lamborghini-gallardo';await prepareManufacturerCar(id,{low:true});const model=createManufacturerCar({assetId:id,low:true});t.after(()=>model.dispose());
 assert.equal(urls.length,2);assert.match(urls[0],/-low-ktx2\.glb\?v=/);assert.equal(urls[1],MANUFACTURER_ASSETS[id].low+'?v='+MANUFACTURER_ASSETS[id].variants.low.sha256.slice(0,16));assert.equal(released,1);
 assert.match(decoder.failure.message,/initialization rejected/);assert.equal(configureManufacturerRenderer({extensions:{has:()=>true}}).gpuCompressed,false);
});

test('a synchronous texture transport error cannot publish an untextured compressed car',async t=>{
 const api=await import('../src/manufacturer-car.js?synchronous-texture-failure');
 t.mock.method(KTX2Loader.prototype,'detectSupport',function(){return this;});api.configureManufacturerRenderer({extensions:{has:()=>true}});
 const failed=source(),valid=source(),urls=[];let released=0;failed.material.map.addEventListener('dispose',()=>released++);
 t.mock.method(BoundedKTX2Loader.prototype,'load',()=>{throw new TypeError('Illegal invocation');});
 t.mock.method(GLTFLoader.prototype,'loadAsync',async function(url){urls.push(url);if(url.includes('-ktx2')){this.ktx2Loader.load('blob:failed-texture',()=>assert.fail('unexpected texture'),undefined,()=>{});return {scene:failed.scene};}return {scene:valid.scene};});
 const id='mclaren-p1-gtr';await api.prepareManufacturerCar(id,{low:true});const model=api.createManufacturerCar({assetId:id,low:true});t.after(()=>model.dispose());
 assert.equal(urls.length,2);assert.ok(urls[1].startsWith(MANUFACTURER_ASSETS[id].low+'?'));assert.equal(released,1);
});
test('null texture dependencies independently trigger complete fallback even without a reported decoder error',async t=>{
 const api=await import('../src/manufacturer-car.js?null-texture-dependency');
 t.mock.method(KTX2Loader.prototype,'detectSupport',function(){return this;});api.configureManufacturerRenderer({extensions:{has:()=>true}});
 const failed=source(),valid=source(),urls=[];let released=0;failed.material.map.addEventListener('dispose',()=>released++);
 t.mock.method(GLTFLoader.prototype,'loadAsync',async function(url){urls.push(url);return url.includes('-ktx2')?{scene:failed.scene,parser:{async getDependencies(type){assert.equal(type,'texture');return [failed.material.map,null];}}}:{scene:valid.scene};});
 const id='mclaren-p1-gtr';await api.prepareManufacturerCar(id,{low:true});const model=api.createManufacturerCar({assetId:id,low:true});t.after(()=>model.dispose());
 assert.equal(urls.length,2);assert.ok(urls[1].startsWith(MANUFACTURER_ASSETS[id].low+'?'));assert.equal(released,1);
});
