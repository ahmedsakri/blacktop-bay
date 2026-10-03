# Camber Reign — freely licensed visual and audio release

3 October 2026. This release follows the instruction to use freely licensed recordings only. No studio enquiries were sent and no purchase was made. Private, unsent enquiry drafts are excluded from Git. This report distinguishes the delivered upgrade from the still-unmet targets of commercial racing-game visual parity and exact recordings for every car.

## Delivered changes

- Four photographic upper-hemisphere skies from Poly Haven: Qwantani Sunset Puresky (coastal/general), Kiara 1 Dawn (desert), Alps Field (mountain), and Qwantani Dusk 2 Puresky (urban). These are regional atmosphere references, not photographs of the named circuits. Flat inland tracks use sky-only imagery. The corrected horizon mask removes stretched bottom-row pixels below the photographed hemisphere.
- Compressed 8 K desktop / 4 K mobile sky derivatives, with smaller WebP fallback, bounded transfer/decode deadlines, cancellation and disposed workers. Maximum compressed-texture residency is 22,369,680 bytes desktop / 5,592,464 bytes mobile including mipmaps; these are resource bounds, not measured phone performance. Four original sources and all 16 derivative hashes are recorded in the provenance file.
- Scanned tree trunks/branches with textured foliage, fixed near/middle pools, actual-terrain forest margins, roadside planting, connected urban parcels and elevated city scenery. Fuji loses its old pink paper-like destination trees; Singapore loses unsupported oversized bridge portals. Road geometry, collision widths, handling and progression are unchanged.
- Textured human meshes across all visible spectator detail tiers; six wardrobe variants, quieter ambient behavior and eight gestures. Mobile near/middle/far pools are 6/48/112; desktop 10/108/240. Twenty-four-frame affine motion palettes use three texture fetches per joint instead of four. Crowd mesh and motion URLs share one release version so cached older palettes cannot mix with the new shader.
- All 38 circuit thumbnails recaptured from the actual renderer at 960×540 after sky/surface/tree loading. Total 1,648,084 bytes; versioned URLs prevent old artwork from persisting in browser caches. These are game screenshots, not concept images.
- Lotus Elise now uses victormalloy's CC 0 Elise source; Ferrari 250 GTO uses Provo rossi's CC BY 4.0 named-model source. Source identity, licence, derivative intervals, modifications and hashes accompany the files. Both new banks reproduce byte-for-byte from source. The previously approved softer engine/Nitro mix remains unchanged.
- Licence notices remain available at `/licenses/`, while the requested Credits navigation/page remains removed.

## Verification

The broad run completed 1,103 tests:1,102 passed and one asset-metadata assertion failed while compressed images were being regenerated (the exact GPU-block estimate changed from 22,369,622 to 22,369,680). The final manifest and assertion agree. The final affected sky/world/preview/lobby suites pass 52/52; environment suites 54/54; crowd/cache suites 29/29; audio/lifecycle suites 54/54, with a final recorded-engine consistency run 15/15. This is a resolved full-run failure followed by focused reruns, not a claim that one full 1,103-test invocation passed.

Actual browser audio rendering covers all 33 cars plus their synthesized baselines: maximum absolute peak 0.5564363, maximum RMS ratio 0.9578406, finite output, correct bank, at most three recorded voices, single fetch/cache behavior and silent paused tail. Files: `polish-free-audio-all 33.json`, `polish-elise-free-mix.wav`, `polish-gto-free-mix.wav` (local ignored evidence).

Actual game checks exercised lobby → circuit selection → Fuji race, seven opponents, automatic acceleration, keyboard steering/Nitro, pause/resume and recovery without blackout. Checked 1280×800,390×844,844×390 and 568×320: no page overflow or covered controls found; portrait orientation prompt and landscape 44 px pause/88 px Nitro targets remained visible. These desktop browser viewport checks do not establish real-phone simultaneous touch, gyroscope, sustained frame rate, temperature or subjective speaker quality.

Renderer fixtures separately verified final Fuji horizon, Singapore clouds, compressed texture loading and forced WebP fallback. A 300-person crowd fixture prepared 6 near/48 middle/112 far with zero primitive fallbacks. Mobile-quality scene samples measured 93 draws/145,204 triangles for Fuji and 177 draws/173,095 triangles for Singapore; these fixture counts are not measured real-phone FPS. Circuit-preview captures confirm all 38 compressed desktop skies and expected optional tree readiness.

Production build passed. Existing bundle-size warning remains (~1.31 MB main game JavaScript before gzip); this change does not claim loading/performance work is complete. Deployment and live verification are appended after publication.

## Remaining targets — explicitly incomplete

Track/crowd presentation is more detailed, but buildings, characters, environment density and animation remain below the requested Asphalt-level realism. Real photos and scanned trees do not establish overall parity.

Audio totals are 33 cars,25 bundled/21 active recording banks (4,173,980 bytes). Five assignments match the named base model; zero have the full model/year/variant/build chain independently certified under the inventory's strict criterion. The remaining 28 use related-model, engine-family or unresolved-variant sources. Veyron, BMWi 8, AudiR 18 and Porsche 919 retain documented wrong-layout proxies. No car was removed or substitute relabelled as authentic.

The free-source research is bounded: no additional ready exact recording was verified in the checked sources. Publicly playable manufacturer videos and sounds extracted from other games were not treated as freely reusable assets. Some free candidates still have unresolved source identity or distribution terms; the detailed 61-candidate decision ledger and all 33 requirements remain in ENGINE-CANDIDATES/ENGINE-COVERAGE. Exact universal coverage cannot honestly be declared from those sources.

## Publication and live delivery

Commit `b51f30e` was pushed to GitHub main and deployed to the existing Camber Reign Firebase site under echo-heist. Repository predeploy checks remain unchanged; deployment used a temporary config after the broad test run, resolved-failure focused reruns and successful production build.

Live hash comparison passed for 49 files: both new recordings; near/middle/far wine-blouse meshes plus its versioned motion palette; representative mobile/desktop compressed skies and scanned tree; every one of the 38 new circuit previews; the main game bundle; and the licence page. All returned HTTP 200 and matched the built bytes. An initial verification attempt encountered a transient HTTP 503; the bounded retry completed with zero mismatches.

A fresh published Fuji race loaded all seven opponents, rendered the updated environment and crowd, and displayed the starting grid. Background-tab interruption correctly paused the countdown until resumed; this is not a sustained live frame-rate benchmark. Earlier local gameplay checks remain the driving validation. `polish-free-live-race.png` records the published scene.

The live check also found one surviving Model credits footer link on the car collection page. It was removed to complete the requested navigation cleanup; the separate licence notices and existing redirects remain intact.
