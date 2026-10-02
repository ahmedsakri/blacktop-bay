import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRecordedEngine, recordedEngineFrame, recordingForVehicle, RECORDING_BUDGET } from '../src/recorded-engine.js';
import { ENGINE_RECORDINGS, RECORDING_CARS } from '../src/recorded-engine-manifest.js';
import { MANUFACTURER_VEHICLES } from '../src/manufacturer-vehicles.js';
import { createAudio } from '../src/audio.js';

const bank = ENGINE_RECORDINGS['ferrari-355'];
const car = id => MANUFACTURER_VEHICLES.find(vehicle => vehicle.id === id);
const motion = { rev: .6, load: 1, torque: 1 };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function settled(engine) { for (let i = 0; i < 100 && engine.status().pending; i++) await new Promise(resolve => setTimeout(resolve, 2)); assert.equal(engine.status().pending, false); }
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
class Param { value=0; setTargetAtTime(value) { this.value=value; } setValueAtTime(value) { this.value=value; } linearRampToValueAtTime(value) { this.value=value; } exponentialRampToValueAtTime(value) { this.value=value; } cancelScheduledValues() {} }
class Node {
 gain=new Param(); frequency=new Param(); Q=new Param(); playbackRate=new Param(); pan=new Param(); delayTime=new Param(); threshold=new Param(); knee=new Param(); ratio=new Param(); attack=new Param(); release=new Param();
 connections=[]; stopped=0; disconnected=0; started=false;
 connect(node) { this.connections.push(node); return node; } disconnect() { this.disconnected++; } start() { this.started=true; } stop() { this.stopped++; this.onended?.(); } setPeriodicWave() { this.type='custom'; }
}
class Context {
 currentTime=0; state='running'; sampleRate=48000; nodes=[]; sources=[]; destination={}; decodes=0;
 make() { const node=new Node(); this.nodes.push(node); return node; }
 createGain() { return this.make(); } createBiquadFilter() { return this.make(); } createOscillator() { const node=this.make(); this.sources.push(node); return node; }
 createBufferSource() { const node=this.make(); this.sources.push(node); return node; }
 createPeriodicWave() { return {}; } createStereoPanner() { return this.make(); } createDynamicsCompressor() { return this.make(); }
 createBuffer(channels,length) { return { getChannelData:()=>new Float32Array(length) }; }
 async decodeAudioData(bytes) { this.decodes++; const view=new DataView(bytes), duration=(view.getUint32(40,true)/2)/view.getUint32(24,true); return { numberOfChannels:1, duration, length:Math.round(duration*this.sampleRate) }; }
 async resume() { this.state='running'; } async suspend() { this.state='suspended'; } async close() { this.state='closed'; }
}
async function diskFetch(url) { return new Response(await readFile(new URL('../public'+url.split('?')[0],import.meta.url))); }
function setup(options={}) { const context=new Context(); const engine=createRecordedEngine({context,destination:context.destination,fetchImpl:diskFetch,...options}); return {context,engine}; }

test('shipping recordings preserve explicit provenance, exact asset hashes and bounded clean loop seams',async()=>{
 const data=JSON.parse(await readFile(new URL('../public/assets/audio/ENGINE-SOURCES.json',import.meta.url)));
 let total=0;
 for(const source of data.recordings){
  const entry=ENGINE_RECORDINGS[source.id], bytes=await readFile(new URL('../public'+entry.url.split('?')[0],import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  assert.equal(bytes.length,entry.bytes);assert.ok(bytes.length<=RECORDING_BUDGET.downloadBytes);total+=bytes.length;
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt16LE(34),16);assert.equal(bytes.readUInt32LE(24),24000);
  assert.ok(['CC0-1.0','CC-BY-3.0'].includes(source.license));assert.ok(source.author&&source.title&&source.sourceVehicle);assert.match(source.sourceUrl,/^https:\/\/(freesound.org|bigsoundbank.com)\//);assert.match(source.use,/proxy/);
  for(const layer of entry.layers){
   const start=Math.round(layer.start*24000),end=Math.round(layer.end*24000);let power=0,peak=0;
   for(let i=start;i<end;i++){const value=bytes.readInt16LE(44+i*2)/32768;power+=value*value;peak=Math.max(peak,Math.abs(value));}
   assert.ok(Math.sqrt(power/(end-start))>.045);assert.ok(peak<=.661);
   assert.ok(Math.abs(bytes.readInt16LE(44+start*2)-bytes.readInt16LE(44+(end-1)*2))<=1,'loop endpoint is continuous');
  }
 }
 assert.equal(total,585872);assert.equal(total,data.totalBytes);
 for(const [id,recording] of Object.entries(RECORDING_CARS)){assert.ok(car(id),id);assert.notEqual(car(id).powertrain,'electric');assert.ok(ENGINE_RECORDINGS[recording]);}
 assert.equal(recordingForVehicle(car('rimac-nevera')),null);assert.equal(recordingForVehicle(car('audi-r18')),null);
});

test('adjacent rev bands crossfade at constant power, bounded pitch, and load/impact focus remain smooth',()=>{
 for(let rev=0;rev<=1;rev+=.01){const frame=recordedEngineFrame(bank,{rev,load:1,torque:1});assert.ok(Math.abs(frame.layers.reduce((sum,v)=>sum+v.gain*v.gain,0)-1)<1e-10);assert.ok(frame.layers.every(v=>v.rate>=.82&&v.rate<=1.3));}
 assert.ok(recordedEngineFrame(bank,{...motion,load:0}).gain<recordedEngineFrame(bank,motion).gain*.4);
 assert.ok(recordedEngineFrame(bank,{...motion,focus:.82}).gain<recordedEngineFrame(bank,motion).gain);
 const idle=ENGINE_RECORDINGS['mustang-idle'];assert.ok(recordedEngineFrame(idle,{rev:1}).layers[0].gain<.3,'idle take fades as revs rise');
});

test('recordings are lazy, selected-car only, bounded to three voices and reused across normal updates',async()=>{
 const {context,engine}=setup();
 engine.update(car('mclaren-p1-gtr'),motion);assert.equal(context.sources.length,0);assert.equal(engine.status().fetches,0);
 engine.setAudible(true);engine.update(car('mclaren-p1-gtr'),motion);await settled(engine);
 assert.equal(engine.status().active,'ferrari-355');assert.equal(engine.status().voices,3);assert.equal(context.decodes,1);
 for(let i=0;i<600;i++)engine.update(car('ferrari-458-italia'),{...motion,rev:(i%100)/100});
 assert.equal(engine.status().fetches,1);assert.equal(context.sources.length,3);assert.ok(engine.status().blend>.99);
 engine.setAudible(false);assert.equal(context.nodes.find(node=>node.connections.includes(context.destination)).gain.value,0);
 engine.dispose();engine.dispose();assert.ok(context.sources.every(source=>source.stopped===1));assert.ok(context.nodes.every(node=>node.disconnected>0));assert.equal(engine.status().decodedBytes,0);
});

test('four bank switches retain only the bounded LRU and stop old voices before starting replacements',async()=>{
 const {context,engine}=setup();engine.setAudible(true);
 for(const id of ['mclaren-p1-gtr','porsche-930-turbo','mercedes-amg-gt','aston-martin-one-77']){
  engine.update(car(id),motion);await settled(engine);assert.ok(engine.status().voices<=3);assert.ok(engine.status().cacheBanks<=3);assert.ok(engine.status().decodedBytes<=RECORDING_BUDGET.decodedBytes);
  assert.ok(context.sources.filter(source=>source.started&&!source.stopped).length<=3);
 }
 assert.equal(engine.status().cacheBanks,3);assert.equal(engine.status().fetches,4);
 engine.dispose();
});

test('failed or oversized recordings keep a stable procedural fallback without repeated requests',async()=>{
 for(const fetchImpl of [async()=>{throw new Error('offline');},async()=>new Response(new Uint8Array(bank.bytes+1)),async()=>new Response('bad wav')]){
  const {context,engine}=setup({fetchImpl});engine.setAudible(true);engine.update(car('mclaren-p1-gtr'),motion);await settled(engine);
  for(let i=0;i<300;i++)assert.equal(engine.update(car('mclaren-p1-gtr'),motion),0);
  assert.equal(engine.status().fetches,1);assert.deepEqual(engine.status().failed,['ferrari-355']);assert.equal(context.sources.length,0);engine.dispose();
 }
});

test('rapid selection aborts stale requests, never poisons that bank, and creates no stale voices',async()=>{
 let inFlight=0,peak=0;
 const pending=[];
 const {engine}=setup({fetchImpl:(url,{signal})=>new Promise((resolve,reject)=>{
  inFlight++;peak=Math.max(peak,inFlight);const done=fn=>value=>{inFlight--;fn(value);};
  signal.addEventListener('abort',()=>done(reject)(new Error('aborted')),{once:true});pending.push({url,resolve:done(resolve)});
 })});
 engine.setAudible(true);engine.update(car('mclaren-p1-gtr'),motion);engine.update(car('porsche-930-turbo'),motion);await tick();
 assert.equal(pending.length,2);assert.equal(engine.status().voices,0);assert.deepEqual(engine.status().failed,[]);
 pending[1].resolve(await diskFetch(pending[1].url));await settled(engine);
 assert.equal(engine.status().active,'porsche-911');assert.equal(peak,1);engine.dispose();
});

test('decode completing after pause or disposal cannot resurrect audio or retain buffers',async()=>{
 for(const action of ['pause','dispose']){
  const late=deferred(),{context,engine}=setup();context.decodeAudioData=()=>late.promise;
  engine.setAudible(true);engine.update(car('mclaren-p1-gtr'),motion);
  await new Promise(resolve=>setTimeout(resolve,10));
  if(action==='pause')engine.setAudible(false);else engine.dispose();
  late.resolve({numberOfChannels:1,duration:bank.duration,length:bank.duration*48000});await settled(engine);
  assert.equal(engine.status().voices,0);assert.equal(engine.status().cacheBanks,0);engine.dispose();
 }
});

test('a stalled fetch/decode has an eight-second ceiling and cannot activate on late completion',async()=>{
 const timers=new Map();let next=0;const late=deferred();
 const {engine}=setup({fetchImpl:()=>late.promise,schedule(fn,ms){assert.equal(ms,8000);const id=++next;timers.set(id,fn);return id;},cancel:id=>timers.delete(id)});
 engine.setAudible(true);engine.update(car('mclaren-p1-gtr'),motion);[...timers.values()][0]();await settled(engine);
 assert.equal(engine.status().voices,0);assert.deepEqual(engine.status().failed,['ferrari-355']);assert.equal(timers.size,0);
 late.resolve(await diskFetch(bank.url));await tick();await tick();assert.equal(engine.status().cacheBanks,0);engine.dispose();
});

test('actual createAudio preserves gesture/mixer/page gates and drops engine masking for fresh impacts',async()=>{
 let fetches=0;const context=new Context();context.state='suspended';
 const audio=createAudio({contextFactory:()=>context,recordedEngineOptions:{fetchImpl:async url=>{fetches++;return diskFetch(url);}}});
 const state={running:true,vehicle:'mclaren-p1-gtr',speed:28,throttle:1,raceId:44};
 audio.update(state);assert.equal(context.nodes.length,0);assert.equal(fetches,0);
 await audio.unlock();audio.update({lobby:true,vehicle:state.vehicle});assert.equal(fetches,0);
 audio.update(state);for(let i=0;i<100&&audio.recordingStatus().pending;i++)await new Promise(resolve=>setTimeout(resolve,2));
 for(let i=0;i<120;i++)audio.update(state);
 assert.equal(audio.recordingStatus().active,'ferrari-355');assert.equal(fetches,1);
 const body=context.sources[0],before=body.connections[0].gain.value;
 audio.update({...state,impact:{id:1,kind:'crash',strength:1}});assert.ok(body.connections[0].gain.value<before*.9);
 audio.setPageActive(false);assert.equal(context.nodes[0].gain.value,0);
 audio.setPageActive(true);const engineBus=body.connections[0].connections[0].connections[0];assert.ok(engineBus.gain.value>0);audio.setEngineVolume(0);assert.equal(engineBus.gain.value,0);
 audio.setMuted(true);assert.equal(context.nodes[0].gain.value,0);
 audio.dispose();assert.equal(context.state,'closed');assert.ok(context.sources.filter(source=>source.started).every(source=>source.stopped===1));
});
