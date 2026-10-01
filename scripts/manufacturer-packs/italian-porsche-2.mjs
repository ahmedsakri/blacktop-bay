// Isolated second Italian/Porsche expansion. Supply untouched UID.glb + UID.json sources.
// No package imports or machine-specific paths: works with the shared preparation pipeline.
const surface=(m,c,metal,rough,alpha='OPAQUE')=>m.setBaseColorFactor(c).setMetallicFactor(metal).setRoughnessFactor(rough).setEmissiveFactor([0,0,0]).setAlphaMode(alpha);
const invisible919=new Set(['5837316035156378112_1_1','Mobil1_2_white','5837316035156378112_1_1.001','adidas-9','chopard','chopard.Black','chopard.001','Cockpit','dhl-logo','dmg-mori-2_White','dmg-mori-2.001','Flag_of_Germany','material','HYBRID-removebg-preview','michelin-15.001','michelin-15','michelin-6-removebg-preview-removebg-preview','MOBIL1','p1_1','material_43','porsche-6-removebg-preview','porsche-removebg-preview','Porsche_Letters-removebg-preview','stickers_919_Side','wec-world-endurance-championship','Material','Porsche_Letters-removebg-preview_1']);
export default [
 {
  id:'lamborghini-countach-lp500s',uid:'32e9ee8d129e4c2992e1753b4fc3094c',brand:'Lamborghini',model:'Countach LP500S',length:4.14,flip:true,alignWheelContact:true,
  paint:['CARO'],wheel:(n,m)=>['Material.012','Material.013','Material.014','Material.016','Material.017'].includes(m),
  brake:['Material.001','Material.004'],
  extraChanges:'Source credits the rim contribution to Lexyc16 (https://sketchfab.com/Lexyc16). Preserved the authored complete model and rim geometry, isolated four wheels, restored paint/rubber/alloy/glass roles, and aligned tyre contact.',
  repairMaterials(root){for(const m of root.listMaterials()){
   const n=m.getName();
   if(n==='CARO')m.setMetallicFactor(.48).setRoughnessFactor(.27);
   else if(n==='Material.016')surface(m,[.018,.019,.021,1],0,.88);
   else if(['Material.012','Material.013','Material.014'].includes(n))m.setMetallicFactor(.88).setRoughnessFactor(.3);
   else if(n==='Material.017')m.setMetallicFactor(.75).setRoughnessFactor(.4);
   else if(n==='GLASS')surface(m,[.023,.035,.042,.62],.1,.14,'BLEND');
   else if(n==='Material.006')surface(m,[.5,.56,.61,.24],.05,.1,'BLEND');
   else if(n==='CHROME')m.setMetallicFactor(.92).setRoughnessFactor(.2);
   else if(n==='Black')m.setMetallicFactor(.12).setRoughnessFactor(.57);
  }}
 },
 {
  id:'ferrari-enzo',uid:'96c16ea6d7704ad397a8f02bf0250bff',brand:'Ferrari',model:'Enzo',length:4.702,alignWheelContact:true,
  paint:['Carpaint_Flakes_Wine_Red'],wheel:(n,m,a)=>a.some(x=>/^wheel[1-4]_/i.test(x))||/^Object_(245|247|249|251|253|255)$/.test(n),brake:['rearlamp','rearlamp-s'],
  simplifyPermissive:true,highBudget:420000,lowBudget:150000,highSecondaryError:.0012,lowError:.006,
  extraChanges:'Archived creator/license metadata agrees with original embedded CC BY 4.0 attribution; current Sketchfab listing returns 404. Restored paint and glass PBR roles, preserved original maps and separate static brake calipers, articulated all authored wheel assemblies and aligned tyre contact.',
  repairMaterials(root){for(const m of root.listMaterials()){
   const n=m.getName();
   if(n==='Carpaint_Flakes_Wine_Red')m.setMetallicFactor(.48).setRoughnessFactor(.24);
   else if(n==='Glass_Coated_Black'||n==='Glass_Tinted_Black')surface(m,[.035,.046,.055,.53],.12,.13,'BLEND');
   else if(n==='Default')m.setMetallicFactor(0).setRoughnessFactor(.88);
   else if(n==='Chrome_Polished')m.setRoughnessFactor(.26);
  }}
 },
 {
  id:'porsche-919-hybrid',uid:'b4ca76b4b83e4d84b1e1a994e79140f3',brand:'Porsche',model:'919 Hybrid · 2017',length:4.65,alignWheelContact:true,
  paint:['Body','Front','Rear','Cockpit_IMPROVED','Glossy_Top','White_2','Glossy_White'],
  wheel:(n,m)=>['Tire','Wheel_Material','Brake_Disc','Lug_Nut','material_55'].includes(m),
  exclude:(n,m)=>n==='Object_259'||invisible919.has(m),brake:['Rear_Lights'],
  simplifyPermissive:true,protectedNormals:true,preserveMaterials:['dmg-mori-2','schaeffler-logo','Rear_Lights'],highBudget:350000,lowBudget:140000,lowSecondaryRatio:.0355,highSecondaryError:.003,lowError:.009,
  extraChanges:'Removed the authored studio sweep and zero-opacity decal planes that the author had already disabled. Preserved original visible maps and body surfaces, reduced dense subdivision, articulated whole source wheels while keeping calipers static, and corrected glass/rubber/alloy material roles.',
  repairMaterials(root){for(const m of root.listMaterials()){
   const n=m.getName();
   if(['Body','Front','Rear','Cockpit_IMPROVED','Glossy_Top','White_2','Glossy_White'].includes(n))m.setMetallicFactor(.32).setRoughnessFactor(.3);
   else if(n==='Tire')m.setMetallicFactor(0).setRoughnessFactor(.88);
   else if(n==='Wheel_Material')surface(m,[.11,.125,.14,1],.86,.31);
   else if(n==='Cockpit_Glass')surface(m,[.028,.045,.06,.6],.1,.14,'BLEND');
   else if(n==='Glass')surface(m,[.48,.57,.66,.2],.08,.08,'BLEND');
  }}
 }
];
