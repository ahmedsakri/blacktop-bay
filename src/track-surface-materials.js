import * as THREE from 'three';

// Nine shared maps, resident once per world. Mobile uses half-resolution files;
// colour maps are sRGB, while normal/roughness data remains linear.
export const TRACK_SURFACE_MAPS = Object.freeze({
  asphaltColor: {file:'asphalt-color',size:1024,color:true,fallback:'#575958'},
  asphaltNormal: {file:'asphalt-normal',size:1024,fallback:'#8080ff'},
  asphaltRoughness: {file:'asphalt-roughness',size:512,fallback:'#d4d4d4'},
  concreteColor: {file:'concrete-color',size:512,color:true,fallback:'#cfcec4'},
  concreteNormal: {file:'concrete-normal',size:512,fallback:'#8080ff'},
  pavingColor: {file:'paving-color',size:512,color:true,fallback:'#a6a49d'},
  pavingNormal: {file:'paving-normal',size:512,fallback:'#8080ff'},
  foliageLeaf: {file:'foliage-leaf',size:512,color:true,fallback:'#91a17a'},
  terrainColor: {file:'terrain-color',size:1024,color:true,fallback:'#8a8777'},
});

function browserImage(url) {
  return new Promise((resolve,reject)=>{
    const image=new Image(),timeout=setTimeout(()=>{image.src='';reject(new Error('Track texture timed out'));},15000);
    image.onload=()=>{clearTimeout(timeout);image.onload=image.onerror=null;resolve(image);};
    image.onerror=()=>{clearTimeout(timeout);image.onload=image.onerror=null;reject(new Error('Track texture unavailable'));};
    image.src=url;
  });
}

export function createTrackSurfaceLibrary({low=false,anisotropy=4,loadImage=browserImage,placeholder}={}) {
  let disposed=false;
  const maps={},status={loaded:0,failed:0,files:Object.keys(TRACK_SURFACE_MAPS).length,estimatedBytes:0},tasks=[];
  for(const [key,definition] of Object.entries(TRACK_SURFACE_MAPS)) {
    const size=definition.size/(low?2:1);
    // WebGL2 texStorage is immutable: swapping a decoded 512px image into a
    // texture already allocated from a 1px placeholder cannot resize its GPU
    // storage. Reserve the final dimensions before the first rendered frame.
    const canvas=placeholder?.(definition.fallback,size)||document.createElement('canvas');
    canvas.width=canvas.height=size;
    if(!placeholder){const c=canvas.getContext('2d');c.fillStyle=definition.fallback;
      if(key==='foliageLeaf'){
        // A failed leaf request retains a soft cutout spray, never an opaque
        // rectangular card. It is replaced by the verified photograph on load.
        for(let i=0;i<24;i++){const a=i*2.399963,r=size*(.09+Math.sqrt((i+.5)/24)*.27);c.beginPath();c.ellipse(size/2+Math.cos(a)*r,size/2+Math.sin(a)*r*.88,size*.047,size*.081,a,0,Math.PI*2);c.fill();}
      }else c.fillRect(0,0,size,size);
    }
    const texture=new THREE.Texture(canvas);texture.needsUpdate=true;
    texture.name=definition.file;texture.colorSpace=definition.color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(8,Math.max(1,anisotropy));maps[key]=texture;
    status.estimatedBytes+=size*size*4*4/3;
    const url=`/assets/environments/surfaces/${definition.file}${low?'-mobile':''}.webp`;
    tasks.push(Promise.resolve().then(()=>loadImage(url)).then(image=>{
      if(disposed){image.close?.();return;}
      if(image.width!==size||image.height!==size){image.close?.();throw new Error('Unexpected track texture dimensions');}
      texture.image=image;texture.needsUpdate=true;status.loaded++;
    }).catch(()=>{if(!disposed)status.failed++;}));
  }
  return {maps,status,ready:Promise.all(tasks),dispose(){if(disposed)return;disposed=true;for(const texture of Object.values(maps)){texture.image?.close?.();texture.dispose();}}};
}

export function roadSurfaceMaterial(maps) {
  return new THREE.MeshStandardMaterial({color:'#c2c5c7',map:maps.asphaltColor,normalMap:maps.asphaltNormal,
    normalScale:new THREE.Vector2(.34,.34),roughnessMap:maps.asphaltRoughness,roughness:.94,metalness:0,envMapIntensity:.18});
}

export function concreteSurfaceMaterial(maps,{color='#a9afb0',roughness=.91}={}) {
  const material=new THREE.MeshStandardMaterial({color,map:maps.concreteColor,normalMap:maps.concreteNormal,
    normalScale:new THREE.Vector2(.13,.13),roughness,metalness:0});
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(diffuse,diffuseColor.rgb,0.24);');};
  material.customProgramCacheKey=()=> 'restrained-concrete-v1';material.userData.surfaceVariation=.24;return material;
}

// Dedicated CC0 paving at 2.12m, rather than weathered wall imagery on floors.
export function pavingSurfaceMaterial(maps,{color='#cbc8bd'}={}){
 return new THREE.MeshStandardMaterial({color,map:maps.pavingColor||null,normalMap:maps.pavingNormal||null,normalScale:new THREE.Vector2(.28,.28),roughness:.9,metalness:0});
}

// Static scenery is already transformed into world coordinates when batched.
// Project by the dominant face normal so neither a 100m wall nor a tiny pier
// stretches one texture across its entire object.
export function setWorldSurfaceUV(geometry,metres=3) {
  const positions=geometry.attributes.position,normals=geometry.attributes.normal,uv=new Float32Array(positions.count*2);
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),nx=Math.abs(normals.getX(i)),ny=Math.abs(normals.getY(i)),nz=Math.abs(normals.getZ(i));
    uv[i*2]=(ny>nx&&ny>nz?x:nx>nz?z:x)/metres;
    uv[i*2+1]=(ny>nx&&ny>nz?z:y)/metres;
  }
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geometry;
}

// Actual tapered crash-barrier cross section; it stays within the previous
// unit box footprint so this changes visual geometry, never collision width.
export function barrierProfileGeometry() {
  const profile=[[-.5,-.5],[.5,-.5],[.5,-.31],[.29,-.13],[.22,.5],[-.22,.5],[-.29,-.13],[-.5,-.31]];
  const shape=new THREE.Shape(profile.map(([x,y])=>new THREE.Vector2(x,y)));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:1,steps:1,bevelEnabled:false});geometry.translate(0,0,-.5);
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++)uv.setXY(i,Math.abs(n.getZ(i))>.8?(p.getX(i)+.5)*.22:(p.getZ(i)+.5)*1.66,(p.getY(i)+.5)/3);
  return geometry;
}

/** Metre-scaled curtain wall / masonry bays. Glass, mullions, stone floor
 * spandrels and unlit rooms respond differently to the existing scene light. */
export function architecturalFacadeMaterial({night=false}={}) {
  const material=new THREE.MeshStandardMaterial({color:'#bfc7c8',metalness:.18,roughness:.65});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 vFacade;varying float vFacadeSeed;varying float vFacadeWall;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 sz=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
      float faceWidth=abs(normal.x)>.5?sz.z:sz.x;
      vFacade=vec2(uv.x*faceWidth/2.45,uv.y*sz.y/3.3);
      vFacadeSeed=fract(sin(dot(instanceMatrix[3].xz,vec2(12.9898,78.233)))*43758.5453);
      vFacadeWall=1.-step(.5,abs(normal.y));
    `);
    shader.fragmentShader='varying vec2 vFacade;varying float vFacadeSeed;varying float vFacadeWall;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec2 bay=fract(vFacade);float curtain=step(.52,vFacadeSeed);
      vec2 gap=mix(vec2(.14,.18),vec2(.035,.08),curtain);
      float pane=step(gap.x,bay.x)*step(bay.x,1.-gap.x)*step(gap.y,bay.y)*step(bay.y,.85)*vFacadeWall;
      float mullion=1.-smoothstep(.015,.035,abs(bay.x-.5));
      float sill=step(.10,bay.y)*step(bay.y,.16)*vFacadeWall;
      float variation=fract(sin(dot(floor(vFacade)+vFacadeSeed,vec2(21.13,7.7)))*19421.7);
      vec3 stone=mix(vec3(.37,.34,.28),vec3(.63,.65,.64),vFacadeSeed);
      vec3 glass=mix(vec3(.075,.13,.17),vec3(.20,.29,.34),variation*.65+bay.y*.35);
      diffuseColor.rgb*=mix(stone,glass,pane);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.20,.23,.24),pane*mullion*.85);
      diffuseColor.rgb+=sill*.09;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.83,.24,pane);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(.04,.40,pane);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      totalEmissiveRadiance+=vec3(.65,.39,.16)*pane*step(.72,variation)*${night?'.55':'.025'};
    `);
  };
  material.customProgramCacheKey=()=>`camber-authored-facades-v3-${night?'night':'day'}`;return material;
}

// One alpha-tested photographed spray per crown leaf cluster. Colour is used
// as luminance detail so the same map supports green and blossom canopies.
export function foliageSurfaceMaterial(map,{color='white'}={}){
 const material=new THREE.MeshStandardMaterial({color,map:map||null,vertexColors:true,roughness:1,side:THREE.DoubleSide,alphaTest:.46});
 if(map){material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 #ifdef USE_MAP
 diffuseColor.rgb=diffuse*clamp(dot(sampledDiffuseColor.rgb,vec3(.299,.587,.114))*2.5,.18,1.);
 #endif`);};material.customProgramCacheKey=()=> 'photographed-foliage-spray-v1';}
 return material;
}
