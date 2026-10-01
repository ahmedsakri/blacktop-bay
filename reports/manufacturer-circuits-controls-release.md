# Manufacturer, circuits and driving update — 1 October 2026

Status: implementation, final browser review and all 398 automated checks passed. Prepared for the authorized production release; deployment outcome is recorded below. Physical-device tilt testing remains outstanding.

## Shipping catalogue

- 36 cars: 16 individually credited manufacturer representations across 13 brands, plus 20 original GT, Formula and Prototype builds. The new McLaren 570S Coupé and McLaren Senna retain their actual model identity. No rejected Corvette is listed.
- The guide’s 16 model cards were regenerated from `src/manufacturer-vehicles.js`; each card’s portrait exists and each model has a manifest and public-credit entry. Driving ratings, Nitro and upgrades are game tuning, not manufacturer specifications or an endorsement.
- 34 circuits: nine original routes and the existing 25 compact venue adaptations. Existing circuit IDs and the launch-route sample hashes are preserved.

| New original circuit | Arcade lap | Scenery |
| --- | ---: | --- |
| Breakwater Run | 2.09 km | Sea-wall foundation, lighthouse and basalt outcrops |
| Copper Canyon | 2.36 km | Layered sandstone mesas and open switchbacks |
| Cedar Ridge | 2.41 km | Conifers, timber lodges and a ridge backdrop |
| Neon Freight | 2.26 km | Container stacks, gantry cranes and a floodlit industrial district |

## Driving changes and evidence

A glancing barrier scrape now retains most forward momentum rather than imposing the previous 32% speed reduction. Hard impacts interrupt Nitro, briefly reduce drive and clear unbanked drift points. Base vehicle ratings and upgrade formulas are unchanged.

Automatic recovery is player-only: roughly 2.4 seconds pressing into a barrier at low speed, or 0.9 seconds far off the road, while acceleration is requested. It returns behind validated progress, checks for an opponent-free position, rewinds crossed checkpoint requirements and enforces a three-second cooldown. It awards no lap distance or Nitro. Holding brake or handbrake does not trigger recovery. Rivals continue using ordinary steering and physics without recovery teleports.

Validation completed:

- 129 existing physics/race tests passed, including all original builds at stock and maximum upgrades on the five launch routes.
- 77 circuit/fleet tests passed, covering all venue routes and all four new maps. Player and manufacturer/original opponents completed three laps; new-map rivals also finished around a stopped player, with zero automatic recoveries.
- Ten crash/recovery tests passed: scrape versus hard impact, equal pre-impact classification for both colliding cars, impact escalation during cooldown, stationary braking, off-road delay, checkpoint rewind, opponent clearance, both steering directions at low/high speed, deterministic timing and a complete three-lap race after recovery. The collision-order regression failed before the shared-speed fix and passed afterward for the player in either car position.
- 20 control tests passed: pointer ownership, hold/drag steering, simultaneous Nitro, cancellation, rotation, bounded tilt mapping, calibration, permission denial and missing/stale sensor fallback.
- The final post-review batch passed all 150 physics, race, fleet, crash/recovery and collection checks after the collision-order fix.
- Earlier crowd checks verified ten instanced batches, varied poses and gestures, pause/reduced-motion handling and distance/rate limits. These are original procedural spectators, not photoreal scans.

## Published-copy checks

README, guide, credits and `llms.txt` agree on the 36/16/13 car facts and 34/nine circuit facts. All 14 guide FAQ answers and six HowTo steps match their visible HTML and JSON-LD. All 16 model portraits, internal references and unique IDs were checked. AppsOverFlow’s nine catalogue/copy files were updated without changing withdrawn blog content: its build, 3,037 static checks and four sharing tests passed.

The circuit browser now derives category counts from its supplied catalogue; five collection checks passed, including a smaller catalogue regression. AppsOverFlow contact verification passed 22 mocked backend and 148 mocked client/iframe checks without sending a live enquiry.

## Final release checks

The final combined test run passed **398/398 tests**, with no failures or skips, followed by a successful production build. Both repositories pass `git diff --check`. The only build advisory is the existing main JavaScript bundle size warning.

The final renderer was visually reviewed with all 16 manufacturer models and four loaded environment families. Original generated coast, canyon, alpine and city panorama provenance is in `docs/environment-art.json`. The canyon mesa was refined after visual review. Local model/scenery fixtures are inspection aids, not completed gameplay evidence.

Actual production-preview races were inspected on Harbor Flow, Breakwater Run and Cedar Ridge. Touch steering in both directions, Nitro activation (100% to 93% on press), pause, automatic recovery feedback and the no-sensor tilt fallback were observed through ordinary browser controls. Save persistence and upgrade/paint controls were checked. Desktop 1280×800, portrait 390×844 and 320×740, landscape 844×390 and compact landscape 568×320 layouts were inspected. No document-width overflow was present in the final 320- and 390-pixel checks; garage workshop controls and bottom actions remain separate in landscape.

Final screenshots: `garage-release-final.png`, `race-release-final.png`, `mobile-race-release-final.png`, and the four `*-environment-final.png` views in this reports directory. AppsOverFlow uses the actual final McLaren garage and Cedar Ridge race screenshots, with matching captions.

**Physical iOS/Android tilt sensors, permission prompts and two-finger device input have not been tested on an actual phone.** Browser viewport checks and automated input tests do not establish physical-phone performance. Missing-sensor fallback was also observed in the browser.

## Production release

Published successfully to `https://blacktop-bay.web.app/` on 1 October 2026 from commit `8fd4cdd`. Firebase predeploy reran all 398 tests successfully and rebuilt production. The public homepage and alpine texture returned HTTP 200, and production CSP contains the required WebAssembly compilation and embedded texture blob allowances. The public browser loaded the updated 36-car/34-circuit catalogue. The AppsOverFlow listing was pushed and deployed from `1c6f61f`, including fresh actual race imagery with cache versioning; its live page contains the new counts, Cedar Ridge caption and image version. All Apps static/contact/sharing checks passed. No live contact enquiry was sent.
