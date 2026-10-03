# Original tree foliage and venue-lit water — 4 October 2026

This continues the grounded terrain/crowd release `8411b41`. The free-source audio audit is committed separately as `e400539`. The remaining exact-model recording and commercial-game visual-quality goals are not represented as complete.

## Changes

- All four scanned-tree tiers now use clusters baked from the original CC0 Tree Small 02 leaf meshes, UVs and photograph. The former enlarged houseplant photograph is removed from these tree assets. Nearby and distant tiers retain their triangle counts, material counts, texture dimensions and fixed instance capacities. The combined mobile pair is 584,016 bytes; the desktop pair is 1,446,216 bytes. Source originals stay outside the repository.
- Tree proportions now respect the source's spreading canopy. Fuji's sampled heights change from 6.02–19.87 m to 6.02–13.29 m. Horizontal clearances and roots remain fixed; loading/error fallbacks use the same fitted proportions. SHA-256 URL versions prevent returning browsers from retaining old canopies alongside new geometry bounds.
- Coastal water and the Norwegian lake share a physically lit water material. It uses the existing venue reflection, scene lights and fog, with dielectric index 1.333 and irregular moving normals. Small ripples fade at distance. It adds no texture, transmission buffer, reflection render pass or geometry displacement. It reflects the environment, not dynamically rendered nearby buildings or cars. Pause and reduced-motion timing still use the existing world clock.
- Fuji's description now names wooded lower roads rather than claiming a rendered lakeshore.

## Review evidence

The actual mobile world renderer was inspected at road level and close range on Fuji. The new canopies are visibly denser and more finely detailed than the oversized, papery baseline. Harbor water was compared in the same overview before and after the material change; its reflection now follows the warm coastal sky. Neither review produced a page or GL error. Local ignored captures: `polish-canopy-road.png`, `polish-canopy-close.png`, `polish-water-harbor.png`.

The independent water review found no additional resource ownership or pause/resume defect. Shader recompilation retains the time value, separate worlds keep independent clocks and invalid clock input is bounded. Seven existing world/environment checks pass. Seven source-canopy/runtime checks cover real geometry, provenance, budgets, alpha/UVs, rooting, cache versions, fallback behavior and disposal.

- Full automated suite: **1,113/1,113 passed**, no skips or failures, 731.17 seconds. Local log: `/tmp/camber-canopy-water-full-tests.log`.
- All 38 960×540 WebP previews were refreshed from the actual renderer, with loaded maps, settled crowd assets, versioned tree URLs and the venue-water status recorded. Total transfer is 1,556,304 bytes. The post-capture source/preview/environment group passed **13/13** tests.
- Production build passed in 1.81 seconds. The existing large-chunk warning remains; it is not a rendering failure.
- Actual local McLaren 570S race advanced past **2:02.02**, 12% progress and a captured 54 km/h. It loaded all 18 crowd asset requests and 11 surface maps. Pause/resume worked, and the existing recovery event visibly returned the car to the road. This is an interaction smoke test, not a finished race or a physical-phone benchmark.
- Checked 1280×800 desktop, 844×390 landscape, 568×320 compact landscape and 390×844 portrait. Race document scroll bounds matched every mobile viewport; the 844×390 pause target measured 44×44 px and Nitro 96×96 px. Portrait rotation paused the race and the orientation prompt's Back to home action returned to the lobby. The portrait Race now control measured 354×56 px and remained within the screen.
- Saved local ignored screenshots include `polish-canopy-landscape-race.png`, `polish-canopy-compact-race.png` and `polish-canopy-portrait-gate.png`. Temporary focus emulation allowed the background browser to animate and is reset during cleanup.

## Publication

Commit, push, deployment and live hash verification are recorded after the release succeeds.

## Limits

Architecture still shares authored modular forms, distant vegetation can use simpler fallbacks, and crowds repeat six fitted wardrobes. These are improvements to the actual renderer, not proof of Asphalt-level realism. Desktop browser viewport checks do not certify physical-phone performance, heat or graphics quality.

Audio remains five accepted named base-model matches among 33 cars, with 28 unresolved. The local Veyron audition is not integrated: it is a short variant-specific departure, and the main-game ShareAlike adaptation scope is unresolved. No purchase, external enquiry, new license grant or runtime audio substitution was made. The preserved evidence distinguishes usable permission, source identity, listening quality and successful integration.
