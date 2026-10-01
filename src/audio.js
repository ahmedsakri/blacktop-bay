// Original, synthesized driving sound. Nothing is constructed or played before unlock().
// Levels deliberately sit below UI sounds; there are no samples or network requests.
import { getVehicle } from './vehicles.js';

const VOICES={
  gt:{gears:6,idle:52,range:88,body:.135,harmonic:.027,sub:.038,cutoff:1100},
  prototype:{gears:7,idle:76,range:126,body:.118,harmonic:.035,sub:.027,cutoff:1700},
  formula:{gears:8,idle:118,range:180,body:.096,harmonic:.047,sub:.015,cutoff:2650},
  electric:{gears:1,idle:95,range:530,body:.060,harmonic:.008,sub:.012,cutoff:2300},
};

export function createAudio() {
  const doc=globalThis.document;
  let context=null,master=null,engineGate=null,tyreGain=null,squealGain=null,boostGain=null;
  let engineFilter=null,tyreFilter=null,bodyOsc=null,harmonicOsc=null,subOsc=null,squealOsc=null,boostOsc=null;
  let bodyGain=null,harmonicGain=null,subGain=null;
  let unlockPromise=null,disposed=false,unlocked=false,muted=false,gear=0;
  let running=false,speed=0,drift=0,brake=0,vehicleId=null,shiftTime=0;
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
    target(master?.gain,audible?.24:0,.035);
    target(engineGate?.gain,audible && running?1:0,.070);
    if(!audible || !running) {
      target(tyreGain?.gain,0,.045);
      target(squealGain?.gain,0,.045);
      target(boostGain?.gain,0,.045);
    }
  }
  function makeOscillator(type,frequency,gain,destination) {
    const oscillator=node(context.createOscillator()),amplitude=node(context.createGain());
    oscillator.type=type;oscillator.frequency.value=frequency;amplitude.gain.value=gain;
    oscillator.connect(amplitude);amplitude.connect(destination);
    oscillator.start();sources.add(oscillator);return {oscillator,amplitude};
  }
  function constructGraph() {
    master=node(context.createGain());master.gain.value=0;master.connect(context.destination);
    engineGate=node(context.createGain());engineGate.gain.value=0;engineGate.connect(master);
    engineFilter=node(context.createBiquadFilter());engineFilter.type='lowpass';
    engineFilter.frequency.value=360;engineFilter.Q.value=.48;engineFilter.connect(engineGate);
    ({oscillator:bodyOsc,amplitude:bodyGain}=makeOscillator('triangle',52,.135,engineFilter));
    ({oscillator:harmonicOsc,amplitude:harmonicGain}=makeOscillator('sawtooth',104,.027,engineFilter));
    ({oscillator:subOsc,amplitude:subGain}=makeOscillator('sine',26,.038,engineFilter));

    // Slow, shallow detuning prevents a static electronic hum without a harsh buzz.
    const flutter=node(context.createOscillator()),flutterDepth=node(context.createGain());
    flutter.type='sine';flutter.frequency.value=11;flutterDepth.gain.value=.35;
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
    tyreFilter=node(context.createBiquadFilter());tyreFilter.type='bandpass';
    tyreFilter.frequency.value=850;tyreFilter.Q.value=.56;
    tyreGain=node(context.createGain());tyreGain.gain.value=0;
    noise.connect(tyreFilter);tyreFilter.connect(tyreGain);tyreGain.connect(engineGate);
    const boostFilter=node(context.createBiquadFilter());boostFilter.type='highpass';boostFilter.frequency.value=1700;
    boostGain=node(context.createGain());boostGain.gain.value=0;boostGain.connect(engineGate);
    noise.connect(boostFilter);boostFilter.connect(boostGain);
    // Boost layers filtered air and a quiet rising electrical whine over the engine.
    ({oscillator:boostOsc}=makeOscillator('sine',900,.065,boostGain));
    noise.start();sources.add(noise);
    squealGain=node(context.createGain());squealGain.gain.value=0;squealGain.connect(engineGate);
    squealOsc=node(context.createOscillator());squealOsc.type='sine';squealOsc.frequency.value=820;
    squealOsc.connect(squealGain);squealOsc.start();sources.add(squealOsc);
  }

  async function unlock() {
    if(disposed)return false;
    if(unlockPromise)return unlockPromise;
    unlockPromise=(async()=>{
      try {
        if(!context) {
          const AudioContext=globalThis.AudioContext || globalThis.webkitAudioContext;
          if(typeof AudioContext!=='function')return false;
          context=new AudioContext({latencyHint:'interactive'});
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
  function update(state={},dt=1/60) {
    if(disposed)return;
    speed=clamp(Math.abs(finite(state.speed)),0,100);
    drift=clamp(Math.abs(finite(state.drift)),0,1);
    brake=clamp(finite(state.brake),0,1);
    running=Boolean(state.running);
    const vehicle=getVehicle(state.vehicle),electric=vehicle.powertrain==='electric',voice=VOICES[electric?'electric':vehicle.family]||VOICES.gt;
    if(vehicleId!==vehicle.id || !running){gear=0;shiftTime=0;vehicleId=vehicle.id;}
    if(!context || !unlocked || context.state!=='running')return;
    updateGates();
    if(!running || muted || !visible())return;
    bodyOsc.type=electric?'sine':'triangle';
    harmonicOsc.type=electric?'sine':'sawtooth';

    // Distinct six/seven/eight-speed voices follow road speed, with a brief torque
    // cut and rev drop at shifts. Hysteresis prevents chatter at a shift boundary.
    const step=clamp(finite(dt,1/60),0,.1),topSpeed=vehicle.handling.topSpeed;
    const threshold=index=>voice.gears===1?topSpeed:topSpeed*(.20+.78*index/(voice.gears-1));
    const oldGear=gear;
    if(gear<voice.gears-1 && speed>threshold(gear)+.5)gear++;
    else if(gear>0 && speed<threshold(gear-1)-1.5)gear--;
    if(gear!==oldGear)shiftTime=.105;
    else shiftTime=Math.max(0,shiftTime-step);
    const lower=gear?threshold(gear-1)*.66:0,upper=threshold(gear);
    const rev=clamp((speed-lower)/(upper-lower),0,1.10);
    const throttle=clamp(finite(state.throttle,1),0,1);
    const boost=Boolean(state.nitro)&&throttle>.1&&brake<.1;
    const cut=1-.26*shiftTime/.105;
    const pitch=voice.idle+rev*voice.range+drift*voice.range*.06+(boost?6:0);
    const smooth=clamp(step*3,.035,.12);
    target(bodyOsc.frequency,pitch,smooth);
    target(harmonicOsc.frequency,pitch*(vehicle.family==='formula'?3.003:2.006),smooth);
    target(subOsc.frequency,pitch*.5,smooth);
    target(bodyGain.gain,voice.body*(.52+throttle*.48)*cut,.035);
    target(harmonicGain.gain,voice.harmonic*(.35+throttle*.65)*cut,.035);
    target(subGain.gain,voice.sub*(.72+throttle*.28),.07);
    target(engineFilter.frequency,300+voice.cutoff*(.22+rev*.78)*(.48+throttle*.52)+(boost?300:0),.075);
    target(boostGain.gain,boost?.17:0,boost?.045:.10);
    target(boostOsc.frequency,880+speed*12+(boost?180:0),.12);
    const moving=clamp((speed-3)/12,0,1);
    const scrub=Math.max(drift,brake*.22)*moving;
    target(tyreGain.gain,Math.pow(scrub,1.35)*.16,.060);
    target(tyreFilter.frequency,720+scrub*570+Math.min(speed,60)*4,.12);
    target(squealGain.gain,Math.pow(scrub,2.8)*.015,.10);
    target(squealOsc.frequency,780+scrub*190+Math.min(speed,60)*1.4,.16);
  }
  function beep(frequency=440,duration=.1) {
    if(disposed || !unlocked || muted || !visible() || context?.state!=='running')return;
    try {
      const oscillator=context.createOscillator(),gain=context.createGain();
      const start=context.currentTime,length=clamp(finite(duration,.1),.035,.8);
      oscillator.type='sine';oscillator.frequency.setValueAtTime(clamp(finite(frequency,440),140,1800),start);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.11,start+.007);
      gain.gain.exponentialRampToValueAtTime(.0001,start+length);
      oscillator.connect(gain);gain.connect(master);
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
  return {unlock,setMuted,update,beep,dispose};
}
