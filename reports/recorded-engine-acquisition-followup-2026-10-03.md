# Continued exact-car audio acquisition — 3 October 2026

The Lotus Elise now uses an identified Elise recording instead of Honda F20C, and Ferrari 250 GTO uses an identified 250 GTO recording instead of Ferrari 340 America. These are two additional real source improvements, not completion of the requested exact-car coverage. Current totals are **33 cars, 21 active banks, 25 bundled banks, 4,173,980 bytes**, with five base-model matches and **zero fully certified model/year/variant/build matches** under the explicit strict inventory criterion. The previous seven studio banks plus Elise and 250 GTO improve thirteen assignments. Veyron, i8, R18 and 919 still have wrong-layout recorded substitutes; these have not been renamed or quietly counted as correct.

## New ready sources and verification

[Lotus Elise start rev idle.aif](https://freesound.org/people/victormalloy/sounds/113205/) by victormalloy, published 30 January 2011 under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), belongs to the recorder's [Automobiles collection](https://freesound.org/people/victormalloy/packs/7118/). The page specifies a 51-second, 96 kHz/24-bit stereo original. The public publisher-hosted HQ MP3 preview was used, not the login-only original. The recording names Elise but does not identify its generation, model year, engine or exhaust.

- Source: `113205_137116-hq.mp3`, 1,193,280 bytes; SHA-256 `5ac3fb5a84bab3437ac097e864f9fe3e27e1dec26a54de0744c4455157b3b009`.
- Selected source intervals: 44.1, 16.7 and 20.0 seconds, each 1.35 seconds; authored rev-band labels 0.10, 0.55 and 0.95.
- Prepared bank: `lotus-elise-v1.wav`, 180,044 bytes, 3.75 seconds; SHA-256 `3506585008cd734b47a0a7e6c2e664108ca4e915417fea2dcc31759364cdae2f`.
- Existing filtering, seam correction, normalization and 24 kHz mono PCM preparation are unchanged. Stationary rev sections retain source pitch movement. No measured RPM or subjective listening claim is made.
- A fresh preparation from the shipping manifest produced the identical bank byte-for-byte. All five focused suites pass **54/54 tests**: recorded engine, audio, lifecycle, driving sound and race sound.
- No `audio.js`, `driving-sound.js`, `recorded-engine.js`, per-car gain, pitch or tone change. Selected-only fetch, 256 KiB input ceiling, three voices, three-bank/3 MiB cache and user-gesture/consent lifecycle remain unchanged. Honda becomes a fourth unassigned legacy bank; its attribution is retained. GTO adds one active bank because Ferrari 340 America still serves Countach.

[Ferrari 250 GTO, Engine Sound.ogg](https://commons.wikimedia.org/wiki/File:Ferrari_250_GTO,_Engine_Sound.ogg) was published by Provo rossi as own work on 1 August 2025 under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The original public Ogg is 59.882812 seconds, stereo 44.1 kHz, 564,723 bytes. Downloaded SHA-1 `a773b1c1dcdc031c1b9249f26603543bce87b998` matches the primary page. The source identifies the model but not year, chassis, recording hardware or engine/exhaust build. The container retains M4A encoder lineage; it does not independently prove the capture session. This source remains an attributed uploader declaration, not an independently certified 1964 recording.

- Source SHA-256: `8cf1408366105aa2a563b3b7e871d1d0ebcd91415c9696bf0e0488aab0030683`.
- Three running sections begin at 18.3, 30.5 and 43.5 seconds, each 1.35 seconds. Waveform/spectral inspection selected relatively steady sections; these are not measured RPM, isolated idle or load stems.
- Prepared `ferrari-250-gto-v1.wav`: 180,044 bytes, 3.75 seconds; SHA-256 `c57d4798ac7b909015dacea8e7c756a168bed2b8e6acb785a95cb4ca43734f4f`. A fresh run using the shipping manifest reproduced it byte-for-byte.
- Only the 250 GTO assignment changes. Countach retains the explicitly unrelated Ferrari 340 America proxy. Attribution and modification disclosure are in `LICENSES.txt` and supplied for `/licenses/#recorded-engine-audio`.
- After both additions, the same five focused suites pass **54/54 tests**. All 25 derivative hashes, source identities, 33 actual bank decodes, loop seams, voice/cache budgets and lifecycle gates pass.

`reports/recorded-audio-review.html` now offers nine new banks for local rendering, with Elise and 250 GTO included. Physical phone/headphone approval is still a user listening check. Prior browser metrics in the original report apply to the earlier studio upgrade until the later integration evidence is appended below.

## Freely licensed sources only

The user has now instructed **“Use freely licensed recordings only.”** No vendor enquiry was sent and no purchase was made. The two former local enquiry drafts are marked superseded and remain outside the public research report; they are not an active proposal. Paid catalogues remain historical research evidence only. The follow-up work is restricted to actual freely licensed recordings whose identity and game-use rights can be verified.

Sounding Sweet's stock Senna/992 GT3 and modified E46 sessions and AudioSparx's Enzo/GT3/Gallardo product IDs establish specific catalogued recordings but do not satisfy this free-only acquisition scope. They are not counted as coverage or silently substituted with their previews.

## Four engine-layout gaps: concrete evidence and next dependency

| Target | Best identified lead | Why it is not installed |
| --- | --- | --- |
| Bugatti Veyron W16 | Edvvc / Ed Pond's [Pur Sang](https://commons.wikimedia.org/wiki/File:Bugatti_Veyron_Pur_Sang.ogg) and [Grand Sport](https://commons.wikimedia.org/wiki/File:Bugatti_Veyron_Grand_Sport.ogg) original recordings | Genuine CC BY-SA 3.0 grants; not falsely rejected as unlicensed because of older NC metadata. Share-alike treatment of synchronized adaptations needs a project-compatible decision or separate author permission; body/trim and short source coverage also matter. No current verified email was found. Pixabay Super Sport title lacks original-recorder evidence; Chiron is a different model. |
| BMW i8 I3 hybrid | [BMW's own 2019 sound-design footage](https://www.press.bmwgroup.com/deutschland/tv-footage/detail/PF0006748/bmw-electric-sounddesign/2) includes i8 Roadster measurement scenes | Press availability is not permission for a game recording derivative; the represented body/build still needs confirmation. [Pixabay i8 252644](https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-bmw-i8-noise-252644/) is Content-ID registered with no recorded-vehicle/session provenance. No original source with an open game-use grant found. |
| Audi R18 V6 diesel hybrid | Original creator 19Bozzy92's [2013 long-tail R18 at Monza](https://www.youtube.com/watch?v=CKIc1BcWDlM) | Real named-car lead, but no reuse licence or isolated master delivery. Target R18 year is not certified. Audi Denmark's CC-labelled 2015 press release supplies photographs, not an engine recording grant. Audi's [2014 R18 MP4](https://audi-mediacenter.pl/film,18564,audi-r18-e-tron-quattro.html) explicitly limits free use to journalism. |
| 2017 Porsche 919 V4 hybrid | Original creator 19Bozzy92's [2017 Monza WEC Prologue recording](https://www.youtube.com/watch?v=pt6a4iSIrsI) | Correct named year/model lead, but no game reuse grant. Publication describes collaboration with Italiansupercarvideo: permission must cover specifically owned source takes, not assume the uploader owns every shot. No clip extracted. |

The two videographer leads establish named original sessions but do not supply freely licensed source files. They do not license copying YouTube audio. No approach was made. Consumer album/ringtone purchases, GT/Forza/NFS sound mods and miscellaneous soundboards do not establish game-use rights. No paid candidate for these four is presented with an invented price.

## Other research decisions

The checked scope now includes 61 explicit candidate decisions in `ENGINE-CANDIDATES.json`, the complete Sounding Sweet 2025 catalogue, direct Freesound searches, expanded Commons audio/video namespace searches, individual AudioSparx listings, indexed OpenGameArt/Zenodo/Internet Archive searches, and original recorder/manufacturer publications. Searches also returned unrelated results; those are not evidence that an exact source exists. Some direct searches returned rate limits or timeouts. “No ready source found” remains a bounded result, not proof of universal absence.

- The free CC0 Moscow GT-race source names 650S and R8 LMS among many cars. Decoded waveform/spectral inspection showed mixed pass-bys rather than a verified clean three-band source. Naming the race field does not certify an isolated car loop.
- Echo Collective's paid 2014 GT3 R is a race variant, not the road GT3. Sounding Sweet's Zonda F and Watson Wu's 1988 Countach LP5000QV are not C12 or LP500S. These were not purchased as false exact matches.
- Sounding Sweet's Elise catalogue says stock while its product page says custom exhaust. This was left conditional; the identified CC0 Elise costs nothing and improves the current assignment without a speculative purchase.
- GTA mod authors explicitly describe Veyron audio taken from NFS Rivals and an S54 M3 package assembled from GT Sport/Forza 7. Their download availability supplies no redistribution authority; they were rejected.
- The five existing base-model matches still need target/source year, variant and build evidence before the stricter exact-specification flag can become true. Source-year evidence is also absent for 250 GTO. Custom R8, T.50 and F22 artwork needs an actual intended engine-build specification; guessing from the model silhouette is not an audio audit.

- Extended Commons queries found the new 250 GTO publication. Exact One-77 and T.50 audio/video queries returned no named-car source; Enzo results were broader Ferrari or unrelated matches, including game footage. Zonda results identified R and Roadster F, not C12. Later Commons queries returned HTTP 429 and were stopped; no evasion or claim of complete indexing.
- The [Pixabay Enzo clip](https://pixabay.com/sound-effects/film-special-effects-ferrari-enzo-sound-effect-360529/) gives a title but no original recording/session provenance. A separately published [Petrolicious 250 GTO ringtone](https://petrolicious.com/blogs/articles/download-ferrari-250-gto-ringtones) does not provide an open game-asset grant; its old media hostname was unavailable. No ringtone was copied or claimed equivalent to the Commons upload.
- [Rimac's official terms](https://www.rimac-automobili.com/legal-notice/) cover aural content and require permission for public/commercial reuse. [GMA's official terms, section 8](https://www.gordonmurray.com/terms-and-conditions) cover audio/video and restrict unauthorised reuse. No recording-specific open grant was found. Manufacturer playback availability is not a free audio library.
- Cross-checks for i8/R18/919/Rimacs/T.50 independently found no new qualified free bank. Freesound's R18 false positives included a reel-number horn; “nevera” included refrigerator foley. Open licences attached to photographs, 3D meshes, articles or music do not automatically license a car recording embedded nearby.

## Share-alike evidence, not an automatic rejection

The two Veyron Commons files are freely licensed CC BY-SA 3.0 recordings. Their old embedded noncommercial metadata does not erase the later author-published SA grant. [Creative Commons' software FAQ](https://creativecommons.org/faq/#can-i-apply-a-creative-commons-license-to-software) allows game music/art to be licensed separately; using CC artwork does not automatically make every line of code share-alike. However, [BY-SA 3.0 legal code, section 1(a)](https://creativecommons.org/licenses/by-sa/3.0/legalcode.en) treats a phonogram synchronized with moving images as an adaptation, with section 4(b) supplying adaptation conditions. The [CC compatibility guidance](https://wiki.creativecommons.org/wiki/ShareAlike_compatibility) also distinguishes separate collections from adaptations.

These sources do not by themselves establish that licensing only the exported loop is sufficient for this game's synchronized audiovisual use, nor do they establish that the whole codebase necessarily must be relicensed. A project-compatible treatment of the actual adaptation remains unresolved; the current work neither silently ships SA material under CC BY nor invents a blanket prohibition. Source duration and target coupe/roadster/trim still need a suitability check. No author contact or purchase was made under the free-only instruction.

## All 33 assignments and remaining acquisition work

The following is a readable snapshot of `ENGINE-COVERAGE.json`. Every current source is ready for its documented game use. That rights status does not certify target identity. Every car remains available. The five base-model matches still lack at least one affirmative matching year/variant/build fact; the remaining 28 rows are explicitly labelled proxies or unresolved variants. A freely reusable matching source and suitable running intervals are needed before replacement.

| Game target | Current actual recorded vehicle | Remaining identity/source requirement |
| --- | --- | --- |
| McLaren 570S Coupé | 2016 McLaren 570S Coupé V8 biturbo | The recording is a 2016 570S Coupé, matching the represented model/body. Visual source does not state model year; exact year/exhaust specification is not certified. |
| McLaren Senna | 2016 McLaren 570S Coupé V8 biturbo | Source is 570S V8 biturbo, not Senna4.0V8. More appropriate McLaren recording replaces the naturally aspirated Ferrari355 substitute. |
| McLaren P1 GTR | 2016 McLaren 570S Coupé V8 biturbo | Source is 570S V8 biturbo, not P1GTR or its hybrid system. |
| Ferrari 458 Spider | 2013 Ferrari 458 V8 (body variant not verified) | Historical game ID says Italia, but visible asset is 458 Spider. Source says 2013 Ferrari458 without certifying Spider; embedded library artwork depicts coupe. This is not the separately advertised straight-pipes session. |
| Lamborghini Aventador | 2014 Lamborghini Aventador V12 | Source is a 2014 Aventador. Visual source does not specify year or trim; do not infer LP700-4/S/SV/SVJ identity from the generic label. |
| Koenigsegg One:1 | Ferrari 355 Spider | Ferrari 355 is not the One:1 twin-turbo V8. Generic Koenigsegg tags do not identify One:1. |
| Pagani Zonda C12 | Lamborghini Murciélago LP 670 SuperVeloce V12 | Murcielago V12 is not the Mercedes-derived Zonda C12 engine. Zonda F and R are different variants. |
| Bugatti Veyron | Lamborghini Murciélago LP 670 SuperVeloce V12 | Murcielago V12 is not a Veyron W16. Pitching it down does not change its identity. |
| Maserati GranTurismo MC Stradale | Maserati GranTurismo S V8 | GranTurismo S recording is not the MC Stradale variant. |
| Lotus Elise | Lotus Elise (generation and engine unspecified) | Both source and visual asset name Lotus Elise, but neither establishes generation, model year, engine or exhaust build. Actual Elise replaces the unrelated Honda F20C proxy; exact specification is not certified. |
| Audi R8 · Custom | 2017 Audi R8 FSI 5.2 V10 | Source is 2017 road R8 5.2FSI V10. The custom mesh source does not establish generation or engine build, so exactness remains unverified. |
| Rimac Concept One | Tesla Model S Plaid electric | Tesla Model S Plaid acceleration is not a Rimac Concept One recording. |
| Porsche 911 (930) Turbo · 1975 | Porsche 911 (year/variant unspecified) | Source only says Porsche 911; no proof it is the 1975 930 Turbo. |
| Gordon Murray Automotive T.50 · Custom | Lamborghini Murciélago LP 670 SuperVeloce V12 | Murcielago V12 is not the Cosworth T.50 engine; game model is an artist custom interpretation. |
| Aston Martin One-77 | Aston Martin (model unspecified) | BigSoundBank source names Aston Martin but not One-77 or an engine configuration. |
| Rimac Nevera | Tesla Model S Plaid electric | Tesla Model S Plaid acceleration is not a Rimac Nevera recording. |
| Porsche 911 GT3 | Porsche 911 (year/variant unspecified) | Generic 911 source does not establish GT3. Game asset generation must be established before selecting 996, 997, 991 or 992. |
| Lamborghini Gallardo · 2004 | Lamborghini Huracán EVO Spyder V10 | Huracan EVO Spyder is not a 2004 Gallardo. Later 5.2-litre Gallardo recordings do not establish the 2004 car. |
| Lamborghini Huracán | Lamborghini Huracán EVO Spyder V10 | Source is Huracan EVO Spyder; game asset says Huracan without a documented variant. |
| BMW i8 | Audi A4 Allroad 2.0 TFSI turbo inline-four | Audi A4 inline-four is not the i8 three-cylinder hybrid powertrain. |
| BMW F22 Eurofighter | Ferrari 355 Spider | Ferrari V8 is an authored drift proxy. The visual asset does not establish the exact engine build of this custom F22. |
| Audi R8 LMS GT3 · 2019 | 2017 Audi R8 FSI 5.2 V10 | Source is 2017 road R8 V10, not the represented 2019 R8 LMS GT3 race car. |
| Audi R18 | BMW 120d diesel inline-four | BMW 120d inline-four diesel is not the R18 V6 diesel racing hybrid. |
| Ferrari 250 GTO · 1964 | Ferrari 250 GTO (year and build unspecified) | Source uploader identifies Ferrari 250 GTO but not model year, chassis or engine/exhaust build. Replaces unrelated Ferrari 340 America. Target is 1964; that year/specification is not independently certified by the recording. |
| Ferrari Testarossa | 1990 Ferrari Testarossa flat-12 | Source is a 1990 Testarossa flat-12, correcting the former V12-layout substitute. Visual source does not state year, so same-year or same individual-car identity is not asserted. |
| Mercedes-Benz AMG GT | 2018 Mercedes-AMG GT R twin-turbo V8 | Source is 2018 AMG GT R, not the GT trim named by the game. Closer model-family source than previous S63, without an exact-variant claim. |
| Nissan GT-R · 2018 | 2012 Nissan GT-R R35 turbo V6, modified performance exhaust | Source is 2012 R35 with modified performance exhaust; target is 2018 R35. Correct model/generation, not exact year or factory exhaust. |
| McLaren 650S GT3 | 2016 McLaren 570S Coupé V8 biturbo | Source is 570S road V8 biturbo, not 650SGT3 race recording. |
| BMW M3 E46 Coupé | 1995 Mercedes E320 inline-six | Mercedes E320 inline-six is not the E46 M3 S54. Generic M3 and E46 3-Series recordings do not establish this engine. |
| Audi Quattro Rally | Volvo 2.4 turbo inline-five | Volvo turbo inline-five is not a documented Audi Quattro rally build. The game asset does not specify year/variant. |
| Lamborghini Countach LP500S | Ferrari 340 America 4-litre V12 | Ferrari 340 America V12 is not Countach LP500S. LP5000 QV is a different engine/variant. |
| Ferrari Enzo | Lamborghini Murciélago LP 670 SuperVeloce V12 | Murcielago V12 is not the Ferrari Enzo engine. |
| Porsche 919 Hybrid · 2017 | Audi A4 Allroad 2.0 TFSI turbo inline-four | Audi A4 inline-four is not the 2017 919 V4 hybrid racing powertrain. |

## Verification boundary and remaining free-source blocker

The two new banks remain 180,044 bytes each, below the unchanged largest bank at 199,244 bytes and the 256 KiB per-download ceiling. Only the selected bank downloads after unlock. Three recorded voices, three-bank/3 MiB decoded cache, failure fallback and silent pause/disposal behavior remain tested. The approved soft mix, physics, shifting and Nitro design are unchanged. No original recording, source-page dump or large analysis archive is added to the repository.

The earlier all-33 browser render passed with maximum peak 0.5562003 and maximum RMS ratio 0.9591368, before these two new banks. The root integration pass will record later render evidence separately. Neither numerical rendering nor a waveform inspection is headphone/phone listening approval.

The unresolved work is concrete: acquire freely reusable original recordings with the represented vehicle/year/build identified; for several custom or generic visual assets, first establish the intended exact specification. For the Veyron SA candidates, settle the actual adaptation's distribution terms before incorporating them. No further ready exact bank was established in the checked free sources. This is a bounded acquisition result, not a claim that no such recording can ever exist, and not 100% audio authenticity.
