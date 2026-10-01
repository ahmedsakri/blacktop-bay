import './domain-migration.css';
import {requestSaveTransfer,applySaveTransfer} from './domain-migration.js';
import {NEW_ORIGIN,BACKUP_KEY,needsSaveRecovery,restoreSaveBackup} from '../legacy-host/save-transfer/protocol.js';
const $=id=>document.getElementById(id);
let request=null,pending=null,recoveryLocked=false;
const messages={
  'production-only':'Open this page on camber-reign.web.app to bring your saved progress.',
  'popup-blocked':'Your browser blocked the save window. Allow pop-ups for this site, then try again.',
  'popup-closed':'The save window was closed. Nothing has changed. You can try again.',
  timeout:'The save window timed out. Nothing has changed. Open it again when you are ready.',
  'invalid-transfer':'The previous save could not be verified. Nothing has changed.',
  'invalid-or-unreadable':'Your browser could not read or verify the save. Nothing has changed.',
  empty:'No saved game was found in the previous site for this browser profile.',
  'backup-failed':'Your browser could not back up your current save. Nothing has been replaced.',
  'write-failed-restored':'The browser could not finish saving. Your current progress has been restored.',
  'restore-failed':'The browser blocked part of the save. Your original backup is protected. Download it, then restore it below before trying another transfer.',
  'recovery-required':'An earlier transfer needs recovery. Your original backup is protected. Download it, then restore it below before trying another transfer.',
};
function status(text,error=false){$('transfer-status').textContent=text;$('transfer-status').dataset.error=String(error);}
function idle(){request=null;$('transfer-start').disabled=recoveryLocked;$('transfer-cancel').hidden=true;}
function lockRecovery(){recoveryLocked=true;$('transfer-start').disabled=true;$('transfer-backup').hidden=false;}
function fail(reason){idle();pending=null;$('transfer-confirm').hidden=true;status(messages[reason]||'The save could not be transferred. Please try again.',true);if(reason==='restore-failed'||reason==='recovery-required')lockRecovery();}
function apply(replace=false){
  let storage;
  try{storage=localStorage;}catch{fail('invalid-or-unreadable');return;}
  const result=applySaveTransfer(storage,pending,{replace});
  if(result.reason==='confirmation-required'){
    $('transfer-confirm').hidden=false;$('transfer-start').disabled=true;
    $('transfer-confirm-title').focus();status('Your previous save is ready. Choose which progress to keep.');return;
  }
  if(!result.ok){fail(result.reason);return;}
  pending=null;$('transfer-confirm').hidden=true;$('transfer-start').disabled=true;
  status('Progress transferred. Opening your garage…');window.location.replace('/');
}
$('transfer-start').onclick=()=>{
  if(recoveryLocked)return;
  request?.cancel();pending=null;$('transfer-confirm').hidden=true;$('transfer-backup').hidden=true;
  $('transfer-start').disabled=true;$('transfer-cancel').hidden=false;
  status('In the separate window, choose Send saved progress. Keep this page open.');
  request=requestSaveTransfer({onReceive(entries){idle();pending=entries;apply();},onError:fail});
};
$('transfer-cancel').onclick=()=>{request?.cancel();pending=null;idle();status('Transfer cancelled. Your progress is unchanged.');};
$('transfer-replace').onclick=()=>{if(pending)apply(true);};
$('transfer-keep').onclick=()=>{pending=null;$('transfer-confirm').hidden=true;idle();status('Your current Camber Reign progress is unchanged.');$('transfer-start').focus();};
$('transfer-restore').onclick=()=>{
  if(!recoveryLocked)return;
  let result;try{result=restoreSaveBackup(localStorage);}catch{result={ok:false,reason:'restore-failed'};}
  if(!result.ok){fail(result.reason);lockRecovery();return;}
  recoveryLocked=false;pending=null;$('transfer-backup').hidden=true;idle();
  status('Your original Camber Reign progress has been restored. You can try the transfer again.');$('transfer-start').focus();
};
$('transfer-download').onclick=()=>{
  try{const backup=localStorage.getItem(BACKUP_KEY);if(!backup)throw Error('No backup');
    const url=URL.createObjectURL(new Blob([backup],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='camber-reign-save-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{status('The browser could not read the backup. Keep this page open and check its storage permissions.',true);}
};
window.addEventListener('pagehide',()=>request?.cancel());
if(location.origin!==NEW_ORIGIN){$('transfer-start').disabled=true;status(messages['production-only']);}
else{try{if(needsSaveRecovery(localStorage))fail('recovery-required');}catch{recoveryLocked=true;idle();status(messages['invalid-or-unreadable'],true);}}
