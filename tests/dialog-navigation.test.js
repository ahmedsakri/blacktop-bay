import test from 'node:test';
import assert from 'node:assert/strict';
import {createDialogNavigation,trapDialogFocus,dialogFocusable,focusDialogTarget} from '../src/dialog-navigation.js';
function fixture(){
 const document={activeElement:null,querySelector(selector){return this.nodes.get(selector)||null;},nodes:new Map()};
 const element=(id,{inside=false,data=null,visible=true,disabled=false,tabIndex=0}={})=>{
  const item={id,isConnected:true,disabled,tabIndex,inside,hidden:false,attributes:data?[{name:data,value:''}]:[],closest(){return this.inert?{}:null;},getClientRects(){return visible?[{}]:[];},focus(){document.activeElement=this;}};
  if(id)document.nodes.set(`[id="${id}"]`,item);if(data)document.nodes.set(`[${data}=""]`,item);return item;
 };
 const opener=element('settings'),fallback=element('start'),dialog=element('dialog',{inside:true,tabIndex:-1});dialog.ownerDocument=document;dialog.contains=el=>Boolean(el?.inside);dialog.querySelectorAll=()=>dialog.children||[];
 document.activeElement=opener;
 return {document,element,opener,fallback,dialog,nav:createDialogNavigation({document,dialog,fallback})};
}
test('nested dialog replacements preserve the connected external opener',()=>{
 const f=fixture();f.nav.open();const backup=f.element('',{inside:true,data:'data-backup'});f.document.activeElement=backup;f.nav.open();backup.isConnected=false;
 assert.equal(f.nav.close(),true);assert.equal(f.document.activeElement,f.opener);
});
test('Back restores parent markup then resolves the replacement launching control',()=>{
 const f=fixture();f.nav.open();const backup=f.element('',{inside:true,data:'data-backup'});f.document.activeElement=backup;let replacement;
 f.nav.pushParent({restore(){replacement=f.element('',{inside:true,data:'data-backup'});f.nav.open();},focus:backup});f.nav.open();backup.isConnected=false;
 assert.equal(f.nav.back(),true);assert.equal(f.document.activeElement,replacement);assert.equal(f.nav.depth,0);assert.equal(f.nav.back(),false);
 f.nav.close();assert.equal(f.document.activeElement,f.opener);
});
test('close clears parent history and hidden, inert or disconnected openers use a safe fallback',()=>{
 for(const unavailable of ['hidden','inert','disconnected']){const f=fixture();f.nav.open();f.nav.pushParent({restore(){throw Error('stale parent');}});
  if(unavailable==='disconnected')f.opener.isConnected=false;else f.opener[unavailable]=true;
  f.nav.close();assert.equal(f.document.activeElement,f.fallback);assert.equal(f.nav.depth,0);assert.equal(f.nav.back(),false);
 }
});
test('explicit return targets and fresh dialogs do not reuse old openers',()=>{
 const f=fixture();f.nav.open();const target=f.element('campaign');f.nav.setReturnTarget(target);f.nav.close();assert.equal(f.document.activeElement,target);
 f.document.activeElement=f.opener;f.nav.open();f.nav.close();assert.equal(f.document.activeElement,f.opener);
 f.nav.pushParent({restore(){}});f.nav.resetParents();assert.equal(f.nav.depth,0);
});
test('focus trap includes summaries and excludes hidden or disabled controls',()=>{
 const f=fixture(),summary=f.element('summary',{inside:true}),hidden=f.element('hidden',{inside:true,visible:false}),disabled=f.element('disabled',{inside:true,disabled:true}),last=f.element('last',{inside:true});f.dialog.children=[summary,hidden,disabled,last];
 assert.deepEqual(dialogFocusable(f.dialog),[summary,last]);let prevented=0;const event={key:'Tab',shiftKey:true,preventDefault(){prevented++;}};
 f.document.activeElement=summary;assert.equal(trapDialogFocus(event,f.dialog),true);assert.equal(f.document.activeElement,last);
 event.shiftKey=false;trapDialogFocus(event,f.dialog);assert.equal(f.document.activeElement,summary);assert.equal(prevented,2);
});
test('empty dialog traps focus safely and unrelated keys are untouched',()=>{
 const f=fixture();f.dialog.children=[];let prevented=false;assert.equal(trapDialogFocus({key:'Escape',preventDefault(){throw Error('unexpected');}},f.dialog),false);
 assert.equal(trapDialogFocus({key:'Tab',preventDefault(){prevented=true;}},f.dialog),true);assert.equal(prevented,true);assert.equal(f.document.activeElement,f.dialog);
});

test('selector targets work without browser globals and Back opens the containing disclosure',()=>{
 const f=fixture();assert.equal(focusDialogTarget('[id="start"]',{document:f.document}),true);
 f.document.activeElement=f.opener;f.nav.open();const old=f.element('backup',{inside:true});let replacement;const details={open:false,parentElement:null};
 f.nav.pushParent({focus:old,restore(){replacement=f.element('backup',{inside:true});replacement.parentElement={closest(){return details;}};replacement.getClientRects=()=>details.open?[{}]:[];}});
 old.isConnected=false;f.nav.back();assert.equal(details.open,true);assert.equal(f.document.activeElement,replacement);
});
