# Blacktop Bay — release verification

Date: 2026-10-01

- Production build completes; dependencies install with no reported audit vulnerabilities.
- 24 automated checks pass: forward driving and braking, actual drift/slip and score banking, collision/reset, fixed-step consistency, backward/teleport lap guards, and validation/persistence of record and ghost data.
- Scripted driver completes three real laps in 143.108 seconds with no collision or reset. The finish UI was exercised with that simulation’s output, followed by Race Again and confirmation of the personal-best ghost. Temporary browser fixture hook removed before production.
- Browser start, countdown, controls, car reset, keyboard pause/resume, result screen, replay transition, privacy dialog and clear-records flow verified.
- Responsive checks: desktop 1280×720, phone 390×844, small phone 320×568, landscape 844×390. No horizontal overflow found; landscape home content was shortened to keep actions above footer. Touch UI uses separate steering, brake and drift pads.
- Desktop frame-pacing sample averaged 17.94 ms (~56 fps) across 85 frames after warmup. This is one local machine/browser measurement, not a guarantee for all hardware.
- Actual game artwork reviewed and corrected: rear mesh seam, glass shadows, lamp color, diffuser/exhaust depth, road reflections, foliage, skyline, clouds, water, and lighting.
- The game is an original stylized real-time 3D interpretation of the visual concept. It is not a photorealistic rendering or an exact licensed model of a real vehicle.

## Follow-up integration

Blacktop Bay has its own Firebase Hosting site. AppsOverFlow catalog integration was inspected but not changed because that checkout has concurrent SEO/guide work. It currently needs a catalog entry, guide data, screenshot sizes, explicit card copy and updated totals/verification expectations.
