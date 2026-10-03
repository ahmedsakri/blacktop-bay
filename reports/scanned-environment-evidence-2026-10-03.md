# Scanned trees, roadside planting and connected urban blocks

3 October 2026. Implementation is local and uncommitted at this report's initial writing. The code does not establish commercial-game parity. Physics, route widths, elevations, ramp handling, saves and progression remain unchanged.

## Renderer-led corrections

- `polish-realism-next-fuji-lighting.png` exposed the separate old pink destination trees and a largely empty foreground slope. The pink population was removed; the shared scanned-tree system now covers near/middle distance and an irregular forest margin on the actual terrain. Understorey blades provide close ground detail.
- `polish-realism-next-fuji-forest.png` shows the actual revised scene using the mobile graphics preset on the desktop fixture: 93 draws, 145,204 triangles, eight near/64 middle-distance trees and no reported renderer errors. Grounded branches and grass are visible. Middle-distance foliage remains thin; the modeled ground/background boundary is still discernible.
- `polish-realism-next-singapore.png` exposed a inherited rule omitting elevated urban sectors. The revised layout continues through elevated sectors, raises building tops at least ten metres above their nearest road deck, and uses exact full-parcel road clearances to bring streets closer. The current mobile layout constructs 25 blocks/75 units, 13.2–33 m tall before the renderer's additional occupied-area exclusions. One instanced shell draw and one 9,012-triangle ledge/colonnade batch replace isolated short near-road boxes. Final renderer review of that revision is separate.
- Unsupported tall Singapore bridge portals are removed. Its asphalt roughness floor rises from .55 to .74 with the photographed colour/normal/roughness detail retained. No new dynamic lights or shadow maps are introduced by scenery.

## Asset and runtime bounds

Tree Small 02 by Rico Cilliers, [Poly Haven](https://polyhaven.com/a/tree_small_02), [CC0](https://polyhaven.com/license). The high-resolution 95 MB input is authoring-only. Trunk and branches use reduced source geometry/UVs/normals. Canopy placements derive from the source leaf positions, with the existing credited Potted Plant 02 photographic leaf spray. Exact sources and hashes are in `public/assets/environments/trees/provenance.json`.

| Tier | Mobile | Desktop |
| --- | ---: | ---: |
| Near file bytes | 390,936 | 1,128,112 |
| Middle file bytes | 55,540 | 137,704 |
| Near triangles per tree | 2,481 | 5,161 |
| Middle triangles per tree | 586 | 917 |
| Near capacity | 8 | 12 |
| Middle capacity | 64 | 128 |
| Shared material draws | 6 | 6 |
| Approx. tree RGBA+mips residency | 6.08 MiB | 24.33 MiB |
| Nearby grass triangles ceiling | 9,216 | 17,280 |

These are construction bounds, not phone frame-rate measurements. Fallback instances are compacted out of actual draw counts, rather than simply scaled to zero. Asset failures retain the original fallback trees; the optional new forest margin is absent until the scan loads. Generic deciduous trees do not assert botanically exact local species.

Fuji's destination module falls from 13 draws/15,228 triangles to 7/8,156 on mobile when its separate tree population is removed. Singapore's destination module is 7/6,280; SF remains 13/13,392. The existing 20-draw/16,000-triangle destination-module ceilings remain intact.

## Verification

54/54 current environment tests passed in `/tmp/camber-final-environment-54.log` across twelve files: world/regional lighting, scanned trees, roadside planting, urban districts, destination layout/scenery/driving, showcases, groundworks, surface details, spatial detail and vegetation geometry. Checks cover delivered model bytes/geometry/textures, entire-road clearance, independent dense parcel sampling, actual rendered-ground raycasts, house/terrace reservations, both LODs, fixed capacities and resource failures/disposal. The final SF audit also removed two mobile / five desktop ordinary-tree placements conflicting with house plots; every other generated tree placement remains unchanged.

A runtime selection audit sampled Fuji's actual lap every eight metres (375 positions) with its 200 current candidates and real selector. New middle-tier instances entered 204.9–328.9 m away, median 263.4 m; instances switched to near detail at 41.9–98.9 m, median 71.0 m. Counts remained 8+64. This bounds where representation changes occur; it does not prove visually imperceptible transitions in motion.

The shared surface library remains nine maps. Four new tree GLBs have their own embedded textures. All 38 catalogue previews require a new actual-renderer capture, awaiting final sky/lighting and scene review. The release report records the full production gate, gameplay QA and capture completion; these are not implied by this scenery test report.
