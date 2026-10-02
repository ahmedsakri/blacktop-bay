import { circuitMedal } from './race-career.js';
import { driverVehicleIds, driverTrackIds, eligibleDriverResult, cleanRaceIds, whole,
  loadDriverState, persistDriverState } from './driver-progress.js';

export const MASTERY_KEY = 'camber-reign-mastery-v1';
export const MASTERY_GOALS = Object.freeze([
  { id: 'first', label: 'First finish', description: 'Complete one three-lap run.', metric: 'finishes', target: 1 },
  { id: 'explorer', label: 'Circuit range', description: 'Finish on three different circuits.', metric: 'circuits', target: 3 },
  { id: 'contender', label: 'Contender', description: 'Earn three podiums or solo gold-target finishes.', metric: 'strongFinishes', target: 3 },
  { id: 'flow', label: 'Corner flow', description: 'Bank 2,500 drift points across completed runs.', metric: 'driftScore', target: 2500 },
  { id: 'control', label: 'In control', description: 'Complete three runs without a reset.', metric: 'resetFreeFinishes', target: 3 },
].map(Object.freeze));
const TIERS = ['New connection', 'First connection', 'Finding rhythm', 'In the groove', 'At one', 'Car mastered'];
const emptyCar = () => ({ finishes: 0, circuits: [], strongFinishes: 0, driftScore: 0, resetFreeFinishes: 0 });
export function normalizeMastery(value) {
  const state = { version: 1, cars: {}, recordedRaces: [] };
  if (value?.version !== 1 || typeof value !== 'object' || Array.isArray(value)) return state;
  state.recordedRaces = cleanRaceIds(value.recordedRaces);
  for (const id of driverVehicleIds) {
    const item = value.cars?.[id];
    if (!item || !whole(item.finishes) || item.finishes < 1) continue;
    state.cars[id] = { finishes: item.finishes,
      circuits: Array.isArray(item.circuits) ? [...new Set(item.circuits.filter(id => driverTrackIds.has(id)))].slice(0, item.finishes) : [],
      strongFinishes: whole(item.strongFinishes) ? Math.min(item.finishes, item.strongFinishes) : 0,
      driftScore: whole(item.driftScore, 1_000_000_000) ? item.driftScore : 0,
      resetFreeFinishes: whole(item.resetFreeFinishes) ? Math.min(item.finishes, item.resetFreeFinishes) : 0 };
  }
  return state;
}
export function getCarMastery(value, vehicle) {
  const record = normalizeMastery(value).cars[vehicle] || emptyCar();
  const goals = MASTERY_GOALS.map(goal => { const current = goal.metric === 'circuits' ? record.circuits.length : record[goal.metric];
    return { ...goal, current, complete: current >= goal.target }; });
  const complete = goals.filter(goal => goal.complete).length;
  return { ...record, goals, complete, total: goals.length, tier: TIERS[complete], vehicle };
}
export function recordMasteryResult(value, race, receipt) {
  const state = normalizeMastery(value), rejected = { state, recorded: false, newlyEarned: [], mastery: null };
  if (!eligibleDriverResult(race, receipt) || state.recordedRaces.includes(race.raceId)) return rejected;
  const before = getCarMastery(state, race.vehicle), record = state.cars[race.vehicle] || emptyCar();
  const strong = race.mode === 'time-attack' ? circuitMedal(race) === 'gold' : race.position <= 3;
  state.cars[race.vehicle] = { finishes: Math.min(1_000_000, record.finishes + 1),
    circuits: [...new Set([...record.circuits, race.track])],
    strongFinishes: Math.min(1_000_000, record.strongFinishes + Number(strong)),
    driftScore: Math.min(1_000_000_000, record.driftScore + race.score),
    resetFreeFinishes: Math.min(1_000_000, record.resetFreeFinishes + Number(race.recoveries === 0)) };
  state.recordedRaces = [...state.recordedRaces, race.raceId].slice(-2048);
  const mastery = getCarMastery(state, race.vehicle);
  return { state, recorded: true, mastery,
    newlyEarned: mastery.goals.filter(goal => goal.complete && !before.goals.find(item => item.id === goal.id).complete) };
}
export const loadMastery = storage => loadDriverState(MASTERY_KEY, normalizeMastery, storage);
export const persistMastery = (state, storage) => persistDriverState(MASTERY_KEY, normalizeMastery, state, storage);

export function getNextMasteryGoal(value, vehicle) {
  const mastery = getCarMastery(value, vehicle);
  const goal = mastery.goals.filter(item => !item.complete).sort((a, b) => b.current / b.target - a.current / a.target)[0];
  if (!goal) return null;
  const remaining = goal.target - goal.current;
  const units = {finishes:'completed run', circuits:'new circuit', strongFinishes:'podium or solo gold', driftScore:'banked drift point', resetFreeFinishes:'reset-free run'};
  return {...goal, kind:'mastery', vehicle, remaining, description:`${remaining.toLocaleString('en-US')} more ${units[goal.metric]}${remaining === 1 ? '' : 's'} to earn ${goal.label}.`};
}
