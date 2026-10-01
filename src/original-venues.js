import * as THREE from 'three';
import { projectOnTrack, sampleTrack } from './track.js';

// Environment overrides belong only to the four authored expansion routes.
// They do not recolour the established bay or the real-venue adaptations.
export const ORIGINAL_VENUE_PROFILES = {
  breakwater: { towers:0, vegetation:'coastal-scrub', ground:'#414945', horizon:'#374551', horizonScale:1.55, sun:'#ffd1a0', sunHeight:60, fogDensity:.0009 },
  'copper-canyon': { ground:'#99684b', horizon:'#925f47', horizonScale:1.65, sun:'#ffcf91', sunHeight:100, bounce:'#a36648', fogDensity:.0007 },
  'cedar-ridge': { vegetation:'conifers', ground:'#42553b', horizon:'#526861', horizonScale:2.3, sun:'#fff0d1', sunHeight:120, fogDensity:.00095 },
  'neon-freight': { towers:22, ground:'#262c34', horizon:'#263445', fill:'#b6a2f0', fillIntensity:.72, fogDensity:.0011 },
};

const LANDMARKS = {
  breakwater: [['lighthouse',.105,1,18,29],['basalt',.24,-1,24,16],['basalt',.42,1,29,22],['basalt',.60,-1,25,18],['basalt',.79,1,27,20]],
  'copper-canyon': [['mesa',.14,1,30,30],['mesa',.29,-1,32,34],['mesa',.47,1,27,27],['mesa',.67,-1,34,38],['mesa',.83,1,29,31]],
  'cedar-ridge': [['lodge',.13,1,18,9],['lodge',.40,-1,20,11],['lodge',.69,1,18,9],['lodge',.86,-1,16,8]],
  'neon-freight': [['freight',.12,1,24,23],['freight',.31,-1,22,20],['freight',.52,1,26,25],['freight',.74,-1,24,22],['freight',.89,1,22,21]],
};

/** Conservatively bounded footprints; a failed placement is omitted instead of
 * covering the road, a second nearby bend, another landmark or a grandstand. */
export function originalLandmarkLayout(track, { stands = [], low = false } = {}) {
  const result=[];
  for(const [kind,fraction,side,radius,height] of LANDMARKS[track.scenery] || []) {
    for(const delta of [0,.018,-.018,.036,-.036]) {
      const distance=track.length*(fraction+delta),p=sampleTrack(distance,track);
      const offset=side*(track.width/2+radius+22);
      const x=p.x+p.nx*offset,z=p.z+p.nz*offset;
      if(projectOnTrack(x,z,undefined,track).distance<track.width/2+radius+12)continue;
      if(stands.some(s=>Math.hypot(x-s.x,z-s.z)<radius+16))continue;
      if(result.some(item=>Math.hypot(x-item.x,z-item.z)<radius+item.radius+8))continue;
      result.push({kind,x,z,radius,height,yaw:Math.atan2(p.tx,p.tz),detail:low?'mobile':'desktop'});
      break;
    }
  }
  return result;
}

function roofGeometry() {
  const p=[-.5,0,-.5,.5,0,-.5,0,1,-.5,-.5,0,.5,.5,0,.5,0,1,.5];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);g.computeVertexNormals();return g;
}

function mesaGeometry(low) {
  const radial=low?56:88, levels=low?20:30, positions=[], colors=[], uvs=[], indices=[];
  const sandstone=new THREE.Color('#a87956'), weathered=new THREE.Color('#765440');
  const color=new THREE.Color();
  const radiusAt=y=>y<.30?1-Math.pow(y/.30,.72)*.28:.72-(y-.30)*.14;
  const vertex=(a,y,cap=false)=>{
    // Long fractures erode the wall vertically. Their changing depth and
    // irregular crown keep the silhouette from becoming a concentric lathe.
    const outline=.88+.055*Math.sin(a*3+.3)+.036*Math.sin(a*7-1.1)+.024*Math.cos(a*13+.4);
    const fissure=Math.pow(.5+.5*Math.sin(a*17+Math.sin(a*4)*1.1),10)*(.018+.036*y);
    const erosion=.012*Math.sin(a*23+y*7)+.009*Math.cos(a*11-y*13);
    const strata=.010*Math.sin(y*47+Math.sin(a*3)*.8)+.006*Math.sin(y*103+a*.3);
    const r=radiusAt(y)*(outline-fissure+erosion+strata);
    const crown=.975+.015*Math.sin(a*5)+.009*Math.cos(a*9+.3);
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    positions.push(x,y*crown,z);
    const mineral=.44+.12*Math.sin(y*39+.3*Math.sin(a*3))+.07*Math.sin(y*101+a*.2);
    const grain=.035*Math.sin(a*43+y*113)+.025*Math.sin(a*71-y*137);
    color.copy(sandstone).lerp(weathered,THREE.MathUtils.clamp(mineral+grain+fissure*2,0,1));
    colors.push(color.r,color.g,color.b);
    uvs.push(cap?x*.5+.5:a/(Math.PI*2)*5,cap?z*.5+.5:y*3);
  };
  for(let y=0;y<=levels;y++)for(let i=0;i<=radial;i++)vertex(i/radial*Math.PI*2,y/levels);
  for(let y=0;y<levels;y++)for(let i=0;i<radial;i++){
    const a=y*(radial+1)+i,b=a+radial+1;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  // Separate cap vertices preserve the natural ledge at the crown without
  // forcing every stratum into a separate overhanging cylinder.
  const cap=positions.length/3;
  positions.push(0,.975,0);colors.push(sandstone.r*.82,sandstone.g*.82,sandstone.b*.82);uvs.push(.5,.5);
  for(let i=0;i<=radial;i++)vertex(i/radial*Math.PI*2,1,true);
  for(let i=0;i<radial;i++)indices.push(cap,cap+i+2,cap+i+1);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

function sandstoneMaterial() {
  // Small local mineral-grain texture; no third-party image download or
  // expensive per-frame noise. The large geometry supplies the actual shape.
  const size=128,pixels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const hash=Math.sin(x*127.1+y*311.7)*43758.5453;
    const fine=hash-Math.floor(hash);
    const vein=Math.sin(y*.27+Math.sin(x*.15)*.6)*.12;
    const value=Math.round(128+(fine-.5)*75+vein*80),p=(y*size+x)*4;
    pixels[p]=pixels[p+1]=pixels[p+2]=value;pixels[p+3]=255;
  }
  const bump=new THREE.DataTexture(pixels,size,size);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;
  bump.magFilter=THREE.LinearFilter;bump.minFilter=THREE.LinearMipmapLinearFilter;bump.generateMipmaps=true;bump.needsUpdate=true;
  return new THREE.MeshStandardMaterial({color:'white',vertexColors:true,roughness:.96,metalness:0,bumpMap:bump,bumpScale:.24});
}

/** Original physical landmarks, batched across the venue. No image downloads
 * or third-party models, and no objects are placed on the racing asphalt. */
export function createOriginalLandmarks(scene, track, { low=false, stands=[] }={}) {
  const layouts=originalLandmarkLayout(track,{low,stands}), lists=new Map(), beacons=[];
  if(!layouts.length)return {update(){}};
  const geometries={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,low?10:16),
    taper:new THREE.CylinderGeometry(.76,1,1,low?10:16),stone:new THREE.DodecahedronGeometry(1,low?0:1),
    mesa:mesaGeometry(low),roof:roofGeometry(),glass:new THREE.BoxGeometry(1,1,1),light:new THREE.BoxGeometry(1,1,1)};
  const material=new THREE.MeshStandardMaterial({color:'white',roughness:.83,metalness:.08});
  const glass=new THREE.MeshStandardMaterial({color:'#1c343b',roughness:.21,metalness:.48});
  const light=new THREE.MeshBasicMaterial({color:'white',toneMapped:false});
  const rock=layouts.some(site=>site.kind==='mesa')?sandstoneMaterial():null;
  const dummy=new THREE.Object3D(), color=new THREE.Color();
  function piece(site,kind,x,y,z,sx,sy,sz,tint,ry=0){
    const c=Math.cos(site.yaw),s=Math.sin(site.yaw);
    const list=lists.get(kind)||[];
    list.push({x:site.x+c*x+s*z,y,z:site.z-s*x+c*z,sx,sy,sz,tint,ry:site.yaw+ry});lists.set(kind,list);
  }
  for(const site of layouts){
    const {radius:r,height:h}=site;
    if(site.kind==='lighthouse'||site.kind==='basalt'){
      // A solid rocky island anchors the sea-wall rather than floating scenery.
      piece(site,'stone',0,-1,0,r*.96,4,r*.88,'#3b454a',.3);
      for(let i=0;i<(low?11:18);i++){
        const a=i*2.399,ring=(.25+(i%4)*.16)*r,height=site.kind==='lighthouse'?2.7+i%4:h*(.28+(i%5)*.10);
        piece(site,'taper',Math.cos(a)*ring,height/2-1,Math.sin(a)*ring,1.8+(i%3)*.48,height,1.5+(i%2)*.6,i%3?'#475359':'#5b6467',a);
      }
      if(site.kind==='lighthouse'){
        piece(site,'cylinder',0,.55,0,5.1,1.7,5.1,'#777d78');
        for(let band=0;band<6;band++){
          const radius=3.7-band*.24;
          piece(site,'taper',0,2.7+band*3.65,0,radius,3.8,radius,band%2?'#ebe5d4':'#a54c3b');
        }
        piece(site,'cylinder',0,h-4,0,3.35,.8,3.35,'#303b43');
        piece(site,'glass',0,h-2.9,0,3.8,2.4,3.8,'#305460');
        for(const x of [-2.05,2.05])for(const z of [-2.05,2.05])piece(site,'box',x,h-2.8,z,.16,2.8,.16,'#b8bcb5');
        piece(site,'roof',0,h-1.6,0,5.1,1.8,5.1,'#36494d',Math.PI/4);
        const beacon=new THREE.Mesh(new THREE.BoxGeometry(4.3,.25,.2),light);beacon.name='lighthouse-beacon';beacon.position.set(site.x,h-2.65,site.z);scene.add(beacon);beacons.push(beacon);
      }
    }else if(site.kind==='mesa'){
      // One continuous eroded rock face, with subtle mineral bands instead of
      // visibly separate, uniformly coloured stacked tiers.
      piece(site,'mesa',0,-.8,0,r*.98,h,r*.89,'#ffffff',.13);
      for(let i=0;i<4;i++){
        const a=i*1.5,offset=r*.65;
        piece(site,'stone',Math.cos(a)*offset,1.4,Math.sin(a)*offset,3.7,3.2,3.3,'#9c7052',a);
      }
    }else if(site.kind==='lodge'){
      const width=r*1.25,depth=r*.82,wall=h*.60;
      piece(site,'box',0,.3,0,width+1,1,depth+1,'#6c7068');
      piece(site,'box',0,wall/2+.7,0,width,wall,depth,'#795b43');
      piece(site,'roof',0,wall+.6,0,width+2,h*.38,depth+2,'#35463d');
      for(let i=0;i<7;i++)for(const side of [-1,1]){
        const x=(i-3)*width/7,z=side*(depth/2+.02);
        piece(site,'box',x,wall/2+.7,z,.12,wall,.12,'#a48861');
        if(i%2)piece(site,'glass',x,wall*.58+.5,z+side*.08,width*.091,wall*.36,.10,'#28463f');
        if(i%2)piece(site,'light',x,wall*.54+.5,z+side*.15,width*.069,wall*.28,.02,'#d8a86a');
      }
      piece(site,'box',width*.27,wall+1.5,0,1.6,3.9,1.7,'#746d62');
      for(const side of [-1,1])piece(site,'box',side*width*.40,1,depth*.69,.20,2,.20,'#75664f');
      piece(site,'box',0,1.9,depth*.69,width*.82,.17,.17,'#a18d6b');
    }else if(site.kind==='freight'){
      piece(site,'box',0,-.22,0,r*1.40,.32,r*1.35,'#424750');
      const tints=['#755345','#355d66','#826c3a','#55466a'];
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const x=(col-1)*4.2,z=(row-.5)*13.5,layers=(row+col)%2+1;
        for(let level=0;level<layers;level++){
          const y=1.35+level*2.64,tint=tints[(col+row+level)%tints.length];
          piece(site,'box',x,y,z,3.45,2.6,11.8,tint);
          for(const side of [-1,1])for(let rib=0;rib<(low?8:13);rib++){
            const along=-5.5+rib*11/(low?7:12);
            piece(site,'box',x+side*1.755,y,z+along,.08,2.42,.11,tint);
          }
          piece(site,'box',x,y,z+5.94,.09,2.4,.08,'#b0a58c');
          piece(site,'box',x+1,y,z+5.95,.045,2.28,.07,'#b0a58c');
        }
      }
      // The complete crane footprint stays within the placement's safe radius.
      for(const x of [-r*.64,r*.64])for(const z of [-r*.46,r*.46]){
        piece(site,'box',x,h*.48,z,.65,h*.96,.65,'#847144');
        piece(site,'box',x,.45,z,2.3,.9,2.3,'#5d6265');
      }
      for(const z of [-r*.46,r*.46]){
        piece(site,'box',0,h,z,r*1.36,1.2,.9,'#a29366');
        for(let i=0;i<8;i++)piece(site,'box',(i-3.5)*r*.16,h+.75,z,.10,1.05,.1,'#baad83');
        piece(site,'light',0,h-.66,z,r*1.29,.045,.045,'#c4bbec');
      }
      piece(site,'box',r*.64,h,0,.9,.8,r*.95,'#9b8960');
      piece(site,'box',-r*.23,h-.7,0,3.5,1.5,4,'#495c66');
      for(const x of [-r*.23-.9,-r*.23+.9])piece(site,'box',x,h*.67,0,.035,h*.52,.035,'#293238');
      piece(site,'box',-r*.23,h*.40,0,3,.55,2.5,'#cebb77');
    }
  }
  for(const [kind,list] of lists){
    const mesh=new THREE.InstancedMesh(geometries[kind],kind==='glass'?glass:kind==='light'?light:kind==='mesa'?rock:material,list.length);
    mesh.name=`original-landmarks-${kind}`;
    list.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.ry,0);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.set(p.tint));});
    mesh.computeBoundingSphere();mesh.receiveShadow=true;scene.add(mesh);
  }
  // Unused geometries were never added to the world disposal traversal.
  for(const [kind,geometry]of Object.entries(geometries))if(!lists.has(kind))geometry.dispose();
  if(!lists.has('glass'))glass.dispose();
  if(!lists.has('light')&&!beacons.length)light.dispose();
  scene.userData.originalLandmarks=layouts.map(({kind,x,z,radius})=>({kind,x,z,radius}));
  let lastTime=0,beaconTime=0;
  return {update(time,{paused=false,reducedMotion=false}={}){
    const dt=Math.max(0,Math.min(.1,time-lastTime));lastTime=time;if(paused||reducedMotion)return;
    beaconTime+=dt;for(const beacon of beacons)beacon.rotation.y=beaconTime*.28;
  }};
}
