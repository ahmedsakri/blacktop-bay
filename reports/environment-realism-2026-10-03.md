# Environment realism review — 3 October 2026

The current work replaces disconnected ground and unsuitable floor materials with continuous terrain, connected city plots, dedicated licensed paving and photographed leaf cutouts. Physics, progress and route layouts remain unchanged. Root owns the actual browser review and catalogue capture; this workstream does not commit or deploy.

## Automated evidence

The focused environment group passes **47/47** tests. The final preview, circuit-atlas and lobby presentation checks add **17/17**, for **64/64** relevant checks after capture. Its new checks cover every catalogue route at mobile and desktop detail, parcel and sidewalk-link footprints, coastal/inland terrain under every lane, raycast contact with the actual terrain triangles and bounded geometry/material counts. Existing world-lighting assertions remain unchanged. All 18 surface derivatives pass exact hash/dimension checks and offline verification.

Mobile destination counts are Fuji 13 draws / 15,228 triangles, SF 13 / 13,392, Singapore 7 / 6,352, all inside the existing 20-draw / 16,000-triangle bound. Nine surface maps occupy an estimated 24 MiB desktop / 6 MiB mobile, transferred as 1,703,700 / 380,994 bytes. No new dynamic light or shadow map was added. These are bounded module costs, not total renderer budgets or measured phone frame rates.

## Review-driven corrections

Root's first actual 1280×800 mobile review showed that the old wall photograph produced brown streaks on barriers and that individual geometric leaf fans looked like paper stars. The barrier now retains 24% texture colour with smaller normal amplitude. Crowns now use a CC0 photographed 24-leaf spray with alpha testing at the unchanged 340 mobile crown triangles. Files `reports/polish-fuji-first-review.png` and `reports/polish-sf-first-review.png` are intermediate issue evidence, not final quality claims.

SF review confirmed the continuous landmass was visibly connected, and identified blank house side walls and a floating ramp plane. Side/rear glazing, sills, mullions and chimneys now cover all house approaches; solid ramp wedges reach the road without changing the existing ramp dimensions or physics. Bridge-adjacent houses/trees were removed from the open-water span. Shared inland relief and sidewalk-connected parcels address exposed flat ground.

## Final renderer/capture status

Root inspected the final nine-map Fuji renderer: barriers were visibly cleaner, paper-star foliage was replaced by textured sprays and terrain was continuous. The saved Singapore chase view (`reports/polish-singapore-final-review.png`) showed all nine maps with no browser errors, 117 draws / 112,104 triangles before the final trunk-batching reduction. These are single-camera observations, not worst-case or performance guarantees.

All 38 previews were refreshed from the actual renderer on 3 October at 960×540. Their manifest contains nine loaded maps and nine successful GPU-variation records for every track. Verified image payloads total **1,462,496 bytes (1.39 MiB)**. The three final flagship WebPs were inspected directly after capture; the images show actual connected terrain, paved accesses, modeled landmarks and crowd placement. The receiver was stopped after verification; a listener check confirmed port 4198 was closed. This subagent created no browser tab. Preview hashes, dimensions, camera metadata, uniqueness, current map count and the sub-4-MiB catalogue bound all pass. Root owns final integrated gameplay/build/release verification.

Remaining visual limits include sparse city parcels, shared regional architectural forms and authored low-poly scenery, small stylized ornamental blossom forms, a finite-resolution illustrated distant panorama and bounded alpha-tested foliage. This pass does not establish commercial-game parity or exhaustive device performance. It contains no assets taken from Asphalt.
