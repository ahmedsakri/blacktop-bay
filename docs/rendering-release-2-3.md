# Rendering releases 2–3

The renderer preserves the existing 33 licensed silhouettes, player controls and authored material roles. This release reduces actual distant submission work and heavy texture residency, prepares maps/programs before reveal, and coordinates all 38 environments with regional grades while retaining the three showcase overrides. Geometry and download measurements below are reproducible file measurements, not physical-phone performance results.

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

## Catalogue-wide optional KTX2 path

All 33 low-detail catalogue sources are reviewed. All 22 sources with texture maps retain their original geometry/UV/materials and receive optional mipmapped UASTC KTX2 derivatives (241 maps total). The other 11 sources use authored material colours without maps, so no redundant texture assets are generated. Khronos KTX-Software **4.4.2** encodes UASTC quality 2, RDO lambda 1 and Zstandard level 18. The renderer selects a supported GPU block format through a bounded Three.js KTX2Loader, with at most two transcoder workers and a 15-second per-operation deadline. Transcoder JS/Wasm are self-hosted under the fingerprinted `/assets/basis/csp-d9c47f3ce0aee215/` path. The JavaScript wrapper is a hash-pinned, synchronous no-eval adaptation of the official Emscripten 3.1.51 closure paths; Wasm is unchanged. Apache, Three.js MIT and Emscripten MIT/NCSA notices are included. Production CSP permits local blob workers and Wasm compilation, without allowing JavaScript string execution. See `public/assets/basis/README.md` for precise provenance, scope and reproduction.

| Car | Original GLB bytes | KTX2 GLB bytes | RGBA+mip texture estimate | Conservative 8bpp+mip estimate |
| --- | ---: | ---: | ---: | ---: |
| McLaren P1 GTR | 1,429,772 | 4,220,392 | 68 MiB | 17 MiB |
| Porsche 930 Turbo | 2,346,336 | 4,843,888 | 30 MiB | 7.50 MiB |
| Lamborghini Gallardo | 894,272 | 1,754,232 | 24.33 MiB | 6.08 MiB |

Across the 22 textured cars, original GLBs total **33,290,472 bytes**, versus **50,843,004 bytes** for the optional KTX2 derivatives. Estimated RGBA+mip texture storage is **300,906,049 bytes**, versus **75,230,821 bytes** at an 8bpp block target (approximately **75% smaller**). These are catalogue totals, not simultaneous residency: individual cars load on demand through the existing bounded cache. The pipeline deliberately trades a larger transfer for lower texture storage. Some supported opaque formats use fewer bits; actual allocation includes driver overhead and mip block rounding. It is not a claim that compressed textures download faster. The original WebP variants remain the failure/capability fallback. Any worker startup/decode failure or deadline terminates the shared pool and disables compression for the page session. Partial compressed models are disposed before WebP retry, including errors GLTFLoader otherwise swallows as missing maps. The versioned decoder path prevents the earlier incompatible wrapper remaining active through HTTP cache. The three original derivatives are reused byte-for-byte; 19 newly eligible derivatives complete textured-car coverage. Source texture dimensions and the existing cache, worker, deadline and failure limits are unchanged.

Reproduce with `node scripts/prepare-compressed-cars.mjs --toktx /path/to/toktx`; the same isolated asset tools are used. Generated manifests record original/derivative SHA-256 values, byte counts and coverage for every source; embedded source, author and license credits are retained. Re-running preparation reuses unchanged derivatives only after verifying both source and output hashes. `--force` explicitly regenerates all eligible derivatives.

## Showcase and finish changes

All 38 circuits now use regional lighting and three safe sector terraces. Near spectators have a bounded articulated mesh pool. [Catalogue-wide scenery and spectator completion](world-and-spectator-completion.md) records the subsequent work; the original three showcase refinements below remain intact.

Harbor Flow, Fuji Skyline and San Francisco Hills share authored sky tint, fog, sun/fill colour and reflection intensity profiles. Once the existing panorama loads, one bounded reflection map rebuild captures that same graded sky. There is no per-frame environment capture. Low-detail environment maps use a 128-pixel PMREM cube source, high detail 256. Both world and garage own their complete reflection render targets and expose synchronous `rebuildEnvironment()` and idempotent `disposeEnvironment()`; replacement is installed before the old target is disposed. Context restoration regenerates these resources before play resumes.

Harbor sails gain visible tension edges; Fuji pavilions gain ridge/eave trim and timber braces; San Francisco shelters gain fascia, braces and readable twelve-mark clocks. Added pieces join the existing sector/material batches, retaining the existing 19/21/27 respective sector draw ceilings. The three viewing terraces retain 24 low-detail or 42 high-detail spectators total; coordinated regional clothing and one filming observer per terrace use existing instanced anatomy, proximity animation and motion limits. Grandstand sound metadata now includes the actual track height.

San Francisco grounding was corrected after actual fixture review exposed a 0.35 m air gap beneath the old terrace pedestal. Each terrace now has six visible piers reaching a 17 m quay that extends to −3.15 m, below the −0.65 m sea. The 22 houses receive submerged concrete footings and shoreline shelves; vegetation receives low, spatially batched ground shelves that stay outside the drivable footprint. These add 14 batches/2,840 triangles at low detail or 15 batches/4,440 triangles at high detail. The destination architecture changes from 15 to 16 draws and 10,414 to 11,822 triangles; the existing 20-draw/16,000-triangle low-detail ceiling remains. The showcase sector ceiling remains 27 draws. Actual mesh raycasts verify support beneath every spectator, house and tree origin, submerged depth and road clearance. Root browser QA confirmed the revised fixture reads as supported architecture; this remains fixture evidence rather than a full-game device measurement.

All 33 cars now receive individual art-directed clearcoat profiles: restrained road-car gloss, softer historic finishes and less mirror-like race-car clearcoat. These are original presentation choices, not claimed manufacturer paint measurements. The original six profiles remain unchanged. They apply only to identified physical body-paint materials. Source maps, metal/roughness response, glass, carbon, badges and livery remain; saved satin/metallic/custom paint still overrides the factory presentation and factory gloss restores it. Distance cars retain their cheaper standard materials.

## Verification scope

The corrective decoder regression executes the actual JS/Wasm under disabled JavaScript string generation. All 241 shipping images match the stock decoder in ASTC across every mip; one image per car additionally covers ETC1, ETC2, BC1, BC3, BC7 M6 and the runtime BPTC choice BC7 M5, for 373 compared image/format chains and 3,655 mip payloads. Metadata, actual Meshopt-decoded geometry/UV streams, material roles, source credits, dimensions/mips and hashes are checked for every derivative. Worker-style initialization and error reporting are also exercised. This comparison does not measure physical-device decode latency.

Targeted automated tests cover severe-frame adaptation, bounded GPU batches, cancellation/context restoration, byte-limited idle caching, compressed failure fallback, all generated asset contracts, finish restoration, environment ownership and batched showcase geometry. The local `reports/rendering-upgrade-review.html` fixture uses production shaders and supports all 38 circuits, six flagship selections, near/distant geometry and KTX2 capability diagnostics. It remains excluded from the production build. Browser gameplay/recovery checks are recorded separately by the release coordinator; a fixture and desktop touch simulation are not physical-phone FPS, temperature or battery measurements.

### Catalogue completion audit — 2 October 2026

The local `reports/catalogue-finish-review.html` fixture loaded all **33/33** actual low-detail cars through the production loader, GPU preparation and garage shaders under the production CSP headers. Every one of the **22/22** textured cars fetched its KTX2 derivative and produced real compressed texture objects; the 11 material-only cars correctly used their existing sources. All 33 retained finite body bounds and identified paint slots. There were zero load failures, JavaScript errors or WebGL errors. Every car was visually inspected from front and rear in the saved contact sheets below. An initial fixture-only deprecated shadow-map constant fell back to Three's supported PCF mode; the fixture was corrected to request PCF directly, then all 33 cars passed again.

The sequential browse retained at most one active source and two total templates, with a peak **31,325,952 estimated resident bytes**. At completion, two idle sources held **8,649,130 estimated bytes**, beneath the existing 32 MiB ceiling, with zero active/queued loads. These are application resource-accounting values, not a GPU/driver memory measurement. Actual gameplay, simultaneous rivals and physical-phone heat/FPS remain separate checks.

Evidence: `reports/catalogue-finish-audit.json`, `reports/catalogue-finish-01-12.jpg`, `reports/catalogue-finish-13-24.jpg` and `reports/catalogue-finish-25-33.jpg`. The fixture, audit JSON and screenshots stay outside production output. **123 relevant tests passed** across the manufacturer asset/runtime/cache/material suite, strict-CSP decoder, bounded loader, hosting policy and saved paint behavior. Re-running preparation reused all 22 hash-verified derivatives without re-encoding them.
