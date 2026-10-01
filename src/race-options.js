export const RACE_MODES = Object.freeze([
  Object.freeze({ id: 'race', label: 'Circuit race', description: 'Eight real cars. Three laps. One finish line.' }),
  Object.freeze({ id: 'time-attack', label: 'Time attack', description: 'An open circuit. Chase a cleaner lap and your personal best.' }),
  Object.freeze({ id: 'championship', label: 'Three-race tour', description: 'Take one car through three circuits. Every finish earns upgrade credits.' }),
]);
export const DIFFICULTIES = Object.freeze([
  Object.freeze({ id: 'relaxed', label: 'Club', description: 'More room to learn the racing line.', pace: .86 }),
  Object.freeze({ id: 'street', label: 'Sport', description: 'A balanced eight-car contest.', pace: 1 }),
  Object.freeze({ id: 'pro', label: 'Pro', description: 'Faster rivals. Sharper racecraft.', pace: 1.10 }),
]);
export function getDifficulty(id) { return DIFFICULTIES.find(item => item.id === id) || DIFFICULTIES[1]; }
export function normalizeRaceOptions(value = {}) {
  return {
    mode: RACE_MODES.some(item => item.id === value?.mode) ? value.mode : 'race',
    difficulty: getDifficulty(value?.difficulty).id,
  };
}
export function raceFieldSize(mode) { return mode === 'time-attack' ? 1 : 8; }
