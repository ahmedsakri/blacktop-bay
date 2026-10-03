# Track, crowd and recording upgrade — 3 October 2026

This release improves the existing game. It does **not** establish Asphalt-level visual parity or exact-model recordings for all 33 cars. Those two requested targets remain incomplete; the evidence below distinguishes shipped improvements from remaining asset work.

## Shipped changes

- Continuous coastal terrain and connected inland relief replace isolated platforms and mounds. City buildings have paved lots and sidewalk connections. SF houses gain windows on previously blank sides and rear walls, plus roof detail. Ramp bodies now reach their supports.
- Photographed CC0 paving and leaf cutouts complement the road materials. Concrete staining is restrained. Nine surface maps load in each detail tier, with approximately 6 MiB / 24 MiB estimated GPU residency for mobile / desktop.
- Textured middle-distance human meshes replace primitive people near the road: up to 48 mobile / 108 desktop, with six shared wardrobes, clothing-only tints and independent gesture phases. Detailed foreground pools remain six / ten. Hands, weight shifts and cheering recovery are refined. Distant simplified representations and safe loading fallbacks remain.
- All 38 circuit previews were recaptured from the actual renderer. The 1,462,496-byte catalogue records camera poses, hashes and nine-map GPU evidence. No concept-art image is passed off as a gameplay screenshot.
- Seven Pole Position Production studio banks improve eleven car assignments. The 570S Coupé, Aventador and Testarossa use recordings of those base models; year/trim omissions remain explicit. 458, R8, GT-R and AMG GT improve to closer documented model families or variants. There are now 23 retained banks / 20 active. The approved softer mix and voice/cache limits are unchanged.
- The user clarified that “remove credits” means the Credits/attributions page, not currency. The game footer's Credits link is removed. Required attribution moves to `/licenses/`, accessible from the privacy/guide pages. Exact redirects preserve former `/credits` and `/credits/` links. The individual MIT notice remains available. The race wallet, upgrades and saved balances are unchanged.

## Verification

- Environment, spatial and preview groups: 64 passing checks. Crowd group: 25 passing checks. Audio group: 54 passing checks; all 23 bank derivatives reproduce their manifest hashes from the reviewed original files.
- Actual browser renderer: all 38 captures loaded nine maps, with no recorded renderer errors. Fuji, Singapore and SF were inspected at road level. The final clothing shader displayed six detailed and 36 textured middle-distance people without shader errors or broken anatomy in the local fixture.
- Integrated local race: all nine maps and the new crowd tier loaded, countdown and automatic acceleration ran, and pause/resume worked. The heavily loaded Mac triggered the existing long-interruption auto-pause during initial review; this is not evidence of a sustained performance or real-phone pass. No shader/context-loss errors were observed.
- Landscape browser layout at 844 × 390: no horizontal overflow or document scrolling; steering and Nitro remained visible. This is browser emulation, not a new physical iPhone/iPad or heat test. A 390-pixel-wide Licenses page also has no horizontal overflow.
- Actual Offline Web Audio graph: all 33 cars / 20 active banks passed. Maximum peak 0.5562003; maximum recorded-to-synthesis RMS ratio 0.9591368. Correct bank selection, bounded voices/requests/caches, finite output and silent pause tails. Numeric analysis does not replace headphone/phone listening.
- Full required Firebase predeploy test/build and public-release verification are recorded below after completion.

Local visual/audio evidence (not shipped): `polish-realism-crowd-final.png`, `polish-fuji-final-review.png`, `polish-singapore-final-review.png`, `polish-integrated-race-desktop.png`, `polish-integrated-landscape.png`, `polish-authentic-audio-33.json`, and `polish-testarossa-mix.wav` in `reports/`.

## Remaining work toward the requested targets

The city scenery remains comparatively sparse; distant people, ornamental blossoms and some building shapes remain stylized. The photographic panorama is finite-resolution and does not become explorable geometry. More authored environment assets and lighting work are needed before claiming commercial-game visual parity.

Some recordings are still related-car substitutes. The Veyron, i8, R18 and 919 have explicit engine-layout mismatches. Exact recordings for the remaining represented models, years and variants require further verified source acquisition; paid previews, ripped game audio and unverified uploads were not substituted for licensed originals. See the complete [audio audit](recorded-engine-authenticity-2026-10-03.md), 33-car `ENGINE-COVERAGE.json` and 42-decision `ENGINE-CANDIDATES.json` for the specific gaps and reviewed acquisition candidates. No purchases were made.

The new recordings are licensed for use within this game; they are not offered as an independently reusable sound library, asset pack, template or SDK. Original studio takes remain outside the public repository. Existing Creative Commons attributions are preserved.

## Release result

Firebase Hosting deployment to `https://camber-reign.web.app/` completed successfully on 3 October 2026. The required predeploy suite passed all 1,067 tests with zero failures, and the production build succeeded.

Public-release verification checked 77 changed files/pages against their release-content hashes; all matched, including the generated sitemap. Both `/credits` and `/credits/` return HTTP 301 to `/licenses/`; `/credits/f1-circuits-MIT.txt` still returns HTTP 200.

The live browser loaded the lobby with Race Now enabled, the existing wallet visible, no Credits navigation link and no recorded browser errors. The live screenshot is `reports/polish-live-lobby-final.png`; the asset-verification evidence is `reports/polish-live-assets.json` (local QA evidence, not shipped).
