# Blacktop Bay external services

Verified 1 October 2026 against the deployed game at https://blacktop-bay.web.app/. The intended personal Google account, `ahmed.f.sakri@gmail.com`, was confirmed in the signed-in UI. Unrelated properties, containers and sites were not changed.

## Google Analytics 4

- Analytics account: AppsOverFlow — `408407374`.
- Separate property: Blacktop Bay — `556906819`.
- Web stream: Blacktop Bay Web — `15905095856`.
- Measurement ID: `G-RC925EV263`.
- Website: `https://blacktop-bay.web.app`.
- Property timezone: India (GMT+5:30); currency INR; industry Games.
- Enhanced measurement is off. Collection comes from the initial Google tag page view and the game's bounded event allowlist.

[Realtime report](https://analytics.google.com/analytics/web/?authuser=1#/a408407374p556906819/realtime/overview) visibly confirmed one active user and a Blacktop Bay page view after production testing. Its event table showed `car_select` (2), `garage_open` (2), `race_pause` (2), `race_resume` (1), `race_start` (1), `page_view` (1), and the automatic `first_visit`, `session_start` and `user_engagement` events. These are release-test observations, not an audience or traffic claim.

The production browser check confirmed that a fresh page without consent loaded no Google analytics script. After **Allow analytics**, GTM and its Google tag loaded successfully and collection returned HTTP 204. The Realtime report independently confirms receipt.

## Google Tag Manager

- Account: Ahmed Sakri — `6376312213`.
- Isolated container: Blacktop Bay — AppsOverFlow — internal ID `265751993`.
- Public container ID: `GTM-PZHDLVK8`.
- [Version 2 is published](https://tagmanager.google.com/?authuser=1#/versions/accounts/6376312213/containers/265751993/versions/2).
- The existing shared AppsOverFlow container was inspected read-only and left unchanged.

The container has two native tags: one Google tag and one GA4 event tag. Both are restricted to hostname `blacktop-bay.web.app` and require analytics storage consent. There is no Custom HTML consent tag and no separate direct Google-tag loader in the game.

Allowed custom events: `race_start`, `lap_complete`, `race_complete`, `race_pause`, `race_resume`, `car_reset`, `car_select`, `circuit_select`, `garage_open`, `nitro_use`. Optional event fields are bounded circuit/vehicle identifiers and numeric position, duration, drift score, resets and lap. Page location excludes the query and fragment; page referrer is origin-only. Optional fields are cleared between events.

The game sets consent before loading GTM. Analytics requires an explicit opt-in; advertising storage, ad user data and ad personalization remain denied. Google signals and ad-personalization signals are disabled. Withdrawal updates consent, disables this measurement ID and removes matching first-party Analytics cookies where accessible.

## AdSense

- Existing publisher: `pub-7947050514009599`.
- Site: `blacktop-bay.web.app`.
- [Site review page](https://adsense.google.com/adsense/u/1/pub-7947050514009599/sites/detail/url=blacktop-bay.web.app).
- Ownership verification succeeded using the deployed HTML meta tag.
- **Request review** was submitted. The UI explicitly confirmed **Getting ready** and **Review requested**.
- Approval is pending Google's review. No approval or revenue is implied.
- Auto ads for Blacktop Bay remain off. No ad unit or ad-serving script was added, and no new legal terms were accepted.

Production returned HTTP 200 for the home page and `/ads.txt`. The home page contains the matching `google-adsense-account` meta tag, and the ads.txt record is:

```text
google.com, pub-7947050514009599, DIRECT, f08c47fec0942fa0
```

The initial AdSense list still displayed ads.txt as **Not found** before the review request; the live file was independently verified. This report does not claim that AdSense has refreshed its ads.txt crawler status. The accepted `web.app` site was verified and submitted without requiring a custom domain.

Google's relevant guidance: [site verification and review](https://support.google.com/adsense/answer/12169212?hl=en), [getting a site ready](https://support.google.com/adsense/answer/7584263?hl=en), [site statuses](https://support.google.com/adsense/answer/12170222?hl=en), and [public-suffix platform sites](https://support.google.com/adsense/answer/12170421?hl=en).

## Search verification

The dedicated search review is in `reports/seo-review.md`. Its verified outcomes are:

- Google Search Console ownership verified; sitemap submission confirmed. The first processing report says **Couldn't fetch / Sitemap could not be read**. A homepage indexing request failed with a Google “problem submitting” message and is not confirmed.
- Bing ownership verified; the submitted sitemap appears with status **Processing**, zero errors and zero warnings, with no crawl date yet.

These pending processing outcomes are separate from ownership verification and do not mean the site has been indexed. Retain the verification tags and revisit the processing reports later.
