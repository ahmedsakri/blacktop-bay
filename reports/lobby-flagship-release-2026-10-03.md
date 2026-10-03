# Lobby, car and flagship circuit polish — 3 October 2026

## Delivered behavior

- Neutral garage, softer HDR reflections, actual-wheel contact shadows and rubber microdetail on verified tyre materials; authored liveries/glass and physics remain unchanged.
- All 38 circuits have a unique 960×540 WebP captured from the actual game renderer. Preview set is 1,776,194 bytes; only selected lobby artwork is loaded there. Route shapes are brighter; “Change circuit” is explicit. The circuit browser uses these same real scenes.
- The installed-upgrade count opens the selected car's workshop. A real local purchase was checked: credit deduction, installed count, performance update and reload persistence.
- Race, Time attack and Tour are directly available in lower navigation beside Career and Circuits. Duplicate mode cards are removed from settings. Settings now focus on difficulty or solo targets/ghosts, while Tour continuation remains accessible. Opening/closing settings preserves a selected career event; actually changing difficulty explicitly leaves that event. A single race action remains prominent.
- Goals show actual objective, saved progress and the actual next unlock. Completed career flows into selected-car mastery, then circuit browsing. No invented currency reward. Closing a goal returns focus to the goal button.
- Nine modeled landmarks across Fuji Skyline, San Francisco Hills and Singapore Afterdark, finished garden/terrace sites, supported access walks and gaps only in decorative outer railings. Solid race barriers and progression are unchanged. Singapore's broad ground no longer magnifies repeating wall stains.
- GranTurismo S and S63 AMG recordings replace unrelated Mustang-family substitutions; source identities and limitations appear in public credits. All 33 cars use 15 active recording banks (16 bundled, one legacy bank unassigned).
- Initial samples were rejected by the user as harsh/synthetic. The revision makes recordings more prominent, reduces procedural harmonics/turbine, narrows pitch variation, smooths shifts and softens Nitro. The user approved the revised samples: “Yes, this sounds better.” That acceptance is based on the explicit listening reply, not the numeric checks.
- Player-facing “Tilt” labels now read “Gyroscope” in settings, HUD, help, guide, structured data and crawler copy. Internal sensor logic and persisted identifiers are retained.

## Integrated checks

Browser-sized layout reviews: 1280×800, 390×844, 844×390, 568×320 and 320-pixel portrait. Long San Francisco Hills name, real selected image, direct workshop, purchase/return/reload, circuit search/selection, goal focus return, Gyroscope button sizing, and reduced-motion layout checked. No horizontal page overflow or blocked primary action found. Phone portrait and short landscape retain intentional content scrolling; navigation does not shrink action targets below 44px.

The five-choice navigation was checked again at 320-pixel portrait and 568×320 landscape. Tour selected the real eight-car field, difficulty changed the displayed state, and closing settings restored focus to its opener. Solo targets and ghost/stock controls remained available without a disabled rival selector. Navigation targets measured 62×68px at the narrowest portrait and 109×52px in compact landscape. The integrated navigation/settings/dialog/presentation/Tour test subset passed 56 tests.

A tiny-landscape inherited style initially hid both circuit labels; overridden and checked again. The contact-shadow shader initially used a GLSL-reserved identifier; corrected and actual WebGL recompilation checked, with no new shader errors. All three flagship fixtures compiled/rendered with no console warning/error; six surface maps have nonconstant GPU readback evidence.

A real game route was entered and countdown/pause/recovery navigation checked. Background automation triggered the game's long-interruption pause, so this is not represented as a sustained race or physical-device performance test. iPhone/iPad sensor accuracy, heat and endurance were not remeasured in this release.

Final browser audio rendering: 33 cars / 15 active banks, all finite; maximum peak 0.556661, maximum RMS ratio 0.945421 relative to the revised synthesis-only baseline. Correct bank mapping, bounded voices/cache/fetches and silent pause tails passed. New source loops reproduce their recorded hashes.

Full release-gate results and production verification are appended after deployment.

## Limits

The three tracks remain original, stylized arcade environments. This work does not establish Asphalt-level visual parity, exact brand/model engine recordings for every car, physical-phone performance, or exhaustive headphone/speaker coverage. The user approved the two revised samples, but their playback device was not specified. Veyron, Testarossa and Rimac proxies are documented in the audio source report. Vehicle models and their authored texture quality remain heterogeneous.

Local proof: `polish-lobby-desktop.png`, `polish-lobby-568-landscape.png`, phone/landscape captures, `polish-audio-validation-v2.json`, and two `polish-*-audio-v2.wav` listening renders. Those generated review media are local artifacts, excluded from production and Git; source, reproducible fixtures, licensed banks and circuit previews are committed.
