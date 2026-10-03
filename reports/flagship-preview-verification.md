# Previous-pass flagship sites and actual circuit previews

This records the earlier released pass. Current environment changes and nine-map recapture evidence are tracked in [the 3 October review](environment-realism-2026-10-03.md); old six-map figures below are historical.

Final focused verification: **46/46 passing** across circuit previews, atlas behavior, lobby presentation, world lighting/profiles, track-world detail, showcase venues, destination layout/scenery and coastal foundations. No commits or deployment were performed by this workstream.

## Delivered work

- Nine original modeled flagship landmarks distributed across Fuji Skyline, San Francisco Hills and Singapore Afterdark, with actual curved roofs, petals, glazing, ribs, clocks and sculpture geometry.
- Finished Fuji/Singapore garden sites: branching trees, blossom clusters/folded fronds, curved beds, soil, rocks, paths, benches and railings.
- Supported access walks from all nine flagship decks to outer sidewalks. Decorative rails have precise 2.8 m gaps and no uprights through access points. Driving crash barriers, road layout, elevation, ramps, controls and progression are unchanged.
- Fuji's branching roadside blossoms and broken mountain snow line; SF bay houses face their detailed glazing/porches toward the road; Singapore has a curved sky-lens skyline and a dedicated night grade.
- Singapore's broad paving mixes 15% actual concrete-map variation with an 85% muted base. No new texture images, dynamic lights or shadow passes were introduced.
- All 38 circuit hero/card stills are actual runtime WebGL captures, 960×540 WebP. Image payloads total **1,777,406 bytes**. The atlas and lobby use these route-specific images.

## Geometry bounds

| Phone destination module | Draws | Triangles |
| --- | ---: | ---: |
| Fuji Skyline | 13 | 15,208 |
| San Francisco Hills | 17 | 14,934 |
| Singapore Afterdark | 7 | 6,342 |

These retain the prior destination-module limit of 20 draws / 16,000 triangles.

| Separate phone terrace/site groups | Draws before culling | Triangles excluding sign faces |
| --- | ---: | ---: |
| Fuji Skyline | 21 | 6,672 |
| San Francisco Hills | 24 | 3,184 |
| Singapore Afterdark | 22 | 8,448 |

Sites use existing local material batches and distance culling. The counts above are construction bounds for named groups, not whole-scene rendering cost or measured phone frame rate.

## Evidence and limitations

`public/assets/circuits/previews/manifest.json` records every image's track, sector, actual camera pose, dimensions, bytes, SHA-256, scene draw/triangle count and six-map GPU readback. Tests decode WebP container dimensions, verify exact hashes/byte counts, require unique captures for all 38 IDs, and enforce a catalogue size below 4 MiB.

Clearance tests measure transformed architecture footprints, inspect merged vertices against the complete road, check full access-strip footprints, preserve merged triangles, exercise distance culling/restoration and verify the actual rail triangles omit access intervals (including the lap seam). Existing grounding and surface tests continue to pass.

The root agent controlled the actual WebGL browser because browser/CDP surfaces were unavailable to this subagent. Root confirmed the three final flagship views compiled without browser errors or warnings. Final local flagship WebPs were also inspected directly; Harbor and Suzuka captures were inspected as representative non-flagship views. Images show the actual game renderer and contain no fixture UI. These are renderer checks and stills, not completed races, exhaustive screenshots of every sector or real-phone performance measurements. The scenery remains stylized authored browser-game geometry; no commercial-game parity claim is made.

The local receiver on 127.0.0.1:4198 was stopped after final recapture. This subagent created no browser tabs; root owns and closes its capture tab. The receiver and review fixtures stay outside production output.

## Release-gate correction

The full release gate caught Singapore Afterdark’s authored key-light intensity of 0.68 falling below the existing 0.8 catalogue minimum. The override now restores the metropolitan intensity of **0.84**, preserving road/car form readability while retaining the authored night palette, fog, fill and backdrop. No assertion or bound was loosened. Effective catalogue intensities now range from 0.84 to 1.48. The final focused run includes the previously omitted world-lighting suite: **52/52 passing**.

Root reviewed and recaptured Singapore at the original 960×540 camera pose, with actual sun intensity 0.84, no browser errors and WebGL error 0. The replacement is **37,774 bytes**; the full catalogue is **1,777,406 bytes**. Direct SHA-256 comparison against the prior manifest confirms all **37 other images are byte-for-byte unchanged**. The receiver now preloads and verifies existing records for safe single-track recapture; it has been stopped again. The full production gate remains root’s next step.
