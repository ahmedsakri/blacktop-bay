/** Build genuine distance meshes from existing licensed low GLBs; no download.
 * npm install --prefix /tmp/camber-distance-tools @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0 sharp@0.34.5
 * node scripts/prepare-distance-assets.mjs [--tools /tmp/camber-distance-tools]
 * Near/player geometry is untouched. Distance simplification retains the node
 * topology, named wheel pivots, UVs, normals, paint slots and embedded credits.
 */
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MANUFACTURER_ASSETS} from '../src/manufacturer-asset-manifest.js';
const args=process.argv.slice(2),i=args.indexOf('--tools');
const require=createRequire(resolve(i<0?'/tmp/camber-distance-tools':args[i+1],'package.json'));
const load=name=>import(pathToFileURL(require.resolve(name)).href);
const [{NodeIO},{ALL_EXTENSIONS},{compactPrimitive,dedup,prune,textureCompress,meshopt,dequantize,weld},{MeshoptSimplifier,MeshoptEncoder,MeshoptDecoder},sharpModule]=await Promise.all([load('@gltf-transform/core'),load('@gltf-transform/extensions'),load('@gltf-transform/functions'),load('meshoptimizer'),load('sharp')]);
await Promise.all([MeshoptSimplifier.ready,MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const base=fileURLToPath(new URL('../',import.meta.url)),report={};
const triangles=doc=>doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((sum,p)=>sum+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0);
for(const [id,manifest]of Object.entries(MANUFACTURER_ASSETS)){
 const source=resolve(base,'public'+manifest.low),doc=await io.read(source),root=doc.getRoot(),before=triangles(doc);
 for(const extension of root.listExtensionsUsed())if(extension.extensionName==='EXT_meshopt_compression')extension.dispose();
 await doc.transform(dequantize(),weld());
 const ratio=Math.min(.42,45000/before);
 let maxError=0;
 for(const mesh of root.listMeshes())for(const primitive of mesh.listPrimitives()){
  const idx=primitive.getIndices(),pos=primitive.getAttribute('POSITION'),normal=primitive.getAttribute('NORMAL'),uv=primitive.getAttribute('TEXCOORD_0');if(!idx||!normal||idx.getCount()<90)continue;
  const stride=uv?5:3,attributes=new Float32Array(pos.getCount()*stride),n=normal.getArray(),t=uv?.getArray();
  for(let j=0;j<pos.getCount();j++){for(let k=0;k<3;k++)attributes[j*stride+k]=n[j*3+k];if(uv){attributes[j*stride+3]=t[j*2];attributes[j*stride+4]=t[j*2+1];}}
  // Attribute-weighted collapse keeps paint edges and optical normals. A tight
  // geometric error cap is more important than reaching the triangle target.
  const [reduced,error]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(idx.getArray()),new Float32Array(pos.getArray()),3,attributes,stride,uv?[.09,.09,.09,.03,.03]:[.09,.09,.09],null,Math.max(36,Math.floor(idx.getCount()*ratio/3)*3),.006,['Permissive']);
  maxError=Math.max(maxError,error);primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(reduced).setBuffer(idx.getBuffer()));compactPrimitive(primitive);
 }
 await doc.transform(dedup(),prune(),textureCompress({encoder:sharpModule.default,targetFormat:'webp',resize:[192,192],quality:78}),meshopt({encoder:MeshoptEncoder,level:'medium'}));
 const names=root.listNodes().map(n=>n.getName());for(const wheel of manifest.wheelNames)if(!names.includes(wheel))throw new Error(id+' lost '+wheel);
 const originalExtras=root.getAsset().extras||{};root.getAsset().extras={...originalExtras,detail:'distance',derivedFrom:manifest.low,changes:(originalExtras.changes||'')+' Additional distance-only attribute-weighted geometry reduction with relative error capped at 0.006 and embedded textures resized to 192px.'};
 const path='/assets/cars/manufacturers/'+id+'-distance.glb',output=resolve(base,'public'+path);await io.write(output,doc);const bytes=await readFile(output);
 report[id]={path,triangles:triangles(doc),sourceTriangles:before,bytes:bytes.length,maxRelativeError:maxError,sha256:createHash('sha256').update(bytes).digest('hex'),sourceSha256:manifest.variants.low.sha256};
 console.log(id+': '+before+' -> '+report[id].triangles+' triangles, '+bytes.length+' bytes');
}
await writeFile(resolve(base,'src/manufacturer-distance-manifest.js'),'// Generated from licensed low assets by scripts/prepare-distance-assets.mjs. Attribution remains in MANUFACTURER_ASSETS and embedded GLBs.\nexport const MANUFACTURER_DISTANCE_ASSETS=Object.freeze('+JSON.stringify(report,null,2)+');\n');
await writeFile(resolve(base,'reports/manufacturer-distance-assets.json'),JSON.stringify(report,null,2)+'\n');
