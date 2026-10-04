# Fjord and nearby-window release — 4 October 2026

## Scope

Norway now has two continuous, glacier-shaped mountain sides in place of ten repeated cones and detached snow caps. The photographed CC0 Marble Cliff 05 color and normal maps are loaded only for this venue. Source attribution, hashes and preparation steps remain in the surface asset directory. Other venues retain their existing texture budget.

Nearby building windows now show view-dependent room depth and restrained interior detail. This uses the existing geometry and material batches, adds no textures or draws, and fades out between 45 and 100 metres. It still adds shader work; there is no new physical-phone GPU/heat measurement.

All 38 circuit previews were recaptured at 960×540 through the actual world renderer. Their manifest records settled crowd requests and GPU texture sampling. Combined size is 1,553,848 bytes. The fixture is a local review tool, not a completed gameplay test.

## Checks completed before publication

- Independent fjord review: 23/23 focused geometry, asset, lifecycle and driving checks pass. Mobile destination geometry is 10 draws / 15,780 triangles; desktop is 10 / 23,716. The nearest sampled mountain vertex is 89.55 m from the road centerline. No driving surfaces, collisions or layouts were changed.
- Window review: 20/20 focused checks pass; the actual shader compiled without a WebGL or console error. Same-camera before/after views were inspected by a second reviewer. These focused sets overlap and are not a combined suite total.
- All 38 preview dimensions, image hashes, unique files, settled asset counts and correct venue map counts pass.
- Production build passed before final release validation. Full predeploy test/build results and publication evidence will be appended below.
- Actual Norway race launched with the McLaren 570S and seven opponents. Automatic acceleration advanced the race; keyboard taps, pause and resume worked; pause cleared inputs. The hidden-browser long-interruption safeguard also paused and resumed safely. This is not proof of sustained held-key or simultaneous physical touches.
- Screenshots checked at 1280×800 desktop, 844×390 landscape, 568×320 compact landscape, and 390×844 portrait. Document dimensions matched the viewport at every checked size. HUD and primary controls were reachable without page overflow. Portrait rotation prompt paused the race; its Back to home action returned to the lobby.
- Garage navigation worked after the race. A local test favourite was changed, persisted through reload, and restored to its original value. No console errors were recorded on that page.
- Local screenshots: `polish-race-desktop.png`, `polish-race-landscape.png`, `polish-race-compact.png`, `polish-race-portrait.png`, `polish-fjord-before.png`, `polish-fjord-after.png`, and the two `polish-window-close-*` images in this directory. These captures are ignored local evidence, not shipped game assets.

## Audio and remaining limits

The user chose freely licensed recordings only. No enquiry was sent, no purchase made, and no related-model source was relabelled as an exact recording. The new AMG GT source audit adds candidate evidence only; runtime audio is unchanged. Verified named base-model coverage remains **5 of 33 cars**, with **28 unresolved**. See `amg-gt-free-source-audit-2026-10-04.md`.

This release improves scenery, but does not establish Asphalt-level realism. Mountain silhouettes, some vegetation and distant crowd representations remain simplified. Browser-size checks do not establish iPhone/iPad heat, sustained frame rate, touch concurrency or physical gyroscope quality. The two original completion targets remain open.

## Publication

Published `d26fe36` to https://camber-reign.web.app/ after **1,121/1,121 tests passed**, zero failures (438.85 seconds), and the production build passed (1.59 seconds). The earlier interrupted deploy had no live process and the new rock endpoint was still 404, so the normal gate was rerun; it was not bypassed.

All **62 inspected live files** match the exact built bytes, covering the JavaScript/CSS bundles, landing page, licences, candidate metadata, all circuit previews, their manifest and all cliff assets. See `fjord-window-live-files-2026-10-04.json`. The published Norway lobby was opened in a fresh browser tab: car, circuit preview and controls rendered, with no reported console errors. Full gate log is retained at `../camber-reign-asset-sources/release-logs/fjord-window-deploy-2026-10-04.log`.

This verifies this visual release. The subsequent user-approved Gallardo candidate is a separate change and is not part of `d26fe36`; its integration and listening decision are recorded separately.
