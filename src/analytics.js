import { VEHICLES } from './vehicles.js';
import { TRACKS } from './track.js';
import { RACE_MODES, DIFFICULTIES } from './race-options.js';
// One production-only GTM entry point. Advertising storage stays denied.
export const ANALYTICS_CONFIG = Object.freeze({
  measurementId: "G-RC925EV263",
  containerId: "GTM-PZHDLVK8",
});
export const ANALYTICS_EVENTS = Object.freeze([
  "race_start",
  "lap_complete",
  "race_complete",
  "race_pause",
  "race_resume",
  "car_reset",
  "car_select",
  "circuit_select",
  "garage_open",
  "nitro_use",
]);
const consentKey = "blacktop-bay-analytics-consent-v1";
let currentConsent = null,
  initialized = false,
  loaded = false;
export function sanitizeGameEvent(name, values = {}) {
  if (!ANALYTICS_EVENTS.includes(name)) return null;
  const result = { event: name, game_name: "Blacktop Bay" };
  if (TRACKS.some(track => track.id === values.circuit))
    result.circuit = values.circuit;
  if (VEHICLES.some(vehicle => vehicle.id === values.vehicle))
    result.vehicle = values.vehicle;
  if (RACE_MODES.some(mode => mode.id === values.race_mode)) result.race_mode = values.race_mode;
  if (DIFFICULTIES.some(difficulty => difficulty.id === values.difficulty)) result.difficulty = values.difficulty;
  const limits = {
    position: [1, 8],
    duration_seconds: [0, 3600],
    drift_score: [0, 1000000000],
    resets: [0, 10000],
    lap: [1, 3],
  };
  for (const [key, [min, max]] of Object.entries(limits)) {
    const value = values[key];
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max
    )
      result[key] = Math.round(value);
  }
  return result;
}
export function getAnalyticsConsent() {
  if (currentConsent) return currentConsent;
  try {
    const value = localStorage.getItem(consentKey);
    return value === "granted" || value === "denied" ? value : "unset";
  } catch {
    return "unset";
  }
}
function command() {
  window.dataLayer.push(arguments);
}
function production() {
  return location.hostname === "blacktop-bay.web.app";
}
function loadContainer() {
  if (
    loaded ||
    !production() ||
    getAnalyticsConsent() !== "granted" ||
    !/^GTM-[A-Z0-9]+$/.test(ANALYTICS_CONFIG.containerId)
  )
    return;
  loaded = true;
  window[`ga-disable-${ANALYTICS_CONFIG.measurementId}`] = false;
  let referrer = "";
  try {
    referrer = document.referrer ? new URL(document.referrer).origin : "";
  } catch {}
  window.dataLayer.push({
    analytics_consent: "granted",
    page_referrer: referrer,
    page_location: location.origin + location.pathname,
    page_title: "Blacktop Bay",
    game_name: "Blacktop Bay",
  });
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${ANALYTICS_CONFIG.containerId}`;
  script.id = "blacktop-gtm";
  document.head.append(script);
}
export function initializeAnalytics() {
  if (!initialized) {
    initialized = true;
    window.dataLayer = window.dataLayer || [];
    command("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    command("set", "ads_data_redaction", true);
    command("set", "url_passthrough", false);
  }
  if (getAnalyticsConsent() === "granted") {
    command("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    loadContainer();
  }
}
export function setAnalyticsConsent(allowed) {
  currentConsent = allowed ? "granted" : "denied";
  try {
    localStorage.setItem(consentKey, currentConsent);
  } catch {}
  initializeAnalytics();
  command("consent", "update", {
    analytics_storage: currentConsent,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window[`ga-disable-${ANALYTICS_CONFIG.measurementId}`] = !allowed;
  if (allowed) loadContainer();
  else {
    for (const part of document.cookie.split(";")) {
      const name = part.trim().split("=")[0];
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of [
        "",
        `; domain=${location.hostname}`,
        `; domain=.${location.hostname}`,
      ])
        document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`;
    }
  }
}
export function trackEvent(name, values = {}) {
  if (!production() || getAnalyticsConsent() !== "granted") return false;
  const event = sanitizeGameEvent(name, values);
  if (!event) return false;
  initializeAnalytics();
  // GTM version-2 variables merge state; clear optional values between events.
  window.dataLayer.push({
    circuit: undefined,
    vehicle: undefined,
    race_mode: undefined,
    difficulty: undefined,
    position: undefined,
    duration_seconds: undefined,
    drift_score: undefined,
    resets: undefined,
    lap: undefined,
  });
  window.dataLayer.push(event);
  return true;
}
