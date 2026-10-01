import test from 'node:test';
import assert from 'node:assert/strict';
import { findCars, loadFavorites, saveFavorites, findCircuits } from '../src/collection-browser.js';
import { getUpgradeStats } from '../src/physics.js';
import { TRACKS } from '../src/track.js';

test('garage filters intersect search, family and favourites without changing collection order', () => {
  assert.equal(findCars().length,20);
  const matches = findCars({query:'VECTOR',family:'formula',favoritesOnly:true,favorites:new Set(['vector','zenith'])});
  assert.deepEqual(matches.map(car=>car.id),['vector']);
  assert.equal(findCars({query:'vector',family:'gt'}).length,0);
  assert.equal(findCars({favoritesOnly:true}).length,0);
  assert.deepEqual(findCars().slice(0,6).map(car=>car.id),['corsair','stratus','vector','zenith','vela','aurora']);
});
test('speed and handling ranking use saved upgrades rather than factory labels', () => {
  const progression={cars:{coupe:{engine:5,tyres:5,nitro:5,handling:5}}};
  for(const sort of ['speed','handling']) {
    const cars=findCars({sort,progression});
    const key=sort==='speed'?'topSpeed':'handling';
    const values=cars.map(car=>getUpgradeStats(car.id,progression.cars[car.id])[key]);
    assert.ok(values.every((value,i)=>i===0||value<=values[i-1]));
  }
  assert.notEqual(findCars({sort:'speed'})[0].id,findCars({sort:'speed',progression})[0].id);
});
test('favourites reject corrupt storage and unavailable cars, and report failed persistence', () => {
  for(const raw of ['broken','null','{}','x'.repeat(5000)]) assert.equal(loadFavorites({getItem:()=>raw}).size,0);
  assert.deepEqual([...loadFavorites({getItem:()=> '["vector","vector","deleted"]'})],['vector']);
  let saved;
  assert.equal(saveFavorites(new Set(['aurora','unknown']),{setItem:(_,value)=>saved=value}),true);
  assert.deepEqual(JSON.parse(saved),['aurora']);
  assert.equal(saveFavorites(new Set(['vector']),{setItem(){throw Error('quota')}}),false);
  assert.equal(loadFavorites({getItem(){throw Error('disabled')}}).size,0);
});
test('circuit atlas filters current calendar separately from bonus and original routes', () => {
  assert.equal(findCircuits(TRACKS).length,30);
  assert.equal(findCircuits(TRACKS,{series:'current'}).length,23);
  assert.deepEqual(findCircuits(TRACKS,{series:'bonus'}).map(track=>track.id),['sakhir','jeddah']);
  assert.equal(findCircuits(TRACKS,{series:'original'}).length,5);
  assert.deepEqual(findCircuits(TRACKS,{query:'Suzuka',region:'Asia',series:'current'}).map(track=>track.id),['suzuka']);
  assert.equal(findCircuits(TRACKS,{query:'Suzuka',region:'Europe'}).length,0);
});
