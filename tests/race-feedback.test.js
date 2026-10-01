import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceFeedback} from '../src/race-feedback.js';
import {createRace, startRace, resetCar} from '../src/physics.js';

function raceFixture() {
  return {raceId: 'feedback-race', state: 'racing', impact: {id: 0, kind: 'none', remaining: 0}, recovery: {id: 0, phase: 'none', remaining: 0}};
}

test('scrapes stay quiet; a hard impact gives one restrained flash and announcement', () => {
  const feedback = createRaceFeedback(), race = raceFixture();
  race.impact = {id: 1, kind: 'scrape', source: 'barrier', strength: .2, remaining: .18};
  assert.deepEqual(feedback.read(race, {now: 100}), {kind: 'none', title: '', detail: '', announcement: '', flash: 0, kick: 0});
  race.impact = {id: 2, kind: 'crash', source: 'car', strength: 1, remaining: .8};
  const first = feedback.read(race, {now: 200});
  assert.equal(first.title, 'Car contact');
  assert.equal(first.announcement, 'Car contact. Keep steering.');
  assert.ok(first.flash > 0 && first.flash <= .55); assert.ok(first.kick > 0 && first.kick < .1);
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
