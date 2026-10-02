import test from 'node:test';
import assert from 'node:assert/strict';
import {beginChampionship,nextChampionshipRace,recordCareerResult,refreshChampionshipRound,finalizeChampionshipRound,finalizeInterruptedTourRounds,getChampionshipStandings,bindChampionshipFleet,normalizeCareer} from '../src/race-career.js';
import {RIVAL_GRID} from '../src/rivals.js';
import {DEFAULT_VEHICLE_ID} from '../src/vehicles.js';
const paid={awarded:true,credits:650};
const leaderboard=(complete=false)=>[{id:'mira',name:'Mira',vehicle:RIVAL_GRID[0].vehicle,position:1,finished:true,finishTime:110,completedLaps:3},
  {id:'player',name:'You',vehicle:DEFAULT_VEHICLE_ID,position:2,finished:true,finishTime:120,completedLaps:3},
  ...RIVAL_GRID.slice(1).map((r,index)=>({...r,position:index+3,finished:complete,finishTime:complete?125+index:null,completedLaps:complete?3:2}))];
const finish=(next,id='race-standings-001',complete=false)=>({...next,raceId:id,state:'finished',elapsed:120,position:2,totalLaps:3,completedLaps:3,score:0,leaderboard:leaderboard(complete)});
const start=()=>beginChampionship(null,{id:'tour-standings-001',vehicle:DEFAULT_VEHICLE_ID,track:'harbor'}).state;

test('tour snapshots persist actual rival finishes while pending cars earn no invented result',()=>{
  let state=start();const next=nextChampionshipRace(state),race=finish(next),result=recordCareerResult(state,race,paid);state=result.state;
  const table=getChampionshipStandings(state.activeTour);assert.equal(table.provisional,true);assert.equal(table.rows.find(row=>row.id==='mira').points,25);
  assert.equal(table.rows.find(row=>row.id==='player').points,18);assert.equal(table.rows.find(row=>row.id==='jax').points,0);
  assert.equal(state.activeTour.rounds[0].classification.find(row=>row.id==='jax').finishTime,null);
  assert.deepEqual(normalizeCareer(JSON.parse(JSON.stringify(state))),state);
  const updated=refreshChampionshipRound(state,{...race,leaderboard:leaderboard(true)});assert.equal(updated.changed,true);assert.equal(getChampionshipStandings(updated.state.activeTour).provisional,false);
  assert.equal(updated.state.activeTour.credits,650);assert.equal(updated.state.activeTour.rounds.length,1);
  assert.equal(refreshChampionshipRound(updated.state,{...race,leaderboard:leaderboard(true)}).changed,false);
});

test('explicit continue classifies unfinished rivals DNF and locks the decision without minting credits',()=>{
  let state=start();const race=finish(nextChampionshipRace(state));state=recordCareerResult(state,race,paid).state;
  const final=finalizeChampionshipRound(state,race);assert.equal(final.changed,true);const jax=final.state.activeTour.rounds[0].classification.find(row=>row.id==='jax');
  assert.deepEqual({status:jax.status,finishTime:jax.finishTime,position:jax.position,points:jax.points},{status:'dnf',finishTime:null,position:null,points:0});
  assert.equal(getChampionshipStandings(final.state.activeTour).provisional,false);
  assert.equal(refreshChampionshipRound(final.state,{...race,leaderboard:leaderboard(true)}).changed,false);
});

test('three real rounds produce persistent total standings with fixed rival identities and vehicles',()=>{
  let state=bindChampionshipFleet(start(),RIVAL_GRID.map(r=>r.vehicle)).state;
  assert.deepEqual(nextChampionshipRace(state).rivalVehicles,RIVAL_GRID.map(r=>r.vehicle));
  for(let i=0;i<3;i++){const next=nextChampionshipRace(state);state=recordCareerResult(state,finish(next,`race-standings-${i}`,true),paid).state;}
  assert.equal(state.activeTour,null);const standings=getChampionshipStandings(state.lastTour);assert.equal(standings.complete,true);assert.equal(standings.rows[0].id,'mira');assert.equal(standings.rows[0].points,75);assert.equal(standings.rows.find(row=>row.id==='player').points,54);
  assert.deepEqual(getChampionshipStandings(normalizeCareer(JSON.parse(JSON.stringify(state))).lastTour),standings);
});

test('malformed duplicate classification and unrelated updates cannot fabricate rival points',()=>{
  let state=start();const race=finish(nextChampionshipRace(state));state=recordCareerResult(state,race,paid).state;
  const bad=structuredClone(race);bad.leaderboard[2].id='mira';assert.equal(refreshChampionshipRound(state,bad).changed,false);
  assert.equal(refreshChampionshipRound(state,{...race,raceId:'different-race-001'}).changed,false);
  const tampered=structuredClone(state);tampered.activeTour.rounds[0].classification[0].points=999;assert.equal(normalizeCareer(tampered).activeTour.rounds[0].classification[0].points,25);
});


test('legacy tours retain real player points while missing historical rivals remain explicitly unrecorded',()=>{
  const state=start(),race=finish(nextChampionshipRace(state));delete race.leaderboard;
  const recorded=recordCareerResult(state,race,paid).state;
  const standings=getChampionshipStandings(recorded.activeTour);
  assert.equal(standings.rows.find(row=>row.id==='player').points,18);
  assert.equal(standings.rows.find(row=>row.id==='player').rounds[0].status,'finished');
  assert.equal(standings.rows.find(row=>row.id==='jax').rounds[0].status,'unrecorded');
  assert.equal(standings.provisional,true);
});


test('boot finalizes an interrupted active-tour results round without a new race ID or invented times',()=>{
  const race=finish(nextChampionshipRace(start()));
  const saved=recordCareerResult(start(),race,paid).state, before=structuredClone(saved);
  const result=finalizeInterruptedTourRounds(JSON.parse(JSON.stringify(saved)));
  assert.equal(result.changed,true);assert.equal(result.classified,6);
  assert.equal(nextChampionshipRace(result.state).round,2);
  const rows=result.state.activeTour.rounds[0].classification;
  for(const row of rows.filter(row=>row.status==='dnf'))assert.deepEqual({position:row.position,finishTime:row.finishTime,points:row.points},{position:null,finishTime:null,points:0});
  for(const row of rows.filter(row=>row.status==='finished'))assert.deepEqual(row,before.activeTour.rounds[0].classification.find(old=>old.id===row.id));
  assert.equal(getChampionshipStandings(result.state.activeTour).provisional,false);
  assert.equal(result.state.activeTour.credits,before.activeTour.credits);assert.equal(result.state.activeTour.points,before.activeTour.points);
  assert.deepEqual(result.state.recordedRaces,before.recordedRaces);assert.deepEqual(saved,before);
  assert.deepEqual(finalizeInterruptedTourRounds(result.state),{state:result.state,changed:false,classified:0});
  assert.equal(refreshChampionshipRound(result.state,{...race,leaderboard:leaderboard(true)}).changed,false,'interrupted DNF cannot later turn into a finish');
});

test('boot handles pending rounds in both completed history and a new active tour, while leaving legacy missing results unknown',()=>{
  let state=start();
  for(let i=0;i<3;i++)state=recordCareerResult(state,finish(nextChampionshipRace(state),`race-interrupted-${i}`,i===0),paid).state;
  state=beginChampionship(state,{id:'tour-interrupted-new',vehicle:DEFAULT_VEHICLE_ID,track:'coast'}).state;
  state=recordCareerResult(state,finish(nextChampionshipRace(state),'race-interrupted-new'),paid).state;
  const before=structuredClone(state), result=finalizeInterruptedTourRounds(state);
  assert.equal(result.classified,18);assert.equal(result.state.completedTours,1);
  assert.equal(getChampionshipStandings(result.state.lastTour).complete,true);
  assert.equal(getChampionshipStandings(result.state.activeTour).provisional,false);
  assert.deepEqual(result.state.lastTour.rounds[0],before.lastTour.rounds[0],'already complete round remains exact');
  assert.equal(result.state.lastTour.credits,before.lastTour.credits);assert.deepEqual(state,before);
  const legacy=start(),race=finish(nextChampionshipRace(legacy),'race-interrupted-legacy');delete race.leaderboard;
  const old=recordCareerResult(legacy,race,paid).state, unchanged=finalizeInterruptedTourRounds(old);
  assert.equal(unchanged.changed,false);assert.equal(unchanged.classified,0);
  assert.equal(getChampionshipStandings(unchanged.state.activeTour).rows.find(row=>row.id==='jax').rounds[0].status,'unrecorded');
  assert.equal(finalizeInterruptedTourRounds(start()).changed,false,'no completed round means no new classification');
});
