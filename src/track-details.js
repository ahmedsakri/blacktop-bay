import {sampleTrack,projectOnTrack} from './track.js';
const wrappedDistance=(a,b,length)=>Math.min((a-b+length)%length,(b-a+length)%length);

// Read real curvature rather than scattering arbitrary corner notices. Distances
// on signs are measured along the arcade route, not claimed real venue scales.
export function cornerApproachMarkers(track,{stands=[],limit=8}={}) {
 const candidates=[];
 for(let s=0;s<track.length;s+=12){
  const before=sampleTrack(s-16,track),after=sampleTrack(s+16,track);
  const bend=Math.atan2(after.tx*before.tz-after.tz*before.tx,after.tx*before.tx+after.tz*before.tz);
  if(Math.abs(bend)>.24)candidates.push({s,bend});
 }
 const selected=[];
 for(const candidate of candidates.sort((a,b)=>Math.abs(b.bend)-Math.abs(a.bend))){
  if(selected.some(other=>wrappedDistance(other.s,candidate.s,track.length)<115))continue;
  selected.push(candidate);if(selected.length>=limit)break;
 }
 const markers=[];
 for(const corner of selected)for(const distance of [100,50]){
  const s=(corner.s-distance+track.length)%track.length,p=sampleTrack(s,track);
  // The outside edge gives a driver a clear approach cue beside the barrier.
  const side=-Math.sign(corner.bend),offset=side*(track.width/2+1.9);
  const x=p.x+p.nx*offset,z=p.z+p.nz*offset;
  if(projectOnTrack(x,z,undefined,track).distance<track.width/2+1.2)continue;
  if(stands.some(stand=>Math.hypot(x-stand.x,z-stand.z)<12))continue;
  if(markers.some(marker=>Math.hypot(x-marker.x,z-marker.z)<8))continue;
  markers.push({x,z,yaw:Math.atan2(p.tx,p.tz)+Math.PI,s,corner:corner.s,distance});
 }
 return markers;
}
