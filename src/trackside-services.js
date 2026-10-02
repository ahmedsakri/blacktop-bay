import * as THREE from 'three';
import { sampleTrack, projectOnTrack } from './track.js';

// These are physical, roadside event areas. Every footprint is checked against
// the whole route (including nearby hairpins), grandstands and landmarks.
export function tracksideServiceLayout(track, {stands = [], landmarks = [], low = false} = {}) {
  const sites = [], count = low ? 6 : 9;
  for (let i = 0; i < count; i++) {
    for (const delta of [0, .012, -.012, .026, -.026]) {
      const s = track.length * ((.17 + i * .79 / count + delta) % 1), p = sampleTrack(s, track), side = i % 2 ? 1 : -1;
      // Elevated roads already have authored bridges and hillside architecture.
      // Never grow an unsupported event area beside an open viaduct.
      if ((p.y || 0) > 1.3) continue;
      const radius = 4.7, offset = side * (track.width / 2 + radius + 5.2);
      const x = p.x + p.nx * offset, z = p.z + p.nz * offset;
      if (projectOnTrack(x, z, undefined, track).distance < track.width / 2 + radius + 4.4) continue;
      if (stands.some(site => Math.hypot(x - site.x, z - site.z) < radius + 16)) continue;
      if (landmarks.some(site => Math.hypot(x - site.x, z - site.z) < radius + site.radius + 4)) continue;
      if (sites.some(site => Math.hypot(x - site.x, z - site.z) < radius * 2 + 12)) continue;
      sites.push({x, z, y: p.y || 0, radius, s, yaw: Math.atan2(p.tx, p.tz), side, kind: i % 3 === 0 ? 'marshal' : 'fan-zone'}); break;
    }
  }
  return sites;
}

function flagGeometry() {
  const geometry=new THREE.PlaneGeometry(1,1,8,3),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const u=p.getX(i)+.5;p.setZ(i,Math.sin(u*5.4+p.getY(i)*1.6)*u*.11);p.setY(i,p.getY(i)-u*u*.065);}
  geometry.computeVertexNormals();return geometry;
}

function canopyGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1,0,-1, 1,0,-1, 0,.42,0, 1,0,-1, 1,0,1, 0,.42,0,
    1,0,1, -1,0,1, 0,.42,0, -1,0,1, -1,0,-1, 0,.42,0,
  ], 3));
  geometry.computeVertexNormals(); return geometry;
}

/** Original race services and fan pockets, five batched draws across a route.
 * People join the existing articulated crowd; props add no animation loop. */
export function createTracksideServices(scene, track, {low = false, stands = [], landmarks = [], crowd, rng = Math.random} = {}) {
  const sites = tracksideServiceLayout(track, {low, stands, landmarks});
  const group = new THREE.Group(); group.name = 'trackside-race-services'; scene.add(group);
  const pieces = new Map(), transform = new THREE.Object3D(), colour = new THREE.Color();
  const standard = new THREE.MeshStandardMaterial({color: 'white', roughness: .78, metalness: .18});
  const fabric = new THREE.MeshStandardMaterial({color: 'white', roughness: .97, side: THREE.DoubleSide});
  const metal = new THREE.MeshStandardMaterial({color: 'white', roughness: .39, metalness: .72});
  const geometries = {box: new THREE.BoxGeometry(1, 1, 1), metal: new THREE.BoxGeometry(1, 1, 1), roof: canopyGeometry(), cylinder: new THREE.CylinderGeometry(1, 1, 1, low ? 8 : 12), flag: flagGeometry()};
  const add = (site, kind, x, y, z, sx, sy, sz, color, ry = 0) => {
    const c = Math.cos(site.yaw), s = Math.sin(site.yaw);
    const list = pieces.get(kind) || []; list.push({x: site.x + c * x + s * z, y: site.y + y, z: site.z - s * x + c * z, sx, sy, sz, color, ry: site.yaw + ry}); pieces.set(kind, list);
  };
  let addedPeople = 0;
  for (const site of sites) {
    const marshal = site.kind === 'marshal', roofTint = marshal ? '#e1dfcf' : '#442773';
    add(site, 'box', 0, -.22, 0, 6.8, .45, 6.8, '#5a6061');
    for(const x of [-2.8,2.8])for(const z of [-2.8,2.8])add(site,'cylinder',x,-.92,z,.18,1.5,.18,'#606969');
    add(site, 'box', site.side * 1.1, .025, -.7, 3.7, .07, 4.6, '#8c9695');
    // A fabric pyramidal canopy with visible legs, valance, roof seams and a
    // service desk supplies an identifiable silhouette from the chase camera.
    add(site, 'roof', site.side * 1.1, 2.75, -.7, 2.05, 1.65, 2.35, roofTint);
    for (const x of [-.74, 2.94]) for (const z of [-2.83, 1.43]) add(site, 'metal', x * site.side, 1.37, z, .055, 2.75, .055, '#b2bebf');
    for (const x of [-.9, 3.1]) add(site, 'box', x * site.side, 2.66, -.7, .06, .21, 4.7, roofTint);
    for (const z of [-3.05, 1.65]) add(site, 'box', site.side * 1.1, 2.66, z, 4.1, .21, .055, roofTint);
    add(site, 'box', site.side * 1.1, .94, -2.0, 2.6, .09, .70, '#b3bab5');
    for (const x of [.1, 2.1]) add(site, 'metal', x * site.side, .48, -2, .055, .90, .52, '#5f6e73');
    add(site, 'box', site.side * 2.35, .36, .30, 1.10, .67, .8, '#25363f');
    add(site, 'metal', site.side * 2.35, .70, .30, 1.11, .045, .82, '#a0aaaa');
    for (const x of [1.86, 2.84]) add(site, 'metal', x * site.side, .36, .30, .026, .58, .83, '#79898e');
    // A low crowd rail is separated from both the road barrier and the people.
    for (const z of [-2.8, 0, 2.8]) add(site, 'metal', -site.side * 2.9, .65, z, .045, 1.30, .045, '#879397');
    for (const y of [.44, 1.09]) add(site, 'metal', -site.side * 2.9, y, 0, .045, .045, 5.7, '#b0babc');
    add(site, 'cylinder', site.side * 2.70, 2.08, 2.60, .035, 4.1, .035, '#bac3c1');
    add(site, 'flag', site.side * 2.70, 3.60, 2.20, .77, .90, 1, marshal ? '#fff71e' : '#9246ff', Math.PI / 2);
    if (marshal) {
      for (const z of [-.3, .15]) {
        add(site, 'cylinder', site.side * 2.7, .42, z, .11, .77, .11, '#b54435');
        add(site, 'metal', site.side * 2.7, .84, z, .13, .07, .07, '#222d34');
      }
    }
    const number = marshal ? 2 : low ? 3 : 5;
    for (let i = 0; i < number; i++) {
      const x = -site.side * (1.65 + (i % 2) * .12), z = -2.15 + i * 4.3 / Math.max(1, number - 1), c = Math.cos(site.yaw), s = Math.sin(site.yaw);
      if (crowd) { crowd.add(site.x + c * x + s * z, site.y + .02, site.z - s * x + c * z, site.yaw - site.side * Math.PI / 2 + (rng() - .5) * .13, false, rng, {role: marshal ? 'marshal' : 'spectator'}); addedPeople++; }
    }
  }
  for (const [kind, list] of pieces) {
    const mesh = new THREE.InstancedMesh(geometries[kind], kind === 'roof' || kind === 'flag' ? fabric : kind === 'metal' ? metal : standard, list.length);
    mesh.name = `race-services-${kind}`; mesh.receiveShadow = true;
    list.forEach((p, i) => { transform.position.set(p.x, p.y, p.z); transform.rotation.set(0, p.ry, 0); transform.scale.set(p.sx, p.sy, p.sz); transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix); mesh.setColorAt(i, colour.set(p.color)); });
    mesh.computeBoundingSphere(); group.add(mesh);
  }
  for (const [kind, geometry] of Object.entries(geometries)) if (!pieces.has(kind)) geometry.dispose();
  if (!pieces.size) { standard.dispose(); fabric.dispose(); metal.dispose(); }
  group.userData = {sites, drawCalls: pieces.size, addedPeople, animationLoops: 0};
  return group;
}
