import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEffects } from '../src/effects.js';
import {createRace,startRace,stepRace,getTrack,sampleTrack} from '../src/physics.js';

test('an explicit empty exhaust profile removes previous emissions while preserving tyre effects', t => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => originalDocument
    ? Object.defineProperty(globalThis, 'document', originalDocument)
    : delete globalThis.document);
  globalThis.document = {
    createElement: () => ({ getContext: () => ({
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData() {},
    }) }),
  };
  const effects = createEffects(new THREE.Scene(), { low: true });
  t.after(() => effects.destroy());
  const profile = { rearAxle: -1.3, tyreOffset: .9, tyreWidth: .24, exhausts: [{ x: .5, y: .4, z: -2 }] };
  const noExhaust = { ...profile, exhausts: [] };
  const car = { x: 0, z: 0, yaw: 0, speed: 0, vx: 0, vz: 0 };
  const idle = selected => {
    for (let i = 0; i < 30; i++) effects.update(car, .05, i * .05, false, { menu: true, profile: selected });
  };

  idle(profile);
  assert.ok(effects.stats.emitted > 0, 'a verified combustion outlet emits exhaust');
  effects.clear();
  idle(noExhaust);
  assert.equal(effects.stats.emitted, 0, 'an electric/no-outlet car must not inherit previous exhausts');

  const drifting = { ...car, speed: 20, vx: 6, vz: 19, lateralSpeed: 6, drifting: true };
  effects.update(drifting, .08, 2, true, { profile: noExhaust, throttle: 1 });
  effects.update(drifting, .08, 2.08, true, { profile: noExhaust, throttle: 0 });
  assert.ok(effects.stats.clouds > 0, 'tyre smoke remains available');
  assert.ok(effects.stats.spray > 0, 'road spray remains available');
  assert.equal(effects.stats.flames, 0, 'lifting off an electric car cannot ignite an exhaust');

  effects.clear();
  idle(profile);
  assert.ok(effects.stats.emitted > 0, 'selecting a combustion car restores its verified exhaust');
});

function boostRig(t, low = false, exhausts = [{x: .4, y: .4, z: -2}]) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = {createElement: () => ({getContext: () => ({
    createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}), putImageData() {},
  })})};
  const scene = new THREE.Scene(), effects = createEffects(scene, {low});
  const car = {x: 0, z: 0, yaw: 0, speed: 30, vx: 0, vz: 30};
  const controls = {nitro: true, profile: {rearAxle: -1.3, tyreOffset: .9, tyreWidth: .24, exhausts}};
  t.after(() => {effects.destroy(); original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document;});
  const run = (n, options = {}, active = true) => {for (let i = 0; i < n; i++) effects.update(car, .05, i * .05, active, {...controls, ...options});};
  return {scene, effects, car, run};
}

test('Nitro emits bounded blue particles only during actual boost and fades on release', t => {
  const {scene, effects, run} = boostRig(t, true);
  run(30, {nitro: false}); assert.equal(effects.stats.nitro, 0);
  run(40); assert.ok(effects.stats.nitro > 0); assert.ok(effects.stats.nitroCores > 0);
  assert.ok(effects.stats.nitro <= 48); assert.ok(effects.stats.nitroCores <= 12);
  const batch = scene.getObjectByName('nitro-blue-plume');
  const colour = batch.geometry.attributes.particleColor.array;
  assert.ok(colour[2] > colour[1] && colour[1] > colour[0], 'plume has a blue hue, not grey tyre smoke');
  run(20, {nitro: false}); assert.equal(effects.stats.nitro, 0); assert.equal(effects.stats.nitroCores, 0);
  run(20, {menu: true}, false); assert.equal(effects.stats.nitro, 0, 'a retained boost flag cannot emit in a menu');
});

test('boost pauses freeze particles; reset and teleport remove the old trail', t => {
  const {scene, effects, car, run} = boostRig(t);
  run(8);
  const shape = scene.getObjectByName('nitro-blue-plume').geometry.attributes.particleShape.array;
  const before = Array.from(shape); run(12, {}, false); assert.deepEqual(Array.from(shape), before);
  car.z = 200; run(1, {nitro: false}); assert.equal(effects.stats.nitro, 0); assert.equal(effects.stats.nitroCores, 0);
  run(5); effects.clear(); assert.equal(effects.stats.nitro, 0); assert.equal(effects.stats.nitroCores, 0);
});

test('electric cars get a blue rear wake without fabricated exhaust flames', t => {
  const {effects, run} = boostRig(t, true, []);
  run(20); assert.ok(effects.stats.nitro > 0); assert.equal(effects.stats.nitroCores, 0); assert.equal(effects.stats.flames, 0);
  run(20, {brake: true}); assert.equal(effects.stats.nitro, 0, 'braking blocks boost emissions');
});

test('reduced motion makes Nitro quieter and removes its bright exhaust core', t => {
  const {effects, run} = boostRig(t);
  run(20); const normal = effects.stats.nitro;
  effects.clear(); run(20, {reducedMotion: true});
  assert.ok(effects.stats.nitro > 0 && effects.stats.nitro < normal / 2);
  assert.equal(effects.stats.nitroCores, 0);
});

test('Nitro jets follow rear outlets and yaw, fade on release, disappear for EVs and reduced motion',t=>{
 const {scene,effects,car,run}=boostRig(t,false,[{x:.4,y:.5,z:-2.2}]);
 car.x=10;car.z=20;car.yaw=Math.PI/2;run(12);
 const jets=scene.getObjectByName('nitro-directional-jets'),matrix=new THREE.Matrix4();
 assert.equal(jets.count,1);jets.getMatrixAt(0,matrix);
 const nozzle=new THREE.Vector3(0,0,0).applyMatrix4(matrix),tip=new THREE.Vector3(0,0,-1).applyMatrix4(matrix);
 assert.ok(Math.abs(nozzle.x-7.8)<1e-5&&Math.abs(nozzle.z-19.6)<1e-5);
 assert.ok(tip.x<nozzle.x-.8&&Math.abs(tip.z-nozzle.z)<1e-5,'jet extends behind the car, not up the camera');
 assert.ok(jets.material.uniforms.strength.value>.95);
 run(1,{nitro:false});assert.ok(jets.material.uniforms.strength.value<.8,'release eases rather than retaining full thrust');
 run(20,{nitro:false});assert.equal(jets.count,0);
 run(3);run(1,{reducedMotion:true});assert.equal(jets.count,0);
 run(3);run(1,{profile:{rearAxle:-1.3,tyreOffset:.9,tyreWidth:.24,exhausts:[]}});assert.equal(jets.count,0);
 effects.clear();assert.equal(jets.visible,false);
});

test('dry venue selection suppresses wet spray without suppressing drift smoke or Nitro',t=>{
 const {effects,car,run}=boostRig(t,true);
 car.lateralSpeed=5;car.drifting=true;
 run(10,{wetRoad:false});
 assert.equal(effects.stats.spray,0);assert.ok(effects.stats.clouds>0);assert.ok(effects.stats.nitro>0);
});


function impactRig(t,low=true) {
  const rig=boostRig(t,low,[]);
  Object.assign(rig.car,{speed:0,vx:0,vz:0});
  rig.hit=(impact,options={},active=true)=>rig.run(1,{nitro:false,wetRoad:false,collision:true,impact,...options},active);
  return rig;
}
const hardContact = (id=1) => ({id,kind:'crash',source:'barrier',remaining:.8,strength:1,x:1,z:0,nx:-1,nz:0});

test('a stopped-after-impact car emits a directional burst once per real impact event',t=>{
  const {scene,effects,car,hit}=impactRig(t);
  const impact=hardContact(),snapshot=structuredClone(car);
  hit(impact);
  assert.equal(effects.stats.impactBursts,1);
  assert.ok(effects.stats.sparks>=17,'hard-hit sparks remain visible on the mobile budget');
  assert.equal(effects.stats.debris,7);assert.equal(effects.stats.clouds,3);
  const sparks=scene.getObjectByName('contact-sparks'),positions=sparks.geometry.attributes.particlePosition.array;
  for(let i=0;i<effects.stats.sparks;i++) {
    assert.ok(Number.isFinite(positions[i*3]));
    assert.ok(positions[i*3]<impact.x,'all sparks travel away from the actual contact normal');
  }
  const emitted=effects.stats.emitted;
  hit(impact);assert.equal(effects.stats.emitted,emitted,'remaining collision timer cannot retrigger the same impact');
  hit({...hardContact(2),source:'car'});assert.equal(effects.stats.impactBursts,2,'a new car hit is not lost during an existing collision');
  assert.deepEqual(car,snapshot,'effects never move or modify the car');
});

test('scrape escalation uses separate events, while expired impacts and the menu emit nothing',t=>{
  const {effects,hit}=impactRig(t);
  hit({...hardContact(),kind:'scrape',strength:.1});
  assert.equal(effects.stats.sparks,4);assert.equal(effects.stats.debris,0);assert.equal(effects.stats.clouds,0);
  hit(hardContact(2));assert.ok(effects.stats.debris>0,'a hard hit is not swallowed by scrape cooldown');
  effects.clear();hit({...hardContact(),remaining:0});assert.equal(effects.stats.emitted,0);
  effects.clear();hit(hardContact(),{menu:true},false);assert.equal(effects.stats.emitted,0);
  hit(hardContact());assert.equal(effects.stats.impactBursts,1,'a later active race still receives its real event');
});

test('contact pools are fixed, pause freezes them, and all fragments expire or clear',t=>{
  const {scene,effects,hit,run}=impactRig(t);
  const objects=scene.children.length;
  hit(hardContact());
  const mesh=scene.getObjectByName('contact-road-fragments'),snapshot=Array.from(mesh.geometry.attributes.particlePosition.array);
  hit(hardContact(),{},false);assert.deepEqual(Array.from(mesh.geometry.attributes.particlePosition.array),snapshot);
  for(let id=2;id<80;id++)hit(hardContact(id));
  assert.equal(scene.children.length,objects,'repeated impacts allocate no scene objects or materials');
  assert.ok(effects.stats.sparks<=36);assert.ok(effects.stats.debris<=12);
  assert.equal(effects.stats.budget.debris,12);assert.equal(effects.stats.budget.sparks,36);
  run(25,{nitro:false,wetRoad:false});assert.equal(effects.stats.sparks,0);assert.equal(effects.stats.debris,0);
  effects.clear();assert.equal(effects.stats.impactBursts,0);assert.equal(effects.stats.emitted,0);assert.equal(mesh.visible,false);
});

test('crash skids follow real tyre travel; reduced motion suppresses burst movement',t=>{
  const {scene,effects,car,hit,run}=impactRig(t);
  run(1,{nitro:false,wetRoad:false});car.z=.3;
  hit(hardContact(),{reducedMotion:true});
  assert.equal(effects.stats.sparks,0);assert.equal(effects.stats.debris,0);assert.equal(effects.stats.clouds,0);
  assert.equal(effects.stats.marks,4,'four tyre paths describe the actual short impact movement');
  const positions=scene.getObjectByName('grounded-tyre-marks').geometry.attributes.position.array;
  assert.ok(Array.from(positions.slice(0,72)).every(Number.isFinite));
  effects.clear();run(1,{nitro:false,wetRoad:false});car.z=200;
  hit({...hardContact(2),z:200},{reducedMotion:true});assert.equal(effects.stats.marks,0,'recovery cannot invent a long skid');
});

test('a real engine barrier collision supplies the rendered point and rebound direction',t=>{
  const {scene,effects}=impactRig(t);
  const race=createRace({track:'breakwater',mode:'time-attack'});startRace(race);
  const track=getTrack(race.track),p=sampleTrack(110,track),lane=track.width/2-.95-.002;
  Object.assign(race.car,{x:p.x+p.nx*lane,z:p.z+p.nz*lane,yaw:Math.atan2(p.tx+p.nx,p.tz+p.nz),vx:(p.tx+p.nx)*18,vz:(p.tz+p.nz)*18,speed:Math.hypot(18,18),forwardSpeed:25});
  race._lastTrackS=110;race._safeS=110;race._trackIndex=p.index;
  stepRace(race,{throttle:1},1/120);
  assert.equal(race.impact.kind,'crash');assert.ok(race.impact.nx*p.nx+race.impact.nz*p.nz<-.99);
  const before=structuredClone(race);
  effects.update(race.car,.016,0,true,{impact:race.impact,wetRoad:false,profile:{rearAxle:-1.3,tyreOffset:.9,tyreWidth:.24,exhausts:[]}});
  assert.equal(effects.stats.impactBursts,1);assert.ok(effects.stats.sparks>0);
  const positions=scene.getObjectByName('contact-sparks').geometry.attributes.particlePosition.array;
  assert.ok(Math.hypot(positions[0]-race.impact.x,positions[2]-race.impact.z)<.25,'spark starts at the actual engine contact, not the track centre');
  assert.deepEqual(race,before,'rendering cannot change progression or physics');
});
