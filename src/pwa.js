// Installation is offered only when the browser supplies a prompt and a player
// explicitly chooses it. Waiting workers never reload or interrupt the race.
export function createPwaController(env = globalThis) {
  let installEvent = null, started = false, registration = null, installed = false;
  const standalone = () => installed || env.navigator?.standalone === true
    || Boolean(env.matchMedia?.('(display-mode: standalone)').matches)
    || Boolean(env.matchMedia?.('(display-mode: fullscreen)').matches);
  const canInstall = () => Boolean(installEvent) && !standalone();
  const notify = () => {
    if (env.CustomEvent && env.dispatchEvent) env.dispatchEvent(new env.CustomEvent('pwa-install-available', {
      detail: { available: canInstall(), installed: standalone() },
    }));
  };
  const onPrompt = event => {
    if (standalone()) return;
    event.preventDefault(); installEvent = event; notify();
  };
  const onInstalled = () => { installed = true; installEvent = null; notify(); };
  function register() {
    if (!started) {
      started = true;
      env.addEventListener?.('beforeinstallprompt', onPrompt);
      env.addEventListener?.('appinstalled', onInstalled);
    }
    if (registration) return registration;
    if (!env.isSecureContext || !env.navigator?.serviceWorker) return Promise.resolve(null);
    const run = () => env.navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
    registration = (env.document?.readyState === 'complete'
      ? Promise.resolve().then(run)
      : new Promise(resolve => env.addEventListener('load', resolve, { once: true })).then(run))
      .catch(() => null); // Browser play remains available if storage/registration is denied.
    return registration;
  }
  async function requestInstall() {
    if (!canInstall()) return { outcome: 'unavailable' };
    const event = installEvent; installEvent = null;
    try {
      // Invoke before any await to retain the initiating button's user gesture.
      const prompted = event.prompt(); notify();
      await prompted;
      const choice = await event.userChoice;
      return { outcome: choice?.outcome === 'accepted' ? 'accepted' : 'dismissed' };
    } catch { notify(); return { outcome: 'error' }; }
  }
  return { register, canInstall, requestInstall };
}

const pwa = createPwaController();
export const registerPWA = () => pwa.register();
export const canInstallPWA = () => pwa.canInstall();
export const requestInstallPWA = () => pwa.requestInstall();
