import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {MANUFACTURER_ASSETS} from '../src/manufacturer-asset-manifest.js';
import {MANUFACTURER_COMPRESSED_ASSETS,MANUFACTURER_COMPRESSION_COVERAGE} from '../src/manufacturer-compressed-manifest.js';
const parse=b=>JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
const sha=b=>createHash('sha256').update(b).digest('hex');
function geometryStreams(bytes,gltf){
 const bin=28+bytes.readUInt32LE(12),streams=new Map();
 for(const accessor of gltf.accessors){
  if(streams.has(accessor.bufferView))continue;
  const view=gltf.bufferViews[accessor.bufferView],ext=view.extensions?.EXT_meshopt_compression;
  if(ext){const target=new Uint8Array(ext.count*ext.byteStride);MeshoptDecoder.decodeGltfBuffer(target,ext.count,ext.byteStride,bytes.subarray(bin+ext.byteOffset,bin+ext.byteOffset+ext.byteLength),ext.mode,ext.filter);streams.set(accessor.bufferView,sha(target));}
  else streams.set(accessor.bufferView,sha(bytes.subarray(bin+(view.byteOffset||0),bin+(view.byteOffset||0)+view.byteLength)));
 }
 return streams;
}
test('all 33 sources are reviewed; all 22 textured sources have KTX2 derivatives and 11 material-only cars avoid duplicate assets',async()=>{
 assert.deepEqual(Object.keys(MANUFACTURER_COMPRESSION_COVERAGE),Object.keys(MANUFACTURER_ASSETS));
 assert.equal(Object.keys(MANUFACTURER_COMPRESSED_ASSETS).length,22);
 let images=0,materialOnly=0;
 for(const [id,source]of Object.entries(MANUFACTURER_ASSETS)){
  const gltf=parse(await readFile(new URL('../public'+source.low,import.meta.url))),coverage=MANUFACTURER_COMPRESSION_COVERAGE[id],count=gltf.images?.length||0;
  assert.equal(coverage.sourceSha256,source.variants.low.sha256);assert.equal(coverage.textures,count);
  assert.equal(coverage.status,count?'gpu-compressed':'material-only');
  if(count){assert.equal(MANUFACTURER_COMPRESSED_ASSETS[id].textures,count);images+=count;}
  else{assert.equal(MANUFACTURER_COMPRESSED_ASSETS[id],undefined);materialOnly++;}
 }
 assert.equal(images,241);assert.equal(materialOnly,11);
});
test('every KTX2 derivative preserves actual decoded geometry/UV streams, material roles, credits and mipmapped textures',async()=>{
 await MeshoptDecoder.ready;
 for(const [id,asset] of Object.entries(MANUFACTURER_COMPRESSED_ASSETS)){
  const source=MANUFACTURER_ASSETS[id],bytes=await readFile(new URL('../public'+asset.path,import.meta.url)),sourceBytes=await readFile(new URL('../public'+source.low,import.meta.url)),gltf=parse(bytes),near=parse(sourceBytes);
  assert.equal(sha(bytes),asset.sha256);assert.equal(bytes.length,asset.bytes);assert.equal(asset.sourceBytes,sourceBytes.length);assert.equal(asset.sourceSha256,source.variants.low.sha256);
  assert.ok(gltf.extensionsRequired.includes('KHR_texture_basisu'));assert.equal(gltf.images.length,asset.textures);assert.ok(asset.block8TextureBytes<=asset.sourceTextureBytes*.28,'even small mip chains reduce block storage by over 72%: '+id);
  assert.equal(gltf.asset.extras.license,source.license);assert.equal(gltf.asset.extras.author,source.author);assert.equal(gltf.asset.extras.source,source.source);
  const triangles=g=>g.meshes.reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+g.accessors[p.indices].count/3,0),0);
  assert.equal(triangles(gltf),triangles(near));assert.equal(triangles(gltf),asset.triangles);assert.deepEqual(gltf.nodes,near.nodes);
  assert.deepEqual(gltf.materials,near.materials,'KHR texture extension changes textures only');
  assert.deepEqual(gltf.accessors,near.accessors,id+' preserves geometry/UV accessors');
  assert.deepEqual(geometryStreams(bytes,gltf),geometryStreams(sourceBytes,near),id+' preserves decoded geometry/UV bytes');
  const binOffset=28+bytes.readUInt32LE(12);
  for(const image of gltf.images){assert.equal(image.mimeType,'image/ktx2');const view=gltf.bufferViews[image.bufferView],ktx=bytes.subarray(binOffset+(view.byteOffset||0),binOffset+(view.byteOffset||0)+view.byteLength);
   assert.equal(ktx.subarray(0,12).toString('hex'),'ab4b5458203230bb0d0a1a0a');assert.ok(ktx.readUInt32LE(40)>1,'all compressed maps carry mip levels');}
 }
});
