# Recorded-engine specificity review — 3 October 2026

Two unrelated idle-only assignments have been replaced with closer documented recordings. The GranTurismo MC Stradale now uses an actual GranTurismo S V8, and the AMG GT uses an actual S63 AMG bi-turbo V8. Both remain explicitly described as family adaptations; neither is asserted to be an exact variant/engine-code match. The initial provenance/bank pass made no synthesis or Nitro changes. A later revision prompted by the user’s listening feedback is recorded below; consent/gesture gates, lifecycle, fetch/cache ceilings and physics remain unchanged.

| Bank | Prior assignment | Primary source, license and identity | Selection |
| --- | --- | --- | --- |
| `maserati-granturismo-v8` | 1985 Mustang idle, cylinder count undocumented | [Maserati GranTurismo S](https://freesound.org/people/lmartins/sounds/465453/), lmartins, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source describes the GranTurismo S V8 starting, revving and idling. | 3.50–4.85s, 26.00–27.35s, 44.00–45.35s. Source starts and isolated wideband transients excluded. Original source M4A is 64 kbps; HQ preview does not restore that lost detail. |
| `mercedes-amg-v8` | 1985 Mustang idle, cylinder count undocumented | [S63 AMG V8 Engine Revs](https://freesound.org/people/marcelweiss/sounds/505321/), marcelweiss, [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Source identifies a stationary S63 AMG Coupé V8 BiTurbo revving in a Munich car park. | 4.85–6.00s, 1.05–1.85s, 2.35–3.45s. Selected away from isolated wideband transients. Source year/engine code unspecified. |

Selection was based on primary descriptions plus decoded waveform and spectrum inspection. It was not a physical listening session. These compact field-recording loops retain background texture and compression; their three normalized rev positions are authored, not measured RPM.

The exact source URLs, source hashes, derivative hashes, intervals, authors and modifications are in `public/assets/audio/ENGINE-SOURCES.json`. Additive download cost is 313,480 bytes in the full bundle, but only the selected car bank downloads after unlock. The two files are 180,044 and 133,436 bytes, below the previous largest bank of 199,244 bytes. The 14 original banks remain byte-for-byte unchanged. The Mustang remains unassigned, so the total is 16 bundled / 15 actively used banks / 33 cars / 2,553,584 bytes. Per-car new gain ratios 0.80/0.82 stay below their previous 0.96/1.00 values.

## Other primary candidates checked

| Candidate | Outcome and evidence |
| --- | --- |
| [Moscow Raceway GT Race sounds](https://freesound.org/people/Walking.With.Microphones/sounds/556039/), Walking.With.Microphones, CC0 | Eligible license, but not adopted as individual model loops. The recorder lists 17 ordered cars including 458 Italia GT3, R8 LMS Ultra, McLaren 650S GT3 and Nissan GT-R Nismo GT3, without timestamps. The decoded 56.76-second track shows overlapping harmonic trajectories and passes without silence separators. No unambiguous isolated McLaren/Nissan interval was established; labeling selected slices as those cars would overstate verification. |
| [Bugatti Veyron Super Sport Sound Effect](https://pixabay.com/sound-effects/film-special-effects-bugatti-veyron-super-sport-sound-effect-361741/), AstonMartinVantageV12 | Page displays Pixabay Content License and a Veyron title, but no original recorder/session/microphone/capture description. Not adopted as a verified Veyron recording. This is an evidence limit, not a claim the asset is infringing. |
| [Ferrari Testarossa Car Sound Effects](https://sound-ideas.com/products/ferrari-testarossa-car-sound-effects), Sound Ideas | Identified professional Testarossa collection, paid license acquisition required. Not purchased; preview not reused. |
| [1990 Ferrari Testarossa](https://pole.se/product/ferrari-testarossa-1990/), Pole Position Production | Detailed professional onboard/exterior collection under a paid single-user license. Not purchased; preview not reused. |
| [Videvo Testarossa search](https://www.videvo.net/royalty-free-sound-effects/testarossa/) | Current page redirects to Freepik's generic audio section; historical snippets do not establish a current asset-specific downloadable license. Not adopted. |
| [M3 accelerate](https://freesound.org/people/ccdff2/sounds/343369/), ccdff2, CC BY 3.0; [BMWM3_02.wav](https://freesound.org/people/ikbenraar/sounds/415275/), ikbenraar, CC BY 4.0 | Licensed M3 recordings, but generation/engine unspecified. An M3 label alone does not verify the E46 inline-six; current explicit inline-six proxy retained. |
| [Audi_R8_01.wav](https://freesound.org/people/ikbenraar/sounds/429099/), ikbenraar, CC BY 4.0 | R8 race recording, variant and cylinder count unspecified; does not resolve the game's V10 R8-family specificity. Current V10-family recording retained. |
| [Audi Sport Quattro S1 (1985).ogg](https://commons.wikimedia.org/wiki/File:Audi_Sport_Quattro_S1_(1985).ogg), Edvvc | Page states CC BY-SA 3.0 but embedded author metadata states Attribution-Noncommercial-Share Alike 2.0 UK. Not adopted until that license discrepancy is resolved. |
| [Nissan skyline Gtr Brakes](https://freesound.org/people/SubwaySandwitch420/sounds/540019/) | Uploader explicitly derives it from someone else's YouTube video; no original license verified. It is also an R34 braking effect, not a 2018 R35 engine recording. Rejected. |
| [Rimoc Concept_One mod](https://www.beamng.com/resources/rimoc-concept_one-12.6021/) | Author describes sound borrowed from another electric-car mod. Not a documented Rimac capture or a redistributable recording source for this game. No usable verified Rimac recording found in this review. |

Veyron still uses a documented Murciélago V12 proxy, Testarossa a classic Ferrari V12 proxy, and both Rimacs Tesla electric motion audio. Their identity limitations remain in source metadata, public-credit instructions, documentation and the local listening fixture. This search is not proof that no other suitable recording exists. No YouTube rip, paid preview, new account or purchase was used.

## Verification and listening artifact

- 40/40 focused tests passed across recorded engine, audio, lifecycle and driving-sound suites, including new bank identity/hashes and source intervals, all 33 real bank decodes, three-voice allocation, lazy request, cache/timeout/cancellation, shift/Nitro and mute/pause behavior.
- Rebuilt all 16 banks using the preparation script and locally retained sources: every WAV reproduced its manifest SHA-256. All original 14 banks remained identical. Source masters and page HTML stay outside production assets.
- `reports/recorded-audio-review.html` adds a two-upgrade review action, actual source/license/limitation text, automatic shift timestamps, acceleration/lift/Nitro/impact metrics, and an audible synthesis-only A/B player. Starting one player pauses the others. No autoplay. The full 33-car and 15-active-bank actions remain available.
- Browser numeric rendering: all 33 cars / 15 active banks passed before and after the sound revision. The final mix maximum peak is 0.556661; the maximum RMS ratio to the revised synthesis-only baseline is 0.945421. All samples are finite, correct banks loaded, budgets held, and pause tails were silent. Numeric/offline verification does not constitute a headphone, physical phone or subjective listening test.

Public credits were integrated into `public/credits/index.html#recorded-engine-audio`, with the correct authors/licenses, 15 active / 16 bundled counts, legacy Mustang status, and GranTurismo S / S63 adaptation limits. Content outside that audio section remained unchanged. The reusable credit copy remains in `reports/recorded-engine-attribution-2026-10-03.md`.

## Follow-up: user reported harsh / synthetic sound

The user listened to both upgraded-car samples and said they were still too harsh or synthetic. The prior numeric pass (reported by the main task: maximum peak approximately 0.605; RMS comparison ratio at most 1.145) was not treated as perceptual acceptance.

The new revision changes the actual sound graph:

| Element | Earlier mix | Revised mix |
| --- | --- | --- |
| Procedural body/exhaust with a fully active recording | 58% gain retained | 18% retained |
| Harmonic/turbine with recording | Harmonic 58%; turbine 100% | Both 6%, with a quieter base harmonic envelope |
| Sub oscillator with recording | 58% | 35% |
| Recording playback rate | 0.82–1.30 | 0.90–1.20, slower automation |
| Recording brightness / warmth | Cutoff could reach approximately 5 kHz; 2.5 dB shelf | Cutoff capped below 3.3 kHz; 1.25 dB shelf |
| Sound-only gear dip | 18% over 160 ms | 12% over 220 ms; pitch and gain changes also smoothed |
| Nitro tone | 0.012 core / 0.068 combustion low sine gain | 0.003 core / 0.034 low sine gain; lower, softer air/release filtering and smoother onset |

The finite procedural harmonic spectrum now has less than 0.005 combined squared coefficient power in the third and higher partials. Recording gain was not raised above the prior 0.42 ceiling. Full procedural fallback is retained when a recording cannot load, and EV motion gating still prevents a silent recording from ducking the bed at rest. The one added filter is in the Nitro air branch; shared noise samples, lobby music, tyres and race soundscape paths were not recolored. No new audio voices or buffers.

**53/53 focused tests pass**, including new graph-level checks for recording dominance, formerly unducked turbine reduction, fallback, no per-frame allocation, pitch/filter/source-gain bounds and pause, plus existing lifecycle, music, spatial, Nitro and all-car tests. A separate read-only review of the proposed mix identified shared-noise/lobby, fallback, EV and voice-budget safeguards; those safeguards were retained. New integrated browser renders and user listening feedback remain required before claiming this resolves the perceptual complaint.
