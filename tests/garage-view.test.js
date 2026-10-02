import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {garageStatsMarkup,garageBuildMarkup} from '../src/collection-ui.js';
import {getUpgradeStats} from '../src/physics.js';
import {VEHICLES} from '../src/vehicles.js';

test('garage build status shows only installed upgrade levels and bounds corrupted saved values',()=>{
  for(const [input,level,label] of [[undefined,0,'STOCK BUILD'],[{engine:3,tyres:2,nitro:1,handling:4},10,'YOUR BUILD'],[{engine:5,tyres:5,nitro:5,handling:5},20,'FULLY UPGRADED'],[{engine:999,tyres:-2,nitro:'5',handling:NaN,unrecognised:5},5,'YOUR BUILD']]){
    const markup=garageBuildMarkup(input);
    assert.ok(markup.includes(label));
    assert.match(markup,new RegExp(`aria-valuenow="${level}"`));
    assert.match(markup,new RegExp(`aria-valuetext="${level} of 20 upgrade levels installed"`));
    assert.match(markup,new RegExp(`width:${level*5}%`));
    assert.doesNotMatch(markup,/blueprint|rank|star|unlocked/i,'no invented collectible progression');
  }
});

test('garage performance values follow each actual car and installed upgrades, with bounded visual bars',()=>{
  for(const car of VEHICLES)for(const upgrades of [{},{engine:5,tyres:5,nitro:5,handling:5}]){
    const stats=getUpgradeStats(car.id,upgrades),markup=garageStatsMarkup(stats);
    assert.match(markup,new RegExp(`<dd>${Math.round(stats.topSpeed*3.6)} <small>KM/H`));
    assert.ok(markup.includes(`<dd>${stats.acceleration.toFixed(1)} <small>M/S²`));
    assert.ok(markup.includes(`<dd>${stats.handling.toFixed(2)} <small>×`));
    assert.ok(markup.includes(`<dd>${stats.nitroCapacity.toFixed(1)} <small>SEC`));
    const bars=[...markup.matchAll(/width:([\d.]+)%/g)].map(match=>Number(match[1]));
    assert.equal(bars.length,4);assert.ok(bars.every(width=>width>=0&&width<=100));
  }
});

test('each illustrated garage metric resolves to a self-hosted symbol while retaining a visible text label',()=>{
  const markup=garageStatsMarkup(getUpgradeStats(VEHICLES[0].id)),sprite=readFileSync(new URL('../public/assets/ui/race-icons.svg',import.meta.url),'utf8');
  const ids=[...markup.matchAll(/race-icons\.svg\?v=[^#]+#([^\"]+)/g)].map(match=>match[1]);
  assert.deepEqual(ids,['speedometer','acceleration','steering','nitro']);
  for(const id of ids)assert.ok(sprite.includes(`id="${id}"`),id);
  for(const label of ['Top speed','Acceleration','Handling','Nitro'])assert.ok(markup.includes(`<span>${label}</span>`));
});
