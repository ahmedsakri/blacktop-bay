// Optional offline source download: node scripts/download-tree-source.mjs
// Tree Small 02, Rico Cilliers / Poly Haven, CC0-1.0. Downloads only the
// source model and bark photographs into /tmp/camber-tree-source; none of
// these high-resolution inputs are served by the game. Every file is MD5
// checked against the primary Poly Haven API record before processing.
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const root='/tmp/camber-tree-source/',id='tree_small_02',api=await(await fetch('https://api.polyhaven.com/files/'+id)).json(),entry=api.gltf['1k'].gltf;
async function obtain(name,info){let b=await fs.readFile(root+name).catch(()=>null);if(!b||createHash('md5').update(b).digest('hex')!==info.md5){const response=await fetch(info.url);if(!response.ok)throw Error(response.status);b=Buffer.from(await response.arrayBuffer());if(createHash('md5').update(b).digest('hex')!==info.md5)throw Error('Source changed '+name);await fs.mkdir(root+name.split('/').slice(0,-1).join('/'),{recursive:true});await fs.writeFile(root+name,b);}return b;}
const raw=await obtain('source.gltf',entry),gltf=JSON.parse(raw);gltf.meshes[0].primitives=gltf.meshes[0].primitives.filter(p=>p.material!==1);gltf.materials=gltf.materials.filter((_,i)=>i!==1);for(const p of gltf.meshes[0].primitives)if(p.material===2)p.material=1;
const materials=gltf.materials;for(const m of materials){delete m.occlusionTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;m.pbrMetallicRoughness.metallicFactor=0;m.pbrMetallicRoughness.roughnessFactor=.94;}
const used=[...new Set(materials.flatMap(m=>[m.pbrMetallicRoughness.baseColorTexture.index,m.normalTexture.index]))],textures=used.map(i=>gltf.textures[i]),images=textures.map(t=>gltf.images[t.source]);for(const m of materials){m.pbrMetallicRoughness.baseColorTexture.index=used.indexOf(m.pbrMetallicRoughness.baseColorTexture.index);m.normalTexture.index=used.indexOf(m.normalTexture.index);}
gltf.images=images;gltf.textures=textures.map((t,i)=>({...t,source:i}));
await obtain(gltf.buffers[0].uri,entry.include[gltf.buffers[0].uri]);
for(const image of images)await obtain(image.uri,entry.include[image.uri]);
await fs.writeFile(root+'tree-trunk.gltf',JSON.stringify(gltf));await fs.writeFile(root+'source-provenance.json',JSON.stringify({asset:'https://polyhaven.com/a/'+id,author:'Rico Cilliers',license:'CC0-1.0',source:entry,usedFiles:[gltf.buffers[0].uri,...images.map(i=>i.uri)]},null,2));console.log(gltf.meshes[0].primitives.map(p=>({tri:gltf.accessors[p.indices].count/3,min:gltf.accessors[p.attributes.POSITION].min,max:gltf.accessors[p.attributes.POSITION].max})));console.log('tree source prepared');
