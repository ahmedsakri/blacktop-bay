import test from 'node:test';
import assert from 'node:assert/strict';
import {commitTourAdvance,recoverTourAdvance,TOUR_TRANSACTION_KEY} from '../src/tour-transaction.js';
import {CAREER_KEY} from '../src/race-career.js';
const choices='blacktop-bay-choices-v1';
function store(failAt=0,silent=false){let writes=0;const data=new Map([[CAREER_KEY,'{"old":"tour"}'],[choices,'{"old":"choices"}']]);return {data,getItem:k=>data.get(k)??null,setItem(k,v){if(++writes===failAt){if(silent)return;throw Error('Quota');}data.set(k,v);},removeItem(k){if(++writes===failAt){if(silent)return;throw Error('Quota');}data.delete(k);}};}
for(const silent of [false,true])for(const failAt of [1,2,3,4])test(`tour transaction rolls back write ${failAt}, silent=${silent}`,()=>{
 const storage=store(failAt,silent),before=new Map(storage.data);const result=commitTourAdvance(storage,{career:{next:'tour'},preferences:{next:'choices'}});
 assert.equal(result.ok,false);assert.equal(result.recoveryRequired,false);assert.deepEqual(storage.data,before);
});
test('successful tour writes both exact values and removes its journal',()=>{
 const storage=store();assert.equal(commitTourAdvance(storage,{career:{next:1},preferences:{track:'fuji'}}).ok,true);
 assert.equal(storage.getItem(CAREER_KEY),'{"next":1}');assert.equal(storage.getItem(choices),'{"track":"fuji"}');assert.equal(storage.getItem(TOUR_TRANSACTION_KEY),null);
});
test('reload recovers an interrupted partial write, including an originally absent preference key',()=>{
 const storage=store();storage.data.set(TOUR_TRANSACTION_KEY,JSON.stringify({version:1,before:[[CAREER_KEY,'old'],[choices,null]]}));storage.data.set(CAREER_KEY,'new');
 assert.equal(recoverTourAdvance(storage).recovered,true);assert.equal(storage.getItem(CAREER_KEY),'old');assert.equal(storage.getItem(choices),null);
});
test('persistent rollback failure keeps the original recovery snapshot and prevents another transaction',()=>{
 const storage=store();let failure=false;const write=storage.setItem;storage.setItem=(k,v)=>{if(failure)throw Error('Denied');write.call(storage,k,v);if(k===CAREER_KEY)failure=true;};
 const result=commitTourAdvance(storage,{career:{next:1},preferences:{track:'fuji'}});assert.equal(result.recoveryRequired,true);
 assert.ok(storage.getItem(TOUR_TRANSACTION_KEY));assert.equal(commitTourAdvance(storage,{career:{},preferences:{}}).ok,false);
 failure=false;storage.setItem=write;assert.equal(recoverTourAdvance(storage).ok,true);assert.equal(storage.getItem(CAREER_KEY),'{"old":"tour"}');
});
