import test from 'node:test';
import assert from 'node:assert/strict';
import {VEHICLES} from '../src/vehicles.js';
import {MANUFACTURER_ASSETS} from '../src/manufacturer-asset-manifest.js';
import {vehicleDynamics, capsuleContact, carRoadClearance, carSupportPoint} from '../src/vehicle-dynamics.js';
import {createRace, startRace, stepRace, sampleTrack, getTrack, getUpgradeStats} from '../src/physics.js';
import {resolveTrackObstacles} from '../src/track-obstacles.js';

const car = (id, x=0, z=0, yaw=0) => ({vehicle:id,car:{x,z,yaw,y:0,vx:0,vz:0}});
test('all authored body contacts use the rendered manifest dimensions and modest arcade character',()=>{
 const traits=new Set();
 for(const vehicle of VEHICLES){
  const shape=vehicleDynamics(vehicle.id),asset=MANUFACTURER_ASSETS[vehicle.id],stats=getUpgradeStats(vehicle.id);
  assert.equal(shape.length,asset.length);assert.equal(shape.width,asset.width);assert.equal(shape.height,asset.height);
  assert.equal(shape.radius*2,shape.width);assert.ok(Math.abs((shape.halfSegment+shape.radius)*2-shape.length)<1e-9);
  assert.ok(shape.mass>=.9&&shape.mass<=1.12);
  assert.ok(shape.traction>=.93&&shape.traction<=1);
  assert.ok(stats.braking>=30&&stats.braking<=35);
  traits.add([stats.grip,stats.braking,stats.yawResponse].join(':'));
 }
 assert.ok(traits.size>20,'car character must affect response, not just a garage label');
 assert.ok(vehicleDynamics('rimac-nevera').mass>vehicleDynamics('lotus-elise').mass);
 assert.ok(getUpgradeStats('audi-r8-lms-gt3').braking>getUpgradeStats('ferrari-testarossa').braking);
});

test('nose, side and continuous middle contact follow different visible bodies without an oversized universal hull',()=>{
 for(const id of ['lotus-elise','aston-martin-one-77','audi-r18']){
  const shape=vehicleDynamics(id),a=car(id);
  assert.equal(capsuleContact(a,car(id,0,shape.length+.01)),null);
  assert.ok(capsuleContact(a,car(id,0,shape.length-.01)));
  assert.equal(capsuleContact(a,car(id,shape.width+.01,0)),null);
  const side=capsuleContact(a,car(id,shape.width-.01,0));
  assert.ok(side&&Math.abs(side.overlap-.01)<1e-8);
  assert.ok(Math.abs(side.nx-1)<1e-8&&Math.abs(side.nz)<1e-8);
  assert.equal(carRoadClearance(a,{nx:1,nz:0}),shape.width/2);
  assert.ok(Math.abs(carRoadClearance(car(id,0,0,Math.PI/2),{nx:1,nz:0})-shape.length/2)<1e-8);
 }
});

test('track obstacles use the same continuous contact body including its centre',()=>{
 const racer=car('lotus-elise'),shape=vehicleDynamics(racer.vehicle);
 racer.car.vx=12;
 const obstacle={id:'side',x:shape.radius+.5-.02,y:0,z:0,radius:.5,height:2,tx:1,tz:0};
 const contacts=resolveTrackObstacles(racer,[obstacle]);
 assert.equal(contacts.length,1);assert.ok(contacts[0].normalSpeed>11);
 assert.ok(racer.car.x<0&&racer.car.vx<0);
});

test('ordinary overlap correction gives the heavier body less displacement without teleporting either car',()=>{
 const race=createRace({track:'harbor',vehicle:'lotus-elise',rivalVehicles:['rimac-nevera']});startRace(race);race.rivals=[race.rivals[0]];
 const rival=race.rivals[0],p=sampleTrack(110,getTrack(race.track));
 const separation=(race.contactShape.width+rival.contactShape.width)/2-.1;
 for(const [racer,offset] of [[race,0],[rival,separation]]){
  Object.assign(racer.car,{x:p.x+p.nx*offset,z:p.z+p.nz*offset,yaw:Math.atan2(p.tx,p.tz),vx:0,vz:0,speed:0});
  racer._lastTrackS=racer._safeS=p.s;racer._trackIndex=p.index;
 }
 const a={...race.car},b={...rival.car};stepRace(race,{brake:true},1/120);
 const da=Math.abs((race.car.x-a.x)*p.nx+(race.car.z-a.z)*p.nz),db=Math.abs((rival.car.x-b.x)*p.nx+(rival.car.z-b.z)*p.nz);
 assert.ok(da>db&&da<.07&&db<.07);
 assert.equal(race.recoveries+rival.recoveries,0);
});


test('vertical clearance and barrier impact positions agree with the actual contact surface',()=>{
 const a=car('lotus-elise'),b=car('aston-martin-one-77');b.car.y=vehicleDynamics(a.vehicle).height+.01;
 assert.equal(capsuleContact(a,b),null);
 b.car.y=vehicleDynamics(a.vehicle).height-.01;assert.ok(capsuleContact(a,b));
 const angled=car('audi-r18',10,20,.6),normal={nx:1,nz:0},point=carSupportPoint(angled,normal.nx,normal.nz);
 assert.ok(Math.abs(point.x-angled.car.x-carRoadClearance(angled,normal))<1e-9);
 assert.ok(point.z>angled.car.z,'a diagonal wall touch belongs to the visible nose, not the body centre');
});
