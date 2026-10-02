import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MANUFACTURER_ASSETS} from '../src/manufacturer-asset-manifest.js';
import {MANUFACTURER_COMPRESSED_ASSETS} from '../src/manufacturer-compressed-manifest.js';
const parse=b=>JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
test('three heavyweight optional KTX2 sources preserve geometry, materials and credits with mipmapped block-compressed textures',async()=>{
 assert.equal(Object.keys(MANUFACTURER_COMPRESSED_ASSETS).length,3);
 for(const [id,asset] of Object.entries(MANUFACTURER_COMPRESSED_ASSETS)){
  const source=MANUFACTURER_ASSETS[id],bytes=await readFile(new URL('../public'+asset.path,import.meta.url)),gltf=parse(bytes),near=parse(await readFile(new URL('../public'+source.low,import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal(bytes.length,asset.bytes);assert.equal(asset.sourceSha256,source.variants.low.sha256);
  assert.ok(gltf.extensionsRequired.includes('KHR_texture_basisu'));assert.equal(gltf.images.length,asset.textures);assert.ok(asset.block8TextureBytes<=asset.sourceTextureBytes*.251);
  assert.equal(gltf.asset.extras.license,source.license);assert.equal(gltf.asset.extras.author,source.author);assert.equal(gltf.asset.extras.source,source.source);
  const triangles=g=>g.meshes.reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+g.accessors[p.indices].count/3,0),0);
  assert.equal(triangles(gltf),triangles(near));assert.equal(triangles(gltf),asset.triangles);assert.deepEqual(gltf.nodes,near.nodes);
  assert.deepEqual(gltf.materials,near.materials,'KHR texture extension changes textures only');
  const binOffset=28+bytes.readUInt32LE(12);
  for(const image of gltf.images){assert.equal(image.mimeType,'image/ktx2');const view=gltf.bufferViews[image.bufferView],ktx=bytes.subarray(binOffset+(view.byteOffset||0),binOffset+(view.byteOffset||0)+view.byteLength);
   assert.equal(ktx.subarray(0,12).toString('hex'),'ab4b5458203230bb0d0a1a0a');assert.ok(ktx.readUInt32LE(40)>1,'all compressed maps carry mip levels');}
 }
});
