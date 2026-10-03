# Recorded engine authenticity audit — 3 October 2026

Seven new studio recordings, one CC0 Elise source and one CC BY 250 GTO source improve thirteen of the 33 car assignments. The studio takes are recorded by Pole Position Production and appear in the official free Sonniss GDC bundles. The later Elise source is by victormalloy; the 250 GTO source is by Provo rossi. This is **not 100% exact model/year/variant coverage**. Five base-model matches are now present (570S Coupé, Aventador, Testarossa, Elise, 250 GTO); source or target year/trim/build omissions prevent a fully certified exact-specification claim. Four wrong-layout substitutes remain: Veyron, i8, R18 and 919 Hybrid.

The [continued acquisition review](recorded-engine-acquisition-followup-2026-10-03.md) records the later Elise and 250 GTO additions, 25-bank totals and the free-only acquisition decision. Vendor enquiries were never sent. The studio-source verification results below retain their original scope.

## Implemented sources

| Recorded vehicle | Bundle / source perspective | Assignment and limit |
| --- | --- | --- |
| [2016 McLaren 570S Coupé](https://pole.se/product/mclaren-570s-2016/) | GDC 2020; exhaust-right DPA4062 | 570S model/body match; target year unstated. Related-model proxy for Senna, P1 GTR and 650S GT3. |
| [2014 Lamborghini Aventador](https://pole.se/product/lamborghini-aventador-2014/) | GDC 2020; exhaust-right DPA4062 | Replaces Murciélago with Aventador; target year/trim unstated. |
| [2013 Ferrari 458](https://sonniss.com/sound-effects/ferrari-458-2013/) | GDC 2020; intake-left DPA4062 | Replaces Ferrari 355. Does not certify the game's Spider body variant. Embedded library artwork depicts a coupé; the separate straight-pipes product is not evidence for this original session. |
| [2017 Audi R8 FSI 5.2 V10](https://pole.se/product/audi-r8-2017/) | GDC 2020; engine-right DPA4061 | Replaces Huracán for R8 Custom and R8 LMS. Custom build remains unknown; road R8 remains a variant proxy for the 2019 race car. |
| [2012 Nissan GT-R R35](https://pole.se/product/nissan-gt-r-r35-2012/) | GDC 2020; engine left/valve DPA4062 | Replaces Chevrolet Traverse. Source has a modified performance exhaust and differs from the game's 2018 year. |
| [2018 Mercedes-AMG GT R](https://pole.se/product/mercedes-amg-gt-r-2018/) | GDC 2019; interior DPA4021 | Replaces S63 AMG; GT R is still a variant proxy for GT. |
| [1990 Ferrari Testarossa](https://pole.se/product/ferrari-testarossa-1990/) | GDC 2023; engine mix, steady RPM take | Replaces the unrelated Ferrari 340 America V12 with Testarossa flat-12. Target year unstated. |

Each original filename was checked against the [official bundle catalogue](https://sonniss.com/gameaudiogdc/) and its linked tracklist: [2019](https://docs.google.com/spreadsheets/d/1-McgwdktLVmctBrI4OGbgIBxeCp0A4KyKJzxOOTP6FY/edit), [2020](https://docs.google.com/spreadsheets/d/1QqIcxJ7y0Acq3HAj9qQvFgvyeBjJ_7JvX8-GguUHIVk/edit), [2023](https://docs.google.com/spreadsheets/d/1HAJdNA-QIug2IZjUV-DwCo1IZ-XJ4Vv9gWIaumNScfc/edit). Original WAV metadata independently identifies vehicle, microphone perspective, Pole Position authorship and copyright. The download mirrors provide transport, not a separate rights grant. Original WAV SHA-256 values and processing intervals are recorded in `public/assets/audio/ENGINE-SOURCES.json`.

The public main download host returned HTTP 403 and one official mirror timed out. The listed Your.Org mirror exposes extracted 2019/2020 originals; the 2023 Testarossa original was retrieved from an extracted mirror and matched to the official tracklist and embedded metadata. No huge source archive or original studio take is stored in the repository. Source originals, extracted artwork and analysis images remain under `/tmp/camber-exact-audio/` for this local review.

## Rights and distribution

These seven banks use the [Sonniss GDC license v2](https://sonniss.com/gdc-bundle-license/), effective 27 August 2026, which governs the new downloads. It grants commercial game synchronization and modification. It does not grant distribution as a standalone sound-effect collection, asset pack, project template or SDK, including edited sounds. The prepared loops are incorporated game assets with separate rights; the public game's source-code license must not be presented as relicensing them. Raw studio assets and attached photographs are not shipped. AI training is excluded. No attribution is required by this grant, but a courtesy credit and the separate asset restrictions are included in `LICENSES.txt` and supplied to the root task for `/licenses/#recorded-engine-audio`.

Existing CC BY attribution remains required. No purchase, new account, copyrighted-video extraction or unknown-license source was used.

## Complete scope and unresolved recordings

`public/assets/audio/ENGINE-COVERAGE.json` inventories all 33 cars against their visual source, actual recorded vehicle, fidelity, rights/readiness and checked candidate IDs. `ENGINE-CANDIDATES.json` stores the supporting decisions. The identity test requires exactly one coverage row per catalogue car and checks every selected bank/source/license against the shipping manifests.

- **Veyron:** Murciélago V12 remains a wrong-layout substitute for W16. The identified Commons Pur Sang recording has a genuine author-granted CC BY-SA 3.0 first revision (despite an older NC tag in its media metadata). It is therefore a conditional share-alike compatibility candidate, not falsely classified as unlicensed. [Original grant](https://commons.wikimedia.org/w/index.php?oldid=26854616), [license](https://creativecommons.org/licenses/by-sa/3.0/legalcode). Synchronization/adaptation obligations were not silently extended to this game.
- **BMW i8, Audi R18, Porsche 919:** source layouts remain Audi I4, BMW diesel I4 and Audi I4 respectively, instead of i8 I3, R18 race V6 diesel and 919 V4 hybrid. Exact authorized downloads were not established in the checked catalogues. [BMW](https://www.press.bmwgroup.com/united-kingdom/article/detail/T0145575EN_GB/the-new-bmw-i8-%E2%80%93-the-future-supercar-now), [Audi](https://www.audi-mediacenter.com/en/press-releases/unique-tdi-engine-for-the-audi-r18-tdi-1350/download), [Porsche](https://newsroom.porsche.com/en/motorsports/porsche-world-premiere-monza-919-hybrid-2017-le-mans-prototype-13583.html).
- **Rimac Concept One / Nevera:** Tesla Plaid recording remains explicit. A manufacturer promo player is not a recording redistribution grant.
- **Senna / P1 GTR / 650S GT3:** 570S is a closer documented turbo McLaren source, not an exact engine/session. The free mixed GT race take listing 650S was not isolated or relabeled as a clean McLaren bank.
- **One:1, Zonda C12, T.50, One-77, M3 E46, Countach LP500S, Enzo and Quattro Rally:** unchanged documented proxies. Different named trims, incomplete engine-build metadata, noncommercial-only clips, mixed race fields or missing original provenance prevent exact claims.
- **930 Turbo / 911 GT3:** generic 911 recording remains explicitly unverified. The available 997 GT3 RS source differs from the named GT3, has an unspecified target generation and a creator listing that combines 2008 with a 4.0-litre engine without explaining the build. Its free slow-driving excerpt was downloaded for review but not shipped. 911 ST 1972 and SC 1981 do not establish 1975 930 Turbo.
- **GranTurismo MC Stradale, Gallardo 2004 and Huracán:** existing GranTurismo S, Huracán EVO Spyder and EVO Spyder sources remain. The reviewed free Huracán 2014 exterior blip take did not establish a target-variant match or supply a better steady high-load bank than the approved driving source. A 2013 Gallardo Freesound take is both wrong year and noncommercial-only.

The search covered the official GDC 2016, 2017, 2018, 2019, 2020 and 2023 tracklists (the 2024 archive points to the 2023 list), identified Freesound pages, Wikimedia vehicle-audio categories, and creator/vendor catalogues. A few requests timed out or rate-limited. “No ready exact source found” is a bounded research result, not a claim that none exists anywhere.

## Paid candidates, not purchased

Prices checked 3 October 2026; all require final vendor terms and specification confirmation before acquisition.

| Candidate | Listed price | Decision |
| --- | --- | --- |
| [Sounding Sweet / Sound Ideas 2018 McLaren Senna](https://sound-ideas.com/products/mclaren-senna-by-sounding-sweet) | $349 | Identified stock Senna, 231 takes. Strong exact-model candidate. Sound Ideas requires embedded game audio not available as standalone downloads; current public WAV architecture needs confirmation or compliant delivery. [FAQ](https://sound-ideas.com/pages/faq). |
| [Pole Position Gallardo](https://pole.se/product/lamborghini-gallardo/) | $119 | Recording year/variant must be established against the game's 2004 car. |
| [Sound Ideas Testarossa](https://sound-ideas.com/products/ferrari-testarossa-car-sound-effects) | $75 | 116 takes; unnecessary for this upgrade because the free identified studio source was obtained. Same game-embedding restriction requires review. |
| [Watson Wu Countach](https://www.watsonwu.com/vehicles/lamborghini-countach-sound-fx-library) | $249 | 1988 LP5000QV is not LP500S; reject as an exact replacement. |
| [Sounding Sweet Zonda F](https://sound-ideas.com/products/pagani-zonda-f-by-sounding-sweet) | $399 | Different Zonda variant, not C12. |
| [ArtStation P1 model/sound pack](https://www.artstation.com/marketplace/p/Lwa9L/mclaren-p1-with-engine-sounds) | $19.99 | Recording provenance not established; P1 is not P1 GTR. Do not acquire as proof of exactness. |

## Mix, preparation and verification

The approved soft mix and all per-car pitch/tone/gain settings are unchanged. No new oscillator, buffer source, context or timer was added. The 24 kHz mono PCM16 preparation, 65 Hz high-pass, 5.8 kHz low-pass, RMS/peak normalization and cosine loop overlap are unchanged. Intervals were selected from original waveforms and spectral stationarity; these are real source sections, not generative imitations. Existing authored acceleration, shifts and Nitro drive the same graph.

`prepare-engine-recordings.py` now derives interval specifications from the reviewed manifest and validates every selected original hash before writing any output. A renamed or substituted recording cannot acquire the metadata of a different source.

- 23 bundled banks, 20 actively assigned; 3,813,892 total bytes.
- Each new bank: 180,044 bytes; largest overall unchanged at 199,244 bytes.
- Existing ceilings preserved: one request, 256 KiB encoded input, eight-second timeout, three recorded voices, three cached banks / 3 MiB decoded PCM.
- All **23 banks reproduce byte-for-byte** from the reviewed originals using the updated preparation script. A deliberately replaced source hash and an unknown bank ID both fail before any output directory/file is created.
- **54/54 focused tests pass** across recorded engine, audio, lifecycle, driving sound and race sound. Coverage includes source/derivative hashes, PCM and loop seams, all 33 actual decodes, cache/request/voice budgets, gesture/mute/hidden/pause/disposal, failed or late loads, shift/Nitro envelopes and the existing softer mix attenuation.

The local `reports/recorded-audio-review.html` exposes seven-source, active-family and all-33 render controls. It uses the actual graph, exports mixed A/B review WAVs and reports acceleration, lift/brake, Nitro, impact, shift and pause metrics. It is excluded from production. Root task records the final browser results separately.

Numeric rendering and waveform inspection are not headphone/phone listening. The user's earlier approval applies to the softer mix; no claim is made that the user has yet approved the seven new recordings. Physical devices, heat and battery remain unmeasured here.

Final integrated browser review passed for **all 33 cars / 20 active banks** using the actual Offline Web Audio graph: maximum peak **0.5562003**, maximum recorded-to-synthesis RMS ratio **0.9591368**, correct selected bank and one fetch per render, no more than three voices, bounded caches and silent pause tails. Evidence: `reports/polish-authentic-audio-33.json`; Testarossa mixed listening artifact: `reports/polish-testarossa-mix.wav`. These are numeric render results, not new subjective listening approval.
