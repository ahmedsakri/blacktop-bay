import * as THREE from 'three';

// Broken bedding planes and drainage cuts stay inside each legacy boulder's
// unit footprint. The skirt is buried below its former center; there is no
// separate cap or intersecting pile of scaled primitives.
const RINGS=[0,.18,.33,.39,.58,.65,.83,1];
const HEIGHTS=[.47,.43,.29,.14,-.03,-.24,-.53,-.92];

// A face uses one world-space projection. Splitting only where the projection
// changes retains smooth lighting without interpolating unrelated UV planes
// across a triangle. The same photographed surface repeats every 20 metres.
function projectFaces(source,ranges){
 const positions=[],normals=[],colors=[],uv=[],indices=[],projectedRanges=[];
 const p=source.attributes.position,n=source.attributes.normal,c=source.attributes.color,index=source.index;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3();
 for(const range of ranges){
  const start=positions.length/3,shared=new Map();
  for(let i=range.indexStart;i<range.indexStart+range.indexCount;i+=3){
   a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1)).sub(a);d.fromBufferAttribute(p,index.getX(i+2)).sub(a);b.cross(d);
   const x=Math.abs(b.x),y=Math.abs(b.y),z=Math.abs(b.z),axis=y>=x&&y>=z?1:x>=z?0:2;
   for(let corner=0;corner<3;corner++){
    const old=index.getX(i+corner),key=old*3+axis;
    if(!shared.has(key)){
     shared.set(key,positions.length/3);positions.push(p.getX(old),p.getY(old),p.getZ(old));normals.push(n.getX(old),n.getY(old),n.getZ(old));colors.push(c.getX(old),c.getY(old),c.getZ(old));
     uv.push((axis===0?p.getZ(old):p.getX(old))/20,(axis===1?p.getZ(old):p.getY(old))/20);
    }
    indices.push(shared.get(key));
   }
  }
  projectedRanges.push({start,count:positions.length/3-start});
 }
 const geometry=new THREE.BufferGeometry();
 for(const [name,array,size]of [['position',positions,3],['normal',normals,3],['color',colors,3],['uv',uv,2]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(array,size));
 geometry.setIndex(indices);source.dispose();return {geometry,ranges:projectedRanges};
}

export function summitOutcropGeometry(placements,{low=false}={}){
 const sectors=low?16:24,positions=[],indices=[],ranges=[];
 for(const [index,p]of placements.entries()){
  const phase=index*2.399963,offset=positions.length/3,cos=Math.cos(p.ry||0),sin=Math.sin(p.ry||0);
  const rootX=.10*Math.cos(phase),rootZ=.10*Math.sin(phase),start=offset,indexStart=indices.length;
  const push=(x,y,z)=>positions.push(p.x+cos*x*p.sx+sin*z*p.sz,p.y+y*p.sy,p.z-sin*x*p.sx+cos*z*p.sz);
  push(rootX,HEIGHTS[0],rootZ);
  for(let ring=1;ring<RINGS.length;ring++)for(let sector=0;sector<sectors;sector++){
   const r=RINGS[ring],a=sector/sectors*Math.PI*2;
   // Angular shoulders break the circular silhouette; offset inner ridges
   // taper into the same safe enclosing ellipse used by the original rock.
   const outline=.82+.10*Math.sin(a*3+phase)+.045*Math.cos(a*7-phase*.7);
   const x=rootX*(1-r)+Math.cos(a)*r*outline,z=rootZ*(1-r)+Math.sin(a)*r*outline;
   const broken=.12*Math.sin(a*2+phase)+.055*Math.sin(a*5-phase);
   const gully=Math.pow(.5+.5*Math.sin(a*6+phase+r*1.8),5);
   const y=HEIGHTS[ring]+Math.sin(Math.PI*r)*(broken-.14*gully+.12*x-.08*z);
   push(x,y,z);
   const current=offset+1+(ring-1)*sectors+sector,next=offset+1+(ring-1)*sectors+(sector+1)%sectors;
   if(ring===1)indices.push(offset,next,current);
   else{const previous=current-sectors,previousNext=next-sectors;indices.push(previous,previousNext,current,previousNext,next,current);}
  }
  ranges.push({start,count:positions.length/3-start,indexStart,indexCount:indices.length-indexStart});
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const point=geometry.attributes.position,normal=geometry.attributes.normal,colors=[],stone=new THREE.Color('#c0b59f'),earth=new THREE.Color('#8d9274'),tint=new THREE.Color();
 for(let i=0;i<point.count;i++){
  const y=point.getY(i),x=point.getX(i),z=point.getZ(i);
  const bed=.86+.09*Math.sin(y*1.17+x*.025+z*.019)+.035*Math.sin(y*3.3+z*.04);
  const weathering=THREE.MathUtils.smoothstep(normal.getY(i),.70,.96)*.30;
  tint.copy(stone).lerp(earth,weathering).multiplyScalar(bed);colors.push(tint.r,tint.g,tint.b);
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const projected=projectFaces(geometry,ranges),result=projected.geometry;result.computeBoundingBox();result.computeBoundingSphere();
 result.userData={outcrops:placements.length,sectors,rings:RINGS.length,triangles:indices.length/3,ranges:projected.ranges,maximumLocalRadius:1,maximumLocalHeight:.65};return result;
}

export function createSummitOutcrops(scene,placements,{low=false,maps={}}={}){
 const geometry=summitOutcropGeometry(placements,{low});
 const material=new THREE.MeshStandardMaterial({color:'white',vertexColors:true,map:maps.rockColor||null,normalMap:maps.rockNormal||null,normalScale:new THREE.Vector2(.45,.45),roughness:1,metalness:0,envMapIntensity:.12});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='summit-stratified-outcrops';mesh.receiveShadow=true;mesh.castShadow=false;scene.add(mesh);
 scene.userData.summitOutcrops={outcrops:placements.length,triangles:geometry.userData.triangles,drawCalls:placements.length?1:0};return mesh;
}
