# Mobile and services release receipt — 2 October 2026

Status: **mobile, collision-rendering, visual, PWA and documentation changes deployed**. The integrated release passed all **797 tests** and its production build before deployment to [Camber Reign](https://camber-reign.web.app/). This receipt supersedes the account-work status in [the earlier migration audit](camber-reign-release-audit-2026-10-02.md), while preserving that audit’s historical deployment evidence. Physical sustained-phone validation remains incomplete; deployment and account checks do not establish a phone performance result.

## Verified service state

The release coordinator checked these states in the authenticated Safari accounts on 2 October. Times below are the times displayed by the relevant service; no timezone conversion is inferred.

| Service | Verified state | Remaining limit |
| --- | --- | --- |
| Google Tag Manager | Container `GTM-PZHDLVK8`, version **3**, is live. Published 2 October at **08:12**, titled **Camber Reign domain migration**. The production hostname target is `camber-reign.web.app`; the old hostname is no longer the target. | Publication is verified; it is not by itself an end-to-end analytics delivery test. |
| Google Analytics 4 | Property **Camber Reign**; web stream **Camber Reign Web**, website URL `https://camber-reign.web.app/`. Existing property `556906819`, account `408407374` and measurement ID `G-RC925EV263` are retained. | No reporting-history reset or new measurement ID was required. Live ingestion is not established by the settings review alone. |
| AdSense | The new domain is present, **Getting ready**, with **Review requested** on 2 October at **08:14**. | Approval remains pending. The dashboard says **ads.txt Not found**, while the live `https://camber-reign.web.app/ads.txt` returns HTTP 200. The dashboard discrepancy remains unresolved; HTTP success does not establish approval. |
| Google Search Console | New property exists; the old-to-new **Change of Address is accepted**. The sitemap was submitted on 2 October. A live sitemap inspection at **09:51:41** successfully fetched it using **Google Inspection Tool smartphone**: **Crawl allowed: Yes**, **Indexing allowed: Yes**, **URL is available to Google**. | The submitted sitemap report still says **Couldn’t fetch**, with **zero discovered URLs**. A live inspection succeeds independently of sitemap processing. No indexing success is claimed. No redundant sitemap resubmission or indexing request for the XML was made. |
| Bing Webmaster Tools | Ownership of the new root property was verified using the existing metadata token, under the authorized account. The sitemap was submitted on 2 October. Dashboard: **1 known sitemap**, **0 errors**, **Processing**, **0 discovered URLs**. | Processing and indexing remain pending. No indexed-URL count is claimed. |

Account evidence saved locally under `reports/` (PNG files are ignored by Git):

- `bing-camber-submitted-2026-10-02.png`
- `google-sitemap-live-test-2026-10-02.png`

The live application retains consent-gated GA4 through GTM; advertising consent stays denied and no advertising script or ad unit is active. This work did not grant broader account access or imply any search ranking, rich-result or AI-citation guarantee.

## Mobile display and rendering changes

The physical iPhone 17 Pro’s Safari page exposed neither standard nor prefixed document fullscreen methods. The screen-mode control now detects capability, reports actual fullscreen state, and gives the Home Screen route when the API is unavailable: Safari Share → Add to Home Screen → keep **Open as Web App** on → launch the game icon. The manifest and icons support a standalone web app. **Offline racing is not implemented**, and the help explicitly says an internet connection is required.

The requested PWA package adds a manifest ID/scope, language, game categories, description, honest regular-icon purposes and shortcuts to Cars, Circuits and the Driver’s guide. `src/pwa.js` registers only in the production integration, captures a browser-supplied installation event and consumes it only after an explicit user action. Accepted prompts are not reported as completed installation until the browser confirms it. Unsupported browsers retain the normal website and platform instructions.

The service worker stores only seven reconnect-screen resources, totaling less than 150 KB: the offline HTML and Retry script, compact logo, two app icons and two local fonts. Same-origin navigation tries the network first, preserves ordinary HTTP errors such as 404, and falls back to the branded reconnect screen on a network or server failure. It does not cache game pages, car models, save data, query-bearing asset requests, cross-origin requests or analytics. Updates do not call `skipWaiting`, claim current clients or reload the page; cleanup removes only older caches with this app’s reconnect prefix. The fallback requires a successful online worker installation first. This is connection recovery, not offline gameplay.

Short landscape layouts use dynamic viewport height and safe-area insets. Lobby, garage and racing controls fit the reduced browser viewport; dialog headers and primary actions stay visible while longer content scrolls internally. Steering appears first in help/pause content, with optional Sound and Display sections collapsed. Medal targets are an accessible disclosure, leaving race modes and difficulty visible initially. Compact garage stats have enough width to avoid label/value collisions.

Automatic graphics now selects **Performance** on phones: pixel ratio capped at 1, shadows off, bloom off and reflection off. Explicit graphics choices remain available. The mobile frame budget caps menus/garage at **30 updates/s**, paused views at **15 updates/s**, and racing/countdown/finished views at **60 updates/s**. A hidden page skips render/simulation work. These are workload caps, not measured delivered FPS or a claim that heat has been resolved.

## Collision visibility and visual improvements

A large dark rectangle after real racing impacts was reproduced in the desktop browser using post-processing graphics settings. Disabling the bloom pass while the race remained active immediately restored the view; the WebGL context had not been lost. Bloom is now limited to lobby and garage scenes. Racing, countdown, pause and finish views retain normal scene lighting and applicable anti-aliasing without the problematic bloom pass. The lower-level shader cause was not established, so this receipt does not assign it to a specific driver, NaN or alpha defect.

After the correction, actual local browser racing included repeated barrier impacts, visible damage and recovery with the track remaining visible for more than three minutes. The local screenshot `contact-clear-desktop-2026-10-02.png` records the corrected view at 1280 × 800. This is browser gameplay evidence, separate from the deliberately staged crash renderer fixtures.

The release also adds bounded severe-impact pitch/roll and road support, temporary body dents and small detached surface patches, followed by validated recovery behind the last legal progress. Geometry is owned only by the damaged instance; pristine manufacturer templates and other cars remain unchanged. This remains an arcade approximation rather than soft-body vehicle simulation or authored detachable doors. The refreshed Nitro pickups use a metal-and-glass canister with valve, charge gauge, clamps and ground locator. Garage surfaces, nearby fan/marshal stations and vegetation were refined; distant crowds remain simplified for performance. See the [crash-depth review](crash-depth-2026-10-02.md) and [visual-quality review](visual-quality-2026-10-02.md) for implementation limits.

## Validation recorded

- **33/33 targeted tests passed** for driving controls, drag steering, steering-pad lifecycle, tilt steering, race career and race options before final integration.
- **8/8 PWA tests passed** for registration timing/idempotence, single-use user-gesture prompting, accepted/dismissed/denied outcomes, installed-state detection, failure tolerance, the cache size boundary, safe activation, fresh navigation/fallback, and exclusion of models/analytics/cross-origin/POST requests.
- Local browser layout checks passed at **874 × 338**, using simulated 59 px side and 21 px bottom safe areas, and at **874 × 402**. These fixtures use the actual phone’s measured browser dimensions but are desktop browser checks.
- At **568 × 320**, the corrected garage and initial race setup had no document overflow. Workshop controls remained 44 px high and Race remained 48 px high. The acceleration label/value gap was at least 12.60 px after correction.
- At **874 × 338**, the initial steering panel and 44 px sensitivity slider were visible without scrolling. Race setup’s Ready action stayed fixed while optional medal content expanded. Actual local browser gameplay advanced its race clock with steering, Nitro, Pause and minimap fitting inside the safe area.
- Synthetic simultaneous steering/Nitro lifecycle checks passed in the desktop browser. Cancellation released only the owning pointer, and capture loss released Nitro. This is not physical two-finger evidence.
- The actual connected iPhone produced five trusted touch starts during a 20.276-second menu/setup sample. Its 1,218 measured frame intervals averaged approximately 60.30 callbacks/s, with p95 17 ms; **this was not a racing run**. Remote inspection subsequently displayed **Unlock device with passcode** and the inspectable game target disappeared.

The physical sustained racing, simultaneous steering/Nitro, successful gyroscope driving and heat/comfort checks **remain unverified**. After deployment, the phone no longer appeared in Safari’s Connected Devices list, so an updated-build physical run could not be completed. No temperature reading is available from the browser, and menu callback cadence cannot establish racing FPS. See [the detailed physical-phone receipt](physical-phone-validation-2026-10-02.md) for identities, measurements, tooling limits and screenshots.

## Final release validation

| Check | Result |
| --- | --- |
| Full integrated automated suite | **797 passed, 0 failed, 0 skipped** for both the integrated release and the final documentation deployment. The final mandatory predeploy suite completed in **234.55 seconds**. |
| Production build | Integrated release built successfully in **554 ms**; final documentation build passed in **362 ms** through the normal predeploy hook. The existing large-bundle size advisory remains; it did not fail the build. |
| Hosting deployment | Both releases published successfully to site **camber-reign**, project **echo-heist**, with **243 files**. The integrated release uploaded **86 new files**; the final documentation release uploaded **3 changed files**. No other Firebase site was targeted. |
| Post-deployment HTTP checks | The coordinator verified 12 live assets against local `dist`. A separate receipt check re-fetched the root document, JS, CSS, manifest, worker and offline HTML with TLS verification and found all six byte-identical to `dist`. After the final deployment, `/guide/`, `/privacy/` and `/llms.txt` also matched `dist` byte-for-byte; the obsolete no-cache claim was absent from the live guide. |
| Live worker and cache | Production service worker `/sw.js` was **activated**, scope `/`, with an active page controller. Its named reconnect cache contained exactly the seven expected paths listed below. |
| Connection fallback | Eight PWA tests cover network/server failure fallback, lifecycle and request exclusions. Direct reconnect-page browser checks passed at **390 × 844** and **568 × 320**, with visible 48 px actions and no horizontal overflow. Per-tab offline emulation did not interrupt the worker’s network request, so a true offline browser fetch was **not** established by that attempt. Normal networking was restored. |
| Documentation consistency | Guide installation/offline FAQs and matching JSON-LD, the privacy notice, README and `llms.txt` describe optional installation and bounded reconnect storage without claiming offline racing. All **28 targeted PWA, save-migration and hosting-policy tests passed** after this update; the guide JSON-LD parsed and both affected answers matched visible text exactly. |
| Updated-build physical iPhone sustained input, motion and heat check | **Not completed**: the phone disappeared from Safari’s Connected Devices list after deployment. Neither browser-sized checks nor menu timings substitute for this test. |

Verified live reconnect cache:

- `/offline.html`
- `/assets/offline.js`
- `/assets/logo-compact.svg`
- `/assets/app-icon-192.png`
- `/assets/app-icon-512.png`
- `/assets/manrope.woff2`
- `/assets/barlow-condensed-extrabold-italic.woff2`

### Production asset fingerprint

The integrated release and local production output matched these SHA-256 values:

| Asset | SHA-256 |
| --- | --- |
| `/` (root HTML) | `ca3f155d79bd2a140a3eac1e5bf2e01321a6efd89cc2dcf90377d1eba839805e` |
| `/assets/game-DyFzADKl.js` | `9ade6ee3c9e20393cba60a5a644de328d2edc41b03e82abb33fb1b3368a8908c` |
| `/assets/game-BafRMnBh.css` | `264ccbbb0b07e6742eda269c428415ca2ee37609994ec52cdbc04ead89d450d6` |

The final scoped command `firebase deploy --only hosting --project echo-heist --account ahmed.f.sakri@gmail.com --non-interactive` completed successfully on **2 October 2026**, running the configured full test and build hooks. The local command log is `/tmp/camber-pwa-documentation-release-2026-10-02.log`. The commit containing this receipt is the source release reference; its identifier is reported with the completed push.

Final documentation fingerprints: `/guide/` `af84741452250ec1d8db415aa49f55459c47a57e2234feb48827c639fd7a7e31`; `/privacy/` `1e94033c40ff4ae581bb470a3875dfe3ca991e3b1c79e80ca67bba1cc7eff6ae`; `/llms.txt` `fc67c1c769e500dea5f397fdd34485cb785d733c20f1ced7459ea7dde511198f`. The game JS and CSS filenames and fingerprints stayed unchanged in this documentation-only deployment.

The earlier audit’s **650/650** count belongs to the prior migration release. Local review fixtures and diagnostic helpers remain excluded from the production build; untracked fixtures are not part of this source release.

Implementation references: [MDN’s install-prompt guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt) and [the service-worker lifecycle](https://web.dev/articles/service-worker-lifecycle). Browser installation prompts vary by platform; retaining the normal waiting lifecycle avoids replacing an active page’s worker during a race.
