import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {sampleTrack,projectOnTrack} from './track.js';
import {setWorldSurfaceUV,pavingSurfaceMaterial} from './track-surface-materials.js';
import {appendTerrainOutskirts} from './terrain-landscape.js';

export function coastalDistrictHeight(track,x,z){
 const p=projectOnTrack(x,z,undefined,track),f=p.s/track.length;
 // Keep the suspension crossing over open water, with tapered abutments.
 const bridge=f>.245&&f<.325;
 const shore=100+12*Math.sin(x*.013)+9*Math.cos(z*.019);
 if(bridge&&p.distance<track.width/2+24)return -3.1;
 const shelf=THREE.MathUtils.smoothstep(shore-p.distance,0,24);
 const hill=(p.y||0)*Math.exp(-p.distance*p.distance/6200);
 return -3.1+shelf*(3.05+hill);
}

export function createCoastalDistrict(scene,track,{low=false,map}={}){
 if(track.id!=='san-francisco-hills')return null;
 const xs=track.samples.map(p=>p.x),zs=track.samples.map(p=>p.z),minX=Math.min(...xs)-120,maxX=Math.max(...xs)+120,minZ=Math.min(...zs)-120,maxZ=Math.max(...zs)+120;
 const step=low?18:12,nx=Math.ceil((maxX-minX)/step),nz=Math.ceil((maxZ-minZ)/step),dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz,vertices=[];
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=minX+i*dx,z=minZ+j*dz;vertices.push({x,z,y:coastalDistrictHeight(track,x,z)});}
 // Limit every cell's four shared vertices below every road sample that can
 // cross it. This prevents interpolated terrain from breaking through lanes.
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const x=minX+(i+.5)*dx,z=minZ+(j+.5)*dz,r=Math.hypot(dx,dz)/2+track.width/2+track.length/440;
  let cap=Infinity;for(const p of track.samples)if(Math.hypot(p.x-x,p.z-z)<r)cap=Math.min(cap,p.y-.30);
  if(Number.isFinite(cap))for(const k of [j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i,(j+1)*(nx+1)+i+1])vertices[k].y=Math.min(vertices[k].y,cap);
 }
 const positions=[],uv=[],colors=[],indices=[],tint=new THREE.Color();
 for(const p of vertices){positions.push(p.x,p.y,p.z);uv.push(p.x/90,p.z/90);const v=.87+.08*Math.sin(p.x*.023)*Math.cos(p.z*.029);tint.set('#a2b392').multiplyScalar(v);colors.push(tint.r,tint.g,tint.b);}
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const group=new THREE.Group();group.name='continuous-coastal-district';const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:map||null,color:'white',vertexColors:true,roughness:1}));mesh.receiveShadow=true;group.add(mesh);scene.add(group);
 group.userData={triangles:indices.length/3,drawCalls:1,grid:{nx,nz,minX,minZ,dx,dz},vertices};return group;
}

// Match the actual two triangles in the rendered terrain cell, so tree roots
// and foundation tops never use the higher analytic surface after road cuts.
export function coastalGroundAt(district,x,z){
 const {grid,vertices}=district.userData,{nx,nz,minX,minZ,dx,dz}=grid;
 const gx=THREE.MathUtils.clamp((x-minX)/dx,0,nx-.00001),gz=THREE.MathUtils.clamp((z-minZ)/dz,0,nz-.00001),i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j,a=j*(nx+1)+i;
 return u+v<=1?vertices[a].y*(1-u-v)+vertices[a+1].y*u+vertices[a+nx+1].y*v:vertices[a+nx+2].y*(u+v-1)+vertices[a+nx+1].y*(1-u)+vertices[a+1].y*(1-v);
}

// Paved lots and their short pedestrian links are footprint-tested, rather
// than sprinkling boxes directly onto a continuous empty ground plane.
export function districtParcelLayout(track,buildings,{low=false}={}){
 const sites=[],limit=low?30:46;
 const sorted=buildings.filter(b=>b.y-b.sy/2<.6).map(b=>({...b,roadDistance:projectOnTrack(b.x,b.z,undefined,track).distance})).sort((a,b)=>a.roadDistance-b.roadDistance);
 for(const b of sorted){
  if(sites.length>=limit)break;
  const sx=b.sx+12,sz=b.sz+14,radius=Math.hypot(sx,sz)/2;
  if(b.parcelFootprint?b.parcelFootprint.some(p=>projectOnTrack(p.x,p.z,undefined,track).distance<track.width/2+2.5):b.roadDistance<track.width/2+radius+2)continue;
  if(sites.some(s=>Math.hypot(b.x-s.x,b.z-s.z)<Math.min(radius,s.radius)*.65))continue;
  sites.push({x:b.x,z:b.z,y:Math.max(-.14,b.y-b.sy/2+.01),sx,sz,sy:.22,ry:b.ry||0,radius,role:'parcel',building:b});
 }
 const links=[],used=new Set();
 const safeLink=site=>{
  const footprint=[],count=Math.ceil(site.sz/2),c=Math.cos(site.ry),s=Math.sin(site.ry);
  for(let k=0;k<=count;k++)for(const side of [-1,1]){const along=-site.sz/2+site.sz*k/count;footprint.push({x:site.x+s*along+c*side*site.sx/2,z:site.z+c*along-s*side*site.sx/2});}
  if(footprint.some(p=>projectOnTrack(p.x,p.z,undefined,track).distance<track.width/2+2))return false;
  links.push({...site,footprint});return true;
 };
 for(const [i,a]of sites.entries()){
  // Each frontage reaches the continuous sidewalk, not only its neighbours.
  const nearest=projectOnTrack(a.x,a.z,undefined,track),road=sampleTrack(nearest.s,track),vx=a.x-road.x,vz=a.z-road.z,dist=Math.hypot(vx,vz),edge=track.width/2+5.5;
  if(dist>edge&&Math.abs(road.y-a.y)<.5){const bx=road.x+vx/dist*edge,bz=road.z+vz/dist*edge;safeLink({x:(a.x+bx)/2,z:(a.z+bz)/2,y:a.y-.04,sx:3.6,sz:dist-edge,sy:.14,ry:Math.atan2(a.x-bx,a.z-bz),role:'link',sidewalk:true});}
  const candidates=sites.map((b,j)=>({b,j,d:Math.hypot(a.x-b.x,a.z-b.z)})).filter(e=>e.j!==i&&e.d<100).sort((a,b)=>a.d-b.d);
  for(const {b,j,d}of candidates.slice(0,2)){
   const key=[i,j].sort((a,b)=>a-b).join(':');if(used.has(key)||Math.abs(a.y-b.y)>.4)continue;used.add(key);
   const ry=Math.atan2(b.x-a.x,b.z-a.z),site={x:(a.x+b.x)/2,z:(a.z+b.z)/2,y:Math.min(a.y,b.y)-.04,sx:3.6,sz:d,sy:.14,ry,radius:d/2,role:'link'};
   if(safeLink(site))break;
  }
 }
 return {sites,links};
}

export function createDistrictParcels(scene,track,buildings,{low=false,surfaces={},water=false}={}){
 const plan=districtParcelLayout(track,buildings,{low}),group=new THREE.Group();group.name='connected-city-parcels';scene.add(group);
 const lists={paving:[],soil:[],curb:[]},box=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
 const add=(kind,site,x,y,z,w,h,d)=>{const c=Math.cos(site.ry),s=Math.sin(site.ry);dummy.position.set(site.x+c*x+s*z,site.y+y,site.z-s*x+c*z);dummy.rotation.set(0,site.ry,0);dummy.scale.set(w,h,d);dummy.updateMatrix();lists[kind].push(box.clone().applyMatrix4(dummy.matrix));};
 for(const site of [...plan.sites,...plan.links]){
  add('paving',site,0,-.12,0,site.sx,.24,site.sz);
  if(water)add('curb',site,0,-1.6,0,site.sx,3,site.sz);
  if(site.role==='link')continue;
  const w=site.sx/2,d=site.sz/2;
  // Borders define a real parcel, with planted strips around two edges and an
  // open paved forecourt; doors face connected pedestrian surfaces.
  for(const side of [-1,1]){
   add('curb',site,side*(w-.19),.17,0,.38,.34,site.sz);
   add('curb',site,0,.17,side*(d-.19),site.sx,.34,.38);
   add('soil',site,side*(w-1.25),.20,0,1.65,.20,site.sz-1.4);
   for(let j=0;j<5;j++)add('soil',site,side*(w-1.25),.43,-d+2+j*(site.sz-4)/4,1.25,.40,1.25);
  }
 }
 box.dispose();let triangles=0;
 const materials={paving:pavingSurfaceMaterial(surfaces,{color:'#d0cec3'}),soil:new THREE.MeshStandardMaterial({color:'#354b32',roughness:1,map:surfaces.terrainColor||null}),curb:new THREE.MeshStandardMaterial({color:'#b5b9ac',roughness:.9})};
 for(const [kind,parts]of Object.entries(lists)){if(!parts.length){materials[kind].dispose();continue;}const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());setWorldSurfaceUV(geometry,kind==='paving'?2.12:90);const mesh=new THREE.Mesh(geometry,materials[kind]);mesh.receiveShadow=true;mesh.userData.distanceDetail={distance:600};group.add(mesh);triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;}
 group.userData={...plan,triangles,drawCalls:group.children.length};return group;
}

export function vergeCells(track,venue,{low=false}={}){
 const cells=[],step=low?18:12;
 for(let s=0;s<track.length;s+=step){const a=sampleTrack(s,track),b=sampleTrack(Math.min(track.length,s+step),track);if(Math.max(a.y,b.y)>2.0)continue;
  for(const side of [-1,1]){
   const outer=venue.environment==='urban'?15:venue.water?30:23,near=track.width/2+5.36;
   const points=[a,b].flatMap(p=>[near,track.width/2+outer].map((offset,i)=>({x:p.x+p.nx*side*offset,y:i?-.16:p.y-.065,z:p.z+p.nz*side*offset})));
   const footprint=[];for(let u=0;u<=4;u++)for(let v=0;v<=4;v++){const t=u/4,w=v/4;footprint.push({x:(1-t)*((1-w)*points[0].x+w*points[1].x)+t*((1-w)*points[2].x+w*points[3].x),z:(1-t)*((1-w)*points[0].z+w*points[1].z)+t*((1-w)*points[2].z+w*points[3].z)});}
   if(footprint.some(p=>projectOnTrack(p.x,p.z,undefined,track).distance<track.width/2+3.4))continue;
   cells.push({points,side,s,footprint});
  }
 }
 return cells;
}

export function createRoadVerge(scene,track,venue,{low=false,surfaces={}}={}){
 const cells=vergeCells(track,venue,{low}),positions=[],uv=[],indices=[];
 for(const {points,side}of cells){const k=positions.length/3;for(const p of points){positions.push(p.x,p.y,p.z);uv.push(p.x/90,p.z/90);}indices.push(...(side===1?[k,k+2,k+1,k+1,k+2,k+3]:[k,k+1,k+2,k+1,k+3,k+2]));
  // Shore shelves have an actual submerged edge, never a paper-thin slab.
  if(venue.water){const n=positions.length/3;for(const p of [points[1],points[3]]){positions.push(p.x,-3.1,p.z);uv.push(p.x/90,p.z/90);}indices.push(k+1,k+3,n,k+3,n+1,n);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({map:surfaces.terrainColor||null,color:venue.environment==='desert'?'#cec1a0':venue.environment==='urban'?'#81946f':'#a5b38f',roughness:1,side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(g,material);mesh.name='continuous-roadside-verge';mesh.receiveShadow=true;scene.add(mesh);mesh.userData={cells,triangles:indices.length/3,drawCalls:1};return mesh;
}

// Rolling inland ground is one shared surface. Flat pads around structures
// blend into the landscape, avoiding isolated circular mounds on a flat floor.
export function createInlandRelief(scene,track,venue,{low=false,occupied=[],map}={}){
 const xs=track.samples.map(p=>p.x),zs=track.samples.map(p=>p.z),minX=Math.min(...xs)-150,maxX=Math.max(...xs)+150,minZ=Math.min(...zs)-150,maxZ=Math.max(...zs)+150;
 const area=(maxX-minX)*(maxZ-minZ),step=Math.max(low?18:12,Math.sqrt(area/(low?2450:6400))),nx=Math.ceil((maxX-minX)/step),nz=Math.ceil((maxZ-minZ)/step),dx=(maxX-minX)/nx,dz=(maxZ-minZ)/nz,guard=Math.hypot(dx,dz),positions=[],uv=[],colors=[],indices=[],tint=new THREE.Color();
 // Trees are grounded from this mesh after construction. Flattening a broad
 // pad around every trunk had erased the hills across entire planted sectors.
 const pads=occupied.filter(o=>o.kind!=='tree');
 const hill=(x,z)=>{
  const ridge=.5+.5*Math.sin(x*.012+z*.006+.38*Math.sin(z*.018));
  const drainage=Math.pow(.5+.5*Math.sin(z*.031-x*.013),4);
  return (track.id==='fuji-skyline'?28:11)*(.24+.54*ridge+.13*Math.cos(z*.021-x*.006)-.10*drainage);
 };
 const vertices=[];
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  const x=minX+i*dx,z=minZ+j*dz,p=projectOnTrack(x,z,undefined,track);
  let amount=THREE.MathUtils.smoothstep(p.distance-track.width/2-guard*.65,0,62);
  for(const o of pads)amount=Math.min(amount,THREE.MathUtils.smoothstep(Math.hypot(x-o.x,z-o.z)-(o.radius||12)-guard*.6,0,18));
  const height=hill(x,z)*amount;
  vertices.push({x,z,y:-.22+height});
 }
 // Shared vertex caps cover the whole raster cell, including between sample
 // points, so grade changes can never expose ground through the road mesh.
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const x=minX+(i+.5)*dx,z=minZ+(j+.5)*dz,r=guard/2+track.width/2+track.length/440;let cap=Infinity;
  for(const p of track.samples)if(Math.hypot(p.x-x,p.z-z)<r)cap=Math.min(cap,p.y-.30);
  if(Number.isFinite(cap))for(const k of [j*(nx+1)+i,j*(nx+1)+i+1,(j+1)*(nx+1)+i,(j+1)*(nx+1)+i+1])vertices[k].y=Math.min(vertices[k].y,cap);
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
 const grid={nx,nz,minX,minZ,dx,dz},outskirts=appendTerrainOutskirts(vertices,indices,grid,hill);
 for(const p of vertices){positions.push(p.x,p.y,p.z);uv.push(p.x/90,p.z/90);tint.set('#b5c3a3').multiplyScalar(.86+.08*Math.sin(p.x*.019)*Math.cos(p.z*.025));colors.push(tint.r,tint.g,tint.b);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
 const group=new THREE.Group();group.name='continuous-inland-relief';const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:map||null,color:'white',vertexColors:true,roughness:1}));mesh.receiveShadow=true;group.add(mesh);scene.add(group);
 group.userData={triangles:indices.length/3,drawCalls:1,grid,vertices,continuous:true,outskirts,fixedPads:pads.length};return group;
}
