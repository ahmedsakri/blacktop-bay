import { icon } from './icons.js';
import { getVehicle, DEFAULT_VEHICLE_ID } from './vehicles.js';
import { DIFFICULTIES } from './race-options.js';
import { CAMPAIGN_CHAPTERS, CAMPAIGN_EVENTS, normalizeCampaign, getCampaignEvent, getNextCampaignEvent,
  canStartCampaignEvent, isCampaignEventComplete } from './driver-campaign.js';
import { CAR_SETUPS, getCarSetup, applyCarSetup } from './car-setups.js';
import { getCarMastery } from './car-mastery.js';

const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const objectivesMarkup = (event, earned = []) => `<ul class="development-objectives">${event.objectives.map(goal => `<li class="${earned.includes(goal.id) ? 'is-earned' : ''}"><span class="development-goal-mark">${icon(earned.includes(goal.id) ? 'check' : 'flag')}</span><span><b>${goal.required ? 'TO ADVANCE' : 'BONUS OBJECTIVE'}</b>${esc(goal.label)}</span>${earned.includes(goal.id) ? '<span class="development-earned">EARNED</span>' : ''}</li>`).join('')}</ul>`;

export function campaignPanel(value, { vehicle = DEFAULT_VEHICLE_ID, selectedEventId = null } = {}) {
  const state = normalizeCampaign(value), selected = canStartCampaignEvent(state,selectedEventId) ? getCampaignEvent(selectedEventId,vehicle) : null;
  const next = selected || getNextCampaignEvent(state, vehicle);
  const complete = CAMPAIGN_EVENTS.filter(event => isCampaignEventComplete(state, event.id)).length;
  const earned = Object.values(state.events).reduce((sum, record) => sum + record.objectives.length, 0);
  return `<div class="driver-development campaign-panel"><header class="development-intro"><span class="development-kicker">DRIVER CAMPAIGN</span><h2>Earn your <em>reign.</em></h2><p>Twelve authored events. Four chapters. Race with any car in your collection.</p><div class="development-summary"><span><strong>${complete}<small> / 12</small></strong> EVENTS COMPLETE</span><span><strong>${earned}<small> / 36</small></strong> OBJECTIVES EARNED</span></div></header>
    ${next ? `<section class="campaign-recommendation" aria-labelledby="campaign-next-title"><div><span class="development-kicker">${selected ? 'YOUR SELECTED EVENT' : 'YOUR NEXT EVENT'}</span><h3 id="campaign-next-title">${esc(next.name)}</h3><p>${esc(next.trackName)} · ${next.mode === 'time-attack' ? 'Solo time attack' : `${DIFFICULTIES.find(item => item.id === next.difficulty).label} · Eight-car race`}</p><p>${esc(next.description)}</p><strong class="development-car-name">${esc(next.carName)}</strong></div><div>${objectivesMarkup(next, state.events[next.id]?.objectives)}<button type="button" class="button primary" data-campaign-start="${next.id}">${icon('flag')} START EVENT</button></div></section>` : '<section class="campaign-recommendation campaign-complete"><div><span class="development-kicker">ALL FOUR CHAPTERS COMPLETE</span><h3>You earned your reign.</h3><p>Replay an event below to collect unfinished bonus objectives, or take another car through the campaign.</p></div></section>'}
    <p class="development-note">Complete the first objective to unlock the next event. Bonuses can be earned on repeat visits. Normal race credits apply; objectives do not award extra currency. Time targets follow your selected car at its stock tune.</p>
    <div class="campaign-chapters">${CAMPAIGN_CHAPTERS.map((chapter, index) => {
      const chapterComplete = chapter.events.filter(event => isCampaignEventComplete(state, event.id)).length;
      const currentChapter = chapter.events.some(event => event.id === next?.id);
      return `<details class="campaign-chapter" ${currentChapter ? 'open' : ''}><summary><span class="campaign-chapter-number">0${index + 1}</span><span><strong>${esc(chapter.name)}</strong><small>${chapterComplete} / 3 events complete</small></span>${icon('chevron-down')}</summary><div class="campaign-chapter-body"><p>${esc(chapter.description)}</p><div class="campaign-event-list">${chapter.events.map(item => {
        const event = getCampaignEvent(item.id, vehicle), unlocked = canStartCampaignEvent(state, item.id), done = isCampaignEventComplete(state, item.id);
        return `<article class="campaign-event ${done ? 'is-complete' : ''}"><div class="campaign-event-heading"><span class="development-kicker">${done ? 'EVENT COMPLETE' : unlocked ? 'READY TO RACE' : 'COMPLETE EARLIER EVENTS'}</span><h4>${esc(event.name)}</h4><p>${esc(event.trackName)} · ${event.mode === 'time-attack' ? 'Solo' : DIFFICULTIES.find(difficulty => difficulty.id === event.difficulty).label}</p></div>${objectivesMarkup(event, state.events[event.id]?.objectives)}<button class="button secondary" type="button" data-campaign-start="${event.id}" ${unlocked ? '' : 'disabled'} aria-label="${esc(`${done ? 'Replay' : 'Start'} ${event.name}`)}">${icon('flag')} ${done ? 'REPLAY EVENT' : unlocked ? 'START EVENT' : 'LOCKED'}</button></article>`;
      }).join('')}</div></div></details>`;
    }).join('')}</div><p class="development-note">Saved on this browser. Your existing cars, credits and upgrades remain available.</p></div>`;
}

export function carDevelopmentPanel({ vehicle = DEFAULT_VEHICLE_ID, baseSpecs, setupState, masteryState } = {}) {
  const selected = getCarSetup(setupState, vehicle), mastery = getCarMastery(masteryState, vehicle);
  const specs = applyCarSetup(baseSpecs, selected), selectedSetup = CAR_SETUPS.find(item => item.id === selected);
  const number = value => Number.isFinite(value) ? value.toFixed(1) : '—';
  return `<div class="driver-development car-development"><header class="development-intro"><span class="development-kicker">CAR SETUP & MASTERY</span><h2>Find your <em>balance.</em></h2><p>${esc(getVehicle(vehicle).name)} · Free setup changes. Existing upgrades stay fitted.</p></header><section aria-labelledby="car-setup-heading"><div class="development-section-heading"><h3 id="car-setup-heading">Choose your setup</h3><span>SELECTED · ${esc(selectedSetup.name)}</span></div><div class="car-setup-options" role="group" aria-label="Car handling and performance setup">${CAR_SETUPS.map(setup => `<button type="button" class="car-setup-option" data-car-setup="${setup.id}" aria-pressed="${selected === setup.id}"><span class="car-setup-title">${icon(setup.id === 'grip' ? 'steering' : setup.id === 'endurance' ? 'nitro' : 'speedometer')}<strong>${esc(setup.name)}</strong><span>${selected === setup.id ? 'FITTED' : 'SELECT'}</span></span><span class="car-setup-focus">${esc(setup.focus)}</span><span class="car-setup-advantage">${esc(setup.advantage)}</span><span class="car-setup-tradeoff">${esc(setup.tradeoff)}</span></button>`).join('')}</div><dl class="development-specs"><div><dt>TOP SPEED</dt><dd>${number(specs.topSpeed * 3.6)}<small> KM/H</small></dd></div><div><dt>ACCELERATION</dt><dd>${number(specs.acceleration)}<small> M/S²</small></dd></div><div><dt>GRIP</dt><dd>${number(specs.grip)}<small> M/S²</small></dd></div><div><dt>NITRO RESERVE</dt><dd>${number(specs.nitroCapacity)}<small> S</small></dd></div></dl><p class="development-note">Values include your fitted upgrades and selected setup. Top speed is the theoretical unboosted limit; corners, gradients and collisions change your actual pace. Nitro reserve is measured at normal boost; Perfect Nitro and Burst change its duration.</p></section><section aria-labelledby="car-mastery-heading"><div class="development-section-heading"><h3 id="car-mastery-heading">${esc(mastery.tier)}</h3><span>${mastery.complete} / ${mastery.total} MASTERY GOALS</span></div><p class="development-note">Earn mastery in this car through completed races and solo runs. Mastery records your driving; it does not secretly increase performance.</p><ul class="car-mastery-goals">${mastery.goals.map(goal => `<li class="${goal.complete ? 'is-earned' : ''}"><span class="mastery-goal-icon">${icon(goal.complete ? 'check' : 'trophy')}</span><div><strong>${esc(goal.label)}</strong><p>${esc(goal.description)}</p><progress max="${goal.target}" value="${Math.min(goal.current, goal.target)}" aria-label="${esc(goal.label)}"></progress></div><span class="mastery-goal-count">${goal.complete ? 'EARNED' : `${Math.min(goal.current, goal.target).toLocaleString('en-US')} / ${goal.target.toLocaleString('en-US')}`}</span></li>`).join('')}</ul></section><p class="development-note" data-development-save-status role="status">Setup and mastery are saved on this browser.</p></div>`;
}

export function developmentResultMarkup(campaign, mastery, { campaignSaved = true, masterySaved = true } = {}) {
  if (!campaign?.recorded && !mastery?.newlyEarned?.length && (!mastery?.recorded || masterySaved)) return '';
  return `<section class="driver-development development-result"><h3>${icon('trophy')} DRIVER PROGRESS</h3>${campaign?.recorded ? `<p><strong>${esc(campaign.event.name)}</strong> · ${campaign.firstCompletion ? (campaign.next ? 'Event complete. Next event unlocked.' : 'Event complete. All four chapters finished.') : campaign.completed ? 'Event replay recorded.' : 'Keep chasing the first objective to advance.'}</p>${campaign.newlyEarned.length ? `<ul>${campaign.newlyEarned.map(goal => `<li>${esc(goal.label)} · EARNED</li>`).join('')}</ul>` : '<p>No new campaign objectives this run.</p>'}` : ''}${mastery?.newlyEarned?.length ? `<p><strong>${esc(mastery.mastery.tier)}</strong></p><ul>${mastery.newlyEarned.map(goal => `<li>${esc(goal.label)} · MASTERY EARNED</li>`).join('')}</ul>` : ''}${!campaignSaved || !masterySaved ? '<p role="status">Progress is kept for this session. Browser storage is unavailable.</p>' : ''}</section>`;
}

// These views dispatch intent only. The caller persists the returned reducer
// state and calls update after success (or keeps session state on save failure).
// Remounting removes the previous listener so modal reuse cannot double-launch.
const mountedViews = new WeakMap();
function mountView(container, render, options, handler) {
  mountedViews.get(container)?.destroy();
  let current = options;
  const listener = event => {
    const button = event.target.closest?.('button');
    if (button && container.contains(button) && !button.disabled) handler(button, current);
  };
  const api = {
    update(next) {
      const active = container.ownerDocument?.activeElement;
      const focusKey = active && container.contains(active) ? active.dataset?.carSetup : null;
      current = { ...current, ...next }; container.innerHTML = render(current);
      if (focusKey) container.querySelector(`[data-car-setup="${focusKey}"]`)?.focus({ preventScroll: true });
    },
    destroy() { container.removeEventListener('click', listener); if (mountedViews.get(container) === api) mountedViews.delete(container); },
  };
  mountedViews.set(container, api); container.addEventListener('click', listener); api.update(options); return api;
}
export function mountCampaignPanel(container, options) {
  return mountView(container, current => campaignPanel(current.state, current), options, (button, current) => {
    const id = button.dataset.campaignStart;
    if (id && canStartCampaignEvent(current.state, id)) current.onStart?.(getCampaignEvent(id, current.vehicle));
  });
}
export function mountCarDevelopment(container, options) {
  return mountView(container, carDevelopmentPanel, options, (button, current) => {
    const id = button.dataset.carSetup;
    if (CAR_SETUPS.some(setup => setup.id === id)) current.onSelect?.(id);
  });
}
