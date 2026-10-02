# Crash motion and vehicle damage review — 2 October 2026

Implemented:

- Severe impacts now integrate centre-of-mass height, gravity, pitch/roll/yaw rates and velocity in the engine's existing 120 Hz fixed step. A bounded oriented box supports the body on the road during a rollover, with angular/linear damping and small rebounds. The previous 0.7-second presentation sine is removed.
- Actual sufficiently energetic lateral contact can overturn the car. Head-on contact can pitch and bounce without forcing an identical barrel roll. The chassis loses drive during the wreck, then uses the existing validated backward safe-gap recovery after settling or a maximum 2.8 seconds. A blocked recovery continues waiting; it does not invent progress.
- Heavy collisions indent affected body surfaces. The displayed instance lazily owns cloned geometry, preserving the source cache and other cars. Up to three damage applications last until recovery, reset, restart, or leaving racing.
- A severe hit can sever up to two small patches of the actual painted surface. Exactly those triangles are removed from that car and rendered independently with gravity, spin, ground bounce and a 2.5-second lifetime. These are fractured body patches, not pre-authored doors/bonnets. Each fragment has at most 2,048 desktop / 1,024 mobile triangles.
- Source models with an absent underside receive a simple original dark undertray when a rollover exposes that void. This is not claimed as an authored manufacturer underbody or detailed suspension.
- Camera heading stays on the pre-impact road heading during the wreck. Reduced motion keeps a static damaged chassis and suppresses body tumble/lift/spin presentation and detached animation while preserving physical recovery behavior. Pause freezes fragment movement.

Automated verification:

38 focused tests passed across `car-damage`, `manufacturer-car`, `wreck-motion`, `collision-pose`, `crash-recovery`, `air-motion` and `nitro-knockdown` after the implementation. Tests cover actual severe wall contacts and overturning, support penetration, bounded recovery, unchanged validated distance/Nitro rewards, pause freezing all engine fields, reset/restart, contact direction, rest, 30/60/120 Hz equivalence, real source triangle extraction, instance/cache isolation, restoration, fragment caps/lifetime, reduced motion and existing ordinary collision/ramp/Nitro behavior. The old Nitro test now waits 3.5 seconds to cover the intentionally longer physical wreck.

Renderer verification:

`reports/crash-review.html` is a local fixture using shipping manufacturer models and runtime deformation/wreck modules. It is excluded from production. The deliberately staged impacts are not described as completed gameplay tests.

At 1280 × 720 in the in-app Chromium browser, inspected McLaren 570S and Lamborghini Aventador impacts, detached actual surfaces, inverted poses, reduced-motion suppression and restoration to the original geometry/triangle count. Console had no errors. Saved:

- `crash-rollover-renderer-2026-10-02.jpg` — McLaren inverted with separate orange body patches.
- `crash-reduced-motion-renderer-2026-10-02.jpg` — same physical state shown as a static damaged car.
- `crash-lamborghini-renderer-2026-10-02.jpg` — another source, including the original simple undertray.

Limits:

This is bounded arcade rigid-body approximation, not soft-body deformation. Existing car/obstacle horizontal collision shapes remain simplified; fractured surface holes do not alter those colliders. Road support uses the sampled road height. Fragments collide with a local road-height plane rather than other cars, scenery or barriers. Body damage is temporary and has no persistent repair economy. Sources without suitable triangles may dent without shedding a patch. Direct browser gameplay severe-contact verification is separate from the staged renderer evidence; the hidden full-game tab stalled at first-frame initialization without console errors, so no full-game crash screenshot is claimed here. Root release checks own the complete build, broad regression run and visible gameplay smoke tests.

Geometry budget review:

Inspected the glTF accessor layouts of all 33 shipping cars at both detail levels. Every car has explicit paint candidates, so normal operation does not fall back to cloning broad interior/glass geometry. Conservatively counting every body attribute/index as expanded 32-bit values, the largest eligible geometry set is 2.90 MiB at mobile detail (Ferrari 250 GTO) and 3.53 MiB at desktop detail (BMW F22); actual packed mobile geometry tops out around 1.45 MiB. Cloning only affected surfaces is lazy and bounded to one owned copy per surface. Even eight copies of the worst case would be approximately 23.2 MiB mobile / 28.2 MiB desktop additional base geometry, plus bounded fragment vertices; this is an accessor-based upper estimate, not a measured browser heap or physical-phone GPU profile. All texture images remain shared. Deformation and triangle extraction scan geometry only at an accepted collision, up to three times per recovery cycle; no per-frame full-body vertex scans occur.

Full-suite follow-up:

The broad regression run exposed eager allocation of the hidden undertray in pristine cars. Changed the runtime to create and attach it only after a severe contact, then dispose/remove it on restoration. The existing exact source triangle counts, shared pristine geometry, per-instance material isolation and asset budget assertions remain unchanged. Updated two older obstacle/wreck checks that assumed 0.75-second recovery to enforce the new physical interval: loss of drive first, recovery within three seconds on a clear road, and unchanged rewards, checkpoint protection and impact deduplication. The five affected suites (`manufacturer-assets`, `manufacturer-car`, `car-damage`, `wreck-obstacles`, `wreck-motion`) passed all 88 tests, including all 66 shipping model/detail variants.
