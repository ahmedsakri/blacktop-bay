import { getVehicle } from './vehicles.js';
import { getTrack } from './track.js';
import { icon } from './icons.js';
import { CONTROL_DEFAULTS, normalizePlayerControls, actionForKey, keyLabel } from './player-controls.js';

// Presentation only. Race state, record persistence and reward transactions stay
// with their existing owners; rendering a panel never earns or spends credits.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
const number = value => count(value).toLocaleString('en-US');
const lapCount = race => Math.max(1, count(race?.totalLaps) || 3);
const fieldSize = race => Math.max(1, race?.leaderboard?.length || (race?.rivals?.length ?? 7) + 1);
const isSolo = race => race?.mode === 'time-attack';
const circuit = (race, track) => track || getTrack(race?.track);
const icons = Object.freeze({ steer: icon('steering'), drift: icon('drift'), nitro: icon('nitro'), flag: icon('flag'), trophy: icon('trophy'), rotate: icon('phone') });

export function formatRaceTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const centiseconds = Math.round(seconds * 100);
  return `${String(Math.floor(centiseconds / 6000)).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}

export function pausePanel({ race, track, sound = false, fullscreen = false, screenLabel = null, countdown = false } = {}) {
  const car = getVehicle(race?.vehicle), venue = circuit(race, track), laps = lapCount(race), solo = isSolo(race);
  const currentLap = Math.min(laps, count(race?.completedLaps) + 1);
  return `<div class="rd-pause-panel">
    <div class="rd-session"><span class="rd-race-number" aria-hidden="true">${escape(car.number)}</span><div class="rd-session-car"><span class="rd-label">YOUR RACE BUILD</span><strong>${escape(car.name)}</strong><small>${escape(car.specs.body)}</small></div><div class="rd-session-track"><span class="rd-label">CIRCUIT</span><strong>${escape(venue.name)}</strong></div></div>
    <dl class="rd-pause-stats"><div><dt>${solo ? 'TIME ATTACK' : 'POSITION'}</dt><dd>${solo ? 'SOLO' : `${count(race?.position) || 1}<small> / ${fieldSize(race)}</small>`}</dd></div><div><dt>${countdown ? 'STARTING LAP' : 'CURRENT LAP'}</dt><dd>${currentLap}<small> / ${laps}</small></dd></div><div><dt>${solo ? 'RUN TIME' : 'RACE TIME'}</dt><dd>${formatRaceTime(race?.elapsed ?? 0)}</dd></div></dl>
    <p class="rd-pause-note"><span class="rd-live-dot" aria-hidden="true"></span>${countdown ? 'The starting countdown is paused.' : solo ? 'Your lap progress and run time are held.' : 'Your position and race time are held.'} Resume when you’re ready.</p>
    <div class="rd-settings"><span class="rd-label">QUICK SETTINGS</span><div class="pause-settings"><button id="pause-sound" type="button" aria-pressed="${Boolean(sound)}">${icon(sound ? 'volume' : 'volume-off')}<span>Sound ${sound ? 'on' : 'off'}</span></button><button id="pause-fullscreen" type="button">${icon('fullscreen')}<span>${escape(screenLabel || (fullscreen ? 'Exit fullscreen' : 'Fullscreen'))}</span></button></div></div>
    <p id="pause-screen-status" class="rd-setting-status" role="status" hidden></p>
    <div id="pause-screen-help" hidden></div>
  </div>`;
}

export function howToPlayPanel({ touch = false, controls } = {}) {
  const settings = normalizePlayerControls(controls), bindings = settings.bindings;
  const aliases = {left: ['KeyA'], right: ['KeyD'], brake: ['KeyS'], nitro: ['ShiftRight'], pause: ['KeyP']};
  const activeKeys = action => [bindings[action], ...(aliases[action] || []).filter(code => code !== bindings[action] && actionForKey(code, settings) === action)];
  const readableKey = code => code.startsWith('Arrow') ? `${keyLabel(code)} arrow` : keyLabel(code);
  const keyText = action => activeKeys(action).map(readableKey).join(' / ');
  const arrows = bindings.left === CONTROL_DEFAULTS.left && bindings.right === CONTROL_DEFAULTS.right;
  const defaultSteering = arrows && actionForKey('KeyA', settings) === 'left' && actionForKey('KeyD', settings) === 'right';
  const nitroKey = activeKeys('nitro').includes('ShiftLeft') && activeKeys('nitro').includes('ShiftRight') ? 'Shift' : keyLabel(bindings.nitro);
  const boostCue = `${settings.nitroToggle ? 'TAP' : 'HOLD'} ${touch ? 'NITRO' : nitroKey.toUpperCase()}`;
  const boostText = settings.nitroToggle ? 'Tap to start Nitro on a clear straight. Tap again to stop and recharge while driving and drifting.' : 'Boost on a clear straight. Release to recharge while driving and drifting.';
  const phoneBoost = settings.nitroToggle ? 'tap Nitro on and off' : 'hold Nitro to boost';
  const keyMarkup = code => {
    const glyph = {'ArrowLeft': 'arrow-left', 'ArrowRight': 'arrow-right', 'ArrowDown': 'chevron-down'}[code];
    return `<kbd aria-label="${escape(readableKey(code))}">${glyph ? icon(glyph) : escape(keyLabel(code))}</kbd>`;
  };
  const keyRow = action => activeKeys(action).map(keyMarkup).join('<span>or</span>');
  const cards = [
    { title: 'Find your line', icon: icons.steer, cue: touch ? 'HOLD / DRAG TO STEER' : defaultSteering ? 'ARROWS / A + D' : `${keyLabel(bindings.left)} / ${keyLabel(bindings.right)}`.toUpperCase(), text: touch ? 'Hold either side of the thumbpad or drag on the road. Lift to straighten. Optional tilt controls are below and in Pause.' : `Steer left with ${escape(keyText('left'))} and right with ${escape(keyText('right'))}. You can also drag on the road.` },
    { title: 'Let it slide', icon: icons.drift, cue: 'TURN AT SPEED', text: 'Turn sharply at speed to drift. Ease back into line to bank your points.' },
    { title: 'Make your move', icon: icons.nitro, cue: escape(boostCue), text: boostText },
  ];
  return `<div class="rd-how-panel">
    <div class="rd-drive-rule"><span class="rd-rule-icon" aria-hidden="true">${icon('arrow-up-right')}</span><div><strong>Automatic acceleration. You choose the line.</strong><p>${touch ? 'Nitro is your only driving button. Use your other thumb to steer.' : 'Focus on steering, drift and boost. The car accelerates for you.'}</p></div></div>
    <div class="rd-control-cards">${cards.map((card, i) => `<section class="rd-control-card"><span class="rd-control-icon">${card.icon}</span><span class="rd-control-step">0${i + 1}</span><h3>${card.title}</h3><strong class="rd-control-cue">${card.cue}</strong><p>${card.text}</p></section>`).join('')}</div>
    <div class="rd-how-details"><section><h3>${icons.flag}Three laps. Your challenge.</h3><p>Race seven rivals, chase a solo Time attack or enter a three-race tour. Stay clear of barriers: a hit loses the drift points you haven’t banked.</p></section><section><h3>${icons.trophy}Race. Earn. Improve.</h3><p>Finish runs to earn credits. Fit upgrades in Garage / Performance. Best times are saved by car, circuit, mode, build and handling version on this device. Rival races also separate difficulty.</p></section></div>
    <div class="rd-phone-note">${icons.rotate}<p><strong>On a phone, turn to landscape.</strong> Turning upright pauses the race. Drag to steer and ${phoneBoost}.</p></div>
    <div class="rd-keyboard"><span class="rd-label">YOUR KEYBOARD SHORTCUTS</span><dl><div><dt>Steer left / right</dt><dd>${keyRow('left')}<span>/</span>${keyRow('right')}</dd></div><div><dt>Boost · ${settings.nitroToggle ? 'tap on / off' : 'hold'}</dt><dd>${keyRow('nitro')}</dd></div><div><dt>Brake</dt><dd>${keyRow('brake')}</dd></div><div><dt>Handbrake</dt><dd>${keyRow('drift')}</dd></div><div><dt>Reset</dt><dd>${keyRow('reset')}</dd></div><div><dt>Pause</dt><dd>${keyRow('pause')}</dd></div></dl></div>
  </div>`;
}

export function finishRowsMarkup(race) {
  if (isSolo(race)) return '';
  return (race?.leaderboard || []).map(row => {
    const car = getVehicle(row.vehicle), finished = row.finished && Number.isFinite(row.finishTime) && row.finishTime > 0;
    const position = count(row.position) || 1, lap = Math.min(lapCount(race), count(row.completedLaps) + 1);
    return `<li class="rd-order-row${row.isPlayer ? ' rd-you' : ''}"><span class="rd-order-position">${position}</span><div class="rd-driver"><strong>${row.isPlayer ? 'YOU' : escape(row.name)}${row.isPlayer ? '<span class="rd-you-tag">YOUR RESULT</span>' : ''}</strong><small>${escape(car.name)}</small></div><span class="rd-order-time${finished ? '' : ' rd-still-racing'}">${finished ? `<time>${formatRaceTime(row.finishTime)}</time>` : `LAP ${lap} / ${lapCount(race)}`}<small>${finished ? 'FINISHED' : 'RACING'}</small></span></li>`;
  }).join('');
}

export function finishStatusText(race) {
  if (isSolo(race)) return race?.state === 'finished' ? 'Run complete. Chase your next personal best.' : 'Solo Time attack in progress.';
  return race?.allFinished
    ? `All ${fieldSize(race)} drivers classified. Ready for another run?`
    : 'Rivals still on track. Their times update as they finish.';
}

export function finishPanel({ race, track, isBest = false, previousBest = null, bestTime = null, reward = null, credits = 0 } = {}) {
  const car = getVehicle(race?.vehicle), venue = circuit(race, track), position = count(race?.position) || 1, solo = isSolo(race);
  const suffix = position === 1 ? 'ST' : position === 2 ? 'ND' : position === 3 ? 'RD' : 'TH';
  const earned = reward?.awarded === true ? count(reward.credits) : 0;
  const improvement = isBest && Number.isFinite(previousBest) && Number.isFinite(race?.elapsed) && previousBest > race.elapsed ? previousBest - race.elapsed : null;
  const bestLabel = isBest ? improvement === null ? 'First benchmark set' : `${improvement.toFixed(2)} sec quicker than your previous best` : 'Saved on this device';
  const recordScopeLabel = `For this car, circuit, ${solo ? '' : 'mode, difficulty, '}build and handling version`;
  const record = Number.isFinite(bestTime) && bestTime > 0 ? bestTime : isBest ? race?.elapsed : null;
  const classification = solo
    ? '<span class="rd-rank"><span>SOLO</span></span><strong>TIME ATTACK COMPLETE</strong>'
    : `<span class="rd-rank"><b>${position}</b><span>${suffix}<small> / ${fieldSize(race)}</small></span></span><strong>${position === 1 ? 'RACE WINNER' : position <= 3 ? 'PODIUM FINISH' : 'RACE COMPLETE'}</strong>`;
  const soloLaps = Array.from({length: lapCount(race)}, (_, index) => {
    const lap = race?.lapTimes?.[index], valid = Number.isFinite(lap) && lap > 0;
    return `<li class="rd-order-row"><span class="rd-order-position">${index + 1}</span><div class="rd-driver"><strong>LAP ${index + 1}</strong><small>${valid && lap === race?.bestLap ? 'BEST LAP' : 'LAP TIME'}</small></div><span class="rd-order-time"><time>${valid ? formatRaceTime(lap) : '—'}</time></span></li>`;
  }).join('');
  const order = solo
    ? `<section class="rd-classification-section" aria-labelledby="rd-classification-heading"><div class="rd-section-heading"><h3 id="rd-classification-heading">YOUR LAPS</h3><span>LAP TIME</span></div><ol class="rd-finish-order">${soloLaps}</ol><p class="rd-finish-status">${finishStatusText(race)}</p></section>`
    : `<section class="rd-classification-section" aria-labelledby="rd-classification-heading"><div class="rd-section-heading"><h3 id="rd-classification-heading">FINAL ORDER</h3><span>RACE TIME</span></div><ol id="finish-order" class="rd-finish-order">${finishRowsMarkup(race)}</ol><p id="finish-status" class="rd-finish-status">${finishStatusText(race)}</p></section>`;
  return `<div class="rd-results-panel${!solo && position === 1 ? ' rd-winner' : ''}">
    <div class="rd-result-context"><span>${escape(car.name)}</span><span>${escape(venue.name)} <i aria-hidden="true">·</i> ${lapCount(race)} LAPS</span></div>
    <div class="rd-result-hero"><div class="rd-classification">${classification}</div><div class="rd-result-time"><span class="rd-label">YOUR ${solo ? 'RUN' : 'RACE'} TIME</span><strong>${formatRaceTime(race?.elapsed)}</strong>${isBest ? '<span class="rd-best-badge">NEW PERSONAL BEST</span>' : '<span class="rd-time-caption">THREE LAPS. ALL YOURS.</span>'}</div><span class="rd-result-flag" aria-hidden="true">${icons.flag}</span></div>
    <div class="rd-results-grid">${order}
      <div class="rd-result-insights"><section class="rd-record-card${isBest ? ' rd-new-record' : ''}"><span class="rd-label">${isBest ? 'PERSONAL BEST' : 'YOUR PERSONAL BEST'}</span><strong>${formatRaceTime(record)}</strong><p>${bestLabel}</p><p class="rd-record-scope">${recordScopeLabel}</p></section><dl class="rd-finish-stats"><div><dt>BEST LAP</dt><dd>${formatRaceTime(race?.bestLap)}</dd></div><div><dt>DRIFT POINTS</dt><dd>${number(race?.score)}</dd></div><div><dt>ROAD RESETS</dt><dd>${number(race?.recoveries)}</dd></div></dl></div>
    </div>
    <div class="rd-reward"><div class="rd-reward-earned"><span class="rd-label">RACE CREDITS EARNED</span><strong>+${number(earned)} <small>CR</small></strong><span>${reward?.awarded === true ? 'Ready for your next upgrade' : 'No new credits awarded'}</span></div><div class="rd-reward-wallet"><span class="rd-label">AVAILABLE IN WORKSHOP</span><strong>${number(credits)} <small>CR</small></strong><span>Garage / Performance</span></div></div>
    ${reward?.awarded && reward.persisted === false ? '<p class="rd-save-note" role="status">Credits are available for this session. Your browser could not save them for next time.</p>' : ''}
  </div>`;
}
