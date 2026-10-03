import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MANUFACTURER_ASSETS } from '../src/manufacturer-asset-manifest.js';
import { prepareManufacturerCar, isManufacturerCarReady, createManufacturerCar,manufacturerCacheStatus } from '../src/manufacturer-car.js';

const entries = Object.entries(MANUFACTURER_ASSETS);
const wheelNames = ['wheel_front_left', 'wheel_front_right', 'wheel_rear_left', 'wheel_rear_right'];
function fixture(manifest) {
  const scene = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({color: '#aa3322', roughness: .27, metalness: .45});
  paint.name = manifest.paintMaterialNames?.[0] || 'fixture-unpaintable';
  paint.map = new THREE.Texture();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, .8, 4.2), paint);
  body.position.y = .9;
  scene.add(body);
  const rearLamp = new THREE.MeshStandardMaterial({color: '#6d0505', emissive: '#410303', emissiveIntensity: .2});
  rearLamp.userData.brakeLight = true;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(.5, .1, .03), rearLamp);
  lamp.position.set(0, .8, -2.11);
  scene.add(lamp);
  const rubber = new THREE.MeshStandardMaterial({color: '#101010', roughness: .9});
  for (const name of wheelNames) {
    const pivot = new THREE.Group(); pivot.name = name;
    pivot.position.set(name.endsWith('left') ? .88 : -.88, .34, name.includes('front') ? 1.3 : -1.3);
    const geometry = new THREE.CylinderGeometry(.34, .34, .24, 16);
    geometry.rotateZ(Math.PI / 2);
    pivot.add(new THREE.Mesh(geometry, rubber)); scene.add(pivot);
  }
  return {scene, body, paint, rearLamp};
}
const materialsOf = group => {
  const result = new Set();
  group.traverse(mesh => { if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) result.add(material); });
  return [...result];
};

test('manufacturer assets load on demand, deduplicate concurrent requests and preserve per-instance factory finishes', async t => {
  const [id, manifest] = entries.find(([, entry]) => entry.paintable !== false && entry.paintMaterialNames?.length);
  const source = fixture(manifest), calls = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async function(url, onProgress) {
    calls.push(url);
    assert.ok(this.meshoptDecoder, 'compressed shipping assets have a decoder');
    onProgress?.({loaded: 64, total: 64});
    return {scene: source.scene};
  });
  assert.equal(isManufacturerCarReady(id), false);
  assert.equal(calls.length, 0, 'import and readiness checks must not download the catalogue');
  let progress = 0;
  const first = prepareManufacturerCar(id, {low: true, baseURL: 'https://fixture.invalid/', onProgress: () => progress++});
  assert.equal(first, prepareManufacturerCar(id, {low: true}), 'one in-flight request is reused');
  await first;
  await prepareManufacturerCar(id, {low: true});
  assert.equal(calls.length, 1);
  const expectedURL = new URL(manifest.low, 'https://fixture.invalid/');
  if (manifest.variants?.low?.sha256) expectedURL.searchParams.set('v', manifest.variants.low.sha256.slice(0, 16));
  assert.equal(calls[0], expectedURL.href);
  assert.equal(progress, 1);
  assert.equal(isManufacturerCarReady(id, {low: true}), true);
  const a = createManufacturerCar({assetId: id, vehicle: 'fixture-a', low: true, color: '#2266dd'});
  const b = createManufacturerCar({assetId: id, vehicle: 'fixture-b', low: true});
  const aPaint = materialsOf(a.group).find(material => material.userData.bodyPaint);
  const bPaint = materialsOf(b.group).find(material => material.userData.bodyPaint);
  assert.notEqual(aPaint, bPaint);
  assert.notEqual(aPaint, source.paint);
  assert.equal(aPaint.userData.factoryColor, '#aa3322');
  assert.equal(aPaint.userData.factoryFinish.roughness, .27);
  assert.equal(aPaint.userData.factoryMap, source.paint.map);
  assert.equal(aPaint.map, bPaint.map, 'immutable texture images remain shared');
  assert.equal(aPaint.color.getHexString(), '2266dd');
  assert.equal(bPaint.color.getHexString(), 'aa3322');
  assert.equal(source.paint.color.getHexString(), 'aa3322');
  assert.ok(aPaint.isMeshPhysicalMaterial, 'custom finishes have a physical clearcoat layer');
  assert.equal(a.group.userData.vehicle, 'fixture-a');
  assert.ok(a.group.userData.dimensions.length > 4);
  assert.equal(a.group.userData.effects.rearAxle, -1.3);
  assert.equal(a.group.userData.effects.tyreOffset, .88);
  assert.equal(a.group.userData.tyreContacts.length,4);
  assert.deepEqual(a.group.userData.tyreContacts.map(patch=>[patch.x,patch.z]),[[.88,1.3],[-.88,1.3],[.88,-1.3],[-.88,-1.3]]);
  assert.ok(a.group.userData.tyreContacts.every(patch=>patch.width>0&&patch.radius>0));

  const positions = wheelNames.map(name => a.group.getObjectByName(name).position.toArray());
  a.update({time: 1}); a.update({time: 1.04, speed: 26, steering: 1, brake: 1, nitro: true});
  for (const name of wheelNames) {
    const wheel = a.group.getObjectByName(name);
    assert.ok(wheel.children[0].rotation.x > 0);
    assert.equal(wheel.rotation.y < 0, name.includes('front'));
  }
  for (const [index,name] of wheelNames.entries()) {
    const position=a.group.getObjectByName(name).position.toArray();
    assert.equal(position[0],positions[index][0]);assert.equal(position[2],positions[index][2]);
    assert.ok(Math.abs(position[1]-positions[index][1])<.022,'suspension travel is bounded without moving axle positions');
  }
  assert.ok(a.group.getObjectByName('sprung-body').rotation.z<0,'actual steering produces outward body roll');
  const lamp = materialsOf(a.group).find(material => material.userData.brakeLight);
  assert.ok(lamp.emissiveIntensity > source.rearLamp.emissiveIntensity);
  a.update({time: 1.06, brake: 0});
  assert.equal(lamp.emissiveIntensity, source.rearLamp.emissiveIntensity);
  assert.equal(lamp.emissive.getHex(), source.rearLamp.emissive.getHex());
  assert.equal(a.group.getObjectByName('nitro-exhaust'), undefined, 'no fictional flame geometry is attached');

  const aMaterials = materialsOf(a.group), bMaterials = materialsOf(b.group);
  let ownDisposals = 0, sharedDisposals = 0, otherDisposals = 0;
  aMaterials.forEach(material => material.addEventListener('dispose', () => ownDisposals++));
  bMaterials.forEach(material => material.addEventListener('dispose', () => otherDisposals++));
  source.body.geometry.addEventListener('dispose', () => sharedDisposals++);
  source.paint.map.addEventListener('dispose', () => sharedDisposals++);
  a.dispose(); a.dispose();
  assert.equal(ownDisposals, aMaterials.length);
  assert.equal(sharedDisposals, 0);
  assert.equal(otherDisposals, 0);
  b.update({time: 2, speed: 20}); b.dispose();
});

test('failed manufacturer downloads can retry, and unavailable models never silently render a different car', async t => {
  const [id, manifest] = entries.find(([, entry]) => entry.paintable !== false && entry.paintMaterialNames?.length);
  let calls = 0;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => {
    if (++calls === 1) throw new Error('Network unavailable');
    return {scene: fixture(manifest).scene};
  });
  await assert.rejects(prepareManufacturerCar(id), /Network unavailable/);
  await prepareManufacturerCar(id);
  assert.equal(calls, 2);
  await assert.rejects(prepareManufacturerCar('__proto__'), /Unknown manufacturer car/);
  assert.throws(() => createManufacturerCar({assetId: 'not-a-model'}), /Unknown manufacturer car/);
  const [unloaded] = entries.find(([entryId]) => entryId !== id);
  assert.throws(() => createManufacturerCar({assetId: unloaded}), /not ready/);
});

test('sources with baked glass and paint retain their factory finish, including ghost instances', async t => {
  const [id, manifest] = entries.find(([, entry]) => entry.paintable === false) || entries.at(-1);
  // A later source replacement may make every shipping car paintable. Retain
  // the baked-atlas safety case without depending on one production model.
  const paintable = manifest.paintable;
  manifest.paintable = false;
  t.after(() => { manifest.paintable = paintable; });
  const source = fixture(manifest);
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => ({scene: source.scene}));
  await prepareManufacturerCar(id, {low: true});
  const car = createManufacturerCar({assetId: id, color: '#ff0000', low: true});
  const ghost = createManufacturerCar({assetId: id, low: true, ghost: true});
  assert.equal(car.group.userData.paintable, false);
  assert.equal(materialsOf(car.group).some(material => material.userData.bodyPaint), false);
  assert.equal(materialsOf(car.group)[0].color.getHexString(), 'aa3322');
  for (const material of materialsOf(ghost.group)) {
    assert.equal(material.depthWrite, false);
    assert.equal(material.transparent, true);
    assert.equal(material.userData.bodyPaint, undefined);
  }
  assert.equal(source.paint.transparent, false);
  car.dispose(); ghost.dispose();
});

test('browsing the catalogue evicts idle GPU resources while an active car keeps its shared geometry alive', async t => {
  const choices = entries.filter(([id]) => !isManufacturerCarReady(id)).slice(0, 4);
  assert.equal(choices.length, 4);
  const sources = new Map(), disposed = new Map();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    const [id, manifest] = choices.find(([, entry]) => url.split('?')[0].endsWith(entry.low));
    const source = fixture(manifest);
    sources.set(id, source);
    for (const resource of [source.body.geometry, source.paint.map]) resource.addEventListener('dispose', () => disposed.set(id, (disposed.get(id) || 0) + 1));
    return {scene: source.scene};
  });
  const [activeId] = choices[0];
  await prepareManufacturerCar(activeId, {low: true});
  const active = createManufacturerCar({assetId: activeId, low: true});
  for (const [id] of choices.slice(1)) await prepareManufacturerCar(id, {low: true});
  assert.equal(disposed.get(activeId) || 0, 0, 'active instance pins its geometry and texture image');
  assert.equal(isManufacturerCarReady(activeId), true);
  assert.equal(isManufacturerCarReady(choices[1][0]), false, 'the oldest unused template leaves the cache');
  assert.equal(disposed.get(choices[1][0]), 2, 'idle shared geometry and texture are released');
  active.update({time: 2}); active.update({time: 2.04, speed: 20});
  assert.ok(active.group.getObjectByName('wheel_front_left').children[0].rotation.x > 0);
  active.dispose();
});

test('rapid car selections bound concurrent asset transfers to two', async t => {
  const choices = entries.filter(([id]) => !isManufacturerCarReady(id)).slice(0, 3);
  const started = [], finish = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', url => {
    const [, manifest] = choices.find(([, entry]) => url.split('?')[0].endsWith(entry.low));
    started.push(url);
    return new Promise(resolve => finish.push(() => resolve({scene: fixture(manifest).scene})));
  });
  const requests = choices.map(([id]) => prepareManufacturerCar(id, {low: true}));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(started.length, 2);
  finish[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(started.length, 3);
  finish[1](); finish[2]();
  await Promise.all(requests);
});

test('concurrent preparation followed immediately by creation pins each template before later loads can evict it', async t => {
  const choices = entries.filter(([id]) => !isManufacturerCarReady(id)).slice(0, 6);
  assert.equal(choices.length, 6);
  const finish = [], cars = [];
  let releasedSources = 0;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', url => {
    const [, manifest] = choices.find(([, entry]) => url.split('?')[0].endsWith(entry.low));
    const source = fixture(manifest);
    source.body.geometry.addEventListener('dispose', () => releasedSources++);
    return new Promise(resolve => finish.push(() => resolve({scene: source.scene})));
  });
  const requests = choices.map(async ([assetId]) => {
    await prepareManufacturerCar(assetId, {low: true});
    const car = createManufacturerCar({assetId, low: true});
    cars.push(car);
    return car;
  });
  for (let batch = 0; batch < 3; batch++) {
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(finish.length, 2);
    finish.splice(0).forEach(resolve => resolve());
  }
  await Promise.all(requests);
  assert.equal(cars.length, choices.length);
  assert.equal(releasedSources, 0, 'a visible instance prevents source-resource eviction');
  for (const [assetId] of choices) assert.equal(isManufacturerCarReady(assetId, {low: true}), true);
  for (const car of cars) car.dispose();
  assert.equal(releasedSources, choices.length - 2, 'after disposal only the two latest idle templates remain');
});

test('silently recovered texture failures reject the new car, release partial resources and allow a clean retry', async t => {
  const [activeId] = entries.find(([id]) => isManufacturerCarReady(id));
  const active = createManufacturerCar({assetId: activeId});
  t.after(() => active.dispose());
  let activeDisposals = 0;
  active.group.traverse(mesh => {
    if (mesh.isMesh) mesh.geometry.addEventListener('dispose', () => activeDisposals++);
  });
  const [id, manifest] = entries.find(([entryId]) => !isManufacturerCarReady(entryId));
  const failed = fixture(manifest), retried = fixture(manifest), managers = [];
  let calls = 0, failedDisposals = 0;
  for (const resource of [failed.body.geometry, failed.paint, failed.paint.map]) {
    resource.addEventListener('dispose', () => failedDisposals++);
  }
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async function() {
    managers.push(this.manager);
    if (++calls === 1) {
      // This is GLTFLoader's texture-error behavior: the manager reports the
      // failed image, but loading the overall glTF still resolves successfully.
      this.manager.itemError('blob:https://fixture.invalid/blocked-texture');
      return {scene: failed.scene};
    }
    return {scene: retried.scene};
  });

  await assert.rejects(prepareManufacturerCar(id, {low: true}), /textures could not be loaded/);
  assert.equal(isManufacturerCarReady(id), false);
  assert.throws(() => createManufacturerCar({assetId: id}), /not ready/);
  assert.equal(failedDisposals, 3, 'partial geometry, material and texture are released');
  assert.equal(activeDisposals, 0, 'a failed selection cannot dispose the current car');
  active.update({time: 1}); active.update({time: 1.04, speed: 20});
  assert.ok(active.group.getObjectByName('wheel_front_left').children[0].rotation.x > 0);

  await prepareManufacturerCar(id, {low: true});
  assert.equal(calls, 2);
  assert.notEqual(managers[0], managers[1], 'failure tracking belongs to one load attempt');
  const recovered = createManufacturerCar({assetId: id, low: true});
  assert.ok(materialsOf(recovered.group).some(material => material.map === retried.paint.map));
  recovered.dispose();
});


test('real distance tiers keep the near source intact, switch with hysteresis and dispose instance-owned materials',async t=>{
 const [id,manifest]=entries.find(([id])=>!isManufacturerCarReady(id));
 const sources=[];
 t.mock.method(GLTFLoader.prototype,'loadAsync',async url=>{const source=fixture(manifest);sources.push({url,source});return {scene:source.scene};});
 await prepareManufacturerCar(id,{low:true});const car=createManufacturerCar({assetId:id,low:true});
 const nearBody=car.group.getObjectByName('sprung-body');assert.equal(nearBody.visible,true);
 await car.prepareDistanceDetail();assert.equal(sources.length,2);assert.match(sources[1].url,/-distance.glb/);
 car.setDistanceDetail(90);assert.equal(car.group.userData.distanceDetail.tier,'distance');assert.equal(nearBody.visible,false);
 const far=car.group.children.find(child=>child.userData.kind==='manufacturer-car');assert.ok(far.visible);
 const farMaterials=materialsOf(far);assert.ok(farMaterials.every(m=>!m.isMeshPhysicalMaterial));
 far.traverse(mesh=>{if(mesh.isMesh){assert.equal(mesh.castShadow,false);assert.equal(mesh.material.normalMap,null);}});
 car.setDistanceDetail(59);assert.equal(car.group.userData.distanceDetail.tier,'distance');car.setDistanceDetail(40);assert.equal(nearBody.visible,true);assert.equal(far.visible,false);
 let released=0;farMaterials.forEach(m=>m.addEventListener('dispose',()=>released++));car.dispose();car.dispose();assert.equal(released,farMaterials.length);
});

test('a failed background distance load leaves the authentic near car visible and usable',async t=>{
 const [id,manifest]=entries.find(([id])=>!isManufacturerCarReady(id));
 t.mock.method(GLTFLoader.prototype,'loadAsync',async url=>{if(url.includes('-distance'))throw new Error('offline');return {scene:fixture(manifest).scene};});
 await prepareManufacturerCar(id,{low:true});const car=createManufacturerCar({assetId:id,low:true});
 assert.equal(await car.prepareDistanceDetail(),false);car.setDistanceDetail(300);assert.equal(car.group.userData.distanceDetail.tier,'near');
 assert.equal(car.group.getObjectByName('sprung-body').visible,true);car.update({time:1});car.update({time:1.1,speed:20});car.dispose();
});


test('switching a crashed manufacturer car to distance detail keeps fragment expiry and recovery alive without new deformation',async t=>{
 const [id,manifest]=entries.find(([id,entry])=>!isManufacturerCarReady(id)&&entry.paintable!==false&&entry.paintMaterialNames?.length);
 t.mock.method(GLTFLoader.prototype,'loadAsync',async url=>{
  const source=fixture(manifest);
  if(!url.includes('-distance')){source.body.geometry.dispose();source.body.geometry=new THREE.BoxGeometry(1.6,.8,4.2,20,12,40);}
  return {scene:source.scene};
 });
 await prepareManufacturerCar(id,{low:true});const car=createManufacturerCar({assetId:id,low:true}),scene=new THREE.Scene();scene.add(car.group);t.after(()=>car.dispose());
 await car.prepareDistanceDetail();
 const impact={id:1,kind:'crash',severity:'wreck',remaining:.8,strength:1,localX:-.8,localZ:.3,localNX:1,localNZ:0,nx:1,nz:0,y:0};
 const input={raceId:'distance-damage',impact,recovery:{id:0},car:{vx:8,vz:4}};
 car.update({...input,time:0});car.update({...input,time:.02});
 const stats=car.group.userData.damage,fragments=scene.getObjectByName('detached-body-fragments');
 assert.equal(stats.fragments,2);assert.equal(stats.dents,1);
 const before=fragments.children[0].position.clone();car.setDistanceDetail(90);assert.equal(car.group.userData.distanceDetail.tier,'distance');
 const farInput={...input,impact:{...impact,id:2}};
 car.update({...farInput,time:.04});assert.notDeepEqual(fragments.children[0].position.toArray(),before.toArray(),'existing world debris continues moving');
 assert.equal(stats.dents,1,'distant impacts do not scan and deform the hidden source');
 for(let i=1;i<=180;i++)car.update({...farInput,time:.04+i/60});
 assert.equal(stats.fragments,0,'world debris expires while the car remains distant');
 car.setDistanceDetail(40);car.update({...farInput,time:3.06});assert.equal(stats.dents,1,'a consumed distant impact is not replayed on the near body');
 car.setDistanceDetail(90);car.update({...farInput,recovery:{id:1},impact:{...impact,id:2,remaining:0},time:3.08});
 assert.equal(stats.dents,0,'recovery restores the hidden near body');
 assert.equal(car.group.getObjectByName('crash-undertray'),undefined);
});


test('idle source memory obeys a byte ceiling without evicting the just-prepared or active model',async t=>{
 const [id,manifest]=entries.find(([id])=>!isManufacturerCarReady(id));const source=fixture(manifest);
 source.paint.map.image={width:4096,height:4096};let released=0;source.paint.map.addEventListener('dispose',()=>released++);
 t.mock.method(GLTFLoader.prototype,'loadAsync',async()=>({scene:source.scene}));
 await prepareManufacturerCar(id,{low:true});assert.equal(isManufacturerCarReady(id,{low:true}),true);
 const car=createManufacturerCar({assetId:id,low:true});await new Promise(r=>setTimeout(r,5));assert.equal(released,0);
 assert.ok(manufacturerCacheStatus().estimatedResidentBytes>manufacturerCacheStatus().idleByteLimit);
 car.dispose();assert.equal(released,1);assert.equal(isManufacturerCarReady(id,{low:true}),false);
 assert.ok(manufacturerCacheStatus().idleEstimatedBytes<=manufacturerCacheStatus().idleByteLimit);
});

test('context-lost distance warmup remains hidden and retries after restoration',async t=>{
 const [id,manifest]=entries.find(([id])=>id==='ferrari-testarossa');
 t.mock.method(GLTFLoader.prototype,'loadAsync',async()=>({scene:fixture(manifest).scene}));
 await prepareManufacturerCar(id,{low:true});const car=createManufacturerCar({assetId:id,low:true});t.after(()=>car.dispose());
 let lost=true,compiled=0;const camera=new THREE.PerspectiveCamera(),scene=new THREE.Scene(),renderer={getContext:()=>({isContextLost:()=>lost}),initTexture(){},async compileAsync(){compiled++;}};
 const preparation={renderer,camera,scene,yieldControl:async()=>{}};
 assert.equal(await car.prepareDistanceDetail(preparation),false);assert.equal(car.group.userData.distanceDetail.available,true);assert.equal(car.group.userData.distanceDetail.tier,'near');
 lost=false;assert.equal(await car.prepareDistanceDetail(preparation),true);assert.equal(compiled,1);car.setDistanceDetail(100);assert.equal(car.group.userData.distanceDetail.tier,'distance');
});
