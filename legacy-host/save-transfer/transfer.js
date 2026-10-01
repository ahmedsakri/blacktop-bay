import {NEW_ORIGIN,OLD_ORIGIN,TRANSFER_TYPE,validNonce,readSaveEntries} from './protocol.js';
const button=document.getElementById('send-save'),status=document.getElementById('status');
const nonce=new URLSearchParams(location.search).get('nonce');
if(location.origin!==OLD_ORIGIN||!window.opener||!validNonce(nonce)){
  button.disabled=true;status.textContent='Start from Bring your saved progress on Camber Reign, then open this window again.';
}else button.onclick=()=>{
  try{
    const entries=readSaveEntries(localStorage);
    window.opener.postMessage({type:TRANSFER_TYPE,version:1,nonce,entries},NEW_ORIGIN);
    button.disabled=true;status.textContent=entries.length?'Save sent to Camber Reign. Return to that page to finish. Your old save is unchanged.':'No saved game was found in this browser profile. Return to Camber Reign; your progress is unchanged.';
  }catch{status.textContent='This browser could not read the saved game. Check that you are using the same browser profile and that website storage is allowed.';}
};
