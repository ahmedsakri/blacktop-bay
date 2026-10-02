// Original tuning: time values are simulation seconds, not wall-clock timers.
export const NITRO_TIMING = Object.freeze({doubleTap: .28, perfectStart: .35, perfectEnd: .8, expire: .95});
export const NITRO_MODES = Object.freeze({
  off: Object.freeze({acceleration: 0, speed: 1, drain: 0, grip: 1}),
  normal: Object.freeze({acceleration: 1, speed: 1, drain: 1, grip: 1}),
  perfect: Object.freeze({acceleration: 1.15, speed: 1.035, drain: .78, grip: 1.18}),
  burst: Object.freeze({acceleration: 1.65, speed: 1.11, drain: 1.9, grip: 1.08}),
});

export function createNitro(capacity) {
  return {charge: capacity, capacity, active: false, locked: false, mode: 'off',
    perfectWindow: false, timingProgress: 0, event: {id: 0, kind: 'none'},
    _held: false, _gestureAge: -1, _startedFull: false, _special: 'normal'};
}

export function interruptNitro(nitro) {
  nitro.active = false; nitro.mode = 'off'; nitro.perfectWindow = false;
  nitro._gestureAge = -1; nitro._startedFull = false; nitro._special = 'normal';
}

export function stepNitro(nitro, held, eligible, dt) {
  if (nitro._gestureAge >= 0) nitro._gestureAge += dt;
  const pressed = held && !nitro._held;
  nitro._held = held;
  if (!held) nitro.locked = false;
  if (pressed && eligible && !nitro.locked && nitro.charge > 0) {
    const age = nitro._gestureAge;
    if (age >= 0 && age <= NITRO_TIMING.doubleTap && nitro._startedFull && nitro.charge >= nitro.capacity * .8) {
      nitro._special = 'burst'; nitro._gestureAge = -1;
    } else if (age >= NITRO_TIMING.perfectStart && age <= NITRO_TIMING.perfectEnd) {
      nitro._special = 'perfect'; nitro._gestureAge = -1;
    } else {
      nitro._special = 'normal'; nitro._gestureAge = 0;
      nitro._startedFull = nitro.charge >= nitro.capacity * .98;
    }
    nitro.event = {id: nitro.event.id + 1, kind: nitro._special};
  }
  if (nitro._gestureAge > NITRO_TIMING.expire) nitro._gestureAge = -1;
  // Starting at rest while holding still gives the familiar held boost when the
  // car gains speed. Only a real second press can choose a special mode.
  const mode = nitro._special || 'normal', tuning = NITRO_MODES[mode];
  nitro.active = Boolean(held && eligible && !nitro.locked && nitro.charge >= dt * tuning.drain);
  if (nitro.active) nitro.charge = Math.max(0, nitro.charge - dt * tuning.drain);
  if (held && nitro.charge < dt * tuning.drain) { nitro.locked = true; nitro.active = false; }
  nitro.mode = nitro.active ? mode : 'off';
  nitro.timingProgress = nitro._gestureAge < 0 ? 0 : Math.min(1, nitro._gestureAge / NITRO_TIMING.expire);
  nitro.perfectWindow = nitro._gestureAge >= NITRO_TIMING.perfectStart && nitro._gestureAge <= NITRO_TIMING.perfectEnd;
  return NITRO_MODES[nitro.mode];
}
