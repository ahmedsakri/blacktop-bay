import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, getTrack, projectOnTrack, sampleTrack } from '../src/track.js';
import {venueLighting,VENUE_REGIONS} from '../src/showcase-lighting.js';
import { grandstandLayout, getVenueProfile, venueSceneryLayout,usesPineTrees,summitPineLayout } from '../src/world.js';
import {forestMarginLayout} from '../src/roadside-planting.js';
import {showcaseLayout} from '../src/showcase-venues.js';

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

test('inland settings replace bay water while original terrain stays intact and all lighting follows coordinated regional grades', () => {
  for(const id of ['harbor','dockyard','coast','summit','grandprix']){
    const profile=getVenueProfile(getTrack(id));
    assert.equal(profile.original,true);
    if(id==='harbor')assert.deepEqual([profile.sun,profile.sky,profile.fill,profile.sunlight],['#ffd3a0','#9cb9d9','#9fc9ed',1.28],'Harbor uses the coordinated coastal showcase finish');
    else assert.equal(profile.sun,venueLighting(getTrack(id)).sun,`${id} uses its coordinated regional sunlight`);
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
 assert.equal(sanFrancisco.vegetation,'street-trees');assert.equal(sanFrancisco.towers,0,'continuous hillside homes replace detached random bay towers');
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

test('every current circuit has an explicit coordinated regional lighting grade',()=>{
 assert.equal(Object.keys(VENUE_REGIONS).length,TRACKS.length);
 const regions=new Set();
 for(const {id} of TRACKS){
  const track=getTrack(id),profile=getVenueProfile(track),grade=venueLighting(track);regions.add(profile.lightingRegion);
  for(const key of ['sky','bounce','sun','fill','fog','environmentIntensity','backdropTint','backdropExposure'])assert.equal(profile[key],grade[key],id+' '+key);
  assert.ok(profile.environmentIntensity>=.6&&profile.environmentIntensity<=.85);
  assert.ok(profile.sunlight>=.8&&profile.sunlight<=2.4);
 }
 assert.equal(regions.size,8,'coherent regional treatment is richer than three special cases');
});

test('pine routing covers the three conifer populations without replacing any broadleaf forest margins',()=>{
 const selected=TRACKS.filter(({id})=>usesPineTrees(getTrack(id))).map(t=>t.id).sort();
 assert.deepEqual(selected,['cedar-ridge','norway-fjord','summit']);
 for(const id of selected){const track=getTrack(id),venue=getVenueProfile(track);for(const low of [true,false])assert.deepEqual(forestMarginLayout(track,venue,{low}),[],'pine routes have no mixed broadleaf margin candidates');}
 for(const id of ['fuji-skyline','san-francisco-hills'])assert.equal(usesPineTrees(getTrack(id)),false,'existing photographic broadleaf populations keep their own source');
});

test('Summit pine replacement tags every trunk and all three boughs, with complete footprints clear of roads and structures',()=>{
 const track=getTrack('summit'),stands=grandstandLayout(track),landmarks=showcaseLayout(track,{stands});
 for(const low of [true,false]){
  const layout=summitPineLayout(track,{low,stands,landmarks});assert.deepEqual(layout,summitPineLayout(track,{low,stands,landmarks}));
  assert.ok(layout.candidates.length>(low?100:150));assert.ok(layout.candidates.length<(low?170:250));
  assert.equal(layout.trunks.length,layout.candidates.length);assert.equal(layout.foliage.length,layout.candidates.length*3);
  assert.equal(new Set(layout.candidates.map(p=>p.treeId)).size,layout.candidates.length);
  for(const p of layout.candidates){
   assert.ok(p.treeId>=20000,'Summit IDs cannot collide with ordinary scenery or broadleaf margin IDs');
   assert.ok(projectOnTrack(p.x,p.z,undefined,track).distance-p.radius>=track.width/2+8,'the full fitted crown stays beyond the driving margin');
   assert.ok(stands.every(s=>Math.hypot(p.x-s.x,p.z-s.z)>=14));assert.ok(landmarks.every(s=>Math.hypot(p.x-s.x,p.z-s.z)>=s.radius+6));
   const trunk=layout.trunks.find(t=>t.treeId===p.treeId),boughs=layout.foliage.filter(t=>t.treeId===p.treeId);
   assert.equal(boughs.length,3);assert.equal(trunk.x,p.x);assert.equal(trunk.z,p.z);assert.ok(Math.abs(trunk.y-trunk.sy/2)<1e-12,'trunk starts at the candidate root');
   assert.ok(boughs.every(t=>t.x===p.x&&t.z===p.z&&t.sx<=p.radius&&t.sz<=p.radius));
   assert.ok(Math.abs(Math.max(...boughs.map(t=>t.y+t.sy/2))-p.height)<1e-12,'candidate height includes the uppermost fallback bough');
  }
 }
});
