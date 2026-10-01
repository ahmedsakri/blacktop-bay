import { VEHICLES } from './vehicles.js';
import { TRACK, TRACKS, getTrack, setTrack, projectOnTrack, sampleTrack } from './track.js';
import { RIVAL_GRID, rivalControls } from './rivals.js';
import { normalizeUpgrades } from './progression.js';

export { TRACK, TRACKS, getTrack, setTrack, projectOnTrack, sampleTrack };

// Garage labels and race tuning share one source of truth.
export const VEHICLE_SPECS = Object.freeze(Object.fromEntries(VEHICLES.map(vehicle => [vehicle.id, vehicle.handling])));

export function getUpgradeStats(vehicle = 'coupe', upgrades = {}) {
  const base = Object.hasOwn(VEHICLE_SPECS, vehicle) ? VEHICLE_SPECS[vehicle] : VEHICLE_SPECS.coupe;
  const { engine, tyres, nitro, handling } = normalizeUpgrades(upgrades);
  return {
    acceleration: base.acceleration * (1 + engine * 0.06),
    topSpeed: base.topSpeed * (1 + engine * 0.035 + tyres * 0.006 + handling * 0.004 + nitro * 0.004),
    handling: base.handling * (1 + handling * 0.025),
    nitroCapacity: base.nitroCapacity + nitro * 0.35,
    recharge: base.recharge * (1 + nitro * 0.075),
    grip: 9.5 * (1 + tyres * 0.075 + handling * 0.025),
    steeringResponse: 12 * (1 + handling * 0.09),
    yawResponse: 10 * (1 + handling * 0.08),
    braking: 32 * (1 + tyres * 0.035),
    drag: 0.0078 * (1 - tyres * 0.012 - handling * 0.007),
    nitroAcceleration: 11 * (1 + nitro * 0.065),
    nitroSpeedMultiplier: 1.25 + nitro * 0.008,
  };
}

let raceSequence = 0;
const raceSession = globalThis.crypto?.randomUUID?.().replaceAll('-', '')
  || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
const nextRaceId = () => `race-${raceSession}-${++raceSequence}`;

const STEP = 1 / 120;
const CHECKPOINTS = 12;
const CAR_RADIUS = 0.95;
const MAX_SPEED = 45;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const angleWrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const smoothRange = (value, min, max) => { const t = clamp((value - min) / (max - min), 0, 1); return t * t * (3 - 2 * t); };

function createRacer(vehicle, track, grid = null, upgrades = {}) {
  const levels = normalizeUpgrades(upgrades), specs = getUpgradeStats(vehicle, levels);
  const spawn = grid ? sampleTrack(grid.s, track) : sampleTrack(0, track);
  const lane = grid?.lane || 0;
  return {
    id: grid?.id || 'player', name: grid?.name || 'You', vehicle, track: track.id,
    upgrades: levels, specs,
    color: grid?.color || '#ee442f', finishTime: null, position: 1,
    car: { x: spawn.x + spawn.nx * lane, z: spawn.z + spawn.nz * lane, yaw: Math.atan2(spawn.tx, spawn.tz), speed: 0, forwardSpeed: 0, lateralSpeed: 0, steering: 0, drifting: false, vx: 0, vz: 0, yawRate: 0, slipAngle: 0, nitroActive: false, braking: false },
    nitro: { charge: specs.nitroCapacity, capacity: specs.nitroCapacity, active: false, locked: false },
    velocity: { x: 0, z: 0 },
    elapsed: 0, lapElapsed: 0, score: 0, driftPoints: 0, combo: 1,
    lap: 1, completedLaps: 0, totalLaps: 3, bestLap: null, lastLap: null,
    lapTimes: [], state: 'ready', collision: false, progress: 0, raceProgress: 0,
    recoveries: 0,
    _accumulator: 0, _collisionTimer: 0, _collisionCooldown: 0,
    _driftTime: 0, _straightTime: 0, _autoDrift: 0, _lastTrackS: spawn.s, _trackIndex: spawn.index,
    _lapDistance: grid?.s || 0, _nextCheckpoint: 1, _safeS: spawn.s,
    _baseLane: lane, _lane: lane, _pace: grid?.pace || 1,
  };
}

export function createRace({ vehicle = 'coupe', track: trackId, upgrades = {} } = {}) {
  if (!Object.hasOwn(VEHICLE_SPECS, vehicle)) vehicle = 'coupe';
  const track = trackId === undefined ? TRACK : setTrack(trackId);
  const race = createRacer(vehicle, track, null, upgrades);
  race.raceId = nextRaceId();
  race.rivals = RIVAL_GRID.map((grid) => createRacer(grid.vehicle, track, grid));
  race.clock = 0; race.allFinished = false; race.leaderboard = [];
  updateStandings(race);
  return race;
}

export function startRace(race) {
  Object.assign(race, createRace({ vehicle: race.vehicle, track: race.track, upgrades: race.upgrades }));
  race.state = 'racing';
  for (const rival of race.rivals) rival.state = 'racing';
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
  const location = sampleTrack(race._safeS, getTrack(race.track));
  Object.assign(race.car, {
    x: location.x, z: location.z, yaw: Math.atan2(location.tx, location.tz),
    speed: 0, forwardSpeed: 0, lateralSpeed: 0, vx: 0, vz: 0,
    steering: 0, yawRate: 0, slipAngle: 0, drifting: false, nitroActive: false,
  });
  race.velocity.x = 0; race.velocity.z = 0;
  race._lastTrackS = location.s;
  race._trackIndex = location.index;
  race._collisionTimer = 0; race._collisionCooldown = 0; race.collision = false;
  race._autoDrift = 0;
  race.recoveries++;
  race.nitro.active = false;
  clearDrift(race);
  return true;
}

export function stepRace(race, input = {}, dt = STEP) {
  if ((race.state !== 'racing' && race.state !== 'finished') || race.allFinished || !Number.isFinite(dt) || dt <= 0) return race;
  race._accumulator += Math.min(dt, 0.1);
  const controls = {
    steer: clamp(finite(input.steer), -1, 1),
    throttle: clamp(finite(input.throttle), 0, 1),
    brake: Boolean(input.brake), handbrake: Boolean(input.handbrake),
    nitro: Boolean(input.nitro),
  };
  const track = getTrack(race.track);
  while (race._accumulator + 1e-10 >= STEP && !race.allFinished) {
    race.clock += STEP;
    const field = [race, ...race.rivals];
    // Choose all controls from the same frame before integrating any vehicle.
    const opponentInputs = race.rivals.map((rival) => rivalControls(rival, field, track, rival.specs, STEP));
    if (race.state === 'racing') simulate(race, controls, STEP);
    race.rivals.forEach((rival, i) => { if (rival.state === 'racing') simulate(rival, opponentInputs[i], STEP); });
    resolveCars(field, track);
    updateStandings(race);
    race._accumulator -= STEP;
  }
  return race;
}

function simulate(race, input, dt) {
  const car = race.car;
  const track = getTrack(race.track), specs = race.specs;
  race.elapsed += dt;
  race.lapElapsed += dt;
  race._collisionTimer = Math.max(0, race._collisionTimer - dt);
  race._collisionCooldown = Math.max(0, race._collisionCooldown - dt);
  car.steering += (input.steer - car.steering) * (1 - Math.exp(-specs.steeringResponse * dt));

  const speed = Math.hypot(car.vx, car.vz);
  const barrier = track.width / 2 - CAR_RADIUS;
  let steeringSpeed = speed;
  if (speed < 3 && input.throttle > 0 && !input.brake) {
    const road = projectOnTrack(car.x, car.z, race._trackIndex, track);
    const facingWall = (Math.sin(car.yaw) * road.nx + Math.cos(car.yaw) * road.nz) * Math.sign(road.signedDistance);
    // Preserve the driver's steering authority while the wheels push into a
    // barrier after a head-on hit. Open-road stationary steering stays physical.
    if (road.distance > barrier - 0.2 && facingWall > 0.2) steeringSpeed = 3;
  }
  const turnRate = (1.5 - Math.min(speed, MAX_SPEED) * 0.013) * clamp(steeringSpeed / 5, 0, 1) * specs.handling;
  // Positive input means the driver's right: forward × up, or -local X.
  // A +Z-facing car therefore turns right by decreasing its Three.js yaw.
  const desiredYawRate = -car.steering * turnRate * (input.handbrake ? 1.18 : 1);
  car.yawRate += (desiredYawRate - car.yawRate) * (1 - Math.exp(-specs.yawResponse * dt));
  car.yaw = angleWrap(car.yaw + car.yawRate * dt);
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const rx = fz, rz = -fx;
  let forward = car.vx * fx + car.vz * fz;
  let lateral = car.vx * rx + car.vz * rz;
  if (!input.nitro) race.nitro.locked = false;
  race.nitro.active = input.nitro && !race.nitro.locked && race.nitro.charge >= dt
    && input.throttle > 0 && !input.brake && !input.handbrake && speed > 2;
  if (race.nitro.active) race.nitro.charge = Math.max(0, race.nitro.charge - dt);
  if (input.nitro && race.nitro.charge < dt) { race.nitro.locked = true; race.nitro.active = false; }
  car.nitroActive = race.nitro.active;
  car.braking = input.brake;
  const drive = input.brake ? 0 : input.throttle * specs.acceleration * (input.handbrake ? 0.45 : 1) + (race.nitro.active ? specs.nitroAcceleration : 0);
  const resistance = 0.65 + specs.drag * speed * speed + (input.brake ? specs.braking : 0) + (input.handbrake ? 4 : 0);
  forward = Math.max(0, forward + (drive - resistance) * dt);
  // Sustained fast steering progressively loosens the rear tyres. The heading
  // still follows ordinary steering: slip comes from planar velocity lagging
  // behind the body, without a spin impulse or a separate mobile drift button.
  const slideTarget = !input.brake && !input.handbrake && race._collisionTimer === 0
    ? smoothRange(speed, 18, 23) * smoothRange(Math.abs(car.steering), .26, .58) : 0;
  race._autoDrift += (slideTarget - race._autoDrift) * (1 - Math.exp(-dt * (slideTarget > race._autoDrift ? 4.5 : 9)));
  const slideGrip = 2.7 * (specs.grip / 9.5) ** .35;
  let grip = input.brake ? specs.grip : specs.grip + (slideGrip - specs.grip) * race._autoDrift;
  // A large slip angle restores some grip, keeping automatic slides catchable.
  const slipBeforeGrip = Math.abs(Math.atan2(lateral, Math.max(.01, forward)));
  grip += smoothRange(slipBeforeGrip, .34, .65) * 4;
  lateral *= Math.exp(-(input.handbrake ? 1.8 : grip) * dt);
  car.vx = fx * forward + rx * lateral;
  car.vz = fz * forward + rz * lateral;
  const newSpeed = Math.hypot(car.vx, car.vz);
  // After releasing boost, drag sheds the extra speed instead of snapping it away.
  const speedLimit = specs.topSpeed * (race.nitro.active ? specs.nitroSpeedMultiplier : 1);
  if (newSpeed > speedLimit && newSpeed > speed) {
    const allowed = Math.max(speedLimit, speed);
    car.vx *= allowed / newSpeed; car.vz *= allowed / newSpeed;
  }
  car.x += car.vx * dt;
  car.z += car.vz * dt;

  let projection = projectOnTrack(car.x, car.z, race._trackIndex, track);
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
    projection = projectOnTrack(car.x, car.z, projection.index, track);
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
  // Holding an empty trigger cannot convert recharge into perpetual micro-boosts.
  if (!input.nitro && !race.collision && car.speed > 8 && car.forwardSpeed > car.speed * 0.6) {
    race.nitro.charge = Math.min(race.nitro.capacity, race.nitro.charge + specs.recharge * (car.drifting ? 2.5 : 1) * dt);
  }
}

function updateProgress(race, projection, dt) {
  const track = getTrack(race.track);
  const previous = race._lastTrackS;
  let delta = projection.s - previous;
  if (delta > track.length / 2) delta -= track.length;
  if (delta < -track.length / 2) delta += track.length;
  const plausible = Math.max(1.5, race.car.speed * dt * 2.6 + 0.3);
  const onRoad = Math.abs(projection.signedDistance) <= track.width / 2;
  if (Math.abs(delta) <= plausible && onRoad) {
    race._lapDistance = Math.max(0, race._lapDistance + delta);
    race._safeS = projection.s;
    if (delta > 0) {
      const checkpoint = race._nextCheckpoint * track.length / CHECKPOINTS;
      if (race._nextCheckpoint < CHECKPOINTS && previous < checkpoint && projection.s >= checkpoint) race._nextCheckpoint++;
      const crossedFinish = previous > track.length * 0.9 && projection.s < track.length * 0.1;
      if (crossedFinish && race._nextCheckpoint === CHECKPOINTS && race._lapDistance >= track.length * 0.98) {
        race.lastLap = race.lapElapsed;
        race.lapTimes.push(race.lastLap);
        race.bestLap = race.bestLap === null ? race.lastLap : Math.min(race.bestLap, race.lastLap);
        race.lapElapsed = 0;
        race.completedLaps++;
        race.lap = Math.min(race.totalLaps, race.completedLaps + 1);
        race._lapDistance = Math.max(0, race._lapDistance - track.length);
        race._nextCheckpoint = 1;
        if (race.completedLaps >= race.totalLaps) {
          bankDrift(race);
          race.state = 'finished';
          race.finishTime = race.elapsed;
          race.nitro.active = false; race.car.nitroActive = false;
          race.progress = 1; race.raceProgress = 1;
        }
      }
    }
  }
  race._lastTrackS = projection.s;
  race._trackIndex = projection.index;
  if (race.state !== 'finished') {
    race.progress = clamp(race._lapDistance / track.length, 0, 1);
    race.raceProgress = clamp((race.completedLaps + race.progress) / race.totalLaps, 0, 1);
  }
}

function refreshVelocity(racer) {
  const car = racer.car, fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  car.speed = Math.hypot(car.vx, car.vz);
  car.forwardSpeed = car.vx * fx + car.vz * fz;
  car.lateralSpeed = car.vx * fz - car.vz * fx;
  car.slipAngle = Math.atan2(car.lateralSpeed, Math.max(0.01, car.forwardSpeed));
  racer.velocity.x = car.vx; racer.velocity.z = car.vz;
}

function resolveCars(field, track) {
  // Two circles per body approximate a 4.3 m coupe, including nose-to-tail hits.
  for (let i = 0; i < field.length; i++) for (let j = i + 1; j < field.length; j++) {
    const a = field[i], b = field[j];
    if (a.state !== 'racing' || b.state !== 'racing' || Math.hypot(a.car.x - b.car.x, a.car.z - b.car.z) > 5) continue;
    for (const frontA of [-1.15, 1.15]) for (const frontB of [-1.15, 1.15]) {
      const dx = b.car.x + Math.sin(b.car.yaw) * frontB - a.car.x - Math.sin(a.car.yaw) * frontA;
      const dz = b.car.z + Math.cos(b.car.yaw) * frontB - a.car.z - Math.cos(a.car.yaw) * frontA;
      const distance = Math.hypot(dx, dz), overlap = CAR_RADIUS * 2 - distance;
      if (overlap <= 0) continue;
      const nx = distance > 1e-6 ? dx / distance : Math.cos(a.car.yaw);
      const nz = distance > 1e-6 ? dz / distance : -Math.sin(a.car.yaw);
      a.car.x -= nx * overlap * 0.5; a.car.z -= nz * overlap * 0.5;
      b.car.x += nx * overlap * 0.5; b.car.z += nz * overlap * 0.5;
      const closing = (a.car.vx - b.car.vx) * nx + (a.car.vz - b.car.vz) * nz;
      if (closing > 0) {
        const impulse = closing * 0.57;
        a.car.vx -= nx * impulse; a.car.vz -= nz * impulse;
        b.car.vx += nx * impulse; b.car.vz += nz * impulse;
      }
      for (const racer of [a, b]) {
        if (closing > 0.8 || overlap > 0.12) {
          racer._collisionTimer = 0.24; racer.collision = true; clearDrift(racer);
        }
        const road = projectOnTrack(racer.car.x, racer.car.z, racer._trackIndex, track);
        const limit = track.width / 2 - CAR_RADIUS;
        if (road.distance > limit) {
          const side = Math.sign(road.signedDistance);
          racer.car.x = road.x + road.nx * side * limit;
          racer.car.z = road.z + road.nz * side * limit;
        }
        refreshVelocity(racer);
      }
    }
  }
}

function updateStandings(race) {
  const length = getTrack(race.track).length;
  const distance = (racer) => racer.completedLaps * length + racer._lapDistance;
  const field = [race, ...race.rivals].sort((a, b) => {
    if (a.finishTime !== null || b.finishTime !== null) {
      if (a.finishTime === null) return 1;
      if (b.finishTime === null) return -1;
      return a.finishTime - b.finishTime || a.id.localeCompare(b.id);
    }
    return distance(b) - distance(a) || a.id.localeCompare(b.id);
  });
  const lead = distance(field[0]);
  race.leaderboard = field.map((racer, index) => {
    racer.position = index + 1;
    return { id: racer.id, name: racer.name, vehicle: racer.vehicle, color: racer.color,
      position: index + 1, isPlayer: racer === race, finished: racer.state === 'finished',
      finishTime: racer.finishTime, completedLaps: racer.completedLaps,
      progress: racer.progress, gap: Math.max(0, lead - distance(racer)),
    };
  });
  race.allFinished = field.every((racer) => racer.state === 'finished');
}
