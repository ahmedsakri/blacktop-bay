/** Pinned, deterministic no-eval adaptation of Three 0.186.1's Basis glue.
 * The Wasm binary is unchanged. Only embind's two generated JS invokers and
 * legacy global lookup are replaced by closure paths from Emscripten 3.1.51.
 * See public/assets/basis/README.md and EMSCRIPTEN-LICENSE.txt.
 */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),upstream=resolve(root,'node_modules/three/examples/jsm/libs/basis');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const original=await readFile(resolve(upstream,'basis_transcoder.js'),'utf8'),wasm=await readFile(resolve(upstream,'basis_transcoder.wasm'));
if(sha(original)!=='8478b5b6d6b74e7d3082b89f6417321d8d1dc0307f2b30d4484bb11b441696a1'||sha(wasm)!=='6cf17dc889352c42e9acf8897107978d127005fe3386c36a0e3845e27967630a')throw Error('Basis upstream changed: review the no-eval adaptation before generating a new decoder.');
let code=original;
function replaceSpan(start,end,replacement){const a=code.indexOf(start),b=code.indexOf(end,a+start.length);if(a<0||b<0||code.indexOf(start,a+start.length)!==-1)throw Error('Unrecognized Basis glue boundary: '+start);code=code.slice(0,a)+replacement+code.slice(b);}
replaceSpan('function newFunc(', 'var __embind_register_class_constructor=', `
// Adapted from Emscripten 3.1.51 embind.js DYNAMIC_EXECUTION == 0.
function craftInvokerFunction(humanName,argTypes,classType,cppInvokerFunc,cppTargetFunc,isAsync){
 if(isAsync)throwBindingError('Pinned Basis no-eval bindings require synchronous exports.');
 var argCount=argTypes.length;
 if(argCount<2)throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
 var isClassMethodFunc=argTypes[1]!==null&&classType!==null;
 var needsDestructorStack=usesDestructorStack(argTypes),returns=argTypes[0].name!=="void",expectedArgCount=argCount-2;
 var invokerFn=function(){
  if(arguments.length!==expectedArgCount)throwBindingError('function '+humanName+' called with '+arguments.length+' arguments, expected '+expectedArgCount);
  // Invocation-local storage also keeps reentrant bindings independent.
  var argsWired=[],invokerFuncArgs=[cppTargetFunc],destructors=[],thisWired;
  if(isClassMethodFunc){thisWired=argTypes[1].toWireType(destructors,this);invokerFuncArgs.push(thisWired);}
  for(var i=0;i<expectedArgCount;i++){argsWired[i]=argTypes[i+2].toWireType(destructors,arguments[i]);invokerFuncArgs.push(argsWired[i]);}
  var rv=cppInvokerFunc.apply(null,invokerFuncArgs);
  if(needsDestructorStack)runDestructors(destructors);
  else for(var i=isClassMethodFunc?1:2;i<argTypes.length;i++)if(argTypes[i].destructorFunction!==null)argTypes[i].destructorFunction(i===1?thisWired:argsWired[i-2]);
  if(returns)return argTypes[0].fromWireType(rv);
 };
 return createNamedFunction(humanName,invokerFn);
}
`);
replaceSpan('var __emval_get_method_caller=', 'var __emval_get_module_property=', `
// Adapted from Emscripten 3.1.51 emval.js !DYNAMIC_EXECUTION.
var __emval_get_method_caller=(argCount,argTypes,kind)=>{
 var types=emval_lookupTypes(argCount,argTypes),retType=types.shift();argCount--;
 var invokerFunction=(obj,func,destructorsRef,args)=>{
  var argN=[],offset=0;
  for(var i=0;i<argCount;i++){argN[i]=types[i].readValueFromPointer(args+offset);offset+=types[i].argPackAdvance;}
  var rv=kind===1?reflectConstruct(func,argN):func.apply(obj,argN);
  for(var i=0;i<argCount;i++)types[i].deleteObject?.(argN[i]);
  return emval_returnValue(retType,destructorsRef,rv);
 };
 return emval_addMethodCaller(createNamedFunction('methodCaller',invokerFunction));
};
`);
replaceSpan('var emval_get_global=', 'var __emval_get_global=', 'var emval_get_global=()=>globalThis;');
const bridge=`
// KTX2Loader's legacy init waits only for onRuntimeInitialized. Report rejected
// initialization to the owning bounded loader instead of leaving tasks pending.
var basisNoEvalFactory=BASIS;
BASIS=function(options){
 var report=function(error){if(typeof importScripts==='function'&&typeof self?.postMessage==='function')self.postMessage({type:'basis-init-error',error:String(error?.message||error)});};
 try{var promise=basisNoEvalFactory(options);promise.catch(report);return promise;}
 catch(error){report(error);throw error;}
};
`;
code=code.replace("if (typeof exports === 'object' && typeof module === 'object')",bridge+"\nif (typeof exports === 'object' && typeof module === 'object')");
if(code.includes('newFunc(Function')||code.includes('return Function'))throw Error('Unexpected remaining dynamic JavaScript generation');
code='/* Camber Reign no-eval adaptation of pinned Three.js Basis glue. See ../README.md; Apache-2.0, MIT/NCSA notices retained. */\n'+code;
const hash=sha(code),path='/assets/basis/csp-'+hash.slice(0,16)+'/',destination=resolve(root,'public'+path);await mkdir(destination,{recursive:true});
await writeFile(resolve(destination,'basis_transcoder.js'),code);await writeFile(resolve(destination,'basis_transcoder.wasm'),wasm);
await copyFile(resolve(root,'node_modules/three/LICENSE'),resolve(root,'public/assets/basis/THREE-LICENSE.txt'));
const metadata={available:true,path,jsSha256:hash,wasmSha256:sha(wasm),upstreamJsSha256:sha(original),threeVersion:'0.186.1',bindingSource:'emscripten-3.1.51-DYNAMIC_EXECUTION=0'};
await writeFile(resolve(root,'src/basis-transcoder-manifest.js'),'// Generated by scripts/prepare-csp-transcoder.mjs; versioned URLs bypass stale decoder caches.\nexport const BASIS_TRANSCODER=Object.freeze('+JSON.stringify(metadata,null,2)+');\n');
console.log(path);
