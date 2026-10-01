// One captured finger controls direction; the other can hold Nitro independently.
export function createDragSteering() {
  let pointer = null, origin = 0, travel = 72, amount = 0;
  return {
    start(id, x, width) {
      if (pointer !== null || !Number.isInteger(id) || id < 0 || !Number.isFinite(x)) return false;
      pointer = id; origin = x; amount = 0;
      travel = Math.max(50, Math.min(90, Number.isFinite(width) ? width * .085 : 72));
      return true;
    },
    move(id, x) {
      if (id !== pointer || !Number.isFinite(x)) return;
      const delta = x - origin;
      amount = Math.sign(delta) * Math.min(1, Math.max(0, Math.abs(delta) - 5) / travel);
    },
    release(id) { if (id === pointer) { pointer = null; amount = 0; } },
    clear() { pointer = null; amount = 0; },
    read() { return amount; },
    active() { return pointer !== null; },
  };
}
