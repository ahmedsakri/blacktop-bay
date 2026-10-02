import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioEnvironment, STUDIO_HDR } from '../src/studio-environment.js';

function fixture(fetch) {
  const targets=[], parsed=[];
  const scene={userData:{}};
  const studio=createStudioEnvironment({},scene,{}, {
    fetch,
    parse(){const texture={disposed:0,dispose(){this.disposed++;}};parsed.push(texture);return texture;},
    build(photo){const target={texture:{photo},disposed:0,dispose(){this.disposed++;}};targets.push(target);return target;},
  });
  return {studio,scene,targets,parsed};
}
test('photographic studio upgrades the fallback and owns each render target through restoration/disposal',async()=>{
  const f=fixture(async(url)=>{assert.equal(url,STUDIO_HDR);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(16)};});
  assert.equal(f.scene.userData.studioLighting,'fallback');
  assert.equal(await f.studio.ready,true);assert.equal(f.scene.userData.studioLighting,'photographic');
  assert.equal(f.targets[0].disposed,1);assert.equal(f.scene.environment,f.targets[1].texture);
  assert.equal(f.studio.rebuild(),true);assert.equal(f.targets[1].disposed,1);
  f.studio.dispose();f.studio.dispose();
  assert.equal(f.scene.environment,null);assert.equal(f.targets[2].disposed,1);assert.equal(f.parsed[0].disposed,1);
  assert.equal(f.studio.rebuild(),false);
});
test('network failure retains a usable studio with no rejected loading promise',async()=>{
  const f=fixture(async()=>{throw new Error('offline');});
  assert.equal(await f.studio.ready,false);assert.equal(f.scene.environment,f.targets[0].texture);
  assert.equal(f.scene.userData.studioLighting,'fallback');f.studio.dispose();
});
test('late download cannot resurrect a disposed studio',async()=>{
  let resolve;const pending=new Promise(r=>{resolve=r;});
  const f=fixture(()=>pending);f.studio.dispose();
  resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)});
  assert.equal(await f.studio.ready,false);assert.equal(f.parsed.length,0);assert.equal(f.targets.length,1);
});
test('oversized studio download is not decoded into GPU memory',async()=>{
  const f=fixture(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(3*1024*1024)}));
  assert.equal(await f.studio.ready,false);assert.equal(f.parsed.length,0);f.studio.dispose();
});
