import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTROL_DEFAULTS,normalizePlayerControls,actionForKey,remapControl,createNitroLatch,keyLabel} from '../src/player-controls.js';

test('stored control settings clamp touch geometry and recover malformed maps atomically',()=>{
 const defaults=normalizePlayerControls();
 for(const bad of [undefined,null,42,'bad'])assert.deepEqual(normalizePlayerControls(bad),defaults);
 const controls=normalizePlayerControls({touchSize:20,touchInset:-5,touchLift:999,motion:'flash',nitroToggle:'true',bindings:{left:'KeyQ'}});
 assert.equal(controls.touchSize,1.15);assert.equal(controls.touchInset,0);assert.equal(controls.touchLift,36);
 assert.equal(controls.motion,'system');assert.equal(controls.nitroToggle,false);assert.deepEqual(controls.bindings,CONTROL_DEFAULTS);
 assert.deepEqual(normalizePlayerControls({bindings:{...CONTROL_DEFAULTS,right:'ArrowLeft'}}).bindings,CONTROL_DEFAULTS);
 assert.equal(normalizePlayerControls({touchSize:NaN,touchInset:Infinity}).touchSize,1);
});

test('remapping rejects occupied or unsupported keys without mutating the supplied settings',()=>{
 const controls=normalizePlayerControls(),before=structuredClone(controls);
 const conflict=remapControl(controls,'left','ArrowRight');assert.equal(conflict.ok,false);assert.match(conflict.error,/already used/);
 assert.deepEqual(conflict.controls,controls);assert.deepEqual(controls,before);
 for(const action of ['bogus','constructor','__proto__'])assert.equal(remapControl(controls,action,'KeyQ').ok,false,action);
 assert.equal(remapControl(controls,'left','MetaLeft').ok,false);
 const changed=remapControl(controls,'left','KeyQ');assert.equal(changed.ok,true);assert.equal(changed.controls.bindings.left,'KeyQ');
 assert.deepEqual(controls,before);assert.equal(remapControl(changed.controls,'left','KeyQ').ok,true);
});

test('default aliases remain convenient but never shadow explicitly remapped actions',()=>{
 const base=normalizePlayerControls();
 for(const [code,action] of [['KeyA','left'],['KeyD','right'],['KeyS','brake'],['ShiftRight','nitro'],['KeyP','pause']])assert.equal(actionForKey(code,base),action);
 const moved=remapControl(base,'left','KeyQ').controls;
 assert.equal(actionForKey('KeyQ',moved),'left');assert.equal(actionForKey('KeyA',moved),null);assert.equal(actionForKey('ArrowLeft',moved),null);
 const reserved=remapControl(base,'reset','KeyA').controls;
 assert.equal(actionForKey('KeyA',reserved),'reset');assert.equal(actionForKey('ArrowLeft',reserved),'left');
 for(const code of ['KeyX','constructor','toString','__proto__',null])assert.equal(actionForKey(code,base),null);assert.equal(keyLabel('KeyQ'),'Q');assert.equal(keyLabel('ShiftRight'),'Right Shift');
});

test('held and toggle Nitro use edges, ignore held repeats and clear across pause/blur/rotation lifecycle',()=>{
 const latch=createNitroLatch();
 assert.equal(latch.sample(true,false),true);assert.equal(latch.sample(false,false),false);
 assert.equal(latch.sample(true,true),true);assert.equal(latch.active,true);
 for(let i=0;i<30;i++)assert.equal(latch.sample(true,true),true);
 assert.equal(latch.sample(false,true),true);assert.equal(latch.sample(true,true),false);assert.equal(latch.sample(false,true),false);
 for(const lifecycle of ['pause','blur','rotation','lost-pointer','garage']){
  assert.equal(latch.sample(true,true),true,lifecycle);latch.clear();assert.equal(latch.active,false);
  assert.equal(latch.sample(false,true),false);
 }
 latch.sample(true,true);assert.equal(latch.sample(false,false),false);assert.equal(latch.active,false);
});
