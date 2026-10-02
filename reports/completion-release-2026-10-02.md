# Completion release — 2 October 2026

This continues the three-release implementation recorded in `releases-1-3-2026-10-02.md`. It closes the limited car coverage, circuit grading and recorded-engine gaps identified in the follow-up audit. Validation and deployment evidence is recorded below. It does not claim that an independent browser game now reproduces another game's production quality.

## Catalogue

All 33 licensed cars have distinct factory finish profiles. All 22 textured sources now have optional GPU-compressed mobile/low-detail derivatives; the 11 material-only sources do not need texture conversion. Geometry, UVs, liveries, optical materials, saved paint choices and attribution are preserved. The strict-CSP decoder, failure fallback, worker limits and bounded cache remain intact.

The 22 derivatives trade a larger total download size (33.29 MB original GLBs versus 50.84 MB optional compressed GLBs) for about 75% lower estimated texture storage at an 8bpp target (300.91 MB versus 75.23 MB across the catalogue). These are catalogue totals; the game loads selected/visible cars through its existing budget. Source geometry detail still varies.

Browser review loaded all 33 cars, including all 22 actual compressed assets under the production content policy, and inspected 66 front/rear views without load, WebGL or JavaScript errors. The review is a local renderer fixture, separate from gameplay and physical-device performance. Contact sheets: `catalogue-finish-01-12.jpg`, `catalogue-finish-13-24.jpg`, `catalogue-finish-25-33.jpg`. Geometry/UV equality and runtime decoder format tests cover the generated assets. See `docs/rendering-release-2-3.md`.

## Scenery and spectators

All 38 circuits now use consistent regional physical lighting, sky grading and reflections. Three safely placed sector landmarks per circuit extend the regional architecture while preserving the three earlier showcase overrides. This is 114 sector landmarks, not 38 independently hand-modelled environments.

A bounded near-character pool replaces the earlier close-up primitive bodies with original articulated meshes, shaped faces, fingers, garment folds and expressive cheering. Distant spectators remain batched. These are stylized authored meshes, not photogrammetric humans. Local browser checks inspected standing and seated crowds, a moving approach, and the near/far transition: the six-person fixture showed 6 near meshes / 7 draws / 36,770 triangles nearby, and 0 near meshes / 11 draws / 14,738 triangles at 45 metres. No obvious double rendering or detached limbs were observed. `completion-crowd-2026-10-02.png` is local fixture evidence, not a physical-phone result.

## Recorded driving audio

Four licensed and credited WAV banks add real engine texture to 11 selected cars, explicitly described as adaptations rather than exact model recordings. Other combustion cars and electric cars retain their existing voices. Runtime downloads total 585,872 bytes across all four banks; only the selected bank is requested. The three-voice, one-request, eight-second deadline and three-bank/3 MiB cache bounds preserve fallback and interruption behavior. Liquid Lines remains the only lobby track. See `docs/recorded-engine-audio.md` for provenance and limitations.

All 47 focused audio tests passed. A real browser OfflineAudioContext rendered the shipping graph and all four WAV banks: peaks 0.5832 / 0.5885 / 0.4035 / 0.5824, all samples finite, and zero pause-tail output. Recorded source counts were 3 / 3 / 1 / 2, with one fetch and one cached bank each. Actual local gameplay separately activated the P1’s Ferrari recording adaptation: 3 voices, 1 fetch, 1 bank, no failed decodes and a completed blend. These checks do not establish subjective listening quality on a physical phone.

## Analytics and crawling

GTM container `GTM-PZHDLVK8` version **4** was published in the authorized account, at **18:49** in the dashboard. All nine added gameplay/performance events and parameter mappings are present in the public production container. Hostname and analytics-consent requirements are preserved; advertising consent remains denied.

A production-browser test temporarily allowed analytics, loaded the lobby and started a race. The Google collection endpoint returned HTTP 204 for `load_ready` with both lobby and race stages, `race_start` and `race_pause`, carrying the expected game, circuit and vehicle. The previous denied preference was restored through the privacy UI and the disable flag confirmed. The authenticated GA4 Realtime dashboard then confirmed two `load_ready` events, one `race_start` and one `race_pause`, plus the Camber Reign page view. The drill-down exposed the expected circuit and duration parameters. Reporting-side receipt is verified for these exercised events.

The live sitemap returned HTTP 200 with `application/xml`. All **77** listed pages returned HTTP 200, the expected self-canonical, and no page-level noindex. Robots permits crawling and points at this sitemap. Live ads.txt contains the correct publisher line. The detailed public audit is saved locally as `completion-crawl-audit-2026-10-02.json`.

After the user unlocked the Mac, authenticated Safari checks confirmed:

- **Google homepage: indexed.** URL Inspection reports “URL is on Google” and “Page is indexed” for `https://camber-reign.web.app/`. The sitemap dashboard separately still says “Couldn’t fetch”, unknown type, zero discovered pages. No redundant resubmission was made, and homepage indexing is not represented as all 77 pages being indexed.
- **Bing sitemap: Success.** One known sitemap, zero errors/warnings and **77 discovered URLs**, last crawled 2 October. Discovery is not an indexed-page count.
- **AdSense: Review requested**, request time **02 Oct 2026 08:14**; status Getting ready. No approval is claimed. Its sites list still reports ads.txt Not found despite the live file returning the correct publisher record. The review is already submitted; there is no new request or approval to fabricate.

Account screenshots remain local: `completion-gtm`, `completion-ga4`, `completion-search`, `completion-bing` and `completion-adsense` (all dated 2026-10-02). No account screenshot or private account export is included in the public source push.

## External validation limits

A physical iPad/iPhone sustained race, simultaneous touch/Nitro, gyro and heat test still requires an unlocked inspectable device. Safari’s Apps and Devices window detected iPhone/iPad entries but showed “No inspectable contents”; the user has been asked to unlock/open the game with Web Inspector enabled. Desktop-sized browser tests are not substituted for that evidence.

Native Chrome backup download and restore both passed on the isolated localhost test game. The 8,961-byte JSON was selected through the actual macOS Open file picker. After a deliberate test upgrade changed the save to 1,000 credits / engine level 1, Restore & Reload returned the original McLaren P1 GTR, 1,200 credits, 184 km/h and 0/20 upgrades. No production progress was changed. Backup round-trip, malformed-file rejection, transactional restore and storage-failure tests also pass. The game needs no sign-in for save transfer.

## Integrated release checks

- Full combined suite: **1,007 passed, zero failures/skips**, 533.20 seconds. Production build passed. Firebase repeats its configured full test/build gate before publishing.
- Actual local gameplay on desktop: lobby loading, race start, driving, visible barrier contact, pause, home return and the selected recorded engine layer worked without a renderer or audio error. This is separate from the fixture reviews.
- Browser layout checks passed at 1280×800, 390×844, 844×390, 568×320 and 320×700. Compact landscape gameplay retained steering, Nitro, pause and HUD. Portrait uses deliberate internal lobby scrolling; primary actions remain reachable and document width stays within the viewport.
- Fixed inherited tiny footer typography discovered at 320 px. Footer links now use 11 px supporting text with 44 px targets. Final visual inspection confirmed the race action above the bottom navigation.
- Regional renderer checks inspected safely positioned Sakhir and Marina Bay terraces; near/far crowd checks and catalogue contact sheets are recorded above. These development fixtures are excluded from the production build.
- Source implementation **06835f8** was pushed to GitHub `main`. Firebase's mandatory predeploy rerun passed **1,007/1,007**, zero failures/cancellations/skips, in **362,155.915167 ms**; the build completed in 1.02 seconds. It published 312 files, with 100 new uploads.
- Hosting version **75667ccffcab2b2c** was released on **2026-10-02 at 17:36:56.180 UTC** at `https://camber-reign.web.app/`. The shipping game bundle is `game-CVnE6tE1.js` (1,226.02 kB; gzip 387.55 kB). The existing large-chunk advisory remains.
- The live root is byte-identical to the build (SHA-256 `bc61d01cfe8da336a51291f3589df7a2db0ae9bf8c5d3ae7df6f10636ade48e6`). All 34 checked public assets returned 200; all four downloaded engine WAVs match the built bytes. Development fixtures returned 404. Production CSP remains unchanged, without JavaScript unsafe-eval.
- Live **1280×800**: correct high-detail P1, loaded state, enabled Race Now, no document overflow or console warnings/errors. Live **390×844**: Ferrari Enzo fetched its new KTX2 derivative and the fingerprinted decoder, with no original fallback; correct textured model visible, no overflow or console warnings/errors.
- Live **844×390**: the Enzo entered an eight-car Harbor race, resumed after the existing long-interruption safeguard, advanced to 22 seconds / 6% progress and returned home through Pause. The visible renderer, barrier feedback, grandstand, map, steering and Nitro controls remained intact. Credits stayed at 1,200; selected P1 and muted sound preferences were restored. This is a browser-size smoke check, not physical-device performance evidence.
- Local live captures: `completion-desktop-2026-10-02.png`, `completion-mobile-garage-2026-10-02.png` and `completion-mobile-2026-10-02.png`. Account evidence remains local and excluded from public Git. Physical-device performance remains unverified as described above.
