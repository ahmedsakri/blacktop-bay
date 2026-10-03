import * as THREE from 'three';

// An authored volcanic landform: drainage grooves bend down asymmetric slopes,
// with a shallow summit hollow. All rings share vertices and smooth normals;
// there is no separate intersecting cone or floating snow-cap mesh.
export function erodedMountainGeometry({low=false}={}) {
 const sectors=low?64:96,rings=low?16:24,positions=[80,286,-1120],uv=[80/90,-1120/90],colors=[],indices=[],tint=new THREE.Color('#dddcd0');
 colors.push(tint.r,tint.g,tint.b);
 for(let ring=1;ring<=rings;ring++)for(let sector=0;sector<sectors;sector++){
  const r=ring/rings,a=sector/sectors*Math.PI*2;
  const radius=650*r*(1+.065*Math.sin(a*3+.3)+.028*Math.cos(a*7));
  const x=80+Math.cos(a)*radius,z=-1120+Math.sin(a)*radius;
  const drainage=Math.pow(.5+.5*Math.sin(a*13+r*2.8+.6*Math.sin(a*4)),5);
  const shoulder=Math.sin(Math.PI*r),ridge=.52+.48*Math.sin(a*5-r*1.5);
  const y=-.38+310*Math.pow(1-r,1.52)-shoulder*(drainage*28+ridge*10)-16*Math.exp(-r*r/.004);
  positions.push(x,y,z);uv.push(x/90,z/90);
  const snow=THREE.MathUtils.smoothstep(y+drainage*15+5*Math.sin(a*3),194,258);
  tint.set('#889387').lerp(new THREE.Color('#efefe6'),snow).multiplyScalar(.88+.12*ridge);
  colors.push(tint.r,tint.g,tint.b);
  const current=1+(ring-1)*sectors+sector,next=1+(ring-1)*sectors+(sector+1)%sectors;
  if(ring===1)indices.push(0,next,current);
  else {const previous=current-sectors,previousNext=next-sectors;indices.push(previous,previousNext,current,previousNext,next,current);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 geometry.userData={sectors,rings,triangles:indices.length/3,center:[80,-1120],radius:711,singleSurface:true};return geometry;
}

// Continue the exact boundary vertices of the local terrain through four broad
// irregular ridges. This replaces the rectangular return to a flat ground disk.
export function appendTerrainOutskirts(vertices,indices,{nx,nz,minX,minZ,dx,dz},heightAt){
 const boundary=[];
 for(let i=0;i<nx;i++)boundary.push(i);
 for(let j=0;j<nz;j++)boundary.push(j*(nx+1)+nx);
 for(let i=nx;i>0;i--)boundary.push(nz*(nx+1)+i);
 for(let j=nz;j>0;j--)boundary.push(j*(nx+1));
 const centerX=minX+nx*dx/2,centerZ=minZ+nz*dz/2,base=boundary.map(index=>vertices[index]);
 let previous=boundary;
 for(const reach of [90,210,370,550]){
  const ring=[];
  for(const p of base){const vx=p.x-centerX,vz=p.z-centerZ,d=Math.hypot(vx,vz),x=p.x+vx/d*reach,z=p.z+vz/d*reach;
   const taper=1-THREE.MathUtils.smoothstep(reach,320,550),y=-.3+heightAt(x,z)*taper;
   ring.push(vertices.length);vertices.push({x,y,z});
  }
  for(let i=0;i<ring.length;i++){const next=(i+1)%ring.length;indices.push(previous[i],previous[next],ring[i],previous[next],ring[next],ring[i]);}
  previous=ring;
 }
 return {rings:4,boundary:boundary.length,triangles:boundary.length*8,outerReach:550};
}
