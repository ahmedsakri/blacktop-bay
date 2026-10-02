import { TRACKS, getTrack, sampleTrack } from './track.js';
import { VEHICLES, getVehicle } from './vehicles.js';
import { normalizeRaceOptions } from './race-options.js';
import { RIVAL_GRID } from './rivals.js';

export const CAREER_KEY = 'blacktop-bay-career-v1';
const vehicleIds = new Set(VEHICLES.map(car => car.id)), trackIds = new Set(TRACKS.map(track => track.id));
const medalRank = { none: 0, bronze: 1, silver: 2, gold: 3 };
const pointsForPlace = [25, 18, 15, 12, 10, 8, 6, 4];
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value);
const validTime = value => Number.isFinite(value) && value > 0 && value <= 900;
const whole = (value, limit = 1_000_000) => Number.isSafeInteger(value) && value >= 0 && value <= limit;
const driverNames = new Map([['player', 'You'], ...RIVAL_GRID.map(rival => [rival.id, rival.name])]);
const defaults = () => ({ version: 1, records: {}, recordedRaces: [], completedTours: 0, activeTour: null, lastTour: null });
const recordKey = race => `${race.track}:${race.vehicle}:${normalizeRaceOptions(race).mode}:${normalizeRaceOptions(race).difficulty}`;

function cleanClassification(value) {
  if (!Array.isArray(value) || value.length !== 8) return [];
  const ids = new Set(), positions = new Set(), result = [];
  for (const row of value) {
    if (!driverNames.has(row?.id) || ids.has(row.id) || !vehicleIds.has(row.vehicle)
      || !['finished','pending','dnf'].includes(row.status)) return [];
    ids.add(row.id);
    const finished = row.status === 'finished';
    if (finished && (!validTime(row.finishTime) || !whole(row.position,8) || row.position < 1 || positions.has(row.position))) return [];
    if (finished) positions.add(row.position);
    result.push({id:row.id, name:driverNames.get(row.id), vehicle:row.vehicle, status:row.status,
      position:finished ? row.position : null, finishTime:finished ? row.finishTime : null,
      points:finished ? pointsForPlace[row.position - 1] : 0});
  }
  const finishers=result.filter(row=>row.status==='finished').sort((a,b)=>a.position-b.position);
  if(finishers.some((row,index)=>row.position!==index+1 || index>0 && row.finishTime<finishers[index-1].finishTime)) return [];
  return result;
}
function raceClassification(race) {
  if (!Array.isArray(race?.leaderboard)) return [];
  return cleanClassification(race.leaderboard.map(row => ({...row,
    status:row.finished === true && row.completedLaps === 3 ? 'finished' : 'pending'})));
}
function cleanFleet(value) {
  if (!Array.isArray(value) || value.length !== 7) return [];
  return RIVAL_GRID.every((rival,index) => value[index]?.id === rival.id && vehicleIds.has(value[index]?.vehicle))
    ? value.map((row,index) => ({id:RIVAL_GRID[index].id,name:RIVAL_GRID[index].name,vehicle:row.vehicle})) : [];
}
function cleanTour(value, completed = false) {
  if (!value || !validId(value.id) || !vehicleIds.has(value.vehicle) || !Array.isArray(value.tracks)
    || value.tracks.length !== 3 || new Set(value.tracks).size !== 3 || value.tracks.some(track => !trackIds.has(track))) return null;
  const rounds = [];
  for (const round of Array.isArray(value.rounds) ? value.rounds.slice(0, 3) : []) {
    if (round?.track !== value.tracks[rounds.length] || !validId(round.raceId) || rounds.some(item => item.raceId === round.raceId)
      || !validTime(round.elapsed) || !whole(round.position, 8) || round.position < 1 || !whole(round.credits, 1400)) return null;
    const classification=cleanClassification(round.classification), player=classification.find(row=>row.id==='player');
    if (player && (player.status!=='finished' || player.position!==round.position || Math.abs(player.finishTime-round.elapsed)>.001)) return null;
    rounds.push({ track: round.track, raceId: round.raceId, elapsed: round.elapsed, position: round.position,
      points: pointsForPlace[round.position - 1], credits: round.credits, classification });
  }
  if (completed ? rounds.length !== 3 : rounds.length >= 3) return null;
  return { id: value.id, vehicle: value.vehicle, tracks: [...value.tracks], difficulty: normalizeRaceOptions(value).difficulty,
    fleet: cleanFleet(value.fleet), rounds, points: rounds.reduce((sum, round) => sum + round.points, 0), credits: rounds.reduce((sum, round) => sum + round.credits, 0) };
}

export function normalizeCareer(value) {
  const state = defaults();
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return state;
  if (value.records && typeof value.records === 'object' && !Array.isArray(value.records)) {
    for (const [key, record] of Object.entries(value.records).slice(0, 10_000)) {
      const [track, vehicle, mode, difficulty, extra] = key.split(':');
      const options = normalizeRaceOptions({ mode, difficulty });
      if (extra || !trackIds.has(track) || !vehicleIds.has(vehicle) || mode !== options.mode || difficulty !== options.difficulty
        || !validTime(record?.bestTime) || !Object.hasOwn(medalRank, record.medal) || !whole(record.runs) || record.runs < 1) continue;
      state.records[key] = { bestTime: record.bestTime, medal: record.medal, runs: record.runs };
    }
  }
  if (Array.isArray(value.recordedRaces)) state.recordedRaces = [...new Set(value.recordedRaces.filter(validId))].slice(-2048);
  if (whole(value.completedTours)) state.completedTours = value.completedTours;
  state.activeTour = cleanTour(value.activeTour);
  state.lastTour = cleanTour(value.lastTour, true);
  return state;
}

const targetsCache = new Map();
export function getMedalTargets(trackId, vehicleId) {
  const track = getTrack(trackId), vehicle = getVehicle(vehicleId), key = `${track.id}:${vehicle.id}`;
  if (!targetsCache.has(key)) {
    // This is a published game target, not a claimed real-world lap record. It
    // follows this actual arcade layout's length and corner severity at base tune.
    let reference = 2.5;
    const step = track.length / track.samples.length;
    for (const sample of track.samples) {
      const near = sampleTrack(sample.s + 3, track), far = sampleTrack(sample.s + 22, track);
      const angle = Math.atan2(far.tx, far.tz) - Math.atan2(near.tx, near.tz);
      const curvature = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) / 19;
      const targetSpeed = Math.min(vehicle.handling.topSpeed * .78, Math.sqrt(9 * vehicle.handling.handling / Math.max(.003, curvature)));
      reference += step / targetSpeed;
    }
    // Gold asks for a clean run near a stock car's validated driving pace;
    // silver and bronze leave progressively more recovery and learning room.
    const gold = Math.ceil(reference * 3 * .96);
    targetsCache.set(key, Object.freeze({ gold, silver: Math.ceil(gold * 1.14), bronze: Math.ceil(gold * 1.30) }));
  }
  return targetsCache.get(key);
}

export function circuitMedal(race) {
  if (!validTime(race?.elapsed) || !trackIds.has(race?.track) || !vehicleIds.has(race?.vehicle)) return 'none';
  const targets = getMedalTargets(race.track, race.vehicle);
  return ['gold', 'silver', 'bronze'].find(medal => race.elapsed <= targets[medal]) || 'none';
}
export function getCareerRecord(state, race) { return normalizeCareer(state).records[recordKey(race)] || null; }

export function beginChampionship(value, { id, vehicle, track, difficulty = 'street', seed = 0 } = {}) {
  const state = normalizeCareer(value);
  if (!validId(id) || !vehicleIds.has(vehicle) || !trackIds.has(track)) return { state, started: false };
  const others = TRACKS.filter(item => item.id !== track);
  const offset = Math.abs(Number.isSafeInteger(seed) ? seed : 0) % others.length;
  // Spread the tour across the collection; every leg is an actual selectable
  // circuit, starting with the player's chosen venue.
  const second = others[offset].id, third = others[(offset + Math.ceil(others.length / 2)) % others.length].id;
  state.activeTour = { id, vehicle, difficulty: normalizeRaceOptions({ difficulty }).difficulty,
    tracks: [track, second, third], fleet: [], rounds: [], points: 0, credits: 0 };
  return { state, started: true, next: nextChampionshipRace(state) };
}

export function nextChampionshipRace(state) {
  const tour = cleanTour(state?.activeTour);
  return tour ? { track: tour.tracks[tour.rounds.length], vehicle: tour.vehicle, difficulty: tour.difficulty,
    mode: 'championship', round: tour.rounds.length + 1, total: 3, tourId: tour.id, rivalVehicles: tour.fleet.length ? tour.fleet.map(row => row.vehicle) : null } : null;
}

export function recordCareerResult(value, race, receipt) {
  const state = normalizeCareer(value), rejected = { state, recorded: false, medal: 'none', improved: false, tourCompleted: false, tour: null };
  // Reward eligibility is established once by progression. Career cannot mint
  // credits, advance a skipped checkpoint race, or replay an already paid finish.
  if (receipt?.awarded !== true || !whole(receipt.credits, 1400) || race?.state !== 'finished'
    || race.completedLaps !== 3 || race.totalLaps !== 3 || !validTime(race.elapsed)
    || !validId(race.raceId) || state.recordedRaces.includes(race.raceId)
    || !whole(race.position, 8) || race.position < 1 || !trackIds.has(race.track) || !vehicleIds.has(race.vehicle)) return rejected;
  const options = normalizeRaceOptions(race), key = recordKey(race), previous = state.records[key];
  const medal = circuitMedal(race), improved = !previous || race.elapsed < previous.bestTime;
  state.records[key] = { bestTime: improved ? race.elapsed : previous.bestTime,
    medal: medalRank[medal] > (medalRank[previous?.medal] || 0) ? medal : previous?.medal || medal,
    runs: Math.min(1_000_000, (previous?.runs || 0) + 1) };
  state.recordedRaces = [...state.recordedRaces, race.raceId].slice(-2048);
  let tour = state.activeTour, tourCompleted = false;
  if (options.mode === 'championship' && tour && race.vehicle === tour.vehicle && options.difficulty === tour.difficulty
    && race.track === tour.tracks[tour.rounds.length]) {
    tour.rounds.push({ raceId: race.raceId, track: race.track, elapsed: race.elapsed, position: race.position,
      points: pointsForPlace[race.position - 1], credits: receipt.credits, classification: raceClassification(race) });
    if (!tour.fleet.length && tour.rounds.at(-1).classification.length) tour.fleet = RIVAL_GRID.map(rival => {const row=tour.rounds.at(-1).classification.find(item=>item.id===rival.id);return {id:rival.id,name:rival.name,vehicle:row.vehicle};});
    tour.points += pointsForPlace[race.position - 1]; tour.credits += receipt.credits;
    if (tour.rounds.length === 3) {
      tourCompleted = true; state.completedTours = Math.min(1_000_000, state.completedTours + 1);
      state.lastTour = tour; state.activeTour = null;
    }
  } else tour = null;
  return { state, recorded: true, medal, improved, targets: getMedalTargets(race.track, race.vehicle), tourCompleted, tour };
}

// Bind a chosen field once, before the first round, so rivals keep their cars.
export function bindChampionshipFleet(value, vehicles) {
  const state=normalizeCareer(value), tour=state.activeTour;
  const fleet=cleanFleet(Array.isArray(vehicles) ? vehicles.map((vehicle,index)=>({id:RIVAL_GRID[index]?.id,vehicle})) : null);
  if (!tour || tour.rounds.length || tour.fleet.length || !fleet.length) return {state,changed:false};
  tour.fleet=fleet;return {state,changed:true};
}
export function refreshChampionshipRound(value, race, {finalize=false}={}) {
  const state=normalizeCareer(value), tour=[state.activeTour,state.lastTour].find(item=>item?.rounds.some(round=>round.raceId===race?.raceId));
  const round=tour?.rounds.find(item=>item.raceId===race?.raceId);
  if (!round || race.state!=='finished' || race.track!==round.track || race.vehicle!==tour.vehicle) return {state,changed:false};
  const incoming=raceClassification(race);
  if (!incoming.length) return {state,changed:false};
  // Once a player explicitly leaves a round, its DNF classifications are final.
  if (round.classification.some(row=>row.status==='dnf')) return {state,changed:false};
  const previous=JSON.stringify(round.classification);
  round.classification=incoming.map(row=>{
    const confirmed=round.classification.find(item=>item.id===row.id && item.status==='finished');
    if (confirmed) return confirmed;
    return finalize && row.status==='pending' ? {...row,status:'dnf'} : row;
  });
  return {state,changed:JSON.stringify(round.classification)!==previous,tour};
}
export const finalizeChampionshipRound=(value,race)=>refreshChampionshipRound(value,race,{finalize:true});
// Boot only: simulation for a saved results screen cannot resume after a page
// reload. Close its known pending classifications without fabricating finishes.
// Do not call while the current race's rivals are still being simulated.
export function finalizeInterruptedTourRounds(value) {
  const state=normalizeCareer(value);let classified=0;
  for (const tour of [state.activeTour,state.lastTour]) for (const round of tour?.rounds || []) {
    round.classification=round.classification.map(row=>{
      if(row.status!=='pending')return row;
      classified++;
      return {...row,status:'dnf',position:null,finishTime:null,points:0};
    });
  }
  return {state,changed:classified>0,classified};
}
export function getChampionshipStandings(tour) {
  if (!tour) return {rows:[],provisional:true,complete:false};
  const rows=[...driverNames].map(([id,name])=>({id,name,points:0,wins:0,finishes:0,dnfs:0,pending:0,rounds:[],vehicle:id==='player'?tour.vehicle:tour.fleet?.find(row=>row.id===id)?.vehicle||null}));
  for (const round of tour.rounds||[]) for (const driver of rows) {
    const result=round.classification?.find(row=>row.id===driver.id) || (driver.id==='player' ? {id:'player',vehicle:tour.vehicle,status:'finished',position:round.position,finishTime:round.elapsed,points:pointsForPlace[round.position-1]} : null);
    if (!result) {driver.pending++;driver.rounds.push({status:'unrecorded',points:0});continue;}
    driver.vehicle=result.vehicle;driver.rounds.push(result);
    if (result.status==='finished') {driver.points+=pointsForPlace[result.position-1];driver.finishes++;driver.wins+=Number(result.position===1);}
    else if (result.status==='dnf') driver.dnfs++;else driver.pending++;
  }
  // Equal points and wins remain a sporting tie; names only order the display.
  rows.sort((a,b)=>b.points-a.points || b.wins-a.wins || a.name.localeCompare(b.name));
  rows.forEach((row,index)=>row.rank=index && row.points===rows[index-1].points && row.wins===rows[index-1].wins ? rows[index-1].rank : index+1);
  const provisional=rows.some(row=>row.pending>0), complete=tour.rounds?.length===3&&!provisional;
  return {rows,provisional,complete};
}
