import { illustratedCircuitMarkup } from './circuit-art.js';
// Performance labels use the same upgraded numbers as the race simulation.
export function garageStatsMarkup(stats) {
  const rows = [
    ['Top speed', Math.round(stats.topSpeed * 3.6), 'KM/H', stats.topSpeed / 70],
    ['Acceleration', stats.acceleration.toFixed(1), 'M/S²', stats.acceleration / 23],
    ['Handling', stats.handling.toFixed(2), '×', stats.handling / 1.5],
    ['Nitro', stats.nitroCapacity.toFixed(1), 'SEC', stats.nitroCapacity / 6],
  ];
  return rows.map(([label,value,unit,amount]) => `<div class="performance-row"><dt>${label}</dt><dd>${value} <small>${unit}</small></dd><i aria-hidden="true"><b style="width:${Math.max(0,Math.min(100,amount*100)).toFixed(1)}%"></b></i></div>`).join('');
}
export function circuitMapMarkup(track) {
  return illustratedCircuitMarkup(track);
}
