# Camber Reign

A free AppsOverFlow browser racer. **Own the corner.** Choose from 33 individually sourced manufacturer car representations across 16 brands, upgrade their performance, and compete against seven rivals across thirty-eight asphalt circuits.

[Play Camber Reign](https://camber-reign.web.app/) · [Driver’s guide](https://camber-reign.web.app/guide/) · [Asset credits](https://camber-reign.web.app/credits/)

## Bring existing progress to the new address

Camber Reign uses a new Firebase Hosting address. Browser saves belong to their original domain, so they do not move automatically. Choose **Bring your saved progress** in Race HQ or either collection to open `/move-progress/`. It opens the former site's `/save-transfer/` page as a separate window. In the same browser and profile, choose **Send saved progress** to copy only this game's recognised settings, credits, upgrades, paint, favourites, race records and career data.

The receiver verifies the old origin, exact popup, one-use random nonce, recognised keys and bounded JSON data. It asks before replacing existing earned progress and saves a local backup before writing. A failed write attempts to restore the current save; if the browser blocks that restoration, the page exposes a backup download. The old save remains untouched. Analytics consent is excluded and must be chosen separately on the new address. Save contents never appear in a URL and are not uploaded to a server. All existing gameplay storage keys remain unchanged for compatibility.

## Keep a portable backup

Use **Save backup** to export a versioned JSON file and import it on another browser or device. The file covers preferences and controls, credits, upgrades, paint, favorites, campaign, mastery, per-circuit setups, tour history, driving-school progress and race records/replays. Import previews the contents before replacing local progress. It validates every section, keeps a durable recovery snapshot and verifies the writes; failure restores the previous save or keeps recovery available. Analytics consent and authentication data are excluded. There are no accounts, sign-in or automatic cloud sync.

## Find your next race

The Race HQ lobby keeps your selected car on the studio floor, with its current speed, Nitro capacity and installed upgrade count. Use the bottom navigation to switch between Circuit race, Time attack and Three-race tour. The race settings button below the circuit preview changes rival difficulty and shows medal targets or a saved tour. Changing a mode updates its own record immediately; Race Now starts the selected mode.

Choose **Cars** to open the full 33-car collection. Preview a car using its card or the previous/next controls, then choose **Open garage** to load and select its actual 3D model. The collection distinguishes the preview from your current car. In the garage, use **Upgrades** for performance upgrades, **Paint** for finishes, **Race** to drive or **Back** to return to the lobby. The credit balance at the top of the lobby also opens your current car’s workshop.

Choose **Circuits** in the bottom navigation, or select the circuit name, to open the 38-route collection. Inspect the scenic preview, actual playable route and lap length, then use **Select circuit** to return to Race HQ with that venue. Previewing a card does not start a race. Search, region and series filters narrow the route strip; **Full grid** shows every matching circuit together.

Use the steering-wheel control in the top rail for driving help, steering sensitivity and sound levels. The speaker mutes the entire game; fullscreen has its own control. Menus and collections work in portrait, while racing uses landscape on phones. Short landscape screens keep primary actions in view, respect the display cutout and home indicator, and scroll longer dialog content inside the dialog. Medal targets expand separately in race setup.

## Campaign and car development

**Career** offers 18 events in six chapters, preserving the original twelve event records. Advanced goals track Perfect Nitro, Burst Nitro, clean overtakes, pickups and clean sectors from the actual simulation. Complete the first objective to advance; return for optional bonuses. The next-goal suggestion names the action and circuit. Mastery tracks five per-car accomplishments without adding hidden performance.

**Upgrades → Setup & mastery** provides a car default and an optional setup for the current circuit. The screen shows each setup's gains, costs, resulting speed and acceleration; existing upgrade previews compare current and next-level values using the effective setup. Other circuits keep their own choices. [Implementation and save compatibility](docs/driver-development.md).

## Driving

Six Nitro bottles per circuit refill 32% of capacity, capped at a full gauge. Each racer has a separate once-per-lap collection, with an eight-second minimum cooldown. Hold Nitro for normal boost. Release and press again 0.35–0.8 seconds after the first press for Perfect Nitro; a second press within 0.28 seconds of a full-charge start gives a stronger, faster-consuming burst. Keep the second press held. Holding alone never selects an advanced mode.

A severe impact causes a short wreck phase with no drive, then waits for a safe space behind your validated progress. Ordinary heavy hits still allow you to steer away. Sustained walking-speed pressure against a rail has a 2.8-second recovery timer even when the car inches forward; braking, handbraking or turning away cancels that condition. A real front strike during Burst or Perfect Nitro can knock down an opponent when speed and closing energy are sufficient; ordinary boost, gentle taps and passing alongside cannot. Recovery protection prevents repeated knockdowns. Optional ramps on the four destination routes have real launch and landing motion; completed barrel rolls refill some Nitro. Road barriers and marked obstacles are solid, while a high enough jump can clear a low obstacle.


Acceleration is automatic. Hold the left or right side of the steering thumbpad, or drag it for fine control; release to center. You can also drag across the race view or use Left/Right or A/D on a keyboard. On a compatible phone, open Pause → Steering → Enable tilt, allow motion access if asked, and use Recenter tilt in your comfortable holding position. Touch steering always overrides tilt, and unavailable or stale sensor data falls back to touch. Turn sharply at speed to drift automatically. Hold Nitro or Shift to boost; release to recharge. Nitro is the only on-screen pedal. Down/S is an optional keyboard brake and Space holds the optional handbrake.

Light barrier scrapes preserve most forward momentum. A hard impact briefly reduces drive, interrupts nitro and clears unbanked drift points; steering stays available as grip settles. A car nearly stopped against a barrier can recover after about 2.4 seconds of attempted acceleration. Recovery also catches sideways wall-creeping: if you keep pushing into a barrier without advancing along the course, a countdown appears before recovery at about 2.8 seconds. A car far off the road can recover after about 0.9 seconds. Automatic recovery looks for a clear gap behind your last valid progress and may wait for nearby cars to move. It normally retreats at least eight metres, limited by the distance already driven in that lap. It restores any crossed checkpoint requirement and has a three-second cooldown. Moving clear, braking or holding the handbrake cancels a pending return. R or Reset car remains available manually. Neither method adds lap progress or refills nitro; race time keeps running.

Esc/P pauses. Switching away from the tab pauses an active race. Mobile races require landscape: turning upright pauses without losing position. Rotate back and choose Keep driving. Fullscreen and orientation lock are requested when supported; otherwise rotate the device manually. On iPhone Safari without page fullscreen, **Full-screen play** explains how to use Share → Add to Home Screen with **Open as Web App** enabled. Launch the icon to play without Safari’s address bar. This web app still requires an internet connection; installation does not add offline play. The menu and garage also work in portrait.

On phones, **Automatic** graphics uses the Performance preset: pixel ratio is capped at 1, and shadows, bloom and reflections are disabled. You can change graphics under Pause → Display & controller. Mobile rendering is capped at 30 updates per second in menus and the garage, 15 while paused and 60 during racing; hidden pages skip rendering and simulation. These limits reduce unnecessary work, especially on high-refresh screens, but do not establish a sustained frame rate or a measured temperature improvement on a particular phone.

Camber Reign is installable as a Progressive Web App. Compatible browsers can offer **Install** from the game’s app settings; iPhone uses the Home Screen instructions above. The manifest includes car collection, circuit collection and guide shortcuts. After the small reconnect screen has been stored on an online visit, an offline launch shows **Reconnect. Then race.** with Retry and Race HQ actions. Car models and race pages are not stored for offline play. Service-worker updates wait for existing tabs to close and never force a race reload; cache cleanup touches only this app’s reconnect cache.

Mira, Jax, Nova, Ren, Kai, Aria and Leo use the same physical simulation, with steering, braking, avoidance, passing and car-to-car contact. Three valid laps complete a race. Standings use actual progress and finish crossings; unfinished rivals continue racing after the player finishes.

After a valid lap, a short notice shows the last lap time and the next lap number. From the second completed lap, it compares that time with your previous best in the current race; the third lap is marked Final lap.

### Race your way

- **Circuit race:** eight actual car models, three laps, and Club, Sport or Pro rival pace. Opponents use the same driving simulation and must reach every checkpoint; difficulty never moves a rival forward.
- **Time attack:** the same three-lap course with no opponents. Beat your own time and work toward Bronze, Silver and Gold circuit targets.
- **Three-race tour:** one car, one difficulty and three different circuits. The first round starts at your chosen venue. Each real finish earns ordinary race credits and 25/18/15/12/10/8/6/4 tour points by finishing position. Persistent standings track all eight drivers and keep the same rival cars between rounds. Only actual finishes earn points. When you explicitly leave results or continue, unfinished rivals become DNF with zero points and no invented finish time. Equal points use wins; equal wins remain tied. There is no separate cash bonus or multiplayer championship.

Medal targets are game challenges derived from the playable layout and the selected car’s base tuning, not real-world venue records. Upgrades can help reach them. Records are kept separately by car, circuit, mode and difficulty. Tours require working browser storage so the next circuit can restore the same car and earned rounds. Your tour resumes from this browser; choosing a different car, circuit or difficulty offers Continue tour or Start new tour before replacing unfinished progress. The next tour round keeps the selected car and difficulty.

Opponent fields rotate through the branded catalogue. Seven different reduced-detail bodies are selected before loading, excluding the player’s current car and preferring varied manufacturers. Mobile fields stay within 650,000 model triangles and 12 MB of GLB data; desktop fields stay within 900,000 triangles and 18 MB. Loading failures can reuse an already prepared manufacturer model, with the correct matching physics.

### Manufacturer models

These 33 artist-made representations span 16 brands and retain their credited identities. Ratings below describe the game, not real-world performance.

| Car | Model type | Base speed rating | Base nitro |
| --- | --- | ---: | ---: |
| McLaren 570S Coupé | Mid-engine sports car | 175 km/h | 3.4 sec |
| McLaren Senna | Track-focused hypercar | 185 km/h | 3.6 sec |
| McLaren P1 GTR | Track-only hypercar | 184 km/h | 3.7 sec |
| Ferrari 458 Spider | Mid-engine open-top sports car | 173 km/h | 3.3 sec |
| Lamborghini Aventador | V12 supercar | 180 km/h | 3.6 sec |
| Koenigsegg One:1 | Track-focused megacar | 187 km/h | 3.9 sec |
| Pagani Zonda C12 | V12 supercar | 176 km/h | 3.4 sec |
| Bugatti Veyron | W16 hypercar | 187 km/h | 3.9 sec |
| Maserati GranTurismo MC Stradale | Track-focused grand tourer | 171 km/h | 3.6 sec |
| Lotus Elise | Lightweight sports car | 164 km/h | 3.0 sec |
| Audi R8 Custom | Sports car with custom body kit | 173 km/h | 3.4 sec |
| Rimac Concept One | Electric hypercar | 180 km/h | 3.7 sec |
| Porsche 911 (930) Turbo | 1975 classic sports car | 166 km/h | 3.1 sec |
| GMA T.50 Custom | Artist’s T.50 track interpretation | 180 km/h | 3.4 sec |
| Aston Martin One-77 | V12 grand tourer | 176 km/h | 3.6 sec |
| Rimac Nevera | Electric hypercar | 185 km/h | 3.8 sec |
| Porsche 911 GT3 | Track-focused sports car | 175 km/h | 3.3 sec |
| Lamborghini Gallardo 2004 | V10 supercar | 175 km/h | 3.4 sec |
| Lamborghini Huracán | V10 supercar | 180 km/h | 3.6 sec |
| BMW i8 | Hybrid sports car | 169 km/h | 3.5 sec |
| BMW F22 Eurofighter | Custom widebody drift car | 173 km/h | 3.4 sec |
| Audi R8 LMS GT3 | GT3 racing car | 178 km/h | 3.5 sec |
| Audi R18 | Endurance racing prototype | 185 km/h | 3.8 sec |
| Ferrari 250 GTO | Classic GT racing car | 167 km/h | 3.2 sec |
| Ferrari Testarossa | Classic flat-12 sports car | 171 km/h | 3.4 sec |
| Mercedes-AMG GT | V8 sports car | 176 km/h | 3.5 sec |
| Nissan GT-R 2018 | Twin-turbo sports car | 178 km/h | 3.6 sec |
| McLaren 650S GT3 | GT3 racing car | 178 km/h | 3.5 sec |
| BMW M3 E46 Coupé | Straight-six sports coupe | 169 km/h | 3.3 sec |
| Audi Quattro Rally | Classic rally car | 167 km/h | 3.2 sec |
| Lamborghini Countach LP500S | Classic V12 supercar | 173 km/h | 3.5 sec |
| Ferrari Enzo | V12 hypercar | 184 km/h | 3.7 sec |
| Porsche 919 Hybrid | 2017 endurance racing prototype | 185 km/h | 3.8 sec |

Search the collection by car, manufacturer or style. Accents, spaces and punctuation do not need to match exactly: “Huracan” finds Huracán and “GTR” finds GT-R. Filter by manufacturer or favourites, sort by latest arrivals, speed, handling or name, and use Clear filters to reset the view. Compare with your car shows top speed, acceleration, handling and Nitro differences, including each car’s saved upgrades and selected setup.

### Circuits

| Original circuit | Arcade lap | Character |
| --- | ---: | --- |
| Harbor Flow | 1.22 km | Waterfront sweepers and an inland section |
| Dockyard Technical | 1.53 km | Tight turns and precise braking |
| Coast Run | 1.13 km | Open curves and longer nitro opportunities |
| Summit Switchback | 1.66 km | Technical asphalt through rocky pine-lined switchbacks |
| Bay Grand Prix | 1.53 km | Wide permanent circuit, long pit straight and flowing chicanes |
| Breakwater Run | 2.09 km | A long sea-wall straight, sweeping headlands and an inland S-bend beside basalt outcrops and a working lighthouse. |
| Copper Canyon | 2.36 km | Carry speed between sandstone mesas, then brake for a broad canyon hairpin and a linked pair of technical turns. |
| Cedar Ridge | 2.41 km | Find a rhythm through cedar-lined bends, open the throttle on the forest straight, and sweep past timber lodges under the ridgeline. |
| Neon Freight | 2.26 km | A floodlit freight district with a long loading-yard straight, generous ninety-degree turns and a fast return past container stacks. |
| Fuji Skyline | 3.00 km | Lake road, mountain climbs, elevated viaduct and two launch ramps. |
| Singapore Afterdark | 2.68 km | Marina straights, city expressway and solid work-zone barriers. |
| Norway Fjord Run | 2.14 km | High fjord bridge, forested climbing bends and an optional ramp. |
| San Francisco Hills | 2.50 km | Terraced city roads, two ramps and waterfront roadworks. |

The 38-course collection combines thirteen original Camber Reign circuits, compact adaptations of all 23 venues on the official 2026 calendar checked on 1 October 2026, and Sakhir and Jeddah as original-calendar bonuses. The Grand Prix adaptations have shorter laps, widened turns and flattened elevation. Fuji Skyline, Singapore Afterdark, Norway Fjord Run and San Francisco Hills are separate original destinations with physical climbs, descents and optional ramps. Suzuka is explicitly unrolled into a non-crossing course; its real overpass is not reproduced.

| Grand Prix venue | Category | Arcade lap | Official venue length |
| --- | --- | ---: | ---: |
| [Albert Park](https://www.formula1.com/en/racing/2026/australia) | 2026 round 1 | 2.50 km | 5.278 km |
| [Shanghai](https://www.formula1.com/en/racing/2026/china) | 2026 round 2 | 2.51 km | 5.451 km |
| [Suzuka](https://www.formula1.com/en/racing/2026/japan) | 2026 round 3 | 2.49 km | 5.807 km |
| [Miami](https://www.formula1.com/en/racing/2026/miami) | 2026 round 4 | 2.39 km | 5.412 km |
| [Gilles Villeneuve](https://www.formula1.com/en/racing/2026/canada) | 2026 round 5 | 2.47 km | 4.361 km |
| [Monaco](https://www.formula1.com/en/racing/2026/monaco) | 2026 round 6 | 2.13 km | 3.337 km |
| [Barcelona-Catalunya](https://www.formula1.com/en/racing/2026/barcelona-catalunya) | 2026 round 7 | 2.38 km | 4.657 km |
| [Red Bull Ring](https://www.formula1.com/en/racing/2026/austria) | 2026 round 8 | 2.50 km | 4.326 km |
| [Silverstone](https://www.formula1.com/en/racing/2026/great-britain) | 2026 round 9 | 2.40 km | 5.891 km |
| [Spa-Francorchamps](https://www.formula1.com/en/racing/2026/belgium) | 2026 round 10 | 2.84 km | 7.004 km |
| [Hungaroring](https://www.formula1.com/en/racing/2026/hungary) | 2026 round 11 | 2.36 km | 4.381 km |
| [Zandvoort](https://www.formula1.com/en/racing/2026/netherlands) | 2026 round 12 | 2.35 km | 4.259 km |
| [Monza](https://www.formula1.com/en/racing/2026/italy) | 2026 round 13 | 2.58 km | 5.793 km |
| [Madring](https://www.formula1.com/en/racing/2026/spain) | 2026 round 14 | 2.55 km | 5.414 km |
| [Baku City](https://www.formula1.com/en/racing/2026/azerbaijan) | 2026 round 15 | 2.46 km | 6.003 km |
| [Sepang](https://www.formula1.com/en/racing/2026/bahrain) | 2026 round 16 | 2.46 km | 5.543 km |
| [Marina Bay](https://www.formula1.com/en/racing/2026/singapore) | 2026 round 17 | 2.37 km | 4.927 km |
| [Circuit of the Americas](https://www.formula1.com/en/racing/2026/united-states) | 2026 round 18 | 2.29 km | 5.513 km |
| [Hermanos Rodríguez](https://www.formula1.com/en/racing/2026/mexico) | 2026 round 19 | 2.44 km | 4.304 km |
| [Interlagos](https://www.formula1.com/en/racing/2026/brazil) | 2026 round 20 | 2.40 km | 4.309 km |
| [Las Vegas Strip](https://www.formula1.com/en/racing/2026/las-vegas) | 2026 round 21 | 2.47 km | 6.201 km |
| [Lusail](https://www.formula1.com/en/racing/2026/qatar) | 2026 round 22 | 2.34 km | 5.419 km |
| [Yas Marina](https://www.formula1.com/en/racing/2026/united-arab-emirates) | 2026 round 23 | 2.38 km | 5.281 km |
| [Bahrain International](https://www.formula1.com/en/racing/2025/bahrain) | Original-calendar bonus | 2.36 km | 5.412 km |
| [Jeddah Corniche](https://www.formula1.com/en/racing/2025/saudi-arabia) | Original-calendar bonus | 2.61 km | 6.174 km |

Open the [circuit collection](https://camber-reign.web.app/circuits/) from Race HQ’s Circuits navigation or selected circuit name. Search by name or country, or filter by region and calendar category. Choose a route to preview it, then Select circuit to return to Race HQ. Geography and metadata are researched; the game does not reproduce every historical Formula 1 venue or claim a surveyed simulation. See [research and validation](reports/grand-prix-circuit-research.md).

Speed ratings describe arcade tuning, not real-world manufacturer specifications or a guarantee of cornering speed.

## Workshop and progression

Each car has five levels of Engine, Tyres, Nitro and Handling. Engine improves acceleration, tyres improve grip/braking, handling improves steering response, and nitro improves capacity, thrust and recharge. All four also increase the car’s base top-speed rating. The chosen upgrades are snapshotted into the actual race physics; Computer-controlled opponents remain at base tuning.

New players start with 1,200 CR. Levels cost 200, 400, 700, 1,100 and 1,600 CR. Circuit races and tour rounds pay 900/650/500/350/300/250/200/150 CR for places 1–8; a solo Time attack finish pays 350 CR. Both add `floor(driftScore / 20)`, capped at 500 bonus CR. Valid finishes pay once per race ID; incomplete or over-15-minute runs do not create rewards or records. Credits have no cash value and cannot be bought with real money.

Car/circuit choices, favourite cars, per-car paint colours and finishes, upgrades, credit balance and results save in local browser storage. Best time and drift score are separated by car, circuit, mode and difficulty. The revised driving version starts a new set of comparable records; older-version records remain stored separately until race records or site data are cleared. Circuit medals and three-race tour progress also stay on this device. Clearing race records preserves medals, tours, credits, upgrades and paint choices; clearing site data removes all local progress. Blocked storage allows session-only play and upgrades. This is a local single-player economy, not a secure competitive server leaderboard.

## Paint studio

Cars → Open garage → Paint offers ten curated colours plus Team original, with Gloss, Metallic and Satin finishes. All choices are free and cosmetic. Each build stores its own colour and finish locally; unavailable storage keeps changes for the current page session. Clearing site data removes saved choices. Paint updates supported body materials in the garage and races.

## Graphics and motion

The visual palette uses electric violet `#9246FF` as the dominant UI accent, yellow `#FFF71E` as the secondary highlight for important CTAs and key moments, near-black base `#110017`, navy panels `#021439` and white text `#FFFFFF`. Dark surfaces remain the majority of each screen. Alerts use `#FF0054`, rewards use `#FFD700`, and lime `#C3FB13` is reserved for occasional status emphasis. Vector logos retain white chrome shading with violet forms and small yellow accents; the guide, privacy and credits pages share the same hierarchy. Keep body text white on dark surfaces and button labels white on violet or dark on yellow.

The game renders thirty-three individually credited manufacturer car representations across sixteen brands. Road cars, classics, grand tourers and track-focused models retain their actual identities; Audi R8 Custom and GMA T.50 Custom remain labelled artist interpretations. The garage supports drag rotation, keyboard-accessible quarter turns, neutral studio lighting and responsive camera framing. Wheels steer and roll, brake lamps respond and nitro uses model-specific exhaust outlets. Body paint, glass, carbon and rubber use separate physical materials. Mobile and race opponents use reduced-detail geometry. Earlier fictional builds are no longer selectable; their legacy source assets and attribution notices remain in the repository.

All thirty-eight circuits have covered spectator stands with animated seated and standing crowds with varied poses, clothing and asynchronous cheering behind the barriers. Bay Grand Prix adds a larger permanent grandstand and pit complex. A full-width checkered stripe, eight numbered starting bays, branded truss gantry and three twin-lamp countdown columns mark the start/finish area.

A phase-based animated logo loader waits for models, shaders and fonts. Camera inertia, speed-dependent field of view, drift smoke, road spray and skid marks respond to gameplay. Hard collisions emit directional sparks, road grit and dust from the actual contact point, with short tyre scuffs along the distance travelled. A 320 ms directional camera impulse and a brief edge cue make the impact readable without covering the controls. These consume real impact event IDs, including a hit that has already stopped the car; they do not move the vehicle or award progress. Mobile crash pools cap at 36 sparks and 12 fragments, with shared dust and mark pools. SMAA smooths post-processing edges. Bloom is limited to the lobby and garage after an impact-related dark screen was reproduced with the racing bloom pass; the race keeps its normal lighting and anti-aliasing without that pass. Reduced motion removes decorative orbit, entrance animation, bank, impact particles, edge flashes and camera impulses while retaining static tyre marks, impact/recovery messages and the camera movement needed to drive.

Racing Sans One is used for display headlines, Barlow Condensed for telemetry and Manrope for readable controls/body copy. Fonts are self-hosted with OFL notices.

### Sound and lobby music

**Liquid Lines** is the lobby soundtrack: an original 168 BPM liquid drum & bass composition with syncopated drums, deep bass and bright keys. Previous lobby arrangements have been removed, and older saved soundtrack selections migrate to Liquid Lines. Music is synthesized for this game; it is not a recording taken from another racing game.

Game volume and Lobby music have separate controls. The speaker button mutes the whole game; setting Lobby music to zero leaves driving audio available. Music fades away when a race starts, and audio waits for a player gesture before unlocking. Each car has a distinct synthesized engine or electric voice, with gearing, tyre scrub and layered Nitro thrust responding to driving. These are designed game sounds, not recordings of the manufacturers’ vehicles.

## Development

Requires Node.js 22.12+ (tested on Node 24).

```sh
npm ci
npm run dev
npm test
npm run build
```

Local: http://127.0.0.1:4180/. Production output: `dist/`.

- `src/grand-prix-circuits.js`: 25 source-attributed compact venue adaptations; `scripts/prepare-grand-prix-circuits.mjs` regenerates the offline data.
- `src/nitro-system.js`, `src/track-pickups.js`: timed boost modes, actual recharge pickups and per-racer collection fairness.
- `src/air-motion.js`, `src/track-obstacles.js`, `src/mountain-circuit.js`: authored elevation, ballistic ramps, landing events and solid road hazards.
- `src/physics.js`, `src/track.js`, `src/rivals.js`: fixed-step handling, thirty-eight layouts, race opponents, nitro, checkpoints, impact severity and fair player recovery.
- `src/original-circuits.js`, `src/original-venues.js`: four additional authored routes, lighthouse/basalt/mesa/lodge/freight landmarks, safe scenery footprints and bounded instancing.
- `src/steering-pad.js`, `src/tilt-steering.js`: touch steering ownership, opt-in orientation permission, calibration and touch fallback.
- `src/progression.js`, `src/upgrades-ui.js`: bounded upgrade levels, credit economy, persistence and workshop previews.
- `src/manufacturer-car.js`, `src/vehicles.js`, `src/garage.js`: cached licensed manufacturer models, materials, animations, catalogue and inspection studio. Legacy geometry helpers remain in `src/car.js` and `src/prototype-car.js`.
- `src/main.js`: loader, race/menu lifecycle, camera, input, garage and results.
- `src/world.js`, `src/effects.js`, `src/race-feedback.js`: environment, bounded tyre/impact effects and event-based collision, lap and recovery feedback.
- `src/audio.js`, `src/driving-sound.js`, `src/lobby-music.js`: bounded synthesized driving voices, Nitro layers and the Liquid Lines lobby soundtrack.
- `src/storage.js`: validated race records with graceful storage failure.
- `src/domain-migration.js`, `src/domain-migration-ui.js`: explicit old-origin save transfer, exact sender validation, confirmation and backup/rollback.
- `legacy-host/save-transfer/`: former-origin first-party storage bridge and shared bounded transfer protocol; only this bridge stays on the old Hosting site.
- `src/race-options.js`, `src/race-career.js`: difficulty, solo/circuit/tour modes, three-lap medal targets and receipt-gated local tour history.
- `src/opponent-fleet.js`: rotating seven-car manufacturer fields with explicit geometry and download budgets.
- `src/car-atlas.js`, `src/car-atlas-view.js`, `src/car-routes.js`: searchable car collection, current-versus-preview state and individual garage links.
- `src/circuit-atlas.js`, `src/circuit-atlas-view.js`, `src/circuit-routes.js`: searchable circuit collection, route previews and individual circuit launch links.
- `src/lobby.css`: responsive Race HQ navigation, performance readouts and next-race hierarchy.
- `src/garage-screen.css`: responsive car inspection screen, upgrade/paint actions and collection rail.
- `src/mobile-viewport.css`: short landscape layouts, safe-area placement and dialogs with fixed primary actions.
- `src/screen-mode.js`, `src/screen-mode.css`: fullscreen capability checks and iPhone Home Screen instructions.
- `src/pwa.js`, `public/sw.js`, `public/offline.html`: explicit browser installation, a small offline reconnect screen and conservative worker updates.
- `src/render-quality.js`, `src/frame-budget.js`: graphics presets and mobile rendering/visibility budgets.
- `src/nitro-hud.css`: angled charge meter, yellow ready charge, blue active boost and reduced-motion presentation.
- `src/paint.js`: curated body colours, surface finishes and per-car local paint preferences.
- `src/analytics.js`: consent gate, production-host guard and sanitized event allowlist.

## Privacy and services

No player account, name or email is required. GA4 `G-RC925EV263` loads through dedicated GTM `GTM-PZHDLVK8` only after analytics consent on the production hostname. Advertising consent stays denied. Query strings and page fragments are excluded from analytics page locations. Users can revoke consent in Privacy. The allowlist also supports loading, driving-school, upgrade and result-action funnels plus bounded occasional rendering summaries, using only known choices and numeric counters. Raw controls, sensors, saves, files and challenge URLs are excluded. [Event contract and GTM integration](docs/analytics-events.md). AdSense metadata and ads.txt support the review request; no advertising script or ad unit is active. See the live privacy notice for details.

Google/Bing verification tags, robots.txt, sitemap.xml and crawlable guide/privacy/credits pages are included. VideoGame, FAQPage and HowTo JSON-LD describe visible facts. Structured data does not guarantee rankings, rich results or AI citations.

The 2 October account review verified GTM version 3 live for the new hostname, the renamed GA4 property and web stream with the new website URL, and Search Console’s accepted old-to-new Change of Address. AdSense review is requested and remains **Getting ready**; its dashboard still says **ads.txt Not found** although the live file returns HTTP 200. Search Console’s submitted sitemap still says **Couldn’t fetch** with zero discovered URLs, while a fresh live inspection successfully fetched it and reported crawling and indexing allowed. Bing ownership is verified and the submitted sitemap is **Processing**, with zero errors and zero discovered URLs. These states do not establish AdSense approval or search indexing. Current evidence and remaining checks are in [the mobile and services receipt](reports/mobile-and-services-release-2026-10-02.md); [the original release audit](reports/camber-reign-release-audit-2026-10-02.md) preserves the earlier snapshot.

## Credits and validation

Original game code, thirteen original tracks, branding and racing adaptations: AppsOverFlow. Manufacturer model sources and authors are credited individually. Retained legacy Formula and GT assets keep their Qvist_designs and vicent091036 / Three.js attribution under CC BY 4.0. Full source URLs, adaptation notes and licences: `public/credits/` and `public/assets/cars/`. Grand Prix outline data: Tomislav Bacinger, MIT; compact arcade modifications by AppsOverFlow, including a non-crossing Suzuka reinterpretation. Three.js is MIT. No manufacturer or motorsport affiliation is implied.

The automated suite covers driving, lap guards, rivals, all circuits, nitro, upgrades, payments, storage and analytics privacy. The earlier 36-car/34-circuit update, crash/recovery checks and physical-device limitations are documented in `reports/manufacturer-circuits-controls-release.md`. Earlier expansion checks and review limits are documented in `reports/expansion-release.md`; `reports/release-checks.md` preserves the earlier release evidence. Phone viewport emulation does not establish performance on every physical phone.

The standard deployment targets Firebase Hosting site `camber-reign` in project `echo-heist`. The separate `firebase.legacy.json` configuration maintains redirects and the explicit save-transfer bridge on the former `blacktop-bay` site; it does not redeploy the game there. Keep these redirects available for existing players and search engines. No unrelated shared-project sites are included.

## Manufacturer collection and expressive crowd

The garage now includes McLaren 570S Coupé, McLaren Senna, McLaren P1 GTR, Ferrari 458 Spider, Lamborghini Aventador, Koenigsegg One:1, Pagani Zonda C12, Bugatti Veyron, Maserati GranTurismo MC Stradale, Lotus Elise, Audi R8 Custom, Rimac Concept One, Porsche 911 (930) Turbo, GMA T.50 Custom, Aston Martin One-77, Rimac Nevera, Porsche 911 GT3, Lamborghini Gallardo 2004, Lamborghini Huracán, BMW i8, BMW F22 Eurofighter, Audi R8 LMS GT3, Audi R18, Ferrari 250 GTO, Ferrari Testarossa, Mercedes-AMG GT, Nissan GT-R 2018, McLaren 650S GT3, BMW M3 E46 Coupé, Audi Quattro Rally, Lamborghini Countach LP500S, Ferrari Enzo, Porsche 919 Hybrid. Names match the credited model geometry. Road cars and classics are labelled honestly; all performance figures, Nitro and upgrades are arcade tuning rather than manufacturer claims. Source details and modifications are recorded in public/assets/cars/manufacturers/manifest.json and the public credits page.

Manufacturer GLBs load on selection, with high/mobile variants, a two-transfer queue and a reference-counted cache retaining at most two unused templates. Car selection keeps the previous playable car until the new model succeeds. Every instance owns paint/brake materials; immutable geometry/textures are shared until unused-cache eviction. Static portraits prevent the car browser from downloading the full garage.

Spectators use ten instanced batches, varied appearance, seated/standing poses, asynchronous gestures and nearby-car reactions. Animation respects pause and reduced motion and has mobile distance/rate limits. They are original game geometry, not photoreal scans.

Offline preparation: scripts/prepare-manufacturer-assets.mjs (pinned tool dependencies are documented in its header). Local visual fixtures under reports/ are excluded from the production build. Never replace source bodywork with a generic renamed mesh or include game-ripped assets with contradictory uploader permissions.
