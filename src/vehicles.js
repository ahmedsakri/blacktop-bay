import { MANUFACTURER_VEHICLES } from './manufacturer-vehicles.js';

// The public garage and racing catalogue contains real manufacturer models only.
export const VEHICLES = MANUFACTURER_VEHICLES;
export const DEFAULT_VEHICLE_ID = 'mclaren-p1-gtr';

export function getVehicle(id = DEFAULT_VEHICLE_ID) {
  return VEHICLES.find(vehicle => vehicle.id === id)
    || VEHICLES.find(vehicle => vehicle.id === DEFAULT_VEHICLE_ID);
}
