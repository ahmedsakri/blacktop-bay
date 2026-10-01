import { VEHICLES } from './vehicles.js';
import { RIVAL_GRID } from './rivals.js';

// These three real bodies together cost about 103k triangles at mobile quality.
// The frontend prepares only this fixed fleet and reports each successfully
// loaded identity back to physics; a failed slot uses its original opponent.
export const MANUFACTURER_RIVAL_VEHICLES = Object.freeze([
  'rimac-nevera', 'aston-martin-one-77', 'koenigsegg-one-1',
]);
const validVehicles = new Set(VEHICLES.map(vehicle => vehicle.id));

export function resolveRivalVehicles(requested) {
  return RIVAL_GRID.map((grid, index) => {
    const vehicle = Array.isArray(requested) ? requested[index] : undefined;
    return typeof vehicle === 'string' && validVehicles.has(vehicle) ? vehicle : grid.vehicle;
  });
}
