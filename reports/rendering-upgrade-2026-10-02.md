# Authored venue and rendering upgrade — 2 October 2026

Implemented in the local checkout; no deployment performed by this rendering task.

## Measurable geometry changes

- Added a distinct distance GLB for every one of the 33 licensed manufacturer cars. Original high and low assets are untouched.
- All low assets combined: 4,318,156 triangles / 51,602,600 download bytes. All distance assets combined: 1,367,965 triangles / 17,281,092 bytes. This is a **68.3% triangle reduction** and **66.5% byte reduction** across the catalogue, not a claim that the complete catalogue downloads at once.
- Ferrari 458: 199,681 → 58,974 triangles. Aventador: 136,669 → 41,178. Individual reductions range from about 49–77%.
- Attribute-weighted simplification runs on decoded float attributes, retains wheel pivot nodes, normals and UVs, and caps reported relative simplification error at .006. Decoded world-space bounds for all 33 distant models differ by at most 8.34 mm from their near sources. Each output retains embedded source metadata and a distance-tier modification notice; the authoritative author/license links remain in manufacturer-asset-manifest.js. Source and result hashes are in manufacturer-distance-manifest.js and manufacturer-distance-assets.json.
- Distant materials preserve the actual source paint/texture identity using 192 px maps; clearcoat, normal, bump, AO and car shadows are removed at that tier. Source colour replacement masks remain active for baked paint atlases. Visual wheel updates are limited to 10 Hz and suspension/damage work is omitted in the distant visual. Rival simulation remains outside the renderer.
- Hysteresis is 65 m outward / 52 m inward, multiplied by current scene detail scale. A failed background request leaves the original model visible. Requests are deduplicated and run through the same two-slot queue, with selected/near models prioritised. New models are disposed with their owner and still share immutable cached resources. The two-idle-template cache remains bounded. Estimated resident bytes are diagnostic estimates of buffers plus uncompressed RGBA+mipmap textures, not a GPU memory measurement.

## Sustained automatic quality

Automatic quality starts with the existing desktop/mobile policy and uses rendered-frame intervals in two-second windows after warmup. A sustained 75th-percentile interval above 26 ms reduces resolution and scene detail, disabling reflections first and then bloom/shadows. Recovery needs 14 seconds of headroom and has a longer cooldown. Manual quality remains authoritative. Menus, loading, hidden tabs and intentional low refresh caps must not be sampled. Neither callback cadence nor this policy proves physical-device thermal performance.

Static instance lists are divided into 120 m cells, preserving all authored instances. Partitioning can increase draw calls in broad views; the reduction in submitted distant geometry is measurable, while device-specific net frame-time benefit still requires profiling. Three.js now has local bounds for frustum rejection; scenery detail sectors also leave draws beyond the current distance budget. Tall skyline silhouettes and structural viaduct supports remain present. Runtime visible/total batch and instance counters are exposed on world.scene.userData.distanceDetail. Heavy destination foliage uses selective spatial batches within the existing 20-draw phone ceiling; lightweight destination architecture stays grouped by material. Showcase terraces use one spatial group per authored site. An explicit detail-distance change therefore changes real submitted geometry, not just a preference label.

## Three authored showcase circuits

Harbor Flow: Quayside, Crane Channel and Marina Return add stretched sail terminals, a glazed harbour signal house, lit viewing terraces, route signage and sector-specific resurfacing/roughness.

Fuji Skyline: Blossom Run, Skyline Viaduct and Summit Return add timber mountain pavilions with layered pitched roofs and warm lantern accents, small roadside audiences and coordinated sector material variation. The existing summit, snow cap, cherry trees and viaduct stay intact.

San Francisco Hills: Bay Viaduct, Terrace Climb and Pacific Descent add red-framed bay shelters, clocks, glass backs, lit seating terraces and more weathered climb asphalt. The existing bridge cables and bay houses remain.

Every landmark placement checks its full conservative radius against the complete circuit and grandstands. Each has only 8 phone / 14 desktop additional spectators, using the existing whole-person distance culling and animation budgets. No point lights or shadow-casting showcase meshes were added. Signs use an original shared 768×192 graphic and remain outside the driving width. Road wear/roughness interpolates between authored sectors without displacing the physical surface. Water and boat animation now freeze with pause and reduced motion.

## Validation and limits

24 targeted renderer/placement/asset/lifecycle tests passed, plus the production build (existing large bundle warning remains). They cover all source hashes, all 33 actual triangle reductions, wheel retention, shader hook text, safe placement, hysteresis, failed-load fallback, material ownership/disposal and real instance removal at distance. Browser shader compilation and representative visual captures are still being completed by the integration task; this report is not a gameplay smoke result.

No physical-phone sustained racing or thermal test was performed here. KTX2/Basis GPU compression is not added: WebP remains the delivery format and decodes to ordinary GPU textures. Added distance assets trade bounded extra resident geometry/maps for lower far-car rendering cost. The initial simplification error is conservative but representative browser inspection is still necessary before publishing. Three.js context-loss/device-specific shader behaviour is not exhaustively verified.


## Corrective browser finding: Harbor sails and destination draw budgets

The integration browser caught two Harbor merge errors: custom triangular sails omitted UV attributes required by their shared box-geometry batch. Added explicit UVs and compatible-attribute batch keys. A failed future merge now keeps every transformed source part instead of deleting the affected scenery. Actual showcase construction tests cover all three routes at both detail levels, assert no merge error, and conserve every source triangle.

Fine destination partitioning had also exceeded established draw budgets, despite unchanged geometry. Replaced it with selective partitioning only for groups above 1,000 triangles and only within the existing ceilings. Phone destination draws are now Fuji 11 (14,392 triangles), Singapore 13 (5,238), Norway 16 (9,860), and San Francisco 15 (10,414). Original geometry/draw-budget tests remain unchanged and pass.

The additional showcase architecture has explicit ceilings: Harbor 19 draws / 512 triangles, Fuji 21 / 636, and San Francisco 27 / 816, plus six sign-plane triangles. The existing crowd renderer handles spectators separately. Grouping by authored terrace rather than arbitrary cell edges avoids splitting a single building unnecessarily. Eleven affected destination/showcase/spatial tests pass after these corrections. Browser visuals remain the integration task's responsibility.
