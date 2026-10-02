import { illustratedCircuitMarkup } from './circuit-art.js';
import { normalizeUpgrades } from './progression.js';
import { icon } from './icons.js';
// Performance labels use the same upgraded numbers as the race simulation.
export function garageStatsMarkup(stats) {
  const rows = [
    ['Top speed', Math.round(stats.topSpeed * 3.6), 'KM/H', stats.topSpeed / 70, 'speedometer'],
    ['Acceleration', stats.acceleration.toFixed(1), 'M/S²', stats.acceleration / 23, 'acceleration'],
    ['Handling', stats.handling.toFixed(2), '×', stats.handling / 1.5, 'steering'],
    ['Nitro', stats.nitroCapacity.toFixed(1), 'SEC', stats.nitroCapacity / 6, 'nitro'],
  ];
  return rows.map(([label,value,unit,amount,symbol]) => `<div class="performance-row"><dt>${icon(symbol)}<span>${label}</span></dt><dd>${value} <small>${unit}</small></dd><i aria-hidden="true"><b style="width:${Math.max(0,Math.min(100,amount*100)).toFixed(1)}%"></b></i></div>`).join('');
}
export function garageBuildMarkup(upgrades) {
  const level=Object.values(normalizeUpgrades(upgrades)).reduce((sum,value)=>sum+value,0);
  return `<div class="garage-build-label"><span>${level===20?'FULLY UPGRADED':level===0?'STOCK BUILD':'YOUR BUILD'}</span><strong>${String(level).padStart(2,'0')}<small> / 20</small></strong></div><div class="garage-build-meter" role="meter" aria-label="Installed upgrade levels" aria-valuemin="0" aria-valuemax="20" aria-valuenow="${level}" aria-valuetext="${level} of 20 upgrade levels installed"><i style="width:${level*5}%"></i></div>`;
}
export function circuitMapMarkup(track) {
  return illustratedCircuitMarkup(track);
}
