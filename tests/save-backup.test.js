import test from 'node:test';
import assert from 'node:assert/strict';
import {exportSaveBackup, inspectSaveBackup, importSaveBackup, recoverSaveImport, exportRecoveryBackup, SAVE_IMPORT_JOURNAL_KEY} from '../src/save-backup.js';
import {DEFAULT_VEHICLE_ID} from '../src/vehicles.js';
import {LEGACY_VEHICLES} from '../src/legacy-vehicles.js';
import {PAINT_KEY} from '../src/paint.js';
import {normalizeProgression,PROGRESSION_KEY} from '../src/progression.js';
import {selectCarSetup,SETUPS_KEY} from '../src/car-setups.js';
import {STORAGE_KEY} from '../src/storage.js';
const prefs='blacktop-bay-choices-v1';
function memory(initial={}){const map=new Map(Object.entries(initial));return {map,get length(){return map.size;},key:index=>[...map.keys()][index]??null,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};}
const snapshot=store=>Object.fromEntries(store.map);
const validBackup=()=>exportSaveBackup({storage:memory(),now:1000});

test('full backups round-trip every supported section and all record scopes without consent or authentication data',()=>{
  const progress=normalizeProgression();progress.credits=4200;progress.cars[DEFAULT_VEHICLE_ID].engine=2;
  const setups=selectCarSetup(null,DEFAULT_VEHICLE_ID,'sprint','monza').state;
  const recordKey=`${STORAGE_KEY}-harbor-${DEFAULT_VEHICLE_ID}-time-attack-solo-stock-handling-20261002-v1`;
  const source=memory({[PROGRESSION_KEY]:JSON.stringify(progress),[SETUPS_KEY]:JSON.stringify(setups),[prefs]:JSON.stringify({vehicle:DEFAULT_VEHICLE_ID,track:'monza',sound:false}),
    [recordKey]:JSON.stringify({bestTime:100,bestScore:250,ghost:[{t:0,x:0,z:0,yaw:0},{t:100,x:1,z:1,yaw:1}],sound:false}),
    'camber-reign-campaign-v1':JSON.stringify({version:1,events:{'harbor-first':{runs:1,objectives:['0-finish'],bestTime:120}},recordedRaces:['race-backup-campaign']}),
    'camber-reign-mastery-v1':JSON.stringify({version:1,cars:{[DEFAULT_VEHICLE_ID]:{finishes:1,circuits:['harbor'],strongFinishes:1,driftScore:150,resetFreeFinishes:1}},recordedRaces:['race-backup-campaign']}),
    'blacktop-bay-favorites-v1':JSON.stringify([DEFAULT_VEHICLE_ID]),'blacktop-bay-paint-v1':JSON.stringify({[DEFAULT_VEHICLE_ID]:{color:'blue',finish:'satin'}}),
    'blacktop-bay-career-v1':JSON.stringify({version:1,records:{},recordedRaces:[],completedTours:3,activeTour:null,lastTour:null}),
    'camber-reign-driving-school-v1':'complete','camber-reign-analytics-consent':'granted','firebase:authUser:secret':'auth-token',
    'unrelated-notes':'private'});
  const exported=exportSaveBackup({storage:source,now:1000});assert.equal(exported.ok,true,exported.error);
  for(const secret of ['auth-token','granted','unrelated-notes','firebase'])assert.equal(exported.json.includes(secret),false);
  const target=memory({'camber-reign-analytics-consent':'denied','firebase:authUser:secret':'keep-token',[STORAGE_KEY]:JSON.stringify({bestTime:null,bestScore:10,ghost:[],sound:true})});
  const restored=importSaveBackup(exported.json,{storage:target});assert.equal(restored.ok,true,restored.error);assert.equal(restored.persisted,true);
  assert.equal(restored.states.progression.credits,4200);assert.equal(restored.states.progression.cars[DEFAULT_VEHICLE_ID].engine,2);
  assert.equal(restored.states.setups.circuits[DEFAULT_VEHICLE_ID].monza,'sprint');assert.equal(restored.states.school,'complete');
  assert.deepEqual(restored.states.campaign.events['harbor-first'].objectives,['0-finish']);assert.equal(restored.states.mastery.cars[DEFAULT_VEHICLE_ID].driftScore,150);
  assert.equal(restored.states.career.completedTours,3);assert.deepEqual(restored.states.favorites,[DEFAULT_VEHICLE_ID]);assert.deepEqual(restored.states.paint[DEFAULT_VEHICLE_ID],{color:'blue',finish:'satin'});
  assert.equal(target.getItem('camber-reign-analytics-consent'),'denied');assert.equal(target.getItem('firebase:authUser:secret'),'keep-token');
  assert.equal(target.getItem(STORAGE_KEY),null,'replace removes stale game record scopes');
  assert.equal(target.getItem(SAVE_IMPORT_JOURNAL_KEY),null);assert.equal(JSON.parse(target.getItem(recordKey)).bestTime,100);
  assert.deepEqual(inspectSaveBackup(exportSaveBackup({storage:target,now:2000}).json).states,restored.states);
});

test('malformed, foreign, partial and impossible backups fail before the first storage mutation',()=>{
  const base=JSON.parse(validBackup().json), corrupt=[];
  for(const mutate of [v=>v.version=99,v=>delete v.data.mastery,v=>v.data.progression.credits=-1,v=>v.data.progression.cars[DEFAULT_VEHICLE_ID].engine=6,
    v=>v.data.preferences.sound='yes',v=>v.data.preferences.secret='token',v=>v.data.preferences.controls={touchSize:10},
    v=>v.data.setups.circuits={[DEFAULT_VEHICLE_ID]:{monza:'impossible'}},v=>v.data.school='paid',v=>v.data.campaign.events.bad={runs:1,objectives:[],bestTime:20},
    v=>v.data.records=[{key:'analytics-consent',value:{}}],v=>v.data.records=[{key:STORAGE_KEY,value:{bestTime:20,bestScore:0,ghost:[{t:2,x:0,z:0,yaw:0},{t:1,x:1,z:1,yaw:0}],sound:true}}]]){
    const value=structuredClone(base);mutate(value);corrupt.push(JSON.stringify(value));
  }
  corrupt.push('{not-json','{"__proto__":{}}',validBackup().json.replace('"credits": 1200','"credits": 1e400'));
  for(const json of corrupt){const store=memory({important:'untouched'}),before=snapshot(store);const result=importSaveBackup(json,{storage:store});assert.equal(result.ok,false,json.slice(0,100));assert.deepEqual(snapshot(store),before);}
});

test('session-only choices and earned progress can be exported without falsely claiming they were saved',()=>{
  const store=memory(),progress=normalizeProgression();progress.credits=5300;
  const before=snapshot(store),result=exportSaveBackup({storage:store,states:{progression:progress,preferences:{sound:false}},now:1000});
  assert.equal(result.ok,true,result.error);assert.equal(inspectSaveBackup(result.json).states.progression.credits,5300);assert.deepEqual(snapshot(store),before);
});

test('a failed write rolls back every game key exactly and preserves unrelated storage',()=>{
  const store=memory({[prefs]:'{"sound":false}',[STORAGE_KEY]:'{"bestTime":null,"bestScore":15,"ghost":[],"sound":false}',privacy:'no'}),before=snapshot(store);
  const write=store.setItem;let failed=false;store.setItem=(key,value)=>{if(key===PROGRESSION_KEY&&!failed){failed=true;throw Error('quota');}write(key,value);};
  const result=importSaveBackup(validBackup().json,{storage:store});assert.equal(result.ok,false);assert.equal(result.rolledBack,true);assert.equal(result.persisted,false);assert.deepEqual(snapshot(store),before);
});

test('failed rollback retains its durable original snapshot, rejects another import and recovers after reload',()=>{
  const store=memory({[prefs]:'{"sound":false}',[STORAGE_KEY]:'{"bestTime":null,"bestScore":15,"ghost":[],"sound":false}'}),before=snapshot(store);
  const write=store.setItem;let broken=false;store.setItem=(key,value)=>{if(key===PROGRESSION_KEY)broken=true;if(broken)throw Error('storage interrupted');write(key,value);};
  const result=importSaveBackup(validBackup().json,{storage:store});assert.equal(result.ok,false);assert.equal(result.recoveryRequired,true);assert.equal(result.rolledBack,false);
  const journal=store.getItem(SAVE_IMPORT_JOURNAL_KEY);assert.ok(journal);assert.equal(importSaveBackup(validBackup().json,{storage:store}).recoveryRequired,true);assert.equal(store.getItem(SAVE_IMPORT_JOURNAL_KEY),journal);
  assert.equal(exportSaveBackup({storage:store}).ok,false);assert.equal(exportRecoveryBackup({storage:store}).ok,true);
  store.setItem=write;assert.deepEqual(recoverSaveImport({storage:store}),{ok:true,recovered:true});assert.deepEqual(snapshot(store),before);
  assert.deepEqual(recoverSaveImport({storage:store}),{ok:true,recovered:false});
});

test('unavailable storage, quota before snapshot and silent write failures never claim import success',()=>{
  assert.equal(exportSaveBackup({storage:null}).ok,false);
  const store=memory({[prefs]:'{"sound":false}'}),before=snapshot(store);store.setItem=()=>{throw Error('quota');};
  assert.equal(importSaveBackup(validBackup().json,{storage:store}).ok,false);assert.deepEqual(snapshot(store),before);
  const silent=memory();silent.setItem=()=>{};const result=importSaveBackup(validBackup().json,{storage:silent});assert.equal(result.ok,false);assert.equal(result.persisted,false);
});


test('normal denied-storage sessions remain playable but a known malformed recovery journal blocks mixed saves',()=>{
  assert.deepEqual(recoverSaveImport({storage:{getItem(){throw Error('denied');}}}),{ok:true,recovered:false,storageUnavailable:true});
  assert.deepEqual(recoverSaveImport({storage:null}),{ok:true,recovered:false});
  assert.equal(recoverSaveImport({storage:memory({[SAVE_IMPORT_JOURNAL_KEY]:'broken'})}).recoveryRequired,true);
});


test('retired car IDs including prototype survive full stored and session backup round trips',()=>{
  const progress=normalizeProgression(),paint={};progress.credits=4321;
  for(const {id} of LEGACY_VEHICLES){progress.cars[id]={engine:3,tyres:2,nitro:1,handling:4};paint[id]={color:'blue',finish:'satin'};}
  assert.ok(Object.hasOwn(progress.cars,'prototype'));
  const source=memory({[PROGRESSION_KEY]:JSON.stringify(progress),[PAINT_KEY]:JSON.stringify(paint)});
  for(const states of [{},{progression:progress,paint}]){
    const exported=exportSaveBackup({storage:source,states,now:1000});assert.equal(exported.ok,true,exported.error);
    const target=memory(),imported=importSaveBackup(exported.json,{storage:target});assert.equal(imported.ok,true,imported.error);
    for(const {id} of LEGACY_VEHICLES){assert.deepEqual(imported.states.progression.cars[id],progress.cars[id]);assert.deepEqual(imported.states.paint[id],paint[id]);}
    assert.equal(imported.states.progression.credits,4321);
    assert.equal(exportSaveBackup({storage:target,now:2000}).ok,true);
  }
});

test('allowing a retired prototype car key does not allow arbitrary prototype properties or pollution keys',()=>{
  const base=JSON.parse(validBackup().json);
  for(const mutate of [value=>value.data.preferences.prototype={secret:'no'},value=>value.data.mastery.prototype={},
    value=>value.data.progression.cars.prototype={engine:3,tyres:2,nitro:1,handling:4,secret:'no'},
    value=>value.data.progression.cars.prototype=JSON.parse('{"engine":3,"tyres":2,"nitro":1,"handling":4,"constructor":{}}'),
    value=>value.data.paint.prototype=JSON.parse('{"color":"blue","finish":"satin","__proto__":{"polluted":true}}')]){
    const value=structuredClone(base);mutate(value);const target=memory({privacy:'keep'}),before=snapshot(target);
    assert.equal(importSaveBackup(JSON.stringify(value),{storage:target}).ok,false);assert.deepEqual(snapshot(target),before);
  }
  assert.equal({}.polluted,undefined);
});
