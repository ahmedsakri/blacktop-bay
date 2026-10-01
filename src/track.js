import { GRAND_PRIX_CIRCUITS } from './grand-prix-circuits.js';
import { ORIGINAL_CIRCUITS } from './original-circuits.js';

// A closed coastal circuit in the x/z plane. Tangents point in race direction;
// normals point to +local X (the driver's left). Distances and positions are metres.
const CONTROL_POINTS = [
  [-125, -115], [-35, -142], [70, -137], [147, -99],
  [156, -36], [126, 9], [87, 4], [74, 44],
  [128, 73], [113, 126], [39, 144], [-16, 101],
  [-73, 113], [-140, 89], [-159, 35], [-111, -3],
  [-73, -2], [-69, -48], [-127, -61],
];
const CIRCUITS = [
  { id: 'harbor', name: 'Harbor Flow', description: 'Waterfront sweepers and a twisting inland section.', points: CONTROL_POINTS },
  { id: 'dockyard', name: 'Dockyard Technical', description: 'Tight dockside turns reward braking and precise exits.', points: [
    [-140, -125], [-45, -140], [80, -136], [155, -98], [156, -25],
    [98, -35], [56, -73], [2, -67], [-10, -13], [62, 14], [131, 31],
    [149, 100], [87, 141], [0, 139], [-57, 85], [-135, 112], [-164, 50],
    [-119, 4], [-75, -5], [-88, -62], [-143, -68],
  ] },
  { id: 'coast', name: 'Coast Run', description: 'A fast, open coastal loop built for long nitro runs.', points: [
    [-150, -115], [-55, -155], [70, -155], [165, -111], [181, -20],
    [167, 73], [105, 142], [7, 160], [-90, 145], [-170, 85], [-185, -4],
  ] },
  { id: 'summit', name: 'Summit Switchback', description: 'A technical asphalt loop through rocky pine-lined switchbacks.', points: [
    [-110, -155], [-25, -155], [85, -155], [162, -126], [183, -75],
    [149, -34], [70, -36], [38, -3], [71, 32], [150, 43], [187, 85],
    [162, 132], [88, 150], [21, 126], [-34, 84], [-101, 124],
    [-163, 104], [-179, 46], [-144, 7], [-67, 4], [-45, -33],
    [-81, -71], [-145, -69], [-190, -98], [-175, -147],
  ] },
  { id: 'grandprix', name: 'Bay Grand Prix', description: 'A wide permanent circuit with a long pit straight and flowing chicanes.', width: 18, points: [
    [-120, -160], [-30, -160], [85, -160], [174, -153], [210, -110],
    [204, -45], [148, -2], [122, 43], [166, 94], [174, 157],
    [114, 190], [25, 185], [-42, 126], [-90, 120], [-168, 166],
    [-216, 122], [-219, 50], [-174, 3], [-178, -67], [-215, -108],
    [-194, -155],
  ] },
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

function buildTrack({ id, name, description, points, width = 16, ...metadata }) {
  const dense = [];
  const pointCount = points.length;
  for (let segment = 0; segment < pointCount; segment++) {
    for (let step = 0; step < 64; step++) {
      const [x, z] = catmull(
        points[(segment - 1 + pointCount) % pointCount],
        points[segment], points[(segment + 1) % pointCount],
        points[(segment + 2) % pointCount], step / 64,
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
    series: 'original', region: 'Camber Reign', layoutKind: 'original',
    ...metadata, id, name, description, samples, length, width,
    spawn: { x: samples[0].x, z: samples[0].z, yaw: Math.atan2(samples[0].tx, samples[0].tz) },
  };
}

const layouts = new Map([...CIRCUITS, ...GRAND_PRIX_CIRCUITS, ...ORIGINAL_CIRCUITS].map((circuit) => [circuit.id, buildTrack(circuit)]));
export const TRACKS = [...layouts.values()].map(({ samples, spawn, ...descriptor }) => descriptor);
export let TRACK = layouts.get('harbor');
export function getTrack(id = TRACK.id) { return layouts.get(id) || layouts.get('harbor'); }
export function setTrack(id) { TRACK = getTrack(id); return TRACK; }

export function sampleTrack(distance, track = TRACK) {
  const s = wrap(Number.isFinite(distance) ? distance : 0, track.length);
  const position = s / track.length * track.samples.length;
  const index = Math.min(track.samples.length - 1, Math.floor(position));
  const a = track.samples[index], b = track.samples[(index + 1) % track.samples.length];
  const fraction = position - index;
  let tx = a.tx + (b.tx - a.tx) * fraction;
  let tz = a.tz + (b.tz - a.tz) * fraction;
  const magnitude = Math.hypot(tx, tz) || 1;
  tx /= magnitude; tz /= magnitude;
  return { x: a.x + (b.x - a.x) * fraction, z: a.z + (b.z - a.z) * fraction, tx, tz, nx: tz, nz: -tx, s, index, distance: 0, signedDistance: 0 };
}

export function projectOnTrack(x, z, hint = 0, track = TRACK) {
  let nearest = null;
  let bestSquared = Infinity;
  const count = track.samples.length;
  // Inspecting the whole loop makes this safe for recovery, arbitrary camera
  // queries, and distant points; the hint just supplies a stable first candidate.
  const start = wrap(Number.isFinite(hint) ? Math.floor(hint) : 0, count);
  for (let offset = 0; offset < count; offset++) {
    const index = (start + offset) % count;
    const a = track.samples[index], b = track.samples[(index + 1) % count];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    const px = a.x + dx * t, pz = a.z + dz * t;
    const squared = (x - px) ** 2 + (z - pz) ** 2;
    if (squared < bestSquared) {
      bestSquared = squared;
      nearest = { index, t, x: px, z: pz };
    }
  }
  const sample = sampleTrack((nearest.index + nearest.t) / count * track.length, track);
  const distance = Math.sqrt(bestSquared);
  const side = (x - nearest.x) * sample.nx + (z - nearest.z) * sample.nz;
  return { ...sample, x: nearest.x, z: nearest.z, index: nearest.index, distance, signedDistance: distance * Math.sign(side) };
}
