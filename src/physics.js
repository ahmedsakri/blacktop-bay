import { TRACK, projectOnTrack, sampleTrack } from './track.js';

export { TRACK, projectOnTrack, sampleTrack };

const STEP = 1 / 120;
const CHECKPOINTS = 12;
const CAR_RADIUS = 0.95;
const MAX_SPEED = 45;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const angleWrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

export function createRace() {
  return {
    car: { ...TRACK.spawn, speed: 0, forwardSpeed: 0, lateralSpeed: 0, steering: 0, drifting: false, vx: 0, vz: 0, yawRate: 0, slipAngle: 0 },
    velocity: { x: 0, z: 0 },
    elapsed: 0, lapElapsed: 0, score: 0, driftPoints: 0, combo: 1,
    lap: 1, completedLaps: 0, totalLaps: 3, bestLap: null, lastLap: null,
    lapTimes: [], state: 'ready', collision: false, progress: 0, raceProgress: 0,
    recoveries: 0,
    _accumulator: 0, _collisionTimer: 0, _collisionCooldown: 0,
    _driftTime: 0, _straightTime: 0, _lastTrackS: 0, _trackIndex: 0,
    _lapDistance: 0, _nextCheckpoint: 1, _safeS: 0,
  };
}

export function startRace(race) {
  Object.assign(race, createRace());
  race.state = 'racing';
  return race;
}

function clearDrift(race) {
  race.driftPoints = 0; race.combo = 1; race._driftTime = 0; race._straightTime = 0;
  race.car.drifting = false;
}

function bankDrift(race) {
  race.score += Math.floor(race.driftPoints);
  clearDrift(race);
}

export function resetCar(race) {
  if (race.state === 'finished') return false;
  const location = sampleTrack(race._safeS);
  Object.assign(race.car, {
    x: location.x, z: location.z, yaw: Math.atan2(location.tx, location.tz),
    speed: 0, forwardSpeed: 0, lateralSpeed: 0, vx: 0, vz: 0,
    steering: 0, yawRate: 0, slipAngle: 0, drifting: false,
  });
  race.velocity.x = 0; race.velocity.z = 0;
  race._lastTrackS = location.s;
  race._trackIndex = location.index;
  race._collisionTimer = 0; race._collisionCooldown = 0; race.collision = false;
  race.recoveries++;
  clearDrift(race);
  return true;
}

export function stepRace(race, input = {}, dt = STEP) {
  if (race.state !== 'racing' || !Number.isFinite(dt) || dt <= 0) return race;
  race._accumulator += Math.min(dt, 0.1);
  const controls = {
    steer: clamp(finite(input.steer), -1, 1),
    throttle: clamp(finite(input.throttle), 0, 1),
    brake: Boolean(input.brake), handbrake: Boolean(input.handbrake),
  };
  while (race._accumulator + 1e-10 >= STEP && race.state === 'racing') {
    simulate(race, controls, STEP);
    race._accumulator -= STEP;
  }
  return race;
}

function simulate(race, input, dt) {
  const car = race.car;
  race.elapsed += dt;
  race.lapElapsed += dt;
  race._collisionTimer = Math.max(0, race._collisionTimer - dt);
  race._collisionCooldown = Math.max(0, race._collisionCooldown - dt);
  car.steering += (input.steer - car.steering) * (1 - Math.exp(-12 * dt));

  const speed = Math.hypot(car.vx, car.vz);
  const turnRate = (1.5 - Math.min(speed, MAX_SPEED) * 0.013) * clamp(speed / 5, 0, 1);
  const desiredYawRate = car.steering * turnRate * (input.handbrake ? 1.18 : 1);
  car.yawRate += (desiredYawRate - car.yawRate) * (1 - Math.exp(-10 * dt));
  car.yaw = angleWrap(car.yaw + car.yawRate * dt);
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const rx = fz, rz = -fx;
  let forward = car.vx * fx + car.vz * fz;
  let lateral = car.vx * rx + car.vz * rz;
  const drive = input.brake ? 0 : input.throttle * 14 * (input.handbrake ? 0.45 : 1);
  const resistance = 0.65 + 0.0078 * speed * speed + (input.brake ? 32 : 0) + (input.handbrake ? 4 : 0);
  forward = Math.max(0, forward + (drive - resistance) * dt);
  lateral *= Math.exp(-(input.handbrake ? 1.8 : 9.5) * dt);
  car.vx = fx * forward + rx * lateral;
  car.vz = fz * forward + rz * lateral;
  const newSpeed = Math.hypot(car.vx, car.vz);
  if (newSpeed > MAX_SPEED) {
    car.vx *= MAX_SPEED / newSpeed; car.vz *= MAX_SPEED / newSpeed;
  }
  car.x += car.vx * dt;
  car.z += car.vz * dt;

  let projection = projectOnTrack(car.x, car.z, race._trackIndex);
  const barrier = TRACK.width / 2 - CAR_RADIUS;
  const outside = Math.abs(projection.signedDistance) - barrier;
  if (outside > 0) {
    const side = Math.sign(projection.signedDistance);
    car.x = projection.x + projection.nx * side * (barrier - 0.03);
    car.z = projection.z + projection.nz * side * (barrier - 0.03);
    const outward = (car.vx * projection.nx + car.vz * projection.nz) * side;
    if (outward > 0) {
      car.vx -= projection.nx * side * outward * 1.12;
      car.vz -= projection.nz * side * outward * 1.12;
    }
    if (race._collisionCooldown <= 0 && (outward > 0.7 || outside > 0.3)) {
      car.vx *= 0.68; car.vz *= 0.68;
      race._collisionTimer = 0.24;
      race._collisionCooldown = 0.28;
      clearDrift(race);
    }
    projection = projectOnTrack(car.x, car.z, projection.index);
  }
  race.collision = race._collisionTimer > 0;
  car.speed = Math.hypot(car.vx, car.vz);
  car.forwardSpeed = car.vx * fx + car.vz * fz;
  car.lateralSpeed = car.vx * rx + car.vz * rz;
  car.slipAngle = Math.atan2(car.lateralSpeed, Math.max(0.01, car.forwardSpeed));
  race.velocity.x = car.vx; race.velocity.z = car.vz;

  updateProgress(race, projection, dt);
  if (race.state === 'finished') return;

  const slip = Math.abs(car.slipAngle);
  car.drifting = !race.collision && car.speed > 10 && car.forwardSpeed > car.speed * 0.55
    && slip > 0.17 && slip < 1.05 && Math.abs(projection.signedDistance) < barrier - 0.15;
  if (car.drifting) {
    race._straightTime = 0;
    race._driftTime += dt;
    race.combo = Math.min(5, 1 + Math.floor(race._driftTime / 1.25));
    race.driftPoints += slip * 180 / Math.PI * car.speed * 0.12 * race.combo * dt;
  } else if (!race.collision) {
    race._straightTime += dt;
    if (race._straightTime > 0.45) bankDrift(race);
  }
}

function updateProgress(race, projection, dt) {
  const previous = race._lastTrackS;
  let delta = projection.s - previous;
  if (delta > TRACK.length / 2) delta -= TRACK.length;
  if (delta < -TRACK.length / 2) delta += TRACK.length;
  const plausible = Math.max(1.5, race.car.speed * dt * 2.6 + 0.3);
  const onRoad = Math.abs(projection.signedDistance) <= TRACK.width / 2;
  if (Math.abs(delta) <= plausible && onRoad) {
    race._lapDistance = Math.max(0, race._lapDistance + delta);
    race._safeS = projection.s;
    if (delta > 0) {
      const checkpoint = race._nextCheckpoint * TRACK.length / CHECKPOINTS;
      if (race._nextCheckpoint < CHECKPOINTS && previous < checkpoint && projection.s >= checkpoint) race._nextCheckpoint++;
      const crossedFinish = previous > TRACK.length * 0.9 && projection.s < TRACK.length * 0.1;
      if (crossedFinish && race._nextCheckpoint === CHECKPOINTS && race._lapDistance >= TRACK.length * 0.98) {
        race.lastLap = race.lapElapsed;
        race.lapTimes.push(race.lastLap);
        race.bestLap = race.bestLap === null ? race.lastLap : Math.min(race.bestLap, race.lastLap);
        race.lapElapsed = 0;
        race.completedLaps++;
        race.lap = Math.min(race.totalLaps, race.completedLaps + 1);
        race._lapDistance = Math.max(0, race._lapDistance - TRACK.length);
        race._nextCheckpoint = 1;
        if (race.completedLaps >= race.totalLaps) {
          bankDrift(race);
          race.state = 'finished';
          race.progress = 1; race.raceProgress = 1;
        }
      }
    }
  }
  race._lastTrackS = projection.s;
  race._trackIndex = projection.index;
  if (race.state !== 'finished') {
    race.progress = clamp(race._lapDistance / TRACK.length, 0, 1);
    race.raceProgress = clamp((race.completedLaps + race.progress) / race.totalLaps, 0, 1);
  }
}
