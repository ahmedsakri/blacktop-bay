# Driving, audio and record integrity — October 2026

## Reset placement

Manual reset now checks the same legal-road and obstacle candidates as automatic recovery, with visible-body capsule clearance and vertical separation from other cars. Candidates start at the last validated route position, try nearby lanes, then retreat only through already validated distance. If every gap is blocked, reset returns `false` without changing the car or race state. It never advances a checkpoint, awards a lap, or refills Nitro. Existing recovery cooldown and the wider automatic-recovery traffic buffer remain in place. A clear placement cannot guarantee that moving traffic will never reach the car afterwards.

## Nitro controls

Held Nitro keeps its original interaction. Toggle mode uses the first tap to start, a second tap within the timing window to select Burst or Perfect, and another tap to stop a special boost. A tap outside a valid timing window stops a normal boost. Physical press IDs survive the held-state adapter, so fixed simulation steps consume one deliberate press once. Input lifecycle clearing cancels the latch; braking still suppresses Nitro.

The main input adapter calls `nitroLatch.sample(physicalPressed, controls.nitroToggle, race.nitro)` before reading `nitroLatch.pressId` into `nitroGesture`. `resolveDriveControls` forwards that optional safe integer to physics. `schoolLessonCopy(lesson, controls)` returns hold- or toggle-specific instructions without changing lesson completion facts.

## Audio behavior and source

Rival panning follows the game's actual driver-right vector and uses three-dimensional distance for attenuation and radial motion. The W3C [StereoPannerNode pan definition](https://www.w3.org/TR/webaudio-1.1/#dom-stereopannernode-pan) specifies negative values for left and positive values for right. `crowdZoneLevel(listener, zones)` accepts actual spectator-zone positions `{x,y,z,radius,strength}`; it fades with world distance and blends overlapping zones by maximum level. Default radius is 95 metres and default strength is 0.4.

The audio graph fades before a 240 ms idle suspension when hidden, inactive, muted, or without race/music/UI-cue demand. After the user's initial unlock, returning demand resumes the existing graph. An interrupted context is left alone until the browser changes its state. A rejected automatic resume waits for another user unlock rather than repeatedly requesting audio. `sound.setPageActive(false/true)` supplies page or renderer lifecycle state; ordinary document visibility is also handled internally. Disposal cancels the idle timer, unregisters listeners and closes all sources. Web Audio [suspend](https://www.w3.org/TR/webaudio-1.1/#dom-audiocontext-suspend) is used to stop processing an idle graph; actual energy savings depend on the browser and device.

Two quiet persistent synthesis layers add exhaust texture and induction/electric motor harmonics, driven by the same smoothed load, rev and shift state as the existing engine. Nitro mode changes restart their pressure onset, including when toggle Nitro remains active. Existing music, engine and effects controls remain separate. These are original authored synthetic sounds, not recorded engines, manufacturer RPM data, or a claim of acoustic realism. No samples or network assets were added. All driving updates reuse the bounded graph.

## Verified records and session retention

`loadRecords(storage, {scope})`, `saveResult(race, frames, storage, {scope})`, `setSound(value, storage, {scope})` and `clearRecords(storage, {scope})` retain their original record return shape. Dynamic scoped storage adapters must pass the exact scope on every call. An adapter can expose `storageIdentity` to share pending session records with its underlying real storage object.

Result screens use `saveResultWithStatus(race, frames, storage, {scope})`, which returns `{records,persisted,pending,reason}`. Success requires an exact read-back of the written payload. Reads denied before a write prevent overwriting an unknown existing PB. Failed writes or verification retain the candidate in memory; menu reloads and slower finishes cannot erase that candidate. The reasons are `unavailable`, `write-failed`, or `verification-failed`; successful receipts have `reason:null`.

`recordSaveStatus(storage, {scope})` returns the status, and `retryRecordSave(storage, {scope})` merges any faster externally stored PB before retrying. Explicit clearing has separate replacement intent, so a failed clear does not resurrect the old record in the session. Session-only records still disappear when the page/process is discarded unless retried successfully or exported.

`exportPendingRecords(storage)` returns the JSON-ready format `camber-reign-unsaved-records`, version 1, with entries `{scope,records}`. `importPendingRecords(json, actualStorage)` validates the complete file, including exact keys, bounded scoped names, record values and ghost frames, before writes. It writes only scoped record keys, merges better times/scores, and preserves current sound choices. Its receipt is `{ok,persisted,pending,imported,entries,error}`; malformed input has `ok:false` and changes nothing. Valid input can have `ok:true,pending:true` if persistence failed, with per-entry receipts and session retention. Other save sections, privacy settings and credentials are untouched.

## Verification limits

Automated coverage exercises real module behavior: obstructed reset/no-mutation, vertical clearance, checkpoint preservation, held/toggle timing, physical press deduplication, stereo headings, crowd-zone distance, bounded synthesis, real-graph suspension/resume and event consumption, failed storage/read-back, scoped retention/retry/export/import, and malicious or malformed backup rejection. These checks do not establish subjective listening quality, real iPad touch performance, speaker/headphone balance, temperature or battery life. Those require physical-device play and listening sessions before making such claims.
