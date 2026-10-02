import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSONS,SCHOOL_KEY,createDrivingSchool,schoolSeen,saveSchool} from '../src/driving-school.js';

const driving=()=>({state:'racing',car:{speed:20},score:0,nitro:{active:false,mode:'off'},pickupEvent:{id:0}});
const turn=(school,race,count=30)=>{for(let i=0;i<count;i++)school.update(race,{steer:.5},.05);};
test('school progresses from actual steering, banked drift, Nitro, pickup and Perfect Nitro in order',()=>{
 const school=createDrivingSchool(),race=driving();assert.equal(school.lesson.id,'steer');
 for(let i=0;i<30;i++)school.update({...race,car:{speed:0}},{steer:.5},.05);
 assert.equal(school.index,0);turn(school,race);assert.equal(school.lesson.id,'drift');
 race.car.drifting=true;assert.equal(school.update(race,{steer:0},.02),false,'an unbanked slide does not finish the bank lesson');
 race.score=100;assert.equal(school.update(race,{steer:0},.02),true);assert.equal(school.lesson.id,'boost');
 race.nitro.active=true;assert.equal(school.update(race,{steer:0},.02),true);assert.equal(school.lesson.id,'pickup');
 race.pickupEvent.id=1;assert.equal(school.update(race,{steer:0},.02),true);assert.equal(school.lesson.id,'perfect');
 race.nitro.mode='normal';assert.equal(school.update(race,{steer:0},.02),false);
 race.nitro.mode='perfect';assert.equal(school.update(race,{steer:0},.02),true);
 assert.equal(school.active,false);assert.equal(school.lesson,null);assert.equal(school.skipped,0);
 assert.equal(school.update(race,{steer:1},1),false);assert.equal(school.skip(),null);
});

test('paused time and a long frame cannot skip the steering exercise, and skips stay bounded',()=>{
 const school=createDrivingSchool(),race=driving();
 for(const state of ['ready','paused','finished'])for(let i=0;i<50;i++)school.update({...race,state},{steer:1},.05);
 assert.equal(school.index,0);school.update(race,{steer:1},100);assert.equal(school.index,0);
 for(let i=0;i<LESSONS.length+5;i++)school.skip();
 assert.equal(school.skipped,LESSONS.length);assert.equal(school.index,LESSONS.length);assert.equal(school.active,false);
});

test('skipping to a pickup lesson does not reuse a canister collected during an earlier exercise',()=>{
 const school=createDrivingSchool(),race=driving();school.update(race,{steer:0},.05);
 race.pickupEvent.id=1;school.update(race,{steer:0},.05);
 school.skip();school.skip();school.skip();assert.equal(school.lesson.id,'pickup');
 assert.equal(school.update(race,{steer:0},.05),false);assert.equal(school.lesson.id,'pickup');
 race.pickupEvent.id=2;assert.equal(school.update(race,{steer:0},.05),true);
});

test('school seen/completed persistence handles unavailable and denied storage without claiming a save',()=>{
 const data=new Map(),store={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 assert.equal(schoolSeen(store),false);assert.equal(saveSchool(store),true);assert.equal(data.get(SCHOOL_KEY),'seen');assert.equal(schoolSeen(store),true);
 assert.equal(saveSchool(store,true),true);assert.equal(data.get(SCHOOL_KEY),'complete');
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(schoolSeen(blocked),false);assert.equal(saveSchool(blocked,true),false);assert.equal(schoolSeen(null),false);assert.equal(saveSchool(null),false);
});
