import * as THREE from 'three';
/** Readable original Nitro capsules; bounded meshes share their geometry. */
export function createPickupView(scene, pickups=[]) {
  const root=new THREE.Group();root.name='collectible-nitro';scene.add(root);
  const shell=new THREE.MeshPhysicalMaterial({color:'#27aaff',metalness:.25,roughness:.12,clearcoat:1,emissive:'#075dab',emissiveIntensity:.8});
  const cap=new THREE.MeshStandardMaterial({color:'#fff71e',metalness:.65,roughness:.25});
  const bright=new THREE.MeshBasicMaterial({color:'#91e4ff',toneMapped:false});
  const body=new THREE.CylinderGeometry(.32,.32,1.04,12),lid=new THREE.CylinderGeometry(.19,.19,.2,10);
  const ring=new THREE.TorusGeometry(.83,.038,5,28),strip=new THREE.BoxGeometry(.055,.7,.06);
  const nodes=pickups.map(p=>{
    const g=new THREE.Group();g.name=p.id;g.position.set(p.x,(p.y||0)+1.32,p.z);root.add(g);
    const capsule=new THREE.Mesh(body,shell);g.add(capsule);
    const neck=new THREE.Mesh(lid,cap);neck.position.y=.61;g.add(neck);
    for(const side of [-1,1]){const line=new THREE.Mesh(strip,bright);line.position.z=side*.323;line.rotation.z=-.3;g.add(line);}
    const halo=new THREE.Mesh(ring,bright);halo.rotation.x=-Math.PI/2;halo.position.y=-.93;g.add(halo);
    return {g,halo,p,available:true,pulse:0};
  });
  let motionTime=0;
  return {update(items,time,active,reduced=false,dt=0){
    motionTime+=Math.max(0,Math.min(.06,dt));
    root.visible=active;
    for(let i=0;i<nodes.length;i++){const n=nodes[i],p=items[i];if(!p)continue;
      const available=p.playerAvailable!==false;
      if(n.available&&!available)n.pulse=.4;
      n.available=available;n.pulse=Math.max(0,n.pulse-dt);
      n.g.visible=available||n.pulse>0;
      n.g.position.y=(p.y||0)+1.32+(reduced?0:Math.sin(motionTime*2+i)*.13);
      n.g.rotation.y=reduced?0:motionTime*.7+i;
      n.g.scale.setScalar(available?1:Math.max(.01,n.pulse/.4));
      n.halo.scale.setScalar(available?1:1+(1-n.pulse/.4)*2);
    }
  },dispose(){root.removeFromParent();for(const g of [body,lid,ring,strip])g.dispose();for(const m of [shell,cap,bright])m.dispose();}};
}
