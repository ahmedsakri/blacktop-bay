// One captured finger controls direction; the other can hold Nitro independently.
export function createDragSteering() {
  let pointer = null, origin = 0, travel = 72, amount = 0, floating = true;
  return {
    start(id, x, width, range) {
      if (pointer !== null || !Number.isSafeInteger(id) || id < 0 || !Number.isFinite(x)) return false;
      pointer = id; origin = x; amount = 0;
      floating = !Number.isFinite(range);
      travel = Number.isFinite(range) ? Math.max(20, Math.min(90, range))
        : Math.max(50, Math.min(90, Number.isFinite(width) ? width * .085 : 72));
      return true;
    },
    move(id, x) {
      if (id !== pointer || !Number.isFinite(x)) return;
      const delta = x - origin;
      amount = Math.sign(delta) * Math.min(1, Math.max(0, Math.abs(delta) - 5) / travel);
      // Follow an oversized free swipe so the thumb can countersteer without
      // travelling all the way back across the screen. The visible thumbpad
      // uses a fixed centre and must never inherit this floating origin.
      if (floating && Math.abs(delta) > travel + 5) origin = x - Math.sign(delta) * (travel + 5);
    },
    release(id) { if (id === pointer) { pointer = null; amount = 0; } },
    clear() { pointer = null; amount = 0; },
    read() { return amount; },
    active() { return pointer !== null; },
  };
}
