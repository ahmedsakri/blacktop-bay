// Original Web Audio synthesis. All persistent voices are allocated at unlock;
// race updates only change bounded parameters. No recordings or network assets.
import {getVehicle} from './vehicles.js';
import {drivingVoice} from './driving-sound.js';
import {createNearbyImpactTracker} from './nearby-impacts.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,finite(value)));
export const RIVAL_VOICE_LIMIT=3;
export const IMPACT_VOICE_LIMIT=4;

export function ambientSoundFrame(state={}) {
 const speed=clamp(Math.abs(finite(state.speed)),0,100),motion=state.air?.phase==='airborne'?0:clamp((speed-1.5)/35);
 const road=['wet','gravel'].includes(state.road)?state.road:'asphalt';
 const scrape=state.air?.phase!=='airborne'&&state.impact?.kind==='scrape'&&state.impact.remaining>0
  ?clamp(state.impact.strength)*clamp(speed/12):0;
 const audience=clamp(state.crowd),time=finite(state.time);
 return {
  roadGain:motion**1.3*(road==='gravel'?.070:road==='wet'?.046:.028),
  roadCutoff:road==='gravel'?480+speed*11:road==='wet'?1050+speed*13:210+speed*6,
  windGain:clamp((speed-9)/70)**1.8*.060,windCutoff:260+speed*4.8,
  scrapeGain:scrape*.105,scrapeCutoff:750+speed*10+scrape*480,
  crowdGain:audience*.025*(.84+.16*Math.sin(time*1.9)),
  crowdFrequency:470+45*Math.sin(time*.63),
  crowdBodyGain:audience*.007*(.72+.28*Math.sin(time*2.3)**2),
 };
}

export function spatialRivalFrames(listener,rivals=[]) {
 if(!listener||![listener.x,listener.z,listener.yaw].every(Number.isFinite)||!Array.isArray(rivals))return [];
 const frames=[],seen=new Set();
 for(const rival of rivals.slice(0,32)) {
  if(!rival||![rival.x,rival.z].every(Number.isFinite)||rival.id===undefined||seen.has(rival.id))continue;
  seen.add(rival.id);
  const dx=rival.x-listener.x,dz=rival.z-listener.z,distance=Math.hypot(dx,dz);
  if(distance>72)continue;
  const side=dx*Math.cos(listener.yaw)-dz*Math.sin(listener.yaw);
  const forward=dx*Math.sin(listener.yaw)+dz*Math.cos(listener.yaw);
  const radial=distance>.01?((finite(rival.vx)-finite(listener.vx))*dx+(finite(rival.vz)-finite(listener.vz))*dz)/distance:0;
  const vehicle=getVehicle(typeof rival.vehicle==='string'?rival.vehicle:rival.vehicle?.id);
  const voice=drivingVoice(vehicle),speed=clamp(Math.abs(finite(rival.speed)),0,100);
  const rev=clamp(speed/Math.max(1,vehicle.handling.topSpeed));
  const proximity=(1-clamp(distance/72))**2;
  const gain=proximity*.047*(forward<0?.76:1)*(.52+clamp(rival.throttle??1)*.48);
  frames.push({id:rival.id,distance,pan:clamp(side/Math.max(5,distance),-1,1),
   frequency:(voice.idle+rev*voice.range)*clamp(343/(343+radial),.88,1.12),
   gain,harmonicGain:gain*(voice.electric?.075:.19),electric:voice.electric,
   cutoff:(380+voice.cutoff*(.3+rev*.7))*(1-clamp(distance/90)*.45)});
 }
 return frames.sort((a,b)=>b.gain-a.gain||a.distance-b.distance||String(a.id).localeCompare(String(b.id))).slice(0,RIVAL_VOICE_LIMIT);
}

// Event IDs are consumed even when muted/paused/locked, so old impacts never
// play on resume. Independent counters let a pickup and landing share an ID.
export function createSoundEventTracker() {
 let identity,impactId=0,pickupId=0,airId=0;
 const recent=new Set();
 const nearbyImpacts=createNearbyImpactTracker({range:48,limit:2});
 return {
  consume(state={}) {
   if(state.raceId!==identity) {identity=state.raceId;impactId=pickupId=airId=0;recent.clear();}
   const events=[];
   const read=(event,previous)=>Number.isSafeInteger(event?.id)&&event.id>previous;
   const impact=state.impact;
   if(read(impact,impactId)) {
    impactId=impact.id;
    if(impact.kind==='crash'||impact.kind==='scrape')events.push({type:impact.kind,strength:clamp(impact.strength),severity:impact.severity,source:impact.source});
   }
   if(read(state.pickupEvent,pickupId)) {
    pickupId=state.pickupEvent.id;
    if(state.pickupEvent.kind==='nitro')events.push({type:'pickup',strength:clamp(state.pickupEvent.amount/Math.max(1,finite(state.pickupEvent.capacity,1)))*.5+.5});
   }
   if(read(state.air?.event,airId)) {
    airId=state.air.event.id;
    if(state.air.event.kind==='landing')events.push({type:'landing',strength:clamp(state.air.event.strength)});
   }
   for(const event of Array.isArray(state.events)?state.events.slice(0,16):[]) {
    if(!event||!['crash','landing','pickup'].includes(event.type)||!['string','number'].includes(typeof event.id))continue;
    const key=`${event.type}:${event.id}`;
    if(recent.has(key))continue;
    recent.add(key);if(recent.size>64)recent.delete(recent.values().next().value);
    events.push({type:event.type,strength:clamp(event.strength),severity:event.severity,source:event.source});
   }
   const nearby=nearbyImpacts.consume({raceId:state.raceId,listener:state.listener,rivals:state.rivals,impact:state.impact,active:state.running===true});
   for(const hit of nearby)events.push({type:'crash',strength:clamp(hit.impact.strength),severity:hit.impact.severity,source:hit.impact.source,distanceGain:hit.gain,rival:true});
   return state.running===true?events.slice(0,IMPACT_VOICE_LIMIT):[];
  },
 };
}

export function eventSoundProfile(event={}) {
 const strength=clamp(event.strength),wreck=event.severity==='wreck';
 if(event.type==='pickup')return {type:'pickup',duration:.42,attack:.009,bodyGain:.038+strength*.010,toneGain:.025,noiseGain:0,
  startFrequency:659.25,endFrequency:987.77,toneFrequency:1318.51,cutoff:1800,priority:1};
 if(event.type==='scrape')return {type:'scrape',duration:.17,attack:.008,bodyGain:.013+strength*.022,toneGain:.004,noiseGain:.019+strength*.035,
  startFrequency:180,endFrequency:95,toneFrequency:420,cutoff:850+strength*600,priority:0};
 if(event.type==='landing')return {type:'landing',duration:.26+strength*.17,attack:.006,bodyGain:.043+strength*.065,toneGain:.010,noiseGain:.028+strength*.033,
  startFrequency:110+strength*22,endFrequency:43,toneFrequency:220,cutoff:650,priority:2};
 return {type:'crash',duration:.28+strength*.20+(wreck?.18:0),attack:.004,
  bodyGain:.045+strength*.085+(wreck?.025:0),toneGain:.018+strength*.016,noiseGain:.035+strength*.075,
  startFrequency:155+strength*35,endFrequency:wreck?35:49,toneFrequency:event.source==='car'?330:235,
  cutoff:900+strength*1000,priority:wreck?4:3};
}

export function createRaceSoundscape({context,noise,engineDestination,sfxDestination,node,makeOscillator,target}) {
 const rivals=[],impacts=[];
 let clock=0;
 function noiseLayer(type,frequency,Q,destination) {
  const filter=node(context.createBiquadFilter()),gain=node(context.createGain());
  filter.type=type;filter.frequency.value=frequency;filter.Q.value=Q;gain.gain.value=0;
  noise.connect(filter);filter.connect(gain);gain.connect(destination);return {filter,gain};
 }
 const road=noiseLayer('lowpass',400,.5,sfxDestination),wind=noiseLayer('lowpass',500,.32,sfxDestination);
 const scrape=noiseLayer('bandpass',1200,.55,sfxDestination),crowd=noiseLayer('bandpass',650,1.2,sfxDestination);
 const crowdBody=makeOscillator('triangle',190,0,sfxDestination);
 for(let i=0;i<RIVAL_VOICE_LIMIT;i++) {
  const filter=node(context.createBiquadFilter());filter.type='lowpass';filter.frequency.value=900;filter.Q.value=.45;
  const panner=context.createStereoPanner?node(context.createStereoPanner()):null;
  filter.connect(panner||engineDestination);panner?.connect(engineDestination);
  rivals.push({id:null,filter,panner,body:makeOscillator('triangle',80,0,filter),harmonic:makeOscillator('sawtooth',160,0,filter)});
 }
 for(let i=0;i<IMPACT_VOICE_LIMIT;i++) {
  const mix=node(context.createGain());mix.gain.value=.65;mix.connect(sfxDestination);
  impacts.push({until:0,priority:0,body:makeOscillator('sine',80,0,mix),tone:makeOscillator('triangle',220,0,mix),noise:noiseLayer('lowpass',1000,.7,mix)});
 }
 function automate(parameter,value,start) {
  // Cancel queued tails before reusing a voice. cancelAndHold is optional on
  // older WebKit; the explicit zero + short attack also avoids stale envelopes.
  parameter.cancelScheduledValues?.(start);parameter.setValueAtTime(value,start);
 }
 function envelope(parameter,peak,start,attack,duration) {
  parameter.cancelScheduledValues?.(start);
  parameter.setValueAtTime(clamp(parameter.value,0,.18),start);
  parameter.linearRampToValueAtTime(0,start+.003);
  if(peak<=0)return;
  parameter.linearRampToValueAtTime(peak,start+.003+attack);
  parameter.exponentialRampToValueAtTime(.0001,start+duration);parameter.setValueAtTime(0,start+duration+.006);
 }
 function play(event) {
  const profile=eventSoundProfile(event),now=context.currentTime;
  if(event.rival){profile.priority=Math.max(0,Math.min(1,profile.priority-1));const attenuation=clamp(event.distanceGain);profile.bodyGain*=attenuation;profile.toneGain*=attenuation;profile.noiseGain*=attenuation;}
  const slot=impacts.find(voice=>voice.until<=now)||impacts.filter(voice=>voice.priority<=profile.priority).sort((a,b)=>a.until-b.until)[0];
  if(!slot)return;
  slot.until=now+profile.duration;slot.priority=profile.priority;
  envelope(slot.body.amplitude.gain,profile.bodyGain,now,profile.attack,profile.duration);
  envelope(slot.tone.amplitude.gain,profile.toneGain,now+.009,profile.attack,profile.duration*.72);
  envelope(slot.noise.gain.gain,profile.noiseGain,now,.005,profile.duration*.82);
  automate(slot.body.oscillator.frequency,profile.startFrequency,now);
  slot.body.oscillator.frequency.exponentialRampToValueAtTime(profile.endFrequency,now+profile.duration*.65);
  automate(slot.tone.oscillator.frequency,profile.toneFrequency,now);
  slot.tone.oscillator.frequency.exponentialRampToValueAtTime(profile.toneFrequency*(profile.type==='pickup'?1.5:.72),now+profile.duration);
  target(slot.noise.filter.frequency,profile.cutoff,.008);
 }
 function silence() {
  for(const layer of [road,wind,scrape,crowd])target(layer.gain.gain,0,.025);
  target(crowdBody.amplitude.gain,0,.035);
  for(const rival of rivals){target(rival.body.amplitude.gain,0,.035);target(rival.harmonic.amplitude.gain,0,.035);rival.id=null;}
  for(const voice of impacts) {
   voice.until=0;
   for(const parameter of [voice.body.amplitude.gain,voice.tone.amplitude.gain,voice.noise.gain.gain]) {
    parameter.cancelScheduledValues?.(context.currentTime);target(parameter,0,.012);
   }
  }
 }
 return {
  silence,
  update(state={},dt=1/60,pending=[]) {
   clock+=clamp(finite(dt,1/60),0,.1);
   const frame=ambientSoundFrame({...state,time:clock});
   for(const [layer,gain,frequency] of [[road,frame.roadGain,frame.roadCutoff],[wind,frame.windGain,frame.windCutoff],[scrape,frame.scrapeGain,frame.scrapeCutoff],[crowd,frame.crowdGain,frame.crowdFrequency]]) {
    target(layer.gain.gain,gain,.12);target(layer.filter.frequency,frequency,.17);
   }
   target(crowdBody.amplitude.gain,frame.crowdBodyGain,.18);
   target(crowdBody.oscillator.frequency,188+18*Math.sin(clock*.71),.2);
   const frames=spatialRivalFrames(state.listener,state.rivals),assigned=new Set();
   // Preserve voice identity while cars remain nearby: overtakes do not swap
   // stereo engines merely because two distances cross.
   for(const rival of rivals)if(frames.some(frame=>frame.id===rival.id))assigned.add(rival.id);else rival.id=null;
   for(const frame of frames)if(!assigned.has(frame.id)) {const slot=rivals.find(rival=>rival.id===null);if(slot){slot.id=frame.id;assigned.add(frame.id);}}
   for(const rival of rivals) {
    const frame=frames.find(candidate=>candidate.id===rival.id);
    target(rival.body.amplitude.gain,frame?.gain||0,.09);target(rival.harmonic.amplitude.gain,frame?.harmonicGain||0,.09);
    if(!frame)continue;
    rival.body.oscillator.type=frame.electric?'sine':'triangle';rival.harmonic.oscillator.type=frame.electric?'sine':'sawtooth';
    target(rival.body.oscillator.frequency,frame.frequency,.075);target(rival.harmonic.oscillator.frequency,frame.frequency*2.006,.075);
    target(rival.filter.frequency,frame.cutoff,.13);target(rival.panner?.pan,frame.pan,.065);
   }
   for(const event of pending)play(event);
  },
 };
}
