import test from 'node:test';
import assert from 'node:assert/strict';
import {ambientSoundFrame,spatialRivalFrames,createSoundEventTracker,eventSoundProfile,RIVAL_VOICE_LIMIT,IMPACT_VOICE_LIMIT} from '../src/race-sound.js';

test('road and wind rise with speed; wet and loose surfaces are distinct and stationary road is silent',()=>{
 const stopped=ambientSoundFrame({speed:0}),slow=ambientSoundFrame({speed:15}),fast=ambientSoundFrame({speed:65});
 assert.equal(stopped.roadGain,0);assert.equal(stopped.windGain,0);
 assert.ok(fast.roadGain>slow.roadGain&&fast.windGain>slow.windGain);
 const wet=ambientSoundFrame({speed:35,road:'wet'}),gravel=ambientSoundFrame({speed:35,road:'gravel'});
 assert.ok(wet.roadCutoff>gravel.roadCutoff);assert.ok(gravel.roadGain>wet.roadGain);
 assert.deepEqual(ambientSoundFrame({speed:35,road:'invalid'}),ambientSoundFrame({speed:35,road:'asphalt'}));
 const airborne=ambientSoundFrame({speed:65,air:{phase:'airborne'}});
 assert.equal(airborne.roadGain,0,'tyres cannot rumble against the road while airborne');assert.equal(airborne.windGain,fast.windGain);
});

test('scraping follows actual contact lifetime and movement; crowd is opt-in location ambience',()=>{
 const impact={kind:'scrape',strength:.8,remaining:.2};
 assert.ok(ambientSoundFrame({speed:30,impact}).scrapeGain>0);
 for(const state of [{speed:0,impact},{speed:30,impact:{...impact,remaining:0}},{speed:30,impact:{...impact,kind:'crash'}},{speed:30}])assert.equal(ambientSoundFrame(state).scrapeGain,0);
 assert.equal(ambientSoundFrame({speed:30}).crowdGain,0);
 assert.ok(ambientSoundFrame({speed:30,crowd:1}).crowdGain>ambientSoundFrame({speed:30,crowd:.3}).crowdGain);
 for(const value of [NaN,Infinity,-Infinity,-1,0,50,1e12])assert.ok(Object.values(ambientSoundFrame({speed:value,crowd:value,time:value,impact:{kind:'scrape',remaining:1,strength:value}})).every(Number.isFinite));
});

test('rival stereo field rotates with the listener, distance fades voices, and far/malformed cars stay silent',()=>{
 const rival={id:'a',vehicle:'ferrari-enzo',x:8,z:8,speed:25},listener={x:0,z:0,yaw:0};
 const facingNorth=spatialRivalFrames(listener,[rival])[0],facingSouth=spatialRivalFrames({...listener,yaw:Math.PI},[rival])[0];
 assert.ok(facingNorth.pan>.5&&facingSouth.pan<-.5);
 const farther=spatialRivalFrames(listener,[{...rival,x:30,z:30}])[0];assert.ok(farther.gain<facingNorth.gain);
 assert.deepEqual(spatialRivalFrames(listener,[{...rival,x:100}]),[]);
 assert.deepEqual(spatialRivalFrames({...listener,yaw:NaN},[rival]),[]);
 assert.deepEqual(spatialRivalFrames(listener,[{...rival,x:Infinity},{id:'bad'}]),[]);
});

test('bounded approaching/receding Doppler and electric voices follow actual rival motion',()=>{
 const listener={x:0,z:0,yaw:0,vx:0,vz:0},rival={id:1,vehicle:'ferrari-enzo',x:0,z:15,speed:30,vx:0};
 const approach=spatialRivalFrames(listener,[{...rival,vz:-30}])[0],recede=spatialRivalFrames(listener,[{...rival,vz:30}])[0];
 assert.ok(approach.frequency>recede.frequency);
 const electric=spatialRivalFrames(listener,[{...rival,vehicle:'rimac-nevera'}])[0];assert.equal(electric.electric,true);assert.ok(electric.harmonicGain<approach.harmonicGain);
 for(const vx of [NaN,Infinity,-9999,9999])assert.ok(Object.values(spatialRivalFrames(listener,[{...rival,vx,vz:vx}])[0]).filter(v=>typeof v==='number').every(Number.isFinite));
});

test('only three nearby rival voices are selected, duplicates do not consume voices, and the input is unchanged',()=>{
 const rivals=Array.from({length:20},(_,id)=>({id,vehicle:'mclaren-p1-gtr',x:id,z:4+id,speed:25}));
 const before=structuredClone(rivals),result=spatialRivalFrames({x:0,z:0,yaw:0},[rivals[0],...rivals]);
 assert.equal(result.length,RIVAL_VOICE_LIMIT);assert.equal(new Set(result.map(v=>v.id)).size,RIVAL_VOICE_LIMIT);
 assert.deepEqual(rivals,before);assert.deepEqual(result.map(v=>v.id),[0,1,2]);
 assert.ok(result.reduce((sum,v)=>sum+v.gain+v.harmonicGain,0)<.17);
});

test('impact, pickup and landing IDs play once, are independent, and reset only with a new race identity',()=>{
 const tracker=createSoundEventTracker(),state={raceId:'race-1',running:true,
  impact:{id:1,kind:'crash',strength:.6,severity:'heavy'},pickupEvent:{id:1,kind:'nitro',amount:25,capacity:100},air:{event:{id:1,kind:'landing',strength:.4}}};
 assert.deepEqual(tracker.consume(state).map(event=>event.type),['crash','pickup','landing']);
 assert.deepEqual(tracker.consume(state),[]);
 assert.deepEqual(tracker.consume({...state,impact:{id:0,kind:'crash'}}),[],'an old/regressed event must not replay');
 assert.deepEqual(tracker.consume({...state,impact:{...state.impact,id:2,kind:'scrape'}}).map(v=>v.type),['scrape']);
 assert.equal(tracker.consume({...state,raceId:'race-2'}).length,3);
});

test('paused events are consumed without playing and takeoff is not mistaken for landing',()=>{
 const tracker=createSoundEventTracker(),state={raceId:'one',running:false,impact:{id:1,kind:'crash',strength:1},air:{event:{id:1,kind:'takeoff',strength:1}}};
 assert.deepEqual(tracker.consume(state),[]);assert.deepEqual(tracker.consume({...state,running:true}),[]);
 assert.deepEqual(tracker.consume({...state,running:true,air:{event:{id:2,kind:'landing',strength:.3}}}).map(event=>event.type),['landing']);
});

test('external event batches have bounded size and deduplication',()=>{
 const tracker=createSoundEventTracker(),events=Array.from({length:100},(_,id)=>({type:'pickup',id,strength:.5}));
 assert.equal(tracker.consume({running:true,events}).length,IMPACT_VOICE_LIMIT);
 assert.deepEqual(tracker.consume({running:true,events}),[]);
 assert.deepEqual(tracker.consume({running:true,events:[{type:'unknown',id:1},{type:'crash',id:{}}]}),[]);
});

test('nearby rival crashes join the fixed sound pool once without doubling player contact',()=>{
 const tracker=createSoundEventTracker(),impact={id:1,kind:'crash',source:'car',strength:.9,remaining:.8,x:2,z:0};
 const rival={id:'a',x:3,z:0,impact:{...impact,id:5}};
 const state={raceId:1,running:true,listener:{x:0,z:0},impact,rivals:[rival]};
 assert.equal(tracker.consume(state).length,1,'player crash has priority over its mirror event');
 rival.impact={...impact,id:6,source:'barrier',x:10};rival.x=10;
 const result=tracker.consume(state);assert.equal(result.length,1);assert.equal(result[0].rival,true);assert.ok(result[0].distanceGain>0&&result[0].distanceGain<.65);
 assert.deepEqual(tracker.consume(state),[]);
});

test('wreck, light contact, landing and refill envelopes have separate bounded timbres',()=>{
 const light=eventSoundProfile({type:'crash',strength:.15}),wreck=eventSoundProfile({type:'crash',strength:1,severity:'wreck'}),landing=eventSoundProfile({type:'landing',strength:.5}),pickup=eventSoundProfile({type:'pickup',strength:.5});
 assert.ok(wreck.bodyGain>light.bodyGain&&wreck.endFrequency<light.endFrequency&&wreck.duration>light.duration);
 assert.ok(landing.startFrequency<light.startFrequency);assert.equal(pickup.noiseGain,0);assert.ok(pickup.endFrequency>pickup.startFrequency);
 for(const type of ['crash','landing','scrape','pickup'])for(const strength of [NaN,Infinity,-100,0,.5,100]) {
  const sound=eventSoundProfile({type,strength,severity:'wreck'});
  for(const value of Object.values(sound))if(typeof value==='number')assert.ok(Number.isFinite(value));
  assert.ok(sound.duration>sound.attack&&sound.duration<.8);assert.ok(sound.bodyGain>=0&&sound.bodyGain<=.16);
  assert.ok(sound.noiseGain>=0&&sound.noiseGain<=.11);
 }
});


test('a pack alongside keeps aggregate engine headroom and avoids hard one-ear panning',()=>{
 const frames=spatialRivalFrames({x:0,z:0,yaw:0},[{id:1,x:1,z:0},{id:2,x:-1,z:0},{id:3,x:0,z:1}]);
 assert.equal(frames.length,3);assert.ok(frames.reduce((sum,f)=>sum+f.gain,0)<=.08500001);
 assert.ok(frames.every(f=>Math.abs(f.pan)<=.86&&f.gain>0));
});
