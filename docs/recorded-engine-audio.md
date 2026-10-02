# Licensed engine recording layer

The game blends selected cars’ existing synthesis with short, processed real recordings. All assignments are **adapted proxies**, not claims to have recorded the exact game model, its exhaust position, manufacturer RPM or a calibrated dyno sweep. Electric cars and unsupported combustion models retain their original procedural voices. Liquid Lines remains the only lobby soundtrack.

## Sources and attribution

- Ferrari 355 Spider engine compartment: [ferrari355underhood4.mp3](https://freesound.org/people/enginemusic/sounds/43484/) by enginemusic, copyright 1997 as stated by the recorder, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The source identifies intake and valve-cover microphone positions. Three portions of the public HQ MP3 preview supply normalized-rev bands. Used for the 458 Spider, four McLarens and Koenigsegg One:1 as authored V8 texture adaptations.
- [porsche_911.wav](https://freesound.org/people/mharo/sounds/55727/) by mharo, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). A Barcelona street recording; exact year/variant unknown. Three edited portions of its public HQ MP3 preview are used on the 930 Turbo and GT3.
- [Ford Mustang Engine (1985).wav](https://freesound.org/people/lmbubec/sounds/119449/) by lmbubec, CC0 1.0. The source does not specify cylinder count. Its public HQ MP3 idle take supplies low-rev texture for the Mercedes-AMG GT and Maserati MC Stradale; it fades as normalized revs rise instead of being stretched into a purported full-RPM recording.
- [Acceleration Aston Martin](https://bigsoundbank.com/acceleration-aston-martin-s0600.html), sound 0600 by Joseph SARDIN / BigSoundBank, CC0 1.0. The source WAV identifies the brand but not model, engine or microphone location. Two portions form an adapted One-77 texture. [Source permissions](https://bigsoundbank.com/licenses.html) explicitly permit redistribution and modification.

Public attribution is in `/credits/#recorded-engine-audio` and `public/assets/audio/LICENSES.txt`. `ENGINE-SOURCES.json` records the source URL, public download, source and derivative SHA-256, selected intervals, exact processing and car assignments. No account-only source file was downloaded, and no paid or unknown-license sample is included. License coverage does not imply manufacturer endorsement.

## Processing and mix

`scripts/prepare-engine-recordings.py --sources <local-source-directory> --output <output-directory>` reproduces the WAV banks using FFmpeg. Sources are deliberately obtained separately from the links in the manifest. Processing uses mono downmix, 24 kHz PCM16, 65 Hz high-pass and 5.8 kHz low-pass filtering, DC removal, cosine overlap, loop-seam correction and RMS/peak normalization. Runtime banks total **585,872 bytes**; the largest selected bank is **199,244 bytes**. Raw source takes are not part of the production bundle.

Up to three looping `AudioBufferSourceNode` voices use equal-power neighboring rev weights, limited playback-rate adjustment (0.82–1.3), smoothed load gain, shift torque, load-sensitive low-pass filtering and a quiet low-frequency shelf. These are authored normalized-rev bands; no measured RPM is invented. Existing synthesis fades down by up to 42% when the recording layer is present. Fresh impacts and Nitro onsets briefly reduce the player engine bed to make room for the existing effects instead of raising their peaks. The [Web Audio looping and playback-rate model](https://www.w3.org/TR/webaudio/#AudioBufferSourceNode) is used directly; there is no per-frame source construction.

## Resource and lifecycle bounds

- No context, playback or recording request before a user unlock. No recording request for lobby music, a muted/hidden/inactive page, an engine mixer at zero, or an uncovered vehicle.
- One selected-bank request at a time, with an 8-second fetch/decode ceiling and at most 256 KiB of encoded input. Car changes and inactivity abort stale requests. Late completion cannot create voices or retain a cancelled buffer.
- At most three active recorded sources. Bank changes stop and disconnect previous sources before replacements start; steady driving reuses them.
- LRU cache: at most three banks and 3 MiB of decoded PCM. A decode may temporarily hold one additional bank before validation/eviction; browser decoder overhead and garbage-collection timing are outside this accounting.
- Failed banks keep the original synthesis for the remainder of the audio instance without repeated network attempts. The supported host-context decode is used; unsupported decoding fails safely.
- Recordings route through the existing engine mixer, master compressor and lifecycle gate. Hidden/mute/pause fades and the 240 ms idle-context suspension still apply. Explicit disposal aborts requests, drops buffers, stops voices and disconnects their graph. Browser timer methods are explicitly bound to their global receiver.

`createAudio().recordingStatus()` exposes read-only verification data: active/selected bank, current recorded voices, cache count/decoded bytes, pending status, fetch count, failures and blend. It does not unlock audio or request assets. No main.js call-site changes are needed.

## Verification and limits

`tests/recorded-engine.test.js` checks source contracts, every shipped WAV/hash/loop seam, valid non-electric mappings, equal-power rev blending, load response, lazy requests, voice reuse, LRU limits, failures and oversized data, rapid selection, aborted/late decode, timeout and actual createAudio gesture/mixer/page gates. Existing audio/lifecycle/Nitro/soundscape regressions remain applicable.

`reports/recorded-audio-review.html` is a local development fixture, excluded from production inputs. It renders four complete driving sequences with the actual browser OfflineAudioContext, audio graph and shipping WAV banks, provides manual playback/downloads, and reports peak/RMS, finite output and post-pause silence. A simulated audio render is not a physical listening session. Phone speakers, headphones, real iPad interruptions, heat, battery impact and subjective polish remain physical-device verification items; do not claim those have been measured without observing them.
