import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_INTENT_KEY, saveCampaignIntent, consumeCampaignIntent } from '../src/campaign-intent.js';
import { normalizeCampaign } from '../src/driver-campaign.js';
import { DEFAULT_VEHICLE_ID } from '../src/vehicles.js';
const memory = () => { const data=new Map();return {getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}; };
const nextState=()=>({version:1,events:{'harbor-first':{runs:1,objectives:['0-finish'],bestTime:150}},recordedRaces:[]});

test('cross-circuit campaign intent binds an unlocked event and car, is consumed once and contains no automatic-start command',()=>{
  const storage=memory(),state=nextState();
  assert.equal(saveCampaignIntent(state,'coast-clock','audi-r18',storage,1000),true);
  const next=consumeCampaignIntent(state,'coast',storage,1500);
  assert.equal(next.id,'coast-clock');assert.equal(next.vehicle,'audi-r18');assert.equal(next.track,'coast');
  assert.equal(next.mode,'time-attack');assert.equal(next.start,undefined);
  assert.equal(storage.getItem(CAMPAIGN_INTENT_KEY),undefined);
  assert.equal(consumeCampaignIntent(state,'coast',storage,1500),null);
});

test('locked, mismatched, stale and malformed campaign navigation is rejected without granting progress',()=>{
  const storage=memory(),empty=normalizeCampaign();
  assert.equal(saveCampaignIntent(empty,'coast-clock',DEFAULT_VEHICLE_ID,storage,1000),false);
  assert.equal(saveCampaignIntent(empty,'harbor-first','missing-car',storage,1000),false);
  for(const [track,time,value] of [
    ['dockyard',1500,{}],['harbor',1_801_001,{}],['harbor',999,{}],
    ['harbor',1500,{track:'coast'}],['harbor',1500,{eventId:'bay-final'}],
    ['harbor',1500,{vehicle:'missing-car'}],['harbor',1500,{version:2}],
  ]){
    storage.setItem(CAMPAIGN_INTENT_KEY,JSON.stringify({version:1,eventId:'harbor-first',vehicle:DEFAULT_VEHICLE_ID,track:'harbor',created:1000,...value}));
    assert.equal(consumeCampaignIntent(empty,track,storage,time),null);
    assert.equal(storage.getItem(CAMPAIGN_INTENT_KEY),undefined);
  }
  storage.setItem(CAMPAIGN_INTENT_KEY,'bad-json');assert.equal(consumeCampaignIntent(empty,'harbor',storage,1500),null);
  assert.deepEqual(empty,normalizeCampaign());
});

test('campaign handoff reports unavailable storage and does not throw on blocked reads/removals',()=>{
  const blocked={setItem(){throw Error('quota');},getItem(){throw Error('private');}};
  assert.equal(saveCampaignIntent(null,'harbor-first',DEFAULT_VEHICLE_ID,blocked),false);
  assert.equal(consumeCampaignIntent(null,'harbor',blocked),null);
  assert.equal(saveCampaignIntent(null,'harbor-first',DEFAULT_VEHICLE_ID,null),false);
  assert.equal(consumeCampaignIntent(null,'harbor',null),null);
});
