// A browser tab and an installed web app have different display capabilities.
// Never report fullscreen until the browser actually enters that state.
export function screenMode(env = globalThis) {
  const doc = env.document, nav = env.navigator || {}, root = doc?.documentElement;
  const standalone = nav.standalone === true || Boolean(env.matchMedia?.('(display-mode: standalone)').matches)
    || Boolean(env.matchMedia?.('(display-mode: fullscreen)').matches);
  const active = Boolean(doc?.fullscreenElement || doc?.webkitFullscreenElement);
  const standard = typeof root?.requestFullscreen === 'function' && doc.fullscreenEnabled !== false;
  const webkit = typeof root?.webkitRequestFullscreen === 'function' && doc.webkitFullscreenEnabled !== false;
  const ios = /iPhone|iPad|iPod/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  return { active, standalone, supported: standard || webkit, standard, ios,
    label: active ? 'Exit fullscreen' : standalone ? 'Full-screen app' : standard || webkit ? 'Fullscreen' : ios ? 'Full-screen play' : 'Screen options' };
}

export async function toggleScreenMode(env = globalThis) {
  const doc = env.document, state = screenMode(env);
  if (state.standalone && !state.active) return { ...state, help: true };
  if (!state.supported && !state.active) return { ...state, help: true };
  try {
    if (state.active) {
      if (doc.fullscreenElement && doc.exitFullscreen) await doc.exitFullscreen();
      else await doc.webkitExitFullscreen();
    } else if (state.standard) await doc.documentElement.requestFullscreen();
    else await doc.documentElement.webkitRequestFullscreen();
    return { ...screenMode(env), help: false };
  } catch {
    return { ...screenMode(env), help: true, error: 'Your browser did not allow fullscreen. Your race and progress are unchanged.' };
  }
}

export function screenHelpMarkup(state) {
  if (state.standalone) return '<p>You’re already playing in the full-screen web app. Rotate your phone sideways for racing.</p><p>Use your phone’s app switcher to leave the game.</p>';
  if (state.ios) return `<p>Play without Safari’s address bar by opening Camber Reign from your Home Screen.</p>
    <ol class="screen-mode-steps"><li><strong>Open Safari’s Share menu.</strong><span>Depending on your toolbar layout, tap More first, then Share.</span></li><li><strong>Choose Add to Home Screen.</strong><span>Keep <b>Open as Web App</b> switched on, then tap Add.</span></li><li><strong>Launch Camber Reign from its icon.</strong><span>Turn your phone sideways to race.</span></li></ol>
    <p class="screen-mode-note">Safari can’t enter page fullscreen on this iPhone. Home Screen play still needs an internet connection; your current race stays paused while you follow these steps.</p>`;
  return '<p>Fullscreen isn’t available in this browser window. Try the browser’s fullscreen command or install Camber Reign from its menu if offered. On a phone, rotate sideways for the widest racing view.</p>';
}
