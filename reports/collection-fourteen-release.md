# Fourteen-car collection and racing interface — 1 October 2026

Adds Kestrel GT-R, Mirage LMP, Solstice One and Tempest XR to the previous ten fictional race builds. The new profiles change the nose, roof, cockpit, tail or aero geometry and have individual driving tunes. All fourteen keep separate paint and engine/tyre/nitro/handling upgrades. Licensed source geometry and original coachwork are described in Credits; these are not fourteen independently sourced models.

Race HQ now presents the chosen car and a circuit map generated from the actual track path. The garage has GT/Formula/Prototype filters, swipe/keyboard car selection, portraits rendered from the actual models, and performance bars driven by the same saved values as the race simulation. The workshop shows component levels, current/next performance, actual cost, credit balance and purchase feedback. Existing saved cars, wallets and paint migrate intact.

The Asphalt-inspired HUD from a680e03 remains: clear position/progress, compact map, speed/timer, gold/cyan boost and one Nitro driving button. Automatic acceleration, drag steering and high-speed automatic drift are unchanged.

## Verification

- 187 automated tests pass, including real shipping GLB geometry on mobile/high-detail paths, model resource isolation, smooth normals, save migration, paint isolation and stock/max-upgrade races across all five circuits.
- Browser checks at 1280×800, 390×844, 375×667, 844×390 and 568×320: home, garage, filters, all fourteen loaded car portraits, new car selections, workshop, paint and race entry.
- No horizontal overflow at tested phone widths. Compact landscape workshop/filter overlap corrected. Phone garage camera frames its car between the heading and performance panel.
- Actual browser purchase changed the wallet and installed the selected component; purchase feedback appears inside the modal. Metallic paint saved separately for Tempest XR.
- Kestrel visual inspection found backface/normal artifacts; corrected FrontSide material, fender winding and preservation of authored smooth normals. Final production inspection exposed remaining artifacts in the shared GT source surface. Rebuilt both shipping assets with original body, glass, chrome and wheel geometry; retained normal shadows, removed an obstructing rear-fender strip, and versioned asset URLs. Low- and high-detail WebGL comparisons now show clean paint and distinct spokes. A new face/normal-coherence regression covers the body and all four wheel/rim assemblies in both assets.
- A new Tempest XR race launched from the garage at 568×320 with the normal chase camera, actual increasing speed/time/progress and Nitro-only driving controls.
- AppsOverFlow content, search data and structured data updated to fourteen builds; 3,011 static checks and 53 tests pass.

The repaired GT assets contain 209,180 triangles / 5.73 MB on mobile and 251,076 triangles / 6.94 MB on desktop; this deliberately retains more visible detail than the damaged earlier simplification. Offline tooling and exact source attribution are documented in `scripts/rebuild-gt-assets.mjs` and the shipped model credits.

These are browser viewport checks, not physical-device performance measurements. Build retains the known ~896 kB JavaScript chunk warning. Preview portraits render only on first garage access and reuse one small disposable renderer.

## Release

Blacktop Bay commit `3fb0af9` pushed to personal GitHub and deployed to `https://blacktop-bay.web.app/` with 186/186 predeploy tests. Live JavaScript `index-CeA2kX34.js` and CSS `index-BSDRvOKm.css` match the built files byte for byte; published HTML advertises all fourteen names and contains only Nitro as a driving action.

AppsOverFlow commit `4cb2b7e` pushed and deployed to `https://appsoverflow.web.app/`. Production deploy passed 3,011 static checks plus 22 backend/148 contact-client mock checks; live homepage and `/projects/blacktop-bay/` contain the fourteen-car content. No contact submission was sent as part of this change.
