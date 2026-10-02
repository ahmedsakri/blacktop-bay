# Camber Reign release audit — 2 October 2026

> **Historical receipt; account status superseded later on 2 October.** The original deployment checks and the earlier locked-session account snapshot below are retained as recorded. A subsequent Safari review verified GTM version 3 live for the new hostname, updated GA4 names/stream URL, an AdSense review request, accepted Search Console migration and verified Bing ownership/sitemap submission. Search Console’s submitted sitemap still reports “Couldn’t fetch,” despite a successful live fetch; Bing is processing and AdSense approval remains pending. See [the current mobile and services receipt](mobile-and-services-release-2026-10-02.md) for exact states, evidence and outstanding physical-device validation. The 650-test count below belongs to the original deployment, not the later mobile changes.

Status: **no blocking failures found in the completed automated and HTTP checks**.

The release coordinator confirmed **650 / 650 tests passed** before deployment. This independent audit ran after both the Camber Reign release and the former Blacktop Bay host migration were confirmed live. HTTP evidence timestamp: 2026-10-01T20:09:57.292053+00:00.

## Live hosting and crawl checks

- **73 / 73 sitemap pages** returned HTTP 200 at their canonical URLs. Each page has the expected self-referencing canonical, current Camber Reign title, a description, syntactically valid JSON-LD, and no page-level `noindex` directive.
- The published sitemap matches the production build's 73 URLs, with no duplicates or foreign-host entries.
- `robots.txt` points to the new sitemap. Its current rules allow the checked page URLs for Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot and Google-Extended. This establishes crawl permission, not actual indexing or AI citation.
- `ads.txt` returned HTTP 200 and the expected publisher record: `google.com, pub-7947050514009599, DIRECT, f08c47fec0942fa0`. This does not establish AdSense approval.
- `llms.txt`, `/move-progress/`, and the old host's `/save-transfer/` returned HTTP 200. Both transfer pages are marked `noindex`. The bridge has no opener-severing `Cross-Origin-Opener-Policy: same-origin` header.
- **8 / 8 branding assets** returned HTTP 200 with the expected image content types and bytes matching the production build: full logo, compact logo, animated logo, CR emblem, social image, both loading images, and gameplay image.

## Former-host redirects

**81 / 81 checked legacy URLs returned HTTP 301** to the corresponding new-host path. This covers all 73 sitemap paths and eight additional query/utility cases. Query strings are preserved.

**Nonblocking warning:** 69 checked nested car/circuit redirects first land on a slashless path, followed by a second HTTP 301 to the trailing-slash canonical. Representative car, circuit and guide query routes were followed through to HTTP 200 and the correct canonical. The release coordinator elected to retain these working rules, preserving existing alias behavior.

## Save migration review

The independent review found and fixed a retry path that could overwrite the pre-import backup after a failed rollback. The protocol now writes a durable recovery flag before changing saved progress, refuses another import while recovery is pending, and clears the flag only after verified success or explicit restoration.

**19 / 19 targeted migration tests passed independently**, including the failed-write/failed-rollback reproduction, retries, reload recovery, source/origin/nonce checks, explicit replacement, payload limits, and analytics-consent exclusion. The former-origin save remains untouched.

## Verification limits

This audit checks HTTP responses, published assets, metadata and targeted code behavior. It does not establish search-engine indexing, visual rendering, race behavior, or live popup transfer behavior. The live cross-origin Safari transfer smoke test remains pending because the Mac was locked during this audit. The AppsOverFlow deployment was reported complete by the release coordinator; its separate audit is maintained by the AppsOverFlow agent.

## Published state and remaining account work — historical snapshot

Camber Reign is live at https://camber-reign.web.app/. AppsOverFlow is live with its new listing at https://appsoverflow.web.app/projects/camber-reign/. Both repositories have been pushed to their main branches; the game repository is now https://github.com/ahmedsakri/camber-reign and the local checkout is `/Users/ahmedsakri/Documents/Personal/Games/camber-reign`.

The new logo and lobby were inspected at 1280×800 desktop, 390×844 portrait, 844×390 landscape and 568×320 compact landscape. The transfer page was checked at 390px and 320px, and header/footer links now have at least 44px touch height. Live transfer opening/cancellation was checked, but the in-app browser did not expose the popup as an automatable tab; no saved data was imported during that check.

The Mac locked during Safari account work. The following service actions remain incomplete and must not be described as done:

- GTM: container `GTM-PZHDLVK8` renamed **Camber Reign — AppsOverFlow**. Workspace 3 contains the rebrand import prepared from a fresh current export:2 renamed tags,2 renamed triggers,new production hostname and game_name. Eight workspace changes are ready but **not published**; published version 2 still targets the old hostname. Publish and verify on the new site after unlocking.
- GA4: property 556906819 in account 408407374,measurement ID `G-RC925EV263`, still needs the property/stream names and stream website URL updated. Preserve these identifiers and reporting history.
- AdSense: new site ownership metadata and ads.txt are live for `pub-7947050514009599`; the new site still needs adding and review request. No approval is implied.
- Search Console/Bing: verification metadata, canonicals, robots and 73-page sitemap are live; the new properties, sitemap submissions and Search Console Change of Address are not yet completed. No actual indexing claim is made.

Safari remains open to the existing GTM workspace and GA4 admin for continuation after the user unlocks the Mac.
