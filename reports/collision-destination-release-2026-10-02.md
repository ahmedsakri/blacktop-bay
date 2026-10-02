# Collision, destination and sound release review — 2 October 2026

Release checks: the full gameplay suite passed 758/758 tests in `/tmp/camber-release-verified.log` (620.1 seconds). Subsequent loader and directional-cue changes also passed their focused checks. Production build, deployment and live verification are recorded separately below.

## Implemented behavior

The collection remains **33 artist-made manufacturer car representations across 16 brands**. Circuit race has the player and seven opponents. The route collection now contains **38 circuits**, including four new original destinations: Fuji Skyline, Singapore Afterdark, Norway Fjord Run and San Francisco Hills. These are authored arcade environments, not reproductions of Asphalt courses or exact real-world roads.

- **Destinations:** the four new routes have actual road elevation, distinct lighting and scenery, and six optional ramps in total. Scenery includes a mountain/viaduct, marina towers, a fjord bridge/rock gallery and a waterfront suspension bridge. Marked work-zone barriers and rocks have physical collision volumes. Roads, kerbs, rail segments and lane markings follow grades; posts remain upright. Elevated grandstand occupants, skid segments and exhaust anchors retain their world height. Flat road reflections are disabled on elevated routes.
- **Accidents and recovery:** genuine barrier, obstacle and car contacts produce severity-based events. Severe hits enter a 0.7-second loss-of-drive phase, with bounded directional body rotation/lift, then use the existing validated backward recovery to wait for a clear gap. These visual offsets do not move the physical collider. Sustained walking-speed rail pressure has a 2.8-second recovery condition; steering away or braking can cancel it. Eligible front contact during Perfect or Burst Nitro can knock down an opponent, with protection against immediately repeating a knockdown during recovery.
- **Impact presentation:** player contacts drive sparks, road fragments, dust, sound, camera response and visible recovery feedback. Nearby rival crashes use the same fixed particle/audio pools: at most two new nearby events per update, within 64 metres for visuals and 48 metres for crash sound. Event IDs are consumed when distant or paused, preventing delayed replays. The paired sides of one car-to-car contact are deduplicated. Player impact particles and sounds retain priority. Reduced motion suppresses crash rotation, flashes and moving impact bursts.
- **Nitro and airborne motion:** normal hold-to-boost remains available. Deliberate release/repress timing enables Perfect Nitro or full-charge Burst. Six bottles per circuit refill a bounded amount once per racer per lap, with cooldown. Ramps have actual takeoff/landing state; completing a barrel roll earns a Nitro refill. Blue jets and emission origins follow the car's full pitch, roll and heading.
- **Car movement:** bounded suspension responds to acceleration, braking, steering, landings and impacts. Wheelbase/track width remain unchanged. Suspension freezes while paused, resets between races and resumes using real speed instead of creating a false acceleration impulse. Existing model geometry, factory materials and credited source assets remain intact.
- **Audio:** acceleration uses rounded finite-harmonic exhaust waves, gradual throttle load and smoothed gear changes. Nitro uses a restrained low thrust bed, a pressure onset and a short release. Original synthesized sounds cover impacts, scrape contact, landings and pickups; speed-linked road/wind and location-weighted crowd ambience add context. Three reusable stereo voices cover nearby rival engines; four reusable voices cover transient effects. Master, engine, SFX and music levels remain separate. Unlock, mute, visibility and pause gates remain enforced. **Liquid Lines is still the only lobby soundtrack.** These are game synthesis profiles, not recorded OEM engines.
- **Spectators and rendering:** procedural clothing/skin micro-surfaces, tailored silhouettes and varied gestures extend the existing instanced crowd. Six shared textures retain the ten-draw crowd budget. Foreground animation is capped at 10 people/30 Hz on the low profile and 20 people/60 Hz on the higher profile; background updates are capped at 15/24 Hz. These are update budgets, not measured frame-rate claims. Performance, Balanced and High detail presets cap pixel ratio at 1, 1.35 and 1.75 respectively; automatic selection uses Balanced for the mobile profile. Graphics quality does not change the underlying wet-road sound/effect classification.

The accompanying campaign/setup work provides 12 authored events in four chapters, four per-car setup choices with explicit trade-offs, and five mastery goals. Completion consumes the existing successful finish receipt; it does not invent extra currency or accept incomplete races. See [driver-development.md](../docs/driver-development.md).

## Verification recorded

Automated checks completed in this work:

- **107/107 focused checks passed**, covering actual shipping mobile/desktop model assets, audio, impact effects and nearby event handling. Shipping tests now require unchanged axle X/Z positions, less than 22 mm of bounded wheel Y travel, body response and pause stability; they no longer incorrectly require suspension Y to remain fixed.
- The final particle-priority adjustment passed **15/15 effects tests**. A final finite-distance guard passed **13/13 nearby-impact and race-sound tests**.
- Earlier focused checks cover all 33 engine profiles, gear/resume behavior, bounded sound graphs, graded skid continuity, full Three.js pose alignment, crowd budgets, gamepad input and graphics presets. These subsets overlap and must not be added together as a unique total.
- **Full gameplay suite: 758 passed, 0 failed, 0 skipped.** This includes the stock/upgraded vehicle race matrix. After that process had loaded its modules, the directional impact cue was corrected with a real Three.js camera-projection regression (15 focused tests passed), and the reusable loader was added (19 loader/lobby/settings tests passed). These focused totals overlap existing tests and are not a combined unique count.

The release owner reported the following local in-app browser observations. These are desktop browser viewport checks, not physical-phone tests:

| Viewport / interaction | Recorded observation |
| --- | --- |
| 1280 × 800 | Desktop interface inspected. |
| 390 × 844 | Lobby and portrait-to-landscape racing gate inspected. |
| 844 × 390 | Race controls measured at 84 × 172 px for steering and 96 px for Nitro. |
| 568 × 320 | Pause controls remained visible. |
| 320 × 740 | Setup content scrolled without horizontal overflow. |
| Singapore Afterdark runtime | A real high-speed barrier impact with normal closing speed about 32.7 m/s triggered the wreck state. |
| San Francisco Hills runtime | A real contact at 33.34 m/s normal closing speed triggered the wreck state. The release owner's captured `/tmp/camber-reign-race-review.png` shows sparks, the raised/rotated car and the WRECKED interface together. This records one actual runtime collision, not coverage of every collision angle. |
| Fuji Skyline runtime | A stuck car recovered twice and was moving at about 87 km/h by 45 seconds. |
| Pause input | P paused/resumed the race and held inputs were cleared. |
| Career navigation | Selecting First Light opened Harbor Flow's menu for review without automatically starting a race. |
| Per-car setup | Selecting Corner grip changed the selected car's displayed top speed to 173 km/h and showed saved status. This is that car's game stat, not a universal setup speed. |
| Simultaneous control handlers | Synthetic pointer handlers retained steering about 0.919 and Nitro true together. Raw multi-touch injection was unavailable in the in-app browser; physical multi-finger interaction remains unverified. |

The release owner rendered the actual Web Audio graph using [sound-review.html](sound-review.html). The final full-buffer peak/RMS measurements were **0.2711 / 0.1001** for acceleration, **0.3764 / 0.1210** for mixed Nitro and **0.6071 / 0.2134** for the maximum-volume Nitro fixture. All peaks are below full-scale 1.0. No subjective listening claim is made here. Initial truncated exports were replaced using bounded browser DOM chunks. The complete 16/11/8-second WAV files at `/tmp/camber-reign-acceleration-refined.wav`, `/tmp/camber-reign-nitro-refined.wav` and `/tmp/camber-reign-nitro-maximum.wav` are **768,044 / 528,044 / 384,044 bytes** respectively, matching their declared PCM frames and headers. File completeness was independently checked; those files are local QA evidence, not published release assets.

## Limits and remaining release checks

This is an original browser arcade racer, not an exact Asphalt implementation. Collision shapes and recovery are simplified. Wreck motion does not deform vehicle meshes, detach authored panels or simulate a full rigid-body rollover. Spectators remain procedural instanced figures, not photorealistic scanned people. Branded models remain artist-made representations with their existing attribution; no new claim of manufacturer endorsement is made.

No real-device FPS, thermal, memory, gyroscope or multi-touch performance result is claimed. The browser observations do not prove every circuit, car, device or sound output has been visually/audibly verified. Deployment and live-site verification are recorded separately.

## Shared logo loader

Startup, car changes and opponent preparation now use the approved Camber Reign logo with a tracing shield, yellow circuit stroke and masked light sweep. Unknown downloads show a named phase without a fabricated percentage; opponent preparation counts completed models. The old forced 1.25-second intro minimum is removed. Existing cars remain visible during a model change; completion, cancellation and failure clean up the scoped loader. Optional scenery does not block gameplay.

Actual startup captures were checked at 1280×800, 390×844 and 568×320 with no horizontal overflow. The browser reported the shield, sweep, rail and ambient animations running; switching to reduced motion removed all loader animations. Race preparation displayed “Preparing opponent 4 of 7” with 3/7 completed, then entered the race and removed the loader. Cached preparation finished before a manual Back click could be exercised; cancellation is covered by the focused async tests. Network and motion emulation were restored after these checks. Screenshots: `/tmp/camber-reign-loader-desktop.png` and `/tmp/camber-reign-loader-mobile.png`.
