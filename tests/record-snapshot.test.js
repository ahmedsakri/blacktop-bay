import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {STORAGE_KEY,loadRecords,saveResultWithStatus,clearRecords,setSound,exportPendingRecords} from '../src/storage.js';
import {exportSaveBackup,inspectSaveBackup,importSaveBackup} from '../src/save-backup.js';

// Exercise the production orchestration; only its UI/game globals are supplied.
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const begin=main.indexOf('function saveSnapshot(){'),end=main.indexOf('function showSaveBackup(){',begin);
assert.ok(begin>=0&&end>begin);const snapshotSource=main.slice(begin,end);
const scopeA='harbor-mclaren-p1-gtr-time-attack-solo-stock-handling-20261002-v1';
const scopeB='harbor-ferrari-enzo-time-attack-solo-stock-handling-20261002-v1';
const key=scope=>`${STORAGE_KEY}-${scope}`;
const finish=(elapsed,score=10)=>({state:'finished',completedLaps:3,totalLaps:3,elapsed,score});
const frames=t=>[{t:0,x:1,z:2,yaw:0},{t,x:2,z:3,yaw:.1}];
function memory(){const values=new Map();return {values,blocked:false,get length(){return values.size;},key:i=>[...values.keys()][i]??null,
 getItem:name=>values.get(name)??null,setItem(name,value){if(this.blocked)throw Error('quota');values.set(name,String(value));},removeItem(name){if(this.blocked)throw Error('quota');values.delete(name);}};}
function harness(){
 const storage=memory(),state=JSON.parse(exportSaveBackup({storage}).json).data;
 const scoped=scope=>({storageIdentity:storage,getItem:()=>storage.getItem(key(scope)),setItem:(_name,value)=>storage.setItem(key(scope),value)});
 const recordStore=scoped(scopeA),context=vm.createContext({...state,paintChoices:state.paint,favoriteCars:new Set(state.favorites),carSetups:state.setups,
  localStore:()=>storage,recordStore,STORAGE_KEY,loadRecords,exportSaveBackup,exportPendingRecords});
 vm.runInContext(snapshotSource,context);
 return {storage,scoped,recordStore,snapshot(){const result=vm.runInContext('saveSnapshot()',context);assert.equal(result.ok,true,result.error);const check=inspectSaveBackup(result.json);assert.equal(check.ok,true);return {result,data:check.states};}};
}

test('full snapshot preserves a denied session clear through export and actual full restore',()=>{
 const h=harness();saveResultWithStatus(finish(120,500),frames(120),h.recordStore,{scope:scopeA});setSound(false,h.recordStore,{scope:scopeA});
 h.storage.blocked=true;clearRecords(h.recordStore,{scope:scopeA});assert.equal(loadRecords(h.recordStore,{scope:scopeA}).bestTime,null);
 const {result,data}=h.snapshot(),record=data.records.find(item=>item.key===key(scopeA)).value;
 assert.deepEqual(record,{bestTime:null,bestScore:0,ghost:[],sound:false});
 const destination=memory();destination.setItem(key(scopeA),JSON.stringify({bestTime:120,bestScore:500,ghost:frames(120),sound:false}));
 assert.equal(importSaveBackup(result.json,{storage:destination}).ok,true);
 assert.deepEqual(JSON.parse(destination.getItem(key(scopeA))),record);
 assert.equal(JSON.parse(h.storage.getItem(key(scopeA))).bestTime,120,'export never pretends the denied source clear was persisted');
});

test('full snapshot exports unsaved faster times and their ghosts under each exact scope',()=>{
 const h=harness();saveResultWithStatus(finish(120,100),frames(120),h.recordStore,{scope:scopeA});
 h.storage.blocked=true;saveResultWithStatus(finish(110,50),frames(110),h.recordStore,{scope:scopeA});
 saveResultWithStatus(finish(135,70),frames(135),h.scoped(scopeB),{scope:scopeB});
 const {result,data}=h.snapshot();assert.equal(data.records.length,2);
 const a=data.records.find(item=>item.key===key(scopeA)).value,b=data.records.find(item=>item.key===key(scopeB)).value;
 assert.equal(a.bestTime,110);assert.equal(a.bestScore,100);assert.deepEqual(a.ghost,frames(110));assert.equal(b.bestTime,135);assert.deepEqual(b.ghost,frames(135));
 const restored=memory();assert.equal(importSaveBackup(result.json,{storage:restored}).ok,true);
 assert.equal(JSON.parse(restored.getItem(key(scopeA))).bestTime,110);assert.equal(JSON.parse(restored.getItem(key(scopeB))).bestTime,135);
});

test('full snapshot keeps a faster externally saved PB while merging the higher pending score',()=>{
 const h=harness();h.storage.blocked=true;saveResultWithStatus(finish(110,500),frames(110),h.recordStore,{scope:scopeA});
 h.storage.values.set(key(scopeA),JSON.stringify({bestTime:100,bestScore:200,ghost:frames(100),sound:true}));
 const {data}=h.snapshot(),record=data.records.find(item=>item.key===key(scopeA)).value;
 assert.equal(record.bestTime,100);assert.equal(record.bestScore,500);assert.deepEqual(record.ghost,frames(100));
});
