# Catalogue environments and original spectator meshes

Implemented 2 October 2026. These are original arcade environments and original character meshes. They do not reproduce another game's art, surveyed circuit architecture or photorealistic scanned people.

## Coverage

All **38 current circuits** now receive coordinated foreground lighting, sky tint, fog, reflection strength and backdrop exposure. Eight regional treatments distinguish maritime, Mediterranean, woodland, alpine, tropical, arid, metropolitan and industrial venues. Harbor, Fuji and San Francisco retain their individually approved grades.

Each route has **three safely placed sector terraces**, for 114 authored sector locations in the catalogue. The architecture follows the region: sail terminals, timber pavilions, motorsport trusses, curved fabric canopies, shaded colonnades, glass viewing galleries or dock signal houses. Sector signs and road-surface wear accompany the buildings. Each terrace has a foundation reaching terrain or below the coastal waterline. Layout checks cover the full route, not only the road's closest nominal segment, and reserve space against grandstands, older landmarks, trees, buildings and trackside services.

This is catalogue-wide regional detail. It is not a claim that all 38 environments contain unique building assets or that they match Asphalt's layouts. Related regions intentionally share architecture and material sets.

## Nearby spectators

Nearby spectators now use an original **single indexed skinned mesh**, replacing the old collection of small instanced body pieces at close range. Authored cross-sections supply a shaped torso, shoulder and hip anatomy, connected tapered limbs, individual fingers, trainer soles, facial cheekbones and eye sockets, a nasal bridge, fitted hair and clothing folds. Two independent facial morphs provide blinking and cheering. Existing inverse-kinematic arm poses retain constant bone lengths for waving, clapping, filming and raised-fist reactions.

There are **at most six foreground characters on mobile and ten on desktop**, at one draw per character. The preallocated meshes reuse their geometry and update their palette and bone transforms as different spectators come into view. No character images or models are downloaded during a race. Each mesh is below 8,500 triangles; the six-person review fixture renders about 36,800 character/floor triangles in seven draws. Those fixture measurements are rendering counts, not a device frame-rate claim.

More distant people remain in ten economical instanced batches. Each person is in exactly one representation, and a two-metre selection hysteresis reduces flicker near the detail threshold. Background details and complete out-of-range people still leave the submitted draws. Pausing and reduced-motion behavior remain supported. Mesh geometry, skeleton textures and materials have explicit disposal.

The result is a more detailed **stylized** crowd with articulated faces and clothing. It is not photorealistic. Nearby character variants share a bounded wardrobe pool; remote spectators preserve the cheaper silhouettes and some accessories can vary across the detail transition.

## Verification

- Every current route has exactly three deterministic terrace placements, with safe road/stand/landmark clearance.
- All added geometry retains its triangles through batching; sector groups stay at or below 27 draws per route (15–24 for the new regional families).
- Terrace corner checks use the largest 17-metre quay footprint, and supporting geometry extends below terrain/water level.
- Original character joints, skin weights, finite deformation, standing/seated bounds, facial morphs, pool reuse, distance replacement and resource disposal are tested.
- The root agent inspected the original character fixture and the integrated spectator stand in the real browser renderer. The near fixture contained six fully rendered characters without detached limbs or material failures; the crowd remains visibly stylized.
- Local visual fixtures live under `reports/` and are excluded from production. They do not replace physical phone heat/performance testing or a full game race.

Visual evidence: `reports/completion-crowd-2026-10-02.png`. The 45-metre fixture displayed zero foreground characters, 11 total draws and 14,738 triangles; moving back to the near view restored six character meshes without an observed disappearance or double draw. The focused world/crowd group passed 38 tests. The release report records final build/test results and integrated gameplay verification.
