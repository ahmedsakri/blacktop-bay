// Rendering every ProMotion callback wastes battery in a menu. Driving still
// receives up to 60 updates/s; hidden pages do no rendering or simulation work.
export function createFrameBudget() {
  let previous = null;
  return {
    reset() { previous = null; },
    ready(now, { mobile = false, hidden = false, mode = 'menu', batterySaver = false } = {}) {
      if (!Number.isFinite(now) || hidden) { previous = null; return false; }
      const fps = mobile ? ['racing', 'countdown', 'finished'].includes(mode) ? batterySaver ? 30 : 60 : mode === 'paused' ? 15 : 30 : 0;
      if (!fps || previous === null || now < previous) { previous = now; return true; }
      const interval = 1000 / fps, elapsed = now - previous;
      if (elapsed < interval - .75) return false;
      previous = now - Math.max(0, elapsed % interval < interval - .75 ? elapsed % interval : 0);
      return true;
    },
  };
}
