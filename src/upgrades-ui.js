import { getUpgradeStats } from './physics.js';
import { getUpgradePreview, UPGRADE_COMPONENTS, MAX_LEVEL } from './progression.js';
import { getVehicle } from './vehicles.js';
import { icon } from './icons.js';

const components = {
  engine: {
    name: 'Engine', number: '01', accent: '#f19672',
    description: 'Get up to speed sooner. Carry more pace down the straight.',
    icon: '<path d="M8 10h15l4 5h4v12h-7l-4 4H9l-4-5V15h3Zm6 0V6h8M1 17v10m4-5H1m30-3h4v8h-4"/><path d="m17 14-5 8h6l-3 6 10-11h-7l3-3"/>',
    metrics: (stats, stock) => [
      ['Acceleration', 'm/s²', stats.acceleration.toFixed(1)],
      ['Top speed', 'km/h', (stats.topSpeed * 3.6).toFixed(1)],
    ],
    gain: (now, next) => `+${((next.acceleration / now.acceleration - 1) * 100).toFixed(1)}% acceleration`,
  },
  tyres: {
    name: 'Tyres', number: '02', accent: '#8bd5c0',
    description: 'Hold your line through corners. Brake harder on the way in.',
    icon: '<circle cx="18" cy="19" r="14"/><circle cx="18" cy="19" r="9"/><circle cx="18" cy="19" r="3"/><path d="m7 8 3 4m-6 5h5m-2 13 4-4m7 7v-5m11 2-4-4m7-7h-5M28 8l-4 5M18 5v5"/>',
    metrics: (stats, stock) => [
      ['Cornering grip', '× stock', (stats.grip / stock.grip).toFixed(2)],
      ['Braking power', '× stock', (stats.braking / stock.braking).toFixed(2)],
    ],
    gain: (now, next) => `+${((next.grip / now.grip - 1) * 100).toFixed(1)}% cornering grip`,
  },
  nitro: {
    name: 'Nitro', number: '03', accent: '#eed18b',
    description: 'Stay on boost longer. Recharge faster for the next straight.',
    icon: '<path d="M14 3h8m-4 0v5m-5 0h10v5c4 2 5 5 5 9v8a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4v-8c0-4 1-7 5-9Z"/><path d="m21 16-7 9h5l-2 6 7-10h-5Z"/>',
    metrics: (stats, stock) => [
      ['Boost duration', 'seconds', stats.nitroCapacity.toFixed(2)],
      ['Recharge rate', '× stock', (stats.recharge / stock.recharge).toFixed(2)],
    ],
    gain: (now, next) => `+${(next.nitroCapacity - now.nitroCapacity).toFixed(2)} sec boost`,
  },
  handling: {
    name: 'Handling', number: '04', accent: '#aebce8',
    description: 'Respond faster to each input. Place the car with precision.',
    icon: '<circle cx="18" cy="19" r="14"/><circle cx="18" cy="19" r="4"/><path d="m4 15 10 3m8 0 10-3M18 23v10M8 9c6-4 14-4 20 0M8 26l6-6m14 6-6-6"/>',
    metrics: (stats, stock) => [
      ['Steering response', '× stock', (stats.steeringResponse / stock.steeringResponse).toFixed(2)],
      ['Cornering grip', '× stock', (stats.grip / stock.grip).toFixed(2)],
    ],
    gain: (now, next) => `+${((next.steeringResponse / now.steeringResponse - 1) * 100).toFixed(1)}% steering response`,
  },
};
const formatCredits = value => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)).toLocaleString();
export const speedLabel = stats => `${Math.round(stats.topSpeed * 3.6)} km/h`;

export function upgradePanel(state, vehicle, setup = 'balanced') {
  const car = getVehicle(vehicle), stats = getUpgradeStats(car.id, state?.cars?.[car.id], setup);
  const stock = getUpgradeStats(car.id, {}), credits = Number.isSafeInteger(state?.credits) ? Math.max(0, state.credits) : 0;
  let installed = 0;
  const cards = UPGRADE_COMPONENTS.map(component => {
    const spec = components[component], preview = getUpgradePreview(state, car.id, component);
    const next = getUpgradeStats(car.id, preview.next || preview.current, setup);
    const currentMetrics = spec.metrics(stats, stock), nextMetrics = spec.metrics(next, stock);
    installed += preview.level;
    const metricRows = currentMetrics.map(([name, unit, value], i) => `<div class="upgrade-metric"><dt>${name}<small>${unit}</small></dt><dd><span class="upgrade-now"><span class="workshop-sr">Current: </span>${value}</span><span class="upgrade-arrow" aria-hidden="true">${icon('arrow-right')}</span><strong class="upgrade-next"><span class="workshop-sr">${preview.maxed ? 'Installed' : 'Next level'}: </span>${nextMetrics[i][2]}</strong></dd></div>`).join('');
    const shortfall = !preview.maxed && !preview.affordable;
    const status = preview.maxed ? 'All five levels fitted.' : shortfall
      ? `${formatCredits(preview.cost - credits)} more credits needed`
      : `${formatCredits(credits - preview.cost)} CR left after this upgrade`;
    const speedGain = ((next.topSpeed - stats.topSpeed) * 3.6).toFixed(1);
    return `<section class="upgrade-card${preview.maxed ? ' is-maxed' : ''}${shortfall ? ' needs-credits' : ''}" style="--component-accent:${spec.accent}" aria-labelledby="upgrade-${component}-title">
      <div class="upgrade-card-heading"><span class="upgrade-icon" aria-hidden="true"><svg viewBox="0 0 36 38">${spec.icon}</svg></span><div><span class="upgrade-component-number">COMPONENT ${spec.number}</span><h3 id="upgrade-${component}-title">${spec.name}</h3></div><small id="upgrade-${component}-level">${preview.level}<span> / ${MAX_LEVEL}</span></small></div>
      <div class="upgrade-levels" aria-label="${spec.name} level ${preview.level} of ${MAX_LEVEL}">${Array.from({ length: MAX_LEVEL }, (_, i) => `<i aria-hidden="true" class="${i < preview.level ? 'filled' : i === preview.level ? 'next' : ''}"></i>`).join('')}</div>
      <p class="upgrade-description">${spec.description}</p>
      <div class="upgrade-gain">${preview.maxed ? 'Maximum level installed' : spec.gain(stats, next)}</div>
      <div class="upgrade-comparison-heading" aria-hidden="true"><span>PERFORMANCE</span><span>NOW <i>${icon('arrow-right')}</i> ${preview.maxed ? 'FITTED' : 'NEXT'}</span></div>
      <dl class="upgrade-metrics">${metricRows}</dl>
      <div class="upgrade-speed-gain">${preview.maxed ? `${speedLabel(stats)} current top-speed rating` : `Also +${speedGain} km/h top-speed rating`}</div>
      <button type="button" class="upgrade-buy" data-upgrade="${component}" aria-describedby="upgrade-${component}-status" aria-label="${preview.maxed ? `${spec.name} fully upgraded` : `Upgrade ${spec.name} to level ${preview.nextLevel} for ${preview.cost} credits`}" ${preview.maxed || !preview.affordable ? 'disabled' : ''}><span class="upgrade-buy-label">${icon(preview.maxed ? 'check' : 'wrench')}<span>${preview.maxed ? 'Fully upgraded' : `Fit level ${preview.nextLevel}`}</span></span><strong>${preview.maxed ? 'MAX' : `${formatCredits(preview.cost)} <small>CR</small>${icon('arrow-right', 'upgrade-buy-arrow')}`}</strong></button>
      <small id="upgrade-${component}-status" class="upgrade-purchase-note${shortfall ? ' upgrade-shortfall' : ''}">${status}</small>
    </section>`;
  }).join('');
  return `<div class="workshop-overview">
    <div class="workshop-car"><span class="workshop-race-number" style="--car-paint:${car.color}" aria-hidden="true">${car.number}</span><div class="workshop-car-copy"><span class="workshop-kicker">YOUR ${car.family.toUpperCase()} RACE BUILD</span><strong>${car.name}</strong><small>${car.specs.body} <span aria-hidden="true">·</span> ${installed} / ${UPGRADE_COMPONENTS.length * MAX_LEVEL} upgrades fitted</small></div></div>
    <div class="workshop-balance"><span>AVAILABLE CREDITS</span><strong>${formatCredits(credits)} <small>CR</small></strong><small>Earn more by finishing races.</small></div>
  </div>
  <div class="workshop-current"><span>YOUR CURRENT SETUP</span><span><b>${speedLabel(stats)}</b> before nitro</span><span><b>${stats.nitroCapacity.toFixed(2)} sec</b> boost duration</span></div>
  <div class="upgrade-grid">${cards}</div>
  <p id="upgrade-status" class="workshop-status" role="status" aria-live="polite">Compare your current setup with the next level.</p>
  <p class="workshop-note">“× stock” compares performance with this car’s original setup. Upgrades apply to this car only. Progress stays on this device. Race credits have no cash value.</p>`;
}
