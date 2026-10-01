import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {STORAGE_KEY,loadRecords,saveResult} from '../src/storage.js';
import {RACE_MODES,normalizeRaceOptions,getDifficulty,raceFieldSize} from '../src/race-options.js';

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
const soundRestore=section('if (typeof preferences.sound === "boolean") records.sound = preferences.sound;','sound.setMuted(!records.sound);');
const navSource=section("for(const button of document.querySelectorAll('[data-lobby-mode]'))button.onclick=", "$('hq-wallet').onclick=");
const key=(mode,difficulty='street')=>`${STORAGE_KEY}-harbor-mclaren-p1-gtr-${mode}-${difficulty}-race-v3`;
function harness({savedSound,blocked=false}={}){
  const nodes=new Map(),buttons=RACE_MODES.map(mode=>({dataset:{lobbyMode:mode.id},attributes:{},setAttribute(name,value){this.attributes[name]=value;}}));
  const values=new Map(),writes=[];
  for(const [mode,bestTime] of [['race',120],['time-attack',103],['championship',132]])values.set(key(mode),JSON.stringify({bestTime,bestScore:100,ghost:[],sound:mode==='race'?savedSound??true:true}));
  const preferences={track:'harbor',vehicle:'mclaren-p1-gtr',mode:'race',difficulty:'street'};
  const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;}});return nodes.get(id);};
  const context=vm.createContext({preferences,preferenceKey:'blacktop-bay-choices-v1',loadRecords,saveResult,RACE_MODES,normalizeRaceOptions,getDifficulty,raceFieldSize,
    progression:{credits:1200},$,document:{querySelectorAll:selector=>{assert.equal(selector,'[data-lobby-mode]');return buttons;}},
    localStorage:{getItem(k){if(blocked)throw Error('Unavailable');return values.get(k)??null;},setItem(k,v){if(blocked)throw Error('Unavailable');values.set(k,v);writes.push(k);}},
    updateGarageCopy(){},format:t=>`${t} SEC`});
  vm.runInContext(`${storeSource}\nlet records=loadRecords(recordStore);\n${soundRestore}\n${optionsSource}\n${menuSource}\n${navSource}\nupdateMenu();`,context);
  return {context,preferences,buttons,$,values,writes,click:mode=>buttons.find(button=>button.dataset.lobbyMode===mode).onclick(),records:()=>vm.runInContext('records',context)};
}

test('lobby mode navigation refreshes the real field, selected state and mode-specific best without starting a race',()=>{
  const h=harness(),originalRecords=[...h.values.entries()];
  for(const [mode,best,field] of [['time-attack',103,'01'],['championship',132,'08'],['race',120,'08']]){
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

test('each mode and difficulty keeps its own benchmark and unplayed combinations show no invented best',()=>{
  const h=harness();h.preferences.difficulty='pro';h.click('time-attack');
  assert.equal(h.records().bestTime,null);assert.equal(h.$('menu-best').textContent,'YOUR FIRST NIGHT STARTS HERE.');
  vm.runInContext("saveResult({state:'finished',elapsed:99,score:250,completedLaps:3,totalLaps:3},[],recordStore); updateMenu();",h.context);
  assert.equal(h.records().bestTime,99);assert.match(h.$('menu-best').textContent,/99 SEC/);
  h.click('race');assert.equal(h.records().bestTime,null);
  h.preferences.difficulty='street';h.click('race');assert.equal(h.records().bestTime,120);
  h.click('time-attack');assert.equal(h.records().bestTime,103);
  assert.equal(JSON.parse(h.values.get(key('time-attack','pro'))).bestTime,99);
});

test('legacy record mute is promoted to the global preference before switching lobby modes',()=>{
  const h=harness({savedSound:false});
  assert.equal(h.preferences.sound,false);
  for(const mode of ['time-attack','championship','race']){
    h.click(mode);assert.equal(h.records().sound,false);assert.equal(h.preferences.sound,false);
    assert.equal(JSON.parse(h.values.get('blacktop-bay-choices-v1')).sound,false);
  }
});

test('blocked storage keeps navigation usable with empty records and the current in-memory selection',()=>{
  const h=harness({blocked:true});
  assert.doesNotThrow(()=>h.click('time-attack'));
  assert.equal(h.preferences.mode,'time-attack');assert.equal(h.$('hq-field-size').textContent,'01');
  assert.equal(h.records().bestTime,null);assert.equal(h.writes.length,0);
});
