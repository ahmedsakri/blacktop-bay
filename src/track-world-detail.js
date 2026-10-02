import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {projectOnTrack,sampleTrack} from './track.js';

export function streetscapeLayout(track,venue,{low=false,occupied=[]}={}) {
  const sites=[],count=low?22:34;
  if(!(venue.environment==='urban'||venue.water&&venue.vegetation==='palms')||track.scenery==='breakwater')return sites;
  for(let i=0;i<count;i++)for(const delta of [0,.008,-.008]){
    const s=track.length*((.06+i*.89/count+delta)%1),p=sampleTrack(s,track),side=i%2?1:-1,radius=11.5;
    if((p.y||0)>1.3)continue;
    const offset=side*(track.width/2+radius+7),x=p.x+p.nx*offset,z=p.z+p.nz*offset;
    if(projectOnTrack(x,z,undefined,track).distance<track.width/2+radius+5)continue;
    if(occupied.some(o=>Math.hypot(x-o.x,z-o.z)<radius+(o.radius||12)+2))continue;
    if(sites.some(o=>Math.hypot(x-o.x,z-o.z)<radius+o.radius+5))continue;
    const height=9.9+(i%3)*3.3;
    sites.push({x,z,y:height/2,sy:height,sx:12,sz:8,ry:Math.atan2(p.tx,p.tz),radius,frontageTint:['#d5c6a4','#bcc9c5','#cfac8b','#b4c0c4'][i%4],street:true});break;
  }
  return sites;
}

// Broad quay foundations and connected promenade links replace isolated
// floating boxes at the waterline. Every full footprint is road-checked.
export function waterfrontGroundingLayout(track,buildings) {
  const sites=[];
  const safe=b=>{
    if(b.role==='quay')return projectOnTrack(b.x,b.z,undefined,track).distance>=track.width/2+Math.hypot(b.sx,b.sz)/2+2.5;
    const count=Math.ceil(b.sz/3),margin=track.width/2+Math.hypot(b.sx/2,1.5)+2.5;
    for(let i=0;i<=count;i++){const z=-b.sz/2+b.sz*i/count;
      if(projectOnTrack(b.x+Math.sin(b.ry)*z,b.z+Math.cos(b.ry)*z,undefined,track).distance<margin)return false;
    }return true;
  };
  for(const b of buildings){
    if(b.y-b.sy/2>.5)continue;
    const site={x:b.x,z:b.z,y:-1.5,sx:b.sx+7,sy:2.8,sz:b.sz+7,ry:b.ry||0,role:'quay'};
    if(safe(site))sites.push(site);
  }
  const quays=[...sites],edges=new Set();
  for(let i=0;i<quays.length;i++){
    const a=quays[i];let nearest=-1,distance=Infinity;
    for(let j=0;j<quays.length;j++){if(i===j)continue;const b=quays[j],d=Math.hypot(a.x-b.x,a.z-b.z);if(d<distance&&d>8){distance=d;nearest=j;}}
    if(nearest<0||distance>105)continue;
    const key=[i,nearest].sort((a,b)=>a-b).join(':');if(edges.has(key))continue;edges.add(key);
    const b=quays[nearest],link={x:(a.x+b.x)/2,z:(a.z+b.z)/2,y:-1.5,sx:8,sy:2.8,sz:distance,ry:Math.atan2(b.x-a.x,b.z-a.z),role:'promenade'};
    if(safe(link))sites.push(link);
  }
  return sites;
}

export function createWaterfrontGrounding(scene,track,buildings,material) {
  const sites=waterfrontGroundingLayout(track,buildings),group=new THREE.Group();group.name='connected-waterfront-quays';scene.add(group);
  const base=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D(),pieces=[];
  for(const site of sites){dummy.position.set(site.x,site.y,site.z);dummy.rotation.set(0,site.ry,0);dummy.scale.set(site.sx,site.sy,site.sz);dummy.updateMatrix();pieces.push(base.clone().applyMatrix4(dummy.matrix));}
  base.dispose();
  if(pieces.length){const geometry=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
    for(let i=0;i<p.count;i++){const horizontal=Math.abs(n.getY(i))>.5;uv.setXY(i,(horizontal?p.getX(i):Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/3,(horizontal?p.getZ(i):p.getY(i))/3);}
    const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;group.add(mesh);
  }else material.dispose();
  group.userData={sites,drawCalls:group.children.length,triangles:sites.length*12,animated:false};return group;
}

// Deterministic, finite scenery plans can be checked independently of WebGL.
export function terrainReliefLayout(track,venue,{low=false,occupied=[]}={}) {
  const sites=[],count=low?20:32;
  if(venue.environment==='urban')return sites;
  for(let i=0;i<count;i++){
    const s=track.length*(i+.47)/count,p=sampleTrack(s,track),side=i%2?1:-1;
    const radius=22+(i%5)*4,offset=side*(track.width/2+radius+49+(i%3)*15);
    const x=p.x+p.nx*offset,z=p.z+p.nz*offset;
    if(projectOnTrack(x,z,undefined,track).distance<track.width/2+radius+12)continue;
    if(occupied.some(o=>Math.hypot(x-o.x,z-o.z)<radius+(o.radius||12)+3))continue;
    if(sites.some(o=>Math.hypot(x-o.x,z-o.z)<radius+o.radius+7))continue;
    sites.push({x,z,radius,height:venue.water?4+(i%3)*2:6+(i%4)*3,phase:i*.71});
  }
  return sites;
}

export function createTerrainRelief(scene,track,venue,{low=false,occupied=[],map}={}) {
  const sites=terrainReliefLayout(track,venue,{low,occupied}),positions=[],uv=[],colors=[],indices=[];
  const segments=low?20:32,rings=5,color=new THREE.Color();
  for(const site of sites){
    const start=positions.length/3;
    for(let ring=0;ring<=rings;ring++)for(let j=0;j<=segments;j++){
      const u=ring/rings,a=j/segments*Math.PI*2;
      const wave=1+.065*Math.sin(3*a+site.phase)+.035*Math.sin(7*a-site.phase);
      const r=site.radius*u*wave*.9,x=site.x+Math.cos(a)*r,z=site.z+Math.sin(a)*r;
      const y=-.3+site.height*Math.pow(Math.max(0,1-u*u),1.8)*(1+.12*Math.sin(3*a+u*5+site.phase)*u);
      positions.push(x,y,z);uv.push(x/90,z/90);
      color.set(venue.environment==='desert'?'#e4d4b1':venue.water?'#c6c9b5':'#b8c9a7');
      color.multiplyScalar(.79+.21*u+.05*Math.sin(a*5+site.phase));colors.push(color.r,color.g,color.b);
      if(ring<rings&&j<segments){const k=start+ring*(segments+1)+j;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
    }
  }
  const group=new THREE.Group();group.name='authored-terrain-relief';scene.add(group);
  if(positions.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({color:'#ffffff',map:map||null,vertexColors:true,roughness:1,metalness:0});
    const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;group.add(mesh);
  }
  group.userData={sites,drawCalls:positions.length?1:0,triangles:indices.length/3,animated:false};return group;
}

/** Low-rise frontages and tower bases gain real-depth cornices, colonnades,
 * street entrances, parapets and roof plant. Three static material draws. */
export function createArchitecturalDetails(scene,buildings,{low=false,night=false,concreteMap,concreteNormal}={}) {
  const group=new THREE.Group();group.name='authored-city-frontages';scene.add(group);
  const pieces={stone:[],metal:[],glass:[]},base=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
  const add=(b,kind,x,y,z,sx,sy,sz,color)=>{
    const c=Math.cos(b.ry||0),s=Math.sin(b.ry||0);dummy.position.set(b.x+c*x+s*z,b.y-b.sy/2+y,b.z-s*x+c*z);
    dummy.rotation.set(0,b.ry||0,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
    const g=base.clone().applyMatrix4(dummy.matrix),count=g.attributes.position.count,colors=new Float32Array(count*3),tint=new THREE.Color(color);
    for(let i=0;i<count;i++)colors.set([tint.r,tint.g,tint.b],i*3);g.setAttribute('color',new THREE.BufferAttribute(colors,3));pieces[kind].push(g);
  };
  for(const b of buildings){
    const w=b.sx,d=b.sz,h=b.sy,stone=b.frontageTint||'#a9b0a9';
    add(b,'stone',0,.04,0,w+3.4,.24,d+3.4,stone);
    if(b.street)add(b,'stone',0,-1.5,0,w+3.4,2.9,d+3.4,'#909c98');
    // A glazed lobby sits behind projecting piers and a metal entrance canopy.
    for(const side of [-1,1]){
      add(b,'glass',0,1.72,side*(d/2+.025),w*.84,2.7,.06,'#4b6b78');
      add(b,'metal',0,3.12,side*(d/2+.48),Math.min(5.6,w*.48),.14,1.05,'#6f7e84');
      for(const x of [-w*.40,0,w*.40])add(b,'stone',x,1.75,side*(d/2+.14),.32,3.4,.36,stone);
      for(const x of [-.56,.56])add(b,'metal',x,1.43,side*(d/2+.085),.045,2.45,.07,'#b4b8af');
      if(b.street){
        // Three glazed upper bays, recessed behind frames and projecting sills.
        for(let y=5.1;y<h-1;y+=3.3)for(const x of [-3.75,0,3.75]){
          add(b,'glass',x,y,side*(d/2+.035),1.8,1.95,.075,'#527080');
          add(b,'stone',x,y-1.06,side*(d/2+.15),2.12,.16,.34,'#e0d6bc');
          for(const dx of [-1,1])add(b,'stone',x+dx*.95,y,side*(d/2+.10),.10,2.05,.19,'#dfd8c5');
          add(b,'metal',x,y,side*(d/2+.09),.045,1.97,.11,'#b2b7ae');
        }
        add(b,'metal',0,3.6,side*(d/2+.2),w*.90,.7,.27,'#244249');
        for(const x of [-w*.39,w*.39]){add(b,'stone',x,.42,side*(d/2+1.02),1.15,.62,.85,'#9f9c8c');add(b,'stone',x,.81,side*(d/2+1.02),.91,.22,.66,'#4a6450');}
      }
    }
    // Floor edges and recessed vertical fins establish real architectural scale.
    for(let y=3.45;y<h;y+=low?6.6:3.3){
      for(const side of [-1,1])add(b,'stone',0,y,side*(d/2+.07),w+.20,.13,.20,stone);
      if(y<22)for(const side of [-1,1])add(b,'stone',side*(w/2+.07),y,0,.20,.13,d+.20,stone);
    }
    for(const side of [-1,1]){
      add(b,'stone',0,h+.20,side*(d/2),w+.34,.44,.27,stone);
      add(b,'stone',side*w/2,h+.20,0,.27,.44,d+.34,stone);
      if(h<38)for(const x of [-w*.42,w*.42])add(b,'stone',x,h/2,side*(d/2+.09),.20,h,.22,stone);
    }
    add(b,'metal',w*.18,h+.61,0,Math.min(3,w*.24),1.12,Math.min(2.5,d*.30),'#6e7b7b');
    add(b,'metal',w*.18,h+1.2,0,Math.min(3.14,w*.25),.10,Math.min(2.65,d*.32),'#a8b0ac');
  }
  base.dispose();
  const materials={
    stone:new THREE.MeshStandardMaterial({color:'white',vertexColors:true,map:concreteMap||null,normalMap:concreteNormal||null,normalScale:new THREE.Vector2(.12,.12),roughness:.86}),
    metal:new THREE.MeshStandardMaterial({color:'white',vertexColors:true,metalness:.62,roughness:.40}),
    glass:new THREE.MeshStandardMaterial({color:'white',vertexColors:true,metalness:.5,roughness:.23,emissive:'#cfb07a',emissiveIntensity:night?.45:.02}),
  };
  let triangles=0;
  for(const [kind,list] of Object.entries(pieces)){
    if(!list.length){materials[kind].dispose();continue;}
    const geometry=mergeGeometries(list);list.forEach(g=>g.dispose());
    if(!geometry)throw new Error('Architectural detail attributes must match');
    const mesh=new THREE.Mesh(geometry,materials[kind]);mesh.receiveShadow=true;group.add(mesh);triangles+=(geometry.index?.count||geometry.attributes.position.count)/3;
  }
  // Original local shop names and restrained entrance light pools give the
  // street a readable human scale without one light/shadow pass per building.
  const streets=buildings.filter(b=>b.street),signs=[],pools=[];
  if(streets.length&&typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=low?1024:2048;canvas.height=low?64:128;
    const c=canvas.getContext('2d'),w=canvas.width/4,h=canvas.height;
    c.fillStyle='#244249';c.fillRect(0,0,canvas.width,h);c.textAlign='center';c.textBaseline='middle';c.font=`700 ${h*.41}px "Barlow Condensed",sans-serif`;
    for(const [i,label] of ['BAY GARAGE','NIGHT CAFE','PORT MARKET','SKYLINE CLUB'].entries()){c.fillStyle='#f5edcd';c.fillText(label,w*(i+.5),h*.53,w*.85);c.fillStyle='#b3c2b0';c.fillRect(w*(i+.12),h*.83,w*.76,h*.025);}
    for(const [index,b] of streets.entries())for(const side of [-1,1]){
      const yaw=b.ry+(side<0?Math.PI:0),geo=new THREE.PlaneGeometry(b.sx*.88,.61),uv=geo.attributes.uv;
      for(let i=0;i<uv.count;i++)uv.setX(i,(uv.getX(i)+index%4)/4);
      dummy.position.set(b.x+Math.sin(b.ry)*side*(b.sz/2+.345),b.y-b.sy/2+3.6,b.z+Math.cos(b.ry)*side*(b.sz/2+.345));dummy.rotation.set(0,yaw,0);dummy.scale.set(1,1,1);dummy.updateMatrix();geo.applyMatrix4(dummy.matrix);signs.push(geo);
      if(night){const pool=new THREE.PlaneGeometry(5.4,3.6);pool.rotateX(-Math.PI/2);dummy.position.set(b.x+Math.sin(b.ry)*side*(b.sz/2+1.3),b.y-b.sy/2+.166,b.z+Math.cos(b.ry)*side*(b.sz/2+1.3));dummy.rotation.set(0,b.ry,0);dummy.updateMatrix();pool.applyMatrix4(dummy.matrix);pools.push(pool);}
    }
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
    const geometry=mergeGeometries(signs);signs.forEach(g=>g.dispose());const material=new THREE.MeshBasicMaterial({map,toneMapped:true});group.add(new THREE.Mesh(geometry,material));triangles+=streets.length*4;
    if(pools.length){const geometry=mergeGeometries(pools);pools.forEach(g=>g.dispose());const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'varying vec2 vPoolUv;void main(){vPoolUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vPoolUv;void main(){vec2 p=(vPoolUv-.5)*2.;float light=pow(max(0.,1.-dot(p,p)),2.);gl_FragColor=vec4(vec3(.55,.39,.20),light*.16);}',
    });const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=1;group.add(mesh);triangles+=pools.length*2;}
  }
  group.userData={buildings:buildings.length,drawCalls:group.children.length,triangles,animated:false};return group;
}

export function roadEdgeDetailLayout(track,{low=false}={}) {
  const result=[];
  for(let s=7;s<track.length;s+=low?18:12){const p=sampleTrack(s,track),yaw=Math.atan2(p.tx,p.tz);
    for(const side of [-1,1]){
      const offset=side*(track.width/2+.20),x=p.x+p.nx*offset,z=p.z+p.nz*offset;
      // Drainage and edge studs sit outside the playable surface, clear of its
      // edge line. They follow the road's actual elevation and banking grade.
      if(projectOnTrack(x,z,undefined,track).distance<track.width/2-.03)continue;
      result.push({x,y:(p.y||0)+.026,z,yaw,grade:p.grade||0,side,s});
    }
  }
  return result;
}

export function createRoadEdgeDetails(scene,track,{low=false}={}) {
  const sites=roadEdgeDetailLayout(track,{low}),group=new THREE.Group();group.name='drainage-and-road-studs';scene.add(group);
  const base=new THREE.BoxGeometry(1,1,1),parts=[],dummy=new THREE.Object3D();
  for(const site of sites){
    // A dark recessed drain and individual crossbars, not a painted icon.
    for(let i=-1;i<5;i++){
      dummy.position.set(site.x+Math.sin(site.yaw)*(i<0?0:(i-1.5)*.19),site.y+(i<0?0:.006),site.z+Math.cos(site.yaw)*(i<0?0:(i-1.5)*.19));
      dummy.rotation.set(-Math.atan(site.grade),site.yaw,0,'YXZ');dummy.scale.set(.32,.014,i<0?1.08:.055);dummy.updateMatrix();
      const g=base.clone().applyMatrix4(dummy.matrix),color=new THREE.Color(i<0?'#17222a':'#7b8586'),vertexColor=new Float32Array(g.attributes.position.count*3);
      for(let n=0;n<g.attributes.position.count;n++)vertexColor.set([color.r,color.g,color.b],n*3);g.setAttribute('color',new THREE.BufferAttribute(vertexColor,3));parts.push(g);
    }
  }
  base.dispose();
  if(parts.length){const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,metalness:.5,roughness:.6}));mesh.receiveShadow=true;group.add(mesh);}
  group.userData={sites,drawCalls:group.children.length,triangles:sites.length*6*12,animated:false};return group;
}
