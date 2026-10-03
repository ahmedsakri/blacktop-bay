// Offline derivative of Poly Haven Tree Small 02, Rico Cilliers, CC0.
// Source geometry is never shipped. Keep scanned trunk/branch topology, then
// reduce it with normals/UVs; sample the original canopy for curved leaf sprays.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const sourceDir=option('--source','/tmp/camber-tree-source'),toolsDir=option('--tools','/tmp/camber-distance-tools');
const require=createRequire(resolve(toolsDir,'package.json')),load=name=>import(pathToFileURL(require.resolve(name)).href);
const [{NodeIO},{ALL_EXTENSIONS},{compactPrimitive,prune,dedup,textureCompress,weld},{MeshoptSimplifier},sharpModule]=await Promise.all([load('@gltf-transform/core'),load('@gltf-transform/extensions'),load('@gltf-transform/functions'),load('meshoptimizer'),load('sharp')]);
await MeshoptSimplifier.ready;const sharp=sharpModule.default,io=new NodeIO().registerExtensions(ALL_EXTENSIONS),output=resolve('public/assets/environments/trees');await mkdir(output,{recursive:true});
const source=JSON.parse(await readFile(resolve(sourceDir,'source.gltf'),'utf8')),binary=await readFile(resolve(sourceDir,source.buffers[0].uri)),sourceRecord=JSON.parse(await readFile(resolve(sourceDir,'source-provenance.json'),'utf8'));
if(createHash('md5').update(binary).digest('hex')!==sourceRecord.source.include[source.buffers[0].uri].md5)throw Error('Tree source geometry hash changed');
const leafPrimitive=source.meshes[0].primitives.find(p=>p.material===1),accessor=source.accessors[leafPrimitive.attributes.POSITION],view=source.bufferViews[accessor.bufferView],stride=view.byteStride||12,offset=(view.byteOffset||0)+(accessor.byteOffset||0),cells=new Map();
for(let i=0;i<accessor.count;i+=91){const o=offset+i*stride,p=[binary.readFloatLE(o),binary.readFloatLE(o+4),binary.readFloatLE(o+8)],key=p.map(v=>Math.floor(v/.28)).join(':');if(!cells.has(key))cells.set(key,{sum:[0,0,0],n:0});const c=cells.get(key);p.forEach((v,i)=>c.sum[i]+=v);c.n++;}
const candidates=[...cells.values()].map(c=>c.sum.map(v=>v/c.n)),picked=[],distance=candidates.map(()=>Infinity);
let choice=candidates.reduce((best,p,i)=>p[1]>candidates[best][1]?i:best,0);
for(let n=0;n<Math.min(340,candidates.length);n++){const p=candidates[choice];picked.push(p);distance[choice]=-1;let best=-1,next=0;for(let i=0;i<candidates.length;i++){if(distance[i]<0)continue;const q=candidates[i],d=q.reduce((s,v,j)=>s+(v-p[j])**2,0);distance[i]=Math.min(distance[i],d);if(distance[i]>best){best=distance[i];next=i;}}choice=next;}
const manifest={asset:sourceRecord.asset,author:sourceRecord.author,license:sourceRecord.license,sourceGltf:{url:sourceRecord.source.url,md5:sourceRecord.source.md5},sourceGeometry:sourceRecord.source.include[source.buffers[0].uri],sourceFiles:sourceRecord.usedFiles.filter(f=>f.startsWith('textures/')).map(file=>({file,...sourceRecord.source.include[file]})),changes:'Scanned trunk/branches simplified with attribute-weighted error cap; original canopy distribution sampled into textured leaf sprays. Original source geometry not redistributed.',variants:{}};
const surfaceRecord=JSON.parse(await readFile('public/assets/environments/surfaces/provenance.json','utf8'));
manifest.canopyPhotograph={asset:'https://polyhaven.com/a/potted_plant_02',author:'Rico Cilliers',license:'CC0-1.0',derivativeRecord:'../surfaces/provenance.json',inputFiles:surfaceRecord.maps.filter(e=>e.file.startsWith('foliage-leaf')).map(e=>Object.fromEntries(['file','sha256','source','sourceMD5','alphaSource','alphaSourceMD5','crop'].map(k=>[k,e[k]])))};
for(const {low,far,key} of [{low:true,far:false,key:'mobile'},{low:false,far:false,key:'desktop'},{low:true,far:true,key:'mobileFar'},{low:false,far:true,key:'desktopFar'}]){
 const doc=await io.read(resolve(sourceDir,'tree-trunk.gltf')),root=doc.getRoot();await doc.transform(weld());
 let maxError=0;
 for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
  const idx=p.getIndices(),pos=p.getAttribute('POSITION'),normal=p.getAttribute('NORMAL'),uv=p.getAttribute('TEXCOORD_0'),attrs=new Float32Array(pos.getCount()*5);
  for(let i=0;i<pos.getCount();i++){attrs.set(normal.getArray().subarray(i*3,i*3+3),i*5);attrs.set(uv.getArray().subarray(i*2,i*2+2),i*5+3);}
  const target=(p.getMaterial().getName().includes('branches')?(far?(low?260:420):(low?1200:2700)):(far?(low?150:240):(low?700:1400)))*3;
  const [indices,error]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(idx.getArray()),new Float32Array(pos.getArray()),3,attrs,5,[.02,.02,.02,.003,.003],null,target,far?(low?.08:.05):low?.035:.014,['Permissive']);
  maxError=Math.max(maxError,error);p.setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(idx.getBuffer()));compactPrimitive(p);
  p.getMaterial().setRoughnessFactor(.94).setMetallicFactor(0);
 }
 const count=Math.min(far?(low?48:80):low?180:340,picked.length),positions=[],normals=[],uvs=[],indices=[];
 for(let i=0;i<count;i++){
  const p=picked[i],a=i*2.399963,tilt=Math.sin(i*1.19)*.8,size=(far?(low?.67:.55):low?.40:.29)*(1+(i%4)*.07),ca=Math.cos(a),sa=Math.sin(a),ct=Math.cos(tilt),st=Math.sin(tilt);
  const vertices=[[0,.08,0],[-1,0,-1],[-1,0,1],[1,0,1],[1,0,-1]],uv=[[.5,.5],[0,0],[0,1],[1,1],[1,0]],base=positions.length/3;
  for(let n=0;n<5;n++){const [x,y,z]=vertices[n].map(v=>v*size),yy=y*ct-z*st,zz=y*st+z*ct;positions.push(p[0]+x*ca+zz*sa,p[1]+yy,p[2]-x*sa+zz*ca);normals.push(sa*st,ct,ca*st);uvs.push(...uv[n]);}
  indices.push(...[0,1,2,0,2,3,0,3,4,0,4,1].map(n=>base+n));
 }
 const buffer=root.listBuffers()[0],attribute=(type,array)=>doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
 const texture=doc.createTexture('photographed-canopy-spray').setMimeType('image/webp').setImage(await readFile('public/assets/environments/surfaces/foliage-leaf'+(low?'-mobile':'')+'.webp'));
 const material=doc.createMaterial('tree-canopy').setBaseColorTexture(texture).setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(true).setAlphaMode('MASK').setAlphaCutoff(.46);
 const primitive=doc.createPrimitive().setAttribute('POSITION',attribute('VEC3',new Float32Array(positions))).setAttribute('NORMAL',attribute('VEC3',new Float32Array(normals))).setAttribute('TEXCOORD_0',attribute('VEC2',new Float32Array(uvs))).setIndices(attribute('SCALAR',new Uint16Array(indices))).setMaterial(material);
 root.listMeshes()[0].addPrimitive(primitive);
 await doc.transform(prune(),dedup(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[far?(low?128:256):low?512:1024,far?(low?128:256):low?512:1024],quality:86}));
 let triangles=0,minY=Infinity,maxY=-Infinity,radius=0;for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){triangles+=p.getIndices().getCount()/3;const a=p.getAttribute('POSITION').getArray();for(let i=0;i<a.length;i+=3){minY=Math.min(minY,a[i+1]);maxY=Math.max(maxY,a[i+1]);radius=Math.max(radius,Math.hypot(a[i],a[i+2]));}}
 const file='tree-small-02'+(far?'-far':'')+(low?'-mobile':'')+'.glb';root.getAsset().copyright='Tree Small 02 by Rico Cilliers / Poly Haven, CC0-1.0; derivative for Camber Reign';root.getAsset().extras={source:sourceRecord.asset,license:'CC0-1.0',changes:manifest.changes};await io.write(resolve(output,file),doc);const bytes=await readFile(resolve(output,file));manifest.variants[key]={file,triangles,primitives:3,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),minY,height:maxY-minY,radius,leafSprays:count,maxRelativeError:maxError};console.log(low?'mobile':'desktop',manifest.variants[key]);
}
await writeFile(resolve(output,'provenance.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile('src/scanned-tree-manifest.js','// Generated from verified CC0 tree derivatives; see trees/provenance.json.\nexport const SCANNED_TREE_VARIANTS=Object.freeze('+JSON.stringify(manifest.variants,null,2)+');\n');
