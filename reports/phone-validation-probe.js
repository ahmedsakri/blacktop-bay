// Local review helper only. Paste into Safari Web Inspector for the game tab,
// then drive for five minutes. Read __camberPhoneProbe.result() at any time.
// No network, storage, permission requests, simulated inputs or game mutations.
// Frame callbacks measure presentation opportunity, not GPU-rendered FPS.
(() => {
  window.__camberPhoneProbe?.stop?.();
  const duration = 300000, started = performance.now(), buckets = [];
  const pointers = new Map(), removers = [];
  const steering = document.querySelector('#touch-steer-cue');
  const timer = document.querySelector('#timer');
  const initialTimer = timer?.textContent;
  let finalTimer = initialTimer;
  let finalViewport = {width: innerWidth, height: innerHeight, dpr: devicePixelRatio};
  const events = {trustedTouchStarts: 0, syntheticTouchStarts: 0, cancellations: 0,
    captureLosses: 0, blur: 0, hidden: 0, rotations: 0, trustedMotionSamples: 0,
    syntheticMotionSamples: 0, validMotionSamples: 0};
  const motion = {betaMin: null, betaMax: null, gammaMin: null, gammaMax: null};
  let previous = null, raf = 0, stoppedAt = null, timeout, overlapStart = null;
  let overlapMs = 0, overlapSessions = 0, overlapSteeringFrames = 0, overlapBoostFrames = 0;
  let leftFrames = 0, rightFrames = 0, sensorWithoutTouchSteeringFrames = 0;
  const listen = (target, type, callback) => {
    target.addEventListener(type, callback, {capture: true, passive: true});
    removers.push(() => target.removeEventListener(type, callback, true));
  };
  const overlap = () => {
    const held = [...pointers.values()];
    return held.some(p => p.trusted && p.action === 'steering') && held.some(p => p.trusted && p.action === 'nitro');
  };
  const reconcile = () => {
    if (overlap() && overlapStart === null) { overlapStart = performance.now(); overlapSessions++; }
    else if (!overlap() && overlapStart !== null) { overlapMs += performance.now() - overlapStart; overlapStart = null; }
  };
  listen(document, 'pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    events[e.isTrusted ? 'trustedTouchStarts' : 'syntheticTouchStarts']++;
    const target = e.target;
    const action = target.closest?.('#touch-steer-cue, #scene canvas') ? 'steering'
      : target.closest?.('[data-input="nitro"]') ? 'nitro' : 'other';
    pointers.set(e.pointerId, {action, trusted: e.isTrusted}); reconcile();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(document, type, e => {
    if (type === 'pointercancel') events.cancellations++;
    if (type === 'lostpointercapture') events.captureLosses++;
    pointers.delete(e.pointerId); reconcile();
  });
  listen(window, 'blur', () => { events.blur++; pointers.clear(); reconcile(); previous = null; });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { events.hidden++; pointers.clear(); reconcile(); }
    previous = null;
  });
  listen(window, 'orientationchange', () => { events.rotations++; pointers.clear(); reconcile(); previous = null; });
  listen(window, 'deviceorientation', e => {
    events[e.isTrusted ? 'trustedMotionSamples' : 'syntheticMotionSamples']++;
    if (![e.beta, e.gamma].every(Number.isFinite)) return;
    events.validMotionSamples++;
    for (const axis of ['beta', 'gamma']) {
      motion[axis + 'Min'] = motion[axis + 'Min'] === null ? e[axis] : Math.min(motion[axis + 'Min'], e[axis]);
      motion[axis + 'Max'] = motion[axis + 'Max'] === null ? e[axis] : Math.max(motion[axis + 'Max'], e[axis]);
    }
  });
  const percentile = (values, p) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * p))] : null;
  const result = () => ({
    elapsedSeconds: ((stoppedAt ?? performance.now()) - started) / 1000,
    stopped: stoppedAt !== null,
    complete: stoppedAt !== null && stoppedAt - started >= duration - 50,
    userAgent: navigator.userAgent, viewport: finalViewport,
    raceTimerStart: initialTimer, raceTimerEnd: finalTimer, ...events, motion,
    trustedSimultaneousInput: {sessions: overlapSessions, seconds: (overlapMs + (overlapStart === null ? 0 : performance.now() - overlapStart)) / 1000,
      steeringFrames: overlapSteeringFrames, boostActiveFrames: overlapBoostFrames},
    steeringFrames: {left: leftFrames, right: rightFrames, sensorWithoutTouch: sensorWithoutTouchSteeringFrames},
    minuteFrameCallbacks: buckets.map((values, index) => {
      const sorted = [...values].sort((a, b) => a - b), total = values.reduce((a, b) => a + b, 0);
      return {minute: index + 1, samples: values.length, measuredSeconds: total / 1000,
        callbacksPerSecond: total ? values.length * 1000 / total : null,
        medianMs: percentile(sorted, .5), p95Ms: percentile(sorted, .95), p99Ms: percentile(sorted, .99),
        over50ms: values.filter(n => n > 50).length, over100ms: values.filter(n => n > 100).length};
    }),
    limits: 'No temperature sensor access. Callback cadence is not GPU FPS. Actual hand comfort, heat and sustained steering quality need human observation. Trusted DOM events alone do not prove physical interaction without device identification.'
  });
  const stop = () => {
    if (stoppedAt !== null) return result();
    stoppedAt = performance.now(); clearTimeout(timeout); cancelAnimationFrame(raf);
    pointers.clear(); reconcile(); removers.forEach(remove => remove()); return result();
  };
  const frame = now => {
    if (stoppedAt !== null) return;
    if (now - started >= duration) { stop(); return; }
    if (!document.hidden && previous !== null) {
      const minute = Math.min(4, Math.floor((now - started) / 60000));
      (buckets[minute] ||= []).push(now - previous);
    }
    previous = document.hidden ? null : now;
    finalTimer = timer?.textContent;
    finalViewport = {width: innerWidth, height: innerHeight, dpr: devicePixelRatio};
    const amount = Number(steering?.getAttribute('aria-valuenow')) || 0;
    if (amount < -5) leftFrames++;
    if (amount > 5) rightFrames++;
    if (overlap()) {
      if (Math.abs(amount) > 5) overlapSteeringFrames++;
      if (document.body.classList.contains('nitro-active')) overlapBoostFrames++;
    }
    if (events.trustedMotionSamples > 0 && Math.abs(amount) > 5 && ![...pointers.values()].some(p => p.action === 'steering')) sensorWithoutTouchSteeringFrames++;
    raf = requestAnimationFrame(frame);
  };
  window.__camberPhoneProbe = Object.freeze({result, stop});
  timeout = setTimeout(stop, duration); raf = requestAnimationFrame(frame);
  return 'Camber phone probe started for 300 seconds. Drive normally; read __camberPhoneProbe.result().';
})();
