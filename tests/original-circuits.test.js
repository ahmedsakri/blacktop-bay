import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ORIGINAL_CIRCUITS } from '../src/original-circuits.js';
import { TRACKS, getTrack, sampleTrack, projectOnTrack } from '../src/track.js';
import { createRace, startRace, stepRace } from '../src/physics.js';
import { grandstandLayout, getVenueProfile, venueSceneryLayout } from '../src/world.js';
import { originalLandmarkLayout, createOriginalLandmarks } from '../src/original-venues.js';
import { MANUFACTURER_RIVAL_VEHICLES } from '../src/opponent-fleet.js';

const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const orient=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);

test('four authored routes extend the existing catalogue without replacing old IDs',()=>{
  assert.equal(TRACKS.length,38);
  assert.equal(new Set(TRACKS.map(t=>t.id)).size,38);
  assert.equal(TRACKS.filter(t=>t.series==='original').length,13);
  assert.deepEqual(TRACKS.slice(30,34).map(t=>t.id),['breakwater','copper-canyon','cedar-ridge','neon-freight']);
  assert.equal(TRACKS.slice(0,30).filter(t=>t.series==='grand-prix').length,25);
  for(const c of ORIGINAL_CIRCUITS){
    const track=getTrack(c.id);
    assert.equal(track.layoutKind,'original');assert.equal(track.series,'original');
    assert.ok(track.character&&track.description&&track.scenery);
    assert.equal(track.sourceUrl,undefined,'authored routes must not imply official venue provenance');
  }
});

for(const descriptor of ORIGINAL_CIRCUITS){
  test(`${descriptor.name}: full-width asphalt is smooth, non-crossing, and has a straight starting grid`,()=>{
    const t=getTrack(descriptor.id),points=t.samples,spacing=t.length/points.length;
    assert.ok(t.length>1900&&t.length<2500);assert.ok(t.width>=17&&t.width<=19);
    const start=sampleTrack(0,t),exit=sampleTrack(45,t),end=sampleTrack(t.length,t);
    assert.ok(Math.hypot(start.x-end.x,start.z-end.z)<1e-8);
    assert.ok(Math.abs(wrapAngle(Math.atan2(exit.tx,exit.tz)-Math.atan2(start.tx,start.tz)))<.025);
    let gap=Infinity,radius=Infinity;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],before=points[(i+points.length-1)%points.length];
      assert.ok([a.x,a.z,a.tx,a.tz,a.nx,a.nz,a.s].every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(a.tx,a.tz)-1)<1e-8);
      const angle=Math.abs(wrapAngle(Math.atan2(b.tx,b.tz)-Math.atan2(before.tx,before.tz)));
      radius=Math.min(radius,2*spacing/Math.max(angle,.00001));
      for(let j=i+2;j<points.length;j++){
        if(i===0&&j===points.length-1)continue;
        const c=points[j],d=points[(j+1)%points.length];
        assert.ok(!(orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0),'no flat crossing');
        if(Math.min(j-i,points.length-j+i)*spacing>=70)gap=Math.min(gap,Math.hypot(a.x-c.x,a.z-c.z));
      }
    }
    assert.ok(radius>t.width/2+14,`inside radius retains a usable kerb: ${radius}`);
    assert.ok(gap>t.width+30,`road ribbons and safety verges stay separated: ${gap}`);
    assert.ok(grandstandLayout(t).length>=4,'the grid should have room for spectators');
  });

  for(const rivalVehicles of [undefined,MANUFACTURER_RIVAL_VEHICLES])test(`${descriptor.name}: player and ${rivalVehicles?'explicit manufacturer':'default manufacturer'} opponents complete three laps without recovery`,()=>{
    const race=createRace({track:descriptor.id,rivalVehicles}),track=getTrack(descriptor.id);startRace(race);
    for(let frame=0;frame<120*420&&!race.allFinished;frame++){
      const p=projectOnTrack(race.car.x,race.car.z,0,track),near=sampleTrack(p.s+3,track),far=sampleTrack(p.s+22,track);
      const aim=sampleTrack(p.s+10+race.car.speed*.45,track);
      const curvature=Math.abs(wrapAngle(Math.atan2(far.tx,far.tz)-Math.atan2(near.tx,near.tz)))/19;
      const target=Math.min(36,Math.sqrt(12/Math.max(.004,curvature)));
      const error=wrapAngle(Math.atan2(aim.x-race.car.x,aim.z-race.car.z)-race.car.yaw);
      stepRace(race,{steer:Math.max(-1,Math.min(1,-error*2.9)),throttle:1,brake:race.car.speed>target+1},1/120);
    }
    assert.equal(race.state,'finished');assert.equal(race.allFinished,true);assert.equal(race.completedLaps,3);assert.equal(race.recoveries,0);
    assert.ok(race.rivals.every(r=>r.completedLaps===3&&r.recoveries===0&&r.lapTimes.length===3));
    assert.ok(race.leaderboard.every(r=>r.finished&&r.finishTime>90&&r.finishTime<420));
    assert.equal(race.lapTimes.length,3);
  });

  test(`${descriptor.name}: manufacturer rivals clear a stopped player and finish all three laps`,()=>{
    const race=createRace({track:descriptor.id,rivalVehicles:MANUFACTURER_RIVAL_VEHICLES});startRace(race);
    for(let frame=0;frame<120*420&&race.rivals.some(r=>r.state!=='finished');frame++)stepRace(race,{brake:true},1/120);
    assert.equal(race.completedLaps,0);
    assert.ok(race.rivals.every(r=>r.completedLaps===3&&r.recoveries===0&&r.finishTime<420));
  });
}

test('expansion scenery has distinct environments and safe, bounded landmark geometry',()=>{
  assert.equal(getVenueProfile(getTrack('breakwater')).vegetation,'coastal-scrub');
  assert.equal(getVenueProfile(getTrack('cedar-ridge')).vegetation,'conifers');
  assert.equal(getVenueProfile(getTrack('neon-freight')).night,true);
  for(const descriptor of ORIGINAL_CIRCUITS){
    const track=getTrack(descriptor.id),stands=grandstandLayout(track),scene=new THREE.Scene();
    const layouts=originalLandmarkLayout(track,{low:true,stands});
    assert.ok(layouts.length>=4&&layouts.length<=5);
    assert.deepEqual(layouts,originalLandmarkLayout(track,{low:true,stands}));
    const generic=venueSceneryLayout(track,{low:true});
    for(const site of layouts){
      assert.ok(projectOnTrack(site.x,site.z,undefined,track).distance>=track.width/2+site.radius+12);
      assert.ok(stands.every(s=>Math.hypot(site.x-s.x,site.z-s.z)>=site.radius+16));
      assert.ok(generic.every(p=>Math.hypot(site.x-p.x,site.z-p.z)>=site.radius+p.radius+4));
    }
    createOriginalLandmarks(scene,track,{low:true,stands});
    assert.ok(scene.children.length<=9,'landmarks use bounded shared draw batches');
    let triangles=0;const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
    scene.traverse(mesh=>{
      if(!mesh.geometry)return;
      const position=mesh.geometry.attributes.position;
      const instances=mesh.isInstancedMesh?mesh.count:1;
      triangles+=(mesh.geometry.index?.count||position.count)/3*instances;
      for(let i=0;i<instances;i++){
        if(mesh.isInstancedMesh)mesh.getMatrixAt(i,matrix);else{mesh.updateMatrix();matrix.copy(mesh.matrix);}
        for(let v=0;v<position.count;v++){
          point.fromBufferAttribute(position,v).applyMatrix4(matrix);
          assert.ok(layouts.some(site=>Math.hypot(point.x-site.x,point.z-site.z)<=site.radius+.1),`${descriptor.name}: rendered geometry stays in its tested footprint`);
        }
      }
    });
    assert.ok(triangles<16000,'authored landmark detail stays bounded on phones');
  }
});

test('lighthouse animation respects pause and reduced motion',()=>{
  const scene=new THREE.Scene(),track=getTrack('breakwater');
  const landmarks=createOriginalLandmarks(scene,track,{low:true,stands:grandstandLayout(track)});
  const beacon=scene.getObjectByName('lighthouse-beacon');assert.ok(beacon);
  landmarks.update(1);const initial=beacon.rotation.y;
  landmarks.update(2,{paused:true});assert.equal(beacon.rotation.y,initial);
  landmarks.update(3,{reducedMotion:true});assert.equal(beacon.rotation.y,initial);
  landmarks.update(3.1);assert.ok(beacon.rotation.y>initial);
});
