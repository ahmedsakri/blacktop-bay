# Track materials and continuous environments

Updated 3 October 2026. The shared renderer serves all 38 original arcade routes. Driving layouts, elevations, collision widths, ramp physics, progression and vehicle assets are unchanged. The scenery remains authored browser-game geometry; this is not a claim of Asphalt or console-game parity.

## Visible work

- Roads retain the real asphalt colour/normal/roughness set at its documented three-metre scale. Sector wear preserves the underlying roughness map.
- Sidewalks, terrace decks, access paths and urban forecourts use actual stone paving at 2.12 m scale. The previous stained wall photograph is no longer used on those floors. Terrace masonry shares the paving batch, retaining its draw bound.
- Tapered crash barriers retain their original collision envelope. Their concrete texture now contributes 24% of surface colour and a restrained normal amplitude, after renderer review found conspicuous brown wall stains. Broad urban ground uses 15% asphalt variation over a muted base.
- City plots have paved forecourts, raised borders, soil/hedge strips and checked paths to sidewalks and neighbouring plots. Coastal plots retain submerged foundations. These are actual meshes, capped at 30 mobile / 46 desktop plots, with three material draws.
- Continuous verges bridge the outer sidewalks to surrounding land; coastal verges have submerged skirts. Full strip footprints are checked against the entire route.
- San Francisco has a continuous, gently graded shoreline with an open-water suspension crossing. Tree roots and house foundations sample the actual rendered terrain triangles. The former isolated discs, steep bank strips and detached random towers are removed. Seventeen bay homes have projecting front bays, side/rear windows, sills, mullions and capped chimneys. Houses and vegetation are omitted through the bridge span.
- Fuji and other inland parkland routes have continuous rolling ground with flat pads blended around roads, trees and venue structures, replacing isolated round relief mounds. Road-adjacent grid cells are capped below the full driving surface.
- Broadleaf crowns use alpha-tested photographed leaf sprays on curved geometry. Mobile retains 340 triangles per crown; desktop uses 1,600 instead of the former 2,160. Branches share existing trunk batches. Canopy colour and rotation vary within the existing clearance radius. Conifers retain their separate bough geometry.
- Launch ramps now have sidewalls and an underside reaching the existing road, within the original ramp footprint. They add 10 triangles per ramp and no material draw.

The nine original flagship terrace landmarks remain: Fuji's teahouse, ridge observatory and forest beacon; San Francisco's clockhouse, stair hall and wind sculptures; Singapore's petal canopy, glazed prisms and lantern grove. Their finished beds, benches, railings and supported access walks retain the previous reserved footprints and distance culling. Decorative outer-rail openings remain aligned to these walks; driving barriers remain continuous.

## Sources and permissions

All external surface imagery is self-hosted from [Poly Haven CC0 sources](https://polyhaven.com/license):

| Asset | Author | Use |
| --- | --- | --- |
| [Asphalt 02](https://polyhaven.com/a/asphalt_02) | Rob Tuytel | Road colour, OpenGL normal and roughness; 3 m scale |
| [Concrete Wall 003](https://polyhaven.com/a/concrete_wall_003) | Dimitrios Savva, Rico Cilliers | Restrained barrier and structural colour/normal |
| [Pavement 02](https://polyhaven.com/a/pavement_02) | Charlotte Baglioni, Dario Barresi | Paving colour/normal; 2.12 m scale |
| [Rocky Terrain 02](https://polyhaven.com/a/rocky_terrain_02) | Amal Kumar | Ground colour; 90 m source coverage |
| [Potted Plant 02](https://polyhaven.com/a/potted_plant_02) | Rico Cilliers | Photographed leaf diffuse/opacity, cropped and assembled into an original 24-leaf spray |

The 1K source JPEGs are verified by MD5 before processing. `public/assets/environments/surfaces/provenance.json` records all 18 derivative files, exact source URLs/hashes, output SHA-256, dimensions, colour spaces and permissions. Leaf entries also record the alpha source and crop. `scripts/prepare-track-surfaces.mjs` and `scripts/foliage-derivative.mjs` reproduce the outputs and reject unexpected source or output bytes. These preparation tools add no production dependency or third-party request. Required vehicle and crowd notices remain separate.

Colour maps use sRGB; normal/roughness maps remain linear, following [Three.js colour management](https://threejs.org/manual/pages/color-management.html). Repeated geometry uses shared instancing or static material batches.

## Measured bounds

Nine maps are shared per world. The desktop transfer is **1,703,700 bytes**; mobile is **380,994 bytes**. Estimated uncompressed RGBA residency including mipmaps is **24 MiB desktop / 6 MiB mobile**, up by 4 MiB / 1 MiB for the dedicated paving and leaf cutout. These are surface estimates, not total GPU-memory measurements. No dynamic lights or shadow maps are added.

The loader reserves final image dimensions before its first GPU allocation, checks decoded dimensions, retains CPU sources for context restoration and disposes maps once. Failed leaf loads retain a shaped cutout fallback rather than opaque rectangular cards. Late loads cannot reattach after disposal.

| Mobile destination module | Draws | Triangles |
| --- | ---: | ---: |
| Fuji Skyline | 13 | 15,228 |
| San Francisco Hills | 13 | 13,392 |
| Singapore Afterdark | 7 | 6,352 |

All retain the existing **20-draw / 16,000-triangle** destination ceiling. Separate flagship terrace groups remain Fuji 21 draws / 6,672 triangles, SF 24 / 3,184, Singapore 22 / 8,448, excluding six sign-face triangles. These are module construction counts, not whole-scene costs or phone frame rates.

The SF continuous district uses one draw and 4,240 mobile / 9,480 desktop triangles. Inland relief replaces its former one-draw mound group and stays below 7,000 / 16,000 triangles. Plot/verge additions are bounded below 12,000 / 25,000 triangles across all 38 tested routes. Their material total is at most four draws; actual instanced trunk batches depend on spatial partitioning. Nearby plots and architectural detail retain distance culling.

## Verification and renderer evidence

**47/47 focused tests passed** across world lighting, destination driving/layout/scenery, showcase sites, coastal foundations, surfaces, vegetation and groundworks. Tests check both detail levels, complete road/plot/strip footprints across all 38 routes, full-lane terrain clearance, raycast ground contact, grounded scene pads, geometry finiteness, batch/triangle bounds, texture dimensions/hashes, alpha presence, colour spaces, loading failures and disposal. Lighting retains the established ranges; Singapore's effective key light remains 0.84. All 18 prepared outputs passed exact hash verification. After the all 38 recapture, another **17/17** preview/atlas/lobby checks passed (**64/64** combined).

`reports/track-world-review.html` is a local fixture using the actual `createWorld` renderer. Its dynamic map count and GPU readback include all nine maps. `scene.userData.trackWorldDetail` exposes parcels, verges, continuous terrain, frontages, quays and drains. The fixture also exposes camera/renderer state for repeatable review. It is excluded from production. Renderer screenshots, final all 38 preview refresh and any outstanding visual limits are recorded in `reports/environment-realism-2026-10-03.md` and the release report.

Catalogue previews are unique 960×540 WebP exports from this actual renderer. The manifest records camera pose, file hash, scene counts and per-map GPU proof. All 38 images were refreshed on 3 October with nine-map GPU evidence, totalling **1,462,496 bytes (1.39 MiB)**. Preview tests require the current map count and a catalogue below 4 MiB; stale previous-scene images fail the gate. The local capture receiver verifies existing entries before replacement, accepts only known track filenames from the loopback fixture origin and is stopped after capture. Stills establish rendered appearance, not completed races or exhaustive real-phone performance.
