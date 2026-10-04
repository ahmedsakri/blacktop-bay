import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {summitOutcropGeometry,createSummitOutcrops} from '../src/summit-rocks.js';

const placements=[
 {x:270,y:7,z:80,sx:18,sy:26,sz:20,ry:.3},
 {x:-255,y:2,z:-160,sx:35,sy:14,sz:25,ry:2.1},
 {x:100,y:4,z:-285,sx:27,sy:20,sz:29,ry:-.8},
];

test('Summit outcrops retain cleared envelopes, buried roots and finite connected surface geometry within the former rock budget',()=>{
 const original=structuredClone(placements),old=new THREE.DodecahedronGeometry(1,2),oldTriangles=old.attributes.position.count/3;
 for(const low of [false,true]){
  const geometry=summitOutcropGeometry(placements,{low}),p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,index=geometry.index;
  assert.equal(geometry.userData.outcrops,placements.length);assert.ok(index.count/3<=oldTriangles*placements.length);
  for(const attr of [p,n,uv,geometry.attributes.color])assert.ok([...attr.array].every(Number.isFinite));
  assert.equal(n.count,p.count);assert.equal(uv.count,p.count);assert.ok([...index.array].every(i=>i>=0&&i<p.count));
  let cursor=0;
  for(const [i,range]of geometry.userData.ranges.entries()){
   const rock=placements[i],cos=Math.cos(rock.ry),sin=Math.sin(rock.ry),heights=[];
   assert.equal(range.start,cursor);cursor+=range.count;
   for(let vertex=range.start;vertex<range.start+range.count;vertex++){
    const dx=p.getX(vertex)-rock.x,dz=p.getZ(vertex)-rock.z,x=(cos*dx-sin*dz)/rock.sx,z=(sin*dx+cos*dz)/rock.sz,y=(p.getY(vertex)-rock.y)/rock.sy;
    assert.ok(Math.hypot(x,z)<=1.00001,'no outcrop expands its old cleared horizontal envelope');
    assert.ok(y>=-.921&&y<=.65,'height remains within the former boulder and below its old rounded cap');
    assert.ok(Math.abs(Math.hypot(n.getX(vertex),n.getY(vertex),n.getZ(vertex))-1)<1e-5);heights.push(y);
   }
   assert.ok(heights.filter(y=>y<-.9).length>=geometry.userData.sectors,'the entire outer skirt stays buried');
   assert.ok(heights.filter(y=>y>.2).length>geometry.userData.sectors,'broken shoulders retain a broad upper mass');
  }
  // Every surface triangle winds upward, including steep bedding faces.
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<index.count;i+=3){a.fromBufferAttribute(p,index.getX(i));b.fromBufferAttribute(p,index.getX(i+1));c.fromBufferAttribute(p,index.getX(i+2));b.sub(a).cross(c.sub(a));assert.ok(b.lengthSq()>1e-10);assert.ok(b.y>0);}
  // A projection switch must never stretch an edge by dozens of texture
  // repeats. Every triangle projects into one plane at the source's 20m scale.
  for(let i=0;i<index.count;i+=3)for(let corner=0;corner<3;corner++){
   const from=index.getX(i+corner),to=index.getX(i+(corner+1)%3);
   a.fromBufferAttribute(p,from);b.fromBufferAttribute(p,to);
   const texels=Math.hypot(uv.getX(from)-uv.getX(to),uv.getY(from)-uv.getY(to));
   assert.ok(texels<=a.distanceTo(b)/20+2e-6,'all texture edges retain metre-scaled projection');
  }
  const repeat=summitOutcropGeometry(placements,{low});assert.deepEqual(repeat.attributes.position.array,p.array,'authored formations are deterministic');repeat.dispose();geometry.dispose();
 }
 assert.deepEqual(placements,original,'shared placement and clearance data is never rewritten');old.dispose();
});

test('Summit outcrops share the licensed rock textures in one static draw and remain usable without loaded maps',()=>{
 const scene=new THREE.Scene(),color=new THREE.Texture(),normal=new THREE.Texture();
 for(const maps of [{rockColor:color,rockNormal:normal},{}]){
  const mesh=createSummitOutcrops(scene,placements,{maps,low:true});
  assert.equal(mesh.material.map,maps.rockColor||null);assert.equal(mesh.material.normalMap,maps.rockNormal||null);
  assert.equal(mesh.material.vertexColors,true);assert.equal(mesh.material.roughness,1);assert.equal(mesh.material.metalness,0);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,true);
  assert.equal(scene.userData.summitOutcrops.drawCalls,1);assert.equal(scene.userData.summitOutcrops.triangles,mesh.geometry.index.count/3);
  assert.equal(mesh.userData.collision,undefined);assert.equal(mesh.userData.distanceDetail,undefined,'the static silhouette remains visible with existing world culling');
  mesh.geometry.dispose();mesh.material.dispose();mesh.removeFromParent();
 }
 color.dispose();normal.dispose();
});
