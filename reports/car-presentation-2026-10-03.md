# Garage car presentation refinement · 3 October 2026

## Implemented

- Neutral charcoal architecture with a narrow violet display band. The band occupies about 9.5% of the wall height, compared with 36% before; its contribution is reduced from 0.85 to 0.42. The floor accent opacity is 0.045, previously 0.14. The approved violet remains `#9246FF`.
- The photographed studio retains all radiance below luminance 3. A hue-preserving shoulder softens values above that threshold, approaching 12 without clipping them. The included source's measured peak falls from 519.70 to 11.84, and its mean from 0.717 to 0.528. Neutral key, rim and fill lights preserve body shape with less warm/cool colour contamination. Selected paint colours, finish parameters, glass and livery maps are unchanged.
- One analytic contact-shadow surface fits four actual wheel pivots and their measured dimensions. It turns with the selected car, updates only when the car changes, and combines tyre contact with a softer underbody falloff. This remains visible when adaptive quality disables shadow maps. Missing or invalid wheel data hides the shadow.
- Two scales of derivative-filtered rubber grain supplement 13 verified, dedicated tyre material slots. No tread grooves are fabricated for slick tyres. Authored tyre normal/bump maps, mixed body/wheel atlases, logos and interior rubber retain their source materials. Distant and ghost cars skip the extra shader work. Every opted-in slot is verified against both shipping detail levels.

## Bounded costs

| Resource | Mobile | Desktop |
| --- | ---: | ---: |
| Existing architecture | 14 draws / 3,234 triangles | 14 draws / 5,474 triangles |
| New contact shadow | 1 draw / 2 triangles | 1 draw / 2 triangles |
| New shadow textures or render targets | 0 | 0 |
| HDR source retained after decode | 512×256 RGBA half float / 1 MiB | 1024×512 RGBA half float / 4 MiB |
| Photographic PMREM cube face | 128 px | 256 px |
| Existing directional shadow map | 1024×1024 | 2048×2048 |
| New real-time lights | 0 | 0 |
| Tyre shader texture fetches added | 0 | 0 |

HDR processing runs once after the bounded download. Mobile downsampling averages linear radiance before applying the shoulder. The photograph is retained for context restoration; environment targets still replace and dispose atomically. Failed downloads retain the procedural studio, and late downloads cannot revive a disposed environment.

## Checks

40 focused automated tests passed across garage geometry/contact fitting, HDR colour and memory bounds, environment failure/disposal/context restoration, manufacturer loading and source ownership, paint restoration and tyre-role preservation. `git diff --check` passed.

The first integrated WebGL review found that `patch` is a reserved GLSL identifier in the contact-shadow shader. It was renamed to `footprintUV`; the 13 focused garage, studio and tyre tests passed again. Integrated browser recompilation passed after that fix; subsequent actual car/garage renders produced no new shader error. Source-level tests alone do not compile GPU shaders.

This report records implementation and automated evidence. Actual desktop/mobile renderer review, navigation, paint selection and context restoration smoke checks are recorded by the integrating review; they are not claimed as completed by the unit tests. The effect is presentation-only and does not change driving, progression, or licensed source geometry.
