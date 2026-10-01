import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { TRACKS, getTrack, sampleTrack, projectOnTrack } from '../src/track.js';
import { createRace, startRace, stepRace } from '../src/physics.js';

const pack = TRACKS.filter(track => track.series === 'grand-prix');
const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const orient = (a, b, c) => (b.x-a.x)*(c.z-a.z) - (b.z-a.z)*(c.x-a.x);

test('calendar pack has 23 current venues and two clearly categorized original-calendar bonuses', () => {
  assert.equal(TRACKS.length, 30);
  assert.equal(new Set(TRACKS.map(track => track.id)).size, 30);
  assert.equal(pack.length, 25);
  assert.deepEqual(pack.filter(t => t.calendarStatus === 'current').map(t => t.round), Array.from({length:23}, (_,i) => i+1));
  assert.deepEqual(pack.filter(t => t.calendarStatus === 'original-calendar-bonus').map(t => t.id), ['sakhir','jeddah']);
  for (const descriptor of pack) {
    const track = getTrack(descriptor.id);
    assert.equal(track.season, 2026);
    assert.equal(track.layoutKind, 'compact-adaptation');
    assert.ok(['coastal','urban','desert','parkland'].includes(track.environment));
    assert.ok(track.country && track.region && track.venueName && track.adaptationNote);
    assert.match(track.sourceUrl, /^https:\/\/www\.formula1\.com\/en\/racing\/(2025|2026)\//);
    assert.ok(track.realLengthKm > 3 && track.realLengthKm < 8);
    assert.ok(track.length/1000 < track.realLengthKm, 'the arcade lap is not the official venue length');
    assert.equal(descriptor.realLengthKm, track.realLengthKm);
    assert.equal(descriptor.environment, track.environment);
    assert.equal('samples' in descriptor, false);
    assert.equal('points' in descriptor, false);
  }
  assert.equal(getTrack('sepang').round, 16);
  assert.equal(getTrack('sepang').country, 'Malaysia');
  assert.equal(getTrack('madring').realLengthKm, 5.414);
  assert.match(getTrack('suzuka').adaptationNote, /Non-crossing.*overpass/);
});

test('the five original circuits retain their exact sampled geometry', () => {
  const hashes = {
    harbor: 'dec363085a9f1f43e7e0623f32f18bfdaf874e98c428b3e470662e95acbb56fc',
    dockyard: '4368a7e50e32ab5f3667f49615a593eb2d41734aa3cda6a82272471718f654ee',
    coast: '38a39fc0ea4d12f39256d769686b77a72ecdde8407c0b210a1f3d28274b103f4',
    summit: '263397c7878529915fb843fb0393bbeeec5c4e6467022c1491a974a958dd8cf0',
    grandprix: 'b01b33b90f55ce3ed898c4df39cd44a7a2e07c86a7dee15f931942910131e4f6',
  };
  for (const [id, hash] of Object.entries(hashes)) {
    assert.equal(createHash('sha256').update(JSON.stringify(getTrack(id).samples)).digest('hex'), hash);
  }
});

for (const descriptor of pack) {
  test(`${descriptor.name}: finite, closed, non-crossing road with separated barriers and a safe starting grid`, () => {
    const track = getTrack(descriptor.id), points = track.samples, spacing = track.length / points.length;
    assert.equal(points.length, 440);
    assert.ok(track.length > 1900 && track.length < 3100);
    const start = sampleTrack(0, track), exit = sampleTrack(35, track), end = sampleTrack(track.length, track);
    assert.ok(Math.hypot(start.x-end.x,start.z-end.z) < 1e-8);
    assert.ok(Math.abs(wrapAngle(Math.atan2(exit.tx,exit.tz)-Math.atan2(start.tx,start.tz))) < .065);
    let gap = Infinity, radius = Infinity;
    for (let i=0; i<points.length; i++) {
      const p=points[i], before=points[(i+points.length-1)%points.length], after=points[(i+1)%points.length];
      assert.ok([p.x,p.z,p.tx,p.tz,p.nx,p.nz,p.s].every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(p.tx,p.tz)-1) < 1e-8);
      const angle=Math.abs(wrapAngle(Math.atan2(after.tx,after.tz)-Math.atan2(before.tx,before.tz)));
      radius=Math.min(radius,2*spacing/Math.max(angle,.00001));
      for (let j=i+2; j<points.length; j++) {
        if (i===0 && j===points.length-1) continue;
        const a=p,b=after,c=points[j],d=points[(j+1)%points.length];
        assert.ok(!(orient(a,b,c)*orient(a,b,d)<0 && orient(c,d,a)*orient(c,d,b)<0), 'a planar circuit cannot have an at-grade crossing');
        if (Math.min(j-i,points.length-j+i)*spacing>=70) gap=Math.min(gap,Math.hypot(a.x-c.x,a.z-c.z));
      }
    }
    assert.ok(radius > track.width/2+7, `inside kerb has a positive radius: ${radius}`);
    assert.ok(gap > track.width+24, `distant ribbons and barrier verges stay separated: ${gap}`);
  });

  test(`${descriptor.name}: player and all opponents complete three real laps without recovery`, () => {
    const race=createRace({track:descriptor.id}), track=getTrack(descriptor.id);
    startRace(race);
    // Longer compact GP venues have a separate seven-minute fixture budget.
    // The unchanged original circuits retain their tighter 220/240-second tests.
    for (let frame=0; frame<120*420 && !race.allFinished; frame++) {
      const p=projectOnTrack(race.car.x,race.car.z,0,track);
      const near=sampleTrack(p.s+3,track), far=sampleTrack(p.s+22,track);
      const aim=sampleTrack(p.s+10+race.car.speed*.45,track);
      const curvature=Math.abs(wrapAngle(Math.atan2(far.tx,far.tz)-Math.atan2(near.tx,near.tz)))/19;
      const targetSpeed=Math.min(36,Math.sqrt(12/Math.max(.004,curvature)));
      const error=wrapAngle(Math.atan2(aim.x-race.car.x,aim.z-race.car.z)-race.car.yaw);
      stepRace(race,{steer:Math.max(-1,Math.min(1,-error*2.9)),throttle:1,brake:race.car.speed>targetSpeed+1},1/120);
    }
    assert.equal(race.state,'finished');
    assert.equal(race.allFinished,true);
    assert.equal(race.completedLaps,3);
    assert.equal(race.recoveries,0);
    assert.equal(race.lapTimes.length,3);
    assert.ok(Math.abs(race.lapTimes.reduce((a,b)=>a+b,0)-race.elapsed)<1e-7);
    assert.ok(race.rivals.every(r => r.completedLaps===3 && r.recoveries===0 && r.lapTimes.length===3));
    assert.ok(race.leaderboard.every(r => r.finished && Number.isFinite(r.finishTime) && r.finishTime>90 && r.finishTime<420));
    assert.ok(track.length*3/race.elapsed < 50, 'progress is achieved through physical movement');
  });
}
