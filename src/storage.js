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

// Only unsaved candidates live here. Persisted records are reread so another
// tab/import remains visible; session candidates cannot be lost by menu reload.
const pendingByStorage = new WeakMap(), unavailableStorage = {};
const clone = records => ({...records, ghost: records.ghost.map(frame => ({...frame}))});
const scopeKey = options => typeof options?.scope === 'string' && options.scope.length <= 1000 ? options.scope : 'default';
function pendingMap(target) {
  let owner = target;
  try {if (target && 'storageIdentity' in target) owner = target.storageIdentity;} catch {owner = null;}
  const identity = owner && (typeof owner === 'object' || typeof owner === 'function') ? owner : unavailableStorage;
  let map = pendingByStorage.get(identity);
  if (!map) {map = new Map(); pendingByStorage.set(identity, map);}
  return map;
}
function mergeRecords(stored, candidate) {
  const useCandidate = candidate.bestTime !== null && (stored.bestTime === null || candidate.bestTime <= stored.bestTime);
  return clone({...stored, bestTime: useCandidate ? candidate.bestTime : stored.bestTime,
    ghost: useCandidate ? candidate.ghost : stored.ghost,
    bestScore: Math.max(stored.bestScore, candidate.bestScore), sound: candidate.sound});
}
function write(target, records, options, replace = false) {
  const map = pendingMap(target), scope = scopeKey(options), payload = JSON.stringify(records);
  let reason = null;
  if (!target?.setItem || !target?.getItem) reason = 'unavailable';
  else {
    // A readable previous value is required before overwriting this key. If a
    // privacy policy blocks reads but permits writes, a fallback default must
    // not replace an existing (possibly faster) durable personal best.
    try { target.getItem(STORAGE_KEY); } catch { reason = 'unavailable'; }
    if (!reason) try { target.setItem(STORAGE_KEY, payload); }
    catch { reason = 'write-failed'; }
    if (!reason) {
      try { if (target.getItem(STORAGE_KEY) !== payload) reason = 'verification-failed'; }
      catch { reason = 'verification-failed'; }
    }
  }
  if (reason) map.set(scope, {records: clone(records), reason, replace: replace || map.get(scope)?.replace === true});
  else map.delete(scope);
  return {records: clone(records), persisted: !reason, pending: Boolean(reason), reason};
}

export function loadRecords(storage, options) {
  const target = resolveStorage(storage), stored = read(target), pending = pendingMap(target).get(scopeKey(options));
  return pending ? pending.replace ? clone(pending.records) : mergeRecords(stored, pending.records) : stored;
}

export function recordSaveStatus(storage, options) {
  const pending = pendingMap(resolveStorage(storage)).get(scopeKey(options));
  return {persisted: !pending, pending: Boolean(pending), reason: pending?.reason || null};
}

export function saveResultWithStatus(race, frames, storage, options) {
  const target = resolveStorage(storage), records = loadRecords(target, options);
  if (!race || race.state !== 'finished' || race.completedLaps !== 3 || race.totalLaps !== 3
    || !validTime(race.elapsed) || !validScore(race.score)) return {records, ...recordSaveStatus(target, options)};
  records.bestScore = Math.max(records.bestScore, race.score);
  if (records.bestTime === null || race.elapsed < records.bestTime) {
    records.bestTime = race.elapsed;
    records.ghost = cleanFrames(frames, race.elapsed);
  }
  return write(target, records, options);
}

// Compatibility for callers which only need the record. Result screens should
// use the receipt API and distinguish persisted from session-only records.
export function saveResult(race, frames, storage, options) {
  return saveResultWithStatus(race, frames, storage, options).records;
}
export function retryRecordSave(storage, options) {
  const target = resolveStorage(storage), pending = pendingMap(target).get(scopeKey(options));
  if (!pending) return {records: loadRecords(target, options), ...recordSaveStatus(target, options)};
  return write(target, loadRecords(target, options), options, pending.replace);
}
export function exportPendingRecords(storage) {
  return {format: 'camber-reign-unsaved-records', version: 1,
    entries: [...pendingMap(resolveStorage(storage))].map(([scope, entry]) => ({scope, records: clone(entry.records)}))};
}

export function setSound(enabled, storage, options) {
  const target = resolveStorage(storage), records = loadRecords(target, options);
  if (typeof enabled !== 'boolean') return records;
  records.sound = enabled;
  return write(target, records, options).records;
}

export function clearRecords(storage, options) {
  const target = resolveStorage(storage);
  return write(target, {...defaults(), sound: loadRecords(target, options).sound}, options, true).records;
}

// This small fallback file remains restorable when full-save export cannot read
// browser storage. Validate the complete file before touching any save key.
export function importPendingRecords(json, storage) {
  const target = resolveStorage(storage), failure = error => ({ok:false,persisted:false,pending:false,imported:0,entries:[],error});
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
  let payload;
  try {
    if (typeof json !== 'string' || json.length > 32_000_000) return failure('Record backup is missing or exceeds 32 MB.');
    payload = JSON.parse(json);
    if (!exact(payload,['format','version','entries']) || payload.format !== 'camber-reign-unsaved-records' || payload.version !== 1
      || !Array.isArray(payload.entries) || payload.entries.length > 503) return failure('Invalid record backup format.');
    const seen = new Set();
    for (const entry of payload.entries) {
      if (!exact(entry,['scope','records']) || typeof entry.scope !== 'string' || entry.scope.length > 240-STORAGE_KEY.length-1
        || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.scope) || seen.has(entry.scope)) return failure('Invalid or duplicate record scope.');
      seen.add(entry.scope);
      const records = entry.records;
      if (!exact(records,['bestTime','bestScore','ghost','sound']) || !(records.bestTime === null || validTime(records.bestTime))
        || !validScore(records.bestScore) || typeof records.sound !== 'boolean' || !Array.isArray(records.ghost)
        || records.bestTime === null && records.ghost.length) return failure('Invalid record values.');
      if (records.ghost.length) {
        const cleaned = cleanFrames(records.ghost,records.bestTime);
        if (cleaned.length !== records.ghost.length || records.ghost.some((frame,i) => Object.keys(frame).length !== Object.keys(cleaned[i]).length
          || Object.entries(frame).some(([key,value]) => !Object.hasOwn(cleaned[i],key) || cleaned[i][key] !== value))) return failure('Invalid ghost recording.');
      }
    }
  } catch {return failure('Invalid record backup JSON.');}
  const entries = payload.entries.map(({scope,records}) => {
    const scoped = {storageIdentity:target,getItem:() => target?.getItem(`${STORAGE_KEY}-${scope}`),setItem:(_key,value) => {
      if (!target?.setItem) throw new Error('Storage unavailable');
      target.setItem(`${STORAGE_KEY}-${scope}`,value);
    }};
    const existing = loadRecords(scoped,{scope}), merged = mergeRecords(existing,records);
    merged.sound = existing.sound;
    return {scope,...write(scoped,merged,{scope})};
  });
  const pending = entries.some(entry => entry.pending);
  return {ok:true,persisted:!pending,pending,imported:entries.length,entries,error:null};
}
