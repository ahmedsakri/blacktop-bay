import * as THREE from 'three';

// Authored crown silhouettes replace the single ball/cone primitives. Shared
// geometry keeps every tree in the existing instanced foliage batch.
export function broadleafCrownGeometry({low=false}={}) {
 // Photographed leaf sprays leave real openings through the canopy.
 // Mobile retains the old 340-triangle crown budget; full detail is cheaper
 // than the former 27 opaque icosahedron clumps. Cutouts use alpha testing.
 const count=low?85:400,positions=[],colours=[],uv=[],transform=new THREE.Object3D(),v=new THREE.Vector3(),colour=new THREE.Color();
 for(let i=0;i<count;i++){
  const a=i*2.399963,t=(i+.5)/count,y=.92-t*1.74;
  const radial=Math.sqrt(Math.max(.04,1-y*y))*(.50+.44*((i*37%101)/100));
  transform.position.set(Math.cos(a)*radial,y,Math.sin(a)*radial);
  transform.rotation.set(Math.sin(i*1.73)*1.1,a,Math.cos(i*1.29)*.7);
  const size=(low?.23:.15)*(1+(i%5)*.075);transform.scale.set(size,size,size);transform.updateMatrix();
  // Four triangles form one shallow curved spray, with the licensed cutout.
  const leaf=[[0,.11,0],[-1,0,-1],[-1,0,1],[1,0,1],[1,0,-1]],coords=[[.5,.5],[0,0],[0,1],[1,1],[1,0]];
  const lift=.69+(.5+y*.3)*.22+(i%4)*.025;colour.setRGB(lift*.94,lift,lift*.85);
  for(const n of [0,1,2,0,2,3,0,3,4,0,4,1]){v.fromArray(leaf[n]).applyMatrix4(transform.matrix);positions.push(v.x,v.y,v.z);uv.push(...coords[n]);colours.push(colour.r,colour.g,colour.b);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
 const p=geometry.attributes.position;let widest=0;for(let i=0;i<p.count;i++)widest=Math.max(widest,Math.hypot(p.getX(i),p.getZ(i)));
 geometry.scale(1/widest,1,1/widest);geometry.computeBoundingSphere();geometry.userData.leafSprays=count;return geometry;
}

export function coniferBoughGeometry({low=false}={}) {
 const spokes=low?11:17,levels=low?6:9,positions=[],colours=[],indices=[],colour=new THREE.Color();
 for(let row=0;row<=levels;row++)for(let col=0;col<=spokes;col++){
  const t=row/levels,angle=col/spokes*Math.PI*2;
  const bough=(.5+.5*Math.cos(angle*5+row*.91)),r=(1-t)*(.70+.30*bough);
  const y=-.5+t-(1-t)*.095*bough;
  positions.push(Math.cos(angle)*r,y,Math.sin(angle)*r);
  const value=.67+t*.28+bough*.055;colour.setRGB(value*.91,value,value*.92);colours.push(colour.r,colour.g,colour.b);
  if(row<levels&&col<spokes){const a=row*(spokes+1)+col,b=a+spokes+1;indices.push(a,b,a+1,b,b+1,a+1);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
