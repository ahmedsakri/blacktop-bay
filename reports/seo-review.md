# Blacktop Bay search and structured-data review

Reviewed: 1 October 2026. Scope: Blacktop Bay only, at `https://blacktop-bay.web.app/`.

## Source changes

- The home page has a canonical URL, descriptive search/social metadata and `VideoGame` JSON-LD identifying AppsOverFlow as publisher, a free USD 0 offer, operating system `Any` and one human player. Three AI opponents do not increase `numberOfPlayers` to four.
- The metadata and static guide describe six race builds: Apex GT, Apex Sprint, Torque R and Torque RS in the GT family, plus Vortex P1 and Vortex X in the open-wheel Formula family. The guide links licensed model sources and does not claim six independently modelled originals. They describe three circuits, three laps, three AI rivals, drift scoring and rechargeable nitro. No ratings, reviews or performance promises were invented.
- `/guide/` provides an answer-first introduction, a visible update date, six numbered instructions and twelve visible FAQs. `HowTo` and `FAQPage` JSON-LD use exactly the same step names, question names and answer text as the visible page.
- Canonical URLs and sitemap entries cover `/`, `/guide/`, `/privacy/` and `/credits/`. The dated entries reflect this substantive update. Game and guide entries reference the existing actual gameplay screenshot at `/assets/blacktop-bay-gameplay.png`.
- Existing three-car workshop saves migrate to six cars while preserving credits, purchased levels and recent reward receipts. Added builds start with zero-level upgrades.
- Guide and metadata cover five levels each of Engine, Tyres, Nitro and Handling, with the exact credit costs, finish rewards, drift bonus cap and locally saved per-car progress. Stock speed and tank figures are labelled accordingly. Purchases use earned game credits; there are no real-money payments.
- `robots.txt` allows crawling of public pages and rendering assets and advertises the sitemap. This also permits compliant AI crawlers governed by its wildcard group; it does not force a crawler to visit or cite the site.
- Google and Bing site-ownership meta tags were obtained from their signed-in consoles and added to the home page head. Existing AdSense metadata was preserved. Game UI markup was not changed in this SEO pass.

## Current search-feature guidance

`VideoGame`, `FAQPage` and `HowTo` are schema.org descriptions, not a promise of a special Google listing. The old advice that Google FAQ results are limited to government and health sites is now historical: Google retired FAQ rich results on **7 May 2026**, then removed their documentation in June. [Google Search documentation updates](https://developers.google.com/search/updates).

Google retired HowTo rich results on **13 September 2023**, including desktop. The guide retains useful, visible instructions and their semantic markup without claiming HowTo search eligibility. [Google's HowTo and FAQ change announcement](https://developers.google.com/search/blog/2023/08/howto-faq-changes?hl=en).

Google's AI search guidance recommends crawlable, useful textual content and structured data that agrees with the page. It requires no special AI schema or AI text file. We have not added a speculative `llms.txt` or claimed that this work guarantees AI citations. [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features).

The player count follows schema.org's definition of people participating. The free offer describes actual access; there are no invented customer reviews to pursue an app rich result. [VideoGame vocabulary](https://schema.org/VideoGame), [FAQPage vocabulary](https://schema.org/FAQPage), [HowTo vocabulary](https://schema.org/HowTo), [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

Sitemap dates should be revised for significant page changes, not automatically on every build. `priority` and `changefreq` are omitted because Google ignores them. [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Validation completed

- Parsed both JSON-LD scripts successfully as JSON.
- Compared all twelve FAQ question/answer pairs and all six HowTo step names/text against the actual visible HTML: exact matches.
- Checked numbered step anchors, visible update date, single instances of both ownership tags, one-human player range and USD 0 free offer.
- Parsed the sitemap as XML; checked all four canonical page URLs and the local screenshot asset.
- Checked for duplicate content-section IDs and whitespace errors (`git diff --check`).
- Checked the guide's controls, vehicle limits, nitro capacity, circuit lengths, upgrade prices, credit rewards and 15-minute record/reward limit against the implementation.

These are source and consistency checks. They are not a Google Rich Results Test, a schema.org remote-validator certification, an SEO score or proof of search indexing.

## Search Console and Bing status

The intended personal account was confirmed in both native Safari console UIs. Existing unrelated properties were left unchanged. Blacktop Bay was absent from each property list before setup.

| Service | Observed status | Remaining step |
| --- | --- | --- |
| Google Search Console | Blacktop Bay URL-prefix ownership flow opened; HTML-tag token obtained and added to source. | Deploy, verify ownership, submit `/sitemap.xml`, then inspect URL status. |
| Bing Webmaster Tools | Blacktop Bay manual add-site flow opened; HTML-tag token obtained and added to source. | Deploy, verify ownership and submit `/sitemap.xml`. |

At this checkpoint, neither service has confirmed ownership or sitemap submission. No indexing request or successful indexing is claimed. Verification and submission results must be appended only after the deployed site and console success states are observed.

## Follow-up after deployment

Confirm live HTML, guide, screenshot, sitemap and robots responses; complete ownership verification and sitemap submissions; inspect the home and guide URLs. A submitted sitemap or indexing request is a discovery signal, not a guarantee of crawling, indexing, ranking or a particular search presentation. Retain the ownership tags after verification.
