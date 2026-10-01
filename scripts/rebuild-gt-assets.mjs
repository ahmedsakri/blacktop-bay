/**
 * Rebuild the credited GT assets from a supplied original Ferrari GLB.
 * Offline dev tools only (never included in the game bundle):
 *   npm install --prefix /tmp/blacktop-asset-tools @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0 draco3dgltf@1.5.7
 *   node scripts/rebuild-gt-assets.mjs /path/to/licensed/ferrari.glb --tools /tmp/blacktop-asset-tools
 * The source must be the original credited Three.js redistribution. See
 * public/assets/cars/FERRARI-CREDITS.txt for license, author and source links.
 */
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2), source=args[0];
if(!source||source.startsWith('--'))throw new Error('Supply the original licensed Ferrari GLB path; optionally --tools <dev-tools-directory> and --out <output-directory>.');
const option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const toolRoot=option('--tools'), output=resolve(option('--out')||fileURLToPath(new URL('../public/assets/cars/',import.meta.url)));
const resolver=createRequire(toolRoot?resolve(toolRoot,'package.json'):import.meta.url);
const load=async name=>import(pathToFileURL(resolver.resolve(name)).href);
const [{NodeIO},{ALL_EXTENSIONS},{weld,dedup,prune,compactPrimitive},{MeshoptSimplifier},dracoImport]=await Promise.all([
  load('@gltf-transform/core'),load('@gltf-transform/extensions'),load('@gltf-transform/functions'),load('meshoptimizer'),load('draco3dgltf'),
]);
const draco=dracoImport.default||dracoImport;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});
await MeshoptSimplifier.ready;
const sourceHash=createHash('sha256').update(await readFile(source)).digest('hex');
if(sourceHash!=='cafe3f48da6797aa9bde75ca768bc5b57db366575fd233e90df186ae988a876e')
  throw new Error('Source checksum differs from the credited original; do not rebuild from an already simplified asset.');
// These outward-facing reflective surfaces must retain the original geometry
// and normals. Permissive simplification produced folded paint and rim faces;
// retaining just the old normals after changing positions cannot repair them.
const protectedSurface=name=>/^(?:body$|glass$|chrome$|wheel|rim_|tire|brake$|nuts|centre)/.test(name);
await mkdir(output,{recursive:true});
for(const [label,ratio,error,fileName]of[['high',.4,.003,'gt-base.glb'],['low',.17,.008,'gt-base-low.glb']]){
  const doc=await io.read(source);
  for(const extension of doc.getRoot().listExtensionsUsed())if(extension.extensionName==='KHR_draco_mesh_compression')extension.dispose();
  await doc.transform(weld());
  let protectedTriangles=0;
  for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
    const indices=primitive.getIndices(),position=primitive.getAttribute('POSITION'),normal=primitive.getAttribute('NORMAL');
    if(!indices||!normal)continue;
    if(protectedSurface(mesh.getName())){protectedTriangles+=indices.getCount()/3;continue;}
    const [reduced]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(indices.getArray()),new Float32Array(position.getArray()),3,
      new Float32Array(normal.getArray()),3,[.05,.05,.05],null,Math.floor(indices.getCount()*ratio/3)*3,error,['Permissive']);
    primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(reduced).setBuffer(indices.getBuffer()));
    compactPrimitive(primitive);
  }
  await doc.transform(dedup(),prune());
  doc.getRoot().getAsset().extras={author:'vicent091036',title:'Ferrari 458 Italia',license:'CC-BY-4.0',
    source:'https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/ferrari.glb',sourceSha256:sourceHash,
    changes:'Decoded original Draco mesh. Body, glazing, chrome and articulated wheel/rim/tyre/brake surfaces retain original geometry and normals; only secondary interior/detail surfaces are simplified. Runtime fictional race adaptations are separate.',
    detail:label,secondarySimplification:{ratio,error,normalWeights:[.05,.05,.05],flags:['Permissive']},protectedTriangles};
  const destination=resolve(output,fileName);await io.write(destination,doc);
  const bytes=(await readFile(destination)).byteLength;
  const triangles=doc.getRoot().listMeshes().reduce((sum,mesh)=>sum+mesh.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0);
  console.log(JSON.stringify({file:destination,sourceSha256:sourceHash,triangles,protectedTriangles,bytes}));
}
