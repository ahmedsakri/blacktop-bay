import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGarageSet, createGarageContactShadow } from '../src/garage.js';

function dispose(set) {
  const geometry = new Set(), materials = new Set();
  set.traverse(object => { if (object.geometry) geometry.add(object.geometry); if (object.material) materials.add(object.material); });
  for (const resource of [...geometry, ...materials]) resource.dispose();
}

test('studio keeps contact height and a continuous LED mural outside the inspection area', t => {
  const set = createGarageSet(); t.after(() => dispose(set));
  const platform = set.getObjectByName('garage-platform');
  assert.ok(Math.abs(platform.position.y + platform.geometry.parameters.height / 2 - .0355) < 1e-9);
  assert.equal(platform.receiveShadow, true);
  assert.equal(set.getObjectByName('garage-floor').receiveShadow, true);
  const wall = set.getObjectByName('garage-led-mural'), p = wall.geometry.attributes.position;
  assert.equal(wall.geometry.parameters.thetaLength, Math.PI * 2, 'every orbit angle has a complete display backdrop');
  for (let i = 0; i < p.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(p, i);
    assert.ok(point.toArray().every(Number.isFinite));
    assert.ok(Math.hypot(point.x, point.z) > 11.99, 'display cannot intersect the car or its plinth');
  }
});

test('LED backdrop cannot hide the car as mobile and garage cameras orbit or move outside it', t => {
  const set = createGarageSet(); t.after(() => dispose(set)); set.updateMatrixWorld(true);
  const wall = set.getObjectByName('garage-led-mural'), rim = set.getObjectByName('garage-mural-surround');
  const coves = [set.getObjectByName('garage-lower-cove'), set.getObjectByName('garage-upper-cove')];
  for (const radius of [7.3, 9, 18, 30]) for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, origin = new THREE.Vector3(Math.sin(a) * radius, 1, Math.cos(a) * radius);
    const ray = new THREE.Raycaster(origin, new THREE.Vector3(-origin.x, 0, -origin.z).normalize());
    for (const hit of ray.intersectObjects([wall, rim, ...coves])) assert.ok(hit.distance > radius + 8, 'interior-only wall must be beyond, not in front of, the vehicle');
  }
});

test('mobile mural stays sharp with fewer polygons and no coloured paint lighting or animated grid', t => {
  const low = createGarageSet({low: true}), full = createGarageSet();
  t.after(() => { dispose(low); dispose(full); });
  for (const set of [low, full]) {
    let meshes = 0, lights = 0;
    set.traverse(object => { meshes += Boolean(object.isMesh); lights += Boolean(object.isLight); });
    assert.ok(meshes <= 14, 'studio architecture must stay inside its fixed draw budget');
    assert.equal(set.userData.stats.architecturalDrawCalls, meshes);
    assert.equal(lights, 0, 'accent artwork must not tint car paints');
    assert.equal(set.userData.stats.dynamicObjects, 0);
    const mural = set.getObjectByName('garage-led-mural');
    assert.equal(mural.material.side, THREE.BackSide);
    assert.equal(mural.material.uniforms.violet.value.getHexString(), '9246ff');
    assert.equal(mural.material.uniforms.time, undefined, 'LED artwork has no scrolling/flickering motion');
    assert.equal(mural.material.toneMapped, false);
  }
  assert.ok(low.getObjectByName('garage-led-mural').geometry.attributes.position.count < full.getObjectByName('garage-led-mural').geometry.attributes.position.count);
});

test('garage contact patches follow the selected car dimensions with one texture-free draw and finite wheel data',t=>{
  const contact=createGarageContactShadow();t.after(()=>dispose(contact.group));
  assert.equal(contact.group.visible,false);
  const tyreContacts=[{x:.9,z:1.2,width:.28,radius:.35},{x:-.9,z:1.2,width:.28,radius:.35},{x:1,z:-1.3,width:.32,radius:.38},{x:-1,z:-1.3,width:.32,radius:.38}];
  const car={userData:{dimensions:{width:2.1,length:4.5},tyreContacts}};
  assert.equal(contact.fit(car),true);assert.equal(contact.group.visible,true);
  const [plane]=contact.group.children,uniforms=plane.material.uniforms;
  assert.equal(contact.group.children.length,1);assert.equal(plane.geometry.index.count,6);
  assert.equal(plane.material.depthWrite,false);assert.equal(plane.material.map,undefined);
  assert.ok(plane.position.y>.0355&&plane.position.y<.038,'occlusion lies between the platform and tyre contact');
  for(const [index,patch] of tyreContacts.entries()){
    assert.equal(uniforms.contacts.value[index].x,patch.x);assert.equal(uniforms.contacts.value[index].y,patch.z);
    assert.ok(uniforms.contacts.value[index].z>0&&uniforms.contacts.value[index].w>0);
  }
  assert.deepEqual(uniforms.planeSize.value.toArray(),[3.3,5.7]);
  const compact={userData:{dimensions:{width:1.6,length:3.3},tyreContacts}};
  assert.equal(contact.fit(compact),true);assert.deepEqual(uniforms.planeSize.value.toArray(),[2.8,4.5]);
  assert.equal(contact.fit({userData:{dimensions:{width:2,length:4},tyreContacts:[...tyreContacts.slice(0,3),{...tyreContacts[3],radius:NaN}]}}),false);
  assert.equal(contact.group.visible,false,'invalid or absent contact metadata cannot leave a stale shadow under a different car');
  assert.equal(contact.fit(undefined),false);
});
