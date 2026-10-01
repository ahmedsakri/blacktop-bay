import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// A separate inspection studio: neutral paint reflections and uncluttered silhouettes.
export function createGarage(renderer, { low = false } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#110017');
  scene.fog = new THREE.Fog('#110017', 16, 44);
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .45;
  room.dispose();
  pmrem.dispose();
  const anchor = new THREE.Group();
  scene.add(anchor);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color:'#110017', roughness:.67, metalness:.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = .006;
  floor.receiveShadow = true;
  anchor.add(floor);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(4.35,4.4,.035,96),new THREE.MeshStandardMaterial({color:'#26212b',metalness:.32,roughness:.52}));
  platform.position.y=.018;
  platform.receiveShadow=true;
  anchor.add(platform);
  const line = new THREE.Mesh(new THREE.RingGeometry(4.28,4.30,128),new THREE.MeshBasicMaterial({color:'#9146FF'}));
  line.rotation.x=-Math.PI/2;
  line.position.y=.038;
  anchor.add(line);
  scene.add(new THREE.HemisphereLight('#e3efff','#404047',.55));
  const key = new THREE.DirectionalLight('#fff4e4',1.5);
  key.position.set(-4,7,4);
  key.castShadow=true;
  key.shadow.mapSize.set(low?1024:2048,low?1024:2048);
  Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:24});
  key.shadow.bias=-.0002;
  key.shadow.normalBias=.018;
  key.shadow.radius=3;
  anchor.add(key,key.target);
  const rim = new THREE.DirectionalLight('#c3e3ff',.9);
  rim.position.set(4,3,-5);
  anchor.add(rim,rim.target);
  const fill = new THREE.DirectionalLight('#ffffff',.4);
  fill.position.set(0,2,6);
  anchor.add(fill,fill.target);
  return { scene, position(car) { anchor.position.set(car.x,0,car.z); } };
}
