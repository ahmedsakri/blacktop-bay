import { driverVehicleIds, driverTrackIds, loadDriverState, persistDriverState } from './driver-progress.js';

export const SETUPS_KEY = 'camber-reign-setups-v1';
export const CAR_SETUPS = Object.freeze([
  { id: 'balanced', name: 'Factory balance', focus: 'Your car. Your upgrades. Unchanged.',
    advantage: 'The original all-round tune.', tradeoff: 'No specialised advantage.', factors: {} },
  { id: 'grip', name: 'Corner grip', focus: 'Confidence through technical sections.',
    advantage: '+10% grip · +6% braking · +4% steering response', tradeoff: '−4% top speed · −2% acceleration',
    factors: { grip: 1.10, braking: 1.06, handling: 1.04, steeringResponse: 1.04, topSpeed: .96, acceleration: .98 } },
  { id: 'sprint', name: 'Straight-line', focus: 'Stretch your legs on fast circuits.',
    advantage: '+4.5% top speed · +4% acceleration', tradeoff: '−7% grip · −6% braking · −3% handling',
    factors: { topSpeed: 1.045, acceleration: 1.04, grip: .93, braking: .94, handling: .97 } },
  { id: 'endurance', name: 'Nitro reserve', focus: 'More boost to work with over a lap.',
    advantage: '+12% Nitro capacity · +12% recharge', tradeoff: '−6% boost force · −4% acceleration · −2% top speed',
    factors: { nitroCapacity: 1.12, recharge: 1.12, nitroAcceleration: .94, acceleration: .96, topSpeed: .98 } },
].map(item => Object.freeze({ ...item, factors: Object.freeze(item.factors) })));

export function normalizeSetup(id) { return CAR_SETUPS.some(setup => setup.id === id) ? id : 'balanced'; }
export function normalizeSetups(value) {
  const state = { version: 1, cars: {}, circuits: {} };
  if (value?.version !== 1 || !value.cars || typeof value.cars !== 'object' || Array.isArray(value.cars)) return state;
  for (const id of driverVehicleIds) if (Object.hasOwn(value.cars, id)) state.cars[id] = normalizeSetup(value.cars[id]);
  for (const id of driverVehicleIds) {
    const saved = value.circuits?.[id];
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) continue;
    const circuits = {};
    for (const track of driverTrackIds) if (Object.hasOwn(saved, track) && CAR_SETUPS.some(setup => setup.id === saved[track])) circuits[track] = saved[track];
    if (Object.keys(circuits).length) state.circuits[id] = circuits;
  }
  return state;
}
export function getCarSetup(state, vehicle, track = null) {
  if (!driverVehicleIds.has(vehicle)) return 'balanced';
  const circuit = driverTrackIds.has(track) ? state?.circuits?.[vehicle]?.[track] : null;
  return normalizeSetup(circuit ?? state?.cars?.[vehicle]);
}
export function selectCarSetup(value, vehicle, setupId, track = null) {
  const state = normalizeSetups(value);
  if (!driverVehicleIds.has(vehicle) || (track !== null && !driverTrackIds.has(track)) || !CAR_SETUPS.some(setup => setup.id === setupId)) return { state, selected: false };
  if (track === null) state.cars[vehicle] = setupId;
  else { state.circuits[vehicle] ||= {}; state.circuits[vehicle][track] = setupId; }
  return { state, selected: true, setup: setupId, track };
}
export function applyCarSetup(baseSpecs, setupId = 'balanced') {
  const specs = { ...baseSpecs }, setup = CAR_SETUPS.find(item => item.id === normalizeSetup(setupId));
  for (const [property, multiplier] of Object.entries(setup.factors)) {
    if (!Number.isFinite(specs[property]) || specs[property] <= 0) throw new TypeError(`Invalid setup stat: ${property}`);
    specs[property] *= multiplier;
  }
  return specs;
}
export const loadSetups = storage => loadDriverState(SETUPS_KEY, normalizeSetups, storage);
export const persistSetups = (state, storage) => persistDriverState(SETUPS_KEY, normalizeSetups, state, storage);

export function clearCircuitSetup(value, vehicle, track) {
  const state = normalizeSetups(value);
  if (!driverVehicleIds.has(vehicle) || !driverTrackIds.has(track)) return {state, selected: false};
  if (state.circuits[vehicle]) { delete state.circuits[vehicle][track]; if (!Object.keys(state.circuits[vehicle]).length) delete state.circuits[vehicle]; }
  return {state, selected: true, setup: getCarSetup(state, vehicle), track};
}
