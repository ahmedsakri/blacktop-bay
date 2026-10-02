import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the actual application orchestration. Fakes control only browser/GPU
// boundaries so interrupted awaits can be reproduced without a physical GPU.
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const start=main.indexOf('function graphicsFailure('),end=main.indexOf('function applyQuality(',start);
assert.ok(start>=0&&end>start);
const source=main.slice(start,end);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function harness({mode='racing',rebuild}={}){
 const events=[],timers=new Map();let nextTimer=0,lost=false;
 const scene={traverse(){}};
 const context=vm.createContext({
  mode,graphicsState:'ready',graphicsGeneration:0,graphicsTimer:null,graphicsReturn:null,graphicsLoader:null,
  currentDialog:null,modalKind:'',racePreparing:false,fleetGeneration:0,fleetPreparation:null,
  lastRendered:1,last:0,document:{hidden:false},performance:{now:()=>1000},lastResultDialog:null,
  console:{warn:()=>events.push('warning')},renderer:{getContext:()=>({isContextLost:()=>lost}),resetState(){events.push('reset-gpu');}},
  world:{scene,rebuildEnvironment:rebuild||(()=>true)},garageStudio:{scene,rebuildEnvironment:()=>true},camera:{},
  setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  pauseGame(){events.push('pause');context.mode='paused';context.currentDialog={kind:'pause'};context.modalKind='pause';},
  pauseSettingsReturn(){events.push('show-pause');context.mode='paused';},
  menu(){context.mode='menu';events.push('menu');},clearInput(){events.push('clear-input');},sound:{setPageActive:value=>events.push(`audio:${value}`)},
  raceTiming:{reset:()=>events.push('reset-clock')},frameBudget:{reset:()=>events.push('reset-budget')},
  dialog(value){context.currentDialog=value;context.modalKind=value.kind;events.push(`dialog:${value.kind}`);},
  closeDialog(){context.currentDialog=null;context.modalKind='';events.push('close-dialog');},
  logoLoaderMarkup:()=>'',bindLogoLoader:()=>({destroy(){events.push('destroy-loader');}}),$:()=>({querySelector(){return {};}}),
  async prepareManufacturerInstances(renderer,models,options){assert.equal(models[0],options.scene);assert.equal(options.camera,context.camera);events.push('prepare');},
  configureManufacturerRenderer(){events.push('configure');},buildComposer(){events.push('build-composer');},applyQuality(){events.push('quality');},
  updateFinish(){},updateTouchControls(){},renderScene(){events.push('render');},toast(){},
  how(){},showPaint(){},showUpgrades(){},showCarDevelopment(){},openCarLibrary(){},showCampaign(){},showRaceSetup(){},privacy(){},showSaveBackup(){},
 });
 vm.runInContext(source,context);
 return {context,events,timers,setLost:value=>lost=value,lose(){context.loseGraphics({preventDefault(){events.push('prevent-loss');}});}};
}

test('graphics loss holds a running race and successful restoration requires explicit resume',async()=>{
 const h=harness();h.lose();assert.equal(h.context.mode,'paused');assert.equal(h.context.graphicsState,'lost');
 assert.ok(h.events.includes('audio:false'));await h.context.restoreGraphics();
 assert.equal(h.context.graphicsState,'ready');assert.equal(h.context.mode,'paused');
 assert.equal(h.events.filter(x=>x==='prepare').length,2);assert.ok(h.events.indexOf('render')>h.events.lastIndexOf('prepare'));
 assert.equal(h.events.filter(x=>x==='show-pause').length,1);assert.ok(h.events.includes('reset-clock'));assert.equal(h.timers.size,0);
});

test('a timed-out restoration cannot replace resources after a newer retry has succeeded',async()=>{
 const gate=deferred();let builds=0;const h=harness({mode:'garage',rebuild:()=>++builds===1?gate.promise:true});
 h.lose();const old=h.context.restoreGraphics();h.context.graphicsFailure();
 assert.equal(h.context.graphicsState,'failed');await h.context.restoreGraphics();
 const committed=h.events.filter(x=>x==='build-composer').length;assert.equal(committed,1);
 gate.resolve(true);await old;
 assert.equal(h.context.graphicsState,'ready');assert.equal(h.context.mode,'garage');
 assert.equal(h.events.filter(x=>x==='build-composer').length,committed);assert.equal(h.events.filter(x=>x==='close-dialog').length,1);
});

test('an obsolete asynchronous error cannot fail a successfully recovered view',async()=>{
 const gate=deferred();let builds=0;const h=harness({rebuild:()=>++builds===1?gate.promise:true});
 h.lose();const old=h.context.restoreGraphics();h.context.graphicsFailure();await h.context.restoreGraphics();
 const errors=h.events.filter(x=>x==='dialog:graphics').length;gate.reject(Error('old context'));await old;
 assert.equal(h.context.graphicsState,'ready');assert.equal(h.events.filter(x=>x==='dialog:graphics').length,errors);assert.equal(h.events.includes('warning'),false);
});

test('a second context loss invalidates the restoring attempt and leaves the recovery view active',async()=>{
 const gate=deferred();const h=harness({rebuild:()=>gate.promise});h.lose();const old=h.context.restoreGraphics();
 const previousGeneration=h.context.graphicsGeneration;h.setLost(true);h.lose();
 assert.ok(h.context.graphicsGeneration>previousGeneration);assert.equal(h.context.graphicsState,'lost');
 gate.resolve(true);await old;
 assert.equal(h.context.graphicsState,'lost');assert.equal(h.events.includes('build-composer'),false);assert.equal(h.events.includes('close-dialog'),false);
});
