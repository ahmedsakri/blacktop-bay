import * as THREE from 'three';

// Spatial batches retain every authored instance. Bounds let Three cull whole
// sectors, while distance culling removes genuinely invisible detail work.
// Road surfaces, collision geometry and silhouette landmarks are never culled.
export function partitionInstances(list,cellSize=120){
 const buckets=new Map();
 for(const item of list){const key=`${Math.floor(item.x/cellSize)}:${Math.floor(item.z/cellSize)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item);}
 return [...buckets.values()];
}
export function createSpatialInstances(parent,geometry,material,list,{cellSize=120,distance=410,partitionThreshold=48}={}){
 const root=new THREE.Group();root.name='spatial-scenery';parent.add(root);
 const dummy=new THREE.Object3D(),color=new THREE.Color();
 const buckets=list.length>=partitionThreshold?partitionInstances(list,cellSize):[list];
 for(const items of buckets){
  if(!items.length)continue;
  const mesh=new THREE.InstancedMesh(geometry,material,items.length);
  items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx||0,p.ry||0,p.rz||0,p.order||'XYZ');dummy.scale.set(p.sx??1,p.sy??1,p.sz??1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(p.color)mesh.setColorAt(i,color.set(p.color));});
  if(items.some(p=>p.treeId!==undefined))mesh.userData.treeIds=items.map(p=>p.treeId);
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();
  // A high tower or mountain should remain on the skyline at every quality.
  // Tag short roadside detail only; retain tall geometry and local subgroups.
  if(parent.isScene&&items.every(p=>(p.sy??1)<22))mesh.userData.distanceDetail={distance,instances:items.length};
  root.add(mesh);
 }
 // Keep unused resources attached so normal world disposal can release them.
 if(!list.length){const empty=new THREE.InstancedMesh(geometry,material,0);empty.visible=false;root.add(empty);}
 return root;
}
export function createDistanceDetail(scene,{low=false}={}){
 const batches=[];scene.updateMatrixWorld(true);
 scene.traverse(mesh=>{if(!mesh.userData.distanceDetail)return;
  mesh.geometry.computeBoundingSphere();const sphere=(mesh.isInstancedMesh?mesh.boundingSphere:mesh.geometry.boundingSphere).clone().applyMatrix4(mesh.matrixWorld);
  batches.push({mesh,sphere,base:mesh.userData.distanceDetail.distance,instances:mesh.userData.distanceDetail.instances||1});
 });
 const stats={batches:batches.length,visibleBatches:batches.length,totalInstances:batches.reduce((n,b)=>n+b.instances,0),visibleInstances:0,distanceScale:low?.8:1.2};
 let next=0;
 return {stats,setQuality(settings){stats.distanceScale=Math.max(.4,Math.min(1.5,settings?.detailDistanceScale??(low?.8:1.2)));next=0;},
  update(time,position){if(!position||time<next)return;next=time+.2;let visible=0,instances=0;
   for(const {mesh,sphere,base,instances:count}of batches){const distance=Math.hypot(position.x-sphere.center.x,position.z-sphere.center.z)-sphere.radius;
    const threshold=base*stats.distanceScale+(mesh.visible?24:0);mesh.visible=distance<=threshold;if(mesh.visible){visible++;instances+=count;}}
   stats.visibleBatches=visible;stats.visibleInstances=instances;
  },
 };
}
