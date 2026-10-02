export const STORAGE_KEY = 'appsoverflow-coastal-racer-v1';

const MAX_TIME = 900;
const MAX_FRAMES = 9000;
const MAX_SCORE = 1_000_000_000;
const MAX_POSITION = 1000;
const MAX_YAW = Math.PI * 8;
const MAX_JSON_LENGTH = 2_000_000;

// Missing, unavailable, or malformed storage always starts with these values.
const defaults = () => ({ bestTime: null, bestScore: 0, ghost: [], sound: true });
const bounded = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const validTime = (value) => bounded(value, Number.EPSILON, MAX_TIME);
const validScore = (value) => bounded(value, 0, MAX_SCORE) && Number.isInteger(value);

function resolveStorage(storage) {
  try { return storage === undefined ? globalThis.localStorage : storage; }
  catch { return null; }
}

function cleanFrames(frames, duration) {
  if (!Array.isArray(frames) || frames.length < 2 || frames.length > MAX_FRAMES || !validTime(duration)) return [];
  let previousTime = -1;
  const result = [];
  for (const frame of frames) {
    if (!frame || typeof frame !== 'object'
      || !bounded(frame.t, 0, duration + 1e-7) || frame.t <= previousTime
      || !bounded(frame.x, -MAX_POSITION, MAX_POSITION)
      || !bounded(frame.z, -MAX_POSITION, MAX_POSITION)
      || !bounded(frame.yaw, -MAX_YAW, MAX_YAW)) return [];
    previousTime = frame.t;
    const clean = { t: frame.t, x: frame.x, z: frame.z, yaw: frame.yaw };
    for(const [key,min,max] of [['y',-1000,1000],['pitch',-Math.PI*8,Math.PI*8],['roll',-Math.PI*8,Math.PI*8],['progress',0,1]]) {
      if(frame[key] !== undefined){if(!bounded(frame[key],min,max))return [];clean[key]=frame[key];}
    }
    result.push(clean);
  }
  return result;
}

function read(storage) {
  const fallback = defaults();
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (typeof raw !== 'string' || raw.length > MAX_JSON_LENGTH) return fallback;
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
    const bestTime = validTime(value.bestTime) ? value.bestTime : null;
    return {
      bestTime,
      bestScore: validScore(value.bestScore) ? value.bestScore : 0,
      ghost: bestTime === null ? [] : cleanFrames(value.ghost, bestTime),
      sound: typeof value.sound === 'boolean' ? value.sound : true,
    };
  } catch { return fallback; }
}

function write(storage, records) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(records)); }
  catch { /* Private browsing, unavailable storage, and full quotas are optional. */ }
  return records;
}

export function loadRecords(storage) {
  return read(resolveStorage(storage));
}

export function saveResult(race, frames, storage) {
  const target = resolveStorage(storage);
  const records = read(target);
  if (!race || race.state !== 'finished' || race.completedLaps !== 3 || race.totalLaps !== 3
    || !validTime(race.elapsed) || !validScore(race.score)) return records;

  records.bestScore = Math.max(records.bestScore, race.score);
  if (records.bestTime === null || race.elapsed < records.bestTime) {
    records.bestTime = race.elapsed;
    // A broken replay never remains attached to a different record time. The
    // valid race result is retained, while invalid replay data is discarded.
    records.ghost = cleanFrames(frames, race.elapsed);
  }
  return write(target, records);
}

export function setSound(enabled, storage) {
  const target = resolveStorage(storage);
  const records = read(target);
  if (typeof enabled !== 'boolean') return records;
  records.sound = enabled;
  return write(target, records);
}

export function clearRecords(storage) {
  const target = resolveStorage(storage);
  // Clearing records preserves the player's sound preference.
  return write(target, { ...defaults(), sound: read(target).sound });
}
