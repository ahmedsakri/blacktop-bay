import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {sampleTrack,projectOnTrack} from './track.js';

// A complete block, not each house, owns the checked parcel. The front is
// oriented towards the road and its three units share party walls and paving.
export function urbanBlockLayout(track,venue,{low=false,occupied=[]}={}){
 const blocks=[],units=[];if(venue.environment!=='urban')return {blocks,units};
 const count=low?34:48;
 for(let i=0;i<count;i++)for(const delta of [0,.008,-.008]){
  const s=track.length*((.035+i*.93/count+delta)%1),p=sampleTrack(s,track),side=i%2?1:-1;
  const width=26.4,depth=11.2,radius=Math.hypot(width+12,depth+14)/2,offset=track.width/2+(depth+14)/2+4;
  const x=p.x+p.nx*side*offset,z=p.z+p.nz*side*offset,nearest=projectOnTrack(x,z,undefined,track);
  const road=sampleTrack(nearest.s,track),ry=Math.atan2(road.x-x,road.z-z);
  const footprint=[];for(let a=0;a<=20;a++)for(let b=0;b<=14;b++){const xx=(a/20-.5)*(width+12),zz=(b/14-.5)*(depth+14);footprint.push({x:x+Math.cos(ry)*xx+Math.sin(ry)*zz,z:z-Math.sin(ry)*xx+Math.cos(ry)*zz});}
  if(footprint.some(p=>projectOnTrack(p.x,p.z,undefined,track).distance<track.width/2+2.5))continue;
  if([...occupied,...blocks].some(o=>Math.hypot(x-o.x,z-o.z)<radius+(o.radius||12)+2))continue;
  const height=Math.ceil((road.y+10)/3.3)*3.3+(i%3)*3.3,block={x,z,y:height/2-.10,sx:width,sy:height,sz:depth,ry,radius,blockId:i,street:true,roadY:road.y,parcelFootprint:footprint};blocks.push(block);
  for(let j=-1;j<=1;j++){
   const h=height+(j===1?3.3:0),along=j*8.8;
   units.push({x:x+Math.cos(ry)*along,z:z-Math.sin(ry)*along,y:h/2-.10,sx:8.78,sy:h,sz:depth,ry,radius:Math.hypot(8.78,depth)/2,blockId:i,centerUnit:j===0,frontageTint:['#cec9b7','#bdc8bd','#c5b6a7','#b2bfc3'][(i+j+5)%4],street:true});
  }
  break;
 }
 return {blocks,units};
}

// Roof rims, projecting continuous floor ledges and ground-level colonnades
// give all three units depth, including the two shader-detailed neighbours.
export function createUrbanBlockEdges(scene,units){
 const parts=[],box=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
 const add=(b,x,y,z,w,h,d)=>{const c=Math.cos(b.ry),s=Math.sin(b.ry);dummy.position.set(b.x+c*x+s*z,y,b.z-s*x+c*z);dummy.rotation.set(0,b.ry,0);dummy.scale.set(w,h,d);dummy.updateMatrix();parts.push(box.clone().applyMatrix4(dummy.matrix));};
 for(const b of units){
  for(let y=3.2;y<b.sy+.1;y+=3.3)add(b,0,y,b.sz/2+.18,b.sx,.24,.50);
  add(b,0,b.sy+.15,0,b.sx+.24,.42,b.sz+.24);
  for(const side of [-1,1])add(b,side*(b.sx/2-.2),1.65,b.sz/2+.42,.4,3.5,.8);
  add(b,0,.02,b.sz/2+.75,b.sx,.22,1.9);
 }
 box.dispose();const group=new THREE.Group();group.name='connected-urban-street-blocks';scene.add(group);
 if(parts.length){const g=mergeGeometries(parts);parts.forEach(g=>g.dispose());const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:'#c3c2b4',roughness:.86}));mesh.receiveShadow=true;mesh.userData.distanceDetail={distance:520};group.add(mesh);}
 group.userData={units:units.length,triangles:parts.length*12,draws:group.children.length};return group;
}
