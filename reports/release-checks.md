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
