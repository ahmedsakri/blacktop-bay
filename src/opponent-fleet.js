import { VEHICLES } from './vehicles.js';
import { RIVAL_GRID } from './rivals.js';

// These three real bodies together cost about 103k triangles at mobile quality.
// The frontend prepares only this fixed fleet and reports each successfully
// loaded identity back to physics; failed optional downloads reuse a prepared
// manufacturer model and its matching tuning.
export const MANUFACTURER_RIVAL_VEHICLES = Object.freeze(RIVAL_GRID.map(grid => grid.vehicle));
const validVehicles = new Set(VEHICLES.map(vehicle => vehicle.id));

export function resolveRivalVehicles(requested) {
  return RIVAL_GRID.map((grid, index) => {
    const vehicle = Array.isArray(requested) ? requested[index] : undefined;
    return typeof vehicle === 'string' && validVehicles.has(vehicle) ? vehicle : grid.vehicle;
  });
}
