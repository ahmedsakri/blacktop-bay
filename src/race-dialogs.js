import { getVehicle } from './vehicles.js';
import { getTrack } from './track.js';
import { icon } from './icons.js';

// Presentation only. Race state, record persistence and reward transactions stay
// with their existing owners; rendering a panel never earns or spends credits.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
const number = value => count(value).toLocaleString('en-US');
const lapCount = race => Math.max(1, count(race?.totalLaps) || 3);
const fieldSize = race => Math.max(1, race?.leaderboard?.length || (race?.rivals?.length ?? 3) + 1);
const circuit = (race, track) => track || getTrack(race?.track);
const icons = Object.freeze({ steer: icon('steering'), drift: icon('drift'), nitro: icon('nitro'), flag: icon('flag'), trophy: icon('trophy'), rotate: icon('phone') });

export function formatRaceTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const centiseconds = Math.round(seconds * 100);
  return `${String(Math.floor(centiseconds / 6000)).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}

export function pausePanel({ race, track, sound = false, fullscreen = false, countdown = false } = {}) {
  const car = getVehicle(race?.vehicle), venue = circuit(race, track), laps = lapCount(race);
  const currentLap = Math.min(laps, count(race?.completedLaps) + 1);
  return `<div class="rd-pause-panel">
    <div class="rd-session"><span class="rd-race-number" aria-hidden="true">${escape(car.number)}</span><div class="rd-session-car"><span class="rd-label">YOUR RACE BUILD</span><strong>${escape(car.name)}</strong><small>${escape(car.specs.body)}</small></div><div class="rd-session-track"><span class="rd-label">CIRCUIT</span><strong>${escape(venue.name)}</strong></div></div>
    <dl class="rd-pause-stats"><div><dt>POSITION</dt><dd>${count(race?.position) || 1}<small> / ${fieldSize(race)}</small></dd></div><div><dt>${countdown ? 'STARTING LAP' : 'CURRENT LAP'}</dt><dd>${currentLap}<small> / ${laps}</small></dd></div><div><dt>RACE TIME</dt><dd>${formatRaceTime(race?.elapsed ?? 0)}</dd></div></dl>
    <p class="rd-pause-note"><span class="rd-live-dot" aria-hidden="true"></span>${countdown ? 'The starting countdown is paused.' : 'Your position and race time are held.'} Resume when you’re ready.</p>
    <div class="rd-settings"><span class="rd-label">QUICK SETTINGS</span><div class="pause-settings"><button id="pause-sound" type="button" aria-pressed="${Boolean(sound)}">${icon(sound ? 'volume' : 'volume-off')}<span>Sound ${sound ? 'on' : 'off'}</span></button><button id="pause-fullscreen" type="button">${icon('fullscreen')}<span>${fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span></button></div></div>
    <p id="pause-screen-status" class="rd-setting-status" role="status" hidden></p>
  </div>`;
}

export function howToPlayPanel({ touch = false } = {}) {
  const cards = [
    { title: 'Find your line', icon: icons.steer, cue: touch ? 'DRAG LEFT / RIGHT' : 'ARROWS / A + D', text: touch ? 'Drag on the road to steer. Lift your finger to straighten up.' : 'Steer with the arrow keys or A / D. You can also drag on the road.' },
    { title: 'Let it slide', icon: icons.drift, cue: 'TURN AT SPEED', text: 'Turn sharply at speed to drift. Ease back into line to bank your points.' },
    { title: 'Make your move', icon: icons.nitro, cue: touch ? 'HOLD NITRO' : 'HOLD SHIFT', text: 'Boost on a clear straight. Release to recharge while driving and drifting.' },
  ];
  return `<div class="rd-how-panel">
    <div class="rd-drive-rule"><span class="rd-rule-icon" aria-hidden="true">${icon('arrow-up-right')}</span><div><strong>Automatic acceleration. You choose the line.</strong><p>${touch ? 'Nitro is your only driving button. Use your other thumb to steer.' : 'Focus on steering, drift and boost. The car accelerates for you.'}</p></div></div>
    <div class="rd-control-cards">${cards.map((card, i) => `<section class="rd-control-card"><span class="rd-control-icon">${card.icon}</span><span class="rd-control-step">0${i + 1}</span><h3>${card.title}</h3><strong class="rd-control-cue">${card.cue}</strong><p>${card.text}</p></section>`).join('')}</div>
    <div class="rd-how-details"><section><h3>${icons.flag}Three laps. Three rivals.</h3><p>Reach the finish first. Stay clear of barriers: a hit loses the drift points you haven’t banked.</p></section><section><h3>${icons.trophy}Race. Earn. Improve.</h3><p>Finish races to earn credits. Fit upgrades in Garage / Performance. Best times are saved for each car and circuit on this device.</p></section></div>
    <div class="rd-phone-note">${icons.rotate}<p><strong>On a phone, turn to landscape.</strong> Turning upright pauses the race. Drag to steer and hold Nitro to boost.</p></div>
    <div class="rd-keyboard"><span class="rd-label">KEYBOARD SHORTCUTS</span><dl><div><dt>Steer</dt><dd><kbd aria-label="Left arrow">${icon('arrow-left')}</kbd><kbd aria-label="Right arrow">${icon('arrow-right')}</kbd><span>or</span><kbd>A</kbd><kbd>D</kbd></dd></div><div><dt>Boost</dt><dd><kbd>Shift</kbd></dd></div><div><dt>Brake</dt><dd><kbd aria-label="Down arrow"><span class="rd-down-key">${icon('chevron-down')}</span></kbd><span>or</span><kbd>S</kbd></dd></div><div><dt>Handbrake</dt><dd><kbd>Space</kbd></dd></div><div><dt>Reset</dt><dd><kbd>R</kbd></dd></div><div><dt>Pause</dt><dd><kbd>Esc</kbd></dd></div></dl></div>
  </div>`;
}

export function finishRowsMarkup(race) {
  return (race?.leaderboard || []).map(row => {
    const car = getVehicle(row.vehicle), finished = row.finished && Number.isFinite(row.finishTime) && row.finishTime > 0;
    const position = count(row.position) || 1, lap = Math.min(lapCount(race), count(row.completedLaps) + 1);
    return `<li class="rd-order-row${row.isPlayer ? ' rd-you' : ''}"><span class="rd-order-position">${position}</span><div class="rd-driver"><strong>${row.isPlayer ? 'YOU' : escape(row.name)}${row.isPlayer ? '<span class="rd-you-tag">YOUR RESULT</span>' : ''}</strong><small>${escape(car.name)}</small></div><span class="rd-order-time${finished ? '' : ' rd-still-racing'}">${finished ? `<time>${formatRaceTime(row.finishTime)}</time>` : `LAP ${lap} / ${lapCount(race)}`}<small>${finished ? 'FINISHED' : 'RACING'}</small></span></li>`;
  }).join('');
}

export function finishStatusText(race) {
  return race?.allFinished
    ? `All ${fieldSize(race)} drivers classified. Ready for another run?`
    : 'Rivals still on track. Their times update as they finish.';
}

export function finishPanel({ race, track, isBest = false, previousBest = null, bestTime = null, reward = null, credits = 0 } = {}) {
  const car = getVehicle(race?.vehicle), venue = circuit(race, track), position = count(race?.position) || 1;
  const suffix = position === 1 ? 'ST' : position === 2 ? 'ND' : position === 3 ? 'RD' : 'TH';
  const earned = reward?.awarded === true ? count(reward.credits) : 0;
  const improvement = isBest && Number.isFinite(previousBest) && Number.isFinite(race?.elapsed) && previousBest > race.elapsed ? previousBest - race.elapsed : null;
  const bestLabel = isBest ? improvement === null ? 'First benchmark set' : `${improvement.toFixed(2)} sec quicker than your previous best` : 'For this car and circuit';
  const record = Number.isFinite(bestTime) && bestTime > 0 ? bestTime : isBest ? race?.elapsed : null;
  return `<div class="rd-results-panel${position === 1 ? ' rd-winner' : ''}">
    <div class="rd-result-context"><span>${escape(car.name)}</span><span>${escape(venue.name)} <i aria-hidden="true">·</i> ${lapCount(race)} LAPS</span></div>
    <div class="rd-result-hero"><div class="rd-classification"><span class="rd-rank"><b>${position}</b><span>${suffix}<small> / ${fieldSize(race)}</small></span></span><strong>${position === 1 ? 'RACE WINNER' : position <= 3 ? 'PODIUM FINISH' : 'RACE COMPLETE'}</strong></div><div class="rd-result-time"><span class="rd-label">YOUR RACE TIME</span><strong>${formatRaceTime(race?.elapsed)}</strong>${isBest ? '<span class="rd-best-badge">NEW PERSONAL BEST</span>' : '<span class="rd-time-caption">THREE LAPS. ALL YOURS.</span>'}</div><span class="rd-result-flag" aria-hidden="true">${icons.flag}</span></div>
    <div class="rd-results-grid"><section class="rd-classification-section" aria-labelledby="rd-classification-heading"><div class="rd-section-heading"><h3 id="rd-classification-heading">FINAL ORDER</h3><span>RACE TIME</span></div><ol id="finish-order" class="rd-finish-order">${finishRowsMarkup(race)}</ol><p id="finish-status" class="rd-finish-status">${finishStatusText(race)}</p></section>
      <div class="rd-result-insights"><section class="rd-record-card${isBest ? ' rd-new-record' : ''}"><span class="rd-label">${isBest ? 'PERSONAL BEST' : 'YOUR PERSONAL BEST'}</span><strong>${formatRaceTime(record)}</strong><p>${bestLabel}</p></section><dl class="rd-finish-stats"><div><dt>BEST LAP</dt><dd>${formatRaceTime(race?.bestLap)}</dd></div><div><dt>DRIFT POINTS</dt><dd>${number(race?.score)}</dd></div><div><dt>ROAD RESETS</dt><dd>${number(race?.recoveries)}</dd></div></dl></div>
    </div>
    <div class="rd-reward"><div class="rd-reward-earned"><span class="rd-label">RACE CREDITS EARNED</span><strong>+${number(earned)} <small>CR</small></strong><span>${reward?.awarded === true ? 'Ready for your next upgrade' : 'No new credits awarded'}</span></div><div class="rd-reward-wallet"><span class="rd-label">AVAILABLE IN WORKSHOP</span><strong>${number(credits)} <small>CR</small></strong><span>Garage / Performance</span></div></div>
    ${reward?.awarded && reward.persisted === false ? '<p class="rd-save-note" role="status">Credits are available for this session. Your browser could not save them for next time.</p>' : ''}
  </div>`;
}
