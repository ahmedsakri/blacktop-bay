import test from 'node:test';
import assert from 'node:assert/strict';
import { createDragSteering } from '../src/drag-steering.js';
import { bindSteeringPad } from '../src/steering-pad.js';
import { createDrivingInputs, resolveDriveControls } from '../src/driving-controls.js';

class Pad extends EventTarget {
  getBoundingClientRect() { return {left: 20, width: 156}; }
  setPointerCapture(id) { this.captured = id; }
  pointer(type, id, x, button = 0) {
    const event = new Event(type, {cancelable: true});
    Object.assign(event, {pointerId: id, clientX: x, button});
    this.dispatchEvent(event); return event;
  }
}

test('pressing the visible left/right pad starts steering immediately and dragging crosses through neutral', () => {
  const pad = new Pad(), steering = createDragSteering();
  const cleanup = bindSteeringPad(pad, steering);
  assert.equal(pad.pointer('pointerdown', 1, 36).defaultPrevented, true);
  assert.equal(pad.captured, 1);
  assert.equal(steering.read(), -1, 'a left-side tap works without a move event');
  pad.pointer('pointermove', 1, 98);
  assert.equal(steering.read(), 0);
  pad.pointer('pointermove', 1, 162);
  assert.equal(steering.read(), 1);
  pad.pointer('pointerup', 1, 162);
  assert.equal(steering.read(), 0);
  cleanup();
  pad.pointer('pointerdown', 2, 162);
  assert.equal(steering.active(), false);
});

test('thumb steering and a held Nitro finger stay independent through pointer loss and cancellation', () => {
  const pad = new Pad(), steering = createDragSteering(), inputs = createDrivingInputs();
  bindSteeringPad(pad, steering);
  inputs.press(2, 'nitro');
  pad.pointer('pointerdown', 1, 160);
  pad.pointer('pointerdown', 2, 30);
  assert.equal(steering.read(), 1, 'the Nitro finger cannot steal steering');
  assert.equal(resolveDriveControls({...inputs.read(), steer: steering.read()}).nitro, true);
  pad.pointer('pointercancel', 2, 30);
  assert.equal(steering.read(), 1, 'another pointer cancellation cannot release the steering thumb');
  pad.pointer('lostpointercapture', 1, 160);
  assert.equal(steering.read(), 0);
  assert.equal(inputs.read().nitro, true);
});

test('inactive screens reject touch steering and failed pointer capture does not break controls', () => {
  const pad = new Pad(), steering = createDragSteering();
  let active = false;
  bindSteeringPad(pad, steering, {enabled: () => active});
  pad.pointer('pointerdown', 1, 30);
  assert.equal(steering.active(), false);
  active = true;
  pad.setPointerCapture = () => { throw new Error('Capture unavailable'); };
  assert.doesNotThrow(() => pad.pointer('pointerdown', 1, 30));
  assert.equal(steering.read(), -1);
  steering.clear();
  active = false;
  pad.pointer('pointermove', 1, 160);
  assert.equal(steering.read(), 0);
});

test('disabling or removing the pad clears a captured turn without needing a later pointerup', () => {
  const pad = new Pad(), steering = createDragSteering();
  let active = true;
  const cleanup = bindSteeringPad(pad, steering, {enabled: () => active});
  pad.pointer('pointerdown', 1, 162);
  assert.equal(steering.read(), 1);
  active = false;
  pad.pointer('pointermove', 1, 160);
  assert.equal(steering.read(), 0);
  assert.equal(steering.active(), false);
  active = true;
  pad.pointer('pointerdown', 2, 30);
  assert.equal(steering.read(), -1);
  cleanup();
  assert.equal(steering.read(), 0);
  assert.equal(steering.active(), false);
});
