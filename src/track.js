// A closed coastal circuit in the x/z plane. Tangents point in race direction;
// normals point to the driver's right. Distances and positions are metres.
const CONTROL_POINTS = [
  [-125, -115], [-35, -142], [70, -137], [147, -99],
  [156, -36], [126, 9], [87, 4], [74, 44],
  [128, 73], [113, 126], [39, 144], [-16, 101],
  [-73, 113], [-140, 89], [-159, 35], [-111, -3],
  [-73, -2], [-69, -48], [-127, -61],
];
const COUNT = 440;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrap = (value, length) => ((value % length) + length) % length;

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [0, 1].map((axis) => 0.5 * (
    2 * p1[axis] + (-p0[axis] + p2[axis]) * t
    + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2
    + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3
  ));
}

function buildTrack() {
  const dense = [];
  const pointCount = CONTROL_POINTS.length;
  for (let segment = 0; segment < pointCount; segment++) {
    for (let step = 0; step < 64; step++) {
      const [x, z] = catmull(
        CONTROL_POINTS[(segment - 1 + pointCount) % pointCount],
        CONTROL_POINTS[segment], CONTROL_POINTS[(segment + 1) % pointCount],
        CONTROL_POINTS[(segment + 2) % pointCount], step / 64,
      );
      dense.push({ x, z, s: 0 });
    }
  }
  dense.push({ ...dense[0] });
  let length = 0;
  for (let i = 1; i < dense.length; i++) {
    length += Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z);
    dense[i].s = length;
  }
  const samples = [];
  let cursor = 0;
  for (let i = 0; i < COUNT; i++) {
    const s = i * length / COUNT;
    while (dense[cursor + 1].s < s) cursor++;
    const a = dense[cursor], b = dense[cursor + 1];
    const fraction = (s - a.s) / (b.s - a.s || 1);
    samples.push({ x: a.x + (b.x - a.x) * fraction, z: a.z + (b.z - a.z) * fraction, s });
  }
  samples.forEach((sample, i) => {
    const a = samples[(i - 1 + COUNT) % COUNT], b = samples[(i + 1) % COUNT];
    const magnitude = Math.hypot(b.x - a.x, b.z - a.z);
    sample.tx = (b.x - a.x) / magnitude;
    sample.tz = (b.z - a.z) / magnitude;
    sample.nx = sample.tz;
    sample.nz = -sample.tx;
  });
  return {
    samples, length, width: 16,
    spawn: { x: samples[0].x, z: samples[0].z, yaw: Math.atan2(samples[0].tx, samples[0].tz) },
  };
}

export const TRACK = buildTrack();

export function sampleTrack(distance) {
  const s = wrap(Number.isFinite(distance) ? distance : 0, TRACK.length);
  const position = s / TRACK.length * TRACK.samples.length;
  const index = Math.min(TRACK.samples.length - 1, Math.floor(position));
  const a = TRACK.samples[index], b = TRACK.samples[(index + 1) % TRACK.samples.length];
  const fraction = position - index;
  let tx = a.tx + (b.tx - a.tx) * fraction;
  let tz = a.tz + (b.tz - a.tz) * fraction;
  const magnitude = Math.hypot(tx, tz) || 1;
  tx /= magnitude; tz /= magnitude;
  return { x: a.x + (b.x - a.x) * fraction, z: a.z + (b.z - a.z) * fraction, tx, tz, nx: tz, nz: -tx, s, index, distance: 0, signedDistance: 0 };
}

export function projectOnTrack(x, z, hint = 0) {
  let nearest = null;
  let bestSquared = Infinity;
  const count = TRACK.samples.length;
  // Inspecting the whole loop makes this safe for recovery, arbitrary camera
  // queries, and distant points; the hint just supplies a stable first candidate.
  const start = wrap(Number.isFinite(hint) ? Math.floor(hint) : 0, count);
  for (let offset = 0; offset < count; offset++) {
    const index = (start + offset) % count;
    const a = TRACK.samples[index], b = TRACK.samples[(index + 1) % count];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    const px = a.x + dx * t, pz = a.z + dz * t;
    const squared = (x - px) ** 2 + (z - pz) ** 2;
    if (squared < bestSquared) {
      bestSquared = squared;
      nearest = { index, t, x: px, z: pz };
    }
  }
  const sample = sampleTrack((nearest.index + nearest.t) / count * TRACK.length);
  const distance = Math.sqrt(bestSquared);
  const side = (x - nearest.x) * sample.nx + (z - nearest.z) * sample.nz;
  return { ...sample, x: nearest.x, z: nearest.z, index: nearest.index, distance, signedDistance: distance * Math.sign(side) };
}
