# Nearby window interiors — 4 October 2026

The former façade and merged glass shaders produced flat lit panes in the close Singapore street view. The new materials trace a simple room behind each nearby window, introducing view-dependent wall, ceiling and floor shading, rear-wall cabinet/picture silhouettes and occasional partial blinds. The existing physical lighting, reflections, fog and tone mapping remain in use. These are shader interiors, not additional room geometry.

## Evidence

- Before: `polish-window-close-before.png`.
- After: `polish-window-close-after.png`.
- Both images are 1280 × 800 captures of the actual renderer at an identical close camera. The root reviewer temporarily restored the previous façade and merged-glass materials for the before capture, then restored the live implementation. This is a local review camera, not a completed gameplay test.
- The root reviewer reported no console errors and WebGL error 0 for the new material. The separate mobile Singapore sector 0.34 view also compiled without console warnings/errors; most buildings there were beyond the 100 m effect range and the broad view remained substantially unchanged.
- Independent image inspection confirms restrained side/ceiling/back-wall shading in lit windows without a visible mirrored-room, clipped-window or mullion regression. Dark unlit panes remain dark, consistent with the existing material. No commercial-game parity claim follows from this change.

## Implementation and cost

- `src/track-surface-materials.js` shares the room calculation between instanced façades and merged glass. Room dimensions are 2.45 × 3.3 × 2.6 m. The effect is full strength through 45 m and fades to zero at 100 m. The ray/box intersection is inside the near-window fragment branch; distant fragments skip it.
- `src/track-world-detail.js` changes the values in the existing glass UV buffer before placement. Small apertures expose a room's center, while wide lobby glazing spans multiple rooms. UV handedness is retained on front/back/side faces after rotation.
- Window geometry, attribute layout, draw counts and texture count are unchanged. The same three static architectural material batches remain. No transparent pass, render target, update loop or persistent time uniform was introduced.
- The shaders add varyings, vertex arithmetic and near-window fragment arithmetic. Unchanged draws do not mean zero GPU cost, and the branch execution cost depends on the GPU. No physical-phone frame-time or thermal measurement was performed. Close views with many lit windows remain the relevant mobile stress case.

## Verification

`node --test tests/window-interior.test.js tests/track-world-detail.test.js tests/urban-district.test.js tests/terrain-surface.test.js`

20 tests passed, 0 failed, 0 skipped, in 7.64 seconds. Tests cover physical window UV scale and orientation, existing buffer reuse, near-window shader branching, retained lighting chunks and opaque depth behavior, and the unchanged architectural batching. The focused diff whitespace check passed. The root reviewer owns the full-suite, build and release checks.

## Coordinated cliff-library support

The same surface library now accepts `rock: true` to add only `rockColor` and `rockNormal`. Other venues retain their original 11 maps. The optional cliff pair reserves 1024² desktop or 512² mobile storage, uses sRGB color and linear normal data, and follows the existing asynchronous load/disposal lifecycle. The focused tests verify 13 optional loads and one disposal per map, plus the unchanged default 11-map path. Asset provenance and Norwegian cliff integration are owned and reviewed separately.
