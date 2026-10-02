import * as THREE from 'three';

const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : a));
const point = new THREE.Vector3(), local = new THREE.Vector3();
const MAX_HITS = 3, MAX_FRAGMENTS = 2, MAX_PATCH_TRIANGLES = 2048;

/** Instance-owned damage. Body geometry stays shared until the first hit, then
 * only affected surfaces are cloned. A severe hit can sever two small patches
 * of those actual surfaces; this does not invent separately authored panels. */
export function createCarDamage(group, body, {low = false} = {}) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert(), surfaces = [];
  body.traverse(mesh => {
    if (!mesh.isMesh || !mesh.geometry?.attributes.position || mesh.isSkinnedMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.every(material => material.transparent || /glass|lamp|light|chrome|interior/i.test(material.name))) return;
    const matrix = inverse.clone().multiply(mesh.matrixWorld);
    surfaces.push({mesh, source: mesh.geometry, owned: null, matrix, inverse: matrix.clone().invert(),
      painted: materials.some(material => material.userData.bodyPaint), material: materials.length === 1 ? materials[0] : null});
  });
  const painted = surfaces.filter(surface => surface.painted);
  const candidates = painted.length ? painted : surfaces;
  // Some licensed exterior-only sources have no underside. A restrained
  // original undertray closes that void when a wreck exposes the floor; it is
  // not presented as detailed, source-authored manufacturer mechanics.
  const dimensions = group.userData.dimensions || {width: 2, length: 4.5};
  let undertray = null;
  function showUndertray() {
    if (undertray) return;
    undertray = new THREE.Mesh(new THREE.BoxGeometry(dimensions.width * .74, .04, dimensions.length * .77),
      new THREE.MeshStandardMaterial({color: '#11141b', roughness: .88, metalness: .12}));
    undertray.name = 'crash-undertray'; undertray.position.y = .20; body.add(undertray);
  }
  const debris = new THREE.Group(); debris.name = 'detached-body-fragments';
  const fragments = [];
  let identity, impactId = 0, recoveryId = 0, hits = 0, disposed = false;
  const stats = {dents: 0, detached: 0, fragments: 0, vertices: 0};

  function clearFragments() {
    for (const fragment of fragments) { fragment.mesh.geometry.dispose(); fragment.mesh.material.dispose(); }
    fragments.length = 0; debris.clear(); debris.removeFromParent(); stats.fragments = 0;
  }
  function restore() {
    for (const surface of candidates) if (surface.owned) {
      surface.mesh.geometry = surface.source; surface.owned.dispose(); surface.owned = null;
    }
    clearFragments();
    if (undertray) {
      undertray.removeFromParent(); undertray.geometry.dispose(); undertray.material.dispose(); undertray = null;
    }
    hits = 0; stats.dents = stats.detached = stats.vertices = 0;
  }
  function own(surface) {
    if (!surface.owned) { surface.owned = surface.source.clone(); surface.mesh.geometry = surface.owned; }
    return surface.owned;
  }
  function closestSurface(target) {
    let nearest = null, distance = Infinity;
    for (const surface of candidates) {
      if (!surface.material) continue;
      const position = (surface.owned || surface.source).attributes.position;
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(surface.matrix);
        if (point.y < .22) continue;
        const d = point.distanceToSquared(target);
        if (d < distance) { distance = d; nearest = {surface, center: point.clone()}; }
      }
    }
    return distance < 3 ? nearest : null;
  }
  function dent(target, normal, strength) {
    const radius = .85 + strength * .5, depth = .07 + strength * .20;
    let changed = 0;
    for (const surface of candidates) {
      const position = (surface.owned || surface.source).attributes.position;
      let geometry = surface.owned, count = 0;
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(surface.matrix);
        const distance = point.distanceTo(target);
        if (distance >= radius || point.y < .22) continue;
        geometry ||= own(surface);
        const falloff = (1 - distance / radius) ** 2;
        // A broad inward dent plus a restrained folded edge; maximum offsets
        // remain small enough to keep the original silhouette recognizable.
        point.addScaledVector(normal, depth * falloff);
        point.y += Math.sin(point.z * 18 + point.x * 13) * depth * .18 * falloff;
        local.copy(point).applyMatrix4(surface.inverse);
        geometry.attributes.position.setXYZ(i, local.x, local.y, local.z); count++;
      }
      if (count) {
        geometry.attributes.position.needsUpdate = true; geometry.computeVertexNormals();
        geometry.computeBoundingBox(); geometry.computeBoundingSphere(); changed += count;
      }
    }
    if (changed) { stats.dents++; stats.vertices += changed; }
  }
  function detach(target, impact, car, strength, ordinal) {
    if (fragments.length >= MAX_FRAGMENTS) return;
    const selected = closestSurface(target);
    if (!selected) return;
    const {surface, center} = selected, geometry = own(surface), position = geometry.attributes.position;
    const indices = geometry.index?.array || Array.from({length: position.count}, (_, i) => i);
    const kept = [], detached = [], radius = .28 + strength * .1;
    // Test full triangles against a compact radius. The bounded patch budget
    // also caps debris draw cost on the densest imported source body.
    for (let i = 0; i + 2 < indices.length; i += 3) {
      let distance = 0;
      for (let k = 0; k < 3; k++) {
        point.fromBufferAttribute(position, indices[i + k]).applyMatrix4(surface.matrix);
        distance = Math.max(distance, point.distanceToSquared(center));
      }
      (distance < radius * radius && detached.length < (low ? 1024 : MAX_PATCH_TRIANGLES) * 3 ? detached : kept)
        .push(indices[i], indices[i + 1], indices[i + 2]);
    }
    if (!detached.length) return;
    const vertices = [], normals = [], uvs = [], normalMatrix = new THREE.Matrix3().getNormalMatrix(surface.matrix);
    for (const i of detached) {
      point.fromBufferAttribute(position, i).applyMatrix4(surface.matrix).sub(center); vertices.push(...point.toArray());
      if (geometry.attributes.normal) { point.fromBufferAttribute(geometry.attributes.normal, i).applyMatrix3(normalMatrix).normalize(); normals.push(...point.toArray()); }
      if (geometry.attributes.uv) uvs.push(geometry.attributes.uv.getX(i), geometry.attributes.uv.getY(i));
    }
    const patch = new THREE.BufferGeometry(); patch.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    if (normals.length) patch.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); else patch.computeVertexNormals();
    if (uvs.length) patch.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const material = surface.material.clone(); material.side = THREE.DoubleSide;
    material.onBeforeCompile = surface.material.onBeforeCompile;
    material.customProgramCacheKey = surface.material.customProgramCacheKey;
    const mesh = new THREE.Mesh(patch, material); mesh.name = 'severed-body-surface'; mesh.castShadow = !low;
    group.updateMatrixWorld(true); mesh.position.copy(center).applyMatrix4(group.matrixWorld);
    group.getWorldQuaternion(mesh.quaternion);
    debris.add(mesh); if (group.parent) group.parent.add(debris);
    // Removing exactly the extracted triangles leaves a real hole in this
    // instance. Other cars and the immutable source retain all their triangles.
    geometry.setIndex(kept);
    fragments.push({mesh, age: 0, floor: Number.isFinite(impact.y) ? impact.y : 0,
      vx: (car?.vx || 0) * .22 - (impact.nx || 0) * (1.7 + ordinal) + (impact.nz || 0) * .8,
      vz: (car?.vz || 0) * .22 - (impact.nz || 0) * (1.7 + ordinal) - (impact.nx || 0) * .8, vy: 2.8 + ordinal * .7,
      spin: new THREE.Vector3(2.4 + ordinal, 1.3 - ordinal, 3.2 - ordinal)});
    stats.detached++; stats.fragments = fragments.length;
  }
  return {
    stats,
    update({impact, recovery, raceId, car, active = true, paused = false, reducedMotion = false} = {}, dt = 0) {
      if (disposed) return;
      if (identity !== raceId || (recovery?.id || 0) !== recoveryId || !active && !paused) {
        restore(); identity = raceId; recoveryId = recovery?.id || 0; impactId = !active ? impact?.id || 0 : 0;
      }
      if (paused) return;
      if (reducedMotion && fragments.length) clearFragments();
      if (active && impact?.id > impactId) {
        impactId = impact.id;
        if (impact.kind === 'crash' && impact.remaining > 0 && hits < MAX_HITS) {
          const normal = new THREE.Vector3(impact.localNX || 0, 0, impact.localNZ || 0);
          if (normal.lengthSq() > .1) {
            normal.normalize(); hits++;
            const strength = clamp(impact.strength, .2, 1);
            const target = new THREE.Vector3(impact.localX || 0, .65, impact.localZ || 0);
            const nearest = closestSurface(target); if (nearest) target.copy(nearest.center);
            dent(target, normal, strength);
            if (impact.severity === 'wreck' && !reducedMotion) {
              showUndertray();
              detach(target, impact, car, strength, 0);
              const tangent = new THREE.Vector3(-normal.z, 0, normal.x);
              detach(target.clone().addScaledVector(tangent, .58).setY(target.y + .12), impact, car, strength, 1);
            }
          }
        }
      }
      const step = active ? clamp(dt, 0, .06) : 0;
      for (let i = fragments.length - 1; i >= 0; i--) {
        const fragment = fragments[i], mesh = fragment.mesh; fragment.age += step;
        if (fragment.age > 2.5) {
          mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose(); fragments.splice(i, 1); continue;
        }
        fragment.vy -= step * 15;
        mesh.position.x += fragment.vx * step; mesh.position.z += fragment.vz * step; mesh.position.y += fragment.vy * step;
        if (mesh.position.y < fragment.floor + .08) {
          mesh.position.y = fragment.floor + .08; fragment.vy = Math.abs(fragment.vy) > .6 ? -fragment.vy * .23 : 0;
          fragment.vx *= Math.exp(-step * 7); fragment.vz *= Math.exp(-step * 7); fragment.spin.multiplyScalar(Math.exp(-step * 9));
        }
        mesh.rotation.x += fragment.spin.x * step; mesh.rotation.y += fragment.spin.y * step; mesh.rotation.z += fragment.spin.z * step;
        mesh.scale.setScalar(1 - clamp((fragment.age - 2.1) / .4, 0, 1));
      }
      stats.fragments = fragments.length;
    },
    dispose() { if (disposed) return; restore(); disposed = true; },
  };
}
