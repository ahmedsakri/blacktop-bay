import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCANNED_TREE_VARIANTS} from '../src/scanned-tree-manifest.js';

const asset=file=>readFileSync(new URL('../public/assets/environments/trees/'+file,import.meta.url));
test('canopy bakes use the original CC0 tree leaf meshes and photograph with bounded downloads',()=>{
 const provenance=JSON.parse(asset('provenance.json')),canopy=provenance.canopyPhotograph;
 assert.equal(canopy.asset,provenance.asset);assert.equal(canopy.license,'CC0-1.0');assert.doesNotMatch(JSON.stringify(canopy),/potted_plant/);
 assert.equal(canopy.inputFiles.length,1);assert.match(canopy.inputFiles[0].file,/tree_small_02_leaves_diff_1k\.jpg$/);
 assert.deepEqual(provenance.sourceFiles.find(f=>f.file===canopy.inputFiles[0].file),canopy.inputFiles[0]);
 assert.equal(canopy.bake.sourceComponents,30250);assert.equal(canopy.bake.sourceTriangles,1939380);assert.equal(canopy.bake.tiles.length,16);assert.equal(canopy.bake.clusterCenters.length,8);
 for(const tile of canopy.bake.tiles){assert.ok(tile.sourceComponents>=100);assert.ok(tile.sourceTriangles>10000);assert.ok(tile.alphaCoverage>.1&&tile.alphaCoverage<.6,'source clusters retain natural silhouette gaps');}
 let total=0;for(const [tier,v]of Object.entries(SCANNED_TREE_VARIANTS)){assert.ok(v.bytes<=({mobile:550000,desktop:1350000,mobileFar:75000,desktopFar:175000}[tier]));total+=v.bytes;}
 assert.ok(total<=2150000);assert.ok(SCANNED_TREE_VARIANTS.mobile.bytes+SCANNED_TREE_VARIANTS.mobileFar.bytes<=625000);
});

test('shipped canopy cards retain paired views, alpha cutouts, and UV gutters inside their atlas tiles',()=>{
 for(const [tier,v]of Object.entries(SCANNED_TREE_VARIANTS)){
  const bytes=asset(v.file),jsonLength=bytes.readUInt32LE(12),g=JSON.parse(bytes.toString('utf8',20,20+jsonLength)),binaryStart=28+jsonLength,materialIndex=g.materials.findIndex(m=>m.name==='tree-canopy'),material=g.materials[materialIndex],p=g.meshes.flatMap(m=>m.primitives).find(p=>p.material===materialIndex);
  assert.equal(material.alphaMode,'MASK');assert.equal(material.doubleSided,true);assert.equal(material.alphaCutoff,.46);
  assert.equal(g.accessors[p.indices].count,v.leafSprays*12,'crossed clusters retain four triangles each');assert.equal(g.accessors[p.attributes.POSITION].count,v.canopyCards*4);
  const a=g.accessors[p.attributes.TEXCOORD_0],view=g.bufferViews[a.bufferView],uv=[];for(let i=0;i<a.count;i++)for(let k=0;k<2;k++)uv.push(bytes.readFloatLE(binaryStart+(view.byteOffset||0)+(a.byteOffset||0)+i*(view.byteStride||8)+k*4));const grid=v.canopyAtlasGrid;
  assert.equal(grid,tier.includes('Far')?2:4);assert.equal(v.canopyCards,v.leafSprays*2);
  const used=new Set();for(let card=0;card<v.canopyCards;card++){
   const vertices=Array.from({length:4},(_,n)=>[uv[card*8+n*2]*grid,uv[card*8+n*2+1]*grid]),tile=vertices[0].map(Math.floor);used.add(tile.join(':'));
   for(const pair of vertices)for(let axis=0;axis<2;axis++){assert.equal(Math.floor(pair[axis]),tile[axis]);const within=pair[axis]-tile[axis];assert.ok(within>.003&&within<.997,'UVs stay inside padded atlas edges');}
  }
  assert.equal(used.size,grid*grid);
  const texture=g.textures[material.pbrMetallicRoughness.baseColorTexture.index],image=g.images[texture.extensions.EXT_texture_webp.source],imageView=g.bufferViews[image.bufferView],webp=bytes.subarray(binaryStart+(imageView.byteOffset||0),binaryStart+(imageView.byteOffset||0)+imageView.byteLength);
  assert.equal(webp.toString('ascii',12,16),'VP8X');assert.ok(webp[20]&0x10,'canopy textures retain their alpha channel');
 }
});
