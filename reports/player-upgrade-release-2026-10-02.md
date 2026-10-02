# Player upgrade release review — 2 October 2026

## Release status

Released to **https://camber-reign.web.app/** on 2 October 2026 from application/test commit **fd0489a** (mobile source changes in **6ba2909**). Firebase’s normal predeploy gate completed **887/887 tests**, with zero failures, cancellations or skips, in **321.12 seconds**, followed by a successful production build. Firebase reported **release complete** and **Deploy complete**. Code is pushed to GitHub `main`.

The optional analytics application changes are implemented. The corresponding Google Tag Manager draft is saved and reviewed, but **publication is pending explicit user approval** after automatic approval review rejected the final Publish action. No new live GTM version or live GA4 receipt is claimed. See [analytics configuration and consent boundaries](../docs/analytics-events.md).

## Implemented player features

### Learning, controls and comfort

- Optional driving school introduces the existing steering, braking, drift, pickup and Nitro interactions using actual race state. Lessons can be skipped; practice results do not award race credits or unlock campaign progress.
- Keyboard bindings are configurable, with normalized conflicts and compatible default aliases. Help and race hints show the active bindings. Inputs and latched Nitro clear on pause, focus loss and navigation.
- Touch controls support mirrored steering/Nitro placement, adjustable control size, inward spacing and height. Nitro supports hold or tap-on/tap-off input. Perfect Nitro requires starting Nitro, releasing, then pressing again in its timing window; it is not awarded merely by releasing.
- Stable chase camera, device-preference/reduced/full motion choices and a mobile 30 FPS battery-saver option provide explicit comfort controls. These settings are persisted and included in portable backups.
- The iPad follow-up replaces mouse-only contact assumptions with a shared pointer/touch adapter for the steering pad, race canvas and driving buttons. Touch/pen contacts do not depend on `button === 0` or primary-pointer status. An active, non-passive touch fallback works even when a hybrid browser exposes Pointer Events but delivers only Touch Events for a gesture. Duplicate event streams are suppressed, separate fingers can steer and hold Nitro, and window-level movement/release survives failed pointer capture.
- Driving surfaces prevent long-press selection/callouts through touch handling and scoped interaction styling. Pause, orientation changes, focus loss and hidden pages clear both the adapter contact maps and driving state; stale moves cannot resume an old turn or boost. Fresh contacts work after resuming. These are verified event-path corrections; the reported symptom has not been reproduced or confirmed resolved on the user's physical iPad by this task.

### Personal racing and results

- Time Attack can show the player's compatible personal-best ghost, with interpolated movement and timing deltas. Records are scoped by circuit, car, mode, fitted upgrades/setup and handling version; solo records do not split solely by an irrelevant rival difficulty setting.
- Stock Time Attack uses a stock, balanced race build while preserving the actual garage build. Validated challenge links identify the circuit, car, target time and supported handling rules. They are local comparison invitations, not authenticated competitive records.
- Results provide a locally generated downloadable share card and challenge-link actions. Returning from sharing restores the existing result without paying its reward again. Pending rivals continue to be described honestly while their race completes.

### Campaign, garage and save ownership

- The campaign now has **18 authored events across six chapters**, preserving the original progression. New objectives use recorded Perfect/Burst Nitro activations, pickups, clean overtakes and clean sectors. The first objective unlocks the next event; the other objectives are optional repeat challenges.
- Per-car mastery and next-goal suggestions provide additional direction without hidden performance bonuses. Car setup can have a per-circuit override, with a return to the saved car default.
- Three-race tours keep the same rival identities and selected cars across rounds. Standings use actual finish classifications and points. Unfinished rivals remain pending until explicitly finalized as DNF; missing historical results are not fabricated. Refreshing results does not pay another reward.
- Portable save files include game preferences/controls, progression/upgrades, paint, favourites, career/tours, campaign, mastery, setups, school progress and valid records/replays. Import validates the entire file, previews replacement and requires confirmation. Verified writes, rollback and a durable recovery journal protect interrupted imports. Analytics consent and authentication data are excluded. There is no account or cloud-save service. See [save backup contract](../docs/save-backups.md) and [driver development](../docs/driver-development.md).

## Driving, competitors and sound

- Cars have restrained differences in traction, braking, steering and weight response derived from the authored game characteristics. Automatic acceleration and accessible arcade steering remain in place. These are bounded gameplay values, not measured real-car engineering data.
- Continuous contact capsules now use the visible model's width and length, with height separation and bounded mass response. Wall, obstacle and recovery checks account for body size. Cars are no longer all represented by an equal contact capsule.
- Opponent selection considers the player's effective fitted performance while retaining seeded variety and the existing mobile fleet ceilings of 650,000 triangles and 12 MB. Opponents remain actual stock cars; matching does not introduce hidden upgrades or runtime rubber-banding.
- Patient, precise and opportunistic rival tendencies make modest changes to positioning and corner behaviour. Nitro decisions favour useful straights with reserve and cooldown limits.
- Procedural engine response follows the effective build. Tyre noise follows a smooth slip envelope, Nitro transitions are less abrupt, low frequencies are bounded, and rival audio has restrained combined gain and stereo placement. Existing separate sound controls remain available. These are refinements to original procedural synthesis, **not recordings of the named manufacturers' engines**. No unverified or newly downloaded engine samples were introduced.

## Rendering and authored venues

- All 33 licensed manufacturer cars have separately prepared distance assets, retaining source attribution and a modification notice. Across the catalogue, these assets reduce triangles by **68.3%** and delivery bytes by **66.5%** relative to the existing low-detail sources. These totals describe asset preparation, not a claim that all cars download together.
- Distance changes use hysteresis and keep the current model visible if a background load fails. Model preparation is bounded to two concurrent requests with prioritization and deduplication. Cache residency figures are estimates, not direct GPU-memory measurements.
- Automatic graphics quality responds to sustained observed frame intervals with conservative recovery. The mobile follow-up starts with a sharper standard 1.6× density, bounded by device density and viewport pixel budgets; optional device hints select conservative constrained/standard/capable starting profiles. Under sustained pressure, mobile quality reduces shadows and distant detail before reducing resolution, with a one-CSS-pixel density floor. Missing hardware hints do not imply high-end capability. Manual selection remains authoritative; intentional low refresh limits, hidden tabs and loading should not drive adaptive reductions. Static scenery uses selective spatial batches and real distance culling within established destination budgets.
- High detail selects actual high-detail car and world source geometry on touch devices. Changing sharpness/passes applies immediately; a change to already-loaded source geometry shows an explicit reload notice that explains unfinished-run loss. The Reload Graphics action retries saving preferences first. If persistence fails, it keeps the current run and displays a clear failure message instead of reloading with an unsaved choice.
- Harbor Flow, Fuji Skyline and San Francisco Hills have original authored landmark groups, signs, terraces and sector surface variation. Existing characteristic scenery remains. New scenery stays outside the driving corridor; pause/reduced-motion behaviour includes water and boats.
- Distance assets retain ordinary decoded GPU textures; KTX2/Basis GPU compression is not implemented. The detailed geometry, placement, queue and culling evidence is recorded in [the rendering report](rendering-upgrade-2026-10-02.md).

## Verified browser evidence

These observations were supplied by the integration task from the actual game in a desktop browser. Responsive viewport emulation is not a physical-phone test. The completed race used synthetic control input through the browser; it was not human play or a standalone physics fixture.

| Check | Observed result |
| --- | --- |
| Representative layouts | Reviewed at 1280×800, 390×844, 320×700, 844×390 and 568×320. |
| Campaign and setup | The integrated interface showed 18 events across six chapters and circuit-scoped car setup. |
| Save backup round trip | Download and import preserved the original 800 credits, selected car and circuit. The original local-port-4180 backup was restored to 800 credits, Maserati, San Francisco and zero circuit-scoped setups. |
| Actual race completion | Three-lap Harbor stock Time Attack completed in **142.975 seconds**, with **zero resets**, a personal best and a **351-credit** reward; balance became **1,151 credits**. |
| Share card | Share Result → Download Card produced an actual **1200×630 PNG**. |
| Return from sharing | Escape returned to the existing result. The balance stayed **1,151**, with no duplicate reward. |
| Personal-best replay | Run Again showed the personal-best ghost as visible and a PB delta. |
| Authored landmarks | Harbor, San Francisco and Fuji landmarks were viewed in the actual renderer. The corrective roof and clock alignment browser recheck passed, with no new rendering errors after the fix. |
| Distance car | Ferrari 458 changed from **199,681** near triangles to **58,974** distance triangles; the browser view visibly retained its silhouette. |

## Automated evidence and remaining gates

Targeted suites passed during implementation for control remapping and Nitro latch lifecycle; ghost scope/challenge/interpolation; school completion and skip; battery-saver cadence; car dynamics/contact/recovery; race-objective counters; audio envelopes/mix limits; performance-matched fleet selection; campaign/setup/tour reducers; backup validation/recovery; rendering assets/placement/lifecycle; and consent-gated analytics. See the adjacent subsystem documents for their narrower evidence and limits.

The driving task's earlier 281-test run included all **192 physics tests**, including **330 simulated races** covering all 33 cars across five original circuits at stock and maximum upgrades. All physics cases passed. That run had one fleet-variety assertion failure; the selection spread was corrected and the targeted fleet suite then passed. It must not be described as a wholly passing full-suite run. A later focused collision, recovery, elevated-circuit and objectives group passed **92/92**. These automated simulations are distinct from the browser race above.

Five focused modal/navigation regressions cover countdown → pause → backup → back/resume; school-result Escape; share-result Escape without reward duplication; import navigation to the restored circuit; and stock trial isolation from the actual garage build. The associated targeted lifecycle/navigation group passed **18/18**. These tests exercise extracted integration functions with inert UI/rendering endpoints, not full browser flows.

The rendering task reported a production build passing. The final corrective rendering group passed **31 focused tests**, and the integration browser recheck of the roof and clock passed without new rendering errors. The final full integrated result is recorded in Release status above. The first predeploy attempt passed 881/886 checks but found five outdated tour test-harness dependencies; the harness now executes the actual finalization/persistence functions, and an additional finished-round transaction regression passed before the clean full rerun. Production code was not weakened to satisfy the tests.

### Latest mobile follow-up verification

The latest focused run passed **80/80 tests**: **65** across driving contact, steering pad, drag steering, driving controls, player controls, lobby navigation/settings, modal lifecycle and loading; plus **15** across render quality, adaptive quality and screen-mode/frame budgeting. These counts overlap the earlier targeted groups and must not be added together as independent full-suite coverage. `git diff --check` also passed.

The input checks include touch/pen `button: -1`, a non-primary second finger, TouchEvent fallback on a hybrid device, simultaneous Nitro and steering through both event paths, duplicate pointer/touch delivery, multiple Nitro contacts, failed capture, long-touch synthetic mouse suppression and contact cancellation. One regression executes the actual main `syncInput`/`clearInput` functions against real adapters, ownership stores and Nitro latch: pause empties captures and maps, stale movement stays inactive, and the same IDs can begin fresh contacts after resume.

Quality checks cover phone and tablet dimensions in both orientations, optional/malformed capability hints, bounded resolution, pressure/recovery transitions, manual quality and genuine high-detail geometry selection. Settings regressions execute the actual integration with imported geometry helpers; they verify the reload explanation, no automatic reload, failure-safe save handling and a successful later retry. They do not establish appearance or performance on physical hardware. The final browser and deployment checks are recorded below.

### Final browser and live verification

- At **1366×1024**, simulated tablet touch capability displayed the full HUD, steering pad and Nitro button without horizontal overflow. Pointer events using `button: -1` and a non-primary second finger produced steering and Nitro simultaneously; releasing steering kept Nitro active until its own release. TouchEvent-only fallback also steered and boosted simultaneously. Pause cleared both inputs.
- Holding controls produced no selected page text; the control context menu was prevented. Driving surfaces computed `user-select: none` and `-webkit-touch-callout: none`. Selectable settings/input content remains available outside those driving surfaces.
- Manual High detail was checked against the renderer’s actual loaded geometry flags, with both world and car low-detail flags false. The representative tablet screenshot is retained in the task’s `outputs/camber-reign-tablet-complete.jpg`; this is desktop-browser simulation, not an iPad photograph.
- After release, `/`, `/guide/`, `/privacy/`, `/circuits/`, `/circuits/harbor/` and `/cars/` returned HTTP 200 with Camber Reign HTML. The live JavaScript, CSS and a representative newly generated distance model matched the tested build byte-for-byte (SHA-256).
- A fresh production browser tab completed loading with **Race Now enabled**. Controls and sound opened, **Display & controller → Graphics** was visible with the updated quality explanation, and returning to the lobby worked. No browser error entries were observed during that smoke check. No production race reward or saved preference was changed.
- Build retains Vite’s existing warning for a JavaScript chunk above 500 KB; it is not a failed build. The main game entry is approximately 1.09 MB before compression.

Outstanding external validation:

- GTM publication still needs the explicit approval requested after automatic approval review rejected the final production Publish action. No public container change or GA4 delivery is claimed.
- Physical iPad control behavior and sustained phone frame rate, heat and battery usage remain unverified in this task. Responsive/event-path tests are not physical hardware evidence.

## Practical limits

- No sustained real-phone heat, battery, audio or frame-time validation is claimed. Desktop viewport checks and observed callback intervals cannot establish physical-device thermal performance, delivered FPS or GPU timing.
- Procedural sound has bounded levels and tested transitions, but no measured acoustic match to real cars or verified phone/headphone listening result is claimed.
- Save files and challenge times remain local, editable data. They are not server-verified competition results or cloud synchronization.
- Coverage is representative, not exhaustive across devices, controllers, browsers, WebGL context loss, shader drivers, storage failures or accessibility technologies. The existing large-bundle build warning remains a practical build concern.
- Review fixtures under reports are local evidence and are not part of the production game. No licensed source asset attribution is removed by this upgrade.
