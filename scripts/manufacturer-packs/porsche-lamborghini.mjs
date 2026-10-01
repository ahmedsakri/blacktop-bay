// Isolated manufacturer expansion; original UID.glb + UID.json remain untouched.
// Current API license evidence and embedded author attribution are retained by the pipeline.
const surface=(m,color,metal,rough,alpha='OPAQUE')=>m.setBaseColorFactor(color).setMetallicFactor(metal).setRoughnessFactor(rough).setEmissiveFactor([0,0,0]).setAlphaMode(alpha);
export default [
 {
  id:'porsche-911-gt3', uid:'78d5c47ab2554c2592b7e499179a0792', brand:'Porsche', model:'911 GT3', length:4.545, lowBudget:155000,
  paint:['EXT_Carpaint.004'],
  extraChanges:'Removed authored alternate blurred rim and damage overlay. Restored exterior paint, rubber, alloy, glass and brake material roles.',
  wheel:(n,m)=>['EXT_Rim.004','EXT_Tyre.004','EXT_Disc.001'].includes(m),
  // Authored alternate blurred wheel and damage-only layer overlap the intact model.
  exclude:(n,m)=>n==='Object_20'||m==='DAMAGE_GLASS.004',
  brake:['EXT_Glass_Light_INT.001','rear-brake-lights'], splitRearLampMaterials:['EXT_Flat_Light.001'],
  repairMaterials(root){for(const m of root.listMaterials()){
   const n=m.getName();
   if(n==='EXT_Carpaint.004')m.setMetallicFactor(.5).setRoughnessFactor(.25);
   else if(n==='EXT_Rim.004')surface(m,[.11,.13,.16,1],.9,.28);
   else if(n==='EXT_Tyre.004')surface(m,[.014,.016,.019,1],0,.87);
   else if(n==='EXT_Disc.001')surface(m,[.28,.3,.32,1],.85,.38);
   else if(n==='Brake_Caliper.001')surface(m,[.62,.018,.008,1],.25,.33);
   else if(n==='EXT_Glass_Windows.001'||n==='INT_Windows.001')surface(m,[.028,.045,.057,.56],.1,.11,'BLEND');
   else if(n==='EXT_Glass_light_EXT.001')surface(m,[.31,.39,.44,.32],.1,.08,'BLEND');
   else if(n==='EXT_Glass_Light_INT.001')surface(m,[.5,.005,.011,1],.1,.21);
   else if(n==='EXT_Front_Light_chrome.001')surface(m,[.55,.59,.64,1],.94,.15);
   else if(n==='EXT_Mechanics_aluminium.001')m.setRoughnessFactor(.3);
  }}
 },
 {
  id:'lamborghini-gallardo', uid:'e6a7d7e98f4c46ca841eb930184b0f09', brand:'Lamborghini', model:'Gallardo · 2004', length:4.3, flip:true,
  paint:['Main_Body'],
  extraChanges:'Original texture maps retained, with glass alpha/roughness corrected for the game renderer.',
  wheel:(n,m,ancestry)=>['Rims','Tires','disk'].includes(m)||(m==='Lamborghini_Logo'&&ancestry.some(a=>/Rims_/.test(a))),
  brake:['Tail_lights_red'],
  repairMaterials(root){for(const m of root.listMaterials()){
   const n=m.getName();
   if(n==='Main_Body')m.setMetallicFactor(.6).setRoughnessFactor(.3);
   else if(n==='Tires')m.setMetallicFactor(0).setRoughnessFactor(.86);
   else if(n==='WindshieldWindows')surface(m,[.025,.045,.055,.48],.12,.1,'BLEND');
   else if(n==='Headlights_Glass')surface(m,[.4,.5,.58,.3],.1,.08,'BLEND');
   else if(n==='Tail_lights_Glass')surface(m,[.3,.005,.009,.25],.1,.13,'BLEND');
   else if(n==='Tail_lights_Glass_white')surface(m,[.4,.44,.47,.22],.1,.13,'BLEND');
  }}
 }
 ,{
  id:'lamborghini-huracan', uid:'b2f5c24c44fd417fb89286603af9b5a5', brand:'Lamborghini', model:'Huracán', length:4.459,
  paint:['huracan-paint'], wheel:n=>/^wheel(?:_blac|_tire|1)?__0$/.test(n),
  componentWheels:true, wheelCandidate:n=>n==='brushed_st__0',
  wheelRegions:[{x:88,y:21.32,z:130.03,r:35.06,w:26},{x:88,y:21.32,z:-132.57,r:35.06,w:26}],
  brake:['huracan-rear-lights'], simplifyPermissive:true, highBudget:300000, lowBudget:110000, highSecondaryError:.003,lowError:.01,
  extraChanges:'The author export had one blank material for all geometry. Assigned PBR roles to the authored named body, tire, rim, glass, metal, interior and lamp meshes; retained detailed authored body topology.',
  repairPrimitive({doc,primitive,nodeName}){
   let name='huracan-trim',color=[.023,.026,.031,1],metal=.12,rough=.55,alpha='OPAQUE';
   if(nodeName==='main_body__1__0'){name='huracan-paint';color=[.95,.28,.007,1];metal=.55;rough=.25;}
   else if(nodeName==='wheel_tire__0'||nodeName==='wheel1__0'){name='huracan-rubber';color=[.014,.016,.019,1];metal=0;rough=.86;}
   else if(nodeName==='wheel_blac__0'||nodeName==='wheel__0'){name='huracan-alloy';color=[.19,.21,.24,1];metal=.9;rough=.28;}
   else if(nodeName==='side_glass__0'||nodeName==='Lambo_Glas__0'){name='huracan-glass';color=[.035,.055,.07,.5];metal=.12;rough=.1;alpha='BLEND';}
   else if(nodeName==='red_light___0'||nodeName==='lambo_red___0'){name='huracan-rear-lights';color=[.5,.007,.012,1];metal=.14;rough=.22;}
   else if(nodeName==='headlight___0'){name='huracan-headlights';color=[.7,.78,.86,1];metal=.3;rough=.14;}
   else if(nodeName==='Lambo_Chro_1__0'){name='huracan-chrome';color=[.43,.47,.52,1];metal=.92;rough=.22;}
   else if(nodeName==='brushed_st__0'||nodeName==='Lambo_Stee__0'){name='huracan-steel';color=[.26,.29,.32,1];metal=.86;rough=.34;}
   else if(nodeName==='main_calip__0'){name='huracan-caliper';color=[.65,.022,.008,1];metal=.3;rough=.33;}
   else if(nodeName==='front_logo__0'){name='huracan-badge';color=[.49,.36,.07,1];metal=.85;rough=.28;}
   else if(nodeName==='rubber_bod_1__0'||nodeName==='Lambo_Plas__0'||nodeName==='pads_1__0'){name='huracan-plastic';color=[.018,.021,.026,1];metal=0;rough=.73;}
   else if(nodeName==='digital_di__0'){name='huracan-display';color=[.008,.014,.021,1];metal=.1;rough=.19;}
   let m=doc.getRoot().listMaterials().find(m=>m.getName()===name);
   if(!m){m=doc.createMaterial(name);surface(m,color,metal,rough,alpha);m.setDoubleSided(true);if(name==='huracan-headlights')m.setEmissiveFactor([.08,.09,.11]);}
   primitive.setMaterial(m);
  }
 }
];
