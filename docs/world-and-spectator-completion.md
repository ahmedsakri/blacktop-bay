# Catalogue environments and textured spectator meshes

Updated 2 October 2026. These are original arcade environments with licensed CC0 MakeHuman human assets. They do not reproduce another game's art or surveyed circuit architecture.

## Coverage

All **38 current circuits** now receive coordinated foreground lighting, sky tint, fog, reflection strength and backdrop exposure. Eight regional treatments distinguish maritime, Mediterranean, woodland, alpine, tropical, arid, metropolitan and industrial venues. Harbor, Fuji and San Francisco retain their individually approved grades.

Each route has **three safely placed sector terraces**, for 114 authored sector locations in the catalogue. The architecture follows the region: sail terminals, timber pavilions, motorsport trusses, curved fabric canopies, shaded colonnades, glass viewing galleries or dock signal houses. Sector signs and road-surface wear accompany the buildings. Each terrace has a foundation reaching terrain or below the coastal waterline. Layout checks cover the full route, not only the road's closest nominal segment, and reserve space against grandstands, older landmarks, trees, buildings and trackside services.

This is catalogue-wide regional detail. It is not a claim that all 38 environments contain unique building assets or that they match Asphalt's layouts. Related regions intentionally share architecture and material sets.

## Nearby spectators

Close spectators now use **six individually fitted, textured MakeHuman adults**: three men and three women, with different skin textures, face/body shapes, hairstyles and casual outfits. The CC0 source meshes include real hands, shoes, garment folds, hair cards, eyes and facial topology. These replace the previous smooth procedural close people; that original mesh remains the immediate loading/failure fallback.

Each optimized GLB contains **11,741–14,099 triangles, 53 rig joints and three material draws**. Opaque 1024-pixel clothing/face atlases prevent the blended-face holes seen in the first prototype; 512-pixel depth-writing hair cutouts preserve hair silhouettes without rear-card sorting over faces. The six assets total **8,692,136 bytes**. They are requested asynchronously, at most two at once, and geometry/textures are shared by a fixed pool. The race never waits for a crowd download.

The pool is still **six characters on mobile and ten on desktop**. The near radius is 22 metres on mobile and 25 on desktop: the widest current roads place front-row seats 18.53 metres from the centreline, outside the old 18-metre phone radius. Every current circuit's real grandstand placement is checked for activation from its driving centreline. Each visible character costs three draws, or four when holding a phone. Only skeletons are cloned. Runtime posing uses the imported upper/lower bone lengths, preserving arm anatomy while waving, clapping, raising fists and filming. Fingers curl for a phone/fist, heads follow the passing car, legs fold into seats, and two transferred facial targets support blinking and restrained cheering. Changes in people do not create meshes or issue network requests every frame.

More distant people remain in ten economical instanced batches. Their six wardrobe palettes match the foreground assets. Each person is in one representation, and a two-metre selection hysteresis reduces flicker near the detail threshold. Background detail and complete out-of-range spectators leave the submitted draws. Marshals retain the original orange safety-uniform representation. Pausing, reduced motion, load failure, a 20-second download deadline, aborted teardown and late responses are handled explicitly; geometries, textures, skeleton textures and phone materials are disposed.

This is a substantial realistic-anatomy/material upgrade from primitive crowds, **not photorealistic scanned people or film-quality facial animation**. Distant silhouettes remain economical, and near slots use a fixed wardrobe pool rather than a unique human mesh per seat. Rendering counts do not establish real-phone frame rate, heat or memory behavior.

Sources, individual file hashes and authoring details are in `public/assets/crowd/SOURCES.json`; the CC0 license is in `LICENSE-CC0.txt`. Reproduce with `scripts/prepare-spectator-assets.py`, Blender 4.5 and MPFB 2.0.17 plus the official CC0 system asset pack. Only exported CC0 assets are shipped; MPFB authoring code is not included in the game.

## Verification

- Every current route has exactly three deterministic terrace placements, with safe road/stand/landmark clearance.
- All added geometry retains its triangles through batching; sector groups stay at or below 27 draws per route (15–24 for the new regional families).
- Terrace corner checks use the largest 17-metre quay footprint, and supporting geometry extends below terrain/water level.
- All six real GLBs have bounded files/triangles/materials, 53-joint rigs and nonempty facial morphs. Actual skinned vertices remain finite and human-sized across every gesture, seated and standing. Loader deduplication, two-request concurrency, failure fallback, late disposal, pose preservation, fixed pool and distance culling are tested. The original fallback tests also remain.
- The root agent inspected the final six-person textured fixture in the actual browser renderer, standing and seated. Faces, clothing, hair, gestures and bent seated legs rendered correctly without a visible blocker. Integrated-game review is recorded in the release report.
- Local visual fixtures live under `reports/` and are excluded from production. They do not replace physical phone heat/performance testing or a full game race.

Visual evidence: `reports/completion-crowd-2026-10-02.png`. The 45-metre fixture displayed zero foreground characters, 11 total draws and 14,738 triangles; moving back to the near view restored six character meshes without an observed disappearance or double draw. The original world/crowd group passed 38 tests; the new textured assets, lifecycle and original crowd/fallback group pass 19 focused tests. The release report records final build/test results and integrated gameplay verification.
