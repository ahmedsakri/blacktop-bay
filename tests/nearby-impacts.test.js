import test from 'node:test';import assert from 'node:assert/strict';
import {createNearbyImpactTracker} from '../src/nearby-impacts.js';
const listener={x:0,y:0,z:0},hit=(id,x=10,z=0,source='barrier')=>({id,kind:'crash',source,remaining:.8,strength:.9,x,z,nx:-1,nz:0});
const rival=(id,x,impact=hit(1,x))=>({id,car:{x,z:0,y:0,yaw:0},impact});
test('nearby real impacts emit once, fade by distance and consume distant/paused events',()=>{
 const tracker=createNearbyImpactTracker(),state={listener,raceId:1,rivals:[rival('a',8),rival('b',30),rival('c',80)]};
 const events=tracker.consume(state);assert.equal(events.length,2);assert.ok(events[0].gain>events[1].gain);assert.ok(events.every(v=>v.gain<=.65));
 assert.deepEqual(tracker.consume(state),[]);
 state.rivals[2].car.x=20;assert.deepEqual(tracker.consume(state),[],'driving toward an old distant crash does not replay it');
 state.rivals[0].impact.id=2;assert.deepEqual(tracker.consume({...state,active:false}),[]);assert.deepEqual(tracker.consume(state),[]);
 assert.equal(tracker.consume({...state,raceId:2}).length,2);
});
test('the two halves of a player/rival or rival/rival collision never double the accident',()=>{
 const impact=hit(3,2,0,'car'),tracker=createNearbyImpactTracker();
 assert.deepEqual(tracker.consume({listener,raceId:1,impact,rivals:[rival('a',3,{...impact,id:9,nx:1})]}),[]);
 const pair=[rival('a',10,hit(10,11,0,'car')),rival('b',12,hit(2,11,0,'car'))];
 assert.equal(tracker.consume({listener,raceId:1,rivals:pair}).length,1);
 const later={...pair[1],impact:{...pair[1].impact,id:3,remaining:.4}};
 assert.equal(tracker.consume({listener,raceId:1,rivals:[later]}).length,1,'a later event at that position remains eligible');
});
test('a bounded closest pair is chosen and invalid, expired or scrape events do not create wreck bursts',()=>{
 const tracker=createNearbyImpactTracker(),rivals=Array.from({length:100},(_,i)=>rival(i,20-i*.5));
 assert.deepEqual(tracker.consume({listener,rivals}).map(v=>v.id),[15,14]);
 tracker.clear();assert.deepEqual(tracker.consume({listener,rivals:[rival('a',Infinity),rival('b',3,{...hit(1),remaining:0}),rival('c',3,{...hit(1),kind:'scrape'})]}),[]);
});
