# Gallardo recording and pine scenery — 4 October 2026

## Delivered change

The user approved the Gallardo audition as “Clean engine sound—use it.” The game now selects the same reviewed 1.25-second Gallardo recording, replacing the Huracán substitute. The 60,044-byte WAV is reproduced by the existing preparation pipeline and retains SHA-256 `dbcecd6f1bb37631c2f3b7dbb3a2d21d92b94cacca954767285ba546c3f38dcf`. The creator's CC BY 2.0 grant, original title/source, derivative notes and attribution are recorded in the shipped notices. No paid source or outreach was used. Coverage is **6 of 33 named base models**, with 27 unresolved; the recording does not establish Gallardo year/trim or a measured full-RPM session. See the Flickr source audit for provenance and listening acceptance.

Summit, Cedar Ridge and Norway now use four source-derived CC0 pine assets with original twig positions and photographed needles. Uniform fitting preserves source proportions and existing clearance footprints. Near and far selections remove all matching trunk/bough fallback pieces; load failure restores them. A review found stale fallback culling bounds after terrain fitting; both bounds now refresh before compaction, with a regression using real Cedar/Norway terrain and geometry.

Summit's repeated rounded rocks now use asymmetric stratified outcrops and existing CC0 stone maps. Accepted placement/RNG, road and recovery clearances remain unchanged. One draw and 208 mobile / 312 desktop triangles per rock replace the previous 324. UV projection is consistent per triangle at the source's 20 m scale. Summit and Norway each load 13 surface maps; other routes retain 11.

Three circuit previews were recaptured through the actual world renderer after assets settled. The full 38-image catalogue totals **1,559,856 bytes**. Pine trees are ready in every changed capture. The remaining 35 previews retain their verified bytes.

## Validation before release

- Audio integration: 55/55 focused tests; exact reproduction of approved WAV; all per-car mix tuples and DSP behavior unchanged. Gallardo is the only changed bank mapping.
- Pine integration: 29 focused tree/world checks passed initially; subsequent stale-bound fix passes 10/10 tree tests. These overlap and are not summed.
- Summit outcrops: 23/23 focused world/material/geometry checks, including per-triangle UV density, finite normals, buried bases and preserved footprint bounds. Independent review cleared the UV fix.
- Final pine, tree lifecycle, outcrop and all-38-preview checks: 13/13 pass. Production build passed before release gate.
- Actual desktop Gallardo race loaded the `gallardo-idle` bank: one fetch, one voice, one cached bank, no failed recordings; automatic acceleration and race time advanced. Pause/resume and short keyboard taps were exercised; released inputs were clear. User listening approval is separate from these programmatic checks.
- Actual race ran at 1280×800, 844×390 and 568×320. Document dimensions matched each viewport. At 390×844 the rotation prompt paused racing and retained reachable 48 px actions. Portrait entry and Back to home were also checked in the real game hosted in an exact-size local iframe.
- Browser screenshots after raw emulation were unreliable on two sizes (tiled capture output despite correct DOM bounds). Desktop and portrait were rechecked and captured with the actual game in a scaled exact-size iframe, not simulated game state. Local evidence files: `pine-game-desktop.png`, `pine-game-landscape.png`, `pine-game-compact.png`, `pine-game-portrait.png` and matching measurements. The local wrapper is excluded from production. A MutationObserver error appeared in browser instrumentation; no MutationObserver occurs in game source. This is not asserted to be a game defect or silently presented as a clean instrumented console.
- World renderer views checked Summit mobile, Cedar desktop and all three refreshed desktop previews. No fixture-reported rendering errors; pine resources resolved. Cedar chase view: 12 near / 85 far trees, 53,973 tree triangles. Summit mobile: 8 / 64, 35,200 tree triangles. These are scene counts, not physical-phone performance measurements.

## Limits and remaining work

This is a verified improvement, not Asphalt-level completion. Young pine silhouettes, cutout foliage, shared architecture, distant crowds and the transition to photographic backdrops remain visibly simplified. Exact-model audio is still incomplete for 27 cars. The game still derives dynamic rev behavior from compact loops. No new physical-phone heat, simultaneous-touch, gyroscope or headphones test is claimed. The active overarching visual/audio goal remains open.

## Publication

Published source commit `872570a` to https://camber-reign.web.app/ after the normal Firebase gate passed **1,131/1,131 tests**, zero failures (617.84 seconds), and the production build passed (3.52 seconds). The build retains its existing large-bundle warning; this is not a failed build or a new performance measurement. The gate was not bypassed. Full log: `../camber-reign-asset-sources/release-logs/pine-gallardo-deploy-2026-10-04.log`.

All **71 inspected live files** returned HTTP 200 and matched the exact production build bytes: the game bundles, landing page, notices, audio source/coverage/candidate manifests, approved Gallardo WAV, all 38 previews and their manifest, cliff surfaces and pine assets/provenance. See `pine-gallardo-live-files-2026-10-04.json`.

A fresh post-deploy browser check could not run: the browser's admin-policy verification service was unavailable on two attempts and denied navigation. No alternate browser or indirect UI workaround was used. This limits the final production-page visual check; it does not replace or invalidate the completed pre-deploy actual-game checks and separately initiated live-byte verification above. No new physical-device test is claimed.
