import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceFeedback, impactCameraOffset} from '../src/race-feedback.js';
import {createRace, startRace, resetCar} from '../src/physics.js';

function raceFixture() {
  return {raceId: 'feedback-race', state: 'racing', impact: {id: 0, kind: 'none', remaining: 0}, recovery: {id: 0, phase: 'none', remaining: 0}};
}

test('scrapes stay quiet; a hard impact gives one restrained flash and announcement', () => {
  const feedback = createRaceFeedback(), race = raceFixture();
  race.impact = {id: 1, kind: 'scrape', source: 'barrier', strength: .2, remaining: .18};
  assert.deepEqual(feedback.read(race, {now: 100}), {kind: 'none', title: '', detail: '', announcement: '', flash: 0, kick: 0, edge: 'front'});
  race.impact = {id: 2, kind: 'crash', source: 'car', strength: 1, remaining: .8};
  const first = feedback.read(race, {now: 200});
  assert.equal(first.title, 'Car contact');
  assert.equal(first.announcement, 'Car contact. Keep steering.');
  assert.ok(first.flash > 0 && first.flash <= .55); assert.ok(first.kick >= .16 && first.kick <= .4);
  const next = feedback.read(race, {now: 300});
  assert.equal(next.announcement, ''); assert.equal(next.kick, 0); assert.ok(next.flash < first.flash);
  assert.equal(feedback.read(race, {now: 600}).flash, 0);
  race.impact.id++;
  const quickContact = feedback.read(race, {now: 750});
  assert.equal(quickContact.announcement, ''); assert.equal(quickContact.flash, 0); assert.equal(quickContact.kick, 0);
});

test('recovery countdown stays visible without announcing every second and success announces once', () => {
  const feedback = createRaceFeedback(), race = raceFixture();
  race.recovery = {id: 0, phase: 'waiting', reason: 'stuck', remaining: 2.3};
  const preparing = feedback.read(race, {now: 100});
  assert.equal(preparing.kind, 'waiting'); assert.match(preparing.detail, /^3s/); assert.ok(preparing.announcement);
  race.recovery.remaining = 1.2;
  const counting = feedback.read(race, {now: 1100});
  assert.match(counting.detail, /^2s/); assert.equal(counting.announcement, '');
  race.recovery = {id: 1, phase: 'recovered', reason: 'stuck', remaining: 1.5};
  const returned = feedback.read(race, {now: 2400});
  assert.equal(returned.title, 'Back on track'); assert.equal(returned.announcement, 'Car returned to the road. Keep steering.');
  assert.equal(feedback.read(race, {now: 2500}).announcement, '');
  race.recovery.remaining = 0; race.recovery.phase = 'none';
  assert.equal(feedback.read(race, {now: 4000}).kind, 'none');
});

test('recovery cancelled by steering away clears its badge and repeated waiting is not spammed', () => {
  const feedback = createRaceFeedback(), race = raceFixture();
  race.recovery.phase = 'waiting'; race.recovery.remaining = 2;
  assert.ok(feedback.read(race, {now: 0}).announcement);
  race.recovery.phase = 'none';
  assert.equal(feedback.read(race, {now: 100}).kind, 'none');
  race.recovery.phase = 'waiting';
  assert.equal(feedback.read(race, {now: 200}).announcement, '');
  race.recovery.phase = 'none'; feedback.read(race, {now: 6000}); race.recovery.phase = 'waiting';
  assert.ok(feedback.read(race, {now: 6100}).announcement);
});

test('reduced motion, pause and finish suppress flash/kick; restart clears old event identities', () => {
  const feedback = createRaceFeedback(), race = raceFixture();
  race.impact = {id: 1, kind: 'crash', source: 'barrier', strength: 1, remaining: .8};
  const reduced = feedback.read(race, {now: 0, reducedMotion: true});
  assert.equal(reduced.flash, 0); assert.equal(reduced.kick, 0); assert.ok(reduced.announcement);
  assert.equal(feedback.read(race, {now: 10, active: false}).kind, 'none');
  assert.equal(feedback.read(race, {now: 20}).announcement, '', 'resume does not repeat the old impact');
  race.state = 'finished'; assert.equal(feedback.read(race, {now: 30}).kind, 'none');
  race.state = 'racing'; race.raceId = 'another-race';
  assert.ok(feedback.read(race, {now: 40}).announcement);
  race.impact.id = 0; feedback.read(race, {now: 50}); race.impact.id = 1;
  assert.ok(feedback.read(race, {now: 60}).announcement, 'an engine restart with reset event IDs starts a new announcement sequence');
});

test('the real manual reset produces one message without changing progress or inventing physics', () => {
  const race = createRace({track: 'harbor'}); startRace(race);
  const feedback = createRaceFeedback(); feedback.read(race);
  resetCar(race); const snapshot = structuredClone(race);
  const display = feedback.read(race, {now: 100});
  assert.equal(display.kind, 'recovered'); assert.equal(display.announcement, 'Car reset to the road.');
  assert.deepEqual(race, snapshot, 'presentation is read-only');
  assert.equal(feedback.read(race, {now: 200}).announcement, '');
});

test('validated laps give a timed final-lap notice and honest comparisons', () => {
  const feedback = createRaceFeedback(), race = {...raceFixture(), totalLaps: 3, completedLaps: 0, lapTimes: [], elapsed: 0};
  feedback.read(race);
  Object.assign(race, {completedLaps: 1, lapTimes: [65.2], elapsed: 65.2});
  const first = feedback.read(race);
  assert.equal(first.title, 'Lap 2 of 3');
  assert.equal(first.detail, 'Last lap 01:05.20 · Set the pace');
  assert.equal(first.kind, 'lap'); assert.ok(first.announcement);
  assert.equal(feedback.read(race).announcement, '');
  assert.equal(feedback.read(race, {active: false}).kind, 'none');
  assert.equal(feedback.read(race).kind, 'lap', 'pause preserves remaining race-time duration');
  race.elapsed += 4.1; assert.equal(feedback.read(race).kind, 'none');
  Object.assign(race, {completedLaps: 2, lapTimes: [65.2, 62.8], elapsed: 128});
  const snapshot = structuredClone(race), final = feedback.read(race, {reducedMotion: true});
  assert.equal(final.title, 'Final lap');
  assert.equal(final.detail, 'Last lap 01:02.80 · 2.40s faster');
  assert.equal(final.flash, 0); assert.equal(final.kick, 0);
  assert.deepEqual(race, snapshot, 'feedback never changes engine or times');
  race.state = 'finished'; assert.equal(feedback.read(race).kind, 'none');
});

test('lap comparisons distinguish slower and equal laps, and impacts take priority', () => {
  for (const [last, expected] of [[67.6, '2.40s off your best'], [65.2, 'Matched your best']]) {
    const feedback = createRaceFeedback(), race = {...raceFixture(), totalLaps: 3, completedLaps: 2, lapTimes: [65.2, last], elapsed: 65.2 + last};
    race.impact = {id: 1, kind: 'crash', source: 'barrier', remaining: .5, strength: .5};
    assert.equal(feedback.read(race).kind, 'crash');
    race.impact.remaining = 0;
    const result = feedback.read(race);
    assert.ok(result.detail.endsWith(expected)); assert.ok(result.announcement);
    race.raceId = 'new-race'; race.completedLaps = 0; race.lapTimes = []; race.elapsed = 0;
    assert.equal(feedback.read(race).kind, 'none', 'restart removes a previous lap banner');
  }
});

test('invalid or incomplete lap records never produce lap feedback', () => {
  for (const lapTimes of [[], [NaN], [-5], [Infinity], [20, 30]]) {
    const feedback = createRaceFeedback();
    assert.equal(feedback.read({...raceFixture(), totalLaps: 3, completedLaps: 1, lapTimes, elapsed: 40}).kind, 'none');
  }
});

test('lap clocks round through minute boundaries without showing sixty seconds', () => {
  const result = createRaceFeedback().read({...raceFixture(), totalLaps: 3, completedLaps: 1, lapTimes: [59.999], elapsed: 60});
  assert.match(result.detail, /01:00.00/);
});


test('directional impact cue follows the actual contact side relative to the car', () => {
  for (const [yaw,nx,nz,edge] of [[0,-1,0,'right'],[0,1,0,'left'],[0,0,-1,'front'],[0,0,1,'rear'],[Math.PI/2,0,1,'right']]) {
    const feedback = createRaceFeedback(), race = {...raceFixture(), car: {yaw}};
    race.impact = {id: 1, kind: 'crash', source: 'barrier', strength: .8, remaining: .8, nx, nz};
    const first = feedback.read(race, {now: 10});
    assert.equal(first.edge, edge);
    assert.equal(feedback.read(race, {now: 30}).edge, edge, 'cue remains on the same edge while it fades');
  }
});

test('camera impact is a finite 320ms directional impulse with no continuing oscillation', () => {
  assert.deepEqual(impactCameraOffset(0,.4,1,0), {x:0,y:0,z:0});
  const impulse = impactCameraOffset(.1,.4,4,0);
  assert.ok(impulse.x > .15 && impulse.x < .4); assert.equal(impulse.z,0);
  assert.ok(impulse.y > 0 && impulse.y < .13);
  const opposite = impactCameraOffset(.1,.4,-4,0); assert.equal(opposite.x,-impulse.x);
  for(const age of [.32,1,10,Infinity,NaN,-1]) assert.deepEqual(impactCameraOffset(age,.4,1,0),{x:0,y:0,z:0});
  assert.deepEqual(impactCameraOffset(.1,.4,NaN,0),{x:0,y:0,z:0});
  assert.deepEqual(impactCameraOffset(.1,.4,0,0),{x:0,y:0,z:0});
  assert.deepEqual(impactCameraOffset(.1,100,1,0),impulse,'strength cannot exceed the bounded camera travel');
});


test('recovery waiting for a safe gap does not show a frozen countdown or invent a return',()=>{
  const feedback=createRaceFeedback(),race=raceFixture();
  race.recovery={id:0,phase:'waiting',reason:'stuck',remaining:0};
  const before=structuredClone(race),result=feedback.read(race,{now:3000});
  assert.equal(result.kind,'waiting');assert.equal(result.title,'Finding a clear gap');
  assert.equal(result.detail,'Waiting for space behind you');assert.doesNotMatch(result.detail,/\ds/);
  assert.deepEqual(race,before);assert.equal(feedback.read(race,{now:3100}).announcement,'');
});
