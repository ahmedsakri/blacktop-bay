import test from 'node:test';
import assert from 'node:assert/strict';
import {broadleafCrownGeometry,coniferBoughGeometry} from '../src/vegetation-geometry.js';

test('richer shared foliage stays inside scenery placement footprints and bounds phone geometry',()=>{
 for(const make of [broadleafCrownGeometry,coniferBoughGeometry]){
  const low=make({low:true}),full=make();
  assert.ok(low.attributes.position.count<full.attributes.position.count);
  assert.ok(full.attributes.position.count<7000);
  for(const geometry of [low,full]){const p=geometry.attributes.position;
   assert.ok([...p.array].every(Number.isFinite));assert.equal(geometry.attributes.color.count,p.count);
   for(let i=0;i<p.count;i++)assert.ok(Math.hypot(p.getX(i),p.getZ(i))<=1.00001);
   geometry.dispose();
  }
 }
});
