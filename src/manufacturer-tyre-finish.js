// Dedicated rubber slots verified in the shipping glTF files. Combined atlases,
// tyre logos, cockpit rubber and sources already carrying a normal map stay
// authored. Never infer a material role from colour or change source geometry.
export const TYRE_DETAIL_SLOTS = Object.freeze({
  'mclaren-p1-gtr': 'tires',
  'bugatti-veyron': 'wheel-rubber',
  'gma-t50': 'Matte_Tire_Rubber',
  'aston-martin-one-77': 'tyre',
  'rimac-nevera': 'tyre',
  'mclaren-senna': 'wheel-rubber',
  'porsche-911-gt3': 'EXT_Tyre.004',
  'lamborghini-gallardo': 'Tires',
  'lamborghini-huracan': 'huracan-rubber',
  'mclaren-650s-gt3': 'tire',
  'bmw-m3-e46': 'tire-low',
  'audi-quattro-rally': 'audi-wheel-tyre',
  'porsche-919-hybrid': 'Tire',
});

export function applyManufacturerTyreFinish(material, assetId) {
  if (TYRE_DETAIL_SLOTS[assetId] !== material.name || !material.isMeshStandardMaterial || material.userData.bodyPaint || material.normalMap || material.bumpMap || material.transparent) return false;
  material.userData.tyreSurfaceDetail = true;
  // Two very small, derivative-filtered grain scales reveal rubber under the
  // studio key. No invented tread cuts are added to slick racing tyres.
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 tyrePosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntyrePosition=position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 tyrePosition;
      float rubberHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      vec3 rubberPoint=tyrePosition*520.;
      float rubberFootprint=max(length(dFdx(rubberPoint)),length(dFdy(rubberPoint)));
      float rubberFine=mix(rubberHash(floor(rubberPoint)),.5,smoothstep(.65,2.,rubberFootprint));
      float rubberCoarse=mix(rubberHash(floor(tyrePosition*125.)),.5,smoothstep(.65,2.,rubberFootprint*125./520.));
      float rubberGrain=mix(rubberFine,rubberCoarse,.35);
      roughnessFactor=clamp(roughnessFactor+(rubberGrain-.5)*.095,.58,1.);
      diffuseColor.rgb*=.96+rubberGrain*.08;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 rubberDx=dFdx(-vViewPosition),rubberDy=dFdy(-vViewPosition);
      vec3 rubberR1=cross(rubberDy,normal),rubberR2=cross(normal,rubberDx);
      float rubberDet=dot(rubberDx,rubberR1),rubberHeight=(rubberGrain-.5)*.000055;
      if(abs(rubberDet)>.00000001)normal=normalize(abs(rubberDet)*normal-sign(rubberDet)*(dFdx(rubberHeight)*rubberR1+dFdy(rubberHeight)*rubberR2));`);
  };
  material.customProgramCacheKey = () => 'manufacturer-rubber-grain-v1';
  return true;
}
