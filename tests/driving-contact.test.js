import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createNitroLatch,normalizePlayerControls,actionForKey} from '../src/player-controls.js';
import { bindDrivingContact, isDrivingContact } from '../src/driving-contact.js';
import { bindSteeringPad, bindDragSteering } from '../src/steering-pad.js';
import { createDragSteering } from '../src/drag-steering.js';
import { createDrivingInputs, resolveDriveControls } from '../src/driving-controls.js';

class Surface extends EventTarget {
  constructor(doc) { super(); this.ownerDocument = doc; this.bindings = []; this.captures = new Set(); }
  addEventListener(type, listener, options) { this.bindings.push({type, options}); super.addEventListener(type, listener, options); }
  getBoundingClientRect() { return {left:20, width:156}; }
  setPointerCapture(id) { this.captures.add(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
  emit(type, fields = {}) { const event = new Event(type, {cancelable:true}); Object.assign(event, fields); this.dispatchEvent(event); return event; }
  pointer(type, id, x=160, fields={}) { return this.emit(type, {pointerId:id,clientX:x,clientY:40,button:0,pointerType:'touch',...fields}); }
  touch(type, ...touches) { return this.emit(type, {changedTouches:touches.map(([identifier, clientX])=>({identifier,clientX,clientY:40}))}); }
}
function surfaces() { const window = new Surface(), doc = new Surface(); doc.defaultView = window; doc.hidden = false; return {window,doc,pad:new Surface(doc),nitro:new Surface(doc)}; }
function button(element, inputs, options={}) {
  return bindDrivingContact(element, {...options, onStart(e) { return inputs.press(e.pointerId,'nitro'); },onEnd(e) { inputs.release(e.pointerId); }});
}

test('touch and pen contact do not depend on mouse button or primary-pointer flags', () => {
  assert.equal(isDrivingContact({pointerType:'touch',button:-1,isPrimary:false}), true);
  assert.equal(isDrivingContact({pointerType:'pen',button:-1}), true);
  assert.equal(isDrivingContact({pointerType:'mouse',button:0}), true);
  assert.equal(isDrivingContact({pointerType:'mouse',button:2}), false);
  const {pad} = surfaces(), steering = createDragSteering();
  bindSteeringPad(pad, steering);
  assert.equal(pad.pointer('pointerdown',1,30,{button:-1,isPrimary:false}).defaultPrevented,true);
  assert.equal(steering.read(),-1);
  pad.pointer('pointercancel',1);
  assert.equal(steering.active(),false);
  pad.pointer('pointerdown',2,160,{pointerType:'pen',button:-1});
  assert.equal(steering.read(),1);
});

test('TouchEvent fallback works on a hybrid device even when PointerEvent exists but no pointerdown arrives', () => {
  const {pad,window} = surfaces(), steering = createDragSteering();
  window.PointerEvent = class {};
  bindSteeringPad(pad,steering);
  assert.equal(pad.touch('touchstart',[0,30]).defaultPrevented,true);
  assert.equal(steering.read(),-1);
  window.touch('touchmove',[0,160]);
  assert.equal(steering.read(),1);
  window.touch('touchend',[0,160]);
  assert.equal(steering.active(),false);
  const touchListeners=pad.bindings.filter(item=>item.type.startsWith('touch'));
  assert.ok(touchListeners.length>=4);
  assert.ok(touchListeners.every(item=>item.options.passive===false));
});

test('simultaneous fallback Nitro and thumb steering release independently outside either control', () => {
  const {pad,nitro,window} = surfaces(), steering=createDragSteering(), inputs=createDrivingInputs();
  bindSteeringPad(pad,steering); button(nitro,inputs);
  pad.touch('touchstart',[5,160]); nitro.touch('touchstart',[6,300]);
  assert.deepEqual(resolveDriveControls({...inputs.read(),steer:steering.read()}),{steer:1,throttle:1,brake:false,handbrake:false,nitro:true});
  window.touch('touchcancel',[6,900]);
  assert.equal(inputs.read().nitro,false); assert.equal(steering.read(),1);
  nitro.touch('touchstart',[7,300]);
  window.touch('touchend',[5,900]);
  assert.equal(steering.active(),false); assert.equal(inputs.read().nitro,true);
  window.touch('touchend',[7,900]); assert.equal(inputs.read().nitro,false);
});

test('simultaneous pointer Nitro and steering tolerate a non-primary contact and lost capture', () => {
  const {pad,nitro,window}=surfaces(), steering=createDragSteering(), inputs=createDrivingInputs();
  bindSteeringPad(pad,steering); button(nitro,inputs);
  nitro.pointer('pointerdown',1,300,{button:-1});
  pad.pointer('pointerdown',2,30,{button:-1,isPrimary:false});
  assert.equal(steering.read(),-1); assert.equal(inputs.read().nitro,true);
  nitro.pointer('lostpointercapture',1);
  assert.equal(inputs.read().nitro,false); assert.equal(steering.read(),-1);
  window.pointer('pointerup',2,600);
  assert.equal(steering.active(),false);
});

test('a browser delivering both pointer and touch streams starts and ends each gesture once', () => {
  const {pad}=surfaces(); const started=[],ended=[];
  bindDrivingContact(pad,{onStart:e=>started.push(e.pointerId),onEnd:e=>ended.push(e.pointerId)});
  pad.pointer('pointerdown',4); pad.touch('touchstart',[0,160]);
  assert.equal(started.length,1);
  pad.pointer('pointerup',4); pad.touch('touchend',[0,160]);
  assert.deepEqual(ended,[4]);
  pad.touch('touchstart',[1,160]); pad.pointer('pointerdown',5);
  assert.equal(started.length,2);
  pad.pointer('pointercancel',5);
  assert.equal(ended.length,1,'duplicate pointer cancellation does not clear the touch owner');
  pad.touch('touchend',[1,160]); pad.pointer('pointerup',5);
  assert.equal(ended.length,2); assert.equal(ended[1],started[1]);
});

test('a long touch cannot create a synthetic mouse press after release', () => {
  const {nitro}=surfaces(), inputs=createDrivingInputs(); let time=0;
  button(nitro,inputs,{now:()=>time});
  nitro.touch('touchstart',[1,300]); time=5000;
  nitro.touch('touchend',[1,300]);
  nitro.pointer('pointerdown',1,300,{pointerType:'mouse'});
  assert.equal(inputs.read().nitro,false);
  time+=801; nitro.pointer('pointerdown',1,300,{pointerType:'mouse'});
  assert.equal(inputs.read().nitro,true);
});

test('failed pointer capture still moves and releases through the owning window', () => {
  const {pad,window}=surfaces(), steering=createDragSteering();
  pad.setPointerCapture=()=>{throw new Error('Safari capture unavailable');};
  bindDragSteering(pad,steering,{width:()=>844});
  pad.pointer('pointerdown',3,100,{pointerType:'mouse'});
  window.pointer('pointermove',3,300,{pointerType:'mouse',button:-1});
  assert.equal(steering.read(),1);
  window.pointer('pointerup',3,300,{pointerType:'mouse'});
  assert.equal(steering.active(),false);
});

test('held multi-touch buttons remain active until their final owned contact ends', () => {
  const {nitro,window}=surfaces(), inputs=createDrivingInputs(); button(nitro,inputs);
  nitro.touch('touchstart',[2,200],[3,210]);
  window.touch('touchend',[2,200]); assert.equal(inputs.read().nitro,true);
  window.touch('touchcancel',[3,210]); assert.equal(inputs.read().nitro,false);
});

test('selection and callout prevention is restricted to enabled driving surfaces', () => {
  const {pad}=surfaces(); let enabled=true;
  bindDrivingContact(pad,{enabled:()=>enabled});
  for(const type of ['contextmenu','selectstart','dragstart']) assert.equal(pad.emit(type).defaultPrevented,true);
  enabled=false;
  for(const type of ['contextmenu','selectstart','dragstart']) assert.equal(pad.emit(type).defaultPrevented,false);
  assert.equal(pad.touch('touchstart',[1,160]).defaultPrevented,false);
});

test('blur, hidden page, rotation, disabled mode and cleanup clear contacts without stale moves rearming them', () => {
  for (const trigger of ['blur','pagehide','orientationchange','hidden','disabled','cleanup']) {
    const {pad,window,doc}=surfaces(), steering=createDragSteering(); let enabled=true;
    const cleanup=bindSteeringPad(pad,steering,{enabled:()=>enabled});
    pad.touch('touchstart',[1,160]); assert.equal(steering.read(),1);
    if(trigger==='hidden') {doc.hidden=true;doc.emit('visibilitychange');}
    else if(trigger==='disabled') {enabled=false;window.touch('touchmove',[1,30]);}
    else if(trigger==='cleanup') cleanup();
    else window.emit(trigger);
    assert.equal(steering.active(),false,trigger);
    enabled=true;window.touch('touchmove',[1,30]);
    assert.equal(steering.active(),false,`${trigger}: stale move`);
    cleanup();
  }
});


test('pad and canvas wrappers retain clear without removing fresh-contact listeners',()=>{
 for(const bind of [bindSteeringPad,bindDragSteering]) {
  const {pad,window}=surfaces(),steering=createDragSteering();
  const binding=bind(pad,steering,{width:()=>844});assert.equal(typeof binding.clear,'function');
  pad.pointer('pointerdown',10,30);window.pointer('pointermove',10,160);
  assert.equal(steering.active(),true);binding.clear();
  assert.equal(steering.active(),false);assert.equal(pad.captures.size,0);
  window.pointer('pointermove',10,30);assert.equal(steering.active(),false);
  // Reusing the same ID demonstrates that the adapter map was actually emptied.
  pad.pointer('pointerdown',10,160);assert.equal(steering.active(),true);
  binding.clear();binding.clear();assert.equal(steering.active(),false);
  pad.touch('touchstart',[0,30]);assert.equal(steering.active(),true);
  binding.clear();window.touch('touchmove',[0,160]);assert.equal(steering.active(),false);
  pad.touch('touchstart',[0,160]);assert.equal(steering.active(),true);
  binding();
 }
});

test('actual main clearInput clears adapter ownership, latch and driving state across pause and resume',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const from=main.indexOf('function syncInput() {'),to=main.indexOf('function updateMenu() {',from);
 assert.ok(from>=0&&to>from);
 for(const path of ['pointer','touch']) {
  const {pad,nitro,window}=surfaces(),dragSteering=createDragSteering(),pointerInputs=createDrivingInputs(),nitroLatch=createNitroLatch(),drivingBindings=[];
  const classes=new Set();nitro.dataset={input:'nitro'};nitro.classList={toggle(name,on){if(on)classes.add(name);else classes.delete(name);},remove:name=>classes.delete(name)};
  nitro.setAttribute=(name,value)=>{nitro[name]=value;};
  const context=vm.createContext({mode:'racing',dragSteering,pointerInputs,nitroLatch,drivingBindings,actionForKey,
   heldKeys:new Set(),heldPads:new Set(),input:{left:false,right:false,brake:false,drift:false,nitro:false},preferences:{controls:normalizePlayerControls()},
   tiltSteering:{clear(){}},analogSteering:0,tiltGraceUntil:0,performance:{now:()=>1000},document:{querySelectorAll:()=>[nitro]}});
  vm.runInContext(main.slice(from,to),context);
  const enabled=()=>context.mode==='racing';
  drivingBindings.push(bindSteeringPad(pad,dragSteering,{enabled}));
  drivingBindings.push(bindDrivingContact(nitro,{enabled,onStart(e){const accepted=pointerInputs.press(e.pointerId,'nitro');context.syncInput();return accepted;},onEnd(e){pointerInputs.release(e.pointerId);context.syncInput();}}));
  const start=()=>path==='pointer'?(pad.pointer('pointerdown',1,160),nitro.pointer('pointerdown',2,300)):(pad.touch('touchstart',[1,160]),nitro.touch('touchstart',[2,300]));
  start();assert.equal(context.input.nitro,true);assert.equal(dragSteering.read(),1);assert.equal(classes.has('pressed'),true);
  nitroLatch.sample(true,true);context.heldKeys.add('ArrowLeft');context.heldPads.add('brake');
  context.mode='paused';context.clearInput();
  assert.equal(nitroLatch.active,false);assert.equal(context.heldKeys.size,0);assert.equal(context.heldPads.size,0);
  assert.equal(context.input.nitro,false);assert.equal(pointerInputs.read().nitro,false);assert.equal(dragSteering.active(),false);
  assert.equal(classes.has('pressed'),false);assert.equal(nitro['aria-pressed'],'false');
  context.mode='racing';window.pointer('pointermove',1,30);window.touch('touchmove',[1,30]);
  assert.equal(dragSteering.active(),false);assert.equal(context.input.nitro,false);
  start();assert.equal(context.input.nitro,true);assert.equal(dragSteering.read(),1,'the same IDs can start a fresh gesture after resume');
  context.clearInput();for(const binding of drivingBindings)binding();
 }
});
