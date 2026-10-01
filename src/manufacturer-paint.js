import * as THREE from 'three';

// These three atlases bake the body pigment into the diffuse map. Replacing
// that pigment avoids multiplying (for example) blue paint by a red texture.
// The mask is deliberately opt-in: neutral race numbers, badges, trim and the
// authored contrast panels on other cars must keep their source appearance.
const PIGMENTS = Object.freeze({
  'ferrari-250-gto': '#a50d0c',
  'ferrari-testarossa': '#bf0001',
  'bmw-f22-eurofighter': '#484a2f',
});
const DECLARATIONS = /* glsl */`
uniform float bodyPaintMaskEnabled;
uniform vec3 bodyPaintFactoryColor;
uniform vec3 bodyPaintPigmentHue;
uniform float bodyPaintPigmentValue;
`;
const MAP_FRAGMENT = THREE.ShaderChunk.map_fragment.replace(
  'diffuseColor *= sampledDiffuseColor;',
  /* glsl */`
  float pigmentHigh = max( sampledDiffuseColor.r, max( sampledDiffuseColor.g, sampledDiffuseColor.b ) );
  float pigmentLow = min( sampledDiffuseColor.r, min( sampledDiffuseColor.g, sampledDiffuseColor.b ) );
  float pigmentChroma = pigmentHigh - pigmentLow;
  vec3 pigmentHue = ( sampledDiffuseColor.rgb - pigmentLow ) / max( pigmentChroma, 0.00001 );
  float pigmentMatch = 1.0 - smoothstep( 0.10, 0.40, distance( pigmentHue, bodyPaintPigmentHue ) );
  float pigmentSaturation = pigmentChroma / max( pigmentHigh, 0.00001 );
  float pigmentMask = bodyPaintMaskEnabled * pigmentMatch * smoothstep( 0.20, 0.42, pigmentSaturation );
  // Preserve the atlas shading and carbon weave without retaining its hue or
  // forcing a naturally dark source pigment onto every selected paint colour.
  float pigmentShade = clamp( pigmentHigh / bodyPaintPigmentValue, 0.0, 1.35 );
  vec3 originalSurface = bodyPaintFactoryColor * sampledDiffuseColor.rgb;
  diffuseColor.rgb = mix( originalSurface, diffuseColor.rgb * pigmentShade, pigmentMask );
  diffuseColor.a *= sampledDiffuseColor.a;
  `,
);

/** Install once on the instance-owned material; shared maps remain immutable. */
export function configureManufacturerPaint(material, assetId, {customColor = false} = {}) {
  const pigment = PIGMENTS[assetId];
  if (!pigment || !material.map || !material.userData.bodyPaint) return;
  const source = new THREE.Color(pigment), high = Math.max(source.r, source.g, source.b), low = Math.min(source.r, source.g, source.b);
  const hue = source.clone().addScalar(-low).multiplyScalar(1 / (high - low));
  const state = {
    enabled: {value: customColor ? 1 : 0},
    factoryColor: {value: new THREE.Color(material.userData.factoryColor)},
    pigmentHue: {value: hue},
    pigmentValue: {value: high},
  };
  material.userData.bodyPaintMask = state;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      bodyPaintMaskEnabled: state.enabled,
      bodyPaintFactoryColor: state.factoryColor,
      bodyPaintPigmentHue: state.pigmentHue,
      bodyPaintPigmentValue: state.pigmentValue,
    });
    shader.fragmentShader = DECLARATIONS + shader.fragmentShader.replace('#include <map_fragment>', MAP_FRAGMENT);
  };
  // All asset differences are uniforms, so a paint selection needs no shader
  // rebuild and programs can still be shared between cars and paint colours.
  material.customProgramCacheKey = () => 'manufacturer-pigment-mask-v1';
}
