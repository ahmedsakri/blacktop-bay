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

On 2 October 2026, the authenticated Camber Reign container was inspected and its unchanged default workspace exported for comparison. Live version 3, “Camber Reign domain migration”, forwarded only the original ten custom events. The new application events were therefore not yet forwarded by that live event trigger.

A scoped draft is now prepared in **Default Workspace** for `GTM-PZHDLVK8`: exactly **two modified items, nine added variables and no deletions**. The approved racing-event trigger contains an anchored union of the original ten event names and all nine added names in the table. The existing GA4 event tag maps `stage`, `step`, `component`, `level`, `action`, `p75_frame_ms`, `quality_level`, `draw_calls` and `triangles` through matching version-two Data Layer Variables. Bounds and event-specific field validation remain enforced by `src/analytics.js`; GTM does not independently validate those numeric ranges.

The saved draft was reviewed in the GTM interface: the production-host filter remains `camber-reign.web.app`, the event tag still requires `analytics_storage`, the Google tag and measurement ID remain unchanged, and all prior parameter mappings remain present. There were zero workspace changes before this import. The original container export is retained locally; no container export or account data is committed to the repository.

**Publication is pending explicit approval.** Automatic approval review rejected the final Publish action because the available user authorization did not explicitly cover this exact production configuration. The draft has not been published and no new live container version is claimed. After approval, publish the reviewed scoped draft and verify the public `gtm.js` event union and nine mappings. Live GA4 ingestion remains a separate check; application tests and saved GTM configuration alone do not prove receipt in Analytics.

## Verification

`tests/analytics.test.js` uses browser adapters that record script insertion without fetching Google. It covers the existing consent lifecycle and adds event-specific enum/numeric bounds, cross-event field exclusion, stale-value resets, data minimization, local-host suppression and denied/unset consent. Passing these tests verifies the application boundary; it is not a live GA4 ingestion or GTM publication result.
