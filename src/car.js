import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original coupe. Metres; +Z is the nose, +Y is up, tyres rest at Y = 0.
// The body is a continuous loft with cut-out wheel wells, not overlapping boxes.
const AXLES = [-1.35, 1.36];
const WHEEL_RADIUS = .36;
const ARCH_RADIUS = .421;
const WHEEL_Y = .36;
const sections = [
  [-2.34,.78,.70,.23],[-2.25,.88,.80,.23],[-2.04,.937,.88,.24],
  [-1.70,.975,.925,.25],[-1.34,.984,.938,.26],[-.95,.943,.916,.235],
  [-.50,.910,.887,.20],[0,.904,.876,.20],[.55,.929,.891,.205],
  [1.0,.958,.903,.235],[1.36,.969,.917,.26],[1.77,.943,.873,.24],
  [2.08,.910,.790,.22],[2.30,.827,.680,.23],[2.35,.745,.630,.25],
];
const clamp = THREE.MathUtils.clamp;

function interpolated(z, column) {
  let i=0;
  while(i<sections.length-2 && z>sections[i+1][0]) i++;
  const a=sections[i],b=sections[i+1],t=clamp((z-a[0])/(b[0]-a[0]),0,1);
  const p=sections[Math.max(0,i-1)],q=sections[Math.min(sections.length-1,i+2)];
  const m0=(b[column]-p[column])/(b[0]-p[0])*(b[0]-a[0]);
  const m1=(q[column]-a[column])/(q[0]-a[0])*(b[0]-a[0]);
  return (2*t*t*t-3*t*t+1)*a[column]+(t*t*t-2*t*t+t)*m0+(-2*t*t*t+3*t*t)*b[column]+(t*t*t-t*t)*m1;
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
    const optical=material.name==='dark-glass' || material.name.includes('light-guides');
    mesh.name='batched-'+material.name;mesh.castShadow=!material.transparent && !optical;mesh.receiveShadow=!optical;
    parent.add(mesh);parts.forEach(part=>part.dispose());
  }
}

export function createCar({ghost=false}={}) {
  const group=new THREE.Group();group.name=ghost?'ghost-coupe':'coral-coupe';
  const chassis=new THREE.Group();chassis.name='sprung-body';group.add(chassis);
  const metallic=(color,roughness=.28,metalness=.7)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const paint=new THREE.MeshPhysicalMaterial({color:0xc51e1a,metalness:.25,roughness:.235,clearcoat:.85,clearcoatRoughness:.12,envMapIntensity:.42});
  const paintShadow=new THREE.MeshPhysicalMaterial({color:0x941a16,metalness:.28,roughness:.27,clearcoat:.9,clearcoatRoughness:.085});
  const carbon=metallic(0x10171c,.39,.54),rubber=metallic(0x101216,.73,.03);
  const wheelMetal=metallic(0x171e26,.28,.91),rimHighlight=metallic(0x667079,.25,.98);
  const glass=new THREE.MeshPhysicalMaterial({color:0x06131d,roughness:.125,metalness:.08,clearcoat:.75,clearcoatRoughness:.12,envMapIntensity:.38,transparent:true,opacity:.91,side:THREE.DoubleSide});
  const dark=metallic(0x05090e,.6,.25),interior=metallic(0x142026,.91,.02);
  const brakeMetal=metallic(0x79858c,.45,.85),caliper=metallic(0xc94a24,.36,.56);
  // Preserve red LED chroma instead of letting filmic tone mapping wash it to beige.
  const redLamp=new THREE.MeshBasicMaterial({color:new THREE.Color(.80,.004,.001),toneMapped:false});
  const redLens=new THREE.MeshPhysicalMaterial({color:0x470107,roughness:.12,metalness:.18,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:.55});
  const frontLamp=new THREE.MeshStandardMaterial({color:0xd7f3ff,emissive:0xa6dcff,emissiveIntensity:2.5,roughness:.17});
  const amber=new THREE.MeshStandardMaterial({color:0xe98f38,emissive:0xcd4910,emissiveIntensity:.4,roughness:.3});
  const allMaterials=[paint,paintShadow,carbon,rubber,wheelMetal,rimHighlight,glass,dark,interior,brakeMetal,caliper,redLamp,redLens,frontLamp,amber];
  ['coral-paint','paint-shadows','carbon-trim','rubber','black-alloy','polished-metal','dark-glass','recesses','interior','brake-discs','calipers','tail-light-guides','lamp-lenses','head-light-guides','indicators'].forEach((name,i)=>{allMaterials[i].name=name;});
  if(ghost) for(const m of allMaterials) {
    m.color.set(0x4fe7f1);m.transparent=true;m.opacity=m===paint?.19:m===glass?.10:.29;
    m.depthWrite=false;
    if(m.emissive){m.emissive.set(0x0796ac);m.emissiveIntensity=.85;}
  }
  const add=(geometry,material,parent=chassis)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=!ghost;mesh.receiveShadow=!ghost;
    parent.add(mesh);return mesh;
  };
  const box=(w,h,d,material,x,y,z,parent=chassis)=>{
    const mesh=add(new THREE.BoxGeometry(w,h,d),material,parent);mesh.position.set(x,y,z);return mesh;
  };
  const line=(points,radius,material=carbon,parent=chassis,segments=24)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));
    return add(new THREE.TubeGeometry(curve,Math.max(3,Math.ceil(segments*.72)),radius,4,false),material,parent);
  };
  const bodyTop=(t,v)=>{
    const z=-2.34+4.69*v,a=t*2-1,abs=Math.abs(a),width=interpolated(z,1),shoulder=interpolated(z,2);
    // A rolled shoulder catches a long highlight; the bonnet has its own subtle crown.
    const y=shoulder+.070*(1-a*a)-.038*Math.pow(abs,10);
    return [a*width,y,z];
  };
  const shell=add(gridGeometry(80,16,bodyTop),paint);shell.name='continuous-upper-body';

  // Door/quarter panels stop precisely on the arch circle, leaving real negative space.
  for(const side of [-1,1]) {
    const flank=add(gridGeometry(120,5,(u,v)=>{
      const z=-2.34+4.69*v,width=interpolated(z,1),top=interpolated(z,2)-.038;
      let floor=interpolated(z,3);
      for(const axle of AXLES){const dz=z-axle;if(Math.abs(dz)<ARCH_RADIUS)floor=Math.max(floor,WHEEL_Y+Math.sqrt(ARCH_RADIUS**2-dz**2));}
      const y=THREE.MathUtils.lerp(top,Math.min(top-.008,floor),u);
      const scallop=.022*Math.sin(Math.PI*u)+.028*u;
      return [side*(width-scallop),y,z];
    },side<0),paint);flank.name=side<0?'left-sculpted-flank':'right-sculpted-flank';
    // Substantial wheel-arch lips with an inward return, no black circle decals.
    for(const axle of AXLES) {
      const lip=add(gridGeometry(44,2,(u,v)=>{
        const angle=-.25+(Math.PI+.50)*v,r=ARCH_RADIUS+.004+u*.024;
        const z=axle+Math.cos(angle)*r,y=WHEEL_Y+Math.sin(angle)*r;
        return [side*(interpolated(z,1)+.001-u*.021),y,z];
      },side<0),paint);lip.name='formed-wheel-arch';
      const well=add(gridGeometry(40,2,(u,v)=>{
        const a=-.13+(Math.PI+.26)*v,r=ARCH_RADIUS+.018;
        const z=axle+Math.cos(a)*r;
        return [side*(interpolated(z,1)-.028-u*.22),WHEEL_Y+Math.sin(a)*r,z];
      },side>0),dark);well.name='open-wheel-well-liner';
    }
    // Tapered lower sill and a body crease running through the door.
    line([[side*.925,.224,-.91],[side*.918,.206,-.50],[side*.915,.205,.30],[side*.946,.24,.92]],.025,carbon);
    line([[side*.945,.269,-.92],[side*.913,.245,-.45],[side*.919,.253,.40],[side*.951,.29,.94]],.014,paintShadow);
    const door=[[-.66,.82],[-.70,.54],[-.62,.32],[.80,.30],[.96,.40],[.99,.76]];
    line(door.map(([z,y])=>[side*(interpolated(z,1)-.017),y,z]),.0028,dark,chassis,28);
    line([[-.81,.827],[0,.804],[.71,.82]].map(([z,y])=>[side*(interpolated(z,1)-.002),y,z]),.0034,paintShadow);
    const handle=add(roundedBlock(.12,.027,.016,.012),carbon);
    handle.rotation.y=side*Math.PI/2;handle.position.set(side*.924,.794,-.48);
    // The functional-looking front quarter vent follows the side of the car.
    const vent=add(patchGeometry([[side*.94,.67,.77],[side*.967,.76,1.03],[side*.967,.49,.985],[side*.94,.43,.80]]),dark);
    vent.material.side=THREE.DoubleSide;
    for(let k=0;k<3;k++)line([[side*.953,.54+k*.045,.83],[side*.965,.58+k*.045,.95]],.006,carbon,chassis,3);
  }

  // Sculpted end caps. Their cross-car curvature continues the body loft.
  for(const rear of [true,false]) {
    const z=rear?-2.34:2.35,width=interpolated(z,1),shoulder=interpolated(z,2);
    add(gridGeometry(8,16,(u,v)=>{
      const a=u*2-1;
      const top=shoulder+.070*(1-a*a)-.038*Math.pow(Math.abs(a),10);
      return [a*width,THREE.MathUtils.lerp(.22,top,v),z+(rear?-1:1)*(.011*(1-a*a)-.020)*Math.sin(v*Math.PI)];
    },!rear),paint);
  }
  // The deck and long bonnet have clear shut lines and two lightly raised power creases.
  line([[-.71,.902,-1.62],[-.65,.929,-1.84],[0,.958,-2.05],[.65,.929,-1.84],[.71,.902,-1.62]],.0033,paintShadow);
  for(const side of [-1,1]) {
    line([[side*.59,.963,.93],[side*.59,.962,1.36],[side*.51,.905,1.89],[side*.43,.823,2.10]],.003,paintShadow);
    line([[side*.38,.965,.97],[side*.41,.975,1.40],[side*.39,.934,1.73],[side*.29,.865,2.01]],.007,paint);
  }

  // Roof panel: compound curvature instead of a flat box.
  const roof=add(gridGeometry(15,22,(u,v)=>{
    const z=THREE.MathUtils.lerp(-.65,.27,v),x=(u*2-1)*(.646+.012*Math.sin(v*Math.PI));
    return [x,1.405+.027*Math.sin(v*Math.PI)-.041*(x/.65)**2,z];
  }),paint);roof.name='double-curved-roof';
  const screen=(rear)=>gridGeometry(12,18,(u,v)=>{
    const s=u*2-1;
    const width=THREE.MathUtils.lerp(.633,rear?.785:.791,v);
    const z=THREE.MathUtils.lerp(rear?-.645:.276,rear?-1.574:.89,v);
    const y=THREE.MathUtils.lerp(rear?1.385:1.391,.937,v)+.047*Math.sin(v*Math.PI)-.028*s*s;
    return [s*width,y,z+(rear?-1:1)*.050*(1-s*s)*Math.sin(v*Math.PI)];
  },rear);
  add(screen(true),glass).name='panoramic-rear-glass';
  add(screen(false),glass).name='windscreen';
  for(const side of [-1,1]) {
    line([[side*.637,1.355,-.648],[side*.718,1.17,-1.13],[side*.788,.917,-1.57]],.025,paint,chassis,20);
    line([[side*.638,1.36,.276],[side*.725,1.18,.60],[side*.794,.914,.89]],.022,paint,chassis,18);
    line([[side*.637,1.365,-.65],[side*.65,1.395,-.24],[side*.639,1.372,.27]],.016,paint,chassis,18);
    // Paint forms the C pillar around its separate side glass and rear windscreen.
    add(patchGeometry([[side*.646,1.36,-.66],[side*.788,.94,-1.575],[side*.928,.911,-1.18],[side*.837,.965,-1.20]]),paint).material.side=THREE.DoubleSide;
    const windowPoints=[[side*.814,.977,.783],[side*.653,1.336,.257],[side*.659,1.350,-.575],[side*.842,.978,-1.225]];
    const windowMesh=add(patchGeometry(windowPoints),glass);windowMesh.name='frameless-coupe-side-glass';
    line([...windowPoints,windowPoints[0]],.008,carbon,chassis,32);
    // Narrow B pillar separates the door window from its fixed quarter window.
    line([[side*.660,1.346,-.455],[side*.828,.982,-.527]],.013,carbon,chassis,3);
    line([[side*.802,.949,.79],[side*.849,.946,-.46],[side*.853,.952,-1.22]],.009,paint,chassis,16);
    const mirrorStem=line([[side*.805,1.01,.60],[side*.963,1.06,.63]],.013,carbon,chassis,3);
    mirrorStem.name='mirror-support';
    const mirror=add(new THREE.SphereGeometry(1,16,10),paint);mirror.scale.set(.105,.053,.135);mirror.position.set(side*1.016,1.081,.626);
    const mirrorGlass=add(new THREE.SphereGeometry(1,12,8),rimHighlight);mirrorGlass.scale.set(.075,.037,.011);mirrorGlass.position.set(side*1.019,1.081,.511);
  }
  // Fine demister traces sit on the screen; no solid tubes or self-shadow acne.
  const demisterMaterial=new THREE.LineBasicMaterial({color:0x2b2521,transparent:true,opacity:ghost?.15:.26,depthWrite:false});
  for(let i=1;i<7;i++) {
    const v=i/8,width=THREE.MathUtils.lerp(.633,.785,v),points=[];
    for(let j=0;j<=18;j++) {
      const s=(j/18*2-1)*.92;
      points.push(new THREE.Vector3(s*width,THREE.MathUtils.lerp(1.385,.937,v)+.047*Math.sin(v*Math.PI)-.028*s*s+.004,THREE.MathUtils.lerp(-.645,-1.574,v)-.050*(1-s*s)*Math.sin(v*Math.PI)-.004));
    }
    const trace=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),demisterMaterial);
    trace.name='rear-screen-demister';chassis.add(trace);
  }
  // Seats, parcel shelf, steering wheel and dashboard remain visible behind the glazing.
  box(1.43,.06,.45,interior,0,.926,-1.27);
  const seatGeometry=roundedBlock(.37,.43,.14,.045);
  for(const side of [-1,1]) {
    const seat=add(seatGeometry,interior);seat.position.set(side*.37,1.08,-.37);seat.rotation.x=-.12;
    const headrest=add(roundedBlock(.235,.17,.12,.042),interior);headrest.position.set(side*.37,1.288,-.375);
    box(.35,.075,.43,interior,side*.37,.835,-.25);
  }
  const dash=add(roundedBlock(1.35,.11,.33,.04),interior);dash.position.set(0,.941,.58);
  const steeringWheel=add(new THREE.TorusGeometry(.115,.016,6,24),carbon);steeringWheel.position.set(-.38,1.02,.36);steeringWheel.rotation.x=-.42;
  const fin=add(patchGeometry([[-.011,1.423,-.29],[-.011,1.516,-.44],[-.011,1.425,-.61]],.026),paint);fin.name='roof-antenna';

  // Slim swept lamp housings and three-dimensional luminous light guides.
  for(const side of [-1,1]) {
    const rearLampPoints=[[side*.17,.766,-2.363],[side*.79,.750,-2.302],[side*.875,.689,-2.222],[side*.745,.597,-2.301],[side*.31,.638,-2.372]];
    add(patchGeometry(rearLampPoints,.019),redLens).material.side=THREE.DoubleSide;
    line([[side*.21,.748,-2.379],[side*.49,.742,-2.365],[side*.795,.728,-2.311],[side*.725,.646,-2.334],[side*.36,.668,-2.391]],.014,redLamp,chassis,25);
    line([[side*.26,.704,-2.388],[side*.57,.699,-2.367],[side*.75,.69,-2.333]],.007,redLamp,chassis,14);
    const frontPoints=[[side*.36,.736,2.288],[side*.818,.689,2.262],[side*.870,.583,2.193],[side*.46,.637,2.350]];
    add(patchGeometry(frontPoints,-.026),dark).material.side=THREE.DoubleSide;
    line([[side*.39,.724,2.306],[side*.64,.704,2.310],[side*.804,.675,2.278],[side*.824,.623,2.256]],.009,frontLamp,chassis,16);
    line([[side*.51,.658,2.353],[side*.755,.625,2.307]],.005,frontLamp,chassis,7);
    line([[side*.863,.598,2.179],[side*.873,.628,2.149]],.005,amber,chassis,3);
  }
  line([[-.28,.737,-2.365],[0,.742,-2.368],[.28,.737,-2.365]],.006,carbon,chassis,12);
  // A continuous low lip spoiler grows out of the rear deck, with a thin aerofoil.
  const spoiler=add(gridGeometry(4,36,(u,v)=>{
    const x=(u*2-1)*.882,z=-2.096-v*.174+.074*(1-(x/.89)**2);
    return [x,.974+.027*Math.pow(Math.abs(x)/.89,2)+.011*Math.sin(v*Math.PI),z];
  },true),carbon);spoiler.name='sculpted-deck-spoiler';
  line([[-.867,1.001,-2.266],[-.50,.986,-2.213],[0,.981,-2.196],[.50,.986,-2.213],[.867,1.001,-2.266]],.012,carbon,chassis,32);
  for(const side of [-1,1]) {
    add(patchGeometry([[side*.60,.903,-2.13],[side*.60,.979,-2.16],[side*.65,.979,-2.16],[side*.65,.897,-2.13]],.08),carbon);
  }

  // The diffuser sits within the bumper; its short strakes end under the car.
  add(patchGeometry([[-.865,.40,-2.345],[-.71,.475,-2.377],[-.38,.50,-2.395],[.38,.50,-2.395],[.71,.475,-2.377],[.865,.40,-2.345],[.79,.241,-2.357],[-.79,.241,-2.357]],.025),carbon).material.side=THREE.DoubleSide;
  add(patchGeometry([[-.79,.243,-2.357],[.79,.243,-2.357],[.65,.213,-2.02],[-.65,.213,-2.02]]),carbon);
  add(patchGeometry([[-.38,.596,-2.371],[.38,.596,-2.371],[.455,.503,-2.39],[.34,.443,-2.408],[-.34,.443,-2.408],[-.455,.503,-2.39]],.008),dark).material.side=THREE.DoubleSide;
  for(let i=-2;i<=2;i++) {
    const fin=box(.007,.059,.205,carbon,i*.145,.250,-2.211);fin.rotation.x=-.07;
  }
  const pipeGeometry=new THREE.CylinderGeometry(.058,.054,.075,20,1,true);
  pipeGeometry.rotateX(Math.PI/2);
  const boreGeometry=new THREE.CircleGeometry(.049,20);boreGeometry.rotateY(Math.PI);
  const pipeLipGeometry=new THREE.TorusGeometry(.0545,.0045,6,24);
  for(const side of [-1,1]) {
    add(patchGeometry([[side*.493,.403,-2.392],[side*.783,.415,-2.366],[side*.817,.274,-2.366],[side*.493,.260,-2.392]],.008),dark).material.side=THREE.DoubleSide;
    for(const offset of [0,.132]) {
      const x=side*(.567+offset),z=-2.359+offset*.12;
      const pipe=add(pipeGeometry,rimHighlight);pipe.position.set(x,.330,z);
      const bore=add(boreGeometry,dark);bore.position.set(x,.330,z-.014);
      const lip=add(pipeLipGeometry,rimHighlight);lip.position.set(x,.330,z-.038);
    }
  }
  for(const side of [-1,1]) {
    // A restrained quarter-bumper outlet continues the flank's sculpted crease.
    add(patchGeometry([[side*.844,.598,-2.281],[side*.875,.578,-2.241],[side*.880,.438,-2.226],[side*.827,.468,-2.304]]),dark).material.side=THREE.DoubleSide;
    line([[side*.584,.467,-2.382],[side*.761,.465,-2.34]],.012,redLens,chassis,4);
    const inlet=add(patchGeometry([[side*.70,.405,2.361],[side*.817,.492,2.288],[side*.853,.310,2.262],[side*.72,.297,2.352]]),dark);inlet.material.side=THREE.DoubleSide;
  }
  const intake=add(patchGeometry([[-.53,.523,2.366],[.53,.523,2.366],[.61,.337,2.379],[-.61,.337,2.379]],-.025),dark);intake.material.side=THREE.DoubleSide;
  for(let i=-4;i<=4;i++)box(.018,.127,.016,carbon,i*.117,.418,2.381);
  line([[-.839,.267,2.282],[-.51,.260,2.394],[0,.255,2.409],[.51,.260,2.394],[.839,.267,2.282]],.022,carbon,chassis,24);

  // Wheel geometry is shared by all four corners. The barrel and tyres remain hollow.
  const tyreProfile=[new THREE.Vector2(.244,-.125),new THREE.Vector2(.294,-.132),new THREE.Vector2(.337,-.109),new THREE.Vector2(.358,-.061),new THREE.Vector2(.36,0),new THREE.Vector2(.358,.061),new THREE.Vector2(.337,.109),new THREE.Vector2(.294,.132),new THREE.Vector2(.244,.125),new THREE.Vector2(.244,-.125)];
  const tyreGeometry=new THREE.LatheGeometry(tyreProfile,48);tyreGeometry.rotateZ(Math.PI/2);
  const sidewallGeometry=new THREE.TorusGeometry(.313,.0032,4,40);sidewallGeometry.rotateY(Math.PI/2);
  const beadGeometry=new THREE.TorusGeometry(.267,.009,5,40);beadGeometry.rotateY(Math.PI/2);
  const rimGeometry=new THREE.CylinderGeometry(.262,.262,.218,40,1,true);rimGeometry.rotateZ(Math.PI/2);
  const discGeometry=new THREE.RingGeometry(.072,.223,36);discGeometry.rotateY(Math.PI/2);
  const hubGeometry=new THREE.CylinderGeometry(.061,.061,.033,16);hubGeometry.rotateZ(Math.PI/2);
  const spokeGeometry=new THREE.BoxGeometry(.021,.175,.018);
  const lugGeometry=new THREE.SphereGeometry(.009,6,4);
  const holeGeometry=new THREE.CircleGeometry(.007,5);holeGeometry.rotateY(Math.PI/2);
  const wheels=[];
  for(const z of AXLES)for(const side of [-1,1]) {
    const pivot=new THREE.Group();pivot.position.set(side*.879,WHEEL_Y,z);group.add(pivot);
    const rolling=new THREE.Group();pivot.add(rolling);
    const tyre=add(tyreGeometry,rubber,rolling);tyre.name='rounded-performance-tyre';
    const barrel=add(rimGeometry,wheelMetal,rolling);barrel.name='open-alloy-barrel';
    for(const x of [-.12,.12]) {const ring=add(sidewallGeometry,rubber,rolling);ring.position.x=x;}
    const rimLip=add(beadGeometry,rimHighlight,rolling);rimLip.position.x=side*.132;
    const disc=add(discGeometry,brakeMetal,rolling);disc.position.x=side*.069;disc.material.side=THREE.DoubleSide;
    const hub=add(hubGeometry,wheelMetal,rolling);hub.position.x=side*.136;
    for(let i=0;i<10;i++)for(const split of [-1,1]) {
      const angle=i*Math.PI/5+split*.049;
      const spoke=add(spokeGeometry,wheelMetal,rolling);
      spoke.position.set(side*.135,Math.cos(angle)*.162,Math.sin(angle)*.162);
      spoke.rotation.x=angle+split*.09;
    }
    for(let i=0;i<5;i++) {
      const a=i*Math.PI*2/5,bolt=add(lugGeometry,rimHighlight,rolling);
      bolt.position.set(side*.160,Math.cos(a)*.042,Math.sin(a)*.042);
    }
    for(let i=0;i<14;i++) {
      const a=i*Math.PI/7,hole=add(holeGeometry,dark,rolling);
      hole.position.set(side*.0705,Math.cos(a)*.188,Math.sin(a)*.188);if(side<0)hole.rotation.y=Math.PI;
    }
    const brake=add(roundedBlock(.062,.147,.071,.016),caliper,pivot);brake.position.set(side*.050,.054,-.182);brake.rotation.x=-.30;
    batchStaticMeshes(rolling);
    wheels.push({pivot,rolling,front:z>0});
  }
  if(ghost) {
    const edgeMaterial=new THREE.LineBasicMaterial({color:0x82f6ff,transparent:true,opacity:.59,depthWrite:false});
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry,16),edgeMaterial);chassis.add(edges);
    // A few architectural silhouette lines keep the ghost readable without a triangle grid.
    for(const side of [-1,1]) {
      line(sections.map(s=>[side*s[1],s[2]-.032,s[0]]),.006,frontLamp);
    }
  }
  batchStaticMeshes(chassis);
  let lastTime=null,wheelAngle=0;
  function update({speed=0,steering=0,brake=0,drift=0,time=0}={}) {
    const dt=lastTime===null?0:clamp(time-lastTime,0,.06);lastTime=time;
    wheelAngle=(wheelAngle+speed*dt/WHEEL_RADIUS)%(Math.PI*2);
    const steer=clamp(steering,-1,1)*.46;
    for(let i=0;i<wheels.length;i++) {
      const wheel=wheels[i];wheel.rolling.rotation.x=wheelAngle;
      wheel.pivot.rotation.y=wheel.front?steer:0;
    }
    chassis.rotation.z=THREE.MathUtils.lerp(chassis.rotation.z,-steer*clamp(Math.abs(speed)/28,0,1)*.065,Math.min(1,dt*7));
    chassis.rotation.x=THREE.MathUtils.lerp(chassis.rotation.x,clamp(Number(brake)||0,0,1)*.008,Math.min(1,dt*6));
    if(!ghost)redLamp.color.setRGB(.80+clamp(Number(brake)||0,0,1)*.8,.004,.001);
  }
  group.userData.kind='original-sculpted-coupe';
  group.userData.dimensions={length:4.82,width:2.24,height:1.52};
  return {group,update};
}
