// Optional offline derivative. Marble Cliff 05 / Amal Kumar / Poly Haven, CC0.
// Source photographs stay outside the repository; runtime uses local WebP only.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const sourceDir=resolve(option('--source','../camber-reign-asset-sources/fjord-rock')),toolsDir=resolve(option('--tools','/tmp/camber-distance-tools')),sharp=createRequire(resolve(toolsDir,'package.json'))('sharp'),output=resolve('public/assets/environments/surfaces');
const source={color:{url:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/marble_cliff_05/marble_cliff_05_diff_1k.jpg',md5:'84d207d6f6d8a52c41da48144b951eab'},normal:{url:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/marble_cliff_05/marble_cliff_05_nor_gl_1k.jpg',md5:'40ef330d85d99dc57cff6a19bc70f830'}};
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const record={asset:'https://polyhaven.com/a/marble_cliff_05',author:'Amal Kumar',license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',sourceApi:'https://api.polyhaven.com/files/marble_cliff_05',sourceScaleMetres:20,changes:'Resized original photographed diffuse and OpenGL normal maps, then WebP encoded. No recoloring, generated surface detail, or green tint. A reusable cliff material, not a scan of the Norwegian game location.',encoder:{sharp:sharp.versions.sharp,colorQuality:86,normalQuality:94,effort:6},maps:[]},pending=[];
await mkdir(sourceDir,{recursive:true});await mkdir(output,{recursive:true});
for(const [kind,entry]of Object.entries(source)){
 let input=await readFile(resolve(sourceDir,kind+'.jpg')).catch(()=>null);
 if(!input||hash(input,'md5')!==entry.md5){const response=await fetch(entry.url);if(!response.ok)throw Error('Source download failed: '+response.status);input=Buffer.from(await response.arrayBuffer());if(hash(input,'md5')!==entry.md5)throw Error('Source hash changed: '+kind);await writeFile(resolve(sourceDir,kind+'.jpg'),input);}
 for(const low of [false,true]){
  const size=low?512:1024,file='fjord-rock-'+kind+(low?'-mobile':'')+'.webp',bytes=await sharp(input).resize(size,size).webp({quality:kind==='color'?86:94,effort:6}).toBuffer(),meta=await sharp(bytes).metadata();
  if(meta.width!==size||meta.height!==size||meta.format!=='webp')throw Error('Invalid output '+file);
  record.maps.push({file,width:size,height:size,bytes:bytes.length,sha256:hash(bytes),source:entry.url,sourceMD5:entry.md5,sourceSHA256:hash(input),asset:record.asset,author:record.author,license:record.license,colorSpace:kind==='color'?'sRGB':'linear data',...(kind==='normal'?{normalConvention:'OpenGL +Y'}:{}),metres:20});pending.push({file,bytes});
 }
}
record.totalBytes=record.maps.reduce((sum,map)=>sum+map.bytes,0);record.tierBytes={desktop:record.maps.filter(map=>map.width===1024).reduce((sum,map)=>sum+map.bytes,0),mobile:record.maps.filter(map=>map.width===512).reduce((sum,map)=>sum+map.bytes,0)};
if(record.totalBytes>1000000)throw Error('Combined cliff material exceeds its 1 MB transfer budget');
for(const {file,bytes}of pending){await writeFile(resolve(output,file),bytes);console.log(file,bytes.length);}
await writeFile(resolve(output,'fjord-rock-provenance.json'),JSON.stringify(record,null,2)+'\n');
await writeFile(resolve(output,'FJORD-ROCK-LICENSE.txt'),'Marble Cliff 05 by Amal Kumar / Poly Haven\nhttps://polyhaven.com/a/marble_cliff_05\nCC0-1.0 / https://polyhaven.com/license\n\nDerivative: resized diffuse and OpenGL normal maps, WebP encoded for Camber Reign.\nOriginal colors retained. Source hashes and delivered hashes: fjord-rock-provenance.json.\n');
console.log(JSON.stringify({totalBytes:record.totalBytes,tierBytes:record.tierBytes}));
