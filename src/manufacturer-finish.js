// Original presentation finishes on authored paint slots only. Glass, carbon,
// badges, livery maps and custom user finish choices retain their own materials.
export const FLAGSHIP_FINISHES=Object.freeze({
 'lamborghini-aventador':{clearcoat:.82,clearcoatRoughness:.14},
 'ferrari-458-italia':{clearcoat:.95,clearcoatRoughness:.10},
 'mclaren-p1-gtr':{clearcoat:.78,clearcoatRoughness:.18},
 'porsche-911-gt3':{clearcoat:.88,clearcoatRoughness:.13},
 'nissan-gt-r-2018':{clearcoat:.84,clearcoatRoughness:.16},
 'bmw-i8':{clearcoat:.91,clearcoatRoughness:.12},
});
export function applyFlagshipFinish(material,assetId){
 const finish=FLAGSHIP_FINISHES[assetId];if(!finish||!material.isMeshPhysicalMaterial||!material.userData.bodyPaint)return false;
 Object.assign(material,finish);Object.assign(material.userData.factoryFinish,finish);return true;
}
