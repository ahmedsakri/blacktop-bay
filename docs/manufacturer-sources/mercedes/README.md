# Mercedes-Benz source pack — 2026-10-01

Portable configuration: [`mercedes.mjs`](../../../scripts/manufacturer-packs/mercedes.mjs). Reproduction commands are in the [source-record overview](../README.md).

| Model | Creator / source | UID | High / low triangles |
| --- | --- | --- | --- |
| Mercedes-Benz AMG GT | [Yan Carvalho](https://sketchfab.com/3d-models/mercedes-benz-amg-gt-661dcab94455463784651a3ebc63cfb9) | `661dcab94455463784651a3ebc63cfb9` | 175,529 / 174,767 |

The AMG GT source is by Yan Carvalho. Current CC Attribution / by / 4.0 metadata matches the original GLB's author, source and license attribution.

The source has a display floor and an oblique orientation with visibly turned front wheels. The config removes the floor, bakes the source yaw into positive-Z forward coordinates, isolates complete authored wheel components using measured signed source regions and straightens the real axle assemblies before runtime steering. Source paint, glass, rubber, metal and rear lamp materials receive named PBR corrections.

The isolated prepared result retains the detailed body and four real wheel pivots at 175,529 triangles for desktop and 174,767 for mobile. Final visual and gameplay checks are recorded in the release report; preparation itself is not a gameplay test.

Each adjacent `UID.json` contains the preparation metadata, direct source download, reviewed SHA-256 and original embedded attribution. Full shipping output hashes, exact byte counts, material roles, wheel positions and transformation notes are retained in the complete asset manifest.
