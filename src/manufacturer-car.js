import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BoundedKTX2Loader } from './bounded-ktx2-loader.js';
import { BASIS_TRANSCODER } from './basis-transcoder-manifest.js';
import { MANUFACTURER_COMPRESSED_ASSETS } from './manufacturer-compressed-manifest.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MANUFACTURER_DISTANCE_ASSETS } from './manufacturer-distance-manifest.js';
import { MANUFACTURER_ASSETS } from './manufacturer-asset-manifest.js';
import { configureManufacturerPaint } from './manufacturer-paint.js';
import { createChassisMotion } from './chassis-motion.js';
import { createCarDamage } from './car-damage.js';
import {applyFlagshipFinish} from './manufacturer-finish.js';
import {applyManufacturerTyreFinish} from './manufacturer-tyre-finish.js';
import {prepareManufacturerInstances} from './gpu-preparation.js';
export {prepareManufacturerInstances} from './gpu-preparation.js';

// This module downloads only the requested car. Geometry and texture images are
// immutable cache resources; every displayed car owns its mutable materials.
const templates = new Map();
const pending = new Map();
const loadQueue = [];
const MAX_IDLE_TEMPLATES = 2;
const MAX_IDLE_BYTES = 32 * 1024 * 1024;
const MAX_CONCURRENT_LOADS = 2;
const BRAKE_COLOR = new THREE.Color('#ff1708');
let activeLoads = 0, useCounter = 0;
let graphicsPreparation=null,ktxLoader=null,compressedEnabled=false;
export function configureManufacturerRenderer(renderer,{camera,scene}={}){
 graphicsPreparation={renderer,camera,scene};
 compressedEnabled=BASIS_TRANSCODER.available&&!ktxLoader?.failure&&['WEBGL_compressed_texture_astc','WEBGL_compressed_texture_etc','EXT_texture_compression_bptc','WEBGL_compressed_texture_s3tc'].some(name=>renderer.extensions?.has(name));
 if(compressedEnabled){ktxLoader ||= new BoundedKTX2Loader(undefined,{onFailure:()=>{compressedEnabled=false;}}).setTranscoderPath(BASIS_TRANSCODER.path).setWorkerLimit(2);ktxLoader.detectSupport(renderer);}
 return {gpuCompressed:compressedEnabled,compressedCars:Object.keys(MANUFACTURER_COMPRESSED_ASSETS).length};
}
const WHEELS = ['wheel_front_left', 'wheel_front_right', 'wheel_rear_left', 'wheel_rear_right'];
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const keyFor = (id, low, distant=false) => `${id}:${distant?'distance':low ? 'low' : 'high'}`;
const manifestFor = id => Object.hasOwn(MANUFACTURER_ASSETS, id) ? MANUFACTURER_ASSETS[id] : null;
const templateFor = (id, low, distant=false) => templates.get(keyFor(id, low,distant)) || (!distant&&templates.get(keyFor(id, !low)));

export function manufacturerCacheStatus(){return {templates:templates.size,activeLoads,queuedLoads:loadQueue.length,activeTemplates:[...templates.values()].filter(entry=>entry.references>0).length,idleByteLimit:MAX_IDLE_BYTES,idleEstimatedBytes:[...templates.values()].filter(entry=>entry.references===0).reduce((n,entry)=>n+(entry.estimatedBytes||0),0),estimatedResidentBytes:[...templates.values()].reduce((n,entry)=>n+(entry.estimatedBytes||0),0)};}

function trimCache(protectedKey) {
  const idle = [...templates.entries()].filter(([, entry]) => entry.references === 0)
    .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
  let bytes=idle.reduce((sum,[,entry])=>sum+entry.estimatedBytes,0);
  while (idle.length > MAX_IDLE_TEMPLATES || bytes > MAX_IDLE_BYTES) {
    const index=idle.findIndex(([key])=>key!==protectedKey);if(index<0)break;
    const [key, entry] = idle.splice(index,1)[0];bytes-=entry.estimatedBytes;
    templates.delete(key);
    releaseSource(entry.scene);
  }
}

function scheduleLoad(load,priority=0) {
  return new Promise((resolve, reject) => {
    loadQueue.push({load, resolve, reject,priority});loadQueue.sort((a,b)=>a.priority-b.priority);
    pumpLoads();
  });
}

function pumpLoads() {
  while (activeLoads < MAX_CONCURRENT_LOADS && loadQueue.length) {
    const task = loadQueue.shift();
    activeLoads++;
    Promise.resolve().then(task.load).then(task.resolve, task.reject).finally(() => {
      activeLoads--;
      pumpLoads();
    });
  }
}

function releaseSource(scene) {
  const geometry = new Set(), materials = new Set(), textures = new Set(), images = new Set();
  scene?.traverse(object => {
    if (!object.isMesh) return;
    geometry.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometry.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  textures.forEach(value => { if (value.image) images.add(value.image); value.dispose(); });
  images.forEach(value => value.close?.());
}

function inspectSource(scene, manifest) {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene), size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite) || size.x <= 0 || size.y <= 0 || size.z <= 0)
    throw new Error(`The ${manifest.model || manifest.id} model has invalid dimensions.`);
  for (const name of WHEELS) {
    const wheel = scene.getObjectByName(name);
    if (!wheel || new THREE.Box3().setFromObject(wheel).isEmpty())
      throw new Error(`The ${manifest.model || manifest.id} model is missing its ${name} geometry.`);
  }
  scene.traverse(object => {
    if (object.isSkinnedMesh) throw new Error('Manufacturer cars require static meshes with separate wheel pivots.');
  });
  const buffers=new Set(),textures=new Set();let estimatedBytes=0;
  scene.traverse(mesh=>{if(!mesh.isMesh)return;for(const attribute of [...Object.values(mesh.geometry.attributes),mesh.geometry.index].filter(Boolean)){const data=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array;if(data&&!buffers.has(data.buffer)){buffers.add(data.buffer);estimatedBytes+=data.buffer.byteLength;}}for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const value of Object.values(material))if(value?.isTexture&&!textures.has(value)){textures.add(value);const image=value.image;estimatedBytes+=value.isCompressedTexture?value.mipmaps.reduce((n,m)=>n+(m.data?.byteLength||0),0):(image?.width||0)*(image?.height||0)*4*4/3;}});
  return {scene,estimatedBytes:Math.ceil(estimatedBytes), dimensions: {length: size.z, width: size.x, height: size.y}, references: 0, lastUsed: ++useCounter};
}

/** Load one car and one quality level. A failed request can be retried. */
export function prepareManufacturerCar(assetId, {low = false, distant=false, baseURL, onProgress} = {}) {
  const manifest = manifestFor(assetId);
  if (!manifest) return Promise.reject(new Error(`Unknown manufacturer car: ${assetId}`));
  const key = keyFor(assetId, low,distant);
  if (templates.has(key)) {
    const entry = templates.get(key); entry.lastUsed = ++useCounter;
    return Promise.resolve(entry);
  }
  if (pending.has(key)) return pending.get(key);
  const compressed=low&&!distant&&compressedEnabled?MANUFACTURER_COMPRESSED_ASSETS[assetId]:null;
  const decoder=ktxLoader;
  const path = distant?MANUFACTURER_DISTANCE_ASSETS[assetId]?.path:compressed?.path||(low ? manifest.low : manifest.high);
  if (!path) return Promise.reject(new Error(`No ${low ? 'mobile' : 'desktop'} asset is available for ${assetId}.`));
  const failedResources = new Set();
  const manager = new THREE.LoadingManager();
  // GLTFLoader recovers from texture failures by resolving an untextured mesh.
  // A failed finish must reject the selection so the current car stays intact.
  manager.onError = resource => failedResources.add(resource);
  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);
  if(decoder)loader.setKTX2Loader({load(resource,onLoad,onProgress,onError){
    // The shared transcoder has its own manager; forward failures to this car
    // before GLTFLoader converts rejected texture dependencies into null maps.
    const failed=error=>{failedResources.add(resource);if(onError)onError(error);else throw error;};
    try{return decoder.load(resource,onLoad,onProgress,failed);}catch(error){failed(error);}
  }});
  let url = baseURL ? new URL(path, baseURL).href : path;
  const hash = distant?MANUFACTURER_DISTANCE_ASSETS[assetId]?.sha256:compressed?.sha256||manifest.variants?.[low ? 'low' : 'high']?.sha256;
  if (typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash)) url += `${url.includes('?') ? '&' : '?'}v=${hash.slice(0, 16)}`;
  const request = scheduleLoad(async() => {
    if(!compressed)return loader.loadAsync(url,onProgress);
    let partial;
    try{
      // Queued work may outlive another car's fatal decoder failure. Never reuse it.
      if(decoder?.failure)throw decoder.failure;
      partial=await loader.loadAsync(url,onProgress);
      // GLTFLoader may swallow map rejection; decoder failure must also reject the partial car.
      const textures=partial.parser?await partial.parser.getDependencies('texture'):[];
      if(decoder?.failure||failedResources.size||textures.some(texture=>!texture?.isTexture))throw new Error('Compressed maps unavailable');
      return partial;
    }
    catch{if(partial)releaseSource(partial.scene);failedResources.clear();
      const fallback=baseURL?new URL(manifest.low,baseURL).href:manifest.low;
      return loader.loadAsync(fallback+'?v='+manifest.variants.low.sha256.slice(0,16),onProgress);
    }
  },distant?1:0).then(gltf => {
    try {
      if (failedResources.size) throw new Error(`The ${manifest.brand} ${manifest.model} textures could not be loaded. Please try again.`);
      const template = inspectSource(gltf.scene, manifest);
      templates.set(key, template);
      // Awaiting callers may immediately create an instance. Protect this
      // handoff until the next task, then enforce the idle byte ceiling too.
      trimCache(key);const trimTimer=setTimeout(()=>trimCache(),0);trimTimer.unref?.();
      return template;
    } catch (error) {
      releaseSource(gltf.scene);
      throw error;
    }
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export function isManufacturerCarReady(assetId, {low = false,distant=false} = {}) {
  return Boolean(manifestFor(assetId) && templateFor(assetId, low,distant));
}

function cloneMaterial(source, paintable, ghost, color,distant=false) {
  let material;
  // Physical clearcoat gives paint a real second reflection layer while copying
  // all authored maps, UV transforms, transparency and source surface normals.
  if(distant&&source.isMeshStandardMaterial){
    material=new THREE.MeshStandardMaterial();THREE.MeshStandardMaterial.prototype.copy.call(material,source);
    material.normalMap=null;material.bumpMap=null;material.aoMap=null;
  }else if (paintable && source.isMeshStandardMaterial && !source.isMeshPhysicalMaterial) {
    material = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(material, source);
    material.defines = {...material.defines, PHYSICAL: ''};
    material.clearcoat = .65;
    material.clearcoatRoughness = .16;
  } else material = source.clone();
  material.userData = {...material.userData};
  delete material.userData.bodyPaint;
  if (paintable && !ghost && material.color) {
    material.userData.bodyPaint = true;
    material.userData.factoryColor = `#${material.color.getHexString()}`;
    material.userData.factoryFinish = Object.fromEntries(
      ['metalness', 'roughness', 'clearcoat', 'clearcoatRoughness'].map(name => [name, finite(material[name])])
    );
    material.userData.factoryMap = material.map || null;
    if (color !== undefined && color !== null) material.color.set(color);
  }
  if (ghost) {
    material.color?.set('#d5c4ff');
    material.emissive?.set(0);
    material.transparent = true;
    material.opacity = source.transparent ? .10 : .22;
    material.depthWrite = false;
  }
  return material;
}

/** Create an instance after preparation; never substitutes another car's body. */
export function createManufacturerCar({assetId, vehicle, color, low = false, ghost = false,distant=false} = {}) {
  const manifest = manifestFor(assetId), template = templateFor(assetId, low,distant);
  if (!manifest) throw new Error(`Unknown manufacturer car: ${assetId}`);
  if (!template) throw new Error(`The ${manifest.brand} ${manifest.model} model is not ready. Await prepareManufacturerCar('${assetId}') first.`);

  const group = new THREE.Group(), chassis = new THREE.Group();
  group.name = assetId;
  chassis.name = 'sprung-body';
  group.add(chassis);
  const scene = template.scene.clone(true);
  chassis.add(scene);
  const paintNames = new Set(manifest.paintMaterialNames || []);
  const brakeNames = new Set(manifest.brakeLightMaterialNames || []);
  const paintable = manifest.paintable !== false && paintNames.size > 0;
  const materialCopies = new Map(), brakeLights = [];
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    const copy = source => {
      if (materialCopies.has(source)) return materialCopies.get(source);
      const material = cloneMaterial(source, paintable && paintNames.has(source.name), ghost, color,distant);
      if(!ghost&&!distant)applyFlagshipFinish(material,assetId);
      if(!ghost&&!distant)applyManufacturerTyreFinish(material,assetId);
      configureManufacturerPaint(material, assetId, {customColor: color !== undefined && color !== null});
      materialCopies.set(source, material);
      if (!ghost && material.emissive && (brakeNames.has(source.name) || source.userData.brakeLight === true)) {
        brakeLights.push({material, emissive: material.emissive.clone(), intensity: material.emissiveIntensity});
      }
      return material;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(copy) : copy(mesh.material);
    // Transparent optical shells should not cast solid shadows over their own
    // cabin or receive self-shadow acne, particularly on mobile shadow maps.
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const optical = materials.every(material => material.transparent && material.opacity < .95);
    mesh.castShadow = !ghost && !optical && !distant;
    mesh.receiveShadow = !ghost && !optical && !distant;
  });

  group.updateMatrixWorld(true);
  const wheels = WHEELS.map(name => {
    const original = scene.getObjectByName(name);
    const bounds = new THREE.Box3().setFromObject(original), size = bounds.getSize(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.name = name;
    const local = new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(original.matrixWorld);
    local.decompose(pivot.position, pivot.quaternion, pivot.scale);
    group.add(pivot);
    const rolling = new THREE.Group();
    rolling.name = 'tyre-rotation';
    pivot.add(rolling);
    // A glTF wheel node with one primitive loads as a Mesh; multiple primitives
    // load as a Group. Wrap the node itself so both forms visibly rotate.
    original.removeFromParent();
    original.name = 'authored-tyre-surface';
    original.position.set(0, 0, 0);
    original.quaternion.identity();
    original.scale.set(1, 1, 1);
    rolling.add(original);
    const configuredRadius = typeof manifest.wheelRadius === 'number' ? manifest.wheelRadius : manifest.wheelRadius?.[name];
    return {pivot, rolling, baseY:pivot.position.y, baseYaw: pivot.rotation.y, angle: 0, front: name.includes('_front_'),
      radius: Math.max(.15, finite(configuredRadius, size.y / 2 || .33)), width: Math.max(.12, size.x)};
  });
  const rear = wheels.filter(wheel => !wheel.front);
  const exhausts = (manifest.exhausts || []).filter(point => ['x', 'y', 'z'].every(key => Number.isFinite(point[key])))
    .map(point => ({x: point.x, y: point.y, z: point.z}));
  group.userData = {
    kind: 'manufacturer-car', vehicle: typeof vehicle === 'object' ? vehicle.id : vehicle || assetId,
    assetId, brand: manifest.brand, model: manifest.model, paintable,
    dimensions: {...template.dimensions}, source: manifest.source, author: manifest.author, license: manifest.license,
    tyreContacts: wheels.map(wheel => ({x:wheel.pivot.position.x, z:wheel.pivot.position.z, width:wheel.width, radius:wheel.radius})),
    effects: {
      rearAxle: rear.reduce((sum, wheel) => sum + wheel.pivot.position.z, 0) / rear.length,
      tyreOffset: rear.reduce((sum, wheel) => sum + Math.abs(wheel.pivot.position.x), 0) / rear.length,
      tyreWidth: rear.reduce((sum, wheel) => sum + wheel.width, 0) / rear.length,
      // Only source-verified exhaust locations are allowed; electric cars and
      // unmarked models must not acquire fabricated pipes or flames.
      exhausts,
    },
  };

  template.references++;
  template.lastUsed = ++useCounter;
  let lastTime = null, disposed = false,distanceModel=null,distanceRequest=null,usingDistance=false,nextVisualTime=0,distanceReady=false;
  const distanceStatus={tier:distant?'distance':'near',loading:false,available:Boolean(MANUFACTURER_DISTANCE_ASSETS[assetId]),nearTriangles:manifest.variants?.[low?'low':'high']?.triangles,distanceTriangles:MANUFACTURER_DISTANCE_ASSETS[assetId]?.triangles};
  group.userData.distanceDetail=distanceStatus;
  const ownChildren=[...group.children];
  const prepareDistanceDetail=(preparation)=>{
    if(distant||ghost||disposed||!distanceStatus.available)return Promise.resolve(false);
    if(distanceModel&&distanceReady)return Promise.resolve(true);if(distanceRequest)return distanceRequest;
    distanceStatus.loading=true;
    distanceRequest=prepareManufacturerCar(assetId,{low:true,distant:true}).then(async()=>{
      if(disposed)return false;distanceModel=createManufacturerCar({assetId,vehicle,color,low:true,distant:true});
      distanceModel.group.visible=false;group.add(distanceModel.group);
      const warmup=preparation||graphicsPreparation;
      if(warmup?.renderer&&warmup.camera&&warmup.scene)await prepareManufacturerInstances(warmup.renderer,[distanceModel],warmup);
      distanceReady=!disposed;return distanceReady;
    }).catch(error=>{distanceModel?.dispose();distanceModel=null;distanceReady=false;distanceStatus.available=error?.name==='AbortError';return false;}).finally(()=>{distanceStatus.loading=false;distanceRequest=null;});
    return distanceRequest;
  };
  const setDistanceDetail=(distance,{detailDistanceScale=1}={})=>{
    if(disposed||distant||ghost)return;
    const scale=Math.max(.5,Math.min(1.3,detailDistanceScale)),threshold=(usingDistance?52:65)*scale;
    const far=Number.isFinite(distance)&&distance>threshold;
    if(far&&!distanceModel&&distanceStatus.available)prepareDistanceDetail();
    const use=far&&Boolean(distanceModel)&&distanceReady;if(use===usingDistance)return;usingDistance=use;nextVisualTime=0;
    for(const child of ownChildren)child.visible=!use;distanceModel.group.visible=use;distanceStatus.tier=use?'distance':'near';
    if(use){const current=new Map([...materialCopies.values()].filter(m=>m.userData.bodyPaint).map(m=>[m.name,m]));
      distanceModel.group.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){const near=current.get(material.name);if(near&&material.color){material.color.copy(near.color);material.roughness=near.roughness;material.metalness=near.metalness;if(material.userData.bodyPaintMask&&near.userData.bodyPaintMask)material.userData.bodyPaintMask.enabled.value=near.userData.bodyPaintMask.enabled.value;}}});}
  };
  const suspension = createChassisMotion();
  const damage = ghost||distant ? null : createCarDamage(group, chassis, {low});
  group.userData.damage = damage?.stats || null;
  const update = ({speed = 0, actualSpeed=speed, steering = 0, brake = 0, time = 0, air, impact, recovery, car, active=true,paused=false,reducedMotion=false,raceId} = {}) => {
    if (disposed) return;
    time = finite(time, lastTime ?? 0);
    if(distant&&time<nextVisualTime)return;nextVisualTime=time+.10;
    const dt = lastTime === null ? 0 : THREE.MathUtils.clamp(time - lastTime, 0, distant?.20:.06);
    lastTime = time;
    if(usingDistance){
      // Detached fragments live beside this car in the world. Keep their
      // expiry/recovery lifecycle alive without scanning hidden body vertices.
      damage?.update({impact,recovery,car,active,paused,reducedMotion,raceId,deform:false},dt);
      distanceModel.update({speed,actualSpeed,steering,brake,time,active,paused,reducedMotion,raceId});return;
    }
    speed = finite(speed);
    const steer = -THREE.MathUtils.clamp(finite(steering), -1, 1) * .40;
    const body=distant?{front:0,rear:0,roll:0,pitch:0,heave:0}:suspension.update({speed:actualSpeed,steering,brake,air,impact,active,paused,raceId},dt);
    damage?.update({impact, recovery, car, active, paused, reducedMotion, raceId}, dt);
    for (const wheel of wheels) {
      wheel.angle = (wheel.angle + speed * dt / wheel.radius) % (Math.PI * 2);
      wheel.rolling.rotation.x = wheel.angle;
      wheel.pivot.rotation.y = wheel.baseYaw + (wheel.front ? steer : 0);
      wheel.pivot.position.y = wheel.baseY + (wheel.front?body.front:body.rear)*.3;
    }
    chassis.rotation.z=body.roll;chassis.rotation.x=body.pitch;chassis.position.y=body.heave;
    const braking = THREE.MathUtils.clamp(finite(Number(brake)), 0, 1);
    for (const lamp of brakeLights) {
      lamp.material.emissive.copy(lamp.emissive).lerp(BRAKE_COLOR, braking);
      lamp.material.emissiveIntensity = lamp.intensity + braking * 1.3;
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    damage?.dispose();distanceModel?.dispose();
    group.removeFromParent();
    materialCopies.forEach(material => material.dispose());
    template.references--;
    template.lastUsed = ++useCounter;
    // Active rivals retain source geometry/maps. Only the two most recent idle
    // templates stay cached, so inspecting the entire catalogue is bounded.
    trimCache();
  };
  return {group, update, dispose,prepareDistanceDetail,setDistanceDetail,get disposed(){return disposed;}};
}
