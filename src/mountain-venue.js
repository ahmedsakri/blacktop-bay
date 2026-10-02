import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sampleTrack, projectOnTrack } from './track.js';
import { getTrackObstacles } from './track-obstacles.js';
import { broadleafCrownGeometry } from './vegetation-geometry.js';

export const DESTINATION_PROFILES = Object.freeze({
  'fuji-skyline': {background:'#8daebf',fog:'#aebdc0',fogDensity:.00065,sky:'#d6e7ef',sun:'#fff1d9',sunlight:1.5,ground:'#546749',vegetation:'woodland',towers:0},
  'singapore-afterdark': {background:'#111c35',fog:'#1d3049',fogDensity:.001,sky:'#789dbc',sun:'#a5b6d2',sunlight:.75,ground:'#283c40',vegetation:'street-trees',towers:55},
  'norway-fjord': {background:'#7895a4',fog:'#9daeb2',fogDensity:.00085,sky:'#d0e2e9',sun:'#e4e5d5',sunlight:1.15,ground:'#435647',vegetation:'conifers',towers:0},
  'san-francisco-hills': {background:'#62778e',fog:'#a9aaad',fogDensity:.00075,sky:'#b8cee4',sun:'#ffcca2',sunlight:1.5,ground:'#576459',vegetation:'street-trees',towers:24},
});

/** Original mesh scenery, including load-bearing viaduct piers and real ramps. */
export function createMountainVenue(scene, track, {low=false}={}) {
  if (!track.elevationProfile) return;
  const group=new THREE.Group();group.name=`destination-${track.id}`;scene.add(group);
  const concrete=new THREE.MeshStandardMaterial({color:'#8f9690',roughness:.85});
  const stone=new THREE.MeshStandardMaterial({color:'#596967',roughness:1});
  const snow=new THREE.MeshStandardMaterial({color:'#e9efeb',roughness:.82});
  const cherry=new THREE.MeshStandardMaterial({color:'#deb1ba',vertexColors:true,roughness:1});
  const trunk=new THREE.MeshStandardMaterial({color:'#55463f',roughness:1});
  const mesh=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
  for(let s=0;s<track.length;s+=24){const p=sampleTrack(s,track);if(p.y<2)continue;
    for(const side of [-1,1]){
      const x=p.x+p.nx*side*(track.width/2-2),z=p.z+p.nz*side*(track.width/2-2);
      // A support must not sit in the lower road under a bridge crossing.
      const lower=projectOnTrack(x,z,0,track,0);
      if(lower.y<p.y-2&&lower.distance<track.width/2+2)continue;
      mesh(new THREE.CylinderGeometry(.9,1.3,p.y-.5,8),concrete,x,(p.y-.5)/2,z);
    }
    const beam=mesh(new THREE.BoxGeometry(track.width+2,.9,2.4),concrete,p.x,p.y-.6,p.z);beam.rotation.y=Math.atan2(p.tx,p.tz);
  }
  // Raised road follows hillside embankments except at the authored bridge
  // sectors. Keep a conservative footprint clear of every other road segment.
  const hills = track.id==='fuji-skyline'?[[.16,.32],[.61,.85]]:track.id==='norway-fjord'?[[.16,.25],[.50,.68]]:track.id==='san-francisco-hills'?[[.16,.25],[.34,.46],[.73,.9]]:[];
  const bankPositions=[];
  for(const [from,to] of hills)for(let d=track.length*from;d<track.length*to;d+=9){
    const a=sampleTrack(d,track),b=sampleTrack(d+9,track);
    for(const side of [-1,1]){
      const points=[a,b].flatMap(p=>[track.width/2+1,track.width/2+18].map((offset,index)=>({x:p.x+p.nx*side*offset,y:index?-.1:p.y-.18,z:p.z+p.nz*side*offset})));
      if(points.some((p,i)=>i%2&&projectOnTrack(p.x,p.z,0,track).distance<track.width/2+10))continue;
      for(const index of [0,1,2,2,1,3]){const p=points[index];bankPositions.push(p.x,p.y,p.z);}
    }
  }
  if(bankPositions.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(bankPositions,3));g.computeVertexNormals();const bank=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:track.id==='san-francisco-hills'?'#5f6259':'#526453',roughness:1,side:THREE.DoubleSide}));bank.receiveShadow=true;group.add(bank);}
  // The summit is a scene landmark with a separate snow cap, outside the route.
  if(track.id==='fuji-skyline') {
  const mountain=mesh(new THREE.ConeGeometry(390,380,low?28:48,6),stone,80,170,-790);
  const mountainPosition=mountain.geometry.attributes.position;
  for(let i=0;i<mountainPosition.count;i++){const x=mountainPosition.getX(i),y=mountainPosition.getY(i),z=mountainPosition.getZ(i),a=Math.atan2(z,x),wave=1+.065*Math.sin(a*7+y*.025)+.03*Math.cos(a*13-y*.017);mountainPosition.setXYZ(i,x*wave,y,z*wave);}
  mountain.geometry.computeVertexNormals();mountain.rotation.y=.12;
  mesh(new THREE.ConeGeometry(122,118,low?28:48,3),snow,80,301,-790);
  for(let i=0;i<(low?42:70);i++){
    const p=sampleTrack(track.length*i/(low?42:70),track),side=i%2?1:-1;
    const x=p.x+p.nx*side*(track.width/2+13),z=p.z+p.nz*side*(track.width/2+13);
    if(p.y>8||projectOnTrack(x,z,0,track).distance<track.width/2+7)continue;
    mesh(new THREE.CylinderGeometry(.16,.24,3.8,7),trunk,x,1.9,z);
    const crown=mesh(broadleafCrownGeometry({low}),cherry,x,4.2,z);crown.scale.set(3.0,1.56,2.4);
  }
  }
  const steel=new THREE.MeshStandardMaterial({color:'#34455b',metalness:.72,roughness:.33});
  const gold=new THREE.MeshStandardMaterial({color:'#fff71e',metalness:.3,roughness:.35});
  const windowMat=new THREE.MeshStandardMaterial({color:'#19334b',metalness:.65,roughness:.2,emissive:'#265a86',emissiveIntensity:.3});
  const red=new THREE.MeshStandardMaterial({color:'#a54837',metalness:.45,roughness:.48});
  if(track.id==='singapore-afterdark'){
    // Three glass towers and a connecting observation deck create a clear marina silhouette.
    for(const x of [-70,0,70]) {mesh(new THREE.BoxGeometry(28,125,34),windowMat,x,62.5,-360);
      for(let y=10;y<125;y+=12)mesh(new THREE.BoxGeometry(29,.6,35),steel,x,y,-360);}
    mesh(new THREE.BoxGeometry(210,8,44),steel,0,127,-360);
    for(let i=0;i<7;i++)mesh(new THREE.BoxGeometry(7,.4,45),gold,-90+i*30,132,-360);
  }
  if(track.id==='norway-fjord'){
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2,x=Math.cos(a)*610,z=Math.sin(a)*530;
      const height=130+(i%3)*55;mesh(new THREE.ConeGeometry(120,height,7,3),stone,x,height/2-10,z);
      if(i%2===0)mesh(new THREE.ConeGeometry(32,height*.27,7),snow,x,height*.86-10,z);}
    const lake=new THREE.Mesh(new THREE.CircleGeometry(95,48),new THREE.MeshPhysicalMaterial({color:'#336374',metalness:.35,roughness:.2,clearcoat:1}));lake.rotation.x=-Math.PI/2;lake.position.set(25,.05,25);group.add(lake);
  }
  if(track.id==='san-francisco-hills'){
    const houseMaterials=['#d2b29b','#c4c9bc','#b8a7c4','#899fa9'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.9}));
    // Compact bay houses use distinct roof silhouettes and tall narrow windows.
    for(let i=0;i<22;i++){const p=sampleTrack(track.length*(.2+i*.015),track),side=i%2?1:-1;
      const x=p.x+p.nx*side*25,z=p.z+p.nz*side*25;if(projectOnTrack(x,z,0,track).distance<track.width/2+10)continue;
      const house=new THREE.Group();house.position.set(x,0,z);house.rotation.y=Math.atan2(p.tx,p.tz);group.add(house);
      const wall=new THREE.Mesh(new THREE.BoxGeometry(8,10+(i%3)*2,10),houseMaterials[i%4]);wall.position.y=(10+(i%3)*2)/2;house.add(wall);
      const roof=new THREE.Mesh(new THREE.ConeGeometry(7,4,4),steel);roof.position.y=12+(i%3)*2;roof.rotation.y=Math.PI/4;house.add(roof);
      for(const dx of [-2,2])for(const y of [3,7]){const w=new THREE.Mesh(new THREE.BoxGeometry(1.3,2,.12),windowMat);w.position.set(dx,y,5.07);house.add(w);}
    }
  }
  // Elevated runs use different bridge architecture, not a panorama swap.
  if(track.id!=='fuji-skyline')for(const fraction of [.26,.31]){
    const p=sampleTrack(track.length*fraction,track),bridge=new THREE.Group();bridge.position.set(p.x,p.y,p.z);bridge.rotation.y=Math.atan2(p.tx,p.tz);group.add(bridge);
    const mat=track.id==='san-francisco-hills'?red:steel;
    for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.7,16,.7),mat);leg.position.set(side*(track.width/2+1.3),8,0);bridge.add(leg);}
    const cross=new THREE.Mesh(new THREE.BoxGeometry(track.width+3.4,.9,.7),mat);cross.position.y=15.5;bridge.add(cross);
  }
  if(track.id==='san-francisco-hills'||track.id==='norway-fjord'){
    const cableMat=new THREE.MeshStandardMaterial({color:track.id==='san-francisco-hills'?'#a54837':'#78909b',metalness:.7,roughness:.4});
    for(const side of [-1,1]){
      const curve=[];
      for(let i=0;i<=24;i++){const t=i/24,p=sampleTrack(track.length*(.26+.05*t),track),height=15-10*Math.sin(Math.PI*t);curve.push(new THREE.Vector3(p.x+p.nx*side*(track.width/2+1.3),p.y+height,p.z+p.nz*side*(track.width/2+1.3)));
        if(i%2===0){const rod=mesh(new THREE.CylinderGeometry(.055,.055,height,5),cableMat,curve[i].x,p.y+height/2,curve[i].z);rod.castShadow=false;}}
      const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve),48,.11,6,false),cableMat);group.add(cable);
    }
  }
  // Open-sided galleries remain safely outside the full driveable width.
  if(['singapore-afterdark','norway-fjord'].includes(track.id))for(let i=0;i<7;i++){
    const p=sampleTrack(track.length*.79+i*5,track),frame=new THREE.Group();frame.position.set(p.x,p.y,p.z);frame.rotation.y=Math.atan2(p.tx,p.tz);group.add(frame);
    for(const side of [-1,1]){const wall=new THREE.Mesh(new THREE.BoxGeometry(.8,7,4.7),track.id==='norway-fjord'?stone:concrete);wall.position.set(side*(track.width/2+1.5),3.5,0);frame.add(wall);}
    const roof=new THREE.Mesh(new THREE.BoxGeometry(track.width+4,1,4.9),concrete);roof.position.y=7;frame.add(roof);
    const light=new THREE.Mesh(new THREE.BoxGeometry(track.width*.7,.05,.15),new THREE.MeshBasicMaterial({color:'#a6dfff'}));light.position.y=6.45;frame.add(light);
  }
  for(const obstacle of getTrackObstacles(track)){
    const o=mesh(obstacle.type==='rock'?new THREE.IcosahedronGeometry(obstacle.radius,1):new THREE.CylinderGeometry(obstacle.radius*.86,obstacle.radius,obstacle.height,6),obstacle.type==='rock'?stone:gold,obstacle.x,obstacle.y+obstacle.height/2,obstacle.z);
    if(obstacle.type==='rock')o.scale.y=obstacle.height/(2*obstacle.radius);
    if(obstacle.type!=='rock'){const band=new THREE.Mesh(new THREE.CylinderGeometry(obstacle.radius*.95,obstacle.radius*.95,.24,6),steel);band.position.y=.15;o.add(band);}
  }
  const rampMat=new THREE.MeshStandardMaterial({color:'#323c48',metalness:.35,roughness:.58,side:THREE.DoubleSide});
  const rampPaint={barrel:new THREE.MeshBasicMaterial({color:'#9246ff'}),straight:new THREE.MeshBasicMaterial({color:'#fff71e'})};
  for(const ramp of track.ramps||[]){
    const a=sampleTrack(ramp.s,track),b=sampleTrack(ramp.s+ramp.length,track);
    const pos=[];for(const end of [a,b])for(const side of [-1,1])pos.push(end.x+end.nx*(ramp.lane+side*ramp.width/2),end.y+(end===a?.035:ramp.height),end.z+end.nz*(ramp.lane+side*ramp.width/2));
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex([0,2,1,1,2,3]);geo.computeVertexNormals();
    const surface=new THREE.Mesh(geo,rampMat);surface.name=`launch-ramp-${ramp.id}`;group.add(surface);
    for(let i=0;i<5;i++){const f=(i+.4)/5,p=sampleTrack(ramp.s+ramp.length*f,track);
      const stripe=mesh(new THREE.BoxGeometry(ramp.width*.85,.045,.36),rampPaint[ramp.type]||rampPaint.straight,p.x+p.nx*ramp.lane,p.y+ramp.height*f+.065,p.z+p.nz*ramp.lane);
      stripe.rotation.set(-Math.atan2(ramp.height,ramp.length),Math.atan2(p.tx,p.tz),0,'YXZ');
    }
  }
  // Static authored scenery is batched by material/attributes. A detailed
  // bridge or streetscape therefore doesn't cost one draw call per window.
  group.updateMatrixWorld(true);
  const batches=new Map(),old=[];
  const centerX=track.samples.reduce((sum,p)=>sum+p.x,0)/track.samples.length;
  const centerZ=track.samples.reduce((sum,p)=>sum+p.z,0)/track.samples.length;
  group.traverse(item=>{if(!item.isMesh||Array.isArray(item.material))return;
    const bounds=new THREE.Box3().setFromObject(item),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    const distantLandmark=Math.max(size.x,size.y,size.z)>90||item.material===concrete||item.material===red;
    const key=item.material.uuid+':'+Object.keys(item.geometry.attributes).sort().join(',');
    const geometry=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone();geometry.applyMatrix4(item.matrixWorld);
    if(!batches.has(key))batches.set(key,{material:item.material,items:[],triangles:0,distantLandmark:false});
    const batch=batches.get(key);batch.items.push({geometry,sector:`${center.x>=centerX?1:0}:${center.z>=centerZ?1:0}`});
    batch.triangles+=geometry.attributes.position.count/3;batch.distantLandmark||=distantLandmark;old.push(item);
  });
  for(const item of old){item.removeFromParent();item.geometry.dispose();}
  // Large foliage benefits from local rejection. Tiny architectural parts cost
  // less as one material draw than as dozens of sectors. Keep the established
  // 20-draw phone ceiling; spend spare draws only on groups above 1,000 triangles.
  const renderBatches=[],maxBatches=low?20:28;let plannedBatches=batches.size;
  for(const batch of [...batches.values()].sort((a,b)=>b.triangles-a.triangles)){
    const sectors=new Map();for(const item of batch.items){if(!sectors.has(item.sector))sectors.set(item.sector,[]);sectors.get(item.sector).push(item.geometry);}
    if(!batch.distantLandmark&&batch.triangles>1000&&sectors.size>1&&plannedBatches+sectors.size-1<=maxBatches){
      plannedBatches+=sectors.size-1;for(const geometries of sectors.values())renderBatches.push({...batch,geometries});
    }else renderBatches.push({...batch,geometries:batch.items.map(item=>item.geometry)});
  }
  let drawBatches=0;
  for(const {material,geometries,distantLandmark} of renderBatches){
    const combined=mergeGeometries(geometries,false);
    // Preserve transformed parts if a future attribute mismatch prevents merging.
    const outputs=combined?[combined]:geometries;
    if(combined)for(const geometry of geometries)geometry.dispose();
    for(const geometry of outputs){const batch=new THREE.Mesh(geometry,material);batch.receiveShadow=true;batch.castShadow=false;if(!distantLandmark)batch.userData.distanceDetail={distance:500};group.add(batch);drawBatches++;}
  }
  group.userData.sourceMeshes=old.length;group.userData.drawBatches=drawBatches;
  return group;

}
