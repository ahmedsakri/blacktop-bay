import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForPaint} from '../src/paint-readiness.js';

function harness(hidden=false){
 const listeners=new Set(),frames=new Map();let id=0;
 const document={hidden,addEventListener(type,listener){assert.equal(type,'visibilitychange');listeners.add(listener);},removeEventListener(type,listener){listeners.delete(listener);}};
 return {document,listeners,frames,requestFrame(callback){frames.set(++id,callback);return id;},cancelFrame(frame){frames.delete(frame);},
  paint(){const queued=[...frames.values()];frames.clear();for(const callback of queued)callback();},
  hide(){document.hidden=true;for(const listener of [...listeners])listener();},
 };
}

test('hidden startup does not wait for animation frames that the browser has suspended',async()=>{
 const state=harness(true);await waitForPaint(state);assert.equal(state.frames.size,0);assert.equal(state.listeners.size,0);
});

test('visible loading messages receive two frames and release their visibility listener',async()=>{
 const state=harness();let done=false;const pending=waitForPaint(state).then(()=>done=true);
 state.paint();await Promise.resolve();assert.equal(done,false);assert.equal(state.frames.size,1);
 state.paint();await pending;assert.equal(done,true);assert.equal(state.frames.size,0);assert.equal(state.listeners.size,0);
});

test('hiding during either pending frame releases startup and cancels the suspended callback',async()=>{
 for(const alreadyPainted of [0,1]){
  const state=harness(),pending=waitForPaint(state);if(alreadyPainted)state.paint();
  state.hide();await pending;assert.equal(state.frames.size,0);assert.equal(state.listeners.size,0);
 }
});

test('a hidden transition during listener registration cannot leave a frame wait behind',async()=>{
 const state=harness(),add=state.document.addEventListener;state.document.addEventListener=(type,listener)=>{add(type,listener);state.document.hidden=true;};
 await waitForPaint(state);assert.equal(state.frames.size,0);assert.equal(state.listeners.size,0);
});
