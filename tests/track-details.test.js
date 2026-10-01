import test from 'node:test';
import assert from 'node:assert/strict';
import {getTrack,TRACKS,projectOnTrack} from '../src/track.js';
import {cornerApproachMarkers} from '../src/track-details.js';
import {grandstandLayout} from '../src/world.js';

test('corner distance boards are bounded, honest to route distance and clear of road and spectator seating',()=>{
 let routesWithMarkers=0;
 for(const descriptor of TRACKS){
  const track=getTrack(descriptor.id),stands=grandstandLayout(track),markers=cornerApproachMarkers(track,{stands,limit:6});
  if(markers.length)routesWithMarkers++;
  assert.ok(markers.length<=12);
  for(const marker of markers){
   assert.ok([marker.x,marker.z,marker.yaw,marker.s].every(Number.isFinite));
   assert.ok(Math.abs((marker.corner-marker.s+track.length)%track.length-marker.distance)<1e-6);
   assert.ok(projectOnTrack(marker.x,marker.z,undefined,track).distance>=track.width/2+1.2);
   assert.ok(stands.every(stand=>Math.hypot(stand.x-marker.x,stand.z-marker.z)>=12));
  }
  assert.deepEqual(markers,cornerApproachMarkers(track,{stands,limit:6}));
 }
 assert.ok(routesWithMarkers>TRACKS.length*.8,'most routes have identifiable approach cues');
});
