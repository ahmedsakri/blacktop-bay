// Original, synthesized driving sound. Nothing is constructed or played before unlock().
// Separate music/driving buses and a soft compressor keep the louder mix controlled.
import { getVehicle } from './vehicles.js';

import { drivingVoice, nitroSoundFrame, createEngineSoundMotion, createTyreSoundMotion, engineSpectrum } from './driving-sound.js';
import { lobbyMusicFrame, normalizeLobbyStyle } from './lobby-music.js';
import {createRaceSoundscape,createSoundEventTracker} from './race-sound.js';

export function createAudio({contextFactory} = {}) {
  const doc=globalThis.document;
  let context=null,master=null,engineGate=null,tyreGain=null,squealGain=null,boostGain=null;
  let sfxMix=null,sfxRaceGate=null,soundscape=null;
  const soundEvents=createSoundEventTracker();
  const engineMotion=createEngineSoundMotion(),tyreMotion=createTyreSoundMotion();
  let engineFilter=null,tyreFilter=null,bodyOsc=null,harmonicOsc=null,subOsc=null,squealOsc=null,boostOsc=null;
  let bodyGain=null,harmonicGain=null,subGain=null;
  let intakeGain=null,intakeFilter=null,engineWaves=null,waveApplied=null;
  let boostFilter=null,boostLowOsc=null,boostLowGain=null,boostImpactGain=null,boostReleaseGain=null,boostToneGain=null;
  let boostAge=0,boostWasActive=false,boostRelease=0,boostMode='normal';
  let lobby=false,lobbyClock=0,lobbyGate=null,lobbyFilter=null,lobbyBass=null,lobbyPulse=null,lobbyTick=null;
  const lobbyPads=[];
  let lobbyStyle=normalizeLobbyStyle(),lobbyTransition=1,lobbyKick=null,lobbyLead=null,lobbySnareBody=null,lobbySnare=null,lobbySpace=null,lobbyEcho=null;
  let unlockPromise=null,disposed=false,unlocked=false,muted=false;
  let running=false,speed=0,drift=0,brake=0,volume=.75,musicVolume=.65;
  let engineVolume=1,sfxVolume=.85;
  const sources=new Set(),transients=new Set(),nodes=new Set();
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const visible=()=>!doc?.hidden;
  const node=value=>{nodes.add(value);return value;};

  function target(parameter,value,seconds=.065) {
    if(!parameter || !context || context.state==='closed')return;
    try { parameter.setTargetAtTime(value,context.currentTime,seconds); } catch { /* Closing audio may race with a frame. */ }
  }
  function updateGates() {
    const audible=unlocked && !muted && visible() && !disposed;
    target(master?.gain,audible?volume*1.6:0,.035);
    target(engineGate?.gain,audible && running?engineVolume:0,.070);
    target(sfxMix?.gain,audible?sfxVolume:0,.035);
    target(sfxRaceGate?.gain,audible && running?1:0,.045);
    target(lobbyGate?.gain,audible && lobby && !running?musicVolume*lobbyTransition:0,.28);
    if(!audible || !running) {
      target(tyreGain?.gain,0,.045);
      target(squealGain?.gain,0,.045);
      target(boostGain?.gain,0,.045);
      target(boostToneGain?.gain,0,.045);target(boostLowGain?.gain,0,.045);target(boostImpactGain?.gain,0,.045);target(boostReleaseGain?.gain,0,.035);
      boostWasActive=false;boostAge=0;boostRelease=0;boostMode='normal';
      soundscape?.silence();
    }
  }
  function makeOscillator(type,frequency,gain,destination) {
    const oscillator=node(context.createOscillator()),amplitude=node(context.createGain());
    oscillator.type=type;oscillator.frequency.value=frequency;amplitude.gain.value=gain;
    oscillator.connect(amplitude);amplitude.connect(destination);
    oscillator.start();sources.add(oscillator);return {oscillator,amplitude};
  }
  function constructGraph() {
    master=node(context.createGain());master.gain.value=0;
    if(context.createDynamicsCompressor){const limiter=node(context.createDynamicsCompressor());limiter.threshold.value=-10;limiter.knee.value=12;limiter.ratio.value=4;limiter.attack.value=.003;limiter.release.value=.18;master.connect(limiter);limiter.connect(context.destination);}else master.connect(context.destination);
    engineGate=node(context.createGain());engineGate.gain.value=0;engineGate.connect(master);
    sfxMix=node(context.createGain());sfxMix.gain.value=0;sfxMix.connect(master);
    sfxRaceGate=node(context.createGain());sfxRaceGate.gain.value=0;sfxRaceGate.connect(sfxMix);
    engineFilter=node(context.createBiquadFilter());engineFilter.type='lowpass';
    engineFilter.frequency.value=360;engineFilter.Q.value=.48;engineFilter.connect(engineGate);
    ({oscillator:bodyOsc,amplitude:bodyGain}=makeOscillator('triangle',52,.135,engineFilter));
    ({oscillator:harmonicOsc,amplitude:harmonicGain}=makeOscillator('sawtooth',104,.027,engineFilter));
    ({oscillator:subOsc,amplitude:subGain}=makeOscillator('sine',26,.038,engineFilter));
    if(context.createPeriodicWave){
      engineWaves=[false,true].map(overtone=>{const spectrum=engineSpectrum(overtone);return context.createPeriodicWave(spectrum.real,spectrum.imag);});
    }

    // Slow, shallow detuning prevents a static electronic hum without a harsh buzz.
    const flutter=node(context.createOscillator()),flutterDepth=node(context.createGain());
    flutter.type='sine';flutter.frequency.value=8.3;flutterDepth.gain.value=.16;
    flutter.connect(flutterDepth);flutterDepth.connect(bodyOsc.frequency);
    flutter.start();sources.add(flutter);

    const noise=node(context.createBufferSource());
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*2),context.sampleRate);
    const samples=buffer.getChannelData(0);
    let low=0;
    for(let i=0;i<samples.length;i++) {
      const white=Math.random()*2-1;
      low=.91*low+.09*white;samples[i]=white*.36+low*.72;
    }
    noise.buffer=buffer;noise.loop=true;
    intakeFilter=node(context.createBiquadFilter());intakeFilter.type='bandpass';intakeFilter.frequency.value=430;intakeFilter.Q.value=.42;
    intakeGain=node(context.createGain());intakeGain.gain.value=0;
    noise.connect(intakeFilter);intakeFilter.connect(intakeGain);intakeGain.connect(engineGate);
    tyreFilter=node(context.createBiquadFilter());tyreFilter.type='bandpass';
    tyreFilter.frequency.value=850;tyreFilter.Q.value=.56;
    tyreGain=node(context.createGain());tyreGain.gain.value=0;
    noise.connect(tyreFilter);tyreFilter.connect(tyreGain);tyreGain.connect(sfxRaceGate);
    boostFilter=node(context.createBiquadFilter());boostFilter.type='lowpass';boostFilter.frequency.value=430;boostFilter.Q.value=.35;
    boostGain=node(context.createGain());boostGain.gain.value=0;boostGain.connect(sfxRaceGate);
    noise.connect(boostFilter);boostFilter.connect(boostGain);
    // Warm turbine harmonics have their own gain; they do not need a loud
    // noise bus or a piercing electrical whine to remain audible.
    ({oscillator:boostOsc,amplitude:boostToneGain}=makeOscillator('sine',105,0,sfxRaceGate));
    // Low thrust and a short pressure onset give boost weight without raising
    // the whole mix. All layers share the race SFX gate so pause/mute are immediate.
    ({oscillator:boostLowOsc,amplitude:boostLowGain}=makeOscillator('sine',52,0,sfxRaceGate));
    const impactFilter=node(context.createBiquadFilter());impactFilter.type='lowpass';impactFilter.frequency.value=210;
    boostImpactGain=node(context.createGain());boostImpactGain.gain.value=0;
    noise.connect(impactFilter);impactFilter.connect(boostImpactGain);boostImpactGain.connect(sfxRaceGate);
    const releaseFilter=node(context.createBiquadFilter());releaseFilter.type='lowpass';releaseFilter.frequency.value=360;releaseFilter.Q.value=.4;
    boostReleaseGain=node(context.createGain());boostReleaseGain.gain.value=0;
    noise.connect(releaseFilter);releaseFilter.connect(boostReleaseGain);boostReleaseGain.connect(sfxRaceGate);
    noise.start();sources.add(noise);
    squealGain=node(context.createGain());squealGain.gain.value=0;squealGain.connect(sfxRaceGate);
    squealOsc=node(context.createOscillator());squealOsc.type='sine';squealOsc.frequency.value=820;
    squealOsc.connect(squealGain);squealOsc.start();sources.add(squealOsc);

    // Liquid Lines uses a separate bus: music eases out before the race,
    // leaving engines readable.
    lobbyGate=node(context.createGain());lobbyGate.gain.value=0;lobbyGate.connect(master);
    lobbyFilter=node(context.createBiquadFilter());lobbyFilter.type='lowpass';lobbyFilter.frequency.value=1050;lobbyFilter.Q.value=.42;lobbyFilter.connect(lobbyGate);
    for(let i=0;i<4;i++)lobbyPads.push(makeOscillator(i===0?'sine':'triangle',220+i*30,0,lobbyFilter));
    lobbyBass=makeOscillator('sine',73.42,0,lobbyGate);
    lobbyPulse=makeOscillator('sine',440,0,lobbyFilter);
    const tickFilter=node(context.createBiquadFilter());tickFilter.type='highpass';tickFilter.frequency.value=3600;
    lobbyTick=node(context.createGain());lobbyTick.gain.value=0;noise.connect(tickFilter);tickFilter.connect(lobbyTick);lobbyTick.connect(lobbyGate);
    lobbyKick=makeOscillator('sine',55,0,lobbyGate);
    lobbyLead=makeOscillator('sine',440,0,lobbyFilter);
    lobbySnareBody=makeOscillator('triangle',185,0,lobbyGate);
    const snareFilter=node(context.createBiquadFilter());snareFilter.type='bandpass';snareFilter.frequency.value=1700;snareFilter.Q.value=.58;
    lobbySnare=node(context.createGain());lobbySnare.gain.value=0;noise.connect(snareFilter);snareFilter.connect(lobbySnare);lobbySnare.connect(lobbyGate);
    // Original room impulse and filtered echo add depth, not unlicensed samples.
    // These optional standard Web Audio nodes use one bounded music graph.
    if(context.createConvolver){
      const room=node(context.createConvolver()),impulse=context.createBuffer(2,Math.round(context.sampleRate*1.35),context.sampleRate);
      for(let channel=0;channel<2;channel++){
        const samples=impulse.getChannelData(channel);let seed=channel+137;
        for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/context.sampleRate;samples[i]=(seed/4294967296*2-1)*Math.exp(-t*5.5)*Math.min(1,t*90)*.22;}
      }
      room.buffer=impulse;lobbySpace=node(context.createGain());lobbySpace.gain.value=0;
      lobbyFilter.connect(room);room.connect(lobbySpace);lobbySpace.connect(lobbyGate);
    }
    if(context.createDelay){
      const echo=node(context.createDelay(1)),feedback=node(context.createGain()),echoFilter=node(context.createBiquadFilter());
      echo.delayTime.value=.29;feedback.gain.value=.28;echoFilter.type='lowpass';echoFilter.frequency.value=1800;
      lobbyEcho=node(context.createGain());lobbyEcho.gain.value=0;
      lobbyPulse.amplitude.connect(echo);lobbyLead.amplitude.connect(echo);echo.connect(echoFilter);echoFilter.connect(feedback);feedback.connect(echo);echoFilter.connect(lobbyEcho);lobbyEcho.connect(lobbyGate);
    }
    soundscape=createRaceSoundscape({context,noise,engineDestination:engineGate,sfxDestination:sfxRaceGate,node,makeOscillator,target});
  }

  async function unlock() {
    if(disposed)return false;
    if(unlockPromise)return unlockPromise;
    unlockPromise=(async()=>{
      try {
        if(!context) {
          const AudioContext=globalThis.AudioContext || globalThis.webkitAudioContext;
          if(typeof contextFactory!=='function' && typeof AudioContext!=='function')return false;
          context=typeof contextFactory==='function'?contextFactory():new AudioContext({latencyHint:'interactive'});
          constructGraph();
        }
        if(disposed || context.state==='closed')return false;
        if(context.state!=='running')await context.resume();
        if(disposed)return false;
        unlocked=context.state==='running';
        updateGates();return unlocked;
      } catch {
        unlocked=false;updateGates();return false;
      }
    })();
    try { return await unlockPromise; } finally { unlockPromise=null; }
  }
  function setMuted(value) {
    muted=Boolean(value);updateGates();
  }
  function setVolume(value){volume=clamp(finite(value,.75),0,1);updateGates();}
  function setMusicVolume(value){musicVolume=clamp(finite(value,.65),0,1);updateGates();}
  function setEngineVolume(value){engineVolume=clamp(finite(value,1),0,1);updateGates();}
  function setSfxVolume(value){sfxVolume=clamp(finite(value,.85),0,1);updateGates();}
  function setLobbyStyle(value){
    const next=normalizeLobbyStyle(value);if(next===lobbyStyle)return lobbyStyle;
    lobbyStyle=next;lobbyClock=0;lobbyTransition=0;updateGates();return lobbyStyle;
  }
  function update(state={},dt=1/60) {
    if(disposed)return;
    speed=clamp(Math.abs(finite(state.speed)),0,100);
    drift=clamp(Math.abs(finite(state.drift)),0,1);
    brake=clamp(finite(state.brake),0,1);
    running=Boolean(state.running);
    lobby=state.lobby===true&&!running;
    const pending=soundEvents.consume(state);
    const vehicle=getVehicle(state.vehicle),voice=drivingVoice(vehicle),electric=voice.electric;
    const step=clamp(finite(dt,1/60),0,.1),throttle=clamp(finite(state.throttle,1),0,1);
    const motion=engineMotion.update({running,voice,speed,topSpeed:finite(state.topSpeed,vehicle.handling.topSpeed),vehicleId:vehicle.id,raceId:state.raceId,throttle,brake,drift},step);
    const tyres=tyreMotion.update({...state,running,speed,drift,brake},step);
    if(!context || !unlocked || context.state!=='running')return;
    updateGates();
    if(muted || !visible())return;
    if(lobby)updateLobby(clamp(finite(dt,1/60),0,.1));
    if(!running)return;
    if(waveApplied!==electric){
      if(!electric&&engineWaves){bodyOsc.setPeriodicWave(engineWaves[0]);harmonicOsc.setPeriodicWave(engineWaves[1]);}
      else {bodyOsc.type=electric?'sine':'triangle';harmonicOsc.type=electric?'sine':'triangle';}
      waveApplied=electric;
    }
    // Smooth pressure/load and rev changes rather than exposing oscillator
    // frequency jumps or a continuously bright sawtooth at every gear change.
    const boost=Boolean(state.nitro)&&throttle>.1&&brake<.1;
    const {pitch,rev,load,torque}=motion;
    target(bodyOsc.frequency,pitch,.028);
    target(harmonicOsc.frequency,pitch*(vehicle.family==='formula'?3.002:2.003),.035);
    target(subOsc.frequency,Math.max(32,pitch*.5),.045);
    target(bodyGain.gain,voice.body*(.48+load*.52)*torque,.045);
    target(harmonicGain.gain,voice.harmonic*(.16+load*.44)*torque,.055);
    target(subGain.gain,voice.sub*(.68+load*.32),.08);
    target(engineFilter.frequency,280+voice.cutoff*(.22+rev*.65)*(.52+load*.48)+(boost?80:0),.10);
    target(intakeGain.gain,electric?0:(.002+rev*.010)*load*torque,.075);
    target(intakeFilter.frequency,300+rev*370,.12);
    const nextBoostMode=['perfect','burst'].includes(state.nitroMode)?state.nitroMode:'normal';
    if(boost&&!boostWasActive){boostAge=0;boostRelease=0;}
    if(boost)boostMode=nextBoostMode;
    if(!boost&&boostWasActive)boostRelease=clamp(boostAge/.18,0,1);
    if(boost)boostAge+=step;
    else boostRelease*=Math.exp(-step*13);
    const thrust=nitroSoundFrame({active:boost,age:boostAge,speed,electric,mode:boostMode});
    target(boostGain.gain,thrust.air,boost?.055:.065);
    target(boostFilter.frequency,thrust.airCutoff,.10);
    target(boostOsc.frequency,thrust.coreFrequency,.22);
    target(boostToneGain.gain,thrust.coreGain,boost?.080:.080);
    target(boostLowOsc.frequency,thrust.lowFrequency,.055);
    target(boostLowGain.gain,thrust.lowGain,boost?.038:.09);
    target(boostImpactGain.gain,thrust.impact,.029);
    target(boostReleaseGain.gain,thrust.release*boostRelease,.024);
    boostWasActive=boost;
    target(tyreGain.gain,tyres.gain,.040);
    target(tyreFilter.frequency,tyres.cutoff,.10);
    target(squealGain.gain,tyres.squealGain,.09);
    target(squealOsc.frequency,tyres.squealFrequency,.14);
    soundscape.update({...state,speed},step,pending);
  }
  function updateLobby(dt) {
    lobbyClock+=dt;lobbyTransition=Math.min(1,lobbyTransition+dt*2.5);
    const frame=lobbyMusicFrame(lobbyStyle,lobbyClock);
    for(let i=0;i<lobbyPads.length;i++){
      lobbyPads[i].oscillator.type=i===0?'sine':frame.padWave;
      target(lobbyPads[i].oscillator.frequency,frame.padNotes[i]*(i%2?1.001:1),frame.padSmoothing);
      target(lobbyPads[i].amplitude.gain,frame.padGains[i],.09);
    }
    target(lobbyBass.oscillator.frequency,frame.bassFrequency,.025);target(lobbyBass.amplitude.gain,frame.bassGain,.012);
    lobbyPulse.oscillator.type=frame.pulseWave;target(lobbyPulse.oscillator.frequency,frame.pulseFrequency,.010);target(lobbyPulse.amplitude.gain,frame.pulseGain,.010);
    target(lobbyKick.oscillator.frequency,frame.kickFrequency,.009);target(lobbyKick.amplitude.gain,frame.kickGain,.009);
    lobbyLead.oscillator.type=frame.leadWave;target(lobbyLead.oscillator.frequency,frame.leadFrequency,.035);target(lobbyLead.amplitude.gain,frame.leadGain,.035);
    target(lobbySnare.gain,frame.snareGain,.008);target(lobbySnareBody.amplitude.gain,frame.snareBodyGain,.009);
    target(lobbyTick.gain,frame.hatGain,.008);target(lobbyFilter.frequency,frame.padCutoff,.2);
    target(lobbySpace?.gain,frame.space,.2);target(lobbyEcho?.gain,frame.echo,.2);
  }
  function beep(frequency=440,duration=.1) {
    if(disposed || !unlocked || muted || !visible() || context?.state!=='running' || transients.size>=8)return;
    try {
      const oscillator=context.createOscillator(),gain=context.createGain();
      const start=context.currentTime,length=clamp(finite(duration,.1),.035,.8);
      oscillator.type='sine';oscillator.frequency.setValueAtTime(clamp(finite(frequency,440),140,1800),start);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.11,start+.007);
      gain.gain.exponentialRampToValueAtTime(.0001,start+length);
      oscillator.connect(gain);gain.connect(sfxMix);
      transients.add(oscillator);
      oscillator.onended=()=>{transients.delete(oscillator);oscillator.disconnect();gain.disconnect();};
      oscillator.start(start);oscillator.stop(start+length+.025);
    } catch { /* Audio is optional; a state change must never interrupt the game. */ }
  }
  function dispose() {
    if(disposed)return;disposed=true;unlocked=false;
    doc?.removeEventListener?.('visibilitychange',updateGates);
    for(const source of [...sources,...transients]) {
      try { source.stop();source.disconnect(); } catch { /* Already-ended sources are harmless. */ }
    }
    for(const item of nodes)try { item.disconnect(); } catch { /* Partial construction can be disposed safely. */ }
    sources.clear();transients.clear();nodes.clear();
    try { const closing=context?.close();closing?.catch?.(()=>{}); } catch { /* Closing twice is safe for callers. */ }
    context=null;master=null;
  }
  doc?.addEventListener?.('visibilitychange',updateGates);
  return {unlock,setMuted,setVolume,setMusicVolume,setEngineVolume,setSfxVolume,setLobbyStyle,update,beep,dispose};
}
