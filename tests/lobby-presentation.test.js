import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {lobbyGoal,lobbyGoalMarkup,lobbyRaceLabels,circuitPreviewImage} from '../src/lobby-presentation.js';
import {CAMPAIGN_EVENTS,getCampaignEvent,recordCampaignResult,persistCampaign,loadCampaign} from '../src/driver-campaign.js';
import {recordMasteryResult,persistMastery,loadMastery} from '../src/car-mastery.js';
import {getMedalTargets} from '../src/race-career.js';
import {DEFAULT_VEHICLE_ID} from '../src/vehicles.js';
import {TRACKS} from '../src/track.js';

const receipt={awarded:true,credits:350,persisted:true};
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};};
const finish=(event,extra={})=>{
  const elapsed=getMedalTargets(event.track,event.vehicle).gold;
  return {...event,raceId:`lobby-goal-${event.id}`,state:'finished',completedLaps:3,totalLaps:3,elapsed,
    lapTimes:[elapsed/3,elapsed/3,elapsed/3],position:1,score:2000,recoveries:0,
    objectiveStats:{perfectNitro:5,burstNitro:5,pickups:10,cleanOvertakes:8,cleanSectors:12},...extra};
};
function campaignThrough(count=CAMPAIGN_EVENTS.length,{firstBonusMissing=false}={}){
  let state;
  for(const [index,definition] of CAMPAIGN_EVENTS.slice(0,count).entries()){
    const result=recordCampaignResult(state,finish(getCampaignEvent(definition.id),index===0&&firstBonusMissing?{position:8,recoveries:5}:{}),receipt);
    assert.equal(result.recorded,true);assert.equal(result.completed,true);state=result.state;
  }
  const storage=memory();assert.equal(persistCampaign(state,storage),true);return loadCampaign(storage);
}
function masteryFromRuns(score){
  let state;
  for(const [index,track] of ['harbor','coast','dockyard'].entries()){
    const result=recordMasteryResult(state,finish(getCampaignEvent('harbor-first'),{raceId:`lobby-mastery-${index}`,track,score,position:2}),receipt);
    assert.equal(result.recorded,true);state=result.state;
  }
  const storage=memory();assert.equal(persistMastery(state,storage),true);return loadMastery(storage);
}

test('lobby campaign goal starts at zero and advances to the actual next unlocked event after a persisted finish',()=>{
  const initial=lobbyGoal();
  assert.equal(initial.eventId,'harbor-first');assert.equal(initial.label,'First light');
  assert.equal(initial.progress,'0 / 3 objectives earned');assert.equal(initial.fraction,0);
  assert.equal(initial.reward,'Unlock: Open road');assert.equal(initial.action,'View event');
  const campaign=campaignThrough(1,{firstBonusMissing:true}),before=structuredClone(campaign);
  const next=lobbyGoal({campaign,vehicle:DEFAULT_VEHICLE_ID});
  assert.equal(next.eventId,'coast-clock');assert.equal(next.label,'Open road');
  assert.equal(next.progress,'0 / 3 objectives earned');assert.equal(next.reward,'Unlock: Dockside contender');
  assert.equal(next.eyebrow,'NEXT GOAL');assert.equal(next.bonus,false);
  assert.deepEqual(campaign,before,'reading the lobby never awards objectives or mutates saved progress');
});

test('earned bonus objectives remain visible while an incomplete primary objective still gates the later event',()=>{
  const campaign=campaignThrough(2),event=getCampaignEvent('dockyard-podium');
  const result=recordCampaignResult(campaign,finish(event,{position:8,score:400}),receipt);
  assert.equal(result.completed,false);assert.equal(result.newlyEarned.length,2);
  const storage=memory();assert.equal(persistCampaign(result.state,storage),true);
  const goal=lobbyGoal({campaign:loadCampaign(storage),vehicle:DEFAULT_VEHICLE_ID});
  assert.equal(goal.eventId,'dockyard-podium');assert.equal(goal.progress,'2 / 3 objectives earned');
  assert.equal(goal.fraction,2/3);assert.match(goal.description,/Finish in the top 3/);
  assert.equal(goal.reward,'Unlock: Summit rhythm');
  const markup=lobbyGoalMarkup(goal);assert.ok(markup.includes(goal.progress));assert.ok(markup.includes(goal.reward));
});

test('advanced and final career goals report their authored unlock, with no invented event after the last challenge',()=>{
  const advanced=lobbyGoal({campaign:campaignThrough(12),vehicle:DEFAULT_VEHICLE_ID});
  assert.equal(advanced.eventId,'harbor-perfect');assert.match(advanced.description,/Activate Perfect Nitro twice/);
  assert.equal(advanced.reward,'Unlock: Full charge');
  const last=lobbyGoal({campaign:campaignThrough(17),vehicle:DEFAULT_VEHICLE_ID});
  assert.equal(last.eventId,'bay-racecraft-final');assert.equal(last.reward,'Complete the career path');
  assert.match(last.description,/Win the race/);
});

test('after all primary events the lobby presents missing bonuses before car mastery and promises no second unlock',()=>{
  const campaign=campaignThrough(undefined,{firstBonusMissing:true});
  const goal=lobbyGoal({campaign,vehicle:DEFAULT_VEHICLE_ID});
  assert.equal(goal.kind,'campaign');assert.equal(goal.eventId,'harbor-first');assert.equal(goal.bonus,true);
  assert.equal(goal.eyebrow,'BONUS GOAL');assert.equal(goal.progress,'1 / 3 objectives earned');
  assert.equal(goal.fraction,1/3);assert.equal(goal.reward,'Earn this bonus objective');
  assert.match(goal.description,/Finish in the top 5/);assert.doesNotMatch(goal.reward,/Unlock/);
});

test('completed campaign switches to the nearest real per-car mastery milestone with readable numeric progress',()=>{
  const campaign=campaignThrough(),mastery=masteryFromRuns(800),before=structuredClone(mastery);
  const goal=lobbyGoal({campaign,mastery,vehicle:DEFAULT_VEHICLE_ID});
  assert.equal(goal.kind,'mastery');assert.equal(goal.eyebrow,'CAR MASTERY');assert.equal(goal.label,'Corner flow');
  assert.equal(goal.current,2400);assert.equal(goal.target,2500);assert.equal(goal.progress,'2,400 / 2,500');
  assert.equal(goal.fraction,.96);assert.equal(goal.action,'View mastery');assert.equal(goal.reward,'Earn: Corner flow');
  assert.match(goal.description,/100 more banked drift points/);
  const other=lobbyGoal({campaign,mastery,vehicle:'audi-r18'});
  assert.equal(other.label,'First finish');assert.equal(other.progress,'0 / 1');assert.equal(other.fraction,0);
  assert.deepEqual(mastery,before,'changing the selected car cannot transfer mastery progress');
});

test('full career and selected-car mastery completion returns circuit browsing rather than a nonexistent reward',()=>{
  const goal=lobbyGoal({campaign:campaignThrough(),mastery:masteryFromRuns(900),vehicle:DEFAULT_VEHICLE_ID});
  assert.equal(goal.kind,'complete');assert.equal(goal.eyebrow,'YOUR NEXT DRIVE');assert.equal(goal.fraction,1);
  assert.equal(goal.progress,'Career and car mastery complete');assert.equal(goal.action,'Browse circuits');
  assert.equal(goal.reward,'Chase a faster personal best');assert.equal(goal.eventId,undefined);
  assert.match(lobbyGoalMarkup(goal),/width:100%/);
});

test('lobby goal markup escapes every text field and clamps the visual meter without introducing an action link',()=>{
  const unsafe=`<img src=x onerror="bad()"> & 'win'`,safe='&lt;img src=x onerror=&quot;bad()&quot;&gt; &amp; &#39;win&#39;';
  const goal=Object.fromEntries(['eyebrow','label','description','progress','action','reward'].map(key=>[key,unsafe]));
  const markup=lobbyGoalMarkup({...goal,fraction:2});
  assert.equal(markup.split(safe).length-1,6);assert.doesNotMatch(markup,/<img|<script|<a\s|<button\s/);
  assert.match(markup,/width:100%/);assert.match(lobbyGoalMarkup({...goal,fraction:-2}),/width:0%/);
  assert.match(markup,/aria-hidden="true"/,'the meter is decorative; progress stays available as text');
});

test('circuit artwork only resolves shipping track IDs and each approved path exists locally',()=>{
  for(const track of TRACKS){
    const path=circuitPreviewImage(track);assert.equal(path,`/assets/circuits/previews/${track.id}.webp`);
    assert.equal(fs.existsSync(new URL(`../public${path}`,import.meta.url)),true,`${track.id}: shipping preview is present`);
  }
  for(const id of ['../harbor','harbor/../../secret','https://example.test/x','javascript:bad()','__proto__','constructor','harbor.webp','unknown','HARBOR'])
    assert.equal(circuitPreviewImage({id}),null,id);
  for(const input of [null,undefined,{},'harbor'])assert.equal(circuitPreviewImage(input),null);
  assert.equal(circuitPreviewImage({id:'harbor',image:'https://example.test/untrusted.webp'}),'/assets/circuits/previews/harbor.webp');
});

test('lobby race labels reflect solo, tour and bound event rules while malformed options use safe defaults',()=>{
  assert.deepEqual(lobbyRaceLabels({mode:'time-attack',difficulty:'pro'}),{title:'Chase your best.',settings:'Solo · Targets & ghosts'});
  assert.deepEqual(lobbyRaceLabels({mode:'championship',difficulty:'relaxed'}),{title:'Make every round count.',settings:'Difficulty · Club'});
  assert.deepEqual(lobbyRaceLabels({mode:'bad',difficulty:'bad'}),{title:'Own the next corner.',settings:'Difficulty · Sport'});
  const solo=getCampaignEvent('coast-clock'),race=getCampaignEvent('bay-racecraft-final');
  assert.deepEqual(lobbyRaceLabels(solo,solo),{title:'Open road',settings:'Event rules · Solo'});
  assert.deepEqual(lobbyRaceLabels(race,race),{title:'Complete driver',settings:'Event rules · Pro'});
});
