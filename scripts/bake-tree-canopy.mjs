// Offline orthographic bake of connected leaf meshes from Tree Small 02 (CC0).
// Silhouettes come from the source triangles; no painted/procedural leaf shapes.
export async function bakeTreeCanopy({source,binary,diffuse,sharp}){
 const primitive=source.meshes[0].primitives.find(p=>p.material===1);
 const read=index=>{
  const a=source.accessors[index],v=source.bufferViews[a.bufferView],width=a.type==='VEC3'?3:a.type==='VEC2'?2:1,C=a.componentType===5126?Float32Array:a.componentType===5125?Uint32Array:Uint16Array;
  if(v.byteStride&&v.byteStride!==width*C.BYTES_PER_ELEMENT)throw Error('Unexpected interleaved tree source');
  return new C(binary.buffer,binary.byteOffset+(v.byteOffset||0)+(a.byteOffset||0),a.count*width);
 };
 const pos=read(primitive.attributes.POSITION),uv=read(primitive.attributes.TEXCOORD_0),normal=read(primitive.attributes.NORMAL),indices=read(primitive.indices),parent=new Uint32Array(pos.length/3);
 for(let i=0;i<parent.length;i++)parent[i]=i;
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},join=(a,b)=>{a=root(a);b=root(b);if(a!==b)parent[a]=b;};
 for(let i=0;i<indices.length;i+=3){join(indices[i],indices[i+1]);join(indices[i],indices[i+2]);}
 const components=new Map();
 for(let i=0;i<parent.length;i++){
  const key=root(i);parent[i]=key;if(!components.has(key))components.set(key,{vertices:[],triangles:[],center:[0,0,0]});
  const c=components.get(key);c.vertices.push(i);for(let k=0;k<3;k++)c.center[k]+=pos[i*3+k];
 }
 for(const c of components.values())c.center=c.center.map(v=>v/c.vertices.length);
 for(let i=0;i<indices.length;i+=3)components.get(parent[indices[i]]).triangles.push(i);
 const parts=[...components.values()],cells=new Map(),cellSize=.35;
 for(const c of parts){const key=c.center.map(v=>Math.floor(v/cellSize)).join(':');if(!cells.has(key))cells.set(key,{center:[0,0,0],count:0});const cell=cells.get(key);cell.count++;for(let k=0;k<3;k++)cell.center[k]+=c.center[k];}
 const dense=[...cells.values()].filter(c=>c.count>=32).map(c=>({...c,center:c.center.map(v=>v/c.count)})).sort((a,b)=>b.count-a.count),seeds=[];
 for(const c of dense){if(seeds.every(p=>Math.hypot(...c.center.map((v,k)=>v-p[k]))>.5))seeds.push(c.center);if(seeds.length===8)break;}
 if(seeds.length!==8)throw Error('Insufficient source canopy clusters');
 const {data:photo,info}=await sharp(diffuse).removeAlpha().raw().toBuffer({resolveWithObject:true}),tileSize=256,atlasSize=1024,atlas=Buffer.alloc(atlasSize*atlasSize*4),tiles=[];
 for(const [cluster,center]of seeds.entries()){
  const selected=parts.filter(c=>Math.hypot(...c.center.map((v,k)=>v-center[k]))<.26);
  // Keep complete connected components so a branch never ends at a crop boundary.
  let extent=0;for(const c of selected)for(const i of c.vertices)extent=Math.max(extent,Math.hypot(pos[i*3]-center[0],pos[i*3+1]-center[1],pos[i*3+2]-center[2]));extent*=1.04;
  for(let side=0;side<2;side++){
   const angle=cluster*2.399963+side*Math.PI/2,ca=Math.cos(angle),sa=Math.sin(angle),project=i=>{const x=pos[i*3]-center[0],y=pos[i*3+1]-center[1],z=pos[i*3+2]-center[2];return [(x*ca-z*sa)/extent*(tileSize-4)/2+tileSize/2,-y/extent*(tileSize-4)/2+tileSize/2,x*sa+z*ca];},depth=new Float32Array(tileSize*tileSize).fill(-Infinity),pixels=Buffer.alloc(tileSize*tileSize*4);
   for(const c of selected)for(const triangle of c.triangles){
    const ids=[indices[triangle],indices[triangle+1],indices[triangle+2]],v=ids.map(project),den=(v[1][1]-v[2][1])*(v[0][0]-v[2][0])+(v[2][0]-v[1][0])*(v[0][1]-v[2][1]);if(Math.abs(den)<1e-6)continue;
    const minX=Math.max(1,Math.floor(Math.min(...v.map(p=>p[0])))),maxX=Math.min(tileSize-2,Math.ceil(Math.max(...v.map(p=>p[0])))),minY=Math.max(1,Math.floor(Math.min(...v.map(p=>p[1])))),maxY=Math.min(tileSize-2,Math.ceil(Math.max(...v.map(p=>p[1]))));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
     const a=((v[1][1]-v[2][1])*(x+.5-v[2][0])+(v[2][0]-v[1][0])*(y+.5-v[2][1]))/den,b=((v[2][1]-v[0][1])*(x+.5-v[2][0])+(v[0][0]-v[2][0])*(y+.5-v[2][1]))/den,c=1-a-b;if(a<0||b<0||c<0)continue;
     const z=a*v[0][2]+b*v[1][2]+c*v[2][2],p=y*tileSize+x;if(z<=depth[p])continue;depth[p]=z;
     const weights=[a,b,c],u=ids.reduce((s,i,k)=>s+uv[i*2]*weights[k],0),w=ids.reduce((s,i,k)=>s+uv[i*2+1]*weights[k],0),tx=Math.max(0,Math.min(info.width-1,Math.round(u*(info.width-1)))),ty=Math.max(0,Math.min(info.height-1,Math.round(w*(info.height-1)))),sample=(ty*info.width+tx)*info.channels;
     // Modest self-orientation shading retains leaf relief without a baked sun.
     const ny=ids.reduce((s,i,k)=>s+normal[i*3+1]*weights[k],0),light=.82+.18*Math.abs(ny);
     for(let k=0;k<3;k++)pixels[p*4+k]=photo[sample+k]*light;pixels[p*4+3]=255;
    }
   }
   // RGB padding keeps mipmapped cutout edges green rather than black.
   for(let pass=0;pass<3;pass++){const previous=Buffer.from(pixels);for(let y=1;y<tileSize-1;y++)for(let x=1;x<tileSize-1;x++){const p=(y*tileSize+x)*4;if(previous[p+3]||previous[p]+previous[p+1]+previous[p+2])continue;const neighbours=[p-4,p+4,p-tileSize*4,p+tileSize*4].filter(i=>previous[i]+previous[i+1]+previous[i+2]);if(neighbours.length)for(let k=0;k<3;k++)pixels[p+k]=neighbours.reduce((s,i)=>s+previous[i+k],0)/neighbours.length;}}
   const tile=cluster*2+side,left=(tile%4)*tileSize,top=Math.floor(tile/4)*tileSize;
   for(let y=0;y<tileSize;y++)pixels.copy(atlas,((top+y)*atlasSize+left)*4,y*tileSize*4,(y+1)*tileSize*4);
   tiles.push({cluster,side,sourceComponents:selected.length,sourceTriangles:selected.reduce((s,c)=>s+c.triangles.length,0),diameter:extent*2,alphaCoverage:depth.reduce((n,d)=>n+(d>-Infinity),0)/(tileSize*tileSize)});
  }
 }
 const near=await sharp(atlas,{raw:{width:atlasSize,height:atlasSize,channels:4}}).png().toBuffer(),farTiles=[0,3,8,13],far=await sharp({create:{width:512,height:512,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(await Promise.all(farTiles.map(async(tile,i)=>({input:await sharp(near).extract({left:tile%4*tileSize,top:Math.floor(tile/4)*tileSize,width:tileSize,height:tileSize}).toBuffer(),left:i%2*tileSize,top:Math.floor(i/2)*tileSize})))).png().toBuffer();
 return {near,far,record:{method:'Orthographic alpha bake of complete connected leaf meshes, original UVs and diffuse photograph; paired views on crossed canopy cards',sourceComponents:components.size,sourceTriangles:indices.length/3,nearGrid:4,farGrid:2,farTiles,clusterCenters:seeds,tiles}};
}
