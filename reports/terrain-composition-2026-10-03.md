# Terrain composition follow-up

The shipped Fuji race and landscape captures showed two specific geometry problems: a close, blank triangular mountain face and a broad flat apron behind the spectator stands. This follow-up changes actual terrain geometry; it does not alter racing layouts, elevation profiles, collisions, ramps, saved progression, sky assets or catalogue previews.

## Changes

- Fuji's separate cone and snow cap are replaced by one connected volcanic landform. Its asymmetric slopes include curved drainage grooves, a shallow summit hollow and a varying snow line. It is farther from the course, with every delivered vertex more than 130 m from the route. The existing licensed Rocky Terrain photograph supplies detail. This is authored geometry, not a claimed terrain scan or a geographic reconstruction.
- Continuous inland terrain no longer flattens around ordinary trees. Tree roots already use the rendered terrain sampler; fixed structures still receive their existing ground-level pads. Whole-cell road caps remain in place.
- Four outer terrain rings share the local mesh's exact boundary and extend 550 m beyond it. Broad irregular ridges replace the previous rectangular fade to a flat disk. The rings share the same material draw and world-aligned UV scale.
- Near-ground surface imagery and lighting are being handled separately by the main task. No new texture, loader, light, shadow map or per-frame terrain work is introduced here.

## Geometry and checks

Fuji mobile destination geometry is **6 draws / 9,636 triangles**, retaining the existing 20-draw / 16,000-triangle bound. Its separate mobile inland terrain is **one draw / 6,424 triangles**. The maximum measured mobile terrain across eligible parkland routes is **6,704 triangles**, below the existing 7,000 limit. Desktop terrain retains its existing 16,000-triangle ceiling.

**20/20 focused checks passed** in `/tmp/camber-landscape-composition-tests.log` (12.65 seconds): four destination driving routes, all six actual ramp trajectories, destination geometry, all 38 verge/parcel/forest footprints, both-LOD inland full-lane clearance, actual tree-root raycasts, fixed structure pads, terrain boundary topology and the mountain's finite geometry/remote footprint. The extended terrain check was rerun after adding real tree-root raycast assertions and passed.

The topology check permits an open edge only at the outermost terrain perimeter: the former local rectangular boundary is entirely joined, with no duplicate or non-manifold edges. Road tests continue to sample each lane against the rendered terrain height. No production build or browser gameplay result is claimed by these module checks.

## Rendered review

The actual Fuji mobile-preset fixture at sector 0.13 is captured in `reports/polish-terrain-current-fuji.png`. It reports **93 draws / 147,806 triangles**, all **11 surface maps**, and **zero reported errors**. The former flat apron is visibly replaced by continuous planted hills; this is a desktop renderer using the mobile graphics preset, not a real-phone frame-rate measurement or a gameplay test. The starting evidence is `reports/polish-free-live-race.png` and `reports/polish-free-live-landscape.png`; those show the previous released scene.

The main task flagged apparently floating distant canopies around the left hill crest. `reports/audit-tree-grounding.js` then inspected the actual loaded trunk vertices and instance transforms, projecting the bases through the active camera and raycasting the displayed terrain, verge and ground meshes. All **72 active trees** found ground. The largest trunk-center gap was **+0.0000035 m**, within floating-point precision; the lowest was **−0.83279 m**, where another displayed surface covers the base. No positive center gap supporting a floating-tree defect was found.

Two inspected trees in the suspect screen region measured:

| World X/Z | Camera distance | Root-center gap | Root-foot vertex gaps across slope | Projected base width |
| --- | ---: | ---: | ---: | ---: |
| 213.35 / −210.08 | 95.58 m | −0.0000081 m | −0.053 to +0.0626 m | 1.9 px |
| 274.73 / −210.43 | 157 m | −0.00000115 m | −0.013 to +0.0385 m | 1.0 px |

The source models retain complete 700-triangle near / 144-triangle middle-distance trunks. Their photographed source trunk is approximately **0.16 m wide at the base** before scaling; many distant bases project to **1.2 px or less**. Thin stems and terrain occlusion explain the canopy appearance in this view. Small opposite-sign foot-vertex gaps are the rigid tree base meeting a sloped surface, rather than a detached trunk. No additional terrain or tree changes were made after this audit.

Read-only review of `terrain-surface.js` found that it changes diffuse colour and normal shading with world-aligned coordinates, without displacing terrain vertices. It cannot change the measured root/terrain intersection. The material integration adds no draw or geometry allocation; texture ownership remains with the surface library.

Thin distant foliage and stems remain a visible limitation. This work makes no claim of parity with a high-end reference game.
