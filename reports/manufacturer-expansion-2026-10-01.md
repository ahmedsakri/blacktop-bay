# Manufacturer expansion release — 1 October 2026

Published game: https://blacktop-bay.web.app/  
AppsOverFlow listing: https://appsoverflow.web.app/projects/blacktop-bay/

## Delivered

The garage expands from 16 cars / 13 brands to **27 cars / 16 brands**. The existing 34 circuits remain available. Game code release: `366b12e`; companion AppsOverFlow update: `4442189`.

Added Porsche 911 GT3; Lamborghini Gallardo 2004 and Huracán; BMW i8 and F22 Eurofighter; Audi R8 LMS GT3 and R18; Ferrari 250 GTO and Testarossa; Mercedes-AMG GT; Nissan GT-R 2018. Model identities follow the individual artist sources, including custom variants and classics. Driving figures are arcade balance values, not real vehicle specifications.

Each model has independent high/low geometry, four articulated original wheel groups, per-car paint/progression, a transparent 800 × 400 garage thumbnail rendered from its shipping model, guide content and attribution. Original source files and their SHA-256 evidence can be recovered using the checked-in preparation packs. See `docs/manufacturer-sources/README.md` for provenance, including archival licence evidence and the BMW editor/contributor distinction.

An opt-in pigment shader fixes blue and other paint choices turning nearly black on the Ferrari atlases and BMW F22. It preserves their source atlas, factory restoration and non-pigment markings. The BMW i8 retains its authored contrast panels; mixed race liveries continue to use their source material boundaries.

## Validation

- Firebase release gate: **486 tests passed, zero failed**; production build passed.
- Shipping asset checks decode all 27 cars in both quality levels: original mesh geometry, bounds, finite normals, four moving wheels, rear-only brake surfaces, independent paint, restoration, matching hashes and budgets. High variants remain at or below 450,000 triangles; mobile variants at or below 200,000.
- Released 16-car save fixtures retain wallet, upgrades, race receipts and paint, while each of the 11 additions gets independent defaults and persists its own changes.
- Actual browser-rendered front/rear, mobile-detail, paint and wheel poses reviewed for every new model using `reports/manufacturer-expansion.html`. These are staged asset reviews, not race screenshots.
- Production-build browser checks: Porsche and Audi selection, BMW manufacturer filter/cards, BMW blue paint, an engine upgrade (173 → 179 km/h displayed; 200 earned credits), persistence after reload, race launch on Cedar Ridge, pointer steering, pause/resume, and loading with the production security policy. No browser errors observed.
- Viewports checked: 1280×800, 390×844, 320×740, 844×390 and 568×320. Collection, paint, garage, compact race HUD and pause actions stayed reachable without page overflow in these checks.
- These are desktop browser viewport simulations, not physical-phone certification. Native device gyroscope and simultaneous two-finger interaction were not verified on hardware in this release; the available in-app browser did not support touch-event injection. Automated input lifecycle tests passed.
- AppsOverFlow: production build and 3,045 static checks passed; 53 content/sharing/blog tests and 541 interaction checks passed. Existing contact checks also passed using mocks (no customer submission made).
- The live game manifest matches the shipping manifest. All 11 new mobile GLBs and thumbnails were downloaded from Firebase successfully, and all 11 GLB checksums matched. The Audi R18 loaded in the live garage with the 27-car counter visible.
- AppsOverFlow’s live detail HTML and new Audi R18 garage preview match the deployed files byte-for-byte. The page was checked at desktop and 390 px phone width.

## Local visual evidence

Review screenshots are retained locally under `reports/` (image captures follow the repository’s ignored-report-image convention): `expansion-live-garage.png`, `expansion-audi-garage-desktop.png`, `expansion-bmw-mobile.png`, `expansion-garage-landscape.png`, `expansion-race-compact.png`, and `expansion-appsoverflow-mobile.png`.

The AppsOverFlow garage preview is a genuine capture of the production build, resized to 1000 px and 640 px WebP. Existing cinematic promotional artwork remains labelled as illustration.
