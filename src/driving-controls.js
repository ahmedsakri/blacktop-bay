// Pointer ownership is independent of keyboard state. The DOM adapter can OR
// this snapshot with held keys/pads without a touch release clearing a key.
export const DRIVING_ACTIONS = Object.freeze([
  'left', 'right', 'brake', 'drift', 'nitro',
]);
const actions = new Set(DRIVING_ACTIONS);
const validPointer = id => Number.isSafeInteger(id) && id >= 0;

export function normalizeSteeringSensitivity(value) {
  return Number.isFinite(value) ? Math.max(.65, Math.min(1.5, value)) : 1;
}

// Browser/OS shortcuts must not become fresh race input. Release handlers still
// run regardless of modifiers so a previously held control cannot get stuck.
export function isDrivingShortcut(event = {}) {
  return Boolean(event?.ctrlKey || event?.metaKey || event?.altKey || event?.isComposing);
}

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

// Drag steering and keyboard arrows share a bounded steering value. Racing
// always auto-accelerates; the optional keyboard brake overrides gas and boost.
export function resolveDriveControls(input = {}, {steeringSensitivity = 1} = {}) {
  const held = action => input?.[action] === true;
  const brake = held('brake');
  const nitro = !brake && held('nitro');
  const analog = Number.isFinite(input?.steer) ? Math.max(-1, Math.min(1, input.steer)) : 0;
  // Change precision around centre without taking away full steering lock at
  // a low setting. Keyboard arrows remain independent of touch/tilt tuning.
  const sensitivity = normalizeSteeringSensitivity(steeringSensitivity);
  const adjustedAnalog = Math.sign(analog) * Math.abs(analog) ** (1 / sensitivity);
  return {
    // An explicit arrow/key/pad direction wins over a connected analogue stick.
    // Both digital directions mean neutral, even if that stick is deflected.
    steer: held('right') || held('left') ? Number(held('right')) - Number(held('left')) : adjustedAnalog,
    throttle: brake ? 0 : 1,
    brake,
    handbrake: held('drift'),
    nitro,
  };
}
