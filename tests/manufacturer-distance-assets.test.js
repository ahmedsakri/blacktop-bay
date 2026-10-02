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

test('distance material atlases remove real draw primitives and preserve authored optics, paint and lamp roles',async()=>{
 let nearTotal=0,farTotal=0;
 const json=bytes=>JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 for(const [id,asset]of Object.entries(MANUFACTURER_DISTANCE_ASSETS)){
  const source=MANUFACTURER_ASSETS[id],near=json(await readFile(new URL('../public'+source.low,import.meta.url))),far=json(await readFile(new URL('../public'+asset.path,import.meta.url)));
  const count=gltf=>gltf.meshes.reduce((sum,mesh)=>sum+mesh.primitives.length,0),names=new Set(far.materials.map(m=>m.name));
  nearTotal+=count(near);farTotal+=count(far);assert.equal(count(far),asset.primitives,id);assert.equal(count(near),asset.sourcePrimitives,id);assert.equal(asset.sourcePrimitives-asset.primitives,asset.primitivesRemoved,id);
  const protectedNames=new Set([...(source.paintMaterialNames||[]),...(source.brakeLightMaterialNames||[])]);
  for(const material of near.materials)if(protectedNames.has(material.name)||/glass|window|lamp|light|lens/i.test(material.name)||material.alphaMode&&material.alphaMode!=='OPAQUE')assert.ok(names.has(material.name),id+' preserves '+material.name);
  const nearNodes=near.nodes.filter(node=>node.name?.startsWith('wheel_')),farNodes=far.nodes.filter(node=>node.name?.startsWith('wheel_'));
  for(const node of nearNodes){const other=farNodes.find(n=>n.name===node.name);assert.ok((node.translation||[0,0,0]).every((value,index)=>Math.abs(value-(other.translation||[0,0,0])[index])<.002),id+' wheel origin stays within 2mm through mesh quantization');assert.deepEqual(other.rotation,node.rotation,id+' preserves '+node.name+' orientation');}
 }
 assert.equal(nearTotal,996);assert.equal(farTotal,449);assert.ok(farTotal<nearTotal*.46,'draw primitive reduction exceeds 54%');
});
