# Blacktop Bay

A free AppsOverFlow browser racer. **Own the corner.** Choose a GT or Formula racing setup, upgrade its performance, and compete against three AI drivers across three asphalt circuits.

[Play Blacktop Bay](https://blacktop-bay.web.app/) · [Driver’s guide](https://blacktop-bay.web.app/guide/) · [Asset credits](https://blacktop-bay.web.app/credits/)

## Driving

The car accelerates automatically. Right/D turns driver-right; Left/A turns driver-left. Hold Space to drift, Down/S to brake and Shift for nitro. R resets to the last valid road position; Esc/P pauses. Phones have separate steer, brake, drift and nitro pads. Nitro is finite; release the trigger to recharge while driving. Clean drifting restores charge faster. Resetting cannot refill the tank or award lap progress.

Mira, Jax and Nova use the same physical simulation, with steering, braking, avoidance, passing and car-to-car contact. Three valid laps complete a race. Standings use actual progress and finish crossings; unfinished rivals continue racing after the player finishes.

| Car | Race setup | Base speed rating | Base nitro |
| --- | --- | ---: | ---: |
| Apex GT | Balanced GT circuit racer | 162 km/h | 3.0 s |
| Apex Sprint | Responsive white-and-blue GT sprint build | 158 km/h | 2.8 s |
| Torque R | Endurance GT with stronger acceleration | 173 km/h | 3.0 s |
| Torque RS | Navy endurance build with a larger boost tank | 166 km/h | 3.8 s |
| Vortex P1 | Open-wheel Formula racer with agile handling | 151 km/h | 3.4 s |
| Vortex X | Lime Formula attack build | 169 km/h | 3.2 s |

| Circuit | Length | Character |
| --- | ---: | --- |
| Harbor Flow | 1.22 km | Waterfront sweepers and an inland section |
| Dockyard Technical | 1.53 km | Tight turns and precise braking |
| Coast Run | 1.13 km | Open curves and longer nitro opportunities |

Speed ratings describe arcade tuning, not real-world manufacturer specifications or a guarantee of cornering speed.

## Workshop and progression

Each car has five levels of Engine, Tyres, Nitro and Handling. Engine improves acceleration, tyres improve grip/braking, handling improves steering response, and nitro improves capacity, thrust and recharge. All four also increase the car’s base top-speed rating. The chosen upgrades are snapshotted into the actual race physics; AI remains at base tuning.

New players start with 1,200 CR. Levels cost 200, 400, 700, 1,100 and 1,600 CR. Finishing pays 900/650/500/350 CR for places 1–4 plus `floor(driftScore / 20)`, capped at 500 bonus CR. Valid finishes pay once per race ID; incomplete or over-15-minute runs do not create rewards or records. Credits have no cash value and cannot be bought with real money.

Car/circuit choices, upgrades, credit balance and results save in local browser storage. Best time and drift score are separated by car/circuit. Clearing race records preserves upgrades; clearing site data removes all local progress. Blocked storage allows session-only play and upgrades. This is a local single-player economy, not a secure competitive server leaderboard.

## Graphics and motion

The game renders detailed licensed 3D meshes in real time. Six fictional race builds use two source model families: Apex GT, Apex Sprint, Torque R and Torque RS adapt a shared GT source; Vortex P1 and Vortex X adapt a Formula concept. Their liveries, race numbers, aero setups and driving tuning differ. The garage supports drag rotation, keyboard-accessible quarter turns, neutral studio lighting and responsive camera framing. Wheels steer/roll, brake lamps respond and nitro uses model-specific exhaust outlets. Body paint, glass, carbon and rubber use separate physical materials. Mobile and AI use reduced-detail geometry.

A phase-based animated logo loader waits for models, shaders and fonts. Camera inertia, speed-dependent field of view, drift smoke, road spray, skid marks and contact sparks respond to gameplay. Pools are bounded and smoke/skid anchors follow each model’s measured tyres. SMAA smooths post-processing edges. Reduced motion disables decorative orbit, entrance animation, bank and shake; the driving camera still moves with the race.

Racing Sans One is used for display headlines, Barlow Condensed for telemetry and Manrope for readable controls/body copy. Fonts are self-hosted with OFL notices.

## Development

Requires Node.js 22.12+ (tested on Node 24).

```sh
npm ci
npm run dev
npm test
npm run build
```

Local: http://127.0.0.1:4180/. Production output: `dist/`.

- `src/physics.js`, `src/track.js`, `src/rivals.js`: fixed-step handling, three layouts, AI, nitro, checkpoints and race classification.
- `src/progression.js`, `src/upgrades-ui.js`: bounded upgrade levels, credit economy, persistence and workshop previews.
- `src/car.js`, `src/vehicles.js`, `src/garage.js`: cached licensed models, materials, animations, catalog and inspection studio.
- `src/main.js`: loader, race/menu lifecycle, camera, input, garage and results.
- `src/world.js`, `src/effects.js`, `src/audio.js`: environment, bounded driving effects and synthesized audio.
- `src/storage.js`: validated race records with graceful storage failure.
- `src/analytics.js`: consent gate, production-host guard and sanitized event allowlist.

## Privacy and services

No player account, name or email is required. GA4 `G-RC925EV263` loads through dedicated GTM `GTM-PZHDLVK8` only after analytics consent on the production hostname. Advertising consent stays denied. Query strings and page fragments are excluded from analytics page locations. Users can revoke consent in Privacy. AdSense metadata and ads.txt support the review request; no advertising script or ad unit is active. See the live privacy notice for details.

Google/Bing verification tags, robots.txt, sitemap.xml and crawlable guide/privacy/credits pages are included. VideoGame, FAQPage and HowTo JSON-LD describe visible facts. Structured data does not guarantee rankings, rich results or AI citations. External console submission results are recorded in `reports/seo-review.md`.

## Credits and validation

Original game code, tracks, branding and racing adaptations: AppsOverFlow. Formula source: Qvist_designs, CC BY 4.0. GT source: vicent091 / Three.js Ferrari model, CC BY 4.0. Full source URLs, adaptation notes and licences: `public/credits/` and `public/assets/cars/`. Three.js is MIT. No manufacturer or motorsport affiliation is implied.

The automated suite covers driving, lap guards, rivals, all circuits, nitro, upgrades, payments, storage and analytics privacy. Browser checks and their limits are documented in `reports/release-checks.md`. Phone viewport emulation does not establish performance on every physical phone.

Deployment targets only Firebase Hosting site `blacktop-bay` in project `echo-heist`, never other shared-project sites.
