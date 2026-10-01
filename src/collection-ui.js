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
  const points = track.samples.filter((_, i) => i % 4 === 0);
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
  const scale = 140 / Math.max(maxX - minX, maxZ - minZ, 1);
  const x = p => (90 + (p.x-(minX+maxX)/2)*scale).toFixed(1);
  const y = p => (90 + (p.z-(minZ+maxZ)/2)*scale).toFixed(1);
  const d = points.map((p,i) => `${i ? 'L' : 'M'}${x(p)},${y(p)}`).join(' ')+'Z';
  return `<svg viewBox="0 0 180 180" fill="none"><path d="${d}" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="${x(points[0])}" cy="${y(points[0])}" r="5" fill="#ffd269" stroke="#101924" stroke-width="2"/></svg>`;
}
