import { getUpgradeStats } from './physics.js';
import { getUpgradePreview, UPGRADE_COMPONENTS } from './progression.js';
import { getVehicle } from './vehicles.js';

const labels = {
  engine: ['Engine', 'Build speed sooner. Carry more pace down the straight.', '01'],
  tyres: ['Tyres', 'More grip through corners. Stronger braking on approach.', '02'],
  nitro: ['Nitro', 'A longer burst, stronger thrust and faster recharge.', '03'],
  handling: ['Handling', 'Quicker steering response. A sharper line through every turn.', '04'],
};
export const speedLabel = stats => `${Math.round(stats.topSpeed * 3.6)} km/h`;
export function upgradePanel(state, vehicle) {
  const car = getVehicle(vehicle), stats = getUpgradeStats(vehicle, state.cars[vehicle]);
  const cards = UPGRADE_COMPONENTS.map(component => {
    const [name, description, number] = labels[component];
    const preview = getUpgradePreview(state, vehicle, component);
    const next = getUpgradeStats(vehicle, preview.next || preview.current);
    const speedGain = ((next.topSpeed - stats.topSpeed) * 3.6).toFixed(1);
    const gain = component === 'engine' ? `+${Math.round((next.acceleration / stats.acceleration - 1) * 100)}% acceleration`
      : component === 'tyres' ? `+${Math.round((next.grip / stats.grip - 1) * 100)}% grip`
      : component === 'nitro' ? `+${(next.nitroCapacity - stats.nitroCapacity).toFixed(2)} sec boost`
      : `+${Math.round((next.steeringResponse / stats.steeringResponse - 1) * 100)}% steering response`;
    return `<section class="upgrade-card"><div class="upgrade-card-heading"><span>${number}</span><h3>${name}</h3><small>LEVEL ${preview.level} / 5</small></div><div class="upgrade-levels" aria-hidden="true">${Array.from({length:5},(_,i)=>`<i class="${i < preview.level?'filled':''}"></i>`).join('')}</div><p>${description}</p><div class="upgrade-gain">${preview.maxed ? 'Full performance unlocked' : `${gain}<span>+${speedGain} km/h top-speed rating</span>`}</div><button class="upgrade-buy" data-upgrade="${component}" aria-label="${preview.maxed ? `${name} fully upgraded` : `Upgrade ${name} to level ${preview.nextLevel} for ${preview.cost} credits`}" ${preview.maxed || !preview.affordable ? 'disabled' : ''}>${preview.maxed ? 'Fully upgraded' : `Upgrade to level ${preview.nextLevel}<strong>${preview.cost.toLocaleString()} CR</strong>`}</button>${!preview.maxed && !preview.affordable ? `<small class="upgrade-shortfall">${(preview.cost-state.credits).toLocaleString()} more credits needed</small>` : ''}</section>`;
  }).join('');
  return `<div class="workshop-overview"><div><span>YOUR ${car.name.toUpperCase()}</span><strong>${speedLabel(stats)}</strong><small>top-speed rating · before nitro</small></div><div class="workshop-balance"><span>AVAILABLE CREDITS</span><strong>${state.credits.toLocaleString()} <small>CR</small></strong><small>Earn more by finishing races.</small></div></div><div class="upgrade-grid">${cards}</div><p class="workshop-note">Five levels per component. Every upgrade also raises this car’s top-speed rating. Credits have no cash value. Progress saves on this device.</p>`;
}
