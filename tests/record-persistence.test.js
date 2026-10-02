import test from 'node:test';
import assert from 'node:assert/strict';
import {STORAGE_KEY,loadRecords,saveResultWithStatus,retryRecordSave,recordSaveStatus,exportPendingRecords,clearRecords} from '../src/storage.js';
const finish=t=>({state:'finished',completedLaps:3,totalLaps:3,elapsed:t,score:10});
const frames=t=>[{t:0,x:1,z:2,yaw:0},{t,x:2,z:3,yaw:.1}];
function store(){const values=new Map();return {values,blocked:false,silent:false,getItem(key){return values.get(key)||null;},setItem(key,value){if(this.blocked)throw Error('quota');if(!this.silent)values.set(key,value);}};}
test('a quota-denied PB remains scoped in session through menu reload and slower finishes',()=>{
 const storage=store();storage.blocked=true;
 const result=saveResultWithStatus(finish(110),frames(110),storage,{scope:'car-a'});assert.equal(result.persisted,false);assert.equal(result.reason,'write-failed');
 assert.equal(loadRecords(storage,{scope:'car-a'}).bestTime,110);assert.equal(loadRecords(storage,{scope:'car-b'}).bestTime,null);
 assert.equal(saveResultWithStatus(finish(120),frames(120),storage,{scope:'car-a'}).records.bestTime,110);
 const exported=exportPendingRecords(storage);assert.equal(exported.entries.length,1);assert.equal(exported.entries[0].scope,'car-a');assert.deepEqual(exported.entries[0].records.ghost,frames(110));
 exported.entries[0].records.ghost[0].x=500;assert.equal(loadRecords(storage,{scope:'car-a'}).ghost[0].x,1);
});
test('read-back verification catches silent no-op writes and retry clears pending only after durable read-back',()=>{
 const storage=store();storage.silent=true;
 assert.equal(saveResultWithStatus(finish(110),frames(110),storage).reason,'verification-failed');
 assert.equal(retryRecordSave(storage).persisted,false);assert.equal(recordSaveStatus(storage).pending,true);
 storage.silent=false;const retry=retryRecordSave(storage);assert.equal(retry.persisted,true);assert.equal(retry.records.bestTime,110);
 assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).bestTime,110);assert.equal(recordSaveStatus(storage).pending,false);assert.deepEqual(exportPendingRecords(storage).entries,[]);
});
test('pending record retry merges a faster external saved PB rather than overwriting it',()=>{
 const storage=store();storage.blocked=true;saveResultWithStatus(finish(110),frames(110),storage);
 storage.values.set(STORAGE_KEY,JSON.stringify({bestTime:100,bestScore:50,ghost:frames(100),sound:true}));storage.blocked=false;
 const retry=retryRecordSave(storage);assert.equal(retry.records.bestTime,100);assert.equal(retry.records.bestScore,50);assert.deepEqual(retry.records.ghost,frames(100));
});
test('explicit record clearing stays cleared in session even if the old durable record cannot be replaced',()=>{
 const storage=store();saveResultWithStatus(finish(100),frames(100),storage);storage.blocked=true;clearRecords(storage);
 assert.equal(loadRecords(storage).bestTime,null);storage.blocked=false;assert.equal(retryRecordSave(storage).records.bestTime,null);
});

test('portable pending export validates all entries before writes and restores only better scoped records',async()=>{
 const {importPendingRecords}=await import('../src/storage.js');const origin=store();origin.blocked=true;
 saveResultWithStatus(finish(110),frames(110),origin,{scope:'harbor-car-a-race-street-0000-balanced-handling-v1'});
 const file=exportPendingRecords(origin),target=store(),scope=file.entries[0].scope;
 target.values.set(`${STORAGE_KEY}-${scope}`,JSON.stringify({bestTime:100,bestScore:5,ghost:frames(100),sound:false}));
 const imported=importPendingRecords(JSON.stringify(file),target);assert.equal(imported.ok,true);assert.equal(imported.persisted,true);assert.equal(imported.imported,1);
 const record=JSON.parse(target.getItem(`${STORAGE_KEY}-${scope}`));assert.equal(record.bestTime,100);assert.equal(record.bestScore,10);assert.equal(record.sound,false);assert.deepEqual(record.ghost,frames(100));
 const before=new Map(target.values);
 for(const corrupt of [ {...file,version:2},{...file,extra:true},{...file,entries:[...file.entries,...file.entries]}, {...file,entries:[file.entries[0],{scope:'../../bad',records:file.entries[0].records}]}, {...file,entries:[{scope,records:{...file.entries[0].records,ghost:[{t:0,x:0,z:0,yaw:0},{t:110,x:Infinity,z:0,yaw:0}]}}]}]) {
  assert.equal(importPendingRecords(JSON.stringify(corrupt),target).ok,false);assert.deepEqual(target.values,before);
 }
});
test('failed portable import retains a verified retry candidate shared with the live scoped adapter',async()=>{
 const {importPendingRecords}=await import('../src/storage.js');const target=store();target.blocked=true;const scope='harbor-car-a-race-street-stock-handling-v1';
 const payload={format:'camber-reign-unsaved-records',version:1,entries:[{scope,records:{bestTime:110,bestScore:10,ghost:frames(110),sound:true}}]};
 const result=importPendingRecords(JSON.stringify(payload),target);assert.equal(result.ok,true);assert.equal(result.pending,true);assert.equal(result.entries[0].reason,'write-failed');
 const adapter={storageIdentity:target,getItem:()=>target.getItem(`${STORAGE_KEY}-${scope}`),setItem:(_key,value)=>target.setItem(`${STORAGE_KEY}-${scope}`,value)};
 assert.equal(loadRecords(adapter,{scope}).bestTime,110);assert.equal(recordSaveStatus(adapter,{scope}).pending,true);
 target.blocked=false;assert.equal(retryRecordSave(adapter,{scope}).persisted,true);assert.equal(exportPendingRecords(target).entries.length,0);
});

test('blocked reads never overwrite an unknown durable PB even if setItem would succeed',()=>{
 let writes=0;const storage={getItem(){throw Error('read denied');},setItem(){writes++;}};
 const result=saveResultWithStatus(finish(110),frames(110),storage);assert.equal(result.pending,true);assert.equal(result.reason,'unavailable');assert.equal(writes,0);
 assert.equal(loadRecords(storage).bestTime,110);assert.equal(exportPendingRecords(storage).entries.length,1);
});
