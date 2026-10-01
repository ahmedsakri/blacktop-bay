# Blacktop Bay search and structured-data review

Updated 1 October 2026. Canonical site: `https://blacktop-bay.web.app/`. Current source facts and earlier account observations are distinguished below. The manufacturer-only catalogue and refreshed image integration are prepared for the next release; source and image-format checks have passed; final release approval and deployment remain separate. Local UI checks are recorded separately; this document is not a deployment or visual-approval receipt.

## Current source and content

- The garage contains **16 artist-made manufacturer models across 13 brands**. Model names retain their credited identities, including Audi R8 Custom and GMA T.50 Custom as labelled interpretations. Road cars and classics are not described as different racing variants. Earlier fictional builds are unavailable; retained source assets keep their attribution notices.
- The **34 circuits** comprise nine original Blacktop Bay courses and 25 compact Grand Prix venue adaptations. Every race has three laps, one human player and three computer-controlled opponents; the schema’s human player count remains one.
- The crawlable guide contains **14 visible FAQs and six HowTo steps**, mirrored in JSON-LD. Automatic acceleration, thumbpad and drag steering with release to center, optional tilt with motion permission, automatic drifting, and Nitro as the only on-screen driving button remain. Keyboard steering, optional brake/handbrake and Shift boost remain. Phones require landscape; turning upright pauses.
- Every build offers free paint: **ten curated colours plus Team original**, and **Gloss, Metallic or Satin** finishes. Choices are local to each car and fall back to the current page session when browser storage is unavailable. Guide, README and privacy text describe these limits.
- Five upgrade levels each for Engine, Tyres, Nitro and Handling use earned race credits. Stock figures and local persistence are qualified; no real-money purchase, invented rating, multiplayer or universal performance claim is made.
- Canonicals and sitemap entries cover `/`, `/guide/`, `/privacy/` and `/credits/`. Public robots rules permit crawling. Existing ownership tags and credited assets are preserved.
- Social metadata now references a dedicated 1200×630 promotional render of the actual car models. The game schema’s screenshot and the guide hero retain a separate actual gameplay image; the guide reserves its 1280×800 aspect ratio. Final file checks verified the dedicated social PNG at 1200×630 and actual gameplay PNG at 1280×800. All four game pages agree on their social URL, format and dimensions, and the schema screenshot retains the actual gameplay URL.
- The separate SEO work in commit `fcbf95b` added social metadata, breadcrumbs, sitemap metadata and `llms.txt`. Those changes are preserved. Their presence is not evidence of ranking or AI citation eligibility.

## Consistency validation

The documentation pass verified all 14 visible FAQ question/answer pairs and six step texts against their structured versions, 16 manufacturer guide cards and credit entries, valid JSON-LD, and the absence of retired-car listings in current homepage, guide and `llms.txt` copy. The car and circuit totals match the current source catalogue. Archived release reports retain the counts that shipped in those revisions. Runtime input tests, UI validation and the replacement deployment receipt remain the release owner’s responsibility.

The companion AppsOverFlow build passed 3,045 static checks, four sharing tests, 22 mocked contact-backend checks and 148 mocked contact-client/iframe checks after the artwork integration. Eleven image files passed format and dimension checks, and the Blacktop-only garage disclosure remains closed by default below the primary gameplay preview. No live contact message was sent.

These are local source/content checks. They do not substitute for a remote validator, search-engine indexing evidence or real-device gameplay testing. The final game test/build totals and deployment receipt belong in the completed release record.

## Google and Bing observations — 1 October 2026

The personal account **ahmed.f.sakri@gmail.com** was confirmed in both console interfaces. The latest six-site audit found Blacktop Bay already verified and its exact canonical sitemap already submitted; it did **not** delete, replace or resubmit the sitemap.

| Signal | Observed result |
| --- | --- |
| Google ownership | HTML-tag ownership verified earlier on 1 October; property reports remained accessible |
| Stored Google sitemap report | `https://blacktop-bay.web.app/sitemap.xml`, submitted 1 October; **Couldn’t fetch**, type Unknown, Last read blank, zero discovered pages/videos |
| Actual Google live inspection | **11:13:22 IST, 1 October 2026**: Google Inspection Tool smartphone; Crawl allowed **Yes**, Page fetch **Successful**, Indexing allowed **Yes**, URL available to Google |
| Google homepage inspection | **URL is not on Google / URL is unknown to Google**; indexing remains pending |
| Bing canonical sitemap | Submitted **10/1/2026**, **Processing**, no crawl date, zero errors and warnings; no new submission during the audit |

Google’s inspection tool successfully fetched all six audited sites’ sitemap URLs. That verifies access at the test times, not successful sitemap parsing, a resolved stored processing error or indexing of all listed pages. Five older site homepages were indexed; Blacktop Bay was the pending homepage.

Initial setup earlier that day included sitemap submission and two bounded homepage indexing-request attempts; the requests returned submission errors. The older detail page’s 1 October date is not treated as proof of a successful fetch because the latest table leaves Last read blank. No further homepage request was made during the six-site audit or this documentation work.

## Follow-up and evidence

Recheck stored processing and Blacktop Bay’s homepage after the services have processed the existing submissions. Investigate persistent errors with exact URLs, crawl reports and hosting evidence; no queue reset or cure through repeated unchanged submissions is claimed. Keep ownership tags in place.

- [Current account-side audit with all six live-test timestamps](../../.firebase-indexing-audit/2026-10-01/search-console-observations.md)
- [Independent Blacktop Bay / Super Quest / Fireboy & Watergirl HTTP audit](../../.firebase-indexing-audit/2026-10-01/typography-three-site-audit.md)
- [Initial six-build setup report, preserved as history](./seo-review-initial-2026-10-01.md)
- [Current expansion and browser-test limits](./expansion-release.md)

The shared receipts are under `Games/.firebase-indexing-audit/2026-10-01/`. Schema describes page content; it does not guarantee a special search presentation. Official interpretation: [Google Sitemaps report](https://support.google.com/webmasters/answer/7451001?hl=en), [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview), [structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), and [Google’s AI search guidance](https://developers.google.com/search/docs/appearance/ai-features).
