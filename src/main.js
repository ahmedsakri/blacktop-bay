import "./style.css";
import * as THREE from "three";
import WebGL from "three/addons/capabilities/WebGL.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createWorld } from "./world.js";
import { createCar } from "./car.js";
import {
  createRace,
  startRace,
  stepRace,
  resetCar,
  TRACK,
  sampleTrack,
  projectOnTrack,
} from "./physics.js";
import { createEffects } from "./effects.js";
import { createAudio } from "./audio.js";
import { loadRecords, saveResult, setSound, clearRecords } from "./storage.js";
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
let records = loadRecords(),
  sound = createAudio(),
  mode = "menu",
  race = createRace(),
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
  ghostPose = null,
  ghostIndex = 0;
const input = { left: false, right: false, brake: false, drift: false },
  pointerOwners = new Map(),
  heldKeys = new Set(),
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = matchMedia("(pointer:coarse)").matches || innerWidth < 700;
document.body.classList.toggle("touch-mode", mobile);
$("track-km").textContent = (TRACK.length / 1000).toFixed(2);
sound.setMuted(!records.sound);
updateSound();
updateMenu();
let renderer, world, player, ghost, effects, camera, composer, carFill;
const camTarget = new THREE.Vector3(),
  lookTarget = new THREE.Vector3(),
  smoothedLook = new THREE.Vector3();
try {
  if (!WebGL.isWebGL2Available()) throw new Error("WebGL 2 is unavailable");
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  $("scene").append(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "Race canvas. Use arrow keys to steer, Space to drift, Down to brake.",
  );
  camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.2, 1900);
  world = createWorld(renderer, { low: mobile });
  player = createCar();
  ghost = createCar({ ghost: true });
  world.scene.add(player.group, ghost.group);
  carFill = new THREE.DirectionalLight("#91bddb", 1.0);
  world.scene.add(carFill, carFill.target);
  for (const side of [-1, 1]) {
    const beam = new THREE.SpotLight("#d6e9ff", 34, 65, 0.32, 0.65, 1.2);
    beam.position.set(side * 0.65, 0.72, 1.95);
    beam.target.position.set(side * 1.8, -0.25, 32);
    player.group.add(beam, beam.target);
  }
  effects = createEffects(world.scene);
  ghost.group.visible = false;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(world.scene, camera));
  composer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.18,
      0.5,
      1.05,
    ),
  );
  composer.addPass(new OutputPass());
  placeCar();
  updateCamera(1, true);
  world.update(0, race.car);
  composer.render();
  $("loading").style.opacity = "0";
  setTimeout(() => ($("loading").hidden = true), 650);
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
}
function syncInput() {
  for (const key in input)
    input[key] =
      [...heldKeys].some((code) => keyMap[code] === key) ||
      [...pointerOwners.values()].includes(key);
  for (const b of document.querySelectorAll("[data-input]"))
    b.classList.toggle("pressed", input[b.dataset.input]);
}
function clearInput() {
  heldKeys.clear();
  for (const key in input) input[key] = false;
  pointerOwners.clear();
  for (const el of document.querySelectorAll("[data-input]"))
    el.classList.remove("pressed");
}
function updateMenu() {
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
  document.querySelector(".topbar").inert = false;
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
}
function dialog({ kind, title, eyebrow, html, actions }) {
  previousFocus = document.activeElement;
  modalKind = kind;
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
  document.querySelector(".topbar").inert = true;
  $("modal-backdrop").hidden = false;
  $("dialog").focus();
}
function start() {
  clearTimeout(countdownTimer);
  closeDialog();
  clearInput();
  renderer.domElement.focus({ preventScroll: true });
  sound.unlock();
  race = createRace();
  frames = [];
  nextFrame = 0;
  ghostIndex = 0;
  effects.clear();
  count = 3;
  countValue = 0;
  mode = "countdown";
  $("menu").hidden = true;
  $("hud").hidden = false;
  $("pause").hidden = false;
  $("touch").hidden = !mobile;
  $("countdown").hidden = false;
  $("ghost-label").textContent = records.ghost.length
    ? "CYAN · YOUR PERSONAL BEST"
    : "CYAN · PACE CAR";
  placeCar();
  updateCamera(1, true);
  updateHud();
}
function menu() {
  clearTimeout(countdownTimer);
  closeDialog();
  clearInput();
  mode = "menu";
  race = createRace();
  ghost.group.visible = false;
  $("menu").hidden = false;
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
  mode = "paused";
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
          closeDialog();
          mode = was;
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
    html: `<p>The car accelerates for you. Steer into each corner, hold drift briefly to loosen the rear, then release it and steer gently back into line.</p><div class="controls-guide"><div><b>Steer</b><span>← / → or A / D</span></div><div><b>Drift / handbrake</b><span>Hold Space</span></div><div><b>Brake</b><span>↓ or S</span></div><div><b>Reset / pause</b><span>R / Esc</span></div></div><p>On a phone, use the large driving pads. Landscape gives you a wider view. Finish three laps to save your time and a personal-best ghost on this device. Keep a drift clean to build your multiplier; hitting a barrier loses unbanked points.</p>`,
    actions: [
      { label: "GOT IT", primary: true, action: closeDialog },
      { label: "LET’S DRIVE", action: start },
    ],
  });
}
function privacy() {
  dialog({
    kind: "privacy",
    eyebrow: "YOUR LAP. YOUR DEVICE.",
    title: "A little less <em>tracking.</em>",
    html: "<p>Your best time, drift score, sound choice and personal-best ghost are stored in this browser. No account, analytics or advertising trackers are used by this game. Hosting may process ordinary request logs to deliver the website.</p><p>Clearing game data removes these records from this device. Your first race uses a practice pace car; after you finish, your own best drive becomes the ghost.</p>",
    actions: [
      { label: "CLOSE", primary: true, action: closeDialog },
      {
        label: "CLEAR GAME DATA",
        action() {
          records = clearRecords();
          sound.setMuted(!records.sound);
          updateSound();
          updateMenu();
          closeDialog();
          toast("Your saved game data has been cleared.");
        },
      },
    ],
  });
}
function finish() {
  clearTimeout(countdownTimer);
  $("countdown").hidden = true;
  mode = "finished";
  clearInput();
  const previous = records.bestTime;
  records = saveResult(race, frames);
  ghostIndex = 0;
  const recorded = records.bestTime === race.elapsed;
  const best = recorded && (previous === null || race.elapsed < previous);
  dialog({
    kind: "result",
    eyebrow: best ? "A NEW PERSONAL BEST" : "THAT’S YOUR THREE",
    title: best ? "You found your <em>flow.</em>" : "One more <em>run?</em>",
    html: `<div class="result-number">${format(race.elapsed)}</div><dl><dt>Drift points</dt><dd>${race.score.toLocaleString()}</dd><dt>Best lap</dt><dd>${format(race.bestLap)}</dd>${race.lapTimes.map((t, i) => `<dt>Lap ${i + 1}</dt><dd>${format(t)}</dd>`).join("")}<dt>Car resets</dt><dd>${race.recoveries}</dd></dl><p>${race.elapsed > 900 ? "This run exceeded the 15-minute record limit. Try a quicker run to save a ghost." : "Chase your fastest run’s cyan ghost next time. Records stay in this browser when local storage is available."}</p>`,
    actions: [
      { label: "RACE AGAIN", primary: true, action: start },
      { label: "BACK TO HOME", action: menu },
    ],
  });
}
$("start").onclick = start;
$("how").onclick = how;
$("privacy-link").onclick = privacy;
$("pause").onclick = pauseGame;
$("recover").onclick = () => {
  if (mode === "racing") {
    resetCar(race);
    effects.clear();
    toast("Back on your line.");
    renderer.domElement.focus({ preventScroll: true });
  }
};
$("sound").onclick = () => {
  records.sound = !records.sound;
  setSound(records.sound);
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
};
const keyMap = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowDown: "brake",
  KeyS: "brake",
  Space: "drift",
};
window.addEventListener("keydown", (e) => {
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
    effects.clear();
    toast("Back on your line.");
  }
});
window.addEventListener("keyup", (e) => {
  if (keyMap[e.code]) {
    heldKeys.delete(e.code);
    syncInput();
    if (mode === "racing") e.preventDefault();
  }
});
for (const b of document.querySelectorAll("[data-input]")) {
  b.addEventListener("pointerdown", (e) => {
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
  composer.setSize(innerWidth, innerHeight);
});
function placeCar() {
  player.group.position.set(race.car.x, 0.055, race.car.z);
  player.group.rotation.y = race.car.yaw;
}

function updateCamera(dt, instant = false) {
  const c = race.car,
    f = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)),
    right = new THREE.Vector3(f.z, 0, -f.x),
    pos = new THREE.Vector3(c.x, 0, c.z);
  if (mode === "menu") {
    const narrow = innerWidth < 600,
      orbit = reduced ? 0 : Math.sin(time * 0.1) * 0.14;
    camTarget
      .copy(pos)
      .addScaledVector(f, -(narrow ? 8.2 : 8))
      .addScaledVector(right, (narrow ? 4.3 : 5.8) + orbit);
    camTarget.y = narrow ? 3.6 : 3.1;
    lookTarget.copy(pos).addScaledVector(right, narrow ? 0 : 3.3);
    lookTarget.y = narrow ? -0.1 : 1.1;
    camera.fov = narrow ? 53 : 49;
  } else {
    camTarget.copy(pos).addScaledVector(f, -8.6 - c.speed * 0.045);
    camTarget.y = 3.8 + c.speed * 0.01;
    lookTarget.copy(pos).addScaledVector(f, 6);
    lookTarget.y = 1;
    camera.fov = 57 + c.speed * 0.2;
  }
  const blend = instant ? 1 : 1 - Math.exp(-dt * (mode === "menu" ? 2 : 5.5));
  camera.position.lerp(camTarget, blend);
  smoothedLook.lerp(lookTarget, instant ? 1 : 1 - Math.exp(-dt * 7));
  camera.lookAt(smoothedLook);
  carFill.position.copy(camera.position).add(new THREE.Vector3(2, 3, 0));
  carFill.target.position.set(c.x, 0.6, c.z);
  camera.updateProjectionMatrix();
}
function updateGhost() {
  if (mode === "menu") {
    ghost.group.visible = false;
    return;
  }
  const stored = records.ghost;
  if (stored.length > 1) {
    const t = race.elapsed;
    while (ghostIndex < stored.length - 2 && stored[ghostIndex + 1].t < t)
      ghostIndex++;
    ghostIndex = Math.min(ghostIndex, stored.length - 2);
    const a = stored[ghostIndex],
      b = stored[ghostIndex + 1],
      p = clamp((t - a.t) / Math.max(0.001, b.t - a.t), 0, 1),
      dy = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    ghostPose = {
      x: THREE.MathUtils.lerp(a.x, b.x, p),
      z: THREE.MathUtils.lerp(a.z, b.z, p),
      yaw: a.yaw + dy * p,
    };
  } else {
    const p = sampleTrack(15 + race.elapsed * 24);
    ghostPose = { x: p.x, z: p.z, yaw: Math.atan2(p.tx, p.tz) };
  }
  ghost.group.position.set(ghostPose.x, 0.07, ghostPose.z);
  ghost.group.rotation.y = ghostPose.yaw;
  ghost.group.visible =
    Math.hypot(ghostPose.x - race.car.x, ghostPose.z - race.car.z) > 3.5;
  ghost.update({ speed: 24, steering: 0, brake: 0, drift: false, time });
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
  if (ghostPose) {
    const [x, y] = to(ghostPose.x, ghostPose.z);
    map.beginPath();
    map.arc(x, y, 4, 0, Math.PI * 2);
    map.fillStyle = "#3ae7f6";
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
  drawMap();
}
function tick(now) {
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
    if (race.completedLaps > lastLap && race.state !== "finished")
      toast(`Lap ${race.completedLaps} · ${format(race.lastLap)}`);
    if (race.state === "finished") finish();
  }
  placeCar();
  player.update({
    speed: mode === "racing" ? race.car.speed : 0,
    steering: race.car.steering,
    brake: input.brake ? 1 : 0,
    drift: race.car.drifting,
    time,
  });
  updateGhost();
  effects.update(race.car, dt, time, mode === "racing");
  world.update(time, race.car);
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
