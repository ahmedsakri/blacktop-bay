# Source tree canopy derivative — 2026-10-04

The four Tree Small 02 game assets now use foliage baked from the original tree's connected leaf meshes, original UV coordinates, and original diffuse photograph. They no longer borrow the Potted Plant 02 photograph used by the earlier tree derivative. Existing non-tree surface assets are unaffected.

The source is [Tree Small 02 by Rico Cilliers / Poly Haven](https://polyhaven.com/a/tree_small_02), offered under CC0. The source glTF, binary, and all used photographs are checked against the MD5 records returned by the primary Poly Haven API. Per-file URLs and hashes, the bake recipe, and delivered GLB SHA-256 hashes are in `public/assets/environments/trees/provenance.json`.

The offline bake selects eight groups of complete connected source leaf meshes and renders two orthographic views of each into a padded 4×4 alpha atlas. Complete components avoid cut leaves along a square crop. Four selected views form the 2×2 far atlas. Each sampled canopy position carries two crossed cards, using four triangles total. Silhouettes come from source geometry, not synthesized leaf outlines. The baked textures remain ordinary cutout materials in the game renderer.

| Tier | Triangles | Materials | Leaf cards | Largest texture | GLB bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mobile near | 2,481 | 3 | 360 | 512×512 | 518,532 |
| Desktop near | 5,161 | 3 | 680 | 1024×1024 | 1,286,196 |
| Mobile far | 586 | 3 | 96 | 128×128 | 65,484 |
| Desktop far | 917 | 3 | 160 | 256×256 | 160,020 |

Triangle counts, texture dimensions, texture count, materials, and runtime instance capacities are unchanged. The mobile near+far download is 584,016 bytes, 137,540 bytes larger than the preceding assets. The desktop pair is 1,446,216 bytes, 180,400 bytes larger. Extra vertices needed for the crossed cards and richer compressed canopy imagery account for the download increase. All four files together are 2,030,232 bytes. Bounds, root height, total height, and radius were recomputed from every delivered vertex.

Validation: all seven focused tests passed using `node --test tests/scanned-trees.test.js tests/scanned-canopy-assets.test.js`. Checks cover the real shipped geometry, provenance hashes, draw/triangle/texture/download limits, source photograph identity, card UV gutters, alpha preservation, root contact, broadleaf proportions, fallback restoration, failed loads, and disposal. The actual mobile Fuji scene was inspected in the coordinating renderer pass and the current canopy density was accepted. Broader scene, gameplay, production build, and release checks belong to the main release verification; this asset report is not a substitute for them.

## Reproduction

Source inputs and atlas previews are retained outside the repository at `../camber-reign-asset-sources/tree-small-02`. They are not served by the game. The download is approximately 95 MB of geometry plus the used photographs.

```sh
npm install --prefix /tmp/camber-distance-tools --no-audit --no-fund @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0 sharp@0.35.5
node scripts/download-tree-source.mjs
node scripts/prepare-scanned-trees.mjs
node --test tests/scanned-trees.test.js tests/scanned-canopy-assets.test.js
```

Both preparation commands accept `--source` to choose an alternate input directory; the derivative command also accepts `--tools` for the offline dependency directory. `canopy-clusters.png` and `canopy-clusters-far.png` are saved in the source directory for visual inspection. No offline authoring dependencies were added to the game package.
