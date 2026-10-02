import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCarDamage} from '../src/car-damage.js';

function fixture() {
  const source = new THREE.BoxGeometry(1.8, .9, 4.4, 20, 12, 40);
  const paint = new THREE.MeshStandardMaterial({color: '#cc2244'}); paint.userData.bodyPaint = true;
  const world = new THREE.Scene(), group = new THREE.Group(), body = new THREE.Group();
  world.add(group); group.add(body);
  const mesh = new THREE.Mesh(source, paint); mesh.position.y = .75; body.add(mesh);
  const damage = createCarDamage(group, body);
  const impact = {id: 1, kind: 'crash', severity: 'wreck', remaining: .8, strength: 1,
    localX: -.9, localZ: .3, localNX: 1, localNZ: 0, nx: 1, nz: 0, y: 0};
  const input = {impact, recovery: {id: 0}, raceId: 'test-race', car: {vx: 8, vz: 4}};
  return {source, paint, world, group, body, mesh, damage, input};
}

test('a severe hit dents owned body vertices and severs actual triangles without touching another instance or source', () => {
  const f = fixture(), other = new THREE.Mesh(f.source, f.paint), before = f.source.attributes.position.array.slice();
  const sourceTriangles = f.source.index.count / 3;
  assert.equal(f.group.getObjectByName('crash-undertray'), undefined, 'an undamaged car retains only its original source geometry');
  f.damage.update(f.input, 1 / 60);
  assert.ok(f.group.getObjectByName('crash-undertray'), 'a severe crash adds underside support only when needed');
  assert.notEqual(f.mesh.geometry, f.source); assert.equal(other.geometry, f.source);
  assert.deepEqual(f.source.attributes.position.array, before);
  assert.ok(f.damage.stats.vertices > 0); assert.ok(f.damage.stats.dents > 0);
  const fragments = f.world.getObjectByName('detached-body-fragments');
  assert.equal(f.damage.stats.fragments, 2); assert.equal(fragments.children.length, 2);
  const removed = sourceTriangles - f.mesh.geometry.index.count / 3;
  const severed = fragments.children.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count / 3, 0);
  assert.equal(removed, severed); assert.ok(severed > 0 && severed <= 4096);
  assert.ok(fragments.children.every(mesh => mesh.material !== f.paint));
  const identity = f.mesh.geometry;
  f.damage.update(f.input, 1 / 60); assert.equal(f.damage.stats.dents, 1, 'one impact cannot cut the body on every render frame');
  assert.equal(f.mesh.geometry, identity);
  f.damage.dispose(); assert.equal(f.mesh.geometry, f.source); assert.equal(f.world.children.length, 1);
});

test('pause freezes debris, reduced motion keeps a static dent, and reset/new race restores pristine geometry', () => {
  const f = fixture(); f.damage.update(f.input, 1 / 60);
  const fragments = f.world.getObjectByName('detached-body-fragments');
  const positions = fragments.children.map(mesh => [mesh.position.toArray(), mesh.quaternion.toArray()]);
  for (let i = 0; i < 20; i++) f.damage.update({...f.input, active: false, paused: true}, .06);
  assert.deepEqual(fragments.children.map(mesh => [mesh.position.toArray(), mesh.quaternion.toArray()]), positions);
  f.damage.update({...f.input, reducedMotion: true}, 1 / 60); assert.equal(f.damage.stats.fragments, 0);
  assert.notEqual(f.mesh.geometry, f.source);
  f.damage.update({...f.input, recovery: {id: 1}, impact: {...f.input.impact, remaining: 0}}, 1 / 60);
  assert.equal(f.mesh.geometry, f.source); assert.equal(f.damage.stats.dents, 0);
  assert.equal(f.group.getObjectByName('crash-undertray'), undefined, 'recovery removes the temporary crash geometry');
  f.damage.update({...f.input, raceId: 'second-race'}, 1 / 60); assert.notEqual(f.mesh.geometry, f.source);
  f.damage.update({...f.input, active: false}, 1 / 60); assert.equal(f.mesh.geometry, f.source);
  f.damage.dispose();
});

test('heavy impacts remain drivable dents without fragmentation, and memory/fragment lifetime stays bounded', () => {
  const f = fixture();
  f.damage.update({...f.input, impact: {...f.input.impact, severity: 'heavy'}}, 1 / 60);
  assert.equal(f.damage.stats.dents, 1); assert.equal(f.damage.stats.fragments, 0);
  for (let id = 2; id < 15; id++) f.damage.update({...f.input, impact: {...f.input.impact, id}}, 1 / 60);
  assert.equal(f.damage.stats.dents, 3); assert.ok(f.damage.stats.fragments <= 2);
  for (let i = 0; i < 180; i++) f.damage.update({...f.input, impact: {...f.input.impact, id: 14}}, 1 / 60);
  assert.equal(f.damage.stats.fragments, 0);
  f.damage.dispose();
});

test('reduced motion applies visible damage without spawning detached animation', () => {
  const f = fixture(); f.damage.update({...f.input, reducedMotion: true}, 1 / 60);
  assert.equal(f.damage.stats.dents, 1); assert.equal(f.damage.stats.fragments, 0);
  assert.equal(f.source.index.count, f.mesh.geometry.index.count);
  f.damage.dispose();
});
