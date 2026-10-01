# German and McLaren source pack — second expansion, 2026-10-01

Portable configuration: [`german-other-2.mjs`](../../../scripts/manufacturer-packs/german-other-2.mjs). This pack adds three independently reviewed models. It does not relabel a road car as a race variant.

| Model | Source attribution | UID | High / low triangles | Draw calls per variant |
| --- | --- | --- | --- | --- |
| McLaren 650S GT3 | [bukhtawer.durrani](https://sketchfab.com/3d-models/mc-laren-650s-gt3-2d0dcf63909f40b0b4546726606414e7) | `2d0dcf63909f40b0b4546726606414e7` | 358,389 / 133,697 | 38 |
| BMW M3 E46 Coupé | [MMC Works (archived as Márcio Meireles)](https://sketchfab.com/3d-models/bmw-m3-e46-f1b00ff37d504629b10031da32bc7497) | `f1b00ff37d504629b10031da32bc7497` | 396,528 / 154,061 | 48 |
| Audi Quattro Rally | [Matthew Hirst](https://sketchfab.com/3d-models/audi-quattro-rally-10ad6b7608474ec8aac778934723c151) | `10ad6b7608474ec8aac778934723c151` | 129,162 / 129,162 | 32 |

Each source's current primary Sketchfab metadata identifies CC Attribution (`by`, version 4.0), and its original archived GLB embeds matching CC-BY-4.0 attribution. The adjacent `UID.json` records retain the current metadata, normal-TLS archive download URL, source SHA-256, original embedded attribution, and verification date. [`source-index.json`](source-index.json) lists this pack only. These are model uploader license records, not manufacturer licenses or endorsements.

The BMW source identifies the model as an M3 E46 made in Blender for personal practice and links the creator's modeling timelapse. Its current profile is MMC Works; the original GLB embeds Márcio Meireles and the marciomeireles profile URL. Both names are retained. It is a sports coupe, not the M3 GTR. Race listings explicitly tied to extracted commercial-game content were excluded. Modern BMW race listings without an accessible licensed source were not substituted with unverified meshes.

The McLaren retains its full GT3 body, livery, interior and four original wheel assemblies. Body paint is isolated from the livery texture, optical surfaces, rubber and cabin. Archived material roles are repaired for PBR rendering, and secondary geometry is simplified for high and mobile variants.

The BMW retains its authored coupe shape, body surfaces, interior and distinct wheels. Its front wheels were authored at 20 degrees of steering; preparation neutralizes that angle around each real wheel pivot before runtime animation. Body paint is isolated from calipers, glass, trim and wheel materials.

The Audi archive contains no embedded textures or livery maps. Preparation retains the complete rally body, auxiliary lights, cabin, roll cage and wheels, and assigns material colors to named surfaces. The four complete original tyres use dark rubber; rims, discs, hubs and nuts use metal materials. Calipers and axles stay static. Glass, trim, cabin and lamps have separate material roles. [Material validation](audi-material-validation.json) records the source texture absence, complete wheel component counts, dark-rubber/metal separation, static calipers and isolated body paint checks for both variants. Its source geometry is already below the mobile triangle budget, so both variants preserve all 129,162 triangles. The source material named `Floor` belongs to the car, not to a staging plane, and is retained.

All six prepared GLBs pass four nonempty canonical wheel groups, tyre ground contact within 3 mm, isolated body paint, no more than 100 draw calls, and the high/mobile triangle budgets of 450,000/200,000. Geometry checks are not a completed browser gameplay test. Final visual, loading and gameplay checks belong in the release report after integration.

To reproduce, place the three original `UID.glb` files beside their adjacent `UID.json` records in a source directory, then run:

```sh
node scripts/prepare-manufacturer-assets.mjs \
  --sources /absolute/path/to/sources \
  --tools /absolute/path/to/gltf-tools \
  --out /absolute/path/to/prepared \
  --config /absolute/path/to/blacktop-bay/scripts/manufacturer-packs/german-other-2.mjs \
  --no-module
```

The source hashes must match the adjacent proof records. Prepared output hashes, byte counts, wheel positions and material names are retained in the generated pack manifest and, after integration, the shipping manifest.
