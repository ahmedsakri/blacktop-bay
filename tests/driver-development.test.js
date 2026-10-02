import test from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLES, DEFAULT_VEHICLE_ID } from '../src/vehicles.js';
import { TRACKS } from '../src/track.js';
import { getUpgradeStats, createRace, startRace } from '../src/physics.js';
import { CAR_SETUPS, SETUPS_KEY, normalizeSetups, normalizeSetup, getCarSetup, selectCarSetup, clearCircuitSetup, applyCarSetup, loadSetups, persistSetups } from '../src/car-setups.js';
import { CAMPAIGN_KEY, CAMPAIGN_CHAPTERS, CAMPAIGN_EVENTS, normalizeCampaign, getCampaignEvent, getNextCampaignEvent,
  canStartCampaignEvent, isCampaignEventComplete, recordCampaignResult, loadCampaign, persistCampaign, getCampaignSuggestion } from '../src/driver-campaign.js';
import { MASTERY_KEY, normalizeMastery, getCarMastery, recordMasteryResult, loadMastery, persistMastery } from '../src/car-mastery.js';
import { getMedalTargets } from '../src/race-career.js';
import { campaignPanel, carDevelopmentPanel, developmentResultMarkup, mountCampaignPanel, mountCarDevelopment } from '../src/driver-development-ui.js';
import { createCompletedRaceFixture } from '../scripts/qa-race-fixture.js';
import { loadProgression, awardRaceCredits } from '../src/progression.js';
import { upgradePanel } from '../src/upgrades-ui.js';

const receipt = { awarded: true, credits: 350, persisted: true };
const finished = (extra = {}) => ({ raceId: 'race-development-0001', state: 'finished', completedLaps: 3, totalLaps: 3,
  track: 'harbor', vehicle: DEFAULT_VEHICLE_ID, mode: 'race', difficulty: 'relaxed', position: 4, score: 0,
  recoveries: 0, elapsed: 150, lapTimes: [50, 50, 50], campaignEventId: 'harbor-first', ...extra });
const memory = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; };

test('all setups have a genuine measured trade-off, preserve inputs and remain bounded across every car and upgrade level', () => {
  for (const car of VEHICLES) for (const level of [0, 5]) {
    const stats = getUpgradeStats(car.id, {engine: level, tyres: level, nitro: level, handling: level});
    const original = structuredClone(stats);
    assert.deepEqual(applyCarSetup(stats, 'balanced'), original);
    assert.deepEqual(applyCarSetup(stats, 'unknown'), original);
    for (const setup of CAR_SETUPS.filter(item => item.id !== 'balanced')) {
      const applied = applyCarSetup(stats, setup.id);
      const ratios = Object.keys(setup.factors).map(key => applied[key] / stats[key]);
      assert.ok(ratios.some(ratio => ratio > 1), `${car.id}/${setup.id} needs an advantage`);
      assert.ok(ratios.some(ratio => ratio < 1), `${car.id}/${setup.id} needs a cost`);
      assert.ok(ratios.every(ratio => ratio >= .92 && ratio <= 1.121));
      assert.ok(Object.values(applied).every(value => Number.isFinite(value) && value > 0));
    }
    assert.deepEqual(stats, original);
  }
  assert.throws(() => applyCarSetup({topSpeed: NaN}, 'sprint'), /Invalid setup stat/);
});

test('setups are per-car, default to factory balance and reject unknown choices without mutating saved upgrades', () => {
  const empty = normalizeSetups(), first = selectCarSetup(empty, DEFAULT_VEHICLE_ID, 'grip');
  assert.equal(first.selected, true); assert.deepEqual(empty.cars, {});
  assert.equal(getCarSetup(first.state, DEFAULT_VEHICLE_ID), 'grip');
  assert.equal(getCarSetup(first.state, 'audi-r18'), 'balanced');
  assert.equal(selectCarSetup(first.state, 'unknown', 'grip').selected, false);
  assert.equal(selectCarSetup(first.state, DEFAULT_VEHICLE_ID, 'unknown').selected, false);
  assert.equal(normalizeSetup('__proto__'), 'balanced');
  assert.deepEqual(normalizeSetups({version:1,cars:{unknown:'sprint',[DEFAULT_VEHICLE_ID]:'bad'}}).cars, {[DEFAULT_VEHICLE_ID]:'balanced'});
});

test('campaign has eighteen valid authored events and personalised stock-car targets in all six chapters', () => {
  assert.equal(CAMPAIGN_CHAPTERS.length, 6); assert.equal(CAMPAIGN_EVENTS.length, 18);
  const ids = new Set(CAMPAIGN_EVENTS.map(item => item.id)); assert.equal(ids.size, 18);
  for (const definition of CAMPAIGN_EVENTS) for (const car of VEHICLES) {
    const event = getCampaignEvent(definition.id, car.id);
    assert.ok(TRACKS.some(track => track.id === event.track));
    assert.equal(event.vehicle, car.id); assert.equal(event.campaignEventId, definition.id);
    assert.equal(event.objectives.length, 3); assert.equal(new Set(event.objectives.map(goal => goal.id)).size, 3);
    assert.equal(event.objectives.filter(goal => goal.required).length, 1);
    for (const goal of event.objectives.filter(goal => goal.type === 'time')) {
      assert.equal(goal.target, getMedalTargets(event.track, car.id)[goal.value]);
      assert.ok(goal.target > 0 && goal.target < 900);
    }
  }
  assert.equal(getCampaignEvent('not-an-event'), null); assert.equal(getCampaignEvent('harbor-first', 'missing'), null);
});

test('campaign requires actual awarded complete races with the bound event venue, mode and difficulty', () => {
  for (const extra of [{track:'coast'}, {difficulty:'pro'}, {mode:'time-attack'}, {campaignEventId:'missing'},
    {campaignEventId:'coast-clock',track:'coast',mode:'time-attack',difficulty:'street',position:1},
    {completedLaps:2}, {elapsed:Infinity}, {raceId:'short'}, {score:NaN}, {recoveries:-1}, {position:9}]) {
    assert.equal(recordCampaignResult(null, finished(extra), receipt).recorded, false, JSON.stringify(extra));
  }
  assert.equal(recordCampaignResult(null, finished(), {...receipt,awarded:false}).recorded, false);
  assert.equal(recordCampaignResult(null, finished(), {...receipt,credits:1401}).recorded, false);
  const result = recordCampaignResult(null, finished(), {...receipt,credits:0});
  assert.equal(result.recorded, true, 'a balance cap must not prevent legitimate progress');
  assert.equal(result.completed, true); assert.equal(result.firstCompletion, true);
  assert.equal(result.next.id, 'coast-clock');
  assert.equal(recordCampaignResult(result.state, finished(), receipt).recorded, false);
  const reloaded = normalizeCampaign(JSON.parse(JSON.stringify(result.state)));
  assert.equal(recordCampaignResult(reloaded, finished(), receipt).recorded, false);
});

test('primary campaign goals gate progression while replay bonuses accumulate without double-awards', () => {
  const initial = normalizeCampaign(), slow = finished({position:8,recoveries:5});
  const first = recordCampaignResult(initial, slow, receipt);
  assert.deepEqual(initial.events, {}); assert.equal(first.newlyEarned.length, 1);
  assert.equal(canStartCampaignEvent(first.state, 'coast-clock'), true);
  assert.equal(canStartCampaignEvent(first.state, 'dockyard-podium'), false);
  const replay = recordCampaignResult(first.state, finished({raceId:'race-development-0002'}), receipt);
  assert.equal(replay.firstCompletion, false); assert.equal(replay.newlyEarned.length, 2);
  assert.equal(replay.state.events['harbor-first'].objectives.length, 3);
  assert.equal(first.state.events['harbor-first'].objectives.length, 1);
  const repeat = recordCampaignResult(replay.state, finished({raceId:'race-development-0003'}), receipt);
  assert.equal(repeat.newlyEarned.length, 0);
});

test('all eighteen campaign events advance only through their authored primary condition and end with no invented next event', () => {
  let state = normalizeCampaign();
  for (const [index, definition] of CAMPAIGN_EVENTS.entries()) {
    const event = getNextCampaignEvent(state, DEFAULT_VEHICLE_ID);
    assert.equal(event.id, definition.id);
    const elapsed = getMedalTargets(event.track, event.vehicle).gold;
    const result = recordCampaignResult(state, finished({...event, elapsed, lapTimes:[elapsed/3,elapsed/3,elapsed/3],
      raceId:`race-campaign-complete-${index}`,position:1,score:2000,recoveries:0,objectiveStats:{perfectNitro:5,burstNitro:5,pickups:10,cleanOvertakes:8,cleanSectors:12}}), receipt);
    assert.equal(result.recorded, true); assert.equal(result.completed, true);
    assert.equal(result.newlyEarned.length, 3);
    state = result.state;
  }
  assert.equal(getNextCampaignEvent(state), null);
  assert.equal(CAMPAIGN_EVENTS.filter(event => isCampaignEventComplete(state,event.id)).length,18);
  assert.match(campaignPanel(state),/ALL CHAPTERS COMPLETE/);
});

test('consistency requires all three real lap timings, not a fabricated one-lap array or mismatched elapsed total', () => {
  let state = normalizeCampaign();
  for (const event of CAMPAIGN_EVENTS.slice(0,8)) state.events[event.id] = {runs:1,objectives:[`0-${event.objectives[0].id}`],bestTime:150};
  const selected = getCampaignEvent('spa-rhythm'), elapsed = getMedalTargets(selected.track,selected.vehicle).gold;
  for (const lapTimes of [[elapsed], [1,1,1], [elapsed/3-5,elapsed/3,elapsed/3+5], [NaN,1,2]]) {
    const result = recordCampaignResult(state,finished({...selected,elapsed,lapTimes,position:1}),receipt);
    assert.equal(result.recorded,true); assert.equal(result.newlyEarned.some(goal=>goal.type==='consistency'),false);
  }
  const good = recordCampaignResult(state,finished({...selected,elapsed,lapTimes:[elapsed/3,elapsed/3,elapsed/3],position:1}),receipt);
  assert.equal(good.newlyEarned.some(goal=>goal.type==='consistency'),true);
});

test('car mastery counts real per-car finishes, banked drift, distinct circuits and reset-free runs exactly once', () => {
  let state = normalizeMastery();
  for (const [index, track] of ['harbor','coast','dockyard'].entries()) {
    const result = recordMasteryResult(state, finished({raceId:`race-mastery-result-${index}`,track,position:2,score:900}),receipt);
    assert.equal(result.recorded,true); state = result.state;
    assert.equal(recordMasteryResult(state,finished({raceId:`race-mastery-result-${index}`,track,position:2,score:900}),receipt).recorded,false);
  }
  const mastery = getCarMastery(state, DEFAULT_VEHICLE_ID);
  assert.equal(mastery.complete,5); assert.equal(mastery.tier,'Car mastered');
  assert.equal(mastery.finishes,3); assert.equal(mastery.driftScore,2700);
  assert.equal(getCarMastery(state,'audi-r18').complete,0);
  assert.equal(getCarMastery(normalizeMastery(JSON.parse(JSON.stringify(state))),DEFAULT_VEHICLE_ID).complete,5);
});

test('solo mastery uses gold targets rather than incorrectly treating every 1/1 run as a podium', () => {
  const gold = getMedalTargets('harbor', DEFAULT_VEHICLE_ID).gold;
  const slow = recordMasteryResult(null,finished({mode:'time-attack',position:1,elapsed:gold+10,recoveries:1}),receipt);
  assert.equal(slow.mastery.strongFinishes,0); assert.equal(slow.mastery.resetFreeFinishes,0);
  const fast = recordMasteryResult(slow.state,finished({raceId:'race-mastery-solo-0002',mode:'time-attack',position:1,elapsed:gold}),receipt);
  assert.equal(fast.mastery.strongFinishes,1); assert.equal(fast.mastery.resetFreeFinishes,1);
  assert.equal(recordMasteryResult(null,finished({mode:'time-attack',position:2}),receipt).recorded,false);
  assert.equal(recordMasteryResult(null,finished(),{...receipt,awarded:false}).recorded,false);
});

test('new local state stays separate from existing progression, rejects corrupt imports and reports unavailable storage', () => {
  const store = memory(); store.setItem('blacktop-bay-progression-v1','existing-credit-and-upgrade-data');
  const campaign = recordCampaignResult(null,finished(),receipt).state;
  const mastery = recordMasteryResult(null,finished(),receipt).state;
  const setups = selectCarSetup(null,DEFAULT_VEHICLE_ID,'endurance').state;
  for (const [key,save,load,state] of [[CAMPAIGN_KEY,persistCampaign,loadCampaign,campaign],
    [MASTERY_KEY,persistMastery,loadMastery,mastery],[SETUPS_KEY,persistSetups,loadSetups,setups]]) {
    assert.equal(save(state,store),true); assert.deepEqual(load(store),state);
    assert.equal(save(state,{setItem(){throw Error('quota');}}),false);
    assert.equal(save(state,null),false);
    store.setItem(key,'{not-json'); assert.deepEqual(load(store),load(null));
    store.setItem(key,JSON.stringify({version:999})); assert.deepEqual(load(store),load(null));
    store.setItem(key,'x'.repeat(1_000_001)); assert.deepEqual(load(store),load(null));
  }
  assert.equal(store.getItem('blacktop-bay-progression-v1'),'existing-credit-and-upgrade-data');
  assert.deepEqual(normalizeCampaign({version:1,events:{'harbor-first':{runs:1,objectives:['bogus','0-finish','0-finish'],bestTime:-5}},recordedRaces:['bad','valid-race-id','valid-race-id']}).events['harbor-first'],
    {runs:1,objectives:['0-finish'],bestTime:null});
  const clean = normalizeMastery({version:1,cars:{[DEFAULT_VEHICLE_ID]:{finishes:1,circuits:['harbor','bad','coast'],strongFinishes:200,resetFreeFinishes:200,driftScore:Infinity}}});
  assert.deepEqual(clean.cars[DEFAULT_VEHICLE_ID],{finishes:1,circuits:['harbor'],strongFinishes:1,driftScore:0,resetFreeFinishes:1});
});

test('development UI has real locked states, selected setup, measurable values and honest currency / mastery copy', () => {
  const campaign = campaignPanel(null);
  assert.match(campaign,/data-campaign-start="harbor-first"/);
  assert.match(campaign,/data-campaign-start="coast-reign" disabled/);
  assert.match(campaign,/Normal race credits apply/);
  const setupState = selectCarSetup(null,DEFAULT_VEHICLE_ID,'grip').state;
  const markup = carDevelopmentPanel({baseSpecs:getUpgradeStats(),setupState});
  assert.match(markup,/data-car-setup="grip" aria-pressed="true"/);
  assert.match(markup,/−4% top speed/); assert.match(markup,/does not secretly increase performance/);
  assert.equal((markup.match(/<progress /g)||[]).length,5);
  assert.match(markup,/role="group" aria-label="Car handling and performance setup"/);
  assert.equal(developmentResultMarkup(null,{recorded:true,newlyEarned:[]}), '');
  const result = recordCampaignResult(null,finished(),receipt);
  assert.match(developmentResultMarkup(result,null,{campaignSaved:false}),/Browser storage is unavailable/);
  assert.match(developmentResultMarkup(null,{recorded:true,newlyEarned:[]},{masterySaved:false}),/Browser storage is unavailable/);
  assert.match(campaignPanel(result.state,{selectedEventId:'harbor-first'}),/YOUR SELECTED EVENT/);
  assert.match(campaignPanel(result.state,{selectedEventId:'harbor-first'}),/id="campaign-next-title">First light/);
  assert.match(campaignPanel(result.state,{selectedEventId:'bay-final'}),/id="campaign-next-title">Open road/);
});

test('workshop current and next-level numbers use the fitted setup without changing upgrade prices',()=>{
  const state=loadProgression(null), current=getUpgradeStats(DEFAULT_VEHICLE_ID,{},'grip');
  const panel=upgradePanel(state,DEFAULT_VEHICLE_ID,'grip');
  assert.ok(panel.includes(`${Math.round(current.topSpeed*3.6)} km/h`));
  assert.ok(panel.includes(current.acceleration.toFixed(1)));
  assert.match(panel,/Upgrade Engine to level 1 for 200 credits/);
  assert.equal(state.credits,1200);
});

test('mount reuse removes stale listeners and dispatches intent without saving or starting twice', () => {
  const listeners = new Set(), container = {innerHTML:'', contains:()=>true, addEventListener:(name, fn)=>listeners.add(fn),removeEventListener:(name,fn)=>listeners.delete(fn)};
  let calls = 0;
  const first = mountCampaignPanel(container,{state:normalizeCampaign(),vehicle:DEFAULT_VEHICLE_ID,onStart:()=>calls++});
  const second = mountCampaignPanel(container,{state:normalizeCampaign(),vehicle:DEFAULT_VEHICLE_ID,onStart:event=>{calls++;assert.equal(event.id,'harbor-first');}});
  assert.equal(listeners.size,1); first.destroy(); assert.equal(listeners.size,1);
  const click = (dataset,disabled=false) => {const button={dataset,disabled}; for(const fn of listeners)fn({target:{closest:()=>button}});};
  click({campaignStart:'coast-reign'}); assert.equal(calls,0);
  click({campaignStart:'harbor-first'}); assert.equal(calls,1);
  second.destroy(); assert.equal(listeners.size,0);
  const setup = mountCarDevelopment(container,{baseSpecs:getUpgradeStats(),onSelect:id=>{calls++;assert.equal(id,'sprint');}});
  click({carSetup:'sprint'}); assert.equal(calls,2); click({carSetup:'bad'});assert.equal(calls,2);
  setup.destroy();assert.equal(listeners.size,0);
});

test('a physics-driven campaign finish carries its setup and advances mastery only after the real reward gate', () => {
  const selected = getCampaignEvent('harbor-first');
  const {race} = createCompletedRaceFixture({...selected,setup:'grip'});
  assert.equal(race.setup,'grip'); assert.equal(race.campaignEventId,'harbor-first');
  assert.equal(race.rivals.length,7); assert.ok(race.rivals.every(rival=>rival.setup==='balanced'));
  assert.ok(race.specs.grip > getUpgradeStats(race.vehicle).grip);
  assert.equal(race.lapTimes.length,3); assert.equal(race.recoveries,0);
  const store = memory(), progression = loadProgression(store);
  const paid = awardRaceCredits(progression,race,store);
  assert.equal(paid.awarded,true); const credits = progression.credits;
  const campaign = recordCampaignResult(null,race,paid), mastery = recordMasteryResult(null,race,paid);
  assert.equal(campaign.recorded,true); assert.equal(campaign.completed,true); assert.equal(mastery.mastery.finishes,1);
  assert.equal(progression.credits,credits,'campaign and mastery never mint money');
  const duplicate = awardRaceCredits(progression,race,store);
  assert.equal(duplicate.awarded,false);
  assert.equal(recordCampaignResult(campaign.state,race,duplicate).recorded,false);
  assert.equal(recordMasteryResult(mastery.state,race,duplicate).recorded,false);
});


test('legacy per-car setups migrate and circuit overrides do not leak to another track or car',()=>{
  const legacy={version:1,cars:{[DEFAULT_VEHICLE_ID]:'grip'}};
  const fitted=selectCarSetup(legacy,DEFAULT_VEHICLE_ID,'sprint','monza');
  assert.equal(getCarSetup(fitted.state,DEFAULT_VEHICLE_ID,'monza'),'sprint');
  assert.equal(getCarSetup(fitted.state,DEFAULT_VEHICLE_ID,'harbor'),'grip');
  assert.equal(getCarSetup(fitted.state,'audi-r18','monza'),'balanced');
  assert.deepEqual(legacy,{version:1,cars:{[DEFAULT_VEHICLE_ID]:'grip'}});
  const defaultChanged=selectCarSetup(fitted.state,DEFAULT_VEHICLE_ID,'endurance');
  assert.equal(getCarSetup(defaultChanged.state,DEFAULT_VEHICLE_ID,'monza'),'sprint');
  const cleared=clearCircuitSetup(defaultChanged.state,DEFAULT_VEHICLE_ID,'monza');
  assert.equal(getCarSetup(cleared.state,DEFAULT_VEHICLE_ID,'monza'),'endurance');
  assert.equal(selectCarSetup(cleared.state,DEFAULT_VEHICLE_ID,'grip','unknown').selected,false);
  assert.deepEqual(normalizeSetups(JSON.parse(JSON.stringify(fitted.state))),fitted.state);
});

test('advanced campaign uses actual bounded event counters and preserves the first twelve earned events',()=>{
  const old=normalizeCampaign();
  for(const definition of CAMPAIGN_EVENTS.slice(0,12))old.events[definition.id]={runs:1,objectives:definition.objectives.map((item,index)=>`${index}-${item.id}`),bestTime:150};
  const original=structuredClone(old), event=getNextCampaignEvent(old);
  assert.equal(event.id,'harbor-perfect');
  for(const metric of [undefined,NaN,Infinity,-1,1.5,100001,1]){
    const result=recordCampaignResult(old,finished({...event,position:1,objectiveStats:{perfectNitro:metric}}),receipt);
    assert.equal(result.completed,false,`invalid/insufficient counter ${metric}`);
  }
  const result=recordCampaignResult(old,finished({...event,position:1,objectiveStats:{perfectNitro:2,pickups:3}}),receipt);
  assert.equal(result.completed,true);assert.equal(result.newlyEarned.length,3);
  for(const id of Object.keys(original.events))assert.deepEqual(result.state.events[id],original.events[id]);
  assert.deepEqual(old,original);
  assert.match(getCampaignSuggestion(result.state).description,/Burst Nitro twice/);
});
