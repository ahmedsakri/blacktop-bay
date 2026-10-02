import {CAREER_KEY} from './race-career.js';
export const TOUR_TRANSACTION_KEY = 'camber-reign-tour-transaction-v1';
const CHOICES_KEY = 'blacktop-bay-choices-v1';
const allowed = [CAREER_KEY, CHOICES_KEY];
const verifyWrite = (storage, key, value) => {
  if (value === null) storage.removeItem(key); else storage.setItem(key, value);
  if ((storage.getItem(key) ?? null) !== value) throw Error('Save verification failed.');
};
function readJournal(storage) {
  const raw = storage?.getItem(TOUR_TRANSACTION_KEY);
  if (raw == null) return null;
  if (typeof raw !== 'string' || raw.length > 4_000_000) throw Error('Tour recovery data is invalid.');
  const journal = JSON.parse(raw);
  if (journal.version !== 1 || !Array.isArray(journal.before) || journal.before.length !== 2 ||
    journal.before.some((entry, i) => !Array.isArray(entry) || entry.length !== 2 || entry[0] !== allowed[i] || entry[1] !== null && typeof entry[1] !== 'string')) throw Error('Tour recovery data is invalid.');
  return journal;
}
export function recoverTourAdvance(storage,{knownJournal=false}={}) {
  if(!storage&&knownJournal)return {ok:false,recoveryRequired:true,storageUnavailable:true};
  // Denied storage alone still permits a session. A journal that was actually
  // read is different: mixed tour/choice values must be repaired before loading.
  try { if (storage?.getItem(TOUR_TRANSACTION_KEY) == null) return {ok:true,recovered:false}; }
  catch { return {ok:!knownJournal,recovered:false,recoveryRequired:knownJournal,storageUnavailable:true}; }
  let journal;
  try { journal = readJournal(storage); }
  catch { return {ok: false, recoveryRequired: true}; }
  if (!journal) return {ok: true, recovered: false};
  try {
    for (const [key, value] of journal.before) if ((storage.getItem(key) ?? null) !== value) verifyWrite(storage, key, value);
    verifyWrite(storage, TOUR_TRANSACTION_KEY, null);
    return {ok: true, recovered: true};
  } catch { return {ok: false, recoveryRequired: true}; }
}
export function commitTourAdvance(storage, {career, preferences}) {
  let attemptedJournal=false;
  try {
    if (!storage || readJournal(storage)) return {ok: false, recoveryRequired: Boolean(storage)};
    const before = allowed.map(key => [key, storage.getItem(key) ?? null]);
    attemptedJournal=true;
    verifyWrite(storage, TOUR_TRANSACTION_KEY, JSON.stringify({version: 1, before}));
  } catch {
    const recovery=recoverTourAdvance(storage,{knownJournal:attemptedJournal});
    return {ok: false, recoveryRequired: !recovery.ok};
  }
  try {
    verifyWrite(storage, CAREER_KEY, JSON.stringify(career));
    verifyWrite(storage, CHOICES_KEY, JSON.stringify(preferences));
    verifyWrite(storage, TOUR_TRANSACTION_KEY, null);
    return {ok: true};
  } catch {
    const recovery = recoverTourAdvance(storage,{knownJournal:true});
    return {ok: false, recoveryRequired: !recovery.ok};
  }
}
