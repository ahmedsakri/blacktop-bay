import { VEHICLES } from './vehicles.js';
import { RIVAL_GRID } from './rivals.js';
import { MANUFACTURER_ASSETS } from './manufacturer-asset-manifest.js';

// Seven distinct actual manufacturer bodies. Dynamic fleets use only mobile
// quality assets and reserve enough budget for every slot before choosing one.
export const MANUFACTURER_RIVAL_VEHICLES = Object.freeze(RIVAL_GRID.map(grid => grid.vehicle));
const validVehicles = new Set(VEHICLES.map(vehicle => vehicle.id));

export function opponentFleetCost(ids) {
  return ids.reduce((cost, id) => {
    const asset = MANUFACTURER_ASSETS[id]?.variants?.low;
    return { triangles: cost.triangles + (asset?.triangles || 0), bytes: cost.bytes + (asset?.bytes || 0) };
  }, { triangles: 0, bytes: 0 });
}

function randomFor(seed) {
  let state = 2166136261;
  for (const character of String(seed)) state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  return () => { state += 0x6d2b79f5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
}

export function createOpponentFleet({ playerVehicle, seed = 'blacktop-bay', mobile = false } = {}) {
  const random = randomFor(seed), pool = VEHICLES.filter(car => car.id !== playerVehicle && MANUFACTURER_ASSETS[car.id]?.low)
    .map(car => ({ ...car, random: random(), ...MANUFACTURER_ASSETS[car.id].variants.low }));
  const budget = { triangles: mobile ? 650_000 : 900_000, bytes: mobile ? 12_000_000 : 18_000_000 };
  const selected = [], brands = new Set(); let triangles = 0, bytes = 0;
  while (selected.length < RIVAL_GRID.length && pool.length) {
    pool.sort((a, b) => Number(brands.has(a.brand)) - Number(brands.has(b.brand)) || a.random - b.random);
    const remaining = RIVAL_GRID.length - selected.length - 1;
    let index = pool.findIndex(candidate => {
      const rest = pool.filter(car => car !== candidate).sort((a, b) => a.triangles - b.triangles).slice(0, remaining);
      return rest.length === remaining && triangles + candidate.triangles + rest.reduce((sum, car) => sum + car.triangles, 0) <= budget.triangles
        && bytes + candidate.bytes + rest.reduce((sum, car) => sum + car.bytes, 0) <= budget.bytes;
    });
    if (index < 0) index = pool.reduce((best, car, i) => car.triangles < pool[best].triangles ? i : best, 0);
    const [chosen] = pool.splice(index, 1);
    selected.push(chosen.id); brands.add(chosen.brand); triangles += chosen.triangles; bytes += chosen.bytes;
  }
  return resolveRivalVehicles(selected);
}

export function resolveRivalVehicles(requested) {
  return RIVAL_GRID.map((grid, index) => {
    const vehicle = Array.isArray(requested) ? requested[index] : undefined;
    return typeof vehicle === 'string' && validVehicles.has(vehicle) ? vehicle : grid.vehicle;
  });
}
