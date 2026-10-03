# Campaign, car setups and mastery

Camber Reign's driver campaign contains **18 authored events across six chapters**. Each event uses a real selectable circuit and an existing race mode: eight-car Circuit race or solo Time attack. Campaign is not a fourth race mode. Completing an event's first objective unlocks the next event. Two optional objectives can be earned on repeat visits. Existing cars, credits, upgrades, tours and circuit records remain available.

The original twelve events and their earned objectives are unchanged. Two advanced chapters add Perfect Nitro, Burst Nitro, pickups, clean overtakes and clean-sector objectives. These use `race.objectiveStats` from the driving simulation; missing, negative, fractional or excessive counters never earn a goal. Clean overtakes require a moving rival pass, a clean preceding window and a confirmation period after the pass. Clean sectors require consecutive validated checkpoints without contact or recovery. The chapters otherwise progress from complete coastal runs to placement goals, car-specific medal targets and Pro fields. The time targets are the same published, stock-car game benchmarks used by circuit medals, not real-world track records. Lap-consistency objectives require all three actual lap times and a matching elapsed total. “Without a reset” means no manual or automatic recovery; it does not claim the run had no contact.

## Setups affect driving

All four setups are available without payment. Choices have a per-car default plus optional per-car, per-circuit overrides. The setup screen clearly chooses the save scope and can remove the current circuit override with Use car default here. Existing version-one per-car choices migrate without losing any saved tuning. The effective setup applies to upgraded stats when a new race is created. Existing upgrades are not replaced. Factory balance leaves the baseline stats exactly unchanged.

| Setup | Advantage | Trade-off |
| --- | --- | --- |
| Factory balance | Original all-round tune | No specialised advantage |
| Corner grip | Grip +10%; braking +6%; handling and steering response +4% | Top speed −4%; acceleration −2% |
| Straight-line | Top speed +4.5%; acceleration +4% | Grip −7%; braking −6%; handling −3% |
| Nitro reserve | Nitro capacity and recharge +12% | Boost force −6%; acceleration −4%; top speed −2% |

Top-speed figures are theoretical unboosted limits; driving conditions affect actual speed. Nitro capacity is shown in seconds at normal drain. Perfect Nitro and Burst change how long that charge lasts. Rivals keep the balanced setup. Setup is snapshotted at race creation and preserved through the start/reset transition.

## Mastery is earned, not purchased

Each car tracks five goals: one completed run; finishes on three different circuits; three race podiums or solo gold finishes; 2,500 banked drift points; and three runs without a reset. Mastery changes the visible accomplishment tier. It does not add hidden performance or currency. A solo finish is not automatically treated as a podium.

Campaign and mastery consume the existing progression module's successful finish receipt. They do not mint credits, accept incomplete races or record the same race twice. They store bounded local data under separate keys, preserving existing progression schemas:

- `camber-reign-campaign-v1`
- `camber-reign-mastery-v1`
- `camber-reign-setups-v1`

These are local game records, not server-verified competition data. Storage failures return `false`; the interface must explain session-only progress. Earlier races are not retroactively assigned campaign goals or mastery.

## Integration contract

`driver-campaign.js` exports the authored chapters/events, normalization and storage helpers, `getCampaignEvent(id, vehicle)`, `getNextCampaignEvent(state, vehicle)`, `canStartCampaignEvent(state, id)` and `recordCampaignResult(state, race, receipt)`. Bind the returned `campaignEventId`, track, mode and difficulty when launching an event. The reducer rejects mismatched or locked events.

`car-setups.js` exports `getCarSetup(state, vehicle, track = null)` (an ID), `selectCarSetup(state, vehicle, id, track = null)` (a pure `{ state, selected, setup, track }` result), `clearCircuitSetup(state, vehicle, track)`, and `applyCarSetup(baseSpecs, id)`. `physics.js` accepts setup as the third `getUpgradeStats` parameter and as a `createRace` option. Do not apply the same setup twice.

At finish, use the same `awardRaceCredits` receipt for `recordCampaignResult` and `recordMasteryResult`, then persist each returned state. The reducers are independent of each other and the existing tour/medal reducer. Run them only against the race snapshot, not current menu preferences.

`driver-development-ui.js` exports:

- `mountCampaignPanel(container, { state, vehicle, onStart(event) })`
- `mountCarDevelopment(container, { vehicle, track, baseSpecs, setupState, masteryState, onSelect(id, {track, scope}), onClearCircuit(track) })`
- `developmentResultMarkup(campaignResult, masteryResult, { campaignSaved, masterySaved })`
- `nextGoalSuggestion({campaign, mastery, vehicle})` returns a specific campaign objective or the remaining amount for a mastery goal, with no automatic launch.

Mount helpers return `update(partialOptions)` and `destroy()`. They dispatch intent only. Callers own persistence, launch confirmation, race creation, the shared dialog's focus trap and closing. Setup changes should refresh the view with the new state. Supply **balanced, already-upgraded** `baseSpecs` to the setup view so it applies the selected setup once. Import `driver-development.css`; use shared-dialog kinds `campaign` and `car-development` for its scoped width and scrolling rules.

## Verification

`tests/driver-development.test.js` covers bounded setup trade-offs across all cars at stock and maximum upgrades, complete campaign progression, invalid or mismatched finishes, duplicate receipts/reloads, timing consistency, solo mastery, storage failures, view listener reuse and a physics-driven three-lap finish through the actual credit gate. That simulated fixture is not a substitute for the release browser checks on desktop and mobile.


## Live menu connections

The lobby's **Career** button opens the campaign. The bottom-navigation Tour button selects the three-race tour; its settings retain saved-tour continuation. The garage's **Upgrades → Setup & mastery** view changes the selected car's setup, refreshes its displayed numbers and saves the choice. Race rewards feed both progression reducers, and results list newly earned objectives and mastery goals.

Cross-circuit campaign selection uses a single-use session-storage intent with a 30-minute expiry. The destination must match the authored circuit and the event must still be unlocked. The arriving page shows the selected event for review; it never starts the race automatically. A failed storage write keeps the current selection in place. Free-race mode selection clears the active campaign context without erasing campaign progress.


## Persistent tour standings

The three-race tour keeps rival identities and their chosen cars. `bindChampionshipFleet(state, vehicles)` binds the first loaded field; `nextChampionshipRace(state)` returns that same `rivalVehicles` order for later rounds. Each round stores actual finish classifications and the normal 25/18/15/12/10/8/6/4 points. `refreshChampionshipRound(state, race)` records rivals that finish while the results remain open. It never pays a second reward.

The results show Racing for pending rivals and Provisional for incomplete standings. The player's explicit continuation or departure finalizes unfinished rivals as DNF with zero points and no invented finish time, through `finalizeChampionshipRound(state, race)`. Finalized DNF results cannot later become finishes. At boot, `finalizeInterruptedTourRounds(state)` closes persisted Pending rows as DNF because the prior results-screen simulation cannot resume after reload or closure. It covers both the active and most recently completed tour, leaves confirmed times and points intact, and returns `{state, changed, classified}` for verified persistence. Call this only during boot, never while current rivals are still racing. Equal points use wins; equal points and wins remain tied. Legacy tours retain their real player points, but unavailable historical rival results remain Not recorded rather than being fabricated.

`getChampionshipStandings(tour)` returns `{rows, provisional, complete}`; `championshipStandingsMarkup(tour)` renders the table. The three-race points do not create a cash bonus or a multiplayer leaderboard.

## Portable progress

Save backup files provide manual transfer between browsers or devices without accounts or sign-in. They include preferences and controls, credits and upgrades, paint, favorites, campaign, mastery, per-circuit setups, tour/career history, driving-school progress, race records and valid replay frames. Analytics consent and authentication data are excluded and remain unchanged when a file is imported. See [the save backup contract](save-backups.md).

Targeted coverage includes legacy setup migration, all 18 campaign events, invalid objective counters, actual/pending/DNF tour results, reload persistence, strict backup validation, quota failures, complete rollback and recovery after an interrupted import. Automated simulations and storage adapters do not replace browser layout, interaction or physical-device validation.
