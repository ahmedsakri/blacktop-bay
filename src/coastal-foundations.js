import * as THREE from 'three';
import {projectOnTrack} from './track.js';
import {createSpatialInstances} from './spatial-detail.js';

// Low shoreline shelves close the gap between water and existing scenery.
// Their wider submerged toe stays outside every part of the driving surface.
export function coastalGroundingLayout(track,placements,{padding=9,margin=2}={}){
 return placements.map(item=>{
  const clearance=projectOnTrack(item.x,item.z,undefined,track).distance;
  const radius=Math.min(item.radius+padding,(clearance-track.width/2-margin)/1.12);
  return {x:item.x,z:item.z,y:-1.5,sx:radius,sy:3,sz:radius,ry:item.yaw||0,radius,top:0,bottom:-3,footprintRadius:radius*1.12};
 }).filter(item=>Number.isFinite(item.radius)&&item.radius>0);
}
export function createCoastalGrounding(scene,track,placements){
 const supports=coastalGroundingLayout(track,placements);
 const group=createSpatialInstances(scene,new THREE.CylinderGeometry(1,1.12,1,10),new THREE.MeshStandardMaterial({color:'#586353',roughness:1}),supports,{cellSize:240,distance:520});
 group.name='san-francisco-shore-grounding';group.userData.supports=supports;group.userData.triangles=supports.length*40;group.userData.drawBatches=group.children.length;return group;
}
