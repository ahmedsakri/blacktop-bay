import "./style.css";
import "./racing.css";
import * as THREE from "three";
import WebGL from "three/addons/capabilities/WebGL.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { createWorld } from "./world.js";
import { createCar, prepareCarAssets } from "./car.js";
import { createGarage } from "./garage.js";
import { VEHICLES, getVehicle } from "./vehicles.js";
import { loadProgression, buyUpgrade, awardRaceCredits } from "./progression.js";
import { upgradePanel, speedLabel } from "./upgrades-ui.js";
import {
  initializeAnalytics,
  trackEvent,
  setAnalyticsConsent,
  getAnalyticsConsent,
} from "./analytics.js";
import {
  createRace,
  startRace,
  stepRace,
  resetCar,
  TRACK,
  TRACKS,
  setTrack,
  sampleTrack,
  projectOnTrack,
  getUpgradeStats,
} from "./physics.js";
import { createEffects } from "./effects.js";
import { createAudio } from "./audio.js";
import {
  loadRecords,
  saveResult,
  setSound,
  clearRecords,
  STORAGE_KEY,
} from "./storage.js";
import { BRAND } from "./brand.js";
const $ = (id) => document.getElementById(id),
  clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const format = (t) => {
  const m = Math.floor(t / 60);
  return `${String(m).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}`;
};
for (const el of document.querySelectorAll("[data-brand]"))
  el.textContent = BRAND.name.toUpperCase();
document.title = `${BRAND.name} — AppsOverFlow`;
const preferenceKey = "blacktop-bay-choices-v1";
let preferences = { vehicle: "coupe", track: "harbor" };
try {
  const stored = JSON.parse(localStorage.getItem(preferenceKey));
  if (stored && typeof stored === "object") {
    if (typeof stored.sound === "boolean") preferences.sound = stored.sound;
    if (VEHICLES.some((v) => v.id === stored.vehicle))
      preferences.vehicle = stored.vehicle;
    if (TRACKS.some((t) => t.id === stored.track))
      preferences.track = stored.track;
  }
} catch {}
const requestedTrack = new URLSearchParams(location.search).get("track");
if (TRACKS.some((t) => t.id === requestedTrack))
  preferences.track = requestedTrack;
setTrack(preferences.track);
const recordStore = {
  getItem(key) {
    return localStorage.getItem(
      `${key}-${preferences.track}-${preferences.vehicle}-race-v2`,
    );
  },
  setItem(key, value) {
    localStorage.setItem(
      `${key}-${preferences.track}-${preferences.vehicle}-race-v2`,
      value,
    );
  },
};
function saveChoices() {
  try {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
  } catch {}
}
const progression = loadProgression();
const newRace = () =>
  createRace({ vehicle: preferences.vehicle, track: preferences.track, upgrades: progression.cars[preferences.vehicle] });
function event(name, extra = {}) {
  trackEvent(name, {
    circuit: preferences.track,
    vehicle: preferences.vehicle,
    ...extra,
  });
}
let records = loadRecords(recordStore),
  sound = createAudio(),
  mode = "menu",
  race = newRace(),
  count = 0,
  countValue = 0,
  last = performance.now(),
  time = 0,
  uiTimer = 0,
  frames = [],
  nextFrame = 0,
  modalKind = "",
  previousFocus = null,
  toastTimer = 0,
  countdownTimer = 0,
  pendingLandscapeStart = false,
  orientationFocus = null;
const input = {
    left: false,
    right: false,
    brake: false,
    drift: false,
    nitro: false,
  },
  pointerOwners = new Map(),
  heldKeys = new Set(),
  heldPads = new Set(),
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = matchMedia("(pointer:coarse)").matches || innerWidth < 700;
document.body.classList.toggle("touch-mode", mobile);
$("track-km").textContent = (TRACK.length / 1000).toFixed(2);
if (typeof preferences.sound === "boolean") records.sound = preferences.sound;
sound.setMuted(!records.sound);
updateSound();
updateMenu();
let renderer, world, player, effects, camera, composer, carFill, garageStudio, renderPass, bloomPass;
let garageYaw = -.75,
  garageDrag = null;
let rivalModels = [],
  nitroWasActive = false;
let cameraHeading = TRACK.spawn.yaw,
  cameraSpeed = 0,
  cameraBank = 0,
  cameraKick = 0,
  wasCollision = false;
const loadStarted = performance.now();
const nextPaint = () =>
  new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
function loadProgress(value, label) {
  $("loading-progress").setAttribute("aria-valuenow", value);
  $("loading-fill").style.width = value + "%";
  $("loading-percent").textContent = value + "%";
  $("loading-status").textContent = label;
}
$("start").disabled = true;
$("menu").inert = true;
const camTarget = new THREE.Vector3(),
  lookTarget = new THREE.Vector3(),
  smoothedLook = new THREE.Vector3();
async function initGame() {
  try {
    loadProgress(8, "CHECKING THE GRID");
    await nextPaint();
    if (!WebGL.isWebGL2Available()) throw new Error("WebGL 2 is unavailable");
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, mobile ? 1.5 : 1), mobile ? 1.5 : 1.75));
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    $("scene").append(renderer.domElement);
    renderer.domElement.addEventListener("pointerdown", (e) => {
      if (mode !== "garage") return;
      garageDrag = { id: e.pointerId, x: e.clientX };
      renderer.domElement.setPointerCapture(e.pointerId);
    });
    renderer.domElement.addEventListener("pointermove", (e) => {
      if (mode !== "garage" || garageDrag?.id !== e.pointerId) return;
      garageYaw += (e.clientX - garageDrag.x) * 0.008;
      garageDrag.x = e.clientX;
    });
    const stopGarageDrag = () => {
      garageDrag = null;
    };
    renderer.domElement.addEventListener("pointerup", stopGarageDrag);
    renderer.domElement.addEventListener("pointercancel", stopGarageDrag);
    renderer.domElement.addEventListener("lostpointercapture", stopGarageDrag);

    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "Race canvas. Auto acceleration. Arrow keys or A and D steer, Space drifts, Down or S brakes, Shift boosts, R resets, and Escape pauses.",
    );
    camera = new THREE.PerspectiveCamera(
      55,
      innerWidth / innerHeight,
      0.2,
      1900,
    );
    loadProgress(26, "BUILDING THE WATERFRONT");
    await nextPaint();
    world = createWorld(renderer, { low: mobile });
    loadProgress(52, "PREPARING THE RACE CARS");
    await nextPaint();
    await prepareCarAssets({ low: mobile });
    player = createCar({ vehicle: preferences.vehicle, low: mobile });
    world.scene.add(player.group);
    rivalModels = race.rivals.map((r) => {
      const model = createCar({ vehicle: r.vehicle, color: r.color, low: true });
      world.scene.add(model.group);
      model.group.visible = false;
      return model;
    });
    carFill = new THREE.DirectionalLight("#91bddb", 1.0);
    world.scene.add(carFill, carFill.target);
    garageStudio = createGarage(renderer, { low: mobile });
    addHeadlights(player);
    loadProgress(76, "WARMING UP THE TYRES");
    effects = createEffects(world.scene, { low: mobile });

    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(world.scene, camera);
    composer.addPass(renderPass);
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(innerWidth, innerHeight),
        0.18,
        0.5,
        1.05,
      );
    composer.addPass(bloomPass);
    composer.addPass(new SMAAPass());
    composer.addPass(new OutputPass());
    placeCar();
    updateCamera(1, true);
    world.update(0, race.car);
    loadProgress(90, "LIGHTS. REFLECTIONS. ACTION.");
    await nextPaint();
    await Promise.all([
      renderer.compileAsync(world.scene, camera),
      document.fonts.ready,
    ]);
    composer.render();
    loadProgress(100, "THE COAST IS YOURS");
    const introRemaining = Math.max(
      0,
      (reduced ? 0 : 1250) - (performance.now() - loadStarted),
    );
    await new Promise((resolve) => setTimeout(resolve, introRemaining));
    $("loading").classList.add("loaded");
    document.body.classList.add("is-ready");
    initializePrivacyChoice();
    $("start").disabled = false;
    $("menu").inert = false;
    setTimeout(() => ($("loading").hidden = true), reduced ? 0 : 650);
    last = performance.now();
    requestAnimationFrame(tick);
    renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      pauseGame();
      toast("Graphics paused. Reload the page to restore the scene.");
    });
  } catch (error) {
    console.error(error);
    $("unsupported").hidden = false;
    $("loading").hidden = true;
    if (WebGL.isWebGL2Available()) {
      $("unsupported").querySelector("h2").textContent = "The grid couldn’t finish loading.";
      $("unsupported").querySelector("p").textContent = "Check your connection and reload to try again. The car models may take a moment on a slower connection.";
      const retry = document.createElement("button");
      retry.className = "button primary";
      retry.textContent = "RELOAD GAME";
      retry.onclick = () => location.reload();
      $("unsupported").append(retry);
    }
  }
}
function needsLandscape() {
  const mobileViewport = matchMedia("(any-pointer:coarse)").matches || navigator.maxTouchPoints > 0 || innerWidth < 700;
  return mobileViewport && innerHeight > innerWidth;
}
function orientationGate(show) {
  const wasHidden = $("orientation-gate").hidden;
  $("orientation-gate").hidden = !show;
  for (const el of [document.querySelector("main"), $("scene")]) if (el) el.inert = show;
  document.querySelector("header").inert = show || Boolean(modalKind);
  if (show) {
    clearInput();
    $("orientation-message").textContent = pendingLandscapeStart
      ? "Races are played in landscape. Rotate your phone to give the track and driving controls room."
      : "Your race is paused. Rotate your phone, then choose Keep driving to continue from the same place.";
    $("orientation-fullscreen").hidden = !document.documentElement.requestFullscreen;
    if (wasHidden) { orientationFocus = document.activeElement; $("orientation-dialog").focus({preventScroll:true}); }
  } else if (!wasHidden) {
    $("orientation-status").textContent = "";
    if (mode === "paused") $("dialog").focus({preventScroll:true});
    else orientationFocus?.focus?.({preventScroll:true});
  }
}
async function requestLandscape() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    if (screen.orientation?.lock) await screen.orientation.lock("landscape");
  } catch { /* Safari and some browsers require physical device rotation. */ }
  if (needsLandscape()) $("orientation-status").textContent = "Rotate your phone sideways. If it stays upright, turn off your phone’s portrait orientation lock.";
  checkOrientation();
}
function checkOrientation() {
  if (needsLandscape()) {
    if (["racing", "countdown"].includes(mode)) pauseGame();
    if (pendingLandscapeStart || mode === "paused") orientationGate(true);
    return;
  }
  if (!$("orientation-gate").hidden) {
    orientationGate(false);
    if (pendingLandscapeStart) { pendingLandscapeStart = false; start(); }
  }
}
$("orientation-fullscreen").onclick = requestLandscape;
$("orientation-home").onclick = () => {
  pendingLandscapeStart = false;
  orientationGate(false);
  menu();
};
function updateTouchControls() {
  const touch = matchMedia("(any-pointer:coarse)").matches || innerWidth < 700 || (innerWidth < 1000 && innerHeight < 540);
  document.body.classList.toggle("touch-mode", touch);
  $("touch").hidden = !touch || !["racing", "countdown"].includes(mode);
}
function syncInput() {
  for (const key in input)
    input[key] =
      [...heldKeys].some((code) => keyMap[code] === key) ||
      [...pointerOwners.values()].includes(key) || heldPads.has(key);
  for (const b of document.querySelectorAll("[data-input]")) {
    b.classList.toggle("pressed", input[b.dataset.input]);
    b.setAttribute("aria-pressed", String(input[b.dataset.input]));
  }
}
function clearInput() {
  heldKeys.clear();
  heldPads.clear();
  for (const key in input) input[key] = false;
  pointerOwners.clear();
  for (const el of document.querySelectorAll("[data-input]")) {
    el.classList.remove("pressed");
    el.setAttribute("aria-pressed", "false");
  }
}
function updateMenu() {
  updateGarageCopy();
  $("menu-best").textContent = records.bestTime
    ? `YOUR BEST  ${format(records.bestTime)}  ·  ${records.bestScore.toLocaleString()} DRIFT POINTS`
    : "YOUR FIRST NIGHT STARTS HERE.";
}
function updateSound() {
  $("sound").setAttribute(
    "aria-label",
    records.sound ? "Turn sound off" : "Turn sound on",
  );
  $("sound").setAttribute("aria-pressed", String(records.sound));
  $("sound").style.opacity = records.sound ? "1" : ".55";
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2400);
}
function closeDialog() {
  modalKind = "";
  $("modal-backdrop").hidden = true;
  $("menu").inert = false;
  $("garage").inert = false;
  document.querySelector(".topbar").inert = false;
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
}
function dialog({ kind, title, eyebrow, html, actions }) {
  previousFocus = document.activeElement;
  modalKind = kind;
  $("dialog").dataset.kind = kind;
  $("dialog-eyebrow").textContent = eyebrow;
  $("dialog-title").innerHTML = title;
  $("dialog-content").innerHTML = html;
  $("dialog-actions").replaceChildren();
  for (const a of actions) {
    const b = document.createElement("button");
    b.className = `button ${a.primary ? "primary" : "secondary"}`;
    b.textContent = a.label;
    b.onclick = a.action;
    $("dialog-actions").append(b);
  }
  $("menu").inert = true;
  $("garage").inert = true;
  document.querySelector(".topbar").inert = true;
  $("modal-backdrop").hidden = false;
  $("dialog").focus();
}
function addHeadlights(model) {
  for (const side of [-1, 1]) {
    const beam = new THREE.SpotLight("#d6e9ff", 34, 65, 0.32, 0.65, 1.2);
    beam.position.set(side * 0.65, 0.72, 1.95);
    beam.target.position.set(side * 1.8, -0.25, 32);
    model.group.add(beam, beam.target);
  }
}
function updateGarageCopy() {
  const v = getVehicle(preferences.vehicle);
  const stats = getUpgradeStats(v.id, progression.cars[v.id]);
  $("selected-car-type").textContent =
    `YOUR CAR · ${v.specs.body.toUpperCase()}`;
  $("selected-car-name").textContent = v.name;
  $("selected-car-tagline").textContent = v.tagline.toUpperCase();
  $("garage-class").textContent = v.specs.body.toUpperCase();
  $("garage-name").textContent = v.name;
  $("garage-tagline").textContent = v.tagline;
  $("garage-specs").innerHTML =
    `<dt>Top speed</dt><dd>${speedLabel(stats)}</dd><dt>Character</dt><dd>${v.specs.character}</dd><dt>Nitro tank</dt><dd>${stats.nitroCapacity.toFixed(1)} sec</dd>`;
  $("garage-wallet").textContent = `${progression.credits.toLocaleString()} CR · RACE CREDITS`;
  for (const b of document.querySelectorAll("[data-vehicle]")) {
    b.setAttribute("aria-pressed", String(b.dataset.vehicle === v.id));
    const spec = getUpgradeStats(b.dataset.vehicle, progression.cars[b.dataset.vehicle]);
    b.querySelector("span").textContent = `${speedLabel(spec)} · ${spec.nitroCapacity.toFixed(1)} sec boost`;
  }
}
function showUpgrades(focusComponent) {
  dialog({kind: "upgrades", eyebrow: "THE WORKSHOP · BUILT FOR YOUR NEXT RACE", title: `Make it <em>yours.</em>`, html: upgradePanel(progression, preferences.vehicle), actions: [{label:"BACK TO GARAGE",primary:true,action:()=>{closeDialog();$("open-upgrades").focus();}}]});
  previousFocus = $("open-upgrades");
  for (const button of document.querySelectorAll("[data-upgrade]")) {
    button.onclick = () => {
      const component = button.dataset.upgrade;
      const result = buyUpgrade(progression, preferences.vehicle, component);
      if (!result.ok) return;
      race = newRace();
      updateGarageCopy();
      showUpgrades(component);
      toast(result.persisted ? `Level ${result.level} installed. Ready for the road.` : "Upgrade active. Browser storage is unavailable, so it will last for this session.");
    };
  }
  if (focusComponent) document.querySelector(`[data-upgrade="${focusComponent}"]:not(:disabled)`)?.focus();
}
function chooseVehicle(id) {
  if (mode !== "menu" && mode !== "garage") return;
  preferences.vehicle = getVehicle(id).id;
  saveChoices();
  if (player) {
    player.group.removeFromParent();
    player.dispose();
    player = createCar({ vehicle: preferences.vehicle, low: mobile });
    world.scene.add(player.group);
    addHeadlights(player);
  }
  race = newRace();
  effects?.clear();
  const enabled = records.sound;
  records = loadRecords(recordStore);
  records.sound = enabled;
  setSound(enabled, recordStore);
  updateMenu();
  if (player) placeCar();
  event("car_select");
}
function openGarage() {
  closeDialog();
  clearInput();
  mode = "garage";
  $("menu").hidden = true;
  $("garage").hidden = false;
  document.body.classList.add("in-garage");
  updateGarageCopy();
  document.querySelector(".car-choice[aria-pressed=\"true\"]")?.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});
  $("garage-back").focus({ preventScroll: true });
  event("garage_open");
}
function start() {
  // Preserve the initial tap activation before a physical rotation starts the race.
  sound.unlock();
  if (needsLandscape()) {
    pendingLandscapeStart = true;
    orientationGate(true);
    // Only touch hardware attempts a browser orientation lock; small desktop
    // windows can be resized without an unexpected fullscreen transition.
    if (matchMedia("(any-pointer:coarse)").matches || navigator.maxTouchPoints > 0) void requestLandscape();
    return;
  }
  pendingLandscapeStart = false;
  orientationGate(false);
  clearTimeout(countdownTimer);
  closeDialog();
  clearInput();
  renderer.domElement.focus({ preventScroll: true });
  sound.unlock();
  race = newRace();
  frames = [];
  nextFrame = 0;
  effects.clear();
  count = 3;
  countValue = 0;
  cameraHeading = race.car.yaw;
  cameraKick = 0;
  nitroWasActive = false;
  document.body.classList.remove("in-garage");
  document.body.classList.add("in-race");
  mode = "countdown";
  $("menu").hidden = true;
  $("garage").hidden = true;
  $("hud").hidden = false;
  $("pause").hidden = false;
  updateTouchControls();
  $("countdown").hidden = false;
  $("ghost-label").textContent = "YOU · 3 RIVALS";
  placeCar();
  updateRivals();
  updateCamera(0.016, false);
  updateHud();
  event("race_start");
}
function menu() {
  pendingLandscapeStart = false;
  orientationGate(false);
  try { screen.orientation?.unlock?.(); } catch {}
  clearTimeout(countdownTimer);
  closeDialog();
  clearInput();
  mode = "menu";
  document.body.classList.remove(
    "in-race",
    "in-garage",
    "drift-active",
    "is-colliding",
    "nitro-active",
  );
  race = newRace();
  for (const m of rivalModels) m.group.visible = false;
  $("menu").hidden = false;
  $("garage").hidden = true;
  $("hud").hidden = true;
  $("pause").hidden = true;
  $("touch").hidden = true;
  $("countdown").hidden = true;
  updateMenu();
  effects.clear();
  $("start").focus({ preventScroll: true });
}
function pauseGame() {
  if (mode !== "racing" && mode !== "countdown") return;
  const was = mode;
  event("race_pause");
  mode = "paused";
  updateTouchControls();
  clearInput();
  dialog({
    kind: "pause",
    eyebrow: "TAKE A BREATHER",
    title: "The coast can <em>wait.</em>",
    html: "<p>Your race is paused. Pick up exactly where you left off.</p>",
    actions: [
      {
        label: "KEEP DRIVING",
        primary: true,
        action() {
          if (needsLandscape()) { orientationGate(true); return; }
          closeDialog();
          mode = was;
          updateTouchControls();
          event("race_resume");
          last = performance.now();
          renderer.domElement.focus({ preventScroll: true });
          sound.unlock();
        },
      },
      { label: "RESTART", action: start },
      { label: "BACK TO HOME", action: menu },
    ],
  });
}
function how() {
  dialog({
    kind: "how",
    eyebrow: "FIND YOUR LINE",
    title: "Brake. Turn.<br><em>Let it slide.</em>",
    html: `<p>The car accelerates for you. Steer into each corner, hold drift briefly to loosen the rear, then release it and steer gently back into line.</p><div class="controls-guide"><div><b>Steer</b><span>← / → or A / D</span></div><div><b>Drift / handbrake</b><span>Hold Space</span></div><div><b>Brake</b><span>↓ or S</span></div><div><b>Nitro boost</b><span>Hold Shift</span></div><div><b>Reset / pause</b><span>R / Esc</span></div></div><p>On a phone, rotate to landscape to race with the large driving pads. Turning upright pauses the race. Race three laps against three AI drivers. Hold Shift or the NITRO pad for extra speed; release it to recharge while driving and drifting. Finish first to take the win. Best times are saved separately for each car and circuit on this device. Earn race credits at the finish, then use Garage → Upgrade car to improve each car’s engine, tyres, nitro and handling. Keep a drift clean to build your multiplier; hitting a barrier loses unbanked points.</p>`,
    actions: [
      { label: "GOT IT", primary: true, action: closeDialog },
      { label: "LET’S DRIVE", action: start },
    ],
  });
}
function privacy() {
  dialog({
    kind: "privacy",
    eyebrow: "YOUR RACE. YOUR CHOICE.",
    title: "You’re in <em>control.</em>",
    html: `<p>Your car and circuit choices, best times, sound setting, upgrade levels and race-credit balance stay in this browser. Clearing race records keeps your workshop progress. Clearing this website’s browser data removes all of them. Gameplay analytics is ${getAnalyticsConsent() === "granted" ? "enabled" : "off"}. When allowed, Google Analytics receives game events such as circuit selection and race completion, without your name, email address or recorded keystrokes.</p><p>Read the <a href="/privacy/">full privacy notice</a> for hosting, Google services and advertising details.</p><div class="privacy-controls"><button id="privacy-enable">Allow analytics</button><button id="privacy-disable">Turn analytics off</button></div>`,
    actions: [
      { label: "CLOSE", primary: true, action: closeDialog },
      {
        label: "CLEAR RACE RECORDS",
        action() {
          try {
            Object.keys(localStorage)
              .filter((k) => k.startsWith(STORAGE_KEY))
              .forEach((k) => localStorage.removeItem(k));
          } catch {}
          const enabled = records.sound;
          records = clearRecords(recordStore);
          records.sound = enabled;
          setSound(enabled, recordStore);
          preferences.sound = enabled;
          saveChoices();
          updateSound();
          updateMenu();
          closeDialog();
          toast("Race records cleared on this device.");
        },
      },
    ],
  });
  $("privacy-enable").onclick = () => {
    setAnalyticsConsent(true);
    closeDialog();
    toast("Gameplay analytics enabled.");
  };
  $("privacy-disable").onclick = () => {
    setAnalyticsConsent(false);
    closeDialog();
    toast("Gameplay analytics turned off.");
  };
}
function finishRows() {
  return race.leaderboard
    .map(
      (r) =>
        `<li class="${r.isPlayer ? "you" : ""}"><b>${r.position}</b><div><strong>${r.isPlayer ? "YOU" : r.name}</strong><small>${getVehicle(r.vehicle).name}</small></div><time>${r.finished ? format(r.finishTime) : `LAP ${Math.min(3, r.completedLaps + 1)}`}</time></li>`,
    )
    .join("");
}
function updateFinish() {
  if (modalKind !== "result") return;
  const list = $("finish-order");
  if (list) {
    const rows = finishRows();
    if (list.innerHTML !== rows) list.innerHTML = rows;
  }
  const status = $("finish-status");
  if (status)
    status.textContent = race.allFinished
      ? "All four drivers classified. Ready for a rematch?"
      : "The remaining drivers are still racing. Times update at the finish.";
}
function finish() {
  clearTimeout(countdownTimer);
  $("countdown").hidden = true;
  mode = "finished";
  clearInput();
  document.body.classList.remove("nitro-active");
  $("touch").hidden = true;
  $("pause").hidden = true;
  const previous = records.bestTime;
  const reward = awardRaceCredits(progression, race);
  const enabled = records.sound;
  records = saveResult(race, frames, recordStore);
  records.sound = enabled;
  const best =
    records.bestTime === race.elapsed &&
    (previous === null || race.elapsed < previous);
  event("race_complete", {
    position: race.position,
    duration_seconds: Math.round(race.elapsed),
    drift_score: race.score,
    resets: race.recoveries,
  });
  const suffix =
    race.position === 1
      ? "ST"
      : race.position === 2
        ? "ND"
        : race.position === 3
          ? "RD"
          : "TH";
  dialog({
    kind: "result",
    eyebrow: `${TRACK.name.toUpperCase()} · CLASSIFIED`,
    title:
      race.position === 1
        ? "You owned the <em>coast.</em>"
        : "Every finish. A new <em>beginning.</em>",
    html: `<div class="finish-checkers"></div><div class="finish-hero"><div><div class="finish-rank"><b>${race.position}</b><span>${suffix} / 4</span></div><p>${race.position === 1 ? "RACE WINNER" : race.position <= 3 ? "PODIUM FINISH" : "RACE COMPLETE"}</p></div><div class="finish-clock"><strong>${format(race.elapsed)}</strong><span>${best ? "NEW PERSONAL BEST" : "YOUR RACE TIME"}</span></div></div><ol class="finish-order" id="finish-order">${finishRows()}</ol><div class="finish-stats"><div><span>BEST LAP</span><strong>${format(race.bestLap)}</strong></div><div><span>DRIFT POINTS</span><strong>${race.score.toLocaleString()}</strong></div><div><span>CAR RESETS</span><strong>${race.recoveries}</strong></div></div><p class="finish-status" id="finish-status"></p>`,
    actions: [
      { label: "RACE AGAIN", primary: true, action: start },
      {
        label: "GARAGE",
        action() {
          menu();
          openGarage();
        },
      },
      { label: "HOME", action: menu },
    ],
  });
  if (reward.awarded) {
    const earned = document.createElement("div");
    earned.className = "finish-reward";
    earned.innerHTML = `<strong>+${reward.credits.toLocaleString()} CR</strong><span>Race credits earned · ${progression.credits.toLocaleString()} CR available in the workshop</span>`;
    $("dialog-content").append(earned);
  }
  updateFinish();
}
function initializePrivacyChoice() {
  initializeAnalytics();
  $("consent-banner").hidden = getAnalyticsConsent() !== "unset";
}
$("consent-accept").onclick = () => {
  setAnalyticsConsent(true);
  $("consent-banner").hidden = true;
};
$("consent-decline").onclick = () => {
  setAnalyticsConsent(false);
  $("consent-banner").hidden = true;
};
$("circuit-select").replaceChildren(
  ...TRACKS.map((t) => {
    const option = document.createElement("option");
    option.value = t.id;
    option.textContent = t.name;
    return option;
  }),
);
$("circuit-select").value = preferences.track;
$("circuit-description").textContent = TRACK.description;
$("circuit-select").onchange = () => {
  preferences.track = $("circuit-select").value;
  saveChoices();
  event("circuit_select");
  const url = new URL(location.href);
  url.searchParams.set("track", preferences.track);
  location.assign(url);
};
$("garage-cars").replaceChildren(
  ...VEHICLES.map((v, i) => {
    const b = document.createElement("button");
    b.className = "car-choice";
    b.dataset.vehicle = v.id;
    b.style.setProperty("--car-color", v.color);
    b.setAttribute("aria-pressed", String(v.id === preferences.vehicle));
    b.innerHTML = `<small>0${i + 1} / ${v.specs.character.toUpperCase()}</small><strong>${v.name}</strong><span>${v.specs.speed} · ${v.specs.boost} boost</span>`;
    b.onclick = () => { chooseVehicle(v.id); b.scrollIntoView({block:"nearest",inline:"nearest",behavior:reduced ? "instant" : "smooth"}); };
    return b;
  }),
);
$("open-garage").onclick = openGarage;
$("open-upgrades").onclick = () => showUpgrades();
$("garage-back").onclick = menu;
$("garage-race").onclick = start;
$("garage-angle").onclick = () => {
  garageYaw += Math.PI * 0.5;
};
$("start").onclick = start;
$("how").onclick = how;
$("privacy-link").onclick = privacy;
$("pause").onclick = pauseGame;
$("recover").onclick = () => {
  if (mode === "racing") {
    resetCar(race);
    event("car_reset");
    effects.clear();
    toast("Back on your line.");
    renderer.domElement.focus({ preventScroll: true });
  }
};
$("sound").onclick = () => {
  records.sound = !records.sound;
  preferences.sound = records.sound;
  saveChoices();
  setSound(records.sound, recordStore);
  sound.unlock();
  sound.setMuted(!records.sound);
  updateSound();
};
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen)
      await document.documentElement.requestFullscreen();
    else toast("Use landscape for the widest view on this device.");
  } catch {
    toast("Fullscreen is not available in this browser.");
  }
};
document.addEventListener("fullscreenchange", () =>
  $("fullscreen").setAttribute(
    "aria-label",
    document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen",
  ),
);
$("home-link").onclick = (e) => {
  e.preventDefault();
  if (mode === "racing" || mode === "countdown") pauseGame();
  else if (mode === "menu") $("start").focus();
  else if (mode === "garage") menu();
};
const keyMap = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowDown: "brake",
  KeyS: "brake",
  Space: "drift",
  ShiftLeft: "nitro",
  ShiftRight: "nitro",
};
window.addEventListener("keydown", (e) => {
  if (!$("orientation-gate").hidden) {
    if (e.code === "Escape") { e.preventDefault(); return; }
    if (e.key === "Tab") {
      const buttons = [...$("orientation-gate").querySelectorAll("button")].filter(b => !b.hidden);
      const first = buttons[0], end = buttons.at(-1);
      if (e.shiftKey && [first, $("orientation-dialog")].includes(document.activeElement)) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    }
    return;
  }
  if ((e.code === "Escape" || e.code === "KeyP") && e.repeat) return;
  if (modalKind) {
    if (e.code === "Escape") {
      e.preventDefault();
      if (modalKind === "pause")
        document.querySelector("#dialog-actions button")?.click();
      else if (modalKind !== "result") closeDialog();
    }
    return;
  }
  if (e.code === "Escape" && mode === "garage") {
    menu();
    return;
  }
  if (e.code === "Escape" || e.code === "KeyP") {
    pauseGame();
    return;
  }
  if (mode !== "racing" && mode !== "countdown") return;
  if (e.code === "Space" && e.target.closest?.("button,a")) return;
  if (keyMap[e.code]) {
    e.preventDefault();
    heldKeys.add(e.code);
    syncInput();
  }
  if (e.code === "KeyR" && !e.repeat) {
    resetCar(race);
    event("car_reset");
    effects.clear();
    toast("Back on your line.");
  }
});
window.addEventListener("keyup", (e) => {
  if (keyMap[e.code]) {
    const wasHeld = heldKeys.has(e.code);
    heldKeys.delete(e.code);
    syncInput();
    if (mode === "racing" && wasHeld) e.preventDefault();
  }
});
for (const b of document.querySelectorAll("[data-input]")) {
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("pointerdown", (e) => {
    if (!["racing", "countdown"].includes(mode) || e.button !== 0) return;
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    pointerOwners.set(e.pointerId, b.dataset.input);
    syncInput();
  });
  const release = (e) => {
    pointerOwners.delete(e.pointerId);
    syncInput();
  };
  b.addEventListener("pointerup", release);
  b.addEventListener("pointercancel", release);
  b.addEventListener("lostpointercapture", release);
  b.addEventListener("keydown", (e) => {
    if (!["Space", "Enter"].includes(e.code) || !["racing", "countdown"].includes(mode)) return;
    e.preventDefault(); e.stopPropagation();
    heldPads.add(b.dataset.input); syncInput();
  });
  b.addEventListener("keyup", (e) => {
    if (!["Space", "Enter"].includes(e.code)) return;
    e.preventDefault(); e.stopPropagation();
    heldPads.delete(b.dataset.input); syncInput();
  });
  b.addEventListener("blur", () => { heldPads.delete(b.dataset.input); syncInput(); });
}
window.addEventListener("blur", () => {
  clearInput();
  pauseGame();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInput();
    pauseGame();
  }
});
$("dialog").addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const focus = [...$("dialog").querySelectorAll("button,a,select")].filter(
    (el) => !el.disabled,
  );
  if (
    e.shiftKey &&
    (document.activeElement === focus[0] ||
      document.activeElement === $("dialog"))
  ) {
    e.preventDefault();
    focus.at(-1)?.focus();
  } else if (!e.shiftKey && document.activeElement === focus.at(-1)) {
    e.preventDefault();
    focus[0]?.focus();
  }
});
window.addEventListener("resize", () => {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
  checkOrientation();
  updateTouchControls();
});
function placeCar() {
  player.group.position.set(race.car.x, 0.055, race.car.z);
  player.group.rotation.y = race.car.yaw;
}

function updateCamera(dt, instant = false) {
  const c = race.car;
  const f = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
  const side = new THREE.Vector3(f.z, 0, -f.x);
  const pos = new THREE.Vector3(c.x, 0, c.z);
  if (mode === "garage" || mode === "finished") {
    const angle =
      c.yaw +
      (mode === "garage" ? garageYaw : 2.8) +
      (reduced ? 0 : Math.sin(time * 0.17) * 0.22);
    const narrowGarage = innerWidth < 600;
    const distance = narrowGarage
      ? Math.max(9.5, 6.4 / (2 * Math.tan(THREE.MathUtils.degToRad(51 / 2)) * camera.aspect))
      : 8.3;
    camTarget.set(
      c.x + Math.sin(angle) * distance,
      narrowGarage ? distance * .28 : 2.9,
      c.z + Math.cos(angle) * distance,
    );
    lookTarget.set(c.x, mode === "garage" ? (narrowGarage ? (innerHeight < 700 ? -.1 : .8) : -.05) : .64, c.z);
    camera.fov = innerWidth < 600 ? 51 : 43;
  } else if (mode === "menu") {
    const narrow = innerWidth < 600;
    const orbit = reduced ? 0 : Math.sin(time * 0.14) * 0.65;
    camTarget
      .copy(pos)
      .addScaledVector(f, -(narrow ? 8.5 : 8.0))
      .addScaledVector(side, (narrow ? 4.3 : 5.7) + orbit);
    camTarget.y = narrow ? 3.15 : 2.65;
    lookTarget.copy(pos).addScaledVector(side, narrow ? 0 : 3.25);
    lookTarget.y = narrow ? -0.05 : 0.95;
    camera.fov = narrow ? 53 : 49;
    cameraHeading = c.yaw;
  } else {
    const velocityYaw = c.speed > 6 ? Math.atan2(c.vx, c.vz) : c.yaw;
    const slip = Math.atan2(
      Math.sin(velocityYaw - c.yaw),
      Math.cos(velocityYaw - c.yaw),
    );
    const desiredHeading = c.yaw + slip * 0.4;
    const delta = Math.atan2(
      Math.sin(desiredHeading - cameraHeading),
      Math.cos(desiredHeading - cameraHeading),
    );
    cameraHeading += delta * (instant ? 1 : 1 - Math.exp(-dt * 3.2));
    const forward = new THREE.Vector3(
      Math.sin(cameraHeading),
      0,
      Math.cos(cameraHeading),
    );
    cameraSpeed += (c.speed - cameraSpeed) * (1 - Math.exp(-dt * 4));
    camTarget.copy(pos).addScaledVector(forward, -8.5 - cameraSpeed * 0.048);
    camTarget.y = 3.5 + cameraSpeed * 0.012;
    lookTarget.copy(pos).addScaledVector(forward, 5.5);
    lookTarget.y = 1.05;
    camera.fov =
      56 + cameraSpeed * 0.22 + (race.nitro.active && !reduced ? 5 : 0);
  }
  const blend = instant ? 1 : 1 - Math.exp(-dt * (mode === "menu" ? 2 : 7));
  camera.position.lerp(camTarget, blend);
  smoothedLook.lerp(lookTarget, instant ? 1 : 1 - Math.exp(-dt * 8));
  if (!reduced && mode === "racing") {
    camera.position.x += Math.sin(time * 61) * cameraKick;
    camera.position.y += Math.cos(time * 53) * cameraKick * 0.5;
  }
  camera.lookAt(smoothedLook);
  const targetBank =
    !reduced && mode === "racing"
      ? -c.steering * Math.min(c.speed / 35, 1) * 0.013
      : 0;
  cameraBank += (targetBank - cameraBank) * (1 - Math.exp(-dt * 4));
  camera.rotateZ(cameraBank);
  carFill.position.copy(camera.position);
  carFill.position.y += 3;
  carFill.target.position.set(c.x, 0.6, c.z);
  camera.updateProjectionMatrix();
}
function updateRivals() {
  for (let i = 0; i < rivalModels.length; i++) {
    const model = rivalModels[i],
      r = race.rivals[i];
    model.group.visible = mode !== "menu" && mode !== "garage";
    model.group.position.set(r.car.x, 0.055, r.car.z);
    model.group.rotation.y = r.car.yaw;
    model.update({
      speed:
        (mode === "racing" || mode === "finished") && r.state !== "finished"
          ? r.car.speed
          : 0,
      steering: r.car.steering,
      brake: r.car.braking ? 1 : 0,
      drift: r.car.drifting,
      nitro: r.car.nitroActive,
      time,
    });
  }
}
const trackBounds = {
  minX: Math.min(...TRACK.samples.map((p) => p.x)),
  maxX: Math.max(...TRACK.samples.map((p) => p.x)),
  minZ: Math.min(...TRACK.samples.map((p) => p.z)),
  maxZ: Math.max(...TRACK.samples.map((p) => p.z)),
};
const map = $("map").getContext("2d");
function drawMap() {
  const a = TRACK.samples,
    b = trackBounds;
  const scale = 210 / Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  const to = (x, z) => [
    140 + (x - (b.maxX + b.minX) / 2) * scale,
    140 + (z - (b.maxZ + b.minZ) / 2) * scale,
  ];
  map.clearRect(0, 0, 280, 280);
  map.lineCap = "round";
  map.lineJoin = "round";
  map.beginPath();
  a.forEach((p, i) => {
    const [x, y] = to(p.x, p.z);
    i ? map.lineTo(x, y) : map.moveTo(x, y);
  });
  map.closePath();
  map.strokeStyle = "#082132b5";
  map.lineWidth = 13;
  map.stroke();
  map.strokeStyle = "#bdd1db99";
  map.lineWidth = 3;
  map.stroke();
  for (const rival of race.rivals) {
    const [x, y] = to(rival.car.x, rival.car.z);
    map.beginPath();
    map.arc(x, y, 4.5, 0, Math.PI * 2);
    map.fillStyle = rival.color;
    map.fill();
  }
  const [x, y] = to(race.car.x, race.car.z);
  map.save();
  map.translate(x, y);
  map.rotate(-race.car.yaw);
  map.beginPath();
  map.moveTo(0, 8);
  map.lineTo(-6, -6);
  map.lineTo(6, -6);
  map.closePath();
  map.fillStyle = "#ff715b";
  map.shadowColor = "#ff8e67";
  map.shadowBlur = 8;
  map.fill();
  map.restore();
}
function updateHud() {
  $("position").textContent = race.position;
  $("rival-order").innerHTML = race.leaderboard
    .map(
      (r) =>
        `<li class="${r.isPlayer ? "you" : ""}" style="--car-color:${r.isPlayer ? getVehicle(preferences.vehicle).color : r.color}"><b>${r.position}</b><i></i>${r.isPlayer ? "YOU" : r.name.toUpperCase()}</li>`,
    )
    .join("");
  const charge = race.nitro.charge / race.nitro.capacity;
  $("nitro-fill").style.width = `${charge * 100}%`;
  $("nitro-amount").textContent = `${Math.round(charge * 100)}%`;
  $("nitro-status").textContent = race.nitro.active
    ? "NITRO ACTIVE"
    : race.nitro.locked
      ? "RELEASE NITRO"
      : charge > 0.15
        ? "NITRO READY"
        : "RECHARGING";
  document.body.classList.toggle(
    "nitro-active",
    mode === "racing" && race.nitro.active,
  );
  document
    .querySelector(".nitro-pedal")
    .classList.toggle("unavailable", race.nitro.locked || charge < 0.1);

  $("speed").textContent = Math.round(race.car.speed * 3.6);
  $("gear").textContent =
    race.car.speed < 1
      ? "N"
      : `GEAR ${Math.min(6, Math.floor(race.car.speed / 8) + 1)}`;
  $("speed-arc").style.strokeDasharray =
    `${clamp(race.car.speed / 45, 0, 1) * 320} 430`;
  $("timer").textContent = format(race.elapsed);
  $("lap").textContent = race.lap;
  $("score").textContent = Math.floor(
    race.score + race.driftPoints,
  ).toLocaleString();
  $("combo").innerHTML = `DRIFT <em>×${race.combo}</em>`;
  $("drift-label").textContent = race.collision
    ? "STAY OFF THE BARRIER"
    : race.car.drifting
      ? "HOLD THAT LINE"
      : race.driftPoints > 0
        ? "BRING IT HOME"
        : "FIND YOUR FLOW";
  $("combo-fill").style.width =
    `${race.car.drifting ? (race.combo / 5) * 100 : 0}%`;
  $("lap-time").textContent = race.bestLap
    ? `BEST LAP ${format(race.bestLap)}`
    : "FIRST LAP";
  $("steer-needle").style.transform = `translateX(${race.car.steering * 35}px)`;
  $("steer-right").classList.toggle("active", input.right);
  $("steer-left").classList.toggle("active", input.left);
  document.body.classList.toggle(
    "drift-active",
    mode === "racing" && race.car.drifting,
  );
  document.body.classList.toggle(
    "is-colliding",
    mode === "racing" && race.collision,
  );
  $("speed-lines").style.opacity =
    mode === "racing" && !reduced
      ? Math.max(0, (race.car.speed - 23) / 22) * 0.25
      : 0;
  drawMap();
}
function tick(now) {
  const wasFinished = mode === "finished";
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  time += dt;
  uiTimer += dt;
  if (mode === "countdown") {
    count -= dt;
    const n = Math.ceil(count);
    if (n !== countValue) {
      countValue = n;
      $("countdown").textContent = n > 0 ? n : "GO";
      $("countdown").animate(
        [
          { opacity: 0, transform: "translate(-50%,-50%) scale(1.3)" },
          { opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
        ],
        { duration: reduced ? 0 : 330, easing: "cubic-bezier(.16,1,.3,1)" },
      );
      sound.beep(n > 0 ? 440 : 880, 0.12);
      world.startLights.forEach((m, i) =>
        m.material.color.set(
          n <= 0 ? "#42f9ae" : i < 4 - n ? "#ff674c" : "#452a28",
        ),
      );
    }
    if (count <= 0) {
      startRace(race);
      mode = "racing";
      countdownTimer = setTimeout(() => ($("countdown").hidden = true), 600);
    }
  }
  if (mode === "racing") {
    const lastLap = race.completedLaps;
    stepRace(
      race,
      {
        steer: (input.right ? 1 : 0) - (input.left ? 1 : 0),
        throttle: 1,
        brake: input.brake,
        handbrake: input.drift,
        nitro: input.nitro,
      },
      dt,
    );
    if (race.elapsed >= nextFrame && frames.length < 9000) {
      frames.push({
        t: race.elapsed,
        x: race.car.x,
        z: race.car.z,
        yaw: race.car.yaw,
      });
      nextFrame += 0.1;
    }
    if (race.completedLaps > lastLap && race.state !== "finished") {
      toast(`Lap ${race.completedLaps} · ${format(race.lastLap)}`);
      event("lap_complete", {
        lap: race.completedLaps,
        duration_seconds: Math.round(race.lastLap),
      });
    }
    if (race.state === "finished") finish();
  }
  if (wasFinished && !race.allFinished) stepRace(race, {}, dt);
  if (mode === "finished") updateFinish();
  if (mode === "racing" && race.nitro.active && !nitroWasActive)
    event("nitro_use");
  nitroWasActive = race.nitro.active;
  placeCar();
  player.update({
    speed: mode === "racing" ? race.car.speed : 0,
    steering: race.car.steering,
    brake: input.brake ? 1 : 0,
    drift: race.car.drifting,
    nitro: mode === "racing" && race.nitro.active,
    time,
  });
  updateRivals();
  effects.update(race.car, dt, time, mode === "racing", {
    profile: player.group.userData.effects,
    brake: input.brake,
    handbrake: input.drift,
    throttle: mode === "racing" && !input.brake ? 1 : 0,
    collision: race.collision,
    menu: mode === "menu" || mode === "garage",
  });
  if (race.collision && !wasCollision && !reduced) cameraKick = 0.1;
  wasCollision = race.collision;
  cameraKick *= Math.exp(-dt * 9);
  world.update(time, race.car);
  const activeScene = mode === "garage" ? garageStudio.scene : world.scene;
  if (player.group.parent !== activeScene) activeScene.add(player.group);
  renderPass.scene = activeScene;
  bloomPass.strength = mode === "garage" ? .04 : .18;
  renderer.toneMappingExposure = mode === "garage" ? .85 : 1.1;
  if (mode === "garage") garageStudio.position(race.car);
  updateCamera(dt);
  sound.update(
    {
      speed: race.car.speed,
      drift: race.car.drifting,
      brake: input.brake,
      running: mode === "racing",
    },
    dt,
  );
  if (uiTimer > 0.075) {
    uiTimer = 0;
    if (mode !== "menu") updateHud();
  }
  composer.render();
  requestAnimationFrame(tick);
}

if (import.meta.env.DEV) {
  window.__blacktopBayQA = Object.freeze({
    snapshot: () => ({
      mode,
      input: {...input},
      car: { ...race.car },
      elapsed: race.elapsed,
      nitro: { ...race.nitro },
      position: race.position,
      track: race.track,
      vehicle: race.vehicle,
      rivals: race.rivals.map((r) => ({
        id: r.id,
        car: { ...r.car },
        finishTime: r.finishTime,
      })),
      leaderboard: race.leaderboard,
      score: race.score + race.driftPoints,
      effects: effects?.stats,
      camera: camera
        ? { x: camera.position.x, z: camera.position.z, heading: cameraHeading }
        : null,
    }),
  });
}
initGame();
