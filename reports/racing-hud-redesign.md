# Blacktop Bay race HUD redesign

Prepared 1 October 2026. **Implemented and reviewed locally; final production deployment receipt is recorded below.** The user requested a race-screen layout inspired by Asphalt Legends after rejecting the previous HUD. The user has not yet reviewed the resulting design; the QA below records implementation checks, not user approval.

## References

- [Supplied race-screen reference, hosted by Meridiem Games](https://meridiem-games.com/backoffice/public/uploads/games/908/ZYK3g7.jpg).
- [Official Asphalt Legends website](https://asphaltlegends.com/), consulted for the arcade-racing and nitro presentation context.

Use these references to guide the information hierarchy and placement. Blacktop Bay keeps its own identity, artwork and race data.

## Implemented race-screen layout

| Area | Presentation | Information or behavior |
| --- | --- | --- |
| Upper left | Compact pause control with stacked POS, lap and distance information | Position in the four-car field, current lap out of three, and clearly labeled distance/progress from the actual race state |
| Left edge | Borderless minimap below the race information | Current circuit and car markers, with sufficient contrast against the scene and no large surrounding panel |
| Top center | Slim horizontal boost bar | Remaining nitro charge; distinguish available, active and empty states without obscuring the road |
| Upper right | Large speed readout with a smaller race timer | Speed with its unit and elapsed race time, aligned consistently as values change |
| Right side | Transient drift feedback | Show feedback only for real drift activity and earned results; fade it away when no longer relevant |
| Lower right | One circular Nitro driving button | Hold to boost; retain a clear touch target and visible charge/pressed feedback |

Keep the car, approaching corner and central road unobstructed. Favor compact labels, strong numeric hierarchy and restrained shadows over opaque dashboard panels. Respect display cutouts and landscape safe areas. Any distance label must identify its meaning and unit; feedback must not imply scoring systems that Blacktop Bay does not implement.

## Controls retained

This is a HUD redesign, with no planned physics or control changes. Acceleration remains automatic on every device. Drag left or right across the race view to steer and lift to center. Sharp turns at speed trigger automatic drift. Nitro remains the only on-screen driving button. Keyboard controls remain Left/Right or A/D to steer, Down/S for the optional brake, Space for the optional handbrake and Shift for Nitro. Mobile races remain landscape-only; rotating upright pauses.

## Recorded QA

- Inspected **568×320**, **844×390** and **1280×720** browser viewports. No horizontal overflow; mobile Nitro targets measured **74×74** and **86×86** respectively. Pause remains at least44×44. Passive telemetry uses pointer-events:none.
- Reviewed the typography/spacing against the linked reference: borderless race stats and map left, thin gold/cyan boost bar top-center, large italic white speed top-right with a coral timer, transient right-side drift feedback, circular Nitro bottom-right. The lowered chase camera uses a closer view without changing vehicle physics.
- Actual pointer press activated boost and reduced charge from3.8 to3.68 seconds; the bar, ring and active cyan styling responded. Empty charge produced RELEASE/RECHARGING states. Pointer release and pause clear input.
- Dragging directly through the minimap area reached proportional steering0.46. Rotating to **390×844** presented the landscape gate, paused the race and cleared all held inputs; steering read0.
- Sound toggle inside Pause changed on→off→on correctly. Fullscreen controls now report unavailable/error messages inside the dialog, where they remain visible. Actual physical-device fullscreen behavior was not tested.
- **134 automated tests passed**, including eight added presentation tests. Race completion uses checkpoint-guarded distance across all three laps, floors incomplete races below100%, and was checked with reverse/reset/teleport and an actual three-lap fixture. Drift feedback uses actual pending/banked points and same-race snapshot checks. A review fix prevents a previous banked message from covering points from a new drift.
- The production build passed. Existing large-JavaScript-bundle warning remains; no frame-rate or performance guarantee is implied.
- Reduced-motion styling disables the added transitions. Physical-device touch/FPS, every possible display cutout and every track/light combination were not tested. These are browser viewport inspections.

## Completion record

Pending final Hosting release and live file verification.
