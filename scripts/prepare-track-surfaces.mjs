// Optional offline asset preparation. Runtime never contacts Poly Haven.
// Supply CAMBER_SHARP_MODULE with a locally installed sharp package if it is
// not available in the module search path. Existing verified outputs are kept.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=new URL('../public/assets/environments/surfaces/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('provenance.json',root),'utf8'));
const force=process.argv.includes('--force'),sourceCache=new Map();let sharp;
for(const entry of manifest.maps){
  const destination=new URL(entry.file,root);
  const existing=await readFile(destination).catch(()=>null);
  if(!force&&existing&&createHash('sha256').update(existing).digest('hex')===entry.sha256){console.log('Verified',entry.file);continue;}
  if(!sharp)sharp=(await import(process.env.CAMBER_SHARP_MODULE?pathToFileURL(process.env.CAMBER_SHARP_MODULE).href:'sharp')).default;
  let source=sourceCache.get(entry.source);
  if(!source){const response=await fetch(entry.source);if(!response.ok)throw new Error('Source download failed: '+response.status);source=Buffer.from(await response.arrayBuffer());
    if(createHash('md5').update(source).digest('hex')!==entry.sourceMD5)throw new Error('Upstream source changed: '+entry.file);sourceCache.set(entry.source,source);
  }
  const buffer=await sharp(source).resize(entry.width,entry.height).webp({quality:entry.colorSpace==='sRGB'?86:94,effort:6}).toBuffer();
  // A codec version may change bytes; do not silently replace reviewed assets.
  if(createHash('sha256').update(buffer).digest('hex')!==entry.sha256)throw new Error('Output differs from reviewed hash; inspect and update provenance explicitly: '+entry.file);
  await writeFile(destination,buffer);console.log('Prepared',entry.file,buffer.length);
}
