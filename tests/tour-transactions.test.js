import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { beginChampionship, nextChampionshipRace, finalizeChampionshipRound, recordCareerResult, CAREER_KEY } from '../src/race-career.js';
import { schoolSeen, saveSchool, createDrivingSchool, SCHOOL_KEY } from '../src/driving-school.js';
import { RIVAL_GRID } from '../src/rivals.js';
import {commitTourAdvance,TOUR_TRANSACTION_KEY} from '../src/tour-transaction.js';
import { careerResultMarkup } from '../src/race-hq.js';

// Exercise the actual orchestration functions with no browser, audio, rendering
// or network implementation. Storage failure must not change the selected world.
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const body = (name, next) => main.slice(main.indexOf(`async function ${name}(`), main.indexOf(`function ${next}(`));
const continueSource = body('continueTour', 'showRaceSetup');
const startSource = body('start', 'menu');
const finalizeSource = main.slice(main.indexOf('function finalizeTour('),main.indexOf('async function continueTour('));
const persistStart = main.indexOf('function persistCareer(');
const persistSource = main.slice(persistStart,main.indexOf('\n',persistStart));
const snapshot = value => JSON.parse(JSON.stringify(value));
function harness({failWrite = 0} = {}) {
  const {state} = beginChampionship(null, {id: 'tour-test-transaction', vehicle: 'mclaren-p1-gtr', track: 'harbor', difficulty: 'street'});
  const writes = [], navigation = [], notices = [], dialogs = [];
  const saved = new Map([[SCHOOL_KEY,'seen']]);
  const storage = {removeItem:key=>saved.delete(key),getItem:key=>saved.get(key)??null,setItem(key,value) {writes.push([key,value]);if(writes.length===failWrite)throw Error('Unavailable');saved.set(key,value);}};
  const context = vm.createContext({
    preferences: {vehicle: 'audi-r18', track: 'coast', mode: 'championship', difficulty: 'pro'}, career: state,
    CAREER_KEY, preferenceKey: 'blacktop-bay-choices-v1', TRACK: {id: 'coast'}, race: {vehicle: 'audi-r18'},
    mode:'menu',school:null,pendingStartOptions:{},selectedCampaignId:null,schoolSeen,saveSchool,createDrivingSchool,localStore:()=>storage,
    commitTourAdvance, nextChampionshipRace, beginChampionship, finalizeChampionshipRound, circuitPath: id => `/circuits/${id}/`,
    localStorage: storage,
    location: {assign: path => navigation.push(path)}, toast: text => notices.push(text),
    updateRaceOptions() {}, closeDialog() {}, start() {}, carSelectionPending: false, racePreparing: false,
    sound: {unlock() {}}, needsLandscape: () => false, pendingLandscapeStart: false, orientationGate() {},
    dialog: options => dialogs.push(options), crypto: {randomUUID: () => 'tour-next-test-transaction'},
  });
  vm.runInContext(`${persistSource}\n${finalizeSource}`,context);
  return {context, writes, navigation, notices, dialogs, saved};
}

for (const failWrite of [1, 2, 3]) test(`continuing a tour keeps the current selection when persistence write ${failWrite} fails`, async () => {
  const h = harness({failWrite}), preferences = snapshot(h.context.preferences), career = snapshot(h.context.career);
  const action = vm.runInContext(`(${continueSource})`, h.context); await action();
  assert.deepEqual(snapshot(h.context.preferences), preferences); assert.deepEqual(snapshot(h.context.career), career);
  assert.deepEqual(h.navigation, []); assert.match(h.notices[0], /unchanged/);
});

test('continuing a saved tour commits the exact car and course before navigation', async () => {
  const h = harness(), action = vm.runInContext(`(${continueSource})`, h.context); await action();
  assert.deepEqual(snapshot(h.context.preferences), {vehicle: 'mclaren-p1-gtr', track: 'harbor', mode: 'championship', difficulty: 'street'});
  assert.deepEqual(h.writes.map(([key]) => key), [TOUR_TRANSACTION_KEY,CAREER_KEY, 'blacktop-bay-choices-v1']);
  assert.equal(JSON.parse(h.writes[2][1]).track, 'harbor'); assert.deepEqual(h.navigation, ['/circuits/harbor/']);
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


test('continuation from a finished round persists real DNF finalization without duplicating earned rewards',async()=>{
 const h=harness(),tour=h.context.career.activeTour;
 const race={raceId:'race-tour-transaction-finish',state:'finished',completedLaps:3,totalLaps:3,track:'harbor',vehicle:tour.vehicle,elapsed:140,position:1,mode:'championship',difficulty:tour.difficulty,score:0,
  leaderboard:[{id:'player',vehicle:tour.vehicle,finished:true,completedLaps:3,finishTime:140,position:1},...RIVAL_GRID.map(rival=>({id:rival.id,vehicle:tour.vehicle,finished:false,completedLaps:2,finishTime:null,position:null}))]};
 const recorded=recordCareerResult(h.context.career,race,{awarded:true,credits:650,persisted:true});
 assert.equal(recorded.recorded,true);h.context.career=recorded.state;h.context.race=race;h.context.mode='finished';
 const next=nextChampionshipRace(recorded.state),action=vm.runInContext(`(${continueSource})`,h.context);await action();
 assert.deepEqual(h.writes.map(([key])=>key),[TOUR_TRANSACTION_KEY,CAREER_KEY,'blacktop-bay-choices-v1']);
 const saved=JSON.parse(h.saved.get(CAREER_KEY)),round=saved.activeTour.rounds[0];
 assert.equal(round.classification.filter(row=>row.status==='dnf').length,7);
 assert.equal(round.classification.find(row=>row.id==='player').finishTime,140);
 assert.equal(saved.activeTour.credits,650);assert.equal(saved.activeTour.rounds.length,1);assert.deepEqual(saved.recordedRaces,[race.raceId]);
 assert.deepEqual(h.navigation,[`/circuits/${next.track}/`]);assert.equal(JSON.parse(h.saved.get('blacktop-bay-choices-v1')).track,next.track);
 assert.deepEqual(h.notices,[]);
});

for(const failWrite of [1,2,3])test(`failed finished-round continuation ${failWrite} preserves pending rivals`,async()=>{
 const h=harness({failWrite}),tour=h.context.career.activeTour;
 const race={raceId:'race-tour-transaction-finish',state:'finished',completedLaps:3,totalLaps:3,track:'harbor',vehicle:tour.vehicle,elapsed:140,position:1,mode:'championship',difficulty:tour.difficulty,score:0,
  leaderboard:[{id:'player',vehicle:tour.vehicle,finished:true,completedLaps:3,finishTime:140,position:1},...RIVAL_GRID.map(rival=>({id:rival.id,vehicle:tour.vehicle,finished:false,completedLaps:2,finishTime:null,position:null}))]};
 const recorded=recordCareerResult(h.context.career,race,{awarded:true,credits:650,persisted:true});
 assert.equal(recorded.recorded,true);h.context.career=recorded.state;h.context.race=race;h.context.mode='finished';
 const before=snapshot(h.context.career),choices=snapshot(h.context.preferences);
 const action=vm.runInContext(`(${continueSource})`,h.context);await action();
 assert.deepEqual(snapshot(h.context.career),before);assert.deepEqual(snapshot(h.context.preferences),choices);assert.deepEqual(h.navigation,[]);
 assert.equal(h.context.career.activeTour.rounds[0].classification.filter(row=>row.status==="pending").length,7);
});
