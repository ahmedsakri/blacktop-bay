const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const radians = Math.PI / 180;

// Project the W3C device-frame gravity vector onto the current screen's right
// axis. Unlike swapping beta/gamma, this remains stable at inclined hand angles.
// https://www.w3.org/TR/orientation-event/#deviceorientation
export function screenTiltDegrees({beta, gamma} = {}, screenAngle = 0) {
  if (![beta, gamma, screenAngle].every(Number.isFinite)) return null;
  const b = beta * radians, g = gamma * radians, s = screenAngle * radians;
  const upX = -Math.cos(b) * Math.sin(g), upY = Math.sin(b);
  return Math.asin(clamp(-upX * Math.cos(s) + upY * Math.sin(s), -1, 1)) / radians;
}

export function createTiltSteering({now = () => performance.now(), staleAfter = 1500} = {}) {
  let center = null, raw = null, angle = null, sampledAt = -Infinity, amount = 0, target = 0;
  const clear = () => { center = raw = null; sampledAt = -Infinity; amount = target = 0; };
  const fresh = () => raw !== null && now() - sampledAt <= staleAfter;
  return {
    sample(event, screenAngle = 0) {
      const value = screenTiltDegrees(event, screenAngle);
      if (value === null) return false;
      const orientation = ((screenAngle % 360) + 360) % 360;
      // A suspended sensor can resume at a different hand position. Its first
      // fresh event is a new neutral pose, never an unexpected full-lock turn.
      if (angle !== orientation || !fresh()) { clear(); angle = orientation; }
      raw = value; sampledAt = now();
      if (center === null) center = value;
      const delta = value - center;
      target = Math.sign(delta) * clamp((Math.abs(delta) - 2.5) / 21.5, 0, 1);
      return true;
    },
    read(dt = 1 / 60) {
      if (!fresh()) { amount = target = 0; return 0; }
      amount += (target - amount) * (1 - Math.exp(-clamp(Number.isFinite(dt) ? dt : 0, 0, .1) / .085));
      return Math.abs(amount) < .0001 ? 0 : amount;
    },
    calibrate() {
      if (!fresh()) return false;
      center = raw; amount = target = 0; return true;
    },
    fresh, clear,
  };
}

// Call directly from the Enable Gyroscope click. iOS requires transient activation;
// availability of the interface alone does not prove that a sensor is reporting.
export async function requestTiltPermission(environment = globalThis) {
  if (environment.isSecureContext === false) return {ok: false, reason: 'secure'};
  const orientation = environment.DeviceOrientationEvent;
  if (!orientation) return {ok: false, reason: 'unsupported'};
  try {
    if (typeof orientation.requestPermission === 'function') {
      const result = await orientation.requestPermission();
      if (result !== 'granted') return {ok: false, reason: 'denied'};
    }
    return {ok: true};
  } catch { return {ok: false, reason: 'denied'}; }
}
