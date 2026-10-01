# Blacktop Bay expansion — development evidence

Recorded 1 October 2026. This is a factual development and local UI-review checkpoint, not a deployment receipt. The latest driving-pad layouts passed the local review below; the release owner will append final build/test totals and the deployment outcome.

## Scope implemented

- **Ten builds:** the existing four GT and two Formula builds plus **Spectre LM, Spectre LM-R, Cinder R and Cinder RX**. The added closed/open Prototype body profiles are original procedural bodywork; credited GT wheel geometry is reused. The four variants share profiles, rather than representing four independently licensed assets. Visual body revisions may supersede this checkpoint.
- **Five circuits:** Harbor Flow, Dockyard Technical and Coast Run plus **Summit Switchback (about 1.66 km)** and **Bay Grand Prix (about 1.53 km)**. Three laps and three rivals remain unchanged.
- **Paint on all ten builds:** 11 options including Team original and ten curated colours; Gloss, Metallic and Satin finishes. Paint is free and cosmetic, stored separately per car with a session fallback when storage is unavailable. Body material changes preserve tyre, glass and other non-paint materials.
- **Rendering:** original closed/open Prototype coachwork uses clearcoat-capable physical paint. The reported inspection checkpoint found representative Prototype assemblies at **21–22 meshes after material batching**. `batchStaticMeshes` merges compatible static geometry by material while wheel animation remains separate. This is an object-count observation, not a frame-rate or total scene draw-call guarantee; it does not mean the code uses Three.js’s `BatchedMesh` class.
- **Race setting:** all five circuits have covered stands with static instanced seated/standing spectators behind barriers. Bay Grand Prix has a larger grandstand and pits. The start/finish area has a full-width checkered stripe, four numbered starting bays, a branded truss gantry and three twin-lamp countdown columns driven by the existing race countdown.
- **Driving-pad controls:** when pads are visible, hold Gas or Up/W to accelerate and release it to coast. Nitro supplies acceleration and boost together so steering and boost can use two thumbs; Brake overrides Gas and Nitro. Without driving pads, acceleration is automatic. Manual throttle also applies to touch-capable laptops and narrow windows that show the pads; Drift sits beside the right-side pedals. The mobile HUD uses SVG pedals, compact edge-positioned telemetry and safe-area spacing. Portrait gameplay pauses behind the rotation gate.

## Recorded local checks

The release owner reported **117 passing automated tests** at the latest control checkpoint. This is the reported checkpoint total, not a claim that later edits have been retested. Final totals belong in the release completion entry.

Browser inspection covered **1280×720**, **393×852**, **360×640** and **852×393** viewports, followed by the revised driving-pad layouts at **844×390** and **568×320**. The reviewed layouts had no horizontal overflow. Paint selection survived reload and pointer clicks were exercised. In the latest driving check, holding Gas produced actual speed of **39.6 m/s**, braking stopped the car, Nitro consumed boost and steering responded. Rotating to **390×844** paused the race. These are observations of the inspected revisions, not a guarantee for every browser.

The checks used the in-app browser with resized viewports and pointer input. **Physical-device touch behavior and real-device FPS/performance were not tested.** No universal phone-compatibility or frame-rate promise is made.

The guide’s 13 FAQ pairs and six HowTo steps remain matched to visible content, including manual Gas/Up/W when driving pads are visible, automatic acceleration without pads, free paint and local storage limits. AppsOverFlow’s rendered Blacktop guide uses the same control distinction; unrelated site SEO work is preserved.

## Material research and search evidence

Three.js documents `MeshPhysicalMaterial` clearcoat as a separate reflective coating useful for car paint and similar surfaces, and notes its extra rendering cost. The current finish choices vary roughness, metalness and clearcoat parameters; a physical material does not by itself establish realistic lighting or acceptable visual quality. [Official MeshPhysicalMaterial documentation](https://threejs.org/docs/pages/MeshPhysicalMaterial.html), [metalness and roughness reference](https://threejs.org/docs/pages/MeshStandardMaterial.html).

Source implementation is in `src/car.js`, `src/prototype-car.js`, `src/paint.js` and `src/driving-controls.js`. Existing third-party attribution remains in `public/credits/` and `public/assets/cars/`.

The account and HTTP crawl receipts are in `Games/.firebase-indexing-audit/2026-10-01/`, especially [search-console-observations.md](../../.firebase-indexing-audit/2026-10-01/search-console-observations.md). Blacktop Bay’s actual Google sitemap live fetch succeeded at **11:13:22 IST**; the stored report still says **Couldn’t fetch** and the homepage remains unknown to Google. No current resubmission or indexing success is claimed. See [seo-review.md](./seo-review.md) for the exact distinctions and [release-checks.md](./release-checks.md) for historical earlier-release evidence.

## Completion record

Pending the release owner’s final test/build receipt and explicitly recorded deployment outcome. Recheck any source changed after the observations above.
