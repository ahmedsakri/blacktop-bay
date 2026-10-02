import {wreckActive} from './wreck-motion.js';

/** The race engine owns wreck motion. Reduced motion hides its presentation
 * while leaving simulation, loss of drive and safe recovery unchanged. */
export function collisionPose(racer, {reducedMotion = false} = {}) {
  const zero = {yaw: 0, pitch: 0, roll: 0, lift: 0};
  if (!reducedMotion || !wreckActive(racer)) return zero;
  const car = racer.car, wreck = racer.wreck;
  return {yaw: (wreck.heading ?? car.yaw) - car.yaw,
    pitch: (car.pitch || 0) - (wreck.roadPitch || 0), roll: -(car.roll || 0),
    lift: (wreck.groundY ?? car.y) - car.y};
}
