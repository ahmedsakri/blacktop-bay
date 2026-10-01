# Ferrari and Audi source pack — 2026-10-01

Portable configuration: [`ferrari-audi.mjs`](../../../scripts/manufacturer-packs/ferrari-audi.mjs). Reproduction commands are in the [source-record overview](../README.md).

| Model | Creator / source | UID | High / low triangles |
| --- | --- | --- | --- |
| Audi R8 LMS GT3 · 2019 | [mrDiG](https://sketchfab.com/3d-models/audi-r8-gt3-lms-80d3f346956b43cebcab72d25ac3e81e) | `80d3f346956b43cebcab72d25ac3e81e` | 48,677 / 48,677 |
| Audi R18 | [Godheim](https://sketchfab.com/3d-models/audi-r18-3a5f4938e662429b8633120aa62805a4) | `3a5f4938e662429b8633120aa62805a4` | 43,796 / 43,796 |
| Ferrari 250 GTO · 1964 | [dagtholander](https://sketchfab.com/3d-models/1964-ferrari-250-gto-849c88c65911496d92363dc2980f6f4e) | `849c88c65911496d92363dc2980f6f4e` | 97,846 / 97,846 |
| Ferrari Testarossa | [dagtholander](https://sketchfab.com/3d-models/testarossa-7bcceae8f461476883a5b182bfb15165) | `7bcceae8f461476883a5b182bfb15165` | 24,972 / 24,972 |

Each selected original GLB embeds creator, source UID/page and explicit CC BY 4.0 attribution matching the preserved metadata.

- **250 GTO and Testarossa:** the original Sketchfab model endpoints returned HTTP 404 at review time. The archive copies and their matching historical license evidence remain available. Adjacent `UID.archive.json`, `UID-embedded-provenance.json` and `UID-live-status.json` preserve the distinction. Historical archive metadata URLs are retained in each `UID.json`.
- **R8 LMS GT3:** the current API returns an empty license object. The source original embeds CC BY 4.0 and the archived metadata records `license: by`. Both archived and current fields are preserved; the normalized preparation license comes from the archived licensed copy.
- **R18:** current API CC Attribution / by / 4.0 agrees with the original embedded attribution. The author describes an individual HETIC project.

The GTO keeps its No.32 racing livery, cabin and wire-wheel geometry. Complete wheel components become four pivots. Rear-only connected lamp parts supply brake illumination. The Testarossa keeps its authored side strakes, cabin and wheels; the display title follows the original model name without adding an unsupported model year.

The R8 LMS source describes the 2019 car. Its FL/FR/RL/RR wheel nodes become the standard pivots. Factory livery and glass remain distinct. The R18 uses the author's Wheel_AR/Wheel_AV geometry and limits paint to body, door and spoiler nodes. Its source-wide alpha blend is corrected to opaque to prevent body sorting artifacts. No inaccurate all-body brake glow is assigned where the source lacks an isolated rear lamp role.

All four models are below 100,000 triangles. Both delivery levels preserve full source geometry and lower only texture resolution for mobile; this avoids the UV damage observed during an abandoned aggressive simplification trial. The researcher rendered all final high/low models and passed finite-bounds, nonempty wheel, contact and paint validation. Fixture reviews do not replace integrated gameplay tests.

Each adjacent `UID.json` contains the preparation metadata, direct source download, reviewed SHA-256 and original embedded attribution. Full shipping output hashes, exact byte counts, material roles, wheel positions and transformation notes are retained in the complete asset manifest.
