import * as THREE from 'three';

// Original Camber Reign character asset. A single indexed, articulated mesh per
// nearby spectator, authored as anatomical cross-sections, not stacked objects.
// All 18 joints share one draw and one material. This asset has no external art.
export const CHARACTER_LIMITS=Object.freeze({mobile:6,desktop:10,mobileDistance:18,desktopDistance:25,maxTriangles:8500});
const B={torso:0,head:1,neck:2,hip:3,leftUpper:4,leftLower:5,leftHand:6,rightUpper:7,rightLower:8,rightHand:9,leftThigh:10,leftShin:11,leftFoot:12,rightThigh:13,rightShin:14,rightFoot:15,phone:16,cap:17};
const TAU=Math.PI*2, up=new THREE.Vector3(0,1,0), direction=new THREE.Vector3();
const colorCache=new Map();
function tint(hex,factor=1){if(!colorCache.has(hex))colorCache.set(hex,new THREE.Color(hex));const result=colorCache.get(hex).clone().multiplyScalar(factor);result.paletteHex=hex;result.paletteFactor=factor;return result;}

/** The authored mesh contains shoulder/hip shaping, contiguous tapered limbs,
 * cheekbones, eye sockets, nasal bridge, ears, lips, individual fingers, garment
 * folds and trainer soles. Vertex colour supplies skin/clothes; no network asset. */
export function createSpectatorCharacterGeometry(person,{low=false}={}){
 const positions=[],colors=[],indices=[],bones=[],weights=[],mouth=[],blink=[],palette=[];
 const segments=low?16:24;
 const vertex=(p,bone,c,expression={})=>{
  positions.push(...p);colors.push(c.r,c.g,c.b);palette.push([person.shirt,person.skin,person.pants,person.hair,person.shoe].indexOf(c.paletteHex)+1,c.paletteFactor||1);bones.push(bone,0,0,0);weights.push(1,0,0,0);
  mouth.push(0,expression.mouthY||0,expression.mouthZ||0);blink.push(0,expression.blinkY||0,0);return positions.length/3-1;
 };
 // Loft cross-sections around Y. An optional sculptor reshapes surface vertices
 // and selects surface colour without creating extra objects/draw calls.
 function loft(rings,bone,base,{sides=segments,shape,offset=[0,0,0]}={}){
  const start=positions.length/3;
  rings.forEach(([y,rx,rz],row)=>{
   for(let i=0;i<=sides;i++){
    const angle=i/sides*TAU;let p=[Math.sin(angle)*rx,y,Math.cos(angle)*rz];
    const data=shape?.(p,angle,row)||{};p=data.p||p;
    vertex(p.map((v,j)=>v+offset[j]),bone,data.color||base,data);
   }
  });
  for(let row=0;row<rings.length-1;row++)for(let i=0;i<sides;i++){
   const a=start+row*(sides+1)+i,b=a+sides+1;
   indices.push(a,a+1,b,a+1,b+1,b);
  }
 }
 function patch(center,scale,bone,base,{sides=10,rows=6,expression}={}){
  const rings=Array.from({length:rows+1},(_,i)=>{const t=i/rows*Math.PI;return [Math.cos(t)*scale[1],Math.sin(t)*scale[0],Math.sin(t)*scale[2]];});
  // Reverse so outward face orientation matches bottom-to-top lofts.
  rings.reverse();loft(rings,bone,base,{sides,offset:center,shape:(p)=>expression?.(p)||{}});
 }
 const shirt=tint(person.shirt),skin=tint(person.skin),pants=tint(person.pants),hair=tint(person.hair),shoe=tint(person.shoe||'#41454c');
 const shirtFold=(p,a,row)=>{
  const fold=(Math.sin(a*9+p[1]*43)*.0016+Math.sin(a*5-p[1]*17)*.0012)*(p[1]<.12?1.9:1);
  p[0]+=Math.sin(a)*fold;p[2]+=Math.cos(a)*fold;
  const front=Math.max(0,Math.cos(a)),chest=Math.exp(-(((p[1]-.35)/.12)**2));
  p[2]+=front*chest*.016;
  const stripe=person.garment===2&&p[1]>.26&&p[1]<.32;
  const placket=person.garment===1&&Math.abs(p[0])<.009&&p[2]>0;
  return {p,color:tint(person.shirt,stripe?1.32:placket?.57:1+fold*35)};
 };
 loft([[0,.145,.105],[.018,.165,.111],[.06,.169,.108],[.12,.159,.098],[.21,.159,.101],[.29,.168,.108],[.37,.184,.118],[.43,.205,.111],[.48,.211,.089],[.51,.176,.083],[.54,.102,.064],[.55,.056,.054]],B.torso,shirt,{shape:shirtFold});
 // Collar edge follows the actual neck opening, with a narrow contrasting seam.
 loft([[.544,.057,.055],[.551,.059,.056],[.559,.058,.054]],B.torso,tint(person.shirt,.64));
 loft([[0,.053,.050],[.08,.048,.044],[.105,.063,.05]],B.neck,skin,{sides:16});
 loft([[-.07,.145,.101],[0,.163,.108],[.09,.161,.096]],B.hip,pants,{shape:(p,a)=>({p,color:tint(person.pants,1+Math.cos(a*10)*.035)})});
 // Front (+Z) facial sculpting includes orbital depressions and a continuous
 // bridge/tip instead of the former small spheres glued to a spherical skull.
 const headRings=[[-.137,.015,.025],[-.12,.049,.055],[-.098,.069,.073],[-.074,.080,.083],[-.045,.088,.094],[-.017,.091,.100],[.012,.094,.100],[.035,.095,.098],[.058,.095,.096],[.085,.094,.091],[.11,.084,.077],[.132,.057,.052],[.145,.005,.007]];
 loft(headRings,B.head,skin,{sides:low?24:36,shape:(p,a)=>{
  const front=Math.max(0,Math.cos(a)),x=p[0],y=p[1];
  const nose=Math.exp(-((x/.016)**2))*Math.exp(-(((y+.012)/.038)**2))*.034;
  const bridge=Math.exp(-((x/.011)**2))*Math.exp(-(((y-.017)/.045)**2))*.012;
  const sockets=Math.exp(-(((Math.abs(x)-.036)/.018)**2))*Math.exp(-(((y-.027)/.016)**2))*.012;
  const cheek=Math.exp(-(((Math.abs(x)-.055)/.025)**2))*Math.exp(-(((y+.022)/.027)**2))*.009;
  p[2]+=(nose+bridge-sockets+cheek)*front**5;
  const lips=Math.exp(-((x/.03)**4))*Math.exp(-(((y+.068)/.009)**2));
  p[2]+=lips*.004;
  return {p,color:lips>.40?tint(person.skin,.72):tint(person.skin,1-.055*(1-front)+cheek*2),mouthY:y<-.05?-.010*Math.exp(-(((y+.082)/.038)**2)):0};
 }});
 // Almond eye lenses, inset dark irises, brows, lips and eyelids share the head
 // joint. Blinking and cheering morphs remain independent of head movement.
 for(const side of [-1,1]){
  patch([side*.036,.027,.091],[.016,.006,.004],B.head,tint('#b7ae9b'),{expression:p=>({blinkY:-p[1]*.94})});
  patch([side*.036,.026,.096],[.006,.005,.0017],B.head,tint('#302e29'),{sides:8,rows:4,expression:p=>({blinkY:-p[1]*.97})});
  patch([side*.036,.046,.090],[.020,.003,.004],B.head,hair,{sides:8,rows:4});
  // Ear rim with a dark concha rather than the former large knobs.
  patch([side*.095,-.014,-.006],[.010,.028,.016],B.head,skin,{sides:8});
  patch([side*.101,-.015,.006],[.004,.016,.006],B.head,tint(person.skin,.65),{sides:8,rows:4});
 }
 patch([0,-.068,.088],[.024,.0038,.004],B.head,tint('#53352f'),{rows:4,expression:p=>({mouthY:p[1]<0?-.018:.004,mouthZ:.004})});
 patch([0,-.065,.093],[.017,.001,.0015],B.head,tint('#cfc5b6'),{rows:4,expression:p=>({mouthY:.002})});
 // A hairline-cut scalp surface. Hair is a fitted mesh with combed ridges.
 const hs=low?20:28,hr=8,start=positions.length/3;
 for(let row=0;row<=hr;row++)for(let i=0;i<=hs;i++){
  const a=i/hs*TAU,front=Math.max(0,Math.cos(a)),rear=Math.max(0,-Math.cos(a));
  const end=Math.acos(.15+front*.47-rear*.50),t=end*row/hr;
  const wave=Math.sin(a*13+t*7)*.0013;
  vertex([Math.sin(a)*(Math.sin(t)*.098+wave),Math.cos(t)*.148+.005,Math.cos(a)*(Math.sin(t)*.104+wave)-.004],B.head,tint(person.hair,1+Math.sin(a*11+t*8)*.07));
 }
 for(let r=0;r<hr;r++)for(let i=0;i<hs;i++){const a=start+r*(hs+1)+i,b=a+hs+1;indices.push(a,b,a+1,a+1,b,b+1);}
 if(person.longHair)loft([[-.235,.058,.020],[-.18,.091,.036],[-.10,.101,.040],[-.045,.098,.042]],B.head,hair,{offset:[0,0,-.081],sides:16,shape:(p,a)=>{p[2]+=Math.sin(a*13+p[1]*18)*.002;return{p};}});
 if(person.cap){
  patch([0,.112,-.007],[.10,.058,.112],B.head,tint(person.shirt,.7),{sides:16,rows:6});
  patch([0,.078,.104],[.096,.009,.074],B.head,tint(person.shirt,.8),{sides:16,rows:4});
 }
 if(person.sunglasses)for(const side of [-1,1])patch([side*.035,.027,.103],[.024,.014,.005],B.head,tint('#28313a'),{sides:12,rows:6});
 for(const side of [-1,1]){
  const left=side<0,upper=left?B.leftUpper:B.rightUpper,lower=left?B.leftLower:B.rightLower,hand=left?B.leftHand:B.rightHand;
  // Limbs are authored along +Y then oriented between the exact solved joints.
  loft([[0,.058,.060],[.03,.062,.063],[.07,.057,.057],[.12,.052,.054],[.19,.044,.044],[.26,.036,.037],[.285,.035,.035]],upper,skin,{sides:16});
  const sleeveLength=person.garment===1?.277:.156;
  loft([[0,.065,.070],[.025,.071,.072],[.08,.065,.064],[sleeveLength-.012,.058,.056],[sleeveLength,.060,.057]],upper,shirt,{sides:16,shape:(p,a)=>({p,color:tint(person.shirt,1+Math.sin(a*7+p[1]*40)*.035)})});
  loft([[0,.037,.036],[.025,.040,.038],[.075,.043,.039],[.13,.036,.033],[.20,.027,.025],[.265,.025,.020]],lower,person.garment===1?shirt:skin,{sides:16});
  // Sculpted palm and five tapered fingers are all part of the same skinned draw.
  loft([[-.022,.022,.014],[0,.030,.020],[.030,.034,.017],[.060,.029,.013],[.069,.023,.009]],hand,skin,{sides:12});
  for(let finger=0;finger<4;finger++){
   const fx=(finger-1.5)*.015,length=.055-Math.abs(finger-1.5)*.008;
   loft([[0,.007,.007],[length*.42,.0065,.007],[length*.76,.0056,.006],[length,.003,.003]],hand,skin,{sides:7,offset:[fx,.057,.001]});
  }
  loft([[0,.010,.010],[.027,.009,.009],[.045,.004,.005]],hand,skin,{sides:8,offset:[-side*.034,.008,.006],shape:p=>{p[0]-=side*p[1]*.32;return{p};}});
  const thigh=left?B.leftThigh:B.rightThigh,shin=left?B.leftShin:B.rightShin,foot=left?B.leftFoot:B.rightFoot;
  const trouserShape=(p,a)=>{const fold=Math.sin(a*8+p[1]*40)*.0022; p[0]+=Math.sin(a)*fold;return{p,color:tint(person.pants,1+fold*17)};};
  loft([[0,.084,.092],[.05,.090,.088],[.12,.082,.080],[.23,.068,.064],[.35,.057,.056],[.40,.055,.054]],thigh,pants,{sides:16,shape:trouserShape});
  loft([[0,.054,.052],[.07,.058,.056],[.16,.055,.050],[.27,.041,.039],[.35,.032,.032]],shin,person.shorts?skin:pants,{sides:16,shape:person.shorts?undefined:trouserShape});
  // Custom shoe cross sections taper at heel/toe, with a visibly layered sole.
  loft([[.010,.045,.090],[.024,.054,.112],[.044,.054,.112],[.062,.052,.107],[.078,.045,.09],[.103,.027,.055]],foot,shoe,{sides:16,offset:[0,0,.053],shape:(p,a,row)=>{p[2]+=.018*Math.max(0,Math.cos(a));return{p,color:row<2?tint('#c6c3b7'):shoe};}});
  for(let lace=0;lace<3;lace++)patch([0,.087-lace*.005,.065+lace*.018],[.029,.002,.003],foot,tint('#c9c5bc'),{sides:8,rows:4});
 }
 { // Every pooled mesh includes a handset; its joint is hidden for other poses.
  // A slim bevelled handset is an authored extrusion integrated in the mesh.
  loft([[-.064,.034,.006],[-.058,.040,.008],[.059,.040,.008],[.066,.034,.006]],B.phone,tint('#202630'),{sides:8});
  patch([.021,.043,-.008],[.008,.008,.002],B.phone,tint('#57646c'),{sides:8,rows:4});
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setAttribute('characterPalette',new THREE.Float32BufferAttribute(palette,2));
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(bones,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geometry.setIndex(indices);
 geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(mouth,3),new THREE.Float32BufferAttribute(blink,3)];geometry.morphTargetsRelative=true;
 geometry.computeVertexNormals();geometry.userData={authorship:'Camber Reign original mesh',triangles:indices.length/3,articulatedJoints:18,hasCheeringAndBlinkMorphs:true};
 if(geometry.userData.triangles>CHARACTER_LIMITS.maxTriangles)throw new Error('Spectator mesh triangle budget exceeded');
 return geometry;
}

export function createSpectatorCharacter(person,{low=false}={}){
 const appearance=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.91,metalness:0});
 const paletteUniforms={characterShirt:{value:new THREE.Color(person.shirt)},characterSkin:{value:new THREE.Color(person.skin)},characterPants:{value:new THREE.Color(person.pants)},characterHair:{value:new THREE.Color(person.hair)},characterShoe:{value:new THREE.Color(person.shoe)}};
 appearance.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,paletteUniforms);
  shader.vertexShader='attribute vec2 characterPalette; uniform vec3 characterShirt; uniform vec3 characterSkin; uniform vec3 characterPants; uniform vec3 characterHair; uniform vec3 characterShoe;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',`#include <color_vertex>
  if(characterPalette.x > 0.5){
   vec3 garmentColor=characterShirt;
   if(characterPalette.x>1.5)garmentColor=characterSkin;
   if(characterPalette.x>2.5)garmentColor=characterPants;
   if(characterPalette.x>3.5)garmentColor=characterHair;
   if(characterPalette.x>4.5)garmentColor=characterShoe;
   vColor.rgb=garmentColor*characterPalette.y;
  }`);
 };
 appearance.customProgramCacheKey=()=> 'camber-original-spectator-v1';
 const mesh=new THREE.SkinnedMesh(createSpectatorCharacterGeometry(person,{low}),appearance);
 mesh.name='race-spectator-authored-character';mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
 const joints=Array.from({length:18},(_,i)=>{const b=new THREE.Bone();b.name=Object.keys(B)[i];mesh.add(b);return b;});
 mesh.bind(new THREE.Skeleton(joints));mesh.userData={...mesh.geometry.userData,foregroundCharacter:true};
 const point=(id,p,rotation)=>{const bone=joints[id];bone.position.set(...p);bone.quaternion.identity();if(rotation)bone.rotation.set(...rotation);};
 const segment=(id,from,to,length)=>{const bone=joints[id];bone.position.set(...from);direction.set(...to).sub(bone.position);bone.quaternion.setFromUnitVectors(up,direction.clone().normalize());bone.scale.set(1,direction.length()/length,1);};
 let disposed=false;
 return {mesh,person,
  update(profile,pose){
   paletteUniforms.characterShirt.value.set(profile.shirt);paletteUniforms.characterSkin.value.set(profile.skin);paletteUniforms.characterPants.value.set(profile.pants);paletteUniforms.characterHair.value.set(profile.hair);paletteUniforms.characterShoe.value.set(profile.shoe);
   mesh.position.set(profile.x,profile.floor,profile.z);mesh.rotation.y=profile.yaw;mesh.scale.setScalar(profile.height);
   point(B.torso,[pose.sway,pose.hip-.022,pose.lean],[pose.torsoTilt,0,-pose.sway*.3]);joints[B.torso].scale.x=profile.width*(profile.build||1);
   point(B.neck,[pose.sway,pose.hip+.525,pose.lean]);point(B.head,[pose.sway,pose.head,pose.lean],[pose.headPitch,pose.headYaw,pose.headRoll]);joints[B.head].scale.x=profile.faceWidth;
   point(B.hip,[0,pose.hip-.03,0]);
   for(const arm of pose.arms){
    const left=arm.side<0,upper=left?B.leftUpper:B.rightUpper,lower=left?B.leftLower:B.rightLower,hand=left?B.leftHand:B.rightHand;
    segment(upper,arm.shoulder,arm.elbow,.285);segment(lower,arm.elbow,arm.hand,.265);
    point(hand,arm.hand);joints[hand].quaternion.copy(joints[lower].quaternion);
    if(profile.gesture===3)joints[hand].rotation.set(0,0,arm.side*.35);
    const side=arm.side,knee=profile.seated?[side*.12,.435,.31]:[side*(.115+profile.shift),.44,.01+side*.028];
    const ankle=profile.seated?[side*.12,.095,.36]:[side*.13,.085,.02+side*.028];
    segment(left?B.leftThigh:B.rightThigh,[side*.105,pose.hip-.02,0],knee,.40);segment(left?B.leftShin:B.rightShin,knee,ankle,.35);
    point(left?B.leftFoot:B.rightFoot,[ankle[0],0,ankle[2]]);
   }
   point(B.phone,[0,pose.hip+.60+pose.breathe,.339],[-.08,0,0]);joints[B.phone].scale.setScalar(profile.gesture===3?1:0);
   mesh.morphTargetInfluences[0]=Math.min(1,pose.mouth*1.7);mesh.morphTargetInfluences[1]=1-pose.blink;
   mesh.updateMatrixWorld(true);mesh.skeleton.update();
  },
  dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();mesh.geometry.dispose();mesh.skeleton.dispose();appearance.dispose();},
 };
}
