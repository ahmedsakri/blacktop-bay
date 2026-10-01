const clamp = (value, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
const lapClock = value => {
  const hundredths = Math.round(value * 100);
  return `${String(Math.floor(hundredths / 6000)).padStart(2, '0')}:${String(Math.floor(hundredths / 100) % 60).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
};

// One short directional impulse, rather than perpetual high-frequency shake.
// The camera applies this as a removable offset so it cannot accumulate drift.
export function impactCameraOffset(age, strength, nx, nz) {
  const length = Math.hypot(nx, nz);
  if (!Number.isFinite(age) || age < 0 || age >= .32 || !Number.isFinite(length) || length < .001) return {x: 0, y: 0, z: 0};
  const pulse = Math.sin(age / .32 * Math.PI) * Math.exp(-age * 6) * clamp(strength, 0, .4);
  return {x: nx / length * pulse, y: pulse * .32, z: nz / length * pulse};
}
function impactDirection(impact, car) {
  if (!car || !Number.isFinite(car.yaw) || !Number.isFinite(impact.nx) || !Number.isFinite(impact.nz)) return 'front';
  // Impact normals point away from contact: invert to identify its screen side.
  const side = -(impact.nx * Math.cos(car.yaw) - impact.nz * Math.sin(car.yaw));
  const forward = -(impact.nx * Math.sin(car.yaw) + impact.nz * Math.cos(car.yaw));
  return Math.abs(side) > Math.abs(forward) * .75 ? side > 0 ? 'right' : 'left' : forward > 0 ? 'front' : 'rear';
}

// Presentation consumes engine events; it never moves the car or changes score.
// Continuous scraping is intentionally silent. Live announcements describe
// transitions, not every frame of a recovery countdown.
export function createRaceFeedback() {
  let identity = null, impactId = 0, recoveryId = 0, previousPhase = 'none';
  let lastCrashNotice = -Infinity, lastWaitingNotice = -Infinity, lastFlash = -Infinity;
  let flashUntil = 0, flashStrength = 0, edge = 'front';
  let completedLaps = 0, lapNotice = null;
  return {
    read(race, {active = true, reducedMotion = false, now = 0} = {}) {
      const key = race?.raceId ?? race;
      if (identity !== key || (race?.impact?.id ?? 0) < impactId || (race?.recovery?.id ?? 0) < recoveryId) {
        identity = key; impactId = recoveryId = 0; previousPhase = 'none';
        lastCrashNotice = lastWaitingNotice = lastFlash = -Infinity; flashUntil = 0;
        completedLaps = 0; lapNotice = null;
      }
      const result = {kind: 'none', title: '', detail: '', announcement: '', flash: 0, kick: 0, edge: 'front'};
      if (!active || race?.state !== 'racing') { flashUntil = 0; return result; }
      // Only report checkpoint-validated laps from the engine. Use race time so
      // a pause does not consume the short message or invent a timing result.
      const count = race.completedLaps;
      if (Number.isSafeInteger(count) && count > completedLaps) {
        completedLaps = count;
        const times = race.lapTimes;
        if (count < race.totalLaps && Array.isArray(times) && times.length === count
          && times.every(value => Number.isFinite(value) && value > 0) && Number.isFinite(race.elapsed)) {
          const last = times[count - 1], previous = count > 1 ? Math.min(...times.slice(0, -1)) : null;
          const delta = previous === null ? null : last - previous;
          const comparison = delta === null ? 'Set the pace' : Math.abs(delta) < .005 ? 'Matched your best'
            : `${Math.abs(delta).toFixed(2)}s ${delta < 0 ? 'faster' : 'off your best'}`;
          lapNotice = {title: count + 1 === race.totalLaps ? 'Final lap' : `Lap ${count + 1} of ${race.totalLaps}`,
            detail: `Last lap ${lapClock(last)} · ${comparison}`, until: race.elapsed + 4, announced: false};
        }
      }
      const impact = race.impact || {}, recovery = race.recovery || {};
      const newImpact = impact.id > impactId;
      impactId = Math.max(impactId, impact.id || 0);
      if (impact.kind === 'crash' && impact.remaining > 0) {
        result.kind = 'crash'; result.title = impact.source === 'car' ? 'Car contact' : 'Barrier impact';
        result.detail = 'Keep steering';
        if (newImpact) {
          if (now - lastCrashNotice >= 3000) {
            result.announcement = `${result.title}. Keep steering.`; lastCrashNotice = now;
          }
          if (!reducedMotion && now - lastFlash >= 1200) {
            lastFlash = now; flashUntil = now + 340; flashStrength = .25 + clamp(impact.strength, 0, 1) * .3;
            result.kick = .16 + clamp(impact.strength, 0, 1) * .24;
            edge = impactDirection(impact, race.car);
          }
        }
      }
      if (recovery.phase === 'waiting') {
        result.kind = 'waiting';
        const waitingForGap = Number.isFinite(recovery.remaining) && recovery.remaining <= 0;
        result.title = waitingForGap ? 'Finding a clear gap' : 'Returning to road';
        result.detail = waitingForGap ? 'Waiting for space behind you' : `${Math.max(1, Math.ceil(clamp(recovery.remaining, 0, 30)))}s · Move clear to cancel`;
        if (previousPhase !== 'waiting' && now - lastWaitingNotice >= 5000) {
          result.announcement = 'Car recovery is preparing. Steer clear to continue driving.'; lastWaitingNotice = now;
        }
      } else if (recovery.phase === 'recovered' && recovery.remaining > 0) {
        result.kind = 'recovered'; result.title = 'Back on track'; result.detail = 'Keep your line';
        if (recovery.id > recoveryId) result.announcement = recovery.reason === 'manual'
          ? 'Car reset to the road.' : 'Car returned to the road. Keep steering.';
        flashUntil = 0;
      }
      recoveryId = Math.max(recoveryId, recovery.id || 0);
      previousPhase = recovery.phase || 'none';
      if (result.kind === 'none' && lapNotice && race.elapsed < lapNotice.until) {
        result.kind = 'lap'; result.title = lapNotice.title; result.detail = lapNotice.detail;
        if (!lapNotice.announced) {
          result.announcement = `${lapNotice.title}. ${lapNotice.detail}.`;
          lapNotice.announced = true;
        }
      }
      result.edge = edge;
      result.flash = reducedMotion ? 0 : clamp((flashUntil - now) / 340, 0, 1) * flashStrength;
      return result;
    },
  };
}
