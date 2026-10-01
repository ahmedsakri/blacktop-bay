# Italian and Porsche expansion candidates — 2026-10-01

These are distinct original meshes, absent from the released 27-car catalogue. Model-specific CC BY 4.0 evidence comes from the listing/archive metadata and the original GLB attribution, not from the aggregate dataset license. The uploader's license claim is recorded; no permission from a vehicle manufacturer is asserted.

| Prepared ID | Original model / credited source | UID | Evidence |
| --- | --- | --- | --- |
| lamborghini-countach-lp500s | Lamborghini Countach LP500S by SDC PERFORMANCE™️; rims credited to Lexyc16 | 32e9ee8d129e4c2992e1753b4fc3094c | Current API CC Attribution/by/4.0 matches original embedded attribution. Description says Blender 3.0, by SDC, with rims by Lexyc16. |
| ferrari-enzo | Ferrari Enzo by Carlos.Maciel | 96c16ea6d7704ad397a8f02bf0250bff | Archived metadata license by matches original embedded CC BY 4.0 attribution. Current source listing/API returns 404; archived permission evidence is preserved explicitly. Description says Blender and Photoshop. |
| porsche-919-hybrid | Porsche 919 Hybrid 2017 by mudkipz321 | b4ca76b4b83e4d84b1e1a994e79140f3 | Current API CC Attribution/by/4.0 matches original embedded attribution. Description identifies the author's own first Blender project without tutorials. |

The Countach's original author profile is https://sketchfab.com/3Duae; the current display profile is @Lambo_SC04. Preserve both through the source metadata and embedded attribution. The author specifically credits the rims to https://sketchfab.com/Lexyc16; this additional contribution is carried in preparation notes. No separate rim license was found or invented.

Each adjacent UID.json is the preparation wrapper with original listing/archive metadata, normal-TLS archive download URL, SHA-256, original embedded author/license/source/title and live status. The Enzo also retains UID.archive.json and UID.live-status.json. Original UID.glb files are never altered.

The Countach uses all authored detail at high quality, with materials separated for paint, transparent glass, lamps, metal and rubber. Four complete wheel assemblies are separated from source components and the negative-Z source front is rotated to the game's positive-Z convention.

The Enzo retains body topology, UVs and maps. Its original front-left wheel objects are siblings of an empty wheel1_126 node, so the config explicitly selects those six source meshes. The other three wheels use their named source hierarchies. Brake calipers stay static. Tyres are grounded, and red rear lamps and body paint are separate.

The Porsche source contains almost four million triangles. Preparation removes the studio sweep and the zero-opacity decal planes that the author had already disabled. Visible maps and small decal meshes are retained. Tiny visible decal surfaces and rear lamps are protected from simplification to avoid empty compressed buffers. Dense body/wheel subdivisions are reduced, four whole source wheel assemblies articulated, and brake calipers kept static. This is a model of the 2017 race prototype, not the later Evo record car.

## Prepared geometry

| Model | High / low triangles | High / low bytes | Material batches |
| --- | --- | --- | --- |
| Countach LP500S | 208,002 / 176,940 | 1,546,804 / 1,415,292 | 33 |
| Ferrari Enzo | 420,469 / 154,563 | 2,700,536 / 1,158,220 | 46 |
| Porsche 919 Hybrid | 383,415 / 152,340 | 4,063,212 / 1,695,236 | 44 |

All six prepared files passed finite vertex/normal/index checks, nonempty triangle geometry, four signed articulated wheel positions, tyre contact within 3 mm, rear-only brake illumination geometry, body-only paint materials, bounded dimensions, fewer than 100 material batches, and 450,000/200,000 high/low triangle ceilings. The local fixture exposes original front/rear and low-detail renders for visual review; this record does not substitute for the final runtime review.

## Reproduce in isolation

Run from the repository root. Install the preparation dependencies at the exact versions documented in `scripts/prepare-manufacturer-assets.mjs`. Download the reviewed originals with normal TLS verification, then check their recorded SHA-256 before preparing them:

```sh
source_dir=/tmp/blacktop-italian-porsche-2-sources
mkdir -p "$source_dir"
cp docs/manufacturer-sources/italian-porsche-2/*.json "$source_dir/"
curl --fail --location 'https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-055/32e9ee8d129e4c2992e1753b4fc3094c.glb' --output "$source_dir/32e9ee8d129e4c2992e1753b4fc3094c.glb"
curl --fail --location 'https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-029/96c16ea6d7704ad397a8f02bf0250bff.glb' --output "$source_dir/96c16ea6d7704ad397a8f02bf0250bff.glb"
curl --fail --location 'https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-061/b4ca76b4b83e4d84b1e1a994e79140f3.glb' --output "$source_dir/b4ca76b4b83e4d84b1e1a994e79140f3.glb"
source_checks="$PWD/docs/manufacturer-sources/italian-porsche-2/SHA256SUMS"
(cd "$source_dir" && shasum -a 256 -c "$source_checks")
node scripts/prepare-manufacturer-assets.mjs --sources "$source_dir" --tools /tmp/blacktop-manufacturer-tools --config scripts/manufacturer-packs/italian-porsche-2.mjs --out /tmp/blacktop-italian-porsche-2-prepared --no-module
```

The portable config has no imports or absolute paths. Supply original UID.glb files alongside their matching UID.json wrappers. Both `--out` and `--no-module` are required for isolated review: the former protects shipping JSON/GLBs and the latter prevents overwriting the shipping JavaScript manifest. Never point an unreviewed isolated pack at the shipping output directory.

## Excluded or not selected

- Ferrari listings by Ddiaz that explicitly mention CSR2/RR3 exports are excluded.
- Ferrari 488 Pista Widebody by Dev365TH (UID `16c28f5b3ed24991ac3d1208f4a8bc1f`) has an authored-model description, but no public licensed archive original was available; an official logged-in source download is needed.
- Lamborghini Countach 2021 by ALIEEEN / original Desiccated_Lemon (UID `cf4e16b74ef7499abbdf591c665fc0ee`) is a downloaded licensed backup, not part of this three-model pack.
