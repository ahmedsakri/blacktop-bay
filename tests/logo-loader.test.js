import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {logoLoaderMarkup,loaderProgress,bindLogoLoader} from '../src/logo-loader.js';
import {normalizeCareer,nextChampionshipRace,bindChampionshipFleet} from '../src/race-career.js';

function loaderDOM() {
  const parts=new Map();
  const element={dataset:{},removed:false,querySelector(selector){
    if(!parts.has(selector))parts.set(selector,{textContent:'',style:{},attributes:{},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];}});
    return parts.get(selector);
  },remove(){this.removed=true;}};
  return {element,part:selector=>element.querySelector(`[data-loader-${selector}]`)};
}

test('unknown work stays indeterminate, while real completed-item progress is bounded',()=>{
  for(const value of [undefined,null,{},0,{completed:2,total:0},{completed:NaN,total:7},{completed:2,total:Infinity}])assert.equal(loaderProgress(value),null);
  const part=loaderProgress({completed:2,total:7});
  assert.equal(part.completed,2);assert.equal(part.total,7);assert.ok(Math.abs(part.percent-200/7)<1e-10);
  assert.deepEqual(loaderProgress({completed:11,total:7}),{completed:7,total:7,percent:100});
  assert.deepEqual(loaderProgress({completed:-2,total:7}),{completed:0,total:7,percent:0});
  assert.doesNotMatch(logoLoaderMarkup(),/aria-valuenow=/);
  assert.match(logoLoaderMarkup({progress:{completed:0,total:7}}),/data-loader-fill style="width:0%"/);
});

test('the same approved logo and accessible status render in full and compact loaders with safe copy',()=>{
  for(const variant of ['panel','compact']) {
    const html=logoLoaderMarkup({variant,label:'Loading <car> & friends',detail:'A "quoted" car',progress:{completed:2,total:7}});
    assert.match(html,/\/assets\/logo\.svg\?v=camber-reign-1/);
    assert.match(html,new RegExp(`logo-loader--${variant}`));
    assert.match(html,/role="status" aria-live="polite" aria-atomic="true"/);
    assert.match(html,/Loading &lt;car&gt; &amp; friends/);
    assert.match(html,/A &quot;quoted&quot; car/);
    assert.match(html,/aria-valuemax="7" aria-valuenow="2"/);
    assert.match(html,/data-loader-count aria-hidden="true">2 \/ 7/);
  }
});

test('updates support real counts, indeterminate stages, readable failures and disposal without phantom progress',()=>{
  const dom=loaderDOM(),loader=bindLogoLoader(dom.element);
  loader.update({label:'Preparing opponents…',detail:'McLaren Senna',progress:{completed:0,total:7}});
  assert.equal(dom.part('fill').style.width,'0%');assert.equal(dom.part('progress').attributes['aria-valuenow'],'0');
  loader.update({label:'2 of 7 opponents ready',progress:{completed:2,total:7}});
  assert.equal(dom.part('count').textContent,'2 / 7');assert.equal(dom.element.dataset.determinate,'true');
  loader.update({label:'Finishing the graphics…',progress:null});
  assert.equal(dom.part('progress').attributes['aria-valuenow'],undefined);
  assert.equal(dom.part('count').textContent,'');assert.equal(dom.element.dataset.determinate,'false');
  loader.destroy();loader.update({label:'Stale download callback',progress:{completed:7,total:7}});
  assert.equal(dom.element.removed,true);assert.equal(dom.part('label').textContent,'Finishing the graphics…');
});

const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const prepareSource=main.slice(main.indexOf('async function prepareOpponents('),main.indexOf('function updateWallet(){'));
function preparation({reject=false}={}) {
  const updates=[],pending=[],added=[],fleetRequests=[],old={disposed:false,dispose(){this.disposed=true;}};
  let calls=0;
  const effective={topSpeed:55,acceleration:17,handling:1.1};
  const context=vm.createContext({preferences:{mode:'race',vehicle:'selected'},mobile:false,school:null,career:normalizeCareer(),nextChampionshipRace,bindChampionshipFleet,persistCareer:()=>true,toast(){},fittedStats:()=>effective,
    createOpponentFleet:options=>{fleetRequests.push(options);return ['first','second'];},getVehicle:id=>({name:id}),
    prepareManufacturerCar:id=>{calls++;if(reject&&calls===1)return Promise.reject(Error('Network'));return new Promise(resolve=>pending.push({id,resolve}));},
    createCar:({vehicle})=>({vehicle,group:{visible:true},disposed:false,dispose(){this.disposed=true;}}),
    world:{scene:{add:group=>added.push(group)}},report:state=>updates.push(state),old});
  vm.runInContext(`let fleetGeneration=0,rivalModels=[old],rivalVehicles=[];${prepareSource}`,context);
  return {context,updates,pending,added,old,fleetRequests,effective,resolve:id=>{const i=pending.findIndex(task=>task.id===id);assert.ok(i>=0,`No pending load for ${id}`);pending.splice(i,1)[0].resolve();},start:()=>vm.runInContext("prepareOpponents('test',report)",context),state:()=>vm.runInContext('({rivalModels,rivalVehicles})',context)};
}

test('opponent loader counts constructed cars, including fallback, rather than requested downloads',async()=>{
  const h=preparation({reject:true}),run=h.start();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.updates.at(-1).progress.completed,0);
  assert.equal(h.old.disposed,false);assert.equal(h.added.length,0);
  assert.equal(h.pending.length,2,'parallel preparation keeps two requested loads in flight');
  assert.equal(h.fleetRequests[0].playerStats,h.effective);
  h.resolve('selected');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.updates.at(-1).progress.completed,1);
  assert.equal(h.old.disposed,false);assert.equal(h.added.length,0,'partial construction must not replace the visible field');
  h.resolve('second');assert.equal(await run,true);
  assert.equal(h.updates.at(-1).progress.completed,2);assert.equal(h.updates.at(-1).progress.total,2);
  assert.deepEqual([...h.state().rivalVehicles],['selected','second']);
  assert.equal(h.old.disposed,true);assert.equal(h.added.length,2);
});

test('cancelled race preparation cannot complete a loader or replace the current fleet',async()=>{
  const h=preparation(),run=h.start();
  assert.equal(h.updates.length,2);vm.runInContext('fleetGeneration++',h.context);
  h.resolve('first');h.resolve('second');assert.equal(await run,false);
  assert.equal(h.updates.length,2);assert.ok(h.updates.every(report=>report.progress.completed===0));
  assert.equal(h.old.disposed,false);assert.equal(h.added.length,0);
});

test('solo preparation has no invented seven-car progress',async()=>{
  const h=preparation();vm.runInContext("preferences.mode='time-attack'",h.context);
  assert.equal(await h.start(),true);assert.equal(h.updates.length,0);
  assert.equal(h.pending.length,0);assert.equal(h.added.length,0);assert.equal(h.fleetRequests.length,0);
});

test('driving school preparation uses a real empty practice grid regardless of the lobby mode',async()=>{
 const h=preparation();vm.runInContext('school={active:true}',h.context);
 assert.equal(await h.start(),true);assert.equal(h.pending.length,0);assert.equal(h.updates.length,0);
 assert.equal(h.fleetRequests.length,0);assert.equal(h.state().rivalVehicles.length,0);
});
