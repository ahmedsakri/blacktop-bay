import { TRACKS } from '../src/track.js';
import { VEHICLES } from '../src/vehicles.js';
import { circuitPath } from '../src/circuit-routes.js';
import { carPath } from '../src/car-routes.js';

const ORIGIN = 'https://blacktop-bay.web.app';
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const json = value => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');

function renderGameEntry(source, {url, title, description, collectionName, collectionPath, name}) {
  const webpage = {
    '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${url}#webpage`, url,
    name: title, description, mainEntity: {'@id': `${ORIGIN}/#game`},
    isPartOf: {'@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: 'Blacktop Bay', url: `${ORIGIN}/`},
    breadcrumb: {'@type': 'BreadcrumbList', itemListElement: [
      {'@type': 'ListItem', position: 1, name: 'Blacktop Bay', item: `${ORIGIN}/`},
      {'@type': 'ListItem', position: 2, name: collectionName, item: ORIGIN + collectionPath},
      {'@type': 'ListItem', position: 3, name, item: url},
    ]},
  };
  let html = String(source)
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escape(title)}</title>`)
    .replace(/(<link\b[^>]*rel="canonical"[^>]*href=")[^"]+/, (_, prefix) => prefix + url);
  for (const [attribute, key, value] of [
    ['name', 'description', description], ['property', 'og:url', url], ['property', 'og:title', title],
    ['property', 'og:description', description], ['name', 'twitter:title', title], ['name', 'twitter:description', description],
  ]) {
    html = html.replace(new RegExp(`(<meta\\b[^>]*${attribute}="${key}"[^>]*content=")[^"]+`), (_, prefix) => prefix + escape(value));
  }
  return html.replace('</head>', `<script type="application/ld+json">${json(webpage)}</script>\n</head>`);
}

export function renderCircuitPage(source, track) {
  const title = `${track.name} — Blacktop Bay`;
  const description = `Race ${track.name} in Blacktop Bay. ${track.description} Choose from ${VEHICLES.length} cars for eight-car races or a solo time attack.`;
  return renderGameEntry(source, {url: ORIGIN + circuitPath(track.id), title, description,
    collectionName: 'Circuits', collectionPath: '/circuits/', name: track.name})
    .replace(/(<strong\b[^>]*id="circuit-name"[^>]*>)[\s\S]*?(<\/strong>)/, (_, prefix, suffix) => prefix + escape(track.name) + suffix);
}

export function renderCarPage(source, vehicle) {
  const title = `${vehicle.name} — Blacktop Bay Garage`;
  const description = `Inspect and race the ${vehicle.name} in Blacktop Bay. Choose your paint finish, upgrade engine, tyres, nitro and handling, and drive ${TRACKS.length} arcade circuits in your browser.`;
  return renderGameEntry(source, {url: ORIGIN + carPath(vehicle.id), title, description,
    collectionName: 'Cars', collectionPath: '/cars/', name: vehicle.name});
}

export function renderCircuitSitemap(source) {
  let xml = String(source);
  for (const path of ['/circuits/', ...TRACKS.map(track => circuitPath(track.id)), '/cars/', ...VEHICLES.map(vehicle => carPath(vehicle.id))]) {
    const url = ORIGIN + path;
    if (!xml.includes(`<loc>${url}</loc>`)) xml = xml.replace('</urlset>', `  <url><loc>${url}</loc></url>\n</urlset>`);
  }
  return xml;
}
