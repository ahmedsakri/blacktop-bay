import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { TRACKS } from './src/track.js';
import { VEHICLES } from './src/vehicles.js';
import { renderCircuitPage, renderCarPage, renderCircuitSitemap } from './scripts/circuit-pages.mjs';

export default defineConfig({
  build: {rollupOptions: {input: {game: 'index.html', circuits: 'circuits/index.html', cars: 'cars/index.html'}}},
  plugins: [{
    name: 'circuit-pages', enforce: 'post',
    generateBundle(_, bundle) {
      const source = bundle['index.html']?.source;
      if (!source) this.error('The game entry page is required to build circuit pages.');
      for (const track of TRACKS) this.emitFile({type: 'asset', fileName: `circuits/${track.id}/index.html`, source: renderCircuitPage(source, track)});
      for (const vehicle of VEHICLES) this.emitFile({type: 'asset', fileName: `cars/${vehicle.id}/index.html`, source: renderCarPage(source, vehicle)});
      // Vite copies public files independently; they are not Rollup bundle entries.
      // Emit the extended sitemap explicitly so every built route is discoverable.
      const sitemap = readFileSync(fileURLToPath(new URL('./public/sitemap.xml', import.meta.url)), 'utf8');
      this.emitFile({type: 'asset', fileName: 'sitemap.xml', source: renderCircuitSitemap(sitemap)});
    },
  }],
});
