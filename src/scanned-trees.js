import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SCANNED_TREE_VARIANTS} from './scanned-tree-manifest.js';

export const SCANNED_TREE_BUDGET=Object.freeze({mobile:8,desktop:12,mobileDistance:100,desktopDistance:145,mobileFar:64,desktopFar:128,mobileFarDistance:430,desktopFarDistance:620,draws:6});
// Tree Small 02 is a spreading small broadleaf, about 4.8m high with a 3.2m
// crown radius. Tall legacy tree slots must not stretch its branches and leaf
// sprays into columns. Fit within the existing footprint, allowing at most
// about 1.6x vertical exaggeration of the scanned species' proportions.
export const SCANNED_TREE_SHAPE=Object.freeze({maxHeightToRadius:2.35});
function release(root){const geometries=new Set(),materials=new Set(),textures=new Set();root?.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of [o.material].flat()){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures){t.dispose();t.image?.close?.();}}

// Two fixed instanced tiers share reduced scan geometry. Hidden fallback
// instances are compacted out of the draw count, not merely scaled to zero.
export function createScannedTrees(scene,candidates,fallbackGroups,{low=false,load,groundAt,variants=SCANNED_TREE_VARIANTS,shape=SCANNED_TREE_SHAPE,enabled=typeof window!=='undefined',timeoutMs=20000}={}){
 const group=new THREE.Group();group.name='scanned-near-trees';scene.add(group);
 const reference=variants[low?'mobile':'desktop'];
 const placements=new Map();candidates=candidates.map(p=>{
  const y=groundAt?groundAt(p.x,p.z):p.y,limitedHeight=Math.min(p.height,p.radius*(shape.maxHeightToRadius??Infinity)),scale=Math.min(limitedHeight/reference.height,p.radius/reference.radius);
  const height=shape.uniform?reference.height*scale:limitedHeight,radius=shape.uniform?reference.radius*scale:p.radius;
  placements.set(p.treeId,{x:p.x,z:p.z,fromY:p.y,y,heightScale:height/p.height,radiusScale:radius/p.radius});return {...p,y,height,radius};
 });
 const tiers=[{key:low?'mobile':'desktop',capacity:low?SCANNED_TREE_BUDGET.mobile:SCANNED_TREE_BUDGET.desktop,distance:low?SCANNED_TREE_BUDGET.mobileDistance:SCANNED_TREE_BUDGET.desktopDistance,meshes:[]},{key:low?'mobileFar':'desktopFar',capacity:low?SCANNED_TREE_BUDGET.mobileFar:SCANNED_TREE_BUDGET.desktopFar,distance:low?SCANNED_TREE_BUDGET.mobileFarDistance:SCANNED_TREE_BUDGET.desktopFarDistance,meshes:[]}];
 for(const tier of tiers){tier.variant=variants[tier.key];tier.url='/assets/environments/trees/'+tier.variant.file+'?v='+tier.variant.sha256;}
 const status={state:enabled&&candidates.length?'loading':'disabled',capacity:tiers[0].capacity,farCapacity:tiers[1].capacity,candidates:candidates.length,forestCandidates:candidates.filter(p=>p.treeId>=10000&&p.treeId<20000).length,visible:0,farVisible:0,draws:0,triangles:0,url:tiers[0].url,farUrl:tiers[1].url},fallbacks=[],dummy=new THREE.Object3D();
 for(const fallback of fallbackGroups)fallback?.traverse(mesh=>{if(!mesh.isInstancedMesh)return;const items=[];for(const [index,id]of (mesh.userData.treeIds||[]).entries()){
  const matrix=new THREE.Matrix4();mesh.getMatrixAt(index,matrix);const placement=placements.get(id);
  if(placement){const e=matrix.elements;for(const axis of [1,5,9])e[axis]*=placement.heightScale;e[13]=placement.y+(e[13]-placement.fromY)*placement.heightScale;
   for(const axis of [0,2,4,6,8,10])e[axis]*=placement.radiusScale;e[12]=placement.x+(e[12]-placement.x)*placement.radiusScale;e[14]=placement.z+(e[14]-placement.z)*placement.radiusScale;
  }
  mesh.setMatrixAt(index,matrix);items.push({id,matrix});
 }if(items.length){mesh.instanceMatrix.needsUpdate=true;
  // Terrain and species fitting move vertices beyond the original spatial
  // bounds. Cache the complete fitted population before selection compacts it;
  // retain these conservative bounds when hidden trees are later restored.
  mesh.computeBoundingBox();mesh.computeBoundingSphere();fallbacks.push({mesh,items});
 }});
 const controller=new AbortController(),roots=new Set(),releasedRoots=new WeakSet();const free=root=>{if(root&&!releasedRoots.has(root)){releasedRoots.add(root);release(root);}};let disposed=false,next=0,selected=new Set(),nearSelected=new Set(),lastPosition=null;
 const fallbackSelection=hidden=>{for(const {mesh,items}of fallbacks){let count=0;for(const item of items)if(!hidden.has(item.id))mesh.setMatrixAt(count++,item.matrix);mesh.count=count;mesh.instanceMatrix.needsUpdate=true;}};
 const select=(time,position,force=false)=>{
  if(disposed||status.state!=='ready'||!position||!force&&time<next)return;next=time+.22;lastPosition=position;
  const ranked=candidates.map(p=>({p,d:Math.hypot(p.x-position.x,p.z-position.z)})).filter(e=>e.d<tiers[1].distance+8).sort((a,b)=>a.d-b.d),near=ranked.filter(e=>e.d<tiers[0].distance+(nearSelected.has(e.p.treeId)?8:0)).sort((a,b)=>(a.d-(nearSelected.has(a.p.treeId)?6:0))-(b.d-(nearSelected.has(b.p.treeId)?6:0))).slice(0,tiers[0].capacity).map(e=>e.p);
  nearSelected=new Set(near.map(p=>p.treeId));const far=ranked.filter(e=>!nearSelected.has(e.p.treeId)&&e.d<tiers[1].distance+(selected.has(e.p.treeId)?8:0)).slice(0,tiers[1].capacity).map(e=>e.p);
  selected=new Set([...near,...far].map(p=>p.treeId));fallbackSelection(selected);
  for(const [i,tier]of tiers.entries()){
   const chosen=i?far:near,v=tier.variant;
   chosen.forEach((p,index)=>{let sy=p.height/v.height,sr=p.radius/v.radius;if(shape.uniform)sy=sr=Math.min(sy,sr);dummy.position.set(p.x,p.y-v.minY*sy,p.z);dummy.rotation.set(0,p.yaw||0,0);dummy.scale.set(sr,sy,sr);dummy.updateMatrix();for(const mesh of tier.meshes)mesh.setMatrixAt(index,dummy.matrix);});
   for(const mesh of tier.meshes){mesh.count=chosen.length;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.visible=chosen.length>0;}
  }
  status.visible=near.length;status.farVisible=far.length;status.triangles=near.length*tiers[0].variant.triangles+far.length*tiers[1].variant.triangles;
 };
 let timer,settleReady=()=>{};
 const ready=status.state==='disabled'?Promise.resolve(false):new Promise(resolve=>{
  let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};settleReady=finish;
  const abandon=()=>{for(const root of roots)free(root);roots.clear();};
  timer=setTimeout(()=>{status.state='fallback';controller.abort();abandon();finish(false);},timeoutMs);timer.unref?.();
  const loader=load||(async(url,{signal})=>{const response=await fetch(url,{signal});if(!response.ok)throw Error('Tree asset unavailable');return new GLTFLoader().parseAsync(await response.arrayBuffer(),'/assets/environments/trees/');});
  Promise.all(tiers.map(tier=>Promise.resolve().then(()=>loader(tier.url,{signal:controller.signal})).then(result=>{const source=result.scene||result;if(disposed||settled){free(source);return null;}roots.add(source);return source;}))).then(sources=>{
   if(disposed||settled)return;
   for(const [i,source]of sources.entries()){const tier=tiers[i];source.updateMatrixWorld(true);source.traverse(o=>{if(!o.isMesh)return;const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),material=o.material.clone();material.roughness=Math.max(.86,material.roughness);material.envMapIntensity=.12;
    if(material.map)material.map.anisotropy=i?2:4;const mesh=new THREE.InstancedMesh(geometry,material,tier.capacity);mesh.name=o.name;mesh.count=0;mesh.castShadow=false;mesh.receiveShadow=true;mesh.visible=false;group.add(mesh);tier.meshes.push(mesh);
   });}
   status.state='ready';status.draws=group.children.length;if(lastPosition)select(0,lastPosition,true);finish(true);
  }).catch(()=>{if(!disposed)status.state='fallback';controller.abort();abandon();finish(false);});
 });
 return {group,status,ready,update(time,position){lastPosition=position;select(time,position);},dispose(){if(disposed)return;disposed=true;controller.abort();clearTimeout(timer);settleReady(false);fallbackSelection(new Set());for(const tier of tiers)for(const mesh of tier.meshes){mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();}group.removeFromParent();for(const root of roots)free(root);roots.clear();status.state='disposed';status.visible=0;status.farVisible=0;}};
}
