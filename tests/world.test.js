import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, getTrack, projectOnTrack, sampleTrack } from '../src/track.js';
import { grandstandLayout, getVenueProfile, venueSceneryLayout } from '../src/world.js';

test('all circuits provide spectator stands whose full footprints clear the entire driving route', () => {
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

test('new inland settings replace bay water with distinct terrain and lighting while the original five stay unchanged', () => {
  for(const id of ['harbor','dockyard','coast','summit','grandprix']){
    const profile=getVenueProfile(getTrack(id));
    assert.equal(profile.original,true);
    assert.equal(profile.sun,'#ffb679');
    assert.equal(profile.skyStyle,0);
    assert.equal(profile.horizonRadius,990);
  }
  const desert=getVenueProfile(getTrack('sakhir')),city=getVenueProfile(getTrack('singapore'));
  const park=getVenueProfile(getTrack('silverstone')),coast=getVenueProfile(getTrack('monaco'));
  assert.equal(desert.environment,'desert');assert.equal(desert.water,false);assert.equal(desert.towers,0);
  assert.equal(city.environment,'urban');assert.equal(city.night,true);assert.equal(city.water,false);
  assert.equal(park.environment,'parkland');assert.equal(park.vegetation,'woodland');assert.equal(park.water,false);
  assert.equal(coast.water,true);assert.equal(coast.vegetation,'palms');
  assert.equal(new Set([desert.ground,city.ground,park.ground,coast.ground]).size,4);
  for(const descriptor of TRACKS){
    const track=getTrack(descriptor.id),profile=getVenueProfile(track);
    assert.ok(track.samples.every(p=>Math.hypot(p.x-profile.centerX,p.z-profile.centerZ)<profile.groundRadius-100));
  }
});

test('destination lighting and vegetation override generic venue scenery without SF palms',()=>{
 const fuji=getVenueProfile(getTrack('fuji-skyline'));
 const singapore=getVenueProfile(getTrack('singapore-afterdark'));
 const norway=getVenueProfile(getTrack('norway-fjord'));
 const sanFrancisco=getVenueProfile(getTrack('san-francisco-hills'));
 assert.equal(fuji.vegetation,'woodland');assert.equal(fuji.towers,0);
 assert.equal(singapore.vegetation,'street-trees');assert.equal(singapore.towers,55);
 assert.equal(norway.vegetation,'conifers');assert.equal(norway.towers,0);
 assert.equal(sanFrancisco.vegetation,'street-trees');assert.equal(sanFrancisco.towers,24);
 assert.equal(new Set([fuji,singapore,norway,sanFrancisco].map(profile=>profile.background)).size,4);
});

test('new scenery is deterministic, bounded on phones, and clears the full route and spectator footprints', () => {
  for(const descriptor of TRACKS){
    const track=getTrack(descriptor.id),profile=getVenueProfile(track),items=venueSceneryLayout(track,{low:true});
    if(profile.original){assert.deepEqual(items,[]);continue;}
    assert.ok(items.length<=74);
    assert.ok(items.length>=5,`${track.name} needs identifiable surroundings`);
    const stands=grandstandLayout(track);
    for(const item of items){
      assert.ok(projectOnTrack(item.x,item.z,undefined,track).distance>=track.width/2+item.radius+7,`${track.name} scenery touches the driving route`);
      for(const stand of stands)assert.ok(Math.hypot(item.x-stand.x,item.z-stand.z)>=item.radius+14,`${track.name} scenery intrudes into a spectator stand`);
    }
  }
  const track=getTrack('singapore');
  assert.deepEqual(venueSceneryLayout(track,{low:true}),venueSceneryLayout(track,{low:true}));
});
