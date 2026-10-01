import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,getTrack,sampleTrack} from '../src/track.js';
import {raceMapGeometry,raceMapState,drawRaceMap} from '../src/race-map.js';

test('every route fits one unchanged HUD footprint and its geometry is reused',()=>{
 for(const descriptor of TRACKS){
  const track=getTrack(descriptor.id),geometry=raceMapGeometry(track);
  assert.equal(raceMapGeometry(track),geometry);
  assert.ok(geometry.points.every(p=>p.x>=27.9&&p.x<=292.1&&p.y>=20.9&&p.y<=171.1));
  assert.ok(geometry.points.every(p=>[p.x,p.y,p.s].every(Number.isFinite)));
 }
});

test('lap colouring and next sector use guarded race progress, never a shortcut position',()=>{
 const track=getTrack('harbor'),point=sampleTrack(track.length*.9,track);
 const race={state:'racing',progress:.15,_nextCheckpoint:3,car:{...point,yaw:0},rivals:[]};
 const state=raceMapState(track,race),expected=raceMapGeometry(track).project(...['x','z'].map(key=>sampleTrack(track.length*.25,track)[key]));
 assert.equal(state.progress,.15);assert.deepEqual(state.checkpoint,{...expected,finish:false});
 assert.equal(raceMapState(track,{...race,_nextCheckpoint:12}).checkpoint.finish,true);
 assert.equal(raceMapState(track,{...race,state:'finished',progress:1}).checkpoint,null);
 assert.equal(raceMapState(track,{...race,state:'countdown'}).progress,0);
 assert.equal(raceMapState(track,{...race,_nextCheckpoint:NaN}).checkpoint,null);
});

test('map supports seven real opponents, solo play, unusual input and bounded edge markers',()=>{
 const track=getTrack('silverstone'),rivals=Array.from({length:7},(_,i)=>({car:sampleTrack(i*50,track)}));
 const state=raceMapState(track,{state:'racing',progress:NaN,_nextCheckpoint:2,car:{x:1e9,z:-1e9,yaw:Infinity},rivals});
 assert.equal(state.rivals.length,7);assert.equal(state.progress,0);
 assert.deepEqual(state.player,{x:307,y:13,yaw:0});
 assert.equal(raceMapState(track,{car:{},rivals:[]}).rivals.length,0);
});

test('canvas drawing resizes once for sharpness and leaves raster cost bounded across frames',()=>{
 const operations=[],canvas={width:320,height:200};
 const context={canvas,setTransform(...v){operations.push(['transform',...v]);}};
 for(const name of ['clearRect','setLineDash','beginPath','lineTo','moveTo','closePath','stroke','fill','save','restore','translate','rotate','fillRect','arc'])context[name]=(...args)=>{assert.ok(args.every(value=>typeof value!=='number'||Number.isFinite(value)));};
 const track=getTrack('harbor');
 for(let i=0;i<100;i++)drawRaceMap(context,track,{state:'racing',progress:i/100,_nextCheckpoint:Math.min(12,1+Math.floor(i*.12)),car:sampleTrack(track.length*i/100,track),rivals:[]});
 assert.equal(canvas.width,640);assert.equal(canvas.height,400);assert.ok(operations.every(entry=>entry.join(',')==='transform,2,0,0,2,0,0'));
});

test('native Path2D geometry is built once using its supported API',t=>{
 const before=globalThis.Path2D;let creations=0;
 class Path {constructor(){creations++;}moveTo(){}lineTo(){}closePath(){}}
 globalThis.Path2D=Path;t.after(()=>{if(before===undefined)delete globalThis.Path2D;else globalThis.Path2D=before;});
 const context={canvas:{width:640,height:400},setTransform(){},clearRect(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},stroke(){},fill(){},save(){},restore(){},translate(){},rotate(){},fillRect(){},arc(){}};
 const source=getTrack('monaco'),track={...source,samples:source.samples};
 drawRaceMap(context,track,{car:source.samples[0]});drawRaceMap(context,track,{car:source.samples[0]});
 assert.equal(creations,1);
});
