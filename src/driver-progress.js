import { VEHICLES } from './vehicles.js';
import { TRACKS } from './track.js';
import { normalizeRaceOptions } from './race-options.js';

export const driverVehicleIds = new Set(VEHICLES.map(car => car.id));
export const driverTrackIds = new Set(TRACKS.map(track => track.id));
export const whole = (value, maximum = 1_000_000) => Number.isSafeInteger(value) && value >= 0 && value <= maximum;
export const validRaceId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value);
export const validRaceTime = value => Number.isFinite(value) && value > 0 && value <= 900;
export const cleanRaceIds = value => Array.isArray(value) ? [...new Set(value.filter(validRaceId))].slice(-2048) : [];

// These local progression systems consume the existing, checkpoint-validated
// reward receipt. They never award money or replace progression's finish gate.
export function eligibleDriverResult(race, receipt) {
  const options = normalizeRaceOptions(race);
  return receipt?.awarded === true && whole(receipt.credits, 1400)
    && race?.state === 'finished' && race.completedLaps === 3 && race.totalLaps === 3
    && validRaceId(race.raceId) && validRaceTime(race.elapsed)
    && driverVehicleIds.has(race.vehicle) && driverTrackIds.has(race.track)
    && race.mode === options.mode && race.difficulty === options.difficulty
    && whole(race.position, race.mode === 'time-attack' ? 1 : 8) && race.position >= 1
    && whole(race.score, 1_000_000_000) && whole(race.recoveries);
}

function resolveStorage(storage) {
  try { return storage === undefined ? globalThis.localStorage : storage; } catch { return null; }
}
export function loadDriverState(key, normalize, storage) {
  try {
    const raw = resolveStorage(storage)?.getItem(key);
    return normalize(typeof raw === 'string' && raw.length <= 1_000_000 ? JSON.parse(raw) : null);
  } catch { return normalize(null); }
}
export function persistDriverState(key, normalize, state, storage) {
  try {
    const target = resolveStorage(storage);
    if (typeof target?.setItem !== 'function') return false;
    target.setItem(key, JSON.stringify(normalize(state)));
    return true;
  } catch { return false; }
}
