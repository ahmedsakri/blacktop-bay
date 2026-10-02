# Rendering releases 2–3

The renderer preserves the existing 33 licensed silhouettes, player controls and authored material roles. This release reduces actual distant submission work and heavy texture residency, prepares maps/programs before reveal, and coordinates the three showcase environments. Geometry and download measurements below are reproducible file measurements, not physical-phone performance results.

## Adaptive rendering and preparation

Automatic quality now responds to sustained intervals above 150 ms, which the previous controller discarded indefinitely. At least four consecutive severe samples and two seconds of bounded accumulated pressure trigger a step down; each sample contributes at most 500 ms. The four-second downgrade cooldown and slow normal-frame recovery remain. Inactive work and isolated hitches do not trigger a downgrade. Severe samples also count in ordinary p75 windows, covering repeated alternating stalls without treating a single hitch as overload. Existing sharp mobile defaults and the 1× automatic pixel floor remain unchanged.

The application pauses active racing after a gap longer than 300 ms. Before that pause it calls `noteInterruption(nowMs)`: three active interruptions within 30 seconds reduce Auto by one level, with a four-second wall-time cooldown. Its bounded history survives paused sampling resets; isolated/duplicate/inactive reports and manual graphics choices do nothing. This changes graphics work without advancing the race clock or resuming play.

`configureManufacturerRenderer(renderer, {camera, scene})` configures self-hosted KTX2 support after renderer creation and after context restoration. It returns `{gpuCompressed, compressedCars}`. Compression is used only when ASTC, ETC, BPTC or S3TC is supported. Other devices load the original WebP assets. A failed compressed source/map releases its partial resources and retries the original source.

`prepareManufacturerInstances(renderer, models, {camera, scene, signal, onProgress})` serializes preparation for that renderer, uploads at most two unique texture objects between browser yields (with a timer fallback when animation frames are unavailable), and calls `compileAsync` per model against the intended scene's lights/environment. It accepts model wrappers or Object3Ds, does not change visibility, and rejects with AbortError after cancellation or detected context loss. Existing network loading remains capped at two requests. The application warms the fleet and each garage selection before reveal. Background distance models use the same warmup before becoming selectable, and context loss leaves their preparation retryable.

The source cache is capped by both two idle entries and **32 MiB of estimated idle geometry/texture storage**. Active instances retain their shared sources. A freshly prepared source has one task turn to be instantiated before idle trimming; rapid browsing cannot retain a catalogue of unused textures. Compressed texture estimates use actual transcoded mip byte arrays; ordinary maps use RGBA plus mip estimates. These are bounded accounting estimates, not a measurement of browser or driver memory.

## Real distant material batching

Distance geometry still totals **1,367,965 triangles**, versus **4,318,156** in the original low sources. This release additionally reduces the distant catalogue from **996 to 449 material primitives**, a **54.9%** reduction. Total distant GLB bytes decrease from **17,281,092 to 16,432,236** (4.9%). These are total catalogue counts; any individual frame draws only visible cars.

| Flagship | Original low primitives | New distant primitives |
| --- | ---: | ---: |
| Aventador | 31 | 13 |
| Ferrari 458 Italia | 32 | 10 |
| McLaren P1 GTR | 51 | 24 |
| Porsche 911 GT3 | 56 | 14 |
| Nissan GT-R 2018 | 49 | 13 |
| BMW i8 | 39 | 17 |

The pipeline bakes eligible opaque base colour, metallic/roughness and emission into small padded atlas tiles, then merges compatible primitives **within each existing mesh**. Body and four wheels remain separate. Named paint, animated lamps, transparent/glass optics, extension-bearing materials, unbounded/repeated UVs and nonstandard primitives are protected. Source near/high geometry, textures and attribution are untouched. UV remapping preserves vertex colour and normals; distant shaders already omit normal/bump/AO maps and clearcoat. Tiles contain 56 pixels of usable content with four-pixel edge padding, an intentional distance-only detail limit.

The existing 65/52 m hysteresis (scaled by quality) and 10 Hz distant visual wheel updates remain. All 33 decoded bounds are within **8.34 mm** of their low sources after simplification/quantization. Wheel pivot translations differ by at most **1.56 mm** through the same quantization; their names/orientations and independent animation remain intact. Automated checks verify actual binary hashes, triangles, primitive counts, protected roles and credits.

Reproduce with `scripts/prepare-distance-assets.mjs`. Its header pins glTF Transform 4.5.1, meshoptimizer 1.3.0 and sharp 0.34.5, installed into an isolated tools directory. No runtime dependency or original asset is replaced.

## Optional heavy-texture KTX2 path

Three texture-heavy low sources retain original geometry/UV/materials and receive optional mipmapped UASTC KTX2 derivatives. Khronos KTX-Software **4.4.2** encodes UASTC quality 2, RDO lambda 1 and Zstandard level 18. The renderer selects a supported GPU block format through Three.js KTX2Loader, with at most two transcoder workers. Transcoder JS/Wasm are self-hosted under `/assets/basis/`; Apache and Three.js license files are included. Production CSP explicitly permits the loader's local blob workers.

| Car | Original GLB bytes | KTX2 GLB bytes | RGBA+mip texture estimate | Conservative 8bpp+mip estimate |
| --- | ---: | ---: | ---: | ---: |
| McLaren P1 GTR | 1,429,772 | 4,220,392 | 68 MiB | 17 MiB |
| Porsche 930 Turbo | 2,346,336 | 4,843,888 | 30 MiB | 7.50 MiB |
| Lamborghini Gallardo | 894,272 | 1,754,232 | 24.33 MiB | 6.08 MiB |

The trial deliberately trades a larger transfer for approximately **75% smaller texture block storage** at an 8bpp target. Some supported opaque formats use fewer bits; actual allocation includes driver overhead and mip block rounding. It is not a claim that compressed textures download faster. The original WebP variants remain the failure/capability fallback. No catalogue-wide KTX2 expansion or higher source texture resolution is introduced.

Reproduce with `node scripts/prepare-compressed-cars.mjs --toktx /path/to/toktx`; the same isolated asset tools are used. Generated manifests record original/derivative SHA-256 values and embedded source, author and license credits are retained.

## Showcase and finish changes

Harbor Flow, Fuji Skyline and San Francisco Hills share authored sky tint, fog, sun/fill colour and reflection intensity profiles. Once the existing panorama loads, one bounded reflection map rebuild captures that same graded sky. There is no per-frame environment capture. Low-detail environment maps use a 128-pixel PMREM cube source, high detail 256. Both world and garage own their complete reflection render targets and expose synchronous `rebuildEnvironment()` and idempotent `disposeEnvironment()`; replacement is installed before the old target is disposed. Context restoration regenerates these resources before play resumes.

Harbor sails gain visible tension edges; Fuji pavilions gain ridge/eave trim and timber braces; San Francisco shelters gain fascia, braces and readable twelve-mark clocks. Added pieces join the existing sector/material batches, retaining the existing 19/21/27 respective sector draw ceilings. The three viewing terraces retain 24 low-detail or 42 high-detail spectators total; coordinated regional clothing and one filming observer per terrace use existing instanced anatomy, proximity animation and motion limits. Grandstand sound metadata now includes the actual track height.

San Francisco grounding was corrected after actual fixture review exposed a 0.35 m air gap beneath the old terrace pedestal. Each terrace now has six visible piers reaching a 17 m quay that extends to −3.15 m, below the −0.65 m sea. The 22 houses receive submerged concrete footings and shoreline shelves; vegetation receives low, spatially batched ground shelves that stay outside the drivable footprint. These add 14 batches/2,840 triangles at low detail or 15 batches/4,440 triangles at high detail. The destination architecture changes from 15 to 16 draws and 10,414 to 11,822 triangles; the existing 20-draw/16,000-triangle low-detail ceiling remains. The showcase sector ceiling remains 27 draws. Actual mesh raycasts verify support beneath every spectator, house and tree origin, submerged depth and road clearance. Root browser QA confirmed the revised fixture reads as supported architecture; this remains fixture evidence rather than a full-game device measurement.

Six original finish profiles distinguish the Aventador, 458, P1, GT3, GT-R and i8 with restrained clearcoat/roughness differences. They apply only to identified physical body-paint materials. Source maps, metal/roughness response, glass, carbon, badges and livery remain; saved satin/metallic/custom paint still overrides the factory presentation and factory gloss restores it. Distance cars retain their cheaper standard materials.

## Verification scope

Targeted automated tests cover severe-frame adaptation, bounded GPU batches, cancellation/context restoration, byte-limited idle caching, compressed failure fallback, all generated asset contracts, finish restoration, environment ownership and batched showcase geometry. The local `reports/rendering-upgrade-review.html` fixture uses production shaders and supports three circuits, six flagship selections, near/distant geometry and KTX2 capability diagnostics. It remains excluded from the production build. Browser gameplay/recovery checks are recorded separately by the release coordinator; a fixture and desktop touch simulation are not physical-phone FPS, temperature or battery measurements.
