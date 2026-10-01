import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { TRACKS, getTrack } from '../src/track.js';
import { icon } from '../src/icons.js';
import { loadProgression } from '../src/progression.js';
import { findCircuits, circuitLibraryMarkup } from '../src/collection-browser.js';
import { circuitArtGeometry } from '../src/circuit-art.js';
import { circuitPreviewMarkup, circuitRouteCards, circuitScene, circuitSeriesLabel, circuitViewToolsMarkup } from '../src/circuit-atlas-view.js';

const source = readFileSync(new URL('../src/circuit-atlas.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');

test('all 34 circuits retain their own real route shape, measured distances and canonical selection links', () => {
  const cards = circuitRouteCards(TRACKS, 'suzuka');
  assert.equal((cards.match(/class="route-card(?: is-selected)?"/g) || []).length, 34);
  assert.equal((cards.match(/aria-pressed="true"/g) || []).length, 1);
  assert.equal((cards.match(/class="route-card-select"/g) || []).length, 34);
  const definitions = [...cards.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(definitions.length, new Set(definitions).size, 'SVG definitions remain unique across all cards');
  for (const track of TRACKS) {
    const preview = circuitPreviewMarkup(track);
    const route = getTrack(track.id);
    assert.ok(cards.includes(`data-circuit="${track.id}"`));
    assert.ok(cards.includes(`href="/circuits/${track.id}/"`));
    assert.ok(preview.includes(`href="/circuits/${track.id}/"`));
    assert.ok(preview.includes((route.length / 1000).toFixed(2)));
    assert.ok(preview.includes(`>${route.width} <small>M</small>`));
    assert.ok(preview.includes(circuitArtGeometry(route).path));
    assert.ok(cards.includes(circuitArtGeometry(route).path));
    assert.ok(preview.includes('Next: choose your car and race mode at Race HQ.'));
    assert.ok(existsSync(new URL(`../public/assets/environments/${circuitScene(track)}.webp`, import.meta.url)));
  }
});

test('circuit cards distinguish original/current/bonus layouts without inventing events or results', () => {
  assert.equal(circuitSeriesLabel(getTrack('harbor')), 'BLACKTOP ORIGINAL');
  assert.equal(circuitSeriesLabel(getTrack('suzuka')), '2026 VENUE');
  assert.equal(circuitSeriesLabel(getTrack('sakhir')), 'BONUS VENUE');
  const markup = circuitRouteCards(TRACKS, 'harbor') + circuitPreviewMarkup(getTrack('harbor'));
  assert.doesNotMatch(markup, /LIVE EVENT|ENDS IN|MULTIPLAYER|UNLOCKED|WORLD RECORD|\?track=/);
  assert.match(circuitViewToolsMarkup(), /aria-label="Circuit display"/);
  assert.match(circuitViewToolsMarkup(), /aria-label="Previous circuits"/);
  assert.match(circuitViewToolsMarkup(), /aria-label="Next circuits"/);
});

test('track content is escaped and environment art is restricted to existing scene names', () => {
  const data = {...TRACKS[0], name:'<script>x</script>', country:'" onmouseover="evil', description:'<img src=x>', region:'A & B', environment:'../../evil'};
  const markup = circuitRouteCards([data], data.id) + circuitPreviewMarkup(data);
  assert.ok(markup.includes('&lt;script&gt;x&lt;/script&gt;'));
  assert.ok(markup.includes('&lt;img src=x&gt;'));
  assert.ok(markup.includes('A &amp; B'));
  assert.doesNotMatch(markup, /<script>|<img src=x>|environments\/\.\./);
  assert.equal(circuitScene(data), 'coastal');
});

function classList() {
  const values = new Set();
  return {add:value=>values.add(value), contains:value=>values.has(value), toggle(value, on) {if(on ?? !values.has(value)) values.add(value); else values.delete(value);}};
}
function element(dataset={}) {
  return {dataset, classList:classList(), attrs:{}, children:[], scrollLeft:0, scrollWidth:1600, clientWidth:800,
    setAttribute(k,v){this.attrs[k]=v;}, insertAdjacentHTML(){}, focus(){this.focused=true;}, addEventListener(k,fn){this[k]=fn;},
    scrollBy(args){this.lastScroll=args;}, textContent:'', value:'', hidden:false};
}
function mount({track='harbor', reduced=false, credits=1200}={}) {
  const elements = Object.fromEntries(['atlas-credits','atlas-library','atlas-preview','circuit-count','circuit-library-grid','circuit-empty','circuit-search','circuit-region','reset-circuit-search','circuit-selection-status'].map(id=>[id,element()]));
  const grid = elements['circuit-library-grid'];
  const series = ['all','current','bonus','original'].map(circuitSeries=>element({circuitSeries}));
  const toggles = ['strip','grid'].map(circuitView=>element({circuitView}));
  const steps = [-1,1].map(stripStep=>element({stripStep:String(stripStep)}));
  const arrows = element();
  Object.defineProperty(grid, 'innerHTML', {set(markup) {
    this.children = [...markup.matchAll(/data-route-card="([^"]+)"/g)].map(([,id])=>{
      const card = element({routeCard:id}), button = element({circuit:id});
      card.querySelector = () => button;
      card.button = button;
      return card;
    });
  }});
  grid.querySelectorAll = () => grid.children;
  grid.contains = button => grid.children.some(card=>card.button===button);
  const document = {getElementById:id=>elements[id], addEventListener(type,fn){this[type]=fn;},
    querySelectorAll(selector){return selector==='[data-circuit-series]'?series:selector==='[data-circuit-view]'?toggles:steps;},
    querySelector(selector){return selector==='.route-strip-arrows'?arrows:selector.includes('"-1"')?steps[0]:steps[1];}};
  const writes = [];
  vm.runInNewContext(source, {document, TRACKS, getTrack, findCircuits, circuitLibraryMarkup, circuitPreviewMarkup, circuitRouteCards, circuitViewToolsMarkup, icon,
    loadProgression:()=>loadProgression({getItem:()=>JSON.stringify({version:1,credits}),setItem:(...args)=>writes.push(args)}),
    matchMedia:()=>({matches:reduced}), localStorage:{getItem:()=>JSON.stringify({track}),setItem:(...args)=>writes.push(args)}, ResizeObserver:class{observe(){}}});
  return {elements, grid, series, toggles, steps, arrows, writes, document, setCredits:value=>{credits=value;}};
}

test('changing a card preview preserves its focusable node and does not overwrite the saved race selection', () => {
  const {grid,elements,writes}=mount({track:'suzuka'});
  assert.match(elements['atlas-preview'].innerHTML, /Suzuka/);
  const card=grid.children.find(card=>card.dataset.routeCard==='cedar-ridge'), button=card.button;
  button.focus();
  grid.click({target:{closest:()=>button}});
  assert.equal(grid.children.find(card=>card.dataset.routeCard==='cedar-ridge'),card);
  assert.equal(button.focused,true);
  assert.equal(button.attrs['aria-pressed'],'true');
  assert.equal(grid.children.find(card=>card.dataset.routeCard==='suzuka').button.attrs['aria-pressed'],'false');
  assert.match(elements['atlas-preview'].innerHTML,/Cedar Ridge/);
  assert.match(elements['circuit-selection-status'].textContent,/Cedar Ridge preview selected/);
  assert.deepEqual(writes,[], 'only the explicit Select circuit link enters Race HQ selection');
});

test('search, region and series still intersect, and clearing an empty result restores all circuits', () => {
  const {elements,series,grid}=mount();
  elements['circuit-search'].oninput({target:{value:'Suzuka'}});
  assert.equal(grid.children.length,1);
  elements['circuit-region'].onchange({target:{value:'Europe'}});
  assert.equal(grid.children.length,0);
  assert.equal(elements['circuit-empty'].hidden,false);
  elements['reset-circuit-search'].onclick();
  assert.equal(grid.children.length,34);
  assert.equal(elements['circuit-search'].focused,true);
  assert.equal(elements['circuit-region'].value,'all');
  series.find(button=>button.dataset.circuitSeries==='current').onclick();
  assert.equal(grid.children.length,23);
  series.find(button=>button.dataset.circuitSeries==='bonus').onclick();
  assert.equal(grid.children.length,2);
  assert.equal(elements['circuit-count'].textContent,'2 of 34 circuits');
});

test('strip/grid switching preserves cards, hides irrelevant arrows and honours reduced motion when paging', () => {
  for (const reduced of [false,true]) {
    const {grid,toggles,arrows,steps}=mount({reduced});
    const before=grid.children;
    toggles[1].onclick();
    assert.equal(grid.classList.contains('route-grid'),true);
    assert.equal(arrows.hidden,true);
    assert.equal(toggles[1].attrs['aria-pressed'],'true');
    assert.equal(grid.children,before);
    toggles[0].onclick();
    assert.equal(arrows.hidden,false);
    assert.equal(steps[0].disabled,true);
    steps[1].onclick();
    assert.equal(grid.lastScroll.left,656);
    assert.equal(grid.lastScroll.behavior,reduced?'instant':'smooth');
    grid.scrollLeft=800;
    grid.scroll();
    assert.equal(steps[1].disabled,true);
    assert.equal(steps[0].disabled,false);
  }
});


test('header shows validated saved credits and refreshes after another tab changes the wallet without writing', () => {
  const {elements,document,writes,setCredits}=mount({credits:8765});
  assert.equal(elements['atlas-credits'].attrs['aria-label'],'8,765 saved upgrade credits');
  assert.match(elements['atlas-credits'].innerHTML, /race-icons\.svg\?v=20261002-2#credits/);
  setCredits(9900); document.visibilitychange();
  assert.equal(elements['atlas-credits'].attrs['aria-label'],'9,900 saved upgrade credits');
  assert.deepEqual(writes, []);
  const corrupt=mount({credits:'not-a-balance'});
  assert.equal(corrupt.elements['atlas-credits'].attrs['aria-label'],'1,200 saved upgrade credits');
  assert.deepEqual(corrupt.writes, []);
});
