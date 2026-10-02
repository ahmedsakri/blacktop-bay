# UI reliability and visual consistency review — 2 October 2026

Local implementation only. No deployment is recorded by this report. Browser evidence below is from the actual game renderer in the coordinating task; it is not a simulated gameplay fixture.

## Changes

- The lobby race panel preserves each row's natural height. Short desktop windows use a horizontal circuit card and a bounded scrolling panel; long titles and goals wrap. Primary buttons retain at least 44 CSS px targets.
- Portrait scrolling content has a separate viewport above the fixed navigation, including safe-area space. Footer links wrap instead of sharing the navigation's painted area.
- Settings retain readable labels, visible yellow keyboard focus, 44 px disclosure targets, and native editable controls. Result supporting text uses the shared muted text colour.
- `dialog-navigation.js` preserves the original external opener across nested views. Back resolves a newly rendered parent launcher by its stable ID or data attribute, opens its enclosing disclosure, and focuses it. Close clears parent history and falls back to an available control when the original launcher was removed, hidden, or made inert. The focus trap includes disclosure summaries.
- How-to-play and controls settings explain the final tap-mode Nitro contract: a second tap in the Burst or Perfect window upgrades the active boost; a tap outside a timing window, or after the upgrade, stops it. The illustrated restart and download icons are used for record recovery.
- Result personal-best persistence comes from the storage receipt. Pending records are described as available for this session, with Retry save and Export unsaved records actions. Unknown persistence never claims that a record was saved. A successful verified receipt displays the saved confirmation.

## Verification recorded so far

- 22 focused tests passed: 18 across dialog navigation and race-result presentation, plus four graphics recovery lifecycle checks. They cover replacement launchers, collapsed disclosures, unavailable openers, parent-history cleanup, focus trapping, explicit save receipts, unsaved recovery actions, and existing actual-result/controls behavior. The graphics tests execute the application orchestration with controlled GPU/browser boundaries: they cover explicit resume after restoration, a timed-out old attempt resolving after a newer success, a stale rejection, and another context loss during restoration. These are deterministic lifecycle tests, not physical GPU evidence. Whitespace checks passed for the changed UI files.
- Actual renderer at 1280 × 720: Browse circuits spans y=293.5–337.5; race setup spans y=395–439; Race now spans y=445–501. These actions do not overlap. The existing long Maserati GranTurismo MC Stradale label fits.
- Settings → Your controls & comfort → Save backup → Back returned to the settings dialog with visible focus. The final Got it action returned focus to `#how`, instead of the document body.
- Coordinating browser checks found no action overlap at 1366 × 768, 1280 × 800, 844 × 390, or 568 × 320 before the portrait-specific correction.
- The initial 390 × 844 check found footer links covered by fixed navigation. The 320 × 568 view required scrolling to reach Race now. The final 390 × 844 and 320 × 640 checks passed: no horizontal overflow, 44 px Privacy targets, footer links fully above fixed navigation at scroll end, and focus returned after Privacy closes. At 390 px, scrollTop was 91 with Privacy y=708–752 and navigation y=774 onward; at 320 px, scrollTop was 295 with Privacy y=504–548 and navigation y=570 onward.

## Remaining evidence

Verify 200% zoom and realistic long circuit/campaign text; final portrait scroll checks are recorded above. Complete an actual failed-save/retry/export interaction after root wiring, and the full build/test release checks. Keep any retained screenshots with the final coordinated release report. This worker could not acquire a browser provider; native Chrome control was also blocked by ongoing user interaction, so it did not claim independent browser or physical-device verification. Physical iPhone heat, battery, safe-area and simultaneous touch testing remain distinct from browser emulation.

## Peer review boundaries

A focused source review covered the actual race timing, graphics restoration, car-selection warmup, and tour transaction orchestration. The review identified missing generation checks around interrupted restoration and a known-journal storage-denial edge; the coordinating implementation added guards. An in-memory denial reproduction then returned `recoveryRequired: true` while retaining the journal and previous-selection recovery data. Short ordinary stalls use the physics accumulator; long interruptions request an explicit pause. Browser context-loss checks belong in the final coordinated report.

The six flagship finish profiles were reviewed at source level: only authored paint materials receive their factory clearcoat profile; maps, metalness, roughness, glass, badges and carbon keep their source properties, and saved custom finishes still override the factory finish. Actual appearance remains subject to the rendering task's visual checks. Engine, tyre and crowd audio remain original procedural synthesis; no real engine recordings or manufacturer-measured audio accuracy is claimed.
