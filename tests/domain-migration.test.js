import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {OLD_ORIGIN,NEW_ORIGIN,TRANSFER_TYPE,TRANSFER_KEYS,RECORD_PREFIX,BACKUP_KEY,LIMITS,isTransferKey,validNonce,validateEntries,validateTransfer,readSaveEntries,hasMeaningfulProgress,applySaveTransfer,needsSaveRecovery,restoreSaveBackup} from '../legacy-host/save-transfer/protocol.js';
import {requestSaveTransfer} from '../src/domain-migration.js';

const nonce='1234567890abcdef1234567890abcdef';
const choices='blacktop-bay-choices-v1',progression='blacktop-bay-progression-v1',consent='blacktop-bay-analytics-consent-v1';
const record=RECORD_PREFIX+'-harbor-mclaren-p1-gtr-race-street-race-v3';
const entries=()=>[[choices,JSON.stringify({vehicle:'audi-r18',track:'harbor',sound:false})],[progression,JSON.stringify({version:1,credits:2300,cars:{'audi-r18':{engine:2}},awardedRaces:['race-old-saved-id']})],[record,JSON.stringify({bestTime:105,bestScore:1200,ghost:[]})]];
function storage(initial=[],{failSet=()=>false,silentSet=()=>false,failRead=false}={}){
  const map=new Map(initial);let writes=0;
  return {map,get length(){if(failRead)throw Error('blocked');return map.size;},key(index){return [...map.keys()][index]??null;},getItem(key){if(failRead)throw Error('blocked');return map.get(key)??null;},setItem(key,value){writes++;if(failSet(key,writes))throw Error('quota');if(!silentSet(key,writes))map.set(key,value);},removeItem(key){map.delete(key);}};
}
const payload=(items=entries())=>({type:TRANSFER_TYPE,version:1,nonce,entries:items});

test('the protocol reads only recognised gameplay saves, never analytics consent, backups or unrelated storage',()=>{
  const s=storage([...entries(),[consent,'granted'],[BACKUP_KEY,'private backup'],['some-other-game','private'],['blacktop-bay-choices-v1-extra','{}']]);
  assert.deepEqual(readSaveEntries(s),entries());
  for(const key of TRANSFER_KEYS)assert.ok(isTransferKey(key));
  for(const key of [consent,BACKUP_KEY,'__proto__',RECORD_PREFIX+'-../other',RECORD_PREFIX+'-A',RECORD_PREFIX+'x',null,3])assert.equal(isTransferKey(key),false);
  assert.ok(isTransferKey(RECORD_PREFIX));assert.ok(isTransferKey(RECORD_PREFIX+'-legacy-v2'));
});

test('transfer schema rejects wrong nonce/version/type, extra fields, duplicate keys and unrecognised saves',()=>{
  assert.deepEqual(validateTransfer(payload(),nonce),entries());assert.ok(validNonce(nonce));
  for(const bad of [null,[],{}, {...payload(),nonce:'0'.repeat(32)}, {...payload(),version:2}, {...payload(),type:'other'}, {...payload(),extra:'hidden data'}])assert.throws(()=>validateTransfer(bad,nonce));
  for(const bad of [null,{}, [[consent,'granted']], [entries()[0],entries()[0]], [[choices,null]], [[choices,'null']], [[choices,'[]']], [[choices,'"x"']], [[choices,'{']], [[choices,'{"__proto__":{"x":1}}']], [[choices,'{"nested":{"constructor":{}}}']]])assert.throws(()=>validateEntries(bad));
  assert.throws(()=>validateEntries([['blacktop-bay-favorites-v1','{}']]));
  assert.deepEqual(validateEntries([['blacktop-bay-favorites-v1','["audi-r18"]']]),[['blacktop-bay-favorites-v1','["audi-r18"]']]);
});

test('size, count and nesting caps bound both exporter and receiver',()=>{
  assert.throws(()=>validateEntries(Array.from({length:LIMITS.entries+1},(_,i)=>[`${RECORD_PREFIX}-${i}`,'{}'])));
  assert.throws(()=>validateEntries([[choices,JSON.stringify({padding:'x'.repeat(LIMITS.valueBytes)})]]));
  assert.throws(()=>validateEntries(Array.from({length:3},(_,i)=>[`${RECORD_PREFIX}-${i}`,JSON.stringify({padding:'x'.repeat(1_400_000)})])));
  let deep={};for(let i=0;i<LIMITS.depth+2;i++)deep={child:deep};
  assert.throws(()=>validateEntries([[choices,JSON.stringify(deep)]]));
  assert.throws(()=>readSaveEntries(storage([],{failRead:true})));
});

test('default settings and empty stock builds do not ask to replace earned progress',()=>{
  assert.equal(hasMeaningfulProgress([[choices,'{"vehicle":"audi-r18","volume":0.3}'],[progression,'{"version":1,"credits":1200,"cars":{"audi-r18":{"engine":0}},"awardedRaces":[]}'],['blacktop-bay-paint-v1','{"audi-r18":{"color":"factory","finish":"gloss"}}'],['blacktop-bay-career-v1','{"records":{},"recordedRaces":[],"completedTours":0,"activeTour":null}']]),false);
  for(const [key,value] of [[progression,{credits:0}], [progression,{credits:1200,cars:{'audi-r18':{engine:1}}}],['blacktop-bay-favorites-v1',['audi-r18']],['blacktop-bay-paint-v1',{'audi-r18':{color:'red',finish:'gloss'}}],['blacktop-bay-career-v1',{activeTour:{id:'some-tour'}}],[record,{bestTime:100}]])assert.equal(hasMeaningfulProgress([[key,JSON.stringify(value)]]),true,key);
});

test('existing progress requires explicit replacement before any write, then imports with a recoverable backup',()=>{
  const original=[[progression,'{"version":1,"credits":5000}'],[RECORD_PREFIX+'-other','{"bestTime":112}']],s=storage([...original,[consent,'denied'],['unrelated','keep']]);
  assert.deepEqual(applySaveTransfer(s,entries()),{ok:false,reason:'confirmation-required'});
  assert.equal(s.getItem(BACKUP_KEY),null);
  assert.equal(applySaveTransfer(s,entries(),{replace:true,now:100}).ok,true);
  assert.deepEqual(JSON.parse(s.getItem(BACKUP_KEY)),{version:1,createdAt:100,entries:original,recoveryRequired:false});
  for(const [key,value] of entries())assert.equal(s.getItem(key),value);
  assert.equal(s.getItem(RECORD_PREFIX+'-other'),null);
  assert.equal(s.getItem(consent),'denied');assert.equal(s.getItem('unrelated'),'keep');
});

test('an import preserves the destination consent and does not alter the previous-origin storage',()=>{
  const old=storage([...entries(),[consent,'granted']]),before=[...old.map],fresh=storage([[choices,'{}'],[consent,'denied']]);
  assert.equal(applySaveTransfer(fresh,readSaveEntries(old)).ok,true);
  assert.deepEqual([...old.map],before);assert.equal(fresh.getItem(consent),'denied');
  assert.equal(applySaveTransfer(storage(),[]).reason,'empty');
});

test('backup failure does not touch progress and a partial write failure rolls back every recognised key',()=>{
  const original=[[progression,'{"credits":4600}'],[RECORD_PREFIX+'-other','{"bestTime":112}']];
  const blocked=storage(original,{failSet:key=>key===BACKUP_KEY});
  assert.equal(applySaveTransfer(blocked,entries(),{replace:true}).reason,'backup-failed');assert.deepEqual([...blocked.map],original);
  const silentBackup=storage(original,{silentSet:key=>key===BACKUP_KEY});
  assert.equal(applySaveTransfer(silentBackup,entries(),{replace:true}).reason,'backup-failed');assert.deepEqual([...silentBackup.map],original);
  const partial=storage(original,{failSet:(_,writes)=>writes===3});
  assert.equal(applySaveTransfer(partial,entries(),{replace:true}).reason,'write-failed-restored');
  assert.deepEqual(readSaveEntries(partial),original);assert.equal(partial.getItem(choices),null);
  assert.deepEqual(JSON.parse(partial.getItem(BACKUP_KEY)).entries,original);
});

test('silent storage write loss cannot report success, and an unrecoverable write keeps the backup',()=>{
  const original=[[progression,'{"credits":4600}']];
  const silent=storage(original,{silentSet:(key,writes)=>key===choices&&writes===2});
  assert.equal(applySaveTransfer(silent,entries(),{replace:true}).reason,'write-failed-restored');
  const failed=storage(original,{failSet:(_,writes)=>writes>=3});
  const result=applySaveTransfer(failed,entries(),{replace:true});
  assert.equal(result.reason,'restore-failed');assert.equal(result.backupKey,BACKUP_KEY);
  assert.deepEqual(JSON.parse(failed.getItem(BACKUP_KEY)).entries,original);
});

function browserHarness({origin=NEW_ORIGIN,blocked=false}={}){
  const listeners=new Map(),timers=new Map(),received=[],errors=[],opened=[];let id=0;
  const popup={closed:false,close(){this.closed=true;}};
  const browser={location:{origin},crypto:{getRandomValues:array=>{array.fill(17);return array;}},open(url,name,features){opened.push({url,name,features});return blocked?null:popup;},addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(key){timers.delete(key);},setInterval(fn){timers.set(++id,fn);return id;},clearInterval(key){timers.delete(key);}};
  const control=requestSaveTransfer({browser,onReceive:items=>received.push(items),onError:reason=>errors.push(reason)});
  const transferNonce=opened[0]?new URL(opened[0].url).searchParams.get('nonce'):null;
  const event=(overrides={})=>({origin:OLD_ORIGIN,source:popup,data:{...payload(),nonce:transferNonce},...overrides});
  return {browser,popup,listeners,timers,received,errors,opened,control,event};
}

test('the receiver accepts only the exact previous origin, popup and nonce, then consumes the request once',()=>{
  const h=browserHarness(),receive=h.listeners.get('message');
  const url=new URL(h.opened[0].url);assert.equal(url.origin,OLD_ORIGIN);assert.equal(url.pathname,'/save-transfer/');
  assert.deepEqual([...url.searchParams.keys()],['nonce']);assert.equal(url.hash,'');
  for(const bad of [{origin:NEW_ORIGIN},{origin:OLD_ORIGIN+'.evil.test'},{source:{}},{data:{...payload(),nonce:'0'.repeat(32)}},{data:{...payload(),type:'other'}}])receive(h.event(bad));
  assert.equal(h.received.length,0);assert.equal(h.errors.length,0);
  receive(h.event());receive(h.event());assert.equal(h.received.length,1);
  assert.deepEqual(h.received[0],entries());assert.equal(h.listeners.size,0);assert.equal(h.timers.size,0);assert.equal(h.popup.closed,true);
});

test('popup refusal, local origins, timeout, closure and cancellation leave no active receiver',()=>{
  assert.deepEqual(browserHarness({blocked:true}).errors,['popup-blocked']);
  const local=browserHarness({origin:'http://127.0.0.1:4180'});assert.deepEqual(local.errors,['production-only']);assert.equal(local.opened.length,0);
  const timed=browserHarness();[...timed.timers.values()][0]();assert.deepEqual(timed.errors,['timeout']);assert.equal(timed.listeners.size,0);
  const closed=browserHarness();closed.popup.closed=true;[...closed.timers.values()][1]();assert.deepEqual(closed.errors,['popup-closed']);
  const cancel=browserHarness(),listener=cancel.listeners.get('message');cancel.control.cancel();listener(cancel.event());assert.deepEqual(cancel.received,[]);assert.deepEqual(cancel.errors,[]);
});

test('a malformed message from the trusted popup is rejected, never delivered as a usable save',()=>{
  const h=browserHarness();h.listeners.get('message')(h.event({data:{...h.event().data,entries:[[consent,'granted']]}}));
  assert.deepEqual(h.received,[]);assert.deepEqual(h.errors,['invalid-transfer']);assert.equal(h.listeners.size,0);
});

test('the actual legacy popup sends no data until clicked and addresses only the new exact origin',()=>{
  const code=readFileSync(new URL('../legacy-host/save-transfer/transfer.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/,'');
  const elements={'send-save':{},status:{}},sent=[],saved=storage([...entries(),[consent,'granted']]);
  const context=vm.createContext({NEW_ORIGIN,OLD_ORIGIN,TRANSFER_TYPE,validNonce,readSaveEntries,URLSearchParams,document:{getElementById:id=>elements[id]},location:{origin:OLD_ORIGIN,search:'?nonce='+nonce},window:{opener:{postMessage:(data,target)=>sent.push({data,target})}},localStorage:saved});
  vm.runInContext(code,context);assert.equal(sent.length,0);elements['send-save'].onclick();assert.equal(sent.length,1);
  assert.equal(sent[0].target,NEW_ORIGIN);assert.deepEqual(sent[0].data.entries,entries());assert.equal(sent[0].data.nonce,nonce);
  assert.equal(saved.getItem(consent),'granted');assert.match(elements.status.textContent,/old save is unchanged/);
});

test('hosting separates the new game from the old save bridge and preserves public route redirects',()=>{
  const current=JSON.parse(readFileSync(new URL('../firebase.json',import.meta.url))),legacy=JSON.parse(readFileSync(new URL('../firebase.legacy.json',import.meta.url)));
  assert.equal(current.hosting.site,'camber-reign');assert.equal(legacy.hosting.site,'blacktop-bay');assert.equal(legacy.hosting.public,'legacy-host');
  assert.ok(legacy.hosting.redirects.some(item=>item.source==='/'&&item.type===301&&item.destination===NEW_ORIGIN+'/'));
  for(const base of ['/guide','/privacy','/credits','/cars','/circuits']){
    assert.ok(legacy.hosting.redirects.some(item=>item.source===base&&item.type===301&&item.destination===NEW_ORIGIN+base+'/'),base);
    assert.ok(legacy.hosting.redirects.some(item=>item.source===base+'/:path*'&&item.type===301&&item.destination===NEW_ORIGIN+base+'/:path'),base+' nested pages');
  }
  assert.ok(legacy.hosting.redirects.every(item=>!['**','/**','/save-transfer/**','/save-transfer/:path*'].includes(item.source)));
  const headers=legacy.hosting.headers.flatMap(group=>group.headers);
  assert.ok(!headers.some(item=>item.key==='Cross-Origin-Opener-Policy'&&item.value==='same-origin'));
  assert.ok(headers.some(item=>item.key==='Content-Security-Policy'&&item.value.includes("frame-ancestors 'none'")));
});

function uiHarness(initial=[],savedStorage=null){
  const code=readFileSync(new URL('../src/domain-migration-ui.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
  const nodes=new Map(),navigation=[],requests=[],s=savedStorage||storage(initial);
  const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,disabled:false,textContent:'',dataset:{},focus(){this.focused=true;}});return nodes.get(id);};
  const context=vm.createContext({NEW_ORIGIN,BACKUP_KEY,applySaveTransfer,needsSaveRecovery,restoreSaveBackup,localStorage:s,
    document:{getElementById:get},location:{origin:NEW_ORIGIN},
    window:{location:{replace:url=>navigation.push(url)},addEventListener(){}},
    requestSaveTransfer:options=>{requests.push(options);return{cancel(){}};}});
  vm.runInContext(code,context);return {get,navigation,requests,storage:s};
}

test('the actual import UI waits for the explicit popup action, then restores a fresh game and navigates home',()=>{
  const h=uiHarness([[consent,'denied']]);assert.equal(h.requests.length,0);assert.equal(h.navigation.length,0);
  h.get('transfer-start').onclick();assert.equal(h.requests.length,1);assert.equal(h.get('transfer-start').disabled,true);
  h.requests[0].onReceive(entries());assert.deepEqual(h.navigation,['/']);
  assert.equal(h.storage.getItem(progression),entries()[1][1]);assert.equal(h.storage.getItem(consent),'denied');
});

test('the actual import UI cannot replace existing progress until its confirmation action is clicked',()=>{
  const before='{"version":1,"credits":5200}',h=uiHarness([[progression,before]]);
  h.get('transfer-start').onclick();h.requests[0].onReceive(entries());
  assert.equal(h.get('transfer-confirm').hidden,false);assert.equal(h.get('transfer-confirm-title').focused,true);
  assert.equal(h.storage.getItem(progression),before);assert.deepEqual(h.navigation,[]);assert.equal(h.storage.getItem(BACKUP_KEY),null);
  h.get('transfer-keep').onclick();assert.equal(h.get('transfer-confirm').hidden,true);assert.equal(h.storage.getItem(progression),before);
  h.get('transfer-replace').onclick();assert.deepEqual(h.navigation,[],'stale replace action is inert after cancellation');
  h.get('transfer-start').onclick();h.requests[1].onReceive(entries());h.get('transfer-replace').onclick();
  assert.deepEqual(h.navigation,['/']);assert.deepEqual(JSON.parse(h.storage.getItem(BACKUP_KEY)).entries,[[progression,before]]);
});

test('an empty previous save returns a clear UI status without overwriting or navigating',()=>{
  const h=uiHarness();h.get('transfer-start').onclick();h.requests[0].onReceive([]);
  assert.match(h.get('transfer-status').textContent,/No saved game was found/);
  assert.equal(h.get('transfer-start').disabled,false);assert.equal(h.get('transfer-confirm').hidden,true);
  assert.deepEqual(h.navigation,[]);assert.equal(h.storage.length,0);
});


test('failed rollback durably protects the original backup across retries until explicit recovery succeeds',()=>{
  const original=[[progression,'{"credits":5200}']],s=storage([...original,[consent,'denied'],['unrelated','keep']],{failSet:(_,write)=>write===3||write===4});
  assert.equal(applySaveTransfer(s,entries(),{replace:true,now:100}).reason,'restore-failed');
  const protectedBackup=s.getItem(BACKUP_KEY);
  assert.equal(needsSaveRecovery(s),true);
  assert.deepEqual(JSON.parse(protectedBackup).entries,original);
  assert.equal(s.getItem(progression),null,'rollback failed as in the reviewed production edge case');
  for(let retry=0;retry<3;retry++){
    assert.equal(applySaveTransfer(s,entries(),{replace:true,now:200}).reason,'recovery-required');
    assert.equal(s.getItem(BACKUP_KEY),protectedBackup,'a retry cannot overwrite the intact original');
  }
  assert.equal(restoreSaveBackup(s).ok,true);
  assert.deepEqual(readSaveEntries(s),original);assert.equal(needsSaveRecovery(s),false);
  assert.equal(s.getItem(consent),'denied');assert.equal(s.getItem('unrelated'),'keep');
  assert.equal(applySaveTransfer(s,entries()).reason,'confirmation-required');
});

test('interrupted import or silent recovery failure leaves the immutable original snapshot locked',()=>{
  const original=[[progression,'{"credits":5200}']];
  const protectedBackup=JSON.stringify({version:1,createdAt:100,entries:original,recoveryRequired:true});
  const s=storage([[BACKUP_KEY,protectedBackup],[choices,'{}']],{silentSet:key=>key===progression});
  assert.equal(applySaveTransfer(s,entries(),{replace:true}).reason,'recovery-required');
  assert.equal(restoreSaveBackup(s).reason,'restore-failed');
  assert.equal(s.getItem(BACKUP_KEY),protectedBackup);assert.equal(needsSaveRecovery(s),true);
});

test('the import UI keeps download and explicit recovery available after a failed rollback and reload',()=>{
  const original=[[progression,'{"credits":5200}']],s=storage(original,{failSet:(_,write)=>write===3||write===4});
  const h=uiHarness([],s);h.get('transfer-start').onclick();h.requests[0].onReceive(entries());h.get('transfer-replace').onclick();
  const backup=s.getItem(BACKUP_KEY);
  assert.equal(h.get('transfer-start').disabled,true);assert.equal(h.get('transfer-backup').hidden,false);
  h.get('transfer-start').onclick();assert.equal(h.requests.length,1);assert.equal(s.getItem(BACKUP_KEY),backup);
  const reloaded=uiHarness([],s);
  assert.equal(reloaded.get('transfer-start').disabled,true);assert.equal(reloaded.get('transfer-backup').hidden,false);
  assert.match(reloaded.get('transfer-status').textContent,/earlier transfer needs recovery/);
  reloaded.get('transfer-start').onclick();assert.equal(reloaded.requests.length,0);assert.equal(s.getItem(BACKUP_KEY),backup);
  reloaded.get('transfer-restore').onclick();
  assert.equal(reloaded.get('transfer-start').disabled,false);assert.equal(reloaded.get('transfer-backup').hidden,true);
  assert.deepEqual(readSaveEntries(s),original);assert.deepEqual(reloaded.navigation,[]);
  assert.match(reloaded.get('transfer-status').textContent,/original Camber Reign progress has been restored/);
});
