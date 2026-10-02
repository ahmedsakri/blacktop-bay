// A contact is owned by the surface where it began. Keep touch identifiers in
// a separate numeric range from browser PointerEvent IDs and from other pads.
let nextTouchId = 2 ** 32;
const passiveFalse = {passive: false};
const prevent = event => { if (event.cancelable !== false) event.preventDefault?.(); };
const touchPointer = event => event.pointerType === 'touch';
export function isDrivingContact(event = {}) {
  // Mouse button semantics are not a reliable test for touch/pen contact.
  return event.pointerType === 'touch' || event.pointerType === 'pen' || event.button === 0;
}

export function bindDrivingContact(element, {
  enabled = () => true, onStart = () => true, onMove = () => {}, onEnd = () => {},
  globalTarget = element.ownerDocument?.defaultView, now = () => Date.now(),
} = {}) {
  const pointers = new Map(), touches = new Map(), listeners = [], seen = new WeakSet();
  let source = null, suppressMouseUntil = 0;
  const listen = (target, type, handler) => {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, passiveFalse);
    listeners.push(() => target.removeEventListener(type, handler, passiveFalse));
  };
  const once = event => { if (seen.has(event)) return false; seen.add(event); return true; };
  const release = (map, key, event) => {
    const contact = map.get(key);
    if (!contact) return;
    map.delete(key); // Lost capture can fire synchronously during release.
    if (contact.pointerType === 'touch') suppressMouseUntil = now() + 800;
    onEnd({...contact, originalEvent: event});
    if (map === pointers) {
      try { element.releasePointerCapture?.(key); } catch { /* Already released. */ }
    }
    if (!touches.size && ![...pointers.values()].some(touchPointer)) source = null;
  };
  const clear = event => {
    for (const id of [...pointers.keys()]) release(pointers, id, event);
    for (const id of [...touches.keys()]) release(touches, id, event);
    source = null;
  };
  const pointerDown = event => {
    if (!enabled() || !isDrivingContact(event) || !Number.isSafeInteger(event.pointerId) || event.pointerId < 0) return;
    if (!touchPointer(event) && event.pointerType !== 'pen' && now() < suppressMouseUntil) return;
    if (touchPointer(event)) {
      prevent(event);
      suppressMouseUntil = now() + 800;
      if (source === 'touch') return; // Same finger's second browser event stream.
    }
    if (pointers.has(event.pointerId)) return;
    const contact = {pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType || 'mouse', originalEvent: event};
    if (onStart(contact) === false) return;
    pointers.set(event.pointerId, contact);
    if (touchPointer(event)) source = 'pointer';
    prevent(event);
    try { element.setPointerCapture?.(event.pointerId); } catch { /* Window listeners still release and move. */ }
  };
  const pointerMove = event => {
    if (!once(event)) return;
    if (!enabled()) { clear(event); return; }
    const contact = pointers.get(event.pointerId);
    if (!contact) return;
    prevent(event);
    Object.assign(contact, {clientX: event.clientX, clientY: event.clientY, originalEvent: event});
    onMove(contact);
  };
  const pointerEnd = event => {
    if (!once(event)) return;
    if (pointers.has(event.pointerId)) prevent(event);
    release(pointers, event.pointerId, event);
  };
  const touchStart = event => {
    if (!enabled()) return;
    // An explicitly non-passive listener also prevents Safari's long-press
    // selection/callout. CSS touch-action alone does not cover that behaviour.
    prevent(event);
    suppressMouseUntil = now() + 800;
    if (source === 'pointer') return;
    for (const touch of event.changedTouches || []) {
      if (touches.has(touch.identifier)) continue;
      const contact = {pointerId: nextTouchId++, clientX: touch.clientX, clientY: touch.clientY, pointerType: 'touch', originalEvent: event};
      if (onStart(contact) === false) continue;
      touches.set(touch.identifier, contact);
      source = 'touch';
    }
  };
  const touchMove = event => {
    if (!once(event)) return;
    if (!enabled()) { clear(event); return; }
    if (source === 'pointer') { if (pointers.size) prevent(event); return; }
    for (const touch of event.changedTouches || []) {
      const contact = touches.get(touch.identifier);
      if (!contact) continue;
      prevent(event);
      Object.assign(contact, {clientX: touch.clientX, clientY: touch.clientY, originalEvent: event});
      onMove(contact);
    }
  };
  const touchEnd = event => {
    if (!once(event)) return;
    for (const touch of event.changedTouches || []) {
      if (touches.has(touch.identifier)) prevent(event);
      release(touches, touch.identifier, event);
    }
  };
  listen(element, 'pointerdown', pointerDown);
  listen(element, 'touchstart', touchStart);
  for (const target of new Set([element, globalTarget])) {
    listen(target, 'pointermove', pointerMove);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(target, type, pointerEnd);
    listen(target, 'touchmove', touchMove);
    for (const type of ['touchend', 'touchcancel']) listen(target, type, touchEnd);
  }
  for (const type of ['selectstart', 'contextmenu', 'dragstart']) listen(element, type, event => { if (enabled()) prevent(event); });
  for (const type of ['blur', 'pagehide', 'orientationchange']) listen(globalTarget, type, clear);
  listen(element.ownerDocument, 'visibilitychange', event => { if (element.ownerDocument.hidden) clear(event); });
  const cleanup = () => { clear(); for (const remove of listeners) remove(); };
  cleanup.clear = clear;
  return cleanup;
}
