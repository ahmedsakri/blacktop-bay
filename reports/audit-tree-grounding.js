import * as T from 'three';

// Read-only inspection of the actual loaded instance geometry and terrain.
// Imported by the local renderer fixture; this file is excluded from the game.
export function auditTreeGrounding(world,camera,{width=1280,height=720}={}){
 const group=world.trees.group,terrains=[];world.scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 for(const name of ['continuous-inland-relief','continuous-coastal-district','continuous-roadside-verge','venue-terrain']){const object=world.scene.getObjectByName(name);if(object)terrains.push(object);}
 const ray=new T.Raycaster(),matrix=new T.Matrix4(),point=new T.Vector3(),project=p=>{const v=p.clone().project(camera);return {x:(v.x*.5+.5)*width,y:(.5-v.y*.5)*height,z:v.z};};
 const groundAt=(x,z)=>{ray.set(new T.Vector3(x,1000,z),new T.Vector3(0,-1,0));ray.near=0;ray.far=2000;return ray.intersectObjects(terrains,true)[0]?.point.y;};
 const rows=[];
 for(const mesh of group.children){
  if(!mesh.isInstancedMesh||!mesh.material.name.includes('trunk'))continue;
  const position=mesh.geometry.attributes.position;mesh.geometry.computeBoundingBox();const bottom=mesh.geometry.boundingBox.min.y;
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);matrix.premultiply(mesh.matrixWorld);const center=new T.Vector3().setFromMatrixPosition(matrix),basePoints=[];let minY=Infinity,maxY=-Infinity;
   for(let j=0;j<position.count;j++){point.fromBufferAttribute(position,j).applyMatrix4(matrix);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);if(position.getY(j)<=bottom+.03)basePoints.push(point.clone());}
   const ground=groundAt(center.x,center.z),base=new T.Vector3(center.x,minY,center.z),head=new T.Vector3(center.x,maxY,center.z),gaps=basePoints.map(p=>p.y-groundAt(p.x,p.z)),screen=project(base),top=project(head);
   const distance=base.distanceTo(camera.position);ray.set(camera.position,base.clone().sub(camera.position).normalize());ray.near=0;ray.far=distance-.05;
   const occluder=ray.intersectObjects(terrains,true)[0],projected=basePoints.map(project),pixels=Math.max(...projected.map(p=>p.x))-Math.min(...projected.map(p=>p.x));
   rows.push({tier:mesh.instanceMatrix.count===8||mesh.instanceMatrix.count===12?'near':'far',index:i,x:center.x,z:center.z,baseY:minY,groundY:ground,centerGap:minY-ground,footGapMin:Math.min(...gaps),footGapMax:Math.max(...gaps),basePixels:pixels,screen,top,distance,occludedBy:occluder?.object.name||null,occlusionDistance:occluder?.distance||null});
  }
 }
 const finite=rows.filter(r=>Number.isFinite(r.centerGap));
 return {treeState:world.trees.status,terrainObjects:terrains.map(o=>o.name),instances:rows.length,maxCenterGap:Math.max(...finite.map(r=>r.centerGap)),minCenterGap:Math.min(...finite.map(r=>r.centerGap)),missingGround:rows.length-finite.length,rows};
}
