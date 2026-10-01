import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {LOBBY_STYLES,normalizeLobbyStyle} from '../src/lobby-music.js';
import {normalizeRaceOptions} from '../src/race-options.js';
import {normalizeSteeringSensitivity} from '../src/driving-controls.js';
import {DEFAULT_VEHICLE_ID,getVehicle} from '../src/vehicles.js';

// These tests exercise actual settings orchestration with a small inert DOM
// double, not a browser or an audio implementation.
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const loadSource=main.slice(main.indexOf('const preferenceKey ='),main.indexOf('const requestedTrack ='));
const mountSource=main.slice(main.indexOf('function mountSteeringSettings()'),main.indexOf("bindSteeringPad($('touch-steer-cue')"));
function load(stored){
 const context=vm.createContext({localStorage:{getItem:()=>JSON.stringify(stored),setItem(){}},DEFAULT_VEHICLE_ID,getVehicle,normalizeRaceOptions,normalizeSteeringSensitivity,normalizeLobbyStyle,TRACKS:[{id:'harbor'}],clamp:(v,min,max)=>Math.min(max,Math.max(min,v))});
 return vm.runInContext(`${loadSource}; preferences;`,context);
}
function settings({musicVolume=.65,volume=.75}={}){
 const elements=new Map(),calls=[],writes=[];
 const $=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',append(node){this.child=node;}});return elements.get(id);};
 const preferences={lobbyStyle:'liquid-lines',musicVolume,volume};
 const context=vm.createContext({document:{createElement:()=>({innerHTML:'',className:''})},$,preferences,usesTouchControls:()=>false,
  sound:{setVolume:value=>calls.push(['volume',value]),setMusicVolume:value=>calls.push(['music',value])},saveChoices(){writes.push({...preferences});}});
 vm.runInContext(`${mountSource}; mountSteeringSettings();`,context);
 return {$,calls,writes,preferences,elements};
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
 const markup=h.$('dialog-content').child.innerHTML;
 assert.match(markup,/Liquid Lines/);assert.match(markup,/168 BPM/);
 assert.doesNotMatch(markup,/<select|lobby-style|Current lobby|Midnight Drive|After Hours/);
 assert.equal(h.elements.has('lobby-style'),false);
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
