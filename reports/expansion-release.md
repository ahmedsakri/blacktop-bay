# Blacktop Bay expansion — development evidence

Recorded 1 October 2026. The ten-build expansion and superseding controls below are historical release evidence. A later HUD release is recorded in [racing-hud-redesign.md](./racing-hud-redesign.md). The initial fourteen-build garage release is deployed, as recorded below and in [collection-fourteen-release.md](./collection-fourteen-release.md). A separate GT surface QA patch remains pending.

## Scope implemented

- **Ten builds:** the existing four GT and two Formula builds plus **Spectre LM, Spectre LM-R, Cinder R and Cinder RX**. The added closed/open Prototype body profiles are original procedural bodywork; credited GT wheel geometry is reused. The four variants share profiles, rather than representing four independently licensed assets. Visual body revisions may supersede this checkpoint.
- **Five circuits:** Harbor Flow, Dockyard Technical and Coast Run plus **Summit Switchback (about 1.66 km)** and **Bay Grand Prix (about 1.53 km)**. Three laps and three rivals remain unchanged.
- **Paint on all ten builds:** 11 options including Team original and ten curated colours; Gloss, Metallic and Satin finishes. Paint is free and cosmetic, stored separately per car with a session fallback when storage is unavailable. Body material changes preserve tyre, glass and other non-paint materials.
- **Rendering:** original closed/open Prototype coachwork uses clearcoat-capable physical paint. The reported inspection checkpoint found representative Prototype assemblies at **21–22 meshes after material batching**. `batchStaticMeshes` merges compatible static geometry by material while wheel animation remains separate. This is an object-count observation, not a frame-rate or total scene draw-call guarantee; it does not mean the code uses Three.js’s `BatchedMesh` class.
- **Race setting:** all five circuits have covered stands with static instanced seated/standing spectators behind barriers. Bay Grand Prix has a larger grandstand and pits. The start/finish area has a full-width checkered stripe, four numbered starting bays, a branded truss gantry and three twin-lamp countdown columns driven by the existing race countdown.
- **Revised driving controls:** acceleration is automatic on every device. Drag left/right across the race view to steer and release to center; sharp turns at speed start an automatic drift. Nitro is the only on-screen driving button. Keyboard Left/Right or A/D steering, Down/S braking, optional Space handbrake and Shift nitro remain. Keyboard braking overrides automatic acceleration and boost. Portrait gameplay pauses behind the rotation gate.

## Recorded local checks

The release owner reported **117 passing automated tests** at the latest control checkpoint. This is the reported checkpoint total, not a claim that later edits have been retested. Final totals belong in the release completion entry.

Earlier browser inspection covered **1280×720**, **393×852**, **360×640**, **852×393**, **844×390** and **568×320**. Those revisions had no horizontal overflow; paint survived reload and pointer input, braking, boost consumption and steering were exercised. Rotation to **390×844** paused the race. These observations predate the revised drag-steering and Nitro-only interface and do not validate its current layout or input behavior. Its replacement browser check remains pending.

The checks used the in-app browser with resized viewports and pointer input. **Physical-device touch behavior and real-device FPS/performance were not tested.** No universal phone-compatibility or frame-rate promise is made.

The guide’s 13 FAQ pairs and six HowTo steps describe automatic acceleration, drag steering, speed-triggered drifts and the Nitro-only driving button, alongside free paint and local storage limits. AppsOverFlow’s rendered Blacktop guide uses the same controls. The documentation check passed for all 13 visible FAQ pairs and six HowTo steps. The Apps build passed its 2,780 static checks and 53 existing tests, including visible/schema consistency; unrelated guide data remains unchanged. These are documentation/build results, not validation of the revised game input.

## Material research and search evidence

Three.js documents `MeshPhysicalMaterial` clearcoat as a separate reflective coating useful for car paint and similar surfaces, and notes its extra rendering cost. The current finish choices vary roughness, metalness and clearcoat parameters; a physical material does not by itself establish realistic lighting or acceptable visual quality. [Official MeshPhysicalMaterial documentation](https://threejs.org/docs/pages/MeshPhysicalMaterial.html), [metalness and roughness reference](https://threejs.org/docs/pages/MeshStandardMaterial.html).

Source implementation is in `src/car.js`, `src/prototype-car.js`, `src/paint.js` and `src/driving-controls.js`. Existing third-party attribution remains in `public/credits/` and `public/assets/cars/`.

The account and HTTP crawl receipts are in `Games/.firebase-indexing-audit/2026-10-01/`, especially [search-console-observations.md](../../.firebase-indexing-audit/2026-10-01/search-console-observations.md). Blacktop Bay’s actual Google sitemap live fetch succeeded at **11:13:22 IST**; the stored report still says **Couldn’t fetch** and the homepage remains unknown to Google. No current resubmission or indexing success is claimed. See [seo-review.md](./seo-review.md) for the exact distinctions and [release-checks.md](./release-checks.md) for historical earlier-release evidence.

## Nitro-only control verification

The superseding control design passed **126/126 automated tests** and a production build. This includes 79 physics/race checks, automatic acceleration, proportional drag steering, independent pointer ownership, release/cancel safety, brake precedence for the optional keyboard control, and automatic drift across all ten builds. Automatic rear slip ramps in above approximately 65 km/h during sustained turning; straightening restores grip. Nitro remains available during automatic slides.

Browser checks of the final control design covered **568×320** and **844×390** landscape sizes with one visible driving button, Nitro, and no page overflow. Actual pointer drag produced proportional steering (0.6), releasing it returned input to zero, the car accelerated with no input, and holding Nitro changed its pressed state, activated boost and depleted its charge. Reset is available inside Pause, keeping the touch driving surface uncluttered. These remain resized browser checks, not physical-device tests.

## Completion record

Released 01 October 2026 at 12:15 IST. Both repositories were pushed to GitHub and Firebase Hosting confirmed release completion:

- Blacktop Bay code **584caed**: https://blacktop-bay.web.app/. Predeploy ran **126 tests, all passing**, then the production build. Live HTML exposes exactly one driving input, Nitro. Published JS/CSS bytes match the build. Guide, sitemap and robots each returned HTTP 200.
- AppsOverFlow code **8ad0f4e**: https://appsoverflow.web.app/projects/blacktop-bay/. The deployment passed **2,780 static checks**, **22 contact backend checks** and **148 contact client checks** (contact services were mocked; no enquiry was sent). The live guide describes automatic acceleration, drag steering and Nitro; no old Gas instruction or AI rivals wording remains.
- The live game was checked at **844×390**, with no browser warnings/errors. The final screenshot is saved locally as `reports/nitro-only-mobile-live.png` (ignored by Git). The earlier final-build check at **390×844** confirmed rotation pauses the race and presents the landscape gate. Physical-device performance remains unmeasured.

The automatic-drift/one-button design supersedes the earlier manual-pedal checkpoint. The current production release has no Gas, Brake, Drift or steering buttons on the mobile driving surface. Optional keyboard braking remains supported; touch reset is in Pause.


## Fourteen-build garage — initial release completed

Kestrel GT-R (long-nose GT time attack), Mirage LMP (low closed-canopy prototype), Solstice One (single-seat open speedster) and Tempest XR (extreme-aero prototype) expand the garage from ten to fourteen fictional race builds. They combine shared licensed GT parts with newly authored coachwork and aero. All fourteen support their own free paint and performance upgrades. Five circuits, three laps, three opponents and the automatic-acceleration/drag-steering controls remain unchanged.

Guide, metadata, credits and AppsOverFlow copy describe the expanded catalog. Blacktop Bay commit **3fb0af9** was pushed and deployed to **https://blacktop-bay.web.app/** with **186/186 automated tests passing**. AppsOverFlow commit **4cb2b7e** was pushed and deployed to **https://appsoverflow.web.app/**; its validation passed **3,011 static checks and 53 tests**, plus the deployment's mocked contact checks. See [the fourteen-car collection release receipt](./collection-fourteen-release.md) for model/browser checks, live asset verification and the exact release scope.

**Follow-up completed:** GT surface correction **af6633d** is pushed and deployed with **187/187 tests passing**. Original body and wheel geometry replaces damaged simplified surfaces, with normal shadows retained and versioned asset URLs. Published JS, CSS and both GT models match the build byte for byte; the live garage was visually verified with no browser warnings/errors. See the collection release receipt above. Browser viewport checks do not establish physical-device performance.
