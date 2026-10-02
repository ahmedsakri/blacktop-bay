import {getVehicle} from './vehicles.js';
import {MANUFACTURER_ASSETS} from './manufacturer-asset-manifest.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// Authored arcade character, not manufacturer mass, tyre or brake measurements.
// Small bounds preserve the shared steering/recovery model for every body.
export function vehicleDynamics(id) {
  const vehicle = getVehicle(id), asset = MANUFACTURER_ASSETS[vehicle.id];
  const length = asset?.length || 4.3, width = asset?.width || 1.9;
  const agility = clamp((vehicle.handling.handling - 1.08) / .12, -1, 1);
  const electric = vehicle.powertrain === 'electric';
  const classic = /classic|1975/i.test(vehicle.specs.body);
  const race = /racing|prototype|track-only|GT3/i.test(vehicle.specs.body);
  const mass = clamp(1 + (length - 4.5) * .07 + (width - 2.05) * .08 + (electric ? .055 : 0) - (race ? .025 : 0), .90, 1.12);
  return Object.freeze({length, width, height: asset?.height || 1.4, radius: width / 2,
    halfSegment: Math.max(0, (length - width) / 2), mass,
    grip: 1 + agility * .035 + (electric ? .025 : classic ? -.018 : 0),
    braking: 1 + agility * .025 + (race ? .035 : classic ? -.025 : 0),
    steeringResponse: clamp(1 / mass + agility * .035, .9, 1.1),
    yawResponse: clamp(1 / mass + agility * .025, .9, 1.1),
    traction: electric ? .99 : classic ? .935 : race ? .985 : .97,
    brakeBalance: classic ? .018 : race ? .035 : .025,
  });
}

// A continuous capsule retains the visual body's length and width, with rounded
// corners that stay forgiving when a thumb drifts close to another car.
export function carContactShape(racer) {
  return racer.contactShape || vehicleDynamics(racer.vehicle);
}
export function carRoadClearance(racer, road) {
  const shape = carContactShape(racer), yaw = racer.car.yaw;
  return shape.radius + shape.halfSegment * Math.abs(Math.sin(yaw) * road.nx + Math.cos(yaw) * road.nz);
}

export function carSupportPoint(racer, nx, nz) {
  const shape = carContactShape(racer), fx = Math.sin(racer.car.yaw), fz = Math.cos(racer.car.yaw);
  const end = Math.sign(fx * nx + fz * nz) * shape.halfSegment;
  return {x: racer.car.x + fx * end + nx * shape.radius, z: racer.car.z + fz * end + nz * shape.radius};
}

export function capsuleContact(a, b) {
  const sa = carContactShape(a), sb = carContactShape(b);
  if (a.car.y >= b.car.y + sb.height || b.car.y >= a.car.y + sa.height) return null;
  const ax = Math.sin(a.car.yaw), az = Math.cos(a.car.yaw), bx = Math.sin(b.car.yaw), bz = Math.cos(b.car.yaw);
  const px = a.car.x - ax * sa.halfSegment, pz = a.car.z - az * sa.halfSegment;
  const qx = b.car.x - bx * sb.halfSegment, qz = b.car.z - bz * sb.halfSegment;
  const ux = ax * sa.halfSegment * 2, uz = az * sa.halfSegment * 2;
  const vx = bx * sb.halfSegment * 2, vz = bz * sb.halfSegment * 2;
  const wx = px - qx, wz = pz - qz;
  const aa = ux * ux + uz * uz, bb = ux * vx + uz * vz, cc = vx * vx + vz * vz;
  const dd = ux * wx + uz * wz, ee = vx * wx + vz * wz, denominator = aa * cc - bb * bb;
  let s = denominator > 1e-10 ? clamp((bb * ee - cc * dd) / denominator, 0, 1) : 0;
  let t = cc > 1e-10 ? (bb * s + ee) / cc : 0;
  if (t < 0) {t = 0; s = aa > 1e-10 ? clamp(-dd / aa, 0, 1) : 0;}
  else if (t > 1) {t = 1; s = aa > 1e-10 ? clamp((bb - dd) / aa, 0, 1) : 0;}
  const xA = px + ux * s, zA = pz + uz * s, xB = qx + vx * t, zB = qz + vz * t;
  const dx = xB - xA, dz = zB - zA, distance = Math.hypot(dx, dz), overlap = sa.radius + sb.radius - distance;
  if (overlap <= 0) return null;
  const centerSide = (b.car.x - a.car.x) * az - (b.car.z - a.car.z) * ax;
  const nx = distance > 1e-6 ? dx / distance : az * (centerSide < 0 ? -1 : 1);
  const nz = distance > 1e-6 ? dz / distance : -ax * (centerSide < 0 ? -1 : 1);
  return {overlap, nx, nz, frontA: (s * 2 - 1) * sa.halfSegment, frontB: (t * 2 - 1) * sb.halfSegment,
    x: (xA + nx * sa.radius + xB - nx * sb.radius) / 2,
    z: (zA + nz * sa.radius + zB - nz * sb.radius) / 2};
}
