# Grounded terrain and spectators — 4 October 2026

This continues the visual-realism work from deployed `9df221e`. It is not a claim of Asphalt-level realism or completion of the exact-car audio objective.

## Shipped changes

- Continuous inland terrain now meets irregular outer rings. Fuji's smooth cone/cap is replaced with a textured, eroded mountain farther from the road. Terrain no longer flattens around every tree; fixed building pads and road clearances remain.
- Two new Poly Haven CC0 Sparse Grass maps add two-metre colour grain and OpenGL normal detail near the camera. They retain the original 90-metre aerial terrain scale and fade at distance. Shared surface residency estimates are 34⅔ MiB desktop / 8⅔ MiB mobile, with no extra material draw from the detail layer.
- Standing foot calibration fixes the sport spectator's previous 10.4 cm floating gap. Seated pelvis positions account for the actual chair height and body stature. Updated motion palettes keep the same byte size; near/middle/far assets share one new cache version. Spectators receive existing shadows without adding crowd shadow casting.
- All 38 circuit previews were recaptured from the actual renderer. The review fixture now continues asset/LOD selection with motion frozen, instead of pausing before people finish loading. All entries record 11 loaded maps, GPU texture readback and settled crowd assets. Catalogue transfer totals 1,583,034 bytes.
- The Fuji description now says wooded lakeshore, matching the current vegetation rather than claiming the removed cherry population.

## Evidence

- Full automated suite: **1,110 / 1,110 passed**, 322.86 seconds, no skips. Log: `/tmp/camber-grounded-full-tests.log`.
- The subsequent description correction passed 24 focused preview/destination/migration checks; production build passed. The existing large-bundle warning remains; it is not a render failure.
- Independent review passed 38 focused terrain/crowd/resource checks. An additional 7,680 individual near-rig foot contacts ranged from −1.92 mm to +6.57 mm. Tests cover actual delivered geometry/palettes, not only source pose parameters.
- Actual starting-grid WebGL scene: all 18 crowd requests settled; 8 near, 108 middle and 204 far textured spectators; 11/11 surface maps; no page or GL errors. This was a renderer review, not a gameplay claim.
- Actual desktop race: automatic acceleration advanced the clock, car position and race progress. The game loaded all 18 crowd assets and 11 surface maps. Keyboard press/release and pause left all driving inputs false. Pause/resume, portrait rotation and returning home worked. No console warnings/errors were reported in the inspected session.
- Layout checks: 1280×800 desktop, 844×390 phone landscape, 568×320 compact landscape and 390×844 portrait. Document scroll bounds matched the viewport during races and portrait lobby. The portrait race orientation gate remained usable; the primary lobby action was 354×56 px and fully inside the viewport. Garage and circuit navigation worked.
- Saved actual landscape race screenshot: `reports/polish-grounded-phone-landscape.png` (local, ignored). Browser viewport checks are not physical-iPhone/iPad thermal or sustained performance measurements.

## Remaining target

The source people still repeat six wardrobes, distant trees have thin trunks, and the authored tracks/architecture remain visibly stylized. These changes improve grounding and detail but do not prove commercial-game visual parity.

Audio remains a separate incomplete requirement: the accepted source inventory has five identified base-model matches among 33 cars, with target year/variant omissions documented. Related-model recordings are not exact recordings. This release does not relabel them or publish a new ShareAlike audio adaptation without the owner's scoped licensing decision. Only freely licensed sources are being considered; no purchase or outreach is authorized.

## Publication

Pending final commit, push and Firebase/live verification below.
