export const QUALITY_PRESETS=Object.freeze({
  performance:{label:'Performance',pixelRatio:1,shadows:false,bloom:false,reflection:false},
  balanced:{label:'Balanced',pixelRatio:1.35,shadows:true,bloom:true,reflection:false},
  ultra:{label:'High detail',pixelRatio:1.75,shadows:true,bloom:true,reflection:true},
});
export const normalizeQuality=value=>Object.hasOwn(QUALITY_PRESETS,value)?value:'auto';
export function qualitySettings(value,{mobile=false,dpr=1}={}) {
  const id=normalizeQuality(value),preset=QUALITY_PRESETS[id==='auto'?(mobile?'balanced':'ultra'):id];
  return {...preset,pixelRatio:Math.min(Math.max(1,Number.isFinite(dpr)?dpr:1),preset.pixelRatio)};
}
