import {DEFAULT_VEHICLE_ID, getVehicle} from './vehicles.js';
import {TRACKS} from './track.js';
import {normalizeProgression, PROGRESSION_KEY} from './progression.js';
import {normalizeCareer, CAREER_KEY} from './race-career.js';
import {normalizeCampaign, CAMPAIGN_KEY} from './driver-campaign.js';
import {normalizeMastery, MASTERY_KEY} from './car-mastery.js';
import {normalizeSetups, SETUPS_KEY} from './car-setups.js';
import {loadPaint, PAINT_KEY} from './paint.js';
import {loadRecords, STORAGE_KEY} from './storage.js';
import {normalizePlayerControls} from './player-controls.js';
import {LOBBY_STYLES,normalizeLobbyStyle} from './lobby-music.js';

export const SAVE_BACKUP_FORMAT = 'camber-reign-save';
export const SAVE_BACKUP_VERSION = 1;
export const SAVE_IMPORT_JOURNAL_KEY = 'camber-reign-portable-import-journal-v1';
const PREFS_KEY='blacktop-bay-choices-v1', FAVORITES_KEY='blacktop-bay-favorites-v1', SCHOOL_KEY='camber-reign-driving-school-v1';
const keys={preferences:PREFS_KEY,progression:PROGRESSION_KEY,paint:PAINT_KEY,favorites:FAVORITES_KEY,career:CAREER_KEY,campaign:CAMPAIGN_KEY,mastery:MASTERY_KEY,setups:SETUPS_KEY,school:SCHOOL_KEY};
const maxBytes=32_000_000, maxEntries=512, encoder=new TextEncoder();
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const byteLength=value=>encoder.encode(value).length;
const storageFor=storage=>storage===undefined?globalThis.localStorage:storage;
const recordKey=key=>typeof key==='string'&&key.length<=240&&(key===STORAGE_KEY||key.startsWith(STORAGE_KEY+'-')&&/^[a-z0-9-]+$/.test(key));
const gameKey=key=>Object.values(keys).includes(key)||recordKey(key);
const validCar=id=>typeof id==='string'&&getVehicle(id).id===id;
const has=(value,key)=>Object.hasOwn(value,key);
const fail=message=>{throw new Error(message);};
function boundedJSON(raw) {
  if (typeof raw!=='string'||byteLength(raw)>maxBytes) fail('Backup is missing or exceeds 32 MB.');
  const value=JSON.parse(raw), queue=[[value,0]];let nodes=0;
  while(queue.length){const [item,depth]=queue.pop();if(++nodes>1_000_000||depth>24)fail('Backup is too complex.');
    if(item&&typeof item==='object')for(const [key,nested]of Object.entries(item)){
      // `prototype` is a real retired car ID in progression/paint. The
      // section validators allow it only where their schemas preserve it.
      if(['__proto__','constructor'].includes(key))fail('Backup contains an unsafe property.');queue.push([nested,depth+1]);
    }
  }return value;
}
// Reject values a loader would silently clamp, drop or reset. Newly introduced
// default properties may be absent in an older version-one save.
function matchesSaved(raw, normalized) {
  if(Array.isArray(raw))return Array.isArray(normalized)&&raw.length===normalized.length&&raw.every((item,index)=>matchesSaved(item,normalized[index]));
  if(plain(raw))return plain(normalized)&&Object.entries(raw).every(([key,item])=>has(normalized,key)&&matchesSaved(item,normalized[key]));
  return Object.is(raw,normalized);
}
function checkedState(raw, normalize, name) {
  if(!plain(raw)||raw.version!==1)fail(`Invalid ${name} version.`);
  const normalized=normalize(raw);
  if(!matchesSaved(raw,normalized))fail(`Invalid ${name} data.`);
  return normalized;
}
const preferenceNames=['vehicle','track','mode','difficulty','steeringSensitivity','volume','musicVolume','engineVolume','sfxVolume','quality','gamepadSwap','lobbyStyle','sound','controls'];
function preferences(value, {strict=true}={}) {
  if(!plain(value))fail('Invalid preferences.');
  if(strict&&Object.keys(value).some(key=>!preferenceNames.includes(key)))fail('Unrecognized preference.');
  const clean={vehicle:DEFAULT_VEHICLE_ID,track:'harbor',mode:'race',difficulty:'street',steeringSensitivity:1,volume:.75,musicVolume:.65,engineVolume:1,sfxVolume:.85,quality:'auto',gamepadSwap:false,lobbyStyle:normalizeLobbyStyle()};
  for(const key of preferenceNames)if(has(value,key))clean[key]=value[key];
  if(!validCar(clean.vehicle)||!TRACKS.some(track=>track.id===clean.track)||!['race','time-attack','championship'].includes(clean.mode)
    ||!['relaxed','street','pro'].includes(clean.difficulty)||!['auto','performance','balanced','ultra'].includes(clean.quality)
    ||!LOBBY_STYLES.some(style=>style.id===clean.lobbyStyle)||typeof clean.gamepadSwap!=='boolean'||has(clean,'sound')&&typeof clean.sound!=='boolean')fail('Invalid preference choice.');
  for(const key of ['volume','musicVolume','engineVolume','sfxVolume'])if(!Number.isFinite(clean[key])||clean[key]<0||clean[key]>1)fail('Invalid audio level.');
  if(!Number.isFinite(clean.steeringSensitivity)||clean.steeringSensitivity<.65||clean.steeringSensitivity>1.5)fail('Invalid steering sensitivity.');
  if(has(clean,'controls')){const normalized=normalizePlayerControls(clean.controls);if(!plain(clean.controls)||!matchesSaved(clean.controls,normalized))fail('Invalid controls.');clean.controls=normalized;}
  return clean;
}
function normalizePaint(raw){const value=loadPaint({getItem:()=>JSON.stringify(raw)});if(!plain(raw)||!matchesSaved(raw,value))fail('Invalid paint choices.');return value;}
function normalizeFavorites(raw){if(!Array.isArray(raw)||raw.length>200||raw.some(id=>!validCar(id))||new Set(raw).size!==raw.length)fail('Invalid favorites.');return [...raw];}
function normalizeRecord(raw){if(!plain(raw))fail('Invalid race record.');const value=loadRecords({getItem:()=>JSON.stringify(raw)});if(!matchesSaved(raw,value))fail('Invalid race record or ghost.');return value;}
function validateData(raw) {
  if(!plain(raw)||Object.keys(raw).length!==10||![...Object.keys(keys),'records'].every(key=>has(raw,key)))fail('Backup must contain every save section.');
  const data={preferences:preferences(raw.preferences),progression:checkedState(raw.progression,normalizeProgression,'progression'),paint:normalizePaint(raw.paint),favorites:normalizeFavorites(raw.favorites),
    career:checkedState(raw.career,normalizeCareer,'career'),campaign:checkedState(raw.campaign,normalizeCampaign,'campaign'),mastery:checkedState(raw.mastery,normalizeMastery,'mastery'),setups:checkedState(raw.setups,normalizeSetups,'setups')};
  if(raw.school!==null&&!['seen','complete'].includes(raw.school))fail('Invalid driving school progress.');data.school=raw.school;
  if(!Array.isArray(raw.records)||raw.records.length>maxEntries-9)fail('Too many race records.');
  const seen=new Set();data.records=raw.records.map(item=>{if(!plain(item)||Object.keys(item).length!==2||!recordKey(item.key)||seen.has(item.key))fail('Invalid or duplicate record key.');seen.add(item.key);return {key:item.key,value:normalizeRecord(item.value)};});
  return data;
}
function summary(data){return {credits:data.progression.credits,campaignEvents:Object.keys(data.campaign.events).length,masteredCars:Object.keys(data.mastery.cars).length,completedTours:data.career.completedTours,records:data.records.length,circuitSetups:Object.values(data.setups.circuits).reduce((sum,tracks)=>sum+Object.keys(tracks).length,0)};}
function savedEntries(storage) {
  if(!storage||!Number.isSafeInteger(storage.length)||storage.length<0||storage.length>10000)fail('Browser storage is unavailable.');
  const entries=[];let bytes=0;
  for(let index=0;index<storage.length;index++){const key=storage.key(index);if(!gameKey(key))continue;const value=storage.getItem(key);if(typeof value!=='string')fail('A saved item could not be read.');bytes+=byteLength(key)+byteLength(value);if(entries.length>=maxEntries||bytes>maxBytes)fail('Saved progress exceeds the backup limit.');entries.push([key,value]);}
  return entries;
}
function dataFromEntries(entries, states={}) {
  const stored=new Map(entries), read=(name,fallback)=>{if(has(states,name))return states[name];const raw=stored.get(keys[name]);return raw===undefined?fallback:JSON.parse(raw);};
  const raw={preferences:preferences(read('preferences',{}),{strict:false}),progression:read('progression',normalizeProgression()),paint:read('paint',{}),favorites:read('favorites',[]),career:read('career',normalizeCareer()),campaign:read('campaign',normalizeCampaign()),mastery:read('mastery',normalizeMastery()),setups:read('setups',normalizeSetups()),school:has(states,'school')?states.school:stored.get(SCHOOL_KEY)??null,
    records:has(states,'records')?states.records:entries.filter(([key])=>recordKey(key)).map(([key,value])=>({key,value:JSON.parse(value)}))};
  return validateData(raw);
}
export function inspectSaveBackup(json) {
  try{const backup=boundedJSON(json);if(!plain(backup)||Object.keys(backup).length!==4||backup.format!==SAVE_BACKUP_FORMAT||backup.version!==SAVE_BACKUP_VERSION||!Number.isFinite(backup.createdAt)||backup.createdAt<0)fail('Unsupported save backup.');
    const data=validateData(backup.data);return {ok:true,backup:{...backup,data},states:data,summary:summary(data)};
  }catch(error){return {ok:false,error:error.message||'This save backup cannot be read.'};}
}
export function exportSaveBackup({storage,states={},now=Date.now()}={}) {
  try{const target=storageFor(storage);if(target?.getItem(SAVE_IMPORT_JOURNAL_KEY)!==null&&target?.getItem(SAVE_IMPORT_JOURNAL_KEY)!==undefined)fail('Recover the interrupted import before exporting current progress.');
    const data=dataFromEntries(savedEntries(target),states),backup={format:SAVE_BACKUP_FORMAT,version:SAVE_BACKUP_VERSION,createdAt:now,data},json=JSON.stringify(backup,null,2);
    const check=inspectSaveBackup(json);if(!check.ok)fail(check.error);return {ok:true,json,summary:summary(data),filename:`camber-reign-save-${new Date(now).toISOString().slice(0,10)}.json`};
  }catch(error){return {ok:false,error:error.message||'Progress could not be exported.'};}
}
function journalFor(storage) {
  const raw=storage.getItem(SAVE_IMPORT_JOURNAL_KEY);if(raw===null||raw===undefined)return null;
  const journal=boundedJSON(raw);if(!plain(journal)||journal.version!==1||!Array.isArray(journal.entries)||journal.entries.length>maxEntries)fail('The recovery journal is invalid.');
  const seen=new Set();for(const item of journal.entries){if(!Array.isArray(item)||item.length!==2||!gameKey(item[0])||seen.has(item[0])||typeof item[1]!=='string')fail('The recovery journal is invalid.');seen.add(item[0]);}
  return journal;
}
function replaceEntries(storage, entries) {
  const previous=savedEntries(storage), expected=new Map(entries);
  for(const [key]of previous)if(!expected.has(key))storage.removeItem(key);
  for(const [key,value]of entries)if(storage.getItem(key)!==value)storage.setItem(key,value);
  const actual=savedEntries(storage);if(actual.length!==expected.size||actual.some(([key,value])=>expected.get(key)!==value))fail('The saved data could not be verified.');
}
function releaseJournal(storage){storage.removeItem(SAVE_IMPORT_JOURNAL_KEY);if(storage.getItem(SAVE_IMPORT_JOURNAL_KEY)!=null)fail('Recovery completion could not be saved.');}
export function recoverSaveImport({storage}={}) {
  let target, raw;
  // Denied storage still permits an ordinary session. A known journal is a
  // different case: until it is restored, mixed save values must not be loaded.
  try {target=storageFor(storage);raw=target?.getItem(SAVE_IMPORT_JOURNAL_KEY);}
  catch {return {ok:true,recovered:false,storageUnavailable:true};}
  if(raw===null||raw===undefined)return {ok:true,recovered:false};
  try{const journal=journalFor(target);replaceEntries(target,journal.entries);releaseJournal(target);return {ok:true,recovered:true};}
  catch(error){return {ok:false,recovered:false,recoveryRequired:true,error:error.message||'Recovery could not be completed.'};}
}
export function exportRecoveryBackup({storage}={}) {
  try{const journal=journalFor(storageFor(storage));if(!journal)fail('No recovery backup is available.');const data=dataFromEntries(journal.entries),json=JSON.stringify({format:SAVE_BACKUP_FORMAT,version:1,createdAt:journal.createdAt,data},null,2);const checked=inspectSaveBackup(json);if(!checked.ok)fail(checked.error);return {ok:true,json,summary:summary(data),filename:'camber-reign-recovery.json'};}
  catch(error){return {ok:false,error:error.message};}
}
export function importSaveBackup(json,{storage}={}) {
  const checked=inspectSaveBackup(json);if(!checked.ok)return {...checked,persisted:false,rolledBack:false};
  let target,before;
  try{target=storageFor(storage);if(journalFor(target))return {ok:false,persisted:false,rolledBack:false,recoveryRequired:true,error:'Recover the interrupted import first.'};before=savedEntries(target);
    const raw=JSON.stringify({version:1,createdAt:Date.now(),entries:before});if(byteLength(raw)>maxBytes)fail('Recovery snapshot exceeds the backup limit.');target.setItem(SAVE_IMPORT_JOURNAL_KEY,raw);if(target.getItem(SAVE_IMPORT_JOURNAL_KEY)!==raw)fail('Recovery snapshot could not be verified.');
  }catch(error){return {ok:false,persisted:false,rolledBack:false,error:error.message||'A recovery snapshot could not be saved.'};}
  try{const data=checked.states,entries=Object.entries(keys).filter(([name])=>name!=='school'||data.school!==null).map(([name,key])=>[key,name==='school'?data[name]:JSON.stringify(data[name])]);entries.push(...data.records.map(item=>[item.key,JSON.stringify(item.value)]));replaceEntries(target,entries);releaseJournal(target);
    return {ok:true,persisted:true,rolledBack:false,states:data,summary:checked.summary};
  }catch(error){const recovery=recoverSaveImport({storage:target});return {ok:false,persisted:false,rolledBack:recovery.ok,recoveryRequired:!recovery.ok,error:recovery.ok?'Import failed. Your previous progress was restored.':'Import failed and recovery is still required. Keep this page open and retry recovery.'};}
}
