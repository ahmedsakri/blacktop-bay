import * as THREE from 'three';
import { projectOnTrack } from './track.js';

const clamp = THREE.MathUtils.clamp;
const REAR_AXLE = -1.35, TYRE_OFFSET = .884, TYRE_WIDTH = .238;
const GROUND = .074, TAU = Math.PI * 2;
const cloudTint = new THREE.Color('#d6dfe6');
const mistTint = new THREE.Color('#b8d0df');
const exhaustTint = new THREE.Color('#a6b9c7');

// One small, softly lobed density texture supplies every cloud. It has no hard
// circular edge or bright centre, so neighbouring puffs merge into a plume.
function cloudTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d'), pixels = context.createImageData(128, 128);
  const lobes = [[-.23, .02, .26], [.17, -.12, .24], [.02, .21, .27], [-.05, -.21, .22], [.28, .17, .20], [-.28, -.20, .17]];
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = x / 127 - .5, v = y / 127 - .5;
    let density = 0;
    for (const [cx, cy, radius] of lobes) density += Math.exp(-((u - cx) ** 2 + (v - cy) ** 2) / (radius * radius) * 2.5) * .62;
    const edge = clamp((.50 - Math.hypot(u, v)) * 9, 0, 1);
    const grain = .93 + .04 * Math.sin(x * 1.71 + y * .87) + .03 * Math.cos(x * .61 - y * 1.43);
    const shade = Math.round(222 + (1 - y / 128) * 30), i = (y * 128 + x) * 4;
    pixels.data[i] = shade; pixels.data[i + 1] = shade; pixels.data[i + 2] = shade;
    pixels.data[i + 3] = Math.round(clamp(density * .94, 0, .94) * edge * grain * 255);
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function streakTexture(flame = false) {
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 64;
  const context = canvas.getContext('2d'), pixels = context.createImageData(32, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) {
    const u = (x / 31 - .5) * 2, v = y / 63, i = (y * 32 + x) * 4;
    const width = flame ? .30 + Math.sin(v * Math.PI) * .65 : .8;
    const alpha = Math.exp(-u * u / (width * width) * 4) * Math.sin(v * Math.PI) ** (flame ? .7 : .5);
    pixels.data[i] = 255; pixels.data[i + 1] = flame ? Math.round(95 + 150 * (1 - v)) : 255; pixels.data[i + 2] = flame ? Math.round(30 + 200 * (1 - v) ** 5) : 255;
    pixels.data[i + 3] = Math.round(alpha * 255);
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function particleBatch(scene, name, capacity, texture, additive = false) {
  const plane = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index; geometry.attributes.position = plane.attributes.position; geometry.attributes.uv = plane.attributes.uv;
  const positions = new Float32Array(capacity * 3), shapes = new Float32Array(capacity * 4), colors = new Float32Array(capacity * 3);
  geometry.setAttribute('particlePosition', new THREE.InstancedBufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('particleShape', new THREE.InstancedBufferAttribute(shapes, 4).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('particleColor', new THREE.InstancedBufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.instanceCount = capacity;
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: texture } }, transparent: true, depthWrite: false, depthTest: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `attribute vec3 particlePosition;attribute vec4 particleShape;attribute vec3 particleColor;varying vec2 vUv;varying vec4 vColor;
      void main(){vUv=uv;vColor=vec4(particleColor,particleShape.w);vec2 q=position.xy*particleShape.xy;float c=cos(particleShape.z),s=sin(particleShape.z);q=mat2(c,-s,s,c)*q;vec4 p=modelViewMatrix*vec4(particlePosition,1.);p.xy+=q;gl_Position=projectionMatrix*p;}`,
    fragmentShader: `uniform sampler2D map;varying vec2 vUv;varying vec4 vColor;
      void main(){vec4 texel=texture2D(map,vUv);float alpha=texel.a*vColor.a;if(alpha<.008)discard;gl_FragColor=vec4(texel.rgb*vColor.rgb,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.frustumCulled = false; mesh.renderOrder = additive ? 3 : 2; scene.add(mesh);
  const particles = Array.from({ length: capacity }, () => ({ age: 0, duration: 0 }));
  let cursor = 0, totalSpawned = 0;
  return {
    mesh, geometry, material, particles, capacity,
    emit(values) { const p = particles[cursor]; Object.assign(p, values, { age: 0 }); p.slot = cursor; cursor = (cursor + 1) % capacity; totalSpawned++; },
    flush(dt) {
      let visible = 0;
      for (let i = 0; i < capacity; i++) {
        const p = particles[i], shapeIndex = i * 4, offset = i * 3;
        if (p.duration <= 0) { shapes[shapeIndex] = shapes[shapeIndex + 1] = shapes[shapeIndex + 3] = 0; continue; }
        p.age += dt;
        if (p.age >= p.duration) { p.duration = 0; shapes[shapeIndex] = shapes[shapeIndex + 1] = shapes[shapeIndex + 3] = 0; continue; }
        const t = p.age / p.duration, damping = Math.exp(-p.drag * dt);
        p.vx = p.vx * damping + p.windX * dt; p.vz = p.vz * damping + p.windZ * dt; p.vy += p.gravity * dt;
        p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
        if (p.y < GROUND + .015) { p.y = GROUND + .015; p.vy = Math.abs(p.vy) * .18; }
        positions[offset] = p.x; positions[offset + 1] = p.y; positions[offset + 2] = p.z;
        const growth = 1 - (1 - t) ** 2;
        shapes[shapeIndex] = p.width + p.growX * growth; shapes[shapeIndex + 1] = p.height + p.growY * growth;
        shapes[shapeIndex + 2] = p.rotation + p.spin * p.age;
        const envelope = p.flash ? (1 - t) ** 1.7 : Math.min(1, t / .09) * (1 - t) ** 1.25;
        shapes[shapeIndex + 3] = p.alpha * envelope;
        colors[offset] = p.red; colors[offset + 1] = p.green; colors[offset + 2] = p.blue;
        visible++;
      }
      geometry.attributes.particlePosition.needsUpdate = true; geometry.attributes.particleShape.needsUpdate = true; geometry.attributes.particleColor.needsUpdate = true;
      mesh.visible = visible > 0; return visible;
    },
    clear() { for (const p of particles) p.duration = 0; shapes.fill(0); geometry.attributes.particleShape.needsUpdate = true; cursor = 0; totalSpawned = 0; mesh.visible = false; },
    get emitted() { return totalSpawned; },
  };
}

export function createEffects(scene, { low = false } = {}) {
  const cloud = cloudTexture(), streak = streakTexture(), flameTexture = streakTexture(true);
  const clouds = particleBatch(scene, 'tyre-smoke-and-exhaust', low ? 88 : 144, cloud);
  const spray = particleBatch(scene, 'wet-road-spray', low ? 52 : 88, streak);
  const sparks = particleBatch(scene, 'contact-sparks', low ? 24 : 40, streak, true);
  const flames = particleBatch(scene, 'exhaust-liftoff', low ? 4 : 8, flameTexture, true);
  const batches = [clouds, spray, sparks, flames];
  const maxMarks = low ? 420 : 720, markPositions = new Float32Array(maxMarks * 18), markUV = new Float32Array(maxMarks * 12), markBirth = new Float32Array(maxMarks * 6), markOpacity = new Float32Array(maxMarks * 6);
  const markGeometry = new THREE.BufferGeometry();
  markGeometry.setAttribute('position', new THREE.BufferAttribute(markPositions, 3).setUsage(THREE.DynamicDrawUsage));
  markGeometry.setAttribute('uv', new THREE.BufferAttribute(markUV, 2));
  markGeometry.setAttribute('birth', new THREE.BufferAttribute(markBirth, 1).setUsage(THREE.DynamicDrawUsage));
  markGeometry.setAttribute('strength', new THREE.BufferAttribute(markOpacity, 1).setUsage(THREE.DynamicDrawUsage));
  for (let i = 0; i < maxMarks; i++) markUV.set([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1], i * 12);
  markGeometry.setDrawRange(0, 0);
  const markMaterial = new THREE.ShaderMaterial({
    uniforms: { clock: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'attribute float birth;attribute float strength;varying vec2 vUv;varying float vBirth;varying float vStrength;void main(){vUv=uv;vBirth=birth;vStrength=strength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float clock;varying vec2 vUv;varying float vBirth;varying float vStrength;
      void main(){float edge=smoothstep(0.,.15,vUv.x)*smoothstep(0.,.15,1.-vUv.x);float grain=.81+.19*sin(vUv.x*49.+sin(vUv.y*13.));float fade=1.-smoothstep(2.8,7.0,clock-vBirth);float a=edge*grain*fade*vStrength;if(a<.01)discard;gl_FragColor=vec4(.006,.009,.012,a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const markMesh = new THREE.Mesh(markGeometry, markMaterial); markMesh.name = 'grounded-tyre-marks'; markMesh.frustumCulled = false; markMesh.renderOrder = 1; scene.add(markMesh);
  let clock = 0, markCount = 0, previousPose = null, previousThrottle = null, previousCollision = false, collisionCooldown = 0, flameCooldown = 0;
  let rearAxle = REAR_AXLE, tyreOffset = TYRE_OFFSET, tyreWidth = TYRE_WIDTH;
  let exhausts = [-.699,-.567,.567,.699].map(x=>({x,y:.385,z:-2.41}));
  let smokeDebt = 0, sprayDebt = 0, mistDebt = 0, exhaustDebt = 0, markAnchors = null;
  const live = { clouds: 0, spray: 0, sparks: 0, flames: 0 };
  const multiplier = low ? .65 : 1;
  function posePoint(pose, side, longitudinal) { const fx = Math.sin(pose.yaw), fz = Math.cos(pose.yaw); return { x: pose.x + fx * longitudinal + fz * side, z: pose.z + fz * longitudinal - fx * side }; }
  function emissionPose(car, fraction) {
    if (!previousPose) return car;
    const yaw = Math.atan2(Math.sin(car.yaw - previousPose.yaw), Math.cos(car.yaw - previousPose.yaw));
    return { x: previousPose.x + (car.x - previousPose.x) * fraction, z: previousPose.z + (car.z - previousPose.z) * fraction, yaw: previousPose.yaw + yaw * fraction };
  }
  function tint(color, brightness = 1) { return { red: color.r * brightness, green: color.g * brightness, blue: color.b * brightness }; }
  function smokeAt(car, pose, side, strength, mist = false) {
    const p = posePoint(pose, side * tyreOffset, rearAxle), fx = Math.sin(pose.yaw), fz = Math.cos(pose.yaw), size = mist ? .30 : .39;
    clouds.emit({ x: p.x + (Math.random() - .5) * .14, y: mist ? .16 : .20, z: p.z + (Math.random() - .5) * .14,
      vx: (car.vx || 0) * .10 - fx * .35 + fz * side * (.18 + strength * .36) + (Math.random() - .5) * .65,
      vz: (car.vz || 0) * .10 - fz * .35 - fx * side * (.18 + strength * .36) + (Math.random() - .5) * .65,
      vy: mist ? .16 + Math.random() * .16 : .44 + Math.random() * .23 + strength * .16,
      windX: .27, windZ: -.13, gravity: mist ? .015 : .10, drag: mist ? 1.9 : 1.1,
      width: size, height: size * .85, growX: mist ? .85 : 1.35 + strength * .52, growY: mist ? .42 : 1.15 + strength * .30,
      rotation: Math.random() * TAU, spin: (Math.random() - .5) * .30, duration: mist ? .5 + Math.random() * .2 : 1.15 + Math.random() * .32,
      alpha: mist ? .18 : .37 + strength * .17, flash: false, ...tint(mist ? mistTint : cloudTint, .9 + Math.random() * .13),
    });
  }
  function sprayAt(car, pose, side, intensity) {
    const p = posePoint(pose, side * tyreOffset, rearAxle - .15), fx = Math.sin(pose.yaw), fz = Math.cos(pose.yaw);
    spray.emit({ x: p.x, y: .13, z: p.z, vx: (car.vx || 0) * .14 - fx * (1.2 + Math.random() * 1.4) + fz * side * (.45 + Math.random() * .6), vz: (car.vz || 0) * .14 - fz * (1.2 + Math.random() * 1.4) - fx * side * (.45 + Math.random() * .6), vy: .6 + Math.random() * .9,
      windX: .15, windZ: -.1, gravity: -3.2, drag: 1.2, width: .024 + Math.random() * .025, height: .13 + Math.random() * .17, growX: .038, growY: .11,
      rotation: (Math.random() - .5) * 1.1, spin: (Math.random() - .5) * .8, duration: .28 + Math.random() * .20, alpha: .17 + intensity * .16, flash: false, ...tint(mistTint),
    });
  }
  function exhaustAt(car, pose, menu) {
    const outlet = exhausts[Math.floor(Math.random()*exhausts.length)], p = posePoint(pose, outlet.x, outlet.z), fx = Math.sin(pose.yaw), fz = Math.cos(pose.yaw);
    clouds.emit({ x: p.x, y: outlet.y, z: p.z, vx: (menu ? 0 : (car.vx || 0) * .07) - fx * (.38 + Math.random() * .2), vz: (menu ? 0 : (car.vz || 0) * .07) - fz * (.38 + Math.random() * .2), vy: .15 + Math.random() * .10,
      windX: .12, windZ: -.045, gravity: .035, drag: .5, width: .13, height: .13, growX: .38, growY: .37, rotation: Math.random() * TAU, spin: .14, duration: .72 + Math.random() * .28,
      alpha: menu ? .20 : .17, flash: false, ...tint(exhaustTint),
    });
  }
  function liftOff(car) {
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    for (const outlet of exhausts) {
      const p = posePoint(car, outlet.x, outlet.z);
      flames.emit({ x: p.x, y: outlet.y, z: p.z, vx: -fx * 3.2, vz: -fz * 3.2, vy: .04, windX: 0, windZ: 0, gravity: 0, drag: .3,
        width: .09, height: .25, growX: .04, growY: .10, rotation: (Math.random() - .5) * .35, spin: 0, duration: .10 + Math.random() * .065, alpha: .9, flash: true, red: 2.0, green: 1.6, blue: 1.4 });
    }
    flameCooldown = .85;
  }
  function contactBurst(car, contact) {
    const projection = projectOnTrack(car.x, car.z), side = Math.sign(projection.signedDistance) || 1;
    const nx = projection.nx * side, nz = projection.nz * side;
    const x = Number.isFinite(contact?.x) ? contact.x : car.x + nx * .96;
    const z = Number.isFinite(contact?.z) ? contact.z : car.z + nz * .96;
    const count = low ? 10 : 17;
    for (let i = 0; i < count; i++) sparks.emit({ x, y: .25 + Math.random() * .22, z,
      vx: (car.vx || 0) * .23 - nx * (1.0 + Math.random() * 3.0) + (Math.random() - .5) * 3,
      vz: (car.vz || 0) * .23 - nz * (1.0 + Math.random() * 3.0) + (Math.random() - .5) * 3,
      vy: .9 + Math.random() * 2.1, windX: 0, windZ: 0, gravity: -9.8, drag: .4, width: .021 + Math.random() * .016, height: .12 + Math.random() * .18, growX: -.008, growY: -.045,
      rotation: Math.random() * TAU, spin: (Math.random() - .5) * 8, duration: .22 + Math.random() * .28, alpha: .9, flash: true, red: 2.7, green: 1.25 + Math.random() * .7, blue: .24,
    });
    collisionCooldown = .36;
  }
  function addMark(a, b, strength) {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length < .015 || length > 2) return;
    const nx = dz / length * tyreWidth / 2, nz = -dx / length * tyreWidth / 2, slot = markCount % maxMarks, offset = slot * 18;
    markPositions.set([a.x - nx, GROUND, a.z - nz, a.x + nx, GROUND, a.z + nz, b.x - nx, GROUND, b.z - nz, a.x + nx, GROUND, a.z + nz, b.x + nx, GROUND, b.z + nz, b.x - nx, GROUND, b.z - nz], offset);
    markBirth.fill(clock, slot * 6, slot * 6 + 6); markOpacity.fill(.28 + strength * .38, slot * 6, slot * 6 + 6); markCount++;
  }
  function marksAt(car, strength) {
    const points = [-1, 1].map(side => posePoint(car, side * tyreOffset, rearAxle));
    if (!markAnchors) { markAnchors = points; return; }
    let changed = false;
    for (let side = 0; side < 2; side++) {
      const from = markAnchors[side], to = points[side], length = Math.hypot(to.x - from.x, to.z - from.z);
      if (length > 5) { markAnchors[side] = to; continue; }
      const count = Math.min(14, Math.floor(length / .38));
      if (!count) continue;
      for (let i = 1; i <= count; i++) { const fraction = Math.min(1, i * .38 / length), next = { x: from.x + (to.x - from.x) * fraction, z: from.z + (to.z - from.z) * fraction }; addMark(markAnchors[side], next, strength); markAnchors[side] = next; changed = true; }
    }
    if (changed) { markGeometry.attributes.position.needsUpdate = true; markGeometry.attributes.birth.needsUpdate = true; markGeometry.attributes.strength.needsUpdate = true; markGeometry.setDrawRange(0, Math.min(markCount, maxMarks) * 6); }
  }
  function clear() {
    for (const batch of batches) batch.clear();
    clock = 0; markCount = 0; previousPose = null; previousThrottle = null; previousCollision = false; collisionCooldown = 0; flameCooldown = 0;
    smokeDebt = sprayDebt = mistDebt = exhaustDebt = 0; markAnchors = null;
    markGeometry.setDrawRange(0, 0); markMaterial.uniforms.clock.value = 0;
    live.clouds = live.spray = live.sparks = live.flames = 0;
  }
  clear();
  return {
    clear,
    get stats() { return { ...live, marks: Math.min(markCount, maxMarks), emitted: clouds.emitted + spray.emitted + sparks.emitted + flames.emitted, budget: { clouds: clouds.capacity, spray: spray.capacity, sparks: sparks.capacity, flames: flames.capacity, marks: maxMarks } }; },
    update(car, dt, time, active, controls = {}) {
      const profile = controls.profile;
      if (profile) {
        rearAxle = profile.rearAxle; tyreOffset = profile.tyreOffset; tyreWidth = profile.tyreWidth;
        // An empty list is intentional for electric cars and models without
        // verified outlets; never reuse the previous car's exhaust positions.
        if (Array.isArray(profile.exhausts)) exhausts = profile.exhausts;
      }
      const menu = controls.menu === true && !active;
      // Pauses freeze the plumes and mark age as well as stopping emitters.
      if ((!active && !menu) || !car || !Number.isFinite(car.x) || !Number.isFinite(car.z) || !Number.isFinite(car.yaw)) return;
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .08); if (!dt) return;
      clock += dt; markMaterial.uniforms.clock.value = clock; collisionCooldown = Math.max(0, collisionCooldown - dt); flameCooldown = Math.max(0, flameCooldown - dt);
      const moved = previousPose ? Math.hypot(car.x - previousPose.x, car.z - previousPose.z) : 0;
      if (moved > Math.max(8, (car.speed || 0) * dt * 4)) { previousPose = null; markAnchors = null; smokeDebt = sprayDebt = mistDebt = 0; }
      const speed = active ? Math.max(0, Number.isFinite(car.speed) ? car.speed : Math.hypot(car.vx || 0, car.vz || 0)) : 0;
      const braking = Boolean(controls.brake), handbrake = Boolean(controls.handbrake);
      const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
      const lateral = Math.abs(Number.isFinite(car.lateralSpeed) ? car.lateralSpeed : (car.vx || 0) * fz - (car.vz || 0) * fx);
      const slip = Math.abs(Number.isFinite(car.slipAngle) ? car.slipAngle : Math.atan2(lateral, Math.max(speed, 1)));
      const intensity = speed > 3 ? clamp(Math.max((lateral - .75) / 5, (slip - .06) * 2.3, handbrake ? .7 + speed / 100 : 0, braking ? .35 + speed / 120 : 0, car.drifting ? .6 : 0), 0, 1) : 0;
      const wet = active ? clamp((speed - 5) / 22, 0, 1) : 0;
      if (active && intensity > .04) {
        smokeDebt += (12 + intensity * 34) * clamp(speed / 12, .25, 1) * multiplier * dt;
        const count = Math.floor(smokeDebt); smokeDebt -= count;
        for (let i = 0; i < count; i++) { const pose = emissionPose(car, (i + .5) / count); for (const side of [-1, 1]) smokeAt(car, pose, side, intensity); }
        marksAt(car, intensity);
      } else { smokeDebt = 0; markAnchors = null; }
      if (wet > 0) {
        sprayDebt += (8 + speed * 1.08) * wet * multiplier * dt;
        let count = Math.floor(sprayDebt); sprayDebt -= count;
        for (let i = 0; i < count; i++) { const pose = emissionPose(car, (i + .5) / count); for (const side of [-1, 1]) sprayAt(car, pose, side, wet); }
        mistDebt += 8 * wet * (1 - intensity * .82) * multiplier * dt;
        count = Math.floor(mistDebt); mistDebt -= count;
        for (let i = 0; i < count; i++) { const pose = emissionPose(car, (i + .5) / count); for (const side of [-1, 1]) smokeAt(car, pose, side, wet, true); }
      } else { sprayDebt = mistDebt = 0; }
      if (exhausts.length) {
        exhaustDebt += (menu ? 2.0 : speed < 3 ? 2.6 : 1.6) * dt;
        const exhaustCount = Math.floor(exhaustDebt); exhaustDebt -= exhaustCount;
        for (let i = 0; i < exhaustCount; i++) exhaustAt(car, emissionPose(car, (i + .5) / exhaustCount), menu);
      } else exhaustDebt = 0;
      const throttle = active ? braking ? 0 : clamp(controls.throttle ?? 1, 0, 1) : 0;
      if (exhausts.length && active && speed > 11 && previousThrottle !== null && previousThrottle > .55 && throttle < .25 && flameCooldown <= 0) liftOff(car);
      previousThrottle = throttle;
      const collision = active && Boolean(controls.collision);
      if (collision && !previousCollision && collisionCooldown <= 0 && speed > 1.5) contactBurst(car, controls.collision);
      previousCollision = collision;
      live.clouds = clouds.flush(dt); live.spray = spray.flush(dt); live.sparks = sparks.flush(dt); live.flames = flames.flush(dt);
      previousPose = { x: car.x, z: car.z, yaw: car.yaw };
    },
    destroy() { for (const batch of batches) { scene.remove(batch.mesh); batch.geometry.dispose(); batch.material.dispose(); } scene.remove(markMesh); markGeometry.dispose(); markMaterial.dispose(); cloud.dispose(); streak.dispose(); flameTexture.dispose(); },
  };
}
