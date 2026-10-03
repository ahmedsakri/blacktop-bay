import { CAMPAIGN_EVENTS, getCampaignEvent, normalizeCampaign } from './driver-campaign.js';
import { nextGoalSuggestion } from './driver-development-ui.js';
import { getDifficulty, normalizeRaceOptions } from './race-options.js';
import { TRACKS } from './track.js';
import { icon } from './icons.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const trackIds = new Set(TRACKS.map(track => track.id));

// These are stills of the actual runtime world, never a promised concept image.
export function circuitPreviewImage(track) {
  return trackIds.has(track?.id) ? `/assets/circuits/previews/${track.id}.webp?v=20261003-photo4` : null;
}

export function lobbyRaceLabels(options, event = null) {
  const { mode, difficulty } = normalizeRaceOptions(options);
  return {
    title: event ? event.name : mode === 'time-attack' ? 'Chase your best.' : mode === 'championship' ? 'Make every round count.' : 'Own the next corner.',
    settings: event ? `Event rules · ${mode === 'time-attack' ? 'Solo' : getDifficulty(difficulty).label}`
      : mode === 'time-attack' ? 'Solo · Targets & ghosts' : `Difficulty · ${getDifficulty(difficulty).label}`,
  };
}

export function lobbyGoal({ campaign, mastery, vehicle } = {}) {
  const suggestion = nextGoalSuggestion({ campaign, mastery, vehicle });
  if (suggestion.kind === 'campaign') {
    const event = getCampaignEvent(suggestion.eventId, vehicle);
    const state = normalizeCampaign(campaign), earned = state.events[event.id]?.objectives || [];
    const index = CAMPAIGN_EVENTS.findIndex(item => item.id === event.id);
    const next = CAMPAIGN_EVENTS[index + 1];
    return { ...suggestion, eyebrow: suggestion.bonus ? 'BONUS GOAL' : 'NEXT GOAL',
      progress: `${earned.length} / ${event.objectives.length} objectives earned`,
      reward: suggestion.bonus ? 'Earn this bonus objective' : next ? `Unlock: ${next.name}` : 'Complete the career path',
      action: 'View event', fraction: earned.length / event.objectives.length };
  }
  if (suggestion.kind === 'mastery') {
    return { ...suggestion, eyebrow: 'CAR MASTERY',
      progress: `${Math.min(suggestion.current, suggestion.target).toLocaleString('en-US')} / ${suggestion.target.toLocaleString('en-US')}`,
      reward: `Earn: ${suggestion.label}`, action: 'View mastery', fraction: Math.min(1, suggestion.current / suggestion.target) };
  }
  return { ...suggestion, eyebrow: 'YOUR NEXT DRIVE', progress: 'Career and car mastery complete',
    reward: 'Chase a faster personal best', action: 'Browse circuits', fraction: 1 };
}

export function lobbyGoalMarkup(goal) {
  return `<span class="lobby-goal-heading"><span><small>${escape(goal.eyebrow)}</small><strong>${escape(goal.label)}</strong></span>${icon('chevron-right')}</span>
    <span class="lobby-goal-objective">${escape(goal.description)}</span>
    <span class="lobby-goal-progress">${escape(goal.progress)}<span>${escape(goal.action)}</span></span>
    <span class="lobby-goal-meter" aria-hidden="true"><i style="width:${Math.min(100, Math.max(0, goal.fraction * 100))}%"></i></span>
    <span class="lobby-goal-reward">${icon('flag')}${escape(goal.reward)}</span>`;
}
