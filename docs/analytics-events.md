# Optional gameplay measurement

`src/analytics.js` remains the single game measurement boundary. Google Tag Manager `GTM-PZHDLVK8` and GA4 `G-RC925EV263` are unchanged. Nothing loads or queues gameplay measurement before analytics consent, on denied storage, on local/preview hosts or after revocation. Advertising storage, advertising user data and ad personalization remain denied. The production hostname gate remains `camber-reign.web.app`.

The existing events remain available: `race_start`, `lap_complete`, `race_complete`, `race_pause`, `race_resume`, `car_reset`, `car_select`, `circuit_select`, `garage_open` and `nitro_use`.

| Added event | Allowed extra data |
| --- | --- |
| `load_ready`, `load_failure` | `stage`: `lobby` or `race`; `duration_seconds`: 0–3600 |
| `tutorial_start`, `tutorial_step`, `tutorial_complete` | Integer `step`: 0–5 |
| `upgrade_purchase` | `component`: `engine`, `tyres`, `nitro` or `handling`; integer `level`: 1–5 |
| `result_action` | `action`: `replay`, `next_round`, `next_event`, `garage`, `share` or `home` |
| `challenge_share` | `action`: `download` or `copy` |
| `performance_sample` | `p75_frame_ms`: 0–150 (rounded to a whole millisecond); integer `quality_level`: 0–3; integer `draw_calls`: 0–10000; integer `triangles`: 0–10000000 |

Common fields remain limited to known circuit, vehicle, race mode and difficulty IDs plus bounded position, duration, drift score, resets and lap numbers. Event-specific fields are admitted only for their event. Fractional discrete counters, nonfinite values, out-of-range values, free text and unrecognized enum members are discarded, not clamped into plausible telemetry.

All optional data-layer parameters are reset to `undefined` before every event, preventing GTM version-two variable merging from attaching a previous race, action, upgrade or performance reading to another event. Names, email addresses, authentication identifiers, raw keys or bindings, motion readings, file names or contents, saved history, replay frames and challenge URLs are not allowed. Page locations omit query strings and fragments; referrers are restricted to their origin.

Performance summaries are sampled by the main-loop integration; they describe frame callback/render workload observations, not hardware temperature, GPU timing or proof of delivered frame rate. The sanitizer accepts only the bounded summary fields above. It must never receive raw input or sensor streams.

## GTM configuration status

On 2 October 2026, the authenticated Camber Reign container's scoped draft was published as **live version 4**, at **18:49** in the account display. This supersedes the earlier pending-publication state. The publication contains exactly **two modified items, nine added variables and no deletions**. The racing-event trigger contains an anchored union of the original ten event names and all nine added names in the table. The existing GA4 event tag maps `stage`, `step`, `component`, `level`, `action`, `p75_frame_ms`, `quality_level`, `draw_calls` and `triangles` through matching version-two Data Layer Variables. Bounds and event-specific validation remain enforced by `src/analytics.js`.

The production-host filter remains `camber-reign.web.app`, the event tag still requires `analytics_storage`, the Google tag and measurement ID remain unchanged, and all prior parameter mappings remain present. The public `gtm.js` was independently fetched after publication: all nine new events, nine mappings, the production hostname, measurement ID and consent requirement are present. Container exports and account data are not committed.

A real production-browser smoke test temporarily enabled measurement through the privacy UI, then loaded the lobby and started a race. Google’s collection endpoint returned **HTTP 204** for batches containing `load_ready` (`stage=lobby` and `stage=race`), `race_start` and `race_pause`, with the expected circuit, vehicle and game-name values. The authenticated GA4 Realtime report subsequently showed **two `load_ready`, one `race_start` and one `race_pause`**, alongside the Camber Reign page view. Drilling into `load_ready` showed the circuit and duration parameters. This verifies both collector delivery and reporting-side receipt for those exercised events. The test restored the previous denied-consent preference through the privacy UI and confirmed the measurement-disable flag. No race was completed and no credits were awarded.

Search indexing, advertising approval and physical-phone performance are separate from this publication. The remaining new event paths are covered by the reviewed GTM mappings and application tests; this smoke test did not exercise every possible event in production.

## Verification

`tests/analytics.test.js` uses browser adapters that record script insertion without fetching Google. It covers the existing consent lifecycle and adds event-specific enum/numeric bounds, cross-event field exclusion, stale-value resets, data minimization, local-host suppression and denied/unset consent. Passing these tests verifies the application boundary; it is not a live GA4 ingestion or GTM publication result.
