import {OLD_ORIGIN,NEW_ORIGIN,TRANSFER_TYPE,validNonce,validateTransfer} from '../legacy-host/save-transfer/protocol.js';
export {applySaveTransfer,hasMeaningfulProgress,readSaveEntries} from '../legacy-host/save-transfer/protocol.js';

// The popup stays a first-party page at the old origin, so mobile browsers do
// not partition its storage as they can with an embedded third-party iframe.
export function requestSaveTransfer({browser=window, onReceive, onError, timeoutMs=180000}={}) {
  if(browser.location.origin!==NEW_ORIGIN){onError?.('production-only');return {cancel(){}};}
  const nonce=Array.from(browser.crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  if(!validNonce(nonce))throw Error('Secure transfer is unavailable');
  let popup=null,active=true,timeout=null,closed=null;
  function stop(){
    if(!active)return;active=false;
    browser.removeEventListener('message',receive);
    browser.clearTimeout(timeout);browser.clearInterval(closed);
    try{popup?.close();}catch{}
  }
  function fail(reason){stop();onError?.(reason);}
  function receive(event){
    if(!active||event.origin!==OLD_ORIGIN||event.source!==popup||event.data?.type!==TRANSFER_TYPE||event.data?.nonce!==nonce)return;
    try{const entries=validateTransfer(event.data,nonce);stop();onReceive?.(entries);}
    catch{fail('invalid-transfer');}
  }
  browser.addEventListener('message',receive);
  try{popup=browser.open(`${OLD_ORIGIN}/save-transfer/?nonce=${nonce}`,'camber-reign-save-transfer','popup,width=620,height=720');}
  catch{fail('popup-blocked');return {cancel:stop};}
  if(!popup){fail('popup-blocked');return {cancel:stop};}
  timeout=browser.setTimeout(()=>fail('timeout'),timeoutMs);
  closed=browser.setInterval(()=>{if(popup.closed)fail('popup-closed');},500);
  return {cancel:stop};
}
