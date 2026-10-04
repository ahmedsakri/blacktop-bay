# Pine asset preparation

These authoring scripts default to the sibling `camber-reign-asset-sources/conifer-upgrade` directory. Original geometry, photographs, intermediate arrays and branch atlases stay outside the game repository. `--source /absolute/path` overrides that directory.

1. Run `python3 scripts/conifer/download-source.py`. It verifies each downloaded input against the source URL and MD5 pinned in `public/assets/environments/trees/pine-provenance.json`.
2. Run Blender in background with the downloaded `source/source.blend` and `--python scripts/conifer/extract-clusters.py`. For a different source directory, append `-- --source /absolute/path`.
3. Run `python3 scripts/conifer/prepare-conifer.py` with NumPy and Pillow installed. This creates the four GLBs, a manifest and provenance under the external `drafts/` directory. Blender 5.2.2 and Pillow 12.3 were used for the checked-in derivatives.
4. Run `python3 scripts/conifer/validate-drafts.py`, inspect the actual GLBs and renderer, then copy approved derivatives and the generated manifest into the game. Save the generated provenance as `pine-provenance.json` so it does not replace the broadleaf source record.

The bake preserves complete connected needle/cone components and assigns each to its nearest original woody twig. It then rasterizes three local views of each of the 27 twig groups using original geometry, UVs, photograph and opacity. Near trunks retain all 540 source triangles; only distant trunks are decimated. The resulting cutout cards preserve open branches, with a documented loss of depth and individual needle detail at close range.

The cached `baked-branches.png` and `baked-branches.json` avoid repeating the slow rasterization. Remove both when changing the source geometry or baking method. The final four models have matching rooted bounds. Their explicit opposing front faces use shared upward normals and a tiny separation to preserve two-sided foliage lighting with a single-sided alpha-test material. Do not change that material to alpha blending or double-sided shading.

These scripts do not copy files into production, commit changes, build, or deploy.
