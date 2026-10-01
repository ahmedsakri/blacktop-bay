// The visible control is an actual hit area, not a decoration over the canvas.
// Pressing either side steers immediately; one captured thumb can then drag.
export function bindSteeringPad(element, steering, {enabled = () => true, onChange = () => {}} = {}) {
  const down = event => {
    if (!enabled() || event.button !== 0) return;
    const box = element.getBoundingClientRect();
    const range = Math.max(20, (box.width - 48) / 2);
    if (!steering.start(event.pointerId, box.left + box.width / 2, box.width, range)) return;
    event.preventDefault();
    try { element.setPointerCapture(event.pointerId); } catch { /* Global release remains available. */ }
    steering.move(event.pointerId, event.clientX);
    onChange();
  };
  const move = event => {
    if (!enabled()) { steering.clear(); onChange(); return; }
    steering.move(event.pointerId, event.clientX);
    onChange();
  };
  const release = event => { steering.release(event.pointerId); onChange(); };
  element.addEventListener('pointerdown', down);
  element.addEventListener('pointermove', move);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(name, release);
  return () => {
    steering.clear(); onChange();
    element.removeEventListener('pointerdown', down);
    element.removeEventListener('pointermove', move);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) element.removeEventListener(name, release);
  };
}
