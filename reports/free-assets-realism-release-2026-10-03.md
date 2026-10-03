# Camber Reign — freely licensed visual and audio release

3 October 2026. This release follows the instruction to use freely licensed recordings only. No studio enquiries were sent and no purchase was made. Private, unsent enquiry drafts are excluded from Git. This report distinguishes the delivered upgrade from the still-unmet targets of commercial racing-game visual parity and exact recordings for every car.

## Delivered changes

- Four photographic upper-hemisphere skies from Poly Haven: Qwantani Sunset Puresky (coastal/general), Kiara 1 Dawn (desert), Alps Field (mountain), and Qwantani Dusk 2 Puresky (urban). These are regional atmosphere references, not photographs of the named circuits. Flat inland tracks use sky-only imagery. The corrected horizon mask removes stretched bottom-row pixels below the photographed hemisphere.
- Compressed 8K desktop / 4K mobile sky derivatives, with smaller WebP fallback, bounded transfer/decode deadlines, cancellation and disposed workers. Maximum compressed-texture residency is 22,369,680 bytes desktop / 5,592,464 bytes mobile including mipmaps; these are resource bounds, not measured phone performance. Four original sources and all16 derivative hashes are recorded in the provenance file.
- Scanned tree trunks/branches with textured foliage, fixed near/middle pools, actual-terrain forest margins, roadside planting, connected urban parcels and elevated city scenery. Fuji loses its old pink paper-like destination trees; Singapore loses unsupported oversized bridge portals. Road geometry, collision widths, handling and progression are unchanged.
- Textured human meshes across all visible spectator detail tiers; six wardrobe variants, quieter ambient behavior and eight gestures. Mobile near/middle/far pools are6/48/112; desktop10/108/240. Twenty-four-frame affine motion palettes use three texture fetches per joint instead of four. Crowd mesh and motion URLs share one release version so cached older palettes cannot mix with the new shader.
- All38 circuit thumbnails recaptured from the actual renderer at960×540 after sky/surface/tree loading. Total1,648,084 bytes; versioned URLs prevent old artwork from persisting in browser caches. These are game screenshots, not concept images.
- Lotus Elise now uses victormalloy's CC0 Elise source; Ferrari250GTO uses Provo rossi's CC BY4.0 named-model source. Source identity, licence, derivative intervals, modifications and hashes accompany the files. Both new banks reproduce byte-for-byte from source. The previously approved softer engine/Nitro mix remains unchanged.
- Licence notices remain available at `/licenses/`, while the requested Credits navigation/page remains removed.

## Verification

The broad run completed1,103 tests:1,102 passed and one asset-metadata assertion failed while compressed images were being regenerated (the exact GPU-block estimate changed from22,369,622 to22,369,680). The final manifest and assertion agree. The final affected sky/world/preview/lobby suites pass52/52; environment suites54/54; crowd/cache suites29/29; audio/lifecycle suites54/54, with a final recorded-engine consistency run15/15. This is a resolved full-run failure followed by focused reruns, not a claim that one full1,103-test invocation passed.

Actual browser audio rendering covers all33 cars plus their synthesized baselines: maximum absolute peak0.5564363, maximum RMS ratio0.9578406, finite output, correct bank, at most three recorded voices, single fetch/cache behavior and silent paused tail. Files: `polish-free-audio-all33.json`, `polish-elise-free-mix.wav`, `polish-gto-free-mix.wav` (local ignored evidence).

Actual game checks exercised lobby → circuit selection → Fuji race, seven opponents, automatic acceleration, keyboard steering/Nitro, pause/resume and recovery without blackout. Checked1280×800,390×844,844×390 and568×320: no page overflow or covered controls found; portrait orientation prompt and landscape44px pause/88px Nitro targets remained visible. These desktop browser viewport checks do not establish real-phone simultaneous touch, gyroscope, sustained frame rate, temperature or subjective speaker quality.

Renderer fixtures separately verified final Fuji horizon, Singapore clouds, compressed texture loading and forced WebP fallback. A300-person crowd fixture prepared6near/48middle/112far with zero primitive fallbacks. Mobile-quality scene samples measured93draws/145,204triangles for Fuji and177draws/173,095triangles for Singapore; these fixture counts are not measured real-phone FPS. Circuit-preview captures confirm all38 compressed desktop skies and expected optional tree readiness.

Production build passed. Existing bundle-size warning remains (~1.31MB main game JavaScript before gzip); this change does not claim loading/performance work is complete. Deployment and live verification are appended after publication.

## Remaining targets — explicitly incomplete

Track/crowd presentation is more detailed, but buildings, characters, environment density and animation remain below the requested Asphalt-level realism. Real photos and scanned trees do not establish overall parity.

Audio totals are33 cars,25 bundled/21 active recording banks (4,173,980 bytes). Five assignments match the named base model; zero have the full model/year/variant/build chain independently certified under the inventory's strict criterion. The remaining28 use related-model, engine-family or unresolved-variant sources. Veyron, BMWi8, AudiR18 and Porsche919 retain documented wrong-layout proxies. No car was removed or substitute relabelled as authentic.

The free-source research is bounded: no additional ready exact recording was verified in the checked sources. Publicly playable manufacturer videos and sounds extracted from other games were not treated as freely reusable assets. Some free candidates still have unresolved source identity or distribution terms; the detailed61-candidate decision ledger and all33 requirements remain in ENGINE-CANDIDATES/ENGINE-COVERAGE. Exact universal coverage cannot honestly be declared from those sources.
