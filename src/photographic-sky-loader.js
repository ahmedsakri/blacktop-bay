import {BoundedKTX2Loader} from './bounded-ktx2-loader.js';
import {BASIS_TRANSCODER} from './basis-transcoder-manifest.js';

export const PHOTOGRAPHIC_SKY_LIMITS = Object.freeze({transferBytes:12 * 1024 * 1024, timeoutMs:15_000});
const EXTENSIONS = ['WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_etc', 'EXT_texture_compression_bptc'];
// Keep block-compressed residency; the caller uses WebP on other hardware.
export function supportsCompressedSky(renderer) {
  if (!renderer || !BASIS_TRANSCODER.available) return false;
  const has = name => Boolean(renderer.extensions?.has(name));
  // These assets are sRGB. Linear S3TC alone cannot upload their sRGB blocks.
  return EXTENSIONS.some(has) || has('WEBGL_compressed_texture_s3tc') && has('WEBGL_compressed_texture_s3tc_srgb');
}

const abortError = () => new DOMException('Sky disposed', 'AbortError');
function cancelBody(body, reason) {
  // A stalled transport must not hold up scene disposal or the WebP fallback.
  try { Promise.resolve(body?.cancel(reason)).catch(() => {}); } catch { /* Already closed or locked. */ }
}

// A single short-lived worker belongs to this request. Network and decoding
// share one deadline. Failures reject here; the caller owns its fallback choice.
export async function loadPhotographicSky(renderer, url, {
  signal, fetchFile = globalThis.fetch, makeLoader = () => new BoundedKTX2Loader(),
  timeoutMs = PHOTOGRAPHIC_SKY_LIMITS.timeoutMs,
  setTimeout: schedule = globalThis.setTimeout, clearTimeout: unschedule = globalThis.clearTimeout,
} = {}) {
  if (signal?.aborted) throw abortError();
  if (!supportsCompressedSky(renderer)) throw new Error('Photographic sky requires a supported compressed texture format');
  const controller = new AbortController();
  let loader, reader, response, timer, failure = null, disposed = false, transportStopped = false, rejectCancellation;
  const cancelled = new Promise((_, reject) => { rejectCancellation = reject; });
  // Cancellation can occur during synchronous loader setup, before the first race.
  cancelled.catch(() => {});
  const releaseLoader = () => {
    if (loader && !disposed) { disposed = true; loader.dispose(); }
  };
  const stopTransport = reason => {
    if (transportStopped) return;
    transportStopped = true;
    controller.abort(reason);
    if (reader) cancelBody(reader, reason);
    else cancelBody(response?.body, reason);
  };
  const cancel = reason => {
    if (failure) return;
    failure = reason;
    rejectCancellation(reason);
    stopTransport(reason);
    releaseLoader();
  };
  const onAbort = () => cancel(abortError());
  const guarded = (operation, discard) => {
    if (failure) return Promise.reject(failure);
    const pending = Promise.resolve().then(() => {
      if (failure) throw failure;
      return operation();
    }).then(value => {
      if (failure) { discard?.(value); throw failure; }
      return value;
    });
    return Promise.race([pending, cancelled]);
  };
  signal?.addEventListener('abort', onAbort, {once:true});
  try {
    // Call browser timers with their required receiver, also in injected tests.
    const duration = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(timeoutMs, PHOTOGRAPHIC_SKY_LIMITS.timeoutMs)) : PHOTOGRAPHIC_SKY_LIMITS.timeoutMs;
    timer = schedule.call(globalThis, () => cancel(new Error('Photographic sky exceeded its 15-second deadline')), duration);
    loader = makeLoader();
    loader.setTranscoderPath(BASIS_TRANSCODER.path).setWorkerLimit(1);
    loader.detectSupport(renderer);
    response = await guarded(() => fetchFile(url, {signal:controller.signal}), late => cancelBody(late?.body, failure));
    if (!response.ok) throw new Error('Photographic sky unavailable: ' + response.status);
    const declared = Number(response.headers?.get('Content-Length'));
    if (declared > PHOTOGRAPHIC_SKY_LIMITS.transferBytes) throw new Error('Photographic sky exceeds the transfer limit');
    // Real fetch responses expose a stream. Do not fall back to arrayBuffer(),
    // which could allocate an arbitrarily large body before checking its size.
    reader = response.body?.getReader();
    if (!reader) throw new Error('Photographic sky response cannot be read with a bounded stream');
    const chunks = [];
    let bytes = 0;
    while (true) {
      const {done, value} = await guarded(() => reader.read());
      if (done) break;
      bytes += value.byteLength;
      if (bytes > PHOTOGRAPHIC_SKY_LIMITS.transferBytes) throw new Error('Photographic sky exceeds the transfer limit');
      chunks.push(value);
    }
    reader.releaseLock(); reader = null;
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    chunks.length = 0;
    const texture = await guarded(() => loader.parse(buffer.buffer), late => late?.dispose());
    // An abort may land between the race settling and this continuation running.
    if (failure || signal?.aborted) { texture.dispose(); throw failure || abortError(); }
    texture.userData = {...texture.userData, photographicGPU:true};
    return texture;
  } catch (error) {
    stopTransport(error);
    throw failure || error;
  } finally {
    if (timer !== undefined) unschedule.call(globalThis, timer);
    signal?.removeEventListener('abort', onAbort);
    try { reader?.releaseLock(); } catch { /* A custom or failed reader may still be locked. */ }
    releaseLoader();
  }
}
