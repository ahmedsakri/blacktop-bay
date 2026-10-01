# Blacktop Bay — manufacturer collection verification

1 October 2026. Local release preparation against base commit `9f4b86f`; this report does not establish a commit, deployment or production verification.

## Verified scope

- The runtime catalogue contains **16 manufacturer models across 13 brands**, with **34 circuits**. The twenty fictional builds are excluded from selection, search and race tuning. Retired or invalid selections resolve to the McLaren P1 GTR. Retained historical assets keep their attribution and explicit geometry-test helpers.
- Manufacturer upgrades and paint remain associated with their existing IDs. Saved fictional-car upgrade and paint records remain stored, but cannot receive new purchases or paint changes. Wallet balances and reward receipts survive migration; existing per-car race-record storage keys are untouched.
- Blue Nitro plumes follow actual active boost, use bounded particle pools, fade after release, freeze while paused and clear at race finish/restart/manual reset. Electric cars use a rear energy wake without fabricated exhaust flames. Reduced motion lowers emissions and removes the bright core.
- A selected-model download failure leaves the saved choice intact and presents a reload action. A failed optional opponent download reuses the already prepared manufacturer body with the matching race identity. Garage selection constructs the replacement before disposing the current car.
- The loader now includes responsive decorative artwork: landscape and portrait WebP sources, a dark text overlay, a short reveal and reduced-motion support. Its existing status and progress display remain; progress represents initialization phases, not measured download bytes.

## Evidence and limits

`npm test` completed **403 tests: 403 passed, zero failed, cancelled or skipped**, in **51.1 seconds**. Evidence: `/tmp/blacktop-branded-release-tests.log`. Coverage includes all sixteen cars at stock and maximum upgrades on the five launch circuits, manufacturer asset lifecycle/failures, saved progress, paint, privacy consent, controls, race results and Nitro cleanup. A focused read-only runtime audit found no concrete regression.

Source counts and loader references were checked directly. At this snapshot, loader files are 1536×864 and 900×1200 WebP, the social image is a 1200×630 PNG, and the separate gameplay image is a 1280×800 PNG. Social/loading promotional artwork is **not gameplay evidence**; generated or staged renders must not be described as captured play. The cinematic AppsOverFlow artwork was checked in desktop and mobile layouts, with the full car silhouette contained in the carousel and collection cards. Website verification passed 3045 checks and four sharing tests. The short-landscape loader was inspected at 568×320; logo object-fit preserves its aspect ratio. Publishing is tracked separately from this local verification snapshot.

Physical-phone gyro permission, calibration and driving have **not** been verified on real hardware. Automated motion tests and resized browser checks do not establish that result or performance on every phone. Local review fixtures under `reports/` are not production pages.
