import * as THREE from 'three';
import {SPECTATOR_ASSETS} from './realistic-spectator.js';

// Shared, offline-baked human motion. Only these small palettes and the reduced
// geometry are additional downloads: body/hair materials reuse the near atlases.
export const MEDIUM_CROWD_BUDGET=Object.freeze({mobile:48,desktop:108,mobileDistance:48,desktopDistance:68,maxTriangles:2600,maxDraws:18,maxGeometryBytes:420000});
export const CROWD_MOTION=Object.freeze({frames:16,clips:10,bones:53,duration:4.2});
const transform=new THREE.Object3D(),tint=new THREE.Color();
// Multipliers preserve the source fabric's shading. Skin/hair/eyes are masked
// out by an offline-authored vertex attribute, including on neutral shirts.
const CLOTH_TINTS=['#ffffff','#9aadb5','#a1b5a1','#b39ea9','#87989e','#b6af9c','#a3b3b0','#999ead'];

export function crowdMotionFrame(person,time){
 const frame=((time*(person.tempo||1)+(person.phase||0))%CROWD_MOTION.duration)/CROWD_MOTION.duration*(CROWD_MOTION.frames-1);
 const clip=(person.seated?5:0)+person.gesture,first=Math.floor(frame);
 return [clip*CROWD_MOTION.frames+first,clip*CROWD_MOTION.frames+Math.min(first+1,CROWD_MOTION.frames-1),frame-first];
}

function materialForCrowd(source,texture,bindMatrix,bindMatrixInverse){
 const material=source.clone();material.userData={...source.userData,instancedHuman:true};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{crowdPoseData:{value:texture},crowdBind:{value:bindMatrix},crowdBindInverse:{value:bindMatrixInverse}});
  shader.vertexShader=`attribute vec4 crowdJoints; attribute vec4 crowdWeights; attribute vec3 crowdFrames;
attribute float crowdGarment; varying float vCrowdGarment;
uniform sampler2D crowdPoseData; uniform mat4 crowdBind; uniform mat4 crowdBindInverse;
mat4 crowdBone(float joint,float row){
 float x=(joint*4.0+0.5)/212.0; float y=(row+0.5)/160.0;
 return mat4(texture2D(crowdPoseData,vec2(x,y)),texture2D(crowdPoseData,vec2(x+1.0/212.0,y)),texture2D(crowdPoseData,vec2(x+2.0/212.0,y)),texture2D(crowdPoseData,vec2(x+3.0/212.0,y)));
}
mat4 crowdBlend(float joint){return crowdBone(joint,crowdFrames.x)*(1.0-crowdFrames.z)+crowdBone(joint,crowdFrames.y)*crowdFrames.z;}
`+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <skinbase_vertex>',`mat4 crowdSkin=crowdBindInverse*(crowdBlend(crowdJoints.x)*crowdWeights.x+crowdBlend(crowdJoints.y)*crowdWeights.y+crowdBlend(crowdJoints.z)*crowdWeights.z+crowdBlend(crowdJoints.w)*crowdWeights.w)*crowdBind;`);
  shader.vertexShader=shader.vertexShader.replace('#include <skinnormal_vertex>','objectNormal=mat3(crowdSkin)*objectNormal;');
  shader.vertexShader=shader.vertexShader.replace('#include <skinning_vertex>','transformed=(crowdSkin*vec4(transformed,1.0)).xyz;');
  shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\nvCrowdGarment=crowdGarment;');
  shader.fragmentShader='varying float vCrowdGarment;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#ifdef USE_INSTANCING_COLOR
diffuseColor.rgb*=mix(vec3(1.0),vColor.rgb,clamp(vCrowdGarment,0.0,1.0));
#endif`);
 };
 material.customProgramCacheKey=()=> 'camber-instanced-human-v2';
 return material;
}

export function createMediumVariant(source,geometrySource,palette,{capacity=MEDIUM_CROWD_BUDGET.mobile}={}){
 const expected=CROWD_MOTION.frames*CROWD_MOTION.clips*CROWD_MOTION.bones*16;
 if(palette.length!==expected)throw new Error('Invalid crowd motion palette');
 const texture=new THREE.DataTexture(palette,212,160,THREE.RGBAFormat,THREE.HalfFloatType);
 texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 const materialKey=name=>name.replace(/\.\d{3}$/,'');
 const sourceMaterials=new Map();source.traverse(object=>{if(object.isMesh)for(const material of [object.material].flat())sourceMaterials.set(materialKey(material.name),material);});
 const meshes=[];let disposed=false;
 geometrySource.updateMatrixWorld(true);
 try{geometrySource.traverse(object=>{
  if(!object.isSkinnedMesh)return;
  const original=sourceMaterials.get(materialKey(object.material.name));
  if(!original)throw new Error(`Missing original crowd material: ${object.material.name}`);
  const geometry=object.geometry.clone();geometry.setAttribute('crowdJoints',geometry.attributes.skinIndex);geometry.setAttribute('crowdWeights',geometry.attributes.skinWeight);
  geometry.setAttribute('crowdGarment',geometry.attributes._crowd_garment||new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count),1));geometry.deleteAttribute('_crowd_garment');
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
  geometry.setAttribute('crowdFrames',new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage));
  const material=materialForCrowd(original,texture,object.bindMatrix.clone(),object.bindMatrixInverse.clone());
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name='race-spectators-textured-medium';mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);meshes.push(mesh);
 });}catch(error){for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}texture.dispose();throw error;}
 return {meshes,texture,capacity,
  update(people,time){
   if(disposed)return;
   for(const mesh of meshes){mesh.count=Math.min(people.length,capacity);const frames=mesh.geometry.attributes.crowdFrames;
    for(let i=0;i<mesh.count;i++){
     const person=people[i];transform.position.set(person.x,person.floor,person.z);transform.rotation.set(0,person.yaw,0);transform.scale.set(person.height*person.width,person.height,person.height);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
     frames.setXYZ(i,...crowdMotionFrame(person,time));
     mesh.setColorAt(i,tint.set(CLOTH_TINTS[Math.floor(person.phase*11.37)%CLOTH_TINTS.length]));
    }
    mesh.instanceMatrix.needsUpdate=true;frames.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   }
  },
  dispose(){if(disposed)return;disposed=true;for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}texture.dispose();},
 };
}

/** Fixed capacity, no per-person Object3D, skeleton, texture or network request.
 * Every visible medium person is rendered once in three wardrobe batches. */
export function createMediumCrowd({low=false,library,enabled=typeof window!=='undefined',loadPalette}={}){
 const variants=new Map(),controllers=new Set();let disposed=false,scene=null,revision=0,active=0;
 const limit=low?MEDIUM_CROWD_BUDGET.mobile:MEDIUM_CROWD_BUDGET.desktop;
 const load=loadPalette||(async(index,signal)=>{const response=await fetch(`/assets/crowd/${SPECTATOR_ASSETS[index].id}-motion.bin`,{signal});if(!response.ok)throw new Error('Crowd motion download failed');return new Uint16Array(await response.arrayBuffer());});
 async function prepare(){
  if(!enabled||!library?.getMedium)return;
  // Sequential variants also keep allocation/decoding off the initial race frame.
  for(let index=0;index<SPECTATOR_ASSETS.length&&!disposed;index++){
   const controller=new AbortController();controllers.add(controller);let timer,onAbort;
   try{
    const [source,geometrySource]=await Promise.all([library.get(index),library.getMedium(index)]);
    if(!source||!geometrySource||disposed)continue;
    const cancelled=new Promise((_,reject)=>{onAbort=()=>reject(new Error('Crowd motion cancelled'));controller.signal.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>controller.abort(),12000);timer.unref?.();});
    const palette=await Promise.race([load(index,controller.signal),cancelled]);
    if(disposed)break;
    const variant=createMediumVariant(source,geometrySource,palette,{capacity:limit});variants.set(index,variant);if(scene)for(const mesh of variant.meshes)scene.add(mesh);revision++;
   }catch{/* Keep the existing distant representation when any asset is missing. */}
   finally{clearTimeout(timer);if(onAbort)controller.signal.removeEventListener('abort',onAbort);controllers.delete(controller);}
  }
 }
 let ready=Promise.resolve(),started=false;
 return {get ready(){return ready;},get revision(){return revision;},get active(){return active;},get drawCalls(){return [...variants.values()].reduce((n,v)=>n+v.meshes.filter(mesh=>mesh.count>0).length,0);},
  render(target){scene=target;for(const variant of variants.values())for(const mesh of variant.meshes)scene.add(mesh);if(!started){started=true;ready=prepare();}},
  select(people){return people.filter(person=>!person.authoredCharacter&&person.role!=='marshal'&&person.inRange&&variants.has(person.lookVariant)&&person.viewDistance<(low?MEDIUM_CROWD_BUDGET.mobileDistance:MEDIUM_CROWD_BUDGET.desktopDistance)).sort((a,b)=>(a.viewDistance-(a.mediumCharacter?2:0))-(b.viewDistance-(b.mediumCharacter?2:0))).slice(0,limit);},
  update(people,time){active=people.length;for(const [index,variant] of variants)variant.update(people.filter(person=>person.lookVariant===index),time);},
  dispose(){if(disposed)return;disposed=true;for(const controller of controllers)controller.abort();for(const variant of variants.values())variant.dispose();variants.clear();active=0;},
 };
}
