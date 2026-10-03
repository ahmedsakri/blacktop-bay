import * as THREE from 'three';

// Shared maps, resident once per world. Mobile uses half-resolution files;
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
  groundDetailColor: {file:'ground-detail-color',size:1024,color:true,fallback:'#808080'},
  groundDetailNormal: {file:'ground-detail-normal',size:1024,fallback:'#8080ff'},
});
export const TRACK_ROCK_MAPS=Object.freeze({
  rockColor:{file:'fjord-rock-color',size:1024,color:true,fallback:'#aaa69b'},
  rockNormal:{file:'fjord-rock-normal',size:1024,fallback:'#8080ff'},
});

function browserImage(url) {
  return new Promise((resolve,reject)=>{
    const image=new Image(),timeout=setTimeout(()=>{image.src='';reject(new Error('Track texture timed out'));},15000);
    image.onload=()=>{clearTimeout(timeout);image.onload=image.onerror=null;resolve(image);};
    image.onerror=()=>{clearTimeout(timeout);image.onload=image.onerror=null;reject(new Error('Track texture unavailable'));};
    image.src=url;
  });
}

export function createTrackSurfaceLibrary({low=false,rock=false,anisotropy=4,loadImage=browserImage,placeholder}={}) {
  let disposed=false;
  const definitions=rock?{...TRACK_SURFACE_MAPS,...TRACK_ROCK_MAPS}:TRACK_SURFACE_MAPS;
  const maps={},status={loaded:0,failed:0,files:Object.keys(definitions).length,estimatedBytes:0},tasks=[];
  for(const [key,definition] of Object.entries(definitions)) {
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

export const WINDOW_INTERIOR=Object.freeze({width:2.45,height:3.3,depth:2.6,fadeStart:45,fadeEnd:100});

// Existing window UV buffers carry room coordinates in metres, centered on
// each aperture. Wide lobby glazing spans several rooms; small windows expose
// only the middle of a room rather than stretching a room to their aspect.
export function setWindowInteriorUV(geometry,width,height,depth){
 const {uv,normal}=geometry.attributes;
 for(let i=0;i<uv.count;i++){
  const side=Math.abs(normal.getX(i))>.5,top=Math.abs(normal.getY(i))>.5;
  uv.setXY(i,.5+(uv.getX(i)-.5)*(side?depth:width)/WINDOW_INTERIOR.width,.5+(uv.getY(i)-.5)*(top?depth:height)/WINDOW_INTERIOR.height);
 }
 return geometry;
}

const WINDOW_ROOM_GLSL=`
 varying vec3 vWindowView;
 vec3 windowRoom(vec2 coordinate,vec3 view,float seed){
  vec3 origin=vec3(fract(coordinate),0.);
  // The room extends inward from the window. View components are measured
  // in its horizontal, vertical and outward-normal basis, in world metres.
  vec3 ray=vec3(-view.xy,abs(view.z))/vec3(2.45,3.3,2.6);
  vec3 safeRay=mix(vec3(-1.),vec3(1.),step(vec3(0.),ray))*max(abs(ray),vec3(.0001));
  vec3 distances=(step(vec3(0.),ray)-origin)/safeRay;
  float travel=min(distances.x,min(distances.y,distances.z));
  vec3 hit=clamp(origin+ray*travel,0.,1.);
  float back=step(distances.z,min(distances.x,distances.y));
  float horizontal=step(distances.y,min(distances.x,distances.z));
  float floorHit=horizontal*(1.-step(.5,hit.y));
  vec3 wall=mix(vec3(.79,.70,.55),vec3(.62,.72,.75),seed);
  vec3 room=wall*mix(.56,1.,back)*mix(1.,.40,floorHit);
  // Rear-wall cabinet and picture silhouettes add quiet room-scale cues.
  // Their visibility follows the traced wall, not the window surface.
  float cabinet=back*step(.16,hit.x)*step(hit.x,.78)*step(.10,hit.y)*step(hit.y,.32);
  float picture=back*step(.25+seed*.14,hit.x)*step(hit.x,.64+seed*.14)*step(.49,hit.y)*step(hit.y,.74);
  room=mix(room,vec3(.16,.19,.19),cabinet*.78);
  room=mix(room,mix(vec3(.28,.33,.30),vec3(.43,.30,.21),seed),picture*.78);
  // Blinds remain at the aperture, so the room moves correctly behind them.
  float blind=step(.84-seed*.20,origin.y)*step(.60,seed);
  room=mix(room,wall*.73,blind);
  return room;
 }
`;

function addWindowView(shader){
 shader.vertexShader='varying vec3 vWindowView;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
  mat4 windowWorld=modelMatrix;
  #ifdef USE_INSTANCING
   windowWorld=windowWorld*instanceMatrix;
  #endif
  float windowWall=1.-step(.5,abs(normal.y));
  vec3 windowTangent=mix(vec3(1.,0.,0.),vec3(normal.z,0.,-normal.x),windowWall);
  vec3 windowRight=normalize(mat3(windowWorld)*windowTangent);
  vec3 windowUp=normalize(mat3(windowWorld)*vec3(0.,1.,0.));
  vec3 windowNormal=normalize(mat3(windowWorld)*normal);
  vec3 windowPosition=(windowWorld*vec4(position,1.)).xyz;
  vec3 windowView=cameraPosition-windowPosition;
  vWindowView=vec3(dot(windowView,windowRight),dot(windowView,windowUp),dot(windowView,windowNormal));
 `);
 shader.fragmentShader=WINDOW_ROOM_GLSL+shader.fragmentShader;
}

export function windowInteriorGlassMaterial({night=false}={}){
 const material=new THREE.MeshStandardMaterial({color:'white',vertexColors:true,metalness:.5,roughness:.23,emissive:'#cfb07a',emissiveIntensity:night?.45:.02});
 material.userData.windowInterior={...WINDOW_INTERIOR,extraTextures:0,extraDraws:0};
 material.onBeforeCompile=shader=>{
  addWindowView(shader);
  shader.vertexShader='varying vec2 vWindowCoord;varying float vWindowSeed;varying float vWindowWall;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vWindowCoord=uv;
  `).replace('#include <project_vertex>',`
   vec3 windowOrigin=windowPosition-windowRight*((uv.x-.5)*2.45)-windowUp*((uv.y-.5)*3.3);
   vWindowSeed=dot(floor(windowOrigin.xz*.25+.5),vec2(1.,13.37));
   vWindowWall=windowWall;
   #include <project_vertex>
  `);
  shader.fragmentShader='varying vec2 vWindowCoord;varying float vWindowSeed;varying float vWindowWall;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float roomNear=1.-smoothstep(45.,100.,length(vViewPosition));
   vec3 roomAppearance=vec3(1.);
   if(vWindowWall>.5&&roomNear>0.){
    float roomSeed=fract(sin(vWindowSeed+dot(floor(vWindowCoord),vec2(21.13,7.7)))*19421.7);
    roomAppearance=mix(vec3(1.),windowRoom(vWindowCoord,vWindowView,roomSeed),roomNear);
    diffuseColor.rgb*=mix(vec3(1.),roomAppearance,.7);
   }
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=roomAppearance;');
 };
 material.customProgramCacheKey=()=>`window-interior-glass-v1-${night?'night':'day'}`;
 return material;
}

/** Metre-scaled curtain wall / masonry bays. Glass, mullions, stone floor
 * spandrels and unlit rooms respond differently to the existing scene light. */
export function architecturalFacadeMaterial({night=false}={}) {
  const material=new THREE.MeshStandardMaterial({color:'#bfc7c8',metalness:.18,roughness:.65});
  material.userData.windowInterior={...WINDOW_INTERIOR,extraTextures:0,extraDraws:0};
  material.onBeforeCompile=shader=>{
    addWindowView(shader);
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
      float roomNear=1.-smoothstep(45.,100.,length(vViewPosition));
      vec3 roomAppearance=vec3(1.);
      if(pane>.5&&roomNear>0.){
        roomAppearance=mix(vec3(1.),windowRoom(vFacade,vWindowView,variation),roomNear);
        glass*=mix(vec3(1.),roomAppearance,.7);
      }
      diffuseColor.rgb*=mix(stone,glass,pane);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.20,.23,.24),pane*mullion*.85);
      diffuseColor.rgb+=sill*.09;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.83,.24,pane);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(.04,.40,pane);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      totalEmissiveRadiance+=vec3(.65,.39,.16)*pane*step(.72,variation)*${night?'.55':'.025'}*roomAppearance;
    `);
  };
  material.customProgramCacheKey=()=>`camber-authored-facades-v4-${night?'night':'day'}`;return material;
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
