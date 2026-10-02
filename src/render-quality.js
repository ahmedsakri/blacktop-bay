export const QUALITY_PRESETS=Object.freeze({
  performance:{label:'Performance',pixelRatio:1,shadows:false,bloom:false,reflection:false,detailDistanceScale:.8},
  balanced:{label:'Balanced',pixelRatio:1.35,shadows:true,bloom:true,reflection:false,detailDistanceScale:1},
  ultra:{label:'High detail',pixelRatio:1.75,shadows:true,bloom:true,reflection:true,detailDistanceScale:1.2},
});
export const MOBILE_QUALITY_PROFILES=Object.freeze({
  constrained:Object.freeze({pixelRatio:1.35,maxRenderPixels:1200000,shadows:false,detailDistanceScale:1}),
  standard:Object.freeze({pixelRatio:1.6,maxRenderPixels:2000000,shadows:true,detailDistanceScale:1}),
  capable:Object.freeze({pixelRatio:1.75,maxRenderPixels:2400000,shadows:true,detailDistanceScale:1.1}),
});
export const normalizeQuality=value=>Object.hasOwn(QUALITY_PRESETS,value)?value:'auto';
const positive=value=>Number.isFinite(value)&&value>0?value:0;
// These optional browser hints establish a conservative starting point, not a
// GPU benchmark. Missing hints (including Safari) use the standard profile.
export function mobileQualityProfile({deviceMemory,hardwareConcurrency}={}){
 const memory=positive(deviceMemory),cores=positive(hardwareConcurrency);
 if(memory&&memory<=2||cores&&cores<=4)return 'constrained';
 return memory>=8&&cores>=8?'capable':'standard';
}
// Source geometry is a separate, session-level choice. Applying postprocessing
// cannot restore the extra triangles/textures that a low source never loaded.
export function qualityGeometry(value,{mobile=false}={}){
 const id=normalizeQuality(value),low=id==='performance'||mobile&&id!=='ultra';
 return {worldLow:low,carLow:low};
}
export function qualitySettings(value,{mobile=false,dpr=1,adaptiveLevel=0,width=0,height=0,deviceMemory,hardwareConcurrency}={}) {
 const id=normalizeQuality(value),automaticMobile=id==='auto'&&mobile;
 const preset=QUALITY_PRESETS[id==='auto'?(mobile?'balanced':'ultra'):id];
 const result={...preset};
 if(automaticMobile){
  const profile=MOBILE_QUALITY_PROFILES[mobileQualityProfile({deviceMemory,hardwareConcurrency})];
  Object.assign(result,profile,{label:'Automatic',bloom:false,reflection:false});
 }else if(mobile){
  // Manual High retains its stronger passes and geometry. A viewport ceiling
  // prevents DPR 3 tablets from allocating a native-resolution full-screen pass.
  result.maxRenderPixels={performance:1200000,balanced:2000000,ultra:3000000}[id];
 }
 result.pixelRatio=Math.min(Math.max(1,positive(dpr)||1),result.pixelRatio);
 if(mobile){
  const area=positive(width)*positive(height);
  if(area>0)result.pixelRatio=Math.max(1,Math.min(result.pixelRatio,Math.sqrt(result.maxRenderPixels/area)));
 }
 if(id!=='auto')return result;
 const level=Math.min(3,Math.max(0,Math.floor(Number(adaptiveLevel)||0)));
 if(level>0){
  // First drop shadow work and distant detail while preserving sharpness.
  // Later steps lower pixel cost, but never below one CSS pixel on a phone.
  result.pixelRatio=mobile?(level===3?1:Math.max(1,result.pixelRatio*[1,1,.82,1][level])):Math.max(.7,result.pixelRatio*[1,.88,.76,.7][level]);
  result.reflection=false;result.bloom=level<2&&result.bloom;result.shadows=(mobile?false:level<2&&result.shadows);
  result.detailDistanceScale*=[1,.90,.78,.66][level];
 }
 return result;
}
