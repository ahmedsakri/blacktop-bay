import { getTrack } from './track.js';
import { circuitMapMarkup } from './collection-ui.js';
import { circuitPath } from './circuit-routes.js';
import { icon } from './icons.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function circuitScene(track) {
  if (track.id === 'summit' || track.scenery === 'cedar-ridge' || track.environment === 'parkland') return 'alpine';
  return ['desert', 'urban'].includes(track.environment) ? track.environment : 'coastal';
}

export function circuitSeriesLabel(track) {
  return track.series === 'original' ? 'CAMBER ORIGINAL' : track.calendarStatus === 'current' ? '2026 VENUE' : 'BONUS VENUE';
}

export function circuitCharacter(track) {
  if (track.character) return track.character;
  const styles = {harbor:'Flowing & technical', dockyard:'Tight & technical', coast:'Fast & open', summit:'Switchbacks', grandprix:'Race circuit'};
  return styles[track.id] || 'Arcade circuit';
}

export function circuitPreviewMarkup(track) {
  const route = getTrack(track.id);
  return `<div class="route-hero-art" aria-hidden="true" style="--venue-image:url('/assets/environments/${circuitScene(track)}.webp')"><span class="route-horizon"></span></div>
    <div class="route-hero-copy"><div class="route-hero-tags"><span>${escape(circuitSeriesLabel(track))}</span><span>${escape(track.country || track.region)}</span></div>
      <h2 id="selected-circuit-name">${escape(track.name)}</h2><p class="route-hero-description">${escape(track.description)}</p>
      <dl class="route-hero-stats"><div><dt>LAP DISTANCE</dt><dd>${(route.length / 1000).toFixed(2)} <small>KM</small></dd></div><div><dt>ROAD WIDTH</dt><dd>${route.width} <small>M</small></dd></div><div><dt>RACE LENGTH</dt><dd>03 <small>LAPS</small></dd></div></dl>
      <a class="route-primary" href="${circuitPath(track.id)}">${icon('flag')}<span>SELECT CIRCUIT</span>${icon('arrow-right')}</a><p class="route-next-step">Next: choose your car and race mode at Race HQ.</p>
    </div><div class="route-hero-map"><span class="route-map-label">${icon('route')} CIRCUIT LAYOUT</span><div class="route-hero-path" aria-label="${escape(track.name)} route">${circuitMapMarkup(route)}</div><span class="route-driving-character">${icon('steering')}${escape(circuitCharacter(track))}</span><small>In-game layout · ${escape(track.region)}</small></div>`;
}

export function circuitRouteCards(tracks, selected) {
  return tracks.map((track, index) => {
    const current = track.id === selected;
    return `<article class="route-card${current ? ' is-selected' : ''}" style="--venue-image:url('/assets/environments/${circuitScene(track)}.webp')" data-route-card="${escape(track.id)}">
      <button type="button" class="route-card-preview" data-circuit="${escape(track.id)}" aria-label="Preview ${escape(track.name)}" aria-pressed="${current}">
        <span class="route-card-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span class="route-card-series">${escape(circuitSeriesLabel(track))}</span>
        <span class="route-card-map" aria-hidden="true">${circuitMapMarkup(getTrack(track.id))}</span>
        <span class="route-card-place">${escape(track.country || track.region)}</span><span class="route-card-name">${escape(track.name)}</span><span class="route-card-distance">${(track.length / 1000).toFixed(2)} KM / LAP</span>
      </button><a class="route-card-select" href="${circuitPath(track.id)}" aria-label="Select ${escape(track.name)}">SELECT CIRCUIT ${icon('arrow-right')}</a>
    </article>`;
  }).join('');
}

export function circuitViewToolsMarkup() {
  return `<div class="route-view-tools"><div class="route-view-toggle" role="group" aria-label="Circuit display"><button type="button" data-circuit-view="strip" aria-pressed="true">${icon('route')}Route strip</button><button type="button" data-circuit-view="grid" aria-pressed="false">${icon('grid')}Full grid</button></div><div class="route-strip-arrows" role="group" aria-label="Browse route strip"><button type="button" data-strip-step="-1" aria-label="Previous circuits">${icon('arrow-left')}</button><button type="button" data-strip-step="1" aria-label="Next circuits">${icon('arrow-right')}</button></div></div>`;
}
