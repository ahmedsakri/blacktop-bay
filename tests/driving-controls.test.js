import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrivingInputs, resolveDriveControls } from '../src/driving-controls.js';

const idle = { left: false, right: false, throttle: false, brake: false, drift: false, nitro: false };
const manual = { manualThrottle: true };

test('separate fingers steer, accelerate and boost simultaneously, then release independently', () => {
  const controls = createDrivingInputs();
  controls.press(11, 'left'); controls.press(22, 'throttle'); controls.press(33, 'nitro');
  assert.deepEqual(resolveDriveControls(controls.read(), manual), {
    steer: -1, throttle: 1, brake: false, handbrake: false, nitro: true,
  });
  controls.release(11);
  assert.equal(resolveDriveControls(controls.read(), manual).steer, 0);
  assert.equal(controls.read().throttle, true);
  controls.release(22);
  assert.equal(resolveDriveControls(controls.read(), manual).throttle, 1, 'held boost also supplies throttle');
  controls.release(33);
  assert.deepEqual(controls.read(), idle);
  assert.equal(resolveDriveControls(controls.read(), manual).throttle, 0);
});

test('two pointers on one pedal keep it held until both have ended', () => {
  const controls = createDrivingInputs();
  controls.press(1, 'brake'); controls.press(2, 'brake');
  assert.equal(controls.release(1), true);
  assert.equal(controls.read().brake, true);
  // Repeated pointerup/lostcapture events must not clear another finger.
  assert.equal(controls.release(1), false);
  assert.equal(controls.read().brake, true);
  controls.release(2);
  assert.equal(controls.read().brake, false);
});

test('a captured finger cannot own another action until it is released', () => {
  const controls = createDrivingInputs();
  assert.equal(controls.press(3, 'right'), true);
  assert.equal(controls.press(3, 'right'), true, 'duplicate down is idempotent');
  assert.equal(controls.press(3, 'nitro'), false);
  assert.deepEqual(controls.read(), { ...idle, right: true });
  controls.release(3);
  assert.equal(controls.press(3, 'nitro'), true, 'browser may reuse a finished pointer ID');
  assert.deepEqual(controls.read(), { ...idle, nitro: true });
});

test('pointer cancellation, lost capture and pause cleanup cannot leave stuck controls', () => {
  const controls = createDrivingInputs();
  for (const [id, action] of [[1, 'left'], [2, 'right'], [3, 'throttle'], [4, 'brake'], [5, 'drift'], [6, 'nitro']]) controls.press(id, action);
  controls.release(2); // pointercancel
  controls.release(3); // lostpointercapture
  assert.equal(controls.read().left, true);
  assert.equal(controls.read().throttle, false);
  controls.clear(); // blur / pause / orientation change
  assert.deepEqual(controls.read(), idle);
  for (let id = 1; id <= 6; id++) controls.release(id); // Late capture events are harmless.
  assert.deepEqual(controls.read(), idle);
  controls.press(1, 'throttle');
  assert.equal(controls.read().throttle, true, 'controls work again after resume');
});

test('opposing steering cancels without losing the surviving held direction', () => {
  const controls = createDrivingInputs();
  controls.press(1, 'left'); controls.press(2, 'right');
  assert.equal(resolveDriveControls(controls.read(), manual).steer, 0);
  controls.release(1);
  assert.equal(resolveDriveControls(controls.read(), manual).steer, 1);
});

test('brake wins over accelerator and nitro, while held pedals resume after brake release', () => {
  const controls = createDrivingInputs();
  controls.press(1, 'throttle'); controls.press(2, 'nitro'); controls.press(3, 'brake'); controls.press(4, 'drift');
  for (const manualThrottle of [true, false]) {
    assert.deepEqual(resolveDriveControls(controls.read(), { manualThrottle }), {
      steer: 0, throttle: 0, brake: true, handbrake: true, nitro: false,
    });
  }
  controls.release(3);
  assert.deepEqual(resolveDriveControls(controls.read(), manual), {
    steer: 0, throttle: 1, brake: false, handbrake: true, nitro: true,
  });
});

test('manual driving coasts without a pedal, desktop auto-accelerates, and drift alone never supplies gas', () => {
  assert.equal(resolveDriveControls(idle, manual).throttle, 0);
  assert.equal(resolveDriveControls({ ...idle, drift: true }, manual).throttle, 0);
  assert.equal(resolveDriveControls({ ...idle, nitro: true }, manual).throttle, 1);
  assert.equal(resolveDriveControls({ ...idle, throttle: true }, manual).throttle, 1);
  assert.equal(resolveDriveControls().throttle, 1);
  assert.equal(resolveDriveControls({ brake: true }).throttle, 0);
});

test('touch release does not mutate a keyboard snapshot or snapshots already read by an adapter', () => {
  const controls = createDrivingInputs(), keyboard = { left: true, throttle: true };
  controls.press(4, 'nitro');
  const held = controls.read();
  held.right = true; // A caller cannot mutate the internal pointer owners.
  assert.equal(controls.read().right, false);
  controls.release(4);
  const merged = Object.fromEntries(Object.entries(controls.read()).map(([action, down]) => [action, down || keyboard[action] === true]));
  assert.deepEqual(resolveDriveControls(merged, manual), {
    steer: -1, throttle: 1, brake: false, handbrake: false, nitro: false,
  });
  assert.equal(held.nitro, true, 'previous snapshots remain stable');
  assert.deepEqual(keyboard, { left: true, throttle: true });
});

test('invalid actions and pointer IDs cannot create phantom held controls', () => {
  const controls = createDrivingInputs();
  for (const action of ['gas', '__proto__', 'constructor', '', null, undefined]) assert.equal(controls.press(0, action), false);
  for (const id of [null, undefined, '1', NaN, Infinity, -1, .25]) assert.equal(controls.press(id, 'throttle'), false);
  assert.deepEqual(controls.read(), idle);
  assert.equal(controls.press(0, 'throttle'), true, 'zero is a valid pointer ID');
  assert.equal(resolveDriveControls({ throttle: 'false', nitro: 'true', brake: 1 }, manual).throttle, 0, 'only explicit booleans represent held inputs');
});
