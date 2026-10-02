import test from 'node:test';
import assert from 'node:assert/strict';
import {createNitro, stepNitro, interruptNitro, NITRO_MODES} from '../src/nitro-system.js';

const tick = (n, held, seconds, eligible = true) => {for (let i=0;i<Math.round(seconds*120);i++) stepNitro(n, held, eligible, 1/120);};

test('holding Nitro preserves normal boost and never invents a timed second press', () => {
  const n=createNitro(5); tick(n,true,1);
  assert.equal(n.mode,'normal'); assert.ok(Math.abs(n.charge-4)<1e-10); assert.equal(n.event.id,1);
  tick(n,false,1/120); assert.equal(n.active,false); assert.equal(n.mode,'off');
});

test('a deliberate second press in the timing window provides more efficient Perfect Nitro', () => {
  const n=createNitro(5); tick(n,true,.45); assert.equal(n.perfectWindow,true);
  tick(n,false,1/120); const before=n.charge; tick(n,true,.2);
  assert.equal(n.mode,'perfect'); assert.equal(n.event.kind,'perfect');
  assert.ok(Math.abs(before-n.charge-.2*NITRO_MODES.perfect.drain)<1e-9);
  assert.ok(NITRO_MODES.perfect.acceleration>NITRO_MODES.normal.acceleration);
  assert.ok(NITRO_MODES.perfect.grip>NITRO_MODES.normal.grip);
});

test('quick double press activates a faster full-charge burst with a real consumption cost', () => {
  const n=createNitro(5); tick(n,true,.1); tick(n,false,.05); const before=n.charge; tick(n,true,.2);
  assert.equal(n.mode,'burst'); assert.equal(n.event.kind,'burst');
  assert.ok(Math.abs(before-n.charge-.2*NITRO_MODES.burst.drain)<1e-9);
  assert.ok(NITRO_MODES.burst.speed>NITRO_MODES.perfect.speed);
  const partial=createNitro(5); partial.charge=3;tick(partial,true,.1);tick(partial,false,.05);tick(partial,true,.1);
  assert.equal(partial.mode,'normal','partial-charge double taps cannot create the full-charge bonus');
});

test('late taps, crash interruption and ineligible inputs cannot retain special boost', () => {
  const late=createNitro(5);tick(late,true,1.1);tick(late,false,.05);tick(late,true,.1);assert.equal(late.mode,'normal');
  const n=createNitro(5);tick(n,true,.1);tick(n,false,.05);tick(n,true,.1);assert.equal(n.mode,'burst');
  interruptNitro(n);assert.equal(n.mode,'off');tick(n,true,.1);assert.equal(n.mode,'normal');
  const before=n.charge;tick(n,true,1,false);assert.equal(n.active,false);assert.equal(n.charge,before);
});

test('an exhausted held trigger does not turn collected charge into surprise boost until released', () => {
  const n=createNitro(.1);tick(n,true,.2);assert.equal(n.locked,true);assert.equal(n.active,false);
  n.charge=.1;tick(n,true,.05);assert.equal(n.active,false);assert.equal(n.charge,.1);
  tick(n,false,1/120);tick(n,true,1/120);assert.equal(n.active,true);
});
