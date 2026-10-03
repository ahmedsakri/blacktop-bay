// Offline bone palettes for the instanced medium crowd. Run after the Blender
// geometry exporter. The runtime never needs to build or animate these rigs.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createTexturedSpectator,SPECTATOR_ASSETS} from '../src/realistic-spectator.js';
import {spectatorProfile,spectatorPose} from '../src/crowd.js';
import {CROWD_MOTION} from '../src/medium-spectator.js';

const derived=[],nearFiles=[];
const description=bytes=>{
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 return {triangles:json.meshes.reduce((n,mesh)=>n+mesh.primitives.reduce((sum,p)=>sum+json.accessors[p.indices??p.attributes.POSITION].count/3,0),0),meshDraws:json.meshes.reduce((n,mesh)=>n+mesh.primitives.length,0),joints:json.skins[0].joints.length};
};
const manifest=(file,data,extra={})=>({file,bytes:data.byteLength,sha256:createHash('sha256').update(data).digest('hex'),...extra});
for(const asset of SPECTATOR_ASSETS){
 const filename=new URL(`../public/assets/crowd/${asset.id}-crowd.glb`,import.meta.url);
 const bytes=await readFile(filename),loader=new GLTFLoader();
 const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const character=createTexturedSpectator(scene),skins=[];character.mesh.traverse(object=>{if(object.isSkinnedMesh)skins.push(object);});
 const floats=new Float32Array(CROWD_MOTION.clips*CROWD_MOTION.frames*CROWD_MOTION.bones*16);
 const stride=CROWD_MOTION.bones*16;
 for(let clip=0;clip<CROWD_MOTION.clips;clip++){
  const person={...spectatorProfile(0,0,0,0,clip>=CROWD_MOTION.gestures,()=>.5),...asset,width:1,height:1,phase:0,tempo:1,stance:0,gesture:clip%CROWD_MOTION.gestures};
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
 // Affine bones need three RGBA texels, not four. The shader reconstructs
 // [0,0,0,1], saving 25% of matrix samples and permitting smoother 24-key clips.
 const packed=new Uint16Array(floats.length/16*CROWD_MOTION.matrixElements);
 for(let matrix=0;matrix<floats.length/16;matrix++)for(let row=0;row<3;row++)for(let column=0;column<4;column++)packed[matrix*12+row*4+column]=THREE.DataUtils.toHalfFloat(floats[matrix*16+column*4+row]);
 await writeFile(new URL(`../public/assets/crowd/${asset.id}-motion.bin`,import.meta.url),Buffer.from(packed.buffer));
 const farBytes=await readFile(new URL(`../public/assets/crowd/${asset.id}-far.glb`,import.meta.url));
 for(const [suffix,data] of [['-crowd.glb',bytes],['-far.glb',farBytes],['-motion.bin',Buffer.from(packed.buffer)]])derived.push(manifest(asset.id+suffix,data,suffix.endsWith('.glb')?description(data):{framesPerClip:CROWD_MOTION.frames,clips:CROWD_MOTION.clips,format:'RGBA16F affine bone rows; 3 texels per joint'}));
 const nearBytes=await readFile(new URL(`../public/assets/crowd/${asset.id}.glb`,import.meta.url));nearFiles.push(manifest(asset.id+'.glb',nearBytes,description(nearBytes)));
 character.dispose();console.log(asset.id,packed.byteLength,'bytes of shared motion');
}
const sourceFile=new URL('../public/assets/crowd/SOURCES.json',import.meta.url),sources=JSON.parse(await readFile(sourceFile,'utf8'));
sources.mediumDistance={authorship:'Derived from the same CC0 MakeHuman wardrobe listed above; original Camber Reign cheering motion',geometryScript:'scripts/prepare-medium-spectators.py',motionScript:'scripts/bake-crowd-motion.mjs',texturePolicy:'No additional images; shared original near-character albedo and hair atlases',files:derived};
sources.files=nearFiles;
sources.sourceComponents.body='MakeHuman base human and game_engine skeleton; varied young, middle-aged and older adult macro targets';
sources.sourceComponents.skin=['young_caucasian_male','middleage_african_male','middleage_asian_male','middleage_african_female','old_caucasian_female','young_asian_female'];
sources.sourceComponents.hair=['short01','short02','short04','braid01','bob02','ponytail01'];
sources.sourceComponents.clothes=['male_casualsuit01','male_casualsuit06','male_casualsuit03','male_casualsuit05','female_elegantsuit01','female_sportsuit01'];
await writeFile(sourceFile,JSON.stringify(sources,null,2)+'\n');
