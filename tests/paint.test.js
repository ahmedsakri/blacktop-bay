import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PAINT_KEY, loadPaint, savePaint, getPaint, applyPaint } from '../src/paint.js';
import { VEHICLES } from '../src/vehicles.js';
const memory = () => { const data = new Map(); return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}; };

test('all fourteen builds begin with their own factory colour and safe gloss finish', () => {
  const state = loadPaint(memory()); assert.equal(Object.keys(state).length,14);
  for (const v of VEHICLES) { assert.equal(getPaint(v.id,state[v.id]).color,v.color); assert.equal(state[v.id].finish,'gloss'); }
});
test('ten-car paint saves expand without repainting existing cars and new builds remain independent', () => {
  const storage=memory(); storage.setItem(PAINT_KEY,JSON.stringify({coupe:{color:'teal',finish:'metallic'},spyder:{color:'gold',finish:'satin'}}));
  const state=loadPaint(storage);
  assert.deepEqual(state.coupe,{color:'teal',finish:'metallic'});
  assert.deepEqual(state.spyder,{color:'gold',finish:'satin'});
  for(const id of ['kestrel','mirage','monoposto','tempest'])assert.deepEqual(state[id],{color:'factory',finish:'gloss'});
  savePaint(state,'mirage',{color:'pearl',finish:'satin'},storage);
  const reloaded=loadPaint(storage);
  assert.deepEqual(reloaded.mirage,{color:'pearl',finish:'satin'});
  assert.deepEqual(reloaded.tempest,{color:'factory',finish:'gloss'});
  assert.deepEqual(reloaded.spyder,{color:'gold',finish:'satin'});
});
test('colour and finish survive reload per car without modifying another build', () => {
  const storage=memory(), state=loadPaint(storage);
  assert.deepEqual(savePaint(state,'hyper',{color:'teal',finish:'metallic'},storage),{ok:true,persisted:true});
  const reload=loadPaint(storage); assert.deepEqual(reload.hyper,{color:'teal',finish:'metallic'}); assert.deepEqual(reload.prototype,{color:'factory',finish:'gloss'});
});
test('corrupt or unknown paint settings cannot inject arbitrary colour or material values', () => {
  const storage=memory();storage.setItem(PAINT_KEY,JSON.stringify({hyper:{color:'url(private)',finish:'unknown'},spyder:{color:'gold',finish:'satin'}}));
  const state=loadPaint(storage);assert.deepEqual(state.hyper,{color:'factory',finish:'gloss'});assert.deepEqual(state.spyder,{color:'gold',finish:'satin'});
  assert.equal(savePaint(state,'__proto__',{color:'teal'},storage).ok,false);
  storage.setItem(PAINT_KEY,'broken');assert.deepEqual(loadPaint(storage).hyper,{color:'factory',finish:'gloss'});
});
test('blocked storage still applies a session colour and reports it was not saved', () => {
  const storage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  const state=loadPaint(storage);assert.deepEqual(savePaint(state,'spyder',{color:'pearl',finish:'satin'},storage),{ok:true,persisted:false});assert.equal(state.spyder.color,'pearl');
});
test('paint changes body surfaces only, preserving glass, tyres, decals and performance', () => {
  const group=new THREE.Group(), body=new THREE.MeshPhysicalMaterial({color:'red'}),tyre=new THREE.MeshStandardMaterial({color:'black'});
  body.userData.bodyPaint=true;group.add(new THREE.Mesh(new THREE.BoxGeometry(),body),new THREE.Mesh(new THREE.BoxGeometry(),tyre));
  const oldTyre=tyre.color.getHex();const selected=applyPaint({group},'coupe',{color:'teal',finish:'satin'});
  assert.equal(body.color.getHexString(),new THREE.Color(selected.color).getHexString());assert.equal(body.roughness,.48);assert.equal(body.clearcoat,.28);assert.equal(tyre.color.getHex(),oldTyre);
  group.traverse(o=>{o.geometry?.dispose();});body.dispose();tyre.dispose();
});
