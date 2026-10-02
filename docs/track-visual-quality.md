# Track materials and streetscape finish

This pass upgrades the shared renderer used by all 38 original arcade routes. It does not replace their driving layouts, collision widths, progression, or licensed vehicle models. The scenery remains authored browser-game geometry; it is not an exact reproduction of a commercial console game's environments.

## Visible changes

- The driving surface uses a real asphalt colour/normal/roughness set at its documented three-metre scale. Existing sector wear grades remain, but now preserve the underlying roughness texture instead of overwriting it. Wet-road reflection opacity was reduced so it does not conceal the road surface.
- Concrete barriers have a tapered crash-barrier profile within their previous collision envelope, with concrete colour and normal maps. Sidewalks, bridge piers and spectator terrace foundations share those maps with metre-scaled UVs.
- Drains have a recessed bed and individual metal crossbars, following the actual road elevation and grade. They are visual scenery, not new obstacles.
- Nearby city and waterfront blocks now have framed upper windows, bay depth, glazed entrances, canopies, cornices, parapets, roof equipment and planters. Original shop signs identify the street frontages. Night entrances use restrained static light pools without additional dynamic lights or shadow maps.
- Coastal building foundations extend beneath the waterline. Road-safe promenade links connect eligible neighbouring quays. Terrain relief has actual upward-facing mesh surfaces and conservative clearances from the complete route and existing scenery.
- San Francisco homes gain projecting bays, glazing, casings, sills, porches and floor cornices. Mobile uses face geometry for small window trim while retaining the projecting bay bodies.

## Sources and permissions

All externally sourced surface imagery comes from Poly Haven's [CC0 assets](https://polyhaven.com/license):

| Asset | Author | Use |
| --- | --- | --- |
| [Asphalt 02](https://polyhaven.com/a/asphalt_02) | Rob Tuytel | Road colour, OpenGL normal and roughness; documented 3 m width |
| [Concrete Wall 003](https://polyhaven.com/a/concrete_wall_003) | Dimitrios Savva (photography), Rico Cilliers (processing) | Barrier, pavement and structural colour/normal; documented 3 m height |
| [Rocky Terrain 02](https://polyhaven.com/a/rocky_terrain_02) | Amal Kumar | Ground/relief colour; documented 90 m width |

Downloaded 1K source JPEGs were resized and WebP encoded. Every derivative has source URL, source MD5, output SHA-256, dimensions, colour space and author recorded in `public/assets/environments/surfaces/provenance.json`. The optional `scripts/prepare-track-surfaces.mjs` reuses verified output and checks source/output hashes before regenerating. It does not add any runtime dependency or third-party network request.

Colour and data maps follow [Three.js colour-management guidance](https://threejs.org/manual/pages/color-management.html): colour is sRGB; normals and roughness have no colour-space conversion. Instancing and static material batches follow the engine's [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) approach to repeated geometry.

## Runtime bounds

Six texture objects are shared across each world, with no new per-frame loading. Desktop transfers **1,491,126 bytes**, phone transfers **333,204 bytes**. Estimated RGBA texture residency including mipmaps is **20 MiB desktop / 5 MiB mobile**. These figures are conservative uncompressed estimates, not a measured total GPU-memory claim. No production third-party texture URLs are requested.

The loader reserves final-size neutral canvases before the first render, then swaps in images with identical dimensions. This is required by Three.js/WebGL2's immutable texture allocation; a one-pixel placeholder cannot later grow merely by setting `needsUpdate`. The decoded CPU images remain available for WebGL context restoration. The loader validates dimensions before attaching a result, retains neutral fallback pixels after a failure, disposes its maps once, and prevents late responses from reattaching after disposal. World teardown calls `disposeSurfaceTextures()`.

`scene.userData.trackWorldDetail` records live geometry counts for frontages, streets, quays, relief and drains. New static groups use at most five draws for frontage material/sign/light layers, one for quay foundations, one for terrain relief and one for drains, plus the near-building shell batch. Distant/near building and overall scene costs vary with the circuit and view. These figures do not include existing cars, crowds, foliage, shadow passes or the optional reflection pass.

Mobile destination modules retain the pre-existing 20-draw / 16,000-triangle ceiling:

| Destination module | Draws | Triangles |
| --- | ---: | ---: |
| Fuji Skyline | 11 | 14,392 |
| San Francisco Hills | 17 | 14,934 |
| Norway Fjord | 16 | 9,860 |
| Singapore Afterdark | 13 | 5,238 |

These are the destination module's actual merged-geometry counts, not total scene counts. New street frontage layouts cap candidates at 22 on mobile / 34 on desktop and reject overlap with the full route, grandstands, landmarks, vegetation and race-service pockets. Terrain relief caps candidates at 20 / 32. Every added prop is outside the driving footprint; none changes physics.

## Verification

`tests/track-world-detail.test.js` validates real derivative hashes/dimensions, data-map colour spaces, texture bounds, loading failure/late-disposal handling, the barrier envelope, full-route clearance across all 38 routes, finite/upward-facing terrain, depth geometry, submerged quays and full promenade footprints. Existing destination and coastal-grounding tests continue to enforce geometry budgets and foundations.

`reports/track-world-review.html` is a local-only fixture using the actual `createWorld` renderer. It provides route, sector, chase/overview and mobile/desktop controls, loading/error counts and `window.trackReview` diagnostics. Its `textureProof` renders every actual map to a 128×128 GPU target and reads back pixel variation, detecting the difference between a downloaded image and a texture that has really replaced its fallback on the GPU. It initializes crowd assignment before freezing the scene. It is excluded from production output. Its screenshots are renderer checks, not completed races or real-phone performance tests.

The final mobile-detail Fuji renderer check showed **all six real maps**, no JavaScript errors and WebGL error **0**. GPU red-channel standard deviations were asphalt colour **4.788**, asphalt normal **2.519**, asphalt roughness **6.77**, concrete colour **39.6**, concrete normal **7.759**, and terrain colour **4.76**. Before the immutable-allocation repair all six were exactly zero; the readback therefore caught a real rendered-texture failure that a network/load counter missed. The final screenshot visibly showed asphalt cracks/aggregate, concrete weathering and terrain detail.

That checked view rendered **95 draws / 80,712 triangles** after distance culling and initial crowd assignment. It is one fixture camera, not a worst-case scene budget, frame-rate measurement or real-phone heat result. Earlier paused-only fixture counts were inflated because no first visibility update had occurred. Near Singapore street fronts and their ground were also inspected in the actual renderer; they remain stylized architecture, with improved depth and grounding rather than a claim of commercial-game visual parity.

Verification completed: **32/32** relevant scenery, destination and surface tests passed, followed by **10/10** surface/detail tests after the immutable-texture repair. All 12 prepared image outputs also passed the reproducibility script's hash verification without redownloading or modifying them.
