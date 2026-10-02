// A bounded arcade rigid-body approximation. Angular velocity and centre of
// mass height are integrated at the race's fixed step; renderer time never
// drives a wreck. The oriented box support keeps a roof/side contact above the
// road while dissipating energy. Full soft-body contact is deliberately absent.
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : a));
const wrap = n => Math.atan2(Math.sin(n), Math.cos(n));
const HEIGHT = .60, HALF_WIDTH = .98, HALF_LENGTH = 2.15;
export const WRECK_MAX_TIME = 2.8;
export const wreckActive = racer => racer?.wreck?.phase === 'impact' || racer?.wreck?.phase === 'recovering';

export function wreckSupport(pitch, roll) {
  const up = Math.cos(pitch) * Math.cos(roll);
  return {up, radius: HALF_WIDTH * Math.abs(Math.cos(pitch) * Math.sin(roll))
    + HEIGHT * Math.abs(up) + HALF_LENGTH * Math.abs(Math.sin(pitch))};
}

export function beginWreck(racer, {source, normalSpeed, contact}) {
  const car = racer.car, strength = clamp(normalSpeed / 36, .45, 1);
  const sideways = contact.nx * Math.cos(car.yaw) - contact.nz * Math.sin(car.yaw);
  const longitudinal = contact.nx * Math.sin(car.yaw) + contact.nz * Math.cos(car.yaw);
  const leverX = clamp((contact.x - car.x) * Math.cos(car.yaw) - (contact.z - car.z) * Math.sin(car.yaw), -1.8, 1.8);
  const leverZ = clamp((contact.x - car.x) * Math.sin(car.yaw) + (contact.z - car.z) * Math.cos(car.yaw), -2.2, 2.2);
  const support = wreckSupport(car.pitch || 0, car.roll || 0);
  racer.wreck = {id: racer.wreck.id + 1, phase: 'impact', remaining: WRECK_MAX_TIME,
    source, cause: contact.knockdownBy ? 'nitro-knockdown' : 'collision', attackerId: contact.knockdownBy || null,
    strength, elapsed: 0, rest: 0, heading: car.yaw, groundY: car.y, roadPitch: car.pitch || 0,
    centerY: car.y + HEIGHT * support.up, vy: 2.8 + strength * 2.1,
    rollRate: -sideways * (5 + strength * 4), pitchRate: longitudinal * (2.4 + strength * 2.3),
    yawRate: clamp((leverZ * sideways - leverX * longitudinal) * strength * 1.1, -2.5, 2.5),
    contacts: 0, overturned: false};
  // A crash ends a ramp stunt. A tumbling wreck cannot land a stunt or collect
  // its Nitro reward during automatic recovery.
  racer.air.phase = 'grounded'; racer.air.vy = 0; racer.air.stunt = 'none'; racer.air.rampId = null;
}

export function stepWreckMotion(racer, road, dt) {
  const car = racer.car, wreck = racer.wreck;
  if (!wreckActive(racer) || !(dt > 0)) return false;
  const ground = Number.isFinite(road.y) ? road.y : 0;
  wreck.groundY = ground; wreck.roadPitch = Math.atan(road.grade || 0);
  wreck.elapsed += dt; wreck.remaining = Math.max(0, WRECK_MAX_TIME - wreck.elapsed);
  car.roll = wrap(car.roll + wreck.rollRate * dt);
  car.pitch = wrap(car.pitch + wreck.pitchRate * dt);
  car.yaw = wrap(car.yaw + wreck.yawRate * dt);
  const support = wreckSupport(car.pitch, car.roll);
  wreck.overturned ||= support.up < -.25;
  wreck.centerY += wreck.vy * dt - 9 * dt * dt; wreck.vy -= 18 * dt;
  const grounded = wreck.centerY <= ground + support.radius + (Math.abs(wreck.vy) < .9 ? .025 : 0);
  if (grounded) {
    wreck.centerY = ground + support.radius;
    if (!wreck.grounded) wreck.contacts++;
    if (wreck.vy < -1.2) wreck.vy *= -.16;
    else if (wreck.vy < 0) wreck.vy = 0;
    // Ground friction damps each angular component; a small gravity torque
    // settles the box toward whichever roof, side or axle face is supporting it.
    wreck.rollRate -= Math.sin(4 * car.roll) * dt * 3.2;
    wreck.pitchRate -= Math.sin(2 * car.pitch) * dt * 3.2;
  }
  wreck.grounded = grounded;
  const angularDamping = Math.exp(-(grounded ? 3.4 : .22) * dt);
  wreck.rollRate *= angularDamping; wreck.pitchRate *= angularDamping;
  wreck.yawRate *= Math.exp(-(grounded ? 4 : .5) * dt);
  car.y = wreck.centerY - HEIGHT * support.up;
  car.yawRate = wreck.yawRate;
  const slideDamping = Math.exp(-(grounded ? 5 : 1.3) * dt);
  car.vx *= slideDamping; car.vz *= slideDamping;
  car.x += car.vx * dt; car.z += car.vz * dt;
  const resting = grounded && Math.abs(wreck.vy) < .5 && Math.hypot(wreck.rollRate, wreck.pitchRate, wreck.yawRate) < .65;
  wreck.rest = resting ? wreck.rest + dt : 0;
  return wreck.remaining === 0 || wreck.elapsed >= 1.65 && wreck.rest >= .22;
}
