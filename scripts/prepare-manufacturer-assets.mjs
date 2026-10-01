/**
 * Offline, reproducible preparation of individually credited manufacturer models.
 * npm install --prefix /tmp/blacktop-manufacturer-tools @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0 draco3dgltf@1.5.7 sharp@0.34.5 three@0.186.1
 * node scripts/prepare-manufacturer-assets.mjs --sources /tmp/blacktop-manufacturer-assets --tools /tmp/blacktop-manufacturer-tools
 * --only <slug> prepares one model. --ferrari <original Ferrari GLB> adds that optional source.
 * Source files are not downloaded by this script. The adjacent source metadata JSON
 * and the embedded GLB attribution are retained in the generated manifest/report.
 */
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const sourceDir=resolve(option('--sources')||'/tmp/blacktop-manufacturer-assets');
const toolsDir=resolve(option('--tools')||'/tmp/blacktop-manufacturer-tools');
const outDir=resolve(option('--out')||fileURLToPath(new URL('../public/assets/cars/manufacturers/',import.meta.url)));
const resolver=createRequire(resolve(toolsDir,'package.json')),load=async name=>import(pathToFileURL(resolver.resolve(name)).href);
const [{NodeIO},{ALL_EXTENSIONS},{weld,dedup,prune,compactPrimitive,transformPrimitive,textureCompress,meshopt,joinPrimitives},{MeshoptSimplifier,MeshoptEncoder,MeshoptDecoder},sharpImport,{Matrix4,Vector3,Box3},dracoImport]=await Promise.all([load('@gltf-transform/core'),load('@gltf-transform/extensions'),load('@gltf-transform/functions'),load('meshoptimizer'),load('sharp'),load('three').then(m=>m.default||m),load('draco3dgltf')]);
await Promise.all([MeshoptSimplifier.ready,MeshoptEncoder.ready,MeshoptDecoder.ready]);
const sharp=sharpImport.default,draco=dracoImport.default||dracoImport;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder,'draco3d.decoder':await draco.createDecoderModule()});
// Lengths set the overall source model scale; they are rendering dimensions, not gameplay statistics.
const configs=[
 {id:'lamborghini-aventador',uid:'498ba84cb5a74262b6371308f801c51e',brand:'Lamborghini',model:'Aventador',length:4.78,paint:['Colo1'],wheel:n=>/^Llantas/.test(n),exclude:(n,m)=>m==='Suelo',brake:['LucestraserasLINES']},
 {id:'mclaren-senna',uid:'42a67f79f3d64ba58c7746b6d48d0ab7',brand:'McLaren',model:'Senna',length:4.744,simplifyPermissive:true,highBudget:380000,lowBudget:145000,highSecondaryError:.0012,lowError:.005,paint:['BodyPaint'],wheel:(n,m)=>m.startsWith('wire_162162162'),exclude:n=>/^Object_(45|47|49)$/.test(n),brake:['Baclight']},
 {id:'mclaren-570s',uid:'869feee8011d4803894318f6f0ddf2c6',brand:'McLaren',model:'570S Coupé',length:4.53,simplifyPermissive:true,paint:['car-paint-v2'],wheel:n=>/^Object_(19|23|24|26|28|31|35|36|38|40|149|150|151|153|155|157|159)$/.test(n),brake:['backights.emissions']},
 {id:'mclaren-p1-gtr',uid:'d805bec04cf5407fa7c036c20c726d39',brand:'McLaren',model:'P1 GTR',length:4.59,paint:['main_body','wing','side_mirrors'],wheel:(n,m)=>['tires','rims','disk','disk_circles','tire_logo'].includes(m),brake:['tail_light_light1','tail_light_light2','tail_light_light13']},
 {id:'porsche-930-turbo',uid:'8568d9d14a994b9cae59499f0dbed21e',brand:'Porsche',model:'911 (930) Turbo · 1975',length:4.29,paint:['paint'],wheel:(n,m)=>m==='930_tire'||m==='930_rim',exclude:(n,m)=>m==='coat'||n==='Object_140'},
 {id:'lotus-elise',uid:'75e9045ac1af4cdbb69318108c81edfd',brand:'Lotus',model:'Elise',length:3.785,flip:true,paint:['CAR.carros'],wheel:n=>/:Layer(?:2|16|17|18)_/.test(n),exclude:(n,m)=>/^NANA-/.test(m)||m==='SHADE'||/^SOL01/.test(n),brake:['CAR.feu','CAR.lamp-arr-bas','CAR.lamp-arr-rouge']},
 {id:'audi-r8',uid:'e17e438f076f4427a58d93aa779edaed',brand:'Audi',model:'R8 · Custom',length:4.43,paint:['body'],wheel:(n,m)=>['material','tire','wheel'].includes(m),brake:['red_lights']},
 {id:'rimac-concept-one',uid:'31d8d36e371643d1a6cbd21a21a3de25',brand:'Rimac',model:'Concept One',length:4.195,paint:['Body'],wheel:n=>/^w(?:00[123])?_/.test(n),brake:['Lampu_Merah']},
 {id:'koenigsegg-one-1',uid:'8d253a7f43404113838d72c7fc9cfa94',brand:'Koenigsegg',model:'One:1',length:4.50,paint:['lambert9SG'],componentWheels:true,wheelCandidate:(n,m)=>m==='lambert10SG',wheelRegions:[{x:1.045,y:.419,z:-1.644,r:.418,w:.34},{x:1.027,y:.393,z:1.586,r:.399,w:.34}],rejectComponent:c=>[606,616,442,142].includes(c.length/3)},
 {id:'pagani-zonda-c12',uid:'de954b33bc8e4552903f98941ae41be2',brand:'Pagani',model:'Zonda C12',length:4.395,paint:['car_paint'],wheel:n=>/^(?:tyre|steel_wheel)/.test(n),brake:['glass_red']},
 {id:'maserati-mc-stradale',uid:'c4aa1cf6461048e3b75a77ff027f90c6',brand:'Maserati',model:'GranTurismo MC Stradale',length:4.933,paint:['Pintura-Auto'],wheel:(n,m)=>(['Llantas','Neumaticos','Disco-Frenos'].includes(m)&&!/^Object_(27|28)$/.test(n))||/^Object_(?:1[4-9]|2[01])$/.test(n),brake:['Vidrio-Faros-Traseros']},
 {id:'aston-martin-one-77',uid:'57d0b9062aab4e079fbb8d06bf39baf4',brand:'Aston Martin',model:'One-77',length:4.601,sourceYaw:Math.PI/2,paint:['body'],wheel:(n,m)=>['tyre','rims','rims.001','brake_dics'].includes(m),brake:['rear-brake-lights'],splitRearLampMaterials:['lights']},
 {id:'rimac-nevera',uid:'a56cbbb94174426c8011031ca6ca24ac',brand:'Rimac',model:'Nevera',length:4.75,paint:['Material.003'],wheel:(n,m)=>['tyre','Material.018','Material.017','BrakeDisk_Mat1'].includes(m),brake:['Material.005','Material.001'],additionalCredits:[{title:'Brake Disk and Caliper',author:'Vladi',source:'https://skfb.ly/6Xy8o',license:'CC-BY-4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'}]},
 {id:'gma-t50',uid:'8965e24f9aaa42d5ba156b53b2e978bb',brand:'Gordon Murray Automotive',model:'T.50 · Custom',length:4.352,protectedNormals:true,preserveMaterials:['Procedural_Car_Paint.001','Frosted_Glass_02'],highSecondaryRatio:.55,lowSecondaryRatio:.18,highSecondaryError:.003,sourceYaw:Math.atan2(1.623151,.635316),paint:['Procedural_Car_Paint.001'],wheel:(n,m)=>(/^Rear tires/.test(n)&&m!=='Red_brakes')||(/^Plane(?:\.001|\.002)?_/.test(n)&&['Gray','gray_2'].includes(m)),brake:['Red_car_lights_glass']},
 {id:'bugatti-veyron',uid:'653d089ba9304657ab7f0e3552a8f87b',brand:'Bugatti',model:'Veyron',length:4.462,paint:[],paintNode:n=>/^Object_(10|12)$/.test(n),componentWheels:true,wheelCandidate:n=>/^Object_(4|5|13|14)$/.test(n),wheelRegions:[{x:.934,y:-.55,z:-1.51,r:.415,w:.405},{x:.974,y:-.569,z:1.478,r:.395,w:.315}]},
];
if(option('--ferrari'))configs.unshift({id:'ferrari-458-italia',uid:'57bf6cc56931426e87494f554df1dab6',brand:'Ferrari',model:'458 Spider',length:4.527,flip:true,paint:['Body_Color'],source:resolve(option('--ferrari')),wheel:(n,m,ancestry)=>ancestry.some(x=>/^wheel_[fr][lr]$/.test(x)),protectedNormals:true});
const selected=configs.filter(c=>!option('--only')||c.id===option('--only'));
const WHEEL_NAMES=['wheel_front_left','wheel_front_right','wheel_rear_left','wheel_rear_right'];
const triangles=doc=>doc.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((v,p)=>v+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0);
const clonePrim=(doc,p)=>{const q=p.clone();for(const semantic of q.listSemantics()){let a=q.getAttribute(semantic);q.setAttribute(semantic,a.clone().setArray(a.getArray().slice()));}if(q.getIndices()){let a=q.getIndices();q.setIndices(a.clone().setArray(a.getArray().slice()));}return q;};
const boundsFor=(p,indices)=>{let b=new Box3(),a=p.getAttribute('POSITION').getArray(),v=new Vector3();for(let i of indices||p.getIndices()?.getArray()||Array.from({length:a.length/3},(_,i)=>i))b.expandByPoint(v.fromArray(a,i*3));return b;};
// Connectivity is matched by coincident position, including authored UV/normal seams.
// Whole connected wheel pieces are moved together; body triangles are never sliced by a radius.
function connectedComponents(p){let a=p.getAttribute('POSITION').getArray(),idx=p.getIndices()?.getArray()||Uint32Array.from({length:a.length/3},(_,i)=>i),parent=Int32Array.from({length:a.length/3},(_,i)=>i),keys=new Map();const find=x=>{let r=x;while(parent[r]!==r)r=parent[r];while(parent[x]!==x){let next=parent[x];parent[x]=r;x=next;}return r;};const union=(a,b)=>parent[find(a)]=find(b);for(let i=0;i<a.length/3;i++){let k=[a[i*3],a[i*3+1],a[i*3+2]].map(v=>Math.round(v*1e5)).join(',');if(keys.has(k))union(i,keys.get(k));else keys.set(k,i);}for(let i=0;i<idx.length;i+=3){union(idx[i],idx[i+1]);union(idx[i],idx[i+2]);}let map=new Map();for(let i=0;i<idx.length;i+=3){let k=find(idx[i]);if(!map.has(k))map.set(k,[]);map.get(k).push(idx[i],idx[i+1],idx[i+2]);}return [...map.values()];}
function wheelLabel(center){return `wheel_${center.z>0?'front':'rear'}_${center.x>0?'left':'right'}`;}
function componentInWheel(config,p,indices){if(config.rejectComponent?.(indices))return false;const b=boundsFor(p,indices);for(const w of config.wheelRegions||[]){for(let side of[-1,1]){let eps=.025,lo=new Vector3(side*w.x-w.w/2-eps,w.y-w.r-eps,w.z-w.r-eps),hi=new Vector3(side*w.x+w.w/2+eps,w.y+w.r+eps,w.z+w.r+eps);if(b.min.x>=lo.x&&b.max.x<=hi.x&&b.min.y>=lo.y&&b.max.y<=hi.y&&b.min.z>=lo.z&&b.max.z<=hi.z)return true;}}return false;}
// The Corvette export has flat face normals across the curved body. Smooth coincident
// positions within a 55-degree crease without welding UVs or changing its geometry.
function smoothCreasedNormals(p){
 const pos=p.getAttribute('POSITION'),normal=p.getAttribute('NORMAL'),idx=p.getIndices()?.getArray();
 if(!normal||!idx)return;const a=pos.getArray(),old=normal.getArray(),next=new Float32Array(old.length),buckets=new Map(),keys=[];
 for(let i=0;i<pos.getCount();i++){const key=[a[i*3],a[i*3+1],a[i*3+2]].map(v=>Math.round(v*1e5)).join(',');keys[i]=key;if(!buckets.has(key))buckets.set(key,[]);}
 const ab=new Vector3(),ac=new Vector3(),v0=new Vector3(),v1=new Vector3(),v2=new Vector3();
 for(let i=0;i<idx.length;i+=3){v0.fromArray(a,idx[i]*3);v1.fromArray(a,idx[i+1]*3);v2.fromArray(a,idx[i+2]*3);const weighted=ab.subVectors(v1,v0).cross(ac.subVectors(v2,v0)).clone();if(weighted.lengthSq()<1e-18)continue;const direction=weighted.clone().normalize();for(const key of new Set([keys[idx[i]],keys[idx[i+1]],keys[idx[i+2]]]))buckets.get(key).push({weighted,direction});}
 const anchor=new Vector3(),sum=new Vector3(),threshold=Math.cos(55*Math.PI/180);
 for(let i=0;i<pos.getCount();i++){anchor.fromArray(old,i*3).normalize();sum.set(0,0,0);for(const face of buckets.get(keys[i]))if(anchor.dot(face.direction)>=threshold)sum.add(face.weighted);if(sum.lengthSq()<1e-18)sum.copy(anchor);sum.normalize().toArray(next,i*3);}
 normal.setArray(next);
}
// Wheel components share a pivot, so their compatible material batches can be joined
// losslessly. This reduces thousands of author detail pieces to tens of draw calls.
function mergeMaterialBatches(doc){
 const root=doc.getRoot(),materials=root.listMaterials();
 for(const mesh of root.listMeshes()){
  const groups=new Map();
  for(const p of mesh.listPrimitives()){
   if(p.listTargets().length)continue;
   const key=[materials.indexOf(p.getMaterial()),p.getMode(),!!p.getIndices(),...p.listSemantics().sort().map(semantic=>{const a=p.getAttribute(semantic);return [semantic,a.getElementSize(),a.getComponentType(),a.getNormalized()].join(':');})].join('|');
   if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
  }
  for(const primitives of groups.values())if(primitives.length>1){const joined=joinPrimitives(primitives);for(const p of primitives)p.dispose();mesh.addPrimitive(joined);}
 }
}
// Some archived author exports use viewport emission as a preview colour. Convert those
// named surfaces into physically plausible materials; retain authored geometry/UVs.
function repairSourceMaterials(config,root){
 const palette=(m,color,metal,rough)=>m.setBaseColorFactor(color).setMetallicFactor(metal).setRoughnessFactor(rough).setEmissiveFactor([0,0,0]);
 if(config.id==='pagani-zonda-c12')for(const m of root.listMaterials()){
  m.setEmissiveFactor([0,0,0]);
  const n=m.getName();
  if(n==='rubber')palette(m,[.018,.019,.022,1],0,.86);
  else if(n==='steel'||n==='chrome')palette(m,[.5,.53,.58,1],.94,n==='chrome'?.16:.29);
  else if(n==='car_paint')palette(m,[.47,.51,.57,1],.7,.26);
  else if(['black','grill','plastic','carbon_fibre','black_glass'].includes(n))palette(m,[.018,.02,.024,1],n==='grill'?.55:.08,n==='black_glass'?.18:.55);
  else if(n==='glass')palette(m,[.035,.055,.067,.65],.18,.12).setAlphaMode('BLEND');
  else if(n==='white_headlight_glass')palette(m,[.7,.79,.86,.7],.22,.12).setAlphaMode('BLEND');
  else if(n==='glass_red')palette(m,[.42,.008,.014,.94],.15,.2).setAlphaMode('BLEND');
  else if(n==='leather')palette(m,[.045,.035,.029,1],0,.8);
  else if(n==='cloth')palette(m,[.018,.02,.024,1],0,.95);
 }
 if(config.id==='lotus-elise')for(const m of root.listMaterials()){
  const n=m.getName();m.setEmissiveFactor([0,0,0]);
  if(n==='CAR.carros')palette(m,[.055,.22,.115,1],.62,.24);
  else if(n==='CAR.black')palette(m,[.018,.02,.022,1],0,.78);
  else if(n==='CAR.gris')palette(m,[.065,.07,.077,1],.65,.36);
  else if(n==='CAR.chrome'||n==='CAR.mirroir')palette(m,[.5,.54,.59,1],.95,.16);
  else if(n==='CAR.verre')palette(m,[.025,.045,.055,.68],.15,.1).setAlphaMode('BLEND');
  else if(n==='CAR.feu'||n.includes('lamp-arr-rouge')||n==='CAR.lamp-arr-bas')palette(m,[.45,.008,.012,1],.1,.23);
  else if(n.includes('lamp-avant'))palette(m,[.64,.7,.74,.8],.25,.13);
 }
 if(config.id==='porsche-930-turbo')for(const m of root.listMaterials()){
  const n=m.getName();
  if(n==='paint')palette(m,[.35,.43,.51,1],.63,.26);
  else if(n==='930_chromes')m.setBaseColorFactor([.8,.8,.8,1]).setRoughnessFactor(.2);
  else if(n==='glass')m.setMetallicFactor(.15).setRoughnessFactor(.14).setBaseColorFactor([.18,.23,.28,.62]);
 }
 if(config.id==='ferrari-458-italia')for(const m of root.listMaterials()){
  const n=m.getName();
  if(n==='Body_Color')m.setMetallicFactor(.45).setRoughnessFactor(.25);
  else if(n==='Glass_Gray')palette(m,[.025,.045,.055,.56],.12,.1).setAlphaMode('BLEND');
  else if(n==='Projector_Glass')palette(m,[.58,.7,.82,.68],.18,.12).setAlphaMode('BLEND');
  else if(n==='Tires')palette(m,[.018,.019,.021,1],0,.86);
  else if(n==='metal_chrome')palette(m,[.52,.56,.61,1],.95,.2);
  else if(n==='metal_gray')palette(m,[.17,.19,.22,1],.8,.34);
  else if(n==='Carpet')palette(m,[.012,.014,.017,1],0,.96);
  else if(n==='Carbon_Fiber')palette(m,[.023,.027,.032,1],.22,.42);
  else if(n==='Leather')palette(m,[.025,.028,.032,1],0,.66);
  else if(n==='Leather_red')palette(m,[.17,.025,.022,1],0,.62);
  else if(n==='Interior_dark'||n==='plastic_gray')palette(m,[.026,.029,.033,1],0,.7);
  else if(n==='Interior_light')palette(m,[.075,.085,.095,1],0,.66);
 }
 if(config.id==='rimac-concept-one')for(const m of root.listMaterials()){
  if(m.getName()==='Body')m.setMetallicFactor(.55).setRoughnessFactor(.25);
  else if(m.getName()==='Windshield')palette(m,[.025,.045,.055,1],.12,.13);
 }
 if(config.id==='chevrolet-corvette-c6-r')for(const m of root.listMaterials()){
  const n=m.getName();
  if(n==='.003')palette(m,[.94,.67,.015,1],.55,.25);
  else if(n==='.008')palette(m,[.025,.043,.055,1],.15,.12).setAlphaMode('OPAQUE');
  else if(n==='.007'||n==='.006'||n==='material'||n==='.001')palette(m,[.015,.018,.022,1],0,n==='material'||n==='.001'?.86:.48);
  else if(n==='.005')palette(m,[.045,.07,.09,1],.3,.1);
  else if(n==='.004')palette(m,[.48,.007,.012,1],.1,.22);
 }
 if(config.id==='mclaren-senna')for(const m of root.listMaterials()){
  const n=m.getName();
  if(n==='BodyPaint')palette(m,[.035,.14,.42,1],.6,.24);
  else if(n==='OrangeBody')palette(m,[.8,.055,.006,1],.35,.3);
  else if(n==='Grey')palette(m,[.18,.2,.23,1],.8,.32);
  else if(n==='Glass'||n==='Windows'||n==='Translucent')palette(m,[.025,.045,.06,.62],.1,.12).setAlphaMode('BLEND');
  else if(n==='Headlight')palette(m,[.66,.75,.83,1],.3,.14).setEmissiveFactor([.11,.13,.16]);
  else if(n==='Baclight')palette(m,[.5,.007,.013,1],.1,.2);
  else if(n==='Crbon')m.setMetallicFactor(.22).setRoughnessFactor(.4);
  else if(['Dashboard','Seat','Interior','Material'].includes(n))palette(m,[.025,.03,.035,1],0,.76);
  else if(n==='Seat_lining')palette(m,[.15,.04,.024,1],0,.65);
  else if(n==='Metallic')palette(m,[.16,.18,.21,1],.7,.36);
 }
 if(config.id==='mclaren-570s')for(const m of root.listMaterials()){
  const n=m.getName();
  if(n==='car-paint-v2')m.setMetallicFactor(.6).setRoughnessFactor(.24);
  else if(n==='tire-low')m.setMetallicFactor(0).setRoughnessFactor(.84);
  else if(n==='Plastic_int_matt')m.setMetallicFactor(0).setRoughnessFactor(.76);
  else if(n==='MetalStainlessSteelBrushedElongated005_2K'||n==='metal-dark-gray')m.setMetallicFactor(.88).setRoughnessFactor(.32);
  else if(n.startsWith('2x_Twill_Carbon_Fibre'))m.setMetallicFactor(.2).setRoughnessFactor(.36);
  else if(n==='backights.emissions')palette(m,[.52,.008,.012,1],.15,.18);
  else if(n==='headights.emissions')palette(m,[.7,.78,.85,1],.3,.16).setEmissiveFactor([.14,.16,.19]);
  else if(n==='mirrors')m.setMetallicFactor(.98).setRoughnessFactor(.08);
  else if(n==='Glass_ext'||n==='glass')palette(m,[.025,.04,.05,.64],.1,.1).setAlphaMode('BLEND');
 }
 if(config.id==='gma-t50')for(const m of root.listMaterials()){
  if(['Gray','gray_2'].includes(m.getName()))m.setMetallicFactor(.85).setRoughnessFactor(.3);
  else if(m.getName()==='Frosted_Glass_02')palette(m,[.03,.05,.06,.62],.1,.12).setAlphaMode('BLEND');
 }
 if(config.id==='audi-r8')for(const m of root.listMaterials()){
  if(m.getName()==='tire')m.setMetallicFactor(0).setRoughnessFactor(.85);
  else if(m.getName()==='material')palette(m,[.06,.07,.085,1],.9,.3);
  else if(m.getName()==='body')m.setMetallicFactor(.62).setRoughnessFactor(.25);
  else if(m.getName()==='glass')m.setBaseColorFactor([.025,.04,.05,.64]).setRoughnessFactor(.12);
 }
 if(config.id==='aston-martin-one-77')for(const m of root.listMaterials()){
  if(m.getName()==='body')m.setRoughnessFactor(.25);
  else if(m.getName()==='glass')m.setRoughnessFactor(.08);
 }
 if(config.id==='rimac-nevera')for(const m of root.listMaterials()){
  if(m.getName()==='Material.003')palette(m,[.028,.085,.2,1],.58,.24);
  else if(m.getName()==='glass')palette(m,[.025,.04,.05,1],.1,.1);
 }

}
await mkdir(outDir,{recursive:true});let manifest={};const manifestPath=resolve(outDir,'manifest.json');try{manifest=JSON.parse(await readFile(manifestPath,'utf8'));}catch{}
for(const config of selected){
 const source=config.source||resolve(sourceDir,config.uid+'.glb'),sourceBytes=await readFile(source),hash=createHash('sha256').update(sourceBytes).digest('hex');let metadata={};try{metadata=JSON.parse(await readFile(resolve(sourceDir,config.uid+'.json'),'utf8'));}catch{}
 const live=metadata.metadata||metadata,sourceDoc=await io.read(source),oldExtras=sourceDoc.getRoot().getAsset().extras||{};
 const sourceLink=live.viewerUrl||(String(live.source||'').startsWith('http')?live.source:null)||metadata.source||oldExtras.source||'https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/ferrari.glb';
 if(!config.source&&(!live.license||live.license.slug!=='by'||!String(live.license.url).includes('/by/4.0')))throw new Error(config.id+' requires verified CC-BY-4.0 source metadata');
 if(config.id==='ferrari-458-italia'&&hash!=='cafe3f48da6797aa9bde75ca768bc5b57db366575fd233e90df186ae988a876e')throw new Error('Ferrari source checksum must match the credited original');
 const author=typeof live.author==='string'?live.author:(live.author?.displayName||live.user?.displayName||oldExtras.author||'vicent091036');
 const report={id:config.id,brand:config.brand,model:config.model,uid:config.uid,length:config.length,author,source:sourceLink,download:metadata.download||metadata.downloadUrl||live.download,license:'CC-BY-4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',sourceSha256:hash,sourceAsset:oldExtras,additionalCredits:config.additionalCredits||[],paintMaterialNames:[],paintable:config.paint.length>0||!!config.paintNode,brakeLightMaterialNames:config.brake||[],wheelNames:WHEEL_NAMES,factoryPaintPreservesTexture:true,changes:'Removed staging/people where present. Baked world transforms, normalized scale and +Z forward/+Y up coordinates. Preserved authored normals/UVs; separated whole wheel components into articulated pivots. Conservatively simplified secondary geometry with normals/UV weights, merged compatible material batches without changing vertex data, corrected named material roles where archived viewport shading was unsuitable for PBR, resized embedded textures and Meshopt-compressed for delivery.',variants:{}};
 if(config.smoothMaterials)report.changes+=' Body shading was smoothed within a 55-degree crease while preserving geometry and UVs; tyre contact and glass materials were corrected.';
 for(const level of ['high','low']){
  const doc=await io.read(source),root=doc.getRoot(),originalNodes=root.listNodes().slice(),originalScenes=root.listScenes().slice();for(const e of root.listExtensionsUsed())if(['KHR_draco_mesh_compression','EXT_meshopt_compression'].includes(e.extensionName))e.dispose();
  repairSourceMaterials(config,root);
  const parts=[],removed=[],scene=doc.createScene(config.id);root.setDefaultScene(scene);
  for(const n of originalNodes){if(!n.getMesh())continue;const ancestry=[];for(let a=n;a;a=a.getParentNode())ancestry.push(a.getName());for(const p of n.getMesh().listPrimitives()){let mat=p.getMaterial(),mn=mat?.getName()||'',name=n.getName();if(config.exclude?.(name,mn)){removed.push(name);continue;}let q=clonePrim(doc,p);q.setExtras({...q.getExtras(),preserveSourceSurface:config.protectedNormals&&(config.preserveMaterials?config.preserveMaterials.includes(mn):/^(?:body$|glass$|chrome$|wheel|rim_|tire|brake$|nuts|centre)/.test(n.getMesh().getName()))});transformPrimitive(q,n.getWorldMatrix());if(config.sourceYaw)transformPrimitive(q,new Matrix4().makeRotationY(config.sourceYaw).toArray());if(config.smoothMaterials?.includes(mn))smoothCreasedNormals(q);if(config.id==='bugatti-veyron'&&name==='Object_6'){mat=mat.clone().setName('glass-windows');mat.setBaseColorFactor([.055,.085,.105,.65]).setMetallicFactor(.12).setRoughnessFactor(.1).setAlphaMode('BLEND');q.setMaterial(mat);}if(config.id==='chevrolet-corvette-c6-r'&&/^�{20}(?:_|\.(002|004|006)_)/.test(name)){mat=mat.clone().setName('wheel-alloy').setBaseColorFactor([.42,.45,.5,1]).setMetallicFactor(.9).setRoughnessFactor(.27);q.setMaterial(mat);}let paint=config.paint.includes(mn)||config.paintNode?.(name);if(paint){mat=mat.clone().setName('body-paint-'+mn);mat.setExtras({...mat.getExtras(),sourceMaterialName:mn});q.setMaterial(mat);}parts.push({primitive:q,name,sourceMaterial:mn,wholeWheel:config.wheel?.(name,mn,ancestry)||false,componentWheels:config.componentWheels&&config.wheelCandidate?.(name,mn)});}}
  const allBounds=new Box3();for(let p of parts)allBounds.union(boundsFor(p.primitive));const center=allBounds.getCenter(new Vector3()),scale=config.length/(allBounds.max.z-allBounds.min.z);
  const transform=new Matrix4().makeRotationY(config.flip?Math.PI:0).multiply(new Matrix4().makeScale(scale,scale,scale)).multiply(new Matrix4().makeTranslation(-center.x,-allBounds.min.y,-center.z));
  const groups=new Map(WHEEL_NAMES.map(n=>[n,[]])),staticParts=[];
  for(const part of parts){let p=part.primitive,subsets=[];if(part.wholeWheel||part.componentWheels){for(let indices of connectedComponents(p)){const sourceBounds=boundsFor(p,indices);let isWheel=(part.wholeWheel&&sourceBounds.min.x*sourceBounds.max.x>0&&sourceBounds.min.z*sourceBounds.max.z>0)||componentInWheel(config,p,indices),subset=p.clone();subset.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(indices)).setBuffer(root.listBuffers()[0]));compactPrimitive(subset);if(isWheel&&config.id==='mclaren-senna'){
 const rubber=sourceBounds.max.y-sourceBounds.min.y>.95;
 subset.setMaterial(subset.getMaterial().clone().setName(rubber?'wheel-rubber':'wheel-alloy').setBaseColorFactor(rubber?[.018,.02,.022,1]:[.34,.38,.43,1]).setMetallicFactor(rubber?0:.9).setRoughnessFactor(rubber?.86:.28));
}if(isWheel&&config.id==='bugatti-veyron'){
 const rubber=part.name==='Object_4'||(part.name==='Object_5'&&sourceBounds.max.y-sourceBounds.min.y>.65),disc=part.name==='Object_14';
 const surface=subset.getMaterial().clone().setName(rubber?'wheel-rubber':disc?'wheel-brake-metal':'wheel-alloy');
 surface.setBaseColorFactor(rubber?[.018,.019,.021,1]:disc?[.32,.35,.39,1]:[.58,.62,.67,1]).setMetallicFactor(rubber?0:.9).setRoughnessFactor(rubber?.86:disc?.4:.24);
 if(rubber)subset.setAttribute('COLOR_0',null);subset.setMaterial(surface);
}transformPrimitive(subset,transform.toArray());if(isWheel){const b=boundsFor(subset),label=wheelLabel(b.getCenter(new Vector3()));groups.get(label).push(subset);}else staticParts.push({primitive:subset,name:part.name});}p.dispose();}else{transformPrimitive(p,transform.toArray());staticParts.push({primitive:p,name:part.name});}}
  // Split shared front/rear lamp geometry by whole connected authored parts.
  // This isolates brake illumination without changing lamp vertices or moving headlights.
  if(config.splitRearLampMaterials)for(let i=staticParts.length-1;i>=0;i--){
   const part=staticParts[i],p=part.primitive;
   if(!config.splitRearLampMaterials.includes(p.getMaterial()?.getName()))continue;
   staticParts.splice(i,1);
   for(const indices of connectedComponents(p)){
    const subset=p.clone();subset.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(indices)).setBuffer(root.listBuffers()[0]));compactPrimitive(subset);
    if(boundsFor(subset).max.z<0){const m=subset.getMaterial().clone().setName('rear-brake-lights').setBaseColorFactor([.52,.006,.011,1]).setMetallicFactor(.1).setRoughnessFactor(.2);m.setExtras({...m.getExtras(),brakeLight:true});subset.setMaterial(m);}
    staticParts.push({primitive:subset,name:part.name});
   }
   p.dispose();
  }
  // Merge compatible static components afterwards without altering authored surfaces.
  const bodyNode=doc.createNode('body'),bodyMesh=doc.createMesh('body');for(let {primitive:p}of staticParts)bodyMesh.addPrimitive(p);bodyNode.setMesh(bodyMesh);scene.addChild(bodyNode);
  const wheelRadius={},wheelPositions={};for(const [name,primitives]of groups){if(!primitives.length)throw new Error(config.id+' missing '+name);const b=new Box3();for(let p of primitives)b.union(boundsFor(p));const pivot=b.getCenter(new Vector3()),mesh=doc.createMesh(name);for(let p of primitives){transformPrimitive(p,new Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z).toArray());mesh.addPrimitive(p);}const wheelPosition=pivot.clone();if(config.alignWheelContact)wheelPosition.y-=b.min.y;scene.addChild(doc.createNode(name).setTranslation(wheelPosition.toArray()).setMesh(mesh));wheelRadius[name]=(b.max.y-b.min.y)/2;wheelPositions[name]=wheelPosition.toArray();}
  for(const s of originalScenes)s.dispose();for(const n of originalNodes)n.dispose();
  await doc.transform(weld(),dedup(),prune());const before=triangles(doc),budget=level==='high'?(config.highBudget??430000):(config.lowBudget??(config.id==='lotus-elise'?145000:175000)),ratio=config.protectedNormals&&level==='low'?(config.lowSecondaryRatio??.075):level==='high'&&config.highSecondaryRatio?config.highSecondaryRatio:Math.min(1,budget/before),error=level==='high'?(config.highSecondaryError??.0006):(config.lowError??(config.protectedNormals?.01:.003));
  if(ratio<1)for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives()){if(config.protectedNormals&&p.getExtras().preserveSourceSurface)continue;let idx=p.getIndices(),pos=p.getAttribute('POSITION'),normal=p.getAttribute('NORMAL'),uv=p.getAttribute('TEXCOORD_0');if(!idx||!normal)continue;const stride=uv?5:3,attrs=new Float32Array(pos.getCount()*stride),na=normal.getArray(),ua=uv?.getArray();for(let i=0;i<pos.getCount();i++){for(let j=0;j<3;j++)attrs[i*stride+j]=na[i*3+j];if(uv){attrs[i*stride+3]=ua[i*2];attrs[i*stride+4]=ua[i*2+1];}}const [reduced]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(idx.getArray()),new Float32Array(pos.getArray()),3,attrs,stride,uv?[.12,.12,.12,.02,.02]:[.12,.12,.12],null,Math.floor(idx.getCount()*ratio/3)*3,error,config.protectedNormals||config.simplifyPermissive?['Permissive']:['LockBorder']);p.setIndices(doc.createAccessor().setType('SCALAR').setArray(reduced).setBuffer(idx.getBuffer()));compactPrimitive(p);}
  await doc.transform(dedup(),prune());mergeMaterialBatches(doc);
  await doc.transform(dedup(),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[level==='high'?1024:512,level==='high'?1024:512],quality:level==='high'?90:84}),meshopt({encoder:MeshoptEncoder,level:'medium'}));
  for(const b of root.listBuffers())b.setURI('');root.getAsset().extras={...oldExtras,author,source:sourceLink,license:'CC-BY-4.0',title:config.brand+' '+config.model,sourceSha256:hash,changes:report.changes,detail:level};
  const file=config.id+'-'+level+'.glb',destination=resolve(outDir,file);await io.write(destination,doc);const preparedBytes=await readFile(destination),bytes=preparedBytes.length,sha256=createHash('sha256').update(preparedBytes).digest('hex');
  report[level]='/assets/cars/manufacturers/'+file;report.variants[level]={triangles:triangles(doc),bytes,sha256,sourceTriangles:before,primitives:root.listMeshes().reduce((n,m)=>n+m.listPrimitives().length,0)};report.wheelRadius=wheelRadius;report.wheelPositions=wheelPositions;report.paintMaterialNames=[...new Set(root.listMaterials().map(m=>m.getName()).filter(n=>n.startsWith('body-paint-')))];report.brakeLightMaterialNames=(config.brake||[]).filter(name=>root.listMaterials().some(m=>m.getName()===name));report.width=(allBounds.max.x-allBounds.min.x)*scale;report.height=(allBounds.max.y-allBounds.min.y)*scale;report.removedNodes=[...new Set(removed)];console.log(JSON.stringify({id:config.id,level,...report.variants[level],wheelRadius,paint:report.paintMaterialNames}));
 }
 manifest[config.id]=report;await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
const modulePath=resolve(fileURLToPath(new URL('../src/manufacturer-asset-manifest.js',import.meta.url)));await writeFile(modulePath,'// Generated by scripts/prepare-manufacturer-assets.mjs. Author/license evidence retained per model.\nexport const MANUFACTURER_ASSETS = Object.freeze('+JSON.stringify(manifest,null,2)+');\n');
