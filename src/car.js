import { createPrototypeCar } from './prototype-car.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { getVehicle } from './vehicles.js';

// All cars use +Z forward, +Y up, and tyre contact at ground Y = 0.
const clamp = THREE.MathUtils.clamp;
const formulaAssets=new Map();
const gtAssets=new Map();
let carAssetPromise=null;

// These redistributable meshes are credited alongside the GLBs. Their authored
// topology is retained; only transforms, draw grouping and runtime finishes change.
export function prepareCarAssets({low=false,baseURL,onProgress}={}){
  if(carAssetPromise)return carAssetPromise;
  const loader=new GLTFLoader();
  const normalize=gltf=>{
    gltf.scene.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const scale=5/size.x;
    const transform=new THREE.Matrix4().makeRotationY(Math.PI/2)
      .multiply(new THREE.Matrix4().makeScale(scale,scale,scale))
      .multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
    const parts=[];
    gltf.scene.traverse(mesh=>{
      if(!mesh.isMesh)return;
      let owner=mesh;
      while(owner.parent && !/wheel|wing|chassis|sidepod|floor|halo|cover|suspension|mirror|exhaust/.test(owner.name))owner=owner.parent;
      const name=owner.name||mesh.name,geometry=mesh.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(transform,mesh.matrixWorld));
      geometry.computeBoundingBox();
      const partBounds=geometry.boundingBox.clone(),pivot=new THREE.Vector3();
      const wheel=/wheel/.test(name);
      if(wheel){
        partBounds.getCenter(pivot);geometry.translate(-pivot.x,-pivot.y,-pivot.z);
        // Keep the model's actual spokes/discs, but distinguish alloy from rubber.
        const position=geometry.attributes.position,index=geometry.index,tyres=[],rims=[];
        const count=index?index.count:position.count,radius=(partBounds.max.y-partBounds.min.y)/2;
        for(let i=0;i<count;i+=3){
          const ids=[0,1,2].map(offset=>index?index.getX(i+offset):i+offset);
          const radial=ids.reduce((sum,id)=>sum+Math.hypot(position.getY(id),position.getZ(id)),0)/3;
          (radial>radius*.72?tyres:rims).push(...ids);
        }
        geometry.setIndex([...tyres,...rims]);geometry.clearGroups();
        if(tyres.length)geometry.addGroup(0,tyres.length,0);
        if(rims.length)geometry.addGroup(tyres.length,rims.length,1);
      }
      geometry.computeBoundingSphere();parts.push({name,geometry,pivot,wheel,bounds:partBounds});
    });
    const sourceMaterials=new Set(),sourceGeometry=new Set();
    gltf.scene.traverse(mesh=>{if(mesh.isMesh){sourceGeometry.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])sourceMaterials.add(material);}});
    sourceGeometry.forEach(geometry=>geometry.dispose());sourceMaterials.forEach(material=>material.dispose());
    return {parts,dimensions:{length:5,width:size.z*scale,height:size.y*scale}};
  };
  const load=async(level,path)=>{
    const url=baseURL?new URL(path,baseURL).href:path;
    const asset=normalize(await loader.loadAsync(url,onProgress));formulaAssets.set(level,asset);return asset;
  };
  const loadGT=async(level,path)=>{
    const gltf=await loader.loadAsync(baseURL?new URL(path,baseURL).href:path,onProgress);
    gltf.scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),scale=4.65/size.z;
    const transform=new THREE.Matrix4().makeRotationY(Math.PI).multiply(new THREE.Matrix4().makeScale(scale,scale,scale)).multiply(new THREE.Matrix4().makeTranslation(-center.x,-box.min.y,-center.z));
    const pivots=new Map();
    for(const name of ['wheel_fl','wheel_fr','wheel_rl','wheel_rr']){
      const node=gltf.scene.getObjectByName(name);
      if(node)pivots.set(name,new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3()).applyMatrix4(transform));
    }
    const parts=[];
    gltf.scene.traverse(mesh=>{
      if(!mesh.isMesh || /^yellow_trim/.test(mesh.name))return;
      let wheel=null;
      for(let node=mesh.parent;node;node=node.parent)if(pivots.has(node.name)){wheel=node.name;break;}
      const geometry=mesh.geometry.clone();geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(transform,mesh.matrixWorld));
      if(wheel){const p=pivots.get(wheel);geometry.translate(-p.x,-p.y,-p.z);}
      // Remove the small central exterior badge regions while preserving grille,
      // pipework and window trim belonging to the same source chrome mesh.
      if(mesh.name==='chrome'){
        const pos=geometry.attributes.position,index=geometry.index,indices=[],count=index?.count??pos.count;
        for(let i=0;i<count;i+=3){
          const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
          const x=ids.reduce((s,id)=>s+pos.getX(id),0)/3,y=ids.reduce((s,id)=>s+pos.getY(id),0)/3,z=ids.reduce((s,id)=>s+pos.getZ(id),0)/3;
          if(Math.abs(x)<.066 && Math.abs(z)>2.04 && y>.55 && y<.94)continue;
          if(Math.abs(x)>.90 && y>.70 && y<.81 && z>.77 && z<.88)continue;
          indices.push(...ids);
        }
        geometry.setIndex(indices);
      }
      geometry.computeBoundingSphere();parts.push({name:mesh.name,materialName:mesh.material.name,geometry,wheel});
    });
    const discardedGeometry=new Set(),discardedMaterials=new Set();gltf.scene.traverse(o=>{if(o.isMesh){discardedGeometry.add(o.geometry);discardedMaterials.add(o.material);}});
    discardedGeometry.forEach(g=>g.dispose());discardedMaterials.forEach(m=>m.dispose());
    gtAssets.set(level,{parts,pivots,dimensions:{length:4.65,width:size.x*scale,height:size.y*scale}});
  };
  carAssetPromise=(async()=>{
    await Promise.all([load('low','/assets/cars/vortex-p1-low.glb'),loadGT('low','/assets/cars/gt-base-low.glb?v=original-surfaces-2')]);
    if(!low)await Promise.all([load('high','/assets/cars/vortex-p1.glb'),loadGT('high','/assets/cars/gt-base.glb?v=original-surfaces-2')]);
  })().catch(error=>{carAssetPromise=null;throw error;});
  return carAssetPromise;
}

function createFormulaCar({vehicle='rally',ghost=false,color,low=false}={}){
  const template=formulaAssets.get(low?'low':'high')||formulaAssets.get('low');
  if(!template)throw new Error('Car assets are not ready. Await prepareCarAssets() before opening the garage.');
  const model=getVehicle(vehicle),attack=model.id==='formula';
  const group=new THREE.Group(),chassis=new THREE.Group();group.name=attack?'vortex-x-formula':'vortex-p1-formula';chassis.name='sprung-body';group.add(chassis);
  const paint=new THREE.MeshPhysicalMaterial({color:color??model.color,metalness:.34,roughness:.25,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:.75});
  const carbon=new THREE.MeshPhysicalMaterial({color:0x171c23,metalness:.38,roughness:.36,clearcoat:.22,envMapIntensity:.65});
  const rubber=new THREE.MeshStandardMaterial({color:0x101216,metalness:.03,roughness:.82});
  const alloy=new THREE.MeshStandardMaterial({color:0x454d56,metalness:.85,roughness:.27});
  const suspension=new THREE.MeshStandardMaterial({color:0x46515c,metalness:.70,roughness:.31});
  const wingAccent=new THREE.MeshPhysicalMaterial({color:0xe8edf0,metalness:.27,roughness:.30,clearcoat:.5});
  const materials=[paint,carbon,rubber,alloy,suspension,wingAccent];
  if(!ghost){finishSurface(paint,'paint');finishSurface(carbon,'carbon');}
  else for(const material of materials){material.color.set(0x4fe7f1);material.transparent=true;material.opacity=material===paint?.18:.25;material.depthWrite=false;}
  const wheels=[],partMeshes=new Map();
  let exhaustBounds;
  for(const part of template.parts){
    const material=part.wheel?[rubber,alloy]:attack&&part.name==='front-wing'?wingAccent:/chassis|sidepod|halo|engine-cover|mirrors/.test(part.name)?paint:/suspension|exhaust/.test(part.name)?suspension:carbon;
    const mesh=new THREE.Mesh(part.geometry,material);mesh.name=part.name+'-surface';mesh.castShadow=!ghost;mesh.receiveShadow=!ghost;partMeshes.set(part.name,mesh);
    if(attack&&/^(front|rear)-wing$/.test(part.name)){
      const center=part.bounds.getCenter(new THREE.Vector3());mesh.rotation.x=part.name==='front-wing'?-.035:-.05;mesh.position.copy(center).sub(center.clone().applyEuler(mesh.rotation));
    }
    if(part.wheel){
      const pivot=new THREE.Group(),rolling=new THREE.Group();pivot.name=part.name;pivot.position.copy(part.pivot);pivot.add(rolling);rolling.add(mesh);group.add(pivot);
      const radius=(part.bounds.max.y-part.bounds.min.y)/2;
      wheels.push({pivot,rolling,radius,front:/front/.test(part.name)});
    }else chassis.add(mesh);
    if(/exhaust/.test(part.name))exhaustBounds=part.bounds;
  }
  const ownedGeometry=[],textures=[];
  if(attack&&!ghost){
    group.updateMatrixWorld(true);
    const texture=raceNumberTexture(model.number,model.color);
    if(texture){
      textures.push(texture);const material=new THREE.MeshStandardMaterial({map:texture,roughness:.5,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});materials.push(material);
      for(const side of [-1,1]){
        const mesh=partMeshes.get(side>0?'left-sidepod':'right-sidepod');
        if(mesh){const geometry=new DecalGeometry(mesh,new THREE.Vector3(side*.68,.44,-.52),new THREE.Euler(0,side*Math.PI/2,0),new THREE.Vector3(.57,.27,.40));ownedGeometry.push(geometry);const decal=new THREE.Mesh(geometry,material);decal.name='vortex-x-number-'+side;chassis.add(decal);}
      }
      const nose=partMeshes.get('chassis');
      if(nose){const geometry=new DecalGeometry(nose,new THREE.Vector3(0,.52,1.29),new THREE.Euler(-Math.PI/2,0,0),new THREE.Vector3(.28,.36,.60));ownedGeometry.push(geometry);const decal=new THREE.Mesh(geometry,material);decal.name='vortex-x-nose-number';chassis.add(decal);}
    }
    const accent=new THREE.MeshStandardMaterial({color:0xe8edf0,metalness:.16,roughness:.4,polygonOffset:true,polygonOffsetFactor:-3});materials.push(accent);
    const cover=partMeshes.get('engine-cover');
    if(cover)for(const side of [-1,1]){const geometry=new DecalGeometry(cover,new THREE.Vector3(side*.065,.86,-.93),new THREE.Euler(-Math.PI/2,0,0),new THREE.Vector3(.038,1.20,.70));ownedGeometry.push(geometry);const stripe=new THREE.Mesh(geometry,accent);stripe.name='vortex-x-engine-stripe';chassis.add(stripe);}
  }
  const rear=exhaustBounds?.getCenter(new THREE.Vector3())||new THREE.Vector3(0,.52,-1.95);
  if(exhaustBounds)rear.z=exhaustBounds.min.z-.012;
  const flames=new THREE.Group();flames.name='nitro-exhaust';flames.visible=false;flames.position.copy(rear);chassis.add(flames);
  for(const [radius,length,tint,opacity] of [[.028,.34,0x168aff,.4],[.015,.16,0xc0edff,.58]]){
    const geometry=new THREE.ConeGeometry(radius,length,10,1,true);geometry.translate(0,length/2,0);geometry.rotateX(-Math.PI/2);ownedGeometry.push(geometry);
    const material=new THREE.MeshBasicMaterial({color:tint,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false});materials.push(material);flames.add(new THREE.Mesh(geometry,material));
  }
  const lampMaterial=new THREE.MeshBasicMaterial({color:0x940605,toneMapped:false});materials.push(lampMaterial);
  const lampGeometry=new THREE.PlaneGeometry(.041,.050);ownedGeometry.push(lampGeometry);
  const lamp=new THREE.Mesh(lampGeometry,lampMaterial);lamp.rotation.y=Math.PI;lamp.position.set(0,rear.y-.085,rear.z-.006);lamp.visible=!ghost;chassis.add(lamp);
  let lastTime=null,wheelAngle=0,disposed=false;
  const update=({speed=0,steering=0,brake=0,time=0,nitro=false}={})=>{
    if(disposed)return;
    const dt=lastTime===null?0:clamp(time-lastTime,0,.06);lastTime=time;
    const radius=wheels[0]?.radius||.33;wheelAngle=(wheelAngle+speed*dt/radius)%(Math.PI*2);
    const steer=-clamp(steering,-1,1)*.40;
    for(const wheel of wheels){wheel.rolling.rotation.x=wheelAngle;wheel.pivot.rotation.y=wheel.front?steer:0;}
    chassis.rotation.z=THREE.MathUtils.lerp(chassis.rotation.z,-steer*clamp(Math.abs(speed)/28,0,1)*.022,Math.min(1,dt*8));
    flames.visible=!ghost&&Boolean(nitro);flames.scale.z=.89+.11*Math.sin(time*47);
    if(!ghost)lampMaterial.color.setRGB(brake?1.8:.22,.003,.002);
  };
  const dispose=()=>{
    if(disposed)return;disposed=true;group.removeFromParent();materials.forEach(material=>material.dispose());ownedGeometry.forEach(geometry=>geometry.dispose());textures.forEach(texture=>texture.dispose());
    // Template geometry is shared by the garage, player and AI; retain its cache.
  };
  const rearWheels=template.parts.filter(part=>part.wheel&&!/front/.test(part.name));
  group.userData={kind:'licensed-formula-race-car',vehicle:model.id,dimensions:template.dimensions,source:'Qvist_designs / F1 2026 concept',license:'CC BY 4.0',effects:{
    rearAxle:rearWheels.reduce((sum,part)=>sum+part.pivot.z,0)/rearWheels.length,
    tyreOffset:rearWheels.reduce((sum,part)=>sum+Math.abs(part.pivot.x),0)/rearWheels.length,
    tyreWidth:rearWheels.reduce((sum,part)=>sum+part.bounds.max.x-part.bounds.min.x,0)/rearWheels.length,
    exhausts:[{x:rear.x,y:rear.y,z:rear.z}],
  }};
  return {group,update,dispose};
}

function createGTRacer({vehicle='coupe',ghost=false,color,low=false}={}){
  const template=gtAssets.get(low?'low':'high')||gtAssets.get('low');
  if(!template)throw new Error('Car assets are not ready. Await prepareCarAssets() before opening the garage.');
  const timeAttack=vehicle==='kestrel',endurance=vehicle==='gt'||vehicle==='endurance',sprint=vehicle==='sprint',longRun=vehicle==='endurance',model=getVehicle(vehicle),group=new THREE.Group(),renderRoot=new THREE.Group(),chassis=new THREE.Group();
  group.name=timeAttack?'kestrel-gt-r':longRun?'torque-rs-endurance':sprint?'apex-sprint':endurance?'torque-r-endurance':'apex-gt-racer';chassis.name='sprung-body';group.add(renderRoot);renderRoot.add(chassis);
  const paint=new THREE.MeshPhysicalMaterial({color:color??model.color,metalness:.45,roughness:.23,clearcoat:1,clearcoatRoughness:.095,envMapIntensity:.85});
  const carbon=new THREE.MeshPhysicalMaterial({color:0x10161c,metalness:.36,roughness:.34,clearcoat:.25,clearcoatRoughness:.20});
  const rubber=new THREE.MeshStandardMaterial({color:0x111418,roughness:.84,metalness:.02});
  const metal=new THREE.MeshStandardMaterial({color:endurance?0x454a50:0x52606b,roughness:.32,metalness:.85});
  const chrome=new THREE.MeshStandardMaterial({color:0xacb4ba,roughness:.19,metalness:1});
  const glass=new THREE.MeshPhysicalMaterial({color:0x233845,metalness:.05,roughness:.08,clearcoat:1,transparent:true,opacity:.54,depthWrite:false,envMapIntensity:.80});
  const interior=new THREE.MeshStandardMaterial({color:0x161b20,metalness:.04,roughness:.84});
  const seat=new THREE.MeshStandardMaterial({color:0x27151b,metalness:.03,roughness:.73});
  const lamps=new THREE.MeshStandardMaterial({color:0x7e090b,emissive:0xff0b06,emissiveIntensity:.75,roughness:.19,metalness:.12});
  const headlamp=new THREE.MeshBasicMaterial({color:0xc6e6f1,toneMapped:false});
  const caliper=new THREE.MeshStandardMaterial({color:0xca3522,roughness:.37,metalness:.55});
  const materials=[paint,carbon,rubber,metal,chrome,glass,interior,seat,lamps,headlamp,caliper],ownedGeometry=[],textures=[];
  ['body-paint','carbon-trim','rubber','alloy','chrome','dark-glass','interior','seat','tail-light-guides','head-light-guides','caliper'].forEach((name,i)=>materials[i].name=name);
  if(!ghost){finishSurface(paint,'paint');finishSurface(carbon,'carbon');}
  else for(const material of materials){material.color.set(0x4fe7f1);material.transparent=true;material.opacity=material===glass?.10:.20;material.depthWrite=false;if(material.emissive)material.emissive.set(0);}
  const wheels=new Map();
  for(const [name,position] of template.pivots){
    const pivot=new THREE.Group(),rolling=new THREE.Group();pivot.name=({wheel_fl:'front-left-wheel',wheel_fr:'front-right-wheel',wheel_rl:'rear-left-wheel',wheel_rr:'rear-right-wheel'})[name];pivot.position.copy(position);pivot.add(rolling);renderRoot.add(pivot);wheels.set(name,{pivot,rolling,front:name.includes('_f')});
  }
  let body;
  for(const part of template.parts){
    let material;
    if(part.name==='body')material=paint;
    else if(/brakes/.test(part.name))material=caliper;
    else if(part.name==='lights_red'||part.name==='steering_red_lights')material=lamps;
    else if(part.name==='leds'||part.name==='lights')material=headlamp;
    else if(part.name==='glass')material=glass;
    else if(/rim_|^wheel(?:_|$)|^brake(?:_|$)|^metal|^nuts/.test(part.name))material=metal;
    else if(part.name==='chrome')material=chrome;
    else if(/tire|grill|wiper/.test(part.name))material=rubber;
    else if(/leather|trim/.test(part.name)&&!part.name.includes('carbon'))material=seat;
    else if(part.materialName==='Ferrari_Yellow'||/centre|center/.test(part.name))material=carbon;
    else if(/carbon/.test(part.name))material=carbon;
    else material=interior;
    const mesh=new THREE.Mesh(part.geometry,material);mesh.name=part.name+'-surface';
    const optical=material===glass||material===lamps||material===headlamp;mesh.castShadow=!ghost&&!optical;mesh.receiveShadow=!ghost&&!optical;
    if(part.wheel)wheels.get(part.wheel).rolling.add(mesh);else chassis.add(mesh);
    if(part.name==='body')body=mesh;
  }
  const add=(geometry,material,parent=chassis)=>{ownedGeometry.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=!ghost;mesh.receiveShadow=!ghost;parent.add(mesh);return mesh;};
  const tube=(points,radius,material=carbon,segments=20)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,6,false),material);
  group.updateMatrixWorld(true);
  const deckHeight=(x,z)=>{
    const ray=new THREE.Raycaster(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0));
    return ray.intersectObject(body,false)[0]?.point.y??.87;
  };
  // A fitted motorsport hardtop closes the source convertible's genuine roof
  // aperture. Its front edge follows the measured header, and its rear glass
  // meets the original deck between the buttresses without floating panels.
  const roofPoint=(u,v,underside=false)=>{
    const across=u*2-1,width=THREE.MathUtils.lerp(.632,.567,v)+.025*Math.sin(v*Math.PI);
    const crown=THREE.MathUtils.lerp(1.272,1.255,v)+.059*Math.sin(v*Math.PI);
    return [across*width,crown-THREE.MathUtils.lerp(.100,.061,v)*across*across-(underside?.017:0),.18-.79*v];
  };
  add(gridGeometry(20,28,(u,v)=>roofPoint(u,v),true),carbon);
  add(gridGeometry(20,28,(u,v)=>roofPoint(u,v,true)),carbon);
  for(const side of [-1,1]){
    const u=side<0?0:1;
    add(gridGeometry(18,2,(t,v)=>{const p=roofPoint(u,v);p[1]-=t*.017;return p;},side>0),carbon);
    const top=Array.from({length:15},(_,i)=>roofPoint(u,i/14));
    tube(top,.009,carbon,18);
    // Lightly bowed polycarbonate side glazing has a curved roof edge and a
    // continuous sill; the small rear pillar encloses the factory buttress.
    add(gridGeometry(10,18,(t,v)=>{
      const upper=roofPoint(u,t),lower=[side*THREE.MathUtils.lerp(.837,.806,t),THREE.MathUtils.lerp(.857,.827,t),THREE.MathUtils.lerp(.78,-.60,t)];
      return [THREE.MathUtils.lerp(upper[0],lower[0],v)+side*.009*Math.sin(v*Math.PI),THREE.MathUtils.lerp(upper[1]-.016,lower[1],v),THREE.MathUtils.lerp(upper[2],lower[2],v)];
    },side>0),glass).material.side=THREE.DoubleSide;
    tube([[side*.568,1.194,-.61],[side*.651,1.107,-.635],[side*.81,.832,-.60]],.025,carbon,16);
    tube([[side*.632,1.174,.18],[side*.708,1.041,.43],[side*.837,.857,.78]],.013,carbon,16);
  }
  const rearGlass=(u,v)=>{
    const a=u*2-1;return [a*THREE.MathUtils.lerp(.557,.445,v),THREE.MathUtils.lerp(1.25,1.044,v)-.061*(1-v)*a*a,-.612-.34*v];
  };
  add(gridGeometry(14,24,rearGlass,true),glass);
  for(const side of [-1,1])tube(Array.from({length:13},(_,i)=>rearGlass(side<0?0:1,i/12)),.019,carbon,14);
  tube(Array.from({length:17},(_,i)=>rearGlass(i/16,1)),.013,carbon,18);
  // A welded rear hoop and crossed braces are visible through the glazing.
  const cage=new THREE.MeshStandardMaterial({color:0x7b868a,metalness:.72,roughness:.32});cage.name='race-roll-cage';materials.push(cage);
  if(ghost){cage.color.set(0x4fe7f1);cage.transparent=true;cage.opacity=.2;cage.depthWrite=false;}
  tube([[-.65,.39,-.49],[-.61,.91,-.49],[-.48,1.17,-.45],[0,1.22,-.45],[.48,1.17,-.45],[.61,.91,-.49],[.65,.39,-.49]],.019,cage,32);
  tube([[-.59,.48,-.52],[.48,1.15,-.46]],.014,cage,4);
  tube([[.59,.48,-.52],[-.48,1.15,-.46]],.014,cage,4);
  const wingHalf=timeAttack?1.145:endurance?1.055:sprint?.95:.995,wingY=timeAttack?1.36:longRun?1.35:endurance?1.31:sprint?1.10:1.17,wingZ=-2.075,chord=timeAttack?.40:longRun?.335:endurance?.305:sprint?.225:.265;
  for(const lower of [false,true])add(gridGeometry(8,36,(u,v)=>[(u*2-1)*wingHalf,wingY+.032*Math.sin(v*Math.PI)-(lower?.014:0),wingZ+(v-.5)*chord],lower),carbon);
  for(const side of [-1,1]){
    const baseY=deckHeight(side*.52,-1.87);
    const post=add(roundedBlock(.035,wingY-baseY,.074,.010),carbon);post.position.set(side*.52,(wingY+baseY)/2,-1.97);post.rotation.x=.18;
    add(patchGeometry([[side*wingHalf,wingY-.085,wingZ-.155],[side*wingHalf,wingY+.053,wingZ-.14],[side*wingHalf,wingY+.065,wingZ+.10],[side*wingHalf,wingY-.055,wingZ+.175]],.008),carbon).material.side=THREE.DoubleSide;
    tube([[side*wingHalf,wingY+.06,wingZ-.11],[side*wingHalf,wingY+.065,wingZ+.08]],.006,paint,4);
    if(endurance){
      const stay=add(roundedBlock(.025,wingY-baseY,.04,.006),metal);stay.position.set(side*.55,(wingY+baseY)/2,-1.92);stay.rotation.x=.25;
    }
  }
  if(endurance||timeAttack)for(const lower of [false,true])add(gridGeometry(5,28,(u,v)=>[(u*2-1)*wingHalf*.99,wingY+.079+.012*Math.sin(v*Math.PI)-(lower?.012:0),wingZ-.12+v*.12],lower),carbon);
  const tip=2.39,half=1.02;
  const outline=[[-half,.177,tip-.24],[-.78,.177,tip-.035],[-.35,.177,tip+.04],[0,.177,tip+.055],[.35,.177,tip+.04],[.78,.177,tip-.035],[half,.177,tip-.24],[.94,.177,tip-.46],[-.94,.177,tip-.46]];
  add(patchGeometry(outline),carbon).material.side=THREE.DoubleSide;tube([...outline,outline[0]],.008,carbon,32);
  for(const side of [-1,1]){
    const sill=add(roundedBlock(.068,.057,1.71,.012),carbon);sill.position.set(side*.951,.204,-.08);
    add(patchGeometry([[side*.97,.29,2.03],[side*1.03,.275,2.12],[side*.92,.325,1.89]]),carbon).material.side=THREE.DoubleSide;
    if(endurance)add(patchGeometry([[side*.958,.355,1.98],[side*1.026,.330,2.08],[side*.931,.395,1.88]]),carbon).material.side=THREE.DoubleSide;
  }
  if(timeAttack){
    // Fitted bonnet extraction banks, a deeper splitter and swept dive planes
    // distinguish the GT-R silhouette before paint or its race number is seen.
    for(const side of [-1,1]){
      for(let i=0;i<7;i++){
        const z=1.06+i*.082,y=deckHeight(side*.36,z)+.013;
        const vent=add(roundedBlock(.235,.018,.045,.007),carbon);vent.position.set(side*.36,y,z);vent.rotation.y=side*.14;
      }
      for(const height of [.36,.50])add(patchGeometry([[side*.92,height,1.79],[side*1.13,height-.07,1.91],[side*1.18,height-.07,1.66],[side*.94,height+.025,1.45]],.010),carbon).material.side=THREE.DoubleSide;
      tube([[side*.57,.85,-1.75],[side*.57,1.20,-1.71],[side*.57,1.39,-1.98]],.022,carbon,14);
    }
    add(patchGeometry([[-1.12,.18,2.15],[-.93,.18,2.47],[0,.18,2.51],[.93,.18,2.47],[1.12,.18,2.15]]),carbon).material.side=THREE.DoubleSide;
  }
  // New builds share their licensed GT chassis but have immediately distinct
  // original team liveries and wing setups. The stripes follow the real panels.
  if(!ghost&&(sprint||longRun)){
    const accent=new THREE.MeshStandardMaterial({color:sprint?0x146dcc:0xe6b749,metalness:.28,roughness:.29,polygonOffset:true,polygonOffsetFactor:-3});accent.name='team-stripe';materials.push(accent);
    const stripes=new THREE.Group();stripes.name='original-team-stripes';chassis.add(stripes);
    for(const side of [-1,1]){
      add(new DecalGeometry(body,new THREE.Vector3(side*.15,1.25,1.53),new THREE.Euler(-Math.PI/2,0,0),new THREE.Vector3(longRun?.095:.12,1.20,1.0)),accent,stripes);
      add(gridGeometry(18,3,(u,v)=>{const width=THREE.MathUtils.lerp(.632,.567,v)+.025*Math.sin(v*Math.PI),x=side*.15+(u-.5)*(longRun?.095:.12),p=roofPoint((x/width+1)/2,v);p[1]+=.003;return p;},true),accent,stripes);
      const stripe=new DecalGeometry(body,new THREE.Vector3(side*.96,.39,-.16),new THREE.Euler(0,side*Math.PI/2,0),new THREE.Vector3(1.85,.07,.42));add(stripe,accent,stripes);
    }
    for(const side of [-1,1])tube([[side*wingHalf,wingY+.03,wingZ-.13],[side*wingHalf,wingY+.04,wingZ+.1]],.012,accent,4);
  }
  // Original liveries are projected onto the real curved source body. Projector
  // orientation keeps numbers readable on both sides rather than mirrored.
  if(!ghost && typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=288;const ctx=canvas.getContext?.('2d');
    if(ctx){
      ctx.fillStyle='#f2f1e8';ctx.fillRect(0,0,512,288);ctx.fillStyle='#10202b';ctx.fillRect(0,0,512,25);ctx.font='italic 900 210px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(model.number,249,163);ctx.fillStyle=model.color;ctx.fillRect(0,270,512,18);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;textures.push(texture);
      const decalMaterial=new THREE.MeshStandardMaterial({map:texture,roughness:.53,metalness:.04,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4});materials.push(decalMaterial);
      const livery=new THREE.Group();livery.name='original-race-livery';chassis.add(livery);
      for(const side of [-1,1]){const decal=add(new DecalGeometry(body,new THREE.Vector3(side*.95,.57,.08),new THREE.Euler(0,side*Math.PI/2,0),new THREE.Vector3(.68,.385,.44)),decalMaterial,livery);decal.castShadow=false;decal.receiveShadow=false;}
    }
  }
  const flames=new THREE.Group();flames.name='nitro-exhaust';flames.visible=false;chassis.add(flames);
  const flameMat=new THREE.MeshBasicMaterial({color:0x188aff,transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false});materials.push(flameMat);
  const coreMat=new THREE.MeshBasicMaterial({color:0xb6eaff,transparent:true,opacity:.58,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false});materials.push(coreMat);
  const exhausts=[-.112,0,.112].map(x=>({x,y:.422,z:-2.333}));
  for(const {x,y,z}of exhausts)for(const [radius,length,material]of[[.031,.29,flameMat],[.018,.14,coreMat]]){const geometry=new THREE.ConeGeometry(radius,length,8,1,true);geometry.translate(0,length/2,0);geometry.rotateX(-Math.PI/2);const flame=add(geometry,material,flames);flame.position.set(x,y,z);flame.castShadow=false;flame.receiveShadow=false;}
  if(timeAttack){
    // Extend only the overhang ahead of the front tyre and lower the complete
    // glazed roof assembly together. Each source surface is copied, so shared
    // wheels, the other GT bodies and cached GLB geometry remain untouched.
    chassis.traverse(mesh=>{
      if(!mesh.isMesh||mesh.parent===flames)return;
      mesh.updateMatrix();const geometry=mesh.geometry.clone();geometry.applyMatrix4(mesh.matrix);
      const position=geometry.attributes.position,normal=geometry.attributes.normal,transformedNormal=new THREE.Vector3();
      for(let i=0;i<position.count;i++){
        const y=position.getY(i),z=position.getZ(i);
        position.setY(i,y-Math.max(0,y-1.02)*.26);
        position.setZ(i,z+.36*THREE.MathUtils.smoothstep(z,1.76,2.32));
        // Carry the source's smooth normals and deliberate hard-edge splits
        // through this warp. Its inverse local derivative is the normal matrix
        // for the varying roof/nose scale; rebuilding would lose those splits.
        const t=clamp((z-1.76)/.56,0,1),stretchZ=1+.36*6*t*(1-t)/.56;
        transformedNormal.set(normal.getX(i),normal.getY(i)/(y>1.02?.74:1),normal.getZ(i)/stretchZ).normalize();
        normal.setXYZ(i,transformedNormal.x,transformedNormal.y,transformedNormal.z);
      }
      geometry.computeBoundingSphere();ownedGeometry.push(geometry);mesh.geometry=geometry;
      mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);
    });
  }
  batchStaticMeshes(chassis);for(const mesh of chassis.children)if(mesh.isMesh)ownedGeometry.push(mesh.geometry);
  for(const wheel of wheels.values()){batchStaticMeshes(wheel.rolling);for(const mesh of wheel.rolling.children)if(mesh.isMesh)ownedGeometry.push(mesh.geometry);}
  if(endurance)renderRoot.scale.set(1.055,1,1.035);
  let lastTime=null,angle=0,disposed=false;
  const update=({speed=0,steering=0,brake=0,time=0,nitro=false}={})=>{
    if(disposed)return;const dt=lastTime===null?0:clamp(time-lastTime,0,.06);lastTime=time;angle=(angle+speed*dt/.367)%(Math.PI*2);
    const steer=-clamp(steering,-1,1)*.44;for(const wheel of wheels.values()){wheel.rolling.rotation.x=angle;wheel.pivot.rotation.y=wheel.front?steer:0;}
    chassis.rotation.z=THREE.MathUtils.lerp(chassis.rotation.z,-steer*clamp(Math.abs(speed)/28,0,1)*.035,Math.min(1,dt*8));
    if(!ghost)lamps.emissiveIntensity=.7+clamp(Number(brake)||0,0,1)*1.2;flames.visible=!ghost&&Boolean(nitro);for(const flame of flames.children)flame.scale.z=.88+.12*Math.sin(time*47);
  };
  const dispose=()=>{if(disposed)return;disposed=true;group.removeFromParent();materials.forEach(m=>m.dispose());ownedGeometry.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());};
  const rearPivots=[...template.pivots].filter(([name])=>name.includes('_r')).map(([,position])=>position);
  const rearTyres=template.parts.filter(part=>part.wheel?.includes('_r')&&/^tire/.test(part.name));
  const tyreWidths=rearTyres.map(part=>{part.geometry.computeBoundingBox();return part.geometry.boundingBox.max.x-part.geometry.boundingBox.min.x;});
  group.userData={kind:'licensed-gt-race-adaptation',vehicle:model.id,bodyProfile:timeAttack?'long-nose-time-attack':'gt',dimensions:{length:timeAttack?5.24:endurance?5.00:4.82,width:timeAttack?2.36:template.dimensions.width*(endurance?1.055:1),height:1.38},source:'vicent091036 / Ferrari 458 Italia, via Three.js',license:'CC BY 4.0',effects:{
    rearAxle:rearPivots.reduce((sum,p)=>sum+p.z,0)/rearPivots.length*(endurance?1.035:1),
    tyreOffset:rearPivots.reduce((sum,p)=>sum+Math.abs(p.x),0)/rearPivots.length*(endurance?1.055:1),
    tyreWidth:tyreWidths.reduce((sum,value)=>sum+value,0)/tyreWidths.length*(endurance?1.055:1),
    exhausts:exhausts.map(p=>({x:p.x*(endurance?1.055:1),y:p.y,z:p.z*(endurance?1.035:1)})),
  }};
  return {group,update,dispose};
}

function raceNumberTexture(number,accent){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=288;const ctx=canvas.getContext?.('2d');if(!ctx)return null;
  ctx.fillStyle='#f2f1e8';ctx.fillRect(0,0,512,288);ctx.fillStyle='#10202b';ctx.fillRect(0,0,512,25);ctx.font='italic 900 210px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(number,249,163);ctx.fillStyle=accent;ctx.fillRect(0,270,512,18);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

// Object-space surface detail survives material batching without texture seams.
// Derivative filtering fades individual flakes/threads before they can shimmer.
function finishSurface(material,kind) {
  if(kind==='paint'){material.userData.bodyPaint=true;material.metalness=.22;material.roughness=.22;material.clearcoat=1;material.clearcoatRoughness=.10;}
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFinishPosition; varying vec3 vFinishNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFinishPosition=position;vFinishNormal=normal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vFinishPosition; varying vec3 vFinishNormal;
float finishHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
`);
    const detail=kind==='paint'?`
vec3 fp=vFinishPosition*1450.0;
float footprint=max(length(dFdx(fp)),length(dFdy(fp)));
float grain=mix(finishHash(floor(fp)),.5,smoothstep(1.0,3.2,footprint));
roughnessFactor=clamp(roughnessFactor+(grain-.5)*.018,.16,.65);
diffuseColor.rgb*=.985+grain*.03;
`:`
vec3 fn=abs(normalize(vFinishNormal));
vec2 cuv=fn.y>fn.x && fn.y>fn.z?vFinishPosition.xz:fn.x>fn.z?vFinishPosition.zy:vFinishPosition.xy;
cuv*=135.0;
float footprint=max(length(dFdx(cuv)),length(dFdy(cuv)));
float weave=step(2.0,mod(floor(cuv.x)+floor(cuv.y),4.0));
float strand=mix(sin(cuv.x*6.283185),sin(cuv.y*6.283185),weave)*.5+.5;
strand=mix(strand,.5,smoothstep(.7,2.2,footprint));
diffuseColor.rgb*=.72+strand*.5;
roughnessFactor=clamp(roughnessFactor+(strand-.5)*.085,.2,.6);
`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n'+detail);
    if(kind==='carbon')shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
{
  vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);
  vec3 r1=cross(sy,normal),r2=cross(normal,sx);
  float det=dot(sx,r1),height= strand*.000030;
  if(abs(det)>.00000001)normal=normalize(abs(det)*normal-sign(det)*(dFdx(height)*r1+dFdy(height)*r2));
}
`);
  };
  material.customProgramCacheKey=()=>`coupe-finish-${kind}-v2`;
}

function gridGeometry(rows, columns, point, flip=false) {
  const positions=[],indices=[];
  for(let j=0;j<=rows;j++) for(let i=0;i<=columns;i++) {
    const p=point(i/columns,j/rows);positions.push(p[0],p[1],p[2]);
  }
  for(let j=0;j<rows;j++) for(let i=0;i<columns;i++) {
    const a=j*(columns+1)+i,b=a+1,c=a+columns+1,d=c+1;
    if(flip)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

function patchGeometry(corners, depth=0) {
  // A compact convex trim or lamp face; a separate rear face avoids see-through edges.
  const p=[],indices=[];
  corners.forEach(v=>p.push(...v));
  for(let i=1;i<corners.length-1;i++)indices.push(0,i,i+1);
  if(depth) {
    const n=corners.length;
    corners.forEach(v=>p.push(v[0],v[1],v[2]+depth));
    for(let i=0;i<n;i++) {const j=(i+1)%n;indices.push(i,n+i,j,j,n+i,n+j);}
    for(let i=1;i<n-1;i++)indices.push(n,n+i+1,n+i);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setIndex(indices);g.computeVertexNormals();return g;
}

function roundedBlock(width,height,depth,radius=.04) {
  const x=-width/2,y=-height/2,r=Math.min(radius,width/2,height/2);
  const s=new THREE.Shape();s.moveTo(x+r,y);s.lineTo(x+width-r,y);
  s.quadraticCurveTo(x+width,y,x+width,y+r);s.lineTo(x+width,y+height-r);
  s.quadraticCurveTo(x+width,y+height,x+width-r,y+height);s.lineTo(x+r,y+height);
  s.quadraticCurveTo(x,y+height,x,y+height-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(.001,depth-2*r),bevelEnabled:true,bevelSize:r*.45,bevelThickness:r,bevelSegments:2,steps:1,curveSegments:3});
  g.center();return g;
}

function batchStaticMeshes(parent) {
  const byMaterial=new Map();
  for(const mesh of [...parent.children]) {
    if(!mesh.isMesh)continue;
    mesh.updateMatrix();
    const copy=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    copy.applyMatrix4(mesh.matrix);copy.deleteAttribute('uv');copy.deleteAttribute('uv1');
    if(!byMaterial.has(mesh.material))byMaterial.set(mesh.material,[]);
    byMaterial.get(mesh.material).push(copy);parent.remove(mesh);
  }
  for(const [material,parts] of byMaterial) {
    const merged=mergeGeometries(parts),mesh=new THREE.Mesh(merged,material);
    const optical=material.name==='dark-glass' || material.name.includes('light-guides') || material.name==='lamp-lenses' || material.name.startsWith('race-marking');
    mesh.name='batched-'+material.name;mesh.castShadow=!material.transparent && !optical;mesh.receiveShadow=!optical;
    parent.add(mesh);parts.forEach(part=>part.dispose());
  }
}

export function createCar({ghost=false,vehicle='coupe',color,low=false}={}) {
  const model=getVehicle(vehicle);
  if(model.family==='formula')return createFormulaCar({ghost,vehicle:model.id,color,low});
  if(model.family==='prototype'){
    const template=gtAssets.get(low?'low':'high')||gtAssets.get('low');
    if(!template)throw new Error('Car assets are not ready. Await prepareCarAssets() before opening the garage.');
    return createPrototypeCar({model,template,color,ghost,low,finishSurface,raceNumberTexture,batchStaticMeshes});
  }
  return createGTRacer({ghost,vehicle:model.id,color,low});
}
