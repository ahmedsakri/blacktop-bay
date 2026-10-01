import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRaceTime, pausePanel, howToPlayPanel, finishPanel, finishRowsMarkup, finishStatusText,
} from '../src/race-dialogs.js';

const race = () => ({
  vehicle: 'porsche-930-turbo', track: 'coast', totalLaps: 3, completedLaps: 3,
  state: 'finished', elapsed: 145.23, bestLap: 46.15, score: 2180, recoveries: 2,
  position: 2, allFinished: false,
  leaderboard: [
    { position: 1, name: 'Rival One', vehicle: 'rimac-concept-one', finished: true, finishTime: 143.4, completedLaps: 3 },
    { position: 2, isPlayer: true, vehicle: 'porsche-930-turbo', finished: true, finishTime: 145.23, completedLaps: 3 },
    { position: 3, name: 'Rival Two', vehicle: 'lotus-elise', finished: false, finishTime: null, completedLaps: 2 },
    { position: 4, name: 'Rival Three', vehicle: 'mclaren-570s', finished: false, finishTime: null, completedLaps: 1 },
  ],
});

test('race time carries centisecond rounding across a minute and distinguishes no result from zero', () => {
  assert.equal(formatRaceTime(59.999), '01:00.00');
  assert.equal(formatRaceTime(145.23), '02:25.23');
  assert.equal(formatRaceTime(0), '00:00.00');
  for (const missing of [null, undefined, NaN, Infinity, -1, '45']) assert.equal(formatRaceTime(missing), '—');
});

test('classification displays real completed times and pending rivals without inventing finish times', () => {
  const result = race(), markup = finishRowsMarkup(result);
  assert.match(markup, /02:23\.40/);
  assert.match(markup, /02:25\.23/);
  assert.match(markup, /LAP 3 \/ 3/);
  assert.match(markup, /LAP 2 \/ 3/);
  assert.equal((markup.match(/<time>/g) || []).length, 2);
  assert.doesNotMatch(markup, /00:00\.00/);
  assert.match(finishStatusText(result), /still on track/);
  result.allFinished = true;
  assert.match(finishStatusText(result), /All 4 drivers classified/);
});

test('results show the persisted benchmark and actual reward receipt without mutating either', () => {
  const result = race(), before = JSON.stringify(result);
  const reward = Object.freeze({ awarded: true, credits: 808, base: 700, driftBonus: 109, persisted: true });
  const html = finishPanel({ race: result, isBest: true, previousBest: 148.35, bestTime: 145.23, reward, credits: 2008 });
  assert.match(html, /NEW PERSONAL BEST/);
  assert.match(html, /3\.12 sec quicker/);
  assert.match(html, /\+808 <small>CR/);
  assert.match(html, /2,008 <small>CR/);
  assert.match(html, /00:46\.15/);
  assert.match(html, /2,180/);
  assert.match(html, /Porsche 911 \(930\) Turbo/);
  assert.match(html, /Coast Run/);
  assert.equal(JSON.stringify(result), before);

  const denied = finishPanel({ race: result, isBest: false, bestTime: 142.17, reward: { awarded: false, credits: 999 }, credits: 1200 });
  assert.doesNotMatch(denied, /NEW PERSONAL BEST|\+999/);
  assert.match(denied, /02:22\.17/);
  assert.match(denied, /No new credits awarded/);
  assert.match(finishPanel({ race: result, reward: { awarded: true, credits: 808, persisted: false } }), /could not save them/);
});

test('pause reflects the selected race and safely presents names from external state', () => {
  const result = { ...race(), state: 'racing', completedLaps: 1, elapsed: 60.4 };
  const html = pausePanel({ race: result, sound: true, fullscreen: true });
  assert.match(html, /Porsche 911 \(930\) Turbo/);
  assert.match(html, /Coast Run/);
  assert.match(html, /01:00\.40/);
  assert.match(html, /id="pause-sound"[^>]*aria-pressed="true"/);
  assert.match(html, /Exit fullscreen/);
  assert.match(html, /id="pause-screen-status"/);
  const unsafe = '<img src=x onerror="bad()">';
  result.leaderboard[0].name = unsafe;
  assert.doesNotMatch(finishRowsMarkup(result), /<img/);
  assert.match(finishRowsMarkup(result), /&lt;img/);
  assert.doesNotMatch(pausePanel({ race: result, track: { name: unsafe } }), /<img/);
});

test('controls explain the usable thumbpad and optional tilt separately from keyboard input', () => {
  const phone = howToPlayPanel({ touch: true }), desktop = howToPlayPanel({ touch: false });
  assert.match(phone, /Nitro is your only driving button/);
  assert.match(phone, /HOLD \/ DRAG TO STEER/);
  assert.match(phone, /Hold either side of the thumbpad/);
  assert.match(phone, /Lift to straighten/);
  assert.match(phone, /Optional tilt controls/);
  assert.match(desktop, /ARROWS \/ A \+ D/);
  assert.match(desktop, /HOLD SHIFT/);
  for (const html of [phone, desktop]) {
    assert.match(html, /Automatic acceleration/);
    assert.match(html, /Turning upright pauses the race/);
    assert.match(html, /Space/);
    assert.doesNotMatch(html, /onclick=|<script/);
  }
});

test('solo Time attack presents the actual run and laps without fabricating a victory or rival standings', () => {
  const result = {...race(), mode: 'time-attack', position: 1, allFinished: true, rivals: [],
    lapTimes: [50.1, 46.15, 48.98], leaderboard: [{position: 1, isPlayer: true, finished: true, finishTime: 145.23}]};
  const before = JSON.stringify(result);
  const html = finishPanel({race: result, bestTime: 145.23, reward: {awarded: true, credits: 459}, credits: 1659});
  assert.match(html, /SOLO/); assert.match(html, /TIME ATTACK COMPLETE/); assert.match(html, /YOUR RUN TIME/);
  assert.match(html, /YOUR LAPS/); assert.match(html, /00:50\.10/); assert.match(html, /00:46\.15/); assert.match(html, /00:48\.98/);
  assert.match(html, /02:25\.23/); assert.match(html, /\+459 <small>CR/);
  assert.doesNotMatch(html, /RACE WINNER|PODIUM|rd-winner|FINAL ORDER|drivers classified|Rivals still|id="finish-order"/);
  assert.equal(finishRowsMarkup(result), ''); assert.equal(finishStatusText(result), 'Run complete. Chase your next personal best.');
  assert.equal(JSON.stringify(result), before);
});

test('solo pause identifies Time attack and freezes lap progress instead of showing position one of one', () => {
  const html = pausePanel({race: {...race(), mode: 'time-attack', state: 'racing', completedLaps: 1, elapsed: 70}});
  assert.match(html, /<dt>TIME ATTACK<\/dt><dd>SOLO<\/dd>/); assert.match(html, /RUN TIME/);
  assert.match(html, /Your lap progress and run time are held/); assert.doesNotMatch(html, /POSITION|Your position/);
});

test('a solo run with missing lap timings shows no invented lap time or personal best', () => {
  const html = finishPanel({race: {...race(), mode: 'time-attack', lapTimes: [NaN, null, '43']}});
  assert.equal((html.match(/<time>—<\/time>/g) || []).length, 3);
  assert.doesNotMatch(html, /<time>00:00\.00<\/time>|NEW PERSONAL BEST/);
});
