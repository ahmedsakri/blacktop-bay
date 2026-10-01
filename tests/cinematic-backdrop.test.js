import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {BACKDROP_FAMILIES, backdropSource, createCinematicBackdrop} from '../src/cinematic-backdrop.js';
import {TRACKS, getTrack} from '../src/track.js';
import {getVenueProfile} from '../src/world.js';

function textureFixture() {
  const calls = {disposed:0, closed:0};
  return {calls, texture:{dispose(){ calls.disposed++; }, image:{close(){ calls.closed++; }}}};
}

test('every circuit receives matching scenery without adding waterfront art to inland venues', () => {
  const found = new Set();
  for (const item of TRACKS) {
    const track = getTrack(item.id), venue = getVenueProfile(track);
    const desktop = backdropSource(track, venue), mobile = backdropSource(track, venue, {low:true});
    found.add(desktop.family);
    if (!venue.water) assert.notEqual(desktop.family,'coastal',track.name);
    if (venue.environment === 'desert') assert.equal(desktop.family,'desert');
    if (venue.environment === 'urban') assert.equal(desktop.family,'urban');
    assert.equal(desktop.family,mobile.family);
    assert.equal(mobile.maxWidth,1024); assert.equal(desktop.maxWidth,2048);
    assert.match(mobile.url, /-mobile\.webp\?v=/);
    assert.ok(desktop.horizonV > .3 && desktop.horizonV < .51);
  }
  assert.deepEqual([...found].sort(), [...BACKDROP_FAMILIES].sort());
  assert.equal(backdropSource(getTrack('summit'),getVenueProfile(getTrack('summit'))).family,'alpine');
});

test('a successfully loaded image fades in without owning scene lighting or requiring a blocking load', async () => {
  const {texture,calls} = textureFixture();
  const backdrop=createCinematicBackdrop({venue:{water:true},loadTexture:async()=>texture});
  assert.equal(backdrop.status.state,'loading');
  assert.equal(backdrop.uniforms.cinematicAmount.value,0);
  assert.equal(await backdrop.ready,true);
  assert.equal(backdrop.status.state,'ready');
  backdrop.update(10); assert.equal(backdrop.uniforms.cinematicAmount.value,0);
  backdrop.update(10.625); assert.equal(backdrop.uniforms.cinematicAmount.value,.5);
  backdrop.update(11.25); assert.equal(backdrop.uniforms.cinematicAmount.value,1);
  backdrop.update(20); assert.equal(backdrop.uniforms.cinematicAmount.value,1);
  backdrop.dispose();backdrop.dispose();
  assert.deepEqual(calls,{disposed:1,closed:1});
  assert.equal(backdrop.uniforms.cinematicMap.value,null);
  assert.equal(backdrop.status.state,'disposed');
});

test('reduced motion shows the loaded image immediately', async () => {
  const {texture}=textureFixture();
  const backdrop=createCinematicBackdrop({reducedMotion:true,loadTexture:async()=>texture});
  await backdrop.ready;
  assert.equal(backdrop.uniforms.cinematicAmount.value,1);
  backdrop.update(0);assert.equal(backdrop.uniforms.cinematicAmount.value,1);
  backdrop.dispose();
});

test('image failure retains the procedural sky and resolves without rejecting race startup', async () => {
  const backdrop=createCinematicBackdrop({loadTexture:async()=>{throw new Error('connection interrupted');}});
  assert.equal(await backdrop.ready,false);
  assert.equal(backdrop.status.state,'fallback');
  backdrop.update(200);
  assert.equal(backdrop.uniforms.cinematicAmount.value,0);
  assert.equal(backdrop.uniforms.cinematicMap.value,null);
  backdrop.dispose();
});

test('disposing during loading aborts the request and frees a late decoded image exactly once', async () => {
  const {texture,calls}=textureFixture();let resolve,signal;
  const backdrop=createCinematicBackdrop({loadTexture:(_url,options)=>{signal=options.signal;return new Promise(done=>{resolve=done;});}});
  await Promise.resolve();backdrop.dispose();
  assert.equal(signal.aborted,true);
  resolve(texture);assert.equal(await backdrop.ready,false);
  backdrop.dispose();backdrop.update(200);
  assert.deepEqual(calls,{disposed:1,closed:1});
  assert.equal(backdrop.status.state,'disposed');
  assert.equal(backdrop.uniforms.cinematicMap.value,null);
});

test('all original panorama variants ship locally with verified hashes and bounded phone texture memory', async () => {
  const base=new URL('../public/assets/environments/',import.meta.url);
  const provenance=JSON.parse(await fs.readFile(new URL('provenance.json',base),'utf8'));
  assert.deepEqual(Object.keys(provenance.families).sort(),[...BACKDROP_FAMILIES].sort());
  for (const family of BACKDROP_FAMILIES) for (const detail of ['desktop','mobile']) {
    const entry=provenance.families[family][detail];
    const file=await fs.readFile(new URL(`${family}${detail==='mobile'?'-mobile':''}.webp`,base));
    assert.equal(file.toString('ascii',8,12),'WEBP');
    assert.equal(file.length,entry.bytes);
    assert.equal(createHash('sha256').update(file).digest('hex'),entry.sha256);
    assert.equal(entry.width/entry.height,2);
    assert.ok(entry.bytes < (detail==='mobile'?150_000:450_000));
    assert.ok(entry.width <= (detail==='mobile'?1024:2048));
    // Exactly one 1024x512 RGBA image plus mip chain stays below 3 MB.
    if (detail==='mobile') assert.ok(entry.width*entry.height*4*4/3 < 3_000_000);
  }
});
