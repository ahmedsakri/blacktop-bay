import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PAINT_KEY, loadPaint, savePaint, getPaint, applyPaint } from '../src/paint.js';
import { VEHICLES } from '../src/vehicles.js';
import { LEGACY_VEHICLES } from '../src/legacy-vehicles.js';
const memory = () => { const data = new Map(); return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}; };
const [first, second] = VEHICLES.map(car => car.id);
// Fixed release IDs keep migration fixtures independent of catalogue order.
const released16Ids = ['mclaren-570s', 'mclaren-senna', 'mclaren-p1-gtr', 'ferrari-458-italia',
  'lamborghini-aventador', 'koenigsegg-one-1', 'pagani-zonda-c12', 'bugatti-veyron',
  'maserati-mc-stradale', 'lotus-elise', 'audi-r8', 'rimac-concept-one',
  'porsche-930-turbo', 'gma-t50', 'aston-martin-one-77', 'rimac-nevera'];
const released27Ids = [...released16Ids, 'porsche-911-gt3', 'lamborghini-gallardo',
  'lamborghini-huracan', 'bmw-i8', 'bmw-f22-eurofighter', 'audi-r8-lms-gt3', 'audi-r18',
  'ferrari-250-gto', 'ferrari-testarossa', 'mercedes-amg-gt', 'nissan-gt-r-2018'];
const currentSixIds = ['mclaren-650s-gt3', 'bmw-m3-e46', 'audi-quattro-rally',
  'lamborghini-countach-lp500s', 'ferrari-enzo', 'porsche-919-hybrid'];


test('all available cars begin with their own factory colour and safe gloss finish', () => {
  const state = loadPaint(memory()); assert.equal(Object.keys(state).length, VEHICLES.length);
  assert.deepEqual(Object.keys(state), VEHICLES.map(car => car.id));
  for (const v of VEHICLES) { assert.equal(getPaint(v.id,state[v.id]).color,v.color); assert.equal(state[v.id].finish,'gloss'); }
});

test('existing manufacturer and retired paint survives current-car paint changes and reloading', () => {
  const storage = memory();
  const previous = Object.fromEntries([...LEGACY_VEHICLES, ...VEHICLES].map(({id}, i) => [id,
    {color: i % 2 ? 'teal' : 'gold', finish: i % 2 ? 'metallic' : 'satin'},
  ]));
  storage.setItem(PAINT_KEY, JSON.stringify(previous));
  const state = loadPaint(storage);
  assert.deepEqual(state, previous);
  assert.deepEqual(savePaint(state, first, {color:'pearl',finish:'satin'}, storage), {ok:true,persisted:true});
  const reloaded = loadPaint(storage);
  assert.deepEqual(reloaded, {...previous, [first]: {color:'pearl',finish:'satin'}});
  assert.deepEqual(JSON.parse(storage.getItem(PAINT_KEY)), reloaded);
});

for (const releasedIds of [released16Ids, released27Ids]) {
  test(`released ${releasedIds.length}-car paint survives expansion and every new finish saves independently`, () => {
    const additions = VEHICLES.map(car => car.id).filter(id => !releasedIds.includes(id));
    assert.equal(additions.length, VEHICLES.length - releasedIds.length);
    if (releasedIds === released27Ids) assert.deepEqual(new Set(additions), new Set(currentSixIds));
    const previous = Object.fromEntries(releasedIds.map((id, i) => [id,
      {color: i % 2 ? 'teal' : 'gold', finish: i % 2 ? 'metallic' : 'satin'},
    ]));
    const storage = memory(), saved = JSON.stringify(previous);
    storage.setItem(PAINT_KEY, saved);
    const state = loadPaint(storage), factory = {color:'factory',finish:'gloss'};
    assert.equal(Object.keys(state).length, VEHICLES.length);
    for (const id of releasedIds) assert.deepEqual(state[id], previous[id]);
    for (const id of additions) assert.deepEqual(state[id], factory);
    assert.equal(new Set(Object.values(state)).size, VEHICLES.length, 'every finish is a separate record');
    assert.equal(storage.getItem(PAINT_KEY), saved, 'loading leaves the released save intact');

    const choices = [{color:'blue',finish:'metallic'}, {color:'violet',finish:'satin'}, {color:'pearl',finish:'gloss'}];
    const expected = {...previous, ...Object.fromEntries(additions.map(id => [id, {...factory}]))};
    for (const [i, id] of additions.entries()) {
      const choice = choices[i % choices.length];
      assert.deepEqual(savePaint(state, id, choice, storage), {ok:true,persisted:true});
      expected[id] = {...choice};
      assert.deepEqual(loadPaint(storage), expected, `${id} reloads without changing another old or new finish`);
    }
    assert.deepEqual(JSON.parse(storage.getItem(PAINT_KEY)), expected);
  });
}

test('legacy-only paint saves initialize independent manufacturer finishes and preserve stored legacy choices', () => {
  const storage = memory();
  storage.setItem(PAINT_KEY, JSON.stringify({coupe:{color:'teal',finish:'metallic'},spyder:{color:'gold',finish:'satin'}}));
  const state = loadPaint(storage);
  assert.deepEqual(state.coupe, {color:'teal',finish:'metallic'});
  assert.deepEqual(state.spyder, {color:'gold',finish:'satin'});
  assert.equal(Object.keys(state).length, VEHICLES.length + 2, 'unsaved retired records are not added');
  for (const {id} of VEHICLES) assert.deepEqual(state[id], {color:'factory',finish:'gloss'});
  savePaint(state, first, {color:'pearl',finish:'satin'}, storage);
  const reloaded = loadPaint(storage);
  assert.deepEqual(reloaded[first], {color:'pearl',finish:'satin'});
  assert.deepEqual(reloaded[second], {color:'factory',finish:'gloss'});
  assert.deepEqual(reloaded.coupe, state.coupe);
  assert.deepEqual(reloaded.spyder, state.spyder);
});

test('retired car paint cannot be changed through the public paint API', () => {
  const storage = memory(), previous = Object.fromEntries(LEGACY_VEHICLES.map(({id}) => [id, {color:'gold',finish:'satin'}]));
  storage.setItem(PAINT_KEY, JSON.stringify(previous));
  const state = loadPaint(storage), before = JSON.stringify(state), saved = storage.getItem(PAINT_KEY);
  for (const {id} of LEGACY_VEHICLES) assert.deepEqual(savePaint(state,id,{color:'teal',finish:'gloss'},storage),{ok:false,persisted:false});
  assert.equal(JSON.stringify(state), before);
  assert.equal(storage.getItem(PAINT_KEY), saved);
});

test('colour and finish survive reload per car without modifying another build', () => {
  const storage = memory(), state = loadPaint(storage);
  assert.deepEqual(savePaint(state,first,{color:'teal',finish:'metallic'},storage),{ok:true,persisted:true});
  const reload = loadPaint(storage); assert.deepEqual(reload[first],{color:'teal',finish:'metallic'}); assert.deepEqual(reload[second],{color:'factory',finish:'gloss'});
});

test('corrupt or unknown paint settings cannot inject arbitrary colour or material values', () => {
  const storage = memory();
  storage.setItem(PAINT_KEY,JSON.stringify({[first]:{color:'url(private)',finish:'unknown'},spyder:{color:'gold',finish:'satin'},coupe:{color:'invalid',finish:'invalid'},unknown:{color:'teal',finish:'gloss'}}));
  const state = loadPaint(storage);
  assert.deepEqual(state[first],{color:'factory',finish:'gloss'});
  assert.deepEqual(state.spyder,{color:'gold',finish:'satin'});
  assert.deepEqual(state.coupe,{color:'factory',finish:'gloss'});
  assert.equal(state.unknown, undefined);
  assert.equal(savePaint(state,'__proto__',{color:'teal'},storage).ok,false);
  for (const raw of ['broken', 'null', '[]', '7']) {
    storage.setItem(PAINT_KEY,raw);
    assert.deepEqual(loadPaint(storage)[first],{color:'factory',finish:'gloss'});
  }
});

test('blocked storage still applies a session colour and reports it was not saved', () => {
  const storage = {getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  const state = loadPaint(storage); assert.deepEqual(savePaint(state,first,{color:'pearl',finish:'satin'},storage),{ok:true,persisted:false}); assert.equal(state[first].color,'pearl');
});

test('paint changes body surfaces only, preserving glass, tyres, decals and performance', () => {
  const group = new THREE.Group(), body = new THREE.MeshPhysicalMaterial({color:'red'}), tyre = new THREE.MeshStandardMaterial({color:'black'});
  body.userData.bodyPaint = true; group.add(new THREE.Mesh(new THREE.BoxGeometry(),body),new THREE.Mesh(new THREE.BoxGeometry(),tyre));
  const oldTyre = tyre.color.getHex(); const selected = applyPaint({group}, first, {color:'teal',finish:'satin'});
  assert.equal(body.color.getHexString(),new THREE.Color(selected.color).getHexString()); assert.equal(body.roughness,.48); assert.equal(body.clearcoat,.28); assert.equal(tyre.color.getHex(),oldTyre);
  group.traverse(o=>{o.geometry?.dispose();}); body.dispose(); tyre.dispose();
});
