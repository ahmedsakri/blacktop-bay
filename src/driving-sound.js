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

export function nitroSoundFrame({active=false,age=0,speed=0,electric=false}={}) {
  const elapsed=Number.isFinite(age)?Math.max(0,age):0;
  const velocity=Number.isFinite(speed)?Math.max(0,Math.min(100,speed)):0;
  // A rounded ignition pulse opens into low turbine thrust. Most of the
  // earlier broadband hiss and 1 kHz whine are removed from the Nitro layer.
  const attack=Math.exp(-elapsed*10),open=1-Math.exp(-elapsed*48);
  return {air:active?.052*open:0,airCutoff:460+velocity*4.3,
    coreFrequency:155+velocity*.92+(electric?18:0),coreGain:active?.045*open:0,
    lowFrequency:51+velocity*.20+attack*26,
    lowGain:active?(electric?.090:.105)*open*(1+attack*.32):0,
    impact:active?attack*open*.11:0,
    release:active?0:.027,
  };
}
