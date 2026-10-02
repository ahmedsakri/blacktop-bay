// Rendering may run at 30, 60 or 120 Hz. Physics already owns its fixed-step
// accumulator; never feed it a visually clamped delta and silently lose time.
export function createRaceTiming({maxCatchUp = .3} = {}) {
  let previous = null, wasActive = false;
  return {
    reset(now = null) { previous = now; wasActive = false; },
    sample(now, {active = false} = {}) {
      const seconds = previous === null || !Number.isFinite(now) ? 0 : Math.max(0, (now - previous) / 1000);
      previous = Number.isFinite(now) ? now : null;
      const elapsed = active && wasActive ? seconds : 0;
      wasActive = active;
      const suspended = elapsed > maxCatchUp;
      return {visual: Math.min(seconds, .05), simulation: suspended ? 0 : elapsed, suspended};
    },
  };
}

// Keep each call below stepRace's defensive 100 ms input bound. Its 120 Hz
// accumulator retains the remainder, so this does not add another timebase.
export function advanceRaceTime(seconds, step) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = seconds;
  while (remaining > 1e-9) {
    const dt = Math.min(remaining, 1 / 30);
    if (step(dt) === false) break;
    remaining -= dt;
  }
}
