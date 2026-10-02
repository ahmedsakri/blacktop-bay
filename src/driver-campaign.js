import { getMedalTargets } from './race-career.js';
import { DEFAULT_VEHICLE_ID, getVehicle } from './vehicles.js';
import { getTrack } from './track.js';
import { driverVehicleIds, eligibleDriverResult, cleanRaceIds, validRaceTime, whole,
  loadDriverState, persistDriverState } from './driver-progress.js';

export const CAMPAIGN_KEY = 'camber-reign-campaign-v1';
const goal = (id, type, value, label) => Object.freeze({ id, type, value, label });
const finish = () => goal('finish', 'finish', 3, 'Complete all three laps');
const place = value => goal('position', 'position', value, value === 1 ? 'Win the race' : `Finish in the top ${value}`);
const resets = value => goal('resets', 'resets', value, value === 0 ? 'Finish without a reset' : `Finish with no more than ${value} resets`);
const drift = value => goal('drift', 'drift', value, `Bank ${value.toLocaleString('en-US')} drift points`);
const clock = medal => goal('time', 'time', medal, `Beat the ${medal} three-lap target`);
const consistency = seconds => goal('consistency', 'consistency', seconds, `Keep all three lap times within ${seconds} seconds`);
const skill = (type, value, label) => goal(type, type, value, label);
const event = (id, name, track, mode, difficulty, description, objectives) => Object.freeze({
  id, name, track, mode, difficulty, description, objectives: Object.freeze(objectives),
});
export const CAMPAIGN_CHAPTERS = Object.freeze([
  { id: 'beginnings', name: 'Bay beginnings', description: 'Meet the coast. Find a rhythm. Bring it home.', events: [
    event('harbor-first', 'First light', 'harbor', 'race', 'relaxed', 'Settle into the eight-car field on Harbor Flow.', [finish(), place(5), resets(2)]),
    event('coast-clock', 'Open road', 'coast', 'time-attack', 'street', 'Take a solo run along the coast. Your stock-car bronze target is the next step.', [finish(), clock('bronze'), resets(0)]),
    event('dockyard-podium', 'Dockside contender', 'dockyard', 'race', 'relaxed', 'Thread the dockyard corners and earn a podium.', [place(3), resets(1), drift(300)]),
  ] },
  { id: 'lines', name: 'Find your line', description: 'Carry speed through the corners, not into the walls.', events: [
    event('summit-rhythm', 'Summit rhythm', 'summit', 'time-attack', 'street', 'Link the switchbacks into a bronze-target run.', [clock('bronze'), resets(0), drift(500)]),
    event('cedar-confidence', 'Between the trees', 'cedar-ridge', 'race', 'street', 'Hold your nerve through Cedar Ridge against the Sport field.', [place(5), resets(0), drift(600)]),
    event('breakwater-run', 'Breakwater breakthrough', 'breakwater', 'race', 'street', 'A podium here comes from three complete laps of focused driving.', [place(3), place(1), resets(0)]),
  ] },
  { id: 'world', name: 'World circuit', description: 'Three distinct layouts. Three ways to sharpen your racecraft.', events: [
    event('monza-clock', 'Straight to it', 'monza', 'time-attack', 'street', 'Choose your setup and chase the silver game target.', [clock('silver'), goal('gold', 'time', 'gold', 'Beat the gold three-lap target'), resets(0)]),
    event('suzuka-lines', 'Change of direction', 'suzuka', 'race', 'street', 'Read the next corner early and race for the podium.', [place(3), place(1), drift(750)]),
    event('spa-rhythm', 'Long-game pace', 'spa', 'time-attack', 'street', 'Build a silver run around three consistent laps.', [clock('silver'), consistency(6), resets(0)]),
  ] },
  { id: 'reign', name: 'Earn your reign', description: 'A faster field. A smaller margin. Your strongest drive.', events: [
    event('neon-contender', 'Freight runner', 'neon-freight', 'race', 'pro', 'Finish among the first five against the Pro field.', [place(5), goal('podium', 'position', 3, 'Finish on the podium'), drift(1000)]),
    event('bay-final', 'Bay contender', 'grandprix', 'race', 'pro', 'Take a Pro podium at the Bay Grand Prix.', [place(3), place(1), resets(0)]),
    event('coast-reign', 'Own the coast', 'coast', 'time-attack', 'street', 'Return to the coast and put together a gold-target drive.', [clock('gold'), consistency(4), resets(0)]),
  ] },
  { id: 'nitro-lab', name: 'Boost with purpose', description: 'Time your Nitro. Find the pickups. Protect your clean sectors.', events: [
    event('harbor-perfect', 'Perfect timing', 'harbor', 'time-attack', 'street', 'Start Nitro, release, then press again in the timing window. Activate Perfect Nitro twice.', [skill('perfectNitro', 2, 'Activate Perfect Nitro twice'), skill('pickups', 3, 'Collect three Nitro pickups'), resets(0)]),
    event('monza-burst', 'Full charge', 'monza', 'time-attack', 'street', 'Build full charge, then use Burst on open straights.', [skill('burstNitro', 2, 'Activate Burst Nitro twice'), skill('cleanSectors', 4, 'Complete four sectors without contact or recovery'), clock('silver')]),
    event('coast-supply', 'Coastal supply run', 'coast', 'race', 'street', 'Plan a line through the recharge pickups without losing the pack.', [skill('pickups', 5, 'Collect five Nitro pickups'), place(3), skill('perfectNitro', 3, 'Activate Perfect Nitro three times')]),
  ] },
  { id: 'racecraft', name: 'Racecraft academy', description: 'Pass with space. Link clean sectors. Make every boost count.', events: [
    event('suzuka-clean-pass', 'Room to race', 'suzuka', 'race', 'street', 'Pass moving rivals and keep clear of contact before and after each pass.', [skill('cleanOvertakes', 3, 'Make three clean overtakes'), skill('cleanSectors', 5, 'Complete five clean sectors'), resets(0)]),
    event('spa-clean-sectors', 'Sector by sector', 'spa', 'time-attack', 'street', 'Keep the car away from contact between consecutive timing checkpoints.', [skill('cleanSectors', 8, 'Complete eight clean sectors'), skill('perfectNitro', 3, 'Activate Perfect Nitro three times'), clock('gold')]),
    event('bay-racecraft-final', 'Complete driver', 'grandprix', 'race', 'pro', 'Bring the advanced skills together against the Pro grid.', [place(1), skill('cleanOvertakes', 4, 'Make four clean overtakes'), skill('burstNitro', 3, 'Activate Burst Nitro three times')]),
  ] },
].map(chapter => Object.freeze({ ...chapter, events: Object.freeze(chapter.events) })));
export const CAMPAIGN_EVENTS = Object.freeze(CAMPAIGN_CHAPTERS.flatMap(chapter => chapter.events));

// Goals use distinct IDs within an event, even where two placement thresholds
// are authored. Saving a primary objective never implicitly earns its bonus.
function objectiveId(objective, index) { return `${index}-${objective.id}`; }
const timeLabel = seconds => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
export function getCampaignEvent(id, vehicle = DEFAULT_VEHICLE_ID) {
  const definition = CAMPAIGN_EVENTS.find(item => item.id === id);
  if (!definition || !driverVehicleIds.has(vehicle)) return null;
  const targets = getMedalTargets(definition.track, vehicle);
  return { ...definition, vehicle, campaignEventId: definition.id,
    trackName: getTrack(definition.track).name, carName: getVehicle(vehicle).name,
    objectives: definition.objectives.map((item, index) => ({ ...item, id: objectiveId(item, index), required: index === 0,
      target: item.type === 'time' ? targets[item.value] : item.value,
      label: item.type === 'time' ? `${item.label} · ${timeLabel(targets[item.value])}` : item.label })),
  };
}
export function normalizeCampaign(value) {
  const state = { version: 1, events: {}, recordedRaces: [] };
  if (value?.version !== 1 || typeof value !== 'object' || Array.isArray(value)) return state;
  state.recordedRaces = cleanRaceIds(value.recordedRaces);
  for (const definition of CAMPAIGN_EVENTS) {
    const record = value.events?.[definition.id];
    if (!record || !whole(record.runs) || record.runs < 1) continue;
    const allowed = definition.objectives.map(objectiveId);
    state.events[definition.id] = { runs: record.runs,
      objectives: Array.isArray(record.objectives) ? allowed.filter(id => record.objectives.includes(id)) : [],
      bestTime: validRaceTime(record.bestTime) ? record.bestTime : null,
    };
  }
  return state;
}
export function isCampaignEventComplete(value, id) {
  const definition = CAMPAIGN_EVENTS.find(item => item.id === id);
  return !!definition && Array.isArray(value?.events?.[id]?.objectives)
    && value.events[id].objectives.includes(objectiveId(definition.objectives[0], 0));
}
export function canStartCampaignEvent(value, id) {
  const index = CAMPAIGN_EVENTS.findIndex(item => item.id === id);
  return index >= 0 && CAMPAIGN_EVENTS.slice(0, index).every(item => isCampaignEventComplete(value, item.id));
}
export function getNextCampaignEvent(value, vehicle = DEFAULT_VEHICLE_ID) {
  const state = normalizeCampaign(value);
  const next = CAMPAIGN_EVENTS.find(item => !isCampaignEventComplete(state, item.id));
  return next ? getCampaignEvent(next.id, vehicle) : null;
}
function hasConsistentLaps(race, seconds) {
  return Array.isArray(race.lapTimes) && race.lapTimes.length === 3 && race.lapTimes.every(validRaceTime)
    && Math.abs(race.lapTimes.reduce((sum, time) => sum + time, 0) - race.elapsed) < .1
    && Math.max(...race.lapTimes) - Math.min(...race.lapTimes) <= seconds;
}
function earnedObjective(objective, race) {
  switch (objective.type) {
    case 'finish': return race.completedLaps === objective.target;
    case 'position': return race.mode !== 'time-attack' && race.position <= objective.target;
    case 'resets': return race.recoveries <= objective.target;
    case 'drift': return race.score >= objective.target;
    case 'time': return race.elapsed <= objective.target;
    case 'consistency': return hasConsistentLaps(race, objective.target);
    case 'perfectNitro': case 'burstNitro': case 'cleanOvertakes': case 'pickups': case 'cleanSectors':
      return whole(race.objectiveStats?.[objective.type], 100_000) && race.objectiveStats[objective.type] >= objective.target;
    default: return false;
  }
}
export function recordCampaignResult(value, race, receipt) {
  const state = normalizeCampaign(value), rejected = { state, recorded: false, newlyEarned: [], completed: false, next: null };
  if (!eligibleDriverResult(race, receipt) || state.recordedRaces.includes(race.raceId)) return rejected;
  const selected = getCampaignEvent(race.campaignEventId, race.vehicle);
  if (!selected || !canStartCampaignEvent(state, selected.id) || selected.track !== race.track
    || selected.mode !== race.mode || selected.difficulty !== race.difficulty) return rejected;
  const previous = state.events[selected.id] || { runs: 0, objectives: [], bestTime: null };
  const achieved = selected.objectives.filter(objective => earnedObjective(objective, race));
  const newlyEarned = achieved.filter(objective => !previous.objectives.includes(objective.id));
  const completedBefore = isCampaignEventComplete(state, selected.id);
  state.events[selected.id] = { runs: Math.min(1_000_000, previous.runs + 1),
    objectives: selected.objectives.filter(item => previous.objectives.includes(item.id) || achieved.some(goal => goal.id === item.id)).map(item => item.id),
    bestTime: previous.bestTime === null ? race.elapsed : Math.min(previous.bestTime, race.elapsed) };
  state.recordedRaces = [...state.recordedRaces, race.raceId].slice(-2048);
  return { state, recorded: true, event: selected, newlyEarned,
    completed: isCampaignEventComplete(state, selected.id), firstCompletion: !completedBefore && isCampaignEventComplete(state, selected.id),
    next: getNextCampaignEvent(state, race.vehicle) };
}
export const loadCampaign = storage => loadDriverState(CAMPAIGN_KEY, normalizeCampaign, storage);
export const persistCampaign = (state, storage) => persistDriverState(CAMPAIGN_KEY, normalizeCampaign, state, storage);

// A concrete next action, including unearned bonus goals after the main path.
export function getCampaignSuggestion(value, vehicle = DEFAULT_VEHICLE_ID) {
  const state = normalizeCampaign(value);
  const next = getNextCampaignEvent(state, vehicle);
  const selected = next || CAMPAIGN_EVENTS.map(item => getCampaignEvent(item.id, vehicle)).find(item =>
    item && item.objectives.some(goal => !state.events[item.id]?.objectives.includes(goal.id)));
  if (!selected) return null;
  const objective = selected.objectives.find(goal => !state.events[selected.id]?.objectives.includes(goal.id));
  return {kind: 'campaign', eventId: selected.id, vehicle, track: selected.track, label: selected.name,
    description: `${objective.label} at ${selected.trackName}.`, objective, bonus: !next};
}
