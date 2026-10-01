const clamp = (value, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;

// Presentation consumes engine events; it never moves the car or changes score.
// Continuous scraping is intentionally silent. Live announcements describe
// transitions, not every frame of a recovery countdown.
export function createRaceFeedback() {
  let identity = null, impactId = 0, recoveryId = 0, previousPhase = 'none';
  let lastCrashNotice = -Infinity, lastWaitingNotice = -Infinity, lastFlash = -Infinity;
  let flashUntil = 0, flashStrength = 0;
  return {
    read(race, {active = true, reducedMotion = false, now = 0} = {}) {
      const key = race?.raceId ?? race;
      if (identity !== key || (race?.impact?.id ?? 0) < impactId || (race?.recovery?.id ?? 0) < recoveryId) {
        identity = key; impactId = recoveryId = 0; previousPhase = 'none';
        lastCrashNotice = lastWaitingNotice = lastFlash = -Infinity; flashUntil = 0;
      }
      const result = {kind: 'none', title: '', detail: '', announcement: '', flash: 0, kick: 0};
      if (!active || race?.state !== 'racing') { flashUntil = 0; return result; }
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
            result.kick = .03 + clamp(impact.strength, 0, 1) * .035;
          }
        }
      }
      if (recovery.phase === 'waiting') {
        result.kind = 'waiting'; result.title = 'Returning to road';
        result.detail = `${Math.max(1, Math.ceil(clamp(recovery.remaining, 0, 30)))}s · Steer clear to continue`;
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
      result.flash = reducedMotion ? 0 : clamp((flashUntil - now) / 340, 0, 1) * flashStrength;
      return result;
    },
  };
}
