import * as THREE from 'three';
import {venueLighting} from './showcase-lighting.js';

// Original illustrated scenery; its loaded, graded sky also supplies the world reflection map.
// A race requests just one image. Smaller phone textures avoid retaining four
// large decoded panoramas or allocating an additional cube/PMREM render target.
export const BACKDROP_FAMILIES = Object.freeze(['coastal', 'desert', 'alpine', 'urban']);
const VERSION = 'original-panorama-1';
// Image-space skyline levels differ; below these rows is foreground artwork,
// which must never replace the real terrain beneath the car.
const HORIZON_V = Object.freeze({coastal: .495, desert: .365, alpine: .35, urban: .448});

export function backdropSource(track = {}, venue = {}, {low = false} = {}) {
  const family = track.id === 'summit' || track.scenery === 'cedar-ridge' ? 'alpine'
    : venue.environment === 'desert' ? 'desert'
    : venue.environment === 'urban' ? 'urban'
    : venue.water ? 'coastal' : 'alpine';
  return Object.freeze({family, detail: low ? 'mobile' : 'desktop',
    url: `/assets/environments/${family}${low ? '-mobile' : ''}.webp?v=${VERSION}`,
    maxWidth: low ? 1024 : 2048, horizonV: HORIZON_V[family]});
}

// Equirectangular sampling follows the camera direction, not its translation.
// Clamp imagery below the distant horizon: the real road, land, water and fog
// remain responsible for every foreground surface. Narrow seam blending avoids
// a conspicuous hard cut at the panorama's joined left/right edges.
export const CINEMATIC_BACKDROP_GLSL = `
uniform sampler2D cinematicMap;
uniform float cinematicAmount;
uniform vec3 cinematicHaze;
uniform float cinematicHorizon;
uniform vec3 cinematicTint;
uniform float cinematicExposure;
vec3 cinematicBackdrop(vec3 fallback, vec3 direction) {
  if (cinematicAmount <= 0.) return fallback;
  float u = fract(atan(direction.z, direction.x) * .15915494309189535 + .5);
  float v = clamp(cinematicHorizon + max(0., asin(clamp(direction.y, -1., 1.))) * .5252113122032546, cinematicHorizon, 1.);
  vec3 photograph = texture2D(cinematicMap, vec2(u, v)).rgb;
  float seam = min(u, 1.-u);
  if (seam < .018) {
    vec3 joined = (texture2D(cinematicMap, vec2(.001, v)).rgb + texture2D(cinematicMap, vec2(.999, v)).rgb) * .5;
    photograph = mix(joined, photograph, smoothstep(0., .018, seam));
  }
  photograph *= cinematicTint * cinematicExposure;
  photograph = mix(photograph, cinematicHaze, (1.-smoothstep(.015, .15, abs(direction.y))) * .10);
  float horizonMask = smoothstep(-.075, -.012, direction.y);
  return mix(fallback, photograph, cinematicAmount * horizonMask);
}
`;

function releaseTexture(texture) {
  if (!texture) return;
  texture.dispose();
  // ImageBitmap pixels are separate from the GPU resource and need releasing.
  texture.image?.close?.();
}

async function loadBackdropTexture(url, {signal}) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error(`Backdrop image unavailable (${response.status})`);
  const blob = await response.blob();
  if (signal.aborted) throw new DOMException('Backdrop disposed', 'AbortError');
  let image, flipped = false;
  if (typeof createImageBitmap === 'function') {
    image = await createImageBitmap(blob, {imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none'});
    flipped = true;
  } else {
    // Older Safari can still use the same optimized WebP through an image node.
    image = await new Promise((resolve, reject) => {
      const objectURL = URL.createObjectURL(blob), element = new Image();
      const clear = () => { URL.revokeObjectURL(objectURL); signal.removeEventListener('abort', cancel); };
      const cancel = () => { element.src = ''; clear(); reject(new DOMException('Backdrop disposed', 'AbortError')); };
      element.onload = () => { clear(); resolve(element); };
      element.onerror = () => { clear(); reject(new Error('Backdrop image could not decode')); };
      signal.addEventListener('abort', cancel, {once: true});
      element.src = objectURL;
    });
  }
  if (signal.aborted) { image.close?.(); throw new DOMException('Backdrop disposed', 'AbortError'); }
  const texture = new THREE.Texture(image);
  texture.flipY = !flipped;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createCinematicBackdrop({track, venue, low = false, reducedMotion = false,
  loadTexture = loadBackdropTexture} = {}) {
  const source = backdropSource(track, venue, {low});
  const controller = new AbortController();
  const uniforms = {
    cinematicMap: {value: null},
    cinematicAmount: {value: 0},
    cinematicHaze: {value: new THREE.Color(venue?.fog || '#344052')},
    cinematicHorizon: {value: source.horizonV},
    cinematicTint: {value:new THREE.Color(venueLighting(track||{}).backdropTint)},
    cinematicExposure: {value:venueLighting(track||{}).backdropExposure},
  };
  const status = {family: source.family, detail: source.detail, state: 'loading', url: source.url};
  let disposed = false, texture = null, startedAt = null;
  const ready = Promise.resolve().then(() => loadTexture(source.url, {signal: controller.signal})).then(loaded => {
    if (disposed) { releaseTexture(loaded); return false; }
    texture = loaded;
    uniforms.cinematicMap.value = texture;
    uniforms.cinematicAmount.value = reducedMotion ? 1 : 0;
    status.state = 'ready';
    return true;
  }).catch(() => {
    if (!disposed) status.state = 'fallback';
    // Image failure never prevents the circuit from loading or playing.
    return false;
  });
  return {source, uniforms, status, ready,
    update(time, {reducedMotion: reduce = reducedMotion} = {}) {
      if (disposed || !texture) return;
      if (startedAt === null) startedAt = time;
      const progress = reduce ? 1 : THREE.MathUtils.clamp((time - startedAt) / 1.25, 0, 1);
      uniforms.cinematicAmount.value = progress * progress * (3 - 2 * progress);
    },
    dispose() {
      if (disposed) return;
      disposed = true; status.state = 'disposed'; controller.abort();
      uniforms.cinematicAmount.value = 0; uniforms.cinematicMap.value = null;
      releaseTexture(texture); texture = null;
    },
  };
}
