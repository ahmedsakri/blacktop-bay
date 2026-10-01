import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MANUFACTURER_ASSETS } from './manufacturer-asset-manifest.js';
import { configureManufacturerPaint } from './manufacturer-paint.js';

// This module downloads only the requested car. Geometry and texture images are
// immutable cache resources; every displayed car owns its mutable materials.
const templates = new Map();
const pending = new Map();
const loadQueue = [];
const MAX_IDLE_TEMPLATES = 2;
const MAX_CONCURRENT_LOADS = 2;
const BRAKE_COLOR = new THREE.Color('#ff1708');
let activeLoads = 0, useCounter = 0;
const WHEELS = ['wheel_front_left', 'wheel_front_right', 'wheel_rear_left', 'wheel_rear_right'];
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const keyFor = (id, low) => `${id}:${low ? 'low' : 'high'}`;
const manifestFor = id => Object.hasOwn(MANUFACTURER_ASSETS, id) ? MANUFACTURER_ASSETS[id] : null;
const templateFor = (id, low) => templates.get(keyFor(id, low)) || templates.get(keyFor(id, !low));

function trimCache() {
  const idle = [...templates.entries()].filter(([, entry]) => entry.references === 0)
    .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
  while (idle.length > MAX_IDLE_TEMPLATES) {
    const [key, entry] = idle.shift();
    templates.delete(key);
    releaseSource(entry.scene);
  }
}

function scheduleLoad(load) {
  return new Promise((resolve, reject) => {
    loadQueue.push({load, resolve, reject});
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
  return {scene, dimensions: {length: size.z, width: size.x, height: size.y}, references: 0, lastUsed: ++useCounter};
}

/** Load one car and one quality level. A failed request can be retried. */
export function prepareManufacturerCar(assetId, {low = false, baseURL, onProgress} = {}) {
  const manifest = manifestFor(assetId);
  if (!manifest) return Promise.reject(new Error(`Unknown manufacturer car: ${assetId}`));
  const key = keyFor(assetId, low);
  if (templates.has(key)) {
    const entry = templates.get(key); entry.lastUsed = ++useCounter;
    return Promise.resolve(entry);
  }
  if (pending.has(key)) return pending.get(key);
  const path = low ? manifest.low : manifest.high;
  if (!path) return Promise.reject(new Error(`No ${low ? 'mobile' : 'desktop'} asset is available for ${assetId}.`));
  const failedResources = new Set();
  const manager = new THREE.LoadingManager();
  // GLTFLoader recovers from texture failures by resolving an untextured mesh.
  // A failed finish must reject the selection so the current car stays intact.
  manager.onError = resource => failedResources.add(resource);
  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);
  let url = baseURL ? new URL(path, baseURL).href : path;
  const hash = manifest.variants?.[low ? 'low' : 'high']?.sha256;
  if (typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash)) url += `${url.includes('?') ? '&' : '?'}v=${hash.slice(0, 16)}`;
  const request = scheduleLoad(() => loader.loadAsync(url, onProgress)).then(gltf => {
    try {
      if (failedResources.size) throw new Error(`The ${manifest.brand} ${manifest.model} textures could not be loaded. Please try again.`);
      const template = inspectSource(gltf.scene, manifest);
      templates.set(key, template);
      trimCache();
      return template;
    } catch (error) {
      releaseSource(gltf.scene);
      throw error;
    }
  }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export function isManufacturerCarReady(assetId, {low = false} = {}) {
  return Boolean(manifestFor(assetId) && templateFor(assetId, low));
}

function cloneMaterial(source, paintable, ghost, color) {
  let material;
  // Physical clearcoat gives paint a real second reflection layer while copying
  // all authored maps, UV transforms, transparency and source surface normals.
  if (paintable && source.isMeshStandardMaterial && !source.isMeshPhysicalMaterial) {
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
export function createManufacturerCar({assetId, vehicle, color, low = false, ghost = false} = {}) {
  const manifest = manifestFor(assetId), template = templateFor(assetId, low);
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
      const material = cloneMaterial(source, paintable && paintNames.has(source.name), ghost, color);
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
    mesh.castShadow = !ghost && !optical;
    mesh.receiveShadow = !ghost && !optical;
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
    return {pivot, rolling, baseYaw: pivot.rotation.y, angle: 0, front: name.includes('_front_'),
      radius: Math.max(.15, finite(configuredRadius, size.y / 2 || .33)), width: Math.max(.12, size.x)};
  });
  const rear = wheels.filter(wheel => !wheel.front);
  const exhausts = (manifest.exhausts || []).filter(point => ['x', 'y', 'z'].every(key => Number.isFinite(point[key])))
    .map(point => ({x: point.x, y: point.y, z: point.z}));
  group.userData = {
    kind: 'manufacturer-car', vehicle: typeof vehicle === 'object' ? vehicle.id : vehicle || assetId,
    assetId, brand: manifest.brand, model: manifest.model, paintable,
    dimensions: {...template.dimensions}, source: manifest.source, author: manifest.author, license: manifest.license,
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
  let lastTime = null, disposed = false;
  const update = ({speed = 0, steering = 0, brake = 0, time = 0} = {}) => {
    if (disposed) return;
    time = finite(time, lastTime ?? 0);
    const dt = lastTime === null ? 0 : THREE.MathUtils.clamp(time - lastTime, 0, .06);
    lastTime = time;
    speed = finite(speed);
    const steer = -THREE.MathUtils.clamp(finite(steering), -1, 1) * .40;
    for (const wheel of wheels) {
      wheel.angle = (wheel.angle + speed * dt / wheel.radius) % (Math.PI * 2);
      wheel.rolling.rotation.x = wheel.angle;
      wheel.pivot.rotation.y = wheel.baseYaw + (wheel.front ? steer : 0);
    }
    chassis.rotation.z = THREE.MathUtils.lerp(chassis.rotation.z,
      -steer * THREE.MathUtils.clamp(Math.abs(speed) / 28, 0, 1) * .018, Math.min(1, dt * 8));
    const braking = THREE.MathUtils.clamp(finite(Number(brake)), 0, 1);
    for (const lamp of brakeLights) {
      lamp.material.emissive.copy(lamp.emissive).lerp(BRAKE_COLOR, braking);
      lamp.material.emissiveIntensity = lamp.intensity + braking * 1.3;
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    materialCopies.forEach(material => material.dispose());
    template.references--;
    template.lastUsed = ++useCounter;
    // Active rivals retain source geometry/maps. Only the two most recent idle
    // templates stay cached, so inspecting the entire catalogue is bounded.
    trimCache();
  };
  return {group, update, dispose};
}
