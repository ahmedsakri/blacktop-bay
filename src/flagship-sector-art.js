import * as THREE from 'three';
import {broadleafCrownGeometry} from './vegetation-geometry.js';

export const FLAGSHIP_TRACKS=Object.freeze(['fuji-skyline','san-francisco-hills','singapore-afterdark']);

// Original, close-range architecture. All components stay inside the existing
// 12.2 m terrace reservation; no track, ramp or collision geometry is authored.
// The caller folds every piece into its existing sector/material batches.
export function addFlagshipSectorArt(track,site,{low,piece,rod,box,cylinder,mats}) {
 if(!FLAGSHIP_TRACKS.includes(track.id))return null;
 const add=(geometry,material,x=0,y=0,z=0,sx=1,sy=1,sz=1,rotation=0)=>piece(site,geometry,material,x,y,z,sx,sy,sz,rotation);
 const beam=(a,b,material=mats.timber,r=.075)=>rod(site,a,b,material,r);
 const block=(mat,x,y,z,w,h,d,rotation=0)=>add(box,mat,x,y,z,w,h,d,rotation);
 const ring=(radius,tube,x,y,z,mat=mats.cream,segments=low?20:32)=>{
  const g=new THREE.TorusGeometry(radius,tube,4,segments);g.rotateX(Math.PI/2);return add(g,mat,x,y,z);
 };
 const roof=(width,depth,height,{material=mats.roof,arched=false}={})=>{
  const nx=low?10:16,nz=low?8:12,p=[],uv=[],ix=[];
  for(let zi=0;zi<=nz;zi++)for(let xi=0;xi<=nx;xi++){
   const u=xi/nx*2-1,v=zi/nz*2-1;
   // Raised ridge with gently lifted corners; not two rectangular roof slabs.
   p.push(u*width/2,height+(arched?1.4*(1-u*u):1.0*(1-Math.abs(v)))+.42*Math.pow(Math.abs(u*v),4),v*depth/2);uv.push(xi/nx,zi/nz);
   if(xi<nx&&zi<nz){const i=zi*(nx+1)+xi;ix.push(i,i+nx+1,i+1,i+1,i+nx+1,i+nx+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();add(g,material);
  // Eave ends and the raised ridge remain real geometry seen from beneath.
  for(const side of [-1,1])beam([-width/2,height+.42,side*depth/2],[width/2,height+.42,side*depth/2],mats.timber,.09);
  beam([-width/2,height+1,0],[width/2,height+1,0],mats.timber,.11);
 };
 const bench=(x,z,width=3)=>{block(track.id==='singapore-afterdark'?mats.steel:mats.timber,x,.72,z,width,.18,.68);for(const sign of [-1,1])block(mats.concrete,x+sign*width*.32,.37,z,.18,.64,.52);};
 const lantern=(x,z,y=2.5)=>{block(mats.timber,x,y/2,z,.14,y,.14);block(mats.cream,x,y+.17,z,.60,.75,.60);block(mats.warm,x,y+.17,z-.311,.40,.49,.025);block(mats.roof,x,y+.63,z,.88,.16,.88);};
 const garden=(x,z)=>{
  block(mats.concrete,x,.27,z,2.6,.45,1.5);block(mats.roof,x,.52,z,2.32,.10,1.22);
  // Sculpted reed-like leaves with actual silhouette rather than a flat card.
  const p=[];for(let i=0;i<(low?7:11);i++){
   const a=i*2.399,r=.20+(i%3)*.16,h=.75+(i%4)*.19,dx=Math.cos(a),dz=Math.sin(a);
   p.push(x+dx*r,.55,z+dz*r,x+dx*(r+.2)-dz*.12,.55+h*.6,z+dz*(r+.2)+dx*.12,x+dx*(r+.5),.55+h,z+dz*(r+.5));
   p.push(x+dx*r,.55,z+dz*r,x+dx*(r+.5),.55+h,z+dz*(r+.5),x+dx*(r+.2)+dz*.12,.55+h*.6,z+dz*(r+.2)-dx*.12);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.length/3*2),2));g.computeVertexNormals();add(g,mats.roof);
 };
 const finishGarden=()=>{
  const fuji=track.id==='fuji-skyline',leaf=mats.red,stem=fuji?mats.timber:mats.steel;
  // Curved planting islands cover the rear corners of the existing platform.
  // Their branches and foliage remain within the reserved terrace footprint.
  for(const [i,x] of [-5.6,5.6].entries()){
   const z=5.7,bed=add(new THREE.CylinderGeometry(1,1,.38,low?10:18),mats.concrete,x,.24,z,1.65,1,1.35);
   add(new THREE.CylinderGeometry(1,1,.06,low?10:18),mats.roof,x,.465,z,1.43,1,1.12);
   const height=fuji?3.7+i*.4:4.3+i*.55;
   add(new THREE.CylinderGeometry(.09,.22,height,low?6:8),stem,x,.50+height/2,z);
   for(let j=0;j<3;j++){
    const a=j*Math.PI*2/3+i*.7,tip=[x+Math.cos(a)*.63,height+.55,z+Math.sin(a)*.63];beam([x,height*.56,z],tip,stem,.075);
   }
   // A fine photographed canopy replaces solid blossom lumps and a handful
   // of oversized tropical blades. The small tree has actual branch openings.
   const canopy=add(broadleafCrownGeometry({clusterCount:low?48:80}),leaf,x,height+.72,z,fuji?1.18:1.27,fuji?.94:1.18,1.10);canopy.rotation.y=i*1.71;
   if(!fuji)for(const side of [-1,1])block(mats.warm,x+side*1.08,.61,z-.70,.32,.045,.10);
   for(let j=0;j<3;j++){const rock=add(new THREE.IcosahedronGeometry(.27,0),mats.concrete,x-.88+j*.34,.63,z-.53,1,.55,.80);rock.rotation.y=j*.7;}
  }
  // A pedestrian path and end benches give the platform human scale while
  // keeping the established spectator row at local z=-5.8 unobstructed.
  for(let i=0;i<9;i++){
   const x=-5.45+i*1.34,z=-4.10+(i%2)*.15;
   const step=add(new THREE.CylinderGeometry(1,1,.065,fuji?7:4),fuji?mats.concrete:mats.roof,x,.06,z,.54,1,fuji?.40:.31);step.rotation.y=fuji?i*.31:Math.PI/4;
  }
  for(const side of [-1,1]){
   bench(side*5.4,2.8,1.7);
   // Low side rails wrap the planting zone, leaving the road-facing access open.
   block(stem,side*7.0,.87,3.9,.065,.065,4.8);
   for(const z of [1.5,3.9,6.3])block(stem,side*7.0,.46,z,.075,.88,.075);
  }
 };
 if(track.id==='fuji-skyline'){
  const names=['cedar-teahouse','ridge-wind-observatory','forest-beacon'];
  if(site.index===0){
   for(const x of [-4.3,4.3])for(const z of [-2.8,2.8]){block(mats.timber,x,2.2,z,.28,4.4,.28);block(mats.concrete,x,.26,z,.66,.5,.66);}
   roof(11.2,8,4.6);for(const x of [-3.6,-1.8,0,1.8,3.6])beam([x,4.52,-3.4],[x,5.45,0],mats.timber,.065);
   // The rear screen opens in the middle; individual slats cast real depth.
   for(let x=-4.1;x<=4.2;x+=low?.62:.42)if(Math.abs(x)>1.25)block(mats.timber,x,2.2,2.85,.10,3.7,.12);
   bench(-2.3,1.55,2.8);bench(2.3,1.55,2.8);lantern(-5.5,-2.8);lantern(5.5,-2.8);
   
  }else if(site.index===1){
   // A timber fan and cantilever roof makes the viaduct approach distinct.
   for(const side of [-1,1]){
    block(mats.timber,side*3.9,3.7,2.2,.38,7.4,.38);
    for(let i=0;i<5;i++)beam([side*3.9,.55,2.2],[side*(-5.6+i*.48),5.7+i*.48,-2.8],mats.timber,.10);
   }
   roof(12,8,6.5,{arched:true,material:mats.cream});
   for(const x of [-3.9,3.9])beam([x,7.2,2.2],[x,5.1,-4],mats.timber,.075);
   for(let i=0;i<5;i++)block(mats.timber,0,.25+i*.1,3.6+i*.55,8-i*.55,.18,.60);
   bench(0,1.4,5.7);lantern(-5.7,-2);
  }else{
   // Octagonal ranger beacon: a ring of timber ribs and double swept roof.
   const g=new THREE.CylinderGeometry(3.15,3.8,.35,8);add(g,mats.timber,0,.40,0);
   for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*2.9,z=Math.sin(a)*2.9;block(mats.timber,x,3,z,.2,5.8,.2);beam([x,5.5,z],[0,7.5,0],mats.timber,.095);}
   add(new THREE.ConeGeometry(4.9,2.4,8,1,true),mats.cream,0,6.5,0);add(new THREE.ConeGeometry(2.5,1.5,8,1,true),mats.roof,0,8.15,0);
   block(mats.timber,0,8.8,0,.18,2.5,.18);block(mats.timber,0,9.4,0,1.6,.14,.20);
   ring(2.94,.08,0,1.35,0,mats.timber,16);lantern(-5.3,-2.7);lantern(5.3,-2.7);bench(0,4.6,6);
  }
  finishGarden();return names[site.index];
 }
 if(track.id==='san-francisco-hills'){
  const names=['red-pier-clockhouse','terrace-stair-hall','pacific-wind-sculpture'];
  if(site.index===0){
   for(const x of [-4.4,4.4]){block(mats.red,x,2.7,0,.30,5.4,5.8);for(let j=0;j<3;j++)beam([x,.5,-2.8+j*1.85],[x,5.3,-.95+j*1.85],mats.cream,.06);}
   roof(11.2,7,5.2,{material:mats.cream});block(mats.glass,0,3,2.25,8.3,3.7,.12);
   for(const x of [-3.6,-1.8,0,1.8,3.6])block(mats.red,x,3,2.12,.11,3.9,.16);
   bench(0,1.1,7);block(mats.warm,0,4.9,-2.65,7,.075,.13);
  }else if(site.index===1){
   // Terraced stair hall uses stepped masses and diagonal handrails.
   for(let i=0;i<8;i++)block(mats.concrete,-2.8,.14+i*.18,3.8-i*.78,5,.28+i*.36,.78);
   for(const x of [-5.25,-.35]){beam([x,.8,4.2],[x,3.45,-2.2],mats.red,.055);for(let i=0;i<4;i++)block(mats.red,x,.70+i*.52,3.8-i*1.57,.09,1.3,.09);}
   block(mats.cream,2.65,3.4,.4,4.5,6.8,5.6);block(mats.glass,2.65,3.65,-2.44,3.7,4.7,.09);
   for(const x of [1.35,2.65,3.95])block(mats.red,x,3.65,-2.54,.13,5,.15);
   const g=new THREE.ConeGeometry(3.9,3.2,4);g.rotateY(Math.PI/4);add(g,mats.roof,2.65,8.05,.4,1,1,.78);
   block(mats.cream,2.65,6.9,-2.52,5.15,.25,.35);bench(-2.8,-3.5,4);
  }else{
   // Two asymmetric curved sails form an original wind instrument silhouette.
   for(const side of [-1,1]){
    const p=[],uv=[],ix=[],rows=low?12:18;
    for(let i=0;i<=rows;i++){const t=i/rows,y=.5+t*9.8,center=side*(1+Math.sin(t*Math.PI)*2.35),half=(.28+Math.sin(t*Math.PI)*1.55);p.push(center-half,y,.3+t*1.7,center+half,y,.3+t*1.7);uv.push(0,t,1,t);if(i<rows){const k=i*2;ix.push(k,k+2,k+1,k+1,k+2,k+3);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();add(g,mats.cream);beam([side,0,.3],[side,10.5,2],mats.red,.08);
   }
   add(new THREE.CylinderGeometry(4.5,4.9,.65,low?16:24),mats.concrete,0,.35,1.1);
   bench(-4.3,-2.2,3.6);bench(3.8,-2.2,3.6);garden(-4.4,4.9);garden(4.4,4.9);
  }
  // Distinct clock tower placement per site; applied hands and face geometry.
  const x=site.index===1?6.1:5.6,z=site.index===1?2.5:3,y=site.index===2?5.3:7;
  block(mats.cream,x,(y+1)/2,z,1.25,y+1,1.25);block(mats.roof,x,y+1.2,z,1.95,.28,1.95);
  const clock=add(new THREE.CylinderGeometry(.58,.58,.10,low?20:32),mats.steel,x,y,z-.675);clock.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){const a=i*Math.PI/6,m=block(mats.cream,x+Math.sin(a)*.46,y+Math.cos(a)*.46,z-.742,.035,i%3===0?.13:.065,.035);m.rotation.z=-a;}
  block(mats.cream,x,y+.19,z-.77,.05,.39,.04);block(mats.cream,x+.17,y,z-.77,.35,.05,.04);
  return names[site.index];
 }
 const names=['petal-quay','prism-exchange','lantern-garden'];
 if(site.index===0){
  // Six individually curved petals, open underneath and supported by branching
  // ribs. The canopy shape is visible from the road and the elevated return.
  const petals=6;
  for(let j=0;j<petals;j++){
   const a=j/petals*Math.PI*2,rows=low?8:14,cols=low?4:6,p=[],uv=[],ix=[];
   for(let i=0;i<=rows;i++)for(let k=0;k<=cols;k++){
    const t=i/rows,v=k/cols*2-1,r=.35+t*5.8,w=Math.sin(t*Math.PI)*1.85,xx=Math.cos(a)*r-Math.sin(a)*v*w,zz=Math.sin(a)*r+Math.cos(a)*v*w;
    p.push(xx,5.4+t*t*2.4-Math.sin(t*Math.PI)*.6+v*v*.32,zz);uv.push(k/cols,t);
    if(i<rows&&k<cols){const q=i*(cols+1)+k;ix.push(q,q+cols+1,q+1,q+1,q+cols+1,q+cols+2);}
   }
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();add(g,mats.cream);
   beam([0,.4,0],[Math.cos(a)*3.5,5.85,Math.sin(a)*3.5],mats.steel,.10);
   beam([Math.cos(a)*3.5,5.85,Math.sin(a)*3.5],[Math.cos(a)*5.9,7.65,Math.sin(a)*5.9],mats.warm,.045);
  }
  add(new THREE.CylinderGeometry(.45,.65,5.6,10),mats.steel,0,2.8,0);ring(4.5,.08,0,.22,0,mats.accent);ring(2.8,.08,0,.4,0,mats.warm);
 }else if(site.index===1){
  for(const side of [-1,1]){
   const g=new THREE.CylinderGeometry(1.4,2.3,11,4);g.rotateY(Math.PI/4);const positions=g.attributes.position;for(let i=0;i<positions.count;i++)positions.setX(i,positions.getX(i)+positions.getY(i)*side*.16);g.computeVertexNormals();add(g,mats.glass,side*2.8,5.8,0,1,1,1.1);
   for(const x of [-1.6,0,1.6])beam([side*2.8+x,.3,-1.9],[side*3.68+x*.61,11.3,-1.13],x===0?mats.warm:mats.steel,.065);
   for(let y=1.4;y<11;y+=1.4)block(mats.steel,side*(2.8+(y-5.8)*.16),y,-1.9+(y-.3)*.07,4.5-(y-.3)*.16,.10,.12);
  }
  block(mats.cream,0,8.2,1.5,9.8,.35,2.2);block(mats.warm,0,8.04,.34,9.2,.075,.075);ring(3.3,.075,0,.20,0,mats.accent);
 }else{
  for(const [x,z,height,radius] of [[0,1.5,9,3.6],[-4,-2,6.5,2.5],[4,-2,5.7,2.2]]){
   add(new THREE.CylinderGeometry(.24,.36,height,8),mats.steel,x,height/2,z);
   for(const level of [0,1]){
    const y=height-level*1.65,r=radius*(level?.72:1);add(new THREE.ConeGeometry(r,1,low?12:20,1,true),mats.cream,x,y,z);ring(r,.075,x,y-.5,z,level?mats.warm:mats.accent);
    for(let j=0;j<8;j++){const a=j*Math.PI/4;beam([x,y-1.7,z],[x+Math.cos(a)*r,y-.5,z+Math.sin(a)*r],mats.steel,.048);}
   }
   ring(radius*.68,.065,x,.20,z,mats.warm);
  }
  
 }
 finishGarden();return names[site.index];
}
