import { getCampaignEvent, canStartCampaignEvent } from './driver-campaign.js';

export const CAMPAIGN_INTENT_KEY = 'camber-reign-campaign-intent-v1';
const MAX_AGE = 30 * 60 * 1000;
function resolve(storage) { try { return storage === undefined ? globalThis.sessionStorage : storage; } catch { return null; } }

export function saveCampaignIntent(state, eventId, vehicle, storage, now = Date.now()) {
  const event = getCampaignEvent(eventId, vehicle);
  if (!event || !canStartCampaignEvent(state, eventId) || !Number.isFinite(now)) return false;
  try {
    const target = resolve(storage);
    if (typeof target?.setItem !== 'function') return false;
    target.setItem(CAMPAIGN_INTENT_KEY, JSON.stringify({ version: 1, eventId, vehicle, track: event.track, created: now }));
    return true;
  } catch { return false; }
}

// An intent selects an event after a full circuit-page load. It is never an
// instruction to begin driving. Consume once, and reject stale/mismatched URLs.
export function consumeCampaignIntent(state, routeTrack, storage, now = Date.now()) {
  try {
    const target = resolve(storage), raw = target?.getItem(CAMPAIGN_INTENT_KEY);
    if (raw == null) return null;
    target.removeItem(CAMPAIGN_INTENT_KEY);
    if (typeof raw !== 'string' || raw.length > 2000) return null;
    const value = JSON.parse(raw), event = getCampaignEvent(value?.eventId, value?.vehicle);
    if (value?.version !== 1 || !event || !canStartCampaignEvent(state, event.id)
      || value.track !== event.track || routeTrack !== event.track
      || !Number.isFinite(now) || !Number.isFinite(value.created) || now < value.created || now - value.created > MAX_AGE) return null;
    return event;
  } catch { return null; }
}
