# Mobile render quality

Automatic mobile rendering starts with a sharp, bounded drawing buffer rather than the Performance preset. Touch controls do not imply that a device must start at the lowest visual quality. The controller uses rendered frame intervals during active racing to reduce expensive work when necessary; it does not measure temperature, battery drain or GPU utilization.

## Starting policy

| Auto profile | Starting DPR cap | Drawing-pixel budget | Shadows | Roadside distance scale |
| --- | ---: | ---: | --- | ---: |
| Standard, including missing browser hints | 1.60 | 2,000,000 | On | 1.00 |
| Constrained: reported memory ≤2 GB or ≤4 logical cores | 1.35 | 1,200,000 | Off | 1.00 |
| Capable: reported memory ≥8 GB and ≥8 logical cores | 1.75 | 2,400,000 | On | 1.10 |

Memory and logical-core hints are conservative starting hints, not graphics benchmarks. Missing hints use Standard. Automatic mobile mode leaves bloom and the reflection pass off; the sharper buffer and directional shadows supply the initial improvement without enabling every expensive pass. Device DPR remains an upper bound.

For a viewport of `width × height` CSS pixels, the drawing ratio is capped by `sqrt(pixelBudget / (width × height))`. It never falls below 1×. Consequently, if the CSS viewport alone exceeds the profile's budget, its CSS pixel count is the effective minimum allocation. Rotation preserves the pixel budget because width and height contribute only their product.

At Standard settings a 390×844 phone changes from DPR 1.0 (329,160 pixels) to DPR 1.6 (about 842,650 pixels), with shadows and a 25% longer starting roadside detail distance. A 1024×1366 tablet starts at approximately DPR 1.196 and at most two million drawing pixels, rather than attempting its native DPR 2 or 3. These are allocation calculations, not measured physical-device frame rates.

## Sustained-load behavior

The existing 2-second warmup, 2-second p75 observation windows, downgrade cooldown and slow recovery remain in place. In mobile Auto:

1. First sustained slowdown removes shadows and reduces distant-detail work. Drawing sharpness stays unchanged.
2. Second slowdown reduces drawing ratio to 82% of the viewport-capped starting ratio and reduces distant detail further.
3. Third slowdown uses exactly DPR 1.0 and the smallest automatic detail distance.

The automatic mobile controller cannot make a phone render below one drawing pixel per CSS pixel. A standard phone's four DPR states are 1.60 → 1.60 → 1.312 → 1.00. Pauses, menus, hidden tabs, intentional battery-saver frame caps and isolated loading hitches are excluded from adaptation by the caller.

## Explicit settings and source geometry

Performance remains DPR 1 with expensive passes disabled. Balanced and High retain their explicit effect choices. Mobile High is capped at DPR 1.75 and three million drawing pixels, and is not silently downgraded by Auto's controller.

`qualityGeometry(choice, {mobile})` returns `{worldLow, carLow}`. Mobile Auto/Balanced and explicit Performance use low source geometry; explicit High returns `false` for both fields, independent of touch controls. Desktop Auto/Balanced retain high source geometry. The game reads this helper at startup and uses the selected tiers for the world, player assets, garage and effects. Vehicle selection keeps the source tier loaded for that session. Rival cars retain their bounded low near sources and actual distance tiers. This is separate from live resolution/effect changes: changing an already-built renderer cannot invent geometry or textures that were never loaded.

Source differences are real and model-dependent. The Ferrari 458 high source has 358,788 triangles versus 199,681 in its low source. McLaren P1 sources both have 71,888 triangles, but the high source is 2.33 MB versus 1.43 MB for low, reflecting texture/detail differences. No silhouette is substituted by the quality policy.

## Implemented integration and checks

`main.js` initializes the adaptive controller from the viewport width/height, device DPR, saved choice, and optional memory/core hints. Its first renderer allocation uses the controller's computed pixel ratio. Resize updates the same inputs before applying quality, recomputing the pixel budget without erasing the observed performance level. The touch-device helper recognizes tablet touch capability independently of viewport width, so landscape tablets receive the mobile budget and controls.

Changing Graphics in settings immediately updates sharpness, rendering passes and distance detail. If the requested source tier differs from the loaded session, settings show **RELOAD GRAPHICS**, together with a notice that reloading ends an unfinished run while saved credits and progress remain. The page does not reload automatically. The chosen source tier is then used for the next world/player construction. Switching between choices that use the same source tier does not offer an unnecessary reload.

A browser check at 1366×1024 with touch capability simulated as `maxTouchPoints = 5` selected the Capable mobile Auto profile at approximately DPR **1.3099**, bounded by **2.4 million** drawing pixels. This checks the actual viewport/quality integration in a desktop browser; it is not physical iPad hardware evidence.

Eleven focused quality/spatial tests passed. They cover phone/tablet budgets and rotation, optional and invalid hints, manual choices, high-source policy, degradation order, the 1× floor, pause/hitch exclusions, recovery, viewport reconfiguration, and distance-culling compatibility. Physical-phone sustained frame rate, heat and battery behavior still require device measurement; no such measurement is inferred from the browser simulation or automated tests.
