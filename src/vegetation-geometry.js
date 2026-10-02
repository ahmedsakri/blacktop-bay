import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Authored crown silhouettes replace the single ball/cone primitives. Shared
// geometry keeps every tree in the existing instanced foliage batch.
export function broadleafCrownGeometry({low=false}={}) {
 const pieces=[],transform=new THREE.Object3D(),count=low?17:27;
 for(let i=0;i<count;i++){
  const angle=i*2.399963,level=i/count,y=.68-level*1.26;
  const radius=Math.sqrt(Math.max(.05,1-y*y))*(i%4===0?.46:.74);
  const geometry=new THREE.IcosahedronGeometry(1,low?0:1);
  transform.position.set(Math.cos(angle)*radius,y,Math.sin(angle)*radius);
  transform.rotation.set(i*.21,angle,i*.13);transform.scale.set(.36+(i%3)*.035,.28+(i%4)*.023,.35+(i%2)*.05);transform.updateMatrix();geometry.applyMatrix4(transform.matrix);
  const position=geometry.attributes.position,colours=[],colour=new THREE.Color();
  for(let v=0;v<position.count;v++){
   const lift=THREE.MathUtils.clamp(.77+position.getY(v)*.12+(i%3)*.035,.57,1);
   colour.setRGB(lift*.97,lift,lift*.91);colours.push(colour.r,colour.g,colour.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));pieces.push(geometry);
 }
 const geometry=mergeGeometries(pieces,false);for(const piece of pieces)piece.dispose();
 // Layout uses a conservative circular radius. Keep the richer silhouette
 // inside that existing footprint rather than stealing road clearance.
 const p=geometry.attributes.position;let widest=0;for(let i=0;i<p.count;i++)widest=Math.max(widest,Math.hypot(p.getX(i),p.getZ(i)));
 geometry.scale(1/widest,1,1/widest);geometry.computeBoundingSphere();return geometry;
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
