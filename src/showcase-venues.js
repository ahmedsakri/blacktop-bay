import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {sampleTrack,projectOnTrack,TRACKS} from './track.js';
import {VENUE_REGIONS} from './showcase-lighting.js';
import {originalLandmarkLayout} from './original-venues.js';
import {setWorldSurfaceUV} from './track-surface-materials.js';
import {addFlagshipSectorArt} from './flagship-sector-art.js';

// These are authored sectors on the game's original arcade routes. Fractions
// describe the driving line, never claim surveyed real-world road geometry.
const AUTHORED_SHOWCASES={
 harbor:{name:'Harbor Flow',surface:'#b7bdc5',sectors:[
  {s:.13,label:'QUAYSIDE',kind:'sail-terminal',side:1,roughness:.62,wear:.23},
  {s:.43,label:'CRANE CHANNEL',kind:'signal-house',side:-1,roughness:.84,wear:.46},
  {s:.73,label:'MARINA RETURN',kind:'sail-terminal',side:1,roughness:.71,wear:.18},
 ]},
 'fuji-skyline':{name:'Fuji Skyline',surface:'#bdc4c2',sectors:[
  {s:.12,label:'BLOSSOM RUN',kind:'mountain-pavilion',side:1,roughness:.91,wear:.16},
  {s:.42,label:'SKYLINE VIADUCT',kind:'mountain-pavilion',side:-1,roughness:.73,wear:.34},
  {s:.72,label:'SUMMIT RETURN',kind:'mountain-pavilion',side:1,roughness:.87,wear:.23},
 ]},
 'singapore-afterdark':{name:'Singapore Afterdark',surface:'#aebbc5',sectors:[
  {s:.13,label:'PETAL QUAY',kind:'petal-quay',side:1,roughness:.65,wear:.16},
  {s:.43,label:'PRISM EXCHANGE',kind:'prism-exchange',side:-1,roughness:.79,wear:.30},
  {s:.74,label:'LANTERN GARDEN',kind:'lantern-garden',side:1,roughness:.70,wear:.20},
 ]},
 'san-francisco-hills':{name:'San Francisco Hills',surface:'#c4bcb4',sectors:[
  {s:.12,label:'BAY VIADUCT',kind:'bay-shelter',side:-1,roughness:.78,wear:.30},
  {s:.45,label:'TERRACE CLIMB',kind:'bay-shelter',side:1,roughness:.92,wear:.50},
  {s:.76,label:'PACIFIC DESCENT',kind:'bay-shelter',side:-1,roughness:.82,wear:.26},
 ]},
};
const REGIONAL_SECTORS={
 maritime:{kind:'sail-terminal',surface:'#b7bdc5',labels:['WATERFRONT','TERMINAL RUN','COASTAL RETURN'],palette:['#e6dfc8','#42697e','#c7b46d','#535669']},
 mediterranean:{kind:'arcade-terrace',surface:'#c1beb5',labels:['SUN TERRACE','CIRCUIT GALLERY','FINAL PROMENADE'],palette:['#dbbc92','#445f73','#bf6a50','#ece6d2']},
 woodland:{kind:'motorsport-canopy',surface:'#bcc2bd',labels:['PADDOCK GARDEN','WOODLAND VIEW','HOME STRAIGHT'],palette:['#c4c7a6','#3f6152','#7e6572','#e3ddc9']},
 alpine:{kind:'mountain-pavilion',surface:'#bac3c5',labels:['RIDGE VIEW','TIMBER TERRACE','SUMMIT GALLERY'],palette:['#dfc9c4','#705a71','#d3d3bf','#52675c']},
 tropical:{kind:'tropical-canopy',surface:'#bbc3bf',labels:['PALM TERRACE','CANOPY CORNER','COASTAL GALLERY'],palette:['#debd73','#3c716a','#af6861','#e0ddd0']},
 arid:{kind:'arcade-terrace',surface:'#c6baa9',labels:['DUNE PAVILION','SHADED GALLERY','SUNSET RETURN'],palette:['#ddc6a0','#9d6252','#495970','#d7dbd0']},
 metropolitan:{kind:'city-gallery',surface:'#afb8c1',labels:['SKYLINE GALLERY','CITY TERRACE','LIGHTS RETURN'],palette:['#b4a1cb','#d4c7a5','#3b5170','#b7657b']},
 industrial:{kind:'signal-house',surface:'#b3b8b9',labels:['SIGNAL YARD','CRANE GALLERY','DOCKSIDE RETURN'],palette:['#d6b370','#4b6572','#ae6c59','#cdd3cd']},
};
export const SHOWCASE_VENUES=Object.freeze(Object.fromEntries(TRACKS.map(track=>{
 const family=REGIONAL_SECTORS[VENUE_REGIONS[track.id]]||REGIONAL_SECTORS.maritime;
 return [track.id,AUTHORED_SHOWCASES[track.id]||{name:track.name,surface:family.surface,region:VENUE_REGIONS[track.id],sectors:family.labels.map((label,i)=>({s:[.13,.43,.74][i],label,kind:family.kind,side:i%2?-1:1,roughness:[.78,.90,.83][i],wear:[.18,.35,.24][i]}))}];
})));
const AUTHORED_CROWD_PALETTES=Object.freeze({harbor:['#e6dfc8','#42697e','#c7b46d','#535669'],'fuji-skyline':['#dfc9c4','#705a71','#d3d3bf','#52675c'],'san-francisco-hills':['#d2a555','#334d68','#b95e52','#d9d8ce']});
export const SHOWCASE_CROWD_PALETTES=Object.freeze(Object.fromEntries(TRACKS.map(track=>[track.id,AUTHORED_CROWD_PALETTES[track.id]||(REGIONAL_SECTORS[VENUE_REGIONS[track.id]]||REGIONAL_SECTORS.maritime).palette])));
const wrap=(x)=>((x%1)+1)%1;
export function showcaseSurfaceAt(track,fraction){
 const showcase=SHOWCASE_VENUES[track.id];if(!showcase)return {roughness:.86,wear:0};
 const f=wrap(fraction),sectors=showcase.sectors;
 let index=sectors.findIndex(sector=>sector.s>f)-1;if(index<0)index=sectors.length-1;
 const a=sectors[index],b=sectors[(index+1)%sectors.length];
 const distance=wrap(f-a.s),span=wrap(b.s-a.s),blend=THREE.MathUtils.smoothstep(distance,span*.78,span);
 return {roughness:THREE.MathUtils.lerp(a.roughness,b.roughness,blend),wear:THREE.MathUtils.lerp(a.wear,b.wear,blend)};
}
export function applyShowcaseSurface(road,track){
 const showcase=SHOWCASE_VENUES[track.id];if(!showcase)return;
 const values=[];
 for(let i=0;i<=track.samples.length;i++){
  const p=track.samples[i%track.samples.length],surface=showcaseSurfaceAt(track,(i===track.samples.length?track.length:p.s)/track.length);
  // Subtle age bands vary by sector. No vertex displacement: physics and the
  // drivable elevation remain exactly aligned with the authored track.
  for(let edge=0;edge<2;edge++)values.push(surface.roughness,surface.wear);
 }
 road.geometry.setAttribute('roadSurface',new THREE.Float32BufferAttribute(values,2));
 road.material.color.set(showcase.surface);
 road.material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec2 roadSurface; varying vec2 vRoadSurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoadSurface=roadSurface;');
  shader.fragmentShader='varying vec2 vRoadSurface;\n'+shader.fragmentShader;
  // Preserve the fine PBR roughness map underneath the authored sector grade.
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(vRoadSurface.x*roughnessFactor/max(roughness,.01),.55,.96);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb*=1.-vRoadSurface.y*.19;');
 };
 road.material.customProgramCacheKey=()=> 'authored-showcase-road-v2';
 road.userData.surfaceSectors=showcase.sectors.map(({s,roughness,wear})=>({s,roughness,wear}));
}
export function showcaseLayout(track,{stands=[]}={}){
 const result=[],showcase=SHOWCASE_VENUES[track.id];if(!showcase)return result;
 const existing=originalLandmarkLayout(track,{stands});
 for(const [index,sector] of showcase.sectors.entries()){
  for(const delta of [0,.014,-.014,.028,-.028,.045,-.045,.07,-.07,.09,-.09]){
   const s=track.length*wrap(sector.s+delta),p=sampleTrack(s,track),radius=12.2;
   const offset=sector.side*(track.width/2+radius+12),x=p.x+p.nx*offset,z=p.z+p.nz*offset;
   if(projectOnTrack(x,z,undefined,track).distance<track.width/2+radius+7)continue;
   if(stands.some(other=>Math.hypot(other.x-x,other.z-z)<radius+17))continue;
   if(result.some(other=>Math.hypot(other.x-x,other.z-z)<radius*2+7))continue;
   if(existing.some(other=>Math.hypot(other.x-x,other.z-z)<radius+other.radius+6))continue;
   result.push({...sector,index,s,x,y:p.y||0,z,radius,yaw:Math.atan2(p.tx,p.tz),nx:p.nx,nz:p.nz,tx:p.tx,tz:p.tz});break;
  }
 }
 return result;
}
// Narrow, supported access walks connect flagship viewing decks to the curb.
// Validate the complete strip against every road segment before authoring it.
export function showcaseApproachLayout(track,site){
 if(!['fuji-skyline','san-francisco-hills','singapore-afterdark'].includes(track.id))return null;
 const road=sampleTrack(site.s,track),offset=Math.hypot(site.x-road.x,site.z-road.z),start=-site.side*7.0,end=-site.side*(offset-track.width/2-3.5),width=2.3;
 const length=Math.abs(end-start),center=(start+end)/2,c=Math.cos(site.yaw),s=Math.sin(site.yaw);
 if(length<1)return null;
 const footprint=[];
 for(let i=0;i<=Math.ceil(length);i++)for(const z of [-width/2,width/2]){const x=start+(end-start)*i/Math.ceil(length);footprint.push({x:site.x+c*x+s*z,z:site.z-s*x+c*z});}
 if(footprint.some(p=>projectOnTrack(p.x,p.z,undefined,track).distance<track.width/2+2.5))return null;
 return {sector:site.index,x:site.x+c*center,z:site.z-s*center,y:site.y,start,end,center,length,width,yaw:site.yaw,footprint};
}
function signageTexture(site,track){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;
 const c=canvas.getContext('2d');c.fillStyle='#021439';c.fillRect(0,0,768,192);
 c.fillStyle='#9246ff';c.fillRect(0,0,14,192);c.fillStyle='#fff71e';c.fillRect(28,26,88,84);
 c.fillStyle='#110017';c.textAlign='center';c.font='800 62px "Barlow Condensed",sans-serif';c.fillText(String(site.index+1).padStart(2,'0'),72,90);
 c.textAlign='left';c.fillStyle='#ffffff';c.font='700 51px "Barlow Condensed",sans-serif';c.fillText(site.label,140,88,595);
 c.fillStyle='#c6cddf';c.font='600 23px "Barlow Condensed",sans-serif';c.fillText(SHOWCASE_VENUES[track.id].name.toUpperCase()+'  /  CAMBER REIGN',140,136,592);
 c.fillStyle='#9246ff';c.fillRect(140,155,580,3);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function createShowcaseVenue(scene,track,{low=false,stands=[],crowd,rng=Math.random,surfaces}={}){
 const sites=showcaseLayout(track,{stands});if(!sites.length)return null;
 const root=new THREE.Group();root.name='showcase-authored-sectors';scene.add(root);
 const mats={steel:new THREE.MeshStandardMaterial({color:'#405264',metalness:.65,roughness:.43}),
  concrete:new THREE.MeshStandardMaterial({color:'#a7aaa1',roughness:.91,map:surfaces?.concreteColor||null,normalMap:surfaces?.concreteNormal||null,normalScale:new THREE.Vector2(.18,.18)}),
  timber:new THREE.MeshStandardMaterial({color:'#705344',roughness:.87}),
  roof:new THREE.MeshStandardMaterial({color:'#34474d',roughness:.68}),
  red:new THREE.MeshStandardMaterial({color:track.id==='fuji-skyline'?'#c18f9b':'#a95643',roughness:.72}),
  cream:new THREE.MeshStandardMaterial({color:'#e4ddc9',roughness:.78,side:THREE.DoubleSide}),
  glass:new THREE.MeshStandardMaterial({color:'#233f50',metalness:.53,roughness:.25}),
  warm:new THREE.MeshBasicMaterial({color:'#ffd7a3',toneMapped:false}),
  accent:new THREE.MeshBasicMaterial({color:'#9246ff',toneMapped:false})};
 const box=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,8),parts=[];
 const piece=(site,geometry,material,x,y,z,sx,sy,sz,rotation=0)=>{
  const m=new THREE.Mesh(geometry,material),c=Math.cos(site.yaw),s=Math.sin(site.yaw);
  m.position.set(site.x+c*x+s*z,site.y+y,site.z-s*x+c*z);m.rotation.set(0,site.yaw+rotation,0,'YXZ');m.scale.set(sx,sy,sz);m.userData.sector=site.index;root.add(m);parts.push(m);return m;
 };
 const rod=(site,from,to,material,radius=.045)=>{
  const direction=new THREE.Vector3(...to).sub(new THREE.Vector3(...from)),mid=new THREE.Vector3(...from).add(new THREE.Vector3(...to)).multiplyScalar(.5);
  const mesh=piece(site,cylinder,material,...mid.toArray(),radius,direction.length(),radius);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),site.yaw));return mesh;
 };
 for(const site of sites){
  // Terrace foundations meet the road elevation instead of floating at crests.
  piece(site,box,mats.concrete,0,-.3,0,15,.6,15);
  if(site.kind==='bay-shelter'){
   // The old pedestal stopped at -0.30m above the -0.65m sea. A submerged
   // quay and six visible piers now connect every terrace to solid support.
   piece(site,box,mats.concrete,0,-site.y-1.65,0,17,3,17);
   for(const x of [-5.6,5.6])for(const z of [-5.6,0,5.6])piece(site,box,mats.concrete,x,-site.y/2-.375,z,1.15,site.y-.45,1.15);
   for(const side of [-1,1]){piece(site,box,mats.concrete,0,-.75,side*6.3,14,.55,.65);piece(site,box,mats.concrete,side*6.3,-.75,0,.65,.55,14);}
   (root.userData.foundations||=[]).push({sector:site.index,x:site.x,z:site.z,yaw:site.yaw,deckTop:site.y,deckBottom:site.y-.6,bottom:-3.15,quayTop:-.15,piers:6,width:17});
  }else {
   // All terraces have support down to terrain or below coastal water level.
   // A 5 cm gap under a zero-elevation deck is still a visible floating asset.
   piece(site,box,mats.concrete,0,-site.y/2-.55,0,13,site.y+1.1,13);
   (root.userData.foundations||=[]).push({sector:site.index,x:site.x,z:site.z,yaw:site.yaw,deckTop:site.y,deckBottom:site.y-.6,bottom:-1.1,width:15});
  }
  const artStart=parts.length,flagship=addFlagshipSectorArt(track,site,{low,piece,rod,box,cylinder,mats});
  if(flagship){
   // Measure the actual transformed footprint before material merging. The
   // complete convex hull is inside this circle, so the circle clearance also
   // protects triangle interiors, not just the geometry's corner samples.
   let footprint=0,height=0,triangles=0;const vertex=new THREE.Vector3();
   for(const part of parts.slice(artStart)){part.updateMatrix();const p=part.geometry.attributes.position;triangles+=(part.geometry.index?.count??p.count)/3;for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyMatrix4(part.matrix);footprint=Math.max(footprint,Math.hypot(vertex.x-site.x,vertex.z-site.z));height=Math.max(height,vertex.y-site.y);}}
   (root.userData.flagshipArt||=[]).push({id:flagship,sector:site.index,x:site.x,y:site.y,z:site.z,yaw:site.yaw,radius:site.radius,footprint,height,triangles});
  }else if(site.kind==='sail-terminal'){
   for(const x of [-5,5]){piece(site,cylinder,mats.steel,x,4,0,.13,8,.13);piece(site,box,mats.warm,x,3.7,-.35,.85,.08,.25);}
   // Two stretched triangular sails: architectural fabric with a ridged edge.
   for(const flip of [-1,1]){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-5,5,flip*5,5,7,0,5,4.7,flip*5],3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,0,1,1],2));geo.computeVertexNormals();piece(site,geo,mats.cream,0,0,0,1,1,1);}
   for(const flip of [-1,1]){rod(site,[-5,5,flip*5],[5,7,0],mats.steel,.026);rod(site,[5,7,0],[5,4.7,flip*5],mats.steel,.026);}
   piece(site,box,mats.timber,0,.55,4.2,9,.2,.7);piece(site,box,mats.steel,0,.3,4.2,8,.5,.12);
   for(const x of [-3,0,3])piece(site,box,mats.cream,x,.65,1.5,1.4,1.3,1.4);
  }else if(site.kind==='mountain-pavilion'){
   for(const x of [-4.5,4.5])for(const z of [-3.3,3.3])piece(site,box,mats.timber,x,2.3,z,.30,4.6,.30);
   piece(site,box,mats.timber,0,4.5,0,9.7,.32,7.4);
   for(const side of [-1,1]){const roof=piece(site,box,mats.roof,0,5.05,side*2.05,11,.3,4.65);roof.rotation.x=side*.24;}
   piece(site,box,mats.timber,0,5.73,0,11.25,.18,.24);
   for(const side of [-1,1]){piece(site,box,mats.timber,0,4.6,side*4.24,11.15,.19,.18);for(const x of [-4.5,4.5])rod(site,[x,3.25,side*3.3],[x-side*.75,4.42,side*3.3],mats.timber,.075);}
   piece(site,box,mats.timber,0,.65,2.8,8.5,.2,.75);
   for(const x of [-3,3]){piece(site,box,mats.cream,x,3.2,0,.62,1.1,.62);piece(site,box,mats.warm,x,3.2,-.32,.48,.73,.02);}
   for(const x of [-3.9,3.9])piece(site,box,mats.red,x,1.2,3.7,.18,2.4,.18);
  }else if(site.kind==='bay-shelter'){
   for(const x of [-4,4])for(const z of [-2.5,2.5])piece(site,box,mats.red,x,2.2,z,.25,4.4,.25);
   piece(site,box,mats.roof,0,4.5,0,9.7,.33,6.5);
   piece(site,box,mats.red,0,4.14,0,9.1,.32,5.8);
   for(const side of [-1,1])piece(site,box,mats.cream,0,4.45,side*3.24,9.85,.12,.07);
   for(const x of [-4,4])for(const z of [-2.5,2.5])rod(site,[x,3.25,z],[x*.74,4.22,z],mats.red,.055);
   piece(site,box,mats.timber,0,.67,2.1,7.2,.19,.75);
   piece(site,box,mats.glass,0,2.6,2.7,7.5,2.3,.1);
   for(const x of [-3.2,0,3.2])piece(site,box,mats.cream,x,2.6,2.62,.13,2.5,.12);
   piece(site,box,mats.warm,0,4.25,0,5.4,.06,.19);
   // Compact clock tower creates a recognisable crest-side silhouette.
   piece(site,box,mats.cream,5.6,4,3,1.45,8,1.45);piece(site,box,mats.roof,5.6,8.2,3,2.2,.35,2.2);
   const clock=piece(site,cylinder,mats.steel,5.6,7,2.24,.58,.10,.58);clock.rotation.x=Math.PI/2;
   for(let tick=0;tick<12;tick++){const angle=tick*Math.PI/6;const mark=piece(site,box,mats.cream,5.6+Math.sin(angle)*.465,7+Math.cos(angle)*.465,2.175,.035,tick%3===0?.13:.065,.035);mark.rotation.z=-angle;}
   piece(site,box,mats.cream,5.6,7.2,2.16,.055,.4,.05);piece(site,box,mats.cream,5.8,7,2.16,.4,.055,.05);
  }else if(site.kind==='city-gallery'){
   // A glass viewing gallery, louvred facade and illuminated vertical fins.
   for(const x of [-4.8,4.8])piece(site,box,mats.steel,x,3.2,0,.30,6.4,6.2);
   piece(site,box,mats.roof,0,6.25,0,10.4,.35,6.5);
   piece(site,box,mats.glass,0,3.5,2.5,9.2,4.5,.14);
   for(let x=-4;x<=4;x+=1)piece(site,box,mats.steel,x,3.6,2.35,.09,4.7,.20);
   for(const x of [-4.95,4.95]){piece(site,box,mats.accent,x,3.45,-3.15,.07,5.6,.09);piece(site,box,mats.warm,x,6.5,0,.12,.1,6.2);}
   piece(site,box,mats.concrete,0,.40,3.7,10,.8,1.2);
   for(let x=-3.6;x<4;x+=1.8)piece(site,box,mats.timber,x,.9,3.7,1.4,.12,.7);
  }else if(site.kind==='arcade-terrace'){
   // Repeated open arches give Mediterranean/desert venues a shaded colonnade.
   for(const x of [-4.8,-2.4,0,2.4,4.8])for(const z of [-2.7,2.7])piece(site,box,mats.cream,x,1.55,z,.32,3.1,.36);
   for(const z of [-2.7,2.7])for(let bay=0;bay<4;bay++){
    const center=-3.6+bay*2.4;
    for(let segment=0;segment<12;segment++){
     const a=segment*Math.PI/12,b=(segment+1)*Math.PI/12;
     rod(site,[center+Math.cos(a)*1.2,3.05+Math.sin(a)*1.15,z],[center+Math.cos(b)*1.2,3.05+Math.sin(b)*1.15,z],mats.cream,.18);
    }
   }
   piece(site,box,mats.cream,0,4.5,0,10.4,.40,6.2);
   for(let x=-4.8;x<=4.8;x+=.8)piece(site,box,mats.timber,x,4.83,0,.24,.18,6.6);
   for(const x of [-4,4])piece(site,box,mats.timber,x,.65,0,1.3,.19,3.9);
  }else if(site.kind==='motorsport-canopy'||site.kind==='tropical-canopy'){
   const tropical=site.kind==='tropical-canopy';
   for(const x of [-4.6,4.6])for(const z of [-3,3])piece(site,cylinder,tropical?mats.timber:mats.steel,x,2.7,z,.15,5.4,.15);
   if(tropical){
    // A double-curved fabric roof with an elevated central spine.
    const g=new THREE.BufferGeometry(),v=[],ix=[],n=12;
    for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const xx=(x/n-.5)*11,zz=(z/n-.5)*8;v.push(xx,5.25+Math.sin(x/n*Math.PI)*1.25-Math.sin(z/n*Math.PI)*.38,zz);}
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*(n+1)+x;ix.push(i,i+n+1,i+1,i+1,i+n+1,i+n+2);}
    g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();piece(site,g,mats.cream,0,0,0,1,1,1);
   }else{
    piece(site,box,mats.roof,0,5.5,0,11.3,.24,8.1);
    for(const z of [-3.8,3.8])for(let x=-4.8;x<4.8;x+=1.6){rod(site,[x,5,z],[x+.8,5.4,z],mats.steel,.065);rod(site,[x+.8,5.4,z],[x+1.6,5,z],mats.steel,.065);}
    for(const side of [-1,1])piece(site,box,mats.warm,0,5.24,side*3.8,10,.06,.08);
   }
   for(const x of [-3.2,0,3.2]){piece(site,box,mats.timber,x,.73,2,2.4,.15,.82);piece(site,box,mats.steel,x,.40,2,.12,.7,.62);}
  }else{
   piece(site,box,mats.concrete,0,2.6,0,5,5.2,5);piece(site,box,mats.glass,0,5.9,0,5.5,1.5,5.5);piece(site,box,mats.roof,0,6.9,0,6.5,.3,6.5);
   piece(site,cylinder,mats.steel,0,9.7,0,.09,5.5,.09);piece(site,box,mats.warm,0,12.45,0,.32,.2,.32);
   for(const x of [-2,2])piece(site,box,mats.cream,x,2.3,-2.53,.8,2.6,.08);
  }
  const approach=showcaseApproachLayout(track,site);
  if(approach){
   const railMaterial=track.id==='fuji-skyline'?mats.timber:track.id==='san-francisco-hills'?mats.red:mats.steel;
   piece(site,box,mats.concrete,approach.center,-.21,0,approach.length,.34,approach.width);
   for(const z of [-.99,.99]){
    piece(site,box,railMaterial,approach.center,1.02,z,approach.length,.075,.075);
    for(let j=0;j<=4;j++){const x=approach.start+(approach.end-approach.start)*j/4;piece(site,box,railMaterial,x,.51,z,.075,1.02,.075);}
   }
   for(const x of [approach.start,approach.center,approach.end])piece(site,box,mats.concrete,x,-site.y/2-1.65,0,.52,site.y+2.9,1.8);
   (root.userData.approaches||=[]).push(approach);
  }
  // Each sector's signed viewing terrace faces the racing line; the crowd uses
  // existing proximity animation/culling and has a strict population ceiling.
  for(let i=0;i<(low?8:14);i++){
   const across=-6+(i%7)*1.85,along=-5.8-Math.floor(i/7)*.85;
   const c=Math.cos(site.yaw),s=Math.sin(site.yaw),x=site.x+c*across+s*along,z=site.z-s*across+c*along;
   const road=sampleTrack(site.s,track);crowd?.add(x,site.y+.05,z,Math.atan2(road.x-x,road.z-z),false,rng,{palette:SHOWCASE_CROWD_PALETTES[track.id],gesture:i===2?3:undefined});
  }
  const p=sampleTrack(site.s-28,track),offset=site.side*(track.width/2+5.2),sx=p.x+p.nx*offset,sz=p.z+p.nz*offset;
  if(projectOnTrack(sx,sz,undefined,track).distance>track.width/2+4.8){
   const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.9,1.475),new THREE.MeshBasicMaterial({map:signageTexture(site,track),side:THREE.DoubleSide}));
   sign.position.set(sx,p.y+3.4,sz);sign.rotation.y=Math.atan2(p.tx,p.tz)+Math.PI;root.add(sign);sign.userData.distanceDetail={distance:320};
   for(const x of [-2.35,2.35]){const post=new THREE.Mesh(new THREE.BoxGeometry(.09,3.3,.09),site.kind==='mountain-pavilion'?mats.timber:mats.steel);post.position.set(sx+p.nx*x,p.y+1.65,sz+p.nz*x);post.userData.sector=site.index;root.add(post);parts.push(post);}
  }
 }
 // Retain sector-local bounds (not one world-sized batch) so added detail can
 // be culled independently. Shared palette reduces each terrace to few draws.
 const batches=new Map();root.updateMatrixWorld(true);
 const geometryStats={sourceTriangles:parts.reduce((sum,p)=>sum+(p.geometry.index?.count??p.geometry.attributes.position.count)/3,0),batchedTriangles:0,fallbackBatches:0};
 for(const part of parts){const siteKey=String(part.userData.sector),key=siteKey+part.material.uuid+':'+Object.keys(part.geometry.attributes).sort().join(',');
  const g=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();g.applyMatrix4(part.matrixWorld);if(surfaces&&part.material===mats.concrete)setWorldSurfaceUV(g,3);
  if(!batches.has(key))batches.set(key,{material:part.material,geometries:[]});batches.get(key).geometries.push(g);part.removeFromParent();
 }
 for(const {material,geometries}of batches.values()){
  const combined=mergeGeometries(geometries,false);
  // Keep every transformed part if a future asset breaks the batch contract.
  // Rendering extra draws is preferable to silently deleting architecture.
  const outputs=combined?[combined]:geometries;
  if(combined)geometries.forEach(g=>g.dispose());else geometryStats.fallbackBatches++;
  for(const geometry of outputs){const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;mesh.userData.distanceDetail={distance:460};root.add(mesh);geometryStats.batchedTriangles+=(geometry.index?.count??geometry.attributes.position.count)/3;}
 }
 geometryStats.drawBatches=root.children.length;root.userData.geometryStats=geometryStats;
 const used=new Set();root.traverse(o=>{if(o.material)used.add(o.material);});for(const material of Object.values(mats))if(!used.has(material))material.dispose();
 new Set(parts.map(p=>p.geometry)).forEach(g=>g.dispose());box.dispose();cylinder.dispose();
 root.userData.sectors=sites.map(({label,s,x,y,z})=>({label,s,x,y,z}));scene.userData.flagshipArt=root.userData.flagshipArt||[];scene.userData.showcaseSectors=root.userData.sectors;
 return root;
}
