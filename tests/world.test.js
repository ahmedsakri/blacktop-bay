import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, getTrack, projectOnTrack, sampleTrack } from '../src/track.js';
import { grandstandLayout } from '../src/world.js';

test('all five circuits provide spectator stands whose full footprints clear the entire driving route', () => {
  for (const descriptor of TRACKS) {
    const track = getTrack(descriptor.id), stands = grandstandLayout(track);
    assert.ok(stands.length >= 2, `${track.name} needs trackside seating`);
    for (const stand of stands) {
      assert.ok(stand.footprint.length >= 50, 'check the full structure footprint, not only a centre point');
      for (const point of stand.footprint) {
        const distance = projectOnTrack(point.x, point.z, undefined, track).distance;
        assert.ok(distance >= track.width / 2 + 4.2, `${track.name} stand intrudes on the safety margin`);
      }
    }
  }
});

test('spectator stands stay separated and face the starting straight', () => {
  for (const descriptor of TRACKS) {
    const track = getTrack(descriptor.id), stands = grandstandLayout(track);
    for (let i = 0; i < stands.length; i++) {
      const stand = stands[i], road = sampleTrack(stand.distance, track);
      assert.ok(stand.distance >= 0 && stand.distance <= 100);
      const facing = stand.yaw - stand.side * Math.PI / 2;
      const dx = road.x - stand.x, dz = road.z - stand.z;
      assert.ok((Math.sin(facing) * dx + Math.cos(facing) * dz) / Math.hypot(dx, dz) > .999);
      for (let j = i + 1; j < stands.length; j++) {
        assert.ok(Math.hypot(stand.x - stands[j].x, stand.z - stands[j].z) > 22, 'covered stands must not overlap');
      }
    }
  }
});
