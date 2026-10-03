import { DIFFICULTIES, normalizeRaceOptions } from './race-options.js';
import { getMedalTargets, nextChampionshipRace, getChampionshipStandings } from './race-career.js';
import { getTrack } from './track.js';
import { getVehicle } from './vehicles.js';
import { icon } from './icons.js';
const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = seconds => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
export function raceSetupMarkup(preferences,career,{campaignEvent=null}={}){
  const options=normalizeRaceOptions(preferences),solo=options.mode==='time-attack';
  const next=options.mode==='championship'?nextChampionshipRace(career):null;
  const targets=getMedalTargets(preferences.track,preferences.vehicle);
  return `<div class="hq-difficulty">${solo?'<p>Time attack is a solo run. Chase the medal targets and your personal best.</p>':`<label for="race-difficulty">Rival difficulty</label><select id="race-difficulty" aria-describedby="race-difficulty-note">${DIFFICULTIES.map(d=>`<option value="${d.id}" ${d.id===options.difficulty?'selected':''}>${d.label} — ${esc(d.description)}</option>`).join('')}</select><p id="race-difficulty-note">Changes rival pace. Your car stays the same.${campaignEvent?' Changing difficulty leaves the selected career event.':''}</p>`}</div>
    <details class="hq-medals"${solo?' open':''}><summary>${icon('trophy')} MEDAL TARGETS</summary><p>Finish three laps in ${esc(getVehicle(preferences.vehicle).name)} at ${esc(getTrack(preferences.track).name)}.</p><dl>${Object.entries(targets).map(([m,t])=>`<div><dt>${m.toUpperCase()}</dt><dd>${time(t)}</dd></div>`).join('')}</dl><p>Game targets based on the stock car. Upgrades help. Records are kept separately for each mode${solo?'':' and difficulty'}.</p></details>
    ${next?`<div class="hq-tour"><strong>YOUR TOUR IS WAITING</strong><p>Round ${next.round} of 3 · ${esc(getTrack(next.track).name)} · ${esc(getVehicle(next.vehicle).name)}</p><button id="resume-tour" type="button" class="button secondary">${icon('flag')} CONTINUE TOUR</button></div>`:''}`;
}
export function careerResultMarkup(result,persisted){if(!result?.recorded)return '';const t=result.tour;return `<section class="hq-result-career"><h3>${icon('trophy')} ${result.medal==='none'?(result.improved?'A NEW BENCHMARK':'RUN RECORDED'):`${result.medal.toUpperCase()} CIRCUIT MEDAL`}</h3><p>${result.medal==='none'?'Beat the bronze target on your next run.':'Your medal and best time have been recorded for this car, circuit, mode and difficulty.'}</p>${t?`<div class="hq-tour-result"><strong>${result.tourCompleted?'TOUR COMPLETE':`TOUR · ${t.rounds.length} / 3 ROUNDS`}</strong><span>${t.points} POINTS · ${t.credits.toLocaleString()} CR EARNED</span><ol>${t.rounds.map(r=>`<li>${esc(getTrack(r.track).name)} <b>P${r.position} · +${r.credits} CR</b></li>`).join('')}</ol></div>`:''}${t?championshipStandingsMarkup(t):''}${!persisted?'<p role="status">Career saved for this session only. Browser storage is unavailable.</p>':''}</section>`;}

export function championshipStandingsMarkup(tour) {
  const standings=getChampionshipStandings(tour);
  if (!standings.rows.length) return '';
  return `<section id="tour-standings" class="tour-standings" aria-labelledby="tour-standings-heading"><h3 id="tour-standings-heading">${standings.complete?'FINAL TOUR STANDINGS':'TOUR STANDINGS'}${standings.provisional?' · PROVISIONAL':''}</h3><p>25–18–15–12–10–8–6–4 points. Equal points use wins; equal wins remain tied.</p><div class="tour-standings-scroll" tabindex="0" aria-label="Tour standings"><table><thead><tr><th scope="col">Rank</th><th scope="col">Driver</th>${(tour.rounds||[]).map((_,index)=>`<th scope="col">R${index+1}</th>`).join('')}<th scope="col">Points</th></tr></thead><tbody>${standings.rows.map(row=>`<tr class="${row.id==='player'?'is-player':''}"><td>${row.rank}</td><th scope="row">${esc(row.name)}</th>${row.rounds.map(result=>`<td>${result.status==='finished'?`P${result.position}`:result.status==='dnf'?'DNF':result.status==='pending'?'Racing':'Not recorded'}</td>`).join('')}<td>${row.points}</td></tr>`).join('')}</tbody></table></div>${standings.provisional?'<p>Only actual finishes score. Continuing to the next round classifies unfinished rivals as DNF with zero points; no finish time is invented.</p>':''}</section>`;
}
