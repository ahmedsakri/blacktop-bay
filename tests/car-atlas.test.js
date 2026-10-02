import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {VEHICLES,DEFAULT_VEHICLE_ID} from '../src/vehicles.js';
import {carPreviewMarkup,readAtlasCurrentCar,adjacentPreview} from '../src/car-atlas-view.js';
import {getUpgradeStats} from '../src/physics.js';

test('car catalogue reads only known saved selections and tolerates blocked or malformed storage',()=>{
 const storage=value=>({getItem:()=>value});
 assert.equal(readAtlasCurrentCar(storage('{')),DEFAULT_VEHICLE_ID);
 assert.equal(readAtlasCurrentCar(storage(JSON.stringify({vehicle:'not-a-real-model'}))),DEFAULT_VEHICLE_ID);
 assert.equal(readAtlasCurrentCar({getItem(){throw Error('blocked');}}),DEFAULT_VEHICLE_ID);
 for(const car of VEHICLES)assert.equal(readAtlasCurrentCar(storage(JSON.stringify({vehicle:car.id}))),car.id);
});

test('preview arrows follow the filtered order, wrap at either end and never select an unavailable car',()=>{
 const cars=VEHICLES.filter(car=>car.brand==='Ferrari').reverse();
 assert.ok(cars.length>2);
 assert.equal(adjacentPreview(cars[0].id,cars,1),cars[1].id);
 assert.equal(adjacentPreview(cars[0].id,cars,-1),cars.at(-1).id);
 assert.equal(adjacentPreview(cars.at(-1).id,cars,1),cars[0].id);
 assert.equal(adjacentPreview(DEFAULT_VEHICLE_ID,cars,1),cars[0].id);
 assert.equal(adjacentPreview(DEFAULT_VEHICLE_ID,cars,-1),cars.at(-1).id);
 assert.equal(adjacentPreview(cars[0].id,[],1),cars[0].id);
 assert.equal(adjacentPreview(cars[0].id,[{id:'not-real'},cars[1]],1),cars[1].id);
});

test('studio preview distinguishes saved selection and preview, with real upgrades and bounded stat bars',()=>{
 const id=VEHICLES.find(car=>car.id!==DEFAULT_VEHICLE_ID).id;
 const markup=carPreviewMarkup(id,{current:DEFAULT_VEHICLE_ID,progression:{cars:{[id]:{engine:5,tyres:5,handling:5,nitro:5}}},position:2,count:7});
 assert.ok(markup.includes('PREVIEWING'));assert.ok(!markup.includes('YOUR CURRENT CAR'));
 assert.equal((markup.match(/class="installed"/g)||[]).length,20);
 assert.equal((markup.match(/class="car-stat-track"/g)||[]).length,4);
 for(const match of markup.matchAll(/--stat-fill:([\d.]+)%/g))assert.ok(Number(match[1])>0&&Number(match[1])<=100);
 assert.ok(markup.includes('OPEN GARAGE'));assert.ok(markup.includes('02 <small>/ 07'));
 const empty=carPreviewMarkup(id,{position:0,count:0});
 assert.equal((empty.match(/aria-label="Preview (?:previous|next) car" disabled/g)||[]).length,2);
 assert.ok(empty.includes('— <small>/ 00'));
});

test('every preview routes to its own garage, uses a real portrait and displays saved performance',()=>{
 for(const car of VEHICLES){
  const upgrades={engine:3,tyres:2,handling:4,nitro:1};
  const markup=carPreviewMarkup(car.id,{progression:{cars:{[car.id]:upgrades}},current:car.id});
  const stats=getUpgradeStats(car.id,upgrades);
  assert.ok(markup.includes(`href="/cars/${car.id}/"`));
  assert.ok(markup.includes(`/assets/cars/manufacturers/${car.assetId}.webp`));
  assert.ok(fs.existsSync(new URL(`../public/assets/cars/manufacturers/${car.assetId}.webp`,import.meta.url)));
  assert.ok(markup.includes(`${Math.round(stats.topSpeed*3.6)} <small>KM/H`));
  assert.ok(markup.includes('10 of 20 upgrade levels installed'));
  assert.ok(markup.includes('YOUR CURRENT CAR'));
 }
 const stock=carPreviewMarkup('ferrari-enzo');assert.ok(stock.includes('No upgrade levels installed · Factory balance'));
});

 test('preview uses the selected car setup and keeps every real setup stat bar within its shared scale',()=>{
  for(const car of VEHICLES)for(const setup of ['balanced','grip','sprint','endurance']){
   const upgrades={engine:5,tyres:5,handling:5,nitro:5},setupState={version:1,cars:{[car.id]:setup}};
   const stats=getUpgradeStats(car.id,upgrades,setup);
   const markup=carPreviewMarkup(car.id,{progression:{cars:{[car.id]:upgrades}},setupState});
   for(const [key,scale,digits,unit] of [['topSpeed',3.6,0,'KM/H'],['acceleration',1,1,'M/S²'],['handling',1,2,'×'],['nitroCapacity',1,1,'SEC']])
    assert.ok(markup.includes(`${(stats[key]*scale).toFixed(digits)} <small>${unit}`),`${car.id}/${setup}/${key}`);
   for(const match of markup.matchAll(/--stat-fill:([\d.]+)%/g))assert.ok(Number(match[1])>0&&Number(match[1])<=100);
  }
 });
