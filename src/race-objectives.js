const progress = (racer, length) => racer.completedLaps * length + racer._lapDistance;
const trackers = new WeakMap();
export function createObjectiveStats() {
  return {perfectNitro: 0, burstNitro: 0, cleanOvertakes: 0, pickups: 0, cleanSectors: 0};
}

// Observe simulation facts only. No screen transition can award a technique.
export function trackObjectiveStats(race, track, dt) {
  const sector = race.completedLaps * 12 + race._nextCheckpoint - 1;
  let state = trackers.get(race);
  if (!state || state.raceId !== race.raceId) {
    state = {raceId: race.raceId, highestSector: 0, nitro: 0, pickup: 0, impact: 0, recoveries: 0, sector, dirty: false, cleanTime: 0, passes: new Map()};
    trackers.set(race, state);
  }
  if (state.finished) return;
  const stats = race.objectiveStats;
  if (race.nitro.event.id !== state.nitro) {
    if (race.nitro.event.kind === 'perfect') stats.perfectNitro++;
    if (race.nitro.event.kind === 'burst') stats.burstNitro++;
    state.nitro = race.nitro.event.id;
  }
  stats.pickups += Math.max(0, race.pickupEvent.id - state.pickup); state.pickup = race.pickupEvent.id;
  const dirty = race.impact.id !== state.impact || race.recoveries !== state.recoveries || race.collision || race.wreck.phase === 'impact';
  state.impact = race.impact.id; state.recoveries = race.recoveries;
  state.cleanTime = dirty ? 0 : state.cleanTime + dt;
  state.dirty ||= dirty;
  if (sector > state.sector) {
    if (!state.dirty && sector === state.sector + 1 && sector > state.highestSector) stats.cleanSectors++;
    state.highestSector = Math.max(state.highestSector, sector);
    state.dirty = false;
  }
  state.sector = sector;
  for (const rival of race.rivals) {
    const gap = progress(race, track.length) - progress(rival, track.length);
    let pass = state.passes.get(rival.id);
    if (!pass) {pass = {armed: gap < -3, pending: 0, cooldown: 0}; state.passes.set(rival.id, pass);}
    pass.cooldown = Math.max(0, pass.cooldown - dt);
    if (gap < -8 && !pass.cooldown) pass.armed = true;
    if (pass.pending) {
      if (dirty || gap < 1 || rival.collision || rival.recovery.phase === 'recovered') pass.pending = 0;
      else if ((pass.pending -= dt) <= 0) {stats.cleanOvertakes++; pass.cooldown = 10; pass.pending = 0;}
    }
    if (pass.armed && gap > 3) {
      pass.armed = false;
      if (race.state === 'racing' && rival.state === 'racing' && rival.car.speed > 4 && state.cleanTime > 3
          && !rival.collision && Math.hypot(race.car.x-rival.car.x, race.car.z-rival.car.z) < 30) pass.pending = 1.5;
    }
  }
  state.finished = race.state === 'finished';
}
