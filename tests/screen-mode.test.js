import test from 'node:test';
import assert from 'node:assert/strict';
import {screenMode,toggleScreenMode,screenHelpMarkup} from '../src/screen-mode.js';
import {createFrameBudget} from '../src/frame-budget.js';

const environment = () => ({document:{documentElement:{},fullscreenElement:null},navigator:{userAgent:'iPhone',maxTouchPoints:5},matchMedia:()=>({matches:false})});
test('iPhone without fullscreen API gives usable Home Screen instructions rather than reporting success',async()=>{
  const env=environment(),state=await toggleScreenMode(env);
  assert.equal(state.active,false);assert.equal(state.help,true);assert.equal(state.label,'Full-screen play');
  assert.match(screenHelpMarkup(state),/Add to Home Screen/);assert.match(screenHelpMarkup(state),/Open as Web App/);
  env.navigator.standalone=true;
  assert.equal(screenMode(env).standalone,true);
  assert.doesNotMatch(screenHelpMarkup(await toggleScreenMode(env)),/Add to Home Screen/);
});
test('standard fullscreen calls happen within the click task and reflect actual browser state on enter and exit',async()=>{
  const env=environment();let requested=0;
  env.document.documentElement.requestFullscreen=()=>{requested++;env.document.fullscreenElement=env.document.documentElement;return Promise.resolve();};
  env.document.exitFullscreen=async()=>{env.document.fullscreenElement=null;};
  const entering=toggleScreenMode(env);assert.equal(requested,1);
  assert.equal((await entering).active,true);assert.equal((await toggleScreenMode(env)).active,false);
});
test('denied fullscreen preserves inactive state and explains failure; legacy WebKit and installed display modes are supported',async()=>{
  const env=environment();env.document.documentElement.requestFullscreen=async()=>{throw new Error('NotAllowedError');};
  const denied=await toggleScreenMode(env);assert.equal(denied.active,false);assert.equal(denied.help,true);assert.match(denied.error,/did not allow/);
  delete env.document.documentElement.requestFullscreen;
  env.document.documentElement.webkitRequestFullscreen=()=>{env.document.webkitFullscreenElement={};};
  env.document.webkitExitFullscreen=()=>{env.document.webkitFullscreenElement=null;};
  assert.equal((await toggleScreenMode(env)).active,true);assert.equal((await toggleScreenMode(env)).active,false);
  env.matchMedia=query=>({matches:query==='(display-mode: standalone)'});assert.equal(screenMode(env).standalone,true);
});
test('hidden mobile pages do no frame work and resume immediately without replaying idle updates',()=>{
 const gate=createFrameBudget();assert.equal(gate.ready(0,{mobile:true}),true);
 assert.equal(gate.ready(10,{mobile:true,hidden:true}),false);
 assert.equal(gate.ready(60000,{mobile:true,hidden:true}),false);
 assert.equal(gate.ready(61000,{mobile:true,mode:'racing'}),true);
});
test('mobile frames remain bounded across 60/120Hz hardware, with less idle work and full-rate driving',()=>{
 for(const hz of [60,120])for(const [mode,target] of [['menu',30],['garage',30],['paused',15],['racing',60]]){
  const gate=createFrameBudget();let count=0;
  for(let frame=0;frame<hz*10;frame++)if(gate.ready(frame*1000/hz,{mobile:true,mode}))count++;
  assert.ok(Math.abs(count-target*10)<=2,`${mode} at ${hz}Hz produced ${count} frames`);
 }
 const desktop=createFrameBudget();for(let frame=0;frame<120;frame++)assert.equal(desktop.ready(frame*1000/120),true);
});
