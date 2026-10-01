import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrivingInputs, resolveDriveControls, normalizeSteeringSensitivity } from '../src/driving-controls.js';

const idle = { left: false, right: false, brake: false, drift: false, nitro: false };

test('steering sensitivity tunes thumb and tilt precision while retaining full lock, keyboard control and Nitro', () => {
  const gentle = resolveDriveControls({steer: .3, nitro: true}, {steeringSensitivity: .65});
  const standard = resolveDriveControls({steer: .3}, {steeringSensitivity: 1});
  const quick = resolveDriveControls({steer: .3}, {steeringSensitivity: 1.5});
  assert.ok(gentle.steer < standard.steer && standard.steer < quick.steer);
  assert.equal(gentle.nitro, true); assert.equal(gentle.throttle, 1);
  for (const sensitivity of [.65, 1, 1.5]) for (const sign of [-1, 1]) {
    assert.equal(resolveDriveControls({steer: sign}, {steeringSensitivity: sensitivity}).steer, sign);
    assert.equal(resolveDriveControls({[sign < 0 ? 'left' : 'right']: true}, {steeringSensitivity: sensitivity}).steer, sign);
    assert.equal(resolveDriveControls({steer: 0}, {steeringSensitivity: sensitivity}).steer, 0);
  }
  for (const value of [undefined, NaN, Infinity, '1.5', null, {}]) assert.equal(normalizeSteeringSensitivity(value), 1);
  assert.equal(normalizeSteeringSensitivity(-100), .65);
  assert.equal(normalizeSteeringSensitivity(100), 1.5);
});

test('drag steering and a separate nitro finger combine without requiring an accelerator', () => {
  const controls = createDrivingInputs();
  controls.press(33, 'nitro');
  assert.deepEqual(resolveDriveControls({ ...controls.read(), steer: -.65 }), {
    steer: -.65, throttle: 1, brake: false, handbrake: false, nitro: true,
  });
  controls.release(33);
  assert.deepEqual(resolveDriveControls({ ...controls.read(), steer: -.65 }), {
    steer: -.65, throttle: 1, brake: false, handbrake: false, nitro: false,
  });
  assert.deepEqual(controls.read(), idle);
});

test('two pointers on nitro keep it held until both have ended', () => {
  const controls = createDrivingInputs();
  controls.press(1, 'nitro'); controls.press(2, 'nitro');
  assert.equal(controls.release(1), true);
  assert.equal(controls.read().nitro, true);
  // Repeated pointerup/lostcapture events must not clear another finger.
  assert.equal(controls.release(1), false);
  assert.equal(controls.read().nitro, true);
  controls.release(2);
  assert.equal(controls.read().nitro, false);
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
  for (const [id, action] of [[1, 'left'], [2, 'right'], [3, 'nitro'], [4, 'brake'], [5, 'drift']]) controls.press(id, action);
  controls.release(2); // pointercancel
  controls.release(3); // lostpointercapture
  assert.equal(controls.read().left, true);
  assert.equal(controls.read().nitro, false);
  controls.clear(); // blur / pause / orientation change
  assert.deepEqual(controls.read(), idle);
  for (let id = 1; id <= 5; id++) controls.release(id); // Late capture events are harmless.
  assert.deepEqual(controls.read(), idle);
  controls.press(1, 'nitro');
  assert.equal(controls.read().nitro, true, 'controls work again after resume');
});

test('analog steering preserves precise fractional input and clamps out-of-range values', () => {
  for (const [input, expected] of [[-.12, -.12], [.78, .78], [-1, -1], [1, 1], [-9, -1], [9, 1]]) {
    assert.equal(resolveDriveControls({ steer: input }).steer, expected);
  }
  for (const value of [undefined, null, NaN, Infinity, -Infinity, '0.5', {}, true]) {
    assert.equal(resolveDriveControls({ steer: value }).steer, 0, 'invalid drag data cannot corrupt physics');
  }
});

test('keyboard steering adds to drag steering, saturates, and cancels opposing arrows', () => {
  assert.equal(resolveDriveControls({ steer: .6, right: true }).steer, 1);
  assert.equal(resolveDriveControls({ steer: -.6, left: true }).steer, -1);
  assert.equal(resolveDriveControls({ steer: .6, left: true }).steer, -.4);
  assert.equal(resolveDriveControls({ steer: -.25, left: true, right: true }).steer, -.25);
  const controls = createDrivingInputs();
  controls.press(1, 'left'); controls.press(2, 'right');
  assert.equal(resolveDriveControls(controls.read()).steer, 0);
  controls.release(1);
  assert.equal(resolveDriveControls(controls.read()).steer, 1);
});

test('keyboard brake stops automatic acceleration and suppresses held nitro until released', () => {
  const controls = createDrivingInputs();
  controls.press(2, 'nitro');
  assert.deepEqual(resolveDriveControls({ ...controls.read(), brake: true, drift: true }), {
    steer: 0, throttle: 0, brake: true, handbrake: true, nitro: false,
  });
  assert.deepEqual(resolveDriveControls(controls.read()), {
    steer: 0, throttle: 1, brake: false, handbrake: false, nitro: true,
  });
});

test('automatic acceleration remains active with no touches, after nitro release, and with optional keyboard drift', () => {
  assert.equal(resolveDriveControls().throttle, 1);
  assert.equal(resolveDriveControls(null).throttle, 1);
  assert.equal(resolveDriveControls(idle).throttle, 1);
  assert.equal(resolveDriveControls({ ...idle, drift: true }).throttle, 1);
  assert.equal(resolveDriveControls({ ...idle, drift: true }).handbrake, true);
  assert.equal(resolveDriveControls({ throttle: false }, { manualThrottle: true }).throttle, 1, 'obsolete adapter flags cannot disable automatic driving');
  assert.equal(resolveDriveControls({ brake: true }).throttle, 0);
});

test('touch release does not mutate a keyboard snapshot or snapshots already read by an adapter', () => {
  const controls = createDrivingInputs(), keyboard = { left: true };
  controls.press(4, 'nitro');
  const held = controls.read();
  held.right = true; // A caller cannot mutate the internal pointer owners.
  assert.equal(controls.read().right, false);
  controls.release(4);
  const merged = Object.fromEntries(Object.entries(controls.read()).map(([action, down]) => [action, down || keyboard[action] === true]));
  assert.deepEqual(resolveDriveControls(merged), {
    steer: -1, throttle: 1, brake: false, handbrake: false, nitro: false,
  });
  assert.equal(held.nitro, true, 'previous snapshots remain stable');
  assert.deepEqual(keyboard, { left: true });
});

test('invalid actions and pointer IDs cannot create phantom held controls', () => {
  const controls = createDrivingInputs();
  for (const action of ['throttle', 'gas', '__proto__', 'constructor', '', null, undefined]) assert.equal(controls.press(0, action), false);
  for (const id of [null, undefined, '1', NaN, Infinity, -1, .25]) assert.equal(controls.press(id, 'nitro'), false);
  assert.deepEqual(controls.read(), idle);
  assert.equal(controls.press(0, 'nitro'), true, 'zero is a valid pointer ID');
  assert.deepEqual(resolveDriveControls({ nitro: 'true', brake: 1, left: 'false' }), {
    steer: 0, throttle: 1, brake: false, handbrake: false, nitro: false,
  }, 'only explicit booleans represent held inputs');
});
