# Physical iPhone validation — 2 October 2026

## Verified device and browser

Connected physical **iPhone 17 Pro**, identified by Xcode's device inventory as `iPhone18,1`, paired and available. Safari's Apps and Devices Inspection independently identified **Ahmed’s iPhone / iOS 27.0.1** and exposed `https://camber-reign.web.app/`. The game was inspected through that physical device's Safari Web Inspector, not a simulator or a desktop user-agent override.

The live phone reported a landscape viewport and visual viewport of **874 × 338 CSS px**, DPR **3**, and a screen of **402 × 874 CSS px**. Safari identifies itself as Version 27.0.1; its compatibility user-agent uses the older `iPhone OS 18_7` token. Device identity comes from the device inventory and remote inspector rather than that token.

## Reproduced fullscreen limitation

Read directly from the live phone's page:

- `document.documentElement.requestFullscreen`: `undefined`.
- `document.documentElement.webkitRequestFullscreen`: `undefined`.
- `document.fullscreenEnabled`: absent.
- `navigator.standalone`: `false`.
- `DeviceOrientationEvent.requestPermission`: `function`.

The ordinary Safari tab therefore has no document fullscreen API for the game to invoke. Its browser bars cannot be hidden by calling an absent API. The correct product behavior is explicit capability detection and an honest standalone/Home Screen path, while retaining usable landscape play inside the current browser viewport. This finding is from the existing live build; verification of the follow-up UI change must be recorded separately.

## Input and performance evidence so far

The local review helper `phone-validation-probe.js` was pasted into the physical phone's remote console. It only observes DOM input, motion, visibility and frame callbacks; it does not request permission, synthesize controls, alter game state, store data or transmit it.

The first 20.276-second sample recorded **5 trusted touch starts**, **0 synthetic touch starts**, **1 cancellation**, **4 capture-loss events**, **2 blur events** and **0 page-hidden events**. The page remained in race setup (`Find your challenge.`), and the race clock was **00:00.00**. This is evidence that native touch events reached the game page, not yet evidence of simultaneous racing input. No motion permission had been requested; Safari reported that no device-orientation events would fire until permission was requested.

That initial menu/setup sample had 1,218 frame intervals over 20.198 measured seconds: approximately **60.30 callbacks/s**, median **17 ms**, p95 **17 ms**, p99 **25 ms**, and no interval over 50 ms. These are requestAnimationFrame callback timings for the setup/menu scene, **not sustained racing FPS**.

Subsequent console evaluations stopped resolving. Safari's separate Apps and Devices Inspection window then explicitly showed **“Unlock device with passcode”** for the phone and removed the inspectable game page. This explains the immediate inspection blockage; it is not evidence of a game renderer crash. The current physical test still needs an uninterrupted foreground race run with two-finger steering/Nitro, enabled motion steering and a heat/comfort observation.

## Supporting desktop checks

- 27/27 targeted control tests passed: driving input ownership, drag steering, pad lifecycle and tilt permissions/calibration/stale-sensor handling.
- In the desktop in-app browser at 844 × 390, synthetic pointer events held steering at 85 with Nitro active. Cancelling the steering pointer returned steering to zero while Nitro remained held. Losing capture for the Nitro pointer released it. This is synthetic DOM regression evidence, not physical two-finger evidence.
- Enabling tilt without a sensor stream returned to Touch after the four-second timeout and displayed the expected missing-motion-data message.

## Landscape layout correction and local verification

`src/mobile-viewport.css` now uses the available dynamic viewport height and safe-area insets for the lobby, garage, dialogs and short-screen driving controls. Dialog headings and primary actions remain fixed while longer optional content has one internal scroll region. Race setup keeps its three modes and difficulty visible, with medal targets in a keyboard-accessible disclosure. The garage retains 44 px workshop buttons, and its wider stats column prevents acceleration text overlapping its value on a 568 px landscape screen.

These follow-up checks ran in the desktop in-app browser against the local source build. The **874 × 338** size came from the actual phone inspection; **59 px side insets and 21 px bottom inset were simulated CSS fixture values**. They verify layout under those constraints, not a second physical-device run.

| Local layout case | Verified result |
| --- | --- |
| 874 × 338, simulated 59/59/21 px safe areas | Document remained exactly 874 × 338 with no page overflow. Garage workshop buttons were 44 px high; Race was 48 px high and ended at y313, inside the y317 safe boundary. |
| Race setup at 874 × 338 | Initially no content scrolling; Ready remained 44 px high. Opening Medal targets scrolled only the optional dialog content and kept Ready pinned. |
| Steering settings at 874 × 338 | The steering panel occupied y64.52–245.81 inside the initial y64.52–253 content viewport. Touch, Enable tilt, Recenter and the 44 px sensitivity slider were visible immediately. |
| Active local race at 874 × 338 | Race timer advanced; steering pad was 164 × 76 at x67/y233, Nitro 88 × 88 at x719/y221, and Pause 44 × 44 at x67/y10. Controls and minimap fit without overlap. |
| Garage at 874 × 402, simulated safe areas | No page overflow; workshop controls remained 44 px; Race was 56 px high and ended at y377, inside y381 safe boundary. |
| Garage and setup at 568 × 320, no simulated insets | No document overflow. Stats had at least 12.60 px between acceleration label and value after correction. Workshop buttons were 44 px; Race was 48 px. Initial setup content measured 180 px available / 180 px total. |

The final targeted run passed **33/33 tests** across driving controls, drag steering, steering pad, tilt steering, race career and race options. Temporary viewport, safe-area and touch-emulation overrides were removed after the checks. No physical racing FPS, successful gyroscope drive, or thermal improvement is claimed from these desktop checks.

Saved local screenshots (ignored by Git) are under `/Users/ahmedsakri/Documents/Personal/Games/camber-reign/reports/`:

- `mobile-safe-lobby-874x338-2026-10-02.png`
- `mobile-safe-garage-874x338-2026-10-02.png`
- `mobile-safe-setup-874x338-2026-10-02.png`
- `mobile-safe-setup-568x320-2026-10-02.png`
- `mobile-safe-steering-874x338-2026-10-02.png`
- `mobile-safe-race-874x338-2026-10-02.png`

## Tool and measurement limits

The selected command-line tool directory initially concealed the installed Xcode tools. Running with a per-process `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` found the physical phone without changing machine settings.

Xcode Instruments and direct device sensor streaming cannot mount the developer image because **Developer Mode is disabled** on the phone. No Developer Mode setting was changed and the device was not rebooted. Safari remote inspection works independently once Web Inspector is enabled and the phone is unlocked.

The browser does not expose a device temperature reading. Callback timing is not a GPU FPS measurement. A thermal conclusion requires the user's heat observation or a separately authorized hardware profiling path. The helper's measurement completion flag means its recording duration ended; it must not be used to imply that the entire duration was spent racing.

Evidence images: `physical-iphone-inspector-2026-10-02.png` and `physical-iphone-inspector-lock-2026-10-02.png` (local, ignored by Git).

## Post-deployment access check

The integrated mobile/PWA/collision build was deployed on 2 October after all 797 automated tests and the production build passed. A subsequent Safari device inspection no longer listed the phone under Connected Devices, so no sustained physical run of the updated build was obtained. The earlier 20.276-second menu sample remains the only measured phone session recorded here. Browser layout corrections, active production worker registration and successful desktop contact/recovery checks do not verify physical two-finger driving, successful gyroscope steering or heat improvement.
