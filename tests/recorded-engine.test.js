import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRecordedEngine, recordedEngineFrame, recordingForVehicle, RECORDING_BUDGET } from '../src/recorded-engine.js';
import { ENGINE_RECORDINGS, RECORDING_CARS, RECORDING_MIXES } from '../src/recorded-engine-manifest.js';
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
  assert.ok(['CC0-1.0','CC-BY-2.0','CC-BY-3.0','CC-BY-4.0','Sonniss-GDC-2026-v2'].includes(source.license));assert.ok(source.author&&source.title&&source.sourceVehicle);assert.match(source.sourceUrl,/^https:\/\/(freesound.org|bigsoundbank.com|commons.wikimedia.org|sonniss.com|www\.flickr\.com)\//);assert.ok(source.use.length>60);
  for(const layer of entry.layers){
   const start=Math.round(layer.start*24000),end=Math.round(layer.end*24000);let power=0,peak=0;
   for(let i=start;i<end;i++){const value=bytes.readInt16LE(44+i*2)/32768;power+=value*value;peak=Math.max(peak,Math.abs(value));}
   assert.ok(Math.sqrt(power/(end-start))>.045);assert.ok(peak<=.661);
   assert.ok(Math.abs(bytes.readInt16LE(44+start*2)-bytes.readInt16LE(44+(end-1)*2))<=1,'loop endpoint is continuous');
  }
 }
 assert.equal(total,4234024);assert.equal(total,data.totalBytes);
 assert.deepEqual(Object.keys(RECORDING_CARS).sort(),MANUFACTURER_VEHICLES.map(vehicle=>vehicle.id).sort());
 assert.deepEqual(Object.keys(RECORDING_MIXES).sort(),Object.keys(RECORDING_CARS).sort());
 for(const [id,recording] of Object.entries(RECORDING_CARS)){
  assert.ok(car(id),id);assert.ok(ENGINE_RECORDINGS[recording]);assert.equal(recordingForVehicle(car(id)).id,recording);
  assert.equal(ENGINE_RECORDINGS[recording].kind==='electric',car(id).powertrain==='electric');
  const source=data.recordings.find(entry=>entry.id===recording);assert.ok(source.cars.includes(id));
  assert.ok(RECORDING_MIXES[id][2]>0&&RECORDING_MIXES[id][2]<=1);
 }
 assert.equal(Object.keys(ENGINE_RECORDINGS).length,26);
 assert.equal(new Set(data.recordings.map(entry=>entry.sha256)).size,26,'families use genuinely different recordings');
 assert.equal(new Set(data.recordings.map(entry=>entry.sourceSha256)).size,26);
 assert.equal(new Set(Object.values(RECORDING_CARS)).size,22);
 assert.equal(data.activeBanks,22);
 assert.equal(recordingForVehicle({id:'unsupported-car'}),null);
 assert.equal(recordingForVehicle({id:'bmw-f22-eurofighter',powertrain:'electric'}),null,'never play combustion loops on an electric vehicle');
 const diesel=data.recordings.find(entry=>entry.id==='bmw-diesel');assert.equal(diesel.additionalSources.length,2);
 for(const extra of diesel.additionalSources){assert.equal(extra.license,'CC0-1.0');assert.match(extra.sourceSha256,/^[a-f0-9]{64}$/);assert.ok(diesel.layers.some(layer=>layer.sourceFile===extra.sourceFile));}
 assert.equal(data.recordings.find(entry=>entry.id==='tesla-electric').sourceFamily,'electric');
});

test('GranTurismo and AMG use documented family recordings with three real source bands, not the unrelated idle proxy',async()=>{
 const data=JSON.parse(await readFile(new URL('../public/assets/audio/ENGINE-SOURCES.json',import.meta.url)));
 for(const [id,bankId,model] of [['maserati-mc-stradale','maserati-granturismo-v8','GranTurismo S'],['mercedes-amg-gt','mercedes-amg-gtr-2018','AMG GT R']]){
  const selected=recordingForVehicle(car(id)),source=data.recordings.find(entry=>entry.id===bankId);
  assert.equal(selected.id,bankId);assert.equal(selected.layers.length,3);
  assert.ok(source.sourceVehicle.includes(model));assert.match(source.use,/proxy/);
  assert.deepEqual(source.cars,[id]);assert.match(source.sourceSha256,/^[a-f0-9]{64}$/);
  assert.ok(new Set(selected.layers.map(layer=>layer.sourceStart)).size===3);
  assert.ok(selected.layers.every(layer=>layer.sourceDuration>=.8));
  const high=recordedEngineFrame(selected,{rev:.95,load:1},RECORDING_MIXES[id]);
  assert.equal(high.layers[2].gain,1);assert.ok(high.gain<=.35);
 }
 assert.deepEqual(data.recordings.find(entry=>entry.id==='mustang-idle').cars,[],'legacy bank is retained but not selected');
 assert.equal(RECORDING_CARS['bugatti-veyron'],'murcielago-v12','unverified alternatives must not silently become W16 claims');
 assert.equal(RECORDING_CARS['ferrari-testarossa'],'testarossa-1990');
 assert.equal(RECORDING_CARS['rimac-nevera'],'tesla-electric');
});

test('adjacent rev bands crossfade at constant power, bounded pitch, and load/impact focus remain smooth',()=>{
 for(let rev=0;rev<=1;rev+=.01){const frame=recordedEngineFrame(bank,{rev,load:1,torque:1});assert.ok(Math.abs(frame.layers.reduce((sum,v)=>sum+v.gain*v.gain,0)-1)<1e-10);assert.ok(frame.layers.every(v=>v.rate>=.82&&v.rate<=1.3));}
 assert.ok(recordedEngineFrame(bank,{...motion,load:0}).gain<recordedEngineFrame(bank,motion).gain*.4);
 assert.ok(recordedEngineFrame(bank,{...motion,focus:.82}).gain<recordedEngineFrame(bank,motion).gain);
 const idle=ENGINE_RECORDINGS['mustang-idle'];assert.ok(recordedEngineFrame(idle,{rev:1}).layers[0].gain<.3,'idle take fades as revs rise');
});

test('Gallardo keeps the approved soft mix and attenuates its single idle layer at high revs',()=>{
 const selected=recordingForVehicle(car('lamborghini-gallardo')),mix=RECORDING_MIXES['lamborghini-gallardo'];
 assert.equal(selected.id,'gallardo-idle');assert.equal(selected.layers.length,1);
 assert.deepEqual(mix,[.95,.98,.87]);
 const idle=recordedEngineFrame(selected,{rev:.22,load:1},mix),high=recordedEngineFrame(selected,{rev:1,load:1},mix);
 assert.ok(high.layers[0].gain<.3&&high.layers[0].gain<idle.layers[0].gain*.4,'a stationary idle cannot dominate full revs');
 assert.ok(high.gain<=.42&&idle.gain<=.42,'the approved recording gain ceiling stays bounded');
});

test('recordings are lazy, selected-car only, bounded to three voices and reused across normal updates',async()=>{
 const {context,engine}=setup();
 engine.update(car('bmw-f22-eurofighter'),motion);assert.equal(context.sources.length,0);assert.equal(engine.status().fetches,0);
 engine.setAudible(true);engine.update(car('bmw-f22-eurofighter'),motion);await settled(engine);
 assert.equal(engine.status().active,'ferrari-355');assert.equal(engine.status().voices,3);assert.equal(context.decodes,1);
 for(let i=0;i<600;i++)engine.update(car('koenigsegg-one-1'),{...motion,rev:(i%100)/100});
 assert.equal(engine.status().fetches,1);assert.equal(context.sources.length,3);assert.ok(engine.status().blend>.99);
 engine.setAudible(false);assert.equal(context.nodes.find(node=>node.connections.includes(context.destination)).gain.value,0);
 engine.dispose();engine.dispose();assert.ok(context.sources.every(source=>source.stopped===1));assert.ok(context.nodes.every(node=>node.disconnected>0));assert.equal(engine.status().decodedBytes,0);
});

test('four bank switches retain only the bounded LRU and stop old voices before starting replacements',async()=>{
 const {context,engine}=setup();engine.setAudible(true);
 for(const id of ['bmw-f22-eurofighter','porsche-930-turbo','mercedes-amg-gt','aston-martin-one-77']){
  engine.update(car(id),motion);await settled(engine);assert.ok(engine.status().voices<=3);assert.ok(engine.status().cacheBanks<=3);assert.ok(engine.status().decodedBytes<=RECORDING_BUDGET.decodedBytes);
  assert.ok(context.sources.filter(source=>source.started&&!source.stopped).length<=3);
 }
 assert.equal(engine.status().cacheBanks,3);assert.equal(engine.status().fetches,4);
 engine.dispose();
});

test('failed or oversized recordings keep a stable procedural fallback without repeated requests',async()=>{
 for(const fetchImpl of [async()=>{throw new Error('offline');},async()=>new Response(new Uint8Array(bank.bytes+1)),async()=>new Response('bad wav')]){
  const {context,engine}=setup({fetchImpl});engine.setAudible(true);engine.update(car('bmw-f22-eurofighter'),motion);await settled(engine);
  for(let i=0;i<300;i++)assert.equal(engine.update(car('bmw-f22-eurofighter'),motion),0);
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
 engine.setAudible(true);engine.update(car('bmw-f22-eurofighter'),motion);engine.update(car('porsche-930-turbo'),motion);await tick();
 assert.equal(pending.length,2);assert.equal(engine.status().voices,0);assert.deepEqual(engine.status().failed,[]);
 pending[1].resolve(await diskFetch(pending[1].url));await settled(engine);
 assert.equal(engine.status().active,'porsche-911');assert.equal(peak,1);engine.dispose();
});

test('decode completing after pause or disposal cannot resurrect audio or retain buffers',async()=>{
 for(const action of ['pause','dispose']){
  const late=deferred(),{context,engine}=setup();context.decodeAudioData=()=>late.promise;
  engine.setAudible(true);engine.update(car('bmw-f22-eurofighter'),motion);
  await new Promise(resolve=>setTimeout(resolve,10));
  if(action==='pause')engine.setAudible(false);else engine.dispose();
  late.resolve({numberOfChannels:1,duration:bank.duration,length:bank.duration*48000});await settled(engine);
  assert.equal(engine.status().voices,0);assert.equal(engine.status().cacheBanks,0);engine.dispose();
 }
});

test('a stalled fetch/decode has an eight-second ceiling and cannot activate on late completion',async()=>{
 const timers=new Map();let next=0;const late=deferred();
 const {engine}=setup({fetchImpl:()=>late.promise,schedule(fn,ms){assert.equal(ms,8000);const id=++next;timers.set(id,fn);return id;},cancel:id=>timers.delete(id)});
 engine.setAudible(true);engine.update(car('bmw-f22-eurofighter'),motion);[...timers.values()][0]();await settled(engine);
 assert.equal(engine.status().voices,0);assert.deepEqual(engine.status().failed,['ferrari-355']);assert.equal(timers.size,0);
 late.resolve(await diskFetch(bank.url));await tick();await tick();assert.equal(engine.status().cacheBanks,0);engine.dispose();
});

test('actual createAudio preserves gesture/mixer/page gates and drops engine masking for fresh impacts',async()=>{
 let fetches=0;const context=new Context();context.state='suspended';
 const audio=createAudio({contextFactory:()=>context,recordedEngineOptions:{fetchImpl:async url=>{fetches++;return diskFetch(url);}}});
 const state={running:true,vehicle:'bmw-f22-eurofighter',speed:28,throttle:1,raceId:44};
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


test('all 33 catalogue cars decode their actual recording and keep the same cache, request and voice bounds',async()=>{
 const {context,engine}=setup();engine.setAudible(true);
 for(const vehicle of MANUFACTURER_VEHICLES){
  engine.update(vehicle,motion);await settled(engine);engine.update(vehicle,motion);
  const status=engine.status();assert.equal(status.active,RECORDING_CARS[vehicle.id],vehicle.id);
  assert.equal(status.voices,ENGINE_RECORDINGS[status.active].layers.length);
  assert.ok(status.voices<=3);assert.ok(status.cacheBanks<=3);assert.ok(status.decodedBytes<=RECORDING_BUDGET.decodedBytes);
  assert.deepEqual(status.failed,[]);assert.ok(context.sources.filter(source=>!source.stopped).length<=3);
 }
 engine.dispose();assert.equal(engine.status().voices,0);assert.equal(engine.status().decodedBytes,0);
});

test('electric driving recordings stay silent at rest, have no exhaust boost and never exceed the prior mix gain',async()=>{
 for(const id of ['rimac-concept-one','rimac-nevera']){
  const selected=recordingForVehicle(car(id)),mix=RECORDING_MIXES[id];
  assert.equal(recordedEngineFrame(selected,{rev:0,load:1},mix).gain,0);
  let previous=0;
  for(let rev=0;rev<=1;rev+=.005){
   const frame=recordedEngineFrame(selected,{rev,load:1},mix);
   assert.equal(frame.exhaust,0);assert.ok(frame.gain>=previous-1e-12);assert.ok(frame.gain<.21);
   assert.ok(frame.gain-previous<.025);previous=frame.gain;
   assert.ok(frame.layers.every(layer=>layer.rate>=.82&&layer.rate<=1.3));
  }
  const {engine}=setup();engine.setAudible(true);engine.update(car(id),{rev:0,load:1});await settled(engine);
  assert.equal(engine.update(car(id),{rev:0,load:1}),0,'procedural sound is not ducked by a silent recording');
  assert.ok(engine.update(car(id),motion)>0);engine.dispose();
 }
 assert.notDeepEqual(RECORDING_MIXES['rimac-concept-one'],RECORDING_MIXES['rimac-nevera']);
 for(const vehicle of MANUFACTURER_VEHICLES)for(let rev=0;rev<=1;rev+=.01){
  const frame=recordedEngineFrame(recordingForVehicle(vehicle),{rev,load:1},RECORDING_MIXES[vehicle.id]);
  assert.ok(Number.isFinite(frame.gain)&&frame.gain<=.420001,vehicle.id);assert.ok(frame.layers.length<=3);
 }
});

test('an electric request also obeys actual createAudio mute, pause and page lifecycle gates',async()=>{
 const context=new Context();context.state='suspended';let fetches=0;
 const audio=createAudio({contextFactory:()=>context,recordedEngineOptions:{fetchImpl:async url=>{fetches++;return diskFetch(url);}}});
 const state={running:true,vehicle:'rimac-nevera',speed:25,throttle:1,raceId:45};
 audio.update(state);assert.equal(fetches,0);await audio.unlock();audio.setMuted(true);audio.update(state);assert.equal(fetches,0);
 audio.setMuted(false);audio.setEngineVolume(0);audio.update(state);assert.equal(fetches,0);
 audio.setEngineVolume(1);audio.setPageActive(false);audio.update(state);assert.equal(fetches,0);
 audio.setPageActive(true);audio.update(state);for(let i=0;i<100&&audio.recordingStatus().pending;i++)await new Promise(resolve=>setTimeout(resolve,2));
 assert.equal(audio.recordingStatus().active,'tesla-electric');assert.equal(fetches,1);
 const output=context.nodes.find(node=>node.connections.includes(context.destination));
 audio.update({...state,running:false});assert.equal(output.gain.value,0);audio.dispose();
});

test('actual recording mix suppresses procedural buzz and unducked turbine tones while failure keeps a full fallback',async()=>{
 for(const id of ['maserati-mc-stradale','mercedes-amg-gt','bmw-i8','rimac-nevera']){
  const values=[];
  for(const loaded of [false,true]){
   const context=new Context(),audio=createAudio({contextFactory:()=>context,recordedEngineOptions:{fetchImpl:loaded?diskFetch:async()=>{throw new Error('offline');}}});
   const state={running:true,vehicle:id,speed:32,throttle:1,raceId:'mix-review'};
   await audio.unlock();audio.update(state);
   for(let i=0;i<100&&audio.recordingStatus().pending;i++)await new Promise(resolve=>setTimeout(resolve,2));
   for(let i=0;i<180;i++)audio.update(state);
   const body=context.sources[0],filter=body.connections[0].connections[0];
   const engineSources=context.sources.filter(source=>source.connections[0]?.connections.includes(filter));
   assert.equal(engineSources.length,5,'body, harmonic, sub, exhaust and turbine share the filtered procedural bed');
   values.push({gains:engineSources.map(source=>source.connections[0].gain.value),cutoff:filter.frequency.value});
   const count=context.sources.length;for(let i=0;i<180;i++)audio.update({...state,nitro:i<120});
   assert.equal(context.sources.length,count,'new mix reuses all engine and Nitro sources');
   audio.update({...state,running:false});assert.equal(context.nodes[0].gain.value,0);audio.dispose();
  }
  const [fallback,recorded]=values;
  assert.ok(fallback.gains[0]>.015,'network failure must retain an audible procedural engine');
  assert.ok(recorded.gains[0]<fallback.gains[0]*.20,'recording dominates the procedural body');
  assert.ok(recorded.gains[1]<fallback.gains[1]*.08,'higher oscillator tone is strongly reduced');
  assert.ok(recorded.gains[4]<fallback.gains[4]*.08,'turbine tone cannot bypass recording attenuation');
  assert.ok(recorded.cutoff<fallback.cutoff*.65,'procedural high harmonics roll off further under a recording');
 }
 for(const car of MANUFACTURER_VEHICLES)for(const rev of [0,.25,.5,.75,1]){
  const frame=recordedEngineFrame(recordingForVehicle(car),{rev,load:1},RECORDING_MIXES[car.id]);
  assert.ok(frame.layers.every(layer=>layer.rate>=.90&&layer.rate<=1.20),'recordings avoid extreme tape-speed pitch shifts');
  assert.ok(frame.cutoff<=3300,'recorded highs stay below the former bright 4–5 kHz band');
  assert.ok(frame.gain<=.420001,'the source gain ceiling was not raised to overpower synthesis');
 }
});


test('33-car source audit separates model matches from unresolved years, variants, builds and layouts',async()=>{
 const sources=JSON.parse(await readFile(new URL('../public/assets/audio/ENGINE-SOURCES.json',import.meta.url)));
 const coverage=JSON.parse(await readFile(new URL('../public/assets/audio/ENGINE-COVERAGE.json',import.meta.url)));
 const candidates=JSON.parse(await readFile(new URL('../public/assets/audio/ENGINE-CANDIDATES.json',import.meta.url)));
 assert.deepEqual(coverage.cars.map(row=>row.carId).sort(),MANUFACTURER_VEHICLES.map(car=>car.id).sort());
 assert.equal(new Set(coverage.cars.map(row=>row.carId)).size,33);
 for(const row of coverage.cars){
  const source=sources.recordings.find(source=>source.id===RECORDING_CARS[row.carId]);
  assert.equal(row.bank,source.id);assert.equal(row.recordedVehicle,source.sourceVehicle);assert.equal(row.sourceLicense,source.license);
  assert.ok(row.identityGap.length>35);assert.match(row.visualSource,/^https:\/\//);
  assert.ok(row.candidateIds.every(id=>candidates.candidates.some(candidate=>candidate.id===id)),row.carId);
 }
 const byId=Object.fromEntries(coverage.cars.map(row=>[row.carId,row]));
 assert.equal(coverage.modelMatches,6);assert.equal(coverage.improvedAssignments,14);
 assert.equal(coverage.fullyVerifiedExactSpecifications,0,'unspecified target years/builds cannot become a 100% exact claim');
 for(const id of ['bugatti-veyron','bmw-i8','audi-r18','porsche-919-hybrid'])assert.equal(byId[id].fidelity,'wrong-architecture-proxy');
 assert.match(byId['ferrari-458-italia'].identityGap,/Spider/);assert.equal(byId['ferrari-458-italia'].exactModelVariant,false);
 assert.match(byId['nissan-gt-r-2018'].identityGap,/2012.*modified.*2018/);
 const oldSource=Object.fromEntries(sources.recordings.map(source=>[source.id,source]));
 assert.equal(byId['ferrari-250-gto'].bank,'ferrari-250-gto');
 assert.equal(byId['ferrari-250-gto'].modelMatch,true);assert.equal(byId['ferrari-250-gto'].exactModelVariant,false);
 assert.match(byId['ferrari-250-gto'].identityGap,/1964.*not.*certified/);
 assert.equal(byId['lamborghini-gallardo'].bank,'gallardo-idle');
 assert.equal(byId['lamborghini-gallardo'].modelMatch,true);assert.equal(byId['lamborghini-gallardo'].exactModelVariant,false);
 assert.match(byId['lamborghini-gallardo'].identityGap,/2004.*not.*certified/);
 assert.deepEqual(oldSource['gallardo-idle'].cars,['lamborghini-gallardo']);
 assert.deepEqual(oldSource['huracan-v10'].cars,['lamborghini-huracan']);
 assert.doesNotMatch(oldSource['huracan-v10'].use,/Gallardo/);
 assert.equal(byId['lotus-elise'].bank,'lotus-elise');
 assert.equal(byId['lotus-elise'].modelMatch,true);assert.equal(byId['lotus-elise'].exactModelVariant,false);
 assert.match(byId['lotus-elise'].identityGap,/generation.*engine/);
 assert.deepEqual(oldSource['honda-na-i4'].cars,[]);
 assert.doesNotMatch(oldSource['honda-na-i4'].use,/proxy for Lotus/);
 assert.doesNotMatch(oldSource['huracan-v10'].use,/Audi|R8/);
 assert.doesNotMatch(oldSource['murcielago-v12'].use,/Aventador/);
 assert.doesNotMatch(oldSource['ferrari-classic-v12'].use,/Testarossa|250 GTO/);
 const studio=sources.recordings.filter(source=>source.license==='Sonniss-GDC-2026-v2');assert.equal(studio.length,7);
 for(const source of studio){
  assert.equal(source.sampleRate,24000);assert.equal(source.layers.length,3);assert.equal(source.bytes,180044);
  assert.ok(source.sourceBytes>source.bytes);assert.match(source.sourceSha256,/^[a-f0-9]{64}$/);
  assert.match(source.bundleTracklistUrl,/^https:\/\/docs.google.com\/spreadsheets\//);
  assert.match(source.rights,/not licensed for redistribution/);assert.match(source.licenseUrl,/sonniss.com\/gdc-bundle-license/);
 }
});
