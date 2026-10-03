// Offline bone palettes for the instanced medium crowd. Run after the Blender
// geometry exporter. The runtime never needs to build or animate these rigs.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createTexturedSpectator,SPECTATOR_ASSETS} from '../src/realistic-spectator.js';
import {spectatorProfile,spectatorPose} from '../src/crowd.js';
import {CROWD_MOTION} from '../src/medium-spectator.js';

const derived=[];
for(const asset of SPECTATOR_ASSETS){
 const filename=new URL(`../public/assets/crowd/${asset.id}-crowd.glb`,import.meta.url);
 const bytes=await readFile(filename),loader=new GLTFLoader();
 const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const character=createTexturedSpectator(scene),skins=[];character.mesh.traverse(object=>{if(object.isSkinnedMesh)skins.push(object);});
 const floats=new Float32Array(CROWD_MOTION.clips*CROWD_MOTION.frames*CROWD_MOTION.bones*16);
 const stride=CROWD_MOTION.bones*16;
 for(let clip=0;clip<CROWD_MOTION.clips;clip++){
  const person={...spectatorProfile(0,0,0,0,clip>=5,()=>.5),width:1,height:1,phase:0,tempo:1,stance:0,gesture:clip%5};
  for(let frame=0;frame<CROWD_MOTION.frames;frame++){
   const time=frame/(CROWD_MOTION.frames-1)*CROWD_MOTION.duration;
   const activity=THREE.MathUtils.smoothstep(Math.sin(time/CROWD_MOTION.duration*Math.PI*2),-.15,.65)*.92;
   character.update(person,spectatorPose(person,time,activity));
   const skeleton=skins[0].skeleton;if(skeleton.bones.length!==CROWD_MOTION.bones)throw new Error('Rig joint count changed');
   // All material primitives must use the same palette ordering.
   for(const skin of skins)if(skin.skeleton.bones.some((bone,i)=>bone.name!==skeleton.bones[i].name))throw new Error('Inconsistent crowd skeleton');
   floats.set(skeleton.boneMatrices,(clip*CROWD_MOTION.frames+frame)*stride);
  }
  // A soft final recovery closes each loop exactly, preventing a visible pop.
  const first=clip*CROWD_MOTION.frames*stride;
  for(let frame=CROWD_MOTION.frames-3;frame<CROWD_MOTION.frames;frame++){
   const blend=THREE.MathUtils.smoothstep((frame-(CROWD_MOTION.frames-4))/3,0,1),offset=first+frame*stride;
   for(let i=0;i<stride;i++)floats[offset+i]+=(floats[first+i]-floats[offset+i])*blend;
  }
  floats.set(floats.subarray(first,first+stride),first+(CROWD_MOTION.frames-1)*stride);
 }
 if(!floats.every(Number.isFinite))throw new Error('Non-finite crowd animation');
 const packed=Uint16Array.from(floats,THREE.DataUtils.toHalfFloat);
 await writeFile(new URL(`../public/assets/crowd/${asset.id}-motion.bin`,import.meta.url),Buffer.from(packed.buffer));
 const triangles=skins.reduce((sum,skin)=>sum+skin.geometry.index.count/3,0);
 for(const [suffix,data] of [['-crowd.glb',bytes],['-motion.bin',Buffer.from(packed.buffer)]])derived.push({file:asset.id+suffix,bytes:data.byteLength,sha256:createHash('sha256').update(data).digest('hex'),...(suffix.endsWith('.glb')?{triangles,meshDraws:skins.length,joints:CROWD_MOTION.bones}:{framesPerClip:CROWD_MOTION.frames,clips:CROWD_MOTION.clips,format:'RGBA16F bone matrices'})});
 character.dispose();console.log(asset.id,packed.byteLength,'bytes of shared motion');
}
const sourceFile=new URL('../public/assets/crowd/SOURCES.json',import.meta.url),sources=JSON.parse(await readFile(sourceFile,'utf8'));
sources.mediumDistance={authorship:'Derived from the same CC0 MakeHuman wardrobe listed above; original Camber Reign cheering motion',geometryScript:'scripts/prepare-medium-spectators.py',motionScript:'scripts/bake-crowd-motion.mjs',texturePolicy:'No additional images; shared original near-character albedo and hair atlases',files:derived};
await writeFile(sourceFile,JSON.stringify(sources,null,2)+'\n');
