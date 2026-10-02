# Camber Reign — visual, audio and header release

## Delivered changes

- Garage is a visible button in the top resource strip, next to the credit balance. It opens the existing 33-car collection. The lower lobby navigation now contains Circuit race, Time attack, Career and Circuits. Compact credit text preserves the full accessible amount and fits the maximum balance on 320px screens.
- All 33 selectable cars now have a licensed recorded engine layer, using 14 banks and individual tuning. These are explicitly credited engine-family adaptations, not a claim of exact recordings from every represented model. The synthesized layer remains a controlled supporting layer and network-failure fallback.
- Six textured adult spectator variants replace close-up procedural bodies. A fixed pool of six on mobile or ten on desktop retains distant instancing, varied animation and reduced-motion/pause handling. Assets and modifications have public CC0 attribution.
- Asphalt, concrete and terrain have real colour, roughness and normal detail; barriers and regional architecture have additional modeled details. The six shared mobile surface maps use approximately 333KB transfer and 5MiB GPU storage; desktop variants use approximately 1.49MB and 20MiB.
- The garage uses licensed photographic studio reflections, neutral wall/floor materials, metal trim and violet inset lighting. The existing environment remains available if HDR loading fails. Lifecycle cleanup covers the garage, track surfaces and spectator assets.

## Verification

- Complete suite before the last crowd-distance adjustment: 1,030 passed, zero failed. Mandatory Firebase predeploy repeats the full suite and production build for the final state.
- Rendered desktop and mobile layouts checked at 1280×800, 390×844, 844×390, 568×320 and 320×740. Header targets are at least 44px. A temporary one-million-credit display fits at 320px; test-only display changes were cleared by reload.
- Header Garage opens /cars/; selecting an individual car opens its real 3D garage. Starting a race hides the menu resources and preserves the racing HUD and touch controls.
- Actual Harbor Flow race telemetry observed six active textured spectators from the normal driving path. All six assets loaded with no queued downloads left.
- Rendered surface review caught and fixed an immutable GPU texture-size issue. After an initial placeholder frame, all six mobile textures have nonuniform GPU samples, no GL errors and no failed downloads. The reviewed Fuji scene used 95 draw calls / 80,712 triangles after distance culling; San Francisco used 130 / 90,886. These are scene-fixture measurements, not whole-game frame-rate claims.
- The actual browser audio fixture decoded/rendered all 33 car profiles across 14 banks: zero failures, maximum sample peak 0.604216814, ramp/idle RMS ratio at most 1.25, silent when paused. Licensed derivatives reproduce the recorded source hashes.
- Source and public credits record author, source, licence and adaptation details. The local review fixtures are outside the deployed site output.

## Practical limits

This release improves the working browser game; it does not claim visual parity with Asphalt Legends. Distant crowds remain simplified and the tracks share regional construction systems. This pass used browser rendering and viewport checks; new sustained physical-iPhone/iPad frame-rate, heat and listening tests have not been performed. Engine-family adaptations are identified honestly in the credits.

## Release

Pending final predeploy checks, GitHub main push and Firebase deployment.
