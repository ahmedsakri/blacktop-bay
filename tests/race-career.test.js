import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCareer, getMedalTargets, circuitMedal, beginChampionship, nextChampionshipRace, recordCareerResult, getCareerRecord } from '../src/race-career.js';
import { normalizeRaceOptions, getDifficulty, raceFieldSize } from '../src/race-options.js';
import { createRace, startRace } from '../src/physics.js';
import { TRACKS } from '../src/track.js';
import { VEHICLES } from '../src/vehicles.js';

const finished = (extra = {}) => ({ raceId: 'race-test-00001', state: 'finished', completedLaps: 3, totalLaps: 3,
  track: 'harbor', vehicle: 'mclaren-p1-gtr', elapsed: 140, position: 2, mode: 'race', difficulty: 'street', score: 0, ...extra });
const receipt = { awarded: true, credits: 650, persisted: true };

test('race modes and difficulty normalize unknown persisted values without changing default pace', () => {
  assert.deepEqual(normalizeRaceOptions(null), { mode: 'race', difficulty: 'street' });
  assert.deepEqual(normalizeRaceOptions({mode: '__proto__', difficulty: 'constructor'}), {mode: 'race', difficulty: 'street'});
  assert.equal(getDifficulty('street').pace, 1);
  assert.ok(getDifficulty('relaxed').pace < getDifficulty('street').pace);
  assert.ok(getDifficulty('pro').pace > getDifficulty('street').pace);
  assert.equal(raceFieldSize('time-attack'), 1); assert.equal(raceFieldSize('race'), 8);
});

test('a solo time attack really has no opponents and options survive restart', () => {
  const solo = createRace({mode: 'time-attack', difficulty: 'pro'});
  assert.equal(solo.rivals.length, 0); startRace(solo);
  assert.equal(solo.rivals.length, 0); assert.equal(solo.mode, 'time-attack'); assert.equal(solo.difficulty, 'pro');
  const club = createRace({difficulty: 'relaxed'}), sport = createRace(), pro = createRace({difficulty: 'pro'});
  assert.equal(sport.rivals.length, 7);
  assert.ok(club.rivals[0]._pace < sport.rivals[0]._pace && sport.rivals[0]._pace < pro.rivals[0]._pace);
});

test('every car and track has ordered finite three-lap medal targets', () => {
  for (const track of TRACKS) for (const car of VEHICLES) {
    const targets = getMedalTargets(track.id, car.id);
    assert.ok(targets.gold > 40 && targets.gold < targets.silver && targets.silver < targets.bronze && targets.bronze < 900);
  }
  const targets = getMedalTargets('harbor', 'mclaren-p1-gtr');
  assert.equal(circuitMedal(finished({elapsed: targets.gold})), 'gold');
  assert.equal(circuitMedal(finished({elapsed: targets.gold + .01})), 'silver');
  assert.equal(circuitMedal(finished({elapsed: targets.bronze + .01})), 'none');
});

test('only a trusted paid finish advances medals; duplicate, unpaid and invalid finishes do not', () => {
  const state = normalizeCareer();
  for (const [race, paid] of [[finished(), null], [finished(), {...receipt, awarded: false}], [finished({completedLaps: 2}), receipt],
    [finished({elapsed: Infinity}), receipt], [finished({raceId: 'bad'}), receipt], [finished({position: 9}), receipt]]) {
    assert.equal(recordCareerResult(state, race, paid).recorded, false);
  }
  const first = recordCareerResult(state, finished(), receipt);
  assert.equal(first.recorded, true); assert.equal(first.improved, true);
  assert.deepEqual(state.records, {}, 'caller state is not mutated');
  const duplicate = recordCareerResult(first.state, finished(), receipt);
  assert.equal(duplicate.recorded, false);
  assert.equal(getCareerRecord(first.state, finished()).runs, 1);
  const slower = recordCareerResult(first.state, finished({raceId: 'race-test-00002', elapsed: 160}), receipt);
  assert.equal(slower.improved, false); assert.equal(getCareerRecord(slower.state, finished()).bestTime, 140);
  const solo = recordCareerResult(slower.state, finished({raceId: 'race-test-00003', mode: 'time-attack', elapsed: 150}), receipt);
  assert.equal(getCareerRecord(solo.state, finished({mode: 'time-attack'})).bestTime, 150);
  assert.equal(getCareerRecord(solo.state, finished()).bestTime, 140);
});

test('a tour locks its car and difficulty, requires the next venue, and totals only earned round credits', () => {
  let {state, started, next} = beginChampionship(normalizeCareer(), {id: 'tour-test-00001', vehicle: 'mclaren-p1-gtr', track: 'harbor', difficulty: 'pro', seed: 4});
  assert.equal(started, true); assert.equal(next.round, 1); assert.equal(new Set(state.activeTour.tracks).size, 3);
  const wrong = recordCareerResult(state, finished({mode: 'championship', difficulty: 'street'}), receipt);
  assert.equal(wrong.state.activeTour.rounds.length, 0);
  const wrongCar = recordCareerResult(state, finished({mode: 'championship', difficulty: 'pro', vehicle: 'audi-r18'}), receipt);
  assert.equal(wrongCar.state.activeTour.rounds.length, 0);
  let result;
  for (let index = 0; index < 3; index++) {
    next = nextChampionshipRace(state);
    result = recordCareerResult(state, finished({...next, raceId: `race-tour-round-${index}`, position: index + 1}), {...receipt, credits: [900, 650, 500][index]});
    state = result.state;
    assert.equal(result.tourCompleted, index === 2);
  }
  assert.equal(state.completedTours, 1); assert.equal(nextChampionshipRace(state), null);
  assert.equal(state.lastTour.points, 58); assert.equal(state.lastTour.credits, 2050);
  assert.equal(state.lastTour.rounds.length, 3);
  assert.equal(recordCareerResult(state, finished({...next, raceId: 'race-tour-round-2'}), receipt).recorded, false);
  const loaded = normalizeCareer(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(loaded, state, 'completion and idempotency survive reload');
});

test('corrupt career and tour values cannot inject credits or unearned score totals', () => {
  assert.deepEqual(normalizeCareer({version: 9}), normalizeCareer());
  assert.equal(beginChampionship(null, {id: 'invalid', vehicle: 'bad', track: 'bad'}).started, false);
  const {state} = beginChampionship(null, {id: 'tour-test-00002', vehicle: 'mclaren-p1-gtr', track: 'harbor'});
  state.activeTour.points = 999999; state.activeTour.credits = 999999;
  const clean = normalizeCareer(state);
  assert.equal(clean.activeTour.points, 0); assert.equal(clean.activeTour.credits, 0);
  state.activeTour.rounds = [{raceId: 'race-test-00111', track: state.activeTour.tracks[1], elapsed: 120, position: 1, credits: 900}];
  assert.equal(normalizeCareer(state).activeTour, null);
});
