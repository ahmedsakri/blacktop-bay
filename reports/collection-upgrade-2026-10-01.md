# Blacktop Bay — 33-car collection and usability update

Date: 1 October 2026
Status: Implementation and automated checks complete; visual release gate pending. Not deployed.

## Changes

- Added McLaren 650S GT3, BMW M3 E46 Coupé, Audi Quattro Rally, Lamborghini Countach LP500S, Ferrari Enzo and Porsche 919 Hybrid. Catalogue: 33 cars, 16 brands, 34 circuits.
- Prepared distinct desktop/mobile meshes with four articulated wheels, body-only paint and per-car upgrades. Individual creator/licence records and original/output checksums are retained. BMW is correctly described as a sports coupe; the Porsche is the 2017 prototype. No manufacturer endorsement is claimed.
- Car searches tolerate accents and punctuation and accept separate maker/model terms. Comparison shows top speed, acceleration, handling and Nitro using saved upgrades. Clear filters retains sorting and comparison. New-arrival badges and ordering are limited to this six-car release.
- Validated lap crossings produce a four-second message with the last lap time; later laps compare against prior laps in the same race. Final lap is clearly marked. Collision/recovery messages take priority, pauses preserve display time, and reduced-motion preferences are respected.
- Game guide, visible FAQs, structured data, credits and AppsOverFlow listing now describe the same 33-car catalogue in the local source.

## Checks completed

- Full game suite: 538 tests passed, including all vehicle/circuit race simulations and explicit 16→33 and 27→33 save migrations.
- After the Audi material correction: 67 runtime asset tests passed; all output checksums match.
- Production build passed (existing JavaScript chunk-size advisory remains).
- AppsOverFlow: build, 3,045 static checks, 53 content/sharing/blog tests, 541 interaction checks and 170 mocked contact checks passed.
- Browser actual-runtime model fixture rendered all six at high/low quality with front, rear and paint/wheel views. Five models accepted. Audi review exposed white tyre/trim materials, subsequently corrected by splitting the original connected components and assigning rubber, alloy, lamp and trim finishes. Corrected Audi needs another visual review.
- Prior to browser interruption: phone garage and orientation gate reviewed at 390×844; race start/pause observed at 844×390; compact home at 568×320. Updated collection search and comparison were exercised via browser UI, but final responsive screenshot verification remains incomplete.

## Remaining release gate

Browser Use now reports: “The admin-enforced policy could not be verified, so access was not granted.” Repeated normal retries failed. No alternate browser driver or security bypass was used.

1. Re-render and visually review corrected Audi Quattro Rally in the actual game renderer.
2. Finish six high-resolution thumbnails. The render route is reports/manufacturer-expansion.html?start=27&all=1&thumbs=1 on the local development server. Current new thumbnail files have not been added; this is a known release blocker.
3. Verify final collection/garage and race controls at 1280×800, 390×844, 844×390, 568×320 and 320px portrait; verify filtered comparisons, favourites, empty results, clear-filter focus, new-car selection, paint and saved upgrades.
4. Refresh the actual AppsOverFlow garage capture after verification. Its current Audi R18 image is from the preceding 27-car release and is now described without a car count.
5. Commit final assets/checks, publish both sites, and verify live catalogue/asset hashes and browser loading. Live sites remain on the preceding release.

Physical-phone multitouch and sensor hardware are not established by desktop viewport tests.

## Research reference

The usability audit emphasised clear control/feedback and readable choices, consistent with [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/intermediate/). Implementation decisions above came from specific defects observed in the code and browser, not a claim that a checklist guarantees accessibility or popularity.
