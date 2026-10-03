import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStudioEnvironment, prepareStudioRadiance, STUDIO_HDR } from '../src/studio-environment.js';

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

test('studio shoulder preserves paint-lighting midtones and hue without clipping bright sources',()=>{
  const data=new Float32Array([.3,.6,.9,1, 100,200,300,1]);
  const hdr=prepareStudioRadiance({data,width:2,height:1,type:THREE.FloatType});
  assert.equal(hdr.data,data,'desktop preparation does not allocate another image');
  for(const [i,expected] of [.3,.6,.9].entries())assert.ok(Math.abs(data[i]-expected)<1e-6);
  assert.ok(Math.abs(data[5]/data[4]-2)<1e-6);assert.ok(Math.abs(data[6]/data[4]-3)<1e-6);
  const luminance=data[4]*.2126+data[5]*.7152+data[6]*.0722;
  assert.ok(luminance>3&&luminance<12,'photographic detail stays HDR, within the soft shoulder');
});

test('mobile studio source is limited to 512×256 with linear-light averaging and half-float ownership',()=>{
  const data=new Uint16Array(1024*512*4);
  for(let i=0;i<data.length;i+=4){data[i]=THREE.DataUtils.toHalfFloat((i/4)%2?.8:.4);data[i+1]=data[i+2]=THREE.DataUtils.toHalfFloat(.5);data[i+3]=THREE.DataUtils.toHalfFloat(1);}
  const hdr=prepareStudioRadiance({data,width:1024,height:512,type:THREE.HalfFloatType},{low:true});
  assert.equal(hdr.width,512);assert.equal(hdr.height,256);assert.equal(hdr.data.byteLength,1024*1024);
  assert.notEqual(hdr.data,data);assert.ok(Math.abs(THREE.DataUtils.fromHalfFloat(hdr.data[0])-.6)<.001);
  assert.ok(Math.abs(THREE.DataUtils.fromHalfFloat(data[0])-.4)<.001,'downsampling leaves the decoder source alone');
  assert.throws(()=>prepareStudioRadiance({data:new Uint16Array(0),width:2048,height:1024,type:THREE.HalfFloatType}),/decoded budget/);
});

test('context loss retains the decoded photograph and working fallback until restoration can replace it',async()=>{
  let lost=false,disposed=0;
  const texture={dispose(){disposed++;}},targets=[],scene={userData:{}};
  const studio=createStudioEnvironment({},scene,{}, {
    fetch:async()=>{lost=true;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};},
    parse:()=>texture,
    build(photo){if(lost)return null;const target={texture:{photo},dispose(){this.disposed=true;}};targets.push(target);return target;},
  });
  assert.equal(await studio.ready,true);assert.equal(scene.environment,targets[0].texture);assert.equal(scene.userData.studioLighting,'fallback');
  lost=false;assert.equal(studio.rebuild(),true);assert.equal(scene.environment.photo,texture);assert.equal(targets[0].disposed,true);
  studio.dispose();assert.equal(disposed,1);
});
