import {canUpgradeNitro} from './nitro-system.js';
export const CONTROL_DEFAULTS = Object.freeze({left:'ArrowLeft',right:'ArrowRight',brake:'ArrowDown',drift:'Space',nitro:'ShiftLeft',reset:'KeyR',pause:'Escape'});
export const CONTROL_LABELS = Object.freeze({left:'Steer left',right:'Steer right',brake:'Brake',drift:'Handbrake',nitro:'Nitro',reset:'Reset to road',pause:'Pause'});
export const KEY_OPTIONS = Object.freeze(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ShiftLeft','ShiftRight','Escape',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>'Key'+c),...'0123456789'.split('').map(c=>'Digit'+c)]);
export const keyLabel = code => code === 'Space' ? 'Space' : code === 'ShiftLeft' ? 'Left Shift' : code === 'ShiftRight' ? 'Right Shift' : code.replace(/^Key|^Digit/,'').replace('Arrow','') || code;
const bounded=(v,a,b,d)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):d;
export function normalizePlayerControls(value={}) {
 if(!value||typeof value!=="object")value={};
 const bindings={...CONTROL_DEFAULTS};
 if(value.bindings && typeof value.bindings==='object') {
  const candidate=Object.fromEntries(Object.keys(bindings).map(k=>[k,value.bindings[k]]));
  if(Object.values(candidate).every(c=>KEY_OPTIONS.includes(c)) && new Set(Object.values(candidate)).size===7)Object.assign(bindings,candidate);
 }
 return {bindings,leftHanded:value.leftHanded===true,touchSize:bounded(value.touchSize,.85,1.15,1),touchInset:bounded(value.touchInset,0,36,0),touchLift:bounded(value.touchLift,0,36,0),nitroToggle:value.nitroToggle===true,stableCamera:value.stableCamera===true,motion:['system','reduced','full'].includes(value.motion)?value.motion:'system',showGhost:value.showGhost!==false,stockTrial:value.stockTrial===true,batterySaver:value.batterySaver===true};
}
export function actionForKey(code,controls) {
 if(!KEY_OPTIONS.includes(code))return null;
 const bindings=normalizePlayerControls(controls).bindings;
 const exact=Object.keys(bindings).find(action=>bindings[action]===code);
 if(exact)return exact;
 // Keep familiar alternatives only while their action remains at its default,
 // and never shadow an explicitly remapped action.
 const alias={KeyA:'left',KeyD:'right',KeyS:'brake',ShiftRight:'nitro',KeyP:'pause'}[code];
 return alias && bindings[alias]===CONTROL_DEFAULTS[alias] ? alias : null;
}
export function remapControl(controls,action,code) {
 const next=normalizePlayerControls(controls);
 if(!Object.hasOwn(CONTROL_DEFAULTS,action)||!KEY_OPTIONS.includes(code))return {ok:false,controls:next,error:'Choose a supported key.'};
 const conflict=Object.keys(next.bindings).find(a=>a!==action&&next.bindings[a]===code);
 if(conflict)return {ok:false,controls:next,error:`${keyLabel(code)} is already used for ${CONTROL_LABELS[conflict].toLowerCase()}.`};
 next.bindings[action]=code;return {ok:true,controls:next};
}
// Physical presses remain distinct from the held boost state. A timing press
// upgrades an active normal boost; a later press (or one after a special) stops.
export function createNitroLatch(){let latched=false,held=false,pressId=0;return {
 sample(pressed,toggle,nitro){
  pressed=pressed===true;
  const edge=pressed&&!held;if(edge)pressId++;
  if(!toggle)latched=false;
  else if(edge)latched=latched&&canUpgradeNitro(nitro)?true:!latched;
  held=pressed;return toggle?latched:pressed;
 },
 clear(){latched=false;held=false;},get active(){return latched;},get pressId(){return pressId;}
};}
