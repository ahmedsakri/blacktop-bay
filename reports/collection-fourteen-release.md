# Fourteen-car collection and racing interface — 1 October 2026

Adds Kestrel GT-R, Mirage LMP, Solstice One and Tempest XR to the previous ten fictional race builds. The new profiles change the nose, roof, cockpit, tail or aero geometry and have individual driving tunes. All fourteen keep separate paint and engine/tyre/nitro/handling upgrades. Licensed source geometry and original coachwork are described in Credits; these are not fourteen independently sourced models.

Race HQ now presents the chosen car and a circuit map generated from the actual track path. The garage has GT/Formula/Prototype filters, swipe/keyboard car selection, portraits rendered from the actual models, and performance bars driven by the same saved values as the race simulation. The workshop shows component levels, current/next performance, actual cost, credit balance and purchase feedback. Existing saved cars, wallets and paint migrate intact.

The Asphalt-inspired HUD from a680e03 remains: clear position/progress, compact map, speed/timer, gold/cyan boost and one Nitro driving button. Automatic acceleration, drag steering and high-speed automatic drift are unchanged.

## Verification

- 186 automated tests pass, including real shipping GLB geometry on mobile/high-detail paths, model resource isolation, smooth normals, save migration, paint isolation and stock/max-upgrade races across all five circuits.
- Browser checks at 1280×800, 390×844, 375×667, 844×390 and 568×320: home, garage, filters, all fourteen loaded car portraits, new car selections, workshop, paint and race entry.
- No horizontal overflow at tested phone widths. Compact landscape workshop/filter overlap corrected. Phone garage camera frames its car between the heading and performance panel.
- Actual browser purchase changed the wallet and installed the selected component; purchase feedback appears inside the modal. Metallic paint saved separately for Tempest XR.
- Kestrel visual inspection found backface/normal artifacts; corrected FrontSide material, fender winding and preservation of authored smooth normals. Subsequent WebGL capture shows continuous body paint.
- A new Tempest XR race launched from the garage at 568×320 with the normal chase camera, actual increasing speed/time/progress and Nitro-only driving controls.
- AppsOverFlow content, search data and structured data updated to fourteen builds; 3,011 static checks and 53 tests pass.

These are browser viewport checks, not physical-device performance measurements. Build retains the known ~896 kB JavaScript chunk warning. Preview portraits render only on first garage access and reuse one small disposable renderer.

## Release

Pending final production upload and live verification.
