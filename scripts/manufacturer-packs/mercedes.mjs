// Authored AMG GT source by Yan Carvalho. Material roles measured from named
// source primitives; source front wheels are straightened before runtime use.
const wheelRegions=[
 {x:3.416466,y:.9674,z:6.18455,r:1.04,w:1.53,absolute:true},
 {x:-1.58286,y:.9674,z:6.11252,r:1.04,w:1.53,absolute:true},
 {x:3.51658,y:.9674,z:-1.75802,r:1.04,w:.86,absolute:true},
 {x:-1.51863,y:.9674,z:-1.77529,r:1.04,w:.86,absolute:true},
];
export default [{
 id:'mercedes-amg-gt',uid:'661dcab94455463784651a3ebc63cfb9',brand:'Mercedes-Benz',model:'AMG GT',length:4.546,
 sourceYaw:1.339608581145236,exclude:n=>n==='Object_4',paint:['Material.001'],brake:['Material.034'],
 componentWheels:true,wheelCandidate:(n,m)=>['Material.004','Material.006','Material.008','Material.009','Material.023','Material.028'].includes(m),wheelRegions,
 wheelYaw:{wheel_front_left:-.4329026,wheel_front_right:-.4329024,wheel_rear_left:.0034298,wheel_rear_right:.00343},
 highBudget:420000,lowBudget:170000,
 extraChanges:'The source display floor was removed. Authored front wheel steering was straightened around the real axle pivots so runtime steering and rolling use aligned axes. Paint, rubber, glass and metal received named PBR material corrections.',
 repairMaterials(root){
  for(const m of root.listMaterials()){
   const n=m.getName();m.setEmissiveFactor([0,0,0]);
   if(n==='Material.001')m.setMetallicFactor(.57).setRoughnessFactor(.25);
   else if(n==='Material.023')m.setBaseColorFactor([.014,.017,.020,1]).setMetallicFactor(0).setRoughnessFactor(.86);
   else if(n==='Material')m.setBaseColorFactor([.035,.055,.075,.62]).setMetallicFactor(.13).setRoughnessFactor(.10).setAlphaMode('BLEND');
   else if(['Material.004','Material.005','Material.032','Material.033'].includes(n))m.setBaseColorFactor([.016,.019,.023,1]).setMetallicFactor(.06).setRoughnessFactor(.64);
   else if(['Material.008','Material.009','Material.028'].includes(n))m.setBaseColorFactor([.46,.49,.54,1]).setMetallicFactor(.88).setRoughnessFactor(.27);
   else if(n==='Material.034')m.setBaseColorFactor([.56,.006,.010,1]).setMetallicFactor(.15).setRoughnessFactor(.23);
   else if(n==='Material.016')m.setBaseColorFactor([.65,.75,.82,1]).setEmissiveFactor([.12,.15,.18]).setMetallicFactor(.12).setRoughnessFactor(.16);
   else m.setRoughnessFactor(Math.max(.19,m.getRoughnessFactor()));
  }
 }
}];
