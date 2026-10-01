# BMW source pack — 2026-10-01

Portable configuration: [`bmw.mjs`](../../../scripts/manufacturer-packs/bmw.mjs). Reproduction commands are in the [source-record overview](../README.md).

| Model | Source attribution | UID | High / low triangles |
| --- | --- | --- | --- |
| BMW i8 | [salza](https://sketchfab.com/3d-models/bmw-i8-c884666736f049c296044992107e12a7) | `c884666736f049c296044992107e12a7` | 444,684 / 189,554 |
| BMW F22 Eurofighter | [autoNgraphic — uploader/editor](https://sketchfab.com/3d-models/bmw-f22-eurofighter-free-d4ffe0df9066481fa028eb1e1348c4b0) | `d4ffe0df9066481fa028eb1e1348c4b0` | 439,173 / 199,351 |

Both source files report current CC Attribution / by / 4.0 metadata and embed matching source attribution. The i8 listing attributes the model to salza. The F22 Eurofighter listing identifies autoNgraphic as uploader and credits its `edit` role, crooked.hand for the bodykit and ondori_ws for the wheels; these contributors are retained in `additionalCredits`. The base car's authorship has not been independently verified. The material names do not establish its origin, and the reviewed source description names no extracted game. These are the uploader's model-license and attribution records, not a license or endorsement from BMW. The Eurofighter is a custom drift car and is labeled accordingly.

The i8 keeps its original body and cabin, with material-isolated body paint, rubber, rims, discs and rear lamps. The F22 preserves its custom body, wheels and livery; it is turned to positive-Z forward and its authored wheel contact is aligned to the road. Every pivot contains original wheel geometry.

Both high/low variants passed source checksum, finite geometry, four nonempty wheel groups, ground contact, isolated paint, draw-call and geometry-budget verification. Final visual and gameplay checks are recorded in the release report rather than inferred from these geometry checks.

Each adjacent `UID.json` contains the preparation metadata, direct source download, reviewed SHA-256 and original embedded attribution. Full shipping output hashes, exact byte counts, material roles, wheel positions and transformation notes are retained in the complete asset manifest.
