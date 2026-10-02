import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {LOBBY_STYLES,normalizeLobbyStyle} from '../src/lobby-music.js';
import {normalizeRaceOptions} from '../src/race-options.js';
import {normalizeSteeringSensitivity} from '../src/driving-controls.js';
import {DEFAULT_VEHICLE_ID,getVehicle} from '../src/vehicles.js';
import {normalizeQuality,qualityGeometry} from '../src/render-quality.js';
import {icon} from '../src/icons.js';
import {normalizePlayerControls} from '../src/player-controls.js';

// These tests exercise actual settings orchestration with a small inert DOM
// double, not a browser or an audio implementation.
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const loadSource=main.slice(main.indexOf('const preferenceKey ='),main.indexOf('let campaign ='));
const mountStart=main.indexOf('function mountSteeringSettings()');
const mountSource=main.slice(mountStart,main.indexOf('\n}',mountStart)+2);
const viewportStart=main.indexOf('const graphicsViewport =');
const viewportSource=main.slice(viewportStart,main.indexOf(';',viewportStart)+1);
function load(stored){
 const context=vm.createContext({localStorage:{getItem:()=>JSON.stringify(stored),setItem(){}},DEFAULT_VEHICLE_ID,getVehicle,normalizeRaceOptions,normalizeSteeringSensitivity,normalizeLobbyStyle,normalizeQuality,normalizePlayerControls,TRACKS:[{id:'harbor'}],clamp:(v,min,max)=>Math.min(max,Math.max(min,v))});
 return vm.runInContext(`${loadSource}; preferences;`,context);
}
function settings({musicVolume=.65,volume=.75,saveResult=true}={}){
 const elements=new Map(),calls=[],writes=[],qualityChanges=[],playerTools=[];
 const element=()=>({value:'',textContent:'',innerHTML:'',className:'',children:[],attributes:{},set id(value){this._id=value;elements.set(value,this);},get id(){return this._id;},setAttribute(name,value){this.attributes[name]=String(value);},append(node){this.children.push(node);}});
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const preferences={lobbyStyle:'liquid-lines',musicVolume,volume,engineVolume:1,sfxVolume:.85,quality:'auto',gamepadSwap:false,controls:normalizePlayerControls()};
 const context=vm.createContext({document:{createElement:element},$,preferences,icon,screenMode:()=>({standalone:false,ios:false}),canInstallPWA:()=>false,requestInstallPWA:()=>{throw new Error('Must not install automatically');},usesTouchControls:()=>false,normalizeQuality,qualityGeometry,loadedGeometry:qualityGeometry('auto',{mobile:true}),normalizePlayerControls,mobile:true,devicePixelRatio:2,innerWidth:844,innerHeight:390,navigator:{hardwareConcurrency:8},location:{reload:()=>calls.push(['reload'])},adaptiveQuality:{configure:settings=>qualityChanges.push({...settings})},mountPlayerTools:(container,callbacks)=>{assert.equal(container,$('dialog-content'));playerTools.push(callbacks);},showSaveBackup(){throw Error('Backup must require a user action');},applyQuality:()=>calls.push(['quality',preferences.quality]),
  sound:{setVolume:value=>calls.push(['volume',value]),setMusicVolume:value=>calls.push(['music',value]),setEngineVolume:value=>calls.push(['engine',value]),setSfxVolume:value=>calls.push(['sfx',value])},saveChoices(){writes.push({...preferences});return typeof saveResult==='function'?saveResult():saveResult;}});
 vm.runInContext(`${viewportSource}\n${mountSource}; mountSteeringSettings();`,context);
 return {$,calls,writes,preferences,elements,qualityChanges,playerTools};
}

test('first run, old selections and malformed music preferences all use approved Liquid Lines',()=>{
 for(const stored of [null,{}, {lobbyStyle:'unknown'},{lobbyStyle:null},{lobbyStyle:{id:'liquid-lines'}},...['original','midnight-drive','after-hours','liquid-lines'].map(lobbyStyle=>({lobbyStyle}))])assert.equal(load(stored).lobbyStyle,'liquid-lines');
 assert.deepEqual(LOBBY_STYLES.map(style=>style.id),['liquid-lines']);
});

test('soundtrack migration preserves saved mute and independent music/game volumes',()=>{
 for(const lobbyStyle of ['original','midnight-drive','after-hours']){
  const restored=load({lobbyStyle,volume:.35,musicVolume:0,sound:false});
  assert.equal(restored.lobbyStyle,'liquid-lines');assert.equal(restored.volume,.35);
  assert.equal(restored.musicVolume,0);assert.equal(restored.sound,false);
 }
});

test('settings display the approved soundtrack without a dead selector or playback side effects',()=>{
 const h=settings();
 assert.deepEqual(h.calls,[]);assert.equal(h.writes.length,0);
 const mixer=h.$('dialog-content').children.find(child=>child.innerHTML.includes('<h3>Sound mix</h3>'));
 assert.ok(mixer);assert.equal(mixer.children.length,2);
 const markup=mixer.innerHTML;
 assert.match(markup,/Liquid Lines/);assert.match(markup,/168 BPM/);
 assert.doesNotMatch(markup,/<select|lobby-style|Current lobby|Midnight Drive|After Hours/);
 assert.equal(h.elements.has('lobby-style'),false);
});

test('new audio, graphics and controller preferences migrate independently and reject invalid values',()=>{
 const restored=load({engineVolume:.4,sfxVolume:0,quality:'performance',gamepadSwap:true});
 assert.equal(restored.engineVolume,.4);assert.equal(restored.sfxVolume,0);
 assert.equal(restored.quality,'performance');assert.equal(restored.gamepadSwap,true);
 const invalid=load({engineVolume:10,sfxVolume:-1,quality:'unknown',gamepadSwap:'true'});
 assert.equal(invalid.engineVolume,1);assert.equal(invalid.sfxVolume,0);
 assert.equal(invalid.quality,'auto');assert.equal(invalid.gamepadSwap,false);
 const missing=load({});assert.equal(missing.engineVolume,1);assert.equal(missing.sfxVolume,.85);
});

test('engine and effect sliders change only their own channel and save the complete mix',()=>{
 const h=settings();
 h.$('engineVolume').oninput({target:{value:'40'}});
 h.$('sfxVolume').oninput({target:{value:'0'}});
 assert.equal(h.preferences.engineVolume,.4);assert.equal(h.preferences.sfxVolume,0);
 assert.equal(h.preferences.volume,.75);assert.equal(h.preferences.musicVolume,.65);
 assert.deepEqual(h.calls,[['engine',.4],['sfx',0]]);assert.equal(h.writes.length,2);
 assert.equal(h.$('engineVolume-value').value,'40%');assert.equal(h.$('sfxVolume-value').value,'0%');
 assert.equal(h.writes[1].lobbyStyle,'liquid-lines');assert.equal(h.writes[1].engineVolume,.4);
});

test('display and controller settings apply and persist without changing audio or starting playback',()=>{
 const h=settings();
 assert.equal(h.$('graphics-quality').value,'auto');assert.equal(h.$('controller-layout').value,'standard');
 h.$('graphics-quality').onchange({target:{value:'performance'}});
 h.$('controller-layout').onchange({target:{value:'swap'}});
 assert.equal(h.preferences.quality,'performance');assert.equal(h.preferences.gamepadSwap,true);
 assert.deepEqual(h.calls,[['quality','performance']]);assert.equal(h.writes.length,2);
 assert.deepEqual(h.qualityChanges,[{choice:'performance',mobile:true,dpr:2,width:844,height:390,deviceMemory:undefined,hardwareConcurrency:8}]);
 assert.equal(h.playerTools.length,1);assert.equal(h.playerTools[0].getControls(),h.preferences.controls);
 assert.equal(h.preferences.volume,.75);assert.equal(h.preferences.musicVolume,.65);
 assert.equal(h.preferences.engineVolume,1);assert.equal(h.preferences.sfxVolume,.85);
});

test('game and music sliders remain independent and preserve Liquid Lines through save',()=>{
 const h=settings();
 h.$('music-volume').oninput({target:{value:'0'}});
 assert.equal(h.preferences.musicVolume,0);assert.equal(h.preferences.volume,.75);
 h.$('master-volume').oninput({target:{value:'35'}});
 assert.equal(h.preferences.volume,.35);assert.equal(h.preferences.musicVolume,0);
 assert.deepEqual(h.calls,[['music',0],['volume',.35]]);
 assert.equal(h.writes.length,2);assert.ok(h.writes.every(preferences=>preferences.lobbyStyle==='liquid-lines'));
 assert.equal(h.$('music-volume-value').value,'0%');assert.equal(h.$('master-volume-value').value,'35%');
});


test('geometry-changing graphics settings explain the required reload without reloading automatically',()=>{
 const h=settings(),note=h.$('graphics-detail-note'),reload=h.$('graphics-detail-reload');
 assert.equal(note.attributes.role,'status');assert.equal(reload.hidden,true);
 h.$('graphics-quality').onchange({target:{value:'ultra'}});
 assert.equal(reload.hidden,false);assert.match(note.textContent,/Reload to apply the new model and scenery detail/);
 assert.match(note.textContent,/ends an unfinished run/);assert.equal(h.calls.some(call=>call[0]==='reload'),false);
 h.$('graphics-quality').onchange({target:{value:'auto'}});assert.equal(reload.hidden,true);
 h.$('graphics-quality').onchange({target:{value:'ultra'}});reload.onclick();
 assert.equal(h.calls.filter(call=>call[0]==='reload').length,1);
});


test('a failed graphics save keeps the current run and permits a later successful reload',()=>{
 let saved=false;const h=settings({saveResult:()=>saved}),note=h.$('graphics-detail-note'),reload=h.$('graphics-detail-reload');
 h.$('graphics-quality').onchange({target:{value:'ultra'}});assert.equal(reload.hidden,false);
 const before=h.writes.length;reload.onclick();
 assert.equal(h.writes.length,before+1,'reload retries saving the actual selected preferences');
 assert.equal(h.writes.at(-1).quality,'ultra');assert.equal(h.calls.some(call=>call[0]==='reload'),false);
 assert.match(note.textContent,/could not be saved/);assert.match(note.textContent,/current run is safe/);assert.equal(reload.hidden,false);
 saved=true;reload.onclick();assert.equal(h.calls.filter(call=>call[0]==='reload').length,1);
});
