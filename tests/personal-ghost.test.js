import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIAL_RULES,recordScope,interpolateGhost,ghostTimeAtProgress,createGhostTiming,challengeURL,readChallenge} from '../src/personal-ghost.js';
import {loadRecords} from '../src/storage.js';

const spec={track:'harbor',vehicle:'lotus-elise',mode:'time-attack',difficulty:'standard',upgrades:{engine:0,tyres:0,nitro:0,handling:0},setup:'balanced'};
const frames=[{t:0,x:0,y:1,z:0,yaw:3.1,pitch:0,roll:0,progress:0},{t:10,x:10,y:3,z:20,yaw:-3.1,pitch:.1,roll:-.1,progress:.5},{t:20,x:20,y:1,z:40,yaw:-3,pitch:0,roll:0,progress:1}];
test('personal records isolate each circuit, car, race format, build, setup and handling rules',()=>{
 const base=recordScope(spec);assert.ok(base.endsWith(TRIAL_RULES));
 for(const difference of [{track:'coast'},{vehicle:'rimac-nevera'},{mode:'race'},{setup:'grip'},{upgrades:{engine:1}},{upgrades:{tyres:1}},{upgrades:{nitro:1}},{upgrades:{handling:1}}])assert.notEqual(recordScope({...spec,...difference}),base);
 assert.equal(recordScope({...spec,difficulty:'pro'}),base,'solo records are independent of opponent difficulty');
 assert.notEqual(recordScope({...spec,mode:'race'}),recordScope({...spec,mode:'race',difficulty:'pro'}));
 const stock=recordScope({...spec,stock:true});assert.notEqual(stock,base);
 assert.equal(stock,recordScope({...spec,stock:true,upgrades:{engine:5,tyres:5,nitro:5,handling:5},setup:'sprint'}));
 assert.equal(recordScope({...spec,mode:'race',stock:true}),recordScope({...spec,mode:'race'}),'stock flag is a solo rule only');
});

test('ghost poses interpolate the shortest yaw arc and disappear outside their actual replay interval',()=>{
 const before=structuredClone(frames),middle=interpolateGhost(frames,5);
 assert.equal(middle.x,5);assert.equal(middle.z,10);assert.equal(middle.y,2);assert.equal(middle.pitch,.05);assert.equal(middle.roll,-.05);
 assert.ok(Math.abs(middle.yaw-Math.PI)<1e-9);assert.equal(middle.progress,.25);
 assert.equal(interpolateGhost(frames,0).x,0);assert.equal(interpolateGhost(frames,20).x,20);
 for(const time of [-1,21,NaN,Infinity])assert.equal(interpolateGhost(frames,time),null);
 assert.equal(interpolateGhost([],5),null);assert.equal(interpolateGhost([frames[0]],0),null);assert.deepEqual(frames,before);
 const legacy=frames.map(({y,pitch,roll,progress,...frame})=>frame);
 assert.equal(interpolateGhost(legacy,5).y,0);assert.equal(interpolateGhost(legacy,5).pitch,0);
});

test('stored corrupt ghost geometry is rejected before interpolation while optional legacy pose fields remain valid',()=>{
 const read=ghost=>loadRecords({getItem:()=>JSON.stringify({bestTime:20,bestScore:0,ghost,sound:true})}).ghost;
 assert.deepEqual(read(frames),frames);
 for(const broken of [[frames[0],{...frames[1],t:0}],[frames[0],{...frames[1],yaw:Infinity}],[frames[0],{...frames[1],progress:2}],[frames[0],{...frames[1],y:'NaN'}]])assert.deepEqual(read(broken),[]);
});

test('ghost sector timing uses first real forward crossings and emits each sector once',()=>{
 assert.equal(ghostTimeAtProgress(frames,.25),5);assert.equal(ghostTimeAtProgress(frames,.75),15);
 assert.equal(ghostTimeAtProgress(frames,0),null);assert.equal(ghostTimeAtProgress(frames,1.1),null);
 const recovered=[{t:0,progress:0},{t:4,progress:.4},{t:5,progress:.2},{t:9,progress:.5}];
 assert.ok(Math.abs(ghostTimeAtProgress(recovered,.3)-3)<1e-9);
 const tracker=createGhostTiming(frames),first=tracker.update(.25,6);
 assert.equal(first.sectors.length,3);assert.equal(first.last.sector,3);assert.equal(first.last.delta,1);
 assert.equal(tracker.update(.25,7).changed,false);assert.equal(tracker.update(.1,8).sectors.length,3);
 const finish=tracker.update(1,21);assert.equal(finish.sectors.length,12);assert.equal(finish.last.delta,1);
 assert.equal(tracker.update(1,30).changed,false);
});

test('shared stock challenge round-trips only recognized cars, circuits, rules and bounded finish times',()=>{
 const options={cars:['lotus-elise','rimac-nevera'],tracks:['harbor','coast'],track:'coast'};
 const url=new URL(challengeURL({origin:'https://example.test',track:'coast',vehicle:'lotus-elise',time:101.234}));
 assert.equal(url.pathname,'/circuits/coast/');assert.deepEqual(readChallenge(url.hash,options),{vehicle:'lotus-elise',track:'coast',time:101.23});
 for(const [key,value] of [['challenge','race'],['rules','old-version'],['car','invented'],['time','0'],['time','-1'],['time','901'],['time','NaN'],['time','Infinity']]){
  const hash=new URLSearchParams(url.hash.slice(1));hash.set(key,value);assert.equal(readChallenge('#'+hash,options),null,`${key}=${value}`);
 }
 assert.equal(readChallenge(url.hash,{...options,track:'missing'}),null);
 assert.equal(readChallenge('',options),null);assert.equal(readChallenge(null,options),null);
});
