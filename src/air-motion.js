// Gravity and ramp tuning are original metre/second arcade values. Grounded
// driving remains unchanged on circuits without authored ramps/elevations.
const GRAVITY = 15;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export function createAirMotion() {
  return {phase: 'grounded', vy: 0, elapsed: 0, duration: 0, roll: 0, rampId: null,
    stunt: 'none', completedStunts: 0, event: {id: 0, kind: 'none'}, _rampFraction: 0, _launchY: 0, _lastS: null};
}

export function resetAirMotion(racer, road) {
  const event = racer.air.event, completedStunts = racer.air.completedStunts;
  racer.air = {...createAirMotion(), event, completedStunts};
  racer.car.y = Number.isFinite(road.y) ? road.y : 0;
  racer.car.pitch = Math.atan(road.grade || 0); racer.car.roll = 0;
}

export function stepAirMotion(racer, road, track, dt) {
  const car = racer.car, air = racer.air, ground = Number.isFinite(road.y) ? road.y : 0;
  if (air.phase === 'airborne') {
    air.elapsed += dt;
    car.y += air.vy * dt - .5 * GRAVITY * dt * dt;
    air.vy -= GRAVITY * dt;
    car.pitch = clamp(Math.atan2(air.vy, Math.max(8, car.speed)), -.45, .45);
    if (air.stunt === 'barrel') {
      air.roll = Math.min(1, air.elapsed / Math.max(.4, air.duration * .88));
      car.roll = air.roll * Math.PI * 2;
    }
    if (car.y <= ground && air.vy < 0) {
      const landingSpeed = -air.vy;
      const completed = air.stunt === 'barrel' && air.roll >= .98 && air.elapsed >= .4;
      car.y = ground; car.pitch = Math.atan(road.grade || 0); car.roll = 0;
      air.phase = 'grounded'; air.vy = 0; air.rampId = null;
      air.completedStunts += Number(completed);
      air.event = {id: air.event.id + 1, kind: 'landing', strength: clamp(landingSpeed / 14, 0, 1),
        stunt: completed ? 'barrel' : 'none', airtime: air.elapsed, x: car.x, y: ground, z: car.z};
      // A landing loses a little energy; clean stunt rewards are real charge.
      const retained = 1 - clamp(landingSpeed / 160, .025, .09);
      car.vx *= retained; car.vz *= retained;
      if (completed) racer.nitro.charge = Math.min(racer.nitro.capacity, racer.nitro.charge + racer.nitro.capacity * .22);
    }
    air._lastS = road.s;
    return;
  }

  const priorS = air._lastS;
  const delta = priorS === null ? 0 : road.s - priorS;
  air._lastS = road.s;
  const ramp = (track.ramps || []).find(item => road.s >= item.s && road.s <= item.s + item.length
    && Math.abs(road.signedDistance - (item.lane || 0)) <= item.width * .5);
  if (ramp) {
    const fraction = clamp((road.s - ramp.s) / ramp.length, 0, 1);
    air.phase = 'ramp'; air.rampId = ramp.id; air._rampFraction = fraction;
    car.y = ground + ramp.height * fraction; car.pitch = Math.atan((road.grade || 0) + ramp.height / ramp.length); car.roll = 0;
    air._launchY = car.y;
    return;
  }
  const previousRamp = (track.ramps || []).find(item => item.id === air.rampId);
  const facing = Math.sin(car.yaw) * road.tx + Math.cos(car.yaw) * road.tz;
  if (air.phase === 'ramp' && previousRamp && air._rampFraction > .75 && delta > 0 && delta < 4
      && road.s >= previousRamp.s + previousRamp.length && road.s < previousRamp.s + previousRamp.length + 4
      && Math.abs(road.signedDistance - (previousRamp.lane || 0)) <= previousRamp.width * .5 + .4
      && car.speed > 1 && facing > .8) {
    air.phase = 'airborne'; air.elapsed = 0;
    air.vy = car.speed >= 14 ? clamp(car.speed * previousRamp.height / previousRamp.length * 1.35, 4.8, 10.5) : 0;
    car.y = ground + previousRamp.height;
    air.duration = (air.vy + Math.sqrt(air.vy ** 2 + 2 * GRAVITY * previousRamp.height)) / GRAVITY;
    air.roll = 0; air.stunt = previousRamp.type === 'barrel' && car.speed >= 14 ? 'barrel' : 'none';
    air.event = {id: air.event.id + 1, kind: 'takeoff', strength: clamp(car.speed / 45, 0, 1),
      rampId: previousRamp.id, x: car.x, y: car.y, z: car.z};
    return;
  }
  air.phase = 'grounded'; air.rampId = null; air.stunt = 'none';
  car.y = ground; car.pitch = Math.atan(road.grade || 0); car.roll = 0;
}
