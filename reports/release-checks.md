# Blacktop Bay release verification — 2026-10-01

## Delivered experience

Six fictional race builds use two licensed mesh families: Apex GT, Apex Sprint, Torque R, Torque RS, Vortex P1 and Vortex X. GT builds have a fixed carbon roof, roll-cage detail, numbered liveries and different aero setups. Formula builds include exposed suspension, halo and wings. Shared source models and adaptations are disclosed in `/credits/`; this is an arcade racer, not a photorealistic licensed vehicle simulator.

Three asphalt circuits: Harbor Flow (1,224.12 m), Dockyard Technical (1,534.42 m), Coast Run (1,130.95 m). All have kerbs, barriers, grid markings and a finish gantry. Three AI competitors use the physical driving simulation, contact and real finish crossings. No recorded ghost stands in for competitors.

Each car has independent Engine, Tyres, Nitro and Handling levels. Purchases debit earned credits and change actual physics and top-speed rating. Old three-car saves retain credits/upgrades/receipts and add the new cars at level zero. Credits have no cash value.

## Automated checks

- 68 passing tests cover steering, grip, nitro, lap/checkpoint guards, collision, AI classification, all tracks, upgrades, credit rewards, persistence and consent-gated analytics.
- Three new builds each complete every circuit at stock and maximum upgrades: 18 complete physical race fixtures, no resets, four finishers, faster upgraded race totals.
- All nine existing car/circuit base and maximum configurations were also checked during development.
- Asset validation covers all 24 high/low-detail player/ghost construction/update/disposal combinations, finite geometry, six catalog/physics matches and safe invalid-ID fallback. Ghost geometry is not displayed in competitive races.
- Production build succeeds. Vite reports a large WebGL bundle warning (approximately 251 KB gzip JavaScript); local fonts/models are separate assets. The loader reports initialization phases, not measured byte progress.

## Browser checks

- Desktop garage, all six choices, drag/quarter-turn inspection, studio lighting, responsive framing and upgraded stats reviewed. New Sprint, RS and X liveries inspected. Final proof: `garage-six-builds-final.png`.
- Genuine engine upgrade purchase changed Vortex P1 from 151 to 156 km/h and 1,200 to 1,000 CR; reload preserved it, another car remained unchanged. Workshop works as a scrolling dialog on phones.
- Driver-relative arrow steering, Shift nitro consumption, braking/drifting, reset, pause/resume, menu/garage transitions, sound preference and Race Again checked.
- Classified results shown using a completed real-physics fixture, with four times and responsive actions. Temporary fixture mutation hook removed before release; only a read-only development snapshot remains.
- Viewport checks at 1600×900, 390×844, 320×568, 320×844 and 844×390. No page overflow; garage collection scrolls horizontally at narrow widths. At 320×844, steering ends at116px and nitro starts at139px, with separate hit areas at least44px wide.
- Pause → viewport rotation → resume restores touch controls. Pointer cancellation clears steering; simultaneous synthetic touch inputs preserve nitro when steering releases. Enter/Space holds and releases a focused pad and updates aria-pressed. Multi-touch handler checks used synthetic pointer events with a temporary pointer-capture stub, restored immediately; they are not physical touchscreen evidence.
- All primary icon/touch/upgrade controls have at least44px hit areas. Buttons/selects have visible focus, dialogs trap focus and restore it, controls have accessible names, statuses announce changes, and headings/labels remain HTML. Racing still requires visual timing; this is not a claim of complete screen-reader gameplay or WCAG certification.
- Reduced-motion preference disables decorative orbit, entry animation, speed lines, camera bank and collision shake; the necessary driving camera still follows the car.
- Dockyard four-car racing sample: 120 warm frames, median16.2ms, p95 17.3ms on this desktop in the in-app browser. This short local development sample is not a physical-phone or full-race performance guarantee.

## Services and release

GA4 G-RC925EV263 is routed through dedicated published GTM-PZHDLVK8 and gated by analytics consent on the exact production hostname. Advertising consent stays denied. Personal information, query strings and fragments are excluded from game event fields. AdSense publisher metadata/ads.txt exist for review; no advertising code or auto ads are active.

Google/Bing verification tags, crawlable guide/privacy/credits pages, robots and a four-URL sitemap are included. Console verification/submission outcomes are recorded in `seo-review.md`. Indexing, ranking and AdSense approval remain external decisions.

Deployment must target only Firebase Hosting site `blacktop-bay` in project `echo-heist`. Live checks and final service outcomes will be appended after deployment.

## Limits

Physical iOS/Android devices were unavailable. Touch, safe-area layouts, and reduced geometry were inspected through desktop browser emulation; thermal behavior, Safari-specific WebGL performance and mobile battery use remain device-testing items. Do not describe the release as universally pixel-perfect or guarantee a numeric SEO/AEO/GEO score.

## Live release verification

- Game code committed and pushed as `11f0c36`; Firebase released only Hosting site `blacktop-bay` successfully on 2026-10-01. Predeploy ran all68 tests and built the production bundle.
- Live homepage, guide, privacy, credits, robots, sitemap and ads.txt return200. Homepage contains the six-build facts and valid VideoGame JSON-LD; guide carries the matching FAQ/HowTo content.
- Fresh production load completed models/fonts with no console errors or warnings. Before consent only the local game script was present. After Allow analytics, GTM and gtag returned200 and GA collection returned204. Garage selection and race-start events were exercised.
- Live390×844 check: all five touch pads visible after pause/resize/resume; no horizontal overflow. Primary pad widths are46–76px internally, heights58–77px. Desktop garage displays all six builds; live proof captured in `blacktop-live-garage.png`.
- AppsOverFlow listing published in commit `8d7af41`, with carousel, collection card, dedicated guide, responsive actual-game artwork, shared links and sitemap entry. Site checks:2,757 static assertions,514 interaction assertions,4 sharing tests, plus existing contact checks. Live detail: https://appsoverflow.web.app/projects/blacktop-bay/.

## Mobile landscape follow-up

Mobile gameplay now requires landscape. Portrait Race now opens an accessible rotate dialog before the countdown begins. On touch hardware the browser attempts fullscreen and landscape lock when supported; unsupported browsers provide a clear manual rotation path. The menu/garage remain available in portrait. The orientation overlay traps focus and makes the underlying controls inert, uses a reduced-motion-safe rotation illustration, and includes Back to home.

Verified in browser viewport tests: portrait entry keeps elapsed time0; resizing to844×390 starts countdown/racing; rotating to390×844 mid-race pauses at24.45 seconds with all held inputs cleared. Time stayed exactly24.45 while upright. Rotating back kept the pause dialog, and Keep driving resumed beyond24.45 with touch controls visible and the underlying UI no longer inert. Physical device orientation-lock behavior remains dependent on browser support and was not tested on physical hardware.

AdSense reports Review requested / Getting ready. GA4 Realtime shows actual page and gameplay events. See `external-services.md`. Search consoles are verified and sitemaps submitted; Google’s first read/index request returned errors, while Bing is Processing. No indexing success is claimed; see `seo-review.md`.

Follow-up audit preserved the pause dialog’s background inert state when the rotate overlay closes, and moved audio unlocking into the original Start tap so mobile gesture restrictions do not silence the first race after rotation. Countdown rotation was also checked: elapsed remained0 while portrait-paused, then resumed the remaining countdown and entered racing only after returning to landscape.
