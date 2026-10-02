import * as THREE from 'three';
import { createStudioEnvironment } from './studio-environment.js';

// The set is static and separately buildable so its clearance and draw-call
// budget can be checked without allocating a renderer or changing car materials.
export function createGarageSet({ low = false } = {}) {
  const set = new THREE.Group(); set.name = 'garage-architecture';
  const graphite = new THREE.MeshStandardMaterial({ color: '#303037', roughness: .46, metalness: .22 });
  // Radial machining is evaluated in object space, with derivative filtering
  // so a grazing camera never turns the turntable into a moiré pattern.
  graphite.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 studioPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nstudioPosition=position;');
    shader.fragmentShader = 'varying vec3 studioPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float radial=length(studioPosition.xz)*145.;
      float grain=(.5+.5*sin(radial))*max(0.,1.-fwidth(radial)*1.5);
      roughnessFactor+=grain*.016;`);
  };
  graphite.customProgramCacheKey = () => 'garage-machined-turntable-v1';
  const violet = new THREE.MeshBasicMaterial({ color: '#9246FF', toneMapped: false });
  const seam = new THREE.MeshBasicMaterial({ color: '#323039' });
  const concrete = new THREE.MeshStandardMaterial({color:'#3d3e44',roughness:.65,metalness:.08});
  concrete.onBeforeCompile = shader => {
    shader.vertexShader='varying vec2 floorPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloorPosition=position.xy;');
    shader.fragmentShader='varying vec2 floorPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 tile=abs(fract(floorPosition/3.)-.5);
      float seam=smoothstep(.493-fwidth(floorPosition.x/3.),.5,max(tile.x,tile.y));
      float grain=fract(sin(dot(floor(floorPosition*350.),vec2(12.9898,78.233)))*43758.5453);
      float fade=1.-smoothstep(.005,.02,length(fwidth(floorPosition)));
      diffuseColor.rgb*=1.-seam*.25+(grain-.5)*.10*fade;`);
  };
  concrete.customProgramCacheKey=()=> 'garage-concrete-v2';
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), concrete);
  floor.name = 'garage-floor'; floor.rotation.x = -Math.PI / 2;
  floor.position.y = .006; floor.receiveShadow = true; set.add(floor);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.35, 4.4, .035, low ? 80 : 128), graphite);
  platform.name = 'garage-platform'; platform.position.y = .018;
  platform.receiveShadow = true; set.add(platform);
  function ring(name, inside, outside, material, height = .008, start = 0, length = Math.PI * 2, parent = set) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(inside, outside, low ? 96 : 160, 1, start, length), material);
    mesh.name = name; mesh.rotation.x = -Math.PI / 2; mesh.position.y = height; parent.add(mesh);
    return mesh;
  }
  ring('garage-platform-inlay', 4.23, 4.245, seam, .038);
  ring('garage-platform-light-a', 4.29, 4.315, violet, .038, .18, 1.23);
  ring('garage-platform-light-b', 4.29, 4.315, violet, .038, Math.PI + .18, 1.23);
  ring('garage-floor-joint', 8.7, 8.714, seam);

  const mural = new THREE.Group(); mural.name = 'garage-led-gallery'; set.add(mural);
  const radius = 12, height = 6.8, bottom = .12;
  // A continuous curved display preserves the studio at every inspection angle.
  // BackSide culling lets distant mobile/orbit cameras see through its exterior
  // rather than having a near wall hide the car.
  const start = Math.PI / 2 + .62, length = Math.PI * 2;
  const material = new THREE.ShaderMaterial({
    name: 'original-violet-led-mural', side: THREE.BackSide, toneMapped: false,
    uniforms: {
      violet: {value: new THREE.Color('#9246FF')},
      deepViolet: {value: new THREE.Color('#29104f')},
      highlight: {value: new THREE.Color('#ceafff')},
    },
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform vec3 violet;uniform vec3 deepViolet;uniform vec3 highlight;
      void main(){
        vec2 uv=vUv;
        float shoulder=pow(max(0.,1.-abs(uv.y-.48)*1.7),.8);
        vec3 colour=mix(deepViolet,violet,.43+shoulder*.43);
        // Broad diagonal light lanes are deliberately original, with enough
        // scale to remain recognisable behind a small mobile car silhouette.
        float lane=fract(uv.x*3.-uv.y*.53+.14);
        float aa=max(fwidth(lane),.001);
        float ribbon=smoothstep(.035-aa,.035+aa,lane)*(1.-smoothstep(.19-aa,.19+aa,lane));
        colour=mix(colour,violet*1.08,ribbon*.63);
        float edge=1.-smoothstep(.005,.012+aa,abs(lane-.19));
        colour=mix(colour,highlight,edge*.37);
        float sweep=1.-smoothstep(.010,.020+fwidth(uv.y),abs(uv.y-.255));
        colour=mix(colour,violet*1.25,sweep*.30);
        // Restrained panel seams, derivative-filtered to avoid a flickering LED
        // pixel grid at mobile resolution. Nothing scrolls or flashes.
        float panel=abs(fract(uv.x*18.+.5)-.5);
        float joint=1.-smoothstep(.007,.013+fwidth(uv.x)*18.,panel);
        colour*=1.-joint*.20;
        // Broad, inset display bays sit in dark architectural ribs. The floor
        // and top coves are real geometry; this authored LED content remains
        // static, and does not change the neutral paint reflection environment.
        float bay=fract(uv.x*12.);
        float rib=1.-smoothstep(.013,.022+fwidth(uv.x)*12.,min(bay,1.-bay));
        float vertical=smoothstep(.055,.13,uv.y)*(1.-smoothstep(.80,.97,uv.y));
        colour*=.56+.44*vertical;
        // A steel-lined studio, with luminous inset bands rather than an
        // unbroken purple wall. Soft upper washes reveal the vertical fins.
        float display=smoothstep(.19,.215,uv.y)*(1.-smoothstep(.53,.55,uv.y));
        float wallLight=.03+.08*pow(1.-abs(uv.y-.65),3.);
        vec3 steel=vec3(wallLight*.80,wallLight*.84,wallLight);
        float flute=abs(fract(uv.x*180.)-.5);
        steel*=.85+.15*smoothstep(.05,.40,flute);
        colour=mix(steel,colour*.85,display);
        float trim=(1.-smoothstep(.001,.004+fwidth(uv.y),abs(uv.y-.55)));
        colour=mix(colour,vec3(.70,.76,.85),trim*.8);
        colour=mix(colour,vec3(.020,.021,.025),rib*.95);
        gl_FragColor=vec4(colour,1.);
        #include <colorspace_fragment>
      }`,
  });
  const screen = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, low ? 64 : 112, 1, true, start, length), material);
  screen.name = 'garage-led-mural'; screen.position.y = bottom + height / 2;
  mural.add(screen);
  const surround = new THREE.MeshBasicMaterial({color: '#18131f', side: THREE.BackSide});
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(radius + .015, radius + .015, height + .20, low ? 64 : 112, 1, true, start, length), surround);
  edge.name = 'garage-mural-surround'; edge.position.y = screen.position.y; mural.add(edge);
  // A shallow floor wash belongs to the display set; it is not a purple light
  // or environment map, so the vehicle's approved paint stays neutral.
  const wash = new THREE.MeshBasicMaterial({color: '#542980', transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide});
  // RingGeometry angles run along X, unlike CylinderGeometry's Z-based angles.
  ring('garage-mural-floor-wash', radius - 1.1, radius, wash, .010, start - Math.PI / 2, length, mural);
  const coveMaterial = new THREE.MeshStandardMaterial({color:'#323139',roughness:.36,metalness:.63,side:THREE.BackSide});
  const cove = (name, points) => {
    const geometry = new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),low?64:112);
    const mesh=new THREE.Mesh(geometry,coveMaterial);mesh.name=name;mural.add(mesh);return mesh;
  };
  // Inward-facing profiles always sit beyond the car even when a phone's
  // camera has to move outside the studio to fit a narrow showcase frame.
  cove('garage-lower-cove',[[11.65,.04],[11.65,.18],[11.83,.31],[11.91,.55],[11.91,.88],[12,.96]]);
  cove('garage-upper-cove',[[12,6.45],[11.92,6.53],[11.64,6.69],[11.46,7.05],[11.46,7.35]]);
  const neutral = new THREE.MeshBasicMaterial({color:'#e0e4e8',toneMapped:false,side:THREE.DoubleSide});
  // A suspended softbox ring provides a physical studio ceiling. Its
  // single surface avoids individual fixtures and any real-time lights.
  const ceiling=new THREE.Mesh(new THREE.RingGeometry(6.2,6.62,low?80:128),neutral);
  ceiling.name='garage-ceiling-softbox';ceiling.rotation.x=Math.PI/2;ceiling.position.y=6.8;set.add(ceiling);
  const grooveMaterial=new THREE.MeshBasicMaterial({color:'#16131b',side:THREE.DoubleSide});
  ring('garage-platform-edge',4.345,4.40,grooveMaterial,.039);
  ring('garage-platform-inner-trim',4.08,4.10,neutral,.039);
  let drawCalls=0;set.traverse(item=>{if(item.isMesh)drawCalls++;});
  set.userData.stats = { muralRadius: radius, muralHeight: height, architecturalDrawCalls: drawCalls, dynamicObjects: 0 };
  return set;
}

// A separate inspection studio: neutral paint reflections and uncluttered silhouettes.
export function createGarage(renderer, { low = false } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#110017');
  scene.fog = new THREE.Fog('#110017', 16, 48);
  const environment=createStudioEnvironment(renderer,scene,{low});
  scene.environmentIntensity=.78;
  scene.environmentRotation.y=.6;
  const anchor = createGarageSet({ low }); scene.add(anchor);
  const gallery = anchor.getObjectByName('garage-led-gallery');
  scene.add(new THREE.HemisphereLight('#e3efff', '#404047', .55));
  const key = new THREE.DirectionalLight('#fff4e4', 1.5);
  key.position.set(-4, 7, 4); key.castShadow = true;
  key.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .1, far: 24 });
  key.shadow.bias = -.0002; key.shadow.normalBias = .018; key.shadow.radius = 3;
  anchor.add(key, key.target);
  const rim = new THREE.DirectionalLight('#c3e3ff', .9);
  rim.position.set(4, 3, -5); anchor.add(rim, rim.target);
  const fill = new THREE.DirectionalLight('#ffffff', .4);
  fill.position.set(0, 2, 6); anchor.add(fill, fill.target);
  return { scene, rebuildEnvironment:environment.rebuild,disposeEnvironment:environment.dispose, position(car) { anchor.position.set(car.x, 0, car.z); gallery.rotation.y = Number.isFinite(car.yaw) ? car.yaw : 0; } };
}
