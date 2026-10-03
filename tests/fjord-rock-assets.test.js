import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const directory=new URL('../public/assets/environments/surfaces/',import.meta.url);
const provenance=JSON.parse(readFileSync(new URL('fjord-rock-provenance.json',directory)));
const files=['fjord-rock-color.webp','fjord-rock-color-mobile.webp','fjord-rock-normal.webp','fjord-rock-normal-mobile.webp'];
const dimensions=bytes=>{
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt32LE(4)+8,bytes.length);assert.equal(bytes.toString('ascii',8,12),'WEBP');
 if(bytes.toString('ascii',12,16)==='VP8X')return [1+bytes.readUIntLE(24,3),1+bytes.readUIntLE(27,3)];
 assert.equal(bytes.toString('ascii',12,16),'VP8 ');return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
};

test('delivered fjord rock maps match separate provenance, SHA hashes and decoded WebP dimensions',()=>{
 assert.deepEqual(provenance.maps.map(map=>map.file).sort(),[...files].sort());
 for(const map of provenance.maps){
  const bytes=readFileSync(new URL(map.file,directory)),size=map.file.includes('-mobile')?512:1024;
  assert.equal(bytes.length,map.bytes,map.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),map.sha256,map.file);
  assert.deepEqual(dimensions(bytes),[size,size],map.file);assert.deepEqual([map.width,map.height],[size,size],map.file);
 }
});

test('fjord cliff photographs retain CC0 source identity, sRGB diffuse and linear OpenGL normal tags',()=>{
 assert.equal(provenance.asset,'https://polyhaven.com/a/marble_cliff_05');assert.equal(provenance.author,'Amal Kumar');assert.equal(provenance.license,'CC0-1.0');assert.equal(provenance.sourceScaleMetres,20);
 const inputs={
  color:{suffix:'diff',md5:'84d207d6f6d8a52c41da48144b951eab',sha256:'06d39eeb7243e5dd1aa8a5e2f4acb6e62fc3457ceb066bfa73743c977336baa4'},
  normal:{suffix:'nor_gl',md5:'40ef330d85d99dc57cff6a19bc70f830',sha256:'9ab8f503f45331a9ff9c25270a04cde988d2e0e2d1374f8378d915ca5af0d934'}
 };
 for(const map of provenance.maps){
  const normal=map.file.includes('-normal'),source=inputs[normal?'normal':'color'];
  assert.equal(map.asset,provenance.asset);assert.equal(map.author,provenance.author);assert.equal(map.license,'CC0-1.0');assert.equal(map.metres,20);
  assert.equal(map.source,`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/marble_cliff_05/marble_cliff_05_${source.suffix}_1k.jpg`);
  assert.equal(map.sourceMD5,source.md5);assert.equal(map.sourceSHA256,source.sha256);
  assert.equal(map.colorSpace,normal?'linear data':'sRGB');assert.equal(map.normalConvention,normal?'OpenGL +Y':undefined);
 }
});

test('actual fjord rock transfer stays below one megabyte for all desktop and mobile maps combined',()=>{
 const bytes={desktop:0,mobile:0};for(const file of files)bytes[file.includes('-mobile')?'mobile':'desktop']+=readFileSync(new URL(file,directory)).length;
 const total=bytes.desktop+bytes.mobile;assert.deepEqual(provenance.tierBytes,bytes);assert.equal(provenance.totalBytes,total);
 assert.ok(bytes.desktop<=750000,'desktop material pair exceeds 750 KB');assert.ok(bytes.mobile<=250000,'mobile material pair exceeds 250 KB');assert.ok(total<=1000000,'combined material set exceeds 1 MB');
});
