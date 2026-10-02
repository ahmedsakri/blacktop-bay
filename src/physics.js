import { DEFAULT_VEHICLE_ID, VEHICLES } from './vehicles.js';
import { TRACK, TRACKS, getTrack, setTrack, projectOnTrack, sampleTrack } from './track.js';
import { RIVAL_GRID, rivalControls } from './rivals.js';
import { normalizeUpgrades } from './progression.js';
import { resolveRivalVehicles } from './opponent-fleet.js';
import { normalizeRaceOptions, getDifficulty } from './race-options.js';
import { createNitro, stepNitro, interruptNitro } from './nitro-system.js';
import { createTrackPickups, collectTrackPickups, refreshPickupAvailability } from './track-pickups.js';
import { createAirMotion, stepAirMotion, resetAirMotion } from './air-motion.js';
import { getTrackObstacles, obstacleBlocksPosition, resolveTrackObstacles } from './track-obstacles.js';
import { applyCarSetup, normalizeSetup } from './car-setups.js';
import { beginWreck, stepWreckMotion } from './wreck-motion.js';
import { vehicleDynamics, carContactShape, carRoadClearance, carSupportPoint, capsuleContact } from './vehicle-dynamics.js';
import { createObjectiveStats, trackObjectiveStats } from './race-objectives.js';

export { TRACK, TRACKS, getTrack, setTrack, projectOnTrack, sampleTrack };

// Garage labels and race tuning share one source of truth.
export const VEHICLE_SPECS = Object.freeze(Object.fromEntries(VEHICLES.map(vehicle => [vehicle.id, vehicle.handling])));

export function getUpgradeStats(vehicle = DEFAULT_VEHICLE_ID, upgrades = {}, setup = 'balanced') {
  const base = Object.hasOwn(VEHICLE_SPECS, vehicle) ? VEHICLE_SPECS[vehicle] : VEHICLE_SPECS[DEFAULT_VEHICLE_ID];
  const { engine, tyres, nitro, handling } = normalizeUpgrades(upgrades);
  const dynamics = vehicleDynamics(vehicle);
  return applyCarSetup({
    acceleration: base.acceleration * (1 + engine * 0.06),
    topSpeed: base.topSpeed * (1 + engine * 0.035 + tyres * 0.006 + handling * 0.004 + nitro * 0.004),
    handling: base.handling * (1 + handling * 0.025),
    nitroCapacity: base.nitroCapacity + nitro * 0.35,
    recharge: base.recharge * (1 + nitro * 0.075),
    grip: 9.5 * dynamics.grip * (1 + tyres * 0.075 + handling * 0.025),
    steeringResponse: 12 * dynamics.steeringResponse * (1 + handling * 0.09),
    yawResponse: 10 * dynamics.yawResponse * (1 + handling * 0.08),
    braking: 32 * dynamics.braking * (1 + tyres * 0.035),
    drag: 0.0078 * (1 - tyres * 0.012 - handling * 0.007),
    nitroAcceleration: 11 * (1 + nitro * 0.065),
    nitroSpeedMultiplier: 1.25 + nitro * 0.008,
  }, setup);
}

let raceSequence = 0;
const raceSession = globalThis.crypto?.randomUUID?.().replaceAll('-', '')
  || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
const nextRaceId = () => `race-${raceSession}-${++raceSequence}`;

const STEP = 1 / 120;
const CHECKPOINTS = 12;
const MAX_SPEED = 45;
const RECOVERY_COOLDOWN = 3;
const STUCK_DELAY = 2.4;
const WALL_STALL_DELAY = 2.8;
const OFF_TRACK_DELAY = .9;
const IMPACT_STABILITY_TIME = .65;
const roadProjections = new WeakMap();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const angleWrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const smoothRange = (value, min, max) => { const t = clamp((value - min) / (max - min), 0, 1); return t * t * (3 - 2 * t); };

function rememberRoad(racer, track, projection) {
  roadProjections.set(racer, {x: racer.car.x, y: racer.car.y, z: racer.car.z, track, projection});
  return projection;
}

function currentRoad(racer, track) {
  const previous = roadProjections.get(racer);
  // Consecutive fixed steps start at the exact position projected at the end of
  // the last step. External displacements, resets and collision corrections
  // invalidate this naturally; distant recovery still searches the whole loop.
  if (previous?.track === track && previous.x === racer.car.x && previous.y === racer.car.y && previous.z === racer.car.z) return previous.projection;
  return rememberRoad(racer, track, projectOnTrack(racer.car.x, racer.car.z, racer._trackIndex, track, racer.car.y));
}

const obstacleLayouts = new WeakMap();
function trackObstacles(track) {
  const cached = obstacleLayouts.get(track);
  if (cached?.source === track.obstacles) return cached.layout;
  const layout = getTrackObstacles(track);
  obstacleLayouts.set(track, {source: track.obstacles, layout});
  return layout;
}

function createRacer(vehicle, track, grid = null, upgrades = {}, setup = 'balanced') {
  const levels = normalizeUpgrades(upgrades), specs = getUpgradeStats(vehicle, levels, setup);
  const spawn = grid ? sampleTrack(grid.s, track) : sampleTrack(0, track);
  const lane = grid?.lane || 0;
  return {
    id: grid?.id || 'player', name: grid?.name || 'You', vehicle, track: track.id,
    upgrades: levels, specs, setup: normalizeSetup(setup),
    contactShape: vehicleDynamics(vehicle), personality: grid?.personality || 'balanced',
    objectiveStats: createObjectiveStats(),
    color: grid?.color || '#ee442f', finishTime: null, position: 1,
    car: { x: spawn.x + spawn.nx * lane, y: spawn.y || 0, z: spawn.z + spawn.nz * lane, pitch: Math.atan(spawn.grade || 0), roll: 0, yaw: Math.atan2(spawn.tx, spawn.tz), speed: 0, forwardSpeed: 0, lateralSpeed: 0, steering: 0, drifting: false, vx: 0, vz: 0, yawRate: 0, slipAngle: 0, nitroActive: false, braking: false },
    nitro: createNitro(specs.nitroCapacity), air: createAirMotion(),
    pickupEvent: {id: 0, kind: 'none'}, knockdownEvent: {id: 0, kind: 'none'},
    wreck: {id: 0, phase: 'none', remaining: 0, source: null, strength: 0},
    velocity: { x: 0, z: 0 },
    elapsed: 0, lapElapsed: 0, score: 0, driftPoints: 0, combo: 1,
    lap: 1, completedLaps: 0, totalLaps: 3, bestLap: null, lastLap: null,
    lapTimes: [], state: 'ready', collision: false, progress: 0, raceProgress: 0,
    recoveries: 0,
    impact: { id: 0, kind: 'none', source: null, strength: 0, remaining: 0, x: spawn.x, z: spawn.z, nx: 0, nz: 0 },
    recovery: { id: 0, phase: 'none', reason: null, remaining: 0, fromS: spawn.s, toS: spawn.s },
    _stuckTime: 0, _wallStallTime: 0, _wallCreepTime: 0, _wallStallOrigin: grid?.s || 0,
    _offTrackTime: 0, _recoveryCooldown: 0, _crashPenaltyTimer: 0, _impactStability: 0,
    _accumulator: 0, _collisionTimer: 0, _collisionCooldown: 0,
    _driftTime: 0, _straightTime: 0, _autoDrift: 0, _lastTrackS: spawn.s, _trackIndex: spawn.index,
    _lapDistance: grid?.s || 0, _nextCheckpoint: 1, _safeS: spawn.s,
    _lastProgressX: spawn.x + spawn.nx * lane, _lastProgressZ: spawn.z + spawn.nz * lane,
    _baseLane: lane, _lane: lane, _pace: grid?.pace || 1,
  };
}

export function createRace({ vehicle = DEFAULT_VEHICLE_ID, track: trackId, upgrades = {}, rivalVehicles, mode, difficulty, setup, campaignEventId = null } = {}) {
  if (!Object.hasOwn(VEHICLE_SPECS, vehicle)) vehicle = DEFAULT_VEHICLE_ID;
  const track = trackId === undefined ? TRACK : setTrack(trackId);
  const race = createRacer(vehicle, track, null, upgrades, setup);
  race.campaignEventId = typeof campaignEventId === 'string' ? campaignEventId : null;
  Object.assign(race, normalizeRaceOptions({mode, difficulty}));
  race.raceId = nextRaceId();
  race.rivalVehicles = resolveRivalVehicles(rivalVehicles);
  race.rivals = race.mode === 'time-attack' ? [] : RIVAL_GRID.map((grid, index) => createRacer(race.rivalVehicles[index], track,
    {...grid, pace: grid.pace * getDifficulty(race.difficulty).pace}));
  race.pickups = createTrackPickups(track.id);
  race.clock = 0; race.allFinished = false; race.leaderboard = [];
  updateStandings(race);
  return race;
}

export function startRace(race) {
  Object.assign(race, createRace({ vehicle: race.vehicle, track: race.track, upgrades: race.upgrades, rivalVehicles: race.rivalVehicles, mode: race.mode, difficulty: race.difficulty, setup: race.setup, campaignEventId: race.campaignEventId }));
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

export function resetCar(race, { reason = 'manual', retreat = 0, occupants = race.rivals || [] } = {}) {
  if (race.state === 'finished') return false;
  const track = getTrack(race.track), fromS = race._safeS;
  // An automatic recovery only gives up already validated distance. It never
  // jumps toward the next gate, adds a lap, or borrows the nearest other bend.
  let lostDistance = Math.min(Math.max(0, retreat), race._lapDistance, fromS);
  let location = sampleTrack(fromS - lostDistance, track), lane = 0;
  if (reason !== 'manual' || trackObstacles(track).some(obstacle => obstacleBlocksPosition(obstacle, location.x, location.y || 0, location.z, race.contactShape.length / 2, race.contactShape.height))) {
    let found = false;
    for (const back of [retreat, retreat + 6, retreat + 14, retreat + 24]) {
      const loss = Math.min(back, race._lapDistance, fromS), point = sampleTrack(fromS - loss, track);
      for (const offset of [0, -3, 3]) {
        const x = point.x + point.nx * offset, z = point.z + point.nz * offset;
        if (occupants.some(rival => rival !== race && rival.state === 'racing' && Math.hypot(rival.car.x - x, rival.car.z - z) < 6.2)) continue;
        if (trackObstacles(track).some(obstacle => obstacleBlocksPosition(obstacle, x, point.y || 0, z, race.contactShape.length / 2, race.contactShape.height))) continue;
        location = point; lane = offset; lostDistance = loss; found = true; break;
      }
      if (found) break;
    }
    // Wait for a gap instead of materializing inside an opponent at the grid.
    if (!found) return false;
  }
  Object.assign(race.car, {
    x: location.x + location.nx * lane, z: location.z + location.nz * lane, yaw: Math.atan2(location.tx, location.tz),
    speed: 0, forwardSpeed: 0, lateralSpeed: 0, vx: 0, vz: 0,
    steering: 0, yawRate: 0, slipAngle: 0, drifting: false, nitroActive: false, braking: false,
  });
  race.velocity.x = 0; race.velocity.z = 0;
  race._lastTrackS = location.s;
  race._trackIndex = location.index;
  race._lastProgressX = race.car.x; race._lastProgressZ = race.car.z;
  race._collisionTimer = 0; race._collisionCooldown = .6; race.collision = false;
  race._autoDrift = 0; race._stuckTime = 0; race._wallStallTime = 0; race._wallCreepTime = 0; race._offTrackTime = 0;
  race._crashPenaltyTimer = 0; race._impactStability = 0; race._recoveryCooldown = RECOVERY_COOLDOWN;
  race.impact.remaining = 0;
  race.recovery = { id: race.recovery.id + 1, phase: 'recovered', reason, remaining: 1.5, fromS, toS: location.s };
  if (lostDistance > 0) {
    race._lapDistance -= lostDistance;
    race._safeS = location.s;
    race._nextCheckpoint = Math.min(race._nextCheckpoint, Math.floor(location.s / (track.length / CHECKPOINTS)) + 1);
    race.progress = clamp(race._lapDistance / track.length, 0, 1);
    race.raceProgress = clamp((race.completedLaps + race.progress) / race.totalLaps, 0, 1);
  }
  race.recoveries++;
  interruptNitro(race.nitro);
  resetAirMotion(race, location);
  if (race.wreck.phase === 'impact' || race.wreck.phase === 'recovering') {
    race.wreck.phase = 'recovered'; race.wreck.remaining = 1.5;
    race.wreck.vy = race.wreck.rollRate = race.wreck.pitchRate = race.wreck.yawRate = 0;
    race.wreck.groundY = race.car.y; race.wreck.centerY = race.car.y + .6; race.wreck.grounded = true;
  }
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
    const previousPositions = field.map(racer => ({x: racer.car.x, z: racer.car.z}));
    // Choose all controls from the same frame before integrating any vehicle.
    const opponentInputs = race.rivals.map((rival) => rivalControls(rival, field, track, rival.specs, STEP));
    if (race.state === 'racing') simulate(race, controls, STEP, field);
    race.rivals.forEach((rival, i) => { if (rival.state === 'racing') simulate(rival, opponentInputs[i], STEP, field); });
    resolveCars(field, track);
    field.forEach((racer, index) => collectTrackPickups(race.pickups, racer, previousPositions[index], race.clock, track));
    refreshPickupAvailability(race.pickups, race, race.clock);
    updateStandings(race);
    trackObjectiveStats(race, track, STEP);
    race._accumulator -= STEP;
  }
  return race;
}

function classifyImpact(source, normalSpeed, speed, contact = {}) {
  const hard = Boolean(contact.knockdownBy) || normalSpeed >= 8 && speed >= 12;
  // Reserve a wreck for destructive closing energy. Ordinary late-braking
  // traffic contact remains a heavy hit with real speed/audio/body feedback.
  const severe = Boolean(contact.knockdownBy) || (!contact.protected && hard && normalSpeed >= (source === 'car' ? 36 : 28) && speed >= 30);
  return {hard, severe};
}

function impactCanEscalate(race, hard, severe) {
  // Cooldown deduplicates repeated contacts, not a new higher-severity hit.
  // Recovery protection and an existing wreck still prevent chain reactions.
  return hard && race.impact.kind !== 'crash'
    || severe && race.impact.severity !== 'wreck' && race.wreck.phase === 'none' && race._recoveryCooldown <= 0;
}

function registerImpact(race, source, normalSpeed, speed, contact) {
  const {hard, severe} = classifyImpact(source, normalSpeed, speed, contact);
  if ((race._collisionCooldown > 0 && !contact.knockdownBy && !impactCanEscalate(race, hard, severe)) || normalSpeed < .7) return;
  race._collisionTimer = hard ? .38 : .09;
  race._collisionCooldown = hard ? .55 : .18;
  if (hard || race.impact.remaining <= 0 || race.impact.kind !== 'crash') {
    race.impact = { id: race.impact.id + 1, kind: hard ? 'crash' : 'scrape', source,
      severity: severe ? 'wreck' : hard ? 'heavy' : 'light', speed: normalSpeed,
      cause: contact.knockdownBy ? 'nitro-knockdown' : 'collision', attackerId: contact.knockdownBy || null,
      strength: clamp(normalSpeed / 24, 0, 1), remaining: hard ? .8 : .18,
      x: contact.x, y: race.car.y, z: contact.z, nx: contact.nx, nz: contact.nz,
      localX: (contact.x - race.car.x) * Math.cos(race.car.yaw) - (contact.z - race.car.z) * Math.sin(race.car.yaw),
      localZ: (contact.x - race.car.x) * Math.sin(race.car.yaw) + (contact.z - race.car.z) * Math.cos(race.car.yaw),
      localNX: contact.nx * Math.cos(race.car.yaw) - contact.nz * Math.sin(race.car.yaw),
      localNZ: contact.nx * Math.sin(race.car.yaw) + contact.nz * Math.cos(race.car.yaw) };
  }
  if (hard) {
    race._crashPenaltyTimer = .32;
    race._impactStability = IMPACT_STABILITY_TIME;
    race._autoDrift = 0;
    race.car.yawRate *= .6;
    if (!contact.protected) { interruptNitro(race.nitro); race.car.nitroActive = false; }
    clearDrift(race);
    if (severe && race.wreck.phase === 'none' && race._recoveryCooldown <= 0) {
      beginWreck(race, {source, normalSpeed, contact});
    }
  }
}

function recoveryIntent(input) {
  return input.throttle > .3 && !input.brake && !input.handbrake;
}

function waitForRecovery(race, reason, elapsed, duration, occupants) {
  race.recovery.phase = 'waiting'; race.recovery.reason = reason;
  race.recovery.remaining = Math.max(0, duration - elapsed, race._recoveryCooldown);
  if (elapsed >= duration && race._recoveryCooldown <= 0) {
    return resetCar(race, { reason, retreat: 8, occupants });
  }
  return false;
}

function simulate(race, input, dt, occupants) {
  const car = race.car;
  const track = getTrack(race.track), specs = race.specs;
  race.elapsed += dt;
  race.lapElapsed += dt;
  race._collisionTimer = Math.max(0, race._collisionTimer - dt);
  race._collisionCooldown = Math.max(0, race._collisionCooldown - dt);
  race._crashPenaltyTimer = Math.max(0, race._crashPenaltyTimer - dt);
  race._impactStability = Math.max(0, race._impactStability - dt);
  race._recoveryCooldown = Math.max(0, race._recoveryCooldown - dt);
  race.impact.remaining = Math.max(0, race.impact.remaining - dt);
  if (race.wreck.phase === 'recovered') {
    race.wreck.remaining = Math.max(0, race.wreck.remaining - dt);
    if (!race.wreck.remaining) race.wreck.phase = 'none';
  }
  if (race.recovery.phase === 'recovered') {
    race.recovery.remaining = Math.max(0, race.recovery.remaining - dt);
    if (!race.recovery.remaining) race.recovery.phase = 'none';
  } else if (race.recovery.phase === 'waiting') {
    race.recovery.phase = 'none'; race.recovery.remaining = 0;
  }
  const initialRoad = currentRoad(race, track);
  if (race.wreck.phase === 'impact' || race.wreck.phase === 'recovering') {
    // Integrate actual height/orientation and road contact during loss of drive.
    // Only validated backward recovery may reposition the settled wreck.
    car.steering += (input.steer - car.steering) * (1 - Math.exp(-12 * dt));
    const ready = stepWreckMotion(race, initialRoad, dt);
    resolveTrackObstacles(race, trackObstacles(track));
    const road = projectOnTrack(car.x, car.z, race._trackIndex, track, car.y);
    const limit = track.width / 2 - carRoadClearance(race, road);
    if (road.distance > limit) {
      car.x = road.x + road.nx * Math.sign(road.signedDistance) * limit;
      car.z = road.z + road.nz * Math.sign(road.signedDistance) * limit;
      const outward = (car.vx * road.nx + car.vz * road.nz) * Math.sign(road.signedDistance);
      if (outward > 0) { car.vx -= road.nx * Math.sign(road.signedDistance) * outward; car.vz -= road.nz * Math.sign(road.signedDistance) * outward; }
    }
    refreshVelocity(race); car.nitroActive = false; race.collision = true;
    interruptNitro(race.nitro); clearDrift(race);
    if (ready || race.wreck.phase === 'recovering') {
      race.wreck.phase = 'recovering'; race.recovery.phase = 'waiting'; race.recovery.reason = 'wreck'; race.recovery.remaining = 0;
      resetCar(race, {reason: 'wreck', retreat: 8, occupants});
    }
    return;
  }
  if (initialRoad && initialRoad.distance > track.width / 2 + 8) {
    // A displaced car must not snap onto whichever distant road segment happens
    // to be nearest. Preserve its last valid gate while the driver can reset.
    car.vx *= Math.exp(-dt * 7); car.vz *= Math.exp(-dt * 7);
    car.nitroActive = false; race.nitro.active = false; race._autoDrift = 0;
    car.braking = input.brake; race.collision = race._collisionTimer > 0; race._wallStallTime = 0; race._wallCreepTime = 0; clearDrift(race); refreshVelocity(race);
    race._offTrackTime = recoveryIntent(input) ? race._offTrackTime + dt : 0;
    if (race._offTrackTime > 0) waitForRecovery(race, 'off-track', race._offTrackTime, OFF_TRACK_DELAY, occupants);
    return;
  }
  race._offTrackTime = 0;
  const releasingSteering = Math.abs(input.steer) < Math.abs(car.steering) * .5;
  const reversingSteering = input.steer * car.steering < -.025;
  // Full turn-in stays progressive, while lifting or countersteering unloads
  // the wheel more promptly. The old uniform damping kept turning after a tap.
  const response = specs.steeringResponse * (reversingSteering ? 1.3 : releasingSteering ? 1.35 : 1);
  car.steering += (input.steer - car.steering) * (1 - Math.exp(-response * dt));

  const speed = Math.hypot(car.vx, car.vz);
  let barrier = track.width / 2 - carRoadClearance(race, initialRoad);
  let steeringSpeed = speed;
  if (speed < 5 && recoveryIntent(input)) {
    const road = initialRoad || projectOnTrack(car.x, car.z, race._trackIndex, track);
    const facingWall = (Math.sin(car.yaw) * road.nx + Math.cos(car.yaw) * road.nz) * Math.sign(road.signedDistance);
    // Preserve the driver's steering authority while the wheels push into a
    // barrier after a head-on hit. Open-road stationary steering stays physical.
    if (road.distance > barrier - 0.6 && facingWall > 0.2) steeringSpeed = 5;
  }
  const turnRate = (1.5 - Math.min(speed, MAX_SPEED) * 0.013) * clamp(steeringSpeed / 5, 0, 1) * specs.handling;
  // Positive input means the driver's right: forward × up, or -local X.
  // A +Z-facing car therefore turns right by decreasing its Three.js yaw.
  const desiredYawRate = -car.steering * turnRate * (input.handbrake ? 1.18 : 1) * (race.air.phase === 'airborne' ? .38 : 1);
  car.yawRate += (desiredYawRate - car.yawRate) * (1 - Math.exp(-specs.yawResponse * dt));
  car.yaw = angleWrap(car.yaw + car.yawRate * dt);
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const rx = fz, rz = -fx;
  let forward = car.vx * fx + car.vz * fz;
  let lateral = car.vx * rx + car.vz * rz;
  const nitroTuning = stepNitro(race.nitro, input.nitro,
    input.throttle > 0 && !input.brake && !input.handbrake && speed > 2 && race._crashPenaltyTimer <= 0, dt);
  car.nitroActive = race.nitro.active;
  car.braking = input.brake;
  const impactDrive = .55 + .45 * smoothRange(.32 - race._crashPenaltyTimer, 0, .32);
  const recoveryDrive = race.recovery.phase === 'recovered'
    ? .7 + .3 * smoothRange(1.5 - race.recovery.remaining, 0, .45) : 1;
  const launchTraction = 1 - (1 - race.contactShape.traction) * (1 - smoothRange(speed, 4, 19)) * (1 + Math.abs(car.steering) * .35);
  const drive = input.brake ? 0 : input.throttle * specs.acceleration * launchTraction * (input.handbrake ? 0.45 : 1) * impactDrive * recoveryDrive + (race.nitro.active ? specs.nitroAcceleration * nitroTuning.acceleration : 0);
  const slopeResistance = race.air.phase === 'airborne' ? 0 : 9.81 * Math.sin(Math.atan(initialRoad?.grade || 0));
  const resistance = 0.65 + specs.drag * speed * speed + (input.brake ? specs.braking : 0) + (input.handbrake ? 4 : 0) + slopeResistance;
  forward = Math.max(0, forward + (drive - resistance) * dt);
  // Sustained fast steering progressively loosens the rear tyres. The heading
  // still follows ordinary steering: slip comes from planar velocity lagging
  // behind the body, without a spin impulse or a separate mobile drift button.
  const slideTarget = !input.brake && !input.handbrake && race._collisionTimer === 0 && race._impactStability <= 0 && race.air.phase !== 'airborne'
    ? smoothRange(speed, 18, 23) * smoothRange(Math.abs(car.steering), .26, .58) : 0;
  race._autoDrift += (slideTarget - race._autoDrift) * (1 - Math.exp(-dt * (slideTarget > race._autoDrift ? 4.5 : 9)));
  const slideGrip = 2.7 * (specs.grip / 9.5) ** .35;
  let grip = input.brake ? specs.grip : specs.grip + (slideGrip - specs.grip) * race._autoDrift;
  // A large slip angle restores some grip, keeping automatic slides catchable.
  const slipBeforeGrip = Math.abs(Math.atan2(lateral, Math.max(.01, forward)));
  grip += smoothRange(slipBeforeGrip, .34, .65) * 4;
  // Steering into the existing velocity catches a slide; it should not keep
  // feeding the original drift while the thumb has already changed direction.
  const countersteering = input.steer * car.yawRate > .035;
  if (countersteering && !input.handbrake) grip += 2.4 * smoothRange(slipBeforeGrip, .12, .28);
  // Traction settles smoothly after a heavy hit instead of immediately feeding
  // a new automatic slide. The driver retains the full steering range.
  grip += specs.grip * .6 * smoothRange(race._impactStability, 0, IMPACT_STABILITY_TIME);
  grip *= nitroTuning.grip * (input.brake ? 1 + race.contactShape.brakeBalance * smoothRange(speed, 5, 25) : 1);
  lateral *= Math.exp(-(input.handbrake ? 1.8 : grip) * dt);
  car.vx = fx * forward + rx * lateral;
  car.vz = fz * forward + rz * lateral;
  const newSpeed = Math.hypot(car.vx, car.vz);
  // After releasing boost, drag sheds the extra speed instead of snapping it away.
  const speedLimit = specs.topSpeed * (race.nitro.active ? specs.nitroSpeedMultiplier * nitroTuning.speed : 1);
  if (newSpeed > speedLimit && newSpeed > speed) {
    const allowed = Math.max(speedLimit, speed);
    car.vx *= allowed / newSpeed; car.vz *= allowed / newSpeed;
  }
  car.x += car.vx * dt;
  car.z += car.vz * dt;

  for (const contact of resolveTrackObstacles(race, trackObstacles(track))) {
    registerImpact(race, 'obstacle', contact.normalSpeed, contact.speed, contact);
  }

  let projection = projectOnTrack(car.x, car.z, race._trackIndex, track, car.y);
  barrier = track.width / 2 - carRoadClearance(race, projection);
  const outside = Math.abs(projection.signedDistance) - barrier;
  if (outside > 0) {
    const side = Math.sign(projection.signedDistance);
    car.x = projection.x + projection.nx * side * (barrier - 0.03);
    car.z = projection.z + projection.nz * side * (barrier - 0.03);
    const outward = (car.vx * projection.nx + car.vz * projection.nz) * side;
    if (outward > 0) {
      const rebound = Math.min(outward * .12, 1.6);
      car.vx -= projection.nx * side * (outward + rebound);
      car.vz -= projection.nz * side * (outward + rebound);
    }
    const {hard, severe} = classifyImpact('barrier', outward, speed);
    if (outward > .7 && (race._collisionCooldown <= 0 || impactCanEscalate(race, hard, severe))) {
      // Resolve the wall-normal velocity physically, then apply a small loss to
      // hard impacts only. A glancing scrape should not erase a third of speed.
      const retained = hard ? .82 : .995;
      car.vx *= retained; car.vz *= retained;
      registerImpact(race, 'barrier', outward, speed, {
        ...carSupportPoint(race, projection.nx * side, projection.nz * side),
        nx: -projection.nx * side, nz: -projection.nz * side,
      });
    }
    projection = projectOnTrack(car.x, car.z, projection.index, track, car.y);
  }
  if (race.wreck.phase !== 'impact') stepAirMotion(race, projection, track, dt);
  race.collision = race._collisionTimer > 0;
  car.speed = Math.hypot(car.vx, car.vz);
  car.forwardSpeed = car.vx * fx + car.vz * fz;
  car.lateralSpeed = car.vx * rx + car.vz * rz;
  car.slipAngle = Math.atan2(car.lateralSpeed, Math.max(0.01, car.forwardSpeed));
  race.velocity.x = car.vx; race.velocity.z = car.vz;

  updateProgress(race, projection, dt);
  rememberRoad(race, track, projection);
  if (race.state === 'finished') return;
  {
    const facingWall = (Math.sin(car.yaw) * projection.nx + Math.cos(car.yaw) * projection.nz) * Math.sign(projection.signedDistance);
    const trapped = car.speed < 1.6 && projection.distance > barrier - .45 && facingWall > .35;
    race._stuckTime = trapped && recoveryIntent(input) ? race._stuckTime + dt : 0;
    if (race._stuckTime > 0 && waitForRecovery(race, 'stuck', race._stuckTime, STUCK_DELAY, occupants)) return;
    const pushingWall = projection.distance > barrier - .6 && facingWall > .2 && recoveryIntent(input);
    const validatedDistance = race.completedLaps * track.length + race._lapDistance;
    // A car can still be trapped while advancing a few metres along the rail.
    // Sustained walking-speed pressure has its own timer: tiny progress cannot
    // erase it. Open-road crawling, a short scrape, braking, handbraking and a
    // driver who turns away never accumulate this recovery condition.
    const creepingWall = pushingWall && car.speed < (race._wallCreepTime > 0 ? 5.5 : 4.5)
      && race.air.phase !== 'airborne';
    race._wallCreepTime = creepingWall ? race._wallCreepTime + dt : 0;
    if (race._wallCreepTime > 1.1 && race._stuckTime === 0
        && waitForRecovery(race, 'stuck', race._wallCreepTime, WALL_STALL_DELAY, occupants)) return;
    if (pushingWall) {
      if (race._wallStallTime === 0) race._wallStallOrigin = validatedDistance;
      race._wallStallTime += dt;
      // Wheel speed alone cannot detect a sideways car creeping against a
      // barrier. Require real, checkpoint-validated forward distance instead.
      // A slow corner that advances 1.8 m within this window starts fresh.
      if (validatedDistance - race._wallStallOrigin > 1.8) {
        race._wallStallTime = 0;
        race._wallStallOrigin = validatedDistance;
      } else if (race._wallStallTime > 1.1 && race._stuckTime === 0
          && waitForRecovery(race, 'stuck', Math.max(race._wallStallTime, race._wallCreepTime), WALL_STALL_DELAY, occupants)) return;
    } else {
      race._wallStallTime = 0;
      race._wallStallOrigin = validatedDistance;
    }
  }

  const slip = Math.abs(car.slipAngle);
  car.drifting = race.air.phase !== 'airborne' && !race.collision && race._impactStability <= 0 && car.speed > 10 && car.forwardSpeed > car.speed * 0.55
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
  const worldTravel = Math.hypot(race.car.x - race._lastProgressX, race.car.z - race._lastProgressZ);
  const indexDistance = Math.abs(projection.index - race._trackIndex);
  const adjacent = Math.min(indexDistance, track.samples.length - indexDistance) <= 1;
  // On the inside of a tight corner, the nearest polyline segment can change
  // while the car travels only centimetres. Permit one adjacent sample's arc
  // jump only when the actual world movement is plausible. An arbitrary road
  // teleport cannot borrow this allowance to skip a checkpoint.
  const projectionJump = worldTravel <= plausible && adjacent
    && Math.abs(delta) <= plausible + track.length / track.samples.length;
  const onRoad = Math.abs(projection.signedDistance) <= track.width / 2;
  if ((Math.abs(delta) <= plausible || projectionJump) && onRoad) {
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
  race._lastProgressX = race.car.x; race._lastProgressZ = race.car.z;
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

function canNitroKnockdown(attacker, victim, front, nx, nz, closing) {
  if (front < 0 || !attacker.nitro.active || attacker.wreck.phase !== 'none'
      || victim.wreck.phase !== 'none' || victim._recoveryCooldown > 0) return false;
  const mode = attacker.nitro.mode;
  if (!(mode === 'burst' && attacker.car.speed >= 26 && closing >= 8)
      && !(mode === 'perfect' && attacker.car.speed >= 32 && closing >= 14)) return false;
  // A real front-body strike is required. Passing alongside, a gentle tap or
  // contact at another bridge height never receives a scripted knockdown.
  const toward = Math.sin(attacker.car.yaw) * nx + Math.cos(attacker.car.yaw) * nz;
  const aligned = Math.cos(attacker.car.yaw - victim.car.yaw);
  return toward > .45 && aligned > .15;
}

function resolveCars(field, track) {
  // Body-scaled continuous capsules and bounded arcade mass share one contact
  // between each pair; no empty middle or duplicate nose/tail impulse.
  for (let i = 0; i < field.length; i++) for (let j = i + 1; j < field.length; j++) {
    const a = field[i], b = field[j];
    if (a.state !== 'racing' || b.state !== 'racing' || a.wreck.phase === 'recovering' || b.wreck.phase === 'recovering'
        || Math.abs(a.car.y - b.car.y) > Math.max(carContactShape(a).height, carContactShape(b).height) || Math.hypot(a.car.x - b.car.x, a.car.z - b.car.z) > (carContactShape(a).length + carContactShape(b).length) / 2) continue;
    const contact = capsuleContact(a, b);
    if (contact) {
      const {overlap, nx, nz, frontA, frontB} = contact;
      const inverseA = 1 / carContactShape(a).mass, inverseB = 1 / carContactShape(b).mass;
      const shareA = inverseA / (inverseA + inverseB), shareB = 1 - shareA;
      a.car.x -= nx * overlap * shareA; a.car.z -= nz * overlap * shareA;
      b.car.x += nx * overlap * shareB; b.car.z += nz * overlap * shareB;
      const closing = (a.car.vx - b.car.vx) * nx + (a.car.vz - b.car.vz) * nz;
      const impactSpeed = Math.max(a.car.speed, b.car.speed);
      const attacker = canNitroKnockdown(a, b, frontA, nx, nz, closing) ? a
        : canNitroKnockdown(b, a, frontB, -nx, -nz, closing) ? b : null;
      const victim = attacker === a ? b : attacker === b ? a : null;
      if (closing > 0) {
        // Modest mass-weighted momentum transfer with a bounded opening speed. A very
        // fast closing car must not slingshot both bodies across the circuit.
        const impulse = closing + Math.min(closing * .14, 1.8);
        a.car.vx -= nx * impulse * shareA; a.car.vz -= nz * impulse * shareA;
        b.car.vx += nx * impulse * shareB; b.car.vz += nz * impulse * shareB;
      }
      const contactX = contact.x, contactZ = contact.z;
      for (const racer of [a, b]) {
        const direction = racer === a ? -1 : 1;
        if (closing > .8) registerImpact(racer, 'car', closing, impactSpeed, {x: contactX, z: contactZ, nx: nx * direction, nz: nz * direction,
          knockdownBy: racer === victim ? attacker.id : null, protected: racer === attacker});
        racer.collision = racer._collisionTimer > 0;
        const road = projectOnTrack(racer.car.x, racer.car.z, racer._trackIndex, track, racer.car.y);
        const limit = track.width / 2 - carRoadClearance(racer, road);
        if (road.distance > limit) {
          const side = Math.sign(road.signedDistance);
          racer.car.x = road.x + road.nx * side * limit;
          racer.car.z = road.z + road.nz * side * limit;
        }
        refreshVelocity(racer);
      }
      if (attacker && victim.wreck.phase === 'impact' && victim.wreck.attackerId === attacker.id) {
        attacker.knockdownEvent = {id: attacker.knockdownEvent.id + 1, kind: 'knockdown',
          victimId: victim.id, mode: attacker.nitro.mode, x: contactX, y: victim.car.y, z: contactZ};
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
