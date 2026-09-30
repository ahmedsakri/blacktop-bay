# Blacktop Bay

An original AppsOverFlow browser racer. Drive a red sports coupe around a 1.22 km waterfront circuit, hold clean drifts for points, and finish three laps to chase your own fastest ghost.

## Play

The car accelerates automatically. **Arrow keys / A and D** steer; **Space** drifts; **Down / S** brakes; **R** returns the car to its last valid road position; **Esc / P** pauses. Touch devices have separate steering, brake and drift pads. Fullscreen is available where the browser supports it.

Your first race includes a labelled practice pace car. Completing a faster race replaces it with a recording of your own run. The ghost is non-colliding. Best time, best drift score and sound preference stay in local browser storage; clearing site data removes them. Runs over 15 minutes do not create records.

## Development

Requires Node.js 22.12+ (tested with 24.14.0).

```sh
npm ci
npm run dev
npm test
npm run build
```

Local development: http://127.0.0.1:4180/. Production files: `dist/`.

## Architecture

- `src/track.js`: closed spline road, distance samples and projections.
- `src/physics.js`: fixed 120 Hz arcade handling, actual lateral slip, barriers, drift scoring and ordered lap checkpoints.
- `src/car.js`: original sculpted sports coupe, physical materials, glass, steering wheels and brake lights. No manufacturer badges or licensed vehicle branding.
- `src/world.js`: dusk waterfront, wet road reflection, skyline, palms and scenery.
- `src/main.js`: race lifecycle, responsive HUD, camera, inputs, dialogs and ghost playback.
- `src/effects.js`: bounded tyre-mark and smoke pools.
- `src/audio.js`: gesture-unlocked, synthesized engine and tyre audio.
- `src/storage.js`: validated records, bounded ghost data and graceful storage failure.

All visuals are rendered in real time. The original AI concept is art direction, not a screenshot of gameplay. This is a purpose-built arcade simulation, not licensed vehicle physics or a photogrammetry recreation.

## Privacy and accessibility

No account, advertising, analytics, service worker or offline cache is installed. Assets and fonts are self-hosted. Firebase serves the website and can process normal hosting request logs. Keyboard focus, labelled controls, a trapped modal focus loop, reduced interface motion and pause-on-background are supported. Racing necessarily involves motion; pausing stops play and audio. WebGL 2 is required; unsupported devices receive a clear fallback message.

## Asset credits

- Original game code, coupe, circuit, shaders, graphics and synthesized sound: AppsOverFlow.
- Three.js: MIT; dependency licence retained by npm.
- Oxanium: SIL Open Font License; `public/assets/Oxanium-OFL.txt`.
- Manrope: SIL Open Font License; `public/assets/Manrope-OFL.txt`.

## Release checks

Run `npm test` and `npm run build`, then verify the main menu, first countdown, steering/braking/drifting, reset, pause/resume, complete race, personal-best ghost, sound and touch layouts in a browser. Repeat viewport checks at 390 × 844 and 844 × 390. Do not infer identical performance on all phones from desktop emulation.

Deployment is scoped to the dedicated Firebase Hosting site in `firebase.json`, never the other websites in the shared Firebase project.
