import { icon } from './icons.js';
import { VEHICLES } from './vehicles.js';
import { getUpgradeStats } from './physics.js';
import { circuitMapMarkup } from './collection-ui.js';
import { getTrack } from './track.js';
import { LATEST_CAR_IDS } from './car-releases.js';

export const NEW_CARS = new Set(LATEST_CAR_IDS.filter(id => VEHICLES.some(car => car.id === id)));
const releaseOrder = new Map(LATEST_CAR_IDS.map((id, index) => [id, index]));
const FAVORITES_KEY = 'blacktop-bay-favorites-v1';
const validIds = new Set(VEHICLES.map(car => car.id));
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function loadFavorites(storage) {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(FAVORITES_KEY);
    const ids = typeof raw === 'string' && raw.length < 4000 ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter(id => validIds.has(id)) : []);
  } catch { return new Set(); }
}
export function saveFavorites(ids, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target?.setItem) return false;
    target.setItem(FAVORITES_KEY, JSON.stringify([...ids].filter(id => validIds.has(id))));
    return true;
  } catch { return false; }
}
const searchText = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export function hasCarFilters({query = '', family = 'all', brand = 'all', favoritesOnly = false} = {}) {
  return Boolean(query.trim() || family !== 'all' || brand !== 'all' || favoritesOnly);
}
export function clearCarFilters(view = {}) {
  return {...view, query: '', family: 'all', brand: 'all', favoritesOnly: false};
}
export function findCars({ query = '', family = 'all', brand = 'all', sort = 'latest', favoritesOnly = false, favorites = new Set(), progression = {} } = {}) {
  const terms = query.trim().split(/\s+/).map(searchText).filter(Boolean);
  return VEHICLES.filter(car => (family === 'all' || car.family === family)
    && (brand === 'all' || car.brand === brand)
    && (!favoritesOnly || favorites.has(car.id))
    && terms.every(term => searchText(`${car.brand} ${car.name} ${car.family} ${car.specs.body} ${car.specs.character}`).includes(term)))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'speed' || sort === 'handling') {
        const key = sort === 'speed' ? 'topSpeed' : 'handling';
        return getUpgradeStats(b.id, progression.cars?.[b.id])[key] - getUpgradeStats(a.id, progression.cars?.[a.id])[key]
          || a.name.localeCompare(b.name);
      }
      return (releaseOrder.get(a.id) ?? LATEST_CAR_IDS.length) - (releaseOrder.get(b.id) ?? LATEST_CAR_IDS.length)
        || VEHICLES.indexOf(a) - VEHICLES.indexOf(b);
    });
}
export function carLibraryMarkup() {
  return `<div class="library-tools library-tools-cars"><label class="library-search"><span>FIND YOUR NEXT CAR</span><input id="car-search" type="search" placeholder="Search car, maker or style" autocomplete="off" maxlength="80" /></label><label class="library-sort"><span>MANUFACTURER</span><select id="car-brand"><option value="all">Every manufacturer</option>${[...new Set(VEHICLES.map(car => car.brand).filter(Boolean))].sort().map(brand => `<option value="${escape(brand)}">${escape(brand)}</option>`).join('')}</select></label><label class="library-sort"><span>SORT BY</span><select id="car-sort"><option value="latest">Latest arrivals</option><option value="speed">Top speed</option><option value="handling">Handling</option><option value="name">Name A–Z</option></select></label></div>
  <div class="library-filter-row"><div class="library-families" role="group" aria-label="Browse car families">${['all', ...(new Set(VEHICLES.map(car => car.family)).size > 1 ? new Set(VEHICLES.map(car => car.family)) : [])].map(family => `<button type="button" data-library-family="${family}" aria-pressed="${family === 'all'}">${family === 'all' ? 'All cars' : family === 'gt' ? 'GT' : family[0].toUpperCase() + family.slice(1)}<span>${family === 'all' ? VEHICLES.length : VEHICLES.filter(car => car.family === family).length}</span></button>`).join('')}</div><button id="favorites-only" type="button" aria-pressed="false">${icon('star')} Favourites</button></div>
  <div class="library-summary"><p id="library-count" role="status" aria-live="polite"></p><div class="library-summary-actions"><label><input type="checkbox" id="compare-cars" /> Compare with your car</label><button id="clear-car-filters" type="button" disabled>Clear filters</button></div></div>
  <div id="car-library-grid" class="car-library-grid"></div><div id="library-empty" class="library-empty" hidden><strong>No cars in this view.</strong><p>Try another search, or star a car to save it to your favourites.</p><button id="reset-car-search" class="button secondary" type="button">SHOW ALL CARS</button></div>
  <p class="library-note">All cars are ready to race. Performance figures and comparisons include your saved upgrades and describe this arcade game. Images show original model finishes. Independent car representations; no manufacturer affiliation.</p>`;
}
const PERFORMANCE_METRICS = [
  {key: 'topSpeed', label: 'Top speed', unit: 'km/h', scale: 3.6, digits: 1, displayDigits: 0},
  {key: 'acceleration', label: 'Acceleration', unit: 'm/s²', scale: 1, digits: 1, displayDigits: 1},
  {key: 'handling', label: 'Handling', unit: '×', scale: 1, digits: 2, displayDigits: 2},
  {key: 'nitroCapacity', label: 'Nitro', unit: 'sec', scale: 1, digits: 1, displayDigits: 1},
];
export function carLibraryCard(car, { selected, favorites = new Set(), progression = {}, compare = false } = {}) {
  const stats = getUpgradeStats(car.id, progression.cars?.[car.id]);
  const current = getUpgradeStats(selected, progression.cars?.[selected]);
  const currentCar = VEHICLES.find(candidate => candidate.id === selected);
  const ratings = PERFORMANCE_METRICS.map(({key, label, unit, scale, displayDigits}) =>
    `<span><span>${label}</span><b>${(stats[key] * scale).toFixed(displayDigits)}</b> <small>${unit}</small></span>`).join('');
  const delta = compare && currentCar && car.id !== selected ? `<div id="car-comparison-${car.id}" class="library-comparison" aria-label="Compared with ${escape(currentCar.name)}"><strong>VERSUS YOUR CAR</strong>${PERFORMANCE_METRICS.map(({key, label, unit, scale, digits}) => {
    const difference = Number(((stats[key] - current[key]) * scale).toFixed(digits));
    const value = difference === 0 ? 'Same' : `${difference > 0 ? '+' : ''}${difference.toFixed(digits)} ${unit}`;
    return `<span><span>${label}</span><b>${value}</b></span>`;
  }).join('')}</div>` : '';
  return `<article class="library-car${car.id === selected ? ' is-selected' : ''}" style="--car-color:${car.color}"><button type="button" class="library-inspect" data-library-car="${car.id}" aria-label="Inspect ${escape(car.name)}${car.id === selected ? ', current car' : ''}" aria-describedby="car-stats-${car.id}${delta ? ` car-comparison-${car.id}` : ''}"><div class="library-card-head"><span>${escape(car.brand || car.family.toUpperCase())}</span><span>${car.id === selected ? 'YOUR CAR' : NEW_CARS.has(car.id) ? 'NEW ARRIVAL' : 'READY TO RACE'}</span></div><img data-car-portrait="${car.id}" width="400" height="200" alt="" /><h3>${escape(car.name)}</h3><p>${escape(car.specs.body)}</p><div id="car-stats-${car.id}" class="library-ratings">${ratings}</div>${delta}<span class="library-inspect-label">${car.id === selected ? 'BACK TO YOUR CAR' : 'INSPECT CAR'} ${icon('arrow-up-right')}</span></button><button class="library-favorite" type="button" data-favorite="${car.id}" aria-label="Favourite ${escape(car.name)}" aria-pressed="${favorites.has(car.id)}">${icon('star')}</button></article>`;
}
const circuitStyles = {harbor:'Flowing & technical', dockyard:'Tight & technical', coast:'Fast & open', summit:'Switchbacks', grandprix:'Race circuit'};
export function findCircuits(tracks, {query = '', series = 'all', region = 'all'} = {}) {
  const search = query.trim().toLowerCase();
  return tracks.filter(track => (series === 'all' || (series === 'bonus' ? track.calendarStatus === 'original-calendar-bonus' : series === 'current' ? track.calendarStatus === 'current' : track.series === series))
    && (region === 'all' || track.region === region)
    && `${track.name} ${track.venueName || ''} ${track.country || ''} ${track.region || ''} ${track.description}`.toLowerCase().includes(search));
}
export function circuitLibraryMarkup(tracks) {
  const regions = [...new Set(tracks.map(track => track.region).filter(Boolean))].sort();
  const counts = Object.fromEntries(['current', 'bonus', 'original'].map(series => [series, findCircuits(tracks, { series }).length]));
  return `<p class="circuit-library-intro">Choose your next three-lap race. Explore ${counts.current} current Grand Prix venues, ${counts.bonus} bonus venues and ${counts.original} Blacktop Bay originals.</p>
  <div class="library-tools"><label class="library-search"><span>FIND A CIRCUIT</span><input id="circuit-search" type="search" placeholder="Search venue, country or character" autocomplete="off" maxlength="80" /></label><label class="library-sort"><span>REGION</span><select id="circuit-region"><option value="all">Every region</option>${regions.map(region => `<option>${escape(region)}</option>`).join('')}</select></label></div>
  <div class="library-filter-row"><div class="library-families" role="group" aria-label="Circuit collection"><button type="button" data-circuit-series="all" aria-pressed="true">All circuits <span>${tracks.length}</span></button><button type="button" data-circuit-series="current" aria-pressed="false">2026 venues <span>${counts.current}</span></button><button type="button" data-circuit-series="bonus" aria-pressed="false">Bonus <span>${counts.bonus}</span></button><button type="button" data-circuit-series="original" aria-pressed="false">Originals <span>${counts.original}</span></button></div></div>
  <p class="circuit-disclosure">Real-world venues use compact arcade adaptations with wider corners and flatter terrain. Lap lengths below are in-game distances. Independently made; not affiliated with Formula 1.</p>
  <p id="circuit-count" class="circuit-count" role="status" aria-live="polite"></p><div id="circuit-library-grid" class="circuit-library"></div><div id="circuit-empty" class="library-empty" hidden><strong>No circuits in this view.</strong><p>Try another country or clear your filters.</p><button id="reset-circuit-search" class="button secondary" type="button">${icon('route')} SHOW ALL CIRCUITS</button></div>`;
}
export function circuitLibraryCards(tracks, selected) {
  return tracks.map(track => `<button type="button" class="circuit-option${track.id === selected ? ' is-selected' : ''}" data-circuit="${track.id}" aria-label="Choose ${escape(track.name)}" aria-pressed="${track.id === selected}"><div class="circuit-option-art" aria-hidden="true">${circuitMapMarkup(getTrack(track.id))}</div><div><span class="circuit-option-kicker">${track.series === 'grand-prix' ? `${escape(track.country)} / ${track.calendarStatus === 'current' ? '2026 VENUE' : 'BONUS VENUE'}` : `BLACKTOP ORIGINAL / ${escape(track.character || circuitStyles[track.id] || 'Original circuit')}`}</span><h3>${escape(track.name)}</h3><p>${escape(track.description)}</p><div class="circuit-option-meta"><span>${(track.length/1000).toFixed(2)} KM / LAP</span><span>${track.id === selected ? 'SELECTED' : 'RACE HERE'} ${icon(track.id === selected ? 'check' : 'arrow-up-right')}</span></div></div></button>`).join('');
}
