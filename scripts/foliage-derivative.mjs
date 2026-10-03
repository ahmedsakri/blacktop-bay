// Deterministic offline assembly of the licensed photographed leaf into a
// small branch spray. One cutout texture replaces dozens of geometric leaves.
export async function foliageDerivative(sharp,source,alpha,crop,size){
 const mask=await sharp(alpha).extract(crop).resize(88,124).greyscale().raw().toBuffer();
 const rgb=await sharp(source).extract(crop).resize(88,124).raw().toBuffer();
 const leaf=await sharp(rgb,{raw:{width:88,height:124,channels:3}}).joinChannel(mask,{raw:{width:88,height:124,channels:1}}).png().toBuffer();
 const overlays=[];
 for(let i=0;i<24;i++){
  const a=i*2.399963,r=45+Math.sqrt((i+.5)/24)*142,cx=256+Math.cos(a)*r,cy=255+Math.sin(a)*r*.88;
  const s=.62+(i%5)*.09,angle=a*180/Math.PI+22;
  const img=await sharp(leaf).resize(Math.round(88*s),Math.round(124*s)).rotate(angle,{background:'#00000000'}).png().toBuffer(),meta=await sharp(img).metadata();
  overlays.push({input:img,left:Math.round(cx-meta.width/2),top:Math.round(cy-meta.height/2)});
 }
 const atlas=await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite(overlays).png().toBuffer();
 return sharp(atlas).resize(size,size).webp({quality:86,alphaQuality:100,effort:6}).toBuffer();
}
