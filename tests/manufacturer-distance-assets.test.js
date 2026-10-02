import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MANUFACTURER_ASSETS} from '../src/manufacturer-asset-manifest.js';
import {MANUFACTURER_DISTANCE_ASSETS} from '../src/manufacturer-distance-manifest.js';

test('all distant assets reduce actual triangles, retain source hashes and four authored wheel pivots',async()=>{
 assert.deepEqual(Object.keys(MANUFACTURER_DISTANCE_ASSETS),Object.keys(MANUFACTURER_ASSETS));
 for(const [id,asset]of Object.entries(MANUFACTURER_DISTANCE_ASSETS)){
  const source=MANUFACTURER_ASSETS[id],bytes=await readFile(new URL('../public'+asset.path,import.meta.url));
  assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal(asset.sourceSha256,source.variants.low.sha256);
  assert.ok(asset.triangles<asset.sourceTriangles*.56,id);assert.ok(asset.maxRelativeError<=.0061,id);
  const jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  for(const name of source.wheelNames)assert.ok(gltf.nodes.some(node=>node.name===name),id+' retains '+name);
  assert.equal(gltf.asset.extras.license,source.license);assert.equal(gltf.asset.extras.source,source.source);assert.equal(gltf.asset.extras.author,source.author);assert.equal(gltf.asset.extras.detail,'distance');
  assert.ok(gltf.meshes.length>0);assert.ok(gltf.materials.length>0);
 }
});
