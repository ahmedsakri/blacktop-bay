// Original synthesis profiles: deliberately characterful, never advertised as
// recordings of a manufacturer's actual engine. No runtime assets or requests.
const voices = Object.freeze({
  gt: {gears:6,idle:52,range:88,body:.125,harmonic:.027,sub:.038,cutoff:1100},
  prototype: {gears:7,idle:76,range:126,body:.108,harmonic:.035,sub:.027,cutoff:1700},
  formula: {gears:8,idle:118,range:180,body:.086,harmonic:.044,sub:.015,cutoff:2650},
  electric: {gears:1,idle:95,range:530,body:.056,harmonic:.008,sub:.012,cutoff:2300},
});
const characters = Object.freeze({
  Ferrari: {pitch:1.16,harmonic:1.16,body:.91,brightness:1.18},
  Lamborghini: {pitch:1.08,harmonic:1.23,body:1.02,brightness:1.10},
  McLaren: {pitch:.96,harmonic:.94,body:1.05,brightness:.95},
  Porsche: {pitch:.87,harmonic:1.02,body:1.07,brightness:.93},
  BMW: {pitch:.94,harmonic:.83,body:1.04,brightness:.88},
  Audi: {pitch:1.04,harmonic:1.12,body:.97,brightness:1.03},
  'Mercedes-Benz': {pitch:.79,harmonic:.92,body:1.12,brightness:.88},
  Bugatti: {pitch:.78,harmonic:.78,body:1.14,brightness:.85},
  'Gordon Murray Automotive': {pitch:1.23,harmonic:1.19,body:.91,brightness:1.20},
});
// Individual game mixes: pitch, rev sweep, exhaust weight and brightness.
// These are authored synthesis settings, not claimed OEM recordings or RPM data.
const modelMixes = Object.freeze({
 'mclaren-570s':[.98,.94,1.02,.96], 'mclaren-senna':[1.05,1.12,.96,1.12], 'mclaren-p1-gtr':[1.02,1.08,1.08,1.06],
 'mclaren-650s-gt3':[.95,1.14,1.12,1.15], 'ferrari-458-italia':[1.09,1.08,.91,1.10], 'ferrari-enzo':[.95,1.10,1.03,1.15],
 'ferrari-250-gto':[.90,.85,1.10,.86], 'ferrari-testarossa':[.88,.94,1.14,.91],
 'lamborghini-aventador':[.94,1.10,1.14,1.04], 'lamborghini-gallardo':[1.03,.98,.96,1.06], 'lamborghini-huracan':[1.09,1.07,1.01,1.14], 'lamborghini-countach-lp500s':[.91,.90,1.09,.95],
 'porsche-930-turbo':[.91,.90,1.05,.84], 'porsche-911-gt3':[1.07,1.13,.98,1.12], 'porsche-919-hybrid':[1.16,1.20,.93,1.16],
 'audi-r8':[.98,.94,1.03,1.02], 'audi-r8-lms-gt3':[1.07,1.15,1.08,1.17], 'audi-r18':[.68,.80,1.18,.73], 'audi-quattro-rally':[.92,1.03,1.15,.96],
 'bmw-i8':[1.04,.90,.88,.93], 'bmw-f22-eurofighter':[.90,1.14,1.16,1.14], 'bmw-m3-e46':[1.08,1.04,1.03,1.10],
 'koenigsegg-one-1':[.90,1.22,1.12,1.08], 'pagani-zonda-c12':[1.16,1.12,1.05,1.21], 'bugatti-veyron':[.85,.92,1.18,.82],
 'maserati-mc-stradale':[1.03,1.08,1.06,1.13], 'lotus-elise':[1.17,.98,.85,1.08], 'aston-martin-one-77':[.90,1.07,1.17,.97],
 'gma-t50':[1.10,1.21,.92,1.20], 'mercedes-amg-gt':[.88,.94,1.20,.87], 'nissan-gt-r-2018':[.97,1.04,1.13,1.04],
 'rimac-concept-one':[.91,.92,1.12,.93], 'rimac-nevera':[1.08,1.12,.94,1.10],
});
export function drivingVoice(vehicle = {}) {
  const electric=vehicle.powertrain==='electric';
  const endurance=vehicle.id==='audi-r18'||vehicle.id==='porsche-919-hybrid';
  const voice=voices[electric?'electric':endurance?'prototype':vehicle.family]||voices.gt;
  const character=electric?null:characters[vehicle.brand];
  const [pitch,sweep,weight,brightness]=modelMixes[vehicle.id]||[1,1,1,1];
  return {...voice,idle:voice.idle*(character?.pitch||1)*pitch,range:voice.range*(character?.pitch||1)*sweep,
    harmonic:voice.harmonic*(character?.harmonic||1),body:voice.body*(character?.body||1)*weight,
    cutoff:voice.cutoff*(character?.brightness||1)*brightness,electric};
}

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

// A rounded exhaust pulse has finite harmonics instead of the full sawtooth
// spectrum. The overtone is quieter and rolls off faster than the main body.
export function engineSpectrum(overtone=false) {
 const coefficients=overtone?[0,1,.23,.07,.018,.006]:[0,1,.48,.22,.105,.049,.021,.009,.003];
 return {real:new Float32Array(coefficients.length),imag:Float32Array.from(coefficients)};
}

export function createEngineSoundMotion() {
 let gear=0,shift=0,load=0,rev=0,pitch=0,identity=null,wasRunning=false;
 return {update(state={},dt=1/60){
  const voice=state.voice||drivingVoice(),speed=clamp(number(state.speed),0,100),top=Math.max(10,number(state.topSpeed,55));
  const step=clamp(number(dt,1/60),0,.1),running=Boolean(state.running),key=`${state.vehicleId||''}:${state.raceId||''}`;
  const threshold=index=>voice.gears===1?top:top*(.20+.78*index/(voice.gears-1));
  const throttle=clamp(number(state.throttle,1),0,1),brake=clamp(number(state.brake),0,1);
  const reseed=key!==identity||(running&&!wasRunning);
  if(reseed){
   gear=0;while(gear<voice.gears-1&&speed>threshold(gear)+.5)gear++;
   load=throttle*(1-brake);shift=0;identity=key;
  }
  const previous=gear;
  if(running&&!reseed){
   if(gear<voice.gears-1&&speed>threshold(gear)+.5)gear++;
   else if(gear>0&&speed<threshold(gear-1)-1.5)gear--;
  }
  if(gear!==previous)shift=.16;else shift=Math.max(0,shift-step);
  const lower=gear?threshold(gear-1)*.66:0,upper=threshold(gear);
  const rawRev=clamp((speed-lower)/(upper-lower),0,1.08);
  const rawPitch=voice.idle+rawRev*voice.range+clamp(number(state.drift),0,1)*voice.range*.025;
  if(reseed){rev=rawRev;pitch=rawPitch;}
  else {
   rev+=(rawRev-rev)*(1-Math.exp(-step/ .10));
   pitch+=(rawPitch-pitch)*(1-Math.exp(-step/(shift>0?.082:.10)));
   load+=(throttle*(1-brake)-load)*(1-Math.exp(-step/(throttle>load?.09:.065)));
  }
  wasRunning=running;
  // Torque opens and closes smoothly around a shift; avoid an amplitude step.
  const torque=1-.18*Math.sin(Math.PI*shift/.16);
  return {gear,pitch,rev,load,torque,shifting:shift>0};
 }};
}

export function nitroSoundFrame({active=false,age=0,speed=0,electric=false,mode='normal'}={}) {
  const elapsed=Number.isFinite(age)?Math.max(0,age):0;
  const velocity=Number.isFinite(speed)?Math.max(0,Math.min(100,speed)):0;
  // Breath-like pressure onset decays into a soft, low thrust bed. A quieter
  // sine core supplies weight without a sustained triangle-wave siren.
  const attack=Math.exp(-elapsed*8),open=1-Math.exp(-elapsed*30);
  // Perfect timing is a cleaner, higher turbine interval. Full-charge burst
  // has a deeper pressure body. Modes change timbre, not just overall loudness.
  const perfect=mode==='perfect',burst=mode==='burst';
  return {air:active?(.022+attack*.038)*open*(perfect?.78:burst?1.10:1):0,airCutoff:340+velocity*2.2+(perfect?55:0),
    coreFrequency:105+velocity*.24+(electric?9:0)+(perfect?12:burst?-6:0),coreGain:active?.012*open*(perfect?1.08:1):0,
    lowFrequency:48+velocity*.08+attack*8-(burst?4:0),
    lowGain:active?(electric?.061:.068)*open*(1+attack*.40)*(burst?1.14:perfect?.94:1):0,
    impact:active?attack*open*.066*(burst?1.10:perfect?.85:1):0,
    release:active?0:.021*(burst?1.10:1),
  };
}


// Continuous tyre load avoids a full-volume switch at the visual drift flag.
// The envelope is independent of render cadence and uses no extra audio nodes.
export function createTyreSoundMotion() {
 let scrub = 0, identity;
 return {update(state = {}, dt = 1 / 60) {
  const key = `${state.vehicle || ''}:${state.raceId || ''}`;
  if (key !== identity || !state.running) {scrub = 0; identity = key;}
  const step = clamp(number(dt, 1 / 60), 0, .1), speed = clamp(number(state.speed), 0, 100);
  const grounded = state.air?.phase !== 'airborne';
  const slip = Number.isFinite(state.slipAngle) ? clamp((Math.abs(state.slipAngle) - .045) / .40, 0, 1) : clamp(number(state.drift), 0, 1);
  const tyreLoad = slip * slip * (3 - 2 * slip);
  const desired = state.running && grounded ? Math.max(tyreLoad, clamp(number(state.brake), 0, 1) * .22) * clamp((speed - 3) / 12, 0, 1) : 0;
  scrub += (desired - scrub) * (1 - Math.exp(-step / (desired > scrub ? .095 : .055)));
  return {scrub, gain: scrub ** 1.35 * .105, cutoff: 680 + scrub * 480 + Math.min(speed, 60) * 3.5,
    squealGain: scrub ** 2.8 * .0038, squealFrequency: 760 + scrub * 160 + Math.min(speed, 60) * 1.2};
 }};
}

// Coherent extra layers use the same smoothed load/revs and shift torque as the
// core engine. Authored texture, not measured engine orders or manufacturer RPM.
export function engineDetailFrame({voice = drivingVoice(), motion = {}, vehicle = {}, speed = 0} = {}) {
 const rev=clamp(number(motion.rev),0,1.1),load=clamp(number(motion.load),0,1),torque=clamp(number(motion.torque,1),0,1);
 const pitch=Math.max(20,number(motion.pitch,voice.idle));
 const electric=voice.electric, induction=vehicle.powertrain==='hybrid'||/turbo/i.test(`${vehicle.name||''} ${vehicle.specs?.body||''}`);
 return {exhaustFrequency:Math.max(28,pitch*(vehicle.family==='formula'?1.5:.75)),
  exhaustGain:electric?0:Math.min(.017,voice.body*.10)*( .15+load*.85)*torque*(.5+rev*.5),
  turbineFrequency:electric?pitch*1.503:180+rev*310+Math.min(100,Math.max(0,number(speed)))*1.2,
  turbineGain:electric?.0035*load*rev:induction?.0045*load*load*rev*torque:.0018*load*rev*torque};
}
