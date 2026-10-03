# Scanned broadleaf proportions — 4 October 2026

Baseline: commit `8411b41`, with scene evidence in `polish-grounded-live-race.png`
and `polish-terrain-current-fuji.png`. Both show several narrow, elongated leaf
columns around the Fuji road. The source geometry explains part of that shape:
the delivered Tree Small 02 scan is approximately 4.8 m high with a 3.2 m crown
radius, while some legacy forest slots request nearly 20 m height and only
3.3 m radius. This stretches the small broadleaf vertically by almost four
times as much as horizontally.

## Change

`createScannedTrees` now fits a tree's height to at most 2.35 times its existing
crown radius. This allows about 1.6 times the source scan's vertical proportion
while preserving a visible trunk and spreading canopy. Trees already within
that envelope retain their authored height. The same fit applies to both scan
tiers and every associated fallback piece. Fallback positions scale around
the tree's original ground base before the existing terrain grounding is
applied, so loading, travel, and load failure do not restore a taller tree.

The existing horizontal footprint is unchanged. There are no new assets,
textures, network requests, triangles, material draws, shadow passes, or
per-frame geometry work. Mobile remains capped at 8 near and 64 far scanned
trees in six draws. Shared scenery placements and collision data are not
rewritten.

## Measured proportions

These are deterministic mobile layout audits, combining the normal venue
tree layout and forest margin layout with stand, landmark, and house
clearances. They are not measurements of a particular live camera's selected
trees.

| Venue | Audited trees | Fitted trees | Height before | Height after |
| --- | ---: | ---: | ---: | ---: |
| Fuji Skyline | 200 | 157 | 6.02–19.87 m | 6.02–13.29 m |
| Monza | 213 | 184 | 6.10–19.87 m | 6.10–13.29 m |
| Spa | 207 | 168 | 6.03–19.87 m | 6.03–13.11 m |

The most stretched sampled candidate has radius 3.331 m and previously had
height 18.882 m, a height/radius ratio of 5.668. Its fitted height is 7.828 m,
with ratio 2.35. The resulting population remains trees around 6–13 m tall;
this is a species/proportion adjustment, not a claim of botanical simulation.

## Rights and verification

The existing geometry is Tree Small 02 by Rico Cilliers / Poly Haven,
CC0-1.0. Its canopy photograph derives from the existing Potted Plant 02
CC0 asset by the same author. Source URLs, original hashes, derivative hashes,
and recorded changes remain in
`public/assets/environments/trees/provenance.json` and the linked surface
provenance record. No source files or attribution were changed by this runtime
transform correction.

**14/14 focused tests pass** (10.65 seconds): scanned trees, roadside planting,
vegetation geometry, and venue groundworks. The new regression loads all four
delivered tree variants, transforms every actual vertex, and checks common
near/far height, exact root contact, and the complete canopy footprint. It
also checks fallback scale and base placement before loading, after travel,
and after disposal. Failure coverage now measures the fallback's actual root
point rather than its unscaled center translation. Existing all-38-route
clearance checks pass.

The main task's actual Fuji renderer review accepted the lower, wider canopy
proportions as an improvement over the elongated baseline. The main task saved the local review capture as `reports/polish-trees-proportions.png`.
The leaves still look papery; this transform correction does not claim
to solve the source canopy's silhouette or material quality, which is under
separate asset review.

This module validation and renderer review are not a gameplay test, a
physical-phone performance measurement, or evidence of parity with a
commercial racing game. Sparse far-tier foliage and repeated source species
remain visible limitations.

The subsequent [source canopy pass](source-canopy-2026-10-04.md) replaces these tree tiers’ former Potted Plant leaf imagery with baked original tree leaves. The proportion fit remains unchanged. SHA-256 query versions now ensure all four updated tree assets replace previously cached copies.
