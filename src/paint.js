import { VEHICLES, getVehicle } from './vehicles.js';

export const PAINT_KEY = 'blacktop-bay-paint-v1';
export const PAINT_COLORS = Object.freeze([
  {id: 'factory', name: 'Team original', color: null},
  {id: 'pearl', name: 'Pearl White', color: '#eee9dc'},
  {id: 'silver', name: 'Liquid Silver', color: '#aebac1'},
  {id: 'graphite', name: 'Graphite', color: '#333c45'},
  {id: 'blue', name: 'Atlantic Blue', color: '#245cac'},
  {id: 'teal', name: 'Lagoon Teal', color: '#248a83'},
  {id: 'green', name: 'Racing Green', color: '#24513e'},
  {id: 'red', name: 'Corsa Red', color: '#b92430'},
  {id: 'orange', name: 'Ember Orange', color: '#e85d27'},
  {id: 'gold', name: 'Champagne Gold', color: '#c19b54'},
  {id: 'violet', name: 'Midnight Violet', color: '#514070'},
].map(Object.freeze));
export const PAINT_FINISHES = Object.freeze([
  {id: 'gloss', name: 'Gloss', metalness: .22, roughness: .22, clearcoat: 1, clearcoatRoughness: .10},
  {id: 'metallic', name: 'Metallic', metalness: .55, roughness: .28, clearcoat: 1, clearcoatRoughness: .13},
  {id: 'satin', name: 'Satin', metalness: .22, roughness: .48, clearcoat: .28, clearcoatRoughness: .34},
].map(Object.freeze));
const normalize = value => ({color: PAINT_COLORS.some(c => c.id === value?.color) ? value.color : 'factory', finish: PAINT_FINISHES.some(f => f.id === value?.finish) ? value.finish : 'gloss'});
export function loadPaint(storage) {
  let raw = {};
  try { const json = (storage ?? globalThis.localStorage)?.getItem(PAINT_KEY); if (typeof json === 'string' && json.length < 10_000) raw = JSON.parse(json); } catch {}
  return Object.fromEntries(VEHICLES.map(v => [v.id, normalize(raw?.[v.id])]));
}
export function savePaint(state, vehicle, choice, storage) {
  if (!VEHICLES.some(v => v.id === vehicle)) return {ok: false, persisted: false};
  state[vehicle] = normalize(choice);
  try { const target = storage ?? globalThis.localStorage; if (!target?.setItem) return {ok: true, persisted: false}; target.setItem(PAINT_KEY, JSON.stringify(Object.fromEntries(VEHICLES.map(v => [v.id, normalize(state[v.id])])))); return {ok: true, persisted: true}; }
  catch { return {ok: true, persisted: false}; }
}
export function getPaint(vehicle, choice) {
  const normalized = normalize(choice), option = PAINT_COLORS.find(p => p.id === normalized.color), finish = PAINT_FINISHES.find(p => p.id === normalized.finish);
  return {id: option.id, color: option.color ?? getVehicle(vehicle).color, name: option.name, finish};
}
export function applyPaint(car, vehicle, choice) {
  const paint = getPaint(vehicle, choice), seen = new Set();
  car.group.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material.userData.bodyPaint || seen.has(material)) continue;
      seen.add(material);
      if (paint.id === 'factory' && material.userData.factoryColor) {
        material.color.set(material.userData.factoryColor);
        const finish = paint.finish.id === 'gloss' ? material.userData.factoryFinish : paint.finish;
        for (const name of ['metalness', 'roughness', 'clearcoat', 'clearcoatRoughness']) if (finish?.[name] !== undefined) material[name] = finish[name];
        continue;
      }
      material.color.set(paint.color);
      for (const name of ['metalness', 'roughness', 'clearcoat', 'clearcoatRoughness']) material[name] = paint.finish[name];
    }
  });
  return paint;
}
