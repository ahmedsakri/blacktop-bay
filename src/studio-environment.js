import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createEnvironmentResource } from './environment-resource.js';

export const STUDIO_HDR = '/assets/environments/studio/studio-small-09-1k.hdr';

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
        const hdr = new HDRLoader().parse(buffer);
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
