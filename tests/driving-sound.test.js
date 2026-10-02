import test from 'node:test';
import assert from 'node:assert/strict';
import {drivingVoice,nitroSoundFrame,createEngineSoundMotion,createTyreSoundMotion,engineSpectrum} from '../src/driving-sound.js';
import {VEHICLES} from '../src/vehicles.js';

test('boost opens gently into low turbine thrust with restrained air and a short release',()=>{
 const silent=nitroSoundFrame({active:true,age:0,speed:35});
 const onset=nitroSoundFrame({active:true,age:.08,speed:35});
 const sustain=nitroSoundFrame({active:true,age:1,speed:35});
 const off=nitroSoundFrame({active:false,speed:35});
 assert.ok(onset.impact>sustain.impact*1000&&onset.lowGain>sustain.lowGain);
 assert.equal(silent.impact,0);assert.equal(silent.lowGain,0);assert.ok(onset.air>sustain.air,'initial whoosh recedes so it cannot mask the engine');
 assert.ok(sustain.air<.025&&sustain.coreFrequency<150&&sustain.coreGain>0&&sustain.coreGain<.015);
 assert.equal(off.air,0);assert.equal(off.lowGain,0);assert.equal(off.impact,0);assert.ok(off.release>0);
 for(const value of Object.values(nitroSoundFrame({active:true,age:Infinity,speed:NaN})))assert.ok(Number.isFinite(value));
});

test('electric, endurance and combustion voices retain distinct character without claiming recorded engines',()=>{
 assert.equal(drivingVoice({powertrain:'electric'}).gears,1);
 assert.equal(drivingVoice({id:'porsche-919-hybrid',family:'gt',brand:'Porsche',powertrain:'hybrid'}).gears,7);
 assert.equal(drivingVoice({brand:'McLaren',family:'gt'}).gears,6);
 assert.notEqual(drivingVoice({brand:'Ferrari'}).range,drivingVoice({brand:'BMW'}).range);
});

test('all 33 cars have bounded individually authored engine envelopes with appropriate electric and endurance gearing',()=>{
 assert.equal(VEHICLES.length,33);
 const profiles=new Set();
 for(const car of VEHICLES){
  const voice=drivingVoice(car);
  for(const key of ['gears','idle','range','body','harmonic','sub','cutoff'])assert.ok(Number.isFinite(voice[key]),`${car.id} ${key}`);
  assert.ok(voice.idle>=25&&voice.idle<=200,car.id);
  assert.ok(voice.range>=40&&voice.range<=700,car.id);
  assert.ok(voice.cutoff>=500&&voice.cutoff<=4000,car.id);
  assert.ok(voice.body>0&&voice.body<=.2,car.id);
  assert.ok(voice.harmonic>0&&voice.harmonic<=.08,car.id);
  assert.ok(voice.sub>0&&voice.sub<=.06,car.id);
  assert.equal(voice.electric,car.powertrain==='electric');
  assert.ok(Number.isInteger(voice.gears)&&voice.gears>=1&&voice.gears<=8);
  if(car.powertrain==='electric')assert.equal(voice.gears,1);
  profiles.add(JSON.stringify([voice.idle,voice.range,voice.body,voice.harmonic,voice.cutoff]));
 }
 assert.equal(profiles.size,VEHICLES.length,'car-specific character must affect synthesis, not just the model label');
 assert.equal(drivingVoice(VEHICLES.find(car=>car.id==='audi-r18')).gears,7);
 assert.equal(drivingVoice(VEHICLES.find(car=>car.id==='porsche-919-hybrid')).gears,7);
});

test('Nitro envelopes remain finite and bounded at extreme speeds and ages without a stuck release bus',()=>{
 for(const active of [false,true])for(const electric of [false,true])for(const speed of [-100,0,35,100,999,NaN,Infinity])for(const age of [-10,0,.1,1,100,NaN,Infinity]){
  const sound=nitroSoundFrame({active,electric,speed,age});
  assert.ok(Object.values(sound).every(Number.isFinite));
  assert.ok(sound.air>=0&&sound.air<=.3);
  assert.ok(sound.impact>=0&&sound.impact<=.16);
  assert.ok(sound.lowGain>=0&&sound.lowGain<=.145);
  assert.ok(sound.airCutoff>=340&&sound.airCutoff<=560);
  assert.ok(sound.coreFrequency>=105&&sound.coreFrequency<=138);
  assert.ok(sound.lowFrequency>=48&&sound.lowFrequency<=64);
  if(active)assert.equal(sound.release,0);
  else {assert.equal(sound.air,0);assert.equal(sound.impact,0);assert.equal(sound.lowGain,0);}
 }
});

test('engine load, gear transitions and their rounded harmonic spectrum are bounded across every car',()=>{
 for(const vehicle of VEHICLES){
  const voice=drivingVoice(vehicle),engine=createEngineSoundMotion(),state={running:true,voice,vehicleId:vehicle.id,topSpeed:vehicle.handling.topSpeed,throttle:1};
  let previous=engine.update({...state,speed:0},.02),shifts=0;
  for(let speed=.1;speed<=vehicle.handling.topSpeed+1;speed+=.1){
   const frame=engine.update({...state,speed},.02);
   assert.ok(Object.values(frame).every(value=>typeof value==='boolean'||Number.isFinite(value)),vehicle.id);
   assert.ok(Math.abs(frame.pitch-previous.pitch)<voice.range*.22,`${vehicle.id}: smooth gear transition`);
   assert.ok(frame.torque>=.82&&frame.torque<=1);
   if(frame.gear>previous.gear)shifts++;
   previous=frame;
  }
  assert.equal(shifts,voice.gears-1,vehicle.id);
 }
 for(const overtone of [false,true]){
  const wave=engineSpectrum(overtone);assert.equal(wave.real[0],0);assert.equal(wave.imag[0],0);
  assert.ok(wave.imag.length<=10);assert.ok(wave.imag.at(-1)<.01);
  for(let i=2;i<wave.imag.length;i++)assert.ok(wave.imag[i]<wave.imag[i-1]);
 }
});

test('same-speed pause resume retains the chosen gear without false shifts or throttle steps',()=>{
 const engine=createEngineSoundMotion(),voice=drivingVoice(),state={running:true,voice,vehicleId:'test',raceId:1,speed:40,topSpeed:55,throttle:1};
 const before=engine.update(state,.02);assert.ok(before.gear>=3);
 engine.update({...state,running:false},.02);
 const resumed=engine.update(state,.02);assert.equal(resumed.gear,before.gear);assert.equal(resumed.pitch,before.pitch);assert.equal(resumed.shifting,false);
 const coast=engine.update({...state,throttle:0},.02);assert.ok(coast.load>0&&coast.load<1);
 let settled;for(let i=0;i<50;i++)settled=engine.update({...state,throttle:0},.02);assert.ok(settled.load<1e-5);
 for(const speed of [NaN,Infinity,-Infinity])assert.ok(Number.isFinite(engine.update({...state,speed},Infinity).pitch));
});

test('normal, perfect and full-charge burst have distinct bounded timbres rather than a simple volume increase',()=>{
 const normal=nitroSoundFrame({active:true,age:1,speed:45});
 const perfect=nitroSoundFrame({active:true,age:1,speed:45,mode:'perfect'});
 const burst=nitroSoundFrame({active:true,age:1,speed:45,mode:'burst'});
 assert.ok(perfect.air<normal.air&&perfect.coreFrequency>normal.coreFrequency&&perfect.lowGain<normal.lowGain);
 assert.ok(burst.lowFrequency<normal.lowFrequency&&burst.lowGain>normal.lowGain);
 for(const mode of ['normal','perfect','burst'])for(const age of [0,.02,.1,.3,1,50])for(const speed of [0,35,100,Infinity]) {
  const frame=nitroSoundFrame({active:true,age,speed,mode});
  assert.ok(Object.values(frame).every(Number.isFinite));assert.ok(frame.lowGain<=.145&&frame.air<.065&&frame.coreGain<.055);
  assert.ok(frame.coreFrequency<300&&frame.lowFrequency>=44);
 }
 assert.deepEqual(nitroSoundFrame({mode:'unknown'}),nitroSoundFrame());
});


test('tyre feedback follows real slip with a smooth quiet transition, clears in air and never jumps on a drift flag',()=>{
 const motion=createTyreSoundMotion(),state={running:true,raceId:'tyres',speed:30,slipAngle:.08,drift:false};
 let frame;for(let i=0;i<60;i++)frame=motion.update(state,1/60);
 const straight=frame.gain;
 const flagOnly=motion.update({...state,drift:true},1/60);assert.ok(flagOnly.gain<.002);
 const onset=motion.update({...state,slipAngle:.4},1/60);assert.ok(onset.gain>straight&&onset.gain<.02);
 for(let i=0;i<90;i++)frame=motion.update({...state,slipAngle:.8},1/60);
 assert.ok(frame.gain<=.105&&frame.squealGain<=.0038);
 for(let i=0;i<40;i++)frame=motion.update({...state,slipAngle:.8,air:{phase:'airborne'}},1/60);
 assert.ok(frame.gain<1e-7,'airborne tyres do not sustain impossible road scrub');
 assert.equal(motion.update({...state,running:false},1/60).gain,0);
 for(const hz of [30,60,120]){
  const sampled=createTyreSoundMotion();let out;
  for(let i=0;i<hz;i++)out=sampled.update({...state,slipAngle:.3},1/hz);
  assert.ok(Number.isFinite(out.gain)&&out.gain>0&&out.gain<.105);
  if(hz===30)frame=out;else assert.ok(Math.abs(out.gain-frame.gain)<1e-10);
 }
});
