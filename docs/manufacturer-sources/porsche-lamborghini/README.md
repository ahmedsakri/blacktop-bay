# Porsche and Lamborghini source pack — 2026-10-01

Portable configuration: [`porsche-lamborghini.mjs`](../../../scripts/manufacturer-packs/porsche-lamborghini.mjs). Reproduction commands are in the [source-record overview](../README.md).

| Model | Creator / source | UID | High / low triangles |
| --- | --- | --- | --- |
| Porsche 911 GT3 | [ChevroletSS](https://sketchfab.com/3d-models/porsche-911-gt3-78d5c47ab2554c2592b7e499179a0792) | `78d5c47ab2554c2592b7e499179a0792` | 234,762 / 159,120 |
| Lamborghini Gallardo · 2004 | [ALIEEEN](https://sketchfab.com/3d-models/free-lamborghini-gallardo-2004-e6a7d7e98f4c46ca841eb930184b0f09) | `e6a7d7e98f4c46ca841eb930184b0f09` | 82,146 / 82,146 |
| Lamborghini Huracán | [jpo1703](https://sketchfab.com/3d-models/lamborghini-huracan-b2f5c24c44fd417fb89286603af9b5a5) | `b2f5c24c44fd417fb89286603af9b5a5` | 356,823 / 163,662 |

The current Sketchfab API metadata for all three selected sources reports downloadable models under CC Attribution / `by` / version 4.0, matching the original embedded GLB license. The Gallardo creator currently displays **ALIEEEN**; its downloaded original retains **Desiccated_Lemon** and the historical profile URL. Both are preserved in the model record.

The GT3 retains the detailed body and interior. Its alternate blurred rim and damage overlay were removed because they overlap intact surfaces. Named rim, tyre and disc components become four articulated wheels; exterior paint, glass, rubber, alloy and lamp surfaces receive separate roles. Shared light geometry is split by complete rear components so brake illumination stays behind the cabin.

The Gallardo retains its original texture maps and complete 82,146-triangle body and wheels. Source front is negative Z, so the config turns the model to the game's positive-Z forward convention. Rims, tyres, discs and wheel badges are moved into four real wheel pivots; calipers remain fixed. Optical alpha/roughness is corrected without substituting geometry.

The Huracán source has 1,704,172 triangles and one blank material. Its author-named body, wheel, glass, trim, metal, interior and lamp meshes receive explicit PBR material roles through the shared preparation hooks. Conservative simplification creates bounded high/low variants while retaining the authored body silhouette, detail and four physical wheel assemblies.

Geometry validation covered finite vertices/normals, valid indices, triangle primitive modes, four correctly positioned articulated wheels, tyre contact, isolated body paint, dimensions and both triangle budgets. Root visually inspected the prepared front/rear and low variants in the actual WebGL review renderer. This source-model review is separate from final game integration tests.

The 2005 Carrera GT by koyd and 918 Spyder by srush651 were researched but are excluded from this pack. The former is a coarse printable-style assembly; the latter combines line primitives and overlapping translucent surfaces that would require substantial further cleanup.

Each adjacent `UID.json` contains the preparation metadata, direct source download, reviewed SHA-256 and original embedded attribution. Full shipping output hashes, exact byte counts, material roles, wheel positions and transformation notes are retained in the complete asset manifest.
