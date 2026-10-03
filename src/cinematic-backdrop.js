import * as THREE from 'three';
import {venueLighting} from './showcase-lighting.js';
import {supportsCompressedSky,loadPhotographicSky} from './photographic-sky-loader.js';

// Licensed photographic upper hemispheres. Their loaded sky also supplies the
// world reflection map. Cropping the unused nadir doubles angular resolution
// without retaining a full panorama's ground pixels on the GPU.
export const BACKDROP_FAMILIES = Object.freeze(['coastal', 'desert', 'alpine', 'urban']);
const VERSION = 'photographic-hemisphere-4';

export function backdropSource(track = {}, venue = {}, {low = false} = {}) {
  const family = track.id === 'summit' || track.scenery === 'cedar-ridge' || venue.lightingRegion === 'alpine' ? 'alpine'
    : venue.environment === 'desert' || venue.lightingRegion === 'arid' ? 'desert'
    : venue.environment === 'urban' ? 'urban'
    // The coastal file is sky-only: it also suits flat inland circuits. Do
    // not put an Alpine mountain photograph around Silverstone or Monza.
    : 'coastal';
  return Object.freeze({family, detail: low ? 'mobile' : 'desktop',
    url: `/assets/environments/${family}${low ? '-mobile' : ''}.webp?v=${VERSION}`,
    maxWidth: low ? 2048 : 4096, horizonV: 0,
    projection: 'equirectangular-upper-hemisphere'});
}

// Correct 360° x 90° angular sampling follows camera direction, not translation.
// The former illustration used an arbitrary vertical stretch: distant ranges
// became a gigantic blurry wall. Photographs now retain their real angular size.
// Geometry remains responsible for all foreground terrain and architecture.
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
  float v = clamp(max(0., asin(clamp(direction.y, -1., 1.))) * .6366197723675814, 0., 1.);
  vec3 photograph = texture2D(cinematicMap, vec2(u, v)).rgb;
  float seam = min(u, 1.-u);
  if (seam < .001) {
    vec3 joined = (texture2D(cinematicMap, vec2(.001, v)).rgb + texture2D(cinematicMap, vec2(.999, v)).rgb) * .5;
    photograph = mix(joined, photograph, smoothstep(0., .001, seam));
  }
  photograph *= cinematicTint * cinematicExposure;
  photograph = mix(photograph, cinematicHaze, (1.-smoothstep(.015, .15, abs(direction.y))) * .10);
  // The texture contains no below-horizon pixels. Fade to the procedural
  // haze before its bottom row can be stretched across an elevated view.
  float horizonMask = smoothstep(0., .035, direction.y);
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

export function createCinematicBackdrop({track, venue, renderer, low = false, reducedMotion = false,
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
  const ready = Promise.resolve().then(async () => {
    if(supportsCompressedSky(renderer)&&renderer.capabilities.maxTextureSize>=4096){
      const compressedLow=low||renderer.capabilities.maxTextureSize<8192;
      const url=`/assets/environments/${source.family}${compressedLow?'-mobile':''}.ktx2?v=${VERSION}`;
      try{const loaded=await loadPhotographicSky(renderer,url,{signal:controller.signal});status.url=url;return loaded;}
      catch(error){if(controller.signal.aborted)throw error;}
    }
    return loadTexture(source.url, {signal: controller.signal});
  }).then(loaded => {
    if (disposed) { releaseTexture(loaded); return false; }
    texture = loaded;
    uniforms.cinematicMap.value = texture;
    uniforms.cinematicAmount.value = reducedMotion ? 1 : 0;
    status.state = 'ready';
    status.gpuCompressed=Boolean(loaded.userData?.photographicGPU);
    status.width=loaded.image?.width||source.maxWidth;
    status.height=loaded.image?.height||source.maxWidth/4;
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
