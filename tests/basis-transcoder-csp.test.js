import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {BASIS_TRANSCODER} from '../src/basis-transcoder-manifest.js';
import {MANUFACTURER_COMPRESSED_ASSETS} from '../src/manufacturer-compressed-manifest.js';
const read=path=>readFile(new URL('../'+path,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function decoder(source,wasm,{strict=true,self,importScripts}={}){
 const context=vm.createContext({console,wasmBytes:new Uint8Array(wasm),self,importScripts},{codeGeneration:{strings:!strict,wasm:true}});
 vm.runInContext(source,context,{filename:'basis_transcoder.js'});
 const module=await vm.runInContext('BASIS({wasmBinary:wasmBytes})',context);module.initializeBasis();return module;
}
function decode(module,image,format){
 const file=new module.KTX2File(new Uint8Array(image));
 try{
  assert.equal(file.isValid(),true);assert.equal(file.startTranscoding(),1);const result=[];
  for(let mip=0;mip<file.getLevels();mip++){
   const bytes=new Uint8Array(file.getImageTranscodedSizeInBytes(mip,0,0,format));
   assert.equal(file.transcodeImage(bytes,mip,0,0,format,0,-1,-1),1);
   result.push({mip,bytes:bytes.length,sha256:sha(bytes)});
  }
  return result;
 }finally{file.close();file.delete();}
}
test('fingerprinted no-eval decoder initializes under strict JS code-generation policy; upstream reproduces the rejected policy',async()=>{
 const original=await read('node_modules/three/examples/jsm/libs/basis/basis_transcoder.js'),js=await read('public'+BASIS_TRANSCODER.path+'basis_transcoder.js'),wasm=await read('public'+BASIS_TRANSCODER.path+'basis_transcoder.wasm');
 assert.equal(sha(original),BASIS_TRANSCODER.upstreamJsSha256);assert.equal(sha(js),BASIS_TRANSCODER.jsSha256);assert.equal(sha(wasm),BASIS_TRANSCODER.wasmSha256);assert.ok(BASIS_TRANSCODER.path.includes(BASIS_TRANSCODER.jsSha256.slice(0,16)));
 await assert.rejects(decoder(original.toString(),wasm),{name:'EvalError'});
 assert.equal(typeof(await decoder(js.toString(),wasm)).KTX2File,'function');
});

test('all 241 shipping KTX2 images decode every ASTC mip identically; each car also exercises all other supported GPU block formats',async()=>{
 const wasm=await read('public'+BASIS_TRANSCODER.path+'basis_transcoder.wasm');
 const original=await decoder((await read('node_modules/three/examples/jsm/libs/basis/basis_transcoder.js')).toString(),wasm,{strict:false});
 const safe=await decoder((await read('public'+BASIS_TRANSCODER.path+'basis_transcoder.js')).toString(),wasm);
 let images=0,mips=0,chains=0;
 // Every embedded image uses the actual strict-CSP decoder. One image per car
 // additionally covers the complete format matrix without multiplying full-catalogue
 // decode work by seven in every release gate. Official Basis formats: ETC1_RGB=0,
 // ETC2_RGBA=1, BC1=2, BC3=3, BC7_M6_OPAQUE=6, BC7_M5=7 (runtime BPTC), ASTC4x4=10.
 for(const asset of Object.values(MANUFACTURER_COMPRESSED_ASSETS)){
  const bytes=await read('public'+asset.path),jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength)),bin=28+jsonLength;
  for(const [imageIndex,image] of gltf.images.entries()){const view=gltf.bufferViews[image.bufferView],ktx=bytes.subarray(bin+(view.byteOffset||0),bin+(view.byteOffset||0)+view.byteLength);images++;
   for(const format of imageIndex===0?[0,1,2,3,6,7,10]:[10]){chains++;const actual=decode(safe,ktx,format),expected=decode(original,ktx,format);assert.deepEqual(actual,expected,asset.path+' image '+images+' format '+format);mips+=actual.length;}
  }
 }
 assert.equal(images,241);assert.equal(chains,241+22*6);assert.ok(mips>3000);console.log('Identical decoded image/format mip chains:',chains,'; mip payloads:',mips);
});

test('actual decoder preserves worker initialization callback and reports rejected Wasm initialization',async()=>{
 const js=(await read('public'+BASIS_TRANSCODER.path+'basis_transcoder.js')).toString(),wasm=await read('public'+BASIS_TRANSCODER.path+'basis_transcoder.wasm');
 const messages=[],worker={location:{href:'https://example.test/assets/decoder.js'},postMessage:message=>messages.push(message)};
 const context=vm.createContext({console:{error(){},warn(){},log(){}},self:worker,importScripts(){},wasmBytes:new Uint8Array(wasm)},{codeGeneration:{strings:false,wasm:true}});
 vm.runInContext(js,context);
 await vm.runInContext('var callbackRan=false;var basisOptions={wasmBinary:wasmBytes,onRuntimeInitialized(){callbackRan=true;}};BASIS(basisOptions)',context);
 assert.equal(vm.runInContext('callbackRan && typeof basisOptions.initializeBasis === "function"',context),true);
 assert.equal(messages.length,0);
 await assert.rejects(vm.runInContext('BASIS({wasmBinary:new Uint8Array([0])})',context),{name:'RuntimeError'});
 assert.equal(messages.length,1);assert.equal(messages[0].type,'basis-init-error');assert.match(messages[0].error,/wasm|WebAssembly|Aborted/i);
});
