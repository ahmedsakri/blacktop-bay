import test from 'node:test';
import assert from 'node:assert/strict';
import { screenTiltDegrees, createTiltSteering, requestTiltPermission } from '../src/tilt-steering.js';
import { resolveDriveControls } from '../src/driving-controls.js';

test('tilt follows screen-right in both landscape orientations and portrait rotations', () => {
  for (const [orientation, beta, gamma] of [[90, 18, -65], [270, -18, 65], [0, 0, 18], [180, 0, -18]]) {
    assert.ok(Math.abs(screenTiltDegrees({beta, gamma}, orientation) - 18) < 1e-10);
  }
  assert.ok(screenTiltDegrees({beta: -18, gamma: -65}, 90) < 0);
  assert.ok(screenTiltDegrees({beta: 18, gamma: 65}, 270) < 0);
  assert.equal(screenTiltDegrees({beta: null, gamma: 0}), null);
  assert.equal(screenTiltDegrees({beta: Infinity, gamma: 0}), null);
  assert.equal(screenTiltDegrees({beta: 0, gamma: NaN}), null);
});

test('calibration, dead zone and smoothing give bounded control without changing automatic gas or Nitro', () => {
  let clock = 0;
  const tilt = createTiltSteering({now: () => clock});
  tilt.sample({beta: 12, gamma: -65}, 90);
  assert.equal(tilt.read(), 0, 'the comfortable starting pose is straight ahead');
  tilt.sample({beta: 14, gamma: -65}, 90);
  assert.equal(tilt.read(), 0, 'small hand tremors remain inside the dead zone');
  tilt.sample({beta: 50, gamma: -65}, 90);
  const first = tilt.read(1 / 60);
  assert.ok(first > 0 && first < .25, 'smoothing avoids an instant full steering jump');
  let steer;
  for (let i = 0; i < 50; i++) steer = tilt.read(1 / 60);
  assert.ok(steer > .99 && steer <= 1);
  const driving = resolveDriveControls({steer, nitro: true});
  assert.equal(driving.nitro, true);
  assert.equal(driving.throttle, 1);
  assert.equal(tilt.calibrate(), true);
  assert.equal(tilt.read(), 0);
  tilt.sample({beta: 20, gamma: -65}, 90);
  for (let i = 0; i < 50; i++) steer = tilt.read(1 / 60);
  assert.ok(steer < -.99 && steer >= -1);
  clock = 2000;
  assert.equal(tilt.read(), 0, 'lost sensor data never holds a stale turn');
  assert.equal(tilt.calibrate(), false);
});

test('rotation, pause cleanup and fresh resumption cannot reuse a previous steering command', () => {
  const tilt = createTiltSteering({now: () => 100});
  tilt.sample({beta: 0, gamma: -65}, 90);
  tilt.sample({beta: 22, gamma: -65}, 90);
  assert.ok(tilt.read(.1) > .5);
  tilt.sample({beta: -22, gamma: 65}, 270);
  assert.equal(tilt.read(), 0, 'turning the phone over recenters before applying input');
  tilt.sample({beta: -45, gamma: 65}, 270);
  assert.ok(tilt.read(.1) > .5);
  tilt.clear();
  assert.equal(tilt.read(), 0);
  assert.equal(tilt.fresh(), false);
  tilt.sample({beta: -40, gamma: 65}, 270);
  assert.equal(tilt.read(), 0, 'resume establishes a new neutral driving pose');
});

test('motion permission is requested only by the explicit call and handles iOS denial and missing sensors', async () => {
  let calls = 0;
  const ios = {isSecureContext: true, DeviceOrientationEvent: {requestPermission() { calls++; return Promise.resolve('granted'); }}};
  createTiltSteering();
  assert.equal(calls, 0);
  const permission = requestTiltPermission(ios);
  assert.equal(calls, 1, 'requestPermission runs before yielding away the click activation');
  assert.deepEqual(await permission, {ok: true});
  assert.deepEqual(await requestTiltPermission({DeviceOrientationEvent: class {}}), {ok: true});
  assert.deepEqual(await requestTiltPermission({DeviceOrientationEvent: {requestPermission: async () => 'denied'}}), {ok: false, reason: 'denied'});
  assert.deepEqual(await requestTiltPermission({DeviceOrientationEvent: {requestPermission: async () => { throw new Error('Blocked'); }}}), {ok: false, reason: 'denied'});
  assert.deepEqual(await requestTiltPermission({}), {ok: false, reason: 'unsupported'});
  assert.deepEqual(await requestTiltPermission({...ios, isSecureContext: false}), {ok: false, reason: 'secure'});
  assert.equal(calls, 1, 'insecure pages cannot prompt for sensors');
});
