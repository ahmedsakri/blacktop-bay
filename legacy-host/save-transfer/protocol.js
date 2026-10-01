// Shared by the former-origin popup and the new game's receiver. No analytics,
// cookies or unrelated browser storage is part of this transfer protocol.
export const OLD_ORIGIN = 'https://blacktop-bay.web.app';
export const NEW_ORIGIN = 'https://camber-reign.web.app';
export const TRANSFER_TYPE = 'camber-reign-save-transfer';
export const BACKUP_KEY = 'camber-reign-save-backup-v1';
export const TRANSFER_KEYS = Object.freeze([
  'blacktop-bay-choices-v1', 'blacktop-bay-progression-v1',
  'blacktop-bay-paint-v1', 'blacktop-bay-favorites-v1', 'blacktop-bay-career-v1',
]);
export const RECORD_PREFIX = 'appsoverflow-coastal-racer-v1';
export const LIMITS = Object.freeze({entries:512, bytes:4_000_000, valueBytes:2_000_000, depth:24, nodes:300_000});
const encoder = new TextEncoder();
export const validNonce = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
export function isTransferKey(key) {
  return typeof key === 'string' && key.length <= 180 &&
    (TRANSFER_KEYS.includes(key) || key === RECORD_PREFIX ||
      (key.startsWith(RECORD_PREFIX + '-') && /^[a-z0-9-]+$/.test(key)));
}
function safeJSON(value, key) {
  const data = JSON.parse(value);
  if (!data || typeof data !== 'object' || (Array.isArray(data) !== (key === 'blacktop-bay-favorites-v1'))) throw Error('Invalid saved data');
  const queue = [[data, 0]]; let count = 0;
  while (queue.length) {
    const [item, depth] = queue.pop();
    if (++count > LIMITS.nodes || depth > LIMITS.depth) throw Error('Saved data is too complex');
    if (item && typeof item === 'object') for (const [name, nested] of Object.entries(item)) {
      if (['__proto__','prototype','constructor'].includes(name)) throw Error('Invalid saved data');
      queue.push([nested, depth + 1]);
    }
  }
  return data;
}
export function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length > LIMITS.entries) throw Error('Too many saved items');
  const seen = new Set(); let bytes = 0;
  return entries.map(pair => {
    if (!Array.isArray(pair) || pair.length !== 2) throw Error('Invalid saved item');
    const [key, value] = pair;
    if (!isTransferKey(key) || seen.has(key) || typeof value !== 'string') throw Error('Unrecognised saved item');
    seen.add(key);
    const size = encoder.encode(value).length;
    bytes += size + encoder.encode(key).length;
    if (size > LIMITS.valueBytes || bytes > LIMITS.bytes) throw Error('Saved progress is too large to transfer safely');
    safeJSON(value, key);
    return [key, value];
  });
}
export function readSaveEntries(storage) {
  const entries = [];
  if (!storage || !Number.isSafeInteger(storage.length) || storage.length > 10000) throw Error('Browser storage is unavailable');
  for (let index=0; index<storage.length; index++) {
    const key = storage.key(index);
    if (isTransferKey(key)) {
      const value = storage.getItem(key);
      if (value !== null) entries.push([key, value]);
    }
  }
  return validateEntries(entries);
}
export function validateTransfer(message, expectedNonce) {
  if (!validNonce(expectedNonce) || !message || typeof message !== 'object' || Array.isArray(message) ||
      Object.keys(message).length !== 4 ||
      message.type !== TRANSFER_TYPE || message.version !== 1 || message.nonce !== expectedNonce) throw Error('Invalid save transfer');
  return validateEntries(message.entries);
}
export function hasMeaningfulProgress(entries) {
  return validateEntries(entries).some(([key, text]) => {
    const data = JSON.parse(text);
    if (key === 'blacktop-bay-choices-v1') return false;
    if (key === 'blacktop-bay-favorites-v1') return data.length > 0;
    if (key === 'blacktop-bay-progression-v1') return (Number.isFinite(data.credits) && data.credits !== 1200) ||
      Boolean(data.awardedRaces?.length) || Object.values(data.cars || {}).some(levels => Object.values(levels || {}).some(level => Number.isFinite(level) && level > 0));
    if (key === 'blacktop-bay-paint-v1') return Object.values(data).some(paint => paint &&
      ((typeof paint.color === 'string' && paint.color !== 'factory') || (typeof paint.finish === 'string' && paint.finish !== 'gloss')));
    if (key === 'blacktop-bay-career-v1') return Boolean(Object.keys(data.records || {}).length || data.recordedRaces?.length || data.completedTours || data.activeTour || data.lastTour);
    return Boolean((Number.isFinite(data.bestTime) && data.bestTime > 0) || data.bestScore > 0 || data.ghost?.length);
  });
}

function readBackup(storage) {
  const raw=storage.getItem(BACKUP_KEY);
  if(raw===null)return null;
  if(typeof raw!=='string'||encoder.encode(raw).length>LIMITS.bytes*2+524288)throw Error('Invalid backup');
  const backup=JSON.parse(raw);
  if(!backup||backup.version!==1||!Number.isFinite(backup.createdAt)||
      (backup.recoveryRequired!==undefined&&typeof backup.recoveryRequired!=='boolean'))throw Error('Invalid backup');
  return {...backup,entries:validateEntries(backup.entries)};
}
export function needsSaveRecovery(storage) { return readBackup(storage)?.recoveryRequired===true; }
function writeBackup(storage,backup) {
  const raw=JSON.stringify(backup);
  storage.setItem(BACKUP_KEY,raw);
  if(storage.getItem(BACKUP_KEY)!==raw)throw Error('Backup verification failed');
}
function replaceEntries(storage,entries) {
  const keys=[];
  if(!Number.isSafeInteger(storage.length)||storage.length>10000)throw Error('Browser storage is unavailable');
  for(let index=0;index<storage.length;index++){
    const key=storage.key(index);if(isTransferKey(key))keys.push(key);
  }
  for(const key of keys)storage.removeItem(key);
  for(const [key,value]of entries)storage.setItem(key,value);
  const expected=new Map(entries);
  for(const [key,value]of entries)if(storage.getItem(key)!==value)throw Error('Save verification failed');
  for(const key of keys)if(!expected.has(key)&&storage.getItem(key)!==null)throw Error('Save replacement failed');
}
export function restoreSaveBackup(storage) {
  let backup;
  try{backup=readBackup(storage);if(!backup?.recoveryRequired)return {ok:false,reason:'no-recovery-needed'};}
  catch{return {ok:false,reason:'invalid-or-unreadable'};}
  try{
    replaceEntries(storage,backup.entries);
    // Release the durable lock only after the original save is fully verified.
    writeBackup(storage,{...backup,recoveryRequired:false});
    return {ok:true,backupKey:BACKUP_KEY};
  }catch{return {ok:false,reason:'restore-failed',backupKey:BACKUP_KEY};}
}
export function applySaveTransfer(storage, incoming, {replace=false, now=Date.now()}={}) {
  let entries, before;
  try {
    // A failed import's only intact snapshot must survive retries and reloads.
    if(needsSaveRecovery(storage))return {ok:false,reason:'recovery-required',backupKey:BACKUP_KEY};
    entries=validateEntries(incoming);before=readSaveEntries(storage);
  }catch{return {ok:false,reason:'invalid-or-unreadable'};}
  if(!entries.length)return {ok:false,reason:'empty'};
  if(hasMeaningfulProgress(before)&&!replace)return {ok:false,reason:'confirmation-required'};
  const backup={version:1,createdAt:now,entries:before,recoveryRequired:true};
  // Persist the recovery lock before touching any existing game values. It also
  // protects the snapshot if this page closes halfway through an import.
  try{writeBackup(storage,backup);}
  catch{return {ok:false,reason:'backup-failed'};}
  try{
    replaceEntries(storage,entries);
    writeBackup(storage,{...backup,recoveryRequired:false});
    return {ok:true,count:entries.length,backupKey:BACKUP_KEY};
  }catch{
    const restored=restoreSaveBackup(storage);
    return {ok:false,reason:restored.ok?'write-failed-restored':'restore-failed',backupKey:BACKUP_KEY};
  }
}
