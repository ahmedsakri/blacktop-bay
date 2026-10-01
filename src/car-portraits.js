import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCar } from './car.js';
let pending;
const portraits = new Map();
// Render the actual race meshes once, on opening the garage. One small renderer
// is shared by all portraits and disposed after use; no extra animation loop.
export function renderCarPortraits(vehicles, onPortrait) {
  for (const [id, url] of portraits) onPortrait(id,url);
  if (pending) return pending;
  if (portraits.size === vehicles.length) return Promise.resolve();
  pending = (async () => {
    let renderer, environment, room;
    try {
      renderer = new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setSize(400,200); renderer.setPixelRatio(1);
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      room = new RoomEnvironment(); environment = pmrem.fromScene(room,.04); room.dispose(); room=null; pmrem.dispose();
      scene.environment = environment.texture; scene.environmentIntensity = .6;
      scene.add(new THREE.HemisphereLight('#ddebff','#31343c',1.1));
      const light = new THREE.DirectionalLight('#fff5df',2.2); light.position.set(-3,6,5); scene.add(light);
      const camera = new THREE.OrthographicCamera(-4,4,2,-2,.1,40);
      camera.position.set(6,3.1,7.6); camera.lookAt(0,.6,0);
      for (const v of vehicles) {
        if (portraits.has(v.id)) continue;
        await new Promise(resolve => requestAnimationFrame(resolve));
        const model = createCar({vehicle:v.id,low:true});
        try {
          scene.add(model.group);
          const bounds = new THREE.Box3().setFromObject(model.group), center = bounds.getCenter(new THREE.Vector3());
          camera.position.copy(center).add(new THREE.Vector3(6,3.1,7.6)); camera.lookAt(center); camera.updateMatrixWorld();
          const projected = new THREE.Box3();
          for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) projected.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
          const half = Math.max((projected.max.y-projected.min.y)/2,(projected.max.x-projected.min.x)/4)*1.03;
          camera.left=-half*2;camera.right=half*2;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
          renderer.render(scene,camera);
          const url = renderer.domElement.toDataURL('image/webp',.88);
          portraits.set(v.id,url); onPortrait(v.id,url);
        } finally { model.group.removeFromParent(); model.dispose(); }
      }
    } catch (error) { console.warn('Car previews unavailable; live 3D inspection remains available.',error); }
    finally { room?.dispose(); environment?.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); pending=null; }
  })();
  return pending;
}
