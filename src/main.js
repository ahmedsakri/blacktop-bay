import { exportSaveBackup, inspectSaveBackup, importSaveBackup, recoverSaveImport, exportRecoveryBackup } from './save-backup.js';
import { normalizePlayerControls, actionForKey, keyLabel, createNitroLatch } from './player-controls.js';
import { mountPlayerTools, makeResultCard } from './player-tools-ui.js';
import { recordScope, interpolateGhost, ghostTimeAtProgress, createGhostTiming, challengeURL, readChallenge } from './personal-ghost.js';
import { LESSONS, createDrivingSchool, schoolSeen, saveSchool } from './driving-school.js';
import { createAdaptiveQuality } from './adaptive-quality.js';
import { waitForPaint } from './paint-readiness.js';
import { PAINT_COLORS, PAINT_FINISHES, loadPaint, savePaint, getPaint, applyPaint } from './paint.js';
import "./style.css";
import "./racing.css";
import "./collection.css";
import "./workshop.css";
import "./mobile-hud.css";
import "./collection-browser.css";
import "./race-dialogs.css";
import "./button-system.css";
import "./brand-theme.css";
import "./steering-controls.css";
import "./race-feedback.css";
import "./race-hq.css";
import "./lobby.css";
import "./garage-screen.css";
import "./nitro-hud.css";
import "./mobile-race-controls.css";
import "./race-upgrade.css";
import "./driver-development.css";
import "./logo-loader.css";
import "./screen-mode.css";
import { screenMode, toggleScreenMode, screenHelpMarkup } from './screen-mode.js';
import { createFrameBudget } from './frame-budget.js';
import { registerPWA, canInstallPWA, requestInstallPWA } from './pwa.js';
import './mobile-viewport.css';
import './player-tools.css';
import { logoLoaderMarkup, bindLogoLoader, mountLogoLoader } from "./logo-loader.js";
import { loadCampaign, persistCampaign, getCampaignEvent, canStartCampaignEvent, recordCampaignResult } from "./driver-campaign.js";
import { loadMastery, persistMastery, recordMasteryResult } from "./car-mastery.js";
import { CAR_SETUPS, loadSetups, persistSetups, getCarSetup, selectCarSetup, clearCircuitSetup } from "./car-setups.js";
import { mountCampaignPanel, mountCarDevelopment, developmentResultMarkup, nextGoalSuggestion } from "./driver-development-ui.js";
import { saveCampaignIntent, consumeCampaignIntent } from "./campaign-intent.js";
import { createPickupView } from "./race-pickup-view.js";
import { readGamepad } from "./gamepad-controls.js";
import { qualitySettings, normalizeQuality } from "./render-quality.js";
import { circuitFromPath, circuitPath } from "./circuit-routes.js";
import { carFromPath, carPath } from "./car-routes.js";
import { drawRaceMap } from "./race-map.js";
import { RACE_MODES, getDifficulty, normalizeRaceOptions, raceFieldSize } from "./race-options.js";
import { CAREER_KEY, normalizeCareer, beginChampionship, nextChampionshipRace, recordCareerResult, bindChampionshipFleet, refreshChampionshipRound, finalizeChampionshipRound, finalizeInterruptedTourRounds } from "./race-career.js";
import { raceSetupMarkup, careerResultMarkup, championshipStandingsMarkup } from "./race-hq.js";
import { NEW_CARS, loadFavorites, saveFavorites, findCars, hasCarFilters, clearCarFilters, carLibraryMarkup, carLibraryCard, circuitLibraryMarkup, circuitLibraryCards, findCircuits } from "./collection-browser.js";
import { pausePanel, howToPlayPanel, finishPanel, finishRowsMarkup, finishStatusText } from "./race-dialogs.js";
import { icon } from './icons.js';
import { garageStatsMarkup, garageBuildMarkup, circuitMapMarkup } from "./collection-ui.js";
import { createDrivingInputs, resolveDriveControls, normalizeSteeringSensitivity, isDrivingShortcut } from "./driving-controls.js";
import { createDragSteering } from "./drag-steering.js";
import { bindSteeringPad } from "./steering-pad.js";
import { createTiltSteering, requestTiltPermission } from "./tilt-steering.js";
import { collisionPose } from "./collision-pose.js";
import { createRaceFeedback, impactCameraOffset } from "./race-feedback.js";
import { getRaceProgress, getDriftDisplay } from "./race-presentation.js";
import * as THREE from "three";
import WebGL from "three/addons/capabilities/WebGL.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { createWorld } from "./world.js";
import { createCar } from "./car.js";
import { prepareManufacturerCar } from "./manufacturer-car.js";
import { MANUFACTURER_RIVAL_VEHICLES, createOpponentFleet } from "./opponent-fleet.js";
import { createGarage } from "./garage.js";
import { DEFAULT_VEHICLE_ID, VEHICLES, getVehicle } from "./vehicles.js";
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
import { normalizeLobbyStyle } from "./lobby-music.js";
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
function localStore(){try{return localStorage;}catch{return null;}}
const saveRecovery=recoverSaveImport({storage:localStore()});
if(saveRecovery.recoveryRequired){showStartupRecovery();throw new Error('Save recovery required before loading game progress.');}
let school=null, pendingStartOptions={}, ghostModel=null, ghostReference=[], ghostTiming=null, lastGhostSector=0;
const nitroLatch=createNitroLatch();
let challenge=null,lastResultDialog=null,pauseResumeMode="racing";
const bootTime=performance.now();
const preferenceKey = "blacktop-bay-choices-v1";
let preferences = { vehicle: DEFAULT_VEHICLE_ID, track: "harbor", mode:"race", difficulty:"street", steeringSensitivity:1,volume:.75,musicVolume:.65,engineVolume:1,sfxVolume:.85,quality:"auto",gamepadSwap:false,controls:normalizePlayerControls(),lobbyStyle:normalizeLobbyStyle() };
try {
  const stored = JSON.parse(localStorage.getItem(preferenceKey));
  if (stored && typeof stored === "object") {
    Object.assign(preferences, normalizeRaceOptions(stored));
    preferences.controls=normalizePlayerControls(stored.controls);
    preferences.steeringSensitivity = normalizeSteeringSensitivity(stored.steeringSensitivity);
    preferences.lobbyStyle = normalizeLobbyStyle(stored.lobbyStyle);
    preferences.quality=normalizeQuality(stored.quality);preferences.gamepadSwap=stored.gamepadSwap===true;
    for(const key of ["volume","musicVolume","engineVolume","sfxVolume"])if(Number.isFinite(stored[key]))preferences[key]=clamp(stored[key],0,1);
    if (typeof stored.sound === "boolean") preferences.sound = stored.sound;
    if (typeof stored.vehicle === "string") {
      preferences.vehicle = getVehicle(stored.vehicle).id;
      if (preferences.vehicle !== stored.vehicle) {
        try { localStorage.setItem(preferenceKey, JSON.stringify({...stored, vehicle: preferences.vehicle})); } catch {}
      }
    }
    if (TRACKS.some((t) => t.id === stored.track))
      preferences.track = stored.track;
  }
} catch {}
let campaign = loadCampaign(), mastery = loadMastery(), carSetups = loadSetups();
let selectedCampaignId = null, developmentView = null;
const requestedTrack = circuitFromPath(location.pathname) || new URLSearchParams(location.search).get("track");
const requestedVehicle = carFromPath(location.pathname);
if (requestedVehicle) preferences.vehicle = requestedVehicle;
if (TRACKS.some((t) => t.id === requestedTrack))
  preferences.track = requestedTrack;
const campaignArrival = consumeCampaignIntent(campaign, circuitFromPath(location.pathname));
if (campaignArrival) {
  selectedCampaignId = campaignArrival.id;
  Object.assign(preferences, {vehicle:campaignArrival.vehicle, track:campaignArrival.track, mode:campaignArrival.mode, difficulty:campaignArrival.difficulty});
}
challenge=readChallenge(location.hash,{cars:VEHICLES.map(v=>v.id),tracks:TRACKS.map(t=>t.id),track:preferences.track});
if(challenge){preferences.vehicle=challenge.vehicle;preferences.mode='time-attack';preferences.controls.stockTrial=true;}
setTrack(preferences.track);
if(circuitFromPath(location.pathname))document.title=`${TRACK.name} — ${BRAND.name}`;
if (requestedTrack || requestedVehicle) {
  saveChoices();
  history.replaceState(null,"",requestedVehicle ? carPath(requestedVehicle) : circuitPath(preferences.track));
}
if (requestedVehicle) document.title = `${getVehicle(requestedVehicle).name} — ${BRAND.name}`;
const recordStore = {
  getItem(key) {
    return localStorage.getItem(
      `${key}-${currentRecordScope()}`,
    );
  },
  setItem(key, value) {
    localStorage.setItem(
      `${key}-${currentRecordScope()}`,
      value,
    );
  },
};
function saveChoices() {
  try {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));return true;
  } catch {return false;}
}
const progression = loadProgression();
let career = normalizeCareer();
try { const raw=localStorage.getItem(CAREER_KEY); if(raw && raw.length<2000000) career=normalizeCareer(JSON.parse(raw)); } catch {}
const interruptedTour=finalizeInterruptedTourRounds(career);career=interruptedTour.state;if(interruptedTour.changed)persistCareer();
function persistCareer(){try{localStorage.setItem(CAREER_KEY,JSON.stringify(career));return true;}catch{return false;}}
const paintChoices = loadPaint();
const favoriteCars = loadFavorites();
const rivalVehicles = [...MANUFACTURER_RIVAL_VEHICLES];
const playerColor = () => getPaint(preferences.vehicle, paintChoices[preferences.vehicle]).color;
function createPlayerCar(){const car=createCar({vehicle:preferences.vehicle,low:mobile});applyPaint(car,preferences.vehicle,paintChoices[preferences.vehicle]);return car;}
function selectedCampaignEvent() {
  const event = getCampaignEvent(selectedCampaignId, preferences.vehicle);
  return event && canStartCampaignEvent(campaign,event.id) && event.track===preferences.track && event.mode===preferences.mode && event.difficulty===preferences.difficulty ? event : null;
}
const stockTrial=()=>preferences.mode==='time-attack'&&preferences.controls.stockTrial;
const fittedStats = (vehicle = preferences.vehicle, upgrades = progression.cars[vehicle]) => getUpgradeStats(vehicle,upgrades,getCarSetup(carSetups,vehicle,preferences.track));
function currentRecordScope(){return recordScope({...preferences,stock:stockTrial(),upgrades:progression.cars[preferences.vehicle],setup:getCarSetup(carSetups,preferences.vehicle,preferences.track)});}
const newRace = () =>
  createRace({ vehicle: preferences.vehicle, track: preferences.track, upgrades:stockTrial()?{}:progression.cars[preferences.vehicle], rivalVehicles:school?[]:rivalVehicles, mode:school?'time-attack':preferences.mode, difficulty:school?'relaxed':preferences.difficulty,
    setup:stockTrial()?'balanced':getCarSetup(carSetups,preferences.vehicle,preferences.track), campaignEventId:school?null:selectedCampaignEvent()?.id || null });
function event(name, extra = {}) {
  trackEvent(name, {
    circuit: preferences.track,
    vehicle: preferences.vehicle,
    race_mode: preferences.mode,
    difficulty: preferences.difficulty,
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
let driftSnapshot = null, driftBankUntil = 0, lastBankedPoints = 0;
const raceFeedback = createRaceFeedback();
const coarsePointer = matchMedia("(any-pointer:coarse)");
const input = {
    left: false,
    right: false,
    brake: false,
    drift: false,
    nitro: false,
  },
  pointerInputs = createDrivingInputs(),
  dragSteering = createDragSteering(),
  tiltSteering = createTiltSteering(),
  heldKeys = new Set(),
  heldPads = new Set();
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=preferences.controls.motion==='reduced'||preferences.controls.motion==='system'&&motionQuery.matches;
function updatePlayerControls(){
 reduced=preferences.controls.motion==='reduced'||preferences.controls.motion==='system'&&motionQuery.matches;
 document.body.classList.toggle('motion-reduced',reduced);
 document.body.classList.toggle('controls-left-handed',preferences.controls.leftHanded);
 const c=preferences.controls;document.body.style.setProperty('--control-scale',c.touchSize);document.body.style.setProperty('--control-inset',c.touchInset+'px');document.body.style.setProperty('--control-lift',c.touchLift+'px');
 const b=c.bindings;const hint=document.querySelector('.drive-hint');if(hint)hint.textContent=`${keyLabel(b.left)} / ${keyLabel(b.right)} STEER · ${keyLabel(b.brake)} BRAKE · ${keyLabel(b.nitro)} NITRO`;
 document.querySelector('.nitro-touch-hint').textContent=c.nitroToggle?'TAP ON / TAP OFF':'HOLD TO BOOST';
 document.querySelector('[data-input="nitro"]').setAttribute('aria-label',c.nitroToggle?'Tap to toggle Nitro boost':'Hold for Nitro boost');
 if(renderer?.domElement)renderer.domElement.setAttribute('aria-label',`Race canvas. Automatic acceleration. ${keyLabel(b.left)} and ${keyLabel(b.right)} steer. ${keyLabel(b.brake)} brakes. ${keyLabel(b.nitro)} boosts. ${keyLabel(b.reset)} resets. ${keyLabel(b.pause)} pauses.`);
}
motionQuery.addEventListener('change',()=>updatePlayerControls());
const mobile = usesTouchControls();
let steeringMode = 'touch', tiltPending = false, tiltRequest = 0, tiltTimer = null;
let tiltGraceUntil = 0, analogSteering = 0;
let tiltStatus = 'Hold either side of the thumbpad, or drag. Tilt is optional and uses motion sensors only after you enable it.';
document.body.classList.toggle("touch-mode", mobile);
$("track-km").textContent = (TRACK.length / 1000).toFixed(2);
if (typeof preferences.sound === "boolean") records.sound = preferences.sound;
preferences.sound = records.sound;
sound.setMuted(!records.sound);
sound.setVolume(preferences.volume);sound.setMusicVolume(preferences.musicVolume);sound.setEngineVolume(preferences.engineVolume);sound.setSfxVolume(preferences.sfxVolume);sound.setLobbyStyle(preferences.lobbyStyle);
updateSound();
let renderer, world, player, effects, camera, composer, carFill, garageStudio, renderPass, bloomPass;
let garageFrame = null, lobbyFrame = null, pickupView=null, gamepadPauseHeld=false;
const frameBudget = createFrameBudget();
const adaptiveQuality=createAdaptiveQuality({mobile,dpr:devicePixelRatio,choice:preferences.quality});
let lastRendered=0, performanceSamples=[], lastPerformanceReport=0;
let directRender = false;
function applyQuality(){if(!renderer)return;const q=adaptiveQuality.settings;world?.setQuality?.(q);directRender=!q.bloom;renderer.setPixelRatio(q.pixelRatio);renderer.shadowMap.enabled=q.shadows;if(composer){composer.setPixelRatio(q.pixelRatio);composer.setSize(innerWidth,innerHeight);}if(bloomPass)bloomPass.enabled=q.bloom;if(world?.reflection)world.reflection.visible=q.reflection&&!TRACK.elevationProfile&&!["desert","parkland"].includes(world.scene.userData.venueEnvironment?.type);}
function renderScene(){renderer.info.reset();if(directRender)renderer.render(renderPass.scene,camera);else composer.render();}
let carSelectionPending = false, racePreparing = false, fleetGeneration = 0;
updateMenu();
let garageYaw = -.75,
  garageDrag = null;
let rivalModels = [],
  nitroWasActive = false;
let cameraHeading = TRACK.spawn.yaw,
  cameraSpeed = 0,
  cameraBank = 0,
  cameraKick = 0, cameraKickAge = Infinity, cameraKickX = 0, cameraKickZ = 0;
const cameraImpactOffset = new THREE.Vector3();
const startupLoader = bindLogoLoader(document.querySelector('#loading [data-logo-loader]'));
const nextPaint = () => waitForPaint();
function loadProgress(label, detail = 'Preparing your car and circuit. You will be driving as soon as they are ready.') {
  startupLoader.update({label, detail, progress:null});
}
$("start").disabled = true;
$("menu").inert = true;
const camTarget = new THREE.Vector3(),
  lookTarget = new THREE.Vector3(),
  smoothedLook = new THREE.Vector3();
async function prepareOpponents(seed, onProgress = () => {}) {
  const generation=++fleetGeneration;
  const fixedField=preferences.mode==='championship'?nextChampionshipRace(career)?.rivalVehicles:null;
  const ids=school||preferences.mode==='time-attack'?[]:fixedField||createOpponentFleet({playerVehicle:preferences.vehicle,playerStats:fittedStats(),seed,mobile});
  const prepared=[],loadedIds=[];
  try {
    let completed=0;
    for(let offset=0;offset<ids.length;offset+=2){
      const outcomes=await Promise.allSettled(ids.slice(offset,offset+2).map(async(id,localIndex)=>{
        if(generation!==fleetGeneration)return;
        onProgress({label:`Preparing the grid · ${completed} of ${ids.length}`,detail:getVehicle(id).name,progress:{completed,total:ids.length}});
        let model,loaded=id;
        try{await prepareManufacturerCar(id,{low:true});if(generation!==fleetGeneration)return;model=createCar({vehicle:id,low:true});}
        catch{if(generation!==fleetGeneration)return;await prepareManufacturerCar(preferences.vehicle,{low:mobile});if(generation!==fleetGeneration)return;model=createCar({vehicle:preferences.vehicle,low:mobile});loaded=preferences.vehicle;}
        if(generation!==fleetGeneration){model.dispose();return;}
        model.group.visible=false;prepared[offset+localIndex]=model;loadedIds[offset+localIndex]=loaded;completed++;
        onProgress({label:`${completed} of ${ids.length} opponents ready`,detail:'Building the starting grid.',progress:{completed,total:ids.length}});
      }));
      const failed=outcomes.find(result=>result.status==='rejected');if(failed)throw failed.reason;
      if(generation!==fleetGeneration){prepared.forEach(m=>m?.dispose());return false;}
    }
    if(generation!==fleetGeneration){prepared.forEach(m=>m?.dispose());return false;}
    rivalModels.forEach(m=>m.dispose());rivalModels=prepared;
    rivalVehicles.splice(0,rivalVehicles.length,...loadedIds);
    if(preferences.mode==='championship'&&!school){const bound=bindChampionshipFleet(career,loadedIds);career=bound.state;if(bound.changed&&!persistCareer())toast('Tour grid saved for this session only.');}
    for(const model of rivalModels)world.scene.add(model.group);
    return true;
  } catch(error){prepared.forEach(m=>m?.dispose());if(generation!==fleetGeneration)return false;throw error;}
}
function updateWallet(){
  $('hq-credit-value').textContent=progression.credits.toLocaleString();
  $('hq-wallet').setAttribute('aria-label',`${progression.credits.toLocaleString()} race credits. Open upgrades`);
}
function updateRaceOptions(){
  const option=normalizeRaceOptions(preferences), campaignEvent=selectedCampaignEvent();
  $('race-setup-label').textContent=campaignEvent ? `Campaign · ${campaignEvent.name}` : `${RACE_MODES.find(m=>m.id===option.mode).label} · ${option.mode==='time-attack'?'Solo':getDifficulty(option.difficulty).label}`;
  $('hq-field-size').textContent=String(raceFieldSize(option.mode)).padStart(2,'0');
  const selectedMode=RACE_MODES.find(item=>item.id===option.mode);
  $('lobby-mode-title').textContent=campaignEvent ? campaignEvent.name.toUpperCase() : selectedMode.label.toUpperCase();
  $('lobby-mode-description').textContent=campaignEvent ? campaignEvent.objectives[0].label : selectedMode.description;
  for(const button of document.querySelectorAll('[data-lobby-mode]'))button.setAttribute('aria-pressed',String(!campaignEvent && button.dataset.lobbyMode===option.mode));
  $('open-campaign').setAttribute('aria-pressed',String(Boolean(campaignEvent)));
  records=loadRecords(recordStore);if(typeof preferences.sound==='boolean')records.sound=preferences.sound;
  updateWallet();
  const goalButton=$("next-driver-goal");if(goalButton){const goal=nextGoalSuggestion({campaign,mastery,vehicle:preferences.vehicle});goalButton.textContent="NEXT GOAL · "+goal.label;goalButton.title=goal.description;goalButton.onclick=showCampaign;}
}
function finalizeTour(){if(mode!=="finished")return;const result=finalizeChampionshipRound(career,race);career=result.state;if(result.changed&&!persistCareer())toast("Tour standings saved for this session only.");}
async function continueTour(){finalizeTour();const next=nextChampionshipRace(career);if(!next)return;
  const nextPreferences={...preferences,vehicle:next.vehicle,track:next.track,mode:next.mode,difficulty:next.difficulty};
  // Commit the reload's inputs before changing the visible selection. A failed
  // write leaves the current car, world and pending tour intact.
  try {
    localStorage.setItem(CAREER_KEY,JSON.stringify(career));
    localStorage.setItem(preferenceKey,JSON.stringify(nextPreferences));
  } catch {toast('Your browser could not save the next tour round. Your current selection and tour are unchanged.');return;}
  selectedCampaignId=null;
  Object.assign(preferences,nextPreferences);
  if(TRACK.id!==next.track||race.vehicle!==next.vehicle){location.assign(circuitPath(next.track));return;}
  updateRaceOptions();closeDialog();await start();
}
function showRaceSetup(){
  dialog({kind:'race-setup',eyebrow:'YOUR RACE. YOUR RULES.',title:'Find your <em>challenge.</em>',html:raceSetupMarkup(preferences,career),actions:[{label:'READY TO RACE',primary:true,action:()=>{closeDialog();updateMenu();}}]});
  for(const b of document.querySelectorAll('[data-race-mode]'))b.onclick=()=>{selectedCampaignId=null;preferences.mode=b.dataset.raceMode;saveChoices();updateRaceOptions();showRaceSetup();document.querySelector(`[data-race-mode="${preferences.mode}"]`)?.focus();};
  $('race-difficulty').onchange=e=>{selectedCampaignId=null;preferences.difficulty=e.target.value;saveChoices();updateRaceOptions();};
  if($('resume-tour'))$('resume-tour').onclick=continueTour;
  mountTrialSettings();
}
async function initGame() {
  try {
    loadProgress("Checking the grid…", "Checking graphics support and preparing the renderer.");
    await nextPaint();
    if (!WebGL.isWebGL2Available()) throw new Error("WebGL 2 is unavailable");
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(qualitySettings(preferences.quality,{mobile,dpr:devicePixelRatio}).pixelRatio);
    renderer.info.autoReset=false;
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
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
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
    renderer.domElement.addEventListener("pointerdown", (e) => {
      if (!["racing", "countdown"].includes(mode) || e.button !== 0) return;
      if (!dragSteering.start(e.pointerId, e.clientX, innerWidth)) return;
      e.preventDefault();
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
    });
    renderer.domElement.addEventListener("pointermove", (e) => {
      if (["racing", "countdown"].includes(mode)) dragSteering.move(e.pointerId, e.clientX);
    });
    const stopSteering = (e) => dragSteering.release(e.pointerId);
    renderer.domElement.addEventListener("pointerup", stopSteering);
    renderer.domElement.addEventListener("pointercancel", stopSteering);
    renderer.domElement.addEventListener("lostpointercapture", stopSteering);

    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "Race canvas. Acceleration is automatic. Drag left or right to steer; lift to center. Turn sharply at high speed to drift. Hold Nitro to boost. Keyboard: Arrow keys or A and D steer, Down or S brakes, Space is an optional handbrake, Shift boosts, R resets, and Escape pauses.",
    );
    camera = new THREE.PerspectiveCamera(
      55,
      innerWidth / innerHeight,
      0.2,
      2600,
    );
    loadProgress("Building your circuit…", "Preparing the track, scenery and race lighting.");
    await nextPaint();
    // Track signage is rasterized once; load its typeface before painting it.
    if(document.fonts) await Promise.all(['32px "Racing Sans One"','800 32px "Barlow Condensed"'].map(font=>document.fonts.load(font))).catch(()=>{});
    world = createWorld(renderer, { low: mobile, reducedMotion: reduced });
    loadProgress("Preparing your car…", getVehicle(preferences.vehicle).name);
    await nextPaint();
    const selectedAsset = getVehicle(preferences.vehicle).assetId;
    await prepareManufacturerCar(selectedAsset, {low: mobile});
    player = createPlayerCar();
    world.scene.add(player.group);
    // Rival models are only needed when the player starts a race. Loading a
    // second fleet here doubles startup work and retains unused mobile textures.
    race = newRace();
    carFill = new THREE.DirectionalLight("#c1d5e2", .55);
    world.scene.add(carFill, carFill.target);
    garageStudio = createGarage(renderer, { low: mobile });
    addHeadlights(player);
    loadProgress("Warming up the tyres…", "Preparing the garage and race effects.");
    effects = createEffects(world.scene, { low: mobile });
    pickupView=createPickupView(world.scene,race.pickups);

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
    applyQuality();
    placeCar();
    updateCamera(1, true);
    world.update(0, race.car);
    loadProgress("Lights. Reflections. Action.", "Finishing the graphics and rendering your first view.");
    await nextPaint();
    await Promise.all([
      renderer.compileAsync(world.scene, camera),
      document.fonts.ready,
    ]);
    garageFrame = null; lobbyFrame = null;
    updateCamera(1, true);
    garageStudio.position(race.car);
    garageStudio.scene.add(player.group);
    await renderer.compileAsync(garageStudio.scene, camera);
    renderPass.scene = garageStudio.scene;
    bloomPass.strength = .04;
    renderer.toneMappingExposure = .95;
    renderScene();
    loadProgress("Ready to drive.", "Your car and circuit are ready.");
    $("loading").classList.add("loaded");
    document.body.classList.add("is-ready");
    $("start").disabled = false;
    $("menu").inert = false;
    updatePlayerControls();
    updateMenu();
    event("load_ready",{stage:"lobby",duration_seconds:(performance.now()-bootTime)/1000});
    if (requestedVehicle) openGarage();
    initializePrivacyChoice();
    if (campaignArrival) showCampaign();
    if(saveRecovery.recovered)toast("Interrupted import recovered. Your previous progress is safe.");
    setTimeout(() => {$("loading").hidden = true;startupLoader.destroy();}, reduced ? 0 : 250);
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
    startupLoader.destroy();
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
  const mobileViewport = coarsePointer.matches || navigator.maxTouchPoints > 0 || innerWidth < 700;
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
    $("orientation-fullscreen").hidden = false;
    $("orientation-fullscreen").querySelector('span').textContent = screenMode().supported ? 'Fullscreen & rotate' : screenMode().label;
    if (wasHidden) { orientationFocus = document.activeElement; $("orientation-dialog").focus({preventScroll:true}); }
  } else if (!wasHidden) {
    $("orientation-status").textContent = "";
    if (mode === "paused") $("dialog").focus({preventScroll:true});
    else orientationFocus?.focus?.({preventScroll:true});
  }
}
async function requestLandscape() {
  if (!screenMode().active) {
    const result = await toggleScreenMode();
    if (result.help) {
      let help = $('orientation-screen-help');
      if (!help) { help = document.createElement('div'); help.id = 'orientation-screen-help'; $('orientation-status').after(help); }
      help.innerHTML = screenHelpMarkup(result);
    }
  }
  try { if (screen.orientation?.lock && screenMode().active) await screen.orientation.lock("landscape"); }
  catch { /* Orientation lock is independent of successful fullscreen. */ }
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
    if (pendingLandscapeStart) { pendingLandscapeStart = false; start(pendingStartOptions); }
  }
}
$("orientation-fullscreen").onclick = requestLandscape;
$("orientation-home").onclick = () => {
  pendingLandscapeStart = false;
  orientationGate(false);
  menu();
};
function usesTouchControls() {
  return coarsePointer.matches || navigator.maxTouchPoints > 0 || innerWidth < 700 || (innerWidth < 1000 && innerHeight < 540);
}
function updateTouchControls() {
  const touch = usesTouchControls();
  document.body.classList.toggle("touch-mode", touch);
  $("touch").hidden = !touch || !["racing", "countdown"].includes(mode);
}
function screenAngle() {
  return Number.isFinite(screen.orientation?.angle) ? screen.orientation.angle
    : Number.isFinite(window.orientation) ? window.orientation : 0;
}
function updateSteeringSettings() {
  const touch = $('steering-touch'), tilt = $('steering-tilt'), recenter = $('steering-recenter');
  if (!touch || !tilt || !recenter) return;
  touch.setAttribute('aria-pressed', String(steeringMode === 'touch'));
  tilt.setAttribute('aria-pressed', String(steeringMode === 'tilt'));
  tilt.disabled = tiltPending;
  tilt.querySelector('span').textContent = tiltPending ? 'Checking sensor…' : steeringMode === 'tilt' ? 'Tilt enabled' : 'Enable tilt';
  recenter.disabled = steeringMode !== 'tilt';
  $('steering-status').textContent = tiltStatus;
}
function useTouchSteering(message = 'Touch steering ready. Hold either side of the thumbpad or drag on the road.') {
  tiltRequest++; tiltPending = false; steeringMode = 'touch';
  clearTimeout(tiltTimer);
  window.removeEventListener('deviceorientation', receiveOrientation);
  tiltSteering.clear(); analogSteering = 0; tiltStatus = message;
  updateSteeringSettings();
}
function receiveOrientation(event) {
  if (document.hidden || !tiltSteering.sample(event, screenAngle())) return;
  tiltGraceUntil = performance.now() + 5000;
  if (tiltPending) {
    clearTimeout(tiltTimer); tiltPending = false; steeringMode = 'tilt';
    tiltSteering.calibrate();
    tiltStatus = 'Tilt ready. Hold your phone comfortably, then tilt left or right. The thumbpad always works as an override.';
    updateSteeringSettings();
  }
}
async function enableTiltSteering() {
  if (tiltPending) return;
  const attempt = ++tiltRequest;
  tiltPending = true;
  tiltStatus = 'Allow motion access if asked, then hold your phone comfortably.';
  updateSteeringSettings();
  // Keep this permission call in the click's user-activation task for iOS.
  const permission = await requestTiltPermission(window);
  if (attempt !== tiltRequest) return;
  if (!permission.ok) {
    const message = permission.reason === 'secure' ? 'Tilt needs the secure HTTPS website. Touch steering is ready.'
      : permission.reason === 'unsupported' ? 'This browser has no motion sensor support. Touch steering is ready.'
        : 'Motion access was not allowed. Touch steering is ready; you can try again from these settings.';
    useTouchSteering(message); return;
  }
  tiltSteering.clear();
  window.addEventListener('deviceorientation', receiveOrientation);
  tiltStatus = 'Checking for motion data. Hold the phone in your driving position.';
  updateSteeringSettings();
  tiltTimer = setTimeout(() => {
    if (attempt === tiltRequest && tiltPending) useTouchSteering('No motion data arrived. Use touch steering, or check motion access in your browser settings.');
  }, 4000);
}
function mountSteeringSettings() {
  const mixer = document.createElement('details'); mixer.className = 'steering-settings';
  mixer.innerHTML = `<h3>Sound mix</h3><label class="steering-sensitivity" for="master-volume"><span>Game volume <output id="master-volume-value">${Math.round(preferences.volume*100)}%</output></span><input id="master-volume" aria-label="Game volume" type="range" min="0" max="100" step="5" value="${Math.round(preferences.volume*100)}"></label><label class="steering-sensitivity" for="music-volume"><span>Lobby music <output id="music-volume-value">${Math.round(preferences.musicVolume*100)}%</output></span><input id="music-volume" aria-label="Lobby music volume" type="range" min="0" max="100" step="5" value="${Math.round(preferences.musicVolume*100)}"></label><p><strong>Liquid Lines</strong> · 168 BPM liquid drum &amp; bass. Adjust Lobby music to set the soundtrack level.</p><p>Original game audio, with a distinct engine or electric voice for every car. Music fades out when the race begins.</p>`;
  $('dialog-content').append(mixer);
  mixer.innerHTML = mixer.innerHTML.replace('<h3>Sound mix</h3>','<summary><h3>Sound mix</h3></summary>');
  $('master-volume').oninput=e=>{preferences.volume=Number(e.target.value)/100;sound.setVolume(preferences.volume);$('master-volume-value').value=e.target.value+'%';saveChoices();};
  $('music-volume').oninput=e=>{preferences.musicVolume=Number(e.target.value)/100;sound.setMusicVolume(preferences.musicVolume);$('music-volume-value').value=e.target.value+'%';saveChoices();};
  for(const [key,label,method] of [['engineVolume','Engines','setEngineVolume'],['sfxVolume','Effects & ambience','setSfxVolume']]) {
    const field=document.createElement('label');field.className='steering-sensitivity';
    field.innerHTML=`<span>${label}<output id="${key}-value">${Math.round(preferences[key]*100)}%</output></span><input id="${key}" aria-label="${label} volume" type="range" min="0" max="100" step="5" value="${Math.round(preferences[key]*100)}">`;
    mixer.append(field);$(key).oninput=e=>{preferences[key]=Number(e.target.value)/100;sound[method](preferences[key]);$(key+'-value').value=e.target.value+'%';saveChoices();};
  }
  const display=document.createElement('details');display.className='steering-settings';
  display.innerHTML=`<summary><h3>Display &amp; controller</h3></summary><div class="race-settings-grid"><label>Graphics<select id="graphics-quality"><option value="auto">Automatic</option><option value="performance">Performance</option><option value="balanced">Balanced</option><option value="ultra">High detail</option></select></label><label>Controller buttons<select id="controller-layout"><option value="standard">A / right trigger: Nitro</option><option value="swap">B / right trigger: Nitro</option></select></label></div><p>Standard gamepads: left stick or D-pad steers. Left trigger brakes. Menu pauses. Touch and keyboard remain available.</p>`;
  $('dialog-content').append(display);$('graphics-quality').value=preferences.quality;
  $('graphics-quality').onchange=e=>{preferences.quality=normalizeQuality(e.target.value);adaptiveQuality.configure({choice:preferences.quality,mobile,dpr:devicePixelRatio});saveChoices();applyQuality();};
  $('controller-layout').value=preferences.gamepadSwap?'swap':'standard';
  $('controller-layout').onchange=e=>{preferences.gamepadSwap=e.target.value==='swap';saveChoices();};
  const install = document.createElement('section'); install.className = 'app-install-card';
  install.innerHTML = `<button id="install-app" class="button secondary" type="button">${icon('phone')}<span>${screenMode().standalone ? 'APP INSTALLED' : 'INSTALL CAMBER REIGN'}</span></button><p>Launch from your Home Screen or desktop. Racing needs an internet connection.</p><div id="app-install-help" hidden></div>`;
  $('dialog-content').append(install);
  $('install-app').disabled = screenMode().standalone;
  $('install-app').onclick = async () => {
    const result = canInstallPWA() ? await requestInstallPWA() : {outcome:'unavailable'};
    const help = $('app-install-help');
    if (!help) return;
    help.hidden = false;
    help.innerHTML = result.outcome === 'accepted' ? '<p>Installation accepted. Look for Camber Reign in your apps.</p>'
      : result.outcome === 'dismissed' ? '<p>Installation cancelled. You can keep racing in your browser.</p>'
      : screenMode().ios ? screenHelpMarkup(screenMode())
      : '<p>Open your browser’s menu and choose <strong>Install Camber Reign</strong>, <strong>Install this page as an app</strong>, or <strong>Add to Home Screen</strong>. On a Mac in Safari, choose <strong>File → Add to Dock</strong>.</p><p>If installation is unavailable, you can keep playing in this browser.</p>';
  };
  mountPlayerTools($('dialog-content'),{getControls:()=>preferences.controls,onChange(next){const before=preferences.controls.showGhost;preferences.controls=normalizePlayerControls(next);clearInput();updatePlayerControls();if(!before&&preferences.controls.showGhost&&race.mode==="time-attack"&&["paused","racing"].includes(mode))startPersonalGhost();return saveChoices();},onBackup:showSaveBackup});
  if (!usesTouchControls()) return;
  const section = document.createElement('section'); section.className = 'steering-settings';
  section.setAttribute('aria-labelledby', 'steering-settings-heading');
  section.innerHTML = `<h3 id="steering-settings-heading">Steering</h3><div class="steering-options" role="group" aria-label="Steering mode"><button id="steering-touch" type="button">${icon('steering')}<span>Touch</span></button><button id="steering-tilt" type="button">${icon('phone')}<span>Enable tilt</span></button><button id="steering-recenter" type="button">${icon('restart')}<span>Recenter tilt</span></button></div><p id="steering-status" role="status" aria-live="polite"></p>`;
  $('dialog-content').prepend(section);
  const sensitivity=document.createElement('label');sensitivity.className='steering-sensitivity';sensitivity.innerHTML=`<span>Steering sensitivity <output id="steering-sensitivity-value">${Math.round(preferences.steeringSensitivity*100)}%</output></span><input id="steering-sensitivity" aria-label="Steering sensitivity" type="range" min="65" max="150" step="5" value="${Math.round(preferences.steeringSensitivity*100)}"><small>Lower for precision. Higher for quicker response. Full steering remains available.</small>`;section.append(sensitivity);
  $('steering-sensitivity').oninput=e=>{preferences.steeringSensitivity=normalizeSteeringSensitivity(Number(e.target.value)/100);$('steering-sensitivity-value').value=Math.round(preferences.steeringSensitivity*100)+'%';saveChoices();};
  $('steering-touch').onclick = () => useTouchSteering();
  $('steering-tilt').onclick = enableTiltSteering;
  $('steering-recenter').onclick = () => {
    tiltStatus = tiltSteering.calibrate() ? 'Centered. This comfortable position is now straight ahead.' : 'Waiting for fresh motion data. Keep your phone in its driving position.';
    updateSteeringSettings();
  };
  updateSteeringSettings();
}
bindSteeringPad($('touch-steer-cue'), dragSteering, {enabled: () => ['racing', 'countdown'].includes(mode)});
function syncInput() {
  const pressedPointers = pointerInputs.read();
  for (const key in input)
    input[key] =
      [...heldKeys].some((code) => actionForKey(code,preferences.controls) === key) ||
      pressedPointers[key] || heldPads.has(key);
  for (const b of document.querySelectorAll("[data-input]")) {
    b.classList.toggle("pressed", input[b.dataset.input]);
    b.setAttribute("aria-pressed", String(input[b.dataset.input]));
  }
}
function clearInput() {
  nitroLatch.clear();
  heldKeys.clear();
  heldPads.clear();
  dragSteering.clear();
  tiltSteering.clear(); analogSteering = 0; tiltGraceUntil = performance.now() + 5000;
  for (const key in input) input[key] = false;
  pointerInputs.clear();
  for (const el of document.querySelectorAll("[data-input]")) {
    el.classList.remove("pressed");
    el.setAttribute("aria-pressed", "false");
  }
}
function updateMenu() {
  updateGarageCopy();
  updateRaceOptions();
  $("menu-best").textContent = records.bestTime
    ? `YOUR BEST  ${format(records.bestTime)}  ·  ${records.bestScore.toLocaleString()} DRIFT POINTS`
    : "YOUR FIRST NIGHT STARTS HERE.";
}
function updateSound() {
  $("sound").innerHTML = icon(records.sound ? 'volume' : 'volume-off');
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
  developmentView?.destroy(); developmentView=null;
  document.body.classList.remove("paint-preview");
  modalKind = "";
  $("modal-backdrop").hidden = true;
  $("menu").inert = false;
  $("garage").inert = false;
  document.querySelector(".topbar").inert = false;
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
}
function dialog({ kind, title, eyebrow, html, actions }) {
  developmentView?.destroy(); developmentView=null;
  previousFocus = document.activeElement;
  modalKind = kind;
  $("dialog").dataset.kind = kind;
  $("dialog-eyebrow").textContent = eyebrow;
  $("dialog-title").innerHTML = title;
  $("dialog-content").innerHTML = html;
  $("dialog-actions").replaceChildren();
  for (const a of actions) {
    const b = document.createElement("button");
    b.className = `button ${a.primary ? "primary" : "secondary"}${a.danger ? " danger" : ""}`;
    const actionIcon = /BACK|HOME|GOT IT/.test(a.label) ? 'arrow-left' : /GARAGE/.test(a.label) ? 'garage' : /RESTART|RESET|CLEAR/.test(a.label) ? 'restart' : /RACE|DRIV/.test(a.label) ? 'play' : 'check';
    b.innerHTML = icon(actionIcon);
    const label = document.createElement('span'); label.textContent = a.label; b.append(label);
    b.onclick = () => {if(kind==="result")event("result_action",{action:/TOUR/.test(a.label)?"next_round":/CAMPAIGN/.test(a.label)?"next_event":/AGAIN/.test(a.label)?"replay":/GARAGE/.test(a.label)?"garage":/SHARE/.test(a.label)?"share":"home"});a.action();};
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
  garageFrame = null; lobbyFrame = null;
  const v = getVehicle(preferences.vehicle);
  const stats = fittedStats(v.id);
  $("selected-car-type").textContent =
    `YOUR CAR · ${v.specs.body.toUpperCase()}`;
  $("selected-car-name").textContent = v.name;
  $("lobby-speed").textContent = speedLabel(stats);
  $("lobby-boost").textContent = `${stats.nitroCapacity.toFixed(1)} SEC`;
  $("lobby-upgrades").textContent = `${Object.values(progression.cars[v.id] || {}).reduce((sum,n)=>sum+(Number.isFinite(n)?n:0),0)} / 20`;
  $("selected-car-tagline").textContent = v.tagline.toUpperCase();
  $("garage-class").textContent = v.specs.body.toUpperCase();
  $("garage-brand").textContent = v.brand;
  $("garage-name").textContent = v.brand && v.name.startsWith(`${v.brand} `) ? v.name.slice(v.brand.length + 1) : v.name;
  $("garage-build").innerHTML = garageBuildMarkup(progression.cars[v.id]);
  for (const id of ["selected-car-name", "garage-name"]) $(id).dataset.longName = String(v.name.length > 24);
  $("garage-tagline").textContent = v.tagline;
  $("garage-specs").innerHTML = garageStatsMarkup(stats);
  const paintable = player?.group.userData.paintable !== false;
  $("open-paint").disabled = carSelectionPending || !paintable;
  $("paint-label").textContent = paintable ? getPaint(v.id, paintChoices[v.id]).name : 'Factory finish';
  $("open-paint").title = paintable ? '' : 'This model keeps its original textured finish.';
  $("garage-wallet").textContent = `${progression.credits.toLocaleString()} CR`;
  updateWallet();
  for (const b of document.querySelectorAll("[data-vehicle]")) {
    b.setAttribute("aria-pressed", String(b.dataset.vehicle === v.id));
    const spec = fittedStats(b.dataset.vehicle);
    b.querySelector(".car-choice-stats").textContent = `${speedLabel(spec)} · ${spec.nitroCapacity.toFixed(1)}s NITRO`;
  }
}
function showUpgrades(focusComponent) {
  dialog({kind: "upgrades", eyebrow: "THE WORKSHOP · BUILT FOR YOUR NEXT RACE", title: `Make it <em>yours.</em>`, html: `<div class="driver-development workshop-development-link"><button class="button secondary" type="button" id="open-car-development">${icon('steering')} SETUP & MASTERY</button><p>${CAR_SETUPS.find(setup=>setup.id===getCarSetup(carSetups,preferences.vehicle,preferences.track)).name} fitted · free setup changes</p></div>` + upgradePanel(progression, preferences.vehicle,getCarSetup(carSetups,preferences.vehicle,preferences.track)), actions: [{label:"BACK TO GARAGE",primary:true,action:()=>{closeDialog();$("open-upgrades").focus();}}]});
  previousFocus = $("open-upgrades");
  $("open-car-development").onclick=showCarDevelopment;
  for (const button of document.querySelectorAll("[data-upgrade]")) {
    button.onclick = () => {
      const component = button.dataset.upgrade;
      const result = buyUpgrade(progression, preferences.vehicle, component);
      if (!result.ok) return;
      event("upgrade_purchase",{component,level:result.level});
      race = newRace();
      updateGarageCopy();
      showUpgrades(component);
      $("upgrade-status").textContent = result.persisted ? `Level ${result.level} installed. Ready for the road.` : "Upgrade active for this session. Browser storage is unavailable.";
    };
  }
  if (focusComponent) document.querySelector(`[data-upgrade="${focusComponent}"]:not(:disabled)`)?.focus();
}
function showCampaign() {
  if (!["menu","garage","finished"].includes(mode)) return;
  dialog({kind:"campaign",eyebrow:"SIX CHAPTERS · EIGHTEEN EVENTS",title:"Driver <em>career.</em>",html:'<div id="campaign-view"></div>',actions:[{label:"BACK",primary:true,action:closeDialog}]});
  previousFocus=$("open-campaign");
  developmentView=mountCampaignPanel($("campaign-view"),{state:campaign,vehicle:preferences.vehicle,selectedEventId:selectedCampaignId,onStart:selectCampaignEvent});
}
async function selectCampaignEvent(selected) {
  if (carSelectionPending || racePreparing) return;
  const event=getCampaignEvent(selected?.id,preferences.vehicle);
  if (!event || !canStartCampaignEvent(campaign,event.id)) {toast("Complete the earlier campaign event first.");return;}
  if (event.track!==TRACK.id) {
    // Persist the latest earned chapter state before navigating. Losing an
    // unsaved prerequisite must never produce a locked event on the new page.
    if (!persistCampaign(campaign) || !saveCampaignIntent(campaign,event.id,event.vehicle)) {
      toast("Your browser could not prepare the next circuit. Your current selection is unchanged.");return;
    }
    location.assign(circuitPath(event.track));return;
  }
  selectedCampaignId=event.id;
  Object.assign(preferences,{mode:event.mode,difficulty:event.difficulty});saveChoices();updateMenu();closeDialog();
  await start();
}
function showCarDevelopment() {
  dialog({kind:"car-development",eyebrow:"THE WORKSHOP · YOUR DRIVING STYLE",title:"Setup & <em>mastery.</em>",html:'<div id="car-development-view"></div>',actions:[{label:"BACK TO UPGRADES",primary:true,action:()=>showUpgrades()}]});
  previousFocus=$("open-upgrades");
  developmentView=mountCarDevelopment($("car-development-view"),{vehicle:preferences.vehicle,baseSpecs:getUpgradeStats(preferences.vehicle,progression.cars[preferences.vehicle],"balanced"),setupState:carSetups,masteryState:mastery,track:preferences.track,onClearCircuit(track){const result=clearCircuitSetup(carSetups,preferences.vehicle,track);carSetups=result.state;const saved=persistSetups(carSetups);race=newRace();updateGarageCopy();developmentView.update({setupState:carSetups});document.querySelector("[data-development-save-status]").textContent=saved?"Circuit override removed. Car default restored.":"Circuit override removed for this session.";},onSelect(id,{track}={}){
    const result=selectCarSetup(carSetups,preferences.vehicle,id,track);if(!result.selected)return;
    carSetups=result.state;const saved=persistSetups(carSetups);race=newRace();updateGarageCopy();
    developmentView.update({setupState:carSetups});
    document.querySelector('[data-development-save-status]').textContent=saved ? (track?"Setup saved for this car on this circuit.":"Default setup saved for this car.") : "Setup is active for this session. Browser storage is unavailable.";
  }});
}
function showPaint() {
  const vehicle = getVehicle(preferences.vehicle), current = paintChoices[vehicle.id];
  dialog({kind:"paint",eyebrow:`THE PAINT STUDIO · ${vehicle.name.toUpperCase()}`,title:"Your colour.<br><em>Your signature.</em>",html:`<p>Preview a finish on your car. Paint is free and saved separately for each build.</p><div class="paint-colors" role="group" aria-label="Body colour">${PAINT_COLORS.map(p=>`<button type="button" class="paint-swatch" data-paint-color="${p.id}" aria-pressed="${current.color===p.id}" aria-label="${p.name}" style="--paint-color:${p.color??vehicle.color}"><i aria-hidden="true"></i><span>${p.name}</span></button>`).join("")}</div><h3 class="finish-label">SURFACE FINISH</h3><div class="paint-finishes" role="group" aria-label="Paint finish">${PAINT_FINISHES.map(f=>`<button type="button" data-paint-finish="${f.id}" aria-pressed="${current.finish===f.id}">${f.name}</button>`).join("")}</div><p id="paint-status" role="status" class="paint-status">${getPaint(vehicle.id,current).name} · ${getPaint(vehicle.id,current).finish.name}</p>`,actions:[{label:"BACK TO GARAGE",primary:true,action:()=>{closeDialog();$("open-paint").focus();}}]});
  document.body.classList.add("paint-preview"); previousFocus=$("open-paint");
  const choose=(property,value)=>{
    const result=savePaint(paintChoices,vehicle.id,{...paintChoices[vehicle.id],[property]:value});
    const paint=applyPaint(player,vehicle.id,paintChoices[vehicle.id]);updateGarageCopy();
    for(const button of document.querySelectorAll("[data-paint-color]"))button.setAttribute("aria-pressed",String(button.dataset.paintColor===paintChoices[vehicle.id].color));
    for(const button of document.querySelectorAll("[data-paint-finish]"))button.setAttribute("aria-pressed",String(button.dataset.paintFinish===paintChoices[vehicle.id].finish));
    $("paint-status").textContent=`${paint.name} · ${paint.finish.name}${result.persisted?" · Saved":" · Active for this session; browser storage is unavailable"}`;
  };
  for(const button of document.querySelectorAll("[data-paint-color]"))button.onclick=()=>choose("color",button.dataset.paintColor);
  for(const button of document.querySelectorAll("[data-paint-finish]"))button.onclick=()=>choose("finish",button.dataset.paintFinish);
}
async function chooseVehicle(id) {
  if ((mode !== "menu" && mode !== "garage") || carSelectionPending) return false;
  const nextVehicle = getVehicle(id);
  if (nextVehicle.id === preferences.vehicle) return true;
  carSelectionPending = true;
  const controls = [...document.querySelectorAll('[data-vehicle], #start, #garage-race, #open-paint, #open-upgrades, #browse-cars')];
  for (const button of controls) button.disabled = true;
  $('garage-status').textContent = '';
  const carLoader = mountLogoLoader($('model-loading-notice'), {variant:'compact',label:'Preparing your car…',detail:nextVehicle.name});
  $('garage').setAttribute('aria-busy','true');
  try {
    if (nextVehicle.assetId) await prepareManufacturerCar(nextVehicle.assetId, {low: mobile});
    // Construct before changing the saved choice or disposing the current model.
    const nextPlayer = createCar({vehicle: nextVehicle.id, low: mobile});
    applyPaint(nextPlayer, nextVehicle.id, paintChoices[nextVehicle.id]);
    preferences.vehicle = nextVehicle.id;
    saveChoices();
    if (mode === "garage") {
      history.replaceState(null,"",carPath(preferences.vehicle));
      document.title = `${nextVehicle.name} — ${BRAND.name}`;
    }
    if (player) {
    player.group.removeFromParent();
    player.dispose();
    }
    player = nextPlayer;
    world.scene.add(player.group);
    addHeadlights(player);
  race = newRace();
  effects?.clear();
  const enabled = records.sound;
  records = loadRecords(recordStore);
  records.sound = enabled;
  setSound(enabled, recordStore);
  updateMenu();
  if (player) placeCar();
  event("car_select");
    $('garage-status').textContent = `${nextVehicle.name} is ready to race.`;
    return true;
  } catch (error) {
    console.warn('Car selection failed; keeping the current car.', error);
    $('garage-status').textContent = `Couldn't load ${nextVehicle.name}. Your current car is ready. Please try again.`;
    toast('Car download failed. Your current car is still selected.');
    return false;
  } finally {
    carLoader.destroy();
    carSelectionPending = false;
    for (const button of controls) button.disabled = false;
    $('garage').removeAttribute('aria-busy');
    updateGarageCopy();
  }
}
function openGarage() {
  closeDialog();
  clearInput();
  mode = "garage";
  history.replaceState(null,"",carPath(preferences.vehicle));
  document.title = `${getVehicle(preferences.vehicle).name} — ${BRAND.name}`;
  $("menu").hidden = true;
  $("garage").hidden = false;
  document.body.classList.add("in-garage");
  updateGarageCopy();
  document.querySelector(".car-choice[aria-pressed=\"true\"]")?.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});
  $("garage-back").focus({ preventScroll: true });
  loadCarPortraits();
  event("garage_open");
}
function loadCarPortraits() {
  for (const v of VEHICLES) for (const image of document.querySelectorAll(`[data-car-portrait="${v.id}"]`)) {
    image.src = `/assets/cars/manufacturers/${v.assetId}.webp`;
    image.loading = 'lazy'; image.classList.add('ready');
  }
}
function openCarLibrary() {
  const view = {query:'',family:'all',brand:'all',sort:'latest',favoritesOnly:false,compare:false};
  dialog({kind:'collection',eyebrow:`THE COLLECTION / ${VEHICLES.length} RACE CARS`,title:'Find your <em>next drive.</em>',html:carLibraryMarkup(),actions:[{label:'BACK TO GARAGE',primary:true,action:closeDialog}]});
  const refresh = () => {
    const cars = findCars({...view,favorites:favoriteCars,progression,setupState:carSetups});
    $('library-count').textContent = `${cars.length} / ${VEHICLES.length} cars${view.compare ? ` · compared with ${getVehicle(preferences.vehicle).name}` : ''}`;
    $('car-library-grid').innerHTML = cars.map(car => carLibraryCard(car,{selected:preferences.vehicle,favorites:favoriteCars,progression,setupState:carSetups,compare:view.compare})).join('');
    $('library-empty').hidden = cars.length !== 0;
    $('clear-car-filters').disabled = !hasCarFilters(view);
    for(const button of document.querySelectorAll('[data-library-car]')) button.onclick = async () => {
      closeDialog(); await chooseVehicle(button.dataset.libraryCar);
      for(const filter of document.querySelectorAll('[data-family]')) filter.setAttribute('aria-pressed',String(filter.dataset.family === 'all'));
      for(const card of document.querySelectorAll('[data-vehicle]')) card.hidden = false;
      $('collection-count').textContent = `${VEHICLES.length} / ${VEHICLES.length} CARS`;
      document.querySelector(`[data-vehicle="${preferences.vehicle}"]`)?.scrollIntoView({block:'nearest',inline:'center',behavior:reduced?'instant':'smooth'});
      $('garage-race').focus({preventScroll:true});
    };
    for(const button of document.querySelectorAll('[data-favorite]')) button.onclick = () => {
      const id = button.dataset.favorite;
      if(favoriteCars.has(id)) favoriteCars.delete(id); else favoriteCars.add(id);
      const persisted = saveFavorites(favoriteCars);
      refresh();
      (document.querySelector(`[data-favorite="${id}"]`) || $('favorites-only')).focus({preventScroll:true});
      if(!persisted) $('library-count').textContent += ' · Favourites saved for this session';
    };
    loadCarPortraits();
  };
  $('car-search').oninput = event => {view.query = event.target.value; refresh();};
  $('car-sort').onchange = event => {view.sort = event.target.value; refresh();};
  $('car-brand').onchange = event => {view.brand = event.target.value; refresh();};
  $('compare-cars').onchange = event => {view.compare = event.target.checked; refresh();};
  $('favorites-only').onclick = () => {view.favoritesOnly = !view.favoritesOnly; $('favorites-only').setAttribute('aria-pressed',String(view.favoritesOnly)); refresh();};
  for(const button of document.querySelectorAll('[data-library-family]')) button.onclick = () => {
    view.family = button.dataset.libraryFamily;
    for(const other of document.querySelectorAll('[data-library-family]')) other.setAttribute('aria-pressed',String(other === button));
    refresh();
  };
  const resetFilters = () => {
    Object.assign(view, clearCarFilters(view)); $('car-search').value = ''; $('car-brand').value = 'all';
    $('favorites-only').setAttribute('aria-pressed','false');
    for(const button of document.querySelectorAll('[data-library-family]')) button.setAttribute('aria-pressed',String(button.dataset.libraryFamily === 'all'));
    refresh(); $('car-search').focus({preventScroll:true});
  };
  $('reset-car-search').onclick = resetFilters;
  $('clear-car-filters').onclick = resetFilters;
  refresh();
}
async function start({replaceTour=false,practice=false,introAccepted=false}={}) {
  finalizeTour();
  if(!practice&&!introAccepted&&!schoolSeen(localStore())&&!selectedCampaignId){
    dialog({kind:'intro',eyebrow:'YOUR FIRST CORNER',title:'Make the road <em>yours.</em>',html:'<p>Try a short solo skills session for steering, drifting, Nitro pickups and Perfect Nitro. Skip any lesson. Your credits and records stay untouched.</p>',actions:[{label:'TRY DRIVING SCHOOL',primary:true,action:()=>{saveSchool(localStore());start({practice:true,introAccepted:true});}},{label:'GO STRAIGHT TO RACE',action:()=>{saveSchool(localStore());start({introAccepted:true});}}]});return;
  }
  pendingStartOptions={replaceTour,practice,introAccepted:true};
  if (carSelectionPending || racePreparing) return;
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
  school=practice?createDrivingSchool():null;
  if(preferences.mode==='championship'&&!school){
    let next=nextChampionshipRace(career);
    const changesTour=next&&(next.vehicle!==preferences.vehicle||next.track!==preferences.track||next.difficulty!==preferences.difficulty);
    if(changesTour&&!replaceTour){
      dialog({kind:'race-setup',eyebrow:'YOUR TOUR IS STILL IN PROGRESS',title:'Keep your <em>momentum.</em>',
        html:`<p>Your saved tour is waiting at round ${next.round} of 3. Continue with its car, circuit and difficulty, or start a new tour with your current selection. Starting a new tour replaces the unfinished tour; earned credits, upgrades and medals stay yours.</p>`,
        actions:[{label:'CONTINUE TOUR',primary:true,action:continueTour},{label:'START NEW TOUR',action:()=>start({replaceTour:true})},{label:'BACK',action:closeDialog}]});
      return;
    }
    if(!next||replaceTour){
      const begun=beginChampionship(career,{id:crypto.randomUUID(),vehicle:preferences.vehicle,track:preferences.track,difficulty:preferences.difficulty,seed:Date.now()});
      if(!begun.started)return;
      try {localStorage.setItem(CAREER_KEY,JSON.stringify(begun.state));}
      catch {toast('Tour progress needs browser storage. Your saved tour is unchanged; Circuit race and Time attack are still available.');return;}
      career=begun.state;next=begun.next;
    }
  }
  clearTimeout(countdownTimer);
  clearInput();
  const preparationStarted=performance.now();
  racePreparing=true;mode="preparing";updateTouchControls();
  dialog({kind:'preparing',eyebrow:preferences.mode==='time-attack'?'YOUR CIRCUIT. YOUR CLOCK.':'FILLING YOUR STARTING GRID',title:preferences.mode==='time-attack'?'Preparing your <em>run.</em>':'Preparing your <em>grid.</em>',html:logoLoaderMarkup({label:preferences.mode==='time-attack'?'Preparing your solo run…':'Preparing the race cars…',detail:preferences.mode==='time-attack'?'One car. One circuit. Your best time.':'Loading the cars for this race.'}),actions:[{label:'BACK',action:()=>{fleetGeneration++;racePreparing=false;menu();}}]});
  const gridLoader=bindLogoLoader($('dialog-content').querySelector('[data-logo-loader]'));
  try {if(!await prepareOpponents(crypto.randomUUID(),state=>gridLoader.update(state)))return;}catch(error){event("load_failure",{stage:"race"});racePreparing=false;dialog({kind:'preparing',eyebrow:'CONNECTION INTERRUPTED',title:'Let’s try <em>again.</em>',html:'<p>A car could not finish loading. Check your connection and try again.</p>',actions:[{label:'BACK TO HOME',primary:true,action:menu}]});return;}finally{gridLoader.destroy();}
  racePreparing=false;
  event("load_ready",{stage:"race",duration_seconds:(performance.now()-preparationStarted)/1000});
  closeDialog();
  renderer.domElement.focus({ preventScroll: true });
  sound.unlock();
  race = newRace();
  records=loadRecords(recordStore);
  startPersonalGhost();
  if(school)event("tutorial_start");
  renderLesson();
  frames = [];
  driftSnapshot = null; driftBankUntil = 0; lastBankedPoints = 0;
  nextFrame = 0;
  effects.clear();
  count = 3;
  countValue = 0;
  cameraHeading = race.car.yaw;
  cameraKick = 0; cameraKickAge = Infinity;
  nitroWasActive = false;
  document.body.classList.remove("in-garage");
  document.body.classList.add("in-race");
  mode = "countdown";
  $("menu").hidden = true;
  $("garage").hidden = true;
  $("hud").hidden = false;
  $("pause").hidden = false;
  $("consent-banner").hidden = true;
  updateTouchControls();
  $("countdown").hidden = false;
  $("ghost-label").textContent = preferences.mode==='time-attack'?"SOLO · TIME ATTACK":`YOU · ${race.rivals.length} RIVALS`;
  placeCar();
  updateRivals();
  updatePersonalGhost();
  updateCamera(0.016, false);
  updateHud();
  if(!school)event("race_start");
}
function menu() {
  finalizeTour();school=null;renderLesson();disposeGhost();
  if(racePreparing){fleetGeneration++;racePreparing=false;}
  pendingLandscapeStart = false;
  orientationGate(false);
  try { screen.orientation?.unlock?.(); } catch {}
  clearTimeout(countdownTimer);
  closeDialog();
  clearInput();
  mode = "menu";
  if (carFromPath(location.pathname)) history.replaceState(null,"",circuitPath(preferences.track));
  document.title = `${TRACK.name} — ${BRAND.name}`;
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
  $("consent-banner").hidden = getAnalyticsConsent() !== "unset";
  $("start").focus({ preventScroll: true });
}
function pauseGame() {
  if (mode !== "racing" && mode !== "countdown") return;
  const was = mode;pauseResumeMode=was;
  event("race_pause");
  mode = "paused";
  updateTouchControls();
  clearInput();
  dialog({
    kind: "pause",
    eyebrow: "TAKE A BREATHER",
    title: "Race <em>paused.</em>",
    html: pausePanel({race,track:TRACK,sound:records.sound,fullscreen:screenMode().active,screenLabel:screenMode().label,countdown:was === "countdown"}),
    actions: [
      {
        label: "KEEP DRIVING",
        primary: true,
        action() {
          if (needsLandscape()) { orientationGate(true); return; }
          closeDialog();
          clearInput();
          mode = was;
          updateTouchControls();
          event("race_resume");
          last = performance.now();
          renderer.domElement.focus({ preventScroll: true });
          sound.unlock();
        },
      },
      { label: "RESET TO ROAD", action() {
        resetCar(race); effects.clear(); clearInput(); closeDialog();
        mode = was; updateTouchControls(); last = performance.now();
        renderer.domElement.focus({ preventScroll: true });
      } },
      { label: "RESTART", action:()=>start({practice:Boolean(school),introAccepted:true}) },
      { label: "BACK TO HOME", action: menu },
    ],
  });
  $("pause-sound").onclick = () => {
    $("sound").click();
    $("pause-sound").innerHTML = `${icon(records.sound ? 'volume' : 'volume-off')}<span>Sound ${records.sound ? "on" : "off"}</span>`;
    $("pause-sound").setAttribute('aria-pressed',String(records.sound));
  };
  $("pause-fullscreen").onclick = async () => {
    const result = await toggleScreenMode();
    syncScreenButton();
    $('pause-screen-help').hidden = !result.help;
    $('pause-screen-help').innerHTML = result.help ? screenHelpMarkup(result) : '';
    $("pause-screen-status").hidden = !result.error;
    $("pause-screen-status").textContent = result.error || "";
  };
  mountSteeringSettings();
}
function how() {
  dialog({
    kind: "how",
    eyebrow: "FIND YOUR LINE",
    title: "Find your <em>line.</em>",
    html: howToPlayPanel({touch:usesTouchControls(),controls:preferences.controls}),
    actions: [
      { label: "GOT IT", primary: true, action: closeDialog },
      { label: "DRIVING SCHOOL", action:()=>start({practice:true,introAccepted:true}) },
      { label: "LET’S DRIVE", action: start },
    ],
  });
  mountSteeringSettings();
}
function privacy() {
  dialog({
    kind: "privacy",
    eyebrow: "YOUR RACE. YOUR CHOICE.",
    title: "You’re in <em>control.</em>",
    html: `<p>Your car and circuit choices, favourite cars, per-car paint colours and finishes, best times, sound setting, campaign objectives, car mastery, fitted setups, upgrade levels and race-credit balance stay in this browser. Clearing race records keeps your workshop progress. Clearing this website’s browser data removes all of them. Gameplay analytics is ${getAnalyticsConsent() === "granted" ? "enabled" : "off"}. When allowed, Google Analytics receives game events such as circuit selection and race completion, without your name, email address or recorded keystrokes.</p><p>Read the <a href="/privacy/">full privacy notice</a> for hosting, Google services and advertising details.</p><div class="privacy-controls"><button id="privacy-enable" class="button secondary">${icon('check')}<span>Allow analytics</span></button><button id="privacy-disable" class="button secondary">${icon('close')}<span>Turn analytics off</span></button></div>`,
    actions: [
      { label: "CLOSE", primary: true, action: closeDialog },
      {
        label: "CLEAR RACE RECORDS", danger: true,
        action() {
          dialog({kind:"privacy",eyebrow:"YOUR SAVED RACES",title:"Clear your <em>race records?</em>",html:"<p>This removes the race-time records and replays used by Race HQ. Your career medals, campaign objectives, car mastery, setups, tour history, cars, upgrades, credits, paint and favourites stay. This cannot be undone.</p>",actions:[{label:"KEEP MY RECORDS",primary:true,action:privacy},{label:"CLEAR RACE RECORDS",danger:true,action:clearRaceRecords}]});
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
function clearRaceRecords() {
          let cleared=true;
          try {
            Object.keys(localStorage)
              .filter((k) => k.startsWith(STORAGE_KEY))
              .forEach((k) => localStorage.removeItem(k));
          } catch {cleared=false;}
          const enabled = records.sound;
          records = clearRecords(recordStore);
          records.sound = enabled;
          setSound(enabled, recordStore);
          preferences.sound = enabled;
          saveChoices();
          updateSound();
          updateMenu();
          closeDialog();
          toast(cleared?"Race HQ times and replays cleared. Medals and tours kept.":"Browser storage is unavailable. Some saved records could not be cleared.");
}
function finishRows() { return finishRowsMarkup(race); }
function updateFinish() {
  const refreshed=refreshChampionshipRound(career,race);career=refreshed.state;if(refreshed.changed)persistCareer();const table=$("tour-standings");if(table&&refreshed.tour){const markup=championshipStandingsMarkup(refreshed.tour);if(table.outerHTML!==markup)table.outerHTML=markup;}
  if (modalKind !== "result") return;
  const list = $("finish-order");
  if (list) {
    const rows = finishRows();
    if (list.innerHTML !== rows) list.innerHTML = rows;
  }
  const status = $("finish-status");
  if (status)
    status.textContent = finishStatusText(race);
}
function finish() {
  if(school){finishSchool();return;}
  clearTimeout(countdownTimer);
  $("countdown").hidden = true;
  mode = "finished";
  effects.clear(); // Do not freeze boost plumes behind the results overlay.
  clearInput();
  document.body.classList.remove("nitro-active");
  $("touch").hidden = true;
  $("pause").hidden = true;
  const previous = records.bestTime;
  const reward = awardRaceCredits(progression, race);
  const careerResult=recordCareerResult(career,race,reward);career=careerResult.state;const careerPersisted=persistCareer();
  const campaignResult=recordCampaignResult(campaign,race,reward);campaign=campaignResult.state;
  const masteryResult=recordMasteryResult(mastery,race,reward);mastery=masteryResult.state;
  const campaignSaved=!campaignResult.recorded || persistCampaign(campaign), masterySaved=!masteryResult.recorded || persistMastery(mastery);
  updateWallet();
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
  lastResultDialog={
    kind: "result",
    eyebrow: `${TRACK.name.toUpperCase()} · ${race.mode==='time-attack'?'TIME ATTACK':'CLASSIFIED'}`,
    title:
      race.mode==='time-attack'?"A time to <em>beat.</em>":race.position === 1
        ? "Take the <em>flag.</em>"
        : "Finish <em>strong.</em>",
    html: finishPanel({race,track:TRACK,isBest:best,previousBest:previous,bestTime:records.bestTime,reward,credits:progression.credits}) + careerResultMarkup(careerResult,careerPersisted) + developmentResultMarkup(campaignResult,masteryResult,{campaignSaved,masterySaved}),
    actions: [
      ...(campaignResult.firstCompletion && campaignResult.next ? [{label:"NEXT CAMPAIGN EVENT",primary:true,action:()=>selectCampaignEvent(campaignResult.next)}] : []),
      { label: careerResult.tour && !careerResult.tourCompleted ? "NEXT TOUR RACE" : race.mode==='time-attack'?"RUN AGAIN":"RACE AGAIN", primary: !campaignResult.firstCompletion || !campaignResult.next, action: careerResult.tour && !careerResult.tourCompleted ? continueTour : start },
      {
        label: "GARAGE",
        action() {
          menu();
          openGarage();
        },
      },
      { label: "SHARE RESULT", action:()=>showShareResult(reward) },
      { label: "HOME", action: menu },
    ],
  };
  dialog(lastResultDialog);
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
$("circuit-name").textContent = TRACK.name;
$("circuit-description").textContent = TRACK.description;
$("circuit-art").innerHTML = circuitMapMarkup(TRACK);
$("browse-circuits").onclick = () => { saveChoices(); location.assign('/circuits/'); };
$('race-setup').onclick=showRaceSetup;
$('open-campaign').onclick=showCampaign;
for(const button of document.querySelectorAll('[data-lobby-mode]'))button.onclick=()=>{
  selectedCampaignId=null;preferences.mode=button.dataset.lobbyMode;saveChoices();updateMenu();
};
$('hq-wallet').onclick=()=>{openGarage();showUpgrades();};
// Browser audio starts only after a deliberate interaction, including lobby controls.
for(const eventName of ['pointerdown','keydown'])document.addEventListener(eventName,()=>{if(records.sound)sound.unlock();},{once:true,capture:true});
$("garage-cars").replaceChildren(
  ...[...VEHICLES].sort((a,b) => Number(Boolean(b.assetId)) - Number(Boolean(a.assetId))).map((v, i) => {
    const b = document.createElement("button");
    b.className = "car-choice";
    b.dataset.vehicle = v.id;
    b.style.setProperty("--car-color", v.color);
    b.setAttribute("aria-pressed", String(v.id === preferences.vehicle));
    b.setAttribute("aria-label", `Select ${v.name}`);
    b.title = v.name;
    const cardName = v.brand && v.name.startsWith(`${v.brand} `) ? v.name.slice(v.brand.length + 1) : v.name;
    b.innerHTML = `<small><b>${v.brand || v.family.toUpperCase()}</b><span>${NEW_CARS.has(v.id) ? "NEW" : String(i + 1).padStart(2, "0")}</span></small><img data-car-portrait="${v.id}" width="320" height="160" alt="" /><strong>${cardName}</strong><span class="car-choice-stats">${v.specs.speed} · ${v.specs.boost} NITRO</span>`;
    b.onclick = () => { chooseVehicle(v.id); b.scrollIntoView({block:"nearest",inline:"nearest",behavior:reduced ? "instant" : "smooth"}); };
    return b;
  }),
);
for (const button of document.querySelectorAll("[data-family]")) {
  button.onclick = () => {
    const family = button.dataset.family;
    let shown = 0;
    for (const card of document.querySelectorAll("[data-vehicle]")) {
      card.hidden = family !== "all" && getVehicle(card.dataset.vehicle).family !== family;
      if (!card.hidden) shown++;
    }
    for (const option of document.querySelectorAll("[data-family]")) option.setAttribute("aria-pressed", String(option === button));
    $("collection-count").textContent = `${shown} / ${VEHICLES.length} CARS`;
    $("garage-cars").scrollTo({left:0,behavior:reduced ? "instant" : "smooth"});
  };
}
for (const [id, direction] of [["cars-previous",-1],["cars-next",1]]) $(id).onclick = () => $("garage-cars").scrollBy({left:direction * $("garage-cars").clientWidth * .8,behavior:reduced ? "instant" : "smooth"});
$("open-garage").onclick = () => { location.href = '/cars/'; };
$("browse-cars").onclick = () => { location.href = '/cars/'; };
$("open-upgrades").onclick = () => showUpgrades();
$("open-paint").onclick = showPaint;
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
  const result = await toggleScreenMode();
  syncScreenButton();
  if (result.help) {
    dialog({kind:'screen-mode',eyebrow:'MORE ROOM TO RACE',title:'Full-screen <em>play.</em>',
      html:screenHelpMarkup(result),actions:[{label:'GOT IT',primary:true,action:closeDialog}]});
  }
  return result.error || '';
};
function syncScreenButton() {
  const state = screenMode();
  $('fullscreen').setAttribute('aria-label', state.label);
  $('fullscreen').title = state.label;
  if ($('pause-fullscreen')) $('pause-fullscreen').innerHTML = `${icon('fullscreen')}<span>${state.label}</span>`;
}
document.addEventListener('fullscreenchange', syncScreenButton);
document.addEventListener('webkitfullscreenchange', syncScreenButton);
syncScreenButton();
$("home-link").onclick = (e) => {
  e.preventDefault();
  if (mode === "racing" || mode === "countdown") pauseGame();
  else if (mode === "menu") $("start").focus();
  else if (mode === "garage") menu();
};

window.addEventListener("keydown", (e) => {
  if (isDrivingShortcut(e)) {
    if (heldKeys.delete(e.code)) syncInput();
    return;
  }
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
  const action=actionForKey(e.code,preferences.controls);
  if ((e.code === "Escape" || action === "pause") && e.repeat) return;
  if (modalKind) {
    if (e.code === "Escape" || (action === "pause" && modalKind === "pause")) {
      e.preventDefault();
      if (modalKind === "pause")
        document.querySelector("#dialog-actions button")?.click();
      else if(modalKind === "preparing") menu();
      else if(modalKind==="share"){dialog(lastResultDialog);updateFinish();}
      else if (!["result","recovery","school-result"].includes(modalKind)) {if(mode==="paused")pauseSettingsReturn();else closeDialog();}
    }
    return;
  }
  if (e.code === "Escape" && mode === "garage") {
    menu();
    return;
  }
  if (action === "pause") {
    if (["racing", "countdown"].includes(mode)) e.preventDefault();
    pauseGame();
    return;
  }
  if (mode !== "racing" && mode !== "countdown") return;
  if (e.code === "Space" && e.target.closest?.("button,a")) return;
  if (["left","right","brake","drift","nitro"].includes(action)) {
    e.preventDefault();
    heldKeys.add(e.code);
    syncInput();
  }
  if (action === "reset" && !e.repeat) {
    resetCar(race);
    event("car_reset");
    effects.clear();
  }
});
window.addEventListener("keyup", (e) => {
  if (heldKeys.has(e.code)) {
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
    try { b.setPointerCapture(e.pointerId); } catch {}
    pointerInputs.press(e.pointerId, b.dataset.input);
    syncInput();
  });
  const release = (e) => {
    pointerInputs.release(e.pointerId);
    syncInput();
  };
  b.addEventListener("pointerup", release);
  b.addEventListener("pointercancel", release);
  b.addEventListener("lostpointercapture", release);
  b.addEventListener("keydown", (e) => {
    if (isDrivingShortcut(e)) { heldPads.delete(b.dataset.input); syncInput(); return; }
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
window.addEventListener('pagehide', event => {
  clearInput();
  if (!event.persisted) world?.backdrop?.dispose();
});
for (const name of ['pointerup', 'pointercancel']) window.addEventListener(name, event => {
  dragSteering.release(event.pointerId);
  if (pointerInputs.release(event.pointerId)) syncInput();
});
const changedScreenOrientation = () => {
  clearInput();
  if (steeringMode === 'tilt') {
    tiltStatus = 'Phone rotated. Hold it comfortably; the next reading recenters your steering.';
    updateSteeringSettings();
  }
  checkOrientation();
};
screen.orientation?.addEventListener?.('change', changedScreenOrientation);
window.addEventListener('orientationchange', changedScreenOrientation);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInput();
    pauseGame();
  }
});
$("dialog").addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const focus = [...$("dialog").querySelectorAll("button,a[href],select,input,textarea,[tabindex]")].filter(
    (el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0 && !el.closest("[hidden],[inert]"),
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
  garageFrame = null; lobbyFrame = null;
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  applyQuality();
  composer?.setSize(innerWidth, innerHeight);
  checkOrientation();
  updateTouchControls();
  if(mode === "garage") document.querySelector("[data-vehicle][aria-pressed=\"true\"]")?.scrollIntoView({block:"nearest",inline:"center",behavior:"instant"});
});
$("menu").addEventListener("scroll",()=>{lobbyFrame=null;},{passive:true});
$("garage").addEventListener("scroll",()=>{garageFrame=null;},{passive:true});
function placeCar() {
  const showroom=["menu","garage"].includes(mode),c=race.car;
  player.group.position.set(c.x, showroom ? .038 : (c.y||0)+.013, c.z);
  const crash=collisionPose(showroom?null:race,{reducedMotion:reduced});
  player.group.position.y+=crash.lift;
  player.group.rotation.set(showroom?0:-(c.pitch||0)+crash.pitch,c.yaw+crash.yaw,showroom?0:(c.roll||0)+crash.roll,'YXZ');
}

function updateCamera(dt, instant = false) {
  const c = race.car;
  const f = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
  const side = new THREE.Vector3(f.z, 0, -f.x);
  const crashing=race.wreck?.phase==='impact'||race.wreck?.phase==='recovering';
  const roadY=["menu","garage"].includes(mode)?0:crashing?(race.wreck.groundY||0):(c.y||0);
  const pos = new THREE.Vector3(c.x, roadY, c.z);
  if (mode === "garage") {
    if (!garageFrame) {
      const rect = $('garage-showcase').getBoundingClientRect();
      garageFrame = {x:rect.left+rect.width/2,y:rect.top+rect.height/2,width:Math.max(100,rect.width),height:Math.max(80,rect.height)};
    }
    camera.fov = 43;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(7.3, 6.4 * innerWidth / (2*tan*camera.aspect*garageFrame.width), 2.35 * innerHeight / (2*tan*garageFrame.height));
    const angle = c.yaw + garageYaw + (reduced ? 0 : Math.sin(time*.17)*.10);
    camTarget.set(c.x+Math.sin(angle)*distance, .65+distance*.22, c.z+Math.cos(angle)*distance);
    lookTarget.set(c.x,.65,c.z);
    cameraHeading = c.yaw;
  } else if (mode === "finished") {
    const angle =
      c.yaw +
      (mode === "garage" ? garageYaw : 2.8) +
      (reduced ? 0 : Math.sin(time * 0.17) * 0.22);
    const narrowGarage = innerWidth < 600;
    if (mode === "garage" && narrowGarage && !garageFrame) {
      const intro = document.querySelector('.garage-intro').getBoundingClientRect();
      const panel = document.querySelector('.garage-spec').getBoundingClientRect();
      garageFrame = { y:(intro.bottom+panel.top)/2, height:Math.max(80,panel.top-intro.bottom-20) };
    }
    const compactGarage = innerHeight < 520 && !narrowGarage;
    const distance = narrowGarage
      ? Math.max(9.5, 6.4 / (2 * Math.tan(THREE.MathUtils.degToRad(51 / 2)) * camera.aspect), mode === "garage" ? 2.3 * innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(51 / 2)) * garageFrame.height) : 0)
      : (compactGarage ? 9.0 : 9.0);
    camTarget.set(
      c.x + Math.sin(angle) * distance,
      roadY + (narrowGarage ? distance * .28 : 2.9),
      c.z + Math.cos(angle) * distance,
    );
    lookTarget.set(c.x, roadY + .64, c.z);
    if (mode === "garage" && !narrowGarage) {
      // Shift the car away from its performance panel while keeping its whole body visible.
      const shift = compactGarage ? -1.2 : 1.1;
      lookTarget.x += Math.cos(angle) * shift;
      lookTarget.z -= Math.sin(angle) * shift;
    }
    camera.fov = innerWidth < 600 ? 51 : 43;
  } else if (mode === "menu") {
    if (!lobbyFrame) {
      const rect = $('lobby-showcase').getBoundingClientRect();
      lobbyFrame = {x:rect.left+rect.width/2,y:rect.top+rect.height/2,width:Math.max(100,rect.width),height:Math.max(80,rect.height)};
    }
    camera.fov = 43;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(7.3, 6.4 * innerWidth / (2*tan*camera.aspect*lobbyFrame.width), 2.35 * innerHeight / (2*tan*lobbyFrame.height));
    const angle = c.yaw + .62 + (reduced ? 0 : Math.sin(time*.12)*.12);
    camTarget.set(c.x+Math.sin(angle)*distance, .65+distance*.22, c.z+Math.cos(angle)*distance);
    lookTarget.set(c.x,.65,c.z);
    cameraHeading = c.yaw;
  } else if (mode === "countdown") {
    // Frame the grid, start lights and full gantry before settling into chase view.
    camTarget.copy(pos).addScaledVector(f, -15);
    camTarget.y = roadY+6.1;
    lookTarget.copy(pos).addScaledVector(f, 5.5);
    lookTarget.y = roadY+2.6;
    camera.fov = 60;
    cameraHeading = c.yaw;
    cameraSpeed = 0;
  } else {
    const velocityYaw = c.speed > 6 ? Math.atan2(c.vx, c.vz) : c.yaw;
    const slip = Math.atan2(
      Math.sin(velocityYaw - c.yaw),
      Math.cos(velocityYaw - c.yaw),
    );
    const desiredHeading = crashing ? race.wreck.heading : c.yaw + slip * 0.4;
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
    const phoneChase = usesTouchControls();
    camTarget.copy(pos).addScaledVector(forward, -(phoneChase ? 6.1 : 7.0) - cameraSpeed * 0.014);
    camTarget.y = roadY+2.35 + cameraSpeed * 0.006;
    lookTarget.copy(pos).addScaledVector(forward, 4.0);
    lookTarget.y = roadY+0.8;
    camera.fov =
      (phoneChase ? 48 : 50) + (!reduced&&!preferences.controls.stableCamera ? cameraSpeed * 0.08 + (race.nitro.active ? 3 : 0) : 0);
  }
  const blend = instant ? 1 : 1 - Math.exp(-dt * (mode === "menu" ? 2 : 7));
  camera.position.sub(cameraImpactOffset);
  cameraImpactOffset.set(0, 0, 0);
  camera.position.lerp(camTarget, blend);
  smoothedLook.lerp(lookTarget, instant ? 1 : 1 - Math.exp(-dt * 8));
  if (!reduced && !preferences.controls.stableCamera && mode === "racing") {
    const impulse = impactCameraOffset(cameraKickAge, cameraKick, cameraKickX, cameraKickZ);
    cameraImpactOffset.set(impulse.x, impulse.y, impulse.z);
    camera.position.add(cameraImpactOffset);
  }
  camera.lookAt(smoothedLook);
  const targetBank =
    !reduced && !preferences.controls.stableCamera && mode === "racing"
      ? -c.steering * Math.min(c.speed / 35, 1) * 0.013
      : 0;
  cameraBank += (targetBank - cameraBank) * (1 - Math.exp(-dt * 4));
  camera.rotateZ(cameraBank);
  carFill.position.copy(camera.position);
  carFill.position.y += 3;
  carFill.target.position.set(c.x, roadY+0.6, c.z);
  if (mode === "menu" && lobbyFrame) camera.setViewOffset(innerWidth,innerHeight,innerWidth/2-lobbyFrame.x,innerHeight/2-lobbyFrame.y,innerWidth,innerHeight);
  else if (mode === "garage" && garageFrame) camera.setViewOffset(innerWidth,innerHeight,innerWidth/2-garageFrame.x,innerHeight/2-garageFrame.y,innerWidth,innerHeight);
  else if (camera.view?.enabled) camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
function updateRivals() {
  for (let i = 0; i < rivalModels.length; i++) {
    const model = rivalModels[i],
      r = race.rivals[i];
    model.group.visible = Boolean(r) && mode !== "menu" && mode !== "garage";
    if(!model.group.visible)continue;
    model.group.position.set(r.car.x,(r.car.y||0)+.055,r.car.z);
    const crash=collisionPose(r,{reducedMotion:reduced});model.group.position.y+=crash.lift;
    model.group.rotation.set(-(r.car.pitch||0)+crash.pitch,r.car.yaw+crash.yaw,(r.car.roll||0)+crash.roll,'YXZ');
    model.setDistanceDetail?.(Math.hypot(r.car.x-race.car.x,r.car.z-race.car.z),adaptiveQuality.settings);
    model.update({
      speed:
        (mode === "racing" || mode === "finished") && r.state !== "finished"
          ? r.car.speed
          : 0,
      actualSpeed:r.car.speed, raceId:race.raceId, paused:mode==="paused", recovery:r.recovery,car:r.car,reducedMotion:reduced,
      steering: r.car.steering,
      brake: r.car.braking ? 1 : 0,
      drift: r.car.drifting,
      nitro: r.car.nitroActive, air:r.air,impact:r.impact,active:mode==="racing",
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
  drawRaceMap(map, TRACK, race);
  const label = $('map-track');
  if (label.textContent !== TRACK.name) label.textContent = TRACK.name;
  const description = `${TRACK.name} circuit map. Yellow arrow: your car. White dots: opponents. Violet route: completed part of this lap. Diamond: next timing checkpoint. Chequered gate: start and finish.`;
  if (map.canvas.getAttribute('aria-label') !== description) map.canvas.setAttribute('aria-label', description);
}

function updateHud() {
  const pad = $("touch-steer-cue"), range = Math.max(20, (pad.getBoundingClientRect().width - 48) / 2);
  $("position").textContent = race.mode==='time-attack'?"SOLO":race.position;
  document.querySelector(".position-line>span").textContent=race.mode==='time-attack'?"RUN":"POS.";
  $("field-size").textContent = race.mode==='time-attack'?"":`/ ${race.rivals.length+1}`;
  $("race-progress").textContent = getRaceProgress(race).label;
  $("rival-order").innerHTML = race.leaderboard
    .map(
      (r) =>
        `<li class="${r.isPlayer ? "you" : ""}" style="--car-color:${r.isPlayer ? playerColor() : r.color}"><b>${r.position}</b><i></i>${r.isPlayer ? "YOU" : r.name.toUpperCase()}</li>`,
    )
    .join("");
  const charge = race.nitro.charge / race.nitro.capacity;
  $("nitro-fill").style.width = `${charge * 100}%`;
  $("pad-nitro-fill").style.transform = `scaleX(${charge})`;
  $("nitro-ring-fill").style.strokeDashoffset = String((1 - charge) * 100);
  $("nitro-pad-label").textContent = race.nitro.locked ? "RELEASE" : race.nitro.mode==='burst'?'BURST':race.nitro.mode==='perfect'?'PERFECT':race.nitro.active?'BOOST':'NITRO';
  $('nitro-meter').dataset.mode=race.nitro.mode;document.body.classList.toggle('perfect-window',race.nitro.perfectWindow);
  $('nitro-timing').style.setProperty('--timing',race.nitro.timingProgress||0);
  $('nitro-timing').hidden=!(race.nitro.timingProgress>0);
  $('nitro-timing').classList.toggle('is-perfect',race.nitro.perfectWindow);
  const steer = clamp(analogSteering + Number(input.right) - Number(input.left), -1, 1);
  $("touch-steer-dot").style.transform = `translateX(${steer * range}px)`;
  $("touch-steer-label").textContent = steeringMode === 'tilt' ? 'TILT + TOUCH' : 'HOLD / DRAG';
  pad.setAttribute('aria-valuenow', String(Math.round(steer * 100)));
  pad.setAttribute('aria-valuetext', Math.abs(steer) < .02 ? 'Straight' : `${Math.round(Math.abs(steer) * 100)} percent ${steer > 0 ? 'right' : 'left'}`);
  $("touch-steer-cue").classList.toggle("engaged", dragSteering.active());
  $("touch-steer-cue").classList.toggle("subtle", race.elapsed > 6);
  $("nitro-pad-amount").textContent = `${Math.round(charge * 100)}%`;
  $("nitro-amount").textContent = `${Math.round(charge * 100)}%`;
  $("nitro-status").textContent = race.nitro.active
    ? (race.nitro.mode==='burst'?"FULL-CHARGE BURST":race.nitro.mode==='perfect'?"PERFECT NITRO":"NITRO ACTIVE")
    : race.nitro.locked
      ? "RELEASE NITRO"
      : charge > 0.15
        ? "NITRO READY"
        : "RECHARGING";
  $("nitro-meter").setAttribute("aria-valuenow", String(Math.round(charge * 100)));
  $("nitro-meter").setAttribute("aria-valuetext", `${Math.round(charge * 100)}% · ${$("nitro-status").textContent}`);
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
  const feedback = getDriftDisplay(race, driftSnapshot);
  driftSnapshot = feedback.snapshot;
  if (feedback.bankedPoints > 0) { lastBankedPoints = feedback.bankedPoints; driftBankUntil = time + 1.6; }
  if (feedback.state === "collision") driftBankUntil = 0;
  const banked = time < driftBankUntil && !race.car.drifting && feedback.pendingPoints === 0;
  $("score").textContent = (banked ? lastBankedPoints : feedback.pendingPoints).toLocaleString();
  $("combo").innerHTML = banked ? "DRIFT BANKED" : `DRIFT <em>×${feedback.combo}</em>`;
  $("drift-label").textContent = banked ? "CLEAN LINE. POINTS EARNED." : "HOLD YOUR LINE";
  document.body.classList.toggle("has-drift-points", feedback.pendingPoints > 0 || banked);
  document.querySelector(".drift-score").setAttribute("aria-hidden", String(!race.car.drifting && feedback.pendingPoints === 0 && !banked));
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
  $("speed-lines").style.opacity =
    mode === "racing" && !reduced
      ? Math.max(0, (race.car.speed - 23) / 22) * 0.25
      : 0;
  drawMap();
}
function tick(now) {
  if (!frameBudget.ready(now,{mobile,hidden:document.hidden,mode,batterySaver:preferences.controls.batterySaver})) {
    if(document.hidden)last=now;
    requestAnimationFrame(tick);return;
  }
  if(lastRendered&&mode==='racing'&&!preferences.controls.batterySaver){if(adaptiveQuality.sample(now-lastRendered,{active:true}))applyQuality();}
  else adaptiveQuality.reset();
  if(lastRendered&&mode==='racing'){performanceSamples.push(now-lastRendered);if(performanceSamples.length>600)performanceSamples.shift();if(now-lastPerformanceReport>60000&&performanceSamples.length>=120){const sorted=[...performanceSamples].sort((a,b)=>a-b);event('performance_sample',{p75_frame_ms:sorted[Math.floor(sorted.length*.75)],quality_level:adaptiveQuality.status.level,draw_calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});lastPerformanceReport=now;performanceSamples=[];}}else performanceSamples=[];
  lastRendered=now;
  const wasFinished = mode === "finished";
  const dt = Math.min((now - last) / 1000, 0.05);
  if (['racing', 'countdown'].includes(mode) && steeringMode === 'tilt' && now > tiltGraceUntil && !tiltSteering.fresh()) {
    useTouchSteering('Motion data stopped. Touch steering is ready; enable tilt again in Pause when available.');
    toast('Tilt signal stopped. Use the thumbpad to steer.');
  }
  analogSteering = ['racing', 'countdown'].includes(mode)
    ? dragSteering.active() ? dragSteering.read() : steeringMode === 'tilt' ? tiltSteering.read(dt) : 0
    : 0;
  const padState=readGamepad([...navigator.getGamepads?.()||[]].find(p=>p?.connected&&p.mapping==='standard'),{swap:preferences.gamepadSwap});
  if(padState.pause&&!gamepadPauseHeld){
    if(['racing','countdown'].includes(mode))pauseGame();
    else if(mode==='paused'&&modalKind==='pause'&&$("orientation-gate").hidden)document.querySelector('#dialog-actions button')?.click();
  }
  gamepadPauseHeld=padState.pause;
  const driveControls = resolveDriveControls({...input, nitro:nitroLatch.sample(input.nitro||padState.nitro,preferences.controls.nitroToggle),brake:input.brake||padState.brake,steer:Math.abs(padState.steer)>.01?padState.steer:analogSteering}, {steeringSensitivity:preferences.steeringSensitivity});
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
          n <= 0 ? "#C3FB13" : i < 4 - n ? "#FF0054" : "#110017",
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
      driveControls,
      dt,
    );
    if (race.elapsed >= nextFrame && frames.length < 9000) {
      frames.push({
        t: race.elapsed,
        x: race.car.x,
        z: race.car.z,
        yaw: race.car.yaw,y:race.car.y||0,pitch:race.car.pitch||0,roll:race.car.roll||0,progress:race.raceProgress,
      });
      nextFrame += 0.1;
    }
    if (race.completedLaps > lastLap && race.state !== "finished") {
      event("lap_complete", {
        lap: race.completedLaps,
        duration_seconds: Math.round(race.lastLap),
      });
    }
    if(school&&school.update(race,driveControls,dt)){event('tutorial_step',{step:Math.min(school.index,LESSONS.length)});renderLesson();if(!school.active)finishSchool();}
    if (race.state === "finished" && mode==='racing') finish();
  }
  if (wasFinished && !race.allFinished) stepRace(race, {}, dt);
  if (mode === "finished") updateFinish();
  if (mode === "racing" && race.nitro.active && !nitroWasActive)
    event("nitro_use");
  nitroWasActive = race.nitro.active;
  placeCar();
  player.update({
    speed: mode === "racing" ? race.car.speed : 0,
    actualSpeed:race.car.speed, raceId:race.raceId, paused:mode==="paused", recovery:race.recovery,car:race.car,reducedMotion:reduced,
    steering: race.car.steering,
    brake: driveControls.brake ? 1 : 0,
    drift: race.car.drifting,
    nitro: mode === "racing" && race.nitro.active,air:race.air,impact:race.impact,active:mode==="racing",
    time,
  });
  updateRivals();
  updatePersonalGhost();
  if($("skill-coach"))$("skill-coach").hidden=!school?.lesson||!["racing","countdown"].includes(mode)||Boolean(modalKind);
  const showroom = mode === "menu" || mode === "garage";
  pickupView?.update(race.pickups,time,!showroom,reduced,mode==="racing"?dt:0);
  if (!showroom) effects.update(race.car, dt, time, mode === "racing", {
    profile: player.group.userData.effects,air:race.air,rivals:race.rivals,raceId:race.raceId,
    nitro: mode === "racing" && race.nitro.active,
    reducedMotion: reduced,
    wetRoad: !["desert","parkland"].includes(world.scene.userData.venueEnvironment?.type),
    brake: driveControls.brake,
    handbrake: input.drift,
    throttle: mode === "racing" ? driveControls.throttle : 0,
    collision: race.collision,
    impact: race.impact,
    menu: mode === "menu" || mode === "garage",
  });
  const status = raceFeedback.read(race, {active: mode === 'racing', reducedMotion: reduced, now});
  const statusElement = $('race-feedback');
  statusElement.hidden = status.kind === 'none';
  if (statusElement.dataset.kind !== status.kind) {
    statusElement.dataset.kind = status.kind;
    const symbol = status.kind === 'lap' ? 'flag' : status.kind === 'crash' ? 'steering' : status.kind === 'recovered' ? 'check' : 'restart';
    $('race-feedback-icon').setAttribute('href', `/assets/ui/race-icons.svg?v=20261002-2#${symbol}`);
  }
  if ($('race-feedback-title').textContent !== status.title) $('race-feedback-title').textContent = status.title;
  if ($('race-feedback-detail').textContent !== status.detail) $('race-feedback-detail').textContent = status.detail;
  if (status.announcement) $('race-feedback-live').textContent = status.announcement;
  else if (mode !== 'racing' && $('race-feedback-live').textContent) $('race-feedback-live').textContent = '';
  $('race-impact').style.opacity = String(status.flash);
  $('race-impact').dataset.edge = status.edge;
  if (status.kick) {
    cameraKick = status.kick; cameraKickAge = 0;
    cameraKickX = Number.isFinite(race.impact.nx) ? race.impact.nx : -Math.sin(race.car.yaw);
    cameraKickZ = Number.isFinite(race.impact.nz) ? race.impact.nz : -Math.cos(race.car.yaw);
  }
  if (mode === 'racing') cameraKickAge += dt;
  else { cameraKick = 0; cameraKickAge = Infinity; }
  if (!showroom) world.update(time, race.car, {paused: mode === 'paused', reducedMotion: reduced});
  const activeScene = showroom ? garageStudio.scene : world.scene;
  if (player.group.parent !== activeScene) activeScene.add(player.group);
  renderPass.scene = activeScene;
  // Bloom produced a black composite during contact on tested WebGL drivers.
  // Keep the verified clear race render (including SMAA and Output)
  // and reserve the extra glow pass for the static showroom presentation.
  bloomPass.enabled = showroom && !directRender;
  bloomPass.strength = showroom ? .04 : .18;
  renderer.toneMappingExposure = showroom ? .95 : 1.1;
  if (showroom) garageStudio.position(race.car);
  updateCamera(dt);
  sound.update(
    {
      speed: race.car.speed,topSpeed:race.specs.topSpeed,slipAngle:race.car.slipAngle,
      vehicle: race.vehicle,raceId:race.raceId||race,impact:race.impact,pickupEvent:race.pickupEvent,air:race.air,
      listener:race.car,rivals:race.rivals.map(r=>({id:r.id,vehicle:r.vehicle,impact:r.impact,...r.car})),
      road:['coastal','urban'].includes(world.scene.userData.venueEnvironment?.type)?'wet':'asphalt',
      crowd:Math.max(0,1-Math.min(race.progress||0,TRACK.length-(race.progress||0))/120)*.4,
      nitro: race.nitro.active,nitroMode:race.nitro.mode,
      drift: race.car.drifting,
      brake: driveControls.brake,
      running: mode === "racing",
      lobby: ["menu","garage"].includes(mode) && !document.hidden,
      throttle: driveControls.throttle,
    },
    dt,
  );
  if (uiTimer > 0.075) {
    uiTimer = 0;
    if (["racing", "countdown", "finished"].includes(mode)) updateHud();
  }
  renderScene();
  requestAnimationFrame(tick);
}


function disposeGhost(){ghostModel?.dispose();ghostModel=null;ghostReference=[];ghostTiming=null;const badge=$('ghost-split');if(badge)badge.hidden=true;}
function startPersonalGhost(){
 disposeGhost();if(school||race.mode!=='time-attack'||!preferences.controls.showGhost||records.ghost.length<2)return;
 ghostReference=records.ghost;ghostTiming=createGhostTiming(ghostReference);lastGhostSector=0;
 try{ghostModel=createCar({vehicle:preferences.vehicle,ghost:true,low:mobile});ghostModel.group.visible=false;world.scene.add(ghostModel.group);}catch{ghostReference=[];}
}
function updatePersonalGhost(){
 const badge=$('ghost-split');if(!ghostModel){if(badge)badge.hidden=true;return;}
 const active=['racing','paused'].includes(mode)&&race.mode==='time-attack'&&preferences.controls.showGhost;
 const pose=active?interpolateGhost(ghostReference,race.elapsed):null;ghostModel.group.visible=Boolean(pose);
 if(pose){ghostModel.group.position.set(pose.x,pose.y+.055,pose.z);ghostModel.group.rotation.set(-pose.pitch,pose.yaw,pose.roll,'YXZ');}
 if(!active){if(badge)badge.hidden=true;return;}
 if(uiTimer<=.075)return;
 const reference=ghostTimeAtProgress(ghostReference,race.raceProgress);const split=ghostTiming.update(race.raceProgress,race.elapsed);
 if(badge){badge.hidden=reference===null;const delta=reference===null?0:race.elapsed-reference;badge.classList.toggle('ahead',delta<0);badge.textContent=`PERSONAL BEST  ${delta<0?'−':'+'}${Math.abs(delta).toFixed(2)}s${split.last?' · S'+split.last.sector:''}`;}
}
function mountTrialSettings(){
 if(preferences.mode!=='time-attack')return;
 const panel=document.createElement('section');panel.className='trial-settings';panel.innerHTML=`<label><input id="trial-stock" type="checkbox" ${preferences.controls.stockTrial?'checked':''}>Stock challenge · equal build</label><label><input id="trial-ghost" type="checkbox" ${preferences.controls.showGhost?'checked':''}>Race my personal-best ghost</label><p>Stock challenges use standard upgrades and the balanced setup. Records are separated by car, circuit, build and handling version. Previous-version times are preserved in your saved data.</p>${challenge?`<p>Friend’s local target: <strong>${format(challenge.time)}</strong>. Shared times are not verified online rankings.</p>`:''}`;$('dialog-content').append(panel);
 $('trial-stock').onchange=e=>{preferences.controls.stockTrial=e.target.checked;saveChoices();records=loadRecords(recordStore);race=newRace();updateMenu();};
 $('trial-ghost').onchange=e=>{preferences.controls.showGhost=e.target.checked;saveChoices();};
}
function renderLesson(){
 let panel=$('skill-coach');if(!panel){panel=document.createElement('section');panel.id='skill-coach';panel.className='skill-coach';panel.setAttribute('aria-label','Driving school');panel.hidden=true;document.body.append(panel);}
 if(!school?.lesson){panel.hidden=true;return;}
 const lesson=school.lesson;panel.hidden=false;panel.innerHTML=`<small>DRIVING SCHOOL · ${school.index+1} / ${LESSONS.length}</small><strong>${lesson.title}</strong><p>${lesson.text}</p><div class="coach-actions"><button type="button" id="school-skip">SKIP LESSON</button><button type="button" id="school-exit">END PRACTICE</button></div>`;
 $('race-feedback-live').textContent=lesson.title+'. '+lesson.text;
 $('school-skip').onclick=()=>{school.skip();renderLesson();if(!school.active)finishSchool();else renderer.domElement.focus({preventScroll:true});};
 $('school-exit').onclick=()=>finishSchool();
}
function finishSchool(){
 if(!school)return;const completed=!school.active&&school.skipped===0,learned=Math.max(0,school.index-school.skipped);saveSchool(localStore(),completed);event('tutorial_complete',{step:learned});school=null;renderLesson();clearInput();mode='paused';updateTouchControls();effects.clear();
 dialog({kind:'school-result',eyebrow:'YOUR NEXT CORNER IS WAITING',title:completed?'Skills <em>unlocked.</em>':'Keep finding <em>your line.</em>',html:`<p>${learned} of ${LESSONS.length} skills demonstrated. Practice does not change credits, records or campaign progress. Return whenever you want to sharpen your timing.</p>`,actions:[{label:'START MY RACE',primary:true,action:()=>start({introAccepted:true})},{label:'PRACTISE AGAIN',action:()=>start({practice:true,introAccepted:true})},{label:'HOME',action:menu}]});
}
function showShareResult(reward){
 const stock=stockTrial()&&race.mode==='time-attack';
 const url=stock?challengeURL({track:race.track,vehicle:race.vehicle,time:race.elapsed}):location.origin+circuitPath(race.track);
 const card=makeResultCard({car:getVehicle(race.vehicle).name,track:TRACK.name,time:format(race.elapsed),position:race.position,stock,credits:reward.credits});
 dialog({kind:'share',eyebrow:stock?'SAME CAR. SAME RULES.':'A FINISH WORTH SHARING',title:stock?'Beat my <em>time.</em>':'Your race <em>receipt.</em>',html:'<div id="share-preview"></div><p>Local race result. Challenge links use stock cars and the same handling version; they are not an online leaderboard.</p><label class="backup-details">Race link<input id="share-url" readonly style="display:block;width:100%;min-height:44px"></label><p id="share-status" role="status"></p>',actions:[{label:'DOWNLOAD CARD',primary:true,action:()=>{card.toBlob(blob=>{if(!blob)return;downloadBlob(blob,'camber-reign-result.png');event('challenge_share',{action:'download'});},'image/png');}},{label:'COPY LINK',action:async()=>{try{await navigator.clipboard.writeText(url);$('share-status').textContent='Link copied.';event('challenge_share',{action:'copy'});}catch{$('share-url').focus();$('share-url').select();$('share-status').textContent='Select and copy the link above.';}}},{label:'BACK TO RESULT',action:()=>{dialog(lastResultDialog);updateFinish();}}]});
 card.className='share-result-preview';$('share-preview').append(card);$('share-url').value=url;
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function backupSummary(summary){return `${summary.credits.toLocaleString()} credits · ${summary.campaignEvents} career events · ${summary.records} record sets · ${summary.circuitSetups} circuit setups`;}
function saveSnapshot(){return exportSaveBackup({storage:localStore(),states:{preferences,progression,paint:paintChoices,favorites:[...favoriteCars],career,campaign,mastery,setups:carSetups}});}
function showSaveBackup(){
 dialog({kind:'backup',eyebrow:'YOUR PROGRESS. YOUR FILE.',title:'Take your <em>progress.</em>',html:'<p>Download your credits, upgrades, career, tours, mastery, setups, paint, favourites, controls and saved runs. Transfer the file to another device, then restore it here. No account required.</p><button class="button primary" id="backup-download">'+icon('download')+'<span>DOWNLOAD BACKUP</span></button><p id="backup-status" role="status"></p><label class="backup-details">Restore a Camber Reign backup<input id="backup-file" class="race-backup-input" type="file" accept=".json,application/json"></label><p class="backup-details">Restoring replaces this browser’s progress and ends an unfinished race. Your analytics choice stays unchanged. Keep a current backup first.</p>',actions:[{label:'BACK',action:()=>mode==='paused'?pauseSettingsReturn():closeDialog()}]});
 $('backup-download').onclick=()=>{const result=saveSnapshot();if(!result.ok){$('backup-status').textContent=result.error;return;}downloadBlob(new Blob([result.json],{type:'application/json'}),result.filename);$('backup-status').textContent='Backup prepared: '+backupSummary(result.summary);};
 $('backup-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>32000000){$('backup-status').textContent='Choose a save file smaller than 32 MB.';return;}let raw;try{raw=await file.text();}catch{$('backup-status').textContent='This file could not be read.';return;}const result=inspectSaveBackup(raw);if(!result.ok){$('backup-status').textContent=result.error;return;}
 dialog({kind:'backup-confirm',eyebrow:'REPLACE SAVED PROGRESS',title:'Restore this <em>backup?</em>',html:'<p>'+backupSummary(result.summary)+'</p><p>This replaces current progress on this device and reloads the game. Your analytics choice is kept.</p><p id="backup-status" role="status"></p>',actions:[{label:'RESTORE & RELOAD',primary:true,action:()=>{const restored=importSaveBackup(raw,{storage:localStore()});if(restored.ok){location.assign(circuitPath(restored.states.preferences.track));return;}$('backup-status').textContent=restored.error;if(restored.recoveryRequired){showRecoveryDialog();}}},{label:'KEEP CURRENT PROGRESS',action:showSaveBackup}]});};
}
function pauseSettingsReturn(){modalKind='';mode=pauseResumeMode;pauseGame();}
function showRecoveryDialog(){clearInput();mode='paused';updateTouchControls();dialog({kind:'recovery',eyebrow:'SAVE RECOVERY',title:'Protect your <em>progress.</em>',html:'<p>An interrupted restore needs recovery before you continue. Your previous save snapshot is retained.</p><p id="recovery-status" role="status"></p>',actions:[{label:'RETRY RECOVERY',primary:true,action:()=>{const result=recoverSaveImport({storage:localStore()});if(result.ok)location.reload();else $('recovery-status').textContent=result.error;}},{label:'DOWNLOAD PREVIOUS SAVE',action:()=>{const result=exportRecoveryBackup({storage:localStore()});if(result.ok)downloadBlob(new Blob([result.json],{type:'application/json'}),result.filename);else $('recovery-status').textContent=result.error;}}]});}
function showStartupRecovery(){const overlay=document.createElement('section');overlay.className='startup-recovery';overlay.setAttribute('role','alert');overlay.innerHTML='<h1>Recover your saved progress.</h1><p>An interrupted restore needs recovery before the game can load.</p><button id="startup-retry">RETRY RECOVERY</button><button id="startup-export">DOWNLOAD PREVIOUS SAVE</button><p id="startup-status"></p>';document.body.append(overlay);$('startup-retry').onclick=()=>{const result=recoverSaveImport({storage:localStore()});if(result.ok)location.reload();else $('startup-status').textContent=result.error;};$('startup-export').onclick=()=>{const result=exportRecoveryBackup({storage:localStore()});if(result.ok)downloadBlob(new Blob([result.json],{type:'application/json'}),result.filename);else $('startup-status').textContent=result.error;};$('startup-retry').focus();}

const ghostBadge=document.createElement('div');ghostBadge.id='ghost-split';ghostBadge.className='ghost-split';ghostBadge.hidden=true;document.body.append(ghostBadge);
const practiceButton=document.createElement('button');practiceButton.className='lobby-practice';practiceButton.type='button';practiceButton.textContent='Driving school · learn by doing';practiceButton.onclick=()=>start({practice:true,introAccepted:true});$('start').after(practiceButton);
const nextGoalButton=document.createElement('button');nextGoalButton.id='next-driver-goal';nextGoalButton.className='next-driver-goal';nextGoalButton.type='button';$('lobby-mode-description').after(nextGoalButton);
updateRaceOptions();

if (import.meta.env.DEV) {
  window.__blacktopBayQA = Object.freeze({
    snapshot: () => ({
      mode, quality:{...adaptiveQuality.status,settings:adaptiveQuality.settings},renderer:renderer?{...renderer.info.render,memory:{...renderer.info.memory}}:null,school:school?{index:school.index,active:school.active}:null,controls:structuredClone(preferences.controls),ghostVisible:ghostModel?.group.visible||false,
      raceId:race.raceId, wreck:race.wreck ? structuredClone(race.wreck) : null, air:race.air ? structuredClone(race.air) : null, pickupEvent:race.pickupEvent ? structuredClone(race.pickupEvent) : null,
      input: {...input, steer: analogSteering, steeringMode},
      car: { ...race.car },
      elapsed: race.elapsed,
      impact: {...race.impact},
      recovery: {...race.recovery},
      nitro: { ...race.nitro },
      position: race.position,
      track: race.track,
      vehicle: race.vehicle,
      setup:race.setup, campaignEventId:race.campaignEventId,
      rivals: race.rivals.map((r) => ({
        id: r.id,
        car: { ...r.car },
        finishTime: r.finishTime,
      })),
      leaderboard: race.leaderboard,
      score: race.score + race.driftPoints,
      effects: effects?.stats,
      damage: player?.group.userData.damage ? {...player.group.userData.damage} : null,
      camera: camera
        ? { x: camera.position.x, z: camera.position.z, heading: cameraHeading }
        : null,
    }),
  });
}
if (import.meta.env.PROD) registerPWA();
initGame();
