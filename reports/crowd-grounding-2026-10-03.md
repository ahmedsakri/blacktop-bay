# Crowd contact review — 3 October 2026

Baseline: deployed `9df221e`, live race image `reports/polish-free-live-race.png`.
The capture shows the actual Fuji starting grid, not an isolated crowd fixture.
At that camera distance, textured spectators are recognizable but small; chair
contact and consistent body scale matter more than another facial texture.

## Measured defect

The near rig posed every standing pelvis at 0.84 m, even though fitted source
pelvises range from 0.726 m to 0.966 m. The shorter rig could not reach its floor
target without stretching its legs, so the two-bone solver left its shoes in the
air. Longer rigs instead crouched and some soles intersected the floor. Seated
pelvises were always 0.48 m above the floor and then scaled with the whole body,
independent of the chair's fixed top.

Measurements below use the actual skinned body mesh at unit stature, quiet
watching, time zero. Values are metres above the row floor, not renderer pixels.
The seated support sample is the fifth percentile of central lower-body surface
vertices in a fixed pelvis-region box; it is an indicative garment/contact
sample, not a cloth collision solver. The main chair top is 0.455 m. The paired data and exact sampling region are
in `reports/crowd-grounding-measurements-2026-10-03.json`.

| Wardrobe | Standing sole before | Standing sole after | Seated support before | Seated support after |
| --- | ---: | ---: | ---: | ---: |
| Blue shirt | 0.0063 | -0.0003 | 0.4082 | 0.4602 |
| Light tee | -0.0287 | -0.0007 | 0.4119 | 0.4783 |
| Striped shirt | -0.0105 | -0.0013 | 0.3923 | 0.4559 |
| Olive jacket | -0.0166 | 0.0004 | 0.3718 | 0.4540 |
| Wine blouse / skirt | -0.0111 | -0.0002 | 0.3896 | 0.4470 |
| Sport | 0.1039 | 0.0019 | 0.3899 | 0.4508 |

## Correction

The live rig calibrates each shoe sole once from foot-weighted source geometry,
then preserves the imported standing inseam with slight knee flexion. Hand
positions follow the rig's resulting torso height. Seated pelvises use a fitted
wardrobe support offset above the caller's chair top, independently of stature;
feet remain on the row floor. The main chair defaults to 0.455 m, and the paddock
uses 0.39 m.

The instanced middle/far shader carries a seat-height offset in the fourth
component of its existing frame attribute. It adjusts the lower leg region,
leaving shoe soles fixed and matching the pelvis height above the chair. Normals
use the corresponding inverse derivative. This adds 11,520 bytes across the
fixed mobile middle/far instance buffers, with no added draw calls or textures.
The limits remain 6 near, 48 middle and 112 far.

## Verification status

- 31 focused crowd tests passed with the regenerated palettes. Actual near
  shoe vertices are tested across heights 0.91 and 1.08, both chair types, four
  gestures, standing/seated, and two motion times. A second regression applies
  the actual half-float palettes to middle/far shoe vertices and placement.
- The six motion palettes remain 488,448 bytes each, 2,930,688 bytes total.
  All 24 file hashes and byte lengths match SOURCES.json; total active crowd
  downloads remain 13,247,104 bytes. All tier requests use the same updated
  `2026-10-03-grounded24-v2` cache version.
- Shoe calibration is cached per source and is absent from the animation loop.
- Geometry, image assets and their licensed sources are unchanged.
- Root reviewed the actual WebGL close-rig standing/seated view before the
  palette rebake and confirmed coherent shapes and corrected sport shoe
  contact. Standing capture: `reports/polish-crowd-standing.png`.
- The actual middle palette's tested sole minima range from -0.92 mm to
  +5.34 mm. The 770-triangle far mesh shares this palette; its decimated shoe
  edges range from -18.04 mm to +5.34 mm. Tests bound middle contact to 8 mm
  and far contact to 25 mm rather than allocating a separate far palette.
- Textured crowds receive existing environment shadows without casting new
  crowd shadows. On 4 October, the integrated desktop start-line renderer loaded all 18 crowd requests, displayed 8 near / 108 middle / 204 far textured people, and reported no GL or page errors. An actual race separately ran with loaded distance crowds; shadow reception did not produce a shader error. The fixture review does not
  establish real-phone frame rate or parity with a commercial racing game.
