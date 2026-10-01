import * as THREE from 'three';

// Original closed/open-cockpit race coachwork. The credited GT source supplies
// only its articulated wheels; every body panel below is authored for this game.
export function createPrototypeCar({ model, template, color, ghost = false, low = false, finishSurface, raceNumberTexture, batchStaticMeshes }) {
  const open = ['barchetta', 'spyder'].includes(model.id), attack = ['hyper', 'spyder'].includes(model.id);
  const group = new THREE.Group(), chassis = new THREE.Group();
  group.name = model.name.toLowerCase().replaceAll(' ', '-'); chassis.name = 'sprung-body'; group.add(chassis);
  const geometry = [], materials = [], textures = [], wheels = [];
  const material = (type, options) => { const m = new type(options); materials.push(m); return m; };
  const paint = material(THREE.MeshPhysicalMaterial, {color: color ?? model.color, metalness: .48, roughness: .24, clearcoat: 1, clearcoatRoughness: .12});
  const carbon = material(THREE.MeshPhysicalMaterial, {color: '#121920', metalness: .36, roughness: .34, clearcoat: .22});
  const glass = material(THREE.MeshPhysicalMaterial, {color: '#142632', metalness: .12, roughness: .12, clearcoat: 1, transparent: true, opacity: .86, depthWrite: false});
  const rubber = material(THREE.MeshStandardMaterial, {color: '#101216', roughness: .84});
  const alloy = material(THREE.MeshStandardMaterial, {color: attack ? '#a89464' : '#636a72', metalness: .88, roughness: .26});
  const trim = material(THREE.MeshStandardMaterial, {color: '#c5cace', metalness: .86, roughness: .27});
  const accent = material(THREE.MeshStandardMaterial, {color: open ? '#e3e2d6' : '#e54726', roughness: .3, metalness: .22});
  const dark = material(THREE.MeshStandardMaterial, {color: '#0b1015', roughness: .86});
  const lamps = material(THREE.MeshStandardMaterial, {color: '#9b1110', emissive: '#ef160b', emissiveIntensity: .6, roughness: .2});
  const headlights = material(THREE.MeshBasicMaterial, {color: '#daf3ff', toneMapped: false});
  paint.name='body-paint';carbon.name='carbon-trim';glass.name='dark-glass';headlights.name='head-light-guides';lamps.name='tail-light-guides';
  const add = (g, m, parent = chassis, name = '') => { geometry.push(g); const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.castShadow = !ghost && m !== headlights; mesh.receiveShadow = !ghost; parent.add(mesh); return mesh; };
  const box = (w, h, d, x, y, z, m, name) => { const mesh = add(new THREE.BoxGeometry(w, h, d), m, chassis, name); mesh.position.set(x, y, z); return mesh; };
  const patch = (points, m, name) => { const g = new THREE.BufferGeometry(), indices = []; for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1); g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3)); g.setIndex(indices); g.computeVertexNormals(); return add(g, m, chassis, name); };
  const surface = (rows, columns, fn, m, name) => {
    const p = [], indices = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) p.push(...fn(i / columns, j / rows));
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) { const a = j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1; indices.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(indices); g.computeVertexNormals(); return add(g, m, chassis, name);
  };
  const tube = (points, radius, m, name) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), low ? 16 : 32, radius, 6, false), m, chassis, name);
  paint.side = carbon.side = glass.side = accent.side = THREE.DoubleSide;
  if (!ghost) { finishSurface(paint, 'paint'); finishSurface(carbon, 'carbon'); }
  else for (const m of materials) { m.color.set('#4fe7f1'); m.transparent = true; m.opacity = .22; m.depthWrite = false; }

  // Front and rear wheel centres are set independently of the original car's
  // body proportions. Keep each source wheel's local hub geometry intact.
  for (const [name] of template.pivots) {
    const front = name.includes('_f'), side = name.endsWith('l') ? 1 : -1;
    const pivot = new THREE.Group(), rolling = new THREE.Group();
    pivot.name = name; pivot.position.set(side * .965, .367, front ? 1.39 : -1.47); pivot.add(rolling); group.add(pivot);
    for (const part of template.parts.filter(p => p.wheel === name)) {
      const m = /tire/.test(part.name) ? rubber : /brakes/.test(part.name) ? accent : alloy;
      const mesh = new THREE.Mesh(part.geometry, m); mesh.castShadow = !ghost; mesh.receiveShadow = !ghost; rolling.add(mesh);
    }
    wheels.push({ pivot, rolling, front });
  }

  const tail = attack ? -2.54 : -2.36, nose = 2.43;
  box(1.94, .07, nose - tail - .16, 0, .135, (nose + tail) / 2, carbon, 'carbon-underfloor');
  // The centre body is a smooth, low tapered monocoque, distinct from the
  // separate wheel fairings. Long-tail models extend the rear deck.
  const width = z => .53 + .18 * Math.exp(-Math.pow((z + .65) / 1.0, 2)) - .13 * Math.exp(-Math.pow((z - 2.35) / .5, 2));
  const top = z => .42 + .12 * Math.exp(-Math.pow((z + .8) / 1.6, 2)) + .04 * Math.exp(-Math.pow((z - 1.45) / .7, 2));
  surface(low ? 36 : 64, 24, (u, v) => { const z = tail + (nose - tail) * v, theta = Math.PI * u; return [Math.cos(theta) * width(z), .20 + Math.sin(theta) * (top(z) - .20), z]; }, paint, 'sculpted-central-monocoque');
  for (const side of [-1, 1]) {
    const outer = z => 1.02 + .10 * Math.exp(-Math.pow((z - 1.39) / .8, 2)) + .10 * Math.exp(-Math.pow((z + 1.47) / .8, 2)) - .12 * Math.exp(-Math.pow((z - 2.4) / .25, 2));
    const inner = z => .62 + .04 * Math.sin(z);
    const crown = z => .49 + .34 * Math.exp(-Math.pow((z - 1.39) / .7, 2)) + .34 * Math.exp(-Math.pow((z + 1.47) / .7, 2));
    surface(low ? 48 : 88, 14, (u, v) => { const z = tail + (nose - tail) * v; return [side * THREE.MathUtils.lerp(inner(z), outer(z), u), crown(z) + .035 * Math.sin(u * Math.PI), z]; }, paint, 'flowing-wheel-fairing');
    surface(low ? 48 : 88, 6, (u, v) => {
      const z = tail + (nose - tail) * v;
      let bottom = .20;
      for (const wheelZ of [1.39, -1.47]) { const d = Math.abs(z - wheelZ); if (d < .425) bottom = Math.max(bottom, .367 + Math.sqrt(.425 ** 2 - d ** 2)); }
      return [side * outer(z), THREE.MathUtils.lerp(crown(z), bottom, u), z];
    }, paint, 'open-wheel-arch-skin');
    surface(32, 4, (u, v) => { const z = tail + (nose - tail) * v; return [side * inner(z), THREE.MathUtils.lerp(.22, crown(z), u), z]; }, carbon, 'inner-aero-channel');
    for (const end of [tail, nose]) surface(8, 12, (u, v) => { const x = THREE.MathUtils.lerp(inner(end), outer(end), u); return [side * x, THREE.MathUtils.lerp(.20, crown(end) + .035 * Math.sin(u * Math.PI), v), end]; }, paint, 'rounded-fairing-end');
    const skirt = box(.16, .055, 1.80, side * 1.055, .18, -.02, carbon, 'side-skirt'); skirt.rotation.z = side * .04;
    // Deep side intake and slatted louvres give the body scale and construction.
    patch([[side * 1.072, .23, .70], [side * 1.072, .40, .45], [side * 1.072, .46, -.88], [side * 1.072, .23, -.77]], dark, 'side-cooling-inlet');
    for (let i = 0; i < (attack ? 7 : 5); i++) {
      const z = 1.14 + i * .072, y = crown(z) + .012;
      const slat = box(.26, .012, .027, side * .865, y, z, carbon, 'fender-extraction-louvre'); slat.rotation.y = side * -.16;
    }
    // Headlight pods face forward, with three small LED strips in each housing.
    box(.28, .16, .055, side * .865, .525, 2.40, dark, 'headlight-housing');
    for (let i = 0; i < 3; i++) box(.22, .017, .009, side * .865, .48 + i * .045, 2.431, headlights, 'led-headlight');
    box(.39, .038, .025, side * .825, .44, tail - .008, lamps, 'rear-light-bar');
    // Two tiny mirrors with stalks, separate lenses and a restrained race accent.
    tube([[side * .49, .61, .35], [side * .62, .80, .23], [side * .77, .82, .22]], .012, carbon, 'mirror-stalk');
    const mirror = add(new THREE.SphereGeometry(1, 12, 8), paint, chassis, 'mirror-shell'); mirror.scale.set(.13, .065, .07); mirror.position.set(side * .79, .82, .22);
    box(.16, .057, .008, side * .79, .82, .145, trim, 'mirror-lens');
    // A recessed filler cap and fasteners break up the large painted panels.
    const cap = add(new THREE.CylinderGeometry(.050, .050, .014, 16), alloy, chassis, 'fuel-cap'); cap.position.set(side * .80, crown(-.5) + .012, -.5);
  }
  // Splitter lips, front cooling mouth and rear diffuser vanes.
  patch([[-1.11, .175, 2.18], [-.94, .175, 2.51], [0, .175, 2.55], [.94, .175, 2.51], [1.11, .175, 2.18]], carbon, 'front-splitter');
  patch([[-.43, .225, 2.445], [-.38, .355, 2.445], [.38, .355, 2.445], [.43, .225, 2.445]], dark, 'front-brake-duct');
  for (let i = -3; i <= 3; i++) box(.013, .16, .48, i * .24, .19, tail + .20, carbon, 'diffuser-vane');
  for (const side of [-1, 1]) {
    box(.036, .50, .11, side * .66, .72, tail + .31, carbon, 'wing-upright');
    box(.030, .26, .50, side * 1.11, 1.035, tail + .32, paint, 'wing-endplate');
  }
  surface(12, 28, (u, v) => [(u - .5) * 2.22, 1.02 + .055 * Math.sin(v * Math.PI), tail + .09 + v * .44], carbon, 'sculpted-rear-wing');
  if (attack) surface(8, 24, (u, v) => [(u - .5) * 2.22, 1.145 + .028 * Math.sin(v * Math.PI), tail + .11 + v * .20], carbon, 'upper-wing-element');

  if (!open) {
    // Teardrop canopy: a glazed closed cockpit with a narrow painted roof spine.
    const canopy = (u, v) => { const z = -.88 + v * 1.80, profile = Math.sin(Math.PI * v) ** .65, theta = u * Math.PI; return [Math.cos(theta) * .40 * profile, .48 + Math.sin(theta) * .68 * profile, z]; };
    box(.57, .12, 1.05, 0, .52, -.03, dark, 'closed-cockpit-interior');
    const seat = box(.34, .34, .12, 0, .64, -.40, carbon, 'closed-cockpit-seat'); seat.rotation.x=-.16;
    surface(low ? 24 : 40, 28, canopy, glass, 'teardrop-glazed-cockpit');
    surface(32, 4, (u, v) => { const p = canopy(.475 + u * .050, v); p[1] += .004; return p; }, paint, 'painted-roof-spine');
    for (const v of [.21, .75]) tube(Array.from({length: 25}, (_, i) => canopy(i / 24, v).map((n, index) => index === 1 ? n + .006 : n)), .013, paint, 'canopy-frame');
    for (const side of [-1, 1]) tube([[side * .30, .53, .83], [side * .41, .49, .10], [side * .32, .51, -.76]], .014, carbon, 'cockpit-sill');
    patch([[0, .58, -.78], [0, 1.00, -1.12], [0, 1.08, tail + .49], [0, .55, tail + .30]], paint, 'stability-fin');
  } else {
    // Open cockpit includes a visible bucket, harness, dash, steering wheel and
    // twin rollover hoops. These are real meshes, not an opaque painted window.
    box(.77, .035, 1.20, 0, .50, -.03, dark, 'cockpit-opening');
    const seat = box(.40, .39, .12, 0, .64, -.43, carbon, 'bucket-seat-back'); seat.rotation.x = -.20;
    box(.40, .06, .47, 0, .52, -.15, carbon, 'bucket-seat-base');
    for (const side of [-1, 1]) { box(.055, .34, .018, side * .10, .65, -.35, accent, 'race-harness'); tube([[side * .14, .54, -.68], [side * .14, .91, -.64], [side * .35, .99, -.60], [side * .44, .58, -.60]], .028, trim, 'rollover-hoop'); }
    surface(16, 22, (u, v) => { const theta = (u - .5) * Math.PI * .8; return [Math.sin(theta) * .45, .52 + .22 * v, .55 - (1 - Math.cos(theta)) * .21 - v * .08]; }, glass, 'curved-windscreen');
    const wheel = add(new THREE.TorusGeometry(.14, .018, 8, 20), rubber, chassis, 'steering-wheel'); wheel.position.set(0, .70, .22); wheel.rotation.x = -.28;
    box(.014, .18, .017, 0, .66, .215, trim, 'steering-spoke');
    box(.11, .062, .04, 0, .64, .43, dark, 'digital-dashboard');
    for (const side of [-1, 1]) box(.055, .050, 1.28, side * .42, .545, -.01, paint, 'cockpit-edge');
  }
  // Original team stripes follow the curved upper nose rather than float above it.
  for (const side of [-1, 1]) surface(20, 3, (u, v) => { const z = .96 + v * 1.35, x = side * (.07 + u * (attack ? .070 : .045)); const theta = Math.acos(x / width(z)); return [x, .204 + Math.sin(theta) * (top(z) - .20), z]; }, accent, 'nose-team-stripe');
  const texture = ghost ? null : raceNumberTexture(model.number, model.color);
  if (texture) {
    const numberGroup=new THREE.Group();numberGroup.name='original-race-numbers';chassis.add(numberGroup);
    textures.push(texture); const m = material(THREE.MeshStandardMaterial, {map: texture, roughness: .5, side: THREE.DoubleSide});
    for (const side of [-1, 1]) { const plate = add(new THREE.PlaneGeometry(.43, .24), m, numberGroup, 'race-number-panel'); plate.position.set(side * 1.08, .36, -.10); plate.rotation.y = side * Math.PI / 2; }
  }
  const exhausts = [-.19, .19].map(x => ({x, y: .37, z: tail - .026}));
  const flames = new THREE.Group(); flames.name = 'nitro-exhaust'; flames.visible = false; chassis.add(flames);
  const flameMaterial = material(THREE.MeshBasicMaterial, {color: '#63bdff', transparent: true, opacity: .48, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false});
  for (const p of exhausts) {
    const pipe = add(new THREE.CylinderGeometry(.043, .045, .12, 12, 1, true), trim, chassis, 'exhaust-pipe'); pipe.rotation.x = Math.PI / 2; pipe.position.set(p.x, p.y, p.z + .035);
    const g = new THREE.ConeGeometry(.033, .36, 10, 1, true); g.translate(0, .18, 0); g.rotateX(-Math.PI / 2);
    const flame = add(g, flameMaterial, flames, 'nitro-flame'); flame.position.set(p.x, p.y, p.z - .016); flame.castShadow = false;
  }
  // Merge static painted panels by material. Leave UV-mapped numbers and the
  // animated exhaust as separate groups, and never dispose shared source wheels.
  batchStaticMeshes(chassis);
  for(const mesh of chassis.children)if(mesh.isMesh)geometry.push(mesh.geometry);
  for(const wheel of wheels){batchStaticMeshes(wheel.rolling);for(const mesh of wheel.rolling.children)if(mesh.isMesh)geometry.push(mesh.geometry);}
  let lastTime = null, wheelAngle = 0, disposed = false;
  function update({speed = 0, steering = 0, brake = 0, time = 0, nitro = false} = {}) {
    if (disposed) return;
    const dt = lastTime === null ? 0 : THREE.MathUtils.clamp(time - lastTime, 0, .06); lastTime = time; wheelAngle = (wheelAngle + speed * dt / .367) % (Math.PI * 2);
    for (const wheel of wheels) { wheel.rolling.rotation.x = wheelAngle; wheel.pivot.rotation.y = wheel.front ? -THREE.MathUtils.clamp(steering, -1, 1) * .42 : 0; }
    chassis.rotation.z = THREE.MathUtils.lerp(chassis.rotation.z, steering * Math.min(Math.abs(speed) / 28, 1) * .018, Math.min(1, dt * 8));
    lamps.emissiveIntensity = ghost ? 0 : .6 + (brake ? 1.8 : 0); flames.visible = !ghost && Boolean(nitro); flames.scale.z = .89 + .11 * Math.sin(time * 47);
  }
  function dispose() { if (disposed) return; disposed = true; group.removeFromParent(); geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); }
  group.userData = {kind: 'original-prototype-coachwork', vehicle: model.id, dimensions: {length: 2.55 - tail, width: 2.25, height: 1.18}, source: 'AppsOverFlow original body; credited vicent091036 GT wheels', effects: {rearAxle: -1.47, tyreOffset: .965, tyreWidth: .29, exhausts}};
  return {group, update, dispose};
}
