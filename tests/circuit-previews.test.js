import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {TRACKS} from '../src/track.js';
import {TRACK_SURFACE_MAPS,TRACK_ROCK_MAPS} from '../src/track-surface-materials.js';

function dimensions(bytes){
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 for(let offset=12;offset+8<=bytes.length;){
  const type=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),p=offset+8;
  if(type==='VP8X')return [1+bytes.readUIntLE(p+4,3),1+bytes.readUIntLE(p+7,3)];
  if(type==='VP8 '){assert.equal(bytes.toString('hex',p+3,p+6),'9d012a');return [bytes.readUInt16LE(p+6)&0x3fff,bytes.readUInt16LE(p+8)&0x3fff];}
  if(type==='VP8L'){assert.equal(bytes[p],0x2f);const bits=bytes.readUInt32LE(p+1);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
  offset=p+size+(size%2);
 }
 throw new Error('Missing WebP image payload');
}

test('all 38 circuit previews are distinct actual-world WebP captures with verified dimensions and hashes',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/circuits/previews/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.source,'Camber Reign actual createWorld WebGL renderer');
 assert.equal(manifest.fixture,'reports/track-world-review.html');assert.deepEqual(manifest.dimensions,[960,540]);
 assert.deepEqual(manifest.entries.map(e=>e.id),TRACKS.map(t=>t.id));
 assert.equal(new Set(manifest.entries.map(e=>e.sha256)).size,TRACKS.length,'each route has its own rendered view');
 let total=0;
 for(const entry of manifest.entries){
  assert.equal(entry.path,`/assets/circuits/previews/${entry.id}.webp`);
  const bytes=readFileSync(new URL(`../public${entry.path}`,import.meta.url));total+=bytes.length;
  assert.equal(bytes.length,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  assert.deepEqual(dimensions(bytes),[960,540]);assert.equal(entry.width,960);assert.equal(entry.height,540);
  assert.ok(entry.sector>=0&&entry.sector<1);assert.equal(entry.camera.position.length,3);assert.equal(entry.camera.quaternion.length,4);
  assert.ok([...entry.camera.position,...entry.camera.quaternion].every(Number.isFinite));
  assert.ok(entry.camera.fov>20&&entry.camera.fov<100);assert.ok(entry.draws>0&&entry.triangles>0);
  assert.equal(entry.sky.state,'ready',entry.id+' background loaded before capture');
  assert.equal(entry.sky.gpuCompressed,true,entry.id+' uses the delivered high resolution sky');
  assert.equal(entry.sky.width,8192);assert.equal(entry.sky.height,2048);
  assert.ok(['ready','disabled'].includes(entry.trees.state),entry.id+' applicable scanned trees resolved before capture');
  assert.equal(entry.crowd.assets.loaded,entry.crowd.assets.requested,entry.id+' crowd assets settled before capture');
  assert.equal(entry.crowd.assets.active,0);assert.equal(entry.crowd.assets.queued,0);
  const expectedMaps=Object.keys(TRACK_SURFACE_MAPS).length+(['norway-fjord','summit'].includes(entry.id)?Object.keys(TRACK_ROCK_MAPS).length:0);
  assert.equal(entry.surfaces.loaded,expectedMaps,entry.id+' actual surface maps finished loading');
  assert.equal(entry.textureProof.length,expectedMaps);assert.ok(entry.textureProof.every(p=>p.gpuRedStdDev>0),entry.id+' maps were sampled on the GPU');
 }
 assert.equal(total,manifest.totalBytes);assert.ok(total<4*1024*1024,'whole catalogue preview transfer stays below 4 MiB');
});
