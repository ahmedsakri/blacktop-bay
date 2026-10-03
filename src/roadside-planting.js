import * as THREE from 'three';
import {sampleTrack,projectOnTrack} from './track.js';

export const PLANTING_BUDGET=Object.freeze({mobile:384,desktop:720,trianglesPerTuft:24,mobileDistance:88,desktopDistance:125});
const noise=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};

// A loose woodland margin grows on continuous rendered terrain rather than
// isolated scenery pads. These candidates use the shared reduced scan tiers;
// they add no procedural fallback population or individual material draws.
export function forestMarginLayout(track,venue,{low=false,occupied=[],groundAt}={}){
 const trees=[];if(!(venue.environment==='parkland'&&venue.vegetation!=='conifers'||track.id==='san-francisco-hills'))return trees;
 const safe=p=>projectOnTrack(p.x,p.z,undefined,track).distance>=track.width/2+p.radius+8&&!occupied.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<p.radius+(o.radius||12)+2)&&!trees.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<p.radius+o.radius+2);
 // Replace the old separate pink Fuji cards with taller ordinary trees beside
 // the road; they now participate in the same near/far scan selection.
 if(track.id==='fuji-skyline')for(let i=0;i<(low?42:70);i++){const p=sampleTrack(track.length*i/(low?42:70),track),side=i%2?1:-1,t={x:p.x+p.nx*side*(track.width/2+13),z:p.z+p.nz*side*(track.width/2+13),y:0,height:8+(i%4)*.65,radius:2.8,yaw:i*2.399};if(p.y<8&&safe(t))trees.push(t);}
 const max=low?140:220;
 for(let i=0;i<max*4&&trees.length<max;i++){
  const fraction=(i*.61803398875+.12)%1,p=sampleTrack(track.length*fraction,track),side=i%2?1:-1;
  if(track.id==='san-francisco-hills'&&fraction>.225&&fraction<.345)continue;
  const radius=3.3+noise(i+6)*2.4,offset=track.width/2+21+noise(i+4)*100;
  const x=p.x+p.nx*offset*side,z=p.z+p.nz*offset*side,y=groundAt?groundAt(x,z):0;
  if(y<-.56)continue;
  const t={x,y,z,radius,height:10+noise(i+88)*10,yaw:noise(i+9)*Math.PI*2};if(safe(t))trees.push(t);
 }
 return trees.map((p,i)=>({...p,treeId:10000+i}));
}

export function vergeGroundSampler(verge,fallback=()=>-.16){
 const cells=(verge?.userData.cells||[]).map(({points})=>({points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))}));
 const triangle=(x,z,a,b,c)=>{const d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(d)<1e-8)return null;
  const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d;
  return u>=-1e-6&&v>=-1e-6&&u+v<=1.000001?u*a.y+v*b.y+(1-u-v)*c.y:null;
 };
 return (x,z)=>{let y=fallback(x,z);for(const cell of cells){if(x<cell.minX||x>cell.maxX||z<cell.minZ||z>cell.maxZ)continue;const p=cell.points;
  for(const [a,b,c]of [[p[0],p[2],p[1]],[p[1],p[2],p[3]]]){const h=triangle(x,z,a,b,c);if(h!==null)y=Math.max(y,h);}
 }return y;};
}

// Small curved blades supply real parallax at road level. No alpha overdraw,
// texture allocation, animated vertices or additional shadow pass is needed.
export function grassTuftGeometry(){
 const positions=[],colors=[],tint=new THREE.Color();
 for(let i=0;i<8;i++){
  const a=i*2.39996,h=.32+noise(i)*.38,w=.026+noise(i+31)*.024,lean=.13+noise(i+11)*.22;
  const c=Math.cos(a),s=Math.sin(a),x=c*noise(i+3)*.18,z=s*noise(i+8)*.18;
  const left=[x-s*w,0,z+c*w],right=[x+s*w,0,z-c*w],midL=[x+c*lean*.25-s*w*.67,h*.55,z+s*lean*.25+c*w*.67],midR=[x+c*lean*.25+s*w*.67,h*.55,z+s*lean*.25-c*w*.67],tip=[x+c*lean,h,z+s*lean];
  for(const p of [left,right,midL,right,midR,midL,midL,midR,tip]){positions.push(...p);tint.set('#65774a').multiplyScalar(.63+.36*p[1]/h+.08*noise(i+21));colors.push(tint.r,tint.g,tint.b);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}

// Plant only on authored roadside land. Sampling inside the ruled verge
// surface (or supplied coastal terrain triangles) keeps roots in the ground.
export function roadsidePlantingLayout(track,venue,{occupied=[],groundAt}={}){
 const sites=[];if(venue.environment==='desert'||track.scenery==='breakwater')return sites;
 const spacing=Math.max(2.6,track.length/1400);
 for(let i=0;i<Math.ceil(track.length/spacing);i++){
  const s=Math.min(track.length-.01,(i+.3)*spacing),p=sampleTrack(s,track);
  if(!groundAt&&(p.y||0)>1.5)continue;
  if(track.id==='san-francisco-hills'&&s/track.length>.225&&s/track.length<.345)continue;
  for(const side of [-1,1])for(let n=0;n<3;n++){
   const seed=i*13+n*3+(side+1),spread=venue.environment==='urban'?6.5:10,offset=track.width/2+6.3+n*spread/3+noise(seed)*1.3;
   const along=(noise(seed+71)-.5)*2.2,x=p.x+p.nx*side*offset+p.tx*along,z=p.z+p.nz*side*offset+p.tz*along;
   const radius=.56,nearest=projectOnTrack(x,z,undefined,track);
   if(nearest.distance<track.width/2+5.65+radius)continue;
   if(occupied.some(o=>Math.hypot(x-o.x,z-o.z)<(o.radius||12)+radius+.6))continue;
   const road=sampleTrack(nearest.s,track),outer=venue.environment==='urban'?15:venue.water?30:23,blend=THREE.MathUtils.clamp((nearest.distance-track.width/2-5.36)/(outer-5.36),0,1);
   const y=groundAt?groundAt(x,z):THREE.MathUtils.lerp(road.y-.065,-.16,blend);
   if(y<-.56)continue;
   sites.push({x,y:y-.025,z,radius,height:.64+noise(seed+55)*.42,yaw:noise(seed+2)*Math.PI*2,shade:.8+noise(seed+7)*.35});
  }
 }
 return sites;
}

export function createRoadsidePlanting(scene,track,venue,{low=false,occupied=[],groundAt}={}){
 const candidates=roadsidePlantingLayout(track,venue,{occupied,groundAt}),capacity=low?PLANTING_BUDGET.mobile:PLANTING_BUDGET.desktop,distance=low?PLANTING_BUDGET.mobileDistance:PLANTING_BUDGET.desktopDistance;
 const mesh=new THREE.InstancedMesh(grassTuftGeometry(),new THREE.MeshStandardMaterial({color:'white',vertexColors:true,roughness:1,side:THREE.DoubleSide}),capacity),dummy=new THREE.Object3D(),color=new THREE.Color();
 mesh.name='near-roadside-understorey';mesh.count=0;mesh.visible=false;mesh.receiveShadow=true;scene.add(mesh);
 const status={candidates:candidates.length,capacity,visible:0,draws:1,triangles:0};let next=0,disposed=false;
 return {mesh,status,candidates,update(time,position){
  if(disposed||!position||time<next)return;next=time+.32;
  const selected=candidates.map(p=>({p,d:(p.x-position.x)**2+(p.z-position.z)**2})).filter(e=>e.d<distance*distance).sort((a,b)=>a.d-b.d).slice(0,capacity);
  selected.forEach(({p},i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(1,p.height,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.setScalar(p.shade));});
  mesh.count=selected.length;mesh.visible=selected.length>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();status.visible=mesh.count;status.triangles=mesh.count*PLANTING_BUDGET.trianglesPerTuft;
 },dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();status.visible=0;}};
}
