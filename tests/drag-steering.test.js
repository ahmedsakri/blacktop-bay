import test from 'node:test';
import assert from 'node:assert/strict';
import { createDragSteering } from '../src/drag-steering.js';

test('drag has a small dead zone, proportional travel, and bounded direction', () => {
  const drag = createDragSteering();
  assert.equal(drag.start(1, 150, 844), true);
  drag.move(1, 154); assert.equal(drag.read(), 0);
  drag.move(1, 190); assert.ok(drag.read() > .4 && drag.read() < .6);
  drag.move(1, 900); assert.equal(drag.read(), 1);
  drag.move(1, -900); assert.equal(drag.read(), -1);
  drag.release(1); assert.equal(drag.read(), 0);
});
test('a second finger cannot steal or release steering while holding Nitro', () => {
  const drag = createDragSteering();
  drag.start(1, 150, 568); drag.move(1, 200);
  const held = drag.read();
  assert.equal(drag.start(2, 500, 568), false);
  drag.move(2, 300); drag.release(2);
  assert.equal(drag.read(), held);
  drag.release(1); drag.release(1);
  assert.equal(drag.active(), false);
});
test('pause and rotation cancel the drag and stale pointer moves cannot resume it', () => {
  const drag = createDragSteering();
  drag.start(1, 100, 844); drag.move(1, 200); drag.clear();
  drag.move(1, 300); assert.equal(drag.read(), 0);
  assert.equal(drag.start(2, 200, 844), true);
  assert.equal(drag.read(), 0);
  drag.move(2, NaN); assert.equal(drag.read(), 0);
});
