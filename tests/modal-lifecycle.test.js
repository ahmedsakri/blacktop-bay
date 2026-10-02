import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizePlayerControls,actionForKey} from '../src/player-controls.js';
import {isDrivingShortcut} from '../src/driving-controls.js';
import {createRace,startRace,getTrack,getUpgradeStats} from '../src/physics.js';
import {LESSONS,saveSchool,SCHOOL_KEY} from '../src/driving-school.js';
import {circuitPath} from '../src/circuit-routes.js';
import {getVehicle,DEFAULT_VEHICLE_ID} from '../src/vehicles.js';
import {normalizeSetups,getCarSetup,selectCarSetup} from '../src/car-setups.js';
import {recordScope} from '../src/personal-ghost.js';
import {exportSaveBackup,inspectSaveBackup,importSaveBackup} from '../src/save-backup.js';
import {icon} from '../src/icons.js';

// Execute the real orchestration with inert presentation/renderer endpoints.
// This verifies lifecycle transitions; browser layout/focus still need UI QA.
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function section(from,to){const start=main.indexOf(from),end=main.indexOf(to,start);assert.ok(start>=0&&end>start,from);return main.slice(start,end);}
const lifecycleSource=[section('function pauseGame() {','function how() {'),section('function finishSchool(){','function downloadBlob('),section('function backupSummary(','function showRecoveryDialog('),section('window.addEventListener("keydown", (e) => {','window.addEventListener("keyup",')].join('\n');
function memory(initial={}){const values=new Map(Object.entries(initial));return {values,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
function harness({initialMode='countdown',storage=memory()}={}){
 const nodes=new Map(),listeners=new Map(),events=[],navigations=[],pauseFrames=[],calls={clear:0,touch:0,focus:0,unlock:0,result:0,start:0,menu:0,reset:0,close:0,award:0};
 const $=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:'',innerHTML:'',value:'',children:[],append(node){this.children.push(node);},setAttribute(){},focus(){},select(){}});return nodes.get(id);};
 const race=createRace({track:'harbor',mode:'time-attack'});startRace(race);
 let context;
 const values={mode:initialMode,modalKind:'',pauseResumeMode:'racing',last:0,count:3,countValue:3,race,school:null,
  preferences:{vehicle:DEFAULT_VEHICLE_ID,track:'harbor',mode:'race',controls:normalizePlayerControls()},records:{sound:true},progression:{credits:1234},
  TRACK:getTrack('harbor'),LESSONS,saveSchool,localStore:()=>storage,icon,normalizePlayerControls,actionForKey,isDrivingShortcut,heldKeys:new Set(),syncInput(){},
  document:{activeElement:null,querySelector:selector=>selector==='#dialog-actions button'?{click:()=>context.lastDialog.actions[0].action()}:null},
  window:{addEventListener:(name,handler)=>listeners.set(name,handler)},$,performance:{now:()=>1000},
  event:(name,data)=>events.push({name,data}),clearInput:()=>{calls.clear++;values.heldKeys.clear();},updateTouchControls:()=>calls.touch++,renderLesson(){},effects:{clear(){}},
  dialog:config=>{context.lastDialog=config;context.modalKind=config.kind;},closeDialog:()=>{calls.close++;context.modalKind='';},
  screenMode:()=>({active:false,label:'Full-screen play'}),pausePanel:options=>{pauseFrames.push(options);return 'pause';},mountSteeringSettings(){},
  needsLandscape:()=>false,orientationGate(){throw Error('Landscape gate should remain closed');},renderer:{domElement:{focus:()=>calls.focus++}},sound:{unlock:()=>calls.unlock++},
  start:()=>calls.start++,menu:()=>calls.menu++,resetCar:()=>calls.reset++,updateFinish:()=>calls.result++,
  awardRaceCredits(){calls.award++;throw Error('A modal transition must not award credits');},
  stockTrial:()=>false,getVehicle,circuitPath,format:value=>String(value),makeResultCard:()=>({}),location:{origin:'https://example.test',assign:url=>navigations.push(url)},
  inspectSaveBackup,importSaveBackup,exportSaveBackup,showRecoveryDialog(){throw Error('Unexpected recovery UI');},
 };
 context=vm.createContext(values);vm.runInContext(lifecycleSource,context);
 const key=(code='Escape')=>{let prevented=false;listeners.get('keydown')({code,key:code,repeat:false,target:{closest:()=>false},preventDefault(){prevented=true;}});return prevented;};
 return {context,$,race,calls,events,navigations,pauseFrames,storage,key,run:code=>vm.runInContext(code,context),action:label=>context.lastDialog.actions.find(action=>action.label===label).action()};
}

test('countdown pause survives backup Back and Escape without becoming a running race',()=>{
 for(const leave of ['button','escape']){
  const h=harness(),before=JSON.stringify(h.race);h.run('pauseGame()');
  assert.equal(h.context.mode,'paused');assert.equal(h.context.pauseResumeMode,'countdown');assert.equal(h.pauseFrames.at(-1).countdown,true);
  h.run('showSaveBackup()');assert.equal(h.context.modalKind,'backup');
  if(leave==='button')h.action('BACK');else assert.equal(h.key(),true);
  assert.equal(h.context.modalKind,'pause');assert.equal(h.context.mode,'paused');assert.equal(h.pauseFrames.at(-1).countdown,true);
  h.action('KEEP DRIVING');assert.equal(h.context.mode,'countdown');assert.equal(h.context.modalKind,'');
  assert.equal(h.context.count,3);assert.equal(h.context.countValue,3);assert.equal(JSON.stringify(h.race),before);
  assert.equal(h.events.filter(event=>event.name==='race_resume').length,1);assert.equal(h.calls.start,0);assert.equal(h.calls.award,0);
 }
});

test('Escape cannot resume or reward an ended driving-school session',()=>{
 const h=harness({initialMode:'racing'}),before=JSON.stringify(h.race);h.context.school={active:false,skipped:0,index:LESSONS.length};
 h.run('finishSchool()');assert.equal(h.context.modalKind,'school-result');assert.equal(h.context.mode,'paused');assert.equal(h.context.school,null);
 assert.equal(h.storage.getItem(SCHOOL_KEY),'complete');
 const clears=h.calls.clear;assert.equal(h.key(),true);h.key('KeyP');h.key('ShiftLeft');
 assert.equal(h.context.modalKind,'school-result');assert.equal(h.context.mode,'paused');assert.equal(h.calls.clear,clears);
 assert.equal(h.calls.start,0);assert.equal(h.calls.award,0);assert.equal(h.calls.unlock,0);assert.equal(h.calls.close,0);
 assert.equal(h.context.progression.credits,1234);assert.equal(JSON.stringify(h.race),before);
 assert.deepEqual(h.events.map(event=>event.name),['tutorial_complete']);assert.equal(h.context.heldKeys.size,0);
});

test('Escape from result sharing restores the same result and refreshes pending rivals',()=>{
 const h=harness({initialMode:'finished'}),result={kind:'result',title:'Race result',actions:[]};h.context.lastResultDialog=result;h.context.modalKind='result';
 h.run('showShareResult({credits:700})');assert.equal(h.context.modalKind,'share');assert.equal(h.$('share-preview').children.length,1);
 assert.equal(h.key(),true);assert.equal(h.context.modalKind,'result');assert.equal(h.context.lastDialog,result);
 assert.equal(h.context.mode,'finished');assert.equal(h.calls.result,1);assert.equal(h.calls.close,0);assert.equal(h.calls.start,0);assert.equal(h.calls.award,0);
});

test('backup restoration waits for confirmation then navigates to the restored circuit, not the old page',async()=>{
 const preferencesKey='blacktop-bay-choices-v1',source=memory({[preferencesKey]:JSON.stringify({vehicle:DEFAULT_VEHICLE_ID,track:'monza'})});
 const exported=exportSaveBackup({storage:source,now:1000});assert.equal(exported.ok,true,exported.error);
 const target=memory({[preferencesKey]:JSON.stringify({vehicle:DEFAULT_VEHICLE_ID,track:'harbor'}),'camber-reign-analytics-consent':'denied'});
 const h=harness({initialMode:'menu',storage:target});h.run('showSaveBackup()');
 await h.$('backup-file').onchange({target:{files:[{size:exported.json.length,text:async()=>exported.json}]}});
 assert.equal(h.context.modalKind,'backup-confirm');assert.deepEqual(h.navigations,[]);
 assert.equal(JSON.parse(target.getItem(preferencesKey)).track,'harbor');
 h.action('RESTORE & RELOAD');assert.deepEqual(h.navigations,['/circuits/monza/']);
 assert.equal(JSON.parse(target.getItem(preferencesKey)).track,'monza');assert.equal(target.getItem('camber-reign-analytics-consent'),'denied');
});

test('stock trial leaves the garage fitted statistics intact while a new run uses the equal stock build',()=>{
 const preferences={vehicle:DEFAULT_VEHICLE_ID,track:'harbor',mode:'time-attack',difficulty:'street',controls:normalizePlayerControls({stockTrial:true})};
 const upgrades={engine:3,tyres:2,nitro:1,handling:2},setups=selectCarSetup(normalizeSetups(),DEFAULT_VEHICLE_ID,'grip','harbor').state;
 const context=vm.createContext({preferences,progression:{cars:{[DEFAULT_VEHICLE_ID]:upgrades}},carSetups:setups,getUpgradeStats,getCarSetup,recordScope,createRace,school:null,rivalVehicles:[],selectedCampaignEvent:()=>null});
 vm.runInContext(section('const stockTrial=','function event('),context);
 const actual=vm.runInContext('({display:fittedStats(),race:newRace()})',context);
 assert.deepEqual(actual.display,getUpgradeStats(DEFAULT_VEHICLE_ID,upgrades,'grip'));
 assert.deepEqual(actual.race.upgrades,{engine:0,tyres:0,nitro:0,handling:0});assert.equal(actual.race.setup,'balanced');
 assert.deepEqual(actual.race.specs,getUpgradeStats(DEFAULT_VEHICLE_ID,{},'balanced'));
 assert.equal(preferences.controls.stockTrial,true);assert.deepEqual(upgrades,{engine:3,tyres:2,nitro:1,handling:2});
});
