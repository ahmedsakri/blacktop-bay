import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const clampDt = dt => Number.isFinite(dt) ? Math.max(0, Math.min(.06, dt)) : 0;

// One original pressure vessel assembled from manufactured parts. Every pickup
// shares six geometry/material batches: adding a bottle never adds a draw call.
export function createNitroCanisterGeometry() {
  const parts = new Map(), transform = new THREE.Object3D();
  const add = (kind, geometry, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) => {
    transform.position.set(...position); transform.rotation.set(...rotation); transform.scale.set(...scale); transform.updateMatrix();
    const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone(); baked.applyMatrix4(transform.matrix); geometry.dispose();
    if (!parts.has(kind)) parts.set(kind, []); parts.get(kind).push(baked);
  };
  const lathe = (points, start = 0, length = TAU) => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), Math.max(8, Math.ceil(28 * length / TAU)), start, length);
  const profile = [[.12, 0], [.23, .015], [.31, .065], [.345, .16], [.35, .27], [.35, 1.05], [.33, 1.19], [.26, 1.31], [.15, 1.37], [.13, 1.4]];
  // A machined metal shell has a narrow, genuinely open inspection window.
  // The separate glass arc allows the contained cyan charge to remain visible.
  add('shell', lathe(profile, .58, TAU - 1.16));
  add('glass', lathe(profile, -.58, 1.16));
  add('dark', new THREE.CylinderGeometry(.13, .13, .13, 20), [0, 1.405, 0]);
  add('metal', new THREE.CylinderGeometry(.105, .13, .12, 20), [0, 1.49, 0]);
  add('metal', new THREE.CylinderGeometry(.07, .07, .22, 12), [.10, 1.48, 0], [0, 0, Math.PI / 2]);
  add('dark', new THREE.CylinderGeometry(.049, .049, .026, 12), [.22, 1.48, 0], [0, 0, Math.PI / 2]);
  add('metal', new THREE.CylinderGeometry(.065, .065, .10, 12), [0, 1.59, 0]);
  add('dark', new THREE.TorusGeometry(.14, .036, 6, 20), [0, 1.66, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) add('metal', new THREE.BoxGeometry(.23, .026, .036), [0, 1.66, 0], [0, i * TAU / 3, 0]);
  for (const y of [.20, 1.08]) {
    add('dark', new THREE.CylinderGeometry(.367, .367, .12, 28, 1, true), [0, y, 0]);
    for (const offset of [-.047, .047]) add('metal', new THREE.TorusGeometry(.367, .014, 5, 28), [0, y + offset, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const angle = i * TAU / 6;
      add('metal', new THREE.SphereGeometry(.025, 6, 4), [Math.sin(angle) * .37, y, Math.cos(angle) * .37]);
    }
  }
  // A raised base boot, two protection ribs and an analogue pressure gauge
  // make the object read as equipment at driving distance, rather than a gem.
  add('dark', new THREE.CylinderGeometry(.35, .36, .11, 28), [0, .04, 0]);
  for (const side of [-1, 1]) add('metal', new THREE.BoxGeometry(.034, .79, .045), [side * .192, .64, .30]);
  add('metal', new THREE.CylinderGeometry(.107, .107, .035, 20), [0, 1.215, .277], [Math.PI / 2, 0, 0]);
  add('dial', new THREE.CircleGeometry(.086, 20), [0, 1.215, .297]);
  add('dark', new THREE.BoxGeometry(.009, .091, .005), [.013, 1.234, .303], [0, 0, -.47]);
  add('dark', new THREE.CircleGeometry(.014, 10), [0, 1.215, .307]);
  for (let i = 0; i < 7; i++) {
    const angle = -.72 * Math.PI + i * Math.PI * 1.44 / 6;
    add('dark', new THREE.BoxGeometry(.008, .015, .003), [Math.sin(angle) * .065, 1.215 + Math.cos(angle) * .065, .302], [0, 0, -angle]);
  }
  add('energy', new THREE.CylinderGeometry(.262, .262, .77, 22), [0, .65, 0]);
  for (const y of [.33, .52, .71, .90]) add('metal', new THREE.TorusGeometry(.268, .009, 4, 22), [0, y, 0], [Math.PI / 2, 0, 0]);
  // Three inlaid chevrons remain legible from behind the bottle as it turns.
  for (const y of [.47, .65, .83]) for (const side of [-1, 1]) add('energy', new THREE.BoxGeometry(.145, .035, .013), [side * .064, y, -.349], [0, side * -.16, side * -.42]);
  const geometries = {};
  for (const [kind, pieces] of parts) { geometries[kind] = mergeGeometries(pieces, false); for (const piece of pieces) piece.dispose(); }
  return geometries;
}

/** Solid metallic/glass Nitro equipment with a grounded locator and a short
 * collection wake. No additional lights, reflection pass or external textures. */
export function createPickupView(scene, pickups = []) {
  const root = new THREE.Group(); root.name = 'collectible-nitro'; scene.add(root);
  const materials = {
    shell: new THREE.MeshPhysicalMaterial({color: '#315966', metalness: .88, roughness: .28, clearcoat: .55, clearcoatRoughness: .23}),
    metal: new THREE.MeshStandardMaterial({color: '#cad6d7', metalness: .94, roughness: .24}),
    dark: new THREE.MeshStandardMaterial({color: '#18242b', metalness: .27, roughness: .65}),
    glass: new THREE.MeshPhysicalMaterial({color: '#75cdd9', metalness: .08, roughness: .12, clearcoat: 1, transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide}),
    dial: new THREE.MeshStandardMaterial({color: '#ecede2', metalness: .03, roughness: .57}),
    energy: new THREE.MeshBasicMaterial({color: '#43daf4', toneMapped: false}),
  };
  const geometries = createNitroCanisterGeometry(), capacity = pickups.length;
  const batches = Object.entries(geometries).map(([kind, geometry]) => {
    const mesh = new THREE.InstancedMesh(geometry, materials[kind], capacity);
    mesh.name = `nitro-canister-${kind}`; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    mesh.castShadow = false; mesh.receiveShadow = kind !== 'energy' && kind !== 'glass'; root.add(mesh); return mesh;
  });
  const markerGeometry = new THREE.RingGeometry(.67, .72, 40, 1, .18, TAU - .36);
  const markerMaterial = new THREE.MeshBasicMaterial({color: '#5cd9e8', transparent: true, opacity: .65, depthWrite: false, side: THREE.DoubleSide, toneMapped: false});
  const markers = new THREE.InstancedMesh(markerGeometry, markerMaterial, capacity); markers.name = 'nitro-ground-locators'; markers.frustumCulled = false; root.add(markers);
  const shadowGeometry = new THREE.PlaneGeometry(1.4, 1.4);
  const shadowMaterial = new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: {},
    vertexShader: 'varying vec2 uvLocal;void main(){uvLocal=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 uvLocal;void main(){float d=length(uvLocal-.5)*2.;float shade=(1.-smoothstep(.08,1.,d))*.32;gl_FragColor=vec4(.008,.025,.035,shade);}' });
  const shadows = new THREE.InstancedMesh(shadowGeometry, shadowMaterial, capacity); shadows.name = 'nitro-contact-shadows'; shadows.frustumCulled = false; root.add(shadows);
  const wakeGeometry = new THREE.RingGeometry(.68, .78, 40);
  const wakeMaterial = new THREE.MeshBasicMaterial({color: '#b0f8ff', transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false, toneMapped: false});
  const wakes = new THREE.InstancedMesh(wakeGeometry, wakeMaterial, capacity); wakes.name = 'nitro-collection-wakes'; wakes.frustumCulled = false; root.add(wakes);
  const nodes = pickups.map(p => ({p, available: p.playerAvailable !== false, pulse: 0})), dummy = new THREE.Object3D(), wakeColour = new THREE.Color();
  let motionTime = 0, disposed = false;
  root.userData.presentation = {canisters: capacity, drawCalls: capacity ? 9 : 0, dynamicLights: 0, hasGlassWindow: true};
  const setMatrix = (mesh, i, x, y, z, scale, rx = 0, ry = 0) => { dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, 0); dummy.scale.setScalar(scale); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); };
  const update = (items, time, active, reduced = false, dt = 0) => {
    if (disposed) return;
    const elapsed = active ? clampDt(dt) : 0; motionTime += elapsed; root.visible = active;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i], p = items[i] || n.p, available = p.playerAvailable !== false;
      if (n.available && !available) n.pulse = .46;
      n.available = available; n.pulse = Math.max(0, n.pulse - elapsed);
      const collection = 1 - n.pulse / .46, ground = (p.y || 0) + .075;
      const scale = available ? 1 : reduced ? 0 : n.pulse > 0 ? Math.max(0, 1 - collection * 2.5) : 0;
      const yaw = Math.atan2(p.tx || 0, p.tz || 1) + Math.PI + (reduced ? 0 : Math.sin(motionTime * .6 + i) * .24);
      dummy.position.set(p.x, ground + .19 + (reduced ? 0 : Math.sin(motionTime * 1.8 + i) * .035), p.z);
      dummy.rotation.set(0, yaw, 0); dummy.scale.setScalar(scale); dummy.updateMatrix();
      for (const mesh of batches) mesh.setMatrixAt(i, dummy.matrix);
      setMatrix(markers, i, p.x, ground, p.z, available ? 1 : 0, -Math.PI / 2, 0);
      setMatrix(shadows, i, p.x, ground - .025, p.z, available ? 1 : 0, -Math.PI / 2, 0);
      setMatrix(wakes, i, p.x, ground + .01, p.z, !reduced && n.pulse > 0 ? .9 + collection * 2.5 : 0, -Math.PI / 2, 0);
      wakes.setColorAt(i, wakeColour.set('#b0f8ff').multiplyScalar(n.pulse / .46));
    }
    for (const mesh of [...batches, markers, shadows, wakes]) mesh.instanceMatrix.needsUpdate = true;
    if (wakes.instanceColor) wakes.instanceColor.needsUpdate = true;
  };
  update(pickups, 0, true, true, 0);
  return { update, dispose() {
    if (disposed) return; disposed = true; root.removeFromParent();
    for (const geometry of [...Object.values(geometries), markerGeometry, shadowGeometry, wakeGeometry]) geometry.dispose();
    for (const material of [...Object.values(materials), markerMaterial, shadowMaterial, wakeMaterial]) material.dispose();
  }};
}
