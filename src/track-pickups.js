import {getTrack, sampleTrack} from './track.js';

const COOLDOWN = 8;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const cache = new Map();

export function getTrackPickups(trackId) {
  const track = getTrack(trackId);
  if (!cache.has(track.id)) {
    const definitions = [.11, .26, .43, .59, .74, .9].map((fraction, index) => {
      const p = sampleTrack(track.length * fraction, track), lane = (index % 2 ? -1 : 1) * Math.min(2.8, track.width * .18);
      return Object.freeze({id: `${track.id}-nitro-${index + 1}`, s: p.s, lane,
        x: p.x + p.nx * lane, y: p.y || 0, z: p.z + p.nz * lane,
        tx: p.tx, tz: p.tz, nx: p.nx, nz: p.nz, radius: 2.4, refill: .32});
    });
    cache.set(track.id, Object.freeze(definitions));
  }
  return cache.get(track.id);
}

export function createTrackPickups(trackId) {
  return getTrackPickups(trackId).map(pickup => ({...pickup, playerAvailable: true, collectedBy: {}}));
}

export function pickupAvailable(pickup, racer, clock) {
  const previous = pickup.collectedBy[racer.id];
  return !previous || (racer.completedLaps > previous.lap && clock - previous.time >= COOLDOWN);
}

function distanceToSegmentSquared(x, z, from, to) {
  const dx = to.x - from.x, dz = to.z - from.z, length = dx * dx + dz * dz;
  const t = length ? clamp(((x - from.x) * dx + (z - from.z) * dz) / length, 0, 1) : 0;
  return (x - from.x - t * dx) ** 2 + (z - from.z - t * dz) ** 2;
}

export function collectTrackPickups(pickups, racer, previous, clock, track) {
  if (racer.state !== 'racing' || racer.wreck?.phase === 'impact' || racer.wreck?.phase === 'recovering') return;
  // The swept trigger handles fast cars, but never treats a reset/teleport as a
  // drive through every bottle on the intervening line.
  const travel = Math.hypot(racer.car.x - previous.x, racer.car.z - previous.z);
  if (travel > 4 || racer.car.forwardSpeed < 1 || racer.recovery.phase === 'recovered') return;
  for (const pickup of pickups) {
    if (!pickupAvailable(pickup, racer, clock)) continue;
    if (Math.abs((racer.car.y || 0) - pickup.y) > 2.8) continue;
    const arc = Math.abs(pickup.s - racer._safeS);
    if (Math.min(arc, track.length - arc) > 10) continue;
    if (distanceToSegmentSquared(pickup.x, pickup.z, previous, racer.car) > pickup.radius ** 2) continue;
    const before = racer.nitro.charge;
    racer.nitro.charge = Math.min(racer.nitro.capacity, before + racer.nitro.capacity * pickup.refill);
    pickup.collectedBy[racer.id] = {lap: racer.completedLaps, time: clock};
    if (racer.id === 'player') pickup.playerAvailable = false;
    racer.pickupEvent = {id: racer.pickupEvent.id + 1, kind: 'nitro', pickupId: pickup.id,
      amount: racer.nitro.charge - before, charge: racer.nitro.charge, capacity: racer.nitro.capacity, x: pickup.x, y: pickup.y, z: pickup.z};
  }
}

export function refreshPickupAvailability(pickups, player, clock) {
  for (const pickup of pickups) pickup.playerAvailable = pickupAvailable(pickup, player, clock);
}
