import test from 'node:test';
import assert from 'node:assert/strict';
import { findCars, loadFavorites, saveFavorites, findCircuits, circuitLibraryMarkup, carLibraryMarkup } from '../src/collection-browser.js';
import { getUpgradeStats } from '../src/physics.js';
import { TRACKS } from '../src/track.js';
import { VEHICLES } from '../src/vehicles.js';

test('garage filters intersect search, family and favourites without changing collection order', () => {
  assert.equal(findCars().length,VEHICLES.length);
  const matches = findCars({query:'SENNA',family:'gt',favoritesOnly:true,favorites:new Set(['mclaren-senna','mclaren-p1-gtr'])});
  assert.deepEqual(matches.map(car=>car.id),['mclaren-senna']);
  assert.equal(findCars({query:'senna',family:'formula'}).length,0);
  assert.equal(findCars({favoritesOnly:true}).length,0);
  assert.ok(findCars()[0].assetId,'actual manufacturer models lead latest arrivals');
  assert.deepEqual(findCars({brand:'McLaren'}).map(car=>car.id),['mclaren-570s','mclaren-senna','mclaren-p1-gtr']);
  assert.equal(findCars({brand:'original'}).length,0,'retired originals cannot be selected');
  const markup = carLibraryMarkup();
  assert.ok(!markup.includes('Blacktop originals'));
  assert.ok(!markup.includes('data-library-family="formula"') && !markup.includes('data-library-family="prototype"'));
  assert.equal(findCars({brand:'McLaren',family:'formula'}).length,0);
  assert.equal(findCars({brand:'Porsche',query:'1975'}).length,1,'classic source is accurately identified');
});
test('speed and handling ranking use saved upgrades rather than factory labels', () => {
  const progression={cars:{'lotus-elise':{engine:5,tyres:5,nitro:5,handling:5}}};
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
  assert.deepEqual([...loadFavorites({getItem:()=> '["mclaren-senna","mclaren-senna","vector","deleted"]'})],['mclaren-senna']);
  let saved;
  assert.equal(saveFavorites(new Set(['rimac-nevera','aurora','unknown']),{setItem:(_,value)=>saved=value}),true);
  assert.deepEqual(JSON.parse(saved),['rimac-nevera']);
  assert.equal(saveFavorites(new Set(['mclaren-senna']),{setItem(){throw Error('quota')}}),false);
  assert.equal(loadFavorites({getItem(){throw Error('disabled')}}).size,0);
});
test('circuit atlas filters current calendar separately from bonus and original routes', () => {
  assert.equal(findCircuits(TRACKS).length,34);
  assert.equal(findCircuits(TRACKS,{series:'current'}).length,23);
  assert.deepEqual(findCircuits(TRACKS,{series:'bonus'}).map(track=>track.id),['sakhir','jeddah']);
  assert.equal(findCircuits(TRACKS,{series:'original'}).length,9);
  assert.deepEqual(findCircuits(TRACKS,{query:'Suzuka',region:'Asia',series:'current'}).map(track=>track.id),['suzuka']);
  assert.equal(findCircuits(TRACKS,{query:'Suzuka',region:'Europe'}).length,0);
});
test('circuit collection counts reflect the supplied routes in both copy and filters', () => {
  for (const tracks of [TRACKS, TRACKS.filter(track => ['suzuka', 'sakhir', 'breakwater', 'cedar-ridge'].includes(track.id))]) {
    const markup = circuitLibraryMarkup(tracks);
    const counts = ['current', 'bonus', 'original'].map(series => findCircuits(tracks, { series }).length);
    assert.ok(markup.includes(`${counts[0]} current Grand Prix venues, ${counts[1]} bonus venues and ${counts[2]} Blacktop Bay originals`));
    for (const [index, series] of ['all', 'current', 'bonus', 'original'].entries()) {
      const count = index === 0 ? tracks.length : counts[index - 1];
      assert.match(markup, new RegExp(`data-circuit-series="${series}"[^>]*>[^<]*<span>${count}</span>`));
    }
  }
});
