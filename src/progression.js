import { VEHICLES } from './vehicles.js';
import { LEGACY_VEHICLES } from './legacy-vehicles.js';
export const PROGRESSION_KEY = 'blacktop-bay-progression-v1';
export const MAX_LEVEL = 5;
export const MAX_CREDITS = 1_000_000;
export const UPGRADE_COMPONENTS = Object.freeze(['engine', 'tyres', 'nitro', 'handling']);
export const UPGRADE_COSTS = Object.freeze([200, 400, 700, 1100, 1600]);
const VEHICLE_IDS = VEHICLES.map(vehicle => vehicle.id);
const LEGACY_VEHICLE_IDS = LEGACY_VEHICLES.map(vehicle => vehicle.id);
const FINISH_REWARDS = [900, 650, 500, 350, 300, 250, 200, 150];
const MAX_RECEIPTS = 2048;
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(id);
const paidInSession = new Set();
const integer = (value) => typeof value === 'number' && Number.isSafeInteger(value);

export function normalizeUpgrades(value = {}) {
  return Object.fromEntries(UPGRADE_COMPONENTS.map((key) => [key,
    integer(value?.[key]) ? Math.max(0, Math.min(MAX_LEVEL, value[key])) : 0,
  ]));
}

function defaults() {
  return { version: 1, credits: 1200, cars: Object.fromEntries(VEHICLE_IDS.map((id) => [id, normalizeUpgrades()])), awardedRaces: [] };
}
function clean(value) {
  const state = defaults();
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return state;
  if (integer(value.credits) && value.credits >= 0) state.credits = Math.min(MAX_CREDITS, value.credits);
  // Retired builds remain in saved progress so a catalogue change never erases
  // earned levels. Only current catalogue IDs can receive new purchases.
  for (const id of VEHICLE_IDS) state.cars[id] = normalizeUpgrades(value.cars?.[id]);
  for (const id of LEGACY_VEHICLE_IDS) if (Object.hasOwn(value.cars ?? {}, id)) state.cars[id] = normalizeUpgrades(value.cars[id]);
  if (Array.isArray(value.awardedRaces)) state.awardedRaces = [...new Set(value.awardedRaces.filter(validId))].slice(-MAX_RECEIPTS);
  return state;
}
function storageOrNull(storage) {
  try { return storage === undefined ? globalThis.localStorage : storage; }
  catch { return null; }
}
function persist(state, storage) {
  try {
    const target = storageOrNull(storage);
    if (!target || typeof target.setItem !== 'function') return false;
    target.setItem(PROGRESSION_KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}
export function loadProgression(storage) {
  try {
    const raw = storageOrNull(storage)?.getItem(PROGRESSION_KEY);
    if (typeof raw !== 'string' || raw.length > 300_000) return defaults();
    return clean(JSON.parse(raw));
  } catch { return defaults(); }
}

export function getUpgradePreview(state, vehicle, component) {
  if (!VEHICLE_IDS.includes(vehicle) || !UPGRADE_COMPONENTS.includes(component)) return null;
  const current = normalizeUpgrades(state?.cars?.[vehicle]);
  const level = current[component], maxed = level === MAX_LEVEL;
  const cost = maxed ? null : UPGRADE_COSTS[level];
  return { level, nextLevel: Math.min(MAX_LEVEL, level + 1), cost, maxed,
    affordable: !maxed && integer(state?.credits) && state.credits >= cost,
    current, next: { ...current, [component]: Math.min(MAX_LEVEL, level + 1) } };
}

// Mutations are also usable in a private/blocked-storage session. The caller can
// use persisted=false to explain that this session's garage cannot be saved.
export function buyUpgrade(state, vehicle, component, storage) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return { ok: false, reason: 'invalid-state' };
  const safe = clean(state), preview = getUpgradePreview(safe, vehicle, component);
  if (!preview) return { ok: false, reason: 'invalid-upgrade' };
  if (preview.maxed) return { ok: false, reason: 'max-level', level: preview.level, cost: null, credits: safe.credits };
  if (!preview.affordable) return { ok: false, reason: 'insufficient-credits', level: preview.level, cost: preview.cost, credits: safe.credits };
  safe.credits -= preview.cost;
  safe.cars[vehicle] = preview.next;
  Object.assign(state, safe);
  const persisted = persist(state, storage);
  return { ok: true, reason: 'purchased', cost: preview.cost, level: preview.nextLevel, credits: state.credits, persisted };
}

export function awardRaceCredits(state, result, storage) {
  const rejected = { awarded: false, credits: 0, base: 0, driftBonus: 0, persisted: false };
  if (!state || typeof state !== 'object' || Array.isArray(state) || !result
    || (result.mode !== undefined && !['race', 'time-attack', 'championship'].includes(result.mode))
    || result.state !== 'finished' || result.completedLaps !== 3 || result.totalLaps !== 3
    || !Number.isFinite(result.elapsed) || result.elapsed <= 0 || result.elapsed > 900
    || !integer(result.position) || result.position < 1 || result.position > (result.mode === 'time-attack' ? 1 : 8)
    || !integer(result.score) || result.score < 0 || result.score > 1_000_000_000
    || !validId(result.raceId)) return rejected;
  const safe = clean(state);
  if (paidInSession.has(result.raceId) || safe.awardedRaces.includes(result.raceId)) return rejected;
  const base = result.mode === 'time-attack' ? 350 : FINISH_REWARDS[result.position - 1];
  const driftBonus = Math.min(500, Math.floor(result.score / 20));
  const credits = Math.min(MAX_CREDITS - safe.credits, base + driftBonus);
  safe.credits += credits;
  safe.awardedRaces.push(result.raceId);
  safe.awardedRaces = safe.awardedRaces.slice(-MAX_RECEIPTS);
  paidInSession.add(result.raceId);
  Object.assign(state, safe);
  const persisted = persist(state, storage);
  return { awarded: true, credits, base, driftBonus, persisted };
}
