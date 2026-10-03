import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createEnvironmentResource } from './environment-resource.js';

export const STUDIO_HDR = '/assets/environments/studio/studio-small-09-1k.hdr';

// Retain the photographed softboxes and midtones, while rolling off the small
// 500+ radiance emitters that otherwise bleach paint at showroom exposure.
// This runs once at decode time, never per frame and never on a car material.
export function prepareStudioRadiance(hdr, { low = false } = {}) {
  const {data, width, height, type} = hdr;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 1024 || height > 512 || data.length !== width * height * 4)
    throw new Error('Studio image exceeds its decoded budget');
  const half = type === THREE.HalfFloatType;
  if (!half && type !== THREE.FloatType) throw new Error('Unsupported studio radiance');
  const read = half ? THREE.DataUtils.fromHalfFloat : value => value;
  const write = half ? THREE.DataUtils.toHalfFloat : value => value;
  const step = low && width > 512 ? 2 : 1;
  if (width % step || height % step) throw new Error('Invalid studio dimensions');
  const outputWidth = width / step, outputHeight = height / step;
  const output = step === 1 ? data : new data.constructor(outputWidth * outputHeight * 4);
  for (let y = 0; y < outputHeight; y++) for (let x = 0; x < outputWidth; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < step; sy++) for (let sx = 0; sx < step; sx++) {
      const offset = ((y * step + sy) * width + x * step + sx) * 4;
      r += read(data[offset]); g += read(data[offset + 1]); b += read(data[offset + 2]);
    }
    r /= step * step; g /= step * step; b /= step * step;
    const luminance = r * .2126 + g * .7152 + b * .0722;
    // Hue-preserving shoulder above 3; ordinary reflected detail is untouched.
    const excess = Math.max(0, luminance - 3);
    const scale = luminance > 3 ? (3 + excess / (1 + excess / 9)) / luminance : 1;
    const offset = (y * outputWidth + x) * 4;
    output[offset] = write(r * scale); output[offset + 1] = write(g * scale); output[offset + 2] = write(b * scale); output[offset + 3] = write(1);
  }
  return {...hdr, data: output, width: outputWidth, height: outputHeight};
}

// One 1K photograph supplies real softbox/reflection detail. The procedural
// room remains usable during a slow download or after a failed request.
export function createStudioEnvironment(renderer, scene, { low = false } = {}, adapters = {}) {
  let photograph = null, disposed = false;
  const controller = new AbortController();
  const build = adapters.build || ((texture) => {
    if (renderer.getContext?.().isContextLost()) return null;
    const pmrem = new THREE.PMREMGenerator(renderer);
    let room;
    try {
      if (texture) return pmrem.fromEquirectangular(texture);
      room = new RoomEnvironment();
      return pmrem.fromScene(room, .04, .1, 100, { size: low ? 128 : 256 });
    } finally { room?.dispose(); pmrem.dispose(); }
  });
  const environment = createEnvironmentResource(scene, () => build(photograph));
  environment.rebuild();
  scene.userData.studioLighting = 'fallback';
  const timer = setTimeout(() => controller.abort(), 8000);
  const ready = (async () => {
    try {
      const response = await (adapters.fetch || fetch)(STUDIO_HDR, { signal: controller.signal });
      if (!response.ok) throw new Error('Studio lighting unavailable');
      const bytes = await response.arrayBuffer();
      if (disposed || controller.signal.aborted || bytes.byteLength > 2 * 1024 * 1024) return false;
      const parse = adapters.parse || ((buffer) => {
        const hdr = prepareStudioRadiance(new HDRLoader().parse(buffer), {low});
        const texture = new THREE.DataTexture(hdr.data, hdr.width, hdr.height, THREE.RGBAFormat, hdr.type);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.LinearSRGBColorSpace;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false; texture.flipY = true; texture.needsUpdate = true;
        return texture;
      });
      photograph = parse(bytes);
      // A lost context leaves the source available for the existing restoration
      // path; rebuilding never discards the working environment prematurely.
      if (environment.rebuild()) scene.userData.studioLighting = 'photographic';
      return true;
    } catch { return false; }
    finally { clearTimeout(timer); }
  })();
  return {
    ready,
    rebuild() {
      const rebuilt = environment.rebuild();
      if (rebuilt && photograph) scene.userData.studioLighting = 'photographic';
      return rebuilt;
    },
    dispose() {
      if (disposed) return;
      disposed = true; clearTimeout(timer); controller.abort(); environment.dispose();
      photograph?.dispose(); photograph = null;
    },
  };
}
