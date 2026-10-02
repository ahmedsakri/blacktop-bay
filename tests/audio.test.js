import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/audio.js';
import {LOBBY_STYLES,lobbyMusicFrame,normalizeLobbyStyle} from '../src/lobby-music.js';

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
    assert.equal(body.type,'custom','switching back restores the rounded combustion spectrum');
  } finally {audio.dispose();env.restore();}
});

// Exercise the actual audio graph and automation without requiring a speaker or
// pretending a silent Node process verifies the subjective quality of its sound.
function environment() {
  const saved={AudioContext:globalThis.AudioContext,document:globalThis.document};
  const contexts=[],listeners=new Map();
  class Parameter {
    value=0;ramps=[];cancels=[];
    setTargetAtTime(value,time,constant){assert.ok([value,time,constant].every(Number.isFinite));assert.ok(constant>0);this.value=value;}
    setValueAtTime(value,time){assert.ok([value,time].every(Number.isFinite));this.value=value;}
    linearRampToValueAtTime(value,time){this.ramps.push({kind:'linear',value,time});this.setValueAtTime(value,time);}
    exponentialRampToValueAtTime(value,time){assert.ok(value>0);this.ramps.push({kind:'exponential',value,time});this.setValueAtTime(value,time);}
    cancelScheduledValues(time){assert.ok(Number.isFinite(time));this.cancels.push(time);}
  }
  class Node {
    connections=[];stops=0;disconnections=0;gain=new Parameter();frequency=new Parameter();Q=new Parameter();
    delayTime=new Parameter();threshold=new Parameter();knee=new Parameter();ratio=new Parameter();attack=new Parameter();release=new Parameter();pan=new Parameter();
    connect(destination){this.connections.push(destination);return destination;}
    disconnect(){this.disconnections++;}
    start(){this.started=true;}
    stop(){this.stops++;this.onended?.();}
    setPeriodicWave(wave){this.wave=wave;this.type='custom';}
  }
  class Context {
    state='suspended';stateListeners=new Set();suspends=0;resumes=0;currentTime=0;sampleRate=8000;destination={};oscillators=[];gains=[];compressors=[];panners=[];all=[];
    constructor(){contexts.push(this);}
    make(){const node=new Node();this.all.push(node);return node;}
    createOscillator(){const node=this.make();this.oscillators.push(node);return node;}
    createPeriodicWave(real,imag){return {real:Array.from(real),imag:Array.from(imag)};}
    createGain(){const node=this.make();this.gains.push(node);return node;}
    createBiquadFilter(){return this.make();}
    createConvolver(){return this.make();}
    createDelay(){return this.make();}
    createStereoPanner(){const node=this.make();this.panners.push(node);return node;}
    createDynamicsCompressor(){const node=this.make();this.compressors.push(node);return node;}
    createBufferSource(){return this.make();}
    createBuffer(channels,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
    addEventListener(type,fn){if(type==='statechange')this.stateListeners.add(fn);}
    removeEventListener(type,fn){if(type==='statechange')this.stateListeners.delete(fn);}
    changeState(state){this.state=state;for(const listener of this.stateListeners)listener();}
    async resume(){this.resumes++;this.changeState('running');}
    async suspend(){this.suspends++;this.changeState('suspended');}
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
      for(let i=0;i<20;i++)audio.update({running:true,vehicle,speed:20,throttle:0},1/60);
      assert.ok(body.connections[0].gain.value<loadedGain*.65,'lifting off audibly unloads the engine');
      assert.ok(harmonic.frequency.value>body.frequency.value*1.9);
      assert.equal(body.type,vehicle.startsWith('rimac-')?'sine':'custom');
      assert.equal(harmonic.type,vehicle.startsWith('rimac-')?'sine':'custom');
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
    const boost=ctx.oscillators[4],boostGain=boost.connections[0];
    let previous=0,drops=0,falling=false;
    for(let speed=0;speed<55;speed+=.2){
      audio.update({running:true,vehicle:'mclaren-p1-gtr',speed,throttle:1},.02);
      const nowFalling=body.frequency.value<previous-.2;
      if(nowFalling&&!falling)drops++;
      if(previous)assert.ok(Math.abs(body.frequency.value-previous)<12,'gear changes are spread across frames');
      falling=nowFalling;previous=body.frequency.value;
    }
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

test('combustion graph uses finite rounded harmonics and resumes without repeated gear-drop sounds',async()=>{
 const env=environment(),audio=createAudio();
 try{
  await audio.unlock();const ctx=env.contexts[0],body=ctx.oscillators[0],harmonic=ctx.oscillators[1];
  for(let i=0;i<60;i++)audio.update({running:true,vehicle:'ferrari-enzo',speed:40,throttle:1,raceId:7},1/60);
  assert.equal(body.type,'custom');assert.equal(harmonic.type,'custom');
  assert.ok(body.wave.imag.length<=10&&harmonic.wave.imag.length<=6,'finite harmonic spectrum replaces sawtooth buzz');
  assert.ok(body.wave.imag.at(-1)<.01);
  const frequency=body.frequency.value,loaded=body.connections[0].gain.value;
  audio.update({running:false,vehicle:'ferrari-enzo',speed:40,raceId:7});
  for(let i=0;i<20;i++){
   audio.update({running:true,vehicle:'ferrari-enzo',speed:40,throttle:1,raceId:7},1/60);
   assert.ok(Math.abs(body.frequency.value-frequency)<1e-6,'resume seeds the correct gear instead of climbing through every gear');
  }
  audio.update({running:true,vehicle:'ferrari-enzo',speed:40,throttle:0,raceId:7},1/60);
  assert.ok(body.connections[0].gain.value<loaded&&body.connections[0].gain.value>loaded*.8,'throttle release eases instead of switching amplitude');
 }finally{audio.dispose();env.restore();}
});

test('manufacturer synthesis characters differ while sustained boost reuses all voices and releases on pause',async()=>{
 const env=environment(),audio=createAudio();
 try{
  await audio.unlock();const ctx=env.contexts[0],body=ctx.oscillators[0],pitches=[];
  for(const vehicle of ['ferrari-enzo','mercedes-amg-gt','porsche-911-gt3']){
   for(let i=0;i<40;i++)audio.update({running:true,vehicle,speed:25,throttle:1,nitro:false},1/60);
   pitches.push(body.frequency.value);
  }
  assert.ok(new Set(pitches.map(p=>Math.round(p))).size===3,'manufacturer sound characters have distinct pitch envelopes');
  const count=ctx.all.length;
  for(let i=0;i<90;i++)audio.update({running:true,vehicle:'ferrari-enzo',speed:35,throttle:1,nitro:i<60},1/60);
  assert.equal(ctx.all.length,count,'boost attack, sustain and release allocate no new audio graph nodes');
  audio.update({running:false});assert.equal(ctx.gains[1].gain.value,0);
 }finally{audio.dispose();env.restore();}
});

test('original lobby music requires unlock, follows sound/visibility, and crossfades away from racing',async()=>{
 const env=environment(),audio=createAudio();
 try{
  audio.update({lobby:true});assert.equal(env.contexts.length,0);
  await audio.unlock();const ctx=env.contexts[0];
  const pad=ctx.oscillators[7],filter=pad.connections[0].connections[0],music=filter.connections[0];
  const nodes=ctx.all.length,pitches=new Set();
  for(let i=0;i<1400;i++){
   audio.update({lobby:true,vehicle:'ferrari-enzo'},.02);
   pitches.add(Math.round(pad.frequency.value));
  }
  assert.equal(music.gain.value,.65);assert.equal(ctx.gains[1].gain.value,0);
  assert.ok(pitches.size>=3,'the lobby has an original changing harmony rather than a static hum');
  assert.equal(ctx.all.length,nodes,'lobby music is a bounded reusable graph');
  audio.update({running:true,lobby:true,speed:25,vehicle:'ferrari-enzo'});assert.equal(music.gain.value,0);
  audio.update({running:false,lobby:false});assert.equal(music.gain.value,0,'pause/result views do not accidentally restart music');
  audio.update({lobby:true});assert.equal(music.gain.value,.65);
  audio.setMuted(true);assert.equal(music.gain.value,0);
  audio.setMuted(false);assert.equal(music.gain.value,.65);
  globalThis.document.hidden=true;env.listeners.get('visibilitychange')();assert.equal(music.gain.value,0);
 }finally{audio.dispose();env.restore();}
});

test('driving and music volume remain independently bounded and every audible path uses the master compressor',async()=>{
 const env=environment(),audio=createAudio();
 try{
  audio.setVolume(.5);audio.setMusicVolume(.3);
  audio.beep();
  assert.equal(env.contexts.length,0,'volume settings cannot unlock audio or create a graph');
  await audio.unlock();const ctx=env.contexts[0],master=ctx.gains[0],engine=ctx.gains[1];
  const pad=ctx.oscillators[7],music=pad.connections[0].connections[0].connections[0];
  const compressor=ctx.compressors[0];
  assert.equal(ctx.compressors.length,1);
  assert.deepEqual(master.connections,[compressor]);assert.deepEqual(compressor.connections,[ctx.destination]);
  assert.deepEqual(engine.connections,[master]);assert.deepEqual(music.connections,[master]);
  assert.equal(compressor.threshold.value,-10);assert.equal(compressor.knee.value,12);
  assert.equal(compressor.ratio.value,4);assert.equal(compressor.attack.value,.003);assert.equal(compressor.release.value,.18);
  audio.update({lobby:true});assert.equal(master.gain.value,.8);assert.equal(music.gain.value,.3);
  for(const [input,expected] of [[-5,0],[0,0],[.25,.4],[1,1.6],[5,1.6],[NaN,1.2],[Infinity,1.2]]){
   audio.setVolume(input);assert.ok(Math.abs(master.gain.value-expected)<1e-12);
   assert.equal(music.gain.value,.3,'master volume cannot alter the saved music mix');
  }
  audio.setVolume(.5);
  for(const [input,expected] of [[-5,0],[0,0],[.25,.25],[1,1],[5,1],[NaN,.65],[Infinity,.65]]){
   audio.setMusicVolume(input);assert.equal(music.gain.value,expected);assert.equal(master.gain.value,.8);
  }
  audio.update({running:true,lobby:true,vehicle:'ferrari-enzo',speed:35,nitro:true,throttle:1});
  assert.equal(engine.gain.value,1);assert.equal(music.gain.value,0,'race audio always takes precedence over lobby music');
  audio.setVolume(0);assert.equal(master.gain.value,0,'zero volume silences engine, Nitro and UI tones through the shared bus');
  audio.beep(880,.1);
  const cue=ctx.oscillators.at(-1);
  assert.deepEqual(cue.connections[0].connections,[ctx.gains[2]],'UI tones respect the dedicated SFX level');
  assert.deepEqual(ctx.gains[2].connections,[master],'SFX cannot bypass master volume or compression');
  audio.setVolume(1);audio.setMuted(true);audio.setVolume(.6);assert.equal(master.gain.value,0,'moving a slider cannot override mute');
  audio.setMuted(false);assert.equal(master.gain.value,.96);
  globalThis.document.hidden=true;env.listeners.get('visibilitychange')();audio.setVolume(1);assert.equal(master.gain.value,0);
 }finally{audio.dispose();env.restore();}
});

test('Liquid Lines is the only soundtrack and legacy choices cannot restore removed music',async()=>{
 for(const value of [undefined,null,'original','midnight-drive','after-hours','unapproved','liquid-lines'])assert.equal(normalizeLobbyStyle(value),'liquid-lines');
 assert.deepEqual(LOBBY_STYLES.map(style=>style.id),['liquid-lines']);
 for(let i=0;i<1200;i++){
  const frame=lobbyMusicFrame('liquid-lines',i/60);
  assert.equal(frame.bpm,168);
  for(const [key,value] of Object.entries(frame))if(typeof value==='number')assert.ok(Number.isFinite(value),key);
  assert.ok(frame.padGains.every(gain=>gain>=0&&gain<=.05));
  assert.ok(frame.kickGain>=0&&frame.kickGain<.17);assert.ok(frame.snareGain>=0&&frame.snareGain<.12);
  assert.deepEqual(lobbyMusicFrame('original',i/60),frame,'old saved IDs resolve to the approved arrangement');
 }
 const env=environment(),audio=createAudio();
 try{
  assert.equal(audio.setLobbyStyle('original'),'liquid-lines');assert.equal(env.contexts.length,0,'preference migration never unlocks playback');
  await audio.unlock();const ctx=env.contexts[0],count=ctx.all.length;
  for(const legacyStyle of ['original','midnight-drive','after-hours']){
   assert.equal(audio.setLobbyStyle(legacyStyle),'liquid-lines');
   for(let i=0;i<100;i++)audio.update({lobby:true},.02);
   assert.equal(ctx.all.length,count,'migrating a preference reuses instruments and ambience');
   const music=ctx.oscillators[7].connections[0].connections[0].connections[0];
   assert.equal(music.gain.value,.65);
  }
  audio.update({running:true,lobby:true});
  const music=ctx.oscillators[7].connections[0].connections[0].connections[0];assert.equal(music.gain.value,0);
  audio.setLobbyStyle('after-hours');assert.equal(music.gain.value,0,'preference migration cannot restart music during a race');
 }finally{audio.dispose();env.restore();}
});

test('engine and effects mixers are independent, bounded, and preserve pause, mute and gesture rules',async()=>{
 const env=environment(),audio=createAudio();
 try{
  audio.setEngineVolume(.4);audio.setSfxVolume(.6);audio.setMusicVolume(.3);
  assert.equal(env.contexts.length,0);
  await audio.unlock();const ctx=env.contexts[0],engine=ctx.gains[1],sfx=ctx.gains[2],raceSfx=ctx.gains[3];
  audio.update({running:true,vehicle:'mclaren-p1-gtr',speed:30,nitro:true});
  assert.equal(engine.gain.value,.4);assert.equal(sfx.gain.value,.6);assert.equal(raceSfx.gain.value,1);
  audio.setEngineVolume(0);assert.equal(engine.gain.value,0);assert.equal(sfx.gain.value,.6);
  audio.setSfxVolume(0);audio.setEngineVolume(.8);assert.equal(engine.gain.value,.8);assert.equal(sfx.gain.value,0);
  for(const [value,engineExpected,sfxExpected] of [[-5,0,0],[5,1,1],[NaN,1,.85],[Infinity,1,.85]]) {
   audio.setEngineVolume(value);audio.setSfxVolume(value);assert.equal(engine.gain.value,engineExpected);assert.equal(sfx.gain.value,sfxExpected);
  }
  audio.update({running:false,lobby:true});assert.equal(engine.gain.value,0);assert.equal(raceSfx.gain.value,0);assert.ok(sfx.gain.value>0,'UI effects remain available outside racing');
  audio.setMuted(true);assert.equal(sfx.gain.value,0);audio.setSfxVolume(1);assert.equal(sfx.gain.value,0);
 }finally{audio.dispose();env.restore();}
});

test('real event IDs trigger one reusable effect, old muted impacts stay silent, and pause cancels tails',async()=>{
 const env=environment(),audio=createAudio();
 try{
  const base={raceId:'race-one',running:true,vehicle:'mclaren-p1-gtr',speed:25,impact:{id:1,kind:'crash',strength:.8,severity:'heavy'}};
  audio.update(base);await audio.unlock();const ctx=env.contexts[0],nodeCount=ctx.all.length;
  const ramps=()=>ctx.gains.reduce((sum,gain)=>sum+gain.gain.ramps.length,0);
  audio.update(base);assert.equal(ramps(),0,'an impact before gesture unlock is not replayed');
  ctx.currentTime=.1;audio.update({...base,impact:{...base.impact,id:2}});const first=ramps();assert.ok(first>0);
  for(let i=0;i<30;i++)audio.update({...base,impact:{...base.impact,id:2}});assert.equal(ramps(),first,'one physics event must not sound every frame');
  audio.setMuted(true);audio.update({...base,impact:{...base.impact,id:3}});audio.setMuted(false);audio.update({...base,impact:{...base.impact,id:3}});assert.equal(ramps(),first,'unmute must not replay an old collision');
  const cancelledBefore=ctx.gains.reduce((sum,gain)=>sum+gain.gain.cancels.length,0);
  audio.update({running:false});assert.ok(ctx.gains.reduce((sum,gain)=>sum+gain.gain.cancels.length,0)>cancelledBefore);
  for(let i=4;i<100;i++){ctx.currentTime+=.015;audio.update({...base,impact:{...base.impact,id:i,severity:i%2?'wreck':'heavy'},pickupEvent:{id:i,kind:'nitro',amount:20,capacity:100}});}
  assert.equal(ctx.all.length,nodeCount,'many impacts and refills cannot create unbounded sources or graph nodes');
 }finally{audio.dispose();env.restore();}
});

test('three reusable stereo rival voices follow real relative position and all stop on pause',async()=>{
 const env=environment(),audio=createAudio();
 try{
  await audio.unlock();const ctx=env.contexts[0],count=ctx.all.length;
  const base={running:true,raceId:'stereo',speed:30,listener:{x:0,z:0,yaw:0},rivals:[{id:'right',vehicle:'ferrari-enzo',x:8,z:5,speed:35},{id:'left',vehicle:'rimac-nevera',x:-8,z:5,speed:35}]};
  audio.update(base);assert.equal(ctx.panners.length,3);
  assert.ok(ctx.panners.some(p=>p.pan.value>.6));assert.ok(ctx.panners.some(p=>p.pan.value<-.6));
  for(let i=0;i<1000;i++)audio.update({...base,listener:{x:0,z:0,yaw:i*.001},crowd:.5,road:'wet'});
  assert.equal(ctx.all.length,count);
  audio.update({running:false});assert.equal(ctx.gains[1].gain.value,0);assert.equal(ctx.gains[3].gain.value,0);
 }finally{audio.dispose();env.restore();}
});


test('actual graph suspends off-page, resumes without allocation and consumes silent event IDs',async()=>{
 const env=environment(),jobs=new Map();let id=0;
 const audio=createAudio({lifecycleOptions:{schedule:fn=>{jobs.set(++id,fn);return id;},cancel:key=>jobs.delete(key)}});
 const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 try{
  audio.update({running:true,vehicle:'ferrari-enzo',speed:25,raceId:10});await audio.unlock();const ctx=env.contexts[0],nodeCount=ctx.all.length;
  audio.setPageActive(false);assert.equal(ctx.gains[0].gain.value,0);for(const [key,fn]of jobs){jobs.delete(key);fn();}await settle();assert.equal(ctx.state,'suspended');
  audio.update({running:true,vehicle:'ferrari-enzo',speed:25,raceId:10,impact:{id:5,kind:'crash',strength:1}});
  audio.setPageActive(true);await settle();assert.equal(ctx.state,'running');assert.equal(ctx.all.length,nodeCount);
  const ramps=ctx.all.reduce((sum,node)=>sum+node.gain.ramps.length,0);
  audio.update({running:true,vehicle:'ferrari-enzo',speed:25,raceId:10,impact:{id:5,kind:'crash',strength:1}});
  assert.equal(ctx.all.reduce((sum,node)=>sum+node.gain.ramps.length,0),ramps,'old hidden impact does not replay after wake');
  audio.dispose();assert.equal(ctx.stateListeners.size,0);assert.equal(jobs.size,0);
 }finally{audio.dispose();env.restore();}
});
