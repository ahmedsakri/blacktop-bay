# Handling, collisions and Nitro audit — 2 October 2026

Read-only behavior audit against current local Camber Reign source. No new driving, crash or power-up behavior was implemented during this audit. Prior garage/mobile presentation changes are separate work.

## Current-release baseline

Checked the official news index live on 2 October 2026. Its latest published season patch notes are **Sunset Speedaway, dated 14 September 2026**. The current IMSA Endurance event runs 15 September–14 October. This is the current documented season baseline; this audit does not assert a platform-specific binary version number. [Official news](https://asphaltlegends.com/news), [season patch notes](https://asphaltlegends.com/news/sunset-speedaway).

The newer **29 September** article is explicitly **Upcoming Multiplayer Changes** and repeatedly says the changes arrive in the next update. Its milestone reduction, league adjustments and nametag resizing must not be presented as already released. Its Ghost Slipstream paragraph does confirm that mode has already returned. Likewise, Mini-Mayhem (5 October) and the next Club Series occurrence (9 October) are future events as of this audit. The Club Series system itself debuted in the previous season, so its September description is valid current evidence for Nitro bottles and existing race objectives. [Upcoming changes](https://asphaltlegends.com/news/multiplayer-update), [Club Series](https://asphaltlegends.com/news/club-series).

Gameloft's linked live support pages below verify continuing core mechanics; their exact original publication dates are not exposed here. They are not evidence that a mechanic was newly introduced in September 2026. No October-release build or later patch was verified.

## Direct answer to the reported issues

**Trackside Nitro bottles do not exist in this build.** The game starts with a full charge and provides one held-boost state. Charge refills while moving forward above 8 m/s with Nitro released, and drifts multiply that refill rate by 2.5. There is no pickup list, trigger test, bottle renderer, collection cue, or collected/respawn state. This is a missing gameplay system, not a missing graphic.

**Collisions are present, but their communication is incomplete.** Walls remove outward velocity; hard contact cuts speed, interrupts Nitro, loses unbanked drift points and briefly stabilizes the car. Vehicle contacts separate two-circle bodies and transfer momentum. Hard impacts emit player sparks, grit, dust, a directional camera kick and a brief status message. However, the audio update receives no impact event and the sound module has no crash sound. The variable `boostImpactGain` belongs to Nitro onset, not collisions. No wrecked/knocked-down state, rollover, detached parts, damage accumulation or impact replay exists. Nearby rival-only impacts also do not receive the player's contact particle system.

## Audited comparison and proposed priorities

P1 means fix the basic racing experience next; P2 is a larger feature addition after the core is credible.

| Feature | Verified Asphalt behavior | Current Camber Reign | Gap / proposed scope | Priority |
| --- | --- | --- | --- | --- |
| Nitro pickups | The official September 2026 Club Series explicitly includes collected Nitro bottles as a race objective. [Source](https://asphaltlegends.com/news/club-series) | None; boost comes from starting charge and moving/drifting recharge only. | Place original, readable bottles along deliberate racing lines; capped charge gain, collection flash/sound, authoritative trigger/cooldown, pause/restart handling and fair rival rules. A bottle should visibly refill charge; a separate automatic speed pad would be a different mechanic. | P1 |
| Impact weight and sound | Asphalt is an arcade racer with opponent knockdowns; Gameloft explicitly documents 360-based knockdowns. It does not publish numeric collision tuning. [Source](https://gameloft.helpshift.com/hc/en/15-asphalt-legends/faq/605-what-are-barrel-rolls-and-360s/) | Physical response and player effects exist; no collision sound. Light scrapes are intentionally almost lossless. | Add distinct scrape, body hit and severe wall-hit sound; visible severity-based body reaction and contact cue. Calibrate normal versus severe hits in actual phone gameplay before changing global penalties. | P1 |
| Perfect Nitro | A timed second tap during the blue interval activates Perfect Nitro. [Source](https://gameloft.helpshift.com/hc/en/15-asphalt-legends/faq/639-how-do-i-perform-a-perfect-nitro/) | No timing interval or second boost state. The blue active bar is only styling for normal boost. | Real timing state, visible window, distinct consumption/handling/speed effect and feedback; preserve one Nitro control and explain its gestures. | P1–P2 |
| Nitro Shockwave | Full charge plus a double tap activates a stronger Nitro boost. [Source](https://gameloft.helpshift.com/hc/en/15-asphalt-legends/faq/606-how-do-i-perform-a-nitro-shockwave/) | No double-tap interpretation, full-charge special state or shockwave behavior. | Separate full-charge burst with bounded duration/consumption and distinct visuals/sound. Do not relabel the existing normal boost as Shockwave. | P2 |
| Knockdowns / wreck sequence | A 360 near opponents can knock them down and refill Nitro. [Source](https://gameloft.helpshift.com/hc/en/15-asphalt-legends/faq/605-what-are-barrel-rolls-and-360s/) | Contacts transfer velocity; both drivers generally keep driving. No wreck state or knockdown reward. | Explicit severe-hit state machine, brief loss of drive, clear victim/attacker feedback, then safe recovery behind validated checkpoints. A fair single-player rule set must be designed rather than guessed from Asphalt. | P2 |
| Jumps, barrel rolls and 360s | Curved ramps initiate barrel rolls; double tapping drift initiates a 360; stunts award Nitro. [Source](https://gameloft.helpshift.com/hc/en/15-asphalt-legends/faq/605-what-are-barrel-rolls-and-360s/) | Flat X/Z simulation, no vertical velocity, airborne state, ramps, landing or stunt recognition. | Requires a genuine 3D movement/landing extension plus authored ramp routes and checkpoints. Cosmetic spinning alone would not create the mechanic. | P2, substantial |
| Manual / assisted driving | Official site offers Manual and TouchDrive, with keyboard, controller and touchscreen support. [Source](https://asphaltlegends.com/) | Keyboard, drag steering, proportional steering pad and optional tilt with sensitivity exist. Automatic acceleration and high-speed automatic drift are deliberate user choices. No route-choice TouchDrive system. | Keep current user controls; optionally add a separately labeled assisted-steering mode later. A matching-looking button does not add TouchDrive. Do not claim copied steering coefficients. | P2 |
| Vehicle-specific contact behavior | Public sources describe game mechanics, not proprietary collision shapes or mass values. | Every car uses the same two-circle, approximately 4.3 m contact body and equal-mass response. Impacts damp yaw but do not generate contact-location-dependent spin. | Derive reasonable contact dimensions from each actual model; bounded angular response and mass classes; revalidate all 33 cars, narrow tracks, seven rivals and checkpoint recovery. | P2 |
| Rival crash presentation | Knockdowns are part of documented racing interactions; exact current animation timing is not publicly specified. [Source](https://gameloft.helpshift.com/hc/en/15-asphalt-legends/faq/605-what-are-barrel-rolls-and-360s/) | Rival model updates get speed, steering, brakes, drift and Nitro, but not impact state. Only the player receives the dedicated particle/contact feedback path. | Share a bounded contact effect pool across nearby rivals; distance-based effects/audio budgets, no need for seven independent full particle systems. | P1–P2 |
| Recovery | No authoritative exact Asphalt respawn duration/distance was established in this audit. | Existing safe recovery catches stopped cars, barrier creep and off-road states; it moves behind validated progress, waits for a gap, does not refill Nitro and preserves checkpoint fairness. | Keep these safeguards if adding cinematic wrecks. Improve visual transition, rather than copying unverified timing or teleporting forward. | Preserve / integrate |

## Why current collisions can feel like nothing

- `src/physics.js:196`: hard contact requires wall-normal/relative closing speed of at least 8 m/s **and** vehicle speed of at least 12 m/s. A fast car grazing a wall can still be a light scrape.
- `src/physics.js:342`: a scrape retains 99.5% of the remaining velocity after removing its outward component; a hard strike retains 82%. Barrier rebound is capped at 1.6 m/s. This avoids repeated punishing wall impacts but feels very soft without sound/body reaction.
- `src/physics.js:207`: the drive reduction lasts only 0.32 seconds. Collision text lasts 0.8 seconds for a hard hit; scrapes do not get the large status/camera cue.
- `src/race-feedback.js:60`: the camera/edge cue is intentionally small and rate-limited; reduced motion suppresses that movement and bright effects.
- `src/main.js:1659` passes only the player's impact to effects. `src/main.js:1699` passes no impact to audio.
- `src/physics.js:468`: two-circle equal-mass contacts do not implement chassis deformation, roll, pitch or a wreck animation.

A fresh deterministic, one-step physics probe reproduced:

| Controlled test | Before | Immediately after | Actual state |
| --- | ---: | ---: | --- |
| Light scrape: 30 m/s along wall, 1.5 m/s outward | 108.13 km/h | 108.03 km/h | Scrape; Nitro remains on; drift bank retained |
| Diagonal hard hit: 18 m/s along and outward | 91.64 km/h | 53.71 km/h | Hard impact; Nitro interrupted; unbanked drift cleared |
| Nose-first wall hit: 25 m/s outward | 90.00 km/h | 4.72 km/h | Hard impact; Nitro interrupted; unbanked drift cleared |

These are controlled engine observations at one 1/120-second simulation step, not a browser recording or a measurement of Asphalt.

## Validation and recommended order

38 existing collision/recovery/effects/feedback tests passed in `/tmp/camber-collision-nitro-audit-tests.log`. They establish that current events and safeguards work in the tested engine cases, not that every real-device crash is visually convincing.

1. Make existing car and wall hits audible and clearly readable; confirm actual mobile play.
2. Add visible Nitro pickups and a satisfying, accurately represented refill loop.
3. Add real Perfect Nitro and full-charge burst states with distinct benefits.
4. Add severe-hit knockdown/wreck presentation and nearby rival effects while retaining fair recovery.
5. Build ramps/stunts/airborne physics as a separate substantial system.

Exact Asphalt handling, restitution, knockdown thresholds, respawn timing and source assets are not established by its public help pages. Those values should be designed and measured for Camber Reign, not claimed as copied.
