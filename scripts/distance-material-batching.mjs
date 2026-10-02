// Distance-only atlas baking. Named paint, animated lamps and transparent optics
// remain separate. Only bounded UVs and standard opaque material slots qualify.
const srgbToLinear=n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4;
const linearToSrgb=n=>n<=.0031308?n*12.92:1.055*n**(1/2.4)-.055;
const byte=n=>Math.round(Math.max(0,Math.min(1,n))*255);
export async function batchDistanceMaterials(doc,manifest,{sharp,joinPrimitives}){
 const root=doc.getRoot(),protectedNames=new Set([...(manifest.paintMaterialNames||[]),...(manifest.brakeLightMaterialNames||[])]),eligible=[];
 const slotNames=['BaseColor','MetallicRoughness','Emissive'];
 const safeMaterial=m=>m&&m.getAlphaMode()==='OPAQUE'&&!protectedNames.has(m.getName())&&!/glass|window|lamp|light|lens/i.test(m.getName())&&m.listExtensions().length===0&&m.getEmissiveFactor().every(value=>value<=1)&&slotNames.every(slot=>!m['get'+slot+'Texture']()||(m['get'+slot+'TextureInfo']().getTexCoord()===0&&m['get'+slot+'TextureInfo']().listExtensions().length===0));
 for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){
  const m=p.getMaterial(),uv=p.getAttribute('TEXCOORD_0');
  if(!safeMaterial(m)||p.listTargets().length||p.getMode()!==4)continue;
  if(uv&&Array.from(uv.getArray()).some(n=>n<-.0001||n>1.0001))continue;
  eligible.push(p);
 }
 const materials=[...new Set(eligible.map(p=>p.getMaterial()))];if(materials.length<2)return {primitivesRemoved:0,atlasMaterials:0};
 const tile=64,pad=4,inner=tile-pad*2,grid=2**Math.ceil(Math.log2(Math.ceil(Math.sqrt(materials.length)))),size=tile*grid;
 const channels={BaseColor:new Uint8Array(size*size*4),MetallicRoughness:new Uint8Array(size*size*4),Emissive:new Uint8Array(size*size*4)};
 let hasEmission=false;
 for(const [index,m]of materials.entries()){
  const ox=index%grid*tile,oy=Math.floor(index/grid)*tile;
  for(const slot of slotNames){
   const source=m['get'+slot+'Texture']();let pixels;
   if(source)pixels=await sharp(source.getImage()).resize(inner,inner,{fit:'fill'}).ensureAlpha().raw().toBuffer();
   const factor=slot==='BaseColor'?m.getBaseColorFactor():slot==='Emissive'?m.getEmissiveFactor():[1,m.getRoughnessFactor(),m.getMetallicFactor()];
   if(slot==='Emissive'&&factor.some(n=>n>0))hasEmission=true;
   for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
    const sx=Math.min(inner-1,Math.max(0,x-pad)),sy=Math.min(inner-1,Math.max(0,y-pad)),src=(sy*inner+sx)*4,dst=((oy+y)*size+ox+x)*4;
    for(let c=0;c<3;c++){
     const value=pixels?pixels[src+c]/255:1;
     channels[slot][dst+c]=byte(slot==='MetallicRoughness'?value*factor[c]:linearToSrgb(srgbToLinear(value)*factor[c]));
    }
    channels[slot][dst+3]=slot==='BaseColor'?byte((pixels?pixels[src+3]/255:1)*factor[3]):255;
   }
  }
 }
 const textures={};
 for(const slot of slotNames){if(slot==='Emissive'&&!hasEmission)continue;
  textures[slot]=doc.createTexture('distance-atlas-'+slot).setImage(await sharp(channels[slot],{raw:{width:size,height:size,channels:4}}).png().toBuffer()).setMimeType('image/png');
 }
 const batches=new Map();let removed=0;
 for(const mesh of root.listMeshes()){
  const byMaterial=new Map();
  for(const p of mesh.listPrimitives()){
   if(!eligible.includes(p))continue;const source=p.getMaterial(),index=materials.indexOf(source),key=String(source.getDoubleSided());
   if(!batches.has(key)){
    const m=doc.createMaterial('distance-atlas-opaque-'+key).setDoubleSided(source.getDoubleSided()).setBaseColorFactor([1,1,1,1]).setMetallicFactor(1).setRoughnessFactor(1).setBaseColorTexture(textures.BaseColor).setMetallicRoughnessTexture(textures.MetallicRoughness);
    if(textures.Emissive)m.setEmissiveFactor([1,1,1]).setEmissiveTexture(textures.Emissive);batches.set(key,m);
   }
   const count=p.getAttribute('POSITION').getCount(),old=p.getAttribute('TEXCOORD_0')?.getArray(),uv=new Float32Array(count*2),ox=index%grid*tile+pad,oy=Math.floor(index/grid)*tile+pad;
   for(let v=0;v<count;v++){uv[v*2]=(ox+(old?old[v*2]:.5)*inner)/size;uv[v*2+1]=(oy+(old?old[v*2+1]:.5)*inner)/size;}
   p.setAttribute('TEXCOORD_0',doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(p.getAttribute('POSITION').getBuffer()));
   // These maps are already omitted by the distance shader. Removing their
   // vertex inputs permits compatible merging without changing source normals.
   for(const semantic of p.listSemantics())if(!['POSITION','NORMAL','TEXCOORD_0','COLOR_0'].includes(semantic))p.setAttribute(semantic,null);
   if(!p.getAttribute('COLOR_0'))p.setAttribute('COLOR_0',doc.createAccessor().setType('VEC4').setArray(new Float32Array(count*4).fill(1)).setBuffer(p.getAttribute('POSITION').getBuffer()));
   else if(p.getAttribute('COLOR_0').getType()==='VEC3'){
    const original=p.getAttribute('COLOR_0'),array=new Float32Array(count*4);for(let v=0;v<count;v++){array.set(original.getElement(v,[]),v*4);array[v*4+3]=1;}
    p.setAttribute('COLOR_0',doc.createAccessor().setType('VEC4').setArray(array).setBuffer(original.getBuffer()));
   }
   p.setMaterial(batches.get(key));if(!byMaterial.has(key))byMaterial.set(key,[]);byMaterial.get(key).push(p);
  }
  for(const prims of byMaterial.values())if(prims.length>1){const merged=joinPrimitives(prims);for(const p of prims)p.dispose();mesh.addPrimitive(merged);removed+=prims.length-1;}
 }
 return {primitivesRemoved:removed,atlasMaterials:batches.size,atlasSize:size};
}
