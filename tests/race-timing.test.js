import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceTiming,advanceRaceTime} from '../src/race-timing.js';
import {createRace,startRace,stepRace} from '../src/physics.js';

function replay(intervals){
 const race=createRace({mode:'time-attack',track:'harbor',vehicle:'mclaren-p1-gtr',rivalVehicles:[]});startRace(race);
 const clock=createRaceTiming();let now=0;clock.sample(0,{active:true});
 for(const ms of intervals){now+=ms;const t=clock.sample(now,{active:true});assert.equal(t.suspended,false);advanceRaceTime(t.simulation,dt=>stepRace(race,{throttle:1},dt));}
 return race;
}
test('render rates and repeated 100–250 ms stalls preserve the same race clock and trajectory',()=>{
 const reference=replay(Array(120).fill(1000/120));
 for(const intervals of [Array(60).fill(1000/60),Array(30).fill(1000/30),Array(10).fill(100),Array(4).fill(250),[16,16,200,18,250,100,200,100,100]]){
  const race=replay(intervals);assert.ok(Math.abs(race.elapsed-1)<1/120+1e-9);assert.ok(Math.abs(race.elapsed-reference.elapsed)<1/120+1e-9);
  assert.ok(Math.hypot(race.car.x-reference.car.x,race.car.z-reference.car.z)<.001);
 }
});
test('a long interruption requests explicit suspension and contributes no driving time',()=>{
 const clock=createRaceTiming();clock.sample(0,{active:true});const blocked=clock.sample(900,{active:true});assert.equal(blocked.suspended,true);assert.equal(blocked.simulation,0);
 clock.sample(1000,{active:false});assert.equal(clock.sample(12000,{active:false}).simulation,0);
 assert.equal(clock.sample(12100,{active:true}).simulation,0);assert.ok(Math.abs(clock.sample(12200,{active:true}).simulation-.1)<1e-9);
});
test('pause, background reset, and clock restart cannot enter the simulation accumulator',()=>{
 const clock=createRaceTiming();clock.sample(0,{active:true});clock.sample(50,{active:false});clock.reset(50000);
 assert.equal(clock.sample(50010,{active:true}).simulation,0);assert.equal(clock.sample(50020,{active:true}).simulation,.01);
 let calls=0;advanceRaceTime(.25,()=>{calls++;return false;});assert.equal(calls,1);
});
