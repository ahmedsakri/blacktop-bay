// Original, synthesized driving sound. Nothing is constructed or played before unlock().
// Levels deliberately sit below UI sounds; there are no samples or network requests.
export function createAudio() {
  const doc=globalThis.document;
  let context=null,master=null,engineGate=null,tyreGain=null,squealGain=null;
  let engineFilter=null,tyreFilter=null,bodyOsc=null,harmonicOsc=null,subOsc=null,squealOsc=null;
  let unlockPromise=null,disposed=false,unlocked=false,muted=false,gear=0;
  let running=false,speed=0,drift=0,brake=0;
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
    }
  }
  function makeOscillator(type,frequency,gain,destination) {
    const oscillator=node(context.createOscillator()),amplitude=node(context.createGain());
    oscillator.type=type;oscillator.frequency.value=frequency;amplitude.gain.value=gain;
    oscillator.connect(amplitude);amplitude.connect(destination);
    oscillator.start();sources.add(oscillator);return oscillator;
  }
  function constructGraph() {
    master=node(context.createGain());master.gain.value=0;master.connect(context.destination);
    engineGate=node(context.createGain());engineGate.gain.value=0;engineGate.connect(master);
    engineFilter=node(context.createBiquadFilter());engineFilter.type='lowpass';
    engineFilter.frequency.value=360;engineFilter.Q.value=.48;engineFilter.connect(engineGate);
    bodyOsc=makeOscillator('triangle',38,.145,engineFilter);
    harmonicOsc=makeOscillator('sawtooth',76,.028,engineFilter);
    subOsc=makeOscillator('sine',19,.033,engineFilter);

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
    if(!context || !unlocked || context.state!=='running')return;
    updateGates();
    if(!running || muted || !visible())return;

    // Hysteresis prevents gear hunting when speed hovers around a shift point.
    if(gear<4 && speed>(gear+1)*15+1)gear++;
    else if(gear>0 && speed<gear*15-2)gear--;
    const load=clamp((speed-gear*15)/16,0,1);
    const throttle=clamp(finite(state.throttle,1),0,1);
    const pitch=38+load*42+Math.min(speed,70)*.13+drift*5+throttle*3;
    const smooth=clamp(finite(dt,1/60)*5,.055,.18);
    target(bodyOsc.frequency,pitch,smooth);
    target(harmonicOsc.frequency,pitch*2.006,smooth);
    target(subOsc.frequency,pitch*.5,smooth);
    target(engineFilter.frequency,270+load*(throttle?550:240)+speed*5,.11);
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
