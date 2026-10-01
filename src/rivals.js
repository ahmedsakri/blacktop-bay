import { projectOnTrack, sampleTrack } from './track.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

// Every opponent supplies ordinary controls to the same vehicle simulation as
// the player. Grid and lane choices are deterministic; no rubber-band teleports.
export const RIVAL_GRID = [
  { id: 'mira', name: 'Mira', vehicle: 'rimac-nevera', color: '#ffd166', s: 28, lane: 2.8, pace: .97 },
  { id: 'jax', name: 'Jax', vehicle: 'aston-martin-one-77', color: '#72edac', s: 28, lane: -2.8, pace: .96 },
  { id: 'nova', name: 'Nova', vehicle: 'koenigsegg-one-1', color: '#689cff', s: 20, lane: 2.8, pace: .95 },
  { id: 'ren', name: 'Ren', vehicle: 'ferrari-testarossa', color: '#ff486e', s: 20, lane: -2.8, pace: .94 },
  { id: 'kai', name: 'Kai', vehicle: 'audi-r18', color: '#c3fb13', s: 12, lane: 2.8, pace: .93 },
  { id: 'aria', name: 'Aria', vehicle: 'audi-r8-lms-gt3', color: '#b99aff', s: 12, lane: -2.8, pace: .92 },
  { id: 'leo', name: 'Leo', vehicle: 'rimac-concept-one', color: '#ffac76', s: 4, lane: 2.8, pace: .91 },
];

export function rivalControls(racer, field, track, specs, dt) {
  const car = racer.car;
  const projection = projectOnTrack(car.x, car.z, racer._trackIndex, track);
  const near = sampleTrack(projection.s + 3, track), far = sampleTrack(projection.s + 22, track);
  const curvature = Math.abs(wrap(Math.atan2(far.tx, far.tz) - Math.atan2(near.tx, near.tz))) / 19;
  let desiredLane = racer._baseLane, nearest = null;
  let blocked = false;
  const traffic = [];
  for (const other of field) {
    if (other === racer || other.state === 'finished') continue;
    const dx = other.car.x - car.x, dz = other.car.z - car.z;
    const ahead = dx * projection.tx + dz * projection.tz;
    const across = dx * projection.nx + dz * projection.nz;
    const lane = projection.signedDistance + across;
    traffic.push({ ahead, across, lane, speed: other.car.speed });
    if (ahead > -1 && ahead < 9 + car.speed * .35 && Math.abs(across) < 2.6
      && (!nearest || ahead < nearest.ahead)) nearest = { ahead, across, lane, speed: other.car.speed };
  }
  if (nearest) {
    // Commit to a pass instead of oscillating with the iteration order of seven
    // opponents. Score both shoulders, including cars already alongside us.
    const laneLimit = Math.min(3.2, track.width / 2 - 2.6);
    const scoreLane = lane => traffic.reduce((score, other) => score +
      (other.ahead > -7 && other.ahead < 20 ? Math.max(0, 3.3 - Math.abs(other.lane - lane)) * (other.ahead < 6 ? 5 : 1) : 0),
    Math.abs(lane - racer._lane) * .12);
    const left = -laneLimit, right = laneLimit;
    const preferred = scoreLane(left) < scoreLane(right) ? left : right;
    desiredLane = racer._passTime > 0 && Math.abs(racer._passLane) > 0
      && scoreLane(racer._passLane) <= scoreLane(preferred) + 2 ? racer._passLane : preferred;
    racer._passLane = desiredLane; racer._passTime = .85;
    blocked = nearest.ahead < 6 && Math.abs(nearest.across) < 2.1 && car.speed > nearest.speed - 1;
  } else if (racer._passTime > 0) {
    racer._passTime = Math.max(0, racer._passTime - dt);
    desiredLane = racer._passLane;
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
