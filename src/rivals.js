import { projectOnTrack, sampleTrack } from './track.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

// Every opponent supplies ordinary controls to the same vehicle simulation as
// the player. Grid and lane choices are deterministic; no rubber-band teleports.
export const RIVAL_GRID = [
  { id: 'mira', name: 'Mira', vehicle: 'gt', color: '#ffd166', s: 24, lane: 2.8, pace: 0.97 },
  { id: 'jax', name: 'Jax', vehicle: 'rally', color: '#72edac', s: 16, lane: -2.8, pace: 0.94 },
  { id: 'nova', name: 'Nova', vehicle: 'coupe', color: '#689cff', s: 8, lane: 2.8, pace: 0.91 },
];

export function rivalControls(racer, field, track, specs, dt) {
  const car = racer.car;
  const projection = projectOnTrack(car.x, car.z, racer._trackIndex, track);
  const near = sampleTrack(projection.s + 3, track), far = sampleTrack(projection.s + 22, track);
  const curvature = Math.abs(wrap(Math.atan2(far.tx, far.tz) - Math.atan2(near.tx, near.tz))) / 19;
  let desiredLane = racer._baseLane;
  let blocked = false;
  for (const other of field) {
    if (other === racer || other.state === 'finished') continue;
    const dx = other.car.x - car.x, dz = other.car.z - car.z;
    const ahead = dx * projection.tx + dz * projection.tz;
    const across = dx * projection.nx + dz * projection.nz;
    if (ahead > -1 && ahead < 9 + car.speed * 0.35 && Math.abs(across) < 2.6) {
      const otherLane = projection.signedDistance + across;
      desiredLane = otherLane >= 0 ? -3.2 : 3.2;
      if (ahead < 6 && Math.abs(across) < 2.1 && car.speed > other.car.speed - 1) blocked = true;
    }
  }
  racer._lane += (desiredLane - racer._lane) * (1 - Math.exp(-dt * 2.5));
  const aim = sampleTrack(projection.s + 10 + car.speed * 0.45, track);
  const aimX = aim.x + aim.nx * racer._lane, aimZ = aim.z + aim.nz * racer._lane;
  const error = wrap(Math.atan2(aimX - car.x, aimZ - car.z) - car.yaw);
  const straight = curvature < 0.004 && Math.abs(error) < 0.12 && !blocked;
  const nitro = straight && racer.nitro.charge > 0.5 && !racer.nitro.locked;
  const targetSpeed = Math.min(specs.topSpeed * 0.83 + (nitro ? 6 : 0), Math.sqrt(10.2 * specs.handling / Math.max(0.003, curvature))) * racer._pace;
  return {
    steer: clamp(-error * 2.9 / specs.handling, -1, 1), throttle: blocked ? 0.4 : 1,
    // Keep a walking-speed crawl while steering around a stopped car; braking
    // all the way to zero would remove the steering authority needed to pass.
    brake: (blocked && car.speed > 3) || car.speed > targetSpeed + 0.6, handbrake: false, nitro,
  };
}
