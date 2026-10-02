import * as T from 'three';
import {createGarage} from '/src/garage.js';
import {MANUFACTURER_ASSETS} from '/src/manufacturer-asset-manifest.js';
import {MANUFACTURER_COMPRESSED_ASSETS} from '/src/manufacturer-compressed-manifest.js';
import {configureManufacturerRenderer,prepareManufacturerCar,createManufacturerCar,prepareManufacturerInstances,manufacturerCacheStatus} from '/src/manufacturer-car.js';
const $=id=>document.getElementById(id),rows=[],errors=[];
window.catalogueAudit={rows,errors,complete:false};
addEventListener('error',event=>errors.push(event.message));addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(600,360);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;$('stage').append(renderer.domElement);
const garage=createGarage(renderer,{low:true}),camera=new T.PerspectiveCamera(40,600/360,.1,80),capability=configureManufacturerRenderer(renderer,{camera,scene:garage.scene});window.catalogueAudit.capability=capability;
const cards=[];
const show=()=>cards.forEach((card,index)=>card.hidden=Math.floor(index/12)!==Number($('group').value));$('group').onchange=show;
try{
 for(const [id,asset]of Object.entries(MANUFACTURER_ASSETS)){
  $('state').textContent=`Rendering ${rows.length+1}/33 · ${asset.brand} ${asset.model}`;let car;
  try{
   await prepareManufacturerCar(id,{low:true});car=createManufacturerCar({assetId:id,low:true});garage.scene.add(car.group);car.group.position.y=.06;
   await prepareManufacturerInstances(renderer,[car],{camera,scene:garage.scene});car.update({time:0,paused:true,reducedMotion:true});
   const box=new T.Box3().setFromObject(car.group),size=box.getSize(new T.Vector3()),materials=new Set(),textures=new Set();
   car.group.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
   const row={id,name:asset.brand+' '+asset.model,size:size.toArray(),paintSlots:[...materials].filter(m=>m.userData.bodyPaint).length,textures:textures.size,compressedTextures:[...textures].filter(t=>t.isCompressedTexture).length,expectedCompressed:Boolean(MANUFACTURER_COMPRESSED_ASSETS[id]),images:[],cache:manufacturerCacheStatus()};
   if(row.expectedCompressed&&capability.gpuCompressed&&!row.compressedTextures)throw new Error(id+' expected real compressed texture objects');
   if(!row.paintSlots||size.toArray().some(v=>!Number.isFinite(v)||v<=0))throw new Error(id+' invalid body/paint bounds');
   for(const angle of [1,-1]){camera.position.set(angle*5,2.35,angle*6.5);camera.lookAt(0,.72,0);renderer.render(garage.scene,camera);if(renderer.getContext().getError()!==0)throw new Error(id+' WebGL error');row.images.push(renderer.domElement.toDataURL('image/jpeg',.90));}
   const card=document.createElement('article');card.className='car';const title=document.createElement('h2');title.textContent=`${rows.length+1}. ${row.name}`;const images=document.createElement('div');images.className='images';for(const [index,src]of row.images.entries()){const image=document.createElement('img');image.src=src;image.alt=row.name+(index?' rear inspection':' front inspection');images.append(image);}const note=document.createElement('p');note.textContent=`${row.compressedTextures} GPU maps · ${row.paintSlots} paint slots · ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m`;card.append(title,images,note);cards.push(card);$('gallery').append(card);rows.push(row);show();
  }catch(error){errors.push(id+': '+String(error));}finally{car?.dispose();}
  await new Promise(resolve=>setTimeout(resolve,40));
 }
 window.catalogueAudit.complete=true;window.catalogueAudit.finalCache=manufacturerCacheStatus();window.catalogueAudit.memory=renderer.info.memory;
 $('state').textContent=`Complete · ${rows.length}/33 rendered · ${errors.length} errors · ${rows.filter(r=>r.compressedTextures).length}/22 textured cars used GPU compression`;
 $('summary').textContent=JSON.stringify({errors,finalCache:window.catalogueAudit.finalCache,rendererMemory:renderer.info.memory},null,2);
}catch(error){errors.push(String(error));$('state').textContent='Audit failed: '+error;}
addEventListener('pagehide',()=>{garage.disposeEnvironment();renderer.dispose();});
