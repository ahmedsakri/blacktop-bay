# Veyron audio license option — NOT APPLIED

This is a reviewable proposal only. It does not change Camber Reign's current licensing, shipping audio, car mapping or runtime behavior.

## Decision after the layer audit

Keep this candidate outside the main game. No broad licensing approval is requested. The source is freely licensed, but the prepared audio is only a short exterior-departure band and has not received listening approval. The game's exact Veyron trim/year remains unspecified.

[The completed layer audit](veyron-layer-compatibility-audit-2026-10-04.md) found compatible documented inputs for a Veyron-only audiovisual presentation: CC BY car geometry, CC0 scenery/crowd, original synthesis and permissive library/font licenses. In the current code, only the selected car has a recorded bank; opponents and race ambience are synthesized. Sonniss audio is therefore **not a demonstrated simultaneous blocker** for Veyron playback.

The unresolved issue is the scope of the adaptation inside the full interactive game. Primary CC terms say synchronization is an adaptation and distinguish separate collection works, but do not establish that the proposed Veyron presentation is legally a separate audiovisual work from the rest of this game. A narrow notice or user approval cannot itself decide that classification. A clearly separate Veyron audiovisual output/demo would be a more concrete compatible scope, but that is a different deliverable from improving main-game audio.

No purchase, creator/studio outreach, code relicense, asset-license change or main-game integration is proposed here. Continue the main-game search under CC0/CC BY rather than asking the user to approve an unresolved scope.

## Prepared audio for review

- [Recorded Veyron loop, repeated six times (7.5 seconds)](/Users/ahmedsakri/Documents/Personal/Games/camber-reign-audio-source-review-2026-10-04/prepared/veyron-loop-repeat-review.wav).
- [Veyron source through the actual game mixer (13 seconds)](/Users/ahmedsakri/Documents/Personal/Games/camber-reign-audio-source-review-2026-10-04/prepared/veyron-recorded-mixer-review.wav).
- [Current shipping Murciélago proxy through the same mixer](/Users/ahmedsakri/Documents/Personal/Games/camber-reign-audio-source-review-2026-10-04/prepared/veyron-current-shipping-mixer-review.wav).

The candidate uses one real departure band, gates it to silence at rest, and reduces its contribution at high authored revs using the existing one-band rule. It does not pretend to contain idle and multiple measured RPM takes. Existing pitch/tone/gain settings and softer mixer are unchanged in the audition. The sequence accelerates for six seconds, lifts/brakes for two, uses Nitro for two, impacts at ten seconds and pauses at eleven seconds.

Numerical checks confirm no clipped loop samples, matching loop endpoints, a loop peak below 0.66 and finite mixer output below its 0.98 peak budget with a silent pause tail. This is a local offline rendering of the actual audio graph, not a completed browser driving or physical-device listening test. No aural approval is claimed. [Loop metrics](source-audit-2026-10-04/veyron-loop-review.json) and [mixer metrics](source-audit-2026-10-04/veyron-mixer-review.json) retain the exact values and source interval.

## Alternative without a licensing change

Continue accepting only CC0 or CC BY sources for these unresolved models. Keep the current explicitly labeled Veyron proxy until an acceptable Veyron source is found. This avoids making a new audiovisual ShareAlike grant, but no timeline or guarantee of locating such a recording is established.

## Proposed attribution text for an eventual accepted source

“Bugatti Veyron Pur Sang.ogg” by Edvvc (Ed Pond), recorded at the Goodwood Festival of Speed on 3 July 2009. Source: https://commons.wikimedia.org/wiki/File:Bugatti_Veyron_Pur_Sang.ogg. Licensed under Creative Commons Attribution-ShareAlike 3.0 Unported: https://creativecommons.org/licenses/by-sa/3.0/.

AppsOverFlow prepared the local audio-only review bank from source seconds 1.000–2.350 through mono 24 kHz conversion, 65 Hz high-pass and 5.8 kHz low-pass filtering, 0.1-second cosine loop overlap, DC/seam correction and normalization. The result is a 1.25-second single band; the game has not adopted it. If integrated, source intervals and processing will remain recorded in its provenance manifest. Attribution does not imply creator or manufacturer endorsement.

## Scope note retained for a separate future deliverable

If a separate audiovisual output is ever explicitly selected, its complete synchronized presentation and the project's copyrightable adapter contributions would need ShareAlike treatment, with original input licenses and credits preserved. [CC BY-SA 3.0 section 4(b)](https://creativecommons.org/licenses/by-sa/3.0/legalcode) also permits a later version with the same license elements, so an adapter's license under CC BY-SA 4.0 is available without relabeling the original source grant as 4.0. No such grant is applied here.

A WAV-only ShareAlike notice is not a substitute for resolving the synchronized presentation. Independent code/library licenses can remain separate, but a heading cannot define away the rights of an adaptation. Sonniss's actual restrictions matter if a legally relevant combined adaptation includes its recordings; they are not proof of a conflict in the isolated Veyron playback audited here.

The source's model family is closer than the current Murciélago V12 proxy. It still does not certify target trim/year, provide a complete measured engine session, or resolve the other 27 cars lacking accepted base-model sources.
