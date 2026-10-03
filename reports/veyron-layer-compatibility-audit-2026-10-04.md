# Veyron audiovisual compatibility audit — 4 October 2026

**No licenses or runtime behavior changed.** This report checks the actual inputs and code paths behind the prepared Veyron option. It does not grant rights or make the prior proposal effective.

The current inputs support a concrete Veyron-only audiovisual adaptation without an identified incompatible simultaneous third-party layer. The stronger claim that a Veyron presentation inside the whole interactive game is legally a separate work is **not established by the primary CC guidance**. Therefore a user approving the proposed notice would resolve their own licensing choice, but should not be presented as automatically certifying main-game compatibility.

## Actual layers

| Layer | Evidence | Compatibility consequence |
| --- | --- | --- |
| Selected recorded engine | `src/audio.js:166` creates one recorded-engine controller; `src/recorded-engine.js:143` stops old voices on a bank change; its requests and activation are bound to the selected bank. | The proposed Veyron recording does not play simultaneously with a different car's Sonniss bank in this implementation. Existing bank cache contents are not simultaneous audio. |
| Opponent cars, tyres, wind, crowd, impacts and Nitro | `src/race-sound.js:125` builds oscillator/noise voices, and lines 140/204 select synthesized opponent voices. `src/audio.js` and `src/driving-sound.js` author the other synthesis. | These are the project's own generated sounds; no third-party recording was found in these paths. |
| Lobby music and transitions | `src/audio.js:53` gates lobby music off while racing; the music comes from `src/lobby-music.js` synthesis. | No commercial music recording or separate restrictive soundtrack license was found. |
| Veyron and opponent car geometry | All 33 entries of `public/assets/cars/manufacturers/manifest.json` specify CC BY 4.0. Veyron includes matching embedded source attribution to David_Holiday, title “Bugatti Veyron,” and source hash. | CC BY permits adaptation while retaining attribution and modification notices. A ShareAlike adapter's license is possible; the original model licenses remain identifiable. This does not independently prove every upload's authorship beyond the preserved grants. |
| Environment, road, trees and studio lighting | Environment provenance manifests specify Poly Haven CC0 assets. [Poly Haven's license](https://polyhaven.com/license) confirms its assets are CC0. | No ShareAlike conflict. |
| Human spectators | `public/assets/crowd/SOURCES.json` specifies exported MakeHuman/MPFB core CC0 assets. [MakeHuman's FAQ](https://static.makehumancommunity.org/makehuman/faq/are_makehuman_files_free.html) confirms the core-asset grant. | Authoring tool software is separate from the exported assets; the assets introduce no restrictive output license. |
| Track shapes and authored world | `public/credits/f1-circuits-MIT.txt` contains the Bacinger MIT grant; terrain/world composition and animation are project work. | Retain the existing MIT notice where applicable. Project contributions can receive a separate audiovisual adapter's license. |
| Fonts and runtime libraries | Fonts carry OFL 1.1 notices; Three.js is MIT; Basis runtime notices include Apache 2.0 and MIT. The [OFL FAQ 1.1.1](https://openfontlicense.org/ofl-faq/) does not impose OFL on rendered artwork. | Font and library files retain their own licenses. A rendered audiovisual output does not require calling those files CC BY-SA. |
| Other cars' Sonniss sources | [Sonniss GDC v2](https://sonniss.com/gdc-bundle-license/) permits synchronized finished projects but restricts supplying modified or original effects as effects. These sources remain in other car assignments. | Do not sublicense those banks under CC or imply the entire asset collection has a uniform CC license. They are not a demonstrated simultaneous blocker for Veyron-only playback. They matter if the legally relevant adaptation or a published combined sequence includes them. |

## Scope supported by the primary terms

[CC BY-SA 3.0 section 1(a)](https://creativecommons.org/licenses/by-sa/3.0/legalcode) treats synchronization of a phonogram with moving images as adaptation. Section 4(b) allows a same-elements later version for that adaptation and preserves separate collection works. Thus CC BY-SA 4.0 is available for new adapter contributions without pretending the original source grant was 4.0. This is an available option, not a change made here.

The [CC FAQ on adaptations](https://creativecommons.org/faq/#if-i-derive-or-adapt-material-offered-under-a-cc-license-which-cc-licenses-can-i-use) explains that input licenses survive alongside an adapter's license. [CC BY 4.0 section 3(a)(4)](https://creativecommons.org/licenses/by/4.0/legalcode.en) allows adapter terms that preserve recipients' ability to comply with the original. This supports retaining the car models' CC BY grants and notices while applying ShareAlike to the project's audiovisual adaptation contributions. It does not authorize applying CC to someone else's restricted recording.

A clearly bounded standalone Veyron-only audiovisual output or separate demo, using the reviewed recording, CC BY car geometry, CC0 scenery/crowd and original synthesis, is a concrete implementation scope with no identified conflicting input license. It would cover the complete synchronized presentation and its copyrightable project contributions, rather than a WAV-only notice. Independent program code and libraries would retain separate licenses; the CC terms do not impose a source-code delivery requirement.

For inserting the same recording into the full existing game, technical separation helps but is not itself a legal definition of a separate work. The CC documents do not decide whether the whole game's audiovisual component, a play session, or the particular synchronized presentation is the relevant adaptation in every jurisdiction. A label such as “Veyron mode only” cannot settle that question. A gameplay capture that combines Veyron and Sonniss-backed car sequences would also require its own adaptation/collection analysis.

## Decision for the root task

There is **no identified existing third-party license that automatically makes Veyron-only playback impossible**, and no purchase or creator outreach is needed for the recording's own grant. The prior broad Sonniss caveat should not be represented as a proved overlap conflict.

There is also **no basis to promise that a narrow notice and user approval alone conclusively resolve integrated main-game ShareAlike scope**. Approval controls only the rights the user holds. A separate audiovisual scope is substantively clearer, but it is a different deliverable from improving the main game's 33-car audio. Keep the current candidate local unless an appropriate scope is actually selected; continuing CC0/CC BY acquisition avoids this unresolved ShareAlike boundary.

The source remains an identified Veyron Pur Sang departure, with target trim/year unspecified. This compatibility review does not increase shipping match counts or make the single recorded band a complete engine session.
