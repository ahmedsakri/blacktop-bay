/** Let a visible loading message paint before expensive work. Hidden documents
 * do not receive animation frames reliably and have nothing to paint: continue
 * their initialization immediately. A visibility change also releases a frame
 * wait already in progress. Shader readiness remains separately awaited. */
export function waitForPaint({
  document: page = globalThis.document,
  requestFrame = globalThis.requestAnimationFrame,
  cancelFrame = globalThis.cancelAnimationFrame,
} = {}) {
  if (!page || page.hidden || typeof requestFrame !== 'function') return Promise.resolve();
  return new Promise(resolve => {
    let frame = null, settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (frame !== null) cancelFrame?.(frame);
      page.removeEventListener('visibilitychange', onVisibility);
      resolve();
    };
    const onVisibility = () => { if (page.hidden) finish(); };
    page.addEventListener('visibilitychange', onVisibility);
    // Visibility may have changed between the initial guard and listener setup.
    if (page.hidden) { finish(); return; }
    frame = requestFrame(() => {
      frame = null;
      if (page.hidden) { finish(); return; }
      frame = requestFrame(() => { frame = null; finish(); });
    });
  });
}
