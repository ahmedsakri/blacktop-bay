import test from 'node:test';
import assert from 'node:assert/strict';
import {createAirMotion,stepAirMotion,resetAirMotion} from '../src/air-motion.js';

const car=()=>({car:{x:0,y:0,z:0,yaw:0,speed:30,vx:0,vz:30,pitch:0,roll:0},nitro:{charge:1,capacity:5},air:createAirMotion()});
const road=(s,y=0,lane=0)=>({s,y,signedDistance:lane,tx:0,tz:1,grade:0});
const track={ramps:[{id:'jump',s:20,length:18,width:4,lane:0,height:2.8,type:'barrel'}]};

test('authored ramp has a rising physical surface, real ballistic height and a once-only landing reward',()=>{
 const racer=car();
 for(let s=20;s<38;s+=.25){racer.car.z=s;stepAirMotion(racer,road(s),track,1/120);assert.ok(Math.abs(racer.car.y-2.8*(s-20)/18)<1e-8);}
 racer.car.z=38.2;stepAirMotion(racer,road(38.2),track,1/120);assert.equal(racer.air.phase,'airborne');assert.equal(racer.air.event.kind,'takeoff');
 let maxY=racer.car.y,maxRoll=0;
 for(let i=0;i<400&&racer.air.phase==='airborne';i++){racer.car.z+=.25;stepAirMotion(racer,road(racer.car.z),track,1/120);maxY=Math.max(maxY,racer.car.y);maxRoll=Math.max(maxRoll,racer.car.roll);}
 assert.ok(maxY>3.5);assert.ok(maxRoll>6);assert.equal(racer.air.phase,'grounded');assert.equal(racer.car.y,0);assert.equal(racer.car.roll,0);
 assert.equal(racer.air.event.kind,'landing');assert.equal(racer.air.event.stunt,'barrel');assert.equal(racer.air.event.id,2);
 assert.equal(racer.air.completedStunts,1);assert.equal(racer.nitro.charge,2.1);assert.ok(racer.car.vz<30);
 for(let i=0;i<120;i++)stepAirMotion(racer,road(90+i*.25),track,1/120);
 assert.equal(racer.air.event.id,2);assert.equal(racer.nitro.charge,2.1,'a lingering landing event cannot farm rewards');
});

test('driving beside a ramp, reversing, teleporting or holding still does not award a stunt',()=>{
 for(const kind of ['beside','reverse','teleport','stopped']){
  const racer=car();if(kind==='reverse')racer.car.yaw=Math.PI;if(kind==='stopped')racer.car.speed=0;
  stepAirMotion(racer,road(37,0,kind==='beside'?5:0),track,1/120);
  stepAirMotion(racer,road(kind==='teleport'?70:38.2,0,kind==='beside'?5:0),track,1/120);
  assert.notEqual(racer.air.phase,'airborne',kind);assert.equal(racer.air.completedStunts,0);assert.equal(racer.nitro.charge,1);
 }
});

test('ordinary roads follow elevation and grade, while reset clears flight without resetting event IDs',()=>{
 const racer=car();stepAirMotion(racer,{...road(10,7),grade:.1},{ramps:[]},1/120);
 assert.equal(racer.car.y,7);assert.ok(Math.abs(racer.car.pitch-Math.atan(.1))<1e-8);
 racer.air.phase='airborne';racer.air.event={id:5,kind:'takeoff'};racer.air.completedStunts=2;
 resetAirMotion(racer,road(20,3));assert.equal(racer.car.y,3);assert.equal(racer.air.phase,'grounded');assert.equal(racer.air.event.id,5);assert.equal(racer.air.completedStunts,2);
});
