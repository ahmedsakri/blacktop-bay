export const QUALITY_PRESETS=Object.freeze({
  performance:{label:'Performance',pixelRatio:1,shadows:false,bloom:false,reflection:false,detailDistanceScale:.8},
  balanced:{label:'Balanced',pixelRatio:1.35,shadows:true,bloom:true,reflection:false,detailDistanceScale:1},
  ultra:{label:'High detail',pixelRatio:1.75,shadows:true,bloom:true,reflection:true,detailDistanceScale:1.2},
});
export const normalizeQuality=value=>Object.hasOwn(QUALITY_PRESETS,value)?value:'auto';
export function qualitySettings(value,{mobile=false,dpr=1,adaptiveLevel=0}={}) {
  const id=normalizeQuality(value),preset=QUALITY_PRESETS[id==='auto'?(mobile?'performance':'ultra'):id];
  const result={...preset,pixelRatio:Math.min(Math.max(1,Number.isFinite(dpr)?dpr:1),preset.pixelRatio)};
  if(id!=='auto')return result;
  const level=Math.min(3,Math.max(0,Math.floor(Number(adaptiveLevel)||0)));
  if(level>0){
   result.pixelRatio=Math.max(.7,result.pixelRatio*[1,.88,.76,.7][level]);
   result.reflection=false;result.bloom=level<2&&result.bloom;result.shadows=level<2&&result.shadows;
   result.detailDistanceScale*= [1,.90,.78,.66][level];
  }
  return result;
}
