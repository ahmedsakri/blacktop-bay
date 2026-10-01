import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/audio.js';

test('electric car sound rises smoothly without combustion gear drops',async()=>{
  const env=environment(),audio=createAudio();
  try {
    await audio.unlock();
    const body=env.contexts[0].oscillators[0];
    let pitch=0;
    for(let speed=0;speed<=55;speed+=.5){
      audio.update({running:true,vehicle:'rimac-concept-one',speed,throttle:1},1/60);
      assert.equal(body.type,'sine');
      assert.ok(body.frequency.value>=pitch);
      pitch=body.frequency.value;
    }
    audio.update({running:true,vehicle:'mclaren-p1-gtr',speed:20});
    assert.equal(body.type,'triangle','switching back restores the combustion voice');
  } finally {audio.dispose();env.restore();}
});

// Exercise the actual audio graph and automation without requiring a speaker or
// pretending a silent Node process verifies the subjective quality of its sound.
function environment() {
  const saved={AudioContext:globalThis.AudioContext,document:globalThis.document};
  const contexts=[],listeners=new Map();
  class Parameter {
    value=0;
    setTargetAtTime(value,time,constant){assert.ok([value,time,constant].every(Number.isFinite));assert.ok(constant>0);this.value=value;}
    setValueAtTime(value,time){assert.ok([value,time].every(Number.isFinite));this.value=value;}
    linearRampToValueAtTime(value,time){this.setValueAtTime(value,time);}
    exponentialRampToValueAtTime(value,time){assert.ok(value>0);this.setValueAtTime(value,time);}
  }
  class Node {
    connections=[];stops=0;disconnections=0;gain=new Parameter();frequency=new Parameter();Q=new Parameter();
    connect(destination){this.connections.push(destination);return destination;}
    disconnect(){this.disconnections++;}
    start(){this.started=true;}
    stop(){this.stops++;this.onended?.();}
  }
  class Context {
    state='suspended';currentTime=0;sampleRate=8000;destination={};oscillators=[];gains=[];all=[];
    constructor(){contexts.push(this);}
    make(){const node=new Node();this.all.push(node);return node;}
    createOscillator(){const node=this.make();this.oscillators.push(node);return node;}
    createGain(){const node=this.make();this.gains.push(node);return node;}
    createBiquadFilter(){return this.make();}
    createBufferSource(){return this.make();}
    createBuffer(channels,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
    async resume(){this.state='running';}
    async close(){this.state='closed';}
  }
  globalThis.AudioContext=Context;
  globalThis.document={hidden:false,addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);}};
  return {contexts,listeners,restore(){globalThis.AudioContext=saved.AudioContext;globalThis.document=saved.document;}};
}

test('engine audio needs user unlock, respects mute/background/pause and disposes every running source',async()=>{
  const env=environment(),audio=createAudio();
  try{
    audio.update({running:true,speed:20,vehicle:'mclaren-p1-gtr'});
    assert.equal(env.contexts.length,0,'constructing or updating the game must not bypass browser audio unlock');
    assert.equal(await audio.unlock(),true);
    const ctx=env.contexts[0],master=ctx.gains[0],engine=ctx.gains[1];
    audio.update({running:true,speed:20,vehicle:'mclaren-p1-gtr'});
    assert.ok(master.gain.value>0&&engine.gain.value>0);
    audio.setMuted(true);assert.equal(master.gain.value,0);
    audio.setMuted(false);assert.ok(master.gain.value>0);
    globalThis.document.hidden=true;env.listeners.get('visibilitychange')();assert.equal(master.gain.value,0);
    globalThis.document.hidden=false;env.listeners.get('visibilitychange')();assert.ok(master.gain.value>0);
    audio.update({running:false});assert.equal(engine.gain.value,0);
    audio.dispose();audio.dispose();
    assert.equal(ctx.state,'closed');assert.equal(env.listeners.size,0);
    for(const source of ctx.all.filter(node=>node.started))assert.equal(source.stops,1,'every persistent sound source stops exactly once');
    assert.ok(ctx.all.every(node=>node.disconnections>0));
    assert.equal(await audio.unlock(),false);
  }finally{audio.dispose();env.restore();}
});

test('combustion and electric manufacturer models produce distinct voices and respond to throttle',async()=>{
  const env=environment(),pitches={};
  try{
    for(const vehicle of ['mclaren-p1-gtr','rimac-concept-one','rimac-nevera']){
      const audio=createAudio();await audio.unlock();const ctx=env.contexts.at(-1);
      const body=ctx.oscillators.find(node=>node.type==='triangle'),harmonic=ctx.oscillators.find(node=>node.type==='sawtooth');
      for(let i=0;i<20;i++)audio.update({running:true,vehicle,speed:20,throttle:1},1/60);
      pitches[vehicle]=body.frequency.value;
      const loadedGain=body.connections[0].gain.value;
      audio.update({running:true,vehicle,speed:20,throttle:0},1/60);
      assert.ok(body.connections[0].gain.value<loadedGain*.65,'lifting off audibly unloads the engine');
      assert.ok(harmonic.frequency.value>body.frequency.value*1.9);
      assert.equal(body.type,vehicle.startsWith('rimac-')?'sine':'triangle');
      assert.equal(harmonic.type,vehicle.startsWith('rimac-')?'sine':'sawtooth');
      audio.dispose();
    }
    for(const id of ['rimac-concept-one','rimac-nevera'])
      assert.ok(pitches[id]>pitches['mclaren-p1-gtr']*1.5,'electric drive has a distinct higher motor whine');
  }finally{env.restore();}
});

test('combustion upshifts drop revs without hunting and Nitro adds a bounded layer without allocating each frame',async()=>{
  const env=environment(),audio=createAudio();
  try{
    await audio.unlock();const ctx=env.contexts[0],body=ctx.oscillators.find(node=>node.type==='triangle');
    const boost=ctx.oscillators.find(node=>node.frequency.value===900),boostGain=boost.connections[0].connections[0];
    let previous=0,drops=0;
    for(let speed=0;speed<55;speed+=.2){audio.update({running:true,vehicle:'mclaren-p1-gtr',speed,throttle:1},.02);if(body.frequency.value<previous-15)drops++;previous=body.frequency.value;}
    assert.equal(drops,5,'six-speed combustion voice must shift five times during an acceleration run');
    const nodes=ctx.all.length;
    for(let i=0;i<120;i++)audio.update({running:true,vehicle:'mclaren-p1-gtr',speed:30+(i%2)*.02,throttle:1,nitro:true},1/60);
    assert.ok(boostGain.gain.value>0);
    assert.equal(ctx.all.length,nodes,'steady driving and boost reuse the existing graph');
    audio.update({running:true,vehicle:'mclaren-p1-gtr',speed:30,throttle:1,nitro:false});assert.equal(boostGain.gain.value,0);
    audio.update({running:true,vehicle:'mclaren-p1-gtr',speed:30,throttle:1,nitro:true,brake:1});assert.equal(boostGain.gain.value,0);
    audio.update({running:true,vehicle:'unknown',speed:Infinity,throttle:NaN,drift:NaN},Infinity);
    assert.ok(Number.isFinite(body.frequency.value));
  }finally{audio.dispose();env.restore();}
});
