# Manufacturer expansion source records

The October 2026 expansion uses individually credited models with recorded CC BY 4.0 source licenses. [source-index.json](source-index.json) records each source listing, archive download, source checksum, embedded attribution, additional contributors and adjacent preparation metadata. The BMW F22 listing identifies autoNgraphic as uploader/editor; its base-model authorship has not been independently verified. Each pack directory contains the metadata required by the preparation script. Original GLBs are fetched into a local cache rather than checked into this repository; prepared high/low GLBs ship in `public/assets/cars/manufacturers/`.

The model-specific license evidence applies to the archived original copy. The Objaverse dataset license does not replace individual object licenses. Two Ferrari listings are no longer live, and the current Audi R8 LMS listing no longer reports a license. Their matching archived metadata and original embedded CC BY 4.0 attribution are retained explicitly; these records do not assert new permission from a current listing. See [Ferrari and Audi evidence](ferrari-audi/README.md).

## Reproduce the expansion

Run from the repository root with Node.js. The preparation dependency versions are pinned in the header of `scripts/prepare-manufacturer-assets.mjs`.

```sh
npm install --prefix /tmp/blacktop-manufacturer-tools @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0 draco3dgltf@1.5.7 sharp@0.34.5 three@0.186.1
node scripts/manufacturer-packs/fetch-sources.mjs --out /tmp/blacktop-expansion-sources
node scripts/prepare-manufacturer-assets.mjs --sources /tmp/blacktop-expansion-sources --tools /tmp/blacktop-manufacturer-tools --config scripts/manufacturer-packs/2026-10-expansion.mjs --out /tmp/blacktop-expansion-prepared --no-module
```

`fetch-sources.mjs` checks every source against the reviewed SHA-256 before writing it and preserves a mismatched existing file instead of replacing it. It copies the checked-in license metadata next to each original `UID.glb`. `--check` performs local checksum/evidence verification without downloading or writing. `--pack porsche-lamborghini`, `--pack ferrari-audi`, `--pack bmw`, `--pack mercedes`, or `--pack nissan` selects one pack. Pass its matching portable config to the preparation command; `--only <asset-id>` prepares one model.

The isolated output includes `manifest.json` and both GLB variants. Review the actual models before replacing shipping files. The `--no-module` flag prevents an isolated run from rewriting the game's catalogue module. The shipping JSON and JavaScript manifests must contain the same complete collection, including existing models, with prepared byte counts and checksums matching each GLB.

## Preparation records

- [Porsche / Lamborghini](porsche-lamborghini/README.md): 911 GT3, Gallardo 2004 and Huracán.
- [Ferrari / Audi](ferrari-audi/README.md): 250 GTO, Testarossa, R8 LMS GT3 and R18.
- [BMW](bmw/README.md): i8 and F22 Eurofighter.
- [Mercedes-Benz](mercedes/README.md): AMG GT.
- [Nissan](nissan/README.md): GT-R 2018.
- [Second German / McLaren pack](german-other-2/README.md): 650S GT3, M3 E46 Coupé and Quattro Rally. Use `--pack german-other-2` to fetch these sources.
- [Second Italian / Porsche pack](italian-porsche-2/README.md): Countach LP500S, Enzo and 919 Hybrid. Use `--pack italian-porsche-2` to fetch these sources. The Enzo listing is no longer live; its archived metadata and original embedded attribution are preserved.

Source attribution and transformation notes are also embedded in each shipping GLB and retained in its manifest entry. Vehicle handling figures are game balancing values and are separate from the measured rendering dimensions used here.
