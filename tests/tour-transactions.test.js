import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { beginChampionship, nextChampionshipRace, CAREER_KEY } from '../src/race-career.js';
import { careerResultMarkup } from '../src/race-hq.js';

// Exercise the actual orchestration functions with no browser, audio, rendering
// or network implementation. Storage failure must not change the selected world.
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const body = (name, next) => main.slice(main.indexOf(`async function ${name}(`), main.indexOf(`function ${next}(`));
const continueSource = body('continueTour', 'showRaceSetup');
const startSource = body('start', 'menu');
const snapshot = value => JSON.parse(JSON.stringify(value));
function harness({failWrite = 0} = {}) {
  const {state} = beginChampionship(null, {id: 'tour-test-transaction', vehicle: 'mclaren-p1-gtr', track: 'harbor', difficulty: 'street'});
  const writes = [], navigation = [], notices = [], dialogs = [];
  const context = vm.createContext({
    preferences: {vehicle: 'audi-r18', track: 'coast', mode: 'championship', difficulty: 'pro'}, career: state,
    CAREER_KEY, preferenceKey: 'preferences', TRACK: {id: 'coast'}, race: {vehicle: 'audi-r18'},
    nextChampionshipRace, beginChampionship, circuitPath: id => `/circuits/${id}/`,
    localStorage: {setItem(key, value) { writes.push([key, value]); if (writes.length === failWrite) throw Error('Unavailable'); }},
    location: {assign: path => navigation.push(path)}, toast: text => notices.push(text),
    updateRaceOptions() {}, closeDialog() {}, start() {}, carSelectionPending: false, racePreparing: false,
    sound: {unlock() {}}, needsLandscape: () => false, pendingLandscapeStart: false, orientationGate() {},
    dialog: options => dialogs.push(options), crypto: {randomUUID: () => 'tour-next-test-transaction'},
  });
  return {context, writes, navigation, notices, dialogs};
}

for (const failWrite of [1, 2]) test(`continuing a tour keeps the current selection when persistence write ${failWrite} fails`, async () => {
  const h = harness({failWrite}), preferences = snapshot(h.context.preferences), career = snapshot(h.context.career);
  const action = vm.runInContext(`(${continueSource})`, h.context); await action();
  assert.deepEqual(snapshot(h.context.preferences), preferences); assert.deepEqual(snapshot(h.context.career), career);
  assert.deepEqual(h.navigation, []); assert.match(h.notices[0], /unchanged/);
});

test('continuing a saved tour commits the exact car and course before navigation', async () => {
  const h = harness(), action = vm.runInContext(`(${continueSource})`, h.context); await action();
  assert.deepEqual(snapshot(h.context.preferences), {vehicle: 'mclaren-p1-gtr', track: 'harbor', mode: 'championship', difficulty: 'street'});
  assert.deepEqual(h.writes.map(([key]) => key), [CAREER_KEY, 'preferences']);
  assert.equal(JSON.parse(h.writes[1][1]).track, 'harbor'); assert.deepEqual(h.navigation, ['/circuits/harbor/']);
});

test('choosing a different tour car or venue offers an explicit continuation choice without replacing progress', async () => {
  const h = harness(), before = snapshot(h.context.career);
  h.context.continueTour = vm.runInContext(`(${continueSource})`, h.context);
  h.context.start = vm.runInContext(`(${startSource})`, h.context); await h.context.start();
  assert.deepEqual(snapshot(h.context.career), before); assert.equal(h.writes.length, 0);
  assert.deepEqual(snapshot(h.dialogs[0].actions.map(action => action.label)), ['CONTINUE TOUR', 'START NEW TOUR', 'BACK']);
  assert.match(h.dialogs[0].html, /earned credits, upgrades and medals stay yours/);
});

test('an explicitly requested replacement still preserves the existing tour when saving fails', async () => {
  const h = harness({failWrite: 1}), before = snapshot(h.context.career);
  h.context.continueTour = vm.runInContext(`(${continueSource})`, h.context);
  h.context.start = vm.runInContext(`(${startSource})`, h.context); await h.context.start({replaceTour: true});
  assert.deepEqual(snapshot(h.context.career), before); assert.deepEqual(h.navigation, []);
  assert.match(h.notices[0], /saved tour is unchanged/);
});

test('a slower unmedalled run is recorded without claiming a new benchmark', () => {
  const slow = careerResultMarkup({recorded: true, medal: 'none', improved: false}, true);
  assert.match(slow, /RUN RECORDED/); assert.doesNotMatch(slow, /A NEW BENCHMARK/);
  assert.match(careerResultMarkup({recorded: true, medal: 'none', improved: true}, false), /A NEW BENCHMARK/);
  assert.equal(careerResultMarkup({recorded: false}, true), '');
});
