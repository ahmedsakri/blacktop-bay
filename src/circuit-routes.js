import { TRACKS } from './track.js';
const ids = new Set(TRACKS.map(track => track.id));
export const circuitPath = id => ids.has(id) ? `/circuits/${id}/` : '/circuits/';
export function circuitFromPath(pathname = '') {
  const match = /^\/circuits\/([a-z0-9-]+)\/?$/.exec(pathname);
  return match && ids.has(match[1]) ? match[1] : null;
}
