// Original presentation finishes on authored paint slots only. Glass, carbon,
// badges, livery maps and custom user finish choices retain their own materials.
// These are art-directed clearcoat profiles, not manufacturer paint measurements.
export const FLAGSHIP_FINISHES=Object.freeze({
 'lamborghini-aventador':{clearcoat:.82,clearcoatRoughness:.14},
 'ferrari-458-italia':{clearcoat:.95,clearcoatRoughness:.10},
 'mclaren-p1-gtr':{clearcoat:.78,clearcoatRoughness:.18},
 'porsche-930-turbo':{clearcoat:.76,clearcoatRoughness:.21},
 'lotus-elise':{clearcoat:.85,clearcoatRoughness:.15},
 'audi-r8':{clearcoat:.92,clearcoatRoughness:.12},
 'rimac-concept-one':{clearcoat:.90,clearcoatRoughness:.13},
 'koenigsegg-one-1':{clearcoat:.88,clearcoatRoughness:.13},
 'pagani-zonda-c12':{clearcoat:.92,clearcoatRoughness:.11},
 'maserati-mc-stradale':{clearcoat:.83,clearcoatRoughness:.17},
 'bugatti-veyron':{clearcoat:.95,clearcoatRoughness:.10},
 'gma-t50':{clearcoat:.88,clearcoatRoughness:.13},
 'aston-martin-one-77':{clearcoat:.93,clearcoatRoughness:.11},
 'rimac-nevera':{clearcoat:.94,clearcoatRoughness:.11},
 'mclaren-570s':{clearcoat:.89,clearcoatRoughness:.13},
 'mclaren-senna':{clearcoat:.80,clearcoatRoughness:.17},
 'porsche-911-gt3':{clearcoat:.88,clearcoatRoughness:.13},
 'lamborghini-gallardo':{clearcoat:.88,clearcoatRoughness:.14},
 'lamborghini-huracan':{clearcoat:.90,clearcoatRoughness:.12},
 'audi-r8-lms-gt3':{clearcoat:.73,clearcoatRoughness:.22},
 'audi-r18':{clearcoat:.70,clearcoatRoughness:.23},
 'ferrari-250-gto':{clearcoat:.72,clearcoatRoughness:.24},
 'ferrari-testarossa':{clearcoat:.80,clearcoatRoughness:.19},
 'bmw-i8':{clearcoat:.91,clearcoatRoughness:.12},
 'bmw-f22-eurofighter':{clearcoat:.75,clearcoatRoughness:.21},
 'mercedes-amg-gt':{clearcoat:.89,clearcoatRoughness:.14},
 'nissan-gt-r-2018':{clearcoat:.84,clearcoatRoughness:.16},
 'mclaren-650s-gt3':{clearcoat:.74,clearcoatRoughness:.21},
 'bmw-m3-e46':{clearcoat:.83,clearcoatRoughness:.17},
 'audi-quattro-rally':{clearcoat:.70,clearcoatRoughness:.24},
 'lamborghini-countach-lp500s':{clearcoat:.78,clearcoatRoughness:.20},
 'ferrari-enzo':{clearcoat:.91,clearcoatRoughness:.12},
 'porsche-919-hybrid':{clearcoat:.71,clearcoatRoughness:.23},
});
export function applyFlagshipFinish(material,assetId){
 const finish=FLAGSHIP_FINISHES[assetId];if(!finish||!material.isMeshPhysicalMaterial||!material.userData.bodyPaint)return false;
 Object.assign(material,finish);Object.assign(material.userData.factoryFinish,finish);return true;
}
