import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { TRACK, sampleTrack, projectOnTrack } from './track.js';
import { RIVAL_GRID } from './rivals.js';
import { cornerApproachMarkers } from './track-details.js';
import { createCrowd } from './crowd.js';
import { createTracksideServices,tracksideServiceLayout } from './trackside-services.js';
import { broadleafCrownGeometry, coniferBoughGeometry } from './vegetation-geometry.js';
import { createMountainVenue, DESTINATION_PROFILES } from './mountain-venue.js';
import { ORIGINAL_VENUE_PROFILES, originalLandmarkLayout, createOriginalLandmarks } from './original-venues.js';
import {createSpatialInstances,createDistanceDetail} from './spatial-detail.js';
import {applyShowcaseSurface,createShowcaseVenue,showcaseLayout,showcaseApproachLayout} from './showcase-venues.js';
import { createCinematicBackdrop, CINEMATIC_BACKDROP_GLSL } from './cinematic-backdrop.js';
import {venueLighting} from './showcase-lighting.js';
import {createEnvironmentResource} from './environment-resource.js';
import {createTrackSurfaceLibrary,roadSurfaceMaterial,concreteSurfaceMaterial,pavingSurfaceMaterial,foliageSurfaceMaterial,barrierProfileGeometry,architecturalFacadeMaterial} from './track-surface-materials.js';
import {createCoastalDistrict,coastalGroundAt,createDistrictParcels,createRoadVerge,createInlandRelief} from './venue-groundworks.js';
import {createArchitecturalDetails,createTerrainRelief,createRoadEdgeDetails,streetscapeLayout,createWaterfrontGrounding,restrainedPavementMaterial,createAccessRailGeometry} from './track-world-detail.js';

const TAU = Math.PI * 2;
const ORIGINAL_VENUES = new Set(['harbor', 'dockyard', 'coast', 'summit', 'grandprix']);
const VENUE_ENVIRONMENTS = {
 coastal: { water:true, night:false, background:'#263750', fog:'#344052', fogDensity:.00115, sky:'#82a6d4', bounce:'#4a3833', ambient:1, sun:'#ffb679', sunlight:1.35, sunHeight:72, fill:'#88b9ef', fillIntensity:.68, ground:'#192733', horizon:'#2e3d51', horizonScale:1, vegetation:'palms', towers:48, skyStyle:0 },
 urban: { water:false, night:true, background:'#111e37', fog:'#22344b', fogDensity:.00135, sky:'#769cd0', bounce:'#35404f', ambient:1.05, sun:'#a7c8ed', sunlight:.68, sunHeight:100, fill:'#87bcdb', fillIntensity:.80, ground:'#35434c', horizon:'#263d52', horizonScale:.65, vegetation:'street-trees', towers:105, skyStyle:1 },
 desert: { water:false, night:false, background:'#b8a88b', fog:'#bba88d', fogDensity:.0008, sky:'#e0dccb', bounce:'#a98561', ambient:1.30, sun:'#ffe0aa', sunlight:1.65, sunHeight:145, fill:'#aabed0', fillIntensity:.45, ground:'#a18a65', horizon:'#8b7861', horizonScale:1.2, vegetation:'desert-rocks', towers:0, skyStyle:2 },
 parkland: { water:false, night:false, background:'#789cb4', fog:'#9eb3b7', fogDensity:.00085, sky:'#c7dfeb', bounce:'#66755d', ambient:1.25, sun:'#ffedc9', sunlight:1.45, sunHeight:160, fill:'#b3d0e0', fillIntensity:.45, ground:'#506447', horizon:'#60796f', horizonScale:1.1, vegetation:'woodland', towers:0, skyStyle:3 },
};

// Existing five circuits keep their terrain and scenery. Regional grades now
// coordinate every circuit, with scenery scaled to its actual arcade bounds.
export function getVenueProfile(track = TRACK) {
 const original = ORIGINAL_VENUES.has(track.id);
 const environment = original ? 'coastal' : Object.hasOwn(VENUE_ENVIRONMENTS, track.environment) ? track.environment : 'parkland';
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const p of track.samples){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}
 const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
 let radius=0;for(const p of track.samples)radius=Math.max(radius,Math.hypot(p.x-centerX,p.z-centerZ));
 return {...VENUE_ENVIRONMENTS[environment],...ORIGINAL_VENUE_PROFILES[track.scenery],...DESTINATION_PROFILES[track.id],...venueLighting(track),environment,original,centerX,centerZ,radius,
  horizonRadius:original?990:Math.max(990,radius+480),groundRadius:Math.max(1400,radius+650)};
}

// Every new tree/rock/building uses a conservative circular footprint tested
// against the whole circuit, and stays clear of the spectator structures.
export function venueSceneryLayout(track=TRACK,{low=false}={}) {
 const profile=getVenueProfile(track);if(profile.original)return [];
 const seed=[...track.id].reduce((sum,char)=>(Math.imul(sum,31)+char.charCodeAt(0))|0,173),rng=random(seed),stands=grandstandLayout(track),items=[];
 const landmarks=[...originalLandmarkLayout(track,{stands,low}),...showcaseLayout(track,{stands})];
 const count=low?74:118;
 for(let i=0;i<count;i++){
  const p=sampleTrack(track.length*(i+.35)/count,track),side=i%2?1:-1;
  const kind=profile.environment==='desert'||track.scenery==='breakwater'?'rock':profile.environment==='urban'?(i%3?'building':'tree'):'tree';
  const radius=kind==='building'?10+rng()*7:kind==='rock'?4+rng()*8:3+rng()*1.5;
  const offset=side*(track.width/2+radius+15+rng()*(kind==='building'?35:31));
  const x=p.x+p.nx*offset,z=p.z+p.nz*offset;
  if(track.id==='san-francisco-hills'&&p.s/track.length>.225&&p.s/track.length<.345)continue;
  if(projectOnTrack(x,z,undefined,track).distance < track.width/2+radius+7)continue;
  if(stands.some(stand=>Math.hypot(x-stand.x,z-stand.z)<radius+14))continue;
  if(landmarks.some(item=>Math.hypot(x-item.x,z-item.z)<radius+item.radius+4))continue;
  if(items.some(item=>Math.hypot(x-item.x,z-item.z)<radius+item.radius+3))continue;
  items.push({kind,x,z,radius,height:kind==='building'?16+rng()*44:kind==='rock'?radius*(.5+rng()*.6):6+rng()*8,yaw:Math.atan2(p.tx,p.tz),shade:rng()});
 }
 return items;
}

function random(seed = 81) { let s = seed; return () => ((s = Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296; }
const box = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D();
function canvasTexture(width, height, draw) {
 const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d'), width, height);
 const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Both the driving surface and the reflector wind upwards. The reflector's
// local +Z plane rotates to world +Y; its UVs retain metres along the track.
function roadGeometry(width, flat = false, metres = false) {
 const positions = [], uv = [], indices = [], samples = TRACK.samples;
 for (let i = 0; i <= samples.length; i++) {
  const v = samples[i % samples.length], s = i === samples.length ? TRACK.length : v.s;
  for (const side of [-1, 1]) { const x = v.x + v.nx * width * .5 * side, z = v.z + v.nz * width * .5 * side; positions.push(x, flat ? -z : (v.y || 0), flat ? 0 : z); uv.push(metres ? (side+1)*width/6 : (side+1)/2, metres ? s/3 : s/14); }
  if (i < samples.length) { const j = i * 2; indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
 }
 const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
function ribbon(offset, width, height, material) {
 const positions = [], uv = [], indices = [];
 for (let i = 0; i <= TRACK.samples.length; i++) {
  const v = TRACK.samples[i % TRACK.samples.length], distance=i===TRACK.samples.length?TRACK.length:v.s;
  for (const w of [-width/2,width/2]) {positions.push(v.x+v.nx*(offset+w),height+(v.y||0),v.z+v.nz*(offset+w));uv.push((w+width/2)/3,distance/3);}
  if (i < TRACK.samples.length) {const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return new THREE.Mesh(g,material);
}
function terrainUV(geometry,centerX=0,centerZ=0,metres=90) {
 const p=geometry.attributes.position,uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){uv[i*2]=(p.getX(i)+centerX)/metres;uv[i*2+1]=(-p.getY(i)+centerZ)/metres;}
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geometry;
}

function instances(scene, geo, mat, list) {
 return createSpatialInstances(scene,geo,mat,list);
}

function segment(list, a, b, radius) {
 const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), delta = vb.clone().sub(va), mid = va.clone().add(vb).multiplyScalar(.5);
 dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()); list.push({ x: mid.x, y: mid.y, z: mid.z, sx: radius, sy: delta.length(), sz: radius, rx: dummy.rotation.x, ry: dummy.rotation.y, rz: dummy.rotation.z });
}

// Stand footprints, not just their centres, must clear every part of the road.
// This also prevents a stand beside one straight intruding into a nearby bend.
export function grandstandLayout(track = TRACK) {
 const stands = [];
 for (const distance of track.id === 'grandprix' ? [20] : [23, 50, 77]) for (const side of [-1, 1]) {
  const p = sampleTrack(distance, track), offset = side * (track.width / 2 + 10.7);
  const x = p.x + p.nx * offset, z = p.z + p.nz * offset;
  const footprint = [];
  for (let across = -4; across <= 4; across += 2) for (let along = -10; along <= 10; along += 2) {
   footprint.push({ x: x + p.nx * across + p.tx * along, z: z + p.nz * across + p.tz * along });
  }
  if (footprint.some(point => projectOnTrack(point.x, point.z, undefined, track).distance < track.width / 2 + 4.2)) continue;
  stands.push({ x, y:p.y||0, z, yaw: Math.atan2(p.tx, p.tz), side, distance, footprint });
 }
 return stands;
}

const noiseGLSL = `
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y); }
float noise21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float f=0.;f+=noise21(p)*.5;p=mat2(.8,-.6,.6,.8)*p*2.13;f+=noise21(p)*.25;p=p*2.17+7.2;f+=noise21(p)*.125;f+=noise21(p*2.07)*.0625;return f;}
`;

function palmFrondGeometry() {
 const positions = [], colors = [];
 const spine = t => new THREE.Vector3(t * 4.5, Math.sin(t * Math.PI) * .9 - t * t * 1.7, 0);
 function triangle(a, b, c, shade) { positions.push(...a.toArray(), ...b.toArray(), ...c.toArray()); for (let i = 0; i < 3; i++) colors.push(.024 * shade, .065 * shade, .032 * shade); }
 for (let i = 0; i < 22; i++) {
  const t = i / 22, next = (i + 1) / 22, a = spine(t), b = spine(next), width = .035 * (1 - t) + .012;
  triangle(a.clone().add(new THREE.Vector3(0, 0, width)), b, a.clone().add(new THREE.Vector3(0, 0, -width)), 1.15);
  if (i < 2) continue;
  for (const side of [-1, 1]) {
   const spread = Math.sin(Math.PI * t) ** .7 * .82;
   const tip = spine(Math.min(1, t + .14)).add(new THREE.Vector3(.1, -.12 - spread * .30, side * spread));
   const ridge = a.clone().lerp(tip, .45); ridge.y += .075;
   const root = spine(Math.min(1, t + .052));
   triangle(a, ridge, tip, .84 + t * .22); triangle(ridge, root, tip, 1.08 - t * .1);
  }
 }
 const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); return g;
}


export function createWorld(renderer, { low = false, reducedMotion = false } = {}) {
 const summit = TRACK.id === 'summit', grandPrix = TRACK.id === 'grandprix', venue = getVenueProfile(TRACK);
 const rng = random(), crowdRng = random(124), crowd = createCrowd({low, reducedMotion}), scene = new THREE.Scene(); scene.background = new THREE.Color(venue.background); scene.fog = new THREE.FogExp2(venue.fog,venue.fogDensity);
 scene.userData.venueEnvironment={type:venue.environment,original:venue.original,night:venue.night,water:venue.water};
 const surfaces=createTrackSurfaceLibrary({low,anisotropy:renderer.capabilities.getMaxAnisotropy()});scene.userData.trackSurfaces=surfaces.status;
 const frontageBuildings=[],terrainOccupied=[];
 scene.add(new THREE.HemisphereLight(venue.sky,venue.bounce,venue.ambient));
 const sun = new THREE.DirectionalLight(venue.sun,venue.sunlight); sun.position.set(-180,venue.sunHeight,130); sun.castShadow = true; sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 360 }); sun.shadow.bias = -.00065; sun.shadow.normalBias = .015; scene.add(sun, sun.target);
 const fill = new THREE.DirectionalLight(venue.fill,venue.fillIntensity); fill.position.set(20, 45, -30); scene.add(fill);
 const backdrop = createCinematicBackdrop({track:TRACK,venue,low,reducedMotion});
 scene.userData.cinematicBackdrop = backdrop.status;
 const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: {venueStyle:{value:venue.skyStyle},...backdrop.uniforms}, vertexShader: 'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.);}', fragmentShader: `${noiseGLSL}
 ${CINEMATIC_BACKDROP_GLSL}
 varying vec3 vPosition;uniform float venueStyle;
 void main(){
  vec3 d=normalize(vPosition);float y=d.y;float sunset=pow(max(0.,dot(normalize(d.xz),normalize(vec2(-.8,.65)))),3.);
  vec3 horizon=mix(vec3(.19,.105,.15),vec3(.85,.235,.065),sunset*.7+.22);
  vec3 col=mix(horizon,vec3(.038,.087,.18),smoothstep(-.01,.28,y));col=mix(col,vec3(.012,.035,.086),smoothstep(.20,.87,y));
  col+=vec3(.36,.09,.024)*sunset*exp(-pow((y-.035)*19.,2.));
  // A broad blue opening in the sky supplies an outdoor rim reflection.
  col+=vec3(.065,.13,.255)*pow(max(0.,dot(d,normalize(vec3(.15,.75,-.55)))),4.);
  // Warped, anisotropic cloud wisps use several scales instead of broad noise blobs.
  vec2 p=d.xz/max(.16,y+.22)*vec2(2.6,4.4);p+=vec2(fbm(p*.65),fbm(p*.65+12.))*1.25;
  float cloud=fbm(p*2.4+6.);float detail=noise21(p*8.4);float cover=smoothstep(.45,.80,cloud+detail*.08);
  cover*=smoothstep(.025,.12,y)*(1.-smoothstep(.48,.88,y));
  vec3 cloudColor=mix(vec3(.025,.047,.089),vec3(.14,.075,.096),sunset*(1.-smoothstep(.02,.3,y)));
  col=mix(col,cloudColor,cover*.34);col+=vec3(.16,.074,.048)*sunset*smoothstep(.45,.55,cloud)*(1.-smoothstep(.55,.64,cloud))*(1.-smoothstep(.1,.35,y))*.35;
  if(venueStyle>.5){
   if(venueStyle<1.5){
    col=mix(vec3(.075,.115,.19),vec3(.009,.023,.059),smoothstep(-.02,.75,y));
    col+=vec3(.10,.12,.16)*pow(max(0.,dot(d,normalize(vec3(-.3,.65,.4)))),28.);
    col=mix(col,vec3(.035,.053,.091),cover*.25);
   }else if(venueStyle<2.5){
    col=mix(vec3(.64,.49,.31),vec3(.20,.36,.48),smoothstep(-.04,.66,y));
    col+=vec3(.26,.16,.07)*pow(max(0.,dot(d,normalize(vec3(-.8,.46,.65)))),24.);
    col=mix(col,vec3(.55,.51,.42),cover*.16);
   }else{
    col=mix(vec3(.51,.62,.62),vec3(.095,.28,.43),smoothstep(-.05,.82,y));
    col=mix(col,vec3(.66,.71,.69),cover*.72);
    col+=vec3(.10,.105,.07)*pow(max(0.,dot(d,normalize(vec3(-.8,.6,.65)))),18.);
   }
  }
  col=cinematicBackdrop(col,d);
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }` })); sky.name='cinematic-distant-sky';sky.frustumCulled=false;scene.add(sky);
 const environmentScene = new THREE.Scene(); environmentScene.add(sky.clone());
 const environment=createEnvironmentResource(scene,()=>{
  if(renderer.getContext?.().isContextLost())return null;
  const amount=backdrop.uniforms.cinematicAmount.value,pmrem=new THREE.PMREMGenerator(renderer);
  if(backdrop.status.state==='ready')backdrop.uniforms.cinematicAmount.value=1;
  try{return pmrem.fromScene(environmentScene,.045,.1,2000,{size:low?128:256});}
  finally{backdrop.uniforms.cinematicAmount.value=amount;pmrem.dispose();}
 });
 environment.rebuild();scene.environmentIntensity=venue.environmentIntensity??.72;
 backdrop.ready.then(ready=>{if(ready)environment.rebuild();}).catch(()=>{/* Context restoration retries the owned environment resource. */});
 const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } }, vertexShader: 'varying vec3 p;void main(){vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}', fragmentShader: `${noiseGLSL}
 varying vec3 p;uniform float time;
 float heightAt(vec2 p){return sin(dot(p,vec2(.43,.31))+time*.45)*.12+sin(dot(p,vec2(-.7,.29))-time*.57)*.075+sin(dot(p,vec2(.21,1.1))+time*.67)*.034+(fbm(p*.75+vec2(time*.04,-time*.05))-.45)*.13;}
 void main(){
  vec2 q=p.xz;float h=heightAt(q);vec3 normal=normalize(vec3((h-heightAt(q+vec2(.16,0)))*2.3,1.,(h-heightAt(q+vec2(0,.16)))*2.3));
  vec3 view=normalize(cameraPosition-p),r=reflect(-view,normal);float fresnel=pow(1.-max(0.,dot(view,normal)),3.);
  vec3 reflected=mix(vec3(.045,.065,.11),vec3(.009,.027,.058),smoothstep(0.,.48,r.y));
  float facing=pow(max(0.,dot(normalize(r.xz),normalize(vec2(-.8,.65)))),18.);
  reflected+=vec3(.32,.095,.023)*facing*exp(-abs(r.y-.045)*9.);
  float sparkle=pow(max(0.,dot(r,normalize(vec3(-.8,.11,.65)))),120.)*(.45+noise21(q*3.1)*.55);
  vec3 color=mix(vec3(.005,.021,.034),reflected,fresnel*.8+.1)+vec3(1.,.51,.17)*sparkle*.60;
  color+=vec3(.014,.04,.060)*smoothstep(.035,.17,h)*(.25+fbm(q*.16)*.5);
  float distanceToCamera=length(cameraPosition-p);color=mix(color,vec3(.044,.063,.098),1.-exp(-distanceToCamera*.00075));
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }` })); sea.rotation.x = -Math.PI / 2; sea.position.y = -.65; sea.visible=venue.water; scene.add(sea);

 const base = new THREE.Mesh(roadGeometry(TRACK.width + 11), new THREE.MeshStandardMaterial({ color: venue.environment==='desert'?'#736855':'#303a43', roughness: .9 })); base.position.y = -.10; scene.add(base);
 if(TRACK.scenery==='breakwater'){
  // A submerged sea-wall foundation gives the causeway thickness at water level.
  const foundations=[];
  for(let s=0;s<TRACK.length;s+=5){const p=sampleTrack(s);foundations.push({x:p.x,y:-.56,z:p.z,sx:TRACK.width+10.9,sy:.90,sz:5.12,ry:Math.atan2(p.tx,p.tz)});}
  instances(scene,box,new THREE.MeshStandardMaterial({color:'#555e61',roughness:.96}),foundations);
 }
 const road = new THREE.Mesh(roadGeometry(TRACK.width,false,true),roadSurfaceMaterial(surfaces.maps)); road.position.y = .011; road.receiveShadow = true; applyShowcaseSurface(road,TRACK); scene.add(road);
 const wetShader = {
  name: 'RainPolishedAsphalt', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: `uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vWorld;void main(){vUv=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform vec3 color;uniform sampler2D tDiffuse;varying vec4 vUv;varying vec3 vWorld;${noiseGLSL}
  void main(){vec2 q=vWorld.xz;float fine=noise21(q*7.);float wet=smoothstep(.29,.70,fbm(q*.24));vec4 projected=vUv;projected.xy+=vec2(noise21(q*3.1)-.5,noise21(q*4.2+8.)-.5)*.0012*projected.w;vec2 sampleUV=projected.xy/projected.w;float softness=.0008+(1.-wet)*.0015;vec3 reflected=texture2D(tDiffuse,sampleUV).rgb*.5;reflected+=(texture2D(tDiffuse,sampleUV+vec2(softness,0)).rgb+texture2D(tDiffuse,sampleUV-vec2(softness,0)).rgb+texture2D(tDiffuse,sampleUV+vec2(0,softness)).rgb+texture2D(tDiffuse,sampleUV-vec2(0,softness)).rgb)*.125;float grazing=pow(1.-clamp(normalize(cameraPosition-vWorld).y,0.,1.),2.);float alpha=(.004+wet*.038)*(.18+grazing*.82);gl_FragColor=vec4(reflected*vec3(.81,.88,.97)*( .9+fine*.1),alpha);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`
 };
 const reflection = new Reflector(roadGeometry(TRACK.width, true), { textureWidth: low ? 512 : 1024, textureHeight: low ? 512 : 1024, color: 0x708699, multisample: low ? 0 : 2, clipBias: .003, shader: wetShader }); reflection.rotation.x = -Math.PI / 2; reflection.position.y = .026; reflection.material.transparent = true; reflection.material.depthWrite = false; reflection.renderOrder = 0; reflection.visible=!TRACK.elevationProfile&&venue.environment!=='desert'&&venue.environment!=='parkland'; scene.add(reflection);
 const white = new THREE.MeshBasicMaterial({ color: '#97a7aa' }), cyan = new THREE.MeshBasicMaterial({ color: '#34d8e9', toneMapped: false }), concrete = new THREE.MeshStandardMaterial({ color: '#596571', roughness: .82 }), metal = new THREE.MeshStandardMaterial({ color: '#15212c', metalness: .72, roughness: .35 }), warm = new THREE.MeshBasicMaterial({ color: '#ffd19a', toneMapped: false });
 warm.color.multiplyScalar(2.4); cyan.color.multiplyScalar(1.5);
 const sidewalk=pavingSurfaceMaterial(surfaces.maps,{color:venue.environment==='desert'?'#b4a384':venue.environment==='parkland'?'#929887':'#a1aaab'});
 for (const side of [-1, 1]) { const walk=ribbon(side * (TRACK.width / 2 + 3.1),4.6,-.02,sidewalk);walk.geometry.attributes.uv.array.forEach((v,i,a)=>{a[i]=v*3/2.12;});scene.add(walk); scene.add(ribbon(side * (TRACK.width / 2 - .5), .10, .049, white)); scene.add(ribbon(side * (TRACK.width / 2 + .62), .038, 1.06, cyan)); }
 const barriers = [], rails = [], dashes = [], posts = [], bulbs = [], arms = [], chevrons = [], leftChevrons = [], straightMarkers = [], joints = [], railingUprights = [];
 const accessGaps=showcaseLayout(TRACK,{stands:grandstandLayout()}).filter(site=>showcaseApproachLayout(TRACK,site)).map(site=>({side:site.side,s:site.s,halfLength:1.4}));
 const panelTexture = canvasTexture(256, 128, c => { c.fillStyle = '#091b25'; c.fillRect(0, 0, 256, 128); c.strokeStyle = '#35e1f2'; c.lineWidth = 17; for (let x = 60; x < 200; x += 70) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x + 34, 64); c.lineTo(x, 98); c.stroke(); } });
 for (let s = 0; s < TRACK.length; s += 5) {
  const v = sampleTrack(s), angle = Math.atan2(v.tx, v.tz), step = Math.floor(s / 5),gradePose={rx:-Math.atan(v.grade||0),order:'YXZ'};
  for (const side of [-1, 1]) {
   const o = side * (TRACK.width / 2 + .7), x = v.x + v.nx * o, z = v.z + v.nz * o;
   barriers.push({ x, z, y: v.y+.49, sx: .66, sy: .98, sz: 4.97, ry: angle,...gradePose, color: step % 7 === 0 ? '#b0b6b1' : '#d3d3c9' });
   rails.push({ x, z, y: v.y+1.085, sx: .14, sy: .09, sz: 5.05, ry: angle,...gradePose });
   joints.push({ x, z, y: v.y+.43, sx: .68, sy: .8, sz: .028, ry: angle,...gradePose });
   if (step % 2 === 0&&!accessGaps.some(gap=>gap.side===side&&Math.min(Math.abs(s-gap.s),TRACK.length-Math.abs(s-gap.s))<gap.halfLength+.08)) { const edge = side * (TRACK.width / 2 + 5.1); railingUprights.push({ x: v.x + v.nx * edge, z: v.z + v.nz * edge, y: v.y+.46, sx: .07, sy: .96, sz: .07 }); }
  }
  if (step % 2 === 0) dashes.push({ x: v.x, z: v.z, y: v.y+.052, sx: .085, sy: .004, sz: 2.3, ry: angle,...gradePose });
  if (step % 7 === 0) { const o = TRACK.width / 2 + 2.4, x = v.x + v.nx * o, z = v.z + v.nz * o; posts.push({ x, y: v.y+3.75, z, sx: .105, sy: 7.5, sz: .105 }); segment(arms, [x, v.y+7.3, z], [x - v.nx * 1.65, v.y+7.65, z - v.nz * 1.65], .08); bulbs.push({ x: x - v.nx * 1.65, y: v.y+7.59, z: z - v.nz * 1.65, sx: .75, sy: .065, sz: .32, ry: angle }); }
  if (step % 5 === 0) {
   const ahead = sampleTrack(s + 24), bend = Math.atan2(ahead.tx * v.tz - ahead.tz * v.tx, ahead.tx * v.tx + ahead.tz * v.tz);
   for (const side of [-1, 1]) {
    const o = side * (TRACK.width / 2 + .355), straight = Math.abs(bend) < .10;
    // +local X is driver-left, so positive yaw curvature needs a LEFT glyph.
    // Face approaching traffic, angled inward, rather than showing mirrored
    // backs of parallel barrier signs. Local panel +X then reads driver-right
    // on either road edge, independent of the side on which it is mounted.
    const panel = { x: v.x + v.nx * o, y: v.y+.58, z: v.z + v.nz * o, ry: straight ? angle + (side === 1 ? -Math.PI / 2 : Math.PI / 2) : angle + Math.PI + side * Math.PI / 4 };
    (straight ? straightMarkers : bend > 0 ? leftChevrons : chevrons).push(panel);
   }
  }
 }
 instances(scene,barrierProfileGeometry(),concreteSurfaceMaterial(surfaces.maps,{color:'#b8bdba'}),barriers); instances(scene, box, metal, rails); instances(scene, box, new THREE.MeshStandardMaterial({ color: '#24313d', roughness: .9 }), joints); instances(scene, box, white, dashes); instances(scene, box, metal, posts); instances(scene, new THREE.CylinderGeometry(1, 1, 1, 6), metal, arms); instances(scene, box, warm, bulbs); instances(scene, box, metal, railingUprights);
 scene.userData.showcaseAccessGaps=accessGaps;
 for(const side of [-1,1])for(const [width,height]of [[.055,.93],[.035,.49]]){
  const gaps=accessGaps.filter(gap=>gap.side===side),offset=side*(TRACK.width/2+5.1);
  scene.add(gaps.length?new THREE.Mesh(createAccessRailGeometry(TRACK,offset,width,height,gaps),metal):ribbon(offset,width,height,metal));
 }
 const leftPanelTexture = panelTexture.clone(); leftPanelTexture.wrapS = THREE.RepeatWrapping; leftPanelTexture.repeat.x = -1; leftPanelTexture.needsUpdate = true;
 instances(scene, new THREE.PlaneGeometry(1.75, .65), new THREE.MeshBasicMaterial({ map: panelTexture, side: THREE.FrontSide, toneMapped: false }), chevrons);
 instances(scene, new THREE.PlaneGeometry(1.75, .65), new THREE.MeshBasicMaterial({ map: leftPanelTexture, side: THREE.FrontSide, toneMapped: false }), leftChevrons);
 instances(scene, new THREE.PlaneGeometry(.075, .58), cyan, straightMarkers);
 // Painted kerbs, grid boxes and braking boards make the course read as a
 // deliberate asphalt circuit. Markings remain above the thin puddle layer.
 const kerbs=[], gridMarks=[];
 for(let distance=5;distance<TRACK.length;distance+=1.35){
  const p=sampleTrack(distance),ahead=sampleTrack(distance+12);
  const bend=Math.atan2(ahead.tx*p.tz-ahead.tz*p.tx,ahead.tx*p.tx+ahead.tz*p.tz);
  if(Math.abs(bend)<.055)continue;
  const side=Math.sign(bend),offset=side*(TRACK.width/2-.9);
  kerbs.push({x:p.x+p.nx*offset,z:p.z+p.nz*offset,y:p.y+.064,sx:.72,sy:.028,sz:1.34,ry:Math.atan2(p.tx,p.tz),rx:-Math.atan(p.grade||0),order:'YXZ',color:Math.floor(distance/1.35)%2?'#dcded8':'#ce4838'});
 }
 instances(scene,box,new THREE.MeshStandardMaterial({color:'white',roughness:.89}),kerbs);
 const cornerBoards=cornerApproachMarkers(TRACK,{stands:grandstandLayout(),limit:low?6:8});
 scene.userData.cornerApproachMarkers=cornerBoards;
 const markerPosts=cornerBoards.map(p=>({x:p.x,z:p.z,y:sampleTrack(p.s||0).y+.88,sx:.09,sy:1.76,sz:.09,ry:p.yaw}));
 if(markerPosts.length)instances(scene,box,metal,markerPosts);
 for(const distance of [100,50]){
  const markers=cornerBoards.filter(p=>p.distance===distance).map(p=>({x:p.x,z:p.z,y:sampleTrack(p.s).y+1.65,ry:p.yaw}));
  if(!markers.length)continue;
  const art=canvasTexture(256,256,(c,w,h)=>{
   c.fillStyle='#eef1e9';c.fillRect(0,0,w,h);c.fillStyle='#17212a';c.fillRect(12,12,w-24,6);c.fillRect(12,h-18,w-24,6);
   c.textAlign='center';c.textBaseline='middle';c.font='800 112px "Barlow Condensed", sans-serif';c.fillText(String(distance),w/2,h*.48);
   c.font='700 25px "Barlow Condensed", sans-serif';c.fillText('METRES',w/2,h*.78);
  });
  instances(scene,new THREE.PlaneGeometry(.95,1.05),new THREE.MeshBasicMaterial({map:art,side:THREE.FrontSide}),markers);
 }

 const finish = sampleTrack(0), checkers = [], checkerColumns = Math.round(TRACK.width / .5);
 for (let row = 0; row < 4; row++) for (let col = 0; col < checkerColumns; col++) {
  const across = (col - (checkerColumns - 1) / 2) * .5, along = (row - 1.5) * .5;
  checkers.push({ x: finish.x + finish.nx * across + finish.tx * along, z: finish.z + finish.nz * across + finish.tz * along, y: finish.y+.061, sx: .5, sy: .006, sz: .5, ry: Math.atan2(finish.tx, finish.tz), color: (col + row) % 2 ? '#17202a' : '#e8eeeb' });
 }
 instances(scene, box, new THREE.MeshBasicMaterial({ color: 'white' }), checkers);
 // Grid paint follows every actual staggered starting position, including expanded fields.
 const startingGrid = [{ s: 0, lane: 0 }, ...RIVAL_GRID].sort((a, b) => b.s - a.s);
 const gridCount=startingGrid.length;
 const gridTexture = canvasTexture(128*gridCount, 128, (c, w, h) => {
  c.clearRect(0, 0, w, h); c.fillStyle = '#e9efec'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 92px Arial';
  for (let n = 1; n <= gridCount; n++) c.fillText(String(n).padStart(2, '0'), (n - .5) * 128, 68);
 });
 scene.userData.startingGridCount=gridCount;
 startingGrid.forEach((grid, index) => {
  const p = sampleTrack(grid.s), angle = Math.atan2(p.tx, p.tz), offset = grid.lane;
  for (const along of [-2.8, 2.8]) gridMarks.push({ x: p.x + p.nx * offset + p.tx * along, z: p.z + p.nz * offset + p.tz * along, y: p.y+.063, sx: 2.85, sy: .006, sz: .11, ry: angle });
  for (const edge of [-1, 1]) gridMarks.push({ x: p.x + p.nx * (offset + edge * 1.425), z: p.z + p.nz * (offset + edge * 1.425), y: p.y+.063, sx: .1, sy: .006, sz: 5.6, ry: angle });
  const numberGeo = new THREE.PlaneGeometry(1.05, 1.05), uv = numberGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) + index) / gridCount);
  const number = new THREE.Mesh(numberGeo, new THREE.MeshBasicMaterial({ map: gridTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  // Driver-right is local -X: rotate the horizontal numeral toward the grid.
  number.rotation.set(-Math.PI / 2, 0, Math.PI + angle); number.position.set(p.x + p.nx * offset - p.tx * 3.6, p.y+.07, p.z + p.nz * offset - p.tz * 3.6); scene.add(number);
 });
 instances(scene, box, new THREE.MeshBasicMaterial({ color: '#e0e6e2' }), gridMarks);
 const finishArch=new THREE.Group();finishArch.position.set(finish.x,finish.y,finish.z);finishArch.rotation.y=Math.atan2(finish.tx,finish.tz);
 for(const side of [-1,1]){
  const upright=new THREE.Mesh(new THREE.BoxGeometry(.6,7.8,.65),metal);upright.position.set(side*(TRACK.width/2+1.5),3.9,0);finishArch.add(upright);
  const foot=new THREE.Mesh(new THREE.BoxGeometry(1.15,.7,1.5),concrete);foot.position.set(side*(TRACK.width/2+1.5),.35,0);finishArch.add(foot);
  for(const z of [-.36,.36]){const led=new THREE.Mesh(new THREE.BoxGeometry(.09,6.8,.04),cyan);led.position.set(side*(TRACK.width/2+1.5),3.9,z);finishArch.add(led);}
 }
 const archTruss = [];
 for (const side of [-1, 1]) {
  const x = side * (TRACK.width / 2 + 1.5);
  for (let y = .8; y < 6.4; y += 1.1) segment(archTruss, [x - .34, y, -.46], [x + .34, y + 1.05, -.46], .044);
 }
 for (let x = -TRACK.width / 2; x < TRACK.width / 2; x += 1.8) segment(archTruss, [x, 8.18, -.33], [x + 1.7, 8.18, .33], .046);
 instances(finishArch, new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshStandardMaterial({ color: '#91a4ad', metalness: .8, roughness: .38 }), archTruss);
 const header=new THREE.Mesh(new THREE.BoxGeometry(TRACK.width+4.1,1.55,.72),metal);header.position.y=7.35;finishArch.add(header);
 const finishArt=canvasTexture(2048,256,(c,w,h)=>{
  c.fillStyle='#07121b';c.fillRect(0,0,w,h);
  c.fillStyle='#65e3f1';c.fillRect(0,0,w,5);c.fillRect(0,h-5,w,5);
  c.font='92px "Racing Sans One", Arial';c.textAlign='center';c.fillStyle='#eef8ff';c.fillText('CAMBER REIGN',w/2,107);
  c.font='700 37px Arial';c.fillStyle='#61ddeb';c.fillText('START / FINISH  ·  '+TRACK.name.toUpperCase(),w/2,180);
  for(const start of [26,w-282])for(let y=0;y<4;y++)for(let x=0;x<5;x++){c.fillStyle=(x+y)%2?'#152a38':'#d5e4e8';c.fillRect(start+x*46,36+y*46,46,46);}
 });finishArt.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const bannerMaterial=new THREE.MeshBasicMaterial({map:finishArt,toneMapped:false});
 for(const side of [-1,1]){const banner=new THREE.Mesh(new THREE.PlaneGeometry(TRACK.width+3.7,1.45),bannerMaterial);banner.position.set(0,7.35,side*.37);if(side<0)banner.rotation.y=Math.PI;finishArch.add(banner);}
 const underside=new THREE.Mesh(new THREE.BoxGeometry(TRACK.width+2.7,.035,.75),cyan);underside.position.y=6.55;finishArch.add(underside);scene.add(finishArch);

 const standLayouts = grandstandLayout(), showcaseSites=showcaseLayout(TRACK,{stands:grandstandLayout()}), standStructure = [], standRoof = [], standSeats = [], standRails = [];
 scene.userData.grandstands = standLayouts.map(({ x, y, z, yaw, side, distance }) => ({ x, y, z, yaw, side, distance }));
 for (const stand of standLayouts) {
  const { x, z, yaw, side, distance } = stand, cos = Math.cos(yaw), sin = Math.sin(yaw);
  const local = (px, py, pz) => ({ x: x + cos * px + sin * pz, y: py + sampleTrack(distance).y, z: z - sin * px + cos * pz, ry: yaw });
  const piece = (list, px, py, pz, sx, sy, sz, color) => list.push({ ...local(px, py, pz), sx, sy, sz, color });
  piece(standStructure, 0, .06, 0, 7.8, .65, 19.8, '#354550');
  for (let row = 0; row < 4; row++) {
   const across = side * (-2.2 + row * 1.13), floor = .62 + row * .63;
   piece(standStructure, across, floor - .19, 0, 1.24, .38, 18.8, '#8c999c');
   for (let seat = -8; seat <= 8; seat++) {
    if (seat === 0) continue; // A clear central aisle breaks up each seating bank.
    const along = seat * 1.035, standing = row === 3 && Math.abs(seat) % 3 === 0;
    if (!standing) {
     piece(standSeats, across, floor + .39, along, .67, .13, .68, (seat + row) % 5 ? '#196776' : '#d2ddd8');
     piece(standSeats, across + side * .28, floor + .64, along, .11, .46, .68, (seat + row) % 5 ? '#196776' : '#d2ddd8');
    }
    if (crowdRng() > .17) {
     const point = local(across, floor, along);
     crowd.add(point.x, point.y, point.z, yaw - side * Math.PI / 2 + (crowdRng() - .5) * .2, !standing, crowdRng);
    }
   }
  }
  for (const along of [-9.6, 0, 9.6]) {
   piece(standRails, side * 3.3, 3.1, along, .14, 6.4, .14);
   if (along !== 0) piece(standRails, -side * 3.3, 2.7, along, .14, 5.6, .14);
  }
  for (const y of [.72, 1.22]) piece(standRails, -side * 3.7, y, 0, .065, .065, 19.6);
  for (const along of [-9.7, 9.7]) piece(standRails, 0, 3.2, along, 7.1, .06, .06);
  piece(standRoof, 0, 6.18, 0, 8.0, .20, 20.0, '#162b3a');
  piece(standRoof, -side * 3.99, 6.08, 0, .055, .27, 20.05, '#58adbb');
 }
 instances(scene, box, new THREE.MeshStandardMaterial({ color: 'white', roughness: .84 }), standStructure);
 instances(scene, box, new THREE.MeshStandardMaterial({ color: 'white', roughness: .59, metalness: .14 }), standRoof);
 instances(scene, box, new THREE.MeshStandardMaterial({ color: 'white', roughness: .79 }), standSeats);
 instances(scene, box, metal, standRails);
 const raceBanner = canvasTexture(1024, 128, (c, w, h) => {
  c.fillStyle = '#122631'; c.fillRect(0, 0, w, h); c.fillStyle = '#46c3d3'; c.fillRect(0, h - 6, w, 6);
  c.fillStyle = '#f0f5ef'; c.font = '58px "Racing Sans One", Arial'; c.textAlign = 'center'; c.fillText('CAMBER REIGN', w / 2, 69);
  c.font = '700 22px Arial'; c.fillStyle = '#8fc8d1'; c.fillText(TRACK.name.toUpperCase(), w / 2, 103);
 });
 const raceBanners = [];
 for (const distance of [10, 42, 74, 106]) for (const side of [-1, 1]) {
  const p = sampleTrack(distance), offset = side * (TRACK.width / 2 + .355);
  raceBanners.push({ x: p.x + p.nx * offset, y: .57, z: p.z + p.nz * offset, ry: Math.atan2(p.tx, p.tz) - side * Math.PI / 2 });
 }
 instances(scene, new THREE.PlaneGeometry(4.45, .59), new THREE.MeshBasicMaterial({ map: raceBanner, toneMapped: false }), raceBanners);

 // Window cells are scaled in metres inside the instanced shader, so tall
 // buildings gain floors rather than stretching the same facade image.
 const towers = [], roofEquipment = [], caps = [], podiums = [], shoreLights = [];
 for (let i = 0; i < (venue.original?(summit ? 18 : low ? 68 : 94):Math.floor(venue.towers*(low?.72:1))); i++) {
  const a = rng() * TAU, radius = (venue.original?280:venue.radius+55) + Math.pow(rng(), .75) * 370, x = Math.sin(a) * radius+(venue.original?0:venue.centerX), z = Math.cos(a) * radius+(venue.original?0:venue.centerZ);
  if (projectOnTrack(x, z).distance < 40) continue;
  const height = 9 + Math.pow(rng(), 2.5) * 110, width = 12 + rng() * 16, depth = 12 + rng() * 18, rotation = Math.floor(rng() * 4) * Math.PI / 2;
  towers.push({ x, z, y: height / 2 - .3, sx: width, sy: height, sz: depth, ry: rotation });
  podiums.push({ x, z, y: 1.5, sx: width + 7, sy: 3.8, sz: depth + 6, ry: rotation });
  if (height > 50) {
   const extra = 3 + rng() * 14; towers.push({ x: x + width * .05, z, y: height + extra / 2 - .3, sx: width * .67, sy: extra, sz: depth * .7, ry: rotation });
   roofEquipment.push({ x, z, y: height + extra + 1, sx: width * .26, sy: 2, sz: depth * .3, ry: rotation });
   if (i % 3 === 0) caps.push({ x: x + width * .05, z, y: height + extra -.22, sx: width * .69, sy: .13, sz: depth * .73, ry: rotation });
  }
  if (i % 3 === 0) shoreLights.push({ x: x - width * .45, z: z - depth * .51, y: 4.2, sx: .3, sy: .22, sz: .4 });
 }
 instances(scene, box, architecturalFacadeMaterial({night:venue.night}), towers); instances(scene, box, new THREE.MeshStandardMaterial({ color: '#202e3b', roughness: .72 }), podiums); instances(scene, box, metal, roofEquipment); instances(scene, box, new THREE.MeshBasicMaterial({ color: '#527f94' }), caps); instances(scene, box, warm, shoreLights);
 frontageBuildings.push(...towers.filter(b=>projectOnTrack(b.x,b.z).distance<180&&b.y-b.sy/2<.5).slice(0,low?16:28));
 terrainOccupied.push(...towers.map(b=>({x:b.x,z:b.z,radius:Math.hypot(b.sx,b.sz)/2+4})));
 const land = new THREE.Mesh(terrainUV(new THREE.RingGeometry(venue.original?216:venue.radius+30,venue.groundRadius,100),venue.original?0:venue.centerX,venue.original?0:venue.centerZ,venue.environment==='urban'?3:90), venue.environment==='urban'?restrainedPavementMaterial(surfaces.maps.asphaltColor):new THREE.MeshStandardMaterial({ color:venue.environment==='urban'?'#929a9b':'#c6c9b5',map:venue.environment==='urban'?surfaces.maps.concreteColor:surfaces.maps.terrainColor, roughness: 1 })); land.rotation.x = -Math.PI / 2; land.position.set(venue.original?0:venue.centerX,-.28,venue.original?0:venue.centerZ); scene.add(land);
 const coastalDistrict=createCoastalDistrict(scene,TRACK,{low,map:surfaces.maps.terrainColor});
 const roadsideVerge=TRACK.id==='san-francisco-hills'?null:createRoadVerge(scene,TRACK,venue,{low,surfaces:surfaces.maps});
 if(!venue.original&&!venue.water){
  // Inland venues have continuous terrain under the whole route: no hidden
  // waterfront infield or yachts appearing beside a desert/permanent circuit.
  const terrain=new THREE.Mesh(terrainUV(new THREE.CircleGeometry(venue.groundRadius,96),venue.centerX,venue.centerZ,venue.environment==='urban'?3:90),venue.environment==='urban'?restrainedPavementMaterial(surfaces.maps.asphaltColor):new THREE.MeshStandardMaterial({color:venue.environment==='urban'?'#929a9b':'#c6c9b5',map:venue.environment==='urban'?surfaces.maps.concreteColor:surfaces.maps.terrainColor,roughness:1}));
  terrain.name='venue-terrain';terrain.rotation.x=-Math.PI/2;terrain.position.set(venue.centerX,-.16,venue.centerZ);terrain.receiveShadow=true;scene.add(terrain);
 }
 if(!venue.original&&(!venue.water||TRACK.scenery==='breakwater'||venue.vegetation==='street-trees')){
  const foliage=[],treeTrunks=[],rocks=[],cityBlocks=[],cityRoofs=[];
  const decorations=venueSceneryLayout(TRACK,{low});scene.userData.venueDecorationCount=decorations.length;terrainOccupied.push(...decorations);

  for(const item of decorations){
   const {x,z,radius,height,yaw,shade}=item,ground=TRACK.id==='san-francisco-hills'?coastalGroundAt(coastalDistrict,x,z):0;
   if(item.kind==='building'){
    cityBlocks.push({x,z,y:height/2-.16,sx:radius*1.3,sy:height,sz:radius*.8,ry:yaw});
    cityRoofs.push({x,z,y:height+.1,sx:radius*1.34,sy:.32,sz:radius*.84,ry:yaw,color:shade>.7?'#67a8af':'#354759'});
   }else if(item.kind==='rock')rocks.push({x,z,y:height*.18-.8,sx:radius*.84,sy:height*.65,sz:radius*.71,ry:yaw,color:TRACK.scenery==='breakwater'?(shade>.5?'#4d5960':'#354047'):TRACK.scenery==='copper-canyon'?(shade>.5?'#a16c4c':'#86543d'):shade>.5?'#9a805e':'#76644e'});
   else{
    treeTrunks.push({x,z,y:ground+height*.29,sx:.18,sy:height*.58,sz:.18});
    if(venue.vegetation==='conifers'){
     for(let layer=0;layer<3;layer++)foliage.push({x,z,y:ground+height*(.50+layer*.17),sx:radius*(1-layer*.23),sy:height*(.35-layer*.04),sz:radius*(1-layer*.23),ry:yaw,color:shade>.66?'#405a40':shade>.33?'#304d3a':'#263e32'});
    }else {
     foliage.push({x,z,y:ground+height*.72,sx:radius*.90,sy:height*.37,sz:radius*.80,ry:yaw,color:shade>.66?'#647454':shade>.33?'#4c6449':'#405841'});
     for(const side of [-1,1])segment(treeTrunks,[x,ground+height*.35,z],[x+Math.cos(yaw)*side*radius*.48,ground+height*.72,z+Math.sin(yaw)*side*radius*.48],.10);
    }
   }
  }
  if(foliage.length){
   // Three pieces per broadleaf tree must not turn a small original trunk
   // batch into dozens of draws merely because branches were added.
   createSpatialInstances(scene,new THREE.CylinderGeometry(1,1.1,1,6),new THREE.MeshStandardMaterial({color:'#594d3d',roughness:1}),treeTrunks,{partitionThreshold:venue.vegetation==='conifers'?48:144});
   instances(scene,venue.vegetation==='conifers'?coniferBoughGeometry({low}):broadleafCrownGeometry({low}),venue.vegetation==='conifers'?new THREE.MeshStandardMaterial({color:'white',vertexColors:true,roughness:1}):foliageSurfaceMaterial(surfaces.maps.foliageLeaf),foliage);
  }
  if(rocks.length)instances(scene,new THREE.DodecahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:'white',roughness:1}),rocks);
  if(cityBlocks.length){
   frontageBuildings.unshift(...cityBlocks);
   instances(scene,box,architecturalFacadeMaterial({night:venue.night}),cityBlocks);
   instances(scene,box,new THREE.MeshStandardMaterial({color:'white',roughness:.65,metalness:.35}),cityRoofs);
  }
  if(venue.environment==='desert'&&TRACK.scenery!=='copper-canyon'){
   const dunes=[];
   for(let i=0;i<(low?15:24);i++){
    const a=i/(low?15:24)*TAU,r=venue.radius+130+rng()*100,width=65+rng()*45;
    const x=venue.centerX+Math.cos(a)*r,z=venue.centerZ+Math.sin(a)*r;
    if(projectOnTrack(x,z).distance<width+TRACK.width/2+15)continue;
    dunes.push({x,z,y:-7,sx:width,sy:16+rng()*19,sz:width*.8,ry:a,color:i%2?'#9d8664':'#ad9571'});
   }
   instances(scene,new THREE.SphereGeometry(1,16,8),new THREE.MeshStandardMaterial({color:'white',roughness:1}),dunes);
  }
 }
 const landmarks=createOriginalLandmarks(scene,TRACK,{low,stands:standLayouts});
 terrainOccupied.push(...tracksideServiceLayout(TRACK,{low,stands:standLayouts,landmarks:[...(scene.userData.originalLandmarks||[]),...showcaseSites]}));
 const streetSites=streetscapeLayout(TRACK,venue,{low,occupied:[...terrainOccupied,...standLayouts.map(s=>({...s,radius:16})),...(scene.userData.originalLandmarks||[]),...showcaseSites]});
 instances(scene,box,concreteSurfaceMaterial(surfaces.maps,{color:'#d2cec1'}),streetSites.map(b=>({...b,color:b.frontageTint})));
 frontageBuildings.unshift(...streetSites);terrainOccupied.push(...streetSites);
 const quay=venue.water?createWaterfrontGrounding(scene,TRACK,[...streetSites,...towers],concreteSurfaceMaterial(surfaces.maps,{color:'#7f8a88'})):null;
 const parcels=createDistrictParcels(scene,TRACK,[...streetSites,...frontageBuildings,...towers],{low,surfaces:surfaces.maps,water:venue.water&&TRACK.id!=='san-francisco-hills'});
 const frontage=createArchitecturalDetails(scene,frontageBuildings.slice(0,low?32:52),{low,night:venue.night,concreteMap:surfaces.maps.concreteColor,concreteNormal:surfaces.maps.concreteNormal});
 const reliefBuilder=venue.environment==='parkland'&&!venue.water?createInlandRelief:createTerrainRelief;
 const relief=reliefBuilder(scene,TRACK,venue,{low,map:surfaces.maps.terrainColor,occupied:[...terrainOccupied,...standLayouts.map(s=>({...s,radius:16})),...(scene.userData.originalLandmarks||[]),...showcaseSites]});
 const edgeDetails=createRoadEdgeDetails(scene,TRACK,{low});
 scene.userData.trackWorldDetail={coastalDistrict:coastalDistrict?.userData,verge:roadsideVerge?.userData,parcels:parcels.userData,frontages:frontage.userData,streets:streetSites,quays:quay?.userData,relief:relief.userData,edges:edgeDetails.userData};
 createTracksideServices(scene,TRACK,{low,stands:standLayouts,landmarks:[...(scene.userData.originalLandmarks||[]),...showcaseSites],crowd,rng:crowdRng});
 const mountainPositions = [], mountainIndices = [];
 const ridgeSegments = 320;
 for (let i = 0; i <= ridgeSegments; i++) {
  const a = i / ridgeSegments * TAU;
  const height = (31 + Math.sin(a * 3 + .8) * 16 + Math.sin(a * 7 - .4) * 10 + Math.sin(a * 13) * 5 + Math.sin(a * 29 + .7) * 1.8) * (summit ? 2.8 : venue.horizonScale);
  const x=Math.cos(a)*venue.horizonRadius+(venue.original?0:venue.centerX),z=Math.sin(a)*venue.horizonRadius+(venue.original?0:venue.centerZ);
  mountainPositions.push(x,-5,z,x,height,z);
  if (i < ridgeSegments) { const j = i * 2; mountainIndices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
 }
 const mountains = new THREE.BufferGeometry(); mountains.setAttribute('position', new THREE.Float32BufferAttribute(mountainPositions, 3)); mountains.setIndex(mountainIndices);
 // The procedural ridge is only a loading/error fallback. Leaving an opaque
 // silhouette in front of the detailed image would hide its actual landscape.
 const fallbackRidge = new THREE.Mesh(mountains, new THREE.MeshBasicMaterial({ color:venue.horizon, side: THREE.DoubleSide, transparent:true, depthWrite:false }));fallbackRidge.name='procedural-horizon-fallback';scene.add(fallbackRidge);


 const trunks = [], fronds = [], crowns = [], planters = [];
 for (let s = 16; s < (summit || !venue.water || venue.vegetation!=='palms' ? 0 : TRACK.length); s += grandPrix ? 72 : low ? 33 : 27) {
  const p = sampleTrack(s), sign = p.x * p.nx + p.z * p.nz > 0 ? 1 : -1, o = sign * (TRACK.width / 2 + 3.5 + rng() * .6), x = p.x + p.nx * o, z = p.z + p.nz * o, h = 7.8 + rng() * 4.3, leanX = (rng() - .5) * 1.7, leanZ = (rng() - .5) * 1.7;
  if (standLayouts.some(stand => Math.hypot(x - stand.x, z - stand.z) < 14)||showcaseSites.some(site=>Math.hypot(x-site.x,z-site.z)<site.radius+6)) continue;
  for (let j = 0; j < 7; j++) { const a = j / 7, b = (j + 1) / 7; segment(trunks, [x + leanX * a * a, h * a, z + leanZ * a * a], [x + leanX * b * b, h * b, z + leanZ * b * b], .21 - a * .07); }
  const topX = x + leanX, topZ = z + leanZ;
  crowns.push({ x: topX, y: h -.05, z: topZ, sx: .48, sy: .6, sz: .48 });
  planters.push({ x, y: .13, z, sx: 1.45, sy: .32, sz: 1.45, ry: Math.atan2(p.tx, p.tz) });
  const rotation = rng() * TAU;
  for (let j = 0; j < 12; j++) { const upper = j > 7, a = j / (upper ? 4 : 8) * TAU + rotation; fronds.push({ x: topX, y: h + (upper ? .25 : 0), z: topZ, ry: a, rz: upper ? .55 + rng() * .16 : -.05 + rng() * .18, sx: upper ? .73 : .9 + rng() * .16, sy: upper ? .85 : 1, sz: .8 + rng() * .35 }); }
 }
 const bark = canvasTexture(64, 256, (c, w, h) => { c.fillStyle = '#695848'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 11) { c.fillStyle = `rgba(27,25,22,${.20 + rng() * .22})`; c.fillRect(0, y, w, 2); c.fillStyle = '#86715b'; c.fillRect(0, y + 2, w, 1); } }); bark.wrapS = bark.wrapT = THREE.RepeatWrapping;
 instances(scene, new THREE.CylinderGeometry(.85, 1, 1, 8), new THREE.MeshStandardMaterial({ map: bark, color: '#b8a08a', roughness: .97 }), trunks);
 instances(scene, palmFrondGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .9, emissive: '#071309', emissiveIntensity: .1 }), fronds);
 instances(scene, new THREE.SphereGeometry(.5, 6, 5), new THREE.MeshStandardMaterial({ color: '#344732', roughness: 1 }), crowns); instances(scene, box, concrete, planters);

 const cranes = [], craneFeet = [], cableMaterial = new THREE.MeshStandardMaterial({ color: '#223241', roughness: .6, metalness: .5 });
 for (let i = 0; i < (summit || !venue.original ? 0 : 7); i++) { const x = -250 - i * 24, z = -15 + i * 41, h = 29 + i % 3 * 6;
  for (const dz of [-3, 3]) { segment(cranes, [x - 5, 0, z + dz], [x, h, z + dz], .48); segment(cranes, [x + 5, 0, z + dz], [x, h, z + dz], .48); segment(cranes, [x, h - 7, z + dz], [x + 27, h + 4, z + dz], .48); segment(cranes, [x, h - 7, z + dz], [x - 12, h - 3, z + dz], .35); segment(cranes, [x + 27, h + 4, z + dz], [x + 27, 7, z + dz], .035); }
  segment(cranes, [x, h + 7, z], [x + 27, h + 4, z], .04); segment(cranes, [x, h, z], [x, h + 7, z], .20); craneFeet.push({ x, y: 1, z, sx: 14, sy: 2, sz: 15 });
 }
 instances(scene, new THREE.CylinderGeometry(1, 1, 1, 6), cableMaterial, cranes); instances(scene, box, concrete, craneFeet);

 // A tapered hull, recessed glazing and guardrails read as a vessel in silhouette.
 const boat = new THREE.Group(), hullPositions = [], hullIndices = [];
 const stations = [[-14, 2.9], [-11, 3.7], [7, 3.45], [12, 1.9], [15, .12]];
 stations.forEach(([x, w]) => hullPositions.push(x, -.2, -w * .65, x, 1.8, -w, x, 1.8, w, x, -.2, w * .65));
 for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < 4; j++) { const a = i * 4 + j, b = i * 4 + (j + 1) % 4, c = a + 4, d = b + 4; hullIndices.push(a, b, c, b, d, c); }
 const hullGeo = new THREE.BufferGeometry(); hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(hullPositions, 3)); hullGeo.setIndex(hullIndices); hullGeo.computeVertexNormals();
 const boatWhite = new THREE.MeshStandardMaterial({ color: '#c5c4b7', roughness: .35, metalness: .18 }), glass = new THREE.MeshStandardMaterial({ color: '#102c3c', metalness: .7, roughness: .12 }); boat.add(new THREE.Mesh(hullGeo, boatWhite));
 for (let i = 0; i < 3; i++) { const deck = new THREE.Mesh(new THREE.BoxGeometry(17 - i * 5, .9, 5.9 - i * 1.25), boatWhite); deck.position.set(-2 - i * .7, 2.3 + i * 1.35, 0); boat.add(deck); const glazing = new THREE.Mesh(new THREE.BoxGeometry(14.8 - i * 4.7, .62, 5.6 - i * 1.25), glass); glazing.position.set(-2.3 - i * .7, 2.95 + i * 1.35, 0); boat.add(glazing); const strip = new THREE.Mesh(new THREE.BoxGeometry(15.2 - i * 4.7, .04, 5.66 - i * 1.25), warm); strip.position.copy(glazing.position).y -= .28; boat.add(strip); }
 const boatRails = [], portholes = []; for (let x = -12; x < 11; x += 1.5) for (const side of [-1, 1]) boatRails.push({ x, y: 2.2, z: side * 3.15, sx: .035, sy: .72, sz: .035 });
 for (let x = -10; x < 9; x += 2.6) for (const side of [-1, 1]) portholes.push({ x, y: .65, z: side * 3.25, sx: .36, sy: .25, sz: .06 });
 instances(boat, box, metal, boatRails); instances(boat, box, glass, portholes);
 const mast = new THREE.Mesh(new THREE.CylinderGeometry(.07, .12, 8, 8), boatWhite); mast.position.set(-2, 8.5, 0); boat.add(mast); boat.position.set(-42, -.8, 25); boat.rotation.y = .2;
 if(!venue.original&&venue.water){
  boat.visible=false;
  for(let i=0;i<12;i++){
   const a=i/12*TAU,x=venue.centerX+Math.cos(a)*venue.radius*.47,z=venue.centerZ+Math.sin(a)*venue.radius*.47;
   if(projectOnTrack(x,z).distance>TRACK.width/2+28&&(scene.userData.originalLandmarks||[]).every(site=>Math.hypot(x-site.x,z-site.z)>site.radius+22)){boat.position.set(x,-.8,z);boat.visible=true;break;}
  }
 }
 if (!summit && !grandPrix && venue.water) scene.add(boat);
 // Each added circuit has an identifiable setting while retaining the same
 // flat, physically driven asphalt surface. Terrain stays outside its barriers.
 if (summit || grandPrix) {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(370, 96), new THREE.MeshStandardMaterial({ color: summit ? '#28332e' : '#24392f', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.13; scene.add(ground);
 }
 if (summit) {
  const rocks = [], pines = [], pineTrunks = [];
  for (let i = 0; i < 66; i++) {
   const a = rng() * TAU, radius = 220 + rng() * 135, x = Math.sin(a) * radius, z = Math.cos(a) * radius;
   const width = 14 + rng() * 23, height = 12 + rng() * 40;
   if (projectOnTrack(x, z).distance < width + 22) continue;
   rocks.push({ x, z, y: height * .28 - 5, sx: width, sy: height * .65, sz: width * (.7 + rng() * .4), ry: rng() * TAU, color: i % 3 ? '#414c49' : '#59615a' });
  }
  for (let distance = 8; distance < TRACK.length; distance += low ? 22 : 15) for (const side of [-1, 1]) {
   const p = sampleTrack(distance), offset = side * (20 + rng() * 18), x = p.x + p.nx * offset, z = p.z + p.nz * offset;
   if (projectOnTrack(x, z).distance < 17) continue;
   if (standLayouts.some(stand => Math.hypot(x - stand.x, z - stand.z) < 14)||showcaseSites.some(site=>Math.hypot(x-site.x,z-site.z)<site.radius+6)) continue;
   const height = 6 + rng() * 8;
   pineTrunks.push({ x, z, y: height * .36, sx: .22, sy: height * .72, sz: .22 });
   for (let tier = 0; tier < 3; tier++) pines.push({ x, z, y: height * (.46 + tier * .16), sx: height * (.26 - tier * .05), sy: height * .58, sz: height * (.26 - tier * .05), ry: rng() * TAU, color: tier % 2 ? '#243c35' : '#304940' });
  }
  instances(scene, new THREE.DodecahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 'white', roughness: .98, flatShading: true }), rocks);
  instances(scene, new THREE.CylinderGeometry(1, 1, 1, 7), new THREE.MeshStandardMaterial({ color: '#4c4137', roughness: 1 }), pineTrunks);
  instances(scene, coniferBoughGeometry({low}), new THREE.MeshStandardMaterial({ color: 'white', vertexColors:true, roughness: 1 }), pines);
 }
 if (grandPrix) {
  const p = sampleTrack(105), paddock = new THREE.Group();paddock.name = 'bay-grand-prix-paddock';paddock.position.set(p.x, 0, p.z);paddock.rotation.y = Math.atan2(p.tx, p.tz);scene.add(paddock);
  const pitWall = new THREE.MeshStandardMaterial({ color: '#bbc4c5', roughness: .69 });
  const pitGlass = new THREE.MeshStandardMaterial({ color: '#284353', roughness: .23, metalness: .6 });
  const pitRoof = new THREE.MeshStandardMaterial({ color: '#132735', roughness: .4, metalness: .5 });
  const addBox = (x, y, z, sx, sy, sz, material) => {const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);m.position.set(x, y, z);m.castShadow = true;m.receiveShadow = true;paddock.add(m);return m;};
  addBox(-25, 2.9, 0, 12, 5.8, 112, pitWall);addBox(-18.95, 4.25, 0, .08, 1.75, 110, pitGlass);addBox(-24, 6, 0, 16, .22, 117, pitRoof);
  for (let i = -5; i <= 5; i++) {addBox(-18.92, 1.7, i * 9.8, .12, 2.9, 7.8, metal);addBox(-18.8, 3.1, i * 9.8, .12, .08, 6.9, cyan);}
  const seats = [], standPosts = [];
  for (let row = 0; row < 7; row++) {
   addBox(23 + row * 1.5, .55 + row * .75, 0, 1.7, .35, 95, concrete);
   for (let seat = -28; seat <= 28; seat++) {
    if (seat % 14 === 0) continue;
    const x = 23 + row * 1.5, z = seat * 1.55, color = (seat + row) % 4 === 0 ? '#dbe3e5' : '#167683';
    seats.push({ x, y: 1.02 + row * .75, z, sx: .74, sy: .20, sz: .90, color });
    seats.push({ x: x + .31, y: 1.37 + row * .75, z, sx: .10, sy: .59, sz: .90, color });
    if (crowdRng() > .13) {
     const standing = row === 6 && seat % 3 === 0, px = x - (standing ? .67 : 0);
     crowd.add(p.x + p.nx * px + p.tx * z, .73 + row * .75, p.z + p.nz * px + p.tz * z, paddock.rotation.y - Math.PI / 2 + (crowdRng() - .5) * .2, !standing, crowdRng);
    }
   }
  }
  for (const z of [-47, -23, 0, 23, 47]) standPosts.push({ x: 33, y: 4.8, z, sx: .24, sy: 9.6, sz: .24 });
  instances(paddock, box, new THREE.MeshStandardMaterial({ color: 'white', roughness: .68 }), seats);instances(paddock, box, metal, standPosts);
  const canopy = addBox(28, 9.7, 0, 15, .21, 101, pitRoof);canopy.rotation.z = .075;
  const identity = canvasTexture(1024, 128, (c, w, h) => {c.fillStyle = '#0b1d27';c.fillRect(0, 0, w, h);c.fillStyle = '#a8f0f2';c.font = 'italic 800 65px Arial';c.textAlign = 'center';c.fillText('BAY GRAND PRIX', w / 2, 87);});
  const nameboard = new THREE.Mesh(new THREE.PlaneGeometry(28, 3.5), new THREE.MeshBasicMaterial({ map: identity }));nameboard.rotation.y = Math.PI / 2;nameboard.position.set(-18.80, 6.65, 0);paddock.add(nameboard);
 }
 // Three synchronized twin-lamp columns use the existing countdown hook.
 createMountainVenue(scene, TRACK, {low,landmarks:showcaseSites,surfaces:surfaces.maps,groundHeight:coastalDistrict?(x,z)=>coastalGroundAt(coastalDistrict,x,z):undefined});
 createShowcaseVenue(scene,TRACK,{low,stands:standLayouts,crowd,rng:crowdRng,surfaces:surfaces.maps});
 const lampHousing = new THREE.Mesh(new THREE.BoxGeometry(3.55, 1.13, .42), metal); lampHousing.position.set(0, 5.83, -.08); finishArch.add(lampHousing);
 const startLights = [];
 for (let i = 0; i < 3; i++) {
  const lightMaterial = new THREE.MeshBasicMaterial({ color: '#452a28', toneMapped: false });
  for (let row = 0; row < 2; row++) for (const face of [-1, 1]) {
   const bezel = new THREE.Mesh(new THREE.CylinderGeometry(.225, .225, .13, 14), metal); bezel.rotation.x = Math.PI / 2; bezel.position.set(-.95 + i * .95, 5.6 + row * .47, -.08 + face * .26); finishArch.add(bezel);
   const lamp = new THREE.Mesh(new THREE.SphereGeometry(.175, 12, 8), lightMaterial); lamp.scale.z = .34; lamp.position.set(-.95 + i * .95, 5.6 + row * .47, -.08 + face * .345); finishArch.add(lamp);
   if (row === 0 && face === -1) startLights.push(lamp);
  }
 }
 crowd.render(scene);
 const detail=createDistanceDetail(scene,{low});scene.userData.distanceDetail=detail.stats;
 let motionTime=0,lastWorldTime=null;
 return { scene, reflection, sun, startLights, backdrop, surfaces,disposeCrowd:()=>crowd.dispose?.(),disposeSurfaceTextures:surfaces.dispose,rebuildEnvironment:environment.rebuild,disposeEnvironment:environment.dispose, setQuality:settings=>detail.setQuality(settings), update(time, car, motion = {}) {
 const dt=lastWorldTime===null?0:Math.max(0,Math.min(.1,time-lastWorldTime));lastWorldTime=time;if(!motion.paused&&!(motion.reducedMotion??reducedMotion))motionTime+=dt;detail.update(time,car); backdrop.update(time,{reducedMotion:motion.reducedMotion??reducedMotion});fallbackRidge.material.opacity=1-backdrop.uniforms.cinematicAmount.value;fallbackRidge.visible=fallbackRidge.material.opacity>.001;crowd.update(time, car, motion); landmarks.update(time,{paused:motion.paused,reducedMotion:motion.reducedMotion??reducedMotion}); sea.material.uniforms.time.value = motionTime; boat.position.y = -.8 + Math.sin(motionTime * .7) * .065; if (car) { sun.position.set(car.x - 150,venue.sunHeight+(car.y||0),car.z + 130); sun.target.position.set(car.x, car.y||0, car.z); } } };
}
