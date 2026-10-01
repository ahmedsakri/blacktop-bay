import { TRACKS, getTrack, sampleTrack } from './track.js';
import { VEHICLES, getVehicle } from './vehicles.js';
import { normalizeRaceOptions } from './race-options.js';

export const CAREER_KEY = 'blacktop-bay-career-v1';
const vehicleIds = new Set(VEHICLES.map(car => car.id)), trackIds = new Set(TRACKS.map(track => track.id));
const medalRank = { none: 0, bronze: 1, silver: 2, gold: 3 };
const pointsForPlace = [25, 18, 15, 12, 10, 8, 6, 4];
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value);
const validTime = value => Number.isFinite(value) && value > 0 && value <= 900;
const whole = (value, limit = 1_000_000) => Number.isSafeInteger(value) && value >= 0 && value <= limit;
const defaults = () => ({ version: 1, records: {}, recordedRaces: [], completedTours: 0, activeTour: null, lastTour: null });
const recordKey = race => `${race.track}:${race.vehicle}:${normalizeRaceOptions(race).mode}:${normalizeRaceOptions(race).difficulty}`;

function cleanTour(value, completed = false) {
  if (!value || !validId(value.id) || !vehicleIds.has(value.vehicle) || !Array.isArray(value.tracks)
    || value.tracks.length !== 3 || new Set(value.tracks).size !== 3 || value.tracks.some(track => !trackIds.has(track))) return null;
  const rounds = [];
  for (const round of Array.isArray(value.rounds) ? value.rounds.slice(0, 3) : []) {
    if (round?.track !== value.tracks[rounds.length] || !validId(round.raceId) || rounds.some(item => item.raceId === round.raceId)
      || !validTime(round.elapsed) || !whole(round.position, 8) || round.position < 1 || !whole(round.credits, 1400)) return null;
    rounds.push({ track: round.track, raceId: round.raceId, elapsed: round.elapsed, position: round.position,
      points: pointsForPlace[round.position - 1], credits: round.credits });
  }
  if (completed ? rounds.length !== 3 : rounds.length >= 3) return null;
  return { id: value.id, vehicle: value.vehicle, tracks: [...value.tracks], difficulty: normalizeRaceOptions(value).difficulty,
    rounds, points: rounds.reduce((sum, round) => sum + round.points, 0), credits: rounds.reduce((sum, round) => sum + round.credits, 0) };
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
    tracks: [track, second, third], rounds: [], points: 0, credits: 0 };
  return { state, started: true, next: nextChampionshipRace(state) };
}

export function nextChampionshipRace(state) {
  const tour = cleanTour(state?.activeTour);
  return tour ? { track: tour.tracks[tour.rounds.length], vehicle: tour.vehicle, difficulty: tour.difficulty,
    mode: 'championship', round: tour.rounds.length + 1, total: 3, tourId: tour.id } : null;
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
      points: pointsForPlace[race.position - 1], credits: receipt.credits });
    tour.points += pointsForPlace[race.position - 1]; tour.credits += receipt.credits;
    if (tour.rounds.length === 3) {
      tourCompleted = true; state.completedTours = Math.min(1_000_000, state.completedTours + 1);
      state.lastTour = tour; state.activeTour = null;
    }
  } else tour = null;
  return { state, recorded: true, medal, improved, targets: getMedalTargets(race.track, race.vehicle), tourCompleted, tour };
}
