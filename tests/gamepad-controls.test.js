import test from 'node:test';
import assert from 'node:assert/strict';
import {readGamepad} from '../src/gamepad-controls.js';
import {resolveDriveControls} from '../src/driving-controls.js';
const pad=(axis=0,pressed=[])=>({connected:true,mapping:'standard',axes:[axis],buttons:Array.from({length:17},(_,i)=>({pressed:pressed.includes(i),value:pressed.includes(i)?1:0}))});

test('missing, disconnected and nonstandard gamepads cannot affect driving',()=>{
 for(const input of [null,{}, {...pad(),connected:false},{...pad(),mapping:''}])assert.deepEqual(readGamepad(input),{connected:false,steer:0,nitro:false,brake:false,pause:false});
});
test('stick deadzone remains continuous with full steering lock and bounded D-pad blending',()=>{
 for(const axis of [-.13,0,.13,NaN])assert.equal(readGamepad(pad(axis)).steer,0);
 assert.ok(readGamepad(pad(.131)).steer>0&&readGamepad(pad(.131)).steer<.002);
 assert.equal(readGamepad(pad(1)).steer,1);assert.equal(readGamepad(pad(-1)).steer,-1);
 assert.equal(readGamepad(pad(.7,[15])).steer,1);assert.equal(readGamepad(pad(-.7,[14])).steer,-1);
 assert.equal(readGamepad(pad(0,[14,15])).steer,0);
});
test('face-button swap preserves triggers, brake priority and pause mapping',()=>{
 assert.equal(readGamepad(pad(0,[0])).nitro,true);
 assert.equal(readGamepad(pad(0,[1])).brake,true);
 assert.equal(readGamepad(pad(0,[1]),{swap:true}).nitro,true);
 assert.equal(readGamepad(pad(0,[0]),{swap:true}).brake,true);
 for(const swap of [false,true]){
  assert.equal(readGamepad(pad(0,[7]),{swap}).nitro,true);
  assert.equal(readGamepad(pad(0,[6]),{swap}).brake,true);
  const controls=resolveDriveControls(readGamepad(pad(0,[6,7,9]),{swap}));
  assert.equal(controls.brake,true);assert.equal(controls.nitro,false);assert.equal(controls.throttle,0);
 }
 assert.equal(readGamepad(pad(0,[9])).pause,true);
 const analogTrigger=pad();analogTrigger.buttons[7]={value:.6};assert.equal(readGamepad(analogTrigger).nitro,true);
});

test('a connected opposing stick cannot cancel explicit desktop arrow steering',()=>{
 for(const [axis,key,expected] of [[-1,'right',1],[1,'left',-1]]){
  const gamepad=readGamepad(pad(axis,[7]));
  const controls=resolveDriveControls({...gamepad,[key]:true});
  assert.equal(controls.steer,expected);assert.equal(controls.nitro,true);
  assert.equal(resolveDriveControls({...gamepad,left:true,right:true}).steer,0);
  assert.equal(resolveDriveControls(gamepad).steer,axis,'releasing digital input returns control to the stick');
 }
});
