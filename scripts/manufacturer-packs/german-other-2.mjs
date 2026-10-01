// The archive has geometry but no embedded textures. Its one Wheel material
// spans distinct tyre/rim/brake/axle components, so retain whole components and
// give each a physical material instead of inventing a texture or livery.
function repairAudiWheelMaterials(root) {
 const roles = {
  1024: ['tyre', [.012,.014,.017,1], 0, .86],
  4624: ['rim', [.34,.36,.39,1], .85, .3],
  560: ['disc', [.18,.19,.2,1], .85, .4],
  136: ['hub', [.2,.22,.24,1], .8, .32],
  18: ['nuts', [.35,.37,.4,1], .9, .26],
  771: ['caliper', [.3,.012,.009,1], .45, .38],
  20: ['axle', [.045,.05,.055,1], .6, .65],
 };
 const counts = new Map();
 for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  if (p.getMaterial()?.getName() !== 'Wheel') continue;
  const positions=p.getAttribute('POSITION').getArray(), indices=p.getIndices().getArray();
  const parents=Int32Array.from({length:positions.length/3},(_,i)=>i), keys=new Map();
  const find=i=>{let r=i;while(parents[r]!==r)r=parents[r];while(parents[i]!==i){let next=parents[i];parents[i]=r;i=next;}return r;};
  const union=(a,b)=>parents[find(a)]=find(b);
  for(let i=0;i<parents.length;i++){
   const key=[positions[i*3],positions[i*3+1],positions[i*3+2]].map(v=>Math.round(v*1e5)).join(',');
   if(keys.has(key))union(i,keys.get(key));else keys.set(key,i);
  }
  for(let i=0;i<indices.length;i+=3){union(indices[i],indices[i+1]);union(indices[i],indices[i+2]);}
  const components=new Map();
  for(let i=0;i<indices.length;i+=3){const key=find(indices[i]);if(!components.has(key))components.set(key,[]);components.get(key).push(indices[i],indices[i+1],indices[i+2]);}
  for(const component of components.values()){
   const role=roles[component.length/3];
   if(!role)throw new Error('Unreviewed Audi wheel component: '+component.length/3);
   const [name,color,metal,rough]=role;
   counts.set(name,(counts.get(name)||0)+1);
   const material=p.getMaterial().clone().setName('audi-wheel-'+name).setBaseColorFactor(color).setMetallicFactor(metal).setRoughnessFactor(rough);
   const part=p.clone().setMaterial(material);
   part.setIndices(p.getIndices().clone().setArray(new indices.constructor(component)));
   mesh.addPrimitive(part);
  }
  p.dispose();
 }
 for(const role of ['tyre','rim','disc','hub','caliper','axle'])if(counts.get(role)!==4)throw new Error('Audi needs four complete '+role+' components');
 if(counts.get('nuts')!==20)throw new Error('Audi needs twenty wheel nuts');
}

// Individually attributed sources; raw UID.glb and verified UID.json live in --sources.
export default [{
 id:'mclaren-650s-gt3',uid:'2d0dcf63909f40b0b4546726606414e7',brand:'McLaren',model:'650S GT3',length:4.65,
 paint:['carpaint'],wheel:n=>/^Wheel_/.test(n),brake:['redglass'],alignWheelContact:true,
 simplifyPermissive:true,highBudget:350000,lowBudget:130000,highSecondaryError:.002,lowError:.007,
 extraChanges:'Retained the four individually authored wheel assemblies and source livery; corrected archived glass, paint, tire, metal and interior material roles for the game renderer.',
 repairMaterials(root){for(const m of root.listMaterials()){
  const n=m.getName();m.setEmissiveFactor([0,0,0]);
  if(n==='carpaint')m.setMetallicFactor(.58).setRoughnessFactor(.25);
  else if(n==='windowglass')m.setBaseColorFactor([.035,.065,.085,.65]).setMetallicFactor(.12).setRoughnessFactor(.12).setAlphaMode('BLEND');
  else if(n==='clearglass')m.setBaseColorFactor([.6,.72,.8,.34]).setMetallicFactor(.12).setRoughnessFactor(.1).setAlphaMode('BLEND');
  else if(n==='chrome'||n==='mirror')m.setMetallicFactor(.95).setRoughnessFactor(.2);
  else if(n==='tire')m.setMetallicFactor(0).setRoughnessFactor(.85);
  else if(n==='brakedisk'||n==='rim_second'||n==='material_17')m.setMetallicFactor(.88).setRoughnessFactor(n==='brakedisk'?.4:.26);
  else if(n==='carbon')m.setMetallicFactor(.15).setRoughnessFactor(.4);
  else if(n==='redglass')m.setBaseColorFactor([.48,.008,.014,1]).setMetallicFactor(.1).setRoughnessFactor(.23);
  else if(n==='black'||n==='interior')m.setMetallicFactor(.03).setRoughnessFactor(.7);
 }},
}, {
 id:'bmw-m3-e46',uid:'f1b00ff37d504629b10031da32bc7497',brand:'BMW',model:'M3 E46 Coupé',length:4.492,
 paint:['Car_Paint_-_All_Colors'],
 wheel:n=>/^Object_(100|102|103|105|107|109|118|120|121|123|125|127|206|207|209|211|213|221|223|224|226|228|230|238)$/.test(n),
 wheelYaw:{wheel_front_left:20*Math.PI/180,wheel_front_right:20*Math.PI/180},alignWheelContact:true,
 brake:['Glass_-_Red_-_Bump','Glass_ext-red','Glass_-_Red_-_Rough_0.4'],
 simplifyPermissive:true,highBudget:360000,lowBudget:130000,highSecondaryError:.0015,lowError:.006,
 extraChanges:'Preserved the author’s M3 E46 coupe identity and surfaces. Neutralized the source’s 20-degree front wheel steering before animation; isolated paint from calipers, trim and glass.',
 repairMaterials(root){for(const m of root.listMaterials()){
  const n=m.getName();m.setEmissiveFactor([0,0,0]);
  if(n==='Car_Paint_-_All_Colors')m.setMetallicFactor(.6).setRoughnessFactor(.26);
  else if(n==='tire-low')m.setBaseColorFactor([.017,.019,.021,1]).setMetallicFactor(0).setRoughnessFactor(.84);
  else if(n==='Alu_ext'||n.startsWith('Metal_'))m.setRoughnessFactor(Math.max(.18,Math.min(.4,m.getRoughnessFactor())));
  else if(n==='Brake_Disc')m.setRoughnessFactor(.4);
  else if(n==='Glass_ext'||n==='Glass_ext-tinted')m.setBaseColorFactor([.035,.055,.07,n==='Glass_ext-tinted'?.68:.55]).setMetallicFactor(.1).setRoughnessFactor(.12).setAlphaMode('BLEND');
  else if(n.startsWith('Glass')&&/Red|red/.test(n))m.setBaseColorFactor([.48,.008,.012,.95]).setMetallicFactor(.1).setRoughnessFactor(.2).setAlphaMode('BLEND');
  else if(n.startsWith('Glass')||n==='glass-simple')m.setBaseColorFactor([.65,.75,.8,.4]).setMetallicFactor(.1).setRoughnessFactor(.12).setAlphaMode('BLEND');
  else if(n==='Headlamp_bulb')m.setBaseColorFactor([.7,.8,.9,1]).setRoughnessFactor(.25);
  else if(n==='Black_Diffuse'||n==='Plastic_int_matt')m.setMetallicFactor(0).setRoughnessFactor(.6);
 }},
}, {
 id:'audi-quattro-rally',uid:'10ad6b7608474ec8aac778934723c151',brand:'Audi',model:'Quattro Rally',length:4.404,
 paint:['UV_Set_1_Body'],wheel:(_n,m)=>/^audi-wheel-(tyre|rim|disc|hub|nuts)$/.test(m),brake:['Brake_Light','Brake_light_cover'],alignWheelContact:true,
 extraChanges:'The archived original contains no embedded textures or livery maps. Retained the complete rally body, auxiliary lights and cabin; assigned material colors to named trim, lamps, rubber and metal. Separated each complete tyre, rim, disc, hub and wheel-nut component for articulation, keeping calipers and axles static. Both detail levels retain the complete source geometry because it is already within the mobile budget.',
 repairMaterials(root){
  repairAudiWheelMaterials(root);
  for(const m of root.listMaterials()){
   const n=m.getName();m.setEmissiveFactor([0,0,0]);
   if(n.startsWith('audi-wheel-'))continue;
   if(n==='UV_Set_1_Body')m.setBaseColorFactor([.58,.6,.56,1]).setMetallicFactor(.35).setRoughnessFactor(.32);
   else if(n==='Windows')m.setBaseColorFactor([.025,.045,.055,.65]).setMetallicFactor(.1).setRoughnessFactor(.14).setAlphaMode('BLEND');
   else if(n==='Brake_Light'||n==='Brake_light_cover')m.setBaseColorFactor([.45,.005,.008,.95]).setMetallicFactor(.1).setRoughnessFactor(.23).setAlphaMode('BLEND');
   else if(n==='indicater_light'||n==='indicator_cover')m.setBaseColorFactor([.7,.16,.006,n==='indicator_cover'?.7:1]).setMetallicFactor(.1).setRoughnessFactor(.28).setAlphaMode(n==='indicator_cover'?'BLEND':'OPAQUE');
   else if(n==='Headlight_cover'||n==='Reverse_Cover')m.setBaseColorFactor([.5,.6,.65,.38]).setMetallicFactor(.1).setRoughnessFactor(.15).setAlphaMode('BLEND');
   else if(n==='Rally_lights'||n==='White_light')m.setBaseColorFactor([.65,.68,.58,1]).setMetallicFactor(.15).setRoughnessFactor(.2);
   else if(['Audi_logo','wingMirror_reflective','exhaust','Headlights_inner'].includes(n))m.setBaseColorFactor([.32,.35,.38,1]).setMetallicFactor(.85).setRoughnessFactor(.28);
   else if(n==='Roll_cage')m.setBaseColorFactor([.35,.37,.38,1]).setMetallicFactor(.4).setRoughnessFactor(.4);
   else if(['Rubber_door','Black_matte','Grill','Rear_air_filter','Handle','Wipers','Steering_wheel','Floor','interior','Seats','mesh','wingmirror','Headlights_case','Rally_lights_frame','lambert1','Rear_light_interior'].includes(n))m.setBaseColorFactor([.018,.021,.024,1]).setMetallicFactor(.03).setRoughnessFactor(.72);
  }
 },
}];
