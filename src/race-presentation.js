const bounded = (value, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
const points = value => Math.floor(bounded(value, 0, 1_000_000_000));

// progress is the engine's guarded distance within the CURRENT lap. The lap
// number is one-based and stays at 3 on the finish screen; it is not a distance.
export function getRaceProgress(race) {
  const totalLaps = Number.isSafeInteger(race?.totalLaps) && race.totalLaps > 0 ? race.totalLaps : 3;
  const active = race?.state === 'racing' || race?.state === 'finished';
  const completedLaps = active && Number.isSafeInteger(race.completedLaps)
    ? bounded(race.completedLaps, 0, totalLaps) : 0;
  const finished = race?.state === 'finished' && completedLaps === totalLaps;
  const lapProgress = active ? bounded(race.progress, 0, 1) : 0;
  // Reserve 100% for the engine's checkpoint-validated finish. In particular,
  // rounding a final-lap 99.8% must not display a premature completion.
  const fraction = finished ? 1 : Math.min(.999999, (completedLaps + lapProgress) / totalLaps);
  const percent = finished ? 100 : Math.floor(fraction * 100);
  return { fraction, percent, label: `${percent}%`, completedLaps, totalLaps, finished };
}

// Optional snapshots are plain values, never references to the mutable race.
// A caller may hold the banked message on screen after observing bankedPoints.
export function getDriftDisplay(race, previousSnapshot = null) {
  const racing = race?.state === 'racing', finished = race?.state === 'finished';
  const collision = racing && race.collision === true;
  const drifting = racing && !collision && race.car?.drifting === true;
  const nitroActive = racing && race.nitro?.active === true;
  const score = points(race?.score);
  const pendingPoints = racing && !collision ? points(race.driftPoints) : 0;
  const combo = pendingPoints || drifting ? Math.floor(bounded(race?.combo, 1, 5)) : 1;
  const raceId = typeof race?.raceId === 'string' ? race.raceId : null;
  const snapshot = { raceId, score };
  const bankedPoints = (racing || finished) && !collision && raceId
    && previousSnapshot?.raceId === raceId && Number.isFinite(previousSnapshot.score)
    && previousSnapshot.score >= 0 && score > previousSnapshot.score
    ? score - points(previousSnapshot.score) : 0;
  let state = 'idle', label = '';
  if (finished) { state = 'finished'; label = 'RACE COMPLETE'; }
  else if (collision) { state = 'collision'; label = 'BARRIER HIT'; }
  else if (bankedPoints > 0) { state = 'banked'; label = 'DRIFT BANKED'; }
  else if (drifting) { state = 'drifting'; label = 'DRIFT'; }
  else if (pendingPoints > 0) { state = 'settling'; label = 'HOLD YOUR LINE'; }
  else if (nitroActive) { state = 'nitro'; label = 'NITRO'; }
  return { state, label, pendingPoints, bankedPoints, totalPoints: score + pendingPoints, combo, nitroActive, snapshot };
}
