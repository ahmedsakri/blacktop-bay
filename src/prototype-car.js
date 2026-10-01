import * as THREE from 'three';

// Original closed/open-cockpit race coachwork. The credited GT source supplies
// only its articulated wheels; every body panel below is authored for this game.
export function createPrototypeCar({ model, template, color, ghost = false, low = false, finishSurface, raceNumberTexture, batchStaticMeshes }) {
  const singleSeat = model.id === 'monoposto', lowCanopy = model.id === 'mirage', extreme = model.id === 'tempest';
  const offsetCockpit = model.id === 'vela', enduranceFin = model.id === 'aurora';
  const open = ['barchetta', 'spyder'].includes(model.id) || singleSeat || offsetCockpit, attack = ['hyper', 'spyder'].includes(model.id) || extreme;
  const group = new THREE.Group(), chassis = new THREE.Group();
  group.name = model.name.toLowerCase().replaceAll(' ', '-'); chassis.name = 'sprung-body'; group.add(chassis);
  const geometry = [], materials = [], textures = [], wheels = [];
  const material = (type, options) => { const m = new type(options); materials.push(m); return m; };
  const paint = material(THREE.MeshPhysicalMaterial, {color: color ?? model.color, metalness: .48, roughness: .24, clearcoat: 1, clearcoatRoughness: .12});
  const carbon = material(THREE.MeshPhysicalMaterial, {color: '#121920', metalness: .36, roughness: .34, clearcoat: .22});
  const glass = material(THREE.MeshPhysicalMaterial, {color: '#142632', metalness: .12, roughness: .12, clearcoat: 1, transparent: true, opacity: .86, depthWrite: false});
  const rubber = material(THREE.MeshStandardMaterial, {color: '#101216', roughness: .84});
  const alloy = material(THREE.MeshStandardMaterial, {color: attack ? '#a89464' : '#515b65', metalness: .70, roughness: .42});
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

  const tail = enduranceFin ? -2.85 : offsetCockpit ? -2.16 : lowCanopy ? -2.74 : singleSeat ? -2.24 : extreme ? -2.65 : attack ? -2.54 : -2.36;
  const nose = enduranceFin ? 2.56 : offsetCockpit ? 2.22 : lowCanopy ? 2.48 : singleSeat ? 2.32 : extreme ? 2.58 : 2.43;
  box(1.94, .07, nose - tail - .16, 0, .135, (nose + tail) / 2, carbon, 'carbon-underfloor');
  // A broader nose joins the monocoque to the fenders instead of reading as
  // three separate rounded pods. Long-tail models retain their rear extension.
  const width = z => .57 + (enduranceFin ? .08 : lowCanopy ? .055 : singleSeat ? -.045 : extreme ? .04 : 0)
    + .16 * Math.exp(-Math.pow((z + .65) / 1.0, 2)) - .075 * Math.exp(-Math.pow((z - 2.35) / .5, 2))
    - (extreme ? .19 * THREE.MathUtils.smoothstep(z, 1.15, nose) : 0);
  const top = z => .42 + (lowCanopy ? -.025 : singleSeat || offsetCockpit ? .018 : enduranceFin ? .025 : 0)
    + .12 * Math.exp(-Math.pow((z + .8) / 1.6, 2)) + .04 * Math.exp(-Math.pow((z - 1.45) / .7, 2));
  surface(low ? 36 : 64, 24, (u, v) => { const z = tail + (nose - tail) * v, theta = Math.PI * u; return [Math.cos(theta) * width(z), .20 + Math.sin(theta) * (top(z) - .20), z]; }, paint, 'sculpted-central-monocoque');
  for (const side of [-1, 1]) {
    const noseTaper = lowCanopy || singleSeat || extreme || offsetCockpit || enduranceFin ? nose : 2.4;
    const outer = z => 1.02 + (extreme ? .065 : enduranceFin ? .035 : 0) + .10 * Math.exp(-Math.pow((z - 1.39) / .8, 2)) + .10 * Math.exp(-Math.pow((z + 1.47) / .8, 2)) - .12 * Math.exp(-Math.pow((z - noseTaper) / .25, 2));
    const inner = z => (singleSeat ? .69 : .62) + .04 * Math.sin(z);
    // Broader, flatter wheel shoulders and a small outer chamfer preserve tyre
    // clearance while replacing the original bulbous fender cross-section.
    const crown = z => .48 + (lowCanopy ? -.022 : extreme ? .025 : 0) + .35 * Math.exp(-Math.pow((z - 1.39) / .74, 4)) + .35 * Math.exp(-Math.pow((z + 1.47) / .74, 4));
    const fairingHeight = (z, u) => crown(z) + .015 * Math.sin(u * Math.PI) - .025 * THREE.MathUtils.smoothstep(u, .68, 1);
    surface(low ? 48 : 88, 14, (u, v) => { const z = tail + (nose - tail) * v; return [side * THREE.MathUtils.lerp(inner(z), outer(z), u), fairingHeight(z, u), z]; }, paint, 'flowing-wheel-fairing');
    surface(low ? 48 : 88, 6, (u, v) => {
      const z = tail + (nose - tail) * v;
      let bottom = .20;
      for (const wheelZ of [1.39, -1.47]) { const d = Math.abs(z - wheelZ); if (d < .425) bottom = Math.max(bottom, .367 + Math.sqrt(.425 ** 2 - d ** 2)); }
      return [side * outer(z), THREE.MathUtils.lerp(fairingHeight(z, 1), bottom, u), z];
    }, paint, 'open-wheel-arch-skin');
    surface(32, 4, (u, v) => { const z = tail + (nose - tail) * v; return [side * inner(z), THREE.MathUtils.lerp(.22, crown(z), u), z]; }, paint, 'inner-aero-channel');
    // Join the upper tub to the wheel shoulders with matched endpoint slopes.
    // The lower outboard cooling recess remains open beneath this painted deck.
    surface(low ? 48 : 88, 14, (u, v) => {
      const z = tail + (nose - tail) * v, bodyWidth = width(z);
      const startX = Math.min(bodyWidth * .62, inner(z) - .12), span = inner(z) - startX;
      const profile = Math.sqrt(1 - (startX / bodyWidth) ** 2);
      const startY = .20 + profile * (top(z) - .20), endY = fairingHeight(z, 0);
      const startSlope = -(top(z) - .20) * startX / (bodyWidth * bodyWidth * profile);
      const endSlope = .015 * Math.PI / (outer(z) - inner(z));
      const u2 = u * u, u3 = u2 * u;
      const y = (2 * u3 - 3 * u2 + 1) * startY + (u3 - 2 * u2 + u) * startSlope * span
        + (-2 * u3 + 3 * u2) * endY + (u3 - u2) * endSlope * span;
      return [side * (startX + span * u), y, z];
    }, paint, 'blended-upper-shoulder');
    for (const end of [tail, nose]) surface(8, 12, (u, v) => {
      const x = THREE.MathUtils.lerp(inner(end), outer(end), u);
      const rake = (end === nose ? 1 : -1) * .065 * Math.sin(u * Math.PI) * (1 - v);
      return [side * x, THREE.MathUtils.lerp(.20, fairingHeight(end, u), v), end + rake];
    }, paint, 'tapered-fairing-end');
    const skirt = box(.16, .055, 1.80, side * 1.055, .18, -.02, carbon, 'side-skirt'); skirt.rotation.z = side * .04;
    // Deep side intake and slatted louvres give the body scale and construction.
    patch([[side * 1.072, .23, .70], [side * 1.072, .40, .45], [side * 1.072, .46, -.88], [side * 1.072, .23, -.77]], dark, 'side-cooling-inlet');
    for (let i = 0; i < (attack ? 7 : 5); i++) {
      const z = 1.14 + i * .072, u = (.865 - inner(z)) / (outer(z) - inner(z)), y = fairingHeight(z, u) + .010;
      const slat = box(.26, .012, .027, side * .865, y, z, carbon, 'fender-extraction-louvre'); slat.rotation.y = side * -.16;
    }
    // Headlight pods face forward, with three small LED strips in each housing.
    const lightHeight = lowCanopy || enduranceFin ? .060 : singleSeat || offsetCockpit ? .075 : .125;
    box(.28, lightHeight, .055, side * .865, .408, nose - .007, dark, 'headlight-housing');
    if (extreme) for (let i = 0; i < 3; i++) box(.014, .092, .009, side * (.795 + i * .07), .408, nose + .024, headlights, 'vertical-led-headlight');
    else for (let i = 0; i < (lowCanopy || singleSeat || offsetCockpit || enduranceFin ? 2 : 3); i++) box(.22, .013, .009, side * .865, lowCanopy || singleSeat || offsetCockpit || enduranceFin ? .394 + i * .028 : .372 + i * .035, nose + .024, headlights, 'led-headlight');
    box(.39, .038, .025, side * .825, .44, tail - .008, lamps, 'rear-light-bar');
    // Two tiny mirrors with stalks, separate lenses and a restrained race accent.
    tube([[side * .49, .61, .35], [side * .62, .80, .23], [side * .77, .82, .22]], .012, carbon, 'mirror-stalk');
    const mirror = add(new THREE.SphereGeometry(1, 12, 8), paint, chassis, 'mirror-shell'); mirror.scale.set(.13, .065, .07); mirror.position.set(side * .79, .82, .22);
    box(.16, .057, .008, side * .79, .82, .145, trim, 'mirror-lens');
    // A recessed filler cap and fasteners break up the large painted panels.
    const cap = add(new THREE.CylinderGeometry(.050, .050, .014, 16), alloy, chassis, 'fuel-cap'); cap.position.set(side * .80, fairingHeight(-.5, (.80 - inner(-.5)) / (outer(-.5) - inner(-.5))) + .012, -.5);
  }
  // Splitter lips, front cooling mouth and rear diffuser vanes.
  const splitterHalf = extreme ? 1.24 : 1.11;
  patch([[-splitterHalf, .175, nose - .25], [-.94, .175, nose + .08], [0, .175, nose + .12], [.94, .175, nose + .08], [splitterHalf, .175, nose - .25]], carbon, 'front-splitter');
  patch([[-.43, .225, nose + .015], [-.38, .355, nose + .015], [.38, .355, nose + .015], [.43, .225, nose + .015]], dark, 'front-brake-duct');
  for (let i = -3; i <= 3; i++) box(.013, .16, .48, i * .24, .19, tail + .20, carbon, 'diffuser-vane');
  const wingHeight = enduranceFin ? 1.10 : offsetCockpit ? .87 : lowCanopy ? .94 : singleSeat ? .89 : extreme ? 1.13 : 1.02;
  const wingHalf = enduranceFin ? 1.18 : extreme ? 1.26 : singleSeat || offsetCockpit ? 1.03 : 1.11;
  for (const side of [-1, 1]) {
    box(.036, wingHeight - .52, .11, side * .66, (wingHeight + .42) / 2, tail + .31, carbon, 'wing-upright');
    box(.030, extreme ? .34 : .26, .50, side * wingHalf, wingHeight + .015, tail + .32, paint, 'wing-endplate');
  }
  surface(12, 28, (u, v) => [(u - .5) * wingHalf * 2, wingHeight + .055 * Math.sin(v * Math.PI), tail + .09 + v * (extreme ? .56 : .44)], carbon, 'sculpted-rear-wing');
  if (attack) surface(8, 24, (u, v) => [(u - .5) * wingHalf * 2, wingHeight + .125 + .028 * Math.sin(v * Math.PI), tail + .11 + v * .20], carbon, 'upper-wing-element');
  if (extreme) {
    for (const side of [-1, 1]) {
      // Swept dive planes, tall diffuser fences and roof-mounted swan necks
      // give the wide track body a functional, visibly separate aero package.
      for (const y of [.35, .51]) patch([[side * .98, y, 2.08], [side * 1.26, y - .055, 2.16], [side * 1.24, y - .025, 1.61], [side * 1.05, y + .04, 1.42]], carbon, 'stacked-front-dive-plane');
      patch([[side * 1.01, .20, -.62], [side * 1.24, .19, -.94], [side * 1.24, .36, tail + .17], [side * .99, .52, tail + .17]], carbon, 'rear-diffuser-fence');
      tube([[side * .38, .58, -1.18], [side * .38, 1.21, -1.80], [side * .38, 1.24, tail + .48]], .028, carbon, 'swan-neck-wing-support');
    }
  }

  if (!open) {
    // A low roof, long raked screen and separate rear fall-off give the cockpit
    // an automotive silhouette instead of one symmetric glass bubble.
    const canopyRear = enduranceFin ? -1.20 : lowCanopy ? -1.30 : extreme ? -1.15 : -1.02, canopyFront = enduranceFin ? .92 : lowCanopy ? .93 : 1.04;
    const roofRear = enduranceFin ? -.52 : lowCanopy ? -.62 : -.42, roofFront = enduranceFin ? .22 : lowCanopy ? .08 : .25;
    const roofHeight = enduranceFin ? 1.045 : lowCanopy ? .865 : extreme ? .945 : .995, sillHeight = lowCanopy ? .46 : .49;
    const canopyLength = canopyFront - canopyRear, canopyWidth = enduranceFin ? .425 : lowCanopy ? .365 : extreme ? .36 : .39;
    const canopy = (u, v) => {
      const z = canopyRear + v * canopyLength, across = u * 2 - 1;
      const rear = THREE.MathUtils.smoothstep(z, canopyRear, roofRear), front = THREE.MathUtils.smoothstep(z, roofFront, canopyFront);
      const roof = z < roofRear ? THREE.MathUtils.lerp(sillHeight + .04, roofHeight, rear) : z > roofFront ? THREE.MathUtils.lerp(roofHeight, sillHeight + .03, front) : roofHeight + .01 - .010 * ((z - (roofFront + roofRear) / 2) / ((roofFront - roofRear) / 2)) ** 2;
      const halfWidth = z < roofRear ? THREE.MathUtils.lerp(.22, canopyWidth, rear) : THREE.MathUtils.lerp(canopyWidth, canopyWidth - .04, front);
      return [across * halfWidth, sillHeight + (roof - sillHeight) * (1 - Math.abs(across) ** 4), z];
    };
    box(.57, .12, 1.05, 0, .52, -.03, dark, 'closed-cockpit-interior');
    const seat = box(.34, .34, .12, 0, .64, -.40, carbon, 'closed-cockpit-seat'); seat.rotation.x=-.16;
    surface(low ? 28 : 44, 28, canopy, glass, 'raked-glazed-cockpit');
    surface(12, 12, (u, v) => { const p = canopy(.20 + u * .60, (roofRear - canopyRear + v * (roofFront - roofRear)) / canopyLength); p[1] += .006; return p; }, paint, 'painted-cockpit-roof');
    for (const z of [roofRear, roofFront]) tube(Array.from({length: 25}, (_, i) => canopy(i / 24, (z - canopyRear) / canopyLength).map((n, index) => index === 1 ? n + .006 : n)), .012, paint, 'screen-header');
    for (const side of [-1, 1]) {
      const u = side < 0 ? .12 : .88;
      tube(Array.from({length: 25}, (_, i) => canopy(u, i / 24).map((n, index) => index === 1 ? n + .006 : n)), .010, paint, 'cockpit-pillar');
      tube([[side * (canopyWidth - .04), sillHeight + .01, canopyFront - .02], [side * canopyWidth, sillHeight, .10], [side * .24, sillHeight + .01, canopyRear + .03]], .014, carbon, 'cockpit-sill');
    }
    patch([[0, .55, canopyRear + .04], [0, enduranceFin ? 1.29 : lowCanopy || extreme ? roofHeight - .10 : .87, canopyRear - .22], [0, enduranceFin ? 1.29 : wingHeight - .05, tail + .49], [0, .53, tail + .30]], paint, 'stability-fin');
    if(enduranceFin){
      for(const side of [-1,1]){
        const deck=(x,z)=>.20+Math.sqrt(1-(x/width(z))**2)*(top(z)-.20);
        surface(18,10,(u,v)=>{const z=-1.24-v*.97,theta=u*Math.PI,x=side*.38+Math.cos(theta)*.11;return [x,deck(x,z)+.006+Math.sin(theta)*.16*(1-v*.55),z];},paint,'endurance-engine-intake');
        box(.16,.12,.018,side*.38,deck(side*.38,-1.23)+.075,-1.23,dark,'endurance-intake-mouth');
        for(let i=0;i<6;i++){const z=-2.24-i*.057,y=.504+.35*Math.exp(-Math.pow((z-1.39)/.74,4))+.35*Math.exp(-Math.pow((z+1.47)/.74,4));box(.30,.012,.032,side*.82,y,z,carbon,'rear-deck-extractor');}
      }
    }
  } else if (singleSeat || offsetCockpit) {
    const firstCockpitPart=chassis.children.length;
    // One narrow seat and a central faired roll structure change the body
    // section, not just the livery of the existing two-hoop sports racers.
    box(.48, .035, 1.03, 0, .535, .02, dark, 'single-seat-cockpit-opening');
    const seat = box(.32, .37, .11, 0, .67, -.34, carbon, 'single-bucket-seat'); seat.rotation.x = -.20;
    box(.32, .065, .42, 0, .55, -.04, carbon, 'single-seat-base');
    for (const side of [-1, 1]) {
      box(.045, .31, .020, side * .08, .69, -.27, accent, 'single-seat-harness');
      tube([[side * .255, .55, .56], [side * .265, .59, -.10], [side * .235, .63, -.45]], .026, paint, 'single-cockpit-coaming');
    }
    surface(28, 18, (u, v) => {
      const z = -.39 - v * 1.45, fade = 1 - THREE.MathUtils.smoothstep(v, .15, 1), theta = Math.PI * u;
      return [Math.cos(theta) * (.23 * fade + .06), .52 + Math.sin(theta) * .43 * fade, z];
    }, paint, 'tapered-central-headrest-fairing');
    tube([[-.17, .59, -.44], [-.17, .93, -.43], [0, 1.005, -.44], [.17, .93, -.43], [.17, .59, -.44]], .028, trim, 'single-rollover-hoop');
    surface(12, 20, (u, v) => { const theta = (u - .5) * Math.PI * .7; return [Math.sin(theta) * .29, .56 + v * .16, .54 - (1 - Math.cos(theta)) * .18 - v * .065]; }, glass, 'single-seat-aeroscreen');
    const wheel = add(new THREE.TorusGeometry(.12, .016, 8, 20), rubber, chassis, 'single-seat-steering-wheel'); wheel.position.set(0, .69, .25); wheel.rotation.x = -.28;
    box(.12, .055, .035, 0, .65, .45, dark, 'single-seat-dashboard');
    if(offsetCockpit){
      const cockpit=new THREE.Group();cockpit.name='offset-driver-cockpit';cockpit.position.x=.28;
      for(const part of chassis.children.slice(firstCockpitPart))cockpit.add(part);
      chassis.add(cockpit);batchStaticMeshes(cockpit);for(const mesh of cockpit.children)if(mesh.isMesh)geometry.push(mesh.geometry);
      // A smooth passenger-side cover and the offset headrest make the open
      // cockpit unmistakably asymmetric without altering its four-wheel track.
      surface(24,14,(u,v)=>{const z=-.56+v*1.20,x=-.54+u*.49;const theta=Math.acos(x/width(z));return [x,.22+Math.sin(theta)*(top(z)-.20),z];},paint,'passenger-tonneau');
    }
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
  for (const side of [-1, 1]) surface(20, 3, (u, v) => { const z = .96 + v * (nose - 1.08), x = side * (.07 + u * (attack ? .070 : .045)); const theta = Math.acos(x / width(z)); return [x, .204 + Math.sin(theta) * (top(z) - .20), z]; }, accent, 'nose-team-stripe');
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
  group.userData = {kind: 'original-prototype-coachwork', vehicle: model.id, bodyProfile: enduranceFin ? 'finned-endurance-long-tail' : offsetCockpit ? 'offset-driver-speedster' : lowCanopy ? 'low-canopy-long-tail' : singleSeat ? 'single-seat-speedster' : extreme ? 'wide-aero-prototype' : open ? 'open-sports-racer' : 'closed-prototype', dimensions: {length: nose + .12 - tail, width: extreme ? 2.56 : enduranceFin ? 2.40 : 2.25, height: extreme ? 1.35 : enduranceFin ? 1.30 : lowCanopy ? 1.07 : 1.18}, source: 'AppsOverFlow original body; credited vicent091036 GT wheels', license: 'CC BY 4.0 source wheels', effects: {rearAxle: -1.47, tyreOffset: .965, tyreWidth: .29, exhausts}};
  return {group, update, dispose};
}
