import test from 'node:test';
import assert from 'node:assert/strict';
import {drivingVoice,nitroSoundFrame} from '../src/driving-sound.js';
import {VEHICLES} from '../src/vehicles.js';

test('boost opens gently into low turbine thrust with restrained air and a short release',()=>{
 const silent=nitroSoundFrame({active:true,age:0,speed:35});
 const onset=nitroSoundFrame({active:true,age:.05,speed:35});
 const sustain=nitroSoundFrame({active:true,age:1,speed:35});
 const off=nitroSoundFrame({active:false,speed:35});
 assert.ok(onset.impact>sustain.impact*1000&&onset.lowGain>sustain.lowGain);
 assert.equal(silent.impact,0);assert.equal(silent.lowGain,0);assert.ok(onset.air<sustain.air);
 assert.ok(sustain.air<.06&&sustain.coreFrequency<300&&sustain.coreGain>0);
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
  assert.ok(sound.airCutoff>=460&&sound.airCutoff<=890);
  assert.ok(sound.coreFrequency>=155&&sound.coreFrequency<=265);
  assert.ok(sound.lowFrequency>=51&&sound.lowFrequency<=97);
  if(active)assert.equal(sound.release,0);
  else {assert.equal(sound.air,0);assert.equal(sound.impact,0);assert.equal(sound.lowGain,0);}
 }
});
