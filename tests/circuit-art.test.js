import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,getTrack} from '../src/track.js';
import {circuitArtGeometry,illustratedCircuitMarkup} from '../src/circuit-art.js';
import {circuitMapMarkup} from '../src/collection-ui.js';

test('illustrations retain each actual circuit shape, headings and the established card footprint',()=>{
 const paths=new Set();
 for(const descriptor of TRACKS){
  const track=getTrack(descriptor.id),geometry=circuitArtGeometry(track);
  assert.equal(circuitArtGeometry(track),geometry);
  assert.equal(geometry.points.length,Math.ceil(track.samples.length/2));
  assert.ok(geometry.points.every(p=>p.x>=20&&p.x<=160&&p.y>=20&&p.y<=160));
  assert.ok(geometry.points.every(p=>[p.x,p.y,p.rotation].every(Number.isFinite)));
  assert.equal(geometry.start.rotation,Number((-Math.atan2(track.samples[0].tx,track.samples[0].tz)*180/Math.PI).toFixed(2)));
  assert.equal(geometry.directions.length,3);
  for(const [index,direction] of geometry.directions.entries())assert.ok(Math.abs(direction.s/track.length-[.22,.52,.78][index])<.006);
  paths.add(geometry.path);
  const markup=circuitMapMarkup(track);assert.ok(markup.includes('viewBox="0 0 180 180"'));assert.ok(markup.includes('aria-hidden="true"'));assert.ok(!markup.includes('<text'));
 }
 assert.equal(paths.size,TRACKS.length,'each preview must use its own actual route');
});

test('asphalt, kerbs, direction markers and checkered gate are self-contained vectors with unique references',()=>{
 const track=getTrack('harbor'),first=illustratedCircuitMarkup(track),second=illustratedCircuitMarkup(track);
 const ids=markup=>[...markup.matchAll(/ id="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(ids(first).length,2);assert.ok(ids(first).every(id=>!ids(second).includes(id)),'hero and card instances cannot collide');
 for(const markup of [first,second]){
  assert.equal([...markup.matchAll(/class="circuit-direction"/g)].length,3);
  assert.ok(markup.includes('class="circuit-start-finish"'));
  for(const match of markup.matchAll(/href="#([^"]+)"/g))assert.ok(ids(markup).includes(match[1]));
  assert.ok(markup.includes('#9246FF')&&markup.includes('#FFF71E'));
  assert.ok(!markup.includes('<image')&&!markup.includes('<script'));
  assert.ok(markup.length<6500,'a whole catalogue remains light enough for mobile');
 }
});
