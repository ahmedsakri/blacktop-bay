// Pointer ownership is independent of keyboard state. The DOM adapter can OR
// this snapshot with held keys/pads without a touch release clearing a key.
export const DRIVING_ACTIONS = Object.freeze([
  'left', 'right', 'throttle', 'brake', 'drift', 'nitro',
]);
const actions = new Set(DRIVING_ACTIONS);
const validPointer = id => Number.isSafeInteger(id) && id >= 0;

export function createDrivingInputs() {
  const owners = new Map();
  return {
    press(pointerId, action) {
      if (!validPointer(pointerId) || !actions.has(action)) return false;
      // One finger cannot activate two controls. Ownership lasts through a
      // drag until pointerup/cancel/lostpointercapture explicitly releases it.
      if (owners.has(pointerId)) return owners.get(pointerId) === action;
      owners.set(pointerId, action);
      return true;
    },
    release(pointerId) {
      return owners.delete(pointerId);
    },
    clear() {
      owners.clear();
    },
    read() {
      const held = Object.fromEntries(DRIVING_ACTIONS.map(action => [action, false]));
      for (const action of owners.values()) held[action] = true;
      return held;
    },
  };
}

// The same rule drives physics and pedal feedback. Braking has priority over
// both accelerator and boost; releasing the brake restores still-held inputs.
export function resolveDriveControls(input = {}, { manualThrottle = false } = {}) {
  const held = action => input?.[action] === true;
  const brake = held('brake');
  const nitro = !brake && held('nitro');
  return {
    steer: Number(held('right')) - Number(held('left')),
    throttle: brake ? 0 : (!manualThrottle || held('throttle') || nitro ? 1 : 0),
    brake,
    handbrake: held('drift'),
    nitro,
  };
}
