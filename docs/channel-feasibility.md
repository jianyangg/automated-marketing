# Channel and business-module feasibility

Research date: October 13, 2026. Integrations are optional, capability-specific, and uncommissioned. No account access was verified during this research.

## 1. Select a route from the business goal

The generic framework chooses where a relevant audience can discover, understand, try, buy, book, or return to an offer. A new brand inherits no social network, account, publishing cadence, analytics provider, or budget.

R1 can produce a complete campaign/change/export pack without an integration. Automated external writes require R2/R3 commissioning. Provider access is not guaranteed merely because an API or another product's connector exists.

| Module | Useful outcome | R1 output | Later execution gate |
| --- | --- | --- | --- |
| Manual distribution | Any owner-permitted channel | Exact copy/assets/alt text/account/time/link/manifest and receipt entry | Owner performs action; actual result is recorded/verified |
| Social | Relevant awareness, conversation, or referral | Intentional channel variants and proof | Tested account/action/format permissions and recovery |
| Website/conversion | Clearer proposition, proof, booking, trial, or purchase journey | Audit and concrete change/asset pack | Owner-authorized CMS/repository/deployment route |
| Search content | Useful discoverable answers and refreshes | Research, cited draft, metadata, internal-link/refresh brief | Editorial acceptance and commissioned publishing |
| Email/lifecycle | Opt-in nurture, onboarding, retention | Sequence, audience/consent rules, measurement plan | Approved list, sender/unsubscribe/delivery capability |
| App acquisition | Accurate store proposition, proof, and installs | Listing/screenshot brief, campaign links when real tokens exist | Store roles, release evidence, reports, separate write approval |
| Commerce | Offer/catalog accuracy and purchase journey | Product facts, campaign, destination/retention brief | Selected catalog/store access; price/stock freshness |
| Service/local | Qualified requests, appointments, or visits | Geographic offer/public-language research and booking-path work | Actual business eligibility, capacity, location/account proof |
| Paid distribution | Qualified incremental acquisition | Creative/measurement/budget proposal only | Separate ad-account access and explicit spend/stop policy |

## 2. Capability registry

Record each action per brand/account/adapter/API version: discovery/read, draft/export, schedule/publish, supported media, historical metrics, comments, DMs, reviews, cost, auth/renewal, limits, and reconciliation.

States: not requested, needs setup, needs provider approval, read-only, tested write, degraded, manual-only, disabled by owner. A posting connection does not imply inbox or analytics access. An unavailable message source is not an empty inbox.

## 3. Selected platform contracts

### Instagram

Meta's primary collections distinguish Instagram Login and Facebook Login. Instagram Login supports professional accounts without a linked Facebook Page and uses the business permission family; Facebook Login has different account/Page prerequisites and scopes. Format/account restrictions vary. Do not mix the two models. [Meta Instagram Login](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login), [Meta Facebook Login](https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login)

Commission the selected route: current scopes/review, account identity, expiry/renewal, media reachability/processing, formats/limits, and background access. Persist staged container/status/publish identifiers. Test each added format separately. [Meta publishing examples](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-db99ce99-bf76-475c-8b76-718576c11cae)

### Threads

Meta's collection documents authenticated container/publish operations, formats, and reply controls. Publishing, replies, and metrics require independent capability verification. Avoid auto-publish request options while preparing drafts. [Meta Threads API](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api?entity=request-34203612-f8bf85ba-a2a2-47f8-9183-f94cd3e9c9d3)

Check provider-managed cross-posting before standalone delivery. A mirrored Threads post and explicit Threads job are competing delivery paths, not two independent intended posts.

### X

X documents consumption-based billing with different resource rates. Its current public page lists different prices for reads, ordinary creation, and creation with URLs; a uniform cheap per-post assumption is invalid. Quote the actual intended action, reserve its cost, and reconcile charges. A connection starts with no spending permission. [X developer pricing](https://developer.x.com/?lang=en)

### LinkedIn

Organization/member permissions and restricted reads differ, and API versions require maintenance. Personal publishing access does not establish historical analytics or organization administration. Verify role and current API version for each requested action. [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-06)

### YouTube

Quota/audit requirements and actual public/private upload behavior must be tested for the configured project. Returned public documentation contained mixed wording about unverified uploads; this specification does not hard-code that behavior or a numeric quota. [Quota/compliance](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits?hl=en), [Video resource](https://developers.google.com/youtube/v3/docs/videos)

### App Store

This is an optional business module. Use the owner's real app ID, intended markets, release status, campaign token/provider token, and available reports. Never assume a source-code feature is released.

Apple defines campaign parameters, attribution windows, minimum counts, and reporting delays; detailed low-count data can be suppressed/combined. Website UTM clicks cannot reconstruct a person-level install join. [Campaign links](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links)

Product-page tests and Custom Product Pages support different experiments. Retain sample, reported confidence/status, and inconclusive outcomes rather than applying an early winner automatically. Start with manual report import until owner roles/keys are verified. [Product Page Optimization](https://developer.apple.com/help/app-store-connect-analytics/acquisition/product-page-optimization), [Custom Product Pages](https://developer.apple.com/help/app-store-connect-analytics/acquisition/custom-product-pages)

No device app build is needed to use the framework. If a campaign requires new device-specific behavior/assets that require compilation, that becomes a separate owner/product engineering dependency.

## 4. Existing publishing backends

An adapter may target a separately selected publishing system rather than every provider directly. Ocoya and Buffer document assistant/API surfaces; Postiz documents an open-source/self-hosted publishing route. They are integration candidates, not mandatory dependencies or verified cost-free substitutes. [Ocoya](https://www.ocoya.com/features/mcp), [Buffer](https://buffer.com/resources/buffer-features/), [Postiz](https://docs.postiz.com/introduction)

Before choosing one, compare maintenance, deployment, licensing, actual permissions, format coverage, rate/cash costs, retention/export, and uncertain-write handling against a direct adapter. Keep framework grants and brand isolation above the backend, so swapping it does not change authority.

## 5. Unresearched expansions

TikTok, Pinterest, Bluesky, Reddit, Facebook Pages, Google Business Profile, WhatsApp, community platforms, CMS, commerce, email, and other paid channels require current primary contract and audience-fit checks when selected. No support, free access, universal DM coverage, or account eligibility is implied here.

Community participation, local-business profiles, consented lists, financial claims, product availability, and identity-bearing assets have business-specific requirements. Apply those when relevant; do not make every unrelated business complete every module's setup.

## 6. Commissioning contract

1. Record the business need, exact account, required actions/formats, and owner scope.
2. Verify current official contracts, versions, provider review, costs, and reconciliation support.
3. Complete owner authentication and safe secret storage; never put tokens in a brand folder.
4. Verify identity/health in interactive and actual background contexts.
5. Validate media/input without publishing.
6. Run an explicitly approved test and verify the resulting object/visibility.
7. Exercise auth expiry, limits, partial failure, ambiguous write, manual/API crossover, and disconnect.
8. Enable only tested capabilities; keep exports usable.

## 7. Evidence limits

Direct Meta pages were inconsistently retrievable; accessible Meta-owned Postman content supplied the primary reference and must be revalidated during implementation. Some Apple documentation required JavaScript; no unsupported endpoint details were inferred. No logged-in account or production permission was inspected.
