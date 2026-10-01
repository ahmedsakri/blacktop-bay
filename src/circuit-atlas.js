import './circuit-atlas.css';
import { TRACKS, getTrack } from './track.js';
import { loadProgression } from './progression.js';
import { icon } from './icons.js';
import { circuitLibraryMarkup, findCircuits } from './collection-browser.js';
import { circuitPreviewMarkup, circuitRouteCards, circuitViewToolsMarkup } from './circuit-atlas-view.js';

const $ = id => document.getElementById(id);
const view = {query:'', region:'all', series:'all'};
const reducedMotion = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
let selected = 'harbor';
let display = 'strip';
try {
  const choices = JSON.parse(localStorage.getItem('blacktop-bay-choices-v1'));
  if (TRACKS.some(track => track.id === choices?.track)) selected = choices.track;
} catch {}

$('atlas-library').innerHTML = circuitLibraryMarkup(TRACKS);
$('circuit-count').insertAdjacentHTML('afterend', circuitViewToolsMarkup());
const grid = $('circuit-library-grid');
grid.classList.add('route-strip');
grid.setAttribute('aria-label', 'Circuit previews');

function updateCredits() {
  const count = loadProgression().credits.toLocaleString('en');
  $('atlas-credits').innerHTML = `${icon('credits')} <span>${count}<small>CREDITS</small></span>`;
  $('atlas-credits').setAttribute('aria-label', `${count} saved upgrade credits`);
}

function preview() {
  $('atlas-preview').innerHTML = circuitPreviewMarkup(getTrack(selected));
}

function updateStripButtons() {
  const arrows = document.querySelector('.route-strip-arrows');
  arrows.hidden = display === 'grid' || grid.children.length === 0;
  const max = grid.scrollWidth - grid.clientWidth;
  document.querySelector('[data-strip-step="-1"]').disabled = grid.scrollLeft <= 2;
  document.querySelector('[data-strip-step="1"]').disabled = grid.scrollLeft >= max - 2;
}

function refresh() {
  const matches = findCircuits(TRACKS, view);
  grid.innerHTML = circuitRouteCards(matches, selected);
  $('circuit-count').textContent = `${matches.length} of ${TRACKS.length} circuits`;
  $('circuit-empty').hidden = matches.length > 0;
  for (const button of document.querySelectorAll('[data-circuit-series]')) {
    button.setAttribute('aria-pressed', String(button.dataset.circuitSeries === view.series));
  }
  grid.scrollLeft = 0;
  updateStripButtons();
}

// Change the preview in place: the active card and its keyboard focus survive.
grid.addEventListener('click', event => {
  const button = event.target.closest('[data-circuit]');
  if (!button || !grid.contains(button)) return;
  selected = button.dataset.circuit;
  preview();
  for (const card of grid.querySelectorAll('[data-route-card]')) {
    const current = card.dataset.routeCard === selected;
    card.classList.toggle('is-selected', current);
    card.querySelector('[data-circuit]').setAttribute('aria-pressed', String(current));
  }
  $('circuit-selection-status').textContent = `${getTrack(selected).name} preview selected. Use Select circuit to continue.`;
});

$('circuit-search').oninput = event => { view.query = event.target.value; refresh(); };
$('circuit-region').onchange = event => { view.region = event.target.value; refresh(); };
for (const button of document.querySelectorAll('[data-circuit-series]')) {
  button.onclick = () => { view.series = button.dataset.circuitSeries; refresh(); };
}
$('reset-circuit-search').onclick = () => {
  Object.assign(view, {query:'', region:'all', series:'all'});
  $('circuit-search').value = '';
  $('circuit-region').value = 'all';
  refresh();
  $('circuit-search').focus();
};
for (const button of document.querySelectorAll('[data-circuit-view]')) {
  button.onclick = () => {
    display = button.dataset.circuitView;
    grid.classList.toggle('route-strip', display === 'strip');
    grid.classList.toggle('route-grid', display === 'grid');
    for (const toggle of document.querySelectorAll('[data-circuit-view]')) toggle.setAttribute('aria-pressed', String(toggle === button));
    if (display === 'strip') grid.scrollLeft = 0;
    updateStripButtons();
  };
}
for (const button of document.querySelectorAll('[data-strip-step]')) {
  button.onclick = () => grid.scrollBy({left: Number(button.dataset.stripStep) * grid.clientWidth * .82, behavior: reducedMotion() ? 'instant' : 'smooth'});
}
grid.addEventListener('scroll', updateStripButtons, {passive:true});
new ResizeObserver(updateStripButtons).observe(grid);
// This page only reads the wallet; race receipts remain the sole earning path.
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateCredits(); });
updateCredits();
preview();
refresh();
