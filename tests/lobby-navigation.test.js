import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {STORAGE_KEY,loadRecords,saveResult} from '../src/storage.js';
import {RACE_MODES,normalizeRaceOptions,getDifficulty,raceFieldSize} from '../src/race-options.js';
import {getCampaignEvent,canStartCampaignEvent,normalizeCampaign} from '../src/driver-campaign.js';
import {recordScope} from '../src/personal-ghost.js';
import {normalizePlayerControls} from '../src/player-controls.js';
import {normalizeSetups,getCarSetup} from '../src/car-setups.js';
import {normalizeMastery} from '../src/car-mastery.js';
import {nextGoalSuggestion} from '../src/driver-development-ui.js';

// Exercise the real lobby orchestration and record adapter with an inert DOM.
// Renderer/audio/network behavior belongs to their own tests and browser QA.
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const section=(start,end)=>{
  const from=source.indexOf(start),to=source.indexOf(end,from);
  assert.ok(from>=0&&to>from,`Missing integration boundary: ${start}`);
  return source.slice(from,to);
};
const storeSource=section('const recordStore = {','const progression =');
const menuSource=section('function updateMenu() {','function updateSound() {');
const optionsSource=section('function updateWallet(){','async function continueTour(');
const campaignSource=section('function selectedCampaignEvent() {','const fittedStats =');
const soundRestore=section('if (typeof preferences.sound === "boolean") records.sound = preferences.sound;','sound.setMuted(!records.sound);');
const navSource=section("for(const button of document.querySelectorAll('[data-lobby-mode]'))button.onclick=", "$('hq-wallet').onclick=");
const recordScopeSource=section('function currentRecordScope(){','const newRace =');
const key=(mode,difficulty='street',upgrades={})=>`${STORAGE_KEY}-${recordScope({track:'harbor',vehicle:'mclaren-p1-gtr',mode,difficulty,upgrades,setup:'balanced'})}`;
function harness({savedSound,blocked=false,campaignEventId=null}={}){
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const modes=[...html.matchAll(/data-lobby-mode="([^"]+)"/g)].map(match=>match[1]);
  const nodes=new Map(),buttons=modes.map(mode=>({dataset:{lobbyMode:mode},attributes:{},setAttribute(name,value){this.attributes[name]=value;}}));
  const values=new Map(),writes=[];
  for(const [mode,bestTime] of [['race',120],['time-attack',103],['championship',132]])values.set(key(mode),JSON.stringify({bestTime,bestScore:100,ghost:[],sound:mode==='race'?savedSound??true:true}));
  const preferences={track:'harbor',vehicle:'mclaren-p1-gtr',mode:'race',difficulty:'street',controls:normalizePlayerControls()};
  const selected=getCampaignEvent(campaignEventId,preferences.vehicle);
  if(selected)Object.assign(preferences,{track:selected.track,mode:selected.mode,difficulty:selected.difficulty});
  const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;}});return nodes.get(id);};
  const context=vm.createContext({preferences,preferenceKey:'blacktop-bay-choices-v1',loadRecords,saveResult,RACE_MODES,normalizeRaceOptions,getDifficulty,raceFieldSize,getCampaignEvent,canStartCampaignEvent,normalizeCampaign,campaignEventId,recordScope,getCarSetup,nextGoalSuggestion,mastery:normalizeMastery(),carSetups:normalizeSetups(),showCampaign(){},
    progression:{credits:1200,cars:{}},$,document:{querySelectorAll:selector=>{assert.equal(selector,'[data-lobby-mode]');return buttons;}},
    localStorage:{getItem(k){if(blocked)throw Error('Unavailable');return values.get(k)??null;},setItem(k,v){if(blocked)throw Error('Unavailable');values.set(k,v);writes.push(k);}},
    updateGarageCopy(){},format:t=>`${t} SEC`});
  vm.runInContext(`${storeSource}\nlet campaign=normalizeCampaign(),selectedCampaignId=campaignEventId;\n${campaignSource}\n${recordScopeSource}\nlet records=loadRecords(recordStore);\n${soundRestore}\n${optionsSource}\n${menuSource}\n${navSource}\nupdateMenu();`,context);
  return {context,preferences,buttons,$,values,writes,click:mode=>buttons.find(button=>button.dataset.lobbyMode===mode).onclick(),records:()=>vm.runInContext('records',context)};
}

test('lobby mode navigation refreshes the real field, selected state and mode-specific best without starting a race',()=>{
  const h=harness(),originalRecords=[...h.values.entries()];
  assert.deepEqual(h.buttons.map(button=>button.dataset.lobbyMode),['race','time-attack']);
  for(const [mode,best,field] of [['time-attack',103,'01'],['race',120,'08']]){
    h.click(mode);
    assert.equal(h.preferences.mode,mode);
    assert.equal(h.$('hq-field-size').textContent,field);
    assert.equal(h.$('lobby-mode-title').textContent,RACE_MODES.find(item=>item.id===mode).label.toUpperCase());
    assert.match(h.$('menu-best').textContent,new RegExp(`${best} SEC`));
    assert.equal(h.$('race-setup-label').textContent,`${RACE_MODES.find(item=>item.id===mode).label} · ${mode==='time-attack'?'Solo':'Sport'}`);
    assert.equal(h.buttons.filter(button=>button.attributes['aria-pressed']==='true').length,1);
    assert.equal(h.buttons.find(button=>button.dataset.lobbyMode===mode).attributes['aria-pressed'],'true');
    assert.equal(JSON.parse(h.values.get('blacktop-bay-choices-v1')).mode,mode);
  }
  assert.ok(h.writes.every(k=>k==='blacktop-bay-choices-v1'),'navigation must not rewrite race results');
  for(const [k,value] of originalRecords)assert.equal(h.values.get(k),value);
  assert.equal(h.preferences.vehicle,'mclaren-p1-gtr');assert.equal(h.preferences.track,'harbor');
});

test('race difficulty and fitted builds keep separate benchmarks while solo difficulty shares the same rules',()=>{
  const h=harness();h.preferences.difficulty='pro';h.click('time-attack');
  assert.equal(h.records().bestTime,103,'solo rules do not change with an opponent difficulty setting');
  vm.runInContext("progression.cars['mclaren-p1-gtr']={engine:1};updateMenu();",h.context);
  assert.equal(h.records().bestTime,null);assert.equal(h.$('menu-best').textContent,'YOUR FIRST NIGHT STARTS HERE.');
  vm.runInContext("saveResult({state:'finished',elapsed:99,score:250,completedLaps:3,totalLaps:3},[],recordStore); updateMenu();",h.context);
  assert.equal(h.records().bestTime,99);assert.match(h.$('menu-best').textContent,/99 SEC/);
  h.click('race');assert.equal(h.records().bestTime,null);
  vm.runInContext("progression.cars['mclaren-p1-gtr']={};updateMenu();",h.context);
  assert.equal(h.records().bestTime,null,'unplayed Pro race cannot borrow the Sport record');
  h.preferences.difficulty='street';h.click('race');assert.equal(h.records().bestTime,120);
  h.click('time-attack');assert.equal(h.records().bestTime,103);
  // Tour remains available in Race setup, rather than a third lobby shortcut.
  h.preferences.mode='championship';vm.runInContext('updateMenu()',h.context);
  assert.equal(h.records().bestTime,132);assert.equal(h.$('hq-field-size').textContent,'08');
  assert.equal(JSON.parse(h.values.get(key('time-attack','pro',{engine:1}))).bestTime,99);
  assert.equal(JSON.parse(h.values.get(key('time-attack'))).bestTime,103,'fitted result preserves the original stock record');
});

test('legacy record mute is promoted to the global preference before switching lobby modes',()=>{
  const h=harness({savedSound:false});
  assert.equal(h.preferences.sound,false);
  for(const mode of ['time-attack','race']){
    h.click(mode);assert.equal(h.records().sound,false);assert.equal(h.preferences.sound,false);
    assert.equal(JSON.parse(h.values.get('blacktop-bay-choices-v1')).sound,false);
  }
  h.preferences.mode='championship';vm.runInContext('saveChoices();updateMenu()',h.context);
  assert.equal(h.records().sound,false);assert.equal(h.preferences.sound,false);
  assert.equal(JSON.parse(h.values.get('blacktop-bay-choices-v1')).sound,false);
});

test('a valid campaign selection displays its actual objective and free mode navigation clears only the selection',()=>{
  const h=harness({campaignEventId:'harbor-first'}),event=getCampaignEvent('harbor-first',h.preferences.vehicle);
  const original=JSON.stringify(vm.runInContext('campaign',h.context));
  assert.equal(h.$('open-campaign').attributes['aria-pressed'],'true');
  assert.ok(h.buttons.every(button=>button.attributes['aria-pressed']==='false'));
  assert.equal(h.$('lobby-mode-title').textContent,event.name.toUpperCase());
  assert.equal(h.$('lobby-mode-description').textContent,event.objectives[0].label);
  assert.equal(h.$('race-setup-label').textContent,`Campaign · ${event.name}`);
  h.click('time-attack');
  assert.equal(h.$('open-campaign').attributes['aria-pressed'],'false');
  assert.equal(vm.runInContext('selectedCampaignId',h.context),null);
  assert.equal(JSON.stringify(vm.runInContext('campaign',h.context)),original);
  assert.equal(h.$('hq-field-size').textContent,'01');
});

test('locked or mismatched campaign intent never labels the free-race lobby as an active campaign',()=>{
  const locked=harness({campaignEventId:'coast-clock'});
  assert.equal(locked.$('open-campaign').attributes['aria-pressed'],'false');
  assert.equal(locked.$('lobby-mode-title').textContent,'TIME ATTACK');
  const changed=harness({campaignEventId:'harbor-first'});
  changed.preferences.track='coast';vm.runInContext('updateMenu()',changed.context);
  assert.equal(changed.$('open-campaign').attributes['aria-pressed'],'false');
  assert.equal(changed.$('lobby-mode-title').textContent,'CIRCUIT RACE');
});

test('blocked storage keeps navigation usable with empty records and the current in-memory selection',()=>{
  const h=harness({blocked:true});
  assert.doesNotThrow(()=>h.click('time-attack'));
  assert.equal(h.preferences.mode,'time-attack');assert.equal(h.$('hq-field-size').textContent,'01');
  assert.equal(h.records().bestTime,null);assert.equal(h.writes.length,0);
});
