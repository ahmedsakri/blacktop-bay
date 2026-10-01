import test from 'node:test';
import assert from 'node:assert/strict';
import { findCars, loadFavorites, saveFavorites, findCircuits, circuitLibraryMarkup, carLibraryMarkup, carLibraryCard, hasCarFilters, clearCarFilters, NEW_CARS } from '../src/collection-browser.js';
import { LATEST_CAR_IDS } from '../src/car-releases.js';
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
  assert.deepEqual(findCars({brand:'McLaren'}).map(car=>car.id),['mclaren-650s-gt3','mclaren-570s','mclaren-senna','mclaren-p1-gtr']);
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
    assert.ok(markup.includes(`${counts[0]} current Grand Prix venues, ${counts[1]} bonus venues and ${counts[2]} Camber Reign originals`));
    for (const [index, series] of ['all', 'current', 'bonus', 'original'].entries()) {
      const count = index === 0 ? tracks.length : counts[index - 1];
      assert.match(markup, new RegExp(`data-circuit-series="${series}"[^>]*>[^<]*<span>${count}</span>`));
    }
  }
});

test('car search accepts separate maker/model terms, reversed words, accents and punctuation while keeping other filters', () => {
  for (const query of ['Ferrari GTO', 'GTO Ferrari', '  FERRARI   250  '])
    assert.deepEqual(findCars({query}).map(car => car.id), ['ferrari-250-gto']);
  for (const query of ['Huracan', 'Huracán', 'LAMBORGHINI HURACAN'])
    assert.deepEqual(findCars({query}).map(car => car.id), ['lamborghini-huracan']);
  for (const query of ['Nissan GTR', 'Nissan GT-R', 'GT-R Nissan'])
    assert.deepEqual(findCars({query}).map(car => car.id), ['nissan-gt-r-2018']);
  assert.deepEqual(findCars({query:'P1-GTR McLaren'}).map(car => car.id), ['mclaren-p1-gtr']);
  assert.equal(findCars({query:'Ferrari GTO', brand:'Audi'}).length, 0);
  assert.equal(findCars({query:'Ferrari GTO', favoritesOnly:true}).length, 0);
  assert.deepEqual(findCars({query:'Ferrari GTO', favoritesOnly:true, favorites:new Set(['ferrari-250-gto'])}).map(car => car.id), ['ferrari-250-gto']);
  assert.equal(findCars({query:'   '}).length, VEHICLES.length);
});

test('latest arrivals and new badges use the explicit release list without marking the entire garage new', () => {
  const recent = LATEST_CAR_IDS.filter(id => VEHICLES.some(car => car.id === id));
  assert.equal(new Set(LATEST_CAR_IDS).size, LATEST_CAR_IDS.length, 'release ordering cannot contain duplicates');
  assert.deepEqual([...NEW_CARS], recent);
  const ordered = findCars().map(car => car.id);
  assert.deepEqual(ordered.slice(0,recent.length), recent);
  assert.deepEqual(ordered.slice(recent.length), VEHICLES.filter(car => !NEW_CARS.has(car.id)).map(car => car.id));
  for (const car of VEHICLES) {
    const markup = carLibraryCard(car);
    assert.equal(markup.includes('NEW ARRIVAL'), NEW_CARS.has(car.id), car.id);
    assert.equal(markup.includes('READY TO RACE'), !NEW_CARS.has(car.id), car.id);
    assert.ok(!markup.includes('NO. —'), 'cars without a racing number do not show an empty badge');
  }
  assert.ok(VEHICLES.some(car => !NEW_CARS.has(car.id)), 'existing catalogue cars are not described as new');
  assert.deepEqual(findCars({sort:'name'}).map(car => car.id), [...VEHICLES].sort((a,b)=>a.name.localeCompare(b.name)).map(car => car.id));
});

test('clearing collection filters restores every car without discarding the chosen sorting or comparison mode', () => {
  const view = Object.freeze({query:'Ferrari', family:'gt', brand:'Ferrari', favoritesOnly:true, sort:'handling', compare:true});
  assert.equal(hasCarFilters(view), true);
  for (const filter of [{query:'gto'}, {family:'gt'}, {brand:'Audi'}, {favoritesOnly:true}]) assert.equal(hasCarFilters(filter), true);
  assert.equal(hasCarFilters({query:'  ', sort:'speed', compare:true}), false);
  const reset = clearCarFilters(view);
  assert.deepEqual(reset, {query:'', family:'all', brand:'all', favoritesOnly:false, sort:'handling', compare:true});
  assert.equal(view.query, 'Ferrari', 'reset does not mutate the prior state');
  assert.equal(hasCarFilters(reset), false);
  assert.equal(findCars(reset).length, VEHICLES.length);
  assert.match(carLibraryMarkup(), /id="clear-car-filters"[^>]*disabled>Clear filters/);
});

test('comparison identifies its baseline and all four upgraded driving figures without altering saved upgrades', () => {
  const candidate = VEHICLES.find(car => car.id === 'ferrari-250-gto'), selected = 'mclaren-p1-gtr';
  const progression = {cars:{[candidate.id]:{engine:5,tyres:3,handling:4,nitro:2}, [selected]:{engine:1,tyres:2,handling:1,nitro:5}}};
  const before = structuredClone(progression);
  const stats = getUpgradeStats(candidate.id, progression.cars[candidate.id]), baseline = getUpgradeStats(selected, progression.cars[selected]);
  const markup = carLibraryCard(candidate, {selected, progression, compare:true});
  assert.match(markup, /aria-label="Compared with McLaren P1 GTR"/);
  assert.match(markup, new RegExp(`aria-describedby="car-stats-${candidate.id} car-comparison-${candidate.id}"`));
  const comparison = markup.match(/class="library-comparison"[^>]*>([^]*?)<\/div>/)[1];
  for (const [key,label,scale,digits,unit] of [['topSpeed','Top speed',3.6,1,'km/h'], ['acceleration','Acceleration',1,1,'m/s²'], ['handling','Handling',1,2,'×'], ['nitroCapacity','Nitro',1,1,'sec']]) {
    const delta = Number(((stats[key]-baseline[key])*scale).toFixed(digits));
    const value = delta === 0 ? 'Same' : `${delta > 0 ? '+' : ''}${delta.toFixed(digits)} ${unit}`;
    assert.ok(comparison.includes(`<span>${label}</span><b>${value}</b>`), `${label} uses the same upgraded tuning as the race`);
  }
  assert.deepEqual(progression, before);
  assert.ok(!carLibraryCard(candidate, {selected, compare:false}).includes('class="library-comparison"'));
  assert.ok(!carLibraryCard(candidate, {selected:candidate.id, compare:true}).includes('class="library-comparison"'), 'current car is not compared to itself');
  assert.ok(!carLibraryCard(candidate, {selected:'unavailable', compare:true}).includes('class="library-comparison"'), 'unknown car cannot become a silent baseline');
});
