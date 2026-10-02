# Garage hierarchy refinement — 2 October 2026

Implemented locally; browser review and release remain with the release owner.

## Reference and concrete gaps

The previous release recorded [1 October 2026 car-selection footage](https://www.youtube.com/watch?v=C3_IhHzMRg4): compact resource rail, prominent three-quarter model, left performance figures, yellow primary action and a selected car strip. This pass compared the saved actual screenshot `/tmp/blacktop-release-2026-10-02/garage-desktop-final.png` with that recorded layout evidence. The footage was not re-opened in a controlled browser during this pass.

The old bottom tray consumed about 210 pixels of an 800-pixel screen. Its 128-pixel car cards and equally tall Race tile competed with the main model; purple secondary buttons, purple cards and purple performance bars had similar emphasis. The car identity combined manufacturer and model into one line and did not show installed build progression.

The official [Legacy of Speed notes](https://asphaltlegends.com/news/legacy-of-speed) were checked as post-2025 context. The older official [Speed Parade notes](https://asphaltlegends.com/news/speed-parade) explicitly describe neutral garage lighting for faithful paint presentation. Existing neutral car lighting is retained. These sources do not establish that our renderer, content or progression system is identical to Asphalt.

## Implemented

- Slimmer 64-pixel desktop rail, narrower information column and shorter car strip give the existing rotatable model more usable screen space.
- Separate manufacturer and model labels, with real stock/current/full 0–20 upgrade status and an accessible progress meter. No invented stars, ranks, blueprints or locks.
- Yellow performance figures use the existing upgraded simulation values. New self-hosted speedometer and acceleration symbols join the steering and Nitro icons.
- Quieter secondary actions and unselected cars; selected car uses a light surface, dark text and yellow edge. Race is a clear 64-pixel action rather than a full-height card.
- Responsive portrait and landscape tray sizing retains touch targets of at least 44 pixels. On the shortest landscape screens the secondary build summary is omitted to leave room for performance and workshop actions; actual upgrades remain available in Upgrades. Long names can scroll with the information panel.
- No changes to driving, camera calculations, licensed car geometry, paint materials, progression, analytics or save migration.

## Verification and remaining review

26 focused tests passed in `/tmp/camber-garage-refinement-tests.log`, including all 33 cars' stock/max performance values, bounded build status, icon resolution, collection and saved-credit behavior. Main JavaScript syntax and whitespace checks passed.

Actual visual checks at 1280×800, 390×844, 320-pixel portrait, 844×390 and 568×320 are still required before publication. Include Lamborghini Countach LP500S, stock/full upgrades, paint, rotation, car switching, Back and Race. This report does not claim those pending checks have passed.
