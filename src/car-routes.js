import { VEHICLES } from './vehicles.js';
const ids = new Set(VEHICLES.map(vehicle => vehicle.id));
export const carPath = id => ids.has(id) ? `/cars/${id}/` : '/cars/';
export function carFromPath(pathname = '') {
  const match = /^\/cars\/([a-z0-9-]+)\/?$/.exec(pathname);
  return match && ids.has(match[1]) ? match[1] : null;
}
