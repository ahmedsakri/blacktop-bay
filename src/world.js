import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { TRACK, sampleTrack, projectOnTrack } from './track.js';

const TAU = Math.PI * 2;
function random(seed = 81) { let s = seed; return () => ((s = Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296; }
const box = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D();
function canvasTexture(width, height, draw) {
 const c = document.createElement('canvas'); c.width = width; c.height = height; draw(c.getContext('2d'), width, height);
 const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// Both the driving surface and the reflector wind upwards. The reflector's
// local +Z plane rotates to world +Y; its UVs retain metres along the track.
function roadGeometry(width, flat = false) {
 const positions = [], uv = [], indices = [], samples = TRACK.samples;
 for (let i = 0; i <= samples.length; i++) {
  const v = samples[i % samples.length], s = i === samples.length ? TRACK.length : v.s;
  for (const side of [-1, 1]) { const x = v.x + v.nx * width * .5 * side, z = v.z + v.nz * width * .5 * side; positions.push(x, flat ? -z : 0, flat ? 0 : z); uv.push((side + 1) / 2, s / 14); }
  if (i < samples.length) { const j = i * 2; indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
 }
 const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
function ribbon(offset, width, height, material) {
 const positions = [], indices = [];
 for (let i = 0; i <= TRACK.samples.length; i++) { const v = TRACK.samples[i % TRACK.samples.length]; for (const w of [-width / 2, width / 2]) positions.push(v.x + v.nx * (offset + w), height, v.z + v.nz * (offset + w)); if (i < TRACK.samples.length) { const j = i * 2; indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); } }
 const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return new THREE.Mesh(g, material);
}
function instances(scene, geo, mat, list) {
 const mesh = new THREE.InstancedMesh(geo, mat, list.length);
 list.forEach((v, i) => { dummy.position.set(v.x, v.y, v.z); dummy.rotation.set(v.rx || 0, v.ry || 0, v.rz || 0); dummy.scale.set(v.sx ?? 1, v.sy ?? 1, v.sz ?? 1); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); if (v.color) mesh.setColorAt(i, new THREE.Color(v.color)); });
 mesh.castShadow = false; mesh.receiveShadow = true; scene.add(mesh); return mesh;
}
function segment(list, a, b, radius) {
 const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), delta = vb.clone().sub(va), mid = va.clone().add(vb).multiplyScalar(.5);
 dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()); list.push({ x: mid.x, y: mid.y, z: mid.z, sx: radius, sy: delta.length(), sz: radius, rx: dummy.rotation.x, ry: dummy.rotation.y, rz: dummy.rotation.z });
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

function facadeMaterial() {
 const material = new THREE.MeshStandardMaterial({ color: '#506877', metalness: .48, roughness: .42 });
 material.onBeforeCompile = shader => {
  shader.vertexShader = 'varying vec2 vFacade; varying float vTowerSeed;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    vec3 facadeScale=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
    float faceWidth=abs(normal.x)>.5?facadeScale.z:facadeScale.x;
    vFacade=vec2(uv.x*faceWidth/2.5,uv.y*facadeScale.y/3.2);
    vTowerSeed=instanceMatrix[3].x*.13+instanceMatrix[3].z*.07;
  `);
  shader.fragmentShader = `varying vec2 vFacade;varying float vTowerSeed;${noiseGLSL}
    vec3 windowLight(){vec2 cell=floor(vFacade),f=fract(vFacade);float seed=hash21(cell+vTowerSeed);float window=step(.19,f.x)*step(f.x,.73)*step(.21,f.y)*step(f.y,.77);float on=step(.69,seed)*window*step(.18,hash21(vec2(cell.y,vTowerSeed)));vec3 tint=mix(vec3(.09,.25,.38),vec3(.9,.34,.075),step(.18,hash21(cell*.13+floor(vTowerSeed))));return tint*on*(.27+seed*.48);}
  ` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    vec2 facadeFraction=fract(vFacade);float pane=step(.16,facadeFraction.x)*step(facadeFraction.x,.77)*step(.18,facadeFraction.y)*step(facadeFraction.y,.8);
    diffuseColor.rgb*=mix(vec3(.36,.46,.55),vec3(.085,.14,.21),pane);
  `);
  shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=windowLight()*.68;');
 };
 material.customProgramCacheKey = () => 'blacktop-bay-facade-v2'; return material;
}

export function createWorld(renderer, { low = false } = {}) {
 const rng = random(), scene = new THREE.Scene(); scene.background = new THREE.Color('#263750'); scene.fog = new THREE.FogExp2('#344052', .00115);
 scene.add(new THREE.HemisphereLight('#82a6d4', '#4a3833', 1.0));
 const sun = new THREE.DirectionalLight('#ffb679', 1.35); sun.position.set(-180, 72, 130); sun.castShadow = true; sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 360 }); sun.shadow.bias = -.00065; sun.shadow.normalBias = .015; scene.add(sun, sun.target);
 const fill = new THREE.DirectionalLight('#88b9ef', .68); fill.position.set(20, 45, -30); scene.add(fill);
 const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: {}, vertexShader: 'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: `${noiseGLSL}
 varying vec3 vPosition;
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
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }` })); scene.add(sky);
 const environmentScene = new THREE.Scene(); environmentScene.add(sky.clone());
 const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(environmentScene, .045, .1, 2000).texture; scene.environmentIntensity = .72; pmrem.dispose();
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
 }` })); sea.rotation.x = -Math.PI / 2; sea.position.y = -.65; scene.add(sea);

 const asphalt = canvasTexture(low ? 512 : 1024, low ? 512 : 1024, (c, w, h) => {
  c.fillStyle = '#474b50'; c.fillRect(0, 0, w, h);
  const pixels = c.getImageData(0, 0, w, h);
  for (let i = 0; i < pixels.data.length; i += 4) { const v = 40 + rng() * 43; pixels.data[i] = v; pixels.data[i + 1] = v + 3; pixels.data[i + 2] = v + 6; }
  c.putImageData(pixels, 0, 0);
  for (let i = 0; i < 100; i++) { c.strokeStyle = `rgba(10,17,23,${rng() * .13})`; c.lineWidth = 1 + rng() * 2; c.beginPath(); const x = rng() * w, y = rng() * h; c.moveTo(x, y); c.lineTo(x + rng() * 8 - 4, y + 20 + rng() * 70); c.stroke(); }
 }); asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
 const base = new THREE.Mesh(roadGeometry(27), new THREE.MeshStandardMaterial({ color: '#303a43', roughness: .9 })); base.position.y = -.10; scene.add(base);
 const road = new THREE.Mesh(roadGeometry(TRACK.width), new THREE.MeshStandardMaterial({ color: '#b5bbc2', map: asphalt, bumpMap: asphalt, bumpScale: .036, roughness: .86, metalness: .015, envMapIntensity: .16 })); road.position.y = .011; road.receiveShadow = true; scene.add(road);
 const wetShader = {
  name: 'RainPolishedAsphalt', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: `uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vWorld;void main(){vUv=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform vec3 color;uniform sampler2D tDiffuse;varying vec4 vUv;varying vec3 vWorld;${noiseGLSL}
  void main(){vec2 q=vWorld.xz;float fine=noise21(q*7.);float wet=smoothstep(.29,.70,fbm(q*.24));vec4 projected=vUv;projected.xy+=vec2(noise21(q*3.1)-.5,noise21(q*4.2+8.)-.5)*.0012*projected.w;vec2 sampleUV=projected.xy/projected.w;float softness=.0008+(1.-wet)*.0015;vec3 reflected=texture2D(tDiffuse,sampleUV).rgb*.5;reflected+=(texture2D(tDiffuse,sampleUV+vec2(softness,0)).rgb+texture2D(tDiffuse,sampleUV-vec2(softness,0)).rgb+texture2D(tDiffuse,sampleUV+vec2(0,softness)).rgb+texture2D(tDiffuse,sampleUV-vec2(0,softness)).rgb)*.125;float grazing=pow(1.-clamp(normalize(cameraPosition-vWorld).y,0.,1.),2.);float alpha=(.008+wet*.14)*(.22+grazing*.78);gl_FragColor=vec4(reflected*vec3(.81,.88,.97)*( .9+fine*.1),alpha);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`
 };
 const reflection = new Reflector(roadGeometry(TRACK.width, true), { textureWidth: low ? 512 : 1024, textureHeight: low ? 512 : 1024, color: 0x708699, multisample: low ? 0 : 2, clipBias: .003, shader: wetShader }); reflection.rotation.x = -Math.PI / 2; reflection.position.y = .026; reflection.material.transparent = true; reflection.material.depthWrite = false; reflection.renderOrder = 0; scene.add(reflection);
 const white = new THREE.MeshBasicMaterial({ color: '#97a7aa' }), cyan = new THREE.MeshBasicMaterial({ color: '#34d8e9', toneMapped: false }), concrete = new THREE.MeshStandardMaterial({ color: '#596571', roughness: .82 }), metal = new THREE.MeshStandardMaterial({ color: '#15212c', metalness: .72, roughness: .35 }), warm = new THREE.MeshBasicMaterial({ color: '#ffd19a', toneMapped: false });
 warm.color.multiplyScalar(2.4); cyan.color.multiplyScalar(1.5);
 const sidewalk = new THREE.MeshStandardMaterial({ color: '#34424b', roughness: .92 });
 for (const side of [-1, 1]) { scene.add(ribbon(side * 11.1, 4.6, -.02, sidewalk)); scene.add(ribbon(side * (TRACK.width / 2 - .5), .10, .049, white)); scene.add(ribbon(side * (TRACK.width / 2 + .62), .038, 1.06, cyan)); }
 const barriers = [], rails = [], dashes = [], posts = [], bulbs = [], arms = [], chevrons = [], leftChevrons = [], straightMarkers = [], joints = [], railingUprights = [];
 const panelTexture = canvasTexture(256, 128, c => { c.fillStyle = '#091b25'; c.fillRect(0, 0, 256, 128); c.strokeStyle = '#35e1f2'; c.lineWidth = 17; for (let x = 60; x < 200; x += 70) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x + 34, 64); c.lineTo(x, 98); c.stroke(); } });
 for (let s = 0; s < TRACK.length; s += 5) {
  const v = sampleTrack(s), angle = Math.atan2(v.tx, v.tz), step = Math.floor(s / 5);
  for (const side of [-1, 1]) {
   const o = side * (TRACK.width / 2 + .7), x = v.x + v.nx * o, z = v.z + v.nz * o;
   barriers.push({ x, z, y: .49, sx: .66, sy: .98, sz: 4.97, ry: angle, color: step % 7 === 0 ? '#6b747d' : '#515d68' });
   rails.push({ x, z, y: 1.085, sx: .14, sy: .09, sz: 5.05, ry: angle });
   joints.push({ x, z, y: .43, sx: .68, sy: .8, sz: .028, ry: angle });
   if (step % 2 === 0) { const edge = side * 13.1; railingUprights.push({ x: v.x + v.nx * edge, z: v.z + v.nz * edge, y: .46, sx: .07, sy: .96, sz: .07 }); }
  }
  if (step % 2 === 0) dashes.push({ x: v.x, z: v.z, y: .052, sx: .085, sy: .004, sz: 2.3, ry: angle });
  if (step % 7 === 0) { const o = TRACK.width / 2 + 2.4, x = v.x + v.nx * o, z = v.z + v.nz * o; posts.push({ x, y: 3.75, z, sx: .105, sy: 7.5, sz: .105 }); segment(arms, [x, 7.3, z], [x - v.nx * 1.65, 7.65, z - v.nz * 1.65], .08); bulbs.push({ x: x - v.nx * 1.65, y: 7.59, z: z - v.nz * 1.65, sx: .75, sy: .065, sz: .32, ry: angle }); }
  if (step % 5 === 0) {
   const ahead = sampleTrack(s + 24), bend = Math.atan2(ahead.tx * v.tz - ahead.tz * v.tx, ahead.tx * v.tx + ahead.tz * v.tz);
   for (const side of [-1, 1]) {
    const o = side * (TRACK.width / 2 + .355), straight = Math.abs(bend) < .10;
    // +local X is driver-left, so positive yaw curvature needs a LEFT glyph.
    // Face approaching traffic, angled inward, rather than showing mirrored
    // backs of parallel barrier signs. Local panel +X then reads driver-right
    // on either road edge, independent of the side on which it is mounted.
    const panel = { x: v.x + v.nx * o, y: .58, z: v.z + v.nz * o, ry: straight ? angle + (side === 1 ? -Math.PI / 2 : Math.PI / 2) : angle + Math.PI + side * Math.PI / 4 };
    (straight ? straightMarkers : bend > 0 ? leftChevrons : chevrons).push(panel);
   }
  }
 }
 instances(scene, box, new THREE.MeshStandardMaterial({ color: '#bbc2c9', roughness: .82 }), barriers); instances(scene, box, metal, rails); instances(scene, box, new THREE.MeshStandardMaterial({ color: '#24313d', roughness: .9 }), joints); instances(scene, box, white, dashes); instances(scene, box, metal, posts); instances(scene, new THREE.CylinderGeometry(1, 1, 1, 6), metal, arms); instances(scene, box, warm, bulbs); instances(scene, box, metal, railingUprights);
 for (const side of [-1, 1]) { scene.add(ribbon(side * 13.1, .055, .93, metal)); scene.add(ribbon(side * 13.1, .035, .49, metal)); }
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
  kerbs.push({x:p.x+p.nx*offset,z:p.z+p.nz*offset,y:.064,sx:.72,sy:.028,sz:1.34,ry:Math.atan2(p.tx,p.tz),color:Math.floor(distance/1.35)%2?'#dcded8':'#ce4838'});
 }
 instances(scene,box,new THREE.MeshStandardMaterial({color:'white',roughness:.89}),kerbs);
 const finish = sampleTrack(0), checkers = [];
 for (let z=0;z<2;z++)for(let x=0;x<32;x++)checkers.push({x:finish.x+finish.nx*(x-15.5)*.5+finish.tx*z*.5,z:finish.z+finish.nz*(x-15.5)*.5+finish.tz*z*.5,y:.061,sx:.5,sy:.006,sz:.5,ry:Math.atan2(finish.tx,finish.tz),color:(x+z)%2?'#17202a':'#d8ddd9'});
 instances(scene,box,new THREE.MeshBasicMaterial({color:'white'}),checkers);
 for(let row=0;row<4;row++){
  const p=sampleTrack(5+row*7),angle=Math.atan2(p.tx,p.tz);
  for(const side of [-1,1]){
   const offset=side*3.2;
   gridMarks.push({x:p.x+p.nx*offset,z:p.z+p.nz*offset,y:.057,sx:2.6,sy:.006,sz:.10,ry:angle});
   for(const edge of [-1,1])gridMarks.push({x:p.x+p.nx*(offset+edge*1.3)+p.tx,z:p.z+p.nz*(offset+edge*1.3)+p.tz,y:.057,sx:.10,sy:.006,sz:2,ry:angle});
  }
 }
 instances(scene,box,white,gridMarks);
 const finishArch=new THREE.Group();finishArch.position.set(finish.x,0,finish.z);finishArch.rotation.y=Math.atan2(finish.tx,finish.tz);
 for(const side of [-1,1]){
  const upright=new THREE.Mesh(new THREE.BoxGeometry(.6,7.8,.65),metal);upright.position.set(side*9.5,3.9,0);finishArch.add(upright);
  const foot=new THREE.Mesh(new THREE.BoxGeometry(1.15,.7,1.5),concrete);foot.position.set(side*9.5,.35,0);finishArch.add(foot);
  for(const z of [-.36,.36]){const led=new THREE.Mesh(new THREE.BoxGeometry(.09,6.8,.04),cyan);led.position.set(side*9.5,3.9,z);finishArch.add(led);}
 }
 const header=new THREE.Mesh(new THREE.BoxGeometry(20.1,1.55,.72),metal);header.position.y=7.35;finishArch.add(header);
 const finishArt=canvasTexture(2048,256,(c,w,h)=>{
  c.fillStyle='#07121b';c.fillRect(0,0,w,h);
  c.fillStyle='#65e3f1';c.fillRect(0,0,w,5);c.fillRect(0,h-5,w,5);
  c.font='italic 800 92px Arial';c.textAlign='center';c.fillStyle='#eef8ff';c.fillText('BLACKTOP BAY',w/2,107);
  c.font='700 37px Arial';c.fillStyle='#61ddeb';c.fillText('START / FINISH  ·  WATERFRONT RACING',w/2,180);
  for(const start of [26,w-282])for(let y=0;y<4;y++)for(let x=0;x<5;x++){c.fillStyle=(x+y)%2?'#152a38':'#d5e4e8';c.fillRect(start+x*46,36+y*46,46,46);}
 });finishArt.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const bannerMaterial=new THREE.MeshBasicMaterial({map:finishArt,toneMapped:false});
 for(const side of [-1,1]){const banner=new THREE.Mesh(new THREE.PlaneGeometry(19.7,1.45),bannerMaterial);banner.position.set(0,7.35,side*.37);if(side<0)banner.rotation.y=Math.PI;finishArch.add(banner);}
 const underside=new THREE.Mesh(new THREE.BoxGeometry(18.7,.035,.75),cyan);underside.position.y=6.55;finishArch.add(underside);scene.add(finishArch);

 // Window cells are scaled in metres inside the instanced shader, so tall
 // buildings gain floors rather than stretching the same facade image.
 const towers = [], roofEquipment = [], caps = [], podiums = [], shoreLights = [];
 for (let i = 0; i < (low ? 68 : 94); i++) {
  const a = rng() * TAU, radius = 280 + Math.pow(rng(), .75) * 370, x = Math.sin(a) * radius, z = Math.cos(a) * radius;
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
 instances(scene, box, facadeMaterial(), towers); instances(scene, box, new THREE.MeshStandardMaterial({ color: '#202e3b', roughness: .72 }), podiums); instances(scene, box, metal, roofEquipment); instances(scene, box, new THREE.MeshBasicMaterial({ color: '#527f94' }), caps); instances(scene, box, warm, shoreLights);
 const land = new THREE.Mesh(new THREE.RingGeometry(216, 1400, 100), new THREE.MeshStandardMaterial({ color: '#192733', roughness: 1 })); land.rotation.x = -Math.PI / 2; land.position.y = -.28; scene.add(land);
 const mountainPositions = [], mountainIndices = [];
 const ridgeSegments = 320;
 for (let i = 0; i <= ridgeSegments; i++) {
  const a = i / ridgeSegments * TAU;
  const height = 31 + Math.sin(a * 3 + .8) * 16 + Math.sin(a * 7 - .4) * 10 + Math.sin(a * 13) * 5 + Math.sin(a * 29 + .7) * 1.8;
  mountainPositions.push(Math.cos(a) * 990, -5, Math.sin(a) * 990, Math.cos(a) * 990, height, Math.sin(a) * 990);
  if (i < ridgeSegments) { const j = i * 2; mountainIndices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
 }
 const mountains = new THREE.BufferGeometry(); mountains.setAttribute('position', new THREE.Float32BufferAttribute(mountainPositions, 3)); mountains.setIndex(mountainIndices); scene.add(new THREE.Mesh(mountains, new THREE.MeshBasicMaterial({ color: '#2e3d51', side: THREE.DoubleSide })));


 const trunks = [], fronds = [], crowns = [], planters = [];
 for (let s = 16; s < TRACK.length; s += low ? 33 : 27) {
  const p = sampleTrack(s), sign = p.x * p.nx + p.z * p.nz > 0 ? 1 : -1, o = sign * (11.5 + rng() * .6), x = p.x + p.nx * o, z = p.z + p.nz * o, h = 7.8 + rng() * 4.3, leanX = (rng() - .5) * 1.7, leanZ = (rng() - .5) * 1.7;
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
 for (let i = 0; i < 7; i++) { const x = -250 - i * 24, z = -15 + i * 41, h = 29 + i % 3 * 6;
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
 const mast = new THREE.Mesh(new THREE.CylinderGeometry(.07, .12, 8, 8), boatWhite); mast.position.set(-2, 8.5, 0); boat.add(mast); boat.position.set(-42, -.8, 25); boat.rotation.y = .2; scene.add(boat);
 const startLights = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff674c' })); m.position.set(-.9 + i*.9, 6.20, -.40); finishArch.add(m); startLights.push(m); }
 return { scene, reflection, sun, startLights, update(time, car) { sea.material.uniforms.time.value = time; boat.position.y = -.8 + Math.sin(time * .7) * .065; if (car) { sun.position.set(car.x - 150, 72, car.z + 130); sun.target.position.set(car.x, 0, car.z); } } };
}
